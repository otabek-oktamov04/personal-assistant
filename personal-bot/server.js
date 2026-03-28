import 'dotenv/config';
import express from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

import { authMiddleware, verifyMaster, signToken } from './core/auth.js';
import { chat } from './core/ai.js';
import { parseAndExecute } from './core/router.js';
import * as vault from './modules/vault.js';
import * as notes from './modules/notes.js';
import * as planner from './modules/planner.js';
import * as finance from './modules/finance.js';
import * as files from './modules/files.js';
import * as reminders from './modules/reminders.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

// Multer config
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s/g, '_')}`),
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// Auth route (no middleware)
app.post('/auth/login', (req, res) => {
  try {
    const { password } = req.body;
    if (!password || !verifyMaster(password)) return res.status(401).json({ error: 'Invalid password' });
    const token = signToken({ user: 'owner' });
    res.json({ token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Apply auth middleware to all subsequent routes
app.use(authMiddleware);

// Chat
app.post('/chat', async (req, res) => {
  try {
    const { message, session } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });
    const sessionId = session || 'api';
    const aiReply = await chat(sessionId, message);
    const { text, result } = parseAndExecute(aiReply);
    res.json({ reply: text, data: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Vault
app.post('/vault', (req, res) => {
  const r = vault.save(req.body);
  res.status(r.error ? 400 : 200).json(r);
});
app.get('/vault', (req, res) => res.json(vault.list(req.query)));
app.get('/vault/:label', (req, res) => {
  const r = vault.get({ label: req.params.label });
  res.status(r.error ? 404 : 200).json(r);
});
app.delete('/vault/:id', (req, res) => res.json(vault.remove({ id: req.params.id })));

// Notes
app.post('/notes', (req, res) => {
  const r = notes.save(req.body);
  res.status(r.error ? 400 : 200).json(r);
});
app.get('/notes', (req, res) => res.json(notes.list(req.query)));
app.get('/notes/search', (req, res) => res.json(notes.search(req.query)));
app.patch('/notes/:id', (req, res) => res.json(notes.update({ id: req.params.id, ...req.body })));
app.delete('/notes/:id', (req, res) => res.json(notes.remove({ id: req.params.id })));

// Tasks
app.post('/tasks', (req, res) => {
  const r = planner.save(req.body);
  res.status(r.error ? 400 : 200).json(r);
});
app.get('/tasks', (req, res) => res.json(planner.list(req.query)));
app.get('/tasks/today', (req, res) => res.json(planner.today()));
app.patch('/tasks/:id', (req, res) => res.json(planner.update({ id: req.params.id, ...req.body })));
app.delete('/tasks/:id', (req, res) => res.json(planner.remove({ id: req.params.id })));

// Expenses
app.post('/expenses', (req, res) => {
  const r = finance.save(req.body);
  res.status(r.error ? 400 : 200).json(r);
});
app.get('/expenses', (req, res) => res.json(finance.list(req.query)));
app.get('/expenses/summary', (req, res) => res.json(finance.summary(req.query)));

// Files
app.post('/files', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const r = files.record({
      original_name: req.file.originalname,
      stored_name: req.file.filename,
      mime_type: req.file.mimetype,
      size: req.file.size,
      tags: req.body.tags || '',
      description: req.body.description || null,
    });
    res.status(r.error ? 400 : 200).json(r);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.get('/files', (req, res) => res.json(files.list()));
app.get('/files/search', (req, res) => res.json(files.search(req.query)));
app.get('/files/:stored_name', (req, res) => {
  const stored_name = req.params.stored_name;
  if (stored_name.includes('..') || stored_name.includes('/')) {
    return res.status(400).json({ error: 'Invalid file name' });
  }
  res.sendFile(path.join(__dirname, 'uploads', stored_name));
});
app.delete('/files/:id', (req, res) => res.json(files.remove({ id: req.params.id, stored_name: req.body.stored_name })));

// Reminders
app.post('/reminders', (req, res) => res.json(reminders.save(req.body)));
app.get('/reminders', (req, res) => res.json(reminders.list()));
app.delete('/reminders/:id', (req, res) => res.json(reminders.remove({ id: req.params.id })));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
