import { createClient } from '@supabase/supabase-js';
import { authenticateMember } from './identity.mjs';

export const isFinancialPath = path => ['/api/needs-funding', '/api/allowance-funding', '/api/weekly', '/api/demo/advance', '/api/purchases'].includes(path) || path.startsWith('/api/purchases/');

export function sendFinancialUnavailable(res, path) {
  const weekly = ['/api/weekly', '/api/demo/advance'].includes(path);
  const funding = ['/api/needs-funding', '/api/allowance-funding'].includes(path);
  res.statusCode = 503;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ error: {
    code: weekly ? 'WEEKLY_UNAVAILABLE' : 'PROVIDER_UNAVAILABLE',
    message: weekly ? 'Weekly service unavailable.' : 'Financial service unavailable.',
    retryable: funding,
  } }));
}

export async function proxyFinancial(req, res, { env = process.env } = {}) {
  const signal = AbortSignal.timeout(290000);
  const target = new URL(req.url, 'http://localhost');
  const path = target.pathname;
  res.setHeader('Cache-Control', 'no-store');
  let onAbort;
  const deadline = new Promise((_, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    const { response, bytes, type } = await Promise.race([forward(), deadline]);
    res.statusCode = response.status;
    res.setHeader('Content-Type', type);
    if (response.headers.has('allow')) res.setHeader('Allow', response.headers.get('allow'));
    if (response.headers.has('x-content-type-options')) res.setHeader('X-Content-Type-Options', response.headers.get('x-content-type-options'));
    res.end(bytes);
  } catch (error) {
    if (['UNAUTHENTICATED', 'ACCOUNT_SETUP_REQUIRED', 'WALLET_SETUP_REQUIRED'].includes(error.code)) {
      res.statusCode = error.status; res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: { code: error.code, message: error.message, retryable: false } })); return;
    }
    if (error.status === 400) {
      res.statusCode = 400; res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: { code: 'INVALID_INPUT', message: 'INVALID_INPUT', retryable: false } })); return;
    }
    sendFinancialUnavailable(res, path);
  } finally {
    signal.removeEventListener('abort', onAbort);
  }

  async function forward() {
    // Preserve user Auth errors while bounding both Supabase calls by the same deadline.
    await authenticateMember(req, env, (url, key, options) => createClient(url, key, {
      ...options,
      global: { ...options.global, fetch: (input, init) => {
        signal.throwIfAborted();
        return fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([signal, init.signal]) : signal });
      } },
    }));
    signal.throwIfAborted();
    const origin = new URL(env.MONEY_COORDINATOR_URL);
    if ((origin.protocol !== 'https:' && !(env.NODE_ENV === 'test' && origin.protocol === 'http:' && origin.hostname === '127.0.0.1'))
      || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash
      || !/^[a-f0-9]{64}$/.test(env.MONEY_COORDINATOR_ACCESS_TOKEN ?? '') || !isFinancialPath(path)) throw Error();
    const headers = { 'x-money-coordinator-token': env.MONEY_COORDINATOR_ACCESS_TOKEN };
    for (const key of ['authorization', 'idempotency-key', 'content-type']) if (req.headers[key]) headers[key] = req.headers[key];
    let body;
    if (!['GET', 'HEAD'].includes(req.method)) {
      if (req.body !== undefined) body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      else {
        const chunks = []; let size = 0;
        for await (const chunk of req) {
          signal.throwIfAborted();
          size += Buffer.byteLength(chunk);
          if (size > 3000000) throw Object.assign(Error(), { status: 400 });
          chunks.push(Buffer.from(chunk));
        }
        body = Buffer.concat(chunks);
      }
      if (Buffer.byteLength(body) > 3000000) throw Object.assign(Error(), { status: 400 });
    }
    signal.throwIfAborted();
    const response = await fetch(new URL(path + target.search, origin), {
      method: req.method, headers, body, redirect: 'error', signal,
    });
    const type = response.headers.get('content-type') ?? '';
    const json = /^application\/json(?:\s*;|$)/i.test(type);
    if (!json && !(response.ok && /^\/api\/purchases\/[^/]+\/photo$/.test(path) && /^image\/(?:png|jpeg)$/i.test(type))) {
      await response.body?.cancel();
      throw Error();
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!response.ok) {
      const { error } = JSON.parse(bytes);
      if (typeof error?.code !== 'string' || typeof error.message !== 'string' || typeof error.retryable !== 'boolean') throw Error();
    }
    return { response, bytes, type };
  }
}
