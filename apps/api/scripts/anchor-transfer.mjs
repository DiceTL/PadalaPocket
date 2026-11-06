// B-004: one fixed 1-XLM Testnet withdrawal transfer; never resubmit an unknown hash.
import { open, readFile, rename, unlink, stat } from 'node:fs/promises';
import { Asset, Horizon, Keypair, Memo, Networks, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
const path = '.env.b004-anchor.json';
const check = value => { if (!value) throw new Error('TRANSFER_CHECK_FAILED'); };
let lock;
try {
  check(((await stat(path)).mode & 0o077) === 0 && ((await stat('.env.local')).mode & 0o077) === 0);
  lock = await open('.env.b004-anchor-lock', 'wx', 0o600);
  const state = JSON.parse(await readFile(path, 'utf8'));
  const save = async () => {
    const file = await open(path + '.next', 'wx', 0o600);
    try { await file.writeFile(JSON.stringify(state, null, 2)); await file.sync(); } finally { await file.close(); }
    await rename(path + '.next', path);
  };
  const merchant = Keypair.fromSecret(process.env.MERCHANT_SECRET);
  check(merchant.publicKey() === state.merchant);
  const horizon = new Horizon.Server('https://horizon-testnet.stellar.org');
  if (state.transfer) {
    // Observation only. A missing/expired transaction never triggers replacement.
    try {
      const result = await horizon.transactions().transaction(state.transfer.hash).call();
      state.transfer.observed = { hash: result.hash, successful: result.successful, ledger: result.ledger };
      delete state.transfer.observationError;
      await save(); console.log(JSON.stringify(state.transfer.observed));
    } catch (error) {
      state.transfer.observationError = {
        at: new Date().toISOString(),
        status: Number.isInteger(error.response?.status) ? error.response.status : null,
        message: String(error.message || 'LOOKUP_FAILED').slice(0, 200),
      };
      await save();
      console.error(JSON.stringify({ hash: state.transfer.hash, observed: false, status: state.transfer.observationError.status }));
      process.exitCode = 1;
    }
  } else {
    const response = await fetch('https://testanchor.stellar.org/sep24/transaction?id=' + encodeURIComponent(state.id), {
      headers: { Authorization: 'Bearer ' + state.token }, redirect: 'error', signal: AbortSignal.timeout(20000),
    });
    check(response.ok);
    const { transaction: t } = await response.json();
    check(t.id === state.id && t.kind === 'withdrawal' && t.status === 'pending_user_transfer_start');
    check(t.amount_in === '1' && t.amount_in_asset === 'stellar:native' && t.withdraw_memo_type === 'id');
    check(t.from === merchant.publicKey() && t.withdraw_anchor_account === state.uiTransaction.destination_account);
    check(String(t.withdraw_memo) === String(state.uiTransaction.memo));
    check(state.uiTransaction.amount_expected?.amount === '1' && state.uiTransaction.amount_expected?.asset === 'stellar:native');
    const account = await horizon.loadAccount(merchant.publicKey());
    const fee = await horizon.fetchBaseFee(); check(fee > 0 && fee <= 100000);
    const tx = new TransactionBuilder(account, { fee: String(fee), networkPassphrase: Networks.TESTNET })
      .addOperation(Operation.payment({ destination: t.withdraw_anchor_account, asset: Asset.native(), amount: '1' }))
      .addMemo(Memo.id(String(t.withdraw_memo))).setTimeout(120).build();
    tx.sign(merchant);
    state.transfer = { hash: tx.hash().toString('hex'), xdr: tx.toXDR(), withdrawalId: state.id, amount: '1', phase: 'dispatch_recorded', at: new Date().toISOString() };
    await save();
    const result = await horizon.submitTransaction(tx);
    check(result.hash === state.transfer.hash && result.successful === true);
    state.transfer.phase = 'confirmed'; state.transfer.observed = { hash: result.hash, successful: result.successful, ledger: result.ledger };
    await save(); console.log(JSON.stringify(state.transfer.observed));
  }
} catch (error) {
  console.error(JSON.stringify({ error: 'TRANSFER_STOPPED', recovery: 'Inspect private journal and observe any stored hash; never recreate or resubmit an unknown transfer.' }));
  process.exitCode = 1;
} finally {
  if (lock) { await lock.close(); await unlink('.env.b004-anchor-lock'); }
}
