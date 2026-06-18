import time
import threading
import json
from datetime import datetime

try:
    import uiautomation as auto
    HAS_UIA = True
except ImportError:
    HAS_UIA = False

TARGETS = [
    {'process': 'WeChat.exe', 'name': 'wechat'},
    {'process': 'QQ.exe', 'name': 'qq'},
]

captured_messages = []
running = False
last_activity = 0


def find_chat_window(process_name: str):
    """查找微信/QQ 的主窗口"""
    if not HAS_UIA:
        return None, None
    for window in auto.GetRootControl().GetChildren():
        try:
            if window.ProcessName == process_name and window.IsWindow:
                for child in window.GetChildren():
                    if child.ControlTypeName == 'ListControl' or child.ClassName == 'ListBox':
                        return window, child
        except Exception:
            continue
    return None, None


def read_message_preview(list_control) -> list:
    """读取聊天列表中的消息预览"""
    messages = []
    try:
        items = list_control.GetChildren()
        for item in items:
            try:
                texts = []
                for child in item.GetChildren():
                    if child.ControlTypeName == 'TextControl':
                        texts.append(child.Name)
                if len(texts) >= 2:
                    messages.append({
                        'sender': texts[0] if texts else '',
                        'content': texts[-1] if len(texts) > 1 else '',
                        'captured_at': datetime.now().isoformat(),
                    })
            except Exception:
                continue
    except Exception as e:
        print(f'[UIA] Error reading list: {e}', flush=True)
    return messages


def is_user_idle(timeout_seconds: int = 30) -> bool:
    """检测用户是否空闲"""
    import ctypes
    from ctypes import wintypes

    class LASTINPUTINFO(ctypes.Structure):
        _fields_ = [('cbSize', wintypes.UINT), ('dwTime', wintypes.DWORD)]

    lii = LASTINPUTINFO()
    lii.cbSize = ctypes.sizeof(LASTINPUTINFO)
    ctypes.windll.user32.GetLastInputInfo(ctypes.byref(lii))
    idle_ms = ctypes.windll.kernel32.GetTickCount() - lii.dwTime
    return idle_ms > (timeout_seconds * 1000)


def is_window_active(window) -> bool:
    try:
        return window.IsVisible and not window.IsMinimized
    except Exception:
        return False


def start_listener(callback=None):
    global running
    running = True

    if not HAS_UIA:
        print('[UIA] uiautomation not installed, listener disabled', flush=True)
        return None

    def _listen():
        last_seen = set()
        while running:
            for target in TARGETS:
                try:
                    window, list_ctrl = find_chat_window(target['process'])
                    if not window or not list_ctrl:
                        continue
                    messages = read_message_preview(list_ctrl)
                    for msg in messages:
                        msg_id = f"{msg['sender']}|{msg['content']}"
                        if msg_id not in last_seen:
                            last_seen.add(msg_id)
                            msg['source'] = target['name']
                            captured_messages.append(msg)
                            if callback:
                                callback(msg)
                    if len(last_seen) > 200:
                        last_seen = set(list(last_seen)[-100:])
                except Exception as e:
                    print(f'[UIA] Error monitoring {target["name"]}: {e}', flush=True)
            time.sleep(0.5)

    thread = threading.Thread(target=_listen, daemon=True)
    thread.start()
    print('[UIA] Listener started', flush=True)
    return thread


def stop_listener():
    global running
    running = False
