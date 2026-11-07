import '../layouts/pages.css';
import '../layouts/parent-pages.css';
import './live-layout.css';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const xlm=value=>`${(Number(value)/10000000).toLocaleString(undefined,{maximumFractionDigits:7})} XLM`;
const php=value=>`₱${(Number(value)*968/10000000/100).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
function action(label,page,controller,cls='button button-secondary'){const n=el('button',cls,label);n.type='button';n.onclick=()=>controller.navigate(page);return n;}
function amountCard(title,amount,bucket){const card=el('section',`live-balance ${bucket}`);card.append(el('h2','',title));if(amount===undefined){card.append(el('p','live-balance-amount','—'),el('p','','Loading balance…'));}else card.append(el('p','live-balance-amount',php(amount)),el('p','',xlm(amount)+' · Testnet'));return card;}
export function renderDashboard(content,state,controller){
 const parent=state.user.role==='parent';const page=state.activePage;
 if(!(parent?page==='Overview':page==='Home'))return false;
 const section=el('div','live-dashboard');
 const header=el('header','live-welcome');header.append(el('div','',parent?'Your child’s allowance':'A little planning. More room for you.'),el('span','live-testnet','Stellar Testnet · simulated PHP'));section.append(header);
 const balances=el('div','live-balances');
 const needs=parent?state.funding?.confirmedNeedsStroops:state.purchaseHistory?.availableNeedsStroops;
 const wants=parent?state.funding?.confirmedWantsStroops:state.purchaseHistory?.availableWantsStroops;
 balances.append(amountCard(parent?'Needs allocated':'Needs available',needs,'needs'),amountCard(parent?'Wants allocated':'Wants available',wants,'wants'));section.append(balances);
 section.append(el('p','live-subnote',parent?'Confirmed allocations include historical funding. Student spending reduces their available balance.':'Choose Needs or Wants when submitting a purchase. Both use the parent’s saved purchase rules.'));
 const actions=el('div','live-actions');actions.append(parent?action('Deposit with Velo','Deposit',controller,'button button-primary'):action('Pay a seller','Pay a seller',controller,'button button-primary'),action(parent?'Allowance rules':'View activity',parent?'Allowance rules':'Activity',controller));section.append(actions);
 if(parent&&state.familyRules){const settings=state.familyRules.settings;const rules=el('section','live-rules-summary');rules.append(el('h2','','Your allowance plan'),el('p','',`₱${(Number(settings.weeklyAmountMinor)/100).toFixed(2)} per allocation · ${settings.needsPercent}% Needs / ${100-settings.needsPercent}% Wants`),el('p','',`Purchase cap ₱${(Number(settings.capMinor)/100).toFixed(2)} · ${settings.needsCategories.length} allowed Needs categories`));section.append(rules);}
 if(!parent){const pockets=el('div','live-pockets');for(const name of ['Savings','My Money']){const card=el('section','live-pocket');card.append(el('h2','',name),el('p','',state.weekly?php(name==='Savings'?state.weekly.savingsStroops:state.weekly.myMoneyStroops):'Loading balance…'),action('View '+name,name,controller));pockets.append(card);}section.append(pockets);}
 const recent=el('section','live-recent');const heading=el('div','live-section-heading');heading.append(el('h2','','Recent activity'),action('View all','Activity',controller));recent.append(heading);
 if(state.activityError)recent.append(el('p','notice notice-error',state.activityError));else if(!state.activity)recent.append(el('p','','Loading activity…'));else if(!state.activity.items.length)recent.append(el('p','','Your first purchase will appear here.'));
 for(const item of state.activity?.items.slice(0,4)??[]){const row=el('div','live-recent-row');const copy=el('div');copy.append(el('h3','',item.productName||'Purchase'),el('p','',(item.bucket === 'wants' ? 'Wants · ' : 'Needs · ')+new Date(item.createdAt).toLocaleDateString()));const value=el('div');value.append(el('strong','',`₱${(Number(item.priceMinor)/100).toFixed(2)}`),el('p','live-status',item.status==='claimed'?'Paid · seller claimed':item.status.replaceAll('_',' ')));row.append(copy,value);recent.append(row);}section.append(recent);content.append(section);
 return !parent;
}
const unfinished={Savings:['Savings transfers are not available yet.','No connected Savings balance or release requests are shown.'],'My Money':['Your private pocket is not available yet.','Private balances and spending will appear here when that flow is connected.'],'Week-end recap':['Weekly rollover is not available yet.','Funds stay in their existing buckets; no automatic week-end transfers have run.'],'Withdrawal':['Withdrawal is not available in the app yet.','The earlier test-anchor proof is separate from this account.']};
export function renderUnavailable(content,state,controller){const messages=unfinished[state.activePage];if(!messages)return false;const panel=el('section','live-unavailable');panel.append(el('span','live-availability','Not available yet'),el('h2','',messages[0]),el('p','',messages[1]),action(state.user.role==='parent'?'Back to overview':'Back to home',state.user.role==='parent'?'Overview':'Home',controller));content.append(panel);return true;}
