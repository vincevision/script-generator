import { Router } from 'express';
import { db, orderFromRow } from '../db.js';
import { hashPassword, verifyPassword, burnPasswordCheck, createSession, destroySession, requireUser, publicUser } from '../auth.js';
import { rateLimit } from '../security.js';
import * as v from '../validate.js';

const r = Router();

// ---- auth -------------------------------------------------------------------
r.post('/auth/register', rateLimit('register', 8, 60 * 60e3), async (req, res) => {
  const b = req.body || {};
  const name = v.str(b.name, 'name', { min: 2, max: 120, label: 'Name' });
  const email = v.email(b.email);
  const password = v.password(b.password);
  const phone = v.phone(b.phone, 'phone', { required: false });
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    return res.status(409).json({ error: 'An account with this email already exists. Try signing in.', field: 'email' });
  }
  const info = db.prepare(`INSERT INTO users (email, name, phone, password_hash) VALUES (?, ?, ?, ?)`)
    .run(email, name, phone || null, await hashPassword(password));
  createSession(res, info.lastInsertRowid);
  res.json({ user: publicUser({ id: Number(info.lastInsertRowid), email, name, phone, role: 'customer' }) });
});

r.post('/auth/login', rateLimit('login', 10, 15 * 60e3), async (req, res) => {
  const b = req.body || {};
  const email = v.email(b.email);
  const password = typeof b.password === 'string' ? b.password : '';
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!u) { await burnPasswordCheck(password); return res.status(401).json({ error: 'Incorrect email or password.' }); }
  if (!(await verifyPassword(password, u.password_hash))) return res.status(401).json({ error: 'Incorrect email or password.' });
  createSession(res, u.id);
  res.json({ user: publicUser(u) });
});

r.post('/auth/logout', (req, res) => {
  destroySession(req, res);
  res.json({ ok: true });
});

r.get('/auth/me', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ user: publicUser(req.user) });
});

// ---- account ------------------------------------------------------------------
r.use('/account', requireUser);

r.get('/account/orders', (req, res) => {
  const rows = db.prepare(`SELECT * FROM orders WHERE user_id = ? AND status != 'pending_payment' ORDER BY id DESC LIMIT 100`).all(req.user.id);
  res.json({ orders: rows.map((row) => orderFromRow(row)) });
});

r.put('/account/profile', (req, res) => {
  const b = req.body || {};
  const name = v.str(b.name, 'name', { min: 2, max: 120, label: 'Name' });
  const phone = v.phone(b.phone, 'phone', { required: false });
  db.prepare('UPDATE users SET name = ?, phone = ? WHERE id = ?').run(name, phone || null, req.user.id);
  res.json({ user: publicUser({ ...req.user, name, phone }) });
});

r.put('/account/password', rateLimit('pw', 10, 15 * 60e3), async (req, res) => {
  const b = req.body || {};
  const u = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!(await verifyPassword(String(b.current || ''), u.password_hash))) return res.status(400).json({ error: 'Your current password is incorrect.', field: 'current' });
  const next = v.password(b.next);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(next), req.user.id);
  res.json({ ok: true });
});

// addresses
const addrFields = (b) => ({
  label: v.str(b.label, 'label', { max: 40, required: false, label: 'Label' }) || 'Home',
  name: v.str(b.name, 'name', { max: 120, label: 'Name' }),
  phone: v.phone(b.phone),
  address: v.str(b.address, 'address', { max: 300, label: 'Address' }),
  city: v.str(b.city, 'city', { max: 80, label: 'City / town' }),
  county: v.str(b.county, 'county', { max: 80, required: false, label: 'County' }),
  country: v.str(b.country, 'country', { max: 80, label: 'Country' }),
  is_default: b.isDefault ? 1 : 0,
});
const listAddresses = (uid) => db.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC').all(uid)
  .map(({ user_id, is_default, ...a }) => ({ ...a, isDefault: !!is_default }));

r.get('/account/addresses', (req, res) => res.json({ addresses: listAddresses(req.user.id) }));
r.post('/account/addresses', (req, res) => {
  const a = addrFields(req.body || {});
  const count = db.prepare('SELECT COUNT(*) AS n FROM addresses WHERE user_id = ?').get(req.user.id).n;
  if (count >= 10) return res.status(400).json({ error: 'You can save up to 10 addresses.' });
  if (a.is_default || count === 0) { db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(req.user.id); a.is_default = 1; }
  db.prepare('INSERT INTO addresses (user_id, label, name, phone, address, city, county, country, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(req.user.id, a.label, a.name, a.phone, a.address, a.city, a.county, a.country, a.is_default);
  res.json({ addresses: listAddresses(req.user.id) });
});
r.put('/account/addresses/:id', (req, res) => {
  const a = addrFields(req.body || {});
  const own = db.prepare('SELECT id FROM addresses WHERE id = ? AND user_id = ?').get(Number(req.params.id), req.user.id);
  if (!own) return res.status(404).json({ error: 'Address not found.' });
  if (a.is_default) db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(req.user.id);
  db.prepare('UPDATE addresses SET label=?, name=?, phone=?, address=?, city=?, county=?, country=?, is_default=? WHERE id = ?')
    .run(a.label, a.name, a.phone, a.address, a.city, a.county, a.country, a.is_default, own.id);
  res.json({ addresses: listAddresses(req.user.id) });
});
r.delete('/account/addresses/:id', (req, res) => {
  db.prepare('DELETE FROM addresses WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
  res.json({ addresses: listAddresses(req.user.id) });
});

// wishlist (server copy for signed-in customers; guests use localStorage)
const wishlistIds = (uid) => db.prepare('SELECT product_id FROM wishlist WHERE user_id = ? ORDER BY created_at DESC').all(uid).map((x) => x.product_id);
r.get('/account/wishlist', (req, res) => res.json({ ids: wishlistIds(req.user.id) }));
r.post('/account/wishlist/merge', (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.slice(0, 200).map(Number).filter(Number.isInteger) : [];
  const ins = db.prepare('INSERT OR IGNORE INTO wishlist (user_id, product_id) SELECT ?, id FROM products WHERE id = ?');
  for (const id of ids) ins.run(req.user.id, id);
  res.json({ ids: wishlistIds(req.user.id) });
});
r.put('/account/wishlist/:id', (req, res) => {
  db.prepare('INSERT OR IGNORE INTO wishlist (user_id, product_id) SELECT ?, id FROM products WHERE id = ?').run(req.user.id, Number(req.params.id));
  res.json({ ids: wishlistIds(req.user.id) });
});
r.delete('/account/wishlist/:id', (req, res) => {
  db.prepare('DELETE FROM wishlist WHERE user_id = ? AND product_id = ?').run(req.user.id, Number(req.params.id));
  res.json({ ids: wishlistIds(req.user.id) });
});

export default r;
