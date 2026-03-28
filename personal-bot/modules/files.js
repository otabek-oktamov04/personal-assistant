import db from '../core/db.js';
import { existsSync, unlinkSync } from 'fs';
import path from 'path';

export function record({ original_name, stored_name, mime_type = null, size = null, tags = '', description = null }) {
  try {
    const result = db.prepare('INSERT INTO files (original_name, stored_name, mime_type, size, tags, description) VALUES (?, ?, ?, ?, ?, ?)').run(original_name, stored_name, mime_type, size, tags, description);
    return { ok: true, id: result.lastInsertRowid };
  } catch (e) {
    return { error: e.message };
  }
}

export function list() {
  try {
    return db.prepare('SELECT * FROM files ORDER BY uploaded_at DESC').all();
  } catch (e) {
    return { error: e.message };
  }
}

export function search({ query }) {
  try {
    const q = `%${query}%`;
    return db.prepare('SELECT * FROM files WHERE original_name LIKE ? OR tags LIKE ? OR description LIKE ?').all(q, q, q);
  } catch (e) {
    return { error: e.message };
  }
}

export function remove({ id, stored_name }) {
  try {
    // Validate stored_name to prevent path traversal
    if (!stored_name || stored_name.includes('..') || stored_name.includes('/')) {
      return { error: 'Invalid stored_name' };
    }
    db.prepare('DELETE FROM files WHERE id = ?').run(id);
    const filePath = path.join('uploads', stored_name);
    if (existsSync(filePath)) unlinkSync(filePath);
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
}
