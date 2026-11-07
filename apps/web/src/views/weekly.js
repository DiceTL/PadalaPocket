const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const money=n=>`₱${(Number(n)*9.68/10000000).toFixed(2)} simulated · ${(Number(n)/10000000).toFixed(7)} Testnet XLM`;
export function renderWeekly(content,state,controller){
 const page=state.activePage,parent=state.user.role==='parent';
 if(!['Overview','Savings','My Money','Week-end recap'].includes(page))return false;
 const panel=el('section');panel.className='preview-panel';
 panel.append(el('h2',page==='Overview'?'Weekly rollover':page));
 const data=state.weekly;
 if(state.weeklyError){const error=el('p',state.weeklyError);error.setAttribute('role','alert');panel.append(error);}
 if(!data){panel.append(el('p','Loading weekly balances…'));content.append(panel);return page!=='Overview';}
 if(page==='Savings')panel.append(el('p',money(data.savingsStroops)),el('p','Confirmed Needs leftovers set aside in Savings.'));
 else if(page==='My Money')panel.append(el('p',money(data.myMoneyStroops)),el('p','Your private balance from Wants leftovers.'));
 else{
  panel.append(el('p',`Simulated time: ${new Date(data.clock.simulatedAt).toLocaleString('en-PH',{timeZone:'Asia/Manila'})} PHT`));
  panel.append(el('p','At the weekly boundary, leftover Needs moves to Savings and leftover Wants moves to My Money. The next allowance then uses the parent funding wallet.'));
  if(parent){
   const form=el('form');form.className='signin-form';
   const label=el('label','Weekly day (PHT)'),day=el('select');day.className='field-input';
   ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].forEach((d,i)=>{const o=el('option',d);o.value=i;day.append(o);});day.value=data.clock.weekday??0;label.append(day);
   const timeLabel=el('label','Weekly time (PHT)'),time=el('input');time.type='time';time.required=true;time.className='field-input';time.value=data.clock.time??'';timeLabel.append(time);
   const save=el('button','Save weekly schedule');save.type='submit';save.className='button button-secondary';save.disabled=!!state.weeklyBusy;form.append(label,timeLabel,save);form.onsubmit=e=>{e.preventDefault();controller.saveWeeklySchedule(Number(day.value),time.value);};panel.append(form);
   if(!data.configured)panel.append(el('p','Weekly transfers require the server’s separate student Testnet signer to be configured.'));
   const active=data.events.some(e=>['processing','unknown'].includes(e.status));
   const button=el('button',state.weeklyBusy?'Advancing week…':active?'Continue weekly rollover (test)':'Advance to next week (test)');button.type='button';button.className='button button-primary';button.disabled=!!state.weeklyBusy || !data.configured || data.clock.weekday===null;button.onclick=()=>controller.advanceWeek();panel.append(button);
   panel.append(el('p','This advances application demo time and submits actual Testnet transfers. Transaction timestamps and approval deadlines use real time.'));
  }
  for(const event of data.events){const row=el('article');row.append(el('h3',`Week boundary · ${new Date(event.targetAt).toLocaleString('en-PH',{timeZone:'Asia/Manila'})} PHT`),el('p',`${event.status.replaceAll('_',' ')} · transfer stage ${event.stage}/6`),el('p',`Needs to Savings: ${money(event.needsStroops)}`));if(!parent)row.append(el('p',`Wants to My Money: ${money(event.wantsStroops)}`));if(event.notice)row.append(el('p',event.notice));if(event.stageStarted)row.append(el('p','A transfer is awaiting confirmation. Refresh status before continuing.'));panel.append(row);}
 }
 const refresh=el('button','Refresh weekly status');refresh.className='button button-secondary';refresh.onclick=()=>controller.refreshFamily();panel.append(refresh);content.append(panel);return page!=='Overview';
}
