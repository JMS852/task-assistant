"""Daily briefing — generates a morning summary of tasks with AI advice."""
import json
from datetime import datetime
from smart.ai_router import call_ai


def generate_briefing(tasks: list[dict], completed_tasks: list[dict]) -> dict:
    """Generate a daily briefing with stats and AI advice."""
    today = datetime.now().strftime('%Y-%m-%d')
    today_dt = datetime.now()

    pending = [t for t in tasks if t.get('status') != 'completed']
    high = [t for t in pending if t.get('priority') == 'high']
    due_today = [t for t in pending if t.get('deadline') == today]

    expiring = []
    for t in pending:
        dl = t.get('deadline')
        if dl:
            try:
                d = datetime.strptime(dl, '%Y-%m-%d')
                days_left = (d - today_dt).days
                if 0 <= days_left <= 3:
                    expiring.append({'title': t.get('title'), 'deadline': dl, 'days_left': days_left})
            except ValueError:
                pass

    recent_done = [
        {'title': t.get('title'), 'completed_at': t.get('updated_at', '')}
        for t in completed_tasks
    ][:5]

    advice = ''
    if pending:
        summary = json.dumps(
            [{'title': t.get('title'), 'priority': t.get('priority'), 'deadline': t.get('deadline')}
             for t in pending[:20]],
            ensure_ascii=False
        )[:3000]

        prompt = f"""你是任务管理助手。根据以下待办列表，给出今天优先处理哪 3 件事的建议（用中文，简洁）。

待办列表：
{summary}

今天日期：{today}

回答格式：直接给出建议，1-2 句话，不要 JSON。"""

        try:
            result = call_ai(prompt, provider='deepseek', temperature=0.3)
            advice = result if isinstance(result, str) else result.get('content', '')
        except Exception:
            advice = ''

    return {
        'date': today,
        'top_priorities': [
            {'title': t.get('title'), 'priority': t.get('priority'), 'deadline': t.get('deadline')}
            for t in high[:3]
        ] or [
            {'title': t.get('title'), 'priority': t.get('priority'), 'deadline': t.get('deadline')}
            for t in pending[:3]
        ],
        'recently_completed': recent_done,
        'expiring_soon': expiring[:5],
        'stats': {
            'pending': len(pending),
            'high': len(high),
            'due_today': len(due_today),
            'completed_recently': len(recent_done),
        },
        'ai_advice': advice.strip() if isinstance(advice, str) else str(advice).strip(),
    }
