// ORDER CONFIRMED / WELCOME TO EPIC.
import { html, raw, icon, money, $ } from '../lib/dom.js';
import { get, ApiError } from '../lib/api.js';
import { state } from '../lib/store.js';
import { toast } from '../ui/toast.js';
import { btn, successCheck, timeline, statusPill, pageTitle } from './_shared.js';
import { orderItems } from './track.js';

export default async function order({ params, query }) {
  const number = params.number.toUpperCase();
  const pending = (() => { try { return JSON.parse(sessionStorage.getItem('epic-order-' + number)) || {}; } catch { return {}; } })();
  const token = query.token || pending.token || '';
  let o;
  try {
    ({ order: o } = await get(`/orders/${number}${token ? `?token=${encodeURIComponent(token)}` : ''}`));
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      const nf = await import('./notfound.js');
      return nf.default({ path: `/order/${number}`, title: 'Order not found', text: 'Use Track My Order with your order number and the phone or email used at checkout.', action: btn('Track my order', { href: `/track?number=${number}` }) });
    }
    throw e;
  }
  const paid = o.paymentStatus === 'paid';
  const c = o.customer;
  return {
    title: pageTitle(paid ? `Order confirmed — ${o.number}` : `Order ${o.number}`),
    html: html`
<section class="container">
  <div class="confirm success ${paid ? '' : 'is-pending'}" tabindex="-1" data-confirm>
    ${paid ? successCheck() : html`<div class="paystate__icon paystate--waiting"><span class="paystate__ring"></span>${icon('clock')}</div>`}
    <h1 class="confirm__title">${paid ? 'Order confirmed' : o.status === 'cancelled' ? 'Order cancelled' : 'Awaiting payment'}</h1>
    ${paid ? html`<p class="confirm__sub">Welcome to EPIC.</p>` : ''}
    <div class="confirm__num"><span>Order</span><b data-num>${o.number}</b><button type="button" data-copy aria-label="Copy order number">${icon('receipt')}</button></div>
    <p class="confirm__text">${paid ? html`Thank you${c.name ? `, ${c.name.split(' ')[0]}` : ''}. We have received your payment${o.receipt ? html` (M-PESA ref <b>${o.receipt}</b>)` : ''} and your order is being prepared. We will keep you updated on ${c.phone}${c.email ? ` and ${c.email}` : ''}.`
      : o.status === 'cancelled' ? 'This order was cancelled because payment was not completed. Your bag has not been charged.' : 'We have not received payment for this order yet. If you completed the M-PESA prompt, this page will update shortly.'}</p>
    <div class="confirm__actions">
      ${btn('Track order', { href: `/track?number=${o.number}&contact=${encodeURIComponent(c.email || c.phone || '')}`, leading: 'truck', iconName: '' })}
      ${btn('Continue shopping', { href: '/shop', variant: 'ghost' })}
    </div>
    <div class="confirm__grid">
      <div class="co-card">
        <h2 class="co-card__title"><span>[01]</span> Your order ${statusPill(o.status)}</h2>
        ${paid ? timeline(o) : ''}
        ${orderItems(o.items)}
        <dl class="totals">
          <div><dt>Subtotal</dt><dd>${money(o.subtotal)}</dd></div>
          ${o.discount ? html`<div class="totals__discount"><dt>Discount${o.discountCode ? ` (${o.discountCode})` : ''}</dt><dd>−${money(o.discount)}</dd></div>` : ''}
          <div><dt>Delivery</dt><dd>${o.delivery ? money(o.delivery) : 'Free'}</dd></div>
          <div class="totals__grand"><dt>Total</dt><dd>${money(o.total)}</dd></div>
        </dl>
      </div>
      <div class="co-card">
        <h2 class="co-card__title"><span>[02]</span> Delivery</h2>
        <div class="co-review" style="grid-template-columns:1fr">
          <div><b>Deliver to</b>${c.name}<br>${c.address}<br>${c.city}${c.county ? `, ${c.county}` : ''}<br>${c.country}</div>
          <div><b>Contact</b>${c.phone}<br>${c.email}</div>
          <div><b>Payment</b>${o.paymentProvider === 'mpesa' ? 'M-PESA' : o.paymentProvider} · ${paid ? 'Paid' : o.paymentStatus}</div>
        </div>
        ${!state.user ? html`<p class="note" style="margin-top:22px">${icon('user')}<span>Create an account with ${c.email || 'your email'} to see this order under My Orders next time. <a class="linkish" href="/account/register">Create account</a></span></p>` : ''}
      </div>
    </div>
  </div>
</section>`,
    init(el) {
      const box = $('[data-confirm]', el);
      requestAnimationFrame(() => box.classList.add('is-shown'));
      $('[data-copy]', el).addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(o.number); toast('Order number copied', { icon: 'receipt' }); } catch { /* ignore */ }
      });
      let t;
      if (!paid && o.status === 'pending_payment') {
        let n = 0;
        const poll = async () => {
          try {
            const s = await get(`/payments/status?number=${o.number}${token ? `&token=${encodeURIComponent(token)}` : ''}`);
            if (s.paymentStatus === 'paid' || s.status === 'cancelled') return window.epicNavigate(location.pathname + location.search, { replace: true });
          } catch { /* keep trying */ }
          if (++n < 40) t = setTimeout(poll, 3000);
        };
        t = setTimeout(poll, 2500);
      }
      return () => clearTimeout(t);
    },
  };
}
