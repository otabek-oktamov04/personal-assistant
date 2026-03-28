import 'dotenv/config';
import Database from 'better-sqlite3';
import CryptoJS from 'crypto-js';
import { mkdirSync } from 'fs';

mkdirSync('data', { recursive: true });

const db = new Database('data/personal.db');

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS vault (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    type TEXT NOT NULL,
    encrypted_value TEXT NOT NULL,
    tags TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    content TEXT NOT NULL,
    tags TEXT DEFAULT '',
    pinned INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    due_date TEXT,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'todo',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    category TEXT,
    description TEXT,
    date TEXT DEFAULT (date('now'))
  );

  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    mime_type TEXT,
    size INTEGER,
    tags TEXT DEFAULT '',
    description TEXT,
    uploaded_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS snippets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    language TEXT,
    code TEXT NOT NULL,
    tags TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    notes TEXT,
    tags TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message TEXT NOT NULL,
    cron_expr TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    module TEXT,
    at TEXT DEFAULT (datetime('now'))
  );
`);

export function encrypt(text) {
  return CryptoJS.AES.encrypt(String(text), process.env.ENCRYPT_KEY).toString();
}

export function decrypt(cipher) {
  return CryptoJS.AES.decrypt(cipher, process.env.ENCRYPT_KEY).toString(CryptoJS.enc.Utf8);
}

export function log(action, module) {
  db.prepare('INSERT INTO audit_log (action, module) VALUES (?, ?)').run(action, module);
}

export default db;
