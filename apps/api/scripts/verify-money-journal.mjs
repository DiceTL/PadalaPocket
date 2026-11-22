import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { coordinatorConfiguration as localConfiguration, assertLoopbackBindings, options, emails, command, project } from './local-verification.mjs';

// Storage/atomicity proof only: synthetic references and bytes, no signer or financial provider.
let step = 'local-configuration';
async function verify() {
  const { status, admin, password } = await localConfiguration();
  assertLoopbackBindings();
  const members = await admin.from('family_members').select('user_id,family_id,role');
  assert.equal(members.error, null);
  const parent = members.data.find(row => row.family_id === '00000000-0000-4000-8000-000000000001' && row.role === 'parent');
  const student = members.data.find(row => row.family_id === parent?.family_id && row.role === 'student');
  const other = members.data.find(row => row.family_id === '00000000-0000-4000-8000-000000000002' && row.role === 'parent');
  assert.ok(parent && student && other);
  const request = {
    p_family: parent.family_id, p_actor: parent.user_id, p_request_key: randomUUID(),
    p_purpose: 'verification', p_network: 'testnet', p_asset: 'native',
    p_source_ref: `verification:${randomUUID()}:source`, p_destination_ref: 'verification:destination',
    p_amount_stroops: '9007199254740993', p_payload: { rulesVersion: 'verification-v1', bucket: 'needs' },
  };
  const admit = changes => admin.rpc('admit_money_operation', { ...request, ...changes });
  const denied = async (result, message) => {
    const response = await result;
    assert.ok(response.error);
    if (message) assert.equal(response.error.message, message);
  };
  const rows = async (table, column, value) => {
    const result = await admin.from(table).select('*').eq(column, value);
    assert.equal(result.error, null);
    return result.data;
  };

  step = 'concurrent-identical-admission';
  const identical = await Promise.all(Array.from({ length: 16 }, () => admit()));
  for (const result of identical) assert.equal(result.error, null);
  const operation = identical[0].data;
  for (const result of identical) assert.deepEqual(result.data, operation);
  assert.equal(operation.amountStroops, request.p_amount_stroops);
  assert.equal(operation.reservation.operationId, operation.id);
  assert.equal(operation.reservation.state, 'held');
  assert.match(operation.requestFingerprint, /^[a-f0-9]{64}$/);
  assert.equal((await rows('money_operations', 'request_key', request.p_request_key)).length, 1);
  assert.equal((await rows('money_reservations', 'operation_id', operation.id)).length, 1);

  step = 'immutable-request-binding';
  const ordered = await admit({ p_payload: { bucket: 'needs', rulesVersion: 'verification-v1' } });
  assert.equal(ordered.error, null);
  assert.deepEqual(ordered.data, operation);
  for (const change of [
    { p_actor: student.user_id }, { p_purpose: 'different-purpose' },
    { p_source_ref: 'verification:different-source' }, { p_destination_ref: 'verification:different-destination' },
    { p_amount_stroops: '9007199254740994' }, { p_payload: { rulesVersion: 'changed', bucket: 'needs' } },
  ]) await denied(admit(change), 'IDEMPOTENCY_CONFLICT');
  await denied(admit({ p_network: 'mainnet' }), 'INVALID_INPUT');
  await denied(admit({ p_asset: 'other-asset' }), 'INVALID_INPUT');
  await denied(admit({ p_family: other.family_id }), 'FORBIDDEN');
  const familyReplay = await admit({ p_family: other.family_id, p_actor: other.user_id });
  assert.equal(familyReplay.error, null);
  assert.notEqual(familyReplay.data.id, operation.id);

  step = 'concurrent-conflicting-admission';
  const conflictKey = randomUUID();
  const conflicting = await Promise.all(Array.from({ length: 16 }, (_, index) => admit({
    p_request_key: conflictKey, p_amount_stroops: index % 2 ? '2' : '1',
  })));
  const accepted = conflicting.filter(result => !result.error);
  const rejected = conflicting.filter(result => result.error);
  assert.equal(accepted.length, 8);
  assert.equal(rejected.length, 8);
  for (const result of rejected) assert.equal(result.error.message, 'IDEMPOTENCY_CONFLICT');
  for (const result of accepted) assert.deepEqual(result.data, accepted[0].data);
  assert.equal((await rows('money_operations', 'request_key', conflictKey)).length, 1);
  assert.equal((await rows('money_reservations', 'operation_id', accepted[0].data.id)).length, 1);

  step = 'integer-and-payload-validation';
  for (const amount of ['0', '-1', '1.5', '01', '1e3', '9223372036854775808', null]) {
    const key = randomUUID();
    await denied(admit({ p_request_key: key, p_amount_stroops: amount }), 'INVALID_INPUT');
    assert.equal((await rows('money_operations', 'request_key', key)).length, 0);
  }
  for (const payload of [null, [], 'not-an-object']) await denied(admit({ p_payload: payload }), 'INVALID_INPUT');
  const maximum = await admit({ p_request_key: randomUUID(), p_amount_stroops: '9223372036854775807' });
  assert.equal(maximum.error, null);
  assert.equal(maximum.data.amountStroops, '9223372036854775807');

  step = 'concurrent-saved-step-binding';
  const signed = {
    p_operation: operation.id, p_family: parent.family_id, p_step_key: 'verification-step',
    p_source_account: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    p_transaction_hash: createHash('sha256').update(randomUUID()).digest('hex'),
    p_signed_envelope: Buffer.from('T05 synthetic storage fixture; not a transaction').toString('base64'),
  };
  const saveStep = changes => admin.rpc('record_money_signed_step', { ...signed, ...changes });
  const saved = await Promise.all(Array.from({ length: 8 }, () => saveStep()));
  for (const result of saved) {
    assert.equal(result.error, null);
    assert.deepEqual(result.data, saved[0].data);
    assert.equal(result.data.signedEnvelope, signed.p_signed_envelope);
    assert.equal(result.data.network, 'testnet');
  }
  assert.equal((await rows('money_signed_steps', 'operation_id', operation.id)).length, 1);
  for (const change of [
    { p_source_account: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' },
    { p_transaction_hash: '1'.repeat(64) }, { p_signed_envelope: Buffer.from('different fixture').toString('base64') },
  ]) await denied(saveStep(change), 'IDEMPOTENCY_CONFLICT');
  await denied(saveStep({ p_family: other.family_id }), 'FORBIDDEN');
  await denied(saveStep({ p_operation: familyReplay.data.id, p_family: other.family_id }), 'TRANSACTION_REUSED');
  await denied(saveStep({ p_step_key: 'different-step' }), 'TRANSACTION_REUSED');
  await denied(saveStep({ p_signed_envelope: 'not base64!' }), 'INVALID_INPUT');
  const stepRace = await Promise.all(Array.from({ length: 8 }, (_, index) => saveStep({
    p_step_key: 'race-step',
    p_transaction_hash: createHash('sha256').update(`${request.p_request_key}:race:${index % 2}`).digest('hex'),
  })));
  assert.equal(stepRace.filter(result => !result.error).length, 4);
  assert.equal(stepRace.filter(result => result.error?.message === 'IDEMPOTENCY_CONFLICT').length, 4);

  step = 'service-helper-contract';
  const { admitMoneyOperation, recordMoneySignedStep } = await import('../src/money-journal.mjs');
  const input = {
    member: parent, requestKey: request.p_request_key, purpose: request.p_purpose,
    network: request.p_network, asset: request.p_asset, sourceRef: request.p_source_ref,
    destinationRef: request.p_destination_ref, amountStroops: request.p_amount_stroops, payload: request.p_payload,
  };
  assert.deepEqual(await admitMoneyOperation(admin, input), operation);
  await assert.rejects(admitMoneyOperation(admin, { ...input, amountStroops: 9007199254740992 }), { code: 'INVALID_INPUT' });
  await assert.rejects(admitMoneyOperation(admin, { ...input, amountStroops: '2' }), { code: 'IDEMPOTENCY_CONFLICT' });
  assert.deepEqual(await recordMoneySignedStep(admin, {
    familyId: parent.family_id, operationId: operation.id, stepKey: signed.p_step_key,
    sourceAccount: signed.p_source_account, transactionHash: signed.p_transaction_hash, signedEnvelope: signed.p_signed_envelope,
  }), saved[0].data);

  step = 'browser-and-direct-write-denial';
  const anonymous = createClient(status.API_URL, status.ANON_KEY, options);
  const browser = createClient(status.API_URL, status.ANON_KEY, options);
  assert.equal((await browser.auth.signInWithPassword({ email: emails[0], password: password(emails[0]) })).error, null);
  for (const client of [anonymous, browser]) {
    for (const table of ['money_operations', 'money_reservations', 'money_signed_steps']) {
      assert.ok((await client.from(table).select('*').limit(1)).error);
    }
    assert.ok((await client.rpc('admit_money_operation', request)).error);
    assert.ok((await client.rpc('record_money_signed_step', signed)).error);
  }
  assert.ok((await admin.from('money_operations').update({ purpose: 'changed' }).eq('id', operation.id)).error);
  assert.ok((await admin.from('money_reservations').insert({ operation_id: operation.id })).error);
  assert.ok((await admin.from('money_signed_steps').update({ transaction_hash: '2'.repeat(64) }).eq('operation_id', operation.id)).error);

  step = 'atomic-failure-and-owner-immutability';
  const failureKey = randomUUID();
  // Temporary trigger and all attempted mutations roll back; never delete existing data.
  const sql = `begin;
    create function pg_temp.reject_verification_hold() returns trigger language plpgsql as $$
    begin raise exception 'VERIFICATION_RESERVATION_FAILURE'; end $$;
    create trigger reject_verification_hold before insert on public.money_reservations
      for each row execute function pg_temp.reject_verification_hold();
    do $$ begin
      begin
        perform public.admit_money_operation('${parent.family_id}','${parent.user_id}','${failureKey}',
          'verification','testnet','native','verification:source','verification:destination','1','{}');
        raise exception 'EXPECTED_RESERVATION_FAILURE';
      exception when raise_exception then
        if sqlerrm <> 'VERIFICATION_RESERVATION_FAILURE' then raise; end if;
      end;
      if exists(select 1 from public.money_operations where request_key='${failureKey}') then
        raise exception 'ORPHAN_OPERATION';
      end if;
      begin
        update public.money_operations set amount_stroops=1 where id='${operation.id}';
        raise exception 'EXPECTED_IMMUTABLE_OPERATION';
      exception when raise_exception then if sqlerrm <> 'JOURNAL_IMMUTABLE' then raise; end if; end;
      begin
        update public.money_reservations set state='released' where operation_id='${operation.id}';
        raise exception 'EXPECTED_IMMUTABLE_HOLD';
      exception when raise_exception then if sqlerrm <> 'JOURNAL_IMMUTABLE' then raise; end if; end;
      begin
        update public.money_signed_steps set signed_envelope='AAAA' where operation_id='${operation.id}';
        raise exception 'EXPECTED_IMMUTABLE_STEP';
      exception when raise_exception then if sqlerrm <> 'JOURNAL_IMMUTABLE' then raise; end if; end;
      if has_table_privilege('service_role','public.money_operations','DELETE')
        or has_table_privilege('service_role','public.money_reservations','DELETE')
        or has_table_privilege('service_role','public.money_signed_steps','DELETE') then
        raise exception 'DIRECT_DELETE_ALLOWED';
      end if;
    end $$;
    rollback;`;
  command('docker', ['exec', `supabase_db_${project}`, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', sql]);
  assert.equal((await rows('money_reservations', 'operation_id', operation.id)).length, 1);
  assert.equal((await rows('money_operations', 'request_key', failureKey)).length, 0);
}

try {
  await verify();
  console.log('PASS: money-journal');
} catch {
  console.error(`FAIL: money-journal (${step})`);
  process.exitCode = 1;
}
