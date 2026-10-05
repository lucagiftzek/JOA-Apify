# Employer-Direct Job Postings API (Job Opportunities API)

Get **job postings straight from employers**: applicant-tracking systems (Greenhouse, Lever, Workday, Ashby, SmartRecruiters and many more), company career pages and public employment agencies. This Actor is the Apify edition of **Job Opportunities API (JOA)** — [jobopportunitiesapi.org](https://jobopportunitiesapi.org).

- **No scraping at run time.** The Actor reads a continuously re-verified job ledger, so runs finish in seconds: no proxies, no blocked requests, no broken selectors.
- **Every field says where it came from.** `field_sources` labels each field `published` (the employer said it), `inferred` (we derived it) or `absent`.
- **Live and closed jobs.** Roles that come off their source are kept with `closed_at` and `closed_reason` — useful hiring signals.
- **Employer-direct only.** Aggregators and job boards such as LinkedIn and Indeed are excluded on purpose; every row links to the employer's own apply page.

## Quick start

1. Click **Start** with the default input — it returns 25 recent software-engineering jobs in Germany in a few seconds (under 10 cents).
2. Change the role, country or company (examples below) and raise **Max results** when you need more.
3. Download the dataset as JSON, CSV or Excel, or connect it to Make, Zapier, n8n, Google Sheets, webhooks or an AI agent through the Apify API.

## Use cases

- **Job boards and niche job sites** — fill a board with fresh, employer-direct vacancies by country, role or category, with the original apply link.
- **AI job agents and copilots** — give an agent structured, provenance-labelled postings instead of scraped HTML.
- **Sales prospecting and lead lists** — find companies that are hiring for a role (a buying signal), with company website and open-role counts.
- **Labour-market research** — track what is being posted and what closes, by country, city, seniority or category.
- **Recruiting and talent intelligence** — watch competitors' hiring by company domain.

## Modes

| Mode | What it returns | Billed event |
|---|---|---|
| **Jobs** (default) | Live vacancies, newest first | Job listing returned |
| **Closed jobs** | Roles that left their source, with `closed_at` and `closed_reason` | Closed job returned |
| **Companies** | Employers with open roles: website, industry, organisation type, open-role counts | Employer returned |

## Input examples

Every field is optional. Typical searches:

**A role in one country**
```json
{ "mode": "jobs", "query": "software engineer", "countries": ["DE"], "maxResults": 25 }
```

**Remote or hybrid data roles across several countries, re-verified in the last 2 days**
```json
{ "mode": "jobs", "titleQuery": "data engineer", "countries": ["NL", "DE", "BE"], "remote": ["remote", "hybrid"], "verifiedWithinDays": 2, "maxResults": 200 }
```

**Every open role at specific companies**
```json
{ "mode": "jobs", "companyDomains": ["spotify.com"], "maxResults": 500 }
```

**Healthcare roles in the US posted in the last week, with the full advert text**
```json
{ "mode": "jobs", "titleQuery": "nurse", "countries": ["US"], "postedWithinDays": 7, "includeDescription": true, "maxResults": 100 }
```

**Roles that closed in France in the last 7 days (hiring signals)**
```json
{ "mode": "closed_jobs", "countries": ["FR"], "closedWithinDays": 7, "maxResults": 100 }
```

**Companies hiring in Ireland that have a website**
```json
{ "mode": "companies", "countries": ["IE"], "companyHasWebsite": true, "maxResults": 100 }
```

Other filters: title exclusions, text in the description, excluded countries, city, employment type, seniority, job category, source type, company slugs, published salary only, minimum annual salary (EUR), source-confirmed remote status only.

### Large pulls in several runs

Each run writes a `SUMMARY` record to the key-value store with `next_cursor` when more results exist. Paste it into **Start cursor** (keep the other inputs identical) to continue exactly where the previous run stopped.

## Output sample (Jobs mode, abridged)

```json
{
  "id": "78d67bf5-bdd1-4b56-9ea1-ef8744b35d21",
  "title": "Software Engineer, Foundation (Mid-Level)",
  "company": "Clera",
  "category": "Engineering",
  "country": "DE",
  "city": "Berlin",
  "remote": "on_site",
  "remote_inferred": false,
  "seniority": "Mid",
  "posted_at": "2026-10-04T17:07:00Z",
  "last_verified_at": "2026-10-04T19:56:43Z",
  "status": "live",
  "apply_url": "https://jobs.ashbyhq.com/clera/4d0b97c5-1830-414f-a4d8-edac9fdc9972/application",
  "source": "ashby",
  "source_type": "ats",
  "field_sources": {
    "remote": "published",
    "location": "published",
    "posted_at": "published",
    "category": "inferred",
    "seniority": "inferred",
    "salary": "absent"
  },
  "joa_url": "https://jobopportunitiesapi.org/job/software-engineer-foundation-mid-level-78d67bf5"
}
```

## Where each field comes from (provenance)

- **published** — taken from the employer's own posting: title, location, apply link, posting date, advert text and, when the employer states it, salary and work model.
- **inferred** — derived by JOA when the employer did not state it, for example category, seniority or remote status. Seniority and category appear only when confidence is high; otherwise they are `absent`, never guessed.
- **absent** — the employer did not publish it and we did not infer it.
- `last_verified_at` is when the vacancy was last re-confirmed at its source; filter with **Re-verified within (days)**. Tick **Only source-confirmed remote status** when you need certainty about remote work.

## Pricing — pay only for records returned

| Event | Price | Per 1,000 |
|---|---|---|
| Job listing returned | $0.0035 | $3.50 |
| Employer returned | $0.0035 | $3.50 |
| Closed job returned | $0.006 | $6.00 |

Searches that match nothing cost nothing. A first run with the default input costs under 10 cents, and the Apify free plan's monthly credit covers well over a thousand job listings. Cap spending with **Max results** and Apify's **maximum cost per run**; the run stops as soon as either is reached.

For steady monthly volumes, the direct REST API is cheaper per record — see the plans (including a free tier) at [jobopportunitiesapi.org/pricing](https://jobopportunitiesapi.org/pricing).

## FAQ

**Is this a LinkedIn or Indeed scraper?** No. Aggregators and job boards are excluded on purpose. Postings come from employer ATS platforms, company career pages and public employment agencies, and each links to the employer's own apply page.

**How fresh is the data?** The ledger is refreshed continuously and vacancies are re-checked at their source; every row carries `last_verified_at`, and you can filter on it.

**Which countries are covered?** Worldwide, with the deepest coverage in Europe and North America. Live figures by country are published at [api.jobopportunitiesapi.org/public/coverage](https://api.jobopportunitiesapi.org/public/coverage).

**Is salary included?** Only when the employer publishes it — many employers do not. Use **Only rows with a published salary** to restrict to those rows.

**Can I get the full job description?** Yes — tick **Include full advert text**.

**How do I get more than one run's worth?** Use the `next_cursor` from the `SUMMARY` record (see above), or schedule the Actor with **Posted within (days)** to collect only new postings.

**Can I use it from an AI agent?** Yes — through the Apify API, Apify's MCP server, or JOA's own MCP server and REST API.

**Is there documentation for the underlying API?** Yes: [jobopportunitiesapi.org/docs](https://jobopportunitiesapi.org/docs).

**Is there a free report built on this data?** Yes — the free monthly job-market report: [jobopportunitiesapi.org/reports/job-market-september-2026](https://jobopportunitiesapi.org/reports/job-market-september-2026).

**A run failed with a credential message.** That is a problem on our side, never your input. Please open an issue on the Actor's **Issues** tab.

## Support

Questions, bugs and feature requests: the Actor's **Issues** tab, or support@jobopportunitiesapi.org.

Built and operated by Loukas Tzekos, founder of Job Opportunities API — [jobopportunitiesapi.org](https://jobopportunitiesapi.org).
