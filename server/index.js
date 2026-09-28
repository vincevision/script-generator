// EPIC WEAR — store server.
// Serves the storefront (public/), the JSON API (/api), uploaded media
// (/uploads) and the admin CMS (/admin, admins only).
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import Layer from 'express/lib/router/layer.js';
import config, { IS_PROD } from './config.js';
import { db } from './db.js';
import { seed } from './seed.js';
import { loadUser, requireAdmin, ensureAdmin, purgeExpiredSessions } from './auth.js';
import { securityHeaders, csrfGuard } from './security.js';
import { ValidationError } from './validate.js';
import { releaseExpiredOrders } from './orders.js';
import { seoFor, renderSeo, sitemapXml, robotsTxt } from './seo.js';
import publicRoutes from './routes/public.js';
import accountRoutes from './routes/account.js';
import checkoutRoutes from './routes/checkout.js';
import adminRoutes from './routes/admin.js';

// Express 4 does not forward rejected promises from async handlers — patch it.
const handle = Layer.prototype.handle_request;
Layer.prototype.handle_request = function (req, res, next) {
  if (this.handle.length > 3) return handle.call(this, req, res, next);
  try {
    const out = this.handle(req, res, next);
    if (out && typeof out.catch === 'function') out.catch(next);
  } catch (err) { next(err); }
};

seed();
await ensureAdmin();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy ? 1 : false);
app.use(securityHeaders);

// ---- SEO endpoints ----------------------------------------------------------------
app.get('/robots.txt', (_req, res) => res.type('text/plain').send(robotsTxt()));
app.get('/sitemap.xml', (_req, res) => res.type('application/xml').send(sitemapXml()));

// ---- static assets ---------------------------------------------------------------------
const longCache = (res, file) => {
  if (/\.(avif|webp|jpe?g|png|svg|woff2?|ico)$/.test(file)) res.setHeader('Cache-Control', 'public, max-age=2592000');
  else res.setHeader('Cache-Control', 'no-cache'); // js/css revalidate via ETag
};
app.use('/assets', express.static(path.join(config.publicDir, 'assets'), { setHeaders: longCache, fallthrough: false }));
app.use('/uploads', express.static(path.join(config.dataDir, 'uploads'), { setHeaders: longCache, fallthrough: false }));
app.get(['/site.webmanifest', '/favicon.ico'], (req, res) => {
  if (req.path === '/favicon.ico') return res.redirect(301, '/assets/favicon.svg');
  res.sendFile(path.join(config.publicDir, 'site.webmanifest'));
});

// ---- API ----------------------------------------------------------------------------------
app.use('/api', loadUser, csrfGuard);
app.use('/api/admin/uploads', express.json({ limit: '12mb' }));
app.use('/api', express.json({ limit: '100kb' }));
app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
app.use('/api', publicRoutes);
app.use('/api', accountRoutes);
app.use('/api', checkoutRoutes);
app.use('/api/admin', requireAdmin, adminRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));

// ---- admin CMS (server-side gated) ------------------------------------------------------------
// The login screen is public; the CMS itself is only ever sent to authenticated admins.
const adminFile = (name) => path.join(config.adminDir, name);
app.use('/admin', loadUser, (_req, res, next) => { res.setHeader('X-Robots-Tag', 'noindex, nofollow'); res.setHeader('Cache-Control', 'no-store'); next(); });
app.get(['/admin/login.js', '/admin/admin.css'], (req, res) => res.sendFile(adminFile(path.basename(req.path))));
app.get('/admin/app.js', requireAdmin, (_req, res) => res.sendFile(adminFile('app.js')));
app.get(['/admin', '/admin/*'], (req, res) => {
  if (req.user?.role === 'admin') return res.sendFile(adminFile('index.html'));
  res.sendFile(adminFile('login.html'));
});

// ---- storefront (SPA shell with server-rendered SEO) ---------------------------------------------
const shellPath = path.join(config.publicDir, 'index.html');
let shellCache = null;
const shell = () => (IS_PROD && shellCache) || (shellCache = fs.readFileSync(shellPath, 'utf8'));

app.get('*', (req, res) => {
  if (path.extname(req.path)) return res.status(404).type('text/plain').send('Not found');
  const seo = seoFor(req.path, req.query);
  res.status(seo.status).type('html').setHeader('Cache-Control', 'no-cache');
  res.send(shell().replace('<!--SEO-->', renderSeo(seo)));
});

// ---- errors -------------------------------------------------------------------------------------
app.use((err, req, res, _next) => {
  if (err instanceof ValidationError) return res.status(400).json({ error: err.message, field: err.field });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request.' });
  if (err.status === 404 || err.statusCode === 404) return res.status(404).type('text/plain').send('Not found');
  const status = err.status && err.status < 500 ? err.status : 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong on our side. Please try again.' : err.message });
});

// ---- background jobs ------------------------------------------------------------------------------
const housekeeping = () => {
  try {
    const n = releaseExpiredOrders();
    if (n) console.log(`  · released ${n} unpaid order(s)`);
    purgeExpiredSessions();
  } catch (e) { console.error('housekeeping failed', e); }
};
housekeeping();
setInterval(housekeeping, 5 * 60e3).unref();

const server = app.listen(config.port, config.host, () => {
  const mode = config.mpesa.configured ? `M-PESA ${config.mpesa.env}` : config.mpesa.simulate ? 'M-PESA simulator (test mode)' : 'M-PESA not configured';
  console.log(`\n  EPIC WEAR store → http://${config.host}:${config.port}  (${IS_PROD ? 'production' : 'development'}, ${mode})\n`);
});
const shutdown = () => server.close(() => { db.close(); process.exit(0); });
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
