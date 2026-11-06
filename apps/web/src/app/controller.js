const MOCK_FEEDBACK_DELAY_MS = 400;

export function createAppController({ auth, api }) {
  const mockMode = auth.mode === 'mock';
  let state = { screen: 'signin', status: 'idle', user: null, error: null, activePage: null, mock: mockMode };
  const listeners = new Set();
  let pending = false;

  const getState = () => ({ ...state, user: state.user && { ...state.user } });
  const publish = () => listeners.forEach((listener) => listener(getState()));

  return {
    getState,
    subscribe(listener) {
      listeners.add(listener);
      listener(getState());
      return () => listeners.delete(listener);
    },
    async signIn(credentials) {
      if (pending) return;
      pending = true;
      state = { ...state, status: 'loading', error: null };
      publish();
      try {
        // Mock-only delay makes the loading state observable; it is not live network timing.
        if (mockMode) await new Promise((resolve) => setTimeout(resolve, MOCK_FEEDBACK_DELAY_MS));
        const result = await auth.signIn(credentials);
        state = { screen: 'shell', status: 'ready', user: result.user, error: null, activePage: result.user.role === 'parent' ? 'Overview' : 'Home', mock: result.mock };
      } catch (error) {
        state = { ...state, screen: 'signin', status: 'error', error: { code: error.code || 'SIGN_IN_FAILED', message: error.message, retryable: Boolean(error.retryable) } };
      } finally {
        pending = false;
        publish();
      }
    },
    async triggerExampleError(name) {
      state = { ...state, status: 'loading', error: null };
      publish();
      try {
        if (mockMode) await new Promise((resolve) => setTimeout(resolve, MOCK_FEEDBACK_DELAY_MS));
        await api.injectExampleError(name);
      } catch (error) {
        state = { ...state, status: 'error', error: { code: error.code, message: error.message, retryable: error.retryable } };
      }
      publish();
    },
    dismissError() {
      state = { ...state, status: 'ready', error: null };
      publish();
    },
    navigate(page) {
      state = { ...state, status: 'ready', activePage: page, error: null };
      publish();
    },
    async signOut() {
      await auth.signOut?.();
      state = { screen: 'signin', status: 'idle', user: null, error: null, activePage: null, mock: mockMode };
      publish();
    },
  };
}
