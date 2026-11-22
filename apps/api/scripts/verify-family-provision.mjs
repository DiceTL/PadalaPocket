import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { Account, BASE_FEE, Contract, Keypair, Networks, TransactionBuilder, xdr } from '@stellar/stellar-sdk';
import { NoirAgentClient, toCall } from '@noirx402/agent-sdk';
import { assertLoopbackBindings, emails, localConfiguration } from './local-verification.mjs';

let db, stage = 'loopback';
try {
  const { status } = await localConfiguration();
  assertLoopbackBindings();
  const url = new URL(status.DB_URL);
  assert.equal(url.host, '127.0.0.1:54332');
  assert.equal(url.pathname, '/postgres');
  db = new pg.Client({ connectionString: url.href, connectionTimeoutMillis: 5000 });
  await db.connect();
  await db.query('begin');
  stage = 'provisioning-boundary-installed';
  assert.ok((await db.query("select to_regclass('wallet_custody.family_provisions') as name")).rows[0].name);
  const { provisionFamily } = await import('../src/family-provision.mjs');
  const fixture = await db.query(`select m.family_id,m.user_id from public.family_members m join auth.users u on u.id=m.user_id
    where u.email=$1 and not m.wallet_ready`, [emails[0]]);
  const member = fixture.rows[0];
  assert.ok(member);
  const feeSigner = Keypair.random();
  const feeSource = feeSigner.publicKey();
  const balances = new Map([[feeSource, 1000000000n]]), sequences = new Map(), devices = new Map(), policies = new Map();
  const prepared = new Map(), envelopes = new Map();
  const xlm = amount => `${amount / 10000000n}.${String(amount % 10000000n).padStart(7, '0')}`;
  const account = async address => !balances.has(address) ? null : ({
    account_id: address, sequence: String(sequences.get(address) ?? 0), subentry_count: 0, num_sponsoring: 0, num_sponsored: 0,
    signers: [{ key: address, weight: 1, type: 'ed25519_public_key' }], thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
    balances: [{ asset_type: 'native', balance: xlm(balances.get(address)), selling_liabilities: '0.0000000' }],
  });
  const noir = {
    contracts: new NoirAgentClient({ network: 'testnet' }).contracts,
    async prepare(source, op) {
      stage = `prepare-${op.kind}`;
      const { contract, method, args } = toCall(source, op);
      const transaction = new TransactionBuilder(new Account(source, String(sequences.get(source) ?? 0)), { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
        .addOperation(new Contract(this.contracts[contract]).call(method, ...args)).setTimeout(60).build();
      prepared.set(transaction.hash().toString('hex'), op);
      return transaction.toXDR();
    },
    getDeviceOwner: async id => devices.get(id)?.owner ?? null,
    getDeviceAgent: async id => devices.get(id)?.agent ?? null,
    getPolicy: async id => policies.get(id) ?? null,
    getEscrowBalance: async () => 0n,
  };
  let sends = 0, visible = false, wrongOwner;
  const server = {
    async sendTransaction(tx) {
      const hash = tx.hash().toString('hex');
      assert.ok(tx.signatures.length === 1 && Keypair.fromPublicKey(tx.source).verify(tx.hash(), tx.signatures[0].signature()));
      const savedBeforeSend = await db.query(`select 1 from public.money_signed_steps s join public.money_dispatch_steps d using(operation_id,step_key)
        where s.transaction_hash=$1 and s.signed_envelope=$2 and d.phase='dispatching'`, [hash, tx.toXDR()]);
      assert.equal(savedBeforeSend.rowCount, 1);
      assert.ok(!envelopes.has(hash));
      const results = tx.operations.map(operation => {
        if (operation.type === 'createAccount') {
          assert.equal(tx.source, feeSource);
          assert.ok(!balances.has(operation.destination));
          const amount = BigInt(operation.startingBalance.replace('.', ''));
          balances.set(operation.destination, amount);
          balances.set(feeSource, balances.get(feeSource) - amount);
          return xdr.OperationResult.opInner(xdr.OperationResultTr.createAccount(xdr.CreateAccountResult.createAccountSuccess()));
        }
        assert.equal(operation.type, 'invokeHostFunction');
        const op = prepared.get(hash);
        if (op.kind === 'registerDevice') devices.set(op.deviceHash, { owner: tx.source, agent: op.agent });
        else policies.set(op.deviceHash, { agent: op.agent, asset: op.asset, maxAmount: op.maxAmount, expiresAt: op.expiresAt });
        return xdr.OperationResult.opInner(xdr.OperationResultTr.invokeHostFunction(xdr.InvokeHostFunctionResult.invokeHostFunctionSuccess(Buffer.alloc(32))));
      });
      sequences.set(tx.source, Number(tx.sequence));
      balances.set(tx.source, balances.get(tx.source) - BigInt(tx.fee));
      envelopes.set(hash, { status: 'SUCCESS', envelopeXdr: tx.toXDR(), ledger: 1,
        resultXdr: new xdr.TransactionResult({ feeCharged: xdr.Int64.fromString(tx.fee), result: xdr.TransactionResultResult.txSuccess(results), ext: new xdr.TransactionResultExt(0) }) });
      sends++;
      return { hash };
    },
    async getTransaction(hash) { return visible ? envelopes.get(hash) ?? { status: 'NOT_FOUND' } : { status: 'NOT_FOUND' }; },
  };
  const scoped = role => ({ async query(sql, values) {
    await db.query('savepoint scoped_probe');
    try {
      await db.query(`set local role ${role}`);
      const result = await db.query(sql, values);
      await db.query('reset role');
      return result;
    } catch (error) {
      await db.query('rollback to savepoint scoped_probe');
      throw error;
    } finally { await db.query('release savepoint scoped_probe'); }
  } });
  const coordinator = scoped('money_coordinator');
  const journal = {
   from(table) {
    assert.equal(table, 'family_rules');
    return { select() { return this; }, eq(column, family) {
      assert.equal(column, 'family_id');
      return { maybeSingle: async () => ({ data: (await coordinator.query(
        'select revision,settings,updated_at from public.family_rules where family_id=$1', [family])).rows[0] ?? null }) };
    } };
   },
   async rpc(name, params) {
    const allow = ['claim_money_dispatch', 'save_money_dispatch', 'claim_money_dispatch_send', 'confirm_money_dispatch'];
    assert.ok(allow.includes(name));
    try {
      const { rows: [row] } = await coordinator.query(`select public.${name}(${Object.keys(params).map((key, i) => `${key} => $${i+1}`).join(',')}) as value`, Object.values(params));
      return { data: row.value };
    } catch (error) { stage = `journal-${name}-${error.code ?? error.name}`; return { error }; }
  } };
  const terms = { requestKey: randomUUID(), feeSource, baseReserveStroops: '5000000', operatingFloatStroops: '1000000',
    maxOperatingTransferStroops: '34000000', accountFeePerOpStroops: '100', noirFeeCapStroops: '10000',
    maxFeeStroops: '60300', policyCapStroops: '5000000', policyExpiresAt: new Date(Math.floor(Date.now()/1000)*1000+3600000).toISOString() };
  const dependencies = { custody: scoped('family_provision_worker'), signing: scoped('family_custody_worker'),
    journal, feeSigner, account, baseReserve: async () => 5000000n, noir, server };
  await db.query('grant family_provision_worker to postgres with set true');
  stage = 'isolated-role-grants';
  const permissions = await db.query(`select
    has_function_privilege('family_provision_worker','wallet_custody.resolve_family_signing_seed(uuid,uuid,text,text,text,integer)','execute') as provision_reads,
    has_function_privilege('family_custody_worker','wallet_custody.begin_family_provision(uuid,uuid,uuid,text,jsonb,jsonb)','execute') as signer_writes,
    has_function_privilege('service_role','wallet_custody.begin_family_provision(uuid,uuid,uuid,text,jsonb,jsonb)','execute') as public_api_writes,
    has_table_privilege('family_provision_worker','wallet_custody.family_signing_keys','select') as provision_table_read`);
  assert.deepEqual(permissions.rows[0], { provision_reads: false, signer_writes: false, public_api_writes: false, provision_table_read: false });
  await db.query('grant family_custody_worker to postgres with set true');
  const run = (changes = {}) => provisionFamily(dependencies, { member, terms: { ...terms, ...changes } });
  stage = 'budget-denial';
  await assert.rejects(run({ maxFeeStroops: '60299' }), { code: 'PROVISION_BUDGET' });
  assert.equal(sends, 0);
  stage = 'one-shot-and-durable-replay';
  const pending = await run();
  assert.equal(pending.status, 'pending');
  assert.equal(sends, 1);
  const saved = await db.query("select count(*)::int as n from wallet_custody.family_signing_keys where family_id=$1", [member.family_id]);
  assert.equal(saved.rows[0].n, 3);
  assert.equal((await run()).status, 'pending');
  assert.equal(sends, 1);
  await assert.rejects(run({ requestKey: randomUUID() }), { code: 'PROVISION_CONFLICT' });
  stage = 'confirmed-resource-readback';
  visible = true;
  const complete = await run();
  assert.equal(complete.status, 'confirmed');
  assert.deepEqual(complete.accounts, pending.accounts);
  assert.equal(sends, 7);
  assert.equal(devices.size, 4);
  assert.equal(policies.size, 2);
  assert.equal((await db.query('select count(*)::int as n from public.family_members where family_id=$1 and wallet_ready', [member.family_id])).rows[0].n, 0);
  wrongOwner = devices.values().next().value;
  wrongOwner.owner = feeSource;
  await assert.rejects(run(), { code: 'PROVISION_EVIDENCE_MISMATCH' });
  assert.equal(sends, 7);
  await db.query('rollback');
  console.log('PASS: family-provision (isolated data and controlled Testnet transport)');
} catch (error) {
  console.error(`FAIL: family-provision (${stage}; ${error.code ?? error.name})`);
  process.exitCode = 1;
} finally { await db?.end(); }
