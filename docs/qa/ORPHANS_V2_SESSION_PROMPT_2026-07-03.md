# ORPHANS V2 session — 2026-07-03 (owner-dispatched, fresh session)

One goal: **kill the remaining orphan runts in roles + profile** by building the v2
architecture (export-metric measurer + export preflight). One solid, verified ship
beats partial coverage. Owner: Gabriel. Style: direct, compressed, no filler.

## State at dispatch
- `main` = PWA **1.51.55** · docx-worker **1.14.120** (deployed) · access-relay 1.3.2.
- Suite **623/623** via `node scripts/run-tests.mjs pwa` (NEVER raw `node --test` — it
  hangs on the PRV-004 watchdog; the runner adds `--test-force-exit`).
- Orphan L1+L2+L3 shipped and text-verified (ORPHAN-WRITE-VERIFY-001, 1.51.52), but
  **13 multi-word runts survived export 16** because the measurer uses PREVIEW line
  breaks and the PDF breaks lines differently (font + column width differ), plus the
  0.32 threshold is too lax.

## Read FIRST, in this order
1. `CLAUDE.md` (repo discipline: app.js is minified-sacred; cache-bust quintet; sync-first).
2. `docs/qa/ORPHAN_ARCHITECTURE_2026-07-02.md` **§7–9 in full** — the v2 design:
   - **EXPORT-METRIC-MEASURE-001**: an offscreen measurer that reproduces the EXPORT
     metrics (export font family/size + real export column width) so measured line
     breaks match the DOCX/PDF, not the preview.
   - **EXPORT-PREFLIGHT-ORPHANS-001**: a batched, awaited L3 pass INSIDE
     `exportDocxViaWorker` — runs before the payload is built, 12s total timeout,
     re-measure gate after each fix, `RUNT_FRAC 0.40`.
3. Auto-memory `orphan-measure-bind` — L3 once CORRUPTED data via preview-index
   writes. **HARD RULE: never index-trust a preview path when writing to stored
   sections; every write is text-verified (path = hint only, unique-match fallback,
   abort otherwise).** Build ON the shipped verifier, do not re-implement.
4. Auto-memory `pub-keep-whole-and-l3` — the L3 trigger auto-clicks the REAL "Fix
   Orphans" button; a direct app.js edit for this once corrupted the file and was
   reverted. Keep that pattern.
5. `docs/qa/ACTIVE_BUGS.md` top two blocks (2026-07-03 batches — what already shipped
   tonight; don't redo).

## Acceptance set (owner-confirmed green marks, export 2026-07-02)
A re-export after implementation must clear ALL of these runts:
- "customer-facing work." (Change Request Lead)
- "product variants." / "signal validation." / "measurement setups." (System Architect — all three)
- "smartphone optics and biometrics." / "Imatest, and Qualcomm tools." (Sirin)
- "in commercial devices." (Sirin Results)
Plus the owner's 2026-07-03 note: orphan treatment is still incomplete in **roles and
PROFILE** — include the profile text section in the preflight scope.

## Implementation constraints
- Prefer a SIDECAR (new `antcv-orphan-export-preflight.js` or extension of the
  existing orphan sidecar family) over app.src.js edits. If `exportDocxViaWorker`
  must be touched (it lives in app.src.js/app.js), keep the hook minimal: one
  awaited call-out to the sidecar with a hard 12s timeout and a no-op fallback —
  the export must NEVER hang or fail because of the preflight.
- Any app.src.js edit is mirrored byte-verified into `pwa/app.js` (anchor on string
  literals, occurrence-count 1, assert head `(()=>{`, zero "use strict"). Node
  substring-replace with abort guards; app.js line 8 is too large to Read.
- Measurer parity inputs: export font = the docx-worker's fonts (Calibri/Carlito
  family per package) at export sizes, column width = the worker's real text-cell
  width in px at 96dpi (derive from PAGE_W/sidebar twips — see docx-client). Check
  `antcv-docx-client.js` for the authoritative width/font constants; do not guess.
- The L3 re-tighten stays LLM-backed via the existing route; ≤30-char tail
  re-tighten convention; banned-words list applies to rewritten text.
- Kill switch: `antcv:disable-orphan-preflight`. `__antcvSalmon` is PERMANENT.

## Verification (all required before push)
1. New unit tests (vm-sandbox, modeled on `pwa/test/unit/empty-role-hide.test.mjs`):
   measurer math (known text + width → expected break count), preflight gating
   (timeout → export proceeds unchanged; verified-write only; RUNT_FRAC 0.40
   boundary), kill switch.
2. `node scripts/run-tests.mjs pwa` green; `node pwa/test/boot-smoke.mjs`;
   `node pwa/test/diag-gate-probe.mjs` renders past the sign-in gate.
3. Export-parity proof: drive the docx-worker in node (see
   `workers/docx-worker/test/diag-twocol-ownerlike.mjs` for the harness pattern)
   with a seeded section whose text produces a known runt; assert the preflight
   removed it in the payload AND the emitted document.xml line content matches the
   measurer's prediction (this is the core claim of v2 — prove it, don't assert it).
4. Live half (owner does the final eyeball): after deploy, owner re-exports the
   NIL/unsolicited CV; the acceptance set above must be clean in the PDF.

## Ship discipline
- SYNC FIRST (`git fetch origin && git pull --rebase origin main`), NEVER force.
- Cache-bust QUINTET per pwa change: index.html `?v=` (incl. version-override's OWN
  `?v` line) + sw.js CACHE + TARGET_VERSION + STALE_VERSIONS (add PREVIOUS, never
  current) + `window.ANTCV_VERSION` seed. Next version = 1.51.56+.
- Commit `git commit -F <file>` (PowerShell quoting hazard), end with
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Push = PWA auto-deploy.
- Update `docs/qa/ACTIVE_BUGS.md` top block with [SHIPPED x.y.z] + save durable
  lessons to auto-memory.

## Stretch (ONLY if orphans v2 lands verified with time left)
JD-SCAN-HALLUCINATION-001 ingest fix (`app.src.js` `h()` ~802-961): strengthen the
garble detector `f()` (~772: replacement-char ratio, mean word length, charset
sanity); on garble SKIP the doc-LLM "decode the font" step (~869) and go straight
to the inline vision fallback (~899-956); filename↔company cross-check; visible
"JD text unreadable — used OCR" notice at the status render (~40327). Test file:
`C:\Users\karpg\Downloads\Nanooptics Prototyping Engineer - NIL Technology.pdf`
(needs real LLM/vision — verify with the owner present or leave WIP-labelled).

Do NOT touch: flagship gen model (stays claude-opus-4-7), fetch-wrapper order,
anything in the 2026-07-03 shipped batches (1.51.53–55, wk 1.14.120).
