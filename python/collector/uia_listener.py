"""
Hybrid WeChat/QQ message listener.

Strategy (in order of reliability):
1. Win32 EnumWindows → find chat windows (fast, no hang)
2. UIA ControlFromHandle → read chat list items from found windows
3. Windows toast notification monitoring → capture notification popups
4. Process-based popup detection → catch WeChat/QQ custom notification windows

Avoids uiautomation.GetRootControl().GetChildren() which hangs on some systems.
"""
import time
import threading
import json
import ctypes
from ctypes import wintypes
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout

try:
    import uiautomation as auto
    HAS_UIA = True
except ImportError:
    HAS_UIA = False

# ── Win32 API definitions ──
user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

# Target process names and window title keywords
TARGETS = [
    {'process': 'WeChat.exe', 'title_kw': ['微信', 'WeChat'], 'name': 'wechat'},
    {'process': 'QQ.exe', 'title_kw': ['QQ', '腾讯QQ'], 'name': 'qq'},
    {'process': 'WeChatApp.exe', 'title_kw': ['微信'], 'name': 'wechat'},
    {'process': 'QQNT.exe', 'title_kw': ['QQ'], 'name': 'qq'},
]

# Chat process names for popup notification detection (lowercase)
_CHAT_PROCESSES = {'wechat.exe', 'wechatapp.exe', 'qq.exe', 'qqnt.exe'}

captured_messages = []
running = False
message_callback = None  # set by start_listener
listener_status = {'state': 'idle', 'windows_found': [], 'messages_captured': 0, 'last_error': ''}


# Storage for first error from get_window_info (logged after EnumWindows to avoid
# issues with print/IO inside ctypes callbacks)
_gwi_error = None

def get_window_info(hwnd):
    """Get process name, title, and class for a window handle."""
    global _gwi_error
    try:
        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))

        # Get window title — use GetWindowTextW directly (simpler, fewer params, less
        # likely to fail in ctypes callback context than SendMessageTimeoutW)
        title = ctypes.create_unicode_buffer(256)
        user32.GetWindowTextW(hwnd, title, 256)

        cls = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(hwnd, cls, 256)

        # Get process name from pid
        process_name = ''
        try:
            PROCESS_QUERY_INFORMATION = 0x0400
            PROCESS_VM_READ = 0x0010
            handle = kernel32.OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, False, pid)
            if handle:
                exe_name = ctypes.create_unicode_buffer(260)
                size = wintypes.DWORD(260)
                if kernel32.QueryFullProcessImageNameW(handle, 0, exe_name, ctypes.byref(size)):
                    process_name = exe_name.value.split('\\')[-1]
                kernel32.CloseHandle(handle)
        except Exception:
            pass

        return {
            'hwnd': hwnd,
            'pid': pid.value,
            'title': title.value,
            'class': cls.value,
            'process': process_name,
            'visible': user32.IsWindowVisible(hwnd),
        }
    except Exception as e:
        if _gwi_error is None:
            _gwi_error = (hwnd, type(e).__name__, str(e)[:300])
        return None


def find_chat_windows():
    """Find WeChat/QQ windows using Win32 EnumWindows (avoids UIA hang)."""
    global _gwi_error
    _gwi_error = None
    found = []
    found_hwnds = []
    diag_windows = []  # Collect diagnostic info
    counters = {'total': 0, 'visible': 0, 'large_enough': 0, 'info_ok': 0}

    def enum_callback(hwnd, lparam):
        counters['total'] += 1
        info = get_window_info(hwnd)
        if not info:
            return True
        counters['info_ok'] += 1
        if not info['visible']:
            return True
        counters['visible'] += 1
        # Skip tiny or tool windows
        rect = wintypes.RECT()
        if not user32.GetWindowRect(hwnd, ctypes.byref(rect)):
            return True
        width = rect.right - rect.left
        height = rect.bottom - rect.top
        if width < 200 or height < 200:
            diag_windows.append(f'SKIP_SMALL:{info["process"]}|{info["title"][:40]}|{width}x{height}')
            return True
        counters['large_enough'] += 1

        process_lower = info['process'].lower()
        title_text = info['title']

        # Collect diagnostic info for all reasonably-sized visible windows
        diag_windows.append(f'{info["process"]}|{title_text[:40]}|{width}x{height}')

        for target in TARGETS:
            if process_lower == target['process'].lower():
                found.append({'info': info, 'target': target})
                found_hwnds.append(hwnd)
                break
            # Also match by window title keywords
            for kw in target['title_kw']:
                if kw.lower() in title_text.lower():
                    if hwnd not in found_hwnds:
                        found.append({'info': info, 'target': target})
                        found_hwnds.append(hwnd)
                    break
        return True

    try:
        user32.EnumWindows(WNDENUMPROC(enum_callback), 0)
    except Exception as e:
        listener_status['last_error'] = f'EnumWindows failed: {e}'

    # Emit diagnostic info (safely, after EnumWindows has returned)
    gwi_err = _gwi_error
    try:
        print(json.dumps({
            'event': 'history_scan_log',
            'data': f'find_chat_windows: total={counters["total"]} info_ok={counters["info_ok"]} visible={counters["visible"]} large={counters["large_enough"]} gwi_error={gwi_err}'
        }, ensure_ascii=False), flush=True)
        if diag_windows:
            print(json.dumps({
                'event': 'history_scan_log',
                'data': 'windows detail: ' + ' | '.join(diag_windows[:30])
            }, ensure_ascii=False), flush=True)
        print(json.dumps({
            'event': 'history_scan_log',
            'data': f'find_chat_windows: matched {len(found)} chat windows'
        }, ensure_ascii=False), flush=True)
    except Exception:
        pass

    return found


def _get_process_name_light(hwnd) -> str:
    """Process name for a window handle — lighter than get_window_info."""
    try:
        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
        handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
        if handle:
            exe_name = ctypes.create_unicode_buffer(260)
            size = wintypes.DWORD(260)
            if kernel32.QueryFullProcessImageNameW(handle, 0, exe_name, ctypes.byref(size)):
                result = exe_name.value.split('\\')[-1]
                kernel32.CloseHandle(handle)
                return result
            kernel32.CloseHandle(handle)
    except Exception:
        pass
    return ''


def read_chat_list_via_uia(hwnd, source_name):
    """Use UIA to read the chat list from a specific window (not from root)."""
    if not HAS_UIA:
        return []

    messages = []

    def _read():
        # COM must be initialized per-thread before any UIA call.
        # Without this, uiautomation raises "CoInitialize has not been called."
        ctypes.windll.ole32.CoInitializeEx(0, 0)  # COINIT_APARTMENTTHREADED
        try:
            control = auto.ControlFromHandle(hwnd)
            if not control:
                return []

            # Recursively search for list-like controls
            def find_list_elements(ctrl, depth=0):
                if depth > 6:
                    return []
                results = []
                try:
                    ct = ctrl.ControlTypeName
                    cls = ctrl.ClassName or ''
                    # Match various list control types
                    if ct in ('ListControl', 'ListBox', 'List', 'DataGrid', 'Table') or \
                       'list' in cls.lower() or 'listbox' in cls.lower():
                        return [ctrl]
                    for child in ctrl.GetChildren():
                        results.extend(find_list_elements(child, depth + 1))
                except Exception as list_err:
                    print(f'[UIA] Error traversing children at depth {depth}: {list_err}', flush=True)
                return results

            lists = find_list_elements(control)
            for lst in lists:
                try:
                    items = lst.GetChildren()
                    for item in items:
                        try:
                            # Collect all text in this item
                            text_parts = []
                            for child in item.GetChildren():
                                try:
                                    if child.ControlTypeName == 'TextControl' and child.Name:
                                        text_parts.append(child.Name.strip())
                                    elif child.ControlTypeName in ('EditControl', 'ButtonControl'):
                                        if child.Name and child.Name.strip():
                                            text_parts.append(child.Name.strip())
                                except Exception as child_err:
                                    print(f'[UIA] Error reading child element: {child_err}', flush=True)
                                    continue

                            # Filter out empty and too-short entries
                            meaningful = [t for t in text_parts if len(t) > 1]
                            if len(meaningful) >= 2:
                                messages.append({
                                    'sender': meaningful[0],
                                    'content': ' '.join(meaningful[1:]),
                                    'captured_at': datetime.now().isoformat(),
                                })
                            elif len(meaningful) == 1 and len(meaningful[0]) > 3:
                                messages.append({
                                    'sender': '',
                                    'content': meaningful[0],
                                    'captured_at': datetime.now().isoformat(),
                                })
                        except Exception as item_err:
                            print(f'[UIA] Error reading list item: {item_err}', flush=True)
                            continue
                except Exception as list_err:
                    print(f'[UIA] Error reading list children: {list_err}', flush=True)
                    continue
        except Exception as e:
            listener_status['last_error'] = f'UIA read error: {e}'
            return []
        finally:
            ctypes.windll.ole32.CoUninitialize()
        return messages

    # Run with timeout to avoid hangs
    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(_read)
        try:
            return future.result(timeout=5.0)
        except FutureTimeout:
            listener_status['last_error'] = f'UIA timeout for hwnd={hwnd}'
            return []


def monitor_toast_notifications():
    """Monitor Windows toast notifications AND custom chat-app popups.

    Two detection strategies in a single EnumWindows pass:
    1. Windows native toast class names (UWP / WinUI notifications)
    2. Small popup windows owned by chat processes (WeChat / QQ custom popups)
    """
    known_toasts = set()
    toast_classes = [
        'Windows.UI.Core.CoreWindow',
        'ToastWindow',
        'NotificationWindow',
        'Microsoft.Windows.AppNotifications.ToastWindow',
        'ToastNotificationWindow',            # Win11 22H2+
        'WindowsPushNotification',             # older Win10
    ]

    captured_msgs = []

    def enum_toast(hwnd, lparam):
        if not user32.IsWindowVisible(hwnd):
            return True

        cls_buf = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(hwnd, cls_buf, 256)
        cls = cls_buf.value

        rect = wintypes.RECT()
        user32.GetWindowRect(hwnd, ctypes.byref(rect))
        w = rect.right - rect.left
        h = rect.bottom - rect.top

        # ── Strategy 1: Windows native toast by class name ──
        is_toast_class = any(tc.lower() in cls.lower() for tc in toast_classes)

        # ── Strategy 2: Chat-app custom popup by process + size ──
        # WeChat (Qt) / QQ custom notification popups are small topmost windows
        # that briefly appear in the bottom-right corner of the screen.
        is_chat_popup = False
        if not is_toast_class and 150 < w < 500 and 60 < h < 350:
            proc = _get_process_name_light(hwnd)
            if proc.lower() in _CHAT_PROCESSES:
                title_buf = ctypes.create_unicode_buffer(512)
                user32.GetWindowTextW(hwnd, title_buf, 512)
                text = title_buf.value
                # Any text longer than 1 char from a chat process in a
                # notification-sized window is likely a popup.
                # (Chinese names are often 2-3 chars, e.g. "张三")
                if text and len(text) > 1:
                    is_chat_popup = True

        if not (is_toast_class or is_chat_popup):
            return True

        # ── Read title text ──
        title_buf = ctypes.create_unicode_buffer(512)
        user32.GetWindowTextW(hwnd, title_buf, 512)
        text = title_buf.value
        if not text or text in known_toasts:
            return True

        # Filter out bare app names (not actual notification content)
        skip_texts = {'微信', 'WeChat', 'QQ', '通知', '通知中心', '操作中心',
                      'Action Center', 'Notification Center', '新消息'}
        if text.strip() in skip_texts:
            return True

        known_toasts.add(text)

        # Parse sender + content from multiline title text
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        if len(lines) >= 2:
            msg = {
                'sender': lines[0],
                'content': '\n'.join(lines[1:]),
                'captured_at': datetime.now().isoformat(),
                'source': 'notification',
            }
        elif len(text) < 80:
            # Single-line notification — treat whole text as content
            msg = {
                'sender': '',
                'content': text,
                'captured_at': datetime.now().isoformat(),
                'source': 'notification',
            }
        else:
            return True

        captured_msgs.append(msg)
        return True

    while running:
        try:
            captured_msgs.clear()
            user32.EnumWindows(WNDENUMPROC(enum_toast), 0)

            for msg in captured_msgs:
                captured_messages.append(msg)
                listener_status['messages_captured'] += 1
                if message_callback:
                    try:
                        message_callback(msg)
                    except Exception as e:
                        print(f'[Toast] Callback error: {e}', flush=True)

            if len(known_toasts) > 200:
                known_toasts = set(list(known_toasts)[-50:])

        except Exception as e:
            listener_status['last_error'] = f'Toast monitor error: {e}'

        time.sleep(1.0)


def is_user_idle(timeout_seconds: int = 30) -> bool:
    """检测用户是否空闲"""
    class LASTINPUTINFO(ctypes.Structure):
        _fields_ = [('cbSize', wintypes.UINT), ('dwTime', wintypes.DWORD)]

    lii = LASTINPUTINFO()
    lii.cbSize = ctypes.sizeof(LASTINPUTINFO)
    ctypes.windll.user32.GetLastInputInfo(ctypes.byref(lii))
    idle_ms = kernel32.GetTickCount() - lii.dwTime
    return idle_ms > (timeout_seconds * 1000)


def start_listener(callback=None):
    global running, message_callback
    running = True
    message_callback = callback
    listener_status['state'] = 'starting'

    if not HAS_UIA:
        listener_status['state'] = 'error'
        listener_status['last_error'] = 'uiautomation not installed'
        print('[UIA] uiautomation not installed, listener disabled', flush=True)
        # Even without UIA, toast notification monitoring still works
        # (it only uses Win32 APIs, not UIA)
        toast_thread = threading.Thread(target=monitor_toast_notifications, daemon=True)
        toast_thread.start()
        print('[UIA] Toast monitor started (UIA unavailable, Win32-only mode)', flush=True)
        return toast_thread

    def _listen():
        global running
        last_seen = set()
        listener_status['state'] = 'running'
        listener_status['messages_captured'] = 0

        # Status reporting interval
        last_status_time = time.time()

        while running:
            loop_start = time.time()

            # 1. Find chat windows via Win32 API (fast, no hang)
            windows = find_chat_windows()
            listener_status['windows_found'] = [
                f"{w['target']['name']}: {w['info']['title'][:40]}" for w in windows
            ]

            # 2. For each found window, read chat list via UIA
            for win_info in windows:
                if not running:
                    break
                hwnd = win_info['info']['hwnd']
                source = win_info['target']['name']

                try:
                    messages = read_chat_list_via_uia(hwnd, source)
                    for msg in messages:
                        msg['source'] = source
                        msg_id = f"{msg.get('sender', '')}|{msg.get('content', '')}"
                        if msg_id not in last_seen:
                            last_seen.add(msg_id)
                            captured_messages.append(msg)
                            listener_status['messages_captured'] += 1
                            if callback:
                                try:
                                    callback(msg)
                                except Exception as e:
                                    print(f'[UIA] Callback error: {e}', flush=True)

                    # Trim last_seen to prevent memory growth
                    if len(last_seen) > 500:
                        last_seen = set(list(last_seen)[-200:])
                except Exception as e:
                    listener_status['last_error'] = f'Error reading {source}: {e}'

            # 3. Report status periodically
            now = time.time()
            if now - last_status_time > 10:
                print(json.dumps({
                    'event': 'listener_status',
                    'data': {
                        'state': listener_status['state'],
                        'windows_found': len(windows),
                        'messages_captured': listener_status['messages_captured'],
                        'error': listener_status['last_error'],
                    }
                }), flush=True)
                last_status_time = now

            # 4. Sleep to maintain poll rate
            elapsed = time.time() - loop_start
            if elapsed < 0.5:
                time.sleep(0.5 - elapsed)

        listener_status['state'] = 'stopped'

    # Start main listener thread
    thread = threading.Thread(target=_listen, daemon=True)
    thread.start()

    # Start toast notification monitor as separate thread
    toast_thread = threading.Thread(target=monitor_toast_notifications, daemon=True)
    toast_thread.start()

    print('[UIA] Listener started (hybrid mode: UIA + toast/process-popup detection)', flush=True)
    return thread


def is_running() -> bool:
    """Check if the listener is currently running."""
    return running


def stop_listener():
    global running
    running = False
    listener_status['state'] = 'stopped'
    print('[UIA] Listener stopped', flush=True)
