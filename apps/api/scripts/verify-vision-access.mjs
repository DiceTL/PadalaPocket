import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { identifyPhoto, validatePhoto } from '../src/purchase-providers.mjs';

try {
  // Prove model selection locally before loading or using any credential.
  process.env.GROQ_API_KEY = 'synthetic-key';
  process.env.GROQ_VISION_MODEL = 'synthetic/model';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    assert.equal(JSON.parse(options.body).model, 'synthetic/model');
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify({ productName: 'Notebook', category: 'school_supplies', uncertain: false, prohibited: false }) } }] }) };
  };
  const local = await identifyPhoto(Buffer.from('synthetic'), 'image/jpeg');
  assert.equal(local.model, 'synthetic/model');
  globalThis.fetch = originalFetch;
  delete process.env.GROQ_API_KEY;
  delete process.env.GROQ_VISION_MODEL;

  // The owner confirmed .env.local contains the replacement credential.
  process.loadEnvFile(new URL('../../../.env.local', import.meta.url));
  assert.ok(process.env.GROQ_API_KEY);
  const bytes = await readFile(new URL('../../web/public/demo-photos/spiral-notebooks.jpg', import.meta.url));
  await validatePhoto(bytes, 'image/jpeg');
  const result = await identifyPhoto(bytes, 'image/jpeg');
  assert.ok(result.ai && typeof result.ai.uncertain === 'boolean');
  console.log('PASS: vision-access');
} catch {
  // Provider output, keys and image data are never printed.
  console.error('FAIL: vision-access');
  process.exitCode = 1;
}
