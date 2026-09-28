// Global search overlay with live suggestions + entry to visual search.
import { $, $$, html, raw, icon, pic, money, esc, debounce } from '../lib/dom.js';
import { state, loadCatalog, searchProducts, categoryLabel } from '../lib/store.js';

const POPULAR = ['black hoodie', 'cargo pants', 'oversized tee', 'varsity jacket', 'tracksuit', 'cap', 'women', 'limited'];
const el = () => $('#search');
let lastFocus = null;

export function openSearch(q = '') {
  lastFocus = document.activeElement;
  const s = el();
  s.setAttribute('aria-hidden', 'false');
  document.documentElement.classList.add('search-open');
  const input = $('#searchInput');
  input.value = q;
  render(q);
  setTimeout(() => input.focus({ preventScroll: true }), 60);
  loadCatalog().then(() => render(input.value));
}
export function closeSearch() {
  const s = el();
  if (s.getAttribute('aria-hidden') === 'true') return;
  s.setAttribute('aria-hidden', 'true');
  document.documentElement.classList.remove('search-open');
  lastFocus?.focus?.({ preventScroll: true });
}

const mark = (text, q) => {
  const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 1).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!words.length) return esc(text);
  return esc(text).replace(new RegExp(`(${words.join('|')})`, 'gi'), '<mark>$1</mark>');
};

function render(q) {
  const box = $('#searchResults');
  q = q.trim();
  if (!q) {
    const cats = state.config?.categories || [];
    box.innerHTML = html`<div class="search__idle">
      <div class="search__col">
        <p class="search__label">Popular searches</p>
        <div class="chips">${POPULAR.map((p, i) => html`<button type="button" class="chip" data-q="${p}" style="--i:${i}">${icon('search')}${p}</button>`)}</div>
        <button type="button" class="search__visual" data-open-imgsearch>
          <span class="search__visual-icon">${icon('camera')}</span>
          <span><b>Search with image</b><small>Upload a photo or use your camera to find similar EPIC pieces</small></span>
          ${icon('arrow', 'icon--arrow')}
        </button>
      </div>
      <div class="search__col">
        <p class="search__label">Shop by category</p>
        <div class="search__cats">${cats.map((c, i) => html`<a href="/shop?category=${c.slug}" class="search__cat" style="--i:${i}">${icon(c.icon)}<span>${c.label}</span></a>`)}</div>
      </div>
    </div>`.s;
    return;
  }
  const results = searchProducts(q);
  const cats = (state.config?.categories || []).filter((c) => c.label.toLowerCase().includes(q.toLowerCase()) || q.toLowerCase().includes(c.label.toLowerCase().replace(/s$/, '')));
  if (!results.length) {
    box.innerHTML = html`<div class="search__none">
      <p class="search__none-title">No results for “${q}”</p>
      <p>Try a different word — like <button type="button" class="linkish" data-q="hoodie">hoodie</button>, <button type="button" class="linkish" data-q="cargo">cargo</button> or <button type="button" class="linkish" data-q="tee">tee</button> — or search with a photo.</p>
      <button type="button" class="btn btn--ghost" data-open-imgsearch><span class="btn__inner">${icon('camera')}<span>Search with image</span></span></button>
    </div>`.s;
    return;
  }
  box.innerHTML = html`<div class="search__live">
    ${cats.length ? html`<div class="chips chips--cats">${cats.map((c) => html`<a class="chip" href="/shop?category=${c.slug}">${icon(c.icon)}${c.label}</a>`)}</div>` : ''}
    <p class="search__label">${results.length} ${results.length === 1 ? 'product' : 'products'}</p>
    <ul class="search__list" role="listbox">
      ${results.slice(0, 6).map((p, i) => html`<li style="--i:${i}"><a href="/product/${p.slug}" class="sresult" role="option">
        <span class="sresult__img">${pic(p.images[0], { alt: '', sizes: '72px' })}</span>
        <span class="sresult__txt"><span class="sresult__name">${raw(mark(p.name, q))}</span><span class="sresult__meta">${categoryLabel(p.category)} · ${p.colors.map((c) => c.name).join(', ')}</span></span>
        <span class="sresult__price">${money(p.price)}</span>
      </a></li>`)}
    </ul>
    <a href="/shop?q=${encodeURIComponent(q)}" class="search__all">See all results for “${q}” ${icon('arrow', 'icon--arrow')}</a>
  </div>`.s;
}

export function initSearch() {
  const s = el(), input = $('#searchInput');
  const update = debounce(() => render(input.value), 70);
  input.addEventListener('input', update);
  input.addEventListener('keydown', (e) => {
    const items = $$('.sresult, .search__all', s);
    const idx = items.indexOf(document.activeElement);
    if (e.key === 'Enter' && input.value.trim()) {
      e.preventDefault();
      closeSearch();
      window.epicNavigate(`/shop?q=${encodeURIComponent(input.value.trim())}`);
    } else if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); items[0].focus(); }
  });
  s.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSearch();
    const items = $$('.sresult, .search__all', s);
    const idx = items.indexOf(document.activeElement);
    if (idx < 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); items[Math.min(items.length - 1, idx + 1)].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); idx === 0 ? input.focus() : items[idx - 1].focus(); }
  });
  s.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-q]');
    if (chip) { input.value = chip.dataset.q; render(input.value); input.focus(); return; }
    if (e.target.closest('[data-close-search]') || e.target === s) return closeSearch();
    if (e.target.closest('a[href]')) closeSearch();
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-open-search]')) { e.preventDefault(); openSearch(); }
    if (e.target.closest('[data-open-imgsearch]')) {
      e.preventDefault();
      closeSearch();
      import('./imgsearch.js').then((m) => m.openImageSearch());
    }
  });
  document.addEventListener('keydown', (e) => {
    if ((e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) && !e.target.closest('input, textarea, select, [contenteditable]')) {
      e.preventDefault();
      openSearch();
    }
  });
}
