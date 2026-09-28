// HTTP hardening: security headers, CSRF guard and a small in-memory rate limiter.
import config, { IS_PROD } from './config.js';

export function securityHeaders(req, res, next) {
  const frameAncestors = config.allowFraming ? '*' : "'self'";
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${frameAncestors}`,
  ].join('; '));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), payment=(self)');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (!config.allowFraming) res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  if (IS_PROD) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
}

/**
 * CSRF protection for the JSON API. Every state-changing request must carry
 * the custom header `X-EPIC-Request: 1`. Browsers cannot attach custom headers
 * to cross-site requests without a CORS pre-flight (which we never grant), so
 * forged cross-site form posts are rejected. Combined with SameSite cookies.
 */
export function csrfGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.originalUrl.startsWith('/api/payments/mpesa/callback/')) return next(); // server-to-server (secret URL)
  if (req.get('x-epic-request') !== '1') return res.status(403).json({ error: 'Request blocked.' });
  next();
}

const buckets = new Map();
/** rateLimit('login', 10, 15 * 60e3) → max 10 hits per 15 min per IP */
export function rateLimit(name, max, windowMs) {
  return (req, res, next) => {
    const key = `${name}:${req.ip}`;
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || b.reset < now) { b = { count: 0, reset: now + windowMs }; buckets.set(key, b); }
    b.count += 1;
    if (b.count > max) {
      res.setHeader('Retry-After', Math.ceil((b.reset - now) / 1000));
      return res.status(429).json({ error: 'Too many attempts. Please wait a moment and try again.' });
    }
    next();
  };
}
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
}, 60e3).unref();
