// Shared page helpers: CMS content cache, section heads, breadcrumbs, empty states.
import { get } from '../lib/api.js';
import { html, raw, icon, pic } from '../lib/dom.js';

const cache = new Map();
export function content(key) {
  if (!cache.has(key)) cache.set(key, get(`/content/${key}`).then((r) => r.content).catch((e) => { cache.delete(key); throw e; }));
  return cache.get(key);
}

export const pageTitle = (t) => `${t} | EPIC WEAR`;

export const sectionHead = ({ idx, eyebrow, title, text = '', action = '', id = '' }) => html`<div class="section-head">
  <div>
    <p class="eyebrow" data-reveal><span>[${idx}]</span> ${eyebrow}</p>
    <h2 class="section-title"${raw(id ? ` id="${id}"` : '')} data-split>${title}</h2>
  </div>
  ${text || action ? html`<div class="section-head__side" data-reveal>${text ? html`<p class="section-head__text">${text}</p>` : ''}${action ? raw(action.s || action) : ''}</div>` : ''}
</div>`;

export const crumbs = (items) => html`<nav class="crumbs" aria-label="Breadcrumb"><ol>${items.map(([label, href], i) => html`<li>${href && i < items.length - 1 ? html`<a href="${href}">${label}</a>` : html`<span aria-current="page">${label}</span>`}</li>`)}</ol></nav>`;

export const pageHero = ({ eyebrow, title, text = '', extra = '' }) => html`<header class="phero container">
  <p class="eyebrow hero-in" style="--d:0">${raw(eyebrow)}</p>
  <h1 class="phero__title" data-split>${title}</h1>
  ${text ? html`<p class="phero__text hero-in" style="--d:2">${text}</p>` : ''}
  ${extra ? raw(extra.s || extra) : ''}
</header>`;

export const btn = (label, { href, iconName = 'arrow', variant = 'primary', attrs = '', leading = '' } = {}) => {
  const inner = html`<span class="btn__inner">${leading ? icon(leading) : ''}<span>${label}</span>${iconName ? icon(iconName, `icon--${iconName}`) : ''}</span>`;
  return href
    ? html`<a href="${href}" class="btn btn--${variant} magnetic" data-cursor="button" ${raw(attrs)}>${inner}</a>`
    : html`<button type="button" class="btn btn--${variant} magnetic" data-cursor="button" ${raw(attrs)}>${inner}</button>`;
};

export const campaignTile = (c, { big = false, wide = false, i = 0 } = {}) => html`<a href="${c.slug === 'new-drop' ? '/new-drop' : c.slug === 'epic-x-sharon' ? '/collab' : `/collections/${c.slug}`}" class="campaign ${big ? 'campaign--big' : ''} ${c.slug === 'epic-x-sharon' ? 'campaign--collab' : ''}" data-reveal data-cursor="view" data-cursor-label="Explore">
  <div class="campaign__media reveal-img">${pic(c.banner, { alt: `${c.name} — EPIC WEAR campaign`, sizes: wide ? '100vw' : big ? '(max-width: 800px) 100vw, 50vw' : '(max-width: 800px) 100vw, 25vw' })}</div>
  <div class="campaign__overlay">
    <span class="campaign__idx">${String(i + 1).padStart(2, '0')} / ${c.kicker}</span>
    <div>
      ${c.slug === 'epic-x-sharon' ? html`<p class="campaign__collab"><svg viewBox="0 0 334 100" aria-hidden="true"><use href="#epic-logo"/></svg><span>×</span><b>SHARON</b></p>` : ''}
      <h3 class="campaign__name">${c.name}</h3>
      <p class="campaign__headline">${c.headline}</p>
      <span class="campaign__cta">Explore ${icon('arrow', 'icon--arrow')}</span>
    </div>
  </div>
</a>`;

export const emptyState = ({ iconName = 'bag', title, text, action = '' }) => html`<div class="empty" data-reveal>
  <div class="empty__art">${icon(iconName)}</div>
  <p class="empty__title">${title}</p>
  <p class="empty__text">${text}</p>
  ${action ? raw(action.s || action) : ''}
</div>`;

export const sharonMark = (cls = '') => html`<span class="sharon-mark ${cls}" aria-label="Sharon Thrift Wear"><b>SHARON</b><i>THRIFT WEAR</i></span>`;

export const epicXSharon = (cls = '') => html`<span class="xmark ${cls}" role="img" aria-label="EPIC WEAR × Sharon Thrift Wear"><svg viewBox="0 0 334 100" aria-hidden="true"><use href="#epic-logo"/></svg><span class="xmark__x" aria-hidden="true">×</span>${sharonMark()}</span>`;

/* ---------- forms ---------- */
export const field = ({ name, label, type = 'text', value = '', required = true, autocomplete = '', placeholder = '', span = false, hint = '', attrs = '', prefix = '' }) => html`<label class="field ${span ? 'span-2' : ''}">
  <span class="field__label">${label}${required ? '' : html` <em>(optional)</em>`}</span>
  ${prefix ? html`<span class="input-wrap"><span class="input-prefix">${prefix}</span><input class="input" name="${name}" type="${type}" value="${value}" ${raw(required ? 'required' : '')} ${raw(autocomplete ? `autocomplete="${autocomplete}"` : '')} placeholder="${placeholder}" ${raw(attrs)}></span>`
    : html`<input class="input" name="${name}" type="${type}" value="${value}" ${raw(required ? 'required' : '')} ${raw(autocomplete ? `autocomplete="${autocomplete}"` : '')} placeholder="${placeholder}" ${raw(attrs)}>`}
  ${hint ? html`<span class="field__hint">${hint}</span>` : ''}
  <span class="field__error" aria-live="polite"></span>
</label>`;

export const selectField = ({ name, label, options, value = '', required = true, span = false, attrs = '' }) => html`<label class="field ${span ? 'span-2' : ''}">
  <span class="field__label">${label}${required ? '' : html` <em>(optional)</em>`}</span>
  <select class="select" name="${name}" ${raw(required ? 'required' : '')} ${raw(attrs)}>${options.map((o) => {
    const [v, l] = Array.isArray(o) ? o : [o, o];
    return html`<option value="${v}" ${raw(String(v) === String(value) ? 'selected' : '')}>${l}</option>`;
  })}</select>
  <span class="field__error" aria-live="polite"></span>
</label>`;

export const successCheck = () => raw(`<svg class="success__check" viewBox="0 0 52 52" aria-hidden="true"><circle class="success__circle" cx="26" cy="26" r="24" pathLength="1"/><path class="success__tick" d="m15 27 7.5 7.5L38 19" pathLength="1"/></svg>`);

/* ---------- orders ---------- */
export const STATUS_LABELS = {
  pending_payment: 'Awaiting payment', placed: 'Order placed', processing: 'Processing', packed: 'Packed',
  shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled',
};
export const statusPill = (s) => html`<span class="status-pill status-pill--${s}">${STATUS_LABELS[s] || s}</span>`;

const STEPS = [['placed', 'Order placed', 'receipt'], ['processing', 'Processing', 'cog'], ['packed', 'Packed', 'package'], ['shipped', 'Shipped', 'truck'], ['delivered', 'Delivered', 'check']];
export function timeline(order) {
  const idx = STEPS.findIndex(([s]) => s === order.status);
  const reached = order.status === 'cancelled' ? -1 : idx;
  const when = (s) => {
    const h = [...(order.history || [])].reverse().find((x) => x.status === s);
    return h ? new Date(h.at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' }) + ' · ' + new Date(h.at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) : '';
  };
  const p = reached <= 0 ? 0 : reached / (STEPS.length - 1);
  return html`<ol class="timeline" style="--p:${p}" aria-label="Order progress">
    <span class="timeline__fill" aria-hidden="true"></span>
    ${STEPS.map(([s, label, ic], i) => html`<li class="tstep ${i <= reached ? 'is-done' : ''} ${i === reached && s !== 'delivered' ? 'is-current' : ''}" style="--i:${i}" ${raw(i === reached ? 'aria-current="step"' : '')}>
      <span class="tstep__icon">${icon(ic)}</span>
      <span class="tstep__label">${label}</span>
      <span class="tstep__date">${i <= reached ? when(s) : ''}</span>
    </li>`)}
  </ol>`;
}

export const socialLinks = (settings, cls = 'social__link') => {
  const list = [['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['facebook', 'Facebook'], ['x', 'X']].filter(([k]) => settings?.socials?.[k]);
  return html`${list.map(([k, label]) => html`<a class="${cls}" href="${settings.socials[k]}" target="_blank" rel="noopener" aria-label="${label}">${icon(k)}</a>`)}`;
};

export const waLink = (settings, text = '') => `https://wa.me/${(settings?.whatsapp || '254742850266').replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
export const telLink = (settings) => `tel:${(settings?.phone || '+254 742 850 266').replace(/[^\d+]/g, '')}`;
