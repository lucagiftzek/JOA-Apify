# Employer-Direct Jobs API — Job Opportunities API (JOA) on Apify

Search **live and closed job listings taken straight from the source**: employer applicant-tracking systems, company career pages and public employment agencies. More than **2 million live listings worldwide**, of which **466,000+ employer-direct listings in Europe** — with **every field labelled `published` or `inferred`** so you know what the employer said and what we guessed.

This Actor is the Apify edition of [jobopportunitiesapi.org](https://jobopportunitiesapi.org). No scraping happens at run time: it reads a continuously refreshed ledger, so runs are **fast, stable and cheap** — no proxies, no blocked requests, no broken selectors.

## What you can pull

| Mode | What it returns | Typical use |
|---|---|---|
| **Jobs** | Live vacancies, newest first | Job boards, AI job agents, lead lists, market research |
| **Closed jobs** | Roles that left their source, with `closed_at` and `closed_reason` | Hiring-signal data: how fast do employers fill roles? |
| **Companies** | Employers with open roles, industry, org type, website, open-role counts | Sales prospecting, employer databases |

### Why this data is different

- **Per-field provenance.** `field_sources` marks each field `published`, `inferred` or `absent`. Filter to source-confirmed remote status only.
- **Freshness you can query.** `last_verified_at` is when we last re-confirmed the vacancy at its source — about 97% of the ledger is re-checked inside 48 hours. Filter with *Re-verified within (days)*.
- **Closure history.** Roles that came off their source are kept, with the reason.
- **Every row links to the employer's own apply page** (`apply_url`) and to a public JOA page (`joa_url`).
- **Redistribution is enforced by a database join**, not a filter someone can forget: only employer ATS, career-site and government-agency sources are served.

### Honest coverage notes

- Salary is published by the employer on roughly **2%** of rows. Use *Only rows with a published salary* together with a country.
- **Remote / hybrid / on-site** is inferred for most rows; tick *Only source-confirmed remote status* if you need certainty.
- Seniority and category are inferred and shown only when confidence is high; otherwise they are absent, never guessed.

## Pricing — pay only for records returned

| Event | Price | Per 1,000 |
|---|---|---|
| Job listing returned | **$0.002** | $2.00 |
| Closed job returned | **$0.004** | $4.00 |
| Employer returned | **$0.002** | $2.00 |
| Actor start | $0.00005 | — |

Empty pages and searches that match nothing cost nothing beyond the start fee. Set **Max results** and Apify's **maximum cost per run** to cap spend; the run stops the moment either is reached. The Apify free plan's monthly credit covers roughly 2,500 job listings.

## Input

Every field is optional; the defaults return 100 recent jobs.

```json
{
  "mode": "jobs",
  "query": "data engineer",
  "countries": ["DE", "NL"],
  "remote": ["remote", "hybrid"],
  "seniorities": ["Senior", "Lead"],
  "verifiedWithinDays": 2,
  "postedWithinDays": 14,
  "includeDescription": false,
  "maxResults": 500
}
```

Filters cover: full-text query, title include/exclude, description text, countries, city, work model, employment type, seniority, job category, source type, company slugs, company domains, published salary and minimum annual salary (EUR), posted / re-verified / closed windows, and full advert text.

### Pulling a large set in several runs

Each run writes a `SUMMARY` record to the key-value store containing `next_cursor` when more results exist. Paste it into **Start cursor** (keep the other inputs identical) to continue exactly where the previous run stopped.

## Output (Jobs mode, abridged)

```json
{
  "id": "fdf6503a-df64-493b-9a50-eaef5e2a11f0",
  "title": "Spezialist Direktvermarktung und Partnerbetreuung (m/w/d)",
  "company": "E.VITA GmbH",
  "country": "DE",
  "city": "Stuttgart",
  "remote": "hybrid",
  "remote_inferred": true,
  "employment_type": "Full-time",
  "salary_min": 49000,
  "salary_max": 65000,
  "salary_currency": "EUR",
  "salary_period": "year",
  "posted_at": "2026-09-28T00:00:00Z",
  "last_verified_at": "2026-09-29T09:05:30Z",
  "apply_url": "https://evita-energie.softgarden.io/job/67688737/",
  "source_type": "career_site",
  "field_sources": { "remote": "inferred", "salary": "published", "location": "published" },
  "joa_url": "https://jobopportunitiesapi.org/job/spezialist-direktvermarktung-und-partnerbetreuung-m-w-d-fdf6503a"
}
```

Download as JSON, CSV, Excel, XML or HTML, or read it through the Apify API and integrations (Make, Zapier, n8n, Google Sheets, webhooks, MCP for AI agents).

## FAQ

**Is this scraping LinkedIn or Indeed?** No. Those aggregators are excluded on purpose. Listings come from employer ATS platforms (Greenhouse, Lever, Workday, SmartRecruiters and many more), company career pages and public agencies.

**How fresh is it?** The ledger refreshes every few hours; each row carries `last_verified_at`.

**Can I integrate directly instead?** Yes — the same data is available as a REST API with a free tier at [jobopportunitiesapi.org](https://jobopportunitiesapi.org), and per call on [API.market](https://api.market/store/tzekos/jobopportunitiesapi). This Actor is the pay-per-result option inside Apify.

**A run failed with a credential message.** That is an operator-side problem, never your input. Please open an issue on the Actor's Issues tab.

## Support

Issues and feature requests: the Actor's **Issues** tab or [GitHub](https://github.com/lucagiftzek/JOA-Apify/issues). Built and operated by [TZEKOS.EU](https://tzekos.eu).
