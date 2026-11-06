import { createClient } from '@supabase/supabase-js';
import './styles.css';
import { createApiClient } from './client/api.js';
import { createAuthBoundary } from './auth/auth-boundary.js';
import { createAppController } from './app/controller.js';
import { renderApp } from './views/render.js';

const mockMode = import.meta.env.DEV;
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

controller.subscribe((state) => renderApp(root, state, controller));

void controller.restore();
