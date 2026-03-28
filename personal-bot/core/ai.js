import 'dotenv/config';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const histories = new Map();

const SYSTEM_PROMPT = `You are a private personal assistant for one person only.

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
Be concise, direct, and helpful. Never share data with anyone other than the owner.`;

export async function chat(sessionId, userMessage) {
  if (!histories.has(sessionId)) {
    histories.set(sessionId, []);
  }

  const history = histories.get(sessionId);
  history.push({ role: 'user', content: userMessage });

  // Trim to last 40 messages
  if (history.length > 40) history.splice(0, history.length - 40);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
  });

  const reply = response.choices[0].message.content;
  history.push({ role: 'assistant', content: reply });

  return reply;
}

export function clearHistory(sessionId) {
  histories.delete(sessionId);
}
