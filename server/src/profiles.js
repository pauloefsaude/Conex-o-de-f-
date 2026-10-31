import { json } from './db.js';
import { ageFrom } from './security.js';
import { photoUrl } from './services.js';
import { distanceBand } from './compat.js';

export function loadProfile(db, userId) {
  const p = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId);
  if (!p) return null;
  return {
    ...p,
    values: json(p.values_json, []),
    interests: json(p.interests_json, []),
    answers: json(p.answers_json, []),
    visibility: json(p.visibility_json, {}),
  };
}

export function loadPhotos(db, userId, { includePending = true } = {}) {
  const rows = db.prepare(
    `SELECT id, file, position, moderation_status FROM photos WHERE user_id = ? ${includePending ? "AND moderation_status != 'rejected'" : "AND moderation_status = 'approved'"} ORDER BY position, created_at`
  ).all(userId);
  return rows.map((r) => ({ id: r.id, url: photoUrl(r.file), status: r.moderation_status }));
}

export const isComplete = (p) => !!(p && p.display_name && p.gender && p.seeking && p.city);

// Visão pública: só o que a pessoa permitiu. Nunca expõe e-mail, data de nascimento ou coordenadas.
export function publicProfile(db, userId, { km = null, extra = {} } = {}) {
  const p = loadProfile(db, userId);
  const u = db.prepare('SELECT birthdate, email_verified FROM users WHERE id = ?').get(userId);
  if (!p || !u) return null;
  const vis = p.visibility;
  return {
    id: userId,
    name: p.display_name,
    age: ageFrom(u.birthdate),
    city: p.city, region: p.region,
    distance: distanceBand(km),
    bio: p.bio,
    relationshipGoal: p.relationship_goal,
    wantsChildren: p.wants_children,
    values: p.values,
    interests: p.interests,
    answers: p.answers,
    future: p.future,
    denomination: vis.denomination ? p.denomination : null,
    churchFrequency: vis.church_frequency ? p.church_frequency : null,
    prayerImportance: vis.prayer_importance ? p.prayer_importance : null,
    favoriteVerse: vis.favorite_verse ? p.favorite_verse : null,
    badges: u.email_verified ? ['email_verificado'] : [],
    photos: loadPhotos(db, userId, { includePending: true }).map((x) => x.url),
    ...extra,
  };
}

// Visão própria (dono do perfil).
export function ownProfile(db, userId) {
  const p = loadProfile(db, userId);
  if (!p) return null;
  return {
    displayName: p.display_name, gender: p.gender, seeking: p.seeking, cityKey: p.city_key, city: p.city, region: p.region,
    bio: p.bio, denomination: p.denomination, churchFrequency: p.church_frequency, prayerImportance: p.prayer_importance,
    relationshipGoal: p.relationship_goal, wantsChildren: p.wants_children, values: p.values, interests: p.interests,
    answers: p.answers, favoriteVerse: p.favorite_verse, future: p.future, visibility: p.visibility,
    complete: isComplete(p), photos: loadPhotos(db, userId),
  };
}

export const isBlockedEitherWay = (db, a, b) =>
  !!db.prepare('SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)').get(a, b, b, a);

export const isPremium = (user) => !!user.premium_until && new Date(user.premium_until) > new Date();
