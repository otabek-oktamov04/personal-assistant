import db, { encrypt, decrypt, log } from '../core/db.js';

export function save({ label, type, value, tags = '' }) {
  try {
    if (!['password', 'card', 'secret'].includes(type)) {
      return { error: 'type must be one of: password, card, secret' };
    }
    const encrypted_value = encrypt(value);
    db.prepare('INSERT INTO vault (label, type, encrypted_value, tags) VALUES (?, ?, ?, ?)').run(label, type, encrypted_value, tags);
    log(`vault.save: ${label}`, 'vault');
    return { ok: true, label };
  } catch (e) {
    return { error: e.message };
  }
}

export function get({ label }) {
  try {
    const row = db.prepare('SELECT * FROM vault WHERE label LIKE ?').get(`%${label}%`);
    if (!row) return { error: 'Not found' };
    log(`vault.get: ${label}`, 'vault');
    return {
      id: row.id,
      label: row.label,
      type: row.type,
      tags: row.tags,
      value: decrypt(row.encrypted_value),
      created_at: row.created_at,
    };
  } catch (e) {
    return { error: e.message };
  }
}

export function list({ type } = {}) {
  try {
    if (type) {
      return db.prepare('SELECT id, label, type, tags FROM vault WHERE type = ?').all(type);
    }
    return db.prepare('SELECT id, label, type, tags FROM vault').all();
  } catch (e) {
    return { error: e.message };
  }
}

export function remove({ id }) {
  try {
    db.prepare('DELETE FROM vault WHERE id = ?').run(id);
    log(`vault.delete: ${id}`, 'vault');
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
}
