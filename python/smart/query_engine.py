"""Natural language task query engine — converts questions to AI-powered answers."""
import json
import re
from smart.ai_router import call_ai


def answer_query(question: str, tasks: list[dict]) -> dict:
    """Answer a natural language question about tasks."""
    task_summaries = []
    for t in tasks:
        ts = {
            'id': t.get('id', '')[:8],
            'title': t.get('title', ''),
            'priority': t.get('priority', 'medium'),
            'status': t.get('status', 'pending'),
            'sender': t.get('sender', ''),
            'group': t.get('group_name', ''),
            'deadline': t.get('deadline', ''),
            'source': t.get('source', ''),
        }
        task_summaries.append(ts)

    prompt = f"""你是一个任务查询助手。用户会用自然语言问关于他们待办事项的问题。
根据以下任务列表回答问题。只回答和任务相关的问题。

任务列表（JSON）：
{json.dumps(task_summaries, ensure_ascii=False)}

用户问题：{question}

请返回一个 JSON 对象：
{{
  "answer": "用中文自然语言回答用户的问题",
  "relevant_task_ids": ["匹配的任务ID列表，用前8位匹配"],
  "suggestion": "如果有建议可以补充在这里，没有则为空字符串"
}}"""

    try:
        result = call_ai(prompt, provider='deepseek', temperature=0.2)
        text = result if isinstance(result, str) else ''
        if '```' in text:
            m = re.search(r'```(?:json)?\s*\n?(.*?)```', text, re.DOTALL)
            if m:
                text = m.group(1).strip()
            else:
                start = text.find('{')
                end = text.rfind('}')
                if start != -1 and end != -1:
                    text = text[start:end+1]
        parsed = json.loads(text)

        full_ids = []
        for tid in parsed.get('relevant_task_ids', []):
            for t in tasks:
                if t.get('id', '').startswith(tid):
                    full_ids.append(t.get('id'))
                    break

        return {
            'answer': parsed.get('answer', '抱歉，无法回答这个问题。'),
            'relevant_task_ids': full_ids,
            'suggestion': parsed.get('suggestion', ''),
        }
    except Exception as e:
        return {
            'answer': f'抱歉，查询出错了：{e}',
            'relevant_task_ids': [],
            'suggestion': '',
        }
