// Run from root: node --env-file=.env.local apps/api/scripts/wallet-backing.mjs init|run|observe
import { readFile, writeFile, stat, open, unlink, rename } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { Asset, Keypair, Networks, TransactionBuilder } from '@stellar/stellar-sdk';
import { NoirAgentClient, keypairSigner } from '@noirx402/agent-sdk';


const bucketMode = process.argv[2]?.endsWith('-buckets');
const path = bucketMode ? '.env.b003-buckets.json' : '.env.b003-state.json';
const command = process.argv[2]?.replace(/-buckets$/, '');
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
  lock = await open('.env.b003-lock', 'wx', 0o600);
  const owner = keypairSigner(process.env.OWNER_SECRET), agent = keypairSigner(process.env.AGENT_SECRET), merchant = keypairSigner(process.env.MERCHANT_SECRET);
  const noir = new NoirAgentClient({ network: 'testnet' });
  noir.server.httpClient.defaults.timeout = 15_000;
  if (command === 'init') {
    state = { studentSecret: Keypair.random().secret(), allowance: randomBytes(32).toString('hex'), private: randomBytes(32).toString('hex'), owner: owner.publicKey, merchant: merchant.publicKey, agent: agent.publicKey, expiresAt: new Date(Date.now()+3_600_000).toISOString(), steps: {}, observations: [] };
    if (bucketMode) {
      if ((await stat('.env.b003-state.json')).mode & 0o077) throw new Error('ENV_PERMISSIONS');
      const prior = JSON.parse(await readFile('.env.b003-state.json', 'utf8'));
      requireThat(prior.owner === owner.publicKey && prior.agent === agent.publicKey && prior.merchant === merchant.publicKey);
      state.studentSecret = prior.studentSecret; state.private = prior.private;
      state.buckets = Object.fromEntries(['needs', 'wants', 'savings'].map(name => [name, randomBytes(32).toString('hex')]));
    }
    await writeFile(path, JSON.stringify(state, null, 2)+'\n', { mode: 0o600, flag: 'wx' }); emit({ initialized: true });
  } else {
    if ((await stat(path)).mode & 0o077) throw new Error('ENV_PERMISSIONS');
    state = JSON.parse(await readFile(path, 'utf8'));
    const student = keypairSigner(state.studentSecret), asset = Asset.native().contractId(Networks.TESTNET);
    requireThat(state.owner === owner.publicKey && state.agent === agent.publicKey && state.merchant === merchant.publicKey);
    requireThat(new Set([owner.publicKey, agent.publicKey, merchant.publicKey, student.publicKey]).size === 4);
    async function observation(label, value) { state.observations.push({ label, value, observedAt: new Date().toISOString() }); await save(); emit({ label, value }); }
    async function snapshot() {
      const wallets = {};
      for (const signer of [owner, student, merchant]) {
        const response = await fetch(`https://horizon-testnet.stellar.org/accounts/${signer.publicKey}`, { signal: AbortSignal.timeout(15_000) });
        requireThat(response.ok); const account = await response.json();
        const balance = account.balances.find(b => b.asset_type === 'native').balance;
        requireThat(/^\d+\.\d{7}$/.test(balance));
        wallets[signer.publicKey] = BigInt(balance.replace('.', '')).toString();
      }
      const buckets = {};
      for (const [name, hash] of Object.entries(state.buckets ?? {})) buckets[name] = (await noir.getEscrowBalance(hash)).toString();
      return { wallets, buckets, allowance: (await noir.getEscrowBalance(state.allowance)).toString(), private: (await noir.getEscrowBalance(state.private)).toString(), pending: (await noir.getPendingBalance(merchant.publicKey)).toString() };
    }
    if (command === 'observe') {
      for (const [name, step] of Object.entries(state.steps)) if (step.hash) {
        const result = await noir.server.getTransaction(step.hash); await observation(name, { hash: step.hash, ledgerStatus: result.status });
      }
      await observation('current', await snapshot());
    } else {
      requireThat(Date.parse(state.expiresAt) > Date.now());
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
        if (result.status === 'SUCCESS') { entry.phase = 'confirmed'; entry.feeStroops = result.resultXdr.feeCharged().toString(); await save(); return; }
        if (entry.phase !== 'prepared' || result.status !== 'NOT_FOUND') throw new Error('OBSERVE_REQUIRED');
        const tx = TransactionBuilder.fromXDR(entry.signed, Networks.TESTNET);
        requireThat(BigInt(tx.timeBounds.maxTime) > BigInt(Math.floor(Date.now() / 1000)));
        entry.phase = 'dispatched'; await save(); // Never replace or retry an uncertain dispatch.
        const hash = await noir.submit(entry.signed, op);
        requireThat(hash === entry.hash);
        entry.phase = 'confirmed'; const confirmed = await noir.server.getTransaction(hash); requireThat(confirmed.status === 'SUCCESS'); entry.feeStroops = confirmed.resultXdr.feeCharged().toString(); await save(); emit({ step: name, hash, ledgerStatus: 'SUCCESS' });
      }

      if (bucketMode) {
        requireThat(new Set(Object.values(state.buckets)).size === 3);
        const total = snap => [...Object.values(snap.wallets), ...Object.values(snap.buckets), snap.allowance, snap.private, snap.pending].reduce((a, b) => a + BigInt(b), 0n);
        if (!state.baseline) {
          state.baseline = await snapshot();
          requireThat(Object.values(state.baseline.buckets).every(b => b === '0') && state.baseline.pending === '0' && state.baseline.private === '0');
          await save();
        }
        for (const [name, deviceHash] of Object.entries(state.buckets)) {
          await send(name + 'Device', owner, { kind: 'registerDevice', deviceHash, agent: name === 'savings' ? owner.publicKey : agent.publicKey });
          requireThat(await noir.getDeviceOwner(deviceHash) === owner.publicKey);
          if (name !== 'savings') await send(name + 'Policy', owner, { kind: 'registerAgent', deviceHash, agent: agent.publicKey, asset, maxAmount: 10_000_000n, expiresAt: new Date(state.expiresAt) });
          await send(name + 'Fund', owner, { kind: 'fundEscrow', deviceHash, token: asset, amount: 10_000_000n });
        }
        const funded = await snapshot();
        requireThat(Object.values(funded.buckets).every(b => b === '10000000'));
        await observation('separateFundedBuckets', funded);
        requireThat(await noir.getPolicy(state.buckets.savings) === null);
        for (const key of [owner.publicKey, agent.publicKey]) {
          const check = await noir.checkPayment({ deviceHash: state.buckets.savings, agent: key, asset, amount: 1n });
          requireThat(!check.ok); await observation('savingsRefusal', { agent: key, ...check });
        }
        for (const name of ['needs', 'wants']) {
          const check = await noir.checkPayment({ deviceHash: state.buckets[name], agent: agent.publicKey, asset, amount: 1n });
          requireThat(check.ok); await observation(name + 'AllowanceCheck', check);
        }
        for (const name of ['needs', 'wants', 'savings']) {
          await send(name + 'Withdraw', owner, { kind: 'defundEscrow', deviceHash: state.buckets[name], token: asset, amount: 10_000_000n });
          const snap = await snapshot();
          requireThat(snap.buckets[name] === '0');
          for (const later of ['needs', 'wants', 'savings'].slice(['needs', 'wants', 'savings'].indexOf(name) + 1)) requireThat(snap.buckets[later] === '10000000');
          await observation(name + 'IsolatedWithdrawal', snap);
          if (name !== 'savings') await send(name + 'Revoke', owner, { kind: 'revokeAgent', deviceHash: state.buckets[name] });
        }
        const final = await snapshot();
        const fees = Object.values(state.steps).reduce((a, b) => a + BigInt(b.feeStroops ?? '0'), 0n);
        requireThat(total(state.baseline) - total(final) === fees && Object.values(final.buckets).every(b => b === '0'));
        await observation('bucketConservation', { baseline: state.baseline, final, fees: fees.toString(), conserved: true });
        emit({ experiment: 'buckets passed' });
      } else {
      if (!state.steps.friendbot) {
        state.steps.friendbot = { phase: 'dispatched' }; await save();
        const response = await fetch(`https://friendbot.stellar.org?addr=${student.publicKey}`, { signal: AbortSignal.timeout(30_000) }); requireThat(response.ok);
        state.steps.friendbot.phase = 'confirmed'; await save();
      }
      requireThat(state.steps.friendbot.phase === 'confirmed');
      if (!state.baseline) { state.baseline = await snapshot(); requireThat(state.baseline.pending === '0'); await save(); }
      const policy = (deviceHash, agentKey) => ({ kind: 'registerAgent', deviceHash, agent: agentKey, asset, maxAmount: 10_000_000n, expiresAt: new Date(state.expiresAt) });
      await send('allowanceDevice', owner, { kind: 'registerDevice', deviceHash: state.allowance, agent: agent.publicKey });
      await send('allowancePolicy', owner, policy(state.allowance, agent.publicKey));
      await send('fundAllowance', owner, { kind: 'fundEscrow', deviceHash: state.allowance, token: asset, amount: 20_000_000n });
      await observation('funded', await snapshot());
      await send('withdrawActive', owner, { kind: 'defundEscrow', deviceHash: state.allowance, token: asset, amount: 10_000_000n });
      requireThat(await noir.getEscrowBalance(state.allowance) === 10_000_000n);
      await observation('withdrawnWithActiveAgent', await snapshot());
      await send('refill', owner, { kind: 'fundEscrow', deviceHash: state.allowance, token: asset, amount: 10_000_000n });
      await send('revokeAllowance', owner, { kind: 'revokeAgent', deviceHash: state.allowance });
      await send('withdrawRest', owner, { kind: 'defundEscrow', deviceHash: state.allowance, token: asset, amount: 20_000_000n });
      requireThat(await noir.getEscrowBalance(state.allowance) === 0n);
      await send('privateDevice', student, { kind: 'registerDevice', deviceHash: state.private, agent: student.publicKey });
      await send('privatePolicy', student, policy(state.private, student.publicKey));
      await send('fundPrivate', owner, { kind: 'fundEscrow', deviceHash: state.private, token: asset, amount: 10_000_000n });
      const refused = await noir.checkPayment({ deviceHash: state.private, agent: agent.publicKey, asset, amount: 1n });
      requireThat(!refused.ok && refused.reason === 'wrong_agent'); await observation('allowanceCannotSpendPrivate', refused);
      await send('privateSpend', student, { kind: 'authorize', deviceHash: state.private, merchant: merchant.publicKey, asset, amount: 10_000_000n, nonce: 1n });
      await send('claim', merchant, { kind: 'claim', token: asset });
      await send('revokePrivate', student, { kind: 'revokeAgent', deviceHash: state.private });
      const final = await snapshot();
      const total = value => Object.values(value.wallets).reduce((a,b)=>a+BigInt(b),0n)+BigInt(value.allowance)+BigInt(value.private)+BigInt(value.pending);
      const fees = Object.values(state.steps).reduce((a,b)=>a+BigInt(b.feeStroops ?? '0'),0n);
      requireThat(total(state.baseline)-total(final) === fees && final.allowance === '0' && final.private === '0' && final.pending === '0');
      await observation('conservation', { baseline: state.baseline, final, fees: fees.toString(), conserved: true }); emit({ experiment: 'passed' });
      }
    }
  }
} catch { emit({ error: 'EXPERIMENT_STOPPED', recovery: 'Inspect private journal; use observe before further dispatch. No automatic retry or replacement.' }); process.exitCode=1;
} finally { if(lock) { await lock.close(); await unlink('.env.b003-lock'); } }
