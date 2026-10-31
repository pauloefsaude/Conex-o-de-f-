// Uso: npm run create-admin -- email@exemplo.com SenhaForte123 [admin|moderator]
import { openDb, audit } from './db.js';
import { hashPassword, newId } from './security.js';

const [email, password, role = 'admin'] = process.argv.slice(2);
if (!email || !password || password.length < 10 || !['admin', 'moderator'].includes(role)) {
  console.error('Uso: npm run create-admin -- email senha(min. 10) [admin|moderator]');
  process.exit(1);
}
const db = openDb();
const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
if (existing) {
  db.prepare('UPDATE users SET role = ?, password_hash = ? WHERE id = ?').run(role, hashPassword(password), existing.id);
  audit(db, null, 'cli_role_set', existing.id, { role });
  console.log(`Usuário existente promovido a ${role}.`);
} else {
  const id = newId();
  db.prepare(`INSERT INTO users (id, email, password_hash, birthdate, role, email_verified, terms_accepted_at, sensitive_consent_at)
    VALUES (?,?,?,?,?,1, datetime('now'), datetime('now'))`).run(id, email.toLowerCase(), hashPassword(password), '1990-01-01', role);
  db.prepare('INSERT INTO profiles (user_id, display_name) VALUES (?, ?)').run(id, 'Equipe');
  db.prepare('INSERT INTO preferences (user_id) VALUES (?)').run(id);
  audit(db, null, 'cli_admin_created', id, { role });
  console.log(`Conta ${role} criada: ${email}`);
}
