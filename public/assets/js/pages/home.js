import { html, raw, icon, pic, money, $, $$, reduced, finePointer, lerp } from '../lib/dom.js';
import { state, loadCatalog, categoryLabel } from '../lib/store.js';
import { post } from '../lib/api.js';
import { productGrid } from '../ui/card.js';
import { manifesto, mouse } from '../lib/fx.js';
import { content, sectionHead, btn, campaignTile, epicXSharon } from './_shared.js';

const slugFromImage = (src) => (src || '').match(/products\/([\w-]+)\//)?.[1];

export default async function home() {
  const [c] = await Promise.all([content('home'), loadCatalog()]);
  const featured = state.products.filter((p) => p.featured).slice(0, 8);
  const drop = featured.length >= 4 ? featured : state.products.slice(0, 8);
  const campaigns = state.collections.filter((x) => x.isCampaign);
  const heroProduct = state.bySlug.get(slugFromImage(c.imageLeft)) || drop[0];
  const heroProduct2 = state.bySlug.get(slugFromImage(c.imageRight));
  const cats = state.config.categories.map((cat) => ({ ...cat, n: state.products.filter((p) => p.category === cat.slug).length })).filter((x) => x.n);
  const [h1, h2] = splitHeadline(c.headline || 'Built for those who stand out.');

  return {
    title: 'EPIC WEAR — Built for those who stand out. | Premium Kenyan Streetwear',
    html: html`
<section class="hero hero--store" aria-labelledby="heroTitle">
  <div class="fashion" aria-hidden="true">
    <div class="fx fx--hoodie" data-depth="0.6"><div class="fx__float"><svg viewBox="0 0 64 64"><path pathLength="1" d="M22 10c2-4 18-4 20 0l10 6 6 16-7 3-3-8v29H16V27l-3 8-7-3 6-16 10-6Z"/><path pathLength="1" d="M22 10c0 7 4 12 10 12s10-5 10-12"/><path pathLength="1" d="M22 42h20l-3 8H25l-3-8Z"/></svg></div></div>
    <div class="fx fx--cap" data-depth="0.5"><div class="fx__float"><svg viewBox="0 0 64 64"><path pathLength="1" d="M8 40c0-14 10-24 24-24s24 10 24 24Z"/><path pathLength="1" d="M34 40h23c3 0 4 3 1 4.2-6 2.2-15 2.4-26 .6"/><path pathLength="1" d="M32 16v24"/></svg></div></div>
    <div class="fx fx--hanger" data-depth="0.25"><div class="fx__float"><svg viewBox="0 0 64 64"><path pathLength="1" d="M27 13a5 5 0 1 1 5 5v5"/><path pathLength="1" d="M32 23 6 41c-2 1.5-1 4 1.5 4h49c2.5 0 3.5-2.5 1.5-4L32 23Z"/></svg></div></div>
  </div>

  <div class="hero__grid">
    <div class="hero__copy">
      <div class="status-chip hero-in" style="--d:0"><span class="pulse-dot" aria-hidden="true"></span><span>${c.kicker || 'New drop — out now'}</span><span class="status-chip__sep" aria-hidden="true"></span><strong>Official Store</strong></div>
      <h1 class="sr-only" id="heroTitle">EPIC WEAR — ${c.headline}</h1>
      <div class="hero__logo" data-cursor="logo">
        <svg class="epic-svg" id="heroLogo" viewBox="0 0 334 100" aria-hidden="true">
          <g mask="url(#epic-cut)"><use href="#g-e"/><use href="#g-p"/><use href="#g-i"/><use href="#g-c"/></g>
          <use href="#g-dot" fill="#FF4D17"/>
          <g mask="url(#epic-glyphs)"><rect class="epic-sweep" x="-140" y="-10" width="120" height="120" fill="url(#epic-sweep-grad)"/></g>
        </svg>
      </div>
      <p class="hero__wear hero-in" style="--d:1" aria-hidden="true"><span>W</span><span>E</span><span>A</span><span>R</span></p>
      <p class="hero__title" aria-hidden="true">
        <span class="line"><span class="hero-in hero-in--mask" style="--d:2">${h1}</span></span>
        <span class="line"><span class="hero-in hero-in--mask" style="--d:3">${raw(h2)}</span></span>
      </p>
      <p class="hero__text hero-in" style="--d:4">${c.subtext}</p>
      <div class="hero__cta hero-in" style="--d:5">
        ${btn(c.primaryCta || 'Shop Collection', { href: '/shop', leading: 'bag' })}
        ${btn(c.secondaryCta || 'Explore EPIC', { href: '#latest-drop', variant: 'ghost', iconName: '', leading: 'spark' })}
      </div>
      <ul class="hero__trust hero-in" style="--d:6">
        <li>${icon('truck')}<span>Countrywide delivery</span></li>
        <li>${icon('phone')}<span>Pay with M-PESA</span></li>
        <li>${icon('return')}<span>Easy exchanges</span></li>
      </ul>
    </div>

    <div class="hero__visual" aria-label="Models wearing EPIC WEAR">
      <figure class="hero__model hero__model--a hero-in" style="--d:3" data-depth="0.5">
        <div class="hero__frame">${pic(c.imageLeft, { alt: `Model wearing the ${heroProduct?.name || 'EPIC WEAR collection'}`, eager: true, sizes: '(max-width: 960px) 70vw, 32vw' })}</div>
      </figure>
      <figure class="hero__model hero__model--b hero-in" style="--d:4" data-depth="1">
        <div class="hero__frame">${pic(c.imageRight, { alt: `Model wearing the ${heroProduct2?.name || 'EPIC WEAR collection'}`, eager: true, sizes: '(max-width: 960px) 45vw, 20vw' })}</div>
      </figure>
      <svg class="hero__ring hero-in" style="--d:6" viewBox="0 0 200 200" aria-hidden="true">
        <defs><path id="ringPath" d="M100 100m-78 0a78 78 0 1 1 156 0a78 78 0 1 1-156 0"/></defs>
        <text><textPath href="#ringPath">EPIC WEAR · BUILT FOR THOSE WHO STAND OUT · NAIROBI ·</textPath></text>
      </svg>
      ${heroProduct ? html`<a class="hero__tag hero-in" style="--d:7" href="/product/${heroProduct.slug}">
        <span class="hero__tag-dot" aria-hidden="true"></span>
        <span><small>Now wearing</small><b>${heroProduct.name.replace(/^EPIC\s+/, '')}</b></span>
        <span class="hero__tag-price">${money(heroProduct.price)}</span>${icon('arrow', 'icon--arrow')}
      </a>` : ''}
    </div>
  </div>

  <a href="#latest-drop" class="hero__scroll hero-in" style="--d:8" aria-label="Scroll to the latest drop"><span>Scroll</span><i aria-hidden="true"></i></a>
</section>

<div class="marquee" aria-hidden="true">
  <div class="marquee__track">
    ${[0, 1].map(() => html`<div class="marquee__group"><span>EPIC WEAR</span><b>✦</b><span class="o">Built for those</span><b>✦</b><span>who stand out</span><b>✦</b><span class="o">New Drop</span><b>✦</b><span>Nairobi</span><b>✦</b></div>`)}
  </div>
</div>

<section class="section section--tight" id="latest-drop" aria-labelledby="dropTitle">
  <div class="container">
    ${sectionHead({ id: 'dropTitle', idx: '01', eyebrow: 'Just landed', title: 'The Latest Drop', text: 'Heavyweight fabrics, sharp silhouettes and the EPIC mark — built to be worn hard. Tap + to add your size in one move.', action: btn('Shop all', { href: '/shop', variant: 'ghost' }) })}
    <div class="grid grid--products" id="dropGrid">${productGrid(drop, { eager: false })}</div>
  </div>
</section>

<section class="section section--tight" aria-labelledby="campTitle">
  <div class="container">
    ${sectionHead({ id: 'campTitle', idx: '02', eyebrow: 'Campaigns', title: 'The Collections', text: 'Five stories, one identity. Every campaign has its own mood — all of them are unmistakably EPIC.', action: btn('All collections', { href: '/collections', variant: 'ghost' }) })}
    <div class="campaigns">${campaigns.map((x, i) => campaignTile(x, { big: i === 0, i }))}</div>
  </div>
</section>

<section class="section section--tight" aria-label="Shop by category">
  <div class="container">
    ${sectionHead({ idx: '03', eyebrow: 'Find your fit', title: 'Shop by category' })}
    <div class="cats" data-reveal>
      ${cats.map((cat, i) => html`<a href="/shop?category=${cat.slug}" class="cat" style="--i:${i}">
        <span class="cat__icon">${icon(cat.icon)}</span><span class="cat__label">${cat.label}</span><span class="cat__n">${String(cat.n).padStart(2, '0')}</span>
      </a>`)}
    </div>
  </div>
</section>

<section class="section collab-teaser" aria-labelledby="collabTitle">
  <div class="container collab-teaser__grid">
    <div class="collab-teaser__media reveal-img" data-reveal>
      ${pic(state.collections.find((x) => x.slug === 'epic-x-sharon')?.banner || '/assets/img/products/signature-logo-tee/1', { alt: 'EPIC WEAR × Sharon Thrift Wear campaign', sizes: '(max-width: 900px) 100vw, 50vw' })}
      <span class="collab-teaser__stamp">Official Collaboration</span>
    </div>
    <div class="collab-teaser__copy">
      <p class="eyebrow" data-reveal><span>[04]</span> Collaboration</p>
      <div data-reveal>${epicXSharon('xmark--lg')}</div>
      <h2 class="section-title section-title--md" id="collabTitle" data-split>Two brands. One EPIC movement.</h2>
      <p class="lead" data-reveal>New EPIC design meets carefully sourced pre-loved fashion. Reworked, limited and made to stand out.</p>
      <div data-reveal>${btn('Discover the collab', { href: '/collab' })}</div>
    </div>
  </div>
</section>

<section class="section about" aria-labelledby="manifestoTitle">
  <div class="container">
    <p class="eyebrow" data-reveal><span>[05]</span> The Manifesto</p>
    <h2 class="sr-only" id="manifestoTitle">The EPIC manifesto</h2>
    <p class="manifesto" id="manifesto">${manifestoText(c.manifesto)}</p>
    <div class="features">
      ${[
        ['shirt', 'Heavyweight quality', '240–450gsm cottons and fleece, reinforced seams, built to last.', 'scale'],
        ['phone', 'Pay with M-PESA', 'Instant, secure STK push checkout. No card needed.', 'shake'],
        ['truck', 'Countrywide delivery', 'Nairobi in 1–2 days, all 47 counties in 2–4. We ship worldwide too.', 'nudge'],
        ['return', 'Easy exchanges', 'Wrong size? Exchange within 7 days of delivery.', 'rotate'],
      ].map(([ic, t, d, hv], i) => html`<div class="feature" data-reveal><span class="feature__idx">0${i + 1}</span><div class="feature__icon icon-hover--${hv}">${icon(ic)}</div><h3>${t}</h3><p>${d}</p></div>`)}
    </div>
  </div>
</section>

<section class="section section--tight notify" aria-labelledby="joinTitle">
  <div class="container">
    <div class="notify__card" data-reveal>
      <div class="notify__glow" aria-hidden="true"></div>
      <div class="notify__bell icon-hover--shake">${icon('bell')}</div>
      <h2 class="section-title" id="joinTitle">Join the EPIC list</h2>
      <p class="notify__text">First access to new drops, restocks and members-only releases. No spam — just the good stuff.</p>
      <form class="signup" id="joinForm" novalidate>
        <div class="signup__row">
          <label class="signup__field">${icon('mail')}<span class="sr-only">Email address</span><input type="email" name="email" placeholder="Enter your email" autocomplete="email" required></label>
          <button class="btn btn--primary signup__btn" type="submit"><span class="btn__inner"><span>Join</span>${icon('arrow', 'icon--arrow')}</span></button>
        </div>
        <p class="signup__error" role="alert"></p>
      </form>
    </div>
  </div>
</section>`.s,

    init(root) {
      const stops = [manifesto($('#manifesto', root))];
      // hero parallax (mouse on desktop + scroll)
      if (!reduced) {
        const models = $$('.hero__model, .fx', root);
        const heroEl = $('.hero', root);
        let raf, mx = 0, my = 0;
        const loop = () => {
          mx = lerp(mx, mouse.nx || 0, 0.06); my = lerp(my, mouse.ny || 0, 0.06);
          const sy = window.scrollY;
          if (sy < innerHeight * 1.2) models.forEach((el) => {
            const d = parseFloat(el.dataset.depth) || 0.4;
            el.style.translate = `${(-mx * 34 * d).toFixed(1)}px ${(-my * 26 * d - sy * d * 0.12).toFixed(1)}px`;
          });
          raf = requestAnimationFrame(loop);
        };
        if (heroEl) loop();
        stops.push(() => cancelAnimationFrame(raf));
      }
      const form = $('#joinForm', root);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = $('.signup__error', form);
        const email = form.email.value.trim();
        err.textContent = '';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { form.classList.remove('has-error'); void form.offsetWidth; form.classList.add('has-error'); err.textContent = 'Please enter a valid email address.'; return; }
        form.classList.add('is-loading');
        try {
          await post('/subscribe', { email });
          form.outerHTML = html`<div class="success is-shown" tabindex="-1"><svg class="success__check" viewBox="0 0 52 52" aria-hidden="true"><circle class="success__circle" cx="26" cy="26" r="24" pathLength="1"/><path class="success__tick" d="M15 27l7 7 15-15" pathLength="1"/></svg><p class="success__title">You're on the list.</p><p class="success__text">Welcome to EPIC. We'll email ${email} before every drop.</p></div>`.s;
        } catch (ex) { err.textContent = ex.message; form.classList.remove('is-loading'); }
      });
      return () => stops.forEach((f) => f());
    },
  };
}

function splitHeadline(h) {
  const words = h.replace(/\.$/, '').split(/\s+/);
  const cut = Math.ceil(words.length / 2);
  const first = words.slice(0, cut).join(' ');
  const rest = words.slice(cut);
  const tail = rest.slice(-2).join(' ');
  const mid = rest.slice(0, -2).join(' ');
  return [first, `${mid ? `${mid.replace(/[&<>]/g, '')} ` : ''}<em>${tail.replace(/[&<>]/g, '')}.</em>`];
}

function manifestoText(t = '') {
  // emphasise the final sentence in ember, as on the launch site
  const parts = t.trim().split(/(?<=\.)\s+/);
  const last = parts.pop() || '';
  return html`${parts.join(' ')} <em>${last}</em>`;
}
