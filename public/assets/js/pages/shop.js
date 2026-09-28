// SHOP — all filtering/sorting runs client-side on the cached catalogue.
// Filter state lives in the URL so results are shareable and survive refresh.
import { html, raw, icon, $, $$, debounce, root } from '../lib/dom.js';
import { state, loadCatalog, categoryLabel, searchProducts } from '../lib/store.js';
import { observeReveals } from '../lib/fx.js';
import { productGrid } from '../ui/card.js';
import { crumbs, emptyState, btn, pageTitle } from './_shared.js';

const PAGE = 12;
const SORTS = [['featured', 'Featured'], ['newest', 'Newest'], ['price-asc', 'Price: low → high'], ['price-desc', 'Price: high → low']];
const PRICES = [['0-3000', 'Under 3,000'], ['3000-6000', '3,000 – 6,000'], ['6000-10000', '6,000 – 10,000'], ['10000-', '10,000+']];
const GENDERS = [['men', 'Men'], ['women', 'Women'], ['unisex', 'Unisex']];
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '26', '28', '30', '32', '34', '36', '38', 'One Size'];

function readFilters(q) {
  return {
    category: q.category || '',
    size: q.size ? q.size.split(',').filter(Boolean) : [],
    price: q.price || '',
    gender: q.gender || '',
    collection: q.collection || '',
    availability: q.availability === 'in' ? 'in' : '',
    sort: SORTS.some(([k]) => k === q.sort) ? q.sort : 'featured',
    q: (q.q || '').slice(0, 80),
  };
}

function toQuery(f) {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.category) p.set('category', f.category);
  if (f.size.length) p.set('size', f.size.join(','));
  if (f.price) p.set('price', f.price);
  if (f.gender) p.set('gender', f.gender);
  if (f.collection) p.set('collection', f.collection);
  if (f.availability) p.set('availability', f.availability);
  if (f.sort !== 'featured') p.set('sort', f.sort);
  const s = p.toString();
  return s ? `?${s}` : '';
}

function applyFilters(f, { except } = {}) {
  let list = f.q ? searchProducts(f.q, 999) : state.products.slice();
  if (f.category && except !== 'category') list = list.filter((p) => p.category === f.category);
  if (f.size.length && except !== 'size') list = list.filter((p) => f.size.some((s) => p.sizes.includes(s) && p.availability[s] !== 'out'));
  if (f.price && except !== 'price') {
    const [min, max] = f.price.split('-').map((n) => (n === '' ? null : Number(n)));
    list = list.filter((p) => (min == null || p.price >= min) && (max == null || p.price <= max));
  }
  if (f.gender && except !== 'gender') list = list.filter((p) => p.gender === f.gender || (f.gender !== 'unisex' && p.gender === 'unisex'));
  if (f.collection && except !== 'collection') list = list.filter((p) => p.collections.includes(f.collection));
  if (f.availability && except !== 'availability') list = list.filter((p) => p.inStock);
  if (f.sort === 'newest') list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '') || b.id - a.id);
  else if (f.sort === 'price-asc') list.sort((a, b) => a.price - b.price);
  else if (f.sort === 'price-desc') list.sort((a, b) => b.price - a.price);
  else if (!f.q) list.sort((a, b) => Number(b.featured) - Number(a.featured) || Number(b.inStock) - Number(a.inStock));
  return list;
}

const chip = (label, attrs, on) => html`<button type="button" class="chip" aria-pressed="${on}" ${raw(attrs)}>${label}</button>`;

export default async function shop({ query }) {
  await loadCatalog();
  const f = readFilters(query);
  const cats = state.config.categories.filter((c) => state.products.some((p) => p.category === c.slug));
  const sizes = SIZE_ORDER.filter((s) => state.products.some((p) => p.sizes.includes(s)));
  const cols = state.collections;
  const heading = f.q ? `“${f.q}”` : f.category ? categoryLabel(f.category) : 'Shop';

  const filtersHtml = html`
    <div class="filters__head"><span>Filter</span><button type="button" class="drawer__close" data-close-filters aria-label="Close filters">${icon('close')}</button></div>
    <details class="fgroup" open><summary>Category ${icon('chevron')}</summary><div class="fgroup__body"><div class="chips">
      ${chip('All', 'data-f="category" data-v=""', !f.category)}
      ${cats.map((c) => chip(c.label, `data-f="category" data-v="${c.slug}"`, f.category === c.slug))}
    </div></div></details>
    <details class="fgroup" open><summary>Size ${icon('chevron')}</summary><div class="fgroup__body"><div class="chips">
      ${sizes.map((s) => chip(s, `data-f="size" data-v="${s}"`, f.size.includes(s)))}
    </div></div></details>
    <details class="fgroup" open><summary>Price (KES) ${icon('chevron')}</summary><div class="fgroup__body"><div class="chips">
      ${PRICES.map(([v, l]) => chip(l, `data-f="price" data-v="${v}"`, f.price === v))}
    </div></div></details>
    <details class="fgroup"><summary>Gender ${icon('chevron')}</summary><div class="fgroup__body"><div class="chips">
      ${GENDERS.map(([v, l]) => chip(l, `data-f="gender" data-v="${v}"`, f.gender === v))}
    </div></div></details>
    <details class="fgroup" ${raw(f.collection ? 'open' : '')}><summary>Collection ${icon('chevron')}</summary><div class="fgroup__body"><div class="chips">
      ${cols.map((c) => chip(c.name, `data-f="collection" data-v="${c.slug}"`, f.collection === c.slug))}
    </div></div></details>
    <details class="fgroup" open><summary>Availability ${icon('chevron')}</summary><div class="fgroup__body">
      <label class="check"><input type="checkbox" data-f="availability" ${raw(f.availability ? 'checked' : '')}><span class="check__box">${icon('check')}</span>In stock only</label>
    </div></details>
    <div class="filters__foot">
      <button type="button" class="btn btn--ghost" data-clear>Clear all</button>
      <button type="button" class="btn btn--primary" data-close-filters><span class="btn__inner"><span data-show-count>Show results</span></span></button>
    </div>`;

  return {
    title: pageTitle(f.q ? `Search: ${f.q}` : f.category ? `${categoryLabel(f.category)} — Shop` : 'Shop All — Premium Streetwear Kenya'),
    html: html`
<header class="phero container">
  ${crumbs([['Home', '/'], ['Shop', '/shop'], ...(f.category ? [[categoryLabel(f.category)]] : []), ...(f.q ? [['Search']] : [])])}
  <p class="eyebrow hero-in" style="--d:0"><span>[EPIC]</span> ${f.q ? 'Search results' : 'The official store'}</p>
  <h1 class="phero__title" data-split data-heading>${heading}</h1>
  <p class="phero__text hero-in" style="--d:2">${f.q ? 'Everything in the EPIC catalogue that matches your search.' : 'Every EPIC piece in one place — heavyweight essentials, street staples and limited runs. Priced in KES, delivered countrywide.'}</p>
  <nav class="chips chips--scroll shop-cats hero-in" style="--d:3" aria-label="Categories">
    <a class="chip ${!f.category ? 'is-active' : ''}" href="/shop" data-cat="">All</a>
    ${state.config.categories.map((c) => html`<a class="chip ${f.category === c.slug ? 'is-active' : ''}" href="/shop?category=${c.slug}" data-cat="${c.slug}">${c.label}</a>`)}
  </nav>
</header>
<div class="container">
  <div class="toolbar">
    <div class="toolbar__left">
      <button type="button" class="toolbar__btn toolbar__btn--filters" data-open-filters aria-controls="filters">${icon('filter')}<span>Filter</span><i class="count" data-fcount hidden></i></button>
      <span class="toolbar__count" data-count aria-live="polite"></span>
    </div>
    <div class="toolbar__right">
      <label class="sort">${icon('sort')}<span class="sr-only">Sort by</span>
        <select data-sort>${SORTS.map(([v, l]) => html`<option value="${v}" ${raw(f.sort === v ? 'selected' : '')}>${l}</option>`)}</select>
      </label>
    </div>
  </div>
  <div class="shop-layout">
    <aside class="filters" id="filters" aria-label="Filters">${filtersHtml}</aside>
    <div class="filters-scrim" data-close-filters></div>
    <div>
      <div class="active-filters" data-active></div>
      <div class="grid grid--products" data-grid></div>
      <div class="load-more" data-more></div>
    </div>
  </div>
</div>`,
    init(el) {
      let shown = PAGE;
      const grid = $('[data-grid]', el);

      const sync = (resetPage = true) => {
        if (resetPage) shown = PAGE;
        const list = applyFilters(f);
        grid.innerHTML = list.length ? productGrid(list.slice(0, shown), { eager: true }).s
          : emptyState({ iconName: 'search', title: 'Nothing matches — yet', text: 'Try removing a filter or searching for something broader like “hoodie” or “black”.', action: html`<button type="button" class="btn btn--ghost" data-clear><span class="btn__inner"><span>Clear filters</span></span></button>` }).s;
        grid.style.display = list.length ? '' : 'block';
        $('[data-count]', el).textContent = `${list.length} ${list.length === 1 ? 'piece' : 'pieces'}`;
        $('[data-show-count]', el).textContent = `Show ${list.length} ${list.length === 1 ? 'result' : 'results'}`;
        const more = $('[data-more]', el);
        more.innerHTML = list.length > shown ? html`<span>Showing ${shown} of ${list.length}</span>${btn('Load more', { variant: 'ghost', iconName: 'plus', attrs: 'data-load-more' })}`.s : '';
        const n = (f.category ? 1 : 0) + f.size.length + (f.price ? 1 : 0) + (f.gender ? 1 : 0) + (f.collection ? 1 : 0) + (f.availability ? 1 : 0);
        const fc = $('[data-fcount]', el);
        fc.hidden = !n; fc.textContent = n;
        renderActive();
        observeReveals(grid);
      };

      const renderActive = () => {
        const tags = [];
        if (f.q) tags.push(['q', '', `Search: ${f.q}`]);
        if (f.category) tags.push(['category', '', categoryLabel(f.category)]);
        f.size.forEach((s) => tags.push(['size', s, `Size ${s}`]));
        if (f.price) tags.push(['price', '', `KES ${PRICES.find(([v]) => v === f.price)?.[1] || f.price}`]);
        if (f.gender) tags.push(['gender', '', GENDERS.find(([v]) => v === f.gender)?.[1]]);
        if (f.collection) tags.push(['collection', '', state.collections.find((c) => c.slug === f.collection)?.name || f.collection]);
        if (f.availability) tags.push(['availability', '', 'In stock']);
        $('[data-active]', el).innerHTML = tags.length ? html`${tags.map(([k, v, l]) => html`<button type="button" class="chip is-active" data-remove="${k}" data-v="${v}">${l} ${icon('close')}</button>`)}${tags.length > 1 ? html`<button type="button" class="linkish" data-clear>Clear all</button>` : ''}`.s : '';
      };

      const commit = () => {
        history.replaceState(null, '', `/shop${toQuery(f)}`);
        // keep filter chips + category rail in step
        $$('[data-f]', el).forEach((b) => {
          const k = b.dataset.f;
          if (k === 'availability') { b.checked = !!f.availability; return; }
          const on = k === 'size' ? f.size.includes(b.dataset.v) : (f[k] || '') === b.dataset.v;
          b.setAttribute('aria-pressed', String(on));
        });
        $$('[data-cat]', el).forEach((a) => a.classList.toggle('is-active', a.dataset.cat === f.category));
        const h = $('[data-heading]', el);
        const next = f.q ? `“${f.q}”` : f.category ? categoryLabel(f.category) : 'Shop';
        if (h.textContent.trim() !== next) { h.textContent = next; h.classList.add('is-in'); }
        document.title = pageTitle(f.q ? `Search: ${f.q}` : f.category ? `${categoryLabel(f.category)} — Shop` : 'Shop All — Premium Streetwear Kenya');
        sync();
      };

      const setFilters = (open) => root.classList.toggle('filters-open', open);

      const onClick = (e) => {
        const t = e.target;
        const cat = t.closest('[data-cat]');
        if (cat) { e.preventDefault(); f.category = cat.dataset.cat; return commit(); }
        const fb = t.closest('button[data-f]');
        if (fb) {
          const k = fb.dataset.f, v = fb.dataset.v;
          if (k === 'size') f.size = f.size.includes(v) ? f.size.filter((x) => x !== v) : [...f.size, v];
          else f[k] = f[k] === v && k !== 'category' ? '' : v;
          return commit();
        }
        const rm = t.closest('[data-remove]');
        if (rm) {
          const k = rm.dataset.remove;
          if (k === 'size') f.size = f.size.filter((x) => x !== rm.dataset.v);
          else f[k] = '';
          return commit();
        }
        if (t.closest('[data-clear]')) { Object.assign(f, { category: '', size: [], price: '', gender: '', collection: '', availability: '', q: '' }); return commit(); }
        if (t.closest('[data-load-more]')) {
          shown += PAGE;
          const y = scrollY;
          sync(false);
          scrollTo(0, y);
          return;
        }
        if (t.closest('[data-open-filters]')) return setFilters(true);
        if (t.closest('[data-close-filters]')) return setFilters(false);
      };
      const onChange = (e) => {
        if (e.target.matches('[data-sort]')) { f.sort = e.target.value; commit(); }
        if (e.target.matches('input[data-f="availability"]')) { f.availability = e.target.checked ? 'in' : ''; commit(); }
      };
      const onKey = (e) => { if (e.key === 'Escape') setFilters(false); };
      const onResize = debounce(() => { if (innerWidth > 960) setFilters(false); }, 150);

      el.addEventListener('click', onClick);
      el.addEventListener('change', onChange);
      document.addEventListener('keydown', onKey);
      addEventListener('resize', onResize);
      sync();
      return () => {
        setFilters(false);
        document.removeEventListener('keydown', onKey);
        removeEventListener('resize', onResize);
      };
    },
  };
}
