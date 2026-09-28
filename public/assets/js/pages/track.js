// TRACK MY ORDER — order number + phone/email → animated status timeline.
import { html, raw, icon, pic, money, fmtDate, $, formData, busy, setFieldErrors } from '../lib/dom.js';
import { post } from '../lib/api.js';
import { crumbs, field, timeline, statusPill, pageTitle } from './_shared.js';

export const orderItems = (items) => html`<div class="summary__lines" style="max-height:none">${items.map((l) => html`<div class="sline">
  <a class="sline__img" href="/product/${l.slug}">${pic(l.image, { alt: l.name, sizes: '60px' })}<b>${l.qty}</b></a>
  <div><p class="sline__name">${l.name}</p><p class="sline__meta">${l.size}${l.color ? ` · ${l.color}` : ''}</p></div>
  ${l.lineTotal != null ? html`<span class="sline__price">${money(l.lineTotal)}</span>` : ''}
</div>`)}</div>`;

export function trackResult(o) {
  return html`<div class="co-card track-result" data-reveal>
    <div class="track-head">
      <div><p class="track-head__num">${o.number}</p><p class="track-head__meta">Placed ${fmtDate(o.createdAt)} · ${o.items.length} ${o.items.length === 1 ? 'item' : 'items'} · ${money(o.total)}${o.city ? ` · to ${o.city}` : ''}</p></div>
      ${statusPill(o.status)}
    </div>
    ${o.status === 'cancelled' ? html`<p class="cancelled-note">${icon('close')}This order was cancelled${o.paymentStatus !== 'paid' ? ' because payment was not completed' : ''}. Need help? Call +254 742 850 266.</p>`
      : o.status === 'pending_payment' ? html`<p class="cancelled-note">${icon('clock')}We are still waiting for payment on this order.</p>` : timeline(o)}
    <details class="acc" style="margin-top:20px"><summary>Items ${icon('plus')}</summary><div class="acc__body">${orderItems(o.items)}</div></details>
    ${o.history?.length ? html`<details class="acc"><summary>History ${icon('plus')}</summary><div class="acc__body"><ol class="history">${[...o.history].reverse().map((h) => html`<li><time>${new Date(h.at).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}</time><span>${h.note || h.status}</span></li>`)}</ol></div></details>` : ''}
  </div>`;
}

export default async function track({ query }) {
  return {
    title: pageTitle('Track My Order'),
    html: html`
<header class="phero container">
  ${crumbs([['Home', '/'], ['Track order']])}
  <p class="eyebrow hero-in" style="--d:0"><span>[Track]</span> Order status</p>
  <h1 class="phero__title" data-split>Track my order</h1>
  <p class="phero__text hero-in" style="--d:2">Enter your order number and the phone number or email you used at checkout.</p>
</header>
<section class="section section--tight" style="padding-top:0">
  <div class="container track-wrap">
    <form class="co-card track-form" data-track novalidate data-reveal>
      ${field({ name: 'number', label: 'Order number', value: query.number || '', placeholder: 'EPIC-XXXXXX', attrs: 'autocapitalize="characters" spellcheck="false"' })}
      ${field({ name: 'contact', label: 'Phone or email', value: query.contact || '', placeholder: '07XX XXX XXX or you@email.com', autocomplete: 'email' })}
      <button type="submit" class="btn btn--primary"><span class="btn__inner">${icon('search')}<span>Track</span></span></button>
      <p class="form-error span-2" data-error role="alert" style="grid-column:1/-1"></p>
    </form>
    <div data-result aria-live="polite"></div>
  </div>
</section>`,
    init(el) {
      const form = $('[data-track]', el);
      const run = async () => {
        const err = $('[data-error]', el);
        err.textContent = '';
        const b = $('button[type=submit]', form);
        busy(b, true);
        try {
          const { order } = await post('/track', formData(form));
          const out = $('[data-result]', el);
          out.innerHTML = trackResult(order).s;
          requestAnimationFrame(() => out.querySelector('[data-reveal]')?.classList.add('is-in'));
        } catch (ex) {
          if (!setFieldErrors(form, ex)) err.textContent = ex.message;
          $('[data-result]', el).innerHTML = '';
        } finally { busy(b, false); }
      };
      form.addEventListener('submit', (e) => { e.preventDefault(); run(); });
      if (query.number && query.contact) run();
    },
  };
}
