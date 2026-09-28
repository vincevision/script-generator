// JSON API client. Adds the CSRF header required by the server for every
// state-changing request. Session auth rides on an httpOnly cookie — no
// tokens or secrets ever live in JavaScript.
export class ApiError extends Error {
  constructor(message, status, field) { super(message); this.status = status; this.field = field; }
}

export async function api(path, { method = 'GET', body, headers = {}, signal } = {}) {
  const opts = { method, headers: { Accept: 'application/json', ...headers }, credentials: 'same-origin', signal };
  if (method !== 'GET') opts.headers['X-EPIC-Request'] = '1';
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(`/api${path}`, opts);
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError('You appear to be offline. Check your connection and try again.', 0);
  }
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) throw new ApiError(data?.error || 'Something went wrong. Please try again.', res.status, data?.field);
  return data;
}

export const get = (p, o) => api(p, o);
export const post = (p, body, o = {}) => api(p, { ...o, method: 'POST', body });
export const put = (p, body, o = {}) => api(p, { ...o, method: 'PUT', body });
export const del = (p, o = {}) => api(p, { ...o, method: 'DELETE' });
