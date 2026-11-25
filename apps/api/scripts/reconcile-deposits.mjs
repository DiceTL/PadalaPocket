import { Keypair } from '@stellar/stellar-sdk';
import { Velo } from '@carts1024/velo-sdk';
import pg from 'pg';
import { veloTopups } from '../src/velo-topups.mjs';
import { operatorPayer } from '../src/velo-receipts.mjs';
import { assertLoopbackBindings, localConfiguration } from './local-verification.mjs';

// Bounded manual reconciliation for deposits that are not terminal yet. It uses
// the same observe/reconcileCancellation path as the parent GET, with the
// receipt retry interval bypassed. Scheduling this script needs a separate
// deployment approval; running it by hand does not send a payment or credit.
const LIMIT = 100;
let pool;
try {
  assertLoopbackBindings();
  const { status, admin } = await localConfiguration();
  const receiver = Keypair.fromPublicKey(process.env.OWNER_PUBLIC_KEY).publicKey();
  const operator = operatorPayer();
  if (operator === receiver) throw Error('operator payer must differ from the receiver');
  const velo = new Velo({
    apiKey: process.env.VELO_API_KEY, baseUrl: 'https://www.velo-build.dev',
    environment: 'testnet', timeoutMs: 15000, maxRetries: 0,
  });
  pool = new pg.Pool({ connectionString: status.DB_URL, connectionTimeoutMillis: 5000, statement_timeout: 15000 });
  const { rows } = await pool.query(`
    select distinct m.user_id,m.family_id
    from public.velo_topups t
    join public.family_members m on m.user_id=t.parent_id and m.family_id=t.family_id
    where m.role='parent' and (
      (t.cancelled_at is not null and t.cancellation_state in ('fenced','late_paid'))
      or (t.amount_minor is not null and t.tx_hash is null
        and t.status not in ('failed','expired','cancelled','configuration_required'))
    )
    order by m.user_id
    limit ${LIMIT}`);
  for (const row of rows) {
    const member = { user_id: row.user_id, family_id: row.family_id, role: 'parent' };
    const res = { setHeader() {}, end() {} };
    await veloTopups({ method: 'GET', headers: {} }, res, {
      authenticate: async () => ({ member }),
      database: () => admin, receiver: () => receiver, provider: () => velo,
      operator: () => operator, horizon: fetch, receiptRetryMs: 0,
    });
    if (res.statusCode !== 200) throw Error(`reconcile ${row.family_id} returned ${res.statusCode}`);
  }
  console.log(`PASS: reconcile-deposits (${rows.length} parent(s); bounded manual run; no schedule or send)`);
} catch (error) {
  console.error(`FAIL: reconcile-deposits (${error.code ?? error.message})`);
  process.exitCode = 1;
} finally {
  await pool?.end();
}
