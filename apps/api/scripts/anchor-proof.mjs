// B-004 operator-only Testnet proof. Never print the private journal or interactive URL.
import { open, readFile, stat, rename, unlink } from 'node:fs/promises';
import { Keypair, Networks, StellarToml, WebAuth } from '@stellar/stellar-sdk';
const path = '.env.b004-anchor.json';
const origin = 'https://testanchor.stellar.org';
let state, lock;
const check = (ok) => { if (!ok) throw new Error('CHECK_FAILED'); };
async function save() {
  const file = await open(path + '.next', 'wx', 0o600);
  try { await file.writeFile(JSON.stringify(state, null, 2)); await file.sync(); } finally { await file.close(); }
  await rename(path + '.next', path);
}
async function request(url, options = {}) {
  check(new URL(url).origin === origin);
  const response = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(20000) });
  if (!response.ok) {
    state.lastHttpFailure = { at: new Date().toISOString(), status: response.status, body: (await response.text()).slice(0, 4000) };
    await save();
    throw new Error('HTTP_' + response.status);
  }
  return response.json();
}
try {
  const command = process.argv[2]; check(['start', 'resume', 'retry-initiation', 'new-unpaid-session', 'recover', 'status', 'history'].includes(command));
  check(((await stat('.env.local')).mode & 0o077) === 0);
  lock = await open('.env.b004-anchor-lock', 'wx', 0o600);
  const merchant = Keypair.fromSecret(process.env.MERCHANT_SECRET);
  if (command === 'start') {
    const file = await open(path, 'wx', 0o600);
    state = { merchant: merchant.publicKey(), phase: 'initialized', observations: [] };
    try { await file.writeFile(JSON.stringify(state)); } finally { await file.close(); }
  } else {
    check(((await stat(path)).mode & 0o077) === 0);
    state = JSON.parse(await readFile(path, 'utf8')); check(state.merchant === merchant.publicKey()); check(command === 'resume' ? state.phase === 'initialized' : ['history', 'retry-initiation', 'new-unpaid-session', 'recover'].includes(command) || state.id);
  }
  const config = await StellarToml.Resolver.resolve('testanchor.stellar.org');
  check(config.NETWORK_PASSPHRASE === Networks.TESTNET);
  check(config.WEB_AUTH_ENDPOINT === origin + '/auth' && config.TRANSFER_SERVER_SEP0024 === origin + '/sep24');
  const info = await request(origin + '/sep24/info');
  check(info.withdraw?.native?.enabled && Number(info.withdraw.native.min_amount) <= 1 && Number(info.withdraw.native.max_amount) >= 1);
  const challenge = await request(origin + '/auth?account=' + merchant.publicKey());
  check(challenge.network_passphrase === Networks.TESTNET);
  const verified = WebAuth.readChallengeTx(challenge.transaction, config.SIGNING_KEY, Networks.TESTNET, 'testanchor.stellar.org', 'testanchor.stellar.org');
  check(verified.clientAccountID === merchant.publicKey());
  verified.tx.sign(merchant);
  const auth = await request(origin + '/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transaction: verified.tx.toXDR() }) });
  check(typeof auth.token === 'string'); state.token = auth.token; await save();
  if (command === 'new-unpaid-session') {
    check(state.id && !state.replacementSessionUsed);
    const current = await request(origin + '/sep24/transaction?id=' + encodeURIComponent(state.id), { headers: { Authorization: 'Bearer ' + state.token } });
    check(current.transaction?.id === state.id && current.transaction.status === 'incomplete');
    check(!current.transaction.stellar_transaction_id && !current.transaction.stellar_transactions?.length && !current.transaction.amount_in);
    state.previousWithdrawals = [...(state.previousWithdrawals || []), { id: state.id, transaction: current.transaction, informationUrl: state.interactiveUrl, note: 'Unpaid; original interactive initiation link lost. Never fund this archived session.' }];
    state.replacementSessionUsed = true;
    delete state.id; delete state.interactiveUrl;
    await save();
  }
  if (command === 'retry-initiation') {
    check(state.phase === 'initiation_dispatched' && !state.id);
    const history = await request(origin + '/sep24/transactions?asset_code=native', { headers: { Authorization: 'Bearer ' + state.token } });
    check(Array.isArray(history.transactions) && history.transactions.length === 0);
    state.previousInitiations = [...(state.previousInitiations || []), { phase: state.phase, history, lastHttpFailure: state.lastHttpFailure || null, observedAt: new Date().toISOString(), note: 'Earlier initiation outcome unresolved; no transfer sent by this CLI' }];
    await save();
  }
  if (['start', 'resume', 'retry-initiation', 'new-unpaid-session'].includes(command)) {
    state.phase = 'initiation_dispatched'; await save();
    const form = new FormData();
    for (const [key, value] of Object.entries({ asset_code: 'native', account: merchant.publicKey(), amount: '1', lang: 'en' })) form.set(key, value);
    const result = await request(origin + '/sep24/transactions/withdraw/interactive', { method: 'POST', headers: { Authorization: 'Bearer ' + state.token }, body: form });
    state.initiationResponse = result; await save();
    check(result.type === 'interactive_customer_info_needed' && typeof result.id === 'string');
    check(['https://anchor-ref-ui-testanchor.stellar.org', origin].includes(new URL(result.url).origin));
    state.id = result.id; state.interactiveUrl = result.url; state.phase = 'interactive_required'; await save();
  }
  if (command === 'recover') {
    check(state.phase === 'initiation_dispatched' && !state.id);
    const history = await request(origin + '/sep24/transactions?asset_code=native', { headers: { Authorization: 'Bearer ' + state.token } });
    check(Array.isArray(history.transactions) && history.transactions.length === 1);
    const transaction = history.transactions[0];
    check(transaction.kind === 'withdrawal' && transaction.status === 'incomplete' && transaction.from === merchant.publicKey());
    check(['https://anchor-ref-ui-testanchor.stellar.org', origin].includes(new URL(transaction.more_info_url).origin));
    state.id = transaction.id; state.informationUrl = transaction.more_info_url; state.phase = 'information_only';
    state.history = history; await save();
  }
  if (command === 'history') {
    const history = await request(origin + '/sep24/transactions?asset_code=native', { headers: { Authorization: 'Bearer ' + state.token } });
    check(Array.isArray(history.transactions)); state.history = history; await save();
    console.log(JSON.stringify({ authenticated: true, transactions: history.transactions.map(t => ({ id: t.id, kind: t.kind, status: t.status, started_at: t.started_at })) }));
  } else {
  const result = await request(origin + '/sep24/transaction?id=' + encodeURIComponent(state.id), { headers: { Authorization: 'Bearer ' + state.token } });
  check(result.transaction?.id === state.id);
  state.observations.push({ at: new Date().toISOString(), transaction: result.transaction }); await save();
  console.log(JSON.stringify({ id: state.id, status: result.transaction.status, authenticated: true, interactiveUrl: 'Stored only in owner-only ignored journal', transferConfirmed: state.transfer?.observed?.successful === true }));
  }
} catch (error) {
  console.log(JSON.stringify({ error: /^HTTP_\d+$/.test(error.message) ? error.message : 'PROOF_STOPPED', recovery: 'Inspect private journal; do not repeat start after uncertain initiation.' })); process.exitCode = 1;
} finally { if (lock) { await lock.close(); await unlink('.env.b004-anchor-lock'); } }
