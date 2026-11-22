import { isFinancialPath, proxyFinancial } from './money-proxy.mjs';
import { accounts } from './accounts.mjs';
import { veloTopups } from './velo-topups.mjs';
import { family } from './family.mjs';
import { handler as health } from './health.mjs';
import { createIdentityHandler } from './identity.mjs';

const identity = createIdentityHandler();
export function handler(req, res) {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (isFinancialPath(path)) return proxyFinancial(req, res);
  if (path.startsWith('/api/accounts/')) return accounts(req,res);
  if (path === '/api/velo-topups') return veloTopups(req,res);
  if (path.startsWith('/api/family/')) return family(req, res);
  if (path === '/api/me' || path === '/api/identity-records' || path.startsWith('/api/identity-records/')) return identity(req, res);
  return health(req, res);
}
