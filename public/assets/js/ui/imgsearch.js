// SEARCH WITH IMAGE — upload a photo or use the camera to find visually
// similar EPIC products. Runs entirely on the device (the photo is never
// uploaded): we separate the garment from its background, then compare
// colour distribution, tone and silhouette against every product image.
import { $, html, raw, icon, pic, money, esc, imgUrl, reduced } from '../lib/dom.js';
import { state, loadCatalog, categoryLabel } from '../lib/store.js';
import { openExisting, closeDialog } from './dialog.js';

const dlg = () => $('#imgSearch');
const body = () => $('#imgSearchBody');
let stream = null;
const productFeatures = new Map();

const HUE_NAMES = ['Red', 'Orange', 'Sand', 'Yellow', 'Lime', 'Green', 'Teal', 'Cyan', 'Blue', 'Indigo', 'Purple', 'Pink'];
const HUE_HEX = ['#c8322a', '#e2742b', '#cdb992', '#e3c440', '#9bc53d', '#3f9b4f', '#2f9c8f', '#3ab0c9', '#3a6fd1', '#4b4fb3', '#8a4fbf', '#d9589a'];
const TONE_NAMES = ['Black', 'Charcoal', 'Grey', 'White'];
const TONE_HEX = ['#0b0b0c', '#3a3a3e', '#a9a9ab', '#eee9e1'];

/* ---------------- feature extraction ---------------- */
function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

function extract(source, sw, sh) {
  const MAX = 72;
  const k = MAX / Math.max(sw, sh);
  const w = Math.max(8, Math.round(sw * k)), h = Math.max(8, Math.round(sh * k));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;

  // background colour = mean of the outer ring of pixels
  let br = 0, bg = 0, bb = 0, bn = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (x > 1 && y > 1 && x < w - 2 && y < h - 2) continue;
    const i = (y * w + x) * 4; br += d[i]; bg += d[i + 1]; bb += d[i + 2]; bn++;
  }
  br /= bn; bg /= bn; bb /= bn;

  const hist = new Float32Array(16);
  const weights = new Float32Array(w * h);
  let wsum = 0, light = 0;
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const dist = Math.hypot(r - br, g - bg, b - bb);
    const nx = x / w - 0.5, ny = y / h - 0.5;
    const center = 0.55 + 0.45 * (1 - Math.min(1, Math.hypot(nx, ny) * 1.6));
    const wt = (1 / (1 + Math.exp(-(dist - 30) / 7))) * center;
    weights[y * w + x] = wt;
    if (wt < 0.15) continue;
    if (wt > 0.5) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    // HSV
    const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, v = mx, s = mx ? (mx - mn) / mx : 0;
    let bin;
    if (s < 0.2 || v < 0.16) bin = 12 + (v < 0.22 ? 0 : v < 0.45 ? 1 : v < 0.75 ? 2 : 3);
    else {
      let hh;
      const R = r / 255, G = g / 255, B = b / 255, dd = mx - mn;
      if (mx === R) hh = ((G - B) / dd) % 6; else if (mx === G) hh = (B - R) / dd + 2; else hh = (R - G) / dd + 4;
      hh = (hh * 60 + 360) % 360;
      bin = Math.floor(hh / 30) % 12;
      if (bin <= 2 && s < 0.45 && v > 0.55) bin = 2; // desaturated warm → sand
    }
    hist[bin] += wt; wsum += wt; light += v * wt;
  }
  if (wsum > 0) for (let i = 0; i < 16; i++) hist[i] /= wsum;

  // silhouette: foreground bounding box resampled to 16×16
  const mask = new Float32Array(256);
  if (maxX > minX && maxY > minY) {
    const bw = maxX - minX + 1, bh = maxY - minY + 1;
    for (let my = 0; my < 16; my++) for (let mxx = 0; mxx < 16; mxx++) {
      const x = Math.min(w - 1, minX + Math.floor(((mxx + 0.5) / 16) * bw));
      const y = Math.min(h - 1, minY + Math.floor(((my + 0.5) / 16) * bh));
      mask[my * 16 + mxx] = weights[y * w + x] > 0.5 ? 1 : 0;
    }
  }
  return { hist, mask, light: wsum ? light / wsum : 0.5, aspect: maxY > minY ? (maxX - minX + 1) / (maxY - minY + 1) : 1 };
}

function similarity(a, b) {
  let inter = 0;
  for (let i = 0; i < 16; i++) inter += Math.min(a.hist[i], b.hist[i]);
  let diff = 0;
  for (let i = 0; i < 256; i++) diff += Math.abs(a.mask[i] - b.mask[i]);
  const shape = 1 - diff / 256;
  const tone = 1 - Math.min(1, Math.abs(a.light - b.light) * 1.6);
  const aspect = 1 - Math.min(1, Math.abs(Math.log(a.aspect / b.aspect)));
  return inter * 0.58 + shape * 0.22 + tone * 0.12 + aspect * 0.08;
}

async function featuresFor(p) {
  const src = p.images[0];
  if (productFeatures.has(src)) return productFeatures.get(src);
  const f = loadImage(imgUrl(src, 480)).then((img) => extract(img, img.naturalWidth, img.naturalHeight)).catch(() => null);
  productFeatures.set(src, f);
  return f;
}

function dominant(hist) {
  return [...hist].map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v).filter((x) => x.v > 0.08).slice(0, 3)
    .map(({ i, v }) => (i < 12 ? { name: HUE_NAMES[i], hex: HUE_HEX[i], v } : { name: TONE_NAMES[i - 12], hex: TONE_HEX[i - 12], v }));
}

/* ---------------- UI ---------------- */
function stopCamera() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
}

function renderStart(error = '') {
  stopCamera();
  body().innerHTML = html`
    <p class="imgsearch__lead">Upload a photo of a look you like — or snap one with your camera — and we'll find EPIC pieces with a similar colour, tone and silhouette.</p>
    <label class="dropzone" id="dropzone" tabindex="0">
      <input type="file" accept="image/*" id="imgFile" hidden>
      <span class="dropzone__icon">${icon('image')}</span>
      <span class="dropzone__title">Drop a photo here</span>
      <span class="dropzone__sub">JPG, PNG, WebP or HEIC · analysed on your device, never uploaded</span>
    </label>
    <div class="imgsearch__actions">
      <button type="button" class="btn btn--primary" data-act="upload"><span class="btn__inner">${icon('upload')}<span>Upload photo</span></span></button>
      <button type="button" class="btn btn--ghost" data-act="camera"><span class="btn__inner">${icon('camera')}<span>Use camera</span></span></button>
    </div>
    <input type="file" accept="image/*" capture="environment" id="imgCapture" hidden>
    ${error ? html`<p class="form-error">${error}</p>` : ''}`.s;
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) return $('#imgCapture').click();
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false });
  } catch {
    return $('#imgCapture').click(); // permission denied / no camera → native picker
  }
  body().innerHTML = html`<div class="camera">
      <video id="camVideo" playsinline muted autoplay></video>
      <div class="camera__frame" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      <p class="camera__hint">Centre the garment in the frame</p>
    </div>
    <div class="imgsearch__actions">
      <button type="button" class="btn btn--primary" data-act="snap"><span class="btn__inner">${icon('camera')}<span>Capture</span></span></button>
      <button type="button" class="btn btn--ghost" data-act="back"><span class="btn__inner">${icon('arrow-left')}<span>Back</span></span></button>
    </div>`.s;
  const v = $('#camVideo');
  v.srcObject = stream;
}

function snap() {
  const v = $('#camVideo');
  if (!v?.videoWidth) return;
  const c = document.createElement('canvas');
  c.width = v.videoWidth; c.height = v.videoHeight;
  c.getContext('2d').drawImage(v, 0, 0);
  stopCamera();
  analyse(c.toDataURL('image/jpeg', 0.85));
}

function readFile(file) {
  if (!file) return;
  if (!/^image\//.test(file.type) && !/\.(heic|heif)$/i.test(file.name)) return renderStart('Please choose an image file.');
  if (file.size > 20 * 1024 * 1024) return renderStart('That image is too large (max 20 MB).');
  analyse(URL.createObjectURL(file));
}

async function analyse(src) {
  body().innerHTML = html`<div class="scan">
      <div class="scan__img"><img src="${src}" alt="Your photo"><i class="scan__line"></i><i class="scan__grid"></i></div>
      <p class="scan__status"><span class="pulse-dot"></span> Analysing colour, tone &amp; silhouette<span class="dots"><i>.</i><i>.</i><i>.</i></span></p>
    </div>`.s;
  try {
    const started = performance.now();
    const [img] = await Promise.all([loadImage(src), loadCatalog()]);
    const q = extract(img, img.naturalWidth, img.naturalHeight);
    const feats = await Promise.all(state.products.map(featuresFor));
    const scored = state.products.map((p, i) => ({ p, s: feats[i] ? similarity(q, feats[i]) : 0 })).sort((a, b) => b.s - a.s);
    const wait = reduced ? 0 : Math.max(0, 1100 - (performance.now() - started)); // let the scan read as intentional
    setTimeout(() => renderResults(src, q, scored.slice(0, 8)), wait);
  } catch {
    renderStart('We could not read that image. Try a JPG or PNG photo.');
  }
}

function renderResults(src, q, top) {
  const cols = dominant(q.hist);
  const best = top[0]?.s || 1;
  body().innerHTML = html`<div class="imgres">
    <div class="imgres__query">
      <img src="${src}" alt="Your photo">
      <div>
        <p class="imgres__label">Detected</p>
        <div class="imgres__swatches">${cols.map((c) => html`<span><i class="swatch" style="--c:${c.hex}"></i>${c.name}</span>`)}</div>
        <button type="button" class="linkish" data-act="again">${icon('camera')} Try another photo</button>
      </div>
    </div>
    <p class="imgres__label">Visually similar EPIC pieces</p>
    <ul class="imgres__grid">${top.map(({ p, s }, i) => html`<li style="--i:${i}">
      <a href="/product/${p.slug}" class="imgres__item" data-close-dialog-nav>
        <span class="imgres__img">${pic(p.images[0], { alt: p.name, sizes: '160px' })}<b class="imgres__match">${Math.round(Math.min(0.99, (s / best) * (0.55 + 0.4 * s)) * 100)}%</b></span>
        <span class="imgres__name">${p.name.replace(/^EPIC\s+(?!×)/, '')}</span>
        <span class="imgres__meta">${categoryLabel(p.category)} · ${money(p.price)}</span>
      </a></li>`)}</ul>
    <p class="imgres__note">${icon('shield')} Matched on colour, tone and shape. Your photo stayed on your device.</p>
  </div>`.s;
}

let wired = false;
export async function openImageSearch() {
  const d = dlg();
  if (!wired) {
    wired = true;
    d.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'upload') $('#imgFile').click();
      if (act === 'camera') startCamera();
      if (act === 'snap') snap();
      if (act === 'back' || act === 'again') renderStart();
      if (e.target.closest('[data-close-dialog-nav]')) { stopCamera(); closeDialog(d); }
      if (e.target.closest('[data-close-dialog]') || e.target === d) stopCamera();
    });
    d.addEventListener('change', (e) => { if (e.target.type === 'file') readFile(e.target.files[0]); });
    d.addEventListener('dragover', (e) => { e.preventDefault(); $('#dropzone')?.classList.add('is-over'); });
    d.addEventListener('dragleave', () => $('#dropzone')?.classList.remove('is-over'));
    d.addEventListener('drop', (e) => { e.preventDefault(); readFile(e.dataTransfer.files[0]); });
    d.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'dropzone') $('#imgFile').click(); });
    d.addEventListener('close', stopCamera);
  }
  renderStart();
  openExisting(d);
  loadCatalog().then(() => state.products.slice(0, 12).forEach(featuresFor)); // warm the cache
}

export { esc, raw };
