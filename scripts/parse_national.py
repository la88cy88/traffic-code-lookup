# -*- coding: utf-8 -*-
"""把《道路交通安全违法行为代码及处罚标准（2022）》全国通用表解析为网页数据。

数据来源（政府公开）：
  江永县公安局《道路交通安全违法行为代码及处罚标准（2022）》
  http://admin.yzcity.gov.cn:8888/jygaj/0300/202203/0a731835d3344d45ac944fce28ef36e2.shtml

复现步骤（macOS）：
  curl -sL -o /tmp/national2022.html 'http://admin.yzcity.gov.cn:8888/jygaj/0300/202203/0a731835d3344d45ac944fce28ef36e2.shtml'
  python3 scripts/parse_national.py /tmp/national2022.html data/national.json

说明：
  - 只保留 1-6 字头的全国统一编号；7 字头「本省地方代码」章节全部剔除。
  - 公示文本由湖南公安机关发布，个别条目的处罚依据引用当地实施办法，
    用 localRef 标记；罚款金额仅代表公示地标准，页面统一标注「自行核查」。
  - 本脚本只做格式转换，不校验法条是否现行有效。
"""
import html
import json
import os
import re
import sys

CODE_RE = re.compile(r'^\d{5}$')
SECTION_RULES = [
    ('本省地方代码', '地方代码（公示地）'),
    ('非机动车', '非机动车通行'),
    ('行人和乘车人', '行人和乘车人通行'),
    ('高速公路', '高速公路特别规定'),
    ('其他规定', '其他规定'),
    ('机动车通行', '机动车通行'),
]
CATEGORY = {
    '1': '机动车通行', '6': '机动车通行', '2': '非机动车通行',
    '3': '行人/乘车人', '4': '高速公路', '5': '其他规定', '7': '广东省地方规定',
}


def cells(tr):
    out = []
    for c in re.findall(r'<t[dh][^>]*>([\s\S]*?)</t[dh]>', tr, flags=re.I):
        t = html.unescape(re.sub(r'<[^>]+>', '', c))
        out.append(t.replace('\u00a0', ' ').replace('\u3000', ' ').strip())
    return out


def parse(path):
    s = open(path, encoding='utf-8', errors='ignore').read()
    s = re.sub(r'<script[\s\S]*?</script>|<style[\s\S]*?</style>', '', s, flags=re.I)
    rows = [cells(t) for t in re.findall(r'<tr[^>]*>([\s\S]*?)</tr>', s, flags=re.I)]

    section = '机动车通行'
    out = []
    for r in rows:
        if not r:
            continue
        if not CODE_RE.fullmatch(r[0]):
            title = re.sub(r'\s+', '', ''.join(r))
            for kw, name in SECTION_RULES:
                if kw in title:
                    section = name
                    break
            continue
        code = r[0]
        # 7 字头是公示地（湖南）地方代码，不属于全国通用编号
        if code.startswith('7') or section == '地方代码（公示地）':
            continue
        cells8 = (r + [''] * 11)[:8]
        behavior = cells8[1].strip()
        if not behavior:
            continue
        points = cells8[5].strip()
        out.append({
            'code': code,
            'section': section,
            'category': CATEGORY.get(code[0], '其他规定'),
            'behavior': behavior,
            'violation': cells8[2].strip(),
            'basis': cells8[3].strip(),
            'measures': cells8[4].strip(),
            'points': int(points) if points.isdigit() else None,
            'penalty': cells8[6].strip(),
            'note': cells8[7].strip(),
            'localRef': any('湖南省' in x for x in cells8),
            'alias': [],
            'source': 'CN',
        })
    seen = {}
    for r in out:
        if r['code'] not in seen or len(r['behavior']) > len(seen[r['code']]['behavior']):
            seen[r['code']] = r
    return sorted(seen.values(), key=lambda r: r['code'])


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    src = sys.argv[1]
    dst = sys.argv[2] if len(sys.argv) > 2 else 'data/national.json'
    rows = parse(src)
    os.makedirs(os.path.dirname(dst) or '.', exist_ok=True)
    meta = {
        'source': '道路交通安全违法行为代码及处罚标准（2022）· 全国通用编号',
        'publisher': '江永县公安局（政府公示转载，公安部统一代码）',
        'sourceUrl': 'http://admin.yzcity.gov.cn:8888/jygaj/0300/202203/0a731835d3344d45ac944fce28ef36e2.shtml',
        'version': '2022 年版（公示文本）',
        'count': len(rows),
    }
    with open(dst, 'w', encoding='utf-8') as f:
        json.dump({'meta': meta, 'codes': rows}, f, ensure_ascii=False, indent=1)
    print('生成全国通用', len(rows), '条 ->', dst)
    print('含地方实施办法引用', sum(1 for r in rows if r['localRef']), '条')
    for kw in ['头盔', '安全带', '超过核定人数', '最大允许总质量', '交通信号灯', '手持电话', '遗洒']:
        hit = [r for r in rows if kw in r['behavior']]
        print(' ', kw, len(hit), '例：', (hit[0]['code'] + ' ' + hit[0]['behavior'][:30]) if hit else 'MISSING')


if __name__ == '__main__':
    main()
