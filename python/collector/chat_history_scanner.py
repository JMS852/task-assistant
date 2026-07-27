"""
Chat history scanner: scrolls through WeChat/QQ chat lists to find tasks and
notifications from the past 7 days.

Multi-method strategy (in priority order):
1. Clipboard copy (Ctrl+A, Ctrl+C) — works for WeChat Qt and QQ Chromium
2. Screenshot + EasyOCR — works universally
3. Screenshot + Tesseract — lighter alternative
4. UIA control tree — only works for QQ (Chromium), keep as last resort
"""
import time
import re
import sys
import json as _json
import os
import threading
import ctypes
from ctypes import wintypes
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout

# ── Module-level import diagnostics (critical for debugging Electron subprocess hangs) ──
def _diag(msg):
    print(_json.dumps({'event': 'history_scan_log', 'data': f'[chat_history_scanner] {msg}'}, ensure_ascii=False), flush=True)

_diag('stdlib imports done, importing uiautomation...')
try:
    import uiautomation as auto
    HAS_UIA = True
    _diag('uiautomation OK')
except ImportError:
    HAS_UIA = False
    _diag('uiautomation not available')

_diag('importing uia_listener...')
from .uia_listener import find_chat_windows, get_window_info
_diag('uia_listener OK')

# ── Optional dependencies ──
_diag('loading user32...')
user32 = ctypes.windll.user32
_diag('user32 OK')

_diag('importing PIL...')
try:
    from PIL import ImageGrab, Image
    HAS_PIL = True
    _diag('PIL OK')
except ImportError:
    HAS_PIL = False
    _diag('PIL not available')

_diag('importing pyperclip...')
try:
    import pyperclip
    HAS_CLIP = True
    _diag('pyperclip OK')
except ImportError:
    HAS_CLIP = False
    _diag('pyperclip not available')

# pytesseract is imported lazily inside _ocr_image() to avoid hanging
# when running as an Electron subprocess (same reason as EasyOCR).
HAS_PYTESSERACT_LIB = False
HAS_TESSERACT = False
_USER_TESSDATA = os.path.join(os.path.expanduser('~'), '.tesseract', 'tessdata')

def _ensure_tesseract():
    """Lazy-import pytesseract and configure Tesseract. Returns True if available."""
    global HAS_PYTESSERACT_LIB, HAS_TESSERACT
    if HAS_TESSERACT:
        return True
    if HAS_PYTESSERACT_LIB is False:
        try:
            import pytesseract
            HAS_PYTESSERACT_LIB = True
        except ImportError:
            return False
        except Exception:
            return False
    if not HAS_PYTESSERACT_LIB:
        return False
    # Configure tesseract path
    import subprocess as _subprocess
    for path in [
        r'C:\Program Files\Tesseract-OCR\tesseract.exe',
        r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe',
    ]:
        if os.path.exists(path):
            pytesseract.pytesseract.tesseract_cmd = path
            HAS_TESSERACT = True
            if os.path.isdir(_USER_TESSDATA):
                os.environ['TESSDATA_PREFIX'] = _USER_TESSDATA
            break
    if not HAS_TESSERACT:
        # Try PATH lookup
        try:
            r = _subprocess.run(['tesseract', '--version'], capture_output=True, timeout=5)
            if r.returncode == 0:
                HAS_TESSERACT = True
        except Exception:
            pass
    return HAS_TESSERACT

# EasyOCR is imported on-demand inside _get_easyocr_reader() to avoid
# loading torch (heavy DLL init) at module import time, which can hang
# indefinitely when running as a subprocess of Electron.
HAS_EASYOCR = False
_easyocr_import_checked = False
_diag('module loaded completely')

# ── Date pattern recognition ──
_DATE_PATTERNS = [
    (re.compile(r'(\d{4})\s*[年/\-]\s*(\d{1,2})\s*[月/\-]\s*(\d{1,2})\s*日?'), 'ymd'),
    (re.compile(r'(\d{1,2})\s*[月\-/]\s*(\d{1,2})\s*[日号]?'), 'md'),
    (re.compile(r'(今天|昨天|前天)'), 'relative'),
    (re.compile(r'(星期[一二三四五六日]|周[一二三四五六日])'), 'weekday'),
    (re.compile(r'(上午|下午|中午|晚上|凌晨)'), 'timeofday'),
]

SCAN_MAX_SCROLLS = 60
SCROLL_WAIT = 0.35
WEEK_SECONDS = 7 * 24 * 3600

# Global EasyOCR reader cache (expensive to reload)
_easyocr_reader = None
_easyocr_lock = threading.Lock()


def _get_easyocr_reader():
    global _easyocr_reader, HAS_EASYOCR, _easyocr_import_checked
    if not _easyocr_import_checked:
        _easyocr_import_checked = True
        try:
            import easyocr  # triggers torch import — only when OCR is actually needed
            HAS_EASYOCR = True
        except ImportError:
            HAS_EASYOCR = False
        except Exception:
            HAS_EASYOCR = False
    if not HAS_EASYOCR:
        return None
    with _easyocr_lock:
        if _easyocr_reader is None:
            _easyocr_reader = easyocr.Reader(
                ['ch_sim', 'en'], gpu=False, verbose=False,
                model_storage_directory=os.path.join(os.path.expanduser('~'), '.EasyOCR', 'model'),
                download_enabled=False)
    return _easyocr_reader


def _parse_date_from_text(text: str, today: datetime) -> datetime | None:
    """Try to extract a date from message text. Returns None if no date found."""
    for pattern, ptype in _DATE_PATTERNS:
        m = pattern.search(text)
        if not m:
            continue

        if ptype == 'ymd':
            y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
            return datetime(y, mo, d)

        if ptype == 'md':
            mo, d = int(m.group(1)), int(m.group(2))
            y = today.year
            dt = datetime(y, mo, d)
            if dt > today:
                dt = datetime(y - 1, mo, d)
            return dt

        if ptype == 'relative':
            word = m.group(1)
            if word == '今天':
                return today
            elif word == '昨天':
                return today - timedelta(days=1)
            elif word == '前天':
                return today - timedelta(days=2)

        if ptype == 'weekday':
            day_map = {'一': 0, '二': 1, '三': 2, '四': 3, '五': 4, '六': 5, '日': 6}
            for cn, num in day_map.items():
                if cn in m.group(1):
                    target_wd = num
                    current_wd = today.weekday()
                    diff = (current_wd - target_wd) % 7
                    if diff == 0:
                        diff = 7
                    return today - timedelta(days=diff)
    return None


# ── Method 1: Clipboard copy ──

def _send_keystroke(vk_code: int, modifiers: list = None):
    """Send a keystroke via Win32 keybd_event."""
    KEYEVENTF_KEYUP = 0x0002
    if modifiers:
        for mod in modifiers:
            ctypes.windll.user32.keybd_event(mod, 0, 0, 0)
            time.sleep(0.03)
    ctypes.windll.user32.keybd_event(vk_code, 0, 0, 0)
    time.sleep(0.03)
    ctypes.windll.user32.keybd_event(vk_code, 0, KEYEVENTF_KEYUP, 0)
    if modifiers:
        for mod in reversed(modifiers):
            time.sleep(0.03)
            ctypes.windll.user32.keybd_event(mod, 0, KEYEVENTF_KEYUP, 0)
    time.sleep(0.15)


def _read_via_clipboard(hwnd) -> list:
    """Read visible chat messages via Ctrl+A, Ctrl+C copy to clipboard."""
    if not HAS_CLIP:
        return []

    try:
        _emit('scanning', 'clipboard_focus', hwnd=str(hwnd))

        # Use AttachThreadInput to bypass foreground lock
        # This is the standard Win32 technique for background-to-foreground focus switching
        fg_hwnd = user32.GetForegroundWindow()
        our_tid = ctypes.windll.kernel32.GetCurrentThreadId()
        fg_tid = user32.GetWindowThreadProcessId(fg_hwnd, None) if fg_hwnd else 0
        target_tid = user32.GetWindowThreadProcessId(hwnd, None)

        attached = False
        if fg_tid and fg_tid != our_tid:
            ctypes.windll.user32.AttachThreadInput(our_tid, fg_tid, True)
            attached = True
        if target_tid and target_tid != our_tid:
            ctypes.windll.user32.AttachThreadInput(our_tid, target_tid, True)
            attached = True
        time.sleep(0.05)

        # Activate the window
        if user32.IsIconic(hwnd):
            user32.ShowWindow(hwnd, 9)  # SW_RESTORE
        user32.SetForegroundWindow(hwnd)
        user32.BringWindowToTop(hwnd)
        time.sleep(0.3)

        if attached:
            if fg_tid and fg_tid != our_tid:
                ctypes.windll.user32.AttachThreadInput(our_tid, fg_tid, False)
            if target_tid and target_tid != our_tid:
                ctypes.windll.user32.AttachThreadInput(our_tid, target_tid, False)

        fg_ok = user32.GetForegroundWindow() == hwnd
        _emit('scanning', 'clipboard_focused', fg_ok=fg_ok)

        # Select all and copy
        VK_CONTROL, VK_A, VK_C = 0x11, 0x41, 0x43
        _send_keystroke(VK_A, [VK_CONTROL])
        _send_keystroke(VK_C, [VK_CONTROL])
        _emit('scanning', 'clipboard_copied')

        text = pyperclip.paste()
        _emit('scanning', 'clipboard_pasted', length=len(text) if text else 0)
        if not text or len(text) < 5:
            return []

        return _parse_clipboard_text(text)
    except Exception as e:
        _emit('scanning', 'clipboard_error', error=str(e)[:100])
        return []


def _parse_clipboard_text(text: str) -> list:
    """Parse clipboard text into sender/content message pairs."""
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    messages = []
    pending_sender = None

    for line in lines:
        if re.match(r'^\d{1,2}:\d{2}$', line):
            continue
        if re.match(r'^(上午|下午|中午|晚上)\s*\d{1,2}:\d{2}$', line):
            continue
        if re.match(r'^[\d/]+\s*[\d:]+$', line):
            continue

        if len(line) <= 10 and not any(c in line for c in '，。！？…的了吗呢啊吧http'):
            if pending_sender and pending_sender != line:
                messages.append({'sender': '', 'content': pending_sender})
            pending_sender = line
        else:
            messages.append({'sender': pending_sender or '', 'content': line})
            pending_sender = None

    if pending_sender:
        messages.append({'sender': '', 'content': pending_sender})

    return messages


# ── Method 2+3: Screenshot + OCR ──

def _capture_window_screenshot(hwnd):
    """Take a screenshot of the given window region."""
    if not HAS_PIL:
        return None
    rect = wintypes.RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(rect))
    try:
        return ImageGrab.grab(bbox=(rect.left, rect.top, rect.right, rect.bottom))
    except Exception:
        return None


def _crop_chat_area(image):
    """Crop screenshot to just the chat message area (right ~65%, below title bar, above input).

    WeChat layout: left sidebar (~30% width) = contacts, right area (~70%) = chat.
    QQ layout: similar left-right split.
    Returns cropped PIL Image, or original if cropping fails.
    """
    try:
        w, h = image.size
        # Chat area: right 65% of width, top 8% to bottom 20%
        left = int(w * 0.35)
        top = int(h * 0.08)
        right = w - int(w * 0.02)
        bottom = h - int(h * 0.18)
        if right > left and bottom > top and (right - left) > 200 and (bottom - top) > 200:
            return image.crop((left, top, right, bottom))
    except Exception:
        pass
    return image


def _parse_ocr_text(text: str) -> list:
    """Parse OCR output from chat screenshots into sender/message pairs.

    OCR output is noisy — includes UI labels, timestamps, mixed ordering.
    This parser filters noise and reconstructs message boundaries.
    """
    UI_NOISE = {'微信', 'WeChat', '通讯录', '发现', '朋友圈', '视频号', '小程序',
                '搜一搜', '文件传输助手', '表情', '更多', '设置', '语音', '视频通话',
                '群聊名称', '拍一拍', '@所有人', '撤回', '已读', '未读',
                '聊天', '消息', '联系人', '新的朋友', '仅聊天', '添加', '备注',
                '转账', '红包', '图片', '视频', '文件', '位置', '收藏', '相册',
                '朋友圈', '看一看', '直播', '购物', '游戏', '小程序', '搜狗'}
    messages = []
    lines = text.split('\n')
    pending_sender = ''
    pending_content = []

    for raw in lines:
        line = raw.strip()
        if not line:
            if pending_content:
                content = ' '.join(pending_content).strip()
                if len(content) > 1:
                    messages.append({'sender': pending_sender, 'content': content})
                pending_content = []
                pending_sender = ''
            continue

        # Skip timestamp-only lines
        if re.match(r'^[\d:：\s]+$', line):
            continue
        if re.match(r'^\d{2,4}[-/年]\d{1,2}[-/月]\d{1,2}[日号]?[\s\d:：]*$', line):
            continue
        if re.match(r'^(星期[一二三四五六日]|周[一二三四五六日])\s*$', line):
            continue

        # Skip UI element noise
        is_noise = False
        for kw in UI_NOISE:
            if kw in line:
                is_noise = True
                break
        if is_noise:
            continue

        # Skip very short fragments (1-2 chars, likely noise)
        if len(line) <= 2:
            continue

        # Heuristic: short line (<= 10 chars) without common message punctuation
        # is likely a sender name or UI label
        has_msg_punct = any(c in line for c in '，。！？…、；：""''（）【】《》.,!?;:')
        has_common_char = any(c in line for c in '的了吗呢啊吧')

        if len(line) <= 10 and not has_msg_punct:
            # Short line — could be sender name or noise
            # Save previous message
            if pending_content:
                content = ' '.join(pending_content).strip()
                if len(content) > 1:
                    messages.append({'sender': pending_sender, 'content': content})
                pending_content = []
            pending_sender = line
        else:
            # Content line
            pending_content.append(line)

    # Don't lose the last message
    if pending_content:
        content = ' '.join(pending_content).strip()
        if len(content) > 1:
            messages.append({'sender': pending_sender, 'content': content})

    return messages


def _ocr_image(image) -> str:
    """Extract text from a PIL Image using best available OCR."""
    # Try EasyOCR first (better Chinese support)
    # _get_easyocr_reader() does the lazy import so torch is only loaded when
    # we actually need OCR (clipboard method is tried first and usually succeeds)
    try:
        import numpy as np
        reader = _get_easyocr_reader()
        if reader:
            results = reader.readtext(np.array(image))
            return '\n'.join(r[1] for r in results)
    except Exception:
        pass

    # Fall back to Tesseract (lazy-imported to avoid hang in Electron subprocess)
    if _ensure_tesseract():
        try:
            return pytesseract.image_to_string(image, lang='chi_sim+eng')
        except Exception:
            pass

    return ''


def _read_via_ocr(hwnd) -> list:
    """Read visible chat messages via screenshot + OCR."""
    img = _capture_window_screenshot(hwnd)
    if not img:
        return []

    # Crop to chat message area to reduce UI noise
    img = _crop_chat_area(img)

    text = _ocr_image(img)
    if not text.strip():
        _emit('scanning', 'ocr_empty', hint='OCR returned empty text')
        return []

    # Emit raw OCR output for diagnostics
    _emit('scanning', 'ocr_raw', length=len(text), preview=text[:300])

    # Parse with both parsers and use whichever gives more results
    msgs_ocr = _parse_ocr_text(text)
    msgs_clip = _parse_clipboard_text(text)

    if len(msgs_clip) >= len(msgs_ocr):
        messages = msgs_clip
    else:
        messages = msgs_ocr

    _emit('scanning', 'ocr_parsed', ocr_count=len(msgs_ocr), clip_count=len(msgs_clip), chosen=len(messages))

    return messages


# ── Method 4: UIA control tree (QQ Chromium only) ──

def _find_list_control(uia_control):
    """Recursively find the first ListControl/ListBox within a UIA control tree."""
    def _search(ctrl, depth=0):
        if depth > 6:
            return None
        try:
            ct = ctrl.ControlTypeName
            cls = (ctrl.ClassName or '').lower()
            if ct in ('ListControl', 'ListBox', 'List', 'DataGrid', 'Table') or \
               'list' in cls or 'listbox' in cls:
                return ctrl
            for child in ctrl.GetChildren():
                result = _search(child, depth + 1)
                if result:
                    return result
        except Exception:
            pass
        return None
    return _search(uia_control)


def _read_list_items(list_ctrl) -> list:
    """Read all visible items from a UIA list control."""
    messages = []
    try:
        items = list_ctrl.GetChildren()
        for item in items:
            try:
                text_parts = []
                for child in item.GetChildren():
                    try:
                        name = child.Name
                        if name and name.strip():
                            text_parts.append(name.strip())
                    except Exception:
                        continue

                meaningful = [t for t in text_parts if len(t) > 1]
                if len(meaningful) >= 2:
                    messages.append({
                        'sender': meaningful[0],
                        'content': ' '.join(meaningful[1:]),
                    })
                elif len(meaningful) == 1 and len(meaningful[0]) > 3:
                    messages.append({
                        'sender': '',
                        'content': meaningful[0],
                    })
            except Exception:
                continue
    except Exception:
        pass
    return messages


def _scroll_list_up(list_ctrl) -> bool:
    """Scroll the list control up (toward older messages). Returns True on success."""
    try:
        pattern = list_ctrl.GetScrollPattern()
        if pattern:
            current = pattern.VerticalScrollPercent
            if current > 0:
                new_pct = max(0, current - 30)
                pattern.SetScrollPercent(new_pct, pattern.HorizontalScrollPercent)
                return True
    except Exception:
        pass

    try:
        list_ctrl.SetFocus()
        time.sleep(0.05)
        auto.SendKeys('{PageUp}')
        return True
    except Exception:
        pass

    try:
        WM_VSCROLL = 0x0115
        SB_PAGEUP = 2
        native_hwnd = list_ctrl.NativeWindowHandle
        if native_hwnd:
            ctypes.windll.user32.SendMessageW(native_hwnd, WM_VSCROLL, SB_PAGEUP, 0)
            return True
    except Exception:
        pass

    return False


# ── Event emission (for Electron bridge progress tracking) ──

def _emit(stage: str, phase: str, **kwargs):
    """Emit a progress event to stdout for the Electron bridge to pick up."""
    try:
        data = {'stage': stage, 'phase': phase}
        data.update(kwargs)
        print(_json.dumps({'event': 'history_scan_progress', 'data': data}, ensure_ascii=False), flush=True)
    except Exception as exc:
        print(_json.dumps({'event': 'error', 'data': f'_emit failed: {exc}'}), flush=True)


# ── Reading dispatcher: tries each method ──

def _read_visible_messages(hwnd, method_prefs: list = None) -> tuple:
    """Read visible messages using the best available method.

    Returns (messages: list, method_used: str)
    """
    if method_prefs is None:
        method_prefs = ['clipboard', 'ocr', 'uia']

    for method in method_prefs:
        _emit('scanning', 'method_try', method=method, hwnd=str(hwnd))
        if method == 'clipboard':
            msgs = _read_via_clipboard(hwnd)
            if msgs:
                _emit('scanning', 'method_ok', method='clipboard', count=len(msgs))
                return msgs, 'clipboard'
        elif method == 'ocr':
            msgs = _read_via_ocr(hwnd)
            if msgs:
                _emit('scanning', 'method_ok', method='ocr', count=len(msgs))
                return msgs, 'ocr'
        elif method == 'uia' and HAS_UIA:
            try:
                control = auto.ControlFromHandle(hwnd)
                if control:
                    lst = _find_list_control(control)
                    if lst:
                        msgs = _read_list_items(lst)
                        if msgs:
                            _emit('scanning', 'method_ok', method='uia', count=len(msgs))
                            return msgs, 'uia'
            except Exception:
                pass

    _emit('scanning', 'method_fail', hwnd=str(hwnd))
    return [], 'none'


def _scroll_up(hwnd, list_ctrl=None) -> bool:
    """Scroll the chat view up. Uses PageUp keystroke (works universally)."""
    try:
        user32.SetForegroundWindow(hwnd)
        time.sleep(0.05)
    except Exception:
        pass

    # Method 1: Win32 keybd_event PageUp (works for WeChat Qt and QQ)
    VK_PRIOR = 0x21
    KEYEVENTF_KEYUP = 0x0002
    ctypes.windll.user32.keybd_event(VK_PRIOR, 0, 0, 0)
    time.sleep(0.03)
    ctypes.windll.user32.keybd_event(VK_PRIOR, 0, KEYEVENTF_KEYUP, 0)
    time.sleep(SCROLL_WAIT)
    return True


# ── Main scan ──

def scan_single_chat(hwnd, source_name, max_days=7) -> list:
    """Scan a single chat window's history. Returns list of message dicts."""
    all_messages = []
    seen = set()
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    cutoff = today - timedelta(days=max_days)
    method_used = None

    _emit('scanning', 'reading_start', source=source_name)

    # Read initial (newest) visible messages
    messages, method = _read_visible_messages(hwnd)
    method_used = method
    _emit('scanning', 'reading_result', source=source_name, method=method, count=len(messages),
          sample=[(m.get('sender','')[:10], m.get('content','')[:50]) for m in messages[:3]])

    for m in messages:
        mid = f"{m['sender']}|{m['content']}"
        if mid not in seen and len(m['content']) > 2:
            seen.add(mid)
            m['captured_at'] = datetime.now().isoformat()
            m['source'] = source_name
            m['method'] = method_used
            all_messages.append(m)

    _emit('scanning', 'reading_after_dedup', source=source_name, count=len(all_messages))

    if not all_messages:
        _emit('scanning', 'reading_empty', source=source_name,
              hint='No messages found in initial view. Check: is chat window showing messages? Is Ctrl+A supported?')
        return []

    # Scroll up page by page
    for scroll_idx in range(SCAN_MAX_SCROLLS):
        _scroll_up(hwnd)

        messages, method = _read_visible_messages(hwnd,
            method_prefs=['clipboard', 'ocr'] if method_used == 'uia' else ['clipboard', 'ocr', 'uia'])

        new_in_page = 0
        oldest_date_found = None

        for m in messages:
            mid = f"{m['sender']}|{m['content']}"
            if mid in seen or len(m['content']) <= 2:
                continue
            seen.add(mid)
            m['captured_at'] = datetime.now().isoformat()
            m['source'] = source_name
            m['method'] = method
            all_messages.append(m)
            new_in_page += 1

            full_text = f"{m['sender']} {m['content']}"
            dt = _parse_date_from_text(full_text, today)
            if dt and (oldest_date_found is None or dt < oldest_date_found):
                oldest_date_found = dt

        if oldest_date_found and oldest_date_found < cutoff:
            break

        if new_in_page == 0 and scroll_idx >= 3:
            break

    return all_messages


def scan_all_chats(max_days=7, progress_callback=None) -> dict:
    """Scan all active WeChat/QQ windows and collect history.

    Args:
        max_days: Maximum days to look back
        progress_callback: Called with (stage, info_dict) for progress updates

    Returns:
        dict with 'messages' list and 'stats' metadata
    """
    _emit('scanning', 'locating', phase_detail='calling find_chat_windows')
    try:
        windows = find_chat_windows()
        _emit('scanning', 'locating', windows_found=len(windows),
              windows_detail=[f"{w['target']['name']}: {w['info']['title'][:40]}" for w in windows])
    except Exception as e:
        import traceback
        _emit('scanning', 'locating_error', error=str(e), traceback=traceback.format_exc()[-500:])
        windows = []

    all_messages = []
    stats = {
        'windows_scanned': 0,
        'total_messages': 0,
        'errors': [],
        'methods_used': {},
    }

    if progress_callback:
        progress_callback('scanning', {
            'phase': 'locating',
            'windows_found': len(windows),
        })

    for i, win_info in enumerate(windows):
        hwnd = win_info['info']['hwnd']
        source = win_info['target']['name']
        title = win_info['info']['title'][:40]

        if progress_callback:
            progress_callback('scanning', {
                'phase': 'reading',
                'current': i + 1,
                'total': len(windows),
                'source': source,
                'title': title,
            })

        try:
            msgs = scan_single_chat(hwnd, source, max_days)
            all_messages.extend(msgs)
            stats['windows_scanned'] += 1
            stats['total_messages'] += len(msgs)

            for m in msgs:
                method = m.get('method', 'unknown')
                stats['methods_used'][method] = stats['methods_used'].get(method, 0) + 1

            if progress_callback:
                progress_callback('scanned_window', {
                    'source': source,
                    'title': title,
                    'messages_found': len(msgs),
                    'methods': stats['methods_used'],
                })
        except Exception as e:
            stats['errors'].append(f'{source}: {str(e)}')
            if progress_callback:
                progress_callback('window_error', {
                    'source': source,
                    'error': str(e),
                })

    if progress_callback:
        progress_callback('complete', stats)

    return {'messages': all_messages, 'stats': stats}
