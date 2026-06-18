import json
from datetime import datetime

TASK_SIGNAL_PATTERNS = [
    ('帮我', 0.8), ('你做一下', 0.9), ('交给你', 0.85), ('负责', 0.7),
    ('有空吗', 0.5), ('能不能', 0.4), ('麻烦', 0.5),
    ('今天', 0.3), ('明天', 0.3), ('尽快', 0.4), ('之前', 0.3), ('周五', 0.3),
    ('发邮件', 0.7), ('改代码', 0.8), ('写报告', 0.8), ('联系', 0.6),
    ('做一下', 0.7), ('处理', 0.6), ('跟进', 0.6), ('查一下', 0.5),
]


def heuristic_check(content: str) -> tuple:
    """快速启发式检测，不消耗 API"""
    score = 0.0
    for pattern, weight in TASK_SIGNAL_PATTERNS:
        if pattern in content:
            score += weight
    normalized = min(score / 3.0, 1.0)
    is_task = normalized > 0.3
    return is_task, normalized


def ai_recognize(content: str, context: list = None) -> dict:
    """使用 AI 判断消息是否包含任务"""
    is_task, confidence = heuristic_check(content)

    if confidence > 0.7 or confidence < 0.2:
        return {'is_task': is_task, 'confidence': confidence, 'rationale': 'heuristic'}

    try:
        from smart.ai_router import call_ai
        prompt = f"""判断以下聊天消息是否包含需要执行的任务。

消息：{content}
上下文：{json.dumps(context or [], ensure_ascii=False)}

标准：包含明确指派、截止时间、或具体行为要求。
输出 JSON：{{"is_task": true/false, "confidence": 0-1, "rationale": "理由"}}"""

        result = call_ai(prompt, provider='deepseek', temperature=0.1)
        return json.loads(result) if isinstance(result, str) else result
    except Exception as e:
        print(f'[Recognizer] AI call failed, using heuristic: {e}', flush=True)
        return {'is_task': is_task, 'confidence': confidence, 'rationale': 'heuristic (fallback)'}


def recognize_task(data: dict) -> dict:
    """识别消息中的任务"""
    content = data.get('content', '')
    context = data.get('context', [])
    result = ai_recognize(content, context)
    result['message_id'] = data.get('id', '')
    result['processed_at'] = datetime.now().isoformat()
    return result
