// UI-003 visual verification only: local production assets, live read-only demo data.
import { chromium } from '/home/tyrone-teemer/.agents/skills/animate/node_modules/playwright-core/index.mjs';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';
const assets=resolve('apps/web/dist'),output=resolve('ui-review/after');
await mkdir(output,{recursive:true});
const accounts=JSON.parse(await readFile('.env.r001-accounts.json','utf8')).accounts;
const checks=[],errors=[];let completed=false;
const server=createServer(async(req,res)=>{
 try{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path.startsWith('/api/')){
   if(req.method!=='GET'){res.writeHead(405);res.end();return;}
   const upstream=await fetch('https://padalapocket.vercel.app'+req.url,{headers:{Authorization:req.headers.authorization||''}});
   res.writeHead(upstream.status,{'Content-Type':upstream.headers.get('content-type')||'application/octet-stream','Cache-Control':'no-store'});res.end(Buffer.from(await upstream.arrayBuffer()));return;
  }
  const file=resolve(assets,'.'+(path==='/'?'/index.html':path));
  if(!file.startsWith(assets+'/')){res.writeHead(403);res.end();return;}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json'})[extname(file)]||'application/octet-stream');
  res.setHeader('Cache-Control','no-store');res.end(await readFile(file));
 }catch{res.writeHead(503);res.end('Unavailable');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-fake-device-for-media-stream']});
const snap=async(page,name,fullPage=true)=>{await page.screenshot({path:output+'/'+name+'.png',fullPage});};
try{
 for(const [viewport,width,height]of [['mobile',390,844],['desktop',1440,900]])for(const role of (process.argv[2]==='rules'?['parent']:['parent','student'])){
  const prefix=viewport+'-'+role;
  const context=await browser.newContext({viewport:{width,height},permissions:['camera'],timezoneId:'Asia/Manila'});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(prefix+': '+e.message));
  await page.goto(base,{waitUntil:'networkidle'});await snap(page,prefix+'-signin',false);
  assert.equal(await page.locator('.field-label').first().evaluate(e=>getComputedStyle(e).fontSize),'14px');
  assert.equal(await page.locator('.field-input').first().evaluate(e=>getComputedStyle(e).borderTopColor),'rgb(119, 132, 119)');
  await page.getByRole('button',{name:'Create an account',exact:true}).click();await snap(page,prefix+'-signup',false);await page.getByRole('button',{name:'Back to sign in',exact:true}).click();
  const account=accounts.find(a=>a.role===role);const password=process.env[role==='parent'?'UI_REVIEW_PARENT_PASSWORD':'UI_REVIEW_STUDENT_PASSWORD']||account.password;
  await page.locator('#email').fill(account.email);await page.locator('#password').fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.locator('.app-shell').waitFor({timeout:30000});
  await page.waitForLoadState('networkidle');await page.waitForTimeout(1500);
  const pages=process.argv[2]==='rules'?['Allowance rules']:role==='parent'?['Overview','Allowance rules','Approvals','Activity','Savings','Deposit','Withdrawal']:['Home','Pay a seller','Activity','Savings','My Money','Week-end recap'];
  for(const name of pages){
   await page.locator('.navigation .nav-item').filter({hasText:new RegExp('^'+name+'$')}).click();await page.waitForLoadState('networkidle');
   // SPA load events can already be complete while later account reads are pending.
   if(name==='Allowance rules')await page.locator('.family-rules-form').waitFor({timeout:45000});
   if(name==='Activity'||name==='Approvals')await page.locator('.live-activity-row').first().waitFor({timeout:45000});
   if(name==='Savings'||name==='My Money')await page.locator('.weekly-balance-amount').waitFor({timeout:45000});
   if(name==='Overview')await page.locator('.live-rules-summary').waitFor({timeout:45000});
   if(name==='Home')await page.getByText('Loading balance…',{exact:true}).first().waitFor({state:'hidden',timeout:45000});
   await page.evaluate(()=>scrollTo(0,0));const stem=prefix+'-'+name.toLowerCase().replaceAll(' ','-');await snap(page,stem);await snap(page,stem+'-viewport',false);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,stem+' overflow');
   if(viewport==='mobile'&&role==='parent'){assert.ok((await page.locator('.sidebar').boundingBox()).height<180,'Compact parent header');}
   if(viewport==='mobile'&&role==='student'){
    const nav=await page.locator('.navigation').boundingBox();for(const item of await page.locator('.navigation .nav-item').all()){const r=await item.boundingBox();assert.ok(r.x>=nav.x-1&&r.x+r.width<=width+1&&r.height>=44,'All tabs fit');}
   }
   if(name==='Allowance rules'){
    const groups=await page.locator('fieldset').all();if(viewport==='desktop'){const a=await groups[0].boundingBox(),b=await groups[1].boundingBox();assert.ok(b.x>a.x+100&&Math.abs(a.y-b.y)<2,'Side-by-side categories');}
    await page.locator('input[name=weeklyAmountMinor]').fill('invalid');await page.getByRole('button',{name:'Save rules',exact:true}).click();await snap(page,stem+'-validation');
    assert.ok(await page.locator('.family-rules-form>.notice').evaluate(e=>Boolean(e.compareDocumentPosition(e.parentElement.querySelector('fieldset')) & Node.DOCUMENT_POSITION_FOLLOWING)),'Validation before categories');
    if(process.argv[2]==='rules'){
     await page.getByRole('button',{name:'Save rules',exact:true}).click();const visible=await page.locator('.family-rules-form>.notice').boundingBox();assert.ok(visible.y>=0&&visible.y+visible.height<=height,'Validation visible after bottom submit');await snap(page,stem+'-validation-at-submit',false);
    }
   }
   if(name==='Activity'||name==='Approvals'){
    const photo=page.locator('.live-photo-button').first();if(await photo.count()){await photo.click();try{await page.locator('dialog[open]').waitFor({timeout:4000});await snap(page,stem+'-photo-modal',false);await page.getByRole('button',{name:'Close photo',exact:true}).click();}catch{checks.push(stem+': modal not ready; photos depend on live reads');}}
    const evidence=page.locator('details').first();if(await evidence.count()){await evidence.evaluate(e=>e.open=true);await snap(page,stem+'-evidence');}
   }
   if(name==='Pay a seller'){
    await page.getByRole('button',{name:'Take a photo',exact:true}).click();await page.getByRole('button',{name:'Use this photo',exact:true}).waitFor();await page.waitForTimeout(500);await snap(page,stem+'-camera-ready',false);await page.getByRole('button',{name:'Close camera',exact:true}).click();
    await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Controlled camera denial','NotAllowedError');};});
    await page.getByRole('button',{name:'Take a photo',exact:true}).click();await page.locator('.camera-status.is-error').waitFor();await snap(page,stem+'-camera-error',false);await page.getByRole('button',{name:'Close camera',exact:true}).click();
   }
   checks.push(stem+': rendered, no horizontal document overflow');console.log(stem);
  }
  await context.close();
 }
 assert.deepEqual(errors,[]);
 completed=true;
}catch(error){errors.push(error.message);throw error;}
finally{await browser.close();server.close();await writeFile(output+(process.argv[2]==='rules'?'/checks-rules.json':'/checks.json'),JSON.stringify({completed,checks,errors,scope:'Local production assets; demo account GET data proxied from deployed API. No application API writes allowed. Camera denial controlled in browser, no payment submitted.'},null,2));}
