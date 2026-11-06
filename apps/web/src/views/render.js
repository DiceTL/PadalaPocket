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
  else card.append(el('span', 'mock-badge unavailable-badge', 'Live authentication is not connected'));
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
  else {
    card.append(el('p', 'mock-note', 'Sign-in is unavailable until the live authentication integration is implemented.'));
    submit.disabled = true;
    submit.textContent = 'Sign-in unavailable';
  }
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
  content.append(el('p', 'muted page-description', view.message));
  if (state.status === 'loading') {
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
    content.append(errorButton);
  }
  main.append(content);
  shell.append(sidebar, main);
  root.replaceChildren(shell);
}

export function renderApp(root, state, controller) {
  if (state.screen === 'shell' && state.user) renderShell(root, state, controller);
  else renderSignIn(root, state, controller);
}
