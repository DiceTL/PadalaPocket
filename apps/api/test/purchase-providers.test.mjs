import { test } from 'node:test';
import assert from 'node:assert/strict';
import { identifyPhoto } from '../src/purchase-providers.mjs';
test('Groq assessment uses one bounded instruct request and never retries a provider error', async () => {
  const previousFetch = globalThis.fetch, previousKey = process.env.GROQ_API_KEY;
  let calls = 0; process.env.GROQ_API_KEY = 'synthetic-key';
  globalThis.fetch = async (url, options) => {
    calls++; assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
    const body = JSON.parse(options.body); assert.equal(body.reasoning_effort, 'none'); assert.equal(body.max_completion_tokens, 512);
    return { ok: false, status: 429 };
  };
  try { await assert.rejects(identifyPhoto(Buffer.from('synthetic'), 'image/png'), error => error.aiDiagnostic.httpStatus === 429); assert.equal(calls, 1); }
  finally { globalThis.fetch = previousFetch; if (previousKey === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = previousKey; }
});

test('apple classification uses the shared produce taxonomy and validates model categories',async()=>{
 const previousFetch=globalThis.fetch,previousKey=process.env.GROQ_API_KEY;process.env.GROQ_API_KEY='synthetic-key';
 globalThis.fetch=async(url,options)=>{const prompt=JSON.parse(options.body).messages[0].content;assert.match(prompt,/fresh apple or banana is fruits_vegetables/);assert.match(prompt,/apple candy is snacks/);assert.match(prompt,/Apple phone is electronics/);return {ok:true,status:200,json:async()=>({choices:[{message:{content:JSON.stringify({productName:'Apple',category:'fruits_vegetables',uncertain:false,prohibited:false})}}]})};};
 try { const {ai}=await identifyPhoto(Buffer.from('synthetic'),'image/png');assert.equal(ai.category,'fruits_vegetables'); }
 finally{globalThis.fetch=previousFetch;if(previousKey===undefined)delete process.env.GROQ_API_KEY;else process.env.GROQ_API_KEY=previousKey;}
});
