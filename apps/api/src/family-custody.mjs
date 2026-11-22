import { Keypair, Networks, Transaction, TransactionBuilder } from '@stellar/stellar-sdk';

const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const unavailable = () => Object.assign(Error('CUSTODY_UNAVAILABLE'), { code: 'CUSTODY_UNAVAILABLE', status: 503 });
const mismatch = () => Object.assign(Error('CUSTODY_BINDING_MISMATCH'), { code: 'CUSTODY_BINDING_MISMATCH', status: 409 });

// Pass an authenticated membership and a server-selected binding and envelope, never raw HTTP input.
// The pg client must execute as family_custody_worker; the function does not send or return a seed.
export async function signFamilyTransaction(database, { member, wallet, unsigned }) {
  if (!wallet || !uuid.test(member?.user_id ?? '') || !uuid.test(wallet.familyId ?? '') || member.family_id !== wallet.familyId
    || !['parent', 'student', 'agent'].includes(wallet.role) || wallet.network !== 'testnet'
    || !Number.isInteger(wallet.version) || wallet.version < 1 || wallet.version > 2147483647
    || typeof unsigned !== 'string' || unsigned.length > 1048576) throw mismatch();

  let transaction;
  try {
    Keypair.fromPublicKey(wallet.publicAddress);
    transaction = TransactionBuilder.fromXDR(unsigned, Networks.TESTNET);
    if (!(transaction instanceof Transaction) || transaction.source !== wallet.publicAddress || transaction.signatures.length !== 0) throw Error();
  } catch { throw mismatch(); }

  try {
    const { rows } = await database.query('select wallet_custody.resolve_family_signing_seed($1, $2, $3, $4, $5, $6) as seed',
      [member.user_id, wallet.familyId, wallet.role, wallet.network, wallet.publicAddress, wallet.version]);
    const signer = Keypair.fromSecret(rows[0]?.seed);
    if (signer.publicKey() !== wallet.publicAddress) throw Error();
    transaction.sign(signer);
    return transaction.toXDR();
  } catch { throw unavailable(); }
}
