// GDPR-RIGHTS-001 (owner 2026-10-23): every D1 table that holds one user's rows,
// read by the data copy GET /api/prefs/export (GDPR Art. 15 access, Art. 20
// portability). Narrative: docs/compliance/EU_AI_ACT_GDPR.md.
//
// The account delete uses USER_ERASE_STATEMENTS in src/index.js
// (ACCOUNT-ERASE-COMPLETE-001). tests/gdpr-user-data.test.mjs fails when a table
// is in one list and not the other, or when a table created with a user_hash
// column is in neither, so the copy and the delete cover the same rows.
//
// Rows under the GLOBAL_USER_HASH sentinel ('__global_market__') in
// cluster_top_qualifications are never selected: a real user's hash never equals it.
export const USER_TABLES = [
  { table: 'application_fit' },
  { table: 'application_snapshot' },
  { table: 'application_qualification' },
  { table: 'cluster_top_qualifications' },
  { table: 'kernel_showcase_styled' },
  { table: 'kernel_showcase' },
  { table: 'kernel_language_view' },
  { table: 'job_tracker' },
  { table: 'active_application_device' },
  { table: 'active_application' },
  { table: 'application' },
  { table: 'user_kernel' },
  { table: 'llm_calls' },
];

// Rows keyed through a parent table (no user_hash column of their own).
export const CHILD_TABLES = [
  { table: 'language_view',       where: 'application_id IN (SELECT id FROM application WHERE user_hash = ?)' },
  { table: 'llm_quality_signals', where: 'call_id IN (SELECT id FROM llm_calls WHERE user_hash = ?)' },
];

function isNoTable(e) {
  return /no such table/i.test(String((e && e.message) || e));
}

// API keys are the user's own credentials. The copy says they are stored and
// for which provider, never the value.
export function redactKvPrefs(prefs) {
  if (!prefs || typeof prefs !== 'object') return prefs || {};
  const copy = JSON.parse(JSON.stringify(prefs));
  if (copy.apiKeys && typeof copy.apiKeys === 'object') {
    const masked = {};
    for (const k of Object.keys(copy.apiKeys)) {
      masked[k] = copy.apiKeys[k] ? '(stored - value not exported)' : '';
    }
    copy.apiKeys = masked;
  }
  return copy;
}

// Read every row the user owns. Returns { table: rows[] | 'missing' | {error} }.
export async function collectUserRows(db, userHash) {
  const out = {};
  const all = USER_TABLES.map((t) => ({ table: t.table, where: 'user_hash = ?' })).concat(CHILD_TABLES);
  for (const t of all) {
    try {
      const r = await db.prepare(`SELECT * FROM ${t.table} WHERE ${t.where}`).bind(userHash).all();
      out[t.table] = (r && r.results) || [];
    } catch (e) {
      out[t.table] = isNoTable(e) ? 'missing' : { error: String((e && e.message) || e) };
    }
  }
  return out;
}

// Processors and recipients named in the copy (GDPR Art. 15(1)(c)). Keep in step
// with docs/compliance/AI_ACT_AND_GDPR.md section 3.
export const RECIPIENTS = [
  { name: 'Cloudflare', role: 'hosting, D1 database, KV store, Workers (processor)' },
  { name: 'Anthropic', role: 'LLM provider, text and photo orientation (processor when the demo key is used)' },
  { name: 'OpenAI', role: 'LLM provider (processor when the demo key is used)' },
  { name: 'Mistral AI', role: 'LLM provider, text and photo orientation (processor when the demo key is used)' },
  { name: 'Google', role: 'LLM provider (Gemini) and sign-in (processor when the demo key is used)' },
  { name: 'Resend', role: 'sign-in codes and the yearly retention e-mail (processor)' },
];

export function buildExport({ email, kvPrefs, rows, retention, now = new Date() }) {
  return {
    _antcvGdprExport: 1,
    basis: 'GDPR Art. 15 (access) and Art. 20 (portability)',
    exported_at: now.toISOString(),
    account: { email: email || null },
    retention: retention || null,
    recipients: RECIPIENTS,
    kv_prefs: redactKvPrefs(kvPrefs),
    d1: rows || {},
  };
}
