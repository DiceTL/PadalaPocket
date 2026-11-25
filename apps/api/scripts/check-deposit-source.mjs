import { Keypair } from '@stellar/stellar-sdk';
import { assertCoordinatorAuthority } from '../src/money-authority.mjs';

// T38 read-only readiness check for the dedicated project deposit source.
// It creates nothing, signs nothing and sends nothing; provisioning and fee
// funding remain an approved operator action.
const baseReserveStroops = 5000000n;
const toStroops = value => {
  const match = /^(\d+)(?:\.(\d{1,7}))?$/.exec(value ?? '');
  if (!match) throw Error('malformed balance');
  return BigInt(match[1]) * 10000000n + BigInt((match[2] ?? '').padEnd(7, '0'));
};

try {
  const source = Keypair.fromSecret(process.env.PROJECT_DEPOSIT_SOURCE_SECRET ?? '');
  const guard = Keypair.fromPublicKey(process.env.MONEY_COORDINATOR_GUARD_PUBLIC_KEY ?? '');
  const response = await fetch(`https://horizon-testnet.stellar.org/accounts/${source.publicKey()}`, {
    redirect: 'error', signal: AbortSignal.timeout(15000),
  });
  if (response.status === 404) throw Error('source account does not exist on Testnet');
  if (!response.ok) throw Error(`Horizon returned ${response.status}`);
  const account = await response.json();
  assertCoordinatorAuthority(account, { sourceAccount: source.publicKey(), guardAccount: guard.publicKey() });

  const native = account.balances.find(balance => balance.asset_type === 'native');
  const minimum = BigInt(2 + account.subentry_count + account.num_sponsoring - account.num_sponsored) * baseReserveStroops;
  const spendableStroops = toStroops(native?.balance) - minimum;
  if (spendableStroops <= 0n) throw Error('source has no spendable native balance for fees');

  // Public address only; the secret and any signing material stay in the coordinator.
  console.log(JSON.stringify({
    network: 'testnet', address: account.account_id, spendableStroops: spendableStroops.toString(),
    guardPolicy: 'two-signer-threshold-2', sourceRecorded: true,
  }, null, 2));
  console.log('PASS: check-deposit-source (read-only; no transaction prepared or sent)');
} catch (error) {
  console.error(`FAIL: check-deposit-source (${error.code ?? error.message})`);
  process.exitCode = 1;
}
