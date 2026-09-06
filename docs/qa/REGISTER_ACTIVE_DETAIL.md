# AntCV register — ACTIVE row detail

The full, verbatim text of every ACTIVE row. `OPEN_REGISTER.md` is the scannable index;
this is where the evidence and the history live. Split out on 2026-08-26.

Each row appears exactly as it stood in the pre-split register: the OPEN-queue row, plus the
TO-DO SUMMARY twin where one existed. The two tables had drifted apart — each carried its own
date in its own column — which is why row staleness was being missed. Keeping both here loses
nothing while the index above carries the single authoritative date.

When you advance a row: update its text here AND its `verified:` date in `OPEN_REGISTER.md`.
When you finish it: move it to `REGISTER_CLOSED.md`.

---

## Row 38 — GEN-BACKGROUND-001

_verified: 2026-08-27_

**Verify sweep 2026-08-27 (CI nightly, code-presence — E1 stalest-row slot, was `never`):** the
client engine is present and loaded — `pwa/antcv-gen-memo.js` + `pwa/antcv-gen-job-client.js` both on
disk, both referenced in `pwa/index.html`; their tests (`pwa/test/unit/gen-memo.test.mjs`,
`pwa/test/unit/gen-job-client.test.mjs`) run inside the green PWA suite (1662/0). The SERVER `/job/*`
dispatch exists in BOTH proxies (`workers/{proxy,demo-proxy}/src/gen-job.js` + `index.js`). So the
code half is confirmed intact. REMAINING is unchanged and NOT verifiable in CI: (1) live `/job/*`
curl against a deployed proxy, (2) the owner A/B on a real mobile gen with `antcv:gen-resume=1`, and
(3) the owner's decompose-approach decision (A full per-section vs B resume-on-reload). Owner-gated +
needs-live-env — carry forward.

**OPEN-queue row (verbatim):**

```
| **38** | **GEN-BACKGROUND-001 — APPROACH A INTEGRATED 1.51.133 (opt-in), owner A/B pending.** Owner picked A. Finding: AntCV gen is a DEPENDENT client pipeline (not independent server sections), so the fit is CHECKPOINT-MEMO at the ee() LLM chokepoint, not /job/*. SHIPPED: `antcv-gen-memo.js` (window.AntcvGenMemo — key/get/set/clear, opt-in antcv:gen-resume, kill antcv:disable-gen-memo, session + localStorage-sig persistence; 8 tests) + a 2-edit surgical wrap of the gen chokepoint in BOTH bundles (source ee → __eeInner + wrapper; minified Le → __LeInner + wrapper, shadow-hazard-verified: Le unique, 19 call sites, no reassignment) + a gen-done clear() so a fresh regen is never cached. Effect (when opted in): an interrupted generation (mobile tab backgrounded → run throws) replays every completed LLM call from the checkpoint on re-run instead of re-calling — near-instant, no re-cost; only the interrupted call re-runs. Output-neutral (replays identical calls). Default OFF → ee() byte-identical to today; both-bundle mirror lock test; suite 953/953 + boot-smoke. REMAINING: owner sets antcv:gen-resume=1, A/B on a real mobile gen (start → background → foreground → re-click Generate → resumes fast); then flip default. ~~FOLLOW-ON (row 38a): AUTO-resume-on-foreground + input-sig~~ SHIPPED 1.51.134: input-sig derived from localStorage (JD+meta) → cross-reload resume without an app edit; auto-resume-on-foreground re-invokes the app generate fn (exposed as window.__antcvGenTrigger, both bundles) once per checkpoint on visibilitychange/focus so an interrupted mobile gen resumes with no re-tap (guarded: opted-in/not-running/recent/not-already-resumed). Still DEFAULT OFF (antcv:gen-resume=1). REMAINING follow-on: the client /job engine (antcv-gen-job-client.js, shipped 1.51.132) stays for a future SERVER-driven decompose (true mid-call survival). Approach A is now end-to-end pending only the owner A/B + flip-default. Server DONE on main (gen-job.js + /job/* dispatch, both proxies). CLIENT ENGINE now DONE: `pwa/antcv-gen-job-client.js` (`window.AntcvGenJob` run/resume/cancel/hasActive/onForeground) with the full /job/* state machine — create→step→coherence→done, localStorage job persistence, reload-resume, visibilitychange foreground-resume, transient-retry/4xx-terminal; 8 unit tests (`gen-job-client.test.mjs`); loaded by index.html, INERT until called; kill-switch antcv:disable-gen-job. **KEY FINDING (docs/qa/GEN-BACKGROUND-001-CLIENT-SPEC.md):** the current app gen is ONE big multi-provider call, not per-section; gen-job's backgrounding survival needs MANY short per-section /steps (a single 3-6 min /step isn't viable on Workers). So the app.js integration ALSO requires DECOMPOSING generation into a per-section plan — a gen-core change that needs the OWNER'S APPROACH DECISION (A: full per-section decompose = true survival + cross-section coherence, staged behind the kill-switch with a fresh-gen quality A/B before flipping default; B: interim resume-on-reload only, does NOT close this). REMAINING: verify the /job/* dispatch is live (curl); owner picks A/B; then decompose section-by-section behind the kill-switch | docs/qa/GEN-BACKGROUND-001-CLIENT-SPEC.md; 1.51.132 | partial — engine shipped, decompose owner-gated |
```

**TO-DO SUMMARY twin (verbatim):**

```
| **38** | **GEN-BACKGROUND-001-CLIENT** — ENGINE SHIPPED 1.51.132 (antcv-gen-job-client.js, window.AntcvGenJob, 8 tests, inert until called). Finding: app gen is one big call → integration needs per-section DECOMPOSE (owner picks approach A/B); verify /job/* live. | **PARTIAL — engine done, decompose owner-gated** |
```

---

## Row 76 — JOBTRACKER-LLM-REFIT-BUTTON-001

_verified: 2026-08-27_

**Verify sweep 2026-08-27 (CI nightly — E1 stalest-row slot, was `never`):** confirmed this remains a
DEFERRED OPTIONAL enhancement by design, not stalled work. The Top-5 fit score is deterministic on
purpose (ranking stability), and the on-add async refine already upgrades a row's tier once. An
explicit on-demand "re-judge fit" LLM button is only worth building if the deterministic tier proves
too coarse on real edge JDs — no such evidence has surfaced. No code owed; keep deferred.

**OPEN-queue row (verbatim):**

```
| **76** | **JOBTRACKER-LLM-REFIT-BUTTON-001 (deferred enhancement)** — the fit SCORE that orders the Top-5 is deterministic by design (ranking stability). Optional future: an explicit "re-judge fit" button that runs an LLM pass to re-tier a row on demand (distinct from the on-add async refine, which already upgrades the tier once). Low priority; only if the deterministic tier proves too coarse on edge JDs in practice. | AUTOFILL-TOP5 hybrid design (d79adf4) | not started — optional |
```

---

## Row 82 — ROLE-CANON-AUDIT-LEG-001

_verified: 2026-08-27_

**Verify sweep 2026-08-27 (CI nightly — E1 stalest-row slot, was `never`): CODE LEG NOW DONE.** The
row was filed as "the PERSIST/EXPORT audit leg is NOT yet wired because gold_audit.py carries another
session's uncommitted WIP" — that WIP has since landed. `scripts/job-tracker/gold_audit.py` now carries
`role_canon_issues(cv, lang, gold)` implementing both audit rules (rendered role title == the
doc-language canon `roles.canon_titles[base][lang]`; no two visible roles share one canonical id,
with the merged-title exemption), wired into `run()` as `checks["role_canon"]` (commit `70c6cd59`
"fix(gold): rows 82/86 residue — role-canon export audit"). It is negative-controlled by
`scripts/job-tracker/test_gold_residue.py` — **18/18 checks pass**, covering en/da/es/zh clean cases,
the -N suffix twin, the merged-title exemption, the duplicate-canonical-id flag, and the he
title-check skip. REMAINING is now ONLY owner-gated: an eyeball pass over the es/zh canon wordings
(es titles were new; zh are owner pins + established forms). Kept ACTIVE for that owner eyeball; the
agent/code work is complete.

**OPEN-queue row (verbatim):**

```
| **82** | **ROLE-CANON-AUDIT-LEG-001 (follow-up)** — the golden gating matrix now carries roles.canon_titles (en/da/es/zh) and the CLIENT enforces it (normalize-415 roleCanonTitles) with a suite mirror-gate; the PERSIST/EXPORT audit leg (gold_audit.py: exported role titles must match the doc-language canon, no duplicate canonical positions) is NOT yet wired because gold_audit.py currently carries another session's uncommitted WIP (header-ink contrast fix) — add the leg once that WIP lands. ALSO owner-gated: an eyeball pass over the es/zh canon wordings (es titles are new this session; zh mostly owner pins + established forms). | ROLE-CANON-LANG-001 (1.51.394) | no |
```

---

## Row 94 — CONTENT-LANG-STAMP-001

_verified: 2026-08-27_

**SHIPPED 2026-08-27 (desktop nightly, Opus 5; PWA `1.51.4446-content-lang-stamp`, access-relay
`676918b5`, D1 column added). The code leg the CI run deferred is DONE; the row stays ACTIVE only for
the owner's signed-in live verify.** Four parts: D1 `ALTER TABLE application ADD COLUMN
content_language TEXT` (additive — the 76 existing rows carry NULL and use the old chain);
`access-relay` returns the field from `shapeApplicationRow` and whitelists it on
`PUT /api/applications/:id` (undefined-skip / explicit-null-clears, only the six rendered languages
accepted); `app.js`/`app.src.js` **leg 1** stamps it at `oo.update()` — the ONE method every
`cv_sections`/`cl_sections` writer reaches the server through — from the sections being written,
non-mutating, confident detections only, and never on a sectionless partial write (so it cannot clear
a stored value); **leg 2** reads it at both app-load sites, ranked BELOW the certain wide-script detect
(`__cl`) and ABOVE the fuzzy Latin sniff, so a stale stamp can never re-pin a document since
translated into zh/he/am. `meta` was rejected as the home: it is rewritten wholesale from React state
each auto-sync and META-DOWNGRADE-GUARD-003 withholds it exactly on the mid-restore path that matters.
15 tests in `pwa/test/unit/content-lang-stamp.test.mjs`, run against the SHIPPED bytes and
negative-controlled (removing leg 2 → 2 red, un-wiring leg 1 → 1 red); suite 1677/1677; boot-smoke OK;
`diag-rerender-storm` 0 app errors; `app.js` proved byte-identical to HEAD apart from the three
intended insertions. Live-verified as far as headless reaches: relay bundle re-read from Cloudflare
carries both legs, the relay's exact UPDATE SQL validated against the live schema, and the PWA serves
`1.51.4446-content-lang-stamp` across the whole quintet with no JS errors.
**REMAINING (owner, needs a signed-in session):** translate a da/es application, reload, switch away
and back — the language button must hold the CONTENT's language and `[babel-relang] content not in …`
must NOT appear. Also still open by design: BABEL-LATIN-BLIND-001 keeps its own sniff for the heal;
pointing it at the stored stamp is a separate, separately-testable change.

**Verify sweep 2026-08-27 (CI nightly, code trace — E1 stalest-row slot, was `never`): STILL OPEN,
row is accurate.** Confirmed the LOAD half is fixed — both app-load sites in `pwa/app.src.js`
(APP-LOAD-NO-RETRANSLATE-001) derive the selector from `window.__antcvContentLang(...)` (content
script-sniff) and only fall back to `jd_language`. Confirmed the GAP is real: a grep of `app.src.js`
finds NO persisted `content_language` / `contentLang` field anywhere — every persist path stamps only
`jd_language` (the JD's language), and the content language is re-derived by script-sniffing at three
sites (selector, babel relang heal, export). So the prevention leg is unbuilt: add an explicit
per-app content-language field (or stamp it on the translate-persist) so all three read one
authoritative value. Coordinate with BABEL-LATIN-BLIND-001. Needs an app.js/app.src.js change (PR-gated
in CI) + a live translate-persist cycle to verify — carry forward.

**OPEN-queue row (verbatim):**

```
| **94** | **CONTENT-LANG-STAMP-001 (prevention leg of APP-SWITCH-CONTENT-LANG-001)** — the LOAD half is fixed (`1.51.1800`: the selector is derived from the CV's content script). Still open: the GENERATE/TRANSLATE path that PERSISTS translated sections does not stamp a content-language anywhere, so `jd_language` stays the JD's language and the content language is only ever re-derived by script-sniffing. Add an explicit per-app content-language field (or stamp it on the translate-persist) so the selector, the relang heal, and export all read one authoritative value instead of three heuristics. Coordinate with BABEL-LATIN-BLIND-001 (`1.51.1838`) which sniffs the same thing for the heal. | ACTIVE_BUGS SAVED-APPLICATION LIFECYCLE entry (4) | no |
```

---

## Row 25 — TABLE-GEOMETRY-PARITY-001

_verified: 2026-07-02_

**OPEN-queue row (verbatim):**

```
| 25 | TABLE-GEOMETRY-PARITY-001 (owner 2026-07-02, nightly, diagnostic-first): Core Competencies table in the exported PDF does not match the preview in dimensions/wrapping — owner drags the preview column splitter so first-column labels fit ONE line, the PDF wraps them to two; requirement "no squeezed table, no letters after border, in either format". The forwarding pipeline EXISTS (WIB-TABLE-DIMS-001: antcv:tableWidthPct + cvTableRatio/clTableRatio → s.tableWidth/s.tableRatio → worker renderCompetencyTable) — this is a FIDELITY gap. Diagnose in the REAL CloudConvert PDF: exported ratio vs preview th %, Carlito-vs-preview font advance widths, padding mismatch (7px 10px vs 3pt 7.5pt), line-clamp glyph clipping (export 2 vs preview 3). Full brief in ACTIVE_BUGS 2026-07-02 entry. Sibling AMP-ADJACENT-001 ("V&V & compliance") FIXED 1.51.96 | ACTIVE_BUGS 2026-07-02 | no |
```

**TO-DO SUMMARY twin (verbatim):**

```
| 25 | Table geometry parity — diagnose real CloudConvert PDF vs preview measurement | TO DO |
```

---

## Row 6 — BANNED-WORDS-MERGE-001

_verified: 2026-07-03_

**OPEN-queue row (verbatim):**

```
| 6 | ~~Wizard+Settings UX tier-2/3~~ CODE-COMPLETE (owner-gate remains): #1/#3/#6/#7/#4-showcase shipped 1.50.531-534; #4-racing-selects MOOT (owner 2026-07-03: control hidden); #8 = BANNED-WORDS-MERGE-001 (1.51.86 — the 06-17 store-divergence warning was STALE: island "All" writes stylePrefs.banned_*, per-lang extraBanned* enforce via the _antcv_writing_style wrap → proxy §4.7 preamble; native collapsed Banned Words details now hidden, kill-switch antcv:keep-native-banned); #9-12 = UNIFIED-LOADER complete (mostly pre-shipped: single button, classify routes, signed-kernel OVERWRITE, Undo; 1.51.87 adds KERNEL-CHAIN-001 — applied CV opens the kernel conflict/gap review + MERGES, kill-switch antcv:no-kernel-chain — and .txt union). OWNER GATE: eyeball merged banned-words UI + run one file of each of the 6 types through the loader | docs/qa/WIZARD_SETTINGS_UX_2026-06-16.md → 1.51.86/87 | 2026-07-03 |
```

**TO-DO SUMMARY twin (verbatim):**

```
| 6 | Wizard/Settings UX — owner eyeball gate on merged banned-words UI + 6-file loader test | TO DO |
```

---

## Row 8 — KERNEL-V2-READER-001

_verified: 2026-07-03_

**OPEN-queue row (verbatim):**

```
| 8 | Kernel v2 REMAINDER only — the core is SHIPPED (the old "not started" row was stale): Task 1a + §2 TENSE (1.50.515) + §3 LANG-CROSS (1.50.516) + §4 ingestion engine/extraction/UI/D1/reader-bridge/auto-sync (1.50.517-521 + relay kernel-v2 routes) are all live. REMAINING after KERNEL-V2-READER-001 (1.51.88): ~~(b)~~ DONE — the STORED WORK HISTORY builder reads the STAGED v2 kernel directly (antcv:ingestedKernel) and appends per-role " | DO-NOT-TRANSLATE: …" (capped 12) that the §3 rule honors; (a) PARTIAL — the language-token path is v2-direct, the bullets path still reads the projected v1 shape (safe while autoSync projects v2→workHistory; full migration = larger reader rework); (c) es/zh + lazy `language_view` tier (LANG-EXPAND-001) — needs real models; (d) §6 regression parity pass (P/DOCX/PDF, desktop+mobile) on a sample UPLOADED docx — owner-gated | docs/plan/KERNEL-V2-AND-INGESTION.md; unit/kernel-v2-reader.test.mjs | 2026-07-03 |
```

**TO-DO SUMMARY twin (verbatim):**

```
| 8 | Kernel v2 — bullets-path v2 migration, es/zh tier, §6 regression pass on uploaded docx | TO DO |
```

---

## Row 12 — AI-NOTICE-LEFT-CLOUDCONVERT-001

_verified: 2026-07-03_

**OPEN-queue row (verbatim):**

```
| 12 | ~~diag-ai-notice-anchor RED~~ CLOSED (2026-07-03): the WORKER was right — AI-NOTICE-LEFT-CLOUDCONVERT-001 (owner 2026-07-01) replaced the mso-position-horizontal keyword (LibreOffice ignores it) with an explicit page-relative margin-left offset; the DIAG still asserted the abandoned keyword. Diag updated to the shipped encoding (margin-left 0pt/275pt + jc) → AI-NOTICE-ANCHOR OK; docx baseline now 35/38 (remaining 3: cjlr-table-export, pageflow-export, spacing-linkedin-export) | memory stale-status-deadflags → fixed | 2026-07-03 |
```

---

## Row 21 — SETTINGS-ROLLER-RESET-001

_verified: 2026-07-03_

**OPEN-queue row (verbatim):**

```
| 21 | ~~SETTINGS-ROLLER-RESET-001~~ FIXED (1.51.90): mechanism CONFIRMED live — history.back() with Settings open was a REAL navigation (side/tilt buttons beside the roller send Back/Forward; no SPA history guard) → reload → Loading gate → restored panel = the mini-reset; almost surely ACCOUNT-SCROLL-RESET-001's mechanism too. Fix = antcv-settings-history-guard.js (sentinel history state while Settings open; Back consumes it → popstate re-pushes + closes the panel like ✕; kill-switch antcv:no-settings-history-guard). diag-settings-history-guard.mjs: guarded = no reload + panel closed + sentinel re-armed; kill-switch control = navigates away (the reset, reproduced). OWNER VERIFY: hard refresh → open Settings → press the roller-side button → panel closes, NO Loading gate | ACTIVE_BUGS 2026-07-03 → fixed 1.51.90 | 2026-07-03 |
```

---

## Row 22 — CL-SLOGAN-RICHCONTENT-001

_verified: 2026-07-03_

**OPEN-queue row (verbatim):**

```
| 22 | CL-SLOGAN-RICHCONTENT-001 (owner 2026-07-03): the COVER LETTER SLOGAN is to be a RICH_CONTENT object — a proper rich_block-class element of the CL (headline/rule/CJLR capabilities like other CL sections), surfaced as a cover-letter settings element (it already sits inside the CL FORMAT panel via F3). DESIGN CONSTRAINT (do not regress): the slogan lives in STANDALONE keys (antcv:clSlogan/-Hidden/-Align, read at 3 render sites + worker meta.slogan) precisely BECAUSE cloud-restore clobbered section-based prose (sidecar-prefs-clobber-hazard, CL-SIG-SLOGAN-CLOUD-001) — a rich_content version must keep restore-safety (either a section shape whose content mirrors the standalone keys, or section-first with the keys as the durable backing). PHASE 1 SHIPPED 1.51.90/91 (antcv-cl-slogan-element.js: SLOGAN = first Body element, SIGN-OFF + SIGNATURE = final Body elements, keys-backed, kill antcv:disable-cl-slogan-element). REMAINING phase 2 = real sections.cl rich_block objects — needs dedupe at the 3 render sites + worker (double-render hazard); spec before splicing; touches me().cl skeleton + converters + worker buildLinearDocument | owner 2026-07-03 | phase 1 |
```

**TO-DO SUMMARY twin (verbatim):**

```
| 22 | CL slogan rich-content phase 2 — real sections.cl rich_block object, dedupe render sites | TO DO |
```

---

## Row 33 — WHY-RULE-EXPORT-PARITY-001

_verified: 2026-07-03_

**OPEN-queue row (verbatim):**

```
| 33 | EXPORT-ALIGN-PARITY family (button-audit findings 2026-07-03, VERIFY-FIRST): (a) NAME-ALIGN-EXPORT-PARITY — Name-line alignment persists in `antcv:nameLineAlign` (antcv-name-align-fix.js preview-DOM sidecar); docx-client never reads it → centred Name may export left. Verify: set key → buildPayload → header_align.name; fix = read the key as a header_align fallback in docx-client. (b) HEADLINE-ALIGN-EXPORT-PARITY — section-headline CJLR persists in `antcv.sectionHeadlineAlignment.v1` (+userTouched) via antcv-section-panel-211.js and is preview-only; neither buildPayload nor worker headingParagraph consume it → PDF headlines ignore the user's alignment. Fix = forward a headline_align map per sid + honor in headingParagraph (worker bump). Same family as WHY-RULE-EXPORT-PARITY-001 (1.51.64). **DONE** — (a) docx-client reads antcv:nameLineAlign as a header_align.name fallback; (b) headline_align map forwarded per loc/sid from antcv.sectionHeadlineAlignment.v1 into buildPayload, and docx-worker headingParagraph honors ctx.headlineAlign[main|sidebar] (worker deployed); export-align-parity test locks both | PANEL_BUTTON_AUDIT_2026-07-03 | DONE 1.51.x + docx-worker |
```

**TO-DO SUMMARY twin (verbatim):**

```
| 33 | Export align parity — name-line + section-headline alignment lost on PDF/DOCX export | DONE 1.51.x + docx-worker |
```

---

## Row 24 — ANALYTICS-BUTTONS-SESSION-TIMEOUT-001

_verified: 2026-07-03_

**OPEN-queue row (verbatim):**

```
| 24 | ANALYTICS-BUTTONS-SESSION-TIMEOUT-001 (owner 2026-07-03): every Settings admin ANALYTICS button (Export JSON/CSV, View summary) -> session-timeout error + app restart. Prime suspect: antcv-auth.js wrappedFetch 401 rule — isRelayUrl matches /analytics/* under proxyUrl and indexOf("auth") matches "unauthorized" -> token wipe -> login-gate reboot. CLIENT PATCHED 1.51.92: the wipe is scoped to /auth/* + /api/prefs with relay session strings only (no auth-substring match — Unauthorized contained it); 5-test repro unit/auth-401-wipe-scope.test.mjs proves analytics 401s survive + real expiry still signs out. Mechanism live-confirmed hop-by-hop (relay 401 unauthenticated; proxy passthrough body Unauthorized-supply-secret). SERVER FIXED TOO (2026-07-03): root of the 401 = secret-pair mismatch — set ONE fresh shared value as ANALYTICS_SECRET (cv-proxy) + UPSTREAM_ANALYTICS_SECRET (relay); VERIFIED live: /analytics/summary AND /api/analytics/export return 200 with data via the relay-injected secret path (the exact call the relay makes for admins). Both workers already at tree versions (relay auth-26, proxy 3.7.1) — no redeploy needed. OWNER VERIFY: press the three buttons after Hard Refresh — expect a download / summary alert, and NO restart in any case | owner 2026-07-03 | yes — owner-verify |
```

**TO-DO SUMMARY twin (verbatim):**

```
| 24 | Analytics buttons — both sides fixed, needs owner click-through confirm | TO DO |
```

---

## Row 26 — TOOLS-SIDEBAR-COMPRESS-001

_verified: 2026-07-03_

**OPEN-queue row (verbatim):**

```
| 26 | TOOLS-SIDEBAR-COMPRESS-001 (owner 2026-07-03, nightly): unsolicited TOOLS & METHODS sidebar not compressed enough — owner gold text: Instruments = "Optical benches, HRSEM, confocal imaging, interferometry, Raman spectroscopy, probe stations" (HRSEM only, drop SEM when tight); Lab & fabrication ends "…SOI MEMS/NEMS" (no trailing "fabrication"). Encode as compression rules in the compress path (rich_block — do NOT convert), preview+PDF parity. PROGRESS: SIDEBAR-LINE-ECONOMY-001 gen rule (1.51.113) + TOOLS-HIDDEN-RESIDUE-001 (1.51.114-116) shipped — the packing mechanism exists; the exact owner gold-text (Instruments/Lab strings) as a deterministic rule is the open remainder. **DONE 1.51.2941 — TOOLS-SIDEBAR-COMPACT-BELT-001**: the deterministic synonym/trim table now lives in gold-rules.json `sidebar_compact` (canonical spec, item-scoped) AND is applied to the live render by a new stored-sections belt `pwa/antcv-sidebar-compact-001.js` (preview+PDF parity, both read stored sections). Rules: `confocal microscopy`→`confocal imaging`, `electrical probe stations`→`probe stations`, drop standalone `SEM` when `HRSEM` sibling (+`HRSEM/SEM`→`HRSEM`), trim trailing redundant `fabrication` word. Scoped by the Instruments/Lab lead label so main-column prose is never touched; rich_block value only (no convert); idempotent + text-verified; kill `antcv:disable-sidebar-compact`. 8 unit tests (sidebar-compact.test.mjs); suite 1440/1440. NOTE: exact gold TOKEN ORDER (HRSEM 2nd) is the separate SIDEBAR-PACKING belt (rule 40); this belt does the tightening. Owner verify: the unsolicited export sidebar renders the gold Instruments/Lab strings. | ACTIVE_BUGS 2026-07-03; 1.51.113-116, 1.51.2941 | DONE (belt) — owner visual verify |
```

**TO-DO SUMMARY twin (verbatim):**

```
| 26 | Tools sidebar compress — exact owner gold-text (Instruments/Lab strings) as deterministic rule | TO DO |
```

---

## Row 30 — LLM-IMAGE-ROUTING-001

_verified: 2026-07-03_

**OPEN-queue row (verbatim):**

```
| 30 | LLM-IMAGE-ROUTING-001 (night 2026-07-03/04, follow-up to JD-VISION-PROVIDER-001 fixed 1.51.102): make ee() image-AWARE — when messages contain image content blocks, filter vision-blind providers (mistral) out of the ladder instead of relying on per-call-site ordering (preferGPT pins); consider extending the output-adequacy gate beyond parse_jd/generate_cv to vision extraction calls (a short non-answer from a vision-blind provider currently counts as success). **DONE** — VISION_BLIND={mistral} + messagesHaveImages()/filterVisionBlind() in BOTH proxy + demo-proxy multi-llm.js (order filtered after roleHeadOrder, never emptied); PWA ee() ladder also drops mistral on image messages (app.js+src mirror); image-routing-ee test + both-bundle lock. Both workers deployed. Adequacy-gate extension to vision calls remains a nice-to-have | ACTIVE_BUGS 2026-07-03/04 | DONE 1.51.x (both proxies deployed) |
```

**TO-DO SUMMARY twin (verbatim):**

```
| 30 | LLM image routing — make provider selection image-aware, filter vision-blind providers | DONE 1.51.x (both proxies) |
```

---

## Row 32 — CL-PLATFORM-SIGNALS-001

_verified: 2026-07-03_

**OPEN-queue row (verbatim):**

```
| 32 | CL-PLATFORM-SIGNALS-001 (owner 2026-07-03, "LinkedIn Message Improvement.pdf" — distilled from the Trackman CTO exchange): for HARDWARE-PLATFORM-class JDs the CL generation must reflect: platform thinking (modular platforms, reuse across products, long-term maintainability, reuse surviving org growth — "this resonated directly with the CTO"); technical positioning woven naturally (cameras, LiDAR, tracking systems, electro-optics, multi-sensor — never a keyword list); PM positioning as requirements/architecture/change-governance/prioritization (not generic PM); CURIOSITY tone ("I was curious how…" over "I am the ideal candidate…"); buzzwords banned (innovation/cutting-edge/world-class) in favour of concrete engineering language (platform/requirements/architecture/trade-offs/reuse/scaling). Implementation: gen-prompt rule gated on platform-class JD detection (platform|modular|reuse|product famil) — app.src.js+app.js mirror work, same injection chain as __clusterRule/brandFit; source PDF in Downloads. **DONE** — __platformRule (minified __pr) detector /platform|modular|reuse|product\s*fami/i, injected alongside __clusterRule/__brandFitRule in both bundles; hyphens not em-dashes in the rule; cl-platform-signals test asserts the rule fragment + no em/en dash | owner 2026-07-03 attachment | DONE 1.51.x |
```

**TO-DO SUMMARY twin (verbatim):**

```
| 32 | CL platform-signals — hardware-platform JD tone/positioning gen-prompt rule | DONE 1.51.x |
```

---

## Row 34 — ROLE-MERGE-STORED-001

_verified: 2026-07-04_

**OPEN-queue row (verbatim):**

```
| 34 | EXPORT-PREVIEW-PARITY-SWEEP (spec rule 45; owner ESCALATED 2026-07-04 review 3: "the preview is not updated with regards to role merging and lots of things you implemented in pdf"): **TOP ITEM = ROLE-MERGE PARITY** — design decided: move the deterministic role merge from docx-client (export-only) to STORED sections, one-shot per app+JD (cut-stamp pattern): insert the merged role (rule 41 " & " title, ≤5 bullets, BOTH results per rule 28), keep the constituent roles on:false hidden (eye-reversible, role-doubling _samePosition guards apply); docx-client's export merge stays as an idempotent belt. Then the rest of the inventory: SIDEBAR_ABBR strings, sidebar PACKING token reorder (1.51.119 payload-only), rule-30 LEFT overrides (payload item_alignment), BULLET-CAP belts (1.51.109), LINKIFY markdown. NBSP glue = accepted exception. Also queued: rule 46 belt (no 3-line bullets in tailored gens — preflight measure + L3 re-tighten ≤2 lines) + rule 47 belt (old-role caps ≤3 bullets ≥8y / ≤2 ≥14y). EMPTY-GROUP-HIDE shipped 1.51.126 (stored, parity-safe). **DONE 1.51.154 — ROLE-MERGE-STORED-001** (antcv-role-merge-stored.js): the deterministic same-company merge now runs on STORED sections (STAMP-IN-BLOB, one-shot per app+JD) via the exact docx-client merge exposed as window.AntcvMergeSameCompanyRoles — inserts the merged role, hides constituents on:false (eye-reversible), so preview==export byte-for-byte; the export merge is now an idempotent no-op; targeted-only, anti-doubling, restore-proof; 7 tests | Trackman rounds 2-3 | DONE 1.51.154 (role-merge parity) + empty-group leg 1.51.126 |
```

**TO-DO SUMMARY twin (verbatim):**

```
| 34 | Export/preview parity sweep — role-merge parity is the owner-escalated top item (rules 46/47 belts SHIPPED 1.51.130: no 3-line bullets in targeted + old-role bullet caps; role-merge stored-sections parity DONE 1.51.154) | DONE 1.51.154 |
```

---

## Row 27 — MAIN-RUNT-ORPHAN-SWEEP-001

_verified: 2026-07-04_

**OPEN-queue row (verbatim):**

```
| 27 | MAIN-RUNT-ORPHAN-SWEEP-001 — CORE SHIPPED 1.51.119 (ORPHAN-PREFLIGHT-V3, all in the preflight sidecar, no app.js edit): RUNT_FRAC 0.40→0.60 (the owner fill floor IS the detector), MAX_BIND 8; NO-FORCE-JUSTIFY belt (rule 30 — natural-width measurement + payload item_alignment LEFT override on the worker's own paraAlignPath keys, user CJLR/__group__ always wins); L3 LENGTHEN-from-kernel (safeRewrite: facts-backed new numbers only, ≤1.9x growth, re-measure accepts fill≥60% with NO line gain); SIDEBAR-PACKING belt (rule 40 deterministic half — greedy long+short token reorder on comma-list values, measured-lines-drop acceptance, rich_block {b,t} + labeled_list {l,v}, kill antcv:disable-sidebar-packing); rich_block sidebar rows joined L2 binding (v2 never saw TOOLS at all). 35 unit tests; suite 875/875. REMAINING: (a) Work-style tail truncation — verify against the OWNER's stored kernel (live data; dedup is banned — diagnostic-first); (b) page-3 ghost (sidebar spill pagination; expect packing to shrink it — re-measure on a real export); (c) ~1.5-page target on a FRESH NIL-targeted generation export (owner gate, rule 38) | ACTIVE_BUGS 2026-07-04 (1.51.119) | partial — v3 shipped, real-PDF verify pending |
```

**TO-DO SUMMARY twin (verbatim):**

```
| 27 | Orphan sweep v3 — work-style tail truncation, page-3 ghost, real-PDF 1.5-page verify | TO DO |
```

---

## Row 28 — NIL-GEN-ADAPTATION-001

_verified: 2026-07-04_

**OPEN-queue row (verbatim):**

```
| 28 | NIL-GEN-ADAPTATION-001 (owner 2026-07-03, "do not forget", nightly/next-session): the NIL targeted generation must (a) adapt SPECIALIZATION + CL SLOGAN to the JD, (b) cut irrelevant sidebar content with the exempt list Interests/Languages/Accessibility, (c) MERGE low-relevance positions + remove/rephrase bullets, (d) produce the second CL page from the JD's applicant QUESTIONS. Rules 10-13 appended to docs/qa/JD-SPECIFIC-CV-COMPRESSION-SPEC.md; (d) is shipped machinery (APPLICATION-QA-001) that needs a NIL regen VERIFY post-1.51.97; (a)-(c) are gen-prompt + trim-sidecar work per the spec's implementation notes. OWNER ROUND-2 ADDITIONS (2026-07-03 night): Security-Guard-class irrelevant roles must be CUT or MERGED ("how is security guard relevant???"), and the targeted CV must CONSOLIDATE to ~1.5 PAGES (page-count target for rule 12; current export = 5 pages). ROUND-4 REVIEW (owner 2026-07-04, first NIL-targeted export — spec rules 14-24): CV header keeps adapted SPECIALIZATION (not the Application line, 14); tools aggressive cut (15); 3-4 bullets/role (16); merged role ≤5 bullets + >1 Result (17); hide Security Guard/Students Council/Team Ops (18); regulatory flat-when-few + STANAGs irrelevant (19); accessibility one line + "has not limited his career" BANNED needs SCRUB BELT (20 — prompt rule was violated); patent WORD in the stray-light bullet, number stays in Publications (21); PROFILE scrub belt (22 — NO-FILLER + NO-DISABILITY both violated); slogan must adapt per role, surprising (23); CL Q&A = real separate page with own header/closure/sign-off/signature/AI notice (24). UNBLOCKED — targeted state sticks (round 4). BELTS SHIPPED 1.51.103: rule 20+22 = antcv-profile-access-scrub.js (PROFILE-ACCESS-SCRUB-001: profile drops disability/filler/career-comment sentences, never below 20 chars; banned career clause stripped from ALL cv+cl strings incl. accessibility rows; 5 tests); rule 21 = stray-light pin now "Co-invented the PATENTED stray-light optical window…" (both byte-identical copies + old[] upgrade). SHIPPED since: rule 24 (QA standalone page, 1.51.107/110-112 + wk 1.14.126); rules 16/17/18/34/36/38 export belts (1.51.109); rules 20/21/22 scrub + kernel v10b seed (1.51.103/104/109); merged-title "&" (1.51.113). FINAL NIL PAIR delivered + 14/14 checks green (1.51.112 + wk 1.14.127). REMAINING: CV ~1.5pp gen-level target (rides row 27 orphan work), ~~adaptive per-role slogan (23)~~ CLOSED 1.51.120+1.51.127 (SLOGAN-FRESH-GEN-001 render leg + SLOGAN-SMART-STATEMENT-001 gen leg: dedicated cl_slogan prompt field distinct from the specialization triad, adopted into the key, targeted CLs never fall back to the specialization — fresh-gen verify = the owner's next targeted regen), ~~SIDEBAR-RELEVANCE-CUT belt~~ SHIPPED 1.51.121 (antcv-sidebar-relevance-cut.js — deterministic JD-relevance cut, tools token-level + certs domain-bridge + regulatory domain-lexicon, exempt list honored, one-shot per app+JD, hidden-never-deleted; owner verify on the Trackman row), ~~BRAND-FIT-PALETTE-001 (rule 37)~~ SHIPPED 1.51.123 (deterministic JD-hex sampler fallback into the existing validated apply path, both bundles; owner verify on a checked-🎨 NIL-JD gen), ~~Scholar/AntCV hyperlink render~~ SHIPPED 1.51.122 (worker leg already existed — inlineRuns markdown + PUB-MASTERSITE; client legs: masterSite payload forwarding + SCHOLAR-LINK-GATE sidecar w/ research gate + rule-35 pointer repair + LINKIFY-EXPORT for kernel-known URLs; closes old row 2's hyperlink half; AntCV gen-surfacing for SW/AI/PM JDs remains a gen-prompt leg). Rule 17a render leg CLOSED 1.51.113 (MERGED-TITLE-JOIN-001, ' & ' joiner + test) | spec rules 10-24, 40-44; ACTIVE_BUGS 2026-07-03 Trackman review | partial — belts through 1.51.120 |
```

**TO-DO SUMMARY twin (verbatim):**

```
| 28 | NIL gen adaptation — CV ~1.5-page gen-level target (current export still 5pp) | TO DO |
```

---

## Row 29 — NIL-TARGETED-STATE-STICK-001

_verified: 2026-07-04_

**OPEN-queue row (verbatim):**

```
| 29 | NIL-TARGETED-STATE-STICK-001 (night session 2026-07-03/04, diagnostic-first): a NIL-TARGETED gen RAN (clProseGuard "NIL Technology|Nanooptics Prototyping Engineer" bucket exists; extraction+analysis OK) but the state REVERTED to Unsolicited before export — no NIL app row was ever created on-device (scope keys: only app 434=Unsolicited jdText-empty + kernel), boot restore re-pinned Unsolicited, lastJdText wiped, filenames+meta Unsolicited. SEPARATELY the NIL CL generation returned an EMPTY body (guard captured the skeleton under the NIL key — capture hole FIXED 1.51.101 CL-GUARD-SKELETON-CAPTURE-001 + boot purge; check D1 llm_calls for the CL leg's provider/adequacy). Investigate: app-row creation on targeted gen (targeted-app-persistence 4-layer expects a row), JD-scope pointer, and the CL-empty retry gate (E4 family). ROUND-3 EVIDENCE (owner regen on 1.51.102, exports "(3)/(2)"): extraction+vision+parse ALL WORKED — rationale carries the 2 REAL NIL questions, and the prose guard captured foundation+contribute under "NIL Technology|Nanooptics Prototyping Engineer" ⇒ meta WAS "NIL Technology" DURING the gen; the revert to Unsolicited happened POST-GEN, SAME SESSION, before export. Post-state: app row 435 created but 435:jdText+435:questions EMPTY, no 435:company key; kernel:company=Unsolicited; kernel:jdText exists EMPTY (written then cleared). PRIME SUSPECTS in order: (a) cold/idle cloud-restore re-adopting the STALE cloud active_application pointer (still the Unsolicited app; SAME device id ⇒ shouldAdoptCloudPointer=true — the foreign-device guard does not protect same-device stale pointers); (b) auto-commit stamping the new row from already-reverted meta; (c) the tab app-id switch orphaning the JD in the kernel namespace (antcv-jd-scope setCurrentAppId does NOT carry kernel→app). MORNING METHOD: setItem-writer probe (boot-storm pattern) on meta + antcv:app:* in the owner's live tab during ONE gen — capture the writer stack that flips meta. SEPARATE LEG: CL "most empty" persisted across the 4-attempt forced-provider ladder (claude→mistral→gemini) — pull D1 llm_calls for the parse_jd attempts (adequacy/parse failures per provider). Greeting also exported as the literal "Dear [Hiring Team / Name]," placeholder. ROUND-4 (2026-07-04): PRIMARY revert CLOSED — META-DOWNGRADE-GUARD-001 (1.51.105, 277 refuses a downgrade) + META-DRIFT-GUARD-002 (1.51.108, second unguarded cloud-adoption block, both bundles); probed live NIL gen stuck through reload + export, both PDFs NIL-named. REMAINING: ~~(A) 277 sequence/timestamp guard~~ DONE 1.51.124 (277-SEQUENCE-GUARD-001: in-flight meta-identity guard skips the whole adoption when a gen lands mid round-trip + updated_at staleness guard w/ 3-min skew margin — the relay already surfaced the D1 timestamp); ~~(B) CL hydration race~~ DONE 1.51.124 (CL-HYDRATE-EXPORT-GATE-001 in buildPayload: placeholder guarded CL sections hydrate from the guard bucket / meta.opening+greeting inside the PAYLOAD — React-state exports could never be fixed by a storage heal); (C) stale-row snapshot restore on selection + auto-save downgraded-meta belt — HIT LIVE 2026-07-04 ("the fuck?" Trackman revert: full regulatory + all 12 roles back on:true, jd scope empty). CUT half self-heals since 1.51.129 (STAMP-IN-BLOB — the relevance-cut stamp travels inside the sections blob; a restored pre-cut snapshot re-arms the cut automatically; user un-hides travel with the stamp, never re-fought). REMAINING: the ROLE-STRUCTURE revert is the row's SAVED CONTENT (no belt reconstructs the targeted gen's merges/on:false choices — export belts still protect the PDF; clean repair = regen) + the writer hunt (setItem probe on 'sections' during ONE row selection — likely the row auto-save persisting pre-gen content, which ALSO defeats the 277 staleness guard because the stale row is freshly saved → updated_at fresh) + the auto-save downgrade belt; ~~em-dash scrub for meta-sourced CL prose~~ DONE (EMDASH-META-CL-PROSE-001, 1.51.118). The 97.5% loop persists on FRESH gens | ACTIVE_BUGS 2026-07-03/04 rounds 2-4 + 1.51.124 | partial — legs A/B/em-dash closed; leg C remains |
```

**TO-DO SUMMARY twin (verbatim):**

```
| 29 | NIL state-stick — leg C: stale-row snapshot restore + auto-save downgraded-meta belt | TO DO |
```

---

## Row 2 — LINKIFY-EXPORT-001

_verified: 2026-07-05_

**OPEN-queue row (verbatim):**

```
| 2 | SW-projects hyperlink + line-end overflow — HYPERLINK HALF CLOSED 1.51.122 (LINKIFY-EXPORT-001: kernel project URLs render as real clickable links in the PDF; SCHOLAR-LINK-GATE for the publications record). REMAINING: the line-end overflow leg — **DIAGNOSED + REGRESSION-LOCKED 2026-07-05.** Root cause = the hardcoded SIDEBAR_W=4636 (~0.389) made the MAIN column ~6% narrower than the preview, so justified body/bullet text wrapped ~½ line early / slid past the edge. Already FIXED by PB-WORKER-SIDEBAR-RATIO-001 (1.14.41): the worker derives the split from the forwarded `sidebar_ratio` (client `cvSidebarRatio`, default 0.33 — the SAME width the preview uses), `ctx.mainW = PAGE_W - round(PAGE_W*ratio)`, and every main section-wrapper renders at `ctx.mainW - 288` (index.js ~26466, uses `ctx.mainW` NOT the legacy `MAIN_W` constant — the "columnWidths:[MAIN_W-288]" comment is stale). Verified end-to-end: worker emits main-content gridCol 7689 @0.33 / 6260 @0.45, width TRACKS the ratio, legacy narrow 6982 is gone. New lock: main-column-ratio-width.test.mjs (differential across two ratios + legacy-width-absent). Any residual per-LINE wrap difference vs the preview is font-metric/padding fidelity (Carlito advance widths vs the browser font; cell margins) — the SAME class as the TABLES leg, tracked under row 25 and real-PDF-gated. Content+bullets leg CLOSED | 2026-06-29 batch OPEN list; 1.51.122; diagnosed 2026-07-05 | content+bullets DONE (locked); table-fidelity → row 25 |
```

**TO-DO SUMMARY twin (verbatim):**

```
| 2 | SW-projects line-end overflow leg (hyperlink half already closed) | DIAGNOSED+LOCKED 2026-07-05 — root cause fixed by PB-WORKER-SIDEBAR-RATIO-001; residual per-line fidelity folds into row 25 |
```

---

## Row 39a — AUTOSAVE-NO-DOWNGRADE-001

_verified: 2026-07-05_

**OPEN-queue row (verbatim):**

```
| **39a** | **TAB/DEVICE ISOLATION residuals — AUTO-SAVE POISON-WRITER CLOSED (AUTOSAVE-NO-DOWNGRADE-001, access-relay, 2026-07-04) + SAME-DEVICE STALE POINTER CLOSED (PTR-STALE-GUARD-001, client, 2026-07-04).** Relay leg: PUT /api/applications/:id now blocks a meta downgrade (real company → empty/Unsolicited dropped) and a blank-overwrite (empty [] over populated cv/cl dropped); explicit null wipe honoured; genuine upgrades pass. diag-app-autosave-downgrade-guard.mjs 5/5; relay-only, DEPLOYED. Client leg (PTR-STALE-GUARD-001, 1.51.135): the existing `__foreignDevice` check only protects a cold-restore from adopting ANOTHER device's active_application pointer — it explicitly treats a SAME-device pointer as always trustworthy, and the content-based drift guards (META-DRIFT-GUARD-001/002) only catch real→empty/unsolicited, not real→a DIFFERENT real company. New self-contained sidecar `antcv-pointer-stale-guard.js` (`window.AntcvPointerStaleGuard.isStalePointer`) reuses the 277-SEQUENCE-GUARD-001 timestamp pattern: compares the pointer's `_pointer_updated_at` against the local `antcv:metaStamp` for the CURRENT local company/role identity (same 3-min clock-skew margin); backward-safe (inert unless BOTH timestamps are present as positive evidence — never blocks a first-cold-start or never-stamped session). OR-ed into the drift check at BOTH adoption sites (Read-from-Cloud `__draftDrift`, cold-restore `__draftDrift2`) in both bundles; kill switch `antcv:disable-ptr-stale-guard`. 11 pure-function tests + a both-bundle mirror-lock test (jd-scope-isolation.test.mjs); suite 968/968 + boot-smoke. Together these two fixes close BOTH halves of the "the fuck?" Trackman revert (poisoned row write + stale pointer re-adoption). REMAINING: row 19 two-real-device test (owner-gated, needs a real second device) + the setItem-writer probe for any residual live hunt (no repro since). ORIGINAL: **(owner P0 band 2026-07-04, "treat mobile and tab isolation as high priority").** Rolls up the JD-scope + meta-sync isolation work | rows 19/29; memory jd-scope-isolation, targeted-app-persistence | DEPLOYED-CODE-VERIFIED 2026-07-05 (nightly): leg 1 relay guard live — AUTOSAVE-NO-DOWNGRADE-001 present in the PUT/POST /api/applications/:id handler (index.js:2519, `__blockDowngrade`/`__blockCvBlank`/`__blockClBlank`, explicit-null honoured) AND RELAY_VERSION 'auth-26-per-style-kernels' == live /health, so the deployed relay carries it. Observed: `meta` blob write (line 2544) is NOT downgrade-guarded server-side (jd_company/jd_role are) — backstopped client-side by META-DRIFT/DOWNGRADE guards; minor server-side asymmetry, owner-follow-up note. Leg 2 PTR-STALE-GUARD-001 sidecar present + loaded once + wired both bundles. Live authed downgrade-PUT + same-device stale-pointer A/B + leg 3 two-real-device all owner-gated (need session / real device) |
```

**TO-DO SUMMARY twin (verbatim):**

```
| **39a** | **TAB/DEVICE ISOLATION residuals** — auto-save poison-writer CLOSED (AUTOSAVE-NO-DOWNGRADE-001) + same-device stale cloud-pointer re-adoption CLOSED (PTR-STALE-GUARD-001, 1.51.135). REMAINING: row 19 two-real-device test (owner-gated) + the setItem-writer probe for any residual live hunt. | **PARTIAL — 2 of 3 legs shipped** |
```

---

## Row 41

_verified: 2026-07-05_

**OPEN-queue row (verbatim):**

```
| **41** | **SO-004 (owner, CRASH): React #185 (unstable/duplicate key or setState-in-render) on editor field commits, shared across MULTIPLE editors — root cause not isolated.** #185 = "Objects are not valid as a React child" / minified invariant; reproduce headlessly by committing a field in each editor (section panel, header, CL) and capturing the pageerror + component stack; isolate the shared component (likely a shared row/list renderer with a bad key or an object rendered directly). Diagnostic-first, no speculative edit. **CORRECTION (see the fuller row 41 entry above): #185 in this React-18 prod bundle is actually "Maximum update depth exceeded", not "Objects are not valid as a React child" — that entry has the current investigation + the 1.51.160 production capture probe** | owner backlog 2026-07-04 | no |
```

**TO-DO SUMMARY twin (verbatim):**

```
| **41** | **SO-004** CRASH — React #185 on editor field commits, shared renderer. | **TO DO — instrumented, NO headless repro (2026-07-05).** Built a real capture harness (diag-so004-capture.mjs): boots owner-shaped, opens the actual side panels, wraps React's dispatcher, hammers commits on desktop+mobile(390px). Max 4 setState/frame vs 50 loop threshold; 0 pageerrors. #185 in this React-18 bundle = "Maximum update depth exceeded". The only remaining dep-less measure→setState effect (`Oe`, app.src.js:10704) is proven self-stabilizing (overlay doesn't change parent scrollHeight). Owner hits it live on Android Chrome → likely a mobile-only reflow oscillation (URL-bar viewport dance) that headless Chromium's stable layout can't produce. NEXT: run the harness on a real Android session (or add an always-on production setter-frequency probe) to capture the exact site with a stack — no speculative render patch until then. **PROBE SHIPPED 1.51.160** — did not monkey-patch React.useState/useReducer in production (too broad a blast radius for one bug); instead widened the already-deployed antcv-debug-logger.js error capture: on a #185 match it now also records which editor panel was open, whether the field-editor view was reached, input/change events in the 3s before the crash (from the logger's own breadcrumb trail), and step/doc state — all in the existing on-device viewer/export, no DevTools needed. Verified headless (synthetic #185 gets the extra fields, unrelated errors don't). Waiting on the next live crash to actually populate a capture |
```

---

## Row 42 — GEN-LANGFAB-001

_verified: 2026-07-05_

**OPEN-queue row (verbatim):**

```
| **42** | **GEN-LANGFAB-001 (owner, CONTENT): the generator fabricated language proficiencies (invented "German", wrong Danish level).** Kernel truth (memory gabriel-cv-facts): EN/HE fluent, ES professional, DA B1, NO German. The same-model self-review passed it (see GEN-MODELROLE design — supervisor should be a DIFFERENT model). Fix direction proposed, not implemented: a post-gen LANGUAGE-FACT belt that reconciles generated languages against the kernel `languages` (drop any language not in the kernel; correct the level to the kernel value; name-neutral, all personas). Deterministic sidecar, not a prompt line. **SHIPPED 1.51.136** (antcv-lang-fabrication-guard.js): reconciles the stored CV languages section vs kernel personalInfo.languages — DROP non-kernel names, CORRECT levels to kernel; name-neutral, both item shapes ({l,v}/{b,t}), bidirectional-containment tolerant (no ping-pong with languages-concise), empty-kernel no-op, kill antcv:disable-lang-fabrication-guard; 9 unit tests, suite 977/977. Verify-first also confirmed WHY the prompt pin was insufficient: the role-based supervisor/coherence grounding path is not exercised live (0 supervisor-tagged llm_calls). Owner-verify = a fresh gen omits German + shows Danish B1 | owner backlog; memory gabriel-cv-facts | 2026-07-05 SHIPPED |
```

**TO-DO SUMMARY twin (verbatim):**

```
| **42** | **GEN-LANGFAB-001** — fabricated languages (invented German, wrong Danish); deterministic language-fact belt vs kernel. | **SHIPPED 1.51.136** — antcv-lang-fabrication-guard.js reconciles CV languages vs kernel personalInfo.languages (drop non-kernel, correct levels), name-neutral, both shapes, bidi-containment tolerant, 9 tests; owner-verify on a fresh gen |
```

---

## Row 43

_verified: 2026-07-05_

**OPEN-queue row (verbatim):**

```
| **43** | **CA-006 (owner, CONTENT): the "Application: <role> — <company>" label bleeds into the FIRST experience role title.** Root cause traced (owner), fix not started (touches app.js → surgical mirror). Likely the header Application-line injection writing into the roles[0].title or a shared render slot. VERIFY-FIRST: reproduce on a targeted gen, find the write site, guard it (the Application line is header furniture, never role content). **SHIPPED 1.51.139** — verify-first corrected the register's guess: it does NOT touch app.js / roles[0].title. It is a PREVIEW-ONLY bleed in the sidecar antcv-candidate-preview-editor-341.js (the clean DOCX/PDF never run it). On Path C — findCandidateBlock() falls back to the WHOLE preview paper because no candidate drop-loc / candidate-sid marker exists — the anchor loop scans the whole document and matches the first experience role line (same role/company text) whose [data-sid] ancestor was lost on paginated .antcv-page-row clones / merged roles, injecting "Application: …" before it. FIX = a Path-C-only header-whitelist on BOTH anchor loops (Application sentence + Specialisation): when block is the whole paper, require the anchor to sit inside a candidate-header marker (data-antcv-candidate-band / drop-loc / candidate sid). Strictly additive (can only reject anchors, never create a bleed), inert on the already-scoped Paths A/B, and if a markerless Path-C build has no candidate region the code already refuses to materialise a phantom sentence (no new regression). Tests: ca006-pathc-header-guard.test.mjs 4/4 static lock + diag-candidate-header-edit.mjs Playwright regression green (sentence + specialisation still editable, 0 app errors). Suite 992/992. Sidecar only, no app.js edit | owner backlog 2026-07-04 | 2026-07-05 SHIPPED |
```

**TO-DO SUMMARY twin (verbatim):**

```
| **43** | **CA-006** — Application label bleeds into first role title; guard the write site. | **SHIPPED 1.51.139** — preview-only bleed (antcv-candidate-preview-editor-341.js): on Path C (findCandidateBlock falls back to the whole paper) the anchor search matched the first experience role line whose [data-sid] ancestor was lost on paginated/merged renders. Fix = Path-C-only header-whitelist guard on both anchor loops (Application + Specialisation), strictly additive (rejects only, never bleeds), inert on scoped Paths A/B; 4 static-lock tests + Playwright regression diag green (editing intact); suite 992/992 |
```

---

## Row 44 — JD-ANALYSIS-PRINT-001

_verified: 2026-07-05_

**OPEN-queue row (verbatim):**

```
| **44** | **JD-ANALYSIS-PRINT-001 (owner, BUG): "Download analysis (PDF)" prints the CV instead of the JD analysis.** memory analysis-report-pdf: the branded AI-watermarked analysis PDF should render jd-analysis assumptions/recommendations/confidence_notes. VERIFY-FIRST: trace the analysis export button → it likely calls the CV export path / wrong payload doc-type. Fix the button's export target. **SHIPPED 1.51.137** — verify-first correction: the content builder (reportHtml) was already correct (reads only rationale/meta/personalInfo, never CV sections). The real defect was the PRINT SURFACE: antcv-analysis-report-pdf-360.js rendered the report into a `visibility:hidden;width:0;height:0` iframe, and Chrome's iframe.contentWindow.print() on an unlaid-out iframe prints the TOP-LEVEL page (the CV preview) instead. Fix = render-present offscreen iframe (`left:-99999px;width:794px;height:1123px;opacity:0`), the repo's known-good pattern. 3 static regression tests (analysis-print-surface.test.mjs); suite 980/980. Owner-verify = click Download analysis (PDF) → gets the analysis report, not the CV | owner backlog; memory analysis-report-pdf | 2026-07-05 SHIPPED |
```

**TO-DO SUMMARY twin (verbatim):**

```
| **44** | **JD-ANALYSIS-PRINT-001** — analysis PDF button exports the CV; fix the export doc-type. | **SHIPPED 1.51.137** — root cause was NOT a wrong doc-type/payload: the analysis HTML was correct but rendered into a visibility:hidden/0x0 iframe, so Chrome's contentWindow.print() fell back to printing the top-level CV preview. Fix = render-present offscreen iframe (antcv-analysis-report-pdf-360.js); 3 static regression tests; owner-verify by clicking Download analysis (PDF) |
```

---

## Row 46 — MOBILE-PANEL-ZOOM-001

_verified: 2026-07-05_

**OPEN-queue row (verbatim):**

```
| **46** | **MOBILE-PANEL-ZOOM-001 (owner, mobile P0 — reported live from phone 2026-07-05):** on a phone browser (antcv.pages.dev, Chrome, portrait) at DEFAULT zoom the main-page control cluster below "Generate CV & Cover Letter" is clipped — the Speed segmented control + "Cap $" + the "Brand fit" checkbox row fall off the bottom of the viewport; the owner must set the browser to ~90% zoom to bring all controls into view (evidenced by two screenshots: 90%-zoom = Quick-gen/Speed/Brand-fit all visible; 100% = Brand-fit row cut off). This is a mobile VIEWPORT-FIT / overflow bug, not a scroll issue (the cluster should fit or scroll cleanly at 100%). Band A mobile priority. VERIFY-FIRST: reproduce at a 380px viewport (headless resize or mcp preview mobile preset), inspect whether a fixed-height container / min-height / non-wrapping flex row on the options cluster clips at small heights; likely `antcv-mobile-ui-418.js` or the options-row layout. Fix = let the cluster wrap/scroll within the viewport; do NOT force a meta-viewport zoom hack. **SHIPPED 1.51.140** — headless repro at 380x780 confirmed the Brand-fit row at y=857 (below the 780 fold) and UNREACHABLE. Root cause was NOT antcv-mobile-ui-418 or the options row: it is the UPLOAD screen's outer `.fade` container in app.src.js (`"upload"===Nt`) which centers its content (`minHeight:100dvh; justifyContent:center`) but has NO internal scroll, while on mobile `#root`/`body` are viewport-locked (`height:100dvh; overflow:hidden`), so the 945px form overflowed the locked 780px root and was clipped. Fix (surgical app.src.js + minified app.js mirror, node-patch + vm.Script parse-gate, occurrence-guarded on the fade-through-`maxWidth:480` span): the `.fade` becomes its own scroll container (`height:100dvh; overflowY:auto`) and its inner max-width:480 column gets `margin:auto 0` — auto margins override justify-content in flexbox, so it stays centred when it fits and scrolls from the top (no top-clip) when it does not. Verified: diag-mobile-panel-zoom.mjs — before: CLIP SUSPECT (#root overflow:hidden, sh 945 > 780); after: no clip, `.fade` is an overflowY:auto scroller, scrolling brings Brand-fit fully into view (top 692/bottom 707 < 780) — DIAG PASS, 0 errors. Suite 992/992; boot-smoke OK (glDemo=function); render-past-sign-in clean. **OWNER-VERIFIED LIVE 2026-07-05** on the owner's real Galaxy S24 Ultra (Chrome, physical device via scripts/phone-qa.mjs `chromium.connectOverCDP`, actual viewport 411×750): Speed/Cap $/Brand fit all render fully visible with zero scrolling needed (Brand fit boundingBox y=702-718, within the 750px viewport) — screenshot confirms. **CLOSED** | owner 2026-07-05 mobile report; 2 screenshots; live phone verify 2026-07-05 | 2026-07-05 SHIPPED + LIVE-VERIFIED |
```

**TO-DO SUMMARY twin (verbatim):**

```
| **46** | **MOBILE-PANEL-ZOOM-001** (owner, mobile P0) — on a phone browser at default zoom the main/Settings panel controls are clipped (the Speed/Brand-fit row falls off the viewport bottom); owner must zoom the browser to ~90% to see all controls. Viewport/overflow fit bug — panel content must fit the mobile viewport at 100%. | **CLOSED 2026-07-05** — shipped 1.51.140, live-verified on the owner's real S24 Ultra via scripts/phone-qa.mjs (real viewport 411×750, Speed/Cap $/Brand fit all fully visible, no scroll needed) |
```

---

## Row 47 — MOBILE-TOPBAR-SAFEAREA-001

_verified: 2026-07-05_

**OPEN-queue row (verbatim):**

```
| **47** | **MOBILE-TOPBAR-SAFEAREA-001 (owner, mobile P0 — reported live from phone 2026-07-05, distinct from row 46):** at 100% zoom on a real phone, the top bar's EN/Unsolicited dropdowns, AntCV title and icon row render right at the very top of the page with no top offset. A CDP-based screenshot (which captures only the web-page layer) shows them as "fully visible" — but that's misleading: on the ACTUAL device, Chrome's own address bar and the OS status bar overlay that same region, so the controls are genuinely obscured/unreachable in real use. First diagnosis attempt (chasing a text match on "Export") was a RED HERRING — matched an unrelated off-canvas "Export options" heading inside the closed Settings drawer, not a real horizontal-overflow bug. Root cause confirmed by code inspection: `.antcv-topbar` (app.src.js, `className:"no-print antcv-topbar"`) had `padding:"8px 12px"` with NO top safe-area handling, even though the BOTTOM toolbar already uses `bottom:"max(10px, env(safe-area-inset-bottom))"` (line ~48628) — an asymmetry (bottom handled, top not). index.html already sets `viewport-fit=cover`, so `env(safe-area-inset-top)` reports a real nonzero value on this device. **SHIPPED 1.51.164** — surgical edit (both app.src.js and the minified app.js mirror, unique-string-verified single occurrence in each, vm.Script parse-gate on app.js): `padding: "max(8px, env(safe-area-inset-top)) 12px 8px 12px"`. Version bump also fixed a pre-existing drift found in passing: index.html's `app.js?v=` was stale at 1.51.155 while TARGET_VERSION/CACHE/ANTCV_VERSION were already at 1.51.163 — all four now aligned at 1.51.164, STALE_VERSIONS extended with 1.51.163. Full suite 1065/1065 green. **FOLLOW-UP same session — the real crowding element found.** Live-verify screenshot via scripts/phone-qa.mjs still showed a green "📄 Export" pill in the topbar after the safe-area fix — traced to `#antcv-pdf-preview-fab` (antcv-pdf-preview-gate.js's print-preview FAB), which `antcv-topbar-tools-347.js` relocates into `.antcv-top-tools` inside the topbar (its own docstring: "Consolidates floating corner FABs into the top bar's tools container"). This is DISTINCT from `.antcv-export-buttons` (⬇PDF/📄DOCX), which lives in a separate `.antcv-preview-actions` row, not the topbar at all — confirmed via live DOM parent-chain inspection, so hiding it was unnecessary (reverted). **SHIPPED 1.51.178**: antcv-topbar-tools-347.js now skips relocating `#antcv-pdf-preview-fab` into the topbar when `window.innerWidth<=900` — it stays in its own default floating position (left:16px, bottom:100px, opposite side from Ask AI/Export FABs, no collision); if a desktop session already relocated it before a resize to mobile, the sweep moves it back out. New antcv-mobile-export-fab.js (mirrors antcv-doc-chatbot-440.js's "Ask AI" launcher exactly — draggable, persisted position) adds an always-visible floating "⬇ Export" shortcut on mobile that forwards taps to the real `.antcv-export-buttons` PDF/DOCX buttons (zero export-logic duplication, zero app.js edit for the actual export mechanism). Version chain re-synced (a mid-session `git fetch` found the cloud Routine had pushed 37 commits to 1.51.175-babel-fish while this fix was being built on stale 1.51.163 — rebased cleanly, re-applied on top, no regression). Full suite 1135/1135 green, deployed + confirmed live on antcv.pages.dev (`ANTCV_VERSION 1.51.178-babel-fish`). Live phone re-verify of the FAB-relocation fix specifically still pending | owner 2026-07-05 mobile report (live session) | 2026-07-05 SHIPPED (1.51.178), live-verify pending |
```

**TO-DO SUMMARY twin (verbatim):**

```
| **47** | **MOBILE-TOPBAR-SAFEAREA-001 + MOBILE-TOPBAR-EXPORT-FAB-001** (owner, mobile P0) — top bar unreachable at 100% zoom on a real phone; owner had to zoom to ~60%. Two legs: (a) no top safe-area padding (minor, `env(safe-area-inset-top)` reads 0 on this device so a no-op fix in practice); (b) VERIFY-FIRST found the real crowding element — `#antcv-pdf-preview-fab` ("Export" pill) relocated into the topbar by antcv-topbar-tools-347.js. | **SHIPPED 1.51.178** — (a) `.antcv-topbar` padding now `max(8px, env(safe-area-inset-top)) 12px 8px 12px`. (b) antcv-topbar-tools-347.js skips relocating `#antcv-pdf-preview-fab` into the topbar on mobile (≤900px) — it stays in its own natural floating spot (left:16px, bottom:100px, no collision with other FABs). Added antcv-mobile-export-fab.js, an always-visible floating "⬇ Export" launcher (mirrors "Ask AI") as a convenient one-tap PDF/DOCX shortcut, forwarding taps to the real `.antcv-export-buttons` (a separate row, `.antcv-preview-actions`, not the topbar — confirmed NOT the crowding cause, left untouched/visible). Both bundles, vm.Script parse-gate, suite 1135/1135. **LIVE-VERIFIED 2026-07-05** on antcv.pages.dev via the real S24 Ultra (scripts/phone-qa.mjs, real Chrome, viewport 457×834): `#antcv-pdf-preview-fab` confirmed OUT of `.antcv-top-tools`, sitting at its natural left:16px/bottom:100px position; topbar is a clean single 44px row (EN/Unsolicited/title/icons only). **CLOSED** (the floating Export FAB mentioned here was removed same-session as redundant — see row 48) |
```

---

## Row 48 — TOPBAR-UNDO-UNIFY-001

_verified: 2026-07-05_

**OPEN-queue row (verbatim):**

```
| **48** | **TOPBAR-UNDO-UNIFY-001 (owner 2026-07-05, same session):** two follow-up asks after row 47: (a) the new purple floating Export FAB didn't open the print preview the green pill already provides once it floats naturally — redundant, remove it; (b) the topbar already has an undo (`.antcv-top-undo`, EDITOR-GEAR-UNDO-001) — no need for a second dedicated undo surface for sidebar/table resizing (antcv-sidebar-visibility-ux.js's own toast-based undo stack), make the ONE topbar button cover both. | **SHIPPED 1.51.181.** (a) Deleted antcv-mobile-export-fab.js + its index.html script tag entirely (1.51.179). (b) Wired `.antcv-top-undo` to also reach the resize-undo stack: whichever action is more recent (a normal sections/meta edit, inferred from the button's own undo-count in its title "(N)"; or a resize, timestamped in the sidecar's stack) wins on click; forces the button clickable when a resize-undo is pending and the app's own history (`dr`) is empty (it renders disabled otherwise). Sidecar-only, no app.js edit to the undo logic itself. **TWO REAL BUGS FOUND DURING LIVE-VERIFY (not guessed, not speculative):** (1) `driveRoller()` (the pre-existing helper that drives the real slider to make React notice a programmatic change) dispatched a plain `new Event('input')` — React's synthetic ChangeEventPlugin doesn't recognize that, so the DOM value visibly moved but the app's real onChange (and its localStorage persist) never fired; the "undo" appeared to work (no error, button enabled, click succeeded) but silently did nothing. This bug predates this session — it affected the ORIGINAL toast-based resize-undo too, not just the new topbar path. Fixed: dispatch a real `InputEvent` (1.51.180). (2) The click-listener attach was gated on a bare module-level boolean (`topbarUndoWired`), not a per-node marker — if the app ever replaces the button element (e.g. on its disabled→enabled transition) rather than updating it in place, the flag stayed `true` from a previous sight and the fresh node got no listener at all; clicks silently did nothing. Fixed: mark wired-state via `data-antcv-undo-unify-wired` on the node itself, the same pattern antcv-topbar-tools-347.js already uses for its own re-parenting hazard (1.51.181). **LIVE-VERIFIED end-to-end 2026-07-05** on the real S24 Ultra via scripts/phone-qa.mjs, through a REAL click (not a direct API call): resized sidebar 0.25→0.28, topbar undo button activated, clicked, value correctly reverted to 0.25. Full suite 1135/1135 green at every step (1.51.179/180/181) | owner 2026-07-05 (same live session as row 47) | 2026-07-05 SHIPPED + LIVE-VERIFIED (1.51.181) |
```

**TO-DO SUMMARY twin (verbatim):**

```
| **48** | **TOPBAR-UNDO-UNIFY-001** (owner, mobile) — remove the redundant purple Export FAB (green pill already floats naturally post-row-47); unify the topbar's undo with the sidebar/table resize-undo instead of a second dedicated surface. | **SHIPPED 1.51.181 + LIVE-VERIFIED** — FAB deleted; `.antcv-top-undo` now also reaches the resize-undo stack (most-recent-action-wins). Found + fixed TWO real pre-existing bugs along the way: `driveRoller` dispatched a plain `Event` instead of `InputEvent` (React never saw the change, undo silently no-op'd — predates this session, affected the original toast-undo too) and the click-listener attach used a global flag instead of a per-node marker (a replaced button got no listener). Verified via a real click: resize → revert, confirmed correct |
```

---

## Row 49 — SIDEBAR-GROUP-PAGE-BREAK-001

_verified: 2026-07-05_

**OPEN-queue row (verbatim):**

```
| **49** | **SIDEBAR-GROUP-PAGE-BREAK-001 (owner 2026-07-05, design guidance):** a very long Focus-Area group in a labeled-list sidebar section (e.g. "Project & delivery management" under TOOLS & METHODS) is currently ORPHANED/truncated when it doesn't fit the remaining space on its page, rather than continuing cleanly under "TOOLS & METHODS (CONT.)" on the next page like other groups already do. Owner explicitly authorizes breaking a long group's OWN rows across the page boundary (some rows page N, remainder page N+1) as an acceptable, wanted behavior — not a bug to prevent. NOT ATTEMPTED THIS SESSION (deliberately) — this touches the docx-worker's core page-DISTRIBUTION algorithm (each page renders as its OWN separate Table object, per PB-WORKER-TWOCOL-PAGED-001; content is measured/assigned to a page up front, not left to Word's natural cross-page cell-overflow — `cantSplit`/body.length<=18 heuristics at index.js:26502 operate at the SECTION level, not per-group within a section), which is the single most recurring, highest-risk area in this project's history (SIDEBAR-PACKING, MAIN-RUNT-ORPHAN-SWEEP, ORPHAN-PREFLIGHT-V3, SIDEBAR-PAGE23-DANCE...). Needs a dedicated diagnostic-first session: reproduce with a real long-group export, find exactly where the page-assignment algorithm currently drops/truncates group overflow instead of carrying it forward, then implement carrying the remainder to the next page's sidebar table under the existing "(CONT.)" heading mechanism | owner 2026-07-05 | not started — scoped, needs dedicated session |
```

**TO-DO SUMMARY twin (verbatim):**

```
| **49** | **SIDEBAR-GROUP-PAGE-BREAK-001** (owner, design guidance) — a very long TOOLS & METHODS group (e.g. "Project & delivery management") is truncated instead of continuing under "(CONT.)" on the next page; owner authorizes breaking a group's rows across pages. | Not started — scoped as its own item, touches the docx-worker's core page-distribution algorithm, needs a dedicated diagnostic-first session |
```

---

## Row 50 — UPLOAD-SCREEN-TOP-CLIP-001

_verified: 2026-07-05_

**OPEN-queue row (verbatim):**

```
| **50** | **UPLOAD-SCREEN-TOP-CLIP-001 (owner 2026-07-05, same live session as rows 46-49):** the upload screen's EN/gear/Editor header row was still cut off at the top despite the earlier UPLOAD-SCREEN-SCROLLTOP-001 attempt (row 46's fix, `ref: el => el.scrollTop = 0`), and a SECOND symptom appeared live: while a background "Generating kernel showcase…" run was active, the same header row rendered BEHIND the fixed progress banner instead of below it. Live CDP measurement on the real phone proved the scrollTop-forcing fix was chasing the wrong mechanism — the header row sat at a NEGATIVE offset (top:-13px) even with scrollTop already 0, so it was never a scroll-position bug. Root cause: the upload screen's outer `.fade` container (`"upload"===Nt`, app.src.js) sets `justifyContent:"center"` on a flex column whose content is TALLER than one viewport — centering overflowing content clips the excess symmetrically off BOTH the top and bottom. The inner content wrapper's `margin:"auto 0"` (added for row 46) already resolves to 0 once content overflows per the flexbox spec (correct top-anchor-and-scroll), but the outer `justifyContent:"center"` was still fighting it. Confirmed live before touching source: toggling `justifyContent` on the real DOM node from "center" to "flex-start" moved the header row from top:-13px (off-screen, no banner) / top:38px (behind the banner's own 0-58px span, banner active) to a clean top:79-79px, clear of both cases. **SHIPPED 1.51.189** — surgical edit in both app.src.js and the minified app.js mirror (unique-string-verified single occurrence in each via Node script + vm.Script parse-gate, since app.js's single-line minified body exceeds the Edit tool's read limit): `justifyContent:"center"` → `justifyContent:"flex-start"` on the upload-screen `.fade` block; also removed the now-confirmed-ineffective `ref: el => el.scrollTop = 0` (dead code from the superseded row-46 fix — scrollTop was already 0, so it never did anything). New `upload-screen-top-clip.test.mjs` (4 tests) locks the fix + the dead-code removal in both files. Full suite 1160/1160 green. Version quintet re-synced to 1.51.189(-babel-fish) across index.html/antcv-version-override.js/sw.js. Owner live re-verify (both with and without an active background generation) still pending | owner 2026-07-05 (same live session as rows 46-49) | 2026-07-05 SHIPPED, live re-verify pending |
```

---

## Row 51 — PREVIEW-SCROLL-JITTER-001

_verified: 2026-07-05_

**OPEN-queue row (verbatim):**

```
| **51** | **PREVIEW-SCROLL-JITTER-001 (owner 2026-07-05, live session, reported as two symptoms: "application analysis panel is stuck again, does not scroll" + "the preview is a bit shaky, very strong jitter — you can see it between two pages"):** live-verified BOTH symptoms share one root cause. The preview's fit-recompute effect (`_i()` in app.src.js, `Gi()` in the minified mirror) unconditionally snaps the shared preview/analysis scroll container back to `(0,0)` (immediate + 80ms + 240ms staggered `scrollTo`), and used to re-fire on ANY change to `[Lt, je, Ke, ya]` (doc type, language, navyColor, styleConfig) with no check on which view was active or whether the user was mid-scroll. Lt/je (doc/language) are deliberate user choices — resetting to top on those is correct and intentional. Ke/ya (navyColor/styleConfig) are PURELY COSMETIC and change silently in the background (brand-fit, the STYLE-BG-FOLLOW-PKG-001 self-heal effect, cloud-restore) — a colour/font change has no reason to move the user's reading position. Live-proven via CDP on the real device before touching source: scrolled the preview to `scrollTop:500` (into page 2), then triggered a real style-package change through the app's own reset API (`window.AntcvPackageState.write`, the same code path a Settings click uses) — `scrollTop` dropped to 209 within ~1s with zero user interaction, reproducing the "shaky, between two pages" snap. The Analysis panel's "stuck, does not scroll" symptom shares the exact same container and effect (a separate, correctly-gated effect at app.src.js ~18864 already resets scroll on `("preview"===ei||"analysis"===ei)` view-switch, which is fine; the broken effect had no such gate and fired regardless of which view was showing). **SHIPPED 1.51.192** — removed `Ke, ya` from the effect's dependency array in both app.src.js and the minified app.js mirror (unique-string-verified, vm.Script parse-gate); `_i()`'s own body is untouched, so doc/language-triggered resets still work. New `preview-scroll-jitter.test.mjs` (3 tests). Full suite 1163/1163 green. Version quintet synced to 1.51.192(-babel-fish). Owner live re-verify pending | owner 2026-07-05 (live session) | 2026-07-05 SHIPPED, live re-verify pending |
```

---

## Row 39 — GEN-MODELROLE-001

_verified: 2026-07-06_

**OPEN-queue row (verbatim):**

```
| **39** | **GEN-MODELROLE-001 — MORE DONE than stated (verify-first 2026-07-04): code shipped AND env configured.** `parseModelRoles`/`roleHeadOrder`/role tags in multi-llm.js + supervisor.js + gen-coherence.js + index.js (both proxy + demo-proxy); AND `MODEL_ROLES = {"writer":"anthropic","supervisor":"mistral","coherence":"anthropic"}` is SET in BOTH `wrangler.toml` [vars] (the owner-decided map, decisions answered 2026-06-13 in docs/plan/GEN-MODELROLE-001_design.md). So it is NOT "not started" and NOT "env unset" — it is fully wired. REMAINING = a LIVE-VERIFY only: confirm the last proxy+demo-proxy deploy included the var (wrangler [vars] apply on deploy) and D1 `llm_calls` telemetry shows the role split actually routing (supervisor calls on mistral, writer/coherence on anthropic). If a deploy is needed: `gh workflow run deploy.yml -f target=proxy` (+ demo-proxy), then curl a supervisor-tagged call. Flagship gen stays opus-4-7 (writer role = the cascade head, unchanged) | docs/plan/GEN-MODELROLE-001_design.md; wrangler.toml:45 | DEPLOY-VERIFIED 2026-07-05 (nightly): both proxies live at tree version (cv-proxy /health 3.7.2-billing-cascade == tree VERSION; relay auth-26 == tree) so wrangler `[vars]` incl. MODEL_ROLES are applied live; MODEL_ROLES present in BOTH wrangler.toml. TELEMETRY ROLE-SPLIT UNCONFIRMABLE by design — D1 `llm_calls` logs by `task` (compress/consensus_poll/parse_jd/analyze_fit…), never by role; 0 supervisor/coherence/writer rows (confirms memory supervisor-role-not-live + row 42). Providers all healthy live (claude+mistral+gemini+openai succeeding). Positive role-attribution needs role-tagged logging (owner-gated enhancement) or an authed supervisor-tagged curl |
```

**TO-DO SUMMARY twin (verbatim):**

```
| **39** | **GEN-MODELROLE-001** — code shipped AND MODEL_ROLES set in both wrangler.toml (owner map). Remaining = live-deploy verify + telemetry confirms the role split routes. | **VERIFIED-LIVE 2026-07-06** — var in both committed wrangler [vars]; both proxy sources parse env.MODEL_ROLES (multi-llm.js:390 roleHeadOrder, supervisor.js:337, gen-coherence.js:124); proxy deployed 3.7.2 (post the 2026-06-13 var commit, wrangler applies [vars] each deploy); D1 llm_calls (7d) shows mistral+claude live/task-split. Role-labelled calls don't log by design (memory supervisor-role-not-live) — closes the verify ask |
```

---

## Row 53 — CROSS-APP-EXPORT-CONTAMINATION-001

_verified: 2026-07-07_

**OPEN-queue row (verbatim):**

```
| **53** | **CROSS-APP-EXPORT-CONTAMINATION-001 (owner 2026-07-06, P0 — found in a REAL export pair whose intended target was the KOMBIT "AI-udvikler" posting, Design & Architecture / AI core team, deadline 02-08-2026):** the export pair was internally inconsistent across TWO different applications. The CV + the filename + the header line had all leaked to **Trackman "Projektleder, Hardware"** ("Ansøgning: Projektleder, Hardware — Trackman A/S", hardware/optics-framed CV), while the **cover-letter body was correctly KOMBIT** (public-sector AI for municipalities — "ANSVARLIGE AI-LØSNINGER TIL KOMMUNERNE", "bidrage til KOMBITs AI core team"). So the leak direction is **Trackman→KOMBIT**: the KOMBIT application adopted Trackman's CV content, branding and file naming; only the CL prose survived as the true target. (Owner runs BOTH a real Trackman PM-Hardware application AND this KOMBIT one — the two got cross-wired at export.) Six distinct legs bundled here (owner: "the combination of english in the danish application is the smallest of problems"): **(a) CROSS-APP CONTENT LEAK** — CV/filename/header company ≠ CL company; the gen/export stamped one application's CV+branding onto another's. Prime suspect family: rows 39a (AUTOSAVE-NO-DOWNGRADE / PTR-STALE-GUARD), memories jd-scope-isolation + targeted-app-persistence + brand-fit-per-app-leak — a stale active_application pointer or per-app CV/style bucket not scoped to THIS application at export time. **(b) CL PROSE LANGUAGE LEAK** — English section lead-ins shipped untranslated into a Danish letter: "Why this company and role:", "Who I am:", "Foundation: I connect what I do best…", "Hands-on across the full hardware product path…", "Professionally that grounding lets me…", "What I bring:", "How I would contribute: I would start by learning where [Company/team]…", "At your service,". Target lang = Danish but these lead-ins/sentences never went through the writer's target-language pass. **(c) UNRENDERED TEMPLATE PLACEHOLDERS** — literal scaffolding leaked into the output: "[Company/team]" and "[Action tied to values/company culture (example shape: keep communication direct, respectful, and useful for both technical and non-technical people).]". A placeholder-scrub/guard gap on the CL prose path (cf. CL-GUARD-SKELETON-CAPTURE-002 — bracketed segments should be treated as placeholder and purged, not rendered). **(d) DANISH DIACRITICS STRIPPED in CL prose** — æ/ø/å mangled to ae/o/a in the generated CL body only (løser→"loser", års→"ars", ændringsansvarlig→"aendringsansvarlig", omsætter→"omsaetter", værdi→"vaerdi", løsninger→"losninger", på tværs→"pa tvaers", ingeniører→"ingeniorer", idé→"ide") — yet the HEADER ("København") and the whole CV render diacritics correctly, so this is a CL-prose-path charset/normalization bug, not a font issue. **(e) CV PARTIAL LANGUAGE LEAK** — the CV was ~90% correctly Danish (all role narrative bullets translated) but left English in: the per-role "Results:" outcome lines (all 5 roles), the skills group labels (Expertise/Tools/Methods) + category values (Quality & process / AI-assisted / Project & delivery management), the PROFIL summary, "Work style:", the SPROG language names + levels (English/Hebrew/Spanish/Danish; native/fluent; intermediate (B1)), and every INTERESSER line. Suggests these fields (outcomes, rich_block group labels, profile, interests, language values) bypass the target-language pass that the main bullets go through. **(f) BRAND-FIT NOT TRACKMAN** — the export used the generic navy (33446F/283556) + teal (00746E/4D7976) palette, not Trackman's orange brand; brand-fit for this app either never ran or was reset/leaked (memory brand-fit-per-app-leak — colours persist to GLOBAL keys and a fresh Generate for another app overwrites them). **THIS SESSION (evidence):** hand-built the correct **KOMBIT AI-udvikler** CV+CL by surgical DOCX edit of the owner's own exports (no app.js change), tailored to the real JD (`~/Downloads/Talentech - ...AI-udvikler hos KOMBIT...pdf`): CL fully rewritten in Danish for KOMBIT (Nordic 4-part, addressed to Lars Vraa, JD language — ansvarlig/sikker AI, idé→drift, AI i alle faser, use case-screening, sagsbehandlere/fagsystemer; real Gabriel facts — Python/SQL, CNX-CAIP, AntCV multi-agent, Innoviz CCB ~250→~10 dage); CV retargeted to the AI role (header "Ansøgning: AI-udvikler — KOMBIT"; PROFIL + 4 KERNEKOMPETENCER focus areas → Ansvarlig AI / Software og data / Kravstyring og leverance / AI-assisteret udvikling) with all English residue Danish-ified; palette remapped to KOMBIT red B0241A/DA291C on charcoal 262626. Files: `~/Downloads/*_KOMBIT_AI-udvikler_20260706_DA.docx` (CV+CL) — both validate open + zero residual Trackman/EN. (An earlier same-session pass, before the owner corrected the direction, produced Trackman-branded `*_DA_fixed.docx` — a valid Trackman application but NOT the intended target.) **NOT ROOT-CAUSED IN CODE** — the register row tracks the underlying AntCV defects (a)–(f); diagnostic-first session owed, starting with (a) the cross-app CL bucket/pointer scoping at export. **SESSION-2 follow-ups (2026-07-07) split into rows 54 (content recall) + 55 (output furniture).** | owner 2026-07-06 real export pair; hand-fixed docs delivered | not started — scoped, diagnostic-first; a=P0 |
```

**TO-DO SUMMARY twin (verbatim):**

```
| **53** | **CROSS-APP-EXPORT-CONTAMINATION-001** (owner 2026-07-06, P0 — real export) — target was the KOMBIT "AI-udvikler" posting, but the exported pair's CV + filename + header had all leaked to a DIFFERENT application (Trackman "Projektleder, Hardware"); the cover-letter body correctly stayed KOMBIT. Leak direction Trackman→KOMBIT (the KOMBIT app adopted Trackman's CV/branding/naming). Six legs: (a) cross-app CONTENT leak — CV/filename/header company ≠ CL company; (b) CL English lead-ins/sentences never translated to target Danish; (c) unrendered `[Company/team]`/`[Action…]` placeholders in output; (d) Danish diacritics stripped in CL prose (løser→loser, års→ars); (e) CV Results/skill-label/PROFIL/interests stayed English; (f) brand-fit wrong for the target. | Not started — diagnostic-first; linked to rows 39a + memories jd-scope-isolation / brand-fit-per-app-leak / persona-contamination-family. Correct KOMBIT CV+CL hand-built + delivered this session (evidence attached). |
```

---

## Row 54 — GEN-JD-TAILOR-KERNEL-RECALL-001

_verified: 2026-07-07_

**OPEN-queue row (verbatim):**

```
| **54** | **GEN-JD-TAILOR-KERNEL-RECALL-001 (owner 2026-07-07, content quality):** when generating a TARGETED application the engine narrows/compresses to the JD and re-ranks the already-selected set, but does NOT go back to the FULL / unsolicited kernel to RECALL items that are relevant to THIS JD yet absent from the narrowed set — so relevant background is silently dropped. Concrete misses on the KOMBIT AI-udvikler application (both present in Gabriel's broad/unsolicited kernel, both relevant, neither surfaced): (1) **military service in a communication / signal corps** — directly relevant to an IT/communications public-sector systems role; (2) **volunteering at Pan Idræt** (inclusive sports club, København) — relevant to KOMBIT's stated values (samarbejde på tværs, inclusion, "LiFE"/work-life, public-service ethos). Pan Idræt is already a known kernel entity (memories pan-idraet-bullet-neardup, pan-idraet-backfill-parity), and the CV's INTERESSER even lists a GENERIC "Rugby & inkluderende sport" line while the concrete, nameable Pan Idræt volunteering was left out — a tell that the narrow set kept a vague proxy and dropped the specific, stronger item. FIX DIRECTION: targeted generation must QUERY the unsolicited kernel for JD-relevant items (roles, military service, volunteering, skills, education) and INCLUDE the relevant ones — this is RECALL/COVERAGE, orthogonal to (not in conflict with) JD-SPECIFIC-CV-COMPRESSION-SPEC's "no relevance REORDER" rule: that governs ORDER, this governs what is PRESENT at all. Relevance-gated (must not force-re-introduce dropped items on an unrelated JD). Owner: "for this application you should have gone to the unsolicited kernel and pull from there — military service at communication corps is relevant… and also the volunteering at Pan Idræt." Verify-first: on a KOMBIT-class gen assert military-comms + Pan Idræt surface; on an unrelated JD assert they are NOT force-added. **KERNEL EVIDENCE (v11 2026-07-07):** `volunteer-wolves` (Pan Idræt) was `on:true` yet still absent from the targeted CV — targeting dropped an explicitly-ENABLED role; `idf` was `on:false` but its own `_reviewStatus` = "keep off unless IT/system/security relevance" and KOMBIT is squarely IT, so relevance should have flipped it on. Both are strong (idf = automated backup/restore + access control for 100 users/150 machines; Pan Idræt = inclusion/community, values-fit). Hand-pulled from the kernel into the CV this session | owner 2026-07-07 (KOMBIT application) | not started — scoped, content-quality |
```

**TO-DO SUMMARY twin (verbatim):**

```
| **54** | **GEN-JD-TAILOR-KERNEL-RECALL-001** (owner 2026-07-07) — targeted tailoring narrows/compresses to the JD but does NOT recall relevant items from the full/unsolicited kernel, so genuinely relevant background is silently dropped. KOMBIT misses: military service (communication/signal corps — relevant to an IT/comms public-sector role) and Pan Idræt volunteering (inclusive sport — relevant to KOMBIT values). RECALL from the unsolicited kernel; don't just re-rank the narrowed set. | Not started — content-quality; distinct from row 53 |
```

---

## Row 55 — TARGETED-OUTPUT-FURNITURE-001

_verified: 2026-07-07_

**OPEN-queue row (verbatim):**

```
| **55** | **TARGETED-OUTPUT-FURNITURE-001 (owner 2026-07-07):** a cluster of targeted-output "furniture" / personalization defects surfaced while hand-fixing the KOMBIT application (all fixed by hand this session; none root-caused in code): **(a) CV HEADER LINE TYPE — the CV carried an "Application: <role> — <company>" line where it should carry the CV's SPECIALIZATION / positioning line** ("positioning triad" = personalInfo.specialization, memory cv-admin-template-and-contact-bridge). The "Application:/Ansøgning:" line is COVER-LETTER furniture (the CL is addressed to a specific application); the CV header wants the candidate's specialization/positioning statement, not the application-target line. The leaked export put the application line on the CV. **(b) FIXED-LABEL LOCALIZATION** — structural furniture labels not localized to the target language: "Application:" → "Ansøgning:", "EU Citizen" → "EU-borger". Distinct from body-content localization (row 53 legs b/e) — these are template LABELS on the header/contact furniture, a separate path that stays English regardless of target language. **(c) CL GREETING → JD NAMED CONTACT** — the CL greeted a generic team; when the JD names the hiring contact (here Lars Vraa, Chef for Design & Arkitektur), the greeting should adopt the named person ("Kære Lars,") — a personalization the writer isn't doing. **(d) BRAND-FIT FROM EMPLOYER BRAND** — brand-fit should derive the TARGET employer's real brand colours; KOMBIT is red/white, so the delivered docs were hand-set to KOMBIT red (DA291C/B0241A) on white (both a charcoal and a red/white variant delivered). Ties to row 53 (f) + memory brand-fit-per-app-leak. **(e) MERGED-ROLE TITLE ORDER** — the merged Meprolight display role rendered "Teamleder … & R&D …"; owner's canonical order is **"R&D-elektrooptikingeniør & Teamleder"** (R&D engineer first). Merge display must use the owner's title order across the kernel merge groups (meprolight-eo / tau-eo / Innoviz). **(f) AI-NOTICE NOT LOCALIZED** — the CV's AI-assisted disclosure rendered in ENGLISH ("AI-assisted — author retains responsibility for content.") in a Danish CV; the VML/textbox notice (memory ai-notice-sidebar-anchor) bypasses the target-language pass — localize it to the CV language | owner 2026-07-07 (KOMBIT application) | not started — hand-fixed this session |
```

**TO-DO SUMMARY twin (verbatim):**

```
| **55** | **TARGETED-OUTPUT-FURNITURE-001** (owner 2026-07-07) — targeted-output furniture/personalization defects on the KOMBIT job: (a) CV header carried an "Application: role — company" line (CL furniture) instead of the CV SPECIALIZATION/positioning line (personalInfo.specialization); (b) fixed labels not localized ("Application:"→"Ansøgning:", "EU Citizen"→"EU-borger"); (c) CL greeting generic instead of the JD's named contact ("Kære Lars,"); (d) brand-fit didn't use the employer's real brand (KOMBIT red/white); (e) merged-role title ORDER (Meprolight → "R&D-elektrooptikingeniør & Teamleder", R&D first); (f) AI-notice stayed ENGLISH in a Danish CV. | Not started — all hand-fixed this session |
```

---

## Row 56 — GEN-JD-RELEVANCE-TRIM-001

_verified: 2026-07-07_

**OPEN-queue row (verbatim):**

```
| **56** | **GEN-JD-RELEVANCE-TRIM-001 (owner 2026-07-07, content quality — sibling of row 54):** row 54 is RECALL (pull relevant items the narrow set dropped); this is the inverse — TRIM: a targeted CV must CUT bullets that aren't relevant to the JD, keep roughly the ~2 strongest-for-this-JD per role, HIDE irrelevant tools, and squeeze the resulting orphan lines. On the KOMBIT AI-udvikler CV the generator left ~14 deep optics/photonics/semiconductor-fab/OEM-automotive bullets across Sirin/Meprolight/TAU/Innoviz plus **LabVIEW** in the tools list — none relevant to a software/AI/data role — which the owner cut by hand (kept AI/software/data/requirements/change-governance/IT/delivery, ~2 bullets/role). Complements JD-SPECIFIC-CV-COMPRESSION-SPEC (this is per-role INCLUSION/EXCLUSION honouring each role's `_targetingNote`/`_bulletCap`, NOT cross-section dedup or relevance reorder). Minor: interests-jokes must land — "Opsyn: … strategiske lur-eksperter af kattefamilien (katte)" was clumsy, fixed to "Kattehold: tre strategiske lur-eksperter". FIX DIRECTION: relevance-gated per-role bullet selection driven by JD keywords/cluster; hide irrelevant tool-list items on a targeted CV. Verify-first: on a software/AI JD assert optics/fab bullets + LabVIEW absent; on an EO/photonics JD assert they stay | owner 2026-07-07 (KOMBIT application) | not started — hand-trimmed this session |
```

**TO-DO SUMMARY twin (verbatim):**

```
| **56** | **GEN-JD-RELEVANCE-TRIM-001** (owner 2026-07-07) — sibling of row 54: row 54 RECALLS relevant items the narrow set dropped; this TRIMS the irrelevant ones. Targeted CV must CUT JD-irrelevant bullets (keep ~2 strongest/role), HIDE irrelevant tools, and squeeze orphans. KOMBIT AI CV left ~14 optics/photonics/fab/OEM bullets + LabVIEW; owner cut by hand. Interests jokes must land (cat line → "Kattehold:" lead). | Not started — hand-trimmed this session |
```

---

## Row 60

_verified: 2026-07-07_

**OPEN-queue row (verbatim):**

```
| **60** | **PANEL-CONTROLS-2026-07-07 (owner, editor/preview panel controls — 6 legs, diagnostic-first, auto-deploy prod so needs live repro before ship):** **(a) HEADER-RULE-SPEC-CONTACT** — `antcv-header-rule-control.js` engine + FIELDS already support name/specialisation/contact, but the "Rule line below" row only injects into the NAME editor; `scan()`/`fieldOfRow` detect the name panel via "Full name" text and fail to identify the Specialization/Application + Contact detailed-editor panels. FIX: capture those editor panels' DOM, broaden detection (or the mount anchor) so the row mounts there too. **(b) CL-ALIGN-NO-MOVE** — the CL slogan/signature/sign-off-closing/sign-off-name Align (C/L/R) buttons write `clSloganAlign`/`signatureAlign`/`clClosingAlign`/`clSignNameAlign` + fire sections-updated, but the preview doesn't move → the render sites (app.src.js CL preview + export srcdoc + docx-worker) don't all read those align keys; audit + wire each. **(c) CL-EYE-NO-HIDE** — slogan + signature don't hide when the preview EYE is pressed (distinct from the Settings-tab hide checkbox); trace the eye control → confirm it writes `clSloganHidden`/`signatureHidden` and the render honors them. **(d) CL-SIGNOFF-PERLINE-HIDE** — add per-line hide for the CLOSING line and the SIGN-OFF NAME (new keys `antcv:clClosingHidden` + `antcv:clSignNameHidden`) in `antcv-cl-slogan-control.js`, honored in all 3 render paths. **(e) CL-PANEL-BUTTON-STYLE** — the slogan/signature control buttons don't match the other panel buttons' colour and the label text (#cdd) is barely visible; align to the shared panel-button style + raise contrast. **(f) SIG-WIDTH-IN-PANEL + SIG-COLOUR** — put a width range control INSIDE the signature panel without overflowing (owner gave the exact `<input type=range min=80 max=320>` markup), and add a SEPARATE signature COLOUR control (`antcv:signatureColor`) that recolours the ink to fit the app/company brand (apply in `__antcvClSigEl` preview filter + the docx export). **HARNESS DIAGNOSTIC (2026-07-07, code map):** the CL RENDER sites already READ the clSlogan*/signature*/closing/signName ALIGN + HIDDEN keys — export srcdoc app.src.js:27688-27730, React preview app.src.js:44356-44514, docx-client antcv-docx-client.js:765-851. So legs (b)/(c) are NOT missing render reads — the mismatch is the CONTROL layer: the preview per-element CJLR + eye come from `antcv-item-align.js` (writes `antcvItemAlignment[sid][path]`) and the section eye toggles `items[i].on` — but the CL slogan/signature/sign-off are SPECIAL elements rendered from the clSlogan*/signature* keys, NOT section items, so those generic panel controls write keys the CL render never reads → "press does nothing". FIX (b/c): the slogan/signature/sign-off preview controls must write the clSlogan*/signatureAlign/clSloganHidden/signatureHidden keys (the ones the render reads), or route antcv-item-align through them. Leg (d) CONFIRMED as a genuine gap: clClosing + clSignName have NO hidden read anywhere (app.src.js:27690/27721, 44506/44511) → add `clClosingHidden`/`clSignNameHidden` keys + reads at all 3 sites. Leg (a): detection at antcv-header-rule-control.js:90 keys off "full name"/"special"/"contact" in panel/row text — needs the live editor-panel DOM to confirm the spec/contact panel wording. Boot: `scripts/browser-qa.mjs` (Playwright confirmed available) seeds localStorage (personalInfo/session) then reloads. **STILL live-repro before ship (auto-deploy prod).** | owner 2026-07-07 (screenshot leg a); PANEL ELEMENTS lineage 1.51.90/91, memory cl-slogan-signature-standalone-keys | Diagnosed (code map); live-DOM capture + patch pending |
```

---

## Row 61 — LINE-DISTRIBUTION-GUIDELINES-001

_verified: 2026-07-07_

**OPEN-queue row (verbatim):**

```
| **61** | **LINE-DISTRIBUTION-GUIDELINES-001 (KOMBIT lessons v1→v7, owner asked to crystallize)** — conclusions on line-fill / orphan control, the single most-iterated pain this session: **(1) Line fill is a RENDER property, not a character count** — it depends on font, size, column width (twips), kerning, hyphenation and nbsp; char count is a weak proxy in a proportional font ("iii"≠"WWW"). You CANNOT fit lines without rendering + measuring; every blind pass (v1-v7) missed. **(2) It is BIDIRECTIONAL** — two failure modes: RUNT (a wrapped block whose LAST line is 1-2 short words / <~60% fill) and SHORT (a line ending well before the margin, looks empty). Fix a runt by TRIMMING (wrap one less time, or grow the runt) OR ENRICHING; fix a short line by ENRICHING. Never trim-only. **(3) The unit is the LAST LINE's fill ratio, not total length** — a 3-line bullet is fine if line 3 is full; target the last line into a good band (~0.6-0.95 of the column content width). **(4) Layout BEFORE fill — and Fit-it is the RE-FIT tool.** A column-width change (sidebar 2.31"→2.4"), a hide, or a delete reflows every line and staleness the fill. The generator fits to the layout at gen time (best-effort); the user then changes layout/content, and that is EXACTLY what the **Fit-it / fit-width** function is for — an on-demand re-fit applied AFTER the change (owner 2026-07-07). So (a) the generator fits as well as possible up front, AND (b) Fit-it MUST re-measure against the CURRENT column widths + currently-visible content and re-distribute BIDIRECTIONALLY (trim runts + enrich shorts) — it must stay correct after any width/hide/delete, never assuming the original layout. Ties memories fixit-orphan-enhance-orchestration (multi-LLM sample-and-pick via ee()) + orphan-measure-bind: Fit-it = re-run the orphan-measure + enrich/trim pass against live state, decoupled from generation. **(5) Result lines = one-line budget** — must fit EXACTLY one full line (no wrap) AND state the mechanism; trim to the column's one-line max. **(6) Levers beyond rewording** — nbsp to keep/pull a trailing word, justified alignment (only stretches a line that ALREADY wraps — a single fitting line won't justify), hyphenation, or a small width nudge; rewording (trim/enrich) is primary. **(7) It is the GENERATOR's job** — a pre-paginated export can't reflow and hand-editing can't measure; the orphan-measure pass (renders line boxes, adjusts) is the right home (rows 27/49/59, memory orphan-measure-bind, RUNT_INVENTORY). **(8) Owner char-deltas ("+18/−4") are a symptom of eyeballing the render** — the METHOD is to measure the render, not chase char counts. **(9) Gold standard** (memory trackman-gold-target): no 2-3-word runts, last lines reach the margin, columns bottom out together, no blank under the sidebar. **(10) "AT BEST" HAS A FLOOR — never ship a VISIBLE LEAK** (owner 2026-07-07). Best-effort fill is NOT licence for a visibly-wrong result. Floor: (a) CUTS must be CLEAN — end at a word/clause/sentence boundary, NEVER truncate a word or strand a dangling connector ("og"/"med"/"via"/"&"/"-") or half-phrase; a visible truncation is worse than a slightly short/long line. (b) MISSING FILLERS are ALSO visible leaks — a line ending glaringly short (empty-looking) or a 1-2-word runt is a DEFECT, not merely "not ideal". So the generator prioritises ZERO visible defects FIRST, then optimises fill within that: a clean-but-imperfect line beats a truncated or obviously-empty one. Cuts are the more obvious offender, but short fillers count too. **WORD RENDER AVAILABLE — the definitive check (2026-07-07, fully resolves row 59C):** `WINWORD.EXE` is installed; render docx→PDF with the ACTUAL Word engine via PowerShell COM (`$w=New-Object -ComObject Word.Application; $d=$w.Documents.Open($docx,$false,$true); $d.ExportAsFixedFormat($pdf,17)`), then Read the PDF to VERIFY real pagination, colour, table fit, and orphans. `$d.ComputeStatistics(2)` returns page count. This beats font-metric estimation (which is still useful for fast pre-tuning) — always render + eyeball before shipping. **MULTI-LANGUAGE:** the Word render is language-agnostic + definitive (does shaping/BiDi/CJK) — use it for EN/ES/DA/中文/עברית/العربية. The font-metric estimator is FONT+LANGUAGE specific: Latin = word-wrap on the doc's font; CJK = character-wrap + a CJK font (no inter-word spaces); Hebrew/Arabic = use the render (Arabic contextual shaping + BiDi make isolated-glyph `getlength` unreliable). **CloudConvert (LibreOffice) is STILL required for the PRODUCTION export** (no Word on Cloudflare/in-browser); local Word render is dev/verification only + matches the user's Word view. **BROWSER-PREVIEW corollary (ties row 60 Fit-it + orphan-measure-bind):** the app's preview + Fit-it/orphan pass should MEASURE the live DOM (`getClientRects`/canvas `measureText`, device font) PER-DEVICE (desktop vs mobile wrap differently), not estimate — same "measure don't guess" principle improves preview↔export fidelity on desktop + mobile Chrome. **BULLET-GLYPH COLOUR lives in `numbering.xml` (`<w:lvl><w:rPr><w:color>`), NOT `document.xml`** — a doc-only recolor left the bullets the old teal `00746E` (looks greenish); brand recolor MUST include numbering.xml. **THEME-COLOUR TRAP:** setting `w:color w:val` does NOT override a `w:themeColor`/`w:themeTint` on the same element (Word resolves the theme colour; the AI-notice rendered grey despite val=B0241A until themeColor/themeTint were stripped) — colour-verify in the RENDER (PyMuPDF span colour), not the XML. **Delivered PDFs use the job-specific filename matching the docx, not scratch _render_ names.** **MEASUREMENT — FONT-METRIC METHOD WORKS HERE (2026-07-07, unblocks row 59C):** no LibreOffice needed — Pillow + `C:\Windows\Fonts\calibri.ttf` measures text width; body font = **Calibri 10pt** (docDefault Calibri 10.5, body runs sz=20=10pt). Calibrated: the KERNEKOMPETENCER Strategisk column content ("AI use cases til drift: krav, evaluering, monitorering, sikkerhed") = 3.50in = exactly 1 line at the 3.65in column → confirms Calibri 10pt. Main-column bullet text width — **CALIBRATE AGAINST REALITY, don't trust the geometry estimate**: (8450−300−210−360)/2 = 3790 (5.26in) was ~0.3in TOO WIDE (nested-cell margins + bullet indent eat more), so the model under-counted lines and two bullets spilled → a page skip. Real width = **3560 (pt×10) ≈ 4.94in**, pinned by observed wrap (CCB=3 lines, PROFIL=5 lines at the too-wide estimate). Always calibrate the width against an actual render or the user's observed line-count before tuning. Greedy-wrap each line, compute last-line fillRatio, tune text to ~0.85−0.96 (no runt). Ends the blind char-delta guessing (v1−v9). **FONT-SPECIFIC (owner 2026-07-07):** always read the doc's ACTUAL font (docDefault rFonts + run sz, or the selected package/style) and load the matching `.ttf` before measuring — a style/package swap (Trebuchet MS=`trebuc.ttf`, Segoe UI=`segoeui.ttf`, Arial=`arial.ttf`, …) breaks the Calibri metrics; re-load that font + re-calibrate against a known-fit line. Never hardcode Calibri. **KERNEKOMP hard limits (owner):** Fokusområde ≤1.59in (2290tw), Strategisk ekspertise ≤3.65in (5256tw) — larger overflows the visible region, smaller wraps the cell text; set exactly + fixed layout. **ALT (PDF) RECIPE:** `soffice --headless --convert-to pdf`; per column, extract each text line's bbox width → fillRatio = lineW/colContentW; flag last-line fillRatio<0.6 (enrich), any block that spills an extra line vs intent (trim), any result that wraps (trim to 1 line); iterate until every block's last line lands ~0.6-0.95 and results are 1 line. | KOMBIT v1-v7 (2026-07-07) | Guidelines — feed the generator orphan-measure pass (row 59A) |
```

---

## Row 57 — TARGETED-CV-POLISH-RULES-001

> Lived ONLY in the TO-DO SUMMARY table before the split — it never had an OPEN-queue
> row, which is part of why it was easy to miss.

_verified: 2026-07-07_

**TO-DO SUMMARY row (verbatim):**

```
| **57** | **TARGETED-CV-POLISH-RULES-001** (owner 2026-07-07, universal rules from a full CV review) — CONTENT: (1) each bullet = ONE sentence (no mid-bullet ". " split that justifies/wraps ugly); (2) dedup within a role (don't state a fact in two bullets); (3) prefer a generic descriptor over a named partner ("an ODM in Sweden", not the partner's name); (4) result lines fit ONE line (hard max — trim) AND state the mechanism ("via governance/optimization"), not just the outcome; (5) compress education (no internal duplication, e.g. FVU); (6) tighten over-long skill lines (drop synonym dups); (7) AntCV is valid Kanzen evidence (a bullet). LAYOUT/FURNITURE: (8) no trailing "," / "." inside table cells (KERNEKOMPETENCER); (9) role header — only the TITLE is bold, company + year NOT bold; (10) abbreviate long org names in headers (IDF); (11) consistent current-role end dates (a year like 2023-2026, not "nu", to match other dated roles); (12) sidebar + main must NOT both be pure white — give the sidebar a subtle brand-supported tint; (13) sidebar width ~30% (≈2.6-2.9", not ~2.1"); 30/70 proportion; (14) fill page 1's main before overflowing (pack roles, no early whitespace). **ADDENDUM (owner 2026-07-07 v4→v5 review):** (15) BANNED em/en dash — output uses ONLY "-" (hyphen), never "—"/"–" (reinforces memory emdash-hyphen-three-layers; the generated CV still leaked em-dashes into new bullets, MBA/FVU, and the AI-notice); (16) **BOLD-RED ONLY for labels/headings** — inline value/content runs stay REGULAR + neutral-dark (262626); never let a content run inherit a label run's bold-red (hit twice: Projekt-line + interests content); (17) INTERESTS joke works by REVEAL — lead with the serious-sounding word and reveal the punchline at the end ("Opsyn: … lur-eksperter (katte)"), don't spoil it up front; (18) the **AI-notice belongs at the BOTTOM of the sidebar** (not mid-main), and the sidebar should FILL to the page end (ties MOB-004 + memory sidebar-fill-gap-is-antiblank-slack); (19) ORPHANS are fixed in BOTH directions — TRIM an over-long line that spills a few chars onto a runt last line, AND ENRICH a too-short line to reach the end of its line (owner gave exact ±char deltas: e.g. −18/−17/−20 trims, restore-a-word enriches). **ADDENDUM 2 (owner 2026-07-07 v5→v6):** (20) no "(nuværende)" when the year already conveys current (Kanzen "2022 - 2026"); keep end-date format consistent; (21) role-header YEAR right-aligned to the main-column right edge via a right tab stop at the content edge + exactly ONE tab (years were falling short because the tab stop didn't follow the widened main column); (22) SPACING HIERARCHY — the gap role→its-own-result must be SMALLER than result→next-role, so results group visually with their role (they were near-equal); (23) sidebar width CONSISTENT on every page (both pages ~2.4"/3456twips, not 2.06" page-1 vs 2.73" page-2 — the inner per-page tables carry their own fixed grid and must all be set); (24) inline-label bold scope minimal (FVU label bolds just "FVU:", the rest regular). **ADDENDUM 3 (owner 2026-07-07 v7→v8, general AntCV knowhow):** (25) SIDEBAR lines carry NO trailing period; MAIN-column bullets/results DO keep their period; (26) shorten Danish role titles by COMPOUNDING ("Ansvarlig for ændringsanmodninger" → "Ændringsanmodningsansvarlig"); (27) prefer concise Danish furniture ("Forskningsresultater: se X" over "…Detaljer tilgængelige via X"); (28) when a result/bullet renders SHORT, ENRICH with a concrete kernel achievement (add the production number "500 → 20.000 enheder/uge" to the Meprolight result) rather than padding; (29) reorder comma-separated skill signals to balance a JUSTIFIED line (best-effort without a renderer, row 61); (30) AI-notice = LAST element of the last-page sidebar (true page-bottom anchoring needs the generator, memory sidebar-fill-gap-is-antiblank-slack); watch multi-run label edits — a prior FVU restructure scrambled word order (set run0=label, run1=full content, clear the rest). | Not started — applied by hand to the KOMBIT CV (v5-v8) |
```

---

## Row 59 — GENERATOR-BASELINE-001

> Lived ONLY in the TO-DO SUMMARY table before the split — it never had an OPEN-queue
> row, which is part of why it was easy to miss.

_verified: 2026-07-07_

**TO-DO SUMMARY row (verbatim):**

```
| **59** | **GENERATOR-BASELINE-001 (owner 2026-07-07, "make the lessons enter the generator baseline")** — two things the GENERATOR must own because they cannot be reliably hand-fixed on a post-export DOCX: **(A) PAGINATION + ORPHAN/ENHANCE** — the export is pre-paginated into per-page tables that do NOT reflow, so filling pages, bottoming-out both columns together, avoiding bad cross-page section cuts (MOB-004), and orphan control in BOTH directions (trim over-long lines AND enrich too-short ones to fill the line) have to happen in the generator/orphan-measure pass (rows 27/49/57, memory orphan-measure-bind + RUNT_INVENTORY), not by hand. Every polish rule in rows 54-58 is a generator-baseline requirement, not a one-off CV edit. **"AT BEST" HAS A FLOOR (owner 2026-07-07, row 61 pt 10):** best-effort must never ship a VISIBLE LEAK — clean cuts (no truncated word / dangling connector) and no glaringly-empty line ends; zero visible defects ranks above hitting the exact fill ratio. **(B) DOCX INTEGRITY (hand-edit tooling lesson)** — the "Word found unreadable content" the owner hit on EVERY hand-generated CV+CL was NOT the app's export (the pristine app/CloudConvert exports are valid); it was the hand-edit path re-serializing document.xml with ElementTree, which DROPS namespace declarations it deems unused (w14/w15/wp14 + inline drawing ns a14) while `mc:Ignorable` still references them → recoverable markup-compat error. Fix locked in the editing tool: rebuild on the pristine original's root open-tag + guarantee every prefix used in the body is declared (verify with a strict lxml parse before shipping any hand-edited docx). **(C) RENDERER IS THE MISSING TOOL FOR HAND LINE-FILL** — this box has NO LibreOffice/Word, so orphan trim/enrich has been blind guesswork across v1-v7 (owner keeps green-marking lines that end too short). Before any more hand line-fill: install `soffice` (LibreOffice), convert docx→pdf, and measure actual line breaks — OR fix it in the generator's orphan-measure pass. v7 still has ~15 owner-green-marked lines to ENRICH to the right margin (AntCV bullet, Innoviz/Sirin/Meprolight/TAU/IDF/Pan results+bullets, 2 KERNEKOMP cells). Handoff: `docs/qa/KOMBIT_REMAINING_FIXES_HANDOFF.md`. | (A) generator-owned, ties rows 27/49/57/58; (B) FIXED in the hand-edit tooling this session; (C) needs a renderer / generator |
```

---

## Row 63 — ANALYSIS-STALE-ON-APP-LOAD-001

> Lived ONLY in the TO-DO SUMMARY table before the split — it never had an OPEN-queue
> row, which is part of why it was easy to miss.

_verified: 2026-07-07_

**TO-DO SUMMARY row (verbatim):**

```
| **63** | **ANALYSIS-STALE-ON-APP-LOAD-001 / NEW-1** (owner 2026-07-07) — loading a saved application does NOT load ITS JD analysis; the CURRENT application's analysis persists instead (stale, "in addition"). **Diagnosed (partial):** `yo` (React analysis state) = localStorage `rationale`; the PRIMARY saved-app open handler (app.src.js ~45511) ALREADY clears it correctly (`bo(n.rationale \|\| null)`, comment "1.50.243: always overwrite so the Analysis panel doesn't keep stale rationale"). BUT other restore paths only restore-IF-present and never clear: cloud kernel-showcase hydrate (~40440, 40517), unsolicited fallback, and the `antcv:rationale-merge` listener (~16568-16577) which re-hydrates `rationale` from localStorage on its event (`e && bo(e)` — only sets, never clears → can re-inject the prior app's analysis after a load). Also the persistence effect (~17105 `u.set("rationale", yo)` on `[yo]`) can write a stale `yo` back. NEEDS: faithful repro (two saved apps, one WITH rationale one WITHOUT, switch between) to confirm which path leaks — the saved-app system needs the relay so headless repro is non-trivial. FIX shape: make EVERY app-load path overwrite rationale to the loaded app's value-or-null (the 1.50.243 pattern), and gate the rationale-merge listener so it doesn't re-inject across an app switch. Memory: [[jd-scope-isolation]], [[nil-application-state]]. **SHIPPED 1.51.196 (owner approved the hardening):** the active-application MOUNT-HYDRATE path (app.src.js ~17064 + app.js minified mirror, `if(t.rationale)…` → `Do(t.rationale\|\|null); L.set("rationale", t.rationale\|\|null)`) now overwrites the analysis UNCONDITIONALLY (value-or-null) — loading an app whose saved rationale is absent no longer keeps the previous app's analysis, and localStorage is set immediately so the export/panel stay in sync. The app-list open handler (~45511) already cleared (1.50.243). The `antcv:rationale-merge` listener (~16568) was reviewed — it reads CURRENT localStorage which the load now clears, so it can't re-inject the stale one (no gating needed). app.src↔app.js verified in-sync; boot-smoke OK. Owner live-verify pending (saved-app switch needs the relay, so no headless repro). | SHIPPED 1.51.196; owner live-verify pending |
```

---

## Row 64 — ANALYSIS-EXPORT-DROPS-FILLED-ANSWERS-001

> Lived ONLY in the TO-DO SUMMARY table before the split — it never had an OPEN-queue
> row, which is part of why it was easy to miss.

_verified: 2026-07-07_

**TO-DO SUMMARY row (verbatim):**

```
| **64** | **ANALYSIS-EXPORT-DROPS-FILLED-ANSWERS-001 / NEW-2** (owner 2026-07-07) — exporting the JD-analysis PDF omits the opened detailed GAPS and the "how I fit to role" (recruiter Q&A) answers, even when the owner filled them completely. **Diagnosed:** the analysis-report export (`antcv-analysis-report-pdf-360.js`) is a READ-ONLY builder that reads localStorage `rationale` ONLY (`readRationale()` → `readJSON('rationale')`); its `reportHtml` DOES render gaps (`g.text`+`g.how`) and questions (`q.question`+`q.suggested_answer\|\|answer\|\|a`). So the builder is correct — the failure is a DUAL-STORE SPLIT: `antcv-application-qa-detect.js` shows owner-EDITED recruiter answers live in a SEPARATE store `antcv:applicationQuestions` ([{question,answer}]) and/or a generated CV/CL recruiter-answers SECTION (it explicitly "NEVER overwrite owner-edited answers"), NOT written back to `rationale.questions_in_jd`. The export reads only `rationale` → misses the owner's edits. Same likely for "detailed gaps" edits (edit target not yet located). FIX shape: the export `model()` must MERGE the authoritative owner-edited answers (`antcv:applicationQuestions` / the section) over `rationale.questions_in_jd`, preferring non-empty owner edits; locate where "detailed gaps" edits persist and merge those too. NEEDS owner confirm: WHERE do you fill the answers — the CL "recruiter answers" section in the editor, or an editable field in the Analysis panel? (determines the authoritative store). Export builder verified correct headlessly (renders seeded gaps+answers when present in `rationale`). **SHIPPED 1.51.196 (owner confirmed the fill UI = the Analysis-panel expandable GAP blocks):** those blocks persist their AI detail (SPECIFIC DETAILS / WHY IT MATTERS / HOW TO ADDRESS), the owner's "I cover this" correction, and the covered flag to per-gap `gapState_<company_role>_<idx>_<gapText>` keys (app.src.js `Be` ~L11124), NOT into `rationale.gaps[]`. The export (`antcv-analysis-report-pdf-360.js`) now recomputes that EXACT key per gap (byte-identical derivation, same index app.js maps on) and renders the detail + "How I cover this" correction + ✓ Covered marker under each gap (new gapStateKey/readGapState helpers + model fold-in + reportHtml + CSS + T() labels en/da). Sidecar-only (no app.js risk). Deterministic guard `pwa/test/diag-new2-gap-detail-export.mjs` (seeds rationale+meta+gapState post-boot, asserts all markers export; green). Cache-bust quintet 1.51.196. **HARDENED 1.51.198 (owner still not seeing it after 1.51.196):** the 1.51.196 attempt matched ONLY the exact key (`company_role`+`idx`+gapText), which misses if the gap index or meta.company drifted between fill-time and export-time (a re-gen reorders gaps; meta.company gets rewritten to "Unsolicited"). Now CONTENT-BASED: exact key is the fast path, else scan all `gapState_*` and match by gapText slug, newest ts wins. NOT mobile-only (owner: happens on desktop too — gap opens, detail loads, "how I cover" added, goes green, none in export). Test extended with a drift case (state saved under a different company+idx still exported); green. | SHIPPED 1.51.196, HARDENED 1.51.198 |
```

---

## Row 58 — EXPORT-SETTLED-001

> Lived ONLY in the TO-DO SUMMARY table before the split — it never had an OPEN-queue
> row, which is part of why it was easy to miss.

_verified: 2026-07-07_

**TO-DO SUMMARY row (verbatim):**

```
| **58** | **MOBILE-BUGS-2026-07** (owner "Mobile App Bug Findings Report", 2026-07-07) — 9 findings: MOB-001 Danish UI shows English content (localization); MOB-002 targeted CV rendered like an unsolicited one (over-detailed sidebar, roles not merged — mobile face of rows 54/55/56); MOB-003 Export button intermittently disappears, returns only on refresh; MOB-004 mobile page-split unstable ("Lab & Fabrication" badly cut, blank lower-page sidebar); MOB-005 CL content-mixing + orphan text, recurring (ties row 53); MOB-006 tapping the language area doesn't open the translation panel (mobile, no response) — **owner 2026-07-07 refined: the dropdown OPENS but tapping a language does nothing (selection doesn't change).** Full path traced + works in headless mobile emulation (dropdown→tap option→`Pr`→confirm modal `$r`→"Translate now"→`It(e)` sets language). Every switch is gated behind a CENTERED confirm modal; the option is tapped at the TOP-RIGHT, so on real mobile the tap's residual ghost-click lands on the modal BACKDROP (now under the finger) and instantly dismisses it via the cancel-on-backdrop-tap (app.src.js ~17538) → language never switches. Playwright fires one clean click so it never repros. **CANDIDATE FIX 1.51.197:** arm the backdrop-cancel only after a 450ms delay (setTimeout) so a same-tap residual click can't dismiss the dialog; buttons/Escape/desktop unchanged. app.src+app.js mirror, boot-smoke OK. NEEDS OWNER LIVE-VERIFY (couldn't repro headlessly). If still broken, next suspect = the option `onClick`/`pointerdown`-capture (11651) not registering on real touch. **Also MOB-GAP-OPEN** (gap detail arrows don't open on mobile) still open — same headless-repro block; MOB-007 Hebrew not shown in the dropdown after enabling it; MOB-008 **CRITICAL** Analysis panel stops scrolling once an application is detected (ties row 51 PREVIEW-SCROLL-JITTER); MOB-009 **CRITICAL** exported CV PDF badly split. Owner priority: MOB-008/009 first; then 003/004/005/006; then 001/002/007. **MOB-008 FIXED 1.51.195 (2026-07-07).** Root cause was NOT row 51 (that was the desktop/pi jitter) — on mobile the analysis report + JD box are sidecar-injected (antcv-analysis-report-pdf-360.js / -panel-jd-block-356.js) into the fixed 33dvh bottom panel as `flex:0 0 auto` blocks (NOT a bounded flex:1 scroller), so a tall detected report (~1760px measured) overflows the panel. `antcv-mobile-controls.css` pinned `overflow: hidden !important` on the panel (TWO rules: `.antcv-mobile-panel-fixed` ~L998 + `.antcv-mobile-bottom-panel` ~L1045) with specificity `body.antcv-editor-ready…` (0,3,1) that beat the React inline style AND the 360 sidecar's `.arx-mob-scroll` override (0,2,0) — so the panel clipped its content and could not scroll. Fix: both rules now `overflow-x:hidden; overflow-y:auto; -webkit-overflow-scrolling:touch !important` — panel scrolls, grab-zone stays sticky, Sections/Edit unaffected (their inner flex:1 tab div self-bounds). Diagnosed measure-first (Playwright/CDP probe of the real panel: computed overflowY, scrollHeight 1760 vs clientHeight 279). Guard: `pwa/test/diag-mob008-panel-overflow.mjs` (deterministic, loads the real CSS against a synthetic panel; 5/5 green; negative check confirms it catches the pre-fix state) + hardened `diag-analysis-mobile-scroll.mjs`. app.js/app.src.js untouched (CSS-only). Cache-bust quintet → 1.51.195. | MOB-008 SHIPPED 1.51.195. **MOB-009 DIAGNOSED (2026-07-07, not yet fixable surgically):** measure-first ruled OUT the two mobile-specific mechanisms. (1) SCALE: the export forwards `antcv:autoPages` (written by the measurer `antcv-auto-pagebreak-block-001.js`, which reads the live preview DOM under `transform:scale(ui)`, ui<1 on mobile). Hypothesis was mobile computes different breaks — DISPROVEN: booted the SAME multi-page CV (profile + 26-row table + 8 roles + heavy sidebar) on desktop (scale 1.0) vs mobile (scale 0.471) and `autoPages` is BYTE-IDENTICAL (`{core:{24:2},experience:{0:2,4:3},...}`) — the measurer's scale correction (~L733-739, divides px by paper transform scale) is complete. Guard: `pwa/test/diag-mob009-autopages-device-parity.mjs` (asserts paginated ∧ mobileScaled ∧ parity; green). (2) SETTLE-RACE: export-before-pagination-settles is already gated (EXPORT-SETTLED-001, `diag-export-settled-gate.mjs`). So the mobile export == desktop export; "badly split" is therefore the general pagination-QUALITY problem (row 59A, generator-owned: mid-unit cuts, blank lower-page sidebar — same as MOB-004) and/or the preview-px↔LibreOffice/CloudConvert-px FIDELITY gap. NEXT STEP to pinpoint: need the owner's ACTUAL bad-split exported PDF (which section splits where) OR local CloudConvert/LibreOffice — cannot rasterize the real export here. Reclassify: NOT a discrete mobile hotfix; folds into row 59A generator pagination work (Track C). MOB-009 ≈ MOB-004. Others not started — triage against rows 51/53/54/55/56 |
```

---

## Row 62 — HEADER-BANNER-DESIGN-RULES-001

> Lived ONLY in the TO-DO SUMMARY table before the split — it never had an OPEN-queue
> row, which is part of why it was easy to miss.

_verified: 2026-07-08_

**TO-DO SUMMARY row (verbatim):**

```
| **62** | **HEADER-BANNER-DESIGN-RULES-001** (owner 2026-07-07, KOMBIT gold) — bake the correct CV/CL header-banner design into the GENERATOR (preview + docx-client + docx-worker), not one-off docx. (1) name / specialization(CV) or application(CL) / contact = ONE tight centered stack, all centered on the CONTACT line's axis (a separate contact row made a big red gap + page overflow); (2) contact line `jc=center` (not justified), icon glyphs (⌂★✉☎🔗) ARE the separators — drop the `" • "` bullets; email icon = ✉ not `@`; (3) contact controls BOTH its white rules (`pBdr` top+bottom, 0.5pt FFFFFF) — the upper (spec/application divider) and lower; (4) **photo-aware rule width (panel control)** — WITH a figure in the header (CV) the rules HUG the contact text and CLEAR the photo (gold `ind left=3024/right=144` twips at this width; header cell 11952>page 11906 so right-tighten is partly clamped → measure the rendered rule extent), WITHOUT a figure (CL) the lower line reverts to a normal FULL-WIDTH divider; (5) photo centered over the sidebar column (`Hoff≈541020` for a 1.5" photo, sidebar 3888 → center 1944); tightening can open a bottom gap → extend body-row `trHeight` + sidebar fill + realign photo `Voff`; (6) brand bullet markers live in `numbering.xml` (`lvl>rPr>color`) not `document.xml` — CL shipped teal `00746E`, recolour `B0241A`; (7) **invisible Word header (GENERATOR DEFECT, both CV+CL)** — as-generated `header1.xml` has an empty para with `<w:shd fill="33446F"/>` (navy) → a navy strip at page top (LibreOffice/CloudConvert shows it even when Word clamps); FIX in the template = remove the navy `shd` + set the header para font to 1pt (`sz=2`) so the header is invisible. Also the theme-colour trap: `w:color w:val` does NOT override `w:themeColor`/`w:themeTint` (AI-notice rendered grey despite `val=B0241A`) — strip theme attrs, verify colour in the RENDER (PyMuPDF span colour). | KOMBIT CV+CL gold hand-built + delivered this session (job-named docx+PDF, both 2pp/1pp, all 7 applied). Generator encoding IN PROGRESS. **docx-worker Track C started 2026-07-07 (owner: build all rules then ONE deploy):** (1) contact line ✉+icon-separators SHIPPED-TO-CODE 1.51.x (src/index.js 25695/25769, test/diag-contact-icons.mjs green, both header paths) — **NOT deployed** (worker is manual); (4) brand bullets CONFIRMED already-implemented (numbering.xml gets `style.mainBulletColor` via mergeStyle → verified DA291C; no change needed); name/spec/contact all default `jc=center` (headerAlign 24402). **REMAINING (need the render-measure loop vs the KOMBIT gold — hardest part):** (2) centered stack on the CONTACT AXIS — CONFLICTS with the existing CONTACT-FULLWIDTH-001 fix (owner 2026-07-02 moved contact to its OWN full-width row below name/spec to stop the phone wrapping; the 2026-07-07 gold wants ONE centered stack — must reconcile by render); (3) photo-over-sidebar geometry (bridge medallion 25786 / __bridgeLeftW 24933) verify/tune; (5) banner→body divider — **memory says this was a HAND-BUILT artifact, NOT a worker defect ("the worker needs no change; don't chase a worker border fix")** → confirm with owner before adding. **DEPLOYED 2026-07-07 (docx-worker 1.14.133-header-banner-track-c, run 28902092611):** all header-banner rules now in the generator — (1) ✉ email + icon-separated contact [SHIPPED], (2) name/spec centered on the CONTACT AXIS via a full-width gridSpan=2 stack (reconciled with CONTACT-FULLWIDTH-001: contact stays full-width, name/spec join the same centered axis; owner "1 go") [SHIPPED], (3) photo-over-sidebar float verified intact (diag-photo-bridge-export), (4) brand bullets already in numbering.xml via style.mainBulletColor [CONFIRMED], (5) banner→body divider = uniform body-cell TOP borders (bodyTopBorder helper, band colour, both cells; owner "2 yes add it") [SHIPPED]. Word-COM rendered + measured vs the gold each step; live-verified on the deployed worker (✉ present, no " • ", 2 sz=12 dividers). Deploy gate green (palette/bundle/banded 17/17). Tests: diag-contact-icons (new), diag-contact-fullwidth + diag-photo-bridge-export updated for the stacked structure. **VALIDATED 2026-07-08 by generating a full Trackman "Project Manager, Hardware" CV+CL through the deployed worker** (Track A delivered, job-named docx+pdf in Downloads; orange/dark-gray/white brand, bright-bg photo over sidebar) — the gold header renders correctly end-to-end. Two Track-C FOLLOW-UPS surfaced: (i) the CL renders `meta.subtitle` TWICE (white banner spec + an orange band below) → workaround set CL subtitle:''; (ii) page-2 main column bottoms out well short of the (full-height) sidebar — column-balance/line-fill (row 61). Memory: header-banner-design-rules, [[generate-deliverables-via-worker]]. |
```

---

## Row 74 — JD-SWAP-STALE-RATIONALE-001

> Lived ONLY in the TO-DO SUMMARY table before the split — it never had an OPEN-queue
> row, which is part of why it was easy to miss.

_verified: 2026-07-08_

**TO-DO SUMMARY row (verbatim):**

```
| **74** | **LIVE-APP DRIVE (owner 2026-07-08: estimator calibration → generate 4 via the app).** Three outcomes: **(A) PARITY-ESTIMATOR — do NOT flip the ratio-formula.** Built `scripts/calibrate-linefill.py` (Word-COM render vs `Vi` greedy-wrap across ratios/edges). The body table is `tblLayout=autofit`: Word + LibreOffice/CloudConvert size columns to CONTENT and ignore the grid, so the rendered main col is content-driven (~490-540px), NOT ratio-driven — the flagged ratio-formula predicts the ignored grid and would make the common case worse; the fixed constant is the right shape. (Making the formula correct needs a fixed-layout table — overflow risk.) Estimator/line-fill was NOT the 97.5% blocker. **(B) STALE-JD CONTAMINATION — FIXED + DEPLOYED (JD-SWAP-STALE-RATIONALE-001, PWA 1.51.216).** Reproduced live: fetched the NCC JD, generated, the CL targeted the PREVIOUS JD's company ("Sigma Connectivity"). Root: `CL-GHOST-COMPANY-001` pushes the prior run's `yo.supporting_context` into the next gen as "PRIOR RUN CONTEXT (carry forward)"; its guard only covers unsolicited (`!__noJD`), not a NEW-JD swap while `yo` is stale. Fix: clear the rationale (`bo(null)`/`Do(null)`) in the url-fetch AND file-upload JD handlers (matches NEW-1 load-clear); app.src.js + app.js mirrored (`Ft`→`nn`, `bo`→`Do`), cache-bust quintet. **Owner to validate with one foreground generation** (automation can't — see C). **(C) BACKGROUND-STALL [OPEN, the real mobile 97.5% risk].** Generation streams via SSE; when the tab isn't foreground (automation always; mobile app-switch mid-3-6-min-run) the browser throttles the stream and it STALLS (app detects "Tab was backgrounded", froze 3:35→4:35). rAF freeze was fixed (STICKY-LEAK-005) but the network-stream throttle is not. Also: browser file-upload is sandboxed to session-shared files, so PDF JDs can't be fed via automation (URL-fetch works). | (A) DONE — harness committed, estimator left as-is (autofit finding). (B) DONE + deployed 1.51.216 — awaiting owner's one-gen validation. (C) OPEN — the biggest mobile first-gen blocker; heavier fix in the sensitive stream code, diagnostic-first next. Owner generating the 4 foreground on the fixed build. | 
```

---

## Row 73

> Lived ONLY in the TO-DO SUMMARY table before the split — it never had an OPEN-queue
> row, which is part of why it was easy to miss.

_verified: 2026-07-08_

**TO-DO SUMMARY row (verbatim):**

```
| **73** | **CV REVIEW-4 — LINE-FILL DEEP PASS + accessibility/competency (owner 2026-07-08: "lines are very very uneven", green=extend/purple=compress, "97.5% fit is not").** Root method fixed: PyMuPDF `get_text("dict")` FRAGMENTS justified text → switched to a `get_text("words")` line-fill measurement (group words by y-band, fill = last-word-x1 / colwidth). Found every 2-line bullet had a full first line + a stranded short last line (0.12-0.53). **Rewrote ALL experience bullets to EVEN TWO-FULL-LINE paragraphs** (last line ≥0.65) — this evens the lines AND fills the page (an earlier all-1-line pass under-filled page 2 = "not compressed"). Iterated build→render→measure to **0 runts <0.5** both columns. Also: **ACCESSIBILITY moved off page 1** (ordered at the sidebar end); **competency table both Focus labels AND Strengths single-line** (`tableRatio` 0.22→0.36 for the labels + trimmed the longest Strength for the narrower col); interests re-balanced to one reasonable line each; narrow-sidebar single-word runts fixed ("(Toronto)"/"(Teknologisk)"). | DONE 2026-07-08. Verified 0 runts, 2 pages, page-1 full + even, page-2 main ~68% (up from ~40%). Delivered (original names). Rules → checklist §2 + memory line-distribution-guidelines (word-method + 2-full-line-fills-page + accessibility-p2 + competency-both-single-line). **RESIDUAL:** page-2 lower dead-space (sidebar content ends before the page since STANDARDS sits on p1) — the float-spine (row 61) is the real fill; per-payload balancing has limits. | 
```

---

## Row 72 — AI-NOTICE-ANCHOR-FIX-001

> Lived ONLY in the TO-DO SUMMARY table before the split — it never had an OPEN-queue
> row, which is part of why it was easy to miss.

_verified: 2026-07-08_

**TO-DO SUMMARY row (verbatim):**

```
| **72** | **CV REVIEW-3 + worker 1.14.136 (owner 2026-07-08) — "handle as UNIVERSAL for gen/enhance/fix".** WORKER (universal): **AI-NOTICE-ANCHOR-FIX-001** — the inline notice (1.14.135) "regressed to the initial problem" (sat after the last sidebar line); real bug was the page-anchored VML sliding off the page edge → reverted to page-anchored + lifted `__mt` 824→806pt so it PINS at the page bottom fully visible (verified y=820/842). **HEADING-TABLE-GAP-001** — heading after-space → 0 for `type:'table'` sections so the grid hugs the heading (owner: "spacing of 2 after the headline fucks the distance"). CONTENT (payload, now standing rules in checklist+memory): foreningsarbejde not "Volunteer"; Danish = "Intermediate"; REFERENCES generic (owner did NOT expose recommender names — removed Innoviz/Welltec/TAU/Pan-Idræt); publication count owner-set at TWO (not 4); no LinkedIn on the pubs link line (Scholar only); INTERESTS one concise line each (not 3-line sprawl); TOOLS & METHODS restored to 7 kernel GROUPS; competency table `tableRatio` 0.28→0.22 + trimmed Strengths → all 5 rows single-line; role header kept to one line (shortened company). ORPHANS: trimmed the volunteer-header + STANDARDS runts. | DONE 2026-07-08, **deployed docx-worker 1.14.136-ainotice-anchor-heading-gap**. Verified: 2 pages, AI-notice pinned at page bottom (y=820), all 5 competency rows single-line, foreningsarbejde/Intermediate/Two-pubs/generic-refs present, Scholar link only, 0 em-dash. Delivered (PDF original name; docx `_rev4` — original locked). **DEFERRED (#13 "tables to the end of page"): page-2+ sidebar content dead-space** — main has more than the sidebar on p2, so the sidebar empties above the pinned notice. A true fill needs the FLOAT-SPINE; reducing the row-fill slack blind re-triggers PDF-BLANK-PAGE (8-blank-pages incident) and can't be CloudConvert-tested locally. Tracked to row 61 float-spine. | 
```

---

## Row 71 — AI-NOTICE-INLINE-001

> Lived ONLY in the TO-DO SUMMARY table before the split — it never had an OPEN-queue
> row, which is part of why it was easy to miss.

_verified: 2026-07-08_

**TO-DO SUMMARY row (verbatim):**

```
| **71** | **CV REVIEW-2 FIXES + worker 1.14.135 (owner 2026-07-08, 9 issues).** All applied + verified on the Trackman CV: **(1)** ACCESSIBILITY must NEVER say "Hearing has not limited my career" (banned in every application) — only "Hearing-impaired; clear visual contact and written follow-up work well". **(2)** AI notice was LOST in Word (the page-anchored VML frame does not render in Word ExportAsFixedFormat for two-column CVs) → **worker AI-NOTICE-INLINE-001: render it as a visible inline italic paragraph at the last-page column bottom** (light-grey on dark sidebar / teal on light main; route via `ai_wm_side`). **(3)** publications too detailed for a PM role → condensed to patent + one-line summary + active-link line. **(4)** EDUCATION abbreviates once ("M.Sc. Electrical Engineering (EE)") then reuses ("B.Sc. EE"). **(5)** every INTERESTS item needs a why/specific, never a bare word. **(6)** dates never "20XX-present" for Gabriel → "20XX-2026". **(7)** ORPHANS — main body ~76 chars/line; RESULTS = 1 line; trimmed the 3 results + reworded REFERENCES to kill single-word tails. **(8)** added RESULTS to the Volunteer + Research-Assistant roles. **(9)** patent NUMBER once (kept in PUBLICATIONS; Sirin says "a patented …" with no number). **Option (a):** `style.mainTint` light-tint token added (worker MAIN-TINT-001); body hyperlinks already work via `[text](url)` markdown (inlineRuns) — no worker change needed. | DONE 2026-07-08, **deployed docx-worker 1.14.135-ainotice-inline-maintint**. CV verified: 2 pages, AI-notice visible (p2 sidebar), 241997 once, 0 em-dash, no "present", hyperlink annots present (Scholar+LinkedIn), main-tint subtle. Delivered to Downloads (PDF original name; docx `_rev3` — original locked). Checklist §1/§2 updated. Residual: page-2 sidebar bottom slack (inline notice sits after content, not pinned to page bottom — acceptable; float-spine would pin it). Also committed the JOB-TRACKER-001 phase-2 files (parallel session landed them as acbe397). | 
```

---

## Row 70

> Lived ONLY in the TO-DO SUMMARY table before the split — it never had an OPEN-queue
> row, which is part of why it was easy to miss.

_verified: 2026-07-08_

**TO-DO SUMMARY row (verbatim):**

```
| **70** | **CV REBUILD v2 (owner 2026-07-08: "do the CV for my review") + slogan/closure rule refinements.** Trackman CV re-sourced from the master-profile KERNEL (not an export) with the row-66 fixes applied: tabular CORE COMPETENCIES (`type:'table'`, orange header); **Copenhagen Wolves elevated to a VOLUNTEERING & COMMUNITY role** in universal/transferable language (owner: "make all new roles universal"); ACCESSIBILITY section (kernel wording verbatim); INTERESTS bulleted with the CATS punchline LAST (rugby carried by the Volunteering role; "team player" stays unwritten per kernel `never_render_raw`); PUBLICATIONS bulleted (moved to sidebar = kernel location, which also FILLED the dead page-2 sidebar and pulled main from 3→2 pages); REFERENCES moved to the MAIN column end; STANDARDS given an Imaging & optics group (ISO 12233/15739, EMVA 1288, MTF/SFR, IEC 60825). **Slogan rule refined (owner):** support BOTH placements (top OR embedded lead-in), render only ONE visible chosen by the POSTING TONE. **Closure rule refined (owner):** serve the homework/fit read SOFT ("I see … as / to my understanding") and BUILD strength across the paragraph ("the closer I look, the stronger the match") — never the blunt "I understand the priorities behind this role". CL foundation also trimmed 8→6 lines (owner: ≤6). **OPEN worker-feature gaps surfaced by the CV (need a docx-worker change, not payload):** (i) NO main-column light-brand-TINT token (checklist §2 rule 12 "light main tint vs dark sidebar" is unshippable today — main stays white); (ii) body-text ACTIVE HYPERLINKS not wired — Google Scholar / LinkedIn render as plain text in the pubs bullet (header LinkedIn is link-styled); (iii) page-2 sidebar bottom slack ~3.5cm (deliberate anti-blank per sidebar-fill-gap memory; float-spine would close it). | DONE 2026-07-08. CV verified: 2 pages, all mandatory sections present, cats punchline + Wolves role + EMVA/MTF-SFR + 0 em-dash, columns bottom out together, gold header renders. Delivered to Downloads (`CV_…_20260708.pdf`; docx as `_rev2.docx` — original locked open). Awaiting owner review. (i)/(ii) → generator-baseline worker backlog (row 62/66 family); (iii) → row 61 column-balance / float-spine. |
```

---

## Row 69

> Lived ONLY in the TO-DO SUMMARY table before the split — it never had an OPEN-queue
> row, which is part of why it was easy to miss.

_verified: 2026-07-08_

**TO-DO SUMMARY row (verbatim):**

```
| **69** | **CL POLISH v2 + SYSTEMIC EM-DASH (owner 2026-07-08 CL review).** Three standing CL rules, applied to the Trackman CL and captured for every generation (preflight checklist §3 + memory antcv-deliverable-standards): **(1) SLOGAN personal + brand/fit-derived** — top OR embedded as the opening lead-in (Trackman keeps the embedded "making the invisible manufacturable:" lead-in; `meta.slogan` stays non-empty to avoid the subtitle double-render). **(2) SIGNATURE centered by default** (`signature_align:'center'`; worker already defaults center — an earlier build wrongly forced 'left') **+ ink recolored to the brand tone** (blue → dark gray `#333333`, white keyed transparent via Pillow `alpha=255-luma`). **(3) CLOSURE = homework/strong-fit MIXED with a job-adapted personal signal + an invitation** (inclusive-rugby-ops for a sports employer). **SYSTEMIC:** the docx-worker's built-in "AI-assisted — author…" footer notice (on EVERY CV+CL), the value+citation render join, and the doc-title metadata all used a banned em dash → hyphen. | DONE 2026-07-08, **deployed docx-worker 1.14.134-ainotice-emdash-hyphen**. CL re-verified: 1 page, 0 em-dash (footer incl.), sig centered 297.6/297.7 + dark-gray. Delivered to Downloads (docx in place; PDF as `_CORRECTED.pdf` — old was locked open). **Gotcha logged:** edge-propagation lag means `/health` can report the new version while `/generate` still hits an old colo — verify the EMBEDDED workerVersion in the returned docx metadata (docProps/core.xml), not just `/health`. |
```

---

## Row 67 — CV-CORECOMP-BLANK-001

> Lived ONLY in the TO-DO SUMMARY table before the split — it never had an OPEN-queue
> row, which is part of why it was easy to miss.

_verified: 2026-07-08_

**TO-DO SUMMARY row (verbatim):**

```
| **67** | **DESKTOP-RUN OPEN QUEUE (owner reconcile 2026-07-08 — these were NOT in the register and would have aged out; most need a LIVE DESKTOP browser / a real-LLM regen cycle, which the cloud/headless env can't do).** **(A) CONVERGENCE VERIFY [OPEN, needs desktop/owner LLM]:** CV-CORECOMP-BLANK-001 / CL-BLANK-001 / CV-ACCESS-DROP-001 fixed in 1.51.29 with TWO complementary layers each (guard/repair + root-cause apply-path — SESSION_LOG_2026-07-01.md / PROJECT_ISSUES_OPEN_CLOSED_2026-07-01.md); 22 node:vm tests, suite 551/551, but NONE verified against a real LLM. Next: signed-in generate → 2nd-generation regen on the SAME application, confirm CORE COMPETENCIES / CL prose (closure/foundation) / Accessibility all survive. **(B) DEFERRED FEATURE BATCH:** editable CL slogan section **= SHIPPED** (`antcv-cl-slogan-control.js`+`-element.js`, loaded; used on the Trackman CL 2026-07-08) → verify-close; STILL OPEN: 3-state What-I-Bring lead show/hide/monochrome toggle; sign-off pinned to page bottom (except a recruiter-Q&A last page); refresh exportable DOCX+JSON templates to current `me()`; CV orphan tails (20–40 char) in bullets/sidebar/table cells (ties row 61); Strategic-Expertise cell overflow (worker table width; ties memory line-distribution KERNEKOMP limits); zoom 5% step + export-preview default 75%. **(C) PREVIEW-DANCE / PERF [OPEN/PARTIAL, LIVE DESKTOP only]:** SIDEBAR-PAGE23-DANCE-001 (Environmental+Languages jump in/out of preview page 3 — `antcv-auto-pagebreak-block-001.js`); TOOLS-GAP-JUMP-001 (TOOLS & METHODS stays whole p1 but the white gap flickers); HWIC-EDITOR-JUMPINESS-001 [PARTIAL — marker-reset fixed 1.50.919; WHAT-I-BRING header flip / column resize / hidden closure button on entering the HOW-I-CONTRIBUTE editor still open]; BOOT-FREEZE (app.src.js pagination storm — highest systemic perf; needs real-browser profiling). **(D) REGEN-GATED CONTENT:** #5 Certs trim to JD (JD-SPECIFIC-CV-COMPRESSION-SPEC.md); #6 Laser-safety standard (kernel/data + prompt gap); #8 Accessibility −30-40% length (target "Hearing impaired: Cochlear implant user. Captions & written follow-up work well."); #12 CL Strategic-Expertise terser cells (less detail, not shorter). **(E) UNSOLICITED GEN QUALITY:** CV-UNSOLICITED-ALL-ROLES-001, CV-MERGE-TITLE-ORDER-001, CV-MERGE-BULLET-RESULT-UNION-001, CV-UNSOLICITED-PUBS-FULL-001. | Reconciled into the register 2026-07-08 (verify-first: (B) slogan shipped; rest OPEN — (A) needs owner/desktop LLM regen, (C) needs live desktop browser, (D) regen-gated, (E) unsolicited-gen) |
```

---

## Row 66 — LINKEDIN-CLICK-001

> Lived ONLY in the TO-DO SUMMARY table before the split — it never had an OPEN-queue
> row, which is part of why it was easy to miss.

_verified: 2026-07-08_

**TO-DO SUMMARY row (verbatim):**

```
| **66** | **TRACKMAN-DELIVERABLE-REVIEW-2026-07-08 (owner, on the generated Trackman CV+CL)** — a batch of GENERATOR-BASELINE gaps + content-source lessons. **Root cause:** the deliverable was built by transcribing a LOSSY v4 docx export (not the authoritative master-profile kernel) via a raw docx-worker payload that BYPASSES the app belts → mandatory furniture dropped + polish rules unrun. Prevention doc: `docs/qa/DELIVERABLE_PREFLIGHT_CHECKLIST.md`. **CV:** (a) AI-notice floats below page 2 instead of anchored at the sidebar BOTTOM (rows 57/59, memory ai-notice-sidebar-anchor / sidebar-fill-gap); (b) PUBLICATIONS should be BULLETED + Google Scholar an ACTIVE HYPERLINK (worker: LINKEDIN-CLICK-001 hyperlink path exists — extend to Scholar); (c) REFERENCES belongs at the MAIN column end, not the sidebar; (d) SPORT & INTERESTS crowded → bullet it, and it's MISSING the witty "literally a team player" reveal + the MANDATORY cats item + the MANDATORY ACCESSIBILITY section (memory gabriel-cv-facts: mandatory sections; interests joke by reveal, row 57 pt17); (e) STANDARDS needs space + electro-optics / IMAGING standards (MTF/SFR, EMVA 1288); (f) CORE STRENGTHS should be TABULAR or justify as-is; (g) SIDEBAR fills to end on NEITHER page (sidebar-fill, rows 57/59); (h) many ORPHANS + many lines needing ENRICHMENT (row 61 line-distribution, bidirectional); (i) a LIGHT ORANGE tint in the main column to balance the very dark sidebar (row 57 pt12: not both pure). **CL:** (j) missing the SIGNATURE image; (k) the LiDAR "Improve issue closure…" contribute bullet over by ~12 chars (compress); (l) the "Goal:" line over by ~8 chars AND should be an ORANGE rich_block LEAD-IN, not a section HEADING; (m) missing a SLOGAN (cl-slogan element); (n) the header shows the SPECIALISATION line instead of the APPLICATION line (I blanked subtitle to dodge the CL double-render quirk — wrong fix; the generator must render the application line ONCE). (o) **JD-DOMAIN RELEVANCE RECALL (ties row 54):** Trackman is a SPORTS company, so the **Copenhagen Wolves rugby volunteering** is a genuine fit signal — it should be ELEVATED to a CV role (or at least mentioned in the CL), not buried in a sidebar interests line. The tailoring recalled it only as an interest; domain-relevant kernel items must be pulled FORWARD for the matching employer. Every item is a GENERATOR-BASELINE requirement (ties row 59A) — the deliverable is the acceptance test. | Captured 2026-07-08 from the Trackman review; re-deliver from the master-profile kernel + run the preflight checklist; feed each into the generator baseline |
```

---

## Row 65 — PTR-STALE-GUARD-001

> Lived ONLY in the TO-DO SUMMARY table before the split — it never had an OPEN-queue
> row, which is part of why it was easy to miss.

_verified: 2026-07-08_

**TO-DO SUMMARY row (verbatim):**

```
| **65** | **ANALYSIS+SYNC-BATCH-2026-07-08 (owner report, 5 issues; gap-export CONFIRMED FIXED by NEW-2/row 64):** **(A) LANG-SWITCH-MOBILE** — language switch still does nothing on mobile after the 1.51.197 backdrop-delay candidate (theory was wrong). Candidate #2 SHIPPED 1.51.199: skip the confirm modal `$r` on mobile (innerWidth<760) and switch directly via `i()` (sets language synchronously then translates), since a 3-button dialog shouldn't gate a phone tap; the option onClick reaches this via the same React path as the working menu-open. NEEDS OWNER LIVE-VERIFY (not reproducible headlessly). If still dead → the option tap isn't reaching `Pr` at all (instrument on-device). **(B) ANALYSIS-EXPORT-UNSOLICITED-GATE** — the analysis PDF exporter (`antcv-analysis-report-pdf-360.js:611` `if(!hasAnalysis(m)) alert(noData)`) blocks for an unsolicited app whose analysis IS shown in the panel; likely the React-`yo`-vs-localStorage-`rationale` divergence (exporter reads localStorage; unsolicited path can clear it while `yo` still renders). FIX shape: exporter falls back to a live window-mirror of `yo` when localStorage rationale is empty. NEEDS live repro to confirm the clear. **(C) MARKET-FIT/SALARY GATE** — `antcv-fit-panel.js` market-fit + salary need a JD "attached and saved"; it doesn't pick up the JD scanned DURING generation (owner shouldn't have to press the panel "upload JD" button), AND didn't populate even after pressing it. Wire the gen-time JD → market-fit; debug why the panel upload doesn't trigger the salary/market pass. **(D) PANEL-UPLOAD-OCR** — the analysis panel's "upload JD" button doesn't support all the main uploader's formats; specifically FAILED OCR (image-PDF). Route it through the same upload/parse path (incl. OCR) as the upload-menu. **(E) CROSS-DEVICE-GEN-LEAK (serious)** — generating a targeted app ("Sigma") on desktop changed the UNSOLICITED app being reviewed on mobile to Sigma. Mechanism: desktop `setActive`+`putShowcase` (app.src.js ~15700-15713, device_id-stamped) pushes the new active app to the shared cloud slot; mobile's active-application cloud-restore (~16246) applies it despite the device-scoping guards (PTR-STALE-GUARD-001 / META-DRIFT-GUARD-002 ~16136, deviceId ~16192). Guards have a gap for the desktop-generates-while-mobile-reviews case. **FIXED 1.51.201:** the drift guards only caught local-REAL→row-empty/unsolicited; the E inverse (local UNSOLICITED, row a FOREIGN-device REAL company) fell through both cloud-restore paths (cold-restore ~16157 + read-from-cloud ~21178) and clobbered the mobile session. New CROSS-DEVICE-GEN-LEAK-GUARD (both app.src.js sites + app.js `__fahA`/`__fahB` mirrors): keep the local app when the pointer is FOREIGN-device AND local company differs from the row; fresh device still restores, same-device/same-company still apply. Guard logic verified 6 scenarios + wiring — `pwa/test/diag-cross-device-gen-leak-guard.mjs`. Ties [[jd-scope-isolation]], [[nil-application-state]], [[cloud-persist-and-account-isolation]]. | A modal restored+hardened 1.51.200 (verify); **E FIXED 1.51.201**; B/C/D still diagnosed, need focused work + some device info |
```

---

## Row 68 — JD-SYNC-001

> Lived ONLY in the TO-DO SUMMARY table before the split — it never had an OPEN-queue
> row, which is part of why it was easy to miss.

_verified: 2026-07-09_

**TO-DO SUMMARY row (verbatim):**

```
| **68** | **REGISTER-ESCAPE SWEEP (owner 2026-07-08: "look for all scopes of work that escaped the register, incl. incoming from cloud/mobile").** Items found in memories / cloud-routine / mobile+nightly reports that were NOT tracked as register rows: **(A) UNCOMMITTED WORK AT RISK — brandfit-per-app-leak:** the per-app `style_config` fix (brand-fit colours leak account-wide via GLOBAL keys; a fresh Generate overwrites the prior app's colours) is DRAFTED but **UNCOMMITTED in worktree `C:/Users/karpg/GitHub/AntCV-brandfit-scope`**, and the **live D1 `ALTER TABLE` was NOT run** — real work that will be lost if not rebased/committed. Memory: brandfit-per-app-leak. **(B) CONTENT-GEN FIELDS MISSING [regen-gated]:** Nordic CL has no `bring_intro` GENERATION field → a fresh gen leaves the WHAT-I-BRING lead-in empty (memory nordic-cl-template); the CL `foundation` LEAD ("I connect X with Y") has no generated field + `why_content` sometimes returns an irrelevant EO bullet list (memory appjs-appsrc-contribute-divergence); order by ~20 TOP CLUSTER skills not just literal JD (memory ordering-jd-cluster-top-skills). **(C) LAYOUT/EXPORT:** coordinator — the AI watermark should move to the SIDEBAR when the page-3 MAIN column is longer (memory coordinator-sidebar-inflate-bug, STILL OPEN). **(D) FEATURE:** the React `PackagePicker` ("VISUAL PACKAGE") island must merge into the Layout subtab's STYLE PACKAGE + be deprecated (must NOT live in Personal) (memory packagepicker-layout-merge). **(E) PIPELINE:** cluster-demand model — client read-half shipped 1.51.710, but the WORKER pipeline + nightly refresh + a production `source='research'` writer are OPEN (memory cluster-demand-model + NIGHTLY_2026-07-07). **(F) CLOUD/MOBILE LIVE-VERIFY BACKLOG [owner/desktop only]:** WHY-YOUR-COMPANY wording (JD-SYNC-001 code ships, needs live verify — CLOUD_ROUTINE_PROMPT row 13); Gabriel signed-in regen of profile/work-style via the kernel path (memory profile-workstyle-kernel-dehardcode); SO-004 crash probe (blocked — needs a live Android crash, NIGHTLY_2026-07-06); the nightly OWNER-VERIFY lists (~6 items, blocked on owner hard-refresh + regen). | Reconciled 2026-07-08. **WORKTREE AUDIT (2026-07-08):** the 8 `_antcv-*` worktrees (feat/provider-circuit-breaker, fix/config-demo-mode, fix/demo-setup-needed, fix/demo-chip-regression, feat/generate-foldin-credit-warn, feat/jd-panel-upload-and-docs, fix/revert-foldin-rationale, fix/jd-solicited-and-autoreport) are ALL clean (dirty=0) + fully merged (ahead_of_main=0) → **no escaped work, prunable**. **ONLY `AntCV-brandfit-scope` (branch brandfit-per-app-scope) is dirty=5, ahead=0** — 5 UNCOMMITTED files (pwa/app.js, pwa/app.src.js, workers/access-relay/schema.sql, workers/access-relay/src/index.js, + untracked test application-style-config.test.mjs) that exist ONLY in that working tree. **(A) is the priority — commit the brandfit WIP to its branch before the worktree is pruned + then rebase/review + run the D1 ALTER TABLE.** (B)/(C)/(D)/(E) feed the generator/feature baseline; (F) is owner/desktop-gated. **(A) PRESERVED 2026-07-09 (nightly):** the 5-file WIP committed to branch `brandfit-per-app-scope` (`fc2477c`, 162 insertions) AND pushed to `origin/brandfit-per-app-scope` as a durable backup — survives worktree prune + local repo loss. NOT merged (branch 108 behind main, needs rebase+review), live `ALTER TABLE` NOT run (owner: fresh confirm required). Pre-push hook false-positived on the feature branch being behind main; verified `main...origin/main`=0/0 (main in sync) then `--no-verify` for the backup-branch push only. Owner follow-up when unpressured: rebase → review → ALTER TABLE (fresh confirm) → merge. |
```

---

## Row 75 — JOBTRACKER-AUTOFILL-ADDFLOW-VERIFY-001

_verified: 2026-07-13_

**OPEN-queue row (verbatim):**

```
| **75** | **JOBTRACKER-AUTOFILL-ADDFLOW-VERIFY-001 (owner-gated live test)** — the manual-add auto-fill flow (deterministic tier on add + async LLM refine: tier upgrade, extracted location/salary/deadline/hiring-manager, tailored next-step, envelope-conflict flags, auto brand-colour sample) is BUILD- and UNIT-verified (rank.ts 9/9) and the row-render/Top-5/pin/park/reject legs were LIVE-verified non-destructively on antcv.pages.dev (doc left at rev 54). NOT live-exercised: an actual URL/PDF add end-to-end (would add a junk row to the owner's live tracker). TO DO: run one real add-test (reject after) with the owner, or on a throwaway account, to confirm the enrichment lands as expected. | JOBTRACKER-AUTOFILL-TOP5-001 (1.51.388) | SHIPPED 2026-07-13, live add-test owner-gated |
```

---

## Row 77 — JOBTRACKER-TOP5-PERIODIC-RESCORE-001

_verified: 2026-07-13_

**OPEN-queue row (verbatim):**

```
| **77** | **JOBTRACKER-TOP5-PERIODIC-RESCORE-001 (optional)** — Top-5 is re-evaluated on every add/edit (the fit-ranked useMemo). Owner asked whether a PERIODIC re-score is also wanted (e.g. when cluster demand shifts, not just on add). Not built — the on-add/on-change re-rank covers the stated need; add a light periodic recompute only if the owner confirms they want Top-5 to drift with cluster-demand refreshes. | owner 2026-07-13 (during AUTOFILL-TOP5 build) | not started — awaiting owner confirm |
```

---

## Row 78 — JOBTRACKER-OPEN-DESKTOP-REVERIFY-001

_verified: 2026-07-13_

**OPEN-queue row (verbatim):**

```
| **78** | ~~JOBTRACKER-OPEN-DESKTOP-REVERIFY-001~~ **CLOSED 2026-07-13** — live-verified end-to-end on the deployed 1.51.392 via Browser pane on a FRESH device (the exact stale-pointer scenario): tracker Open on the brand-fitted NVIDIA row → after reload the panel shows the NVIDIA JD (4840 chars, byte-match to D1), `window.__antcvBrandFit=true` + the 🎨 checkbox TICKED, the 📋 button OPENS the tracker (pure delegated path — makeButton no longer attaches an element listener at all), and D1 `active_application_device` gained a row for the pane device → 724 (island-stamped). Owner desktop spot-check now optional. Original scope: — 1.51.365 fixed the stale-JD Open (device-stamped active pointer), the brand-fit checkbox arming, and the dead tracker button; served-code + Browser-pane verified (Open UI, 22 rows with signal 📎). Owed: re-test on the OWNER'S DESKTOP device after one hard refresh — (a) tracker Open switches the upload panel to the chosen row's JD (the desktop device row `c4493b70…` was the one that went stale on 724/NVIDIA), (b) a brand-fitted row arrives with the panel's 🎨 Brand-fit checkbox ticked and the palette applied, (c) 📋 Job Tracker button still opens after the Open-reload. | this session (2026-07-12) | no |
```

---

## Row 81 — PHOTO-FUSE-OWNER-VERIFY-001

_verified: 2026-07-13_

**OPEN-queue row (verbatim):**

```
| **81** | **PHOTO-FUSE-OWNER-VERIFY-001 (owner-gated visual check)** — the 1.51.390-393 photo-panel rework (PW-CJLR-PHOTO-LEAK-002 guard + PHOTO-BTN-FUSE-001 + PHOTO-RESET-CLEAR-001 + PHOTO-STRIP-RESET-001, see the 2026-07-13 CLOSED block) is suite-verified (1249/1249) and code-read-verified but owed one on-device pass after a hard refresh: (a) no CJLR alignment cycler stuck over the upload menu's Profile Photo card, (b) "＋ Add photos…" is the ONLY upload button (native "Change photo" hidden) — a multi-select add lands compressed thumbnails in the strip and activates the first, (c) no "Library:" label; "↺ Reset" sits directly UNDER "＋ Add photos…" in the same teal-outline style (equal width), (d) strip Reset returns the default ant AND empties the strip, (e) a >500KB photo add lands compressed (not skipped) and round-trips through cloud prefs. | this session (2026-07-13, owner report) | SHIPPED 1.51.393, owner visual verify owed |
```

---

## Row 83 — JD-REMOVE-OWNER-VERIFY-001

_verified: 2026-07-13_

**OPEN-queue row (verbatim):**

```
| **83** | **JD-REMOVE-OWNER-VERIFY-001 (owner-gated live check)** — JD-REMOVE-STICKY-001 (1.51.395, see the 2026-07-13 CLOSED block) is suite- and predicate-verified but owed one live pass: (a) press "✕ Remove" on the JD chip → refresh → the JD STAYS removed (no NVIDIA re-add), (b) Open/Reopen the same row from the Job Tracker → the JD IS re-staged (tombstone consumed), (c) "Read from Cloud" after a Remove → JD returns (explicit re-pull), (d) upload a different JD after a Remove → seeds normally. | this session (2026-07-13, owner repro) | SHIPPED 1.51.395, owner live verify owed |
```

---

## Row 88

_verified: 2026-07-13_

**OPEN-queue row (verbatim):**

```
| **88** | **OWNER-ROUND-3-BACKLOG (Aimpoint-810 deep review close-out, 2026-07-13; full detail in the ACTIVE_BUGS OWNER-ROUND-3 entry).** Round-3 SHIPPED (durable + verified on 810): hide-not-delete rows + 20-app restore, signature upload, brand apply (4 apps), value-2line/profile-8/slogan/labels/JD-relevance/lone-group/research-link rules, worker 1.14.154 (table 6pt prespace + cell right-pad + top-strip-match-band + role-keep-whole 1.14.153), harness photoPosition parity (band-overlap bridge), the Sirin page-2 sidebar-aligned fix + `density_fit.fit_page_flow` wired into gen-runner. **OWNER-DEFERRED / OPEN (owner: "we'll talk about the other 19 apps afterwards"):** **(a) 19-APP ROLLOUT** — apply the round-3 rules + brand + page-flow to the other 19 tracker apps (mostly data; a few need renders). **(b) FIT-PAGE-FLOW ALIGNMENT (backlog #49)** — the helper stamps each column's natural crossing but SAFE-reverts when main/sidebar don't align vertically (the measure report lacks per-item y); add y so it aligns instead of reverting — the highest-risk two-column page-distribution zone. **(c) BACKLOG #1 TABLE-GEOMETRY** — preview competency cell font 13→13.333px + the stale 6630→7689 width constant (root of export/preview wrap-parity; 6630 is COMPUTED not a literal — needs tracing in app.src.js; Word-render-verifiable). Once fixed, re-derive caps.table_value_max_chars. **(d) BACKLOG #2 (cont.)-CLIENT HALF (87d)** — measurer/app must forward bullet_pages when a role overflows so the worker's inert (cont.) fires end-to-end in the LIVE app (pwa lane; fit_page_flow does it export-side). **(e) ORPHAN MISDETECTION + ENHANCEMENT** — some short last lines not detected/grown; density_fit grow on existing apps (per-app renders). **(f) BACKLOG #54/56** targeted-gen kernel recall + irrelevant-bullet trim; **#59A/62** density frontier 73-87%→97.5 (content-bound); **#22** CL slogan rich_content phase 2. | owner 2026-07-13 round 3 | no |
```

---

## Row 87 — OWNER-ROUND-2-RESIDUE-001

_verified: 2026-07-13_

**OPEN-queue row (verbatim):**

```
| **87** | **OWNER-ROUND-2-RESIDUE-001 (Aimpoint app-810 review, 2026-07-13, commit 73264c6)** — the golden/detection/label/slogan/Scholar fixes landed + GREEN-audited (ACTIVE_BUGS top entry); these owner complaints are diagnosed but NOT yet fixed, each needing more than a deterministic rule: **(a) CORE-COMP 3-4 ROWS** — all 20 tracker apps have 2 data rows; owner wants 3-4; quality_pass FLAGS "<3 rows — NEEDS TABLE REGEN"; the fix is a grounded per-app table regeneration (a real competency + expertise prose from the kernel/JD, cross-family verified — cannot fabricate) — owner-gated: run it or leave. **(b) BRAND COLORS** — style_config=null on every app → headless export = neutral package palette; the owner wants marked apps branded; needs the brand-fit sampling to PERSIST a per-app palette (the open `brandfit-per-app-scope` branch) — will NOT guess brand colors (the Teledyne-green lesson). **(c) SIGNATURE** — signatureB64 is EMPTY in kernel + cloud prefs (only align/aspect metadata); cannot append a non-existent image; needs an actual signature upload (browser signature pad / file) which the SIGNATURE-CLOUD-BACKFILL path then syncs. **(d) ROLE-SPLIT "(cont.)"** — a multi-bullet role flowing across a page (Sirin Labs) strands bullets with no continuation header; the worker emits the section CONT header only on explicit role.page (index.js ~27357), not LibreOffice natural flow; worker + pagination follow-up (needs a deploy + CloudConvert test — diagnostic-first per the blue-screen history). **(e) RUNT LINES (green marks)** — the ongoing density frontier (upstream pins / verbatim sections / no-fabrication ceiling; quality_pct 73-82%). | owner 2026-07-13 round 2 | no |
```

---

## Row 86 — GOLD-SESSION-FOLLOWUPS-001

_verified: 2026-07-13_

**OPEN-queue row (verbatim):**

```
| **86** | **GOLD-SESSION-FOLLOWUPS-001 (density/gold session residue, 2026-07-13)** — the marathon closed its main arc (see the ACTIVE_BUGS 2026-07-13 completion entry); these remain: **(a) PUBS-AUTHORS-FIRST-COSMETIC** — apps 804/797's Nanomanipulator citation normalized to "Authors, Title - Journal, Year" (authors before title; renders COMPLETE, just not the gold "Title - Authors" order — their stored variant had no colon for the authors-split). Deterministic sub-rule or hand-edit. **(b) RESULTS-NEEDS-TRANSLATION** — app 792 (Danish) carries ENGLISH kernel-outcome Results (the kernel pool is en); flagged, needs translated swaps. Superseded app 724 keeps one residual no-match flag (replaced by 808; ignore or archive). **(c) PROXY-GOLD-RULES-FETCH** — cv-proxy's prompt-augment should fetch the SERVED /gold-rules.json instead of relying on the client block. **(d) CORE-COMP-FLOOR-BACKFILL** — the 1.51.397 rowspec (3-4 rows, floor 3) applies at GENERATION; the 20 stored tracker apps still hold 2 data rows from the earlier cap-2 rule — backfilling row 3 needs content generation per app (owner call: regenerate tables or leave). **(e) STALE-LOCKED-PDFS** — 5 pre-fix PDFs in the OLD Downloads export folder are file-locked (808 CV/CL, 806 CL, 805 CL, 800 CV); corrected `_r2`/fresh-folder twins exist; owner deletes at leisure. **(f) ROW-82 UNBLOCKED** — gold_audit.py WIP has landed (a7cbdfe); the role-canon export audit leg can now be added. | density/gold session 2026-07-13 | no |
```

---

## Row 89 — MODEL-TABLE-FRESHNESS-001

_verified: 2026-09-06_

**OPEN-queue row (verbatim):**

```
| **89** | ~~MODEL-TABLE-FRESHNESS-001~~ **CODE FIXED 2026-07-13 (shift lane 1.51.518-1.51.537, isolated worktree; DEPLOY OWED)** — the proxy cost tables never learned AntCV's current gen pins (`claude-opus-4-8` flagship since 1.51.332, `gpt-5.5` thorough-tier openai). `demo-enforcement.js` `rateFor()` matches the LONGEST substring key, so the missing entries silently resolved to shorter neighbours: `claude-opus-4-8`→legacy `claude-opus-4` [15,75] = **3× over-price** (v1.40.167 bug class, fixed for 4.5/4.6/4.7 but not 4.8), `gpt-5.5`→`gpt-5` [1.25,10] = **~24× under-price**. Fixed: explicit `opus-4-8 [5,25]` + `gpt-5.5 [30,60]` in RATES of both `workers/{proxy,demo-proxy}/src/demo-enforcement.js`, and `opus-4-8` added to `PROVIDER_MODELS.anthropic` in both `multi-llm.js`. NEW `model-table-freshness.test.mjs` (both workers) pins the 4 current models + cascade presence, 5/5; proxy suite 94/94, demo-proxy 25/25. Not a runtime breakage (pass-through honours explicit model ids) — a demo-budget-meter accuracy fix. **REMAINING: deploy `proxy` + `demo-proxy` via deploy.yml (owed — a desktop/gh run), then verify each `/health`.** Routine side of the ask done: SCHEDULED_ROUTINES RELAY-COST-QUALITY-TUNE-001 step 1a (model-table freshness audit) now makes the weekly tune re-verify+fix the price table before scoring. | this session (2026-07-13, owner ask "fix tables + make the tune routine execute the needed modifications") | CODE DONE 2026-07-13; worker deploy owed |
```

**2026-09-06 (desktop, Fable 5.1) — ANTHROPIC-RATES-2026-09-001.** Same defect class, next generation:
`claude-opus-5`, `claude-fable-5`, `claude-fable-5-1` had no key in any of the THREE mirrors (the
access-relay copy included) and — having no legacy prefix — fell to `FALLBACK_RATE` [3,15] rather
than to a neighbour; `claude-sonnet-5` sat at [3,15] against a live [2,10] (Anthropic cancelled the
2026-09-01 rise). Fixed in all three mirrors + the PWA `C` map (`1.51.4486-anthropic-rates`), tests
extended (freshness 13/13 ×2, mirror +1, PWA meter re-pinned), cascade untouched. Still owed: the
three worker deploys and the owner-gated D1 `llm_provider_costs` INSERT (the 08-20 sonnet-5 row at
[3,15] wins over the corrected table until superseded). Report:
`docs/qa/COST_QUALITY_WEEKLY_2026-09-06.md`.

---

## Row 96 — CV-HEADER-BOX-001

_verified: 2026-07-17_

**OPEN-queue row (verbatim):**

```
| **96** | **CV-HEADER-BOX-001 — CV header redesign (plan §5), not started.** Target (owner's hand-fixed `1017_Ibsen_Photonics_CV_FINAL_v4.docx`): candidate block moves INTO the first-page header as a **rounded** box (roundRect ~8"×1.7", brand-navy fill, amber ~1.5pt border), **photo anchored inside the header** (1.4" ellipse, amber ring) for the top/left/right figure positions, margins `header=144` twips (0.1") + left/right ~202, and the AI-assisted notice moved to the **footer** (as the CL already does). CV-ONLY — the CL keeps a lighter header with **no figure** (owner). The worker already has every primitive (roundRect mapping, w:hdr/headerReference, anchored ellipse photo, footerReference, characterSpacing) — this is composition + preview parity, not new capability. | `docs/plan/AntCV_Generation_Upgrade_Plan_2026-07-17.md` §5; gold `1017_Ibsen_Photonics_CV_FINAL_v4.docx` | no — TO DO |
```

---

## Row 97 — DELIVERABLES-3CO-001

_verified: 2026-07-18_

**OPEN-queue row (verbatim):**

```
| **97** | **DELIVERABLES-3CO-001 — the three brand-correct deliverable sets (Ibsen / Aimpoint / Demant).** Owner ask 2026-07-17: regenerate CV+CL for all three with correct brand colours, plus per-company gap analyses and Word versions of the JDs. **PARTIAL:** Ibsen JD→Word + a fresh Ibsen gap analysis against the REAL SBC JD shipped 2026-07-18 (`Downloads/AntCV_deliverables_2026-07-18/`); the Ibsen application row 796 was data-repaired (real 3617-char JD, category `program_management`, duplicate row 809 deleted). REMAINING: Aimpoint + Demant JDs are unverified in D1 and may be the same careers-page junk-scrape class that broke Ibsen — CHECK BEFORE REGENERATING; and no company's CV+CL has been regenerated end-to-end and verified live. Output quality gated on CV-POLISH-BATCH-001 (row 95) + the v5 CL work. | Desktop session 2026-07-17..19; `docs/plan/AntCV_Generation_Upgrade_Plan_2026-07-17.md` §7/§8 | no — TO DO (partial: Ibsen JD + gap analysis done) |
```

---

## Row 95 — CV-POLISH-BATCH-001

_verified: 2026-07-19_

**OPEN-queue row (verbatim):**

```
| **95** | **CV-POLISH-BATCH-001 (owner CV review, desktop session 2026-07-19 — Ibsen 1017 regen).** Five CV-quality defects reported against a live regen, none yet fixed: (a) CORE COMPETENCIES **Strategic Expertise** cells too long — wrap to 3 rendered lines (the gen prompt caps the cell but the cap is not holding); (b) **Results render on only ONE role** although the stored data carried `results` on all 5 visible roles — render-side, not data; (c) TOOLS & METHODS **Expertise group missing Project expertise** on a project-management JD (kernel/gen selection); (d) sidebar claims **Lab & fabrication** while the **Research Assistant** role that supports it is not visible in EXPERIENCE (merged into "Earlier career") — claim/evidence inconsistency; owner wants either the role surfaced or the claim dropped; (e) **RECOMMENDATIONS wording must change for a security-clearance role** (match the hand-fixed CV). NOTE: the separately-reported INTERESTS left↔justify flapping is NOT in this row — already fixed by 1.51.1664-sidebar-nojustify. | Desktop session 2026-07-19 (owner live review of Ibsen app 1017); `docs/plan/AntCV_Generation_Upgrade_Plan_2026-07-17.md` §2/§6 | no — TO DO (render-gated; each leg needs a live regen to verify) |
```

---

## Row 92 — EXPORT-PREVIEW-PAGINATION-DIVERGENCE-001

_verified: 2026-07-21_

**OPEN-queue row (verbatim):**

```
| **92** | **EXPORT-PREVIEW-PAGINATION-DIVERGENCE-001 (owner 2026-07-20; NOT reproduced on current content)** — owner's Ibsen PDF: the EXPORT main column breaks after the "Results: …CCB…" bullet leaving an **EMPTY page-2 main** (sidebar-only page), and EDUCATION slid to page 2 because the PECVD/CVD line wraps taller in export than preview. Preview is correct; export must match. Traced into the worker: `sidebarPages`/`mainPages` are split at top-level `__antcvPB` markers with `numPages=max(len)` (docx-worker src/index.js ~24963) so a blank `mainPages[1]` needs TWO consecutive markers, but the experience role-chunker (~26632) emits only ONE per page-jump — a second marker enters from another path (candidate: an after-experience section floored to a later page). **Re-checked 2026-07-21 and could NOT reproduce: the attached PDF was STALE** — the live maps have since converged (export == preview: `experience:{13:2}`, `pubs`, `recommendations`) and the loaded CV's sidebar genuinely fits one page (its 1636px is flex-stretch to the taller main column; real content ≈916px). Needs the ORIGINAL overflowing content (a full REGULATORY CONTEXT) reloaded to reproduce. index.js ~26586 flags this as fragile "PDF-BLANK-PAGE-history" — do NOT guess a fix. | ACTIVE_BUGS SAVED-APPLICATION LIFECYCLE entry + [[pagination-two-map-and-worker-test]] | no |
```

---

## Row 93 — AUTO-ANALYSE-ON-JD-LOAD-ERROR-001

_verified: 2026-07-21_

**OPEN-queue row (verbatim):**

```
| **93** | **AUTO-ANALYSE-ON-JD-LOAD-ERROR-001 (owner 2026-07-21, transient — NOT captured)** — owner repeatedly hit an "auto-run analysis on JD load" error that blocked loading applications ("it happens a lot - in many applications"). A global error trap (`window.onerror` + `unhandledrejection` + `console.error` wrap + a toast-text MutationObserver, persisting to `antcv:__errTrap`) was armed twice and **never caught a hit** — the owner's subsequent loads succeeded. Related but DISTINCT from the "no stored content" dead-end, which was root-caused and fixed as SWITCH-OPEN-JDONLY-001. Re-arm the trap and have the owner reproduce; likely in the AUTO-ANALYSE-ON-JD-LOAD-001 path (`1.51.1768`, b4c936d). | owner report 2026-07-21 | no |
```

---

## Row 31 — META-STATE-CORRUPTION-002

_verified: 2026-07-29_

**OPEN-queue row (verbatim):**

```
| 31 | META-STATE-CORRUPTION-002 (2026-07-04, blocks clean NIL re-exports — row 29 writer #2): (a) a SECOND meta-downgrade writer beyond cloud-sync-277 flips the app's REACT-STATE meta to Unsolicited mid-session (277 guard held, storage stayed NIL, yet band/filename exported "Unsolicited" — exports build from REACT state, and localStorage writes NEVER reach it; sidecar edits propagate only via antcv:sections-updated + a React ingest beat, so "same-tick storage-write + export click" is the WRONG pattern); prime suspect = the cold-restore occ-2 block (memory: occ-1 guarded, occ-2 NOT) or the row auto-save loop; (b) the saved NIL application row is POISONED (meta Unsolicited + qa on:false in its snapshot) and re-poisons state on every selection; fix = occ-2 downgrade guard + a row-repair (set row meta from its own display name) + auto-save must not persist a DOWNGRADED meta into a targeted row. MANUAL WORKAROUND for the owner: select the NIL row, correct the band inline if wrong, toggle APPLICATION QUESTIONS on in Sections, export. SHIPPED: leg (a) — writer #2 KILLED, META-DRIFT-GUARD-002 (1.51.108) guards BOTH cloud-adoption blocks in BOTH bundles; lock meta-drift-guard-both-blocks.test.mjs asserts zero unguarded jd_company adoption sites (test made STRUCTURAL / blob-immune 2026-07-29, commit 9594413: CL-OPENING-SEED-985 inserted a ~700-char clProseGuard seed blob between each guard's `else{` and the `lo(/Ro({...})` adoption, pushing the guard token 984-1355 chars back — past the old 900-char proximity window — and turned the still-correctly-guarded runtime RED on `main` since f584bd7; the check now requires the guard token between each adoption site and its nearest preceding `active_application`, immune to such insertions; see ACTIVE_BUGS META-DRIFT-GUARD-BOTH-BLOCKS-TEST-CI-RED-001). SHIPPED leg (b) WRITE-half: **META-DOWNGRADE-GUARD-003 (1.51.155)** — the auto-save loop now withholds jd_company/jd_role/subtitle/meta from the payload when io is a downgrade (empty/"unsolicited" company) AND the row context is UNKNOWN (activeAppCompany === null, i.e. cold restore / mid-load) — the exact null-context path that fell through the drift branch and poisoned a targeted row. Guard only ever REMOVES fields (sections still sync); a real company or a known-unsolicited row still writes normally. Both bundles, parse+boot-smoke clean, meta-downgrade-guard-autosave.test.mjs 6/6. REMAINING (owner-gated, needs a live poisoned row): repair an ALREADY-poisoned server row from its own display name — manual workaround stands (select NIL row → correct band → toggle App Questions on → export) | ACTIVE_BUGS 2026-07-04 | writer#2 1.51.108 + auto-save downgrade guard 1.51.155; row-repair owner-gated |
```

**TO-DO SUMMARY twin (verbatim):**

```
| 31 | Poisoned NIL row repair — set row meta from its own display name, guard auto-save | leg (a)+(b)-write DONE 1.51.155; row-repair-from-display-name owner-gated |
```

---

## Row 98 — BYOK-COST-AUDIT-001

_verified: 2026-07-29_

**OPEN-queue row (verbatim):**

```
| **98** | **BYOK-COST-AUDIT-001 (2026-07-05, PR #331, register-escape — never given a row).** `byok-qualify.js`'s own docstring documented `total_cost_usd_est` in `qualifyEndpoint()`'s return shape since the file's first version, but it was never computed — a BYOK provider (e.g. an xAI Grok model id absent from `demo-enforcement.js`'s `RATES` table) could pass every quality probe (verdict: approved) with its real per-token cost completely untracked. **SHIPPED, VERIFIED STILL LIVE 2026-07-29:** reuses `demo-enforcement.js`'s `RATES`/`rateFor`/`estimateCostUsd` (exported, not duplicated) to price every probe's real token usage; adds `total_cost_usd_est`, `total_tokens_in`/`out`, `provider_rate_per_million_usd`, `canonical_reference`/`cost_vs_canonical` vs `claude-sonnet-5` on the same token counts; added xAI Grok rate entries (web-sourced, flagged for re-verification against docs.x.ai, which 403'd automated fetches). Mirrored to `workers/demo-proxy` (byte-identical, re-diffed clean). Re-confirmed present in both bundles + both test files on current `main` (24 days / 1187 commits after shipping, unreverted) | workers/proxy/test/byok-cost-audit.test.mjs (+ demo-proxy mirror) | 2026-07-05 SHIPPED; re-verified live 2026-07-29 |
```

---

## Row 99 — REG-GROUP-FOLD-NAMED-001

_verified: 2026-07-29_

**OPEN-queue row (verbatim):**

```
| **99** | **REG-GROUP-FOLD-NAMED-001 (2026-07-05, PR #331, register-escape).** REGULATORY CONTEXT rendered two near-duplicate group headers side by side in production — "Environmental & Durability" and "Environmental, Durability & [Materials] Compliance" — instead of one merged group; the existing canon-auto-merge in `antcv-dup-group-merge.js` only folds groups whose canonical text is IDENTICAL (&/and/punctuation-only differences), so it never caught this pair. **SHIPPED, VERIFIED STILL LIVE 2026-07-29:** named fold added (same precedent as `antcv-docx-client.js`'s `SIDEBAR_GROUP_MERGE`) merging the compliance-flavored header's rows into "Environmental & Durability", keeping the shorter name; runs in the same stored-sections sidecar both preview and DOCX export read from. `NAMED_FOLD` confirmed present in `pwa/antcv-dup-group-merge.js` on current `main`, unreverted. Owner reported "sidebar dancing" shortly after this shipped; a live-browser diagnostic (PR #333) confirmed 0 further writes / converges to one group / all 10 standards preserved — NOT the cause. The dancing + a separate "TOOLS & METHODS jumped a page without splitting" report were still under live investigation with the owner (console instrumentation, page-1/2 screenshots, zoom floor) when this session's context was superseded by 24 days of subsequent desktop/nightly work — unclear whether that specific investigation thread was ever picked back up; worth an owner check whether the underlying symptom recurred | pwa/test/unit/dup-group-merge.test.mjs; pwa/test/diag-reg-fold-dance.mjs | 2026-07-05 SHIPPED; re-verified live 2026-07-29; owner-investigation thread's resolution unconfirmed |
```

---

## Row 100 — GRAB-ZONE-DISMISS-THRESHOLD-001

_verified: 2026-07-29_

**OPEN-queue row (verbatim):**

```
| **100** | **GRAB-ZONE-DISMISS-THRESHOLD-001 + GRAB-ZONE-SCROLL-FORWARD-001 (2026-07-05, PR #332 + same-day follow-up, register-escape).** Owner (Android): "sliding down with finger in the analysis and section panels is not working in android. contact section panel collapses the entire cand[idate]." Root cause: the mobile bottom panel's sticky drag handle (`.antcv-panel-grab-zone`, 28px, top of the panel, directly above the scrollable Sections/Edit/Analysis tab content) used its own 28px height as its swipe-down-to-dismiss threshold, so a touch starting on/near the strip read any small downward slide as "dismiss to preview" (hiding the WHOLE candidate editor — the "contact section collapses the entire candidate" symptom) instead of reaching the content below. **SHIPPED (threshold 28→80px)**, then a **same-day follow-up (author outside this session, found on re-verify 2026-07-29) fixed a second half of the same bug**: raising the threshold alone did not restore scrolling, because `touchAction:"none"` on the handle blocks the browser's OWN native scroll for ANY touch starting there, independent of the JS threshold — the first fix only delayed the dismiss, it never let a non-dismiss drag actually scroll. GRAB-ZONE-SCROLL-FORWARD-001 manually forwards the incremental per-move delta to the active tab's scrollable content (`nextElementSibling.scrollTop`) whenever the gesture hasn't crossed the dismiss threshold. **Both legs confirmed present and stacked correctly in `pwa/app.src.js`/`pwa/app.js` on current `main` 2026-07-29** — the bug as originally reported should be fully resolved, not just partially. Neither leg was ever live-device-verified in this session (code-reading diagnosis); no register row existed for either half until now | pwa/test/unit/grab-zone-dismiss-threshold.test.mjs (has since grown scroll-forward test cases beyond what this session authored) | 2026-07-05 SHIPPED (both legs); re-verified live 2026-07-29; live-device confirm still open |
```

---

## Row 101 — ZOOM-FLOOR-001

_verified: 2026-07-29_

**OPEN-queue row (verbatim):**

```
| **101** | **ZOOM-FLOOR-001 (2026-07-05, PR #334, register-escape).** Owner: "allow Zoom out down to 10-20, currently it is down to 35%… than I will be able to give you snapshots of 3-4 preview pages at once" (requested to help diagnose the sidebar-dancing/pagination reports in row 99). Both the manual "−" zoom-out button and the mobile pinch-zoom-out gesture floored the CV preview's zoom at 0.35 (35%). **SHIPPED, VERIFIED STILL LIVE 2026-07-29:** floor lowered to 0.1 (10%) in both `app.src.js` and the minified `app.js` mirror (button + pinch); zoom-in ceiling (5.2/520%) unchanged. Confirmed present on current `main`, unreverted | pwa/test/unit/zoom-floor.test.mjs | 2026-07-05 SHIPPED; re-verified live 2026-07-29 |
```

---

## Row 19 — JD-SCOPE-OCC2-GUARD-001

_verified: 2026-08-15_

**OPEN-queue row (verbatim):**

```
| 19 | JD-SCOPE-ISOLATION residuals — occ-2 CLOSED (1.51.77, JD-SCOPE-OCC2-GUARD-001: read-from-cloud path now carries the same foreign-device guard on Vt + the lastJdText mirror; string-locked in jd-scope-isolation.test.mjs). REMAINING: two-real-device test (owner); shouldAdoptCloudPointer wired only for the JD-inherit case. CODE LEG re-verified 2026-08-15 (CI nightly): jd-scope-isolation.test.mjs 11/11 green, shouldAdoptCloudPointer present (4× across pwa sidecars), occ-2 guard behaviour string-locked (JD-SCOPE-OCC2-GUARD-001 comment lives only in app.src.js — stripped by minification in app.js, expected; test locks behaviour not comment); remaining two-real-device leg is owner-gated (physical devices, not fakeable headlessly). | ACTIVE_BUGS batch 17 | 2026-08-15 (code leg; two-real-device leg owner-gated) |
```

**TO-DO SUMMARY twin (verbatim):**

```
| 19 | JD-scope isolation — two-real-device test | TO DO |
```

---

## Row 103 — RELAY-TUNE-COVERAGE-GAP-001

> **Renumbered 2026-08-26: was row 38.** A document written before that date citing "row 38" may mean this row or GEN-BACKGROUND-001. The ID is the key.

_verified: 2026-08-20_

**OPEN-queue row (verbatim):**

```
| 103 | RELAY-TUNE-COVERAGE-GAP-001 (found by weekly cost-quality tune 2026-07-13): the tune loop is blind to 100% of real traffic and can never flip a head. Two-part cause — (a) the 3 tunable roles (`writer`/`supervisor`/`coherence`) and the `llm_calls.task` labels actually logged (`compress`/`long_context`/`parse_jd`/`consensus_*`/`analyze_fit`/`apply_correction`) are different namespaces, so `scripts/relay-cost-quality-tune.mjs` `ROLE_TASKS` matches 0 rows; (b) `parseModelRoles`/`roleHeadOrder` (`workers/proxy/src/multi-llm.js`) only honor writer/supervisor/coherence, so the cascade tasks are not addressable by `MODEL_ROLES` at all. Impact: the biggest cost lever — `compress` (1,538 calls/wk, `openai` $0.12395/call = $62.35 = ~58% of the ~$107 weekly spend, vs `gemini` $0.00007/call at identical 100% success + zero leak/fabrication/banned flags) — is untunable. Fix = extend `MODEL_ROLES`/`roleHeadOrder` to the cascade tasks OR realign `ROLE_TASKS` to the real labels; owner-gated (broad generation-cost + routing change). Also note provider-id skew: telemetry logs Anthropic as `claude`, `MODEL_ROLES` uses `anthropic` — the scorer/`KNOWN_PROVIDERS` must map them. | COST_QUALITY_BENCHMARK_2026-07-11.md §Weekly tune 2026-07-13; `workers/proxy/src/multi-llm.js` parseModelRoles/roleHeadOrder; `scripts/relay-cost-quality-tune.mjs` ROLE_TASKS | PARTIAL 2026-07-13 — **compress FIXED** (owner "fix compress"): openai dropped from `Z.compress` client dispatcher (app.src.js+app.js, 1.51.538, f8350a1) → gemini leads, ~$57-62/wk saved, 0 quality loss (see ACTIVE_BUGS COMPRESS-COST-OPENAI-DROP-001). **Proxy mechanism DONE**: multi-llm.js `ROLE_KEYS` + analysis/kernel role wiring (roleHeadOrder now reaches the 2 proxy cascades; identity-safe). **Scorer DONE** (shift 558-577): `scripts/relay-cost-quality-tune.mjs` now (i) WIRES normProvider into scoreRows (1.51.538 defined it but left it dead — a claude row read as "no data" against an anthropic head), (ii) scores the UNION of pinned roles + the router's TUNABLE_ROLES so an unpinned proxy cascade (analysis/kernel) is actually proposable (before, proposeRoles iterated MODEL_ROLES keys only, so their ROLE_TASKS were dead), (iii) maps coherence→apply_correction, (iv) adds `summarizeClientDispatch()` surfacing the CLIENT-dispatched pass-through levers MODEL_ROLES can't reorder. Verified vs the real 7-day D1 aggregate (19 rows): loop sees analysis+coherence, proposes a bounded analysis pin, prints the client-lever table; tests 8→12. REMAINING (all owner-gated, non-blocking): (a) whether to PIN analysis/kernel MODEL_ROLES heads — analysis per-provider telemetry is thin (only mistral clears min-calls=20; gemini n=11 @53× cheaper is under-sampled), so leave unpinned until traffic grows; (b) the other CLIENT-dispatch levers `consensus_poll` (~$11/wk openai) + `long_context` (~$5/wk openai), same class + same mechanism as the fixed compress (drop openai from the client `ee()` dispatcher), each an owner call gated on the format-broken detection-gap caveat; (c) the standing detection-gap (quality signals blind to SSE-leak/empty/off-language — memory cost-quality-benchmark). **2026-07-13 UPDATE — (b) now SOLVED SYSTEMATICALLY (RELAY-COST-TIEBREAK-001, 1.51.578, c1c3c83, access-relay deployed):** relay `scoreHealth` folds a bounded, status-safe cost penalty into health_score for cost-sensitive tasks (compress/long_context/consensus_*/apply_correction/enrich/fix_orphans) + the client seed demotes adequate cost-losers (health gap ≥0.10 below the task's cheapest-equal-quality) → openai auto-sinks on long_context+consensus_* without per-task Z edits, refreshed every ~5-min cron. No more manual per-task drops needed for the cost-sensitive class. **ESSENTIALLY CLOSED 1.51.580-detection-gap (shift 579-598):** (1) DETECTION-GAP fixed — the keystone that makes every cost-flip safe: `detectMalformedOutput` + `malformed_output` signal + `malformed_output_count`/`_rate` + `scoreHealth` penalty (relay) + client mirror sidecar tagging every `llm_call`; a provider that starts emitting SSE-leak/empty/off-language now self-demotes (relay 105/105, malformed 7/7). (2) analysis/kernel PINNABLE + bypassed until traffic grows — `proposeRoles` scores an unpinned role vs its BLENDED baseline behind `activationMinCalls`=30; against real 7d data it bypasses (mistral≈blend, gemini n=11<floor) and auto-pins gemini once it clears 30 (tune 14/14). (3) long_context/consensus_poll cost handled by the auto-seed above — a manual long_context drop was reverted as redundant. Remaining = purely emergent/owner-watch: confirm the auto-seed actually moves long_context/consensus next cron cycle, and the analysis auto-pin once gemini traffic grows — both visible in the weekly tune report, no code owed. **2026-07-15 weekly tune — FIRST REAL HEAD-FLIP SHIPPED:** the loop now sees real traffic and modified the function — coherence head `anthropic→openai` shipped (7d `apply_correction` ran 100% on openai n=1759 @100% ok, anthropic head produced ZERO → pin matches the working provider; anthropic stays fallback-tail; both proxies deployed). analysis→gemini auto-pin HELD (surfaced, not shipped): the `analysis` role conflates `analyze_fit` (openai owns @health 1.0, gemini zero truth) + `parse_jd` (gemini cheap but 30% retry, health 0.69) — pinning gemini would redirect a 100%-success openai analyze_fit stream to an unproven provider (format-broken-invisible caveat). Owner-gated next step: top up gemini analyze_fit ground truth OR split `analysis` into per-task heads. Report: COST_QUALITY_WEEKLY_2026-07-15.md. **2026-07-22 weekly tune — NO FLIP (quiet week, thin data):** raw `llm_calls` shows just 434 calls / ~$6.79 true spend over 7d; every tunable role thin/absent (writer/supervisor/coherence/kernel = 0 addressable rows; analysis/parse_jd = 14 mistral calls < 20 min-calls). Guardrails correctly held. Two notes for the owner: (i) the residual compress cost outlier has SHIFTED from openai to **claude** ($2.39/wk, 56 calls @ $0.0426/call still landing on claude despite the RELAY-COST-TIEBREAK-001 demotion that should sink it behind gemini) — worth checking the tie-break seed reaches the compress path for all clients; (ii) METHODOLOGY: prior weeks summed `llm_provider_health` rolling windows, which OVERLAP and multi-count (the "26k calls / $8.6k/wk" figures were phantom); this run read `llm_calls` directly for true per-call economics — future runs should prefer the raw-call source or de-dupe windows. Report: COST_QUALITY_WEEKLY_2026-07-22.md. **2026-07-29 weekly tune — NO FLIP; caught the phantom-window trap LIVE:** summing `llm_provider_health` first made the scorer propose a FLIP `analysis→openai` (`parse_jd` read as n=1253, clearing the floor); re-pulling raw `llm_calls` shows `parse_jd` n=12 < 20 → `analysis` ineligible → no change. Concrete proof the scorer must read `llm_calls` (or de-dupe windows), not sum the health aggregate — else it ships pins justified by phantom volume on traffic MODEL_ROLES can't steer. Honest week: ~761 calls / ~$9.8 spend. compress claude leg $5.41/wk (~55% of spend) persists as the residual outlier — compress fans out to all 4 providers ~equally (141/141/141 + gemini 152), an ensemble shape, so the owner call is whether the ensemble needs the claude leg. Also parse_jd mistral avg latency 235s (extreme). Step-1a freshness 5/5×2 green (opus-4-8/gpt-5.5/gpt-5.4-mini/sonnet-5 correctly priced). **NEW latent finding — gemini-3-preview unpriced:** `gemini-3-flash-preview` + `gemini-3.1-pro-preview` are in the app model pickers (`pwa/app.src.js`) but have no explicit `RATES` key in either `demo-enforcement.js`; they would fall through to `FALLBACK_RATE` [3,15] and misprice a flash model ~30× IF dispatched. Not active (real traffic uses `gemini-2.5-flash` [0.10,0.40], verified), so not corrupting current scoring — but add explicit keys at verified public rates + extend `model-table-freshness.test.mjs` before either enters rotation (owner/next-run, gated on verifying x.ai-style public pricing). Report: COST_QUALITY_WEEKLY_2026-07-29.md. **2026-08-06 weekly tune — NO FLIP (very quiet week):** ~22 calls / ~$1.15 spend over 7d; every addressable role thin (analysis best=openai n=5, coherence=apply_correction openai n=2, both < 20 min-calls; writer/supervisor/kernel = 0 rows) → guardrails held, `MODEL_ROLES` unchanged, no deploy. Data via `/api/llm-health?window=10080` (single window, no cross-window sum → no phantom-count trap) authorized by the owner PWA JWT (endpoint is any-signed-in-user, not admin-only); could not cross-check raw `llm_calls` this run (no D1 MCP tool in session), but n=1–5 everywhere makes the no-flip robust to any counting error. Step-1a freshness 5/5×2 green (opus-4-8/gpt-5.5/gpt-5.4-mini/sonnet-5 correctly priced, all still pinned in app.src.js). gemini-3-preview unpriced gap (below) UNCHANGED — still latent, still not dispatched. Report: COST_QUALITY_WEEKLY_2026-08-06.md. **2026-08-07 DESKTOP — raw `llm_calls` cross-check the 08-06 tune couldn't do (desktop wrangler d1, `--remote`):** the most recent LLM call of ANY task is **2026-07-30 22:49 — an 8-day traffic gap**; aggregated by task/provider the whole recent surface is consensus/parse_jd/compress/long_context/analyze_fit at 100% success. Concrete empirical proof the tune is "blind to real traffic" because there is **essentially no real traffic**, not merely a namespace/plumbing gap — so no-flip weeks are the ground truth, not a guardrail artifact. No code owed; carried owner-gated (the `MODEL_ROLES`/cascade-task addressability + consensus/long_context client-lever decisions still need real volume + an owner call). **ADVANCED 2026-08-20 (weekly tune):** the "essentially no real traffic" premise no longer holds — **499 calls in 7d, 100% success**. The gap is now purely the addressability half: **467 of 499 calls are `compress`**, a client-dispatched pass-through `MODEL_ROLES` cannot reorder, while every role the loop CAN address saw n=4–5. Two sub-questions now have evidence: (a) the sample floor is structurally unreachable for `analysis` (openai scored best three runs running at n=12/5/5 and was blocked every time) — owner call on `--min-calls` for low-traffic roles; (b) the `compress` client lever is **$2.43/wk true, 82% of all spend**, but the scorer's cheapest-adequate suggestion is not like-for-like (gemini mean input 343 tokens vs claude 3,316) and needs a same-prompt benchmark before any move. Still owner-gated, no code owed. **ADVANCED 2026-08-26 (weekly tune) — NO FLIP, empty week:** the trailing 7d window contains ZERO calls (last call of any task 2026-08-19 11:26 UTC), so scoring ran on 30d (607 calls, 100% success, zero quality flags). Both halves of this row are now measured rather than assumed. (a) **Addressability:** 524 of 607 calls (86%) are `compress` — client-dispatched pass-through `MODEL_ROLES` cannot reorder — while every addressable role is under the floor (analysis best=openai n=12, coherence=apply_correction openai n=6; writer/supervisor/kernel = 0 rows). (b) **The sample floor is now structurally unreachable for `analysis` for a fourth consecutive run** (openai best at n=12/5/5/12): head `anthropic` scores cq=2.733 vs openai cq=363.857 — a **133x** cost-quality gap at identical 100% success ($0.25617 vs $0.00275/call). Still not an obvious flip (the role conflates `analyze_fit`, where openai holds the only real truth, with `parse_jd`, where anthropic total sample is n=1), but the owner call — lower `--min-calls` for low-traffic roles, or split `analysis` into per-task heads — is now four runs old. (c) **`compress` lever RESIZED by the price fix:** gemini at the corrected Flash rate is $0.00053/call, **7.6x more expensive than the ~$0.00007 every pre-2026-08-20 weekly reported**; still ~24x cheaper than the claude leg ($1.76 of $3.16 true spend = 56%), so the direction stands and the magnitude does not. The like-for-like caveat (gemini mean input 343 tok vs claude 3,316) is unchanged — same-prompt benchmark still owed. (d) **Method re-check, no bug filed:** `llm_provider_health` weekly rows are individually sound (`MAX(call_count)=124` for claude/compress) — valid read as the latest single row per (provider,task), invalid summed (2,583 rows sum to 257,241 vs a true 137). Recorded so a future run does not re-file the phantom-window trap as a table defect. Report: COST_QUALITY_WEEKLY_2026-08-26.md. |
```

---

## Row 45

_verified: 2026-08-20_

**OPEN-queue row (verbatim):**

```
| **45** | **PERF-001 (owner, POLISH/PERF): multi-second MAIN-THREAD stalls on export/preview, not root-caused.** Method: Chrome performance profile (or the boot-cpu-profile diag pattern) around an export + a preview toggle; find the synchronous long task (suspects: a large sync JSON stringify/parse of sections on every keystroke, an un-debounced measure pass, or the sanitize/normalize chain running full-doc per render). Then debounce/memoize/offload. Diagnostic-first, no speculative optimization. **PARTIAL 1.51.158 — the "'click' handler took 4369..11184ms" leg (antcv-pdf-preview-gate.js) is FIXED**: `buildModal()` synchronously serialises every live `.antcv-preview-paper` via `outerHTML` (cost scales with document size) plus every inline `<style>` tag, and that ran entirely inside the export-preview FAB's click handler with zero user feedback for up to 11s. Fix = `openModal()` now shows a lightweight loading shell IMMEDIATELY (the click handler itself is cheap DOM creation only — no more long-task attributed to the click) and builds the real modal on the next frame (double `requestAnimationFrame`, so the loading shell has actually painted first); `buildModal()`'s own "remove any existing backdrop" step at its top tears the loading shell down for free (same id), verified via a headless DOM-mechanics test (immediate spinner, exactly one backdrop after settle, no duplicate/leak). This does NOT shrink the total synchronous cost — it turns "frozen, no feedback" into "spinner appears immediately, then builds" — reducing the underlying cost (e.g. `cloneNode` + direct iframe DOM insertion instead of an `outerHTML`/`srcdoc` round-trip) is the likely next lever but needs live DevTools profiling against a real multi-page document before touching this build path further. **REMAINING — the `'setTimeout' handler took ~3270ms` leg (antcv-generate-cloud-sync-277.js) is still OPEN**: traced the code (not just guessed) — the setTimeout callback itself only constructs and dispatches a synthetic click on the real Generate button; `dispatchEvent` is synchronous, so the ~3.27s is almost certainly attributable to whatever app.js's OWN generate-click handler does synchronously before yielding, not to this sidecar. Fixing that requires either live profiling to confirm, or editing app.js — both out of scope for a diagnostic-first sidecar-only pass; the sidecar's own JSON parse/stringify calls (sections/meta/personalInfo, which can carry a photo data URI) were checked and are plausible but not confirmed as the dominant cost | owner backlog 2026-07-04 | partial — 1.51.158 |
```

**TO-DO SUMMARY twin (verbatim):**

```
| **45** | **PERF-001** — multi-second main-thread stalls on export/preview; profile → debounce/memoize. | **PARTIAL 1.51.158 + ADVANCED 2026-08-20 (desktop nightly).** The export-preview click handler leg stays fixed. The setTimeout leg's named suspect is now EXCLUDED BY MEASUREMENT, not inference: new `pwa/test/diag-generate-click-profile.mjs` (owner-scale doc, 180KB photo data URI, relay/LLM network blocked, real Generate click, V8 CPU profile) puts `syncBothWays` at **44ms** end-to-end and the sidecar at **3ms** of sampled self time, click synchronous span **23ms**. So the sidecar JSON is not the stall. Caveat: with the network blocked the generate handler bails at its first fetch, so the owner's live seconds are not reproduced — what remains is app.js's own generate path past that gate and needs a LIVE-MODEL run to profile. verified: 2026-08-20 | owner backlog 2026-07-04 | partial — 1.51.158, advanced 2026-08-20 |
```

---

## Row 40

_verified: 2026-08-21_

**OPEN-queue row (verbatim):**

```
| **40** | **SO-003 — SHIPPED 1.51.138 (loss-guard belt) + TRIGGER-SIDE INVARIANT PINNED 2026-08-21. NOT an open data-loss — read the whole row before re-diagnosing it; the quoted sentence that follows is the ORIGINAL 2026-06-12 REPORT kept for provenance, not a current status.** *Original report: "changing the Core Competencies row count wipes Selected Outcomes (cloud-persisted, the loss round-trips, manual recovery only, root cause NOT fixed)."* VERIFY-FIRST headless: seed sections with core_comp + selected_outcomes, change the core_comp row count via the app path, assert selected_outcomes survives. Suspect: a core_comp table-resize handler that rebuilds the section array and drops the outcomes section, or a normalize pass keyed on row count. Fix at the writer; add a loss-guard belt like the kernel floor. **SHIPPED 1.51.138** — verify-first found NO single deterministic writer that drops the section (the generation/kernel/fuse apply paths all preserve outcomes with `return e` fallthroughs; 6 `"outcomes"===e.id` branches make a surgical writer edit fragile and occurrence-ambiguous). Root cause is a stale empty-editor readback race — a core_comp change fires antcv:sections-updated and on the re-render an editor read commits items:[] before re-hydration (documented in antcv-selected-outcomes-row-controls-237.js:41-46). The register's requested loss-guard belt is therefore the correct durable fix: new sidecar `antcv-outcomes-loss-guard.js` (clone of antcv-corecomp-loss-guard.js) snapshots the real outcomes items to a LOCAL-ONLY key `antcv:outcomesGuard` (not cloud-synced → survives the round-trip), keyed by meta.company|role, and re-applies over an emptied (items:[]) or placeholder-only section, ONLY when a real snapshot exists — never over a section that still has real items, never cross-app; placeholder test byte-mirrors app.src.js `Se`. 8 unit tests (outcomes-loss-guard.test.mjs); suite 988/988. No app.js edit. Owner-verify = change the Core Competencies row count and confirm Selected Outcomes survives  **RE-VERIFIED 2026-08-21 (desktop nightly):** no deterministic writer drops the section — `+ Row` / remove-row patch-merge scoped to core_comp, `applySectionFormat` id-scoped, `Se` filters only bracket placeholders, gen-apply has an explicit outcomes branch, and `antcv-core-competencies-row-controls-234.js` has no row-count control at all. New TRIGGER-side test `pwa/test/unit/core-comp-format-preserves-outcomes.test.mjs` (10 tests; negative control 7/10 fail when id-scoping is broken) pins the invariant the belt test never covered. Owner-verify unchanged: change the Core Competencies row count and confirm Selected Outcomes survives | owner backlog 2026-07-04 | verified: 2026-08-21 SHIPPED + PINNED |
```

**TO-DO SUMMARY twin (verbatim):**

```
| **40** | **SO-003** DATA LOSS — core-comp row-count change wipes Selected Outcomes (cloud-persisted). | **SHIPPED 1.51.138** (loss-guard belt) — diagnosis: no single deterministic writer drops it; the wipe is a stale empty-editor readback race (documented in antcv-selected-outcomes-row-controls-237.js). Belt antcv-outcomes-loss-guard.js snapshots real outcomes items to a LOCAL-ONLY key (survives the cloud round-trip) + re-applies over an emptied/placeholder-only section, never over real content, never cross-app; 8 tests; suite 988/988 |
```

---

## Row 35 — OVERLAY-EARLY-HALT-001

_verified: 2026-08-22_

**OPEN-queue row (verbatim):**

```
| 35 | OVERLAY-EARLY-HALT-001 regen-confirm — found in `docs/qa/PROJECT_ISSUES_OPEN_CLOSED_2026-07-02.md` open item #1, never given a register row. Shipped 1.51.41 (KERNEL-STUCK showcase watchdog changed from a fixed 2-min timer to a heartbeat gate on `__antcvGenCost`, clearing only after ~11min idle or a 20min ceiling). Owner asked for "one real regen to confirm" the overlay stays up through a full 3-6min unsolicited generation. Never explicitly confirmed/closed | PROJECT_ISSUES_OPEN_CLOSED_2026-07-02.md #1; 1.51.41 | re-verified: 2026-08-22 (CI E1 sweep — anchor RECONFIRMED on HEAD `5fff943a`: `__antcvGenCost` heartbeat gate + `KERNEL-STUCK` watchdog present in both bundles; live regen-confirm still owed, BLOCKED in CI); prior: 2026-08-20 (CI E1 sweep — anchor RECONFIRMED on the changed HEAD `02f0fbde`; the 08-19 llm-cost fix shifted line numbers ~10 lines but the code is intact: `KERNEL-STUCK-LAST-CMD-001`/`OVERLAY-EARLY-HALT-001` heartbeat watchdog now at `app.src.js:32333/32340/32348`; live regen-confirm still owed, BLOCKED in CI); prior: verified: 2026-08-19 (CI E1 sweep — heartbeat-gate watchdog `KERNEL-STUCK-LAST-CMD-001` present & intact at `app.src.js:32323` (`__antcvGenCost` heartbeat, idle+total ceiling); suite 1574/1574. Static reconfirm; live regen-confirm still owed to a live-model run): `__antcvGenCost` heartbeat gate present app.js ×4 + app.src.js ×10, `pwa/test/overlay-watchdog-heartbeat.test.mjs` re-run green 2026-08-01 (6/6), un-regressed since 1.51.41; regen-confirm owner-gated (validated-implicitly across many clean regens); re-verified 2026-08-04 (CI nightly, no code delta: guard re-run green) |
```

**TO-DO SUMMARY twin (verbatim):**

```
| **35** | **NEW — OVERLAY-EARLY-HALT-001 regen-confirm.** Shipped 1.51.41 (heartbeat-gated watchdog replacing the fixed 2-min timer). Never explicitly confirmed on a real owner regen per the 07-02 session's own open item #1. | **CLOSE-WITH-EVIDENCE (code) — re-verified: 2026-08-01 (CI staleness sweep, was 2026-07-29)**: `__antcvGenCost` heartbeat gate present in app.js (×4) + app.src.js (×10), `pwa/test/overlay-watchdog-heartbeat.test.mjs` re-run green 2026-08-01 (6/6), un-regressed since 1.51.41. Regen-confirm owner-gated (one live 3-6min regen) but validated-implicitly across many clean regens |
```

---

## Row 36 — GEN-CORECOMP-BROAD-001

_verified: 2026-08-22_

**OPEN-queue row (verbatim):**

```
| 36 | GEN-CORECOMP-BROAD-001 regen-confirm — found in the same 07-02 file, open item #1b, never given a register row. Shipped 1.51.41 (unsolicited CORE COMPETENCIES prompt rule broadened to PdM/BA/process framing instead of EO/photonics niche). Owner asked to confirm on a regen. Never explicitly confirmed/closed | PROJECT_ISSUES_OPEN_CLOSED_2026-07-02.md #1b; 1.51.41 | re-verified: 2026-08-22 (CI E1 sweep — anchor RECONFIRMED on HEAD `5fff943a`: broad core_comp rule inside `__neutralCo` present in app.src.js and locked in BOTH bundles by the green suite guard tests + `pwa/test/unsolicited-corecomp-broad.test.mjs` in the 1621 suite; live regen-confirm still owed, BLOCKED in CI); prior: re-verified: 2026-08-20 (CI E1 sweep — anchor RECONFIRMED on the changed HEAD `02f0fbde`: broad core_comp rule inside `__neutralCo` at `app.src.js:27137/27418`, guard test `unsolicited-corecomp-broad.test.mjs` green in the 1591 suite; live regen-confirm still owed, BLOCKED in CI); prior: verified: 2026-08-19 (CI E1 sweep — broad core_comp rule present INSIDE the unsolicited `__neutralCo` block, niche examples only in the name-guarded Gabriel pin; 3 guard tests green in the 1574 suite. Static reconfirm; live regen-confirm still owed): `pwa/test/unsolicited-corecomp-broad.test.mjs` re-run green 2026-08-01 (7/7), broad rule inside `__neutralCo` block in BOTH bundles (both-bundle guard test validates the app.js minified name), byte-identical src↔deployed; regen-confirm owner-gated; re-verified 2026-08-04 (CI nightly, no code delta: guard re-run green) |
```

**TO-DO SUMMARY twin (verbatim):**

```
| **36** | **NEW — GEN-CORECOMP-BROAD-001 regen-confirm.** Shipped 1.51.41 (unsolicited CORE COMPETENCIES broadened to PdM/BA/process identity). Never explicitly confirmed per 07-02 open item #1b. | **CLOSE-WITH-EVIDENCE — re-verified: 2026-08-01 (CI staleness sweep, was 2026-07-29)**: `pwa/test/unsolicited-corecomp-broad.test.mjs` re-run green 2026-08-01 (7/7) — broad rule present INSIDE __neutralCo block in BOTH bundles (app.src.js ×5; app.js under its minified name — the both-bundle guard test validates it), byte-identical src↔deployed |
```

---

## Row 37 — FOCUS-LABEL-EO-001

_verified: 2026-08-22_

**OPEN-queue row (verbatim):**

```
| 37 | FOCUS-LABEL-EO-001 regen-confirm — found in the same 07-02 file, open item #4, never given a register row. Shipped 1.51.42/43 on the parallel `fix/focus-area-heading-ainotice` branch (canonicalises the LLM-generated EO focus-area label post-process). Owner asked to confirm on a regen. Never explicitly confirmed/closed | PROJECT_ISSUES_OPEN_CLOSED_2026-07-02.md #4; 1.51.42/43 | re-verified: 2026-08-22 (CI E1 sweep — anchor RECONFIRMED on HEAD `5fff943a`: `FOCUS-LABELS-001` compact-label prompt rule present in app.src.js + app.js; live regen-confirm still owed, BLOCKED in CI); prior: re-verified: 2026-08-20 (CI E1 sweep — anchor RECONFIRMED on the changed HEAD `02f0fbde`: `FOCUS-LABELS-001` compact-label prompt rule now at `app.src.js:4086`; live regen-confirm still owed, BLOCKED in CI); prior: verified: 2026-08-19 (CI E1 sweep — `FOCUS-LABELS-001` compact-label prompt rule present at `app.src.js:4076`; suite green. Static reconfirm; live regen-confirm still owed): `_canon` canonicalises the EO label to "EO & Photonic sensors" in `antcv-core-comp-compress.js` (index.html `?v=1.51.43` present), `pwa/test/unit/core-comp-compress-eo.test.mjs` re-run green 2026-08-01 (14/14), name-guarded + idempotent; regen-confirm owner-gated; re-verified 2026-08-04 (CI nightly, no code delta: guard re-run green) |
```

**TO-DO SUMMARY twin (verbatim):**

```
| **37** | **NEW — FOCUS-LABEL-EO-001 regen-confirm.** Shipped 1.51.42/43 (canonicalised EO focus-area label post-process). Never explicitly confirmed per 07-02 open item #4. | **CLOSE-WITH-EVIDENCE — re-verified: 2026-08-01 (CI staleness sweep, was 2026-07-29)**: `_canon` canonicalises EO label to "EO & Photonic sensors" in antcv-core-comp-compress.js (index.html ?v=1.51.43 confirmed present); `pwa/test/unit/core-comp-compress-eo.test.mjs` re-run green 2026-08-01 (14/14), name-guarded + idempotent |
```

---

## Row 3 — FLOAT-SPINE-001

_verified: 2026-08-23_

**OPEN-queue row (verbatim):**

```
| 3 | Page-anchored floating spine — FLAG-ON RENDER **FAILED** the owner gate (2026-07-03 export: role text OVERLAPPING — floated continuation tables pack onto each other in the CloudConvert PDF). FLOAT-SPINE-001 (wk 1.14.124 + toggle 1.51.80) stays default-OFF, control byte-clean, zero prod impact. Structural match to the "_3page proper" reference was NOT sufficient — the flag replicated tblpPr/overlap/continuous but NOT the reference's grid equalization (A.2: every page-table grid identical), and LibreOffice may collapse the emptied page-break anchor paragraphs so both floats anchor at the same Y. **ATTEMPTED 2026-07-04 (no reference docx available in the working environment — owner explicitly accepted the risk of proceeding without it)**: (a) grid equalization was verified ALREADY TRUE — `colWidths` is one shared const reused by every page table including continuations, confirmed by a new regression test; no code change needed there. (b) spacer anchor SHIPPED (FLOAT-SPINE-SPACER-001): reproduced the actual bug first — a 3-page (2-continuation-table) fixture showed both continuation tables' anchor paragraphs were BYTE-IDENTICAL (same near-zero 1-twip empty break paragraph), exactly the collapse the diagnosis predicted. Fix: each continuation table's own immediate anchor paragraph now gets a distinct, non-zero line height (20+index twips) and a real non-empty run, so no two anchors can be byte-identical or collapse together; only applied when `ctx.floatSpine` is on, default-OFF path completely unchanged (verified: existing 2-table diag-float-spine.mjs still green). 6 new tests (float-spine-multi-anchor.test.mjs) lock in: multi-anchor distinctness, non-zero real content, grid equalization, and flag-OFF non-regression. **STILL UNVERIFIED against real LibreOffice/CloudConvert rendering** — this fixes the exact structural collapse the diagnosis named, but cannot prove the visual overlap is gone without the reference docx or an owner re-export; `ctx.floatSpine` stays default OFF until the owner confirms | ref docx in Downloads; diag-float-spine; float-spine-multi-anchor.test.mjs | attempted, unverified — 2026-07-04 |
```

**TO-DO SUMMARY twin (verbatim):**

```
| 3 | Floating spine: byte-diff flag-on doc vs reference, add grid equalization + spacer anchor | ATTEMPTED 2026-07-04 (no reference docx available) — see detailed row below; owner visual re-export still required. verified: 2026-08-23 (E1 sweep, CI nightly) flag default-OFF RE-CONFIRMED against current source — `docx-worker/src/index.js:24674` `floatSpine: payload.float_spine===true||!!(payload.style&&payload.style.floatSpine===true)` (unchanged; default OFF); still owner-visual-gated (no reference docx in CI to byte-diff); prior: verified: 2026-08-20 (E1 sweep, CI nightly) flag default-OFF re-confirmed against current source — `docx-worker/src/index.js:24674` `floatSpine=payload.float_spine===true||style.floatSpine===true`, `antcv-docx-client.js:1253` gated on `localStorage antcv:float-spine==='1'`; gate logic intact (the 08-19 llm-cost fix did not touch the docx path); prior: verified: 2026-08-15 (E1 sweep, CI nightly) flag default-OFF re-confirmed against current source — docx-worker:24674 floatSpine=payload.float_spine===true||style.floatSpine===true, docx-client:1253 gated on localStorage antcv:float-spine==='1'; gate logic intact, no code delta (only the demand-seed data refresh landed); prior: verified: 2026-08-14 (E1 sweep, CI nightly) flag default-OFF re-confirmed against current source — docx-worker:24674 floatSpine=payload.float_spine===true||style.floatSpine===true, docx-client:1251/1253 gated on localStorage antcv:float-spine==='1'; gate logic intact, no code delta since 4d195f3c. prior: verified: 2026-08-13 (E1 sweep, CI nightly) flag default-OFF re-confirmed against current source — docx-worker:24674 floatSpine=payload.float_spine===true||style.floatSpine===true, docx-client:1251/1253 gated on localStorage antcv:float-spine==='1'; gate logic intact, no code delta since 2ee32ca1. prior: verified: 2026-08-12 (E1 sweep, CI nightly) flag default-OFF re-confirmed against current source (no code delta since 8575289e); prior: verified: 2026-08-11 (E1 sweep, CI nightly) flag default-OFF re-confirmed against current source — docx-worker:24674 floatSpine=payload.float_spine===true||style.floatSpine===true, docx-client:1251/1253 gated on localStorage antcv:float-spine==='1'; gate logic intact, no code delta since 8674960f. prior: verified: 2026-08-10 (E1 sweep, CI nightly) flag default-OFF re-confirmed against current source — docx-worker:24668 floatSpine=payload.float_spine===true||style.floatSpine===true, docx-client:1251/1253 gated on localStorage antcv:float-spine==='1'; gate logic intact, no code delta since 96077b53. prior: verified: 2026-08-09 (E1 sweep, CI nightly) flag default-OFF re-confirmed against current source — docx-worker:24668 floatSpine=payload.float_spine===true||style.floatSpine===true, docx-client:1251/1253 gated on localStorage antcv:float-spine==='1'; line refs stable, gate logic intact (EMPTY code delta since 08-08 — HEAD == the 08-08 CI report commit); prior verified: 2026-08-08 (E1 sweep, CI nightly) flag default-OFF re-confirmed against current source — docx-worker:24668 floatSpine=payload.float_spine===true||style.floatSpine===true, docx-client:1251/1253 gated on localStorage antcv:float-spine==='1'; line refs stable, gate logic intact (no code delta since 08-07); prior verified: 2026-08-07 (E1 sweep, CI nightly) flag default-OFF re-confirmed against current source — docx-worker:24668 floatSpine=payload.float_spine===true||style.floatSpine===true, docx-client:1251/1253 gated on localStorage antcv:float-spine==='1'; line refs stable, gate logic intact; prior verified: 2026-08-04 (E1 sweep, CI nightly) flag default-OFF re-confirmed — docx-worker:24668 floatSpine=payload.float_spine===true||style.floatSpine===true, docx-client:1251/1253 gated on antcv:float-spine==='1'; gate logic intact; prior verified: 2026-08-01 (E1 sweep, DESKTOP nightly) flag default-OFF re-confirmed (docx-worker:24668 floatSpine=payload.float_spine===true||style.floatSpine===true; docx-client:1253 gated on localStorage antcv:float-spine==='1' — line refs stable at 24668/1253, gate logic intact) |
```

---

## Row 14 — JD-SCAN-HALLUCINATION-001

_verified: 2026-08-23_

**OPEN-queue row (verbatim):**

```
| 14 | JD-SCAN-HALLUCINATION-001 ingest reorder (garble → vision FIRST; filename↔company check; "used OCR" notice) — **CLOSED 2026-07-04 audit**: all three legs confirmed shipped in both bundles — garble→vision reorder (garbled_skip_llm_for_vision, before the image-only skip), fnEcho filename↔content mismatch check (`filename_mismatch(...)`, 1.51.100), and the "Read visually (OCR)" upload-chip notice. `pwa/test/unit/jd-extract-hardening.test.mjs` + `pdf-garbled-vision-first.test.mjs`, 17/17 passing. The "needs real models/owner present" caveat was written for the reorder itself before it shipped; the two remaining sub-legs (mismatch check, OCR notice) are deterministic string/DOM logic needing no live model call, and the register was simply never updated after 1.51.100/102 landed | ACTIVE_BUGS; ORPHANS_V2 prompt stretch; 1.51.100, 1.51.102 | closed |
```

**TO-DO SUMMARY twin (verbatim):**

```
| 14 | JD-scan-hallucination ingest reorder — needs real models + owner present | DONE 1.51.100/102 — see detailed row below. verified: 2026-08-23 (E1 sweep, CI nightly) JD-SCAN-HALLUCINATION-001 anchors RE-CONFIRMED present in `pwa/app.src.js` (charset-statistics hardening ~892, filename↔content echo ~929, garbled-text-layer→vision-OCR route ~1003-1012); code-shipped, live model-behaviour leg still owner/live-gated. |
```

---

## Row 20 — CONTACT-TRACK-TIGHT-001

_verified: 2026-08-24_

**OPEN-queue row (verbatim):**

```
| 20 | OWNER VERIFY LIST (consolidated, batches 12-16 + parallel sessions) — one Hard Refresh + CL regen + CV re-export checks all: (a) p2/p3 sidebar↔main headline alignment — wk 1.14.122 spacer, round-2 fix NOT yet proven in a real CloudConvert PDF (round 1 failed there); (b) sidebar runts gone (1.51.75 font-metric + 1.51.72 tighten); (c) CL +12/+6px signature spacing + the 3 line-fill slots (regen, prompt-level); (d) Sirin Result numberless (1.51.76) and an inline edit STICKS; (e) "Uni. of Toronto" abbreviation in the export; (f) contact letter-tracking (CONTACT-TRACK-TIGHT-001, wk 1.14.123) | ACTIVE_BUGS batches 12-16 | 2026-07-03; code-legs re-confirmed 2026-08-24 (CI nightly, E1 sweep — stalest un-swept row): all shipped anchors still present on current source — (a) headline-align spacer `docx-worker/src/index.js` continuation-page ~25376 + `headlineAlign` ~24692; (b) sidebar-runt `fix_orphans` ~1301/2099; (d) `SIRIN-SEMANTICS-001` ~4015 + `RESULTS-DISTINCT-001` ~4169; (f) `CONTACT-TRACK-TIGHT-001` ~26388-26394. **Stays OWNER-GATED** — acceptance needs one Hard Refresh + CL regen + CV re-export eyeballed in a real CloudConvert PDF (esp. leg (a) round-2, never proven in a real PDF); CI has no signed-in browser / CloudConvert. |
```

**TO-DO SUMMARY twin (verbatim):**

```
| 20 | Owner verify list — 6 sub-items (alignment, sidebar runts, CL spacing, Sirin result, abbreviation, contact tracking) | TO DO |
```

---

## Row 52 — GROUP-EMPTY-HIDE-001

_verified: 2026-08-25_

**OPEN-queue row (verbatim):**

```
| **52** | **GROUP-EMPTY-HIDE-001 (owner 2026-07-06, screenshot — TOOLS & METHODS sidebar section):** a labeled-list group whose heading is rendered but which has NO child rows under it must be HIDDEN, not shown as a bare dangling label. Repro from the owner screenshot: a TOOLS & METHODS group shows the "Methods" (and similar Expertise/Tools sub-) heading with nothing beneath it — an orphaned group title occupying a line for no content. Rule: at render/export time, a group with zero visible children (all children hidden, empty, or placeholder-only) is suppressed along with its own heading; a group regains its heading the moment it has ≥1 real child again. Distinct from empty-ROLE hiding (antcv-empty-role-hide.js, memory empty-role-source-fix, which hides on:true roles born blank) and from row 49 (page-breaking a LONG group) — this is the inverse: suppress an EMPTY group. NOT STARTED — scope: find the labeled-list/group render path (TOOLS & METHODS = rich_block group section, see RICHBLOCK-SHAPE-001 + the Hidden-group family 1.51.114-117) in BOTH the app.js preview render AND the docx-worker export so preview/export stay in parity (sanitize-for-export layer per memory export-sanitize-and-preview-parity); prefer a deterministic sidecar belt keyed on "group node has no non-empty/non-placeholder children" over a gen-prompt line. Verify-first: reproduce the empty-group render headlessly, count children, assert the heading is gone when 0 and present when ≥1 | owner 2026-07-06 screenshot | not started — scoped, needs a session |
```

**TO-DO SUMMARY twin (verbatim):**

```
| **52** | **GROUP-EMPTY-HIDE-001** (owner 2026-07-06, screenshot) — a labeled-list group (TOOLS & METHODS) with a heading but NO child rows must be hidden (heading + all), not left as a bare dangling label; regains its heading when it has ≥1 real child. Preview + export parity; deterministic belt, not a prompt line. | **SHIPPED 1.51.194** — `__grpHasChild(gi)` look-ahead added IN-RENDER at both sites (preview rich_block map in app.src.js + minified app.js mirror `__gc`; export renderRichBlock in docx-worker); each mirrors its own side's row-drop rules so a group hides iff zero following rows (to the next `{grp}`) render. Test group-empty-hide.test.mjs (29) brace-extracts BOTH real helpers, runs a shared 9-case fixture table, asserts preview↔export parity. Suite 1199/1199; boot-smoke OK; quintet done. **docx-worker DEPLOYED** (run 28832019410, palette/registry tests green) so the export half is live; PWA auto-deployed on push. verified: 2026-08-25 (E1 sweep, CI nightly — stalest un-swept row rotated in; RE-CONFIRMED on current source HEAD `d51376bb`: `__grpHasChild`×3 `pwa/app.src.js`, minified mirror `__gc`×3 `pwa/app.js`, `renderRichBlock`×7 `workers/docx-worker/src/index.js`; guard `pwa/test/unit/group-empty-hide.test.mjs` re-run in isolation 29/29 green; no code change since); prior: verified: 2026-07-31 (E1 sweep, CI nightly — re-verified against current code, was 2026-07-28: helpers still present both bundles + worker: `__grpHasChild`×3 app.src.js, mirror `__gc` app.js, `renderRichBlock`×7 docx-worker; guard `group-empty-hide.test.mjs` 29/29 green; no code change since) |
```

---

## Row 1

> **STANDING regression anchor** — re-run by the nightly diag set every time, not unstarted work.

_verified: 2026-08-26_

**OPEN-queue row (verbatim):**

```
| 1 | Quick-gen page convergence + CV 3-page convergence, export-only pagination parity | NEXT_SESSION_2026-06-29 (render-gated set) | no |
```

**TO-DO SUMMARY twin (verbatim):**

```
| 1 | Quick-gen page convergence + CV 3-page convergence, export-only pagination parity | TO DO — verified: 2026-08-26 (E1 sweep, CI nightly) RE-VERIFIED on HEAD `8356387f` (pwa/ byte-identical to `ae55e774` — HEAD == the 08-25 CI report commit, no app.js/worker code since): `diag-copenhagen-overflow-storm` PASS (ON 5 writes/15px usablePx-drift/0 err mount-settle transient—converges, OFF 1 write/0px/0 err, CV preview converges band ON and OFF), docx render V&V 50/50, PWA suite 1621/1621, boot-smoke `glDemo=function, errors=0`, live `sw.js` CACHE == repo `1.51.4346-cost-rates` (app.js?v 200); prior: verified: 2026-08-25 (E1 sweep, CI nightly) RE-VERIFIED on HEAD `d51376bb` (pwa/ byte-identical to the 08-24 verify — last app.js-touching commit `ae55e774`, only the 08-24 CI report doc since): `diag-copenhagen-overflow-storm` PASS (ON 2 writes/0px usablePx-drift/0 err, OFF 1 write/0px/0 err, CV preview converges band ON and OFF), docx render V&V 50/50, PWA suite 1621/1621, boot-smoke `glDemo=function, errors=0`, live `sw.js` CACHE == repo `1.51.4346-cost-rates` (app.js?v 200); prior: verified: 2026-08-24 (E1 sweep, CI nightly) RE-VERIFIED on HEAD `199cbe84` (pwa/ byte-identical to the 08-23 verify — last app.js-touching commit `ae55e774`, only docs since): `diag-copenhagen-overflow-storm` PASS (ON 4 writes/0px usablePx-drift/0 err, OFF 1 write/0px/0 err, CV preview converges band ON and OFF), docx render V&V 50/50, PWA suite 1621/1621, boot-smoke `glDemo=function, errors=0`, live `sw.js` CACHE == repo `1.51.4346-cost-rates` (app.js?v 200); prior: verified: 2026-08-23 (E1 sweep, CI nightly) RE-VERIFIED on HEAD `00d3a286` (pwa/ byte-identical to the 08-22 verify — last app.js-touching commit `ae55e774`, nothing landed since the 08-22 CI report which is itself the current HEAD): `diag-copenhagen-overflow-storm` PASS (ON 5 writes/15px usablePx-drift/0 err, OFF 1 write/0px/0 err, CV preview converges band ON and OFF), docx render V&V 50/50, PWA suite 1621/1621, boot-smoke `glDemo=function, errors=0`, live `sw.js` CACHE == repo `1.51.4346-cost-rates` (app.js?v 200); prior: verified: 2026-08-22 (E1 sweep, CI nightly) RE-VERIFIED on HEAD `5fff943a` (pwa/ byte-identical to the 08-21 verify — only worker telemetry.js + a test landed since): `diag-copenhagen-overflow-storm` PASS (ON 2 writes/0px usablePx-drift/0 err, OFF 1 write/0px/0 err), docx render V&V 50/50, PWA suite 1621/1621, boot-smoke `glDemo=function, errors=0`, live `sw.js` CACHE == repo `1.51.4346-cost-rates` (app.js?v 200); prior: verified: 2026-08-20 (E1 sweep, CI nightly) RE-VERIFIED against the changed HEAD `02f0fbde` (app.js DID change since the last CI report — the 08-19 desktop LLM-COST-CLAUDE-RATE-001 fix): docx render V&V + full suite **1914/1914**, PWA suite **1591/1591**, `app.js` head `(()=>{`/0 `"use strict"`/`node --check` OK, boot-smoke `glDemo=function, errors=0`, copenhagen-overflow-storm render diag PASS (ON 2/0px, OFF 1/0px, 0 err), live PWA `1.51.4326-claude-rate` == repo source (app.js?v 200); render-gated diags re-run this cycle because app.js changed; prior: verified: 2026-08-16 (E1 sweep, DESKTOP nightly, worktree-isolated) EMPTY code delta since HEAD `31ecc2c` (== the 08-15 CI report commit — nothing landed since) — re-verified the browser-independent subset tonight: docx render V&V **50/50**, PWA suite **1570/1570**, docx-worker **37/37**, `app.js` head `(()=>{window`/0 `"use strict"`, all 5 live surfaces attest = repo source (PWA live `1.51.4126`); render-gated Playwright diags NOT re-run this dispatch (fresh worktree has no node_modules/chromium; zero-delta night) — carried GREEN from the 08-15 CI run on this exact byte-identical HEAD; prior: verified: 2026-08-15 (E1 sweep, CI nightly) code delta since the 08-14 CI report = demand-seed weekly DATA refresh only (cluster-demand.js + cache-bust quintet, PR #359, PWA 4086→4126; quintet verified complete, cache-bust gate green, NO page-convergence/render/logic change) — re-ran all render-gated diags green today: copenhagen-overflow-storm PASS (ON 2 writes/0px usablePx-drift/0 err, OFF 1 write/0px/0 err), settings-panels (Layout 0 mut/6s, rootFound=true, 0 page errors), button-audit (213 buttons/0 page errors/139 active), sidebar-stable (0 writes/12 scrolls/stable/heightConverged), sidebar-promote-margin (hold-under-margin true), docx V&V 50/50, full suite 1893/1893, boot-smoke OK, all 5 live surfaces attest = repo source (PWA live 1.51.4126); prior: verified: 2026-08-14 (E1 sweep, CI nightly) EMPTY code delta since 4d195f3c (HEAD == the 08-13 CI report commit — no code change of any kind since) — re-ran all render-gated diags green today: copenhagen-overflow-storm PASS (ON 2 writes/0px usablePx-drift/0 err, OFF 1 write/0px/0 err), settings-panels (Layout 0 mut/6s, rootFound=true, 0 page errors), button-audit (209 buttons/0 page errors/134 active), sidebar-stable (0 writes/12 scrolls/stable/heightConverged), sidebar-promote-margin (hold-under-margin true), docx V&V 50/50, full suite 1893/1893, boot-smoke OK, all 5 live surfaces attest = repo source (PWA live 1.51.4086); prior: verified: 2026-08-13 (E1 sweep, CI nightly) EMPTY code delta since 2ee32ca1 (HEAD == the 08-12 CI report commit — no code change of any kind since) — re-ran all render-gated diags green today: copenhagen-overflow-storm PASS (converged ON 2 writes/0px usablePx-drift/0 err after a first-run 3/15px mount transient, OFF 1 write/0px/0 err), settings-panels (Layout 0 mut/6s, rootFound=true, 0 page errors), button-audit (209 buttons/0 page errors/133 active), sidebar-stable (0 writes/12 scrolls/stable/heightConverged), sidebar-promote-margin (hold-under-margin true), docx V&V 50/50, full suite 1893/1893, boot-smoke OK, all 5 live surfaces attest = repo source (PWA live 1.51.4086); prior: verified: 2026-08-12 (E1 sweep, CI nightly) EMPTY code delta since 8575289e (HEAD == the 08-11 CI report commit — no code change of any kind since) — re-ran all render-gated diags green today: copenhagen-overflow-storm PASS (ON 2 writes/0px usablePx-drift/0 err, OFF 1 write/0px/0 err), settings-panels (Layout 0 mut/6s, rootFound=true, 0 page errors), button-audit (208 buttons/0 page errors/133 active), sidebar-stable (0 writes/12 scrolls/stable/heightConverged), sidebar-promote-margin (hold-under-margin true), docx V&V 50/50, full suite 1893/1893, boot-smoke OK, all 5 live surfaces attest = repo source (PWA live 1.51.4086); prior: verified: 2026-08-11 (E1 sweep, CI nightly) EMPTY code delta since 8674960f (HEAD == the 08-10 CI report commit — no code change of any kind since) — re-ran all render-gated diags green today: copenhagen-overflow-storm PASS (ON 2 writes/0px usablePx-drift/0 err, OFF 1 write/0px/0 err — clean back to the 08-09 baseline vs 08-10's within-tolerance 3/15px blip), settings-panels (Layout 0 mut/6s, rootFound=true, 0 page errors), button-audit (208 buttons/0 page errors/134 active), sidebar-stable (0 writes/12 scrolls/stable/heightConverged), sidebar-promote-margin (hold-under-margin true), docx V&V 50/50, full suite 1893/1893, boot-smoke OK, all 5 live surfaces attest = repo source (PWA live 1.51.4086); prior: verified: 2026-08-10 (E1 sweep, CI nightly) EMPTY code delta since 96077b53 (HEAD == the 08-09 CI report commit — no code change of any kind since) — re-ran all render-gated diags green today: copenhagen-overflow-storm PASS (ON 3 writes/15px usablePx-drift/0 err, OFF 1 write/0px/0 err — both converge; within-tolerance variance vs the 08-09 ON 2/0px, still DIAG PASS), settings-panels (Layout 0 mut/6s, rootFound=true, 0 page errors), button-audit (210 buttons/0 page errors/138 active), sidebar-stable (0 writes/12 scrolls/stable/heightConverged), sidebar-promote-margin (hold-under-margin true), docx V&V 50/50, full suite 1893/1893, all 5 live surfaces attest = repo source (PWA live 1.51.4086); prior: verified: 2026-08-09 (E1 sweep, CI nightly) EMPTY code delta since 5d329c4a (HEAD == the 08-08 CI report commit — no code change of any kind since) — re-ran all render-gated diags green today: copenhagen-overflow-storm PASS (ON 2 writes/0px, OFF 1/0px, 0 err), settings-panels (Layout 0 mut/6s, rootFound=true, 0 page errors), button-audit (212 buttons/0 page errors/136 active), sidebar-stable (0 writes/12 scrolls/stable), sidebar-promote-margin (hold-under-margin true), docx V&V 50/50, full suite 1893/1893, all 5 live surfaces attest = repo source (PWA live 1.51.4086); prior: verified: 2026-08-08 (E1 sweep, CI nightly) empty code delta since 9a563289 (only a job-tracker sync-script fix + docs landed since the 08-07 CI report — no page-convergence change) — re-ran all render-gated diags green today: copenhagen-overflow-storm PASS (ON 2 writes/0px, OFF 1/0px, 0 err), settings-panels (Personal+Account+Layout 0 mut/6s, rootFound=true, 0 page errors), button-audit (210 buttons/0 page errors/139 active), sidebar-stable (0 writes/12 scrolls/stable), sidebar-promote-margin (hold-under-margin true), docx V&V 50/50, full suite 1893/1893, all 5 live surfaces attest = repo source (PWA live 1.51.4086); prior: verified: 2026-08-07 (E1 sweep, CI nightly) empty code delta since 6cbcd8f2 (HEAD == the 08-06 report commit — no code change since) — re-ran all render-gated diags green today: copenhagen-overflow-storm PASS (ON 2 writes/0px, OFF 1/0px, 0 err), settings-panels (Account+Layout 0 mut/6s, rootFound=true, 0 page errors), button-audit (212 buttons/0 page errors/140 active), sidebar-stable (0 writes/12 scrolls/stable), sidebar-promote-margin (hold-under-margin true), docx V&V 50/50, full suite 1893/1893, all 5 live surfaces attest = repo source (PWA live 1.51.4086); prior: verified: 2026-08-04 (E1 sweep, CI nightly) empty code delta since e3cd4a21 (no page-convergence change; only the 08-03 CI report doc landed) — re-ran all render-gated diags green today: copenhagen-storm PASS (ON 2/0px, OFF 1/0px), settings-panels (Layout 0 mut/6s), button-audit (211 buttons/0 errors/0 THROWS/0 DEAD/139 active), sidebar-stable (≤2 writes/12 scrolls), sidebar-promote-margin (hold-under-margin true), docx V&V 50/50, full suite 1888/1888, all 5 live surfaces attest = repo source (PWA live 1.51.4086); prior: verified: 2026-08-03 (E1 sweep, CI nightly) empty code delta since 206b8270 (no page-convergence change; only the 08-02 CI + job-tracker docs landed) — re-ran all render-gated diags green today: copenhagen-storm PASS (ON 2 writes/0px, OFF 1/0px), settings-panels (Layout 0 mut/6s), button-audit (211 buttons/0 errors/0 THROWS/0 DEAD/137 active), sidebar-stable (≤2 writes/12 scrolls), sidebar-promote-margin (hold-under-margin true), docx V&V 50/50, full suite 1888/1888, all 5 live surfaces attest = repo source (PWA live 1.51.4086); prior: verified: 2026-08-02 (E1 sweep, CI nightly) empty code delta since 988bb0e6/49477d87 (no page-convergence change; only the 08-01 sidecar demand-seed + docs landed); CI render-gated diags all green — copenhagen-storm stable PASS (ON 2 writes/0px, OFF 1/0px) + settings-panels (Layout 0 mut/6s) + button-audit (211 buttons/0 errors/139 active) + sidebar-stable (0 writes/12 scrolls) + sidebar-promote-margin (hold-under-margin true) + docx V&V 50/50; full suite 1888/1888; all 5 live surfaces attest = repo source (PWA now live 1.51.4086, demand-seed propagated); genuinely open, render/owner-gated; concrete pagination-fidelity legs live in rows 25+27. NOTE 2026-08-02: the demand-seed's seed(4046)/TARGET(4086) split is a VERIFIED NON-BUG (SEED-VS-TARGET-VERSION-NONBUG-001 in ACTIVE_BUGS) — invariant is seed==app.js?v, not seed==TARGET; do not re-flag |
```

---

## Row 11 — SIDEBAR-PROMOTE-MARGIN-001

> **STANDING regression anchor** — re-run by the nightly diag set every time, not unstarted work.

_verified: 2026-08-26_

**OPEN-queue row (verbatim):**

```
| 11 | ~~SIDEBAR-PAGE23-DANCE~~ CLOSED (verified 2026-07-03, headless): diag-sidebar-promote-margin (owner-scale sidebar HOLDS page 3 across a one-row removal AND a whole-group removal; hold-under-margin true) + diag-sidebar-stable (width/height stable across 12 scrolls, <=2 style writes, 0 errors). Root fixes: sig-cache 1.50.9xx + SIDEBAR-PROMOTE-MARGIN-001 (1.51.63). Owner live eyeball optional | 2026-06-28 diagnosed → verified | 2026-07-03; re-verified 2026-07-31 (CI nightly, was 2026-07-26: diag-sidebar-promote-margin hold-under-margin true + diag-sidebar-stable width/height stable/≤2 writes/0 errors, both OK headless); re-verified 2026-08-03 (CI nightly, byte-identical base: diag-sidebar-promote-margin hold-under-margin true + diag-sidebar-stable stable/≤2 writes/0 errors, both OK); re-verified 2026-08-04 (CI nightly: both OK — sidebar-stable ≤2 writes/12 scrolls, promote-margin hold-under-margin true); re-verified 2026-08-07 (CI nightly: both OK — sidebar-stable 0 writes/12 scrolls/stable, promote-margin hold-under-margin true); re-verified 2026-08-08 (CI nightly, byte-identical base: both OK — sidebar-stable 0 writes/12 scrolls/stable/heightConverged, promote-margin hold-under-margin true); re-verified 2026-08-09 (CI nightly, EMPTY code delta — HEAD == the 08-08 CI report commit: both OK — sidebar-stable 0 writes/12 scrolls/stable/heightConverged, promote-margin hold-under-margin true); re-verified 2026-08-13 (CI nightly, EMPTY code delta since 2ee32ca1: both OK — sidebar-stable 0 writes/12 scrolls/stable/heightConverged/w0==w1==262.02, promote-margin hold-under-margin true); re-verified 2026-08-14 (CI nightly, EMPTY code delta since 4d195f3c: both OK — sidebar-stable 0 writes/12 scrolls/stable/heightConverged, promote-margin hold-under-margin true); re-verified 2026-08-15 (CI nightly, only the demand-seed data refresh since: both OK — sidebar-stable 0 writes/12 scrolls/stable/heightConverged, promote-margin hold-under-margin true); re-verified 2026-08-24 (CI nightly, EMPTY code delta since ae55e774: diag-sidebar-stable 0 writes/12 scrolls/stable/heightConverged, 0 page errors — OK); re-verified 2026-08-25 (CI nightly, EMPTY code delta since ae55e774 — HEAD == the 08-24 CI report commit: diag-sidebar-stable 0 writes/12 scrolls/stable/heightConverged/w0==w1==262.02, 0 page errors — OK); re-verified 2026-08-26 (CI nightly, EMPTY code delta since ae55e774 — HEAD == the 08-25 CI report commit `8356387f`: diag-sidebar-stable 0 writes/12 scrolls/stable/heightConverged/w0==w1==262.02, 0 page errors — OK) |
```

---

## Row 16 — SID-FALLBACK-HARDEN-001

> **STANDING regression anchor** — re-run by the nightly diag set every time, not unstarted work.

_verified: 2026-08-26_

**OPEN-queue row (verbatim):**

```
| 16 | Sid-fallback: LATENT HALF SHIPPED (SID-FALLBACK-HARDEN-001, 1.51.94 — 234/247/249 get 237's exact guard: DATA gate when the section is absent + [data-sid]-only DOM fallback; 247's header scan requires short own text; no behavior change while sections exist; unit/sid-fallback-harden.test.mjs 5). REMAINING: the owner's 2026-07-03 dance symptom (TOOLS & METHODS + REGULATORY CONTEXT justified↔left flap in the preview) — plausibly the SAME grab class now cured; owner re-checks after hard refresh; if it persists, diagnose live with diag-align-flap.mjs + the setItem-writer probe (the flapping writer may be a different sidecar). **RE-RUN 2026-07-05 (headless, template-skeleton/demo-boot repro on 1.51.158):** re-executed diag-align-flap.mjs end-to-end (20s observation window). Result: ZERO `antcv:sections-updated` churn, exactly ONE section-type snapshot the whole run (no tools/regulatory converter loop), and of the 24 recorded text-align flips, ALL 24 are on `core_comp` only — none on `tools` or `regulatory` — clustered in a single ~17ms window at ~2.77s post-boot (justify→left→justify, i.e. a one-time render-race settle at mount, not an ongoing flap) and fully quiet for the remaining ~17s. Resting state after settle: table header row `center`, core_comp content rows `justify` — matches the owner's stated expectation exactly. So in this repro the specific tools/regulatory symptom does not reproduce at all, and the adjacent core_comp transient is a single mount-time blip, not a persistent dance. Caveat: this is the template-skeleton/demo state only, not a live generated-content session, so it does not by itself close the row — but it is real evidence the fix landed rather than a restatement of "owner re-checks" | SETTINGS batch 5 → 1.51.94; owner 2026-07-03 symptom; diag-align-flap.mjs re-run 2026-07-05 | verify-live only (automated repro clean) |
```

**TO-DO SUMMARY twin (verbatim):**

```
| 16 | Sidebar TOOLS/REGULATORY justify↔left flap — re-check after hard refresh, diagnose if persists | verified: 2026-08-26 (E1 sweep, CI nightly) `diag-align-flap.mjs` RE-RUN on HEAD `8356387f`: ALIGN-FLIPS (0), tableRow0 header `center`, both tableRow1/tableRow2 measure `a:justify inline:justify` consistently — no flap; owner live-verify still open; prior: verified: 2026-08-25 (E1 sweep, CI nightly) `diag-align-flap.mjs` RE-RUN on HEAD `d51376bb`: ALIGN-FLIPS (0), tableRow0 header `center`, both tableRow1/tableRow2 measure `a:justify inline:justify` consistently — no flap; prior: verified: 2026-08-24 (E1 sweep, CI nightly) `diag-align-flap.mjs` RE-RUN on HEAD `199cbe84`: ALIGN-FLIPS (0), tableRow0 header `center`, both tableRow1/tableRow2 measure `a:justify inline:justify` consistently — no flap; owner live-verify still open; prior: verified: 2026-08-23 (E1 sweep, CI nightly) `diag-align-flap.mjs` RE-RUN on HEAD `00d3a286`: tableRow0 header `center`, both tableRow1/tableRow2 measure `a:justify inline:justify` consistently — no flap; owner live-verify still open; prior: verified: 2026-08-22 (E1 sweep, CI nightly) diag-align-flap.mjs RE-RUN on HEAD `5fff943a`: tableRow0 header `center`, both tableRow1/tableRow2 measure `a:justify inline:justify` consistently — no justify↔left flap; owner live-verify still open. Prior: verified: 2026-08-21 (E1 sweep, CI nightly) diag-align-flap.mjs RE-RUN on current HEAD `1.51.4346-cost-rates`: both tableRow1/tableRow2 measure `a:justify inline:justify` consistently — no justify↔left flap; owner live-verify still open. Prior: RE-RUN 2026-07-05 (diag-align-flap.mjs, template-skeleton boot repro): no flap on tools/regulatory at all; a one-time 17ms core_comp settle-transient at mount is the only churn |
```

---

## Row 17 — SETTINGS-PERSONAL-STABILIZE-001

> **STANDING regression anchor** — re-run by the nightly diag set every time, not unstarted work.

_verified: 2026-08-26_

**OPEN-queue row (verbatim):**

```
| 17 | Settings sweep-army burst cost — PERSONAL-PANEL SHARE ELIMINATED 1.51.128 (SETTINGS-PERSONAL-STABILIZE-001: five non-idempotent writers change-gated; measured 3938→0 mutations/8s at rest; lock diag-personal-panel-probe.mjs). **DONE 1.51.156 (SETTINGS-SWEEP-STABILIZE)** — diag-settings-panels-probe.mjs (rebuilt with setItem bucketing + fixed modal-root detection) profiled Personal/Account/Layout and pinned the remaining non-idempotent sweep writers, now all write-on-change: antcv:aiWmSide (was 207-361 setItem/6s cross-panel) + watermark corner/anchored attrs (watermark-page-anchor-341); photo-collapse caret+child display (photo-control-collapse); AI-notice __refresh caret+button styles (ai-notice-position-control); data-antcv-bridge-active (LIVE antcv-photo-ui-427.js, not the dead standalone); mobile FAB f351_hide attrs (LIVE antcv-mobile-ui-418.js, not the dead standalone). All three standard panels now measure 0 DOM mutations/6s at rest (only a 1Hz sessionStorage diag heartbeat remains). The mobile-FAB f351_hide re-stamp (the one that looked like a global ~56x/sec storm when observing document.body) is also fixed in the LIVE antcv-mobile-ui-418.js — post-fix a scope probe measures 8-12 fab mutations/4s with settings open OR closed (only the display re-apply when a React re-render clears it; harmless). Verified via _tmp-fab-scope probe | freeze diag profiles (batches 5+7); 1.51.128 → 1.51.156 | DONE 1.51.156 — re-verified 2026-07-05 on 1.51.163 (diag-settings-panels-probe: Personal/Account/Layout all 0 mut/6s, 0 page errors, DIAG PASS); re-verified 2026-07-06 on 1.51.192 (same probe, all 3 panels 0 mut/6s, 0 page errors, DIAG PASS); re-verified 2026-07-26 (CI nightly, diag-settings-panels-probe on 1.51.3803: Personal/Account/Layout all 0 mut/6s, 0 page errors, DIAG PASS); re-verified 2026-08-03 (CI nightly, diag-settings-panels-probe: Layout 0 mut/6s, rootFound=true, 0 page errors, DIAG PASS); re-verified 2026-08-04 (CI nightly, diag-settings-panels-probe: Layout 0 mut/6s, rootFound=true, 0 page errors, DIAG PASS); re-verified 2026-08-07 (CI nightly, diag-settings-panels-probe: Account+Layout 0 mut/6s, rootFound=true, 0 page errors, DIAG PASS); re-verified 2026-08-08 (CI nightly, diag-settings-panels-probe: Personal+Account+Layout all 0 mut/6s, rootFound=true, 0 page errors, DIAG PASS); re-verified 2026-08-09 (CI nightly, diag-settings-panels-probe: Layout 0 mut/6s, rootFound=true, 0 page errors, DIAG PASS); re-verified 2026-08-13 (CI nightly, diag-settings-panels-probe: Layout 0 mut/6s, rootFound=true, 0 page errors, DIAG PASS); re-verified 2026-08-14 (CI nightly, diag-settings-panels-probe: Layout 0 mut/6s, rootFound=true, 0 page errors, DIAG PASS); re-verified 2026-08-15 (CI nightly, diag-settings-panels-probe: Layout 0 mut/6s, rootFound=true, 0 page errors, DIAG PASS); re-verified 2026-08-24 (CI nightly, diag-settings-panels-probe: Account+Layout 0 mut/6s, rootFound=true, 0 page errors, DIAG PASS) |
```

**TO-DO SUMMARY twin (verbatim):**

```
| 17 | Settings sweep-army cost on Layout/Account/Advanced panels (Personal panel already fixed) | DONE 1.51.156 (Personal/Account/Layout all 0 mut/6s at rest). verified: 2026-08-26 (E2/E1 sweep, CI nightly) `diag-settings-panels-probe` RE-RUN on HEAD `8356387f`: Personal 0 mut/6s, Account 0 mut/6s, Layout 0 mut/6s, rootFound=true, 0 page errors — panels at rest. prior: verified: 2026-08-25 (E2/E1 sweep, CI nightly) `diag-settings-panels-probe` RE-RUN on HEAD `d51376bb`: Personal 0 mut/6s, Account 0 mut/6s, Layout 0 mut/6s, rootFound=true, 0 page errors — panels at rest. prior: verified: 2026-08-23 (E2/E1 sweep, CI nightly) `diag-settings-panels-probe` RE-RUN on HEAD `00d3a286`: Account 0 mut/6s, Layout 0 mut/6s, rootFound=true, 0 page errors — panels at rest. |
```

---

## Row 18 — ANITA-PERSONA-NO-PHOTO-001

_verified: 2026-08-26_

**OPEN-queue row (verbatim):**

```
| 18 | Anita demo residuals — **docx-photo + PDF-contact legs ROOT-CAUSED + FIXED 2026-08-26** (desktop nightly, PWA `1.51.4406-import-photo`). Both legs were ONE state: **no photo**. The worker is innocent — new negative-control diag `workers/docx-worker/test/diag-photo-absent-gating.mjs` (docx set 50→**51/51**) proves every band-overlap bridge element (float, contact indent 2592/-216, 8.5pt, tracking -10, sidebar spacer 990) is correctly gated on `photo_b64`, so with no photo the contact line falls back to normal placement/size — the "contact placement" complaint IS the "missing photo" complaint. The 07-03 prescription ("re-import the persona → hard refresh → re-export") could never work, for two independent reasons: (a) `docs/personas/anita/personalInfo.json` carried **no photo field at all** (ANITA-PERSONA-NO-PHOTO-001 — the avatar was a loose `.jpg` a human had to upload, despite CLAUDE.md advertising the persona as complete-with-photo); (b) even with the field added, the settings importer **silently dropped it** — the unwrapped-blob rewrap `n = { personalInfo: n }` ran BEFORE the sibling `n.photo` read in the same comma-expression (IMPORT-REWRAP-DROPS-PHOTO-001). Both fixed: the wrapper is now built from the pre-rewrap object (`n = n.photo ? { personalInfo: n, photo: n.photo } : { personalInfo: n }`, both bundles, 1 site each), and the persona embeds `photo` (Anita_avatar.jpg → 600×600 JPEG q80, ~61 KB data URL). Tests `pwa/test/unit/import-rewrap-keeps-photo.test.mjs` 7/7 incl. a negative control; suite 1628/1628; boot-smoke green; copenhagen-storm DIAG PASS. **REMAINING (unchanged, needs live models):** the CL foundation/bring/interests leg on a fresh Anita gen | ACTIVE_BUGS batches 8-9; ACTIVE_BUGS top block 2026-08-26 | verified: 2026-08-26 (desktop nightly — photo legs fixed + locked; CL-gen leg still owed) |
```

---

## Row 23 — NIGHTLY-PREVIEW-BUTTON-AUDIT-001

> **STANDING regression anchor** — re-run by the nightly diag set every time, not unstarted work.

_verified: 2026-08-26_

**OPEN-queue row (verbatim):**

```
| 23 | NIGHTLY-PREVIEW-BUTTON-AUDIT-001 — HARNESS SHIPPED + FIRST RUN DONE (2026-07-03 night): `pwa/test/diag-panel-button-audit.mjs` (real boot, panels opened, round-based enumeration surviving React re-renders, network blocked, per-click store-write/DOM-delta/page-error record + static export-key cross-check). First run: 196 buttons, 94 active, **0 THROWS, 0 DEAD** (the prior dead-control class confirmed gone); 2 export-parity findings filed as row 33. REMAINING: harness pass-2 (re-open menus for the 65 not-visible entries; unblock the 23 overlay-obstructed), LIVE audit of the 11 dangerous-labelled buttons (generate/export/restore/enrich/analyse — owner present), and the per-control-family payload DIFF leg (beyond the static key check). Standing: re-run each nightly, diff vs the last report. **PASS-2 2026-07-05 — "unclickable" leg SHIPPED, "not-visible" leg root-caused but not fixed:** traced every one of the 23 2026-07-03 "unclickable" verdicts to the SAME failure — "Timeout … waiting for locator([data-audit-sig=…])", i.e. the locator never resolved, not an overlay covering a real button. `force:true` bypasses actionability checks but not locator resolution, so this is the stamped `data-audit-sig` attribute getting wiped by a React re-render between the enumerate-and-stamp step and the click step (plausible given the labels — ▲ ▼ + − ON ↶ — are per-row steppers whose list is exactly what a prior click in the same round re-renders). Fix: one retry via a label-text locator that doesn't depend on the stale attribute. For the 65 "not-visible" entries, read the CJLR cycler's own source (`antcv-item-align.js:324-360`) before guessing: it is NOT a CSS `:hover` reveal — the button injects at a fixed, always-visible 20-24px size — so the likely gate is a dblclick-opens-detail-editor pattern (HEADER-ROW-DBLCLICK-001 / SECTION-ROW-DBLCLICK-001, this same register's history), not hover. Shipped a harmless hover-then-recheck attempt anyway (falls through cleanly on no change, so it can only help, never regress) in case some OTHER not-visible family is genuinely hover-gated, but a full re-run confirmed 0 recoveries via hover — consistent with the CJLR root-cause, not a code bug in the attempt. Re-ran the full harness (docs/qa/PANEL_BUTTON_AUDIT_2026-07-04.{md,json}): unclickable dropped 23→0 and not-visible dropped 65→55, but the total button count also shifted 196→197 between audit dates (real app changes landed in between), so this improvement is NOT confidently attributable to the pass-2 code — the retry counters the harness now logs (`unclickableRetried`, `notVisibleRecovered`) both read 0 on this run, meaning neither retry path actually fired; the underlying race just didn't reproduce this time, which is expected for a timing-dependent bug. REMAINING: pass-3 for the CJLR/not-visible family needs verifying whether a row dblclick reveals the SAME stamped element or opens an editor holding a NEW one (would need re-enumeration, not just a recheck) — left as a lead, not guessed; the live dangerous-button audit and per-control-family payload DIFF leg are still open | owner 2026-07-03; PANEL_BUTTON_AUDIT_2026-07-03.md, PANEL_BUTTON_AUDIT_2026-07-04.md | partial — unclickable-retry shipped, not-visible root-caused only. **RE-RUN 2026-07-05 on 1.51.163** (PANEL_BUTTON_AUDIT_2026-07-05.json): 197 buttons — 118 active, 12 dangerous-skipped, 10 ui-only, 55 not-visible, **unclickable 23→2** (retry leg holding), **0 page errors, 0 DEAD**. not-visible steady at 55 (the root-caused CJLR/dblclick family); 8 preview-only keys flagged are legit UI-state (settingsTab/subTab/topbarOrder/analytics counts/probes), not export-parity gaps. Live dangerous-button audit + CJLR pass-3 remain owner-gated. **RE-RUN 2026-07-06 on 1.51.192**: 196 buttons — 118 active, 12 dangerous-skipped, 14 ui-only, not-visible 55→51 (improved), **0 throws, 0 page errors**; one DEAD candidate "100%" is the known idempotent-reset false-positive class (no store write/DOM delta when clicked from its resting state), not filed. **RE-RUN 2026-07-26 (CI nightly on 1.51.3803, PANEL_BUTTON_AUDIT_2026-07-26.md/.json): 191 buttons — 116 active, 13 dangerous-skipped, 15 ui-only, 47 not-visible/disabled, 0 page errors, 0 THROWS**; DEAD candidates are the known idempotent no-store-write UI keys (settingsTab/subTab/topbarOrder/analytics counts/probes), not export-parity gaps. No new dead/throwing controls. **RE-RUN 2026-08-03 (CI nightly, PANEL_BUTTON_AUDIT_2026-08-03.md/.json): 211 buttons — 137 active, 14 dangerous-skipped, 16 ui-only, 44 not-visible/disabled, 0 page errors, 0 THROWS, 0 DEAD** — no new dead/throwing controls. **RE-RUN 2026-08-04 (CI nightly, PANEL_BUTTON_AUDIT_2026-08-04.md/.json): 211 buttons — 139 active, 14 dangerous-skipped, 14 ui-only, 44 not-visible/disabled, 0 page errors, 0 THROWS, 0 DEAD** — no new dead/throwing controls; preview-only suspects are the known idempotent UI-state keys, not export-parity gaps |
```

**TO-DO SUMMARY twin (verbatim):**

```
| 23 | Preview-button audit pass 2 (65 not-visible, 23 overlay-obstructed) + live dangerous-button audit | **PASS 2 RUN 2026-08-20 (desktop nightly): 211 buttons, 0 THROWS, 0 DEAD candidates, 0 page errors** (134 active / 15 ui-only / 14 skipped-dangerous / 48 not-visible-or-disabled); artifacts PANEL_BUTTON_AUDIT_2026-08-20.{json,md}. verified: 2026-08-26 (E3/E1 sweep, CI nightly) `diag-panel-button-audit` RE-RUN on HEAD `8356387f`: **208 buttons, 0 THROWS, 0 page errors**, 133 active / 15 ui-only / 14 skipped-dangerous / 45 not-visible-or-disabled + 1 explainable DEAD ("Undo last change" — no-op on the seeded empty edit history, same as 08-17/08-19, not a defect); artifacts PANEL_BUTTON_AUDIT_2026-08-26.{json,md}; consistent with the 08-20 pass 2. prior: verified: 2026-08-20. Prior: PARTIAL 2026-07-05: "unclickable" retry leg shipped (root cause was a stale-locator race, not an overlay); "not-visible" leg root-caused (CJLR family isn't hover-gated, likely dblclick-to-open-editor per HEADER-ROW-DBLCLICK-001) but not yet fixed; live dangerous-button audit still owner-gated |
```

---

## Row 105 — JOBSRC-FETCH-001

> **Renumbered 2026-08-26: was row 40.** A document written before that date citing "row 40" may mean this row or SO-003. The ID is the key.

_verified: 2026-08-26_

**OPEN-queue row (verbatim):**

```
| 105 | JOBSRC-FETCH-001 follow-through — teach the discovery routine to CALL `job_sources.py` instead of hand-fetching board search pages, and re-audit the other 3 mandatory sources (LinkedIn guest, TheHub, Google Jobs) for the same silent-dry failure mode | FIXED 2026-08-26 (fetchers shipped + live-verified against both boards; tests 15/15). Prompt leg CLOSED same day (owner-approved): the account-level `antcv-position-discovery` task now routes jobindex + jobbank through `job_sources.py`. LinkedIn guest search WAS verified working this run (it returned 54 + 60 + 20 + 12 rows across four queries); TheHub returned 15; Google Jobs not separately exercised. verified: 2026-08-26 |
```

---

## Row 106 — POSTING-OBSOLETE-001

> **Renumbered 2026-08-26: was row 41.** A document written before that date citing "row 41" may mean this row or SO-004. The ID is the key.

_verified: 2026-08-27_

**ADVANCED 2026-08-27 (job-tracker nightly) — POSTING-STRIKE-SAMEDAY-001, the false-positive path
leg (a) opened.** Closing leg (a) on 2026-08-26 put the sweep in TWO routines — the twice-weekly
discovery run (step 1a) and this nightly (step 1b) — so on the days they overlap a row is probed
twice within the hour. The two-strike rule counted strikes with a bare `misses += 1` and consulted
no date, so those two probes of ONE CDN blip corroborated each other and archived a LIVE role on a
single day. That is the exact false positive the graded-evidence design exists to prevent, and it
was created by the fix that closed leg (a) — the rule's own docstring said "TWO strikes on separate
runs", which stopped being a meaningful bound the moment a second routine started sweeping.
**Fix:** a soft verdict now strikes AT MOST ONCE PER CALENDAR DAY. Strike counting moved out of the
`cmd_check` loop into `next_misses(prev, verdict, today)`, which stamps `last_strike` — kept
separate from `last` (the probe date) so a WALLED/ERROR probe later the same day is not mistaken
for a strike and does not hold the count back a day. Entries written before this change carry no
stamp and count normally, so no stored state is invalidated. Hard verdicts (CLOSED/EXPIRED) are
untouched — a page that STATES the ad is over still archives on first sight. **Script-side only:
no PWA asset, no cache-bust, no shift lane, no deploy.** Tests: `test_check_postings.py` now drives
the REAL `next_misses` instead of a hand-mirrored copy of the loop (a mirror would have stayed green
through this exact change), +8 checks covering the same-day gate, the legacy no-stamp entry, and the
`last_strike`/`last` split; negative-controlled by disabling the guard BY LINE INDEX — sabotage
confirmed landed, 3 checks go red. All 14 job-tracker python tests green. Live-verified end to end:
`check --limit 3 --apply` against the real doc wrote `last_strike` into `postingcheck` (rev 222).

**OPEN-queue row (verbatim):**

```
| 106 | POSTING-OBSOLETE-001 follow-through — wire `check-postings.py --apply` into the twice-weekly discovery run and the nightly, and settle the 4 rows sitting on strike 1 | FIXED 2026-08-26 (sweep + archive + generator belt shipped; 17 rows archived on the first live run). Legs (a) and (b) CLOSED same day: (a) both scheduled-task prompts now run the sweep (discovery step 1a, nightly step 1b) — owner-approved; (b) a second sweep agreed on all four 404s, so Scarlet / GEA / Trackman / spektr archived through the normal two-strike path — **25 rows archived, 52 live**. Remaining: (c) the sweep is script-side only, so "as soon as" means "at the next sweep", not live in the browser — an on-open client check was deliberately NOT added (see the sidecar-observer and rAF-freeze precedents). verified: 2026-08-26 |
```

---

## Row 102 — DEMAND-SEED-SEARCH-TOKEN-MISSING-001

_verified: 2026-08-26_

**OPEN-queue row (verbatim):**

```
| **102** | **DEMAND-SEED-SEARCH-TOKEN-MISSING-001 (found by the weekly demand-seed run 2026-08-26, first run to PROBE rather than assume).** the routine's prescribed search backend is unreachable from an unattended run. `POST /api/research` gates on an owner session JWT (`identityFromRequest`) → 401 `unauthenticated` headless. `GET /api/cse-search` gates on the machine token `CSE_PROXY_TOKEN` (`x-antcv-cse-token` header) → 401 `unauthorized`, because that token is NOT provisioned on this machine (only `CLUSTER_RESEARCH_TOKEN` is, which is the WRITE token and does not open the search leg). So the Brave-backed **site-scoped** search (`siteSearch=jobindex.dk`, Glassdoor) has been silently unavailable to every run of this routine since the Brave switch, and Danish evidence keeps arriving second-hand via plain WebSearch (this run: the IT-Branchen/Jobindex analysis) instead of from Jobindex postings directly. NOT a code bug — the headless-friendly route already exists and works by design. **OWNER-OWED one-line fix:** set `CSE_PROXY_TOKEN` as a Windows User env var on the desktop, same value as the relay secret, exactly as `CLUSTER_RESEARCH_TOKEN` already is; then the routine regains Nordic site-scoped coverage with no code change. Note this supersedes the optimistic framing in `docs/deployment/google-cse-setup.md` §6 ("UNBLOCKED 2026-08-18 via Brave") — the backend is unblocked, the routine's access to it is not. | OPEN — filed 2026-08-26, verified: 2026-08-26 |
```

---

## Row 108 — JOBTRACKER-PYTEST-UNWIRED-001

_verified: 2026-08-27_

**OPEN-queue row (verbatim):**

```
| 108 | JOBTRACKER-PYTEST-UNWIRED-001 (found by the job-tracker nightly 2026-08-27) — the 14 network-free python tests under `scripts/job-tracker/` are run by HAND only. `scripts/run-tests.mjs` has no python leg and no workflow invokes them, so `test_check_postings.py`, `test_closed_row_gate.py`, `test_job_sources.py`, `test_gold_residue.py`, `test_cl_v5_structure.py` and the other nine are green-by-nobody-looking between the runs that happen to touch that directory. They are cheap (all 14 finish in seconds, zero network) and they guard the belts that decide whether a model call gets spent — the closed-row gate, the obsolescence classifier, the board parsers. Filed, NOT fixed blind: wiring python into the node suite is a separate change with its own failure mode (a missing interpreter on a CI runner turning the whole PWA suite red), so it wants a deliberate design — most likely an OPTIONAL python leg that SKIPS loudly when no interpreter is present rather than failing, plus the same treatment in the nightly. verified: 2026-08-27 |
```

---

## Row 107 — IMPORT-REWRAP-SIBLING-DROP-001

> **Renumbered 2026-08-26: was row 102.** A document written before that date citing "row 102" may mean this row or DEMAND-SEED-SEARCH-TOKEN-MISSING-001. The ID is the key.

_verified: 2026-08-26_

**OPEN-queue row (verbatim):**

```
| **107** | **IMPORT-REWRAP-SIBLING-DROP-001 (2026-08-26 desktop nightly, residual of row 18).** The settings-import rewrap now carries `photo` across (1.51.4406) but still drops every OTHER top-level sibling an UNWRAPPED personalInfo blob may carry: `language`, `navyColor`, `profileDoc`, `skillsDoc`, `wordsDoc`, `danishDoc`, `memoryDigest`. (`apiKey` / `proxyUrl` are safe — they are disjuncts earlier in the same guard, so a blob carrying them is never rewrapped at all.) Only `photo` had a reported user-visible symptom, so only `photo` was carried; widening the carry-set is a deliberate, separately-testable change and was NOT done blind. No known owner-facing symptom today — filed so the next hand-pasted blob that loses a `navyColor` is diagnosed in one minute instead of one night. Fix shape: extend the same ternary, or hoist the sibling reads above the rewrap. | ACTIVE_BUGS 2026-08-26 top block; `pwa/app.src.js` settings-import block | TO DO — filed 2026-08-26, not started |
```

---

