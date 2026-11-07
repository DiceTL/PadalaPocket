import { veloTopups } from './velo-topups.mjs';
import { purchases } from './purchases.mjs';
import { family } from './family.mjs';
import { funding } from './funding.mjs';
import { handler as health } from './health.mjs';
import { createIdentityHandler } from './identity.mjs';

const identity = createIdentityHandler();
export function handler(req, res) {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/api/velo-topups') return veloTopups(req,res);
  if (path.startsWith('/api/family/')) return family(req, res);
  if (path === '/api/purchases' || path.startsWith('/api/purchases/')) return purchases(req, res);
  if ((path === '/api/needs-funding' || path === '/api/allowance-funding')) return funding(req, res);
  if (path === '/api/me' || path === '/api/identity-records' || path.startsWith('/api/identity-records/')) return identity(req, res);
  return health(req, res);
}
