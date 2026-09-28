import { $, esc } from '../lib/dom.js';

/** toast('Added to bag', { icon: 'check', action: { label: 'View bag', onClick } }) */
export function toast(message, { icon = 'check', tone = '', action = null, image = '', timeout = 3800 } = {}) {
  const host = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast ${tone ? `toast--${tone}` : ''}`;
  el.innerHTML = `
    ${image ? `<span class="toast__img">${image}</span>` : `<span class="toast__icon"><svg class="icon"><use href="#i-${esc(icon)}"/></svg></span>`}
    <span class="toast__msg">${esc(message)}</span>
    ${action ? `<button type="button" class="toast__action">${esc(action.label)}</button>` : ''}
    <i class="toast__timer" style="animation-duration:${timeout}ms"></i>`;
  if (action) el.querySelector('.toast__action').addEventListener('click', () => { action.onClick(); dismiss(); });
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-in'));
  while (host.children.length > 3) host.firstElementChild.remove();
  let t = setTimeout(dismiss, timeout);
  el.addEventListener('pointerenter', () => clearTimeout(t));
  el.addEventListener('pointerleave', () => { t = setTimeout(dismiss, 1500); });
  function dismiss() {
    el.classList.remove('is-in');
    el.classList.add('is-out');
    setTimeout(() => el.remove(), 450);
  }
  return dismiss;
}
