/* ==========================================================================
   EPIC WEAR — Coming Soon
   Vanilla JS. Everything animates with transforms/opacity; heavy work is
   rAF-throttled and paused when the tab is hidden.
   ========================================================================== */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const root = document.documentElement;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- Environment ---------- */
  const mqReduced = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = mqReduced.matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const conn = navigator.connection || {};
  const lite =
    reduced ||
    conn.saveData === true ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
    (navigator.deviceMemory && navigator.deviceMemory <= 4);
  if (lite) root.classList.add('lite');

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!location.hash) window.scrollTo(0, 0);

  const ORIGINAL_TITLE = document.title;

  /* ==========================================================================
     PARTICLES — tiny "fashion" particles: dust, stitch dashes, diamonds
     ========================================================================== */
  class Particles {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.opts = Object.assign({ density: 22000, max: 70, speed: 1, stitches: 0.25, ember: 0.06, alpha: 0.5, scrollParallax: 0 }, opts);
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
        x: Math.random() * this.w,
        y: anywhere ? Math.random() * this.h : this.h + 10,
        z: 0.25 + Math.random() * 0.75,
        vx: (Math.random() - 0.35) * 0.18,
        vy: -(0.05 + Math.random() * 0.22),
        s: type === 0 ? 0.5 + Math.random() * 1.2 : 2.5 + Math.random() * 3.5,
        type,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.004,
        ph: Math.random() * Math.PI * 2,
        tw: 0.4 + Math.random() * 1.2,
        ember: Math.random() < this.opts.ember,
      };
    }
    start() {
      if (this.running) return;
      this.running = true;
      this.last = performance.now();
      requestAnimationFrame(this.frame);
    }
    stop() { this.running = false; }
    destroy() {
      this.stop();
      window.removeEventListener('resize', this.resize);
      this.ctx.clearRect(0, 0, this.w, this.h);
    }
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
        p.x += p.vx * p.z * sp;
        p.y += p.vy * p.z * sp;
        p.rot += p.vr * sp;
        if (p.y < -12 || p.x < -12 || p.x > w + 12) Object.assign(p, this.spawn(false));
        let y = p.y - scrollOff * p.z;
        y = ((y % (h + 24)) + h + 24) % (h + 24) - 12;
        const a = this.opts.alpha * p.z * (0.45 + 0.55 * Math.sin(p.ph + this.t * p.tw));
        if (a <= 0.02) continue;
        const col = p.ember ? `rgba(255,77,23,${a})` : `rgba(238,233,225,${a})`;
        if (p.type === 0) {
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(p.x, y, p.s * p.z, 0, 6.2832);
          ctx.fill();
        } else {
          ctx.save();
          ctx.translate(p.x, y);
          ctx.rotate(p.rot);
          ctx.strokeStyle = col;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          if (p.type === 1) {
            // stitch: a short dashed seam
            ctx.moveTo(-p.s, 0); ctx.lineTo(-p.s * 0.25, 0);
            ctx.moveTo(p.s * 0.25, 0); ctx.lineTo(p.s, 0);
          } else {
            // diamond
            const s = p.s * 0.6;
            ctx.moveTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s); ctx.lineTo(-s, 0); ctx.closePath();
          }
          ctx.stroke();
          ctx.restore();
        }
      }
      requestAnimationFrame(this.frame);
    }
  }

  const particleSystems = [];
  document.addEventListener('visibilitychange', () => {
    particleSystems.forEach((p) => (document.hidden ? p.stop() : p.alive && p.start()));
  });
  function makeParticles(canvas, opts) {
    if (!canvas || reduced) return null;
    const p = new Particles(canvas, opts);
    p.alive = true;
    particleSystems.push(p);
    p.start();
    return p;
  }

  /* ==========================================================================
     TEXT SPLITTING (word masks) — done up-front so layout never shifts
     ========================================================================== */
  function splitWords(el) {
    const words = el.textContent.trim().split(/\s+/);
    el.setAttribute('aria-label', el.textContent.trim());
    el.innerHTML = words
      .map((w, i) => `<span class="w" aria-hidden="true"><span class="wi" style="--i:${i}">${w}</span></span>`)
      .join(' ');
  }
  $$('[data-split]').forEach(splitWords);

  // Manifesto — per-word spans (keeping the <em> punchline)
  const manifesto = $('#manifesto');
  if (manifesto) {
    const wrap = (node) => {
      Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(part));
            else {
              const s = document.createElement('span');
              s.className = 'mw';
              s.textContent = part;
              frag.appendChild(s);
            }
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) wrap(n);
      });
    };
    wrap(manifesto);
  }

  /* ==========================================================================
     LOADER — dark → ring → particles → E·P·I·C → scale + glow → settle
     ========================================================================== */
  const loader = $('#loader');
  const stage = $('.loader__stage', loader);
  const loaderLogo = $('#loaderLogo');
  const heroLogo = $('#heroLogo');
  const letters = $$('.ll', loaderLogo);
  const pctEl = $('#loaderPct');
  const barEl = $('#loaderBar');
  const ringEl = $('#ringProgress');

  let seenIntro = false;
  try { seenIntro = sessionStorage.getItem('epic-intro') === '1'; } catch (e) {}
  const DURATION = reduced ? 450 : seenIntro ? 1200 : 2300;
  const THRESHOLDS = [8, 28, 48, 68, 86]; // E, P, I, C, dot

  let pageLoaded = document.readyState === 'complete';
  let fontsReady = false;
  window.addEventListener('load', () => (pageLoaded = true), { once: true });
  (document.fonts ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]) : Promise.resolve())
    .then(() => (fontsReady = true));

  const loaderParticles = makeParticles($('#loaderParticles'), {
    density: 9000, max: lite ? 50 : 110, speed: 1.6, stitches: 0.3, ember: 0.08, alpha: 0.6,
  });

  function runLoader() {
    const start = performance.now() + (reduced ? 0 : 350); // brief darkness first
    let shown = 0;
    let lastPct = -1;
    requestAnimationFrame(() => loader.classList.add('is-started'));

    const step = (now) => {
      const t = clamp((now - start) / DURATION, 0, 1);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      let target = eased * 100;
      const hardCap = now - start > 7000; // never hold the visitor hostage
      if (!(pageLoaded && fontsReady) && !hardCap) target = Math.min(target, 92);
      shown = Math.max(shown, target);
      const pct = Math.round(shown);

      if (pct !== lastPct) {
        lastPct = pct;
        pctEl.textContent = pct;
        barEl.style.transform = `scaleX(${pct / 100})`;
        ringEl.style.strokeDashoffset = 100 - pct;
        document.title = `${pct}% — Loading EPIC WEAR`;
        letters.forEach((l, i) => { if (pct >= THRESHOLDS[i]) l.classList.add('on'); });
      }
      if (shown >= 100) return completeLoader();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function completeLoader() {
    document.title = ORIGINAL_TITLE;
    letters.forEach((l) => l.classList.add('on'));
    try { sessionStorage.setItem('epic-intro', '1'); } catch (e) {}

    if (reduced) {
      loader.style.transition = 'opacity .4s ease';
      loader.style.opacity = '0';
      root.classList.add('is-revealing', 'is-ready');
      root.classList.remove('is-loading');
      setTimeout(finishLoader, 420);
      return;
    }

    loader.classList.add('is-complete'); // cinematic scale-up + light sweep
    setTimeout(settleLogo, seenIntro ? 650 : 1050);
  }

  // FLIP the loader logo into the exact position of the hero logo
  function settleLogo() {
    const from = loaderLogo.getBoundingClientRect();
    const to = heroLogo.getBoundingClientRect();
    const s = to.width / from.width;
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const D = 1000;

    stage.style.transition = `transform ${D}ms cubic-bezier(0.65, 0, 0.15, 1)`;
    stage.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${s})`;
    loader.classList.add('is-leaving');
    root.classList.remove('is-loading');

    setTimeout(() => root.classList.add('is-revealing'), D * 0.55);
    setTimeout(() => {
      root.classList.add('is-ready');
      finishLoader();
    }, D + 20);
  }

  function finishLoader() {
    loader.classList.add('is-done');
    loader.setAttribute('aria-hidden', 'true');
    if (loaderParticles) { loaderParticles.alive = false; loaderParticles.destroy(); }
    if (location.hash) {
      const t = document.getElementById(location.hash.slice(1));
      if (t) t.scrollIntoView();
    }
  }

  runLoader();

  /* ==========================================================================
     AMBIENT PARTICLES
     ========================================================================== */
  makeParticles($('#bgParticles'), {
    density: 26000, max: lite ? 26 : 64, speed: 0.8, stitches: 0.2, ember: 0.05, alpha: 0.42, scrollParallax: 0.25,
  });

  /* ==========================================================================
     CUSTOM CURSOR + CURSOR LIGHT (fine pointers only)
     ========================================================================== */
  const cursor = $('.cursor');
  const ring = $('#cursorRing');
  const dot = $('#cursorDot');
  const light = $('#cursorLight');
  const mouse = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0, active: false };

  if (finePointer) {
    root.classList.add('has-cursor');
    const ringPos = { x: mouse.x, y: mouse.y };
    const lightPos = { x: mouse.x, y: mouse.y };
    const kRing = reduced ? 1 : 0.2;
    const kLight = reduced ? 1 : 0.07;

    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      mouse.x = e.clientX; mouse.y = e.clientY;
      mouse.nx = e.clientX / innerWidth - 0.5;
      mouse.ny = e.clientY / innerHeight - 0.5;
      if (!mouse.active) {
        mouse.active = true;
        ringPos.x = lightPos.x = mouse.x; ringPos.y = lightPos.y = mouse.y;
        cursor.classList.remove('is-hidden');
        light.classList.add('is-on');
      }
      dot.style.transform = `translate3d(${mouse.x}px, ${mouse.y}px, 0)`;
    }, { passive: true });

    document.addEventListener('mouseleave', () => { cursor.classList.add('is-hidden'); light.classList.remove('is-on'); mouse.active = false; });
    window.addEventListener('mousedown', () => cursor.classList.add('is-down'));
    window.addEventListener('mouseup', () => cursor.classList.remove('is-down'));

    const STATES = ['is-button', 'is-link', 'is-view', 'is-logo'];
    document.addEventListener('mouseover', (e) => {
      const el = e.target.closest('[data-cursor], a, button, input, label');
      let state = '';
      if (el) {
        if (el.dataset.cursor) state = el.dataset.cursor;
        else if (el.matches('input, label')) state = '';
        else if (el.tagName === 'BUTTON') state = 'button';
        else state = 'link';
      }
      STATES.forEach((c) => cursor.classList.toggle(c, c === `is-${state}`));
    });

    (function loop() {
      ringPos.x = lerp(ringPos.x, mouse.x, kRing);
      ringPos.y = lerp(ringPos.y, mouse.y, kRing);
      lightPos.x = lerp(lightPos.x, mouse.x, kLight);
      lightPos.y = lerp(lightPos.y, mouse.y, kLight);
      ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0)`;
      if (!lite) light.style.transform = `translate3d(${lightPos.x}px, ${lightPos.y}px, 0)`;
      requestAnimationFrame(loop);
    })();
    cursor.classList.add('is-hidden');
  }

  /* ==========================================================================
     MAGNETIC BUTTONS
     ========================================================================== */
  if (finePointer && !reduced) {
    $$('.magnetic').forEach((el) => {
      const inner = $('.btn__inner', el);
      const strength = el.classList.contains('social__link') ? 0.22 : 0.3;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - (r.left + r.width / 2);
        const y = e.clientY - (r.top + r.height / 2);
        el.style.translate = `${x * strength}px ${y * strength * 1.2}px`;
        if (inner) inner.style.translate = `${x * 0.1}px ${y * 0.12}px`;
      });
      el.addEventListener('pointerleave', () => {
        el.style.translate = '';
        if (inner) inner.style.translate = '';
      });
    });
  }

  /* ==========================================================================
     SCROLL: nav state, hero parallax, image parallax, manifesto
     ========================================================================== */
  const nav = $('#nav');
  const heroInner = $('.hero__inner');
  const fxEls = $$('.fx');
  const parallaxImgs = $$('[data-parallax]');
  const manifestoWords = manifesto ? $$('.mw', manifesto) : [];
  let ticking = false;
  const fxMouse = { x: 0, y: 0 };

  function onScrollFrame() {
    ticking = false;
    const sy = window.scrollY;
    const vh = innerHeight;
    nav.classList.toggle('is-scrolled', sy > 24);

    if (!reduced) {
      if (sy < vh * 1.1) {
        heroInner.style.transform = `translate3d(0, ${sy * 0.22}px, 0)`;
        heroInner.style.opacity = String(clamp(1 - sy / (vh * 0.85), 0, 1));
      }
      parallaxImgs.forEach((img) => {
        const card = img.closest('.card__media');
        const r = card.getBoundingClientRect();
        if (r.bottom < -50 || r.top > vh + 50) return;
        const progress = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2); // -1 … 1
        const max = r.height * 0.1;
        img.style.transform = `translate3d(0, ${clamp(-progress * max, -max, max)}px, 0)`;
      });
    }

    if (manifesto && manifestoWords.length && !reduced) {
      const r = manifesto.getBoundingClientRect();
      const p = clamp((vh * 0.82 - r.top) / (r.height + vh * 0.25), 0, 1);
      const n = Math.round(p * manifestoWords.length);
      manifestoWords.forEach((w, i) => w.classList.toggle('on', i < n));
    }
  }
  function requestScrollFrame() {
    if (!ticking) { ticking = true; requestAnimationFrame(onScrollFrame); }
  }
  window.addEventListener('scroll', requestScrollFrame, { passive: true });
  window.addEventListener('resize', requestScrollFrame, { passive: true });
  onScrollFrame();

  // Floating fashion icons: mouse parallax by depth + scroll drift
  if (!reduced && fxEls.length) {
    (function fxLoop() {
      fxMouse.x = lerp(fxMouse.x, mouse.nx, 0.05);
      fxMouse.y = lerp(fxMouse.y, mouse.ny, 0.05);
      const sy = window.scrollY;
      if (sy < innerHeight * 1.2) {
        fxEls.forEach((el) => {
          const d = parseFloat(el.dataset.depth) || 0.5;
          el.style.translate = `${(-fxMouse.x * 60 * d).toFixed(2)}px ${(-fxMouse.y * 60 * d - sy * d * 0.35).toFixed(2)}px`;
        });
      }
      requestAnimationFrame(fxLoop);
    })();
  }

  /* ---------- Active nav link ---------- */
  const navLinks = $$('.nav__links a');
  const sectionIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const map = { drop: 'home', notify: 'about', footer: 'contact' };
      const id = map[en.target.id] || en.target.id;
      navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${id}`));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  ['home', 'drop', 'collection', 'about', 'notify', 'contact', 'footer'].forEach((id) => {
    const s = document.getElementById(id);
    if (s) sectionIO.observe(s);
  });

  /* ==========================================================================
     SCROLL-TRIGGERED REVEALS (with sibling stagger)
     ========================================================================== */
  const revealEls = $$('[data-reveal], [data-split], .footer');
  const groups = new Map();
  $$('[data-reveal]').forEach((el) => {
    const parent = el.parentElement;
    if (!groups.has(parent)) groups.set(parent, []);
    groups.get(parent).push(el);
  });
  groups.forEach((list) => list.forEach((el, i) => el.style.setProperty('--rd', `${i * 0.1}s`)));

  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add('is-in');
        revealIO.unobserve(en.target);
      }
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
  revealEls.forEach((el) => revealIO.observe(el));

  /* ==========================================================================
     SMOOTH ANCHOR NAVIGATION + MOBILE MENU
     ========================================================================== */
  const burger = $('#burger');
  const menu = $('#mobileMenu');
  const setMenu = (open) => {
    root.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.setAttribute('aria-hidden', String(!open));
    document.body.style.overflow = open ? 'hidden' : '';
  };
  burger.addEventListener('click', () => setMenu(!root.classList.contains('menu-open')));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.classList.contains('menu-open')) setMenu(false); });
  matchMedia('(min-width: 861px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.dataset.dialog) return;
    const id = a.getAttribute('href').slice(1);
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    e.preventDefault();
    const wasOpen = root.classList.contains('menu-open');
    if (wasOpen) setMenu(false);
    const go = () => {
      if (id === 'home') window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
      else target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(null, '', id === 'home' ? location.pathname : `#${id}`);
    };
    wasOpen ? setTimeout(go, 120) : go();
  });

  /* ==========================================================================
     COUNTDOWN — set data-launch on #drop; empty/invalid → "LAUNCHING SOON"
     ========================================================================== */
  const drop = $('#drop');
  const countdown = $('#countdown');
  const soon = $('#launchingSoon');
  const dropDate = $('#dropDate');
  const launchAttr = (drop && drop.dataset.launch || '').trim();
  const launchAt = launchAttr ? Date.parse(launchAttr) : NaN;
  const units = {
    days: $('[data-unit="days"]', countdown),
    hours: $('[data-unit="hours"]', countdown),
    minutes: $('[data-unit="minutes"]', countdown),
    seconds: $('[data-unit="seconds"]', countdown),
  };

  function showLaunchingSoon() {
    countdown.hidden = true;
    soon.hidden = false;
    soon.setAttribute('data-reveal', '');
    requestAnimationFrame(() => soon.classList.add('is-in'));
  }

  function setDigit(slot, ch, animate) {
    const cur = slot.querySelector('i:not(.is-out)');
    if (cur && cur.textContent === ch) return;
    slot.querySelectorAll('.is-out').forEach((n) => n.remove());
    if (!animate || reduced || !cur) {
      slot.innerHTML = `<i>${ch}</i>`;
      return;
    }
    const next = document.createElement('i');
    next.textContent = ch;
    next.className = 'is-in';
    cur.className = 'is-out';
    cur.addEventListener('animationend', () => cur.remove(), { once: true });
    next.addEventListener('animationend', () => next.classList.remove('is-in'), { once: true });
    slot.appendChild(next);
  }

  function setUnit(el, value, animate) {
    const str = String(value).padStart(2, '0');
    let slots = $$('.cd-digit', el);
    while (slots.length < str.length) {
      const s = document.createElement('span');
      s.className = 'cd-digit';
      s.innerHTML = '<i>0</i>';
      el.prepend(s);
      slots = $$('.cd-digit', el);
    }
    while (slots.length > str.length) { slots[0].remove(); slots = $$('.cd-digit', el); }
    slots.forEach((s, i) => setDigit(s, str[i], animate));
  }

  if (!drop || isNaN(launchAt) || launchAt <= Date.now()) {
    showLaunchingSoon();
    dropDate.textContent = 'Drop 01 · Date to be announced';
  } else {
    try {
      const fmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      dropDate.textContent = `Drop 01 · ${fmt.format(new Date(launchAt))}`;
    } catch (e) { /* keep default */ }

    let first = true;
    let timer = null;
    const tick = () => {
      const diff = launchAt - Date.now();
      if (diff <= 0) {
        clearTimeout(timer);
        showLaunchingSoon();
        return;
      }
      const s = Math.floor(diff / 1000);
      const d = Math.floor(s / 86400);
      const h = Math.floor((s % 86400) / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      const animate = !first && !document.hidden;
      setUnit(units.days, d, animate);
      setUnit(units.hours, h, animate);
      setUnit(units.minutes, m, animate);
      setUnit(units.seconds, sec, animate);
      if (first || sec === 0) countdown.setAttribute('aria-label', `${d} days, ${h} hours, ${m} minutes until the drop`);
      first = false;
      timer = setTimeout(tick, 1000 - (Date.now() % 1000) + 5); // align to the second
    };
    tick();
  }

  /* ==========================================================================
     SIGNUP FORM
     Optional backend: set data-endpoint on the form. The payload is
     POSTed as JSON { email, source }. Without an endpoint the signup is
     kept in localStorage so the flow is fully testable.
     ========================================================================== */
  const form = $('#signupForm');
  const emailInput = $('#email');
  const errorEl = $('#signupError');
  const success = $('#signupSuccess');
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const setError = (msg) => {
    errorEl.textContent = msg || '';
    form.classList.remove('has-error');
    if (msg) { void form.offsetWidth; form.classList.add('has-error'); }
  };
  emailInput.addEventListener('input', () => { if (errorEl.textContent) setError(''); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    if (!email) { setError('Please enter your email address.'); emailInput.focus(); return; }
    if (!EMAIL_RE.test(email)) { setError("That email doesn't look quite right."); emailInput.focus(); return; }
    setError('');
    form.classList.add('is-loading');

    try {
      const endpoint = form.dataset.endpoint;
      if (endpoint) {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ email, source: 'epic-wear-coming-soon' }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } else {
        await new Promise((r) => setTimeout(r, 900));
      }
      try {
        const list = JSON.parse(localStorage.getItem('epic-wear-waitlist') || '[]');
        if (!list.includes(email)) list.push(email);
        localStorage.setItem('epic-wear-waitlist', JSON.stringify(list));
      } catch (err) { /* storage unavailable — fine */ }

      $('#successEmail').textContent = email;
      form.style.transition = 'opacity .4s ease, translate .5s ease';
      form.style.opacity = '0';
      form.style.translate = '0 -10px';
      setTimeout(() => {
        form.hidden = true;
        success.hidden = false;
        requestAnimationFrame(() => requestAnimationFrame(() => success.classList.add('is-shown')));
        success.focus({ preventScroll: true });
      }, 380);
    } catch (err) {
      setError('Something went wrong. Please try again in a moment.');
    } finally {
      form.classList.remove('is-loading');
    }
  });

  /* ==========================================================================
     DIALOGS — legal + image lightbox
     ========================================================================== */
  const openDialog = (dlg) => {
    if (!dlg || typeof dlg.showModal !== 'function') return;
    root.classList.remove('has-cursor'); // top-layer would hide the custom cursor
    dlg.showModal();
  };
  $$('dialog').forEach((dlg) => {
    dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-close]')) dlg.close(); });
    dlg.addEventListener('close', () => { if (finePointer) root.classList.add('has-cursor'); });
  });
  $$('[data-dialog]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    openDialog(document.getElementById(`dialog-${a.dataset.dialog}`));
  }));

  const lbImg = $('#lightboxImg');
  const lbTitle = $('#lightboxTitle');
  $$('.card').forEach((card) => card.addEventListener('click', () => {
    const img = $('img', card);
    lbImg.src = card.dataset.full;
    lbImg.alt = img ? img.alt : '';
    lbTitle.textContent = card.dataset.title || '';
    openDialog($('#dialog-image'));
  }));
})();
