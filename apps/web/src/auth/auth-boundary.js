export function createAuthBoundary({ mode = 'mock', api, supabase }) {
  return {
    mode,
    async signUp({email,password}) {
      if(!supabase)throw Error('Signup service unavailable.');
      if(!email?.trim() || typeof password!=='string' || password.length<8)throw Error('Enter your email and a password of at least 8 characters.');
      const {error}=await supabase.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:location.origin+'/'}});
      if(error)throw Error(error.message);
      return {message:'Check your email to confirm your account, then sign in. If you already have an account, sign in instead.'};
    },
    async resend(email){if(!supabase)throw Error('Signup service unavailable.');const {error}=await supabase.auth.resend({type:'signup',email:email.trim(),options:{emailRedirectTo:location.origin+'/'}});if(error)throw Error(error.message);},
    async signOut() { if (supabase) await supabase.auth.signOut({ scope: 'local' }); },
    async signIn({ email, password }) {
      if (!email?.trim() || !password) {
        const error = new Error('Enter your email and password to continue.');
        error.code = 'INVALID_INPUT';
        throw error;
      }
      if (mode !== 'mock') {
        if (!supabase) throw new Error('Sign-in service is unavailable.');
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw new Error('Sign-in failed. Check your details and try again.');
        try { return { mock: false, user: await api.getMe() }; }
        catch (error) { if(error.code==='ACCOUNT_SETUP_REQUIRED')return {needsSetup:true}; await supabase.auth.signOut({ scope: 'local' }); throw error; }
      }
      // Deliberately do not validate, retain, or transmit mock credentials.
      return { mock: true, user: await api.getMe() };
    },
  };
}
