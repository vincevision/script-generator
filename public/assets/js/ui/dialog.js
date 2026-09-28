// <dialog> helpers: open with rich HTML, close on backdrop / ESC / [data-close-dialog].
import { $ } from '../lib/dom.js';

function wire(d) {
  if (d.dataset.wired) return;
  d.dataset.wired = '1';
  d.addEventListener('click', (e) => {
    if (e.target === d || e.target.closest('[data-close-dialog]')) closeDialog(d);
  });
  d.addEventListener('cancel', (e) => { e.preventDefault(); closeDialog(d); });
}

export function openDialog(content, { cls = '', label = 'Dialog', onClose } = {}) {
  const d = $('#dialog');
  wire(d);
  d.className = `modal ${cls}`;
  d.setAttribute('aria-label', label);
  d.innerHTML = `<button class="modal__close" type="button" data-close-dialog aria-label="Close"><svg class="icon"><use href="#i-close"/></svg></button>${content}`;
  d._onClose = onClose;
  if (!d.open) d.showModal();
  document.documentElement.classList.add('has-dialog');
  return d;
}

export function openExisting(d) {
  wire(d);
  if (!d.open) d.showModal();
  document.documentElement.classList.add('has-dialog');
  return d;
}

export function closeDialog(d = $('#dialog')) {
  if (!d.open) return;
  d.classList.add('is-closing');
  setTimeout(() => {
    d.classList.remove('is-closing');
    d.close();
    if (!document.querySelector('dialog[open]')) document.documentElement.classList.remove('has-dialog');
    d._onClose?.();
  }, 220);
}
