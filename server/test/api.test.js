import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-test-'));
process.env.DB_FILE = path.join(tmp, 'test.db');
process.env.UPLOAD_DIR = path.join(tmp, 'uploads');
process.env.DEV_PREMIUM = '1';
process.env.FREE_DAILY_LIKES = '3';
process.env.RATE_LIMIT_SCALE = '100';

const { createApp } = await import('../src/app.js');
const { hashPassword } = await import('../src/security.js');

let app, base;
before(async () => {
  app = createApp();
  await new Promise((r) => app.server.listen(0, r));
  base = `http://127.0.0.1:${app.server.address().port}`;
});
after(() => { app.server.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

async function call(method, p, body, token) {
  const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json() };
}
let n = 0;
async function newUser(gender, extra = {}) {
  n++;
  const email = `u${n}@teste.com`;
  const r = await call('POST', '/api/auth/register', { email, password: 'Senha1234', birthdate: '1995-05-05', acceptTerms: true, acceptPrivacy: true, acceptSensitiveData: true });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const token = r.data.token;
  const p = await call('PUT', '/api/me/profile', { displayName: `Pessoa ${n}`, gender, seeking: gender === 'man' ? 'woman' : 'man', cityKey: 'sao-paulo-sp',
    relationshipGoal: 'Namoro sério', interests: ['Música', 'Café'], values: ['Família'], wantsChildren: 'Quero ter', ...extra }, token);
  assert.equal(p.status, 200, JSON.stringify(p.data));
  return { token, id: r.data.me.id, email, verify: r.data.devVerifyToken };
}

test('cadastro recusa menores de 18 e exige consentimentos', async () => {
  const y = new Date().getFullYear() - 17;
  let r = await call('POST', '/api/auth/register', { email: 'menor@teste.com', password: 'Senha1234', birthdate: `${y}-01-01`, acceptTerms: true, acceptPrivacy: true, acceptSensitiveData: true });
  assert.equal(r.status, 403); assert.equal(r.data.code, 'underage');
  r = await call('POST', '/api/auth/register', { email: 'x@teste.com', password: 'Senha1234', birthdate: '1990-01-01', acceptTerms: true, acceptPrivacy: true });
  assert.equal(r.status, 400);
  r = await call('POST', '/api/auth/register', { email: 'x@teste.com', password: 'curta', birthdate: '1990-01-01', acceptTerms: true, acceptPrivacy: true, acceptSensitiveData: true });
  assert.equal(r.status, 400);
});

test('senha nunca fica em texto simples; login e confirmação de e-mail', async () => {
  const u = await newUser('woman');
  const row = app.db.prepare('SELECT password_hash FROM users WHERE id = ?').get(u.id);
  assert.match(row.password_hash, /^scrypt\$/);
  assert.ok(!row.password_hash.includes('Senha1234'));
  assert.equal((await call('POST', '/api/auth/login', { email: u.email, password: 'errada123' })).status, 401);
  assert.equal((await call('POST', '/api/auth/login', { email: u.email, password: 'Senha1234' })).status, 200);
  assert.equal((await call('POST', '/api/auth/verify-email', { token: u.verify })).status, 200);
  assert.equal((await call('POST', '/api/auth/verify-email', { token: u.verify })).status, 400, 'token só pode ser usado uma vez');
  assert.equal((await call('GET', '/api/me', null, u.token)).data.emailVerified, true);
});

test('redefinir senha invalida sessões antigas', async () => {
  const u = await newUser('man');
  const f = await call('POST', '/api/auth/forgot-password', { email: u.email });
  assert.ok(f.data.devResetToken);
  const unknown = await call('POST', '/api/auth/forgot-password', { email: 'naoexiste@teste.com' });
  assert.equal(unknown.data.message, f.data.message, 'não revela se o e-mail existe');
  assert.equal((await call('POST', '/api/auth/reset-password', { token: f.data.devResetToken, password: 'NovaSenha99' })).status, 200);
  assert.equal((await call('GET', '/api/me', null, u.token)).status, 401);
  assert.equal((await call('POST', '/api/auth/login', { email: u.email, password: 'NovaSenha99' })).status, 200);
});

test('rotas sem token e token adulterado são recusadas', async () => {
  assert.equal((await call('GET', '/api/discover')).status, 401);
  const u = await newUser('woman');
  const [h, b, s] = u.token.split('.');
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(b, 'base64url')), role: 'admin' })).toString('base64url');
  assert.equal((await call('GET', '/api/me', null, `${h}.${forged}.${s}`)).status, 401);
  assert.equal((await call('GET', '/api/admin/metrics', null, u.token)).status, 403);
});

test('perfil incompleto não acessa descoberta; dados sensíveis ocultos por padrão', async () => {
  const r = await call('POST', '/api/auth/register', { email: 'incompleto@teste.com', password: 'Senha1234', birthdate: '1990-01-01', acceptTerms: true, acceptPrivacy: true, acceptSensitiveData: true });
  assert.equal((await call('GET', '/api/discover', null, r.data.token)).status, 409);
  assert.equal((await call('GET', '/api/me', null, r.data.token)).status, 200, 'perfil incompleto ainda lê a própria conta');

  const w = await newUser('woman', { denomination: 'Batista' });
  const m = await newUser('man');
  const d = await call('GET', '/api/discover', null, m.token);
  const seen = d.data.profiles.find((p) => p.id === w.id);
  assert.ok(seen, 'mulher aparece para homem');
  assert.equal(seen.denomination, null, 'denominação oculta por padrão');
  assert.equal(seen.email, undefined); assert.equal(seen.birthdate, undefined); assert.equal(seen.lat, undefined);
  assert.ok(seen.reasons.length > 0, 'compatibilidade explicada');

  await call('PUT', '/api/me/profile', { visibility: { denomination: true } }, w.token);
  const d2 = await call('GET', '/api/discover', null, m.token);
  assert.equal(d2.data.profiles.find((p) => p.id === w.id).denomination, 'Batista');
});

test('biografia com telefone ou link é recusada', async () => {
  const u = await newUser('woman');
  assert.equal((await call('PUT', '/api/me/profile', { bio: 'me chama no whats (11) 98888-7777' }, u.token)).status, 400);
  assert.equal((await call('PUT', '/api/me/profile', { bio: 'Gosto de louvor e de café.' }, u.token)).status, 200);
});

test('combinação mútua libera conversa; sem combinação não há chat', async () => {
  const a = await newUser('woman'), b = await newUser('man');
  let r = await call('POST', '/api/swipes', { toUserId: b.id, action: 'like' }, a.token);
  assert.equal(r.data.matched, false);
  assert.equal((await call('GET', '/api/matches', null, a.token)).data.matches.length, 0);
  r = await call('POST', '/api/swipes', { toUserId: a.id, action: 'like' }, b.token);
  assert.equal(r.data.matched, true);
  const matchId = r.data.matchId;

  const s = await call('GET', `/api/matches/${matchId}/starters`, null, a.token);
  assert.ok(s.data.sharedInterests.includes('Música'));

  const msg = await call('POST', `/api/matches/${matchId}/messages`, { body: 'Oi! Tudo bem?' }, a.token);
  assert.equal(msg.status, 201);
  const list = await call('GET', `/api/matches/${matchId}/messages`, null, b.token);
  assert.equal(list.data.messages[0].body, 'Oi! Tudo bem?');
  assert.equal(list.data.messages[0].mine, false);

  const c = await newUser('woman');
  assert.equal((await call('GET', `/api/matches/${matchId}/messages`, null, c.token)).status, 404, 'terceiro não lê a conversa');
  assert.equal((await call('POST', `/api/matches/${matchId}/messages`, { body: 'oi' }, c.token)).status, 404);
});

test('mensagem pedindo Pix chega com alerta para quem recebe', async () => {
  const a = await newUser('woman'), b = await newUser('man');
  await call('POST', '/api/swipes', { toUserId: b.id, action: 'like' }, a.token);
  const { data } = await call('POST', '/api/swipes', { toUserId: a.id, action: 'like' }, b.token);
  await call('POST', `/api/matches/${data.matchId}/messages`, { body: 'Pode me mandar um pix de 200? te devolvo' }, b.token);
  const seenByA = await call('GET', `/api/matches/${data.matchId}/messages`, null, a.token);
  assert.ok(seenByA.data.messages[0].warnings.some((w) => /dinheiro/.test(w)));
  const seenByB = await call('GET', `/api/matches/${data.matchId}/messages`, null, b.token);
  assert.equal(seenByB.data.messages[0].warnings.length, 0);
});

test('bloqueio desfaz combinação, encerra conversa e esconde da descoberta — inclusive para premium', async () => {
  const a = await newUser('woman'), b = await newUser('man');
  await call('POST', '/api/swipes', { toUserId: b.id, action: 'like' }, a.token);
  const { data } = await call('POST', '/api/swipes', { toUserId: a.id, action: 'like' }, b.token);
  await call('POST', '/api/premium/dev-activate', {}, b.token);
  assert.equal((await call('POST', '/api/blocks', { userId: b.id }, a.token)).status, 200);
  assert.equal((await call('POST', `/api/matches/${data.matchId}/messages`, { body: 'oi?' }, b.token)).status, 410);
  assert.equal((await call('GET', `/api/users/${a.id}`, null, b.token)).status, 404);
  const disc = await call('GET', '/api/discover', null, b.token);
  assert.ok(!disc.data.profiles.some((p) => p.id === a.id));
  const likes = await call('GET', '/api/likes/received', null, b.token);
  assert.ok(!likes.data.profiles.some((p) => p.id === a.id));
});

test('limite diário de curtidas no plano gratuito; premium sem limite e com desfazer', async () => {
  const me = await newUser('man');
  const women = [];
  for (let i = 0; i < 5; i++) women.push(await newUser('woman'));
  for (let i = 0; i < 3; i++) assert.equal((await call('POST', '/api/swipes', { toUserId: women[i].id, action: 'like' }, me.token)).status, 200);
  const blocked = await call('POST', '/api/swipes', { toUserId: women[3].id, action: 'like' }, me.token);
  assert.equal(blocked.status, 429); assert.equal(blocked.data.code, 'daily_like_limit');
  assert.equal((await call('POST', '/api/swipes/undo', {}, me.token)).status, 402);

  await call('POST', '/api/premium/dev-activate', {}, me.token);
  assert.equal((await call('POST', '/api/swipes', { toUserId: women[3].id, action: 'like' }, me.token)).status, 200);
  await call('POST', '/api/swipes', { toUserId: women[4].id, action: 'pass' }, me.token);
  const undo = await call('POST', '/api/swipes/undo', {}, me.token);
  assert.equal(undo.status, 200); assert.equal(undo.data.restored.id, women[4].id);
});

test('premium vê curtidas recebidas; gratuito vê só a contagem', async () => {
  const w = await newUser('woman'), m = await newUser('man');
  await call('POST', '/api/swipes', { toUserId: w.id, action: 'like' }, m.token);
  const free = await call('GET', '/api/likes/received', null, w.token);
  assert.equal(free.data.count, 1); assert.equal(free.data.profiles.length, 0);
  await call('POST', '/api/premium/dev-activate', {}, w.token);
  const prem = await call('GET', '/api/likes/received', null, w.token);
  assert.equal(prem.data.profiles[0].id, m.id);
});

test('mesma mensagem para várias conversas é barrada como spam', async () => {
  const spammer = await newUser('man');
  const matches = [];
  for (let i = 0; i < 3; i++) {
    const w = await newUser('woman');
    await call('POST', '/api/premium/dev-activate', {}, spammer.token);
    await call('POST', '/api/swipes', { toUserId: w.id, action: 'like' }, spammer.token);
    matches.push((await call('POST', '/api/swipes', { toUserId: spammer.id, action: 'like' }, w.token)).data.matchId);
  }
  const text = 'Oi linda, tudo bem? Me conta de você';
  assert.equal((await call('POST', `/api/matches/${matches[0]}/messages`, { body: text }, spammer.token)).status, 201);
  assert.equal((await call('POST', `/api/matches/${matches[1]}/messages`, { body: text }, spammer.token)).status, 201);
  const third = await call('POST', `/api/matches/${matches[2]}/messages`, { body: text }, spammer.token);
  assert.equal(third.status, 429); assert.equal(third.data.code, 'spam');
});

test('denúncia: moderador vê só a mensagem denunciada e pode suspender', async () => {
  const a = await newUser('woman'), b = await newUser('man');
  await call('POST', '/api/swipes', { toUserId: b.id, action: 'like' }, a.token);
  const { data } = await call('POST', '/api/swipes', { toUserId: a.id, action: 'like' }, b.token);
  await call('POST', `/api/matches/${data.matchId}/messages`, { body: 'mensagem normal' }, b.token);
  const bad = await call('POST', `/api/matches/${data.matchId}/messages`, { body: 'mensagem abusiva' }, b.token);
  const rep = await call('POST', '/api/reports', { userId: b.id, messageId: bad.data.message.id, reason: 'assedio', block: true }, a.token);
  assert.equal(rep.status, 201);

  app.db.prepare(`INSERT INTO users (id, email, password_hash, birthdate, role, terms_accepted_at, sensitive_consent_at) VALUES ('mod1','mod@teste.com',?, '1990-01-01','moderator', datetime('now'), datetime('now'))`).run(hashPassword('Moderador123'));
  const mod = (await call('POST', '/api/auth/login', { email: 'mod@teste.com', password: 'Moderador123' })).data.token;
  const reports = (await call('GET', '/api/admin/reports', null, mod)).data.reports;
  const mine = reports.find((r) => r.reported?.id === b.id);
  assert.equal(mine.messageSnapshot, 'mensagem abusiva');
  assert.ok(!JSON.stringify(reports).includes('mensagem normal'), 'conversa completa não é exposta');
  assert.equal(mine.reported.email, undefined, 'moderador não vê e-mail');

  assert.equal((await call('POST', `/api/admin/reports/${mine.id}/resolve`, { action: 'suspend', note: 'assédio' }, mod)).status, 200);
  assert.equal((await call('GET', '/api/me', null, b.token)).status, 401, 'suspenso perde acesso');
  assert.equal((await call('GET', '/api/admin/users', null, mod)).status, 403, 'moderador não acessa gestão de usuários');
  const audit = app.db.prepare("SELECT * FROM audit_log WHERE action = 'report_suspend'").get();
  assert.ok(audit, 'ação registrada na auditoria');
});

test('denúncia por suspeita de menor tira o perfil da descoberta na hora', async () => {
  const a = await newUser('man'), b = await newUser('woman');
  await call('POST', '/api/reports', { userId: b.id, reason: 'menor_de_idade' }, a.token);
  const other = await newUser('man');
  const d = await call('GET', '/api/discover', null, other.token);
  assert.ok(!d.data.profiles.some((p) => p.id === b.id));
});

test('foto: aceita imagem real, recusa arquivo disfarçado', async () => {
  const u = await newUser('woman');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const ok = await call('POST', '/api/me/photos', { data: png.toString('base64') }, u.token);
  assert.equal(ok.status, 201); assert.equal(ok.data.photos.length, 1);
  const fake = await call('POST', '/api/me/photos', { data: Buffer.from('<script>alert(1)</script>').toString('base64') }, u.token);
  assert.equal(fake.status, 400);
  const img = await fetch(ok.data.photos[0].url.replace(/^http:\/\/localhost:\d+/, base));
  assert.equal(img.headers.get('content-type'), 'image/png');
});

test('tempo real: combinação e mensagem chegam pelo WebSocket', async () => {
  const a = await newUser('woman'), b = await newUser('man');
  const ws = new WebSocket(`${base.replace('http', 'ws')}/ws?token=${a.token}`);
  const events = [];
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (e) => events.push(JSON.parse(e.data));
  await call('POST', '/api/swipes', { toUserId: b.id, action: 'like' }, a.token);
  const { data } = await call('POST', '/api/swipes', { toUserId: a.id, action: 'like' }, b.token);
  await call('POST', `/api/matches/${data.matchId}/messages`, { body: 'Olá pelo tempo real' }, b.token);
  await new Promise((r) => setTimeout(r, 200));
  ws.close();
  assert.ok(events.some((e) => e.type === 'notification' && e.kind === 'match'));
  assert.ok(events.some((e) => e.type === 'message' && e.message.body === 'Olá pelo tempo real'));
  const bad = new WebSocket(`${base.replace('http', 'ws')}/ws?token=invalido`);
  await new Promise((res) => { bad.onerror = res; bad.onclose = res; });
});

test('exclusão de conta apaga dados e exige senha', async () => {
  const u = await newUser('woman');
  assert.equal((await call('DELETE', '/api/me', { password: 'errada000' }, u.token)).status, 401);
  assert.equal((await call('DELETE', '/api/me', { password: 'Senha1234' }, u.token)).status, 200);
  assert.equal(app.db.prepare('SELECT COUNT(*) n FROM users WHERE id = ?').get(u.id).n, 0);
  assert.equal(app.db.prepare('SELECT COUNT(*) n FROM profiles WHERE user_id = ?').get(u.id).n, 0);
  assert.equal((await call('POST', '/api/auth/login', { email: u.email, password: 'Senha1234' })).status, 401);
});

test('eventos: confirmação de presença sem expor participantes', async () => {
  app.db.prepare("INSERT INTO events (title, description, kind, starts_at) VALUES ('Encontro', 'desc', 'Convivência', datetime('now','+3 days'))").run();
  const u = await newUser('man');
  const ev = (await call('GET', '/api/events', null, u.token)).data.events[0];
  await call('POST', `/api/events/${ev.id}/rsvp`, {}, u.token);
  const after = (await call('GET', '/api/events', null, u.token)).data.events[0];
  assert.equal(after.going, 1); assert.equal(after.imGoing, true);
  assert.equal(after.attendees, undefined);
});
