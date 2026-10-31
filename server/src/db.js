import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

export function openDb(file = config.dbFile) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(fs.readFileSync(path.join(config.root, 'src', 'schema.sql'), 'utf8'));
  return db;
}

export function tx(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export const json = (s, fallback = null) => {
  try { return s == null ? fallback : JSON.parse(s); } catch { return fallback; }
};

export function audit(db, actorId, action, target, meta = {}) {
  db.prepare('INSERT INTO audit_log (actor_id, action, target, meta_json) VALUES (?,?,?,?)')
    .run(actorId ?? null, action, target ?? null, JSON.stringify(meta));
}
