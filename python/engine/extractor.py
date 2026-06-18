import json
import re
from datetime import datetime

EXTRACTION_PROMPT = """从以下聊天任务消息中提取结构化信息。

消息：{content}
上下文：{context}

输出 JSON：
{{
  "title": "一句话任务标题",
  "description": "详细任务描述",
  "priority_hint": "high/medium/low",
  "deadline": "YYYY-MM-DD 或 null",
  "dependencies": ["依赖描述或 null"]
}}"""


def extract_task_info(content: str, context: list = None) -> dict:
    """从任务消息中提取结构化待办信息"""
    priority = 'medium'
    deadline = None

    urgent_words = ['马上', '紧急', '尽快', '今天', '立刻', 'urgent']
    low_words = ['不急', '下次', '以后', '有空']

    for w in urgent_words:
        if w in content:
            priority = 'high'
            break

    if priority == 'medium':
        for w in low_words:
            if w in content:
                priority = 'low'
                break

    date_patterns = [
        (r'(\d{4}-\d{2}-\d{2})', 1),
        (r'(今天)', lambda: datetime.now().strftime('%Y-%m-%d')),
        (r'(明天)', lambda: (datetime.now().replace(day=datetime.now().day + 1)).strftime('%Y-%m-%d')),
    ]
    for pattern, replacement in date_patterns:
        match = re.search(pattern, content)
        if match:
            if callable(replacement):
                deadline = replacement()
            else:
                deadline = match.group(replacement)
            break

    sentences = content.replace('！', '。').replace('!', '。').replace('?', '。').split('。')
    title = ''
    for s in sentences:
        s = s.strip()
        if len(s) > 4 and any(kw in s for kw in ['做', '写', '发', '处理', '联系', '改', '帮']):
            title = s
            break
    if not title:
        title = sentences[0].strip() if sentences else content[:50]

    try:
        from smart.ai_router import call_ai
        prompt = EXTRACTION_PROMPT.format(
            content=content,
            context=json.dumps(context or [], ensure_ascii=False)
        )
        ai_result = call_ai(prompt, provider='deepseek', temperature=0.1)
        extracted = json.loads(ai_result) if isinstance(ai_result, str) else ai_result
        title = extracted.get('title', title)
        if extracted.get('priority_hint'):
            priority = extracted['priority_hint']
        if extracted.get('deadline'):
            deadline = extracted['deadline']
    except Exception as e:
        print(f'[Extractor] AI extraction failed: {e}', flush=True)

    return {
        'title': title,
        'description': content,
        'priority': priority,
        'deadline': deadline,
        'extracted_at': datetime.now().isoformat(),
    }
