import { test } from 'node:test';
import assert from 'node:assert/strict';
import { identifyPhoto } from '../src/purchase-providers.mjs';
test('Groq assessment uses one bounded instruct request and never retries a provider error', async () => {
  const previousFetch = globalThis.fetch, previousKey = process.env.GROQ_API_KEY;
  let calls = 0; process.env.GROQ_API_KEY = 'synthetic-key';
  globalThis.fetch = async (url, options) => {
    calls++; assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
    const body = JSON.parse(options.body); assert.equal(body.reasoning_effort, 'none'); assert.equal(body.max_completion_tokens, 512);
    return { ok: false, status: 429 };
  };
  try { await assert.rejects(identifyPhoto(Buffer.from('synthetic'), 'image/png'), error => error.aiDiagnostic.httpStatus === 429); assert.equal(calls, 1); }
  finally { globalThis.fetch = previousFetch; if (previousKey === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = previousKey; }
});
