// =================================================================
//  analytics-export.js
//
//  Server-side aggregation and export for the /analytics events the
//  PWA POSTs via Ro(). Events live in the ANALYTICS KV namespace as
//  `${event}:${ts}:${nonce}` keys with JSON values. This module:
//
//    1. listEventsFor(env, opts)   — fetch and filter raw events
//    2. aggregateBySession(events) — derive edit_count, time_to_final
//    3. eventsToCsv(events)        — flat CSV with header row
//    4. sessionsToCsv(sessions)    — per-session aggregate CSV
//    5. csvCell(v)                 — proper RFC-4180 escaping
//
//  Kept dependency-free so it can be unit-tested without spinning up
//  a Workers runtime.
// =================================================================


/**
 * List analytics events from KV, filtered by user (Cloudflare Access
 * authenticated email or session token) and time range.
 *
 * @param {KVNamespace} kv      Cloudflare KV binding (env.ANALYTICS)
 * @param {Object}      opts
 * @param {string}      [opts.identity]  email or session token; events
 *                                       whose payload doesn't match
 *                                       are filtered out. If empty,
 *                                       all events are returned.
 * @param {number}      [opts.sinceMs]   only events with ts >= sinceMs
 * @param {number}      [opts.untilMs]   only events with ts <= untilMs
 * @param {string}      [opts.event]     restrict to a single event type
 *                                       (uses KV prefix scan for speed)
 * @param {number}      [opts.limit]     hard cap on returned events
 * @returns {Promise<Array<object>>}
 */
export async function listEventsFor(kv, opts = {}) {
  const { identity, sinceMs, untilMs, event, limit = 10000 } = opts;
  if (!kv || typeof kv.list !== 'function') return [];

  // KV list is paginated (1000 per page). If `event` is given we can
  // prefix-scan and skip 5x the keyspace; otherwise we scan all.
  const prefix = event ? `${event}:` : undefined;
  const keys = [];
  let cursor;
  // Cap pages to avoid runaway loops on a misbehaving cursor; 50 pages
  // × 1000 keys = 50k events, enough for a single user for years.
  for (let page = 0; page < 50; page++) {
    const result = await kv.list(prefix
      ? { prefix, limit: 1000, cursor }
      : { limit: 1000, cursor });
    keys.push(...result.keys);
    if (result.list_complete) break;
    cursor = result.cursor;
    if (!cursor) break;
  }

  // Optional ts pre-filter from the KV key itself before fetching the
  // value — saves a round-trip when most events are outside the range.
  const candidates = keys.filter(({ name }) => {
    const parts = name.split(':');
    if (parts.length < 2) return true;
    const ts = parseInt(parts[1], 10);
    if (!Number.isFinite(ts)) return true;
    if (sinceMs && ts < sinceMs) return false;
    if (untilMs && ts > untilMs) return false;
    return true;
  });

  // Now hydrate values for the survivors. Done sequentially (KV is
  // edge-cached for hot keys; parallelism risks rate-limit bursts).
  const events = [];
  for (const k of candidates) {
    if (events.length >= limit) break;
    let raw;
    try { raw = await kv.get(k.name); } catch (e) { continue; }
    if (!raw) continue;
    let ev;
    try { ev = JSON.parse(raw); } catch (e) { continue; }
    // Identity match — when the user is authenticated, only return
    // events whose `session` field matches their session token, OR
    // whose `email` field matches their email if present. The PWA
    // doesn't always include identity, so absent identity passes.
    if (identity) {
      const sessionMatch = ev.session === identity;
      const emailMatch = ev.email === identity;
      if (ev.session && ev.email && !sessionMatch && !emailMatch) continue;
      if (ev.session && !ev.email && !sessionMatch) continue;
      // If neither field is present we can\'t filter — include the
      // event rather than silently drop it.
    }
    events.push(ev);
  }
  // Sort chronologically — KV list order is lexicographic on key,
  // and the key starts with event name not ts, so we need a real sort.
  events.sort((a, b) => (a.ts || 0) - (b.ts || 0));
  return events;
}


/**
 * Group a chronologically-sorted event stream into per-session
 * aggregates. Each session is delimited by its `session` field (a
 * stable token the PWA generates per page load). Computes:
 *
 *   - start_ts          first event timestamp
 *   - end_ts            last event timestamp
 *   - duration_ms       end - start
 *   - events_total      number of events
 *   - edit_count        section_edit events
 *   - enrich_count      enrich events
 *   - compress_count    compress events
 *   - undo_count        undo events
 *   - generation_count  generation_complete events (i.e. how many drafts)
 *   - export_count      export events (pdf+docx)
 *   - exports           [{ts, format, doc}, …]
 *   - time_to_first_export_ms  from generation_start to first export
 *   - time_to_final_export_ms  from generation_start to LAST export
 *   - cost_usd          best-effort sum of cost_at_export_usd / cost_usd
 *   - languages         set of language codes seen
 *   - tones             set of tone registers seen
 *
 * @param {Array<object>} events  chronologically-sorted
 * @returns {Array<object>}       one entry per session
 */
export function aggregateBySession(events) {
  const bySession = new Map();
  for (const ev of events) {
    const sid = ev.session || '__nosession__';
    if (!bySession.has(sid)) bySession.set(sid, {
      session: sid,
      start_ts: ev.ts || 0,
      end_ts: ev.ts || 0,
      events_total: 0,
      edit_count: 0,
      enrich_count: 0,
      compress_count: 0,
      undo_count: 0,
      redo_count: 0,
      generation_start_ts: null,
      generation_count: 0,
      export_count: 0,
      exports: [],
      time_to_first_export_ms: null,
      time_to_final_export_ms: null,
      cost_usd: 0,
      languages: new Set(),
      tones: new Set(),
      ab_groups: new Set(),
    });
    const agg = bySession.get(sid);
    agg.events_total++;
    if (ev.ts && ev.ts > agg.end_ts) agg.end_ts = ev.ts;
    if (ev.ts && (!agg.start_ts || ev.ts < agg.start_ts)) agg.start_ts = ev.ts;
    if (ev.language) agg.languages.add(ev.language);
    if (ev.tone) agg.tones.add(ev.tone);
    if (ev.ab_group) agg.ab_groups.add(ev.ab_group);

    switch (ev.event) {
      case 'section_edit':       agg.edit_count++; break;
      case 'enrich':             agg.enrich_count++; break;
      case 'compress':           agg.compress_count++; break;
      case 'undo':               agg.undo_count++; break;
      case 'redo':               agg.redo_count++; break;
      case 'generation_start':
        // The first generation_start anchors time-to-export
        // measurements. If a user generates twice in a session we
        // keep the first so time-to-final captures the full arc.
        if (agg.generation_start_ts === null) agg.generation_start_ts = ev.ts;
        break;
      case 'generation_complete': agg.generation_count++; break;
      case 'export':
        agg.export_count++;
        agg.exports.push({
          ts: ev.ts,
          format: ev.format || '',
          doc: ev.doc || '',
        });
        if (typeof ev.cost_at_export_usd === 'number') agg.cost_usd += ev.cost_at_export_usd;
        else if (typeof ev.cost_usd === 'number') agg.cost_usd += ev.cost_usd;
        break;
    }
  }
  // Compute time-to-first / time-to-final after the pass so we have
  // the full export list and the anchor timestamp settled.
  for (const agg of bySession.values()) {
    if (agg.generation_start_ts && agg.exports.length) {
      const sortedExports = [...agg.exports].sort((a, b) => (a.ts || 0) - (b.ts || 0));
      agg.time_to_first_export_ms = sortedExports[0].ts - agg.generation_start_ts;
      agg.time_to_final_export_ms = sortedExports[sortedExports.length - 1].ts - agg.generation_start_ts;
    }
    // Sets → arrays for JSON serialisability
    agg.languages = Array.from(agg.languages);
    agg.tones    = Array.from(agg.tones);
    agg.ab_groups = Array.from(agg.ab_groups);
    agg.duration_ms = agg.end_ts - agg.start_ts;
    // Round cost_usd to 6 decimals (matches the PWA's parseFloat).
    agg.cost_usd = Math.round(agg.cost_usd * 1e6) / 1e6;
  }
  // Sort sessions newest-first so the export shows the recent one
  // at the top of the file.
  return Array.from(bySession.values()).sort((a, b) => (b.start_ts || 0) - (a.start_ts || 0));
}


/**
 * Escape a single value for CSV output (RFC 4180):
 *
 *   - undefined / null → empty cell
 *   - numbers / booleans → toString unquoted
 *   - strings containing comma, quote, CR, or LF → wrap in double
 *     quotes, doubling internal quotes
 *   - everything else → JSON-stringified (handles arrays and objects)
 */
export function csvCell(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v !== 'string') v = JSON.stringify(v);
  // RFC 4180: quote when value contains separator, quote, or line break
  if (/[",\r\n]/.test(v)) {
    return '"' + v.replace(/"/g, '""') + '"';
  }
  return v;
}


/**
 * Format a list of events as CSV. The header row is the union of
 * every key seen in any event, in a stable order (canonical fields
 * first, then alphabetical for the rest). One row per event.
 */
export function eventsToCsv(events) {
  if (!Array.isArray(events) || events.length === 0) return '';
  // Canonical column order — the columns a user is likely to scan
  // for first. Anything else falls into alphabetical after these.
  const canonical = [
    'event', 'ts', 'session', 'language', 'tone', 'ab_group', 'v',
    'doc', 'format', 'duration_ms', 'cost_at_export_usd', 'cost_usd',
    'section_id', 'role_id', 'section_type', 'provider',
    'useChatGPT', 'consensusEnabled', 'hasJdFile',
    'gaps_count', 'fit_points', 'stack_depth', 'label',
  ];
  const seenKeys = new Set();
  for (const ev of events) {
    for (const k of Object.keys(ev)) seenKeys.add(k);
  }
  const cols = [
    ...canonical.filter(k => seenKeys.has(k)),
    ...Array.from(seenKeys).filter(k => !canonical.includes(k)).sort(),
  ];
  const lines = [cols.map(csvCell).join(',')];
  for (const ev of events) {
    lines.push(cols.map(c => csvCell(ev[c])).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}


/**
 * Format per-session aggregates as a CSV — flatter and easier to
 * eyeball than the raw event stream. One row per session.
 */
export function sessionsToCsv(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) return '';
  const cols = [
    'session', 'start_ts', 'end_ts', 'duration_ms',
    'events_total', 'edit_count', 'enrich_count', 'compress_count',
    'undo_count', 'redo_count',
    'generation_count', 'generation_start_ts',
    'export_count', 'time_to_first_export_ms', 'time_to_final_export_ms',
    'cost_usd', 'languages', 'tones', 'ab_groups',
  ];
  const lines = [cols.join(',')];
  for (const s of sessions) {
    const row = cols.map(c => {
      const v = s[c];
      if (Array.isArray(v)) return csvCell(v.join('|'));
      return csvCell(v);
    });
    lines.push(row.join(','));
  }
  return lines.join('\r\n') + '\r\n';
}


/**
 * One-shot helper used by the request handler — does the listing,
 * aggregation, and formatting in one go. Returns either a CSV
 * string or a structured object depending on `format`.
 */
export async function buildExport(kv, opts = {}) {
  const events = await listEventsFor(kv, opts);
  const sessions = aggregateBySession(events);
  const format = (opts.format || 'json').toLowerCase();
  const view   = (opts.view   || 'sessions').toLowerCase();
  if (format === 'csv') {
    const body = view === 'events' ? eventsToCsv(events) : sessionsToCsv(sessions);
    return { contentType: 'text/csv; charset=utf-8', body, events_total: events.length, sessions_total: sessions.length };
  }
  return {
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify({
      as_of: new Date().toISOString(),
      events_total: events.length,
      sessions_total: sessions.length,
      sessions,
      events: view === 'events' ? events : undefined,
    }, null, 2),
    events_total: events.length,
    sessions_total: sessions.length,
  };
}
