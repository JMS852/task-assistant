"""OCR 兜底方案：对微信/QQ 窗口区域截图后 PaddleOCR 识别"""
import time
import os
from datetime import datetime

try:
    from PIL import ImageGrab
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

try:
    from paddleocr import PaddleOCR
    _ocr = PaddleOCR(lang='ch', use_angle_cls=True)
    OCR_AVAILABLE = True
except ImportError:
    _ocr = None
    OCR_AVAILABLE = False


def capture_and_recognize(region: tuple = None) -> list:
    """对指定屏幕区域截图并 OCR 识别。region: (left, top, right, bottom)，None 则全屏"""
    if not OCR_AVAILABLE or not HAS_PIL:
        return []

    img = ImageGrab.grab(bbox=region)
    img_path = f'ocr_temp_{int(time.time())}.png'
    img.save(img_path)

    try:
        results = _ocr.ocr(img_path, cls=True)
        messages = []
        if results and results[0]:
            for line in results[0]:
                text = line[1][0]
                confidence = line[1][1]
                if confidence > 0.7:
                    messages.append({
                        'content': text,
                        'confidence': confidence,
                        'captured_at': datetime.now().isoformat(),
                    })
        return messages
    finally:
        try:
            os.remove(img_path)
        except Exception:
            pass


def ocr_check_needed(last_capture_time: float, threshold: float = 90.0) -> bool:
    return (time.time() - last_capture_time) > threshold
