import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createProofHandler, runProof, validateAction, safeProviderError } from '../src/proof.mjs';

const token = 'a'.repeat(64);
const hash = 'b'.repeat(64);
async function request(handler, { authorization = `Bearer ${token}`, method = 'POST', body = { action: 'snapshot' } } = {}) {
  let text;
  const res = { statusCode: 0, setHeader() {}, end(value) { text = value; } };
  await handler({ headers: { authorization }, method, body }, res);
  return { status: res.statusCode, body: JSON.parse(text) };
}

test('absent/wrong tokens and malformed configured tokens never construct signers or call providers', async () => {
  for (const configured of [token, '', 'short']) {
    for (const authorization of [undefined, '', `Bearer ${'c'.repeat(64)}`, `Bearer ${token}\n`]) {
      let called = 0;
      const handler = createProofHandler({ env: { OPERATOR_TOKEN: configured, PROOF_ENABLED: 'true' },
        createDependencies() { called++; throw new Error('secret'); }, execute() { called++; } });
      const result = await request(handler, { authorization: authorization ?? null });
      assert.equal(result.status, 401);
      assert.equal(called, 0);
    }
  }
});

test('disabled route, wrong method, malformed body and amount/destination overrides cause no dependency calls', async () => {
  let calls = 0;
  const create = env => createProofHandler({ env, createDependencies() { calls++; } });
  assert.equal((await request(create({ OPERATOR_TOKEN: token }))).status, 404);
  const handler = create({ OPERATOR_TOKEN: token, PROOF_ENABLED: 'true' });
  assert.equal((await request(handler, { method: 'GET' })).status, 405);
  for (const body of ['{', 'x'.repeat(1025), null, [], { action: 'authorize', amount: '999' }, { action: 'claim', merchant: 'arbitrary' },
    { action: 'status', requestId: 'bad\n', transactionHash: hash }, { action: 'transaction', transactionHash: 'wrong' }]) {
    assert.equal((await request(handler, { body })).status, 400);
  }
  assert.equal(calls, 0);
});

test('handler sanitizes arbitrary SDK messages', async () => {
  const handler = createProofHandler({ env: { OPERATOR_TOKEN: token, PROOF_ENABLED: 'true' },
    createDependencies() { throw new Error('SECRET_KEY SIGNED_XDR raw-response'); } });
  const result = await request(handler);
  assert.equal(result.status, 503);
  assert.equal(JSON.stringify(result).includes('SECRET_KEY'), false);
  assert.equal(safeProviderError({ code: 'sensitive_payload' }, 'submit').evidence.providerCode, undefined);
  assert.equal(safeProviderError({ code: 'dependency_unavailable' }, 'submit').evidence.providerCode, 'dependency_unavailable');
});

test('all retired proof mutations fail before dependency construction or provider access', async () => {
  let calls = 0;
  const handler = createProofHandler({ env: { OPERATOR_TOKEN: token, PROOF_ENABLED: 'true' },
    createDependencies() { calls++; throw Error('MUST_NOT_LOAD_SIGNERS'); } });
  for (const action of ['registerDevice', 'registerAgent', 'fundEscrow', 'authorize', 'claim']) {
    const result = await request(handler, { body: { action } });
    assert.equal(result.status, 410);
    assert.equal(result.body.error.code, 'LEGACY_WRITER_RETIRED');
    await assert.rejects(runProof({ action }, {}), { code: 'LEGACY_WRITER_RETIRED' });
  }
  assert.equal(calls, 0);
});

test('saved transaction and relayer identities remain observable without preparing a replacement', async () => {
  const observed = [];
  const deps = { noir: { server: { getTransaction: async value => { observed.push(value); return {status:'NOT_FOUND'}; } } },
    gas: { getStatus: async identity => ({...identity,status:'unknown'}) } };
  assert.deepEqual(await runProof({action:'transaction',transactionHash:hash},deps), {transactionHash:hash,ledgerStatus:'NOT_FOUND'});
  assert.deepEqual(observed,[hash]);
  const identity={requestId:'request-1',transactionHash:hash};
  assert.deepEqual((await runProof({action:'status',...identity},deps)).gas,{...identity,status:'unknown'});
  assert.throws(()=>validateAction({action:'status',requestId:'request-1',transactionHash:'wrong'}),/INVALID_INPUT/);
});

test('retired operator commands cannot fund, replace credentials or rewrite historical unknown journals', async () => {
  const directory=await mkdtemp(join(tmpdir(),'t08-retired-'));
  const saved='# isolated fixture; no credentials\n';
  const journal=JSON.stringify({phase:'unknown',steps:{}});
  const paths=['.env.b001-evidence.json','.env.b002-state.json','.env.b003-state.json','.env.b003-buckets.json','.env.b004-anchor.json'];
  try {
    await writeFile(join(directory,'.env.local'),saved,{mode:0o600});
    for(const path of paths)await writeFile(join(directory,path),journal,{mode:0o600});
    const cases=[
      ['proof.mjs',[['init'],['fund'],['prepare','authorize'],['call','claim']]],
      ['cap-exception.mjs',[['init'],['run']]],
      ['wallet-backing.mjs',[['init'],['run'],['init-buckets'],['run-buckets']]],
      ['anchor-proof.mjs',[['start'],['resume'],['retry-initiation'],['new-unpaid-session'],['recover']]],
      ['anchor-transfer.mjs',[[]]],
    ];
    for(const [file,commands] of cases)for(const args of commands){
      const script=fileURLToPath(new URL(`../scripts/${file}`,import.meta.url));
      const result=spawnSync(process.execPath,[script,...args],{cwd:directory,env:{PATH:process.env.PATH,NODE_ENV:'test'},encoding:'utf8',timeout:10000});
      assert.equal(result.status,1);
      assert.ok((result.stdout+result.stderr).includes('LEGACY_WRITER_RETIRED'),'retired command did not reject safely');
      assert.ok(await readFile(join(directory,'.env.local'),'utf8')===saved,'retired command rewrote configuration');
      for(const path of paths)assert.ok(await readFile(join(directory,path),'utf8')===journal,'retired command rewrote an unknown journal');
    }
  } finally {await rm(directory,{recursive:true,force:true});}
});
