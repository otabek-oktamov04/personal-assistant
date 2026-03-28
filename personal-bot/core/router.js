import * as vault from '../modules/vault.js';
import * as notes from '../modules/notes.js';
import * as planner from '../modules/planner.js';
import * as finance from '../modules/finance.js';
import * as snippets from '../modules/snippets.js';
import * as contacts from '../modules/contacts.js';
import * as files from '../modules/files.js';

const modules = { vault, notes, planner, finance, snippets, contacts, files };

export function parseAndExecute(aiReply) {
  try {
    const match = aiReply.match(/\{[\s\S]*?"action"[\s\S]*?\}/);
    if (!match) return { text: aiReply, result: null };

    const parsed = JSON.parse(match[0]);
    const { action, data } = parsed;
    if (!action || typeof action !== 'string') return { text: aiReply, result: null };

    const [moduleName, fnName] = action.split('.');
    const mod = modules[moduleName];
    if (!mod || typeof mod[fnName] !== 'function') return { text: aiReply, result: null };

    const result = mod[fnName](data || {});
    const text = aiReply.replace(match[0], '').trim() || aiReply;
    return { text, result };
  } catch {
    return { text: aiReply, result: null };
  }
}
