// First-run seed: catalogue, campaigns and editable page content.
// Only runs when the products table is empty, so admin edits are never overwritten.
import { db, tx, getContent, setContent } from './db.js';

const img = (slug, n = 3) => Array.from({ length: n }, (_, i) => `/assets/img/products/${slug}/${i + 1}`);
const APP = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const WAIST = ['28', '30', '32', '34', '36', '38'];
const ONE = ['One Size'];

// deterministic pseudo-random stock so demo data is stable
function stockFor(sizes, seed, soldOut = []) {
  let s = seed;
  const out = {};
  for (const size of sizes) {
    s = (s * 9301 + 49297) % 233280;
    out[size] = soldOut.includes(size) ? 0 : 2 + Math.floor((s / 233280) * 22);
  }
  return out;
}

const BLACK = { name: 'Black', hex: '#0b0b0c' };
const BONE = { name: 'Bone', hex: '#e9e2d6' };
const CHARCOAL = { name: 'Charcoal', hex: '#3a3a3e' };
const HEATHER = { name: 'Heather Grey', hex: '#a9a9ab' };
const SAND = { name: 'Sand', hex: '#cdb992' };
const WASHED = { name: 'Washed Black', hex: '#2a2a2d' };
const INDIGO = { name: 'Vintage Indigo', hex: '#6f86a6' };

// [slug, name, category, gender, price, compareAt, colors, sizes, collections, featured, photos, description, details, tags, soldOut]
const PRODUCTS = [
  ['oversized-essential-tee', 'EPIC Oversized Essential Tee', 't-shirts', 'unisex', 2500, null, [BLACK], APP, ['epic-essentials'], 1, 3,
    'The foundation of every EPIC fit. A boxy, dropped-shoulder tee cut from 240gsm combed cotton with a dense, dry hand-feel and a small EPIC wordmark on the chest.',
    ['240gsm heavyweight combed cotton', 'Boxy oversized fit, dropped shoulders', 'Ribbed crew neck that holds its shape', 'Screen-printed EPIC chest logo', 'Machine wash cold, inside out'],
    'tee t-shirt black oversized essential basic top cotton', []],
  ['signature-logo-tee', 'EPIC Signature Logo Tee', 't-shirts', 'unisex', 2800, null, [BONE], APP, ['epic-essentials', 'new-drop'], 0, 3,
    'The statement tee. Bone-coloured heavyweight cotton carrying the full EPIC wordmark across the chest — the cut line and ember dot printed exactly as the logo is drawn.',
    ['240gsm heavyweight cotton', 'Relaxed oversized fit', 'Large front EPIC wordmark print', 'Pre-shrunk to minimise shrinkage'],
    'tee t-shirt white bone cream logo graphic print oversized top', ['XS']],
  ['signature-hoodie', 'EPIC Signature Hoodie', 'hoodies', 'unisex', 5500, null, [BLACK], APP, ['epic-essentials', 'street-collection'], 1, 3,
    'Our flagship hoodie. 450gsm brushed-back fleece, a double-layered hood and the EPIC wordmark printed large across the chest. Built to be worn hard.',
    ['450gsm cotton-rich brushed fleece', 'Double-layer hood with flat drawcords', 'Kangaroo pocket, ribbed cuffs and hem', 'Oversized fit — size down for a closer fit'],
    'hoodie hoody black pullover sweatshirt fleece logo oversized warm', []],
  ['heavyweight-zip-hoodie', 'EPIC Heavyweight Zip Hoodie', 'hoodies', 'women', 6200, null, [CHARCOAL], APP, ['new-drop'], 0, 3,
    'A full-zip take on the signature fleece in washed charcoal, with a small embroidered EPIC mark on the chest and a metal two-way zip.',
    ['450gsm brushed fleece', 'Two-way metal zip', 'Embroidered EPIC chest logo', 'Side-seam pockets'],
    'zip hoodie zipper jacket grey charcoal fleece women', []],
  ['premium-sweatshirt', 'EPIC Premium Sweatshirt', 'sweatshirts', 'men', 4800, null, [HEATHER], APP, ['epic-essentials'], 1, 3,
    'A clean heather-grey crewneck with a raised EPIC wordmark on the chest. Loopback cotton that softens with every wash.',
    ['400gsm loopback cotton', 'Ribbed collar, cuffs and hem', 'Raised EPIC chest wordmark', 'Regular relaxed fit'],
    'sweatshirt crewneck crew grey heather jumper sweater pullover', []],
  ['varsity-jacket', 'EPIC Varsity Jacket', 'jackets', 'men', 9500, 11000, [BLACK, BONE], APP, ['limited-edition', 'new-drop'], 1, 3,
    'A limited-run varsity: black melton wool body, bone faux-leather sleeves, ember-striped rib trims and a chenille EPIC patch on the chest.',
    ['Wool-blend melton body', 'Faux-leather sleeves', 'Striped rib collar, cuffs and hem in ember', 'Chenille EPIC chest patch', 'Quilted lining, snap front'],
    'varsity jacket letterman bomber coat black white leather limited', ['XS', 'XXL']],
  ['nylon-bomber', 'EPIC Nylon Bomber', 'jackets', 'women', 8200, null, [BLACK], APP, ['new-drop', 'street-collection'], 0, 3,
    'A matte nylon bomber with a light fill, ribbed trims and a reflective EPIC print on the chest — made for Nairobi evenings.',
    ['Matte water-resistant nylon shell', 'Light padded fill', 'Reflective chest logo', 'Utility sleeve pocket'],
    'bomber jacket nylon black coat outerwear women', []],
  ['urban-cargo-pants', 'EPIC Urban Cargo Pants', 'cargo-pants', 'men', 5200, null, [BLACK], WAIST, ['street-collection'], 1, 3,
    'Relaxed-fit ripstop cargos with deep bellow pockets, toggle ankles and a woven EPIC label on the pocket. The street uniform.',
    ['Cotton ripstop', 'Six-pocket construction', 'Adjustable toggle hems', 'Woven EPIC pocket label'],
    'cargo pants trousers black ripstop utility pockets', []],
  ['tactical-cargo-pants', 'EPIC Tactical Cargo Pants', 'cargo-pants', 'women', 5400, null, [SAND], WAIST, ['new-drop', 'street-collection'], 0, 3,
    'Wide, slouchy cargos in sand twill with stacked utility pockets and a black woven EPIC label.',
    ['Heavy cotton twill', 'Wide relaxed leg', 'Stacked utility pockets', 'Woven EPIC label'],
    'cargo pants trousers beige khaki sand tan wide women utility', []],
  ['washed-straight-denim', 'EPIC Washed Straight Denim', 'jeans', 'men', 5800, null, [WASHED], WAIST, ['street-collection'], 0, 1,
    'Straight-leg jeans in washed-black 13oz denim with a subtle fade and a tiny embroidered EPIC mark on the coin pocket.',
    ['13oz cotton denim', 'Straight leg, mid rise', 'Washed-black finish', 'Embroidered coin-pocket logo'],
    'jeans denim black washed straight trousers', []],
  ['streetwear-joggers', 'EPIC Streetwear Joggers', 'joggers', 'unisex', 4200, null, [CHARCOAL], APP, ['epic-essentials'], 1, 1,
    'Tapered fleece joggers in charcoal with ribbed cuffs, a drawcord waist and a small EPIC print on the thigh.',
    ['400gsm brushed fleece', 'Elastic drawcord waist', 'Ribbed ankle cuffs', 'Zip back pocket'],
    'joggers sweatpants trackpants grey charcoal fleece pants', []],
  ['mesh-court-shorts', 'EPIC Mesh Court Shorts', 'shorts', 'men', 2900, null, [BLACK], APP, ['street-collection'], 0, 1,
    'Breathable double-knit mesh shorts with an above-the-knee cut and the EPIC wordmark on the leg.',
    ['Double-knit mesh', 'Elastic waist with drawcord', 'Side pockets', 'Printed leg logo'],
    'shorts mesh basketball black sport summer', []],
  ['fleece-lounge-shorts', 'EPIC Fleece Lounge Shorts', 'shorts', 'women', 3200, null, [BONE], APP, ['epic-essentials'], 0, 1,
    'Soft bone fleece shorts with a relaxed fit and a small black EPIC print — the off-duty essential.',
    ['Brushed cotton fleece', 'Relaxed fit', 'Drawcord waist', 'Printed EPIC logo'],
    'shorts fleece white bone cream lounge women', []],
  ['signature-tracksuit', 'EPIC Signature Tracksuit', 'tracksuits', 'unisex', 9800, null, [BLACK], APP, ['limited-edition', 'new-drop'], 1, 1,
    'The full set: zip track jacket and matching pants in black tricot with bone piping and an embroidered EPIC chest logo.',
    ['Smooth tricot knit', 'Full-zip jacket with stand collar', 'Bone contrast piping', 'Tapered pants with zip ankles', 'Sold as a set'],
    'tracksuit track suit set jacket pants black matching', []],
  ['oversized-tee-dress', 'EPIC Oversized Tee Dress', 'dresses', 'women', 3900, null, [BLACK], ['XS', 'S', 'M', 'L', 'XL'], ['new-drop'], 0, 1,
    'Our heavyweight tee, lengthened into an easy above-the-knee dress with the EPIC wordmark on the chest.',
    ['240gsm heavyweight cotton', 'Oversized T-shirt dress silhouette', 'Front EPIC print'],
    'dress tee dress t-shirt dress black women', []],
  ['ribbed-midi-dress', 'EPIC Ribbed Midi Dress', 'dresses', 'women', 4500, null, [CHARCOAL], ['XS', 'S', 'M', 'L', 'XL'], ['new-drop'], 0, 1,
    'A fitted long-sleeve midi in charcoal rib knit — sleek, minimal and finished with a tiny embroidered EPIC mark.',
    ['Stretch rib knit', 'Long sleeves, crew neck', 'Midi length', 'Embroidered hip logo'],
    'dress midi ribbed knit grey charcoal women fitted', []],
  ['classic-cap', 'EPIC Classic Cap', 'accessories', 'unisex', 1800, null, [BLACK], ONE, ['epic-essentials', 'street-collection'], 1, 1,
    'A six-panel cotton twill cap with a pre-curved brim and a raised embroidered EPIC wordmark.',
    ['Cotton twill, six panels', 'Pre-curved brim', '3D embroidered logo', 'Adjustable strap'],
    'cap hat baseball cap black accessories headwear', []],
  ['ribbed-beanie', 'EPIC Ribbed Beanie', 'accessories', 'unisex', 1500, null, [BLACK], ONE, ['epic-essentials'], 0, 1,
    'A chunky rib-knit beanie with a turn-up cuff and a woven EPIC label.',
    ['Soft acrylic-wool blend', 'Deep turn-up cuff', 'Woven EPIC label'],
    'beanie hat knit winter black accessories headwear', []],
  ['utility-crossbody-bag', 'EPIC Utility Crossbody Bag', 'accessories', 'unisex', 2500, null, [BLACK], ONE, ['new-drop'], 0, 1,
    'A compact nylon crossbody with a zip main compartment, quick-access front pocket and adjustable strap.',
    ['Water-resistant nylon', 'Two zip compartments', 'Adjustable webbing strap', 'Rubberised EPIC badge'],
    'bag crossbody sling pouch black accessories', []],
  ['xsharon-reworked-denim-jacket', 'EPIC × Sharon Reworked Denim Jacket', 'jackets', 'women', 7500, null, [INDIGO], ['S', 'M', 'L'], ['epic-x-sharon', 'limited-edition'], 0, 1,
    'One-of-a-kind energy: vintage denim jackets sourced by Sharon Thrift Wear, reworked with EPIC patchwork and branding. Every piece is slightly different.',
    ['Pre-loved denim, individually reworked', 'EPIC × Sharon patch detailing', 'Each piece unique — small variations expected', 'Limited quantity'],
    'denim jacket vintage thrift reworked blue collab sharon', []],
  ['xsharon-vintage-wash-tee', 'EPIC × Sharon Vintage Wash Tee', 't-shirts', 'unisex', 3200, null, [WASHED], APP, ['epic-x-sharon'], 0, 1,
    'A garment-dyed, sun-faded black tee with a cracked EPIC × SHARON print — made to look and feel like a thrift-store find.',
    ['Garment-dyed heavyweight cotton', 'Vintage wash finish', 'Cracked collab print'],
    'tee t-shirt vintage washed faded black collab sharon thrift', []],
  ['xsharon-patchwork-cargo', 'EPIC × Sharon Patchwork Cargo', 'cargo-pants', 'unisex', 6400, null, [SAND], WAIST, ['epic-x-sharon'], 0, 1,
    'Cargo pants built from panels of reclaimed fabric, cut on the EPIC cargo pattern. No two pairs are the same.',
    ['Reclaimed fabric panels', 'EPIC cargo pattern', 'Unique patchwork per pair'],
    'cargo pants patchwork reworked thrift collab sharon', ['38']],
];

const COLLECTIONS = [
  ['new-drop', 'New Drop', 'Drop 02 — Out now', 'The new drop is here.', 'Fresh silhouettes, heavier fabrics and the pieces everyone has been asking for. Once they are gone, they are gone.', '/assets/img/products/varsity-jacket/1', 1],
  ['epic-essentials', 'EPIC Essentials', 'The foundation', 'Everyday, elevated.', 'Heavyweight tees, hoodies and fleece built to be worn every day — the core of every EPIC wardrobe.', '/assets/img/products/oversized-essential-tee/1', 2],
  ['street-collection', 'Street Collection', 'Built for the city', 'Made for the streets.', 'Cargos, denim and outerwear cut for movement — designed on and for the streets of Nairobi.', '/assets/img/products/nylon-bomber/1', 3],
  ['limited-edition', 'Limited Edition', 'Numbered runs', 'Rare by design.', 'Small-batch pieces made in limited numbers. No restocks.', '/assets/img/products/varsity-jacket/3', 4],
  ['epic-x-sharon', 'EPIC × Sharon', 'Collaboration', 'Two brands. One EPIC movement.', 'EPIC WEAR meets Sharon Thrift Wear — reworked vintage and new EPIC design in one collection.', '/assets/img/products/signature-logo-tee/1', 5],
];

export const DEFAULT_CONTENT = {
  settings: {
    phone: '+254 742 850 266',
    whatsapp: '254742850266',
    email: 'hello@epicwear.co.ke',
    supportEmail: 'support@epicwear.co.ke',
    businessEmail: 'business@epicwear.co.ke',
    location: 'Nairobi, Kenya',
    hours: 'Mon – Sat · 9:00 – 18:00 EAT',
    announcement: 'Free delivery across Kenya on orders over KES 10,000 · Pay securely with M-PESA',
    socials: {
      instagram: 'https://instagram.com/',
      tiktok: 'https://tiktok.com/',
      facebook: 'https://facebook.com/',
      x: 'https://x.com/',
    },
  },
  home: {
    kicker: 'Drop 02 — Out now',
    headline: 'Built for those who stand out.',
    subtext: 'Discover the latest EPIC collection — designed for people who refuse to blend in.',
    primaryCta: 'Shop Collection',
    secondaryCta: 'Explore EPIC',
    imageLeft: '/assets/img/products/varsity-jacket/1',
    imageRight: '/assets/img/products/heavyweight-zip-hoodie/1',
    manifesto: 'EPIC WEAR is not made for the background. Heavyweight fabrics, sharp silhouettes and obsessive detail — designed in Kenya for the ones who refuse to blend in. Built for those who stand out.',
  },
  about: {
    headline: 'This is EPIC.',
    intro: 'EPIC WEAR is a streetwear label from Nairobi, Kenya. We make heavyweight, carefully finished clothing for people who dress with intention — and we want it to hold its own anywhere in the world.',
    sections: [
      { title: 'Our vision', body: 'To build a Kenyan fashion brand with a global standard: garments that feel substantial, fit with purpose and carry a design language people recognise at a glance.' },
      { title: 'Our identity', body: 'Bold, minimal and confident. The EPIC wordmark — cut through by a single line and closed by an ember dot — is the signature on everything we make. We keep the palette tight and let fabric, fit and detail do the talking.' },
      { title: 'Our commitment', body: 'Fewer, better pieces. We choose heavier fabrics, test our fits, and release in small drops so every piece gets the attention it deserves. When something is not right, we will make it right.' },
    ],
    values: [
      { title: 'Quality first', body: 'Heavyweight cottons, dense fleece, reinforced seams.' },
      { title: 'Designed in Kenya', body: 'Rooted in Nairobi street culture, made for the world.' },
      { title: 'Small drops', body: 'Limited runs over mass production.' },
      { title: 'Community', body: 'Built with the people who wear it.' },
    ],
    founder: {
      name: 'Vincent Omondi',
      role: 'Founder & CEO, EPIC WEAR',
      secondaryRole: 'Founder of VinceVision Kenya',
      portrait: '',
      quote: 'I wanted to build something that feels like Nairobi — confident, creative and impossible to ignore.',
      bio: [
        'Vincent Omondi is the founder and CEO of EPIC WEAR. He started the brand with a clear idea: create streetwear in Kenya that is designed, finished and presented to an international standard.',
        'He is also the founder of VinceVision Kenya. At EPIC WEAR he leads the brand’s creative direction, product development and community — from the first sketch of a drop to the moment it reaches a customer’s door.',
      ],
    },
  },
  collab: {
    headline: 'Two brands. One EPIC movement.',
    partner: 'Sharon Thrift Wear',
    intro: 'EPIC WEAR × SHARON THRIFT WEAR brings together new EPIC design and carefully sourced pre-loved fashion — a collection where every piece carries two stories.',
    story: [
      'Sharon Thrift Wear is known for finding pieces with character. EPIC WEAR is known for bold, heavyweight streetwear. Together we have reworked vintage finds with EPIC detailing and cut new pieces inspired by the thrift aesthetic.',
      'The result is a limited collection that celebrates individuality — some pieces are one of a kind, all of them are made to stand out.',
    ],
    banner: '/assets/img/products/signature-logo-tee/1',
  },
};

// ---- drops -------------------------------------------------------------------------------------
// Catalogue additions applied exactly once per database (recorded under content key
// `_seed_drops`), so live stores receive new collections on restart while admin edits
// and deletions made afterwards are never overwritten.
const DRESS = ['XS', 'S', 'M', 'L', 'XL'];
const DROPS = [
  {
    id: '2026-09-epic-evening',
    collections: [
      ['epic-evening', 'EPIC Evening', 'Drop 03 — After dark', 'Made for the night.', 'Sculpted silhouettes in taffeta, satin and stretch crepe. Four dresses built for evenings you plan to remember — bold, minimal and unmistakably EPIC.', '/assets/img/collections/epic-evening/1', 6],
    ],
    // same tuple shape as PRODUCTS
    products: [
      ['strapless-puffball-mini', 'EPIC Strapless Puffball Mini', 'dresses', 'women', 6800, null, [BLACK], DRESS, ['epic-evening', 'new-drop'], 0, 2,
        'A boned strapless bodice with a dropped V-waist that bursts into a full puffball skirt in crisp black taffeta. Sculpted, playful and impossible to ignore.',
        ['Crisp taffeta with a soft sheen', 'Boned corset bodice with silicone grip at the neckline', 'Dropped V-waist, gathered puffball skirt', 'Concealed back zip', 'Fully lined', 'Mini length'],
        'dress strapless puffball bubble corset mini black evening party taffeta night out women', []],
      ['corset-midi-dress', 'EPIC Corset Midi Dress', 'dresses', 'women', 7800, null, [BLACK], DRESS, ['epic-evening'], 0, 2,
        'A strapless corset bodice with sharp vertical seaming, flowing into a liquid satin midi skirt with a thigh-high side slit.',
        ['Heavy duchess-style satin', 'Structured corset bodice with boning', 'Bias-cut midi skirt with side slit', 'Concealed back zip', 'Fully lined'],
        'dress corset midi satin strapless black evening gala slit women', []],
      ['bubble-hem-slip-dress', 'EPIC Bubble-Hem Slip Dress', 'dresses', 'women', 5900, null, [BONE], DRESS, ['epic-evening'], 0, 2,
        'Fine adjustable straps and a softly draped cowl neckline over a gathered bubble hem, in bone satin that catches every light.',
        ['Fluid satin with a pearl sheen', 'Adjustable spaghetti straps', 'Soft cowl neckline', 'Gathered bubble hem, above the knee', 'Lined'],
        'dress slip satin bubble hem cowl short cream ivory bone white evening women', []],
      ['halter-mini-dress', 'EPIC Halter Mini Dress', 'dresses', 'women', 5500, null, [BLACK], DRESS, ['epic-evening'], 0, 2,
        'A halter-neck mini in ruched stretch crepe with an open back — body-skimming, clean and ready for the night.',
        ['Stretch crepe with a matte finish', 'Halter neck with hook fastening', 'Open back', 'Side ruching', 'Mini length'],
        'dress halter mini ruched open back bodycon black evening party women', []],
    ],
  },
];

function applyDrops() {
  const applied = getContent('_seed_drops', []);
  const pending = DROPS.filter((d) => !applied.includes(d.id));
  if (!pending.length) return;
  const insert = db.prepare(`INSERT OR IGNORE INTO products
    (slug, name, category, gender, price, compare_at, description, details, colors, sizes, stock, images, collections, tags, featured, status, sort, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, datetime('now'), datetime('now'))`);
  const insertCol = db.prepare(`INSERT OR IGNORE INTO collections (slug, name, kicker, headline, description, banner, sort) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  tx(() => {
    for (const drop of pending) {
      drop.collections.forEach((c) => insertCol.run(...c));
      drop.products.forEach((p, i) => {
        const [slug, name, category, gender, price, compareAt, colors, sizes, collections, featured, photos, description, details, tags, soldOut] = p;
        insert.run(slug, name, category, gender, price, compareAt, description, JSON.stringify(details), JSON.stringify(colors),
          JSON.stringify(sizes), JSON.stringify(stockFor(sizes, (slug.length + i) * 11 + 5, soldOut)), JSON.stringify(img(slug, photos)),
          JSON.stringify(collections), tags, featured, 30 + i);
      });
      applied.push(drop.id);
      console.log(`  ✓ Applied drop ${drop.id}: ${drop.products.length} products, ${drop.collections.length} collection(s)`);
    }
    setContent('_seed_drops', applied);
  });
}

export function seed() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
  if (count === 0) {
    const insert = db.prepare(`INSERT INTO products
      (slug, name, category, gender, price, compare_at, description, details, colors, sizes, stock, images, collections, tags, featured, status, sort, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, datetime('now', ?), datetime('now'))`);
    const insertCol = db.prepare(`INSERT INTO collections (slug, name, kicker, headline, description, banner, sort) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    tx(() => {
      PRODUCTS.forEach((p, i) => {
        const [slug, name, category, gender, price, compareAt, colors, sizes, collections, featured, photos, description, details, tags, soldOut] = p;
        insert.run(slug, name, category, gender, price, compareAt, description, JSON.stringify(details), JSON.stringify(colors),
          JSON.stringify(sizes), JSON.stringify(stockFor(sizes, i * 7 + 3, soldOut)), JSON.stringify(img(slug, photos)),
          JSON.stringify(collections), tags, featured, i, `-${(PRODUCTS.length - i) * 2} days`);
      });
      COLLECTIONS.forEach((c) => insertCol.run(...c));
      db.prepare(`INSERT OR IGNORE INTO discounts (code, type, value, min_subtotal) VALUES ('WELCOME10', 'percent', 10, 3000)`).run();
    });
    console.log(`  ✓ Seeded ${PRODUCTS.length} products, ${COLLECTIONS.length} collections`);
  }
  applyDrops();
  for (const [key, value] of Object.entries(DEFAULT_CONTENT)) {
    const existing = getContent(key, null);
    if (!existing) setContent(key, value);
  }
}
