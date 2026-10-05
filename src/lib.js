// Pure helpers for the JOA Apify Actor — no Apify SDK imports, so they are unit-testable.

export const API_BASE_DEFAULT = 'https://api.jobopportunitiesapi.org';
export const SITE_BASE = 'https://jobopportunitiesapi.org';

export const MODES = {
  jobs: { path: '/v1/jobs', event: 'job-record', label: 'jobs' },
  closed_jobs: { path: '/v1/jobs/closed', event: 'closed-job-record', label: 'closed jobs' },
  companies: { path: '/v1/companies', event: 'company-record', label: 'companies' },
};

export class InputError extends Error {}
export class UpstreamError extends Error {}

/** Join an array-ish input into the comma list the API expects. */
export function csv(value, { upper = false } = {}) {
  const arr = Array.isArray(value) ? value : value == null ? [] : String(value).split(',');
  const out = arr.map((s) => String(s).trim()).filter(Boolean).map((s) => (upper ? s.toUpperCase() : s));
  return [...new Set(out)].join(',');
}

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const posInt = (v, name) => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new InputError(`"${name}" must be a non-negative number.`);
  return n;
};

export function daysAgoIso(days, now = Date.now()) {
  return new Date(now - days * 86_400_000).toISOString();
}

/**
 * Validate the Actor input and turn it into { mode, maxResults, params, startCursor }.
 * params is a plain object of API query parameters (without limit / cursor).
 */
export function buildRequest(input = {}, now = Date.now()) {
  const mode = input.mode || 'jobs';
  if (!MODES[mode]) throw new InputError(`Unknown mode "${mode}". Use jobs, closed_jobs or companies.`);

  let maxResults = input.maxResults === undefined || input.maxResults === null ? 25 : Number(input.maxResults);
  if (!Number.isInteger(maxResults) || maxResults < 1) throw new InputError('"maxResults" must be a whole number of at least 1.');
  if (maxResults > 100000) throw new InputError('"maxResults" is capped at 100,000 per run. Use "startCursor" to continue in another run.');

  const p = {};
  const set = (k, v) => { if (v !== undefined && v !== null && v !== '' && v !== false) p[k] = String(v); };

  const countries = csv(input.countries, { upper: true });
  for (const c of countries.split(',').filter(Boolean)) {
    if (!/^[A-Z]{2}$/.test(c)) throw new InputError(`Country "${c}" is not an ISO-3166 alpha-2 code (e.g. DE, GR, FR).`);
  }

  if (mode === 'companies') {
    set('q', str(input.query));
    set('country', countries);
    set('org_type', str(input.companyOrgType));
    set('source_type', csv(input.sourceTypes));
    if (input.companyHasWebsite === true) p.has_website = 'true';
  } else {
    set('q', str(input.query));
    set('title', str(input.titleQuery));
    set('title_exclude', str(input.titleExclude));
    set('description_contains', str(input.descriptionContains));
    set('country', countries);
    set('exclude_country', csv(input.excludeCountries, { upper: true }));
    set('city', str(input.city));
    set('remote', csv(input.remote));
    if (input.remoteConfirmed === true) p.remote_confirmed = 'true';
    set('employment_type', csv(input.employmentTypes));
    set('seniority', csv(input.seniorities));
    set('category', csv(input.categories));
    set('source_type', csv(input.sourceTypes));
    set('company', csv(input.companySlugs));
    set('company_domain', csv(input.companyDomains));
    if (input.hasSalary === true) p.has_salary = 'true';
    const minSal = posInt(input.minSalaryEurAnnual, 'minSalaryEurAnnual');
    if (minSal) p.min_salary = String(minSal);
    if (input.includeDescription === true) p.include_description = 'true';
    const posted = posInt(input.postedWithinDays, 'postedWithinDays');
    if (posted) p.posted_after = daysAgoIso(posted, now);
    const verified = posInt(input.verifiedWithinDays, 'verifiedWithinDays');
    if (verified) p.verified_after = daysAgoIso(verified, now);
    if (mode === 'closed_jobs') {
      const closed = posInt(input.closedWithinDays, 'closedWithinDays');
      if (closed) p.closed_after = daysAgoIso(closed, now);
      set('closed_reason', str(input.closedReason));
    }
  }
  return { mode, maxResults, params: p, startCursor: str(input.startCursor) || undefined };
}

/** Add stable links back to the public JOA pages. */
export function decorate(mode, row) {
  if (mode === 'companies') return row.slug ? { ...row, joa_url: `${SITE_BASE}/company/${row.slug}` } : row;
  return row.slug ? { ...row, joa_url: `${SITE_BASE}/job/${row.slug}` } : row;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** GET one page with retries on 429 / 5xx / network errors. Returns parsed JSON. */
export async function getPage({ base, path, params, key, fetchImpl = fetch, maxAttempts = 6, sleepImpl = sleep, log = () => {} }) {
  const url = new URL(path, base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetchImpl(url, {
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: 'application/json',
          'User-Agent': 'joa-apify-actor/1.0 (+https://github.com/lucagiftzek/JOA-Apify)',
        },
        signal: AbortSignal.timeout(45_000),
      });
      if (res.ok) return await res.json();
      const body = await res.text().catch(() => '');
      let msg = body.slice(0, 300);
      try { const j = JSON.parse(body); msg = j.message || j.error || msg; } catch { /* keep raw */ }
      if (res.status === 400 || res.status === 422) throw new InputError(`JOA rejected the request: ${msg}`);
      if (res.status === 401 || res.status === 403) throw new UpstreamError(`JOA refused this Actor's credentials (HTTP ${res.status}). This is an operator-side problem, not your input — please report it on the Actor's Issues tab.`);
      if (res.status === 429 || res.status >= 500) {
        const ra = Number(res.headers.get('retry-after'));
        const wait = Math.min(60_000, Number.isFinite(ra) && ra > 0 ? ra * 1000 : 1000 * 2 ** attempt + Math.random() * 500);
        lastErr = new UpstreamError(`HTTP ${res.status}: ${msg}`);
        log(`JOA answered ${res.status}; retry ${attempt}/${maxAttempts} in ${Math.round(wait / 1000)}s`);
        await sleepImpl(wait);
        continue;
      }
      throw new UpstreamError(`Unexpected HTTP ${res.status}: ${msg}`);
    } catch (e) {
      if (e instanceof InputError || e instanceof UpstreamError) throw e;
      lastErr = e;
      const wait = Math.min(30_000, 1000 * 2 ** attempt);
      log(`Network error (${e.name}: ${e.message}); retry ${attempt}/${maxAttempts} in ${Math.round(wait / 1000)}s`);
      await sleepImpl(wait);
    }
  }
  throw new UpstreamError(`JOA did not answer after ${maxAttempts} attempts: ${lastErr?.message || 'unknown error'}`);
}
