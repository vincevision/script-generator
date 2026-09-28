// MY WISHLIST — saved pieces; syncs to the account when signed in.
import { html, icon, $ } from '../lib/dom.js';
import { state, loadCatalog, on } from '../lib/store.js';
import { observeReveals } from '../lib/fx.js';
import { productGrid } from '../ui/card.js';
import { crumbs, emptyState, btn, pageTitle } from './_shared.js';

const items = () => state.wishlist.map((id) => state.byId.get(id)).filter(Boolean);

export default async function wishlist() {
  await loadCatalog();
  const list = items();
  const empty = () => emptyState({ iconName: 'heart', title: 'Nothing saved yet', text: 'Tap the heart on any piece to keep it here. Your wishlist is saved on this device — sign in to keep it everywhere.', action: btn('Discover the collection', { href: '/shop' }) });
  return {
    title: pageTitle('My Wishlist'),
    html: html`
<header class="phero container">
  ${crumbs([['Home', '/'], ['Wishlist']])}
  <p class="eyebrow hero-in" style="--d:0"><span>[<span data-n>${list.length}</span>]</span> Saved pieces</p>
  <h1 class="phero__title"><span class="hero-in hero-in--mask" style="--d:1;display:inline-block">My wishlist</span> <span class="wish-heart" aria-hidden="true">${icon('heart')}</span></h1>
  <p class="phero__text hero-in" style="--d:2">${state.user ? 'Synced to your EPIC account.' : html`Saved on this device. <a class="linkish" href="/account">Sign in</a> to sync across devices.`}</p>
</header>
<section class="section section--tight" style="padding-top:clamp(16px,3vw,32px)">
  <div class="container" data-wrap>
    ${list.length ? html`<div class="grid grid--products" data-grid>${productGrid(list, { eager: true })}</div>` : empty()}
  </div>
</section>`,
    init(el) {
      const handler = () => {
        const now = items();
        $('[data-n]', el).textContent = now.length;
        const grid = $('[data-grid]', el);
        if (!grid) return;
        grid.querySelectorAll('.pcard').forEach((card) => {
          const p = state.bySlug.get(card.dataset.slug);
          if (p && !state.wishlist.includes(p.id)) {
            card.classList.add('is-leaving');
            setTimeout(() => {
              card.remove();
              if (!grid.children.length) { $('[data-wrap]', el).innerHTML = empty().s; observeReveals(el); }
            }, 380);
          }
        });
      };
      return on('wishlist', handler);
    },
  };
}
