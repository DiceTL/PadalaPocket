import assert from 'node:assert/strict';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { Account, Asset, Keypair, Networks, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
import { assertLoopbackBindings, emails, localConfiguration, options } from './local-verification.mjs';

let stage = 'local-configuration';
let db;
const resolveSeed = 'select wallet_custody.resolve_family_signing_seed($1, $2, $3, $4, $5, $6)';
try {
  const { status, admin, password } = await localConfiguration();
  assertLoopbackBindings();
  const url = new URL(status.DB_URL);
  assert.equal(url.protocol, 'postgresql:');
  assert.equal(url.host, '127.0.0.1:54332');
  assert.equal(url.pathname, '/postgres');
  db = new pg.Client({ connectionString: url.href, connectionTimeoutMillis: 5000 });
  await db.connect();
  await db.query('begin');
  await db.query("set local statement_timeout = '5s'");

  stage = 'vault-boundary-installed';
  const installed = await db.query(`select exists(select 1 from pg_extension where extname='supabase_vault')
    and to_regprocedure('wallet_custody.resolve_family_signing_seed(uuid,uuid,text,text,text,integer)') is not null as ready`);
  assert.equal(installed.rows[0].ready, true);

  stage = 'isolated-fixtures';
  const { rows } = await db.query(`select m.user_id, m.family_id, u.email from public.family_members m
    join auth.users u on u.id=m.user_id where u.email=any($1)`, [emails]);
  const [parent, student, other] = emails.map(email => rows.find(row => row.email === email));
  assert.equal(parent.family_id, student.family_id);
  assert.notEqual(parent.family_id, other.family_id);
  const pair = Keypair.random(), otherPair = Keypair.random(); // Unfunded, never used on a network.
  const keys = [parent, other].map((member, index) => ({
    familyId: member.family_id, role: 'parent', network: 'testnet', publicAddress: (index ? otherPair : pair).publicKey(), version: 1,
  }));
  const params = (member, key) => [member.user_id, key.familyId, key.role, key.network, key.publicAddress, key.version];
  const bind = async (key, signer) => {
    const { rows: [entry] } = await db.query('select vault.create_secret($1) as id', [signer.secret()]);
    await db.query(`insert into wallet_custody.family_signing_keys(family_id, signer_role, network, public_address, key_version, vault_secret_id)
      values($1, $2, $3, $4, $5, $6)`, [...Object.values(key), entry.id]);
  };
  await bind(keys[0], pair);
  await bind(keys[1], otherPair);
  const mismatched = { ...keys[0], role: 'agent', publicAddress: Keypair.random().publicKey() };
  await bind(mismatched, pair);

  stage = 'http-no-secret-surface';
  const anonymous = createClient(status.API_URL, status.ANON_KEY, options);
  const clients = [anonymous, admin];
  for (const member of [parent, student, other]) {
    const client = createClient(status.API_URL, status.ANON_KEY, options);
    const login = await client.auth.signInWithPassword({ email: member.email, password: password(member.email) });
    assert.equal(login.error, null);
    assert.equal(login.data.user.id, member.user_id);
    clients.push(client);
  }
  const request = { p_actor: parent.user_id, p_family: parent.family_id, p_role: 'parent', p_network: 'testnet',
    p_address: keys[0].publicAddress, p_version: 1 };
  for (const client of clients) {
    assert.equal((await client.schema('wallet_custody').rpc('resolve_family_signing_seed', request)).error?.code, 'PGRST106');
    assert.equal((await client.schema('vault').from('decrypted_secrets').select('id').limit(0)).error?.code, 'PGRST106');
    assert.equal((await client.rpc('resolve_family_signing_seed', request)).error?.code, 'PGRST202');
  }

  stage = 'sql-privilege-denial';
  const denied = async (text, values) => {
    await db.query('savepoint deny_probe');
    try { await assert.rejects(db.query(text, values), { code: '42501' }); }
    finally { await db.query('rollback to savepoint deny_probe'); await db.query('release savepoint deny_probe'); }
  };
  for (const role of ['anon', 'authenticated', 'service_role', 'money_coordinator']) {
    await db.query(`set local role ${role}`);
    await denied(resolveSeed, params(parent, keys[0]));
    await db.query('reset role');
  }
  // Grant only to this test transaction; no login, password or persistent membership is created.
  await db.query('grant family_custody_worker to postgres with set true');
  await db.query('set local role family_custody_worker');
  await denied('select family_id from wallet_custody.family_signing_keys');
  await denied('select id from vault.decrypted_secrets');

  stage = 'membership-and-binding-denial';
  for (const [member, key] of [[other, keys[0]], [parent, keys[1]],
    [parent, { ...keys[0], role: 'student' }], [parent, { ...keys[0], network: 'mainnet' }],
    [parent, { ...keys[0], publicAddress: keys[1].publicAddress }], [parent, { ...keys[0], version: 2 }]]) {
    const { rows: [entry] } = await db.query(`${resolveSeed} as seed`, params(member, key));
    assert.ok(entry.seed === null);
  }

  stage = 'authorized-offline-signing';
  const { signFamilyTransaction } = await import('../src/family-custody.mjs');
  const unsigned = source => new TransactionBuilder(new Account(source, '0'), { fee: '100', networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.payment({ destination: otherPair.publicKey(), asset: Asset.native(), amount: '1' })).setTimeout(30).build().toXDR();
  const signed = await signFamilyTransaction(db, { member: parent, wallet: keys[0], unsigned: unsigned(pair.publicKey()) });
  const transaction = TransactionBuilder.fromXDR(signed, Networks.TESTNET);
  assert.equal(transaction.source, pair.publicKey());
  assert.equal(transaction.signatures.length, 1);
  assert.equal(Keypair.fromPublicKey(pair.publicKey()).verify(transaction.hash(), transaction.signatures[0].signature()), true);
  await assert.rejects(signFamilyTransaction(db, { member: parent, wallet: mismatched,
    unsigned: unsigned(mismatched.publicAddress) }), { code: 'CUSTODY_UNAVAILABLE' });
  await assert.rejects(signFamilyTransaction(db, { member: other, wallet: keys[0],
    unsigned: unsigned(pair.publicKey()) }), { code: 'CUSTODY_BINDING_MISMATCH' });
  await assert.rejects(signFamilyTransaction(db, { member: parent, wallet: keys[0],
    unsigned: unsigned(otherPair.publicKey()) }), { code: 'CUSTODY_BINDING_MISMATCH' });
  await db.query('rollback');
  console.log('PASS: custody-access');
} catch {
  console.error(`FAIL: custody-access (${stage})`);
  process.exitCode = 1;
} finally {
  await db?.end();
}
