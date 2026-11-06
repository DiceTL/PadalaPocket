import { handler as health } from './health.mjs';
import { createProofHandler } from './proof.mjs';

const proof = createProofHandler({
  createDependencies: async env => (await import('./proof-sdk.mjs')).createDependencies(env),
});

export function handler(req, res) {
  const path = new URL(req.url, 'http://localhost').pathname;
  return path === '/api/operator/proof' ? proof(req, res) : health(req, res);
}
