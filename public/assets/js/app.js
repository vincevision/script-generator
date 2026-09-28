// EPIC WEAR storefront — entry point.
import { $, $$, html, raw, icon, reduced, lite, root } from './lib/dom.js';
import { makeParticles, initCursor, initMagnetic } from './lib/fx.js';
import { runLoader } from './lib/loader.js';
import { initRouter, render, navigate } from './lib/router.js';
import { loadConfig, loadUser, loadCatalog, state, on } from './lib/store.js';
import { initCart, openCart, closeCart } from './ui/cart.js';
import { initSearch } from './ui/search.js';
import { initCardInteractions } from './ui/card.js';

window.epicNavigate = navigate;
window.epicOpenCart = openCart;

/* ---------- first render gates the loader reveal ---------- */
let markReady;
const ready = new Promise((r) => (markReady = r));
const intro = runLoader(ready);

initRouter();
initCart();
initSearch();
initCardInteractions();

Promise.allSettled([loadConfig(), loadUser(), loadCatalog()]).then(() => {
  applySettings();
  return render(location.href);
}).finally(() => markReady());

intro.then(() => {
  makeParticles($('#bgParticles'), { density: 26000, max: lite ? 22 : 56, speed: 0.8, stitches: 0.2, ember: 0.05, alpha: 0.4, scrollParallax: 0.25 });
});
initCursor();
initMagnetic();

/* ---------- header: scroll state, mobile menu ---------- */
const nav = $('#nav');
let ticking = false;
const onScroll = () => {
  ticking = false;
  const y = window.scrollY;
  nav.classList.toggle('is-scrolled', y > 24);
};
window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
onScroll();

const burger = $('#burger'), menu = $('#mobileMenu');
function setMenu(open) {
  root.classList.toggle('menu-open', open);
  burger.setAttribute('aria-expanded', String(open));
  burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  menu.setAttribute('aria-hidden', String(!open));
  if (open) closeCart();
}
window.epicCloseMenu = () => setMenu(false);
burger.addEventListener('click', () => setMenu(!root.classList.contains('menu-open')));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.classList.contains('menu-open')) setMenu(false); });
matchMedia('(min-width: 961px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

$('[data-to-top]').addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }));

/* ---------- footer reveal ---------- */
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { $('#footer').classList.add('is-in'); io.disconnect(); } }, { threshold: 0.1 });
  io.observe($('#footer'));
} else $('#footer').classList.add('is-in');

/* ---------- editable settings (phone, socials, announcement) ---------- */
const SOCIALS = [['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['facebook', 'Facebook'], ['x', 'X']];
function applySettings() {
  const s = state.config?.settings;
  if (!s) return;
  if (s.announcement) $('#announceText').textContent = s.announcement;
  $$('[data-phone]').forEach((el) => (el.textContent = s.phone));
  $$('[data-phone-link]').forEach((el) => (el.href = `tel:${s.phone.replace(/[^\d+]/g, '')}`));
  const links = SOCIALS.map(([k, label]) => [k, label, s.socials?.[k]]).filter(([, , u]) => u);
  $$('[data-socials]').forEach((el) => (el.innerHTML = links.map(([k, label, u]) => html`<a href="${u}" target="_blank" rel="noopener" aria-label="${label}">${icon(k)}</a>`.s).join('')));
  $$('[data-socials-list]').forEach((el) => (el.innerHTML = links.map(([k, label, u]) => html`<a href="${u}" target="_blank" rel="noopener">${icon(k)}<span>${label}</span></a>`.s).join('')));
}

on('user', (u) => {
  $$('.nav__icon--account').forEach((a) => { a.classList.toggle('is-signed-in', !!u); a.setAttribute('aria-label', u ? `Account — ${u.name}` : 'Account'); });
});

