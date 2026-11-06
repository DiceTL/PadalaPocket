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
const api = createApiClient({ mode: mockMode ? 'mock' : 'live', identityFixtureName });
const auth = createAuthBoundary({ mode: mockMode ? 'mock' : 'live', api });
const controller = createAppController({ auth, api });
const root = document.querySelector('#app');

controller.subscribe((state) => renderApp(root, state, controller));
