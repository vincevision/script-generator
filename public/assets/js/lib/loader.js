// The launch-site intro, unchanged in spirit: dark → particles & streaks →
// E·P·I·C forms → percentage → glow sweep → the logo FLIPs into place.
// Short (2.3s first visit, 1.2s repeat, 0.45s reduced motion) and never
// blocks for more than 7s. `ready` is a promise the app resolves when the
// first page is rendered, so the reveal lands on real content.
import { $, $$, clamp, reduced, lite, root } from './dom.js';
import { makeParticles } from './fx.js';

export function runLoader(ready) {
  const loader = $('#loader');
  const stage = $('.loader__stage', loader);
  const loaderLogo = $('#loaderLogo');
  const letters = $$('.ll', loaderLogo);
  const pctEl = $('#loaderPct'), barEl = $('#loaderBar'), ringEl = $('#ringProgress');
  const originalTitle = () => document.title.replace(/^\d+% — Loading EPIC WEAR$/, '') || 'EPIC WEAR';
  let pageTitle = document.title;

  let seen = false;
  try { seen = sessionStorage.getItem('epic-intro') === '1'; } catch { /* ignore */ }
  const DURATION = reduced ? 450 : seen ? 1200 : 2300;
  const THRESHOLDS = [8, 28, 48, 68, 86];

  let appReady = false, fontsReady = false;
  ready.then(() => { appReady = true; pageTitle = document.title; }, () => { appReady = true; });
  (document.fonts ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]) : Promise.resolve()).then(() => (fontsReady = true));

  const particles = makeParticles($('#loaderParticles'), { density: 9000, max: lite ? 50 : 110, speed: 1.6, stitches: 0.3, ember: 0.08, alpha: 0.6 });

  return new Promise((resolve) => {
    const start = performance.now() + (reduced ? 0 : 350);
    let shown = 0, lastPct = -1;
    requestAnimationFrame(() => loader.classList.add('is-started'));

    const step = (now) => {
      const t = clamp((now - start) / DURATION, 0, 1);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      let target = eased * 100;
      if (!(appReady && fontsReady) && now - start < 7000) target = Math.min(target, 92);
      shown = Math.max(shown, target);
      const pct = Math.round(shown);
      if (pct !== lastPct) {
        lastPct = pct;
        pctEl.textContent = pct;
        barEl.style.transform = `scaleX(${pct / 100})`;
        ringEl.style.strokeDashoffset = 100 - pct;
        if (!appReady) document.title = `${pct}% — Loading EPIC WEAR`;
        letters.forEach((l, i) => { if (pct >= THRESHOLDS[i]) l.classList.add('on'); });
      }
      if (shown >= 100) return complete();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);

    function complete() {
      document.title = appReady ? pageTitle : originalTitle();
      letters.forEach((l) => l.classList.add('on'));
      try { sessionStorage.setItem('epic-intro', '1'); } catch { /* ignore */ }
      if (reduced) {
        loader.style.transition = 'opacity .4s ease';
        loader.style.opacity = '0';
        root.classList.add('is-revealing', 'is-ready');
        root.classList.remove('is-loading');
        setTimeout(finish, 420);
        return;
      }
      loader.classList.add('is-complete');
      setTimeout(settle, seen ? 600 : 1000);
    }

    // FLIP into the hero logo if it is on screen, otherwise into the header mark
    function settle() {
      const hero = $('#heroLogo');
      const heroRect = hero?.getBoundingClientRect();
      const target = heroRect && heroRect.width > 0 && heroRect.top < innerHeight && heroRect.bottom > 0 ? hero : $('#navMark');
      const from = loaderLogo.getBoundingClientRect();
      // the header is still translated off-screen — measure its resting position
      const to = target.getBoundingClientRect();
      const navOffset = target.id === 'navMark' ? ($('#nav').getBoundingClientRect().top < 0 ? -$('#nav').getBoundingClientRect().top : 0) : 0;
      const s = to.width / from.width;
      const dx = to.left + to.width / 2 - (from.left + from.width / 2);
      const dy = to.top + navOffset + to.height / 2 - (from.top + from.height / 2);
      const D = 1000;
      stage.style.transition = `transform ${D}ms cubic-bezier(0.65, 0, 0.15, 1)`;
      stage.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${s})`;
      loader.classList.add('is-leaving');
      root.classList.remove('is-loading');
      if (target.id === 'navMark') { loader.classList.add('to-nav'); root.classList.add('intro-nav', 'is-revealing'); }
      else setTimeout(() => root.classList.add('is-revealing'), D * 0.5);
      setTimeout(() => { root.classList.add('is-ready'); finish(); }, D + 20);
    }

    function finish() {
      loader.classList.add('is-done');
      loader.setAttribute('aria-hidden', 'true');
      if (particles) { particles.alive = false; particles.destroy(); }
      resolve();
    }
  });
}
