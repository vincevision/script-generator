// Bag drawer + the "fly to bag" micro-interaction and animated counters.
import { $, $$, html, raw, icon, pic, money, reduced, esc } from '../lib/dom.js';
import { state, on, cartLines, cartCount, cartSubtotal, setQty, removeLine, estimateDelivery, setRegion } from '../lib/store.js';

const drawer = () => $('#cartDrawer');
let lastFocus = null;

export function openCart() {
  lastFocus = document.activeElement;
  render();
  const d = drawer();
  d.setAttribute('aria-hidden', 'false');
  document.documentElement.classList.add('drawer-open');
  setTimeout(() => $('.drawer__close', d).focus({ preventScroll: true }), 50);
}
export function closeCart() {
  const d = drawer();
  if (d.getAttribute('aria-hidden') === 'true') return;
  d.setAttribute('aria-hidden', 'true');
  document.documentElement.classList.remove('drawer-open');
  lastFocus?.focus?.({ preventScroll: true });
}

function render() {
  const body = $('#cartBody'), foot = $('#cartFoot');
  const lines = cartLines();
  $$('[data-cart-count-inline]').forEach((el) => (el.textContent = cartCount()));
  if (!lines.length) {
    body.innerHTML = html`<div class="bag-empty">
      <div class="bag-empty__art">${icon('bag')}</div>
      <p class="bag-empty__title">Your bag is empty</p>
      <p class="bag-empty__text">The latest EPIC drop is waiting. Find something that stands out.</p>
      <a href="/shop" class="btn btn--primary" data-close-drawer><span class="btn__inner"><span>Shop collection</span>${icon('arrow', 'icon--arrow')}</span></a>
    </div>`.s;
    foot.innerHTML = '';
    foot.hidden = true;
    return;
  }
  foot.hidden = false;
  body.innerHTML = html`<ul class="bag-lines">${lines.map((l, i) => html`<li class="bag-line" data-i="${i}">
      <a href="/product/${l.slug}" class="bag-line__img" data-close-drawer>${pic(l.product.images[0], { alt: l.product.name, sizes: '96px' })}</a>
      <div class="bag-line__info">
        <div class="bag-line__top">
          <a href="/product/${l.slug}" class="bag-line__name" data-close-drawer>${l.product.name}</a>
          <button type="button" class="bag-line__remove" data-remove="${i}" aria-label="Remove ${l.product.name}">${icon('trash')}</button>
        </div>
        <p class="bag-line__meta">Size <b>${l.size}</b>${l.color ? html` · <i class="swatch" style="--c:${l.product.colors.find((c) => c.name === l.color)?.hex || '#111'}"></i>${l.color}` : ''}</p>
        ${l.product.availability[l.size] === 'out' ? html`<p class="bag-line__warn">Sold out in this size — remove to continue</p>` : ''}
        <div class="bag-line__bottom">
          <div class="qty qty--sm" role="group" aria-label="Quantity">
            <button type="button" data-qty="${i}" data-d="-1" aria-label="Decrease">${icon('minus')}</button>
            <output>${l.qty}</output>
            <button type="button" data-qty="${i}" data-d="1" aria-label="Increase" ${l.qty >= 10 ? raw('disabled') : ''}>${icon('plus')}</button>
          </div>
          <span class="bag-line__price">${money(l.product.price * l.qty)}</span>
        </div>
      </div>
    </li>`)}</ul>`.s;

  const sub = cartSubtotal();
  const del = estimateDelivery(sub);
  const thr = state.config?.freeDeliveryThreshold || 10000;
  const left = Math.max(0, thr - sub);
  const intl = state.region === 'international';
  foot.innerHTML = html`
    ${intl ? '' : html`<div class="freebar ${left ? '' : 'is-done'}">
      <p>${left ? html`You're <b>${money(left)}</b> away from free delivery` : html`${icon('truck')} You've unlocked <b>free delivery</b> in Kenya`}</p>
      <div class="freebar__track"><i style="transform:scaleX(${Math.min(1, sub / thr)})"></i></div>
    </div>`}
    <dl class="totals">
      <div><dt>Subtotal</dt><dd>${money(sub)}</dd></div>
      <div><dt>Delivery
        <select class="totals__region" id="bagRegion" aria-label="Delivery region">
          <option value="nairobi" ${state.region === 'nairobi' ? raw('selected') : ''}>Nairobi</option>
          <option value="kenya" ${state.region === 'kenya' ? raw('selected') : ''}>Rest of Kenya</option>
          <option value="international" ${intl ? raw('selected') : ''}>International</option>
        </select></dt><dd>${del.fee ? money(del.fee) : 'FREE'}</dd></div>
      <div class="totals__grand"><dt>Total</dt><dd>${money(sub + del.fee)}</dd></div>
    </dl>
    <a href="/checkout" class="btn btn--primary btn--block magnetic" data-close-drawer><span class="btn__inner">${icon('lock')}<span>Proceed to checkout</span>${icon('arrow', 'icon--arrow')}</span></a>
    <p class="drawer__note">${icon('phone')} Pay securely with <b>M-PESA</b> · Discount codes at checkout</p>`.s;
}

export function initCart() {
  const d = drawer();
  d.addEventListener('click', (e) => {
    if (e.target.closest('[data-close-drawer]')) return closeCart();
    const q = e.target.closest('[data-qty]');
    if (q) { const i = Number(q.dataset.qty); setQty(i, state.cart[i].qty + Number(q.dataset.d)); return; }
    const r = e.target.closest('[data-remove]');
    if (r) {
      const li = r.closest('.bag-line');
      li.classList.add('is-removing');
      setTimeout(() => removeLine(Number(r.dataset.remove)), reduced ? 0 : 280);
    }
  });
  d.addEventListener('change', (e) => { if (e.target.id === 'bagRegion') setRegion(e.target.value); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCart(); });
  document.addEventListener('click', (e) => { if (e.target.closest('[data-open-cart]')) { e.preventDefault(); openCart(); } });

  const updateCounts = () => {
    const n = cartCount();
    $$('[data-cart-count]').forEach((el) => { el.textContent = n > 99 ? '99+' : n; el.hidden = n === 0; });
    if (d.getAttribute('aria-hidden') === 'false') render();
  };
  on('cart', updateCounts);
  on('catalog', updateCounts);
  on('cart:add', () => {
    $$('[data-cart-count]').forEach((el) => { el.classList.remove('is-bump'); void el.offsetWidth; el.classList.add('is-bump'); });
    $$('.nav__icon--bag, .tabbar [data-open-cart]').forEach((el) => { el.classList.remove('is-shake'); void el.offsetWidth; el.classList.add('is-shake'); });
  });
  on('wishlist', (ids) => $$('[data-wish-count]').forEach((el) => { el.textContent = ids.length; el.hidden = !ids.length; }));
  updateCounts();
  $$('[data-wish-count]').forEach((el) => { el.textContent = state.wishlist.length; el.hidden = !state.wishlist.length; });
}

/** Animate a product thumbnail into the bag icon. */
export function flyToBag(fromEl) {
  if (reduced || !fromEl) return;
  const target = [...$$('.nav__icon--bag, .tabbar [data-open-cart]')].find((el) => el.offsetParent !== null);
  if (!target) return;
  const a = fromEl.getBoundingClientRect(), b = target.getBoundingClientRect();
  const src = fromEl.currentSrc || fromEl.src;
  const ghost = document.createElement('div');
  ghost.className = 'fly';
  if (src) ghost.style.backgroundImage = `url("${esc(src)}")`;
  const size = Math.min(a.width, 120);
  Object.assign(ghost.style, { left: `${a.left + a.width / 2 - size / 2}px`, top: `${a.top + a.height / 2 - size * 0.625}px`, width: `${size}px`, height: `${size * 1.25}px` });
  document.body.appendChild(ghost);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
  ghost.animate([
    { transform: 'translate(0,0) scale(1)', opacity: 1 },
    { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 60}px) scale(.55)`, opacity: 1, offset: 0.55 },
    { transform: `translate(${dx}px, ${dy}px) scale(.12)`, opacity: 0.2 },
  ], { duration: 750, easing: 'cubic-bezier(.65,0,.35,1)' }).onfinish = () => ghost.remove();
}
