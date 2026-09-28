// Server-side SEO: every HTML response gets route-specific <title>, meta
// description, canonical, Open Graph / Twitter tags and JSON-LD, so crawlers
// and link previews see real content without executing JavaScript.
import { db, productFromRow, getContent } from './db.js';
import { CATEGORIES } from './catalog.js';
import config from './config.js';

const BRAND = 'EPIC WEAR';
const TAGLINE = 'Built for those who stand out.';
const KEYWORDS = 'EPIC WEAR, EPIC Wear Kenya, Kenyan streetwear, Premium streetwear Kenya, Fashion Kenya, EPIC clothing, EPIC hoodies, EPIC T-shirts, EPIC WEAR online store';
const DEFAULT_DESC = 'EPIC WEAR — premium Kenyan streetwear. Heavyweight hoodies, T-shirts, cargos and jackets designed in Nairobi for people who refuse to blend in. Shop online and pay with M-PESA.';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const abs = (p) => (/^https?:/.test(p) ? p : `${config.siteUrl}${p}`);
const imageUrl = (img) => (!img ? abs('/assets/img/og.jpg') : /\.\w{3,4}$/.test(img) ? abs(img) : abs(`${img}-960.webp`));
const clip = (s, n = 158) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s; };
// JSON-LD is embedded inside <script>; neutralise "</" so content can never break out
const ld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

function organization() {
  const s = getContent('settings');
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BRAND,
    alternateName: 'EPIC Wear Kenya',
    url: config.siteUrl,
    logo: abs('/assets/apple-touch-icon.png'),
    slogan: TAGLINE,
    founder: { '@type': 'Person', name: 'Vincent Omondi', jobTitle: 'Founder & CEO' },
    address: { '@type': 'PostalAddress', addressLocality: 'Nairobi', addressCountry: 'KE' },
    contactPoint: [{ '@type': 'ContactPoint', telephone: s.phone || '+254 742 850 266', contactType: 'customer service', areaServed: 'KE', availableLanguage: ['English', 'Swahili'] }],
    sameAs: Object.values(s.socials || {}).filter((u) => /^https?:\/\/.+\/.+/.test(u)),
  };
}

function website() {
  return {
    '@context': 'https://schema.org', '@type': 'WebSite', name: BRAND, url: config.siteUrl,
    potentialAction: { '@type': 'SearchAction', target: `${config.siteUrl}/shop?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
  };
}

function productLd(p) {
  const url = `${config.siteUrl}/product/${p.slug}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: clip(p.description, 500),
    image: p.images.slice(0, 4).map(imageUrl),
    sku: p.slug.toUpperCase(),
    brand: { '@type': 'Brand', name: BRAND },
    category: CATEGORIES.find((c) => c.slug === p.category)?.label,
    color: p.colors.map((c) => c.name).join(', ') || undefined,
    url,
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'KES',
      price: p.price,
      availability: p.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: BRAND },
    },
  };
}

function breadcrumbs(items) {
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(path) })),
  };
}

/** Resolve SEO data for a URL path. Returns { status, title, description, image, canonical, jsonld[], noindex } */
export function seoFor(pathname, query = {}) {
  const p = pathname.replace(/\/+$/, '') || '/';
  const base = { status: 200, title: `${BRAND} — ${TAGLINE} | Premium Kenyan Streetwear`, description: DEFAULT_DESC, image: null, canonical: p, jsonld: [], noindex: false, type: 'website' };
  const title = (t) => `${t} | ${BRAND}`;
  let m;

  if (p === '/') return { ...base, jsonld: [organization(), website()] };

  if (p === '/shop') {
    const cat = CATEGORIES.find((c) => c.slug === query.category);
    if (cat) return { ...base, title: title(`EPIC ${cat.label} — Shop ${cat.label} Online in Kenya`), description: `Shop EPIC WEAR ${cat.label.toLowerCase()} — premium Kenyan streetwear, delivered countrywide. Pay with M-PESA.`, canonical: `/shop?category=${cat.slug}`, jsonld: [breadcrumbs([['Home', '/'], ['Shop', '/shop'], [cat.label, `/shop?category=${cat.slug}`]])] };
    return { ...base, title: title('Shop All — EPIC WEAR Online Store'), description: 'Shop the full EPIC WEAR collection: hoodies, T-shirts, sweatshirts, jackets, cargo pants, joggers, tracksuits and accessories. Premium streetwear from Kenya.', canonical: '/shop', noindex: !!query.q };
  }

  if ((m = p.match(/^\/product\/([\w-]+)$/))) {
    const prod = productFromRow(db.prepare(`SELECT * FROM products WHERE slug = ? AND status = 'active'`).get(m[1]));
    if (!prod) return { ...base, status: 404, title: title('Product not found'), noindex: true };
    const cat = CATEGORIES.find((c) => c.slug === prod.category);
    return {
      ...base, type: 'product',
      title: title(`${prod.name} — KES ${prod.price.toLocaleString('en-KE')}`),
      description: clip(`${prod.name}. ${prod.description}`),
      image: prod.images[0], price: prod.price,
      jsonld: [productLd(prod), breadcrumbs([['Home', '/'], ['Shop', '/shop'], [cat?.label || 'Shop', `/shop?category=${prod.category}`], [prod.name, `/product/${prod.slug}`]])],
    };
  }

  if (p === '/new-drop' || (m = p.match(/^\/collections\/([\w-]+)$/))) {
    const slug = p === '/new-drop' ? 'new-drop' : m[1];
    const c = db.prepare(`SELECT * FROM collections WHERE slug = ? AND status = 'active'`).get(slug);
    if (!c) return { ...base, status: 404, title: title('Collection not found'), noindex: true };
    return { ...base, title: title(`${c.name} — ${c.headline.replace(/\.$/, '')}`), description: clip(c.description), image: c.banner, canonical: slug === 'new-drop' ? '/new-drop' : p, jsonld: [breadcrumbs([['Home', '/'], ['Collections', '/collections'], [c.name, p]])] };
  }

  const statics = {
    '/collections': ['Collections — Campaigns & Drops', 'Explore EPIC WEAR campaigns: New Drop, EPIC Essentials, Street Collection, Limited Edition and EPIC × Sharon Thrift Wear.'],
    '/collab': ['EPIC WEAR × Sharon Thrift Wear — Two Brands. One EPIC Movement.', 'The official EPIC WEAR × SHARON THRIFT WEAR collaboration: reworked vintage and new EPIC streetwear in one limited collection.'],
    '/about': ['About — This Is EPIC', 'The story behind EPIC WEAR, a premium streetwear brand from Nairobi, Kenya, founded by Vincent Omondi.'],
    '/contact': ['Contact — Get In Touch', 'Contact EPIC WEAR: call or WhatsApp +254 742 850 266, email us, or send a message for support and business inquiries.'],
    '/track': ['Track My Order', 'Track your EPIC WEAR order with your order number and the phone or email used at checkout.'],
    '/help': ['Help', 'EPIC WEAR help centre: shipping, returns, exchanges and FAQ.'],
    '/help/shipping': ['Shipping & Delivery', 'EPIC WEAR delivery: Nairobi 1–2 days, countrywide 2–4 days, international shipping available. Free delivery in Kenya over KES 10,000.'],
    '/help/returns': ['Returns & Exchanges', 'EPIC WEAR returns and exchange policy.'],
    '/help/faq': ['FAQ', 'Answers to common questions about EPIC WEAR orders, sizing, M-PESA payments and delivery.'],
  };
  if (statics[p]) {
    const [t, d] = statics[p];
    const extra = p === '/about' ? [organization()] : [];
    const img = p === '/collab' ? getContent('collab').banner : null;
    return { ...base, title: title(t), description: d, image: img, jsonld: extra };
  }

  const privatePages = { '/wishlist': 'My Wishlist', '/checkout': 'Checkout', '/account': 'My Account' };
  if (privatePages[p] || p.startsWith('/account/') || p.startsWith('/order/')) {
    return { ...base, title: title(privatePages[p] || (p.startsWith('/order/') ? 'Order' : 'My Account')), noindex: true };
  }

  return { ...base, status: 404, title: title('Page not found'), noindex: true };
}

export function renderSeo(s) {
  const url = abs(s.canonical);
  const img = imageUrl(s.image);
  const tags = [
    `<title>${esc(s.title)}</title>`,
    `<meta name="description" content="${esc(s.description)}">`,
    `<meta name="keywords" content="${esc(KEYWORDS)}">`,
    s.noindex ? '<meta name="robots" content="noindex, follow">' : '<meta name="robots" content="index, follow, max-image-preview:large">',
    `<link rel="canonical" href="${esc(url)}">`,
    `<meta property="og:site_name" content="${BRAND}">`,
    `<meta property="og:type" content="${s.type}">`,
    `<meta property="og:title" content="${esc(s.title)}">`,
    `<meta property="og:description" content="${esc(s.description)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:image" content="${esc(img)}">`,
    '<meta property="og:locale" content="en_KE">',
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${esc(s.title)}">`,
    `<meta name="twitter:description" content="${esc(s.description)}">`,
    `<meta name="twitter:image" content="${esc(img)}">`,
  ];
  if (s.price) tags.push(`<meta property="product:price:amount" content="${s.price}">`, '<meta property="product:price:currency" content="KES">');
  return [...tags, ...s.jsonld.map(ld)].join('\n  ');
}

export function sitemapXml() {
  const urls = ['/', '/shop', '/new-drop', '/collections', '/collab', '/about', '/contact', '/track', '/help/shipping', '/help/returns', '/help/faq']
    .map((u) => ({ loc: u, pri: u === '/' ? '1.0' : '0.7' }));
  for (const c of CATEGORIES) urls.push({ loc: `/shop?category=${c.slug}`, pri: '0.6' });
  for (const c of db.prepare(`SELECT slug FROM collections WHERE status = 'active'`).all()) if (c.slug !== 'new-drop') urls.push({ loc: `/collections/${c.slug}`, pri: '0.7' });
  for (const p of db.prepare(`SELECT slug, updated_at FROM products WHERE status = 'active'`).all()) urls.push({ loc: `/product/${p.slug}`, pri: '0.8', mod: p.updated_at.slice(0, 10) });
  const x = (s) => s.replace(/&/g, '&amp;');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${x(abs(u.loc))}</loc>${u.mod ? `<lastmod>${u.mod}</lastmod>` : ''}<priority>${u.pri}</priority></url>`).join('\n')}\n</urlset>\n`;
}

export function robotsTxt() {
  return `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /account\nDisallow: /checkout\nDisallow: /order/\nDisallow: /wishlist\n\nSitemap: ${config.siteUrl}/sitemap.xml\n`;
}
