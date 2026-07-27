import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'python'))

from engine.recognizer import heuristic_check


def test_heuristic_strong_task():
    is_task, conf, matched = heuristic_check('帮我把这个报告改一下，明天之前要')
    assert is_task
    assert conf > 0.4


def test_heuristic_not_task():
    is_task, conf, matched = heuristic_check('好的我知道了谢谢')
    assert not is_task
    assert conf < 0.5


def test_heuristic_coding_task():
    is_task, conf, matched = heuristic_check('你帮我改一下代码，那个 bug 今天要修')
    assert is_task
    assert conf > 0.35


def test_heuristic_dinner_task():
    """Test that social-planning messages are recognized as tasks."""
    is_task, conf, matched = heuristic_check('约周末聚餐记得订位')
    # Should now match "约", "聚餐", "订位", "记得"
    assert is_task, f'Expected task, got is_task={is_task}, conf={conf}, matched={matched}'
    assert conf > 0.2


def test_heuristic_no_pattern_match():
    """Test that English text with no Chinese patterns returns clean result."""
    is_task, conf, matched = heuristic_check('hello world')
    assert not is_task
    assert conf == 0.0
    assert len(matched) == 0
