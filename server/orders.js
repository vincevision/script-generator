// Pricing, order creation and payment state — the server is the only source
// of truth for prices, discounts, delivery fees and stock.
import crypto from 'node:crypto';
import { db, tx, productFromRow, parseJSON } from './db.js';
import config from './config.js';
import { ValidationError } from './validate.js';

const S = config.store;

export function deliveryFee({ country = 'Kenya', county = '' }, subtotalAfterDiscount) {
  const kenya = /^kenya$/i.test(String(country).trim());
  if (!kenya) return { fee: S.delivery.international, label: 'International express', eta: '5–10 business days' };
  if (subtotalAfterDiscount >= S.freeDeliveryThreshold) return { fee: 0, label: 'Free delivery', eta: /nairobi/i.test(county) ? '1–2 business days' : '2–4 business days' };
  if (/nairobi/i.test(county)) return { fee: S.delivery.nairobi, label: 'Nairobi delivery', eta: '1–2 business days' };
  return { fee: S.delivery.kenya, label: 'Countrywide delivery', eta: '2–4 business days' };
}

export function findDiscount(code) {
  if (!code) return null;
  const d = db.prepare('SELECT * FROM discounts WHERE code = ? AND active = 1').get(String(code).trim());
  if (!d) return null;
  if (d.expires_at && new Date(d.expires_at).getTime() < Date.now()) return null;
  if (d.max_uses != null && d.uses >= d.max_uses) return null;
  return d;
}

function discountAmount(d, subtotal) {
  if (!d || subtotal < d.min_subtotal) return 0;
  return d.type === 'percent' ? Math.floor((subtotal * Math.min(100, d.value)) / 100) : Math.min(subtotal, d.value);
}

/**
 * Price a cart. `strict` throws on any problem (used when placing an order);
 * otherwise problems are reported in `issues` so the cart can explain them.
 */
export function priceCart(rawItems, { country, county, discountCode } = {}, { strict = false } = {}) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) throw new ValidationError('Your bag is empty.', 'items');
  if (rawItems.length > 50) throw new ValidationError('Too many items in one order.', 'items');

  const getBySlug = db.prepare(`SELECT * FROM products WHERE slug = ? AND status = 'active'`);
  const getById = db.prepare(`SELECT * FROM products WHERE id = ? AND status = 'active'`);
  const lines = [];
  const issues = [];
  const qtyByKey = {};

  for (const it of rawItems) {
    const row = it.productId ? getById.get(Number(it.productId)) : getBySlug.get(String(it.slug || ''));
    const p = productFromRow(row);
    const fail = (msg) => { if (strict) throw new ValidationError(msg, 'items'); issues.push({ slug: it.slug, size: it.size, message: msg }); };
    if (!p) { fail('An item in your bag is no longer available.'); continue; }
    const size = String(it.size || '');
    if (!p.sizes.includes(size)) { fail(`Please choose a valid size for ${p.name}.`); continue; }
    const color = p.colors.find((c) => c.name === it.color)?.name || p.colors[0]?.name || '';
    const qty = Math.floor(Number(it.qty));
    if (!Number.isFinite(qty) || qty < 1 || qty > 10) { fail(`Invalid quantity for ${p.name}.`); continue; }
    const key = `${p.id}:${size}`;
    qtyByKey[key] = (qtyByKey[key] || 0) + qty;
    const available = Number(p.stock[size]) || 0;
    if (qtyByKey[key] > available) {
      fail(available ? `Only ${available} left of ${p.name} in size ${size}.` : `${p.name} is sold out in size ${size}.`);
      continue;
    }
    lines.push({
      productId: p.id, slug: p.slug, name: p.name, image: p.images[0] || '', size, color, qty,
      unitPrice: p.price, lineTotal: p.price * qty,
    });
  }

  if (strict && lines.length === 0) throw new ValidationError('Your bag is empty.', 'items');
  const subtotal = lines.reduce((a, l) => a + l.lineTotal, 0);
  let discount = 0, appliedCode = null, discountMessage = null;
  if (discountCode) {
    const d = findDiscount(discountCode);
    if (!d) discountMessage = 'That discount code is not valid.';
    else if (subtotal < d.min_subtotal) discountMessage = `This code needs a minimum spend of KES ${d.min_subtotal.toLocaleString()}.`;
    else { discount = discountAmount(d, subtotal); appliedCode = d.code; }
  }
  const del = deliveryFee({ country, county }, subtotal - discount);
  return {
    lines, issues, subtotal, discount, discountCode: appliedCode, discountMessage,
    delivery: del.fee, deliveryLabel: del.label, deliveryEta: del.eta,
    total: subtotal - discount + del.fee, currency: S.currency,
  };
}

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
function orderNumber() {
  const bytes = crypto.randomBytes(6);
  return 'EPIC-' + Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

function adjustStock(items, direction) {
  const get = db.prepare('SELECT stock FROM products WHERE id = ?');
  const set = db.prepare(`UPDATE products SET stock = ?, updated_at = datetime('now') WHERE id = ?`);
  for (const l of items) {
    const row = get.get(l.productId);
    if (!row) continue;
    const stock = parseJSON(row.stock, {});
    stock[l.size] = Math.max(0, (Number(stock[l.size]) || 0) + direction * l.qty);
    set.run(JSON.stringify(stock), l.productId);
  }
}

/** Create an order in `pending_payment` and reserve its stock atomically. */
export function createOrder({ items, customer, discountCode, provider, userId }) {
  return tx(() => {
    const q = priceCart(items, { country: customer.country, county: customer.county, discountCode }, { strict: true });
    adjustStock(q.lines, -1);
    let number;
    do { number = orderNumber(); } while (db.prepare('SELECT 1 FROM orders WHERE number = ?').get(number));
    const token = crypto.randomBytes(24).toString('base64url');
    const history = [{ status: 'pending_payment', at: new Date().toISOString(), note: 'Order created — awaiting payment' }];
    db.prepare(`INSERT INTO orders (number, access_token, user_id, customer, items, subtotal, discount, discount_code, delivery, total, payment_provider, history)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(number, token, userId || null, JSON.stringify(customer), JSON.stringify(q.lines), q.subtotal, q.discount, q.discountCode, q.delivery, q.total, provider, JSON.stringify(history));
    return { number, token, total: q.total, quote: q };
  });
}

export function getOrderRow(number) {
  return db.prepare('SELECT * FROM orders WHERE number = ?').get(String(number || '').toUpperCase());
}

export function tokenMatches(row, token) {
  if (!row || !token) return false;
  const a = Buffer.from(String(row.access_token));
  const b = Buffer.from(String(token));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function pushHistory(row, status, note) {
  const h = parseJSON(row.history, []);
  h.push({ status, at: new Date().toISOString(), note });
  return JSON.stringify(h);
}

export function markPaymentStarted(row, reference, meta) {
  db.prepare(`UPDATE orders SET payment_status = 'processing', payment_ref = ?, payment_meta = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(reference, JSON.stringify(meta), row.id);
}

/** Apply a provider result idempotently. */
export function applyPaymentResult(row, result) {
  return tx(() => {
    const fresh = db.prepare('SELECT * FROM orders WHERE id = ?').get(row.id);
    if (!fresh || fresh.payment_status === 'paid') return fresh;
    const meta = parseJSON(fresh.payment_meta, {});
    if (result.status === 'paid') {
      if (result.amount != null && result.amount < fresh.total) {
        meta.lastError = `Amount mismatch: received ${result.amount}, expected ${fresh.total}`;
        db.prepare(`UPDATE orders SET payment_status = 'failed', payment_meta = ?, updated_at = datetime('now') WHERE id = ?`).run(JSON.stringify(meta), fresh.id);
        return db.prepare('SELECT * FROM orders WHERE id = ?').get(fresh.id);
      }
      meta.receipt = result.receipt || meta.receipt || null;
      meta.paidAt = new Date().toISOString();
      if (fresh.stock_released) { adjustStock(parseJSON(fresh.items, []), -1); } // re-reserve if it had expired
      const note = `Payment confirmed${meta.receipt ? ` — M-PESA receipt ${meta.receipt}` : ''}`;
      db.prepare(`UPDATE orders SET payment_status = 'paid', status = 'placed', stock_released = 0, payment_meta = ?, history = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(JSON.stringify(meta), pushHistory(fresh, 'placed', note), fresh.id);
      if (fresh.discount_code) db.prepare('UPDATE discounts SET uses = uses + 1 WHERE code = ?').run(fresh.discount_code);
    } else if (result.status === 'failed') {
      meta.lastError = result.message || 'Payment failed';
      db.prepare(`UPDATE orders SET payment_status = 'failed', payment_meta = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(JSON.stringify(meta), fresh.id);
    }
    return db.prepare('SELECT * FROM orders WHERE id = ?').get(fresh.id);
  });
}

export function updateOrderStatus(row, status, note) {
  return tx(() => {
    let releasedSql = '';
    if (status === 'cancelled' && !row.stock_released && row.status !== 'delivered') {
      adjustStock(parseJSON(row.items, []), +1);
      releasedSql = ', stock_released = 1';
    }
    db.prepare(`UPDATE orders SET status = ?, history = ?${releasedSql}, updated_at = datetime('now') WHERE id = ?`)
      .run(status, pushHistory(row, status, note || ''), row.id);
    return db.prepare('SELECT * FROM orders WHERE id = ?').get(row.id);
  });
}

/** Release stock held by unpaid orders after the TTL. */
export function releaseExpiredOrders() {
  const cutoff = new Date(Date.now() - S.pendingOrderTtlMinutes * 60e3).toISOString().replace('T', ' ').slice(0, 19);
  const rows = db.prepare(`SELECT * FROM orders WHERE status = 'pending_payment' AND payment_status != 'paid' AND stock_released = 0 AND created_at < ?`).all(cutoff);
  for (const r of rows) {
    tx(() => {
      adjustStock(parseJSON(r.items, []), +1);
      db.prepare(`UPDATE orders SET status = 'cancelled', stock_released = 1, history = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(pushHistory(r, 'cancelled', 'Payment not received in time — order released'), r.id);
    });
  }
  return rows.length;
}
