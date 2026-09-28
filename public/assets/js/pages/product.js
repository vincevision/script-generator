// PRODUCT — gallery (thumbs, swipe, hover zoom, fullscreen), options, size guide,
// stock per size, add to bag / buy now, wishlist and related products.
import { html, raw, icon, pic, imgUrl, money, $, $$, clamp, finePointer, reduced } from '../lib/dom.js';
import { get, ApiError } from '../lib/api.js';
import { state, loadCatalog, categoryLabel, collectionName, addToCart } from '../lib/store.js';
import { productCard, heartButton } from '../ui/card.js';
import { flyToBag, openCart } from '../ui/cart.js';
import { openDialog, closeDialog } from '../ui/dialog.js';
import { toast } from '../ui/toast.js';
import { crumbs, sectionHead, pageTitle } from './_shared.js';

const GUIDES = {
  tops: {
    note: 'EPIC tops are cut oversized. For a classic fit, size down one.',
    head: ['Size', 'Chest (cm)', 'Length (cm)', 'Shoulder (cm)'],
    rows: [['XS', '104', '68', '52'], ['S', '110', '70', '54'], ['M', '116', '72', '56'], ['L', '122', '74', '58'], ['XL', '128', '76', '60'], ['XXL', '134', '78', '62']],
  },
  bottoms: {
    note: 'Measure around your natural waist. Between sizes? Size up for a relaxed fit.',
    head: ['Size', 'Waist (cm)', 'Hip (cm)', 'Inseam (cm)'],
    rows: [['XXS / 26', '66', '89', '75'], ['XS / 28', '71', '94', '76'], ['S / 30', '76', '99', '78'], ['M / 32', '81', '104', '79'], ['L / 34', '86', '109', '80'], ['XL / 36', '91', '114', '81'], ['XXL / 38', '96', '119', '82']],
  },
  dresses: {
    note: 'Relaxed through the body. Measurements are of the garment laid flat, doubled.',
    head: ['Size', 'Bust (cm)', 'Waist (cm)', 'Length (cm)'],
    rows: [['XS', '84', '68', '112'], ['S', '88', '72', '114'], ['M', '94', '78', '116'], ['L', '100', '84', '118'], ['XL', '106', '90', '120'], ['XXL', '112', '96', '122']],
  },
};
const guideFor = (cat) => (['cargo-pants', 'jeans', 'joggers', 'shorts'].includes(cat) ? GUIDES.bottoms : cat === 'dresses' ? GUIDES.dresses : cat === 'accessories' ? null : GUIDES.tops);

export default async function product({ params }) {
  let data;
  try {
    [data] = await Promise.all([get(`/products/${params.slug}`), loadCatalog()]);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      const nf = await import('./notfound.js');
      return nf.default({ path: `/product/${params.slug}`, title: 'Product not found', text: 'This piece may have sold out or moved. Explore the rest of the collection.' });
    }
    throw e;
  }
  const p = data.product;
  const related = data.related.map((r) => state.bySlug.get(r.slug) || r);
  const single = p.sizes.length === 1;
  const guide = guideFor(p.category);
  const images = p.images.length ? p.images : [''];
  const save = p.compareAt ? Math.round((1 - p.price / p.compareAt) * 100) : 0;
  const isCollab = p.collections.includes('epic-x-sharon');
  const lowAny = Object.values(p.availability).includes('low');

  return {
    title: pageTitle(`${p.name} — ${money(p.price)}`),
    html: html`
<div class="container pdp-wrap">
  ${crumbs([['Home', '/'], ['Shop', '/shop'], [categoryLabel(p.category), `/shop?category=${p.category}`], [p.name]])}
  <div class="pdp">
    <div class="gallery ${images.length < 2 ? 'gallery--single' : ''}" data-gallery>
      ${images.length > 1 ? html`<div class="gallery__thumbs" role="tablist" aria-label="Product images">
        ${images.map((src, i) => html`<button type="button" class="gallery__thumb ${i === 0 ? 'is-active' : ''}" role="tab" aria-selected="${i === 0}" aria-label="Image ${i + 1}" data-go="${i}">${pic(src, { alt: '', sizes: '80px' })}</button>`)}
      </div>` : ''}
      <div class="gallery__main">
        <div class="gallery__track" data-track>
          ${images.map((src, i) => html`<div class="gallery__slide" data-slide="${i}" aria-label="Image ${i + 1} of ${images.length}">${pic(src, { alt: `${p.name}${i ? ` — detail ${i}` : ''} by EPIC WEAR`, eager: i === 0, sizes: '(max-width: 960px) 100vw, 50vw' })}</div>`)}
        </div>
        ${!p.inStock ? raw('<span class="pcard__badge pcard__badge--out">Sold out</span>') : save ? raw(`<span class="pcard__badge pcard__badge--sale">−${save}%</span>`) : p.collections.includes('limited-edition') ? raw('<span class="pcard__badge">Limited</span>') : p.collections.includes('new-drop') ? raw('<span class="pcard__badge">New</span>') : ''}
        ${finePointer ? html`<span class="gallery__hint">${icon('zoom')}Hover to zoom · click for fullscreen</span>` : ''}
        <div class="gallery__tools"><button type="button" class="icon-btn" data-fullscreen aria-label="View fullscreen">${icon('expand')}</button></div>
        ${images.length > 1 ? html`<div class="gallery__dots" aria-hidden="true">${images.map((_, i) => html`<i class="${i === 0 ? 'is-active' : ''}"></i>`)}</div>` : ''}
      </div>
    </div>

    <div class="pinfo">
      <div class="pinfo__cat hero-in" style="--d:0">
        <p class="eyebrow"><span>[${categoryLabel(p.category)}]</span> ${isCollab ? 'EPIC × Sharon' : p.collections[0] ? collectionName(p.collections[0]) : 'EPIC WEAR'}</p>
      </div>
      <h1 class="pinfo__title hero-in" style="--d:1">${p.name}</h1>
      <div class="pinfo__price hero-in" style="--d:2">
        <span>${money(p.price)}</span>${p.compareAt ? html`<s>${money(p.compareAt)}</s><span class="tag-save">Save ${save}%</span>` : ''}
      </div>
      <p class="stock ${p.inStock ? (lowAny ? '' : '') : 'is-out'} hero-in" style="--d:3" data-stock aria-live="polite"><i></i><span>${p.inStock ? 'In stock — ships from Nairobi' : 'Sold out'}</span></p>
      <p class="pinfo__desc hero-in" style="--d:3">${p.description}</p>

      ${p.colors.length ? html`<div class="opt hero-in" style="--d:4">
        <div class="opt__head"><span class="opt__label">Colour <b data-color-label>${p.colors[0].name}</b></span></div>
        <div class="swatches" role="radiogroup" aria-label="Colour">
          ${p.colors.map((c, i) => html`<button type="button" class="swatch-btn" role="radio" aria-checked="${i === 0}" aria-pressed="${i === 0}" aria-label="${c.name}" data-color="${c.name}" style="--c:${c.hex}"><i></i></button>`)}
        </div>
      </div>` : ''}

      <div class="opt hero-in" style="--d:4">
        <div class="opt__head">
          <span class="opt__label">Size <b data-size-label>${single ? p.sizes[0] : 'Select'}</b></span>
          ${guide ? html`<button type="button" class="opt__guide" data-guide>${icon('ruler')}Size guide</button>` : ''}
        </div>
        <div class="sizes" role="radiogroup" aria-label="Size" data-sizes>
          ${p.sizes.map((s) => {
            const a = p.availability[s];
            return html`<button type="button" class="size-btn ${a === 'out' ? 'is-out' : a === 'low' ? 'is-low' : ''}" role="radio" aria-checked="${single}" aria-pressed="${single}" data-size="${s}" ${raw(a === 'out' ? 'aria-disabled="true"' : '')} aria-label="${s}${a === 'out' ? ' — sold out' : a === 'low' ? ' — only a few left' : ''}">${s}</button>`;
          })}
        </div>
      </div>

      <div class="buy hero-in" style="--d:5" data-buy>
        <div class="qty" role="group" aria-label="Quantity">
          <button type="button" data-qty="-1" aria-label="Decrease quantity">${icon('minus')}</button>
          <output data-qty-val aria-live="polite">1</output>
          <button type="button" data-qty="1" aria-label="Increase quantity">${icon('plus')}</button>
        </div>
        <button type="button" class="btn btn--primary buy__add" data-add ${raw(p.inStock ? '' : 'disabled')}><span class="btn__inner">${icon('bag')}<span>${p.inStock ? 'Add to bag' : 'Sold out'}</span></span></button>
        ${heartButton(p)}
        ${p.inStock ? html`<button type="button" class="btn btn--ghost buy__now" data-buy-now><span class="btn__inner"><span>Buy now</span>${icon('arrow', 'icon--arrow')}</span></button>` : ''}
      </div>

      <ul class="perks hero-in" style="--d:6">
        <li>${icon('truck')}<span>Delivery countrywide${state.config ? html`<br>Free over ${money(state.config.freeDeliveryThreshold)}` : ''}</span></li>
        <li>${icon('phone')}<span>Pay securely<br>with M-PESA</span></li>
        <li>${icon('return')}<span>Free size<br>exchange · 7 days</span></li>
      </ul>

      <div class="acc hero-in" style="--d:6">
        <details open><summary>Details & fabric ${icon('plus')}</summary><div class="acc__body"><ul>${p.details.map((d) => html`<li>${d}</li>`)}</ul></div></details>
        <details><summary>Delivery ${icon('plus')}</summary><div class="acc__body">
          <p>Nairobi: 1–2 business days (${money(state.config?.delivery.nairobi || 300)}). Rest of Kenya: 2–4 business days (${money(state.config?.delivery.kenya || 500)}). Free delivery in Kenya on orders over ${money(state.config?.freeDeliveryThreshold || 10000)}.</p>
          <p>International orders ship express in 5–10 business days. <a class="linkish" href="/help/shipping">Shipping details</a></p>
        </div></details>
        <details><summary>Returns & exchanges ${icon('plus')}</summary><div class="acc__body">
          <p>Wrong size? Exchange unworn items with tags within 7 days of delivery. <a class="linkish" href="/help/returns">Returns policy</a></p>
        </div></details>
      </div>
    </div>
  </div>
</div>

${related.length ? html`<section class="section section--tight" aria-labelledby="relTitle">
  <div class="container">
    ${sectionHead({ id: 'relTitle', idx: '+', eyebrow: 'Complete the fit', title: 'You may also like', action: html`<div class="rail-nav"><button type="button" class="icon-btn" data-rail="-1" aria-label="Previous">${icon('arrow-left')}</button><button type="button" class="icon-btn" data-rail="1" aria-label="Next">${icon('arrow')}</button></div>` })}
    <div class="rail" data-rail-track>${related.map((r, i) => productCard(r, { idx: i }))}</div>
  </div>
</section>` : ''}

${p.inStock ? html`<div class="sticky-buy" data-sticky aria-hidden="true">
  <div class="sticky-buy__info"><p class="sticky-buy__name">${p.name}</p><p class="sticky-buy__price">${money(p.price)} · <span data-sticky-size>${single ? p.sizes[0] : 'Choose size'}</span></p></div>
  <button type="button" class="btn btn--primary" data-add tabindex="-1"><span class="btn__inner">${icon('bag')}<span>Add</span></span></button>
</div>` : ''}`,

    init(el) {
      const sel = { size: single ? p.sizes[0] : '', color: p.colors[0]?.name || '', qty: 1 };
      const cleanups = [];

      /* ---------- gallery ---------- */
      const track = $('[data-track]', el);
      const slides = $$('.gallery__slide', el);
      let cur = 0;
      const go = (i) => {
        cur = clamp(i, 0, slides.length - 1);
        track.style.transform = `translate3d(${-cur * 100}%,0,0)`;
        $$('.gallery__thumb', el).forEach((t, j) => { t.classList.toggle('is-active', j === cur); t.setAttribute('aria-selected', String(j === cur)); });
        $$('.gallery__dots i', el).forEach((d, j) => d.classList.toggle('is-active', j === cur));
      };
      // swipe
      let sx = 0, sy = 0, dx = 0, dragging = false, locked = null;
      track.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' || slides.length < 2) return;
        dragging = true; locked = null; sx = e.clientX; sy = e.clientY; dx = 0;
      });
      track.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        dx = e.clientX - sx;
        const dy = e.clientY - sy;
        if (locked === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (locked === 'x') {
          track.classList.add('is-dragging');
          const w = track.clientWidth;
          const edge = (cur === 0 && dx > 0) || (cur === slides.length - 1 && dx < 0) ? 0.35 : 1;
          track.style.transform = `translate3d(${-cur * w + dx * edge}px,0,0)`;
        }
      });
      const end = () => {
        if (!dragging) return;
        dragging = false;
        track.classList.remove('is-dragging');
        if (locked === 'x' && Math.abs(dx) > track.clientWidth * 0.18) go(cur + (dx < 0 ? 1 : -1));
        else go(cur);
      };
      track.addEventListener('pointerup', end);
      track.addEventListener('pointercancel', end);
      track.addEventListener('lostpointercapture', end);

      // hover zoom (desktop) — the image follows the cursor at 2×
      if (finePointer && !reduced) {
        slides.forEach((s) => {
          s.addEventListener('mouseenter', () => s.classList.add('is-zooming'));
          s.addEventListener('mouseleave', () => s.classList.remove('is-zooming'));
          s.addEventListener('mousemove', (e) => {
            const r = s.getBoundingClientRect();
            s.style.setProperty('--zx', `${((e.clientX - r.left) / r.width) * 100}%`);
            s.style.setProperty('--zy', `${((e.clientY - r.top) / r.height) * 100}%`);
          });
        });
      }
      slides.forEach((s, i) => s.addEventListener('click', () => { if (Math.abs(dx) < 8) openLightbox(i); }));

      function openLightbox(start) {
        let i = start;
        const d = openDialog(html`<div class="lightbox" data-lb>
          <div class="lightbox__track" data-lb-track>${images.map((src, j) => html`<div class="lightbox__slide"><img src="${imgUrl(src, 960)}" alt="${p.name} — image ${j + 1}" ${raw(j === start ? '' : 'loading="lazy"')}></div>`)}</div>
          ${images.length > 1 ? html`<button type="button" class="icon-btn lightbox__nav lightbox__nav--prev" data-lb-go="-1" aria-label="Previous image">${icon('arrow-left')}</button>
          <button type="button" class="icon-btn lightbox__nav lightbox__nav--next" data-lb-go="1" aria-label="Next image">${icon('arrow')}</button>` : ''}
          <p class="lightbox__count" data-lb-count></p>
        </div>`.s, { cls: 'modal--lightbox', label: `${p.name} — fullscreen images` });
        const lt = $('[data-lb-track]', d);
        const show = (n) => {
          i = clamp(n, 0, images.length - 1);
          lt.style.transform = `translate3d(${-i * 100}%,0,0)`;
          $$('.lightbox__slide', d).forEach((s) => s.classList.remove('is-zoomed'));
          $('[data-lb-count]', d).textContent = `${String(i + 1).padStart(2, '0')} / ${String(images.length).padStart(2, '0')}`;
        };
        lt.style.transition = 'none';
        show(i);
        requestAnimationFrame(() => (lt.style.transition = ''));
        d.addEventListener('click', (e) => {
          const b = e.target.closest('[data-lb-go]');
          if (b) return show(i + Number(b.dataset.lbGo));
          const img = e.target.closest('.lightbox__slide img');
          if (img) img.parentElement.classList.toggle('is-zoomed');
        });
        const key = (e) => { if (e.key === 'ArrowRight') show(i + 1); if (e.key === 'ArrowLeft') show(i - 1); };
        d.addEventListener('keydown', key);
        let lx = 0;
        d.addEventListener('touchstart', (e) => { lx = e.touches[0].clientX; }, { passive: true });
        d.addEventListener('touchend', (e) => { const dd = e.changedTouches[0].clientX - lx; if (Math.abs(dd) > 50) show(i + (dd < 0 ? 1 : -1)); });
        d._onClose = () => { d.removeEventListener('keydown', key); go(i); };
      }

      /* ---------- options ---------- */
      const stockEl = $('[data-stock]', el);
      const setStock = () => {
        const a = sel.size ? p.availability[sel.size] : null;
        stockEl.classList.toggle('is-low', a === 'low');
        stockEl.classList.toggle('is-out', a === 'out' || !p.inStock);
        $('span', stockEl).textContent = !p.inStock ? 'Sold out' : a === 'low' ? `Only a few left in ${sel.size} — order soon` : a === 'in' ? `${sel.size} in stock — ships from Nairobi` : 'In stock — ships from Nairobi';
      };
      const pickSize = (s) => {
        sel.size = s;
        $$('[data-size]', el).forEach((b) => { const on = b.dataset.size === s; b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-checked', String(on)); });
        $('[data-size-label]', el).textContent = s;
        const ss = $('[data-sticky-size]', el);
        if (ss) ss.textContent = `Size ${s}`;
        $('[data-sizes]', el).classList.remove('has-error');
        setStock();
      };
      setStock();

      const add = (fromEl) => {
        if (!p.inStock) return false;
        if (!sel.size) {
          const sz = $('[data-sizes]', el);
          sz.classList.remove('has-error'); void sz.offsetWidth; sz.classList.add('has-error');
          sz.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
          toast('Choose your size first', { icon: 'ruler', tone: 'error' });
          return false;
        }
        addToCart(p.slug, sel.size, sel.color, sel.qty);
        flyToBag($('.gallery__slide img', slides[cur]) || fromEl);
        toast(`${p.name} · ${sel.size} added to bag`, { image: pic(images[0], { alt: '', sizes: '40px' }).s, action: { label: 'View bag', onClick: openCart } });
        return true;
      };

      el.addEventListener('click', (e) => {
        const t = e.target;
        const g = t.closest('[data-go]');
        if (g) return go(Number(g.dataset.go));
        if (t.closest('[data-fullscreen]')) return openLightbox(cur);
        const sz = t.closest('[data-size]');
        if (sz) {
          if (sz.classList.contains('is-out')) return toast(`${sz.dataset.size} is sold out`, { icon: 'bell' });
          return pickSize(sz.dataset.size);
        }
        const c = t.closest('[data-color]');
        if (c) {
          sel.color = c.dataset.color;
          $$('[data-color]', el).forEach((b) => { const on = b === c; b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-checked', String(on)); });
          $('[data-color-label]', el).textContent = sel.color;
          return;
        }
        const q = t.closest('[data-qty]');
        if (q) {
          sel.qty = clamp(sel.qty + Number(q.dataset.qty), 1, sel.size && p.availability[sel.size] === 'low' ? 3 : 10);
          $('[data-qty-val]', el).textContent = sel.qty;
          return;
        }
        const a = t.closest('[data-add]');
        if (a) return add(a);
        if (t.closest('[data-buy-now]')) { if (add(t)) setTimeout(() => window.epicNavigate('/checkout'), 350); return; }
        if (t.closest('[data-guide]')) return openGuide();
        const rb = t.closest('[data-rail]');
        if (rb) {
          const rt = $('[data-rail-track]', el);
          rt.scrollBy({ left: Number(rb.dataset.rail) * rt.clientWidth * 0.8, behavior: reduced ? 'auto' : 'smooth' });
        }
      });

      function openGuide() {
        openDialog(html`<div class="sizeguide">
          <p class="eyebrow"><span>[Fit]</span> ${categoryLabel(p.category)}</p>
          <h2 class="modal__title">Size guide</h2>
          <div class="sizeguide__wrap"><table><thead><tr>${guide.head.map((h) => html`<th scope="col">${h}</th>`)}</tr></thead>
          <tbody>${guide.rows.map((r) => html`<tr>${r.map((c) => html`<td>${c}</td>`)}</tr>`)}</tbody></table></div>
          <p class="sizeguide__tip">${icon('spark')}<span>${guide.note} Still unsure? <a class="linkish" href="https://wa.me/254742850266?text=${encodeURIComponent(`Hi EPIC, which size should I get in the ${p.name}?`)}" target="_blank" rel="noopener">Ask us on WhatsApp</a></span></p>
        </div>`.s, { label: 'Size guide' });
      }

      /* ---------- sticky mobile bar ---------- */
      const sticky = $('[data-sticky]', el);
      if (sticky && 'IntersectionObserver' in window) {
        const io = new IntersectionObserver(([en]) => {
          const on = !en.isIntersecting && en.boundingClientRect.top < 0;
          sticky.classList.toggle('is-on', on);
          sticky.setAttribute('aria-hidden', String(!on));
          $('button', sticky).tabIndex = on ? 0 : -1;
        });
        io.observe($('[data-buy]', el));
        cleanups.push(() => io.disconnect());
      }
      return () => cleanups.forEach((f) => f());
    },
  };
}
