const MOCK_FEEDBACK_DELAY_MS = 400;

export function createAppController({ auth, api }) {
  const mockMode = auth.mode === 'mock';
  let state = { screen: 'signin', status: 'idle', user: null, error: null, activePage: null, mock: mockMode };
  const listeners = new Set();
  let pending = false;
  let sessionEpoch = 0;

  const currentSession = (epoch, userId) => epoch === sessionEpoch && state.screen === 'shell' && state.user?.userId === userId;

  const getState = () => ({ ...state, user: state.user && { ...state.user } });
  const publish = () => listeners.forEach((listener) => listener(getState()));

  async function loadFunding() {
    if (!mockMode && state.user?.role === 'parent') {
      const epoch = sessionEpoch, userId = state.user.userId;
      try { const funding = await api.funding(); if (!currentSession(epoch, userId)) return; state = { ...state, funding, fundingError: null }; }
      catch (e) { if (!currentSession(epoch, userId)) return; state = { ...state, fundingError: e.message }; }
      publish();
    }
  }
  async function loadPurchases() {
    if (!mockMode && api.mode === 'live' && state.user?.role === 'student') {
      const epoch = sessionEpoch, userId = state.user.userId;
      try { const purchaseHistory = await api.purchases(); if (!currentSession(epoch, userId)) return; state = { ...state, purchaseHistory, purchaseError: null }; }
      catch (e) { if (!currentSession(epoch, userId)) return; state = { ...state, purchaseError: e.message }; }
      publish();
    }
  }
  return {
    getState,
    refreshPurchases: loadPurchases,
    async submitPurchase(file, price) {
      if (state.purchaseBusy || !file) return;
      const epoch = sessionEpoch, userId = state.user?.userId;
      state = { ...state, purchaseBusy: true, purchaseError: null }; publish();
      try {
        if (!['image/png','image/jpeg'].includes(file.type) || file.size > 2097152) throw Error('Choose a PNG or JPEG up to 2 MiB.');
        if (!/^\d+(?:\.\d{1,2})?$/.test(price)) throw Error('Enter a peso price with at most two decimal places.');
        const [whole, fraction = ''] = price.split('.');
        const priceMinor = (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))).toString();
        const photoBase64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
        const payload = { sellerId: 'demo-seller', priceMinor, mime: file.type, photoBase64 };
        const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)))), b => b.toString(16).padStart(2, '0')).join('');
        const storageKey = 'purchaseRequest:' + state.user.userId;
        const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
        const priorTerminal = state.purchaseHistory?.purchases.some(p => p.requestKey === saved?.key && p.status === 'blocked');
        const key = saved?.digest === digest && !priorTerminal ? saved.key : crypto.randomUUID();
        localStorage.setItem(storageKey, JSON.stringify({ digest, key }));
        await api.purchases('POST', payload, key); if (!currentSession(epoch, userId)) return; await loadPurchases();
      } catch (e) { if (currentSession(epoch, userId)) state = { ...state, purchaseError: e.message }; }
      finally { if (currentSession(epoch, userId)) { state = { ...state, purchaseBusy: false }; publish(); } }
    },
    async claimPurchase(id) {
      if (state.purchaseBusy) return;
      const epoch = sessionEpoch, userId = state.user?.userId;
      state = { ...state, purchaseBusy: true }; publish();
      try { await api.purchases('POST', {}, undefined, '/' + id + '/claim'); if (!currentSession(epoch, userId)) return; await loadPurchases(); }
      catch (e) { if (currentSession(epoch, userId)) state = { ...state, purchaseError: e.message }; }
      finally { if (currentSession(epoch, userId)) { state = { ...state, purchaseBusy: false }; publish(); } }
    },
    async restore() {
      if (mockMode) return;
      const epoch = ++sessionEpoch;
      try { const user = await api.getMe(); if (epoch !== sessionEpoch) return; state = { ...state, screen: 'shell', status: 'ready', user, activePage: user.role === 'parent' ? 'Overview' : 'Home' }; publish(); await loadFunding(); await loadPurchases(); } catch {}
    },
    refreshFunding: loadFunding,
    async fundNeeds() {
      if (state.fundingBusy) return;
      const epoch = sessionEpoch, userId = state.user?.userId;
      const key = localStorage.getItem('needsFundingKey') || crypto.randomUUID();
      localStorage.setItem('needsFundingKey', key);
      state = { ...state, fundingBusy: true, fundingError: null }; publish();
      try { await api.funding('POST', key); if (!currentSession(epoch, userId)) return; await loadFunding(); await loadPurchases(); }
      catch (e) { if (currentSession(epoch, userId)) state = { ...state, fundingError: e.message }; }
      finally { if (currentSession(epoch, userId)) { state = { ...state, fundingBusy: false }; publish(); } }
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(getState());
      return () => listeners.delete(listener);
    },
    async signIn(credentials) {
      if (pending) return;
      const epoch = ++sessionEpoch;
      pending = true;
      state = { ...state, status: 'loading', error: null };
      publish();
      try {
        // Mock-only delay makes the loading state observable; it is not live network timing.
        if (mockMode) await new Promise((resolve) => setTimeout(resolve, MOCK_FEEDBACK_DELAY_MS));
        const result = await auth.signIn(credentials);
        if (epoch !== sessionEpoch) return;
        state = { screen: 'shell', status: 'ready', user: result.user, error: null, activePage: result.user.role === 'parent' ? 'Overview' : 'Home', mock: result.mock };
        await loadFunding(); await loadPurchases();
      } catch (error) {
        if (epoch !== sessionEpoch) return;
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
      ++sessionEpoch;
      state = { screen: 'signin', status: 'idle', user: null, error: null, activePage: null, mock: mockMode };
      publish();
      await auth.signOut?.();
    },
  };
}
