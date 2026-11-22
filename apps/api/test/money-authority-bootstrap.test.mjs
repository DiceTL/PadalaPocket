import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Keypair, Networks, TransactionBuilder } from '@stellar/stellar-sdk';
import { buildAuthorityBootstrap } from '../src/money-authority-bootstrap.mjs';

function fixture() {
  const account = signer => ({ account_id: signer.publicKey(), sequence: '900', subentry_count: 0,
    num_sponsoring: 0, num_sponsored: 0, balances: [{ asset_type: 'native', balance: '100.0000000', selling_liabilities: '0.0000000' }],
    signers: [{ key: signer.publicKey(), type: 'ed25519_public_key', weight: 1 }],
    thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 } });
  const fee = Keypair.random();
  return { feeSource: { signer: fee, account: account(fee) },
    targets: ['OWNER', 'AGENT', 'MERCHANT', 'STUDENT'].map(role => { const signer = Keypair.random(); return { role, signer, account: account(signer) }; }),
    guardAccount: Keypair.random().publicKey(), baseReserveStroops: '5000000', baseFeeStroops: '100',
    maxReserveStroops: '20000000', maxFeeStroops: '800' };
}

test('bootstrap uses only project sequence and operating funds, atomically changing all four authorities', () => {
  const input = fixture();
  input.targets.forEach((target, index) => { target.account.sequence = String(5000 + index); });
  const tx = TransactionBuilder.fromXDR(buildAuthorityBootstrap(input, { now: () => 0 }), Networks.TESTNET);
  assert.equal(tx.source, input.feeSource.signer.publicKey()); assert.equal(tx.sequence, '901');
  assert.equal(tx.fee, '800'); assert.equal(tx.timeBounds.maxTime, '120'); assert.equal(tx.operations.length, 8);
  for (let index = 0; index < 4; index++) {
    const target = input.targets[index].signer.publicKey();
    assert.deepEqual(tx.operations[index * 2], { type: 'payment', source: tx.source, destination: target, asset: tx.operations[index * 2].asset, amount: '0.5000000' });
    assert.equal(tx.operations[index * 2].asset.isNative(), true);
    const { type, source, masterWeight, lowThreshold, medThreshold, highThreshold, signer } = tx.operations[index * 2 + 1];
    assert.deepEqual({ type, source, masterWeight, lowThreshold, medThreshold, highThreshold, signer },
      { type: 'setOptions', source: target, masterWeight: 1, lowThreshold: 2, medThreshold: 2, highThreshold: 2,
        signer: { ed25519PublicKey: input.guardAccount, weight: 1 } });
  }
  assert.equal(tx.signatures.length, 5);
  for (const signer of [input.feeSource.signer, ...input.targets.map(target => target.signer)]) {
    assert.ok(tx.signatures.some(signature => signer.verify(tx.hash(), signature.signature())));
  }
  assert.equal(tx.signatures.some(signature => Keypair.fromPublicKey(input.guardAccount).verify(tx.hash(), signature.signature())), false);
});

test('bootstrap rejects budget overruns, insufficient project float and unsafe or mismatched authorities', () => {
  const changes = [
    input => { input.maxReserveStroops = '19999999'; },
    input => { input.maxFeeStroops = '799'; },
    input => { input.baseFeeStroops = '0'; },
    input => { input.feeSource.account.balances[0].balance = '2.0000799'; },
    input => { input.feeSource.account.balances[0].selling_liabilities = '98.0000000'; },
    input => { input.targets[0].account.account_id = input.targets[1].signer.publicKey(); },
    input => { input.targets[0].account.signers.push({ key: input.guardAccount, type: 'ed25519_public_key', weight: 1 }); },
    input => { input.targets[0].account.thresholds.high_threshold = 2; },
    input => { input.targets[0].account.signers[0].weight = 2; },
    input => { input.targets[0].role = 'STUDENT'; },
    input => { input.guardAccount = input.feeSource.signer.publicKey(); },
    input => { input.feeSource = input.targets[0]; },
    input => { input.targets.pop(); },
  ];
  for (const change of changes) { const input = fixture(); change(input); assert.throws(() => buildAuthorityBootstrap(input, { now: () => 0 }), { code: 'AUTHORITY_BOOTSTRAP_UNSAFE' }); }
});
