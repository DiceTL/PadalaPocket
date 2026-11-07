import { renderAccountSetup, renderFamilySetup } from './accounts.js';
import { renderWeekly } from './weekly.js';
import { renderDashboard, renderUnavailable } from './live-layout.js';
import { getPageTitle, getRoleView, MOCK_BADGE_TEXT, MOCK_DISCLOSURE } from './model.js';
import { createCameraButton } from './camera.js';
import { clearFamilyPhotos, renderFamilyPage } from './family.js';

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

function mockBadge() {
  return el('span', 'mock-badge', MOCK_BADGE_TEXT);
}

function errorNotice(error, heading = 'Sign-in could not continue') {
  if (!error) return null;
  const box = el('div', 'notice notice-error');
  box.setAttribute('role', 'alert');
  box.append(el('strong', '', error.code === 'INVALID_INPUT' ? 'Check your details' : heading));
  box.append(el('p', '', error.message));
  return box;
}

function renderSignIn(root, state, controller) {
  const main = el('main', 'signin-page');
  const card = el('section', 'signin-card');
  card.setAttribute('aria-labelledby', 'signin-title');
  if (state.mock) card.append(mockBadge());

  card.append(el('p', 'eyebrow', 'A clearer way to manage allowance'));
  card.append(el('h1', 'brand-title', 'PadalaPocket'));
  const signup=state.authMode==='signup';
  const signinHeading = el('h2', 'signin-heading', signup?'Create your account':'Sign in');
  signinHeading.id = 'signin-title';
  card.append(signinHeading);
  card.append(el('p', 'muted intro', signup?'Choose Parent or Student now. You will confirm your email before completing account setup.':'Sign in to your parent or student account.'));

  const form = el('form', 'signin-form');
  form.noValidate = true;
  let accountType;
  if(signup){
    const roleLabel=el('label','field-label','Create account as');
    accountType=el('select','field-input');accountType.name='accountType';accountType.required=true;
    const placeholder=el('option','','Choose Parent or Student');placeholder.value='';placeholder.disabled=true;placeholder.selected=!state.signupRole;accountType.append(placeholder);
    for(const [value,label] of [['parent','Parent'],['student','Student (child)']]){const option=el('option','',label);option.value=value;option.selected=state.signupRole===value;accountType.append(option);}
    roleLabel.append(accountType);form.append(roleLabel);
    form.append(el('p','muted','After confirming your email, parents create a family. Students need a setup code from their parent.'));
  }
  const emailLabel = el('label', 'field-label', 'Email address');
  emailLabel.htmlFor = 'email';
  const email = el('input', 'field-input');
  email.value=state.signupEmail??'';
  email.id = 'email'; email.name = 'email'; email.type = 'email'; email.autocomplete = 'email'; email.placeholder = 'you@example.com'; email.required = true;
  emailLabel.append(email);
  const passwordLabel = el('label', 'field-label', 'Password');
  passwordLabel.htmlFor = 'password';
  const password = el('input', 'field-input');
  password.id = 'password'; password.name = 'password'; password.type = 'password'; password.autocomplete = 'current-password'; password.required = true;
  passwordLabel.append(password);
  form.append(emailLabel, passwordLabel);
  const notice = errorNotice(state.error);
  if (notice) form.append(notice);
  const submit = el('button', 'button button-primary');
  if (state.status === 'loading') {
    submit.append(el('span', 'spinner'));
    submit.append(document.createTextNode('Signing in…'));
  } else submit.textContent = signup?'Create account':'Sign in';
  submit.type = 'submit'; submit.disabled = state.status === 'loading';
  if (state.status === 'loading') submit.setAttribute('aria-busy', 'true');
  form.append(submit);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void controller[signup?'signUp':'signIn']({ email: email.value, password: password.value, ...(signup?{role:accountType.value}:{}) });
  });
  card.append(form);
  if(state.signupMessage)card.append(el('p','notice',state.signupMessage));
  if(!state.mock){const toggle=el('button','button button-secondary',signup?'Back to sign in':'Create an account');toggle.onclick=()=>controller.toggleSignup();card.append(toggle);if(signup){password.minLength=8;password.autocomplete='new-password';const resend=el('button','button button-quiet','Resend confirmation email');resend.onclick=()=>controller.resendConfirmation(email.value);card.append(resend);}}

  const layouts = el('a', 'layout-entry', 'Explore the nine Figma layouts');
  layouts.href = '/?layout=parent';
  card.append(layouts);
  if (state.mock) card.append(el('p', 'mock-note', MOCK_DISCLOSURE));
  const liveRegion = el('p', 'sr-only', state.status === 'loading' ? 'Signing in' : '');
  liveRegion.setAttribute('aria-live', 'polite');
  card.append(liveRegion);
  main.append(card);
  root.replaceChildren(main);
  if (state.status === 'error') email.focus();
}

function renderShell(root, state, controller) {
  const view = getRoleView(state.user);
  const shell = el('div', `app-shell role-${view.role}`);
  const sidebar = el('aside', 'sidebar');
  sidebar.append(el('div', 'brand-lockup', 'PadalaPocket'));
  sidebar.append(el('div', 'role-chip', view.title));
  const nav = el('nav', 'navigation');
  nav.setAttribute('aria-label', `${view.title} navigation`);
  for (const item of view.navigation) {
    const button = el('button', `nav-item${state.activePage === item ? ' is-active' : ''}`, item);
    button.type = 'button';
    button.setAttribute('aria-current', state.activePage === item ? 'page' : 'false');
    button.addEventListener('click', () => controller.navigate(item));
    nav.append(button);
  }
  sidebar.append(nav);
  const account = el('div', 'sidebar-bottom');
  const layouts = el('a', 'layout-entry', 'Explore Figma layouts');
  layouts.href = '/?layout=parent';
  account.append(layouts);
  if (state.mock) account.append(mockBadge());
  const signOut = el('button', 'button button-quiet signout', 'Sign out');
  signOut.type = 'button'; signOut.addEventListener('click', () => controller.signOut());
  account.append(signOut); sidebar.append(account);

  const main = el('main', 'shell-main');
  const topbar = el('header', 'topbar');
  topbar.append(el('span', 'mobile-brand', 'PadalaPocket'));
  topbar.append(el('span', 'role-chip', view.title));
  const mobileSignOut = el('button', 'button button-quiet mobile-signout', 'Sign out');
  mobileSignOut.type = 'button'; mobileSignOut.addEventListener('click', () => controller.signOut());
  topbar.append(mobileSignOut);
  if (state.mock) topbar.append(mockBadge());
  main.append(topbar);
  const content = el('section', 'page-content');
  content.setAttribute('aria-labelledby', 'page-title');
  const page = getPageTitle(state.activePage || view.navigation[0]);
  content.append(el('p', 'eyebrow', view.title));
  const title = el('h1', 'page-title', page); title.id = 'page-title';
  content.append(title);
  content.append(el('p', 'muted page-description', !state.mock && state.activePage === 'Approvals' ? 'Review purchases that need your decision and track approved payments.' : !state.mock && state.activePage === 'Deposit' ? 'Top up your parent wallet through Velo on Stellar Testnet.' : !state.mock && state.activePage === 'Activity' ? 'Your submitted purchases and private item photos.' : !state.mock && state.activePage === 'Allowance rules' ? 'Manage the rules for future Needs purchases.' : !state.mock && state.user.role === 'parent' ? 'Distribute allowance into Needs and Wants on Stellar Testnet. Peso amounts are simulated.' : !state.mock && state.user.role === 'student' ? 'Submit a product photo and price, then track the real purchase status.' : view.message));
  if(!state.mock && state.user.walletReady===false){renderFamilySetup(content,state,controller);main.append(content);shell.append(sidebar,main);root.replaceChildren(shell);return;}
  const dashboardOnly = !state.mock && renderDashboard(content,state,controller);
  if (!state.mock && (renderWeekly(content,state,controller) || renderUnavailable(content,state,controller) || dashboardOnly || renderFamilyPage(content, state, controller))) {
    // The family view owns its loaded/empty/error states.
  } else if (!state.mock && state.user.role === 'parent') {
    const panel = el('div', 'preview-panel');
    panel.append(el('h2', '', 'Distribute allowance'));
    if (state.familyRules) { const settings = state.familyRules.settings; panel.append(el('p', '', `Distribute ₱${Number(settings.weeklyAmountMinor)/100} (simulated): ${settings.needsPercent}% Needs · ${100-settings.needsPercent}% Wants. Uses your saved allowance settings.`)); }
    if (state.funding) {
      panel.append(el('p', '', `Confirmed allocations — Needs: ${Number(state.funding.confirmedNeedsStroops) / 10000000} XLM · Wants: ${Number(state.funding.confirmedWantsStroops??0)/10000000} XLM (Testnet)`));
      const history = el('details','live-funding-history'); history.append(el('summary','',`Allocation history (${state.funding.operations.length})`)); panel.append(history);
      for (const operation of state.funding.operations) {
        history.append(el('p', '', `Funding status: ${operation.status}`));
        history.append(el('p', '', `Needs: ${Number(operation.amountStroops)/10000000} XLM · Wants: ${Number(operation.wantsStroops??0)/10000000} XLM`));
        if (operation.wantsTransactionHash) history.append(el('p', '', `Wants transaction: ${operation.wantsTransactionHash}`));
        if (operation.transactionHash) history.append(el('p', '', `Transaction: ${operation.transactionHash}`));
      }
    }
    if (state.fundingError) panel.append(el('p', '', state.fundingError));
    const fund = el('button', 'button button-primary', state.fundingBusy ? 'Funding…' : 'Distribute to Needs and Wants');
    fund.type = 'button'; fund.disabled = Boolean(state.fundingBusy || !state.familyRules || state.funding?.operations.some(op=>['processing','unknown'].includes(op.status)));
    fund.addEventListener('click', () => controller.fundNeeds()); panel.append(fund);
    const refresh = el('button', 'button button-secondary', 'Refresh funding status');
    refresh.type = 'button'; refresh.addEventListener('click', () => controller.refreshFunding()); panel.append(refresh);
    const dashboard=content.querySelector('.live-dashboard');
    if(dashboard)dashboard.insertBefore(panel,dashboard.querySelector('.live-rules-summary'));else content.append(panel);
  } else if (!state.mock && state.user.role === 'student') {
    const panel = el('section', 'preview-panel');
    panel.append(el('h2', '', 'Pay the demo seller'));
    panel.append(el('p', '', 'Choose your Needs or Wants balance. Peso amounts are simulated; payments use Stellar Testnet.'));
    const available = state.purchaseHistory?.availableNeedsStroops;
    if (available !== undefined) panel.append(el('p', '', `Available Needs: ${Number(available) / 10000000} Testnet XLM`));
    if (state.purchaseHistory?.availableWantsStroops !== undefined) panel.append(el('p', '', `Available Wants: ${Number(state.purchaseHistory.availableWantsStroops)/10000000} Testnet XLM.`));
    const rules = state.purchaseHistory?.rules;
    if (rules) panel.append(el('p', '', `Purchase limit: ₱${Number(rules.capMinor) / 100}. Allowed: ${rules.allowedCategories.join(', ').replaceAll('_', ' ')}.`));
    const form = el('form', 'signin-form');
    const bucketLabel = el('label', 'field-label', 'Pay from');
    const bucket = el('select', 'field-input'); bucket.name = 'bucket'; bucket.disabled = Boolean(state.purchaseBusy);
    for (const [value, title] of [['needs','Needs'],['wants','Wants']]) { const option = el('option', '', title); option.value = value; bucket.append(option); }
    bucketLabel.append(bucket); form.append(bucketLabel);
    if (state.purchaseHistory?.wantsRules) panel.append(el('p', '', `Wants allowed: ${state.purchaseHistory.wantsRules.allowedCategories.join(', ').replaceAll('_',' ') || 'No categories selected; parent review required'}.`));
    const photoLabel = el('label', 'field-label', 'Product photo (PNG or JPEG, up to 2 MiB)');
    const photo = el('input', 'field-input'); photo.type = 'file'; photo.accept = 'image/png,image/jpeg'; photo.hidden = true; photoLabel.append(photo);
    const choosePhoto = el('button', 'camera-trigger', 'Choose a photo'); choosePhoto.type = 'button'; choosePhoto.addEventListener('click', () => photo.click());
    let selectedPhoto;
    const photoSelection = el('p', 'photo-selection', 'Take a photo of the item. If the camera does not work during the demo, choose a photo instead.'); photoSelection.setAttribute('role', 'status');
    photo.addEventListener('change', () => { selectedPhoto = photo.files[0]; photoSelection.textContent = selectedPhoto ? `Selected: ${selectedPhoto.name}` : 'Choose a photo or use the camera.'; });
    const camera = createCameraButton({ onPhoto(file) { selectedPhoto = file; photo.value = ''; photoSelection.textContent = 'Camera photo selected. Submit purchase when you are ready.'; }, onError(message) { photoSelection.textContent = message; } });
    const priceLabel = el('label', 'field-label', 'Price in simulated pesos');
    const price = el('input', 'field-input'); price.type = 'text'; price.inputMode = 'decimal'; price.required = true; price.placeholder = '0.00'; priceLabel.append(price);
    const submit = el('button', 'button button-primary', state.purchaseBusy ? 'Checking purchase…' : 'Submit purchase');
    submit.type = 'submit'; submit.disabled = Boolean(state.purchaseBusy || state.purchaseHistory?.purchases.some(p => !['blocked','claimed','failed','rejected','expired'].includes(p.status)));
    const photoActions = el('div', 'photo-actions'); photoActions.append(camera, choosePhoto);
    form.append(photoLabel, photoActions, photoSelection, priceLabel, submit); form.addEventListener('submit', event => { event.preventDefault(); if (!selectedPhoto) { photoSelection.textContent = 'Take or choose a product photo first.'; return; } void controller.submitPurchase(selectedPhoto, price.value, bucket.value); }); panel.append(form);
    if (state.purchaseError) { const error = el('p', '', state.purchaseError); error.setAttribute('role', 'alert'); panel.append(error); }
    const refresh = el('button', 'button button-secondary', 'Refresh purchase status'); refresh.type = 'button'; refresh.addEventListener('click', () => controller.refreshPurchases()); panel.append(refresh);
    for (const purchase of state.purchaseHistory?.purchases || []) {
      const card = el('article', 'preview-panel'); card.append(el('h3', '', `${purchase.bucket === 'wants' ? 'Wants' : 'Needs'} purchase: ${purchase.status}`));
      card.append(el('p', '', `Simulated ₱${Number(purchase.priceMinor) / 100} · ${Number(purchase.amountStroops) / 10000000} Testnet XLM`));
      if (purchase.ai) card.append(el('p', '', `AI identification: ${purchase.ai.productName || 'Unclear'} · ${purchase.ai.category.replaceAll('_', ' ')}`));
      if(purchase.approvalDeadline)card.append(el('p','',`Parent decision deadline: ${new Date(purchase.approvalDeadline).toLocaleString()}`));
      if(purchase.parentDecision)card.append(el('p','',`Parent decision: ${purchase.parentDecision.decision}. Payment confirmation is tracked separately.`));
      if (purchase.reason) card.append(el('p', '', purchase.reason.replaceAll('_', ' ')));
      for (const [stage, tx] of Object.entries(purchase.transactions)) card.append(el('p', 'transaction-evidence', `${stage}: ${tx.hash}`));
      if (purchase.status === 'merchant_pending') { const claim = el('button', 'button button-primary', 'Claim for demo seller'); claim.type = 'button'; claim.disabled = Boolean(state.purchaseBusy); claim.addEventListener('click', () => controller.claimPurchase(purchase.id)); card.append(claim); }
      panel.append(card);
    }
    content.append(panel);
  } else if (state.status === 'loading') {
    const loading = el('div', 'preview-panel loading-panel');
    loading.setAttribute('role', 'status');
    loading.setAttribute('aria-live', 'polite');
    loading.append(el('span', 'spinner'));
    loading.append(document.createTextNode('Loading sample service response…'));
    content.append(loading);
    const loadingButton = el('button', 'button button-secondary', 'Loading sample…');
    loadingButton.type = 'button'; loadingButton.disabled = true; loadingButton.setAttribute('aria-busy', 'true');
    content.append(loadingButton);
  } else if (state.error) {
    const notice = errorNotice(state.error, 'Sample service error');
    if (notice) content.append(notice);
    const dismiss = el('button', 'button button-secondary', 'Return to shell preview');
    dismiss.type = 'button'; dismiss.addEventListener('click', () => controller.dismissError());
    content.append(dismiss);
  } else {
    content.append(el('div', 'preview-panel', 'No account data is connected in this shell preview.'));
    const errorButton = el('button', 'button button-secondary', 'Preview a sample service error');
    errorButton.type = 'button'; errorButton.addEventListener('click', () => controller.triggerExampleError());
    if (state.mock) content.append(errorButton);
  }
  main.append(content);
  shell.append(sidebar, main);
  root.replaceChildren(shell);
}

export function renderApp(root, state, controller) {
  clearFamilyPhotos();
  if (state.screen === 'shell' && state.user) renderShell(root, state, controller);
  else if(state.screen==='setup')renderAccountSetup(root,state,controller);
  else renderSignIn(root, state, controller);
}
