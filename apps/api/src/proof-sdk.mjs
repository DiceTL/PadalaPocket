import { Asset, Config, Keypair, Networks } from '@stellar/stellar-sdk';
import { NoirAgentClient } from '@noirx402/agent-sdk';
import { Velo } from '@carts1024/velo-sdk';
import { ProofError } from './proof.mjs';

export const SDK_VERSIONS = { noir: '0.3.0', stellar: '16.0.1', velo: '0.1.0-alpha.4' };

// Historical B-001 observation only. No signing, preparation, sponsorship or submission.
export async function createDependencies(env) {
  Config.setTimeout(15000);
  const signers = Object.fromEntries(['owner', 'agent', 'merchant'].map(role =>
    [role, { publicKey: Keypair.fromSecret(env[`${role.toUpperCase()}_SECRET`]).publicKey() }]));
  if (new Set(Object.values(signers).map(signer => signer.publicKey)).size !== 3
    || !/^[a-f0-9]{64}$/.test(env.PROOF_DEVICE_HASH ?? '')) throw new ProofError('PROOF_CONFIG_INVALID');
  const noir = new NoirAgentClient({ network: 'testnet' });
  noir.server.httpClient.defaults.timeout = 15000;
  const asset = Asset.native().contractId(Networks.TESTNET);
  const gas = env.VELO_GAS_API_KEY ? new Velo({ apiKey: env.VELO_GAS_API_KEY,
    baseUrl: 'https://www.velo-build.dev', environment: 'testnet', timeoutMs: 15000, maxRetries: 0 }).gas : undefined;
  async function snapshot() {
    const [escrow, pending, response] = await Promise.all([
      noir.getEscrowBalance(env.PROOF_DEVICE_HASH), noir.getPendingBalance(signers.merchant.publicKey),
      fetch(`https://horizon-testnet.stellar.org/accounts/${signers.merchant.publicKey}`, { redirect: 'error', signal: AbortSignal.timeout(15000) }),
    ]);
    if (!response.ok) throw new ProofError('MERCHANT_BALANCE_UNAVAILABLE');
    const native = (await response.json()).balances.find(balance => balance.asset_type === 'native');
    if (!native || !/^\d+\.\d{7}$/.test(native.balance)) throw new ProofError('MERCHANT_BALANCE_UNAVAILABLE');
    return { observedAt: new Date().toISOString(), sdkVersions: SDK_VERSIONS, deviceHash: env.PROOF_DEVICE_HASH,
      owner: signers.owner.publicKey, agent: signers.agent.publicKey, merchant: signers.merchant.publicKey,
      escrowStroops: escrow.toString(), pendingStroops: pending.toString(),
      merchantWalletStroops: BigInt(native.balance.replace('.', '')).toString() };
  }
  async function checkout() {
    if (!env.VELO_API_KEY || !/^[a-z0-9]{20,64}$/.test(env.PROOF_CHECKOUT_ID ?? '')) throw new ProofError('PROOF_CONFIG_INVALID');
    const velo = new Velo({ apiKey: env.VELO_API_KEY, baseUrl: 'https://www.velo-build.dev', environment: 'testnet', timeoutMs: 15000, maxRetries: 0 });
    const result = await velo.paymentIntents.retrieve(env.PROOF_CHECKOUT_ID);
    if (result.paymentIntentId !== env.PROOF_CHECKOUT_ID || result.amount !== '0.10' || result.asset !== 'native'
      || !['awaiting_route', 'created', 'pending', 'paid', 'failed', 'expired', 'cancelled'].includes(result.status)) throw new ProofError('CHECKOUT_MISMATCH');
    return { paymentIntentId: result.paymentIntentId, status: result.status, amount: result.amount, asset: result.asset,
      relation: 'Separate Velo checkout; does not establish Noir authorization or claim' };
  }
  return { noir: { server: { getTransaction: hash => noir.server.getTransaction(hash) },
    checkPayment: input => noir.checkPayment(input) }, gas: gas && { getStatus: input => gas.getStatus(input) },
    signers, asset, snapshot, checkout, deviceHash: env.PROOF_DEVICE_HASH };
}
