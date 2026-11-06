import { getPageTitle, getRoleView, MOCK_BADGE_TEXT, MOCK_DISCLOSURE } from './model.js';

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
  const signinHeading = el('h2', 'signin-heading', 'Sign in');
  signinHeading.id = 'signin-title';
  card.append(signinHeading);
  card.append(el('p', 'muted intro', 'Your account decides whether you see the parent or student view.'));

  const form = el('form', 'signin-form');
  form.noValidate = true;
  const emailLabel = el('label', 'field-label', 'Email address');
  emailLabel.htmlFor = 'email';
  const email = el('input', 'field-input');
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
  } else submit.textContent = 'Sign in';
  submit.type = 'submit'; submit.disabled = state.status === 'loading';
  if (state.status === 'loading') submit.setAttribute('aria-busy', 'true');
  form.append(submit);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void controller.signIn({ email: email.value, password: password.value });
  });
  card.append(form);
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
  for (const item of state.mock ? view.navigation : view.navigation.filter(item => item === (state.user.role === 'parent' ? 'Overview' : 'Home'))) {
    const button = el('button', `nav-item${state.activePage === item ? ' is-active' : ''}`, item);
    button.type = 'button';
    button.setAttribute('aria-current', state.activePage === item ? 'page' : 'false');
    button.addEventListener('click', () => controller.navigate(item));
    nav.append(button);
  }
  sidebar.append(nav);
  const account = el('div', 'sidebar-bottom');
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
  content.append(el('p', 'muted page-description', !state.mock && state.user.role === 'parent' ? 'Needs funding on Stellar Testnet. Peso amounts are simulated.' : !state.mock && state.user.role === 'student' ? 'Submit a product photo and price, then track the real purchase status.' : view.message));
  if (!state.mock && state.user.role === 'parent') {
    const panel = el('div', 'preview-panel');
    panel.append(el('h2', '', 'Student Needs funding'));
    panel.append(el('p', '', 'Fund simulated ₱9.68 · 1 Testnet XLM'));
    if (state.funding) {
      panel.append(el('p', '', `Confirmed funding credits: ${Number(state.funding.confirmedNeedsStroops) / 10000000} Testnet XLM`));
      for (const operation of state.funding.operations) {
        panel.append(el('p', '', `Funding status: ${operation.status}`));
        if (operation.transactionHash) panel.append(el('p', '', `Transaction: ${operation.transactionHash}`));
      }
    }
    if (state.fundingError) panel.append(el('p', '', state.fundingError));
    const fund = el('button', 'button button-primary', state.fundingBusy ? 'Funding…' : 'Fund Needs');
    fund.type = 'button'; fund.disabled = Boolean(state.fundingBusy || state.funding?.operations.length);
    fund.addEventListener('click', () => controller.fundNeeds()); panel.append(fund);
    const refresh = el('button', 'button button-secondary', 'Refresh funding status');
    refresh.type = 'button'; refresh.addEventListener('click', () => controller.refreshFunding()); panel.append(refresh);
    content.append(panel);
  } else if (!state.mock && state.user.role === 'student') {
    const panel = el('section', 'preview-panel');
    panel.append(el('h2', '', 'Pay the demo seller'));
    panel.append(el('p', '', 'Use your Needs balance. Peso amounts are simulated; payments use Stellar Testnet.'));
    const available = state.purchaseHistory?.availableNeedsStroops;
    if (available !== undefined) panel.append(el('p', '', `Available Needs: ${Number(available) / 10000000} Testnet XLM`));
    const rules = state.purchaseHistory?.rules;
    if (rules) panel.append(el('p', '', `Purchase limit: ₱${Number(rules.capMinor) / 100}. Allowed: ${rules.allowedCategories.join(', ').replaceAll('_', ' ')}.`));
    const form = el('form', 'signin-form');
    const photoLabel = el('label', 'field-label', 'Product photo (PNG or JPEG, up to 2 MiB)');
    const photo = el('input', 'field-input'); photo.type = 'file'; photo.accept = 'image/png,image/jpeg'; photo.required = true; photoLabel.append(photo);
    const priceLabel = el('label', 'field-label', 'Price in simulated pesos');
    const price = el('input', 'field-input'); price.type = 'text'; price.inputMode = 'decimal'; price.required = true; price.placeholder = '0.00'; priceLabel.append(price);
    const submit = el('button', 'button button-primary', state.purchaseBusy ? 'Checking purchase…' : 'Submit purchase');
    submit.type = 'submit'; submit.disabled = Boolean(state.purchaseBusy || state.purchaseHistory?.purchases.some(p => !['blocked','claimed','failed'].includes(p.status)));
    form.append(photoLabel, priceLabel, submit); form.addEventListener('submit', event => { event.preventDefault(); void controller.submitPurchase(photo.files[0], price.value); }); panel.append(form);
    if (state.purchaseError) { const error = el('p', '', state.purchaseError); error.setAttribute('role', 'alert'); panel.append(error); }
    const refresh = el('button', 'button button-secondary', 'Refresh purchase status'); refresh.type = 'button'; refresh.addEventListener('click', () => controller.refreshPurchases()); panel.append(refresh);
    for (const purchase of state.purchaseHistory?.purchases || []) {
      const card = el('article', 'preview-panel'); card.append(el('h3', '', `Purchase: ${purchase.status}`));
      card.append(el('p', '', `Simulated ₱${Number(purchase.priceMinor) / 100} · ${Number(purchase.amountStroops) / 10000000} Testnet XLM`));
      if (purchase.ai) card.append(el('p', '', `AI identification: ${purchase.ai.productName || 'Unclear'} · ${purchase.ai.category.replaceAll('_', ' ')}`));
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
  if (state.screen === 'shell' && state.user) renderShell(root, state, controller);
  else renderSignIn(root, state, controller);
}
