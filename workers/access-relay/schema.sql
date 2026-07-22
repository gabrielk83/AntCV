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
  cv_sections_bak    TEXT,                       -- WIPE-NONDESTRUCTIVE-RESTORE-001: pre-regen snapshot; restored on reopen if a regen left cv_sections NULL
  cl_sections_bak    TEXT,                       -- WIPE-NONDESTRUCTIVE-RESTORE-001: pre-regen snapshot; restored on reopen if a regen left cl_sections NULL
  style_config       TEXT,                       -- JSON: this application's OWN brand-fit/custom colors+fonts (BRAND-FIT-PER-APP-001)
  analysis_extra     TEXT,                       -- JSON: {gap_state:{...}, application_questions:...} — Analysis-panel per-app stores (ANALYSIS-EXTRA-PERSIST-001)
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL,
  FOREIGN KEY (user_hash) REFERENCES user_kernel(user_hash) ON DELETE CASCADE,
  UNIQUE (user_hash, jd_hash)
);
-- existing tables: style_config added live via `ALTER TABLE application ADD COLUMN style_config TEXT;`
-- existing tables: WIPE-NONDESTRUCTIVE-RESTORE-001 backups added live via
--   `ALTER TABLE application ADD COLUMN cv_sections_bak TEXT;`
--   `ALTER TABLE application ADD COLUMN cl_sections_bak TEXT;`
-- existing tables: ANALYSIS-EXTRA-PERSIST-001 added live via
--   `ALTER TABLE application ADD COLUMN analysis_extra TEXT;`

CREATE TABLE IF NOT EXISTS language_view (
  application_id    INTEGER NOT NULL,
  language          TEXT NOT NULL,
  cv_sections       TEXT NOT NULL,
  cl_sections       TEXT NOT NULL,
  generated_at      INTEGER NOT NULL,
  PRIMARY KEY (application_id, language),
  FOREIGN KEY (application_id) REFERENCES application(id) ON DELETE CASCADE
);

-- LANG-EXPAND-001 (kernel v2 §3, register row 8c): the lazy per-language
-- projection of the USER KERNEL (kernel_v2) — distinct from language_view
-- above, which caches per-APPLICATION generated output. This caches the
-- kernel's translated stable prose (role scope, outcome results) + role
-- titles per crossPolicy, so es/zh generation can start from a native-
-- language kernel instead of translating on the fly every run. Keyed by
-- user × language. source_sig = SHA-256 of the kernel_v2 JSON it was built
-- from, so a kernel edit invalidates the cached projection.
CREATE TABLE IF NOT EXISTS kernel_language_view (
  user_hash         TEXT NOT NULL,
  language          TEXT NOT NULL,          -- ISO 639-1 target (es, zh, da, ...)
  projection        TEXT NOT NULL,          -- JSON: { language, experience:[{key,roleTitle,scope[],outcomes[]}] }
  source_sig        TEXT NOT NULL,          -- SHA-256(kernel_v2 JSON) the projection was built from
  generated_at      INTEGER NOT NULL,
  PRIMARY KEY (user_hash, language),
  FOREIGN KEY (user_hash) REFERENCES user_kernel(user_hash) ON DELETE CASCADE
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

-- PARALLEL-GEN-POINTER-002: per-DEVICE active pointer. The single active_application
-- row above is shared by every device/tab of an account, so a generation finishing on
-- one device flips the pointer under another device that is mid-draft. This table gives
-- each device its OWN active-application pointer (keyed user_hash+device_id); a device
-- with no row here falls back to the legacy global active_application (latest anywhere)
-- so a fresh device still restores something sensible. Additive — old clients that never
-- send device_id keep using the legacy row untouched.
CREATE TABLE IF NOT EXISTS active_application_device (
  user_hash         TEXT NOT NULL,
  device_id         TEXT NOT NULL,
  application_id    INTEGER,
  updated_at        INTEGER,
  PRIMARY KEY (user_hash, device_id),
  FOREIGN KEY (user_hash) REFERENCES user_kernel(user_hash) ON DELETE CASCADE,
  FOREIGN KEY (application_id) REFERENCES application(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_aad_user ON active_application_device(user_hash);

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

-- Per-user job-search workbook (JOB-TRACKER-001). One JSON `doc` per user
-- holding the dream-envelope, weekly-tracker rows, top-5, history, contacts
-- and application-log. Source of truth for the local Excel workbook + (later)
-- the AntCV web UI. `rev` is a monotonic counter for optimistic-concurrency
-- (PUT sends base_rev; mismatch → 409 so the caller merges, never clobbers).
-- The relay also CREATEs this inline (IF NOT EXISTS) so it self-heals.
CREATE TABLE IF NOT EXISTS job_tracker (
  user_hash    TEXT PRIMARY KEY,
  doc          TEXT,                        -- JSON {version, envelope, rows[], top5[], history[], contacts[], application_log[], generated_at}
  rev          INTEGER NOT NULL DEFAULT 0,
  updated_at   INTEGER,
  FOREIGN KEY (user_hash) REFERENCES user_kernel(user_hash) ON DELETE CASCADE
);
