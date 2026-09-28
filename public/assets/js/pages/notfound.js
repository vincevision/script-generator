// 404 + error fallback (with retry for network failures).
import { html, raw, icon } from '../lib/dom.js';
import { btn, pageTitle } from './_shared.js';

export default async function notfound({ error, path, title, text, action } = {}) {
  const isError = !!error;
  const offline = isError && (error.status === 0 || /fetch|network|offline|import/i.test(error.message || ''));
  return {
    title: pageTitle(isError ? 'Something went wrong' : title || 'Page not found'),
    html: html`
<section class="container nf">
  <div>
    <p class="nf__code" aria-hidden="true">${isError ? (offline ? 'OFF' : 'ERR') : '404'}</p>
    <h1 class="nf__title">${isError ? (offline ? 'You appear to be offline' : 'Something went wrong') : title || 'This page stepped out'}</h1>
    <p class="nf__text">${isError ? (offline ? 'Check your connection and try again — your bag is saved on this device.' : 'We could not load this page. Please try again in a moment.') : text || 'The page you are looking for does not exist or has moved. The collection is still right here.'}</p>
    <div class="hero__cta">
      ${isError ? html`<button type="button" class="btn btn--primary magnetic" data-retry data-cursor="button"><span class="btn__inner">${icon('return')}<span>Try again</span></span></button>` : action ? raw(action.s || action) : btn('Shop collection', { href: '/shop', leading: 'bag' })}
      ${btn('Back home', { href: '/', variant: 'ghost', iconName: '' })}
    </div>
  </div>
</section>`,
    init(el) {
      el.querySelector('[data-retry]')?.addEventListener('click', () => window.epicNavigate(path || location.pathname, { replace: true }));
    },
  };
}
