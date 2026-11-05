import { createServer } from 'node:http';
import { handler } from './health.mjs';
createServer(handler).listen(3001, '127.0.0.1', () => {
  console.log('Development API: http://127.0.0.1:3001/api/health');
});
