"""AI task enhancement — enriches a new task with context, subtasks, and suggestions."""
import json
from smart.ai_router import call_ai


def enhance_task(task: dict, all_tasks: list[dict]) -> dict:
    """Analyze a task and return enhancement suggestions."""
    existing_summary = json.dumps(
        [{'id': t.get('id'), 'title': t.get('title'), 'priority': t.get('priority'),
          'status': t.get('status'), 'sender': t.get('sender')}
         for t in all_tasks if t.get('id') != task.get('id')],
        ensure_ascii=False
    )[:3000]

    prompt = f"""你是一个任务管理助手。分析以下任务并给出建议。

任务标题：{task.get('title', '')}
任务描述：{task.get('description', '')}
发送者：{task.get('sender', '')}
群组：{task.get('group_name', '')}
优先级：{task.get('priority', 'medium')}
截止日期：{task.get('deadline', '无')}

已有任务列表（供参考）：
{existing_summary or '（无其他任务）'}

请返回 JSON（不要 markdown 代码块）：
{{
  "background": "这条任务可能的背景和上下文（1-2句中文）",
  "subtasks": ["子步骤1", "子步骤2"],
  "priority_suggestion": "high/medium/low",
  "priority_reason": "为什么建议这个优先级（1句话）",
  "related_task_ids": ["关联的已有任务ID，没有则为空数组"],
  "suggested_deadline": "建议的截止日期 YYYY-MM-DD 或 null",
  "notes": "其他需要注意的事项（1句话，没有则为空字符串）"
}}"""

    try:
        result = call_ai(prompt, provider='deepseek', temperature=0.3)
        text = result if isinstance(result, str) else result.get('content', '')
        if '```' in text:
            start = text.find('{')
            end = text.rfind('}')
            if start != -1 and end != -1:
                text = text[start:end+1]
        return json.loads(text)
    except Exception as e:
        print(f'[Enhancer] AI call failed: {e}', flush=True)
        return {
            'background': '',
            'subtasks': [],
            'priority_suggestion': task.get('priority', 'medium'),
            'priority_reason': '',
            'related_task_ids': [],
            'suggested_deadline': None,
            'notes': '',
            'error': str(e),
        }
