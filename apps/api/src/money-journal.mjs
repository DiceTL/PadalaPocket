const fail = (status, code) => Object.assign(Error(code), { status, code });
const journalErrors = new Map([
  ['INVALID_INPUT', 400], ['FORBIDDEN', 403],
  ['IDEMPOTENCY_CONFLICT', 409], ['TRANSACTION_REUSED', 409],
]);
function resultValue({ data, error }) {
  if (!error) return data;
  if (journalErrors.has(error.message)) throw fail(journalErrors.get(error.message), error.message);
  // Do not propagate database details or saved financial payloads into future API errors.
  throw fail(503, 'PROVIDER_UNAVAILABLE');
}

export async function admitMoneyOperation(db, input) {
  if (typeof input?.amountStroops !== 'string' || !/^(0|[1-9][0-9]{0,18})$/.test(input.amountStroops)
    || (input.amountStroops === '0') !== (input.purpose === 'device_setup')
    || BigInt(input.amountStroops) > 9223372036854775807n) throw fail(400, 'INVALID_INPUT');
  return resultValue(await db.rpc('admit_money_operation', {
    p_family: input.member?.family_id, p_actor: input.member?.user_id, p_request_key: input.requestKey,
    p_purpose: input.purpose, p_network: input.network, p_asset: input.asset,
    p_source_ref: input.sourceRef, p_destination_ref: input.destinationRef,
    p_amount_stroops: input.amountStroops, p_payload: input.payload,
  }));
}

export async function recordMoneySignedStep(db, input) {
  return resultValue(await db.rpc('record_money_signed_step', {
    p_operation: input.operationId, p_family: input.familyId, p_step_key: input.stepKey,
    p_source_account: input.sourceAccount, p_transaction_hash: input.transactionHash,
    p_signed_envelope: input.signedEnvelope,
  }));
}
