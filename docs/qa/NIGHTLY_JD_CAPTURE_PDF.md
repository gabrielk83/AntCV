# NIGHTLY WORK ORDER — JD capture PDF (URL-fetched JDs)

> **NIGHT SHIFT (parallel-session safety):** before editing, `git pull --rebase origin main` then `node scripts/shift.mjs claim --task "<what>"` and work in the printed `git worktree`; use version numbers only inside your claimed range; `node scripts/shift.mjs release` when done. See `docs/qa/NIGHT_SHIFT.md`.

Owner brief (2026-07-02): "if JD is fetched from URL, offer a service (a checkbox in
the settings menu) of: exporting a PDF copy of the JD, which also includes the
website URL, the contact person details, the company name and address (find the
address most relevant for the ad), the date the JD was captured, and a summary of
the fit to candidate and red flags."

Why it matters (product): job ads get taken down; the applicant loses the text they
applied against. The capture PDF is the applicant's dated evidence file: what was
asked, who to contact, where, and how they matched it on that day.

MULTI-RUN order (expected 2 runs). Same discipline as the other nightly orders:
SYNC FIRST, read STATUS, next unchecked phase, verify, update STATUS + run log, push.
Hard rules: identical to docs/qa/NIGHTLY_MULTIRUN_LANG_STYLES.md (quintet, app.js
minified-sacred, canonical test runner, verify-first, current version from
index.html).

## STATUS (update every run)

- [ ] R1 Capture metadata + analysis schema + PDF section renderer
- [ ] R2 Settings checkbox + export wiring + owner eyeball

Run log:
- (none yet)

## Ground truth (verified 2026-07-02)

- jd-analysis (workers/demo-proxy/src/jd-analysis.js, proxy mirror) ALREADY returns
  `recruiter { name, title, email, linkedin, notes }` (never-invent rules, footer
  scan hints, lines ~41/76-83) and `red_flags: string[]` (~50/99). Fit content exists
  in the analysis panel (fit/gap, salary, recommendations; UPPER-REPORT-REORG-001
  1.51.54 added the Recruiter card).
- Branded AI-watermarked analysis PDF already ships: pwa/antcv-analysis-report-pdf-360.js
  (1.51.54 gave it Salary + full upper parity). The JD capture PDF should REUSE this
  pipeline (same branding, same AI-notice convention), not build a second PDF stack.
- JD URL entry points: JD-URL input on the upload step (Nt step state; native-setter
  fill), Android share-target stash `antcv:sharedJdUrl:v1`
  (antcv-share-target-jd-375.js:33), proxy-side fetchers incl. eightfold SPA handling
  (proxy 3.6.0). JD text lands in `antcv:lastJdText`.
- MISSING today: the source URL + fetch timestamp are not persisted; company address
  is not in the analysis schema; no settings toggle; no JD-copy PDF.

## R1 — capture metadata + schema + renderer

1. Capture metadata at fetch time: whenever a JD is fetched FROM A URL (all three
   entry points above), stash `antcv:lastJdCapture = { url, fetchedAt(ISO), source:
   'url'|'share'|'paste' }` next to lastJdText, and clear/rewrite it whenever
   lastJdText is rewritten (the 1.51.54/55 stub-proofing writers are the exact write
   sites - extend them, do not add a fourth writer). Paste/PDF-upload JDs get
   source:'paste' and NO url - the capture PDF service is URL-only per the brief
   (checkbox stays hidden or disabled with a hint when there is no URL).
2. Analysis schema: add `company_address` to jd-analysis output: the address MOST
   RELEVANT to the ad - precedence (a) explicit work-site address in the JD, (b)
   office/location the role names (city + street if present), (c) company address in
   the JD footer/imprint, (d) null. NEVER invent or complete an address; copy
   verbatim fragments (city-only is fine). Mirror proxy + demo-proxy byte-identical
   (jd-analysis drift hazard - see persona-contamination-family memory). If the
   fetched PAGE HTML (not just JD text) is available server-side, allow footer/
   contact-page text as source (b/c) - still verbatim-only.
3. PDF content model (extend antcv-analysis-report-pdf-360.js with a "JD capture"
   document type):
   - Header: Company name, role title, capture date ("Captured 2026-07-02 14:32,
     from <URL>", URL printed AND clickable).
   - Contact block: recruiter name/title/email/linkedin (only fields present).
   - Company block: name + company_address (only if present; no invention).
   - Fit summary: the analysis fit/gap digest (reuse the panel's existing fit
     content; 5-8 lines max) - clearly marked as AI analysis (existing AI-notice
     convention + watermark).
   - Red flags: the red_flags list, verbatim from analysis.
   - Body: the FULL JD text, verbatim, monospace-free normal typesetting, page
     numbers; garbled segments kept as-is (they are themselves evidence).
   - Footer: AntCV branding consistent with the analysis report.
4. Filename: `JD_<Company>_<Role>_<YYYYMMDD>.pdf` (sanitized, no diacritics -
   mirror docx-client filename rules).
5. Tests: unit - capture stash written/cleared at all three entry points; schema
   round-trip with company_address (null-safe); PDF builder given a fixture analysis
   + JD produces all seven blocks and omits absent ones. Diag - drive the real
   pdf path with the NIL JD fixture (Downloads/NIL_JD_extracted.txt content is in
   the repo test data? if not, use anita + a synthetic JD).

## R2 — settings checkbox + export wiring

1. Settings: checkbox "Also export a PDF copy of fetched job ads" (Settings, near
   the export preferences; persist in a STANDALONE localStorage key
   `antcv:jdCapturePdf` - NOT personalInfo.stylePrefs, see sidecar-prefs-clobber
   memory - cloud-synced via the prefs channel if trivial).
2. Wiring: when the checkbox is ON and lastJdCapture.source === 'url':
   (a) the export flow (CV/CL export buttons) ALSO produces the JD capture PDF, and
   (b) the analysis panel gets an explicit "Export JD copy (PDF)" action so it works
   without a full application export. OFF or no URL -> nothing changes anywhere.
3. Analysis freshness: if the analysis in storage predates the current lastJdText
   (hash or timestamp check), regenerate or mark the fit/red-flags blocks "analysis
   from <date>" - the capture PDF must never pair yesterday's fit summary with
   today's JD silently.
4. Verify: suite + boot-smoke; one real URL fetch end-to-end (eightfold and a plain
   posting) producing the PDF; owner eyeball on the PDF layout. Quintet on all pwa
   changes; deploy workers via deploy.yml (jd-analysis schema change is
   backward-compatible - additive field only).

## Risks / do-not

- NEVER invent contact or address data - absent fields are omitted, not filled.
  (Same anti-fabrication floor as generation.)
- Do not add a fourth lastJdText writer; extend the stub-proofed ones (1.51.54/55).
- proxy/demo-proxy jd-analysis must stay byte-identical after the schema change.
- The JD text in the PDF is the ORIGINAL fetched text - never the compressed or
  reworded variant used in prompts.
- Copyright note: the capture PDF is for the applicant's own records (private use);
  do not add share/publish affordances around it.
