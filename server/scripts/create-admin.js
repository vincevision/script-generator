// Create or reset an admin account from the command line:
//   npm run create-admin -- you@example.com "a-long-password" "Your Name"
import { db } from '../db.js';
import { hashPassword } from '../auth.js';

const [email, password, name = 'EPIC Admin'] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage: npm run create-admin -- <email> <password> [name]');
  process.exit(1);
}
if (password.length < 10) {
  console.error('Password must be at least 10 characters.');
  process.exit(1);
}
const hash = await hashPassword(password);
const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
if (existing) {
  db.prepare(`UPDATE users SET password_hash = ?, role = 'admin' WHERE id = ?`).run(hash, existing.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(existing.id);
  console.log(`✓ ${email} is an admin — password reset, existing sessions signed out.`);
} else {
  db.prepare(`INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, 'admin')`).run(email.toLowerCase(), name, hash);
  console.log(`✓ Admin account created for ${email}`);
}
