import { handler as health } from './health.mjs';
import { createIdentityHandler } from './identity.mjs';

const identity = createIdentityHandler();
export function handler(req, res) {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/api/me' || path === '/api/identity-records' || path.startsWith('/api/identity-records/')) return identity(req, res);
  return health(req, res);
}
