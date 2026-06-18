import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'python'))

from engine.recognizer import heuristic_check


def test_heuristic_strong_task():
    is_task, conf = heuristic_check('帮我把这个报告改一下，明天之前要')
    assert is_task
    assert conf > 0.4


def test_heuristic_not_task():
    is_task, conf = heuristic_check('好的我知道了谢谢')
    assert not is_task
    assert conf < 0.5


def test_heuristic_coding_task():
    is_task, conf = heuristic_check('你帮我改一下代码，那个 bug 今天要修')
    assert is_task
    assert conf > 0.35
