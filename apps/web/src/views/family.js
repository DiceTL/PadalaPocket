const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
const pesos = minor => `₱${(BigInt(minor) / 100n).toString()}.${(BigInt(minor) % 100n).toString().padStart(2, '0')}`;
let disposePhotos = () => {};
export function clearFamilyPhotos() { disposePhotos(); disposePhotos = () => {}; }
function refreshButton(controller) { const button = el('button', 'button button-secondary', 'Refresh data'); button.type = 'button'; button.addEventListener('click', () => controller.refreshFamily()); return button; }

export function renderFamilyPage(content, state, controller) {
  if (state.activePage === 'Deposit' && state.user.role === 'parent') { renderTopups(content,state,controller); return true; }
  if (state.activePage === 'Allowance rules' && state.user.role === 'parent') { renderRules(content, state, controller); return true; }
  if(state.activePage==='Approvals' && state.user.role==='parent'){renderActivity(content,state,controller,true);return true;}
  if (state.activePage === 'Activity') { renderActivity(content, state, controller); return true; }
  return false;
}
function renderRules(content, state, controller) {
  const panel = el('section', 'preview-panel'); panel.append(el('h2', '', 'Saved family rules'));
  panel.append(el('p', '', 'Needs cap and category changes apply to future purchases. Existing purchases keep their original rules. The saved amount and split are used when you distribute funds from the parent overview. Scheduling and Wants spending are not active yet.'));
  if (state.rulesError) { const error = el('p', 'notice notice-error', state.rulesError); error.setAttribute('role', 'alert'); panel.append(error); }
  if (!state.familyRules) { panel.append(el('p', '', 'Rules have not loaded.'), refreshButton(controller)); content.append(panel); return; }
  const settings = state.rulesDraft || state.familyRules.settings;
  const form = el('form', 'signin-form'); const inputs = {};
  for (const [name, label, value] of [['weeklyAmountMinor','Weekly amount in simulated pesos',pesos(settings.weeklyAmountMinor).slice(1)],['needsPercent','Needs share (%)',settings.needsPercent],['capMinor','Purchase cap in simulated pesos',pesos(settings.capMinor).slice(1)]]) {
    const wrap = el('label', 'field-label', label), input = el('input', 'field-input');
    input.name = name; input.value = value; input.required = true; input.disabled = Boolean(state.rulesBusy);
    input.type = name === 'needsPercent' ? 'number' : 'text'; input.inputMode = 'decimal';
    if (name === 'needsPercent') { input.min = '0'; input.max = '100'; input.step = '1'; }
    wrap.append(input); form.append(wrap); inputs[name] = input;
  }
  for (const [key, title] of [['needsCategories','Needs allowed categories'],['wantsCategories','Wants categories (setup only)']]) {
    const group = el('fieldset', 'live-category-group'); group.append(el('legend', '', title));
    for (const category of state.familyRules.categories) {
      const label = el('label', 'live-category-choice'), checkbox = el('input'); checkbox.type = 'checkbox'; checkbox.name = key; checkbox.value = category.id; checkbox.checked = settings[key].includes(category.id); checkbox.disabled = Boolean(state.rulesBusy);
      const copy=el('span','live-category-copy',category.label); if(category.examples)copy.append(el('small','',category.examples)); label.append(checkbox,copy); group.append(label);
    }
    form.append(group);
  }
  const validation = el('p', 'notice notice-error'); validation.hidden = true; validation.setAttribute('role','alert'); form.append(validation);
  const save = el('button', 'button button-primary', state.rulesBusy ? 'Saving…' : 'Save rules'); save.type = 'submit'; save.disabled = Boolean(state.rulesBusy); form.append(save);
  form.addEventListener('submit', event => {
    event.preventDefault(); const converted = {};
    for (const key of ['weeklyAmountMinor','capMinor']) {
      const raw = inputs[key].value.trim();
      if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(raw)) { validation.hidden = false; validation.textContent = 'Enter positive peso amounts with at most two decimal places.'; return; }
      const [whole, fraction = ''] = raw.split('.'); converted[key] = (BigInt(whole) * 100n + BigInt(fraction.padEnd(2,'0'))).toString();
      if (converted[key] === '0' || BigInt(converted[key]) > 999999999n) { validation.hidden = false; validation.textContent = 'Amount is outside the supported range.'; return; }
    }
    const values = new FormData(form);
    void controller.saveFamilyRules({ ...converted, needsPercent: Number(inputs.needsPercent.value), needsCategories: values.getAll('needsCategories'), wantsCategories: values.getAll('wantsCategories') });
  });
  panel.append(form, refreshButton(controller));
  if (state.rulesSaved) { const message = el('p', '', `Rules saved · revision ${state.familyRules.revision}.`); message.setAttribute('role', 'status'); panel.append(message); }
  content.append(panel);
}
function renderActivity(content, state, controller, approvalMode=false) {
  if(approvalMode) state={...state,activity:state.approvals?{items:state.approvals.purchases.filter(p=>p.approvalBinding).map(p=>({...p,productName:p.ai?.productName,category:p.ai?.category}))}:null,activityError:state.approvalError};
  const panel = el('section', 'preview-panel'); panel.append(el('h2', '', approvalMode?'Purchase approvals':'Needs purchases'), el('p', '', approvalMode?'Review the exact request and photo. Decisions close after ten minutes. Approving starts a Testnet payment; it is paid only after confirmation.':'Actual submitted purchases. Pending or blocked purchases are not shown as paid.'), refreshButton(controller));
  if (state.activityError) { const error = el('p', 'notice notice-error', state.activityError); error.setAttribute('role', 'alert'); panel.append(error); }
  if (!state.activity) panel.append(el('p', '', 'Activity has not loaded.'));
  else if (!state.activity.items.length) panel.append(el('p', '', 'No purchases yet.'));
  const abort = new AbortController(), urls = new Set(), dialogs = new Set(); let disposed = false;
  disposePhotos = () => { disposed = true; abort.abort(); for (const dialog of dialogs) { dialog.close(); dialog.remove(); } for (const url of urls) URL.revokeObjectURL(url); };
  for (const [index, purchase] of (state.activity?.items || []).entries()) {
    const card = el('article', 'live-activity-row');
    const photo = el('button', 'live-photo-button', 'Load item photo'); photo.type = 'button'; photo.setAttribute('aria-label', `View photo: ${purchase.productName || 'purchase'}`);
    const details = el('div', 'live-activity-details'); details.append(el('h3', '', purchase.productName || 'Item assessment unavailable'), el('p', '', `${pesos(purchase.priceMinor)} · ${Number(purchase.amountStroops) / 10000000} Testnet XLM`), el('p', '', `Status: ${purchase.status === 'claimed' ? 'Paid · seller claimed' : purchase.status.replaceAll('_',' ')}`));
    if (purchase.reason) details.append(el('p', '', purchase.reason.replaceAll('_',' ')));
    details.append(el('p', '', new Date(purchase.createdAt).toLocaleString()));
    if(approvalMode){
      details.append(el('p','',`Seller: ${purchase.sellerId} · Category: ${purchase.category || 'Unknown'}`));
      if(purchase.ai)details.append(el('p','',`AI assessment: ${purchase.ai.productName || 'Unclear'} · Uncertain: ${purchase.ai.uncertain?'yes':'no'} · Restricted item: ${purchase.ai.prohibited?'yes':'no'}`));
      if(purchase.rules)details.append(el('p','',`Saved cap: ${pesos(purchase.rules.capMinor)} · Allowed categories: ${purchase.rules.allowedCategories.join(', ')} · Rules: ${purchase.rules.version}`));
      if(purchase.approvalDeadline)details.append(el('p','',`Decision deadline: ${new Date(purchase.approvalDeadline).toLocaleString()}`));
      if(purchase.parentDecision)details.append(el('p','',`Parent decision: ${purchase.parentDecision.decision} · ${new Date(purchase.parentDecision.decidedAt).toLocaleString()}`));
      if(purchase.status==='awaiting_parent'){
        const elapsed=Date.parse(purchase.approvalDeadline)<=Date.now();
        for(const [decision,label] of [['approve','Approve and pay'],['reject','Reject purchase']]){
          const button=el('button','button button-secondary',state.approvalBusy===purchase.id?'Processing decision…':label);button.type='button';button.disabled=Boolean(state.approvalBusy||elapsed);button.onclick=()=>controller.decidePurchase(purchase.id,decision,purchase.approvalBinding);details.append(button);
        }
        if(elapsed)details.append(el('p','','Deadline passed. Refresh to confirm expiry.'));
      }
      if(purchase.parentDecision?.decision==='approve' && ['approved','exception_pending'].includes(purchase.status)){
        details.append(el('p','',`Confirmed payment stages: ${purchase.completedStages}/7`));
        if(!purchase.executionStarted){const next=el('button','button button-primary','Continue approved payment');next.type='button';next.disabled=Boolean(state.approvalBusy);next.onclick=()=>controller.decidePurchase(purchase.id,'continue',purchase.approvalBinding);details.append(next);}
      }
      if(state.approvalBusy===purchase.id)details.append(el('p','','Payment may take a few minutes. Refresh status if the connection closes; do not create a replacement payment.'));
      const evidence=el('details');evidence.append(el('summary','','Transaction evidence'));for(const [stage,tx] of Object.entries(purchase.transactions??{}))evidence.append(el('p','transaction-reference',`${stage}: ${tx.hash}`));details.append(evidence);
    }
    let photoUrl;
    async function loadPhoto() {
      photo.disabled = true; photo.textContent = 'Loading photo…';
      try {
        const blob = await controller.fetchPurchasePhoto(purchase.id, abort.signal); if (disposed) return;
        photoUrl = URL.createObjectURL(blob); urls.add(photoUrl);
        const image = el('img'); image.src = photoUrl; image.alt = purchase.productName || 'Submitted product photo'; photo.replaceChildren(image);
      } catch { if (!disposed) photo.textContent = 'Retry photo'; }
      finally { if (!disposed) photo.disabled = false; }
    }
    photo.addEventListener('click', () => {
      if (!photoUrl) { void loadPhoto(); return; }
      const dialog = el('dialog', 'live-photo-dialog'); dialog.setAttribute('aria-label', 'Submitted purchase photo');
      const close = el('button', 'button button-secondary', 'Close photo'); close.type = 'button'; close.addEventListener('click', () => dialog.close());
      const image = el('img'); image.src = photoUrl; image.alt = purchase.productName || 'Submitted product photo';
      dialog.append(close, image); dialogs.add(dialog); dialog.addEventListener('close', () => { dialogs.delete(dialog); dialog.remove(); if (!disposed) photo.focus(); }, { once: true });
      document.body.append(dialog); dialog.showModal();
    });
    card.append(photo, details); panel.append(card); if (index < 10) void loadPhoto();
  }
  content.append(panel);
}

function renderTopups(content,state,controller) {
 const panel=el('section','preview-panel');panel.append(el('h2','','Top up parent wallet with Velo'),el('p','','Pay through Velo using a different funded Stellar Testnet wallet as the sender. After payment, return here and refresh status. Use Overview to distribute funds to Needs and Wants.'));
 if(state.familyRules)panel.append(el('p','',`Top-up amount: simulated ₱${Number(state.familyRules.settings.weeklyAmountMinor)/100}, matching your saved allowance total.`));
 if(state.topups?.expectedReceiver){panel.append(el('p','','Parent receiving wallet:'),el('p','transaction-reference',state.topups.expectedReceiver));}
 if(state.topupError)panel.append(el('p','notice notice-error',state.topupError));
 const topups=state.topups?.topups??[];
 for(const topup of topups){
  const card=el('article','live-activity-item');card.append(el('h3','',`${topup.amountXlm} Testnet XLM`),el('p','',`Velo status: ${{configuration_required:'Receiving wallet needs configuration',creating:'Creating checkout',unknown:'Confirmation needed',status_unavailable:'Status temporarily unavailable',awaiting_route:'Preparing checkout',created:'Ready to pay',pending:'Payment pending',paid:'Paid',expired:'Expired',cancelled:'Cancelled',failed:'Failed'}[topup.status]??'Status unavailable'}`));
  if(topup.status==='configuration_required')card.append(el('p','notice notice-error','Velo is configured for a different receiving wallet. Use a Velo project owned by the parent wallet shown above, configure its API key on the server, then create a new checkout.'));
  if(['creating','unknown','status_unavailable'].includes(topup.status))card.append(el('p','','Checkout status is uncertain. Refresh before trying again.'));
  if(topup.status==='paid')card.append(el('p','','Velo confirms payment to the parent wallet. This does not distribute an allowance; use Overview for that step.'));
  if(topup.checkoutUrl&&['created','pending','awaiting_route'].includes(topup.status)){const a=el('a','button button-primary','Open Velo checkout');a.href=topup.checkoutUrl;a.target='_blank';a.rel='noopener noreferrer';card.append(a);}
  panel.append(card);
 }
 const button=el('button','button button-primary',state.topupBusy?'Creating checkout…':'Create Velo checkout');button.type='button';button.disabled=Boolean(state.topupBusy||!state.familyRules||!state.topups||topups.some(t=>!['paid','failed','expired','cancelled','configuration_required'].includes(t.status)));button.onclick=()=>controller.createTopup();
 const refresh=el('button','button button-secondary','Refresh Velo status');refresh.type='button';refresh.onclick=()=>controller.refreshTopups();panel.append(button,refresh);
 if(!topups.length)panel.append(el('p','','No Velo top-ups yet. Testnet XLM has no monetary value.'));
 content.append(panel);
}
