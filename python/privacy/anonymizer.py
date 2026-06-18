import re

RULES = [
    (r'1[3-9]\d{9}', '[手机号]'),
    (r'[\w.-]+@[\w.-]+\.\w+', '[邮箱]'),
    (r'\d{6}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]', '[身份证]'),
    (r'(?:北京|上海|广州|深圳|杭州|成都|武汉|南京|西安|重庆|天津|苏州|长沙|郑州|东莞|青岛|沈阳|宁波|昆明|大连|厦门|合肥|佛山|福州|哈尔滨|济南|温州|长春|石家庄|常州|泉州|南宁|贵阳|南昌|太原|烟台|嘉兴|南通|金华|珠海|惠州|徐州|海口|乌鲁木齐|拉萨|呼和浩特|银川|西宁|兰州|中山|临沂|潍坊|威海|淄博|济宁|泰安|聊城|德州|滨州|菏泽|枣庄|日照)(?:市|县|区)', '[地区]'),
    (r'(?:有限公司|股份有限公司|有限责任公司|集团|公司)', '[公司名]'),
]

_custom_replacement = {}


def anonymize(text: str) -> str:
    """对文本进行脱敏处理，替换敏感信息为占位符"""
    result = text
    for pattern, replacement in RULES:
        result = re.sub(pattern, replacement, result)
    for pattern, replacement in _custom_replacement.items():
        result = re.sub(pattern, replacement, result)
    return result


def add_custom_rule(name: str, pattern: str):
    _custom_replacement[pattern] = f'[{name}]'


def remove_custom_rule(pattern: str):
    _custom_replacement.pop(pattern, None)


def get_rules() -> list:
    rules = [{'pattern': p, 'replacement': r} for p, r in RULES]
    rules += [{'pattern': p, 'replacement': r, 'custom': True} for p, r in _custom_replacement.items()]
    return rules
