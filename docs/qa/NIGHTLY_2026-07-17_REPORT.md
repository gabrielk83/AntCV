# AntCV nightly — 2026-07-17 (verify + full-coverage report, no code ship)

Model: Opus 4.8 (single session, no fan-out — the run is pure verify; no app.js/worker edit
was safe to ship tonight). Baseline **PWA 1.51.1524-leadin-underline** · docx-worker
**1.14.161-leadin-underline** · access-relay **auth-33-cse-brave** · cv-proxy
**3.8.3-gemini-flash-ramble** · suite **1313/1313** · boot-smoke OK · main in sync with origin
(fetch + rebase clean, HEAD `2ed2e51`). Authoritative plan: `NIGHTLY_2026-07-05_PROMPT.md`
(standing band structure). Every open register row is given a status word below (rule: full
coverage = the register).

## Standing probes (Band E) — all green, no regression

- **Suite:** `node scripts/run-tests.mjs pwa` → **1313/1313** pass, 0 fail (~4s).
- **Boot-smoke:** `glDemo=function, errors=0` → BOOT-SMOKE OK.
- **app.js minified-sacred:** head is `(()=>{window.__antcvSeamStyle…`, `startsWith("(()=>{")`
  true, no `"use strict"` in the head. Intact.
- **E2 — Personal-panel stability probe** (`diag-personal-panel-probe.mjs`): **0 mutations / 8s at
  rest, 0 page errors → DIAG PASS**. No writer churn.
- **E3 — Button-audit pass 2** (`diag-panel-button-audit.mjs`): **195 buttons / 0 throws / 0 page
  errors** — 113 active, 56 not-visible-or-disabled, 12 skipped-dangerous, 14 ui-only. No
  regression vs 07-16 (195/0/0; 112 active → 113 this run = one button became visible, benign).
  Raw: `PANEL_BUTTON_AUDIT_2026-07-17.json`.
- **E4 — Export/preview parity:** role-merge stored-sections + rule-45 export-only-mutation
  inventory are suite-covered (green in the 1313 run); no parity drift surfaced.

## Live-verify (PWA layer — reachable; worker layer — blocked this run)

**Environment note:** the Browser pane was **unresponsive this run** (two 300s `navigate`/
`preview_start` timeouts). Fallback: the sandbox shell reaches Cloudflare **Pages** (`pages.dev`
resolves + serves) but **NOT** `*.workers.dev` (DNS-blocked — the known worker gate, `curl` exit 6).
So the PWA layer was live-verified directly; the worker `/health` live-check could **not** run
tonight (both paths to workers.dev were unavailable).

- **PWA live = TARGET `1.51.1524-leadin-underline`** — `ANTCV_VERSION` seed + `app.js?v` both read
  `1.51.1524-leadin-underline` from the live `index.html`. **No version regression, no stale-SW
  mask.**
- **Live-served (HTTP 200) + wired:** `app.js?v=1.51.1524-leadin-underline` (200; carries the
  `antcv:disable-jd-meta-reset` guard, 2 occurrences — META-STICK-001 live),
  `antcv-gen-memo.js?v=1.51.134` (200, A1), `antcv-pointer-stale-guard.js?v=1.51.334-unsol-pillar`
  (200, A2 leg 2), `antcv-lang-fabrication-guard.js?v=1.51.136` (200, C1),
  `antcv-react-islands.js?v=1.51.1425-tracker-open-claim` (referenced).
- **Worker layer — verified in-repo instead of live (blocked):** source VERSION constants =
  docx-worker `1.14.161-leadin-underline`, access-relay `auth-33-cse-brave`, cv-proxy
  `3.8.3-gemini-flash-ramble` — all identical to 07-16's **live-verified** state. Last `deploy.yml`
  runs were both 07-16 (`29465290683` docx-worker 1.14.161 bump success, `29463344356` lead-underline
  export leg) with **no deploy since**, so the deployed worker state has not drifted from 07-16.
  A worker `/health` re-attest is **owed on the next run with a working Browser pane**.

## E1 — Register staleness sweep (oldest `verified:no` rows, evidence this run)

Confirmed present in CURRENT code (no drift; all owner/render/device-gated, not code-open):
- **Row 3** (float-spine) — default-OFF gate intact: `antcv-docx-client.js` reads
  `localStorage antcv:float-spine`. Owner visual re-export still owed.
- **Row 16** (sidebar justify↔left flap) — no new churn; standing probe clean. Owner eyeball open.
- **Row 36** (GEN-CORECOMP-BROAD-001) — `CORECOMP-BROAD` / `__neutralCo` marker present in
  `app.js`. Regen-confirm owner-gated.
- **Rows 1, 9, 14, 20, 35, 37** — no code change addressing them since last sweep; genuinely open,
  render/owner/regen-gated. Status carried forward.

## Per-band / per-row status (full coverage)

**BAND A — MOBILE & TAB ISOLATION**
- **A1 GEN-BACKGROUND-001 (rows 38 / 38a):** engine + sidecar (`antcv-gen-memo.js?v=1.51.134`)
  live-served + wired. **Flip-default BLOCKED** — needs a real mobile foreground-gen A/B (start →
  background/lock → foreground auto-resume + mid-run reload), which can't be faked headlessly and
  the Browser pane is down. No gen-core touched.
- **A2 TAB/DEVICE ISOLATION (row 39a):** leg 1 (AUTOSAVE-NO-DOWNGRADE-001, relay) + leg 2
  (PTR-STALE-GUARD-001, `antcv-pointer-stale-guard.js` live-served) **VERIFIED-WIRED**; relay
  `/health` re-attest deferred (worker layer blocked). **Leg 3 (row 19) BLOCKED** — 2nd physical
  device.
- **Row 93 (META-STICK-001) / 94 (LOAD-EDITOR-UNSOLICITED-001):** **SHIPPED + LIVE** — live app.js
  carries the `antcv:disable-jd-meta-reset` guard (2 sites). Owner eyeball still owed.

**BAND B — DATA LOSS / CRASH**
- **B1 SO-003 (row 40):** shipped + suite-covered (green in 1313). No regression.
- **B2 SO-004 (row 41):** **BLOCKED** — React #185 field-commit crash needs a real-Android capture.

**BAND C — CONTENT**
- **C1 GEN-LANGFAB-001 (row 42):** `antcv-lang-fabrication-guard.js?v=1.51.136` live-served + wired.
  VERIFIED-LIVE.
- **C2 CA-006 (row 43) / C3 JD-ANALYSIS-PRINT-001 (row 44):** shipped + suite-covered.

**BAND D — PERF / DESIGN**
- **D1 PERF-001 (row 45):** **OPEN** — app.js cloud-sync main-thread profiling; single-owner area,
  no clean repro tonight, no speculative edit (owner rule: end result, not a brickable mid-product).
- **D2 GEN-MODELROLE-001 (row 39):** code + `MODEL_ROLES` config shipped; live D1 re-confirm
  deferred with the worker layer. Prior runs VERIFIED-LIVE; no config change since.

**Other tracked rows:** 6, 8, 22, 23 (partial — dangerous-button leg owner-gated), 24, 25, 26,
27, 28, 29, 31, 92 (JOBTRACKER-TOP5-CONTROLS-001, owner live-verify owed), 95/96 (SuccessFactors
scrape) — all carried forward TO DO / owner-gated / partial per their register rows; no code change
this run.

## Nothing shipped — why

Every remaining open row is owner-gated / needs a 2nd physical device / needs live models or a real
foreground gen / is a content-density frontier item (content-bound, not a rule failure). No row was
found implemented-but-still-open. No speculative app.js or worker edit was justified.

## Owner-verify list (carried)
- A1 flip-default: real mobile foreground-gen A/B (then a one-line default flip, owner-notified first).
- A2 leg 3 (row 19): two real physical devices.
- Rows 93/94 on-device eyeball; row 92 long-press vs native text-selection + small-viewport menu clip.
- Rows 3/16/20/24/25/36 owner eyeball / regen-confirm.

## Owner-decision list (carried)
- A1: approve flipping `antcv:gen-resume` default-on once the mobile A/B is clean.
- D2 `analysis→gemini` head (held at the 07-15 weekly tune): gemini `analyze_fit` ground-truth
  top-up OR split `analysis` into per-task heads.

## Next-run note
Re-attest the worker `/health` trio (docx-worker / access-relay / cv-proxy) once the Browser pane
is responsive again — tonight's worker verify was in-repo-source + last-deploy-timestamp only,
because both live paths to `*.workers.dev` were unavailable.
