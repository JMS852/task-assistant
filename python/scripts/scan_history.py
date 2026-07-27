"""
Chat history scanner - 聊天记录扫描器

Scans WeChat/QQ chat windows by screenshotting and OCR-extracting messages,
then classifies each as task, notification, or normal conversation.

Works even though WeChat (Qt) doesn't expose its message list through UIA.

Usage:
    python scripts/scan_history.py                  # scan all windows, 7 days
    python scripts/scan_history.py --days 3          # scan last 3 days
    python scripts/scan_history.py --verbose         # show every task/notification found
    python scripts/scan_history.py --screenshots     # save screenshots for debugging
    python scripts/scan_history.py --no-scan         # just list windows, don't scan
    python scripts/scan_history.py --use-clipboard   # try clipboard instead of OCR
"""
import sys
import os
import json
import time
import re
import argparse
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# ── Dependency checks ──
try:
    from PIL import ImageGrab, Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

try:
    import pyperclip
    HAS_CLIP = True
except ImportError:
    HAS_CLIP = False

HAS_TESSERACT = False
TESSERACT_PATH = None
_USER_TESSDATA = os.path.join(os.path.expanduser('~'), '.tesseract', 'tessdata')
try:
    import pytesseract
    import subprocess
    for path in [
        r'C:\Program Files\Tesseract-OCR\tesseract.exe',
        r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe',
    ]:
        if os.path.exists(path):
            TESSERACT_PATH = path
            pytesseract.pytesseract.tesseract_cmd = path
            HAS_TESSERACT = True
            if os.path.isdir(_USER_TESSDATA):
                os.environ['TESSDATA_PREFIX'] = _USER_TESSDATA
            break
    if not HAS_TESSERACT:
        # Try PATH lookup
        try:
            r = subprocess.run(['tesseract', '--version'], capture_output=True, timeout=5)
            if r.returncode == 0:
                HAS_TESSERACT = True
        except Exception:
            pass
except ImportError:
    pass

HAS_EASYOCR = False
try:
    import easyocr
    HAS_EASYOCR = True
except ImportError:
    pass


def check_deps() -> bool:
    """Return True if at least one OCR/reading method is available."""
    if HAS_PIL and (HAS_TESSERACT or HAS_EASYOCR):
        return True
    if HAS_PIL and HAS_CLIP:
        return True
    return False


def print_deps_status():
    ok_mark = '[OK]'
    no_mark = '[MISSING]'
    print('  可用模块:')
    print(f'    Pillow (screenshot):   {ok_mark if HAS_PIL else no_mark + " pip install pillow"}')
    print(f'    pyperclip (clipboard): {ok_mark if HAS_CLIP else no_mark + " pip install pyperclip"}')
    if HAS_TESSERACT and TESSERACT_PATH:
        print(f'    Tesseract OCR:         {ok_mark} ({TESSERACT_PATH})')
    else:
        print(f'    Tesseract OCR:         {no_mark} winget install UB-Mannheim.TesseractOCR')
    print(f'    EasyOCR:               {ok_mark if HAS_EASYOCR else no_mark + " pip install easyocr"}')
    ok = check_deps()
    print(f'\n  Scanner ready: {"YES" if ok else "NO - install missing deps"}')
    return ok


# ── Win32 API ──
import ctypes
from ctypes import wintypes

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32
WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

TARGETS = [
    {'process': 'WeChat.exe', 'title_kw': ['微信', 'WeChat'], 'name': 'wechat'},
    {'process': 'QQ.exe', 'title_kw': ['QQ', '腾讯QQ'], 'name': 'qq'},
    {'process': 'WeChatApp.exe', 'title_kw': ['微信'], 'name': 'wechat'},
    {'process': 'QQNT.exe', 'title_kw': ['QQ'], 'name': 'qq'},
]

# ── Date patterns ──
DATE_RE = re.compile(
    r'(\d{4}\s*[年/\-]\s*\d{1,2}\s*[月/\-]\s*\d{1,2})'
    r'|(\d{1,2}\s*[月\-/]\s*\d{1,2})'
    r'|(今天|昨天|前天)'
    r'|(星期[一二三四五六日]|周[一二三四五六日])'
)


def parse_date(text: str, today: datetime) -> datetime | None:
    m = DATE_RE.search(text)
    if not m:
        return None
    if m.group(1):
        parts = re.split(r'[年/\-月]', m.group(1).replace('日', ''))
        nums = [int(p.strip()) for p in parts if p.strip().isdigit()]
        if len(nums) >= 3:
            return datetime(nums[0], nums[1], nums[2])
    if m.group(2):
        nums = [int(p) for p in re.findall(r'\d+', m.group(2))]
        if len(nums) >= 2:
            y = today.year
            dt = datetime(y, nums[0], nums[1])
            return dt if dt <= today else datetime(y - 1, nums[0], nums[1])
    if m.group(3):
        word = m.group(3)
        if word == '今天': return today
        if word == '昨天': return today - timedelta(days=1)
        if word == '前天': return today - timedelta(days=2)
    if m.group(4):
        day_map = {'一': 0, '二': 1, '三': 2, '四': 3, '五': 4, '六': 5, '日': 6}
        for cn, num in day_map.items():
            if cn in m.group(4):
                diff = (today.weekday() - num) % 7
                if diff == 0: diff = 7
                return today - timedelta(days=diff)
    return None


# ── Window discovery ──
def get_window_info(hwnd):
    try:
        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        # Use SendMessageTimeoutW to avoid hanging on unresponsive windows
        WM_GETTEXT = 0x000D
        SMTO_ABORTIFHUNG = 0x0002
        title = ctypes.create_unicode_buffer(256)
        result = wintypes.LRESULT()
        user32.SendMessageTimeoutW(hwnd, WM_GETTEXT, 256, ctypes.byref(title),
                                   SMTO_ABORTIFHUNG, 500, ctypes.byref(result))
        cls = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(hwnd, cls, 256)
        process_name = ''
        try:
            handle = kernel32.OpenProcess(0x0400 | 0x0010, False, pid)
            if handle:
                exe = ctypes.create_unicode_buffer(260)
                size = wintypes.DWORD(260)
                if kernel32.QueryFullProcessImageNameW(handle, 0, exe, ctypes.byref(size)):
                    process_name = exe.value.split('\\')[-1]
                kernel32.CloseHandle(handle)
        except Exception:
            pass
        rect = wintypes.RECT()
        user32.GetWindowRect(hwnd, ctypes.byref(rect))
        return {
            'hwnd': hwnd, 'pid': pid.value, 'title': title.value,
            'class': cls.value, 'process': process_name,
            'visible': user32.IsWindowVisible(hwnd),
            'rect': (rect.left, rect.top, rect.right, rect.bottom),
        }
    except Exception:
        return None


def find_chat_windows():
    found = []
    found_hwnds = []

    def enum_callback(hwnd, lparam):
        info = get_window_info(hwnd)
        if not info or not info['visible']:
            return True
        l, t, r, b = info['rect']
        w, h = r - l, b - t
        if w < 200 or h < 200:
            return True
        process_lower = info['process'].lower()
        for target in TARGETS:
            if process_lower == target['process'].lower():
                found.append({'info': info, 'target': target})
                found_hwnds.append(hwnd)
                return True
            if any(kw.lower() in info['title'].lower() for kw in target['title_kw']):
                if hwnd not in found_hwnds:
                    found.append({'info': info, 'target': target})
                    found_hwnds.append(hwnd)
                return True
        return True

    user32.EnumWindows(WNDENUMPROC(enum_callback), 0)
    return found


# ── Task / notification classifier ──
TASK_SIGNALS = [
    (re.compile(r'帮[我我]'), 0.9, 'task'),
    (re.compile(r'(请|麻烦|帮忙).*(做|写|弄|处理|完成|修复|改|发|提交|整理|准备|安排|预定|订|买|查|检查|确认|通知|告诉|联系|回复|跟进)'), 0.85, 'task'),
    (re.compile(r'(记得|别忘了|不要忘了|别忘了).*'), 0.8, 'task'),
    (re.compile(r'(明天|今天|后天|下周|本周|周末).*要'), 0.75, 'task'),
    (re.compile(r'(截止|deadline|DDL|到期)'), 0.8, 'task'),
    (re.compile(r'(发邮件|发文件|发文档|发周报|发报告|提交报告)'), 0.85, 'task'),
    (re.compile(r'(需要|需求|要求).*(做|写|提交|完成|处理)'), 0.7, 'task'),
    (re.compile(r'(任务|待办|TODO|todo)'), 0.8, 'task'),
    (re.compile(r'@所有人|@all'), 0.65, 'task'),
    (re.compile(r'(通知|公告|提醒|请注意|注意)'), 0.7, 'notification'),
    (re.compile(r'(会议|开会|例会|周会|讨论)'), 0.65, 'notification'),
    (re.compile(r'(更新|升级|上线|发布|部署|发版)'), 0.6, 'notification'),
    (re.compile(r'(请假|休假|出差|外出|调休)'), 0.6, 'notification'),
    (re.compile(r'(写|做|弄|改|修|发|交|买|定|约).*'), 0.4, 'task'),
]


def classify_message(text: str) -> dict:
    scores = {'task': 0.0, 'notification': 0.0}
    for pattern, weight, label in TASK_SIGNALS:
        if pattern.search(text):
            scores[label] += weight
    for k in scores:
        scores[k] = min(scores[k], 0.95)
    if scores['task'] > 0.3:
        return {'type': 'task', 'confidence': round(scores['task'], 2)}
    elif scores['notification'] > 0.3:
        return {'type': 'notification', 'confidence': round(scores['notification'], 2)}
    return {'type': 'normal', 'confidence': 0.0}


# ── OCR / text extraction ──
def extract_text_from_image(image, reader_cache: dict) -> str:
    """Extract text from a PIL Image using the best available OCR method."""
    if HAS_EASYOCR:
        if 'easyocr' not in reader_cache:
            print('    [OCR] 加载 EasyOCR (首次较慢)...')
            reader_cache['easyocr'] = easyocr.Reader(
                ['ch_sim', 'en'], gpu=False, verbose=False,
                model_storage_directory=os.path.join(os.path.expanduser('~'), '.EasyOCR', 'model'),
                download_enabled=False)
        import numpy as np
        results = reader_cache['easyocr'].readtext(np.array(image))
        return '\n'.join(r[1] for r in results)
    elif HAS_TESSERACT:
        return pytesseract.image_to_string(image, lang='chi_sim+eng')
    else:
        return ''


def parse_ocr_text(text: str) -> list:
    """Parse OCR output into individual messages.

    Heuristic: short lines are sender names, longer lines are message content.
    """
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    messages = []
    pending_sender = None

    for line in lines:
        # Skip pure time stamps
        if re.match(r'^\d{2}:\d{2}$', line):
            continue
        if re.match(r'^(上午|下午|中午|晚上|凌晨)\s*\d{1,2}:\d{2}$', line):
            continue

        # Skip system messages
        if re.match(r'^[\d/]+\s*[\d:]+\s*(下午|上午)?', line):
            continue

        # Short line = likely sender name
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


# ── Main scan logic ──
def scan_window(hwnd, source_name, title, max_days=7, reader_cache=None,
                verbose=False, screenshot_dir=None, use_clipboard=False):
    """Scan a single chat window."""
    print(f'\n{"="*60}')
    print(f'[SCAN] {source_name.upper()} - {title[:50]}')
    print(f'{"="*60}')
    sys.stdout.flush()

    if reader_cache is None:
        reader_cache = {}

    # Bring window to foreground
    try:
        user32.SetForegroundWindow(hwnd)
        time.sleep(0.4)
    except Exception:
        pass

    all_messages = []
    seen = set()
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    cutoff = today - timedelta(days=max_days)
    stats = {'task': 0, 'notification': 0, 'normal': 0}

    # Scroll up via PageUp key
    def do_scroll():
        VK_PRIOR = 0x21  # PageUp
        KEYEVENTF_KEYUP = 0x0002
        ctypes.windll.user32.keybd_event(VK_PRIOR, 0, 0, 0)
        time.sleep(0.03)
        ctypes.windll.user32.keybd_event(VK_PRIOR, 0, KEYEVENTF_KEYUP, 0)
        time.sleep(0.4)

    def read_screen():
        """Read current screen and return messages."""
        if not HAS_PIL:
            return []

        rect = wintypes.RECT()
        user32.GetWindowRect(hwnd, ctypes.byref(rect))
        img = ImageGrab.grab(bbox=(rect.left, rect.top, rect.right, rect.bottom))

        if screenshot_dir:
            idx = len(os.listdir(screenshot_dir))
            img.save(os.path.join(screenshot_dir, f'frame_{idx:04d}.png'))

        if use_clipboard and HAS_CLIP:
            # Use clipboard approach (Ctrl+A, Ctrl+C)
            VK_CONTROL, VK_A, VK_C = 0x11, 0x41, 0x43
            KEYEVENTF_KEYUP = 0x0002
            ctypes.windll.user32.keybd_event(VK_CONTROL, 0, 0, 0)
            time.sleep(0.03)
            ctypes.windll.user32.keybd_event(VK_A, 0, 0, 0)
            time.sleep(0.03)
            ctypes.windll.user32.keybd_event(VK_A, 0, KEYEVENTF_KEYUP, 0)
            ctypes.windll.user32.keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0)
            time.sleep(0.2)
            ctypes.windll.user32.keybd_event(VK_CONTROL, 0, 0, 0)
            time.sleep(0.03)
            ctypes.windll.user32.keybd_event(VK_C, 0, 0, 0)
            time.sleep(0.03)
            ctypes.windll.user32.keybd_event(VK_C, 0, KEYEVENTF_KEYUP, 0)
            ctypes.windll.user32.keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0)
            time.sleep(0.2)
            try:
                text = pyperclip.paste()
                if text and len(text) > 10:
                    return parse_ocr_text(text)
            except Exception:
                pass

        # OCR fallback
        text = extract_text_from_image(img, reader_cache)
        return parse_ocr_text(text)

    # Read initial screen
    print('  Reading messages...')
    messages = read_screen()
    for m in messages:
        mid = f"{m['sender']}|{m['content']}"
        if mid not in seen and len(m['content']) > 2:
            seen.add(mid)
            cls = classify_message(f"{m['sender']} {m['content']}")
            m['classification'] = cls['type']
            m['confidence'] = cls['confidence']
            all_messages.append(m)
            stats[cls['type']] += 1

    print(f'  Initial: {len(all_messages)} messages')
    sys.stdout.flush()

    # Scroll through history
    for scroll_i in range(60):
        do_scroll()
        messages = read_screen()

        new_count = 0
        oldest_date = None

        for m in messages:
            mid = f"{m['sender']}|{m['content']}"
            if mid in seen or len(m['content']) <= 2:
                continue
            seen.add(mid)
            cls = classify_message(f"{m['sender']} {m['content']}")
            m['classification'] = cls['type']
            m['confidence'] = cls['confidence']
            all_messages.append(m)
            stats[cls['type']] += 1
            new_count += 1

            if verbose and cls['type'] != 'normal':
                marker = 'TASK' if cls['type'] == 'task' else 'NOTIFY'
                print(f'    [{marker}] {m["sender"][:15]}: {m["content"][:80]}')

            dt = parse_date(f"{m['sender']} {m['content']}", today)
            if dt and (oldest_date is None or dt < oldest_date):
                oldest_date = dt

        if scroll_i % 5 == 0:
            print(f'  滚动 #{scroll_i+1}: +{new_count} 条, 共 {len(all_messages)}, '
                  f'任务={stats["task"]} 通知={stats["notification"]}')
            sys.stdout.flush()

        if oldest_date and oldest_date < cutoff:
            print(f'  到达时间边界: {oldest_date.strftime("%Y-%m-%d")}')
            break
        if new_count == 0 and scroll_i >= 3:
            print('  无新消息，到达历史顶部')
            break

    print(f'  完成: {len(all_messages)} 条 | 任务 {stats["task"]} | 通知 {stats["notification"]}')
    return all_messages


def main():
    parser = argparse.ArgumentParser(description='聊天记录扫描器 - 从微信/QQ截图提取并分类消息')
    parser.add_argument('--days', type=int, default=7)
    parser.add_argument('--output', type=str, default=None)
    parser.add_argument('--verbose', action='store_true')
    parser.add_argument('--all', action='store_true')
    parser.add_argument('--screenshots', action='store_true')
    parser.add_argument('--no-scan', action='store_true')
    parser.add_argument('--use-clipboard', action='store_true')
    args = parser.parse_args()

    print('=' * 60)
    print('  聊天记录扫描器 (OCR 截图模式)')
    print(f'  回溯: {args.days} 天 | 时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    print('=' * 60)
    print()

    if not print_deps_status():
        return

    # Find windows
    windows = find_chat_windows()
    print(f'\n发现 {len(windows)} 个聊天窗口:')
    for i, w in enumerate(windows):
        l, t, r, b = w['info']['rect']
        print(f'  [{i+1}] {w["target"]["name"]}: \"{w["info"]["title"][:50]}\" '
              f'({r-l}x{b-t})')
    sys.stdout.flush()

    if not windows:
        print('\n未发现微信/QQ窗口。请确认已登录并打开了聊天窗口。')
        return

    if args.no_scan:
        return

    # Setup screenshot dir
    screenshot_dir = None
    if args.screenshots:
        desktop = os.path.join(os.path.expanduser('~'), 'Desktop')
        screenshot_dir = os.path.join(desktop, f'chat_screens_{datetime.now().strftime("%H%M%S")}')
        os.makedirs(screenshot_dir, exist_ok=True)
        print(f'\n截图保存到: {screenshot_dir}')

    reader_cache = {}

    # Scan
    all_results = []
    for w in windows:
        msgs = scan_window(
            w['info']['hwnd'], w['target']['name'], w['info']['title'],
            max_days=args.days, reader_cache=reader_cache,
            verbose=args.verbose, screenshot_dir=screenshot_dir,
            use_clipboard=args.use_clipboard,
        )
        all_results.append({
            'source': w['target']['name'],
            'window_title': w['info']['title'],
            'message_count': len(msgs),
            'messages': msgs,
        })

    # Summary
    total_msgs = sum(r['message_count'] for r in all_results)
    total_tasks = sum(sum(1 for m in r['messages'] if m['classification'] == 'task') for r in all_results)
    total_notify = sum(sum(1 for m in r['messages'] if m['classification'] == 'notification') for r in all_results)

    print(f'\n{"="*60}')
    print(f'  扫描完成')
    print(f'  窗口: {len(all_results)} | 消息: {total_msgs}')
    print(f'  任务: {total_tasks} | 通知: {total_notify} | 普通: {total_msgs - total_tasks - total_notify}')
    print(f'{"="*60}')
    sys.stdout.flush()

    # Print found items
    if total_tasks + total_notify > 0:
        print(f'\n{"─"*60}')
        print('  发现的任务和通知:')
        print(f'{"─"*60}')
        for r in all_results:
            for m in r['messages']:
                if m['classification'] == 'task':
                    print(f'  🔴 [任务 {m["confidence"]:.0%}] {m["sender"]}: {m["content"][:100]}')
        for r in all_results:
            for m in r['messages']:
                if m['classification'] == 'notification':
                    print(f'  🔔 [通知 {m["confidence"]:.0%}] {m["sender"]}: {m["content"][:100]}')

    if args.all:
        print(f'\n{"─"*60}')
        print('  全部消息:')
        print(f'{"─"*60}')
        for r in all_results:
            print(f'\n  [{r["source"]}] {r["window_title"][:40]}')
            for i, m in enumerate(r['messages']):
                tag = {'task': '🔴', 'notification': '🔔', 'normal': '  '}[m['classification']]
                print(f'  {i+1:4d}. {tag} {m["sender"]}: {m["content"][:80]}')

    # Save
    if args.output:
        output_path = args.output
    else:
        desktop = os.path.join(os.path.expanduser('~'), 'Desktop')
        output_path = os.path.join(desktop, f'chat_scan_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json')

    save_data = {
        'scan_time': datetime.now().isoformat(),
        'max_days': args.days,
        'total_messages': total_msgs,
        'total_tasks': total_tasks,
        'total_notifications': total_notify,
        'results': [
            {
                'source': r['source'],
                'window_title': r['window_title'],
                'tasks': [m for m in r['messages'] if m['classification'] == 'task'],
                'notifications': [m for m in r['messages'] if m['classification'] == 'notification'],
            }
            for r in all_results
        ],
    }

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(save_data, f, ensure_ascii=False, indent=2)
    print(f'\n结果已保存: {output_path}')


if __name__ == '__main__':
    main()
