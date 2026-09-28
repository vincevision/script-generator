// Client state: catalogue cache, bag, wishlist and the signed-in customer.
// Bag + wishlist persist in localStorage; wishlist syncs to the account when signed in.
import { get, post, put, del } from './api.js';

const bus = new EventTarget();
export const on = (type, fn) => { const h = (e) => fn(e.detail); bus.addEventListener(type, h); return () => bus.removeEventListener(type, h); };
export const emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

export const state = {
  config: null,
  products: [],
  bySlug: new Map(),
  byId: new Map(),
  collections: [],
  user: null,
  cart: read('epic-cart', []),
  wishlist: read('epic-wishlist', []),
  region: read('epic-region', 'nairobi'),
};

let catalogPromise = null;
export function loadCatalog(force = false) {
  if (catalogPromise && !force) return catalogPromise;
  catalogPromise = Promise.all([get('/products'), get('/collections')]).then(([p, c]) => {
    state.products = p.products;
    state.bySlug = new Map(p.products.map((x) => [x.slug, x]));
    state.byId = new Map(p.products.map((x) => [x.id, x]));
    state.collections = c.collections;
    // prune bag lines for products that no longer exist
    const before = state.cart.length;
    state.cart = state.cart.filter((l) => state.bySlug.has(l.slug));
    if (before !== state.cart.length) saveCart();
    emit('catalog');
    return state;
  }).catch((e) => { catalogPromise = null; throw e; });
  return catalogPromise;
}

export async function loadConfig() {
  if (state.config) return state.config;
  state.config = await get('/config');
  return state.config;
}

export const categoryLabel = (slug) => state.config?.categories.find((c) => c.slug === slug)?.label || slug;
export const collectionName = (slug) => state.collections.find((c) => c.slug === slug)?.name || slug;

// ---- bag -------------------------------------------------------------------------
function saveCart() { write('epic-cart', state.cart); emit('cart', state.cart); }
export const cartCount = () => state.cart.reduce((a, l) => a + l.qty, 0);
export const cartLines = () => state.cart.map((l) => ({ ...l, product: state.bySlug.get(l.slug) })).filter((l) => l.product);
export const cartSubtotal = () => cartLines().reduce((a, l) => a + l.product.price * l.qty, 0);

export function addToCart(slug, size, color, qty = 1) {
  const p = state.bySlug.get(slug);
  if (!p) return false;
  color = color || p.colors[0]?.name || '';
  const line = state.cart.find((l) => l.slug === slug && l.size === size && l.color === color);
  if (line) line.qty = Math.min(10, line.qty + qty);
  else state.cart.unshift({ slug, size, color, qty: Math.min(10, qty) });
  saveCart();
  emit('cart:add', { slug, size, color, qty });
  return true;
}
export function setQty(i, qty) {
  if (!state.cart[i]) return;
  if (qty <= 0) state.cart.splice(i, 1);
  else state.cart[i].qty = Math.min(10, qty);
  saveCart();
}
export function removeLine(i) { state.cart.splice(i, 1); saveCart(); }
export function clearCart() { state.cart = []; saveCart(); }

export function setRegion(r) { state.region = r; write('epic-region', r); emit('cart', state.cart); }
export function estimateDelivery(subtotal = cartSubtotal()) {
  const c = state.config;
  if (!c) return { fee: 0, label: 'Delivery' };
  if (state.region === 'international') return { fee: c.delivery.international, label: 'International' };
  if (subtotal >= c.freeDeliveryThreshold) return { fee: 0, label: state.region === 'nairobi' ? 'Nairobi' : 'Rest of Kenya' };
  return state.region === 'nairobi' ? { fee: c.delivery.nairobi, label: 'Nairobi' } : { fee: c.delivery.kenya, label: 'Rest of Kenya' };
}

// ---- wishlist --------------------------------------------------------------------------
function saveWish() { write('epic-wishlist', state.wishlist); emit('wishlist', state.wishlist); }
export const inWishlist = (id) => state.wishlist.includes(id);
export async function toggleWishlist(id) {
  const adding = !inWishlist(id);
  state.wishlist = adding ? [id, ...state.wishlist] : state.wishlist.filter((x) => x !== id);
  saveWish();
  if (state.user) {
    try { adding ? await put(`/account/wishlist/${id}`) : await del(`/account/wishlist/${id}`); } catch { /* offline — local copy stays */ }
  }
  return adding;
}

// ---- customer ----------------------------------------------------------------------------
export async function loadUser() {
  try {
    const { user } = await get('/auth/me');
    setUser(user, false);
  } catch { state.user = null; }
  return state.user;
}
export async function setUser(user, merge = true) {
  state.user = user;
  emit('user', user);
  if (user) {
    try {
      const { ids } = merge || state.wishlist.length ? await post('/account/wishlist/merge', { ids: state.wishlist }) : await get('/account/wishlist');
      state.wishlist = ids;
      saveWish();
    } catch { /* ignore */ }
  }
}
export async function logout() {
  await post('/auth/logout');
  state.user = null;
  emit('user', null);
}

// ---- search ----------------------------------------------------------------------------
const SYNONYMS = {
  hoody: 'hoodie', hoodies: 'hoodie', hood: 'hoodie', tee: 't-shirt', tees: 't-shirt', tshirt: 't-shirt', tshirts: 't-shirt', shirt: 't-shirt', shirts: 't-shirt',
  trousers: 'pants', trouser: 'pants', pant: 'pants', cargos: 'cargo', jean: 'jeans', denims: 'denim', sweatpants: 'joggers', jogger: 'joggers', trackpants: 'joggers',
  sweater: 'sweatshirt', jumper: 'sweatshirt', crewneck: 'sweatshirt', sweatshirts: 'sweatshirt', jackets: 'jacket', coat: 'jacket', caps: 'cap', hat: 'cap', hats: 'cap',
  dresses: 'dress', short: 'shorts', grey: 'grey', gray: 'grey', white: 'white', cream: 'bone', beige: 'sand', khaki: 'sand', tan: 'sand', ladies: 'women', womens: 'women', female: 'women', mens: 'men', male: 'men', guys: 'men',
  tracksuits: 'tracksuit', bags: 'bag', beanies: 'beanie', collab: 'sharon',
};
const norm = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, ' ');
const tokens = (s) => norm(s).split(/[\s]+/).filter(Boolean).map((t) => SYNONYMS[t] || t);

function haystack(p) {
  if (!p._hay) {
    p._hay = norm([p.name, categoryLabel(p.category), p.category, p.tags, p.gender, p.colors.map((c) => c.name).join(' '), p.collections.map(collectionName).join(' ')].join(' '))
      .split(/\s+/).filter(Boolean);
  }
  return p._hay;
}

/** Score-ranked product search. Every query token must match (prefix) something. */
export function searchProducts(q, limit = 60) {
  const ts = tokens(q);
  if (!ts.length) return [];
  const out = [];
  for (const p of state.products) {
    const hay = haystack(p);
    let score = 0;
    let ok = true;
    for (const t of ts) {
      const exact = hay.includes(t);
      const prefix = exact || hay.some((w) => w.startsWith(t) || (t.length > 3 && w.startsWith(t.slice(0, -1))));
      if (!prefix) { ok = false; break; }
      score += exact ? 3 : 1;
      if (norm(p.name).includes(t)) score += 2;
    }
    if (ok) out.push({ p, score: score + (p.featured ? 0.5 : 0) });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.p);
}
