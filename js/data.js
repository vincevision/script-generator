/* ═══════════════════ PRO STOCKS — Simulated Dataset ═══════════════════
   All data below is FICTIONAL and generated in-browser for demo purposes. */
'use strict';

/* ---------- Seeded RNG (deterministic dataset) ---------- */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260918);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const intBetween = (a, b) => a + Math.floor(rand() * (b - a + 1));
const roundNice = (v) => {
  if (v >= 100000) return Math.round(v / 5000) * 5000;
  if (v >= 30000) return Math.round(v / 1000) * 1000;
  if (v >= 10000) return Math.round(v / 500) * 500;
  return Math.round(v / 100) * 100;
};

/* ---------- Stock universe (reference info + simulated quotes) ---------- */
const STOCKS = [
  { sym: 'AAPL',  name: 'Apple Inc.',      exchange: 'NASDAQ', price: 232.40, change:  1.84, color: '#A2AAAD', sector: 'Technology' },
  { sym: 'TSLA',  name: 'Tesla Inc.',      exchange: 'NASDAQ', price: 248.90, change: -2.31, color: '#E82127', sector: 'Automotive' },
  { sym: 'MSFT',  name: 'Microsoft Corp.', exchange: 'NASDAQ', price: 428.15, change:  0.96, color: '#00A4EF', sector: 'Technology' },
  { sym: 'AMZN',  name: 'Amazon.com Inc.', exchange: 'NASDAQ', price: 197.12, change:  1.22, color: '#FF9900', sector: 'E-Commerce' },
  { sym: 'NVDA',  name: 'NVIDIA Corp.',    exchange: 'NASDAQ', price: 131.29, change:  3.42, color: '#76B900', sector: 'Semiconductors' },
  { sym: 'GOOGL', name: 'Alphabet Inc.',   exchange: 'NASDAQ', price: 176.33, change:  0.58, color: '#4285F4', sector: 'Technology' },
  { sym: 'META',  name: 'Meta Platforms',  exchange: 'NASDAQ', price: 563.09, change:  2.05, color: '#0668E1', sector: 'Social Media' },
  { sym: 'NFLX',  name: 'Netflix Inc.',    exchange: 'NASDAQ', price: 687.20, change: -0.74, color: '#B20710', sector: 'Streaming' },
  { sym: 'AMD',   name: 'Adv. Micro Dev.', exchange: 'NASDAQ', price: 122.44, change:  1.47, color: '#ED1C24', sector: 'Semiconductors' },
  { sym: 'KO',    name: 'Coca-Cola Co.',   exchange: 'NYSE',   price:  69.85, change:  0.31, color: '#F40009', sector: 'Beverages' },
];
const stockBySym = (s) => STOCKS.find((x) => x.sym === s);

/* Simulated intraday sparkline per stock (deterministic wobble around trend) */
function stockSpark(sym, n = 40) {
  const s = stockBySym(sym);
  const r = mulberry32(sym.charCodeAt(0) * 7919 + sym.charCodeAt(1) * 104729);
  const drift = (s.change / 100) / n;
  let v = s.price * (1 - s.change / 100);
  const out = [];
  for (let i = 0; i < n; i++) {
    v = v * (1 + drift + (r() - 0.485) * 0.004);
    out.push(v);
  }
  out[n - 1] = s.price;
  return out;
}

/* ---------- Fictional investor names (no real identities) ---------- */
const FIRST = ['Brian','Sharon','Kevin','Mercy','Dennis','Faith','Collins','Lydia','George','Pauline','Samuel','Beatrice','Victor','Caroline','Peter','Grace','Daniel','Janet','Stephen','Rose','Francis','Ann','Patrick','Elizabeth','David','Mary','Joseph','Nancy','Michael','Susan','James','Lucy','John','Agnes','Anthony','Sarah','Nicholas','Esther','Benjamin','Ruth','Charles','Margaret','William','Joyce','Richard','Florence','Thomas','Irene','Eric','Cynthia','Henry','Violet','Edward','Priscilla','Alfred','Dorothy','Leonard','Beatrice','Gabriel','Naomi','Harrison','Lilian','Clinton','Millicent','Duncan','Edith','Felix','Gladys','Gideon','Hellen','Ian','Jackline','Kennedy','Lydia','Martin','Mercy','Nelson','Olivia','Oscar','Pamela','Quincy','Rachael','Seth','Teresa','Titus','Vivian','Wesley','Yvonne','Zachary','Doreen'];
const LAST = ['Kariuki','Achieng','Mwangi','Nyambura','Otieno','Wanjiku','Kiprop','Chebet','Ouma','Atieno','Maina','Wambui','Kiptoo','Cherono','Barasa','Wafula','Wekesa','Nekesa','Ochieng','Adhiambo','Kamau','Njeri','Njoroge','Wanjiru','Omondi','Auma','Kimeu','Mutiso','Nduku','Wanza','Kioko','Mumbua','Mutua','Syombua','Wambua','Kilonzo','Muthoni','Gitau','Wairimu','Githinji','Nyokabi','Macharia','Waithera','Karanja','Njoki','Mbugua','Wachira','Thuita','Wanjohi','Ndungu','Waceke','Gachanja','Moraa','Ongeri','Nyaboke','Kemunto','Kwamboka','Bosibori','Mogaka','Osewe','Awuor','Owino','Okoth','Akinyi','Onyango','Anyango','Juma','Rehema','Bakari','Zawadi','Massawe','Lyimo','Mushi','Komba','Temba','Sanga','Mziray','Kessy','Mwakalinga','Lyatuu'];
const USED = new Set();

function uniqueName() {
  for (let i = 0; i < 500; i++) {
    const n = pick(FIRST) + ' ' + pick(LAST);
    if (!USED.has(n)) { USED.add(n); return n; }
  }
  const n = pick(FIRST) + ' ' + pick(LAST) + ' ' + intBetween(2, 99);
  USED.add(n); return n;
}

/* ---------- Realistic simulated portfolio history ----------
   Gradual compounding growth with noise + mild corrections.
   Guaranteed: history[0] ≈ initial, history[last] = current exactly. */
function genHistory(initial, current, points = 90, seed = 1, volatility = 1) {
  const r = mulberry32(seed * 2654435761 % 4294967296 || 7);
  const totalGrowth = current / initial;
  const step = Math.pow(totalGrowth, 1 / (points - 1));
  const raw = [1];
  let v = 1;
  const vol = 0.016 * volatility;
  for (let i = 1; i < points; i++) {
    // occasional mild pullback weeks for realism
    const pullback = r() < 0.06 ? -(0.01 + r() * 0.025) : 0;
    const shock = (r() - 0.495) * vol * 2 + pullback;
    v = v * step * (1 + shock);
    raw.push(v);
  }
  // normalize so the curve lands exactly on current
  const scale = totalGrowth / raw[points - 1];
  // blend scale progressively so the start stays pinned at initial
  return raw.map((x, i) => {
    const t = i / (points - 1);
    const adj = Math.pow(scale, t);
    return Math.max(initial * 0.4, initial * x * adj);
  });
}

/* ---------- Featured demo profiles (exact spec figures) ---------- */
function featuredInvestors() {
  return [
    {
      id: 'vincent-omondi', featured: true,
      name: 'Vincent Omondi', stocks: ['AAPL'],
      initial: 7000, current: 28000,
      months: 14, risk: 'Growth', bio: 'Long-term Apple believer. Started with a KES 7,000 demo position and held through every simulated dip.',
    },
    {
      id: 'dylan-wayne', featured: true,
      name: 'Dylan Wayne', stocks: ['TSLA', 'AAPL'],
      initial: 200000, current: 320000,
      months: 18, risk: 'Aggressive Growth', bio: 'Concentrated demo portfolio across Tesla and Apple with a high-conviction, buy-and-hold simulated strategy.',
    },
  ];
}

/* ---------- Generate the full 100+ investor dataset ---------- */
function generateInvestors() {
  const list = featuredInvestors();
  USED.add('Vincent Omondi'); USED.add('Dylan Wayne');
  const TARGET = 104; // 100+ simulated investors
  const syms = STOCKS.map((s) => s.sym);

  for (let i = list.length; i < TARGET; i++) {
    const name = uniqueName();
    // Initial investment: KES 7,000 minimum, realistic spread
    const roll = rand();
    let initial;
    if (roll < 0.30) initial = 7000 + rand() * 18000;          // 7k–25k
    else if (roll < 0.62) initial = 25000 + rand() * 75000;    // 25k–100k
    else if (roll < 0.88) initial = 100000 + rand() * 200000;  // 100k–300k
    else initial = 300000 + rand() * 450000;                   // 300k–750k
    initial = Math.max(7000, roundNice(initial));

    // Simulated growth: mostly positive, a few negative for realism
    const g = rand();
    let growthPct;
    if (g < 0.07) growthPct = -(1 + rand() * 9);               // -1% … -10%
    else if (g < 0.30) growthPct = 3 + rand() * 27;            // +3% … +30%
    else if (g < 0.62) growthPct = 30 + rand() * 60;           // +30% … +90%
    else if (g < 0.88) growthPct = 90 + rand() * 110;          // +90% … +200%
    else growthPct = 200 + rand() * 160;                       // +200% … +360%
    const current = Math.round(initial * (1 + growthPct / 100));

    // 1–3 stocks
    const nStocks = rand() < 0.45 ? 1 : rand() < 0.8 ? 2 : 3;
    const pool = [...syms];
    const stocks = [];
    for (let k = 0; k < nStocks; k++) stocks.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);

    const risks = ['Conservative', 'Balanced', 'Growth', 'Aggressive Growth'];
    list.push({
      id: 'inv-' + String(i + 1).padStart(3, '0'),
      featured: false, name, stocks, initial, current,
      months: intBetween(3, 36),
      risk: growthPct < 0 ? 'Conservative' : pick(risks),
      bio: '',
    });
  }

  // Enrich: derived fields, history, allocation, dates
  const now = new Date();
  list.forEach((inv, idx) => {
    inv.profit = inv.current - inv.initial;                                   // Current Value = Initial + Profit  →  Profit = Current − Initial
    inv.growth = ((inv.current - inv.initial) / inv.initial) * 100;           // Growth % formula
    inv.history = genHistory(inv.initial, inv.current, 90, (idx + 1) * 97 + 13, inv.stocks.includes('TSLA') || inv.stocks.includes('NVDA') ? 1.35 : 1);
    // Allocation weights across owned stocks
    const w = inv.stocks.map(() => 0.5 + rand());
    const sum = w.reduce((a, b) => a + b, 0);
    inv.allocation = inv.stocks.map((s, k) => ({ sym: s, pct: (w[k] / sum) * 100 }));
    inv.joined = new Date(now.getFullYear(), now.getMonth() - inv.months, intBetween(1, 28));
    inv.avatarHue = (idx * 47 + 150) % 360;
    inv.lastActive = ['Just now', '5 min ago', '1 hr ago', '3 hrs ago', 'Yesterday', '2 days ago'][idx % 6];
  });
  return list;
}

const INVESTORS = generateInvestors();
const investorById = (id) => INVESTORS.find((i) => i.id === id);

/* ---------- Platform aggregates (auto-calculated) ---------- */
function platformStats() {
  const totalInvestors = INVESTORS.length;
  const totalCapital = INVESTORS.reduce((a, i) => a + i.initial, 0);
  const totalValue = INVESTORS.reduce((a, i) => a + i.current, 0);
  const totalProfit = totalValue - totalCapital;
  const avgGrowth = INVESTORS.reduce((a, i) => a + i.growth, 0) / totalInvestors;
  return { totalInvestors, totalCapital, totalValue, totalProfit, avgGrowth };
}

/* Aggregate platform history (sum of all investor histories) */
let _platformHistory = null;
function platformHistory() {
  if (_platformHistory) return _platformHistory;
  const n = 90;
  const agg = new Array(n).fill(0);
  INVESTORS.forEach((inv) => inv.history.forEach((v, i) => { agg[i] += v; }));
  _platformHistory = agg;
  return agg;
}

/* Monthly snapshots for portfolio-history tables */
function monthlySnapshots(inv) {
  const h = inv.history;
  const months = Math.min(inv.months, 12);
  const out = [];
  const now = new Date();
  for (let m = months; m >= 1; m--) {
    const idx = Math.max(0, Math.round(h.length - 1 - (m - 1) * ((h.length - 1) / Math.max(months - 1, 1))));
    const d = new Date(now.getFullYear(), now.getMonth() - (m - 1), 1);
    out.push({ label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), value: h[idx] });
  }
  out[out.length - 1].value = inv.current;
  return out;
}

/* Timeline milestones derived from the simulated curve */
function investorMilestones(inv) {
  const h = inv.history;
  const at = (f) => h[Math.min(h.length - 1, Math.floor(h.length * f))];
  const d = (monthsAgo, day = 12) => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth() - monthsAgo, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  const m = inv.months;
  const items = [
    { date: d(m), title: 'Portfolio opened (simulated)', desc: `Initial simulated funding of ${fmtKES(inv.initial)} across ${inv.stocks.join(', ')}.` },
    { date: d(Math.max(1, Math.round(m * 0.66))), title: 'First growth milestone', desc: `Simulated value reached ${fmtKES(at(0.33))} — steady compounding phase.` },
    { date: d(Math.max(1, Math.round(m * 0.33))), title: 'Rebalanced allocation', desc: `Trimmed winners and re-weighted ${inv.stocks[0]} to target allocation (simulated).` },
  ];
  const minV = Math.min(...h);
  if (minV < at(0.15)) {
    items.push({ date: d(Math.max(1, Math.round(m * 0.45))), title: 'Weathered a simulated dip', desc: 'Held through short-term volatility; no panic selling in the simulation.' });
  }
  items.push({ date: d(0), title: inv.profit >= 0 ? 'New simulated all-time high' : 'Latest simulated valuation', desc: `Portfolio valued at ${fmtKES(inv.current)} (${fmtPct(inv.growth)} all-time, simulated).` });
  return items;
}

/* Simulated activity feed */
function activityFeed(n = 7) {
  const r = mulberry32(777);
  const feed = [];
  const sorted = [...INVESTORS].sort((a, b) => b.growth - a.growth);
  const templates = [
    (i) => ({ icon: '📈', color: 'rgba(0,224,127,.14)', text: `<strong>${i.name}</strong> reached a new simulated high of <strong>${fmtKES(i.current)}</strong>` }),
    (i) => ({ icon: '💼', color: 'rgba(79,124,255,.14)', text: `<strong>${i.name}</strong> opened a simulated position in <strong>${i.stocks[0]}</strong>` }),
    (i) => ({ icon: '🎯', color: 'rgba(201,169,106,.16)', text: `<strong>${i.name}</strong> crossed <strong>${fmtPct(i.growth)}</strong> simulated growth` }),
    (i) => ({ icon: '🔁', color: 'rgba(168,130,255,.14)', text: `<strong>${i.name}</strong> rebalanced a simulated ${fmtKES(i.initial)} portfolio` }),
    (i) => ({ icon: '⭐', color: 'rgba(255,190,60,.14)', text: `<strong>${i.name}</strong> was added to ${intBetween(3, 48)} demo watchlists` }),
  ];
  const times = ['2 min ago', '18 min ago', '1 hr ago', '3 hrs ago', '6 hrs ago', 'Yesterday', 'Yesterday', '2 days ago'];
  for (let k = 0; k < n; k++) {
    const inv = sorted[Math.floor(r() * 30)];
    const t = templates[Math.floor(r() * templates.length)](inv);
    feed.push({ ...t, time: times[k % times.length] });
  }
  return feed;
}

/* ---------- Formatting helpers ---------- */
function fmtKES(v, decimals = 0) {
  return 'KES ' + Number(v).toLocaleString('en-KE', { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}
function fmtCompactKES(v) {
  if (Math.abs(v) >= 1e9) return 'KES ' + (v / 1e9).toFixed(2) + 'B';
  if (Math.abs(v) >= 1e6) return 'KES ' + (v / 1e6).toFixed(2) + 'M';
  if (Math.abs(v) >= 1e3) return 'KES ' + (v / 1e3).toFixed(1) + 'K';
  return fmtKES(v);
}
function fmtPct(v, signed = true) {
  const sign = signed && v > 0 ? '+' : '';
  return sign + v.toFixed(1) + '%';
}
function fmtUSD(v) { return '$' + v.toFixed(2); }
function initials(name) { return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase(); }
function avatarStyle(inv, i = 0) {
  const h = inv.avatarHue ?? ((i * 47 + 150) % 360);
  return `background:linear-gradient(135deg,hsl(${h},70%,55%),hsl(${(h + 60) % 360},75%,42%))`;
}
