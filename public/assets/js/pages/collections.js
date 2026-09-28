// COLLECTIONS — every campaign with its own banner.
import { html } from '../lib/dom.js';
import { state, loadCatalog } from '../lib/store.js';
import { crumbs, campaignTile, pageTitle } from './_shared.js';

export default async function collections() {
  await loadCatalog();
  const list = state.collections;
  return {
    title: pageTitle('Collections — New Drop, Essentials, Street, Limited, EPIC × Sharon'),
    html: html`
<header class="phero container">
  ${crumbs([['Home', '/'], ['Collections']])}
  <p class="eyebrow hero-in" style="--d:0"><span>[${String(list.length).padStart(2, '0')}]</span> Campaigns</p>
  <h1 class="phero__title" data-split>The Collections</h1>
  <p class="phero__text hero-in" style="--d:2">Every EPIC drop tells its own story. Pick a campaign — each one has its own mood, its own pieces and the same obsession with detail.</p>
</header>
<div class="container coll-list">
  ${list.map((c, i) => campaignTile(c, { big: true, i }))}
</div>`,
  };
}
