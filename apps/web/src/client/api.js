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
    async veloTopups(method = 'GET', key, expectedRevision) {
      const token = await getAccessToken();
      const response = await fetchImpl('/api/velo-topups', { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) }, ...(method === 'POST' ? { body: JSON.stringify({ expectedRevision }) } : {}) });
      const body = await response.json(); if (!response.ok) throw new ApiError(body.error, response.status); return body;
    },
    async familyRules(settings, expectedRevision) {
      if (mode !== 'live') throw new Error('Saved rules require the live API.');
      const token = await getAccessToken();
      const response = await fetchImpl('/api/family/rules', { method: settings ? 'PUT' : 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(settings ? { body: JSON.stringify({ settings, expectedRevision }) } : {}) });
      const body = await response.json();
      if (!response.ok) throw new ApiError(body.error);
      return body;
    },
    async activity() {
      if (mode !== 'live') throw new Error('Activity requires the live API.');
      const token = await getAccessToken();
      const response = await fetchImpl('/api/family/activity', { headers: { Authorization: `Bearer ${token}` } });
      const body = await response.json();
      if (!response.ok) throw new ApiError(body.error);
      return body;
    },
    async purchasePhoto(id, signal) {
      if (mode !== 'live' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) throw new Error('Invalid photo request.');
      const token = await getAccessToken();
      const response = await fetchImpl(`/api/purchases/${id}/photo`, { headers: { Authorization: `Bearer ${token}` }, signal });
      if (!response.ok) throw new Error('Photo unavailable.');
      const blob = await response.blob();
      if (!['image/png','image/jpeg'].includes(blob.type) || blob.size > 2097152) throw new Error('Invalid photo response.');
      return blob;
    },
    async getMe() {
      if (mode === 'mock') return structuredClone(getFixture(identityFixtureName, 'identity').body);
      if (typeof fetchImpl !== 'function') throw new Error('Fetch is unavailable.');
      const token = await getAccessToken();
      const response = await fetchImpl('/api/me', { headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      const body = await response.json();
      if (!response.ok) throw new ApiError(body?.error, response.status);
      return body;
    },
    async funding(method = 'GET', key, expectedRevision) {
      const token = await getAccessToken();
      const response = await fetchImpl('/api/allowance-funding', { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) }, ...(method === 'POST' ? { body: JSON.stringify({ expectedRevision }) } : {}) });
      const body = await response.json();
      if (!response.ok) throw new ApiError(body.error, response.status);
      return body;
    },
    async purchases(method = 'GET', payload, key, suffix = '') {
      if (mode === 'mock') throw new Error('Purchase flow is available only with the live API.');
      const token = await getAccessToken();
      const response = await fetchImpl('/api/purchases' + suffix, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) }, ...(payload ? { body: JSON.stringify(payload) } : {}) });
      const body = await response.json(); if (!response.ok) throw new ApiError(body?.error, response.status); return body;
    },
    // S-002 errors have no endpoint mapping. This injector is for deterministic UI state review only.
    async injectExampleError(name = 'error-PROVIDER_UNAVAILABLE') {
      const fixture = getFixture(name, 'error');
      throw new ApiError(fixture.body.error, fixture.httpStatus);
    },
  };
}
