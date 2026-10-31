import { v } from '../validate.js';
import { fail } from '../http.js';
import { audit, json } from '../db.js';
import { isPremium } from '../profiles.js';

const isMod = (u) => u.role === 'moderator' || u.role === 'admin';
const requireMod = (u) => { if (!isMod(u)) fail(403, 'Acesso restrito à moderação.'); };
const requireAdmin = (u) => { if (u.role !== 'admin') fail(403, 'Acesso restrito a administradores.'); };

export default function adminRoutes(r, db) {
  r.get('/api/admin/metrics', async ({ user }) => {
    requireMod(user);
    const one = (sql, ...a) => db.prepare(sql).get(...a).n;
    const days = db.prepare(`SELECT date(created_at) day, COUNT(*) n FROM users WHERE created_at > datetime('now','-30 days') GROUP BY day ORDER BY day`).all();
    const total = one('SELECT COUNT(*) n FROM users');
    const premium = db.prepare('SELECT premium_until FROM users WHERE premium_until IS NOT NULL').all().filter(isPremium).length;
    // Retenção D7: dos que se cadastraram entre 14 e 7 dias atrás, quantos voltaram depois do 7º dia.
    const cohort = one(`SELECT COUNT(*) n FROM users WHERE created_at BETWEEN datetime('now','-14 days') AND datetime('now','-7 days')`);
    const retained = one(`SELECT COUNT(*) n FROM users WHERE created_at BETWEEN datetime('now','-14 days') AND datetime('now','-7 days') AND last_active_at > datetime(created_at, '+7 days')`);
    return {
      usersTotal: total,
      usersNew7d: one(`SELECT COUNT(*) n FROM users WHERE created_at > datetime('now','-7 days')`),
      usersActive7d: one(`SELECT COUNT(*) n FROM users WHERE last_active_at > datetime('now','-7 days')`),
      usersUnderReview: one(`SELECT COUNT(*) n FROM users WHERE status = 'under_review'`),
      matchesTotal: one('SELECT COUNT(*) n FROM matches'),
      conversationsStarted: one('SELECT COUNT(DISTINCT match_id) n FROM messages'),
      messagesFlagged7d: one(`SELECT COUNT(*) n FROM messages WHERE flags_json != '[]' AND created_at > datetime('now','-7 days')`),
      reportsOpen: one(`SELECT COUNT(*) n FROM reports WHERE status = 'open'`),
      premiumActive: premium,
      conversionRate: total ? +(premium / total * 100).toFixed(1) : 0,
      retentionD7: cohort ? +(retained / cohort * 100).toFixed(1) : null,
      revenue: null, revenueNote: 'Receita virá do RevenueCat/lojas após integração de pagamentos (fase 2).',
      signupsByDay: days,
    };
  }, { auth: true, allowIncomplete: true });

  // Moderador vê somente a mensagem denunciada (snapshot), nunca a conversa completa.
  r.get('/api/admin/reports', async ({ user, query }) => {
    requireMod(user);
    const status = query.get('status') || 'open';
    const rows = db.prepare(`
      SELECT r.*, pr.display_name reported_name, u.status reported_status, u.email reported_email,
        (SELECT COUNT(*) FROM reports x WHERE x.reported_id = r.reported_id) total_reports_against
      FROM reports r LEFT JOIN users u ON u.id = r.reported_id LEFT JOIN profiles pr ON pr.user_id = r.reported_id
      WHERE r.status = ? ORDER BY r.created_at ASC LIMIT 100`).all(status);
    return { reports: rows.map((x) => ({
      id: x.id, reason: x.reason, details: x.details, messageSnapshot: x.message_snapshot, createdAt: x.created_at,
      status: x.status, resolution: x.resolution,
      reported: x.reported_id ? { id: x.reported_id, name: x.reported_name, status: x.reported_status,
        email: user.role === 'admin' ? x.reported_email : undefined, totalReports: x.total_reports_against } : null,
    })) };
  }, { auth: true, allowIncomplete: true });

  r.post('/api/admin/reports/:id/resolve', async ({ user, params, body }) => {
    requireMod(user);
    const action = v.oneOf(body.action, ['dismiss', 'restore', 'suspend'], 'Ação');
    const note = v.str(body.note, 'Observação', { max: 500, optional: true }) || '';
    const rep = db.prepare('SELECT * FROM reports WHERE id = ?').get(Number(params.id));
    if (!rep) fail(404, 'Denúncia não encontrada.');
    if (rep.reported_id && action === 'suspend') db.prepare("UPDATE users SET status = 'suspended' WHERE id = ?").run(rep.reported_id);
    if (rep.reported_id && action === 'restore') db.prepare("UPDATE users SET status = 'active' WHERE id = ?").run(rep.reported_id);
    db.prepare(`UPDATE reports SET status = ?, resolution = ?, handled_by = ?, handled_at = datetime('now') WHERE id = ?`)
      .run(action === 'dismiss' ? 'dismissed' : 'resolved', `${action}${note ? ': ' + note : ''}`, user.id, rep.id);
    audit(db, user.id, `report_${action}`, rep.reported_id, { reportId: rep.id, note });
    return { ok: true };
  }, { auth: true, allowIncomplete: true });

  r.get('/api/admin/photos/pending', async ({ user }) => {
    requireMod(user);
    const rows = db.prepare(`SELECT ph.id, ph.file, ph.user_id, p.display_name FROM photos ph LEFT JOIN profiles p ON p.user_id = ph.user_id
      WHERE ph.moderation_status = 'pending' ORDER BY ph.created_at LIMIT 60`).all();
    return { photos: rows.map((x) => ({ id: x.id, url: `/photos/${x.file}`, userId: x.user_id, name: x.display_name })) };
  }, { auth: true, allowIncomplete: true });

  r.post('/api/admin/photos/:id', async ({ user, params, body }) => {
    requireMod(user);
    const status = v.oneOf(body.status, ['approved', 'rejected'], 'Status');
    const ch = db.prepare('UPDATE photos SET moderation_status = ? WHERE id = ?').run(status, params.id);
    if (!ch.changes) fail(404, 'Foto não encontrada.');
    audit(db, user.id, `photo_${status}`, params.id);
    return { ok: true };
  }, { auth: true, allowIncomplete: true });

  r.get('/api/admin/users', async ({ user, query }) => {
    requireAdmin(user);
    const q = `%${(query.get('q') || '').toLowerCase()}%`;
    const rows = db.prepare(`SELECT u.id, u.email, u.role, u.status, u.created_at, u.last_active_at, u.premium_until, p.display_name, p.city
      FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE lower(u.email) LIKE ? OR lower(COALESCE(p.display_name,'')) LIKE ?
      ORDER BY u.created_at DESC LIMIT 100`).all(q, q);
    return { users: rows };
  }, { auth: true, allowIncomplete: true });

  r.post('/api/admin/users/:id', async ({ user, params, body }) => {
    requireAdmin(user);
    if (params.id === user.id) fail(400, 'Você não pode alterar a própria conta por aqui.');
    const set = {};
    if (body.status) set.status = v.oneOf(body.status, ['active', 'under_review', 'suspended'], 'Status');
    if (body.role) set.role = v.oneOf(body.role, ['user', 'moderator', 'admin'], 'Papel');
    const keys = Object.keys(set);
    if (!keys.length) fail(400, 'Nada para alterar.');
    db.prepare(`UPDATE users SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...Object.values(set), params.id);
    audit(db, user.id, 'user_update', params.id, set);
    return { ok: true };
  }, { auth: true, allowIncomplete: true });

  r.post('/api/admin/events', async ({ user, body }) => {
    requireMod(user);
    const title = v.str(body.title, 'Título', { min: 3, max: 120 });
    const description = v.str(body.description, 'Descrição', { min: 3, max: 2000 });
    const kind = v.oneOf(body.kind, ['Encontro de solteiros', 'Evento de igreja', 'Congresso', 'Atividade social', 'Estudo bíblico', 'Convivência'], 'Tipo');
    const startsAt = v.str(body.startsAt, 'Data/hora', { max: 30 });
    if (isNaN(Date.parse(startsAt))) fail(400, 'Data/hora inválida.');
    const url = v.str(body.onlineUrl, 'Link', { max: 300, optional: true });
    if (url && !/^https:\/\//.test(url)) fail(400, 'O link precisa começar com https://');
    const ins = db.prepare('INSERT INTO events (title, description, kind, city, location, online_url, starts_at, created_by) VALUES (?,?,?,?,?,?,?,?)')
      .run(title, description, kind, v.str(body.city, 'Cidade', { max: 80, optional: true }), v.str(body.location, 'Local', { max: 200, optional: true }),
        url, new Date(startsAt).toISOString().replace('T', ' ').slice(0, 19), user.id);
    audit(db, user.id, 'event_create', String(ins.lastInsertRowid));
    return { status: 201, data: { id: Number(ins.lastInsertRowid) } };
  }, { auth: true, allowIncomplete: true });

  r.delete('/api/admin/events/:id', async ({ user, params }) => {
    requireMod(user);
    db.prepare('DELETE FROM events WHERE id = ?').run(Number(params.id));
    audit(db, user.id, 'event_delete', params.id);
    return { ok: true };
  }, { auth: true, allowIncomplete: true });

  r.get('/api/admin/audit', async ({ user }) => {
    requireAdmin(user);
    const rows = db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 200').all();
    return { entries: rows.map((x) => ({ ...x, meta: json(x.meta_json, {}) })) };
  }, { auth: true, allowIncomplete: true });
}
