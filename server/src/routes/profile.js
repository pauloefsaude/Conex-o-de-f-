import { v } from '../validate.js';
import { fail, enforceRate } from '../http.js';
import { newId } from '../security.js';
import { CITIES, OPTIONS, PROFILE_QUESTIONS } from '../content.js';
import { analyzeProfileText } from '../moderation.js';
import { detectImage, savePhoto, deletePhotoFile, bioSuggestions } from '../services.js';
import { json } from '../db.js';
import { ownProfile, loadProfile } from '../profiles.js';

const MAX_PHOTOS = 6;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

function cleanText(text, name) {
  if (!text) return text;
  const flags = analyzeProfileText(text);
  if (flags.includes('link') || flags.includes('off_platform')) {
    fail(400, `${name}: não inclua links, telefones ou contatos externos. Combine isso na conversa, quando se sentir à vontade.`);
  }
  if (flags.includes('money')) fail(400, `${name}: não inclua pedidos ou menções a dinheiro.`);
  return text;
}

export default function profileRoutes(r, db) {
  r.get('/api/options', async () => ({
    ...OPTIONS,
    questions: PROFILE_QUESTIONS,
    cities: Object.entries(CITIES).map(([key, [name, uf]]) => ({ key, name, uf })),
  }));

  r.put('/api/me/profile', async ({ user, body }) => {
    const cur = loadProfile(db, user.id);
    const pick = (k, fn) => (k in body ? fn(body[k]) : undefined);

    const upd = {};
    upd.display_name = pick('displayName', (x) => cleanText(v.str(x, 'Nome de exibição', { min: 2, max: 40 }), 'Nome'));
    upd.gender = pick('gender', (x) => v.oneOf(x, ['man', 'woman'], 'Gênero'));
    upd.seeking = pick('seeking', (x) => v.oneOf(x, ['man', 'woman'], 'Busca'));
    if ('cityKey' in body) {
      const c = CITIES[body.cityKey];
      if (!c) fail(400, 'Cidade inválida.');
      Object.assign(upd, { city_key: body.cityKey, city: c[0], region: c[1], lat: c[2], lng: c[3] });
    }
    upd.bio = pick('bio', (x) => cleanText(v.str(x, 'Biografia', { max: 500, optional: true }) || '', 'Biografia'));
    upd.denomination = pick('denomination', (x) => v.oneOf(x, OPTIONS.denominations, 'Denominação', { optional: true }));
    upd.church_frequency = pick('churchFrequency', (x) => v.oneOf(x, OPTIONS.churchFrequency, 'Frequência', { optional: true }));
    upd.prayer_importance = pick('prayerImportance', (x) => v.int(x, 'Importância da oração', 1, 5, { optional: true }));
    upd.relationship_goal = pick('relationshipGoal', (x) => v.oneOf(x, OPTIONS.relationshipGoals, 'Objetivo', { optional: true }));
    upd.wants_children = pick('wantsChildren', (x) => v.oneOf(x, OPTIONS.wantsChildren, 'Filhos', { optional: true }));
    upd.values_json = pick('values', (x) => JSON.stringify(v.listOf(x, OPTIONS.values, 'Valores', 5)));
    upd.interests_json = pick('interests', (x) => JSON.stringify(v.listOf(x, OPTIONS.interests, 'Interesses', 10)));
    upd.favorite_verse = pick('favoriteVerse', (x) => cleanText(v.str(x, 'Versículo', { max: 200, optional: true }), 'Versículo'));
    upd.future = pick('future', (x) => cleanText(v.str(x, 'Expectativas', { max: 300, optional: true }), 'Expectativas'));
    upd.answers_json = pick('answers', (x) => {
      if (!Array.isArray(x) || x.length > 3) fail(400, 'Responda no máximo 3 perguntas.');
      return JSON.stringify(x.map((a) => ({
        q: v.oneOf(a?.q, PROFILE_QUESTIONS, 'Pergunta'),
        a: cleanText(v.str(a?.a, 'Resposta', { min: 2, max: 300 }), 'Resposta'),
      })));
    });
    upd.visibility_json = pick('visibility', (x) => {
      const keys = ['denomination', 'church_frequency', 'prayer_importance', 'favorite_verse'];
      const base = cur.visibility;
      for (const k of keys) if (x && k in x) base[k] = x[k] === true;
      return JSON.stringify(base);
    });

    const entries = Object.entries(upd).filter(([, val]) => val !== undefined);
    if (entries.length) {
      db.prepare(`UPDATE profiles SET ${entries.map(([k]) => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE user_id = ?`)
        .run(...entries.map(([, val]) => val), user.id);
    }
    return { profile: ownProfile(db, user.id) };
  }, { auth: true, allowIncomplete: true });

  r.get('/api/me/preferences', async ({ user }) => prefsView(db, user.id), { auth: true, allowIncomplete: true });

  r.put('/api/me/preferences', async ({ user, body }) => {
    const ageMin = v.int(body.ageMin ?? 18, 'Idade mínima', 18, 99);
    const ageMax = v.int(body.ageMax ?? 60, 'Idade máxima', 18, 99);
    if (ageMin > ageMax) fail(400, 'A idade mínima não pode ser maior que a máxima.');
    const dist = v.int(body.maxDistanceKm ?? 300, 'Distância', 5, 5000);
    const goals = v.listOf(body.goals, OPTIONS.relationshipGoals, 'Objetivos', 4);
    const dens = v.listOf(body.denominations, OPTIONS.denominations, 'Denominações', 15);
    db.prepare('UPDATE preferences SET age_min=?, age_max=?, max_distance_km=?, goals_json=?, denominations_json=? WHERE user_id=?')
      .run(ageMin, ageMax, dist, JSON.stringify(goals), JSON.stringify(dens), user.id);
    return prefsView(db, user.id);
  }, { auth: true, allowIncomplete: true });

  // Upload de foto em base64 (JSON). Valida assinatura binária real, não só a extensão.
  r.post('/api/me/photos', async ({ req, user, body }) => {
    enforceRate(req, 'photo', 20, 3600_000, user.id);
    const count = db.prepare("SELECT COUNT(*) n FROM photos WHERE user_id = ? AND moderation_status != 'rejected'").get(user.id).n;
    if (count >= MAX_PHOTOS) fail(400, `Você pode ter até ${MAX_PHOTOS} fotos.`);
    if (typeof body.data !== 'string') fail(400, 'Envie a imagem em base64.');
    const buf = Buffer.from(body.data.replace(/^data:[^,]+,/, ''), 'base64');
    if (buf.length > MAX_PHOTO_BYTES) fail(413, 'A foto pode ter no máximo 5 MB.');
    const ext = detectImage(buf);
    if (!ext) fail(400, 'Formato não suportado. Use JPG, PNG ou WebP.');
    const file = savePhoto(buf, ext);
    // MVP: fotos entram como "pending" e já aparecem; a moderação revisa no painel.
    // Fase 2: moderação automática antes de publicar.
    db.prepare('INSERT INTO photos (id, user_id, file, position) VALUES (?,?,?,?)').run(newId(), user.id, file, count);
    return { status: 201, data: { photos: ownProfile(db, user.id).photos } };
  }, { auth: true, allowIncomplete: true, bodyLimit: 7 * 1024 * 1024 });

  r.delete('/api/me/photos/:id', async ({ user, params }) => {
    const p = db.prepare('SELECT file FROM photos WHERE id = ? AND user_id = ?').get(params.id, user.id);
    if (!p) fail(404, 'Foto não encontrada.');
    db.prepare('DELETE FROM photos WHERE id = ?').run(params.id);
    deletePhotoFile(p.file);
    return { photos: ownProfile(db, user.id).photos };
  }, { auth: true, allowIncomplete: true });

  r.post('/api/ai/bio-suggestions', async ({ req, user }) => {
    enforceRate(req, 'ai', 10, 3600_000, user.id);
    return bioSuggestions(loadProfile(db, user.id));
  }, { auth: true, allowIncomplete: true });
}

function prefsView(db, userId) {
  const p = db.prepare('SELECT * FROM preferences WHERE user_id = ?').get(userId);
  return { ageMin: p.age_min, ageMax: p.age_max, maxDistanceKm: p.max_distance_km, goals: json(p.goals_json, []), denominations: json(p.denominations_json, []) };
}
