import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'python'))

from privacy.anonymizer import anonymize


def test_phone_anonymized():
    result = anonymize('打我电话 13812345678')
    assert '13812345678' not in result
    assert '[手机号]' in result


def test_email_anonymized():
    result = anonymize('发到 test@example.com')
    assert 'test@example.com' not in result
    assert '[邮箱]' in result


def test_normal_text_preserved():
    text = '帮我把报告改一下'
    result = anonymize(text)
    assert result == text
