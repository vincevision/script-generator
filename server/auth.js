// Authentication: scrypt password hashing + opaque, server-side sessions.
// The session cookie is httpOnly (unreadable from JS), SameSite=Lax and
// Secure in production. Only a SHA-256 hash of the token is stored.
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { db } from './db.js';
import config, { IS_PROD } from './config.js';

const scrypt = promisify(crypto.scrypt);
const COOKIE = 'epic_sid';
const N = 16384, R = 8, P = 1, KEYLEN = 64;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  try {
    const [algo, n, r, p, saltB64, keyB64] = String(stored).split('$');
    if (algo !== 'scrypt') return false;
    const expected = Buffer.from(keyB64, 'base64');
    const key = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, { N: +n, r: +r, p: +p });
    return crypto.timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

// A constant dummy hash so failed lookups take as long as real checks (no user enumeration by timing)
let dummyHash = null;
export async function burnPasswordCheck(password) {
  if (!dummyHash) dummyHash = await hashPassword('epic-dummy-password');
  await verifyPassword(password, dummyHash);
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (k) out[k] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function cookieString(value, maxAgeSec) {
  const parts = [`${COOKIE}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSec}`];
  if (IS_PROD) parts.push('Secure');
  return parts.join('; ');
}

export function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const maxAge = config.sessionDays * 86400;
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(sha256(token), userId, Date.now() + maxAge * 1000);
  res.setHeader('Set-Cookie', cookieString(token, maxAge));
}

export function destroySession(req, res) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
  res.setHeader('Set-Cookie', cookieString('', 0));
}

/** Middleware: attaches req.user (or null) from the session cookie. */
export function loadUser(req, _res, next) {
  req.user = null;
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token) {
    const row = db.prepare(`SELECT u.id, u.email, u.name, u.phone, u.role, s.expires_at
      FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`).get(sha256(token));
    if (row && row.expires_at > Date.now()) {
      req.user = { id: row.id, email: row.email, name: row.name, phone: row.phone, role: row.role };
    }
  }
  next();
}

export function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please sign in to continue.' });
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden.' });
  next();
}

export function publicUser(u) {
  return u ? { id: u.id, email: u.email, name: u.name, phone: u.phone || '', role: u.role } : null;
}

export function purgeExpiredSessions() {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
}

/** Create/upgrade the bootstrap admin from ADMIN_EMAIL / ADMIN_PASSWORD. */
export async function ensureAdmin() {
  const { email, password } = config.admin;
  const hasAdmin = db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin'`).get().n > 0;
  if (!email || !password) {
    if (!hasAdmin) console.log('  ! No admin account yet — set ADMIN_EMAIL and ADMIN_PASSWORD in .env (or run `npm run create-admin`).');
    return;
  }
  if (password.length < 10) {
    console.warn('  ! ADMIN_PASSWORD must be at least 10 characters — admin not created.');
    return;
  }
  const existing = db.prepare('SELECT id, role FROM users WHERE email = ?').get(email);
  if (!existing) {
    db.prepare(`INSERT INTO users (email, name, password_hash, role) VALUES (?, 'EPIC Admin', ?, 'admin')`).run(email, await hashPassword(password));
    console.log(`  ✓ Admin account created for ${email}`);
  } else if (existing.role !== 'admin') {
    db.prepare(`UPDATE users SET role = 'admin' WHERE id = ?`).run(existing.id);
    console.log(`  ✓ ${email} promoted to admin`);
  }
}
