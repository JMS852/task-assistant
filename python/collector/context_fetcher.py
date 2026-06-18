"""条件式上下文获取：在用户空闲时进入聊天窗口获取上下文"""
import time
import ctypes
from ctypes import wintypes

try:
    import uiautomation as auto
    HAS_UIA = True
except ImportError:
    HAS_UIA = False

MAX_CONTEXT_MESSAGES = 20


def _get_idle_seconds() -> float:
    class LASTINPUTINFO(ctypes.Structure):
        _fields_ = [('cbSize', wintypes.UINT), ('dwTime', wintypes.DWORD)]

    lii = LASTINPUTINFO()
    lii.cbSize = ctypes.sizeof(LASTINPUTINFO)
    ctypes.windll.user32.GetLastInputInfo(ctypes.byref(lii))
    return (ctypes.windll.kernel32.GetTickCount() - lii.dwTime) / 1000


def can_fetch_context(window) -> bool:
    """检查是否满足进入聊天窗口的条件"""
    if not HAS_UIA:
        return False
    if not window or not window.IsVisible:
        return False
    try:
        if window.IsMinimized:
            return False
    except Exception:
        pass
    return _get_idle_seconds() > 30


def fetch_context(window, chat_item_control, max_messages: int = MAX_CONTEXT_MESSAGES) -> list:
    """模拟双击进入聊天 → 读取最近消息 → 返回"""
    if not HAS_UIA:
        return []

    try:
        rect = chat_item_control.BoundingRectangle
        x = rect.left + (rect.right - rect.left) // 2
        y = rect.top + (rect.bottom - rect.top) // 2
        auto.Click(x, y)
        auto.DoubleClick(x, y)
        time.sleep(0.8)

        messages = []
        for child in window.GetChildren():
            if child.ControlTypeName in ('ListControl', 'ListBox', 'DocumentControl'):
                msg_items = child.GetChildren()
                recent = list(msg_items)[-max_messages:] if len(msg_items) > max_messages else msg_items
                for item in recent:
                    try:
                        text = item.Name or ''
                        for sub in item.GetChildren():
                            if sub.ControlTypeName == 'TextControl' and sub.Name:
                                text += ' ' + sub.Name
                        if text.strip():
                            messages.append(text.strip())
                    except Exception:
                        continue
                break

        auto.SendKeys('{Esc}')
        return messages

    except Exception as e:
        print(f'[ContextFetcher] Error: {e}', flush=True)
        try:
            auto.SendKeys('{Esc}')
        except Exception:
            pass
        return []
