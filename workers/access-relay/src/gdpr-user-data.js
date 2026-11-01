// GDPR-RIGHTS-001 (owner 2026-10-23): one list of every D1 table that holds one
// user's rows, used by the full-account delete (GDPR Art. 17) and the data copy
// (GDPR Art. 15 access, Art. 20 portability). Narrative: docs/compliance/AI_ACT_AND_GDPR.md.
//
// Why a list: the v2.5.3 delete named five core tables and two telemetry tables.
// Tables added later (job_tracker, kernel_showcase, kernel_showcase_styled,
// kernel_language_view, application_fit, application_qualification, the legacy
// per-user rows of cluster_top_qualifications) were left to ON DELETE CASCADE,
// and four of them were created without a foreign key, so their rows survived an
// account delete. A new user-keyed table goes into USER_TABLES, and both the
// delete and the copy pick it up.
//
// The GLOBAL_USER_HASH sentinel ('__global_market__') in cluster_top_qualifications
// is a SHA-256 hash of no e-mail, so `user_hash = ?` with a real hash never touches it.

// Every table keyed directly by user_hash, leaf first. `extra` = not in the
// v2.5.3 core/telemetry batches, so the delete removes it here.
export const USER_TABLES = [
  { table: 'application_fit',            extra: true },
  { table: 'application_qualification',  extra: true },
  { table: 'cluster_top_qualifications', extra: true },
  { table: 'kernel_showcase_styled',     extra: true },
  { table: 'kernel_showcase',            extra: true },
  { table: 'kernel_language_view',       extra: true },
  { table: 'job_tracker',                extra: true },
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

// Delete the user's rows from the tables the core and telemetry batches do not
// name. One statement per table, each best-effort: a table that does not exist on
// this deployment is reported as `missing`, never fails the erase.
export async function eraseExtraUserTables(db, userHash) {
  const out = {};
  let hadErrors = false;
  for (const t of USER_TABLES) {
    if (!t.extra) continue;
    try {
      const r = await db.prepare(`DELETE FROM ${t.table} WHERE user_hash = ?`).bind(userHash).run();
      out[t.table] = (r && r.meta && r.meta.changes) || 0;
    } catch (e) {
      if (isNoTable(e)) { out[t.table] = 'missing'; continue; }
      out[t.table] = { error: String((e && e.message) || e) };
      hadErrors = true;
    }
  }
  return { details: out, hadErrors };
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
