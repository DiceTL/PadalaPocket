import { Keypair } from '@stellar/stellar-sdk';

// DEC-108 applies to existing shared G-accounts, not T11's new protected accounts.
export function assertCoordinatorAuthority(account, { sourceAccount, guardAccount }) {
  const reject = () => { throw Object.assign(Error('SIGNING_AUTHORITY_UNSAFE'), { code: 'SIGNING_AUTHORITY_UNSAFE', status: 503 }); };
  try {
    Keypair.fromPublicKey(sourceAccount);
    Keypair.fromPublicKey(guardAccount);
  } catch { reject(); }
  if (sourceAccount === guardAccount || account?.account_id !== sourceAccount
    || !Array.isArray(account.signers) || account.signers.length !== 2
    || !['low_threshold', 'med_threshold', 'high_threshold'].every(name => account.thresholds?.[name] === 2)) reject();
  const keys = new Set();
  for (const signer of account.signers) {
    // Reject extra/preauthorized/hash signers, duplicate entries, zero and unknown weights.
    if (signer?.type !== 'ed25519_public_key' || signer.weight !== 1
      || ![sourceAccount, guardAccount].includes(signer.key) || keys.has(signer.key)) reject();
    keys.add(signer.key);
  }
  if (!keys.has(sourceAccount) || !keys.has(guardAccount)) reject();
}
