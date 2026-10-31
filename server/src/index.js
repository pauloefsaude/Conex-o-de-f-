import { createApp } from './app.js';
import { config } from './config.js';
import { hashPassword, newId } from './security.js';
import { audit } from './db.js';

const { server, db } = createApp();

// Cria a primeira conta de administração a partir de variáveis de ambiente (útil na hospedagem, sem terminal).
const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const adminPass = process.env.ADMIN_PASSWORD || '';
if (adminEmail && adminPass) {
  if (adminPass.length < 10) console.warn('[admin] ADMIN_PASSWORD precisa de 10+ caracteres; conta não criada.');
  else if (!db.prepare('SELECT 1 FROM users WHERE email = ?').get(adminEmail)) {
    const id = newId();
    db.prepare(`INSERT INTO users (id, email, password_hash, birthdate, role, email_verified, terms_accepted_at, sensitive_consent_at)
      VALUES (?,?,?,?, 'admin', 1, datetime('now'), datetime('now'))`).run(id, adminEmail, hashPassword(adminPass), '1990-01-01');
    db.prepare('INSERT INTO profiles (user_id, display_name) VALUES (?, ?)').run(id, 'Equipe');
    db.prepare('INSERT INTO preferences (user_id) VALUES (?)').run(id);
    audit(db, null, 'bootstrap_admin', id);
    console.log(`[admin] Conta de administração criada: ${adminEmail}`);
  }
}

server.listen(config.port, () => {
  console.log(`Conexão de Fé em ${config.publicUrl}`);
  console.log(`Painel administrativo: ${config.publicUrl}/admin`);
  if (!config.resendApiKey) console.log('E-mail: sem RESEND_API_KEY (confirmação e recuperação de senha desativadas).');
  if (config.devPremium) console.log('ATENÇÃO: DEV_PREMIUM=1 — premium de teste habilitado (não usar em produção).');
});
