// Admin / CMS API. Every route here is behind requireAdmin (server-side
// session + role check) — see server/index.js.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Router } from 'express';
import { db, productFromRow, orderFromRow, getContent, setContent, parseJSON } from '../db.js';
import { CATEGORY_SLUGS, GENDERS, ORDER_STATUSES } from '../catalog.js';
import { getOrderRow, updateOrderStatus } from '../orders.js';
import * as v from '../validate.js';
import config from '../config.js';

const r = Router();
const UPLOAD_DIR = path.join(config.dataDir, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---- dashboard ----------------------------------------------------------------
r.get('/stats', (_req, res) => {
  const one = (sql, ...a) => db.prepare(sql).get(...a);
  const revenue = one(`SELECT COALESCE(SUM(total),0) AS s, COUNT(*) AS n FROM orders WHERE payment_status = 'paid'`);
  const revenue30 = one(`SELECT COALESCE(SUM(total),0) AS s, COUNT(*) AS n FROM orders WHERE payment_status = 'paid' AND created_at > datetime('now','-30 days')`);
  const byStatus = Object.fromEntries(db.prepare(`SELECT status, COUNT(*) AS n FROM orders GROUP BY status`).all().map((x) => [x.status, x.n]));
  const products = db.prepare('SELECT * FROM products').all().map(productFromRow);
  const lowStock = products.flatMap((p) => Object.entries(p.stock).filter(([, n]) => n <= 3).map(([size, n]) => ({ id: p.id, name: p.name, size, stock: n }))).slice(0, 20);
  const recent = db.prepare(`SELECT * FROM orders WHERE status != 'pending_payment' ORDER BY id DESC LIMIT 8`).all().map((x) => orderFromRow(x, { admin: true }));
  res.json({
    revenue: revenue.s, paidOrders: revenue.n, revenue30: revenue30.s, paidOrders30: revenue30.n,
    byStatus,
    products: products.length, activeProducts: products.filter((p) => p.status === 'active').length,
    customers: one(`SELECT COUNT(*) AS n FROM users WHERE role = 'customer'`).n,
    subscribers: one('SELECT COUNT(*) AS n FROM subscribers').n,
    unreadMessages: one('SELECT COUNT(*) AS n FROM messages WHERE handled = 0').n,
    lowStock, recent,
    payments: { mpesaConfigured: config.mpesa.configured, simulate: config.mpesa.simulate, env: config.mpesa.env },
  });
});

// ---- products -------------------------------------------------------------------
function readProduct(b) {
  const sizes = Array.isArray(b.sizes) ? [...new Set(b.sizes.map((s) => v.str(s, 'sizes', { max: 20 })))] : [];
  if (!sizes.length) throw new v.ValidationError('Add at least one size.', 'sizes');
  const stockIn = b.stock && typeof b.stock === 'object' ? b.stock : {};
  const stock = Object.fromEntries(sizes.map((s) => [s, v.int(stockIn[s] ?? 0, `Stock (${s})`, { max: 100000 })]));
  const colors = (Array.isArray(b.colors) ? b.colors : []).slice(0, 12).map((c) => ({
    name: v.str(c?.name, 'colors', { max: 40, label: 'Colour name' }),
    hex: /^#[0-9a-f]{6}$/i.test(c?.hex) ? c.hex : '#0b0b0c',
  }));
  const images = (Array.isArray(b.images) ? b.images : []).slice(0, 12).map((s) => {
    const p = v.str(s, 'images', { max: 300 });
    if (!/^\/(assets\/img|uploads)\/[\w\-./]+$/.test(p) || p.includes('..')) throw new v.ValidationError('Invalid image path.', 'images');
    return p;
  });
  const collectionSlugs = db.prepare('SELECT slug FROM collections').all().map((x) => x.slug);
  return {
    name: v.str(b.name, 'name', { min: 2, max: 140, label: 'Name' }),
    slug: v.slugify(b.slug || b.name),
    category: v.oneOf(b.category, 'category', CATEGORY_SLUGS),
    gender: v.oneOf(b.gender || 'unisex', 'gender', GENDERS),
    price: v.int(b.price, 'Price', { min: 1, max: 10_000_000 }),
    compare_at: v.int(b.compareAt, 'Compare-at price', { min: 0, max: 10_000_000, required: false }) || null,
    description: v.str(b.description, 'description', { max: 4000, required: false }),
    details: JSON.stringify((Array.isArray(b.details) ? b.details : []).slice(0, 20).map((d) => v.str(d, 'details', { max: 200 })).filter(Boolean)),
    colors: JSON.stringify(colors),
    sizes: JSON.stringify(sizes),
    stock: JSON.stringify(stock),
    images: JSON.stringify(images),
    collections: JSON.stringify((Array.isArray(b.collections) ? b.collections : []).filter((c) => collectionSlugs.includes(c))),
    tags: v.str(b.tags, 'tags', { max: 500, required: false }),
    featured: b.featured ? 1 : 0,
    status: v.oneOf(b.status || 'active', 'status', ['active', 'draft']),
    sort: v.int(b.sort ?? 0, 'Sort', { min: -100000, max: 100000 }),
  };
}

r.get('/products', (_req, res) => {
  res.json({ products: db.prepare('SELECT * FROM products ORDER BY sort, id').all().map(productFromRow) });
});
r.get('/products/:id', (req, res) => {
  const p = productFromRow(db.prepare('SELECT * FROM products WHERE id = ?').get(Number(req.params.id)));
  if (!p) return res.status(404).json({ error: 'Not found.' });
  res.json({ product: p });
});
r.post('/products', (req, res) => {
  const p = readProduct(req.body || {});
  if (db.prepare('SELECT 1 FROM products WHERE slug = ?').get(p.slug)) return res.status(409).json({ error: 'A product with this URL slug already exists.', field: 'slug' });
  const cols = Object.keys(p);
  const info = db.prepare(`INSERT INTO products (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...Object.values(p));
  res.json({ product: productFromRow(db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid)) });
});
r.put('/products/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare('SELECT 1 FROM products WHERE id = ?').get(id)) return res.status(404).json({ error: 'Not found.' });
  const p = readProduct(req.body || {});
  if (db.prepare('SELECT 1 FROM products WHERE slug = ? AND id != ?').get(p.slug, id)) return res.status(409).json({ error: 'Another product already uses this URL slug.', field: 'slug' });
  db.prepare(`UPDATE products SET ${Object.keys(p).map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...Object.values(p), id);
  res.json({ product: productFromRow(db.prepare('SELECT * FROM products WHERE id = ?').get(id)) });
});
r.delete('/products/:id', (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// ---- uploads (base64 JSON so no multipart parser is needed) ----------------------
const SIGNATURES = [
  { ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: 'webp', test: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' },
  { ext: 'avif', test: (b) => b.subarray(4, 8).toString() === 'ftyp' && /avi[fs]/.test(b.subarray(8, 12).toString()) },
];
r.post('/uploads', (req, res) => {
  const data = String(req.body?.data || '');
  const m = data.match(/^data:image\/(?:jpeg|png|webp|avif);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return res.status(400).json({ error: 'Upload a JPG, PNG, WebP or AVIF image.' });
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length > 8 * 1024 * 1024) return res.status(413).json({ error: 'Image must be under 8 MB.' });
  const sig = SIGNATURES.find((s) => s.test(buf));
  if (!sig) return res.status(400).json({ error: 'That file does not look like a valid image.' });
  const name = `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}.${sig.ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  res.json({ url: `/uploads/${name}` });
});

// ---- collections ------------------------------------------------------------------
function readCollection(b) {
  const banner = v.str(b.banner, 'banner', { max: 300, required: false });
  if (banner && (!/^\/(assets\/img|uploads)\/[\w\-./]+$/.test(banner) || banner.includes('..'))) throw new v.ValidationError('Invalid banner path.', 'banner');
  return {
    name: v.str(b.name, 'name', { min: 2, max: 80, label: 'Name' }),
    slug: v.slugify(b.slug || b.name),
    kicker: v.str(b.kicker, 'kicker', { max: 80, required: false }),
    headline: v.str(b.headline, 'headline', { max: 140, required: false }),
    description: v.str(b.description, 'description', { max: 1000, required: false }),
    banner,
    is_campaign: b.isCampaign === false ? 0 : 1,
    sort: v.int(b.sort ?? 0, 'Sort', { min: -1000, max: 1000 }),
    status: v.oneOf(b.status || 'active', 'status', ['active', 'draft']),
  };
}
const allCollections = () => db.prepare('SELECT * FROM collections ORDER BY sort, id').all().map((c) => ({ ...c, isCampaign: !!c.is_campaign }));
r.get('/collections', (_req, res) => res.json({ collections: allCollections() }));
r.post('/collections', (req, res) => {
  const c = readCollection(req.body || {});
  if (db.prepare('SELECT 1 FROM collections WHERE slug = ?').get(c.slug)) return res.status(409).json({ error: 'Slug already in use.', field: 'slug' });
  const k = Object.keys(c);
  db.prepare(`INSERT INTO collections (${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`).run(...Object.values(c));
  res.json({ collections: allCollections() });
});
r.put('/collections/:id', (req, res) => {
  const id = Number(req.params.id);
  const old = db.prepare('SELECT slug FROM collections WHERE id = ?').get(id);
  if (!old) return res.status(404).json({ error: 'Not found.' });
  const c = readCollection(req.body || {});
  if (db.prepare('SELECT 1 FROM collections WHERE slug = ? AND id != ?').get(c.slug, id)) return res.status(409).json({ error: 'Slug already in use.', field: 'slug' });
  db.prepare(`UPDATE collections SET ${Object.keys(c).map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...Object.values(c), id);
  if (old.slug !== c.slug) {
    // keep product memberships in sync with a renamed slug
    for (const p of db.prepare('SELECT id, collections FROM products').all()) {
      const list = parseJSON(p.collections, []);
      if (list.includes(old.slug)) db.prepare('UPDATE products SET collections = ? WHERE id = ?').run(JSON.stringify(list.map((s) => (s === old.slug ? c.slug : s))), p.id);
    }
  }
  res.json({ collections: allCollections() });
});
r.delete('/collections/:id', (req, res) => {
  db.prepare('DELETE FROM collections WHERE id = ?').run(Number(req.params.id));
  res.json({ collections: allCollections() });
});

// ---- discounts ------------------------------------------------------------------------
function readDiscount(b) {
  const type = v.oneOf(b.type, 'type', ['percent', 'fixed']);
  const expires = v.str(b.expiresAt, 'expiresAt', { max: 30, required: false });
  if (expires && Number.isNaN(Date.parse(expires))) throw new v.ValidationError('Invalid expiry date.', 'expiresAt');
  return {
    code: v.str(b.code, 'code', { min: 3, max: 30, label: 'Code' }).toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
    type,
    value: v.int(b.value, 'Value', { min: 1, max: type === 'percent' ? 100 : 10_000_000 }),
    min_subtotal: v.int(b.minSubtotal ?? 0, 'Minimum spend', { min: 0, max: 10_000_000 }),
    max_uses: v.int(b.maxUses, 'Max uses', { min: 1, max: 1_000_000, required: false }),
    expires_at: expires || null,
    active: b.active === false ? 0 : 1,
  };
}
const allDiscounts = () => db.prepare('SELECT * FROM discounts ORDER BY id DESC').all().map((d) => ({
  id: d.id, code: d.code, type: d.type, value: d.value, minSubtotal: d.min_subtotal, maxUses: d.max_uses, uses: d.uses, expiresAt: d.expires_at, active: !!d.active,
}));
r.get('/discounts', (_req, res) => res.json({ discounts: allDiscounts() }));
r.post('/discounts', (req, res) => {
  const d = readDiscount(req.body || {});
  if (db.prepare('SELECT 1 FROM discounts WHERE code = ?').get(d.code)) return res.status(409).json({ error: 'That code already exists.', field: 'code' });
  const k = Object.keys(d);
  db.prepare(`INSERT INTO discounts (${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`).run(...Object.values(d));
  res.json({ discounts: allDiscounts() });
});
r.put('/discounts/:id', (req, res) => {
  const d = readDiscount(req.body || {});
  db.prepare(`UPDATE discounts SET ${Object.keys(d).map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...Object.values(d), Number(req.params.id));
  res.json({ discounts: allDiscounts() });
});
r.delete('/discounts/:id', (req, res) => {
  db.prepare('DELETE FROM discounts WHERE id = ?').run(Number(req.params.id));
  res.json({ discounts: allDiscounts() });
});

// ---- orders ---------------------------------------------------------------------------------
r.get('/orders', (req, res) => {
  const status = String(req.query.status || '');
  const q = String(req.query.q || '').trim().toLowerCase();
  let rows = db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 1000').all();
  if (status === 'unpaid') rows = rows.filter((x) => x.status === 'pending_payment');
  else if (status) rows = rows.filter((x) => x.status === status);
  else rows = rows.filter((x) => x.status !== 'pending_payment');
  let orders = rows.map((x) => orderFromRow(x, { admin: true }));
  if (q) orders = orders.filter((o) => [o.number, o.customer.name, o.customer.email, o.customer.phone].join(' ').toLowerCase().includes(q));
  res.json({ orders: orders.slice(0, 300) });
});
r.get('/orders/:number', (req, res) => {
  const row = getOrderRow(req.params.number);
  if (!row) return res.status(404).json({ error: 'Not found.' });
  res.json({ order: orderFromRow(row, { admin: true }) });
});
r.put('/orders/:number/status', (req, res) => {
  const row = getOrderRow(req.params.number);
  if (!row) return res.status(404).json({ error: 'Not found.' });
  const status = v.oneOf(req.body?.status, 'status', ORDER_STATUSES);
  if (row.status === 'pending_payment' && status !== 'cancelled' && row.payment_status !== 'paid') {
    return res.status(409).json({ error: 'This order has not been paid yet. Only cancelling is allowed.' });
  }
  const note = v.str(req.body?.note, 'note', { max: 300, required: false });
  res.json({ order: orderFromRow(updateOrderStatus(row, status, note), { admin: true }) });
});

// ---- customers ---------------------------------------------------------------------------------
r.get('/customers', (_req, res) => {
  const rows = db.prepare(`SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at,
      (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id AND o.payment_status = 'paid') AS orders,
      (SELECT COALESCE(SUM(total),0) FROM orders o WHERE o.user_id = u.id AND o.payment_status = 'paid') AS spent
    FROM users u ORDER BY u.id DESC LIMIT 1000`).all();
  // guest customers (checked out without an account), grouped by email
  const guests = db.prepare(`SELECT json_extract(customer,'$.email') AS email, json_extract(customer,'$.name') AS name,
      json_extract(customer,'$.phone') AS phone, COUNT(*) AS orders, SUM(total) AS spent, MAX(created_at) AS last
    FROM orders WHERE user_id IS NULL AND payment_status = 'paid' GROUP BY email ORDER BY last DESC LIMIT 1000`).all();
  res.json({ customers: rows, guests });
});

// ---- page content -----------------------------------------------------------------------------------
const CONTENT_KEYS = ['home', 'about', 'collab', 'settings'];
r.get('/content/:key', (req, res) => {
  if (!CONTENT_KEYS.includes(req.params.key)) return res.status(404).json({ error: 'Not found.' });
  res.json({ content: getContent(req.params.key) });
});
r.put('/content/:key', (req, res) => {
  if (!CONTENT_KEYS.includes(req.params.key)) return res.status(404).json({ error: 'Not found.' });
  const value = req.body?.content;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return res.status(400).json({ error: 'Invalid content.' });
  const json = JSON.stringify(value);
  if (json.length > 100_000) return res.status(413).json({ error: 'Content is too large.' });
  // image fields may only point at our own assets
  const badImage = json.match(/"(?:portrait|banner|image\w*)":"([^"]*)"/g)?.find((m) => {
    const url = m.split(':"')[1].slice(0, -1);
    return url && (!/^\/(assets\/img|uploads)\/[\w\-./]+$/.test(url) || url.includes('..'));
  });
  if (badImage) return res.status(400).json({ error: 'Images must be uploaded through the media uploader.' });
  setContent(req.params.key, value);
  res.json({ content: getContent(req.params.key) });
});

// ---- inbox ----------------------------------------------------------------------------------------------
r.get('/messages', (_req, res) => res.json({ messages: db.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT 500').all() }));
r.put('/messages/:id', (req, res) => {
  db.prepare('UPDATE messages SET handled = ? WHERE id = ?').run(req.body?.handled ? 1 : 0, Number(req.params.id));
  res.json({ ok: true });
});
r.get('/subscribers', (_req, res) => res.json({ subscribers: db.prepare('SELECT * FROM subscribers ORDER BY created_at DESC').all() }));

export default r;
