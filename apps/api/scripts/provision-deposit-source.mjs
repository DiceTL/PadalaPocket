import { readFile, writeFile } from 'node:fs/promises';
import { Account, Keypair, Networks, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
import { assertCoordinatorAuthority } from '../src/money-authority.mjs';

// DEC-143: one dedicated Testnet project deposit source for T38. It is funded
// only by Friendbot, gets exactly two weight-1 signers (itself and a disposable
// proof guard) with thresholds 2, and its secrets stay in the ignored,
// owner-only state file. Nothing is printed except public data.
const STATE = new URL('../../../.env.t38-live.json', import.meta.url);
const HORIZON = 'https://horizon-testnet.stellar.org';
const FRIENDBOT = 'https://friendbot.stellar.org';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function horizon(path, init) {
  const response = await fetch(`${HORIZON}${path}`, { redirect: 'error', signal: AbortSignal.timeout(20000), ...init });
  const body = await response.text();
  return { response, body: body ? JSON.parse(body) : null };
}
async function account(address) {
  const { response, body } = await horizon(`/accounts/${address}`);
  return response.status === 404 ? null : body;
}
async function waitForAccount(address) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const found = await account(address);
    if (found) return found;
    await sleep(1500);
  }
  throw Error('source account did not appear on Horizon');
}
function policyReady(account, guard) {
  try {
    assertCoordinatorAuthority(account, { sourceAccount: account.account_id, guardAccount: guard });
    return true;
  } catch { return false; }
}

let stage = 'state', passed = false, summary = {};
try {
  let state = null;
  try { state = JSON.parse(await readFile(STATE, 'utf8')); } catch { state = null; }

  stage = 'keys';
  const source = state?.sourceSecret ? Keypair.fromSecret(state.sourceSecret) : Keypair.random();
  const guard = state?.guardSecret ? Keypair.fromSecret(state.guardSecret) : Keypair.random();
  const sourceAddress = source.publicKey(), guardAddress = guard.publicKey();
  if (sourceAddress === guardAddress) throw Error('source and guard must differ');

  stage = 'fund';
  let current = await account(sourceAddress);
  if (!current) {
    const funded = await fetch(`${FRIENDBOT}/?addr=${encodeURIComponent(sourceAddress)}`, {
      redirect: 'error', signal: AbortSignal.timeout(30000),
    });
    if (!funded.ok) throw Error(`Friendbot returned ${funded.status}`);
    current = await waitForAccount(sourceAddress);
  }

  stage = 'guard-policy';
  let setupHash = state?.setupHash ?? null;
  if (!policyReady(current, guardAddress)) {
    if (setupHash) throw Error('saved setup transaction did not take effect; inspect before retrying');
    const transaction = new TransactionBuilder(new Account(sourceAddress, current.sequence), {
      fee: '1000', networkPassphrase: Networks.TESTNET, timebounds: { minTime: 0, maxTime: Math.floor(Date.now() / 1000) + 120 },
    }).addOperation(Operation.setOptions({
      masterWeight: 1, lowThreshold: 2, medThreshold: 2, highThreshold: 2,
      signer: { ed25519PublicKey: guardAddress, weight: 1 },
    })).build();
    transaction.sign(source);
    const submitted = await horizon('/transactions', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ tx: transaction.toXDR() }).toString(),
    });
    if (!submitted.response.ok) {
      // An unknown submission is observed, never replaced with a new envelope.
      throw Object.assign(Error(`Horizon rejected the setup transaction: ${submitted.body?.extras?.result_codes?.transaction ?? submitted.response.status}`), { code: 'SETUP_REJECTED' });
    }
    setupHash = submitted.body.hash;
  }

  stage = 'verify';
  let verified = null;
  for (let attempt = 0; attempt < 20; attempt++) {
    const latest = await account(sourceAddress);
    if (policyReady(latest, guardAddress)) { verified = latest; break; }
    if (setupHash) {
      const { body } = await horizon(`/transactions/${setupHash}`);
      if (body?.successful === false) throw Error('saved setup transaction failed on ledger');
    }
    await sleep(1500);
  }
  if (!verified) throw Error('source guard policy did not become active');

  const next = {
    version: 1, network: 'testnet', decision: 'DEC-143', createdAt: state?.createdAt ?? new Date().toISOString(),
    source: sourceAddress, sourceSecret: source.secret(),
    guard: guardAddress, guardSecret: guard.secret(), setupHash,
  };
  await writeFile(STATE, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });

  const native = Number(verified.balances.find(balance => balance.asset_type === 'native').balance);
  summary = {
    network: 'testnet', source: sourceAddress, guard: guardAddress, setupHash,
    nativeBalanceXlm: native.toFixed(7), guardPolicy: 'two-signer-threshold-2',
    stateFile: '.env.t38-live.json (owner-only)',
  };
  passed = true;
  console.log('PASS: provision-deposit-source (Friendbot-funded Testnet source, two-signer guard policy, no payment sent)');
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  console.error(`FAIL: provision-deposit-source (${stage}; ${error.code ?? error.message})`);
  if (error.response) console.error(JSON.stringify(error.response));
} finally { if (!passed) process.exitCode = 1; }
