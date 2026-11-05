export function handler(req, res) {
  const path = new URL(req.url, 'http://localhost').pathname;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (path !== '/api/health') {
    res.statusCode = 404;
    return res.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Route not found', retryable: false } }));
  }
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
    return res.end(JSON.stringify({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET', retryable: false } }));
  }
  res.statusCode = 200;
  res.end(JSON.stringify({ status: 'ok', network: 'testnet', runtime: process.version }));
}
