import db from '../core/db.js';

export function save({ title, language = null, code, tags = '' }) {
  try {
    const result = db.prepare('INSERT INTO snippets (title, language, code, tags) VALUES (?, ?, ?, ?)').run(title, language, code, tags);
    return { ok: true, id: result.lastInsertRowid };
  } catch (e) {
    return { error: e.message };
  }
}

export function list({ language } = {}) {
  try {
    if (language) {
      return db.prepare('SELECT * FROM snippets WHERE language = ?').all(language);
    }
    return db.prepare('SELECT * FROM snippets ORDER BY created_at DESC').all();
  } catch (e) {
    return { error: e.message };
  }
}

export function search({ query }) {
  try {
    const q = `%${query}%`;
    return db.prepare('SELECT * FROM snippets WHERE title LIKE ? OR code LIKE ? OR tags LIKE ?').all(q, q, q);
  } catch (e) {
    return { error: e.message };
  }
}

export function remove({ id }) {
  try {
    db.prepare('DELETE FROM snippets WHERE id = ?').run(id);
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
}
