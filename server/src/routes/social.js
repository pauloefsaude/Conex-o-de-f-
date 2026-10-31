import { v } from '../validate.js';
import { fail, enforceRate } from '../http.js';
import { json, tx, audit } from '../db.js';
import { ageFrom } from '../security.js';
import { compatibility, distanceKm } from '../compat.js';
import { analyzeMessage, FLAG_WARNINGS } from '../moderation.js';
import { loadProfile, publicProfile, isBlockedEitherWay, isPremium } from '../profiles.js';
import { CONVERSATION_STARTERS, PROFILE_QUESTIONS } from '../content.js';
import { config } from '../config.js';

const REPORT_REASONS = ['perfil_falso', 'golpe_dinheiro', 'assedio', 'conteudo_improprio', 'discriminacao', 'menor_de_idade', 'spam', 'outro'];

const pair = (a, b) => (a < b ? [a, b] : [b, a]);

function activeMatchFor(db, matchId, userId) {
  const m = db.prepare('SELECT * FROM matches WHERE id = ?').get(Number(matchId));
  if (!m || (m.user_a !== userId && m.user_b !== userId)) fail(404, 'Conversa não encontrada.');
  if (m.unmatched_at) fail(410, 'Esta combinação foi desfeita.', 'unmatched');
  const other = m.user_a === userId ? m.user_b : m.user_a;
  if (isBlockedEitherWay(db, userId, other)) fail(410, 'Esta conversa não está mais disponível.', 'blocked');
  return { ...m, other, mutedByMe: m.user_a === userId ? !!m.muted_a : !!m.muted_b, mutedByOther: m.user_a === userId ? !!m.muted_b : !!m.muted_a };
}

function notify(db, rt, userId, kind, data) {
  const u = db.prepare('SELECT settings FROM users WHERE id = ?').get(userId);
  const s = json(u?.settings, {});
  if (kind === 'match' && s.notifyMatches === false) return;
  if (kind === 'message' && s.notifyMessages === false) return;
  db.prepare('INSERT INTO notifications (user_id, kind, data_json) VALUES (?,?,?)').run(userId, kind, JSON.stringify(data));
  rt.emit(userId, { type: 'notification', kind, data });
}

const messageView = (m, me) => {
  const flags = json(m.flags_json, []);
  return {
    id: m.id, matchId: m.match_id, mine: m.sender_id === me, body: m.body, createdAt: m.created_at, readAt: m.read_at,
    // Avisos de segurança são mostrados a quem RECEBE a mensagem.
    warnings: m.sender_id === me ? [] : flags.map((f) => FLAG_WARNINGS[f]).filter(Boolean),
  };
};

export default function socialRoutes(r, db, rt) {
  // ---------- Descoberta ----------
  r.get('/api/discover', async ({ user, query }) => {
    const me = loadProfile(db, user.id);
    const prefs = db.prepare('SELECT * FROM preferences WHERE user_id = ?').get(user.id);
    const goals = json(prefs.goals_json, []);
    const dens = json(prefs.denominations_json, []);
    const premium = isPremium(user);
    const onlyVerified = query.get('onlyVerified') === '1';
    const withPhotos = query.get('withPhotos') === '1';
    if ((onlyVerified || withPhotos) && !premium) fail(402, 'Filtros avançados fazem parte do Premium.', 'premium_required');

    const rows = db.prepare(`
      SELECT u.id, u.birthdate, u.email_verified FROM users u JOIN profiles p ON p.user_id = u.id
      WHERE u.id != ? AND u.status = 'active'
        AND json_extract(u.settings, '$.showInDiscovery') != 0
        AND p.display_name IS NOT NULL AND p.city IS NOT NULL
        AND p.gender = ? AND p.seeking = ?
        AND NOT EXISTS (SELECT 1 FROM swipes s WHERE s.from_user = ? AND s.to_user = u.id)
        AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = ? AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = ?))
      LIMIT 500`).all(user.id, me.seeking, me.gender, user.id, user.id, user.id);

    const out = [];
    for (const row of rows) {
      const age = ageFrom(row.birthdate);
      if (age < prefs.age_min || age > prefs.age_max) continue;
      if (onlyVerified && !row.email_verified) continue;
      const other = loadProfile(db, row.id);
      const km = distanceKm(me, other);
      if (km != null && km > prefs.max_distance_km) continue;
      if (goals.length && !goals.includes(other.relationship_goal)) continue;
      if (dens.length && !(other.visibility.denomination && dens.includes(other.denomination))) continue;
      const pub = publicProfile(db, row.id, { km });
      if (withPhotos && !pub.photos.length) continue;
      const c = compatibility(me, other, km);
      out.push({ ...pub, compatibility: c.score, reasons: c.reasons, sharedInterests: c.sharedInterests });
    }
    out.sort((a, b) => b.compatibility - a.compatibility);
    return {
      profiles: out.slice(0, 20),
      explanation: 'Ordenamos pelas informações que vocês declararam: objetivo, interesses, valores, planos sobre filhos e distância. É um indicador, não uma promessa.',
    };
  }, { auth: true });

  r.get('/api/users/:id', async ({ user, params }) => {
    const id = params.id;
    if (id === user.id) return publicProfile(db, id); // pré-visualização do próprio perfil público
    const target = db.prepare("SELECT status FROM users WHERE id = ?").get(id);
    if (!target || target.status !== 'active' || isBlockedEitherWay(db, user.id, id)) fail(404, 'Perfil não encontrado.');
    const me = loadProfile(db, user.id), other = loadProfile(db, id);
    if (!other || other.gender !== me.seeking || other.seeking !== me.gender) {
      // Também permite ver perfis de combinações existentes.
      const [a, b] = pair(user.id, id);
      if (!db.prepare('SELECT 1 FROM matches WHERE user_a = ? AND user_b = ? AND unmatched_at IS NULL').get(a, b)) fail(404, 'Perfil não encontrado.');
    }
    const km = distanceKm(me, other);
    const c = compatibility(me, other, km);
    return publicProfile(db, id, { km, extra: { compatibility: c.score, reasons: c.reasons, sharedInterests: c.sharedInterests } });
  }, { auth: true });

  // ---------- Curtidas e combinações ----------
  r.post('/api/swipes', async ({ req, user, body }) => {
    enforceRate(req, 'swipe', 120, 60_000, user.id);
    const to = v.str(body.toUserId, 'Perfil', { max: 64 });
    const action = v.oneOf(body.action, ['like', 'pass'], 'Ação');
    if (to === user.id) fail(400, 'Ação inválida.');
    const target = db.prepare("SELECT status FROM users WHERE id = ?").get(to);
    if (!target || target.status !== 'active' || isBlockedEitherWay(db, user.id, to)) fail(404, 'Perfil não encontrado.');

    if (action === 'like' && !isPremium(user)) {
      const n = db.prepare("SELECT COUNT(*) n FROM swipes WHERE from_user = ? AND action = 'like' AND created_at > datetime('now','-1 day')").get(user.id).n;
      if (n >= config.freeDailyLikes) fail(429, `Você usou suas ${config.freeDailyLikes} curtidas das últimas 24 horas. Volte amanhã com calma. 🙂`, 'daily_like_limit');
    }

    return tx(db, () => {
      const ins = db.prepare('INSERT OR IGNORE INTO swipes (from_user, to_user, action) VALUES (?,?,?)').run(user.id, to, action);
      if (!ins.changes) fail(409, 'Você já avaliou este perfil.');
      if (action !== 'like') return { matched: false };
      const back = db.prepare("SELECT 1 FROM swipes WHERE from_user = ? AND to_user = ? AND action = 'like'").get(to, user.id);
      if (!back) return { matched: false };
      const [a, b] = pair(user.id, to);
      db.prepare('INSERT OR IGNORE INTO matches (user_a, user_b) VALUES (?,?)').run(a, b);
      const m = db.prepare('SELECT id FROM matches WHERE user_a = ? AND user_b = ?').get(a, b);
      const meName = loadProfile(db, user.id).display_name;
      const otherName = loadProfile(db, to).display_name;
      notify(db, rt, to, 'match', { matchId: m.id, name: meName });
      notify(db, rt, user.id, 'match', { matchId: m.id, name: otherName });
      return { matched: true, matchId: m.id, profile: publicProfile(db, to) };
    });
  }, { auth: true });

  // Premium: desfazer o último "passar" (curtidas não, pois podem ter gerado combinação).
  r.post('/api/swipes/undo', async ({ user }) => {
    if (!isPremium(user)) fail(402, 'Desfazer faz parte do Premium.', 'premium_required');
    const last = db.prepare("SELECT to_user, action FROM swipes WHERE from_user = ? ORDER BY created_at DESC, rowid DESC LIMIT 1").get(user.id);
    if (!last || last.action !== 'pass') fail(400, 'Só é possível desfazer o último "passar".');
    db.prepare('DELETE FROM swipes WHERE from_user = ? AND to_user = ?').run(user.id, last.to_user);
    return { restored: publicProfile(db, last.to_user) };
  }, { auth: true });

  // Premium: ver quem curtiu você (somente quem você ainda não avaliou e sem bloqueio).
  r.get('/api/likes/received', async ({ user }) => {
    const rows = db.prepare(`
      SELECT s.from_user id FROM swipes s JOIN users u ON u.id = s.from_user
      WHERE s.to_user = ? AND s.action = 'like' AND u.status = 'active'
        AND NOT EXISTS (SELECT 1 FROM swipes m WHERE m.from_user = ? AND m.to_user = s.from_user)
        AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = ? AND b.blocked_id = s.from_user) OR (b.blocker_id = s.from_user AND b.blocked_id = ?))
      ORDER BY s.created_at DESC LIMIT 50`).all(user.id, user.id, user.id, user.id);
    if (!isPremium(user)) return { count: rows.length, profiles: [], premiumRequired: true };
    return { count: rows.length, profiles: rows.map((r) => publicProfile(db, r.id)) };
  }, { auth: true });

  r.get('/api/matches', async ({ user }) => {
    const rows = db.prepare(`
      SELECT m.*, CASE WHEN m.user_a = ? THEN m.user_b ELSE m.user_a END other
      FROM matches m WHERE (m.user_a = ? OR m.user_b = ?) AND m.unmatched_at IS NULL ORDER BY m.created_at DESC`)
      .all(user.id, user.id, user.id);
    const out = [];
    for (const m of rows) {
      if (isBlockedEitherWay(db, user.id, m.other)) continue;
      const last = db.prepare('SELECT * FROM messages WHERE match_id = ? ORDER BY id DESC LIMIT 1').get(m.id);
      const unread = db.prepare('SELECT COUNT(*) n FROM messages WHERE match_id = ? AND sender_id != ? AND read_at IS NULL').get(m.id, user.id).n;
      const p = publicProfile(db, m.other);
      out.push({
        matchId: m.id, createdAt: m.created_at, unread,
        muted: m.user_a === user.id ? !!m.muted_a : !!m.muted_b,
        lastMessage: last ? { body: last.body, mine: last.sender_id === user.id, createdAt: last.created_at } : null,
        person: { id: p.id, name: p.name, age: p.age, city: p.city, photo: p.photos[0] || null },
      });
    }
    out.sort((a, b) => (b.lastMessage?.createdAt || b.createdAt).localeCompare(a.lastMessage?.createdAt || a.createdAt));
    return { matches: out };
  }, { auth: true });

  r.delete('/api/matches/:id', async ({ user, params }) => {
    const m = activeMatchFor(db, params.id, user.id);
    db.prepare("UPDATE matches SET unmatched_at = datetime('now') WHERE id = ?").run(m.id);
    rt.emit(m.other, { type: 'unmatched', matchId: m.id });
    return { ok: true };
  }, { auth: true });

  r.put('/api/matches/:id/mute', async ({ user, params, body }) => {
    const m = activeMatchFor(db, params.id, user.id);
    const col = m.user_a === user.id ? 'muted_a' : 'muted_b';
    db.prepare(`UPDATE matches SET ${col} = ? WHERE id = ?`).run(body.muted ? 1 : 0, m.id);
    return { muted: !!body.muted };
  }, { auth: true });

  r.get('/api/matches/:id/starters', async ({ user, params }) => {
    const m = activeMatchFor(db, params.id, user.id);
    const me = loadProfile(db, user.id), other = loadProfile(db, m.other);
    const shared = me.interests.filter((i) => other.interests.includes(i));
    const fromInterests = shared.slice(0, 3).map((i) => `Vi que vocês dois gostam de ${i.toLowerCase()}. O que te atraiu nisso?`);
    const fromAnswers = other.answers.slice(0, 2).map((a) => `Gostei da sua resposta sobre "${a.q.replace(/\?$/, '').toLowerCase()}". Pode contar mais?`);
    return {
      sharedInterests: shared,
      suggestions: [...fromInterests, ...fromAnswers, ...CONVERSATION_STARTERS.slice(0, 4)].slice(0, 7),
      deeperQuestions: PROFILE_QUESTIONS,
      source: 'regras',
    };
  }, { auth: true });

  // ---------- Mensagens ----------
  r.get('/api/matches/:id/messages', async ({ user, params, query }) => {
    const m = activeMatchFor(db, params.id, user.id);
    const after = Number(query.get('after') || 0);
    const rows = db.prepare('SELECT * FROM messages WHERE match_id = ? AND id > ? ORDER BY id ASC LIMIT 200').all(m.id, after);
    return { messages: rows.map((x) => messageView(x, user.id)), person: publicProfile(db, m.other), muted: m.mutedByMe };
  }, { auth: true });

  r.post('/api/matches/:id/messages', async ({ req, user, params, body }) => {
    enforceRate(req, 'msg', 30, 60_000, user.id);
    const m = activeMatchFor(db, params.id, user.id);
    const text = v.str(body.body, 'Mensagem', { min: 1, max: 1000 });
    // Anti-spam: a mesma mensagem enviada para 3+ conversas em 10 minutos é bloqueada.
    const dup = db.prepare(`SELECT COUNT(DISTINCT match_id) n FROM messages WHERE sender_id = ? AND body = ? AND match_id != ? AND created_at > datetime('now','-10 minutes')`)
      .get(user.id, text, m.id).n;
    if (dup >= 2) {
      audit(db, null, 'spam_blocked', user.id, { sample: text.slice(0, 80) });
      fail(429, 'Parece uma mensagem repetida para várias pessoas. Escreva algo pessoal para cada conversa.', 'spam');
    }
    const flags = analyzeMessage(text);
    const ins = db.prepare('INSERT INTO messages (match_id, sender_id, body, flags_json) VALUES (?,?,?,?)').run(m.id, user.id, text, JSON.stringify(flags));
    const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(Number(ins.lastInsertRowid));
    rt.emit(m.other, { type: 'message', matchId: m.id, message: messageView(row, m.other) });
    if (!m.mutedByOther) notify(db, rt, m.other, 'message', { matchId: m.id, name: loadProfile(db, user.id).display_name });
    return { status: 201, data: { message: messageView(row, user.id) } };
  }, { auth: true });

  r.post('/api/matches/:id/read', async ({ user, params }) => {
    const m = activeMatchFor(db, params.id, user.id);
    db.prepare("UPDATE messages SET read_at = datetime('now') WHERE match_id = ? AND sender_id != ? AND read_at IS NULL").run(m.id, user.id);
    rt.emit(m.other, { type: 'read', matchId: m.id });
    return { ok: true };
  }, { auth: true });

  // ---------- Bloqueio e denúncia ----------
  r.post('/api/blocks', async ({ user, body }) => {
    const id = v.str(body.userId, 'Usuário', { max: 64 });
    if (id === user.id || !db.prepare('SELECT 1 FROM users WHERE id = ?').get(id)) fail(404, 'Usuário não encontrado.');
    block(db, rt, user.id, id);
    return { ok: true };
  }, { auth: true, allowIncomplete: true });

  r.get('/api/blocks', async ({ user }) => {
    const rows = db.prepare('SELECT b.blocked_id id, p.display_name name, b.created_at FROM blocks b LEFT JOIN profiles p ON p.user_id = b.blocked_id WHERE b.blocker_id = ? ORDER BY b.created_at DESC').all(user.id);
    return { blocks: rows };
  }, { auth: true, allowIncomplete: true });

  r.delete('/api/blocks/:id', async ({ user, params }) => {
    db.prepare('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?').run(user.id, params.id);
    return { ok: true };
  }, { auth: true, allowIncomplete: true });

  r.post('/api/reports', async ({ req, user, body }) => {
    enforceRate(req, 'report', 20, 3600_000, user.id);
    const reported = v.str(body.userId, 'Usuário', { max: 64 });
    const reason = v.oneOf(body.reason, REPORT_REASONS, 'Motivo');
    const details = v.str(body.details, 'Detalhes', { max: 1000, optional: true }) || '';
    if (reported === user.id || !db.prepare('SELECT 1 FROM users WHERE id = ?').get(reported)) fail(404, 'Usuário não encontrado.');

    let snapshot = null, messageId = null;
    if (body.messageId != null) {
      const msg = db.prepare('SELECT m.*, x.user_a, x.user_b FROM messages m JOIN matches x ON x.id = m.match_id WHERE m.id = ?').get(Number(body.messageId));
      if (!msg || msg.sender_id !== reported || (msg.user_a !== user.id && msg.user_b !== user.id)) fail(400, 'Mensagem inválida para denúncia.');
      snapshot = msg.body; messageId = msg.id;
    }
    db.prepare('INSERT INTO reports (reporter_id, reported_id, message_id, message_snapshot, reason, details) VALUES (?,?,?,?,?,?)')
      .run(user.id, reported, messageId, snapshot, reason, details);

    // Proteção preventiva: suspeita de menor ou 3+ denunciantes distintos tiram o perfil da descoberta até revisão.
    const distinct = db.prepare("SELECT COUNT(DISTINCT reporter_id) n FROM reports WHERE reported_id = ? AND status = 'open'").get(reported).n;
    if (reason === 'menor_de_idade' || distinct >= 3) {
      db.prepare("UPDATE users SET status = 'under_review' WHERE id = ? AND status = 'active'").run(reported);
      audit(db, null, 'auto_under_review', reported, { reason, distinct });
    }
    if (body.block) block(db, rt, user.id, reported);
    return { status: 201, data: { ok: true, message: 'Obrigado. Nossa equipe vai analisar. Você não será identificado para a outra pessoa.' } };
  }, { auth: true, allowIncomplete: true });

  // ---------- Notificações ----------
  r.get('/api/notifications', async ({ user }) => {
    const rows = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50').all(user.id);
    return { notifications: rows.map((n) => ({ id: n.id, kind: n.kind, data: json(n.data_json, {}), read: !!n.read_at, createdAt: n.created_at })) };
  }, { auth: true, allowIncomplete: true });

  r.post('/api/notifications/read', async ({ user }) => {
    db.prepare("UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL").run(user.id);
    return { ok: true };
  }, { auth: true, allowIncomplete: true });
}

export function block(db, rt, blocker, blocked) {
  db.prepare('INSERT OR IGNORE INTO blocks (blocker_id, blocked_id) VALUES (?,?)').run(blocker, blocked);
  const [a, b] = pair(blocker, blocked);
  const m = db.prepare('SELECT id FROM matches WHERE user_a = ? AND user_b = ? AND unmatched_at IS NULL').get(a, b);
  if (m) {
    db.prepare("UPDATE matches SET unmatched_at = datetime('now') WHERE id = ?").run(m.id);
    rt.emit(blocked, { type: 'unmatched', matchId: m.id });
  }
}
