// COLLECTION — campaign banner + its products. Also serves /new-drop.
import { html, raw, pic } from '../lib/dom.js';
import { get, ApiError } from '../lib/api.js';
import { state, loadCatalog } from '../lib/store.js';
import { productGrid } from '../ui/card.js';
import { crumbs, sectionHead, campaignTile, emptyState, btn, pageTitle, epicXSharon } from './_shared.js';

export default async function collection({ params }) {
  let data;
  try {
    [data] = await Promise.all([get(`/collections/${params.slug}`), loadCatalog()]);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      const nf = await import('./notfound.js');
      return nf.default({ path: `/collections/${params.slug}`, title: 'Collection not found', text: 'This campaign has ended or moved. Explore the current collections instead.' });
    }
    throw e;
  }
  const c = data.collection;
  const products = data.products.map((p) => state.bySlug.get(p.slug) || p);
  const isDrop = c.slug === 'new-drop';
  const isCollab = c.slug === 'epic-x-sharon';
  const others = state.collections.filter((x) => x.slug !== c.slug).slice(0, 3);
  const inStock = products.filter((p) => p.inStock).length;

  return {
    title: pageTitle(`${c.name} — ${c.headline}`),
    html: html`
<section class="cbanner" aria-labelledby="cTitle">
  <div class="cbanner__media">${pic(c.banner, { alt: `${c.name} campaign — EPIC WEAR`, eager: true, sizes: '100vw' })}</div>
  <div class="container cbanner__inner">
    ${crumbs(isDrop ? [['Home', '/'], ['New Drop']] : [['Home', '/'], ['Collections', '/collections'], [c.name]])}
    ${isCollab ? html`<div class="hero-in" style="--d:0;margin-bottom:22px">${epicXSharon()}</div>` : html`<p class="cbanner__kicker hero-in" style="--d:0">${c.kicker}</p>`}
    <h1 class="cbanner__title" id="cTitle" data-split>${c.name}</h1>
    <p class="cbanner__headline hero-in" style="--d:2">${c.headline}</p>
    <p class="cbanner__text hero-in" style="--d:3">${c.description}</p>
    <p class="cbanner__meta hero-in" style="--d:4"><span>${products.length} pieces</span><span>${inStock} in stock</span>${isDrop ? html`<span>Limited quantities</span>` : ''}</p>
  </div>
</section>

<section class="section section--tight" aria-label="${c.name} products">
  <div class="container">
    ${products.length ? html`<div class="grid grid--products">${productGrid(products, { eager: true })}</div>`
      : emptyState({ iconName: 'spark', title: 'Coming soon', text: 'Pieces for this campaign are on their way. Join the EPIC list on the home page to hear first.', action: btn('Shop all', { href: '/shop' }) })}
    ${isCollab ? html`<div class="load-more">${btn('The collab story', { href: '/collab', variant: 'ghost' })}</div>` : ''}
  </div>
</section>

${others.length ? html`<section class="section section--tight" aria-labelledby="moreTitle">
  <div class="container">
    ${sectionHead({ id: 'moreTitle', idx: '→', eyebrow: 'Keep exploring', title: 'More collections', action: btn('All collections', { href: '/collections', variant: 'ghost' }) })}
    <div class="campaigns campaigns--row">${others.map((x, i) => campaignTile(x, { i: state.collections.indexOf(x) }))}</div>
  </div>
</section>` : ''}`,
  };
}
