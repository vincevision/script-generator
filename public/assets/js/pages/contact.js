// CONTACT — "GET IN TOUCH". Call / WhatsApp, emails, socials and a contact form.
import { html, raw, icon, $, formData, busy, setFieldErrors } from '../lib/dom.js';
import { post } from '../lib/api.js';
import { state, loadConfig } from '../lib/store.js';
import { toast } from '../ui/toast.js';
import { crumbs, field, selectField, socialLinks, waLink, telLink, pageTitle, successCheck } from './_shared.js';

const TOPICS = ['Customer support', 'Order question', 'Business inquiry', 'Collaboration', 'Press', 'Other'];

export default async function contact({ query }) {
  await loadConfig();
  const s = state.config.settings || {};
  const topic = TOPICS.includes(query.topic) ? query.topic : 'Customer support';
  const u = state.user;
  return {
    title: pageTitle('Contact — Get in touch with EPIC WEAR · +254 742 850 266'),
    html: html`
<header class="phero container">
  ${crumbs([['Home', '/'], ['Contact']])}
  <p class="eyebrow hero-in" style="--d:0"><span>[Contact]</span> ${s.hours || 'Mon – Sat · 9:00 – 18:00 EAT'}</p>
  <h1 class="phero__title" data-split>Get in touch</h1>
  <p class="phero__text hero-in" style="--d:2">Questions about sizing, an order, or working with EPIC WEAR? Call, WhatsApp or write to us — a real person replies.</p>
</header>

<section class="section section--tight" style="padding-top:0" aria-label="Contact options">
  <div class="container contact-grid">
    <article class="contact__item" data-reveal>
      <span class="contact__icon icon-hover--shake">${icon('call')}</span>
      <span class="contact__label">Call or WhatsApp</span>
      <a class="contact__value" href="${telLink(s)}">${s.phone || '+254 742 850 266'}</a>
      <p>Fastest for order and sizing questions.</p>
      <div class="contact__actions">
        <a class="btn btn--primary magnetic" href="${telLink(s)}" data-cursor="button"><span class="btn__inner">${icon('call')}<span>Call us</span></span></a>
        <a class="btn btn--whatsapp magnetic" href="${waLink(s, 'Hi EPIC WEAR 👋')}" target="_blank" rel="noopener" data-cursor="button"><span class="btn__inner">${icon('whatsapp')}<span>WhatsApp us</span></span></a>
      </div>
    </article>
    <article class="contact__item" data-reveal style="--rd:.08s">
      <span class="contact__icon icon-hover--nudge">${icon('mail')}</span>
      <span class="contact__label">Email</span>
      <a class="contact__value" href="mailto:${s.email || 'hello@epicwear.co.ke'}">${s.email || 'hello@epicwear.co.ke'}</a>
      <p>Support: <a class="linkish" href="mailto:${s.supportEmail || 'support@epicwear.co.ke'}">${s.supportEmail || 'support@epicwear.co.ke'}</a></p>
      <p>Business: <a class="linkish" href="mailto:${s.businessEmail || 'business@epicwear.co.ke'}">${s.businessEmail || 'business@epicwear.co.ke'}</a></p>
    </article>
    <article class="contact__item" data-reveal style="--rd:.16s">
      <span class="contact__icon icon-hover--bounce">${icon('pin')}</span>
      <span class="contact__label">Based in</span>
      <span class="contact__value">${s.location || 'Nairobi, Kenya'}</span>
      <p>Online store · delivering across Kenya and worldwide.</p>
      <div class="socials-row">${socialLinks(s)}</div>
    </article>
  </div>
</section>

<section class="section section--tight" aria-labelledby="formTitle">
  <div class="container contact-main">
    <div class="co-card" data-reveal>
      <h2 class="co-card__title" id="formTitle"><span>[01]</span> Send a message</h2>
      <form class="form" data-contact novalidate>
        <div class="form-grid">
          ${field({ name: 'name', label: 'Full name', autocomplete: 'name', value: u?.name || '' })}
          ${field({ name: 'email', label: 'Email', type: 'email', autocomplete: 'email', value: u?.email || '' })}
          ${field({ name: 'phone', label: 'Phone', type: 'tel', autocomplete: 'tel', required: false, value: u?.phone || '', placeholder: '07XX XXX XXX' })}
          ${selectField({ name: 'topic', label: 'Topic', options: TOPICS, value: topic })}
          <label class="field span-2"><span class="field__label">Message</span><textarea class="textarea" name="message" required minlength="10" maxlength="4000" placeholder="How can we help?"></textarea><span class="field__error" aria-live="polite"></span></label>
        </div>
        <p class="form-error" data-error role="alert"></p>
        <button type="submit" class="btn btn--primary magnetic" data-cursor="button"><span class="btn__inner"><span>Send message</span>${icon('send')}</span></button>
      </form>
      <div class="success" data-success hidden tabindex="-1" style="text-align:center">
        ${successCheck()}
        <h3 class="success__title">Message sent.</h3>
        <p class="success__text">Thanks — we usually reply within one business day.</p>
      </div>
    </div>
    <div data-reveal>
      <div class="info-row">${icon('package')}<div><b>Order support</b><span>Have your order number (EPIC-XXXXXX) ready. You can also <a class="linkish" href="/track">track your order</a>.</span></div></div>
      <div class="info-row">${icon('tag')}<div><b>Business inquiries</b><a href="mailto:${s.businessEmail || 'business@epicwear.co.ke'}">${s.businessEmail || 'business@epicwear.co.ke'}</a></div></div>
      <div class="info-row">${icon('spark')}<div><b>Collaborations</b><span>See our partnership with <a class="linkish" href="/collab">Sharon Thrift Wear</a>.</span></div></div>
      <div class="info-row">${icon('clock')}<div><b>Hours</b><span>${s.hours || 'Mon – Sat · 9:00 – 18:00 EAT'}</span></div></div>
      <div class="info-row">${icon('return')}<div><b>Help centre</b><span><a class="linkish" href="/help/shipping">Shipping</a> · <a class="linkish" href="/help/returns">Returns</a> · <a class="linkish" href="/help/faq">FAQ</a></span></div></div>
    </div>
  </div>
</section>`,
    init(el) {
      const form = $('[data-contact]', el);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = $('[data-error]', el);
        err.textContent = '';
        const b = $('button[type=submit]', form);
        busy(b, true);
        try {
          await post('/contact', formData(form));
          form.hidden = true;
          const ok = $('[data-success]', el);
          ok.hidden = false;
          requestAnimationFrame(() => ok.classList.add('is-shown'));
          ok.focus();
          toast('Message sent — thank you', { icon: 'send' });
        } catch (ex) {
          if (!setFieldErrors(form, ex)) err.textContent = ex.message;
        } finally { busy(b, false); }
      });
    },
  };
}
