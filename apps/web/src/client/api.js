import examples from '../../../../handoff/api-examples/cases.json' with { type: 'json' };

const fixtures = new Map(examples.map((item) => [item.name, item]));

export class ApiError extends Error {
  constructor(error, status = 500) {
    super(error?.message || 'The request could not be completed.');
    this.name = 'ApiError';
    this.code = error?.code || 'UNKNOWN_ERROR';
    this.retryable = Boolean(error?.retryable);
    this.status = status;
  }
}

export function getFixture(name, expectedKind) {
  const fixture = fixtures.get(name);
  if (!fixture || fixture.mock !== 'MOCK') throw new Error(`Unknown mock fixture: ${name}`);
  if (expectedKind && fixture.kind !== expectedKind) {
    throw new Error(`Fixture ${name} is ${fixture.kind}, expected ${expectedKind}`);
  }
  return fixture;
}

export function createApiClient({ mode = 'mock', identityFixtureName = 'parent-identity', fetchImpl = globalThis.fetch, getAccessToken = async () => null } = {}) {
  return {
    mode,
    async getMe() {
      if (mode === 'mock') return structuredClone(getFixture(identityFixtureName, 'identity').body);
      if (typeof fetchImpl !== 'function') throw new Error('Fetch is unavailable.');
      const token = await getAccessToken();
      const response = await fetchImpl('/api/me', { headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      const body = await response.json();
      if (!response.ok) throw new ApiError(body?.error, response.status);
      return body;
    },
    // S-002 errors have no endpoint mapping. This injector is for deterministic UI state review only.
    async injectExampleError(name = 'error-PROVIDER_UNAVAILABLE') {
      const fixture = getFixture(name, 'error');
      throw new ApiError(fixture.body.error, fixture.httpStatus);
    },
  };
}
