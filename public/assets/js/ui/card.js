// Product card: image (hover swaps to the detail shot), name, KES price,
// sizes, category, wishlist heart and an inline size picker for quick add.
import { html, raw, icon, pic, money, esc, $ } from '../lib/dom.js';
import { state, categoryLabel, inWishlist, toggleWishlist, addToCart, on } from '../lib/store.js';
import { toast } from './toast.js';
import { flyToBag } from './cart.js';

const badge = (p) => {
  if (!p.inStock) return '<span class="pcard__badge pcard__badge--out">Sold out</span>';
  if (p.compareAt) return `<span class="pcard__badge pcard__badge--sale">−${Math.round((1 - p.price / p.compareAt) * 100)}%</span>`;
  if (p.collections.includes('limited-edition')) return '<span class="pcard__badge">Limited</span>';
  if (p.collections.includes('new-drop')) return '<span class="pcard__badge">New</span>';
  return '';
};

export function heartButton(p, cls = '') {
  const on = inWishlist(p.id);
  return html`<button type="button" class="heart ${cls} ${on ? 'is-on' : ''}" data-wish="${p.id}" aria-pressed="${on}" aria-label="${on ? 'Remove from' : 'Save to'} wishlist: ${p.name}">
    <svg class="icon heart__icon" aria-hidden="true"><use href="#i-heart"/></svg><span class="heart__burst" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>
  </button>`;
}

export function productCard(p, { eager = false, idx = 0 } = {}) {
  const sizes = p.sizes.length > 1 ? `${p.sizes[0]}–${p.sizes[p.sizes.length - 1]}` : p.sizes[0];
  const hasAlt = p.images.length > 1;
  return html`<article class="pcard ${p.inStock ? '' : 'is-out'}" data-reveal data-slug="${p.slug}">
    <div class="pcard__media">
      <a href="/product/${p.slug}" class="pcard__link" data-cursor="view" data-cursor-label="View" aria-label="${p.name}">
        ${pic(p.images[0], { alt: `${p.name} — EPIC WEAR`, eager, cls: 'pcard__img' })}
        ${hasAlt ? pic(p.images[1], { alt: '', cls: 'pcard__img pcard__img--alt' }) : ''}
      </a>
      ${raw(badge(p))}
      ${heartButton(p, 'pcard__heart')}
      ${p.inStock ? html`<div class="pcard__quick">
        <button type="button" class="pcard__add" data-quick="${p.slug}" aria-expanded="false">${icon('plus')}<span>Add to bag</span></button>
        <div class="pcard__sizes" role="group" aria-label="Choose a size">
          ${p.sizes.map((s) => html`<button type="button" data-size="${s}" ${p.availability[s] === 'out' ? raw('disabled aria-disabled="true"') : ''}>${s}</button>`)}
        </div>
      </div>` : ''}
    </div>
    <div class="pcard__info">
      <div class="pcard__row">
        <h3 class="pcard__name"><a href="/product/${p.slug}">${p.name.replace(/^EPIC\s+(?!×)/, '')}</a></h3>
        <p class="pcard__price">${p.compareAt ? html`<s>${money(p.compareAt)}</s>` : ''}${money(p.price)}</p>
      </div>
      <p class="pcard__meta"><span>${categoryLabel(p.category)}</span><span>${sizes}</span>${p.colors.length > 1 ? html`<span>${p.colors.length} colours</span>` : ''}</p>
    </div>
  </article>`;
}

export const productGrid = (list, opts = {}) => html`${list.map((p, i) => productCard(p, { ...opts, eager: opts.eager && i < 4, idx: i }))}`;

/* ---------- delegated interactions (installed once) ---------- */
export function initCardInteractions() {
  document.addEventListener('click', async (e) => {
    const heart = e.target.closest('[data-wish]');
    if (heart) {
      e.preventDefault();
      const id = Number(heart.dataset.wish);
      const p = state.byId.get(id);
      const added = await toggleWishlist(id);
      if (added) toast(`Saved to wishlist`, { icon: 'heart', action: { label: 'View', onClick: () => window.epicNavigate('/wishlist') } });
      else if (p) toast('Removed from wishlist', { icon: 'heart' });
      return;
    }
    const quick = e.target.closest('[data-quick]');
    if (quick) {
      const p = state.bySlug.get(quick.dataset.quick);
      if (p && p.sizes.length === 1) return doAdd(quick, p, p.sizes[0]);
      const wrap = quick.closest('.pcard__quick');
      const open = !wrap.classList.contains('is-open');
      document.querySelectorAll('.pcard__quick.is-open').forEach((w) => w !== wrap && w.classList.remove('is-open'));
      wrap.classList.toggle('is-open', open);
      quick.setAttribute('aria-expanded', String(open));
      return;
    }
    const size = e.target.closest('.pcard__sizes [data-size]');
    if (size) {
      const card = size.closest('.pcard');
      const p = state.bySlug.get(card.dataset.slug);
      doAdd(size, p, size.dataset.size);
      size.closest('.pcard__quick').classList.remove('is-open');
      return;
    }
    if (!e.target.closest('.pcard__quick')) document.querySelectorAll('.pcard__quick.is-open').forEach((w) => w.classList.remove('is-open'));
  });

  on('wishlist', (ids) => {
    document.querySelectorAll('[data-wish]').forEach((b) => {
      const onNow = ids.includes(Number(b.dataset.wish));
      if (onNow && !b.classList.contains('is-on')) { b.classList.add('is-on', 'is-pop'); setTimeout(() => b.classList.remove('is-pop'), 700); }
      if (!onNow) b.classList.remove('is-on');
      b.setAttribute('aria-pressed', String(onNow));
    });
  });
}

function doAdd(from, p, size) {
  if (!p) return;
  addToCart(p.slug, size, p.colors[0]?.name, 1);
  const img = from.closest('.pcard')?.querySelector('.pcard__img img, img.pcard__img');
  flyToBag(img || from);
  toast(`${p.name} · ${size} added`, { image: $('.pcard__img', from.closest('.pcard'))?.outerHTML?.replace(/loading="lazy"/, '') || '', action: { label: 'View bag', onClick: () => window.epicOpenCart() } });
}

export { esc };
