export function createAuthBoundary({ mode = 'mock', api, supabase }) {
  return {
    mode,
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
        catch (error) { await supabase.auth.signOut({ scope: 'local' }); throw error; }
      }
      // Deliberately do not validate, retain, or transmit mock credentials.
      return { mock: true, user: await api.getMe() };
    },
  };
}
