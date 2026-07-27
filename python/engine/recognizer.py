import json
from datetime import datetime

TASK_SIGNAL_PATTERNS = [
    # Strong task signals (high weight)
    ('帮我', 0.9), ('你做一下', 0.95), ('交给你', 0.9), ('你来负责', 0.9),
    ('麻烦你', 0.8), ('请帮忙', 0.85), ('帮忙', 0.6),
    # Action verbs
    ('做一下', 0.75), ('写一下', 0.75), ('处理', 0.7), ('跟进', 0.7),
    ('发邮件', 0.8), ('改代码', 0.85), ('写报告', 0.85), ('写文档', 0.8),
    ('整理', 0.7), ('联系', 0.65), ('查一下', 0.6), ('看一下', 0.5),
    ('安排', 0.7), ('确认', 0.5), ('提交', 0.7), ('完成', 0.5),
    ('修复', 0.75), ('更新', 0.55), ('部署', 0.7), ('发布', 0.6),
    ('约', 0.4), ('聚餐', 0.4), ('订位', 0.5), ('订', 0.35),
    # Time pressure hints
    ('今天', 0.4), ('明天', 0.4), ('尽快', 0.55), ('这周', 0.4),
    ('周五', 0.4), ('之前', 0.4), ('马上', 0.5), ('紧急', 0.6),
    ('下午', 0.3), ('晚上', 0.3), ('上午', 0.3),
    # Request words
    ('能不能', 0.5), ('有空吗', 0.5), ('麻烦', 0.55), ('拜托', 0.6),
    ('负责', 0.75), ('需要你', 0.7), ('你来', 0.6),
    # Task objects
    ('周报', 0.6), ('报告', 0.55), ('数据', 0.3), ('文档', 0.4),
    ('会议', 0.35), ('客户', 0.35), ('项目', 0.3),
    ('文件', 0.3), ('PPT', 0.5), ('ppt', 0.5), ('PDF', 0.4), ('pdf', 0.4),
    # General task indicators
    ('记得', 0.4), ('别忘了', 0.5), ('要记得', 0.5),
]


def heuristic_check(content: str) -> tuple[bool, float, list[str]]:
    """快速启发式检测，不消耗 API"""
    score = 0.0
    matched = []
    for pattern, weight in TASK_SIGNAL_PATTERNS:
        if pattern in content:
            score += weight
            matched.append(pattern)
    # Normalize - using 2.0 divisor instead of 3.0 for better sensitivity
    normalized = min(score / 2.0, 1.0)
    is_task = normalized > 0.25  # lowered from 0.3
    return is_task, normalized, matched


def ai_recognize(content: str, context: list | None = None) -> dict:
    """使用 AI 判断消息是否包含任务"""
    is_task, confidence, matched = heuristic_check(content)

    # High confidence → trust heuristic
    if confidence > 0.65:
        return {'is_task': is_task, 'confidence': confidence, 'rationale': f'heuristic (matched: {matched})'}

    # Very low confidence → skip AI call (below 0.05 means basically no signal)
    if confidence < 0.05:
        return {'is_task': False, 'confidence': confidence, 'rationale': f'heuristic (no match)'}

    # Borderline → use AI
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
        return {'is_task': is_task, 'confidence': confidence, 'rationale': f'heuristic (AI fallback, matched: {matched})'}


def recognize_task(data: dict) -> dict:
    """识别消息中的任务"""
    content = data.get('content', '')
    context = data.get('context', [])
    result = ai_recognize(content, context)
    result['message_id'] = data.get('id', '')
    result['processed_at'] = datetime.now().isoformat()
    return result
