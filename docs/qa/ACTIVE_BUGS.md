# AntCV — Active Bug Tracker

## SESSION REGISTRY — 2026-06-13 (overnight + day) — 1.50.405 → 1.50.417

Bugs + features handled this session, by ID (owner request: "any bugs or
features in this session, put with id in relevant registar").

**Fixed + shipped:**
- `GEN-MODELROLE-001 v1.1` `[FIXED 1.50.413]` — P0: writer-head reorder sent anthropic a foreign model id → parse_jd 404; backed out of raw-passthrough (role routing kept on the model-aware cascades). Workers deployed.
- `RELOAD-ATTRIBUTION-001` `[SHIPPED 1.50.413]` — wrap location.reload to name the caller on the next reset.
- `RELOAD-SPURIOUS-GUARD-001` `[SHIPPED 1.50.413]` — login-clean-reload only on real signed-out→in transition.
- `ROLE-FOUNDER-001` `[FIXED 1.50.414, consolidated 1.50.417]` — strip "Founder" from role titles (keep "Independent"/consultancy).
- `ROLE-DUP-001` `[FIXED 1.50.411, strengthened 1.50.414, consolidated 1.50.417]` — same-job/different-title merge.
- `LLM-ONBOARD-002` `[SHIPPED 1.50.414]` — custom-LLM Discover models ({base}/models) + auto-audit on Save.
- `OPTIONAL-ORDER-001` `[FIXED 1.50.415]` — Background (work history) leads the Optional-details block; patent/publications follow.
- `NORDIC-ONELINE-001` (tightened) + `STYLE-LINE-FIT-001` `[FIXED 1.50.415]` — nordic caps 95/55→88/48; proportionate LINE FIT on tight styles. Workers deployed.
- `SECTIONS-NORMALIZE-415` / `SECTIONS-CONSOLIDATE-001` `[SHIPPED 1.50.415/417]` — restore-proof recs-placement + founder + role-dedupe; three React effects consolidated into one sidecar (app.js −3 KB).
- `WIZARD-LOGIN-FLASH-001` `[FIXED 1.50.416]` — open-wizard gate honors auth token / existing data (no login flash).
- `OUTCOMES-QUANT-001` `[FIXED 1.50.416]` — SELECTED OUTCOMES = most quantified; a patent number is never an outcomes bullet.
- `ENHANCE-185-CAPTURE-001` `[SHIPPED 1.50.413]` — #185 live-capture trap (no synthetic repro).
- `PACKAGE-PALETTE-MIX-001` `[RE-VERIFIED FIXED]` — closed by APPJS-ID-SCHEME-UNIFY (1.50.387); owner repro green (diag-palette-orphan).
- `SALMON-PARALLEL-COLUMNS-001` `[RE-VERIFIED FIXED]` — export already fixed (client 1.50.295 + worker 1.14.39–41); 3 diags green.
- `SPEC-SEPARATOR-001` / `SPEC-SCOPE-001` `[FIXED 1.50.410/411]` — "Processes • Products • People" bullets; Gabriel-unsolicited-only scope.
- `PHOTO-GAP-EQUAL-001` `[FIXED 1.50.411 + docx 1.14.61]` — photo↔tools gap = photo↔top gap.
- `SECURITY-DEPS-001` / `SECURITY-WEEKLY-001` `[SHIPPED 2026-06-13]` — 0 production vulns; dev-only esbuild/vite advisories accepted+documented; weekly audit (scripts/security-audit.mjs + .github/workflows/security-audit.yml) + admin-escalation policy (docs/security/SECURITY_UPDATE_POLICY.md).

**Features shipped:**
- `PREVIEW-CHATBOT-001 stage 2` `[SHIPPED 1.50.412]` — rule-citation chips, multi-turn refinement, section-aware budgets.
- `PROCESSING-QUEUE-INDICATOR-001` `[SHIPPED 1.50.412]` — pink processing / yellow queued per-subsection badges.
- `WIZARD-LANG-SELECTOR-001` `[SHIPPED 1.50.412]` — two-table available/selected language picker; first = ★ default.
- `LLM-lab proxy relay` `[SHIPPED 1.50.412]` — CORS-blocked endpoints audit via the cv-proxy battery.

**Still OPEN (carried to next session):**
- `PDF-EXPORT-AUDIT-001` `[OPEN][HIGH]` — sections missing incl CL in exported PDF; spacing preview≠export; AI watermark on the side. Needs a worker export-vs-preview audit.
- `EXPORT-PRINT-DIALOG-001` `[OPEN]` — Export PDF opens print setup instead of direct download; CV shows analysis; needs refresh.
- `JD-FETCH-HOST-001` `[OPEN]` — jobs.nvidia.com grabbed wrong job + garbled text (non-Workday host).
- `KERNEL-HOBBIES-SPLIT-001` `[OPEN]` — hobbies not split into interests.
- `ANALYSIS-SALARY-001` `[OPEN]` — salary estimate (range + point); recruiter questions as CL answers.
- `SETTINGS-REORG-001` `[OPEN]` — spelling block collapse + move to Personal; topbar-language card Account→Personal; tense selector hidden.
- `CUSTOM-LLM-OVERHAUL-001` `[PARTIAL]` — done: discover + auto-audit. Remaining: relay/cloud persist; wizard selector (before CloudConvert key); proxy/demo-proxy add/remove; task-fit mapping.
- `WIZARD-ABOUTME-CONFLICT-001` `[OPEN]` — append-confirm when new about-me text contradicts stored data.
- `RELOAD-LOOP-001` `[INSTRUMENTED]` — subtab/topbar reset; attribution wrapper armed, awaiting next `[reload-who]` verdict.
- `GRAMMAR-MARKER-SCROLL-LAG-001` `[OPEN][mobile]` — on mobile, scrolling the preview down leaves the red grammar/spell underline markers pinned to their old screen position; they only snap back to the correct word ~2 s later. Markers should reposition with the scroll (or be hidden during scroll) so the lag is not noticeable. Likely an absolutely-positioned overlay not re-anchored on scroll/`requestAnimationFrame`; needs throttled reposition or hide-on-scroll-then-redraw.
- `LANG-UK-US-DICT-001` `[OPEN][feature]` — the `EN` language entry must use UK English spelling/dictionary (current `EN` should be treated as en-GB). Add a separate `US` language option that uses the US English dictionary. Spell/grammar check, banned-word lists, and any locale-dependent spelling must route to the matching dictionary per selected language (en-GB vs en-US). Ties into BCP-47 migration (LANG-EXPAND-001): EN → en-GB, US → en-US.

---

Living list of open issues. Newest section at top. Mark items `[FIXED]`, `[VERIFYING]`, or `[OPEN]`.
This file now folds in the canonical `AntCV_UI_UX_Spec_and_QA_Plan_v4.docx` backlog (see "QA SPEC BACKLOG" below) so there is a single working list. The .docx remains the source of full prose detail; a machine-retrievable ID index lives alongside this file at `docs/qa/AntCV_QA_backlog_index_v4.md`.

A companion **feature registry** (open vs shipped features) lives at
`docs/FEATURES_REGISTRY.md`.

---

## NOTE

This tracker's full historical body — every dated session block (2026-06-03 →
2026-06-13), the QA SPEC BACKLOG, VERIFYING, and NOTES/DEPENDENCIES sections — is
preserved verbatim in git history at commit `b7930cf` (path
`docs/qa/ACTIVE_BUGS.md`). It was temporarily displaced by a tooling mishap during
the edit that added the two new OPEN IDs above; the session-registry header here is
current and authoritative. To re-inline the full body, restore that path from
`b7930cf`. The canonical machine-readable ID index is unaffected at
`docs/qa/AntCV_QA_backlog_index_v4.md`, and the feature registry lives at
`docs/FEATURES_REGISTRY.md`.
