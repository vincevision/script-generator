// CHECKOUT — 1) details  2) review + pay with M-PESA  3) confirmation (/order/:number).
// Prices, delivery, discounts and stock are always computed by the server.
import { html, raw, icon, pic, money, $, $$, formData, busy, setFieldErrors, debounce, reduced } from '../lib/dom.js';
import { get, post, ApiError } from '../lib/api.js';
import { state, loadCatalog, loadConfig, cartLines, cartSubtotal, estimateDelivery, clearCart, setRegion, on } from '../lib/store.js';
import { toast } from '../ui/toast.js';
import { crumbs, field, selectField, emptyState, btn, pageTitle, waLink } from './_shared.js';

const COUNTRIES = ['Kenya', 'Uganda', 'Tanzania', 'Rwanda', 'Burundi', 'Ethiopia', 'South Sudan', 'Somalia', 'DR Congo', 'Nigeria', 'Ghana', 'South Africa',
  'United Arab Emirates', 'Saudi Arabia', 'Qatar', 'United Kingdom', 'Ireland', 'Germany', 'France', 'Netherlands', 'Belgium', 'Sweden', 'Norway', 'Denmark',
  'Italy', 'Spain', 'Switzerland', 'United States', 'Canada', 'Australia', 'New Zealand', 'India', 'China', 'Japan', 'Other'];
const POLL_MS = 2500;
const POLL_MAX_MS = 120000;
const read = (k) => { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } };
const write = (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };
const kePhone = (v) => {
  const d = String(v || '').replace(/[\s()-]/g, '');
  const m = d.match(/^(?:\+?254|0)?([71]\d{8})$/);
  return m ? `254${m[1]}` : null;
};
const items = () => state.cart.map(({ slug, size, color, qty }) => ({ slug, size, color, qty }));

export default async function checkout() {
  await Promise.all([loadCatalog(), loadConfig()]);
  const lines = cartLines();
  const brand = html`<div class="co-brand">
    <a href="/" class="co-brand__logo" aria-label="EPIC WEAR home"><svg viewBox="0 0 334 100" aria-hidden="true"><use href="#epic-logo"/></svg><span>CHECKOUT</span></a>
    <span class="co-secure">${icon('lock')}Secure checkout</span>
  </div>`;

  if (!lines.length) {
    return {
      title: pageTitle('Checkout'),
      html: html`<div class="container">${brand}${emptyState({ iconName: 'bag', title: 'Your bag is empty', text: 'Add a few EPIC pieces and come back — checkout takes under a minute with M-PESA.', action: btn('Shop collection', { href: '/shop', leading: 'bag' }) })}</div>`,
    };
  }

  // prefill: session → account → default address
  let saved = read('epic-checkout') || {};
  if (state.user) {
    saved = { name: state.user.name, email: state.user.email, phone: state.user.phone, ...saved };
    if (!saved.address) {
      try {
        const { addresses } = await get('/account/addresses');
        const a = addresses.find((x) => x.isDefault) || addresses[0];
        if (a) saved = { ...saved, address: a.address, city: a.city, county: a.county, country: a.country, phone: saved.phone || a.phone };
      } catch { /* ignore */ }
    }
  }
  saved.country = saved.country || 'Kenya';
  const mpesa = state.config.payments.find((p) => p.id === 'mpesa');
  const counties = state.config.counties;

  const regionField = (country, value = '') => /^kenya$/i.test(country)
    ? selectField({ name: 'county', label: 'County', options: [['', 'Select county'], ...counties.map((c) => [c, c])], value })
    : field({ name: 'county', label: 'State / region', value, required: false, autocomplete: 'address-level1' });

  return {
    title: pageTitle('Checkout'),
    html: html`
<div class="container">
  ${brand}
  <div class="checkout">
    <div>
      <ol class="steps" aria-label="Checkout steps">
        <li class="step is-active" data-ind="1">01 · Details</li>
        <li class="step" data-ind="2">02 · Review & pay</li>
        <li class="step" data-ind="3">03 · Confirmed</li>
      </ol>

      <form class="co-card" data-details novalidate>
        <h2 class="co-card__title"><span>[01]</span> Delivery details</h2>
        <div class="form-grid">
          ${field({ name: 'name', label: 'Full name', autocomplete: 'name', value: saved.name || '', span: true })}
          ${field({ name: 'phone', label: 'Phone', type: 'tel', autocomplete: 'tel', value: saved.phone || '', placeholder: '07XX XXX XXX', hint: 'For delivery updates. International numbers welcome.' })}
          ${field({ name: 'email', label: 'Email', type: 'email', autocomplete: 'email', value: saved.email || '', hint: 'Your receipt and order number go here.' })}
          ${field({ name: 'address', label: 'Delivery address', autocomplete: 'street-address', value: saved.address || '', placeholder: 'Building, street, estate / landmark', span: true })}
          ${field({ name: 'city', label: 'City / town', autocomplete: 'address-level2', value: saved.city || '' })}
          ${selectField({ name: 'country', label: 'Country', options: COUNTRIES, value: saved.country, attrs: 'autocomplete="country-name"' })}
          <div class="span-2" data-region>${regionField(saved.country, saved.county || '')}</div>
          <label class="field span-2"><span class="field__label">Delivery notes <em>(optional)</em></span><textarea class="textarea" name="notes" maxlength="500" style="min-height:90px" placeholder="Gate code, best time to call…">${saved.notes || ''}</textarea><span class="field__error"></span></label>
        </div>
        <p class="form-error" data-error role="alert" style="margin-top:16px"></p>
        <div class="co-actions">
          <a href="/shop" class="linkish">${icon('arrow-left')}Continue shopping</a>
          <button type="submit" class="btn btn--primary magnetic" data-cursor="button"><span class="btn__inner"><span>Continue to payment</span>${icon('arrow', 'icon--arrow')}</span></button>
        </div>
      </form>

      <div data-step2 hidden>
        <div class="co-card">
          <h2 class="co-card__title"><span>[01]</span> Delivery <button type="button" class="linkish" data-edit>${icon('edit')}Edit</button></h2>
          <div class="co-review" data-review></div>
        </div>
        <div class="co-card" data-paycard>
          <h2 class="co-card__title"><span>[02]</span> Payment</h2>
          <div data-pay></div>
        </div>
      </div>
    </div>

    <aside class="summary" data-summary aria-label="Order summary"></aside>
  </div>
</div>`,

    init(el) {
      const form = $('[data-details]', el);
      let customer = null;
      let quote = null;
      let code = read('epic-code') || '';
      let polling = null;
      let timer = null;
      let alive = true;
      let done = false;
      const stopPolling = () => { clearTimeout(polling); clearInterval(timer); polling = timer = null; };

      /* ---------- summary ---------- */
      const renderSummary = () => {
        const ls = cartLines();
        const sub = quote ? quote.subtotal : cartSubtotal();
        const est = estimateDelivery(sub);
        const del = quote ? quote.delivery : est.fee;
        const delLabel = quote ? quote.deliveryLabel : `${est.label} (estimate)`;
        const disc = quote?.discount || 0;
        const total = quote ? quote.total : sub + del;
        const issues = quote?.issues || [];
        $('[data-summary]', el).innerHTML = html`
          <h2 class="summary__title">Order summary <span>${ls.reduce((a, l) => a + l.qty, 0)} items</span></h2>
          <div class="summary__lines">${ls.map((l) => html`<div class="sline">
            <span class="sline__img">${pic(l.product.images[0], { alt: l.product.name, sizes: '60px' })}<b>${l.qty}</b></span>
            <div><p class="sline__name">${l.product.name}</p><p class="sline__meta">${l.size}${l.color ? ` · ${l.color}` : ''}</p></div>
            <span class="sline__price">${money(l.product.price * l.qty)}</span>
          </div>`)}</div>
          ${issues.length ? html`<div class="form-error" style="margin-bottom:16px">${issues.map((i) => html`<p>${i.message}</p>`)}<p><button type="button" class="linkish" data-open-bag>Update your bag</button></p></div>` : ''}
          <form class="discount" data-discount>
            <label class="sr-only" for="dcode">Discount code</label>
            <input class="input" id="dcode" name="code" placeholder="Discount code" value="${code}" autocomplete="off" spellcheck="false">
            <button type="submit" class="btn btn--ghost"><span class="btn__inner"><span>${quote?.discountCode ? 'Applied' : 'Apply'}</span></span></button>
          </form>
          <p class="discount-msg ${quote?.discountCode ? 'is-ok' : ''}" data-dmsg>${quote?.discountCode ? `${quote.discountCode} applied — you save ${money(disc)}` : quote?.discountMessage || ''}</p>
          <dl class="totals">
            <div><dt>Subtotal</dt><dd>${money(sub)}</dd></div>
            ${disc ? html`<div class="totals__discount"><dt>Discount</dt><dd>−${money(disc)}</dd></div>` : ''}
            <div><dt>Delivery · ${delLabel}</dt><dd>${del ? money(del) : 'Free'}</dd></div>
            <div class="totals__grand"><dt>Total</dt><dd>${money(total)}</dd></div>
          </dl>
          ${quote?.deliveryEta ? html`<p class="drawer__note" style="margin-top:12px;justify-content:flex-start">${icon('truck')}Estimated delivery: ${quote.deliveryEta}</p>` : ''}
          <ul class="summary__trust">
            <li>${icon('lock')}Payments processed securely — we never see your PIN</li>
            <li>${icon('return')}Free size exchange within 7 days</li>
            <li>${icon('whatsapp')}Help on WhatsApp: +254 742 850 266</li>
          </ul>`.s;
      };

      const requote = async () => {
        const c = customer || formData(form);
        try {
          quote = await post('/cart/quote', { items: items(), country: c.country || 'Kenya', county: c.county || '', discountCode: code });
        } catch (e) { quote = null; }
        if (alive) renderSummary();
        return quote;
      };
      const syncRegion = () => {
        const c = formData(form);
        setRegion(!/^kenya$/i.test(c.country) ? 'international' : /nairobi/i.test(c.county || '') ? 'nairobi' : 'kenya');
      };
      syncRegion();
      renderSummary();
      requote();

      /* ---------- step switching ---------- */
      const setStep = (n) => {
        $$('[data-ind]', el).forEach((s) => {
          const i = Number(s.dataset.ind);
          s.classList.toggle('is-active', i === n);
          s.classList.toggle('is-done', i < n);
          i === n ? s.setAttribute('aria-current', 'step') : s.removeAttribute('aria-current');
        });
        form.hidden = n !== 1;
        $('[data-step2]', el).hidden = n !== 2;
        const top = $('.steps', el).getBoundingClientRect().top + scrollY - 90;
        if (scrollY > top) scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
      };

      form.addEventListener('change', (e) => {
        if (e.target.name === 'country') {
          const cur = formData(form).county || '';
          $('[data-region]', el).innerHTML = regionField(e.target.value, /^kenya$/i.test(e.target.value) && counties.includes(cur) ? cur : '').s;
        }
        if (e.target.name === 'country' || e.target.name === 'county') { syncRegion(); customer = null; requote(); }
        write('epic-checkout', formData(form));
      });
      form.addEventListener('input', debounce(() => write('epic-checkout', formData(form)), 400));

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = $('[data-error]', el);
        err.textContent = '';
        const c = formData(form);
        const kenya = /^kenya$/i.test(c.country);
        const checks = [
          ['name', c.name.trim().length >= 2, 'Please enter your full name.'],
          ['phone', c.phone.replace(/\D/g, '').length >= 9, 'Please enter a valid phone number.'],
          ['email', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email.trim()), 'Please enter a valid email address.'],
          ['address', c.address.trim().length >= 4, 'Please enter your delivery address.'],
          ['city', c.city.trim().length >= 2, 'Please enter your city or town.'],
          ['county', !kenya || !!c.county, 'Please choose your county.'],
        ];
        setFieldErrors(form, null);
        const bad = checks.find(([, ok]) => !ok);
        if (bad) return setFieldErrors(form, { field: bad[0], message: bad[2] });
        const b = $('button[type=submit]', form);
        busy(b, true);
        customer = c;
        write('epic-checkout', c);
        await requote();
        busy(b, false);
        if (!quote) { err.textContent = 'We could not price your bag. Check your connection and try again.'; return; }
        renderReview();
        renderPayForm();
        setStep(2);
      });

      const renderReview = () => {
        const c = customer;
        $('[data-review]', el).innerHTML = html`
          <div><b>Deliver to</b>${c.name}<br>${c.address}<br>${c.city}${c.county ? `, ${c.county}` : ''}<br>${c.country}</div>
          <div><b>Contact</b>${c.phone}<br>${c.email}${quote?.deliveryEta ? html`<br><br><b>Estimated delivery</b>${quote.deliveryLabel} · ${quote.deliveryEta}` : ''}</div>`.s;
      };

      /* ---------- payment ---------- */
      const pay = $('[data-pay]', el);
      const renderPayForm = (msg = '') => {
        const intl = customer && !/^kenya$/i.test(customer.country);
        const ph = kePhone(customer?.phone) ? customer.phone : '';
        pay.innerHTML = html`
          <div class="pay-methods" role="radiogroup" aria-label="Payment method">
            <label class="pay-method">
              <input type="radio" name="method" value="mpesa" checked>
              <span class="pay-method__radio" aria-hidden="true"></span>
              <span class="pay-method__icon"><span class="mpesa-mark">M-PESA</span></span>
              <span class="pay-method__txt"><b>Pay with M-PESA</b><small>Instant prompt on your phone · Safaricom</small></span>
              ${mpesa?.testMode ? html`<span class="pay-method__tag">Test mode</span>` : html`<span class="pay-method__tag">Recommended</span>`}
            </label>
            <label class="pay-method is-disabled" aria-disabled="true">
              <input type="radio" name="method" value="card" disabled>
              <span class="pay-method__radio" aria-hidden="true"></span>
              <span class="pay-method__icon">${icon('card')}</span>
              <span class="pay-method__txt"><b>Card</b><small>Visa · Mastercard</small></span>
              <span class="pay-method__tag">Coming soon</span>
            </label>
          </div>
          <form class="mpesa" data-mpesa novalidate>
            ${field({ name: 'mpesaPhone', label: 'M-PESA phone number', type: 'tel', value: ph, placeholder: '07XX XXX XXX', autocomplete: 'tel', hint: 'The Safaricom number that will receive the payment prompt.' })}
            ${intl ? html`<p class="note note--ember">${icon('pin')}<span>Paying from outside Kenya? M-PESA needs a Safaricom number. If you do not have one, <a class="linkish" href="${waLink(state.config.settings, `Hi EPIC, I'd like to complete an international order (${money(quote?.total || 0)}).`)}" target="_blank" rel="noopener">message us on WhatsApp</a> and we will help you pay another way.</span></p>` : ''}
            ${mpesa?.testMode ? html`<p class="testmode">${icon('spark')}Test mode — no real money moves. Numbers ending 000 simulate a cancel, 111 insufficient funds.</p>` : ''}
            <p class="form-error" data-pay-error role="alert">${msg}</p>
            <button type="submit" class="btn btn--primary btn--block magnetic" data-cursor="button" ${raw(quote?.issues?.length ? 'disabled' : '')}><span class="btn__inner">${icon('lock')}<span>Pay ${money(quote?.total || 0)} with M-PESA</span></span></button>
            <p class="note">${icon('shield')}<span>You will get an M-PESA prompt to enter your PIN. EPIC WEAR never asks for or stores your PIN.</span></p>
          </form>`.s;
        $('[data-mpesa]', pay).addEventListener('submit', onPay);
      };

      const paystate = (kind, { title, text, extra = '' }) => {
        pay.innerHTML = html`<div class="paystate paystate--${kind}" role="status" aria-live="polite">
          <div class="paystate__icon"><span class="paystate__ring"></span>${icon(kind === 'ok' ? 'check' : kind === 'fail' ? 'close' : 'phone')}</div>
          <h3 class="paystate__title">${title}</h3>
          <p class="paystate__text">${text}</p>
          ${raw(extra.s || extra)}
        </div>`.s;
      };

      let phoneUsed = '';
      async function onPay(e) {
        e.preventDefault();
        const f = e.currentTarget;
        const phone = kePhone(formData(f).mpesaPhone);
        if (!phone) return setFieldErrors(f, { field: 'mpesaPhone', message: 'Enter a Safaricom number, e.g. 0712 345 678.' });
        phoneUsed = phone;
        const b = $('button[type=submit]', f);
        busy(b, true);
        try {
          await startPayment();
        } catch (ex) {
          busy(b, false);
          if (ex.field && ex.field !== 'items' && ex.field !== 'phone') { setStep(1); setFieldErrors(form, ex); return; }
          $('[data-pay-error]', pay).textContent = ex.message;
          if (ex.field === 'items') requote();
        }
      }

      async function ensureOrder(force = false) {
        const sig = JSON.stringify([items(), customer, code]);
        let pending = read('epic-pending');
        if (force || !pending || pending.sig !== sig) {
          const out = await post('/orders', { customer, items: items(), discountCode: code, paymentProvider: 'mpesa' });
          pending = { number: out.number, token: out.token, total: out.total, sig };
          write('epic-pending', pending);
          write('epic-order-' + out.number, { token: out.token });
        }
        return pending;
      }

      async function startPayment() {
        let order = await ensureOrder();
        let res;
        try {
          res = await post(`/payments/mpesa/start`, { number: order.number, phone: phoneUsed }, { headers: { 'X-Order-Token': order.token } });
        } catch (ex) {
          if (ex instanceof ApiError && (ex.status === 409 || ex.status === 404)) {
            order = await ensureOrder(true);
            res = await post(`/payments/mpesa/start`, { number: order.number, phone: phoneUsed }, { headers: { 'X-Order-Token': order.token } });
          } else throw ex;
        }
        if (res.status === 'paid') return succeed(order);
        waiting(order);
      }

      function waiting(order) {
        const started = Date.now();
        paystate('waiting', {
          title: 'Waiting for payment…',
          text: `Check your phone (${phoneUsed.replace(/^254/, '0').replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3')}). Enter your M-PESA PIN to pay ${money(order.total)} to EPIC WEAR.`,
          extra: html`<ol class="paystate__steps"><li>Unlock your phone</li><li>Check the M-PESA prompt shows ${money(order.total)}</li><li>Enter your PIN and confirm</li></ol>
            <p class="paystate__timer" data-timer>2:00</p>
            <div class="paystate__actions"><button type="button" class="linkish" data-cancel-wait>Use a different number</button></div>`,
        });
        $('[data-cancel-wait]', pay).addEventListener('click', () => { stopPolling(); renderPayForm(); });
        const tick = () => {
          const left = Math.max(0, POLL_MAX_MS - (Date.now() - started));
          const t = $('[data-timer]', pay);
          if (t) t.textContent = `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`;
        };
        const poll = async () => {
          if (!alive) return;
          tick();
          try {
            const s = await get(`/payments/status?number=${order.number}&token=${encodeURIComponent(order.token)}`);
            if (s.paymentStatus === 'paid') return succeed(order);
            if (s.paymentStatus === 'failed') return fail(s.message || 'The payment was cancelled or declined.');
            if (s.status === 'cancelled') { write('epic-pending', null); return fail('This order expired before payment was received. Please try again.'); }
          } catch { /* transient — keep polling */ }
          if (Date.now() - started > POLL_MAX_MS) return fail('We did not receive a confirmation from M-PESA in time. If you were charged, your order will confirm automatically — check Track My Order.', true);
          polling = setTimeout(poll, POLL_MS);
        };
        stopPolling();
        timer = setInterval(tick, 1000);
        polling = setTimeout(poll, POLL_MS);
      }

      function fail(message, timedOut = false) {
        stopPolling();
        paystate('fail', {
          title: 'Payment could not be completed',
          text: message,
          extra: html`<div class="paystate__actions">
            <button type="button" class="btn btn--primary" data-retry><span class="btn__inner">${icon('return')}<span>Try again</span></span></button>
            <button type="button" class="btn btn--ghost" data-change><span class="btn__inner"><span>Change number</span></span></button>
          </div>
          <p class="note" style="justify-content:center;margin-top:8px">${icon('whatsapp')}<span>Need help? <a class="linkish" href="${waLink(state.config.settings, `Hi EPIC, I need help paying for order ${read('epic-pending')?.number || ''}`)}" target="_blank" rel="noopener">WhatsApp +254 742 850 266</a></span></p>`,
        });
        $('[data-retry]', pay).addEventListener('click', async (ev) => {
          busy(ev.currentTarget, true);
          try { await startPayment(); } catch (ex) { renderPayForm(ex.message); }
        });
        $('[data-change]', pay).addEventListener('click', () => renderPayForm());
      }

      function succeed(order) {
        done = true;
        stopPolling();
        write('epic-pending', null);
        write('epic-code', null);
        clearCart();
        $$('[data-ind]', el).forEach((s) => { s.classList.add('is-done'); s.classList.remove('is-active'); });
        paystate('ok', { title: 'Payment confirmed', text: `Thank you — ${money(order.total)} received. Taking you to your order…` });
        setTimeout(() => alive && window.epicNavigate(`/order/${order.number}`, { replace: true }), reduced ? 400 : 1500);
      }

      /* ---------- misc ---------- */
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-edit]')) { stopPolling(); setStep(1); }
        if (e.target.closest('[data-open-bag]')) window.epicOpenCart();
      });
      el.addEventListener('submit', async (e) => {
        if (!e.target.matches('[data-discount]')) return;
        e.preventDefault();
        code = e.target.elements.code.value.trim().toUpperCase();
        write('epic-code', code || null);
        await requote();
        if (quote?.discountCode) toast(`${quote.discountCode} applied`, { icon: 'tag' });
        if (!$('[data-step2]', el).hidden && !polling) renderPayForm();
      });
      const offCart = on('cart', () => { if (!alive || done) return; quote = null; if (!state.cart.length) return window.epicNavigate('/checkout', { replace: true }); requote().then(() => { if (alive && !$('[data-step2]', el).hidden && !polling) renderPayForm(); }); });

      return () => { alive = false; stopPolling(); offCart(); };
    },
  };
}
