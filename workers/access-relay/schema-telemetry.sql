-- =================================================================
-- AntCV — LLM telemetry D1 schema (database name: ant_memory)
--
-- ADDITIVE migration. Adds four tables to the existing ant_memory
-- database without touching user_kernel, application, language_view,
-- or active_application. Apply with:
--
--   npx wrangler d1 execute ant_memory --file=schema-telemetry.sql --remote
--
-- All statements use IF NOT EXISTS, so re-running is safe.
--
-- This is the spec from llm-telemetry-schema.sql (v1.40.123) made
-- live in the relay. The PWA already POSTs llm_call events to
-- /analytics; the relay tees them into llm_calls below in addition
-- to the existing cv-proxy forward (so Analytics Engine + KV keep
-- working unchanged).
-- =================================================================

CREATE TABLE IF NOT EXISTS llm_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  user_hash TEXT,
  provider TEXT NOT NULL,
  model TEXT,
  task TEXT NOT NULL,
  success INTEGER NOT NULL,
  http_status INTEGER,
  error_class TEXT,
  error_message TEXT,
  latency_ms INTEGER,
  ttft_ms INTEGER,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  placeholder_leak_count INTEGER DEFAULT 0,
  fabrication_flag INTEGER DEFAULT 0,
  banned_word_count INTEGER DEFAULT 0,
  was_retry INTEGER DEFAULT 0,
  retry_attempt INTEGER DEFAULT 1,
  estimated_cost_usd REAL,
  request_id TEXT,
  augmentation_task TEXT,
  client_version TEXT,
  jd_fingerprint TEXT
);

CREATE INDEX IF NOT EXISTS idx_llm_calls_ts            ON llm_calls(ts);
CREATE INDEX IF NOT EXISTS idx_llm_calls_provider_task ON llm_calls(provider, task);
CREATE INDEX IF NOT EXISTS idx_llm_calls_user          ON llm_calls(user_hash, ts);
CREATE INDEX IF NOT EXISTS idx_llm_calls_failures      ON llm_calls(success, ts) WHERE success = 0;

CREATE TABLE IF NOT EXISTS llm_quality_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  call_id INTEGER NOT NULL REFERENCES llm_calls(id),
  ts INTEGER NOT NULL,
  signal_type TEXT NOT NULL,
  signal_value TEXT,
  severity TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quality_call          ON llm_quality_signals(call_id);
CREATE INDEX IF NOT EXISTS idx_quality_type_severity ON llm_quality_signals(signal_type, severity, ts);

CREATE TABLE IF NOT EXISTS llm_provider_health (
  provider TEXT NOT NULL,
  task TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  window_minutes INTEGER NOT NULL,
  call_count INTEGER NOT NULL,
  success_count INTEGER NOT NULL,
  success_rate REAL NOT NULL,
  p50_latency_ms INTEGER,
  p95_latency_ms INTEGER,
  p99_latency_ms INTEGER,
  avg_tokens INTEGER,
  total_cost_usd REAL,
  placeholder_leak_rate REAL,
  fabrication_rate REAL,
  banned_word_rate REAL,
  retry_rate REAL,
  health_score REAL NOT NULL,
  status TEXT NOT NULL,
  PRIMARY KEY (provider, task, window_start, window_minutes)
);

CREATE INDEX IF NOT EXISTS idx_health_latest ON llm_provider_health(window_minutes, window_start DESC);

CREATE TABLE IF NOT EXISTS llm_provider_costs (
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_cost_per_1m_tokens REAL NOT NULL,
  completion_cost_per_1m_tokens REAL NOT NULL,
  effective_from INTEGER NOT NULL,
  PRIMARY KEY (provider, model, effective_from)
);

-- May 2026 prices, USD per 1M tokens. Update when prices change by
-- inserting a new row with a later effective_from; the cost lookup
-- picks the latest row with effective_from <= ts.
INSERT OR IGNORE INTO llm_provider_costs (provider, model, prompt_cost_per_1m_tokens, completion_cost_per_1m_tokens, effective_from) VALUES
  ('claude',  'claude-sonnet-4-6',  3.00,  15.00, 1714521600),
  ('claude',  'claude-opus-4-6',   15.00,  75.00, 1714521600),
  ('claude',  'claude-haiku-4-5',   0.80,   4.00, 1714521600),
  ('openai',  'gpt-5',              2.50,  10.00, 1714521600),
  ('openai',  'gpt-5-mini',         0.15,   0.60, 1714521600),
  ('mistral', 'mistral-large',      2.00,   6.00, 1714521600),
  ('mistral', 'mistral-medium',     0.40,   2.00, 1714521600),
  ('gemini',  'gemini-2.5-pro',     1.25,   5.00, 1714521600),
  ('gemini',  'gemini-2.5-flash',   0.075,  0.30, 1714521600);
