import test from 'node:test';
import assert from 'node:assert/strict';
import { csv, buildRequest, decorate, getPage, InputError, UpstreamError } from '../src/lib.js';

const NOW = Date.parse('2026-09-29T12:00:00Z');

test('csv joins, trims, dedupes and upper-cases', () => {
  assert.equal(csv([' de', 'GR', 'de', ''], { upper: true }), 'DE,GR');
  assert.equal(csv('a, b ,a'), 'a,b');
  assert.equal(csv(undefined), '');
});

test('jobs mode maps every filter to the API vocabulary', () => {
  const r = buildRequest({
    query: 'data engineer', countries: ['de', 'gr'], remote: ['remote', 'hybrid'], seniorities: ['Senior'],
    hasSalary: true, minSalaryEurAnnual: 60000, postedWithinDays: 7, includeDescription: true, remoteConfirmed: true,
    companyDomains: ['stripe.com'], maxResults: 50,
  }, NOW);
  assert.equal(r.mode, 'jobs');
  assert.equal(r.maxResults, 50);
  assert.deepEqual(r.params, {
    q: 'data engineer', country: 'DE,GR', remote: 'remote,hybrid', seniority: 'Senior', has_salary: 'true',
    min_salary: '60000', posted_after: '2026-09-22T12:00:00.000Z', include_description: 'true',
    remote_confirmed: 'true', company_domain: 'stripe.com',
  });
});

test('closed_jobs mode adds closed filters', () => {
  const r = buildRequest({ mode: 'closed_jobs', closedWithinDays: 2, closedReason: 'expired_upstream' }, NOW);
  assert.equal(r.params.closed_after, '2026-09-27T12:00:00.000Z');
  assert.equal(r.params.closed_reason, 'expired_upstream');
});

test('companies mode ignores job-only filters', () => {
  const r = buildRequest({ mode: 'companies', query: 'siemens', countries: ['DE'], remote: ['remote'], companyHasWebsite: true }, NOW);
  assert.deepEqual(r.params, { q: 'siemens', country: 'DE', has_website: 'true' });
});

test('defaults: jobs, 100 results, empty filters', () => {
  const r = buildRequest({}, NOW);
  assert.equal(r.mode, 'jobs'); assert.equal(r.maxResults, 100); assert.deepEqual(r.params, {});
});

test('input validation', () => {
  assert.throws(() => buildRequest({ mode: 'nope' }), InputError);
  assert.throws(() => buildRequest({ maxResults: 0 }), InputError);
  assert.throws(() => buildRequest({ maxResults: 1e6 }), InputError);
  assert.throws(() => buildRequest({ countries: ['Germany'] }), InputError);
  assert.throws(() => buildRequest({ postedWithinDays: -3 }), InputError);
});

test('decorate adds public JOA links', () => {
  assert.equal(decorate('jobs', { slug: 'x-1' }).joa_url, 'https://jobopportunitiesapi.org/job/x-1');
  assert.equal(decorate('companies', { slug: 'acme' }).joa_url, 'https://jobopportunitiesapi.org/company/acme');
  assert.deepEqual(decorate('jobs', { id: 1 }), { id: 1 });
});

const res = (status, body, headers = {}) => ({ ok: status < 300, status, headers: { get: (k) => headers[k.toLowerCase()] ?? null }, json: async () => body, text: async () => JSON.stringify(body) });

test('getPage sends the bearer key and query', async () => {
  let seen;
  const out = await getPage({ base: 'https://api.example', path: '/v1/jobs', params: { limit: '5', q: 'a b' }, key: 'sk_test',
    fetchImpl: async (u, o) => { seen = { u: String(u), h: o.headers }; return res(200, { data: [1] }); } });
  assert.deepEqual(out, { data: [1] });
  assert.equal(seen.u, 'https://api.example/v1/jobs?limit=5&q=a+b');
  assert.equal(seen.h.Authorization, 'Bearer sk_test');
});

test('getPage retries 429 then succeeds', async () => {
  const seq = [res(429, { error: 'rl' }, { 'retry-after': '1' }), res(503, {}), res(200, { data: [] })];
  const waits = [];
  const out = await getPage({ base: 'https://a', path: '/x', params: {}, key: 'k', fetchImpl: async () => seq.shift(), sleepImpl: async (ms) => waits.push(ms) });
  assert.deepEqual(out, { data: [] });
  assert.equal(waits.length, 2); assert.equal(waits[0], 1000);
});

test('getPage maps 400 to InputError and 401 to UpstreamError without retrying', async () => {
  let calls = 0;
  await assert.rejects(getPage({ base: 'https://a', path: '/x', params: {}, key: 'k', fetchImpl: async () => { calls++; return res(400, { message: 'Unknown remote "x"' }); } }), (e) => e instanceof InputError && /Unknown remote/.test(e.message));
  await assert.rejects(getPage({ base: 'https://a', path: '/x', params: {}, key: 'k', fetchImpl: async () => { calls++; return res(401, {}); } }), UpstreamError);
  assert.equal(calls, 2);
});

test('getPage gives up after maxAttempts', async () => {
  let calls = 0;
  await assert.rejects(getPage({ base: 'https://a', path: '/x', params: {}, key: 'k', maxAttempts: 3, fetchImpl: async () => { calls++; return res(502, {}); }, sleepImpl: async () => {} }), UpstreamError);
  assert.equal(calls, 3);
});
