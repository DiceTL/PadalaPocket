import { Keypair, Networks, Transaction, TransactionBuilder, rpc } from '@stellar/stellar-sdk';
import { setTimeout as sleep } from 'node:timers/promises';
import { dispatchMoneyStep } from './money-dispatch.mjs';
import { assertCoordinatorAuthority } from './money-authority.mjs';

// Run only inside the isolated coordinator: neither its database token nor guard leaves it.
export function guardedDispatcher({ database, guard, readAccount, server, now = Date.now }) {
  server ??= new rpc.Server('https://soroban-testnet.stellar.org', { timeout: 15000 });
  // Wait only on the dispatch path; T07 reconciliation still performs one lookup.
  const transport = {
    sendTransaction: tx => server.sendTransaction(tx),
    async getTransaction(hash) {
      const deadline = Date.now() + 45000;
      let observed;
      do {
        observed = await server.getTransaction(hash);
        if (observed.status !== 'NOT_FOUND' || Date.now() >= deadline) return observed;
        await sleep(Math.min(1000, deadline - Date.now()));
      } while (Date.now() < deadline);
      return observed;
    },
  };
  return (input, { prepare }) => {
    let policyVerified = false;
    const verifyPolicy = async () => {
      assertCoordinatorAuthority(await readAccount(input.sourceAccount), { sourceAccount: input.sourceAccount, guardAccount: guard.publicKey() });
      policyVerified = true;
    };
    const invalid = () => Object.assign(Error('SIGNING_IDENTITY_MISMATCH'), { code: 'SIGNING_IDENTITY_MISMATCH', status: 409 });
    return dispatchMoneyStep(database, input, {
      server: transport, now,
      prepare: async () => {
        await verifyPolicy();
        const tx = TransactionBuilder.fromXDR(await prepare(), Networks.TESTNET);
        if (!(tx instanceof Transaction) || tx.source !== input.sourceAccount || tx.signatures.length !== 1
          || !Keypair.fromPublicKey(input.sourceAccount).verify(tx.hash(), tx.signatures[0].signature())) throw invalid();
        tx.sign(guard);
        return tx.toXDR();
      },
      beforeSend: async tx => {
        if (tx.signatures.length !== 2 || !tx.signatures.some(signature => guard.verify(tx.hash(), signature.signature()))) throw invalid();
        if (!policyVerified) await verifyPolicy();
      },
    });
  };
}
