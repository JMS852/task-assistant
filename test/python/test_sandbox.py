import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'python'))

from smart.sandbox import run_in_sandbox


def test_simple_python_execution():
    code = 'print("hello world")'
    result = run_in_sandbox(code)
    assert 'success' in result


def test_code_with_error():
    code = 'raise ValueError("test error")'
    result = run_in_sandbox(code)
    assert not result.get('success', True) or result.get('exit_code', 0) != 0
