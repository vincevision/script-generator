// Tiny DOM + formatting helpers shared by every module.
export const $ = (s, c = document) => c.querySelector(s);
export const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const root = document.documentElement;
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
export const lite = root.classList.contains('lite');

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Escape untrusted text for HTML. */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** Tagged template that escapes interpolations unless wrapped with raw(). */
export function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < vals.length) {
      const v = vals[i];
      if (v == null || v === false) return;
      if (Array.isArray(v)) out += v.map((x) => (x && x.__raw ? x.s : esc(x))).join('');
      else out += v && v.__raw ? v.s : esc(v);
    }
  });
  return { __raw: true, s: out, toString() { return out; } };
}
export const raw = (s) => ({ __raw: true, s: String(s ?? ''), toString() { return this.s; } });

export const icon = (name, cls = '') => raw(`<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`);
export const logo = (cls = '') => raw(`<svg class="epic-mark ${cls}" viewBox="0 0 334 100" role="img" aria-label="EPIC"><use href="#epic-logo"/></svg>`);

const kes = new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 });
export const money = (n) => `KES ${kes.format(Math.round(Number(n) || 0))}`;

export function fmtDate(s, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!s) return '';
  const d = new Date(/Z|[+-]\d\d:?\d\d$/.test(s) ? s : `${String(s).replace(' ', 'T')}Z`);
  return d.toLocaleDateString('en-KE', opts);
}

/**
 * Responsive product image. Catalogue images are base paths
 * (/assets/img/products/x/1) with -480/-960 AVIF + WebP variants;
 * admin uploads are full URLs and are used as-is.
 */
/** Bump when catalogue photos are replaced in place (images are cached for 30 days). */
const IMG_V = '?v=3';

export function pic(src, { alt = '', sizes = '(max-width: 700px) 50vw, (max-width: 1200px) 33vw, 25vw', eager = false, cls = '', w = 960, h = 1200 } = {}) {
  if (!src) return raw(`<span class="pic-empty ${cls}" role="img" aria-label="${esc(alt)}"><svg viewBox="0 0 334 100" aria-hidden="true"><use href="#epic-logo"/></svg></span>`);
  const loading = eager ? 'eager" fetchpriority="high' : 'lazy';
  if (/\.\w{3,4}$/.test(src)) {
    return raw(`<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" loading="${loading}" decoding="async" width="${w}" height="${h}">`);
  }
  const s = esc(src);
  return raw(`<picture class="${cls}"><source type="image/avif" srcset="${s}-480.avif${IMG_V} 480w, ${s}-960.avif${IMG_V} 960w" sizes="${sizes}"><source type="image/webp" srcset="${s}-480.webp${IMG_V} 480w, ${s}-960.webp${IMG_V} 960w" sizes="${sizes}"><img src="${s}-960.webp${IMG_V}" alt="${esc(alt)}" loading="${loading}" decoding="async" width="${w}" height="${h}"></picture>`);
}
/** URL of a single bitmap for canvas work / backgrounds. */
export const imgUrl = (src, size = 960) => (!src ? '' : /\.\w{3,4}$/.test(src) ? src : `${src}-${size}.webp${IMG_V}`);

export function debounce(fn, ms = 200) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/** Serialize a <form> into a plain object. */
export const formData = (form) => Object.fromEntries(new FormData(form).entries());

export function setFieldErrors(form, err) {
  $$('.field.has-error', form).forEach((f) => f.classList.remove('has-error'));
  $$('.field__error', form).forEach((e) => (e.textContent = ''));
  if (err?.field) {
    const input = form.elements[err.field] || form.querySelector(`[name="${err.field}"]`);
    const field = input?.closest?.('.field');
    if (field) {
      field.classList.add('has-error');
      const msg = $('.field__error', field);
      if (msg) msg.textContent = err.message;
      input.focus?.();
      return true;
    }
  }
  return false;
}

/** Busy state for buttons (spinner + disabled). */
export function busy(btn, on) {
  if (!btn) return;
  btn.classList.toggle('is-busy', on);
  btn.disabled = on;
}
