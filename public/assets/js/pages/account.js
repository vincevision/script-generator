// MY ACCOUNT — optional. Sign in / register, orders, addresses, profile, logout.
import { html, raw, icon, money, fmtDate, $, $$, formData, busy, setFieldErrors } from '../lib/dom.js';
import { get, post, put, del } from '../lib/api.js';
import { state, loadConfig, loadCatalog, setUser, logout } from '../lib/store.js';
import { observeReveals } from '../lib/fx.js';
import { toast } from '../ui/toast.js';
import { crumbs, field, selectField, emptyState, btn, statusPill, pageTitle } from './_shared.js';
import { trackResult } from './track.js';

const go = (p) => window.epicNavigate(p, { replace: true });

/* ------------------------------------------------------------------ signed out */
function authView(tab) {
  const reg = tab === 'register';
  return {
    title: pageTitle(reg ? 'Create account' : 'Sign in'),
    html: html`
<section class="container auth">
  <div class="auth__card co-card">
    <svg class="auth__logo" viewBox="0 0 334 100" role="img" aria-label="EPIC WEAR"><use href="#epic-logo"/></svg>
    <div class="tabs" role="tablist">
      <a class="tab ${reg ? '' : 'is-active'}" href="/account/signin" role="tab" aria-selected="${!reg}">Sign in</a>
      <a class="tab ${reg ? 'is-active' : ''}" href="/account/register" role="tab" aria-selected="${reg}">Create account</a>
    </div>
    <h1 class="auth__title">${reg ? 'Join EPIC.' : 'Welcome back.'}</h1>
    <p class="auth__text">${reg ? 'Track orders, save addresses and keep your wishlist on every device. It is optional — guest checkout always works.' : 'Sign in to see your orders, addresses and wishlist.'}</p>
    <form class="form" data-auth novalidate>
      <div class="form-grid" style="grid-template-columns:1fr">
        ${reg ? field({ name: 'name', label: 'Full name', autocomplete: 'name' }) : ''}
        ${field({ name: 'email', label: 'Email', type: 'email', autocomplete: 'email' })}
        ${reg ? field({ name: 'phone', label: 'Phone', type: 'tel', autocomplete: 'tel', required: false, placeholder: '07XX XXX XXX' }) : ''}
        ${field({ name: 'password', label: 'Password', type: 'password', autocomplete: reg ? 'new-password' : 'current-password', hint: reg ? 'At least 8 characters.' : '', attrs: 'minlength="8"' })}
      </div>
      <p class="form-error" data-error role="alert"></p>
      <button type="submit" class="btn btn--primary btn--block magnetic" data-cursor="button"><span class="btn__inner"><span>${reg ? 'Create account' : 'Sign in'}</span>${icon('arrow', 'icon--arrow')}</span></button>
    </form>
    <p class="auth__alt">${reg ? html`Already have an account? <a class="linkish" href="/account/signin">Sign in</a>` : html`New to EPIC? <a class="linkish" href="/account/register">Create an account</a>`}</p>
    <p class="auth__alt"><a class="linkish" href="/track">${icon('truck')}Track an order without an account</a></p>
  </div>
</section>`,
    init(el) {
      const form = $('[data-auth]', el);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = $('[data-error]', el);
        err.textContent = '';
        const b = $('button[type=submit]', form);
        busy(b, true);
        try {
          const { user } = await post(reg ? '/auth/register' : '/auth/login', formData(form));
          await setUser(user, true);
          toast(reg ? `Welcome to EPIC, ${user.name.split(' ')[0]}` : `Welcome back, ${user.name.split(' ')[0]}`, { icon: 'user' });
          const next = new URLSearchParams(location.search).get('next');
          go(next && next.startsWith('/') && !next.startsWith('//') ? next : '/account/orders');
        } catch (ex) {
          busy(b, false);
          if (!setFieldErrors(form, ex)) err.textContent = ex.message;
        }
      });
    },
  };
}

/* ------------------------------------------------------------------ signed in */
const TABS = [['orders', 'Orders', 'package'], ['addresses', 'Addresses', 'pin'], ['profile', 'Profile', 'user']];

const orderRow = (o) => html`<details class="order-row">
  <summary>
    <span class="order-row__num">${o.number}</span>
    <span class="order-row__date">${fmtDate(o.createdAt)}</span>
    <span class="order-row__items">${o.items.reduce((a, l) => a + l.qty, 0)} items</span>
    ${statusPill(o.status)}
    <span class="order-row__total">${money(o.total)}</span>
    ${icon('chevron', 'order-row__chev')}
  </summary>
  <div class="order-row__body">${trackResult(o)}</div>
</details>`;

async function ordersPanel() {
  const [{ orders }] = await Promise.all([get('/account/orders'), loadCatalog()]);
  if (!orders.length) return emptyState({ iconName: 'package', title: 'No orders yet', text: 'When you order while signed in, it appears here with live tracking.', action: btn('Shop the latest drop', { href: '/new-drop' }) });
  return html`<div class="orders">${orders.map(orderRow)}</div>`;
}

async function addressesPanel() {
  const [{ addresses }, cfg] = await Promise.all([get('/account/addresses'), loadConfig()]);
  return html`<div class="addr-grid" data-addr-grid>
    ${addresses.map((a) => html`<article class="addr ${a.isDefault ? 'is-default' : ''}" data-id="${a.id}">
      <p class="addr__label">${icon('pin')}${a.label}${a.isDefault ? html`<span class="addr__def">Default</span>` : ''}</p>
      <p><b>${a.name}</b><br>${a.address}<br>${a.city}${a.county ? `, ${a.county}` : ''}<br>${a.country}<br>${a.phone}</p>
      <div class="addr__actions">
        <button type="button" class="linkish" data-addr-edit>${icon('edit')}Edit</button>
        ${a.isDefault ? '' : html`<button type="button" class="linkish" data-addr-default>Make default</button>`}
        <button type="button" class="linkish" data-addr-del>${icon('trash')}Remove</button>
      </div>
    </article>`)}
    ${addresses.length < 10 ? html`<button type="button" class="addr addr--new" data-addr-new>${icon('plus')}<span>Add address</span></button>` : ''}
  </div>
  <form class="co-card panel-form" data-addr-form hidden novalidate>
    <h3 class="co-card__title" data-addr-title>New address</h3>
    <input type="hidden" name="id">
    <div class="form-grid">
      ${field({ name: 'label', label: 'Label', required: false, placeholder: 'Home, Office…' })}
      ${field({ name: 'name', label: 'Full name', autocomplete: 'name', value: state.user.name })}
      ${field({ name: 'phone', label: 'Phone', type: 'tel', autocomplete: 'tel', value: state.user.phone || '' })}
      ${selectField({ name: 'country', label: 'Country', options: ['Kenya', 'Uganda', 'Tanzania', 'Rwanda', 'United Kingdom', 'United States', 'United Arab Emirates', 'Other'], value: 'Kenya' })}
      ${field({ name: 'address', label: 'Address', autocomplete: 'street-address', span: true })}
      ${field({ name: 'city', label: 'City / town', autocomplete: 'address-level2' })}
      ${selectField({ name: 'county', label: 'County', required: false, options: [['', '—'], ...cfg.counties.map((c) => [c, c])] })}
      <label class="check span-2"><input type="checkbox" name="isDefault" value="1"><span class="check__box">${icon('check')}</span>Use as my default delivery address</label>
    </div>
    <p class="form-error" data-error role="alert"></p>
    <div class="co-actions">
      <button type="button" class="linkish" data-addr-cancel>Cancel</button>
      <button type="submit" class="btn btn--primary"><span class="btn__inner"><span>Save address</span></span></button>
    </div>
  </form>`;
}

function profilePanel() {
  const u = state.user;
  return html`<div class="profile-grid">
    <form class="co-card panel-form" data-profile novalidate>
      <h3 class="co-card__title"><span>[01]</span> Profile</h3>
      <div class="form-grid" style="grid-template-columns:1fr">
        ${field({ name: 'name', label: 'Full name', value: u.name, autocomplete: 'name' })}
        <label class="field"><span class="field__label">Email</span><input class="input" value="${u.email}" disabled><span class="field__hint">Contact us to change your email.</span></label>
        ${field({ name: 'phone', label: 'Phone', type: 'tel', value: u.phone || '', required: false, autocomplete: 'tel' })}
      </div>
      <p class="form-error" data-error role="alert"></p>
      <button type="submit" class="btn btn--primary"><span class="btn__inner"><span>Save profile</span></span></button>
    </form>
    <form class="co-card panel-form" data-password novalidate>
      <h3 class="co-card__title"><span>[02]</span> Password</h3>
      <div class="form-grid" style="grid-template-columns:1fr">
        ${field({ name: 'current', label: 'Current password', type: 'password', autocomplete: 'current-password' })}
        ${field({ name: 'next', label: 'New password', type: 'password', autocomplete: 'new-password', hint: 'At least 8 characters.', attrs: 'minlength="8"' })}
      </div>
      <p class="form-error" data-error role="alert"></p>
      <button type="submit" class="btn btn--ghost"><span class="btn__inner"><span>Change password</span></span></button>
    </form>
  </div>`;
}

async function accountView(tab) {
  const [key, label] = TABS.find(([k]) => k === tab) || TABS[0];
  const panel = key === 'orders' ? await ordersPanel() : key === 'addresses' ? await addressesPanel() : profilePanel();
  const first = state.user.name.split(' ')[0];
  return {
    title: pageTitle(`My account — ${label}`),
    html: html`
<header class="phero container">
  ${crumbs([['Home', '/'], ['Account', '/account'], [label]])}
  <p class="eyebrow hero-in" style="--d:0"><span>[Account]</span> ${state.user.email}</p>
  <h1 class="phero__title account__hello" data-split>Hi, ${first}.</h1>
</header>
<div class="container account">
  <nav class="account__nav" aria-label="Account">
    ${TABS.map(([k, l, ic]) => html`<a href="/account/${k}" class="${k === key ? 'is-active' : ''}" ${raw(k === key ? 'aria-current="page"' : '')}>${icon(ic)}${l}</a>`)}
    <a href="/wishlist">${icon('heart')}Wishlist</a>
    <a href="/track">${icon('truck')}Track order</a>
    <button type="button" data-logout>${icon('logout')}Sign out</button>
  </nav>
  <section class="account__panel" data-panel aria-label="${label}">${panel}</section>
</div>`,
    init(el) {
      $('[data-logout]', el).addEventListener('click', async (e) => {
        busy(e.currentTarget, true);
        try { await logout(); } catch { /* ignore */ }
        toast('Signed out', { icon: 'logout' });
        go('/account/signin');
      });
      if (key === 'addresses') initAddresses(el);
      if (key === 'profile') initProfile(el);
    },
  };
}

function initAddresses(el) {
  const panel = $('[data-panel]', el);
  let list = [];
  get('/account/addresses').then((r) => { list = r.addresses; }).catch(() => {});
  const rerender = async () => {
    panel.innerHTML = (await addressesPanel()).s;
    const r = await get('/account/addresses'); list = r.addresses;
    observeReveals(panel);
  };
  const form = () => $('[data-addr-form]', panel);
  const openForm = (a) => {
    const f = form();
    f.reset();
    $('[data-addr-title]', f).textContent = a ? 'Edit address' : 'New address';
    if (a) for (const [k, v] of Object.entries(a)) { const inp = f.elements[k]; if (!inp) continue; inp.type === 'checkbox' ? (inp.checked = !!v) : (inp.value = v ?? ''); }
    else f.elements.id.value = '';
    f.hidden = false;
    f.scrollIntoView({ behavior: 'smooth', block: 'center' });
    f.elements.label.focus({ preventScroll: true });
  };
  panel.addEventListener('click', async (e) => {
    const t = e.target;
    const card = t.closest('[data-id]');
    const a = card && list.find((x) => String(x.id) === card.dataset.id);
    if (t.closest('[data-addr-new]')) openForm(null);
    else if (t.closest('[data-addr-cancel]')) form().hidden = true;
    else if (t.closest('[data-addr-edit]') && a) openForm(a);
    else if (t.closest('[data-addr-default]') && a) { await put(`/account/addresses/${a.id}`, { ...a, isDefault: true }); toast('Default address updated', { icon: 'pin' }); rerender(); }
    else if (t.closest('[data-addr-del]') && a) {
      card.classList.add('is-leaving');
      await del(`/account/addresses/${a.id}`);
      toast('Address removed', { icon: 'trash' });
      rerender();
    }
  });
  panel.addEventListener('submit', async (e) => {
    if (!e.target.matches('[data-addr-form]')) return;
    e.preventDefault();
    const f = e.target;
    const d = formData(f);
    d.isDefault = !!d.isDefault;
    const b = $('button[type=submit]', f);
    busy(b, true);
    try {
      d.id ? await put(`/account/addresses/${d.id}`, d) : await post('/account/addresses', d);
      toast('Address saved', { icon: 'pin' });
      await rerender();
    } catch (ex) {
      busy(b, false);
      if (!setFieldErrors(f, ex)) $('[data-error]', f).textContent = ex.message;
    }
  });
}

function initProfile(el) {
  const handle = (sel, fn) => $(sel, el).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const b = $('button[type=submit]', f);
    $('[data-error]', f).textContent = '';
    busy(b, true);
    try { await fn(formData(f), f); } catch (ex) { if (!setFieldErrors(f, ex)) $('[data-error]', f).textContent = ex.message; } finally { busy(b, false); }
  });
  handle('[data-profile]', async (d) => {
    const { user } = await put('/account/profile', d);
    state.user = { ...state.user, ...user };
    toast('Profile saved', { icon: 'user' });
  });
  handle('[data-password]', async (d, f) => {
    await put('/account/password', d);
    f.reset();
    toast('Password changed', { icon: 'lock' });
  });
}

export default async function account({ params }) {
  const tab = params.tab || '';
  if (!state.user) return authView(tab === 'register' ? 'register' : 'signin');
  if (tab === 'signin' || tab === 'register') return accountView('orders');
  return accountView(tab);
}
