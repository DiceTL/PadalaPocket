export function createAuthBoundary({ mode = 'mock', api }) {
  return {
    mode,
    async signIn({ email, password }) {
      if (!email?.trim() || !password) {
        const error = new Error('Enter your email and password to continue.');
        error.code = 'INVALID_INPUT';
        throw error;
      }
      if (mode !== 'mock') {
        throw new Error('Live authentication is not implemented in FE-002.');
      }
      // Deliberately do not validate, retain, or transmit mock credentials.
      return { mock: true, user: await api.getMe() };
    },
  };
}
