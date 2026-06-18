import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'python'))

from engine.dedup import compute_similarity, deduplicate_tasks, compute_sort_score, sort_tasks


def test_similarity_same():
    assert compute_similarity('帮我改代码', '帮我改代码') > 0.9


def test_similarity_different():
    s = compute_similarity('帮我改代码', '今天天气真好我们去吃饭吧')
    assert s < 0.5


def test_dedup_merge():
    existing = [{'id': '1', 'title': '修改登录页代码', 'description': '修复登录模块的bug问题'}]
    action, matched_id = deduplicate_tasks(existing, {
        'title': '修改登录页代码', 'description': '修复登录模块的bug问题'
    })
    assert action == 'merge'


def test_sort_high_priority_first():
    tasks = [
        {'id': '1', 'priority': 'low', 'deadline': None, 'sort_order': None},
        {'id': '2', 'priority': 'high', 'deadline': '2026-06-19', 'sort_order': None},
    ]
    sorted_tasks = sort_tasks(tasks)
    assert sorted_tasks[0]['id'] == '2'
