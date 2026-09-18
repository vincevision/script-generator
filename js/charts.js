/* ═══════════════════ PRO STOCKS — Canvas Chart Engine ═══════════════════ */
'use strict';

/* roundRect fallback for older canvas implementations */
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); return this; };
}

function setupCanvas(canvas, height) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth || canvas.parentElement.clientWidth || 300;
  const h = height || canvas.clientHeight || 120;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

function niceNum(v) {
  if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(1) + 'B';
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(0) + 'K';
  return Math.round(v).toString();
}

/* ---------- Sparkline ---------- */
function drawSparkline(canvas, data, opts = {}) {
  if (!canvas || !data || data.length < 2) return;
  const { ctx, w, h } = setupCanvas(canvas, opts.height || canvas.clientHeight || 44);
  const pad = 3;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const X = (i) => pad + (i / (data.length - 1)) * (w - pad * 2);
  const Y = (v) => h - pad - ((v - min) / span) * (h - pad * 2);
  const up = data[data.length - 1] >= data[0];
  const color = opts.color || (up ? '#00E07F' : '#FF4D67');

  ctx.clearRect(0, 0, w, h);
  // area fill
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, color + '44');
  grad.addColorStop(1, color + '00');
  ctx.beginPath();
  ctx.moveTo(X(0), Y(data[0]));
  for (let i = 1; i < data.length; i++) ctx.lineTo(X(i), Y(data[i]));
  ctx.lineTo(X(data.length - 1), h); ctx.lineTo(X(0), h); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();
  // line
  ctx.beginPath();
  ctx.moveTo(X(0), Y(data[0]));
  for (let i = 1; i < data.length; i++) ctx.lineTo(X(i), Y(data[i]));
  ctx.strokeStyle = color; ctx.lineWidth = opts.lineWidth || 1.8;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
  // end dot
  ctx.beginPath();
  ctx.arc(X(data.length - 1), Y(data[data.length - 1]), 2.6, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.shadowColor = color; ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0;
}

/* ---------- Main area / performance chart with crosshair ---------- */
function drawAreaChart(canvas, data, opts = {}) {
  if (!canvas || !data || data.length < 2) return () => {};
  const height = opts.height || 260;
  const { ctx, w, h } = setupCanvas(canvas, height);
  const padL = opts.yAxis === false ? 8 : 52;
  const padR = 12, padT = 14, padB = opts.xLabels ? 26 : 12;
  const iw = w - padL - padR, ih = h - padT - padB;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const lo = min - span * 0.12, hi = max + span * 0.12;
  const X = (i) => padL + (i / (data.length - 1)) * iw;
  const Y = (v) => padT + (1 - (v - lo) / (hi - lo)) * ih;
  const up = data[data.length - 1] >= data[0];
  const color = opts.color || (up ? '#00E07F' : '#FF4D67');

  function paint(hoverIdx = -1) {
    ctx.clearRect(0, 0, w, h);
    // gridlines + y labels
    ctx.font = '10.5px Inter, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (let g = 0; g <= 4; g++) {
      const v = lo + ((hi - lo) * g) / 4;
      const y = Y(v);
      ctx.strokeStyle = 'rgba(255,255,255,.06)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      if (opts.yAxis !== false) {
        ctx.fillStyle = '#5A6379';
        ctx.fillText((opts.yPrefix || '') + niceNum(v), 4, y);
      }
    }
    // x labels
    if (opts.xLabels) {
      ctx.fillStyle = '#5A6379'; ctx.textAlign = 'center';
      const step = Math.max(1, Math.floor(opts.xLabels.length / 6));
      opts.xLabels.forEach((lb, i) => { if (i % step === 0 || i === opts.xLabels.length - 1) ctx.fillText(lb, X(i), h - 8); });
    }
    // area
    const grad = ctx.createLinearGradient(0, padT, 0, padT + ih);
    grad.addColorStop(0, color + '3D');
    grad.addColorStop(1, color + '00');
    ctx.beginPath();
    ctx.moveTo(X(0), Y(data[0]));
    for (let i = 1; i < data.length; i++) ctx.lineTo(X(i), Y(data[i]));
    ctx.lineTo(X(data.length - 1), padT + ih); ctx.lineTo(X(0), padT + ih); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
    // line
    ctx.beginPath();
    ctx.moveTo(X(0), Y(data[0]));
    for (let i = 1; i < data.length; i++) ctx.lineTo(X(i), Y(data[i]));
    ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.shadowColor = color; ctx.shadowBlur = 10; ctx.stroke(); ctx.shadowBlur = 0;

    // crosshair
    if (hoverIdx >= 0) {
      const hx = X(hoverIdx), hy = Y(data[hoverIdx]);
      ctx.strokeStyle = 'rgba(255,255,255,.25)';
      ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(hx, padT); ctx.lineTo(hx, padT + ih); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(hx, hy, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#0B1226'; ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = color; ctx.stroke();
    }
  }
  paint();

  // hover crosshair + tooltip
  const tip = opts.tooltipEl || null;
  function onMove(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    let idx = Math.round(((mx - padL) / iw) * (data.length - 1));
    idx = Math.max(0, Math.min(data.length - 1, idx));
    paint(idx);
    if (tip) {
      tip.style.display = 'block';
      const label = opts.xLabels ? opts.xLabels[idx] : 'Point ' + (idx + 1);
      tip.innerHTML = `<div class="t">${label}</div><div class="v" style="color:${color}">${opts.format ? opts.format(data[idx]) : niceNum(data[idx])}</div>`;
      const tx = Math.min(Math.max(X(idx) + 12, 4), w - 130);
      tip.style.left = tx + 'px';
      tip.style.top = Math.max(Y(data[idx]) - 58, 0) + 'px';
    }
  }
  function onLeave() { paint(); if (tip) tip.style.display = 'none'; }
  canvas.onmousemove = onMove;
  canvas.ontouchmove = onMove;
  canvas.onmouseleave = onLeave;
  canvas.ontouchend = onLeave;
  return paint;
}

/* ---------- Donut ---------- */
function drawDonut(canvas, segments, opts = {}) {
  if (!canvas || !segments.length) return;
  const size = opts.size || Math.min(canvas.parentElement.clientWidth || 220, 240);
  const { ctx, w, h } = setupCanvas(canvas, size);
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 8, r = R * 0.62;
  const total = segments.reduce((a, s) => a + s.value, 0);
  ctx.clearRect(0, 0, w, h);
  let a0 = -Math.PI / 2;
  // track
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.arc(cx, cy, r, Math.PI * 2, 0, true);
  ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fill();
  segments.forEach((s) => {
    const a1 = a0 + (s.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, R, a0 + 0.02, a1 - 0.02);
    ctx.arc(cx, cy, r, a1 - 0.02, a0 + 0.02, true);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.shadowColor = s.color; ctx.shadowBlur = 12; ctx.fill(); ctx.shadowBlur = 0;
    a0 = a1;
  });
  // center text
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#8B94AD'; ctx.font = '10px Inter'; ctx.fillText(opts.centerTop || 'HOLDINGS', cx, cy - 12);
  ctx.fillStyle = '#fff'; ctx.font = '800 19px Sora, Inter'; ctx.fillText(opts.centerValue || '', cx, cy + 10);
}

/* ---------- Horizontal mini bars (returns distribution) ---------- */
function drawBars(canvas, data, opts = {}) {
  if (!canvas || !data.length) return;
  const rowH = opts.rowH || 30;
  const { ctx, w, h } = setupCanvas(canvas, data.length * rowH + 8);
  ctx.clearRect(0, 0, w, h);
  const max = Math.max(...data.map((d) => d.value));
  ctx.font = '11px Inter';
  data.forEach((d, i) => {
    const y = i * rowH + 6;
    ctx.fillStyle = '#8B94AD'; ctx.textAlign = 'left';
    ctx.fillText(d.label, 0, y + 8);
    const bw = w - 118;
    const bx = 118 - 46;
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    ctx.beginPath(); ctx.roundRect(bx, y, bw, 12, 6); ctx.fill();
    const fw = Math.max(4, (d.value / max) * bw);
    const grad = ctx.createLinearGradient(bx, 0, bx + fw, 0);
    grad.addColorStop(0, d.color + '88'); grad.addColorStop(1, d.color);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.roundRect(bx, y, fw, 12, 6); ctx.fill();
    ctx.fillStyle = '#E8EDF7'; ctx.textAlign = 'right'; ctx.font = '700 11px Inter';
    ctx.fillText(d.display, w, y + 10);
    ctx.font = '11px Inter';
  });
}

/* ---------- Animated count-up ---------- */
function countUp(el, target, format, dur = 1100) {
  if (!el) return;
  const t0 = performance.now();
  const from = 0;
  function frame(t) {
    const p = Math.min(1, (t - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = format(from + (target - from) * eased);
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
