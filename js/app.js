/* ═══════════════════ PRO STOCKS — Application ═══════════════════ */
'use strict';

/* ---------- Utilities ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/* Chart repaint registry (responsive re-render) */
let paintQueue = [];
const globalPaints = [];
function onPaint(fn, global = false) { (global ? globalPaints : paintQueue).push(fn); }
function repaintAll() { [...globalPaints, ...paintQueue].forEach((fn) => { try { fn(); } catch (e) { /* noop */ } }); }
window.addEventListener('resize', debounce(repaintAll, 180));

/* ---------- Toasts ---------- */
function toast(title, msg = '', type = 'success') {
  const box = $('#toasts');
  const icons = { success: ['✓', 'rgba(0,224,127,.15)', '#00E07F'], info: ['i', 'rgba(79,124,255,.15)', '#9DB4FF'], warn: ['!', 'rgba(255,190,60,.15)', '#FFC94D'] };
  const [ico, bg, fg] = icons[type] || icons.success;
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<div class="toast-ico" style="background:${bg};color:${fg}">${ico}</div>
    <div><p class="font-bold text-[13px]">${esc(title)}</p>${msg ? `<p class="text-[12px] text-slate-400 mt-0.5">${msg}</p>` : ''}</div>`;
  box.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 3400);
}

/* ---------- Watchlist store ---------- */
const store = {
  get(k, fb) { try { const v = localStorage.getItem('prostocks_' + k); return v ? JSON.parse(v) : fb; } catch { return fb; } },
  set(k, v) { try { localStorage.setItem('prostocks_' + k, JSON.stringify(v)); } catch { /* noop */ } },
};
let watchStocks = new Set(store.get('watchStocks', ['AAPL', 'NVDA', 'TSLA']));
let watchInvestors = new Set(store.get('watchInvestors', ['vincent-omondi']));
function saveWatch() {
  store.set('watchStocks', [...watchStocks]);
  store.set('watchInvestors', [...watchInvestors]);
  updateWatchBadge();
}
function updateWatchBadge() {
  const n = watchStocks.size + watchInvestors.size;
  const b = $('#nav-watch-count');
  b.textContent = n; b.classList.toggle('hidden', n === 0);
}

/* ---------- Shared bits ---------- */
const growthPill = (g) => g >= 0
  ? `<span class="pill pill-up">▲ ${fmtPct(g)}</span>`
  : `<span class="pill pill-down">▼ ${fmtPct(g)}</span>`;
const stockTag = (sym) => { const s = stockBySym(sym); return `<span class="stock-tag"><span class="stock-dot" style="background:${s.color}"></span>${sym}</span>`; };
const simBadge = `<span class="pill pill-flat" title="Simulated figure">SIM</span>`;

function investorRowHTML(inv, i) {
  return `<tr data-href="#/investor/${inv.id}">
    <td><div class="cell-investor"><span class="avatar avatar-sm" style="${avatarStyle(inv, i)}">${initials(inv.name)}</span>
      <div><div class="nm">${esc(inv.name)} ${inv.featured ? '<span class="pill" style="background:rgba(201,169,106,.18);color:#E3C878;font-size:9px;margin-left:4px">FEATURED</span>' : ''}</div>
      <div class="sub">${inv.months} mo • ${esc(inv.risk)}</div></div></div></td>
    <td class="num">${fmtKES(inv.initial)}</td>
    <td><div style="display:flex;gap:5px;flex-wrap:wrap">${inv.stocks.map(stockTag).join('')}</div></td>
    <td class="num">${fmtKES(inv.current)}</td>
    <td class="num ${inv.profit >= 0 ? 'up' : 'down'}">${inv.profit >= 0 ? '+' : ''}${fmtKES(inv.profit)}</td>
    <td>${growthPill(inv.growth)}</td>
  </tr>`;
}

function investorCardHTML(inv, i) {
  return `<a class="card card-hover inv-card" href="#/investor/${inv.id}">
    <div class="inv-top">
      <span class="avatar avatar-md" style="${avatarStyle(inv, i)}">${initials(inv.name)}</span>
      <div class="min-w-0"><div class="inv-name truncate">${esc(inv.name)}</div>
        <div class="inv-meta">${inv.months} months • ${esc(inv.risk)} ${inv.featured ? '• <span style="color:#E3C878;font-weight:800">FEATURED DEMO</span>' : ''}</div></div>
      <div class="ml-auto">${growthPill(inv.growth)}</div>
    </div>
    <div class="mt-3 flex gap-1.5 flex-wrap">${inv.stocks.map(stockTag).join('')}</div>
    <div class="inv-stats">
      <div class="inv-stat"><p>Invested</p><p>${fmtCompactKES(inv.initial)}</p></div>
      <div class="inv-stat"><p>Value</p><p>${fmtCompactKES(inv.current)}</p></div>
      <div class="inv-stat"><p>Profit</p><p class="${inv.profit >= 0 ? 'up' : 'down'}">${inv.profit >= 0 ? '+' : '−'}${fmtCompactKES(Math.abs(inv.profit))}</p></div>
    </div>
    <canvas data-spark="${inv.id}"></canvas>
  </a>`;
}

function hydrateSparks(root) {
  $$('[data-spark]', root).forEach((c) => {
    const inv = investorById(c.dataset.spark);
    if (!inv) return;
    const paint = () => drawSparkline(c, inv.history.filter((_, i) => i % 2 === 0), { height: 52 });
    paint(); onPaint(paint);
  });
  $$('[data-mspark]', root).forEach((c) => {
    const paint = () => drawSparkline(c, stockSpark(c.dataset.mspark), { height: 36 });
    paint(); onPaint(paint);
  });
}

function emptyState(icon, title, sub, action = '') {
  return `<div class="card"><div class="empty"><div class="empty-ico">${icon}</div>
    <p class="font-bold text-white text-[15px]">${title}</p><p class="text-[13px] mt-1.5">${sub}</p>
    <div class="mt-4">${action}</div></div></div>`;
}

function skeletonPage() {
  return `<div class="page-head"><div style="flex:1;min-width:220px"><div class="skel" style="height:30px;width:260px"></div>
    <div class="skel mt-2" style="height:14px;width:340px;max-width:70%"></div></div></div>
    <div class="grid gap-4" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
      ${'<div class="card card-pad"><div class="skel" style="height:12px;width:40%"></div><div class="skel mt-3" style="height:28px;width:70%"></div><div class="skel mt-3" style="height:12px;width:55%"></div></div>'.repeat(4)}
    </div>
    <div class="card card-pad mt-4"><div class="skel" style="height:240px"></div></div>`;
}

/* ================================================================
   PAGE: DASHBOARD
================================================================ */
function pageDashboard() {
  const s = platformStats();
  const featured = INVESTORS.filter((i) => i.featured);
  const top = [...INVESTORS].sort((a, b) => b.growth - a.growth).slice(0, 8);
  const mkt = ['AAPL', 'TSLA', 'MSFT', 'NVDA', 'AMZN', 'GOOGL'].map(stockBySym);
  const feed = activityFeed(6);
  const hist = platformHistory();
  const platGrowth = ((hist[hist.length - 1] - hist[0]) / hist[0]) * 100;

  // date labels for 90-day axis
  const labels = hist.map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (hist.length - 1 - i));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  return `
  <div class="page-head">
    <div>
      <h1 class="page-title">Dashboard <span class="pill pill-flat" style="font-size:10px;vertical-align:middle">SIMULATED</span></h1>
      <p class="page-sub">Institutional-grade overview of the <strong class="text-slate-200">simulated</strong> PRO STOCKS community • All figures fictional</p>
    </div>
    <div class="flex gap-2 flex-wrap">
      <a href="#/investors" class="btn-ghost btn-sm">Browse investors →</a>
      <a href="#/charts" class="btn-primary btn-sm">Open live terminal</a>
    </div>
  </div>

  <!-- Stat cards -->
  <div class="grid gap-3.5 sm:gap-4" style="grid-template-columns:repeat(auto-fit,minmax(210px,1fr))">
    <div class="card stat-card">
      <p class="stat-label">Total Simulated Investors</p>
      <p class="stat-value" id="st-investors">0</p>
      <p class="stat-sub"><span class="pill pill-up">▲ 12 this month</span> <span class="kbd-hint">simulated</span></p>
    </div>
    <div class="card stat-card">
      <p class="stat-label">Total Simulated Capital</p>
      <p class="stat-value" id="st-capital">—</p>
      <p class="stat-sub up">▲ Funded across ${s.totalInvestors} demo portfolios</p>
    </div>
    <div class="card stat-card">
      <p class="stat-label">Total Simulated Value</p>
      <p class="stat-value" id="st-value" style="color:var(--green)">—</p>
      <p class="stat-sub"><span class="pill pill-up">▲ ${fmtPct(((s.totalValue - s.totalCapital) / s.totalCapital) * 100)} unrealized</span></p>
    </div>
    <div class="card stat-card">
      <p class="stat-label">Average Simulated Growth</p>
      <p class="stat-value" id="st-growth">—</p>
      <p class="stat-sub text-slate-400">Mean return • fictional data ${simBadge}</p>
    </div>
  </div>

  <!-- Featured -->
  <div class="card-head mt-7"><h2 class="card-title">⭐ Featured Demo Investors</h2>
    <a href="#/investors" class="text-[12px] font-semibold" style="color:var(--green)">View all ${s.totalInvestors} →</a></div>
  <div class="featured-grid">
    ${featured.map((inv, i) => `
    <div class="card card-hover featured">
      <div class="flex items-start gap-4">
        <span class="avatar avatar-xl" style="${avatarStyle(inv, i)}">${initials(inv.name)}</span>
        <div class="min-w-0">
          <span class="featured-badge">★ FEATURED DEMO PROFILE</span>
          <h3 class="font-display text-[19px] font-bold mt-2 truncate">${esc(inv.name)}</h3>
          <div class="mt-1.5 flex gap-1.5 flex-wrap">${inv.stocks.map(stockTag).join('')}
            <span class="stock-tag" style="color:#FFD88A;border-color:rgba(255,190,60,.3)">SIMULATED</span></div>
        </div>
        <div class="ml-auto shrink-0">${growthPill(inv.growth)}</div>
      </div>
      <div class="grid grid-cols-3 gap-2.5 mt-4">
        <div class="fstat"><p>Invested</p><p>${fmtKES(inv.initial)}</p></div>
        <div class="fstat"><p>Sim. Value</p><p style="color:var(--green)">${fmtKES(inv.current)}</p></div>
        <div class="fstat"><p>Sim. Profit</p><p class="up">+${fmtKES(inv.profit)}</p></div>
      </div>
      <canvas data-spark="${inv.id}" style="height:64px"></canvas>
      <div class="flex gap-2 mt-3">
        <a href="#/investor/${inv.id}" class="btn-primary btn-sm" style="flex:1">View full profile</a>
        <button class="btn-ghost btn-sm" data-follow="${inv.id}">${watchInvestors.has(inv.id) ? '★ Following' : '☆ Follow'}</button>
      </div>
    </div>`).join('')}
  </div>

  <!-- Platform performance -->
  <div class="grid gap-4 mt-6" style="grid-template-columns:1fr">
    <div class="card card-pad">
      <div class="card-head"><h2 class="card-title">Platform Aggregate Performance <span class="q">— simulated community value, 90 days</span></h2>
        <span class="pill pill-up">▲ ${fmtPct(platGrowth)} <span class="opacity-70">SIM</span></span></div>
      <div class="chart-box"><canvas id="ch-platform" class="chart"></canvas><div id="ch-platform-tip" class="chart-tip"></div></div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
        <div class="fstat"><p>Start (sim.)</p><p>${fmtCompactKES(hist[0])}</p></div>
        <div class="fstat"><p>Current (sim.)</p><p>${fmtCompactKES(hist[hist.length - 1])}</p></div>
        <div class="fstat"><p>Sim. Gain</p><p class="up">+${fmtCompactKES(hist[hist.length - 1] - hist[0])}</p></div>
        <div class="fstat"><p>Portfolios</p><p>${s.totalInvestors}</p></div>
      </div>
    </div>
  </div>

  <!-- Market overview -->
  <div class="card-head mt-7"><h2 class="card-title">📊 Market Overview <span class="q">— reference quotes (illustrative)</span></h2>
    <a href="#/markets" class="text-[12px] font-semibold" style="color:var(--green)">All markets →</a></div>
  <div class="mkt-grid">
    ${mkt.map((m) => `
    <a class="card card-hover mkt-card" href="#/charts?symbol=${m.exchange}:${m.sym}">
      <div class="flex items-center justify-between gap-2">
        <div class="min-w-0"><div class="mkt-sym">${m.sym}</div><div class="mkt-name">${esc(m.name)}</div></div>
        <span class="stock-dot" style="background:${m.color};width:10px;height:10px"></span>
      </div>
      <div class="mkt-price">${fmtUSD(m.price)}</div>
      <div class="mt-1"><span class="pill ${m.change >= 0 ? 'pill-up' : 'pill-down'}">${m.change >= 0 ? '▲' : '▼'} ${fmtPct(m.change)}</span></div>
      <canvas data-mspark="${m.sym}"></canvas>
    </a>`).join('')}
  </div>

  <!-- Top performers + activity -->
  <div class="grid gap-4 mt-6 lg:grid-cols-5">
    <div class="card card-pad lg:col-span-3">
      <div class="card-head"><h2 class="card-title">🏆 Top Simulated Performers</h2>
        <a href="#/investors?sort=growth" class="text-[12px] font-semibold" style="color:var(--green)">Rankings →</a></div>
      <div class="table-wrap" style="border:none"><table class="data" style="min-width:560px">
        <thead><tr><th>#</th><th>Investor</th><th>Value (sim.)</th><th>Growth (sim.)</th></tr></thead>
        <tbody>${top.map((inv, i) => `<tr data-href="#/investor/${inv.id}">
          <td class="text-slate-500 font-bold">${i + 1}</td>
          <td><div class="cell-investor"><span class="avatar avatar-sm" style="${avatarStyle(inv, i)}">${initials(inv.name)}</span>
            <div class="nm">${esc(inv.name)}</div></div></td>
          <td class="num">${fmtKES(inv.current)}</td><td>${growthPill(inv.growth)}</td></tr>`).join('')}
        </tbody></table></div>
    </div>
    <div class="card card-pad lg:col-span-2">
      <div class="card-head"><h2 class="card-title"><span class="live-dot"></span> Live Demo Activity</h2></div>
      ${feed.map((a) => `<div class="act-item"><span class="notif-ico" style="background:${a.color}">${a.icon}</span>
        <div class="min-w-0"><p class="text-slate-300 leading-snug">${a.text}</p><p class="text-[11px] text-slate-500 mt-0.5">${a.time} • simulated</p></div></div>`).join('')}
    </div>
  </div>

  <div class="disclaimer mt-6"><strong>DEMO NOTICE —</strong> Every balance, return and ranking on this page is simulated for demonstration. Not real investments, not investment advice.</div>`;

  // after-mount
  queueMicrotask(() => {
    countUp($('#st-investors'), s.totalInvestors, (v) => Math.round(v).toString());
    countUp($('#st-capital'), s.totalCapital, (v) => fmtCompactKES(v));
    countUp($('#st-value'), s.totalValue, (v) => fmtCompactKES(v));
    countUp($('#st-growth'), s.avgGrowth, (v) => fmtPct(v));
    hydrateSparks($('#page'));
    const c = $('#ch-platform');
    if (c) {
      const paint = () => drawAreaChart(c, hist, {
        height: 260, xLabels: labels, yPrefix: '',
        format: (v) => fmtKES(Math.round(v)), tooltipEl: $('#ch-platform-tip'),
      });
      paint(); onPaint(paint);
    }
    bindFollowButtons($('#page'));
    bindRowLinks($('#page'));
  });
}

/* ================================================================
   PAGE: MARKETS
================================================================ */
function pageMarkets() {
  return `
  <div class="page-head">
    <div><h1 class="page-title">Markets</h1>
      <p class="page-sub">Reference quotes with illustrative intraday movement • Open the <a href="#/charts" class="font-semibold" style="color:var(--green)">live terminal</a> for full TradingView analytics</p></div>
    <a href="#/charts" class="btn-primary btn-sm">📈 Open TradingView terminal</a>
  </div>
  <div class="mkt-grid" style="grid-template-columns:repeat(auto-fill,minmax(190px,1fr))">
    ${STOCKS.map((m) => `
    <div class="card card-hover mkt-card">
      <div class="flex items-center justify-between gap-2">
        <div class="min-w-0"><div class="mkt-sym">${m.sym}</div><div class="mkt-name">${esc(m.name)}</div></div>
        <button class="icon-btn" style="width:30px;height:30px" data-watch-stock="${m.sym}" title="Toggle watchlist">${watchStocks.has(m.sym) ? '★' : '☆'}</button>
      </div>
      <div class="mkt-price">${fmtUSD(m.price)} <span class="text-[10px] text-slate-500 font-semibold">${m.exchange}</span></div>
      <div class="mt-1 flex gap-1.5 items-center flex-wrap">
        <span class="pill ${m.change >= 0 ? 'pill-up' : 'pill-down'}">${m.change >= 0 ? '▲' : '▼'} ${fmtPct(m.change)}</span>
        <span class="text-[10.5px] text-slate-500">${esc(m.sector)}</span>
      </div>
      <canvas data-mspark="${m.sym}"></canvas>
      <div class="flex gap-2 mt-2">
        <a class="btn-ghost btn-sm" style="flex:1" href="#/charts?symbol=${m.exchange}:${m.sym}">Analyze</a>
        <button class="btn-ghost btn-sm" data-buy="${m.sym}">Sim. Buy</button>
      </div>
    </div>`).join('')}
  </div>
  <div class="card card-pad mt-5">
    <div class="card-head"><h2 class="card-title">All Listed Reference Symbols</h2><span class="kbd-hint">Illustrative quotes • not tradeable here</span></div>
    <div class="table-wrap"><table class="data">
      <thead><tr><th>Symbol</th><th>Company</th><th>Exchange</th><th>Price</th><th>Day Change</th><th>Trend (sim.)</th><th></th></tr></thead>
      <tbody>${STOCKS.map((m) => `<tr>
        <td><div class="cell-investor"><span class="stock-dot" style="background:${m.color};width:10px;height:10px"></span><strong>${m.sym}</strong></div></td>
        <td>${esc(m.name)}</td><td class="text-slate-400">${m.exchange}</td>
        <td class="num">${fmtUSD(m.price)}</td>
        <td><span class="pill ${m.change >= 0 ? 'pill-up' : 'pill-down'}">${m.change >= 0 ? '+' : ''}${m.change.toFixed(2)}%</span></td>
        <td style="min-width:130px"><canvas data-mspark2="${m.sym}" style="height:30px;width:130px"></canvas></td>
        <td><a class="btn-ghost btn-sm" href="#/charts?symbol=${m.exchange}:${m.sym}">Chart</a></td>
      </tr>`).join('')}</tbody></table></div>
  </div>`;
}

/* ================================================================
   PAGE: INVESTORS (directory)
================================================================ */
const invState = { q: '', stock: 'ALL', growth: 'ALL', sort: 'value-desc', view: null, shown: 24 };

function growthMatch(inv, f) {
  if (f === 'ALL') return true;
  if (f === '100+') return inv.growth >= 100;
  if (f === '50-100') return inv.growth >= 50 && inv.growth < 100;
  if (f === '0-50') return inv.growth >= 0 && inv.growth < 50;
  if (f === 'neg') return inv.growth < 0;
  return true;
}
function filteredInvestors() {
  let out = INVESTORS.filter((inv) => {
    if (invState.q && !inv.name.toLowerCase().includes(invState.q.toLowerCase())) return false;
    if (invState.stock !== 'ALL' && !inv.stocks.includes(invState.stock)) return false;
    if (!growthMatch(inv, invState.growth)) return false;
    return true;
  });
  const [key, dir] = invState.sort.split('-');
  const m = dir === 'asc' ? 1 : -1;
  out.sort((a, b) => {
    if (key === 'name') return a.name.localeCompare(b.name) * m;
    if (key === 'initial') return (a.initial - b.initial) * m;
    if (key === 'value') return (a.current - b.current) * m;
    if (key === 'growth') return (a.growth - b.growth) * m;
    return 0;
  });
  return out;
}

function pageInvestors() {
  if (!invState.view) invState.view = window.innerWidth < 768 ? 'cards' : 'table';
  return `
  <div class="page-head">
    <div><h1 class="page-title">Investors <span class="pill pill-up" style="font-size:11px;vertical-align:middle">${INVESTORS.length} SIMULATED</span></h1>
      <p class="page-sub">Searchable directory of fictional demo portfolios • Min. simulated investment ${fmtKES(7000)}</p></div>
    <div class="flex gap-2"><button id="btn-export" class="btn-ghost btn-sm">⬇ Export CSV</button></div>
  </div>

  <div class="card card-pad">
    <div class="filter-bar">
      <input id="f-q" class="input" style="flex:1;min-width:180px" placeholder="🔍 Search investor name…" value="${esc(invState.q)}" />
      <select id="f-stock" class="select">
        <option value="ALL">All stocks</option>
        ${STOCKS.map((s) => `<option value="${s.sym}" ${invState.stock === s.sym ? 'selected' : ''}>${s.sym} — ${esc(s.name)}</option>`).join('')}
      </select>
      <select id="f-growth" class="select">
        <option value="ALL" ${invState.growth === 'ALL' ? 'selected' : ''}>All growth</option>
        <option value="100+" ${invState.growth === '100+' ? 'selected' : ''}>Growth ≥ 100%</option>
        <option value="50-100" ${invState.growth === '50-100' ? 'selected' : ''}>Growth 50–100%</option>
        <option value="0-50" ${invState.growth === '0-50' ? 'selected' : ''}>Growth 0–50%</option>
        <option value="neg" ${invState.growth === 'neg' ? 'selected' : ''}>Negative</option>
      </select>
      <select id="f-sort" class="select">
        <option value="value-desc" ${invState.sort === 'value-desc' ? 'selected' : ''}>Sort: Value ↓</option>
        <option value="value-asc" ${invState.sort === 'value-asc' ? 'selected' : ''}>Sort: Value ↑</option>
        <option value="initial-desc" ${invState.sort === 'initial-desc' ? 'selected' : ''}>Sort: Invested ↓</option>
        <option value="initial-asc" ${invState.sort === 'initial-asc' ? 'selected' : ''}>Sort: Invested ↑</option>
        <option value="growth-desc" ${invState.sort === 'growth-desc' ? 'selected' : ''}>Sort: Growth ↓</option>
        <option value="growth-asc" ${invState.sort === 'growth-asc' ? 'selected' : ''}>Sort: Growth ↑</option>
        <option value="name-asc" ${invState.sort === 'name-asc' ? 'selected' : ''}>Sort: Name A–Z</option>
      </select>
      <div class="seg" id="f-view">
        <button data-view="table" class="${invState.view === 'table' ? 'on' : ''}">☰ Table</button>
        <button data-view="cards" class="${invState.view === 'cards' ? 'on' : ''}">▦ Cards</button>
      </div>
    </div>
    <div class="chip-row" id="f-chips">
      <button class="chip ${invState.stock === 'ALL' ? 'on' : ''}" data-stock="ALL">All</button>
      ${STOCKS.map((s) => `<button class="chip ${invState.stock === s.sym ? 'on' : ''}" data-stock="${s.sym}">${s.sym}</button>`).join('')}
    </div>
  </div>

  <p id="inv-count" class="text-[12.5px] text-slate-400 mt-4 mb-3"></p>
  <div id="inv-results"></div>
  <div class="text-center mt-5"><button id="btn-more-inv" class="btn-ghost hidden">Show more investors</button></div>`;
}

function renderInvestorResults() {
  const all = filteredInvestors();
  const list = all.slice(0, invState.shown);
  $('#inv-count').innerHTML = `Showing <strong class="text-white">${list.length}</strong> of <strong class="text-white">${all.length}</strong> simulated investors ${invState.q ? `for “${esc(invState.q)}”` : ''}`;
  const box = $('#inv-results');
  if (!all.length) {
    box.innerHTML = emptyState('🔍', 'No investors match your filters', 'Try clearing the search or choosing different filters.', `<button class="btn-ghost btn-sm" id="btn-clear-f">Clear all filters</button>`);
    $('#btn-clear-f').onclick = () => { Object.assign(invState, { q: '', stock: 'ALL', growth: 'ALL', sort: 'value-desc', shown: 24 }); renderRoute(false); };
  } else if (invState.view === 'table') {
    box.innerHTML = `<div class="table-wrap card" style="padding:0"><table class="data">
      <thead><tr><th>Investor</th><th class="sortable" data-sort="initial">Investment ↕</th><th>Stocks</th>
      <th class="sortable" data-sort="value">Current Value ↕</th><th>Profit (sim.)</th><th class="sortable" data-sort="growth">Growth ↕</th></tr></thead>
      <tbody>${list.map(investorRowHTML).join('')}</tbody></table></div>`;
    bindRowLinks(box);
    $$('[data-sort]', box).forEach((th) => th.onclick = () => {
      const key = th.dataset.sort;
      invState.sort = invState.sort === key + '-desc' ? key + '-asc' : key + '-desc';
      $('#f-sort').value = invState.sort;
      renderInvestorResults();
    });
  } else {
    box.innerHTML = `<div class="inv-grid">${list.map(investorCardHTML).join('')}</div>`;
    hydrateSparks(box);
    bindRowLinks(box);
  }
  const more = $('#btn-more-inv');
  more.classList.toggle('hidden', invState.shown >= all.length);
  more.textContent = `Show more investors (${all.length - invState.shown} remaining)`;
}

function bindInvestorsPage() {
  $('#f-q').addEventListener('input', debounce((e) => { invState.q = e.target.value.trim(); invState.shown = 24; renderInvestorResults(); }, 220));
  $('#f-stock').onchange = (e) => { invState.stock = e.target.value; invState.shown = 24; syncChips(); renderInvestorResults(); };
  $('#f-growth').onchange = (e) => { invState.growth = e.target.value; invState.shown = 24; renderInvestorResults(); };
  $('#f-sort').onchange = (e) => { invState.sort = e.target.value; renderInvestorResults(); };
  $$('#f-view button').forEach((b) => b.onclick = () => {
    invState.view = b.dataset.view;
    $$('#f-view button').forEach((x) => x.classList.toggle('on', x === b));
    renderInvestorResults();
  });
  $$('#f-chips .chip').forEach((c) => c.onclick = () => {
    invState.stock = c.dataset.stock; invState.shown = 24;
    $('#f-stock').value = invState.stock; syncChips(); renderInvestorResults();
  });
  $('#btn-more-inv').onclick = () => { invState.shown += 24; renderInvestorResults(); };
  $('#btn-export').onclick = exportCSV;
  renderInvestorResults();
}
function syncChips() { $$('#f-chips .chip').forEach((c) => c.classList.toggle('on', c.dataset.stock === invState.stock)); }

function exportCSV() {
  const rows = [['Name', 'Initial (KES)', 'Current (KES)', 'Profit (KES)', 'Growth %', 'Stocks', 'Months']];
  filteredInvestors().forEach((i) => rows.push([i.name, i.initial, i.current, i.profit, i.growth.toFixed(2), i.stocks.join('+'), i.months]));
  const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'pro-stocks-simulated-investors.csv'; a.click();
  URL.revokeObjectURL(a.href);
  toast('CSV exported', 'Simulated investor dataset downloaded.', 'info');
}

/* ================================================================
   PAGE: INVESTOR PROFILE
================================================================ */
let profileTF = 'ALL';
function pageInvestor(id) {
  const inv = investorById(id);
  if (!inv) return emptyState('👤', 'Investor not found', 'This demo profile does not exist.', `<a class="btn-ghost btn-sm" href="#/investors">← Back to directory</a>`);
  profileTF = 'ALL';
  const snaps = monthlySnapshots(inv);
  const miles = investorMilestones(inv);
  const idx = INVESTORS.indexOf(inv);
  const related = [...INVESTORS].filter((x) => x.id !== inv.id && x.stocks.some((s) => inv.stocks.includes(s))).slice(0, 3);
  const peak = Math.max(...inv.history);

  return `
  <div class="mt-4"><a href="#/investors" class="btn-ghost btn-sm">← Back to investors</a></div>
  <div class="card card-pad mt-3" style="overflow:hidden;position:relative">
    <div style="position:absolute;inset:0;background:radial-gradient(500px 220px at 15% 0%,rgba(0,224,127,.1),transparent 65%);pointer-events:none"></div>
    <div class="flex items-start gap-4 flex-wrap" style="position:relative">
      <span class="avatar avatar-xl" style="${avatarStyle(inv, idx)}">${initials(inv.name)}</span>
      <div class="min-w-0" style="flex:1">
        <div class="flex items-center gap-2 flex-wrap">
          ${inv.featured ? '<span class="featured-badge">★ FEATURED DEMO PROFILE</span>' : '<span class="pill pill-up">DEMO PROFILE</span>'}
          <span class="pill pill-flat">SIMULATED DATA</span>
          <span class="text-[11px] text-slate-500">• Last active ${inv.lastActive}</span>
        </div>
        <h1 class="font-display text-[clamp(22px,4vw,32px)] font-bold mt-2">${esc(inv.name)}</h1>
        <p class="text-[13px] text-slate-400 mt-1">${inv.bio || `${esc(inv.risk)} simulated strategy • Member since ${inv.joined.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} • ${inv.months}-month simulated track record.`}</p>
        <div class="mt-2.5 flex gap-1.5 flex-wrap">${inv.stocks.map(stockTag).join('')}</div>
      </div>
      <div class="flex gap-2">
        <button class="btn-ghost btn-sm" data-follow="${inv.id}">${watchInvestors.has(inv.id) ? '★ Following' : '☆ Follow'}</button>
        <button class="btn-ghost btn-sm" id="btn-share">⤴ Share</button>
      </div>
    </div>
    <div class="grid gap-2.5 mt-5 grid-cols-2 lg:grid-cols-5" style="position:relative">
      <div class="fstat"><p>Initial Investment</p><p>${fmtKES(inv.initial)}</p></div>
      <div class="fstat"><p>Current Value (sim.)</p><p style="color:var(--green)">${fmtKES(inv.current)}</p></div>
      <div class="fstat"><p>Total Profit (sim.)</p><p class="${inv.profit >= 0 ? 'up' : 'down'}">${inv.profit >= 0 ? '+' : ''}${fmtKES(inv.profit)}</p></div>
      <div class="fstat"><p>Growth (sim.)</p><p>${growthPill(inv.growth)}</p></div>
      <div class="fstat"><p>Duration</p><p>${inv.months} months</p></div>
    </div>
  </div>

  <div class="grid gap-4 mt-4 lg:grid-cols-3">
    <div class="card card-pad lg:col-span-2">
      <div class="card-head" style="flex-wrap:wrap">
        <h2 class="card-title">Portfolio Performance <span class="q">— simulated, gradual growth</span></h2>
        <div class="seg" id="tf-seg">
          ${['1M', '3M', '6M', '1Y', 'ALL'].map((t) => `<button data-tf="${t}" class="${t === 'ALL' ? 'on' : ''}">${t}</button>`).join('')}
        </div>
      </div>
      <div class="chart-box"><canvas id="ch-profile" class="chart"></canvas><div id="ch-profile-tip" class="chart-tip"></div></div>
      <div class="grid grid-cols-3 gap-2.5 mt-4">
        <div class="fstat"><p>Sim. Peak</p><p>${fmtCompactKES(peak)}</p></div>
        <div class="fstat"><p>Invested</p><p>${fmtCompactKES(inv.initial)}</p></div>
        <div class="fstat"><p>Today (sim.)</p><p style="color:var(--green)">${fmtCompactKES(inv.current)}</p></div>
      </div>
    </div>
    <div class="card card-pad">
      <div class="card-head"><h2 class="card-title">Stock Allocation</h2></div>
      <canvas id="ch-donut" style="width:100%"></canvas>
      <div class="mt-4">${inv.allocation.map((a) => { const s = stockBySym(a.sym); const val = inv.current * a.pct / 100; return `
        <div class="alloc-row"><span class="stock-dot" style="background:${s.color}"></span>
          <strong class="w-12">${a.sym}</strong>
          <div class="alloc-bar"><div class="alloc-fill" style="width:${a.pct}%;background:${s.color}"></div></div>
          <span class="text-slate-400 text-[11.5px] w-24 text-right">${a.pct.toFixed(1)}% • ${fmtCompactKES(val)}</span></div>`; }).join('')}
      </div>
      <div class="mt-4 pt-4" style="border-top:1px solid var(--border-soft)">
        <p class="stat-label mb-2">Holdings detail (simulated)</p>
        ${inv.allocation.map((a) => { const s = stockBySym(a.sym); return `
        <div class="flex items-center justify-between py-1.5 text-[12.5px]">
          <span><strong>${a.sym}</strong> <span class="text-slate-500">• ${esc(s.name)}</span></span>
          <a href="#/charts?symbol=${s.exchange}:${s.sym}" class="font-semibold" style="color:var(--green)">Chart →</a></div>`; }).join('')}
      </div>
    </div>
  </div>

  <div class="grid gap-4 mt-4 lg:grid-cols-2">
    <div class="card card-pad">
      <div class="card-head"><h2 class="card-title">Investment Timeline</h2><span class="kbd-hint">simulated milestones</span></div>
      <div class="timeline">${miles.map((m) => `
        <div class="tl-item"><p class="text-[11px] font-bold tracking-wide" style="color:var(--green)">${m.date.toUpperCase()}</p>
          <p class="font-bold text-[13.5px] mt-0.5">${m.title}</p><p class="text-[12.5px] text-slate-400 mt-0.5">${m.desc}</p></div>`).join('')}
      </div>
    </div>
    <div class="card card-pad">
      <div class="card-head"><h2 class="card-title">Portfolio History</h2><span class="kbd-hint">monthly snapshots • simulated</span></div>
      <div class="table-wrap" style="border:none"><table class="data" style="min-width:0">
        <thead><tr><th>Month</th><th>Value (sim.)</th><th>Change</th></tr></thead>
        <tbody>${snaps.map((s, i) => {
          const prev = i === 0 ? inv.initial : snaps[i - 1].value;
          const ch = ((s.value - prev) / prev) * 100;
          return `<tr style="cursor:default"><td class="text-slate-300 font-semibold">${s.label}</td>
            <td class="num">${fmtKES(Math.round(s.value))}</td>
            <td><span class="pill ${ch >= 0 ? 'pill-up' : 'pill-down'}">${fmtPct(ch)}</span></td></tr>`; }).join('')}
        </tbody></table></div>
    </div>
  </div>

  <div class="card-head mt-7"><h2 class="card-title">Related Demo Investors</h2></div>
  <div class="inv-grid">${related.map((r, i) => investorCardHTML(r, INVESTORS.indexOf(r))).join('')}</div>`;

  queueMicrotask(() => {
    bindFollowButtons($('#page'));
    hydrateSparks($('#page'));
    $('#btn-share').onclick = () => {
      try { navigator.clipboard.writeText(location.href); } catch { /* noop */ }
      toast('Profile link copied', 'Share this simulated demo profile.', 'info');
    };
    const paintDonut = () => drawDonut($('#ch-donut'), inv.allocation.map((a) => ({ value: a.pct, color: stockBySym(a.sym).color })), { centerValue: inv.stocks.length + ' stocks' });
    paintDonut(); onPaint(paintDonut);
    const paintProfile = () => {
      const tfN = { '1M': 30, '3M': 60, '6M': 120, '1Y': 200, 'ALL': inv.history.length }[profileTF];
      const data = inv.history.slice(-Math.min(tfN, inv.history.length));
      const labels = data.map((_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (data.length - 1 - i));
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      });
      drawAreaChart($('#ch-profile'), data, { height: 250, xLabels: labels, format: (v) => fmtKES(Math.round(v)), tooltipEl: $('#ch-profile-tip') });
    };
    paintProfile(); onPaint(paintProfile);
    $$('#tf-seg button').forEach((b) => b.onclick = () => {
      profileTF = b.dataset.tf;
      $$('#tf-seg button').forEach((x) => x.classList.toggle('on', x === b));
      paintProfile();
    });
  });
}

/* ================================================================
   PAGE: PORTFOLIOS
================================================================ */
function pagePortfolios() {
  const s = platformStats();
  const top = [...INVESTORS].sort((a, b) => b.current - a.current).slice(0, 9);
  // aggregate allocation by stock
  const agg = {};
  INVESTORS.forEach((inv) => inv.allocation.forEach((a) => { agg[a.sym] = (agg[a.sym] || 0) + inv.current * a.pct / 100; }));
  const total = Object.values(agg).reduce((a, b) => a + b, 0);
  const aggArr = Object.entries(agg).map(([sym, v]) => ({ sym, pct: (v / total) * 100 })).sort((a, b) => b.pct - a.pct);
  // growth distribution
  const buckets = [
    { label: '≥ 100%', color: '#00E07F', n: INVESTORS.filter((i) => i.growth >= 100).length },
    { label: '50–100%', color: '#4F7CFF', n: INVESTORS.filter((i) => i.growth >= 50 && i.growth < 100).length },
    { label: '0–50%', color: '#E3C878', n: INVESTORS.filter((i) => i.growth >= 0 && i.growth < 50).length },
    { label: '< 0%', color: '#FF4D67', n: INVESTORS.filter((i) => i.growth < 0).length },
  ];
  return `
  <div class="page-head"><div><h1 class="page-title">Portfolios</h1>
    <p class="page-sub">Community-wide simulated allocation &amp; the largest demo portfolios</p></div></div>
  <div class="grid gap-4 lg:grid-cols-3">
    <div class="card card-pad">
      <div class="card-head"><h2 class="card-title">Community Allocation <span class="q">simulated</span></h2></div>
      <canvas id="ch-alloc"></canvas>
      <div class="mt-3">${aggArr.slice(0, 6).map((a) => { const st = stockBySym(a.sym); return `
        <div class="alloc-row"><span class="stock-dot" style="background:${st.color}"></span><strong class="w-12">${a.sym}</strong>
          <div class="alloc-bar"><div class="alloc-fill" style="width:${a.pct}%;background:${st.color}"></div></div>
          <span class="text-slate-400 text-[11.5px] w-12 text-right">${a.pct.toFixed(1)}%</span></div>`; }).join('')}</div>
    </div>
    <div class="card card-pad">
      <div class="card-head"><h2 class="card-title">Growth Distribution <span class="q">simulated</span></h2></div>
      <canvas id="ch-dist"></canvas>
      <div class="mt-4 grid grid-cols-2 gap-2.5">
        <div class="fstat"><p>Avg Growth</p><p class="up">${fmtPct(s.avgGrowth)}</p></div>
        <div class="fstat"><p>Profitable (sim.)</p><p>${INVESTORS.filter((i) => i.profit >= 0).length}/${s.totalInvestors}</p></div>
      </div>
    </div>
    <div class="card card-pad">
      <div class="card-head"><h2 class="card-title">Totals <span class="q">auto-calculated</span></h2></div>
      <div class="grid gap-2.5">
        <div class="fstat"><p>Simulated Capital</p><p>${fmtKES(s.totalCapital)}</p></div>
        <div class="fstat"><p>Simulated Value</p><p style="color:var(--green)">${fmtKES(s.totalValue)}</p></div>
        <div class="fstat"><p>Unrealized P&amp;L (sim.)</p><p class="up">+${fmtKES(s.totalProfit)}</p></div>
      </div>
      <div class="dist-bar mt-4">${buckets.map((b) => `<div style="width:${(b.n / s.totalInvestors) * 100}%;background:${b.color}" title="${b.label}: ${b.n}"></div>`).join('')}</div>
      <div class="flex gap-3 flex-wrap mt-2">${buckets.map((b) => `<span class="text-[11px] text-slate-400"><span class="legend-dot" style="background:${b.color}"></span>${b.label} (${b.n})</span>`).join('')}</div>
    </div>
  </div>
  <div class="card-head mt-7"><h2 class="card-title">Largest Demo Portfolios</h2>
    <a href="#/investors?sort=value-desc" class="text-[12px] font-semibold" style="color:var(--green)">Full rankings →</a></div>
  <div class="inv-grid">${top.map((r) => investorCardHTML(r, INVESTORS.indexOf(r))).join('')}</div>`;

  queueMicrotask(() => {
    hydrateSparks($('#page'));
    const p1 = () => drawDonut($('#ch-alloc'), aggArr.map((a) => ({ value: a.pct, color: stockBySym(a.sym).color })), { centerValue: fmtCompactKES(total) });
    p1(); onPaint(p1);
    const p2 = () => drawBars($('#ch-dist'), buckets.map((b) => ({ label: b.label, value: b.n, color: b.color, display: b.n + ' investors' })));
    p2(); onPaint(p2);
  });
}

/* ================================================================
   PAGE: WATCHLIST
================================================================ */
function pageWatchlist() {
  const sInv = [...watchInvestors].map(investorById).filter(Boolean);
  const sStocks = [...watchStocks].map(stockBySym).filter(Boolean);
  return `
  <div class="page-head"><div><h1 class="page-title">Watchlist</h1>
    <p class="page-sub">Your saved demo symbols &amp; simulated investors • stored locally in this browser</p></div></div>
  <div class="card-head"><h2 class="card-title">⭐ Watched Stocks (${sStocks.length})</h2>
    <a href="#/markets" class="text-[12px] font-semibold" style="color:var(--green)">Browse markets →</a></div>
  ${sStocks.length ? `<div class="mkt-grid" style="grid-template-columns:repeat(auto-fill,minmax(190px,1fr))">
    ${sStocks.map((m) => `<div class="card card-hover mkt-card">
      <div class="flex items-center justify-between"><div class="mkt-sym">${m.sym}</div>
        <button class="icon-btn" style="width:30px;height:30px" data-watch-stock="${m.sym}">★</button></div>
      <div class="mkt-name">${esc(m.name)}</div><div class="mkt-price">${fmtUSD(m.price)}</div>
      <div class="mt-1"><span class="pill ${m.change >= 0 ? 'pill-up' : 'pill-down'}">${fmtPct(m.change)}</span></div>
      <canvas data-mspark="${m.sym}"></canvas></div>`).join('')}</div>`
    : emptyState('☆', 'No watched stocks yet', 'Star any symbol on the Markets page to track it here.', `<a class="btn-primary btn-sm" href="#/markets">Browse markets</a>`)}
  <div class="card-head mt-7"><h2 class="card-title">👥 Followed Investors (${sInv.length})</h2>
    <a href="#/investors" class="text-[12px] font-semibold" style="color:var(--green)">Find investors →</a></div>
  ${sInv.length ? `<div class="inv-grid">${sInv.map((r) => investorCardHTML(r, INVESTORS.indexOf(r))).join('')}</div>`
    : emptyState('👥', 'Not following anyone yet', 'Follow demo investors to pin them to this list.', `<a class="btn-primary btn-sm" href="#/investors">Browse investors</a>`)}`;
}

/* ================================================================
   PAGE: CHARTS (TradingView terminal)
================================================================ */
let tvLoaded = false, tvWidget = null, tvSymbol = 'NASDAQ:AAPL', tvStyle = '1';

function loadTVScript() {
  return new Promise((resolve, reject) => {
    if (window.TradingView) return resolve();
    if (tvLoaded) { const t = setInterval(() => { if (window.TradingView) { clearInterval(t); resolve(); } }, 300); return; }
    tvLoaded = true;
    const sc = document.createElement('script');
    sc.src = 'https://s3.tradingview.com/tv.js';
    sc.async = true;
    sc.onload = () => resolve();
    sc.onerror = () => { tvLoaded = false; reject(new Error('tv-load-failed')); };
    document.head.appendChild(sc);
    setTimeout(() => { if (!window.TradingView) { tvLoaded = false; reject(new Error('tv-timeout')); } }, 12000);
  });
}

function pageCharts(query) {
  const symParam = query.get('symbol');
  if (symParam) tvSymbol = symParam;
  return `
  <div class="page-head"><div><h1 class="page-title">Pro Terminal</h1>
    <p class="page-sub"><span class="pill pill-up">LIVE MARKET DATA</span> via TradingView • candles, volume, indicators, drawing tools &amp; fullscreen — distinct from <span class="pill pill-flat">SIMULATED</span> portfolio charts</p></div></div>
  <div class="card card-pad" style="padding:14px">
    <div class="flex gap-2 flex-wrap items-center">
      <div class="chip-row" id="tv-syms">
        ${STOCKS.map((s) => `<button class="chip ${tvSymbol.endsWith(':' + s.sym) ? 'on' : ''}" data-tvsym="${s.exchange}:${s.sym}">${s.sym}</button>`).join('')}
      </div>
      <div class="seg ml-auto" id="tv-style">
        <button data-tvstyle="1" class="${tvStyle === '1' ? 'on' : ''}">🕯 Candles</button>
        <button data-tvstyle="2" class="${tvStyle === '2' ? 'on' : ''}">📊 Bars</button>
        <button data-tvstyle="3" class="${tvStyle === '3' ? 'on' : ''}">📈 Line</button>
        <button data-tvstyle="10" class="${tvStyle === '10' ? 'on' : ''}">◫ Area</button>
      </div>
    </div>
  </div>
  <div class="tv-wrap mt-3" id="tv-box">
    <div id="tv-container" style="height:600px"></div>
    <div id="tv-loading" class="tv-fallback">
      <div class="skel" style="height:420px"></div>
      <p class="text-[13px] text-slate-400 mt-4">Loading TradingView terminal…</p>
    </div>
  </div>
  <div class="grid gap-4 mt-4 lg:grid-cols-2">
    <div class="card card-pad">
      <div class="card-head"><h2 class="card-title">Terminal Features</h2></div>
      <div class="grid grid-cols-2 gap-2 text-[12.5px]">
        ${[['🕯','Candlesticks + bars'],['⏱','Multi-timeframes'],['📊','Volume overlay'],['🔍','Zoom & scroll'],['✚','Crosshair'],['📐','Indicators & drawings'],['⛶','Fullscreen mode'],['🔀','Symbol switching']].map(([i, t]) => `<div class="fstat"><p>${i}</p><p class="!text-[12.5px]">${t}</p></div>`).join('')}
      </div>
    </div>
    <div class="card card-pad">
      <div class="card-head"><h2 class="card-title">Data Separation Notice</h2></div>
      <p class="text-[13px] text-slate-300 leading-relaxed">The terminal above streams <strong>live market data from TradingView</strong> for analysis. It is <strong>not</strong> connected to any PRO STOCKS demo portfolio.</p>
      <p class="text-[13px] text-slate-400 leading-relaxed mt-2">All portfolio values, investor returns and growth charts elsewhere on this platform are <strong class="text-amber-200">simulated demo data</strong> and never represent real positions.</p>
      <a href="#/investors" class="btn-ghost btn-sm mt-4">View simulated portfolios →</a>
    </div>
  </div>`;

  queueMicrotask(() => {
    const mount = () => {
      loadTVScript().then(() => {
        $('#tv-loading')?.remove();
        $('#tv-container').innerHTML = '';
        try {
          tvWidget = new window.TradingView.widget({
            container_id: 'tv-container',
            symbol: tvSymbol, interval: 'D', theme: 'dark', style: tvStyle,
            locale: 'en', width: '100%', height: 600,
            allow_symbol_change: true, hide_side_toolbar: false,
            withdateranges: true, save_image: true,
            studies: ['STD;Volume', 'STD;MACD'],
            show_popup_button: true, popup_width: '1000', popup_height: '650',
            backgroundColor: 'rgba(7, 13, 31, 1)',
          });
        } catch (e) { tvFallback(); }
      }).catch(tvFallback);
    };
    const tvFallback = () => {
      const box = $('#tv-box');
      if (box) box.innerHTML = `<div class="tv-fallback">
        <div class="empty-ico" style="font-size:30px">📡</div>
        <p class="font-bold text-white">TradingView terminal unavailable offline</p>
        <p class="text-[13px] text-slate-400 mt-2 max-w-md mx-auto">The live chart needs an internet connection. Your simulated portfolio charts across the rest of the platform work fully offline.</p>
        <button class="btn-primary btn-sm mt-4" onclick="location.reload()">Retry connection</button></div>`;
    };
    mount();
    $$('#tv-syms .chip').forEach((c) => c.onclick = () => {
      tvSymbol = c.dataset.tvsym;
      $$('#tv-syms .chip').forEach((x) => x.classList.toggle('on', x === c));
      $('#tv-box').innerHTML = '<div id="tv-container" style="height:600px"></div>';
      mount();
    });
    $$('#tv-style button').forEach((b) => b.onclick = () => {
      tvStyle = b.dataset.tvstyle;
      $$('#tv-style button').forEach((x) => x.classList.toggle('on', x === b));
      $('#tv-box').innerHTML = '<div id="tv-container" style="height:600px"></div>';
      mount();
    });
  });
}

/* ================================================================
   PAGE: ABOUT / HELP
================================================================ */
function pageAbout() {
  const s = platformStats();
  return `
  <div class="page-head"><div><h1 class="page-title">About PRO STOCKS</h1>
    <p class="page-sub">A premium fintech interface demonstration — simulated from top to bottom</p></div></div>
  <div class="grid gap-4 lg:grid-cols-3">
    <div class="card card-pad lg:col-span-2">
      <h2 class="font-display text-lg font-bold">What is this platform?</h2>
      <p class="text-[13.5px] text-slate-300 leading-relaxed mt-3"><strong class="text-white">PRO STOCKS</strong> is a <strong class="text-amber-200">demo / simulation platform</strong> showcasing what a modern stock-investment dashboard feels like. It renders <strong class="text-white">${s.totalInvestors} fictional investor profiles</strong>, ${fmtCompactKES(s.totalValue)} in simulated portfolio value, interactive performance charts, and a live-market terminal — all inside one polished interface.</p>
      <p class="text-[13.5px] text-slate-400 leading-relaxed mt-3">Nothing here is real: no users, no money, no brokerage connection, no investment advice. The dataset is generated deterministically in your browser from a seeded model (minimum simulated investment ${fmtKES(7000)}), and every figure is derived with transparent formulas:</p>
      <div class="grid sm:grid-cols-2 gap-2.5 mt-4">
        <div class="fstat"><p>Current Value</p><p class="!text-[13px]">Initial + Simulated Profit</p></div>
        <div class="fstat"><p>Growth %</p><p class="!text-[13px]">(Current − Initial) ÷ Initial × 100</p></div>
      </div>
      <h3 class="font-bold mt-6 mb-2 text-[15px]">Why build it this way?</h3>
      <ul class="modal-list">
        <li><span>✓</span> Product demos without touching real customer data</li>
        <li><span>✓</span> Design reviews with believable, consistent figures</li>
        <li><span>✓</span> Investor-education mockups that feel like the real thing</li>
        <li><span>✓</span> Frontend performance testing with 100+ profiles &amp; charts</li>
      </ul>
    </div>
    <div class="flex flex-col gap-4">
      <div class="card card-pad"><p class="stat-label">Simulated Investors</p><p class="stat-value">${s.totalInvestors}</p>
        <p class="stat-label mt-4">Simulated Capital</p><p class="stat-value !text-[19px]">${fmtCompactKES(s.totalCapital)}</p>
        <p class="stat-label mt-4">Simulated Value</p><p class="stat-value !text-[19px]" style="color:var(--green)">${fmtCompactKES(s.totalValue)}</p>
        <p class="stat-label mt-4">Avg. Growth</p><p class="stat-value !text-[19px] up">${fmtPct(s.avgGrowth)}</p></div>
      <div class="card card-pad"><p class="stat-label">Reference Universe</p>
        <div class="mt-2 flex gap-1.5 flex-wrap">${STOCKS.map((x) => stockTag(x.sym)).join('')}</div>
        <p class="text-[11.5px] text-slate-500 mt-3">Symbols shown for illustration. Live analytics via TradingView.</p></div>
    </div>
  </div>
  <div class="disclaimer mt-5"><strong>RISK &amp; DEMO DISCLAIMER —</strong> “PRO STOCKS is a demonstration platform. All investor profiles, portfolio balances, returns, and performance figures shown in this interface are simulated and do not represent actual investments, accounts, or investment results.”</div>`;
}

function pageHelp() {
  const faqs = [
    ['Is any of this real money?', 'No. PRO STOCKS is a pure front-end demonstration. Every investor, balance, return and chart is simulated data generated in your browser. Nothing is connected to a brokerage or a real person.'],
    ['Where does the 100+ investor data come from?', 'A seeded generator creates 104 fictional profiles (names, investments ≥ KES 7,000, stock picks, growth curves) deterministically — the same demo dataset on every visit. Derived figures use Current Value = Initial + Profit and Growth % = (Current − Initial) ÷ Initial × 100.'],
    ['What is the difference between simulated and live data?', 'Green “SIM” badges and the amber DEMO strip mark simulated portfolio data. The Charts terminal streams live market data from TradingView for analysis only — it never touches demo portfolios.'],
    ['How do search, sort and filters work?', 'Open Investors and type a name, pick a stock chip, choose a growth band, or sort by investment, value or growth. Click any row or card to open the full simulated profile with allocation, timeline and history.'],
    ['Does the watchlist sync anywhere?', 'No — starred stocks and followed investors stay in your browser’s local storage on this device only. Clearing site data resets them.'],
    ['Can I connect a real brokerage account?', 'No, and that is intentional. This build has no accounts, no logins with real credentials, and no trading capability. The “Demo Account” indicator in the top bar is permanent.'],
    ['Who are Vincent Omondi and Dylan Wayne?', 'Fictional featured demo profiles hardcoded for the showcase: Vincent (KES 7,000 → KES 28,000 in AAPL, +300%) and Dylan (KES 200,000 → KES 320,000 in TSLA + AAPL, +60%). All other profiles are randomized fiction.'],
  ];
  return `
  <div class="page-head"><div><h1 class="page-title">Help Center</h1>
    <p class="page-sub">Everything about using the PRO STOCKS demo</p></div></div>
  <div class="grid gap-4 lg:grid-cols-3">
    <div class="lg:col-span-2">
      ${faqs.map(([q, a], i) => `<details class="faq" ${i === 0 ? 'open' : ''}><summary>${q}<span style="color:var(--green)">＋</span></summary><div class="faq-body">${a}</div></details>`).join('')}
    </div>
    <div class="flex flex-col gap-4">
      <div class="card card-pad"><p class="font-bold text-[15px]">Quick actions</p>
        <div class="grid gap-2 mt-3">
          <a href="#/investors" class="btn-ghost btn-sm">🔍 Search investors</a>
          <a href="#/charts" class="btn-ghost btn-sm">📈 Open live terminal</a>
          <a href="#/watchlist" class="btn-ghost btn-sm">⭐ My watchlist</a>
          <button class="btn-ghost btn-sm" id="btn-tour">✨ Replay welcome tour</button>
        </div></div>
      <div class="card card-pad"><p class="font-bold text-[15px]">Contact (demo)</p>
        <p class="text-[12.5px] text-slate-400 mt-2 leading-relaxed">This showcase has no support desk — but in a production build this card would hold live chat, status page and docs links.</p>
        <button class="btn-primary btn-sm mt-3 w-full" onclick="toast('Demo only','Support chat is disabled in the simulation.','info')">Chat with support</button></div>
    </div>
  </div>`;
}

/* ================================================================
   ROUTER
================================================================ */
const routes = {
  dashboard: pageDashboard, markets: pageMarkets, investors: pageInvestors,
  portfolios: pagePortfolios, watchlist: pageWatchlist, charts: pageCharts,
  about: pageAbout, help: pageHelp,
};

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [pathPart, queryPart] = raw.split('?');
  const segs = pathPart.split('/').filter(Boolean);
  return { segs, query: new URLSearchParams(queryPart || '') };
}

function setActiveNav(route) {
  $$('#side-nav .nav-link').forEach((a) => a.classList.toggle('active', a.dataset.route === route));
  $$('.bottomnav a').forEach((a) => a.classList.toggle('active', a.dataset.route === route));
}

function renderRoute(withSkeleton = true) {
  paintQueue = [];
  const { segs, query } = parseHash();
  let key = segs[0] || 'dashboard';
  const page = $('#page');

  // query-driven presets
  if (key === 'investors' && query.get('sort')) invState.sort = query.get('sort');
  if (key === 'investors' && query.get('stock')) invState.stock = query.get('stock');

  const mount = () => {
    let html, navKey = key;
    if (key === 'investor' && segs[1]) { html = pageInvestor(segs[1]); navKey = 'investors'; }
    else if (routes[key]) html = routes[key](query);
    else { html = routes.dashboard(query); navKey = 'dashboard'; }
    page.innerHTML = html;
    page.style.animation = 'none'; void page.offsetWidth; page.style.animation = '';
    setActiveNav(navKey);
    window.scrollTo({ top: 0, behavior: 'instant' });
    closeSidebar();
    // page-specific bindings
    if (key === 'investors') bindInvestorsPage();
    if (key === 'markets' || key === 'watchlist') { hydrateSparks(page); bindWatchButtons(page); bindBuyButtons(page); }
  };

  if (withSkeleton && !$('#page').dataset.first) {
    $('#page').dataset.first = '1';
    mount();
  } else if (withSkeleton) {
    page.innerHTML = skeletonPage();
    setTimeout(mount, 320);
  } else mount();
}

/* Row click navigation */
function bindRowLinks(root) {
  $$('tr[data-href]', root).forEach((tr) => tr.onclick = () => { location.hash = tr.dataset.href; });
}

/* Follow buttons */
function bindFollowButtons(root) {
  $$('[data-follow]', root).forEach((b) => b.onclick = (e) => {
    e.preventDefault(); e.stopPropagation();
    const id = b.dataset.follow;
    const inv = investorById(id);
    if (watchInvestors.has(id)) { watchInvestors.delete(id); b.textContent = '☆ Follow'; toast('Unfollowed ' + inv.name, '', 'info'); }
    else { watchInvestors.add(id); b.textContent = '★ Following'; toast('Following ' + inv.name, 'Added to your demo watchlist.'); }
    saveWatch();
  });
}

/* Markets / watchlist buttons */
function bindWatchButtons(root) {
  $$('[data-watch-stock]', root).forEach((b) => b.onclick = (e) => {
    e.stopPropagation();
    const sym = b.dataset.watchStock;
    if (watchStocks.has(sym)) { watchStocks.delete(sym); b.textContent = '☆'; toast(sym + ' removed from watchlist', '', 'info'); }
    else { watchStocks.add(sym); b.textContent = '★'; toast(sym + ' added to watchlist', 'Stored locally in this demo.'); }
    saveWatch();
    if ((location.hash || '').includes('watchlist')) renderRoute(false);
  });
}
function bindBuyButtons(root) {
  $$('[data-buy]', root).forEach((b) => b.onclick = (e) => {
    e.stopPropagation();
    toast('Simulated order noted', `${b.dataset.buy} — paper trading only in this demo. No real order placed.`, 'warn');
  });
}

/* ================================================================
   GLOBAL CHROME: ticker, clock, search, dropdowns, sidebar
================================================================ */
function buildTicker() {
  const items = STOCKS.map((m) => `<span class="tick-item"><span class="sym">${m.sym}</span><span class="px">${fmtUSD(m.price)}</span><span class="${m.change >= 0 ? 'up' : 'down'}">${fmtPct(m.change)}</span></span>`).join('');
  $('#ticker-track').innerHTML = items + items; // seamless loop
}

function startClock() {
  const tick = () => {
    const now = new Date();
    $('#clock').textContent = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' EAT';
    // NYSE session approx in UTC: Mon–Fri 13:30–20:00
    const d = now.getUTCDay(), mins = now.getUTCHours() * 60 + now.getUTCMinutes();
    const open = d >= 1 && d <= 5 && mins >= 810 && mins < 1200;
    const ms = $('#market-status');
    ms.classList.toggle('closed', !open);
    $('#market-status-text').textContent = open ? 'Market Open' : 'Market Closed';
  };
  tick(); setInterval(tick, 20000);
}

function sidebarSpark() {
  const c = $('#side-spark');
  const paint = () => drawSparkline(c, platformHistory(), { height: 44 });
  paint(); onPaint(paint);
  const h = platformHistory();
  $('#side-spark-label').textContent = '▲ ' + fmtPct(((h[h.length - 1] - h[0]) / h[0]) * 100) + ' (simulated)';
}

/* --- Global search --- */
function wireSearch(inputEl, resultsEl) {
  if (!inputEl) return;
  inputEl.addEventListener('input', () => {
    const q = inputEl.value.trim().toLowerCase();
    if (q.length < 2) { resultsEl.classList.add('hidden'); return; }
    const invs = INVESTORS.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 5);
    const stks = STOCKS.filter((s) => s.sym.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)).slice(0, 3);
    if (!invs.length && !stks.length) {
      resultsEl.innerHTML = `<div class="p-3 text-[12.5px] text-slate-400">No matches for “${esc(inputEl.value.trim())}”</div>`;
    } else {
      resultsEl.innerHTML =
        stks.map((s) => `<a class="sr-item" href="#/charts?symbol=${s.exchange}:${s.sym}"><span class="sr-type">STOCK</span><strong>${s.sym}</strong><span class="text-slate-400 text-[12px]">${esc(s.name)}</span><span class="ml-auto text-[12px] ${s.change >= 0 ? 'up' : 'down'}">${fmtPct(s.change)}</span></a>`).join('') +
        invs.map((i) => `<a class="sr-item" href="#/investor/${i.id}"><span class="sr-type inv">INVESTOR</span><span class="avatar avatar-sm" style="${avatarStyle(i, INVESTORS.indexOf(i))}">${initials(i.name)}</span><span><strong class="text-[13px]">${esc(i.name)}</strong><span class="block text-[11px] text-slate-500">${fmtKES(i.current)} • ${fmtPct(i.growth)} sim.</span></span></a>`).join('');
    }
    resultsEl.classList.remove('hidden');
  });
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      invState.q = inputEl.value.trim(); invState.shown = 24;
      resultsEl.classList.add('hidden');
      location.hash = '#/investors';
      if ((parseHash().segs[0] || '') === 'investors') renderRoute(false);
    }
    if (e.key === 'Escape') resultsEl.classList.add('hidden');
  });
  document.addEventListener('click', (e) => {
    if (!resultsEl.contains(e.target) && e.target !== inputEl) resultsEl.classList.add('hidden');
  });
  resultsEl.addEventListener('click', () => { resultsEl.classList.add('hidden'); inputEl.value = ''; inputEl.blur(); });
}

/* --- Notifications --- */
const NOTIFS = [
  { icon: '🚀', color: 'rgba(0,224,127,.14)', title: 'NVDA hits simulated milestone', desc: 'Demo portfolios holding NVDA averaged +3.4% today (simulated).', time: '12 min ago', unread: true },
  { icon: '🏆', color: 'rgba(201,169,106,.16)', title: 'New top performer', desc: 'A demo portfolio crossed +300% simulated growth.', time: '1 hr ago', unread: true },
  { icon: '📊', color: 'rgba(79,124,255,.14)', title: 'Weekly demo report ready', desc: 'Community simulated value is up 4.8% this week.', time: '5 hrs ago', unread: true },
  { icon: '🛡', color: 'rgba(255,190,60,.14)', title: 'Reminder: demo environment', desc: 'All balances shown are simulated. No real funds involved.', time: 'Yesterday', unread: true },
];
function renderNotifs() {
  const unread = NOTIFS.filter((n) => n.unread).length;
  const badge = $('#notif-badge');
  badge.textContent = unread; badge.style.display = unread ? 'grid' : 'none';
  $('#notif-panel').innerHTML = `<div class="dd-head">Notifications <button id="btn-read">Mark all read</button></div>` +
    NOTIFS.map((n) => `<div class="notif-item ${n.unread ? 'unread' : ''}"><span class="notif-ico" style="background:${n.color}">${n.icon}</span>
      <div><p class="font-bold text-white text-[12.5px]">${n.title}</p><p class="text-slate-400 text-[12px] mt-0.5">${n.desc}</p><p class="text-[10.5px] text-slate-500 mt-1">${n.time} • simulated</p></div></div>`).join('');
  $('#btn-read').onclick = (e) => { e.stopPropagation(); NOTIFS.forEach((n) => n.unread = false); renderNotifs(); toast('All caught up', 'Notifications marked as read.', 'info'); };
}

/* --- User menu --- */
function renderUserMenu() {
  $('#user-panel').innerHTML = `
    <div class="p-4" style="border-bottom:1px solid var(--border-soft)">
      <div class="flex items-center gap-3">
        <span class="avatar avatar-md" style="background:linear-gradient(135deg,#4F7CFF,#00E07F)">D</span>
        <div><p class="font-bold text-[14px]">Demo Account</p><p class="text-[11.5px] text-mint-400 font-semibold">SIMULATED • KES • PAPER ONLY</p></div>
      </div></div>
    <button class="dd-link" id="u-port">💼 &nbsp;My demo portfolio</button>
    <button class="dd-link" id="u-watch">⭐ &nbsp;My watchlist</button>
    <button class="dd-link" id="u-live">⚡ &nbsp;Switch to live account <span class="pill pill-flat ml-auto" style="font-size:9px">DISABLED</span></button>
    <button class="dd-link" id="u-help">❓ &nbsp;Help center</button>`;
  $('#u-port').onclick = () => { toggleDropdown('#user-panel', false); location.hash = '#/investor/vincent-omondi'; };
  $('#u-watch').onclick = () => { toggleDropdown('#user-panel', false); location.hash = '#/watchlist'; };
  $('#u-live').onclick = () => toast('Demo environment', 'Live trading is disabled — simulation only.', 'warn');
  $('#u-help').onclick = () => { toggleDropdown('#user-panel', false); location.hash = '#/help'; };
}

function toggleDropdown(sel, force) {
  const el = $(sel);
  const show = force !== undefined ? force : el.classList.contains('hidden');
  ['#notif-panel', '#user-panel'].forEach((s) => $(s).classList.add('hidden'));
  el.classList.toggle('hidden', !show);
}

/* --- Sidebar (mobile drawer) --- */
function openSidebar() { $('#sidebar').classList.add('open'); $('#sidebar-scrim').classList.remove('hidden'); }
function closeSidebar() {
  if (window.innerWidth >= 1024) return;
  $('#sidebar').classList.remove('open'); $('#sidebar-scrim').classList.add('hidden');
}

/* ================================================================
   INIT
================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  $('#nav-investor-count').textContent = INVESTORS.length;
  updateWatchBadge();
  buildTicker();
  startClock();
  sidebarSpark();
  wireSearch($('#global-search'), $('#search-results'));
  wireSearch($('#mobile-search'), $('#mobile-search-results'));
  renderNotifs();
  renderUserMenu();

  // keyboard shortcut for search
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      e.preventDefault();
      if (window.innerWidth < 768) { $('#mobile-search-row').classList.remove('hidden'); $('#mobile-search').focus(); }
      else $('#global-search').focus();
    }
  });

  $('#btn-menu').onclick = openSidebar;
  $('#btn-more').onclick = openSidebar;
  $('#sidebar-scrim').onclick = closeSidebar;
  $('#btn-notif').onclick = (e) => { e.stopPropagation(); toggleDropdown('#notif-panel'); };
  $('#btn-user').onclick = (e) => { e.stopPropagation(); toggleDropdown('#user-panel'); };
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown') && !e.target.closest('#btn-notif') && !e.target.closest('#btn-user'))
      ['#notif-panel', '#user-panel'].forEach((s) => $(s).classList.add('hidden'));
  });
  $('#btn-search-m').onclick = () => $('#mobile-search-row').classList.toggle('hidden');

  document.addEventListener('click', (e) => {
    const tour = e.target.closest('#btn-tour');
    if (tour) { sessionStorage.removeItem('ps_seen'); $('#welcome-modal').classList.remove('hidden'); }
  });

  // welcome modal (once per session)
  if (!sessionStorage.getItem('ps_seen')) $('#welcome-modal').classList.remove('hidden');
  $('#btn-enter').onclick = () => {
    sessionStorage.setItem('ps_seen', '1');
    $('#welcome-modal').classList.add('hidden');
    toast('Welcome to PRO STOCKS', 'Explore 104 simulated demo portfolios.', 'info');
  };

  window.addEventListener('hashchange', () => renderRoute(true));
  if (!location.hash) location.hash = '#/dashboard';
  renderRoute(false);

  // hydrate secondary sparks on markets table
  const mo = new MutationObserver(() => {
    $$('[data-mspark2]').forEach((c) => {
      if (c.dataset.done) return; c.dataset.done = '1';
      const paint = () => drawSparkline(c, stockSpark(c.dataset.mspark2, 30), { height: 30 });
      paint(); onPaint(paint);
    });
  });
  mo.observe($('#page'), { childList: true, subtree: true });
});
