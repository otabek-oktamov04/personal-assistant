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

function formatTasks(tasks) {
  if (!tasks.length) return 'No tasks found.';
  return tasks.map(t => `• ${t.title} (${t.priority}) — ${t.due_date || 'no due date'} [${t.status}]`).join('\n');
}

function formatNotes(notesList) {
  if (!notesList.length) return 'No notes found.';
  return notesList.slice(0, 10).map(n => `📝 ${n.title || '(untitled)'}: ${n.content.slice(0, 80)}${n.content.length > 80 ? '…' : ''}`).join('\n');
}

function formatExpenses(expList) {
  if (!expList.length) return 'No expenses found.';
  return expList.slice(0, 10).map(e => `• ${e.date} ${e.category || ''}: ${e.currency} ${e.amount}${e.description ? ' — ' + e.description : ''}`).join('\n');
}

function formatResult(result) {
  if (!result) return '';
  if (result.error) return `\n⚠️ ${result.error}`;
  if (Array.isArray(result)) {
    if (!result.length) return '\n(no results)';
    return '\n' + result.map(r => JSON.stringify(r)).join('\n');
  }
  if (result.ok) return '\n✅ Done.';
  return '\n' + JSON.stringify(result, null, 2);
}

// Auth guard
bot.use((ctx, next) => {
  if (!isOwner(ctx)) {
    ctx.reply('Not authorized.');
    return;
  }
  return next();
});

bot.command('start', ctx => ctx.reply('Your personal bot is ready. Send me anything.'));

bot.command('help', ctx => ctx.reply(
  'What I can do:\n\n' +
  '🔐 Save passwords, cards, secrets (vault)\n' +
  '📝 Create and search notes\n' +
  '✅ Manage tasks with due dates & priorities\n' +
  '💰 Log and summarize expenses\n' +
  '📁 Store and search files\n' +
  '💻 Save code snippets\n' +
  '👥 Manage contacts\n' +
  '⏰ Schedule recurring reminders\n\n' +
  'Commands:\n' +
  '/today — today\'s tasks\n' +
  '/notes — recent notes\n' +
  '/expenses — recent expenses\n' +
  '/clear — clear conversation history\n\n' +
  'Just type naturally to save or retrieve anything!'
));

bot.command('today', async ctx => {
  try {
    const tasks = planner.today();
    await ctx.reply("Today's tasks:\n" + formatTasks(Array.isArray(tasks) ? tasks : []));
  } catch {
    await ctx.reply('Something went wrong, try again.');
  }
});

bot.command('notes', async ctx => {
  try {
    const notesList = notes.list();
    await ctx.reply(formatNotes(Array.isArray(notesList) ? notesList : []));
  } catch {
    await ctx.reply('Something went wrong, try again.');
  }
});

bot.command('expenses', async ctx => {
  try {
    const expList = finance.list();
    await ctx.reply(formatExpenses(Array.isArray(expList) ? expList : []));
  } catch {
    await ctx.reply('Something went wrong, try again.');
  }
});

bot.command('clear', async ctx => {
  try {
    clearHistory(String(ctx.from.id));
    await ctx.reply('Conversation cleared.');
  } catch {
    await ctx.reply('Something went wrong, try again.');
  }
});

// Text messages
bot.on('text', async ctx => {
  try {
    const userId = String(ctx.from.id);
    const aiReply = await chat(userId, ctx.message.text);
    const { text, result } = parseAndExecute(aiReply);
    const resultText = formatResult(result);
    await ctx.reply((text || aiReply) + resultText);
  } catch (e) {
    await ctx.reply('Something went wrong, try again.');
  }
});

// File/document uploads
async function handleFile(ctx, fileId, originalName, mimeType) {
  try {
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
    await ctx.reply(`File saved: ${originalName}`);
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
