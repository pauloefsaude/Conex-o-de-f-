import { v } from '../validate.js';
import { fail, enforceRate, tokenVersion } from '../http.js';
import { hashPassword, verifyPassword, signToken, newEmailToken, sha256, ageFrom, newId } from '../security.js';
import { sendMail, deletePhotoFile } from '../services.js';
import { config } from '../config.js';
import { tx, audit, json } from '../db.js';
import { ownProfile, isPremium } from '../profiles.js';

const DUMMY_HASH = hashPassword('senha-falsa-para-tempo-constante1');

export function sessionFor(user) {
  return signToken({ sub: user.id, role: user.role, tv: tokenVersion(user.password_hash) });
}

export function meView(db, user) {
  return {
    id: user.id, email: user.email, role: user.role, emailVerified: !!user.email_verified,
    premium: isPremium(user), premiumUntil: user.premium_until, settings: json(user.settings, {}),
    profile: ownProfile(db, user.id), devPremiumAvailable: config.devPremium,
  };
}

async function issueEmailToken(db, userId, email, kind) {
  const { token, hash } = newEmailToken();
  const hours = kind === 'verify' ? 48 : 1;
  db.prepare("DELETE FROM email_tokens WHERE user_id = ? AND kind = ?").run(userId, kind);
  db.prepare("INSERT INTO email_tokens (token_hash, user_id, kind, expires_at) VALUES (?,?,?, datetime('now', ?))")
    .run(hash, userId, kind, `+${hours} hours`);
  const link = kind === 'verify'
    ? `${config.publicUrl}/verificar-email?token=${token}`
    : `${config.publicUrl}/redefinir-senha?token=${token}`;
  const subject = kind === 'verify' ? 'Confirme seu e-mail — Conexão de Fé' : 'Redefinição de senha — Conexão de Fé';
  const text = kind === 'verify'
    ? `Olá! Para confirmar seu e-mail, acesse:\n${link}\n\nSe você não criou uma conta, ignore esta mensagem.`
    : `Recebemos um pedido para redefinir sua senha. O link vale por 1 hora:\n${link}\n\nSe não foi você, ignore esta mensagem.`;
  await sendMail(email, subject, text);
  return token;
}

function consumeEmailToken(db, token, kind) {
  const row = db.prepare("SELECT user_id FROM email_tokens WHERE token_hash = ? AND kind = ? AND expires_at > datetime('now')")
    .get(sha256(String(token || '')), kind);
  if (!row) fail(400, 'Link inválido ou expirado.');
  db.prepare('DELETE FROM email_tokens WHERE token_hash = ?').run(sha256(token));
  return row.user_id;
}

export default function authRoutes(r, db) {
  r.post('/api/auth/register', async ({ req, body }) => {
    enforceRate(req, 'register', 10, 3600_000);
    const email = v.email(body.email);
    const password = v.password(body.password);
    const birthdate = v.date(body.birthdate, 'Data de nascimento');
    const age = ageFrom(birthdate);
    if (age < 18) fail(403, 'O Conexão de Fé é exclusivo para maiores de 18 anos.', 'underage');
    if (age > 110) fail(400, 'Data de nascimento inválida.');
    if (!v.bool(body.acceptTerms) || !v.bool(body.acceptPrivacy)) fail(400, 'É preciso aceitar os Termos de Uso e a Política de Privacidade.');
    if (!v.bool(body.acceptSensitiveData)) fail(400, 'É preciso consentir com o tratamento de informações religiosas (dado sensível, LGPD art. 11).');

    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) fail(409, 'Já existe uma conta com este e-mail.', 'email_taken');

    const id = newId();
    const hash = hashPassword(password);
    tx(db, () => {
      db.prepare(`INSERT INTO users (id, email, password_hash, birthdate, terms_accepted_at, sensitive_consent_at)
                  VALUES (?,?,?,?, datetime('now'), datetime('now'))`).run(id, email, hash, birthdate);
      db.prepare('INSERT INTO profiles (user_id) VALUES (?)').run(id);
      db.prepare('INSERT INTO preferences (user_id) VALUES (?)').run(id);
    });
    const devToken = await issueEmailToken(db, id, email, 'verify');
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    return { status: 201, data: { token: sessionFor(user), me: meView(db, user), ...(config.isProd ? {} : { devVerifyToken: devToken }) } };
  });

  r.post('/api/auth/login', async ({ req, body }) => {
    enforceRate(req, 'login', 10, 15 * 60_000);
    const email = String(body.email || '').trim().toLowerCase();
    enforceRate(req, 'login-email', 8, 15 * 60_000, email);
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    const ok = verifyPassword(String(body.password || ''), user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) fail(401, 'E-mail ou senha incorretos.');
    if (user.status === 'suspended') fail(403, 'Esta conta está suspensa. Fale com o suporte.', 'suspended');
    db.prepare("UPDATE users SET last_active_at = datetime('now') WHERE id = ?").run(user.id);
    return { token: sessionFor(user), me: meView(db, user) };
  });

  r.post('/api/auth/verify-email', async ({ body }) => {
    const userId = consumeEmailToken(db, body.token, 'verify');
    db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(userId);
    return { ok: true };
  });

  r.post('/api/auth/resend-verification', async ({ req, user }) => {
    enforceRate(req, 'resend', 3, 3600_000, user.id);
    if (user.email_verified) return { ok: true, alreadyVerified: true };
    const t = await issueEmailToken(db, user.id, user.email, 'verify');
    return { ok: true, ...(config.isProd ? {} : { devVerifyToken: t }) };
  }, { auth: true, allowIncomplete: true });

  r.post('/api/auth/forgot-password', async ({ req, body }) => {
    enforceRate(req, 'forgot', 5, 3600_000);
    const email = String(body.email || '').trim().toLowerCase();
    const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email);
    let devResetToken;
    if (user) devResetToken = await issueEmailToken(db, user.id, user.email, 'reset');
    // Resposta idêntica exista ou não a conta (evita descobrir e-mails cadastrados).
    return { ok: true, message: 'Se o e-mail estiver cadastrado, enviaremos um link.', ...(config.isProd || !devResetToken ? {} : { devResetToken }) };
  });

  r.post('/api/auth/reset-password', async ({ body }) => {
    const password = v.password(body.password);
    const userId = consumeEmailToken(db, body.token, 'reset');
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), userId);
    audit(db, userId, 'password_reset', userId);
    return { ok: true };
  });

  r.get('/api/me', async ({ user }) => meView(db, user), { auth: true, allowIncomplete: true });

  r.put('/api/me/settings', async ({ user, body }) => {
    const cur = json(user.settings, {});
    const next = {
      notifyMatches: body.notifyMatches ?? cur.notifyMatches,
      notifyMessages: body.notifyMessages ?? cur.notifyMessages,
      showInDiscovery: body.showInDiscovery ?? cur.showInDiscovery,
    };
    for (const k of Object.keys(next)) next[k] = next[k] !== false;
    db.prepare('UPDATE users SET settings = ? WHERE id = ?').run(JSON.stringify(next), user.id);
    return { settings: next };
  }, { auth: true, allowIncomplete: true });

  // Exclusão de conta e dados (LGPD art. 18, VI). Exige senha.
  r.delete('/api/me', async ({ user, body }) => {
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id);
    if (!verifyPassword(String(body.password || ''), row.password_hash)) fail(401, 'Senha incorreta.');
    const files = db.prepare('SELECT file FROM photos WHERE user_id = ?').all(user.id).map((p) => p.file);
    tx(db, () => {
      // Denúncias feitas sobre a pessoa ficam (sem vínculo) por segurança de terceiros.
      db.prepare("UPDATE reports SET details = '[conta excluída] ' || COALESCE(details,'') WHERE reported_id = ?").run(user.id);
      db.prepare('DELETE FROM users WHERE id = ?').run(user.id); // CASCADE apaga o restante
    });
    files.forEach(deletePhotoFile);
    audit(db, null, 'account_deleted', null, { at: new Date().toISOString() });
    return { ok: true };
  }, { auth: true, allowIncomplete: true });
}
