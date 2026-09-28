// Central configuration. Every secret comes from the environment (.env) —
// nothing sensitive is ever shipped to the browser.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

try { process.loadEnvFile(); } catch { /* no .env file — fine */ }

const here = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;
const bool = (v, d = false) => (v === undefined || v === '' ? d : /^(1|true|yes|on)$/i.test(v));

export const ROOT = path.resolve(here, '..');
export const IS_PROD = env.NODE_ENV === 'production';

const mpesaConfigured = Boolean(env.MPESA_CONSUMER_KEY && env.MPESA_CONSUMER_SECRET && env.MPESA_SHORTCODE && env.MPESA_PASSKEY);

export const config = {
  port: Number(env.PORT) || 3000,
  host: env.HOST || '0.0.0.0',
  siteUrl: (env.SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  dataDir: path.resolve(ROOT, env.DATA_DIR || 'data'),
  publicDir: path.join(ROOT, 'public'),
  adminDir: path.join(here, 'admin-ui'),
  trustProxy: bool(env.TRUST_PROXY, true),
  // Allow the store to be embedded in iframes (dev previews). Off in production by default.
  allowFraming: bool(env.ALLOW_FRAMING, !IS_PROD),

  admin: {
    email: env.ADMIN_EMAIL || '',
    password: env.ADMIN_PASSWORD || '',
  },

  sessionDays: Number(env.SESSION_DAYS) || 30,

  mpesa: {
    configured: mpesaConfigured,
    // Simulation is only ever used when real credentials are absent AND we
    // are not in production (unless explicitly forced for a staging demo).
    simulate: !mpesaConfigured && (bool(env.PAYMENTS_SIMULATE, !IS_PROD)),
    env: env.MPESA_ENV === 'production' ? 'production' : 'sandbox',
    consumerKey: env.MPESA_CONSUMER_KEY || '',
    consumerSecret: env.MPESA_CONSUMER_SECRET || '',
    shortcode: env.MPESA_SHORTCODE || '',
    passkey: env.MPESA_PASSKEY || '',
    // CustomerPayBillOnline (Paybill) or CustomerBuyGoodsOnline (Till)
    transactionType: env.MPESA_TRANSACTION_TYPE || 'CustomerPayBillOnline',
    partyB: env.MPESA_PARTY_B || env.MPESA_SHORTCODE || '',
    callbackBase: (env.MPESA_CALLBACK_BASE || env.SITE_URL || '').replace(/\/$/, ''),
    callbackSecret: env.MPESA_CALLBACK_SECRET || '',
  },

  store: {
    currency: 'KES',
    freeDeliveryThreshold: 10000,
    delivery: { nairobi: 300, kenya: 500, international: 3500 },
    pendingOrderTtlMinutes: 30,
  },
};

export default config;
