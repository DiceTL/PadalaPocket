// Run from repo root with node --env-file=.env.local; never log SDK errors.
import { readFile, writeFile, stat, chmod } from 'node:fs/promises';
import { randomBytes, createHash } from 'node:crypto';
import { Keypair, Networks, TransactionBuilder } from '@stellar/stellar-sdk';
import { createDependencies } from '../src/proof-sdk.mjs';
import { safeProviderError, PROOF_AMOUNT, PROOF_OPERATIONS, rejectedRefreshHashes, validateDirectTransition } from '../src/proof.mjs';

const envPath = '.env.local';
const evidencePath = '.env.b001-evidence.json'; // ignored, sanitized recovery journal
const [command, action, argument] = process.argv.slice(2);
let evidence = [];
try { evidence = JSON.parse(await readFile(evidencePath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
async function record(value) {
  evidence.push({ observedAt: new Date().toISOString(), ...value });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify(value));
}
async function updateEnvironment(values) {
  let text = await readFile(envPath, 'utf8');
  for (const [key, value] of Object.entries(values)) {
    text = text.replace(new RegExp(`^${key}=.*\n?`, 'gm'), '');
    text += `${text.endsWith('\n') ? '' : '\n'}${key}=${value}\n`;
  }
  await writeFile(envPath, text, { mode: 0o600 });
  await chmod(envPath, 0o600);
}

try {
  if ((await stat(envPath)).mode & 0o077) throw new Error('ENV_PERMISSIONS');
  if (command === 'init') {
    const existing = ['OWNER_SECRET', 'AGENT_SECRET', 'MERCHANT_SECRET', 'OPERATOR_TOKEN', 'PROOF_OPERATION_ID'];
    if (existing.some(key => process.env[key])) throw new Error('ALREADY_INITIALIZED');
    const values = Object.fromEntries(existing.slice(0, 3).map(key => [key, Keypair.random().secret()]));
    values.OPERATOR_TOKEN = randomBytes(32).toString('hex');
    values.PROOF_OPERATION_ID = randomBytes(16).toString('hex');
    values.PROOF_DEVICE_HASH = createHash('sha256').update(`PadalaPocket:B001:${values.PROOF_OPERATION_ID}`).digest('hex');
    values.PROOF_NONCE = Date.now().toString();
    values.PROOF_EXPIRES_AT = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
    values.PROOF_ENABLED = 'true';
    await updateEnvironment(values);
    await record({ command, result: 'Fresh Testnet signers and operator token saved in owner-only ignored environment' });
  } else if (command === 'fund') {
    const deps = await createDependencies(process.env);
    for (const [role, signer] of Object.entries(deps.signers)) {
      const account = await fetch(`https://horizon-testnet.stellar.org/accounts/${signer.publicKey}`, { signal: AbortSignal.timeout(20_000) });
      if (account.status !== 404 && !account.ok) throw new Error('ACCOUNT_READ_FAILED');
      if (account.status === 404) {
        const result = await fetch(`https://friendbot.stellar.org?addr=${signer.publicKey}`, { signal: AbortSignal.timeout(30_000) });
        if (!result.ok) throw new Error('FRIENDBOT_FAILED');
        const body = await result.json();
        await record({ command, role, publicKey: signer.publicKey, fundingHash: /^[a-f0-9]{64}$/.test(body.hash) ? body.hash : null });
      } else await record({ command, role, publicKey: signer.publicKey, result: 'Already funded; no Friendbot request' });
    }
  } else if (command === 'transition-direct') {
    if (action || process.env.PROOF_TRANSPORT === 'direct' || process.env.PROOF_ENVELOPE_KIND !== 'registerDevice'
      || evidence.some(entry => ['registerAgent', 'fundEscrow', 'authorize', 'claim'].includes(entry.action))) throw new Error('TRANSITION_NOT_SAFE');
    const deps = await createDependencies(process.env);
    const tx = TransactionBuilder.fromXDR(process.env.PROOF_ENVELOPE_XDR, Networks.TESTNET);
    if (tx.source !== deps.signers.owner.publicKey) throw new Error('TRANSITION_NOT_SAFE');
    const transactionHash = tx.hash().toString('hex');
    const [result, accountResponse, ledgerResponse] = await Promise.all([
      deps.noir.server.getTransaction(transactionHash),
      fetch(`https://horizon-testnet.stellar.org/accounts/${tx.source}`, { signal: AbortSignal.timeout(15_000) }),
      fetch('https://horizon-testnet.stellar.org/ledgers?order=desc&limit=1', { signal: AbortSignal.timeout(15_000) }),
    ]);
    if (!accountResponse.ok || !ledgerResponse.ok) throw new Error('TRANSITION_NOT_SAFE');
    const account = await accountResponse.json();
    const ledger = (await ledgerResponse.json())._embedded.records[0];
    const proof = validateDirectTransition(evidence, { transactionHash, source: tx.source, sequence: tx.sequence,
      accountSequence: account.sequence, maxTime: tx.timeBounds?.maxTime, ledger: ledger.sequence, closedAt: ledger.closed_at, ledgerStatus: result.status });
    // Archive exact old sensitive envelope before changing configuration. The
    // append-only journal keeps request identity and all original observations.
    await writeFile('.env.b001-gas-envelope', process.env.PROOF_ENVELOPE_XDR, { mode: 0o600, flag: 'wx' });
    const policyExpiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
    await record({ command, action: 'registerDevice', ...proof, policyExpiresAt,
      result: 'Original envelope cannot execute; same identities retained; explicit direct preparation allowed' });
    await updateEnvironment({ PROOF_TRANSPORT: 'direct', PROOF_EXPIRES_AT: policyExpiresAt,
      PROOF_CHECKOUT_ID: 'jx7dhveyvyzshwz8h3a33r73md8hqy4c', PROOF_ENVELOPE_KIND: '', PROOF_ENVELOPE_XDR: '' });
  } else if (command === 'prepare' || command === 'refresh-rejected') {
    const deps = await createDependencies(process.env);
    const { signer, op } = deps.operation(action);
    // No implicit refreshing after an attempt. Even a timed-out sponsor may have
    // reserved an identity. Preserve its original envelope for investigation.
    if (command === 'refresh-rejected') {
      if (deps.transport !== 'gas') throw new Error('REFRESH_NOT_SAFE');
      for (const oldHash of rejectedRefreshHashes(evidence, action)) {
        if ((await deps.noir.server.getTransaction(oldHash)).status !== 'NOT_FOUND') throw new Error('REFRESH_NOT_SAFE');
      }
    } else {
      const transition = evidence.findLastIndex(entry => entry.command === 'transition-direct' && !entry.error);
      const history = action === 'registerDevice' && deps.transport === 'direct' ? evidence.slice(transition + 1) : evidence;
      if (action === 'registerDevice' && deps.transport === 'direct' && transition < 0) throw new Error('TRANSITION_NOT_SAFE');
      if (history.some(entry => entry.command === 'call' && entry.action === action)) throw new Error('ACTION_ALREADY_ATTEMPTED');
      if (history.some(entry => entry.command === 'prepare' && entry.action === action && entry.transactionHash)
        || (process.env.PROOF_ENVELOPE_KIND === action && process.env.PROOF_ENVELOPE_XDR)) throw new Error('ACTION_ALREADY_PREPARED');
    }
    if (action === 'registerAgent' && new Date(process.env.PROOF_EXPIRES_AT).getTime() <= Date.now()) throw new Error('POLICY_EXPIRED');
    if (action === 'authorize') {
      const check = await deps.noir.checkPayment({ deviceHash: deps.deviceHash, agent: deps.signers.agent.publicKey, asset: deps.asset, amount: PROOF_AMOUNT });
      if (!check.ok) { await record({ command, action, check }); process.exitCode = 1; }
    }
    if (!process.exitCode) {
      const prepared = await deps.signAndHash(signer, await deps.noir.prepare(signer.publicKey, op));
      await updateEnvironment({ PROOF_ENVELOPE_KIND: action, PROOF_ENVELOPE_XDR: prepared.signedXdr });
      await record({ command, action, transactionHash: prepared.hash, result: 'Exact envelope saved in sensitive local environment; expires within 300 seconds' });
    }
  } else if (command === 'call') {
    const base = new URL(process.env.PROOF_BASE_URL);
    if (base.protocol !== 'https:' || !/^padalapocket(?:-[a-z0-9-]+)?\.vercel\.app$/.test(base.hostname) || base.pathname !== '/' || base.username || base.password || base.search || base.hash) {
      throw new Error('INVALID_PROOF_ORIGIN');
    }
    const body = { action };
    if (process.env.PROOF_TRANSPORT === 'direct' && PROOF_OPERATIONS.includes(action)) {
      if (process.env.PROOF_ENVELOPE_KIND !== action) throw new Error('ENVELOPE_NOT_PREPARED');
      // Any previous direct dispatch must be reconciled by hash, never blindly
      // resubmitted. The server can recover exact-envelope success on replay.
      const transition = evidence.findLastIndex(entry => entry.command === 'transition-direct' && !entry.error);
      if (evidence.slice(transition + 1).some(entry => entry.command === 'call' && entry.action === action)) throw new Error('ACTION_ALREADY_ATTEMPTED');
      body.transactionXdr = process.env.PROOF_ENVELOPE_XDR;
    }
    if (action === 'status') {
      const last = [...evidence].reverse().find(entry => entry.response?.gas?.requestId || entry.response?.requestId);
      const identity = last?.response?.gas ?? last?.response;
      if (!identity) throw new Error('NO_RECOVERY_IDENTITY');
      body.requestId = identity.requestId;
      body.transactionHash = identity.transactionHash;
    }
    if (action === 'transaction') body.transactionHash = argument;
    let previewCookie;
    try {
      const cookiePath = '.env.b001-preview-cookie';
      if ((await stat(cookiePath)).mode & 0o077) throw new Error('ENV_PERMISSIONS');
      previewCookie = (await readFile(cookiePath, 'utf8')).trim();
      if (!/^(?:__vercel_protection_bypass|_vercel_jwt)=[^;\r\n]+$/.test(previewCookie)) throw new Error('INVALID_PREVIEW_COOKIE');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await record({ command, action, phase: 'dispatching', origin: base.origin });
    const response = await fetch(new URL('/api/operator/proof', base), {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(90_000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPERATOR_TOKEN}`,
        ...(previewCookie ? { Cookie: previewCookie } : {}),
        ...(process.env.VERCEL_AUTOMATION_BYPASS_SECRET ? { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET } : {}) },
      body: JSON.stringify(body),
    });
    // Response is our own sanitized proof DTO, never the SDK or signed envelope.
    const result = await response.json();
    await record({ command, action, httpStatus: response.status, response: result });
    if (!response.ok) process.exitCode = 1;
  } else throw new Error('Use init, fund, transition-direct, prepare <operation>, or call <action>');
} catch (error) {
  const known = ['ENV_PERMISSIONS', 'ALREADY_INITIALIZED', 'ACTION_ALREADY_ATTEMPTED', 'ACTION_ALREADY_PREPARED',
    'ACCOUNT_READ_FAILED', 'FRIENDBOT_FAILED', 'INVALID_PROOF_ORIGIN', 'NO_RECOVERY_IDENTITY', 'REFRESH_NOT_SAFE',
    'TRANSITION_NOT_SAFE', 'POLICY_EXPIRED', 'ENVELOPE_NOT_PREPARED', 'INVALID_PREVIEW_COOKIE'];
  const safe = safeProviderError(error, command ?? 'cli');
  await record({ command: command ?? 'cli', action, error: known.includes(error.message) ? error.message : safe.code, ...safe.evidence });
  process.exitCode = 1;
}
