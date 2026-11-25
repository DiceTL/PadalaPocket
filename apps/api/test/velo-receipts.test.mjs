import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Keypair } from '@stellar/stellar-sdk';
import { findStellarPayment, operatorPayer, verifyVeloReceipt, xlmToStroops } from '../src/velo-receipts.mjs';

const payer = Keypair.random().publicKey();
const receiver = Keypair.random().publicKey();
const other = Keypair.random().publicKey();
const createdAt = '2026-11-23T00:00:00Z';
const expiresAt = '2026-11-23T00:30:00Z';
const hash = 'a'.repeat(64);
const row = { amount_minor: 1000, amount_stroops: '10330578', expected_receiver: receiver };
const intent = {
  status: 'paid', paymentIntentId: 'abcdefghijklmnopqrstuvwx', amount: '1.0330578',
  asset: 'native', receiverAddress: receiver, payerAddress: payer, createdAt, expiresAt,
};
const payment = (patch = {}) => ({
  type: 'payment', asset_type: 'native', from: payer, to: receiver,
  transaction_successful: true, transaction_hash: hash, amount: '1.0330578',
  created_at: createdAt, ...patch,
});
const transaction = (patch = {}) => ({ hash, successful: true, ledger: 5726509, ...patch });
function horizon({ records = [], tx = transaction() } = {}) {
  return async url => url.includes('/transactions/')
    ? { ok: true, json: async () => tx }
    : { ok: true, json: async () => ({ _embedded: { records } }) };
}

test('XLM conversion and pinned public key validation are strict', () => {
  assert.equal(xlmToStroops('1.0330578'), 10330578n);
  assert.equal(xlmToStroops('1'), 10000000n);
  assert.throws(() => xlmToStroops('1.00000001'));
  assert.equal(operatorPayer(payer), payer);
  assert.throws(() => operatorPayer(Keypair.random().secret()));
  assert.throws(() => operatorPayer('not-a-key'));
});

test('one exact native payment from the pinned payer verifies', async () => {
  const result = await verifyVeloReceipt(row, intent, { payer, horizon: horizon({ records: [payment()] }) });
  assert.equal(result.status, 'verified');
  assert.equal(result.txHash, hash);
  assert.equal(result.payerAddress, payer);
  assert.equal(result.ledger, 5726509);
});

test('wrong payer, amount, time, duplicate and failed transaction stay unverified', async () => {
  const before = await verifyVeloReceipt(row, { ...intent, payerAddress: other }, { payer, horizon: horizon({ records: [payment()] }) });
  assert.equal(before.status, 'mismatch');

  const amount = await findStellarPayment({ payer, receiver, amountStroops: 10330579n, createdAt, expiresAt, horizon: horizon({ records: [payment()] }) });
  assert.equal(amount.status, 'unavailable');

  const outside = await findStellarPayment({ payer, receiver, amountStroops: 10330578n, createdAt, expiresAt, horizon: horizon({ records: [payment({ created_at: '2026-11-23T00:31:00Z' })] }) });
  assert.equal(outside.status, 'unavailable');

  const duplicate = await findStellarPayment({ payer, receiver, amountStroops: 10330578n, createdAt, expiresAt, horizon: horizon({ records: [payment(), payment({ transaction_hash: 'b'.repeat(64) })] }) });
  assert.equal(duplicate.status, 'mismatch');

  const failed = await findStellarPayment({ payer, receiver, amountStroops: 10330578n, createdAt, expiresAt, horizon: horizon({ records: [payment()], tx: transaction({ successful: false }) }) });
  assert.equal(failed.status, 'mismatch');
});

test('an unclaimable hash is excluded and a claimable later payment verifies', async () => {
  const later = 'b'.repeat(64);
  const records = [payment(), payment({ transaction_hash: later })];
  const unused = await findStellarPayment({
    payer, receiver, amountStroops: 10330578n, createdAt, expiresAt,
    horizon: horizon({ records, tx: transaction({ hash: later }) }),
    isCandidateClaimable: async candidate => candidate.txHash === later,
  });
  assert.equal(unused.status, 'verified');
  assert.equal(unused.txHash, later);

  const ambiguous = await findStellarPayment({
    payer, receiver, amountStroops: 10330578n, createdAt, expiresAt,
    horizon: horizon({ records }), isCandidateClaimable: async () => true,
  });
  assert.equal(ambiguous.status, 'mismatch');

  const onlyBound = await findStellarPayment({
    payer, receiver, amountStroops: 10330578n, createdAt, expiresAt,
    horizon: horizon({ records: [payment()] }), isCandidateClaimable: async () => false,
  });
  assert.equal(onlyBound.status, 'unavailable');
});

test('the claimability lookup receives the payment hash and time', async () => {
  const seen = [];
  const result = await findStellarPayment({
    payer, receiver, amountStroops: 10330578n, createdAt, expiresAt,
    horizon: horizon({ records: [payment()] }),
    isCandidateClaimable: async candidate => { seen.push(candidate); return true; },
  });
  assert.equal(result.status, 'verified');
  assert.deepEqual(seen, [{ txHash: hash, createdAt, amountStroops: '10330578' }]);
});

test('a failing claimability lookup fails closed', async () => {
  const result = await verifyVeloReceipt(row, intent, {
    payer, horizon: horizon({ records: [payment()] }),
    isCandidateClaimable: async () => { throw Error('database unavailable'); },
  });
  assert.equal(result.status, 'unavailable');
});

test('absent intent payer falls back to the pinned env payer', async () => {
  const original = process.env.OPERATOR_PAYER_PUBLIC_KEY;
  process.env.OPERATOR_PAYER_PUBLIC_KEY = payer;
  try {
    const result = await verifyVeloReceipt(
      row,
      { ...intent, payerAddress: null },
      { horizon: horizon({ records: [payment()] }) },
    );
    assert.equal(result.status, 'verified');
    assert.equal(result.txHash, hash);
  } finally {
    if (original === undefined) delete process.env.OPERATOR_PAYER_PUBLIC_KEY;
    else process.env.OPERATOR_PAYER_PUBLIC_KEY = original;
  }
});

test('operator equal to receiver or absent fails closed', async () => {
  const self = await verifyVeloReceipt(
    { ...row, expected_receiver: payer },
    { ...intent, receiverAddress: payer },
    { payer, horizon: horizon({ records: [] }) },
  );
  assert.equal(self.status, 'mismatch');

  const original = process.env.OPERATOR_PAYER_PUBLIC_KEY;
  delete process.env.OPERATOR_PAYER_PUBLIC_KEY;
  try {
    const absent = await verifyVeloReceipt(row, intent, { horizon: horizon({ records: [] }) });
    assert.equal(absent.status, 'unavailable');
  } finally {
    if (original === undefined) delete process.env.OPERATOR_PAYER_PUBLIC_KEY;
    else process.env.OPERATOR_PAYER_PUBLIC_KEY = original;
  }
});
