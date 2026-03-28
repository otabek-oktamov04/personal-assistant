import db from '../core/db.js';

export function save({ amount, currency = 'USD', category = null, description = null, date = null }) {
  try {
    const d = date || new Date().toISOString().slice(0, 10);
    db.prepare('INSERT INTO expenses (amount, currency, category, description, date) VALUES (?, ?, ?, ?, ?)').run(amount, currency, category, description, d);
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
}

export function list({ month } = {}) {
  try {
    if (month) {
      return db.prepare("SELECT * FROM expenses WHERE strftime('%Y-%m', date) = ? ORDER BY date DESC").all(month);
    }
    return db.prepare('SELECT * FROM expenses ORDER BY date DESC LIMIT 50').all();
  } catch (e) {
    return { error: e.message };
  }
}

export function summary({ month }) {
  try {
    const by_category = db.prepare(`
      SELECT category, SUM(amount) as total, currency
      FROM expenses
      WHERE strftime('%Y-%m', date) = ?
      GROUP BY category, currency
    `).all(month);

    const totals = db.prepare(`
      SELECT SUM(amount) as total, currency
      FROM expenses
      WHERE strftime('%Y-%m', date) = ?
      GROUP BY currency
    `).all(month);

    return { by_category, totals };
  } catch (e) {
    return { error: e.message };
  }
}
