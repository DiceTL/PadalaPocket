import assert from 'node:assert/strict';
import test from 'node:test';
import { Keypair } from '@stellar/stellar-sdk';
import { assertCoordinatorAuthority } from '../src/money-authority.mjs';

// Public addresses only; these keys are never funded, signed with or persisted.
const [sourceAccount, guardAccount, other] = [1, 2, 3].map(byte => Keypair.fromRawEd25519Seed(Buffer.alloc(32, byte)).publicKey());
const identity = { sourceAccount, guardAccount };
const policy = () => ({ account_id: sourceAccount,
  thresholds: { low_threshold: 2, med_threshold: 2, high_threshold: 2 },
  signers: [sourceAccount, guardAccount].map(key => ({ key, weight: 1, type: 'ed25519_public_key' })),
});
const unsafe = value => assert.throws(() => assertCoordinatorAuthority(value, identity), { code: 'SIGNING_AUTHORITY_UNSAFE', status: 503 });

test('retained legacy key alone cannot satisfy any operation threshold', () => {
  const account = policy();
  assertCoordinatorAuthority(account, identity);
  for (const threshold of Object.values(account.thresholds)) {
    assert.ok(account.signers[0].weight < threshold);
    assert.equal(account.signers.reduce((sum, signer) => sum + signer.weight, 0), threshold);
  }
});

test('lower thresholds and elevated legacy weight permit bypass and are rejected', () => {
  for (const name of ['low_threshold', 'med_threshold', 'high_threshold']) {
    for (const weight of [0, 1, '2', undefined]) {
      const account = policy(); account.thresholds[name] = weight; unsafe(account);
    }
  }
  const account = policy(); account.signers[0].weight = 2; unsafe(account);
});

test('alternative signers, missing guardian and malformed ledger identity stay unsafe', () => {
  for (const type of ['ed25519_public_key', 'sha256_hash', 'preauth_tx']) {
    const account = policy(); account.signers.push({ key: other, weight: 1, type }); unsafe(account);
  }
  for (const change of [
    account => { account.signers.pop(); },
    account => { account.signers[1].key = sourceAccount; },
    account => { account.signers[1].key = other; },
    account => { account.signers[1].weight = 0; },
    account => { account.signers[1].weight = '1'; },
    account => { account.signers[1].type = 'sha256_hash'; },
    account => { account.account_id = other; },
    account => { account.thresholds = null; },
    account => { account.signers = null; },
  ]) {
    const account = policy(); change(account); unsafe(account);
  }
  unsafe(null);
  assert.throws(() => assertCoordinatorAuthority(policy(), { sourceAccount, guardAccount: sourceAccount }), { code: 'SIGNING_AUTHORITY_UNSAFE' });
  assert.throws(() => assertCoordinatorAuthority(policy(), { sourceAccount, guardAccount: 'invalid' }), { code: 'SIGNING_AUTHORITY_UNSAFE' });
});
