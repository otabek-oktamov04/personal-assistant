import db from '../core/db.js';

export function save({ title = null, content, tags = '' }) {
  try {
    const result = db.prepare('INSERT INTO notes (title, content, tags) VALUES (?, ?, ?)').run(title, content, tags);
    return { ok: true, id: result.lastInsertRowid };
  } catch (e) {
    return { error: e.message };
  }
}

export function list({ tag } = {}) {
  try {
    if (tag) {
      return db.prepare("SELECT * FROM notes WHERE tags LIKE ? ORDER BY pinned DESC, updated_at DESC").all(`%${tag}%`);
    }
    return db.prepare('SELECT * FROM notes ORDER BY pinned DESC, updated_at DESC').all();
  } catch (e) {
    return { error: e.message };
  }
}

export function search({ query }) {
  try {
    const q = `%${query}%`;
    return db.prepare('SELECT * FROM notes WHERE title LIKE ? OR content LIKE ? OR tags LIKE ?').all(q, q, q);
  } catch (e) {
    return { error: e.message };
  }
}

export function update({ id, title, content, tags, pinned }) {
  try {
    db.prepare(`
      UPDATE notes SET
        title = COALESCE(?, title),
        content = COALESCE(?, content),
        tags = COALESCE(?, tags),
        pinned = COALESCE(?, pinned),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(title ?? null, content ?? null, tags ?? null, pinned ?? null, id);
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
}

export function remove({ id }) {
  try {
    db.prepare('DELETE FROM notes WHERE id = ?').run(id);
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
}
