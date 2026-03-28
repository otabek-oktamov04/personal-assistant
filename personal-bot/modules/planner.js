import db from '../core/db.js';

export function save({ title, description = null, due_date = null, priority = 'medium' }) {
  try {
    const result = db.prepare('INSERT INTO tasks (title, description, due_date, priority) VALUES (?, ?, ?, ?)').run(title, description, due_date, priority);
    return { ok: true, id: result.lastInsertRowid };
  } catch (e) {
    return { error: e.message };
  }
}

export function list({ status } = {}) {
  try {
    if (status) {
      return db.prepare('SELECT * FROM tasks WHERE status = ? ORDER BY due_date ASC').all(status);
    }
    return db.prepare('SELECT * FROM tasks ORDER BY due_date ASC').all();
  } catch (e) {
    return { error: e.message };
  }
}

export function update({ id, status, title, due_date, priority }) {
  try {
    db.prepare(`
      UPDATE tasks SET
        status = COALESCE(?, status),
        title = COALESCE(?, title),
        due_date = COALESCE(?, due_date),
        priority = COALESCE(?, priority)
      WHERE id = ?
    `).run(status ?? null, title ?? null, due_date ?? null, priority ?? null, id);
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
}

export function remove({ id }) {
  try {
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
}

export function today() {
  try {
    return db.prepare("SELECT * FROM tasks WHERE date(due_date) <= date('now') AND status != 'done' ORDER BY due_date ASC").all();
  } catch (e) {
    return { error: e.message };
  }
}
