import { createHash } from 'node:crypto';
import { admitMoneyOperation } from './money-journal.mjs';
import { guardedDispatcher } from './money-guarded-dispatch.mjs';
import { reconcileMoneyStep } from './money-recovery.mjs';

const fail = code => Object.assign(Error(code), { code, status: 503 });
function requestIdentity(kind, id) {
  const bytes = createHash('sha256').update(`T08:${kind}:${id}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 80; bytes[8] = (bytes[8] & 63) | 128;
  return bytes.toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}

// Construct only in the isolated server; the public API gets neither this object nor its credentials.
export function createMoneyWriters({ database, guard, readAccount, activatedAt, server, now = Date.now }) {
  const epoch = Date.parse(activatedAt);
  if (!Number.isFinite(epoch) || epoch > Date.now()) throw fail('COORDINATOR_NOT_CONFIGURED');
  const dispatch = guardedDispatcher({ database, guard, readAccount, server, now });
  const managed = row => row?.coordinator_version === 8 && Number.isFinite(Date.parse(row.created_at)) && Date.parse(row.created_at) >= epoch;
  function identity(kind, row, stage) {
    if (!['funding', 'purchase', 'weekly'].includes(kind) || !row?.id || !row.family_id
      || typeof stage !== 'string') throw fail('INVALID_INPUT');
    if (!managed(row)) throw fail('UNCOORDINATED_STEP');
    const stepKey = stage.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    if (!/^[a-z][a-z0-9_-]{0,63}$/.test(stepKey)) throw fail('INVALID_INPUT');
    return { familyId: row.family_id, requestKey: requestIdentity(kind, row.id), stepKey };
  }
  return {
    managed,
    async dispatch({ kind, row, stage, sourceAccount, prepare }) {
      const input = identity(kind, row, stage);
      const actor = kind === 'purchase' ? row.student_id : row.parent_id;
      const amount = kind === 'weekly' ? BigInt(row.needs_stroops) + BigInt(row.wants_stroops)
        : BigInt(kind === 'funding' ? row.total_stroops ?? row.amount_stroops : row.amount_stroops);
      const purpose = amount === 0n && kind === 'weekly' ? 'device_setup' : kind;
      const operation = await admitMoneyOperation(database, {
        member: { family_id: row.family_id, user_id: actor }, requestKey: input.requestKey,
        purpose, network: 'testnet', asset: 'native', sourceRef: `family:${row.family_id}`,
        destinationRef: `legacy:${kind}:${row.id}`, amountStroops: amount.toString(),
        payload: { kind, legacyId: row.id, requestKey: row.request_key ?? row.id, bucket: row.bucket ?? null,
          fingerprint: row.fingerprint ?? null, rulesRevision: row.rules_revision ?? null,
          needsStroops: String(row.needs_stroops ?? row.amount_stroops ?? '0'), wantsStroops: String(row.wants_stroops ?? '0') },
      });
      const state = await dispatch({ operationId: operation.id, familyId: input.familyId, stepKey: input.stepKey, sourceAccount }, {
        prepare: async () => (await prepare()).signed,
      });
      // Never copy the co-signed envelope into legacy tables or public/API projections.
      return { phase: state.phase, transactionHash: state.transactionHash ?? null, confirmedLedger: state.confirmedLedger ?? null };
    },
    async observe({ kind, row, stage }) {
      let input;
      try { input = identity(kind, row, stage); } catch (error) {
        if (error.code === 'UNCOORDINATED_STEP') return { outcome: 'fenced', reason: error.code };
        throw error;
      }
      const result = await database.from('money_operations').select('id').eq('family_id', input.familyId).eq('request_key', input.requestKey).maybeSingle();
      if (result.error) throw fail('PROVIDER_UNAVAILABLE');
      if (!result.data) return { outcome: 'fenced', reason: 'NO_DISPATCH_RECORD' };
      return reconcileMoneyStep(database, { operationId: result.data.id, familyId: input.familyId, stepKey: input.stepKey }, { server });
    },
  };
}
