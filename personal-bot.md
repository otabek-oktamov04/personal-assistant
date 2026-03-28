# Personal AI Bot — Full Project Documentation

> **For Claude Code:** Read this entire document before writing any code. Implement the project exactly as specified. All modules, file paths, function signatures, and database schemas are defined here. Do not deviate from the structure unless a section says "optional."

---

## Project Overview

A self-hosted personal AI assistant for one user (you). It runs as a **Telegram bot** powered by **OpenAI GPT-4o**. All data is stored locally in an **AES-256 encrypted SQLite database**. The bot understands natural language and can save/retrieve passwords, card numbers, files, notes, tasks, expenses, code snippets, and contacts.

### Core principles

- Single user only — no multi-tenancy
- Everything encrypted at rest (AES-256 via CryptoJS)
- JWT auth on all REST endpoints
- Telegram as the primary interface
- OpenAI GPT-4o for natural language understanding
- No cloud database — SQLite file only

---

## Tech Stack

| Layer               | Technology                                 |
| ------------------- | ------------------------------------------ |
| Runtime             | Node.js 20+ (ESM modules)                  |
| AI                  | OpenAI GPT-4o (`openai` npm package)       |
| Bot                 | Telegram (`telegraf`)                      |
| HTTP API            | Express                                    |
| Database            | SQLite (`better-sqlite3`)                  |
| Encryption          | AES-256 (`crypto-js`)                      |
| Auth                | JWT (`jsonwebtoken`) + bcrypt (`bcryptjs`) |
| File uploads        | `multer`                                   |
| Scheduled reminders | `node-cron`                                |
| Rate limiting       | `express-rate-limit`                       |

---

## Project File Structure

Create exactly this file and folder structure:

```
personal-bot/
├── .env                        # secrets — never commit
├── .gitignore
├── package.json
├── server.js                   # Express REST API entry point
├── bot.js                      # Telegram bot entry point
│
├── core/
│   ├── ai.js                   # OpenAI client + conversation history
│   ├── auth.js                 # JWT sign/verify + master password check
│   ├── db.js                   # SQLite connection, schema, encrypt/decrypt helpers
│   └── router.js               # Parses AI action JSON → calls correct module
│
├── modules/
│   ├── vault.js                # Passwords & card numbers (always encrypted)
│   ├── files.js                # File metadata (actual files go to /uploads)
│   ├── notes.js                # Notes with tags, search, pin
│   ├── planner.js              # Tasks with status, priority, due date
│   ├── finance.js              # Expenses with category, currency, monthly summary
│   ├── snippets.js             # Code snippets by language and tag
│   ├── contacts.js             # People with email, phone, notes
│   └── reminders.js            # Cron-based Telegram reminders
│
├── uploads/                    # Binary files stored here (gitignored)
└── data/
    └── personal.db             # SQLite database file (gitignored)
```

---

## Environment Variables

Create `.env` in the project root with these exact keys:

```env
OPENAI_API_KEY=sk-...
MASTER_PASSWORD_HASH=                # bcrypt hash of your chosen master password
JWT_SECRET=                          # random 64-character string
ENCRYPT_KEY=                         # random 32-character string
TELEGRAM_TOKEN=                      # from @BotFather on Telegram
TELEGRAM_USER_ID=                    # your personal Telegram numeric user ID
PORT=3000
```

### How to generate values

```bash
# Generate MASTER_PASSWORD_HASH (run once, paste output into .env)
node -e "import('bcryptjs').then(b => console.log(b.default.hashSync('YourChosenPassword', 12)))"

# Generate JWT_SECRET (64 random chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate ENCRYPT_KEY (32 random chars)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"

# Get your Telegram user ID
# Message @userinfobot on Telegram — it replies with your numeric ID
```

---

## `package.json`

```json
{
  "name": "personal-bot",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "bot": "node bot.js",
    "setup": "node -e \"import('./core/db.js')\""
  },
  "dependencies": {
    "openai": "^4.47.0",
    "express": "^4.18.2",
    "better-sqlite3": "^9.4.3",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "multer": "^1.4.5-lts.1",
    "node-cron": "^3.0.3",
    "telegraf": "^4.15.6",
    "dotenv": "^16.4.5",
    "crypto-js": "^4.2.0",
    "express-rate-limit": "^7.2.0"
  }
}
```

---

## `.gitignore`

```
.env
data/
uploads/
node_modules/
```

---

## `core/db.js`

Responsibilities:

- Open/create the SQLite database at `data/personal.db`
- Enable WAL journal mode for performance
- Create all tables on first run (idempotent — use `CREATE TABLE IF NOT EXISTS`)
- Export `encrypt(text)` and `decrypt(cipher)` helpers using AES-256
- Export `log(action, module)` to write to `audit_log`
- Export `db` as the default export (the raw `better-sqlite3` instance)

### Tables to create

**vault**

```sql
CREATE TABLE IF NOT EXISTS vault (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  type TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  tags TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);
```

**notes**

```sql
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  content TEXT NOT NULL,
  tags TEXT DEFAULT '',
  pinned INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

**tasks**

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  due_date TEXT,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'todo',
  created_at TEXT DEFAULT (datetime('now'))
);
```

**expenses**

```sql
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  category TEXT,
  description TEXT,
  date TEXT DEFAULT (date('now'))
);
```

**files**

```sql
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
```

**snippets**

```sql
CREATE TABLE IF NOT EXISTS snippets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  language TEXT,
  code TEXT NOT NULL,
  tags TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);
```

**contacts**

```sql
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  notes TEXT,
  tags TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);
```

**reminders**

```sql
CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message TEXT NOT NULL,
  cron_expr TEXT NOT NULL,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
```

**audit_log**

```sql
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  module TEXT,
  at TEXT DEFAULT (datetime('now'))
);
```

### encrypt / decrypt

Use `CryptoJS.AES.encrypt(String(text), process.env.ENCRYPT_KEY).toString()` for encryption.
Use `CryptoJS.AES.decrypt(cipher, process.env.ENCRYPT_KEY).toString(CryptoJS.enc.Utf8)` for decryption.

---

## `core/auth.js`

Export these functions:

```
verifyMaster(password: string) → boolean
  Uses bcrypt.compareSync against process.env.MASTER_PASSWORD_HASH

signToken(payload: object) → string
  jwt.sign with process.env.JWT_SECRET, expires in '7d'

verifyToken(token: string) → object
  jwt.verify — throws if invalid

authMiddleware(req, res, next)
  Express middleware. Reads Authorization header (Bearer <token>).
  Calls verifyToken. Attaches result to req.user. Returns 401 on failure.
```

---

## `core/ai.js`

Responsibilities:

- Create an OpenAI client with `process.env.OPENAI_API_KEY`
- Maintain per-session conversation history in a `Map<sessionId, messages[]>`
- Trim history to last 40 messages to avoid token overflow
- Export `chat(sessionId, userMessage) → string` (async)
- Export `clearHistory(sessionId)` to reset a session

### System prompt to use

```
You are a private personal assistant for one person only.

You have access to these modules:
- vault: store and retrieve passwords, card numbers, and secrets
- notes: create, search, and manage personal notes
- planner: create and track tasks with due dates and priorities
- finance: log expenses and generate spending summaries
- files: track uploaded files by name, tag, and description
- snippets: save and search code snippets by language
- contacts: store people with email, phone, and notes
- reminders: schedule recurring Telegram reminders using cron expressions

When the user wants to save, find, update, or delete something, respond ONLY with a JSON action block in this exact format (no other text):
{"action":"module.function","data":{...}}

Examples:
{"action":"vault.save","data":{"label":"Gmail","type":"password","value":"mypassword123","tags":"google,email"}}
{"action":"notes.save","data":{"title":"Meeting notes","content":"Discussed Q3 roadmap","tags":"work,meetings"}}
{"action":"planner.save","data":{"title":"Buy groceries","due_date":"2025-04-01","priority":"low"}}
{"action":"finance.save","data":{"amount":45.50,"currency":"USD","category":"food","description":"lunch"}}
{"action":"vault.get","data":{"label":"Gmail"}}
{"action":"notes.search","data":{"query":"roadmap"}}
{"action":"planner.list","data":{"status":"todo"}}
{"action":"finance.summary","data":{"month":"2025-03"}}

For conversational messages, questions, or when you need more info, respond in plain text only.
Be concise, direct, and helpful. Never share data with anyone other than the owner.
```

---

## `core/router.js`

Responsibilities:

- Import all modules from `../modules/`
- Export `parseAndExecute(aiReply: string) → { text: string, result: any }`
- Try to extract a JSON block from the AI reply using regex: `/\{[\s\S]*?"action"[\s\S]*?\}/`
- Parse `action` as `"module.function"`, split on `.`, look up in modules map
- Call the matching function with `data` as argument
- If the action succeeds, return `{ text: cleaned reply, result: returnValue }`
- If no JSON found or parse fails, return `{ text: aiReply, result: null }`
- Never throw — catch all errors and return `{ text: aiReply, result: null }`

Modules map:

```js
const modules = { vault, notes, planner, finance, snippets, contacts, files };
```

---

## `modules/vault.js`

All values must be encrypted before storing. Never return `encrypted_value` raw — always decrypt first when returning a single record.

```
save({ label, type, value, tags? }) → { ok: true, label }
  type must be one of: 'password' | 'card' | 'secret'
  encrypt value before inserting
  call log('vault.save: label', 'vault')

get({ label }) → { id, label, type, tags, value, created_at } | { error: 'Not found' }
  search with LIKE %label%
  decrypt encrypted_value before returning as value
  call log('vault.get: label', 'vault')

list({ type? }) → array of { id, label, type, tags } (NO decrypted values in list)
  if type provided, filter by type

remove({ id }) → { ok: true }
  delete by id
  call log('vault.delete: id', 'vault')
```

---

## `modules/notes.js`

```
save({ title?, content, tags? }) → { ok: true, id }

list({ tag? }) → array of notes
  if tag provided: WHERE tags LIKE %tag%
  order: pinned DESC, updated_at DESC

search({ query }) → array of notes
  WHERE title LIKE %query% OR content LIKE %query% OR tags LIKE %query%

update({ id, title?, content?, tags?, pinned? }) → { ok: true }
  use COALESCE to only update provided fields
  always update updated_at to datetime('now')

remove({ id }) → { ok: true }
```

---

## `modules/planner.js`

```
save({ title, description?, due_date?, priority? }) → { ok: true, id }
  priority defaults to 'medium'
  status defaults to 'todo'

list({ status? }) → array of tasks
  order by due_date ASC

update({ id, status?, title?, due_date?, priority? }) → { ok: true }
  use COALESCE

remove({ id }) → { ok: true }

today() → array of tasks
  WHERE date(due_date) <= date('now') AND status != 'done'
```

---

## `modules/finance.js`

```
save({ amount, currency?, category?, description?, date? }) → { ok: true }
  date defaults to today's date (date('now'))
  currency defaults to 'USD'

list({ month? }) → array of expenses
  if month provided (format: 'YYYY-MM'): filter with strftime('%Y-%m', date) = month
  else: last 50 records, ORDER BY date DESC

summary({ month }) → { by_category: [...], totals: [...] }
  by_category: SELECT category, SUM(amount) as total, currency GROUP BY category, currency
  totals: SELECT SUM(amount) as total, currency GROUP BY currency
  both filtered to the given month
```

---

## `modules/snippets.js`

```
save({ title, language?, code, tags? }) → { ok: true, id }

list({ language? }) → array of snippets
  if language: WHERE language = ?

search({ query }) → array of snippets
  WHERE title LIKE %query% OR code LIKE %query% OR tags LIKE %query%

remove({ id }) → { ok: true }
```

---

## `modules/contacts.js`

```
save({ name, email?, phone?, notes?, tags? }) → { ok: true, id }

list() → array of contacts, ORDER BY name ASC

search({ query }) → array of contacts
  WHERE name LIKE %query% OR email LIKE %query% OR phone LIKE %query% OR notes LIKE %query%

update({ id, name?, email?, phone?, notes?, tags? }) → { ok: true }

remove({ id }) → { ok: true }
```

---

## `modules/files.js`

This module only manages metadata. Actual file bytes are stored in `uploads/` by multer.

```
record({ original_name, stored_name, mime_type, size, tags?, description? }) → { ok: true, id }

list() → array of file records, ORDER BY uploaded_at DESC

search({ query }) → array of file records
  WHERE original_name LIKE %query% OR tags LIKE %query% OR description LIKE %query%

remove({ id, stored_name }) → { ok: true }
  DELETE from DB and also delete the physical file at uploads/stored_name using fs.unlinkSync
  check fs.existsSync before unlinking
```

---

## `modules/reminders.js`

Responsibilities:

- Export `save({ message, cron_expr })` → inserts into DB, starts a cron job immediately
- Export `list()` → returns all active reminders
- Export `remove({ id })` → deletes from DB and stops the cron job
- Export `startAll(bot)` → called once at startup, loads all active reminders from DB and schedules them
- Keep a `Map<id, CronJob>` in memory to track running jobs so they can be cancelled
- Each cron job fires `bot.telegram.sendMessage(process.env.TELEGRAM_USER_ID, message)`

```
save({ message, cron_expr }) → { ok: true, id }
remove({ id }) → { ok: true }
list() → array of reminder records
startAll(bot) → void (schedules all active reminders)
```

---

## `server.js`

Full Express REST API. Require `dotenv/config` at the top.

### Middleware

- `express.json()`
- `express-rate-limit`: 200 requests per 15 minutes
- `authMiddleware` on all routes except `/auth/login`

### Multer config

- `diskStorage` destination: `uploads/`
- filename: `${Date.now()}-${file.originalname.replace(/\s/g, '_')}`
- fileSize limit: 50MB

### Routes

```
POST   /auth/login            → verify master password → return JWT token

POST   /chat                  → { message, session? } → AI chat → { reply, data }

POST   /vault                 → vault.save(body)
GET    /vault                 → vault.list(query)
GET    /vault/:label          → vault.get(params)
DELETE /vault/:id             → vault.remove(params)

POST   /notes                 → notes.save(body)
GET    /notes                 → notes.list(query)
GET    /notes/search          → notes.search(query)
PATCH  /notes/:id             → notes.update({ id, ...body })
DELETE /notes/:id             → notes.remove(params)

POST   /tasks                 → planner.save(body)
GET    /tasks                 → planner.list(query)
GET    /tasks/today           → planner.today()
PATCH  /tasks/:id             → planner.update({ id, ...body })
DELETE /tasks/:id             → planner.remove(params)

POST   /expenses              → finance.save(body)
GET    /expenses              → finance.list(query)
GET    /expenses/summary      → finance.summary(query)

POST   /files                 → multer single upload → files.record(file metadata + body)
GET    /files                 → files.list()
GET    /files/search          → files.search(query)
GET    /files/:stored_name    → res.sendFile from uploads/ directory
DELETE /files/:id             → files.remove(body)

POST   /reminders             → reminders.save(body)
GET    /reminders             → reminders.list()
DELETE /reminders/:id         → reminders.remove(params)
```

Start server on `process.env.PORT` (default 3000).

---

## `bot.js`

Telegram bot using `telegraf`. Require `dotenv/config` at the top.

### Security

- On every incoming message, check `ctx.from.id` against `process.env.TELEGRAM_USER_ID`
- If it does not match: reply "Not authorized." and return immediately
- Never process messages from anyone else

### Commands

```
/start     → Reply: "Your personal bot is ready. Send me anything."
/help      → Reply with a help message listing what the bot can do
/today     → Call planner.today() and format as a task list
/notes     → Call notes.list() and show last 10 notes
/expenses  → Call finance.list() and show last 10 expenses
/clear     → Call clearHistory(userId) and reply "Conversation cleared."
```

### Text messages

For all non-command text:

1. Call `chat(userId, text)` from `core/ai.js`
2. Call `parseAndExecute(aiReply)` from `core/router.js`
3. Reply with `text` from the result
4. If `result` is not null, also append a formatted summary of the result

### File/document uploads

When the user sends a file or photo to Telegram:

1. Download the file using `ctx.telegram.getFileLink(fileId)`
2. Save it to `uploads/` with a timestamped name
3. Call `files.record(...)` to store metadata
4. Reply: "File saved: filename"

### Startup

At the end of `bot.js`, after creating the bot instance:

1. Call `reminders.startAll(bot)` to schedule all saved reminders
2. Call `bot.launch()`
3. Handle `process.once('SIGINT', () => bot.stop('SIGINT'))`
4. Handle `process.once('SIGTERM', () => bot.stop('SIGTERM'))`

---

## AI Conversation Flow

```
User message (Telegram or /chat endpoint)
        ↓
core/ai.js  chat(sessionId, message)
  - Appends message to session history
  - Sends full history + system prompt to GPT-4o
  - Returns raw AI reply string
        ↓
core/router.js  parseAndExecute(aiReply)
  - Looks for JSON action block in reply
  - If found → calls correct module function
  - Returns { text, result }
        ↓
Reply sent to user
```

---

## Data Security Rules

1. **Vault values are ALWAYS encrypted** — call `encrypt()` before every INSERT, `decrypt()` after every SELECT that returns a value
2. **Never return raw `encrypted_value`** from any API response
3. **Never log decrypted values** — audit log stores action names only
4. **The list endpoints** for vault return only `id, label, type, tags` — never the decrypted value
5. **File paths** are validated — `stored_name` must not contain `..` or `/` before passing to `fs` or `res.sendFile`
6. **JWT expiry** is 7 days — re-login required after that

---

## Error Handling Rules

- All module functions use try/catch and return `{ error: message }` on failure — never throw to the caller
- All Express routes wrap module calls and return appropriate HTTP status codes:
  - 200 for success
  - 400 for bad input
  - 401 for auth failure
  - 404 for not found
  - 500 for unexpected errors
- The Telegram bot wraps all message handlers in try/catch and sends "Something went wrong, try again." on error
- `core/router.js` never throws — all errors are caught and the original AI reply is returned as text

---

## Startup Sequence

When running `node bot.js`:

1. Load `.env` via `dotenv/config`
2. Import `core/db.js` → this runs `CREATE TABLE IF NOT EXISTS` for all tables
3. Import all modules
4. Create Telegraf bot instance
5. Register all command and message handlers
6. Call `reminders.startAll(bot)`
7. Call `bot.launch()`

When running `node server.js`:

1. Load `.env`
2. Import `core/db.js` → creates tables
3. Set up Express with middleware
4. Register all routes
5. Start listening on PORT

---

## Example Telegram Conversations

These show what the bot should handle naturally:

```
User: save my Gmail password: hunter2
Bot:  Done! Saved "Gmail" password to vault.

User: what's my Gmail password?
Bot:  Gmail password: hunter2

User: add a task: call dentist, due Friday, high priority
Bot:  Task added: "Call dentist" due 2025-04-04, high priority.

User: what tasks do I have today?
Bot:  Today's tasks:
      • Call dentist (high) — due today
      • Review pull request (medium) — overdue

User: save note: project ideas — build a chrome extension for tab management
Bot:  Note saved! Title: "project ideas"

User: search my notes for chrome
Bot:  Found 1 note:
      "project ideas" — build a chrome extension for tab management

User: I spent $45 on lunch today
Bot:  Logged: $45.00 on food (today)

User: show my expenses for March 2025
Bot:  March 2025 expenses:
      Food: $320.00
      Transport: $85.00
      Total: $405.00

User: save code snippet — Python list comprehension
      squares = [x**2 for x in range(10)]
Bot:  Snippet saved! "Python list comprehension" (Python)

User: save contact: John Doe, email john@example.com, phone +1234567890
Bot:  Contact saved: John Doe

User: remind me every day at 9am to check my tasks
Bot:  Reminder set! "check my tasks" — daily at 9:00 AM (cron: 0 9 * * *)
```

---

## Cron Expression Reference

For the reminders module, common expressions to support:

```
Every day at 9am    → 0 9 * * *
Every Monday 9am    → 0 9 * * 1
Every hour          → 0 * * * *
Every 30 minutes    → */30 * * * *
Every weekday 8am   → 0 8 * * 1-5
First of month      → 0 9 1 * *
```

When AI detects a reminder request, it should generate the correct cron expression and include it in the action data.

---

## Running the Project

```bash
# Install
npm install

# Create folders
mkdir -p data uploads

# Generate master password hash
node -e "import('bcryptjs').then(b => console.log(b.default.hashSync('YourPassword', 12)))"

# Fill in .env with all required values

# Start Telegram bot (primary)
npm run bot

# Or start REST API only
npm start
```

---

## What NOT to implement

- No web frontend (Telegram only for now)
- No multi-user support
- No OAuth — single master password only
- No cloud sync — local SQLite only
- No Docker — run directly with Node.js
- No TypeScript — plain ESM JavaScript only

---

## Implementation Order for Claude Code

Implement in this exact order to avoid import errors:

1. `package.json` + install dependencies
2. `.env` + `.gitignore`
3. `mkdir -p data uploads`
4. `core/db.js` — database + schema + helpers
5. `core/auth.js` — JWT + bcrypt
6. `core/ai.js` — OpenAI client + chat history
7. `modules/vault.js`
8. `modules/notes.js`
9. `modules/planner.js`
10. `modules/finance.js`
11. `modules/snippets.js`
12. `modules/contacts.js`
13. `modules/files.js`
14. `modules/reminders.js`
15. `core/router.js` — imports all modules
16. `server.js` — imports core + modules
17. `bot.js` — imports core + modules + reminders.startAll

Test each module file compiles before moving to the next.
