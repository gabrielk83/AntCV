# AntCV — Bug & Feature Deployment Plan (2026-06-06)

Owner is away ~a few hours; sole deployer is the assistant (no parallel deploys).
Discipline: ship tight named bundles, one step at a time, revert-on-failure. Sources of
truth: `docs/qa/ACTIVE_BUGS.md` (prose), `docs/qa/MASTER_BACKLOG.md` (rollup). This file is
the **execution order** + the self-serve vs needs-owner split.

## Shipped + live already today

| Version | Item | Layer | State |
|---------|------|-------|-------|
| 1.50.166 | APPJS-BLUESCREEN-001 — revert esbuild rebuild, restore working bundle | app.js | LIVE ✓ |
| 1.50.167 | WM-MOBILE-SCALE-001 — watermark lost on mobile (scale-aware anchor) | sidecar | LIVE ✓ (live mobile check owed) |
| 1.50.168 | CL-UNSOL-SIGNAL-001 — unsolicited WHO I AM / WHY THIS POSITION backstop | app.js (surgical) | LIVE ✓ (live check owed) |

## Classification key

- **SELF — sidecar/CSS**: readable `pwa/*.js` or `*.css`. Lowest risk. Can ship while away.
- **SELF — worker**: Cloudflare worker (prompt/logic). Reversible, owner gave standing
  deploy approval. Ship carefully, one at a time.
- **SELF — surgical app.js**: unique in-place minified edit, mirrored to `app.src.js`, parse-
  checked. NO esbuild rebuild (see `docs/deployment/app-js-source-and-rebuild.md`). Medium
  risk — only for additive/localised changes; never the app-shell boot path while away.
- **OWNER — console**: needs a live browser/probe on the owner's session (DOM, z-index,
  auth headers, demo account). Cannot be done from the build env (no live browser, egress
  allowlisted).
- **OWNER — decision**: needs an owner choice before building.

---

## Wave 1 — execute now (self-serve, low risk)

Ordered by value × safety. Each ships as its own version bundle + deploy + report line.

1. **GEN-UNSOL-002** — `SELF — worker`. generate_cv schema doesn't request company/role, so
   an unsolicited JD can still fall to "Unsolicited" in the header. Have the generation
   contract extract + emit a grounded `meta.company`/`meta.role` when present. Complements
   today's CL-UNSOL-SIGNAL-001. Proxy + demo-proxy. Low risk (prompt/schema only).
2. **DEMO-BADGE-001** — `SELF — sidecar (likely)`. The "🟡 DEMO" badge is hardcoded to the
   email `51pegasib@gmail.com` instead of the real `demo_mode`/`user_mode` signal. Re-gate
   on the real signal if it lives in a sidecar; if it's in app.js, do a surgical re-gate.
   NOTE: its parent DEMO-PERSIST-001 (server classifies the demo account as paid) is
   OWNER-console — so this only stops the *badge* mismatch, not the whole demo flow.
3. **HOWCONTRIBUTE-001** — `SELF — sidecar/app.js`. "How I would contribute" bullets missing
   in the **template** preview (renders without its bullet list). Check the contribute /
   `text_bullets` preview renderer + `mergeHowContributeFromLocalStorage`. Verify Preview ↔
   DOCX/PDF parity (GEN-001). Diagnose first; fix in the sidecar if possible.

## Wave 2 — self-serve but quality-sensitive (hold for a glance, then ship)

4. **PERF-003** — `SELF — worker`. Trim consensus width to 1–2 providers on **mechanical**
   tasks only (`extract`/`extract_pdf`, `parse_jd`, `compress`, `fix_orphans`); keep wide on
   quality-critical tasks. Owner already confirmed the split — safe to implement.
5. **PERF-002** — `SELF — worker`. Consensus quorum/timeout: proceed on 2–3 of 4 instead of
   waiting for the slowest provider. Real latency lever.
6. **PERF-004** — `SELF — worker`. enrich↔compress convergence skip (no material change →
   skip the next cycle).

## Wave 3 — blocked on the rebuild path (paused)

7. **ENGINE-PAGESPLIT-001** — real on-screen per-item pagination (sidebar sub-subsections,
   table rows, HIWC bullets). Lives deep in `app.src.js`; too large for a surgical edit.
   **Blocked on APPJS-REBUILD-001** (need a behaviour-preserving rebuild, or a verified
   round-trip gate). Today's CL-UNSOL fix proves small surgical edits are viable, but this
   one is not small.
8. **APPJS-REBUILD-001** — establish a behaviour-preserving rebuild (terser / esbuild-without-
   strict / verified identity round-trip). Unblocks Wave 3. `SELF — investigation`, but
   shipping a rebuilt bundle needs the gate to pass first.

## Wave 4 — needs owner (cannot do from build env)

- **DEMO-PERSIST-001** `OWNER — console` (HIGH). Demo account reads `user_mode:"paid"` /
  `demo_mode:false`; `AntcvSetUserMode("demo")`+reload won't flip it. Decisive probe = the
  SET-MODE POST status (401 vs 200+stale) + how the relay assigns the initial mode. Blocks
  the whole demo experience (watermark, setup chip).
- **PRIVACY-DEMO-001** `OWNER — console`. Privacy LED invisible in demo (desktop+mobile).
- **SETTINGS-SUBTAB-001** `OWNER — console`. Settings render behind the preview (z-index);
  "EN"/history doesn't open the right subtab.
- **APP-HISTORY-001** `OWNER — console`. Application History unreachable from the preview
  pop/overflow menu.
- **HARDREFRESH-001** `OWNER — console/code`. In-app Hard Refresh confirms but never reloads.
  Likely a surgical app.js fix once the dead handler is identified live.
- **LOGIN-GATE-001** `OWNER — console` (HIGH). Force-default-settings/hide-wizard boots
  blue-screen→wizard→menu. App-shell boot path — NOT to be touched blind while away
  (prior blue-screen history). Candidate branch `feat/login-loading-gate` to review.
- **DEMO-TOGGLE-001** `OWNER — decision`. Add an in-app Demo⇄Paid toggle.

## Feature backlog (net-new — registered, mostly OWNER-console to finish)

- **FEATURE-CONF-001** per-sentence confidence overlay — worker schema is `SELF`; the
  toggle + persistence are app.js (`OWNER — console`).
- **DATA-EXPORT-001** / **DELETE-SAVE-001** — crypto core shipped; the Personal-menu wiring
  is `OWNER — console`.
- **WIZARD-002**, **PHOTO-PLACEMENT-001** — app.js, `OWNER — console`.

---

## Wave 1/2 execution findings (2026-06-06, autonomous pass)

Owner greenlit "proceed automatically in wave 1/2". On investigation, every remaining
item is `app.js`-side (not the clean sidecars first assumed) and not live-verifiable from
the build env. Outcome of the pass:

- **GEN-UNSOL-002 — SHIPPED (1.50.169).** Prompt now requires `meta.company`/`meta.role` to
  be filled from the JD when one is present (never empty, never "Unsolicited" when the JD
  names the employer); empty only for a true open application. Additive instruction text in
  the generation prompt `k` — surgical, mirrored to `app.src.js`, parse-checked. Live-verify
  owed: generate against a real JD → header shows the real company/role, not "Unsolicited".
- **PERF-002/003/004 — DEFERRED (mislabelled in the backlog).** The backlog frames these as
  "trim consensus width" on mechanical tasks, but the code (`ee`, app.src.js ~1146) is a
  **cascade**: it returns on the FIRST successful provider (line ~1292) and only advances on
  failure. The per-task `Z` arrays (~1110) are fallback ORDER, not a fan-out — mechanical
  tasks (`parse_jd`/`compress`/`fix_orphans`) make exactly one call. Trimming `Z` would cut
  resilience, not latency. Real consensus is the separate `consensus_poll`/`consensus_reinforce`
  path (~20547). NEEDS owner intent: confirm the target is the consensus_poll fan-out (quorum
  / fewer providers), not `Z`. Not a safe blind edit.
- **DEMO-BADGE-001 — DEFERRED (blocked on DEMO-PERSIST-001).** Re-gating the badge from the
  hardcoded email to `demo_mode` would HIDE it for the real demo account, because that account
  currently reads `demo_mode:false` (DEMO-PERSIST-001, server-side, owner-console). The email
  hardcode is a deliberate stopgap. Do DEMO-PERSIST-001 first.
- **HOWCONTRIBUTE-001 — DEFERRED (needs a live probe).** Whether the missing template bullets
  are dropped by the contribute/`text_bullets` preview renderer or by
  `mergeHowContributeFromLocalStorage` can't be told apart without the live DOM. `OWNER —
  console`, or a diagnostic-first probe session.

Net: 1 of the 6 was a safe autonomous change; the other 5 are either blocked, owner-console,
or mis-specified in the backlog (PERF). The PERF finding corrects the backlog — see updated
notes in `MASTER_BACKLOG.md`/`ACTIVE_BUGS.md`.

## Execution log (updated as items land)

- 2026-06-06 — Wave 0 shipped: 1.50.166 / 1.50.167 / 1.50.168.
- 2026-06-06 — Wave 1: GEN-UNSOL-002 shipped (1.50.169). PERF-*/DEMO-BADGE-001/
  HOWCONTRIBUTE-001 deferred with findings (above).
