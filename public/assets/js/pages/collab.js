// EPIC WEAR × SHARON THRIFT WEAR — official partnership campaign.
import { html, raw, pic } from '../lib/dom.js';
import { get } from '../lib/api.js';
import { state, loadCatalog } from '../lib/store.js';
import { productGrid } from '../ui/card.js';
import { content, sectionHead, btn, pageTitle, epicXSharon, sharonMark } from './_shared.js';

export default async function collab() {
  const [c, data] = await Promise.all([content('collab'), get('/collections/epic-x-sharon').catch(() => ({ products: [] })), loadCatalog()]);
  const products = data.products.map((p) => state.bySlug.get(p.slug) || p);
  // campaign imagery: collab product shots first, then EPIC studio shots
  const shots = [...new Set([c.banner, ...products.flatMap((p) => p.images), ...state.products.filter((p) => p.collections.includes('street-collection')).map((p) => p.images[0])].filter(Boolean))];
  const bg = shots.slice(0, 3);
  const look = shots.slice(0, 5);
  const [t1, t2] = (c.headline || 'Two brands. One EPIC movement.').split(/(?<=\.)\s+/);

  return {
    title: pageTitle('EPIC WEAR × Sharon Thrift Wear — Two brands. One EPIC movement.'),
    html: html`
<section class="collab-hero" aria-labelledby="collabHero">
  <div class="collab-hero__bg" aria-hidden="true">${bg.map((src, i) => html`<div class="reveal-img">${pic(src, { alt: '', eager: i === 0, sizes: '(max-width: 960px) 50vw, 33vw' })}</div>`)}</div>
  <div class="container collab-hero__inner">
    <div class="hero-in" style="--d:0">${epicXSharon('xmark--lg')}</div>
    <p class="eyebrow hero-in" style="--d:1"><span>[Collab]</span> Official partnership · Limited collection</p>
    <h1 class="collab-hero__title" id="collabHero" data-split>${t1} ${t2 ? raw(`<em>${t2.replace(/[<>&]/g, '')}</em>`) : ''}</h1>
    <p class="collab-hero__text hero-in" style="--d:3">${c.intro}</p>
    <div class="hero__cta hero-in" style="--d:4">
      ${btn('Shop the collab', { href: '#collab-shop', leading: 'bag' })}
      ${btn('Read the story', { href: '#collab-story', variant: 'ghost', iconName: '' })}
    </div>
  </div>
</section>

<section class="section" id="collab-story" aria-labelledby="storyTitle">
  <div class="container collab-story">
    <div>
      <p class="eyebrow" data-reveal><span>[01]</span> The story</p>
      <h2 class="section-title section-title--md" id="storyTitle" data-split>Every piece carries two stories.</h2>
    </div>
    <div class="collab-story__text" data-reveal>
      ${(c.story || []).map((para) => html`<p>${para}</p>`)}
      <div class="collab-duo">
        <div><svg viewBox="0 0 334 100" aria-label="EPIC WEAR" role="img"><use href="#epic-logo"/></svg><p>Heavyweight streetwear designed in Nairobi. Bold, minimal, built to stand out.</p></div>
        <div>${sharonMark()}<p>${c.partner || 'Sharon Thrift Wear'} — curated pre-loved fashion with character, sourced piece by piece.</p></div>
      </div>
    </div>
  </div>
</section>

${look.length >= 3 ? html`<section class="section section--tight" aria-label="Campaign lookbook">
  <div class="container">
    <div class="lookbook">${look.map((src, i) => html`<div class="reveal-img" data-reveal>${pic(src, { alt: `EPIC × Sharon campaign look ${i + 1}`, sizes: i === 0 ? '(max-width: 960px) 100vw, 40vw' : '(max-width: 960px) 50vw, 30vw' })}<span class="lookbook__cap">Look ${String(i + 1).padStart(2, '0')}</span></div>`)}</div>
  </div>
</section>` : ''}

<section class="section section--tight" id="collab-shop" aria-labelledby="shopTitle">
  <div class="container">
    ${sectionHead({ id: 'shopTitle', idx: '02', eyebrow: 'The collection', title: 'Shop EPIC × Sharon', text: 'Reworked vintage and new EPIC design. Small quantities — some pieces are one of a kind.' })}
    <div class="grid grid--products">${productGrid(products)}</div>
  </div>
</section>

<section class="section section--tight">
  <div class="container">
    <div class="cta-band" data-reveal>
      <div><h2>Two brands.<br>One EPIC movement.</h2><p>Want to collaborate with EPIC WEAR? We are always open to partners who share the vision.</p></div>
      <div class="cta-band__actions">${btn('Business inquiries', { href: '/contact?topic=Collaboration', variant: 'ghost' })}</div>
    </div>
  </div>
</section>`,
  };
}
