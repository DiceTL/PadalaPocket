import { createClient } from '@supabase/supabase-js';
import './styles.css';
import { createApiClient } from './client/api.js';
import { createAuthBoundary } from './auth/auth-boundary.js';
import { createAppController } from './app/controller.js';
import { renderApp } from './views/render.js';
import { renderLayoutPage, requestedLayout } from './layouts/pages.js';

const mockMode = import.meta.env.DEV && import.meta.env.VITE_APP_MODE === 'mock';
const requestedIdentity = import.meta.env.VITE_MOCK_IDENTITY;
const identityFixtureName = ['parent-identity', 'student-identity'].includes(requestedIdentity)
  ? requestedIdentity
  : 'parent-identity';
const supabase = !mockMode && import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: true } }) : null;
const api = createApiClient({ mode: mockMode ? 'mock' : 'live', identityFixtureName, getAccessToken: async () => (await supabase?.auth.getSession())?.data.session?.access_token });
const auth = createAuthBoundary({ mode: mockMode ? 'mock' : 'live', api, supabase });
const controller = createAppController({ auth, api });
const root = document.querySelector('#app');

// Existing layout bookmarks now open their connected page. Design samples require explicit opt-in.
const address = new URL(location.href);
if (address.searchParams.has('layout') && address.searchParams.get('preview') !== 'design') {
  const routes = {home:'Home',parent:'Overview','parent-rules':'Allowance rules',approvals:'Approvals','parent-activity':'Activity','purchase-status':'Activity',pay:'Pay a seller',savings:'Savings','parent-savings':'Savings','my-money':'My Money',recap:'Week-end recap',withdrawal:'Withdrawal','parent-deposit':'Deposit'};
  const page=routes[address.searchParams.get('layout')];address.searchParams.delete('layout');if(page)address.searchParams.set('page',page);history.replaceState({},'',address);
}

controller.subscribe((state) => {
  if (!renderLayoutPage(root)) renderApp(root, state, controller);
});

if (requestedLayout() === null) void controller.restore();

window.addEventListener('popstate',()=>{ const state=controller.getState(); if(state.user)controller.navigate(new URLSearchParams(location.search).get('page') || (state.user.role==='parent'?'Overview':'Home'),false); });
