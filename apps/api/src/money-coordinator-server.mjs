import { createClient } from '@supabase/supabase-js';
import { Keypair } from '@stellar/stellar-sdk';
import { assertCoordinatorAuthority } from './money-authority.mjs';
import { createMoneyWriters } from './money-writers.mjs';
import { createIsolatedFinancialHandler } from './money-coordinator-handler.mjs';
import { sendFinancialUnavailable } from './money-proxy.mjs';

// Separate deployment/environment. Never load the application's .env file here.
function createHandler() {
  const guard = Keypair.fromSecret(process.env.MONEY_COORDINATOR_GUARD_SECRET);
  const sources = ['OWNER', 'AGENT', 'MERCHANT', 'STUDENT'].map(role => Keypair.fromSecret(process.env[`${role}_SECRET`]).publicKey());
  if (new Set([...sources, guard.publicKey()]).size !== 5) throw Error();
  const token = process.env.MONEY_COORDINATOR_DATABASE_TOKEN;
  if (JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).role !== 'money_coordinator') throw Error();
  const database = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const readAccount = async source => {
    const response = await fetch(`https://horizon-testnet.stellar.org/accounts/${source}`, { redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw Error();
    return response.json();
  };
  const writers = createMoneyWriters({ database, guard, readAccount, activatedAt: process.env.MONEY_COORDINATOR_ACTIVATED_AT });
  const readiness = async () => {
    await Promise.all(sources.map(async sourceAccount => assertCoordinatorAuthority(await readAccount(sourceAccount), { sourceAccount, guardAccount: guard.publicKey() })));
    const access = await database.rpc('read_money_cutover_access');
    if (access.error || access.data.role !== 'money_coordinator' || !access.data.readsSigned) throw Error();
    return { network:'testnet', boundary:'t08', databaseRole:access.data.role, activatedAt:process.env.MONEY_COORDINATOR_ACTIVATED_AT, guardAccount:guard.publicKey(), sources };
  };
  let startup;
  const ensureReady = () => startup ??= readiness().catch(error => {
    startup = undefined;
    throw error;
  });
  return createIsolatedFinancialHandler({
    writers, database, readiness, ensureReady, token: process.env.MONEY_COORDINATOR_ACCESS_TOKEN,
  });
}

let handler;
export default async function coordinator(req, res) {
  try {
    handler ??= createHandler();
    await handler(req, res);
  } catch {
    if (res.headersSent) { res.destroy(); return; }
    sendFinancialUnavailable(res, new URL(req.url, 'http://localhost').pathname);
  }
}
