import assert from 'node:assert/strict';
import { Keypair } from '@stellar/stellar-sdk';
import { createClient } from '@supabase/supabase-js';
import { localConfiguration, assertLoopbackBindings, options } from './local-verification.mjs';

// Both old database access and ledger authority must be revoked; neither alone is cutover.
let stage = 'local-envelope-permissions';
try {
  const { admin: legacy } = await localConfiguration();
  assertLoopbackBindings();
  const saved = await legacy.from('money_signed_steps').select('signed_envelope').limit(1);
  assert.equal(saved.error?.code, '42501', 'Legacy credentials can read dispatchable signed bytes');
  const id = '00000000-0000-4000-8000-000000000008';
  const snapshot = await legacy.rpc('read_money_recovery', { p_operation: id, p_family: id, p_step_key: 'cutover' });
  assert.equal(snapshot.error?.code, '42501', 'Legacy credentials can retrieve signed bytes through recovery');

  stage = 'active-guard-configuration';
  process.loadEnvFile('.env.local');
  const { assertCoordinatorAuthority } = await import('../src/money-authority.mjs');
  const guard = process.env.MONEY_COORDINATOR_GUARD_PUBLIC_KEY;
  Keypair.fromPublicKey(guard);
  assert.ok(!process.env.MONEY_COORDINATOR_GUARD_SECRET && !process.env.MONEY_COORDINATOR_DATABASE_TOKEN);
  Keypair.fromPublicKey(process.env.OWNER_PUBLIC_KEY);
  const sources = ['OWNER', 'AGENT', 'MERCHANT', 'STUDENT'].map(role => {
    const source = process.env[`${role}_PUBLIC_KEY`] ?? Keypair.fromSecret(process.env[`${role}_SECRET`]).publicKey();
    Keypair.fromPublicKey(source);
    return source;
  });
  assert.equal(new Set(sources).size, sources.length);
  // Hosted permissions and real Testnet account policy cannot be proved by local fixtures.
  stage = 'hosted-envelope-permissions';
  const hostedLegacy = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, options);
  const hostedSaved = await hostedLegacy.from('money_signed_steps').select('signed_envelope').limit(1);
  assert.equal(hostedSaved.error?.code, '42501');
  const hostedSnapshot = await hostedLegacy.rpc('read_money_recovery', { p_operation: id, p_family: id, p_step_key: 'cutover' });
  assert.equal(hostedSnapshot.error?.code, '42501');
  const access = await hostedLegacy.rpc('read_money_cutover_access');
  assert.equal(access.error,null);assert.equal(access.data.role,'service_role');assert.equal(access.data.readsSigned,false);
  assert.ok(Object.values(access.data.tables).every(rights=>Object.values(rights).every(value=>value===false)));
  for (const rights of Object.values(access.data.tables)) assert.equal(rights.truncate, false);
  assert.ok(Object.values(access.data.rpcs).every(value=>value===false));
  stage = 'testnet-ledger-policy';
  for (const sourceAccount of sources) {
    const response = await fetch(`https://horizon-testnet.stellar.org/accounts/${sourceAccount}`, {
      redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    assert.ok(response.ok);
    assertCoordinatorAuthority(await response.json(), { sourceAccount, guardAccount: guard });
  }
  stage = 'isolated-runtime-readiness';
  const origin = new URL(process.env.MONEY_COORDINATOR_URL);
  assert.equal(origin.protocol,'https:');assert.equal(origin.pathname,'/');assert.ok(!origin.username && !origin.password && !origin.search && !origin.hash);
  assert.match(process.env.MONEY_COORDINATOR_ACCESS_TOKEN ?? '',/^[a-f0-9]{64}$/);
  const response = await fetch(new URL('/internal/authority',origin), {headers:{'x-money-coordinator-token':process.env.MONEY_COORDINATOR_ACCESS_TOKEN},
    redirect:'error',signal:AbortSignal.timeout(20000)});
  assert.equal(response.status,200);
  const readiness=await response.json();
  assert.equal(readiness.network,'testnet');assert.equal(readiness.boundary,'t08');assert.equal(readiness.databaseRole,'money_coordinator');
  assert.equal(readiness.guardAccount,guard);assert.deepEqual(readiness.sources,sources);
  assert.ok(Number.isFinite(Date.parse(readiness.activatedAt)) && Date.parse(readiness.activatedAt)<=Date.now());
} catch {
  console.error(`FAIL: writer-cutover (${stage})`);
  process.exitCode = 1;
}
