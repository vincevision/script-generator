// Motion system ported from the launch site: particles, cursor, magnetic
// buttons, scroll reveals and text splitting. Everything is transform/opacity
// only, rAF-throttled, paused when hidden, and disabled for reduced motion.
import { $, $$, lerp, reduced, finePointer, lite, root } from './dom.js';

/* ---------- Particles — dust, stitch dashes, diamonds ---------- */
class Particles {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = { density: 22000, max: 70, speed: 1, stitches: 0.25, ember: 0.06, alpha: 0.5, scrollParallax: 0, ...opts };
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.running = false;
    this.t = 0;
    this.resize = this.resize.bind(this);
    this.frame = this.frame.bind(this);
    this.resize();
    window.addEventListener('resize', this.resize, { passive: true });
  }
  resize() {
    const w = (this.w = this.canvas.clientWidth || innerWidth);
    const h = (this.h = this.canvas.clientHeight || innerHeight);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const count = Math.min(this.opts.max, Math.round((w * h) / this.opts.density));
    this.ps = Array.from({ length: count }, () => this.spawn(true));
  }
  spawn(anywhere) {
    const r = Math.random();
    const type = r < this.opts.stitches ? 1 : r < this.opts.stitches + 0.1 ? 2 : 0;
    return {
      x: Math.random() * this.w, y: anywhere ? Math.random() * this.h : this.h + 10,
      z: 0.25 + Math.random() * 0.75, vx: (Math.random() - 0.35) * 0.18, vy: -(0.05 + Math.random() * 0.22),
      s: type === 0 ? 0.5 + Math.random() * 1.2 : 2.5 + Math.random() * 3.5, type,
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.004, ph: Math.random() * Math.PI * 2,
      tw: 0.4 + Math.random() * 1.2, ember: Math.random() < this.opts.ember,
    };
  }
  start() { if (this.running) return; this.running = true; this.last = performance.now(); requestAnimationFrame(this.frame); }
  stop() { this.running = false; }
  destroy() { this.stop(); window.removeEventListener('resize', this.resize); this.ctx.clearRect(0, 0, this.w, this.h); }
  frame(now) {
    if (!this.running) return;
    const dt = Math.min(48, now - this.last) / 16.67;
    this.last = now;
    this.t += 0.016 * dt;
    const { ctx, w, h } = this;
    const sp = this.opts.speed * dt;
    const scrollOff = this.opts.scrollParallax ? window.scrollY * this.opts.scrollParallax : 0;
    ctx.clearRect(0, 0, w, h);
    for (const p of this.ps) {
      p.x += p.vx * p.z * sp; p.y += p.vy * p.z * sp; p.rot += p.vr * sp;
      if (p.y < -12 || p.x < -12 || p.x > w + 12) Object.assign(p, this.spawn(false));
      let y = p.y - scrollOff * p.z;
      y = ((y % (h + 24)) + h + 24) % (h + 24) - 12;
      const a = this.opts.alpha * p.z * (0.45 + 0.55 * Math.sin(p.ph + this.t * p.tw));
      if (a <= 0.02) continue;
      const col = p.ember ? `rgba(255,77,23,${a})` : `rgba(238,233,225,${a})`;
      if (p.type === 0) {
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p.x, y, p.s * p.z, 0, 6.2832); ctx.fill();
      } else {
        ctx.save(); ctx.translate(p.x, y); ctx.rotate(p.rot); ctx.strokeStyle = col; ctx.lineWidth = 0.8; ctx.beginPath();
        if (p.type === 1) { ctx.moveTo(-p.s, 0); ctx.lineTo(-p.s * 0.25, 0); ctx.moveTo(p.s * 0.25, 0); ctx.lineTo(p.s, 0); }
        else { const s = p.s * 0.6; ctx.moveTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s); ctx.lineTo(-s, 0); ctx.closePath(); }
        ctx.stroke(); ctx.restore();
      }
    }
    requestAnimationFrame(this.frame);
  }
}

const systems = [];
document.addEventListener('visibilitychange', () => systems.forEach((p) => (document.hidden ? p.stop() : p.alive && p.start())));
export function makeParticles(canvas, opts) {
  if (!canvas || reduced) return null;
  const p = new Particles(canvas, opts);
  p.alive = true;
  systems.push(p);
  p.start();
  return p;
}

/* ---------- Custom cursor + cursor light (fine pointers only) ---------- */
export const mouse = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0, active: false };
export function initCursor() {
  if (!finePointer) return;
  const cursor = $('.cursor'), ring = $('#cursorRing'), dot = $('#cursorDot'), light = $('#cursorLight'), label = $('.cursor__label');
  root.classList.add('has-cursor');
  const ringPos = { x: mouse.x, y: mouse.y }, lightPos = { x: mouse.x, y: mouse.y };
  const kRing = reduced ? 1 : 0.2, kLight = reduced ? 1 : 0.07;
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    mouse.x = e.clientX; mouse.y = e.clientY;
    mouse.nx = e.clientX / innerWidth - 0.5; mouse.ny = e.clientY / innerHeight - 0.5;
    if (!mouse.active) {
      mouse.active = true;
      ringPos.x = lightPos.x = mouse.x; ringPos.y = lightPos.y = mouse.y;
      cursor.classList.remove('is-hidden'); light.classList.add('is-on');
    }
    dot.style.transform = `translate3d(${mouse.x}px, ${mouse.y}px, 0)`;
  }, { passive: true });
  document.addEventListener('mouseleave', () => { cursor.classList.add('is-hidden'); light.classList.remove('is-on'); mouse.active = false; });
  window.addEventListener('mousedown', () => cursor.classList.add('is-down'));
  window.addEventListener('mouseup', () => cursor.classList.remove('is-down'));
  const STATES = ['is-button', 'is-link', 'is-view', 'is-logo'];
  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest('[data-cursor], a, button, input, textarea, select, label');
    let state = '';
    if (el) {
      if (el.dataset.cursor) state = el.dataset.cursor;
      else if (el.matches('input, textarea, select, label')) state = '';
      else if (el.tagName === 'BUTTON') state = 'button';
      else state = 'link';
    }
    if (state === 'view') label.textContent = el.dataset.cursorLabel || 'View';
    STATES.forEach((c) => cursor.classList.toggle(c, c === `is-${state}`));
  });
  (function loop() {
    ringPos.x = lerp(ringPos.x, mouse.x, kRing); ringPos.y = lerp(ringPos.y, mouse.y, kRing);
    lightPos.x = lerp(lightPos.x, mouse.x, kLight); lightPos.y = lerp(lightPos.y, mouse.y, kLight);
    ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0)`;
    if (!lite) light.style.transform = `translate3d(${lightPos.x}px, ${lightPos.y}px, 0)`;
    requestAnimationFrame(loop);
  })();
  cursor.classList.add('is-hidden');
}

/* ---------- Magnetic buttons (delegated, so it works for SPA content) ---------- */
export function initMagnetic() {
  if (!finePointer || reduced) return;
  let active = null;
  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest?.('.magnetic');
    if (active && active !== el) { active.style.translate = ''; const i = $('.btn__inner', active); if (i) i.style.translate = ''; active = null; }
    if (!el) return;
    active = el;
    const r = el.getBoundingClientRect();
    const x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
    el.style.translate = `${x * 0.28}px ${y * 0.34}px`;
    const inner = $('.btn__inner', el);
    if (inner) inner.style.translate = `${x * 0.1}px ${y * 0.12}px`;
  }, { passive: true });
}

/* ---------- Text split + scroll reveals ---------- */
export function splitWords(el) {
  if (el.dataset.splitDone) return;
  el.dataset.splitDone = '1';
  const text = el.textContent.trim();
  el.setAttribute('aria-label', text);
  el.innerHTML = text.split(/\s+/).map((w, i) => `<span class="w" aria-hidden="true"><span class="wi" style="--i:${i}">${w.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</span></span>`).join(' ');
}

let revealIO = null;
export function observeReveals(scope = document) {
  $$('[data-split]', scope).forEach(splitWords);
  const els = $$('[data-reveal]:not(.is-in), [data-split]:not(.is-in), .reveal-img:not(.is-in)', scope);
  const groups = new Map();
  $$('[data-reveal]', scope).forEach((el) => {
    const p = el.parentElement;
    if (!groups.has(p)) groups.set(p, []);
    groups.get(p).push(el);
  });
  groups.forEach((list) => list.forEach((el, i) => el.style.setProperty('--rd', `${Math.min(i, 8) * 0.07}s`)));
  if (reduced || !('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('is-in')); return; }
  revealIO ||= new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); revealIO.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  els.forEach((el) => revealIO.observe(el));
}

/* ---------- Manifesto word highlight on scroll ---------- */
export function manifesto(el) {
  if (!el || reduced) { el?.classList.add('is-static'); return () => {}; }
  const wrap = (node) => Array.from(node.childNodes).forEach((n) => {
    if (n.nodeType === 3) {
      const frag = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(part));
        else { const s = document.createElement('span'); s.className = 'mw'; s.textContent = part; frag.appendChild(s); }
      });
      node.replaceChild(frag, n);
    } else if (n.nodeType === 1) wrap(n);
  });
  wrap(el);
  const words = $$('.mw', el);
  let ticking = false;
  const update = () => {
    ticking = false;
    const r = el.getBoundingClientRect(), vh = innerHeight;
    const p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.2)));
    const n = Math.round(p * words.length);
    words.forEach((w, i) => w.classList.toggle('on', i < n));
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', onScroll, { passive: true });
  update();
  return () => window.removeEventListener('scroll', onScroll);
}
