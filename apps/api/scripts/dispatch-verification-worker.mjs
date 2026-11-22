import { rpc } from '@stellar/stellar-sdk';
import { coordinatorConfiguration as localConfiguration } from './local-verification.mjs';

// Child process used only by the local done-check; it never receives a signing key.
process.once('message', async job => {
  try {
    const { admin } = await localConfiguration();
    const { dispatchMoneyStep } = await import('../src/money-dispatch.mjs');
    const call = admin.rpc.bind(admin);
    admin.rpc = async (name, args) => {
      const result = await call(name, args);
      const pause = !result.error && (
        job.pause === 'claimed' && name === 'claim_money_dispatch' && result.data.canPrepare ||
        job.pause === 'saved' && name === 'save_money_dispatch' ||
        job.pause === 'send' && name === 'claim_money_dispatch_send' && result.data.canSend
      );
      if (pause) {
        process.send({ event: 'paused' });
        await new Promise(resolve => process.once('message', resolve));
      }
      return result;
    };
    const result = await dispatchMoneyStep(admin, job.input, {
      now: job.realClock ? Date.now : () => 0,
      server: new rpc.Server(`${job.fixture}/rpc`, { allowHttp: true, timeout: 1500 }),
      prepare: async () => {
        const response = await fetch(`${job.fixture}/prepare`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...job.input, mode: job.mode }),
          signal: AbortSignal.timeout(3000),
        });
        if (!response.ok) throw Error('OFFLINE_PREPARATION_FAILED');
        return (await response.json()).signedEnvelope;
      },
    });
    process.send({ event: 'result', value: { phase: result.phase, transactionHash: result.transactionHash, confirmedLedger: result.confirmedLedger } });
  } catch (error) {
    const known = ['INVALID_SIGNED_TRANSACTION', 'FORBIDDEN', 'DISPATCH_IDENTITY_CONFLICT', 'UNCOORDINATED_STEP', 'PROVIDER_UNAVAILABLE'];
    process.send({ event: 'error', code: known.includes(error.code) ? error.code : 'WORKER_FAILED' });
  } finally {
    process.disconnect();
  }
});
