# AntCV — Open & Closed Issues (2026-06-20)

Full-project view for the nightly run, not just today's batch. AntCV ships through **1.50.736** on `main` (PWA auto-deploys on push; workers deploy manually, latest docx-worker 1.14.79). The dominant theme of 2026-06-19/20 was **targeted-application persistence**: a JD-targeted generation (Nordea analytics) kept reverting to the default **unsolicited kernel**, and the export carried fabricated tools (Snowflake/DBT) plus irrelevant student roles. That work landed as a 4-layer persistence fix (728–732) and an export-sanitize/merge pass (733–736). Most remaining OPEN items are generation/regen-gated content quality, preview≠export parity, and queued features. The **DO NOT REGRESS** section below is the priority read for the nightly: it must not undo the 728–736 benefits.

---

## CLOSED / SHIPPED (recent, 1.50.700–736)

### Targeting persistence (the 4-layer Nordea fix + export sanitize)
| ID / name | Version | One-line |
|---|---|---|
| CLAMP-GUARD-001 | 1.50.728 | Unsolicited-row cloud-read no longer clears a freshly-fetched JD textarea (`app.src.js:19643`, skip clamp when `zt` holds a real JD). |
| CATEGORIZE-ON-ATTACH-001 | 1.50.729 | App-save stops hardcoding `category:"unsolicited"`; a row with a real JD company is `targeted` (`app.src.js:14340`). |
| META-DRIFT-GUARD-001 | 1.50.731 | Cloud-restore of the active unsolicited row no longer overwrites a real-company draft's meta/sections (`app.src.js:19596`). |
| AUTO-COMMIT-001 | 1.50.732 | A drifted real-company generation is COMMITTED as a first-class active application (create/reuse row, set-active, stamp `activeAppCompany`) — `app.src.js:15914`. THE fix. |
| EXPERIENCE-TAILOR-001 | 1.50.733 | Prompt rule: for a JD-targeted app, consolidate same-company roles + hide JD-irrelevant roles; unsolicited kernel keeps full breadth (regen-gated). |
| EXPORT-SANITIZE-001 | 1.50.734 | `antcv-docx-client.js sanitizeForExport()` strips Snowflake/DBT from tools + hides student-council/security-guard for a targeted export (ephemeral). Also fixed 415 split regex `/s*,s*/`→`/\s*,\s*/`. |
| EXPORT-MERGE-001 | 1.50.735 | `mergeSameCompanyRoles()` merges Innoviz/Meprolight/TAU visible same-company roles at export (join titles, union+dedup bullets, rank by relevance, cap 6). |
| TABLE-CELL TOOLS-STRIP | 1.50.736 | Extends the strip to CORE COMPETENCIES table cells (`s.rows`) — the second Snowflake location. |
| TOOLS-FABRICATION-001 | 1.50.730 | First strip of hallucinated Snowflake from the tools list (superseded by 734/736 once React-vs-localStorage drift found). |

### Content quality — Results / outcomes / anti-fabrication
| ID / name | Version | One-line |
|---|---|---|
| ANTI-FABRICATION-ARTIFACT-001/002 | 1.50.698 / 705 | Strip "evidence artifact" NYX/MOR PRO clauses + NYX from the laminated result (`antcv-evidence-artifact-strip.js`). |
| RESULTS-CROSSROLE-BLEED-002 | 1.50.699 | Score outcomes against each role's OWN kernel outcomes so a paraphrase doesn't bleed onto an unrelated role. |
| TENSE-VERBMAP-EXPAND-001 (item D) | 1.50.700 | Re-tense more laminated Results to the chosen tense (~55 verbs incl. irregulars). |
| STD-CODE-NOT-METRIC-001 | 1.50.697 | `_metricScore` ignores standard-code digits (ISO/SAE/MIL-STD/STANAG) so a compliance line can't win the numeric sort. |
| ACCESS-NO-COMMENT-001 | 1.50.697 | Strip trailing "has not limited his/their career" sentence from CV accessibility (CL preserved). |
| RESULTS-NEAR-DUP-001 | 1.50.706/707 | Dedup near-duplicate outcomes + anchor clause for headline-equal outcomes. |
| RESULTS-PREVIEW-REPEAT-001 / ROLE-ID-STABILIZE-001 | 1.50.704 / 693 | Fix repetitive preview Results from duplicate/empty role ids. |
| RESULT-NUMBER-NO-REUSE-001 | 1.50.716 | A metric used in the Result isn't repeated in bullets. |
| INTERESTS-PIN-001 | 1.50.715 | Pin canonical 6 interests so they hold. |
| canonical role + bullet ordering | 1.50.708/709 | Pan Idræt / coach-to-bullet / IDF / TAU unify / volunteer grouping. |

### Content quality — tense / distinctness / bullets
| ID / name | Version | One-line |
|---|---|---|
| TENSE-AT-LAMINATION-001 | 1.50.695 | Tense folded into `applyOutcomesMode` (no runtime sidecar). |
| TENSE-FULL-CLAUSE-001 | 1.50.717 | Role + result in one tense (fixes mixed tense). |
| BULLET-TENSE-001 + TA-TORN-OFF-001 | 1.50.725 | Bullet tense rule + torn-off fix. |
| DOC-DISTINCT-001 | 1.50.726 | CV and CL must differ in content + headline (prompt rule). |
| FOCUS-LABELS-001 | 1.50.724 | Compact owner-preferred table Focus Area labels. |
| KEEP-MIN-BULLETS-001 + SIRIN-TEAM-001 | 1.50.723 | Min-bullets floor + Sirin team semantics. |
| SIDEBAR-DEDUPE-001 | 1.50.714 | Auto-dedupe languages + education, strip interests remnant. |

### Cluster demand model / job-search targeting
| ID / name | Version | One-line |
|---|---|---|
| CLUSTER-QUAL-001 client demand model | 1.50.710 | `antcv-cluster-demand.js` blended numeric×skill ordering (3 of 12 clusters seeded). |
| Job-search targeting prefs (Bundle A) | 1.50.711 | `JobSearchTargeting` island (region/model/format chips) in Settings→Personal, cloud-synced. |

### Settings / UX / export plumbing
| ID / name | Version | One-line |
|---|---|---|
| EXPORT-PREVIEW-ZOOM-002 | 1.50.701 | Fit a whole A4 page in the export-preview modal. |
| SUBSECTION-RENAME-REORDER-001 | 1.50.702 | Reorder sidebar subsections. |
| DISCLOSURE-TRIANGLE-CONSISTENCY-001 | 1.50.703 | Consistent ▸/▾ on native collapsibles. |
| BANNER-END-ANALYSIS-READY-001 | 1.50.696 | End the purple banner when analysis is ready. |
| LOGIN-VERSION-LIVE-001 | 1.50.722 | Login overlay version chip tracks the live version. |
| SECTION-CYCLER-001 | 1.50.721 | Manual per-section CJLR control (gated default-off). |
| AUTO-ALIGN-001 / BREATHING-001 | 1.50.718 / 727 | Justify→left on giant gaps, →right on RTL; de-justify skips already-handled sidebar elements. |
| IDENTITY-NO-REPEAT-001 + DEMANDED-FIRST-001 | 1.50.720 | Prompt rules: no identity repeat, demanded skills first. |
| AI watermark last-page anchor | docx-worker 1.14.78/79 | Body-level sentinel + page anchor; AI notice in last rendered page, no extra page (AI-WATERMARK-EXPORT-LOCATION-001). |

---

## OPEN ISSUES

| ID | Sev | One-line | Where it lives | Gating |
|---|---|---|---|---|
| SIGNIN-GATE-HARDREFRESH-001 | P1 | Sign-in/Loading gate hangs on hard-refresh; need a 2nd browser reload before PDF export is good. Suspected regression. | `antcv-login-loading-gate.js`; cloud-restore (728/731/732); SW cache churn | Deterministic — needs live repro signed-in on antcv.pages.dev |
| JD-FETCH-EIGHTFOLD-GARBLED-001 | P2 | **[SHIPPED proxy+demo-proxy 3.6.0]** JD-URL fetch of NVIDIA careers (eightfold.ai SPA) returned theme/config JSON not the JD. FIXED: `rewriteJobUrl` now routes eightfold `/careers/job/<id>` to the `/api/apply/v2/jobs/<id>` position API (clean JSON `job_description`), graceful HTML-pipeline fallback on any miss, + theme/config-blob backstop in `validateContentQuality`. Diag 13/13 incl. live NVIDIA API probe. | `workers/{proxy,demo-proxy}/src/fetch-jd-url.js` | Deployed |
| EXPORT-PDF-RACE-001 (item I) | P1 | First PDF export still falls back to browser-print until a refresh; worker URL / `B` (demo_mode/is_admin) hydration incomplete at first click. | `app.src.js` export gate; `antcv-docx-client.js` | Deterministic — await config/B before export decision |
| PROFILE/CL placeholders after "analysis ready" (item 7) | P1 | Completeness panel flags 6 sections (PROFILE, CORE row 1, EXPERIENCE role 0, Opening, WHO I AM, WHY) AFTER analysis-ready; analysis commits independently of cv/cl overrides. | `app.src.js ~24595 o()`, ~24784 complete handler; `antcv-kernel-completeness-290.js` | Regen-gated (render GABRIEL_BG to capture response) |
| Page-break misplaced + section-scoped break (item 2) | P2 | Auto page-break landed AFTER a role not BEFORE; manual break is row-scoped, doesn't push following SECTIONS. | autoPages; salmon split; docx-worker | Regen + worker verify |
| AI-Notice overlap (item 3) | P2 | Watermark rams into the END of the longer main column in the CV. | docx-worker placement; `design-rules-watermark-table` | Owner PDF verify |
| TENSE uniformly chosen (item D residual) | P2 | Results follow chosen tense on refresh; role BULLETS only follow on next regen — owner wants chosen tense everywhere. | `__tenseRule` prompt; `applyOutcomesMode` fold | Regen-gated for bullets |
| Role ORDER reverse-chron (item E) | P2 | Meprolight 2013 must sort before Security Guard 2010 (end-date desc). | generation + 415 + lamination re-order | Regen-gated |
| Twin-tables share focus (item J / 736 note) | P2 | CV CORE Focus == CL WHAT I BRING Focus; deterministic pass can drop/rename but not write distinct expertise. | prompt BRING-DISTINCT-001; sanitizeForExport | Regen-gated (content) |
| IDF fabrication (items F/G) | P2 | "free-space optical / NIR-SWIR fusion" on IDF sys-admin role is wrong-role + fabricated; INTERESTS shows "[Label]: [Value]". | prompt; `gabriel-cv-facts` | Regen-gated |
| CJLR export parity (item 5) | P3 | docx-worker rowAlign default must match preview (header center, body justify). | docx-worker; 234 sidecar | Worker verify |
| placeholder-export-guard (CI ×2) | P3 | **[VERIFIED NOT REPRODUCING — closed 2026-06-21]** Investigated: `antcv-docx-client.js` `normalizeSections` runs strip BEFORE `bindOrphansInSections` (line 671), and `PLACEHOLDER_RE = /^\s*\[[^\]]*\]\s*$/` matches NBSP both at the edges (`\s` matches U+00A0) and inside the brackets (`[^\]]`) — so an NBSP-laden placeholder is still emptied. Handled since 1.50.656 (ORPHAN-NBSP-EXPORT-001). Added an explicit regression test (placeholder with internal+edge NBSP must strip). No code fix warranted. | `antcv-docx-client.js`; `pwa/test/unit/placeholder-export-guard.test.mjs` | Closed |
| EMDASH render-separator half | P3 | Display separators safe, but saved-application label/CL-header/deg-school readers split on `" — "` — each writer↔reader group must move atomically. | `app.src.js` writers/readers (see ACTIVE_BUGS) | Deterministic, coupled |
| FIGURE-GAP-DECOUPLE-001 | P3 | Figure→first-subsection gap is `bodyEdgePad`, not the subsection slider; owner may want a dedicated control. | `app.src.js ~41881` | Needs owner live repro |
| WIZARD-NO-SHOW-AFTER-DELETE-001 | P3 | After delete+re-login no welcome wizard; stale cloud `wizardCompleted` may survive delete. | `app.src.js ~14504`, cloud-restore filter | Needs live repro (cloud-loss risk) |
| PERSONAL-TAB-JANK-001 (remainder) | P3 | WritingStylePicker island empty placeholder + remount cascade. | `src/islands/**` rebuild | Islands rebuild |
| #D Phase C (per-style kernels) | P3 | Auto-load current style's kernel on switch + App-History selector. | `app.src.js` + mirror | New UI |
| SETTINGS-SCROLL-RESET | P3 | Auto-reset during settings scroll; instrumented, needs `window.AntcvErrorLog()` after it fires. | `settings-scroll-reset-red-herring` | Owner repro |
| PREVIEW-STYLE-FIDELITY A–F | P3 | Photo-shape/package-figure/band-colour not reaching preview render after reset/switch. | `body[data-package]` / stylePrefs preview render | Design-only (owner said don't code) |

---

## NIGHTLY FEATURE REQUESTS

- **JD-FETCH-EIGHTFOLD-GARBLED-001** (owner 2026-06-20, screenshot) — "allow proper reading of the NVIDIA position."
  Repro URL: `https://jobs.nvidia.com/careers/job/893395051166?domain=nvidia.com&hl=da` ("Test Engineer - Photonic | NVIDIA Corporation").
  SYMPTOM: the JD-ready chip got the correct title (JD-FETCH-CHIP-LABEL-001 working) but the fetched BODY is ~50000 chars of the page's **theme/config JSON** (`{"themeOptions":{"name":"PCS Default","customTheme":{"varTheme":{"primary-color-100":"#000000", … "button-primary-background-color":"#76b900" …}}}}`), not the job text. The `⚠ Text may be garbled` warning (`app.src.js:39545`) fired, but the garbage still loaded into the JD field.
  ROOT: `jobs.nvidia.com` is an **eightfold.ai SPA** — the JD is rendered client-side from an API; the server HTML carries only the bootstrap config/theme blob. `extractMainContent` (L1, `workers/{proxy,demo-proxy}/src/fetch-jd-url.js`) found no real JD body and fell back to a text-density dump of that config blob; it overran `MAX_TEXT_CHARS` (50000) and `validateContentQuality` didn't recognise a CSS-token/JSON soup as low-quality.
  FIX DIRECTION (worker, both proxy + demo-proxy + the inlined bundle): (1) **L2 `rewriteJobUrl`** — add an eightfold provider rewrite: `jobs.nvidia.com/careers/job/<ID>` → the public eightfold position API (e.g. `https://nvidia.eightfold.ai/api/apply/v2/jobs/<ID>` / the `positions` JSON endpoint) and extract the JD field from JSON — mirrors the existing LinkedIn guest-endpoint rewrite. (2) **Backstop in `validateContentQuality`** — detect a config/theme blob (high ratio of `"…-color…":"#hex"` / JSON-key density, or a leading `{"themeOptions"`) and FAIL to the manual-paste prompt instead of returning the garbage as JD text. Verify with `workers/demo-proxy/test/diag-linkedin-jd.mjs` as the pattern (add a NVIDIA/eightfold diag). Worker change → manual deploy, live fetch verify.

- **JD-FETCH-CHIP-LABEL-001** — add Job + company name as first lines in the green JD-ready chip (`app.src.js ~39349-39362`; data is `zt.fileName` set at `app.src.js:13984`). Cosmetic, low-risk; wrap chip in `flexDirection:"column"`, mirror to app.js. **[SHIPPED 1.50.740]**
- **Cluster-demand worker pipeline** (CLUSTER-QUAL-001 §3) — D1 tables + 60 seed rows exist; need proxy JD-qualification extraction → `cluster_top_qualifications` recompute → `application_fit` scoring → generation-prompt visibility. cv-proxy + demo-proxy deploys + regen.
- **Cluster-demand nightly refresh** (§7.6) — antcv-nightly job to sharpen the remaining 9 categories + tighten the 3 seeded from live recruitment-site research; merge as `source='research'`, real user-JD signal overtakes it. Respect robots/ToS; never fabricate.
- **Cluster-demand Bundle B** — surface JobSearchTargeting card on the wizard + a kernel-settings anchor.
- **SPELL-FI-VOIKKO-001** — real Finnish spell-check via Voikko WASM (Hunspell can't do agglutinative fi; no `dictionary-fi` on jsDelivr). Wire into `antcv-spell-annotator-384.js`; drop the "Voikko soon" badge on completion.
- **Analyse-JD-URL on upload step** — pre-fill needs synchronous step write + native-setter React fill (`jd-url-input-upload-step`).
- **Analysis-panel-merge** — Analysis panel exports a branded AI-watermarked PDF; jd-analysis API returns assumptions/recommendations/confidence_notes (`analysis-report-pdf`).

---

## ⚠️ DO NOT REGRESS — today's benefits (1.50.728–736)

The nightly must NOT undo any of these. Each is the targeting-persistence + export-sanitize chain that made a Nordea JD generation produce a first-class targeted application (not "Unsolicited") with clean tools and consolidated experience. Mirror discipline: names DIFFER in app.js (see per-item minified aliases). Verify PAST the sign-in gate, not boot-smoke.

- [ ] **AUTO-COMMIT-001 (1.50.732)** — a drifted real-company generation becomes a first-class active application.
  - File/fn: `app.src.js:15914` (auto-sync drift point, log `[apps] auto-sync skipped — io.company drifted`) + app.js mirror. Minified aliases: `oo=vo, Ml=ts, ro=xo, yo=Lo, io=So, lo=Ro, ao=Eo, __norm=n, zt=tn, Vt=cn`.
  - Does: reuse/`oo.create({save_as_new})` a row for the drifted company, `oo.update` sections/meta/rationale, `Ml()` set-active, stamp `antcv:activeAppCompany`; per-company in-flight flag dedup.
  - PROBE: generate Nordea (URL JD) → application label/subtitle/breadcrumb reads **Nordea** and stays; console shows the drift line resolving to a committed row, NOT a perpetual "skipped". `localStorage['antcv:activeAppCompany']` == the targeted company.

- [ ] **META-DRIFT-GUARD-001 (1.50.731)** — unsolicited kernel cloud-restore can't revert a targeted draft.
  - File/fn: `app.src.js:19596` (before the restore `lo()`/`ao()`) + mirror.
  - Does: if in-memory `io.company` is real (non-empty, not "unsolicited") and the cloud row is unsolicited/empty, KEEP the draft. Cold-start `io.company` empty → guard inert.
  - PROBE: generate Nordea → CL stays Nordea (no mid-session flip back to Unsolicited). On a clean cold-start (no draft) the unsolicited kernel still loads.

- [ ] **CLAMP-GUARD-001 (1.50.728)** — unsolicited-row clamp can't wipe a freshly-attached JD.
  - File/fn: `app.src.js:19643` + mirror. `zt` = fresh JD source this session (method url-fetch/paste/file).
  - Does: skip the `Vt("")` JD-textarea clear when `zt` carries a real JD (not the UNSOLICITED stub / "Manual save"). A merely stale pinned `jd_text` with no `zt` source is still clamped (ghost-company guard intact).
  - PROBE: fetch a JD URL → the JD textarea retains its text through an auto-sync tick; the company gate keeps the JD's company (not forced Unsolicited).

- [ ] **CATEGORIZE-ON-ATTACH-001 (1.50.729)** — a row with a real JD company is categorized `targeted`.
  - File/fn: `app.src.js:14340` (app-save handler) + mirror. `r` = genuinely unsolicited (stub JD / company "Unsolicited").
  - Does: `category: r ? "unsolicited" : "targeted"` instead of hardcoded `"unsolicited"`.
  - PROBE: save/regenerate a JD-named app → its stored `category` is `targeted`; `__isUnsolicited` is false; the CL reads as a targeted application.

- [ ] **EXPORT-SANITIZE-001 (1.50.734)** — strip fabricated tools + hide irrelevant roles at export.
  - File/fn: `antcv-docx-client.js sanitizeForExport()` (~line 516, wraps the export transform). Also `antcv-sections-normalize-415.js` FABRICATED_TOOLS regex fixed to `/snowflake|dbt/i`.
  - Does: ALWAYS strip Snowflake/DBT from any tools comma-list; for a JD-targeted app hide student-council + dormitory-security-guard via `on:false` — ephemeral per-export (switching back to the unsolicited kernel keeps full breadth, no persistence corruption). Runs at document-build time (race-proof vs the React-vs-localStorage drift).
  - PROBE: export the Nordea PDF → no Snowflake/DBT anywhere in tools; student-council / dormitory security-guard absent. Then switch to the unsolicited kernel → those roles + full tool breadth return (no permanent deletion).

- [ ] **415 stripFabricatedTools regex fix (1.50.734)** — split on real whitespace+comma.
  - File/fn: `antcv-sections-normalize-415.js` — split regex is `/\s*,\s*/` (NOT the broken literal `/s*,s*/`); FABRICATED_TOOLS cleaned of injected backspace chars.
  - PROBE: a tools value like `"SQL, Snowflake, dbt, Python"` normalises to `"SQL, Python"` (commas correctly split; no literal-`s` mis-split). Confirm no stray control chars in FABRICATED_TOOLS.

- [ ] **Table-cell tools strip (1.50.736)** — the SECOND Snowflake location.
  - File/fn: `sanitizeForExport` + 415 `stripFabricatedTools` extended to table row cells; export builds tables from `s.rows` (~line 1635).
  - PROBE: CORE COMPETENCIES expertise cell `"SQL, Snowflake, data transformation jobs"` exports as `"SQL, data transformation jobs"`.

- [ ] **EXPORT-MERGE-001 (1.50.735)** — consolidate same-company roles for a targeted export.
  - File/fn: `antcv-docx-client.js mergeSameCompanyRoles()` inside `sanitizeForExport`, runs AFTER the irrelevant-role hide (so only VISIBLE same-company roles merge).
  - Does: merge Innoviz (Change Control + System Architect), Meprolight (EO Team Leader + R&D EO Engineer), TAU (Research + Teaching Assistant); join distinct titles, union+dedup bullets, order by analyst/JD relevance, cap 6, widen year range. Export-only + ephemeral.
  - PROBE: Nordea export → Innoviz/Meprolight/TAU each appear ONCE with merged bullets; Sirin's lone optics role stays standalone; hidden TAU security-guard/students-council do NOT re-appear via the merge.

- [ ] **EXPERIENCE-TAILOR-001 (1.50.733)** — prompt rule: consolidate + prune experience for a targeted JD.
  - File/fn: prompt rule in `app.src.js` + app.js mirror. Regen-gated; never fabricates — only hides/merges what the kernel contains; unsolicited kernel keeps full breadth.
  - PROBE (render GABRIEL_BG): regen a targeted Nordea app → closely-related same-company roles consolidate, JD-irrelevant roles hidden; an unsolicited regen keeps everything.

- [ ] **DOC-DISTINCT-001 (1.50.726)** — CV and CL must differ in content + headline.
  - File/fn: prompt rule, `app.src.js` + mirror. Regen-gated.
  - PROBE (render GABRIEL_BG): CV and CL do not duplicate headline/body; distinct framing per document.

---

## STILL TODO from the 2026-06-20 owner batch

These are the deeper follow-ups the export-only fixes (734–736) deliberately did NOT close. They need real implementation, not ephemeral export patches.

1. **Preview parity** — make the app.js **preview** render reflect the export transforms: same-company merges (EXPORT-MERGE-001), irrelevant-role hides + Snowflake-strip (EXPORT-SANITIZE-001), and present-tense lamination. Today these live only in `sanitizeForExport` (`antcv-docx-client.js`), so the preview shows the un-sanitized React sections while the PDF shows the clean ones (the known React-vs-localStorage drift). Owner wants preview == export.

2. **Salmon-splitter pagination for preview pages 2/3** — the preview page-split (salmon splitter, PERMANENT — never remove `__antcvSalmon`) must place page breaks to match the worker export's pagination, including a section-scoped "everything from here down → next page" break (ties to OPEN item 2). Verify the salmon split AND the worker export break before a role / push following sections together.

3. **Twin-tables-at-generation** — the real fix for the CV CORE vs CL WHAT-I-BRING overlap (item J). A deterministic pass can rename/drop but cannot write distinct expertise. Needed: collect **distinct data signals** for WHAT-I-BRING vs CORE-COMPETENCIES at generation, give each table its **own seed + focus directions**, and enforce parity with each document (CV core ≠ CL bring), so the two tables are genuinely different content rather than post-hoc de-duped.

---

## UPDATE — 2026-06-20 PM (1.50.737–739)

### ⚠️ ROOT-CAUSE FOUND: stale service worker (the day's biggest issue)
For most of 2026-06-20 the owner's tab ran **`app.js?v=1.50.724`** while the network served the latest. Every "your fix didn't work" report (twin tables, preview tense, Results tense) was tested on **724**, not the shipped code. Two compounding bugs:
- The service worker pinned the tab to a stale `app.js`; the in-app **Hard Refresh** (and `antcv-hardrefresh-force-349.js`) did NOT pull the new version.
- `antcv-version-override.js` **rewrites the visible version chip to `TARGET_VERSION`**, so a stale tab still *displays* the latest number — masking the staleness completely.
- **Mitigation applied:** cleared the SW + caches on the live tab (localStorage data preserved); tab is now genuinely on the latest. Verified `AntcvTenseClause` present, preview bullets present-tense, sanitize active.
- **OPEN P1 = `SIGNIN-GATE-HARDREFRESH-001`** (already in OPEN ISSUES) is now confirmed as this stale-SW failure. NIGHTLY MUST FIX: make Hard Refresh truly update (skipWaiting + clients.claim + navigation reload), and STOP the version-override from masking a stale actual version — show the REAL loaded `app.js?v` so staleness is visible. This is the highest-leverage fix: while it's broken, no other client-side fix reaches the owner.

### CLOSED today (PM)
| Item | Version | What |
|---|---|---|
| TENSE-PREVIEW-PARITY-001 | 737 | preview bullets show export tense (results mode) via `window.AntcvTenseClause`; text-only, edit paths intact |
| TABLE-DIRECTION-001 | 737 | prompt: distinct seeds + own direction per table (regen-gated; UNVERIFIED — owner was on 724) |
| TENSE-VERBMAP-EXPAND-002 / TENSE-HYPHEN-001 | 738 | Results stuck past: `_tenseLead` missed "align" + the regex broke on hyphen ("co-organised"→read "co"). Fixed both; +~50 verbs. Covers export AND preview Results (shared bridge) |
| EXPORT-HIDE-EXPAND | 739 | hide foreningsarbejde (always), IDF sysadmin (unless JD=IT/ops), PUBLICATIONS & PATENT section (unless JD=research). Export-only + ephemeral |

### Updated DO-NOT-REGRESS additions (737–739)
- `window.AntcvTenseClause` (docx-client) + the preview bullet wrapping (`app.src.js` bullet render, minified `value:W(("results"===E&&window.AntcvTenseClause?...)`). Probe: results-mode preview bullet leading verb matches the PDF.
- `_tenseLead` hyphen regex `[A-Za-z][A-Za-z-]*` + the expanded `_T_B2P`. Probe: `AntcvTenseClause('Specify x; aligned y; co-organised z')` → all present.
- `sanitizeForExport` hide set: IRRELEVANT_ROLE (+foreningsarbejde), CLUSTER_ROLE (sysadmin) gated on `_jdIsTechOps`, Publications/Patents gated on `_jdIsResearch`. Probe: targeted analyst export drops those, IT/research JD keeps them, kernel keeps all.

### STILL OPEN after today
1. **`SIGNIN-GATE-HARDREFRESH-001` (P1)** — stale-SW / masking version-override (above). Fix first.
2. **Twin tables still share** — owner reports overlap, but tested on 724. Re-verify TABLE-DIRECTION-001 on a fresh regen at ≥738. If still overlapping, the tables are likely **seeded from a shared source** (investigate the generation seed, not just the prompt); a deterministic no-shared-LABEL backstop in `sanitizeForExport` is the fallback.
3. **Preview parity for merges/hides** — needs a read-only "export preview" mode (editable preview can't show them: index-based edit paths).
4. **Salmon-splitter pages 2/3** — preview pagination to match export.
5. `antcv:lastJdText` was EMPTY on the live targeted app (jdLen=0) — the JD text isn't persisted with the targeted application, so the cluster gates (sysadmin/publications keep-for-IT/research) can't read it. Wire the JD text into the active application so cluster-aware logic works.

---

## UPDATE — 2026-06-21 nightly (1.50.744)

### CLOSED
| Item | Version | What |
|---|---|---|
| JD-FETCH-EIGHTFOLD-GARBLED-001 | proxy+demo-proxy 3.6.0 | **Owner-requested (NVIDIA).** `/api/fetch-jd-url` reads eightfold.ai career SPAs via the `/api/apply/v2/jobs/<id>?domain=…` position API (clean JSON `job_description`) instead of the theme/config blob the server HTML returns. `rewriteJobUrl` detects `/careers/job/<digits>` + an eightfold marker (`?domain=` param or `*.eightfold.ai` host); `tryEightfoldJson` parses JSON, strips HTML, prepends a role/dept/location header; falls back to the HTML pipeline on any miss (so a false-positive rewrite is harmless). Plus a config/theme-blob backstop in `validateContentQuality` for SPAs the rewrite doesn't cover. Diag `workers/proxy/test/diag-eightfold-jd.mjs` 13/13 incl. a LIVE NVIDIA API probe (200, 3079-char JD). Both worker copies identical. |
| CACHE-BUST-HYGIENE-001 | 744 | **Root-cause tooling for P1 SIGNIN-GATE-HARDREFRESH-001 / [[stale-sw-version-mask-hazard]].** New `scripts/check-cache-bust.mjs`: (a) `--range A..B` is a hard gate — for every cache-bustable asset (referenced with `?v=` in index.html) changed in the range, asserts its `?v=` line also moved (exit 1 otherwise); excludes the never-loaded source `app.src.js`. (b) default AUDIT mode (report-only; `--strict` to fail) reports numeric `?v` drift in index.html. Caught and FIXED the live drift: `antcv-version-override.js` was stuck at `?v=722` while its content advanced to 743 (6 releases) — the exact masking mechanism (un-bumped `?v` → SW/HTTP cache serves stale bytes while TARGET_VERSION advances → stale tab shows latest number). Quartet applied (index.html ?v 722→744, sw.js CACHE→744, TARGET_VERSION→744, STALE += 743/743b). 8 new unit tests (pure core, no git). Suite 347/347, boot-smoke clean. **Recommend wiring `node scripts/check-cache-bust.mjs --range origin/main..HEAD` into pre-push so this drift can never recur.** |

### Carried open (P1 remaining halves)
The DETERMINISTIC root cause of the stale-SW masking (un-bumped `?v`) now has a guard. STILL OPEN, needs live signed-in repro: (a) make in-app Hard Refresh GUARANTEE a fresh document (the SW skipWaiting/clients.claim + unregister path); (b) the de-masking half — stop `antcv-version-override.js` rewriting the chip when the actually-loaded `app.js` is stale. NOTE for the implementer: comparing `TARGET_VERSION` to the script-tag `app.js?v` is NOT a valid staleness signal — app.js legitimately stays at its last-change version (e.g. 742) across releases where it didn't change, so they differ by design. The true signal is app.js's BAKED version stamp (`console.log("[AntCV]", v)`; Layer A currently locks `window.ANTCV_VERSION` before app.js can set it) vs the requested `?v`. Needs a live repro to verify the stale path actually triggers before shipping (false-positive "stale" flagging would be worse than the current behaviour).

### Register additions (owner 2026-06-20/21)
- **JD-FETCH-EIGHTFOLD-GARBLED-001** (owner) — NVIDIA careers JD-URL fetch returns theme/config JSON, not the JD (eightfold.ai SPA). Full detail + fix direction under NIGHTLY FEATURE REQUESTS.

### OWNER BATCH — NVIDIA CV/CL exports + preview (2026-06-21, 14 items)
Grounded against the real NVIDIA PDFs + preview screenshots. **The chip read "Unsolicited" for the
NVIDIA targeted app and `antcv:lastJdText` was empty — so several items below are DOWNSTREAM of the
targeting-persistence / JD-not-persisted bug (P2), not independent render bugs.**

CV PREVIEW:
1. **Results still PAST tense (preview).** `[SHIPPED 1.50.748 — COPENHAGEN-TENSE-DEFAULT-001]` `_expTenseMode()` in `antcv-docx-client.js` now checks `stylePackage` first: Copenhagen Modern, Scandinavian, and the empty/default package always return `'present'` regardless of `expTense` setting. Other packages honour `expTense` as before. 7 unit tests in `test/unit/copenhagen-tense-default.test.mjs`. (Owner confirmed: "It is always default present for copenhagen. If the user select auto or past copenhagen will need to change.")
2. **Salmon sidebar break MUCH higher — Languages→page 2 (preview≠PDF).** `[OPEN — 745 only-adjust does NOT cover this case]` Screenshot: ALL sidebar (REGULATORY/LANGUAGES/INTERESTS/ACCESSIBILITY) on page 1 with dead space; page-2 sidebar EMPTY; the PDF fills page 1 + continues. So there's NO baseline preview sidebar break to "adjust" — the main column drives the page-box split and the (compact-px) sidebar fits page-box 1. FIX needs the FORCE variant: when the sidebar is SHORTER than main's page-1 box but the PDF (taller render) overflows, FORCE a preview sidebar break so the salmon matches the PDF. 745's only-adjust guard blocks exactly this. Must verify no oscillation in the both-columns case (the diag must cover sidebar-fits-but-PDF-overflows). The worker paginates the sidebar itself, so the PDF is already correct — preview-only fix.
3. **Undo for sidebar-width change.** `[OPEN — feature]` add an undo stack for `cvSidebarRatio`.
4. **Sidebar size + add/remove text must re-estimate salmons for ALL pages.** `[OPEN]` the measurer fingerprint (STYLE_KEYS) must include the width + content hash so a resize/edit re-triggers a full re-measure; verify cvSidebarRatio + sections hash are in the fingerprint and that it recomputes ALL page breaks, not just page 1.

CV CONTENT (preview+export, REGEN-GATED unless noted):
5. **Certifications: trim to job context** (rugby-coach cert irrelevant for a photonic-test job). Prompt: include only JD-relevant certs; OR a deterministic export hide of off-topic certs for a targeted app (like sanitizeForExport role-hide).
6. **Standards: ADD laser safety** (relevant to photonic testing) — kernel/data gap + prompt.
7. **Languages: drop "Uruguayan variant"** for this register — deterministic text strip (`Spanish: full professional, Uruguayan variant` → `…full professional`). Cleanest as a content normalizer/sanitize, but it's also just editable data. **`[SHIPPED 1.50.746 — antcv-orphan-cloud-persist-385.js stripUruguayan; 4 unit tests]`**
8. **Accessibility: trim 30-40%** for this job — needs a shorter rewrite (regen/prompt; not a pure strip).

CV↔CL:
9. **Twin tables still duplicate** (CV CORE vs CL WHAT I BRING). `[OPEN — likely downstream of #targeting: tables seeded from a shared source; regen-gated]` See STILL-TODO #3 (distinct seeds per table at generation).

CL PREVIEW:
10. **WHO I AM / WHY: heading AND colored inline label BOTH show.** `[SHIPPED 1.50.747]` Fixed in `app.src.js` + `app.js` mirror: the text_inline render no longer emits the `<b>` inline label for non-work_style sections, so only the H2 heading shows. `antcv-why-context-title.js` strip is now complementary (in-content label), not redundant.

CL CONTENT (preview+export):
11. **Opening label "WHO I AM:" → "Who I am:"** (sentence case, not all-caps). `[SHIPPED 1.50.747 — auto-resolved by #10]` Removing the inline label entirely (see #10) means no label to case-fix. H2 heading already uses sentence case.
12. **CL "Strategic Expertise" cells too long for nordic-minimal** — shorten (regen/prompt cell-cap; the existing TABLES-DISTINCT cell-cap rule should tighten the CL bring cells).
13. **"WHY YOUR COMPANY" → "WHY THIS ROLE" for a specific position.** `[render already correct — DATA-GATED]` `antcv-why-context-title.js` flips to "WHY THIS POSITION" when `antcv:lastJdText`≥30; it's empty for this app (the targeting-persistence bug), so the flip never fires. ROOT = persist the JD with the targeted app (P2). No render change needed once the JD is present. (Owner wants the wording "WHY THIS ROLE" — currently the specific title is "WHY THIS POSITION"; confirm exact wording.)
14. **CL paragraph needs ~3px more spacing from the table.** `[SHIPPED 1.50.747]` `app.src.js` + `app.js` mirror: `e.id==='bring'` gets `margin:"12px auto 4px"` in React preview (was `"8px auto 0"`) and `"5pt 0 3pt 0"` in DOCX HTML (was `"2pt 0 0 0"`). 3pt before + 3pt after the WHAT-I-BRING table. Worker export also receives the updated HTML margin.

**Triage:** #13 + (much of) #9 are downstream of the targeting-persistence/JD-empty bug (fix that first). #5,6,8,12 are regen-gated content/prompt. #2,3,4,10,11,14 are app.js/measurer render work — do in a FRESH session (app.js surgery at the tail of a long context risks the minified-mirror blue-screen). #7 is a near-trivial deterministic strip. #1 verify on ≥745 first (stale-SW suspect).

#### Owner corrections (2026-06-21, after the triage above) — AUTHORITATIVE
- **#1 (CONFIRMED real on 745, NOT stale-SW).** Root cause found: `_expTenseMode()` (`antcv-docx-client.js:1956`) returns `'auto'` unless `styleConfig.expTense==='present'`, and `_tenseLead` is a NO-OP in `'auto'` (`:1936`). The verb map is complete (owned→own, directed→direct, managed→manage, developed→develop). So Results stay past because the tense setting is not 'present' — this is the **tense-control persistence/default** problem (the LANGUAGES-CARD tense control), NOT a verb gap. Do NOT hard-force Results→present (TENSE-FULL-CLAUSE-001 keeps role+result the SAME tense). Fix = make the owner's Present choice actually stick + be read (or, if owner confirms, default Copenhagen Results to present).
- **#2 (my model was WRONG).** Owner: the preview does NOT "fit" — it puts MORE items on page 1 than a real (PDF) page holds. So the preview OVER-fills page 1 (no break) and must break EARLIER. There is no existing break to "only-adjust" → 745 does nothing here. FIX = FORCE a preview sidebar break at the real-page-equivalent (tightened) line even when the sidebar fits the 1123px page-box, so fewer items land on page 1 (Languages→page 2), matching the PDF. Must solve the attempt-1 oscillation (the break flipped between sidebar sections) — likely via stronger sticky/HOLD on the forced break, or breaking only the column that overfills. Fragile area — fresh session + the sidebar-overfills diag.
- **#7 (clarified).** Keep ENGLISH + HEBREW as native/fluent; only drop the "Uruguayan variant" qualifier from Spanish. Deterministic strip of ", Uruguayan variant"/"(Uruguayan…)" on the Spanish language line; never touch EN/HE.
- **#12 (clarified).** NOT cell string length — the cell CONTENT is too DETAILED (too much information) for nordic-minimal. Fix = prompt: generate terser, less-detailed Strategic-Expertise cells (fewer specifics), regen-gated.
- **#13 (resolved wording).** "Why this position" is fine. Keep the specific title "WHY THIS POSITION" (owner OK with it; render already flips correctly once the JD is present — still DATA-GATED by targeting persistence).

#### Two more (owner 2026-06-21) — SETTINGS bugs
- **SETTINGS-WRITINGSTYLE-STICKY-001** `[OPEN]` — the **Writing Styles (full) section is STICKY / bleeds onto OTHER settings subtabs.** The WritingStylePicker is a React island (built from `src/islands/*.tsx` → `pwa/antcv-react-islands.js` via `npm run build` — NOT app.js surgery; edit the .tsx). Symptom = the island (or its mount container) does not UNMOUNT when leaving Personal, or has a `position:sticky`/fixed container, so it stays visible over Account/Layout/etc. Same family as PERSONAL-TAB-JANK-001 (WritingStylePicker remount cascade) + `settings-subtab-placement`. FIX direction: unmount the island on subtab leave (or gate its render to the active subtab) + drop any sticky/fixed positioning on its wrapper. Verify headless: switch Settings subtabs and assert the writing-style DOM is gone off-Personal.
- **REVIEW-DATA-DEAD-001** `[OPEN]` — **"Review my data" button does nothing** (was REVIEW-DATA-001, the user-friendly reviewer modal, shipped 1.50.618). Lives in `pwa/antcv-data-export-360.js` (button + handler at ~419/648/830-874). The click no longer opens the reviewer. Likely: the modal-open handler isn't bound (DOM rebuilt after a render and the listener was lost), or an exception in the open path, or the button is a duplicate/dead node. FIX: reproduce, console-probe the click handler, re-bind via delegation (capture-phase on a stable ancestor) so it survives re-renders; confirm the reviewer modal opens with the user's data. Sidecar-only (no app.js mirror).

### Salmon follow-ups (owner 2026-06-22, after 1.50.749/750 force-break) — `[OPEN — need a live preview screenshot + visual verify]`
The FORCE break (1.50.749→750, factor now 1.20) correctly moves the right items to page 2, but two
salmon RENDER/MEASURER issues remain (NOT the force factor). Both are in the most blue-screen-prone
area and need the rendered preview to verify — do NOT blind-hack.
- **SALMON-EMPTY-REGION-001** — owner: "the empty region in preview is where the salmon between page 1
  and page 2 should actually be; the items' location is correct — just no empty space under them."
  i.e. after the forced break the page-1 column ends early and there's an empty region before the
  salmon (the page-box `min-height:1123` / the dead-gap-above-salmon in the shorter column, see
  [[salmon-splitter-permanent]] "dead gap ABOVE the salmon"). The salmon should sit right AFTER the
  last page-1 item (no gap). Fix = the CV page-box render (app.src.js, the full-width page-box
  separator at ~37810 + antcv-page-fit `min-height`) — let the page-1 box end at content when a
  break pushed the tail away, OR draw the salmon at the content end. Needs a live screenshot to see
  which column has the gap + verify the A4-look isn't broken.
- **SALMON-EMPTY-REGION confirmation (owner screenshots 2026-06-22):** on page 1 the SIDEBAR column
  (TOOLS & METHODS) ends well above the full-width salmon, leaving a visible empty band; the MAIN
  column fills lower. So it's the shorter-column (sidebar) dead-gap — worsened by the 749/750 FORCE
  (which moves sidebar items to page 2, shortening the page-1 sidebar). The A4 page-box `min-height`
  holds the box tall so the gap shows. Tension: force-items-to-page-2 (owner wants) vs no-gap — only
  reconcilable by ending the page-1 box at content / drawing the salmon at the taller-column content
  end, not the A4 line. Needs the render change + visual verify.
  **DECISION — OPTION A (owner 2026-06-22):** end each page-box at the TALLER column's CONTENT end and
  draw the salmon there — NOT at the fixed A4 line. Rationale (owner): "in the PDF there is no gap, so
  the salmon will fit the actual PDF." The A4-look change is ACCEPTED. Fix = the CV page-box sizes to
  content (relax/drop `antcv-page-fit min-height:1123` for a box whose tail was paginated away) so the
  salmon sits flush under the last item, matching the PDF's natural break.
- **SALMON-PAGE3-MISSING-001** — owner: "page 3 salmon is missing — page 3 break should have been
  around the SECURITY GUARD role." CONFIRMED in code: the measurer
  `antcv-auto-pagebreak-block-001.js` only ever writes `=2` (lines 536/576) — it is **2-page scope**
  (line 547), so a 3-page CV gets the page1→2 salmon but NO page2→3 break. Fix = extend the measurer
  to N pages: loop the overflow detection across successive A4 lines and write `=2, =3, …` at each
  crossing (+ the render's monotonic page floor already cascades). Fragile measurer change — verify
  on a real 3-page CV (before/after) + boot-smoke + export-map untouched.

### SALMON-SIDEBAR-BREAK-EARLY-001 (owner 2026-06-21) — `[SHIPPED 1.50.749 — FORCE variant, preview-only]`
**FORCE variant SHIPPED 1.50.749 (the owner's actual case).** The preview OVER-fills page 1 (packs
more sidebar items than the taller-rendered PDF page holds), so the sidebar fits the 1123px page-box
and gets NO break (page-2 sidebar empty) while the PDF continues it to page 2. `antcv-auto-pagebreak-block-001.js`
now FORCES a preview sidebar break at the tightened line `usableBase/SIDEBAR_PREVIEW_INFLATE` (default
**1.32**, console-tunable `AntcvAutoPagebreak.config({SIDEBAR_PREVIEW_INFLATE:N})`) EVEN WHEN it fits
the normal A4 line. SAFE: PREVIEW MAP ONLY (the export/DOCX `autoPages` sidebar break is untouched —
the create + clear paths both gate on `autoKey===PREVIEW_KEY`); the matching TIGHTENED clear-line
prevents the attempt-1 oscillation. Verified `pwa/test/diag-sidebar-preview-break.mjs` (real 2-page CV,
main-breaks + sidebar-fits case): force OFF (1.0) → no preview sidebar break; force ON (1.32) →
preview break created (content to page 2), EXPORT break UNCHANGED, STABLE across repeats, 0 errors,
boot-smoke clean, suite green. Owner tunes the height live. Prior `[1.50.745 only-adjust]` note below.

`[1.50.745 — only-adjust, preview-only — superseded by the FORCE variant above]`
**SHIPPED (2nd attempt, safe):** `antcv-auto-pagebreak-block-001.js` now pulls an ALREADY-EXISTING
preview sidebar break UP by `SIDEBAR_PREVIEW_INFLATE` (1.16, console-tunable) so the preview salmon
matches the higher DOCX break. SAFE by construction: (1) PREVIEW MAP ONLY — the export/DOCX
`autoPages` sidebar break is untouched (owner: removing it breaks the DOCX); (2) ONLY-ADJUST,
NEVER-FORCE — if the sidebar fits the normal A4 line (rides the main column's pagination) it creates
nothing, so no spurious break, no oscillation, no export coupling (the failure modes of the 1st
attempt). Verified by `pwa/test/diag-sidebar-preview-break.mjs` (real 2-page CV, sidebar-overflows
case): baseline preview break idx 4 → with factor idx 1 (= the DOCX break, salmon now matches the
PDF); export break unchanged; stable across repeats (no oscillation); 0 errors; boot-smoke clean;
suite 348/348. The owner can dial the height live: `AntcvAutoPagebreak.config({SIDEBAR_PREVIEW_INFLATE:N})`.
Original investigation (1st attempt reverted) kept below for context.

`[1st attempt — ATTEMPTED, REVERTED — superseded by the safe version above]`
Owner: "set position of a new salmon splitter much closer to the estimated end of main's
first page and move more sidebar elements to page 2 (the miss for the sidebar is not by one
item, more 2-3 subsubsections)." i.e. the PREVIEW sidebar salmon breaks 2-3 subsubsections too
LATE vs the PDF (P4 in NIGHTLY_PROMPT_2026-06-21).
- **Measurer location (CORRECTED):** `pwa/antcv-auto-pagebreak-block-001.js` (a SIDECAR — NO app.js
  mirror), function `compute(usableBase, autoKey, tight)`. Preview map = `antcv:autoPagesPreview`
  at `USABLE`≈1053px; export map = `antcv:autoPages` at `USABLE_PDF`≈924px. The per-column create
  limit is `usableBase*scale` (~line 441); the clear/fit-line is `(usableBase-hyst)*scale` (~375).
  (The brief's "app.src.js ~17752" pointer is WRONG — that's the orphan-word estimator `Gi`/`Vi`.)
- **Attempt:** added a `SIDEBAR_PREVIEW_INFLATE` (1.20) that shrank ONLY the preview-pass sidebar
  limit (gated `!isMainCol && autoKey===PREVIEW_KEY`), applied to both the create AND clear lines.
- **Why REVERTED (caught by `pwa/test/diag-sidebar-preview-break.mjs`, a real 2-page-CV Playwright
  A/B):** unconditionally tightening the sidebar line is UNSAFE. When the MAIN column drives
  pagination (e.g. an experience break splits the page into 2 boxes) the sidebar simply FLOWS
  alongside and needs no break of its own. The factor FORCES a spurious sidebar break on top of
  the main break → the maps OSCILLATE across the measurer's own timer cycles (break flips
  skills↔additional) AND the EXPORT map gains a sidebar break (`autoPages.additional`) — which the
  worker would try to honour and SCRAMBLE THE PDF (the exact auto-overflow-362 standdown failure).
  A/B proof: with the factor neutralized to 1.0 the same CV is STABLE with a clean export map; at
  1.20 it oscillates + couples. boot-smoke stayed clean (no crash) — the risk is PDF/jank, not a
  blue-screen, but it still violates "an end result, not a brickable mid product," so HELD.
- **Refined SAFE direction (for next run):** only pull the sidebar break up when the SIDEBAR is
  genuinely the longest/overflowing column (sidebar-DRIVEN pagination — sidebar content height >
  main content height for page 1), NOT when the main column already drives the break. AND hard-
  guarantee the EXPORT map never receives a sidebar break from this path (the worker owns sidebar
  pagination). Needs a diag that reproduces the SIDEBAR-LONGER-THAN-MAIN case (the owner's actual
  layout), then verify export stays `{experience}`-only and the preview break is stable across
  cycles. The factor is the right lever once correctly GATED; it is console-tunable via
  `AntcvAutoPagebreak.config({ SIDEBAR_PREVIEW_INFLATE: N })` in the attempted patch. Diag harness
  `pwa/test/diag-sidebar-preview-break.mjs` is committed for the next attempt.

---

## UPDATE — 2026-06-21 nightly (pre-push cache-bust gate; no version bump — tooling only)

### CLOSED
| Item | What |
|---|---|
| CACHE-BUST-HYGIENE-002 (pre-push gate) | **The other half of P1's deterministic root cause.** 744 shipped the `check-cache-bust.mjs` checker + recommended wiring `--range` into pre-push so the ?v drift can never recur. Done: new committed hook `scripts/git-hooks/pre-push` runs `node scripts/check-cache-bust.mjs --range <upstream>..HEAD` and BLOCKS a push when a pwa asset changed in the pushed commits without its `?v=` moving in `index.html`. Installed into this clone's `.git/hooks/pre-push`. SAFETY: blocks ONLY on a genuine detected offender (check exit 1); any infra problem (no upstream ref / node missing / other exit code) ALLOWS the push (warn, never spuriously block); dormant historical drift on unchanged files is NOT flagged (range mode inspects only the pushed commits). Bypass a false alarm with `git push --no-verify`. Install in other clones: `cp scripts/git-hooks/pre-push .git/hooks/pre-push` (Git for Windows runs it via bundled sh.exe; no chmod needed). VERIFIED: the 8 `cache-bust-hygiene.test.mjs` unit tests pass; the gate flags the real 743 drift range (`5a085b6~1..5a085b6` → ✗ antcv-docx-client.js + antcv-version-override.js, exit 1) and passes the 743b-fix + docs-only ranges (exit 0); an end-to-end probe (temp branch, pwa asset changed without ?v bump, upstream=main) blocks with exit 1; cleanup restored `main`. |

### NOTE — held WIP found in the working tree (NOT touched)
`pwa/antcv-auto-pagebreak-block-001.js` carries an **uncommitted** SIDEBAR-PREVIEW-BREAK-EARLY-001
attempt (the P4 salmon factor — ~33 lines, the "ONLY-ADJUST/NEVER-FORCE, PREVIEW-MAP-ONLY" gated
re-attempt). HEAD's committed copy is the safe reverted version (the factor is working-tree-only).
This nightly **left it exactly as found** — it is the owner's held P4 work, not this run's change,
and was not staged. If it is stale, `git checkout -- pwa/antcv-auto-pagebreak-block-001.js` discards it.

---

## UPDATE — 2026-06-22 cloud routine (1.50.746–748)

Owner NVIDIA CV/CL batch items worked in order (P4→P5→P2); P1 and P3 deferred (gated / Playwright).

### CLOSED
| Item | Version | What |
|---|---|---|
| P5 #7 Uruguayan variant strip | 1.50.746 | `_stripUruguayan()` in `antcv-orphan-cloud-persist-385.js` strips `, Uruguayan variant` / `(Uruguayan…)` qualifier from the Spanish language line at cloud-save and export time. English + Hebrew untouched. 4 unit tests in `test/unit/uruguayan-variant-strip.test.mjs`. |
| P4 #10 CL inline label hidden | 1.50.747 | `app.src.js` + `app.js` mirror: text_inline render no longer emits the colored `<b>` label for non-work_style sections (WHO I AM, WHY, etc.). Only the H2 heading shows — no duplicate. |
| P4 #11 Sentence case | 1.50.747 | Auto-resolved by #10: no inline label → no label to case-fix. H2 already sentence-case. |
| P4 #14 WHAT-I-BRING table spacing | 1.50.747 | `e.id==='bring'` gets 3pt before + 3pt after in both React preview (`margin:"12px auto 4px"`) and DOCX HTML (`"5pt 0 3pt 0"`). Both `app.src.js` + `app.js` mirrored. |
| P2 COPENHAGEN-TENSE-DEFAULT-001 | 1.50.748 | `_expTenseMode()` in `antcv-docx-client.js` checks `stylePackage` first. Copenhagen Modern / Scandinavian / empty (default) always return `'present'` regardless of `expTense` — it is a property of the package, not a user setting. Other packages honour `expTense` as before (auto/past/present). 7 unit tests in `test/unit/copenhagen-tense-default.test.mjs`. 3 pre-existing tense tests updated to use `nordic-minimal` so the 'past'/'auto' paths are still exercised. Suite: 359/359. |

### Deferred
| Item | Why |
|---|---|
| P1 Targeting persistence / JD-persist | Architectural — needs live repro + `app.src.js:15914/19596/19643/14340` surgery + owner verification of the targeting chain. Not cloud-routine safe without headless auth. |
| P3 Salmon sidebar FORCE break (#2) | `[SHIPPED 1.50.749]` |
