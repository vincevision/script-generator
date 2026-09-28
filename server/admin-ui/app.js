// EPIC WEAR — Admin / CMS (served only to authenticated admins; every API call is
// re-authorised on the server by requireAdmin). No build step, no dependencies.

/* ============================================================ core */
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const RAW = Symbol('raw');
const raw = (s) => ({ [RAW]: true, s: String(s ?? '') });
function h(strings, ...vals) {
  let out = strings[0];
  vals.forEach((v, i) => {
    const one = (x) => (x == null || x === false ? '' : x[RAW] ? x.s : esc(x));
    out += (Array.isArray(v) ? v.map(one).join('') : one(v)) + strings[i + 1];
  });
  return raw(out);
}
const icon = (n) => raw(`<svg class="icon" aria-hidden="true"><use href="#i-${n}"/></svg>`);
const kes = new Intl.NumberFormat('en-KE');
const money = (n) => `KES ${kes.format(Math.round(Number(n) || 0))}`;
const date = (s, time = false) => {
  if (!s) return '—';
  const d = new Date(/Z$|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(' ', 'T') + 'Z');
  return d.toLocaleString('en-KE', time ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' });
};
const thumbSrc = (src) => (!src ? '' : /\.\w{3,4}$/.test(src) ? src : `${src}-480.webp`);
const pill = (s, label = s) => h`<span class="pill pill--${s}">${String(label).replace(/_/g, ' ')}</span>`;

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: { 'X-Epic-Request': '1', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 || res.status === 403) { location.reload(); throw new Error('Session expired.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || `Request failed (${res.status})`); e.field = data.field; throw e; }
  return data;
}

let toastT;
function toast(msg, error = false) {
  $('.toast')?.remove();
  const t = document.createElement('div');
  t.className = `toast${error ? ' toast--error' : ''}`;
  t.setAttribute('role', 'status');
  t.innerHTML = h`${icon(error ? 'close' : 'check')}${msg}`.s;
  document.body.append(t);
  clearTimeout(toastT);
  toastT = setTimeout(() => t.remove(), 3200);
}
const busy = (b, on) => { if (!b) return; b.classList.toggle('is-busy', on); b.disabled = on; };
const markError = (form, err) => {
  $$('.is-invalid', form).forEach((f) => f.classList.remove('is-invalid'));
  const box = $('[data-error]', form.closest('.drawer__panel') || form);
  if (box) box.textContent = err ? err.message : '';
  if (err?.field) {
    const inp = form.querySelector(`[name="${err.field}"]`);
    inp?.closest('.field')?.classList.add('is-invalid');
    inp?.focus();
  }
};

/* ============================================================ layout */
let main = $('#main');
const setTop = (title, sub = '', actions = '') => h`<header class="top"><div><h1>${title}</h1>${sub ? h`<p>${sub}</p>` : ''}</div><div class="top__actions">${raw(actions.s ?? actions)}<button class="btn btn--icon burger" type="button" data-burger aria-label="Menu">${icon('menu')}</button></div></header>`;
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-burger]')) $('#shell').classList.toggle('is-menu');
  else if (e.target.closest('#nav a') || (e.target.closest('#shell') && !e.target.closest('#side'))) $('#shell').classList.remove('is-menu');
});

$('#logout').addEventListener('click', async () => {
  try { await api('/auth/logout', { method: 'POST', body: {} }); } catch { /* ignore */ }
  location.href = '/admin';
});

/* ------------------------------------------------------------ drawer */
function drawer(title, body, { onSave, onDelete, saveLabel = 'Save' } = {}) {
  const el = document.createElement('div');
  el.className = 'drawer';
  el.innerHTML = h`<div class="drawer__panel" role="dialog" aria-modal="true" aria-label="${title}">
    <div class="drawer__head"><h2>${title}</h2><button type="button" class="btn btn--icon" data-x aria-label="Close">${icon('close')}</button></div>
    <form class="drawer__body" novalidate>${raw(body.s ?? body)}</form>
    <div class="drawer__foot">
      ${onDelete ? h`<button type="button" class="btn btn--danger btn--sm" data-del>${icon('trash')}Delete</button>` : ''}
      <p class="error" data-error role="alert"></p>
      <div><button type="button" class="btn" data-x>Cancel</button>${onSave ? h`<button type="button" class="btn btn--primary" data-save>${saveLabel}</button>` : ''}</div>
    </div>
  </div>`.s;
  document.body.append(el);
  document.documentElement.style.overflow = 'hidden';
  const form = $('form', el);
  const close = () => { el.remove(); document.documentElement.style.overflow = ''; document.removeEventListener('keydown', key); };
  const key = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', key);
  el.addEventListener('mousedown', (e) => { if (e.target === el) close(); });
  $$('[data-x]', el).forEach((b) => b.addEventListener('click', close));
  const save = async () => {
    const b = $('[data-save]', el);
    busy(b, true);
    markError(form, null);
    try { await onSave(form); close(); } catch (err) { markError(form, err); } finally { busy(b, false); }
  };
  $('[data-save]', el)?.addEventListener('click', save);
  form.addEventListener('submit', (e) => { e.preventDefault(); if (onSave) save(); });
  $('[data-del]', el)?.addEventListener('click', async (e) => {
    if (!confirm('Delete permanently? This cannot be undone.')) return;
    busy(e.currentTarget, true);
    try { await onDelete(); close(); } catch (err) { markError(form, err); busy(e.currentTarget, false); }
  });
  setTimeout(() => form.querySelector('input:not([type=hidden]), textarea, select')?.focus(), 50);
  return { el, form, close };
}

/* ------------------------------------------------------------ fields */
const F = {
  text: (name, label, value = '', { type = 'text', span = false, hint = '', attrs = '' } = {}) =>
    h`<label class="field ${span ? 'span-2' : ''}"><span>${label}</span><input class="input" type="${type}" name="${name}" value="${value ?? ''}" ${raw(attrs)}>${hint ? h`<small>${hint}</small>` : ''}</label>`,
  area: (name, label, value = '', { span = true, rows = 4, hint = '' } = {}) =>
    h`<label class="field ${span ? 'span-2' : ''}"><span>${label}</span><textarea class="textarea" name="${name}" rows="${rows}">${value ?? ''}</textarea>${hint ? h`<small>${hint}</small>` : ''}</label>`,
  select: (name, label, options, value = '', { span = false } = {}) =>
    h`<label class="field ${span ? 'span-2' : ''}"><span>${label}</span><select class="select" name="${name}">${options.map(([v, l]) => h`<option value="${v}" ${raw(String(v) === String(value) ? 'selected' : '')}>${l}</option>`)}</select></label>`,
  check: (name, label, on) => h`<label class="check"><input type="checkbox" name="${name}" ${raw(on ? 'checked' : '')}>${label}</label>`,
  image: (name, label, value = '', { span = true } = {}) => h`<div class="field ${span ? 'span-2' : ''}" data-imgfield>
    <span>${label}</span>
    ${value ? h`<img class="banner-prev" src="${thumbSrc(value)}" alt="">` : h`<img class="banner-prev" alt="" hidden>`}
    <div class="row"><input class="input" name="${name}" value="${value || ''}" placeholder="/assets/img/… or upload"><label class="btn btn--sm">${icon('upload')}Upload<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden data-upload></label></div>
  </div>`,
};

function readFile(file) {
  return new Promise((res, rej) => {
    if (file.size > 8 * 1024 * 1024) return rej(new Error('Image must be under 8 MB.'));
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error('Could not read file.'));
    r.readAsDataURL(file);
  });
}
async function upload(file) {
  const data = await readFile(file);
  const { url } = await api('/admin/uploads', { method: 'POST', body: { data } });
  return url;
}
// single-image fields anywhere in the document
document.addEventListener('change', async (e) => {
  const inp = e.target.closest('[data-imgfield] [data-upload]');
  if (!inp || !inp.files[0]) return;
  const box = inp.closest('[data-imgfield]');
  try {
    const url = await upload(inp.files[0]);
    $('input.input', box).value = url;
    const img = $('img', box); img.src = url; img.hidden = false;
    toast('Image uploaded');
  } catch (err) { toast(err.message, true); }
  inp.value = '';
});
document.addEventListener('input', (e) => {
  const box = e.target.closest('[data-imgfield]');
  if (box && e.target.matches('input.input')) { const img = $('img', box); img.src = thumbSrc(e.target.value); img.hidden = !e.target.value; }
});

/* ============================================================ router */
let config = null;
const routes = [
  [/^\/?$/, dashboard],
  [/^\/orders$/, orders],
  [/^\/orders\/([\w-]+)$/, orderDetail],
  [/^\/products$/, products],
  [/^\/collections$/, collections],
  [/^\/discounts$/, discounts],
  [/^\/customers$/, customers],
  [/^\/content\/(home|about|collab|settings)$/, contentEditor],
  [/^\/messages$/, messages],
  [/^\/subscribers$/, subscribers],
];
async function route() {
  const path = (location.hash.slice(1) || '/').split('?')[0];
  const query = new URLSearchParams(location.hash.split('?')[1] || '');
  $$('#nav a').forEach((a) => {
    const href = a.getAttribute('href').slice(1);
    a.classList.toggle('is-active', href === '/' ? path === '/' : path.startsWith(href));
  });
  const hit = routes.map(([re, fn]) => [path.match(re), fn]).find(([m]) => m);
  // fresh element per view so listeners never leak between screens
  const fresh = main.cloneNode(false);
  main.replaceWith(fresh);
  main = fresh;
  main.innerHTML = '<p class="loading">Loading…</p>';
  try {
    if (!hit) throw new Error('Page not found.');
    await hit[1](...hit[0].slice(1), query);
    main.focus?.();
  } catch (err) {
    main.innerHTML = h`${setTop('Something went wrong')}<div class="card"><p class="error">${err.message}</p></div>`.s;
  }
}
window.addEventListener('hashchange', route);

async function boot() {
  const [{ user }, cfg] = await Promise.all([api('/auth/me'), api('/config')]);
  config = cfg;
  $('#who').textContent = user?.email || '';
  route();
  refreshUnread();
}
async function refreshUnread() {
  try {
    const { messages } = await api('/admin/messages');
    const n = messages.filter((m) => !m.handled).length;
    const b = $('#unread'); b.textContent = n; b.hidden = !n;
  } catch { /* ignore */ }
}

/* ============================================================ dashboard */
async function dashboard() {
  const s = await api('/admin/stats');
  const p = s.payments;
  main.innerHTML = h`${setTop('Dashboard', `Welcome back. Here is how EPIC WEAR is doing.`)}
  ${p.simulate ? h`<div class="banner">${icon('spark')}<div><b>Payments are in test mode.</b> M-PESA prompts are simulated and no money moves. Set <span class="mono">PAYMENTS_SIMULATE=false</span> and your Daraja credentials in the server <span class="mono">.env</span> to go live.</div></div>`
    : p.mpesaConfigured ? h`<div class="banner banner--ok">${icon('check')}<div>M-PESA is connected (${p.env}).</div></div>`
    : h`<div class="banner">${icon('bell')}<div><b>M-PESA is not configured.</b> Customers cannot pay until MPESA_* variables are set on the server.</div></div>`}
  <div class="stats">
    <div class="stat"><span>Revenue · 30 days</span><b>${money(s.revenue30)}</b><small>${s.paidOrders30} paid orders</small></div>
    <div class="stat"><span>Revenue · all time</span><b>${money(s.revenue)}</b><small>${s.paidOrders} paid orders</small></div>
    <div class="stat"><span>To fulfil</span><b>${(s.byStatus.placed || 0) + (s.byStatus.processing || 0) + (s.byStatus.packed || 0)}</b><small>${s.byStatus.placed || 0} new · ${s.byStatus.processing || 0} processing · ${s.byStatus.packed || 0} packed</small></div>
    <div class="stat"><span>Audience</span><b>${s.customers}</b><small>customers · ${s.subscribers} subscribers · ${s.unreadMessages} unread</small></div>
  </div>
  <div class="cols">
    <div class="card"><h2>Recent orders <a class="btn btn--sm" href="#/orders">All orders</a></h2>
      ${s.recent.length ? orderTable(s.recent) : h`<p class="empty">No orders yet.</p>`}
    </div>
    <div>
      <div class="card"><h2>Low stock (≤ 3)</h2>
        ${s.lowStock.length ? h`<table><tbody>${s.lowStock.map((x) => h`<tr><td>${x.name}</td><td class="num">${x.size}</td><td class="num">${x.stock === 0 ? pill('cancelled', 'out') : x.stock}</td></tr>`)}</tbody></table>` : h`<p class="muted">All sizes are well stocked.</p>`}
      </div>
      <div class="card"><h2>Catalogue</h2><p>${s.activeProducts} active of ${s.products} products.</p><p style="margin-top:12px"><a class="btn btn--sm" href="#/products">Manage products</a></p></div>
    </div>
  </div>`.s;
  bindOrderRows(main);
}

/* ============================================================ orders */
const orderTable = (list) => h`<div class="table-wrap"><table>
  <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead>
  <tbody>${list.map((o) => h`<tr class="is-link" data-order="${o.number}">
    <td class="num">${o.number}</td><td>${date(o.createdAt)}</td>
    <td class="cell-title"><b>${o.customer.name}</b><small>${o.customer.phone} · ${o.customer.city || ''}</small></td>
    <td class="num">${o.items.reduce((a, l) => a + l.qty, 0)}</td><td class="num">${money(o.total)}</td>
    <td>${pill(o.paymentStatus)}</td><td>${pill(o.status)}</td>
  </tr>`)}</tbody></table></div>`;
const bindOrderRows = (scope) => scope.addEventListener('click', (e) => {
  const tr = e.target.closest('[data-order]');
  if (tr) location.hash = `#/orders/${tr.dataset.order}`;
});

async function orders(query) {
  const status = query.get('status') || '';
  const q = query.get('q') || '';
  const { orders: list } = await api(`/admin/orders?status=${encodeURIComponent(status)}&q=${encodeURIComponent(q)}`);
  const tabs = [['', 'All paid'], ['placed', 'New'], ['processing', 'Processing'], ['packed', 'Packed'], ['shipped', 'Shipped'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled'], ['unpaid', 'Awaiting payment']];
  main.innerHTML = h`${setTop('Orders', `${list.length} ${list.length === 1 ? 'order' : 'orders'}`)}
    <form class="toolbar" data-filter>
      <select class="select" name="status">${tabs.map(([v, l]) => h`<option value="${v}" ${raw(v === status ? 'selected' : '')}>${l}</option>`)}</select>
      <input class="input" name="q" value="${q}" placeholder="Search number, name, phone, email">
      <button class="btn" type="submit">${icon('search')}Search</button>
    </form>
    ${list.length ? orderTable(list) : h`<div class="card empty">No orders match.</div>`}`.s;
  const f = $('[data-filter]', main);
  const apply = () => { const d = new FormData(f); location.hash = `#/orders?status=${d.get('status')}&q=${encodeURIComponent(d.get('q'))}`; };
  f.addEventListener('submit', (e) => { e.preventDefault(); apply(); });
  f.status.addEventListener('change', apply);
  bindOrderRows(main);
}

const FLOW = ['placed', 'processing', 'packed', 'shipped', 'delivered'];
async function orderDetail(number) {
  const { order: o } = await api(`/admin/orders/${number}`);
  const c = o.customer;
  const paid = o.paymentStatus === 'paid';
  const idx = FLOW.indexOf(o.status);
  main.innerHTML = h`${setTop(o.number, `Placed ${date(o.createdAt, true)}`, h`<a class="btn" href="#/orders">${icon('arrow-left')}Orders</a>`)}
  <div class="cols">
    <div>
      <div class="card"><h2>Fulfilment ${pill(o.status)}</h2>
        ${!paid && o.status === 'pending_payment' ? h`<p class="muted" style="margin-bottom:12px">Awaiting payment — the order can only be cancelled until it is paid. Unpaid orders auto-cancel after 30 minutes.</p>` : ''}
        <div class="status-steps">
          ${FLOW.map((s, i) => h`<button type="button" data-status="${s}" class="${s === o.status ? 'is-current' : ''}" ${raw(!paid || o.status === 'cancelled' || i <= idx ? 'disabled' : '')}>${s}</button>`)}
          <button type="button" data-status="cancelled" ${raw(o.status === 'cancelled' || o.status === 'delivered' ? 'disabled' : '')}>Cancel</button>
        </div>
        <label class="field" style="margin-top:14px"><span>Note for the customer timeline (optional)</span><input class="input" name="note" maxlength="300" placeholder="e.g. Shipped with G4S, tracking 12345"></label>
      </div>
      <div class="card"><h2>Items</h2>
        <div class="olines">${o.items.map((l) => h`<div class="oline">${l.image ? h`<img src="${thumbSrc(l.image)}" alt="">` : h`<span></span>`}<div><b>${l.name}</b><small>${l.size}${l.color ? ` · ${l.color}` : ''} · ${l.qty} × ${money(l.unitPrice ?? l.price)}</small></div><span class="mono">${money(l.lineTotal ?? (l.unitPrice ?? l.price) * l.qty)}</span></div>`)}</div>
        <div class="totals">
          <div><span>Subtotal</span><span>${money(o.subtotal)}</span></div>
          ${o.discount ? h`<div><span>Discount ${o.discountCode || ''}</span><span>−${money(o.discount)}</span></div>` : ''}
          <div><span>Delivery</span><span>${o.delivery ? money(o.delivery) : 'Free'}</span></div>
          <div><span>Total</span><span>${money(o.total)}</span></div>
        </div>
      </div>
    </div>
    <div>
      <div class="card"><h2>Customer</h2><div class="odetail" style="grid-template-columns:1fr"><dl>
        <dt>Name</dt><dd>${c.name}</dd>
        <dt>Phone</dt><dd><a href="tel:${c.phone}">${c.phone}</a> · <a href="https://wa.me/${String(c.phone || '').replace(/\D/g, '')}" target="_blank" rel="noopener">WhatsApp</a></dd>
        <dt>Email</dt><dd><a href="mailto:${c.email}">${c.email}</a></dd>
        <dt>Deliver to</dt><dd>${c.address}<br>${c.city}${c.county ? `, ${c.county}` : ''}<br>${c.country}</dd>
        ${c.notes ? h`<dt>Notes</dt><dd>${c.notes}</dd>` : ''}
        <dt>Account</dt><dd>${o.userId ? `Customer #${o.userId}` : 'Guest checkout'}</dd>
      </dl></div></div>
      <div class="card"><h2>Payment ${pill(o.paymentStatus)}</h2><dl class="odetail" style="grid-template-columns:1fr"><div>
        <dt>Provider</dt><dd>${o.paymentProvider === 'mpesa' ? 'M-PESA' : o.paymentProvider}</dd>
        <dt>Reference</dt><dd class="mono">${o.paymentMeta?.receipt || o.paymentRef || '—'}</dd>
        ${o.paymentMeta?.phone ? h`<dt>Paid from</dt><dd class="mono">${o.paymentMeta.phone}</dd>` : ''}
        ${o.paymentMeta?.lastError ? h`<dt>Last error</dt><dd>${o.paymentMeta.lastError}</dd>` : ''}
      </div></dl></div>
      <div class="card"><h2>History</h2><ol class="hist">${[...o.history].reverse().map((x) => h`<li><time>${date(x.at, true)}</time><span>${pill(x.status)} ${x.note || ''}</span></li>`)}</ol></div>
    </div>
  </div>`.s;
  $$('[data-status]', main).forEach((b) => b.addEventListener('click', async () => {
    const status = b.dataset.status;
    if (status === 'cancelled' && !confirm(`Cancel ${o.number}? Stock will be returned.`)) return;
    busy(b, true);
    try {
      await api(`/admin/orders/${o.number}/status`, { method: 'PUT', body: { status, note: $('[name=note]', main).value } });
      toast(`Order marked ${status}`);
      orderDetail(number);
    } catch (err) { toast(err.message, true); busy(b, false); }
  }));
}

/* ============================================================ products */
const catOptions = () => config.categories.map((c) => [c.slug, c.label]);
let collectionCache = [];

async function products(query) {
  const [{ products: list }, { collections: cols }] = await Promise.all([api('/admin/products'), api('/admin/collections')]);
  collectionCache = cols;
  const q = (query.get('q') || '').toLowerCase();
  const cat = query.get('cat') || '';
  const shown = list.filter((p) => (!cat || p.category === cat) && (!q || `${p.name} ${p.slug} ${p.tags}`.toLowerCase().includes(q)));
  main.innerHTML = h`${setTop('Products', `${list.length} products · ${list.filter((p) => p.status === 'active').length} active`, h`<button class="btn btn--primary" type="button" data-new>${icon('plus')}New product</button>`)}
    <form class="toolbar" data-filter>
      <select class="select" name="cat"><option value="">All categories</option>${catOptions().map(([v, l]) => h`<option value="${v}" ${raw(v === cat ? 'selected' : '')}>${l}</option>`)}</select>
      <input class="input" name="q" value="${q}" placeholder="Search products">
    </form>
    <div class="table-wrap"><table>
      <thead><tr><th></th><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Collections</th><th>Status</th></tr></thead>
      <tbody>${shown.map((p) => h`<tr class="is-link" data-id="${p.id}">
        <td>${p.images[0] ? h`<img class="thumb" src="${thumbSrc(p.images[0])}" alt="" loading="lazy">` : h`<span class="thumb thumb--empty">${icon('image')}</span>`}</td>
        <td class="cell-title"><b>${p.name}</b><small>/${p.slug}${p.featured ? ' · featured' : ''}</small></td>
        <td>${config.categories.find((c) => c.slug === p.category)?.label || p.category}</td>
        <td class="num">${money(p.price)}${p.compareAt ? h`<br><small class="muted"><s>${money(p.compareAt)}</s></small>` : ''}</td>
        <td class="num">${p.totalStock === 0 ? pill('cancelled', 'sold out') : p.totalStock}</td>
        <td><small class="muted">${p.collections.map((s) => cols.find((c) => c.slug === s)?.name || s).join(', ') || '—'}</small></td>
        <td>${pill(p.status)}</td>
      </tr>`)}</tbody>
    </table>${shown.length ? '' : h`<p class="empty">No products match.</p>`}</div>`.s;
  const f = $('[data-filter]', main);
  const apply = () => { location.hash = `#/products?cat=${f.cat.value}&q=${encodeURIComponent(f.q.value)}`; };
  f.cat.addEventListener('change', apply);
  f.addEventListener('submit', (e) => { e.preventDefault(); apply(); });
  $('[data-new]', main).addEventListener('click', () => productEditor(null));
  main.addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-id]');
    if (tr) productEditor(list.find((p) => String(p.id) === tr.dataset.id));
  });
}

function productEditor(p) {
  const isNew = !p;
  p = p || { name: '', slug: '', category: 't-shirts', gender: 'unisex', price: '', compareAt: '', description: '', details: [], colors: [{ name: 'Black', hex: '#0b0b0c' }], sizes: ['S', 'M', 'L', 'XL'], stock: {}, images: [], collections: [], tags: '', featured: false, status: 'draft', sort: 0 };
  let images = [...p.images];
  let colors = p.colors.map((c) => ({ ...c }));
  const stockRows = (sizes, stock) => h`${sizes.map((s) => h`<label><span>${s}</span><input class="input" type="number" min="0" name="stock:${s}" value="${stock[s] ?? 0}"></label>`)}`;
  const imgGrid = () => h`${images.map((src, i) => h`<div class="images__item" draggable="true" data-i="${i}"><img src="${thumbSrc(src)}" alt=""><span>${i === 0 ? 'Main' : i + 1}</span><button type="button" data-rm-img="${i}" aria-label="Remove image">${icon('close')}</button></div>`)}
    <label class="images__add">${icon('upload')}Add images<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple data-add-img></label>`;
  const colorRows = () => h`${colors.map((c, i) => h`<div class="row row--color"><input type="color" value="${c.hex}" data-c-hex="${i}" aria-label="Colour"><input class="input" value="${c.name}" data-c-name="${i}" placeholder="Colour name"><button type="button" class="btn btn--icon" data-c-rm="${i}" aria-label="Remove colour">${icon('trash')}</button></div>`)}`;

  const d = drawer(isNew ? 'New product' : `Edit · ${p.name}`, h`
    <p class="section-label">Basics</p>
    <div class="grid-form">
      ${F.text('name', 'Name', p.name, { span: true })}
      ${F.text('slug', 'URL slug', p.slug, { hint: 'Leave empty to generate from the name.' })}
      ${F.select('status', 'Status', [['active', 'Active — visible in store'], ['draft', 'Draft — hidden']], p.status)}
      ${F.select('category', 'Category', catOptions(), p.category)}
      ${F.select('gender', 'Gender', [['unisex', 'Unisex'], ['men', 'Men'], ['women', 'Women']], p.gender)}
      ${F.text('price', 'Price (KES)', p.price, { type: 'number', attrs: 'min="1"' })}
      ${F.text('compareAt', 'Compare-at price (KES)', p.compareAt || '', { type: 'number', hint: 'Shows a sale price when higher than Price.', attrs: 'min="0"' })}
      ${F.area('description', 'Description', p.description, { rows: 4 })}
      ${F.area('details', 'Details (one per line)', p.details.join('\n'), { rows: 4 })}
    </div>
    <p class="section-label">Images</p>
    <p class="muted" style="margin-bottom:10px;font-size:12.5px">Drag to reorder — the first image is the main one. Portrait 4:5 images at 1200px or larger look best.</p>
    <div class="images" data-images>${imgGrid()}</div>
    <p class="section-label">Sizes & stock</p>
    <div class="grid-form">${F.text('sizes', 'Sizes (comma separated)', p.sizes.join(', '), { span: true, hint: 'e.g. XS, S, M, L, XL — or One Size' })}</div>
    <div class="stock-grid" data-stock style="margin-top:12px">${stockRows(p.sizes, p.stock)}</div>
    <p class="section-label">Colours</p>
    <div class="rows" data-colors>${colorRows()}</div>
    <button type="button" class="btn btn--sm" data-c-add style="margin-top:10px">${icon('plus')}Add colour</button>
    <p class="section-label">Merchandising</p>
    <div class="chips" data-cols>${collectionCache.map((c) => h`<label><input type="checkbox" name="col:${c.slug}" ${raw(p.collections.includes(c.slug) ? 'checked' : '')}>${c.name}</label>`)}</div>
    <div class="grid-form" style="margin-top:14px">
      ${F.text('tags', 'Search tags', p.tags || '', { span: true, hint: 'Extra words that help search, e.g. "black oversized heavyweight".' })}
      ${F.text('sort', 'Sort order', p.sort ?? 0, { type: 'number', hint: 'Lower numbers show first in Featured.' })}
      <div class="field" style="align-content:end">${F.check('featured', 'Feature on the homepage (The Latest Drop)', p.featured)}</div>
    </div>`, {
    saveLabel: isNew ? 'Create product' : 'Save changes',
    onSave: async (form) => {
      const fd = new FormData(form);
      const sizes = String(fd.get('sizes') || '').split(',').map((s) => s.trim()).filter(Boolean);
      const body = {
        name: fd.get('name'), slug: fd.get('slug'), status: fd.get('status'), category: fd.get('category'), gender: fd.get('gender'),
        price: Number(fd.get('price')), compareAt: fd.get('compareAt') ? Number(fd.get('compareAt')) : null,
        description: fd.get('description'), details: String(fd.get('details') || '').split('\n').map((s) => s.trim()).filter(Boolean),
        sizes, stock: Object.fromEntries(sizes.map((s) => [s, Number(fd.get(`stock:${s}`) || 0)])),
        colors: colors.filter((c) => c.name.trim()), images,
        collections: collectionCache.filter((c) => fd.get(`col:${c.slug}`)).map((c) => c.slug),
        tags: fd.get('tags'), sort: Number(fd.get('sort') || 0), featured: !!fd.get('featured'),
      };
      if (isNew) await api('/admin/products', { method: 'POST', body });
      else await api(`/admin/products/${p.id}`, { method: 'PUT', body });
      toast(isNew ? 'Product created' : 'Product saved');
      route();
    },
    onDelete: isNew ? null : async () => { await api(`/admin/products/${p.id}`, { method: 'DELETE' }); toast('Product deleted'); route(); },
  });

  const form = d.form;
  const imgBox = $('[data-images]', form);
  const redrawImgs = () => { imgBox.innerHTML = imgGrid().s; };
  const redrawColors = () => { $('[data-colors]', form).innerHTML = colorRows().s; };
  form.addEventListener('input', (e) => {
    const t = e.target;
    if (t.name === 'sizes') {
      const cur = Object.fromEntries($$('[data-stock] input', form).map((i) => [i.name.slice(6), i.value]));
      const sizes = t.value.split(',').map((s) => s.trim()).filter(Boolean);
      $('[data-stock]', form).innerHTML = stockRows(sizes, cur).s;
    }
    if (t.dataset.cHex) colors[t.dataset.cHex].hex = t.value;
    if (t.dataset.cName) colors[t.dataset.cName].name = t.value;
  });
  form.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-rm-img]');
    if (rm) { images.splice(Number(rm.dataset.rmImg), 1); redrawImgs(); }
    const crm = e.target.closest('[data-c-rm]');
    if (crm) { colors.splice(Number(crm.dataset.cRm), 1); redrawColors(); }
    if (e.target.closest('[data-c-add]')) { colors.push({ name: '', hex: '#0b0b0c' }); redrawColors(); }
  });
  form.addEventListener('change', async (e) => {
    const inp = e.target.closest('[data-add-img]');
    if (!inp) return;
    const files = [...inp.files].slice(0, 12 - images.length);
    for (const file of files) {
      try { images.push(await upload(file)); redrawImgs(); } catch (err) { toast(err.message, true); }
    }
  });
  // drag to reorder
  let from = null;
  imgBox.addEventListener('dragstart', (e) => { const it = e.target.closest('.images__item'); if (!it) return; from = Number(it.dataset.i); it.classList.add('is-drag'); e.dataTransfer.effectAllowed = 'move'; });
  imgBox.addEventListener('dragover', (e) => { if (from != null) e.preventDefault(); });
  imgBox.addEventListener('drop', (e) => {
    e.preventDefault();
    const it = e.target.closest('.images__item');
    if (from == null || !it) return;
    const to = Number(it.dataset.i);
    const [moved] = images.splice(from, 1);
    images.splice(to, 0, moved);
    from = null;
    redrawImgs();
  });
  imgBox.addEventListener('dragend', () => { from = null; $$('.is-drag', imgBox).forEach((x) => x.classList.remove('is-drag')); });
}

/* ============================================================ collections */
async function collections() {
  const { collections: list } = await api('/admin/collections');
  main.innerHTML = h`${setTop('Collections', 'Campaigns with their own banner, headline and page.', h`<button class="btn btn--primary" type="button" data-new>${icon('plus')}New collection</button>`)}
    <div class="table-wrap"><table>
      <thead><tr><th></th><th>Collection</th><th>Headline</th><th>Sort</th><th>Status</th></tr></thead>
      <tbody>${list.map((c) => h`<tr class="is-link" data-id="${c.id}">
        <td>${c.banner ? h`<img class="thumb" style="width:72px;aspect-ratio:16/10" src="${thumbSrc(c.banner)}" alt="">` : ''}</td>
        <td class="cell-title"><b>${c.name}</b><small>/collections/${c.slug}</small></td>
        <td>${c.headline}</td><td class="num">${c.sort}</td><td>${pill(c.status)}</td>
      </tr>`)}</tbody></table></div>`.s;
  const edit = (c) => {
    const isNew = !c;
    c = c || { name: '', slug: '', kicker: '', headline: '', description: '', banner: '', sort: list.length + 1, status: 'active', isCampaign: true };
    drawer(isNew ? 'New collection' : `Edit · ${c.name}`, h`<div class="grid-form">
      ${F.text('name', 'Name', c.name)}
      ${F.text('slug', 'URL slug', c.slug, { hint: 'Changing it updates product memberships automatically.' })}
      ${F.text('kicker', 'Kicker', c.kicker, { hint: 'Small line above the title, e.g. "Drop 02 — Out now".' })}
      ${F.text('headline', 'Headline', c.headline)}
      ${F.area('description', 'Description', c.description, { rows: 3 })}
      ${F.image('banner', 'Banner image', c.banner)}
      ${F.text('sort', 'Sort order', c.sort, { type: 'number' })}
      ${F.select('status', 'Status', [['active', 'Active'], ['draft', 'Draft — hidden']], c.status)}
    </div>`, {
      onSave: async (form) => {
        const body = Object.fromEntries(new FormData(form));
        body.sort = Number(body.sort || 0);
        body.isCampaign = true;
        if (isNew) await api('/admin/collections', { method: 'POST', body });
        else await api(`/admin/collections/${c.id}`, { method: 'PUT', body });
        toast('Collection saved');
        route();
      },
      onDelete: isNew ? null : async () => { await api(`/admin/collections/${c.id}`, { method: 'DELETE' }); toast('Collection deleted'); route(); },
    });
  };
  $('[data-new]', main).addEventListener('click', () => edit(null));
  main.addEventListener('click', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) edit(list.find((c) => String(c.id) === tr.dataset.id)); });
}

/* ============================================================ discounts */
async function discounts() {
  const { discounts: list } = await api('/admin/discounts');
  main.innerHTML = h`${setTop('Discounts', 'Codes customers can enter at checkout.', h`<button class="btn btn--primary" type="button" data-new>${icon('plus')}New code</button>`)}
    <div class="table-wrap"><table>
      <thead><tr><th>Code</th><th>Value</th><th>Minimum</th><th>Uses</th><th>Expires</th><th>Status</th></tr></thead>
      <tbody>${list.map((x) => h`<tr class="is-link" data-id="${x.id}">
        <td class="num"><b>${x.code}</b></td><td>${x.type === 'percent' ? `${x.value}% off` : `${money(x.value)} off`}</td>
        <td class="num">${x.minSubtotal ? money(x.minSubtotal) : '—'}</td><td class="num">${x.uses}${x.maxUses ? ` / ${x.maxUses}` : ''}</td>
        <td>${x.expiresAt ? date(x.expiresAt) : 'Never'}</td><td>${pill(x.active ? 'active' : 'draft', x.active ? 'active' : 'paused')}</td>
      </tr>`)}</tbody></table>${list.length ? '' : h`<p class="empty">No discount codes yet.</p>`}</div>`.s;
  const edit = (x) => {
    const isNew = !x;
    x = x || { code: '', type: 'percent', value: 10, minSubtotal: 0, maxUses: '', expiresAt: '', active: true };
    drawer(isNew ? 'New discount code' : `Edit · ${x.code}`, h`<div class="grid-form">
      ${F.text('code', 'Code', x.code, { hint: 'Letters and numbers, e.g. EPIC15.' })}
      ${F.select('type', 'Type', [['percent', 'Percentage off'], ['fixed', 'Fixed amount off (KES)']], x.type)}
      ${F.text('value', 'Value', x.value, { type: 'number', attrs: 'min="1"' })}
      ${F.text('minSubtotal', 'Minimum spend (KES)', x.minSubtotal || 0, { type: 'number', attrs: 'min="0"' })}
      ${F.text('maxUses', 'Maximum uses', x.maxUses || '', { type: 'number', hint: 'Empty = unlimited.' })}
      ${F.text('expiresAt', 'Expires', x.expiresAt ? String(x.expiresAt).slice(0, 10) : '', { type: 'date', hint: 'Empty = never.' })}
      <div class="field span-2">${F.check('active', 'Active', x.active)}</div>
    </div>`, {
      onSave: async (form) => {
        const fd = new FormData(form);
        const body = { code: fd.get('code'), type: fd.get('type'), value: Number(fd.get('value')), minSubtotal: Number(fd.get('minSubtotal') || 0), maxUses: fd.get('maxUses') ? Number(fd.get('maxUses')) : null, expiresAt: fd.get('expiresAt') ? `${fd.get('expiresAt')}T23:59:59Z` : '', active: !!fd.get('active') };
        if (isNew) await api('/admin/discounts', { method: 'POST', body });
        else await api(`/admin/discounts/${x.id}`, { method: 'PUT', body });
        toast('Discount saved');
        route();
      },
      onDelete: isNew ? null : async () => { await api(`/admin/discounts/${x.id}`, { method: 'DELETE' }); toast('Discount deleted'); route(); },
    });
  };
  $('[data-new]', main).addEventListener('click', () => edit(null));
  main.addEventListener('click', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) edit(list.find((x) => String(x.id) === tr.dataset.id)); });
}

/* ============================================================ customers */
async function customers() {
  const { customers: list, guests } = await api('/admin/customers');
  main.innerHTML = h`${setTop('Customers', `${list.filter((u) => u.role === 'customer').length} accounts · ${guests.length} guest buyers`)}
    <div class="card"><h2>Accounts</h2><div class="table-wrap"><table>
      <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Paid orders</th><th>Spent</th><th>Joined</th></tr></thead>
      <tbody>${list.map((u) => h`<tr><td>${u.name}</td><td><a href="mailto:${u.email}">${u.email}</a></td><td class="num">${u.phone || '—'}</td><td>${pill(u.role === 'admin' ? 'shipped' : 'draft', u.role)}</td><td class="num">${u.orders}</td><td class="num">${money(u.spent)}</td><td>${date(u.created_at)}</td></tr>`)}</tbody>
    </table></div></div>
    <div class="card"><h2>Guest buyers</h2>${guests.length ? h`<div class="table-wrap"><table>
      <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Paid orders</th><th>Spent</th><th>Last order</th></tr></thead>
      <tbody>${guests.map((g) => h`<tr><td>${g.name}</td><td><a href="mailto:${g.email}">${g.email}</a></td><td class="num">${g.phone}</td><td class="num">${g.orders}</td><td class="num">${money(g.spent)}</td><td>${date(g.last)}</td></tr>`)}</tbody>
    </table></div>` : h`<p class="muted">No guest orders yet.</p>`}</div>`.s;
}

/* ============================================================ content */
const lines = (arr) => (arr || []).join('\n\n');
const paras = (s) => String(s || '').split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
const repeater = (name, items, fields) => h`<div class="repeater" data-rep="${name}">${items.map((it, i) => h`<div class="repeater__item" data-rep-item>
  <button type="button" class="btn btn--icon btn--sm" data-rep-rm aria-label="Remove">${icon('trash')}</button>
  ${fields.map(([k, label, type]) => type === 'area' ? F.area(`${name}.${i}.${k}`, label, it[k], { rows: 3 }) : F.text(`${name}.${i}.${k}`, label, it[k], { span: true }))}
</div>`)}</div><button type="button" class="btn btn--sm" data-rep-add="${name}" style="margin-top:10px">${icon('plus')}Add</button>`;
const readRep = (form, name, fields) => $$(`[data-rep="${name}"] [data-rep-item]`, form).map((item) =>
  Object.fromEntries(fields.map(([k]) => [k, item.querySelector(`[name$=".${k}"]`)?.value.trim() || '']))).filter((x) => Object.values(x).some(Boolean));

const EDITORS = {
  home: {
    title: 'Homepage', sub: 'Hero banner and manifesto on the home page.',
    render: (c) => h`<div class="grid-form">
      ${F.text('kicker', 'Hero kicker', c.kicker, { span: true })}
      ${F.text('headline', 'Tagline', c.headline, { span: true })}
      ${F.area('subtext', 'Supporting text', c.subtext, { rows: 2 })}
      ${F.text('primaryCta', 'Primary button', c.primaryCta)}
      ${F.text('secondaryCta', 'Secondary button', c.secondaryCta)}
      ${F.image('imageLeft', 'Hero image — left', c.imageLeft, { span: false })}
      ${F.image('imageRight', 'Hero image — right', c.imageRight, { span: false })}
      ${F.area('manifesto', 'Manifesto', c.manifesto, { rows: 4 })}
    </div>`,
    read: (fd) => Object.fromEntries(['kicker', 'headline', 'subtext', 'primaryCta', 'secondaryCta', 'imageLeft', 'imageRight', 'manifesto'].map((k) => [k, String(fd.get(k) || '').trim()])),
  },
  about: {
    title: 'About page', sub: 'Brand story, values and founder section.',
    render: (c) => { const f = c.founder || {}; return h`<div class="grid-form">
      ${F.text('headline', 'Headline', c.headline, { span: true })}
      ${F.area('intro', 'Intro', c.intro, { rows: 3 })}
    </div>
    <p class="section-label">Story sections</p>${repeater('sections', c.sections || [], [['title', 'Title'], ['body', 'Text', 'area']])}
    <p class="section-label">Values</p>${repeater('values', c.values || [], [['title', 'Title'], ['body', 'Text', 'area']])}
    <p class="section-label">Founder</p>
    <div class="grid-form">
      ${F.text('founder.name', 'Name', f.name)}
      ${F.text('founder.role', 'Role', f.role)}
      ${F.text('founder.secondaryRole', 'Secondary role', f.secondaryRole, { span: true })}
      ${F.image('founder.portrait', 'Portrait (optional — a monogram is shown when empty)', f.portrait)}
      ${F.area('founder.quote', 'Quote', f.quote, { rows: 2 })}
      ${F.area('founder.bio', 'Bio (blank line between paragraphs)', lines(f.bio), { rows: 6 })}
    </div>`; },
    read: (fd, form) => ({
      headline: fd.get('headline'), intro: fd.get('intro'),
      sections: readRep(form, 'sections', [['title'], ['body']]),
      values: readRep(form, 'values', [['title'], ['body']]),
      founder: { name: fd.get('founder.name'), role: fd.get('founder.role'), secondaryRole: fd.get('founder.secondaryRole'), portrait: fd.get('founder.portrait'), quote: fd.get('founder.quote'), bio: paras(fd.get('founder.bio')) },
    }),
  },
  collab: {
    title: 'Collab campaign', sub: 'EPIC WEAR × Sharon Thrift Wear page. Products come from the “EPIC × Sharon” collection.',
    render: (c) => h`<div class="grid-form">
      ${F.text('headline', 'Headline', c.headline)}
      ${F.text('partner', 'Partner name', c.partner)}
      ${F.area('intro', 'Intro', c.intro, { rows: 3 })}
      ${F.area('story', 'Story (blank line between paragraphs)', lines(c.story), { rows: 6 })}
      ${F.image('banner', 'Campaign image', c.banner)}
    </div>`,
    read: (fd) => ({ headline: fd.get('headline'), partner: fd.get('partner'), intro: fd.get('intro'), story: paras(fd.get('story')), banner: fd.get('banner') }),
  },
  settings: {
    title: 'Store settings', sub: 'Contact details, announcement bar and social links used across the store.',
    render: (c) => { const s = c.socials || {}; return h`<div class="grid-form">
      ${F.text('announcement', 'Announcement bar', c.announcement, { span: true })}
      ${F.text('phone', 'Phone (display)', c.phone)}
      ${F.text('whatsapp', 'WhatsApp number (digits only)', c.whatsapp, { hint: 'e.g. 254742850266' })}
      ${F.text('email', 'General email', c.email, { type: 'email' })}
      ${F.text('supportEmail', 'Support email', c.supportEmail, { type: 'email' })}
      ${F.text('businessEmail', 'Business email', c.businessEmail, { type: 'email' })}
      ${F.text('location', 'Location', c.location)}
      ${F.text('hours', 'Opening hours', c.hours, { span: true })}
    </div>
    <p class="section-label">Social links</p>
    <div class="grid-form">${['instagram', 'tiktok', 'facebook', 'x'].map((k) => F.text(`socials.${k}`, k === 'x' ? 'X (Twitter)' : k[0].toUpperCase() + k.slice(1), s[k], { type: 'url' }))}</div>`; },
    read: (fd) => ({
      ...Object.fromEntries(['announcement', 'phone', 'whatsapp', 'email', 'supportEmail', 'businessEmail', 'location', 'hours'].map((k) => [k, String(fd.get(k) || '').trim()])),
      socials: Object.fromEntries(['instagram', 'tiktok', 'facebook', 'x'].map((k) => [k, String(fd.get(`socials.${k}`) || '').trim()])),
    }),
  },
};

async function contentEditor(key) {
  const ed = EDITORS[key];
  const { content } = await api(`/admin/content/${key}`);
  main.innerHTML = h`${setTop(ed.title, ed.sub, h`<a class="btn" href="${{ home: '/', about: '/about', collab: '/collab', settings: '/contact' }[key]}" target="_blank" rel="noopener">${icon('arrow')}Preview</a>`)}
    <form class="card" data-content novalidate>${ed.render(content)}
      <div style="display:flex;align-items:center;gap:14px;margin-top:24px"><button class="btn btn--primary" type="submit">Save changes</button><p class="error" data-error role="alert"></p></div>
    </form>`.s;
  const form = $('[data-content]', main);
  form.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-rep-rm]');
    if (rm) rm.closest('[data-rep-item]').remove();
    const add = e.target.closest('[data-rep-add]');
    if (add) {
      const box = $(`[data-rep="${add.dataset.repAdd}"]`, form);
      const i = Date.now();
      box.insertAdjacentHTML('beforeend', h`<div class="repeater__item" data-rep-item><button type="button" class="btn btn--icon btn--sm" data-rep-rm aria-label="Remove">${icon('trash')}</button>${F.text(`${add.dataset.repAdd}.${i}.title`, 'Title', '', { span: true })}${F.area(`${add.dataset.repAdd}.${i}.body`, 'Text', '', { rows: 3 })}</div>`.s);
    }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const b = $('button[type=submit]', form);
    busy(b, true);
    markError(form, null);
    try {
      // merge so fields not shown in the editor are preserved
      const next = { ...content, ...ed.read(new FormData(form), form) };
      await api(`/admin/content/${key}`, { method: 'PUT', body: { content: next } });
      toast('Saved — live on the store now');
    } catch (err) { markError(form, err); } finally { busy(b, false); }
  });
}

/* ============================================================ inbox */
async function messages() {
  const { messages: list } = await api('/admin/messages');
  main.innerHTML = h`${setTop('Inbox', `${list.filter((m) => !m.handled).length} unread · ${list.length} total`)}
    ${list.length ? list.map((m) => h`<article class="msg ${m.handled ? 'is-handled' : ''}" data-id="${m.id}">
      <div class="msg__head"><b>${m.name}</b><a href="mailto:${m.email}">${m.email}</a>${m.phone ? h`<a href="tel:${m.phone}" class="mono">${m.phone}</a>` : ''}${pill(m.handled ? 'delivered' : 'placed', m.topic || 'message')}<time>${date(m.created_at, true)}</time></div>
      <p>${m.message}</p>
      <div><button type="button" class="btn btn--sm" data-handle="${m.handled ? 0 : 1}">${icon('check')}${m.handled ? 'Mark unread' : 'Mark handled'}</button> <a class="btn btn--sm" href="mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.topic || 'Your message to EPIC WEAR'}`)}">${icon('mail')}Reply</a></div>
    </article>`) : h`<div class="card empty">No messages yet.</div>`}`.s;
  main.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-handle]');
    if (!b) return;
    const id = b.closest('[data-id]').dataset.id;
    await api(`/admin/messages/${id}`, { method: 'PUT', body: { handled: b.dataset.handle === '1' } });
    refreshUnread();
    route();
  });
}

async function subscribers() {
  const { subscribers: list } = await api('/admin/subscribers');
  main.innerHTML = h`${setTop('Subscribers', `${list.length} on the EPIC list`, h`<button class="btn" type="button" data-csv>${icon('receipt')}Export CSV</button>`)}
    <div class="table-wrap"><table><thead><tr><th>Email</th><th>Joined</th></tr></thead>
    <tbody>${list.map((s) => h`<tr><td>${s.email}</td><td>${date(s.created_at, true)}</td></tr>`)}</tbody></table>${list.length ? '' : h`<p class="empty">No subscribers yet.</p>`}</div>`.s;
  $('[data-csv]', main).addEventListener('click', () => {
    const csv = 'email,joined\n' + list.map((s) => `"${String(s.email).replace(/"/g, '""')}",${s.created_at}`).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `epic-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}

boot().catch((err) => { main.innerHTML = h`<p class="loading">${err.message}</p>`.s; });
