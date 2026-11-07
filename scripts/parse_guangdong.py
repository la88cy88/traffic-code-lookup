# -*- coding: utf-8 -*-
"""
把《广东省道路交通安全违法行为代码及处罚标准（2022年版）》公示文件解析为网页数据。

数据来源（政府公开）：
  肇庆市公安局高要分局《省道路交通安全违法行为代码及处罚标准（2022年版）》
  https://www.gaoyao.gov.cn/zqgygaj/gkmlpt/content/2/2792/mpost_2792942.html
  附件：https://www.gaoyao.gov.cn/zqgygaj/attachment/0/300/300856/2792942.doc

复现步骤（macOS）：
  curl -L -o /tmp/gd.doc 'https://www.gaoyao.gov.cn/zqgygaj/attachment/0/300/300856/2792942.doc'
  textutil -convert txt -output /tmp/gd.txt /tmp/gd.doc
  python3 scripts/parse_guangdong.py /tmp/gd.txt data/

注意：本脚本只做格式转换，不校验法条是否现行有效。页面统一标注「参考信息 · 自行核查」。
"""
import json
import os
import re
import sys

SECTION_MARKS = [
    ('非机动车驾驶人、乘车人、行人违法行为代码及处罚标准', '非机动车/行人'),
    ('（简易程序处罚）', '机动车·简易程序'),
    ('（一般程序处罚）', '机动车·一般程序'),
    ('行政强制措施凭证的违法行为代码及强制措施类型', '行政强制措施'),
]
HEADERS = {'代码', '违法行为', '违法条款', '处罚依据', '记分分值', '罚款标准',
           '执行标准', '强制措施类型', '违法依据', '强制依据', '备注', '序号'}
CODE_RE = re.compile(r'^\d{4}[A-C]?$|^\d{5}$')
POINTS_RE = re.compile(r'^(0|1|3|6|9|12)$')
# 处罚/措施字段一般以这些词开头；避免把「机动车驾驶证被扣留期间仍驾驶机动车的」误判成处罚
PENALTY_HEAD = re.compile(r'^(罚款|处|吊销|警告|扣留|收缴|拘留|终生|注销|停止|强制|可以并处|并处)')
CATEGORY = {
    '1': '机动车通行', '6': '机动车通行', '2': '非机动车通行',
    '3': '行人/乘车人', '4': '高速公路', '5': '其他规定', '7': '广东省地方规定',
}

# 常用口语俗称 / 同义说法（人工整理，仅用于检索，不改变原始表述）
ALIASES = {
    '1119': ['摩托车不戴头盔', '不戴头盔', '头盔', '一盔一带'],
    '1120': ['不系安全带', '驾驶人未系安全带', '安全带'],
    '7012': ['后排不系安全带', '后排安全带', '乘客不系安全带', '乘坐人员未系安全带'],
    '1126': ['货车超载', '货物超载', '超载未达30%'],
    '1366': ['货车超载30%-50%', '货物超载', '超载'],
    '1367': ['货车违规载客', '货车载人'],
    '1621': ['客车超员', '超员', '超载人员', '超载客车'],
    '1623': ['校车超员', '超员'],
    '1012': ['非法安装标志灯具', '警灯'],
    '1007': ['把车借给无证的人', '无证驾驶'],
    '1625': ['闯红灯', '不按信号灯通行'],
    '1301': ['逆行', '逆向行驶'],
    '1117': ['压线', '违反禁止标线'],
    '1344': ['违反禁令标志'],
    '1039': ['违停', '乱停车'],
    '1223': ['开车打电话', '手持电话'],
    '1712': ['饮酒后驾驶', '酒驾'],
    '6032': ['醉酒驾驶', '醉驾'],
    '1902': ['无证驾驶', '未取得驾驶证'],
    '1357': ['不礼让行人', '斑马线不让人'],
    '1111': ['货车超长超宽超高', '货物超限'],
    '6011': ['旧版安全带代码'],
    '1207': ['旧版头盔代码'],
}
SYNONYMS = {
    '超员': ['超过核定人数', '载人超过', '超员'],
    '超载人员': ['超过核定人数', '载人超过'],
    '货物超载': ['载物超过最大允许总质量', '超过核定载质量', '超载'],
    '超载': ['载物超过最大允许总质量', '超过核定载质量', '超过核定人数', '超载'],
    '运沙石': ['沙石', '散装', '遗洒', '飘散', '载物', '密闭'],
    '沙石': ['沙石', '散装', '遗洒', '飘散', '载物'],
    '摩托车未戴头盔': ['头盔', '安全头盔'],
    '头盔': ['头盔'],
    '后排未系安全带': ['乘坐人员', '安全带'],
    '后排安全带': ['乘坐人员', '安全带'],
    '安全带': ['安全带'],
    '闯红灯': ['交通信号灯', '红灯'],
    '酒驾': ['饮酒后驾驶', '醉酒'],
    '醉驾': ['醉酒'],
    '无证': ['未取得驾驶证', '未取得机动车驾驶证'],
    '无证驾驶': ['未取得驾驶证', '未取得机动车驾驶证'],
    '违停': ['停放', '临时停车'],
    '超速': ['超过规定时速'],
    '压线': ['禁止标线', '禁令标志'],
    '逆行': ['逆向行驶'],
    '打电话': ['拨打', '手持电话'],
    '不礼让行人': ['人行横道', '避让行人'],
    '疲劳驾驶': ['连续驾驶', '停车休息'],
    '疲劳': ['连续驾驶', '停车休息'],
    '遮挡号牌': ['遮挡', '号牌'],
    '逃逸': ['逃逸'],
}


def parse(text_path):
    tokens = []
    for line in open(text_path, encoding='utf-8').read().splitlines():
        for t in line.split('\x07'):
            t = t.strip().replace('\u3000', ' ')
            if t:
                tokens.append(t)

    section = '机动车'
    records = []
    i = 0
    while i < len(tokens):
        t = tokens[i]
        for mark, name in SECTION_MARKS:
            if mark in t and len(t) < 80:
                section = name
        if not CODE_RE.fullmatch(t) or POINTS_RE.fullmatch(t):
            i += 1
            continue
        j = i + 1
        fields = []
        while j < len(tokens) and not CODE_RE.fullmatch(tokens[j]):
            nt = tokens[j]
            if any(m in nt and len(nt) < 80 for m, _ in SECTION_MARKS):
                break
            if nt not in HEADERS:
                fields.append(nt)
            j += 1

        rec = {'code': t, 'section': section,
               'category': CATEGORY.get(t[0], '其他规定'),
               'behavior': '', 'violation': '', 'basis': '',
               'points': None, 'penalty': '', 'measures': '',
               'alias': ALIASES.get(t, []), 'extra': []}
        legal, rest = [], []
        for f in fields:
            if POINTS_RE.fullmatch(f) and rec['points'] is None:
                rec['points'] = int(f)
            elif f.startswith('《') or ('《' in f and not rec['behavior']):
                legal.append(f)
            else:
                rest.append(f)
        # 先取行为，再取处罚
        for f in rest:
            if PENALTY_HEAD.match(f) and not rec['behavior'].startswith('机动车驾驶证'):
                if not rec['penalty']:
                    rec['penalty'] = f
                elif not rec['measures']:
                    rec['measures'] = f
                else:
                    rec['extra'].append(f)
            elif not rec['behavior']:
                rec['behavior'] = f
            elif not rec['measures']:
                rec['measures'] = f
            else:
                rec['extra'].append(f)
        if len(legal) >= 1:
            rec['violation'] = legal[0]
        if len(legal) >= 2:
            rec['basis'] = legal[1]
        if len(legal) > 2:
            rec['extra'] = legal[2:] + rec['extra']
        if rec['behavior'] and len(rec['behavior']) > 1:
            records.append(rec)
        i = j

    seen = {}
    for r in records:
        old = seen.get(r['code'])
        if old is None or len(r['behavior']) > len(old['behavior']):
            seen[r['code']] = r
    return sorted(seen.values(), key=lambda r: r['code'])


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    src = sys.argv[1]
    out_dir = sys.argv[2] if len(sys.argv) > 2 else 'data'
    os.makedirs(out_dir, exist_ok=True)
    rows = parse(src)
    meta = {
        'source': '广东省道路交通安全违法行为代码及处罚标准（2022年版）',
        'publisher': '肇庆市公安局高要分局（政府公示）',
        'sourceUrl': 'https://www.gaoyao.gov.cn/zqgygaj/gkmlpt/content/2/2792/mpost_2792942.html',
        'version': '2022年版（公示文本）',
        'note': '参考信息，需自行核查现行版本与本地处罚标准',
        'count': len(rows),
        'synonyms': SYNONYMS,
    }
    payload = {'meta': meta, 'codes': rows}
    with open(os.path.join(out_dir, 'codes.json'), 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)
    with open(os.path.join(out_dir, 'codes.js'), 'w', encoding='utf-8') as f:
        f.write('/* 自动生成，请勿手工编辑；见 scripts/parse_guangdong.py */\n')
        f.write('window.CODE_DATA = ' + json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print('生成', len(rows), '条 ->', out_dir)
    print('字段完整率：行为', sum(1 for r in rows if r['behavior']),
          '/ 违法条款', sum(1 for r in rows if r['violation']),
          '/ 处罚依据', sum(1 for r in rows if r['basis']),
          '/ 罚款或措施', sum(1 for r in rows if r['penalty']))
    for c in ['1119', '1120', '7012', '1126', '1621']:
        m = next((r for r in rows if r['code'] == c), None)
        print(' ', c, m['behavior'] if m else 'MISSING', '|', m['penalty'] if m else '')


if __name__ == '__main__':
    main()
