// M-PESA (Safaricom Daraja) — Lipa Na M-PESA Online / STK Push.
//
// Flow: server requests an STK push → customer confirms with their PIN on
// their phone → Safaricom POSTs the result to our callback URL. We also poll
// the STK Query API as a fallback in case a callback is delayed or lost.
//
// All credentials live in environment variables on the server. When they
// are absent (and NODE_ENV !== production) a local simulator is used so the
// full checkout can be exercised end-to-end without moving money.
import config from '../config.js';
import { kenyanPhone } from '../validate.js';

const cfg = config.mpesa;
const BASE = cfg.env === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
let tokenCache = { token: null, exp: 0 };

async function accessToken() {
  if (tokenCache.token && tokenCache.exp > Date.now() + 30e3) return tokenCache.token;
  const auth = Buffer.from(`${cfg.consumerKey}:${cfg.consumerSecret}`).toString('base64');
  const r = await fetch(`${BASE}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${auth}` } });
  if (!r.ok) throw new Error(`M-PESA auth failed (${r.status})`);
  const j = await r.json();
  tokenCache = { token: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3599) * 1000 };
  return tokenCache.token;
}

function timestamp() {
  // Daraja expects EAT (UTC+3) yyyyMMddHHmmss
  const d = new Date(Date.now() + 3 * 3600e3);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}
const password = (ts) => Buffer.from(`${cfg.shortcode}${cfg.passkey}${ts}`).toString('base64');

// ---- simulator ------------------------------------------------------------
const SIM_DELAY_MS = 6500;
function simulatedOutcome(meta) {
  if (Date.now() - meta.startedAt < SIM_DELAY_MS) return { status: 'processing' };
  if (String(meta.phone).endsWith('000')) return { status: 'failed', message: 'The payment request was cancelled on the phone.' };
  if (String(meta.phone).endsWith('111')) return { status: 'failed', message: 'Insufficient M-PESA balance.' };
  return { status: 'paid', receipt: `SIM${Math.random().toString(36).slice(2, 9).toUpperCase()}` };
}

// Human-friendly messages for common Daraja result codes
const RESULT_MESSAGES = {
  1: 'Insufficient M-PESA balance.',
  1032: 'The payment request was cancelled on the phone.',
  1037: 'We could not reach your phone. Make sure it is on and try again.',
  2001: 'The M-PESA PIN entered was incorrect.',
  1019: 'The payment request expired. Please try again.',
};

export default {
  id: 'mpesa',
  label: 'M-PESA',
  description: 'Pay instantly with an STK push to your Safaricom line.',

  isEnabled: () => cfg.configured || cfg.simulate,
  isSimulated: () => !cfg.configured && cfg.simulate,

  /** Start a payment. Returns { reference, meta, message } or throws. */
  async start(order, { phone }) {
    const msisdn = kenyanPhone(phone);
    if (!msisdn) {
      const err = new Error('Enter a valid Safaricom number, e.g. 0712 345 678.');
      err.status = 400;
      throw err;
    }
    if (this.isSimulated()) {
      const reference = `ws_CO_SIM_${Date.now()}`;
      return { reference, meta: { phone: msisdn, startedAt: Date.now(), simulated: true }, message: 'Payment request sent (test mode).' };
    }

    if (!cfg.callbackBase || !cfg.callbackSecret) throw new Error('M-PESA callback URL is not configured.');
    const ts = timestamp();
    const body = {
      BusinessShortCode: cfg.shortcode,
      Password: password(ts),
      Timestamp: ts,
      TransactionType: cfg.transactionType,
      Amount: Math.max(1, Math.round(order.total)),
      PartyA: msisdn,
      PartyB: cfg.partyB,
      PhoneNumber: msisdn,
      CallBackURL: `${cfg.callbackBase}/api/payments/mpesa/callback/${cfg.callbackSecret}`,
      AccountReference: order.number.replace(/[^A-Z0-9]/gi, '').slice(0, 12),
      TransactionDesc: 'EPIC WEAR order',
    };
    const r = await fetch(`${BASE}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.ResponseCode !== '0') {
      const err = new Error(j.errorMessage || j.ResponseDescription || 'M-PESA could not start the payment.');
      err.status = 502;
      throw err;
    }
    return { reference: j.CheckoutRequestID, meta: { phone: msisdn, startedAt: Date.now(), merchantRequestId: j.MerchantRequestID }, message: j.CustomerMessage };
  },

  /** Poll the provider. Returns { status: processing|paid|failed, message?, receipt? } */
  async query(reference, meta) {
    if (meta?.simulated) return simulatedOutcome(meta);
    // Give the customer time before querying; Daraja rate-limits aggressive polling.
    if (Date.now() - (meta?.startedAt || 0) < 15e3) return { status: 'processing' };
    const ts = timestamp();
    const r = await fetch(`${BASE}/mpesa/stkpushquery/v1/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ BusinessShortCode: cfg.shortcode, Password: password(ts), Timestamp: ts, CheckoutRequestID: reference }),
    });
    const j = await r.json().catch(() => ({}));
    if (j.errorCode === '500.001.1001') return { status: 'processing' }; // still being processed
    if (j.ResultCode === undefined) return { status: 'processing' };
    const code = Number(j.ResultCode);
    // STK Query has no receipt number — the callback supplies it.
    if (code === 0) return { status: 'paid' };
    return { status: 'failed', message: RESULT_MESSAGES[code] || j.ResultDesc || 'Payment was not completed.' };
  },

  /** Parse a Daraja callback body → { reference, status, message, receipt, amount } */
  parseCallback(body) {
    const cb = body?.Body?.stkCallback;
    if (!cb?.CheckoutRequestID) return null;
    const items = Object.fromEntries((cb.CallbackMetadata?.Item || []).map((i) => [i.Name, i.Value]));
    const code = Number(cb.ResultCode);
    return {
      reference: cb.CheckoutRequestID,
      status: code === 0 ? 'paid' : 'failed',
      message: code === 0 ? 'Payment received.' : (RESULT_MESSAGES[code] || cb.ResultDesc || 'Payment was not completed.'),
      receipt: items.MpesaReceiptNumber || null,
      amount: items.Amount != null ? Number(items.Amount) : null,
      phone: items.PhoneNumber ? String(items.PhoneNumber) : null,
    };
  },
};
