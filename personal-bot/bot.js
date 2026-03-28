import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import path from 'path';
import https from 'https';
import { mkdirSync } from 'fs';

import { chat, clearHistory } from './core/ai.js';
import { parseAndExecute } from './core/router.js';
import * as notes from './modules/notes.js';
import * as planner from './modules/planner.js';
import * as finance from './modules/finance.js';
import * as files from './modules/files.js';
import * as reminders from './modules/reminders.js';

mkdirSync('uploads', { recursive: true });

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
const OWNER_ID = parseInt(process.env.TELEGRAM_USER_ID, 10);

function isOwner(ctx) {
  return ctx.from?.id === OWNER_ID;
}

function esc(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Keeps the typing indicator alive for the duration of an async operation
async function withTyping(ctx, fn) {
  const chatId = ctx.chat.id;
  await ctx.telegram.sendChatAction(chatId, 'typing').catch(() => {});
  const interval = setInterval(() => {
    ctx.telegram.sendChatAction(chatId, 'typing').catch(() => {});
  }, 4000);
  try {
    return await fn();
  } finally {
    clearInterval(interval);
  }
}

function html(text) {
  return { parse_mode: 'HTML', text };
}

function formatTasks(tasks) {
  if (!tasks.length) return 'No tasks found.';
  return tasks.map(t => {
    const priority = t.priority === 'high' ? '🔴' : t.priority === 'low' ? '🟢' : '🟡';
    const due = t.due_date ? ` — <i>${esc(t.due_date)}</i>` : '';
    return `${priority} <b>${esc(t.title)}</b>${due} [${esc(t.status)}]`;
  }).join('\n');
}

function formatNotes(notesList) {
  if (!notesList.length) return 'No notes found.';
  return notesList.slice(0, 10).map(n => {
    const title = n.title ? `<b>${esc(n.title)}</b>` : '<i>(untitled)</i>';
    const preview = esc(n.content.slice(0, 100)) + (n.content.length > 100 ? '…' : '');
    return `📝 ${title}\n${preview}`;
  }).join('\n\n');
}

function formatExpenses(expList) {
  if (!expList.length) return 'No expenses found.';
  return expList.slice(0, 10).map(e => {
    const desc = e.description ? ` — ${esc(e.description)}` : '';
    const cat = e.category ? esc(e.category) : 'uncategorized';
    return `• <b>${esc(e.currency)} ${e.amount}</b> · ${cat}${desc} <i>(${esc(e.date)})</i>`;
  }).join('\n');
}

function formatResult(result) {
  if (!result) return '';
  if (result.error) return `\n\n⚠️ <i>${esc(result.error)}</i>`;

  if (Array.isArray(result)) {
    if (!result.length) return '\n\n<i>No results found.</i>';
    return '\n\n' + result.map(r => {
      const lines = Object.entries(r)
        .filter(([k]) => !['encrypted_value'].includes(k))
        .map(([k, v]) => `  <b>${esc(k)}:</b> ${esc(v)}`);
      return lines.join('\n');
    }).join('\n\n');
  }

  if (result.ok) return '';

  // Single object result (e.g. vault.get)
  const lines = Object.entries(result)
    .filter(([k]) => !['encrypted_value'].includes(k))
    .map(([k, v]) => `<b>${esc(k)}:</b> <code>${esc(v)}</code>`);
  return '\n\n' + lines.join('\n');
}

const START_MESSAGE = `👋 <b>Your personal bot is ready!</b>

Here's what I can do — just type naturally:

🔐 <b>Vault</b> — save &amp; retrieve passwords, cards, secrets
📝 <b>Notes</b> — create, search, pin personal notes
✅ <b>Planner</b> — tasks with due dates &amp; priorities
💰 <b>Finance</b> — log expenses &amp; monthly summaries
📁 <b>Files</b> — upload &amp; search your files
💻 <b>Snippets</b> — save code by language &amp; tag
👥 <b>Contacts</b> — store people with email &amp; phone
⏰ <b>Reminders</b> — recurring Telegram reminders via cron

<b>Commands:</b>
/today — today's tasks
/notes — recent notes
/expenses — recent expenses
/clear — reset conversation
/help — show this message`;

// Auth guard
bot.use((ctx, next) => {
  if (!isOwner(ctx)) {
    ctx.reply('Not authorized.');
    return;
  }
  return next();
});

bot.command('start', ctx => ctx.replyWithHTML(START_MESSAGE));
bot.command('help', ctx => ctx.replyWithHTML(START_MESSAGE));

bot.command('today', async ctx => {
  try {
    await ctx.telegram.sendChatAction(ctx.chat.id, 'typing');
    const tasks = planner.today();
    const list = Array.isArray(tasks) ? tasks : [];
    await ctx.replyWithHTML(`<b>Today's Tasks</b>\n\n${formatTasks(list)}`);
  } catch {
    await ctx.reply('Something went wrong, try again.');
  }
});

bot.command('notes', async ctx => {
  try {
    await ctx.telegram.sendChatAction(ctx.chat.id, 'typing');
    const notesList = notes.list();
    const list = Array.isArray(notesList) ? notesList : [];
    await ctx.replyWithHTML(`<b>Recent Notes</b>\n\n${formatNotes(list)}`);
  } catch {
    await ctx.reply('Something went wrong, try again.');
  }
});

bot.command('expenses', async ctx => {
  try {
    await ctx.telegram.sendChatAction(ctx.chat.id, 'typing');
    const expList = finance.list();
    const list = Array.isArray(expList) ? expList : [];
    await ctx.replyWithHTML(`<b>Recent Expenses</b>\n\n${formatExpenses(list)}`);
  } catch {
    await ctx.reply('Something went wrong, try again.');
  }
});

bot.command('clear', async ctx => {
  try {
    clearHistory(String(ctx.from.id));
    await ctx.replyWithHTML('🗑 <b>Conversation cleared.</b>');
  } catch {
    await ctx.reply('Something went wrong, try again.');
  }
});

// Text messages
bot.on('text', async ctx => {
  try {
    const userId = String(ctx.from.id);
    const { text, result } = await withTyping(ctx, async () => {
      const aiReply = await chat(userId, ctx.message.text);
      return parseAndExecute(aiReply);
    });
    const resultText = formatResult(result);
    await ctx.replyWithHTML((text || '✅ Done.') + resultText);
  } catch (e) {
    await ctx.reply('Something went wrong, try again.');
  }
});

// File/document uploads
async function handleFile(ctx, fileId, originalName, mimeType) {
  try {
    await ctx.telegram.sendChatAction(ctx.chat.id, 'upload_document');
    const link = await ctx.telegram.getFileLink(fileId);
    const storedName = `${Date.now()}-${originalName.replace(/\s/g, '_')}`;
    const dest = path.join('uploads', storedName);

    await new Promise((resolve, reject) => {
      const file = createWriteStream(dest);
      https.get(link.href, response => {
        pipeline(response, file).then(resolve).catch(reject);
      }).on('error', reject);
    });

    files.record({ original_name: originalName, stored_name: storedName, mime_type: mimeType });
    await ctx.replyWithHTML(`📁 <b>File saved:</b> <code>${esc(originalName)}</code>`);
  } catch {
    await ctx.reply('Something went wrong saving the file.');
  }
}

bot.on('document', async ctx => {
  const doc = ctx.message.document;
  await handleFile(ctx, doc.file_id, doc.file_name || 'document', doc.mime_type);
});

bot.on('photo', async ctx => {
  const photo = ctx.message.photo.at(-1);
  await handleFile(ctx, photo.file_id, `photo_${Date.now()}.jpg`, 'image/jpeg');
});

// Startup
reminders.startAll(bot);
bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
