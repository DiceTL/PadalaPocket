// T38 operator caller: ask the isolated coordinator to credit one verified
// deposit. The coordinator resolves the family and destination; this script
// sends no amount, no destination and no signing material.
const [depositId, ...rest] = process.argv.slice(2);
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const usage = 'usage: MONEY_COORDINATOR_URL=… MONEY_COORDINATOR_ACCESS_TOKEN=… node apps/api/scripts/credit-deposit.mjs <depositId> [--family <uuid>] [--parent <uuid>]';

function option(name) {
  const index = rest.indexOf(name);
  if (index === -1) return undefined;
  const value = rest[index + 1];
  if (!uuid.test(value ?? '')) throw Error(`${name} requires a UUID`);
  return value;
}
function fail(message) {
  console.error(`FAIL: credit-deposit (${message})`);
  process.exitCode = 1;
}

try {
  if (!uuid.test(depositId ?? '')) throw Error(usage);
  const familyId = option('--family');
  const parentId = option('--parent');
  const unknown = rest.filter((value, index) => !['--family', '--parent'].includes(value)
    && !(index > 0 && ['--family', '--parent'].includes(rest[index - 1])));
  if (unknown.length) throw Error(usage);
  const origin = new URL(process.env.MONEY_COORDINATOR_URL ?? '');
  const local = process.env.NODE_ENV === 'test' && origin.protocol === 'http:' && origin.hostname === '127.0.0.1';
  if ((origin.protocol !== 'https:' && !local) || origin.username || origin.password
    || origin.pathname !== '/' || origin.search || origin.hash) throw Error('MONEY_COORDINATOR_URL must be a bare HTTPS origin');
  const token = process.env.MONEY_COORDINATOR_ACCESS_TOKEN ?? '';
  if (!/^[a-f0-9]{64}$/.test(token)) throw Error('MONEY_COORDINATOR_ACCESS_TOKEN must be 256-bit hex');

  const response = await fetch(new URL('/api/velo-topups/deposit-credit', origin), {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(60000),
    headers: { 'x-money-coordinator-token': token, 'content-type': 'application/json' },
    body: JSON.stringify({ depositId, ...(familyId && { familyId }), ...(parentId && { parentId }) }),
  });
  const body = await response.json().catch(() => null);
  console.log(JSON.stringify({ status: response.status, body }, null, 2));
  if (!response.ok || typeof body?.operationId !== 'string') fail(`coordinator returned ${response.status}`);
  else console.log(`PASS: credit-deposit (${body.status}${body.confirmed ? ', confirmed' : ''})`);
} catch (error) {
  fail(error.message);
}
