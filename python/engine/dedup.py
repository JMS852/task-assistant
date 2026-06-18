"""任务去重与排序"""
from datetime import datetime


def compute_similarity(text1: str, text2: str) -> float:
    """基于字符级 Jaccard 相似度的快速去重"""
    if not text1 or not text2:
        return 0.0
    set1 = set(text1)
    set2 = set(text2)
    intersection = set1 & set2
    union = set1 | set2
    if not union:
        return 0.0
    return len(intersection) / len(union)


def deduplicate_tasks(existing_tasks: list, new_task: dict) -> tuple:
    """返回 (action, matched_id)。action: 'merge', 'flag', 'create'"""
    new_text = new_task.get('title', '') + ' ' + new_task.get('description', '')
    best_score = 0.0
    best_id = None

    for existing in existing_tasks:
        existing_text = existing.get('title', '') + ' ' + existing.get('description', '')
        score = compute_similarity(new_text, existing_text)
        if score > best_score:
            best_score = score
            best_id = existing.get('id')

    if best_score > 0.85:
        return 'merge', best_id
    elif best_score > 0.5:
        return 'flag', best_id
    else:
        return 'create', None


def compute_sort_score(priority: str, deadline: str | None) -> float:
    """计算排序分数。公式：优先级权重 × 0.4 + 紧急度权重 × 0.4 + 0.2"""
    priority_weight = {'high': 3, 'medium': 2, 'low': 1}.get(priority, 2)

    if deadline:
        try:
            dt = datetime.fromisoformat(deadline)
            days_remaining = (dt - datetime.now()).days
            if days_remaining <= 0:
                urgency = 3
            elif days_remaining <= 1:
                urgency = 2.5
            elif days_remaining <= 3:
                urgency = 2
            elif days_remaining <= 7:
                urgency = 1
            else:
                urgency = 0.5
        except Exception:
            urgency = 0.5
    else:
        urgency = 0.5

    return priority_weight * 0.4 + urgency * 0.4 + 0.2


def sort_tasks(tasks: list) -> list:
    """按优先级 + 紧急度排序，手动锁定的保持原位"""
    locked = [t for t in tasks if t.get('sort_order') is not None]
    unlocked = [t for t in tasks if t.get('sort_order') is None]

    for t in unlocked:
        t['_sort_score'] = compute_sort_score(
            t.get('priority', 'medium'),
            t.get('deadline'),
        )

    unlocked.sort(key=lambda t: t['_sort_score'], reverse=True)

    for t in unlocked:
        t.pop('_sort_score', None)

    result = list(unlocked)
    for locked_item in sorted(locked, key=lambda t: t['sort_order'] or 0):
        pos = min(int(locked_item['sort_order'] or 0), len(result))
        result.insert(pos, locked_item)

    return result
