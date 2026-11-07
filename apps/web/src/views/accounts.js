const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
function button(text,run){const n=el('button',text);n.type='button';n.className='button button-secondary';n.onclick=run;return n;}
function input(form,label,type='text'){const l=el('label',label),n=el('input');n.type=type;n.className='field-input';l.append(n);form.append(l);return n;}
export function renderAccountSetup(root,state,controller){
 const main=el('main');main.className='signin-page';const card=el('section');card.className='signin-card';card.append(el('h1','Set up your account'),el('p','Parents create a family. Students join with the setup code from their parent. Each account uses its own verified email and password.'));
 const form=el('form');form.className='signin-form';const roleLabel=el('label','Account type'),role=el('select');role.className='field-input';role.required=true;const placeholder=el('option','Choose Parent or Student');placeholder.value='';placeholder.disabled=true;placeholder.selected=!['parent','student'].includes(state.accountRole);role.append(placeholder);for(const value of ['parent','student']){const o=el('option',value==='parent'?'Parent':'Student (child)');o.value=value;o.selected=state.accountRole===value;role.append(o);}roleLabel.append(role);form.append(roleLabel);
 const code=input(form,'Student setup code');code.autocomplete='off';code.spellcheck=false;role.onchange=()=>{code.required=role.value==='student';code.disabled=role.value!=='student';};role.onchange();
 const submit=el('button',state.status==='loading'?'Setting up…':'Complete account setup');submit.className='button button-primary';submit.disabled=state.status==='loading';form.append(submit);form.onsubmit=e=>{e.preventDefault();controller.enrollAccount(role.value,code.value.trim());};card.append(form);if(state.error)card.append(el('p',state.error.message));card.append(button('Sign out',()=>controller.signOut()));main.append(card);root.replaceChildren(main);
}
export function renderFamilySetup(content,state,controller){
 const panel=el('section');panel.className='preview-panel';panel.append(el('h2','Your account is ready'),el('p','Your family has its own account records. Payments are unavailable while its wallets are being set up. Demo account funds are kept separate.'));
 if(state.user.role==='parent' && state.studentLinked){panel.append(el('p','Your student has joined the family.'));}
 if(state.user.role==='parent' && !state.studentLinked){
  panel.append(el('h3','Link your student'),el('p','Enter your student’s separate email. Share the generated code with them. They create their own account, verify that email, then choose Student during account setup. Generating another code replaces the previous one.'));
  const form=el('form');form.className='signin-form';const email=input(form,'Student email','email');email.required=true;const submit=el('button','Create student setup code');submit.className='button button-primary';submit.disabled=!!state.accountBusy;form.append(submit);form.onsubmit=e=>{e.preventDefault();controller.createStudentCode(email.value);};panel.append(form);
  if(state.studentCode){const output=el('textarea');output.readOnly=true;output.value=state.studentCode;output.setAttribute('aria-label','Student setup code');output.className='field-input';panel.append(output,el('p','Valid for 24 hours and only for the email you entered. Share it privately.'));}
  if(state.accountError)panel.append(el('p',state.accountError));
 }
 content.append(panel);
}
