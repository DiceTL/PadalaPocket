import { Asset, Config, Contract, Keypair, Networks, TransactionBuilder } from '@stellar/stellar-sdk';
import { NoirAgentClient, keypairSigner, toCall } from '@noirx402/agent-sdk';
import { Velo } from '@carts1024/velo-sdk';
import { ProofError, PROOF_AMOUNT, PROOF_CAP, PROOF_FUNDING } from './proof.mjs';

export const SDK_VERSIONS = { noir: '0.3.0', stellar: '16.0.1', velo: '0.1.0-alpha.4' };

export async function createDependencies(env) {
  Config.setTimeout(15_000); // Other Stellar clients; RPC is configured explicitly below.
  const transport = env.PROOF_TRANSPORT ?? 'gas';
  if (!['gas', 'direct'].includes(transport) || env.VELO_GAS_BASE_URL !== 'https://www.velo-build.dev'
      || (transport === 'gas' && !/^tg_test_[a-f0-9]{32}$/i.test(env.VELO_GAS_API_KEY ?? ''))
      || !/^[a-f0-9]{64}$/.test(env.PROOF_DEVICE_HASH ?? '') || !/^[a-f0-9]{32}$/.test(env.PROOF_OPERATION_ID ?? '')
      || !/^[1-9][0-9]{0,18}$/.test(env.PROOF_NONCE ?? '')) throw new ProofError('PROOF_CONFIG_INVALID');
  const signers = {
    owner: keypairSigner(env.OWNER_SECRET), agent: keypairSigner(env.AGENT_SECRET), merchant: keypairSigner(env.MERCHANT_SECRET),
  };
  if (new Set(Object.values(signers).map(signer => signer.publicKey)).size !== 3) throw new ProofError('PROOF_CONFIG_INVALID');
  const noir = new NoirAgentClient({ network: 'testnet' });
  // SDK 16's RPC fetch client does not inherit the global Config timeout.
  noir.server.httpClient.defaults.timeout = 15_000;
  const gas = env.VELO_GAS_API_KEY ? new Velo({ apiKey: env.VELO_GAS_API_KEY, baseUrl: env.VELO_GAS_BASE_URL, environment: 'testnet', timeoutMs: 25_000, maxRetries: 0 }).gas : undefined;
  const asset = Asset.native().contractId(Networks.TESTNET);
  async function snapshot() {
    const [escrow, pending, walletResponse] = await Promise.all([
      noir.getEscrowBalance(env.PROOF_DEVICE_HASH), noir.getPendingBalance(signers.merchant.publicKey),
      fetch(`https://horizon-testnet.stellar.org/accounts/${signers.merchant.publicKey}`, { signal: AbortSignal.timeout(15_000) }),
    ]);
    if (!walletResponse.ok) throw new ProofError('MERCHANT_BALANCE_UNAVAILABLE');
    const account = await walletResponse.json();
    const native = account.balances.find(balance => balance.asset_type === 'native');
    if (!native || !/^\d+\.\d{7}$/.test(native.balance)) throw new ProofError('MERCHANT_BALANCE_UNAVAILABLE');
    const [whole, fraction] = native.balance.split('.');
    return {
      observedAt: new Date().toISOString(), sdkVersions: SDK_VERSIONS,
      deviceHash: env.PROOF_DEVICE_HASH, owner: signers.owner.publicKey, agent: signers.agent.publicKey, merchant: signers.merchant.publicKey,
      escrowStroops: escrow.toString(), pendingStroops: pending.toString(), merchantWalletStroops: (BigInt(whole) * 10_000_000n + BigInt(fraction)).toString(),
    };
  }
  async function signAndHash(signer, unsignedXdr) {
    const signedXdr = await signer.signTransaction(unsignedXdr, { networkPassphrase: Networks.TESTNET });
    const hash = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET).hash().toString('hex');
    return { signedXdr, hash };
  }
  function operation(kind) {
    const deviceHash = env.PROOF_DEVICE_HASH;
    switch (kind) {
      case 'registerDevice': return { signer: signers.owner, op: { kind, deviceHash, agent: signers.agent.publicKey } };
      case 'registerAgent': {
        const expiry = new Date(env.PROOF_EXPIRES_AT);
        if (!Number.isFinite(expiry.getTime())) throw new ProofError('PROOF_CONFIG_INVALID');
        return { signer: signers.owner, op: { kind, deviceHash, agent: signers.agent.publicKey, asset, maxAmount: PROOF_CAP, expiresAt: expiry } };
      }
      case 'fundEscrow': return { signer: signers.owner, op: { kind, deviceHash, token: asset, amount: PROOF_FUNDING } };
      case 'authorize': return { signer: signers.agent, op: { kind, deviceHash, merchant: signers.merchant.publicKey, asset, amount: PROOF_AMOUNT, nonce: BigInt(env.PROOF_NONCE) } };
      case 'claim': return { signer: signers.merchant, op: { kind, token: asset } };
      default: throw new ProofError('INVALID_INPUT', 400);
    }
  }
  function envelope(kind, suppliedXdr) {
    if (transport === 'gas' && (env.PROOF_ENVELOPE_KIND !== kind || !env.PROOF_ENVELOPE_XDR)) throw new ProofError('ENVELOPE_NOT_PREPARED', 409);
    const signedXdr = transport === 'direct' ? suppliedXdr : env.PROOF_ENVELOPE_XDR;
    if (!signedXdr) throw new ProofError('ENVELOPE_NOT_PREPARED', 409);
    const tx = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET);
    const { signer, op } = operation(kind);
    const call = toCall(signer.publicKey, op);
    const expected = new Contract(noir.contracts[call.contract]).call(call.method, ...call.args);
    // Verify every contract argument, source and fixed bounds against the packet;
    // malformed/misconfigured envelopes cannot expand the operator's authority.
    const operationXdr = tx.toEnvelope().v1().tx().operations();
    if (tx.source !== signer.publicKey || operationXdr.length !== 1 || operationXdr[0].sourceAccount() != null
      || BigInt(tx.fee) > 300_000_000n
      || !tx.signatures.some(signature => Keypair.fromPublicKey(signer.publicKey).verify(tx.hash(), signature.signature()))
      || operationXdr[0].body().invokeHostFunctionOp().hostFunction().toXDR('base64') !== expected.body().invokeHostFunctionOp().hostFunction().toXDR('base64')) {
      throw new ProofError('ENVELOPE_MISMATCH', 409);
    }
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (!tx.timeBounds || BigInt(tx.timeBounds.maxTime) === 0n || BigInt(tx.timeBounds.maxTime) > now + 600n
      || BigInt(tx.timeBounds.minTime) > now || BigInt(tx.timeBounds.minTime) >= BigInt(tx.timeBounds.maxTime)) throw new ProofError('ENVELOPE_MISMATCH', 409);
    const expired = BigInt(tx.timeBounds.maxTime) <= now;
    if (expired && transport === 'gas') throw new ProofError('ENVELOPE_EXPIRED', 409);
    return { signedXdr, hash: tx.hash().toString('hex'), expired };
  }
  async function checkout() {
    if (!env.VELO_API_KEY || !/^[a-z0-9]{20,64}$/.test(env.PROOF_CHECKOUT_ID ?? '')) throw new ProofError('PROOF_CONFIG_INVALID');
    const checkoutVelo = new Velo({ apiKey: env.VELO_API_KEY, baseUrl: 'https://www.velo-build.dev', environment: 'testnet', timeoutMs: 15_000, maxRetries: 0 });
    const result = await checkoutVelo.paymentIntents.retrieve(env.PROOF_CHECKOUT_ID);
    if (result.paymentIntentId !== env.PROOF_CHECKOUT_ID || result.amount !== '0.10' || result.asset !== 'native'
      || !['awaiting_route', 'created', 'pending', 'paid', 'failed', 'expired', 'cancelled'].includes(result.status)) throw new ProofError('CHECKOUT_MISMATCH');
    return { paymentIntentId: result.paymentIntentId, status: result.status, amount: result.amount, asset: result.asset,
      relation: 'Separate Velo checkout; does not establish Noir authorization or claim' };
  }
  return { noir, gas, signers, asset, snapshot, signAndHash, operation, envelope, checkout, transport,
    deviceHash: env.PROOF_DEVICE_HASH, nonce: BigInt(env.PROOF_NONCE), operationId: env.PROOF_OPERATION_ID };
}
