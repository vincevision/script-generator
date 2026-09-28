// History-API router. Page modules are code-split and loaded on demand.
// Each module: export default async (ctx) => ({ title, html, init?(root) → cleanup? })
import { $, $$, root, reduced, sleep } from './dom.js';
import { observeReveals } from './fx.js';

const ROUTES = [
  [/^\/$/, 'home'],
  [/^\/shop$/, 'shop'],
  [/^\/product\/([\w-]+)$/, 'product', ['slug']],
  [/^\/collections$/, 'collections'],
  [/^\/collections\/([\w-]+)$/, 'collection', ['slug']],
  [/^\/new-drop$/, 'collection', [], { slug: 'new-drop' }],
  [/^\/collab$/, 'collab'],
  [/^\/about$/, 'about'],
  [/^\/contact$/, 'contact'],
  [/^\/wishlist$/, 'wishlist'],
  [/^\/track$/, 'track'],
  [/^\/checkout$/, 'checkout'],
  [/^\/order\/(EPIC-[\w]+)$/i, 'order', ['number']],
  [/^\/account(?:\/([\w-]+))?$/, 'account', ['tab']],
  [/^\/help(?:\/([\w-]+))?$/, 'help', ['topic']],
];

const main = () => $('#app');
let cleanup = null;
let navId = 0;
let first = true;
const scrollPos = new Map();

function match(pathname) {
  const p = pathname.replace(/\/+$/, '') || '/';
  for (const [re, mod, names = [], fixed = {}] of ROUTES) {
    const m = p.match(re);
    if (m) return { mod, params: { ...fixed, ...Object.fromEntries(names.map((n, i) => [n, m[i + 1]])) } };
  }
  return { mod: 'notfound', params: {} };
}

function setActiveNav(pathname) {
  const section = pathname === '/' ? '/' : `/${pathname.split('/')[1]}`;
  const map = { '/product': '/shop', '/collab': '/collections' };
  const key = pathname === '/collections/new-drop' ? '/new-drop' : (map[section] || section);
  $$('[data-nav]').forEach((a) => a.classList.toggle('is-active', a.dataset.nav === key));
  $$('[data-tab]').forEach((a) => a.classList.toggle('is-active', a.dataset.tab === key));
  $$('.menu__links a').forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === key));
}

export async function render(url = location.href, { restoreScroll = false } = {}) {
  const id = ++navId;
  const u = new URL(url, location.origin);
  const { mod, params } = match(u.pathname);
  const query = Object.fromEntries(u.searchParams.entries());
  const el = main();
  const bar = $('#routeBar');
  bar.classList.remove('is-done');
  bar.classList.add('is-loading');

  const leaving = first ? Promise.resolve() : (el.classList.add('is-leaving'), sleep(reduced ? 0 : 220));
  let page;
  try {
    const [m] = await Promise.all([import(`../pages/${mod}.js`), leaving]);
    page = await m.default({ params, query, path: u.pathname, url: u });
  } catch (err) {
    console.error(err);
    const m = await import('../pages/notfound.js');
    page = await m.default({ error: err, path: u.pathname });
  }
  if (id !== navId) return; // a newer navigation won

  try { cleanup?.(); } catch { /* ignore */ }
  cleanup = null;
  el.innerHTML = page.html;
  el.className = `page page--${mod}`;
  if (page.title) document.title = page.title;
  setActiveNav(u.pathname);
  root.classList.toggle('is-home', mod === 'home');
  root.classList.toggle('is-checkout', mod === 'checkout');

  const hashTarget = u.hash && document.getElementById(u.hash.slice(1));
  if (restoreScroll && scrollPos.has(u.pathname + u.search)) window.scrollTo(0, scrollPos.get(u.pathname + u.search));
  else if (hashTarget) setTimeout(() => hashTarget.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' }), first ? 0 : 60);
  else if (!first) window.scrollTo(0, 0);

  observeReveals(el);
  try { cleanup = page.init?.(el) || null; } catch (e) { console.error(e); }
  if (!first) {
    el.classList.add('is-entering');
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('is-entering')));
    el.focus({ preventScroll: true });
  }
  first = false;
  bar.classList.remove('is-loading');
  bar.classList.add('is-done');
}

export function navigate(to, { replace = false } = {}) {
  const u = new URL(to, location.origin);
  if (u.origin !== location.origin) { location.href = to; return; }
  scrollPos.set(location.pathname + location.search, window.scrollY);
  const same = u.pathname === location.pathname && u.search === location.search;
  if (same && u.hash) {
    history.replaceState(null, '', u.href);
    document.getElementById(u.hash.slice(1))?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
    return;
  }
  history[replace ? 'replaceState' : 'pushState'](null, '', u.pathname + u.search + u.hash);
  render(u.href);
}

export function initRouter() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download') || a.dataset.external !== undefined) return;
    const href = a.getAttribute('href');
    if (/^(mailto:|tel:|https?:\/\/(?!$))/.test(href) && !href.startsWith(location.origin)) return;
    const u = new URL(a.href);
    if (u.origin !== location.origin || u.pathname.startsWith('/admin') || u.pathname.startsWith('/api')) return;
    e.preventDefault();
    root.classList.contains('menu-open') && window.epicCloseMenu?.();
    navigate(u.pathname + u.search + u.hash);
  });
  window.addEventListener('popstate', () => render(location.href, { restoreScroll: true }));
}
