/* ===== CONSTANTS ===== */
const NAME_W     = 170;
let   HDR_H      = 82;    // dynamic: computed from MAX_EV_LANES_VISIBLE
const ROW_H      = 28;
const RULER_H    = 26;    // height per ruler band row (天皇・将軍・執権 etc.)
const EV_LANE_H  = 20;    // height per event label lane
const EV_TICK_H  = 20;    // year-tick area at the bottom of the header
const EV_BASE_FONT = 11;  // base font size for event labels
const MAX_EV_LANES_VISIBLE = 3;  // イベントエリアに同時表示するレーン数（固定）

const APP_TITLE = '家歴タイムライン';

/* 現在（月初）を小数年で保持。予定／超過の判定基準 */
const NOW_DY = (() => { const d = new Date(); return d.getFullYear() + d.getMonth() / 12; })();

/* ── 記録の種類（記号・色）。データセット側 recordTypes で上書き・追加可 ── */
const HOME_TYPES = {
  purchase: { label: '購入・設置',     sym: 'triangle', color: '#ffd23f', ch: '▲' },
  dispose:  { label: '廃棄・交換',     sym: 'cross',    color: '#ff4d4f', ch: '✕' },
  repair:   { label: '修繕',           sym: 'circle',   color: '#ffa94d', ch: '●' },
  reform:   { label: '増改築・リフォーム', sym: 'diamond', color: '#b197fc', ch: '◆' },
  inspect:  { label: '点検・メンテナンス', sym: 'square', color: '#69db7c', ch: '■' },
  warranty: { label: '契約・保証・保険', sym: 'star',     color: '#4fc3f7', ch: '★' },
  // 住人の履歴
  birth:    { label: '誕生',           sym: 'wye',      color: '#ff8fb1', ch: '✿' },
  death:    { label: '死亡',           sym: 'cross',    color: '#b0b4ba', ch: '†' },
  marriage: { label: '結婚',           sym: 'star',     color: '#ff5c8a', ch: '♥' },
  enroll:   { label: '入園・入学',     sym: 'triangle', color: '#4dd0e1', ch: '▲' },
  graduate: { label: '卒園・卒業',     sym: 'square',   color: '#26a69a', ch: '■' },
  career:   { label: '就職・転職',     sym: 'diamond',  color: '#ffb74d', ch: '◆' },
};
const HOME_SYMBOLS = {
  triangle: d3.symbolTriangle, cross: d3.symbolCross, circle: d3.symbolCircle,
  diamond: d3.symbolDiamond, square: d3.symbolSquare, star: d3.symbolStar, wye: d3.symbolWye,
};
function homeType(ds, key) {
  const t = (ds.recordTypes && ds.recordTypes[key]) || HOME_TYPES[key] || HOME_TYPES.repair;
  return t;
}
function homeSymbolPath(t, size) {
  return d3.symbol().type(HOME_SYMBOLS[t.sym] || d3.symbolCircle).size(size || 70)();
}
/* ツールチップを画面内に収めて配置（下端・右端の行でも切れない） */
function placeTooltip(el, event) {
  const w = el.offsetWidth, h = el.offsetHeight;
  const x = Math.min(event.clientX + 14, window.innerWidth  - w - 8);
  const y = Math.min(event.clientY - 10, window.innerHeight - h - 8);
  el.style.left = Math.max(4, x) + 'px';
  el.style.top  = Math.max(4, y) + 'px';
}
function fmtYen(v) { return '¥' + Number(v).toLocaleString('ja-JP'); }
function fmtYrs(v)  { return (Math.round(v * 10) / 10).toString() + '年'; }

/* ===== THEME ===== */
// Read a CSS custom property from body (reflects current dark/light mode)
function cv(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

// Format a year value; supports BCE (negative years) when dataset has bce:true
// Also supports monthly precision when dataset has monthly:true (decimal year → "YYYY年M月")
function fmtYear(y) {
  const ds = DATASETS[currentKey];
  if (ds && ds.bce && y <= 0) return `前${Math.abs(y)}年`;
  if (ds && ds.monthly) {
    // Snap to nearest month to avoid floating-point artefacts
    const total = Math.round(y * 12);
    const yr    = Math.floor(total / 12);
    const moIdx = total - yr * 12;            // 0..11
    if (moIdx === 0) return `${yr}年`;
    return `${yr}年${moIdx + 1}月`;
  }
  return `${y}年`;
}

// 月まで必ず表示する書式（ツールチップ・パネル用）
function fmtYM(y) {
  const ds = DATASETS[currentKey];
  if (ds && ds.monthly) {
    const total = Math.round(y * 12);
    const yr = Math.floor(total / 12);
    return `${yr}年${total - yr * 12 + 1}月`;
  }
  return fmtYear(y);
}

// Convert "YYYY-MM" string → decimal year (e.g. "1989-04" → 1989.25). Numbers pass through.
function dateToDecY(v) {
  if (typeof v !== 'string') return v;
  const parts = v.split('-');
  const yr = Number(parts[0]);
  const mo = Number(parts[1] || 1);
  return yr + (mo - 1) / 12;
}

// Normalize a monthly-mode dataset: convert all "YYYY-MM" string fields to decimal years.
// Idempotent (sets ds._normalized = true on first run).
function normalizeDataset(ds) {
  if (!ds || ds._normalized) return;
  ds._normalized = true;
  if (!ds.monthly) return;
  const c = dateToDecY;
  (ds.persons || []).forEach(p => {
    if (p.birth != null) p.birth = c(p.birth);
    if (p.death != null) p.death = c(p.death);
    if (p.born  != null) p.born  = c(p.born);
    const serves = Array.isArray(p.serve) ? p.serve : (p.serve ? [p.serve] : []);
    serves.forEach(sv => {
      if (sv.start != null) sv.start = c(sv.start);
      if (sv.end   != null) sv.end   = c(sv.end);
    });
  });
  (ds.persons || []).forEach(p => {
    (p.records || []).forEach(r => { if (r.date != null) r.date = c(r.date); });
  });
  (ds.events || []).forEach(ev => { if (ev.year != null) ev.year = c(ev.year); });
  (ds.emperors || []).forEach(e => {
    if (e.start != null) e.start = c(e.start);
    if (e.end   != null) e.end   = c(e.end);
  });
  (ds.retired || []).forEach(e => {
    if (e.start != null) e.start = c(e.start);
    if (e.end   != null) e.end   = c(e.end);
  });
  (ds.rulers || []).forEach(r => {
    (r.entries || []).forEach(e => {
      if (e.start != null) e.start = c(e.start);
      if (e.end   != null) e.end   = c(e.end);
    });
  });
  if (ds.kind === 'home') normalizeHome(ds);
}

/* 家歴データの前処理：状態（使用中／廃棄済み）、対応年数、超過、周期メンテナンスの予定を計算 */
function normalizeHome(ds) {
  const now = NOW_DY;
  const horizonEnd = now + (ds.horizonYears != null ? ds.horizonYears : 20);
  // 交換系列（succeeds をたどった先頭）を求め、並び順に使う
  const byName = {};
  ds.persons.forEach((p, i) => { byName[p.name] = p; p._idx = i; });
  ds.persons.forEach(p => {
    let root = p, guard = 0;
    while (root.succeeds && guard++ < 20) {
      const pre = Array.isArray(root.succeeds) ? root.succeeds[0] : root.succeeds;
      if (!byName[pre]) break;
      root = byName[pre];
    }
    p._chainBirth = root.birth;
    p._chainIdx = root._idx;
  });
  ds.persons.forEach(p => {
    const hasEnd = p.death != null;
    p._lifeEnd = (p.lifeYears != null) ? shiftMonths(p.birth, Math.round(p.lifeYears * 12)) : null;
    if (hasEnd && p.death <= now) {
      // 廃棄・交換・終了済み
      p._state = 'gone';
      p._solidEnd = p.death;
      p._plannedEnd = p.death;
      p._overdue = false;
    } else {
      p._state = 'active';
      p._solidEnd = now;
      const planned = hasEnd ? p.death : p._lifeEnd;
      p._plannedEnd = Math.max(planned != null ? planned : now, now);
      p._overdue = !hasEnd && p._lifeEnd != null && p._lifeEnd < now;
      p.death = p._plannedEnd;
    }
    p.records = p.records || [];
    p.records.forEach(r => {
      r._planned = r.planned === true || r.date > now;
      r._overdue = r._planned && r.date < now;
    });
    // 周期メンテナンス：直近の実施日から cycleYears ごとの予定を自動生成
    if (p.cycleYears && p._state === 'active' && !p._cycled) {
      p._cycled = true;
      const type = p.cycleType || 'inspect';
      const step = Math.round(p.cycleYears * 12);
      const done = p.records.filter(r => r.type === type && !r._planned).map(r => r.date);
      let base = done.length ? Math.max(...done) : p.birth;
      // 終了予定・対応年数があればそこまで、無ければ表示範囲の末尾まで予定を作る
      const end = (hasEnd || p._lifeEnd != null) ? Math.min(horizonEnd, p._plannedEnd) : horizonEnd;
      let d = shiftMonths(base, step), lastPast = null;
      const add = [];
      while (d <= end + 1e-9) {
        if (d < now) { lastPast = d; }
        else add.push({ date: d, type, name: p.cycleName || '定期メンテナンス',
                        auto: true, _planned: true, _overdue: false });
        d = shiftMonths(d, step);
      }
      if (lastPast !== null) {
        add.unshift({ date: lastPast, type, name: p.cycleName || '定期メンテナンス',
                      auto: true, _planned: true, _overdue: true });
      }
      p.records.push(...add);
    }
    p.records.sort((a, b) => a.date - b.date);
    const nextRec = p.records.find(r => r._planned);
    p._nextDue = nextRec ? nextRec.date : null;
    p._attention = p._overdue || p.records.some(r => r._overdue);
  });
}

// Move a decimal year by n months (avoids floating-point drift)
function shiftMonths(dy, n) {
  const total = Math.round(dy * 12) + n;
  return total / 12;
}

// 年齢値の表示用フォーマット（月単位データセットでは小数1桁まで丸める）
function fmtAgeVal(v) {
  const ds = DATASETS[currentKey];
  if (ds && ds.monthly) return (Math.round(v * 10) / 10).toString();
  return v.toString();
}

// Estimate pixel width of an event label string
function evLabelW(text, fontSize) {
  // 全角（CJK）は約1em、半角は約0.58em として幅を見積もる
  let w = 0;
  for (const ch of text) w += ch.charCodeAt(0) > 0x2E80 ? 1.0 : 0.58;
  return w * fontSize + 12;
}

// Return an array of ruler band descriptors for a dataset.
// If ds.rulers exists, use it directly; otherwise fall back to emperors/retired.
function getRulers(ds) {
  if (ds.rulers && ds.rulers.length > 0) return ds.rulers;
  const out = [];
  if (ds.emperors && ds.emperors.length > 0)
    out.push({ label: ds.empLabel || '天皇', entries: ds.emperors });
  if (ds.retired && ds.retired.length > 0)
    out.push({ label: ds.retLabel || '上皇', entries: ds.retired });
  return out;
}

// Compute header height — fixed to MAX_EV_LANES_VISIBLE lanes (event area is scrollable)
function computeHeaderHeight(ds, chartW) {
  const base = EV_TICK_H;
  if (!ds.events || ds.events.length === 0) return base + EV_LANE_H;
  return base + MAX_EV_LANES_VISIBLE * EV_LANE_H;
}

let currentTheme = localStorage.getItem('tl-theme') || 'light';

function applyTheme(theme) {
  currentTheme = theme;
  document.body.classList.toggle('light', theme === 'light');
  localStorage.setItem('tl-theme', theme);
  const icon  = document.getElementById('theme-icon');
  const label = document.getElementById('theme-label');
  if (icon)  icon.textContent  = theme === 'light' ? '☀️' : '🌙';
  if (label) label.textContent = theme === 'light' ? 'ダークモードに切替' : 'ライトモードに切替';
  buildChart();   // redraw chart with new colors
}

function toggleTheme() {
  applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
}

/* ===== STATE ===== */
let currentKey  = 'sample_house';
let visibleCats = {};
let curPersons  = [];
let spacePressed = false; // スペースキー押下中：選択年に生存している人物のみ表示
let focusMode    = false; // フォーカスボタン トグル（持続的に絞り込み表示）
let curT        = d3.zoomIdentity;
let sortMode    = 'birth';      // 'birth' | 'category'
let groupStarts = new Set();    // row indices that begin a new category group
let evScrollY   = 0;            // イベントエリアのスクロール量（px）
let evTotalLanes = 0;           // 現在のイベントレーン総数（drawAxisPanel が設定）
let evHitItems  = [];           // イベントラベルのヒット範囲（drawAxisPanel が設定）
let kXExtra     = 1.0;          // 横軸のみの追加拡大率（横ズーム機能）

/* ── データセット固有の用語ラベル ──────────────────────────────
   各データセットで labels: { age, lifespan, agePanel } を定義すると
   デフォルト（歳 / 享年 / その年の年齢）を上書きできる。
   categoryLabels: { '区分名': { age, lifespan } } を定義すると
   特定区分だけラベルを上書き（または元に戻す）できる。
   優先順位: categoryLabels[cat] > labels > defaultVal              */
function getLabel(key, defaultVal, cat) {
  const ds = DATASETS[currentKey];
  // 区分単位の上書きを最優先
  if (cat != null && ds && ds.categoryLabels) {
    const cv = ds.categoryLabels[cat] && ds.categoryLabels[cat][key];
    if (cv != null) return cv;
  }
  // データセット全体のラベル
  const v = ds && ds.labels && ds.labels[key];
  return v != null ? v : defaultVal;
}

function setSort(mode) {
  sortMode = mode;
  document.getElementById('sort-birth').classList.toggle('seg-active', mode === 'birth');
  document.getElementById('sort-cat').classList.toggle('seg-active', mode === 'category');
  buildChart();
}

let svgEl, contentG, namesG, axisG, zoomBehavior, xScale;
let curChartH = 0;      // visible chart height (below header)
let curTotalDataH = 0;  // total data height (persons) × ROW_H
let curChartW = 0;      // visible chart width (right of names panel)
let selectedYear = null; // currently selected year (for age panel)

/* ========================================================
   AGE PANEL
   ======================================================== */

// モバイル判定（< 600px ではボトムシートになるため幅に影響しない）
function isMobile() { return window.innerWidth < 600; }

function selectYear(year) {
  const wasOpen = selectedYear !== null;
  selectedYear = year;
  renderAgePanel();
  redrawFixed();   // refresh selection line
  // フォーカスモード中は表示対象が変わるので即時に再描画
  if (spacePressed || focusMode) { buildChart(); return; }
  // デスクトップ: パネルが右に展開してチャート幅が変わるので再描画
  // モバイル: ボトムシートなのでチャート幅は変わらない → スキップ
  if (!wasOpen && !isMobile()) setTimeout(buildChart, 240);
}

function closeAgePanel() {
  selectedYear = null;
  document.getElementById('age-panel').classList.remove('open');
  // フォーカスモードもオフにする（選択年がないと絞り込み対象がないため）
  if (focusMode) {
    focusMode = false;
    const btn = document.getElementById('focus-btn');
    if (btn) btn.classList.remove('tbtn-active');
  }
  redrawFixed();
  // デスクトップのみ再描画
  if (!isMobile()) setTimeout(buildChart, 240);
}

function renderAgePanel() {
  const panel   = document.getElementById('age-panel');
  const yearEl  = document.getElementById('age-panel-year');
  const listEl  = document.getElementById('age-panel-list');

  panel.classList.add('open');
  yearEl.textContent = fmtYM(selectedYear);
  listEl.innerHTML = '';

  const ds = DATASETS[currentKey];

  // Events occurring in the selected year (month-単位 ではトレランスを持たせる)
  const tol = ds.monthly ? 1 / 24 : 0.0001;
  const events = ds.events.filter(ev => Math.abs(ev.year - selectedYear) < tol);
  // 家歴：選択月に起きた取得・廃棄・修繕・点検・予定
  const homeRows = [];
  if (ds.kind === 'home') {
    curPersons.forEach(p => {
      if (Math.abs(p.birth - selectedYear) < tol) {
        const t = homeType(ds, p.startType || 'purchase');
        homeRows.push({ ch: t.ch, color: t.color, text: `${p.name}：${p.startLabel || t.label}` });
      }
      if (p._state === 'gone' && Math.abs(p.death - selectedYear) < tol) {
        const t = homeType(ds, p.endType || 'dispose');
        homeRows.push({ ch: t.ch, color: t.color, text: `${p.name}：${p.endLabel || t.label}` });
      }
      p.records.forEach(r => {
        if (Math.abs(r.date - selectedYear) < tol) {
          const t = homeType(ds, r.type);
          homeRows.push({ ch: t.ch, color: t.color,
            text: `${p.name}：${r.name}` + (r._overdue ? '（超過）' : r._planned ? '（予定）' : '') });
        }
      });
    });
  }
  if (events.length > 0 || homeRows.length > 0) {
    const evSec = document.createElement('div');
    evSec.className = 'age-ev-sec';
    events.forEach(ev => {
      const row = document.createElement('div');
      row.className = 'age-ev-item';
      row.innerHTML = `<span class="age-ev-icon">⚡</span><span class="age-ev-name">${ev.name}</span>`;
      evSec.appendChild(row);
    });
    homeRows.forEach(h => {
      const row = document.createElement('div');
      row.className = 'age-ev-item';
      row.innerHTML = `<span class="age-ev-icon" style="color:${h.color};opacity:1">${h.ch}</span>` +
                      `<span class="age-ev-name">${h.text}</span>`;
      evSec.appendChild(row);
    });
    listEl.appendChild(evSec);
  }

  // Only persons alive at selectedYear, sorted oldest first
  const alive = curPersons
    .filter(p => p.birth <= selectedYear && selectedYear <= p.death)
    .sort((a, b) => (selectedYear - b.birth) - (selectedYear - a.birth));

  alive.forEach(p => {
    const color  = ds.categories[p.cat] || '#888';
    const age    = selectedYear - (p.born != null ? p.born : p.birth);
    const ageStr = (ds.kind === 'home' && p.born != null) ? Math.floor(age) + '歳'
                 : fmtAgeVal(age) + getLabel('age', '歳', p.cat);

    // Active serve roles at selectedYear
    const serves = Array.isArray(p.serve) ? p.serve : (p.serve ? [p.serve] : []);
    const activeRoles = serves
      .filter(sv => sv.start <= selectedYear && selectedYear <= sv.end)
      .map(sv => sv.role);
    const roleSuffix = activeRoles.length > 0
      ? `<span class="age-role">(${activeRoles.join('・')})</span>` : '';

    const item = document.createElement('div');
    item.className = 'age-item age-alive';
    item.innerHTML =
      `<span class="age-dot" style="background:${color}"></span>` +
      `<span class="age-name">${p.name}${roleSuffix}${(ds.kind === 'home' && p._overdue && selectedYear >= p._lifeEnd) ? '<span class="age-role" style="color:#ff6b5e">（要対応）</span>' : ''}</span>` +
      `<span class="age-val">${ageStr}</span>`;
    listEl.appendChild(item);
  });
}

/* ===== HAMBURGER MENU ===== */
function toggleMenu(e) {
  e.stopPropagation();
  document.getElementById('hamburger-menu').classList.toggle('hidden');
}
function closeMenu() {
  document.getElementById('hamburger-menu').classList.add('hidden');
}
// Close menu when clicking outside
document.addEventListener('click', e => {
  if (!e.target.closest('#hamburger-btn') && !e.target.closest('#hamburger-menu')) {
    closeMenu();
  }
});


/* ========================================================
   SIDEBAR
   ======================================================== */
function renderSidebar() {
  const list = document.getElementById('era-list');
  list.innerHTML = '';
  Object.keys(DATASETS).forEach(key => {
    const d  = DATASETS[key];
    const el = document.createElement('div');
    el.className = 'era-item' + (key === currentKey ? ' active' : '');

    const catDots = Object.values(d.categories)
      .map(color => `<span class="era-cat-dot" style="background:${color}"></span>`)
      .join('');
    const count = d.persons ? d.persons.length : 0;

    el.innerHTML =
      `<div class="era-name">${d.name}</div>` +
      `<div class="era-meta">` +
        `<span class="era-period">${d.period}</span>` +
        `<span class="era-count">${count}${d.unit || '項目'}</span>` +
      `</div>` +
      `<div class="era-cats">${catDots}</div>`;
    el.onclick = () => { visibleCats = {}; loadDataset(key); };
    list.appendChild(el);
  });
}

function renderFilters(ds) {
  const sec = document.getElementById('filters');
  sec.innerHTML = '';

  // ヘッダー行：ラベル ＋ すべて選択 / すべて解除
  const head = document.createElement('div');
  head.className = 'filter-head';
  head.innerHTML =
    '<h3>区分フィルター</h3>' +
    '<div class="filter-btns">' +
      '<button class="filter-btn" id="filter-all">すべて選択</button>' +
      '<button class="filter-btn" id="filter-none">すべて解除</button>' +
    '</div>';
  sec.appendChild(head);

  const cats = Object.keys(ds.categories);

  head.querySelector('#filter-all').onclick = () => {
    cats.forEach(c => { visibleCats[c] = true; });
    renderFilters(ds);
    buildChart();
  };
  head.querySelector('#filter-none').onclick = () => {
    cats.forEach(c => { visibleCats[c] = false; });
    renderFilters(ds);
    buildChart();
  };

  Object.entries(ds.categories).forEach(([cat, color]) => {
    if (visibleCats[cat] === undefined) visibleCats[cat] = true;
    const lbl = document.createElement('label');
    lbl.className = 'filter-check';
    lbl.innerHTML =
      `<input type="checkbox" ${visibleCats[cat] ? 'checked' : ''}>` +
      `<span class="filter-dot" style="background:${color}"></span>${cat}`;
    lbl.querySelector('input').onchange = e => {
      visibleCats[cat] = e.target.checked;
      buildChart();
    };
    sec.appendChild(lbl);
  });
}

function renderSymbolLegend(ds) {
  const el = document.getElementById('symbol-legend');
  if (!el) return;
  // このデータで実際に使っている種類だけ凡例に出す
  const used = new Set();
  let hasPlan = false, hasGhost = false;
  ds.persons.forEach(p => {
    used.add(p.startType || 'purchase');
    if (p._state === 'gone') used.add(p.endType || 'dispose');
    (p.records || []).forEach(r => { used.add(r.type); if (r._planned) hasPlan = true; });
    if (p.lifeYears != null) hasGhost = true;
  });
  const svg = (t, hollow, red) =>
    `<svg width="14" height="14" viewBox="-7 -7 14 14"><path d="${homeSymbolPath(t, 60)}"` +
    (t.sym === 'cross' ? ' transform="rotate(45)"' : '') +
    ` fill="${hollow ? 'none' : t.color}" stroke="${red ? '#ff3b30' : (hollow ? t.color : '#fff')}"` +
    ` stroke-width="${hollow ? 1.4 : 0.8}"${red ? ' stroke-dasharray="2,1.5"' : ''}/></svg>`;
  const rows = [];
  Object.keys(Object.assign({}, HOME_TYPES, ds.recordTypes || {})).forEach(k => {
    if (!used.has(k)) return;
    const t = homeType(ds, k);
    rows.push(`<div class="sym-row">${svg(t, false, false)}<span>${t.label}</span></div>`);
  });
  const sample = homeType(ds, 'inspect');
  if (hasPlan) {
    rows.push(`<div class="sym-row">${svg(sample, true, false)}<span>予定（中抜き）</span></div>`);
    rows.push(`<div class="sym-row">${svg(sample, true, true)}<span>時期を超過</span></div>`);
  }
  if (hasGhost) {
    rows.push(`<div class="sym-row"><span class="sym-bar sym-bar-ghost"></span><span>対応年数まで</span></div>`);
    rows.push(`<div class="sym-row"><span class="sym-bar sym-bar-over"></span><span>対応年数を超過</span></div>`);
  }
  rows.push(`<div class="sym-row"><span class="sym-bar sym-bar-now"></span><span>現在</span></div>`);
  el.innerHTML = '<h3>記号の凡例</h3><div class="sym-grid">' + rows.join('') + '</div>';
}

function renderLegend(ds) {
  const leg = document.getElementById('legend');
  leg.innerHTML = '';
  if (ds.kind === 'home') return;   // 家歴は左の区分フィルターに色が出ているのでツールバーには出さない
  Object.entries(ds.categories).forEach(([name, color]) => {
    leg.innerHTML +=
      `<div class="legend-item"><span class="legend-dot" style="background:${color}"></span>${name}</div>`;
  });
}

/* ========================================================
   SIDEBAR TOGGLE
   ======================================================== */
let sidebarOpen = true;
function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  const sb        = document.getElementById('sidebar');
  const expandBtn = document.getElementById('expand-btn');
  sb.classList.toggle('collapsed', !sidebarOpen);
  // expand-btn はサイドバーが閉じているときだけ表示
  expandBtn.style.display = sidebarOpen ? 'none' : 'flex';
  setTimeout(buildChart, 270);
}

/* ========================================================
   MAIN CHART
   ======================================================== */
function loadDataset(key) {
  currentKey = key;
  // URL ハッシュを更新（ブックマーク・共有用）
  // file:// プロトコルでは location.hash 代入が Chrome にブロックされることがあるため try-catch で保護
  try {
    if (location.hash !== '#' + key) history.replaceState(null, '', '#' + key);
  } catch (e) { /* file:// 環境では無視 */ }
  renderSidebar();   // サイドバーの選択状態を更新
  const ds = DATASETS[key];
  // 月単位データセット（monthly: true）の場合、'YYYY-MM' 文字列を小数年へ変換
  normalizeDataset(ds);
  document.getElementById('t-title').textContent = ds.name + ' / ' + APP_TITLE;
  document.title = ds.name + ' / ' + APP_TITLE;
  // 年齢パネルのサブタイトルをデータセットの用語に合わせて更新
  document.getElementById('age-panel-subtitle').textContent =
    getLabel('agePanel', 'その時点の経過年数');
  // Reset year selection when switching datasets
  selectedYear = null;
  document.getElementById('age-panel').classList.remove('open');
  // フォーカスモード状態もリセット
  if (focusMode) {
    focusMode = false;
    const btn = document.getElementById('focus-btn');
    if (btn) btn.classList.remove('tbtn-active');
  }
  spacePressed = false;
  renderFilters(ds);
  renderLegend(ds);
  renderSymbolLegend(ds);
  // Reset zoom and event scroll when switching datasets
  curT = d3.zoomIdentity;
  evScrollY = 0;
  kXExtra = 1.0;
  buildChart();
}

/* ── Rebuild chart SVG (preserves zoom & selectedYear) ── */
function buildChart() {
  const ds = DATASETS[currentKey];
  normalizeDataset(ds);   // 起動直後のテーマ適用など、loadDataset より先に呼ばれても安全（冪等）
  const wrap = document.getElementById('chart-wrap');
  wrap.innerHTML = '';

  // Filter + sort persons
  curPersons = ds.persons
    .filter(p => visibleCats[p.cat] !== false)
    .slice()
    .sort((a, b) => {
      if (sortMode === 'category') {
        const ck = Object.keys(ds.categories);
        const ia = ck.indexOf(a.cat), ib = ck.indexOf(b.cat);
        const cc = (ia !== ib && ia >= 0 && ib >= 0) ? ia - ib
                 : (a.cat || '').localeCompare(b.cat || '', 'ja');
        if (cc !== 0) return cc;
      }
      if (ds.kind === 'home') {
        // 交換前後（succeeds）の項目を隣り合わせにする：系列の最初の取得月 → 系列 → 取得月
        return (a._chainBirth - b._chainBirth) || (a._chainIdx - b._chainIdx) || (a.birth - b.birth);
      }
      return a.birth - b.birth;
    });

  // フォーカスモード（スペース押下中 or トグルON）：選択年に生存している人物のみ表示
  if ((spacePressed || focusMode) && selectedYear !== null) {
    curPersons = curPersons.filter(p => p.birth <= selectedYear && selectedYear <= p.death);
  }

  // Compute category group boundaries (used by drawBars & drawNamesPanel)
  groupStarts = new Set();
  if (sortMode === 'category') {
    let prevCat = null;
    curPersons.forEach((p, i) => {
      if (p.cat !== prevCat) { groupStarts.add(i); prevCat = p.cat; }
    });
  }

  const rect = wrap.getBoundingClientRect();
  const W = rect.width, H = rect.height;
  if (W < 20 || H < 20) return;

  /* ── Year range ── */
  const allY = [
    ...curPersons.flatMap(p => [p.birth, p.death]),
    ...ds.events.map(e => e.year),
    ...(ds.emperors || []).flatMap(e => [e.start, e.end]),
  ];
  const pad  = ds.monthly ? 0.5 : 2;
  const yMin = Math.min(...allY) - (ds.kind === 'home' ? 2 : pad);
  let   yMax = Math.max(...allY) + pad;
  // 家歴：遠い将来（建物の想定寿命など）は表示範囲を horizonYears で打ち切る
  if (ds.kind === 'home') {
    yMax = Math.min(yMax, NOW_DY + (ds.horizonYears != null ? ds.horizonYears : 20) + pad);
  }

  const chartW = W - NAME_W;   // chart content width in screen px

  // xScale maps year → chart content x (0 = left edge of chart)
  // (must be computed BEFORE computeHeaderHeight, which uses xScale)
  xScale = d3.scaleLinear().domain([yMin, yMax]).range([0, chartW]);

  // Dynamic header height: tall enough for all event lanes at default zoom
  HDR_H = computeHeaderHeight(ds, chartW);
  const chartH = H - HDR_H;    // chart content height in screen px

  // Store for scroll clamping
  curChartH     = chartH;
  curTotalDataH = curPersons.length * ROW_H + 100; // 下端の余白（ホバーが切れないように）
  curChartW     = chartW;

  /* ── SVG ── */
  svgEl = d3.select(wrap).append('svg')
    .attr('width', W).attr('height', H)
    .style('display', 'block');

  /* ── Clip paths ── */
  const defs = svgEl.append('defs');
  // Chart body clip
  defs.append('clipPath').attr('id', 'clip-chart')
    .append('rect')
      .attr('x', NAME_W).attr('y', HDR_H)
      .attr('width', chartW).attr('height', chartH);
  // Event area clip (hides overflow during scroll)
  const evAreaH = HDR_H - EV_TICK_H;
  defs.append('clipPath').attr('id', 'clip-ev')
    .append('rect')
      .attr('x', NAME_W).attr('y', 0)
      .attr('width', chartW).attr('height', evAreaH);

  /* ── Content group (zoomable, clipped) ──
       Items inside are drawn as if origin = top-left of chart area.
       Transform: translate(NAME_W + t.x, HDR_H + t.y) scale(t.k)
       ─> screen_x = NAME_W + t.x + data_x * t.k
       ─> screen_y = HDR_H  + t.y + data_y * t.k          */
  contentG = svgEl.append('g').attr('clip-path', 'url(#clip-chart)');
  const cg = contentG.append('g').attr('class', 'cg');
  applyContentTransform(cg, curT);

  /* ── Draw chart bars into cg ── */
  drawBars(cg, ds, yMin, yMax, chartW, chartH);

  /* ── Fixed overlay groups (always on top) ── */
  namesG = svgEl.append('g');   // no transform — uses absolute SVG coords
  axisG  = svgEl.append('g');   // no transform

  /* ── Corner fill (top-left square) ── */
  svgEl.append('rect')
    .attr('width', NAME_W).attr('height', HDR_H)
    .attr('fill', cv('--chart-panel'));

  /* Initial draw of fixed panels */
  redrawFixed();

  /* ── Zoom behaviour (drag to pan, buttons/pinch to zoom)
        ホイール = スクロール（上下 / Shift+水平）
        ズームはツールバーボタン・キーボード・トラックパッドピンチのみ ── */
  // Track mousedown position to distinguish click from drag
  let _clMdX = 0, _clMdY = 0;

  zoomBehavior = d3.zoom()
    .scaleExtent([0.15, 20])
    // ホイールイベントをズームに使わず、ドラッグとタッチピンチのみ許可
    .filter(event => {
      if (event.type === 'wheel') return false;   // ← ホイールはズームしない
      return !event.ctrlKey && !event.button;
    })
    .on('start', event => {
      // Record pointer position at gesture start (mousedown / touchstart)
      const src = event.sourceEvent;
      if (!src) return;
      if (src.type === 'touchstart') {
        const t = src.touches && src.touches[0];
        if (t) { _clMdX = t.clientX; _clMdY = t.clientY; }
      } else {
        _clMdX = src.clientX; _clMdY = src.clientY;
      }
    })
    .on('zoom', event => {
      let t = event.transform;
      // Clamp vertical: no blank space above first row or below last row
      const minY = Math.min(0, curChartH - curTotalDataH * t.k);
      const clampedY = Math.max(minY, Math.min(0, t.y));
      // Clamp horizontal: no blank space left of data start or right of data end
      const minX = Math.min(0, curChartW - curChartW * t.k * kXExtra);
      const clampedX = Math.max(minX, Math.min(0, t.x));
      if (clampedY !== t.y || clampedX !== t.x) {
        t = d3.zoomIdentity.scale(t.k).translate(clampedX / t.k, clampedY / t.k);
      }
      curT = t;
      applyContentTransform(svgEl.select('.cg'), curT);
      redrawFixed();
      document.getElementById('zoom-info').textContent =
        Math.round(curT.k * 100) + '%';
    })
    .on('end', event => {
      // Detect tap/click: gesture ended near where it started (no significant drag)
      const src = event.sourceEvent;
      if (!src) return;

      // Resolve end coordinates for mouse and touch
      let endX, endY;
      if (src.type === 'touchend') {
        const t = src.changedTouches && src.changedTouches[0];
        if (!t) return;
        endX = t.clientX; endY = t.clientY;
      } else if (src.type === 'mouseup') {
        endX = src.clientX; endY = src.clientY;
      } else {
        return;
      }

      if (Math.abs(endX - _clMdX) > 8 || Math.abs(endY - _clMdY) > 8) return;
      const rect = svgEl.node().getBoundingClientRect();
      const px = endX - rect.left;
      const py = endY - rect.top;

      // Names panel click → select clicked person's birth year
      if (px < NAME_W) {
        if (py >= HDR_H) {
          const dataY = (py - HDR_H - curT.y) / curT.k;
          const idx   = Math.floor(dataY / ROW_H);
          if (idx >= 0 && idx < curPersons.length) {
            selectYear(curPersons[idx].birth);
          }
        }
        return;
      }

      // Snap to an event year if tap is within SNAP_PX of its vertical line
      const SNAP_PX = src.type === 'touchend' ? 16 : 12;
      let year = null;
      // 家歴：「現在」の目印（ヘッダーの札 or 縦線）をクリック → 現在の月を選択
      if (DATASETS[currentKey].kind === 'home') {
        const nx = NAME_W + curT.x + xScale(NOW_DY) * curT.k * kXExtra;
        const onPill = Math.abs(px - nx) <= 16 && py >= HDR_H - 21 && py <= HDR_H - 5;
        if (onPill || Math.abs(px - nx) <= 4) { selectYear(NOW_DY); return; }
      }
      for (const ev of DATASETS[currentKey].events) {
        const evSx = NAME_W + curT.x + xScale(ev.year) * curT.k * kXExtra;
        if (Math.abs(px - evSx) <= SNAP_PX) { year = ev.year; break; }
      }
      // ラベルテキストの幅内をクリックした場合もそのイベント年にスナップ
      if (year === null) {
        for (const hit of evHitItems) {
          if (px >= hit.sx - hit.w / 2 && px <= hit.sx + hit.w / 2) {
            year = hit.evYear; break;
          }
        }
      }
      if (year === null) {
        const dataX = (px - NAME_W - curT.x) / (curT.k * kXExtra);
        const dy    = xScale.invert(dataX);
        // 月単位データセットでは月の単位にスナップ、それ以外は年単位
        year = DATASETS[currentKey].monthly
          ? Math.round(dy * 12) / 12
          : Math.round(dy);
      }
      selectYear(year);
    });

  svgEl.call(zoomBehavior);

  /* ── ホイール → スクロール ──
        イベントエリア上 : イベントを縦スクロール
        通常ホイール     : チャートを縦スクロール
        Shift+ホイール   : チャートを横スクロール ── */
  // evAreaH は上の defs セクションで宣言済み

  svgEl.on('wheel.scroll', function(event) {
    event.preventDefault();
    const svgRect = svgEl.node().getBoundingClientRect();
    const mouseY  = event.clientY - svgRect.top;

    // ── Ctrl+ホイール → フルズーム（ピンチ相当）──
    if (event.ctrlKey) {
      const delta  = event.deltaMode === 1 ? event.deltaY * ROW_H : event.deltaY;
      const factor = delta > 0 ? 1 / 1.15 : 1.15;
      svgEl.call(zoomBehavior.scaleBy, factor);
      return;
    }

    // ── イベントエリア上のホイール → イベントスクロール ──
    if (mouseY < evAreaH && !event.shiftKey) {
      const delta = event.deltaMode === 1 ? event.deltaY * EV_LANE_H : event.deltaY;
      const totalEvH  = evTotalLanes * EV_LANE_H;
      const maxScroll = Math.max(0, totalEvH - evAreaH);
      evScrollY = Math.max(0, Math.min(evScrollY + delta, maxScroll));
      redrawFixed();
      return;
    }

    // ── チャートエリアのホイール → チャートスクロール ──
    const delta = event.deltaMode === 1 ? event.deltaY * ROW_H : event.deltaY;
    const hDelta = event.deltaMode === 1 ? event.deltaX * ROW_H : event.deltaX;

    const dx = event.shiftKey ? -delta : -hDelta;
    const dy = event.shiftKey ? 0      : -delta;

    let newT = curT.translate(dx, dy);

    const minY = Math.min(0, curChartH - curTotalDataH * newT.k);
    const clampedY = Math.max(minY, Math.min(0, newT.y));
    const minX = Math.min(0, curChartW - curChartW * newT.k * kXExtra);
    const clampedX = Math.max(minX, Math.min(0, newT.x));
    if (clampedY !== newT.y || clampedX !== newT.x) {
      newT = d3.zoomIdentity.scale(newT.k).translate(clampedX / newT.k, clampedY / newT.k);
    }

    svgEl.call(zoomBehavior.transform, newT);
  }, { passive: false });

  /* ── タッチ → イベントエリアスクロール（モバイル） ── */
  let _evTouchY = null;
  svgEl.on('touchstart.evscroll', function(event) {
    const t0 = event.touches[0];
    const svgRect = svgEl.node().getBoundingClientRect();
    if (t0.clientY - svgRect.top < evAreaH) {
      _evTouchY = t0.clientY;
    } else {
      _evTouchY = null;
    }
  }, { passive: true });

  svgEl.on('touchmove.evscroll', function(event) {
    if (_evTouchY === null) return;
    const t0 = event.touches[0];
    const dy = _evTouchY - t0.clientY;
    _evTouchY = t0.clientY;
    const totalEvH  = evTotalLanes * EV_LANE_H;
    const maxScroll = Math.max(0, totalEvH - evAreaH);
    evScrollY = Math.max(0, Math.min(evScrollY + dy, maxScroll));
    redrawFixed();
  }, { passive: true });

}

/* ========================================================
   HORIZONTAL-ONLY ZOOM
   cx: SVG左端からのスクリーンX座標（ズームの中心）
   ======================================================== */
function zoomXBy(factor, cx) {
  const oldKX = kXExtra;
  const newKX = Math.max(0.1, Math.min(50, oldKX * factor));

  // cx を固定点として curT.x を調整
  // 変換前: px = NAME_W + curT.x + xScale(data) * curT.k * oldKX
  // 変換後: px = NAME_W + newTx + xScale(data) * curT.k * newKX
  // → newTx = curT.x + (cx - NAME_W) * (1 - newKX / oldKX)
  const chartX = cx - NAME_W;
  const newTx  = curT.x + chartX * (1 - newKX / oldKX);

  // 横方向クランプ
  const minX      = Math.min(0, curChartW - curChartW * curT.k * newKX);
  const clampedX  = Math.max(minX, Math.min(0, newTx));

  kXExtra = newKX;

  // curT.x のみ更新（k と y は維持）
  curT = d3.zoomIdentity.translate(clampedX / curT.k, curT.y / curT.k).scale(curT.k);
  svgEl.call(zoomBehavior.transform, curT);

  // バーテキストの横伸びを補正（data-x を元に x と transform を更新）
  svgEl.selectAll('.bar-text').each(function() {
    const el = d3.select(this);
    const dx = +el.attr('data-x');
    el.attr('x', dx * kXExtra)
      .attr('transform', `scale(${1 / kXExtra},1)`);
  });
  // 家歴の記号（▲✕●◆■★）の横伸びを補正
  svgEl.selectAll('.rec-mk').each(function() {
    const el = d3.select(this);
    el.attr('transform', `translate(${el.attr('data-x')},${el.attr('data-cy')}) scale(${1 / kXExtra},1)`);
  });
  // 生年・没年ドットの横伸びを補正（data-cx を元に cx と transform を更新）
  svgEl.selectAll('.bar-dot').each(function() {
    const el = d3.select(this);
    const dcx = +el.attr('data-cx');
    el.attr('cx', dcx * kXExtra)
      .attr('transform', `scale(${1 / kXExtra},1)`);
  });
}

/* Apply transform to the content group
   X軸は t.k * kXExtra でスケール、Y軸は t.k のみ（横ズーム対応） */
function applyContentTransform(sel, t) {
  sel.attr('transform',
    `translate(${NAME_W + t.x},${HDR_H + t.y}) scale(${t.k * kXExtra},${t.k})`
  );
}

/* ── Draw bars, events, grid ── */
function drawBars(cg, ds, yMin, yMax, chartW, chartH) {
  const totalDataH = curPersons.length * ROW_H;

  /* Vertical grid lines */
  const span = yMax - yMin;
  let gStep;
  if (ds.monthly) {
    // 月単位データセットは細かい縦罫線を許可（span が小さい時は半年/年単位）
    gStep = span > 100 ? 10 : span > 40 ? 5 : span > 15 ? 1 : 0.5;
  } else {
    gStep = span > 300 ? 50 : span > 100 ? 10 : 5;
  }
  for (let y = Math.ceil(yMin / gStep) * gStep; y <= yMax; y += gStep) {
    cg.append('line')
      .attr('x1', xScale(y)).attr('y1', 0)
      .attr('x2', xScale(y)).attr('y2', totalDataH)
      .attr('stroke', cv('--chart-grid')).attr('stroke-width', 1);
  }

  /* Event lines — vertical dashed lines through the row area only
     (labels are drawn in the fixed header by drawAxisPanel)       */
  const ttEl = document.getElementById('tooltip');
  ds.events.forEach(ev => {
    const x = xScale(ev.year);
    cg.append('line')
      .attr('x1', x).attr('y1', 0)
      .attr('x2', x).attr('y2', totalDataH)
      .attr('stroke', cv('--chart-ev-line')).attr('stroke-width', 0.8)
      .attr('stroke-dasharray', '3,3').attr('opacity', 0.6);
  });

  /* 現在の縦線（家歴） */
  if (ds.kind === 'home' && NOW_DY > yMin && NOW_DY < yMax) {
    cg.append('line')
      .attr('x1', xScale(NOW_DY)).attr('y1', 0)
      .attr('x2', xScale(NOW_DY)).attr('y2', totalDataH)
      .attr('stroke', '#ff9f43').attr('stroke-width', 1.4)
      .attr('vector-effect', 'non-scaling-stroke').attr('opacity', 0.85)
      .attr('pointer-events', 'none');
  }

  /* ── Person rows ── */
  const cats = DATASETS[currentKey].categories;
  curPersons.forEach((p, i) => {
    const color = cats[p.cat] || '#888';
    const x1 = xScale(p.birth);
    const x2 = xScale(p.death);
    const barW = x2 - x1;
    const cy  = i * ROW_H + ROW_H / 2;   // row center y in data coords

    /* Category group separator line */
    if (groupStarts.has(i) && i > 0) {
      cg.append('line')
        .attr('x1', xScale(yMin) - 5).attr('y1', i * ROW_H)
        .attr('x2', xScale(yMax) + 5).attr('y2', i * ROW_H)
        .attr('stroke', color).attr('stroke-width', 0.8).attr('opacity', 0.35);
    }

    /* Row stripe */
    if (i % 2 === 0) {
      cg.append('rect')
        .attr('x', xScale(yMin) - 5).attr('y', i * ROW_H)
        .attr('width', xScale(yMax) - xScale(yMin) + 10)
        .attr('height', ROW_H)
        .attr('fill', cv('--chart-stripe'));
    }

    /* 家歴：専用の行描画（バー・記号・履歴） */
    if (ds.kind === 'home') { drawHomeRow(cg, ds, p, i, color); return; }

    /* Glow shadow */
    cg.append('rect')
      .attr('x', x1).attr('y', cy - 8).attr('width', barW).attr('height', 16)
      .attr('fill', color).attr('rx', 3).attr('opacity', 0.1);

    /* Main bar — dashed outline when either date is uncertain */
    const bar = cg.append('rect')
      .attr('x', x1).attr('y', cy - 6).attr('width', barW).attr('height', 12)
      .attr('fill', color).attr('rx', 3).attr('opacity', 0.82)
      .attr('cursor', 'pointer');
    if (p.birthUncertain || p.deathUncertain) {
      bar.attr('stroke', 'rgba(255,220,50,0.7)')
         .attr('stroke-width', 1).attr('stroke-dasharray', '3,2');
    }

    /* Birth dot (hollow if uncertain) */
    cg.append('circle')
      .attr('class', 'bar-dot').attr('data-cx', x1)
      .attr('cx', x1 * kXExtra).attr('cy', cy).attr('r', 3)
      .attr('transform', `scale(${1 / kXExtra},1)`)
      .attr('fill', p.birthUncertain ? 'none' : color)
      .attr('stroke', color).attr('stroke-width', p.birthUncertain ? 1.5 : 0);
    /* Death dot (hollow if uncertain) */
    cg.append('circle')
      .attr('class', 'bar-dot').attr('data-cx', x2)
      .attr('cx', x2 * kXExtra).attr('cy', cy).attr('r', 3)
      .attr('transform', `scale(${1 / kXExtra},1)`)
      .attr('fill', '#fff').attr('stroke', color).attr('stroke-width', 1.5);

    /* ? marks for uncertain birth / death */
    if (p.birthUncertain) {
      const _x = x1 - 3;
      cg.append('text')
        .attr('class', 'bar-text').attr('data-x', _x)
        .attr('x', _x * kXExtra).attr('y', cy + 3).attr('text-anchor', 'end')
        .attr('transform', `scale(${1 / kXExtra},1)`)
        .attr('fill', 'rgba(255,220,50,0.95)').attr('font-size', 9).attr('font-weight', 700)
        .attr('pointer-events', 'none').text('?');
    }
    if (p.deathUncertain) {
      const _x = x2 + 3;
      cg.append('text')
        .attr('class', 'bar-text').attr('data-x', _x)
        .attr('x', _x * kXExtra).attr('y', cy + 3).attr('text-anchor', 'start')
        .attr('transform', `scale(${1 / kXExtra},1)`)
        .attr('fill', 'rgba(255,220,50,0.95)').attr('font-size', 9).attr('font-weight', 700)
        .attr('pointer-events', 'none').text('?');
    }

    /* Year labels on bar — 月単位データセットは開始日付のみ表示 */
    if (barW > 18) {
      const _x = x1 + 3;
      cg.append('text')
        .attr('class', 'bar-text').attr('data-x', _x)
        .attr('x', _x * kXExtra).attr('y', cy + 3)
        .attr('transform', `scale(${1 / kXExtra},1)`)
        .attr('fill', 'rgba(255,255,255,0.45)').attr('font-size', 7)
        .attr('pointer-events', 'none')
        .text(p.birthUncertain ? '?' : fmtYear(p.birth));
    }
    if (!ds.monthly && barW > 28) {
      const _x = x2 - 3;
      cg.append('text')
        .attr('class', 'bar-text').attr('data-x', _x)
        .attr('x', _x * kXExtra).attr('y', cy + 3).attr('text-anchor', 'end')
        .attr('transform', `scale(${1 / kXExtra},1)`)
        .attr('fill', 'rgba(255,255,255,0.45)').attr('font-size', 7)
        .attr('pointer-events', 'none')
        .text(p.deathUncertain ? '?' : fmtYear(p.death));
    }
    /* Role label inside bar */
    if (p.title && barW > 55) {
      const _x = (x1 + x2) / 2;
      cg.append('text')
        .attr('class', 'bar-text').attr('data-x', _x)
        .attr('x', _x * kXExtra).attr('y', cy + 3).attr('text-anchor', 'middle')
        .attr('transform', `scale(${1 / kXExtra},1)`)
        .attr('fill', 'rgba(255,255,255,0.7)').attr('font-size', 8)
        .attr('pointer-events', 'none').text(p.title);
    }

    /* ── Serve period overlay bars ──
       Drawn on top of the main bar as narrower, brighter segments.
       p.serve: {role, start, end} or [{role, start, end}, ...]       */
    const serves = Array.isArray(p.serve) ? p.serve : (p.serve ? [p.serve] : []);
    // Colors per serve slot: golden-yellow, sky-blue, lime-green, orange
    const serveClrs = ['#ffe066', '#60cfff', '#7ef09a', '#ffaa55'];
    serves.forEach((sv, si) => {
      const sx1 = xScale(sv.start);
      const sx2 = xScale(sv.end + 1);
      const sw  = Math.max(0, sx2 - sx1);
      if (sw <= 0) return;
      const sc = serveClrs[si % serveClrs.length];
      /* Serve bar — 8 px tall, centered on row, drawn over main bar */
      cg.append('rect')
        .attr('x', sx1).attr('y', cy - 4).attr('width', sw).attr('height', 8)
        .attr('fill', sc).attr('rx', 2).attr('opacity', 0.88)
        .attr('pointer-events', 'none');
      /* Role label inside serve bar (dark text for contrast) */
      if (sw > 30 && sv.role) {
        const _x = (sx1 + sx2) / 2;
        cg.append('text')
          .attr('class', 'bar-text').attr('data-x', _x)
          .attr('x', _x * kXExtra).attr('y', cy + 3)
          .attr('text-anchor', 'middle')
          .attr('transform', `scale(${1 / kXExtra},1)`)
          .attr('fill', 'rgba(0,0,0,0.72)').attr('font-size', 7).attr('font-weight', 700)
          .attr('pointer-events', 'none').text(sv.role);
      }
    });

    /* Hover tooltip */
    bar
      .on('mouseover', function(event) {
        d3.select(this).attr('opacity', 1);
        const birthStr = (p.birthUncertain ? '?' : '') + fmtYear(p.birth) + (p.birthUncertain ? '頃' : '');
        const deathStr = (p.deathUncertain ? '?' : '') + fmtYear(p.death) + (p.deathUncertain ? '頃' : '');
        const ageNote  = (p.birthUncertain || p.deathUncertain) ? '（推定）' : '';
        const serveLines = serves.map(sv =>
          `<div class="tt-serve" style="border-left:3px solid ${serveClrs[serves.indexOf(sv) % serveClrs.length]};padding-left:5px;margin-top:3px">${sv.role}: ${fmtYear(sv.start)}〜${fmtYear(sv.end)}</div>`
        ).join('');
        ttEl.innerHTML =
          `<div class="tt-name">${p.name}${p.fictional ? ' <span class="tt-fic">(架空)</span>' : ''}${p.notInWork ? ' <span class="tt-fic">(作品未登場)</span>' : ''}</div>` +
          (p.title ? `<div class="tt-role">${p.title}</div>` : '') +
          `<div class="tt-years">${birthStr} 〜 ${deathStr}</div>` +
          `<div class="tt-age">${getLabel('lifespan', '享年', p.cat)} ${fmtAgeVal(p.death - p.birth)}${getLabel('age', '歳', p.cat)}${ageNote}</div>` +
          serveLines;
        ttEl.classList.add('show');
      })
      .on('mousemove', event => {
        placeTooltip(ttEl, event);
      })
      .on('mouseout', function() {
        d3.select(this).attr('opacity', 0.82);
        ttEl.classList.remove('show');
      });
  });

  /* ── 跡地リレー（バトンタッチ）コネクタ ──
     p.succeeds に前身施設名（文字列 or 配列）を指定すると、
     前身の終了点 → 後継の開業点を金色の破線でつなぎ、
     同じ敷地の世代交代を視覚化する。並び順・ズームに追従。          */
  const _rowOf = {};
  curPersons.forEach((pp, ii) => { _rowOf[pp.name] = ii; });
  curPersons.forEach((pp, ii) => {
    if (!pp.succeeds) return;
    const preds = Array.isArray(pp.succeeds) ? pp.succeeds : [pp.succeeds];
    preds.forEach(pn => {
      if (_rowOf[pn] === undefined) return;
      const pr = curPersons[_rowOf[pn]];
      const x1 = xScale(pr.death), y1 = _rowOf[pn] * ROW_H + ROW_H / 2;
      const x2 = xScale(pp.birth), y2 = ii * ROW_H + ROW_H / 2;
      const mx = (x1 + x2) / 2;
      cg.append('path')
        .attr('d', `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`)
        .attr('fill', 'none').attr('stroke', '#f1c40f').attr('stroke-width', 1.4)
        .attr('stroke-dasharray', '4,3').attr('opacity', 0.7)
        .attr('pointer-events', 'none');
      cg.append('circle')
        .attr('class', 'bar-dot').attr('data-cx', x2)
        .attr('cx', x2 * kXExtra).attr('cy', y2).attr('r', 3.5)
        .attr('transform', `scale(${1 / kXExtra},1)`)
        .attr('fill', '#f1c40f').attr('stroke', '#fff').attr('stroke-width', 1)
        .attr('pointer-events', 'none');
    });
  });
}


/* ========================================================
   HOME ROW — 家歴の1行（設備・部位）を描画
   ・実線バー：設置〜現在（廃棄済みなら〜廃棄）
   ・点線バー：現在〜対応年数（予定）
   ・赤バー  ：対応年数を超えて使用中の期間
   ・記号    ：▲購入・設置 ✕廃棄・交換 ●修繕 ◆リフォーム ■点検 ★契約
   ======================================================== */
function drawHomeGlyph(cg, ds, typeKey, x, cy, o) {
  o = o || {};
  const t = homeType(ds, typeKey);
  const g = cg.append('g')
    .attr('class', 'rec-mk').attr('data-x', x).attr('data-cy', cy)
    .attr('transform', `translate(${x},${cy}) scale(${1 / kXExtra},1)`)
    .attr('cursor', 'pointer');
  const hollow = !!o.planned;
  const stroke = o.overdue ? '#ff3b30' : (hollow ? t.color : '#fff');
  const path = g.append('path')
    .attr('d', homeSymbolPath(t, o.size || 70))
    .attr('fill', hollow ? cv('--chart-bg') : t.color)
    .attr('stroke', stroke)
    .attr('stroke-width', hollow ? 1.6 : 1)
    .attr('vector-effect', 'non-scaling-stroke');
  if (o.overdue) path.attr('stroke-dasharray', '2,1.5');
  if (t.sym === 'cross') path.attr('transform', 'rotate(45)');
  return g;
}

function drawHomeRow(cg, ds, p, i, color) {
  const ttEl = document.getElementById('tooltip');
  const cy   = i * ROW_H + ROW_H / 2;
  const xs   = xScale(p.birth);
  const xe   = xScale(p._solidEnd);
  const xp   = xScale(p.death);
  const xEndAll = Math.max(xe, xp);
  const wSolid  = Math.max(2, xe - xs);

  /* glow */
  cg.append('rect').attr('x', xs).attr('y', cy - 8).attr('width', Math.max(2, xEndAll - xs))
    .attr('height', 16).attr('fill', color).attr('rx', 3).attr('opacity', 0.08)
    .attr('pointer-events', 'none');

  /* 予定部分（現在〜対応年数／終了予定）：点線の枠 */
  if (p._state === 'active' && xp > xe + 0.5) {
    cg.append('rect').attr('x', xe).attr('y', cy - 6).attr('width', xp - xe).attr('height', 12)
      .attr('rx', 3).attr('fill', color).attr('opacity', 0.14)
      .attr('stroke', color).attr('stroke-width', 1).attr('stroke-dasharray', '4,3')
      .attr('vector-effect', 'non-scaling-stroke').attr('pointer-events', 'none');
  }

  /* 実績部分 */
  const bar = cg.append('rect').attr('x', xs).attr('y', cy - 6).attr('width', wSolid).attr('height', 12)
    .attr('fill', color).attr('rx', 3).attr('opacity', 0.82).attr('pointer-events', 'none');

  /* 対応年数を超過した期間 */
  if (p._overdue) {
    const xo = xScale(p._lifeEnd);
    cg.append('rect').attr('x', xo).attr('y', cy - 6).attr('width', Math.max(1, xe - xo)).attr('height', 12)
      .attr('rx', 2).attr('fill', '#ff3b30').attr('opacity', 0.9).attr('pointer-events', 'none');
  }

  /* 対応年数のマーカー（目標ライン）：廃棄前に寿命を迎えた／迎える位置を細い縦線で */
  if (p._lifeEnd != null && p._lifeEnd > p.birth && (p._state === 'active' || p._lifeEnd <= p.death)) {
    const xl = xScale(p._lifeEnd);
    cg.append('line').attr('x1', xl).attr('y1', cy - 9).attr('x2', xl).attr('y2', cy + 9)
      .attr('stroke', p._overdue ? '#ff3b30' : color).attr('stroke-width', 1.4)
      .attr('vector-effect', 'non-scaling-stroke').attr('opacity', 0.9)
      .attr('pointer-events', 'none');
  }

  /* ホバー用の透明な帯（行全体） */
  const hit = cg.append('rect').attr('x', xs - 4).attr('y', i * ROW_H + 1)
    .attr('width', Math.max(8, xEndAll - xs + 8)).attr('height', ROW_H - 2)
    .attr('fill', 'transparent').attr('cursor', 'pointer');

  /* 行末のサマリー文字列 */
  const elapsed = p._solidEnd - p.birth;
  let sum;
  if (p.resident && p.born != null) {
    sum = p._state === 'gone' ? `${Math.floor(p.death - p.born)}歳で死亡` : `${Math.floor(NOW_DY - p.born)}歳`;
  } else if (p._state === 'gone') {
    sum = fmtYrs(elapsed) + '使用';
  } else if (p.lifeYears != null && p._lifeEnd != null) {
    sum = p._overdue
      ? `${fmtYrs(elapsed)} ／ 目安${p.lifeYears}年を${fmtYrs(NOW_DY - p._lifeEnd)}超過`
      : `${fmtYrs(elapsed)} ／ 目安${p.lifeYears}年（残${fmtYrs(p._lifeEnd - NOW_DY)}）`;
  } else {
    sum = fmtYrs(elapsed);
  }
  const _tx = xEndAll + 8;
  cg.append('text').attr('class', 'bar-text').attr('data-x', _tx)
    .attr('x', _tx * kXExtra).attr('y', cy + 3.5)
    .attr('transform', `scale(${1 / kXExtra},1)`)
    .attr('fill', p._overdue ? '#ff6b5e' : cv('--text-muted')).attr('font-size', 8.5)
    .attr('font-weight', p._overdue ? 700 : 400)
    .attr('pointer-events', 'none').text(sum);

  /* 記号：購入・設置 ／ 廃棄・交換 */
  const gStart = drawHomeGlyph(cg, ds, p.startType || 'purchase', xs, cy, { size: 80 });
  let gEnd = null;
  if (p._state === 'gone') gEnd = drawHomeGlyph(cg, ds, p.endType || 'dispose', xScale(p.death), cy, { size: 90 });

  /* 履歴（修繕・点検・予定）の記号 */
  p.records.forEach(r => {
    const g = drawHomeGlyph(cg, ds, r.type, xScale(r.date), cy,
      { planned: r._planned, overdue: r._overdue, size: 62 });
    g.on('mouseover', function(event) {
        event.stopPropagation();
        ttEl.innerHTML = recordTooltipHTML(ds, p, r);
        ttEl.classList.add('show');
      })
      .on('mousemove', event => {
        placeTooltip(ttEl, event);
      })
      .on('mouseout', () => ttEl.classList.remove('show'));
  });
  [[gStart, 'start'], [gEnd, 'end']].forEach(([g, kind]) => {
    if (!g) return;
    g.on('mouseover', event => {
        ttEl.innerHTML = itemTooltipHTML(ds, p);
        ttEl.classList.add('show');
      })
      .on('mousemove', event => {
        placeTooltip(ttEl, event);
      })
      .on('mouseout', () => ttEl.classList.remove('show'));
  });

  /* 行ホバー：項目の詳細 */
  hit.on('mouseover', () => {
      bar.attr('opacity', 1);
      ttEl.innerHTML = itemTooltipHTML(ds, p);
      ttEl.classList.add('show');
    })
    .on('mousemove', event => {
      placeTooltip(ttEl, event);
    })
    .on('mouseout', () => { bar.attr('opacity', 0.82); ttEl.classList.remove('show'); });
}

function recordTooltipHTML(ds, p, r) {
  const t = homeType(ds, r.type);
  const state = r._overdue ? '<span class="tt-bad">実施時期を超過</span>'
              : r._planned ? '<span class="tt-plan">予定</span>' : '';
  return `<div class="tt-name"><span style="color:${t.color}">${t.ch}</span> ${r.name} ${state}</div>` +
    `<div class="tt-role">${p.name}（${t.label}）</div>` +
    `<div class="tt-years">${fmtYM(r.date)}${r.auto ? '（周期から自動算出）' : ''}</div>` +
    (r.cost != null ? `<div class="tt-age">費用 ${fmtYen(r.cost)}</div>` : '') +
    (r.vendor ? `<div class="tt-age">実施 ${r.vendor}</div>` : '') +
    (r.note ? `<div class="tt-note">${r.note}</div>` : '');
}

function itemTooltipHTML(ds, p) {
  const sl = p.startLabel || '購入・設置';
  const el = p.endLabel   || '廃棄・交換';
  const past = p.records.filter(r => !r._planned);
  const plan = p.records.filter(r => r._planned);
  const costSum = (p.cost || 0) + past.reduce((a, r) => a + (r.cost || 0), 0);
  const elapsed = p._solidEnd - p.birth;
  let life = '';
  if (p.lifeYears != null) {
    life = p._overdue
      ? `<div class="tt-age tt-bad">対応年数 ${p.lifeYears}年（${fmtYM(p._lifeEnd)}）を ${fmtYrs(NOW_DY - p._lifeEnd)} 超過</div>`
      : p._state === 'gone'
        ? `<div class="tt-age">対応年数 ${p.lifeYears}年（実使用 ${fmtYrs(elapsed)}）</div>`
        : `<div class="tt-age">対応年数 ${p.lifeYears}年（${fmtYM(p._lifeEnd)}まで・残 ${fmtYrs(p._lifeEnd - NOW_DY)}）</div>`;
  }
  const recLine = r => {
    const t = homeType(ds, r.type);
    return `<div class="tt-rec${r._overdue ? ' tt-bad' : ''}"><span style="color:${t.color}">${t.ch}</span> ` +
      `${fmtYM(r.date)} ${r.name}${r.cost != null ? '（' + fmtYen(r.cost) + '）' : ''}</div>`;
  };
  const MAXR = 8;
  const histHTML = past.length
    ? `<div class="tt-sec">履歴 ${past.length}件</div>` + past.slice(-MAXR).map(recLine).join('') +
      (past.length > MAXR ? `<div class="tt-age">…ほか ${past.length - MAXR} 件</div>` : '') : '';
  const planHTML = plan.length
    ? `<div class="tt-sec">予定</div>` + plan.slice(0, 3).map(recLine).join('') +
      (plan.length > 3 ? `<div class="tt-age">…ほか ${plan.length - 3} 件</div>` : '') : '';
  if (p.resident) {
    const ageEnd = p._state === 'gone' ? p.death : NOW_DY;
    const ageTxt = p.born != null
      ? `<div class="tt-age">${p._state === 'gone' ? '享年' : '年齢'} ${Math.floor(ageEnd - p.born)}歳（生年月 ${fmtYM(p.born)}）</div>` : '';
    return `<div class="tt-name">${p.name}</div>` +
      (p.title ? `<div class="tt-role">${p.title}</div>` : '') +
      `<div class="tt-years">${sl}: ${fmtYM(p.birth)}` +
        (p._state === 'gone' ? `<br>${p.endLabel || '死亡'}: ${fmtYM(p.death)}` : '<br>状態: 居住中') + `</div>` +
      ageTxt + histHTML + planHTML +
      (p.note ? `<div class="tt-note">${p.note}</div>` : '');
  }
  return `<div class="tt-name">${p.name}${p._attention ? ' <span class="tt-bad">要対応</span>' : ''}</div>` +
    (p.title ? `<div class="tt-role">${p.title}</div>` : '') +
    `<div class="tt-years">${sl}: ${fmtYM(p.birth)}` +
      (p._state === 'gone' ? `<br>${el}: ${fmtYM(p.death)}`
        : (p.death > NOW_DY + 0.01 && p.lifeYears == null ? `<br>終了予定: ${fmtYM(p.death)}` : '<br>状態: 使用中')) + `</div>` +
    `<div class="tt-age">${p._state === 'gone' ? '使用期間' : '経過'} ${fmtYrs(elapsed)}</div>` +
    life +
    (p.cost != null ? `<div class="tt-age">取得費用 ${fmtYen(p.cost)}${p.vendor ? '（' + p.vendor + '）' : ''}</div>`
                    : (p.vendor ? `<div class="tt-age">施工・販売 ${p.vendor}</div>` : '')) +
    (costSum > 0 ? `<div class="tt-age">費用の累計 ${fmtYen(costSum)}</div>` : '') +
    histHTML + planHTML +
    (p.note ? `<div class="tt-note">${p.note}</div>` : '');
}

/* ========================================================
   FIXED PANELS — redrawn on every zoom event
   ======================================================== */
function redrawFixed() {
  drawNamesPanel();
  drawAxisPanel();
}

/* ── Fixed names column (left) ──
   Person at row i has screen_y = HDR_H + curT.y + (i*ROW_H + ROW_H/2) * curT.k  */
function drawNamesPanel() {
  namesG.selectAll('*').remove();

  const W = +svgEl.attr('width');
  const H = +svgEl.attr('height');
  const ds = DATASETS[currentKey];

  /* Background */
  namesG.append('rect')
    .attr('width', NAME_W).attr('height', H).attr('fill', cv('--chart-panel'));

  const t = curT;

  /* ── Person rows ── */
  curPersons.forEach((p, i) => {
    const color = ds.categories[p.cat] || '#888';

    /* Screen y of this row's center */
    const sy = HDR_H + t.y + (i * ROW_H + ROW_H / 2) * t.k;
    if (sy < HDR_H - ROW_H || sy > H + ROW_H) return;  // out of view

    /* Stripe */
    if (i % 2 === 0) {
      namesG.append('rect')
        .attr('x', 0).attr('y', sy - (ROW_H * t.k) / 2)
        .attr('width', NAME_W - 1).attr('height', ROW_H * t.k)
        .attr('fill', cv('--chart-stripe'));
    }

    /* Color accent strip */
    namesG.append('rect')
      .attr('x', 0).attr('y', sy - 5).attr('width', 3).attr('height', 10)
      .attr('fill', color).attr('rx', 1);

    /* Category group header (top of each group in category-sort mode) */
    if (groupStarts.has(i)) {
      const topY = sy - (ROW_H * t.k) / 2;
      /* Colored top border */
      namesG.append('line')
        .attr('x1', 0).attr('y1', topY).attr('x2', NAME_W).attr('y2', topY)
        .attr('stroke', color).attr('stroke-width', 1.5).attr('opacity', 0.5);
      /* Category label (only if there's enough height) */
      if (ROW_H * t.k > 20) {
        namesG.append('text')
          .attr('x', 6).attr('y', topY + Math.min(8, ROW_H * t.k * 0.3))
          .attr('dominant-baseline', 'middle')
          .attr('fill', color).attr('font-size', Math.min(8, 7 * t.k)).attr('opacity', 0.75)
          .text('◆ ' + p.cat);
      }
    }

    /* Name — centered in row; append (架空) tspan for fictional characters */
    const fsSz = Math.max(9, Math.min(13, 11 * t.k));
    const nameEl = namesG.append('text')
      .attr('x', NAME_W - 8).attr('y', sy)
      .attr('text-anchor', 'end').attr('dominant-baseline', 'middle')
      .attr('font-size', fsSz).attr('font-weight', 600)
      .attr('cursor', 'pointer');
    nameEl.append('tspan').attr('fill', color).text(p.name);
    if (p.fictional) {
      nameEl.append('tspan')
        .attr('fill', 'rgba(190,140,255,0.85)')
        .attr('font-size', Math.max(6, fsSz * 0.7))
        .attr('font-weight', 400)
        .text('(架空)');
    }
    if (p._attention) {
      nameEl.append('tspan')
        .attr('fill', '#ff9f43')
        .attr('font-size', Math.max(6, fsSz * 0.7))
        .attr('font-weight', 700)
        .text('(要対応)');
    }
    if (p.notInWork) {
      nameEl.append('tspan')
        .attr('fill', 'rgba(150,150,150,0.9)')
        .attr('font-size', Math.max(6, fsSz * 0.7))
        .attr('font-weight', 400)
        .text('(未登場)');
    }
  });

  /* Right border */
  namesG.append('line')
    .attr('x1', NAME_W).attr('y1', HDR_H)
    .attr('x2', NAME_W).attr('y2', H)
    .attr('stroke', cv('--border')).attr('stroke-width', 1);
}

/* ── Fixed year axis + emperor labels (top) ──
   Year y has screen_x = NAME_W + curT.x + xScale(y) * curT.k  */
function drawAxisPanel() {
  axisG.selectAll('*').remove();

  const W  = +svgEl.attr('width');
  const ds = DATASETS[currentKey];
  const chartW = W - NAME_W;
  const t = curT;

  /* ── Background ── */
  axisG.append('rect')
    .attr('x', NAME_W).attr('width', chartW).attr('height', HDR_H)
    .attr('fill', cv('--chart-panel'));

  /* ── Event lanes (horizontal labels, staggered + scrollable) ── */
  const evAreaTop    = 0;
  const evAreaBottom = HDR_H - EV_TICK_H;  // visible height of event area
  const evFontSize   = Math.min(16, Math.max(11, EV_BASE_FONT * t.k));

  // Compute screen x for each event (use all events for correct lane assignment)
  const evItemsAll = ds.events.map(ev => {
    const sx   = NAME_W + t.x + xScale(ev.year) * t.k * kXExtra;
    const isPlan = ds.kind === 'home' && ev.year > NOW_DY + 0.01;
    const text = fmtYM(ev.year) + ' ' + ev.name + (isPlan ? '（予定）' : '');
    return { ev, sx, text, w: evLabelW(text, evFontSize) };
  });
  evItemsAll.sort((a, b) => a.sx - b.sx);

  // Greedy lane assignment (all events, not just visible ones)
  const laneRights = [];
  for (const item of evItemsAll) {
    const leftEdge = item.sx - item.w / 2 - 5;
    let lane = laneRights.findIndex(r => leftEdge >= r);
    if (lane === -1) { lane = laneRights.length; laneRights.push(0); }
    laneRights[lane] = item.sx + item.w / 2;
    item.lane = lane;
  }
  evTotalLanes = Math.max(1, laneRights.length);

  // ラベルのヒット範囲を保存（ズームの end ハンドラーが参照）
  evHitItems = evItemsAll.map(item => ({
    sx: item.sx, w: item.w, evYear: item.ev.year
  }));

  // Clamp evScrollY
  const totalEvH  = evTotalLanes * EV_LANE_H;
  const maxScroll = Math.max(0, totalEvH - evAreaBottom);
  evScrollY = Math.max(0, Math.min(evScrollY, maxScroll));

  // Clip group for event labels
  const evG = axisG.append('g').attr('clip-path', 'url(#clip-ev)');

  // Draw only visible events (within viewport x and scrolled y range)
  const evItems = evItemsAll.filter(
    item => item.sx + item.w / 2 >= NAME_W && item.sx - item.w / 2 <= W
  );

  for (const item of evItems) {
    const centerY = evAreaTop + (item.lane + 0.5) * EV_LANE_H - evScrollY;

    // Thin vertical connector (clipped)
    if (centerY + evFontSize * 0.65 < evAreaBottom) {
      evG.append('line')
        .attr('x1', item.sx).attr('y1', centerY + evFontSize * 0.65)
        .attr('x2', item.sx).attr('y2', evAreaBottom)
        .attr('stroke', cv('--chart-ev-line'))
        .attr('stroke-width', 0.8).attr('opacity', 0.45);
    }

    // Downward-pointing triangle
    const ty = evAreaBottom;
    axisG.append('polygon')
      .attr('points', `${item.sx-4},${ty} ${item.sx+4},${ty} ${item.sx},${ty+6}`)
      .attr('fill', cv('--chart-ev-line')).attr('opacity', 0.85);

    // Event label (clipped)
    const isSelected = selectedYear === item.ev.year;
    evG.append('text')
      .attr('x', item.sx).attr('y', centerY)
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
      .attr('fill', isSelected ? cv('--accent') : cv('--chart-ev-text'))
      .attr('font-size', evFontSize).attr('font-weight', isSelected ? 700 : 500)
      .attr('cursor', 'pointer')
      .text(item.text);
  }

  // Mini scrollbar (if event content overflows)
  if (maxScroll > 0) {
    const sbW = 3, sbX = W - sbW - 2;
    const thumbH  = Math.max(16, evAreaBottom * (evAreaBottom / totalEvH));
    const thumbTop = (evScrollY / totalEvH) * evAreaBottom;
    axisG.append('rect')   // track
      .attr('x', sbX).attr('y', 0)
      .attr('width', sbW).attr('height', evAreaBottom)
      .attr('fill', cv('--border')).attr('rx', sbW / 2).attr('opacity', 0.5);
    axisG.append('rect')   // thumb
      .attr('x', sbX).attr('y', thumbTop)
      .attr('width', sbW).attr('height', thumbH)
      .attr('fill', cv('--text-muted')).attr('rx', sbW / 2).attr('opacity', 0.8);
  }

  /* ── Year ticks (bottom strip of header) ── */
  const x0 = xScale.invert(-t.x / (t.k * kXExtra));
  const x1 = xScale.invert((chartW - t.x) / (t.k * kXExtra));
  const span = x1 - x0;
  let step;
  if (ds.monthly) {
    // 月単位データセットは span に応じて 0.25年(=3ヶ月) まで段階的に細かく
    if      (span > 100) step = 20;
    else if (span > 40)  step = 10;
    else if (span > 20)  step = 5;
    else if (span > 8)   step = 2;
    else if (span > 3)   step = 1;
    else if (span > 1.5) step = 0.5;
    else                 step = 0.25;
  } else {
    step = span > 500 ? 100 : span > 200 ? 50 : span > 80 ? 20 : span > 35 ? 10 : 5;
  }

  for (let yr = Math.ceil(x0 / step) * step; yr <= x1; yr += step) {
    const sx = NAME_W + t.x + xScale(yr) * t.k * kXExtra;
    if (sx < NAME_W || sx > W) continue;
    axisG.append('line')
      .attr('x1', sx).attr('y1', HDR_H)
      .attr('x2', sx).attr('y2', HDR_H - 6)
      .attr('stroke', cv('--border-lite')).attr('stroke-width', 1);
    axisG.append('text')
      .attr('x', sx).attr('y', HDR_H - 8)
      .attr('text-anchor', 'middle').attr('fill', cv('--chart-yr-text')).attr('font-size', 10)
      .attr('cursor', 'pointer')
      .text(fmtYear(yr));
  }

  /* ── 現在（家歴）：ヘッダーに目印 ── */
  if (ds.kind === 'home') {
    const nx = NAME_W + t.x + xScale(NOW_DY) * t.k * kXExtra;
    if (nx >= NAME_W && nx <= W) {
      axisG.append('line').attr('x1', nx).attr('y1', 0).attr('x2', nx).attr('y2', HDR_H)
        .attr('stroke', '#ff9f43').attr('stroke-width', 1.2).attr('opacity', 0.6)
        .attr('pointer-events', 'none');
      axisG.append('rect').attr('x', nx - 14).attr('y', HDR_H - 19).attr('width', 28).attr('height', 12)
        .attr('rx', 3).attr('fill', '#ff9f43').attr('opacity', 0.95).attr('cursor', 'pointer');
      axisG.append('text').attr('x', nx).attr('y', HDR_H - 13)
        .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
        .attr('fill', '#1a1d2e').attr('font-size', 8.5).attr('font-weight', 700)
        .attr('pointer-events', 'none').text('現在');
    }
  }

  /* ── Selected year: vertical line through header + chart ── */
  if (selectedYear !== null) {
    const H  = +svgEl.attr('height');
    const sx = NAME_W + t.x + xScale(selectedYear) * t.k * kXExtra;
    if (sx >= NAME_W && sx <= W) {
      // Line through chart body
      axisG.append('line')
        .attr('x1', sx).attr('y1', HDR_H)
        .attr('x2', sx).attr('y2', H)
        .attr('stroke', cv('--accent')).attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '5,3').attr('opacity', 0.65)
        .attr('pointer-events', 'none');
      // Line through header
      axisG.append('line')
        .attr('x1', sx).attr('y1', 0)
        .attr('x2', sx).attr('y2', HDR_H)
        .attr('stroke', cv('--accent')).attr('stroke-width', 1.5)
        .attr('opacity', 0.4).attr('pointer-events', 'none');
      // Year label pill in header
      const yr = fmtYM(selectedYear);
      const pillW = yr.length * 7.5 + 10;
      const pillX = Math.min(W - pillW / 2 - 4, Math.max(NAME_W + pillW / 2 + 4, sx));
      axisG.append('rect')
        .attr('x', pillX - pillW / 2).attr('y', HDR_H - 18)
        .attr('width', pillW).attr('height', 14)
        .attr('fill', cv('--accent')).attr('rx', 3).attr('opacity', 0.9);
      axisG.append('text')
        .attr('x', pillX).attr('y', HDR_H - 7)
        .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
        .attr('fill', '#fff').attr('font-size', 9).attr('font-weight', 700)
        .attr('pointer-events', 'none').text(yr);
    }
  }

  /* ── Bottom border ── */
  axisG.append('line')
    .attr('x1', 0).attr('y1', HDR_H)
    .attr('x2', W).attr('y2', HDR_H)
    .attr('stroke', cv('--border')).attr('stroke-width', 1);
}

/* ========================================================
   ZOOM CONTROLS
   ======================================================== */
function zoomIn()    { zoomXBy(1.6,   NAME_W + curChartW / 2); }  // 横軸のみ拡大
function zoomOut()   { zoomXBy(0.625, NAME_W + curChartW / 2); } // 横軸のみ縮小
function resetZoom() {
  kXExtra = 1.0;                     // 横軸の追加拡大率もリセット
  svgEl.transition().duration(350).call(zoomBehavior.transform, d3.zoomIdentity);
}

/* ========================================================
   ADD DATASET MODAL
   ======================================================== */
function openAddModal() {
  document.getElementById('modal-bg').classList.remove('hidden');
  document.getElementById('modal-body').innerHTML = `
    <div class="form-grp"><label>家歴の名前</label><input id="ds-name" placeholder="例: ○○邸（木造2階建て）"></div>
    <div class="form-grp"><label>期間（表示用）</label><input id="ds-period" placeholder="例: 2013年4月〜現在"></div>
    <div class="form-grp">
      <label>データ（JSON形式・日付は "YYYY-MM"）</label>
      <textarea id="ds-json">{
  "categories": {"設備": "#c0392b", "外装": "#2471a3"},
  "persons": [
    {"name": "給湯器", "title": "ガス給湯器 24号", "birth": "2013-04", "lifeYears": 10,
     "cat": "設備", "cost": 180000,
     "records": [{"date": "2019-12", "type": "repair", "name": "部品交換", "cost": 28000}],
     "cycleYears": 5, "cycleType": "inspect", "cycleName": "点検"}
  ],
  "events": [{"year": "2013-04", "name": "入居"}]
}</textarea>
    </div>
    <div class="hint">
      <b>persons</b>: name, title, birth（取得・設置）, death（廃棄・交換。省略＝使用中）, lifeYears（対応年数）, cat, cost, vendor, note<br>
      <b>records</b>: date, type（repair / reform / inspect / warranty）, name, cost, planned<br>
      <b>cycleYears</b>: 周期メンテナンスの予定を自動生成 ｜ <b>events</b>: year, name
    </div>`;
  document.getElementById('modal-foot').innerHTML =
    `<button class="tbtn" onclick="closeModal()">キャンセル</button>
     <button class="tbtn" style="background:#5b7fff;color:#fff;border-color:#5b7fff" onclick="addDataset()">追加</button>`;
}

function addDataset() {
  try {
    const name   = document.getElementById('ds-name').value.trim();
    const period = document.getElementById('ds-period').value.trim();
    const data   = JSON.parse(document.getElementById('ds-json').value);
    if (!name) { alert('家歴の名前を入力してください'); return; }
    const key = 'custom_' + Date.now();
    DATASETS[key] = {
      kind: 'home', monthly: true, unit: '項目',
      labels: { age: '年', lifespan: '使用期間', agePanel: 'その時点の経過年数' },
      name, period,
      categories:  data.categories  || { "その他": "#95a5a6" },
      persons:     data.persons      || [],
      events:      data.events       || [],
      recordTypes: data.recordTypes,
      horizonYears: data.horizonYears,
      emperors: [], retired: [],
    };
    currentKey = key; visibleCats = {};
    renderSidebar(); loadDataset(key); closeModal();
  } catch (e) {
    alert('JSONの形式が正しくありません:\n' + e.message);
  }
}

function closeModal() {
  document.getElementById('modal-bg').classList.add('hidden');
}

/* ── ヘルプモーダル ── */
function openHelpModal() {
  document.getElementById('modal-body').innerHTML = `
    <div class="help-modal">
      <div class="help-section">
        <div class="help-section-title">🏠 見かた</div>
        <table class="help-table">
          <tr><td>1行＝1項目</td><td>設備・部位・契約など。左端が購入・設置（▲）、実線が現在まで、点線が対応年数までの予定</td></tr>
          <tr><td>▲ / ✕</td><td>購入・設置 / 廃棄・交換（交換前後は金色の破線でつながる）</td></tr>
          <tr><td>● ◆ ■ ★</td><td>修繕 / 増改築・リフォーム / 点検・メンテナンス / 契約・保証・保険</td></tr>
          <tr><td>中抜きの記号</td><td>メンテナンス予定。赤い破線の縁は実施時期を超過</td></tr>
          <tr><td>赤いバー</td><td>対応年数を超えて使用中の期間（名前に「要対応」が付く）</td></tr>
          <tr><td>オレンジの縦線</td><td>現在</td></tr>
        </table>
      </div>
      <div class="help-section">
        <div class="help-section-title">🖱️ マウス操作</div>
        <table class="help-table">
          <tr><td>ホイール</td><td>縦スクロール</td></tr>
          <tr><td>Shift + ホイール</td><td>横スクロール</td></tr>
          <tr><td>Ctrl + ホイール</td><td>全体ズーム（ピンチ相当）</td></tr>
          <tr><td>ドラッグ</td><td>パン（移動）</td></tr>
          <tr><td>バー・記号にホバー</td><td>取得費用、対応年数、履歴、予定を表示</td></tr>
          <tr><td>グラフをクリック</td><td>その月を選択し、経過年数パネルを開く</td></tr>
        </table>
      </div>
      <div class="help-section">
        <div class="help-section-title">⌨️ キーボードショートカット</div>
        <table class="help-table">
          <tr><td><kbd>+</kbd> / <kbd>=</kbd></td><td>横軸のみ拡大</td></tr>
          <tr><td><kbd>-</kbd></td><td>横軸のみ縮小</td></tr>
          <tr><td><kbd>0</kbd></td><td>ズームリセット</td></tr>
          <tr><td><kbd>←</kbd> <kbd>→</kbd></td><td>選択月を1か月移動（画面端で自動スクロール）</td></tr>
          <tr><td><kbd>↑</kbd> <kbd>↓</kbd></td><td>縦スクロール（3行分）</td></tr>
          <tr><td><kbd>Space</kbd></td><td>押している間、選択月に存在する項目のみ表示</td></tr>
          <tr><td><kbd>F</kbd></td><td>フォーカスモード切り替え</td></tr>
          <tr><td><kbd>H</kbd></td><td>このヘルプを表示</td></tr>
          <tr><td><kbd>Esc</kbd></td><td>パネル・モーダルを閉じる</td></tr>
        </table>
      </div>
      <div class="help-section">
        <div class="help-section-title">📋 データ</div>
        <table class="help-table">
          <tr><td>URLハッシュ</td><td><code>index.html#sample_house</code> で家歴を直接指定</td></tr>
          <tr><td>区分フィルター</td><td>サイドバー下部のチェックボックスで絞り込み</td></tr>
          <tr><td>並び替え</td><td>ツールバーの「取得順 / 区分別」で切り替え</td></tr>
        </table>
      </div>
    </div>`;
  document.getElementById('modal-foot').innerHTML =
    `<button class="tbtn" onclick="closeModal()">閉じる</button>`;
  document.getElementById('modal-bg').classList.remove('hidden');
}

/* ========================================================
   SCROLL YEAR INTO VIEW
   選択年の縦線が画面端に近づいたとき、自動スクロールして追従させる
   ======================================================== */
function scrollYearIntoView(year) {
  const margin = 80;  // 画面端からのマージン（px）
  const sx = NAME_W + curT.x + xScale(year) * curT.k * kXExtra;
  const rightEdge = NAME_W + curChartW;

  let newX = curT.x;
  if (sx < NAME_W + margin) {
    // 左端に近い → 右にスクロール
    newX = margin - xScale(year) * curT.k * kXExtra;
  } else if (sx > rightEdge - margin) {
    // 右端に近い → 左にスクロール
    newX = (curChartW - margin) - xScale(year) * curT.k * kXExtra;
  }

  if (newX === curT.x) return;

  const minX     = Math.min(0, curChartW - curChartW * curT.k * kXExtra);
  const clampedX = Math.max(minX, Math.min(0, newX));
  curT = d3.zoomIdentity.translate(clampedX / curT.k, curT.y / curT.k).scale(curT.k);
  svgEl.call(zoomBehavior.transform, curT);
}

/* ========================================================
   KEYBOARD SHORTCUTS
   ======================================================== */
document.addEventListener('keydown', e => {
  if (e.target.matches('input, textarea')) return;
  // スペースキー：選択年に生存している人物のみ表示（押している間）
  // フォーカスモード中はSpaceでトグル解除
  if (e.key === ' ') {
    e.preventDefault();
    if (focusMode) { toggleFocus(); return; }
    if (selectedYear === null) return;
    if (!spacePressed) { spacePressed = true; buildChart(); }
    return;
  }
  // Fキー：フォーカスモードのトグル
  if (e.key === 'f' || e.key === 'F') { toggleFocus(); return; }
  if (e.key === 'Escape') closeModal();
  if (e.key === 'h' || e.key === 'H') { openHelpModal(); return; }
  if (e.key === '+' || e.key === '=') zoomIn();
  if (e.key === '-') zoomOut();
  if (e.key === '0') resetZoom();
  // Shift+左右矢印 → 横軸のみ拡大縮小（ビューポート中央基準）
  if (e.key === 'ArrowRight' && e.shiftKey) { zoomXBy(1.2, NAME_W + curChartW / 2); return; }
  if (e.key === 'ArrowLeft'  && e.shiftKey) { zoomXBy(1 / 1.2, NAME_W + curChartW / 2); return; }
  // 左右矢印（Shiftなし）→ 選択年を1年（月単位データセットでは1ヶ月）移動 + 画面端で自動スクロール
  if (e.key === 'ArrowRight' && !e.shiftKey && selectedYear !== null) {
    selectYear(DATASETS[currentKey].monthly ? shiftMonths(selectedYear, +1) : selectedYear + 1);
    scrollYearIntoView(selectedYear);
  }
  if (e.key === 'ArrowLeft' && !e.shiftKey && selectedYear !== null) {
    selectYear(DATASETS[currentKey].monthly ? shiftMonths(selectedYear, -1) : selectedYear - 1);
    scrollYearIntoView(selectedYear);
  }
  // 上下矢印 → 縦スクロール（3行分）
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const step  = ROW_H * 3;   // データ座標で3行分
    const dy    = e.key === 'ArrowDown' ? -step : step;
    let newT    = curT.translate(0, dy);
    const minY  = Math.min(0, curChartH - curTotalDataH * newT.k);
    const clampedY = Math.max(minY, Math.min(0, newT.y));
    if (clampedY !== newT.y) {
      newT = d3.zoomIdentity.translate(newT.x / newT.k, clampedY / newT.k).scale(newT.k);
    }
    svgEl.call(zoomBehavior.transform, newT);
  }
});

document.addEventListener('keyup', e => {
  if (e.target.matches('input, textarea')) return;
  // フォーカスモード中はSpaceを離しても絞り込みを維持
  if (e.key === ' ' && spacePressed && !focusMode) { spacePressed = false; buildChart(); }
});

/* フォーカスモード：選択年に生存している人物のみ表示（持続的） */
function toggleFocus() {
  focusMode = !focusMode;
  const btn = document.getElementById('focus-btn');
  if (btn) btn.classList.toggle('tbtn-active', focusMode);
  buildChart();
}

window.addEventListener('resize', buildChart);

// ブラウザの戻る / 進む、または直接 URL を開いた時にデータセットを切り替える
window.addEventListener('hashchange', () => {
  try {
    const key = location.hash.slice(1);
    if (key && DATASETS[key] && key !== currentKey) loadDataset(key);
  } catch (e) { /* file:// 環境では無視 */ }
});

/* ========================================================
   BOOT
   ======================================================== */
applyTheme(currentTheme);   // apply saved theme (dark/light) before first render
renderSidebar();
// URL ハッシュにデータセットキーが指定されていればそちらを優先
// file:// プロトコルでは location.hash が空になる場合があるため try-catch で保護
let _initKey = '';
try { _initKey = location.hash.slice(1); } catch (e) {}
loadDataset((_initKey && DATASETS[_initKey]) ? _initKey : currentKey);
