import test from 'node:test';
import assert from 'node:assert/strict';
import { approvalBinding, approvalDeadline, validateApprovalDecision } from '../src/purchase-approval.mjs';
const now = Date.parse('2026-11-07T00:00:00Z');
const makeRow = () => ({ id:'request', family_id:'family', student_id:'student', fingerprint:'fingerprint', seller_id:'demo-seller', price_minor:'500', amount_stroops:'5165289', photo_hash:'photo', created_at:new Date(now).toISOString(), rules:{ capMinor:'484' }, ai:{ productName:'Notebook', category:'school_supplies' }, status:'awaiting_parent' });
const parent = { role:'parent', family_id:'family', user_id:'parent' };
test('approval expires at exactly ten real minutes', () => {
  const row=makeRow(), binding=approvalBinding(row);
  assert.equal(approvalDeadline(row.created_at), '2026-11-07T00:10:00.000Z');
  assert.equal(validateApprovalDecision(row,parent,'approve',binding,now+599999).decision,'approve');
  assert.throws(()=>validateApprovalDecision(row,parent,'approve',binding,now+600000),/APPROVAL_EXPIRED/);
});
test('approval cannot cross a family, role, or completed decision', () => {
  const row=makeRow(), binding=approvalBinding(row);
  for(const member of [{...parent,role:'student'},{...parent,family_id:'other'}]) assert.throws(()=>validateApprovalDecision(row,member,'approve',binding,now),/FORBIDDEN/);
  assert.throws(()=>validateApprovalDecision({...row,status:'approved'},parent,'approve',binding,now),/DECISION_ALREADY_CLOSED/);
});
test('consent is invalidated by changes to any financial, photo, identity, rules, or AI fields', () => {
  const row=makeRow(), binding=approvalBinding(row);
  for(const key of ['id','student_id','fingerprint','seller_id','price_minor','amount_stroops','photo_hash','created_at','rules','ai']) {
    const changed={...row,[key]:key==='rules'?{capMinor:'999'}:key==='ai'?{category:'toys_collectibles'}:key==='created_at'?new Date(now+1).toISOString():'changed'};
    assert.notEqual(approvalBinding(changed),binding,key);
    assert.throws(()=>validateApprovalDecision(changed,parent,'reject',binding,now),/PURCHASE_CHANGED/);
  }
});
test('owner consent signature cannot be reused for a changed purchase, merchant or amount',async()=>{
 const {Keypair}=await import('@stellar/stellar-sdk');const {signExceptionConsent,verifyExceptionConsent}=await import('../src/purchase-approval.mjs');
 const owner=Keypair.random(),merchant=Keypair.random().publicKey(),asset='native-testnet';
 const row={...makeRow(),nonce:1,reserved:true};row.parent_decision={decision:'approve',binding:approvalBinding(row),parentId:'parent',decidedAt:new Date(now).toISOString()};
 row.exception_consent=signExceptionConsent(row,owner.secret(),merchant,asset);
 assert.doesNotThrow(()=>verifyExceptionConsent(row,owner.publicKey(),merchant,asset));
 assert.throws(()=>verifyExceptionConsent({...row,amount_stroops:'1'},owner.publicKey(),merchant,asset),/INVALID_CONSENT/);
 assert.throws(()=>verifyExceptionConsent(row,owner.publicKey(),Keypair.random().publicKey(),asset),/INVALID_CONSENT/);
 assert.throws(()=>verifyExceptionConsent({...row,nonce:2},owner.publicKey(),merchant,asset),/INVALID_CONSENT/);
});
