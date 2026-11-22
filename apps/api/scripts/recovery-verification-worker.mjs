import { rpc } from '@stellar/stellar-sdk';
import { coordinatorConfiguration as localConfiguration } from './local-verification.mjs';

process.once('message', async job => {
  try {
    const { admin } = await localConfiguration();
    const { reconcileMoneyStep } = await import('../src/money-recovery.mjs');
    if (job.loseCheckpointResponse) {
      const call = admin.rpc.bind(admin);
      admin.rpc = async (name, args) => {
        const result = await call(name, args);
        if (name === 'confirm_money_dispatch' && !result.error) throw Error('SIMULATED_RESPONSE_LOSS');
        return result;
      };
    }
    const value = await reconcileMoneyStep(admin, job.input, {
      server: new rpc.Server(`${job.fixture}/rpc`, { allowHttp: true, timeout: 1000 }),
    });
    process.send({ event: 'result', value });
  } catch (error) {
    process.send({ event: 'error', code: ['FORBIDDEN', 'INVALID_INPUT', 'PROVIDER_UNAVAILABLE'].includes(error.code) ? error.code : 'WORKER_FAILED' });
  } finally {
    process.disconnect();
  }
});
