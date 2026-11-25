import { timingSafeEqual } from 'node:crypto';
import { funding } from './funding.mjs';
import { purchases } from './purchases.mjs';
import { weekly } from './weekly.mjs';

export function createIsolatedFinancialHandler({ writers, token, database, readiness, ensureReady, depositCredit }) {
  if (!database || !/^[a-f0-9]{64}$/.test(token ?? '')) throw Error('COORDINATOR_NOT_CONFIGURED');
  const expected = Buffer.from(token);
  const dependencies = { writers, database:()=>database };
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const supplied = Buffer.from(String(req.headers['x-money-coordinator-token'] ?? ''));
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      res.statusCode = 403; res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Forbidden.', retryable: false } })); return;
    }
    const path = new URL(req.url, 'http://localhost').pathname;
    if (req.method === 'GET' && path === '/internal/authority' && readiness) {
      const result = await readiness();
      res.statusCode = 200; res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(result)); return;
    }
    // T38: operator-only deposit credit. The public proxy never forwards this
    // path, and the route resolves the family instead of trusting the caller.
    if (path === '/api/velo-topups/deposit-credit') {
      if (!depositCredit) {
        res.statusCode = 503; res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: { code: 'PROVIDER_UNAVAILABLE', message: 'Deposit credit unavailable.', retryable: false } })); return;
      }
      if (ensureReady) await ensureReady();
      return depositCredit(req, res);
    }
    const route = ['/api/needs-funding', '/api/allowance-funding'].includes(path) ? funding
      : path === '/api/purchases' || path.startsWith('/api/purchases/') ? purchases
      : ['/api/weekly', '/api/demo/advance'].includes(path) ? weekly : null;
    if (route) {
      if (ensureReady) await ensureReady();
      return route(req, res, dependencies);
    }
    res.statusCode = 404; res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Route not found.', retryable: false } }));
  };
}
