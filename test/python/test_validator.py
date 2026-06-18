import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'python'))

from smart.validator import cross_validate, analyze_consensus


def test_cross_validate_passthrough():
    results = [
        {'provider': 'test1', 'content': '{}', 'success': True},
        {'provider': 'test2', 'content': '{}', 'success': False},
    ]
    validated = cross_validate(results, {})
    assert len(validated) == 2
    assert validated[0]['validated'] is True
    assert validated[1]['validated'] is False


def test_consensus_full():
    results = [
        {'provider': 'a', 'content': '{"confidence": "high"}'},
        {'provider': 'b', 'content': '{"confidence": "high"}'},
    ]
    consensus = analyze_consensus(results)
    assert consensus['consensus'] == 'full'


def test_consensus_partial():
    results = [
        {'provider': 'a', 'content': '{"confidence": "high"}'},
        {'provider': 'b', 'content': '{"confidence": "low"}'},
    ]
    consensus = analyze_consensus(results)
    assert consensus['consensus'] == 'partial'
