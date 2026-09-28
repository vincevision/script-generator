// HELP — shipping, returns & exchanges, FAQ.
import { html, raw, icon, money } from '../lib/dom.js';
import { state, loadConfig } from '../lib/store.js';
import { crumbs, btn, pageTitle, waLink } from './_shared.js';

const TOPICS = [['shipping', 'Shipping', 'truck'], ['returns', 'Returns & exchanges', 'return'], ['faq', 'FAQ', 'spark']];

function shipping(c) {
  return html`<h2>Delivery rates</h2>
  <table class="rate-table"><thead><tr><th>Destination</th><th>Time</th><th>Fee</th></tr></thead><tbody>
    <tr><td>Nairobi</td><td>1–2 business days</td><td>${money(c.delivery.nairobi)}</td></tr>
    <tr><td>Rest of Kenya</td><td>2–4 business days</td><td>${money(c.delivery.kenya)}</td></tr>
    <tr><td>Kenya — orders over ${money(c.freeDeliveryThreshold)}</td><td>1–4 business days</td><td>Free</td></tr>
    <tr><td>International (express)</td><td>5–10 business days</td><td>${money(c.delivery.international)}</td></tr>
  </tbody></table>
  <h2>How it works</h2>
  <ul>
    <li>Orders are processed after payment is confirmed. You will receive your order number (EPIC-XXXXXX) immediately.</li>
    <li>Orders placed before 2 pm EAT on business days usually leave our Nairobi studio the same day.</li>
    <li>Our rider or courier will call the phone number on your order before delivery.</li>
    <li>Follow every step on <a href="/track">Track My Order</a> — Order Placed, Processing, Packed, Shipped, Delivered.</li>
  </ul>
  <h2>International customers</h2>
  <p>We ship worldwide. Duties and import taxes, where they apply, are charged by your country on arrival and are the customer’s responsibility. M-PESA is our payment method today; if you cannot pay with M-PESA, message us on <a href="${waLink(c.settings, 'Hi EPIC, I would like to order from outside Kenya.')}" target="_blank" rel="noopener">WhatsApp</a> and we will help you complete your order.</p>`;
}

function returns() {
  return html`<h2>Exchanges</h2>
  <p>Wrong size? We will exchange any unworn item with its original tags within <b>7 days of delivery</b>, subject to stock. In Nairobi the first size exchange is on us.</p>
  <h2>Returns</h2>
  <ul>
    <li>Items must be unworn, unwashed and in their original packaging with tags attached.</li>
    <li>Limited Edition and EPIC × Sharon reworked vintage pieces are final sale unless faulty.</li>
    <li>Refunds are made to the M-PESA number used for payment within 5 business days of us receiving the item.</li>
    <li>Delivery fees are non-refundable, except where an item is faulty or we sent the wrong item.</li>
  </ul>
  <h2>How to start</h2>
  <p>Call or WhatsApp <a href="tel:+254742850266">+254 742 850 266</a> or email <a href="mailto:support@epicwear.co.ke">support@epicwear.co.ke</a> with your order number and the item you would like to exchange or return.</p>`;
}

const FAQ = [
  ['How do I pay with M-PESA?', 'At checkout, choose M-PESA and enter your Safaricom number. You will receive a prompt on your phone — enter your M-PESA PIN to approve. The page confirms your payment automatically.'],
  ['I did not receive the M-PESA prompt.', 'Make sure your phone is on and unlocked, and that the number is correct. You can retry from the payment screen. If money left your account but the order did not confirm, contact us with your M-PESA message — we will sort it out.'],
  ['How do EPIC pieces fit?', 'Most tops are cut oversized with dropped shoulders. Each product has a size guide. For a classic fit, size down one. Still unsure? WhatsApp us — we will help.'],
  ['Do I need an account to order?', 'No. You can check out as a guest. An account lets you see your orders, save addresses and sync your wishlist.'],
  ['How do I track my order?', 'Use Track My Order with your order number and the phone or email you used at checkout.'],
  ['Do you restock sold-out items?', 'EPIC Essentials are restocked regularly. Limited Edition and collaboration pieces are small runs and usually do not return.'],
  ['Can I change or cancel my order?', 'Contact us as soon as possible. We can usually change an order until it has been packed.'],
  ['How should I care for my EPIC pieces?', 'Wash cold, inside out, with similar colours. Do not tumble dry or iron over prints. Heavyweight cotton keeps its shape best when dried flat.'],
];
const faq = () => html`<div class="acc">${FAQ.map(([q, a], i) => html`<details ${raw(i === 0 ? 'open' : '')}><summary>${q} ${icon('plus')}</summary><div class="acc__body"><p>${a}</p></div></details>`)}</div>`;

export default async function help({ params }) {
  const c = await loadConfig();
  const topic = TOPICS.find(([k]) => k === params.topic) || TOPICS[0];
  const [key, label] = topic;
  const body = key === 'shipping' ? shipping(c) : key === 'returns' ? returns() : faq();
  return {
    title: pageTitle(`${label} — Help`),
    html: html`
<header class="phero container">
  ${crumbs([['Home', '/'], ['Help', '/help/faq'], [label]])}
  <p class="eyebrow hero-in" style="--d:0"><span>[Help]</span> We’ve got you</p>
  <h1 class="phero__title" data-split>${label}</h1>
</header>
<div class="container help-layout">
  <nav class="help-nav" aria-label="Help topics">
    ${TOPICS.map(([k, l, ic]) => html`<a href="/help/${k}" class="${k === key ? 'is-active' : ''}" ${raw(k === key ? 'aria-current="page"' : '')}>${icon(ic)}${l}</a>`)}
    <a href="/track">${icon('package')}Track order</a>
    <a href="/contact">${icon('mail')}Contact</a>
  </nav>
  <article class="prose" data-reveal>
    ${body}
    <div class="cta-band" style="margin-top:48px">
      <div><h2 style="font-size:clamp(1.3rem,2.4vw,2rem);margin:0">Still need help?</h2><p>Talk to a real person on +254 742 850 266.</p></div>
      <div class="cta-band__actions">
        <a class="btn btn--whatsapp" href="${waLink(c.settings, 'Hi EPIC WEAR, I need help with')}" target="_blank" rel="noopener"><span class="btn__inner">${icon('whatsapp')}<span>WhatsApp us</span></span></a>
        ${btn('Contact', { href: '/contact', variant: 'ghost', iconName: '' })}
      </div>
    </div>
  </article>
</div>`,
  };
}
