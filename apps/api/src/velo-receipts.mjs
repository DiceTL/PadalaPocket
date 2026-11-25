import { Keypair } from '@stellar/stellar-sdk';

export const HORIZON_TESTNET = 'https://horizon-testnet.stellar.org';
const hashPattern = /^[a-f0-9]{64}$/i;
const xlmPattern = /^\d+(\.\d{1,7})?$/;
const fail = (code, status = 503) => Object.assign(Error(code), { code, status });

export function xlmToStroops(value) {
  if (typeof value !== 'string' || !xlmPattern.test(value)) throw fail('INVALID_AMOUNT');
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 10000000n + BigInt(fraction.padEnd(7, '0'));
}

export function operatorPayer(value = process.env.OPERATOR_PAYER_PUBLIC_KEY) {
  if (typeof value !== 'string' || !value) throw fail('OPERATOR_PAYER_UNAVAILABLE');
  try {
    return Keypair.fromPublicKey(value).publicKey();
  } catch {
    throw fail('OPERATOR_PAYER_UNAVAILABLE');
  }
}

async function horizonJson(response) {
  if (!response?.ok) throw fail('HORIZON_UNAVAILABLE');
  try {
    return await response.json();
  } catch {
    throw fail('INVALID_HORIZON_RESPONSE');
  }
}

// The operator wallet is dedicated to this flow. Bound the read to its recent
// payments; the intent timestamp and exact amount still decide the match.
export async function findStellarPayment({
  payer,
  receiver,
  amountStroops,
  createdAt,
  expiresAt,
  horizon = fetch,
  isCandidateClaimable,
}) {
  const from = Date.parse(createdAt);
  const until = Date.parse(expiresAt);
  if (!Number.isFinite(from) || !Number.isFinite(until) || until < from) throw fail('INVALID_VELO_RESPONSE');
  const body = await horizonJson(await horizon(
    `${HORIZON_TESTNET}/accounts/${encodeURIComponent(payer)}/payments?order=desc&limit=200`,
    { redirect: 'error', signal: AbortSignal.timeout(15000) },
  ));
  const records = body?._embedded?.records;
  if (!Array.isArray(records)) throw fail('INVALID_HORIZON_RESPONSE');
  const matches = records.filter(record => {
    const at = Date.parse(record?.created_at);
    let amount;
    try { amount = xlmToStroops(record?.amount); } catch { return false; }
    return record?.type === 'payment'
      && record?.asset_type === 'native'
      && record?.from === payer
      && record?.to === receiver
      && record?.transaction_successful === true
      && hashPattern.test(record?.transaction_hash ?? '')
      && Number.isFinite(at) && at >= from && at <= until
      && amount === amountStroops;
  });
  // A candidate belongs to this deposit only when no other deposit can claim it:
  // its hash is not bound elsewhere and its payment time is not inside another
  // unbound explicit deposit's intent window. A failed lookup propagates and
  // fails closed as `unavailable` in the caller.
  let candidates = matches;
  if (typeof isCandidateClaimable === 'function') {
    const claimable = await Promise.all(matches.map(match => isCandidateClaimable({
      txHash: match.transaction_hash,
      createdAt: match.created_at,
      amountStroops: String(amountStroops),
    })));
    candidates = matches.filter((match, index) => claimable[index]);
  }
  if (candidates.length === 0) return { status: 'unavailable' };
  if (candidates.length > 1) return { status: 'mismatch' };

  const [match] = candidates;
  const transaction = await horizonJson(await horizon(
    `${HORIZON_TESTNET}/transactions/${match.transaction_hash}`,
    { redirect: 'error', signal: AbortSignal.timeout(15000) },
  ));
  if (transaction?.successful !== true
      || String(transaction?.hash).toLowerCase() !== match.transaction_hash.toLowerCase()
      || !Number.isSafeInteger(transaction?.ledger) || transaction.ledger <= 0) {
    return { status: 'mismatch' };
  }
  return {
    status: 'verified',
    txHash: match.transaction_hash.toLowerCase(),
    payerAddress: payer,
    ledger: transaction.ledger,
    verifiedAt: new Date().toISOString(),
  };
}

export async function verifyVeloReceipt(row, intent, { payer, horizon = fetch, isCandidateClaimable } = {}) {
  if (intent?.status !== 'paid' || row?.amount_minor == null) return { status: 'unverified' };
  let operator;
  try {
    operator = payer ?? operatorPayer();
  } catch {
    return { status: 'unavailable' };
  }
  if (operator === row.expected_receiver) return { status: 'mismatch' };
  if (intent.payerAddress && intent.payerAddress !== operator) return { status: 'mismatch' };
  try {
    return await findStellarPayment({
      payer: operator,
      receiver: row.expected_receiver,
      amountStroops: BigInt(row.amount_stroops),
      createdAt: intent.createdAt,
      expiresAt: intent.expiresAt,
      horizon,
      isCandidateClaimable,
    });
  } catch {
    return { status: 'unavailable' };
  }
}
