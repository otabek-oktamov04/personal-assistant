import db from '../core/db.js';

export function save({ name, email = null, phone = null, notes = null, tags = '' }) {
  try {
    const result = db.prepare('INSERT INTO contacts (name, email, phone, notes, tags) VALUES (?, ?, ?, ?, ?)').run(name, email, phone, notes, tags);
    return { ok: true, id: result.lastInsertRowid };
  } catch (e) {
    return { error: e.message };
  }
}

export function list() {
  try {
    return db.prepare('SELECT * FROM contacts ORDER BY name ASC').all();
  } catch (e) {
    return { error: e.message };
  }
}

export function search({ query }) {
  try {
    const q = `%${query}%`;
    return db.prepare('SELECT * FROM contacts WHERE name LIKE ? OR email LIKE ? OR phone LIKE ? OR notes LIKE ?').all(q, q, q, q);
  } catch (e) {
    return { error: e.message };
  }
}

export function update({ id, name, email, phone, notes, tags }) {
  try {
    db.prepare(`
      UPDATE contacts SET
        name = COALESCE(?, name),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        notes = COALESCE(?, notes),
        tags = COALESCE(?, tags)
      WHERE id = ?
    `).run(name ?? null, email ?? null, phone ?? null, notes ?? null, tags ?? null, id);
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
}

export function remove({ id }) {
  try {
    db.prepare('DELETE FROM contacts WHERE id = ?').run(id);
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
}
