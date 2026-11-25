import test from 'node:test';
import assert from 'node:assert/strict';
import { Account, Asset, Keypair, Networks, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
import { assertDepositCreditTransfer, buildDepositCreditTransfer } from '../src/velo-deposit-credit.mjs';

const source = Keypair.random();
const destination = Keypair.random();
const sourceAccount = source.publicKey();
const destinationAccount = destination.publicKey();
const amountStroops = '10331';
const build = (operations, signer = source) => {
  const transaction = new TransactionBuilder(new Account(sourceAccount, '0'), {
    fee: '100', networkPassphrase: Networks.TESTNET, timebounds: { minTime: 0, maxTime: 9999999999 },
  });
  for (const operation of operations) transaction.addOperation(operation);
  const built = transaction.build();
  built.sign(signer);
  return built;
};
const payment = destination => Operation.payment({ destination, asset: Asset.native(), amount: '0.0010331' });

test('T15 builds and validates one exact native Testnet payment', () => {
  const signed = buildDepositCreditTransfer({
    sourceAccount, destinationAccount, amountStroops, sequence: '0', signer: source,
  });
  const transaction = TransactionBuilder.fromXDR(signed, Networks.TESTNET);
  assert.doesNotThrow(() => assertDepositCreditTransfer(transaction, { sourceAccount, destinationAccount, amountStroops }));
  assert.equal(transaction.operations.length, 1);
  assert.equal(transaction.operations[0].amount, '0.0010331');
});

test('T15 rejects a different destination', () => {
  const transaction = build([payment(Keypair.random().publicKey())]);
  assert.throws(() => assertDepositCreditTransfer(transaction, { sourceAccount, destinationAccount, amountStroops }),
    { code: 'TRANSFER_MISMATCH' });
});

test('T15 rejects an extra operation', () => {
  const transaction = build([payment(destinationAccount), payment(destinationAccount)]);
  assert.throws(() => assertDepositCreditTransfer(transaction, { sourceAccount, destinationAccount, amountStroops }),
    { code: 'TRANSFER_MISMATCH' });
});

test('T15 rejects signing with a different source key', () => {
  assert.throws(() => buildDepositCreditTransfer({
    sourceAccount, destinationAccount, amountStroops, sequence: '0', signer: Keypair.random(),
  }), { code: 'SIGNING_IDENTITY_MISMATCH' });
});
