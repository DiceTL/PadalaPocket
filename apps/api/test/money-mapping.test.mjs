import { test } from 'node:test';
import assert from 'node:assert/strict';
import { phpToStroops, stroopsToPhp, splitAllowance } from '../src/money-mapping.mjs';
test('snapshot conversion uses integer half-up rounding and preserves bucket totals', () => {
  assert.equal(stroopsToPhp(phpToStroops('999999999999999999')), '999999999999999999');
  assert.equal(phpToStroops('968'), '10000000');
  assert.equal(phpToStroops('10000'), '103305785');
  assert.equal(phpToStroops('121'), '1250000');
  assert.equal(stroopsToPhp('625000'), '61'); // exactly 60.5 centavos
  assert.equal(stroopsToPhp('624999'), '60');
  for (let i=0;i<1000;i++) {
    const minor = i.toString(), stroops = phpToStroops(minor);
    assert.equal(stroopsToPhp(stroops), minor);
    for (const ratio of [0,1,60,99,100]) {
      const split=splitAllowance(stroops,ratio);
      assert.equal(BigInt(split.needs)+BigInt(split.wants),BigInt(stroops));
    }
  }
  for (const bad of ['-1','1.5','01','1e3',1, null,'9'.repeat(19)]) assert.throws(()=>phpToStroops(bad));
  assert.throws(()=>splitAllowance('1',60.5));
});

test('backing CLI initializes once with private state and no leaked signer', async () => {
  const { mkdtemp, writeFile, readFile, stat } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join, resolve } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const { Keypair } = await import('@stellar/stellar-sdk');
  const cwd=await mkdtemp(join(tmpdir(),'b003-'));
  await writeFile(join(cwd,'.env.local'),'',{mode:0o600});
  const env={...process.env,OWNER_SECRET:Keypair.random().secret(),AGENT_SECRET:Keypair.random().secret(),MERCHANT_SECRET:Keypair.random().secret()};
  const run=()=>spawnSync(process.execPath,[resolve(import.meta.dirname,'../scripts/wallet-backing.mjs'),'init'],{cwd,env,encoding:'utf8'});
  const first=run(); assert.equal(first.status,0,first.stdout);
  const path=join(cwd,'.env.b003-state.json'), before=await readFile(path,'utf8');
  assert.equal((await stat(path)).mode & 0o077,0);
  assert.equal(run().status,1); assert.equal(await readFile(path,'utf8'),before);
  for (const secret of [env.OWNER_SECRET,env.AGENT_SECRET,env.MERCHANT_SECRET,JSON.parse(before).studentSecret]) assert.ok(!first.stdout.includes(secret));
  const interrupted=JSON.parse(before); interrupted.steps.friendbot={phase:'dispatched'};
  await writeFile(path,JSON.stringify(interrupted),{mode:0o600});
  const recovery=spawnSync(process.execPath,[resolve(import.meta.dirname,'../scripts/wallet-backing.mjs'),'run'],{cwd,env,encoding:'utf8'});
  assert.equal(recovery.status,1); // Unknown funding cannot trigger another Friendbot request.
  assert.deepEqual(JSON.parse(await readFile(path,'utf8')),interrupted);
});
