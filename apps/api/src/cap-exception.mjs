// B-002 feasibility only. The owner approves one immutable request, not a higher routine cap.
import { Address, Keypair } from '@stellar/stellar-sdk';

const fields = ['id', 'owner', 'deviceHash', 'agent', 'merchant', 'asset', 'amountStroops', 'nonce', 'bucket', 'photoReference', 'expiresAt'];
export const EXCEPTION_AMOUNT = 11_000_000n;
export const ORDINARY_CAP = 10_000_000n;
export function approvalBytes(request) {
  if (!request || Object.keys(request).length !== fields.length || fields.some(key => typeof request[key] !== 'string')
    || !/^[a-f0-9]{64}$/.test(request.deviceHash) || !/^[a-f0-9]{32}$/.test(request.id)
    || request.amountStroops !== EXCEPTION_AMOUNT.toString() || !/^[1-9][0-9]{0,15}$/.test(request.nonce)
    || !['needs', 'wants'].includes(request.bucket) || request.photoReference !== 'synthetic:b002-photo-v1'
    || !Number.isFinite(Date.parse(request.expiresAt))) throw new Error('INVALID_EXCEPTION');
  for (const key of ['owner', 'agent', 'merchant']) Keypair.fromPublicKey(request[key]);
  if (!request.asset.startsWith('C')) throw new Error('INVALID_EXCEPTION');
  Address.fromString(request.asset);
  return Buffer.from(JSON.stringify(['PadalaPocket:B-002:v1', ...fields.map(key => request[key])]));
}
export function approvedOperation(request, signature, expectedOwner, now = Date.now()) {
  const bytes = approvalBytes(request);
  if (request.owner !== expectedOwner || Date.parse(request.expiresAt) <= now
    || !Keypair.fromPublicKey(expectedOwner).verify(bytes, Buffer.from(signature, 'base64'))) throw new Error('APPROVAL_REJECTED');
  return { kind: 'authorize', deviceHash: request.deviceHash, merchant: request.merchant, asset: request.asset,
    amount: BigInt(request.amountStroops), nonce: BigInt(request.nonce) };
}
