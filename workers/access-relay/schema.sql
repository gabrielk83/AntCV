-- =================================================================
-- AntCV — D1 schema (database name: ant_memory)
--
-- Three-axis storage:
--   user_kernel        — facts about the person, never touched by JD
--   application        — one row per (user × JD); generated output
--   language_view      — lazy (application × language) cache (optional)
--   active_application — pointer; which application the PWA is editing
--
-- Apply with:
--   npx wrangler d1 execute ant_memory --file=schema.sql --remote
--
-- Idempotent: IF NOT EXISTS on tables and indexes.
-- =================================================================

CREATE TABLE IF NOT EXISTS user_kernel (
  user_hash         TEXT PRIMARY KEY,            -- SHA-256(email), 32-char b64url
  identity          TEXT NOT NULL,               -- JSON: name/email/phone/linkedin/location/citizenship/github
  history           TEXT NOT NULL,               -- JSON: work_history (raw_bullets), education, publications, certifications, language_skills
  preferences       TEXT NOT NULL,               -- JSON: style_package, tone_register, banned_words, banned_phrases, canonical_language
  photo_b64         TEXT,                        -- separate column — biggest blob
  kernel_v2         TEXT,                        -- JSON: v2 schema (tenseMode/isCurrent/language/experience[]); staging until the v2 reader migration (kernel v2 §4)
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL
);
-- existing tables: kernel_v2 added live via `ALTER TABLE user_kernel ADD COLUMN kernel_v2 TEXT;`

CREATE TABLE IF NOT EXISTS application (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  user_hash          TEXT NOT NULL,
  jd_hash            TEXT NOT NULL,              -- SHA-256(jd_text) — dedupes re-uploads
  jd_text            TEXT NOT NULL,              -- cleaned JD body only
  supporting_context TEXT,                       -- role-only tips stripped from job-page noise
  jd_language        TEXT NOT NULL,              -- ISO 639-1, auto-detected
  jd_company         TEXT,
  jd_role            TEXT,
  subtitle           TEXT,                       -- specialization line (meta.subtitle)
  meta               TEXT,                       -- JSON: full meta {company,role,subtitle,greeting,opening,closure,...}
  category           TEXT NOT NULL,              -- one of the 12 category ids
  rationale          TEXT,                       -- JSON: LLM JD-analysis output
  cv_sections        TEXT,                       -- JSON, in jd_language
  cl_sections        TEXT,                       -- JSON, in jd_language
  style_config       TEXT,                       -- JSON: this application's OWN brand-fit/custom colors+fonts (BRAND-FIT-PER-APP-001)
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL,
  FOREIGN KEY (user_hash) REFERENCES user_kernel(user_hash) ON DELETE CASCADE,
  UNIQUE (user_hash, jd_hash)
);
-- existing tables: style_config added live via `ALTER TABLE application ADD COLUMN style_config TEXT;`

CREATE TABLE IF NOT EXISTS language_view (
  application_id    INTEGER NOT NULL,
  language          TEXT NOT NULL,
  cv_sections       TEXT NOT NULL,
  cl_sections       TEXT NOT NULL,
  generated_at      INTEGER NOT NULL,
  PRIMARY KEY (application_id, language),
  FOREIGN KEY (application_id) REFERENCES application(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS active_application (
  user_hash         TEXT PRIMARY KEY,
  application_id    INTEGER,
  -- JD-SCOPE-ISOLATION-001 Stage 2: which device last set the pointer + when, so a
  -- second device's cold-restore can avoid being yanked onto another device's app.
  -- (The relay also adds these lazily via ALTER for pre-existing databases.)
  device_id         TEXT,
  updated_at        INTEGER,
  FOREIGN KEY (user_hash) REFERENCES user_kernel(user_hash) ON DELETE CASCADE,
  FOREIGN KEY (application_id) REFERENCES application(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_app_user     ON application(user_hash);
CREATE INDEX IF NOT EXISTS idx_app_jd       ON application(user_hash, jd_hash);
CREATE INDEX IF NOT EXISTS idx_app_category ON application(user_hash, category);

-- Dedicated per-user slot for the generated KERNEL SHOWCASE (the unsolicited CV
-- built from the full profile). Kept separate from `application` so it never
-- mixes into the saved-applications list, and out of KV prefs so it doesn't
-- bloat the small prefs blob. One row per user; regenerating overwrites it.
-- (KERNEL-CLOUD-PERSIST-001)
CREATE TABLE IF NOT EXISTS kernel_showcase (
  user_hash    TEXT PRIMARY KEY,
  sections     TEXT,                       -- JSON {cv:[],cl:[]}
  meta         TEXT,                       -- JSON {company,role,subtitle,greeting,opening,...}
  rationale    TEXT,                       -- JSON
  jd_language  TEXT,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  FOREIGN KEY (user_hash) REFERENCES user_kernel(user_hash) ON DELETE CASCADE
);
