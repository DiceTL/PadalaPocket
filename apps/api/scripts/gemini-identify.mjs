// B-004 one-image product identification proof. Keys stay in .env.local.
import { readFile, writeFile } from 'node:fs/promises';

const imagePath = process.argv[2];
const key = process.env.GEMINI_API_KEY;
const models = (process.env.GEMINI_VISION_MODELS || 'gemini-3.5-flash-lite,gemini-3.8-flash')
  .split(',').map(value => value.trim()).filter(Boolean).slice(0, 3);
const dailyLimit = Math.min(3, Math.max(1, Number(process.env.GEMINI_DAILY_TEST_LIMIT || 1)));
if (!Number.isInteger(dailyLimit)) throw new Error('INVALID_DAILY_LIMIT');
const usagePath = '.env.b004-gemini-usage.json';
if (!imagePath || !key || models.length === 0) throw new Error('USAGE: GEMINI_API_KEY=... node --env-file=.env.local apps/api/scripts/gemini-identify.mjs <image-path>');
const usage = await readFile(usagePath, 'utf8').then(JSON.parse).catch(error => { if (error.code !== 'ENOENT') throw error; return { date: new Date().toISOString().slice(0, 10), attempts: 0 }; });
if (!Number.isInteger(usage.attempts) || usage.attempts < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(usage.date)) throw new Error('INVALID_USAGE_STATE');
const today = new Date().toISOString().slice(0, 10);
if (usage.date !== today) { usage.date = today; usage.attempts = 0; }
if (usage.attempts >= dailyLimit) throw new Error('DAILY_TEST_LIMIT_REACHED');
const bytes = await readFile(imagePath);
const mimeType = imagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
let lastError;
for (const model of models) {
  if (usage.attempts >= dailyLimit) throw new Error('DAILY_TEST_LIMIT_REACHED');
  usage.attempts++;
  await writeFile(usagePath, JSON.stringify(usage), { mode: 0o600 });
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ parts: [
      { text: 'Identify the main product shown. Return only JSON: {"productName": string or null, "category": one of needs|wants|unknown, "uncertain": boolean}. Use unknown and uncertain=true when unsure. Do not infer price, nutritional safety, or purchase approval.' },
      { inline_data: { mime_type: mimeType, data: bytes.toString('base64') } },
    ] }] }), signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) { lastError = `Gemini HTTP ${response.status}`; if (response.status === 429 || response.status >= 500) continue; throw new Error(lastError); }
  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('GEMINI_EMPTY_RESPONSE');
  console.log(JSON.stringify({ model, identification: JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')) }));
  process.exit(0);
}
throw new Error(lastError || 'ALL_GEMINI_MODELS_FAILED');
