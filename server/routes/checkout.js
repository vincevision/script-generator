import { Router } from 'express';
import { orderFromRow, parseJSON } from '../db.js';
import { getProvider } from '../payments/index.js';
import { createOrder, getOrderRow, tokenMatches, markPaymentStarted, applyPaymentResult } from '../orders.js';
import { rateLimit } from '../security.js';
import * as v from '../validate.js';
import config from '../config.js';
import { db } from '../db.js';

const r = Router();

function readCustomer(b = {}) {
  const country = v.str(b.country, 'country', { max: 80, label: 'Country' });
  const kenya = /^kenya$/i.test(country);
  return {
    name: v.str(b.name, 'name', { min: 2, max: 120, label: 'Full name' }),
    phone: v.phone(b.phone),
    email: v.email(b.email),
    address: v.str(b.address, 'address', { min: 4, max: 300, label: 'Delivery address' }),
    city: v.str(b.city, 'city', { max: 80, label: 'City / town' }),
    county: v.str(b.county, 'county', { max: 80, required: kenya, label: kenya ? 'County' : 'State / region' }),
    country,
    notes: v.str(b.notes, 'notes', { max: 500, required: false }),
  };
}

function canAccess(req, row) {
  return tokenMatches(row, req.get('x-order-token') || req.query.token || req.body?.token) || (req.user && row.user_id === req.user.id);
}

// 1) create order (stock reserved, awaiting payment)
r.post('/orders', rateLimit('orders', 15, 10 * 60e3), (req, res) => {
  const b = req.body || {};
  const customer = readCustomer(b.customer);
  const provider = getProvider(String(b.paymentProvider || 'mpesa'));
  if (!provider || !provider.isEnabled()) return res.status(400).json({ error: 'That payment method is not available.' });
  const out = createOrder({
    items: b.items, customer, discountCode: b.discountCode ? String(b.discountCode).slice(0, 40) : '',
    provider: provider.id, userId: req.user?.id,
  });
  res.json({ number: out.number, token: out.token, total: out.total, quote: out.quote });
});

// 2) start payment (e.g. M-PESA STK push)
r.post('/payments/:provider/start', rateLimit('pay', 12, 10 * 60e3), async (req, res) => {
  const provider = getProvider(req.params.provider);
  if (!provider || !provider.isEnabled()) return res.status(400).json({ error: 'That payment method is not available.' });
  const row = getOrderRow(req.body?.number);
  if (!row || !canAccess(req, row)) return res.status(404).json({ error: 'Order not found.' });
  if (row.payment_status === 'paid') return res.json({ status: 'paid' });
  if (row.status === 'cancelled') return res.status(409).json({ error: 'This order has expired. Please place it again.' });
  if (row.payment_provider !== provider.id) db.prepare('UPDATE orders SET payment_provider = ? WHERE id = ?').run(provider.id, row.id);
  const started = await provider.start(orderFromRow(row), { phone: req.body?.phone });
  markPaymentStarted(row, started.reference, started.meta);
  res.json({ status: 'processing', message: started.message, testMode: provider.isSimulated() });
});

// 3) poll payment status
r.get('/payments/status', rateLimit('paystatus', 240, 10 * 60e3), async (req, res) => {
  res.set('Cache-Control', 'no-store');
  let row = getOrderRow(req.query.number);
  if (!row || !canAccess(req, row)) return res.status(404).json({ error: 'Order not found.' });
  if (row.payment_status === 'processing' && row.payment_ref) {
    const provider = getProvider(row.payment_provider);
    try {
      const result = await provider.query(row.payment_ref, parseJSON(row.payment_meta, {}));
      if (result.status !== 'processing') row = applyPaymentResult(row, result);
    } catch (e) {
      console.warn('payment query failed:', e.message);
    }
  }
  const meta = parseJSON(row.payment_meta, {});
  res.json({ paymentStatus: row.payment_status, status: row.status, message: row.payment_status === 'failed' ? meta.lastError : null });
});

// Safaricom → us. The secret path segment authenticates the caller.
r.post('/payments/mpesa/callback/:secret', (req, res) => {
  const secret = config.mpesa.callbackSecret;
  if (!secret || req.params.secret !== secret) return res.status(404).end();
  const provider = getProvider('mpesa');
  const result = provider.parseCallback(req.body);
  if (result) {
    const row = db.prepare('SELECT * FROM orders WHERE payment_ref = ?').get(result.reference);
    if (row) applyPaymentResult(row, result);
  }
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

// order details (confirmation page / account)
r.get('/orders/:number', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const row = getOrderRow(req.params.number);
  if (!row || !canAccess(req, row)) return res.status(404).json({ error: 'Order not found.' });
  const o = orderFromRow(row);
  o.receipt = parseJSON(row.payment_meta, {}).receipt || null;
  res.json({ order: o });
});

export default r;
