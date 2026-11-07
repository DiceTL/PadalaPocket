import { exceptionDevice, signExceptionConsent, verifyExceptionConsent } from './purchase-approval.mjs';
import { CATEGORY_IDS, PRODUCT_IDENTIFICATION_PROMPT } from './purchase-categories.mjs';
import sharp from 'sharp';
import { Asset, Networks, TransactionBuilder } from '@stellar/stellar-sdk';
import { NoirAgentClient, keypairSigner } from '@noirx402/agent-sdk';
export async function validatePhoto(bytes, mime) {
  const decoded = sharp(bytes, { limitInputPixels: 16000000, failOn: 'warning' });
  const info = await decoded.metadata();
  if (!['png','jpeg'].includes(info.format) || `image/${info.format}` !== mime || (info.pages ?? 1) !== 1) throw Error('INVALID_PHOTO');
  await decoded.raw().toBuffer();
}
export async function identifyPhoto(bytes, mime) {
  if (!process.env.GROQ_API_KEY) throw Error('AI_UNAVAILABLE');
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'qwen/qwen3.8-27b', reasoning_effort: 'none', max_completion_tokens: 512, response_format: { type: 'json_object' }, messages: [
      { role: 'system', content: PRODUCT_IDENTIFICATION_PROMPT },
      { role: 'user', content: [{ type: 'text', text: 'Identify this product.' }, { type: 'image_url', image_url: { url: `data:${mime};base64,${bytes.toString('base64')}` } }] },
    ] }),
  });
  if (!response.ok) throw Object.assign(Error('AI_UNAVAILABLE'), { aiDiagnostic: { httpStatus: response.status } });
  const result = await response.json(); let ai;
  const diagnostic = { httpStatus: response.status, finishReason: result.choices?.[0]?.finish_reason ?? null, usage: result.usage ?? null };
  try { ai = JSON.parse(result.choices?.[0]?.message?.content ?? 'null'); } catch { throw Object.assign(Error('AI_UNAVAILABLE'), { aiDiagnostic: diagnostic }); }
  if (!ai || !(ai.productName === null || typeof ai.productName === 'string' && ai.productName.length <= 200) || ![...CATEGORY_IDS,'unknown'].includes(ai.category) || typeof ai.uncertain !== 'boolean' || typeof ai.prohibited !== 'boolean') throw Object.assign(Error('AI_UNAVAILABLE'), { aiDiagnostic: diagnostic });
  return { ai, usage: result.usage ?? null, model: 'qwen/qwen3.8-27b' };
}
export function purchaseLedger() {
  const noir = new NoirAgentClient({ network: 'testnet' }); noir.server.httpClient.defaults.timeout = 15000;
  const signers = { owner: keypairSigner(process.env.OWNER_SECRET), agent: keypairSigner(process.env.AGENT_SECRET), merchant: keypairSigner(process.env.MERCHANT_SECRET) };
  const asset = Asset.native().contractId(Networks.TESTNET);
  return {
    merchantPublicKey: signers.merchant.publicKey,
    consent: row => signExceptionConsent(row, process.env.OWNER_SECRET, signers.merchant.publicKey, asset),
    exceptionReady: async row => !(await noir.getDeviceOwner(exceptionDevice(row))) && (await noir.getEscrowBalance(exceptionDevice(row)))===0n,
    exceptionComplete: async row => (await noir.getEscrowBalance(exceptionDevice(row))) === 0n && (await noir.getPolicy(exceptionDevice(row))) === null,
    status: hash => noir.server.getTransaction(hash),
    escrow: device => noir.getEscrowBalance(device), pending: () => noir.getPendingBalance(signers.merchant.publicKey),
    check: (deviceHash, amount) => noir.checkPayment({ deviceHash, agent: signers.agent.publicKey, asset, amount: BigInt(amount), requireEscrow: true }),
    async prepare(stage, row, deviceHash) {
      if (row.evidence.merchant !== signers.merchant.publicKey) throw Error('MERCHANT_MISMATCH');
      const target=exceptionDevice(row);
      if(stage.startsWith('exception_') || stage==='needs_defund') verifyExceptionConsent(row,signers.owner.publicKey,signers.merchant.publicKey,asset);
      const config = {
        exception_device:[signers.owner,{kind:'registerDevice',deviceHash:target,agent:signers.owner.publicKey}],
        exception_policy:[signers.owner,{kind:'registerAgent',deviceHash:target,agent:signers.owner.publicKey,asset,maxAmount:BigInt(row.amount_stroops),expiresAt:new Date(Date.parse(row.parent_decision?.decidedAt)+86400000)}],
        needs_defund:[signers.owner,{kind:'defundEscrow',deviceHash,token:asset,amount:BigInt(row.amount_stroops)}],
        exception_fund:[signers.owner,{kind:'fundEscrow',deviceHash:target,token:asset,amount:BigInt(row.amount_stroops)}],
        exception_authorize:[signers.owner,{kind:'authorize',deviceHash:target,merchant:signers.merchant.publicKey,asset,amount:BigInt(row.amount_stroops),nonce:BigInt(row.nonce)}],
        exception_claim:[signers.merchant,{kind:'claim',token:asset}],
        exception_revoke:[signers.owner,{kind:'revokeAgent',deviceHash:target}],
        policy: [signers.owner, { kind: 'registerAgent', deviceHash, agent: signers.agent.publicKey, asset, maxAmount: BigInt(row.rules.capStroops), expiresAt: new Date(Date.now() + 86400000) }],
        authorize: [signers.agent, { kind: 'authorize', deviceHash, merchant: signers.merchant.publicKey, asset, amount: BigInt(row.amount_stroops), nonce: BigInt(row.nonce) }],
        claim: [signers.merchant, { kind: 'claim', token: asset }],
      };
      const [signer, op] = config[stage]; const unsigned = await noir.prepare(signer.publicKey, op);
      const signed = await signer.signTransaction(unsigned, { networkPassphrase: Networks.TESTNET });
      const tx = TransactionBuilder.fromXDR(signed, Networks.TESTNET);
      if (BigInt(tx.fee) > 300000000n) throw Error('FEE_LIMIT');
      const [accountResponse, ledgerResponse] = await Promise.all([
        fetch(`https://horizon-testnet.stellar.org/accounts/${signer.publicKey}`, { signal: AbortSignal.timeout(15000) }),
        fetch('https://horizon-testnet.stellar.org/ledgers?order=desc&limit=1', { signal: AbortSignal.timeout(15000) }),
      ]);
      if (!accountResponse.ok || !ledgerResponse.ok) throw Error('RESERVE_UNAVAILABLE');
      const account = await accountResponse.json(), currentLedger = (await ledgerResponse.json())._embedded.records[0];
      const native = account.balances.find(balance => balance.asset_type === 'native');
      const units = value => { if (!/^\d+\.\d{7}$/.test(value)) throw Error('INVALID_BALANCE'); return BigInt(value.replace('.', '')); };
      const reserve = BigInt(2 + account.subentry_count + (account.num_sponsoring ?? 0) - (account.num_sponsored ?? 0)) * BigInt(currentLedger.base_reserve_in_stroops);
      if (units(native.balance) - units(native.selling_liabilities) - reserve < BigInt(tx.fee)) throw Error('INSUFFICIENT_FEE_BALANCE');
      return { signed, hash: tx.hash().toString('hex') };
    },
    submit: signed => noir.submit(signed),
  };
}
