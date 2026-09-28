import { Router } from 'express';
import { db, productFromRow, getContent, orderFromRow } from '../db.js';
import { CATEGORIES, KENYA_COUNTIES } from '../catalog.js';
import { listProviders } from '../payments/index.js';
import { priceCart, getOrderRow } from '../orders.js';
import { rateLimit } from '../security.js';
import * as v from '../validate.js';
import config from '../config.js';

const r = Router();

const activeProducts = () => db.prepare(`SELECT * FROM products WHERE status = 'active' ORDER BY sort, id`).all().map(productFromRow);
const publicProduct = (p) => {
  // never leak exact inventory levels to the storefront — only availability per size
  const { stock, totalStock, status, sort, ...rest } = p;
  const availability = Object.fromEntries(Object.entries(stock).map(([k, n]) => [k, n <= 0 ? 'out' : n <= 3 ? 'low' : 'in']));
  return { ...rest, availability };
};

r.get('/config', (_req, res) => {
  const settings = getContent('settings');
  res.json({
    currency: config.store.currency,
    freeDeliveryThreshold: config.store.freeDeliveryThreshold,
    delivery: config.store.delivery,
    categories: CATEGORIES,
    counties: KENYA_COUNTIES,
    payments: listProviders(),
    settings,
  });
});

r.get('/products', (_req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.json({ products: activeProducts().map(publicProduct) });
});

r.get('/products/:slug', (req, res) => {
  const p = productFromRow(db.prepare(`SELECT * FROM products WHERE slug = ? AND status = 'active'`).get(req.params.slug));
  if (!p) return res.status(404).json({ error: 'Product not found.' });
  const all = activeProducts().filter((x) => x.id !== p.id);
  const score = (x) => (x.category === p.category ? 3 : 0) + x.collections.filter((c) => p.collections.includes(c)).length * 2 + (x.gender === p.gender ? 1 : 0);
  const related = all.sort((a, b) => score(b) - score(a)).slice(0, 8).map(publicProduct);
  res.json({ product: publicProduct(p), related });
});

r.get('/collections', (_req, res) => {
  const cols = db.prepare(`SELECT * FROM collections WHERE status = 'active' ORDER BY sort, id`).all();
  res.json({ collections: cols.map(({ status, ...c }) => ({ ...c, isCampaign: !!c.is_campaign })) });
});

r.get('/collections/:slug', (req, res) => {
  const c = db.prepare(`SELECT * FROM collections WHERE slug = ? AND status = 'active'`).get(req.params.slug);
  if (!c) return res.status(404).json({ error: 'Collection not found.' });
  const products = activeProducts().filter((p) => p.collections.includes(c.slug)).map(publicProduct);
  res.json({ collection: c, products });
});

const CONTENT_KEYS = ['home', 'about', 'collab', 'settings'];
r.get('/content/:key', (req, res) => {
  if (!CONTENT_KEYS.includes(req.params.key)) return res.status(404).json({ error: 'Not found.' });
  res.json({ content: getContent(req.params.key) });
});

r.post('/cart/quote', rateLimit('quote', 120, 60e3), (req, res) => {
  const { items, country, county, discountCode } = req.body || {};
  res.json(priceCart(items, { country, county, discountCode: discountCode ? String(discountCode).slice(0, 40) : '' }));
});

r.post('/contact', rateLimit('contact', 6, 10 * 60e3), (req, res) => {
  const b = req.body || {};
  const name = v.str(b.name, 'name', { max: 120, label: 'Name' });
  const email = v.email(b.email);
  const phone = v.phone(b.phone, 'phone', { required: false });
  const topic = v.oneOf(b.topic || 'Customer support', 'topic', ['Customer support', 'Business inquiry', 'Order question', 'Press', 'Collaboration', 'Other']);
  const message = v.str(b.message, 'message', { min: 10, max: 4000, label: 'Message' });
  db.prepare('INSERT INTO messages (name, email, phone, topic, message) VALUES (?, ?, ?, ?, ?)').run(name, email, phone, topic, message);
  res.json({ ok: true });
});

r.post('/subscribe', rateLimit('subscribe', 10, 10 * 60e3), (req, res) => {
  const email = v.email((req.body || {}).email);
  db.prepare('INSERT OR IGNORE INTO subscribers (email) VALUES (?)').run(email);
  res.json({ ok: true });
});

// Order tracking — requires order number AND the phone or email used at checkout.
r.post('/track', rateLimit('track', 20, 10 * 60e3), (req, res) => {
  const b = req.body || {};
  const number = v.str(b.number, 'number', { max: 20, label: 'Order number' }).toUpperCase().replace(/\s+/g, '');
  const contact = v.str(b.contact, 'contact', { max: 254, label: 'Phone or email' }).toLowerCase();
  const row = getOrderRow(number.startsWith('EPIC-') ? number : `EPIC-${number.replace(/^EPIC/, '')}`);
  const notFound = () => res.status(404).json({ error: 'We could not find an order with those details. Check the order number and the phone or email used at checkout.' });
  if (!row) return notFound();
  const o = orderFromRow(row);
  const phoneMatch = v.kenyanPhone(contact) && v.kenyanPhone(o.customer.phone) === v.kenyanPhone(contact);
  const rawPhoneMatch = contact.replace(/[^\d]/g, '').length >= 8 && contact.replace(/[^\d]/g, '') === String(o.customer.phone || '').replace(/[^\d]/g, '');
  const emailMatch = o.customer.email && o.customer.email.toLowerCase() === contact;
  if (!phoneMatch && !rawPhoneMatch && !emailMatch) return notFound();
  res.json({
    order: {
      number: o.number, status: o.status, paymentStatus: o.paymentStatus, history: o.history, createdAt: o.createdAt,
      items: o.items.map(({ name, size, color, qty, image, slug }) => ({ name, size, color, qty, image, slug })),
      total: o.total, city: o.customer.city, county: o.customer.county, country: o.customer.country,
    },
  });
});

export default r;
