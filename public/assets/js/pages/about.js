// ABOUT — "THIS IS EPIC." Brand story, founder, values. No inflated claims.
import { html, raw, icon, pic } from '../lib/dom.js';
import { content, crumbs, sectionHead, btn, pageTitle } from './_shared.js';

const VALUE_ICONS = ['shield', 'pin', 'spark', 'user'];

export default async function about() {
  const c = await content('about');
  const f = c.founder || {};
  const initials = (f.name || 'Vincent Omondi').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return {
    title: pageTitle('About — This is EPIC. Kenyan streetwear by Vincent Omondi'),
    html: html`
<header class="phero container about-hero" id="our-story">
  ${crumbs([['Home', '/'], ['About']])}
  <svg class="about-hero__logo hero-in" style="--d:0" viewBox="0 0 334 100" role="img" aria-label="EPIC WEAR"><use href="#epic-logo"/></svg>
  <p class="eyebrow hero-in" style="--d:1"><span>[About]</span> EPIC WEAR · Nairobi, Kenya</p>
  <h1 class="phero__title" data-split>${c.headline || 'This is EPIC.'}</h1>
  <div class="about-intro" style="margin-top:clamp(24px,4vw,48px)">
    <p class="lead hero-in" style="--d:3">${c.intro}</p>
    <p class="hero-in" style="--d:4">Built for those who stand out — that line is the whole brief. Every piece starts with the fabric, the fit and the finish, and ends with the EPIC mark.</p>
  </div>
</header>

<section class="section section--tight" aria-label="Our story">
  <div class="container">
    <div class="story">
      ${(c.sections || []).map((s, i) => html`<article class="story__item" data-reveal style="--rd:${i * 0.1}s">
        <span class="story__idx">${String(i + 1).padStart(2, '0')}</span>
        <h3>${s.title}</h3>
        <p>${s.body}</p>
      </article>`)}
    </div>
  </div>
</section>

<section class="section" aria-labelledby="founderName">
  <div class="container founder">
    <figure class="portrait reveal-img" data-reveal>
      ${f.portrait ? pic(f.portrait, { alt: `${f.name}, ${f.role}`, sizes: '(max-width: 960px) 90vw, 36vw' }) : html`<div class="portrait__mono" role="img" aria-label="${f.name} monogram"><span class="portrait__glow"></span><i></i><b>${initials}</b></div>`}
      <span class="portrait__frame" aria-hidden="true"></span>
      <figcaption class="portrait__cap"><span>Founder · EPIC WEAR</span><svg viewBox="0 0 334 100" aria-hidden="true"><use href="#epic-logo"/></svg></figcaption>
    </figure>
    <div>
      <p class="eyebrow" data-reveal><span>[Founder]</span> Meet the founder</p>
      <h2 class="founder__name" id="founderName" data-split>${f.name}</h2>
      <div class="founder__roles" data-reveal>
        <span class="role role--main">${icon('spark')}${f.role}</span>
        ${f.secondaryRole ? html`<span class="role">${f.secondaryRole}</span>` : ''}
      </div>
      ${f.quote ? html`<blockquote class="founder__quote" data-reveal>“${f.quote}”</blockquote>` : ''}
      <div class="founder__bio" data-reveal>${(f.bio || []).map((b) => html`<p>${b}</p>`)}</div>
    </div>
  </div>
</section>

<section class="section section--tight" aria-labelledby="valuesTitle">
  <div class="container">
    ${sectionHead({ id: 'valuesTitle', idx: '02', eyebrow: 'What we stand for', title: 'The EPIC standard' })}
    <div class="values">
      ${(c.values || []).map((v, i) => html`<article class="value" data-reveal style="--rd:${i * 0.08}s">${icon(VALUE_ICONS[i % VALUE_ICONS.length])}<h3>${v.title}</h3><p>${v.body}</p></article>`)}
    </div>
  </div>
</section>

<section class="section section--tight">
  <div class="container">
    <div class="cta-band" data-reveal>
      <div><h2>Wear the<br>story.</h2><p>Explore the latest drop, or get in touch — we read every message.</p></div>
      <div class="cta-band__actions">${btn('Shop collection', { href: '/shop', leading: 'bag' })}${btn('Contact us', { href: '/contact', variant: 'ghost', iconName: '' })}</div>
    </div>
  </div>
</section>`,
  };
}
