import { Keypair } from '@stellar/stellar-sdk';
import { createHash } from 'node:crypto';

export const APPROVAL_WINDOW_MS = 10 * 60 * 1000;
export const REVIEW_REASONS = new Set(['CAP_EXCEEDED', 'CATEGORY_DISALLOWED']);

// Consent belongs to this immutable request and rule snapshot, never just an amount.
export function approvalBinding(row) {
  const fields = ['id', 'family_id', 'student_id', 'fingerprint', 'seller_id', 'price_minor', 'amount_stroops', 'photo_hash', 'created_at'];
  if (fields.some(key => row[key] === undefined || row[key] === null) || !row.rules || !row.ai) throw Error('INVALID_APPROVAL_REQUEST');
  return createHash('sha256').update(JSON.stringify([
    'PadalaPocket:purchase-approval:v1', ...fields.map(key => String(row[key])), row.rules, row.ai, ...(row.bucket === 'wants' ? [row.bucket] : []),
  ])).digest('hex');
}

export function approvalDeadline(createdAt) {
  const time = Date.parse(createdAt);
  if (!Number.isFinite(time)) throw Error('INVALID_APPROVAL_REQUEST');
  return new Date(time + APPROVAL_WINDOW_MS).toISOString();
}

export function validateApprovalDecision(row, member, decision, expectedBinding, now = Date.now()) {
  if (member.role !== 'parent' || member.family_id !== row.family_id) throw Error('FORBIDDEN');
  if (!['approve', 'reject'].includes(decision)) throw Error('INVALID_INPUT');
  if (row.status !== 'awaiting_parent') throw Error('DECISION_ALREADY_CLOSED');
  if (Date.parse(approvalDeadline(row.created_at)) <= now) throw Error('APPROVAL_EXPIRED');
  if (expectedBinding !== approvalBinding(row)) throw Error('PURCHASE_CHANGED');
  return { decision, parentId: member.user_id, binding: expectedBinding, decidedAt: new Date(now).toISOString() };
}

export const EXCEPTION_STAGES = ['exception_device','exception_policy','needs_defund','exception_fund','exception_authorize','exception_claim','exception_revoke'];
export const exceptionDevice = row => createHash('sha256').update('PadalaPocket approval '+row.id).digest('hex');
function consentBytes(row, owner, merchant, asset) {
  if (row.parent_decision?.decision !== 'approve' || row.parent_decision.binding !== approvalBinding(row) || !row.reserved) throw Error('INVALID_CONSENT');
  return Buffer.from(JSON.stringify(['PadalaPocket:exception:v1', approvalBinding(row), row.parent_decision, owner, merchant, asset, exceptionDevice(row), String(row.nonce), String(row.amount_stroops)]));
}
export function signExceptionConsent(row, secret, merchant, asset) {
  const owner=Keypair.fromSecret(secret);
  return { owner:owner.publicKey(), merchant, asset, signature:owner.sign(consentBytes(row,owner.publicKey(),merchant,asset)).toString('base64') };
}
export function verifyExceptionConsent(row, owner, merchant, asset) {
  const consent=row.exception_consent;
  if (!consent || consent.owner!==owner || consent.merchant!==merchant || consent.asset!==asset || !Keypair.fromPublicKey(owner).verify(consentBytes(row,owner,merchant,asset),Buffer.from(consent.signature,'base64'))) throw Error('INVALID_CONSENT');
}
