import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Account, Contract, Keypair, Networks, TransactionBuilder } from '@stellar/stellar-sdk';
import { toCall } from '@noirx402/agent-sdk';
import { createProofHandler, runProof, validateAction, validateDirectTransition, PROOF_AMOUNT, rejectedRefreshHashes, safeProviderError } from '../src/proof.mjs';
import { createDependencies } from '../src/proof-sdk.mjs';

const token = 'a'.repeat(64);
const hash = 'b'.repeat(64);
async function request(handler, { authorization = `Bearer ${token}`, method = 'POST', body = { action: 'snapshot' } } = {}) {
  let text;
  const res = { statusCode: 0, setHeader() {}, end(value) { text = value; } };
  await handler({ headers: { authorization }, method, body }, res);
  return { status: res.statusCode, body: JSON.parse(text) };
}

test('absent/wrong tokens and malformed configured tokens never construct signers or call providers', async () => {
  for (const configured of [token, '', 'short']) {
    for (const authorization of [undefined, '', `Bearer ${'c'.repeat(64)}`, `Bearer ${token}\n`]) {
      let called = 0;
      const handler = createProofHandler({ env: { OPERATOR_TOKEN: configured, PROOF_ENABLED: 'true' },
        createDependencies() { called++; throw new Error('secret'); }, execute() { called++; } });
      const result = await request(handler, { authorization: authorization ?? null });
      assert.equal(result.status, 401);
      assert.equal(called, 0);
    }
  }
});

test('disabled route, wrong method, malformed body and amount/destination overrides cause no dependency calls', async () => {
  let calls = 0;
  const create = env => createProofHandler({ env, createDependencies() { calls++; } });
  assert.equal((await request(create({ OPERATOR_TOKEN: token }))).status, 404);
  const handler = create({ OPERATOR_TOKEN: token, PROOF_ENABLED: 'true' });
  assert.equal((await request(handler, { method: 'GET' })).status, 405);
  for (const body of ['{', 'x'.repeat(1025), null, [], { action: 'authorize', amount: '999' }, { action: 'claim', merchant: 'arbitrary' },
    { action: 'status', requestId: 'bad\n', transactionHash: hash }, { action: 'transaction', transactionHash: 'wrong' }]) {
    assert.equal((await request(handler, { body })).status, 400);
  }
  assert.equal(calls, 0);
});

test('handler sanitizes arbitrary SDK messages', async () => {
  const handler = createProofHandler({ env: { OPERATOR_TOKEN: token, PROOF_ENABLED: 'true' },
    createDependencies() { throw new Error('SECRET_KEY SIGNED_XDR raw-response'); } });
  const result = await request(handler);
  assert.equal(result.status, 503);
  assert.equal(JSON.stringify(result).includes('SECRET_KEY'), false);
  assert.equal(safeProviderError({ code: 'sensitive_payload' }, 'submit').evidence.providerCode, undefined);
  assert.equal(safeProviderError({ code: 'dependency_unavailable' }, 'submit').evidence.providerCode, 'dependency_unavailable');
});

function fake({ replayed = false, sponsorError, submitError, status = 'submitted', transactionHash = hash } = {}) {
  const calls = [];
  return {
    calls, operationId: 'proof1',
    envelope(kind) { calls.push(['envelope', kind]); return { signedXdr: 'private-envelope', hash: transactionHash }; },
    gas: {
      async sponsor(xdr, options) {
        calls.push(['sponsor', xdr, options]);
        if (sponsorError) throw sponsorError;
        return { requestId: 'request-1', transactionHash, replayed };
      },
      async submit(params, options) {
        calls.push(['submit', params, options]);
        if (submitError) throw submitError;
        return { requestId: 'request-1', transactionHash: hash, status };
      },
      async getStatus(identity) { calls.push(['status', identity]); return { ...identity, status }; },
    },
  };
}

test('prepared envelope is submitted once with bounded stable idempotency key; pending is not success', async () => {
  const deps = fake();
  const result = await runProof({ action: 'authorize' }, deps);
  assert.equal(result.gas.status, 'submitted');
  assert.deepEqual(deps.calls.map(call => call[0]), ['envelope', 'sponsor', 'submit']);
  assert.equal(deps.calls[1][2].idempotencyKey, `b001:proof1:authorize:${hash}`);
  assert.equal(deps.calls[2][2].maxRetries, 0);
});

test('controlled rejected-envelope refresh gets a new key without changing proof or payment nonce', async () => {
  const first = fake({ transactionHash: hash });
  const second = fake({ transactionHash: 'c'.repeat(64) });
  first.nonce = second.nonce = 42n;
  await runProof({ action: 'authorize' }, first);
  await runProof({ action: 'authorize' }, second);
  assert.notEqual(first.calls[1][2].idempotencyKey, second.calls[1][2].idempotencyKey);
  assert.equal(first.operationId, second.operationId);
  assert.equal(first.nonce, second.nonce);
  assert.ok(second.calls[1][2].idempotencyKey.length < 255);
});

test('refresh guard accepts only definitive sponsor rejection and refuses unknown or later unresolved attempts', () => {
  const prepared = { command: 'prepare', action: 'authorize', transactionHash: hash };
  const rejection = { command: 'call', action: 'authorize', response: { stage: 'sponsor', providerStatus: 403, providerCode: 'policy_disabled' } };
  assert.deepEqual(rejectedRefreshHashes([prepared, rejection], 'authorize'), [hash]);
  const conflict = { ...rejection, response: { stage: 'sponsor', providerStatus: 409, providerCode: 'idempotency_key_conflict' } };
  assert.deepEqual(rejectedRefreshHashes([prepared, rejection, conflict], 'authorize'), [hash]);
  assert.throws(() => rejectedRefreshHashes([prepared, conflict], 'authorize'), /REFRESH_NOT_SAFE/);
  const dispatch = { command: 'call', action: 'authorize', phase: 'dispatching' };
  assert.deepEqual(rejectedRefreshHashes([prepared, dispatch, rejection], 'authorize'), [hash]);
  assert.throws(() => rejectedRefreshHashes([prepared, rejection, dispatch], 'authorize'), /REFRESH_NOT_SAFE/);
  assert.throws(() => rejectedRefreshHashes([prepared, rejection, dispatch, dispatch, rejection], 'authorize'), /REFRESH_NOT_SAFE/);
  for (const response of [undefined, { stage: 'submit', providerStatus: 503 }, { stage: 'sponsor', providerStatus: 408 },
    { stage: 'sponsor', providerStatus: 403, providerCode: 'policy_disabled', requestId: 'reserved-1' }]) {
    assert.throws(() => rejectedRefreshHashes([prepared, rejection, { command: 'call', action: 'authorize', response }, conflict], 'authorize'), /REFRESH_NOT_SAFE/);
  }
});

test('durable replay after restart observes identity only, never signs or submits again', async () => {
  const deps = fake({ replayed: true });
  await runProof({ action: 'authorize' }, deps);
  assert.deepEqual(deps.calls.map(call => call[0]), ['envelope', 'sponsor', 'status']);
  assert.deepEqual(deps.calls[2][1], { requestId: 'request-1', transactionHash: hash });
});

test('sponsorship denial never submits and never leaks raw provider text', async () => {
  const deps = fake({ sponsorError: { code: 'contract_not_whitelisted', status: 403, message: 'secret' } });
  await assert.rejects(runProof({ action: 'authorize' }, deps), error => {
    assert.equal(error.evidence.providerCode, 'contract_not_whitelisted');
    assert.equal(JSON.stringify(error).includes('secret'), false);
    return true;
  });
  assert.equal(deps.calls.filter(call => call[0] === 'submit').length, 0);
});

test('explicit retry after sponsorship timeout reuses exact envelope/key and only observes replay status', async () => {
  const deps = fake({ replayed: true });
  const sponsor = deps.gas.sponsor;
  let firstRequest;
  deps.gas.sponsor = async (xdr, options) => {
    if (!firstRequest) {
      firstRequest = { xdr, key: options.idempotencyKey };
      throw new Error('timeout before reservation identity returned');
    }
    assert.equal(xdr, firstRequest.xdr);
    assert.equal(options.idempotencyKey, firstRequest.key);
    return sponsor(xdr, options);
  };
  await assert.rejects(runProof({ action: 'authorize' }, deps), /PROVIDER_UNAVAILABLE/);
  const recovered = await runProof({ action: 'authorize' }, deps);
  assert.equal(recovered.replayed, true);
  assert.equal(deps.calls.some(call => call[0] === 'submit'), false);
  assert.equal(deps.calls.at(-1)[0], 'status');
});

test('unknown submission returns recovery identity, never retries or prepares a fresh payment', async () => {
  const deps = fake({ submitError: new Error('sensitive SDK response') });
  await assert.rejects(runProof({ action: 'claim' }, deps), error => {
    assert.equal(error.code, 'SUBMISSION_UNKNOWN');
    assert.deepEqual(error.evidence, { stage: 'submit', requestId: 'request-1', transactionHash: hash });
    return true;
  });
  assert.equal(deps.calls.filter(call => call[0] === 'submit').length, 1);
});

test('preparation/config verifies pinned Testnet call, source, fixed merchant and amount', async () => {
  const env = { VELO_GAS_BASE_URL: 'https://www.velo-build.dev', VELO_GAS_API_KEY: `tg_test_${'a'.repeat(32)}`,
    OWNER_SECRET: Keypair.random().secret(), AGENT_SECRET: Keypair.random().secret(), MERCHANT_SECRET: Keypair.random().secret(),
    PROOF_DEVICE_HASH: 'd'.repeat(64), PROOF_OPERATION_ID: 'e'.repeat(32), PROOF_NONCE: '1', PROOF_EXPIRES_AT: '2026-11-07T00:00:00.000Z' };
  const deps = await createDependencies(env);
  assert.equal(deps.noir.server.httpClient.defaults.timeout, 15_000);
  const { signer, op } = deps.operation('authorize');
  assert.equal(op.amount, PROOF_AMOUNT);
  assert.equal(op.merchant, deps.signers.merchant.publicKey);
  const call = toCall(signer.publicKey, op);
  const tx = new TransactionBuilder(new Account(signer.publicKey, '1'), { fee: '100', networkPassphrase: Networks.TESTNET })
    .addOperation(new Contract(deps.noir.contracts[call.contract]).call(call.method, ...call.args)).setTimeout(300).build();
  const signed = await deps.signAndHash(signer, tx.toXDR());
  env.PROOF_ENVELOPE_KIND = 'authorize';
  env.PROOF_ENVELOPE_XDR = signed.signedXdr;
  assert.equal(deps.envelope('authorize').hash, signed.hash);
  assert.throws(() => deps.envelope('claim'), /ENVELOPE_NOT_PREPARED/);
  const wrong = new TransactionBuilder(new Account(deps.signers.owner.publicKey, '1'), { fee: '100', networkPassphrase: Networks.TESTNET })
    .addOperation(new Contract(deps.noir.contracts[call.contract]).call(call.method, ...call.args)).setTimeout(300).build();
  env.PROOF_ENVELOPE_XDR = wrong.toXDR();
  assert.throws(() => deps.envelope('authorize'), /ENVELOPE_MISMATCH/);
  await assert.rejects(createDependencies({ ...env, VELO_GAS_BASE_URL: 'https://untrusted.invalid' }), /PROOF_CONFIG_INVALID/);
});

test('status only accepts normalized hash and non-secret request identity', () => {
  assert.deepEqual(validateAction({ action: 'status', requestId: 'request-1', transactionHash: hash }), { action: 'status', requestId: 'request-1', transactionHash: hash });
});

test('direct transition requires preserved rejection/history plus expired ledger and unchanged source sequence', () => {
  const oldHash = 'c'.repeat(64);
  const history = [
    { command: 'prepare', action: 'registerDevice', transactionHash: oldHash },
    { command: 'call', action: 'registerDevice', response: { stage: 'sponsor', providerStatus: 403, providerCode: 'policy_disabled' } },
    { command: 'refresh-rejected', action: 'registerDevice', transactionHash: hash },
    { command: 'call', action: 'registerDevice', response: { stage: 'submit', error: { code: 'SUBMISSION_UNKNOWN' }, requestId: 'original-reservation', transactionHash: hash } },
  ];
  const proof = { transactionHash: hash, sequence: '43', accountSequence: '42', maxTime: '1000', closedAt: '2026-11-06T11:13:41Z', ledgerStatus: 'NOT_FOUND' };
  assert.equal(validateDirectTransition(history, proof).requestId, 'original-reservation');
  for (const change of [{ accountSequence: '43' }, { ledgerStatus: 'SUCCESS' }, { transactionHash: oldHash },
    { closedAt: '1970-01-01T00:10:00Z' }, { maxTime: '0' }]) {
    assert.throws(() => validateDirectTransition(history, { ...proof, ...change }), /TRANSITION_NOT_SAFE/);
  }
  assert.throws(() => validateDirectTransition([...history, { command: 'transition-direct' }], proof), /TRANSITION_NOT_SAFE/);
  assert.throws(() => validateDirectTransition([...history, { command: 'call', action: 'registerDevice', phase: 'dispatching' }], proof), /TRANSITION_NOT_SAFE/);
});

test('direct transport reconciles exact hash, submits once through Noir and never calls Gas', async () => {
  const deps = fake();
  deps.transport = 'direct';
  deps.operation = kind => ({ op: { kind } });
  deps.noir = { server: { async getTransaction(value) { assert.equal(value, hash); return { status: 'NOT_FOUND' }; } },
    async submit(xdr, op) { deps.calls.push(['noir-submit', xdr, op]); return hash; } };
  const result = await runProof({ action: 'authorize', transactionXdr: 'private-envelope' }, deps);
  assert.equal(result.ledgerStatus, 'SUCCESS');
  assert.deepEqual(deps.calls.map(call => call[0]), ['envelope', 'noir-submit']);
  deps.noir.server.getTransaction = async () => ({ status: 'SUCCESS' });
  assert.equal((await runProof({ action: 'authorize', transactionXdr: 'private-envelope' }, deps)).replayed, true);
  assert.equal(deps.calls.filter(call => call[0] === 'noir-submit').length, 1);
  deps.noir.server.getTransaction = async () => ({ status: 'NOT_FOUND' });
  deps.noir.submit = async () => { throw new Error('sensitive raw response'); };
  await assert.rejects(runProof({ action: 'authorize', transactionXdr: 'private-envelope' }, deps), error =>
    error.code === 'SUBMISSION_UNKNOWN' && error.evidence.transactionHash === hash && !JSON.stringify(error).includes('sensitive'));
  deps.envelope = () => ({ hash, signedXdr: 'private-envelope', expired: true });
  await assert.rejects(runProof({ action: 'authorize', transactionXdr: 'private-envelope' }, deps), /ENVELOPE_EXPIRED/);
});

test('direct envelopes require a valid fixed-source signature and bounded fee; checkout cannot accept caller IDs', async () => {
  const env = { PROOF_TRANSPORT: 'direct', VELO_GAS_BASE_URL: 'https://www.velo-build.dev',
    OWNER_SECRET: Keypair.random().secret(), AGENT_SECRET: Keypair.random().secret(), MERCHANT_SECRET: Keypair.random().secret(),
    PROOF_DEVICE_HASH: 'd'.repeat(64), PROOF_OPERATION_ID: 'e'.repeat(32), PROOF_NONCE: '1' };
  const deps = await createDependencies(env);
  const { signer, op } = deps.operation('authorize');
  const call = toCall(signer.publicKey, op);
  async function build({ fee = '100', secret = env.AGENT_SECRET, amount = op.amount, minTime = 0 } = {}) {
    const invocation = toCall(signer.publicKey, { ...op, amount });
    const tx = new TransactionBuilder(new Account(signer.publicKey, '1'), { fee, networkPassphrase: Networks.TESTNET })
      .addOperation(new Contract(deps.noir.contracts[call.contract]).call(invocation.method, ...invocation.args))
      .setTimebounds(minTime, Math.floor(Date.now() / 1000) + 300).build();
    if (secret) tx.sign(Keypair.fromSecret(secret));
    return tx.toXDR();
  }
  const xdr = await build();
  assert.equal(deps.envelope('authorize', xdr).signedXdr, xdr);
  for (const options of [{ secret: null }, { secret: env.OWNER_SECRET }, { fee: '300000001' }, { amount: 2n * op.amount },
    { minTime: Math.floor(Date.now() / 1000) + 100 }]) {
    const invalid = await build(options);
    assert.throws(() => deps.envelope('authorize', invalid), /ENVELOPE_MISMATCH/);
  }
  assert.deepEqual(validateAction({ action: 'authorize', transactionXdr: xdr }, 'direct').action, 'authorize');
  assert.throws(() => validateAction({ action: 'authorize', transactionXdr: xdr }), /INVALID_INPUT/);
  assert.throws(() => validateAction({ action: 'checkout', paymentIntentId: 'arbitrary' }, 'direct'), /INVALID_INPUT/);
});

test('CLI init persists real newlines, owner-only env and appendable recovery JSON without exposing secrets', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'b001-cli-'));
  try {
    await writeFile(join(directory, '.env.local'), '# temporary test only\nOWNER_SECRET=\nPROOF_DEVICE_HASH=\n', { mode: 0o600 });
    const env = { ...process.env };
    for (const key of ['OWNER_SECRET', 'AGENT_SECRET', 'MERCHANT_SECRET', 'OPERATOR_TOKEN', 'PROOF_OPERATION_ID']) delete env[key];
    const script = fileURLToPath(new URL('../scripts/proof.mjs', import.meta.url));
    const first = spawnSync(process.execPath, [script, 'init'], { cwd: directory, env, encoding: 'utf8' });
    assert.equal(first.status, 0, first.stderr);
    const saved = await readFile(join(directory, '.env.local'), 'utf8');
    assert.equal(saved.split('\n').filter(line => line.startsWith('OWNER_SECRET=')).length, 1);
    assert.equal(saved.includes('\\n'), false);
    assert.equal((await stat(join(directory, '.env.local'))).mode & 0o077, 0);
    assert.equal(JSON.parse(await readFile(join(directory, '.env.b001-evidence.json'), 'utf8')).length, 1);
    const ownerSecret = saved.split('\n').find(line => line.startsWith('OWNER_SECRET=')).slice('OWNER_SECRET='.length);
    assert.equal(first.stdout.includes(ownerSecret), false);
    const second = spawnSync(process.execPath, ['--env-file=.env.local', script, 'init'], { cwd: directory, env, encoding: 'utf8' });
    assert.equal(second.status, 1);
    assert.equal(JSON.parse(await readFile(join(directory, '.env.b001-evidence.json'), 'utf8')).at(-1).error, 'ALREADY_INITIALIZED');
    assert.equal(await readFile(join(directory, '.env.local'), 'utf8'), saved);
    // A pre-signing configuration/network failure must not manufacture a
    // prepared operation in the journal and prevent an authorized retry.
    for (let attempt = 0; attempt < 2; attempt++) {
      const failed = spawnSync(process.execPath, ['--env-file=.env.local', script, 'prepare', 'registerAgent'], { cwd: directory, env, encoding: 'utf8' });
      assert.equal(failed.status, 1);
      const journal = JSON.parse(await readFile(join(directory, '.env.b001-evidence.json'), 'utf8'));
      assert.equal(journal.at(-1).command, 'prepare', JSON.stringify({ status: failed.status, stdout: failed.stdout, stderr: failed.stderr, journal }));
      assert.equal(journal.at(-1).error, 'PROVIDER_UNAVAILABLE');
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
