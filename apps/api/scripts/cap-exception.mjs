// Run from root: node --env-file=.env.local apps/api/scripts/cap-exception.mjs init|run|observe
import { readFile, writeFile, stat, open, unlink, rename } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { Asset, Keypair, Networks, TransactionBuilder } from '@stellar/stellar-sdk';
import { NoirAgentClient, keypairSigner } from '@noirx402/agent-sdk';
import { approvalBytes, approvedOperation, EXCEPTION_AMOUNT, ORDINARY_CAP } from '../src/cap-exception.mjs';

const path = '.env.b002-state.json';
const command = process.argv[2];
let state;
let lock;
async function save() {
  const next = await open(path + '.next', 'wx', 0o600);
  try {
    await next.writeFile(JSON.stringify(state, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2) + '\n');
    await next.sync();
  } finally { await next.close(); }
  await rename(path + '.next', path);
}
function emit(value) { console.log(JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v)); }
function requireThat(ok) { if (!ok) throw new Error('EXPERIMENT_CHECK_FAILED'); }
try {
  if (!['init', 'run', 'observe'].includes(command)) throw new Error('INVALID_COMMAND');
  if ((await stat('.env.local')).mode & 0o077) throw new Error('ENV_PERMISSIONS');
  lock = await open('.env.b002-lock', 'wx', 0o600);
  const owner = keypairSigner(process.env.OWNER_SECRET);
  const ordinary = keypairSigner(process.env.AGENT_SECRET);
  const merchant = keypairSigner(process.env.MERCHANT_SECRET);
  const noir = new NoirAgentClient({ network: 'testnet' });
  noir.server.httpClient.defaults.timeout = 15_000;
  if (command === 'init') {
    const agent = Keypair.random();
    const request = { id: randomBytes(16).toString('hex'), owner: owner.publicKey,
      deviceHash: randomBytes(32).toString('hex'), agent: agent.publicKey(), merchant: merchant.publicKey,
      asset: Asset.native().contractId(Networks.TESTNET), amountStroops: EXCEPTION_AMOUNT.toString(),
      nonce: '1', bucket: 'needs', photoReference: 'synthetic:b002-photo-v1', expiresAt: new Date(Date.now() + 3_600_000).toISOString() };
    state = { request, signature: Keypair.fromSecret(process.env.OWNER_SECRET).sign(approvalBytes(request)).toString('base64'),
      exceptionSecret: agent.secret(), ordinaryDevice: randomBytes(32).toString('hex'), steps: {}, observations: [] };
    await writeFile(path, JSON.stringify(state, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2) + '\n', { mode: 0o600, flag: 'wx' });
    emit({ initialized: true, requestId: request.id });
  } else {
    if ((await stat(path)).mode & 0o077) throw new Error('ENV_PERMISSIONS');
    state = JSON.parse(await readFile(path, 'utf8'));
    const r = state.request;
    requireThat(owner.publicKey === r.owner && merchant.publicKey === r.merchant);
    const exception = keypairSigner(state.exceptionSecret);
    requireThat(exception.publicKey === r.agent && exception.publicKey !== ordinary.publicKey);
    async function observe(label, value) {
      const record = { label, observedAt: new Date().toISOString(), value };
      state.observations.push(record); await save(); emit(record);
    }
    if (command === 'observe') {
      for (const [step, entry] of Object.entries(state.steps)) if (entry.hash) {
        const result = await noir.server.getTransaction(entry.hash);
        await observe(step, { hash: entry.hash, ledgerStatus: result.status });
      }
    } else {
      approvedOperation(r, state.signature, owner.publicKey);
      async function send(name, signer, op) {
        let entry = state.steps[name];
        if (!entry) {
          const xdr = await noir.prepare(signer.publicKey, op);
          const signed = await signer.signTransaction(xdr, { networkPassphrase: Networks.TESTNET });
          const tx = TransactionBuilder.fromXDR(signed, Networks.TESTNET);
          requireThat(BigInt(tx.fee) <= 300_000_000n);
          entry = state.steps[name] = { hash: tx.hash().toString('hex'), signed, phase: 'prepared' };
          await save();
        }
        const result = await noir.server.getTransaction(entry.hash);
        if (result.status === 'SUCCESS') { entry.phase = 'confirmed'; await save(); return; }
        if (entry.phase !== 'prepared' || result.status !== 'NOT_FOUND') throw new Error('OBSERVE_REQUIRED');
        const tx = TransactionBuilder.fromXDR(entry.signed, Networks.TESTNET);
        requireThat(BigInt(tx.timeBounds.maxTime) > BigInt(Math.floor(Date.now() / 1000)));
        entry.phase = 'dispatched'; await save(); // Never replace or retry an uncertain dispatch.
        const hash = await noir.submit(entry.signed, op);
        requireThat(hash === entry.hash);
        entry.phase = 'confirmed'; await save(); emit({ step: name, hash, ledgerStatus: 'SUCCESS' });
      }
      // Friendbot funds only this fresh exception agent's fees; do not repeat after uncertainty.
      if (!state.steps.friendbot) {
        state.steps.friendbot = { phase: 'dispatched' }; await save();
        const response = await fetch(`https://friendbot.stellar.org?addr=${r.agent}`, { signal: AbortSignal.timeout(30_000) });
        requireThat(response.ok); state.steps.friendbot.phase = 'confirmed'; await save();
      }
      requireThat(state.steps.friendbot.phase === 'confirmed');
      const device = state.ordinaryDevice;
      await send('ordinaryDevice', owner, { kind: 'registerDevice', deviceHash: device, agent: ordinary.publicKey });
      await send('ordinaryPolicy', owner, { kind: 'registerAgent', deviceHash: device, agent: ordinary.publicKey, asset: r.asset, maxAmount: ORDINARY_CAP, expiresAt: new Date(r.expiresAt) });
      const check = (deviceHash, agent, amount) => noir.checkPayment({ deviceHash, agent, amount, asset: r.asset, requireEscrow: false });
      const before = await check(device, ordinary.publicKey, EXCEPTION_AMOUNT);
      requireThat(!before.ok && before.reason === 'over_limit'); await observe('ordinaryOverCapBefore', before);
      await send('exceptionDevice', owner, { kind: 'registerDevice', deviceHash: r.deviceHash, agent: r.agent });
      await send('exceptionPolicy', owner, { kind: 'registerAgent', deviceHash: r.deviceHash, agent: r.agent, asset: r.asset, maxAmount: EXCEPTION_AMOUNT, expiresAt: new Date(r.expiresAt) });
      const wrongAgent = await check(r.deviceHash, ordinary.publicKey, EXCEPTION_AMOUNT);
      requireThat(!wrongAgent.ok && wrongAgent.reason === 'wrong_agent'); await observe('ordinaryAgentIsolated', wrongAgent);
      await send('fund', owner, { kind: 'fundEscrow', deviceHash: r.deviceHash, token: r.asset, amount: EXCEPTION_AMOUNT });
      const baseline = { escrow: await noir.getEscrowBalance(r.deviceHash), pending: await noir.getPendingBalance(r.merchant) };
      requireThat(baseline.escrow === EXCEPTION_AMOUNT && baseline.pending === 0n);
      await observe('beforeAuthorization', baseline);
      // Reverify owner consent at execution time, including expiry.
      await send('authorize', exception, approvedOperation(r, state.signature, owner.publicKey));
      const escrow = await noir.getEscrowBalance(r.deviceHash);
      const pending = await noir.getPendingBalance(r.merchant);
      requireThat(escrow === 0n && pending === EXCEPTION_AMOUNT); await observe('afterAuthorization', { escrow, pending });
      const exhausted = await noir.checkPayment({ deviceHash: r.deviceHash, agent: r.agent, asset: r.asset, amount: 1n });
      requireThat(!exhausted.ok && exhausted.reason === 'insufficient_escrow'); await observe('exceptionCannotSpendAgain', exhausted);
      await send('claim', merchant, { kind: 'claim', token: r.asset });
      await send('revoke', owner, { kind: 'revokeAgent', deviceHash: r.deviceHash });
      const policy = await noir.getPolicy(r.deviceHash);
      requireThat(policy === null); await observe('exceptionRevoked', { policy });
      const after = await check(device, ordinary.publicKey, EXCEPTION_AMOUNT);
      const routine = await check(device, ordinary.publicKey, 1_000_000n);
      requireThat(!after.ok && after.reason === 'over_limit' && routine.ok);
      requireThat((await noir.getPolicy(device)).maxAmount === ORDINARY_CAP);
      await observe('ordinaryPolicyUnchanged', { overCap: after, routine, cap: ORDINARY_CAP, pending: await noir.getPendingBalance(r.merchant) });
      emit({ experiment: 'passed', requestId: r.id });
    }
  }
} catch (error) {
  // SDK/provider messages may contain sensitive data. Never print them.
  emit({ error: ['OBSERVE_REQUIRED', 'ENV_PERMISSIONS', 'EXPERIMENT_CHECK_FAILED', 'APPROVAL_REJECTED', 'EEXIST'].includes(error.message) ? error.message : 'EXPERIMENT_STOPPED', recovery: 'Inspect private journal; observe existing hashes before any further dispatch.' });
  process.exitCode = 1;
} finally { if (lock) { await lock.close(); await unlink('.env.b002-lock'); } }
