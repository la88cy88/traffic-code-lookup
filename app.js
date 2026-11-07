/* 违法代码速查 · 广东（参考信息，需自行核查）
 * 纯静态、零依赖。数据结构参照 ZG122 公开查询结果字段。
 */
(function () {
  'use strict';

  var DATA = window.CODE_DATA;
  if (!DATA || !DATA.codes || !DATA.codes.length) {
    document.getElementById('app').innerHTML =
      '<div class="card">数据文件未加载。请点右上角「↻ 刷新」重试；离线使用时需先联网打开一次。</div>';
    return;
  }
  var CODES = DATA.codes;
  var META = DATA.meta || {};
  var SYNONYMS = META.synonyms || {};
  var app = document.getElementById('app');
  var toastEl = document.getElementById('toast');

  var QUICK = [
    { label: '超载人员', q: '超员' },
    { label: '货物超载', q: '货物超载' },
    { label: '运沙石', q: '运沙石' },
    { label: '摩托车未戴头盔', q: '头盔' },
    { label: '后排未系安全带', q: '后排安全带' },
    { label: '闯红灯', q: '闯红灯' },
    { label: '酒驾', q: '酒驾' },
    { label: '无证驾驶', q: '无证驾驶' },
    { label: '违停', q: '违停' },
    { label: '超速', q: '超速' },
  ];
  var HOT = ['1119', '1120', '7012', '1126', '1366', '1621', '1625', '1301', '1039', '1007', '6014', '1120'];
  var CASE_TIPS = {
    '超员': '先查明核载人数、实载人数、车辆类型与营运性质。不同车型、不同超员比例对应不同代码与记分，不能仅凭「多载了人」直接选定代码；请自行核查现行分档。',
    '货物超载': '以称重凭证认定是否超过最大允许总质量及比例档；超载、超限、违规载客分别适用不同条款。请自行核查广东现行分档与代码。',
    '运沙石': '运沙石本身不是违法。需分别核实：是否超载/超限、载物长宽高、是否遗洒飘散、是否密闭运输。未密闭运输多由城管或生态环境部门依《广东省大气污染防治条例》处理，不使用交警违法代码。',
    '头盔': '区分摩托车驾驶人与乘坐人、摩托车与电动自行车；不同对象与地方法规适用条款可能不同，请自行核查。',
    '后排安全带': '广东实务多以 7012 对驾驶人处罚（乘坐人员未按规定使用安全带时驾驶）。是否对乘坐人另行处理、当前是否仍适用，请自行核查本地现行做法。',
    '闯红灯': '注意区分「不按交通信号灯指示通行」与其他信号灯相关行为，具体适用以现场事实与本地系统为准。',
  };
  var POINT_FILTERS = [
    { v: 'all', t: '全部' }, { v: '0', t: '不记分' }, { v: '1', t: '1 分' },
    { v: '3', t: '3 分' }, { v: '6', t: '6 分' }, { v: '9', t: '9 分' }, { v: '12', t: '12 分' },
  ];
  var CAT_FILTERS = [
    { v: 'all', t: '全部类别' }, { v: '机动车通行', t: '机动车' },
    { v: '非机动车通行', t: '非机动车' }, { v: '行人/乘车人', t: '行人/乘车人' },
    { v: '高速公路', t: '高速公路' }, { v: '其他规定', t: '其他规定' },
    { v: '广东省地方规定', t: '广东省地方' },
  ];
  var LAW_NAMES = [
    ['《法》', '《中华人民共和国道路交通安全法》'],
    ['《条例》', '《中华人民共和国道路交通安全法实施条例》'],
    ['《省条例》', '《广东省道路交通安全条例》'],
    ['《记分管理办法》', '《道路交通安全违法行为记分管理办法》（公安部令第 163 号，2022-04-01 施行）'],
    ['《机动车登记规定》', '公安部令第 164 号'],
    ['《机动车驾驶证申领和使用规定》', '公安部令第 162 号'],
  ];

  var state = { q: '', points: 'all', category: 'all' };
  var LS_HISTORY = 'tc_history_v1';
  var LS_FAVS = 'tc_favs_v1';
  var BUILD_LABEL = '2026-11-08 v2 · 多入口';
  var CN_ENTRY = 'https://police-intake-guide.app.workbuddy.host/code/?sharecode=HZ743KIQEU';
  var GITHUB_PAGES = 'https://la88cy88.github.io/traffic-code-lookup/';
  var GITHUB_REPO = 'https://github.com/la88cy88/traffic-code-lookup';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function readLS(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  }
  function writeLS(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
  function normalize(s) { return String(s || '').toLowerCase().replace(/[\s，,、。．.；;：:（）()]/g, ''); }
  function byCode(code) {
    for (var i = 0; i < CODES.length; i++) if (CODES[i].code === code) return CODES[i];
    return null;
  }
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toastEl.classList.remove('show'); }, 1900);
  }
  function fallbackCopy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast('链接已复制，可粘贴发给同事'); },
        function () { toast('复制失败，请长按地址栏复制'); });
      return;
    }
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      toast(ok ? '链接已复制' : '请长按地址栏复制');
    } catch (e) { toast('请长按地址栏复制'); }
  }
  function addHistory(q) {
    q = String(q || '').trim();
    if (!q) return;
    var h = readLS(LS_HISTORY, []).filter(function (x) { return x !== q; });
    h.unshift(q);
    writeLS(LS_HISTORY, h.slice(0, 8));
  }
  function favs() { return readLS(LS_FAVS, []); }
  function isFav(code) { return favs().indexOf(code) >= 0; }
  function toggleFav(code) {
    var f = favs(), i = f.indexOf(code);
    if (i >= 0) { f.splice(i, 1); toast('已取消收藏'); }
    else { f.unshift(code); toast('已收藏 ' + code); }
    writeLS(LS_FAVS, f);
  }

  /* ---------- 搜索 ---------- */
  function score(rec, q) {
    var qn = normalize(q);
    if (!qn) return 0;
    var code = normalize(rec.code);
    var beh = normalize(rec.behavior);
    var alias = normalize((rec.alias || []).join(''));
    var legal = normalize([rec.violation, rec.basis, rec.penalty, rec.measures].join(''));
    var s = 0;
    if (code === qn) s += 200;
    else if (code.indexOf(qn) === 0) s += 120;
    else if (code.indexOf(qn) >= 0) s += 40;
    if (beh.indexOf(qn) >= 0) s += 60;
    if (alias.indexOf(qn) >= 0) s += 50;
    if (legal.indexOf(qn) >= 0) s += 10;
    var syn = SYNONYMS[q] || SYNONYMS[normalize(q)] || [];
    for (var i = 0; i < syn.length; i++) {
      var sn = normalize(syn[i]);
      if (!sn) continue;
      if (beh.indexOf(sn) >= 0) s += 45;
      else if (alias.indexOf(sn) >= 0) s += 35;
      else if (legal.indexOf(sn) >= 0) s += 8;
    }
    return s;
  }
  function filtered(recs) {
    return recs.filter(function (r) {
      if (state.points !== 'all') {
        if (state.points === '0' && r.points !== 0) return false;
        if (state.points !== '0' && r.points !== Number(state.points)) return false;
      }
      if (state.category !== 'all' && r.category !== state.category) return false;
      return true;
    });
  }
  function search(q) {
    var hits = [];
    for (var i = 0; i < CODES.length; i++) {
      var s = score(CODES[i], q);
      if (s > 0) hits.push({ r: CODES[i], s: s });
    }
    hits.sort(function (a, b) { return b.s - a.s || a.r.code.localeCompare(b.r.code); });
    return filtered(hits.map(function (h) { return h.r; }));
  }
  function hotList() {
    var out = [], seen = {};
    HOT.forEach(function (c) {
      var r = byCode(c);
      if (r && !seen[c]) { out.push(r); seen[c] = 1; }
    });
    return out;
  }

  /* ---------- 渲染片段 ---------- */
  function warnHtml() {
    return '<div class="warn">' +
      '<div class="warn-title"><span class="warn-icon">!</span><span>参考信息 · 需自行核查</span></div>' +
      '数据整理自政府公开的<strong>广东省 2022 年版</strong>代码表，可能不是现行版本；各地罚款幅度、地方代码与分档会调整。' +
      '本页<strong>不提供可直接录入的代码结论</strong>，不作为行政处罚决定、案件定性或管辖依据。' +
      '</div>';
  }
  function filterHtml() {
    var p = POINT_FILTERS.map(function (f) {
      return '<button type="button" class="chip ' + (state.points === f.v ? 'on' : '') +
        '" data-act="point" data-v="' + esc(f.v) + '">' + esc(f.t) + '</button>';
    }).join('');
    var c = CAT_FILTERS.map(function (f) {
      return '<button type="button" class="chip ' + (state.category === f.v ? 'on' : '') +
        '" data-act="cat" data-v="' + esc(f.v) + '">' + esc(f.t) + '</button>';
    }).join('');
    return '<div class="section-label">按记分筛选</div><div class="chip-row">' + p + '</div>' +
      '<div class="section-label">按代码类别筛选</div><div class="chip-row">' + c + '</div>';
  }
  function itemHtml(r) {
    var pt = r.points == null ? '未标注' : (r.points === 0 ? '不记分' : r.points + ' 分');
    var alias = (r.alias && r.alias.length) ? '<span class="item-alias">俗称：' + esc(r.alias.slice(0, 2).join('、')) + '</span>' : '';
    return '<button type="button" class="item" data-act="open" data-code="' + esc(r.code) + '">' +
      '<div class="item-head"><span class="code-badge">' + esc(r.code) + '</span>' +
      '<span class="point-badge ' + (r.points > 0 ? 'has' : '') + '">' + esc(pt) + '</span>' +
      (isFav(r.code) ? '<span class="point-badge">★ 已收藏</span>' : '') + '</div>' +
      '<div class="item-behavior">' + esc(r.behavior) + '</div>' +
      '<div class="item-meta">' + (r.penalty ? '<span>' + esc(r.penalty) + '</span>' : '') +
      '<span>' + esc(r.category) + '</span>' + alias + '</div></button>';
  }
  function quickHtml() {
    return QUICK.map(function (x) {
      return '<button type="button" class="chip" data-act="quick" data-q="' + esc(x.q) + '">' + esc(x.label) + '</button>';
    }).join('');
  }
  function resultsHtml() {
    var q = state.q.trim();
    var tip = CASE_TIPS[q] ? '<div class="tip-box"><b>情形提示 · ' + esc(q) + '</b><br>' + esc(CASE_TIPS[q]) + '</div>' : '';
    if (!q) {
      var h = readLS(LS_HISTORY, []);
      var hist = h.length ? '<div class="section-label">最近搜索 <button type="button" class="chip gray" data-act="clear-history">清除</button></div><div class="chips">' +
        h.map(function (x) { return '<button type="button" class="chip" data-act="quick" data-q="' + esc(x) + '">' + esc(x) + '</button>'; }).join('') + '</div>' : '';
      return warnHtml() + '<div class="card"><div class="card-title">常用 / 重点代码</div>' +
        '<div class="mini-note">下面是按民警常见情形挑的入口，点任意一条看完整字段。</div></div>' +
        hotList().map(itemHtml).join('') + hist;
    }
    var recs = search(q);
    var head = '<div class="results-head"><span class="results-count">' +
      (recs.length ? '找到 ' + recs.length + ' 条' : '没有找到对应条目') + '</span>' +
      '<span class="results-hint">' + (state.points !== 'all' || state.category !== 'all' ? '已应用筛选' : '按相关度排序') + '</span></div>';
    if (!recs.length) {
      return warnHtml() + tip + head +
        '<div class="empty"><b>没有找到与该关键词或代码直接对应的条目。</b><br>' +
        '这不等于「不违法」或「没有对应代码」。请换用更具体的说法，' +
        '或按页面底部渠道<b>自行核查</b>。</div>' +
        '<div class="mini-note">提示：也可以直接输代码，如 1119、1120、7012。</div>';
    }
    return warnHtml() + tip + head + recs.slice(0, 120).map(itemHtml).join('') +
      (recs.length > 120 ? '<div class="mini-note">仅显示前 120 条，请输入更具体的关键词缩小范围。</div>' : '');
  }
  function homeHtml() {
    var favCount = favs().length;
    return '<div class="card">' +
      '<div class="card-title">查代码 / 查行为 / 查口语说法</div>' +
      '<div class="search-row">' +
      '<input id="q" class="search-input" type="search" inputmode="search" autocomplete="off" ' +
      'placeholder="如 1119、头盔、超员、运沙石" value="' + esc(state.q) + '">' +
      (state.q ? '<button type="button" class="clear-btn" data-act="clear-q">清除</button>' : '') +
      '</div>' +
      '<div class="mini-note">支持代码、违法行为、俗称与口语词；数据全部在本机，断网也能查。</div>' +
      '</div>' +
      '<div class="card"><div class="card-title">常见情形</div><div class="chips">' + quickHtml() + '</div>' +
      '<div class="mini-note" style="margin-top:9px">' +
      '<button type="button" class="chip gray" data-act="favorites">★ 我的收藏 (' + favCount + ')</button> ' +
      '<button type="button" class="chip gray" data-act="about">来源与说明</button> ' +
      '<button type="button" class="chip gray" data-act="copy-link">复制本页链接</button> ' +
      '<button type="button" class="chip gray" data-act="howto-install">加到主屏 / 打不开</button></div></div>' +
      '<div class="card">' + filterHtml() + '</div>' +
      '<div id="results">' + resultsHtml() + '</div>';
  }
  function codeReading(code) {
    var first = code.charAt(0);
    var map = {
      '1': '机动车通行', '6': '机动车通行', '2': '非机动车通行',
      '3': '行人和乘车人通行', '4': '高速公路通行', '5': '其他规定',
      '7': '各省（含广东省）实施细则规定'
    };
    return '第 1 位「' + first + '」表示' + (map[first] || '其他分类') + '。' +
      '旧版编码中第 2 位表示记分分类（0 不记分、1 记 1 分、2 记 2 分、3 记 3 分、6 记 6 分、7 记 12 分）；' +
      '2022 年 4 月 1 日《道路交通安全违法行为记分管理办法》施行后新增 9 分档并调整了部分代码，' +
      '此规则仅供参考，<b>不能据此推断现行记分或代码</b>。';
  }
  function kv(k, v, cls) {
    return '<div class="kv-row"><div class="kv-k">' + esc(k) + '</div><div class="kv-v ' + (cls || '') + '">' + v + '</div></div>';
  }
  function detailHtml(r) {
    var pt = r.points == null ? '未标注（本表该章节未列记分）' : (r.points === 0 ? '不记分' : '记 ' + r.points + ' 分');
    var alias = (r.alias && r.alias.length) ? esc(r.alias.join('、')) : '—';
    return '<div class="back-row"><button type="button" class="back-btn" data-act="home">‹ 返回查询</button></div>' +
      warnHtml() +
      '<div class="card">' +
      '<div class="detail-code"><span class="code-badge">' + esc(r.code) + '</span>' +
      '<span class="point-badge ' + (r.points > 0 ? 'has' : '') + '">' + esc(pt) + '</span>' +
      '<span class="point-badge">' + esc(r.category) + '</span>' +
      '<div class="detail-tools">' +
      '<button type="button" class="tool-btn ' + (isFav(r.code) ? 'on' : '') + '" data-act="fav" data-code="' + esc(r.code) + '">' +
      (isFav(r.code) ? '★ 已收藏' : '☆ 收藏') + '</button>' +
      '<button type="button" class="tool-btn" data-act="copy" data-code="' + esc(r.code) + '">复制代码</button>' +
      '</div></div>' +
      '<div class="detail-behavior">' + esc(r.behavior) + '</div>' +
      '<div class="kv">' +
      kv('常见俗称', esc(alias)) +
      kv('记分', esc(pt), 'strong') +
      kv('处罚标准', r.penalty ? esc(r.penalty) : '本表未列，请自行核查', 'strong') +
      (r.measures ? kv('其他措施', esc(r.measures)) : '') +
      kv('违反条款', esc(r.violation || '—'), 'legal') +
      kv('处罚依据', esc(r.basis || '—'), 'legal') +
      kv('所属章节', esc(r.section)) +
      kv('代码类别', esc(r.category)) +
      '</div></div>' +
      '<div class="card"><div class="card-title">代码怎么读</div>' +
      '<div class="mini-note" style="font-size:12.5px;color:#3d4b63">' + codeReading(r.code) + '</div></div>' +
      '<div class="card"><div class="card-title">自行核查渠道</div>' +
      '<ul class="plain-list">' +
      '<li>「广东交警」微信公众号 → 小程序 → 处罚标准查询</li>' +
      '<li>本单位警务通最新代码表 / 属地交警大队</li>' +
      '<li>本单位法制部门或有权负责人</li>' +
      '</ul>' +
      '<div class="mini-note">法规简称对照：' +
      LAW_NAMES.map(function (x) { return esc(x[0]) + '＝' + esc(x[1]); }).join('；') + '。</div>' +
      '</div>';
  }
  function phoneHtml() {
    return '<div class="card"><div class="card-title">手机使用 / 访问入口</div>' +
      '<div class="kv">' +
      kv('当前入口', esc(location.host || '当前站点')) +
      kv('本页版本', esc(BUILD_LABEL)) +
      '</div>' +
      '<div class="mini-note">两个访问入口内容完全相同，任选一个使用；收藏和搜索历史按入口分别存在本机。</div>' +
      '<div class="chips" style="margin-top:9px">' +
      '<button type="button" class="chip" data-act="copy-link">复制当前链接</button>' +
      '<a class="chip" href="' + esc(CN_ENTRY) + '" target="_blank" rel="noopener noreferrer">国内入口（推荐）↗</a>' +
      '<a class="chip" href="' + esc(GITHUB_PAGES) + '" target="_blank" rel="noopener noreferrer">GitHub Pages ↗</a>' +
      '<a class="chip" href="' + esc(GITHUB_REPO) + '" target="_blank" rel="noopener noreferrer">源码仓库 ↗</a>' +
      '</div>' +
      '<ul class="plain-list" style="margin-top:10px">' +
      '<li><b>打不开或一直转圈：</b>github.io 在国内手机网络（尤其移动数据）常被拦或很慢，请点上面「国内入口（推荐）」，或切换 WiFi / 流量重试。</li>' +
      '<li><b>加到 iPhone 主屏幕：</b>用 Safari 打开本页 → 底部「分享」 → 「添加到主屏幕」；联网打开一次后，断网也能查（数据全在本机）。</li>' +
      '<li><b>看不到新版：</b>点右上角「↻ 刷新」清缓存重载，对照上面的版本号；不会删除收藏与搜索历史。</li>' +
      '</ul></div>';
  }
  function aboutHtml() {
    return '<div class="back-row"><button type="button" class="back-btn" data-act="home">‹ 返回查询</button></div>' +
      warnHtml() +
      phoneHtml() +
      '<div class="card"><div class="card-title">数据来源</div>' +
      '<div class="kv">' +
      kv('数据名称', esc(META.source || '广东省道路交通安全违法行为代码及处罚标准（2022年版）')) +
      kv('公开单位', esc(META.publisher || '肇庆市公安局高要分局')) +
      kv('版本', esc(META.version || '2022年版（公示文本）')) +
      kv('条目数', esc(String(META.count || CODES.length)) + ' 条') +
      kv('公开页面', '<a class="link-btn" href="' + esc(META.sourceUrl || '#') + '" target="_blank" rel="noopener noreferrer">在浏览器打开政府公示原文 ↗</a>') +
      '</div>' +
      '<div class="mini-note">字段结构与查询方式参考 ZG122「交通违法代码查询」小程序公开转载的查询结果（代码 / 违法行为 / 俗称 / 记分 / 罚款 / 违反条款 / 处罚依据）。本页为自建参考工具，与 ZG122 及任何公安机关无关联。</div>' +
      '</div>' +
      '<div class="card"><div class="card-title">法规简称对照</div>' +
      '<div class="kv">' + LAW_NAMES.map(function (x) { return kv(x[0], esc(x[1]), 'legal'); }).join('') + '</div></div>' +
      '<div class="card"><div class="card-title">代码编码规则（旧版，仅供参考）</div>' +
      '<div class="mini-note" style="font-size:12.5px;color:#3d4b63">' +
      '代码由四位或以上数字组成：第 1 位是行为分类（1、6 机动车通行，2 非机动车通行，3 行人和乘车人通行，4 高速公路通行，5 其他规定，7 各省实施细则规定）；' +
      '第 2 位在旧版编码中表示记分分类；第 3、4 位为顺序码，之后一般为违法行为子类编码。' +
      '2022 年记分办法施行后部分代码已调整，<b>请勿据此推断现行代码</b>。</div></div>' +
      '<div class="card"><div class="card-title">使用与核查</div>' +
      '<ul class="plain-list">' +
      '<li>本页只做检索提示，不认定违法事实、不代替选择处罚代码。</li>' +
      '<li>代码有新旧版本差异，7 字头为省级地方规定代码；罚款幅度各地可能不同。</li>' +
      '<li>不确定时请自行核查：「广东交警」公众号 → 小程序 → 处罚标准查询、本单位警务通最新代码表、属地交警大队或本单位法制部门。</li>' +
      '<li>不加登录、不采集案情、不上传任何输入内容；搜索历史与收藏只存在本机浏览器。</li>' +
      '<li>右上角「↻ 刷新」会清空页面缓存并重新加载，用于拿最新版；不会删除搜索历史与收藏。</li>' +
      '</ul></div>';
  }
  function favoritesHtml() {
    var list = favs().map(byCode).filter(Boolean);
    return '<div class="back-row"><button type="button" class="back-btn" data-act="home">‹ 返回查询</button></div>' +
      warnHtml() +
      '<div class="results-head"><span class="results-count">我的收藏 · ' + list.length + ' 条</span></div>' +
      (list.length ? list.map(itemHtml).join('') :
        '<div class="empty">还没有收藏。在代码详情页点「☆ 收藏」即可。</div>');
  }

  /* ---------- 路由与渲染 ---------- */
  function view() {
    var h = location.hash || '';
    if (h.indexOf('#/code/') === 0) return { name: 'detail', code: decodeURIComponent(h.slice(7)) };
    if (h.indexOf('#/about') === 0) return { name: 'about' };
    if (h.indexOf('#/favorites') === 0) return { name: 'favorites' };
    return { name: 'home' };
  }
  function render() {
    var v = view();
    if (v.name === 'detail') {
      var r = byCode(v.code);
      app.innerHTML = r ? detailHtml(r) :
        '<div class="back-row"><button type="button" class="back-btn" data-act="home">‹ 返回查询</button></div>' +
        '<div class="empty">没有找到代码 ' + esc(v.code) + '。</div>';
    } else if (v.name === 'about') app.innerHTML = aboutHtml();
    else if (v.name === 'favorites') app.innerHTML = favoritesHtml();
    else app.innerHTML = homeHtml();
    window.scrollTo(0, 0);
  }
  function go(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }
  function updateResults() {
    var el = document.getElementById('results');
    if (el) el.innerHTML = resultsHtml();
  }
  function setQuery(q, record) {
    state.q = q;
    var input = document.getElementById('q');
    if (input) input.value = q;
    if (record !== false) addHistory(q);
    // 重绘搜索区（清除按钮显隐）与结果区，但保留输入焦点
    var row = document.querySelector('.search-row');
    if (row && !q) {
      var btn = row.querySelector('.clear-btn');
      if (btn) btn.remove();
    } else if (row && q && !row.querySelector('.clear-btn')) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'clear-btn'; b.dataset.act = 'clear-q'; b.textContent = '清除';
      row.appendChild(b);
    }
    updateResults();
  }

  /* ---------- 事件 ---------- */
  app.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]');
    if (!t) return;
    var act = t.dataset.act;
    if (act === 'quick') { setQuery(t.dataset.q || ''); window.scrollTo(0, 0); }
    else if (act === 'open') { addHistory(state.q); go('#/code/' + encodeURIComponent(t.dataset.code)); }
    else if (act === 'home') go('#/');
    else if (act === 'about') go('#/about');
    else if (act === 'favorites') go('#/favorites');
    else if (act === 'clear-q') { setQuery('', false); var i = document.getElementById('q'); if (i) i.focus(); }
    else if (act === 'clear-history') { writeLS(LS_HISTORY, []); updateResults(); toast('已清除搜索历史'); }
    else if (act === 'point') { state.points = t.dataset.v; render(); }
    else if (act === 'cat') { state.category = t.dataset.v; render(); }
    else if (act === 'fav') { toggleFav(t.dataset.code); render(); }
    else if (act === 'howto-install') go('#/about');
    else if (act === 'copy-link') {
      var u = new URL(location.href);
      u.searchParams.delete('_r');
      u.hash = '#/';
      var link = u.toString();
      if (navigator.share) {
        navigator.share({ title: '违法代码速查 · 广东', url: link })
          .then(function () { toast('已分享'); })
          .catch(function () { fallbackCopy(link); });
      } else fallbackCopy(link);
    }
    else if (act === 'copy') {
      var code = t.dataset.code;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(function () { toast('已复制 ' + code); },
          function () { toast('复制失败，请长按代码手动复制'); });
      } else toast('请长按代码手动复制');
    }
  });
  app.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'q') {
      state.q = e.target.value;
      var row = document.querySelector('.search-row');
      if (row && state.q && !row.querySelector('.clear-btn')) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'clear-btn'; b.dataset.act = 'clear-q'; b.textContent = '清除';
        row.appendChild(b);
      }
      updateResults();
    }
  });
  app.addEventListener('keydown', function (e) {
    if (e.target && e.target.id === 'q' && e.key === 'Enter') {
      e.preventDefault();
      addHistory(state.q);
      e.target.blur();
      toast('已记录本次搜索');
    }
  });
  document.getElementById('btn-about').addEventListener('click', function () { go('#/about'); });
  document.getElementById('btn-refresh').addEventListener('click', hardRefresh);
  window.addEventListener('hashchange', render);

  function timeout(promise, ms, fallback) {
    return Promise.race([promise, new Promise(function (res) { setTimeout(function () { res(fallback); }, ms); })]);
  }
  async function hardRefresh() {
    toast('正在清理缓存并刷新…');
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistrations) {
        var regs = await timeout(navigator.serviceWorker.getRegistrations(), 1500, []);
        await Promise.all(regs.map(function (r) { return timeout(r.unregister(), 800, null); }));
      }
    } catch (err) { /* 忽略，继续刷新 */ }
    try {
      if (window.caches && caches.keys) {
        var keys = await timeout(caches.keys(), 1200, []);
        await Promise.all(keys.map(function (k) { return timeout(caches.delete(k), 800, null); }));
      }
    } catch (err) { /* 忽略，继续刷新 */ }
    var u = new URL(location.href);
    u.searchParams.set('_r', String(Date.now()));
    location.replace(u.toString());
  }

  /* ---------- 启动 ---------- */
  if (!location.hash) history.replaceState(null, '', location.pathname + location.search + '#/');
  render();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
