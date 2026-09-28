// Admin sign-in. Authentication and the admin role are verified server-side;
// the CMS script itself (/admin/app.js) is only served to an admin session.
const form = document.getElementById('login');
const error = document.getElementById('error');

async function call(path, body) {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Epic-Request': '1' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Sign in failed.');
  return data;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  error.textContent = '';
  const btn = form.querySelector('button');
  const { email, password } = Object.fromEntries(new FormData(form));
  if (!email || !password) { error.textContent = 'Enter your email and password.'; return; }
  btn.disabled = true;
  btn.textContent = 'Signing in…';
  try {
    const { user } = await call('/auth/login', { email, password });
    if (user.role !== 'admin') {
      await call('/auth/logout').catch(() => {});
      throw new Error('This account does not have admin access.');
    }
    location.reload();
  } catch (err) {
    error.textContent = err.message;
    btn.disabled = false;
    btn.textContent = 'Sign in';
  }
});
