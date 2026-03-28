import db from '../core/db.js';
import cron from 'node-cron';

const jobs = new Map();

export function save({ message, cron_expr }) {
  try {
    const result = db.prepare('INSERT INTO reminders (message, cron_expr) VALUES (?, ?)').run(message, cron_expr);
    const id = result.lastInsertRowid;
    return { ok: true, id };
  } catch (e) {
    return { error: e.message };
  }
}

export function list() {
  try {
    return db.prepare('SELECT * FROM reminders WHERE active = 1').all();
  } catch (e) {
    return { error: e.message };
  }
}

export function remove({ id }) {
  try {
    db.prepare('DELETE FROM reminders WHERE id = ?').run(id);
    if (jobs.has(id)) {
      jobs.get(id).stop();
      jobs.delete(id);
    }
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
}

export function startAll(bot) {
  const reminders = db.prepare('SELECT * FROM reminders WHERE active = 1').all();
  for (const reminder of reminders) {
    scheduleReminder(bot, reminder);
  }
}

export function scheduleReminder(bot, reminder) {
  if (!cron.validate(reminder.cron_expr)) return;
  const job = cron.schedule(reminder.cron_expr, () => {
    bot.telegram.sendMessage(process.env.TELEGRAM_USER_ID, reminder.message).catch(() => {});
  });
  jobs.set(reminder.id, job);
}
