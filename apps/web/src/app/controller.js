const MOCK_FEEDBACK_DELAY_MS = 400;

export function createAppController({ auth, api }) {
  const mockMode = auth.mode === 'mock';
  let state = { screen: 'signin', status: 'idle', user: null, error: null, activePage: null, mock: mockMode };
  const listeners = new Set();
  let pending = false;
  let sessionEpoch = 0;

  const currentSession = (epoch, userId) => epoch === sessionEpoch && state.screen === 'shell' && state.user?.userId === userId;

  const initialPage = (user, requested=typeof location !== 'undefined'?new URLSearchParams(location.search).get('page'):null) => { const allowed=user.role==='parent'?['Overview','Allowance rules','Approvals','Activity','Savings','Deposit','Withdrawal']:['Home','Pay a seller','Activity','Savings','My Money','Week-end recap']; return allowed.includes(requested)?requested:allowed[0]; };
  const getState = () => ({ ...state, user: state.user && { ...state.user } });
  const publish = () => listeners.forEach((listener) => listener(getState()));

  async function loadTopups() {
    if (mockMode || state.user?.role !== 'parent' || !api.veloTopups) return;
    const epoch = sessionEpoch, userId = state.user.userId;
    try { const topups = await api.veloTopups(); if (currentSession(epoch,userId)) state = { ...state, topups, topupError: null }; }
    catch(e) { if (currentSession(epoch,userId)) state = { ...state, topupError: e.message }; }
    if (currentSession(epoch,userId)) publish();
  }
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
  async function loadFamily() {
    if (mockMode || !state.user) return;
    const epoch = sessionEpoch, userId = state.user.userId;
    const jobs = [];
    if(state.user.role==='parent' && api.accountAction)jobs.push((async()=>{try{const result=await api.accountAction('status');if(currentSession(epoch,userId))state={...state,studentLinked:result.studentLinked};}catch{}})());
    if(state.user.role==='parent' && api.approvals)jobs.push((async()=>{try{const approvals=await api.approvals();if(currentSession(epoch,userId))state={...state,approvals,approvalError:null};}catch(e){if(currentSession(epoch,userId))state={...state,approvalError:e.message};}})());
    if (state.user.role === 'parent' && typeof api.veloTopups === 'function') jobs.push(loadTopups());
    for (const [method, field, errorField] of [['weekly','weekly','weeklyError'],['familyRules','familyRules','rulesError'],['activity','activity','activityError']]) {
      if (typeof api[method] !== 'function') continue;
      jobs.push((async () => {
        try { const value = await api[method](); if (currentSession(epoch, userId)) state = { ...state, [field]: value, [errorField]: null }; }
        catch (error) { if (currentSession(epoch, userId)) state = { ...state, [errorField]: error.message }; }
      })());
    }
    if (!jobs.length) return;
    await Promise.all(jobs); if (currentSession(epoch, userId)) publish();
  }
  return {
    getState,
    reportAuthError(){state={...state,screen:'signin',status:'error',error:{message:'The confirmation link is invalid or expired. Request another confirmation email from Create an account.'}};publish();},
    toggleSignup(){state={...state,authMode:state.authMode==='signup'?'signin':'signup',error:null,signupMessage:null};publish();},
    async signUp(credentials){if(pending)return;pending=true;const epoch=sessionEpoch;state={...state,status:'loading',error:null,signupEmail:credentials.email,signupRole:credentials.role};publish();try{const result=await auth.signUp(credentials);if(epoch===sessionEpoch)state={...state,status:'ready',signupMessage:result.message};}catch(e){if(epoch===sessionEpoch)state={...state,status:'error',error:{message:e.message}};}finally{pending=false;if(epoch===sessionEpoch)publish();}},
    async resendConfirmation(email){if(pending)return;pending=true;const epoch=sessionEpoch;try{await auth.resend(email,state.signupRole);if(epoch!==sessionEpoch)return;state={...state,signupMessage:'Confirmation requested. Check your inbox.',error:null};}catch(e){state={...state,error:{message:e.message}};}finally{pending=false;publish();}},
    async enrollAccount(role,code){if(pending)return;pending=true;const epoch=sessionEpoch;state={...state,status:'loading',error:null};publish();try{await api.accountAction('enroll',role==='student'?{role,code}:{role});const user=await api.getMe();if(epoch!==sessionEpoch)return;state={screen:'shell',status:'ready',user,activePage:initialPage(user),mock:false};await loadFunding();await loadPurchases();await loadFamily();}catch(e){if(epoch===sessionEpoch)state={...state,status:'error',error:{message:e.message}};}finally{pending=false;if(epoch===sessionEpoch)publish();}},
    async createStudentCode(email){if(state.accountBusy)return;const epoch=sessionEpoch;state={...state,accountBusy:true,accountError:null};publish();try{const result=await api.accountAction('student-code',{email});if(epoch===sessionEpoch)state={...state,studentCode:result.code};}catch(e){if(epoch===sessionEpoch)state={...state,accountError:e.message};}finally{if(epoch===sessionEpoch){state={...state,accountBusy:false};publish();}}},
    async saveWeeklySchedule(weekday,time) {
      if(state.weeklyBusy || !state.weekly)return;
      const epoch=sessionEpoch,userId=state.user?.userId;
      state={...state,weeklyBusy:true,weeklyError:null};publish();
      try{await api.weekly('PUT',{weekday,time,expectedRevision:state.weekly.clock.revision});if(currentSession(epoch,userId))await loadFamily();}
      catch(e){if(currentSession(epoch,userId))state={...state,weeklyError:e.message};}
      finally{if(currentSession(epoch,userId)){state={...state,weeklyBusy:false};publish();}}
    },
    async advanceWeek() {
      if(state.weeklyBusy || !state.weekly || state.user?.role!=='parent')return;
      const epoch=sessionEpoch,userId=state.user.userId,storageKey='weeklyAdvance:'+userId;
      const active=state.weekly.events.find(e=>['processing','unknown'].includes(e.status));
      const saved=active?{key:active.id,revision:state.weekly.clock.revision}:JSON.parse(localStorage.getItem(storageKey)||'null') || {key:crypto.randomUUID(),revision:state.weekly.clock.revision};
      localStorage.setItem(storageKey,JSON.stringify(saved));state={...state,weeklyBusy:true,weeklyError:null};publish();
      try{
        for(let i=0;i<8;i++){
          if(!currentSession(epoch,userId))return;
          const result=await api.weekly('POST',{expectedRevision:saved.revision},saved.key);
          await loadFamily();
          if(['confirmed','allocation_skipped'].includes(result.status)){localStorage.removeItem(storageKey);break;}
          if(result.stageStarted || result.status==='unknown')break;
        }
        await loadFunding();await loadPurchases();
      }catch(e){if(!active && ['CLOCK_CHANGED','RULES_CHANGED'].includes(e.code)){localStorage.removeItem(storageKey);await loadFamily();}if(currentSession(epoch,userId))state={...state,weeklyError:e.message};}
      finally{if(currentSession(epoch,userId)){state={...state,weeklyBusy:false};publish();}}
    },
    refreshTopups: loadTopups,
    async createTopup() {
      if (state.topupBusy || !state.familyRules || state.user?.role !== 'parent') return;
      const epoch=sessionEpoch, userId=state.user.userId;
      const storageKey='veloTopup:'+userId;
      let saved; try { saved=JSON.parse(localStorage.getItem(storageKey)); } catch {}
      saved ||= { key:crypto.randomUUID(), revision:state.familyRules.revision };
      localStorage.setItem(storageKey,JSON.stringify(saved));
      state={...state,topupBusy:true,topupError:null};publish();
      try { await api.veloTopups('POST',saved.key,saved.revision); localStorage.removeItem(storageKey); await loadTopups(); }
      catch(e) { if(e.code==='RULES_CHANGED')localStorage.removeItem(storageKey); if(currentSession(epoch,userId))state={...state,topupError:e.message}; }
      finally { if(currentSession(epoch,userId)){state={...state,topupBusy:false};publish();} }
    },
    refreshFamily: loadFamily,
    async decidePurchase(id,decision,binding) {
      if(state.approvalBusy || state.user?.role!=='parent')return;
      const epoch=sessionEpoch,userId=state.user.userId;
      state={...state,approvalBusy:id,approvalError:null};publish();
      try{
        let result=decision==='continue'?await api.executeApproval(id):await api.approvals(id,decision,binding);
        for(let stage=0;stage<7 && result.parentDecision?.decision==='approve' && ['approved','exception_pending'].includes(result.status) && !result.executionStarted;stage++){
          if(!currentSession(epoch,userId))return;
          state={...state,approvals:{purchases:state.approvals.purchases.map(p=>p.id===id?result:p)}};publish();
          result=await api.executeApproval(id);
        }
        if(currentSession(epoch,userId))await loadFamily();
      }
      catch(e){if(currentSession(epoch,userId))state={...state,approvalError:e.message+' Refresh status before trying another action.'};}
      finally{if(currentSession(epoch,userId)){state={...state,approvalBusy:null};publish();}}
    },
    fetchPurchasePhoto: (id, signal) => api.purchasePhoto(id, signal),
    async saveFamilyRules(settings) {
      if (state.rulesBusy || state.user?.role !== 'parent' || !state.familyRules) return;
      const epoch = sessionEpoch, userId = state.user.userId;
      state = { ...state, rulesBusy: true, rulesError: null, rulesDraft: settings, rulesSaved: false }; publish();
      try {
        const saved = await api.familyRules(settings, state.familyRules.revision);
        if (!currentSession(epoch, userId)) return;
        state = { ...state, familyRules: { ...state.familyRules, ...saved }, rulesDraft: null, rulesSaved: true };
        await loadPurchases(); await loadFamily();
      } catch (error) { if (currentSession(epoch, userId)) state = { ...state, rulesError: error.code === 'RULES_CHANGED' ? 'Rules changed in another session. Refresh to load the latest version before saving again.' : error.message }; }
      finally { if (currentSession(epoch, userId)) { state = { ...state, rulesBusy: false }; publish(); } }
    },
    refreshPurchases: loadPurchases,
    async submitPurchase(file, price, bucket = 'needs') {
      if (state.purchaseBusy || !file) return;
      const epoch = sessionEpoch, userId = state.user?.userId;
      state = { ...state, purchaseBusy: true, purchaseError: null }; publish();
      try {
        if (!['image/png','image/jpeg'].includes(file.type) || file.size > 2097152) throw Error('Choose a PNG or JPEG up to 2 MiB.');
        if (!/^\d+(?:\.\d{1,2})?$/.test(price)) throw Error('Enter a peso price with at most two decimal places.');
        const [whole, fraction = ''] = price.split('.');
        const priceMinor = (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))).toString();
        const photoBase64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
        const payload = { bucket, sellerId: 'demo-seller', priceMinor, mime: file.type, photoBase64 };
        const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)))), b => b.toString(16).padStart(2, '0')).join('');
        const storageKey = 'purchaseRequest:' + state.user.userId;
        const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
        const priorTerminal = state.purchaseHistory?.purchases.some(p => p.requestKey === saved?.key && ['blocked','rejected','expired'].includes(p.status));
        const key = saved?.digest === digest && !priorTerminal ? saved.key : crypto.randomUUID();
        localStorage.setItem(storageKey, JSON.stringify({ digest, key }));
        await api.purchases('POST', payload, key); if (!currentSession(epoch, userId)) return; await loadPurchases(); await loadFamily();
      } catch (e) { if (currentSession(epoch, userId)) state = { ...state, purchaseError: e.message }; }
      finally { if (currentSession(epoch, userId)) { state = { ...state, purchaseBusy: false }; publish(); } }
    },
    async claimPurchase(id) {
      if (state.purchaseBusy) return;
      const epoch = sessionEpoch, userId = state.user?.userId;
      state = { ...state, purchaseBusy: true }; publish();
      try { await api.purchases('POST', {}, undefined, '/' + id + '/claim'); if (!currentSession(epoch, userId)) return; await loadPurchases(); await loadFamily(); }
      catch (e) { if (currentSession(epoch, userId)) state = { ...state, purchaseError: e.message }; }
      finally { if (currentSession(epoch, userId)) { state = { ...state, purchaseBusy: false }; publish(); } }
    },
    async restore(requestedRole) {
      if (mockMode) return;
      const epoch = ++sessionEpoch;
      try { const user = await api.getMe(); if (epoch !== sessionEpoch) return; state = { ...state, screen: 'shell', status: 'ready', user, activePage: initialPage(user) }; publish(); await loadFunding(); await loadPurchases(); await loadFamily(); } catch(e) {if(epoch===sessionEpoch && e.code==='ACCOUNT_SETUP_REQUIRED'){state={...state,screen:'setup',status:'ready',accountRole:['parent','student'].includes(requestedRole)?requestedRole:null};publish();}}
    },
    refreshFunding: loadFunding,
    async fundNeeds() {
      if (state.fundingBusy || !state.familyRules) return;
      const epoch = sessionEpoch, userId = state.user?.userId;
      const key = localStorage.getItem('allowanceFundingKey:' + userId) || crypto.randomUUID();
      const savedRevision = localStorage.getItem('allowanceFundingRevision:' + userId);
      const allocationRevision = savedRevision === null ? state.familyRules.revision : Number(savedRevision);
      localStorage.setItem('allowanceFundingRevision:' + userId, String(allocationRevision));
      localStorage.setItem('allowanceFundingKey:' + userId, key);
      state = { ...state, fundingBusy: true, fundingError: null }; publish();
      try { const result = await api.funding('POST', key, allocationRevision); if (result.status === 'confirmed' || result.status === 'failed') { localStorage.removeItem('allowanceFundingKey:' + userId); localStorage.removeItem('allowanceFundingRevision:' + userId); } if (!currentSession(epoch, userId)) return; await loadFunding(); await loadPurchases(); await loadFamily(); }
      catch (e) { if (e.code === 'RULES_CHANGED') { localStorage.removeItem('allowanceFundingKey:' + userId); localStorage.removeItem('allowanceFundingRevision:' + userId); } if (currentSession(epoch, userId)) state = { ...state, fundingError: e.message }; }
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
        if(result.needsSetup){const requestedRole=new URLSearchParams(location.search).get('accountType');state={screen:'setup',status:'ready',mock:false,accountRole:['parent','student'].includes(requestedRole)?requestedRole:null};return;}
        state = { screen: 'shell', status: 'ready', user: result.user, error: null, activePage: initialPage(result.user), mock: result.mock };
        await loadFunding(); await loadPurchases(); await loadFamily();
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
    navigate(page, recordHistory = true) {
      if (state.user && initialPage(state.user,page) !== page) return;
      if (!mockMode && recordHistory) { const url=new URL(location.href); url.searchParams.set('page',page); url.searchParams.delete('layout'); history.pushState({},'',url); }
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
