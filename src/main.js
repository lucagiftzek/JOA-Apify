import { Actor, log } from 'apify';
import { API_BASE_DEFAULT, MODES, InputError, UpstreamError, buildRequest, decorate, getPage } from './lib.js';

await Actor.init();

const startedAt = new Date().toISOString();
let returned = 0;
let pages = 0;
let nextCursor;
let hasMore = false;
let stopReason = 'completed';
let resumable = true;

try {
  const input = (await Actor.getInput()) ?? {};
  const { mode, maxResults, params, startCursor } = buildRequest(input);
  const { path, event, label } = MODES[mode];

  const key = process.env.JOA_API_KEY;
  if (!key) throw new UpstreamError('This Actor is missing its JOA credential (JOA_API_KEY). This is an operator-side problem — please report it on the Actor\'s Issues tab.');
  const apiBase = process.env.JOA_API_BASE || API_BASE_DEFAULT;

  // The largest page the plan allows; the API silently clamps, so ask for a sane number and trust what comes back.
  const pageSize = 20;
  log.info(`Fetching ${label} (max ${maxResults}) with filters: ${JSON.stringify(params)}`);

  let cursor = startCursor;
  while (returned < maxResults) {
    const q = { ...params, limit: String(Math.min(pageSize, maxResults - returned)) };
    if (cursor) q.cursor = cursor;
    const page = await getPage({ base: apiBase, path, params: q, key, log: (m) => log.warning(m) });
    pages += 1;
    const rows = Array.isArray(page.data) ? page.data : [];
    nextCursor = page.next_cursor || undefined;
    hasMore = Boolean(page.has_more && nextCursor);

    if (rows.length) {
      const room = maxResults - returned;
      const batch = rows.slice(0, room).map((r) => decorate(mode, r));
      // Charging happens per item pushed; the platform stops us at the user's max-cost limit.
      const result = await Actor.pushData(batch, event);
      // chargedCount is 0 when the run is not pay-per-event (local/dev), so only trust it when the cost limit was hit.
      const cut = result?.eventChargeLimitReached && typeof result.chargedCount === 'number' && result.chargedCount < batch.length;
      returned += cut ? result.chargedCount : batch.length;
      if (result?.eventChargeLimitReached) {
        stopReason = 'max_cost_per_run_reached';
        // The page may have been cut short by the cost limit, so next_cursor would skip undelivered rows: do not offer it.
        resumable = false;
        break;
      }
    }
    if (pages % 10 === 0) await Actor.setStatusMessage(`Fetched ${returned} ${label}…`);
    if (!hasMore) break;
    cursor = nextCursor;
  }
  if (returned >= maxResults && stopReason === 'completed') stopReason = hasMore ? 'max_results_reached' : 'completed';
  if (returned === 0) stopReason = 'no_matches';

  const message = {
    completed: `Done — ${returned} ${label} returned (all matches).`,
    no_matches: 'No records matched these filters. Nothing was billed except the run start.',
    max_results_reached: `Done — ${returned} ${label} returned (limit reached; more exist — see SUMMARY.next_cursor to continue).`,
    max_cost_per_run_reached: `Stopped at your maximum cost per run — ${returned} ${label} returned. Raise the limit to fetch more.`,
  }[stopReason];
  await Actor.setStatusMessage(message);
  await Actor.setValue('SUMMARY', {
    mode, returned, pages, stopReason, hasMore,
    next_cursor: hasMore && resumable ? nextCursor ?? null : null,
    filters: params, startedAt, finishedAt: new Date().toISOString(),
    source: 'https://jobopportunitiesapi.org',
  });
  log.info(message);
} catch (err) {
  const user = err instanceof InputError || err instanceof UpstreamError;
  log.error(err.message);
  await Actor.setStatusMessage(err.message, { isStatusMessageTerminal: true }).catch(() => {});
  await Actor.setValue('SUMMARY', { returned, pages, stopReason: 'error', error: err.message, startedAt, finishedAt: new Date().toISOString() });
  await Actor.fail(user ? err.message : `Unexpected error: ${err.message}`);
}

await Actor.exit();
