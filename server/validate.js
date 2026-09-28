// Input validation helpers. Everything coming from the browser is untrusted.
export class ValidationError extends Error {
  constructor(message, field) { super(message); this.status = 400; this.field = field; }
}

export function str(v, field, { min = 0, max = 500, required = true, label = field } = {}) {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
  if (!s && required) throw new ValidationError(`${label} is required.`, field);
  if (s && s.length < min) throw new ValidationError(`${label} is too short.`, field);
  if (s.length > max) throw new ValidationError(`${label} is too long.`, field);
  return s;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function email(v, field = 'email', { required = true } = {}) {
  const s = str(v, field, { max: 254, required, label: 'Email' }).toLowerCase();
  if (s && !EMAIL_RE.test(s)) throw new ValidationError('Please enter a valid email address.', field);
  return s;
}

/** Normalise a Kenyan mobile number to 2547XXXXXXXX / 2541XXXXXXXX, or null. */
export function kenyanPhone(v) {
  const d = String(v || '').replace(/[^\d+]/g, '').replace(/^\+/, '');
  let m;
  if ((m = d.match(/^(?:254|0)?([17]\d{8})$/))) return `254${m[1]}`;
  return null;
}

/** Accept a Kenyan number (normalised) or an international E.164-ish number. */
export function phone(v, field = 'phone', { required = true } = {}) {
  const raw = str(v, field, { max: 20, required, label: 'Phone number' });
  if (!raw) return '';
  const ke = kenyanPhone(raw);
  if (ke) return `+${ke}`;
  const digits = raw.replace(/[^\d]/g, '');
  if (raw.trim().startsWith('+') && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  throw new ValidationError('Please enter a valid phone number.', field);
}

export function int(v, field, { min = 0, max = 1e9, required = true } = {}) {
  if ((v === undefined || v === null || v === '') && !required) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new ValidationError(`${field} must be a whole number.`, field);
  return n;
}

export function oneOf(v, field, list) {
  if (!list.includes(v)) throw new ValidationError(`Invalid ${field}.`, field);
  return v;
}

export function password(v) {
  const s = typeof v === 'string' ? v : '';
  if (s.length < 8) throw new ValidationError('Password must be at least 8 characters.', 'password');
  if (s.length > 200) throw new ValidationError('Password is too long.', 'password');
  return s;
}

export const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 80);
