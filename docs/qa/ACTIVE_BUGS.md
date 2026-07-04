> **SLOGAN-META-STAMP-001 SHIPPED 1.51.141 (owner 2026-07-05, mobile: "balanced resulted with ... old slogan") — the generated cl_slogan was thrown away at the meta stamp, in EVERY speed mode.** Diagnosis (pipeline trace): the gen prompt requests `meta.cl_slogan` (a sibling of `subtitle`, app.src.js ~24699) and the LLM returns it, but the meta STAMP at app.src.js:25192 built the object literal `{company,role,subtitle,greeting,opening}` and DROPPED `cl_slogan`. So it never reached `localStorage['meta']`, and `antcv-cl-slogan-fresh.js freshSmart()` (which reads `meta.cl_slogan`) always got '' → the fresh smart slogan was never adopted and the stale `antcv:clSlogan` override survived. This is SPEED-INDEPENDENT — it reproduced on thorough too; the owner happened to notice it on a balanced run. FIX (surgical app.src.js + minified app.js mirror): add `cl_slogan: W.cl_slogan || ""` to the stamp (minified `cl_slogan:q.cl_slogan||""`, anchored on the unique field-list `company:q.company,role:q.role,subtitle:q.subtitle,greeting:q.greeting,opening:q.opening` = grep -c 1; node-patch + vm.Script parse-gate; `q`=source `W`, all q.* refs share the object so it is in-scope; IIFE head + no-"use strict" asserted). Now the LLM's fresh slogan flows into meta and the belt adopts it. Tests: `slogan-meta-stamp.test.mjs` 3/3 (both bundles carry cl_slogan; old dropping-stamp gone). Suite 992/992; boot-smoke OK; cache-bust quintet → 1.51.141. Owner-verify = a fresh targeted gen (any speed) now shows the smart slogan, not the old specialization-derived one. NOTE — the OTHER half of the owner's report ("balanced → 6-page CV, no role merge / no sidebar cut") is SEPARATE and NOT fixed here: those belts gate on isTargeted(meta)+JD (speed-independent by design), so the 6pp is most likely balanced-MODEL-QUALITY under the PERF-003 2-provider `compress` cap (app.src.js:2241-2247) with the tightening pass failing SILENTLY (app.src.js:26863 keeps long content) and/or the model not following the ROLE MERGE prompt. That half is GEN-CORE + owner-gated and needs a live balanced gen with console evidence (is meta.company real? did `[sidebar-relevance-cut]`/`[compress]` fire/fail?) before any change — do NOT ship blind.

> **MOBILE-PANEL-ZOOM-001 SHIPPED 1.51.140 (register row 46, owner mobile P0: on a phone at 100% zoom the options cluster under "Generate CV & Cover Letter" — Quick generation / Speed / Cap $ / Brand fit — is clipped; owner had to zoom to ~90%).** VERIFY-FIRST reproduced headlessly at a 380x780 phone viewport: the Brand-fit row rendered at y=857, below the 780 fold, and was UNREACHABLE. Root cause found by walking the ancestor chain: on mobile, `#root`/`body` are viewport-locked (`height:100dvh; overflow:hidden` — the standard mobile pattern so inner panels scroll, not the page), but the UPLOAD screen's `.fade` container (app.src.js `"upload"===Nt`, style `minHeight:100dvh; display:flex; flexDirection:column; justifyContent:center`) had NO internal scroll — its 945px content overflowed the locked 780px #root and was clipped, so the bottom of the centered form fell off-screen with no way to reach it. FIX (surgical app.src.js + minified app.js mirror): make the upload screen its OWN scroll container — add `height:100dvh; overflowY:auto` to the `.fade`, and `margin:"auto 0"` to its inner max-width:480 column. In flexbox, AUTO MARGINS override `justify-content`, so the column stays vertically centred when it fits and scrolls from the TOP (no top-clip) when it does not — the canonical fix, no meta-viewport zoom hack. Minified mirror applied via a node patch script (occurrence-guarded: the combined anchor spanning the fade style through the unique `maxWidth:480` child = exactly 1 site; the `${b(We)}` gradient alone recurs 3x so it could not be the anchor), parse-gated with `new vm.Script`, IIFE head `(()=>{`+ no-"use strict" asserted. Verified: `pwa/test/diag-mobile-panel-zoom.mjs` — before: Brand-fit below fold + CLIP SUSPECT (#root overflow:hidden, scrollHeight 945 > 780); after: no clip suspect, `.fade` is a healthy `overflowY:auto` scroller, and scrolling it brings Brand-fit fully into view (top 692/bottom 707 within the 780 viewport) — DIAG PASS, 0 app errors. Gates: suite 992/992, boot-smoke OK (`glDemo=function`, 0 errors — the first run was a transient unpkg-CDN `load` timeout, clean on re-run), render-past-sign-in clean (the diag boots past auth onto the upload screen). Cache-bust quintet → 1.51.140 (app.js ?v + seed + version-override + sw CACHE). Advances register row 46 → SHIPPED; owner-verify = on your phone at 100% zoom, the Speed/Cap/Brand-fit row is now reachable (the screen scrolls).

> **CA-006 SHIPPED 1.51.139 (register row 43, owner CONTENT: the "Application: <role> - <company>" label bleeds into the FIRST experience role title).** VERIFY-FIRST corrected the register's hypothesis (it guessed app.js / roles[0].title): this is a PREVIEW-ONLY bleed in the sidecar antcv-candidate-preview-editor-341.js — the clean DOCX/PDF never run it, and no app.js edit is involved. Mechanism: findCandidateBlock() has three paths — Path A (candidate drop-loc), Path B (candidate [data-sid]), both of which return a block SCOPED to the candidate header, and Path C which falls back to the WHOLE preview paper when neither marker exists. On Path C the anchor loop in wrapApplicationSentence scans the entire document and matches the first PROFESSIONAL EXPERIENCE role line (it carries the same role+company text as meta), then inserts "Application: …" before it. The existing [data-sid] content-section blacklist misses this because paginated .antcv-page-row clones and merged-role renders lose their [data-sid] ancestor. FIX (sidecar-only, strictly additive): a Path-C-only header whitelist on BOTH anchor loops (the Application sentence AND the Specialisation finder) — when block is the whole paper (block.matches('.antcv-preview-paper')), only accept an anchor inside a positive candidate-header marker (data-antcv-candidate-band / data-candidate-drop-loc=topbar / data-sid=candidate|topbar|top_bar). A role node carries none of these, so it can never be chosen. It is inert on the already-scoped Paths A/B (block is not the paper), and it can ONLY reject anchors — never create a bleed; a markerless Path-C build simply falls through to the existing "refuse to materialise a phantom sentence" return, so there is no new regression. The blacklist is retained as defence in depth. Tests: `ca006-pathc-header-guard.test.mjs` 4/4 (both loops guarded, band-keyed, whole-paper-detected, blacklist retained) + the existing Playwright `diag-candidate-header-edit.mjs` re-run GREEN (CL application sentence + CV specialisation still present, editable, correctly styled, 0 app errors — the fix does not regress candidate-header editing). Suite 992/992; quintet → 1.51.139 (sidecar SCRIPT_VERSION + ?v bumped; no app.js edit → no boot-smoke). Advances register row 43 → SHIPPED; owner-verify = a targeted gen where a role shares the meta role/company no longer shows "Application: …" prepended to the first role.

> **SO-003 SHIPPED 1.51.138 (register row 40, owner DATA LOSS: changing the Core Competencies row count wipes Selected Outcomes, cloud-persisted).** VERIFY-FIRST traced every sections-writing path a core_comp change reaches: the generation/kernel/fuse apply handlers and the cloud-restore/personalInfo transforms ALL preserve the outcomes section (explicit `outcomes` branch + `return e` fallthrough) — there is NO single deterministic writer that drops it, and app.js carries 6 near-identical `"outcomes"===e.id` branches so a surgical writer edit is occurrence-ambiguous and fragile. Root cause is a stale empty-editor readback RACE, documented in antcv-selected-outcomes-row-controls-237.js:41-46: a core_comp row-count change fires antcv:sections-updated, and on the resulting re-render an editor/DOM-sync reads the outcomes editor before it re-hydrates and commits items:[]; an empty array is a valid write so it persists to the cloud and round-trips. The register explicitly asks for a loss-guard belt (the durable fix at the storage layer). SHIPPED: new sidecar `antcv-outcomes-loss-guard.js` (`window.AntcvOutcomesGuard`), cloned from the precedent antcv-corecomp-loss-guard.js: snapshots the REAL outcomes items to a LOCAL-ONLY key `antcv:outcomesGuard` (NOT cloud-synced — the load-bearing property; it survives the round-trip that wipes the cloud copy), keyed by application (meta.company|role); when a later sections state shows the outcomes section EMPTY (items:[]) or placeholder-only it re-applies the snapshot. It ONLY replaces an empty/placeholder section with previously-seen REAL items — never overwrites a section that still has real items, never crosses applications, self-disables on error; anti-loop (1200ms), boot sweeps + forever poll + sections-updated listener (ignores its own reason). The placeholder test byte-mirrors app.src.js `Se` (the me() skeleton "[Verb]/[concrete outcome N]" rows) so a skeleton restore is never counted as real. Kill `antcv:disable-outcomes-guard`. Tests: `outcomes-loss-guard.test.mjs` 8/8 (snapshot real; heal an emptied items:[]; heal placeholder-only; no-op over real; no cross-app bleed; kill switch; skeleton-never-snapshotted; pure helpers). Suite 988/988; quintet → 1.51.138 (new sidecar, no app.js edit → no boot-smoke). Advances register row 40 → SHIPPED; owner-verify = change the Core Competencies row count and confirm Selected Outcomes survives. Note: the optional writer-side hardening (app.js) is deliberately NOT applied — the belt is sufficient and the minified mirror site is occurrence-ambiguous across 6 branches.

> **JD-ANALYSIS-PRINT-001 SHIPPED 1.51.137 (register row 44, owner BUG: "Download analysis (PDF)" prints the CV instead of the JD analysis).** VERIFY-FIRST corrected the register's own hypothesis (it guessed a wrong doc-type/payload): the content builder `reportHtml()` in antcv-analysis-report-pdf-360.js was already correct — it reads ONLY rationale/meta/personalInfo (assumptions/recommendations/confidence_notes), never CV sections. The real defect is the PRINT SURFACE: the report was rendered into a `position:fixed;width:0;height:0;visibility:hidden` iframe, and Chrome's `iframe.contentWindow.print()` on an iframe with no layout box falls back to printing the TOP-LEVEL page — which behind the analysis modal is the CV preview. That is exactly why it "prints the CV". FIX (one line, sidecar-only, no app.js): keep the print iframe render-present but visually offscreen — `position:fixed;left:-99999px;top:0;width:794px;height:1123px;border:0;opacity:0;pointer-events:none;` (A4 at 96dpi; the repo's known-good pattern, cf. antcv-orphan-export-preflight.js) so `contentWindow.print()` targets the analysis document itself. Tests: `analysis-print-surface.test.mjs` 3/3 static regression lock (asserts the iframe style is never visibility:hidden / zero-sized and is a real-sized offscreen box). Suite 980/980; quintet → 1.51.137 (sidecar VERSION + ?v bumped; no app.js edit → no boot-smoke). Advances register row 44 → SHIPPED; owner-verify = click Download analysis (PDF) and receive the analysis report.

> **GEN-LANGFAB-001 SHIPPED 1.51.136 (register row 42, owner CONTENT: gen fabricated languages — invented German, wrong Danish level) — deterministic post-gen LANGUAGE-FACT belt.** Verify-first finding: a prompt-level pin already exists (LANG-PIN-001, `languages-prompt-pin.test.mjs`) yet the LLM still fabricates. (CORRECTION 2026-07-05: an earlier note here claimed the supervisor "is not exercised in live gen (0 llm_calls)" — that was WRONG; the supervisor grounding path does NOT log to llm_calls, so absence there proves nothing. The supervisor IS live via antcv-overlay's fetch-wrap on X-AntCV-Task and routes to mistral — see D2 below. It still misses fabricated languages because it is ADVISORY (user can Accept anyway) and per-section supervision is keyed to specific tasks (cv_profile/cv_outcomes/cl_who_i_am/cl_how_i_would_contribute); the LANGUAGES section is not a separately-supervised task.) So a deterministic post-gen belt is the right fix regardless. Per owner policy (a gen-ignored-rule report gets a stored-sections BELT, not more prompt text), fixed with a self-contained sidecar `antcv-lang-fabrication-guard.js` (`window.AntcvLangFabricationGuard`) that reconciles the stored CV `languages` section against the kernel truth `personalInfo.languages` ([{lang,level}]): DROPS any language row whose name is not in the kernel (fabricated), and CORRECTS a kept row's level to the kernel value when it genuinely differs. NAME-NEUTRAL (reads the kernel, no hardcoded language names — works for gabriel/anita/devon/any persona). Handles both section item shapes (labeled_list {l,v} and rich_block {b,t}, `!row.grp` gated — mirrors antcv-languages-concise.js) and the nested `personalInfo.personalInfo` wrap. Level comparison is BIDIRECTIONAL-containment tolerant ("B1"⊂"intermediate (B1)", "professional"⊂"full professional" are fixpoints) so it never ping-pongs with languages-concise. SAFETY: fires only when the kernel declares ≥1 language (empty kernel = no-op, never strips an unverifiable section); writes only on change (no event loop); self-disables on error; kill `antcv:disable-lang-fabrication-guard`. Restore-safe (pure reconciliation over sections+personalInfo, both cloud-restored before it runs; re-fires on the post-restore sections-updated; no stylePrefs keys). Loaded in index.html right before antcv-languages-concise.js so fabricated rows are removed first. Tests: `lang-fabrication-guard.test.mjs` 9/9 (drop German + fix Danish; rich_block shape; concise-fixpoint no-fight; name-neutral Anita; empty-kernel no-op; kill switch; idempotent; nested PI wrap; levelDiffers helper). Suite 977/977; quintet → 1.51.136 (new sidecar, no app.js edit → no boot-smoke needed). Advances register row 42 → SHIPPED; owner-verify = a fresh gen no longer lists German and shows Danish B1.

> **PTR-STALE-GUARD-001 SHIPPED 1.51.135 (owner "implement Same-device stale cloud-pointer re-adoption on cold-restore") — closes the client half of register row 39a.** AUTOSAVE-NO-DOWNGRADE-001 (server) already stopped a transient auto-save from poisoning a real application row; this fix closes the OTHER half — a stale cloud `active_application` POINTER (which row the account currently considers "active") being re-adopted on cold-restore even when it was set by THIS SAME device. Root cause: the existing `__foreignDevice` guard (JD-SCOPE-ISOLATION-001 Stage 2) only blocks adopting ANOTHER device's pointer into the JD textarea — it explicitly treats a same-device pointer as always trustworthy, and it never gated the actual meta+sections adoption (`lo()`/`ao()`) at either restore site in the first place. The content-based drift guards (META-DRIFT-GUARD-001/002) only catch a real company being overwritten by an EMPTY/UNSOLICITED row — a stale pointer that points at a DIFFERENT REAL application (a race, a lagging PUT, a second same-device tab) sails straight through both guards and clobbers a fresher local draft. FIX: new self-contained sidecar `antcv-pointer-stale-guard.js` (`window.AntcvPointerStaleGuard.isStalePointer`) reusing the 277-SEQUENCE-GUARD-001 timestamp pattern — compares the relay's `active_application._pointer_updated_at` (when the pointer was last set) against the local `antcv:metaStamp` timestamp for the CURRENT local company/role identity (same 3-minute clock-skew margin as 277-guard); computes its own same-device check internally (`_pointer_device_id` vs `AntcvJdScope.deviceId()`) so it is independent of the existing `__foreignDevice` variable's position in the code. Backward-safe by construction: returns false (no behavior change) unless BOTH the local identity differs from the row AND both timestamps are present as positive evidence — a first cold start or a never-stamped session is untouched. OR-ed into the drift check at BOTH adoption sites (`__draftDrift` in the Read-from-Cloud path, `__draftDrift2` in the cold-start restore path), in both `app.src.js` and `app.js` (occurrence-guarded, `vm.Script`/`new vm.Script` parse-gated, IIFE-head + no-`"use strict"` asserted). Kill switch `antcv:disable-ptr-stale-guard`. Tests: 11 new pure-function unit tests (`pointer-stale-guard.test.mjs`, covering same-identity-inert, no-evidence-inert, same-device-stale, foreign-device-not-this-guard's-job, newer-pointer-still-adopts, clock-skew-margin, kill switch, mismatched-metaStamp-key-ignored, role-only mismatch) + a both-bundle mirror-lock test extended in `jd-scope-isolation.test.mjs` (both call sites present with identical `pointerDeviceId`/`pointerUpdatedAt` wiring in both bundles). Suite 968/968 + boot-smoke green. Cache-bust quintet → 1.51.135 (new sidecar registered in index.html right after antcv-jd-scope.js). Together with AUTOSAVE-NO-DOWNGRADE-001 this closes both the write-side and the read-side of the "the fuck?" Trackman revert class of bug. REMAINING on row 39a: row 19 (two-real-device test, owner-gated — needs an actual second device) and a live setItem-writer probe if the class resurfaces (no repro since the AUTOSAVE fix shipped).

> **MOBILE-PANEL-ZOOM-001 REPORTED (owner, live from phone 2026-07-05) — register row 46, Band A mobile P0, NOT yet fixed.** Owner report: "brouser needs zoom 90% in order to see all set panel controls." On a phone (antcv.pages.dev, Chrome portrait, ~1080×2340) at DEFAULT (100%) browser zoom the main-page control cluster under the "Generate CV & Cover Letter" button is CLIPPED — the "Quick generation" checkbox, "Speed: Fast/Balanced/Thorough" segmented control, "Cap $" field, and the "Brand fit" checkbox row do not all fit; the Brand-fit row falls off the bottom of the viewport. At ~90% browser zoom the whole cluster becomes visible (owner's two screenshots confirm: 90% = every control visible; 100% = Brand-fit cut off). This is a mobile VIEWPORT-FIT / overflow-clip bug (a fixed/min-height container or non-wrapping flex row that clips at small viewport heights), not a scroll bug. DIAGNOSTIC-FIRST when picked up: reproduce at a 380px-wide mobile viewport (headless resize / preview mobile preset), inspect the options-cluster layout (suspect `antcv-mobile-ui-418.js` run275 or the options-row flex), confirm the clip, fix by letting the cluster wrap/scroll cleanly inside the viewport — do NOT add a meta-viewport zoom hack. REPORTED ONLY this run (owner interrupted the nightly to log it); no code change yet. Screenshots archived in the 2026-07-05 upload set.

> **A2 / AUTOSAVE-NO-DOWNGRADE-001 SHIPPED (access-relay, owner "implement A2 now") — the root poison-writer for the "the fuck?" Trackman revert (register row 29/31 leg C) is closed SERVER-SIDE.** Diagnosis (code-level): the PWA auto-saves the active application on every row switch + periodic tick via PUT /api/applications/:id with the CURRENT React sections + meta; the relay update wrote whatever the client sent — so a transient EMPTY sections state or a DOWNGRADED (empty/Unsolicited) meta at that beat (a mid-restore / mid-flip tick) persisted into a real TARGETED row, which cold-restore/read-from-cloud then adopted back as the stale/blank snapshot (the reverted regulatory + roles). FIX (one place, ALL clients, no risky minified app.js edit): the relay PUT now (a) extends the ownership SELECT to read the row's current cv_sections/cl_sections/jd_company, then (b) BLOCKS a downgrade — if the row already carries a REAL company and the incoming jd_company is empty/Unsolicited, jd_company+jd_role are dropped from the SET (row keeps its real company); and (c) BLOCKS a blank-overwrite — an incoming empty `[]` cv_sections/cl_sections over a POPULATED row is dropped (never blanks real content). An explicit `null` (deliberate wipe-generated) is still honoured; a genuine upgrade (Unsolicited→real, or new real content) writes normally. Same data-loss discipline as DEMO-RESET-EMPTY-OVERWRITE-001, applied to the application row. Verified: `workers/access-relay/test/diag-app-autosave-downgrade-guard.mjs` 5/5 (downgrade blocked + cv still written; blank blocked; genuine write passes; null wipe honoured; unsolicited upgrade not false-blocked). Relay-only (demo-proxy/proxy don't serve /api/applications — no mirror). DEPLOY: access-relay. EFFECT: a targeted row can no longer be poisoned by a transient auto-save, so cold-restore has no stale snapshot to revert to — the upstream source of the Trackman revert. REMAINING A2 (row 39a): the same-device stale cloud active_application POINTER re-adoption on cold-restore (client-side; the CUT half already self-heals via STAMP-IN-BLOB 1.51.129; role-structure needs a regen — no belt reconstructs it) + row 19 two-device test (owner). The setItem-writer probe stays the method for any residual live hunt.

> **GEN-BACKGROUND-001 row-38a FOLLOW-ONS SHIPPED 1.51.134 (owner "implement them now"): auto-resume-on-foreground + cross-reload input-signature.** Completes approach A end to end: (1) INPUT-SIGNATURE — `antcv-gen-memo.js` `runSig()` now DERIVES a stable per-application signature from localStorage (antcv:lastJdText + meta company/role) when `window.__antcvGenRunSig` is unset, so a checkpoint persists across a FULL page reload (not only a background/foreground) with no app edit; a same-inputs reload adopts the persisted checkpoint and resumes. (2) AUTO-RESUME-ON-FOREGROUND — a `visibilitychange`/`focus` listener in the memo: on the tab returning visible, if opted-in AND not already running AND a checkpoint for the CURRENT inputs exists with ≥1 completed call AND it is recent (<15 min) AND not already auto-resumed, it re-invokes the app's own generate function ONCE (`window.__antcvGenTrigger`) — the ee() memo then replays the completed calls, so generation resumes with NO manual re-click. Loop-guarded (once per checkpoint, reset on gen success). The generate fn is exposed via a clean assignment-chain edit in BOTH bundles (`window.__antcvGenTrigger = vl = async () => {…}`; minified name also `vl`, verified unique) — no brace-matching, re-exposes each render, and is default-inert (auto-resume only fires when opted in via antcv:gen-resume). Guards tested: not-opted-in / running / no-trigger / no-checkpoint / stale → no fire; input-sig cross-reload adopt. Tests: gen-memo.test.mjs 8→11 + both-bundle mirror lock extended to the trigger; suite 956/956 + boot-smoke. Still DEFAULT OFF (opt-in antcv:gen-resume=1); kill antcv:disable-gen-memo. Cache-bust quintet → 1.51.134 (app.js + memo ?v bumped). OWNER: with the flag on, a mobile gen that gets backgrounded now auto-resumes on foreground AND survives a reload — no re-tap.

> **GEN-BACKGROUND-001 APPROACH A INTEGRATED 1.51.133 (owner "A, now") — checkpoint-memo at the ee() gen chokepoint, opt-in.** The deep read settled the approach: AntCV's generation is a DEPENDENT client-driven pipeline (memory → JD → draft → main gen → tightening → analysis; each stage's prompt built from prior results), NOT the independent server-side sections gen-job.js runs — proven at the source (the main-gen ee result feeds later stages). So the correct fit for backgrounding survival is CHECKPOINT-MEMOIZATION at the single LLM chokepoint the whole pipeline flows through (app.src.js `ee()`), not a /job/* switch. SHIPPED: (1) `antcv-gen-memo.js` — `window.AntcvGenMemo` (key/get/set/clear; opt-in `antcv:gen-resume`; kill `antcv:disable-gen-memo`; in-memory session cache + localStorage persistence keyed by an optional `window.__antcvGenRunSig`; clears on successful gen so a fresh regen is never cached; 8 unit tests). (2) A 2-edit surgical wrap of the gen chokepoint in BOTH bundles — source `ee`→`__eeInner`+wrapper, minified `Le`→`__LeInner`+wrapper (shadow-hazard-VERIFIED: `async function Le(` unique, 19 call sites, no `Le=` reassignment; the `callLLM:ee` value ref resolves to the wrapper) — plus a `clear()` at the gen-done success point. EFFECT (opted in): when a mobile tab backgrounds mid-gen the run throws; re-running (re-click Generate) REPLAYS every already-completed LLM call from the checkpoint instead of re-calling — near-instant resume, zero re-cost, only the interrupted call re-runs. Output-neutral (a replay returns the exact string the call returned). Authored via a node patch script (no heredoc), occurrence-guarded, parse-gated (`node --check` src, `new vm.Script` min), app.js IIFE head + no-"use strict" asserted. DEFAULT OFF → `ee()` byte-identical to today; both-bundle mirror-lock test; suite 953/953 + boot-smoke green. OWNER: set `antcv:gen-resume=1`, then A/B a real mobile gen (start → background → foreground → re-click → resumes fast); flip default after. Follow-on: auto-resume-on-foreground (no manual re-click) + input-sig for cross-reload; the `/job` client engine (1.51.132) stays for a future server-driven decompose. Cache-bust quintet → 1.51.133 (app.js ?v bumped).

> **GEN-BACKGROUND-001 CLIENT ENGINE SHIPPED 1.51.132 (owner P0 "complete GEN-BACKGROUND-001") + verify-first corrections to the backlog.** Built the resumable generation DRIVER the PWA was missing: `pwa/antcv-gen-job-client.js` (`window.AntcvGenJob` — run/resume/cancel/hasActive/onForeground) implements the full server `/job/*` protocol (create → step-per-section → coherence → done, all KV-checkpointed): localStorage job persistence, reload-resume via GET /job/{id}, visibilitychange foreground-resume, hidden-tab step pacing, transient-retry with backoff, 4xx-terminal. Every side effect injectable → 8 unit tests (`gen-job-client.test.mjs`, 945/945 suite) drive create→coherence→done, reload-resume, retry, cancel against a fake server + deterministic clock. Loaded by index.html, **INERT until the app calls run()**; integration kill-switch `antcv:disable-gen-job`. **KEY ARCHITECTURAL FINDING (docs/qa/GEN-BACKGROUND-001-CLIENT-SPEC.md):** the app's main generation is ONE big multi-provider `/v1/messages` call, not per-section; gen-job's backgrounding survival needs MANY short per-section /steps (a single 3-6 min /step isn't viable on Workers). So the app.js integration ALSO requires DECOMPOSING generation into a per-section plan — a gen-core change that must NOT be speculatively spliced into the minified bundle ("an end result, not a brickable mid product"). The spec lays out approach A (full decompose, staged behind the kill-switch with a fresh-gen quality A/B) vs B (resume-on-reload only, doesn't close it); owner picks. **VERIFY-FIRST corrections to the 2026-07-04 backlog (register rows 38/39):** (1) GEN-MODELROLE-001 is NOT "not started" — it's code-shipped AND `MODEL_ROLES={"writer":"anthropic","supervisor":"mistral","coherence":"anthropic"}` is already SET in both wrangler.toml [vars] (owner-decided 2026-06-13); remaining is a live-deploy verify only. (2) The gen-job server /job/* dispatch IS wired into both proxy bundles on main (handleJobRoute ×3/×2). Nightly (NIGHTLY_2026-07-05_PROMPT.md) updated: A1 = verify /job/* live + owner A/B decision + staged decompose behind the kill-switch; D2 = MODELROLE live-verify. Cache-bust quintet → 1.51.132 (new sidecar, app.js untouched). app.js unchanged so no boot-smoke needed.

> **OLD-ROLE CAP — MERGED-RELEVANCE REFINEMENT 1.51.131 (owner: "the age cap applies also for relevant roles — it however means merged role bullets must be very relevant to stay").** 1.51.130 exempted merged roles from the age cap entirely (kept 5 regardless of age); the owner corrected that: the age cap applies to ALL old roles, MERGED included. New behaviour in the docx-client BULLET-CAP belt: for an old PLAIN role → hard age cap (≥16y→2, 11-15y→3) as before; for an old MERGED role → the age count is a FLOOR (strongest-first), and bullets ABOVE the floor (up to the 5 merge cap) are kept ONLY when JD-relevant. Relevance = lightweight JD-token overlap (`_jdSignificantTokens`/`_bulletRelevantToJd`: ≥4-char words minus stopwords, plural-tolerant; read from `antcv:lastJdText`); no JD present → can't judge → keep (never over-drop). Effect: a merged old role whose bonus bullets don't map to the JD collapses to its age floor; one whose bullets are on-point keeps up to 5. Recent merged roles (no age cap) unchanged. Tests: export-belts +2 (floor+relevant-bonus keeps 5 with the irrelevant one dropped; no-relevant-bonus → floor 3); no-JD path keeps the delivered-pair behaviour (BULLET-CAP-BELT-001 merged→5 still green). Suite 937/937. Cache-bust quintet → 1.51.131 (docx-client only). app.js untouched.

> **TRACKMAN QUALITY BELTS SHIPPED 1.51.130 (owner "keep implementation of fixes that affect the Trackman CV and CL, especially slogan quality"): SLOGAN-QUALITY-GATE-001 + BULLET-LINES-CAP (rule 46) + OLD-ROLE-BULLET-CAP-001 (rule 47).** **(1) SLOGAN-QUALITY-GATE-001 (antcv-cl-slogan-fresh, consumed by both preview fallbacks + the export chain via `window.__antcvSloganQualityOk`):** a generated `cl_slogan` is ADOPTED/RENDERED only if it is a real smart statement — 2-8 words, no `•`/`|` triad shape, ≤2 commas (not a keyword list), no buzzwords (innovation/cutting-edge/world-class/passionate/dynamic/results-driven/…), and NEVER an echo or containment of the specialization triad, company, or role title. A failing slogan is treated as ABSENT (no line beats a bad line). Same gate at all render sites → a low-quality slogan appears nowhere. **(2) BULLET-LINES-CAP (rule 46, antcv-orphan-export-preflight):** in a TARGETED export a role bullet spanning ≥3 typeset lines is measured over-long (even with a full last line — not a runt) and routed to L3 with a hard 2-line cap (`maxLines:2` in the request; the re-measure accepts only ≤2 lines). Unsolicited exports untouched (the sidecar's only app-type gate, `isTargetedMeta`, documented). **(3) OLD-ROLE-BULLET-CAP-001 (rule 47, docx-client BULLET-CAP belt):** a PLAIN (non-merged) early-career role is tightened by age — ended ≥16y ago → 2 bullets (the RA/TA stack the owner named), 11-15y → 3, else the normal 4; MERGED roles keep their 5-bullet cap (deliberately-kept combined evidence, rule 17/28). Thresholds calibrated to the owner's timeline + the delivered-and-verified NIL pair (Sirin, ended ~9y ago, stays 4). Tests: cl-slogan-fresh +3 (quality gate + gated adoption), orphan-export-preflight +2 (rule-46 cap + unsolicited-untouched), export-belts +2 (age tiers + unsolicited), compression-linewidth persona-neutral test updated to the intentional rule-46 gate. Suite 935/935. Cache-bust quintet → 1.51.130 (docx-client + 3 slogan sidecars + preflight ?v bumped). EFFECT on Trackman: after a REGEN the slogan is a vetted smart statement or nothing; bullets never wrap to 3 lines; RA/TA roles carry ≤2 bullets. app.js untouched (no boot-smoke needed; all sidecar/module edits).

> **STALE-RESTORE UNCUT REVERT — DIAGNOSED LIVE + STAMP-IN-BLOB BELT SHIPPED 1.51.129 (owner "the fuck?" screenshot: full 24-row regulatory back across 3 pages, Innoviz roles split again, Security-Guard-class roles back on:true in the Trackman app).** LIVE PROBE (owner's origin, stored state): meta = "Trackman A/S" ✓, but sections = the PRE-CAMPAIGN full-breadth snapshot — ALL 12 roles on:true (Security Guard/Students Council/Team Ops/CSA back), regulatory 24 rows with only 12 old hidden flags, tools 20 rows; a stale row/cloud restore clobbered the cut+gen state (register row 29 leg C, the exact deferred leg). WHY THE CUT DIDN'T SELF-HEAL: its one-shot stamp lived in a SIDE KEY that survived the restore while the content it stamped didn't — the stamp vetoed the re-run forever. FIX (STAMP-IN-BLOB): the cut stamp now travels INSIDE the sections blob (`_sidebarCutStamp`): a restored pre-cut snapshot lacks it → the cut re-arms automatically; a post-cut blob (incl. later user un-hides) carries it through row saves/restores → never re-fought; a missing blob stamp ALWAYS re-runs (the side key alone can never veto — dropping the legacy-grandfather branch was deliberate: it would have cemented the owner's clobbered state). Blob is stamped even on a no-change pass (converges, no tick-loop). +2 locks (restored-snapshot re-arm; user-un-hide travels). Suite 928/928; quintet → 1.51.129. LIMITS, stated honestly: (a) the cut re-runs only in a tab whose JD-scope namespace carries the JD (a fresh tab boots on the kernel namespace — the known row-29 family issue; the owner's working tab qualifies); (b) the ROLE-STRUCTURE revert (merges undone, hidden roles back on) is the row's SAVED CONTENT — no belt can reconstruct the targeted gen's choices; ROLE-CLASS-HIDE + bullet-cap belts still protect the EXPORT; the clean repair is a fresh Trackman REGEN (which also delivers the smart slogan + kernel v11 PM rows). ROOT-CAUSE hunt (which writer restored the stale snapshot: row selection auto-save echo vs cloud pull that passed the sequence guard because the stale row was FRESHLY saved) = nightly T2, setItem-writer probe on 'sections' during one row-selection in the owner's tab.

> **SETTINGS-PERSONAL-STABILIZE-001 SHIPPED 1.51.128 (owner: "stabilise all the jumps in the personal menu … set it as a final, fixed solution … no crashes from settings menu").** MEASURED, not guessed: a headless boot with a MutationObserver over the Settings→Personal panel counted **3938 DOM mutations in 8 seconds AT REST** — the jumping. Attribution by mutation signature found FIVE non-idempotent sidecar writers re-stamping the SAME attributes/text every tick (each write re-fires every settings observer — the same self-feeding class the 211 flicker fix killed in v1.40.350): (1) 1252× `data-antcv-mobile-export-hidden-275` re-stamps — antcv-mobile-ui-418.js run275 (the loaded twin; antcv-mobile-topbar-cleanup-275.js is retired-on-disk, fixed anyway); (2+3) 939× header REBUILD (childList on the button) + 939× `data-antcv-quick-contact-row` re-stamps + 313× aria-expanded — antcv-quick-contact-collapse.js paintHeader/apply; (4) 407× `data-antcv-renamed-from-tone` — antcv-section-panel-tweaks.js; (5) 120× status-line textContent rewrite ("Slot 1 is empty") — antcv-tone-helper.js. FIX: every writer is now change-gated (write only when the value differs — the established idempotent-writer pattern). RESULT, same probe: **0 mutations in 8s, 0 page errors** — the panel is completely still; the order-based flex layout (which already matches the owner's reference screenshot: Import → Review & Edit → Export → Apply/Undo → Job targeting → Writing style → Languages → Advanced tone) is now FINAL because nothing rewrites it. Permanent lock: `pwa/test/diag-personal-panel-probe.mjs` (PASS = ≤5 mutations/8s + zero errors) — run it whenever a settings sidecar changes. Advances register row 17 (sweep-army burst cost — the Personal-panel share of the churn is eliminated). Suite 926/926; quintet → 1.51.128 (4 loaded sidecars ?v-bumped).

> **SLOGAN-SMART-STATEMENT-001 SHIPPED 1.51.127 (owner: "the slogan and the specialization are definitely NOT supposed to be the same for a specified job!!!! slogan needs to be a smart statement!").** ROOT CAUSE: `meta.subtitle` was never a slogan — the gen prompt's meta example literally instructs `"subtitle":"Role • Area • Area"` (the positioning triad), and ALL FOUR slogan render sites fall back to it by design (pre-rule-23 default). While the NIL-era override key was set the duplication was masked; 1.51.120's stale-override cleanup exposed it. FIX, four legs: **(1) gen prompt (both bundles, unique-anchor node patch, parse-gated + mirror-locked):** the meta example now carries a self-instructing `"cl_slogan"` field — a SHORT surprising statement (3-7 words) connecting the candidate to THIS role (pattern: MAKING THE INVISIBLE MANUFACTURABLE), NEVER a copy of the subtitle/specialization, NEVER a keyword list, empty for unsolicited. The gen's meta persists wholesale, so cl_slogan rides into stored meta with zero adoption-list changes. **(2) antcv-cl-slogan-fresh adopts it:** no override → meta.cl_slogan is written into antcv:clSlogan (stamped to the app; all four render sites pick it up); a stale other-app override yields first, then the smart statement adopts. **(3) preview fallbacks gated:** slogan-control + slogan-element subtitleFallback now return meta.cl_slogan-or-NOTHING on a TARGETED app — the specialization triad never doubles as the slogan; unsolicited keeps the standing default. **(4) export chain (docx-client):** override → meta.cl_slogan → (targeted ? slogan_hidden : standing subtitle) — slogan_hidden stops the WORKER's own subtitle fallback, no worker deploy. Tests: cl-slogan-fresh 8→12 (adoption, never-copies-the-triad, yield-then-adopt, both-bundle prompt mirror lock); suite 926/926 + boot-smoke (app.js changed). Quintet → 1.51.127 (app.js ?v → 1.51.127). EFFECT ON THE CURRENT TRACKMAN APP (no cl_slogan in its meta): the duplicated slogan line DISAPPEARS rather than echo the specialization; a REGEN on ≥1.51.127 produces the real smart statement. Closes row 28's rule-23 GEN half (fresh-gen verify pending).

> **CUT-V2 + KERNEL v11 SHIPPED 1.51.126 (owner Trackman review 3: "entire tools group is gone", "many PM tools are hidden", "add PM expertise to the kernel", "preview not updated re role merging").** **(1) PM-TOOLS-BRIDGE** — the v1 cut kept a tools token only on a LITERAL JD word hit, so Jira/Confluence/Codebeamer/MS Project all died against a JD that says "project management methodologies" without naming any tool. Tools tokens now pass through the SAME domain-bridge machinery as certs, with two new domains: pm-tools (jira|confluence|codebeamer|alm|ms project|gantt|power bi|excel|stakeholder|planning|roadmap ↔ JD project/program manag|agile|scrum|planning|stakeholder|prioriti|risk|timeline) and requirements-tools (requirements|traceability|change governance/control|CCB|enterprise architect|doors ↔ JD requirement|traceab|change|specification|architecture). **(2) EMPTY-GROUP-HIDE** — a group header must never stand over nothing (the owner's "Tools" header floated over an empty group): after the cut, a grp row whose every content row is hidden gets hidden too, and un-hides when a row returns; stored-sections = preview AND export agree. **(3) RESIDUE HEAL on re-arm** — the stamp now carries a CUT_VERSION salt ('v2'), so every already-cut app re-runs ONCE; the re-run first pulls residue tokens that pass the improved keep test BACK into their category rows (insertBest placement, rows un-hide) — the owner's over-cut Trackman sidebar repairs itself on next boot, no manual restore. Tests 8→11 (PM bridge, empty-group hide+unhide, heal-from-residue). **(4) KERNEL v11** (Downloads + OneDrive, `Gabriel_personalInfo_modernized_2026-07-04_v11.json`): PM expertise added to tools — Expertise row "Project & delivery management: hardware project leadership, milestone & priority planning, change control (CCB), risk & impact analysis, supplier & stakeholder coordination, cross-functional delivery to production" + Methods row "Project management: stage-gate & milestone planning, change control boards, impact analysis, RFQ/RFI supplier evaluation, KPIs & status reporting, data-driven reviews" — every clause grounded in the stored Innoviz/Kanzen/Meprolight/Sirin role content (nothing invented); OWNER: import v11 through the unified loader so the live kernel picks it up. **REMAINING from this review (register row 34, top priority):** ROLE-MERGE PREVIEW PARITY — the deterministic merge runs export-side only; design decided: move it to STORED sections one-shot per app+JD (merged role inserted, constituents kept on:false hidden — eye-reversible, preview=export automatic, docx-client merge becomes idempotent no-op); rides nightly T1'. Suite 922/922; quintet → 1.51.126.

> **RESIDUE-DEDUP-LOOP-001 FIXED 1.51.125 (owner LIVE: "regulatory context in trackman application is very jumpy — it is open in browser now check why").** Caught with a writer probe in a probe tab on the owner's origin (his live Trackman state): **43 `sections` writes in ~18s**, sections-updated events alternating `tools-corecomp-dedup` (13) × `tools-hidden-residue` (10) — every write re-renders the preview, and REGULATORY (below TOOLS in the sidebar) jumps on each pass. THE CYCLE: a "Hidden - <category>" residue row carries the category label, so tools-corecomp-dedup's Focus-Area filter matched it against the SAME core-comp label and DROPPED it; the residue reconciler re-created it on the next tick — forever. The 1.51.121 relevance cut made the collision near-certain (it creates residue rows named after the very categories the dedup hunts). FIX: dedup skips residue rows in BOTH passes (row filter + parenthetical trim) — review artifacts never render, so they cannot be "duplicates". Lock: residue-dedup-loop.test.mjs (3 — residue survives dedup; dedup+reconcile reach a FIXED POINT ≤2 writes; real duplicate rows still drop once). ALSO in 1.51.125: owner-approved abbreviation "Automotive environmental conditions and testing"→"Environmental testing" (SIDEBAR_ABBR); spec rules 45-47 filed (preview=printed output → register row 34 parity sweep; NO 3-line bullets in tailored nordic-minimal → preflight belt queued; old-role 2-3 bullet caps → belt tier queued); row-23 button-audit harness + first-run report + row 33 findings; NIGHTLY_2026-07-04_PROMPT + multi-model dispatch in the antcv-nightly task. OWNER VERIFY: hard refresh the Trackman tab → the sidebar settles within ~2 writes (no more dancing).

> **PANEL/PREVIEW BUTTON AUDIT — HARNESS SHIPPED + FIRST RUN CLEAN + 2 EXPORT-PARITY FINDINGS (register row 23 → partial; QA pass 2026-07-03 night).** New standing harness `pwa/test/diag-panel-button-audit.mjs` (row 23's method made real): boots the app owner-shaped in a real browser (network to relay/proxy/workers blocked, dialogs auto-dismissed), opens the panels (⚙ / ¶ Section / 🎯 Analysis / 👁 Preview), then ROUND-BASED enumeration (React re-renders replace nodes — index tags die; clicks reveal new buttons) clicking every non-dangerous button and recording localStorage writes + DOM mutation delta + page errors; then statically cross-checks every control-written store key against the export builder. FIRST RUN (1.51.124 tree): **196 buttons, 94 active, 0 THROWS, 0 DEAD** — the prior dead-control class (name CJLR→name_input, Application CJLRs) is confirmed gone. Report: docs/qa/PANEL_BUTTON_AUDIT_2026-07-03.md/.json. **FINDINGS (filed as register row 33, EXPORT-ALIGN-PARITY family — same class as the shipped WHY-RULE-EXPORT-PARITY-001):** (a) **NAME-ALIGN-EXPORT-PARITY** — the Name-line alignment lives in `antcv:nameLineAlign` (antcv-name-align-fix.js, a preview-DOM sidecar) and docx-client never reads it → a centre/right Name in preview may export left; verify with a payload diff (set the key → buildPayload → header_align.name), then wire the key as a header_align fallback. (b) **HEADLINE-ALIGN-EXPORT-PARITY** — section HEADLINE CJLR choices persist in `antcv.sectionHeadlineAlignment.v1` (antcv-section-panel-211.js, preview-only by design comment "CJLR affects the section headline only") and neither docx-client nor the worker headingParagraph consume them → panel headline alignment never reaches the PDF; fix = forward a headline_align map + worker headingParagraph honor (worker leg → wk bump). AUDIT LIMITATIONS (harness TODOs, not app bugs): 23 "unclickable" = overlay obstruction after prior clicks; 65 "not-visible" = menu items enumerated after their menu closed — a second pass with per-menu reopen would cover them; 11 dangerous-labelled buttons (generate/export/restore/enrich/analyse) need the LIVE audit with the owner present. Suite untouched (harness is a diag, not a unit test).

> **ROW-29 RESIDUALS SHIPPED 1.51.124 (P4 legs A+B): 277-SEQUENCE-GUARD-001 + CL-HYDRATE-EXPORT-GATE-001.** **(A) 277-SEQUENCE-GUARD-001 (antcv-generate-cloud-sync-277.js)** — "never let OLDER cloud meta overwrite NEWER local", the round-4 slow-round-trip case that also produced the Trackman "your organisation" damage. Two independent guards, client-only (the relay's active_application ALREADY carries the D1 row's updated_at — no schema/deploy needed): (1) IN-FLIGHT IDENTITY — the local meta identity (company|role) is snapshotted when the sync starts; if it changed by adoption time (a generation/row-switch landed mid round-trip), the WHOLE adoption (meta AND sections) is skipped for this pass — the body in hand predates the change by construction; the next tick pushes the fresh state instead. This kills the probe-documented revert mechanically. (2) STALENESS — antcv:metaStamp records when the local meta identity last changed (observed); a cloud row whose updated_at predates it beyond a 3-min clock-skew margin is a stale snapshot → skipped. Newer rows from a second device still mirror; legacy rows without updated_at keep the pre-guard behaviour; kill antcv:disable-277-sequence-guard. Existing downgrade-guard semantics unchanged (5 old tests green); +4 new incl. the mid-flight generation repro. **(B) CL-HYDRATE-EXPORT-GATE-001 (docx-client)** — the CL hydration race (round-3 "Dear [Hiring Team / Name]," exports): buildPayload now hydrates placeholder GUARDED CL sections (greeting/opening/why/who/foundation/contribute/closure/bring) INSIDE the payload — exports build from React state, so the guard's async storage heal could never fix the payload in hand. Sources, in order: the prose-loss guard's bucket snapshot for the CURRENT app (full section, right shape) → meta.opening/meta.greeting strings. Placeholder←real only (classifier mirrors the guard: ANY bracketed template segment); never fabricates; kill antcv:disable-cl-hydrate-gate; 3 tests. Suite 916/916; quintet → 1.51.124 (docx-client + 277 ?v bumped). REMAINING row 29/31 leg (registered): (c) app-row AUTO-SAVE must not persist a downgraded meta into a targeted row + one-time poisoned-row repair (row meta from its own display name) — app.js auto-commit territory; with writers #1/#2 killed (1.51.105/108) and the sequence guard now closing the slow-round-trip window, the poison SOURCE set is believed empty; the repair is belt-and-suspenders.

> **BRAND-FIT-PALETTE-001 SHIPPED 1.51.123 (P3, spec rule 37).** Diagnosis: the APPLY layer already existed (COMPANY-BRAND-FIT-001, both bundles: validates the gen's brand_fit — 6-digit hex, navy dark-enough for white text (<0.62 luminance), whitelisted fonts — persists navyColor(+cloud), patches styleConfig (accent → photoBorder/sidebarLine/sidebarHead; fonts), flips the package to custom; export consumes it via buildStyle(styleConfig, navyColor)). The NIL failure was UPSTREAM: the block only ever ran on the LLM's returned brand_fit, and the model omits it even when the JD text literally carries the brand hex codes ("logo blue #0373c6 / dark navy #00355a"). FIX (rule 38, deterministic half): **antcv-brandfit-sample.js** defines window.__antcvBrandFitSample() — samples 6-digit hex codes straight from antcv:lastJdText, filters near-white chrome (>0.85), navy = darkest (darkened below the 0.62 gate when needed), accent = next distinct (or the undarkened original); returns null when there is nothing real to sample. BOTH bundles spliced (unique-anchor node patch, parse-gated, mirror-locked): `bf = (gen brand_fit) || __antcvBrandFitSample()` — the gen's palette still wins when present; the SAME validated apply path consumes the sample; the 🎨 opt-in gate is UNCHANGED (session-only by design — the checkbox title says so). Tests: brandfit-sample.test.mjs (4 incl. NIL-case + darken + both-bundle mirror lock); suite 909/909 + real-browser boot-smoke OK (app.js changed). Cache-bust: app.js ?v → 1.51.123 + full quintet. OWNER VERIFY: check 🎨 Brand fit, attach the NIL JD (its text carries the hexes), generate → header/sidebar adopt #00355a with #0373c6 accents in preview AND export, even when the model returns no brand_fit. NOTE: JDs whose branding is NOT stated as hex codes in the ad text still depend on the model's brand_fit knowledge (unchanged).

> **SCHOLAR/ANTCV HYPERLINKS SHIPPED 1.51.122 (P2, spec rules 35 + 39, register rows 28 + old 2).** Diagnosis first: the WORKER render leg already existed end-to-end — inlineRuns renders markdown [text](url) as real ExternalHyperlinks (RICH-BLOCK-HYPERLINK-001) and the publications masterSite renders as "All publications: <link>" (PUB-MASTERSITE-001) — so NO worker change, NO worker deploy. The gaps were all client-side, three legs: **(1) PUB-MASTERSITE-EXPORT-001 (docx-client)** — buildPayload's list case NEVER forwarded masterSite: the preview showed the Scholar anchor while the exported PDF silently dropped it (the exact rule-35 defect class). Forwarded now, sanitized (http(s) only, sidecar bookkeeping fields stripped). **(2) SCHOLAR-LINK-GATE-001 (new sidecar antcv-scholar-links.js)** — kernel v10 publicationsScholar {label,url,showWhenJDContainsAny} drives the STORED publications masterSite through the research-JD gate (rule 39: prominent for research/scientist/publications/academic JDs, off for cleanroom; unsolicited/no-JD = off — kernel visible:false default). Ownership semantics: only rows marked _src:'kernel-gate' are ever created/disabled/re-enabled; a USER-owned masterSite is never touched; a user turning OUR row off is respected forever (_gate bookkeeping). RULE-35 REPAIR regardless of gate: a bare "Details available via Google Scholar" pointer ITEM is hidden and the real link switches on in its place. **(3) LINKIFY-EXPORT-001 (docx-client)** — bare KERNEL-KNOWN URLs (googleScholar, publicationsScholar.url, projects[].url with renderAsHyperlink — the AntCV repo) inside payload strings become markdown [display](url) at buildPayload time, so the PDF carries clickable links wherever the generation wrote a URL; already-markdown occurrences and NON-kernel URLs untouched; publications sections skipped (their citation renderer is markdown-blind — masterSite is their vehicle). Tests: scholar-links.test.mjs (5) + export-links.test.mjs (4); suite 905/905. Cache-bust quintet → 1.51.122 (docx-client ?v bumped too — it changed). OWNER VERIFY: a research-JD application's PDF carries a CLICKABLE "All publications: Full publication record via Google Scholar" line (CloudConvert preserves docx hyperlinks); an AntCV URL in a bullet exports as a clickable link. NOTE: the AntCV project SURFACING for SW/AI/PM JDs (when the gen never mentions it) is gen-prompt work — rides row 28's remaining gen leg, not this render wire.

> **SIDEBAR-RELEVANCE-CUT-001 SHIPPED 1.51.121 (Trackman "much shorter sidebar" + "recommendations on page 3" — spec rules 11/15/19/25/27/32 as a DETERMINISTIC belt, rule 38).** New sidecar antcv-sidebar-relevance-cut.js: on a TARGETED app (meta.company real) with a JD attached, a one-shot JD-relevance cut over the three non-exempt sidebar sections in STORED sections (preview+export parity, per-application, hidden NEVER deleted): **TOOLS** — per comma-token cut judged on the token's OWN words vs the JD (rule 32 "per group AND per value" — a relevant category label must not carry its irrelevant tokens); trimmed tokens upsert into the per-app "Hidden - <category>" review row (TOOLS-HIDDEN-RESIDUE family renders/restores — one-click recovery); zero-survivor rows hide whole (rich: section hidden map, labeled: it.hidden — RICHBLOCK-SHAPE-001 aware via the residue sidecar's shape helpers). **CERTIFICATES** — survives on direct JD overlap or a DOMAIN BRIDGE (quality→quality/process/risk, pm→project management/agile, ai, business-analysis); language + sport certs (Prøve i dansk / Rugby / Concussion) NEVER survive a targeted cut (rule 25); hidden via the section hidden index map. **REGULATORY** — domain lexicon (automotive/weapons/military/imaging/laser/environmental/EMC/chemical/electrical-lab): a row survives on direct overlap, a domain trigger present in the JD, or NO detected domain (conservative keep); Trackman outcome: STANAGs/ASPICE/26262/laser hidden, imaging/EMC/RoHS survive; ≤6 survivors → group sub-headers hidden too (rule 19 flat list). EXEMPT: interests/languages/accessibility (rule 11). ONE-SHOT per app+JD (antcv:sidebarCutStamp) — user un-hides are never re-fought; a new JD re-arms. Kill antcv:disable-sidebar-relevance-cut. Tests: sidebar-relevance-cut.test.mjs (8, Trackman-fixture); suite 896/896. Cache-bust quintet → 1.51.121. OWNER VERIFY: Hard Refresh on the Trackman row → sidebar shrinks (tools trimmed + residue rows in the panel, STANAG/automotive regulatory gone), Recommendations should return from page 3; then re-export (v3 orphan preflight also applies now).

> **TRACKMAN REVIEW (owner 2026-07-03 evening exports, 22:00 — pre-1.51.119) → SLOGAN-FRESH-GEN-001 + SCRUB-RECENT-TARGET-GUARD-001 SHIPPED 1.51.120.** Owner questions answered with evidence from the exported DOCX pair: **(1) "Why did the Trackman slogan not regenerate?"** — the CL exported the NIL slogan ("MAKING THE INVISIBLE MANUFACTURABLE") because `antcv:clSlogan` is a GLOBAL sticky override (its own header says: empty → fall back to meta.subtitle); once the NIL session wrote it, every later targeted gen's fresh subtitle was shadowed (rules 23/33 violated by design). FIX: antcv-cl-slogan-fresh.js — ownership stamping (antcv:clSloganCtx {v,app}) on every value change, zero writer patches; an override owned by ANOTHER app yields to a real fresh meta.subtitle (delete + guard-stash clear — the prose-loss guard's key stash would otherwise resurrect it); owner edits for the SAME app survive regens; unsolicited (standing motto) never touched; legacy unstamped override that mismatches the fresh subtitle = stale by definition → drops (heals the owner's current state on next boot). 8 tests. **(2) "your organisation's hardware platform" in the Trackman CL opening/why (while contribute/goal still say Trackman)** — the unsol-company-scrub fired during a transient meta flip to Unsolicited (row 29 family) and treated the JUST-GENERATED "Trackman A/S" (harvested from its own fresh clProseGuard bucket key, 1.51.98 GUARDKEYS leg) as a stale prior company. FIX: the guard stamps bucket._ts on capture (purge treats underscore keys as metadata); the scrub skips companies whose bucket is <30 min old — a fresh capture is the CURRENT target mid-flip, not carryover; old + unstamped buckets keep the Terma-poison behaviour. 4+1 tests. **(3) "sidebar not much shorter" + "recommendations wandered to page 3"** — same root: the gen IGNORED the 1.51.113 prompt rules (line economy + rules 11/15/32) — the Trackman export kept ALL tools categories and ~21 regulatory rows (STANAG/automotive rows fail rule 27 for a sports-tracking JD); REGULATORY (CONT.) spilled to page 3 and dragged Languages/Interests/Accessibility/Recommendations with it. Deterministic SIDEBAR-RELEVANCE-CUT belt (rule 38) is the NEXT release — prompt text alone is proven insufficient for the third time. **(4) "why so many orphans"** — the 22:00 exports predate 1.51.119 (deployed later that night): the live preflight then still detected at 0.40 fill and could only shorten. Re-export after Hard Refresh on ≥1.51.119 applies the 0.60 floor, kernel-facts lengthening, no-force-justify and sidebar packing. Suite 888/888; cache-bust quintet → 1.51.120.

> **ORPHAN-PREFLIGHT-V3 SHIPPED 1.51.119 (register row 27 MAIN-RUNT-ORPHAN-SWEEP-001 — the recalibration + the rule-30/40 belts, owner baseline RUNT_INVENTORY_UNSOL_20260703).** All in the export-preflight sidecar (antcv-orphan-export-preflight.js) — NO app.js edit. **(1) RUNT_FRAC 0.40 → 0.60:** the owner's fill floor IS the detector threshold now (19 baseline runts sat at 35-58%, all invisible to 0.40); MAX_BIND 6→8. **(2) NO-FORCE-JUSTIFY belt (spec rule 30):** measurement now runs at NATURAL (left) alignment — justified rects report STRETCHED widths, which hid under-filled mid-lines — and a bullet/profile paragraph whose natural NON-last line fills <85% of the column gets a payload `item_alignment` LEFT override on its exact worker path (`roles.N.bullets.M` / `content` — paraAlignPath already honours it, zero worker change); explicit user CJLR on the path or a `__group__` override always wins. Kills the 5 baseline "huge word gap" lines. **(3) L3 can LENGTHEN (owner rule: add a concrete stored detail, never fabricate):** each residue line ships with kernel FACTS (personalInfo.experience bullets+results matched by company — merged roles pull all same-company entries; background+workStyle for profile) and the new safeRewrite gate: original numbers/acronyms verbatim, growth bounded (≤1.9x+20), every NEW number must appear in the facts, no dashes, and the re-measure accepts only fill≥60% with NO line-count gain (fills the runt line — never grows the page). **(4) SIDEBAR-PACKING belt (spec rule 40, deterministic half):** comma-token sidebar values — rich_block `{b,t}` (TOOLS after RICHBLOCK-SHAPE-001) AND labeled_list `{l,v}` — are reordered long+short-adjacent via greedy best-insertion against the REAL export measurer, accepted only when the measured line count drops (or an equal-line order clears a runt); token text never changes; prose/grammar values shape-gated (min 3 comma tokens, no conjunction-led token, no inner punctuation, no semicolon groups); kill antcv:disable-sidebar-packing. **(5) rich_block sidebar rows are now L2 NBSP-bind targets** (v2 only collected labeled_list — every TOOLS runt was structurally invisible). Tests: orphan-export-preflight.test.mjs 24→35 (safeRewrite gates, lengthen e2e incl. fabrication rejection, rule-30 override + CJLR-wins, packTokens shape gates, packing e2e + kill switch + prose guard, rich_block collection); suite 875/875. Cache-bust quintet → 1.51.119 (app.js untouched, stays ?v=1.51.117). REMAINING row-27 legs: Work-style tail-truncation verify against the OWNER's stored kernel (live data — cross-section dedup is banned, verify before blaming render); page-3 ghost (sidebar spill pagination — should shrink as packing lands); the ~1.5-page target measured on a FRESH NIL-targeted generation export (owner/live, spec rule 38).

> **EMDASH-META-CL-PROSE-001 FIXED 1.51.118 (row 29 leg P4d, owner NIL round-4: "exported CL prose carries em dashes").** The em-dash scrub (`antcv-emdash-to-hyphen.js`) only walked `localStorage['sections']`; the CL HEADER prose is sourced from `localStorage['meta']` (meta.opening / meta.greeting / meta.subtitle=slogan), which is LLM-generated and never routed through the section normalizers — so the round-4 export kept a raw em dash ("nanooptics—where…"). All three dash layers (sidecar / DASH-HYPHEN-001 prompt rule / render literals) missed the meta source. FIX: the sidecar now normalises `meta` on the SAME pass as `sections` (both are export sources); loop-safe (per-key fast-bail, single tagged sections-updated event, disable switch honoured). SIDECAR-ONLY — app.js/app.src.js untouched (no minified mirror, no brick surface). Test: `pwa/test/unit/emdash-meta-cl-prose.test.mjs` (7 — meta.opening/greeting/subtitle, sections no-regression, both-in-one-pass, fast-bail no-write, disable switch, malformed-JSON safe). Suite 861/861, boot-smoke green, cache-bust quintet → 1.51.118. Remaining row-29 legs unchanged (277 sequence guard, CL hydration preflight, poisoned-row repair).

> **LONGPRESS-HIDE MOBILE BUGS FIXED + UNDO SHIPPED (1.51.117, spec rule 44).** Owner: menu only offered whole-row hide, the Hidden group never appeared, no panel monkey, eye could not restore ("forever hidden"), and no undo for hiding or sidebar/table resizing. ROOT CAUSE (diagnosed in a real headless boot, diag-longpress-hide.mjs): the runtime tools section is RICH_BLOCK ({b,t,bullets} + {grp:true} rows; per-item visibility = SECTION-LEVEL hidden index map) — the 1.51.114-116 family only understood {l,v}+it.hidden, so tokensOf(v) was empty (no token entries) and it.hidden was ignored by renderer AND panel (flag the eye never reads). FIX: shape helpers (labelOf/valOf/isGroupRow/isRichItem/setVal) across both sidecars; whole-row hide writes the section map for rich rows (monkey + eye now work); residue rows created in the section shape; RESIDUE-PREVIEW-SKIP extended to the rich_block renderer (both bundles); export belt checks b too; restoreToken API + menu "Restore <token>" entries (rich rows have no eye path); diffEvents reads the map. UNDO: section-snapshot stack (20) with bottom toast on every menu hide/restore + "Undo:" menu entry; RESIZE UNDO watches cvSidebarRatio/cvTableRatio/clTableRatio (stable-value detection) and undoes by driving the React roller natively (fast-drag pattern). BONUS REPAIR (APPJS-REGEX-BACKSLASH-REPAIR): app.js CV-PLACEHOLDER-DROP-001 regex had LOST ITS BACKSLASHES (/^s*[[sS]*]s*$/, dead in prod while src was correct) — restored + test-locked. Browser diag: 6/6 PASS, zero page errors; suite 854/854.

> **SIDEBAR-LONGPRESS-HIDE-001 + VISIBILITY-FEEDBACK-001 SHIPPED (1.51.116, spec rule 43).** Owner: long-press a sidebar element in the preview -> selection menu with Hide -> element enters the Hidden group (created if absent); analytics on hide/unhide overrides feed future generations. Delivered: (1) antcv-sidebar-visibility-ux.js — pointer long-press (550ms, move-cancel) or right-click on preview sidebar rows ([data-sid] + data-antcv-row-path) opens a menu: per-token "Hide <tool>" for multi-token rows (token removed from the line + upserted into "Hidden - <category>" immediately) and "Hide entire element" (classic it.hidden). (2) Analytics antcv:visibilityAnalytics (cap 400): menu actions logged directly; an observer diffs consecutive sections snapshots for panel-eye flips and residue-row restores, gated to <=4 changes so generation/restore writes are never misattributed; app context = meta company|role. (3) Feedback loop: latest-decision-per-item summary (KEEP VISIBLE / HIDE lines, cap 30) in antcv:visibility-feedback, injected into the GEN PROMPT after the STORED TOOLS block in BOTH bundles (unique-anchor node patch, parse-gated). Residue reconcile extended: non-kernel tokens (edited/generated wording) hidden via the menu survive the kernel rebuild. 6 new tests incl. both-bundle mirror guard; suite 849/849. NEEDS OWNER EYE: long-press feel on the real phone (timer 550ms, 8px move cancel).

> **TOOLS-HIDDEN-RESIDUE second pass SHIPPED (1.51.115, spec rule 42a) — owner: "place the elements back where they belong (least space), never show that group in preview or pdf".** Two upgrades on 1.51.114: (1) RESTORE PLACEMENT — un-hiding a residue row now inserts each token at the SPACE-OPTIMAL position in the real category line (deterministic word-wrap simulation at sidebar widths 26/30/34 chars picks the insertion index with the fewest total lines; ties resolve earliest so JD-relevance order holds) instead of appending at the end. (2) RESIDUE-PREVIEW-SKIP — the labeled_list preview renderer itself (app.src.js + minified mirror, parse-gated node patch) skips any "Hidden - " labeled row regardless of its hidden flag, so the residue group can never flash in the preview during the eye-click->restore hand-off or with the sidecar disabled; export already belted. Mirror-guard + placement-property tests added; suite 843/843. NOTE self-inflicted repeat of the heredoc hazard: appending a TEST with cat<<EOF ate the assertion backslashes — tests with regex literals also go through Write/Edit, never heredoc.

> **TOOLS-HIDDEN-RESIDUE-001 SHIPPED (1.51.114, spec rule 42) — the PDMS-recovery gap is closed.** Owner design: tools trimmed INSIDE a compressed value (invisible to the row eye-toggle) now surface as a per-application "Hidden - <category>: <tokens>" row in the TOOLS & METHODS panel. Deterministic sidecar (antcv-tools-hidden-residue.js), not an LLM promise: it diffs the section against the kernel master (personalInfo.tools) on every sections update. Review row is hidden:true (never in preview/PDF; docx-client belt also drops any "Hidden - " label from sidebar payloads), appended to the panel, per application only. UX: clicking the eye on the residue row MERGES the tokens back into the real category line — no retyping; hand-re-added tokens heal out of the residue row; still-missing tokens stay reviewable. Gates: skeleton template + zero-kernel-token sections are untouched (no wholesale kernel dumps into a Danish/unrelated list). 8 new unit tests; suite 841/841.

> **OWNER PRIORITY DIRECTIVE executed, wave 1 (1.51.113): "start with 5, then 2, then 4; merged roles join with &".** **(5) CL-GUARD-SKELETON-CAPTURE-002** — the revert-heal loop is CLOSED: the guard classifier now marks ANY bracketed template segment as placeholder in the GUARDED CL prose ids (the >=2 rule missed single-bracket lines like "…where [Company/team] loses time…", so the poisoned contribute was captured as real and never healed; guarded ids carry no legitimate brackets — "[verify]" lives in unguarded application_qa). Purge drops the poisoned bucket entries on next load, fresh real prose captures, and every future stale row-restore auto-heals. 14/14 guard tests. **(1-note) MERGED-TITLE-JOIN-001 (spec rule 41)** — the docx-client role-merge joins with " & " (was " / "); Innoviz ORDER stays "Change Request Lead & System Architect" (CRL is a position); merged bullet cap aligned to 5; joiner test updated. **(2, gen half) SIDEBAR-LINE-ECONOMY-001 (spec rule 40)** — the owner's manual packing technique is now a GEN RULE in the prompt (both bundles): order long+short values adjacent to reduce rendered lines, hide JD-irrelevant qualifications/niche tools, compressed forms; the deterministic measure/pack belt rides the row-27 orphan sweep (NEXT: the orphan work is the main 1.5-page lever). Suite 833/833. QUEUE per the directive: row-27 orphan/no-justify improvements -> (4) Scholar/GitHub hyperlink rendering in the worker -> (3) BRAND-FIT-PALETTE-001.

> **CL AI-NOTICE + RULE-BALANCE round (owner live, PWA 1.51.112 + wk 1.14.128-131).** **(1) CL-AI-NOTICE-FOOTER-001 SHIPPED (wk 1.14.131):** the CL AI notice now lives in the SECTION FOOTER — every page, true page bottom, engine-native. Journey: page-1 sentinel restored (1.14.128) worked (geometrically verified y=832/842), but the page-2 in-cell VML frame was DROPPED by LibreOffice even with an explicit page-relative offset (1.14.129/130 — AI-NOTICE-BOTTOM-CLOUDCONVERT-001: the vertical keyword AND the frame itself are unreliable from inside a table cell); footer replaces the CL sentinels entirely (CV keeps its VML last-page frame). NOTE: 1.14.129 CI failure taught: PAGE_H declares AFTER aiNoticeVmlRun in the bundle and test replicas eval standalone — literal 824pt used. **(2) CL-RULE-BALANCE-002 (preview leg OPEN):** the worker rules are balanced (110/110 exact line, 1.14.127), but the PREVIEW still shows an asymmetric divider — measured live: an EMPTY div ~16px tall (unscaled) with a 2px bottom border and ZERO margins — ALL space above the line, none below; 3 instances in the CL preview; it is NOT the headlineRule div (that one is the patched 9/9) and NOT sidecar-emitted; the hunt needs one live session with getComputedStyle + element ancestry (the measurement tab hit the sign-in gate). Fix shape: give that div half-height + equal marginBottom so the line centres between texts. **(3) Owner verify:** any fresh CL export on wk 1.14.131 carries the notice at the bottom of BOTH pages.

> **FINAL NIL PAIR DELIVERED + VERIFIED (owner live session 2026-07-04, full stack PWA 1.51.112 + wk 1.14.127).** `CV_..._NIL_Technology_..._(9).pdf` — ALL 14 requirement checks green: no banned phrases, zero placeholders, Meprolight merged "&"-form title with BOTH results (SWIR demonstrator + 500->20,000/wk), Innoviz merged with BOTH results (CCB 250->10 + LiDAR -90%), no Security-Guard-class roles, "patented stray-light", education gold (double B.Sc. + nanotech), regulatory 3-row flat, accessibility canon one-liner, Imaging category gone, certs trimmed to 3, Tai-chi one-liner, Kanzen 3 bullets. `CoverLetter_..._(10).pdf` — page 1 = complete signed letter ("At your service,"), page 2 = standalone Q&A page headlined "Responses to application questions:" (no candidate-header line), answers + closing + ALTERNATE "Best regards," (letter sign-off not repeated), balanced rules. REMAINING (registered): the render-level Innoviz merged title still emits the SLASH form "Change Request Lead / System Architect" (rule 17a wants "System Architect & Change Request Lead" — the merge-title generator needs the &-function-first form); CV page-count target ~1.5pp (row 28, gen-level); BRAND-FIT-PALETTE-001 (rule 37); row snapshots still restore stale content on selection (row 29/31 row-repair leg) — every fix this session had to be re-applied after row selection; the 97.5% loop continues on fresh GENERATIONS (these exports were hand-guided).

> **CL polish round SHIPPED — PWA 1.51.111/1.51.112 + docx-worker 1.14.126/1.14.127 (owner live iteration).** **(1) QA page-2 PROPER (wk 1.14.126 deployed via target=docx-worker mode=deploy — NOTE: the bare `gh workflow run deploy.yml` SKIPS deploy-worker; inputs required):** application_qa now uses the worker's dedicated page-2 machinery (was keyed to the legacy jd_questions id), excluded from the body flow, alternate sign-off (letter "At your service," -> page 2 "Best regards,"; da/es/zh variants); client honors a section's own pageBreakBefore in buildPayload (was dropped). **(2) QA-HEADER-TRIM-001 (1.51.111):** no candidate-header line; the page headline is the section title "Responses to application questions:". **(3) QA-SIGNOFF-VARIETY-001:** scaffold carries only the look-forward closing line (sign-off+name are worker page-2 furniture — double print otherwise). **(4) CL-RULE-BALANCE-001 (1.51.112 + wk 1.14.127, worker deploy PENDING):** the standalone/inter-section rule paragraph carried a full line box -> gap above the line ~3x the gap below; now exact 40-twip line + equal before/after 110/110 (sidebar 50/50) in the worker, and the preview rule div is symmetric 9/9 (was 4/6). Suites 833/833 throughout.

> **QA PAGE-2 PROPER SHIPPED — PWA 1.51.110 + docx-worker 1.14.126 (owner: "QnA embedded inside the CL, move to 2nd page; different sign-off").** The export confirmed it: page 1 ended with the Q&A content and the letter's closure/sign-off overflowed to page 2 — INVERTED. Two causes, two fixes: **(a) worker** — the full dedicated-page-2 machinery (hard break, candidate header, own closing + name + AI-disclosure anchor) existed but was keyed to the LEGACY id "jd_questions", which the modern bridge HIDES; it now fires for "application_qa" too, excluded from the body flow, and the page-2 sign-off is an ALTERNATE (QA-SIGNOFF-VARIETY-001: letter's "At your service," -> page 2 "Best regards,"; a Best-regards letter -> "Sincerely yours,"; da/es/zh variants) — never a repeat; **(b) client** — buildPayload DROPPED a section's own pageBreakBefore flag (only measurer/manual breaks survived) — now honored; the scaffold's closing block trimmed to the look-forward line only (sign-off+name are page-2 worker furniture — double print otherwise). Tests updated (qa-kernel-namespace 6/6, detect e2e 4-item shape); suite 833/833; worker ESM parse-gated. Worker DEPLOY pending (gh workflow run deploy.yml) — in tree ≠ live.

> **KERNEL v10 COMPLETED + LEAK-SEED FOUND (owner 2026-07-04 "check if anything else is missing in v10").** Audit of Gabriel_personalInfo_modernized_2026-07-04_v10.json against the canon: engine hooks all present (semantic_constraints, personality+never_render_raw, qualityGuards, mergeGroups, visibilityControls, headlines), gold facts green (languages B1/no-German, education gold incl. double B.Sc., GPAs, foreningsarbejde, patent 241997, no task-force/junior-rugby/Snowflake content). THREE REAL GAPS FIXED IN v10b: **(1) the banned "has not limited his career" sentence lived IN THE KERNEL in THREE places** — background prose, the accessibility field ("It has not limited his career."), and a contactItems row — this is THE SEED that kept re-generating the banned profile/accessibility lines no matter how many prompt rules banned it; kernel-wide string scrub applied, 0 occurrences remain (the app-side PROFILE-ACCESS-SCRUB belt stays as defence). **(2) 6 of 12 roles had NO results** (Kanzen, CRL, SA, both Meprolight, TA) — all filled with the canonical pinned/approved texts; 12/12 now carry results. (3) Scholar+AntCV links added earlier in v10. LESSON (generalise): when a banned phrase keeps leaking, grep the KERNEL/personalInfo sources first — prompts and belts cannot outrun poisoned source data. PDFs: the automation browser session hit the sign-in gate (owner action needed); with 1.51.108/109 live, any export from the NIL row is now belt-enforced regardless of which tab does it.

> **ENFORCEMENT BELTS SHIPPED 1.51.109 (owner "so fix in code!" — spec rules 16/16a/17/18/34/36/38 now DETERMINISTIC, no manual steps).** All in the export path (payload-only; stored sections stay editable): **(1) ROLE-CLASS-HIDE-001** — Security Guard / Students Council / Team Operations Manager never ship in a TARGETED export, regardless of what a stale row restored; **(2) BULLET-CAP-BELT-001** — targeted exports cap plain roles at 4 bullets, merged (function-&-leadership title) roles at 5, keeping the FIRST N (gen orders strongest-first); "&" inside a function name (Sirin) is NOT a merge; unsolicited exports untouched; **(3) PLACEHOLDER-EXPORT-GATE-001** — a payload with a placeholder table ("[Focus area 1]" rows) is a failed-generation snapshot: confirm-dialog before export, kill antcv:disable-placeholder-gate; **(4) SIDEBAR-DEFAULT-32-001** — unset sidebar ratio now defaults to 0.32 (user splitter choice still wins); **(5) ACCESS-MIDDLE-001** (in antcv-profile-access-scrub 1.51.109) — Gabriel-name-guarded canonicalisation of the accessibility row to the owner middle-ground one-liner ("Hearing impaired (cochlear implant); written follow-up works well.") from BOTH extremes. Tests: export-belts-9704.test.mjs (5) + profile-access-scrub 7th; suite 833/833. TOOLING LESSON (twice today): python-heredoc string replacement EATS  into a literal BACKSPACE char inside JS regex literals — the MERGED_TAIL and the gabriel name-guard both shipped broken on first pass and were caught by tests/control-char scan; author JS-literal patches with node scripts ONLY (extends the Bash-heredoc hazard rule). REMAINING queue: BRAND-FIT-PALETTE-001 (rule 37), Scholar hyperlink (needs the owner's Scholar URL), row-repair leg, Q&A worker signature leg, preview-side mirrors of the new belts.

> **META-DRIFT-GUARD-002 SHIPPED 1.51.108 — writer #2 found and killed (row 31), + owner review-2 rules 34-38 filed.** The two cloud-adoption blocks (cold-start restore + Read-from-Cloud) each adopt the cloud row's meta+sections into REACT state; the guard that keeps a live TARGETED draft over an unsolicited/empty row existed on OPPOSITE blocks in the two bundles (minified guarded cold-start only; source guarded Read-from-Cloud only — an appjs/appsrc mirror divergence). The unguarded block in the DEPLOYED bundle was writer #2: every pass re-flipped React meta to Unsolicited and re-clobbered sections (placeholder core_comp, 6-bullet roles, Security Guard back, 1-page CL — the owner's review-2 regressions are all THIS). Both blocks now guarded in both bundles; lock = meta-drift-guard-both-blocks.test.mjs (asserts ZERO unguarded jd_company meta-adoption sites per bundle). Suite 827/827. REMAINING row-31 legs: repair the poisoned NIL row (meta Unsolicited + qa on:false in its snapshot) and stop auto-save persisting a downgraded meta into a targeted row. NEW OWNER RULES (spec 34-38): accessibility middle ground ("Hearing impaired (cochlear implant); written follow-up works well."), Google Scholar as a real hyperlink, sidebar 32% default (user-changeable), BRAND-FIT-PALETTE-001 (brand fit selected but export stayed copenhagen — the sampled JD colours #0373c6/#00355a never reach the palette layer), and the 97.5% STANDING ORDER: deterministic belts for every checkable rule (incl. placeholder-table export block). These + rows 26-31 form the active campaign queue.

> **QA-SECTION-DURABLE-001 + QA-STANDALONE-PAGE-001 SHIPPED 1.51.107 (owner: "why are you still not generating QnA page as part of the application? implement properly").** Root cause of FOUR lost Q&A pages: the questions KEY is tab/app-namespaced (empty in every fresh tab, on kernel, and on any app id other than the one the bridge wrote) while the PAGE lives in sections — and the scaffold trusted the key over the section, auto-hiding a REAL page on every empty read (the 1.51.106 kernel-only guard was insufficient: app-434-selected/questions-under-435 hid it again). PROPER FIX: (1) once built, the SECTION is the durable source of truth — a Q&A section with real answer content is NEVER auto-hidden, from any namespace; only contentless scaffolds may hide; stale-page risk belongs to generation-replace + manual toggle. (2) Spec rule 24 delivered: the page is SELF-CONTAINED — after the answers it carries its own closing line, sign-off (antcv:clClosing) and name (antcv:clSignName), and the section always splices/moves to the very END of the CL (after the 1.51.90 sign-off/signature elements) so page 1 stays a complete signed letter. Tests: qa-kernel-namespace.test.mjs rewritten to the durable semantics (6) + detect e2e updated; suite 825/825. REMAINING worker leg (register): duplicate the signature IMAGE + per-page AI notice on the Q&A page (worker renders one signature block at doc end — with the QA page last, the signature now lands ON the QA page; page-1 signature needs the worker-side block duplication).

> **NIL LIVE-REVIEW SESSION (owner 2026-07-04 morning, iterating on the delivered pair) — edits applied live + spec rules 25-33 generalised.** Owner-directed content fixes applied to the live NIL application and PROVEN in `CV_..._NIL_Technology_..._(6).pdf` (now 2 PAGES, down from 6): Kanzen 3 bullets (rule 16a), Meprolight merged as "Electro-Optics Engineer & Team Leader" 2010-2014 with BOTH real results (SWIR 250h demonstrator + 500->20,000 units/wk; rule 28), Innoviz roles each carry their own result, Security Guard / Students Council / Team Ops hidden (rule 18), Imaging category removed + tools values JD-trimmed (rule 32), education in the owner's GOLD 4-line form incl. the double "B.Sc. Physics & B.Sc. EE" (rule 31 — a relevant degree was WRONGLY dropped once), regulatory cut 20->3 flat rows (rule 27), slogan "MAKING THE INVISIBLE MANUFACTURABLE" (rule 33); CL "(6)" carries the Q&A page (QA-KERNEL-NAMESPACE-001 fix held). STILL PENDING (browser link dropped mid-batch): accessibility -> "Hearing impaired." (rule 26), certificates JD-cut (rule 25), Software/Quality deeper trim + Product & systems removal, Tai-chi one-liner (rule 29), then ONE final CV export. PROCESS: edits must be applied + exported in the same tick (restore storm re-clobbers within seconds — meta flipped twice more DESPITE the 277 guard ⇒ a SECOND downgrade writer exists; row 29 stays open for it), and saved-row selection restores STALE snapshots.

> **OWNER ROUND-4 REVIEW (2026-07-04) → spec rules 14-24 filed (row 28).** 11 items from the first NIL-targeted export. THREE are ENFORCEMENT-BELT cases — the gen prompt already bans them and the model violated the rules, so prompt text alone is proven insufficient: (a) profile contained "Has worked with people from many backgrounds; hearing impaired, which has not limited his career." (violates PROFILE-NO-FILLER-001 + PROFILE-NO-DISABILITY-001 + ACCESS-NO-COMMENT-001 in one sentence) → build a post-gen PROFILE/ACCESSIBILITY SCRUB sidecar (strip disability mentions + the banned career-comment phrase + generic people-filler from profile_content; tighten the accessibility row); (b) same phrase class banned everywhere; (c) em dashes in meta-sourced CL prose (round-4 note). TWO are RENDER/STRUCTURE features: CV header must keep the adapted SPECIALIZATION line (the "Application: role — company" line displaced it, rule 14) and CL Q&A must be a REAL separate page (own candidate header, closure, sign-off, name, signature, AI notice — rule 24, extends APPLICATION-QA-001 P1). The REST are gen-prompt tightening for the targeted path (rules 15-19, 21, 23): tools aggressive hide, 3-4 bullets/role, merged-role ≤5 bullets + >1 Result, hide Security-Guard-class roles, regulatory flat-when-few (STANAGs out for NIL), patent WORD in the stray-light bullet, and a per-role SURPRISING slogan (the standing "PROCESSES • PRODUCTS • PEOPLE" must never survive a targeted gen). All verifiable against the live NIL application state (still loaded in the app — regen loop available).

> **NIL DELIVERY RUN (owner "show me that you do it and give me the nil pdfs") — DELIVERED + verified on 1.51.105.** Final artifacts in Downloads: `CV_..._NIL_Technology_..._20260703 (2).pdf` (4pp: no banned career-comment/filler, no placeholders, "patented stray-light" in, no hearing mention on p1) and `CoverLetter_..._NIL_Technology_..._20260703 (5).pdf` (2pp: Dear Vladimir Miljkovic, 5 NIL mentions, Q&A page present, zero placeholders, no "your organisation"). Run notes: (a) the META-DOWNGRADE-GUARD held — no meta revert through reloads/exports once 1.51.105 was live; (b) the flip-window company scrub had rewritten "NIL Technology"->"your organisation" in the CL prose AND the guard bucket re-captured the scrubbed copy - repaired live (6 replacements) and re-persisted via the row; (c) NEW FINDING (row-29 family): a FRESH TAB boots on the "kernel" JD-scope namespace, so antcv:applicationQuestions reads EMPTY until an app row is selected - the CL export then silently drops the Q&A page (three 1-page CLs produced this way). The export/QA reader should resolve the ACTIVE ROW's questions namespace, not the tab default; also the saved NIL row still restores a STALE pre-repair snapshot on selection (row re-save only after live repair). Both folded into row 29 follow-ups.

> **META-DOWNGRADE-GUARD-001 FIXED 1.51.105 + profile-scrub rich_block shape 1.51.104 (row 29 ROOT CAUSE caught live and closed).** Delivering the owner's "show me you do it" run, the REVERT reproduced IN FRONT of the probe: with the NIL app active, the header flipped to "Open Application — Unsolicited" mid-session; re-selecting the NIL row then wrote Unsolicited meta from the row's OWN saved payload — the poisoning chain confirmed end-to-end: (1) antcv-generate-cloud-sync-277's GET mirror wrote the STALE cloud active_application's jd_company ("Unsolicited") over the fresh targeted meta (probe stack: app.js Object.set ← 277); (2) auto-save persisted the flipped meta INTO the NIL application row; (3) every later row selection loads Unsolicited. FIX (1.51.105): 277's meta mirror now refuses a DOWNGRADE — incoming company empty/"Unsolicited" never overwrites a local real-company meta; upgrades and company→company changes still mirror; kill antcv:disable-meta-downgrade-guard; 5 vm tests against the REAL sidecar (meta-downgrade-guard.test.mjs) incl. the upgrade + kill-switch controls. ALSO 1.51.104: the profile/access scrub missed the rich_block items[].t profile shape (the live NIL row's shape — banned sentence survived 1.51.103); now both shapes scrubbed, 6th test. Suite 819/819. Row-repair procedure (poisoned rows): select row → set meta right → auto-save re-persists (done live for the owner's NIL row after deploy).

> **ROUND-4 REVIEW BELTS SHIPPED 1.51.103 (owner's 9+2 item review → spec rules 14-24; the two deterministic rules enforced NOW).** **(1) PROFILE-ACCESS-SCRUB-001 (rules 20+22)** — new sidecar antcv-profile-access-scrub.js: the model VIOLATED three existing prompt bans in one exported sentence ("Has worked with people from many backgrounds; hearing impaired, which has not limited his career." — PROFILE-NO-FILLER-001 + PROFILE-NO-DISABILITY-001 + ACCESS-NO-COMMENT-001), so prompt text alone is proven insufficient. The belt drops disability/filler/career-comment SENTENCES from the profile (abort under 20 chars — regen's job), and strips the banned "has not limited his/her/their career" CLAUSE from every cv+cl string including the Accessibility row. Kill antcv:disable-profile-access-scrub; 5 tests. **(2) PATENT-WORD-001 (rule 21)** — the Sirin stray-light Results pin now reads "Co-invented the patented stray-light optical window, now in commercial devices." in BOTH byte-identical copies (docx-client + antcv-gabriel-results-pin.js); the previous form joined old[] so stored data self-upgrades; the patent NUMBER stays only in Publications. Suite 813/813. REMAINING from the review (gen-prompt + render, rows 28/29): specialization line (14), aggressive tools cut (15), 3-4 bullets (16), merge ≤5 bullets + >1 Result (17), role-class hiding (18), flat regulatory + STANAG cut (19), adaptive surprising slogan (23), Q&A standalone page with own header/closure/signature/AI notice (24).

> **NIL ROUND-4 = SUCCESS (night 2026-07-04, owner "fix them with probe now you push and generate" — probed live generation run BY the assistant in an MCP tab on the owner's origin).** Full run with a writer-probe on meta + scope keys: JD attached as .txt through the app's own dropzone (known-good extracted text, file named "Nanooptics Prototyping Engineer - NIL Technology.txt") → Generate (3/3 ≈7 min) → **meta stamped "NIL Technology / Nanooptics Prototyping Engineer", greeting "Dear Vladimir Miljkovic,", Q&A bridge fired (antcv:applicationQuestions 1455ch, application_qa section present)** → meta SURVIVED a reload (boot restore: zero meta writes) AND a PDF export → **both exports NIL-NAMED in Downloads** (CV_…NIL_Technology_Nanooptics_Prototyping_Enginee…pdf + CoverLetter…): CL = 2 pages, 0 placeholders, 5 NIL mentions, personalized greeting, Q&A page 2 with both questions. THE APPLICATION IS READY. REFINED DIAGNOSES for the two rounds-2/3 bugs (kept open, now precisely bounded): **(A) revert** — did NOT reproduce; the probe caught `antcv-generate-cloud-sync-277.js:195` writing STALE meta ("Unsolicited") from cloud state at gen START (harmless pre-result here) — in the owner's runs the same writer landing AFTER the gen result (slower cloud round-trip, second open tab) is the revert; FIX DIRECTION: 277 must never overwrite a NEWER local meta with OLDER cloud state (sequence/timestamp guard). **(B) CL empty** — a HYDRATION RACE, caught live: at gen-complete the opening/why/who SECTIONS still held skeleton/instruction text while the real prose sat in meta/cl_overrides; the sections self-healed within minutes (+reload); the owner's fast exports raced the hydration; FIX DIRECTION: synchronous cl_overrides→sections apply, or an export preflight gate (meta.opening real + opening section placeholder → hydrate before building the payload). MINOR: exported CL prose carries em dashes ("nanooptics—where…") — the em-dash scrub missed meta-sourced CL prose (emdash-three-layers, add the CL-prose path). Row 29 stays open for (A)+(B) implementation; row 28 (sidebar cut / merge / 1.5 pages) unblocked — the targeted state sticks.

> **NIL ROUND-3 (owner "some generation - but most empty and not nil identified", exports "(3)"/"(2)" on 1.51.102) — the extraction stack is DONE, the fight moved to state persistence + CL fill.** Wins proven by this round: garble→vision→parse all green (the 2 REAL NIL applicant questions sit in localStorage rationale.questions_in_jd), and company identification WORKED mid-generation — the CL prose guard captured foundation+contribute under the key "NIL Technology|Nanooptics Prototyping Engineer", which it can only do while meta.company was literally "NIL Technology". The two remaining failures: **(A) POST-GEN REVERT (row 29, updated with the round-3 evidence + morning method — setItem-writer probe on meta during one live gen; prime suspect = same-device stale cloud active_application pointer re-adoption, which the foreign-device guard deliberately allows);** **(B) CL MOSTLY EMPTY** — opening/why/who/greeting exported as skeleton/placeholders ("Dear [Hiring Team / Name],") while foundation/contribute were real, across a 4-attempt forced-provider ladder — pull D1 llm_calls for the round; the ⚠️-CRITICAL fill contract + retry validator exist, so either every attempt failed validation (then WHY was a partial accepted?) or the accept path keeps partials silently. NO night patch to the restore chain (blue-screen history — diagnostic-first with the live probe in the morning).

> **JD-VISION-PROVIDER-001 FIXED 1.51.102 (owner "stuck on this after uploading pdf" — extraction now fails LOUD instead of silently hallucinating, and the loud failure exposed the routing bug).** The owner's re-upload of the NIL PDF on 1.51.101 produced the final throw with diag chain `pdfjs_garbled; garbled_skip_llm_for_vision; vision_insufficient` (recovered from antcv:errorLog via the probe tab — the new legs worked: garble caught, doc-LLM skipped). Root cause of vision_insufficient: the vision tier calls ee(task "long_context") with page IMAGES; Z.long_context = [claude, openai, gemini] but ee() APPENDS every configured provider for non-mechanical tasks and the cost-quality scorer reorders the pure-default path — with the owner's keys (mistral+anthropic) mistral can land FIRST, cannot see the images, returns a short non-answer that ee() treats as SUCCESS (the adequacy gate only covers parse_jd/generate_cv) → <100 chars → vision_insufficient → throw; claude never saw the pages. FIX: the vision call is now `{ task: "long_context", preferGPT: !1 }` — the EXPLICIT claude→openai→gemini→mistral order (scorer skipped, vision-capable first, mistral last resort). Translation's long_context call keeps default routing. app.src.js + single-site minified patch (disambiguated via the adjacent method:"vision"); test = 2 new locks in jd-extract-hardening.test.mjs (13/13). Suite 804/804. FOLLOW-UP (register row 30): ee() should be image-AWARE — when messages carry image blocks, drop vision-blind providers from the ladder instead of relying on call-site ordering; and consider extending the adequacy gate to vision calls. OWNER MORNING VERIFY: hard refresh → re-upload the NIL PDF → expect the amber OCR chip + real nanooptics text + Generate unlocked.

> **NIGHT SESSION 2026-07-03/04 (owner asleep, "see you in morning") → NIL round-2 diagnosis + CL-GUARD-SKELETON-CAPTURE-001 FIXED 1.51.101 + morning verify list.** Round-2 exports ("…(1).pdf") + live probe of the owner's origin (1.51.100 bundle confirmed): the CL PDF is the raw me() SKELETON ("I am applying for [Role title] at [Company]…"), the CV still carries Security Guard, ZERO NIL mentions in either doc, filenames Unsolicited — yet clProseGuard now holds a **"NIL Technology|Nanooptics Prototyping Engineer" bucket**, so a NIL-TARGETED GEN DID RUN (extraction + analysis worked — the 1.51.99/100 vision path did its job). EVIDENCE CHAIN: (a) the NIL bucket contains the SKELETON (2164 bytes, byte-equal to the "|" bucket) ⇒ at capture time meta was NIL but the CL body was still the skeleton ⇒ **the NIL CL generation produced no prose** (empty CL leg — same family as CL-BLANK-CAPTURE-001); (b) current meta=Unsolicited/Open Application, lastJdText EMPTY, per-app scope keys show ONLY app 434=Unsolicited (jdText empty) + kernel=Unsolicited ⇒ **no NIL app row exists on-device — the targeted state had nowhere to persist and the boot restore re-pinned Unsolicited** (targeted-app-persistence family, 1.50.728-732, but for an app row that was never created); (c) sections.cl now = skeleton ⇒ the failed-CL skeleton also REPLACED the live CL. FIXED NOW (1.51.101): the guard captured the skeleton because isPlaceholder() only tested first-char-'[' — the skeleton BODY starts with plain words. New rule: >=2 bracketed template segments = placeholder (one "[verify]" token stays real); plus a boot purgeSkeletonSnapshots() that self-heals the owner's poisoned NIL/"|" buckets on next load. Tests: cl-guard-skeleton-capture.test.mjs (4) + all 10 existing guard tests green. **MORNING WORK ORDER (root causes, diagnostic-first): NIL-TARGETED-STATE-STICK-001** — (i) why did the targeted gen not create/stamp an app row (meta reverted to Unsolicited on boot restore); (ii) why did the NIL CL generation return an empty body (check D1 llm_calls for the CL leg — provider/adequacy); (iii) owner asks folded into register row 28: cut Security-Guard-class irrelevant roles + MERGE (spec rule 12), consolidate the targeted CV to ~1.5 PAGES (new page target), filename must follow meta once (i) sticks. Register rows 28+29.

> **JD-SCAN-HALLUCINATION-001 remaining legs SHIPPED 1.51.100 (owner: "straighten it").** All three open legs from the original diagnosis are now in: **(1) detector hardening** — f() gains language-neutral charset statistics before the EN/DA common-word check: replacement-char flood (>10 �), control/private-use-area glyph ratio >5%, Unicode letter+digit ratio <35% of non-whitespace (>200 chars). The REAL NIL garble fires BOTH new gates (letter ratio 0.102, ctrl/PUA ratio 0.831 — measured); Danish/Hebrew/Chinese JDs verified NOT flagged (\p{L} is script-neutral — the 23-language program is safe). **(2) filename↔content echo** — h() wraps all three success returns in fnEcho(): tokenize the file base name (≥4-char letter/digit tokens, EN/DA stopwords dropped), and if NO token appears in the extracted text, append `filename_mismatch(tok,…)` to warning + console.warn — never blocks. Catches both wrong-document reads and whole-cloth hallucination ("NIT Calicut" would have been caught: no "nanooptics"/"technology" echo). **(3) visible notices** — the upload chip caller now PROPAGATES warning into the upload state (it was dropped), and the chip renders two amber lines: "📷 Read visually (OCR)…" when method=vision, and the filename-mismatch warning. app.src.js + 7-site surgical minified patch (single parse-gated node script, $()/B()/tn/nn names verified in-bundle); tests pwa/test/unit/jd-extract-hardening.test.mjs (11: both-bundle marker locks incl. warning propagation, detector replicas incl. 3 languages + 3 garble classes, fnEcho replicas incl. generic-filename no-false-positive). Suite 798/798. STILL OPEN from the original spec: filename↔PARSED-COMPANY cross-check at parse_jd level (the echo check is text-level). OWNER VERIFY unchanged: upload the NIL PDF → expect the OCR amber notice + real nanooptics text.

> **JD-SCAN-HALLUCINATION-001 IMPLEMENTED 1.51.99 (owner 2026-07-03: "why do I need the extracted txt — I want to extract from PDF!").** The NIL JD PDF was believed text-less; it actually HAS a text layer with broken ToUnicode font maps — pdfjs extracts ~1500 chars/page of control glyphs (verified with pymupdf on the real file: 4.2k chars, 760 "words", common-word ratio 0.0). The garble detector f() DOES flag it (verified by replicating f() in node against the real extraction) — the bug was the next hop: the extraction ladder handed the SAME corrupted stream to the document-LLM tier (task extract_pdf), where providers without native PDF page rendering hallucinate a plausible JD, and f() cannot flag fluent hallucinated output. The long-documented fix is now IN: `pdfjs_garbled` skips the document-LLM tier and goes STRAIGHT to the vision tier (renders up to 6 pages at scale 2 → vision extraction — the same recipe that produced the correct NIL text manually). app.src.js + surgical minified mirror (Write-authored node patch, parse-gated); test pwa/test/unit/pdf-garbled-vision-first.test.mjs (4: both-bundle branch lock incl. garbled-before-image-only ordering, detector true-positive on NIL-shaped garble, no false positive on a clean JD). Suite 787/787. OWNER VERIFY (this IS the NIL flow now): hard refresh → upload the NIL JD PDF in the app → console should show "[extractPDFText] garbled text layer — skipping LLM-document step … going straight to vision OCR" → extracted text must contain "Nanooptics Prototyping Engineer" + real requirements → Generate. The Downloads txt file is no longer needed.

> **UNSOL-SCRUB-GUARDKEYS-001 FIXED 1.51.98 (owner 2026-07-03: "NIL application resulted with Unsolicited/Terma!!").** Live-probed the owner's origin (fresh MCP tab, bundle verified 1.51.97 — NOT stale SW). TWO stacked causes: **(a) the gen was genuinely UNSOLICITED** — antcv:lastJdText was EMPTY at gen time (the NIL JD was never durably attached; the NIL row's jd_text history is register row 28 / nil-application-state), so meta = Unsolicited/Open Application, filenames match; **(b) the CL prose was the stored TERMA letter** — sections.cl still carried the last Terma-targeted generation's body (the clProseGuard bucket "Terma A/S|Senior Systems Engineer – Electro-Optical Systems" opening is byte-identical to the exported CL), and the 1.51.77 Patch D scrub could NOT fire because its ONLY name source, antcv:activeAppCompany, was null (the Terma gen predates that key). FIX: antcv-unsol-company-scrub.js 1.51.98 harvests prior-company names from the clProseGuard bucket KEYS too (company half of "Company|Role"), plus a legal-suffix-stripped variant ("Terma A/S" → "Terma" — prose drops the suffix), longest-first alternation, employer protection per name, "|" skeleton bucket ignored. Tests 6→9 (guard-key scrub with empty activeAppCompany; employer/skeleton buckets never trigger; _stripLegal). Suite 783/783. On the owner's next boot ≥1.51.98 the sidecar scrubs Terma → "your organisation" in the stored sections. THEN the NIL flow: paste the JD text (Downloads\NIL_JD_extracted.txt) into the app's JD box on the NIL row → Generate → row 28 verify list (targeted meta, adapted slogan/spec, CL Q&A page).

> **OWNER 2026-07-03 "do not forget" → NIL-GEN-ADAPTATION-001 (register row 28).** Four requirements for the NIL targeted generation, filed as spec rules 10-13 in docs/qa/JD-SPECIFIC-CV-COMPRESSION-SPEC.md: (10) adapt SPECIALIZATION (personalInfo.specialization / Application band) + CL SLOGAN (standalone antcv:clSlogan keys) to the JD; (11) cut everything JD-irrelevant from the SIDEBAR with a hard exempt list — Interests, Languages, Accessibility always stay; (12) MERGE low-relevance positions and remove/rephrase bullets (use the variant-tolerant _samePosition machinery — never ghost/duplicate a role); (13) the position has applicant QUESTIONS → the CL must get its SECOND (Q&A) page — machinery already shipped (APPLICATION-QA-001 P1 + antcv-application-qa-detect.js bridge from rationale.questions_in_jd / jd-analysis), it never fired for NIL because parse_jd crashed before rationale persisted (LADDER-CONST-CRASH-001 below). ORDER OF OPERATIONS: owner retries the NIL generation on ≥1.51.97 first; (13) should then fire on its own — verify; (10)-(12) are gen-prompt + trim-sidecar implementation per the spec. NIL JD source: pdfjs-extracted text (Downloads\NIL_JD_extracted.txt; direct lastJdText writes get clobbered — re-attach via the app).

> **LADDER-CONST-CRASH-001 FIXED 1.51.97 (owner 2026-07-03, NIL generation parse_jd failure).** Owner error: `All 2 LLM providers failed for task "parse_jd": mistral (bad_input): inadequate or truncated output (5 chars)… mistral (unknown): Assignment to constant variable.` The second line is OUR TypeError, not a provider failure: the ee() ladder's 1.50.290 inadequate-output branch carried a vestigial `s = new Error(provider + " returned inadequate output")`, but `s` in that scope is the CONST transient-retry delay array `[2e3,5e3,1e4]` — the assignment THREW, the outer catch logged the SAME provider a second time (hence "2 providers", both mistral), and any remaining ladder providers were reached only via the catch path with a misleading aggregate. Fix: the assignment is dead code (`continue` starts the next provider iteration with a fresh `s`) — removed in app.src.js + surgical minified edit (Write-authored node patch, parse-gated); regression lock pwa/test/unit/ladder-const-crash.test.mjs (4 tests, both bundles: vestigial Error gone + adequacy gate/continue survive). Suite 780/780. RESIDUAL for owner: the ladder held ONLY mistral — with an Anthropic key present, parse_jd should fall through to claude; verify the Anthropic key is actually saved in ⚙ Settings → API Keys on THIS device (own-key filter restricts the ladder to providers with a stored key). Also mistral returning 5 chars for parse_jd suggests the mistral default model is too weak/token-capped for big-gen — candidate for the model-freshness/scorer review.

> **OWNER 2026-07-03 → two NIGHTLY work orders from the unsolicited export "…20260702 (4).pdf" (inspected with pymupdf, evidence = docs/qa/RUNT_INVENTORY_UNSOL_20260703.md).** **(1) TOOLS-SIDEBAR-COMPRESS-001 (register row 26)** — the unsolicited TOOLS & METHODS sidebar is "not compressed enough"; owner supplied the GOLD target (screenshot): **Instruments** → `Optical benches, HRSEM, confocal imaging, interferometry, Raman spectroscopy, probe stations` (reordered + tightened: "confocal imaging" not "confocal microscopy", "probe stations" not "electrical probe stations", and when tight it is OK to keep HRSEM and DROP SEM); **Lab & fabrication** → end at `…SOI MEMS/NEMS` (drop the trailing word "fabrication" — the label already says it); Quality & process + AI-assisted stay as-is. Where: Gabriel sidebar TOOLS & METHODS content is rich_block (do NOT convert — cl-leadins-and-methods-richblock) and flows through the compress path + tools-corecomp-dedup sidecar; encode the tightening as compression RULES (item-level synonym/trim table for the Instruments/Lab lists), not a hardcode, and mirror wherever the unsolicited kernel pins these lists. Acceptance: sidebar block renders the gold text (preview + PDF parity). **(2) MAIN-RUNT-ORPHAN-SWEEP-001 (register row 27, "inspect thoroughly and make ready during nightly")** — the same export has BOTH failure directions at once: (a) ~19 prose paragraphs whose LAST line fills <60% of the main column (worst: "electro-optics and automotive." 35%, "using Python and statistical modelling." 44%, full list with y-coords in the inventory doc), including ONE whole single-line bullet at 58% ("Conduct feasibility studies and prototype validation."); (b) 5 mid-paragraph FORCE-JUSTIFIED lines stretched with huge word gaps (p1 y757, p2 y63/91/119, p4 y310 — reads as the orphan-fix stretching instead of rebalancing); (c) a NEARLY BLANK page 3 (2 sidebar spill lines, zero main content); (d) WORK-STYLE TRUNCATION suspicion — the paragraph ends "…across engineering, suppliers" (no period) while PROFILE above ends "…suppliers and management." — looks like a tail dedup/tighten cut it; cross-section dedup is BANNED (owner compression spec). Machinery to recalibrate: orphan-measure-bind v2 (export-metric preflight 1.51.57 + sidebar L2 1.51.71) — it currently under-fixes (orphans survive) AND over-fixes (sentences compressed to <60% lines); target = last-line fill ≥60% via merge/expand/rebalance, never mid-line force-justify, and verify Work style completeness against the stored kernel FIRST (diagnostic-first). Sibling same-session: AMP-ADJACENT-001 fixed 1.51.96; TABLE-GEOMETRY-PARITY-001 row 25.

> **SESSION 2026-07-02 → 1.51.96 — AMP-ADJACENT-001 FIXED + TABLE-GEOMETRY-PARITY-001 filed (owner, Core Competencies table).** **(1) AMP-ADJACENT-001 FIXED (1.51.96)** — owner typed "V&V and compliance" in the table's first column; the PREVIEW kept rendering "V&V & compliance" ("the app keeps reverting it"). Cause: two render-time tighteners `.replace(/ and /gi," & ")` — the preview React table (app.src.js case "table" mk, ~5906) and the HTML-export table (~27025, `" &amp; "` variant). Stored data was never touched (the PDF already showed "and" — the DOCX path reads rows raw). Owner rule now encoded: tightening " and " → " & " is WANTED, but NOT next to another "&" (aberrations like V&V, R&D, Ben & Jerry's stay "and"). Fix = neighbour-guarded replace at both sites: `/(\S+) and (?=(\S+))/gi` with a callback that keeps "and" when either adjacent word carries "&"; lookahead keeps chains ("a and b and c") tightening. Behaviour-verified on 7 cases incl. AND/And case-insensitivity. Surgical minified edit + app.src.js mirror; full cache-bust (app.js?v + version-override?v + seed + SW CACHE + TARGET/STALE). NOTE for the record: the first minified patch attempt via perl-in-Bash ATE the regex backslashes (`(\S+)`→`(S+)`) — the known Bash backslash-eating hazard; repaired via a Write-authored node script and byte-verified. **(2) TABLE-GEOMETRY-PARITY-001 (OPEN — nightly, diagnostic-first, measure in the REAL CloudConvert PDF).** The Core Competencies table in the exported PDF does not match the preview in dimensions or wrapping: owner drags the column splitter in preview so each first-column label fits ONE line ("Product & systems"), but the PDF wraps those labels to two lines (narrower first column and/or wider glyphs); owner requirement: "no squeezed table, no letters after border, in either format". The forwarding PIPELINE EXISTS (WIB-TABLE-DIMS-001, docx-client ~1969-2005: standalone antcv:tableWidthPct map + cvTableRatio/clTableRatio localStorage → s.tableWidth DXA + s.tableRatio → worker renderCompetencyTable; preview handle = ke() app.src.js ~4699, ratio clamp 0.15-0.5), so this is a FIDELITY gap, not a missing wire. Diagnose before patching: (a) dump the actual exported tableRatio/tableWidth for the owner's CV vs the preview's rendered th width %; (b) font metrics — preview font vs Carlito in LibreOffice (same pt, different advance widths → different wrap points); (c) padding mismatch (preview 7px 10px vs export 3pt 7.5pt) and border accounting; (d) the HTML-export row clamp (`-webkit-line-clamp:2` + max-height) can CLIP glyphs at the row edge — candidate for "letters after border"; (e) preview clamp is 3 lines (case "table" y style) vs export 2 — unify. Acceptance: same wrap count per first-column label in preview and real PDF at the owner's dragged ratio, no glyph crossing a border in either. Register row 25.

> **ANALYTICS-BUTTONS-SESSION-TIMEOUT-001 (owner 2026-07-03, DOCUMENTED — diagnose before patching; nightly target).** Pressing ANY of the Settings admin ANALYTICS buttons (⬇ Export JSON / ⬇ Export CSV / 📊 View summary — app.src.js ~35800-36035) produces a SESSION TIMEOUT error and an app RESTART. The buttons fetch `${proxyUrl}/analytics/sessions|summary` with credentials:include and have LOCAL 401/403 alerts — a full restart means something GLOBAL fires. PRIME SUSPECT (code-confirmed, not yet live-confirmed): antcv-auth.js wrappedFetch — isRelayUrl() matches EVERYTHING under proxyUrl (so /analytics/* too), and its 401 rule wipes the auth token whenever the response body error contains unauthenticated/expired/**auth** — note indexOf("auth") also matches "unauthorized"! So an analytics endpoint answering 401 {error:"unauthorized"} (admin-scope check, cookie-vs-Bearer mismatch, or endpoint not deployed) nukes the WHOLE session -> login gate reboot, before the local alert is even seen. NEXT (nightly, diagnostic-first — fetch-wrap chain has blue-screen history, NO blind patch): (1) headless repro — stub a 401 {error:"unauthorized"} from /analytics/* and assert the token wipe + gate; (2) live probe — capture the REAL status+body the deployed proxy returns for the owner-admin on each of the 3 endpoints; (3) fix candidates: scope the wrapper wipe to /auth/* + /api/prefs (or require body.error==="unauthenticated"/explicit "expired"), and/or fix the analytics endpoints auth server-side; regression test both. Register row 24; also first named target of NIGHTLY_PREVIEW_BUTTON_AUDIT (row 23).

> **OWNER 2026-07-03 → two NEW work orders filed (register rows 22 + 23), 1.51.88/89 shipped earlier this session.** **(22) CL-SLOGAN-RICHCONTENT-001** — the COVER LETTER SLOGAN is to be a RICH_CONTENT object: a rich_block-class element of the CL (headline/rule/CJLR capabilities like the other CL sections), surfaced as a cover-letter settings element (the control already sits in the CL FORMAT panel via F3). HARD CONSTRAINT: the slogan lives in STANDALONE localStorage keys precisely because cloud-restore clobbered section-based prose (sidecar-prefs-clobber-hazard) — the rich_content version must keep restore-safety (section shape mirroring the keys, or section-first with the keys as durable backing). Spec before splicing: touches me().cl skeleton + converters + worker buildLinearDocument + the 3 render sites. **(23) NIGHTLY-PREVIEW-BUTTON-AUDIT-001 (standing nightly order)** — check ALL buttons for activity on the PREVIEW region (CV + CL visualisation): every button must produce a state/store/DOM delta (this session found THREE dead CJLRs writing input-only keys), AND the values each control sets (CJLR positions, colors, roller/thickness etc.) must be verified to reach PDF generation (buildPayload → worker), not preview-only. File dead + preview-only controls as bugs.

> **SESSION 2026-07-03 (fable, live round 2) → 1.51.90 — roller reset FIXED + float-spine verdict + relay-400 observation.** (1) **SETTINGS-ROLLER-RESET-001 FIXED (1.51.90)** — hypothesis (a) CONFIRMED live: `history.back()` with Settings open was a REAL navigation (the probe's eval context died mid-flight); the roller-side buttons send Back/Forward, no SPA history guard → leave + return re-boot (Loading gate) + persisted settingsTab = the mini-reset. Fix = `antcv-settings-history-guard.js`: sentinel history state while Settings is open; Back consumes it → popstate re-pushes + clicks ✕ (Done fallback); kill-switch `antcv:no-settings-history-guard`; setTimeout debounce, never rAF (STICKY-LEAK-005). `diag-settings-history-guard.mjs` proves BOTH directions (guarded = marker survives + panel closed + sentinel re-armed; kill-switch control = navigates away — the reset, reproduced). Suite 831/831. OWNER VERIFY: hard refresh → Settings → roller-side button → panel closes, NO gate. ACCOUNT-SCROLL-RESET-001 (06-13) is very likely the same mechanism — verify-and-close after owner confirm. (2) **FLOAT-SPINE-001 flag-on render FAILED the owner gate** (register row 3): flag-on export shows role text OVERLAPPING (floated continuation tables pack onto each other in the CloudConvert render). Default stays OFF; control path byte-clean, zero prod impact. Structural parity with the "_3page proper" reference was insufficient — the hand-fix ALSO equalized every page-table grid (handoff A.2, not in the flag), and LO likely collapses the emptied page-break anchors so both floats anchor at the same Y. NEXT: byte-diff flag-on document.xml vs the reference docx; add A.2 grid equalization + real spacer anchors; owner re-export. (3) **OBSERVATION — orphan-preflight relay 400:** during the owner's export, the preflight's LLM POST to antcv-access-relay returned **400 Bad Request** → "[orphan-preflight] unusable LLM response" (graceful degrade; L2 binding had run: scanned 74, runts 30, L2-bound 24, residue 6). Diagnose request shape vs relay route — preflight quality silently degrades while this 400s.
>
> **SETTINGS-ROLLER-RESET-001 (owner 2026-07-03, DOCUMENTED — not yet diagnosed).** Inside the Settings menu, pressing the mouse ROLLER (wheel button) — or the buttons close to it on EITHER SIDE — in order to scroll down causes a **mini-reset**: the "Loading……" cover (the antcv-login-loading-gate growing-dots card) shows, the app re-boots, and the user lands back ON the Settings menu. Related earlier observation (same session): leaving the panel via the roller showed a "Reload" control where the normal settings close (✕) belongs. FACTS ESTABLISHED so far: (1) the Loading gate appearing means a FULL APP RE-BOOT (page reload or top-level React remount), not a panel re-render; (2) landing back on Settings is expected after a reboot — `settingsTab`/`settingsSubTab` persist in L and the boot path restores the open panel, so the reset is REAL even though the user "returns" to where they were; (3) keyboard-arrow scrolling does NOT trigger it (owner-confirmed) — plain scroll-position change is innocent; (4) headless repros are green: diag-account-scroll-reset (scroll-to-end, the 2026-06-13 family ACCOUNT-SCROLL-RESET-001 — possibly the SAME bug, since that one also never reproduced synthetically) and wheel-EVENT bursts on the live site (tall MCP window — the panel didn't even scroll; needs the owner's window size). HYPOTHESES in likelihood order: (a) the buttons "close to the roller on both sides" (tilt-wheel left/right or forward/back side buttons) map to browser **Back/Forward history navigation** → SPA leaves/reloads → boot gate → settings restored — would also retro-explain ACCOUNT-SCROLL-RESET-001; (b) middle-press `auxclick` on a link-ish element inside the panel navigating; (c) middle-press autoscroll interacting with a scroll-linked handler that crashes React to the recovery screen (the recovery UI would carry the "Reload"). NEXT STEPS (fix session): instrument `popstate`/`beforeunload`/`auxclick` logging in the owner's live tab at HIS window size and have him press the roller once; if (a) confirms → modal history guard (push a sentinel state while Settings is open and swallow the popstate, standard modal pattern) + suppress panel `auxclick` default; re-check the "Reload instead of ✕" after the fix. Register row 21.
>
> **STANDING (owner 2026-07-03): backlog reconcile.** Older open items must never age out of the working set. The rolling consolidated list is docs/qa/OPEN_REGISTER.md; every nightly (local + cloud Routine) reserves a slot per docs/qa/NIGHTLY_BACKLOG_RECONCILE.md to verify/refresh the 3-5 stalest rows (many OPEN tags are already shipped - verify first, close with evidence). The dated PROJECT_ISSUES_OPEN_CLOSED_* snapshots keep their session role; the register is the sweep target.
>
> **CURRENT OPEN STATE (reconciled 2026-07-03, owner ask "show what is actually open"): docs/qa/OPEN_REGISTER.md RENUMBERED to 20 open rows.** Verify-first sweep closed the stale ones: Kernel v2 + ingestion was marked "not started" but is SHIPPED through 1.50.521 (only the v2-direct readers / langInvariantTokens surfacing / es-zh lazy tier / uploaded-docx regression remain — new row 8); the DATA-LOSS load-grace guard is in BOTH bundles (old row 13 closed); the relay D1-WRITE-RETRY is in-tree and the relay redeployed today (old row 14 closed); the photo-bridge in-cell float-wrap was superseded by the wk 1.14.120 page-anchored medallion (old row 5 closed). The two rows that answer "what should I look at": **register row 20** = the consolidated OWNER VERIFY list (one Hard Refresh + CL regen + CV re-export checks all six items; the only real risk flag is (a) — the wk 1.14.122 p2/p3 alignment spacer is unproven in a real CloudConvert PDF, round 1 failed there) and **row 19** = the JD-scope residuals (occ-2 restore path unguarded, two-device untested). Everything else open is the standing feature/optimization backlog (rows 1-18).
>
> **SESSION 2026-07-03 batch 18 → `main` PWA 1.51.83/1.51.84/1.51.85 + docx-worker 1.14.125 (deployed) — row 5 CLOSED end-to-end.** **[1.51.83 + wk 1.14.125]** (a) **HEADER-ROW-CLICK-001** — every candidate-header row button (move/loc/ON-OFF/edit) stops propagation and the row click ignores interactive children; the bubble double-fired the shared toggle (open→close), which read as "clicking Contact collapses instead of opening". (b) **HEADER-ROW-DBLCLICK-001** — dblclick anywhere on the row (editable text + gray area) OPENS the detailed editor, ends-open from either start state (the two single clicks toggle twice; the handler opens only when the re-rendered expanded state is false). (c) **HEADER-ITEM-RULE-001 ENGINE** — localStorage headerItemRule → payload header_rules → worker per-field borders (below-Name optional / below-Spec = contact top / below-Contact = contact bottom; pt×8 eighths, hex colour or theme); ABSENT store = copenhagen-modern default = byte-for-byte the previous look. First cut 500'd (payload not in scope in buildCandidateHeader) — caught by the diag sweep, rerouted via ctx; docx diags 36/39 (above the 35/38 baseline). **[1.51.84]** (d) **SECTION-ROW-DBLCLICK-001** (owner: "also for sidebar and main and body panels") — the shared section-row component (Ie/ct, used by the SIDEBAR panel AND the MAIN/BODY panel) had a title-dblclick but none on the ROW: two single clicks on the gray area toggled selection twice (net closed). Row-level ends-open dblclick added, same pattern as (b). **[1.51.85]** (e) **HEADER-ITEM-RULE UI + PARITY** — antcv-header-rule-control.js: per-field "Rule line below" rows (on/off + 0.5-2pt + colour + auto-theme, writes headerItemRule + re-render nudge) — RE-PLACED per owner ("not in Settings — in the editor side panel!", 1.51.86): injected into each header field's DETAILED EDITOR (the ← Back panel; field resolved from the row label, Application maps to the specialisation slot) AND the __antcvHdrRuleDiv/Html/Style helpers; the live React header (two rule divs + name div) and the HTML-export template (f()/m() calls + name paragraph) consult them via GUARDED splices whose fallbacks are byte-equivalent to the legacy render — live preview, HTML export, DOCX and PDF all read ONE store. Tests: header-rule-control (3), suites 732→735 green, boot-smoke green throughout. Owner verifies: Settings box present; a Name-rule toggle shows identically in preview + next export; dblclick opens editors on all four panels.
>
> **SESSION 2026-07-03 batch 17 → `main` PWA 1.51.77/1.51.81/1.51.82 — owner's 8-item implementation batch, 7 shipped.** (Batch 16 = RESULTS-PIN-NO-NUMBER-001, 1.51.76.) **[1.51.77]** (a) **JD-SCOPE-OCC2-GUARD-001** (register row 19) — the read-from-cloud restore (occ-2, manual-save-sentinel block) adopted ANOTHER device's tailored JD; now carries the same foreign-device check as occ-1 on Vt() + the lastJdText mirror (e = active_application row w/ _pointer_device_id); string-locked, jd-scope tests 10/10. Remaining row-19: two-real-device test (owner). (b) **GEN-UNSOL-STALE-JD-001 Patch D** (row 15) — antcv-unsol-company-scrub.js: meta.company empty/Unsolicited + prior antcv:activeAppCompany → word-boundary scrub of cv+cl prose to 'your organisation'; EMPLOYER names protected; write-on-change; kill-switch; 6 tests. (A parallel session built a duplicate in the CL prose guard and reverted it in favor of this canonical sidecar — 1416df8/64532e1.) **[1.51.81]** (c) **ORDERING-JD-CLUSTER-001** (row 10) — the gen prompt injects the classified cluster's top-20 demanded qualifications (antcv-cluster-demand seed) as a SELECTION/ORDERING weighting rule (__clusterRule/__cr in the tense/lang/brandFit chain); no-op when unsolicited/unclassified; byte-parity locked. (d) **PAN-IDRAET-PREVIEW-HIDE-001** (row 13) — preview hides the near-dup bullets the export collapses, INDEX-SAFE (display:none + marker, roles.N.bullets.M paths untouched, reversible) via the export's OWN predicate (window.AntcvCollapseRoleBullets bridge in docx-client — zero drift); 5 tests. **[diag/docs]** (e) **diag-ai-notice-anchor GREEN** (row 12) — the worker was right (AI-NOTICE-LEFT-CLOUDCONVERT-001 margin-offset corner encoding); the diag asserted the abandoned mso-position-horizontal keyword; updated → docx baseline **35/38**. (f) **SIDEBAR-PAGE23-DANCE closed** (row 11) — headless: promote-margin diag holds page 3 across one-row + whole-group removals; sidebar-stable clean. **[1.51.82]** (g) **CL-FORMAT-PANEL-001 / F3** (row 7) — distinct "COVER LETTER FORMAT" panel in Settings→Layout wrapping the signature + slogan/sign-off controls (re-parenting is isConnected-safe; controls keep stores/self-heal); diag-cl-format-panel.mjs 9/9. **(h) SHIPPED — see batch 18:** HEADER-CONTACT-CLICK + per-field RULE LINES (row 5) — owner clarified 2026-07-03: row-click bug fix + DOUBLE-CLICK opens the detailed subsection editor even from editable-text/gray areas; rules get hide/show + thickness + color per field (Name/Spec/Application/Contact); copenhagen-modern DEFAULT = the current look (one line below Contact, one below Spec/Application). Suites 727→732 green across the waves; three parallel-session version collisions resolved by rebase + re-splice (1.51.78-80 taken upstream).
>
> **SESSION 2026-07-03 batch 15 → `main` PWA 1.51.75 — SIDEBAR-FONT-METRIC-001: the batch-13 "8 sidebar runts persisted" mystery SOLVED.** Root cause found by extracting the (3) PDF's span fonts: the sidebar body renders in **Carlito 10pt** (= Calibri via CloudConvert), but the preflight measured sidebar values in **Trebuchet MS** — the payload never carries sidebarBodyFont (the WORKER fills it server-side from the package body font), so the fallback picked style.sidebarFont, which is the HEADING font. Wrong metrics → every wrap point off → zero runts detected → zero binds. Fix: the sidebar measurer falls back to the SAME package body family as the main column (Calibri default — the choice already validated against real exports by diag-orphan-preflight-real). PROOF: new `diag-orphan-preflight-sidebar.mjs` replays the owner's 8 runt items VERBATIM from the (3) PDF through the REAL Chromium DOM measurer with the REAL payload shape (sidebarFont='Trebuchet MS' present, sidebarBodyFont absent, sidebar_ratio 0.38 measured from the PDF): **8/8 detected, 8/8 L2-bound with NBSP glue, residue 0, zero LLM calls**. Unit sideFamily expectation Cabin→Calibri. Suite 716/716, boot-smoke green, quintet → 1.51.75. Owner's next export should carry NO sidebar runts (belt: the SIDEBAR-TIGHTEN abbreviations shorten the same lines at the source).
>
> **SESSION 2026-07-03 batch 14 → `main` PWA 1.51.74 — orphan/line-fill lesson GENERALIZED (owner: "not gabriel-limited, not just fit for unsolicited — a lesson learned in general about the allowed level of compression versus desired line width").** Audit of every orphan mechanism: export preflight (main+sidebar) — persona-neutral, both app types (gates only doc==='cv' + non-linear; locked by test); SIDEBAR-TIGHTEN — persona-neutral; COMPRESSION-TIGHT-001 — already unconditional; results PINS — Gabriel-only BY DESIGN (his stored facts, not an orphan mechanism). TWO real gaps found + fixed: **(a) TONE-DEFAULT-SCANDINAVIAN-002** — the NORDIC-CL-TEMPLATE-GEN-001 prompt block (which carries LINE-FILL + LINE-FILL-SLOTS-001) was gated on a raw toneRegister read with ABSENT-key→skip, so fresh/demo sessions (Anita!) never received the line-fill rules even though scandinavian is the app default — the same bug class as the 1.51.64 converter tone-default, missed in the prompt gate. Absent (or empty) toneRegister now takes the default; only an EXPLICIT non-Nordic register opts out. **(b) COMPRESSION-VS-LINE-WIDTH-001** — the general principle now extends the UNCONDITIONAL COMPRESSION-TIGHT push (every candidate, every style, targeted AND unsolicited): compression has a FLOOR, the desired line width — a block's last rendered line must fill its typeset line (~90-110 chars main, proportionally less in the sidebar); a dangling last line under ~40% means tighten further to drop a whole line OR extend with one stored detail — whichever the content supports. Tests: NEW unit/compression-linewidth-general.test.mjs (3: rule in the unconditional push, tone gate defaults ON, preflight has no persona/app-type gate). Suite 716/716, boot-smoke green. Rebased over JD-SCOPE-ISOLATION Stage 2 (1.51.73 taken) → quintet **1.51.74**; app.js conflict resolved by re-splicing on the upstream base.
>
> **OWNER LIVE SESSION 2026-07-03 → `main` PWA 1.51.72 + 1.51.73 + access-relay (deployed) — JD-SCOPE-ISOLATION-001 (owner: "two parallel sessions must not let one application's JD contaminate the other" — desktop+mobile / two tabs / two browsers).** Root: the active JD lived in GLOBAL single-slot localStorage keys (`antcv:lastJdText` / `applicationQuestions` / `applicationQuestionsJd` / `activeAppCompany`) with NO per-app scoping, and the cloud `active_application` is ONE row per email (last-writer-wins) — the same class as GEN-UNSOL-STALE-JD / NVIDIA-on-unsolicited. **[SHIPPED Stage 1, 1.51.72] LOCAL (two-tab):** new early sidecar `antcv-jd-scope.js` tracks the current app id PER TAB (window + sessionStorage, never a shared key) and installs a NARROW keyed localStorage redirect → the 4 JD keys become `antcv:app:{appId}:{base}`; everything else passes through (bulletproof try/catch). Readers unchanged (redirect is transparent); only the 3 sidecar storage-event predicates match the namespaced key (fallback to base without the shim). One app.js hook: a `useEffect` mirrors the active-app-id state `Fl`→`setCurrentAppId`. Ghost-purge `rs()` verified to PRESERVE `antcv:app:*` ("unknown"). Same-app cross-tab sync preserved. **[SHIPPED Stage 2, relay deployed + 1.51.73] CROSS-DEVICE:** `active_application` gains nullable `device_id` + `updated_at` (schema.sql + idempotent `ensureActiveAppColumns` ALTER for the prod DB; backward-compatible — old clients unaffected). Both pointer writes stamp them; `/api/prefs` returns `_pointer_device_id`/`_pointer_updated_at`. Client: per-install `antcv:deviceId` sent in `oo.setActive` PUT; cold-restore guard `__antcvFd` — if the pointer was last set by ANOTHER device, don't inherit its tailored JD into THIS device's box (gates the Vt fill + lastJdText mirror). Fail-safe (null stamp = old behavior). Tests: `unit/jd-scope-isolation.test.mjs` (9: two-tab isolation, same-app sync, isMyJdKey, passthrough, 4 keys, migration, deviceId, adopt-decision) + `diag-jd-scope-runtime.mjs` (real headless boot: redirect live, global slot untouched, app-switch isolates). Suite **708/708**, boot-smoke 0 errors, app.js integrity green, relay /health 200. **CAVEATS (needs-owner-eye):** cold-restore has TWO restore paths — occ-1 (main active_application) is guarded, occ-2 ("manual-save sentinel") is NOT; multi-device behavior is unit+headless verified, NOT tested with two real devices; the pure `shouldAdoptCloudPointer` is wired only for the JD-inherit case, not a full restore re-route. Memory: [[jd-scope-isolation]].
>
> **SESSION 2026-07-03 batch 13 → `main` PWA 1.51.72 + docx-worker 1.14.122 — owner round-2 review of export (3).** Export (3) (16:17Z, wk 1.14.121 + PWA 1.51.71) verified: 3-page goal reached (owner's manual bullet tightening), TA Result present, header contact 8pt/indented and clear of the photo. Three follow-ups shipped: **(1) RESULTS-PIN-OWNER-EDIT-001** — owner: "deleting the patent number … makes it jump back to previous form". BOTH pin layers rewrote any differing role.results (sidecar on every sections-updated; the export _gabrielExactResult tier sat ABOVE role.results). The pin now wins ONLY over empty results / a known pin text (current or superseded `old`) / a COPYCAT of the role's own bullets; any other non-empty text is an owner edit and STICKS (preview pinWins + export fall-through to the role.results tier). **RESULTS-PIN-ONE-LINE-001** — Sirin pin drops "Patent No. " (number kept) so the Result fits one line; old form in `old` upgrades once. **(2) SIDEBAR-TIGHTEN-001** — deterministic sidebar abbreviations in sanitizeForExport ("University of"→"Uni. of", "Introduction to"→"Intro to"; owner-named, extensible SIDEBAR_ABBR list) on sidebar list strings + labeled l/v, before the early-return per-id passes; export-only (owner: "critical for keeping a 3 pages unsolicited"). Preflight side_label min-length gate 40→24 (38-char values like "Weapon-mounted sight interface context" wrap in the narrow column but were skipped). **(3) SIDEBAR-HEADLINE-PAGE2-ALIGN-002** (wk 1.14.122) — the 1.14.121 cell-top +100 moved BOTH columns down 5pt in export (3): LibreOffice normalizes the row content top to the LARGEST cell margin. Reverted; the 5pt spacer is now an exact-height empty paragraph LEADING the sidebar stream in makePageTable on continuation pages only (sidebar-shaded, page 1 untouched). **STILL OPEN from (3):** the 8 sidebar runts persisted despite SIDEBAR-ORPHANS-001 — primary mitigation is now the tighten pass; if runts persist on the next export, diagnose the preflight live (console `[orphan-preflight] scanned N` should include sidebar targets; check `antcv:disable-orphan-preflight`; the DOM measurer's Cabin fallback vs the PDF's actual sidebar font is the next suspect). Tests: gabriel-results-pin +3 (owner edit sticks / old-pin upgrade / copycat replaced) + Sirin one-line regex; NEW unit/sidebar-tighten.test.mjs (2). Suite **704/704**, boot-smoke green, docx diags 34/38 == baseline. Worker **1.14.122 deployed + verified live**; quintet → **1.51.72**. Owner verifies: patent-number edit sticks after a Hard Refresh; "Uni. of Toronto" in the next export; p2/p3 sidebar↔main headlines aligned.
>
> **SESSION 2026-07-03 batch 12 → `main` PWA 1.51.71 + docx-worker 1.14.121 — batch 11 RESOLVED (all 7, register rows 25-29 closed).** Diagnostic-first: every layout number PyMuPDF-measured in the owner's actual PDFs. **[SHIPPED 1.51.71 + wk 1.14.121]** (1) **CL-SIGNATURE-SPACING-001** — worker closing before 150→330 DXA (+12px), name before 60→150 (+6px), same +180/+90 on the left-aligned variant path; preview parity in BOTH paths (React wrapper 14→26 / name 8→14; HTML 12pt→21pt / 8pt→12.5pt). (2) **LINE-FILL-SLOTS-001** — the LINE-FILL prompt rule now names opening_content / foundation_hands_on / foundation_professionally: a multi-line block's LAST line must fill the typeset line; under ~60 chars → add one more stored detail (the three green-marked CL areas); prompt-level, owner regen confirms. (3) **CV-ORPHANS-RESIDUAL-001 root cause ≠ stale SW**: all 7 runts in the export (fracs 0.15-0.27) were SIDEBAR labeled values — the preflight was main-column-only BY DESIGN. **SIDEBAR-ORPHANS-001**: antcv-orphan-export-preflight now measures sidebar labeled_list values at sidebar geometry (sbLR 120 DXA, fs.sbBody, sidebarBodyFont||sidebarFont — mirrors renderLabeledList) and L2 NBSP-binds them; sidebar lines NEVER go to L3 and never touch stored sections. (4) **ROLE-RESULTS-MISSING-TA-SG-001** — Security Guard result VERIFIED PRESENT in the owner's PDF p3 ("Results: Manage access and incidents for 750-resident…") — no bug; Teaching Assistant had NO pin anywhere (the TAU split leaves a bare "Teaching Assistant" the RA matcher misses). TA pin added to PINS + _GAB_EXACT + kernel role_results_exact ("Train graduate students on SEM, Raman, and confocal microscopy measurement protocols." — kernel-snapshot fact, distinct from the 7-semesters bullet); merged "R&D and Teaching Assistant" excluded by negative lookahead (keeps the RA benchmark). (5) **CORECOMP-TABLE-CELL-PAD-001** — worker table cell L/R margins 90→150 DXA (6px→10px, header + data rows); preview parity (React 7px→10px, HTML 5pt→7.5pt). (6) **SIDEBAR-HEADLINE-PAGE2-ALIGN-001** — each page is its OWN two-column table (PB-WORKER-TWOCOL-PAGED-001), so cell top margins re-apply per page; measured 5pt sidebar-higher on p2-3 → continuation pages add +100 DXA to the sidebar cell top (page 1 keeps 240, the band gap). (7) **HEADER-CONTACT-PHOTO-FIT-001 — verified already fixed, no change**: the owner's PDF (contact 9pt, no indent, photo x55-172pt) was exported ~2h BEFORE the FIGURE-CONTACT-REF-001 deploy; the deployed 8pt + 1.8" indent clears the photo's fixed right edge by ~43pt — fresh export decides. Tests: gabriel-results-pin +2 (TA matcher, merged-title exclusion, slashed-variant RA routing, PINS↔_GAB_EXACT line parity), orphan-export-preflight +2 (sidebar metrics/targets/prefix; L2-only never-L3) + never-target test updated. Suite **699/699**, boot-smoke green, docx diags **34/38 == baseline** (same 4 pre-existing fails — ai-notice-anchor, cjlr-table-export, pageflow-export, spacing-linkedin-export — zero new), worker ESM parse OK. Quintet → **1.51.71**; worker deployed via deploy.yml. **Owner verifies on a fresh regen + re-export:** CL sign-off gaps, CL line fills, sidebar runts bound, TA Result line, table padding, p2 sidebar/main headline alignment, header contact clear of the photo.
>
> **OWNER PDF REVIEW 2026-07-03 batch 11 — FILED FOR NIGHTLY, no code this session (RESOLVED same day by batch 12 above).** Owner reviewed the Gabriel unsolicited pair (`CoverLetter_…Product_Project_Expert_20260702.pdf` + `CV_…20260702 (2).pdf`, Downloads) and marked seven items (register rows 25-29): (1) **CL-LINE-FILL-RESIDUAL-001** — three green-marked CL areas end MID-LINE and need more content to the end of the typeset line (opening-paragraph tail "…deep-tech markets."; the Hands-on bullet tail after "…decision support."; the Professionally bullet tail "…management aligned."): the LINE-FILL prompt rule (~90-110 chars, batches 6+8) is not filling these three slots — likely needs per-slot enforcement or a post-gen line-fill pass. (2) **CL-SIGNATURE-SPACING-001** — +12px between the closure paragraph and "At your service,", +6px between "At your service," and the name "Gabriel" (preview + docx export parity; see memory signature-clip-rowheight for the sig-row family). (3) **CV-ORPHANS-RESIDUAL-001** — owner's CV export still shows orphans; FIRST verify the export preflight actually ran in his tab (stale-SW gate — same hard-refresh decision as register row 24) before touching RUNT_FRAC. (4) **ROLE-RESULTS-MISSING-TA-SG-001** — Teaching Assistant (TAU) and Security Guard roles render NO Result line; kernel role_results_exact + the PINS sidecar cover RA + Security-Guard (memories gabriel-role-results-seed, gabriel-results-pin-parity) — diagnose why TA has no seeded result and why the Security-Guard seed didn't render on this unsolicited gen. (5) **CORECOMP-TABLE-CELL-PAD-001** — Focus-Area/Strategic-Expertise table text sits too close to the cell borders in the PDF; add cell padding (docx worker table margins; keep preview parity). (6) **SIDEBAR-HEADLINE-PAGE2-ALIGN-001** — on page 2+ the sidebar headline (CERTIFICATES & COURSES) starts HIGHER than the main headline (PROFESSIONAL EXPERIENCE (CONT.)); the sidebar headline should start lower to align with main (owner pic). (7) **HEADER-CONTACT-PHOTO-FIT-001** — the header contact line must be SMALLER and more RIGHT-oriented so the round photo does not cover its start (the "⌂ 2300, København S" segment hides behind the photo — owner pic; relates the photo-bridge float family, register row 5).
>
> **NIGHTLY 2026-07-03 → `main` PWA 1.51.70 — PAN-IDRAET-BULLET-NEARDUP-001 (export half).** **[SHIPPED 1.51.70]** Within-role near-duplicate bullets (Pan Idræt "Manage logistics for about 25 players and coaches…" vs "Manage logistics for 25 players…") are collapsed on export. Root fix in `antcv-docx-client.js` `sanitizeForExport` (SINGLE source, runs in BOTH results-mode [post-applyOutcomesMode] and section-mode payloads): new `_dedupNearBullets` applies `_dedupNear`'s exact anchor-clause/overlap predicate (≥3 shared stems AND (≥0.6 overlap OR same verb+object headline)) to a role's OWN bullets; string or `{b,t}` bullets; winner tiebreak = higher `_metricScore` → fewer approximation words (about/roughly/…) → shorter, so the CLEANER "25 players" line survives with its original object + slot. `_keepMinBullets` enforces KEEP_MIN=2 (a 2-bullet near-dup role keeps both). EXPORT-SIDE ONLY (same non-destructive class as `hideSubsumed`) — stored sections and the index-based preview edit path (`roles.t.bullets.n`) are never mutated, so no ORPHAN-WRITE index-trust risk. Tests: `unit/pan-idraet-bullet-neardup.test.mjs` (7: real Pan-Idræt collapse + cleaner-line win, no-false-collapse, KEEP_MIN floor, `{b,t}` objects, anchor-clause low-overlap match, empty/non-text passthrough). Suite **695/695** (was 688), boot-smoke green, app.js untouched. Quintet → **1.51.70**. **DEFERRED to owner-eye:** preview-side hiding of the same near-dup (preview still shows the source bullet, editable — consistent with the existing export-only `hideSubsumed` behavior). True preview parity needs a live browser + an index-safe render (hide-without-reindex) so the `roles.t.bullets.n` edit path can't corrupt — not blind-shippable headlessly.
>
> **SESSION 2026-07-03 batch 10 → `main` PWA 1.51.67 + 1.51.68 (quintet 1.51.69) — gen-prompt de-hardcode COMPLETE + demo-cap UX.** **[SHIPPED 1.51.67] GEN-DEHARDCODE-003** (register row 20 CLOSED) — the last five Gabriel example lists out of the shared prompts, both bundles: translator KEEP-VERBATIM companies (Innoviz/Sirin Labs/Pan Idræt/Copenhagen Wolves RFC → "employers, clubs, associations — even small local ones") + tech (LiDAR/Power BI/Codebeamer → "tools, platforms, protocols"); LANG-CROSS-001 invariants (his 250/10/$8M/7-person → neutral 30%/10×/$2M/5-person/~25; LiDAR/SWIR/FPGA/SPAD/SiPM tail dropped); tools-category taxonomy (Zemax/EO-design shape → copy-forbidden placeholder shape); cert relevance (BABOK/Six Sigma/ASPICE/"Prøve i dansk 2" → domain-matching rule incl. language-cert-for-local-roles); PATENTS bullet (cover-window quote → "the design or engineering change the patent covers"). Tests: gen-prompt-dehardcode 003 blocks. The three-pass sweep (1.51.60/62/64/67) is DONE — no known Gabriel text remains in shared prompts. **[SHIPPED 1.51.68] DEMO-CAP-UX-001** (owner report: "All 4 LLM providers failed for parse_jd" with four identical `demo_cap_reached` 429s; Anita left on skeleton placeholders). ROOT FACTS: the demo cap is ONE per-user MONTHLY budget shared by ALL providers (KV `demo_usage:<email-hash>:<month>`, no provider dimension) — provider failover can NEVER clear it; a client-supplied key bypasses it server-side (`keySource==='client'`). The client classified it plain rate_limit, burned the 4-provider ladder, never fired the credit banner (message matches none of quota|billing|insufficient|exceeded), and advised "wait a minute and retry". Fix (callLLM, app.src.js + app.js): detect `/demo_cap_reached/i` → stop the ladder with a "DEMO BUDGET USED UP" error naming the reset date + own-keys path, fire the credit banner, set a session flag; a fail-fast gate after the BYOK restriction blocks later shared-key tasks (users holding ANY own key pass). Tests: `unit/demo-cap-ux.test.mjs` (4: markers both bundles, gate reads all 4 key slots, worker demo-enforcement pair byte-identical + per-user monthly key, bluescreen guard). No worker change. **The missing core-comp/results/CL content was the cap symptom** — parse_jd is the FIRST gen call; nothing was written, the 1.51.64 skeleton stayed. Diagnose cap before content pipeline. Owner's own budget: $0.586/$0.50 spent, resets 2026-08-01 — raise via KV `prefs:__admin_demo__` `demoTiers:[{matchEmail,capUsd}]`. Per-provider caps would 4× shared-key spend = deliberate design change, not done. Quintet bumped to **1.51.69** (batch 9 took 1.51.68 in parallel — two app.js states must not share one ?v). Suites 677→681 green, boot-smoke green both rounds, sync-first pushes (4aa9d49, f1a8e32, 1fd5516).
>
> **OWNER LIVE SESSION 2026-07-03 batch 9 → `main` PWA 1.51.68 (session open-task closure).** Finishing the session's remaining implementable items (task #14 decomposition). **[SHIPPED 1.51.68]** (a) **CV-APPLICATION-LINE-001** — Anita's CV header showed only the positioning triad while her CL had "Application: … — Unsolicited": the CL synthesizes that line in buildPayload but the CV forwarded the raw stored subtitle. The CV now synthesizes it too when meta.role is known (kept verbatim when the subtitle already reads Application:/Ansøgning:; DA localized "Ansøgning: … — Uopfordret"; no-role → stored subtitle untouched — a no-op for Gabriel whose flow already stores the line). (b) **WORK-STYLE-SENTENCE-CUT-001** — the WORK-STYLE-ORPHAN-134 cap (≤133) cut multi-sentence persona notes MID-SENTENCE ("…detailed tracking systems. Comfortable"); whole sentences now pack under the cap first (the clause/word trim remains for a single over-long sentence). (c) **WORKSTYLE-ADDITIONAL-DEDUP-001** — the pi/additional "Work style" row duplicated the main Work Style section; 415 drops the additional copy once the main is real (single-home rule; kept while the main is placeholder). Tests: `unit/anita-batch9.test.mjs` (7). Suite **682/682**, boot-smoke green. **DIAGNOSED-CLOSED, no code:** Hill&Colony "missing role header" = a pdf.js EXTRACTION artifact (the header IS in the PDF; the real defect was the Results cross-role bleed → per-role results shipped batch 8, re-import gated); worker bridge-contact indent verified CORRECTLY photo-gated (`__bridgePhotoOn` requires photo_b64) — the "contact placement/size" + "docx missing photo" complaints are SESSION-STATE-gated (stale demo kernel/photo + stale SW), decided by: re-import the refreshed Anita persona → Hard Refresh → re-export. **Register updated** (docs/qa/OPEN_REGISTER.md rows 23–24). Remaining open from this session = register rows 17–24 (larger tracks: PAN-IDRAET near-dup, JD-SCAN ingest reorder, Patch D, prompt example leftovers, sid-fallback sweep, sweep-army burst cost) — queued for the nightly reconcile slot.
>
> **OWNER LIVE SESSION 2026-07-03 batch 8 → `main` PWA 1.51.64 (Anita regen review — CL hydration family + interests + role results).** Owner reviewed the regenerated Anita CV/CL PDFs. **[SHIPPED 1.51.64]** (a) **FOUNDATION-HYDRATE-RICHBLOCK-001** — the gen-apply wrote foundation `hands_on`/`professionally` FIELDS onto the (now-universal) rich_block skeleton → dead fields, TEMPLATE rows survived (the templated "I connect [your foundation…]" lead in the PDF) while the BRING rows visually glued onto Foundation (bring's lead-in was empty and headlines are hidden). Fix mirrors BRING-HYDRATE-RICHBLOCK-001: reset foundation to the legacy `{type:'foundation', hands_on, professionally}` shape so foundation-758 re-converts with the fresh content (both app.src.js + app.js). (b) **TONE-DEFAULT-SCANDINAVIAN-001** — 758/760/761 gated on `toneRegister` with ABSENT-key→false, so the whole converter family NO-OP'd in fresh/demo sessions while the skeleton is nordic-shaped for everyone; absent key now takes the nordic default (mirrors `u.get('toneRegister','scandinavian')`); stale tests updated. (c) **FOUNDATION-OPENING-NEUTRAL-001** — 758's opening restore was Gabriel-only; every candidate now gets an opener (Gabriel exact, others the 987 neutral connector). (d) **BRING-INTRO-NEUTRAL-001** — 761 falls back to a neutral lead body when gen omits bring_intro (an empty lead made the rows read as the previous section's). (e) **INTERESTS-FROM-PI-001** — the only interests injectors were Gabriel-guarded; new GENERIC 415 pass fills placeholder INTERESTS from the candidate's OWN pi.interests, absorbs ADDITIONAL Interests/Hobbies rows (dedup, umbrella dropped), still-empty hides (owner's preview/PDF mismatch); 4 unit tests. (f) **WHY-RULE-EXPORT-PARITY-001** — `ensureWhyVRule` sets `headlineRule` on WHY (the preview's line) but the docx-client rich_block case never FORWARDED it; one-line forward (the worker already supports RULE-INDEPENDENT-001 — no worker deploy). (g) Anita persona: per-role `results` added (Northfield/Hill&Colony/SummerStockpile/AntHill) for distinct non-copycat Results lamination. (h) LINE-FILL rule strengthened per owner ("do not slide lines but give more content"): short line → ADD concrete substance from the real record; 40-60-char fragments = failed generation. **ORPHANS DIAGNOSIS:** Anita's PDF runt tails measure 0.07–0.29 at export width — ALL far under RUNT_FRAC 0.40 → the preflight would have bound every one → **it did not run in the owner's export tab (stale SW; production verified serving 1.51.63+ with the preflight)**. Owner action: Hard Refresh the tab before exporting (+ re-import the refreshed Anita persona — the stored demo kernel still has EU Citizen/no recommendations/no per-role results). Suite 668/668, boot-smoke + CL-template-struct green. **STILL OPEN:** duplicated/merged roles in the Anita regen (Hill & Colony header missing — re-verify after persona re-import + regen with per-role results); demo Anita photo in docx; PDF contact size/placement.
>
> **OWNER LIVE SESSION 2026-07-03 batch 7 → `main` PWA 1.51.63 (preview pagination fit-check).** Owner: removing ONE line from a sidebar subsubsection made the PREVIEW pull Environmental up a page while the PDF correctly kept it on page 3 — "check if there is space… identify that there isn't and keep it" . **[SHIPPED 1.51.63] SIDEBAR-PROMOTE-MARGIN-001** — the coordinator (antcv-auto-pagebreak-block-001.js) now gates group PROMOTIONS (a group moving UP a page vs its last settled page) on a REAL-SLACK fit: the destination page must keep ≥ `SIDEBAR_PROMOTE_MARGIN` raw px free (default 45 ≈ 1.5 sidebar lines — covers the export-renders-taller variance beyond the global SIDEBAR_PREVIEW_INFLATE). Marginal fits stay put (matching the PDF); DEMOTIONS unchanged; a genuinely large free (whole group hidden) still reclaims — no SIDEBAR-SHRINK-RECLAIM regression. Group identity keyed by sid + normalized group TITLE (survives row-index shifts when a line above is removed). Decision core extracted PURE (`_promoteMarginGate`) + 6 unit tests (blocked-marginal, real-slack reclaim, first-run seed, demotion pass-through, page-1 cap, wiring); DOM smoke `diag-sidebar-promote-margin.mjs` (owner-scale sidebar holds page 3 across a one-row removal; C/D counterfactuals informational — the synthetic fixture is not boundary-tuned). Owner-tunable live: `AntcvAutoPagebreak.config({ SIDEBAR_PROMOTE_MARGIN: N })`, 0 disables. ALSO: `diag-settings-personal-freeze.mjs` probe extended to 8×3s with a majority+no-recovery rule — the earlier FROZEN verdicts post-1.51.59 were single-timeout flaps on heavy-but-RECOVERING churn bursts (page answers t+9…t+21), not the hard loop; the residual sweep-army burst cost (279/356/341/language-ui) is a separate optimization track. Suite 664/664, boot-smoke green. NOTE: GEN-PROMPT-DEHARDCODE-002 landed in parallel (b96e1a8, 1.51.62 — Gabriel education/regulatory/patent/voice out of the shared gen prompt).
>
> **OWNER LIVE SESSION 2026-07-03 batch 6 → `main` PWA 1.51.60 + proxy/demo-proxy 3.7.0 (Anita demo review).** Owner reviewed the Anita demo CV/CL + Gabriel PDF. **[SHIPPED 1.51.60]** (a) **LOCALFORM-NO-FABRICATION-001** — localForm invented GABRIEL's "2300, København S" for ANY bare Copenhagen location (Anita's exported contact carried a false address); fixed in docx-client + the preview twin (app.src.js + minified app.js ternary); tests updated (bare Copenhagen → "København"; stored postcodes still reformat). (b) **GEN-ACCESS-DEHARDCODE-001** — the shared gen prompt hardcoded Gabriel's HEARING-IMPAIRED accessibility at TWO sites (24334 rule + a schema hint) → hallucinated onto Anita; both now persona-neutral (own stored need, never invent, omit when none). Remaining Gabriel hardcodes in the same prompt (Technion education list, regulatory groups, patent example, "Gabriel writes…" voice) = **GEN-PROMPT-DEHARDCODE-002, task chip filed**. (c) **Persona data**: Anita citizenship → Danish (field + contactItems), "Career timescale" ant-lore row removed from additional, 2 recommendations written from her history ({deg,sch}); Devon +2 recommendations. (d) **EMPTY-OPTIONAL-LEAK-001** — 415 drops placeholder-empty education items (the lone "[Degree]" row) and hides empty RECOMMENDATIONS/ACCESSIBILITY on a real CV (sparse-guarded; 5 unit tests). (e) **CL gen**: "Assumed need:" label leak banned (assumptions marked in rationale only, natural bold leads) + LINE-FILL rule (~90-110 chars, fill the typeset line); FOUNDATION-LEAD-FILL-001 (gen must fill the 'I connect…with…' lead) + 987's fallback de-Gabriel'd to a neutral connector (FOUNDATION-LEAD-NEUTRAL-001 — answers the owner's "why is Foundation specific instead of the template"). (f) **TOOLS-EMPTY-GROUP-001 + TOOLS-EXPERTISE-FIRST-001** — unconditional empty-group-header drop in tools-merge-dedup + Expertise group leads on fully-unsolicited; prompt rule TOOLS-GROUP-ORDER-001 added. **[SHIPPED workers 3.7.0-genjob-parity]** — PARITY SWEEP: demo-proxy was MISSING gen-job.js + gen-coherence.js + the /job/* routes (GEN-BACKGROUND-001!) — demo generations 404'd the checkpointed job path (prime suspect for Anita's missing CORE COMP/OUTCOMES/CL content) — ported byte-identical (gen-job now binding-tolerant CV_PROXY_DATA||CV_DEMO_PROXY_DATA); jd-analysis salary_estimate ported (demo Salary card was empty); demo diags 25+11 green. **NEEDS DEPLOY** (gh workflow run deploy.yml) + a fresh Anita demo regen to re-verify the export-gap list (header Application/Specialization/Slogan lines, interests routing, work-style dup/cut, docx photo, PDF contact size — task #14). **STILL OPEN from this review:** brand-match ATS font mapping (owner rule: non-ATS company fonts → closest ATS-safe); preview pagination fit-check before pulling a sidebar subsubsection up (preview moved Environmental up where the PDF correctly kept it — needs the export-metric fit check, SIDEBAR-SHRINK-RECLAIM risk family).
>
> **OWNER LIVE SESSION 2026-07-03 batch 5 → `main` PWA 1.51.59 (Settings→Personal freeze/"jumpy" loop).** Owner: settings STANDARD→Personal "messy/jumpy/stormy, lots of buttons appear and disappear in loop" (demo); probing the LIVE session HARD-FROZE the tab (45s Runtime.evaluate timeouts). Reproduced headless with the FULL Anita kernel (`diag-settings-personal-freeze.mjs`: CDP CPU profile + script-block bisect + mutation attribution — the V8 inspector interrupts a spinning page, so the profile names the culprits even mid-freeze). NOT one loop — an aggregate: ~40 sidecars' copy-pasted `isInPreviewPaper()` ran a full-document querySelector PER ELEMENT PER SWEEP (~60% of ALL CPU); the sweeps woke each other through their body-wide MutationObservers; several passes wrote unconditionally. **[SHIPPED 1.51.59] SETTINGS-PERSONAL-FREEZE-001:** (a) NEW `antcv-preview-paper-memo.js` — memoizes exactly the `.antcv-preview-paper, [data-antcv-preview-paper]` selector on Document.prototype.querySelector (250ms TTL + isConnected; kill `antcv:disable-pp-memo`) — one chokepoint fix for all ~40 consumers; (b) `experience-role-cjlr-230` — MAX_CARD_TEXT 4000 ancestor cap (stop serializing the whole document per textarea), write-on-change everywhere, 300ms observer debounce; (c) `language-ui-429` — 400ms apply() throttle + panel HOST STICKINESS (re-appending on every contentHost flap was a childList-storm source and the visibly jumping LANGUAGES card); (d) `additional-info-row-controls-247` — 300ms observer debounce; (e) `src/lib/settings-dom.ts` — 300ms memo on findSettingsRoot (all-divs text scan) + getTabState (deep clone) shared by EVERY React island (rebuilt). Result: freeze diag FROZEN:false with all alive-probes green (profile 95s→~14s, no hog >6%); residual mutations = React preview re-renders re-stamping `data-antcv-prv-bullets-*` spans (by-design markers, guarded). **(f) SETTINGS-DONE-SEPARATION-001** — JobSearchTargeting island wrapper gets a top divider + 12px separation from the cards above (owner ask). Suite 648/648, boot-smoke green, align-flap regression clean. Owner eyeball on live demo pending. NOTE: the 1.51.59 quintet came from the parallel babel-fish audit commit dad0f91 ("5 stale sidecar ?v repairs"); this batch shipped INTO 1.51.59 (version-override's own ?v at 1.51.59b), so 1.51.58 + 1.51.57 are both STALE.
>
> **OWNER LIVE SESSION 2026-07-03 batch 4 → `main` PWA 1.51.58 (CL base template struct).** Owner: "the base template is a bit off — bring it back into the proper template struct to avoid too much patching over it" (screenshot: Dear [Hiring Manager], Focus-area table rows in WHAT I BRING, [Specific thing you would do N], missing why/who/opening + Goal). **[SHIPPED 1.51.58] TEMPLATE-STRUCT-DEFAULT-001** — root cause: the `me().cl` skeleton gate returned the PROPER docx-matching struct (greeting→opening→why→who→foundation→bring→contribute→closure, rich_block lead-ins, "[Need from JD/company]" bring rows, contribute lead-in + Goal — byte-matching the owner's CoverLetter_Template_Generic docx) ONLY when localStorage `toneRegister` was nordic-minimal/scandinavian; an ABSENT key (fresh/demo/wiped session) fell to the legacy pre-Nordic shape even though the app's tone DEFAULT is scandinavian — the rich-block converter sidecars then patched it halfway (the owner's screenshot). Fix: gate flipped to `!0` in app.src.js + app.js (occurrence-1 guarded replace, head + no-use-strict asserted) — the proper skeleton is the base for EVERY tone register; legacy branch kept as dead reference. Tests: `unit/cl-template-struct-default.test.mjs` (4, src↔app.js parity + bluescreen guard) + `diag-cl-template-struct.mjs` (real boot, NO toneRegister, empty cl → floor yields order greeting,opening,why,who,foundation,bring,contribute,closure; rich_block bring/contribute; zero legacy markers). Suite 648/648, boot-smoke + gate-probe green. NOTE: existing STORED cl sections keep their old shape until regenerated/reset — the floor only fills empty; owner regen recommended.
>
> **ORPHANS V2 SESSION 2026-07-03 → `main` PWA 1.51.57.** **[SHIPPED 1.51.57] EXPORT-METRIC-MEASURE-001 + EXPORT-PREFLIGHT-ORPHANS-001** (ORPHAN_ARCHITECTURE §7–9): new sidecar `antcv-orphan-export-preflight.js` measures the BUILT payload (the exact post-applyOutcomesMode/sanitize/normalize strings the worker typesets) in an offscreen div with EXPORT font/size + EXPORT column widths derived from the SAME payload fields the worker reads (sidebar_ratio → mainW; style.mainEdgeIndent/seamGap → cell; bulletIndent → bullet column; package bodyFont; font_sizes) — detection tracks the PDF, not the preview. RUNT_FRAC **0.40**. Pipeline (awaited inside `exportDocxViaWorker` AND `exportPdfViaWorker` after buildPayload, hard 12s race + swallow-all — export can never hang/fail on it): L2 minimal trailing-NBSP bind (clears multi-word runts by making the last line LONGER; re-measured, never adds a line) → residue → ONE batched L3 (claude-sonnet-5 via proxyBase, 8.5s abort, attempted-cap 2/text-sig) gated by safeShorten (+ no em/en dash) AND a re-measure (reject runt-or-longer; runt-but-bindable accepted bound). Scope: main-column role bullets + per-role Results (+ "Results: " lead in the measure) + PROFILE paragraphs (owner note). Payload writes in place; stored-section mirrors (rewrites only) go through the shipped ORPHAN-WRITE-VERIFY-001 verifier (text-verified, abort on ambiguity); Results mirror → antcv:resultsOverride. Kill `antcv:disable-orphan-preflight`. **Proofs:** unit 19 (measurer math, 0.40 boundary, L2/L3 gates, verified-write, kill switch); `diag-orphan-preflight-parity.mjs` = fixed payload → REAL worker → document.xml carries the exact fixed strings (NBSP intact), originals absent; `diag-orphan-preflight-real.mjs` = REAL Calibri at export widths detects exactly the export-16 acceptance runts ("Qualcomm tools.", "customer-facing work.", "in commercial devices.", profile) and L2 clears ALL FOUR deterministically. Suite 644/644, boot-smoke + gate-probe green. **OWNER GATE:** re-export the NIL/unsolicited CV — the §acceptance set must be clean in the CloudConvert PDF.
>
> **OWNER LIVE SESSION 2026-07-03 batch 3 → `main` PWA 1.51.56 (demo-mode "jumping"/"bleeping").** Owner: demo-mode table headers + TOOLS & METHODS/REGULATORY CONTEXT content jumped between justified/centered/left, and Settings→Personal "bleeped" without converging. Reproduced headless (`pwa/test/diag-align-flap.mjs`, template skeleton): TWO independent non-converging loops. **[SHIPPED 1.51.56]** (a) **STORM-EMPTY-SLOT-CONVERGE-001** — 415 `hideEmptyRoleSlots` (on:false) ⇄ `unsolicited-cv-completeness` (on:true) ping-pong on placeholder-empty roles = 150 sections-updated/20s; fixed BOTH sides: completeness skips `emptySlot(r)` (predicate mirrors 415), and 415 gets the same sparse-CV guard as empty-role-hide (<2 real roles → leave wizard placeholders visible). (b) **PW-CJLR-FOREIGN-SECTION-001** — `antcv-profile-workstyle-cjlr-238.js` `editorBlocks` climbed THROUGH a foreign `[data-sid]` (core_comp) up to the main-column div whose text starts "PROFILE", classified the whole column as the profile section, and stamped its default LEFT on every preview editable (incl. the CORE COMPETENCIES header); 234 wrote center back → endless ~10ms center↔left loop (writer isolated by script-block bisect + run()-sampling probe `diag-align-flap-probe.mjs`). Fix: a foreign-sid ancestor is a section boundary → stop climbing. (c) **OUTCOMES-PREVIEW-MISMATCH-001** hardening — 237 `previewSection` returned ANY div matching /selected outcomes/ in its first 160 chars when the sid was absent; now data-gated + [data-sid]-only fallback (same latent pattern exists in 234/247/249 fallbacks — follow-up sweep candidate). Verified: SU 20s 150→0; align flips endless→24 boot-settle-only; resting = header CENTER, table body JUSTIFY, sidebar rows per NO-JUSTIFY-GAPS; suite 625/625; boot-smoke + gate-probe green. Owner eyeball on live demo pending.
>
> **OWNER LIVE SESSION 2026-07-03 batch 2 → `main` PWA 1.51.55 + docx-worker 1.14.120.** **[SHIPPED 1.51.55]** (a) **GEN-UNSOL-STALE-JD-001** — unsolicited gen produced NIL content: Patch A suppresses the Additional-signals block when it IS the previous targeted app's JD; Patch B clears lastJdText + QnA keys + stale signals at the unsolicited commit (activeAppCompany left for the identity guard's own scrub); Patch C gates the QnA bridge on unsolicited context (stale sets emptied → P1 hides the page). Patch D (scrub known prior company from prose when meta.company comes back empty) = open hardening. (b) **SECTION-ROW-OPEN-001** (supersedes SECTION-TITLE-CLICK-EDIT-001): gray-area click opens the section editor on any row; dblclick on the title commits the rename then opens. (c) **TOOLS-VALUE-DEDUP-001** — label↔group-swapped byte-identical values deduped by normalized body (≥24 chars, NBSP-tolerant, trimmedItems stash, empty umbrella headers removed). Suite 623/623. **[SHIPPED wk 1.14.120, deployed]** **FIGURE-CONTACT-REF-001** — bridge medallion pinned 1.50" page-anchored (396240/−365760 EMU) riding the CONTACT paragraph (escapes the table); contact 8pt + ind 2592/−216; sidebar spacer 990; name-cell floor 2904. diag-photo-bridge-export 14/14, ownerlike pins green. Owner CloudConvert eyeball pending; preview parity (cap 144px + inset + 8pt band contact) = separate app.js patch, open. **STILL OPEN from the owner batch:** orphans v2 (roles+profile — ORPHAN_ARCHITECTURE §7-9), JD-SCAN-HALLUCINATION-001 ingest fix, GEN-UNSOL-STALE-JD-001 Patch D.
>
> **OWNER LIVE SESSION 2026-07-03 → `main` PWA 1.51.54 (NIL application).** Three owner reports, one root: the NIL app ran on the UNSOLICITED STUB JD (`antcv:lastJdText` held "GENERAL CV — UNSOLICITED APPLICATION CONTEXT" while activeAppCompany=NIL). **[SHIPPED 1.51.54]** (a) **JD-TARGETED-META-STICK-001** — cloud-restore pinned the stub in `Un.current`; targeted gen then force-unsolicited meta (header "Application: … - Unsolicited") and leaked the stub into signals + lastJdText. Fixed: stub cleared at gen start when a real JD is attached, leftover-ref showcase signal gated on `__noJD`, all 3 lastJdText writers stub-proofed. (b) **SLOGAN-TARGETED-REFRESH-001** — targeted gen clears `antcv:clSlogan` ONLY when it equals the standing specialization/last-auto value (`antcv:clSloganAuto`); manual lines untouched. (c) **APPLICATION-QA P2+P3** — new bridge sidecar `antcv-application-qa-detect.js` (worker `questions_in_jd` / gen `rationale.questions_in_jd` → `antcv:applicationQuestions` → P1 renders the CL page); kill switch `antcv:disable-application-qa`. (d) **UPPER-REPORT-REORG-001** — `#antcv-analysis-report` anchors inside the upper report; Recruiter(+empty state)/Questions cards added; lower 356 duplicates (Recruiter/Questions/Red flags) removed; analysis PDF gains Salary + full upper parity. **Data:** real NIL JD (4,573 chars, incl. the 2 Key-experience questions + recruiter vm@nilt.com) extracted VISUALLY from the unreadable PDF (pdfjs render → page images) and written to the owner's live lastJdText. Suite 611/611; analysis diags 4/4. JD-SCAN-HALLUCINATION-001 (the ingest-path fix) still open.
>
> **NIGHTLY 2026-07-03 → `main` PWA 1.51.53.** **EMPTY-ROLE-SOURCE-001 [SHIPPED 1.51.53]:** the gen-output→sections experience merge appended EVERY LLM role not in the editor list verbatim (app.src.js ~25319); the gen prompt orders "5+ on:true" slots so the model emits extras (r8/r9/r10) whose bracketed "[Role title]"/"[Company name]" text is emptied in place by kernel-completeness-290's placeholder scrub → blank on:true rows. Fixed at SOURCE: drop an extra with no title AND no company; push any populated extra as on:false (recoverable, mirrors the on:!1 backfill below). `antcv-empty-role-hide.js` stays as the belt but no longer needs to fire. Test `pwa/test/unit/empty-role-source.test.mjs` (behavioral repro + src↔app.js parity). Suite 590/590, boot-smoke + gate-probe green. **DIAGNOSED, not shipped (next session):** (a) **PAN-IDRAET-BULLET-NEARDUP-001** — `_dedupNear` (antcv-docx-client.js 2118) already catches "about 25"vs"25" via anchor-clause+overlap, but landing it needs preview↔export parity work (preview reads back only `r2.results`, NOT `r2.bullets` — the memo at app.src.js 6209-6217 must also capture bullets), object-vs-string bullet handling, a tiebreak that prefers the cleaner "25 players", KEEP_MIN=2 floor, and section-mode coverage (sanitizeForExport 1432). (b) **JD-SCAN-HALLUCINATION-001** — commit db97619 is DOCS-ONLY; garble detector `f()` (app.src.js 772) + inline PDF→vision fallback (899-956) EXIST but are mis-ordered (garbled text is knowingly handed to the LLM "decode the font" step at 869, and vision only runs AFTER the LLM fails — the NIL fabrication returned clean-looking prose that passed `f()`). Real fix = strengthen `f()` (replacement-char/mean-word-len/charset), reorder `h()` to skip the doc-LLM and go straight to vision on garble, filename↔company cross-check, visible "used OCR" notice. Needs real models to verify — blocks Task 5 live.
>
> **LATEST (2026-07-02 export-16 session → `main` PWA 1.51.52).** Export (16) verified FIXED: contact line full-width (wk 1.14.119), Publications keep-whole (wk 1.14.118), Sirin/CSA/kernel Results pins (1.51.49–51), WORK-STYLE/LANGUAGES/INTERESTS/ACCESSIBILITY routing, TOOLS≠CORE-COMP replication. **CRITICAL found+fixed:** orphan-L3 wrote by PREVIEW index — hidden+empty roles skew preview↔stored indices, so a shortened CSA/IDF bullet landed in the Teaching-Assistant + Kanzen roles (data corruption). **ORPHAN-WRITE-VERIFY-001 (1.51.52):** all L2/L3 writes text-verified (path = hint only; unique-match fallback; abort otherwise); live data repaired (TA bullet restored from exports 14/15, foreign bullet removed from Kanzen). **EMPTY-ROLE-HIDE-001 (1.51.52):** skeleton r8/r9/r10 rows ("[Role title], [Company]" placeholders) hidden, boot-sweep only. **ORPHANS still ACTIVE:** 13 multi-word runts in export 16 — v2 strategy (export-metric measurer + export preflight + RUNT_FRAC 0.40) in `docs/qa/ORPHAN_ARCHITECTURE_2026-07-02.md` §7–9. **NEW:** PAN-IDRAET-BULLET-NEARDUP-001 — within-role near-dup bullets (b1 "Manage logistics for about 25 players…" vs b3 "Manage logistics for 25 players…"); extend the anchor-clause near-dup collapse to BULLETS within a role.
>
> **PREVIOUS (2026-07-02 corrections session → `main` PWA 1.51.41; register: `docs/qa/PROJECT_ISSUES_OPEN_CLOSED_2026-07-02.md`).** SHIPPED to main: **#2** role doubling (COMPANY-VARIANT-KEY-001 + DROP-CANON-HIDDEN-DUP-001 — hidden canon-variant dups; diagnosed on LIVE sections); **#1** overlay halts mid-generation (OVERLAY-EARLY-HALT-001 — the 2-min showcase watchdog fired during a normal 3–6 min gen; now `__antcvGenCost`-heartbeat-gated); **#1b** unsolicited CORE COMPETENCIES too niche (GEN-CORECOMP-BROAD-001 — broad PdM/BA identity in `__neutralCo`); **#6** `d1_write_failed` (D1-WRITE-RETRY-001 in access-relay — **code on main, worker NOT deployed**). **#3** CL apply-path audited = no gap (deployed app.js already has `__clReal`/`__realC`/neutral fallbacks; CL blanks are downstream of #1). Suite 607/607. **OPEN:** verify #1/#1b/#3 on ONE real regen; deploy access-relay; merge the parallel `fix/focus-area-heading-ainotice` (#4/#5/#3b at 1.51.42/43 — rebase onto main + version reconcile first). Ran in worktree `.claude/worktrees/role-dedup` (parallel session active).
>
> **AUTHORITATIVE work-list + AUTONOMOUS next-session prompt (2026-07 export review): `docs/qa/EXPORT_REVIEW_2026-07_ISSUE_MAP.md`** (PWA **1.51.4** · docx-worker **1.14.105** · suite 529/529). Owner reviewed CL(10)+CV(3) after 1.51.4. **Next session: work that issue map AUTONOMOUSLY in the live browser.** Order: (A) REGRESSIONS — restore real WORK STYLE + route LANGUAGES/INTERESTS/ACCESSIBILITY to their own CV sections and REMOVE from ADDITIONAL (no dup); (C1) **HWIC vanishes after an edit = the #1 inline-edit PERSISTENCE bug — fix in browser**; (B2) stop replicating CORE COMPETENCIES into TOOLS; HWIC-intro quality + orphan mis-cap (width−30 not 30); WHAT-I-BRING truncated bullet; bold bleeding into body; contribute bullets need bold lead-ins; Professionally-That→that; Who-I-am orphan; signature STILL cut (table-wrap wk 1.14.104 did NOT fix). _(open/closed register:)_ **`docs/qa/PROJECT_ISSUES_OPEN_CLOSED_2026-06-30.md`** (closed recent = 52; shipped 2026-07: per-row lead colon editable+exportable wk1.14.103, bring_intro 1.51.1, work-style placeholder-drop wk1.14.105 [caused regression A], RESULT-SUBSUMES-BULLET 1.51.3, RESULTS-DERIVE-MEASURABLE 1.51.4). _(prior snapshot:)_ **`docs/qa/PROJECT_ISSUES_OPEN_CLOSED_2026-06-29.md`** + per-item plans in `docs/qa/NEXT_SESSION_2026-06-29.md` (PWA **1.50.968** + docx-worker **1.14.96** + access-relay **1.3.2**; suite 521/521). Read those FIRST. CRITICAL data-loss FIXED (relay 1.3.2 + client guard 1.50.957). Top OPEN = (1) kernel role bullets/results + Students-Council dup (owner rules: hide bullet not result; persistence), (2) candidate-header 3-col-grid placement, (3) CL sign-off/rich_block-compress/slogan-panel, (4) quick-gen page convergence. Older: `NEXT_SESSION_2026-06-28.md`.
>
> **Batch 2026-06-29 (overnight) — SHIPPED:** relay 1.3.2 GEN-CONTAMINATION-PRESERVE-DRAFTS-001 (data loss at source); 1.50.957 DATA-LOSS-LOAD-GRACE-001; 1.50.958 TOOLS-PAGE1-BAND-001 (TOOLS whole on page 1); 1.50.959 CL-SIGNATURE-CONTROL-001 (Layout upload control + CL preview img); 1.50.960 / worker 1.14.94 SLOGAN-CL-001 (CL tagline) + NAME-FOLLOWS-SIG-001 (sign-off reorder, name follows signature CJLR); 1.50.961 FORCE-LAST-GRP-SETTLE-001 (Environmental → page 3, verified live). OPEN (render-gated): CV 3-page convergence, candidate-header spread-left (#6), export-only pagination parity, floating-spine sidebar fill, SW-projects hyperlink, line-end overflow. OPEN (owner): trim 1 Change-Request-Lead bullet (in progress); the 3 already-nulled saved drafts (Aimpoint/NVIDIA/Open Application) are unrecoverable — regenerate.
>
> _(prior pointer:)_ **`docs/qa/NEXT_NIGHTLY_HANDOFF_2026-06-24.md`.** (PWA 1.50.869 + docx-worker 1.14.81; suite 467/467.) Read it FIRST — it has the shipped list (843→869), the regen-gated items to verify on the owner's incoming fresh export, the deep CV-SIDEBAR-SPILL spec, and the parallel-session/stale-SW discipline. The blocks below are the per-batch detail. (Older handoff: `SESSION_HANDOFF_2026-06-18-pm3.md`.)

## Owner-steered live batch — 2026-06-28 — pagination + PDF header + export (worker 1.14.90/1.14.91, PWA 1.50.946)

Owner reviewed a real exported CV/PDF mid-nightly and reported 5 issues + new feature
requests. Triaged by verifiability. SHIPPED: #4 (group split, worker 1.14.90), #5 (PDF
header left, worker 1.14.91), export warmup (PWA 1.50.946). Diagnosed + queued: #2, #3,
rich_block rule toggle, candidate-header contact bug + rule-lines (all need app.js-mirror
edits and/or a live browser).

- **(1) ADDITIONAL INFORMATION "Research outputs" label missing in preview** — `[DROPPED by owner]`
  Root cause IS understood (`antcv-group-name-visibility.js` RULE 1 hides a lone
  `{l,v}` row in a subsubsection; "Research outputs" is an unclassified "Other" row
  appended with no `{group}` marker → lone trailing row → label hidden). Owner said
  "it is okay to keep this role" → leave as-is. Fix-if-revisited: RULE 1 should only
  hide a lone row whose subsubsection was opened by a real `{group}` marker.

- **(4) Sidebar group split across pages** `[SHIPPED docx-worker 1.14.90]`
  **RICH-BLOCK-MIDSECTION-SPLIT-001** — REGULATORY CONTEXT (a sidebar `rich_block`)
  spanned pages with the "Environmental, Durability & Compliance" group header
  orphaned at the bottom of page 1 and "MIL-STD-810G: ...qualification, including
  Method 514 vibration" split mid-sentence. Root cause: `renderSection`'s segment-split
  eligibility list (`workers/docx-worker/src/index.js` ~25767) omitted `rich_block`, so
  a spanning rich_block emitted its per-row break INSIDE the section-wrapper body cell —
  invisible to `splitChildrenByPage` (top-level `__antcvPB` only) — and LibreOffice
  chopped the one giant cell arbitrarily. FIX: chunk a sidebar rich_block by `row_pages`
  into TOP-LEVEL page segments (mirrors the proven labeled_list/table/experience
  chunkers; row_pages cleared per chunk; `_antcvSegment` guard); each smaller chunk
  also falls under the `body<=18` cantSplit guard so a value can't break mid-paragraph.
  Whole-section move (first item page 2) still falls through to `_firstItemPageBreak`
  unchanged. Verified `test/diag-richblock-midsplit.mjs` (drives the worker, inspects
  word/document.xml): CONTROL=1 page/0 breaks, MIDSPLIT=2 top-level page tables + body
  break, header rides to page 2 with its row, value intact, (CONT.) heading, no loss.
  Regression-clean: node --test fail 0; wholemove/twocol-paged/rich-block-export/
  sidebar-pack/twocol-ownerlike all OK. Deployed run 28324814881.

- **(3) Role header orphaned (System Architect on page 1, body page 2)** `[DIAGNOSED — needs live tuning]`
  PREVIEW-EXPORT-PAGEBREAK-PARITY: the coordinator (`antcv-auto-pagebreak-block-001.js`
  `__uniPaginate`) over-packs page 1 because the role's preview-measured height
  under-estimates its export height (Calibri renders taller + `MAIN_PDF_LINE_BONUS=150`
  inflates the page-1 line), and the worker page-box cell isn't a hard clamp
  (`makeBodyRow` cantSplit:false/atLeast) so LibreOffice splits the over-packed role.
  Fix = a more conservative page-1 main budget (lower `MAIN_PDF_LINE_BONUS` / raise
  `PAGE1_BAND`, or a role-tail guard). This is a TUNING number the owner calibrates
  live on the real doc (`AntcvAutoPagebreak.config({...})`) — NOT blind-shippable
  (it shifts every role's page assignment). Owner to report the value to commit.

- **(2) Page-2/3 "dance" on scroll** `[DIAGNOSED — needs live browser]`
  SIDEBAR-PAGE23-DANCE-001: only page-1 and FORCE_LAST_GRP have a determinism cache;
  the ordinary page-2/3 boundary re-derives from live measured heights on every pass.
  The 3s poll re-measures the scroll-re-rendered preview; sub-pixel height deltas near
  the `cap` flip the break. Fix = a block-count+width signature cache for the whole
  sidebar `__sPaged` (mirror FORCE_LAST_GRP) so the boundary is deterministic across
  scroll re-measures. NOT blind-shippable: headless metrics won't prove the visual fix,
  and the cache invalidation carries the SIDEBAR-SHRINK-RECLAIM regression risk — needs
  the jump-probe + the owner's live browser on a real 3-4 page CV.

- **(5) PDF candidate-header text too far right vs preview** `[SHIPPED docx-worker 1.14.91]`
  **PDF-HEADER-LEFT-001** — Option A (geometry, owner-approved). Band-overlap bridge
  header text origin was `sidebarW + 120` twips; preview is `sidebarW − 28px`. Narrowed
  the empty photo-zone cell by 540 twips + widened the text cell by 540 (cells still sum
  to PAGE_W, text left margin kept 120) → origin `sidebarW − 420` = −28px, matching the
  preview. `workers/docx-worker/src/index.js` ~24829-24846. Verified in document.xml
  (chk): 3389 + 8517 = 11906, text left 120, origin 3509 = sidebarW(3929) − 420; node
  --test 13/13; photo-bridge/midsplit/ownerlike/photo-positions OK. Deployed run
  28325421198. Owner does the final CloudConvert PDF eyeball.

- **(Export) "Page setup" first on PDF export, refresh needed for CloudConvert** `[SHIPPED PWA 1.50.946]`
  **EXPORT-WARMUP-001** — the PDF button gates on `await isPdfWorkerAvailable()` which
  lazily probes the docx-worker `/health` on the FIRST click; a cold worker returns a
  transient null (NOT cached) → gate fails → browser-print fallback (`kl()`); refresh
  warms it. New sidecar `antcv-pdf-worker-warmup.js` calls the probe in the background
  ~2.5s after boot (retry until /health answers) so the cache is populated before the
  first export. Purely additive + read-only — cannot regress (worst case no-op). Kill
  switch `antcv:disable-pdf-warmup`. Verified `pwa/test/diag-pdf-warmup-verify.mjs`
  (proactive /health hit, no user click; suite 485/485).

- **(Feature) rich_block RULE independent of HEADLINE** `[DIAGNOSED — queued]`
  Owner: the "— Rule" button is disabled when the headline is hidden ("No rule without a
  headline"); wants the horizontal rule show/hide-able independently. Coupling in 3 of 4
  layers: EDITOR `antcv-rich-block-editor.js` L66 (`disabled:headOff` + `if(!headOff)`
  guard); PREVIEW `app.src.js` ~6858-6899 (headlineOff → whole heading block incl. rule
  returns null); WORKER `index.js` renderSection ~26001 (`s.headlineOff` skips heading
  entirely) + `headingParagraph` always packs title+rule together. Fix: decouple — early-
  null only when BOTH off; render title node on `!headlineOff`; thread `headlineOff` into
  headingParagraph to emit a title-less bordered paragraph (standalone rule). NOTE: the
  heading wrapper is GENERIC across all section types, so this is not rich_block-scoped.
  Needs app.js mirror + worker deploy + headless verify (preview + document.xml).

- **(Feature/bug) Candidate-header: Contact click closes the section + per-field rule lines** `[DIAGNOSED — queued]`
  BUG: clicking the "Contact" row in the candidate side-panel collapses the section
  instead of opening contact editing. Root: the accordion row `je` (app.src.js ~11267)
  shares its click area with the loc-move `◀` button (`s(e.key)` rewrites sections, moves
  contact out of the topbar list) and the section header's collapse toggle
  (data-candidate-drop-loc, ~45044); the move/ON-OFF buttons lack stopPropagation. Fix:
  add `ev.stopPropagation()` to the loc/ON-OFF button handlers (~11545/11572/11594) and a
  `target.closest('button,input,…')` early-out on the row onClick (~11426). FEATURE: add
  an optional horizontal rule before/after each header field (Name/Spec/Application/Contact)
  — the `f(color,before,after)` rule helper already exists (app.src.js ~26302); add a
  `headerItemRule` store (mirror of headerItemAlign) + worker buildHeaderCell parity
  (~25288). Needs app.js mirror (shadow-hazard: verify `je`'s locals in-scope).

- **(3) and (2) below stay DIAGNOSED — owner live-tuning / live browser (unchanged).**

## Nightly autonomous — 2026-06-28 — wait-screen scan gate (1.50.945)

- **BOOT-WAITSCREEN-GATE-001** `[SHIPPED 1.50.945]` — continuing the boot-freeze
  sidecar-swarm reduction ([[boot-storm-gate-freeze]]). Re-profiled at HEAD 1.50.944
  (`diag-boot-profile.mjs`): the previously-treated tail offenders (238/274/245/249/237)
  are now all ~25-36ms (diminishing returns), so this run targeted the biggest UNTREATED
  offender — `findWaitScreenContainers @ antcv-wait-screen-times.js` (~81ms self, file
  82ms). That sidecar rewrites the generation overlay's "60/90 seconds" label to "4-6
  minutes"; its `findWaitScreenContainers()` runs a 9-selector case-insensitive
  full-document `querySelectorAll` (`[class*="overlay" i]`,modal,wait,loading,progress,
  spinner,role=dialog,…) on EVERY `applyAll()` (rAF + 4 timeouts + a body subtree
  MutationObserver = many fires during the boot storm). During boot NO wait overlay
  exists, so every pass scanned the whole tree and found nothing — pure waste.
  FIX (sidecar-only, NO app.js mirror, NO islands bundle → no parallel-session
  contention): a cheap precondition `canMatchAnyReplacement()` at the top of `applyAll()`.
  Every `REPLACEMENTS` entry requires a word-boundaried "60"/"90" (`\b(?:60|90)`) or a
  "1-2 minutes" token; if `document.body.textContent` has none, no rewrite can fire, so
  skip the scan and return 0. KEY trap caught + fixed: a plain `indexOf('60')` matched the
  always-present spinner keyframe `rotate(360deg)` (and years 1990/2090) → the gate would
  NEVER short-circuit in production and the fix would be worthless. The `\b` mirrors
  exactly what the replacements need and excludes those incidental substrings. The gate
  reads ONE already-materialised string + regex — never calls querySelector, so it can't
  add to the dominant native query cost. Strict superset of "a replacement could match" →
  never suppresses a real rewrite (a 60/90 in content but not in a wait overlay just falls
  through to the unchanged scan, which rewrites nothing). Verified PAST the sign-in gate
  (`pwa/test/diag-waitscreen-gate-verify.mjs`): editor renders; on a clean doc the
  wait-screen full-document scan count is 0 (gate short-circuits); a real injected overlay
  with "60 seconds" is still rewritten to "4-6 minutes"; zero sidecar console errors.
  Re-profiled: `antcv-wait-screen-times.js` dropped OFF the top-14 file list and
  `findWaitScreenContainers` is gone from the self-time list (was 81ms top); native/gc
  by-file 2801→1864ms (noisy run-to-run, but the function disappearing is unambiguous).
  Suite 485/485. NEXT untreated offenders for a future run (re-profile first — noisy):
  `txt @ antcv-wizard-section-format-step10.js:13` (~59ms),
  `findSidebarSectionRows @ antcv-sidebar-section-row-hide-page-279.js:140` (~38ms). The
  json-repair-bundle `wrapped` (~150ms) is a `JSON.parse` override — DO NOT TOUCH (parse
  chain; the self-time is native parse cost attributed to the wrapper frame). Bigger lever
  remains a SHARED swarm coalescer (higher value, higher blast radius).

## Nightly autonomous — 2026-06-28 — boot-freeze swarm-tail batch (1.50.944)

- **BOOT-HIWC-PERF-001 / BOOT-EMBED-ROOTCACHE-001 / BOOT-FND-PERF-001 / BOOT-FND-ROOTCACHE-001**
  `[SHIPPED 1.50.944]` — continuing the boot-freeze sidecar-swarm reduction
  ([[boot-storm-gate-freeze]]). `diag-boot-profile.mjs` (at HEAD 1.50.943) flagged the next three
  top tail offenders. All sidecar-only (NO app.js mirror, NO islands bundle → no parallel-session
  contention). Same proven behaviour-preserving patterns as 943's BOOT-COREWIB/WIB-ROOTCACHE-001:
  CROSS-RUN ROOT CACHE (re-validate the cached root with the SAME predicate; never cache null/
  non-preview roots) + PER-RUN clean(el.textContent) memo (Map cleared at run() start).
  - `antcv-how-contribute-controls-245.js` (~165ms): per-run `cleanEl` memo (root() 10-deep climb,
    previewParts, previewSection all re-serialised the same big shared ancestors per run) + a
    cross-run `__previewSecCache` on `previewSection()` (was a full-doc `.find()` over every
    [data-sid],section,div + clean(textContent)).
  - `antcv-embedded-controls-248.js` (~159ms): cross-run `__addinfoCache` on the addinfo root finder
    (was a full-document querySelectorAll('div,section,main,form') + clean(textContent) on EVERY
    element per run; the panel is the same element each run). The existing 880 per-run clean memo
    couldn't help — distinct textContent per element ⇒ ~0 hit rate; only a root cache fixes a
    full-document subtree scan.
  - `antcv-foundation-controls-327.js` (~142ms, NOT previously treated): per-run `cleanEl` memo
    (isFoundationField climbs 4 ancestors per field PER PART; foundationPreviewParas cleans every
    <p>) + cross-run `__fndRootCache` on `foundationPreviewParas()`. (A filter-reorder that ran
    inPreview()'s document.querySelector before visible() was drafted but REVERTED — it would have
    ADDED querySelector calls on every field, the wrong direction for the dominant native cost.)
  Verified PAST the sign-in gate (`pwa/test/diag-sidecar-perf-944-verify.mjs`): editor renders, all
  three sidecars load + their run() executes clean, 327's root cache short-circuits a repeat scan
  (doc [data-sid=foundation] scans 1→0), zero sidecar console errors. Re-profiled
  (`diag-boot-profile.mjs`): total boot on-CPU 5682→4770ms, native/gc 3333→2510ms (−25% — the
  cross-run caches remove the full-document querySelectorAll cost that lived under native/gc); 327
  dropped OFF the top-14 self-time list (142→<59ms). Suite 485/485. NEXT profiled offenders for a
  future run: `antcv-profile-workstyle-cjlr-238.js` (~280ms, still top — already fully memoised;
  residual is the irreducible per-run ancestor climb), `antcv-what-i-bring-header-cjlr-249.js`
  (~205ms), `antcv-selected-outcomes-row-controls-237.js` (~155ms). Bigger lever remains a SHARED
  swarm coalescer (higher value, higher blast radius). Re-profile before targeting (numbers noisy
  run-to-run).

## Nightly autonomous — 2026-06-27 — boot-freeze root-cache batch (1.50.943)

- **BOOT-COREWIB-ROOTCACHE-001 / BOOT-WIB-ROOTCACHE-001** `[SHIPPED 1.50.943]` — continuing the
  boot-freeze sidecar-swarm reduction ([[boot-storm-gate-freeze]]). `diag-boot-profile.mjs` (at HEAD
  1.50.942) flagged the two top remaining sidecar root-finders, each running a FULL-DOCUMENT
  `querySelectorAll` on EVERY `run()` (boot timers + MutationObserver + click/input/sections-updated =
  dozens of times during the boot storm) though they resolve to the SAME element each run:
  - `antcv-core-wib-strict-row-layout-274.js` `panelRoot` (~108ms): `qs('h1,h2,h3,b,strong,div,span')`
    + 10-deep ancestor climb.
  - `antcv-what-i-bring-header-cjlr-249.js` `editorRoot` (~99ms): `qs('input,textarea,[contenteditable]')`
    seed scan + climb.
  FIX (same behaviour-preserving cross-run cache as BOOT-WM-PERF-001's chooseCorner memo): cache the
  resolved root across runs + re-validate it cheaply — the scan path is the original predicate verbatim
  (factored into `panelMatch` / `editorRootValid`), the cache short-circuits only when the cached element
  still passes the SAME test (O(1) text test, or a subtree-scoped count, vs an O(doc) scan). Null results
  are never cached (panel may not exist yet at boot); 249 never caches/keeps a preview-paper root, so the
  `inPreviewPaper` guard in `findRows` is unchanged. Verified PAST the sign-in gate
  (`pwa/test/diag-rootcache-verify.mjs`): both resolve a real root then short-circuit the full-document
  scan — 249 findRows returns a consistent 2 rows with doc seed-scans 1->0; 274 run() doc head-scans
  1->0; zero sidecar console errors. Re-profiled: panelRoot 108->72ms, editorRoot dropped OUT of the top
  self-time list, native/gc 3566->2582ms. Sidecar-only — NO app.js mirror, NO islands bundle → no
  parallel-session contention. Suite 485/485. NEXT profiled offenders for a future run:
  `antcv-profile-workstyle-cjlr-238.js` (~300ms, now top — already cleanText/lowText/sectionFromElement
  memoised, residual is the per-run climb itself), `antcv-embedded-controls-248.js` (~180ms),
  `antcv-how-contribute-controls-245.js` (~172ms). Bigger lever = a SHARED swarm coalescer (higher value,
  higher blast radius). Re-profile with `diag-boot-profile.mjs` after each.

## Nightly autonomous — 2026-06-25 — boot-freeze sidecar-swarm memo batch (1.50.880)

- **BOOT-COREWIB-PERF-001 / BOOT-OUTCOMES-PERF-001 / BOOT-EMBED-PERF-001** `[SHIPPED 1.50.880]` —
  continuing the boot-freeze sidecar-swarm reduction ([[boot-storm-gate-freeze]]). The three
  handoff-named next offenders each spent their boot CPU re-running the SAME pure whitespace-clean
  over large container `textContent`s on every tick (MutationObserver/click/input/interval). Fixed
  with the proven per-run `clean` memo (cleared at `run()` start; pure fn → identical output), plus
  for 274 a `visible()`-after-text-match reorder so `getClientRects()` (forced layout) only runs on
  title-matching elements, not every `h1,h2,h3,b,strong,div,span` in the doc, + a raw-length guard
  skipping big containers in the outer panel scan (the ancestor climb still covers them).
  - `antcv-core-wib-strict-row-layout-274.js`: 227ms → 112ms (−50%).
  - `antcv-selected-outcomes-row-controls-237.js`: 143ms → 107ms.
  - `antcv-embedded-controls-248.js`: 134ms → 108ms.
  - native/gc 2876ms → 2098ms (fewer regex allocations). Re-profiled via `diag-boot-profile.mjs`.
  Sidecar-only — NO app.js mirror, NO islands bundle → no parallel-session contention. Verified PAST
  the sign-in gate (`diag-boot-perf-memo-verify.mjs`): editor renders, all three sidecars load +
  their `run()` executes clean on the live editor DOM, zero sidecar console errors. Suite 472/472.
  NEXT profiled offenders for a future run: `antcv-profile-workstyle-cjlr-238.js` (sectionFromElement
  111ms residual), `antcv-what-i-bring-header-cjlr-249.js` (editorRoot 82ms), `antcv-how-contribute-controls-245.js`.

## Owner fresh-export batch status — 2026-06-24 (run 9) <!-- FRESH-EXPORT-BATCH-0624-status -->

- **(A) Contribute still empty** -> FIXED `CONTRIBUTE-CHAROBJ-FIX-001` [1.50.870] (see block below). Was a char-object corruption of the bullet items, healed restore-proof. Verified on the owner's real data.
- **(B) CV 9-page sidebar spill -> owner wants 3 pages** `[SHIPPED 1.50.871 + worker 1.14.82, FLAG-GATED default-off; owner-verify]`  BALANCE-OVERFLOW-001: full-width overflow re-flow; enable `localStorage.setItem('antcv:balance-overflow','1')` + export to test, then flip default-on.. Mechanism re-confirmed on his real data (sidebar ~7 sections incl. regulatory >> main 12 roles; `numPages=max(sidebarPages,mainPages)` leaves empty-main overflow pages). The trailing-trim (1.14.81) + dup-group-merge (869) only trim edges. The real fix re-flows the overflow sidebar FULL-WIDTH, but the worker's per-slot model uses FIXED `atLeast` row heights (makeBodyRow ~24768, one slot=one page) — reducing pages needs a NATURAL-FLOW full-width navy table for the overflow + watermark-anchor move + navy-fill rework. High blast radius (all CV exports) and the LibreOffice/CloudConvert PDF render is NOT verifiable headlessly. **Do as a focused worker session, FLAG-GATED (default off), verify on a real export, then default on.** Not rushed/blind-shipped.
- **(C) "CV sidebar content" settings section not in the blue box** `[SHIPPED 1.50.872]` CV-SIDEBAR-CONTENT-BOX-001: now an rdSection() boxed card (antcv-data-export-360.js) matching its siblings.. Rendered by `src/islands/WritingStylePicker/mount.tsx` — the EXACT island the parallel PERSONAL_REVIEW_EDIT_MERGE session is restructuring. Do after that lands (the refactor may move/box it anyway).
- **(D) Layout PROFILE PHOTO control -> collapsible (collapsed default) + stop it sticking on the Account tab** `[SHIPPED 1.50.872-873]` PHOTO-CONTROL-COLLAPSE-001: new sidecar antcv-photo-control-collapse.js (collapse toggle via [data-antcv-bridge-active] hook, collapsed default, hides a duplicate leaked into another panel).. The control + its tab-anchoring live in `app.src.js` (Layout, the parallel's active refactor scope; STICKY-LEAK family they already touched at 6f97149/3df23cb). Wrap in a collapsed <details> + gate its injection to the Layout tab — but do it against the SETTLED Personal/Layout UI after the parallel lands, not concurrently.

## Owner fresh-export — 2026-06-24 (run 9) — contribute char-object heal (1.50.870)

- **CONTRIBUTE-CHAROBJ-FIX-001** `[SHIPPED 1.50.870]` — owner "how I would contribute is STILL empty" on a
  post-847 export. NOT the p-flag (that worked — intro/closing now populate). The bullet ITEMS were
  corrupted into CHAR-INDEXED OBJECTS: `{"0":"M","1":"a","2":"p",...,mk:true}` — `antcv-hwic-to-rich-block-760.js`
  fixedA ran `Object.assign({}, r)` over a STRING item, spreading it char-by-char; the rich_block renderer
  reads .b/.t (absent) -> BLANK bullets. FIX (760 fixedA mapper): heal a char-indexed object back to {t}
  (reconstruct from the numeric keys) and normalise a raw string to {t} BEFORE any Object.assign so it can
  never re-corrupt. Verified on the owner's REAL data (4 char-objects -> 4 correct {t} strings: "Map the
  current change-request flow...", "Set up KPIs...", "Introduce structured gate criteria...", "Keep
  decisions..."). Unit test contribute-charobj-fix.test.mjs (5); suite 472/472. Restore-proof (760 runs on
  load + sections-updated) -> heals the owner's existing corrupted data on next load (no regen needed).

## Owner real-PDF review — 2026-06-24 (run 8) — regulatory dup-group merge (1.50.869)

- **DUP-GROUP-MERGE-001** `[SHIPPED 1.50.869]` — analysing the owner's REAL exported CV (9 pages) +
  his live sections: REGULATORY CONTEXT had SEVEN {grp} headers but only FOUR distinct groups — three
  were duplicated under case/&-variant names ("Systems, safety and cybersecurity" + "Systems, Safety &
  Cybersecurity"; "Electrical and EMC" + "Electrical & EMC"; "Environmental, durability and materials
  compliance" + "...Durability & Materials Compliance"). A generation-merge dedup miss. New sidecar
  `antcv-dup-group-merge.js` canonicalises group names (lowercase, &->and, punctuation collapsed) and
  MERGES same-canonical groups under the first header, concatenating rows + dropping exact-duplicate
  rows; distinct groups untouched; idempotent + loop-safe + restore-proof. Shrinks the sidebar (the
  column that drives the overflow) and fixes the visible duplicate-header defect. Unit test
  `dup-group-merge.test.mjs` (4: 7->4 headers + rows preserved, idempotent, exact-dup dedup, no false
  merge); suite 467/467. NOTE: certs were a FALSE ALARM (string items render fine via the export's
  string->{t} path; not hidden).

- **CV-SIDEBAR-SPILL-9-PAGES — deep fix STILL OPEN (spec'd)** — the bulk of the 9-page overflow is the
  sheer SIDEBAR VOLUME (regulatory ~21 standards + tools 14 + certs 9 + education/langs/interests/access)
  far exceeding the MAIN column (12 roles), so `numPages = max(sidebarPages, mainPages)` (src/index.js
  ~24664) leaves pages 5-8 with sidebar content + an EMPTY main cell. The dup-group-merge + trailing-trim
  (1.14.81) trim the edges but do NOT materially cut the count. The real fix re-flows the overflow
  sidebar FULL-WIDTH (single column → ~2x density → ~half the overflow pages). That is a high-blast-radius
  docx-worker change whose LibreOffice/CloudConvert PDF rendering can't be verified headlessly — needs a
  real-export check. SPEC for a focused session: (1) find lastMainSlot; (2) for slots > lastMainSlot,
  concatenate the sidebar content and emit ONE full-width navy single-cell table (reuse the per-row
  atLeast navy-fill mechanism) with natural flow so the converter paginates it at full width; (3) move
  the AI-watermark anchor to the true last (full-width) page; (4) ship behind a payload kill switch,
  verify on a real export before enabling broadly.

## Owner batch — 2026-06-24 (run 7 cont.) — pagination trailing-blank trim (docx-worker 1.14.81)

- **PB-WORKER-TRAILING-BLANK-001** `[SHIPPED docx-worker 1.14.81]` — owner "fix pagination/page overflow":
  partial, SAFE fix for the CV-SIDEBAR-SPILL-9-PAGES report. A column ending on a page-break marker made
  `splitChildrenByPage` push a trailing EMPTY page; `numPages = max(...)` counted it → a blank trailing
  sheet. Added `trimTrailingEmptyPages()` (pops trailing zero-children pages per column before numPages;
  never removes content). diag-twocol-paged unchanged (no regression); trim proven 3→2 pages content-intact.
  **STILL OPEN (deep, owner-gated):** the bulk of the 9-page spill is the SIDEBAR being far longer than the
  MAIN column — after the main ends (~p4) the sidebar continues onto pages 5-8 with an EMPTY main cell
  (`numPages = max(sidebarPages, mainPages)`, src/index.js ~24664). The real fix is to RE-FLOW the
  overflow sidebar FULL-WIDTH on empty-main pages (re-paginates it into fewer pages) — a deep two-column
  engine change that needs the owner's real long-sidebar sections to reproduce + a real-export verification
  before shipping (all-exports blast radius). Scoped for a focused worker session.

## Owner batch — 2026-06-24 (run 7) — alt-button minimise + boot-perf (1.50.868)

- **ALT-BTN-MINIMISE-001** `[SHIPPED 1.50.868]` — owner: make the WITHIN-PACKAGE STYLE quick-alt buttons
  visually compact with CIRCULAR swatches (not square). `src/islands/PackagePicker/PackagePicker.tsx`:
  added a `round` prop to `Swatch` (borderRadius 50%) and used it in `quickAltButtons` at size 13 with
  tighter padding (4px 9px), gap 7, smaller hex labels. Rebuilt `antcv-react-islands.js` via `npm run build`
  (vite, 41 modules; bundle diff = only the PackagePicker change; the parallel session's Personal/Layout
  islands intact). The functional alt-recolor shipped earlier (WITHIN-PACKAGE-STYLE-ALT-RECOLOR-001, 849).
  boot-smoke + suite 463/463. Owner visual confirm.
- **BOOT-WIB-PERF-001** `[SHIPPED 1.50.868]` — continuing the boot-freeze sidecar-swarm reduction.
  `antcv-what-i-bring-header-cjlr-249.js`: `clean(el.textContent)` was called ~5x per table row
  (header/body filters) + on the 10-ancestor editorRoot climb. Per-run `cleanText` memo collapses the
  repeats. Sidecar-only; node --check OK.

## URGENT — 2026-06-24 — every-word version injection (1.50.867)

- **EVERY-WORD-VERSION-INJECTION-001** `[FIX SHIPPED 1.50.867]` — owner (mobile): the app showed the
  version string wrapped around EVERY word ("1.50.866AntCV1.50.866", "1.50.866Skip1.50.866 1.50.866to1.50.866 ...").
  ROOT: `antcv-version-override.js` builds `STALE_RE = /\b(v1|v2|...)\b/` from STALE_VERSIONS; a blank /
  non-string entry (a `null` — seen LIVE in window.AntcvVersionOverride.staleVersions, count 1055 with a
  null tail) creates an EMPTY alternative `(...||...)` so `\b(\b)\b` matches every word boundary and
  TARGET_VERSION is inserted around every word. The DEPLOYED file (fetched no-store) + origin/main source
  were CLEAN (1053 entries, no null) — the owner's browser was running a STALE SW-cached version-override.js
  from a parallel intermediate that had the null; `?hardReset` did not evict it (stale-SW-version-mask).
  FIX (defensive, sidecar): filter STALE_VERSIONS to real non-TARGET version strings BEFORE building the
  regex (`typeof v==='string' && v.trim().length>=3 && v!==TARGET`); if none remain, STALE_RE=null and
  rewriteTextNodes no-ops. A malformed/stale array can now NEVER inject. Also added 865/866 to STALE
  properly. Cache-bust → 1.50.867 (forces the stuck SW to fetch the fresh robust file). Owner: hard-refresh;
  if it persists, the SW needs eviction (the 867 sw.js CACHE bump purges old caches on activate).

## Nightly autonomous — 2026-06-24 (run 6) — boot-perf watermark memo (1.50.866)

- **BOOT-WM-PERF-001** `[SHIPPED 1.50.866]` — continuing the boot-freeze sidecar-swarm reduction (see
  [[boot-storm-gate-freeze]]). `antcv-watermark-page-anchor-341.js` `chooseCorner()` walked EVERY page
  element + getBoundingClientRect()'d each (O(N) forced layout) on every tick (input/1500ms-interval/
  MutationObserver/boot-storm) — a top boot-CPU consumer (~143ms, diag-boot-profile.mjs). FIX (sidecar):
  memoise the corner RESULT by a cheap content signature (doc + page count + last-page text length +
  viewport width — exactly what changes the corner); the cheap anchoring still runs every tick (handles
  React re-renders), only the O(N) scan is skipped when unchanged. Re-profiled: watermark-page-anchor
  dropped OUT of the top-14 by-file; total boot on-CPU ~4.8s→~3.9s (synthetic). Parse OK; sidecar-only,
  no app.js mirror / no islands bundle (no parallel contention). Cache-bust → 1.50.866.

## PERSONAL "Review & Edit" merge + follow-ups — 2026-06-24 (1.50.846 → 1.50.865)

Plan: `docs/plan/PERSONAL_REVIEW_EDIT_MERGE.md`. The high-quality data reviewer became the single **Review & Edit** surface, launched from Settings → Personal; the duplicate native Personal controls were retired; tone/sub-section editors made fully editable; then a long owner UX punch-list. All shipped to `main` (PWA auto-deploy) + docx-worker deployed for the publications-link export.

### CLOSED — shipped & verified (test in `pwa/test/diag-*`)
- **PERSONAL-MERGE-1 (launcher relocate)** `[SHIPPED 1.50.848]` — "Review my data" → **"Review & Edit my data"**; the launcher (review + account-locked export) moved from the Account privacy zone into the Personal flex column. `diag-launcher-inject` / `diag-personal-merge-e2e`.
- **PERSONAL-MERGE-2 (collapsible cards)** `[SHIPPED 1.50.849]` — every modal card is a disclosure, COLLAPSED by default; work-history rows collapse to title·company·years. `diag-review-collapse`.
- **PERSONAL-MERGE-3 (editable tone panels)** `[SHIPPED 1.50.850]` — modal hosts the `WritingStylePicker` banned-words/phrases (per-language scope + bank + bulk paste) + semantic-constraints editors via a new exported `ToneEditors`. `diag-personal-merge-e2e` (real React).
- **ANTCV-REACT-ISLANDS-CLOBBER-001** `[FIX SHIPPED 1.50.851]` — vite's IIFE `name:'AntcvReactIslands'` reassigned `window.AntcvReactIslands` to the module namespace `{api}` AFTER the body set it to `api`, so `mountToneEditors` was undefined and the tone editors silently failed to mount in prod. Fix: dedicated `window.AntcvMountToneEditors` global the wrapper never clobbers. Surfaced by repairing the e2e harness gate-seed (the login loading overlay, not the seed, was hiding the editor).
- **HARNESS-GATE-SEED-001** `[FIX SHIPPED 1.50.851]` — signed-in e2e tests booted to a blank screen (the loading overlay held ≤9s; tests waited 3s). Seed `antcv:disable-loading-gate=1` + stub the SW; settings tab marker is "Standard" not "STANDARD"; anchor on the writing-style-picker mount (the standalone languages anchor was retired).
- **PERSONAL-MERGE-4 (Additional sub-blocks)** `[SHIPPED 1.50.852]` — Languages / Interests / Accessibility as editable sub-blocks of Additional info (edit `sections.cv[{id}]`); standalone Languages card removed; non-destructive Languages seed. `diag-additional-subblocks`.
- **PERSONAL-MERGE-5 (FABs + personality)** `[SHIPPED 1.50.853]` — floating Export/Import FABs removed; **personality card** fixed (was silently broken on a retired anchor) now shows trait chips + work-style line + Retake. `diag-personal-merge5-e2e`.
- **PERSONAL-MERGE-6 (hide native dupes)** `[SHIPPED 1.50.854]` — reversible CSS sidecar `antcv-personal-dedup-hide.js` hides Name/Headline/Quick-contact/Background/CV-Sidebar + the island's Banned/Phrases/Semantic headers; kill switch `localStorage['antcv:show-personal-dupes']='1'`. Coverage-proven (`diag-personal-merge6-e2e`) per the 1.50.545 precedent.
- **PERSONAL-MERGE-7 (account-locked import)** `[VERIFIED 1.50.854]` — already wired: `AntcvIsBackupEnvelope` recognises `_antcvBackupUserBound` → `decryptUserBound` via `/api/export-key`. `diag-locked-import-routing`.
- **LANGUAGES-MIRROR-001** `[SHIPPED 1.50.855]` — `personalInfo.languages` now mirrors `sections.cv.languages` exactly (write on edit + on open).
- **SW-PROJECTS-001** `[SHIPPED 1.50.855]` — dedicated "Software projects" sub-block (`sections.cv.projects`). (Note: Gabriel's kernel still places AntCV under the Kanzen experience entry; this is a generic projects slot.)
- **PUB-MASTERSITE-001** `[SHIPPED 1.50.855 control / 1.50.859 render]` — Publications profile link (Scholar/Academia/ORCID…), default off, on `section.masterSite`; control in editor panel + modal; RENDERS "All publications: <label>" in preview (`app.src.js`+`app.js` surgical mirror) and DOCX export (docx-worker `renderSimpleList`, deployed). `diag-pubsite-render`.
- **RECS-IN-PANEL-001 + RECS-IMPORT-001** `[SHIPPED 1.50.857]` — Recommendations editor in the modal (recommender/who/contact, education-shaped section); the importer detects a recommendation/reference letter (name + content) and LLM-extracts who/title/position/relationship/contact into the Recommendations section. `diag-recommendations`.
- **ADDITIONAL-DEDUP-001** `[SHIPPED 1.50.858]` — Languages/Interests/Accessibility shown ONLY in their sub-blocks; the native Additional editor hides them, kept as tagged `__sub` hidden mirrors in `personalInfo.additional` (added/removed with the item). Importer now extracts `interests`+`accessibility`; sub-blocks seed from them. `diag-additional-dedup`.
- **PUBS-MODAL-ENTRIES + CV-SIDEBAR-COLLAPSE** `[SHIPPED 1.50.860]` — the modal Publications section covers the entries (not just the link); "CV sidebar content" is a collapsible group, collapsed by default. `diag-pubs-modal`.
- **UX-BATCH (caption/import-order/personality-in-modal/account-mode)** `[SHIPPED 1.50.861]` — name-caption hidden; **Import button moved above Review & Edit**; **Personality moved into the modal** (above CV sidebar, results + Retake); ACCOUNT MODE (Demo/Paid) collapsed by default. `diag-personality-modal`.
- **STICKY-LEAK-001** `[SHIPPED 1.50.862 — owner-verify (admin-only)]` — the Review & Edit/Export launcher leaked onto the Account set-menu; now hidden whenever the ACCOUNT MODE block (admin-only) is visible. No-op for non-admins; can't be verified headless (`diag-launcher-scope` SKIPs).
- **FND-LEAK-001** `[FIX SHIPPED 1.50.863]` — the Foundation per-paragraph controls (page/fit/enhance/CJLR) leaked into the Review & Edit modal; `attachPanel` now excludes any field inside `[data-antcv-review-modal]`. `diag-fnd-modal-leak`.
- **IMPORT-DUP-001** `[FIX SHIPPED 1.50.864]` — the import button appeared twice (the app renders >1 native import button → >1 replacement). `placeImportInLauncher` keeps exactly ONE (in the launcher), removes the rest. `diag-personal-merge-e2e` (importCount===1).
- **PUBS-SPLIT-FIELDS-001** `[FIX SHIPPED 1.50.864]` — modal Publications entries split into Title/Authors/Journal/Year/Pages (matching the editor's rich panel), round-tripping items[]+pubFields[]. `diag-pubs-modal`.
- **PERSONALITY-STORE-001** `[FIX SHIPPED 1.50.864]` — the modal said "No personality kernel yet" though a kernel was set via a prior wizard/import; it lived at `personalInfo.workStyle`, not `.personality`. Now reads BOTH (traits+work_style_line OR strengths+summary). `diag-personality-modal`.
- **INTERESTS-RICHBLOCK-001** `[FIX SHIPPED 1.50.865]` — the Interests sub-block only read `{l,v}`, so Gabriel's `rich_block` `{b,t}` interests didn't show and editing collided. The editor is now shape-aware: reads `{b,t}`, and writes in the section's own shape (rich → `{b,t}`, no duplication) — full add/edit/delete/append control. CANON_INTERESTS (6 items, `antcv-sections-normalize-415`) already matches the owner's list. `diag-interests-richblock`.

### OPEN / owner-verify
- **STICKY-LEAK-001 (verify)** — confirm Review & Edit / Export are gone from the Account set-menu on the owner's admin account; if they still leak, name the exact screen.
- **ACCOUNT-MODE-COLLAPSE (verify)** — the ACCOUNT MODE block is admin-only; confirm it folds for the owner.
- **PERSONALITY-STORE-001 (verify)** — confirm the owner's personality result now renders. If still empty, the kernel is stored somewhere not yet read (e.g. a cloud/D1 kernel) — owner to check `JSON.parse(localStorage.personalInfo)` for the field.
- **INTERESTS pin-below-6 (watch)** — `pinInterests` (`antcv-sections-normalize-415`) re-asserts CANON_INTERESTS when the interests section drops below 6 rows; at ≥6 the owner's edits hold. Deleting below 6 may re-pin the canon. Not changed (it guards against cloud-restore wipes); revisit if the owner wants free deletion below 6.

## Owner live-QA batch — 2026-06-24 (run 5) — settings-ruler reset (1.50.850)

- **RELOAD-LOOP-001 (settings ruler press resets the app)** `[FIX SHIPPED 1.50.850 — owner confirm in use]` —
  owner: "pressing near the ruler of the settings sometimes makes the app reset." DIAGNOSED via code
  (ruled out the loaded sidecar reloaders: multitab-signout is cross-tab only; overlay/sections-dedupe
  reloads are behind confirm()/comments; hardrefresh-force only matches `/Hard Refresh/i` and the 4 live
  range sliders have NO button ancestor — verified live in the owner's browser). **Root cause:** the
  `AntcvAuth.subscribe` effect (`app.src.js` ~14118) calls `location.reload()` on an in-session user
  switch (ACCOUNT-ISOLATION-001), gated by a RAW `Y.email !== e.email`. A settings SPACING-slider drag
  fires a cloud-write that makes the auth layer RE-EMIT the SAME user's auth state; a trivial
  case/whitespace diff in the re-emitted email tripped the raw `!==` → spurious reload (the documented
  RELOAD-SPURIOUS-GUARD pattern). **FIX (app.src.js + app.js mirror, count-guarded):** compare NORMALISED
  emails (`String(x.email||"").trim().toLowerCase()`) at both guards, so only a GENUINE different user
  reloads; a same-user re-emit is now a no-op. **Net (sidecar `antcv-diag-probes-370.js`):** the
  `[reload-who]` attribution tracker now also records `pointerdown`/`input` (a slider DRAG was missed
  by the click-only tracker), so if any residual reset remains the next occurrence names the exact
  slider + caller stack. Worktree off origin/main; app.js boots clean (glDemo=function, 0 errors);
  node --check OK; cache-bust → 1.50.850. Owner: confirm the reset no longer happens dragging the
  spacing sliders; if it ever recurs, the console `[reload-who]` line now pins it.

## Owner live-QA batch — 2026-06-24 (run 4, cont.) — within-package alt recolor (1.50.849)

- **WITHIN-PACKAGE-STYLE-ALT-RECOLOR-001** `[SHIPPED 1.50.849]` — owner: the WITHIN-PACKAGE STYLE
  quick-alts (Default/Alt 1/Alt 2) did NOT actually change the candidate band / table-header colour.
  Root cause: `applyPackageToBody` sets `body[data-package-quick-alt="altN"]` but
  `antcv-packages-registry.css` had ZERO `data-package-quick-alt` selectors, so `--header-bg`
  (band + table headers, both `var(--header-bg)`) and `--sidebar-bg` stayed on the base value. FIX
  (CSS-only — NO island rebuild, so no contention with the parallel feat/personal-review-edit-merge
  bundle): appended 14 per-alt blocks (`body[data-package="X"][data-package-quick-alt="alt1|alt2"]`)
  setting `--header-bg`/`--sidebar-bg` to the registry alt head/sidebar pairs. The 2-attribute
  selector outranks the 1-attribute base by specificity, so the alt wins WITHOUT clobbering the base —
  critically the copenhagen base hand-edits (#33446F band, #00746E teal heads, #C9D6EC pale sidebar)
  are PRESERVED (the committed CSS is hand-tuned + `registry.json` is stale, so I APPENDED rather than
  regenerated). The generator `scripts/generate-registry-css.mjs` also gained the per-alt emission for
  future regens. Verified headless (`pwa/test/diag-package-alt-recolor.mjs`: default band stays
  #33446F; alt1→#0B74DE band + #E8F4F5 sidebar; alt2→#283556 + #DCE5EA). Cache-bust → 1.50.849.
  **STILL OPEN (deferred — needs the islands bundle, contended):** the compact/CIRCULAR swatch redesign
  of the WITHIN-PACKAGE buttons (`src/islands/PackagePicker/PackagePicker.tsx` `quickAltButtons`,
  square `Swatch` borderRadius 4→50%) + syncing the preview's quick-alt CIRCLES; and reconciling the
  stale `registry.json` copenhagen tokens with the hand-edited CSS so the generator is safe to run.

## Owner live-QA batch — 2026-06-24 (run 4) — unsolicited-gen inspection (1.50.846 → 847)

Owner inspected a live unsolicited generation and reported a batch. CONFIRMED FIXED by owner:
**TABLE-CELL-EDIT-REVERT** (focus-area cell edits now persist). Shipped this batch:

- **TOOLS-GROUP-FOLD-001** `[SHIPPED 1.50.847]` — owner: "tools group broke apart." The TOOLS & METHODS
  sidebar rendered a HEADERLESS preamble (Product&systems / Software / Optics&imaging) before an
  "Expertise" group, with a separate "Tools" group further down. Root cause: `antcv-tools-merge-dedup.js`
  `collapse()` correctly LEAVES leading rows that don't overlap the groups (genuinely unique content), so
  they float before the first {grp}. FIX (sidecar, no app.js): new loop-safe `foldLeadingIntoGroup()` pass
  folds surviving leading ungrouped rows under an existing Tools/Software/Systems/Instruments group (or
  prepends a canonical "Tools" header) → one coherent grouped structure, no headerless preamble, content
  preserved, exact-dups removed. Heals stored data on load (NO regen needed). Verified
  `diag-tools-merge-dedup.mjs` (new assertion: zero ungrouped rows before first group; existing stash
  assertions still green). Suite 463/463.
- **CL-CONTRIBUTE-INTRO-CLOSING-002** `[SHIPPED 1.50.847 — owner regen-verify]` — owner: HOW I WOULD
  CONTRIBUTE shows 4 blank "(click to add)" bullets. Root cause: the unsolicited flag `p` (app.src.js
  ~24585) went false because `io.company` drifts off the literal "Unsolicited", so the contribute neutral
  fallbacks never fired. FIX (app.src.js + app.js mirror, LOGIC ONLY — NOT the 1.50.838 prompt change that
  regressed/reverted): widened `p` to also trust `localStorage["antcv:activeAppCompany"]==="unsolicited"`.
  Makes the neutral contribute bullets + intro/closing fire on the next generation. Mirror count-guarded;
  boot-smoke + suite 463/463. Owner verifies on next unsolicited regen.
- **WORKSTYLE-DISTINCT-001** `[SHIPPED 1.50.847 — owner regen-verify]` — owner: "work style is duplicating
  the last profile section." Both ended on KPIs / evidence / trust between engineering-suppliers-management.
  FIX (prompt, app.src.js ~2970 + app.js mirror): new rule forcing work_style_content to take a DIFFERENT
  angle from the profile's people/communication CLOSE and not reuse its closing noun set. Prompt-only —
  owner verifies on regen.

### Still OPEN from this batch (diagnosed, not shipped this run)
- **GEN-STATUS-ENDS-EARLY-001** `[SHIPPED 1.50.848 — nightly 2026-06-24, owner regen-verify]` — FIX: a `window.__antcvGenRunning` in-flight flag (set at generation start ~23407, cleared at the true end ~26029 + the failure catch) makes the `Nt` lazy initializer (~14320) keep returning "generating" across the result-commit re-mount, so the purple `Ue` overlay stays up THROUGH the "🔎 Tightening to length targets…" phase and only drops when the Application Analysis appears (the editor flip at 26029). window-scoped so it survives a React re-mount but RESETS on a real page reload — it can never stick a stuck overlay across reloads (anti-brick). app.src.js + app.js mirror (3 sites, count-guarded; node --check + boot-smoke + suite 463/463 on the identical bundle). Behavioural "stays through tightening" verifies on the owner's next real generation. ORIGINAL diagnosis: — the purple generation
  overlay (`Ue`, app.src.js:12365; gate :41496 on `Nt`) dissolves the instant `sections` commit (the lazy
  `Nt` initializer :14314 downgrades "generating"→"editor" once sections exist), BEFORE the "🔎 Tightening
  to length targets…" phase — so it looks done when it isn't. Owner wants it to stay active through
  tightening until the Application Analysis panel appears. FIX: a persisted `genInFlight` flag set at
  :23401, cleared after tightening+analysis (:26015), gate the overlay on it, and stop the initializer
  downgrading mid-flight. Multi-site app.src.js + mirror (riskier — state machine); deferred to a focused
  pass. NOT a sidecar (the showcase-banner-persist sidecar governs a different element). Headless-simulable
  via the step machine.
- **RELOAD-LOOP-001 (settings ruler press resets app)** `[OPEN — instrumented, needs live capture]` — the
  SPACING & INDENTS sliders (app.src.js ~13707) fire a cloud-write burst on drag; an auth re-emit on
  cloud-write can trigger a `location.reload` (RELOAD-SPURIOUS-GUARD-001 family). The `[reload-who]`
  attribution wrapper (`antcv-diag-probes-370.js`) is already armed — owner: drag a slider until it resets,
  then read the console `[reload-who] …` line (or `AntcvDiag()`) to name the caller, and whether a 2nd tab
  was open. Not headless-reproducible.
- **WITHIN-PACKAGE STYLE redesign** `[OPEN — feature]` — make the Default/Alt1/Alt2 head/sidebar picker
  compact with CIRCULAR swatches, sync it to the preview quick-alt circles, and ensure the quick-alts
  actually change `--header-bg` (candidate band + table headers). Island/app.src UI work.
- **Merge Application Analysis + JD-analysis into one rollable menu** `[OPEN — feature/UX]`.
- **WORK-STYLE / PROFILE & sidebar-salmon** — sidebar still spills with no visible salmon bars
  (CV-SIDEBAR-SPILL-9-PAGES-001 / salmon completion, item #5 deep two-column balancing — owner-gated live).

## Nightly autonomous — 2026-06-24 (run 2) — CV ghost placeholder roles in preview (1.50.842)

Fresh nightly run. Confirmed the kickoff bucket-A export backlog is all shipped; the live 0624 owner-QA
batch is mostly regen-gated (needs a signed-in generation) or owner-gated-repro (needs live sections).
Diagnosed two deterministic candidates in parallel (ghost-placeholder preview filter + the CL-contribute
`p`-flag root cause). Shipped the SOLID, fully headless-verifiable one; deferred the contribute-`p` fix
(wide blast radius — `p` also gates profile/work_style/who/why neutral seeds — and the owner explicitly
requires per-regen verification on that item after the 1.50.840 revert; not safe to ship blind).

### CLOSED
- **CV-GHOST-PLACEHOLDER-ROLES-PREVIEW-001** `[SHIPPED 1.50.842]` — preview now drops the generator's
  `<unused slot>` placeholder roles so it matches the export, WITHOUT hiding the fresh-doc `me()`
  skeleton (keyed strictly on the `<unused slot>` bullet marker). One surgical edit in `app.src.js`
  (~5827) + mirror; covers both preview render paths (the page-2+ render delegates to the same
  `"experience"` case). Verified past the sign-in gate + negative control; suite 463/463. Detail in the
  0624 batch block below.

### DEFERRED (diagnosed, not shipped — owner-gated)
- **CL-CONTRIBUTE-INTRO-CLOSING-002** — root cause re-confirmed (the unsolicited display flag `p`,
  `app.src.js` ~24574, is false for an unsolicited app once `io.company` drifts off the literal
  `"Unsolicited"`, so the contribute branch takes the empty-skeleton path and the neutral intro/closing
  never fire). A safe-looking fix exists (OR a strict `localStorage["antcv:activeAppCompany"]==="unsolicited"`
  term into `p`), but `p` ALSO gates profile/work_style/who/why neutral seeds, the effect can't be
  verified end-to-end headlessly (it's computed inside the generation handler behind the LLM call), and
  the owner explicitly asked for per-regen verification on this item after the 1.50.840 regression revert.
  Left for an owner-attended regen rather than shipped blind. Full diagnosis (binding, branch, minified
  anchors `so.current===Ms` / `e.items&&e.items.length&&!g`) preserved in the CL-CONTRIBUTE-INTRO-CLOSING-002
  entry below.

## Nightly autonomous — 2026-06-24 — INTERESTS-LEAK-SOURCE-001 session/kernel isolation (1.50.841)

Fresh nightly run. Bucket-A export backlog (COPENHAGEN-BLUE / SECTION-RULE-INK / CL-CONTACT-ONELINE /
CL-EXPORT-EDGE-MARGINS / PREVIEW-EXPORT-PAGEBREAK / etc.) confirmed all SHIPPED in prior sessions; the
remaining OPEN items are mostly regen-gated (need a live signed-in generation). Picked the one solid,
deterministic, headless-verifiable item.

### CLOSED
- **INTERESTS-LEAK-SOURCE-001** `[SHIPPED 1.50.841]` — the real session/kernel-isolation fix the owner
  asked for: non-Gabriel personas no longer inherit Gabriel's canonical INTERESTS, and a contaminated
  section is stripped + hidden rather than refilled. Two parts — name-guard the Gabriel injectors in
  `antcv-sections-normalize-415.js` + new restore-proof sidecar `antcv-interests-persona-isolation.js`.
  Verified PAST the sign-in gate (extended `diag-owner-present-gate.mjs`, 4 real boots, zero errors) +
  unit test (9) + full suite 463/463. Detail in the PM-continuation-D block below.

## Owner session 2026-06-23 (PM5) — profile leak hard-strip + interests leak + JD-fetch bot wall (1.50.833)

Continuation of PM4 (the session 500'd mid-run; resumed from the screenshot triage). PM4 shipped the
profile leak as PROMPT-ONLY (PROFILE-NO-DISABILITY-001 / PROFILE-NO-FILLER-001, 1.50.830) — owner still
saw the disclosure persist ("why did you keep this BS in the unsolicited in profile???"), because a
prompt fix never strips prose already STORED from earlier generations. PM5 ships the restore-proof strip.

### CLOSED
- **PROFILE-CLEAN-STRIP-001** `[SHIPPED 1.50.833]` — owner: the PROFILE kept an UNSOLICITED accessibility
  disclosure + banal filler, e.g. *"Has worked with people from many backgrounds; hearing impaired, which
  has not limited his career."* The 1.50.830 prompt ban is generation-only. New restore-proof SIDECAR
  `pwa/antcv-profile-clean-strip.js` (mirrors `antcv-accessibility-comment-strip.js`): strips, from the
  STORED CV profile section (handles BOTH `content` string and the rich_block `items[].t` form left by
  `antcv-text-sections-to-rich-block-759.js`), any sentence naming a disability / hearing impairment /
  accessibility need, the "has not limited … career" 3rd-person framing, and the generic-filler claims
  (worked-with-many-backgrounds / team player / works-well-with-others). Sentence-level: salvages a clean
  leading clause where one exists, drops the offending remainder, removes an embedded filler phrase
  in-place — and NEVER blanks the field (bails if nothing meaningful would remain). CV ONLY (the comment
  is allowed in the CL). Loop-safe (same-blob bail + write-only-on-change + own-event ignore). Kill switch
  `localStorage['antcv:disable-profile-clean-strip']='1'`. Node-verified against the owner's exact string
  + 6 variants incl. idempotency. Sidecar-only — no `app.js` surgery. Cache-bust quintet → 1.50.833.
- **INTERESTS-LEAK-001** `[SHIPPED — commit b78bddf, on main]` — Gabriel's generated INTERESTS ("three
  feline strategic napping experts (cats)", "literally a team player") lingered in Anita's / Devon's
  preview because their kernels had `interests: undefined`, so the embedded default kernel filled INTERESTS
  with Gabriel's content. Fix (PM4 tail): gave Anita (Aesop's-ant ops / winter-preparedness / logistics
  planner) and Devon (career-changer full-stack dev, ex-data-analyst) their own kernel INTERESTS as
  `labeled_list` of `{t,v}`; regenerated the Downloads exports. Both persona JSONs re-added at 2-space
  (clean 23-line diff each). This was the original PM5 trigger item; confirmed landed on main this session.

### CLOSED (cont.)
- **JD-FETCH-BOT-CHALLENGE-001** `[SHIPPED + DEPLOYED — cv-proxy & demo-proxy 3.6.1-jd-bot-wall, nightly 2026-06-24]` —
  fetching a JD by URL from a bot-walled career site returned the **bot-challenge / error page** as the JD.
  Repro URL (owner):
  `https://careers.thalesgroup.com/global/en/job/TGPTGWGLOBALR03291909EXTERNALENGLOBAL/Project-Manager?utm_source=linkedin&utm_medium=phenom-feeds`
  (phenom-feeds / Thales). **Root cause (diagnosed this session):** the live URL answers a server-side
  fetch with **HTTP 403** (bot protection). The `/api/fetch-jd-url` handler (`fetch-jd-url.js`) never
  guarded on `response.status` in the main HTML path — only the eightfold JSON helper had `!resp.ok`
  (line ~579). So the 403 error-page body was extracted and returned as `ok:true, status:403`; the client
  (`app.src.js` `Wn`, bails only on `!n.ok || !o.ok`) accepted the wall page. `validateContentQuality`
  caught it only if the body was short. **Fix:** added an `if (status >= 400)` guard right after
  `const status = response.status;` in BOTH workers (they were byte-identical) — returns `ok:false`,
  `wall:true`, the upstream `status`, and a status-specific paste-manually message (403/401/451 = blocked /
  login wall; 429 = rate-limited; 404/410 = expired; else generic). Error-path only — a normal 2xx fetch
  is unchanged. Test `workers/demo-proxy/test/bot-wall-jd.test.mjs` (4: 403 no-leak + 429 + 404 +
  200-regression). This delivers the clean "X it down → paste" UX the owner asked for instead of silently
  ingesting the wall. **Deploy owed:** both `demo-proxy` and `proxy` workers (manual, owner-gated per
  CLAUDE.md) before the fix is live; WAF/UA tricks won't beat Thales' bot wall, so manual paste stays the
  intended path — this just makes the failure honest and actionable.
  **DEPLOYED (nightly 2026-06-24):** both workers bumped to `VERSION='3.6.1-jd-bot-wall'` and deployed via
  `deploy.yml` (demo-proxy run 28066010075, proxy run 28066038730, both `success`). Live `/health` on both
  reports `3.6.1-jd-bot-wall`. Live E2E against the owner's Thales repro URL now returns
  `{ok:false, wall:true, status:410, error:"…paste the job description text directly."}` instead of
  ingesting the wall/error page (the posting has since 410'd; the `status>=400` guard catches it the same
  way it catches 403). Item is fully closed.

### Handoff
- **Pagination + salmon** — owner asked for a fresh next-session prompt to "handle pagination issues
  completion and good salmon solution." Written to `docs/qa/PAGINATION_SALMON_HANDOFF_2026-06-23.md`
  (covers BOOT-FREEZE-LIVE core pagination storm, PREVIEW-EXPORT-PAGEBREAK-PARITY-001, salmon
  single-compute/one-bar-per-boundary completion, and the PB-007 per-item residual owner check).

## Owner session 2026-06-23 (eve) — generation-cycle optimization (1.50.819 → 829)

Independent pass over the generation cycle (owner brief: cut the ~7-min run, reduce "sidecars patching
sidecars" tweaking — fewer enhance/compress cycles, char limits, richer vocab, faster/better LLMs).
Diagnosis FIRST established most of the original 5-lever plan was ALREADY shipped (hard per-field char
caps in the prompt, canonical-vocab rules, the `generate_cv` rationale fields, parallel quorum-2
consensus, per-task model tiers). Four genuine gaps shipped. Reports:
`docs/perf/Generate_Cycle_and_Optimisation.md` + `docs/plan/GENERATION_OPTIMIZATION_2026-06-22.md`.

### CLOSED
- **GEN-WIDTH-001** `[SHIPPED 1.50.819]` — per-mode provider fan-out width via one `__fanWidth()` knob
  on the failover ladder (`app.src.js` ~407 + cap ~1959): quick(fast)=2, regular(balanced)=3,
  thorough=4, `__antcvQuickGen` (generate from a previous application)=3. Replaces the old fast=1
  single-provider rule. This is the owner-intent the PERF-002/003/004 entry (below) was waiting on.
- **RECRUITER-FOLD-001** `[SHIPPED 1.50.820]` — sidecar `antcv-analysis-merge-344.js`: `runMerge`
  auto-backfills the recruiter web-search into a NON-QUICK generation's rationale (lazy — only when the
  Analysis view is open); quick(fast)/`__antcvQuickGen` skip it (recruiter then only on an explicit
  Analysis-panel press). Field merges made fill-only-if-missing so the backfill never clobbers the
  analysis `generate_cv` already wrote.
- **FIT-PARALLEL-001** `[SHIPPED 1.50.821]` — the "Compress column" / "Make it fit" loop (`qi`)
  compresses eligible sections with bounded concurrency (cap 2) instead of strictly sequential. Safe:
  `ll` already self-skips sections that already fit (the `al()` over-budget gate); its commit
  `Bi(n=>n.map(...))` is a functional per-id update (concurrent writes can't clobber).
- **LLM-SCORER-001** `[SHIPPED 1.50.823]` + **LLM-SCORER-TUNE-001** `[SHIPPED 1.50.829]` — wired the
  previously-vestigial `L[task]{qW,lW,cW}` weights (keys never matched live task names; no per-provider
  score data) into a cost-quality-latency ORDERING of the candidate provider list (× a static
  per-provider base table; `danishBias` keeps Claude near top for Danish). Only reorders (never
  drops/empties), runs only on the pure-default path (forceProvider/preferGPT/routingOverride
  honoured), demotion runs after, kill switch `localStorage['antcv:disable-llm-scorer']='1'`. TUNE-001
  (owner): openai base q .95→.92 + quality-dominant weights so `generate_cl` / `enrich` / `analyze_fit`
  lead with Claude (`generate_cv` stays openai-first; cheap/mechanical unchanged). Live-verified via
  `window.__antcvLlmScoreOrder` + unit test `pwa/test/unit/llm-scorer.test.mjs`.

### ALREADY-DONE (investigated, nothing to build)
- **lever 5a (redundant post-generate analysis cycle)** — none exists: `generate_cv` emits `red_flags`
  so `runMerge` short-circuited after every generate; the panel/modal `/api/jd-analysis` calls are
  explicit presses against a user-pasted JD.

### OPEN / follow-up
- **Mechanical→cheap model routing** `[deferred, owner-gated]` — routing compress/fix_orphans to cheap
  model variants for openai/anthropic/mistral needs worker model-id verification; only gemini→2.5-pro
  (big-gen) is wired today.

### Process note
Parallel sessions edit the SAME working clone; a branch does NOT isolate `app.src.js`. 823 + 829 were
built in isolated `git worktree`s off `origin/main` while another session had uncommitted `app.src.js`
work. Use `git worktree add` for any `app.src.js`/`app.js` change.

## Owner session 2026-06-23 (PM4) — Profile/Work-style template per CV Sections Guide + Gabriel kernel load (1.50.828 → 830)

### CLOSED
- **GABRIEL-KERNEL-LOAD-001** `[SHIPPED 1.50.828, commit 93d5381]` — owner supplied `CV Sections Guide.docx`
  and asked to (1) de-hardcode the embedded PERSONALITY KERNEL **default** and (2) keep Gabriel's exact
  wording. De-hardcoded the default block (the `(()=>{try{… if(o.personality)…})()` prompt builder in
  `app.src.js`/`app.js`): Profile + Work style now **derive from the candidate material** — generic 3-part
  Profile (Who I am / Body-mind / one behaviour-based capability close as the FINAL sentence) + a two-axis
  Work style whose FINAL clause MUST be about people (never tools/data/systems/docs/process/metrics), with
  the guide's BAD/BETTER examples. Gabriel's wording preserved by a name-guard: a local `__pk` falls back to
  an inlined `__ANTCV_GABRIEL_KERNEL` (= full `skills/antcv-writer/assets/gabriel-kernel-personality-v1.json`,
  `JSON.parse(...)`) when `/\bgabriel\b/i` matches `o.name` and no `o.personality` is stored → he flows
  through the **stored-kernel path**; stored-kernel slice cap raised 4500→8000 (his kernel stringifies ~5.6k,
  4500 would truncate `render_constraints`). Every other candidate derives generically. `node --check` OK on
  both files; kernel parse + round-trip verified; name-match true(Gabriel)/false(Anita). See
  [[profile-workstyle-kernel-dehardcode]].
- **PROFILE-WORKSTYLE-TEMPLATE-001** `[SHIPPED 1.50.828]` — the full template change: main-prompt PROFILE /
  WORK STYLE rules + the two section placeholders (`me()`, both skeletons) rewritten to the guide. Length
  caps unified across kernel block + main prompt + compress pass: **Profile 45-62 words / 320-400 chars
  (hard 400)**; **Work style 22-32 words / 145-200 chars (hard 200, 1.5-2 lines, never dropped)**. Banned
  list gained: `seamless`, `bottomline`, `wore many hats`, `rolled up sleeves`, `huge professional pride`.
  Cache-bust quintet → 1.50.828 (also fixed a pre-existing `app.js?v` drift the prior session left:
  loader was pinned 825 while TARGET/seed/sw were 827 → all now 828). Supersedes the hardcoded
  **PROFILE-REWRITE-001** (1.50.648) for everyone except Gabriel (who keeps it via his kernel).
- **PROFILE-NO-FILLER-001 / PROFILE-NO-DISABILITY-001** `[SHIPPED 1.50.830]` — owner: the profile produced
  banal filler ("Has worked with people from many backgrounds;") and leaked the accessibility disclosure
  ("hearing impaired, which has not limited his career.") into PROFILE. Both are LLM-generated, not
  hardcoded, so this is prompt hardening applied where it covers every generation: the main prompt PROFILE
  bullet (runs for Gabriel's kernel path + all) and the kernel-default RENDER CONSTRAINTS. NO-FILLER-001
  bans vague generic claims (team player / works well with others / worked with many backgrounds) and
  requires people-orientation as a CONCRETE BEHAVIOUR (e.g. "aligns engineers, suppliers and management
  around one clear decision"). NO-DISABILITY-001 forbids any disability / hearing-impairment / accessibility
  mention AND the "has not limited his/their career" framing in `profile_content` — that lives only in the
  CV Accessibility row or the cover letter (aligns with ACCESS-NO-COMMENT-001). Cache-bust → 1.50.830;
  `node --check` OK. Regen-gated to verify live.

### OPEN
- **GABRIEL-KERNEL-REGEN-VERIFY** `[regen-gated]` — confirm on a real signed-in generate that Gabriel still
  gets his canonical Profile/Work-style via the kernel path, and that a non-Gabriel persona (Anita) gets the
  generic derivation. Cannot be verified headless (LLM + sign-in gated).

## Owner session 2026-06-23 (PM3) — template exports derive from the default skeleton (1.50.824 → 825)

### CLOSED
- **TEMPLATE-DERIVE-001** `[SHIPPED 1.50.824, PR #301]` — owner: the downloadable CV/CL **templates** had
  drifted from the live default builder `me()` that generation uses. The **"⬇ Export CV/CL template"**
  buttons each carried their OWN frozen `t={cv:[…],cl:[…]}` section literals — missing the main-column
  PUBLICATIONS & PATENTS (`richPub`) + RECOMMENDATIONS sections, stale section order, and a retired
  INTERESTS section. Added `window._antcvBuildTemplateSkeleton()` (injected right after the `me()` builder):
  calls `me()` and blanks every data-bearing value to a bracketed placeholder while preserving
  id/type/loc/on/richPub/role-on/order — so a downloaded template mirrors the current default skeleton and
  never leaks the signed-in user's real tools/education/certs/referees. Both buttons derive from it; future
  skeleton changes flow in automatically. Surgical `app.js` mirror (no terser round-trip — the rebuild gate
  is unpassed), boot-smoke errors=0. New test `pwa/test/template-derive.test.mjs`. Internal `Ai` tag →
  `1.50.586-template-derive`.
- **TEMPLATE-DERIVE-JSON-001** `[SHIPPED 1.50.825, PR #302]` — owner follow-up: the SECOND template pair,
  **"⬇ CV/CoverLetter Template.json"** (the round-trip JSON export beside Import CV/CL), exported
  `(ro.cv||[]).map(fl)` — the user's LIVE document, blanked by `fl`. But `fl` (`app.src.js` ~20366)
  deliberately keeps `deg`/`l`/`group` values, so the downloaded "template" **leaked real degree names +
  referee names** (RECOMMENDATIONS rows are education-type `{deg,sch}`) and reflected the user's edited
  layout, not the canonical default. Both `.json` exports now source `sections` from
  `_antcvBuildTemplateSkeleton()` (no `fl`; `fl` is now dead). minified `ro`→`xo`, `fl`→`Yl`. Regression
  test gained a static guard that both bundles' `.json` buttons are skeleton-derived with no leaky
  `.map(fl)`. boot-smoke errors=0. Style settings left as-is per owner.

### OPEN
- _(none for this batch — both template-export paths now derive from `me()`.)_

## Owner session 2026-06-23 (PM) — unsolicited shows NVIDIA (1.50.816) + CL lead-ins / methods (1.50.817)

### CLOSED
- **CL-LEADIN-KEEP-001** `[SHIPPED 1.50.817]` — owner: "keep the who i am and why this
  company/position in the lead-ins for CL subsections." Diagnosed live: the CL who/why are already
  `rich_block` with `headlineOff` + a bold lead-in `b` ("Who I am" / "Why this position"|"Why this
  company") — but the lead-in was only injected by `antcv-text-sections-to-rich-block-759.js` when
  converting FROM a `text` section. When GENERATION emits who/why directly as `rich_block`, the lead `b`
  is whatever the LLM produced (often EMPTY), and there was NO ongoing re-sync for `who` at all. Hardened
  759: for who/why rich_block rows, INJECT the canonical lead-in when `b` is empty/missing, keep the why
  position<->company flip in sync while canonical, never clobber a user-customised lead, and set
  `leadColon` so it renders "Who I am: …". Runs every load on any application (and autosaves), so it is
  not limited to the current doc. Export already renders the rich_block `b` as a bold lead-in
  (worker `renderRichBlock`). Unit-tested `pwa/test/unit/cl-leadin-keep.test.mjs` (7/7).
- **AI-TO-METHODS-RICHBLOCK-001** `[SHIPPED 1.50.817]` — owner: move the "AI-assisted: experiment setup,
  log triage, measurement analysis, protocol templating, documentation retrieval, prompt/evaluation
  workflows" row into the Methods group; "appended not only for the current application." Diagnosed live:
  TOOLS & METHODS migrated to `rich_block` (group markers `{grp:true,t:…}` + rows `{b,t}`), but the
  `antcv-ai-assisted-to-methods.js` sidecar only handled the old `labeled_list` shape, so the floating
  `{b:"AI-assisted"}` row (sitting above the first group) was never moved. Extended the sidecar with a
  rich_block relocate: move the AI-assisted row to the END of the `{grp:"Methods"}` group; idempotent;
  legacy labeled_list path kept. Generation prompt already instructs this (me() ~2751). Verified live
  against the owner's real data (AI-assisted moved under Methods), unit-tested
  `pwa/test/unit/ai-to-methods-richblock.test.mjs` (6/6). Runs every load on any application.

### CLOSED
- **UNSOLICITED-SHOWS-NVIDIA-001** `[SHIPPED 1.50.816]` — owner: an UNSOLICITED application still
  showed "NVIDIA" (the company from a prior JD-targeted batch). **Root cause CONFIRMED via signed-in
  live repro** (Claude-in-Chrome on the owner's profile): the **kernel showcase cloud slot**
  (`/api/kernel-showcase`) stored a targeted `meta` (company:"NVIDIA", role:"Test Engineer - Photonic")
  from the earlier gen. The kernel-restore on boot (`app.src.js:15760-15859`) bails ONLY when the LOCAL
  `meta.company` is already a real company (15777-15783); on a genuinely-unsolicited load (local company
  "Unsolicited") it proceeds and re-applies the slot's NVIDIA meta (15842-15844). A pure local reset
  could NOT stick — the slot re-injected it every boot (proven). FIX: new sidecar
  `antcv-unsolicited-identity-guard.js` — when the context is unsolicited (`antcv:lastJdText` < 30 chars)
  but `meta.company` is a real company, force `meta.company → "Unsolicited"`, `meta.role → "Open
  Application"`, scrub `antcv:activeAppCompany`, drop `rationale` (keep subtitle + greeting/opening). It
  writes `meta` + dispatches the candidate-editor's `StorageEvent`, so the app pulls the cleaned identity
  into React state and the existing kernel autosave RE-PERSISTS the cleaned slot to the cloud — the slot
  self-heals after one load. Loop-safe / edit-safe / disable via
  `antcv:disable-unsolicited-identity-guard`. Unit-tested (`pwa/test/unit/unsolicited-identity-guard.test.mjs`,
  7/7); boot-smoke OK; cache-bust quintet 815 → 816. Full writeup:
  `docs/qa/SESSION_LOG_2026-06-23.md` ("BUG REPORT — UNSOLICITED-SHOWS-NVIDIA-001").

### OPEN
- **UNSOLICITED-IDENTITY-SOURCE-FIX-001** `[SHIPPED 1.50.819 — gen-branch verify still open]` — the
  source-of-truth fix in `app.src.js` (+ app.js mirror) IS DONE: inline `__antcvUnsolicitedMeta` sanitize
  at the kernel-showcase RESTORE site (force Unsolicited/Open Application + skip the contaminated slot's
  JD rationale) and BOTH putShowcase PERSIST sites (never STORE a real company). 3 sites per bundle, test
  `unsolicited-identity-source-fix.test.mjs` (7), commit 608525a. The 816 sidecar (verified healing meta
  live this session) + the gen prompt's `__neutralCo` are the other two layers. STILL OPEN (owner-gated):
  verify the gen BRANCH output on a real signed-in regen names no company end-to-end.
- **BOOT-FREEZE-LIVE-2026-06-23** `[PARTIAL — two named offenders coalesced 1.50.818; core pagination OPEN]` —
  the owner's live tab went unresponsive on boot of the big NVIDIA doc: rAF storm + `antcv-splitter-flip.js
  setInterval took 4798ms` + `antcv-sidebar-position.js 255ms`. The two NAMED polling offenders are now
  fixed: `antcv-splitter-flip.js` + `antcv-sidebar-position.js` MutationObserver
  callbacks + polls are COALESCED (trailing debounce 200ms/1000ms cap) and sidebar-position dropped attribute
  observation (1.50.818, test `boot-storm-sidecar-coalesce.test.mjs`). The CORE pagination/sections-updated
  storm (the bulk, ~app.src.js) is STILL OPEN ([[boot-storm-gate-freeze]] / partial damper 1.50.772) — needs a
  real lazy/worker pagination refactor. Diagnose via `pwa/test/diag-boot-storm.mjs`. Highest remaining
  systemic perf issue.

## Owner session 2026-06-23 (PM continuation D) — profile disclosure + interests leak + fetch (1.50.834)

### CLOSED
- **PROFILE-NO-DISABILITY-STRIP-001** `[SHIPPED 1.50.834]` — owner (angry, repeated): the unsolicited CV
  PROFILE kept the line "Has worked with people from many backgrounds; hearing impaired, which has not
  limited his career." The prompt ALREADY bans this (PROFILE-NO-DISABILITY-001 + PROFILE-NO-FILLER-001,
  app.src.js ~2967) but the LLM emitted it anyway. Deterministic floor: new sidecar
  `antcv-profile-disclosure-strip.js` strips disability/hearing-impairment disclosure, the
  "...has not limited his career" framing, and the "people from many backgrounds" filler from the CV
  PROFILE prose (rich_block items[].t + legacy content), clause-level so good content survives. Scoped to
  the CV profile ONLY — the Accessibility row + cover letter are untouched (disclosure is allowed there).
  Cleans the current doc on load + every future gen. Test `profile-disclosure-strip.test.mjs` (7).
- **PERSONA-INTERESTS-MISSING-001** `[SHIPPED]` (commit b78bddf) — Gabriel's generated interests
  ("…three feline strategic napping experts (cats)") leaked into Anita's session because Anita's kernel
  (and Devon's) had no `interests`. Added persona-appropriate `interests` ({l,v}) to both
  `docs/personas/{anita,devon}/personalInfo.json`; regenerated their Downloads kernel exports.

### OPEN / registered
- **PROFILE-DISABILITY-PROMPT-ADHERENCE-001** `[OPEN — gen quality]` — the LLM violates the existing
  PROFILE-NO-DISABILITY-001 / PROFILE-NO-FILLER-001 rules; the 834 strip is the deterministic safety net.
  Root prompt-adherence issue remains (consider moving these to a post-gen validator / regenerate-on-violation).
- **INTERESTS-LEAK-SOURCE-001** `[SHIPPED 1.50.841 — nightly 2026-06-24]` — a persona whose kernel lacks
  `interests` inherited Gabriel's generated/default INTERESTS in-session (not just the repo default).
  **Root cause (diagnosed):** the two INTERESTS injectors in `antcv-sections-normalize-415.js`
  (`pinInterests`'s `CANON_INTERESTS` + `scrubJuniorRugby`'s canonical rugby row) embed Gabriel's LITERAL
  hobbies (cats / "literally a team player" / tai-chi) and were gated only on `ownerPresent()` — which is
  true for ANY persona with a name/experience, so loading Anita/Devon force-filled their short/absent
  INTERESTS with HIS canon. **Two-part deterministic fix (no app.js surgery):** (1) name-guarded both
  injectors to Gabriel (`gabrielPresent()` = `/\bgabriel\b/i` on `personalInfo.name`) so a non-Gabriel /
  fresh / deleted persona is never injected — Gabriel's stale-flip protection preserved. (2) new
  restore-proof sidecar `antcv-interests-persona-isolation.js` (precedent: `antcv-profile-disclosure-strip.js`):
  for a non-Gabriel persona, when a distinctive marker (three feline / strategic napping / literally a team
  player) proves the section leaked from his canon, strips the byte-identical canon rows (shape-agnostic
  {b,t}/{l,v}); if emptied, hides the section (`on:false`) — never refills with Gabriel content, so the
  empty-interests fallback is never Gabriel-specific. Kill switch `antcv:disable-interests-persona-isolation`.
  Unit test `interests-persona-isolation.test.mjs` (9). **Verified PAST the sign-in gate** — extended
  `diag-owner-present-gate.mjs`: Gabriel still pins his 6 canon; fresh + named-Anita get none; an Anita
  section pre-loaded with the full leaked canon is stripped to 0 + hidden; zero app errors across 4 real
  boots. Full suite 463/463. NOTE: the generic `placeRecs` "Danish and international recommenders on
  request" line is a non-personal placeholder (left untouched, out of scope).
- **JD-FETCH-BOT-WALL-THALES-001** `[OPEN — likely in progress in demo-proxy]` — JD fetch fails for the
  Thales careers URL (phenom/Workday-style bot wall throws a questions/consent popup that must be X'd
  down): `https://careers.thalesgroup.com/global/en/job/TGPTGWGLOBALR0329190EXTERNALENGLOBAL/Project-Manager`
  The parallel session appears to be adding `workers/demo-proxy/test/bot-wall-jd.test.mjs` — coordinate /
  confirm coverage for this host (phenom-feeds career sites). Pattern: detect the bot-wall interstitial,
  fall back to the position API or surface a dismissible notice.

## Owner session 2026-06-23 (PM continuation C) — Coord. ban + CV regen review (1.50.831)

### CLOSED
- **BANNED-SHORTENING-COORD-001** `[SHIPPED 1.50.831]` — owner: "do not use the shortening 'Coord.'; if
  Coordination/Coordinating/Coordinate/Coordinated/Coordinates is in use display it fully." Root cause:
  `antcv-core-comp-compress.js` abbreviated `Coordination → Coord.` in CORE COMPETENCIES / WHAT I BRING
  focus labels. This ALSO caused the edit-revert below (the owner expanded "Coord." → the full word and the
  sidecar re-shortened it on the next sections-updated). Fix: removed the abbreviation + added an EXPAND
  that restores any "Coord"/"Coord." → "Coordination" (whole-token; never touches Coordinator /
  Coordinate(d/s) / Coordination). Test `core-comp-compress-coord.test.mjs` (8).

### OPEN / diagnosed
- **TABLE-CELL-EDIT-REVERT** `[PARTIAL — Coord. cause fixed 831; residual CONFIRMED owner-gated (live demo) — nightly 2026-06-24]` — owner:
  editing focus-area cells in CV/CL reverts after a few seconds (scroll), not saved on refresh/export.
  CONFIRMED cause for "Coord." = the abbreviator (fixed). A data-layer repro (writing edits straight into
  `localStorage.sections` + dispatching sections-updated) showed NON-Coord focus edits ("Technical-
  Commercial"→"Techno-commercial") and expertise edits PERSIST — the table sidecars (partitioner/dedup)
  no-op when disjoint, so they don't clobber. If non-Coord edits STILL revert after 831, the cause is the
  editor-panel (`d({rows})`, app.src.js:7918) → React `ro` → autosave → cloud-restore sync path
  (app-level), needing a live demo of the actual panel-edit flow to pin.
  **NIGHTLY 2026-06-24 — residual is NOT headless-reproducible (confirmed via a written diag, then removed):**
  the synthetic headless editor boot renders only ~5 global control inputs — the per-section CORE
  COMPETENCIES table editor panel is NOT in the DOM (no `core_comp` cell inputs, no "CORE COMPETENCIES"
  editor label, 0 textareas), so the panel-edit `onChange→d({rows})` flow can't be driven headlessly; and
  the suspected residual clobber (cloud-restore sync) can't fire without a real cloud. So the deterministic
  part is DONE (Coord.) and the residual genuinely needs an OWNER live signed-in demo: edit a non-Coord
  focus-area cell, scroll/wait, and report whether it reverts (with the network tab showing a cloud-restore
  GET overwriting the autosave). Until that repro, no further code is safe to write here.
- **CV-UNSOLICITED-ALL-ROLES-001** `[PROMPT-HARDENED 1.50.846 — owner regen-verify owed — nightly 2026-06-24]` —
  in the 2026-06-23 unsolicited regen, 4 roles came back `on:false` (Security Guard, IDF Computer Systems
  Administrator, Pan Idræt foreningsarbejde, Students Council). EXPERIENCE-TAILOR-001's trailing "for the
  UNSOLICITED kernel keep FULL breadth (do NOT prune)" was too weak (buried at the end of the targeted-PRUNE
  sentence), so the LLM pruned anyway. **FIX (1.50.846, prompt-only, app.src.js ~2926 + app.js mirror):**
  hardened EXPERIENCE-TAILOR-001 with an explicit emphatic standalone directive — **UNSOLICITED-ALL-ROLES-001:
  "when there is NO job description … you MUST emit EVERY role with on:true — hide NONE, drop NONE, merge NONE …
  INCLUDING junior, volunteer/foreningsarbejde (Copenhagen Wolves / Pan Idraet), security-guard, students-council,
  teaching-assistant and early IT/systems-administration roles … breadth IS the point of an unsolicited CV"** —
  and pins the relevance-based hide/consolidate rules to JD-present only. Deterministic un-hide sidecar STILL
  deferred (a render-time force-on:true would clobber the owner's manual 👁 hides — can't distinguish LLM-prune
  from owner-hide). **Owner: regenerate the unsolicited CV and confirm all roles appear** (prompt-only changes
  are not headless-verifiable; boot-smoke + suite 463/463 green, app.js mirror count-guarded + integrity intact).
  NOTE: prior prompt-insert regression precedent (838→840) — if this regresses anything, revert is the single
  app.js mirror block + the app.src.js string tail.
- **CV-MERGE-TITLE-ORDER-001** `[OPEN — regen/prompt]` — merged role title "Electro-Optics Team Leader /
  R&D Electro-Optics Engineer" should be "R&D Electro-Optics Engineer / Team Leader" (rule: CONTENT/
  specialist function FIRST, level/seniority AFTER; don't repeat the domain word). That role is also
  MISSING a result (lamination found no kernel-role outcome match for Meprolight).
- **CV-MERGE-BULLET-RESULT-UNION-001** `[OPEN — regen/prompt]` — the Research Assistant / Teaching
  Assistant merge took only ONE bullet from teaching (no research bullets) and only ONE result from
  research (no teaching result). A merged role MUST union ALL bullets AND ALL results from BOTH source
  roles. Same guard needed for every merged role.
- **CV-UNSOLICITED-PUBS-FULL-001** `[OPEN — verify/regen]` — Publications & Patents must show in FULL for
  an unsolicited application (current regen shows 4 — confirm none trimmed vs the kernel's full list).
- **KERNEL-PROPAGATE-ANITA-DEVON-001** `[OPEN]` — propagate the Gabriel-kernel structural changes
  (GABRIEL-KERNEL-LOAD-001 / PROFILE-WORKSTYLE-TEMPLATE-001, 828) into `docs/personas/anita/personalInfo.json`
  + `docs/personas/devon/personalInfo.json` (persona-appropriate, not a copy), then regenerate JSON exports
  for all 3 personas.

## Owner session 2026-06-23 (PM continuation B) — work_style / tables / GEN-SPEED test (1.50.819→827)

### CLOSED
- **WORKSTYLE-LEADIN-001** `[SHIPPED 1.50.822]` — owner: "the line lead-in of work style in the CV is
  empty; by default it needs the words Work style." Same bug class as CL-LEADIN-KEEP-001: when generation
  emits the CV `work_style` section directly as a `rich_block`, the 759 text->rich_block branch never
  runs and step-2 lead-in maintenance only covered who/why, so `work_style` shipped with empty lead `b`.
  Generalized `antcv-text-sections-to-rich-block-759.js` step-2 (`isLeadInId` + `WORKSTYLE_CANON`) to
  default work_style's lead to "Work style" + leadColon when empty/canonical, never clobbering a manual
  edit. Test `cl-leadin-keep.test.mjs` (+3 → 10).
- **TABLES-PARTITION-001** `[SHIPPED 1.50.826 wired, .827 polish]` — owner: "the tables are still very
  close in content and wording; why do all your controls keep failing — the table source should generate
  7-8 seeds, diagnosed separate, then split between the tables." ROOT CAUSE (3 reasons, all confirmed):
  (1) the LLM emits only ~4 distinct Focus Areas and reuses 3 in both tables (live union was 4) — the
  pool is too small to split into two disjoint 3-4 tables; TABLE-DIRECTION-001 prompt (which already asks
  for the 7-8 enumerate+split) is IGNORED. (2) the drop-only `antcv-tables-core-dedup.js` floor BAILS
  (`keep.length<2` guard) exactly in the severe-overlap case (3/4 dupes → drop leaves 1 → no-op) and can
  only drop, never swap. (3) that floor requires `bring`+`core_comp` in the SAME doc list, but core_comp
  is in the CV and bring in the CL — so it never even compares them cross-document. FIX: new sidecar
  `antcv-tables-partition.js` — scans BOTH docs, ENLARGES the pool from the kernel `tools`
  Expertise/Methods groups (7 real Focus-Area/expertise pairs), and force-partitions: BRING wins shared
  areas (untouched), CORE drops shared + keeps its distinct rows + fills to a 3-4 target from the pool
  (compact ≤60ch, ", " spacing). Idempotent, no-op when already disjoint, disable
  `antcv:disable-tables-partition`. Test `tables-partition.test.mjs` (8). LIVE-VERIFIED via the deployed
  pure `_partition` on the original overlap: CORE = [Validation & Compliance (kept), Optics/photonics &
  sensing, Imaging, Materials & devices], zero overlap with BRING.
- **GEN-SPEED-001 test re-aligned** `[FIXED — main green]` — `perf-mechanical-trim.test.mjs` asserted the
  removed `"fast" === __genSpeed() && l.length > 1` (fast=1) string and modelled fast=1 /
  balanced-quality=4. GEN-WIDTH-001 (819) superseded that with `__fanWidth` (fast=2/balanced=3/thorough=4).
  Verified the shipped behavior is correct FIRST, then updated the test: assert the `__fanWidth` wiring,
  add the fan-width layer to the mirrored `cap()` predicate, fix expectations (fast=2, balanced quality=3).
- **leadColon render (item #3, owner-glance)** `[VERIFIED live in preview]` — CL who/why render
  "Who I am:" / "Why this company:" with the bold lead-in + colon. PDF parity unverified (needs an export).

### OPEN (carried)
- **UNSOLICITED gen-branch + #4 content** `[needs owner regen]` — unsolicited gen output names no company
  end-to-end; WHAT I BRING distinct rows / FOUNDATION fields / numeric Results — all need a real signed-in
  regen to confirm.
- **TABLES-PARTITION live-on-doc** `[owner-glance]` — verify on the owner's next OVERLAPPING doc (the live
  doc this session was already disjoint, so the partitioner correctly no-op'd).

## NIGHTLY FEATURE REQUESTS (owner 2026-06-19)

- **SIGNIN-GATE-HARDREFRESH-001** `[OPEN — REGRESSION, nightly to diagnose]` — owner
  2026-06-19: "I get a sign-in [gate] that does NOT complete on every hard refresh. I need
  to refresh the browser AGAIN to get good output for PDF. I think it is a regression."
  REPRO: hard-refresh (the in-app ↻) → a sign-in / "Loading…" gate appears and hangs (does
  not lift to the editor) → a manual BROWSER reload is needed → only THEN is the PDF export
  good (first export after the hung gate is from a half-loaded state). SUSPECTS to bisect:
  (1) `antcv-login-loading-gate.js` cover timing — `editorReady()` waits for
  `.antcv-preview-paper`, MIN_MS 3200 / MAX_MS 9000; the cover may lift before sections
  fully restore, or the sign-in (`antcv:auth:token`) re-validation hangs the gate. (2) The
  cold-load → PDF-export race: the export (antcv-docx-client.js applyOutcomesMode) runs
  before the cloud-restore finishes hydrating sections, so the FIRST export is stale.
  (3) RECENT app.js changes this run (CLAMP-GUARD 728 / META-DRIFT-GUARD 731 / AUTO-COMMIT
  732) touch the cloud-restore + active-app flow — bisect against 1.50.727 (pre-728) to
  confirm/deny a regression there. (4) The ~20 SW CACHE bumps this session mean every
  hard-refresh re-activated the SW (skipWaiting + clients.claim) — a SW re-activation race
  could leave the first post-refresh load serving a mixed asset set. NIGHTLY: reproduce on
  antcv.pages.dev (owner signed in), capture the gate-hang console (login-loading-gate logs
  + auth), and either fix the cover-lift/sign-in completion or gate the PDF export on a
  "sections restored" signal so the FIRST export is correct without a second refresh.
  **UPDATE 2026-06-23 (BOOT-CJLR-PERF-001, 1.50.835):** measured-attribution pass corrected
  the standing assumption. The autoPages MEASURER is NOT the bulk — `diag-measurer-attribution.mjs`
  (measurer ON vs OFF via the new `antcv:disable-autopagebreak` kill switch) shows it is only
  ~1% (~173ms) of boot blocking. A CPU profile (`diag-boot-cpu-profile.mjs`) found the single
  biggest contributor was `antcv-profile-workstyle-cjlr-238.js` at ~5951ms / 37%: `panelRows()`
  scanned EVERY button, climbed 7 ancestors each, and called `clean(ancestor.textContent)` at
  each level — serializing the whole-document text + running `/\s+/g` once PER button (buttons
  share ancestors ⇒ the giant panel node re-serialized dozens of times per run). FIX (sidecar
  only, behaviour-preserving, verified `diag-cjlr-placement.mjs` 9/9): a per-run element→text
  memo (collapses shared serializations to one) + a length cap that stops the climb at the first
  ancestor too big to be a control row. Measured: that file's CPU self-time 5951→1646ms (−72%);
  total boot blocking on the synthetic owner-scale doc 14.9s→13.5s avg (−1.4s; larger on the real
  6-page doc since the cost scales with DOM size); longest single block 1461→892ms. REMAINING:
  the rest of the freeze is a long TAIL of sidecars (language-ui-429, what-i-bring-header-cjlr-249,
  watermark-page-anchor-341, core-wib-strict-row-layout-274 …) sharing the same MutationObserver
  (subtree+attributes) + ancestor-textContent antipattern, woken repeatedly by the boot mutation
  storm — same memo/scope fix applies per file, each needing its own verification.

- **SALMON-NPAGE-LIMIT-MISMATCH-001** `[SHIPPED 1.50.836 — 2026-06-23]` — the FORCE-preview
  sidebar pass (`antcv-auto-pagebreak-block-001.js`) computed its SEED break at the tightened
  PDF-equivalent line (`limit / SIDEBAR_PREVIEW_INFLATE`) but ran the N-page greedy walk
  (`allOverflowPages`) at the FULL `limit`. The two disagreed and emitted DUPLICATE page-2 entries
  in the PREVIEW map for one section (e.g. `autoPagesPreview = {"regctx":{"11":2,"12":2}}`) — a
  duplicate-salmon source. FIX: capture the effective fill line once (`__effLimit`, tightened on
  the force-preview pass) and use it for the seed, the SNAP_GAP gap measure, AND the greedy walk,
  so every preview sidebar page boundary tracks the same line. PREVIEW MAP ONLY — for the export
  pass `autoKey !== PREVIEW_KEY` ⇒ `__effLimit === limit`, byte-identical to the old code (the
  DOCX sidebar break safety rule holds; HEAD failed the export-coupling diag identically, proving
  the change is export-neutral). Verified `diag-sidebar-salmon-push.mjs` (now locks the no-duplicate
  invariant; the old `onGroup` assertion was stale post-SNAP-GAP-001), the 4 other salmon diags,
  369/369 units, boot-smoke. NOTE: `diag-sidebar-preview-break.mjs` check (B) ("export unchanged
  by the preview factor") is PRE-EXISTINGLY red on HEAD — the export pass measures the live DOM
  the PREVIEW pagination already reshaped, so the preview factor influences the export map THROUGH
  shared render state. That export↔preview DOM coupling is a separate, deeper architectural item
  (the "two break maps entangled" concern) — NOT addressed here; would need decoupling the export
  measurement from the preview-paginated DOM, high-risk, owner-gated. RENDER effect of the cleaner
  single break needs owner eyes on a real multi-page sidebar (big-doc live verify is freeze-gated).

- **UNSOLICITED-NOT-TARGETED-001** `[SHIPPED 1.50.837 — 2026-06-23]` — owner QA on a real
  UNSOLICITED CV (`CV_..._Unsolicited_Product_Project_Expert_20260623.pdf`): the export MERGED
  same-company roles into one ugly triple-title (`Change Request Lead / Change Request Lead &
  System Architect / System Architect | Innoviz`), HID Publications & Patents, and HID the
  low-signal roles (dormitory security guard, Copenhagen Wolves ops, student council) — while the
  PREVIEW correctly showed them separate + full breadth (preview≠export). Owner rule: "Unsolicited
  keeps the full breadth." ROOT CAUSE: `_isTargetedExport()` (antcv-docx-client.js) only
  short-circuited `co !== 'unsolicited'`, so an explicit `meta.company === 'unsolicited'` FELL
  THROUGH to the "stable fallback" heuristics, where a STICKY `experience.__antcvMerged` flag (or a
  stale `antcv:activeAppCompany`) left by a PRIOR targeted session forced `true`. So every
  unsolicited export was treated as targeted. FIX: an EXPLICIT `unsolicited` marker (meta.company
  OR activeAppCompany) is authoritative => returns FALSE, overriding the sticky flag; any OTHER
  explicit company => targeted; the `__antcvMerged` drift-fallback now only applies when
  meta.company is EMPTY. Fixes the merge (Issue E) + the Publications/role hides (Issue D) for
  unsolicited; preview and export now agree on full breadth. Verified `unsolicited-not-targeted.test.mjs`
  (4 cases incl. a real-company no-regression case) + 373/373 units + boot-smoke. NEEDS a fresh
  unsolicited export to confirm visually. SEPARATE residual issues from the same QA batch, NOT
  fixed here (generation/data quality — regen-gated, owner signed-in): (B) some standalone roles'
  `Results:` restate a bullet (the merged-Innoviz repeat was a CONSEQUENCE of the merge and is gone);
  (C) a Results line reads incomplete (`Benchmark imprinted against non-imprinted devices`) — the
  GENERATED outcome itself is short (~48 chars, well under the 260-char lamination cap), not a
  render cut; (A) HOW I WOULD CONTRIBUTE shows no intro/closing — the section supports both keys,
  so it needs the owner to confirm whether the intro/closing FIELDS hold content (=> render bug to
  fix) or are empty (=> generation/prompt gap, like the who/why lead-in fallback in
  [[cl-leadins-and-methods-richblock]]). Some missing roles may also be a KERNEL DATA GAP
  (ROLE-DECOMP-001 note) — if absent from the stored sections, the un-hide cannot recover them.

- **CL-CONTRIBUTE-INTRO-CLOSING-001** `[SHIPPED 1.50.838 — 2026-06-24, regen-gated]` — owner QA
  (Issue A of the unsolicited batch): HOW I WOULD CONTRIBUTE rendered as bullets only — no opening
  (intro) and no closing line. Owner confirmed both are EMPTY/not-generated (they are the markerless
  opening/closing ROWS of the rich_block — `antcv-hwic-to-rich-block-760.js` maps
  contribute_intro→row{b:'',t} and contribute_closing→row{b:'',t}, both rendered without a bullet
  marker). The data model, converter, and client mapping (`app.src.js` ~25185:
  `intro: a(F.contribute_intro) || a(e.intro) || n.contribute_intro || ""`) all support them — the
  gap is GENERATION. The full prompt (`k`) DID mandate contribute_intro/closing, but the intro
  template was JD-gap-framed ("My immediate priority would be to close the gap in [gap]…"), which an
  UNSOLICITED run (no JD, no gap) leaves empty; and the neutral fallback `n.contribute_intro` only
  applies when the unsolicited flag `p` is true. FIX: made the full generation prompt
  UNSOLICITED-AWARE — for a no-JD run, contribute_intro must use a general first-priorities lead-in
  ("If a role fits, my first priorities would typically be:") instead of a JD gap, contribute_closing
  names general value rather than a specific [Company], and BOTH are explicitly REQUIRED/non-empty in
  EVERY run. Prompt-STRING edit only (no logic), mirrored byte-for-byte into `app.js` (verified single
  occurrence each, boot-smoke OK). REGEN-GATED: takes effect on the next generation; needs owner to
  regenerate (signed in) and confirm the opening + closing rows now populate. The per-section regen
  path (`workers/*/src/prompt-augment.js` cl_how_i_would_contribute) still requests bullets + optional
  closing only (no intro) — left for a follow-up since its text→{intro,items,closing} mapping is
  unconfirmed; the full-doc path is the owner's reported case and is fixed.

- **CONTRIBUTE-MARKERS-MID-BULLETS-001** `[SHIPPED 1.50.839 — 2026-06-24]` — owner QA: HOW I WOULD
  CONTRIBUTE showed "markers on mid-bullets" (only the middle bullets had bullet markers; the first
  and last looked markerless). ROOT CAUSE: `antcv-hwic-to-rich-block-760.js` identified the
  intro/closing rows by POSITION — both the text_bullets→rich_block peel (items.shift()/pop()) AND
  the already-converted "repair" branch stripped the marker off WHATEVER sat first/last, assuming
  they were always the markerless intro/closing. For a plain generated bullet list (no intro/closing
  — the common case when generation omits them) that demoted the FIRST and LAST real bullets to
  markerless paragraphs. FIX: identify intro/closing by CONTENT — a genuine intro is the first row
  ending with ":" (a lead-in; a real contribution bullet never ends with a colon), and a genuine
  closing is the last row ONLY when such a lead-in intro exists. Every other row keeps/regains its
  marker. The repair branch now re-markers wrongly-stripped first/last bullets too, so it HEALS the
  owner's already-converted section on the next load (no regen needed). Verified
  `contribute-peel-fix.test.mjs` (5 cases). NOTE: this fixes the MARKERS only — the intro/closing
  TEXT is still empty (see CL-CONTRIBUTE-INTRO-CLOSING-001 below).

- **CL-CONTRIBUTE-INTRO-CLOSING-002** `[OPEN — two layers: prompt now loaded; persistence revert]` —
  Issue A of the 0624 batch: HOW I WOULD CONTRIBUTE opening + closing are empty. LIVE INSPECTION
  2026-06-24 (Claude-in-Chrome on antcv.pages.dev, owner signed in, after the hard-refresh):
  • `app.js?v=1.50.838` IS now loaded (window.ANTCV_VERSION 1.50.839, hwic760 1.50.839-peel-fix) —
    so the 1.50.838 unsolicited-aware contribute_intro/closing prompt fix IS live now. The 0624
    regen that still showed empty was on a STALE pre-1.50.838 bundle (confirmed root cause of why
    that fix "didn't work"). A FRESH regen now should populate them — owner to confirm.
  • SECOND LAYER (persistence): the stored `sections.cl` contribute section is the KERNEL SKELETON,
    not the generated content — `type:rich_block, items:["", "[Specific thing you would do 1]",
    "[Specific thing you would do 2]", "[Specific thing you would do 3]", ""]` (placeholders + two
    EMPTY intro/closing rows). The whole CV experience was also empty (0 roles) in localStorage while
    the exported PDF had 11 roles. So the GENERATED cover-letter/CV content lives only in React state
    and is NOT persisted to localStorage `sections` — on reload it reverts to the unsolicited kernel
    skeleton (same family as [[targeted-app-persistence]] / [[kernel-recovery-and-floor]]). This
    means even a good regen's intro/closing will VANISH on refresh until the generated CL is
    committed to the active row. NEXT: (1) owner regenerates NOW (1.50.838 live) and confirms the
    opening/closing appear immediately post-regen; (2) investigate why generated CL contribute (and
    the experience roles) are not persisted to `sections` on the unsolicited row — the AUTO-COMMIT
    path ([[targeted-app-persistence]] 1.50.732) covers targeted apps; the unsolicited kernel row may
    not persist a regen. CONTRIBUTE-MARKERS-MID-BULLETS-001 (1.50.839) fixes the markers regardless.
  • NOTE: in the skeleton, the empty intro/closing rows are now markered (760 markers a row that is
    empty / not a ":"-lead-in) — harmless placeholders; real generated content with a ":"-lead-in
    intro renders correctly markerless.
  • UPDATE 2026-06-24 (REGRESSION FOUND + REVERTED, 1.50.840): the owner's NEXT regen (on the live
    1.50.838 bundle) produced a COMPLETELY EMPTY contribute — live `sections.cl.contribute` = 4 EMPTY
    rows (rich_block, all mk:true → "(click to add)" in preview, blank in export), while the CV
    experience populated fine (15 roles). So generation returned EMPTY `contribute_items`. The ONLY
    contribute-related change between the WORKING run (4 real JD-relevant bullets, on the stale
    pre-1.50.838 bundle) and this BROKEN run was the 1.50.838 unsolicited-aware prompt INSERTION — it
    regressed contribute generation (the verbose insertion right before the `contribute_items`
    instruction likely disrupted the LLM's contribute output). REVERTED the insertion from app.src.js
    + app.js (1.50.840, boot-smoke OK) → restores the known-good 4-bullets behaviour. The intro/closing
    fix must be redone by the nightly WITH per-regen verification, not blind. LIKELY REAL ROOT CAUSE
    (for the nightly): the unsolicited display flag `p` (app.src.js ~25051 `const n = p ? {...} : {}`)
    is FALSE for this unsolicited app even though meta.company === "Unsolicited" — so the contribute
    mapping (~25171) takes the `e.items && !p` branch (empty skeleton items) and `n = {}` (no neutral
    contribute_intro/items/closing). Fixing `p`'s unsolicited detection would make the neutral
    fallbacks fire (3 neutral bullets + the neutral intro/closing) WITHOUT any prompt change — the
    same unsolicited-detection family as UNSOLICITED-NOT-TARGETED-001. Find `p`'s binding in the
    showcase/render function and align it with the explicit `meta.company`/`activeAppCompany` ===
    "Unsolicited" marker.

- **CV-SIDEBAR-SPILL-9-PAGES-001** `[OPEN — pre-existing, NOT a regression; salmon/pagination]` —
  owner QA 0624: "the salmon break location is incorrect, and we got 9 pages CV". CONFIRMED the
  EXPORT CV is 9 pages (`/Type/Page` count = 9). IMPORTANT: this is PRE-EXISTING, NOT caused by the
  un-merge (UNSOLICITED-NOT-TARGETED-001) — yesterday's MERGED 5-role CV (0623) was ALSO 9 pages
  (verified). Diagnosis: per-page density is 43/72/7/58/1/4/1/0 non-blank lines — pages 3,5,6,7,8 are
  near-empty. The SIDEBAR column (tools, certs, education, regulatory[many groups], publications,
  languages, interests, recommendations) is far LONGER than the MAIN column (experience), so after
  the main ends (~p4) the sidebar continues ALONE onto pages 5-8 with the main column empty beside
  it — and a trailing blank page 8. This is a docx-worker per-page two-column BALANCING problem (the
  SIDEBAR_NPAGE/SIDEBAR_UNIFIED engine paginates the long sidebar into its own pages instead of
  flowing/balancing against the short main). NOT the preview-only SALMON-NPAGE-LIMIT-MISMATCH-001
  change (export map untouched there). FIX IS DEEP (worker + measurer column balancing) and needs the
  owner's real sections data to reproduce + live verification — develop against a long-sidebar diag
  (extend `diag-sidebar-preview-break.mjs` / the docx-worker `diag-twocol-paged.mjs`). Owner-gated.

- **CV-GHOST-PLACEHOLDER-ROLES-PREVIEW-001** `[SHIPPED 1.50.842 — nightly 2026-06-24]` — owner QA 0624
  ("1 ghost position generate, see picture"): the PREVIEW shows empty `[Role title], [Company]
  [Years]` rows in PROFESSIONAL EXPERIENCE (between real roles). These are the generator's
  "unused slot" placeholders (`experience_roles` r7-r10 = `{"id":"r7",…,"bullets":["<unused slot>"]}`
  per the gen schema). The EXPORT correctly skips them (no header emitted for an empty role), but the
  PREVIEW rendered them as ghost rows. **Root cause confirmed:** the preview experience map
  (`app.src.js` ~5827) already drops `on === false` roles — so the visible ghosts are `on`-TRUTHY
  unused slots (if they were truly `on:false` the owner could never see them; the schema's `on:false`
  was illustrative). `AntcvExportHiddenRole` only hides targeted-app irrelevant roles, so an on-true
  unused slot fell through. **FIX (surgical, app.src.js + mirror app.js):** extend the render's
  null-return predicate with `__unusedSlot` — drop a role iff `bullets` is non-empty AND **every**
  bullet trims to `"<unused slot>"`. Keyed ONLY on that exact marker, NOT on bracketed `[Role title]`
  text — because the fresh-doc `me()` skeleton legitimately uses bracketed `[Role title]` /
  `[Bullet 1 — …]` placeholders that MUST stay visible/editable for new users (the broad
  bracketed-placeholder predicate would have hidden the entire new-user skeleton — rejected). The page-2+
  paginated render (`app.src.js` ~42925) delegates each role to the same `"experience"` case, so the one
  edit covers both preview paths; behaviour now matches `on:false` exactly. **Verified PAST the sign-in
  gate** (`pwa/test/diag-ghost-placeholder-roles.mjs`, 4 checks: ghost dropped / real roles render /
  fresh-skeleton role still renders / exactly 3 visible wrappers — plus a NEGATIVE CONTROL on the
  unfixed app.js proving the test has teeth: 4 wrappers + `<unused slot>` visible → FAIL). Suite
  463/463; mirror guarded (anchor count 1); app.js integrity asserted (`(()=>{`, no `"use strict"`).

- **STUDENTS-COUNCIL-NO-RESULTS-001** `[OPEN — likely working-as-designed]` — owner QA 0624:
  "student representative has no results". The Students Council Representative role shows no Results
  line. This is the RESULTS-DERIVE-NUMERIC-ONLY-001 behaviour: tier-5 derive only fires for a bullet
  carrying a concrete METRIC, and if a role has no real outcome and no numeric bullet, it correctly
  shows NO Results line (better than echoing a non-numeric duty bullet). The role's bullets
  (represent students, coordinate, support democratic processes) carry no metric. To give it a
  Results line, the GENERATION must emit a quantified outcome for it (e.g. council size, terms,
  issues resolved) into outcomes_items/proofPoints — regen-gated. Not a render bug.

- **EXPORT-PREVIEW-PRINT-SETUP-REFRESH-001** `[SHIPPED 1.50.844 — nightly 2026-06-24 run 3, LIVE-confirmed]` —
  owner QA 0624: "I need to refresh the page in order for the export preview to output page instead of
  print setup". **Root cause confirmed LIVE** (Chrome MCP on antcv.pages.dev, owner signed in): the
  export modal opened BLANK (the bare "print setup" shell — `--antcv-fit` empty, no page) then
  self-corrected to the rendered page seconds later. The iframe srcdoc (`antcv-pdf-preview-gate.js`
  `buildModal`, the `sheetLinks` block ~376) carried the same-origin package stylesheets
  (`antcv-packages-registry.css` + `antcv-mobile-controls.css`) as external `<link rel=stylesheet>`.
  Inside an iframe those are **render-blocking** — on a cold load the iframe could not paint until they
  fetched and fired iframe `load`, which ALSO gates the one-shot `fitWidth()` (line ~684); the package
  CSS lives only in those links so they can't simply be dropped. A page refresh warms the CSS cache so
  `load` fires fast → looked "fixed by refresh". **Fix (pure sidecar, no app.js mirror):** prefetch +
  cache the same-origin sheet TEXT at gate init (`prefetchSheetText()`, called in `boot()` — it runs in
  parallel during the ~18s editor boot, so the cache is warm long before Export is clickable) and INLINE
  it into the srcdoc as `<style data-antcv-inlined-sheet>` so the iframe paints immediately with no
  network round trip. Cross-origin / not-yet-cached sheets keep the `<link>` form, so a cold cache
  degrades to EXACTLY today's behaviour — **purely additive, zero regression**. Kill switch
  `localStorage['antcv:disable-sheet-inline']='1'`. **Verified PAST the sign-in gate**
  (`pwa/test/diag-export-preview-inline-sheets.mjs`: with fix → 2 same-origin sheets inlined, ZERO
  same-origin `<link>` in the iframe, paper renders + fit applied; NEGATIVE CONTROL with the kill switch
  → same-origin `<link>` retained + 0 inlined, proving the inlining path is what changed). Suite
  463/463; sidecar parses (`node --check`); cache-bust quintet → 1.50.844.

- **CONTRIBUTE-EDIT-JUMPS-WIB-TABLE-001** `[SHIPPED 1.50.843 — nightly 2026-06-24 run 3]` — owner QA
  0624: "entering HOW I WOULD CONTRIBUTE makes the WHAT I BRING table jumpy". **Root cause confirmed:**
  `antcv-how-contribute-controls-245.js` `pulse()` (line 116) fired BOTH `antcv:sections-updated` AND
  `antcv:item-pages-changed` synchronously on every changed keystroke (the bound input listener at line
  296 → `syncSectionField` line 220 → `pulse()`). Those wake the preview re-render (app.src.js
  item-pages effect ~15740) + `antcv-unified-pagination-probe-366.js` (~277), which re-measure the whole
  CL/main flow and visibly shift the `'bring'` (WHAT I BRING) table on every key. The 24ms
  `antcv-sections-updated-damper.js` only coalesces `sections-updated`, NOT `item-pages-changed`, so the
  contribute flood reached pagination uncoalesced. **Fix (pure sidecar, no app.js mirror):** split
  `pulse()` into `pulseNow()` + a 180ms TRAILING debounce. The localStorage write stays SYNCHRONOUS
  (`syncSectionField` writes before `pulse()`), so no edit is ever lost — only the re-render
  notification coalesces; a typing burst yields ONE re-paginate after the user pauses. Page-cycle
  buttons use the separate `pulsePages()` and are untouched. **Verified PAST the sign-in gate**
  (`pwa/test/diag-contribute-edit-coalesce.mjs`: drives the REAL bound intro listener with a 15-keystroke
  burst of DISTINCT values [each forces `changed=true`→`pulse()`]; fix → 1 flush + final edit persisted;
  NEGATIVE CONTROL on the unfixed sidecar → 15 flushes → FAIL, proving the test has teeth). Suite
  463/463; sidecar parses (`node --check`); cache-bust quintet → 1.50.843.

- **JD-FETCH-CHIP-LABEL-001** `[SHIPPED 1.50.740 — nightly 2026-06-20]` — owner: "when you fetch a JD, add
  the Job and company name as the first lines in" the green JD-ready chip (currently
  `✓ 4449 chars · url-fetch · 1 page`). DONE: the JD-ready chip (app.src.js ~39426 / app.js
  `tn`) is now a `flexDirection:"column"` div — line 1 = `zt.fileName` (the fetched page
  title carrying the role/company, set at app.src.js:14000; bold, ellipsized w/ `title`
  tooltip, `whiteSpace:nowrap` + `maxWidth:100%`), line 2 = the existing
  `✓ N chars · method · pages` line (opacity .85). Graceful fallback: no fileName → only the
  stats line (e.g. paste path). Verified headless: full-app boot past sign-in gate (bundle
  intact, 0 fatals) + isolated faithful subtree render (2 lines + tooltip when fileName set,
  1 line when not). Suite 339/339. Mirror guarded (1 occurrence). Original detail below: The chip is at `app.src.js ~39349-39362`:
  `!jt && zt?.text && React.createElement("span",{style:{fontSize:11,color:"#10b981",flex:1}},
  "✓ ",zt.text.length," chars · ",zt.method," · ",zt.pages," page",...)`. Data already
  available at fetch time: **`zt.fileName`** = the fetched page **title** (set at
  `app.src.js:13984` `fileName:(o.title||r).slice(0,120)`) which carries the job role (and
  often the company). IMPLEMENTATION: wrap the chip in a `flexDirection:"column"` div; line 1
  = the job/company (zt.fileName, ellipsized + `title` tooltip), line 2 = the existing
  `✓ N chars · method · pages` line. Mirror to `app.js`. For a clean "Role — Company",
  enrich from the source URL domain or a light parse of zt.fileName/the JD head. Cosmetic,
  low-risk; deferred from the 712-729 run as the owner tagged it "for nightly".

## Owner batch 2026-06-18 (PM3, 1.50.649 → 652) — generation-quality + UX

- **SUBSECTION-GAP-60** `[CLOSED 1.50.653]` — subsection-gap sliders (mainSectionGap/sidebarSectionGap/bodySectionGap, app.src.js ~13191-13193) now go 0-60 (was 0-30).
- **FIGURE-GAP-DECOUPLE-001** `[OPEN — needs owner confirm]` — investigation: the sidebar-top figure→first-subsection gap is set by `bodyEdgePad` ("Page · top/bottom padding", app.src.js ~41881 `marginBottom: __nzPx(ya.bodyEdgePad, 12)`), NOT `__secGap`/the subsection gap. Sections use `marginBottom: __secGap` (~6294) so raising the subsection gap grows the space BELOW each section, not the photo→first-section gap. So the figure is ALREADY independent of the subsection-gap slider. If the owner still sees the figure move, needs a live repro (which exact gap grows) before any render change; OR the real ask is a DEDICATED figure-gap control separate from bodyEdgePad. No speculative surgery.


- **ADDITIONAL-EXPLODE-001** `[CLOSED 1.50.649]` — owner: "have these sidebar subsections in commercial CV by default." `antcv-sections-normalize-415.js` new `explodeAdditionalToSections` splits ADDITIONAL INFORMATION into separate LANGUAGES / INTERESTS / ACCESSIBILITY sidebar sections (each its own ON toggle), placed where ADDITIONAL was. Idempotent (skips a bucket whose section exists → owner's current split preserved); Other items stay in a trimmed ADDITIONAL. Runs before the {group} partitioner. Unit-tested.
- **BANNER-ENDS-EARLY-002** `[CLOSED 1.50.650]` — owner "heart attack": the purple status ended at the kernel commit but content generation continued (semi-empty template, work resumed 30s later). `antcv-showcase-banner-persist.js genActive()` now also treats `step="generating"` as in-progress, so the banner spans the whole generation; quiesce 2.5s→6s, cap 60s→180s.
- **TABLES-DISTINCT-001 strengthened** `[1.50.651 — regen-gated]` — owner: CORE COMPETENCIES still repeats WHAT I BRING Focus Areas + Nordic cells wrap 2-3 lines. Hardened the prompt: explicit side-by-side ZERO-overlap check w/ example; hard cell caps (WHAT I BRING ~48 chars/1 line, CORE ~28 chars/half line, Nordic never wraps). **Needs regen.** Note: a deterministic removal of overlapping CORE rows was rejected (leaves CORE too sparse) — the LLM must produce distinct rows.
- **ORPHAN-PRETTY-001** `[1.50.652 — preview]` — owner: "much tighter orphan treatment." `text-wrap:pretty` on `.antcv-preview-paper` (inherited) so the browser avoids single-word last lines. PREVIEW only. **OPEN follow-up:** export/CloudConvert orphans need an NBSP-binding pass on the content sent to the worker (LibreOffice ignores `text-wrap:pretty`); only the manual `fix_orphans` LLM task exists today.

---

## OPEN — owner batch 2026-06-18 (PM, after 1.50.642) — full detail in `docs/qa/OWNER-BATCH-2026-06-18-PM2.md`

High-level-generation + structure bugs the owner reported after the 640-642 run.
Next-session prompt + per-item fix direction live in that doc. Summary:

- **TOOLS-METHODS-FIXIT-LOOP-001 + FIXIT-DESYNC-001** `[CLOSED 1.50.644]` — TWO bugs. (1) `Pe()` referenced an undefined `items` instead of the local `n` for labeled_list_item (app.src.js ~9853) + education_item (~9866) → compress no-op → orphan-retry spun. (2) the whole-section `labeled_list` compress SOURCE excludes group+hidden but the apply skipped only groups → a hidden item shifted every value after it (the "funny way" mangling). Both fixed; apply now skips group OR hidden.
- **PUBLICATIONS-DUP-001** `[CLOSED 1.50.646]` — new sidecar `antcv-publications-dedup.js` removes textually-identical entries from `personalInfo.publications`/`publicationsStructured` + the sections publications items (normalised key: strip HTML, collapse whitespace, lowercase → `<b>`-wrapped vs plain collapse; distinct year/title survives). Restore-proof.
- **WHO-I-AM-LABEL-DUP-001** `[CLOSED 1.50.645]` — new sidecar `antcv-heading-label-dedup.js` strips a leading `<TITLE>:` from `type:"text"` sections (own-title match → language-agnostic; bold either side of the colon; skips `text_inline`; never blanks). Restore-proof.
- **PHOTO-SHAPE-SQUARE-001** `[CLOSED 1.50.647]` — selector wrote only top-level `photoShape` (Pentagon's direct-DOM read) but the React render reads `stylePrefs.photoShape`. `writePhotoShape` now writes BOTH + dispatches `antcv:sections-updated` for an immediate repaint; `currentPhotoShape` reads stylePrefs-first.
- **PROFILE-REWRITE-001** `[CLOSED 1.50.648 — regen-gated]` — swapped the canonical unsolicited PROFILE (~2783) for the owner's text. Parity 1:1.
- **TABLES-SAME-FOCUS-001** `[CLOSED 1.50.648 — regen-gated]` — TABLES-DISTINCT-001 prompt rule: WHAT I BRING vs CORE COMPETENCIES Focus Area columns must be DISJOINT.
- **SPEC-LINE-GONE-001** `[NO CODE — regen-gated]` — the prompt ALREADY pins Gabriel's "Processes • Products • People" for unsolicited (~2732, name-guarded). Resolves on regen; if it persists, the subtitle render (`t.subtitle||""` ~11147/11233/11236) has no fallback to `personalInfo.specialization` — that's the render gate to add.
- **EMDASH render-separator half** `[OPEN — interconnected]` — the only remaining item. Pure-display separators (education deg—sch, role—company) are safe one-way swaps, but the saved-application label pair (writers 37410/43722/43753/40120 ↔ readers 21943/21963/21984/22824 split on `" — "`), the CL header editor (6448/6449), and the deg—sch enrichment strip (17835↔18120/44560) READ BACK on `" — "` — converting in isolation breaks stored saved-applications. Each writer↔reader group must move atomically with a round-trip test. Generated CONTENT already hyphenated (642 + 636).

### Shipped this run (1.50.640 → 648)
- **SELECT-DARK-DROPDOWN-001** `[640]` — `color-scheme:light` on form controls; native `<select>` dropdown no longer a black box on Windows dark mode.
- **GPA-EDITOR-001** `[641]` + **GPA-CHIP-LINE-001** `[643]` — education editor GPA input + 👁/🙈 `showGpa` toggle; GPA renders on its OWN line after the degree content (owner-corrected position).
- **DASH-HYPHEN-001 (prompt half)** `[642]` — global PUNCTUATION-DASHES rule so the model emits only `-`, never `—`/`–`.
- Plus the 5 owner-batch closures above (644-648).

---

## CLOSED — 2026-06-18 session (autonomous nightly + owner-directed batches; 1.50.605 → 1.50.619 + docx-worker 1.14.77 + access-relay auth-26)

Authoritative current backlog is `docs/qa/NIGHTLY_HANDOFF_2026-06-18.md` (full detail per batch). Summary below. **OPEN ITEMS carried out of this session are listed at the very bottom of this CLOSED block.**

### Closed 1.50.610 → 1.50.619 + workers (owner-directed batches 2 & 3)

- **PREVIEW-RESULTS-EDITABLE-REFRESH-001** `[CLOSED 1.50.610]` — a 4th v2-shape reader, the preview override sidecar `antcv-results-laminate-510.js` (`lamFor`), derived Results from the bullet for v2 roles and overwrote React's correct value. Now reads `o.result` + flat `proofPoints`. Preview matches export.
- **CLOUD-LOAD-ITEMS-001 (deeper)** `[CLOSED 1.50.611]` — importer `DEDUP_KEYS` now UNIONS `semanticConstraintsV2` + `stylePrefs.bannedContextual` (were REPLACED → a small import shrank a large set → synced shrunk to cloud). Residual: KV-429 silent-local (needs live check).
- **SIDEBAR-BREATHING-001** `[CLOSED 1.50.612]` — idempotent equalize guard in `antcv-sidebar-fill-equalize-227.js` breaks the measure→write→ResizeObserver→scroll→re-render→equalize loop. Verified 0 style writes across 12 scrolls.
- **SUBTAB-ORDER** `[CLOSED 1.50.613]` — Settings STANDARD: Personal before Account.
- **PUB-CHAIN-001** `[EXPORT docx-worker 1.14.77 + PREVIEW 1.50.613]` — non-academic CV shows publication title+year only (drop journal/publisher chain); academic keeps full citation. Export (renderSimpleList) + preview (list_italic) gated on `writing_style !== research-formal`. Owner PDF/regen verify owed.
- **WATERMARK-SIDE-001** `[docx-worker 1.14.77 — owner PDF verify owed]` — AI notice picks the column whose LAST page has fewer paragraphs (lighter side) from the worker's own pagination, not the stale preview hint.
- **G-GROUPS-003** `[CLOSED 1.50.614]` — `antcv-sections-normalize-415.js` partitions a flat ADDITIONAL INFORMATION into Languages/Accessibility/Interests `{group}` blocks (idempotent, restore-proof). Verified flat→3 subheads.
- **PERSONAL-TAB-JANK-001 (PARTIAL)** `[1.50.615]` — neutralized the tense sidecar's 120-3000ms setTimeout flood. **OPEN remainder below.**
- **PRIVACY-TABLE** `[CLOSED 1.50.616]` — cover-letter Cloud ✘→✓; added "Writing style, banned words & semantic constraints" ✓/✓ row.
- **VERSION-OVERRIDE-CACHE-001** `[CLOSED 1.50.617]` — `antcv-version-override.js?v=` was FROZEN at 1.50.41 since v1.40.339 → the version LABEL stuck (HAR proved app.js was already 616). Bumped + the cache-bust routine is now a QUARTET (bump the version-label file's `?v=` every release).
- **ERROR-PERSIST-001** `[CLOSED 1.50.618]` — `antcv-diag-probes-370.js` persists captured errors to `localStorage` ring `antcv:errorLog` (survives the reset's console clear); `window.AntcvErrorLog()` to table.
- **#D PER-STYLE UNSOLICITED KERNELS** `[Phase A access-relay auth-26 DEPLOYED + Phase B 1.50.619]` — per-writing-style kernel slots (Substrate B): `/api/kernel-showcase?style=<slug>` → `kernel_showcase_styled` table; app save/restore stamp the active `stylePrefs.style`. **Styles no longer overwrite each other.** Phase C OPEN below.

### Resolved/clarified (no code or already-shipped)

- **#1 sign-in "stuck Loading" / sticky ACCOUNT MODE** `[RESOLVED — stale label, not a hang]` — HAR showed app.js@616 + `/config` 200; the frozen version-override label made it look stale. Fixed by VERSION-OVERRIDE-CACHE-001.
- **HARD-REFRESH "doesn't reset"** `[RESOLVED via 1.50.617]` — same root cause (unchanged `?v=` survived the browser HTTP cache).

### Closed 1.50.626 (owner-directed, tail of session)

- **TENSE-POPIN-002** `[CLOSED 1.50.626]` — owner: "the experience tense is loading before the languages and it just pops in and out during the personal tab opening — and it is anyway supposed to be under the languages menu — keep it hidden until languages is open and expanded." The LanguageCard island ALREADY hosts the EXPERIENCE TENSE control inside its expand/collapse (renders only when Languages is expanded). The standalone sidecar's 2800ms grace FALLBACK (1.50.615) still built a standalone card before the island mounted, which the island then removed = the pop-in/out. Fix: `antcv-tense-control-422.js` now NEVER builds the standalone card when the islands bundle script is present (grace timer is a no-op) — defers entirely to the island, so tense only shows under the expanded Languages menu.

### DOCUMENTED — design-only, owner said "do not code yet"

- **PREVIEW-STYLE-FIDELITY cluster** (owner 2026-06-18, post-reset batch) — `docs/qa/PREVIEW-STYLE-FIDELITY-2026-06-18.md` (NEW). Six items, A–D likely share one root (`body[data-package]` / `stylePrefs.*` not reaching the preview render after reset/switch): **(A)** square/rounded/soft-edge/shadow photo buttons don't apply in preview (pentagon works — it's a direct-DOM clip sidecar; the others depend on the React render re-reading localStorage, likely clobbered or not re-rendered); **(B)** per-package figure shape not wired into preview (Pampas should force rounded-square — `PKG_SHAPE` is export-only; preview `__photoFrame` has no package fallback, and rounded-square/hexagon aren't handled); **(C)** candidate band + table heads stuck navy for ALL styles (`body[data-package]` stuck on copenhagen-modern → `var(--header-bg)` never switches; regression exposed by PALETTE-RESET-BAND-001 Option C removing the only re-colourer — do NOT revert Option C, fix the data-package staleness); **(D)** Nordic Frost pale sidebar washes out pale sidebar headlines (verify rendered sidebar bg vs va `sidebarBg #1A3A4F`); **(E)** reset doesn't resolve the settings-photo issue (confirms A–C survive reset; the 1.50.625 dead-band fixed only the #185 crash); **(F)** Personality-kernel "Retake the quiz" card pops in then disappears — SAME mechanism as TENSE-POPIN-002 (`antcv-personality-quiz-439.js` `injectCard` appends a standalone card to the Personal column that the LanguageCard remount drops) — owner wants it relocated INSIDE the Advanced Tones collapsible (stability + relocation).
- **SALMON-NPAGE-001** (addendum 2026-06-18) — `docs/qa/SALMON-NPAGE-SPEC-2026-06-18.md` now records that the EXPORT-PREVIEW pager (`antcv-pdf-preview-gate.js` `countPages` + `renderPager`, the owner's `aria-label='Scroll to page N'` chips) is a THIRD passive reader of `.antcv-page-row` count — fed for free by the measurer fix, but must be covered by the page-count test (assert chip count + title == worker numPages).
- **LOADING-GAP-001** — `docs/qa/LOADING-GAP-SPEC-2026-06-18.md` (NEW). The boot "Loading…" cover lifts one beat too early during the app.js post-login render cascade: a single-frame `!modeCardVisible()` gap (ACCOUNT MODE card mid un-/re-mount) trips the lift, so the set-menu flashes then loading returns. Fix direction = debounce the card-gone check + gate on a stable "editor route active" signal (NOT coded — owner-gated, cover timing is #185/flash-sensitive).

- **LOADING-LAMP-ICON-001** (owner 2026-06-18) — during the LAST part of the boot "Loading…" cover, a small **lamp icon flashes on top of the ant icon** (the 76px `icons/icon-192.png`, `antcv-login-loading-gate.js:168`). Almost certainly the same artifact the existing `SETTLE_BUFFER` (`antcv-login-loading-gate.js:234`, 500ms — its comment literally says "the brief post-appear flash ('lamp for a microsecond') is masked") was added to hide, but the buffer isn't fully covering it. Candidate sources to check at the cover→editor handoff: the pre-login app.js loading screen (src ~3320) compositing its own icon over this cover's ant for a frame, or a second glyph/badge drawn over `icon-192`. Symptom only; root cause not yet pinned. **Document-only per owner** (cover timing is #185/flash-sensitive — same caution as LOADING-GAP-001).

### OPEN — carried out of the 2026-06-18 session (for the next run)

1. **#D Phase C** (NOT done) — auto-load the current style's kernel on writing-style switch (choice c) + an App-History selector (list / load-to-preview / copy-to-CHOSEN-style / delete). New stateful panel in app.src.js + app.js mirror + reuse the Switch load path (~37334). Architecture mapped (handoff). **Held back deliberately — large app.js UI, not for the tail of a long session.**
2. **PERSONAL-TAB-JANK-001 (remainder)** — the "large blue region → WRITING STYLE fills" cascade is the WritingStylePicker island's empty 220px placeholder + native→island swap + unmount-on-leave/re-createRoot-on-entry. Needs an islands rebuild (real skeleton + keep-Personal-mounted). Diagnosed.
3. **QUICK-ALTS SELECTOR PLACEMENT (#1b)** — owner: the quick-alts selector "not in the right place with its text" in Layout. Today the Layout card renders only `LayoutNotes` text (the native package cards own quick-alts). Awaiting owner confirm: add interactive alt1/alt2 buttons to that card, or leave as notes.
4. **SETTINGS-SCROLL-RESET trigger** — owner reports an auto-reset during settings scrolldown; now instrumented (`antcv:errorLog`) — needs the owner to run `window.AntcvErrorLog()` after it fires to pin the trigger.
5. **Owner verifies owed:** WATERMARK-SIDE (real PDF), PUB-CHAIN (regen + PDF), CLOUD-LOAD cross-device (does the full constraint set now round-trip?), KV-429 silent-local check.
6. **Pre-existing from earlier handoff (not addressed this session):** SALMON-3PAGE-001, CL-WIB-002 (worker parity), RESULTS-NUMERIC-001/RESULTS-ORPHAN-001/LAM-RESULTS prompt half (regen-gated), PUB-CHAIN academic-detection edge, SIDEBAR-NARROW-FIGURE-OVERLAP-001.
7. **PROCESS:** a PARALLEL session committed during this run (`SEMANTIC-CONSTRAINTS-002` + `REVIEW-DATA-001`, both colliding on version numbers). Keep ONE session/deployer at a time.
8. **WIZARD-NO-SHOW-AFTER-DELETE-001** (owner 2026-06-18, DOCUMENTED — needs a live repro before coding) — "I deleted a user, then entered again — I have no welcome wizard." The wizard is gated on `u.get("wizardCompleted") || u.get("wizardSkipped")` (`app.src.js` ~14861). Delete does `AntcvFullErase` + `localStorage.clear()` (~28035) + `DELETE /api/prefs` (relay full-wipes D1, where `kernel.preferences.wizardCompleted` lives), so after a clean delete local + cloud should BOTH be wizard-flag-free → wizard shows. The cloud-restore on re-login RE-SETS it: `"boolean"==typeof o.wizardCompleted && o.wizardCompleted && !local && (u.set("wizardCompleted",!0), yn(!1))` (~14504-14507, closes the wizard). **Root-cause hypothesis:** the cloud `wizardCompleted` SURVIVES the delete (DELETE didn't fully clear it, or it was re-saved to cloud during the delete→re-login window before the wizard could open), so the restore suppresses the wizard. `antcv-cloud-restore-filter-298.js` strips wizard flags ONLY on its post-delete branch — if a same-email re-login isn't detected as post-delete, the stale cloud flag rides back. Same family as the account-isolation/wizard-reopen work; **owner-gated — needs a live repro** (check the GET `/api/prefs` `prefs.wizardCompleted` right after a delete + re-login) before touching the delete/restore path (cloud-data-loss risk).
9. **SHOWCASE-BANNER-ENDS-EARLY-001** `[SHIPPED 1.50.632 — owner chose "until editor finishes rendering"]` — fixed by the NEW sidecar `antcv-showcase-banner-persist.js`: it mirrors the native banner and, when app.src.js removes it at result-commit, continues an identical clone until the editor's DOM is quiet for 2.5s (or a 60s cap), keeping the `antcv-banner-active` 52px offset. No app.src.js/app.js surgery. Original diagnosis: — owner: "for the entire time a kernel is in generation keep the purple/black status on, even after moving to the editor; right now it ends while there's still lots of activity on the editor." The `antcv-showcase-progress-banner` shows iff `Pl` = `kernelShowcaseInProgress` (`app.src.js` ~27575-27606, `useEffect [Pl]`). It is cleared the moment the showcase RESULT COMMITS — `io.company === "Unsolicited"` lands → `u.set("kernelShowcaseInProgress",!1)`, `Bl(!1)` (~15259-15282). The "lots of activity" AFTER that is the post-result EDITOR work (lamination / pagination / fit / render), which is NOT tracked by `kernelShowcaseInProgress`. **Fix direction (needs owner intent):** either (a) keep the banner up until the editor SETTLES (tie `Pl` to a broader "generating/settling" signal — there's already a `$t("generating")` status at ~22576 the banner could OR-in), or (b) keep it until a definite post-render idle. Define the exact end-point first; it touches the generation/showcase lifecycle (app.src.js + app.js mirror), so confirm before coding.

---

## CLOSED — nightly 2026-06-18 (autonomous run; 1.50.605 → 1.50.608)

Authoritative current backlog is `docs/qa/NIGHTLY_HANDOFF_2026-06-18.md`. This run:

- **LAM-RESULTS-001** `[EXPORT + OUTCOMES-PANEL CLOSED 1.50.605]` — v2 kernel role shape
  (outcomes `{title,result}`, flat `proofPoints[]`) wasn't read by the lamination
  (`antcv-docx-client.js applyOutcomesMode`), the preview fallback (`__lamOfL`), or the
  seeder (`antcv-outcome-role-select.js`) → wrong-role outcomes. All three now read v2.
  DOCX/PDF verified. **Open follow-up:** preview Results `contentEditable` span doesn't
  refresh after the (correct) computed value changes — `PREVIEW-RESULTS-EDITABLE-REFRESH-001`.
- **COPENHAGEN-OVERLAY-001** `[CLOSED 1.50.606]` (owner 2026-06-18) — native package picker
  now dispatches `antcv:package-changed` so `body[data-package]` follows the pick instead of
  defaulting to copenhagen-modern (band/sidebar were stuck Copenhagen over other styles).
- **CLOUD-LOAD-ITEMS-001** `[SAVE-SIDE CLOSED 1.50.607 — owner cross-device verify owed]`
  (owner 2026-06-18) — `writeWritingPrefs` + the data-importer now cloud-sync (were local-only).
  Worker round-trip was already lossless. If the lost field was typed in the semantic-rules
  editor (already synced), the residual cause is a KV-429 local-only write or import-side
  REPLACE — pending owner confirmation of the entry path.
- **ROLE-DECOMP-001** `[CORRECTED 1.50.608]` (owner clarified 2026-06-18) — SEPARATE is the
  DEFAULT (decompose); merge is a CONSIDERED, JD-driven conclusion reached FROM the separate
  roles, never an auto space-saver. Prompt had drifted to "most positions should merge" — fixed
  + test updated. Suite 312/312. Regen-gated for output.
- **REG-DEDUP-001** `[CLOSED 1.50.609]` (owner 2026-06-18) — `antcv-data-importer.js`
  `DEDUP_KEYS` now keys regulatory/tools/additional on the normalized CODE/group (not
  code+description), so a re-upload dedupes ASPICE×2 / ISO 26262×2 / MIL-STD-810G×3 to one
  each and strips stale hidden flags (grouped items default visible). Drives `mergePath` via
  `window.AntCVImporter`; `diag-reg-dedup.mjs` green. Residual: divergent-label group headers
  aren't auto-fused (clear+reupload). **Also resolves G-GROUPS-001/002** (ingestion, not render).
- **G-GROUPS-001/002** `[RESOLVED VIA REG-DEDUP-001 / 1.50.609 — re-upload]` — grouped items
  hidden + flat duplicates was an ingestion append-merge + stale-hidden problem, fixed at the
  source. A render-side dedup was rejected (would empty the section — see handoff).
- **EXPORT-PREVIEW-SHRINK-001** `[was already SHIPPED 1.50.604 — width-only fit]`.

---

## OPEN ISSUES — owner review 2026-06-15 (PRIORITISED BACKLOG for the next session)

Owner-set ordering (2026-06-15, revised): **work CONTENT & EXPORT issues first, then SETTINGS MODIFICATION, then NEW FEATURES.** Within each bucket the items are roughly priority-ordered. Each item has the verified root cause + fix location. Discipline: edit `pwa/app.src.js` → mirror minified `pwa/app.js` (names DIFFER — anchor on string literals, copy minified blocks verbatim; see [[minified-mirror-shadow-hazard]]); verify PAST the sign-in gate headlessly (boot-smoke is NOT enough); a fix counts only if it holds in Preview + DOCX/PDF, desktop + mobile; cache-bust trio; push to `main` only; worker = manual deploy (one deployer at a time).

### QUEUED FOR NIGHTLY — owner 2026-06-17

- **SPELL-FI-VOIKKO-001** `[QUEUED — nightly]` — add real Finnish spell-check via **Voikko** (Giellatekno/Voikko; Finnish is agglutinative so Hunspell can't do it, and there is no `dictionary-fi` on jsDelivr — confirmed 404). Ship a WASM build of libvoikko (or a Voikko-backed service endpoint) and wire it into `pwa/antcv-spell-annotator-384.js` as a per-language engine alternative to nspell for `fi`. UNTIL then: Finnish is selectable (generation + the AI context proofread work) and the Languages → Spelling row shows a **"Voikko soon"** badge (shipped 1.50.573; `SPELL_UI.fi.soon='Voikko'` in `src/islands/LanguageCard/LanguageCard.tsx`). On completion, drop the `soon` flag and set `fi` to a real dict/engine path. Investigate: libvoikko-wasm size/perf, IndexedDB caching like the Hunspell dicts, and whether a worker endpoint is cleaner than client WASM.

### A0-NIGHTLY. SHIPPED + NEW — nightly session 2026-06-15 (late: colour, lamination, JD-cloud, prompt)

**SHIPPED / CLOSED this session** (PWA auto-deploys on push; worker = manual deploy, done):

- **MAIN-HEADINGS-GREEN-001** `[SHIPPED 1.50.496 + docx-worker 1.14.72 — owner CONFIRMED "the colour issue is resolved"]` — main-column CV H1/H2 + CL body headings, horizontal rules, ROLE NAME, RESULTS + WORK STYLE inline labels, main bullets, and the profile-photo contour → greenish teal `#00746E`; candidate band + table header keep `#33446F`; role COMPANY (`#333333`) + YEAR (`#595959`) stay neutral; sidebar unchanged; Copenhagen-modern + scandinavian/default base only. Edited all 5 palette copies (app.src.js `va` + base, app.js mirror, worker palette.js + index.js bundle, packages/registry.json `head` token; CSS vars doc-only). `mainHeadColor = p.head || p.base`. See [[palette-token-copies]].
- **RESULTS-LAMINATION-002 → -003** `[SHIPPED 1.50.495 → 1.50.498]` — -002 (1.50.495) REMOVED derive-from-bullets after owner saw "the result is just a copy of the first role content bullet"; -003 (1.50.498) RESTORES derive as a RARE last resort (after tiers 1-4) that HIDES the source bullet (export drops it from `role.bullets`; preview sidecar hides the matching `[data-edit-path]`). PROVEN against the owner's real `AntCV_sections_corrected_..._outcome_edits.json`: every active role fills from tiers 1-4 (mostly `proofPointIds`), so derive never fires for his data. Supersedes RESULTS-LAMINATION-001 (now fully shipped, preview + export).
- **JD-CLOUD-VISIBILITY-001** `[SHIPPED 1.50.498]` — the JD mirror `antcv:lastJdText` (powers JD-aware per-role outcome visibility) is now cloud-aware: both cloud-restore paths mirror the restored `jd_text`, so JD-gated outcomes show cross-machine WITHOUT a regen. Unsolicited/general/manual rows clear it.
- **CV-CRITICAL-FIELDS-001 + SIRIN-SEMANTICS-001 + GEN-PROFILE-001-ENFORCE** `[SHIPPED 1.50.497 — NEEDS OWNER REGEN TO VERIFY]` — prompt hardening in `app.src.js` (+ app.js mirror): (a) a CV-side critical-field retry gate (empty `profile_content`/`work_style_content` → retry) to fix PROFILE / "Work style:" coming back empty; (b) Sirin = "supervised/directed a 7-person task force, NOT led/managed"; (c) unsolicited profile opening with electro-optics/optics/LiDAR is retried (open with "IT professional"). Output verification requires an owner regen (can't be checked headlessly).
- **TABLE-HEADER-MATCH-BAND-001** `[SHIPPED 1.50.486 earlier 2026-06-15]` — preview table header matches the candidate band.

**NEW OPEN BUGS — owner 2026-06-15 (late session; documented, NOT yet fixed):**

- **PDF-ASK-WHERE-TO-SAVE-001** — with the preview modal's "Ask where to save" checkbox TICKED (`<label id="antcv-pdf-preview-modal-savewhere">`, `antcv-pdf-preview-gate.js`), pressing a PDF download button does NOT prompt for a folder; only the DOCX path asks (once, on first use). Likely cause: the DOCX download uses the File System Access API (`showSaveFilePicker`) while the PDF path uses an anchor-download / print that ignores the checkbox. Fix: route the PDF save through `showSaveFilePicker` too when the checkbox is set (and persist the choice the same way DOCX does).
- **INTERESTS-CONTENT-001** — INTERESTS must be a LIST (type with topic + description, one row each) containing exactly: (1) Rugby — operations manager and assistant coach at Copenhagen Wolves RFC; (2) Hiking; (3) Tai-chi; (4) Reading; (5) Supervision of three feline napping experts. Source: owner's stored hobbies / `interests_items`. Tie to ADDITIONAL-INFO-SPLIT-001 (item 8).
- **ADDITIONAL-INFO-HIDE-WHEN-INTERESTS-001** — ADDITIONAL INFORMATION should be HIDDEN by default whenever INTERESTS is displayed (avoid duplicate hobbies). Pairs with ADDITIONAL-INFO-SPLIT-001 (item 8) + INTERESTS-CONTENT-001.
- **RESULTS-DOCX-MISSING-001** `[CLOSED — worker half NOT A BUG; verified nightly 2026-06-17]` — the worker render branch is UNCONDITIONAL per role: `renderExperience` emits a Results paragraph for every role whose `role.results` is a non-empty string (`workers/docx-worker/src/index.js` ~26336, inside the `roles.forEach`); no role-index/page gate. `test/diag-role-results-export.mjs` 5/5 (label present once, bold+italic, ordered after r0 bullet / before r1). The "not all positions" symptom is purely DATA-SIDE (a role arriving with empty `role.results` from the lamination/tightening pipeline) → tracked by RESULTS-TIGHTENING-STRIP-001 / RESULTS-LAMINATION distribution, regen-gated + owner-data-dependent. No worker change actionable.
- **RESULTS-PDF-INK-BLACK-001** `[CLOSED — ALREADY SHIPPED docx-worker 1.14.73 (commit f3050ae); verified nightly 2026-06-17]` — the per-role "Results: " label run already uses `style.mainHeadColor` (teal `#00746E`) at `workers/docx-worker/src/index.js` ~26348; the outcome text after the label is `style.mainTextColor` (neutral body ink) by design — matches MAIN-HEADINGS-GREEN-001. Not black. Backlog entry was stale.
- **AI-WATERMARK-EXPORT-LOCATION-001** `[SHIPPED docx-worker 1.14.75 (commit 1c3cc31); owner PDF eyeball owed]` — the AI notice is now a SENTINEL-anchored bottom-corner VML text frame placed at the END of the last page's content (`buildAiDisclosureHangingTextbox` + `postProcessDocx` swap), removing the flowed mid-page notice that disagreed with the preview. `test/diag-ai-notice-anchor.mjs` 13 checks. RESIDUAL: owner verify DOCX→PDF survivability through CloudConvert on CV 1/2/3-page + CL.
- **SECTION-TYPE-NORMALIZE-INLINE-001** `[SHIPPED 1.50.522 (commit 07e7310); verified]` — `inlineifyLabeledText` in `antcv-sections-normalize-415.js` promotes `work_style`/`who_i_am`/`why_company`/`why_role`/`why_position` (by id or title) from type `text` → `text_inline` on import so the bold inline label renders in the PREVIEW (export already did). Skips CL boilerplate. `diag-sections-normalize.mjs` asserts work_style + who_i_am become text_inline, greeting stays text.

### A0. RESOLVED / NEW — owner live session 2026-06-15 (admin PDF gate + generation findings)

- **RESULTS-LAMINATION-001** `[EXPORT half SHIPPED 1.50.491; preview render = next increment]` — owner: "role→result distribution is NOT random — every role should have a specific result laminated to it." Contract = the master profile (`AntCV_master_profile_gabriel`): each experience role carries `proofPointIds` linking it to its OWN proof points (+ `proofPointsByRole`/`proofPointsByPosition` id→text), and the worker already renders `role.results`. Fix (EXPORT, `antcv-docx-client.js applyOutcomesMode`): each role's Results line now comes from its OWN lamination — explicit `role.results` wins verbatim, else resolve `role.proofPointIds` against `personalInfo.proofPointsByRole` (top 2, capped). The heuristic SELECTED-OUTCOMES token-spread runs ONLY for roles with NEITHER (so spill no longer starves the tail). Verified `pwa/test/unit/results-lamination.test.mjs` 6/6 + suite 290/290; existing applyOutcomesMode parity still green. DEPENDS ON: import preserving `personalInfo.proofPointsByRole` (else use explicit `role.results`). NEXT: mirror into the PREVIEW experience render (`app.src.js`/`app.js`, ~5559) so preview matches export; confirm proofPointsByRole survives JSON import.

- **LLM-FALLBACK-MODEL-404-001 / FALLBACK-MODEL-001** `[SHIPPED — demo-proxy + proxy deployed 2026-06-15]` — owner live probe showed a forced gemini `consensus_poll` hard-failing: `[callLLM] task=consensus_poll provider=gemini failed (404): anthropic returned 404, model: gemini-2.5-flash`. Root cause in BOTH proxies' `handleWithProviderFallback` (`workers/*/src/index.js`): when the requested provider returns a 5xx / throws, it swaps `x-provider` to the next provider but kept the SAME `body.model` — so anthropic/openai/mistral (which have NO default model; only gemini defaults) receive the previous provider's model id and 404. A 404 (<500) returns immediately → a recoverable primary-provider 5xx becomes a hard failure (and degraded generations / placeholder leaks downstream). Fix: on fallback attempts (i>0) to a DIFFERENT provider, rewrite `body.model` to `PROVIDER_MODELS[provider][0]` (drop stale content-length + x-gemini-model). PRIMARY attempt (i===0) byte-for-byte unchanged → normal generations unaffected; blast radius is the already-broken fallback only. node --check + dry-run build clean; both workers deployed. Owner live-verify: regen → no `returned 404` fallback line.

- **EXPORT-FALLBACK-ON-FIRST-001** `[FIXED 1.50.487 — owner verify]` — ROOT CAUSE (live console probe + owner): the owner is the deployment ADMIN on the shared demo deployment (`B.demo_mode=true`). `__antcvUseServerPdf()` (`app.src.js` ~1362) granted server PDF only to non-demo deployments / demo-active users / own-CloudConvert-key users — NO admin bypass. So the admin (BYOK + own LLM key + no CC key) always fell to the client-print fallback (`kl()`→`buildHTMLDoc`). That is why ALL the owner's PDF exports bypassed the worker, and why every worker-side fix (brighter band, table-header=band, 0.14" margins, table dims) never reached the PDFs, and the fresh PDF still showed the band/table-header mismatch. The "demo badge flashes then disappears" = demo-treatment suppression resolving for the admin AFTER auth — but the PDF gate lacked that same exemption. FIX: `__antcvUseServerPdf()` now also returns true when `B.is_admin`. **Owner: hard-refresh, export a PDF, confirm the console shows `[pdf] server export ok` (not `server export failed, falling back to client print`).** Once confirmed, BAND-HEADER-BG-SEAM-001 + CL-TABLE-DIMS-FALLBACK-001 + the table-header/margins/band items should ALL be resolved on the PDF, because the PDF now renders via the worker.
- **CORE-COMP-RETRY-HANG-001** `[SHIPPED 1.50.489]` — the unsolicited subtitle ("(Processes • Products • People)") reverts to the template placeholder `[Specialisation — 1–3 focus areas, separated by •]` and the status tracker stalls for MINUTES before recovering. Console root cause: `antcv-kernel-completeness-290.js` throws `PartialResponse` to force a full provider RETRY whenever `cv_overrides.core_comp_rows` has `<4` data rows; the LLM returned 3, so it burned all 4 generate attempts (`[v23] Generate attempt 1/4 failed … KERNEL_INCOMPLETE: core_comp_rows (3 data rows, need >=4)`), each a full round-trip = the multi-minute hang + placeholder flash. Fix options: lower the floor to ≥3, OR cap the retry to 1 for a 1-row shortfall and pad the 4th row from the kernel, OR don't gate the WHOLE generation on a single short table. Sidecar (`antcv-kernel-completeness-290.js`, no app.js mirror). Verify headless.
- **RESULTS-TIGHTENING-STRIP-001** `[NEW — owner 2026-06-15]` — owner: "the last process (Tightening the length) removes the results from all roles apart from the first role"; the last two roles (R&D/Teaching Assistant, Computer Administrator) export with NO results, and Security Guard is missing entirely. The "🔎 Tightening to length targets…" pass (`app.src.js` ~24844-24918) builds its LLM payload from BULLETS ONLY (no `results`) and writes back `{...e, bullets: t.bullets||e.bullets}` (spreads `...e`, so it should PRESERVE `results`). So tightening isn't obviously deleting results — the loss is likely in the outcomes DISTRIBUTION timing/keying relative to tightening, OR the page="continuation" roles (index > 2) losing their per-role results. Needs a live before/after probe of role.results around the tightening pass + a regen. Also: the missing Security Guard role is a separate role-drop (dedupe/floor). Investigate together with the OUTCOMES-RESULTS coverage items (9, item 9 RESULTS-METRIC-SHARPNESS).

### A. CONTENT & EXPORT (do first)

1. **EXPORT-FALLBACK-ON-FIRST-001** (owner 2026-06-15) — after a HARD RESET, the FIRST "Export to PDF" opens the INLINE FALLBACK export (not the worker), and it shows the ANALYSIS PDF instead of the cover letter; a page refresh fixes it. **VERIFIED MECHANICS (2026-06-15 session):** the "⬇ PDF" handler (`app.src.js` ~46290) calls `window.exportPdfViaWorker` (server PDF, POST `/generate-pdf`); on ANY throw it `console.warn`s "[pdf] server export failed, falling back to client print" and calls `kl()` (~46330). `kl` → `Na()` = `buildHTMLDoc` (~25119), a from-scratch MSO-HTML builder that prints via `document.title` swap + window.print. So the "fallback" is `buildHTMLDoc`. Fix needs a LIVE console probe of WHY the first `exportPdfViaWorker` throws after reset (worker URL not yet on `window.ANTCV_DOCX_WORKER`? relay token unseeded? cold-start timeout?). Do NOT speculatively edit the export/fetch chain (protocol). A safe interim: retry the server PDF once before falling back, and on fallback surface a one-line notice so the user knows it degraded.

2. **CL-TABLE-DIMS-FALLBACK-001** (owner 2026-06-15, "CL export still does not consider changes to table dimensions") — **NOT a dims-forwarding bug.** Verified end-to-end this session: the column-ratio drag persists to `clTableRatio` via React `ia` (`app.src.js` ~16358) AND the fast-drag sidecar; the table-edge width drag persists to `personalInfo.stylePrefs.tableWidthPct['bring']` via `antcv-section-align.js`; `buildPayload`/`normalizeSections` (`antcv-docx-client.js` ~1361-1386, `_isClTable = s.id==='bring'`) forwards both `tableWidth` (DXA from the % map) + `tableRatio` (clTableRatio) for BOTH `exportDocxViaWorker` AND `exportPdfViaWorker`; the deployed docx-worker 1.14.67 (`renderCompetencyTable` ~26089-26104) honors `s.tableWidth`/`s.tableRatio` for the `isCl` branch. `readTableWidthPctMap` reads the exact key section-align writes. The bring section is `type:'table'`, `id:'bring'` (~3197). table-dims-forward.test 6/6 + worker XML check pass. **Root cause: the symptom is EXPORT-FALLBACK-ON-FIRST-001** — when the server PDF call fails and degrades to `kl`→`buildHTMLDoc`, that client HTML builder does NOT read `clTableRatio`/`tableWidthPct`, so the fallback PDF shows DEFAULT dims. Two real fixes (either resolves it): (1) stop the spurious first-export fallback (item 1 — needs the live probe), or (2) teach `buildHTMLDoc` (`Na`, ~25119) to read `clTableRatio` + `stylePrefs.tableWidthPct['bring']` for the WHAT-I-BRING table so the fallback respects them too (rendering-only change inside `Na`, NOT the fetch chain — surgical: find the bring/competency `<table>` build inside the `b` section-renderer and apply col widths from the ratio + an overall width % from the pct map). **UPDATE (nightly 2026-06-15): the diagnosis was PARTLY WRONG — `buildHTMLDoc`'s `case "table"` (~25236) ALREADY reads the column RATIO: `s = Math.round(r * (y?Qr:Xr))` where `Qr`=`clTableRatio`, `Xr`=`cvTableRatio` (`y`=CL). So the fallback already honours the column split. The ONLY residual gap is the OVERALL WIDTH: `r = y?385:346` (pt) is fixed and ignores `tableWidthPct[id]`. The fix is just `r *= (pct/100)` (pct from `personalInfo.stylePrefs.tableWidthPct[e.id]`, default 100 = unchanged; the 385pt default corresponds to the worker's 100%=9602 DXA base). NOT done this session: `Na` is an internal HTML-string builder not exposed on `window`, so a width change can't be verified by rendering the real component headlessly — it needs a real fallback PDF (trigger the server-export failure). Low value (fallback-only, ratio already works); do it WITH an owner PDF check, not blind.**

3. **COPENHAGEN-BLUE-BRIGHTER-001** `[SHIPPED 1.50.484 + docx-worker 1.14.68]` (owner 2026-06-15) — Copenhagen Modern's candidate band / header is too dark a navy (`#283556`); move it to a slightly brighter blue **`#33446F`** in the CV AND cover-letter candidate sections AND the table header. Apply in BOTH preview and export and keep them at parity. Sites: preview palette `packages/registry.json` `copenhagen-modern.base` (line 10) + `alt2.head` (line 20); export palette `workers/docx-worker/src/palette.js` (line 25 `base: '283556'`) AND the inlined copy in `workers/docx-worker/src/index.js` (bundle has no build step — [[docx-worker-bundle-no-build]]). The table-header fill keys off the head/base token, so it follows automatically — verify it does. **DO NOT change `UNIVERSAL_DARK_INK = '283556'` (`palette.js` ~85)** — that's the dark BODY/label ink, not the band. After the change, re-verify the band's WHITE candidate text + table-header WHITE text still have adequate contrast on `#33446F` (it's lighter, so check `readableInk`). Preview (registry) + worker → manual deploy + headless/PDF verify.

4. **SECTION-RULE-INK-MATCH-001** `[SHIPPED 1.50.485 — PWA-only]` (owner 2026-06-15; clarified the target is the per-ROLE divider) — in the BODY / main column, the horizontal rule under a section heading should take the SAME colour as the heading TEXT it sits under (e.g. teal `#00746E` under a teal heading), not a fixed navy. Today the underline colour is decoupled from the heading-text colour. Sites: preview live render of the main-section heading + its underline (the section-heading component in `app.src.js`) AND the print/`buildHTMLDoc` `h`/`f` helpers (`app.src.js` ~25135-25139 — `f(e,...)` already takes a colour arg `e`; make the caller pass the heading-text colour, not the band colour); export = the worker's main-section heading + rule (`workers/docx-worker/src/index.js`, section-heading renderer). Keep sidebar behaviour as-is; this is MAIN-column only.

5. **CL-CONTACT-ONELINE-001** `[SHIPPED docx-worker 1.14.68 + preview parity 1.50.484]` (owner 2026-06-15, with screenshot) — the cover-letter candidate contact line (address • EU Citizen • email • phone • linkedin) wraps to two rows because the separators are too wide. Tighten the inter-item spacing so it stays ONE line. Export site: `workers/docx-worker/src/index.js` ~25201 `const sep = bridge ? " • " : "   •   "` — the non-bridge sep has 3 spaces each side; reduce to ~1 space each side (and/or shrink the contact font / letter-spacing) so the row fits. Mirror the same tightening in the PREVIEW contact-line render (app.src.js) so they match. Keep the text itself tight; do not drop any contact item.

6. **CL-EXPORT-EDGE-MARGINS-001** `[SHIPPED docx-worker 1.14.69]` (owner 2026-06-15; chose 0.07"→0.14") — the exported cover letter needs MORE breathing room from the page edges — about **1.5–2× the current edge margin** — while keeping the text tight within each line (more outer margin, same line tightness). Primary site: the worker's CL (linear) page margins (`workers/docx-worker/src/index.js` — section `page.margin` for the CL/linear layout; default is 1 inch / 1440 twips → target ~2160–2880 twips L/R, tune T/B similarly). Verify the WHAT-I-BRING table still fits the narrower content width (its width is a % of the body — may need a small ratio/width re-check). Export-only is acceptable, but mirror the visual in the preview page padding if cheap. Worker → manual deploy + PDF verify desktop + mobile.

7. **PREVIEW-EXPORT-PAGEBREAK-PARITY-001** (j). In the PDF, page 2 starts with a role that the PREVIEW kept on page 1 — the measurer (autoPages) and the Word/LibreOffice export paginate differently. This also shifts which roles land on page 2 (interacts with results placement). Fix: align the preview per-role page estimate with the export's actual break (the two-map pagination — see [[pagination-two-map-and-worker-test]]); likely the measurer over/under-estimates a role's height vs the worker's role spacing (1.14.64 tightened role bullets to line 252).

8. **ADDITIONAL-INFO-SPLIT-001** (g). Generator merges Languages into ADDITIONAL INFORMATION; owner wants separate LANGUAGES + INTERESTS sidebar subsubsections. Root: me() skeleton (`pwa/app.src.js` ~3149-3167) has ONE merged `additional` (labeled_list) section; a separate `interests` section exists only in a template scaffold (~36420); the prompt already emits `interests_items` (~22885) but no skeleton section receives it. Fix (pick one): (A) split me() into `languages` + `interests` sidebar sections (schema change + migration), or (B) a restore-proof splitter in `antcv-sections-normalize-415.js` that extracts the Languages item + hobbies out of ADDITIONAL INFORMATION into their own sidebar sections (loop-safe, fits the existing pattern). Direct JSON import already has them separate (owner's corrected JSON).

9. **RESULTS-METRIC-SHARPNESS-001** — outcomes still echo bullets / miss the real metrics (250→10 days, 30% revenue, 5 domains, 10× price). The consensus reinforce degrades them; 1.50.478 hardened the prompt, 1.50.483 raised the clamp to 12 — RE-GENERATE to judge. If still flat, the surgical lever: stop `consensus_reinforce` (app.src.js ~24741) rewriting any outcome that already contains a metric.

10. **HIWC-ORPHAN-TIGHTEN-001** — HOW I WOULD CONTRIBUTE bullets ~3-5 chars tighter (e.g. "Map the current change and validation flow…cycle time." orphans). Prompt-side.

11. **CL-PREVIEW-TABLE-WIDTH-001** — widen the CL WHAT-I-BRING *preview* table (wrapStyle ~72%, app.src.js ~5075) to match the export (worker 0.8); the 1.14.67 ratio→0.25 helped the column split, not the absolute width. (Coordinate with CL-EXPORT-EDGE-MARGINS-001 — the new export margins change the body width the 0.8 is a fraction of.)

12. **EXP-TENSE-NOT-APPLYING-001** (owner 2026-06-15) — the Experience-Tense control is set to "Present" (aria-pressed) but role content + Results render PAST. Two parts: (a) the control the owner sees (`data-antcv-exp-tense`) is the Adv-Styles one (`app.src.js` ~13119); the Personal copy (`antcv-tense-control-422.js`, `data-antcv-tense`) anchors on the LanguageCard island `#antcv-react-personal-languages` which isn't mounting (item LANGUAGES-CARD-PERSONAL-001) — fixing that restores the Personal control. (b) tense is GENERATION-time only (writes `styleConfig.expTense`, read by the prompt `__tenseRule` ~22743) — it does NOT re-tense existing content; the owner must RE-GENERATE. 1.50.482 extended `__tenseRule` to also force the SELECTED OUTCOMES leading verbs — verify on a fresh generation. Still missing: the legacy ChatGPT-draft path (~22771) has no `__tenseRule`; and a live re-tense of EXISTING content would need a normaliser/rewrite pass.

13. **DOC-SUPERVISION-001** (owner: "supervisor is not controlling the documents very well") — a quality-control/orchestration pass that ENFORCES the rules end-to-end (results on every role, no Founder/i-nord, metrics present, no patent-in-role) before the doc is shown. The normaliser poll (1.50.476/479) is the restore-proof half; the owner wants a stronger "supervisor".

### A2. CONTENT & EXPORT — owner SECOND review 2026-06-15 (real fresh exports + screenshots)

22. **PROFILE-END-COMMUNICATION-001** `[SHIPPED 1.50.509 — prompt; owner verify on regen]` (owner 2026-06-15) — every CV PROFILE must END with a sentence about the people-person approach / communication skills (the "technical expert WITH human-reading" close). The prompt's 3-part PROFILE structure (`app.src.js` ~2768-2772) already names SPECIAL CAPABILITIES (people-reading) as part 3, but the real export does NOT reliably end on it (it ends on "Solo-developed a GenAI product…" then a separate "Work style:" line). Fix: harden the prompt so the LAST sentence of `profile_content` is the people/communication capability (and/or enforce render order). Banned-word render constraints (no raw "people's person"/"team player"/"empathy") still apply — behaviour over adjectives. Verify on a FRESH generation. Prompt-side.

23. **PROFILE-UNSOLICITED-GENERIC-001** (owner 2026-06-15) — the UNSOLICITED CV PROFILE (no specific job/company) must avoid over-specific headline terms. The real export opens "Electro-optics and systems engineer with 15+ years in automotive LiDAR, defence optics, and nanotechnology" — EXACTLY what the prompt (~2769) ALREADY forbids, so the rule is being VIOLATED (the model ignores it, or the consensus/reinforce stage or the memory-profile fusion ~22228 from uploaded electro-optics-heavy docs reintroduces the niche opener). Owner: prefer "IT expert / IT professional" framing; BAN as the OPENER: "Electro-optics and systems engineer", "electro-optics specialist in system architecture", "deep-tech", "automotive"; a specific domain may appear LATER as ONE example, never the headline; be careful applying these in non-deep-tech roles. Fix: harden the unsolicited-register rule AND find which stage emits the violating opener (regenerate to repro; check the memory-profile fusion override + consensus reinforce). Prompt-side.

24. **BAND-HEADER-BG-SEAM-001** (owner 2026-06-15) — a visible difference between the candidate band bg and the (table) header bg is seen in ALL 4 configs (CV/CL × Preview/PDF). NOTE: `TABLE-HEADER-MATCH-BAND-001` (1.50.486, preview) + `COPENHAGEN-BLUE-BRIGHTER-001` (worker 1.14.68, export) were JUST shipped to make the table header equal the band — these owner exports likely PRE-DATE those. Action: regenerate FRESH CV + CL and re-check. If a seam persists, pixel-sample the candidate band vs the table header (and any band sub-region) to identify the two differing tokens and unify them. Both bands are built from MULTIPLE shaded cells — confirm every band cell + the table header resolve to the SAME `#33446F` in preview CSS vars (`--header-bg`) AND worker shading (`style.headerBg`/`style.tableHeaderBg` = `band`).

25. **CL-WIDTH-CAP-001** (owner 2026-06-15, with image) — the CL body/table width does NOT open to the full available page width; clearly unused horizontal space on the right. The WHAT-I-BRING table (and/or the CL content column) caps below the usable body width. With `CL-EXPORT-EDGE-MARGINS` now 0.14" L/R the body is wide; the CL table default is `(PAGE_W-400)*0.8` (worker) and the preview `wrapStyle` is `width:"72%", maxWidth:540` (`app.src.js` ~5078). Owner wants it to use more width. Fix: raise the CL table width fraction AND drop/raise the preview `72%`/`maxWidth:540` cap so it fills the wider body; coordinate preview (~72%→~0.85-0.9, remove the 540px cap) with export (worker 0.8→higher); confirm the width-drag max also reaches the wider bound. (Supersedes/extends `CL-PREVIEW-TABLE-WIDTH-001`.)

26. **SIDEBAR-NARROW-FIGURE-OVERLAP-001** (owner 2026-06-16) — when the sidebar column becomes NARROW, the candidate-band text and the horizontal rule under it progress INTO the photo/figure, and the MAIN-section content does too. The fix must keep these elements positioned RELATIVE TO the figure's bounds — text/rules must STOP at (or be pushed aside by) the figure, not run under/over it. Also applies to OTHER photo placements: e.g. **sidebar-middle**, where the sidebar's own body text must be pushed aside (reflow/inset) around the figure rather than overlapping it. Covers BOTH the candidate-band overlap (band text + rule vs the medallion) and the in-column text-wrap-around-figure case. Scope: preview render (the band/header + sidebar/main columns in `app.src.js` / preview CSS) AND export parity (worker photo float + cell text wrap). Tie-in: [[photo-bridge-nonfloat]] (in-cell float-wrap is the open half — text renders but does not wrap around the in-column float) and the band-overlap medallion straddle (worker 1.14.71). Owner check is visual (real PDF + narrow-sidebar preview). NOT YET STARTED.

27. **ROLE-DECOMP-001** `[SHIPPED 1.50.508 — prompt + sidecar; regen + data needed]` (owner 2026-06-16) — "decompose the merged roles ... merging is later". The generator + runtime normalizer used to MERGE same-company overlapping roles into one (Innoviz collapsed to a single position). Now INVERTED: the prompt rule (`app.src.js`/`app.js` STORED WORK HISTORY → `ROLE DECOMPOSITION (ROLE-DECOMP-001)`) keeps each stored role separate AND splits combined-function titles (`X & Y`, `X and Y`); `antcv-sections-normalize-415.js` `dedupeRoles` now merges EXACT-title dups only (was containment) and `dropCustomerChangeDup` is no longer applied (Customer Change Requests Specialist kept as a distinct position). Verified headless (diag-role-decomp) + 297/297. **TWO RESIDUAL DEPENDENCIES (owner action):** (a) the un-merge only takes effect on a fresh GENERATION — owner must REGENERATE; the exact Innoviz position count depends on his D1 kernel (it currently holds 3 overlapping Innoviz entries), curate via the 👁 hide control or refine the kernel. (b) **DATA GAP — two roles absent from the D1 kernel** (`user_kernel`/kernel_snapshot_2026-06-16.md), so generation can't emit them until they are in the kernel/master profile: (i) **Copenhagen Wolves operations-manager** (foreningsarbejde) — CONTENT IS KNOWN (owner-provided, in the gabriel-cv-facts memory: Team Operations Manager, Copenhagen Wolves RFC / Pan Idræt, 2023–present; operations/logistics, player-coach-association link, LGBTQ+ inclusivity, democratic club processes); just needs inserting into his kernel/master profile. (ii) **Tel-Aviv security guard** (3rd Tel-Aviv position, the "dorm guard") — CONTENT UNKNOWN; owner must supply years + 2-3 bullets (do NOT fabricate). Meprolight (`Electro-Optics Engineer & Team Leader`) + Tel-Aviv (`R&D and Teaching Assistant`) split via the title-combine rule on regen.

### B. SETTINGS MODIFICATION

14. **LANGUAGES-CARD-PERSONAL-001 — regression.** In Settings → STANDARD → Personal, the Languages card fell to the BOTTOM (under "Done") and its spelling + tense controls disappeared. Owner wants it back in place, labelled "Languages" (covers spelling + tenses too), with those controls restored.
   - Root: `src/islands/LanguageCard/mount.tsx` (~43-74) anchors via `findSettingsFlexColumn` (`src/lib/settings-dom.ts` ~167-189, PERSONAL_LABELS ~24); the Personal subtab (`pwa/app.src.js` `yl` fn ~21217-22180) has NO flex-column wrapper, so the find fails and the card falls to the "before Done" fallback. The Experience-Tense control (~13119-13208) is NOT rendered inside `yl` (orphaned). Spelling = `antcv-spell-annotator-384.js`.
   - Fix: wrap the Personal sections in a `display:flex;flex-direction:column` container so the island anchors (order 20), and render the Experience-Tense (+ spelling) control inside `yl` at order 22. Per `settings-subtab-placement` memory. (Unblocks the Personal half of EXP-TENSE-NOT-APPLYING-001.)

15. **SETTINGS-SCROLL-RESET-001.** Scrolling down in the Settings modal jumps/hard-resets to the top. Root: a React re-render in the settings panel resets the scroll container's scrollTop. Fix: find the settings-modal scroll container, preserve scrollTop across re-renders (or eliminate the re-render that resets it; check the islands MutationObserver remounts and the `settingsTab`/`settingsSubTab` state churn).
   - **CORRECTED DIAGNOSIS (nightly 2026-06-17, DO NOT repeat the dead end):** the subtab-button `onClick` scroll-reset walk (`app.src.js` ~30902 `st(e.k)` then climb to the first `overflowY:auto` ancestor → `scrollTop=0`; minified `app.js` `onClick:t=>{vt(e.k);...` count 1) is a **RED HERRING**. Headless ancestor probe past the sign-in gate: the active subtab button's parent chain is `[overflowY:auto wrapper (NOT the panel)] → [main panel min(90vh,760px) overflowY:auto] → …`. The walk zeroes the SHORT intermediate wrapper (no vertical overflow → no visible effect) and `break`s BEFORE reaching the main panel the user scrolls. So guarding that onClick to "only reset on a real subtab change" is a **no-op** and must NOT be shipped as a fix (it was implemented, verified inert, and reverted this run).
   - The REAL cause is a panel `scrollTop` clamp on a re-render (cause b — island unmount/remount shrinking `scrollHeight`, or the `antcv-settings-front-327.js` position/z-index churn). **NOT reproducible headlessly with synthetic data:** with Personal/Layout mounted, the panel `scrollTop` held steady (300/259) for 4s under pure sidecar churn — no reset. Repro likely needs the owner's REAL data (taller content, more islands, real remount timing) or a real browser. **Owner-gated / needs a live repro** before any panel-side scroll-preserve fix (which touches the broad-observer island herd — blue-screen/loop risk per [[minified-mirror-shadow-hazard]]).

16. **DISCLOSURE-TRIANGLE-CONSISTENCY-001** `[SHIPPED 1.50.703]` — `antcv-disclosure-triangle.js` gives EVERY native `<details>`/`<summary>` collapsible the same ▸ (closed) / ▾ (open) marker as ADVANCED VISUAL STYLES (CSS-only, `color:inherit`, skips any summary that already has an inline triangle glyph so no double marker; ADVANCED VISUAL STYLES is a `<div>` so untouched). Headless-verified. Covers SPACING & INDENTS + all other native-marker collapsibles in one rule.

### C. NEW FEATURES (last)

17. **SECTION-LAYOUT-GRAPHIC-001** `[ALREADY SHIPPED 1.50.533 as SECTION-FORMAT-LEGEND-001 — verified 2026-06-19, row was STALE]` — the "how each looks" visual + the "selected bullets vs distributed results" explainer ARE present: `src/islands/shared/SectionFormatLegend.tsx` (`FORMAT_TILES`: Paragraph/Bullets/Emoji/Hybrid1-3/Table + an "Outcomes: bullets vs results" tile) is rendered in `LayoutPicker.tsx:122` (`<SectionFormatLegend title="What each format looks like"/>`) and present in the built `antcv-react-islands.js`. The only un-built sub-part is a per-ROW 'results' dropdown option (= OUTCOMES-FORMAT-RESULTS-OPTION-001), which the owner skipped 2026-06-19 (outcomes mode is set GLOBALLY by design). ORIGINAL (stale): The Section Layout control renders only a dropdown + slider + reset — NO "how each looks" visual (paragraph/bullets/table/hybrid thumbnails), and no explanation that SELECTED OUTCOMES can render as "selected bullets" vs "distributed results". `SECTION_FORMAT_OPTIONS` (`src/lib/writing-prefs.ts` ~395) has no 'results' option; the outcomes mode is set GLOBALLY (`__antcvOutcomesMode` `pwa/app.src.js` ~252, surfaced in the Layout card ~35160), not per-section here. Fix: add a small format-shape preview per row (PackagePicker's ShapePreview is a reference), a 'results' outcomes option for the outcomes row, and an explainer card. Island edit → `npm run build` (reproducible).

18. **OUTCOMES-FORMAT-RESULTS-OPTION-001** — add "Results" as a selectable Selected-Outcomes format (overlaps #17: wire the format-select 'Results' → outcomesMode).

19. **CL-FORMAT-CONTROL-001** — a cover-letter format control (academic + commercial).

20. **SUBSECTION-RENAME-REORDER-001** `[SHIPPED 1.50.702]` — rename + reorder subsubsections. RENAME already worked (inline-editable {group} subheadings); REORDER added via `antcv-subsection-reorder.js` (▲/▼ on each subheading move the whole {group} block; storage-driven, editor-only chrome, export unaffected). NOTE: the "controlled by writing style" aspect (style-driven default subsection order) is NOT implemented — this is the user-driven manual rename+reorder.

21. **EXPORT-PREVIEW-ZOOM-001** `[SHIPPED 1.50.701 as EXPORT-PREVIEW-ZOOM-002]` (owner 2026-06-15/re-requested 2026-06-19) — DONE: the modal now fits a whole A4 page (width AND height). The 2026-06-15 attempt collapsed because it measured the element height (= full multi-page doc after the 1.50.600 un-clamp); fixed by deriving one-page height from page WIDTH × A4 ratio (297/210). Screen-only; PDF unaffected. — the export-preview modal should ZOOM OUT more so the full A4 page fits in view (it currently shows the page too large / cropped). Tune the iframe fit-to-width (`antcv-pdf-preview-gate.js` `--antcv-fit` ~597) to fit the whole page height, not just width.

---

## SESSION REGISTRY — 2026-06-16 (owner-interactive, day-long) — 1.50.506 → 1.50.521 + access-relay + docx-worker 1.14.74

Status snapshot for the nightly run. PWA auto-deploys on push; access-relay + docx-worker manually deployed (green). Suite **308/308**, boot-smoke clean throughout, every item below verified headlessly before ship.

**KERNEL V2 — COMPLETE (the owner's `antcv-code-session-brief.md`).** Plan + full status: `docs/plan/KERNEL-V2-AND-INGESTION.md`.
- **Task 1a** — owner's `gabriel-kernel-v2.json` (12 roles) staged in D1 `user_kernel.kernel_v2` (new non-destructive column; wrangler write, length-verified). Re-uploaded 1.50.521.
- **§2 TENSE-RENDER-001** (1.50.515) — AUTO tense reads the per-role `isCurrent` FLAG (STORED WORK HISTORY tags `| CURRENT ROLE`), NEVER parses dates. D1 bridge sets `tenseMode`+`isCurrent` on the runtime kernel.
- **§3 LANG-CROSS-001** (1.50.516) — `__langRule` in the generation prompt: translate prose in-target, keep invariant classes (company/patent/metrics/tools/standards/pub-titles) verbatim, DA keeps idiomatic English titles.
- **§4 ingestion** (1.50.517 → 521 + access-relay) — `antcv-kernel-ingest.js` engine (extract→structural-infer→gap→merge, no fabrication, node-tested) + file→text (docx/pdf/txt/json) + `antcv-kernel-import.js` preview modal (roles/conflicts/gaps, keep-both-and-flag, metrics never overwritten) + **D1 persist** `POST/GET /api/profile/kernel-v2` + **merged entry button** (Settings + wizard import controls) + **reader bridge** `projectV2ToWorkHistory` → `personalInfo.workHistory` (import feeds GENERATION) + **auto-sync on login** (signature-guarded) + **structured date/metric apply** + **language-selection step**. Upload-test fixtures: `pwa/test/fixtures/kernel-v2/{gabriel,anita,devon}-kernel-v2.json` (`gen_test_kernels.mjs`).

**OWNER-DATA RECONCILIATION (D1 `user_kernel`).** 11→ reverse-chron roles: ADDED Security Guard (Tel Aviv) + Copenhagen Wolves (`foreningsarbejde`, `Pan Idræt Rugby`, RFC in content); SPLIT Meprolight → Team Leader + R&D Engineer (Raw CV); CORRECTED Kanzen (`Product / Project Expert — Kanzen Konsulenter ApS — 2022-2026`) + IDF (`Computer Systems Administrator — Israel Defense Forces`); reverse-chron sort, volunteer pinned last; tools group names; isCurrent = kanzen+wolves. See [[gabriel-cv-facts]].

**FEATURES / CONTENT shipped:** OUTCOME-ROLE-SELECT-001 (per-row position dropdown + ≥11 seeded outcomes, 1.50.506) → seed-union/gap-fill + dedup-hide bullet-derived-only + quality-toggle (507/508); ROLE-DECOMP-001 (un-merge in prompt+415; merge-order core-first; 508/510); CW-CANON-001 (merge the two Copenhagen Wolves variants, 415); PROFILE-END-COMMUNICATION-001 (509) + UNSOLICITED PROFILE text (514); GROUP-NAME-VISIBILITY-001 (1.50.512 + worker 1.14.74 — labeled_list `labelHidden`: single-group/tools-methods name-hide, preview + export, manual re-show); EXP-ORDER-ON-ADD-001 (new role auto reverse-chron, volunteer last, respects manual reorder, 513); SIDEBAR-NARROW-FIGURE-OVERLAP-001 logged (item 26, NOT STARTED). IDF-before-Kanzen DROPPED (owner: one-off).

---

## SESSION REGISTRY — 2026-06-15 (nightly autonomous, parallelised) — 1.50.486

- `TABLE-HEADER-MATCH-BAND-001` `[SHIPPED 1.50.486 — PWA-only]` — owner reply 2026-06-15: "match table header text and BG to candidate section text and header in both preview and export." The EXPORT already matched after COPENHAGEN-BLUE (worker `tableHeaderBg = band`, `tableHeaderText = readableInk(band)` = white = the candidate band). The PREVIEW did NOT: the two `<th>` cells (`app.src.js` ~5094/5115) read `k.tableHeaderBg`, but the resolved `k` style falls back to the pale `c` default (`#DDE6F2` + dark ink), so the preview table header was pale while the band was blue. Fix: drive both `<th>` from the band's own source — `background: "var(--header-bg)"`, `color: "var(--header-name-color, #fff)"` — so the table header BG+text equal the candidate band in every package (the band uses the same CSS var). Minified `app.js` mirrored (the inlined `readableInk` IIFE on `_.tableHeaderBg` replaced, 2 cells, count-guarded). Verified `diag-copenhagen-blue-preview` 7/7 (table header rgb(51,68,111) + white === band) and `diag-copenhagen-blue-cl` still 4/4 (export band+table = 33446F). No worker change.

## SESSION REGISTRY — 2026-06-15 (nightly autonomous, parallelised) — 1.50.485 + docx-worker 1.14.69

- `CL-EXPORT-EDGE-MARGINS-001` `[SHIPPED docx-worker 1.14.69]` — owner reply 2026-06-15: "0.07"→0.14" is a meaningful change." (The backlog's "current = 1 inch" assumption was wrong — actual `CL_SIDE_MARGIN` was 100 DXA / 0.07".) Doubled `CL_SIDE_MARGIN` 100→200 (0.14") in `buildLinearDocument`; the full-bleed header band follows via `-CL_SIDE_MARGIN`; the three `PAGE_W-200` body-width literals (signature right-tab 24912, CL table column width 25781, WHAT-I-BRING `defaultClW` 26092) → `PAGE_W-400` so the table still fits the narrower body. Verified `diag-cl-margins` 4/4: pgMar L/R=200 top=0, band `-200` indent (still full-bleed), WHAT-I-BRING tblW 9205 ≤ body 11506. CV two-column path untouched.
- `SECTION-RULE-INK-MATCH-001` `[SHIPPED 1.50.485 — PWA-only]` — owner reply 2026-06-15: "just a check that role text and its underline match." Diagnosis had inverted the premise (the SECTION-heading underline already matches `mainHeadColor` in all paths); the genuinely-decoupled rule is the per-ROLE divider. Fix: preview role rule `${s}`→`${k.mainSubHeadColor||s}` (app.src.js ~5454); buildHTMLDoc print role rule `f(t.mainLineColor,1,2)`→`f(t.mainSubHeadColor,1,2)` (~25306). Minified app.js mirrored with count guards (`${h}`→`${_.mainSubHeadColor||h}`; `m(t.mainLineColor,1,2)`→`m(t.mainSubHeadColor,1,2)`). Foundation + summary rules left on `mainLineColor` (owner asked for ROLES only). The worker export `renderExperience` has NO per-role underline rule, so this is preview + client-print only (no worker change). Verified `diag-section-rule-ink-preview` 4/4 (role title rgb(196,98,45) === role underline border).

## SESSION REGISTRY — 2026-06-15 (nightly autonomous, parallelised) — 1.50.484 + docx-worker 1.14.68

- `COPENHAGEN-BLUE-BRIGHTER-001` `[SHIPPED 1.50.484 + docx-worker 1.14.68]` — Copenhagen candidate band + table header navy `#283556` → brighter blue `#33446F`, CV + CL, preview + export at parity. Export: new per-package `band` token (`getPackageStyle` `headerBg`/`tableHeaderBg`/header text = `p.band||p.base`, in `src/palette.js` + the deployed `src/index.js` bundle); `readableInk(#33446F)` → white (9.56:1), band/table text stays white. Preview band: `--header-bg` CSS var in `antcv-packages-registry.css` `#283556`→`#33446F` (the real on-screen lever — the `va` `headerBg`/`tableHeaderBg` literals in app.src.js/app.js were mirrored to match but are not the active render source for the band). NOT touched: `UNIVERSAL_DARK_INK`, `DEFAULTS.navy`, `--main-head-color` (main-column section headings stay navy — parity, as the owner asked: only band + table header brighten). Verified: `diag-copenhagen-blue-cl` 4/4 (band+table fill 33446F, no 283556 fill, headings navy, white text), `diag-bundle-palette-sync` 5/5, `palette.test` 11/11, `diag-copenhagen-blue-preview` 5/5 (band paints rgb(51,68,111), `--main-head-color` stays navy, clean render), full suite 284/284. NOTE: the PREVIEW competency-table header renders pale `#DDE6F2` via a separate render path (not `#283556`), so the owner's "table header" request applies to the EXPORT (now 33446F + white text) — the pale preview table header is a pre-existing preview/export mismatch, left for a separate item.
- `CL-CONTACT-ONELINE-001` `[SHIPPED docx-worker 1.14.68 + preview parity 1.50.484]` — candidate contact-line separator `"   •   "` (3 spaces) → `" • "` (1 space) in `buildHeaderCell` so the address•EU-citizen•email•phone•linkedin row stays one line in the export; all items retained. Preview parity edit in app.src.js/app.js (HTML collapses the extra spaces, so the wrap was export-only). Verified in `diag-copenhagen-blue-cl` (contact row one line, single-space sep, 4 items present).

## SESSION REGISTRY — 2026-06-15 (owner: 11-role clamp + CL-dims diagnosis + parallel nightly) — 1.50.481 → 1.50.483

- `OUTCOMES-CLAMP-11ROLES-001` `[SHIPPED 1.50.483]` — owner: "my CV decomposes to ~11 roles (system architect, change-control lead, CRM/sys-admin split, research/teaching assistant, electro-optics engineer, team lead, security guard, frivilligt arbejde) — clamp should be larger." Raised the SELECTED OUTCOMES outcome clamp **7→12** at all 4 `Se()`/`rt()` sites (preview build + the two `outcomes_items` paths), mirrored source+minified with count guards. Updated the generation prompt cap rule "5 to 7 BULLETS / 7 maximum / 5–7 elements / best 5–7" → "5 to 12 … one outcome per active role, never collapse two roles into one outcome." So the pool can carry one quantified Result for every active role on a deep CV (coverage-first distribution then spreads them, 1-2/role). node --check both + 284/284 + parity grep. Cache-bust trio.
- `CL-TABLE-DIMS-FALLBACK-001` `[DIAGNOSED — see OPEN ISSUES]` — owner "CL export still ignores table dimensions." Traced the full chain (drag→store→buildPayload→deployed worker 1.14.67) and proved it CORRECT for both DOCX + server-PDF. The symptom is the export silently degrading to the client print fallback (`kl`→`buildHTMLDoc`), which is EXPORT-FALLBACK-ON-FIRST-001; the fallback builder ignores `clTableRatio`/`tableWidthPct`. NOT a dims-forwarding defect — no speculative export-chain patch shipped (protocol). Two real fixes recorded in OPEN ISSUES.
- `BACKLOG-REORDER-001 + 4 NEW ITEMS` `[REGISTERED — owner 2026-06-15]` — reorganised the OPEN ISSUES block into the owner's revised order: **CONTENT & EXPORT → SETTINGS MODIFICATION → NEW FEATURES**. Registered four new owner items with verified fix locations: `COPENHAGEN-BLUE-BRIGHTER-001` (candidate band/header + table header `#283556`→`#33446F`, CV+CL, preview registry + worker palette, NOT the dark ink), `SECTION-RULE-INK-MATCH-001` (main-column heading underline colour = heading text colour, e.g. teal), `CL-CONTACT-ONELINE-001` (tighten CL contact-line separators — worker sep `index.js` ~25201 `"   •   "`→`" • "` + preview parity), `CL-EXPORT-EDGE-MARGINS-001` (CL page edge margins ~1.5–2× in the export, keep lines tight). No code shipped this turn — queued for the parallelised automated session.

---

## SESSION REGISTRY — 2026-06-15 (owner real-export feedback) — 1.50.476 → 1.50.480

- `RECS-ORDER-MULTIPAGE-001` `[SHIPPED 1.50.476]` — the 1.50.473 recs-order fix stranded RECOMMENDATIONS at the foot of page 1 between the page-1 roles and the page-2 "(CONT.)". Now floors each after-experience section to the highest experience-role page → renders after the continuation on the last page. Verified headless (2-page experience: recs below the PAGE-2 marker + last page-2 role).
- `KANZEN-CANON-001 / PATENT-IN-ROLE-001 / sidecar-poll` `[SHIPPED 1.50.476]` — the multi-LLM CONSENSUS stage reintroduced role regressions the boot-sweep normaliser missed (it finished before generation). antcv-sections-normalize-415.js now: canonicalises Kanzen company ("Kanzen Konsulenter ApS", no "i nord") + end year 2026 (which lets dedupeRoles drop the duplicate Kanzen row); strips patent-NUMBER bullets out of roles; AND POLLS (setInterval 2500) + listens to `storage` so it re-runs on the post-generation write. Verified headless end-to-end on the exact bad role list (Founder gone, no i-nord, single Kanzen→2026, patent removed, System Architect merged).
- `PALETTE-PARITY-EXPORT-PREVIEW-001` `[SHIPPED 1.50.477]` — the export-preview modal renders in an iframe that copied the package CSS but not the `data-package` body attribute, so `body[data-package]{--sidebar-bg}` never matched and the sidebar fell back to navy (DARK). Now carries data-package(+dark-mode) onto the iframe body. Verified headless: iframe --sidebar-bg = #DCE5EA (pale), not navy.
- `OUTCOMES-METRIC-PROMPT-001` `[SHIPPED 1.50.478 — owner verify on regen]` — the consensus `reinforce` step degraded SELECTED OUTCOMES into bullet-restatements. Hardened the reinforce + main generation prompts: outcomes are QUANTIFIED PROOF POINTS (must carry a number/%/count/timeframe/scale, never restate a bullet; if a signal adds no metric, keep the original). Added a rule: patents go ONLY in PUBLICATIONS & PATENT, never role bullets. Prompt-only (LLM behaviour) — node --check + 284/284 + boot-smoke; output quality owner-verified.
- `FOUNDED-ESTABLISHED-001 / CUST-CHANGE-DUP-001` `[SHIPPED 1.50.479]` — normaliser: a role bullet "Founded …" → "Established …"; drop the duplicate "Customer Change Requests Specialist" role when a "Change Control" role exists at the same company (dedupeRoles couldn't catch it). Verified headless.
- `TABLE-RATIO-PARITY-001` `[SHIPPED docx-worker 1.14.67]` — the competency / What-I-Bring table Focus-Area ratio default was 0.30 in the worker but 0.25 in the live preview, so the export's first column was wider and the Expertise cells wrapped. Worker → 0.25 (forwarded s.tableRatio still wins). diag-cv-table-width CHECK E updated 7/7.
- `OUTCOMES-RESULTS-PAGE2-001` `[SHIPPED 1.50.480]` (owner CRITICAL) — Results were missing from page-2 roles: CAP=2 let a page-1 role hold two outcomes while the spill only redistributed overflow. CAP 2→1 (preview + export) → outcomes spread to the emptiest roles, covering page-2 roles, each ~one line. Verified headless: 5 outcomes / 5 roles (2 page-2) → every role incl. Meprolight + IDF carries its matched result.
- `ADV-VISUAL-DISCLOSURE-001` `[SHIPPED 1.50.480]` — "ADVANCED STYLES" → "ADVANCED VISUAL STYLES" with a clear left ▸/▾ disclosure triangle; removed the confusing right "u/v". Verified headless.
- `OUTCOMES-RESULTS-COVERAGE-001` `[SHIPPED 1.50.481]` (owner "1-2 per role, last 2 roles still empty") — coverage-first distribution (retention 1 → pass 0 covers every empty role → pass 1 gives strong roles a 2nd; 1-2 per role, every role first) + outcome cap 5→7 (4 Se(…,5) clamps + the generation prompt asks for one quantified outcome per major role). Verified headless: 7 outcomes / 7 roles (3 page-2) → all 7 carry their matched result.
- `EXP-TENSE-OUTCOMES-001` `[SHIPPED 1.50.482 — owner verify on regen]` — the FORCED PRESENT/PAST tense rule now also forces the SELECTED OUTCOMES leading verbs, so the per-role Results follow the chosen tense (was bullets-only → Results stayed past). Prompt-only. See EXP-TENSE-NOT-APPLYING-001 in OPEN ISSUES for the control-location half (tied to item b).

---

## SESSION REGISTRY — 2026-06-14/15 — 1.50.468 → 1.50.475 + docx-worker 1.14.64 → 1.14.66

Owner-driven batch + a nightly autonomous job set up. Every fix verified by a headless render
PAST the sign-in gate (not boot-smoke) or a unit/worker diag before deploy; pushed to `main` only
(mirror branches retired). The minified-mirror-shadow-hazard bit twice and was caught both times
(see that memory — de-min names ≠ minified names; anchor on string literals, copy blocks verbatim).

**Fixed + shipped this session:**
- `LAYOUT-BATCH-1..5` `[SHIPPED 1.50.469 + worker 1.14.64]` — CL signature + AI-assisted on ONE line; sidebar sections keep-together (cantSplit) so a short block moves whole to the next page; experience bullets tighter line (252); WHY-YOUR-COMPANY heading for unsolicited; HIWC intro orphan trim.
- `CL-PROMPT-WHO-WHY-001` `[SHIPPED 1.50.470]` — WHO I AM end-on-a-full-line orphan guard; WHY content must not narrow to "the work I do best: electro-optics" (frame the breadth).
- `ADV-SPACING-PANEL-001 / BULLETGAP-001` `[SHIPPED 1.50.471 + worker 1.14.65]` — collapsible "SPACING & INDENTS" group (area-labelled) + new bullet marker-to-text gap, wired preview + worker.
- `ADV-STYLES-MERGE-001` (backlog item 14) `[SHIPPED 1.50.472]` — Line Targets + Section Formats merged into Section Layout; the two standalones removed; LayoutPicker re-anchored on a thin `data-antcv-format-prefs` div, no island rebuild.
- `RECS-ORDER-PREVIEW-001` (backlog item 8) `[SHIPPED 1.50.473]` — RECOMMENDATIONS rendered before PROFESSIONAL EXPERIENCE in the preview (state + export were correct). The main column composed [all non-exp sections]→[experience]; now splits oMain by document position relative to the experience anchor (before/after) in both layout branches. Verified headless.
- `OUTCOMES-RESULTS-ORIGROLES-001 / BESTMATCH-001` (CV results) `[SHIPPED 1.50.474]` — same outcome on multiple roles (linear preview rendered per-role with roles:[t], no __antcvOrigRoles → each role distributed over itself) + wrong role (first-token-match). Forward the full role list; assign by MOST shared tokens (best-match). Preview + export. Verified headless: each outcome on its correct role, no cross-role dup.
- `PHOTO-BRIDGE-EXPORT-001` (backlog item 4) `[SHIPPED docx-worker 1.14.66 — owner PDF verify owed]` — the band-overlap "Sidebar bridge" medallion exported flat at sidebar-top: layoutInCell defaults TRUE in the docx lib, clamping the float inside the sidebar cell so its negative lift couldn't rise into the band. Fixed: layoutInCell:false + PAGE-relative horizontal (sidebar-column centre). diag-photo-bridge-export extended (layoutInCell="0" + PAGE-relative H) + 69/69 worker tests. Vertical seam alignment needs an owner PDF check to fine-tune.
- `WIB-TABLE-DIMS-001` (backlog item 5) `[SHIPPED 1.50.475]` — the CL WHAT I BRING table (and CV Core Competencies) exported at the worker's default width/split, ignoring the dimensions dragged in the preview. `buildPayload`/`normalizeSections` now forwards per-section `tableWidth` (from stylePrefs.tableWidthPct[id], non-default only) + `tableRatio` (clTableRatio/cvTableRatio). The worker already reads s.tableWidth/s.tableRatio. Verified END-TO-END: new table-dims-forward.test.mjs 6/6 (client forwards) + a worker-XML check (forwarded 7202/0.4 → gridCols 2881+4321=7202). PWA-only, no worker redeploy.
- `NIGHTLY-001` `[SET UP]` — persistent scheduled task `antcv-nightly` (~02:46 local daily) runs the backlog autonomously with the full ship discipline + verify-before-ship safety valves. First run pauses on tool approvals → owner should "Run now" once to pre-approve.
- `PDF-LAYOUT-001` `[INVESTIGATED — no concrete repro, NOT shipped]` — "stray SELECTED OUTCOMES heading on PDF p2". The section-wrapper merge that repeats a tblHeader is already guarded by the separator paragraph (PB-WORKER-CONT-HEADER-001) and SELECTED OUTCOMES is too short to span; could not reproduce in the worker XML. Left open rather than ship a speculative pagination change (needs an owner PDF that exhibits it). PDF-LAYOUT-002 + CONTACT-LINE-DENMARK-001 + banded-rows confirmed ALREADY SHIPPED (1.14.54 / 1.50.456 / 1.14.63).

---

## SESSION REGISTRY — 2026-06-14 (continued) — 1.50.446 → 1.50.455

Desktop session. Copenhagen palette + export + outcomes + crash-recovery work. Every fix
verified by a headless render or unit test before deploy; pushed to main + the two mirror
branches each ship. Tests live under `pwa/test/` and `workers/proxy/test/`.

**Fixed + shipped:**
- `PALETTE-REGION-TOKENS-001` `[SHIPPED 1.50.446]` — fixed the INVERTED Copenhagen preview (candidate band was pale, sidebar dark). Band/strips → `var(--header-bg)` (dark per package), sidebar → `var(--sidebar-bg)` (pale); the 329 sidecar no longer hard-codes navy. diag-copenhagen-palette.
- `OUTCOMES-RESULTS (preview)` `[SHIPPED 1.50.447]` — dedup vs the role's own bullets, cap 2/role, spill into the emptiest roles first (first role no longer starved), 180-char budget, only the "Results:" label bold, patent filtered. diag-outcomes-results 6/6.
- `PERSONAL-CARDS-VERTICAL-001` `[SHIPPED 1.50.448]` — "Languages in the top bar" panel full-width (no horizontal stacking beside Done).
- `SIDEBAR-INK-MATCHES-PAINT-001` `[SHIPPED 1.50.449]` — sidebar body text keyed on the resolved `--sidebar-bg` → dark/readable on the pale ground (was white-on-pale).
- `ANALYSIS-SALARY-001` `[SHIPPED 1.50.450 + proxy/demo-proxy deploy]` — JD analysis returns a `salary_estimate` (stated parse OR an honest market estimate); Analysis panel renders it. jd-analysis-salary 18/18, diag-analysis-salary 4/4.
- `TABLE-HEADER-INK-001` `[SHIPPED 1.50.451; HOTFIX 1.50.452]` — Core Competencies header text was navy-on-navy invisible → `readableInk(tableHeaderBg)`. 451's minified mirror called a shadowed `f` and CRASHED the editor on table render; 452 inlined the luminance check. (See the minified-mirror-shadow-hazard lesson.)
- `OUTCOMES-RESULTS-EXPORT-PARITY-001` `[SHIPPED 1.50.451]` — the EXPORT `applyOutcomesMode` (docx-client) brought to parity with the preview (dedup/cap/spill/budget). applyOutcomesMode.test 6/6.
- `EXPORT-PALETTE-PARITY-001` `[SHIPPED 1.50.453]` — export `buildStyle` resolves panel backgrounds from the `--sidebar-bg`/`--header-bg` tokens → exported sidebar PALE + candidate band navy with WHITE text (was dark sidebar + invisible candidate text). buildStyle-palette test.
- `OUTCOMES-RESULTS-EDIT-001` `[SHIPPED 1.50.454]` — the per-role Results line is now an editable `contentEditable` span; edits persist per role to `antcv:resultsOverride` and are preferred on render.
- `SIDEBAR-LABEL-PDF-WHITE-001` `[FIXED 1.50.455]` — the bold sidebar field LABELS rendered white on the pale sidebar in the PDF (`sidebarLabelColor` defaulted white in the worker). `buildStyle` now sets `sidebarLabelColor` to the dark readable ink. buildStyle-palette 6/6. **Re-verify in a real PDF export, desktop + mobile.**

- `OUTCOMES-MODE-PARITY-001` `[FIXED 1.50.459 — needs real-export verify]` — owner 2026-06-14
  ("still exporting selected outcomes instead of results"): the EXPORT `applyOutcomesMode`
  defaulted to `'section'` when no `outcomesMode` was stored, but the PREVIEW
  (`__antcvOutcomesMode`, app.src.js ~252) defaults Copenhagen Modern (incl. the empty/
  'scandinavian' aliases) to `'results'`. So on Copenhagen with no explicit setting the preview
  hid SELECTED OUTCOMES (per-role Results) while the export still emitted the OUTCOMES block.
  The export now mirrors the preview default exactly (reads `stylePackage`; copenhagen → results,
  else section; an explicit `outcomesMode` still wins). `outcomes-mode-forward.test.mjs` updated
  4/4 (copenhagen default → results; non-copenhagen → section; explicit modes unchanged).
- `PLACEHOLDER-EXPORT-GUARD-001` `[FIXED 1.50.458 — needs real-export verify]` — owner 2026-06-14:
  an unsolicited CL exported with the literal skeleton placeholder "[WHY THIS POSITION — 1-2
  sentences …]" because the generation left `why_content` empty and the bracket placeholder
  leaked into the finished document. `normalizeSections` (export `buildPayload`) now treats a value
  that is ENTIRELY one bracketed `[…]` placeholder as empty (text content, text_bullets
  intro/items/closing, foundation hands_on/professionally) and DROPS a text section that is empty
  after stripping — so neither the bracket text nor an orphan heading exports. Inline brackets in
  real prose ("[change control board]") are untouched. `placeholder-export-guard.test.mjs` 4/4.
  Covers the worker DOCX + /generate-pdf paths (the owner's exports go through the worker — banded
  rows proved it). NOTE: still shown (greyed) in the live editor by design; only suppressed on
  export. **B7 follow-up:** the header-center code is present on ALL export paths (worker DOCX +
  HTML print both emit center) and the preview sidecar skip shipped 1.50.457 — owner's left headers
  are most likely a stale cache; hard-refresh to confirm.
- `TABLE-HEADER-CENTER-001` `[RE-FIXED 1.50.460 — real root cause]` — owner re-confirmed 2026-06-14
  "headers still LEFT in preview, centered in export". The 1.50.457 section-align skip was the WRONG
  lever. The REAL preview aligner is `antcv-core-competencies-row-controls-234.js`: `applyPreview()`
  forces `getAlign(row)` onto every `th/span` in the header row each sweep, and `getAlign` defaulted
  ALL rows (incl. row 0, the header) to `'left'`. Fix: `getAlign(0)` now defaults to `'center'`
  (body rows stay left; an explicit CJLR choice still wins). Export was already center on every path
  (worker DOCX `<w:jc center>` + HTML `text-align:center` — both verified), which is why they
  diverged. `table-header-center.test.mjs` extended 3/3. NOTE: the header CJLR being unable to
  RE-position (B8) is a separate enhancement — row 0's own controls are intentionally stripped and
  the app's section-level CJLR doesn't drive this sidecar's row-0 map yet.
- (superseded) `TABLE-HEADER-CENTER-001` `[1.50.457 section-align skip — wrong lever, kept harmless]` — B7: table headers
  rendered LEFT instead of centered. The React `<th>` is `textAlign:center`, but the section-align
  sidecar's reapply pass forced EVERY editable target to the section alignment (default `'left'`),
  overriding the header center each MutationObserver pass. `applyAlignmentToSection` now SKIPS
  `<th>`-contained editables — the header keeps its center and is owned by its own per-header
  control; body cells/text still follow the section cycler. Export already centers
  (worker `s.headerAlign || "center"`; client never sends a header override). PWA-only, sidecar
  edit (no app.js mirror). `table-header-center.test.mjs` 2/2 + boot-smoke. No jsdom harness in the
  repo, so the rendered result wants the owner's eye.
- `TABLE-BANDED-ROWS-001` `[FIXED docx-worker 1.14.63 — DEPLOYED; needs real-PDF verify]` — A3:
  the exported table zebra was "missing the banded-row colours seen in preview". The worker
  banded the WRONG rows (odd data rows) with a near-invisible `FAFAFA`, while the React preview
  (`app.src.js` ~5149) bands EVEN data rows with a visible pale teal `#eaf7f7`. Worker
  `makeDataRow` now matches: even data rows → `EAF7F7`, odd → none. Covers CV competencies + CL
  What-I-Bring (shared `renderCompetencyTable`). `test/diag-banded-rows.mjs` (4 band fills, 0
  FAFAFA) + cv-table-width regression green. Re-verify in a real PDF.
- `EXPORT-PALETTE-FALLBACK-001` `[FIXED docx-worker 1.14.62 — DEPLOYED; needs real-PDF verify]` —
  the DEPLOYED worker bundle (`src/index.js`) inlines a COPY of `src/palette.js`, and that copy
  had drifted to the pre-fix Copenhagen palette: `getPackageStyle` returned `sidebarBg: base`
  with white sidebar text/labels and no `tableHeaderText`. The source `palette.js` was already
  corrected (1.50.438/SANDBOX-B) but the bundle was never resynced, so whenever an export payload
  omitted an override token the candidate / sidebar text rendered WHITE-on-pale (invisible) — the
  fallback half of the A2 PDF-text bug. FIX: synced the bundle's inlined palette to `palette.js`
  (copenhagen `ground: C9D6EC`; added `readableInk` + `UNIVERSAL_DARK_INK`; `getPackageStyle` now
  derives `ground`, uses `readableInk(ground)` for sidebar text+labels, keeps the candidate band +
  table header on dark `base` with luminance-picked ink, adds `tableHeaderText`). New
  `test/diag-bundle-palette-sync.mjs` 5/5 locks bundle≡source; palette drift 11/11 +
  diag-twocol-ownerlike still render-green. Client payload overrides (453/455) still win when
  present. **Deploy docx-worker + re-verify in a real DOCX/PDF.**

**ACTIVE_BUGS recovery:** this file's historical body + the 2026-06-14 bug-intake block were restored from the desktop handoff's authoritative copy (verified superset of the local day-2 content; the prior remote clobber to `PLACEHOLDER` is moot — this is the full tracker).

**Still OPEN — full prioritized list in the `antcv-open-backlog` memory:** `CONTACT-LINE-DENMARK-001` (contact must read "2300, København S", no country); PDF re-verify (candidate white text, banded rows, photo-bridge); What-I-Bring exports stale dimensions; CL text edge margins (match CV main inset); table headers center by default + movable CJLR buttons; Recommendations renders before Professional Experience in PREVIEW; HIWC word/char count off by 1–2; watermark → lower part of the lighter final column; the CV-data merge + generation-prompt hardening; Settings-UI cluster; `GRAMMAR-MARKER-SCROLL-LAG-001`; `DOC-WIDE-CHATBOT-001` (mobile); `TASK-CUSTOM-LLM-OVERHAUL-001`; `PDF-LAYOUT-001/002`.

---

## SESSION REGISTRY — 2026-06-14 — bug intake (owner-reported)

### SIDEBAR-LABEL-PDF-WHITE-001 — sidebar field labels render white in exported PDF
- **Status:** [ ] OPEN (High) — reported by owner, screenshot attached (mobile PDF viewer, page 1).
- **Symptom:** In the exported PDF, the bold sidebar field labels ("Project Workflow:", "Reporting & Data:", "Architecture:", "Methods:", "Domain:", "Engineering:" under TOOLS & METHODS, and the equivalent labels in every other sidebar section) render in WHITE on the light-grey sidebar background, making them effectively invisible. Only the value text after each label is dark/legible.
- **Expected:** Sidebar non-heading label text must be DARK (legible on the light sidebar). Per CV design spec, sidebar BODY content sits on the light-grey sidebar fill — labels included — and must use a dark colour, not white. White is reserved for content on the navy band (#283556); it must not leak onto the light sidebar in the PDF path.
- **Scope:** PDF export only (per report). Must re-verify against Preview and DOCX — labels must be dark in all three, desktop + mobile. Affects ALL sidebar sections, not just TOOLS & METHODS.
- **Likely cause:** PDF render path inherits a white label colour (probably the navy-band/header label rule) instead of the sidebar-body dark colour; or label spans lack an explicit dark colour and fall through to a white default in the PDF stylesheet/worker.
- **Fix direction:** force sidebar label spans to the dark sidebar-body colour in the PDF export stylesheet; confirm the rule is scoped to the light sidebar and does not regress labels that legitimately sit on the navy band. Then verify Preview + DOCX + PDF parity (QA core rule).

### CONTACT-LINE-DENMARK-001 — contact line shows "Denmark", spec requires district-only
- **Status:** [x] FIXED 1.50.456 — export path now mirrors the preview's Danish local-form.
  ROOT CAUSE: the preview (`app.src.js` `pe`/`__localForm`) normalised the contact location to
  "2300, København S" but the EXPORT path (`antcv-docx-client.js buildPayload`) sent
  `personalInfo.location` RAW to the worker, so the DOCX/PDF rendered the stored
  "2300 København S, Denmark" verbatim. FIX: added a `localForm()` helper to the export payload
  builder (strips denmark/danmark, København-izes, and — new — inserts the comma when a postcode
  is already present: "2300 København S" → "2300, København S"); the same comma-insertion branch
  was added to the preview `__localForm` (app.src.js + minified app.js mirror) so a stored
  postcode form also normalises in Preview. Verified `pwa/test/unit/contact-line-denmark.test.mjs`
  8/8 (raw, da spelling, bare city/country, non-default district keeps district + gains comma,
  non-CPH untouched, no country-word leak, src↔minified parity) + boot-smoke. **Re-verify in a
  real DOCX + PDF export, desktop + mobile** (worker renders the field as-is; no worker change).
- **(orig) Status:** [ ] OPEN (Low) — reported by owner, same screenshot (header contact line).
- **Symptom:** The header contact line reads "2300 København S, Denmark".
- **Expected:** Per owner spec the location token must read "2300, København S" — postcode + comma + district, no country. Never "Copenhagen, Denmark" and not "København S, Denmark".
- **Scope:** Header contact line. Verify Preview + DOCX + PDF parity, desktop + mobile. Check whether the literal string is stored in personalInfo/contact data (data fix) or assembled at render with a hardcoded ", Denmark" suffix (template fix). If the EU-Citizen / @-handle tokens are assembled in the same string builder, fix there so all CV/CL surfaces match.
- **Do not bundle** with SIDEBAR-LABEL-PDF-WHITE-001; separate cause, separate verify.

# AntCV — Active Bug Tracker

## SESSION REGISTRY — 2026-06-13 (continued, day 2) — 1.50.418 → 1.50.439

Body restored from blob `b7930cf` (the last known-good full version) and this
block prepended with the day-2 work — per the owner's "restore + merge". The full
historical body (2026-06-03 → 1.50.417) follows below unchanged.

**Fixed + shipped:**
- `SIDECAR-CONSOLIDATE G2/G5/G10/G6` `[SHIPPED 1.50.418/419/428/429]` — section-panel (206/207/208→211), mobile-ui (4→1), photo trio (position+pentagon+bridge→one), language prefs/filter trio merged behind ONE shared rAF scheduler + ONE MutationObserver each. 13 files → 4.
- `PERSONAL-ORDER-002` + `TENSE-STICKY-FIX-001` `[SHIPPED 1.50.427]` — Personal subtab order set to the owner figure (Background→CV Sidebar→Languages→Tense→Advanced Tone→Banned Words); the EXPERIENCE TENSE control removes itself off-Personal (no longer sticky).
- `AUTO-PAGEBREAK-BLOCK-001` (b) `[SHIPPED 1.50.430]` — photo medallion now carries onto page 2+ in the slim repeat-header strip; (a) eff page-labels + (c) export reconcile verified already in place.
- `WIZARD-002` `[CLOSED 1.50.431]` — settings hand-off ("WHERE TO CUSTOMISE NEXT") on the final wizard slide. `WIZARD-LANG-SELECTOR-001` re-confirmed already shipped 1.50.412 (two-table reorderable selector); stale registry lines corrected.
- `PREVIEW-CHATBOT-001` re-confirmed already shipped 1.50.412 (stale "not started" corrected); `CHATBOT-DEMO-PROXY-001` `[FIXED 1.50.437]` — the chatbot now falls back to the access relay so DEMO users can use it.
- `CLOUD-RESTORE-MERGE-LEAK-001` `[FIXED 1.50.432]` — the Gabriel/Anita specialization leak: `signOut()` already clears localStorage, so the bleed was cloud-restore's field-by-field `fillMissing`. Restore now REPLACES `personalInfo` wholesale when the cloud copy is substantive (sparse cloud still falls back to fill). diag-cloud-restore-no-merge 3/3.
- `JD-URLFETCH-GARBLED-MSG-001` `[FIXED 1.50.433]` — a URL JD fetch (jobs.nvidia.com) wrongly showed the PDF "garbled font encoding / open the PDF" remediation. URL fetches now get URL-aware guidance (JS-rendered page → paste into Additional Signals or save/print the page to a PDF). (Worker-side actual fetch of JS-rendered pages tracked separately.)
- `LANG-UK-US-DICT-001` `[CLOSED 1.50.434]` — SPELLING relocated out of Account into a collapsible `<details>` under the Languages card (Settings → Personal); English defaults to **UK (en-GB)**, **US (en-US)** added via a UK/US selector; dictionaries follow the document language. diag-spell-relocate-variant 5/5.
- `SPELL-ZH-CONTEXT-001` `[SHIPPED 1.50.435]` — Chinese **symbol-in-sentence fit**: Hunspell can't segment Chinese, so zh uses an AI proofreader for 错别字 (wrong/context-unfitting characters) → underlines + click-to-correct, editor + preview, zh-only, cached. diag-spell-zh-context 4/4.
- `PW-CJLR-PHOTO-LEAK-001` + `LAYOUT-DEAD-COUNT-001` `[FIXED 1.50.436]` — the redundant blinking button between SHADOW Off/On (the profile-workstyle CJLR cycler matched the "PROFILE PHOTO" card and the photo-bridge sidecar stripped it back); and the dead "N on" EXPORT OPTIONS count chip removed (React island rebuilt).
- `COPENHAGEN-PALE-001` (SANDBOX item B) `[SHIPPED 1.50.438 + docx-worker deploy]` — Copenhagen Modern sidebar/band/table headers go pale (#DDE6F2) with dark ink. `readableInk()` luminance-aware ink in preview + export + worker; the worker palette gains a `ground` field so the pale panel is decoupled from `base` (which still drives main-column headings). Palette test 11/11. Owner visual verify owed (DOCX/PDF, both layouts).
- `PERSONALITY-KERNEL-QUIZ-001` `[SHIPPED 1.50.439]` — an 8-question deterministic quiz builds `personalInfo.personality` (six trait clusters with generic behaviour-evidence + an assembled work-style line + render constraints) and shows the user a written response. Settings → Personal "PERSONALITY KERNEL" card + a wizard-slide button. The kernel itself (GABRIEL_BG injection) already shipped 1.50.403. diag-personality-quiz 4/4.
- Docs: `docs/marketing/PROBLEM_STATEMENTS.md` (Terence design-thinking framing — general + per-persona + v~300 issues), `docs/personas/devon/` (software career-changer persona), Gabriel kernel de-leak (specialization → "Process · Products · People"; AntCV under the Kanzen experience entry; no Anita-domain bleed).
- Sandbox handoff (`SANDBOX_STUCK_CHANGES_2026-06-13`): **Item A** (build:app terser, not esbuild) and **Item C** (experience-tense AUTO per-role logic) verified ALREADY done; `pwa/mcp-probe.html` verified ALREADY removed (only index.html ships).

**Still OPEN (carried to next session):**
- `GRAMMAR-MARKER-SCROLL-LAG-001` `[OPEN][mobile]` — the grammar/spell underline markers lag or misalign against the text while scrolling on mobile (overlay re-sync on scroll/touch-move).
- `DOC-WIDE-CHATBOT-001` `[OPEN]` — an always-visible "Ask AI" launcher + a document-wide chat with cross-section apply (also the reliable mobile entry, since the per-element pill needs a text selection that collides with the browser's long-press). Next build.
- `TASK-CUSTOM-LLM-OVERHAUL-001` `[OPEN]` — key-only add, relay persist of `antcv:customLlms`, per-task model mapping, and wizard/proxy management. `LLM-ONBOARD-001/002` (1.50.412/414) built the core: model discovery (`{base}/models`) + auto-audit-on-save + dispatch of approved custom LLMs.

---

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

---

Living list of open issues. Newest section at top. Mark items `[FIXED]`, `[VERIFYING]`, or `[OPEN]`.
This file now folds in the canonical `AntCV_UI_UX_Spec_and_QA_Plan_v4.docx` backlog (see "QA SPEC BACKLOG" below) so there is a single working list. The .docx remains the source of full prose detail; a machine-retrievable ID index lives alongside this file at `docs/qa/AntCV_QA_backlog_index_v4.md`.

A companion **feature registry** (open vs shipped features) lives at
`docs/FEATURES_REGISTRY.md`.

---

## RECONCILED 2026-06-12 (PM) — build:app fix + stale-tag sweep

Code change this pass + a status sweep of buried `[OPEN]` tags that later commits
resolved without re-tagging the old line. Where this block disagrees with an older
buried tag, this block wins.

**Code shipped (verified, no app.js change):**
- **BUILD-APP-BROKEN-001 / APPJS-REBUILD-001 → FIXED.** `package.json` `build:app`
  repointed from esbuild `--minify` (unsafe — prepends `"use strict"`, blue-screens the
  sloppy-mode bundle) to `npx --yes terser pwa/app.src.js -c -m -o pwa/app.js`. Identity
  round-trip gate PASSED: `npm run build:app` on the unedited source reproduces the
  committed `pwa/app.js` **byte-for-byte** (871,787 B, `cmp` clean), `node --check` OK,
  starts `(()=>{`, 0 `"use strict"`. `app.src.js` has no drift from `app.js`. `glDemo` is
  already `window.glDemo` (explicit). Source edits can now use the standard rebuild.

**Confirmed already-done (doc tag was stale / triage misread):**
- **DOCX-EXPORT-CORS-CPU-001** — client side is done (1.50.244/248): `describeNetworkFailure`
  readable message + `/health` warm-up + single retry + 413 special-case, surfaced via
  `alert(e.message)` on all four export paths. Correctly `[MITIGATED]` below; only the
  Workers-Unbound infra decision is residual (owner's).
- **AUTO-PAGEBREAK-CV-MIDGROUP-001** — the "measure against PDF-equivalent heights" fix
  landed as the **dual-map measurer** (e50973f / 1.50.350): preview map and export map each
  use their own A4 line. Owner export-verify owed (see updated entry below).

**Stale `OPEN` tags — ALREADY SHIPPED (don't chase the buried old lines):**
- SETTINGS-NAV-Z-001 / SETTINGS-SUBTAB-001 / APP-HISTORY-001 → **1.50.355** (`5cc08f5`)
- PRIVACY-DEMO-001 → **1.50.356** (`073de89`) · HOWCONTRIBUTE-001 → **1.50.354** (`bbf4d59`)
- GEN-UNSOL-002 → **1.50.358** (`ea30b2f`) (+ GEN-UNSOL-003 @ 1.50.391)
- PERF-003 / PERF-004 → **1.50.359** (`300cadc`) (PERF-002/005 deferred)
- PB-WORKER-SIDEBAR-FILL-001 → **1.50.320** (per-page; recent strata already corrects it)

**Still genuinely open (code):** PB-PREVIEW-GROUPNAME-EDIT-001
(inline preview group-name edit doesn't persist), LOGIN-GATE-001 (boot-order; largely shipped
via login-gate 302/303 + clean-reload 347 + the loading-gate loader — owner live-boot verify
the residual; app-shell path, diagnostic-first, do NOT blind-edit). Open features:
WIZARD-LANG-SELECTOR-001 (two-table upgrade), PROCESSING-QUEUE-INDICATOR-001.
*(2026-06-12 same-day correction: PB-WORKER-SIDEBAR-CONT-001 / PB-WORKER-SIDEBAR-PAGINATION-001
were re-verified FIXED this session — diag-sidebar-cont-e2e + diag-sidebar-export-page +
diag-twocol-ownerlike all green; see their updated entries below.)*

---

## AUTONOMOUS RIDE 2026-06-11 (PM) — photo-position exports + export-preview print + share target

Shipped 1.50.372→375 + docx-worker 1.14.53. Full narrative in
`docs/plan/NIGHT_RUN_2026-06-10.md` rounds 4–7.

- **EXPORT-PHOTO-POS-CLAMP-001** `[FIXED 1.50.373 — headless-verified]` — the REAL root
  cause of "bridge not in PDF/DOCX": `antcv-docx-client.js readPhotoPosition`'s VALID set
  lagged the app's picker. `band-overlap` was missing, so the client clamped every bridge
  export to `sidebar-top` BEFORE the payload left the browser (live-worker probes bypassed
  the client, which is why the worker always looked correct). `none` (the picker's Hidden
  value) was missing too, so a HIDDEN photo still exported. VALID is now a picker superset;
  `none`→`hidden`; photoSizePx forwards for every visible position. Locked by
  `pwa/test/unit/photo-position-forward.test.mjs` (imports the real module).
- **PHOTO-POSITIONS-EXPORT-001** `[SHIPPED worker 1.14.53 — needs owner Word/PDF look]` —
  export halves for the 1.50.371 picker positions: main top L/R switch from the photo-row
  table to a FLOATING wrapSquare image (text reclaims full width below — the preview
  crescent); main bottom L/R inline after sections; bridge-middle/bottom floating medallion
  page-anchored on the vertical seam (centre / 24px above bottom), wrap both sides.
  `workers/docx-worker/test/diag-photo-positions-export.mjs` (9/9). Deployed + live-probed.
- **EXPORT-PAGE2-001** `[FIXED 1.50.374]` — see the updated entry in the QA backlog section.
- **SHARE-TARGET-JD-URL-001** `[SHIPPED 1.50.375 — owner device verify owed]` — manifest
  share_target + `antcv-share-target-jd-375.js`; see FEATURES_REGISTRY (CLOSED).
- **PDF-BLANK-PAGE-001** `[FIXED docx-worker 1.14.54 — live-verified]` (owner 2026-06-11
  evening: "in the pdf there also is a blank page in middle" + lost REGULATORY CONTEXT
  heading/group label; = PDF-LAYOUT-002 in the QA index). The per-page body-row minimums
  filled each sheet EXACTLY (header budget + 13860 = 16838; PAGE_H−200). Word tolerated
  that; LibreOffice (/generate-pdf) renders the candidate band + row a sliver taller, so
  EVERY stretched row overflowed its sheet — the row split, its empty tail rendered as a
  blank page after each content page, and on page 1 the split swallowed the last sidebar
  lines. Reproduced live (2-page CV → 5 PDF pages, 2/4 blank); fixed with real slack
  (PAGE1_BODY_MIN 13260, CONT_BODY_MIN PAGE_H−600); re-probed live → 3 content pages, no
  blanks, heading + group label intact on page 1. Navy bar now stops ~0.5–1cm above the
  page edge — the cost of never overflowing LO. The owner's other observation (Customer
  Change role + ASPICE jumping a page earlier in the PDF than the preview) is the export
  break-map budget being more conservative than the preview's — EXP-PREVIEW-GAP-001
  territory, addressed upstream in e50973f the same day; re-export on a fresh tab to pick
  both halves up.

## INCIDENT 2026-06-10 (NIGHT) — production down: 7-byte app.js stub

- **PROD-STUB-001** `[RESOLVED — bbde379]` — a concurrent session's commit 7e8c584
  (EXP-HIDDEN-ROLES-001) committed pwa/app.js AND pwa/app.src.js as **7-byte stubs**
  (a redaction artifact from that environment's git filter), pushed to main, and it
  auto-deployed → live antcv.pages.dev/app.js served 7 bytes → **blank/broken PWA for all
  users (~1h)**. Detected via `git cat-file -s` (7 bytes) + live curl (7 bytes). RESTORED:
  committed the real 852KB bundle + real 1.98MB app.src.js from the last good commit 3268202
  on top of 7e8c584 (fast-forward, no force) → bbde379; PWA redeployed; live app.js back to
  852,577 bytes (verified). EXP-HIDDEN-ROLES-001's real source was never in git (stubbed),
  so it must be re-applied by its author. PREVENTION: see the guardrails in
  `docs/plan/NIGHT_RUN_2026-06-10.md` §1 — never commit app.js < 800KB / app.src.js < 1.9MB;
  always curl the live bundle size after a PWA deploy.


## OWNER REPORT 2026-06-10 (LATE) — CV sidebar preview↔PDF geometry

- **PREVIEW-PDF-SIDEBAR-GEOM-001** `[FIXED docx-worker 1.14.46 + 1.50.353 — needs owner visual]` —
  owner (CONFIRMED the section is the CV, not the CL) reports three sidebar preview↔PDF
  mismatches: (1) bullets extend past the other rows' text and the bullet→text gap is too
  wide; preview vs PDF pull the bullet in two different directions; (2) the gap between a
  sidebar heading and its underline rule is much larger in the PDF than the preview; (3) a
  publications line ("…Microengineering, 2009") wraps/splits in the PDF but not the preview
  → the sidebar text column is narrower in the export. FIXED (2) + (3) on the worker:
  sidebar cell L/R margins 144→120 DXA (= the preview's 8px, widening the export text column
  ~3px/side so lines that fit in the preview fit in the PDF); sidebar heading tightened
  (spacing before 80→40, after 40→30; bottom-border text gap space 4→2 pt) — main headings
  unchanged. (1) BULLETS — owner confirmed 2026-06-10: marker at the row's LEFT EDGE +
  tight (~half) gap, matched preview/PDF. FIXED (1.50.353 + worker 1.14.46): preview bullet
  sites now `paddingLeft:bulletIndent; textIndent:-bulletIndent` (first line at 0 → marker
  at the column edge; text + wrapped lines hang at bulletIndent), default bulletIndent
  24→14; BM marker margin 4→2 + dropped trailing space. Worker numbering antcv-bullet +
  antcv-sb-bullet → `left:210, hanging:210` (left===hanging → marker at the cell edge, text
  hangs ~14px), was main 360/200 + sidebar 280/160. Preview and export now share the
  marker-at-edge + ~14px hang. Verified: twocol-ownerlike + cl-list-cont + cv-table +
  palette 11/11 all still pass. Pixel-exact match needs the owner's visual loop (can't
  render the PDF headlessly).

## OWNER REPORT 2026-06-10 (EVE) — preview↔PDF (Cont.) gap

- **PB-WORKER-CL-LIST-CONT-001** `[FIXED docx-worker 1.14.44 — needs owner visual]` — owner:
  preview splits REGULATORY CONTEXT with "(Cont.)" but the exported PDF shows plain
  "REGULATORY CONTEXT", not moved to page 2. INVESTIGATION: the CV (two-column) chain is
  verified CORRECT end-to-end — the REAL measurer writes the export map
  `antcv:autoPages={regctx:{N:2}}`, the docx-client forwards `items[N]._page=2`
  (`pwa/test/diag-sidebar-cont-e2e.mjs`), and the worker splits the sidebar list with
  "REGULATORY CONTEXT (CONT.)" on a 2nd page-table (`diag-twocol-ownerlike.mjs`). The GAP:
  the worker's labeled_list / list / education (Cont.) split was gated to the CV SIDEBAR
  only (`isSidebar`); a list in the LINEAR COVER LETTER that the preview splits stayed
  un-split on export (no "(Cont.)", not moved). FIX (1.14.44): fire the split for the
  sidebar OR the linear CL (`isSidebar || ctx.doc==='cl'`). The linear path honours
  `pbBreakPara` as a real Word page break, so the segment chunking + "(Cont.)" heading now
  work there too. Safe superset — only engages when an item carries `_page>=2` (measurer-set);
  CV main-column lists are excluded. Verified: `workers/docx-worker/test/diag-cl-list-cont.mjs`
  4/4 (Cont. heading + real pageBreakBefore + no content loss); CV regressions
  (twocol-ownerlike, cv-table-width, palette 11/11) still pass.
  IF the owner's section is the CV sidebar (not the CL): the chain is already correct in
  code — re-export on a hard-refreshed app AFTER the preview shows the split, and confirm
  the docx-worker version stamped in the file is >= 1.14.40 (when the sidebar split landed).

## OWNER REPORT 2026-06-10 (PM) — analysis print completeness + Nordic style

- **ANALYSIS-PRINT-COMPLETE-001** `[FIXED 1.50.351 — verified headless]` — owner: now that
  the Analysis panel is unified, make sure ALL its sections are included when printing. The
  report builder (`antcv-analysis-report-pdf-360.js` `reportHtml`) rendered Overall fit,
  Strengths, Gaps, Recommendations, Assumptions, Confidence, Recruiter, Red flags, Questions
  — but the model also held **Tailoring decisions** (`tailoring_decisions`) and
  **Cover-letter strategy** (`cover_letter_strategy`) which were NEVER rendered. Added both
  sections (string-or-array tolerant `richBlock`) + EN/DA labels. Verified
  `pwa/test/diag-analysis-print-complete.mjs` 11/11 (every panel section appears in the
  exported report HTML). Sidecar-only (no app.js rebuild).
- **NORDIC-STYLE-GUIDANCE** `[memory saved + ENGINE WIRED, workers]` — owner supplied
  detailed DA cover-letter / CV / unsolicited / call-the-employer guidance; saved to
  assistant memory (nordic-cover-letter-style, nordic-cv-style, nordic-unsolicited-application,
  analysis-questions-to-employer). WIRED into the writing engine (proxy + demo-proxy,
  mirrored): (1) `writing-style-engine.js` — `nordic-minimal` carries a `guidance` block
  (CL = forward-looking statement of intent, not a CV recap; motivation in the employer's
  words; concrete tasks + how/methods/effect; personal qualities; value-to-employer; 1 page.
  CV = 5–7 line elevator pitch + bullet competencies + reverse-chron with results) and
  `cold-outreach` (alias `unsolicited`) carries the uopfordret dialogue-opener block. The
  guidance is emitted in `buildStyleSystemPreamble` ("Style guidance (MUST follow):") and is
  already injected into the LLM system prompt (Anthropic/OpenAI/Mistral/Gemini shapes) by
  both proxies' index.js. (2) `jd-analysis.js` — recommendations now also append 3–4
  JD-grounded "Call the employer and ask: …" items (the 4 standard Nordic call questions,
  adapted, no yes/no), which surface in the Analysis panel AND the exported report via the
  existing recommendations rendering (no PWA change). Verified: proxy writing-style tests
  35/35 (incl. new nordic + cold-outreach guidance + no-guidance cases); full proxy suite
  45/45; both proxies node-check OK. NOTE: nordic+unsolicited COMBO (nordic style used for
  an unsolicited app) still maps to the nordic CL guidance; the dedicated unsolicited
  framing lives on `cold-outreach` — pass an unsolicited flag later if both should compose.

## OWNER REPORT 2026-06-10 (PM) — kernel drops from history

- **KERNEL-HISTORY-KEEP-001** `[FIXED 1.50.349 + relay — needs owner check]` — owner: the
  unsolicited (kernel) showcase drops out of the application history once ~3 applications
  exist; it should ALWAYS be kept unless the user renews it. TWO drop points, both fixed:
  (1) CLIENT — the topbar history dropdown rendered only `Dl.slice(0,5)` (newest 5), so
  the kernel fell off once enough tailored apps accumulated. Now the unsolicited/kernel row
  (jd_company empty or "Unsolicited") is PINNED first, then up to 5 company-named apps.
  (2) SERVER — the application sweep kept the newest 5 by updated_at and could evict the
  kernel; now it caps only company-named apps to newest 5 and NEVER deletes the unsolicited
  row (excluded from both the count and the delete). Renewing the kernel UPSERTs the same
  row in place (same jd_hash), so "renew" still works. Verified: pwa unit test
  `kernel-history-keep.test.mjs` 5/5 (pinned first, kept at 3 apps, empty-company = kernel,
  no-kernel = newest 5, no duplication); the sweep SQL validated read-only against live D1
  (returns nothing wrongly deletable). app.src.js + terser rebuild (identity-clean) + relay.
- **ADV-INDENT-CONTROLS-001** `[PREVIEW LIVE 1.50.350 — export-parity pending]` — owner: add
  Advanced-settings controls to (a) increase the main content indent from the edge and
  (b) set the bullet-list / emoji-list indent. SHIPPED preview-side: an INDENTS group in the
  Advanced styles panel with two range sliders (Indent from edge 4–40px; Bullet / emoji list
  indent 10–60px), stored on the styleConfig (`mainEdgeIndent` 10, `bulletIndent` 24) so they
  persist/sync/reset with the style. The 5 preview bullet sites + `.antcv-document-main`
  padding read them; defaults reproduce the built-in look (no change unless a slider moves).
  Verified `pwa/test/unit/indent-controls.test.mjs` 4/4 + boot-smoke + salmon. FULL detail +
  the export-parity follow-up in FEATURES_REGISTRY (docx-worker still fixed; moving a slider
  changes preview only until the worker honours the tokens).

## OWNER REPORT 2026-06-10 (PM) — preview↔PDF geometry (page slide)

- **PREVIEW-PDF-GEOMETRY-001** `[FIXED docx-worker 1.14.43 — needs owner visual]` — owner:
  a slight CV line/spacing mismatch causes a page slide on page 1; suspected the
  core-competency-table-to-cell-edge distance and bullet-to-border distance differ between
  preview and PDF. MEASURED: the CV PREVIEW renders the competency table FULL main-column
  width, left-aligned and flush with the body text (app.src.js table case: CV
  wrapStyle = {marginTop:8}, no width cap). The WORKER rendered it `mainW-640` CENTERED —
  ~23px narrower and inset ~21px from the cell edge (vs the preview's ~10px). A narrower
  table wraps more → runs taller → shifts the page-1 break away from what the preview
  measurer computed (the measurer measures the PREVIEW geometry) → the page slide. FIX
  (docx-worker 1.14.43): CV competency table → `mainW-288` (full content width = cell
  width minus the two 144-DXA margins), LEFT-aligned; flush with the body text like the
  preview. CL keeps its intentional 0.8-width centered look. The page measurer (preview)
  and the export now share the same table width, so heights converge. Verified:
  `workers/docx-worker/test/diag-cv-table-width.mjs` 4/4 (CV left + full width 7689 DXA,
  CL centered + inset) + twocol-ownerlike + palette 11/11 still pass.
  BULLET HANG (owner follow-up 2026-06-10, FIXED 1.50.348): the owner asked to make the
  HTML preview bullets hang like Word. All 5 preview bullet render sites (text_bullets ×2 +
  its closing-clause continuation, the bullets/labeled list, and experience role bullets)
  changed from `paddingLeft:10` to a hanging indent `paddingLeft:24; textIndent:-14` — the
  marker first-line outdents to ~20px abs (matching Word's marker) and the body +
  continuation lines hang at ~34px abs (matching Word's ~33.6px text indent). Now the
  preview wraps like the export, which ALSO tightens preview↔PDF height convergence (the
  measurer measures the preview). terser rebuild identity-clean (head `(()=>{`, 0
  use-strict, node-check + boot-smoke OK); salmon full-app diag still PASS. Needs the
  owner's visual pass on a CV with a competency table + multi-line bullets.

## OWNER REPORT 2026-06-10 (AM) — CL preview watermark

- **CL-PREVIEW-WATERMARK-001** `[FIXED 1.50.343 — structural; needs owner visual]` — owner
  2026-06-10: the DEMO watermark shows on CV preview, CV export, and CL export, but is
  MISSING on the CL preview (badges fine). CAUSE: the CV preview renders app.js's own
  `__antcvDemoActive()` diagonal watermark inside each `antcv-page-row` (app.src.js ~38874),
  but the CL preview is a separate continuous-flow branch (`data-antcv-cl-flow`, ~39231)
  with NO in-app watermark — it relied solely on the `antcv-demo-watermark.js` sidecar
  `::after`, which (per the headless probe) does not reliably tag the CL paper. FIX: render
  the watermark in the CL flow's OWN React path, gated on the SAME `__antcvDemoActive()`
  signal as CV — an absolute, tiled (full-flow-height), pointer-events:none, aria-hidden
  DEMO overlay; the flow div is now `position:relative` to anchor it. Same render path as
  everything else = no sidecar timing dependency. app.src.js edit + terser rebuild
  (+469 bytes = the new element; head `(()=>{`, 0 use-strict, node-check + boot-smoke OK).
  Verified: `pwa/test/diag-cl-preview-watermark.mjs` (CL flow renders + is position:relative
  — the anchor); CL salmon regressions (double-salmon, one-pass) still PASS (the overlay is
  absolute/pointer-events:none, so the measurer is unaffected). The watermark itself is
  demo-gated (needs live `/config` demo state), so its visual presence needs the owner's
  eye on a demo CL preview.

## OWNER REPORT 2026-06-09 (EVE) — demo Generate 401s + LinkedIn "…see more"

- **DEMO-RELAY-IDENTITY-001** `[FIXED — relay; verified headless; needs worker deploy]` —
  demo user pressed Generate and ALL providers failed 401 `demo_requires_sign_in`, then
  the demo badge vanished; a retry tried only claude (router demotion after the auth
  failures). ROOT CAUSE: the relay (auth-25) routes demo-pinned users' LLM calls to
  `UPSTREAM_DEMO` (antcv-demo-proxy), but `rawForward` strips the `Authorization` header
  (a cv-proxy-era rule) and injects NO identity — so the demo proxy's demo-enforcement
  preflight saw an anonymous request and refused. The user's sign-in was VALID — the
  relay itself verified the JWT one line earlier. FIX (relay `rawForward`): on
  demo-mode forwards, re-verify the session JWT and inject
  `Cf-Access-Authenticated-User-Email` (the demo proxy's first identity source) +
  restore the Bearer; caller-supplied Cf-Access-* headers are now stripped on ALL
  forwards (anti-spoof). Verified: `workers/access-relay/test/diag-demo-relay-identity.mjs`
  5/5 (demo forward carries verified email + Bearer; paid forward still strips both;
  live demo-enforcement preflight accepts the forwarded request). Badge + provider
  demotion self-heal once calls succeed.
  FOLLOW-UP → **DEMO-RELAY-IDENTITY-002** `[FIXED — relay+demo-proxy; verified headless;
  armed via RELAY_FORWARD_SECRET]` — (security, pre-existing) the demo proxy trusted
  `Cf-Access-Authenticated-User-Email` from ANY direct caller — it is not behind CF
  Access, so a direct request to antcv-demo-proxy.workers.dev with a forged header
  bypassed sign-in and burned demo budget. FIX (shared-secret header): the relay sends
  `X-AntCV-Relay-Auth: <RELAY_FORWARD_SECRET>` on demo-mode forwards (after JWT
  verification; caller-supplied values stripped on all forwards); the demo proxy's
  `identityFromRequest` only trusts Cf-Access-* headers when that header matches
  (constant-time compare). With the secret UNSET the legacy trust applies, so the code
  deploys safely before arming; once armed on BOTH workers, forged direct requests get
  401 demo_requires_sign_in. The HS256 Bearer path (JWT_SECRET) is independent and
  unaffected. The paid proxy (cv-proxy) is untouched — it sits behind CF Access.
  Verified: `workers/demo-proxy/test/diag-relay-auth-gate.mjs` 5/5 (forged direct 401,
  wrong secret 401, relay-forwarded 200, Bearer 200, unarmed legacy 200) +
  `workers/access-relay/test/diag-demo-relay-identity.mjs` extended to 7/7 (demo
  forward carries the secret, caller guess replaced; paid forward carries none).
- **LINKEDIN-JD-SLUG-MORE-001** `[FIXED — proxy+demo-proxy; verified headless; needs worker deploy]` —
  URL-fetched LinkedIn JDs often came back with the description clamped behind
  "…see more" (and company info collapsed). CAUSE: the guest-API rewrite only matched
  NUMERIC paths `/jobs/view/4414211731`; the slug form the LinkedIn app's share sheet
  produces (`/jobs/view/senior-engineer-at-acme-4414211731`) missed the rewrite,
  fetched the consent-walled SPA page, and extraction returned the CSS-clamped text.
  FIX (fetch-jd-url.js, both proxies): take the LAST ≥5-digit run in the /jobs/view/
  path segment → guest jobPosting endpoint (full description, no clamp); also strip
  stray "Show more"/"Show less"/"…see more" button-label lines from extracted text
  (whole lines only — JD sentences containing the words are untouched). Verified:
  `workers/demo-proxy/test/diag-linkedin-jd.mjs` 5/5 incl. live guest-endpoint probe.
  Note: lnkd.in short links still skip the rewrite (resolve only after redirect) —
  acceptable; the consent-strip path still applies.

---

## OWNER REPORT 2026-06-09 (PM) — six issues

- **SALMON-CHURN-DISAPPEAR-001** `[FIXED 1.50.337]` — salmon splitters DISAPPEARED from
  both CV and CL. The salmon LOGIC is intact (all measurer diags pass), so this was a
  live-state issue: the 1.50.326 "quicker salmon" cadence speed-up (poll 1200ms + 120ms
  schedule + dense boot delays) raised measurer frequency enough that, under heavy editing
  + the other sidecars' churn, the **8-writes/4s circuit breaker tripped and froze the
  measurer before the breaks were written** → salmon gone (and it fed the #185 churn).
  Reverted the cadence to the calm/stable values (poll 3000, schedule 250, boot
  400/900/1800/3500); the 1.50.324 one-pass fix still makes the salmon appear in a single
  compute, so it stays responsive without the churn. Verified: salmon diags + boot pass.
- **REACT-185-EDIT-REGULATORY-001** `[NOT REPRODUCED on 1.50.341 — needs owner stack]` —
  React #185 ("Maximum update depth exceeded" — a setState that loops a render) crashed the
  app while the owner edited a REGULATORY section (debug log 18:08, many `button(submit)`
  taps) on the LIVE `app.js?v=1.50.334` (the OTHER session's build). Built a full-app stress
  repro `pwa/test/diag-react185-regulatory.mjs`: mounts the editor with a REGULATORY
  EXPERIENCE section + grouped regulatory sidebar, opens the section, then hammers 25 rapid
  field edits across 21 live inputs (input+Enter+change+blur) and 72 button clicks. On the
  current rebuilt `app.js` (1.50.341, from the committed source) this produces ZERO #185 /
  zero update-depth / zero DOM-mutation errors. Two things changed vs the crash build: main
  now carries the 1.50.341 rebuild (supersedes 1.50.334), and 1.50.337 reverted the measurer
  cadence speed-up that was a churn contributor. CANNOT pin the exact setState-in-render
  source without the debug-log stack (it maps to 1.50.334 line/col). QUESTION FOR OWNER:
  does #185 still reproduce after the 1.50.341 deploy? If yes, share the console stack
  (`Minified React error #185 … app.js?v=…:LINE:COL`) so it can be mapped to app.src.js.
- **DOCX-SIDEBAR-GREEN-001** `[FIXED 1.50.341 + docx-worker 1.14.42 — needs owner visual]`
  — owner confirmed 2026-06-10: navy fill stops mid-page; recolor Copenhagen Modern only.
  TWO root causes found. (1) COLORS: the PWA's Copenhagen Modern style map (app.src.js
  default `c` + `va.scandinavian`) set `mainHeadColor`/`mainLineColor`/`mainSubHeadColor`/
  `tableHeaderBg` to the dark green `#00746E`, and the export payload passes these tokens
  to the docx-worker where `mergeStyle` lets them OVERRIDE the worker palette (whose own
  copenhagen base is already navy). All four → `#283556`; `mainBulletColor` keeps the
  green accent; sidebar inner colors (bright teal #01B7BB on navy) untouched. The
  stylePackage drift-rederive effect propagates the change into persisted styleConfigs
  automatically (it keys on mainHeadColor). app.src.js edit + terser rebuild (identity:
  delta 0 bytes — same-length hex swaps; 8 tokens flipped 21→13 green / 21→29 navy; head
  `(()=>{`, 0 use-strict, node-check + boot-smoke OK). (2) FILL (also closes
  **PB-WORKER-SIDEBAR-FILL-001**): cell shading only reaches as far as row content, so
  short pages left the navy bar hanging mid-page. docx-worker 1.14.42: every two-column
  body row gets an `atLeast` height — page 1 = 13860 DXA (the measurer's USABLE_PDF
  924px budget; the header band owns the remaining ~2978), pages 2+ = PAGE_H−200 — so the
  sidebar cell stretches to the page bottom and can never overflow into a cascade split.
  Verified: diag-twocol-ownerlike.mjs extended (atLeast rows present, 13860 + 16638) +
  palette tests 11/11. OWNER CONFIRMED 2026-06-10: navy fill now reaches the bottom on
  every page incl. page 1 ("fills fully now") — fill closed. (Color recolor still wants a
  final visual nod, but the fill half is owner-confirmed.)
- **DEMO-FETCHJD-WORKERURL-001** `[FIXED 1.50.338 — verified headless]` — demo Fetch-JD
  errored "Configure Worker URL in Settings → API Keys first." The home Fetch-JD handler
  `Wn` (app.src.js) read `proxyUrl` directly with NO relay fallback; demo users have no
  proxyUrl. FIX: when `proxyUrl` is empty, fall back to `window.ANTCV_RELAY_URL` (set from
  relay-config.json → forwards `/api/fetch-jd-url` to the demo-proxy), with the same
  http→https + trailing-slash normalisation — matching Generate / Analyse-JD / recheck-fit.
  Robust even if the `371` proxyUrl seed hasn't run. app.src.js edit + terser rebuild
  (identity-clean: head `(()=>{`, 0 "use strict", +135 chars, node-check OK). Verified:
  5 unit tests (`pwa/test/unit/demo-fetchjd-relay.test.mjs`) — proxyUrl wins when set,
  relay used when proxyUrl empty, error path preserved when both empty, http→https; the
  fallback string is present in the rebuilt app.js; boot-smoke clean. (Live confirmation in
  demo still depends on the access-relay routing `/api/fetch-jd-url` to the demo-proxy.)
- **REGULAR-MODE-STALE-SETUP-001** `[FIXED 1.50.340 — verified headless]` — in regular
  (BYOK) mode the "⚠ Setup needed" warning + "🟡 Use demo" coin only cleared after a
  manual refresh; the DEMO preview watermark did the same. CAUSE: both chips are
  app.js-rendered gates (`M()` / `__antcvHasOwnKey()`) evaluated AT RENDER TIME; keys
  arriving after mount (cloud restore on sign-in, pasted in Settings) trigger no
  re-render — and same-tab localStorage writes fire NO 'storage' event. The watermark
  sidecar additionally memoised its demo decision FOREVER (`demoPromise`) and never
  removed the overlay. FIX (sidecars only, app.js untouched): new
  `antcv-setup-chips-live-372.js` (via the 357-loader) polls key-presence (1.5s) +
  storage/focus and live-hides/restores the two chips by exact leaf text, with a
  MutationObserver re-applying after React re-renders; `antcv-demo-watermark.js`
  1.50.340 keys its memo on key-presence, re-resolves on flip, and now REMOVES the
  overlay when demo is off. Verified: `pwa/test/diag-setup-chips-live.mjs` 4/4
  (boot-visible, same-tab key hides both + watermark, removal restores, re-render
  re-hidden).
- **ANALYSE-JD-BUTTON-POS-001** `[FIXED 1.50.339 — verified headless]` — owner confirmed
  2026-06-10: "same row, side by side". The 360 EXPORT & DETAIL row now holds BOTH
  buttons (`.arx-analyse` + `.arx-dl` in an `.arx-btns` flex group); the Analyse button
  delegates its click to the real run button inside the 356 JD block (run logic stays in
  one place) and mirrors its busy state. 356 hides its in-block copy while the row button
  exists (restores itself if 360 is absent) and pins the order JD-inputs → action row.
  Verified: `pwa/test/diag-analyse-jd-row.mjs` 4/4 (side-by-side, in-block hidden,
  delegation works, JD block above) + panel-order diag still 4/4.

## ANALYSIS PANEL 2026-06-09

- **ANALYSIS-PANEL-ORDER-001** `[FIXED 1.50.336 — verified headless]` — owner 2026-06-09:
  Assumptions + Recommendations were buried at the BOTTOM of the panel (inside the
  EXPORT & DETAIL block, `antcv-analysis-report-pdf-360`). Owner wants them in the UPPER
  part — **just below Overall Fit** — and **Confidence Review above the Download (and
  Upload-JD) buttons**. FIX (360, sidecar-only): split the panel block — a TOP block
  (`#antcv-analysis-report-top`, Assumptions + Recommendations) is inserted right after
  the app.js "Overall Fit" section, and the BOTTOM block (`#antcv-analysis-report`) now
  renders Confidence Review FIRST, then the EXPORT & DETAIL row (heading + Download). Both
  re-position via the existing `ensureBlock` re-render loop (MutationObserver + events).
  Verified `pwa/test/diag-analysis-panel-order.mjs` (synthetic panel): A+R land just below
  Overall Fit, Confidence sits above Download, A+R removed from the bottom block, overall
  order Overall Fit → A+R → … → Confidence/Download; 0 errors. NOTE: the Upload-JD / JD
  input is rendered by a SEPARATE sidecar (`antcv-analysis-panel-jd-block-356`) at the top
  of the panel; if the owner also wants that block moved below Confidence, it's a 356
  follow-up (not done here). Owner to visually confirm placement.

- **ANALYSIS-PANEL-MISSING-FIT-001** `[FIXED 1.50.335 — verified headless]` — owner 2026-06-09
  (screenshot): the in-app **📊 Application Analysis** panel shows only the JD input,
  **EXPORT & DETAIL**, **ASSUMPTIONS**, and **CONFIDENCE REVIEW**. The core of the
  analysis — **OVERALL FIT, STRONGEST FIT POINTS, GAPS / HONEST ASSESSMENT,
  RECOMMENDATIONS** — is MISSING from the panel but renders fully in the **export
  preview** (the branded Analysis report PDF). So the user can't see the actual fit
  assessment in-app, only after export.
  **ROOT CAUSE (traced):** app.js renders Overall Fit / Strongest Fit Points / Gaps /
  tailoring / CL-strategy in the panel from `yo` (the persisted `rationale` object) —
  see `pwa/app.src.js` ~42508 ("📊 Application Analysis") → ~42565 "Overall Fit"
  (`yo.fit_summary`), ~42614 "Strongest Fit Points" (`yo.top_fit_points`), gaps below.
  When the user clicks **Analyse JD**, `antcv-analysis-merge-344.js` fetches
  `/api/jd-analysis` and merges the result into `rationale` — but it copies ONLY
  `recruiter / red_flags / questions_in_jd / assumptions / recommendations /
  confidence_notes` (lines 175-183). It does **NOT** copy `fit_summary`,
  `top_fit_points`, `gaps`, `tailoring_decisions`, or `cover_letter_strategy` from the
  response. So when `rationale` doesn't already carry those (Analyse-JD run without a
  prior full generation, or after a rationale reset / a showcase/kernel state), the
  panel's Overall-Fit/Strongest-Fit/Gaps blocks render empty — while the **export
  report** (`antcv-analysis-report-pdf-360.js`) renders the FULL fresh jd-analysis
  response, so it shows everything. (The panel's EXPORT&DETAIL/ASSUMPTIONS/CONFIDENCE
  blocks show because 344 *does* copy assumptions/confidence_notes.)
  **FIX (small, ready):** in `antcv-analysis-merge-344.js`'s merge, also copy the fit
  fields when present — `if (a.fit_summary !== undefined) merged.fit_summary =
  a.fit_summary;` and likewise for `top_fit_points`, `gaps`, `tailoring_decisions`,
  `cover_letter_strategy` — so the panel and the export read the same complete analysis.
  Verify: run Analyse JD on a fresh/unsolicited state → the panel shows Overall Fit +
  Strongest Fit Points + Gaps + Recommendations (matching the export). **NOTE:** must
  preserve any fit fields already in `rationale` (only overwrite when the response
  actually provides them — guard with `!== undefined`, same as the existing copies).
  **SHIPPED 1.50.335:** `antcv-analysis-merge-344.js` now also copies `fit_summary`,
  `top_fit_points`, `gaps`, `tailoring_decisions`, `cover_letter_strategy` (guarded by
  `!== undefined`). Verified `pwa/test/diag-analysis-panel-fit.mjs`: `runMerge()` with a
  stubbed `/api/jd-analysis` lands all five fit fields in `rationale` (so the panel renders
  Overall Fit / Strongest Fit Points / Gaps / Recommendations), with assumptions +
  confidence_notes still carried (no regression); 0 console errors.

## EXPORT REVIEW 2026-06-09 — owner re-export feedback (1.50.321 / worker 1.14.41)

Owner rendered the 1.50.321 CV (PDF + DOCX) + CL DOCX. **CV page-split is improved**
(the salmon-push fix landed). Four remaining points, with **evidence-based root-cause
analysis from inspecting the attached DOCX + the deployed worker (1.14.41-sidebar-ratio)**.

**Shared root cause for #1–#3 (CV export) — RESOLVED by 1.50.320, verified end-to-end
2026-06-09.** The attached CV DOCX was **one outer two-column table with ~14 nested
section-wrapper tables, only 1 `pageBreakBefore`** — i.e. the per-page two-column model
(`buildTwoColumnDocument`, 1.14.39) computed `numPages = 1` and emitted a SINGLE
two-column table, which Word natural-flowed across 3 pages. `numPages` exceeds 1 only
when `__antcvPB` markers reach the worker (forwarded role.page / row_pages / sidebar
item `_page`). **Why this CV had none:** its SIDEBAR (REGULATORY CONTEXT) overflowed in
its FIRST group, which hit the salmon-push bug — `snapToGroup` returned 0, so the
measurer wrote NO `autoPages[regctx]` break at all. With the sidebar map empty, the
client's `pageFor()` (which HAS forwarded sidebar auto-breaks since 1.50.313) had nothing
to stamp → no `_page` → no `__antcvPB` → natural-flow fallback. **1.50.320 fixed the
measurer** to write the break even when the first group overflows, which closes the whole
chain. VERIFIED end-to-end this session (no PDF renderer needed — structural):
- `pwa/test/diag-sidebar-export-page.mjs` — the client forwards the sidebar `labeled_list`
  break as `item._page=2`, COORDINATED with `experience role.page=2`.
- `workers/docx-worker/test/diag-twocol-ownerlike.mjs` — owner-shaped payload → the worker
  emits **2 top-level page tables** (per-page engaged), the `labeled_list` splits with a
  "REGULATORY CONTEXT (Cont.)" heading, **navy sidebar shading on every page**, the **AI
  disclosure appears once on the LAST page** in the `ai_wm_side` column, zero content
  loss/dup.
**OWNER ACTION: re-export the CV on ≥1.50.320** (the bad export was pre-1.50.320). The
three symptoms below should be resolved; confirm on the rendered PDF/DOCX. Per-symptom
status with the per-page model engaged:

- **AI-NOTICE-WRONG-SIDE-001** `[FIXED via per-page 1.50.320 + dynamic re-position 1.50.328]`
  — **1.50.328 (owner 2026-06-09 "move the AI notice when section length changes"):** the
  preview anchor (`antcv-watermark-page-anchor-341`) computed the right corner but only
  re-ran on sections-updated / item-pages-changed / resize — so when a section grew/shrank
  (re-pagination) the notice went stale on the old column. Added `antcv:auto-pages-changed`
  (the re-pagination signal), `antcv:item-align-changed`, `input`, and a 1.5s poll, so the
  notice re-measures the last page and MOVES to whichever column now ends higher; the
  recomputed `ai_wm_side` is re-stashed for the export. Verified
  `pwa/test/diag-wm-move-on-length.mjs` (notice on the emptier column; after the column
  heights swap + an auto-pages-changed pulse it MOVES to the other column; boot clean).
  — owner: "AI notice is on the text heavy side." CONFIRMED in `buildTwoColumnDocument` (index.js:24477,24519): `wmInSidebar
  = ctx.aiWmSide ? ctx.aiWmSide === sidebarSide : false`; when `ai_wm_side` is ABSENT it
  defaults to `false` → the disclosure is pushed onto `mainChildren` (the dense column).
  Two contributing causes: (a) with `numPages=1` the notice lands at the bottom of the
  single main cell on the last page = the text-heavy side; (b) `ai_wm_side` is computed
  by `antcv-watermark-page-anchor-341` from the PREVIEW's last page, but the export's
  last page ≠ the preview's last page (different page count — see #3), so even a
  forwarded side can be for the wrong page. Real fix is coupled to engaging the per-page
  model (below) so the last page's empty column is known to the worker. NOTE: the worker
  honours a forwarded `ai_wm_side` correctly — the gap is that it's absent/stale.
- **PB-WORKER-SIDEBAR-FILL-001** `[FIXED via per-page 1.50.320 — owner re-export to confirm]`
  — owner: "first page sidebar color does not reach end of page." With `numPages=1` the navy sidebar is
  ONE table cell whose row Word splits across pages; the cell shading only fills to the
  row's content height on page 1, not the page bottom. The per-page model (one table per
  page, sidebar cell navy on every page) is exactly what closes this — but it only
  engages when `numPages>1`.
- **PREVIEW-PDF-PARITY (length)** `[LARGELY FIXED via per-page 1.50.320 — minor residual]`
  — owner: "the 2nd page slid a bit to the 3rd page … still a minor difference in length."
  With per-page engaged the export now honours the SAME coordinated breaks as the preview
  (page boundary = table boundary), so the gross length mismatch is gone. Residual: the
  break POSITIONS are still measured in preview px (≈ the Word line via WORD_INFLATE), so a
  borderline page can land one unit off — bounded by the per-page model (never a
  mid-content cut). Further parity tuning (WORD_INFLATE, the `Vi` estimator geometry) is
  tracked under PREVIEW-PDF-PARITY-001 and needs a rendered-PDF visual loop.

**The unifying fix is LIVE (1.50.320), not deferred.** Engaging the per-page two-column
model required only that the measurer WRITE the sidebar break (1.50.320) — the client
forwarding (`pageFor` → `item._page`, 1.50.313) and the worker per-page renderer (1.14.39)
were already in place. The 1.50.215 scramble was a property of the OLD single-table model,
which the per-page model replaces (page boundary = table boundary → columns can't desync;
verified no header-isolation / mid-role-cut / dup in `diag-twocol-ownerlike.mjs`). So the
whole cluster closes on an owner re-export at ≥1.50.320; no risky new forwarding was
needed. (1.50.325 only corrected the now-stale "stood down" comment in the docx-client to
document this.)

- **CL-NO-SALMON-001** `[RESOLVED — owner confirms salmon now appears (slowly)]` — owner
  2026-06-09: "salmon appeared in CL eventually." The salmon DOES render; it was the
  owner's live-state lag (the measurer is sticky + one-break-per-compute, gated by a
  fingerprint + 1.5s cooldown, so a multi-page CL paginates over several slow cycles).
  **CL-SALMON-SLOW-001** `[FIXED 1.50.324 — verified headless]`: paginating a 3-4 page CL
  took several seconds because the CL pass wrote only ONE break per compute and leaned on
  incidental re-triggers (a content-height change re-tripping the source fingerprint) to
  paginate the rest. FIX: break EVERY spanning section in one pass — matching the CV
  passes above, which already loop all sections (so this removes a CL-only inconsistency,
  not a safety mechanism; the source-fingerprint gate + 1.5s cooldown + 8-writes/4s
  circuit breaker still guard against churn, and this is now ONE write-cycle not N).
  Verified `pwa/test/diag-cl-onepass.mjs`: two spanning sections both break in a single
  settle with correct cumulative pages (2 and 3), the page-2-internal section between
  them is skipped; no regression across the CL/sidebar measurer tests + boot-smoke.
- **CL-DOUBLE-SALMON-001** `[FIXED 1.50.323 — verified headless]` — owner 2026-06-09: the
  CL salmon "appeared twice for the same page" — two "▼ PAGE 2 ▼" bars (before HOW I
  WOULD CONTRIBUTE (Cont.) and before FOUNDATION). ROOT CAUSE in the measurer's CL pass
  (`antcv-auto-pagebreak-block-001.js`): the gate `bottom - clTop <= clLimit ? skip` only
  compared against the PAGE-1 line, so ANY section living entirely on page 2 (whose bottom
  is naturally > clLimit) was flagged as overflowing and given its own **hard-coded** page-2
  break across successive cycles → multiple "PAGE 2" salmons. FIX: only break a section
  that actually SPANS a page boundary (`floor(top/clLimit) !== floor(bottom/clLimit)`), and
  label the salmon with the REAL cumulative page (`floor(top/clLimit)+2`, capped at 4) — the
  crossing item / table row / whole-section all use it. So a page-2-internal section draws
  NO salmon, and a section that genuinely crosses into page 3 reads "▼ PAGE 3 ▼". Verified
  `pwa/test/diag-cl-double-salmon.mjs` (pre-seed contribute broken: foundation on page 2 is
  NOT broken; tail spanning into page 3 is labeled 3 in both maps) + no regression in
  `diag-cl-salmon` / `diag-cl-midlist-measurer` / sidebar tests + boot-smoke 0 errors.

- **CL-GHOST-COMPANY-001 (ghost-hunt hardening)** `[FIXED 1.50.330 — verified headless]` —
  owner 2026-06-09: "make sure the fetch still passes ghost hunt and prevents
  hallucinations — otherwise we'll see Terma again." The 1.50.329 empty-field retry pushes
  the LLM to fill WHO/WHY/bullets, which could surface a hallucinated company. Audited the
  existing ghost hunt and found a real HOLE: the force-Unsolicited + body-scrub branch
  only fired on `__explicitShowcase || (!__jdNamedCompany && io.company==='Unsolicited')`
  — so when the LLM hallucinated a company with NO JD present, `__jdNamedCompany` went true,
  the branch was SKIPPED, and the ghost was KEPT in meta AND the unscrubbed body. FIX:
  (1) the branch now also fires for EVERY no-JD generation (`__noJD`), since with no JD any
  meta.company is a hallucination → always force Unsolicited + scrub; (2) the scrub now
  NEUTRALISES the ghost in place (→ "your organisation" / "your organisation's") instead of
  deleting whole sentences and leaving the literal "[Company]" placeholder; (3) the scrub
  now also covers `contribute_intro` + `contribute_closing` — where the original
  "help **Terma** build…" ghost actually lived and was being missed. The 1.50.329 neutral
  fallbacks are company-free, so the combined chain (prompt forbids naming a company →
  scrub neutralises any slip → neutral fallback if a field ends empty) is ghost-free and
  placeholder-free. Verified: 6 new unit tests (`test/unit/cl-ghost-hunt.test.mjs`, 54/54
  pass) — no-JD+hallucinated-company forces Unsolicited, the contribute_closing ghost and
  its possessive are neutralised, multi-word names handled, tailored path unaffected;
  rebuild identity-clean (head `(()=>{`, 0 "use strict", +182 chars), boot-smoke 0 errors.
- **CL-EMPTY-BODY-FIELDS-001** `[FIXED 1.50.329 — verified headless]` — owner 2026-06-09:
  an exported unsolicited CL showed the TEMPLATE placeholders for WHO I AM ("[WHO I AM —
  …]") and WHY THIS POSITION, and NO bullets under HOW I WOULD CONTRIBUTE (intro + closing
  present, items empty). The neutrality fix held (no company named). ROOT CAUSE (two):
  (a) the post-processor fallback chain was `a(F.who_content) || a(e.content) || neutral`,
  but `e.content` is the me() placeholder and `a()` returns it verbatim (truthy), so the
  PLACEHOLDER leaked instead of the neutral fallback (same for WHY); (b) the partial-
  response gate accepted `n ≥ 3 of 5` critical fields — foundation×2 + closure alone make
  3, so an empty who+why+bullets response was ACCEPTED, and `contribute_items` wasn't
  checked at all. FIX (app.src.js, terser rebuild): `__clReal()` treats a bracketed
  placeholder as empty so who/why fall through to the neutral fallback; `__neutralContrib
  Items` guarantees 3 HOW-I-WOULD-CONTRIBUTE bullets even in a no-JD/non-showcase run; the
  gate now counts `contribute_items` (6th field) and requires `≥4 of 6` so an empty-body
  draft is RETRIED for real content; and the no-JD prompt clause now explicitly tells the
  LLM to fully write who/why/bullets. Verified: 5 new unit tests
  (`test/unit/cl-empty-body-fallback.test.mjs`, 48/48 pass) — placeholder rejected →
  neutral, real content kept, the owner's exact failing response (n=3) now retries; rebuild
  identity-clean (head `(()=>{`, 0 "use strict", +910 chars), boot-smoke 0 errors.

## EXPORT REVIEW 2026-06-08 (PM-2) — owner re-export feedback

Iterating on real CV/CL exports (owner rendering .docx + PDF). Shipped + open:

### Fixed this round
- **PB-WORKER-SIDEBAR-RATIO-001 follow-up** `[FIXED 1.50.321 — verified headless]` — the
  worker (1.14.41) already derives the two-column split from `payload.sidebar_ratio`
  (clamped [0.2,0.55], default 0.33), but the docx-client never forwarded it, so a
  user-ADJUSTED splitter still exported at the 0.33 default. The client now reads
  `cvSidebarRatio` (localStorage, preview default 0.33) and forwards it as
  `sidebar_ratio`, clamped to the worker's band; an UNSET ratio is omitted so both
  sides keep the 0.33 default in step. PWA-only (no worker deploy). Verified
  `pwa/test/diag-sidebar-ratio-forward.mjs`: adjusted 0.42 forwarded; 0.62 clamped to
  0.55; unset omits the field. Boot-smoke 0 errors; export-autobreak regression OK.
- **PB-WORKER-CONT-DOUBLE-001** `[FIXED docx-worker 1.14.33 — owner check]` — page-2
  main showed TWO headings: the section-wrapper `tableHeader` repeat
  ("PROFESSIONAL EXPERIENCE", bare) AND the role.page "(Cont.)" heading. Suppressed
  the tblHeader repeat for `type==="experience"` (it owns its "(Cont.)" via the
  role.page path); all other sections keep the repeat.
- **PREVIEW-CONT-HEADING-LEGACY-001** `[FIXED 1.50.299]` — preview continuation
  heading was a hardcoded legacy "EXPERIENCE (CONT.)"; now uses the experience
  section's real title → "PROFESSIONAL EXPERIENCE (CONT.)" (matches the export).
- **CL-PAGINATE-001** `[FIXED docx-worker 1.14.32 — owner check]` — CL flows to 2+
  pages (was clipping to 1).
- **WORD_INFLATE line-drift** `[1.50.298 — owner tuning]` — CV 2nd-page content now
  propagates correctly; factor 1.11 tunable.

### OPEN — owner re-export feedback
- **PB-PREVIEW-SIDEBAR-SALMON-PUSH-001** `[FIXED 1.50.320 — verified headless]` — in the
  CV PAGE-BOX preview the long SIDEBAR (REGULATORY CONTEXT) did NOT break at the salmon
  line — its content **pushed the salmon DOWN** instead of flowing THROUGH it (owner
  2026-06-08: "make sure the sidebar text is going through the salmon and not pushing
  the salmon"). **ROOT CAUSE (narrower than the original hypothesis):** the measurer DOES
  run its sidebar pass for the preview base (`compute(USABLE, PREVIEW_KEY)`) and DOES
  write `antcv:autoPagesPreview[sid]` when the overflow falls in a LATER group — the read
  path (`__antcvEffBucket`→`__antcvAutoPB`→flatMap `o`, app.src.js ~38547) then splits
  correctly (confirmed: a synthetic sidebar with deep overflow group-snaps fine). The
  failing case is when the sidebar's **FIRST group alone overflows the A4 line**: the
  first overflow item snaps back to group-start `0` (`snapToGroup` has no earlier
  boundary to fall to), so `br < 1` and the section pass wrote **NO break at all** (the
  `if (br >= 1)` guard) in EITHER map. The whole sidebar then rendered in one page-box
  (the sidebar column has only `minHeight`, no cap — app.src.js ~38808) and pushed the
  salmon far below A4. **FIX (sidecar-only, no app.js rebuild):** in
  `antcv-auto-pagebreak-block-001.js compute()`, when the group snap yields `br < 1`,
  fall back to the RAW overflow item (`br = idx`) so the sidebar breaks AT the A4 line
  and flows through the salmon — a single group taller than a page cannot be kept whole
  anywhere, so a mid-group cut at the line is correct. Verified headlessly:
  `pwa/test/diag-sidebar-fullapp.mjs` (huge first group → was one 1712px box with no
  break, now two 1123px boxes, `autoPagesPreview={regctx:{15:2}}`) +
  `diag-sidebar-salmon-push.mjs` (later-group overflow still group-snaps) + boot-smoke 0
  errors + 38/38 unit tests. Related: [[PB-WORKER-TWOCOL-PAGED-001]], 1.50.316/318.
- **PB-WORKER-TWOCOL-PAGED-001** `[VERIFYING docx-worker 1.14.39 — owner export]` —
  **per-page two-column tables for Word** (owner spec 2026-06-08, supersedes
  PB-WORKER-SIDEBAR-CONT-001 + PB-WORKER-SIDEBAR-PAGINATION-001 + PB-WORKER-SIDEBAR-FILL-001;
  this is the deferred PB-007 two-column pagination). SHIPPED 1.14.39: `pbBreakPara()`
  tags every break paragraph (`__antcvPB`); renderSection now splits experience (by
  role.page) + tables (by row_pages) + sidebar lists (by item._page) into TOP-LEVEL
  segments; `buildTwoColumnDocument` splits each column on the markers and emits one
  `[SIDEBAR_W, MAIN_W]` table per page (header band on page 1 only, sidebar navy on
  every page). Structure-verified headlessly via `test/diag-twocol-paged.mjs` (drives
  the live index.js handler, unzips document.xml): coordinated 2-page CV → exactly 2
  top-level tables + 1 body-level break + cascade + zero content loss/dup; no-break CV
  → 1 table; CL linear unaffected. AWAITING owner Word export confirm. Original spec
  below: Today `buildTwoColumnDocument` ([index.js:24449](../../workers/docx-worker/src/index.js)) builds
  ONE table: row0 = header (colSpan 2), row1 = [sidebarCell(ALL sidebar), mainCell(ALL
  main)]. When it overflows, Word splits that single tall row badly (the owner: "in
  word the break is not rendered properly"). **Owner's prescribed fix:** generate a
  SEPARATE table per page, each with the SAME sidebar+main column widths
  (`[SIDEBAR_W, MAIN_W]`); page 1 keeps the header band; each page N>1 is a fresh
  table preceded by a page break, holding the sidebar content from its "(Cont.)"
  point to the end in the sidebar cell and the main content from its "(Cont.)" point
  to the end in the main cell. **Plan:** (1) add `renderColumnPaged(secs, ctx,
  isSidebar)` → `{1:[els],2:[els],…}` bucketing each column's rendered content by
  page: walk sections, increment `curPage` at every break point (section
  `pageBreakBefore`, item `_page≥2`, role `page≥2`, table `row_pages`, text_bullets
  `bullet_N`), assign all content to `curPage` until the next break (NO inline
  pageBreakBefore — the table boundary IS the break); continuation segments still get
  their "TITLE (Cont.)" heading. (2) Rewrite `buildTwoColumnDocument` to compute
  `sidebarByPage` + `mainByPage`, take `maxPage`, and emit one `Table` per page —
  page 1 with the header row, pages >1 with a leading `pageBreakBefore` paragraph and
  only the body row `[sidebarCell_pN, mainCell_pN]` (same `colWidths`, sidebar keeps
  its navy `shading` so the bar fills every page — also closes
  PB-WORKER-SIDEBAR-FILL-001). (3) Header repeat on page 2+ is GATED OFF by default
  (see PAGEBREAK-STYLE-OPTIONS-001). **Risk/verification:** sweeping rewrite of the CV
  builder; the live `index.js` bundle exports only the fetch handler (needs CF env),
  so set up a node harness that POSTs to the handler with a stub env, unzip the
  resulting `word/document.xml`, and assert: N tables = N pages, one page break
  between each, header present once, and zero content loss/dup vs the section input.
  Hold until that harness is green before deploy. NOTE: the **preview** already
  paginates into page-boxes natively; this is the EXPORT (Word) half only.
- **PB-WORKER-SIDEBAR-CONT-001** `[FIXED — verified headless 2026-06-12]` — a SIDEBAR
  section (REGULATORY CONTEXT) continuing onto page 2 got the bare title repeat, NOT
  "(Cont.)". Closed by the per-page two-column rework (worker ≥1.14.39/40): the
  docx-client forwards the measurer's EXPORT break map (`antcv:autoPages`) as
  `item._page` on sidebar list items, the worker splits the column into top-level
  page segments and emits "TITLE (CONT.)" headings (double-"(CONT.)" dedup in
  1.14.40; localized suffix in 1.14.58). Verified: `pwa/test/diag-sidebar-cont-e2e.mjs`
  (REAL measurer → client `_page` forwarding) + `workers/docx-worker/test/diag-twocol-ownerlike.mjs`
  (worker (Cont.) segments) — both green 2026-06-12.
- **PB-WORKER-SIDEBAR-PAGINATION-001** `[FIXED — same mechanism as SIDEBAR-CONT-001]`
  — sidebar Word pagination "still problematic… was better before." The sidebar no
  longer relies on Word natural flow: forwarded `item._page` breaks cut the column
  cleanly at the measurer's line (no mid-item chop), coordinated with the main
  column's role/table breaks (`pwa/test/diag-sidebar-export-page.mjs` green
  2026-06-12: sidebar `_page` + experience `role.page` land on the same page).
- **PREVIEW-SUBTITLE-RACE-001** `[FIXED — antcv-subtitle-sequence-368.js, verified headless]`
  — entering the preview for an Unsolicited application showed the TEMPLATE
  specialisation placeholder ("[Specialisation — 1-3 focus areas…]") until the user
  switched applications and back. The subtitle/`io` meta wasn't populated on the first
  preview render (the late `[Read from Cloud]` row carried the real subtitle, but the
  header had already painted). FIX (shipped by a concurrent session,
  `antcv-subtitle-sequence-368.js`, wired at index.html:586): on boot + every
  edit→preview transition it resolves the subtitle in priority order (live meta → active
  application row [local cache, else relay GET] → kernel-showcase meta [local, else
  relay]), commits the first non-placeholder value into `meta.subtitle`, and nudges the
  editor — so the first paint is correct and the local value is captured for next time.
  Only ever writes `meta.subtitle`; one-shot relay GETs, fully guarded. CONFIRMED wired +
  working headlessly (`pwa/test/diag-subtitle-sequence.mjs`): with a placeholder
  `meta.subtitle` + a local app-cache row carrying the real subtitle, the sidecar
  installs, detects the placeholder, and commits the real value on boot (0 errors).
- **CL-PDF-PRINT-PATH-001** `[RESOLVED — stale; verified 2026-06-09]` — re-audited: the
  PDF export button calls `window.exportPdfViaWorker({ doc: Lt, … })` for BOTH CV and CL,
  and `exportPdfViaWorker` builds the payload via `buildPayload` (which sets
  `layout: 'linear'` for CL) and POSTs to `/generate-pdf` (CloudConvert). So the CL PDF
  ALREADY uses the worker CloudConvert path with a proper `CoverLetter_<name>_…` filename
  (`buildFilename`); `window.print` (`kl()`) is only the fallback when no server PDF is
  available (no CloudConvert key / worker down). The owner's recent CL PDFs were
  worker-rendered (CloudConvert-quality layout + correct filename), confirming this. The
  entry predates the CV/CL unification of the PDF path. **Both halves verified headless
  (2026-06-09):** the print HTML builder emits `<title>Cover Letter — <name></title>` and
  `kl()` rewrites it to the download name. `pwa/test/diag-cl-print-filename.mjs` forces the
  print fallback for a CL and confirms the print iframe's `<title>` =
  `CoverLetter_<name>_<role>_<company>` (drives the Save-as-PDF filename) — no generic
  "AntCV" name. So even the fallback names the file correctly; the worker path is primary.
- **LINKEDIN-JD-FETCH (demo-proxy)** `[VERIFIED 2026-06-09]` — owner: "check that demo-proxy
  can fetch LinkedIn JD." The concurrent session's L1/L2/L3 (`workers/demo-proxy/src/fetch-jd-url.js`)
  is sound: L2 `rewriteJobUrl` turns a `/jobs/view/{id}` or `?currentJobId={id}` URL into the
  public guest endpoint `linkedin.com/jobs-guest/jobs/api/jobPosting/{id}` (no consent wall),
  the fetch sends a desktop-Chrome UA, and L1/L3 extract the JD + strip consent/footer noise.
  Verified `workers/demo-proxy/test/diag-linkedin-jd.mjs`: driving `handleFetchJdUrl` with a
  LinkedIn `/jobs/view/…` URL + a mocked guest fragment → rewrite fires, JD body extracted,
  cookie/consent noise stripped; plus a LIVE probe that hit the real guest endpoint (HTTP 200,
  HTML JD fragment) — so the path works end-to-end. (Code is the concurrent session's; needs a
  demo-proxy deploy to be live in production.)
- **EXPORT-PREVIEW-FEATURES-001** `[3 of 4 SHIPPED — (d) remains][enhancement]` — owner
  requests for the export-preview UI: (a) JD-analysis as a 3rd quick-export button —
  SHIPPED 1.50.377 (renders only when a report exists, delegates to the 360 exporter
  hook); (b) choose download directory — SHIPPED 1.50.380 ("Ask where to save" toggle
  in the modal, Chromium File System Access save picker in the docx-client, cancel
  aborts cleanly, fallback to the classic download); (c) page selector — SHIPPED
  1.50.374 (numbered chips scroll the iframe to each page-row); (d) modern-ATS vs
  legacy-ATS compare preview — STILL OPEN (needs a design: the legacy tier is an
  export-palette flag, not preview-renderable without a re-render pass).
- **CL-GHOST-COMPANY-001** `[FIXED (generation) 1.50.322 — regenerate to clear stale content]`
  — an UNSOLICITED cover letter (no JD) referenced a specific company ("…help **Terma**
  build…" in HOW I WOULD CONTRIBUTE, "Terma's focus…" in WHY THIS POSITION; owner
  re-confirmed 2026-06-09). **ROOT CAUSE found in the generation prompt** (`app.src.js`
  ~21229): the prompt UNCONDITIONALLY instructs the LLM to write company-specific
  closings — `contribute_closing`: "My aim would be to help **[Company Name]** build…"
  and `closure_content`: "support **[exact company name from JD]**…" — with NO
  unsolicited branch. With no JD the LLM fills that slot from prior context / background
  (a real company → "Terma"). The showcase neutral-override (the `p`-gated CL rewrite at
  ~22157, which DOES produce company-neutral text) was bypassed for this run. Compounding
  vector: the prompt also injected "PRIOR RUN CONTEXT (carry these JD-specific signals
  forward…)" from `yo.supporting_context`, so a previous tailored (Terma) run's context
  leaked into the open application. **FIX (1.50.322, app.src.js — terser rebuild, identity
  gate passed):** when there is no JD (`c` empty ⇒ `__noJD`), (a) prepend a hard
  company-neutrality clause to the generation prompt ("OPEN / UNSOLICITED APPLICATION — NO
  TARGET COMPANY … Do NOT name ANY specific company ANYWHERE … 'your organisation' …
  meta.company MUST be empty"), consistent with the existing "extract company ONLY from
  the JD" rule; and (b) do NOT carry `yo.supporting_context` forward (`!__noJD` gate).
  Verified: 5 new unit tests (`test/unit/unsolicited-company-neutral.test.mjs`, 43/43
  pass), the neutrality string is present in the rebuilt `app.js`, boot-smoke 0 errors,
  identity round-trip gate passed (terser rebuild of unedited source boots clean).
  **NOTE — applies to FUTURE generations:** an already-contaminated unsolicited draft
  still holds the old "Terma" text until the owner **regenerates** the unsolicited
  showcase (Settings → "Regenerate showcase", or Generate without a JD). The fix prevents
  re-contamination. Residual (not addressed): a deterministic render-time scrub of
  existing stale content + hardening why the `p` showcase-override was bypassed — left as
  follow-ups since both need the owner's live state / are higher-risk.
- **AUTH-STATE-MISMATCH-001** `[SOFTENED 1.50.312]` — the Google OAuth redirect
  occasionally returns with the CSRF state missing/mismatched (sessionStorage lost
  between redirect-out and return). Still aborts safely (never signs in on an
  unverified token); message changed from the alarming "possible CSRF" to a gentle
  "Sign-in didn't complete — tap Sign in again." Root cause (sessionStorage loss)
  not yet pinned — needs a repro.

---

## SESSION 2026-06-08 — kernel recovery, LLM cost-quality router, salmon, wizard language

Production reached **PWA 1.50.292**; docx-worker + proxy redeployed. All items
pushed to `main` + `claude/antcv-roadmap-bugs-L9Sqa` +
`plan/2026-06-06-analysis-followups` (kept identical).

### Fixed / shipped this session

- **KERNEL-SHOWCASE-EMPTY-SLOT-001** `[FIXED 1.50.274]` — `/api/kernel-showcase`
  slot held empty `{cv:[],cl:[]}` + real meta → restore produced a headline-only
  husk and a re-save loop kept it empty. Guard `__antcvHasRealSections` on all
  write/restore sites; corrupted slot ignored → regenerate (self-heal).
- **KERNEL-CORE-EMPTY-001 / CORE-PROTECT-001** `[FIXED 1.50.275]` — empty arrays
  are truthy so a husk left the editor BLANK instead of falling back to `me()`;
  fixed both loaders. Cut on a CORE section now HIDES it (on:false) not deletes
  (hide-over-delete).
- **KERNEL-REGEN-DEADLOCK-001** `[FIXED 1.50.277/278]` — Cs() refused to
  regenerate while the generated-flag was set though content was gone. Guard now
  blocks only on REAL (template-aware) content / meta.company / in-flight /
  pending cloud restore; + a MINIMUM-SECTIONS floor restores the me() skeleton
  if sections ever go fully empty.
- **KERNEL-EXPERIENCE-EMPTY-001** `[FIXED 1.50.280/282/283]` — experience/bring/
  contribute blank. (a) showcase read `ie().roles` & mapped `e.title` but the
  kernel stores `workHistory` with field `role` — fixed + build experience
  deterministically from workHistory; (b) GABRIEL_BG never injected the work
  history into the prompt — now it does; (c) bring mirrors generated CORE
  COMPETENCIES; (d) hardened the showcase flag `p`.
- **LLM-CREDIT-400-MISCLASS-001** `[FIXED 1.50.285/288 + proxy]` — Anthropic
  returns "credit balance too low" as a **400** → was bad_input (no alert/
  fallthrough). PWA surfaces upstream_error + classifies credit as **billing**
  (banner + demote + fallthrough); proxy 400 hint detects it.
- **LLM-MAXTOKENS-TRUNCATION-001** `[FIXED 1.50.289 + proxy]` — fallbacks
  hardcoded `max_tokens:2500` (Claude 32768) → truncated the big CV JSON. D1
  `llm_calls` proved it (Mistral completion = exactly 2500; Gemini ~92). Raised
  fallbacks to 8192 + proxy gemini default 8192.
- **LLM-SILENT-INADEQUATE-001** `[FIXED 1.50.290]` — dispatcher accepted any
  non-null string as success. Added OUTPUT-ADEQUACY GATE (parse_jd/generate_cv):
  reject <800 chars or unbalanced braces → fall through.
- **LLM-COST-QUALITY-ROUTER-001** `[FIXED 1.50.291]` — (#4) gemini→gemini-2.5-pro
  for big tasks only; (#5) quality-aware routing: per (task→provider) demotion
  memory (10-min TTL) sends a provider that returned inadequate/bad_input output
  to the BACK of the order for that task.
- **SALMON-MOBILE-001** `[FIXED 1.50.286]` — measurer read post-transform rects;
  on mobile (scale<1) overflow never tripped. Now divides the limit by column
  scale.
- **SALMON-EXPORT-EXPERIENCE-001** `[FIXED docx-worker, deployed]` —
  renderExperience ignored role.page; now inserts pageBreakBefore (+"(Cont.)")
  at each monotonic role-page increase.
- **SALMON-#185-LOOP-GUARD** `[FIXED 1.50.287]` — measurer 1.5s post-write
  cooldown so it never re-measures its own pagination (breaks #185 oscillation).
- **SALMON-CV-DUPLICATE-001** `[FIXED 1.50.273→reverted 275→re-fixed 292]` — CV
  showed TWO salmon bars + TWO (CONT.). Keep the page-box separator + editable
  cyan cont; `__antcvSalmon` red bar + teal #00746E cont re-gated to CL-only.
- **PB-WORKER-CONT-HEADER-001** `[FIXED docx-worker 1.14.30, deployed — owner export check]` —
  exported page-2 main column showed a stray "CORE COMPETENCIES" heading above
  the EXPERIENCE continuation (previously "SELECTED OUTCOMES"). Root cause: Word
  MERGES contiguous same-grid section-wrapper tables (heading-repeat wrapper,
  1.14.22) and repeats the FIRST table's tblHeader. Fix: a near-zero-height
  separator paragraph after each section wrapper table keeps them distinct, so
  each section's own heading repeats. Owner re-export to confirm.
- **WIZARD-LANG-SELECTOR-001** `[PARTIAL 1.50.284]` — wizard language step was
  blank (React island never rendered). Replaced with a self-contained DOM picker
  (selectable table, ★ DEFAULT on first, ↑/↓ reorder, persists ordered list).
  Single tick+reorder table, not the spec's two side-by-side tables — revisit if
  owner wants the two-table UX.

### OPEN — queued for autonomous session

- **SALMON-CV-MAINROLE-BREAK-001** `[FIXED 1.50.293][HIGH][preview — verified headless]` —
  ROOT CAUSE: the measurer finds experience roles via `[data-antcv-role-index]`,
  but that attribute existed ONLY on the page-2+ explicit per-role render path
  (app.src.js ~38510). On PAGE 1 the experience section renders monolithically
  through `Ce` (the `experience` case), which emitted NO `data-antcv-role-index`,
  so the measurer could never see a role break point on the first page → it never
  wrote `autoPages[experience][n]`, so the main column never broke while the
  sidebar did (which keys off `data-antcv-row-path`, present on page 1). FIX
  (additive): `Ce`'s experience case now emits `data-antcv-role-index` on every
  role wrapper, resolved to the FULL-list index (autoPages keys come from
  `findIndex` over the unfiltered `e.roles` in the `d` page computation) via a new
  `__antcvOrigRoles` prop forwarded from the page-0 render. The render `d`/`g`
  path already consumed `__antcvAutoPB`, so once the break is written the role
  cascades to page 2. VERIFIED in headless Chromium (pwa/test/diag-mainrole-break.mjs):
  overflowing CV → 2 page-boxes, page-1 roles tagged, `autoPages` =
  `{additional:{4:2}, experience:{2:2}}` — sidebar + main break to page 2 IN
  PARALLEL. Boot-smoke clean, 38/38 unit tests pass.
- **SALMON-PARALLEL-COLUMNS-001** `[FIXED — preview 1.50.293; export client 1.50.295 + worker 1.14.39–41; re-verified 2026-06-13 (diag-sidebar-cont-e2e, diag-sidebar-export-page, diag-twocol-paged all green)][preview+export]` —
  PREVIEW side resolved by the same fix as MAINROLE-BREAK-001. With page-1 role
  detection restored, the measurer writes the sidebar break AND the main break at
  the SAME page boundary (both measured against the same USABLE A4 limit from the
  same column top), so the columns paginate in step. The CV main TABLE row-split
  was ALREADY wired (oMain table-row flatMap, app.src.js ~38082, reads
  `__antcvEffBucket`); verified clean in headless (pwa/test/diag-table-split.mjs):
  a 30-row CORE COMPETENCIES table that overflows splits at row 26 → page 2 with
  30/30 rows rendered, NO duplication, NO loss, header repeated on the
  continuation table. The in-place split in `Ce` stays disabled (correct — the
  page-box oMain split owns cross-page movement). **EXPORT closed by the
  per-page two-column rework** — see SALMON-AUTO-EXPORT-001 below (now lifted)
  and the updated export-scope entry:
- **SALMON-PARALLEL-COLUMNS-001 (export scope)** `[FIXED — client 1.50.295+ effective-bucket forwarding + worker ≥1.14.39–41 per-page tables; verified headless 2026-06-12]` — the auto salmon
  must paginate the SIDEBAR and the MAIN column **in parallel / coordinated**:
  when content crosses the A4 line, the sidebar break and the main break happen
  together at the SAME page boundary, and any block that SLIDES to the next page
  must be **CUT from the source page** — never left behind (stranded) and never
  shown on both pages (duplicated). Owner 2026-06-08 (AntCVqq.pdf): "auto salmon
  in sidebar and in main need to work in parallel — e.g. generate new table in
  new page and cut the old items that are sliding." Symptom seen: the CORE
  COMPETENCIES table's rows desync / the moved rows are not cleanly cut when the
  table reflows to the continuation page. **Resolution:** the worker now emits
  ONE two-column table PER PAGE (1.14.39; `splitChildrenByPage` cuts both
  columns on `__antcvPB` markers), so a break in one column can no longer
  desync the other — the columns share the page boundary by construction.
  Tables split by `row_pages` with the header repeated (1.14.38), experience
  by `role.page` (1.14.39), sidebar lists by `item._page` (double-"(CONT.)"
  dedup 1.14.40); column widths from forwarded `sidebar_ratio` (1.14.41).
  Verified: `pwa/test/diag-sidebar-cont-e2e.mjs` + `pwa/test/diag-sidebar-export-page.mjs`
  (coordinated sidebar `_page` + main `role.page`) + `workers/docx-worker/test/diag-twocol-paged.mjs`
  / `diag-twocol-ownerlike.mjs` (N tables = N pages, clean cut, no dup/loss) —
  all green 2026-06-12. Residual pixel-level preview↔export geometry drift is
  tracked separately (PREVIEW-PDF-PARITY-001). Original scope retained:
  (a) CV main NON-experience
  sections — esp. the CORE COMPETENCIES / "What I bring" TABLES — must split by
  ROW with the moved rows removed from the page-1 table and re-emitted in a
  page-2 continuation table (header repeated), never duplicated/lost; (b) the
  sidebar split (already working) and the main split must use a COORDINATED page
  boundary so columns stay in step; (c) experience roles (see MAINROLE-BREAK
  above). Note app.src.js ~4337 explicitly disables in-place CORE COMPETENCIES
  table split today ("Real cross-page movement for CORE COMPETENCIES needs the
  main-column page-box pagination") — that is exactly the gap. Relates to the
  oMain table-row flatMap split (~37741) + the measurer's `firstOverflowRow`.
  Must hold in BOTH preview and export (PDF + DOCX).
- **SALMON-AUTO-EXPORT-001** `[FIXED — stand-down lifted; sidebar auto-break forwards since the per-page two-column rework; verified headless 2026-06-12]` —
  **DONE (client-only, no worker deploy):** the docx-export client
  (`antcv-docx-client.js`) now forwards the EFFECTIVE bucket (manual ∪ auto) for
  the two WHOLE-UNIT, MAIN-column paths that already render identically for manual
  breaks and therefore cannot scramble: (a) EXPERIENCE — each role carries the
  effective `page` = max(manual role.page, auto `autoPages[sid][origRoleIdx]`) with
  a monotonic cascade; the worker (1.50.286) inserts pageBreakBefore + "(Cont.)"
  at each role-page increase. (b) TABLES — `row_pages` = manual itemPages ∪ auto
  autoPages per table; the worker (renderCompetencyTable) splits by row at each
  increase, repeating the header. Both produced by the SAME docx-worker from the
  same payload, so the PDF inherits them. Verified the PAYLOAD in headless
  Chromium (pwa/test/diag-export-autobreak.mjs): with auto breaks
  `{experience:{2:2}, core:{26:2}}`, the POSTed /generate payload carries
  experience role pages `[1,1,2,2]` (cascade) and `core.row_pages={26:2}`.
  **STAND-DOWN LIFTED:** the blocker — "the worker lays both columns as ONE Word
  table row, so a break in only one column desyncs them" — was removed by the
  per-page two-column rework (worker ≥1.14.39: one table per page, both columns
  cut on the same `__antcvPB` boundary). The client now forwards the EXPORT
  break map (`antcv:autoPages`, measured against the Word-equivalent
  USABLE_PDF line — the preview/export two-map decouple) for sidebar list
  items too (`item._page` via pageFor), not just experience/table units.
  Verified `pwa/test/diag-sidebar-cont-e2e.mjs` (real measurer → forwarded
  `_page`) + `pwa/test/diag-sidebar-export-page.mjs` (sidebar + main
  coordinated). Pixel-level geometry drift stays under
  PREVIEW-PDF-PARITY-001. History below retained:
  - only MANUAL breaks (itemPages / role.page) export; the AUTO breaks the measurer creates
  (`antcv:autoPages`) are NOT forwarded to the docx-worker, so the exported
  document does NOT match the preview's salmon. **Applies to BOTH the DOCX and
  the PDF** (owner 2026-06-08: "auto-break export needed also in docx") — both
  are produced by the docx-worker from the same payload, so the auto breaks must
  reach the worker and be rendered as Word page breaks (which the PDF inherits).
  History: auto-break forwarding was stood down in docx-client 1.50.215 because
  raw `autoPages` forwarding scrambled the 2-column layout (isolated candidate
  header → 3 pages, mid-role cut, wrong continuation header). **Fix direction:**
  forward the EFFECTIVE bucket (manual ∪ auto) to the worker AND have the worker
  do group/role-aware 2-column pagination (insert pageBreakBefore at the snapped
  boundary, never mid-group/mid-role), reusing the now-fixed section-table
  separator (1.14.30) and the role.page break path. Verify in BOTH a downloaded
  .docx (Word/Google Docs) and the PDF. Subsumes PB-AUTO-OVERFLOW-001.
- **LLM-QUALITY-PERSIST-001** `[FIXED 1.50.294][enhancement — verified headless]` —
  the per-(task→provider) demotion memory (`__antcvTaskDemote`) is now SEEDED at
  session start from the server-side D1 rolling-window health via the existing
  relay endpoint `GET /api/llm-health?window=60` (no worker change needed — that
  endpoint's own docstring says "the autorotate logic can also call it to
  deprioritise degraded providers"). Rows with status `degraded`/`down` (or
  `health_score < 0.60`) seed `__antcvDemoteProvider(task, provider, 30min)`, so a
  provider consistently bad for a task starts the session already pushed to the
  BACK of the order for that task (the dispatcher already calls
  `__antcvReorderByQuality` at app.src.js ~1497). Strictly OFF the hot path: one
  short-timeout GET fired ~2.5s after load, plus a fire-and-forget fallback on the
  first dispatch (single request per session via the `__antcvQualitySeeded`
  guard); offline / no-relay / 401 / abort is a silent no-op that never blocks or
  delays an LLM call. `__antcvDemoteProvider` now takes an optional TTL and never
  SHORTENS an existing demotion (max of expiries) so a transient 10-min session
  failure can't clobber the 30-min seed. Only `degraded`/`down` are seeded —
  `warning` (0.60–0.85) is left alone (too soft to reorder on). VERIFIED in
  headless Chromium (pwa/test/diag-llm-health-seed.mjs): startup hits
  `/api/llm-health?window=60` on the relay base, 0 errors. Boot-smoke clean.
- **ENHANCE-#185-RESIDUAL-001** `[OPEN / needs repro — synthetic attempt NO-REPRO 2026-06-12]`
  Repro attempt (`pwa/test/diag-so004-185-repro.mjs`): preview inline-edit bursts
  across 8 spans × 3 rounds + section-row interactions produced NO #185, no
  "Maximum update depth", no blue screen — the 1.50.287 loop-guard held. Caveat:
  the editor side-panel FIELD hammering half could not be exercised headlessly
  (panel textareas not reachable via row-click in this harness), so the
  editor-commit path the owner hit is only partially covered. If it recurs after
  a hard refresh, capture the `#antcv-debug` log. Original report: owner hit React #185 on
  "Enhance core competencies" (cached 1.50.285). 1.50.287 loop-guard may fix it;
  if it recurs after hard-refresh capture `#antcv-debug` log (no speculative
  render patch).

### Autonomous session 2026-06-08 (PM) — shipped summary

Worked the prioritized list under full autonomy. Production moved
**1.50.292 → 1.50.295** (PWA auto-deploys on push to main; all three branches —
main, claude/antcv-roadmap-bugs-L9Sqa, plan/2026-06-06-analysis-followups — kept
identical). NO worker deploy was needed this session (the export change is
client-only; the workers already had the consuming code).

**Shipped + verified (headless Chromium + 38/38 unit tests + boot-smoke each):**
- **1.50.293 — SALMON-CV-MAINROLE-BREAK-001** `[FIXED]` and **SALMON-PARALLEL-COLUMNS-001**
  `[FIXED preview]`. Root cause: page-1 experience roles lacked
  `data-antcv-role-index`, so the measurer never detected a main-column break on
  the first page → sidebar broke alone, main overflowed the salmon. One additive
  attribute (resolved to the full-list role index) restored detection. Verified:
  overflowing CV → 2 page-boxes, `autoPages={additional:{4:2},experience:{2:2}}`
  (columns break in parallel); a 30-row table splits at row 26 with 30/30 rows, no
  dup/loss.
- **1.50.294 — LLM-QUALITY-PERSIST-001** `[FIXED]`. Cross-session provider
  demotion seeded from D1 via the existing relay `/api/llm-health` endpoint, off
  the hot path. Verified the startup GET fires.
- **1.50.295 — SALMON-AUTO-EXPORT-001** `[PARTIAL — owner export check]`.
  Client now forwards effective experience `role.page` (cascade) + table
  `row_pages` to the worker (whole-unit main-column paths that can't scramble).
  Verified the /generate payload carries `[1,1,2,2]` role pages + `row_pages={26:2}`.

**Could not complete (need rendered-output verification I can't see, or owner input):**
- **SALMON-AUTO-EXPORT-001 (sidebar half)** — sidebar item auto-break export left
  stood down. It desyncs the worker's single-row 2-column table and its break
  POSITION depends on PREVIEW-PDF-PARITY-001 (preview px ≠ Word geometry). Needs
  the parity fix + coordinated 2-column worker pagination + an owner visual check.
- **PREVIEW-PDF-PARITY-001 / AUTO-PAGEBREAK-CV-MIDGROUP-001** — concrete next step
  is to re-point the `Vi` estimator (app.src.js, currently width 590/11pt) to the
  real PDF column geometry (worker MAIN_W − margins, 10.5pt), but verifying it
  requires comparing preview vs rendered-PDF line breaks (visual). Left for owner.
- **PB-WORKER-CONT-HEADER-001 (item 5, "SELECTED OUTCOMES" wrong cont. heading)** —
  confirmed by reading the worker that the 1.14.30 section-table separator is
  UNIVERSAL (`renderSection` appends it to every section wrapper, not just CORE
  COMPETENCIES), so this pre-1.14.30 table-merge symptom should already be
  resolved by the deployed worker. Owner to confirm with a fresh export. (Possible
  follow-up to watch during that check: the experience wrapper's `tblHeader`
  ["PROFESSIONAL EXPERIENCE"] repeating on page 2 alongside renderExperience's own
  "(Cont.)" heading — a potential double-heading, not verifiable without the render.)
- **PB-WORKER-SIDEBAR-FILL-001 (item 6)** — navy sidebar not filling to the page
  bottom on a continuation page. The full-height-cell technique is known, but a
  blind worker change risks clipping content / forcing extra pages; needs visual
  verification. Not shipped.

New reusable test assets added under `pwa/test/`: `boot-smoke.mjs` (the
blue-screen guard — serve pwa/, assert 0 console errors + `typeof glDemo`),
`diag-mainrole-break.mjs`, `diag-table-split.mjs`, `diag-llm-health-seed.mjs`,
`diag-export-autobreak.mjs` (standalone Playwright diagnostics; not part of the
`node --test` unit suite).

---

## OPEN — 2026-06-07 (page-break arc + kernel / application-history)

### Preview ↔ PDF parity (analysed 2026-06-07)
- **PREVIEW-PDF-PARITY-001** `[PARTIAL][HIGH][export+preview]` — The CL preview
  shows ONE page (no salmon) but the exported PDF overflows, orphaning the
  signature name + AI watermark onto a near-empty extra page. Root causes,
  from a line-by-line PDF-vs-preview comparison of the Unsolicited Open
  Application CL (2026-06-07):
  1. **Vertical mismatch.** DOCX inter-paragraph spacing (`before:240`=12pt on
     section/signature bodies, `before:360`=18pt on the watermark) is far
     larger than the preview's (~3–4px ≈ 2–3pt margins). Accumulated over
     ~10 blocks the PDF is ~120px (~0.85in) TALLER than the preview — enough
     to tip the closing block over the page-1 boundary while the preview
     fits. **Fixed (increment 1, docx-worker 1.14.28 / app 1.50.269):**
     watermark `before` 360→120 (linear only), signature `before` 240→150,
     `keepNext`+`keepLines` on the closing block so it moves as a unit and
     can't orphan a single line. Reconciles THIS one-page letter.
  2. **Horizontal mismatch.** Same font/size (Carlito 10.5pt) but the PDF
     text column is slightly WIDER than the preview's → PDF fits ~1 more word
     per line. Examples: WHO-I-AM L2 PDF "…technical problem" vs preview
     "…technical"; WHY L1 PDF "…scope aligns" vs preview "…scope"; HWIC intro
     PDF "…I would focus" vs preview "…I would". So on-screen line breaks are
     NOT the real ones. **Increment 2 — CLOSED BY CONSTRUCTION (2026-06-12,
     R36 spacing parity):** with the spacing-slider forwarding (edge, seam,
     sidebar pad) both sides now derive every horizontal dimension from the
     SAME ratio × page width − px-equal margins. Numeric audit at the comfort
     defaults: CV main text width preview 794×0.67 − (14+6) − 14 = 498.0px vs
     worker (7977 − 510 DXA)/15 = 497.8px; CL linear 780 vs 780.4px; sidebar
     240 vs 239.9px. The residual line-break drift is FONT SHAPING (browser
     vs LibreOffice glyph metrics), irreducible without embedding identical
     metrics — sub-word-level, no longer a column-width class mismatch.
     Owner visual confirm on the next export closes the whole entry.
  3. **Estimator targets a third geometry.** `[FIXED 1.50.296 — owner visual check]`
     The line/tightening counter `Vi(text, 590, 11, …)` (`app.src.js`) used width
     590px / 11px — matched neither the preview nor the PDF. Now re-pointed to the
     REAL docx-worker PDF text geometry, derived from the worker's FIXED DXA
     constants (px = DXA/15 at 96dpi): CV two-column main = MAIN_W(7270) − 288
     (L/R cell margins) = 6982 DXA = **466px**; CL full-width linear = PAGE_W(11906)
     − 200 = 11706 DXA = **780px**; sidebar = SIDEBAR_W(4636) − 288 = 4348 DXA =
     **290px**. Font is now **14px = 10.5pt** main (×96/72), 13px = 10pt sidebar.
     Both the `Gi` candidate finder (7 main-prose calls, now doc-aware width) and
     the second loc-aware tightening pass were updated; the sidebar branch of the
     second pass went from a wildly-wrong 590px to the real 290px. So fit-it /
     enhance / tighten now optimise against the actual exported artifact (owner:
     "tightening rules must follow the real PDF, not the theoretical"). Tracks the
     DEFAULT 10.5pt/10pt font sizes (the old code was likewise a constant). VERIFIED
     mechanically (no `590,11` left, geometry present in the minified build,
     boot-smoke clean, 38/38 unit tests). **OWNER VISUAL CHECK:** confirm that
     after fit/enhance/tighten a main-column line that was overflowing in the PDF
     now fits — I cannot compare rendered-PDF line breaks.
- **AUTO-PAGEBREAK-CV-MIDGROUP-001** `[LIKELY ADDRESSED by dual-map measurer e50973f/1.50.350 — owner export-verify]` —
  the architectural fix this item called for ("the measurer must compute against
  PDF-equivalent heights") landed as the **dual-map** measurer: `antcv-auto-pagebreak-
  block-001.js` now keeps a PREVIEW map and an EXPORT map, and each measures against ITS
  OWN A4 line — export at `USABLE_PDF` (~949px), preview at `USABLE` (~1053px) — instead
  of one shared geometry (EXP-PREVIEW-GAP-001 `e50973f`, supersedes EXP-PREVIEW-CROWD-001;
  experience roles are atomic so the first crossing role moves whole). This is exactly the
  per-geometry height model the old "increment 2" note asked for, applied at the role/box
  level. **Owner export-verify owed** to confirm group/sidebar cuts also land clean in the
  PDF; if a mid-group cut still appears, it's a residual of the worker spacing model, not
  the measurer. *(original conclusion retained below)*
  CONCLUSION
  the owner asked for (2026-06-07): the CV mid-group cut is the SAME root
  cause as PREVIEW-PDF-PARITY-001. `antcv-auto-pagebreak-block-001.js`
  (1.50.268) measures overflow against the **preview** DOM heights and snaps
  the autoPages break to a group boundary — but because the **PDF** has the
  larger `before:240` spacing, the PDF's group positions sit lower than the
  preview's, so the break the measurer chose (correct for the preview) lands
  MID-GROUP in the PDF. **Fix (increment 2):** the measurer must compute
  against PDF-equivalent heights (apply the docx spacing model when summing
  item heights), OR increment 1's spacing reconciliation must extend to the
  per-section bodies so preview height ≈ PDF height everywhere. Until then,
  expect occasional CV group/role splits that look right in the preview but
  cut mid-group in the PDF.

### Export
- **DOCX-EXPORT-CORS-CPU-001** `[MITIGATED 1.50.244/248 — residual infra decision is the owner's]` — DOCX export failed with
  *"Access to fetch at 'https://docx-worker.../generate' from origin
  'https://antcv.pages.dev' has been blocked by CORS policy: No
  'Access-Control-Allow-Origin' header is present"* on a tailored Kvadrat
  generation (CL+CV, consensus poll active). **Diagnosis (read-only probe of
  the live worker):** the worker itself is healthy — OPTIONS preflight,
  POST 422 on bad payload, and a minimal /generate call ALL return proper
  CORS headers (`Access-Control-Allow-Origin: https://antcv.pages.dev`).
  /health reports `1.14.27-header-thin-2pt-name-pad`. The error must therefore
  be one of: (a) Cloudflare Workers **CPU limit exceeded** mid-request (the
  worker is killed, Cloudflare serves its own error page WITHOUT CORS), (b)
  payload > 4 MB (returns 413 *with* CORS — wouldn't produce this error), or
  (c) intermittent edge timeout. (a) fits best for a tailored CV+CL with
  consensus poll: docx-js packing is CPU-intensive and the worker isn't on
  Workers Unbound. **Mitigations to consider (none deployed yet):**
  - Move the worker to **Workers Unbound** (`[placement] mode = "smart"` +
    paid Unbound subscription) so CPU caps go from ~50 ms → 30 s.
  - Stream docx generation in chunks where possible.
  - Smaller payload defaults (drop the photo to a much-smaller thumb
    pre-export, skip optional sections by default).
  Client-side todo **DONE (1.50.244 / 1.50.248, antcv-docx-client.js)**:
  the /generate fetch is wrapped — a network-level failure (CORS-blocked
  CPU kill, edge timeout) auto-retries once after 1.5 s, the worker is
  warmed via a /health GET before the real POST, and a remaining failure
  throws a user-readable message with the payload/photo size and concrete
  next steps instead of the raw `TypeError: Failed to fetch`. Residual
  (owner decision, not code): if it keeps failing on normal-sized CVs,
  move the worker to a longer CPU budget (Workers paid tier /
  `[limits] cpu_ms` in wrangler.toml).

### Wizard / languages
- **WIZARD-LANG-SELECTOR-001** `[OPEN][feature]` — **Wizard language step + two-table language
  selector** (owner spec 2026-06-07; also in `docs/FEATURES_REGISTRY.md`).
  1. The wizard "language set" step must actually **show the languages selector** — it is
     currently missing / not rendered on that step (note prior wizard work hid the language
     slide on SKIP; here it must appear when the step is shown).
  2. Render the selector as **two tables side by side**:
     - **Left = all available languages** (the full supported set — en, da, sv, de, fr, es, …;
       source of truth is the `writingSystems/registry.json` language partition).
     - **Right = selected languages** (the user's chosen subset). Move entries left↔right to
       add/remove.
  3. The **right (selected) table is reorderable**, and its **order sets the default language —
     the first entry in the selected list is the default**, which drives the generation /
     `meta` default language. Persist the ordered selected-language list and the derived
     default (and reflect it in Settings → Personal LanguageCard).
  Relates to WIZARD-002 (default languages + settings hand-off). Not started — documented per
  owner request as a feature to implement.

### Page breaks / pagination
- **PB-OUTCOMES-WIPE-001** — `[FIXED→VERIFYING]` A page break on SELECTED OUTCOMES
  **deleted all outcomes** (and produced no break). Same class as the HIWC bullet wipe:
  `selected-outcomes-row-controls-237` `setPage()` fired `antcv:sections-updated`, forcing
  a re-render that read the momentarily-empty outcomes editor and wrote `items:[]`. Fixed
  1.50.218 — `setPage` now fires the page-only `antcv:item-pages-changed`. Owner to confirm.
- **PB-WORKER-CONT-HEADER-001** — `[RESOLVED in the per-page model — regression-tested
  2026-06-11]` In the exported PDF/DOCX, the EXPERIENCE continuation heading on page 2
  rendered as "SELECTED OUTCOMES" instead of "EXPERIENCE (CONT.)". The 1.14.39+
  per-page two-column rework (one table per page) plus the 1.14.30 section separator
  eliminated the table-merge that stole the heading: a live worker probe (deployed
  src/index.js bundle driven in node) shows page 2's main column carrying exactly ONE
  "PROFESSIONAL EXPERIENCE (Cont.)" heading — no stray SELECTED OUTCOMES, no doubled
  plain heading. Locked by `diag-twocol-ownerlike.mjs` (payload now includes a
  SELECTED OUTCOMES section before EXPERIENCE; asserts the page-2 heading set).
  Owner export check remains a nice-to-have, no longer blocking.
- **PB-WORKER-SIDEBAR-FILL-001** — `[FIXED — worker 1.14.54, owner-confirmed mechanism]`
  The navy sidebar did not fill to the page bottom on continuation pages **in the
  export**. Fixed in the worker: every two-column body row carries an "atLeast"
  height (page 1: 13260 DXA under the header band; pages 2+: PAGE_H − 600) so the
  sidebar cell's navy shading stretches to ~0.5–1cm above the page edge. The slack
  is deliberate — exact-fill heights made LibreOffice (/generate-pdf) overflow each
  sheet by a sliver and emit blank pages / swallow sidebar lines (PDF-BLANK-PAGE-001,
  fixed 1.14.54). See `makeBodyRow` in workers/docx-worker/src/index.js.
- **PB-PREVIEW-SIDEBAR-FILL-001** — `[FIX SHIPPED 1.50.227 — owner visual verify]` In the
  **preview**, the navy sidebar still didn't run to the page bottom — the 1.50.216 approach
  relied on flex `align-items:stretch` + a fixed `min-height:1123px`, which caps it at one A4
  page and doesn't track the real main-column height. New sidecar
  `antcv-sidebar-fill-equalize-227.js` measures the main column in each `.antcv-page-row` and
  sets the sidebar height to match (inline `!important` to beat the 216 rules), re-running on
  every content mutation (line insert), section/page-break events, and resize. The DEMO
  watermark is `position:absolute; inset:0` inside the row, so it covers the full page once the
  sidebar matches main — no separate watermark move needed. **Owner to visually verify** the
  navy field reaches the content bottom on single + multi-page kernels and after edits; then
  re-check the watermark sits right (per owner's "watermark only after that"). Boot-verified
  (sidecar registers, 0 console errors); functional height match needs a real rendered preview.
- **PB-AUTO-OVERFLOW-001** — `[FIXED — rebuilt; subsumed by SALMON-AUTO-EXPORT-001]`
  Auto-overflow was built (1.50.211–214) then stood down (1.50.215: forwarding the
  sidebar auto-break into the single-row 2-column worker scrambled the PDF). The
  rebuild called for here exists: the measurer (`antcv-auto-pagebreak-block-001.js`)
  writes the two break maps (preview + Word-equivalent export), the client forwards
  the effective bucket, and the worker does group/role-aware per-page 2-column
  pagination (≥1.14.39–41). See SALMON-AUTO-EXPORT-001 above for verification.
- **PB-PREVIEW-GROUPNAME-EDIT-001** — `[FIXED 1.50.398 — superseded by PREVIEW-EDIT-PERSIST-001, verified headless]`
  A group-name edit from the preview did not persist. ROOT CAUSE (owner directive
  2026-06-12 "make sure ALL text edits in preview persist, not just groups"): preview
  inline edits are NOT committed by app.js's React onBlur (text-edit mode is off by
  default — the spans render the non-editable branch) but by
  `antcv-preview-bullets-dedup-341.js`'s blur handler, whose text-match walker only
  covered section-level strings, string arrays, and table rows. Object items
  ({b,t} outcomes, {l,v}/{group} labeled lists, {deg,sch} education), EXPERIENCE
  roles (title/company/years/bullets) and the section TITLE silently reverted on
  the next re-render. The walker now covers every text-bearing shape.
  Verified `pwa/test/diag-preview-edit-persist.mjs` — 9 edit types, each
  located → committed → survives reload → re-renders: all green.

### Kernel / generation / application history (testing is painful because of these)
- **KERNEL-REGEN-GUARD-001** — `[FIX SHIPPED 1.50.225 — owner verify]` Generating without a JD
  used to **force a brand-new kernel** every time (`_antcvGenerateKernelShowcase({force:true})`),
  silently replacing a saved kernel. `Cs()` already self-guards (it skips when a kernel exists
  unless `{force:true}`), but the main Generate button always passed `force`. Fix
  (`app.src.js`, the no-JD branch of the "Generate CV & Cover Letter" handler ~35900): if a
  kernel already exists, **default is to KEEP it** — the prompt offers OK = generate a NEW
  kernel (explicit, non-default) / Cancel = keep & open the existing one, and reminds the user
  that Settings → "Regenerate showcase" also rebuilds it. A new kernel is auto-built only when
  none exists. Verified: terser identity-safe, 0 `"use strict"`, 29/29 unit tests, boot 0
  errors. PWA-only (no worker deploy). Owner verify: with a saved kernel, Generate-without-JD
  should prompt to keep vs. rebuild rather than silently regenerating.
  **Follow-up (1.50.226):** same keep-existing guard applied to the **Editor button** no-JD
  path (`app.src.js:~34082`) — when a kernel exists it now just opens the editor (never
  regenerates); it only bootstraps a starter kernel when none exists. The wizard-close
  (`~24355`) and Settings "Regenerate showcase" (`~33873`) force-paths are intentional and
  left as-is.
  **Hardening (1.50.229) — Editor regression fixed:** owner reported "I have a kernel in
  memory, hard refresh, pressing Edit still started a new kernel generation." Root cause:
  both the Editor button guard AND `Cs()`'s own self-guard gated on the single boolean
  `kernelShowcaseGenerated` — if that flag was missing (cloud-restore lag, older sessions,
  any local-only kernel) BOTH guards failed and `Cs()` regenerated. Fix:
  (a) The Editor button **never** calls `Cs()` anymore. It opens the editor, and if any
  kernel-of-any-kind signal is present but the local copy is incomplete, hydrates from the
  dedicated cloud slot. New users get an empty editor; generation is reserved for the
  explicit (already-guarded) Generate button.
  (b) Hardened `Cs()`'s self-guard with **multi-signal detection** — `{force:true}` is now
  required if ANY of: the cloud flag, in-flight flag, **local `sections.cv`/`cl` content**,
  or **`meta.company`** is set. So no future caller can accidentally wipe a kernel.
  Verified: terser identity-safe, 0 `"use strict"`, 29/29 tests, boot 0 errors.
- **KERNEL-CLOUD-PERSIST-001** — `[FIX SHIPPED 1.50.221 — needs relay deploy + owner live-verify]`
  The generated kernel is **not saved to cloud memory** — must be regenerated every
  session/tab-switch; makes page-length testing a long regenerate cycle.
  **Trace (read-only):** the store `u` is localStorage-only (`app.src.js:296`); the showcase
  content (sections/meta/rationale) was written to localStorage only, while just the boolean
  `kernelShowcaseGenerated` synced to cloud via prefs (relay allowlist `index.js:739`). A fresh
  session has empty localStorage + a true flag → it regenerates. The old nested
  `personalInfo.showcaseBackup` field was deprecated (the `Zn` strip fn at `app.src.js:11438`
  even says "future schema uses top-level cloud key instead").
  **Fix (1.50.221) — dedicated cloud slot** (owner-chosen approach):
  - **access-relay**: new `kernel_showcase` D1 table (one row/user; `schema.sql`) + `GET`/`PUT
    /api/kernel-showcase` handler (`src/index.js`, modelled on `/api/applications`; defensive on
    missing table). **D1 migration already applied to live `ant_memory`** (`CREATE TABLE IF NOT
    EXISTS`, additive/non-destructive, verified via PRAGMA).
  - **PWA** (`app.src.js`): `oo.getShowcase()`/`putShowcase()` clients; persist on showcase
    completion (delayed read of canonical store values, fire-and-forget); restore effect on load
    (signed-in + no local copy → hydrate sections/meta/rationale via `ao`/`lo`/`bo`).
  - Verified: relay `node --check` OK; terser rebuild identity-safe, 0 `"use strict"`, 29/29 unit
    tests, browser boot 0 errors. **Graceful pre-deploy:** if the relay route isn't live yet the
    client calls throw and are caught (no UI impact).
  **Needs:** relay deploy via `deploy.yml`, then owner live-verify (generate showcase →
  hard-refresh/new tab/2nd device → it restores instead of regenerating).
- **KERNEL-SPECIALIZATION-LINE-001** — `[FIX SHIPPED 1.50.224 — owner verify]` The kernel does
  **not write to the specialization line**.
  **Trace:** the kernel/showcase generation DOES write the specialization line into meta
  (`io.subtitle`) at `app.src.js:~19793/19876` (derived from the profile headline). The real
  gap was downstream: that subtitle was **never persisted per-application** — the `application`
  D1 table had no `subtitle` column, so it was lost on save and not restored on reload (so it
  looked like the kernel "didn't write" it). Resolved by the subtitle-persistence change shared
  with APPHISTORY-SAME-LINE-001 (1.50.224 below). Owner verify: generate → save → reload, the
  specialization line should survive.
- **APPHISTORY-SAME-LINE-001** — `[FIX SHIPPED 1.50.223 — needs relay deploy + owner verify]`
  Saving to Application History writes to the **same line** rather than its own slot — owner
  confirmed 2026-06-07: "new applications are saved to the first in list — no new saves (no
  save-as upon changes)".
  **Root cause (read-only trace):** the "💾 Save current as new application" button
  (`app.src.js:~32887`) always `oo.create` with `jd_text = (zt.text) || Ut || (showcase ? ks
  : "")` and hardcoded `category:"unsolicited"`. The relay upserts on
  `(user_hash, jd_hash=SHA256(jd_text))` (`access-relay/src/index.js:~2042`, `UNIQUE` at
  `schema.sql:42`). On a kernel showcase / no-JD draft, `jd_text` is the same constant every
  time → identical `jd_hash` → every save UPSERTs the **same first row**; no new entries.
  **Fix (1.50.223):** the button now sends `save_as_new:true`; the relay, when that flag is set,
  salts the hash (`jdHashFromText(jdText + '|new|' + Date.now() + '|' + Math.random())`) so each
  save inserts a **distinct** row. Real-JD dedup (re-uploading the same JD updates its row) is
  preserved whenever the flag is off. Verified: relay `node --check`, terser identity-safe
  rebuild, 0 `"use strict"`, 29/29 unit tests, browser boot 0 errors.
  **Needs:** access-relay worker deploy (same one 1.50.221 needs), then owner verify — save a
  couple of drafts → each appears as its own entry in the list.
  **Subtitle-persistence follow-up (1.50.224):** the `application` table had no `subtitle`
  column, so the specialization line was dropped on save and not restored on load. Added
  `subtitle TEXT` to `schema.sql` + **live D1 `ALTER TABLE` applied** (additive); the relay
  POST/PUT now store it (INSERT + UPSERT + `shapeApplicationRow` read shape); the client sends
  `subtitle` on create and on the save-prior update, and both load handlers now restore
  `n.subtitle` instead of keeping the current value. Resolves the lingering subtitle half of
  SAME-LINE and KERNEL-SPECIALIZATION-LINE-001. Needs the relay deploy + owner verify.
- **APPHISTORY-RELOAD-001** — `[FIX SHIPPED 1.50.222 — owner live-verify]` Pressing a saved
  Application-History item **does not load** that saved application — forces a full regenerate.
  **Trace (read-only, owner-approved fix):** there are two load surfaces, both in `app.src.js` —
  the Settings History list (`~33143`) and the top-bar dropdown (`~37556`). Both correctly
  restore state on click — `oo.get(id)` → `ao({cv,cl})` + `lo({company,role})` + `bo(rationale)`
  + `setActive` + `Ml(id)` — but **neither switched the view to the editor**: the Settings one
  closed no panel (`q` = Settings overlay state, `[K,q]`), the top-bar one only closed its
  dropdown (`Jl(!1)`). So the CV loaded into state while the user stayed on the
  Settings/History view → looked like "nothing loaded".
  **Fix (1.50.222):** after the restore, both handlers now `$t("editor")` (surface the editor),
  and the Settings handler also `q(!1)` (close the Settings overlay) — matching the post-generate
  pattern (`app.src.js:~21324`). Added a `[APPHISTORY-RELOAD-001]` diagnostic log of what
  `oo.get` returned (cv/cl lengths, company) to confirm live whether any residual "blank load"
  is empty stored sections vs. the now-fixed view-switch. Client-only. Verified: terser
  identity-safe rebuild, 0 `"use strict"`, 29/29 unit tests, browser boot 0 errors.
  **Owner live-verify:** click a saved app in Settings History AND in the top-bar dropdown →
  editor should appear with that CV. If a load still looks blank, the console log shows whether
  the stored cv/cl sections are empty (→ SAME-LINE save follow-up).
- **KERNEL-STUCK-LAST-CMD-001** — `[FIX SHIPPED 1.50.220 — awaiting owner live-verify]`
  The kernel sometimes appears **stuck on the last command**; a **browser refresh**
  surfaces the generated kernel — i.e. the result was ready but the UI didn't update
  without a reload.
  **Trace (read-only):** the stuck UI (the fixed top "Generating kernel showcase…" banner,
  effect at app.src.js ~23577 keyed `[Pl]`, plus the "Showcase…" pill ~36999) is driven
  entirely by the React state `Pl` (`[Pl,Bl]=useState(!1)`, the reactive mirror of the
  `kernelShowcaseInProgress` store flag). The generator `vl` is `async` and the completion
  clears (`Bl(!1)`) live in `vl`'s success tail (~21204), `Cs`'s `.finally` backstop
  (~24175), and the `io.company`-change effect (~12564, **Unsolicited case only, fires only
  on change**). If a post-result step in `vl()` hangs, or `io.company` doesn't change, or an
  error path is taken, `Pl` can stay true though the result is already in state — and only a
  reload's mount-effect recovers it. This matches "result was ready, refresh fixes it."
  **Fix (1.50.220):** added an **additive UI watchdog** effect keyed `[Pl]` (right after the
  banner effect) — when `Pl` flips true it arms a 120s backstop (2× the ~60s max gen time)
  that clears `kernelShowcaseInProgress` + `Bl(!1)` if still in progress, so recovery is
  automatic with no reload. UI-only; touches **no** generation/cloud path. Verified: terser
  rebuild (identity-safe), `node --check` OK, 0 `"use strict"`, 29/29 unit tests, real-browser
  boot 0 errors. **Owner to live-verify:** trigger a kernel showcase, confirm the banner/pill
  clear on completion normally, and (if you can reproduce a stuck run) that it self-clears
  within ~2 min instead of needing a refresh. If 120s feels long, the value is a one-line tune.

---

## STATUS UPDATE — 2026-06-06 (owner live-confirmed)

### Closed ✓ (owner-confirmed on real devices)

- **DEMO-PERSIST-001** — `[FIXED✓]` The demo account was server-classified as "paid"
  (`demo_mode:false`), turning off every demo signal. Root cause: the relay's
  `getUserMode` defaulted everyone to `paid`, and a client mode-POST could overwrite it.
  Fixed by **pinning `DEMO_EMAILS` accounts to `demo`** (relay `auth-25`), so `demo_mode`
  stays reliably true (badge, setup-chip gating, watermark all correct). Owner-confirmed.
- **DEMO-BADGE-001** — `[FIXED✓]` The "🟡 DEMO" badge was hard-coded to one email. Re-gated
  to the real `B.demo_mode` (unpaid) signal (PWA 1.50.170), unblocked by DEMO-PERSIST-001
  above. Owner-confirmed.
- **PACKAGE-PALETTE-MIX-001** — `[FIXED✓]` The "mixed visual style" (e.g. Copenhagen
  structure + stale Warm-Terracotta accents) on load / mobile. Root cause: the deployed
  `app.js` had diverged and lacked the v1.50.166 derive-on-mount effect; even that ran once
  before cloud-restore. Fixed with a **self-healing effect** (PWA 1.50.180) that re-derives
  a named package's accents whenever `styleConfig` drifts from its palette — survives
  cloud-restore, works on mobile, custom configs exempt. Owner-confirmed ("finally
  resolved 🎉"). The orphan-apply workaround sidecars can now retire.
- **HARDREFRESH-001** — `[FIXED✓]` In-app Hard Refresh did not force a reload after
  clearing caches/SW. Fixed (PWA 1.50.172/1.50.180) by firing a `location.reload()`
  ~3s after the confirm passes. Owner-confirmed ("in app hard refresh works").
- **DOCX-CL-SECTION-WIDTH-001** — `[FIXED✓]` Every **titled cover-letter section**
  (WHO I AM, WHAT I BRING, WHY THIS POSITION, HOW I WOULD CONTRIBUTE, FOUNDATION) rendered
  at **~60% width** in Google Docs. Root cause: the 1.14.22 heading-repetition wrapper sized
  its column to `MAIN_W − 288 = 6982` (the CV's *main-column* width). The CL is a single
  full-width **linear** doc — its body cell content is `PAGE_W − 200 = 11706`, so 6982 is
  ~60% of the available width. 1.14.23 then mis-sized the WHAT-I-BRING competency table to
  `MAIN_W − 640 = 6630` for the same wrong reason. Fixed (**docx-worker 1.14.24**): CL
  titled-section wrappers now span the full body width (`PAGE_W − 200`) and the nested
  competency table fits just under it (`PAGE_W − 560`). CV paths unchanged.
  **Follow-up (docx-worker 1.14.25):** 1.14.24 fixed the *emitted* gridCol (11706) but
  Word + Google Docs still rendered the sections at **~80%** — the heading-repetition
  wrapper nested them THREE tables deep and both renderers mis-compute widths for
  triple-nested tables. Final fix: for the CL, emit the heading + body **directly** into
  the full-width body cell (no wrapper — that only exists for the CV's sidebar/main
  columns), so titled sections match the untitled CL paragraphs. WHAT-I-BRING drops from
  triple- to single-nested. Verified in emitted XML.
- **DOCX-HEADER-BAND-001** — `[SHIPPED, awaiting owner confirm]` The running header (which
  carries the DEMO watermark) rendered as **white "lines" above the name** in Word and
  Google Docs. Fix (**docx-worker 1.14.25**): shade the header paragraph with the
  candidate-band colour (`headerBg`, palette-responsive) and create the header for **every**
  doc — CV + CL, demo **and** non-demo — so the band colour repeats at the top of every page
  (page-break continuity, per owner request). DEMO WordArt included only when a watermark is
  requested. Name paragraph top space removed (`before:60→0`). The 12-pt strip height may
  need tuning once seen in Word/Google (render can't be verified server-side).
- **DOCX-CONFIG-404 / proxyUrl misconfig** — `[NOT A BUG / config]` Owner saw a CORS + 404
  on `GET https://docx-worker.../config` and worried a deploy "damaged the secrets". The
  docx-worker has **no `/config` route** (by design — `/config` lives on the access-relay).
  The demo-watermark sidecar calls `<localStorage.proxyUrl>/config`, and the owner's stored
  `proxyUrl` is pointed at the **docx-worker**. The 1.14.24/1.14.25 deploys only changed
  table-width logic, the header, and the VERSION string — no routes/CORS/secrets touched,
  and `wrangler deploy` never clears secrets. Confirmed via `git log -S'"/config"'`: the
  docx-worker has **never** had a `/config` route, so restoring an older deploy can't help.
  **Durable fix (PWA 1.50.182):** the demo-watermark sidecar now resolves `/config` from
  the relay (`window.ANTCV_RELAY_URL` → `localStorage.relayUrl`), falling back to `proxyUrl`
  only as a last resort, and caches only on a successful response. Relay URL (from
  `pwa/relay-config.json`): `https://antcv-access-relay.karp-gabriel-a.workers.dev`. Ships
  to production when the branch merges to `main` (Pages auto-deploys PWA from `main` only).
  Immediate workaround: reset the Proxy/Relay URL in Settings to the relay URL above.
  Document generation (`/generate`) is unaffected throughout.

### New — OPEN

- **PERSONAL-EDIT-CRASH-001** `[FIXED✓ 1.50.185]` — fixed by the **React DOM guard**
  (`antcv-react-dom-guard.js`, commit f9e9f0a): a new early-loading sidecar makes
  `Node.removeChild`/`insertBefore` defensive — when the target isn't actually a child
  of the parent (the only case the native call throws), it no-ops instead of crashing,
  converting the fatal throw into a harmless no-op. Loads after the console quieter,
  before React mounts. Set `localStorage.antcvDomGuardVerbose=1` to log the offending
  sidecar so the root mutator can later be fixed and the guard retired. This is the
  canonical React-vs-third-party-DOM mitigation and exactly matches the diagnosis below.
  Removed from open bugs. Diagnostic history retained for reference:
  Typing into a **Settings → Personal**
  subtab field (e.g. the name) **blue-screens on a real mobile device** (not in the
  simulator; no other subtab affected). The typed value **persists** (the `PUT /api/prefs`
  save succeeds — confirmed in Cloudflare worker logs), so the state update works and the
  **React render crashes** (caught by the error boundary, which swallows the error). No
  device console available. Crash capture added (PWA 1.50.181) + a remote crash logger
  (POSTs the error to the relay so it appears in exportable worker logs) — awaiting the
  captured error to pinpoint the throwing render.
  **Captured stack (owner, 2026-06-06):** `Uncaught NotFoundError: Failed to execute
  'removeChild' on 'Node': The node to be removed is not a child of this node` from
  react-dom's commit/deletion phase (`Di`/`Aa`/`Fi`). This is the signature of **a
  sidecar mutating DOM that React owns**: the Name keystroke re-renders the
  candidate/preview subtree, but a preview-editor sidecar had already moved/replaced
  nodes there, so React's `removeChild` hits a node that is no longer its child →
  unmount → blue screen (data persists because the PUT already ran). Prime suspect: the
  contenteditable Name/Specialisation wrap (`antcv-candidate-preview-editor-341.js`) or a
  newer preview-control sidecar. Fix direction: stop that sidecar mutating React-owned
  nodes (wrap/move via a portal or React-safe anchor), or guard so reconciliation can't
  trip. **On-device capture (complements the relay logger):** `antcv-debug-logger.js`
  (v1.50.182) persists the error + a breadcrumb trail to localStorage and shows them in a
  plain-DOM viewer that survives the crash + reload — open with `#antcv-debug` or a 4-tap
  top-right corner; readable on the phone with no terminal.

### Infra + features (2026-06-06, session branch)

- **BUILD-APP-BROKEN-001** `[FIXED 2026-06-12 — build:app repointed to terser]` — both
  root causes are now closed: (1) `app.src.js` already declares `window.glDemo`
  (explicit global, line ~18604) so the implicit-global double-emit is gone; (2) the
  `build:app` npm script was repointed from the unsafe esbuild `--minify` (which
  prepends `"use strict"` and broke the sloppy-mode bundle) to the proven
  `npx --yes terser pwa/app.src.js -c -m -o pwa/app.js`. **Identity round-trip gate
  PASSED:** `npm run build:app` on the unedited source produces a bundle BYTE-IDENTICAL
  to the committed `pwa/app.js` (871,787 bytes, `cmp` clean), `node --check` OK, starts
  `(()=>{`, 0 `"use strict"`. So `app.src.js` has no drift from `app.js` and source
  edits can now be rebuilt safely with the standard script. Closes APPJS-REBUILD-001.
  *(superseded — original report retained below)* `[OPEN][HIGH][infra]` — **`npm run build:app` produces a
  broken bundle.** Rebuilding `pwa/app.js` from `pwa/app.src.js` with esbuild 0.21.5
  yields `Uncaught ReferenceError: glDemo is not defined` at render (verified via the
  browser-QA `boot` gate: committed bundle = 0 JS errors, rebuilt = throws). Root
  cause: `app.src.js:16092` assigns `glDemo` as an **implicit global** inside a
  component (`((glDemo = ({proxyUrl}) => {…})`) and uses it at `28873`; the committed
  working bundle resolves this (glDemo appears once), a fresh esbuild build does not
  (appears twice, lazy global write never lands before the read). This is the
  `250ec8d` revert reproduced. **Impact: blocks every native `app.src.js` change**
  (the PERSONAL-EDIT-CRASH-001 fix sidestepped this by shipping as a standalone
  sidecar, but any future *source* edit is still blocked until this is fixed). Fix
  options: (a) declare `glDemo`
  properly (`window.glDemo`/hoisted `var` at module top) and re-verify the full boot,
  or (b) pin the exact esbuild used for the deployed bundle. Until fixed, app.js
  changes ship via surgical unique-string injection into the working bundle (the #226
  technique) + a `boot` gate.
- **FT-DEBUG-LOGGER subtab** `[SHIPPED]` — added **Settings → Advanced → Debug** (a
  native subtab in `app.src.js`, and injected into the working `app.js` at 1.50.182):
  Open debug log / Clear / "Capture typed values" toggle + the `#antcv-debug` /
  4-tap hints. Boot-verified (0 JS errors). Gives on-device access to the crash
  logger with no terminal.

### Triage round 2 — additional dispositions (owner chat 2026-06-06)

- **SETTINGS-NAV-Z-001** `[OPEN]` (canonical) — Settings subtab / Application-History
  opens BEHIND the preview (z-index trap); the preview overflow menu doesn't route to it
  either. Absorbs **APP-HISTORY-001, SETTINGS-SUBTAB-001, SETTINGS-AHZ-001, AH-001,
  VF-014, APPHIST-ZIDX-001** (owner: all the same bug). Drive with
  `antcv-apphist-zindex-probe.js`.
- **SPECIALISATION-EDIT-001** `[FIXED]` — verified in code: `wrapSpecialisation()` makes
  `meta.subtitle` contenteditable; loaded `?v=1.50.106-spec-edit`.
- **DEMO-TOGGLE-001** `[WONTFIX]` — not needed; the wizard handles demo→normal.
- **DOCX-EXPORT-REGRESSION-001** `[WONTFIX]` — redundant; the print-setup view is skipped.
- **WIZARD step 6b** `[DONE]` — already scrollable; only step 6d remains.
- **DEMO-WARN-NONDEMO-001** `[BLOCKED]` — not testable until the privacy LED renders.
- **GEN-UNSOL-002** `[OPEN, needs live JD test]` — confirm generate emits a JD-grounded
  `meta.company`/`role` so a blank Company field doesn't fall to "Unsolicited".
- **PROCESSING-QUEUE-INDICATOR-001** `[OPEN][feature]` — per-subsection **pink
  "processing"** while actively worked (language change, new JD/kernel, compress, enhance)
  and **yellow "queue"** when scheduled later in the same command (enhance-over-subsection
  → first pink, rest yellow). Plus: **CJLR** (Center/Justify/Left/Right) buttons working in
  **every** sub-subsection. Also in the feature registry.
- **AUTO-PAGEBREAK-BLOCK-001** `[OPEN][feature]` — **always** show the salmon splitter when
  content exceeds one A4 page in preview; sliding is **block-level** (a whole sub-subsection
  moves to the next page — never partial, never the whole parent subsection). Reconcile with
  PB-001..006 + EXPORT-PAGE2-001. Also in the feature registry.
- **PACKAGE-PALETTE-MIX-001** — superseded: **FIXED✓** per the status update above
  (self-healing effect, PWA 1.50.180). My earlier "still OPEN" re-verification ran against
  the stale 1.50.166 tree; the browser-QA `palette-mix` gate should be re-pointed at the
  1.50.180 self-heal (it asserts `localStorage.stylePackage` resolves to a registry id — now
  expected to pass).

---

## SESSION 2026-06-06 — visual-package/palette root fix + UX/data/console batch

Owner-driven batch (Claude Opus). Production reached **PWA 1.50.166** + **docx-worker
1.14.17**. All items below MERGED to `main` and live on `antcv.pages.dev` unless
marked otherwise. Cloudflare Pages auto-builds production from `main`; the docx
worker was deployed via `wrangler deploy`.

### Headline — package "colour mix" — partial mitigation shipped, ROOT still OPEN

- **PACKAGE-PALETTE-MIX-001 — [FIXED — root closed by APPJS-ID-SCHEME-UNIFY (1.50.387); re-verified 2026-06-13 with the owner's exact repro (pwa/test/diag-palette-orphan.mjs): seeded orphan "scandinavian" migrates in storage to "copenhagen-modern", body[data-package] agrees, sidebar renders navy not black, second reload stable]** (owner-confirmed 2026-06-06; partial
  mitigation [PR #226](https://github.com/gabrielk83/AntCV/pull/226), v1.50.166).
  **Owner directive (2026-06-06): keep this OPEN.** The default Copenhagen Modern
  palette must render on load — not the "undefined ugly mix with black". #226 is a
  render-time patch, not a close-out.
  Returning users were stuck on a mismatched palette ("colour mix"); only
  re-pressing the package in Settings fixed it, and it never persisted.
  **Root cause:** the document colour state (`styleConfig`/`ya`) only ever
  initialised from the *saved* config, never from the selected package, so the
  accents stayed stale on reload — AND the persisted package id is the legacy
  orphan `"scandinavian"`, which never gets rewritten to the registry id
  `copenhagen-modern`. **Partial fix in #226 (in `app.js` itself):** a one-time
  mount effect derives the palette from the selected package's `va[Sa].style` for
  non-custom packages (Custom keeps its saved config; `navyColor` keeps owning
  the backgrounds). Done in both `pwa/app.src.js` (the de-minified **SOURCE OF
  TRUTH**, now tracked) and the deployed `pwa/app.js` (inserted by exact unique
  string replace — only +230 bytes change; round-trip verified within ~64 bytes).
  **Why still OPEN — Chrome verification on the `fix-app-src-package-id-root`
  branch preview (2026-06-06):** seeding the returning-user orphan and reloading,
  `localStorage.stylePackage` is *still* `"scandinavian"` while
  `body[data-package]` is `copenhagen-modern` — the persisted-id mismatch that
  produces the black mix is unchanged. #226 only re-derives the render colours; it
  does not rewrite or persist the orphan id. The durable close-out is
  **APPJS-ID-SCHEME-UNIFY** (unify app.js's id scheme with the registry + persist
  the selection through cloud-restore) — tracked in the feature registry.
- **ORPHAN-DEFAULT audit (owner request) — done.** `"scandinavian"` is app.js's
  legacy umbrella default for BOTH the visual package (`stylePackage`, registry
  default `copenhagen-modern`) AND the writing tone (`toneRegister`, registry
  default `nordic-minimal`); neither registry contains it, and app.js uses a
  *different id scheme* than the registry (e.g. `copenhagen_executive` vs
  `navy-executive`). **No other orphan defaults** exist (language `en`,
  `photoPosition sidebar-top`, etc. are all valid — the "American/British" hits
  are a DOCX lang attribute + a prompt instruction, not settings).

### Fixed this session (all MERGED + live)

| ID | Item | PR | Ver |
|----|------|----|-----|
| DATA-EXPORT-001 | Download all stored data/analytics (optional AES passphrase) | [#176](https://github.com/gabrielk83/AntCV/pull/176)/[#185](https://github.com/gabrielk83/AntCV/pull/185) | 1.50.140/147 |
| DELETE-SAVE-001 | "Save my data locally first" before erase | [#176](https://github.com/gabrielk83/AntCV/pull/176)/[#181](https://github.com/gabrielk83/AntCV/pull/181) | 1.50.140/145 |
| IMPORT-COUNT-001 | Upload toast showed 0 work/edu/pubs (React split-text rewrite) | [#178](https://github.com/gabrielk83/AntCV/pull/178) | 1.50.143 |
| SHAPE-GUARD-NOISE-001 | False "missing bullets[]" warns for `{b,t}`/`{l,v}`/`{deg,sch}`/`{group}` leaves | [#186](https://github.com/gabrielk83/AntCV/pull/186)/[#189](https://github.com/gabrielk83/AntCV/pull/189) | 1.50.148/150 |
| CONSOLE-NOISE-001 | Central console quieter (~70 boot banners) | [#188](https://github.com/gabrielk83/AntCV/pull/188) | 1.50.149 |
| PRIVACY-FAB-MOBILE-001 | Privacy LED invisible on mobile (relocated pill exempt) | [#195](https://github.com/gabrielk83/AntCV/pull/195) | 1.50.152 |
| PRIVACY-FAB-FLOATING-001 | Stray privacy ⚠ FAB in Settings/Generation (desktop) | [#207](https://github.com/gabrielk83/AntCV/pull/207) | 1.50.158 |
| PHOTO-PREVIEW-001 | Alt photo positions broke under the single-table renderer (photo-anchored finders) | [#196](https://github.com/gabrielk83/AntCV/pull/196) | 1.50.153 |
| DOCX-PHOTO-BANDOVERLAP-001 | `band-overlap` not recognised by the docx worker | [#200](https://github.com/gabrielk83/AntCV/pull/200) | worker 1.14.17 |
| SIDEBAR-COLOR-001 | Sidebar stayed blue on colour styles (→ `var(--package-base)`) | [#210](https://github.com/gabrielk83/AntCV/pull/210) | 1.50.159 |
| PACKAGE-RELOAD-DESYNC-001 | Palette applied the previous style on reload (read native key) | [#212](https://github.com/gabrielk83/AntCV/pull/212) | 1.50.160 |
| PACKAGE-ORPHAN-001 | Auto-apply Copenhagen Modern for orphan `scandinavian` (sidecar) | [#217](https://github.com/gabrielk83/AntCV/pull/217) | 1.50.164 |
| TONE-ORPHAN-001 | Migrate orphan `toneRegister scandinavian` → `nordic-minimal` | [#220](https://github.com/gabrielk83/AntCV/pull/220) | 1.50.165 |

### Still OPEN (registered, not done this session)

- **PHOTO-PREVIEW-ALT-PERSIST-001 — [RESOLVED by the 1.50.370–372 native rework;
  headless-verified 2026-06-11]** — the clone/finder sidecar machinery this bug
  lived in is GONE: positions render natively from app state (`er` ←
  localStorage `photoPosition` at mount) and the cleanup shim only clears stale
  clones. Cold-boot persistence locked by `pwa/test/diag-photo-position-persist.mjs`
  (bridge-middle on the seam, main-right circular wrap, none → no image — all on
  first paint, no live switch).
- **PHOTO-SIDEBAR-BRIDGE-001 — [CLOSED 1.50.368–372 + worker 1.14.51–53]** —
  shipped: split candidate header, floating medallion mid-line on the seam,
  preview + DOCX/PDF, plus the full position family (main top/bottom L/R,
  bridge-middle/bottom). See FEATURES_REGISTRY and the 2026-06-11 section at top.
- **PRIVACY-FAB-FLICKER-MOBILE-001 — [RESOLVED — owner-confirmed 2026-06-12]** the
  top-bar pill flicker is gone. Follow-up shipped the same day:
  **PRIVACY-FAB-COLOR-001 `[FIXED 1.50.398]`** — on mobile the platform's COLOUR
  emoji shield (white+red segments) screamed against the chip; the glyph now
  renders as a single-colour silhouette on viewports ≤900px (transparent text +
  fg-coloured text-shadow), desktop keeps the native glyph. Verified
  `pwa/test/diag-privacy-mono.mjs` (mobile mono + desktop native) 2/2.
- **DEMO-WARN-NONDEMO-001 — [partly addressed]** privacy LED showed the demo-proxy
  warning for a non-demo user (workaround: Reset). A `demo-watermark`/privacy-led
  state sidecar landed in parallel; verify it covers this.
- **FEATURE-CONF-001 — [OPEN feature]** per-sentence confidence overlay (see
  feature registry). Not started.

### Workaround sidecars — KEEP (do NOT retire yet)

PACKAGE-PALETTE-MIX-001 is still OPEN, so the workaround sidecars stay in place:
`antcv-package-orphan-apply.js` (#217), the loading-gate tone migration (#220),
and `antcv-sidebar-bg-token.js` (#210) all remain load-bearing until the durable
fix lands. Only retire them once **APPJS-ID-SCHEME-UNIFY** ships — that cleanup
unifies app.js's id scheme with the registry and persists the selection through
cloud-restore (so `stylePackage` stops being the orphan `"scandinavian"`),
closing the bug at the data layer. Tracked in the feature registry.

---

## SESSION 2026-06-06 — app.js rebuild safety + page-split engine (paused)

Worklog for the on-screen page-split engine attempt and the blue-screen it caused.
Net result: the regression is reverted and live; the engine work is **paused** behind
a missing safe-rebuild path. Both items below are tracked so the next channel does not
repeat the mistake.

### Resolved this session

- **GEN-UNSOL-002** — generate_cv could omit `meta.company`/`meta.role` even with a JD
  present, so the header fell to "Unsolicited". Fix: the generation prompt now requires
  both to be filled from the JD when one is present (never empty, never "Unsolicited" when
  the JD names the employer); empty only for a true open application. Additive prompt text,
  surgical app.js edit mirrored to `app.src.js`. — FIXED✓ (1.50.169). Live-verify owed:
  generate against a real JD → header shows the real company/role.
- **PERF-002/003/004** `[RESOLVED 1.50.819 — GEN-WIDTH-001]`. The backlog framed these as
  "trim consensus width" on mechanical tasks, but `ee` (app.src.js ~1146) is a **cascade**:
  it returns on the first successful provider and only advances on failure; the per-task `Z`
  map (~1110) is fallback ORDER, not a fan-out. Mechanical tasks make one call, so trimming
  `Z` cuts resilience, not latency. Real consensus is the separate `consensus_poll` path
  (~20547) — already quorum-2 + parallel + 20s cap (PERF-002), so latency was already handled.
  RESOLUTION: the owner gave intent (per-mode width 2/3/4) and GEN-WIDTH-001 (819) made the
  failover-ladder width a single `__fanWidth()` knob keyed on the generation mode — see the
  2026-06-23 (eve) generation-cycle block at the TOP of this file.
- **WM-MOBILE-SCALE-001** — AI watermark "lost" on mobile (again). The preview paper
  renders inside a `transform: scale(ui)` zoom container (app.js preview zoom; phone
  auto-fit factor well below 1). `antcv-watermark-page-anchor-341` positioned via
  `getBoundingClientRect()` (SCALED screen coords) but wrote `style.top/left` in the
  offset parent's UNSCALED local space, so the offset was wrong by the scale factor and
  pushed the marker off the visible paper. The 1.50.160 offset-parent rewrite dropped the
  older 1.50.147 viewport clamp without accounting for the transform — that is the "again".
  Fix: `anchorToCorner` recovers the cumulative scale from the offset parent
  (`rect / offsetWidth`) and converts every screen-space delta into local space; no-op at
  scale 1 (desktop). — FIXED✓ (1.50.167). **Live mobile verification owed** (no live
  browser in the build env): on a phone, CV + CL preview should show the marker in the
  last-page corner on the visible paper at any zoom.
- **CL-UNSOL-SIGNAL-001** — An unsolicited / "Open Application" cover letter rendered the
  literal template placeholders `[WHO I AM — …]` and `[WHY THIS POSITION — …]` instead of
  content. Root cause: the CL merge reducer backfills who/why from the hardcoded `n.who`/
  `n.why`, but `n` is gated on `p` (`kernelShowcaseInProgress || io.company === "Unsolicited"`
  exact). After GEN-UNSOL-001 an unsolicited letter can carry a real extracted company, so
  `p` is false, `n = {}`, and empty `who_content`/`why_content` collapse to `""` → the
  empty field shows its template placeholder. (WHAT I BRING never shows this — it has a
  row-level fallback independent of `p`.) Fix: a grounded, candidate-anchored backstop added
  AFTER `n.who`/`n.why` in both chains — purely additive (only fires when everything before
  is empty), so a normal/solicited letter never reaches it. Done as a **surgical in-place
  edit of the minified `app.js`** (one occurrence each, verified parse) per
  `docs/deployment/app-js-source-and-rebuild.md`, mirrored into `app.src.js` — NOT an
  esbuild rebuild. First proof the surgical-minified-edit path (the sanctioned interim until
  APPJS-REBUILD-001 is solved) works. — FIXED✓ (1.50.168). **Live verification owed:**
  generate an unsolicited letter; WHO I AM + WHY THIS POSITION show grounded prose, no
  brackets, in preview + DOCX/PDF.
- **APPJS-BLUESCREEN-001** — A full blue screen on load after the page-split engine
  was shipped via `npm run build:app`. **Root cause: the esbuild round-trip is NOT
  behaviour-preserving for this bundle.** The working `app.js` begins
  `(()=>{const{useState:e,…` (sloppy-mode global-React IIFE); the esbuild rebuild begins
  `"use strict";(()=>{…` — esbuild prepends a strict-mode directive and emits other
  minifier differences, and the original bundle relies on sloppy-mode semantics, so the
  rebuilt bundle threw at boot. NOT caused by the parallel `main` merge (the
  deployed/branch-HEAD `app.js` was confirmed to be the esbuild build). **Fix:** restored
  the ORIGINAL minified `app.js` + the clean `app.src.js` from pre-rebuild commit
  `0a7c459`; cache trio bumped to **1.50.166** (1.50.165 → STALE) so the broken cached
  bundle is flushed. Deployed live (deploy.yml → deploy-pwa green). — FIXED✓ (1.50.166).

### Still OPEN after this session

- **APPJS-REBUILD-001** `[FIXED 2026-06-12 — terser is the verified rebuild]` — there is
  now a verified behaviour-preserving rebuild. The identity round-trip gate was run:
  `terser pwa/app.src.js -c -m -o /tmp/x` (and `npm run build:app`, now repointed to the
  same terser command) reproduces the committed `pwa/app.js` **byte-for-byte** (871,787
  bytes, `cmp` clean), `node --check` OK, output begins `(()=>{`, 0 `"use strict"`. Terser
  is semantics-preserving for this sloppy-mode bundle (esbuild was not — it prepends the
  strict directive, APPJS-BLUESCREEN-001). So `app.src.js` source edits can now be rebuilt
  with the standard script and deployed after the usual cache-bust. Closes with
  BUILD-APP-BROKEN-001 above. *(superseded — original below)* `[OPEN][HIGH][build]` — There was no verified behaviour-preserving
  way to rebuild `app.js` from `app.src.js`; `npm run build:app` (esbuild `--minify`)
  blue-screened (APPJS-BLUESCREEN-001). Procedure documented in
  `docs/deployment/app-js-source-and-rebuild.md` and `CLAUDE.md`.
- **ENGINE-PAGESPLIT-001** `[OPEN][PAUSED][feature]` — The real on-screen page-split
  engine — per-item pagination so a forced break actually moves content to the next page
  for all three split units: **(1) sidebar sub-subsections, (2) table rows, (3) "How I
  would contribute" bullets** (heading moves with its first part). Today the CV two-column
  page-box engine paginates only WHOLE sidebar sections (`.page`) and WHOLE experience
  roles (`role.page`); there is no per-item primitive. The export side (docx-worker
  ≥1.14.18) already honours per-item `_page`/`item_pages`; this item is the matching
  on-screen render. **Paused — blocked on APPJS-REBUILD-001** (the change lives in
  `pwa/app.src.js` ~line 35574 and needs a working rebuild). Design notes:
  `docs/plan/PB-007-two-column-pagination.md`. A first cut was built (commit `636cda7`)
  and reverted with the blue-screen fix.
  **UN-PAUSED REVIEW 2026-06-12 → CLOSED, SUPERSEDED BY IMPLEMENTATION.** Both the
  blocker and the goal resolved while paused: (a) APPJS-REBUILD-001 is FIXED
  (`npm run build:app` = terser, identity round-trip gate PASSED), and (b) per-item
  on-screen pagination ships via the dual-map measurer + page-box renderers reading
  the EFFECTIVE bucket (manual `antcv:itemPages` ∪ auto `antcv:autoPagesPreview`):
  (1) sidebar sub-subsections split group-aware (verified diag-sidebar-cont-e2e),
  (2) table rows split with the header re-cloned (verified diag-table-split: 30-row
  table splits at row 26, no dup/loss), (3) HWIC/Foundation parts split via
  `__antcvBreaks`. The 📄 buttons now display the EFFECTIVE page (R37 "ᵃ" suffix).
  Residual owner check: tap 📄→2 on one sidebar item + one table row and confirm
  the on-screen move — same bucket the verified auto path uses.

---

## SESSION 2026-06-05/06 — Analysis report, JD ingestion, demo mode, generate fixes

Worklog for the analysis-PDF + JD-extraction + demo-mode + generate-flow engagement.
Newest registry section; individual IDs below. Live owner-acceptance still owed on
items marked VERIFYING.

### Resolved this session

- **ANALYSIS-PDF-001** — Branded, downloadable Analysis report (AntCV icon, slogan,
  app name, date, application name, low/medium-confidence statements, assumptions,
  recommendations, diagonal AI-ASSISTED watermark + AI notice). New sidecar
  `antcv-analysis-report-pdf-360.js`; client-side print-to-PDF. jd-analysis worker
  (cv-proxy + demo-proxy) extended to return `assumptions`/`recommendations`/
  `confidence_notes`. — FIXED✓ (1.50.146, workers deployed).
- **JD-OCR-001** — Image-based PDF (LinkedIn "Save as PDF": ~18 chars text, 98 images)
  failed with "no usable text" in the Analyse-JD block. Root cause: the block had its
  own pdf.js-text-only extractor. Fix: delegate to app.js's hardened `extractPDFText`
  cascade (pdf.js → garbled-detect → LLM text → vision OCR), exposed as
  `window.AntcvExtractPDFText`. Reuse, not a duplicate. — FIXED✓ (1.50.152).
- **JD-UPLOAD-001** — JD panel's PDF/Word/Image trio → single "⬆ Upload JD" button
  (accepts .pdf/.doc/.docx/.txt/.json/image; JSON parsed locally for jd_text). —
  FIXED✓ (1.50.153).
- **PERF-CB-001** — Provider circuit-breaker: a quota/auth-failed provider is dropped
  for the session instead of being re-hit + retried on every one of ~23 generate
  tasks (the ~7-minute-run cause). — FIXED✓ (1.50.155).
- **PERF-WARN-001** — OpenAI `429 "exceeded your current quota"` (classed rate_limit,
  not billing) never surfaced. Broadened the credit-banner trigger to fire on
  rate_limit-with-quota with a "using fallback providers, this run is slower" note. —
  FIXED✓ (1.50.154).
- **SW-SHELL-001** — `sw.js` SHELL precached `./antcv-mobile-controls.js` (+
  `antcv-tone-custom-slots.js`) which 404'd, so `cache.addAll` rejected and the shell
  never precached (offline broken). Removed stale entries; made install resilient
  (per-asset `cache.add().catch()`). — FIXED✓ (1.50.149/151).
- **DEMO-SETUP-001** — "⚠ Setup needed" wrongly shown to demo users. Gated it on
  `!(B&&B.demo_mode)`. (Note: a first attempt at 1.50.156 reverted M() too broadly and
  hid the "🟡 Use demo" cost chip — regression fixed at 1.50.157 by gating only the
  Setup-needed chip.) — FIXED✓ (1.50.157).
- **DEMO-CONFIG-001** — `/config` never returned `demo_mode`, so `B.demo_mode` was
  always false → ALL demo UI dead. The PWA reads the **relay** `/config`, which only
  returned `user_mode`. Added `demo_mode` to cv-proxy + demo-proxy `handleConfig`, and
  (the real fix) `demo_mode: userMode === 'demo'` to the **access-relay** `/config`.
  Workers deployed. — FIXED✓ (worker-side).
- **DEMO-WM-001** — DEMO watermark. Export path already stamps when `demo_mode`;
  added a preview overlay sidecar `antcv-demo-watermark.js` (tiled diagonal DEMO,
  pointer-events:none, prints). — Mechanism FIXED✓ (1.50.159), but **BLOCKED by
  DEMO-PERSIST-001**: a real demo account reads `demo_mode:false`, so the watermark
  appears in neither preview, export preview, nor DOCX/PDF until that is fixed.
  Not owner-confirmable yet.
- **GEN-EMPTY-001** — Empty Analysis panel after Generate ("Detailed analysis was not
  returned by the model" placeholder + empty fit/gaps). The 1.50.154 generate_cv
  fold-in enlarged the rationale → JSON truncation dropped it. Reverted the fold-in. —
  FIXED✓ (1.50.163).
- **GEN-UNSOL-001** — A known posting ("Optics/Camera Engineer at Sigma Connectivity")
  was stamped "Open Application — Unsolicited". The showcase guard forced Unsolicited
  whenever the Company field was blank, discarding the company the model extracted
  (`D.company = T.meta.company`). Fix: force Unsolicited only when the Company field is
  blank AND no real `D.company` was extracted. — FIXED✓ (1.50.164).
- **GEN-REPORT-001** — Full analysis report now appears on **Generate** (auto, via
  `merge-344` running `/api/jd-analysis` on the active JD) **and** Analyse JD (jd-block),
  both merging recruiter/red_flags/questions/assumptions/confidence/recommendations.
  Unblocked by GEN-EMPTY-001 + GEN-UNSOL-001. — FIXED✓ (1.50.163/164).

### Still OPEN after this session

- **HARDREFRESH-001** `[FIXED✓ verified headless 2026-06-11]` — In-app Hard Refresh
  shows the confirm but did nothing after OK. The in-source hardening (fire-and-forget
  cleanup + 1.2s forced reload + `location.replace` fallback, app.src.js ~28892)
  verifies green: `pwa/test/diag-hardrefresh.mjs` clicks the button with a CONTROLLING
  service worker and observes the reload. Likely explanation for the report: pre-1.50.355
  the Settings modal did not mount in the editor route at all (SETTINGS-NAV-Z-001), so
  the whole settings surface was unreachable/stale there. Owner to re-confirm on device.
- **DEMO-PERSIST-001** `[OPEN][HIGH][console][worker]` — **A demo user is server-
  classified as "paid".** Confirmed live: `51pegasib@gmail.com` (who carries the demo
  "⚠ Setup needed" chip) reads relay `/config` → `user_mode:"paid"`, `demo_mode:false`.
  `AntcvSetUserMode("demo")` + reload does **not** flip it (still `"paid"`). Because the
  account is treated as paid, every demo behaviour is wrong for them:
    - **"⚠ Setup needed"** chip shows (it should not for a demo account);
    - **no "DEMO" watermark** anywhere — **preview, export preview, and DOCX/PDF**
      (export stamping is gated on `demo_mode`, which is false here).
  This is the master demo bug; DEMO-SETUP-001 and DEMO-WM-001 are correct in mechanism
  but **cannot manifest until this is fixed** (a real demo account never reaches
  `demo_mode:true`). Relay write/read logic *looks* correct; suspects: the client POST
  (`/api/user/mode`, fire-and-forget, relies on `antcv-auth.js` header injection) silently
  failing, OR the account is pinned to "paid" by an admin/allowlist default. Decisive
  probe: the `SET-MODE` console snippet (POST status 401 vs 200+stale read), then check
  how the relay assigns the initial mode for this email.
  UPDATE 2026-06-10: addressed by the relay `auth-25` deploy — `getUserMode` now PINS
  `DEMO_EMAILS` (wrangler.toml: `51pegasib@gmail.com`) to `'demo'` regardless of any
  stored/POSTed mode (DEMO-PERSIST-001 mechanism, index.js getUserMode), so that account
  reaches `demo_mode:true` and every demo treatment (badge, watermark, export stamp) now
  has a true signal to render from. Needs the owner to confirm live on `51pegasib@gmail.com`
  (sign in → expect the 🟡 DEMO badge + DEMO watermark on preview AND export). If a NEW
  demo account is needed that isn't in DEMO_EMAILS, the in-app toggle (DEMO-TOGGLE-001)
  is the remaining gap.
- **DEMO-BADGE-001** `[STALE — already fixed in source, verified 2026-06-10]` — the "🟡
  DEMO" badge is NO LONGER hardcoded to an email. In the current source it renders via
  `__antcvDemoActive()` (app.src.js:1033 = `!!(B && B.demo_mode) && !__antcvHasOwnKey()`),
  the real signal, at app.src.js:39778/39801. Every other demo treatment (export-watermark
  notice 28734/43048, preview band 38874) uses the same gate. No code change needed; the
  "mix" the owner saw is explained by REGULAR-MODE-STALE-SETUP-001 (stale render until
  refresh — fixed 1.50.340) + DEMO-PERSIST-001 (server mode, addressed by the relay
  auth-25 DEMO_EMAILS pin). Closing as stale.
- **PRIVACY-DEMO-001** `[OPEN]` — Privacy LED not visible in demo mode (desktop +
  mobile). Not investigated; may overlap the parallel `fix/label-mobile-privacy-audit`.
- **SETTINGS-SUBTAB-001** `[OPEN]` — Pressing "EN"/applications-history doesn't open the
  relevant settings subtab; the settings panel renders **behind the preview** (z-index).
- **GEN-UNSOL-002** `[OPEN]` (follow-up to GEN-UNSOL-001) — The fix keeps `D.company`
  *if the model returns it*; the generation output schema doesn't explicitly request
  company/role, so if the model omits `meta.company` for a JD the header still falls to
  Unsolicited. Prompt-side: have generate_cv extract+emit company/role grounded in the
  JD.
- **DEMO-TOGGLE-001** `[PARKED — owner declined 2026-06-12 ("not interested")]` — No in-app Demo⇄Paid toggle (only the wizard).
  Proposed: a Settings toggle calling `AntcvSetUserMode`.
- **HOWCONTRIBUTE-001** `[OPEN]` — "How I would contribute" bullets are **missing in the
  template preview** (the section renders without its bullet list). Check the
  `text_bullets`/contribute renderer + the `mergeHowContributeFromLocalStorage` path
  (docx-client has the export-side merge; the preview side is dropping the bullets).
  Verify parity Preview ↔ DOCX/PDF (GEN-001).
- **LOGIN-GATE-001** `[OPEN][HIGH]` — The change that **forces default settings and hides
  the wizard when no wizard is needed landed badly**: on load the user gets a **blue
  screen instead of the loader**, then the wizard, then the set menu (wrong order, broken
  first paint). Candidate fix branch already exists:
  `feat/login-loading-gate` —
  https://github.com/gabrielk83/AntCV/compare/main...feat/login-loading-gate
  (review + verify the loader→app sequence before merge; this is the app-shell boot path —
  diagnostic-first, prior blue-screen incidents on this path).
- **APP-HISTORY-001** `[OPEN]` — **Application History is still not reachable from the
  preview's pop/overflow menu.** (Related to SETTINGS-SUBTAB-001 but distinct: this is the
  preview-side menu entry, not the Settings subtab.) The history control either isn't in
  that menu or its handler doesn't open the history view.

### Optimization roadmap (see `docs/perf/Generate_Cycle_and_Optimisation.md`)

- **PERF-002** `[OPEN]` — Consensus quorum/timeout: a consensus waits for ALL providers
  (`allSettled`), so one slow/retrying provider stalls it. Proceed on 2–3 of 4, or cap
  per-provider wait. (Note: consensus is already parallel; this is the real lever.)
- **PERF-003** `[OPEN][owner-confirmed split]` — Trim consensus width to 1–2 providers
  on the **mechanical** tasks only: `extract`/`extract_pdf`, `parse_jd`, `compress`,
  `fix_orphans`. Keep wide on `generate_cv`, `consensus_poll`, `consensus_reinforce`,
  `fuse`, `analyze_fit`, `long_context`, **`enrich`**, **`apply_correction`**, and all
  translation (DA/ES/ZH) — owner: these are quality-critical.
- **PERF-004** `[OPEN]` — enrich↔compress convergence skip: if a cycle produced no
  material change (or further compression loses signal), skip the next cycle instead of
  running a fixed 3×.
- **PERF-005** `[PARTIAL]` — Retire the redundant `/api/jd-analysis` cycle for generated
  docs. `merge-344` already reuses it; a full fold into generate was tried (1.50.154) and
  reverted (GEN-EMPTY-001), so the separate pass stays for now.

---

## DELETE-SAVE-001 — "Save my data locally first" tick not appearing — FIXED (v1.50.145)

**Owner (screenshot):** the DANGER ZONE "Are you sure?" confirm card showed
"🗑 Yes, erase everything" / "Cancel" but **no save-data checkbox and no Download
button**.

**Root cause:** the v1.50.142 injector anchored on button text `/delete my
account/i`. The live card uses different labels — the confirm button is "🗑 Yes,
erase everything" and the trigger is "🗑 Delete user" — so `findDeleteButton`
returned null and nothing injected. (The `AntcvFullErase` save-first wrap still
fired, since `saveFirst` defaults on, but the user had no visible control.)

**Card structure (app.js):** DANGER ZONE section → "⚠ DANGER ZONE" header →
always-visible description ("…Logs you out. No undo.") → `sn ? confirmCard :
"🗑 Delete user"`; confirmCard = "Are you sure?" + warning + flex button row
["🗑 Yes, erase everything", "Cancel"].

**Fix (v1.50.145):**
- `findEraseButton` now matches `/erase everything|delete my account/i`.
- **Checkbox** injects above the confirm card's button row (appears when armed).
- **Download button** anchors to the always-visible description leaf
  (`/Logs you out\. No undo\./`) and is inserted right after it, so it shows
  whether or not the confirm card is open.
- Both idempotent (marker-guarded). `?v=1.50.145`; cache trio → 1.50.145
  (1.50.144 → STALE).

**Verified (Node harness, 7/7):** Download lands directly after the description;
checkbox lands directly above the button row; both finders match the live labels;
re-inject is idempotent (one of each).

**Live verification owed:** open Settings → DANGER ZONE, click "Delete user",
confirm the "Save my data locally first" checkbox shows above the buttons and the
"⬇ Download my data" button shows under the description; unchecking it skips the
backup; checked → a backup downloads before erase.

---

## IMPORT-COUNT-001 — upload extract count wrong — FIXED (v1.50.143; live verification owed)

**Symptom:** after a CV upload the wizard toast read "✓ Found 0 work · 0
education · N certifications · 0 publications" even though the data imported
fine (real 6 work / 3 education / 2 publications).

**Root cause (diagnosed in app.js, fixed in the existing sidecar):**
- The toast counts come from a separate import-**preview** object (`On`), not
  from `personalInfo`. In the `_direct` upload path app.js persists the full
  profile via `le(t)` but sets the preview to **identity + certifications only**
  → work/education/publications show 0. (The toast also reads `On.work_history`,
  snake_case, which nothing ever populates — the data is under
  `experience`/`workHistory`.) So the count line was structurally wrong while the
  data was correct in `personalInfo`.
- `antcv-upload-recount-339.js` already recomputes the right counts from
  `personalInfo` (workHistory||experience, education, certifications,
  publicationsStructured||publications) and normalises the dual keys — but its
  **DOM rewrite silently no-opped**: app.js emits the line as many sibling React
  text nodes (`"✓ Found ", count, " work entr", "ies", " · ", …`), so the
  container's `textContent` matched the regex but no SINGLE child text node did,
  and the TreeWalker found nothing to rewrite.

**Fix:** added a split-text branch to `recountUploadSummary` — when a matching
element's children are ALL text nodes (the React leaf holding the split line),
collapse it to the corrected string. The styled wrapper above it (element child)
is correctly skipped, and the idempotency guard (`textContent` already equals the
expected string) prevents re-writes. `?v=1.50.143-multinode`; cache trio →
1.50.143 (1.50.142 → STALE).

**Verified (Node harness, 5/5):** split-text toast "0/0/6/0" rewritten to real
"6/3/6/2"; wrapper reflects it; experience→workHistory and
publications→publicationsStructured normalised; second tick idempotent (single
text node, no growth).

**Live verification owed:** upload a real CV (Anita persona), confirm the toast
shows the true work/education/publication counts (not 0), on the `_direct` JSON
path and the worker `extract-kernel` path, desktop + mobile.

---

## DATA-EXPORT-001 + DELETE-SAVE-001 — v1.50.142 (built; live verification owed)

New readable sidecar `pwa/antcv-data-export-360.js` (loaded in index.html after
`cloud-delete-296` + app.js). No app.js / fetch-wrapper change — reads
localStorage only, wraps the documented `AntcvFullErase` hook additively.

### What it does
- **DATA-EXPORT-001** — `window.AntcvDataExport(opts)` serialises every
  localStorage key (personalInfo, sections / cv_pwa_sections, meta, antcv:prefs,
  `antcv:analytics:counts`, antcv:apply:*, writing prefs, ...) into a downloadable
  JSON backup. Credential-looking keys (token/secret/jwt/apikey/...) and transient
  erase markers are excluded from a plain file. "Protected" = optional passphrase
  → WebCrypto **AES-GCM** (PBKDF2-SHA256, 250k iters); falls back to a plain file
  with a console warning if WebCrypto is unavailable (non-secure context).
  Filenames: `antcv-backup-YYYY-MM-DD.json` / `…encrypted.json`.
- A **"⬇ Download my data"** button is injected into the red Delete-account card
  (anchored by the "Delete my account" button text); clicking it prompts for an
  optional passphrase.
- **DELETE-SAVE-001** — a **"Save my data locally first"** checkbox (default ON,
  protective) is injected into the same card; when checked, the `AntcvFullErase`
  wrapper takes a fast unencrypted backup BEFORE deferring to the original erase.
  Backup failure never blocks the erase.

### Verified (Node harness, 13/13)
collectData includes user data + analytics and parses JSON values; excludes
apiKey/authToken/transient markers from a plain backup; `includeSecrets` re-includes
them; AES-GCM encrypt→decrypt round-trips; tampered IV fails (authenticated
encryption); plain export emits a dated filename; UI injection adds both nodes and
is idempotent (no dupes on re-sweep).

### Live verification owed (desktop + mobile, after deploy)
- [ ] Delete-account card shows the Download button + checkbox; styling reads native.
- [ ] Download (plain) yields a JSON file containing personalInfo + analytics; no
      api keys/tokens in the plain file.
- [ ] Download with a passphrase yields `…encrypted.json` that decrypts back.
- [ ] With the box checked, clicking "Delete my account" downloads a backup, THEN
      the existing erase + cloud-delete + reload runs (compose with cloud-delete-296).
- [ ] Escape hatch `localStorage['antcv:disable-data-export']='1'` removes the UI
      and the erase wrap.

### Decisions / follow-ups
- Default-CHECKED on the save-first box (protect irreversible loss); change to OFF
  if the owner prefers opt-in.
- Download button is anchored to the delete card (a stable, co-located data/privacy
  spot). If the owner wants it elsewhere in the Personal menu, give the target
  container and I'll re-anchor.
- **Import/restore is NOT implemented** (owner asked for download only). Reading a
  backup back in is a natural follow-up (DATA-IMPORT-001).

---

## 2026-06-04 (session) — mobile UI + page-break + HIWC editability (v1.50.102 → v1.50.119)

Branch `claude/antcv-roadmap-bugs-L9Sqa`. All items below are shipped to that
branch (PRs merged into `main` through the session). Live verification on
desktop AND mobile still owed except where "owner-confirmed".

### Status

| ID | Item | Layer | Version | Status |
|----|------|-------|---------|--------|
| MOB-TOPBAR-001 | Hide Ant icon + leftover table control (`CL`/`30%` = `.antcv-top-sliders`) on mobile | sidecar CSS | 1.50.112 | FIXED (verify live) |
| MOB-TOPBAR-002 | Privacy pill clipped off-screen — crop filename, single-row topbar | sidecar CSS | 1.50.114→115 | FIXED (verify live) |
| MOB-ALT-001 | Alt-circles palette → tap-to-open dropdown (one circle, opens the rest) | new sidecar | 1.50.113 | FIXED (verify live) |
| MOB-ALT-002 | Dropdown must open DOWN and escape the topbar overflow clip | sidecar | 1.50.116 | FIXED (verify live) |
| MOB-BOTTOMNAV-001 | Bottom-nav buttons clipped — shrink text/padding on mobile | new sidecar | 1.50.108 | FIXED (verify live) |
| HIWC-EDIT-001 | "How I would contribute" bullets not editable (esp. mobile) — inputs injected into React tree were wiped by the re-render storm; switched edit surface to the native textarea | sidecar | 1.50.117 | **FIXED (owner-confirmed working)** |
| HIWC-EDIT-002 | Per-bullet control strip squeezed the textarea — moved strip to its own row below | sidecar | 1.50.118 | FIXED (owner-confirmed) |
| HIWC-EDIT-003 | Control strip buttons clipped on phone — wrap the row | sidecar | 1.50.119 | **FIXED (owner-confirmed working)** |
| PAGEBREAK-SIDEBAR-001 | Page breaks for ALL sidebar sub/subsections (was wrongly narrowed in a revert) → PB-001 | sidecar `329` | 1.50.115 | FIXED (verify live export) |
| SETTINGS-AHZ-001 / **AH-001 / VF-014 / APPHIST-ZIDX-001** | "Open in Settings" Application-history subtab opens BEHIND preview | sidecar `327` | 1.50.109 | **STILL BROKEN per owner — blind ancestor-lift did not beat the trap. Reproduce → run `antcv-apphist-zindex-probe.js` → targeted patch. RE-OPEN.** |
| VF-005 / CA-002 | Application "Role - Company" sentence editable + follows package style | sidecar `341` | (main) | FIXED (owner-confirmed) |
| CA-001 (spec line) | `[Specialisation — …]` editable in preview (meta.subtitle) | sidecar `341` | (main) | FIXED (owner-confirmed) |
| SETTINGS-HEAD-002 | WRITING STYLE + LANGUAGES headers match ADVANCED TONE font/size; tighten gap | sidecar | 1.50.110 | FIXED (verify live) |
| LAYOUT-NOTES-001 | "Within-package style" notes: shrink, drop package name, relocate (Quick-alt under packages, Custom onto the Custom button) | island source (vite) | 1.50.111 | FIXED (verify live) |

### Reverted / parked this session
- **TABLE-PAGEBREAK-001 (Core/WIB per-row `↧`) — REVERTED at 1.50.103.** The
  reliable per-row toggle wrote to the wrong section: the WIB control falls back
  to `sid:'core_competencies'`, and `pageBreakRows`/`itemPages` are keyed by
  section id only, so the CL "What I Bring" and the CV "Core Competencies"
  collide across documents — pressing WIB's ↧ corrupted Core. Restored to the
  known-good `📄` page system. **A correct per-row table break needs per-doc
  keying that also reaches the DOCX worker — a deliberate redesign, not a hotfix.**

### Canonical page-break family (PB-001..006) — reconciled with the v4 index
Owner: "page break in general" still not right. The locked requirements:
- **PB-001** — manual Page Break from BOTH main area and sidebar (sidebar partly via `329`/1.50.115; main-area + on-entry manual control unverified).
- **PB-002** — first sub-subsection moves the WHOLE subsection with its original heading (no dup).
- **PB-003** — continuation heading: duplicate heading + localized "Cont." 18pt from top.
- **PB-004** — table rules: first row moves the table; a later row splits it and repeats headers. (TABLE-PAGEBREAK-001 is the per-row toggle, parked — see above.)
- **PB-005** — replace the down-arrow icon + "Compress" text (semantic page glyph; "Fit"). (`page-break-icon-357` / `help-text-wording-357` — VERIFYING.)
- **PB-006** — preserve the Professional Experience pattern (reference, VF-018).
- **EXPORT-PAGE2-001** `[FIXED 1.50.374 — headless-verified]` — export PREVIEW shows only page 1 / breaks not applied. Driven with a headless variant of the probe: the iframe CLONE was never the problem (it carries every native `.antcv-page-row` + all page-2 content). The defect was the PRINT path — the srcdoc print CSS keyed breaks on legacy marker attributes (`data-antcv-page-break-284` etc.) that the native page-row pagination never sets, so the print engine re-paginated the tall paper arbitrarily; and the title counted PAPERS (always 1 now). FIX (`antcv-pdf-preview-gate.js` 1.50.374-page2-print): print CSS breaks on `.antcv-page-row + .antcv-page-row` + one-sheet clamp; `@page` margin 0 when native rows present (10mm spilled a sliver per row onto blank pages); title + CV/CL rebuild count page-rows. BONUS: page-selector chips (EXPORT-PREVIEW-FEATURES-001(c)). Locked by `pwa/test/diag-export-preview-pages.mjs` (8/8).

### Still OPEN from earlier in the engagement (not addressed this session)
- **RERENDER-STORM-001 [RESOLVED — probe-verified 2026-06-11, regression-locked]** —
  the mutation-source probe now runs headlessly as `pwa/test/diag-rerender-storm.mjs`
  (5s steady-state tally by source + rAF rate, thresholds total<30/s, worst<10/s).
  Current build measures: desktop 3 mutations/s, 7.2 rAF/s; mobile-390px 8.2
  mutations/s, 28.2 rAF/s; worst single source 1.8/s; 0 errors — versus the historic
  150+/s storm. The 1.50.80–85 idempotency + central-damper rounds hold. Residual
  ~1/s writers (altcircle, watermark-corner, page-fit-applied) are far below problem
  level. If the owner's mobile console still floods, re-run the committed probe on
  that device's content set.
- **APP-SENTENCE-STYLE-001 [FIXED✓ verified headless 2026-06-11]** — the candidate
  "Application: Role - Company" sentence follows the chosen package style: the
  v1.50.105 fix prefers the hidden ORIGINAL sentence anchor's computed style (the
  template's exact color/font for that slot). Verified: host color
  rgba(255,255,255,0.9) === anchor color on the dark header, template font adopted,
  all three spans contenteditable. Locked by `pwa/test/diag-candidate-header-edit.mjs`.
- **SPECIALISATION-EDIT-001 [FIXED✓ verified headless 2026-06-11]** — the
  `[Specialisation — …]` line IS wrapped contenteditable (v1.50.106
  `wrapSpecialisation`); an edit persists to `meta.subtitle` and survives. Locked by
  the same diag test.
- **DOCX-EXPORT-REGRESSION-001 [OPEN]** — see batch triage below (export from the
  print-setup view doesn't call `exportDocxViaWorker`).

---

## VISUAL-SETTINGS PLACEMENT — v1.50.95 (built, NOT yet deployed; live verification owed)

Addresses the **placement** of visual settings across the STANDARD Personal / Layout subtabs — the placement aspects of `VISUAL-PKG-003`, `SETTINGS-HEAD-001`, `SECTION-LAYOUT-001` (see the 2026-06-04 batch triage below). Some behavioural sub-items of those IDs remain (see Deferred). Source-only (React islands + protocol version bumps); `pwa/antcv-react-islands.js` rebuilt via `npm run build`. Not committed/deployed yet — deploy + live acceptance gate owed.

Context found this session: local `main` was **70 commits behind** `origin/main` (prod v1.50.93); synced via fast-forward to `160ccd2` before editing. The earlier "Visual-package Layout move" (`75911dc`) had been a hand-edit to the minified bundle only and was silently reverted when the bundle was later rebuilt from un-updated source.

### What changed (source)
- **VISUAL PACKAGE (PackagePicker) moved out of Personal → Layout.** Mount gates on `isLayoutSubtab`, anchored immediately after the native STYLE PACKAGE section. Rendered with `context="layout"`: the redundant 7-package grid is hidden (native STYLE PACKAGE buttons own selection); surfaces the **Quick-alternative** selector + explanation and the **Custom** explanation (auto-engages via the existing `window.AntcvCustomMode` tolerance evaluator). Personal carries no visual-package control. (VISUAL-PKG-001..003)
- **LANGUAGES (LanguageCard)** re-anchored into the Personal order-based flex column at `order:35` → after the writing-style/tone group, immediately before Banned Words.
- **SECTION LAYOUT (LayoutPicker)** re-anchored into the same column at `order:45` → after Banned Words. (SECTION-LAYOUT-001)
- **Styling:** the three injected cards' headers use the shared native register `NATIVE_SECTION_HEADER_STYLE` (Georgia 11px / 600 / .4px / rgba(255,255,255,.55)) so they read as native sections. (SETTINGS-HEAD-001)
- Helpers added to `src/lib/settings-dom.ts`: `findSettingsFlexColumn` (Personal order-column), `findSectionBlockBeforeNext` (Layout block-flow), `NATIVE_SECTION_HEADER_STYLE`.

### Verification (run on live, desktop AND mobile, after deploy)
- [ ] Personal: Languages after WRITING STYLE/Advanced Tone, immediately before Banned Words; Section layout immediately after Banned Words. No cramped bottom 3-column row.
- [ ] Personal: NO Visual-package control present (no duplicate/orphan).
- [ ] Layout: "Within-package style" card (Quick-alt + Custom) sits directly under the STYLE PACKAGE buttons, before SIDEBAR POSITION. Quick-alt Default/Alt 1/Alt 2 apply; Custom explanation shown.
- [ ] The three injected card headers match the native section register (font/size/colour).
- [ ] Native STYLE PACKAGE buttons and Quick-alt both apply to the preview; no Preview-only / after-hard-refresh-only behaviour.

### Anchoring mechanics (so a future session doesn't re-derive)
Personal subtab = `display:flex; flex-direction:column` ordered by CSS `order` (WRITING STYLE 25 / ADVANCED TONE 30 / BANNED WORDS 40). Layout subtab = block flow. Both placement helpers were prototyped against the live deployed DOM and confirmed to land in the correct slots before the source was finalised.

### Deferred follow-up (remaining sub-items of the same IDs)
- **VISUAL-PKG-001** — rename the native app.js panel label "STYLE PACKAGE" → "Visual package" (app.js; fold into the MERGE-DUP pass).
- **VISUAL-PKG-002** — enrich each native STYLE PACKAGE button with the package-card detail (palette / font / shape / photo-size icons).
- **VISUAL-PKG-003** — move the "Segoe UI · circle · 120px" descriptor out of the package card to sit next to the Alt circles (the caption wording is now aligned; descriptor relocation pending).
- **SECTION-LAYOUT-001** — make the whole Section-layout island collapsible + collapsed by default, refresh it when the writing style changes, and route out-of-definition edits into a custom writing style.
- Fold Quick-alt + Custom natively into the Layout STYLE PACKAGE section in `app.js` and delete the PackagePicker island (the "deprecated afterwards" end state). Wire the native Advanced → Style colour/font/image pickers to `window.AntcvCustomMode` so Custom auto-engages on out-of-tolerance edits.
- WritingStylePicker island renders empty (width 0) on production and sits inert in Personal — separate pre-existing issue, not addressed here.

---

## 2026-06-04 (batch) — owner feature + bug dump triaged

Full triage with per-item IDs, layer, and sidecar-vs-app.js verdict lives in
`docs/plan/Batch_2026-06-04_feature-and-bug-triage.md`. Summary:

- **Landed (sidecar):** `JD-TEXTAREA-001` (JD textarea halved + host panels
  scrollable, incl. mobile); `PRIVACY-FAB-FLICKER-001` (top-bar pill background
  bleep — see below).
- **New feature, NOT in locked docs:** `FEATURE-CONF-001` — per-sentence
  confidence overlay (Application-tab toggle, default off; red=low/yellow=medium;
  hover shows issue). Locked docs use "confidence" only in the tone sense. Needs
  a WORKER self-check pass + app.js toggle/store + preview renderer. Spec'd in the
  triage doc; raise as a new Writing-System "verification/confidence" section.
- **Priority regression:** `DOCX-EXPORT-REGRESSION-001` — DOCX export was wired to
  the preview-panel button only; export now runs from the print-setup view, which
  doesn't call `exportDocxViaWorker`. Needs branch-archaeology (find the prior
  fix) + re-wire the print-setup export handler in app.js.
- **Registered (app.js / React / worker):** `PAGEBREAK-001..005` (export-preview
  marker, on-entry + A4-overflow detection, continuation header, cascade colour
  across all sections + CL), `VISUAL-PKG-001..003`, `MERGE-DUP-001..003`,
  `SETTINGS-HEAD-001`, `SECTION-LAYOUT-001`, `LOCATION-001`, `DEMO-WARN-001`,
  `PRIVACY-SETTINGS-001`, `WIZARD-001..002`, `IMPORT-COUNT-001`,
  `PHOTO-PLACEMENT-001` (only sidebar photo positions render in the preview;
  header/main/bridge placements are no-ops — app.js render gap, format-prefs
  sidecar only stores the pref).

---

## 2026-06-04 (later) — section-layout help text trimmed + CL-HEADER-001 DOM captured

### Fixed — LAYOUT help-text overflow
- Owner: the Per-section-overrides help paragraph is too long. Replaced the §4.4 wall of text in `src/islands/LayoutPicker/LayoutPicker.tsx` with "Per-section overrides — pick a layout and set a length hint, or reset (↺) to use the style default." Rebuilt `pwa/antcv-react-islands.js` (Vite); bundle `?v=` → 1.50.70, `sw.js` → `antcv-1.50.70`, `version-override` TARGET → 1.50.70 (1.50.69 added to STALE).

### PUB-ROW-LAYOUT-001 — Publications & Patent per-item row layout (partial fix shipped)
- Owner: the per-item row has a blank gap that pushes the buttons aside; delete (✕) should sit right after the Journal/details input (not pushed away over the name input); the eye (👁) should be leftmost; the ▲▼ move buttons are completely hidden.
- **Root:** app.js renders the per-item row as a 4-col CSS grid (`30px minmax(120px,1.2fr) minmax(160px,2.8fr) 28px`). Sidecar **273** (strict-row-layout) owns the per-item row and lays it out as **flex** with `order`/fixed input widths; sidecar **278** (section-header row-fix) was *also* re-classifying the per-item eye/delete (walked up to a high ancestor) and stamping them `kind=on`/`del` at order 50/60 — fighting 273's order 40/50. The captured eye carried BOTH `data-antcv-pub273-eye` and `data-antcv-pubrow-kind-278="on"`. When 273 doesn't convert the container to flex in time, its flex-oriented children land in the app's grid → blank columns (inputs forced to 48/138px inside 1.2fr/2.8fr columns) and the move buttons (in a sibling `justify-content:flex-end` div) get clipped.
- **Shipped (safe, exclusion-only):** 278 v1.40.278-excl273 now SKIPS any button 273 owns (`data-antcv-pub273-*` / inside `[data-antcv-pub273-row]`), so it no longer fights 273 on per-item rows. `?v=1.40.278-excl273`, sw → `antcv-1.50.76`, TARGET → 1.50.76 (1.50.75 → STALE).
- **Still owed (needs live-tested 273 pass — registered):** (1) guarantee 273 converts the per-item row container from grid→flex so the blank gap can't appear; (2) re-order to the owner's spec — **👁 leftmost**, then name, then journal, then **✕ adjacent to journal**, with page/cjlr/compress/enhance + ▲▼ placed deliberately; (3) make the ▲▼ move buttons visible (their sibling flex div is clipped by the row width clamp). Diagnose live (the owner can't log into the branch preview — no relay configured there — so this needs prod or a relay-configured session).

### HIWC-BULLET-EDIT-001 — FIXED (1.50.86): debounce per-keystroke write + edit-safety
- After the loop damper (1.50.85) HIWC was still "not typable". Direct cause: every keystroke in a bullet input ran `inp.oninput → syncFromInputs → syncSectionField → pulse()` (`antcv:sections-updated`) → personality `forceRebuild` → React re-renders the HIWC section → the input being typed in is re-created → focus lost.
- **Fix (1.50.86, `how-contribute-controls-245`):** (a) the bullet input's section write is now **debounced 600ms** (and flushed on blur) instead of firing per keystroke, so typing no longer pulses a forceRebuild mid-word; (b) `run()` bails when `document.activeElement` is a HIWC bullet input (`isTypingInHiwc`), so the sidecar won't rebuild the row while the user is typing. Cache-bust `?v=1.50.86-typable`, sw → `antcv-1.50.86`, TARGET → 1.50.86 (1.50.85 → STALE).

### HIWC-EMPTY-PREVIEW-001 — empty bullet template must stay visible (verify on 1.50.86)
- Owner: the HIWC bullet template placeholder must remain visible in the preview as long as nothing has been typed into the bullet (or until deleted via ×). `syncPreviewBulletNodes` already returns early when there are no real values (`!vals.length`), so the sidecar does not inject/clobber the template; `preview-bullets-dedup-341` (prv-bullets3) is designed to keep a template-only list when there is no real-data sibling. The churn (now damped + the per-keystroke rebuild removed in 1.50.86) was a likely cause of the template flickering away. Re-check on 1.50.86: empty → template shown; typing → replaced; delete-× → template returns. If it still hides, the culprit is prv-bullets3's sibling check or `applyPreview` reconciling-down — fix there.

### HIWC-RERENDER-LOOP-001 — round 8 (1.50.85): CENTRAL DAMPER (whole class, one file)
- Owner directive: stop the per-round whack-a-mole, kill the loop decisively, ship. Privacy blip confirmed fixed (1.50.84); HIWC still hard to edit + preview→panel sync still broken (both downstream of the churn).
- **Fix:** new `pwa/antcv-loop-damper.js` (loaded FIRST, before all sidecars + app.js) wraps `MutationObserver` so callbacks for BROAD observers (target = body/documentElement + `subtree:true` — i.e. the ~60-sidecar herd) are coalesced + throttled to ~6.7/sec (150ms). Narrow/targeted observers pass through unchanged (contenteditable/focused widgets keep normal latency). A sidecar can still react, just not at frame rate, so it can't sustain a frame-rate feedback loop. React 18 doesn't use MutationObserver, so it's unaffected. Disable hatch: `localStorage['antcvDisableLoopDamper']='1'`. Risk acknowledged (global API wrap) per owner's "no matter the risk"; single-file revert if needed. `sw.js` → `antcv-1.50.85`, TARGET → 1.50.85 (1.50.84 → STALE).
- **Expected:** the mutation/rAF storm caps at ~6.7/sec regardless of how many writers exist → preview stops churning, HIWC inputs keep focus (editable), and prior per-screen pumps (align-cycler ping-pong, etc.) can no longer run hot. Re-run the rAF + mutation-source probes — totals should be a fraction of before. This is meant to END the loop sessions.

### PRIVACY-FAB-FLICKER-001 — FIXED at source (1.50.84) + loop round 8
- **mutation-source probe on 1.50.83 (Preview + panel):** round-7 worked (panel-action/label-206/207 dropped 296→39/sec). New top: `style on BUTTON.antcv-align-cycler` (156/sec) + `childList on DIV` (156) + `align-cycler-injected` (156) + `preview-cjlr-hidden` (78) + `align-sid` (78) … and `style on BUTTON.antcv-fab` (29/sec) = the privacy blip.
- **Privacy blip root + fix:** `topbar-tools-347.stylePrivacyForTopbar` re-asserted `display/visibility/opacity !important` on the FAB **every sweep** to fight the islands PreviewToolbar's periodic inline hide — a JS ping-pong that mutated the FAB style ~29/sec (the blip). Fix (1.50.84): force the relocated FAB visible with a **passive CSS `!important` rule** (`injectPrivacyVisibilityCss`) that beats the island's non-important inline hide, and **remove the per-sweep JS display/visibility/opacity writes**. CSS wins passively → no counter-write, no blip. `?v=1.50.84-fab-css`, sw → `antcv-1.50.84`, TARGET → 1.50.84 (1.50.83 → STALE).
- **Still pumping (registered, next round): ALIGN-CYCLER-PINGPONG** — `section-align` keeps creating per-section `antcv-align-cycler` buttons while `antcv-section-main-panel-fix.removePreviewCjlrGhosts` keeps removing them as "ghosts" (`preview-cjlr-hidden` + `btn.remove()`) → ~156/sec create/remove churn. Resolve by stopping section-align from injecting the preview cyclers that main-panel-fix immediately deletes (feature-level — confirm which cycler is canonical before disabling). `align-sid` (78/sec) is written by app.js on section rows (downstream of its re-render; not sidecar-fixable).

### PREVIEW-PANEL-EDIT-SYNC-001 (registered)
- Owner: after editing inputs in the preview, the section panel isn't editable / doesn't pick up the change (preview→panel reverse sync). Same family as CL-HEADER-001 (panel↔preview share a store via candidate-preview-editor); register for the candidate-editing pass once the loop is flat.

### HIWC-RERENDER-LOOP-001 — round 7 (1.50.83): section-panel-206/207/208 attribute storm (Preview + panel open)
- **mutation-source probe on 1.50.82, Preview with sections panel open:** the pump is `data-antcv-panel-action/label-207` (296/sec), `-206` (228/sec), `-208` (202/sec) on BUTTON — **~726/sec combined** — plus align-cycler style/childList (~167/sec, downstream). Earlier rounds didn't see these because that screen wasn't probed; the prior `forceRebuild`/HIWC writes were a different facet.
- **Root:** THREE section-panel sidecars (`antcv-section-panel-206/207/208.js` — iterative versions, all still loaded) each loop over the panel buttons every sweep and `setAttribute` `data-antcv-panel-action/label-NNN` + `style.order` **unconditionally** (208 also stamps 207's; 207 also stamps 206's). Each `setAttribute` to the same value emits a mutation record → wakes every body-observer → they re-run → re-stamp = the storm.
- **Fix (1.50.83):** idempotency guards in all three button loops — write `data-antcv-panel-action/label-*` and `style.order` only when the value differs. Stable state → zero panel mutations. Cache-bust: 3 tags → `?v=1.50.83-idem`, sw → `antcv-1.50.83`, TARGET → 1.50.83 (1.50.82 → STALE).
- **Note:** 206/207/208 are layered versions all active — a future cleanup should retire the superseded ones, but idempotency is the safe immediate fix. The ~167/sec align-cycler churn is downstream of these re-renders; re-probe after deploy — if it persists, guard section-align's `injectPanelCyclersInto`/cycler restyle next.

### HIWC-RERENDER-LOOP-001 — round 6 (1.50.82): the HIWC section-write loop (residual)
- **Progress confirmed (owner, 1.50.81):** privacy FAB gone from Settings ✅ (PRIVACY-SETTINGS-001 fixed by the sticky back-off); top-bar flicker "slower" (back-off working, residual driven by the loop below).
- **Residual loop named in console:** repeated `[antcv] sections refreshed from external write {source: 'how-contribute-controls'}` → `[antcv-personality] forceRebuild antcv:sections-updated how-contribute-controls` → `[shape-guard] eager-normalized`. `how-contribute-controls-245.syncSectionField` wrote sections + `pulse()` (dispatch `antcv:sections-updated`) on EVERY call → personality forceRebuild re-renders the section → the sidecar re-runs → writes again. This is also why HIWC was "very hard to type" and the preview bullets duplicated (`g,gr,g,gr` for 2 inputs — the loop re-injecting).
- **Fix (1.50.82):** `syncSectionField` is now idempotent — compares intro/closing/bullets against the stored values and only `writeJson`/`writeDocSpecificSections`/`pulse()` when something actually changed. No change → no write → no pulse → no forceRebuild → loop dies. Cache-bust `?v=1.50.82-idem`, sw → `antcv-1.50.82`, TARGET → 1.50.82 (1.50.81 → STALE).
- **Expected:** HIWC typable, preview bullets no longer duplicated, and the residual privacy flicker stops (the forceRebuilds that re-triggered the overlay toggle are gone). If the preview still shows duplicate bullets after this, that's a separate app-renders-bullets + sidecar-injects-bullets dedup (HIWC-EMPTY-PREVIEW-001) — re-check after deploy.

### HIWC-RERENDER-LOOP-001 — round 5 (1.50.81): overlay hide/show ping-pong (privacy flicker) + log noise
- **Post-1.50.80 console named the residual churners:** `preview-shell-sticky:128 unhid <div class="antcv-overlay antcv-overlay-bottom-right"> flex` spamming, + `lang-bar-filter:223 wanted=en,da shown=2 hidden=2` spamming. The align-attr storm (round 4) is gone.
- **Root (privacy flicker + "FAB visible on the side in Settings"):** `antcv-overlay.js:413` toggles `antcv-overlay-hidden` from `isContentReady()` (false in Settings / during cloud-sync). `preview-shell-sticky` strips that class via a MutationObserver. Both observe the overlay → they re-trigger each other at frame rate (the flicker + rAF churn). And sticky forcing the overlay visible in Settings is exactly why the FAB shows "on the side" there.
- **Fix (1.50.81):** `preview-shell-sticky` — (a) anti-ping-pong **back-off**: distinguish a single transient hide (correct once — its real job in preview) from a persistent hide (Settings / not-ready — yield 5s so antcv-overlay wins → no flicker + FAB stays hidden in Settings, satisfying PRIVACY-SETTINGS-001); (b) narrow its observer to class changes ON an overlay root (was every class mutation in the body). `lang-bar-filter` — log only on actual change (was idempotent but logged every woken run = console flood). Cache-bust: `?v=1.50.81-backoff` / `?v=1.50.81-quietlog`, sw → `antcv-1.50.81`, TARGET → 1.50.81 (1.50.80 → STALE).
- **Expected:** privacy flicker stops, FAB hidden in Settings, rAF flood drops further. Re-run the rAF + mutation-source probes; if residue remains (`style on BUTTON` ~21/sec), that's the next target.

### HIWC-RERENDER-LOOP-001 — round 4 (1.50.80): PUMP FOUND + fixed
- **mutation-source probe (1.50.79) named the pump:** `attr:data-antcv-profile-workstyle-align on SPAN` = **765/5s ≈ 153/sec** — by far the dominant mutation. Then `data-antcv-aligned on SPAN` ~33/sec (section-align), `data-antcv-core-row-preview-align on TR` ~25/sec + `data-antcv-core-row-align` (core-competencies-234), `style on BUTTON` ~21/sec, pub273 attrs, `style on BUTTON.antcv-fab` ~10/sec.
- **Root:** four sidecars wrote `style.textAlign` + their align ATTRIBUTE **unconditionally on every sweep** (~12 spans × ~13 sweeps/sec). `setAttribute` to the same value still emits a MutationObserver record, so this generated ~236 attribute-mutations/sec — the storm that woke every body-observer in the app (the ~13/sec herd + the island mount reactors = the re-render loop). NOT React; a sidecar attribute storm.
- **Fix (1.50.80) — idempotency guards (write only when the value differs):** `antcv-profile-workstyle-cjlr-238` (applyEditors + applyPreview, the 153/sec), `antcv-section-align` (applyAlignmentToSection, data-antcv-aligned), `antcv-core-competencies-row-controls-234` (applyEditor + table applyAlign). Stable state now produces ZERO align mutations. Cache-bust: 3 tags → `?v=1.50.80-idem`, sw → `antcv-1.50.80`, TARGET → 1.50.80 (1.50.79 → STALE).
- **Expected:** rafPerSec should drop sharply; HIWC editing, empty-preview, privacy flicker, and pub-multi-row should settle (all were downstream of this storm). Re-run the rAF + mutation-source probes to confirm; secondary residue (`style on BUTTON` 21/sec, pub273) addressed next if still present.

### Mobile + label batch (owner, 1.50.80-era) — registered
- **MOBILE-FUSE-001:** the Fuse (🔀) button is not visible in the mobile bottom panel — surface it there.
- **MOBILE-TABLEWIDTH-001:** the table-width controls from the top panel are only partly visible on mobile — hide them entirely on mobile (acceptable per owner).
- **MOBILE-EXTRACTION-001:** the document-Extraction button can hover in the grey area on mobile — re-anchor it.
- **LABEL-HISTORY-001:** rename the top-panel "Application history" button to "History" to save space. (app.js-rendered label; candidate for a sections-icon-style text rewrite or app.js.)

### HIWC-RERENDER-LOOP-001 — round 3 (need mutation-source probe for the pump)
- **Probe on 1.50.79:** round-2 confirmed — `section-align` GONE from the top. Remaining: `react-islands.js:1` ~42/sec (209/5s), then the ~13/sec herd (66/5s each).
- **Finding by source inspection:** the ~42/sec react-islands rAF is the island `mount.tsx` MutationObservers (PackagePicker/LayoutPicker/WritingStylePicker/LanguageCard/ExportOptions/etc.) each watching `document.body {childList,subtree}` and rAF→`applyOnce` on every mutation. `applyOnce` is idempotent (renders only if unmounted), so they're cheap REACTORS, not the pump. Every 13/sec herd entry (`data-importer:978`, `personality:597`, `candidate-preview-editor:408`, …) is likewise a body-observer→rAF→idempotent-sweep REACTOR. So a single source mutates the DOM ~13/sec and everything reacts; the rAF probe structurally can't show it (mutators don't rAF).
- **Next datum:** `docs/qa/probes/mutation-source-probe.js` records the top mutated targets (element/attr) — names WHAT changes 13/sec → the pump (a sidecar emitter to gate, or app.js-internal). Until then, do not throttle the 8 island mount observers blind (Vite rebuild, untestable here, and only reduces amplification not the root).

### SETTINGS-OVER-PREVIEW-001 — "Open in Settings →" / Application history must lay OVER the preview (after the loop)
- Owner: the `Open in Settings →` button (Applications) should open Settings → Application history ABOVE the preview, not behind it. `antcv-settings-front-327.js` already z-indexes settings roots to 2147483600 + clicks STANDARD → Application history; verify why the panel still lands behind preview (likely the preview/paper has its own stacking context or the settings root isn't matched). Do AFTER the loop is resolved (settings-front was just throttled; confirm interaction).
- **Round-1 confirmed working (probe on 1.50.78):** `settings-front`, `wizard-step10`, `row-controls` all dropped out of the top; the personality gate held (forceRebuild logged once, not looping). But ~798→ still flooding; new top: `react-islands.js:1` **39/sec** (React re-rendering), `section-align.js:1117` **24/sec** + `:1021` 12/sec, then the ~12/sec herd.
- **Round-2 fix (section-align, 1.50.79):** (1) the role-cycler `rAF` at line 1117 was UNGUARDED — fired on every `schedule()` (~24/sec) running a `querySelectorAll` reflow for an INERT feature (no `[data-role-id]` in app.js); now skipped when none exist + guarded. (2) throttled the main reapply pass to ≥300ms (was ~12/sec). Net ~33/sec of rAF + forced-reflow removed. `?v=1.50.79-throttle`, sw → `antcv-1.50.79`, TARGET → 1.50.79 (1.50.78 → STALE).
- **Remaining engine:** `react-islands.js` re-rendering ~39/sec — a React state loop inside the islands (src/islands), which churns the DOM and wakes the 12/sec herd. The rAF probe can't name the island (all map to bundle :1). Next: the new `docs/qa/probes/event-rate-probe.js` counts dispatched event types — if `antcv:sections-updated`/`input`/`storage` fires ~12-39/sec, that names the trigger the islands re-render on, and I gate the emitter. Do NOT blind-edit the islands bundle.

### Row-control batch (owner, 2026-06-04) — gated on the loop, registered
All three are in the contended row-control zone that HIWC-RERENDER-LOOP-001 is actively churning; implement after the loop is confirmed dead (otherwise unverifiable + risks worsening the oscillator).
- **PUB-ROW-MULTIROW-001:** in Publications & Patent the `273` controls attach only to the FIRST row; rows 2-3 show just input + delete (owner screenshot). `273.rows()` does pair name+detail for every row, so the most likely cause is the loop re-creating rows 2-3 before `273` re-wires them (row 1 stays wired). Re-check after the loop fix; if it persists, debug `273` per-row `wire()`/`host()` attachment.
- **MERGED-MOVE-CONTROL-001:** replace the big separate up/down buttons (23px, bordered, `data-antcv-pub273-move`) with the COMPACT STACKED control used elsewhere — `<div style="display:flex;flex-direction:column;gap:1px"><button 8px borderless>▲</button><button 8px borderless>▼</button></div>` — across ALL list subsubsections (HIWC bullets, pub rows, tables). Add drag-to-move (snap). The move result MUST reflect in the preview. Tables: do NOT move the table header row (it is duplicated only when the table spans a page break). Owners: `273` (pub), `how-contribute-controls-245` (bullets), `table-row-page-controls-328`/`table-page-splits-327` (tables).
- **CL-BODY-CONTROLS-001:** in the cover letter, Body subsections are missing the ▶ first button (before Enhance) that the CV main rows have; and the designated `data-antcv-cl-body-move-button="greeting"` (☰ "Move Greeting to the candidate area") does not work. Owner: `antcv-cl-body-move-button-341.js`. Verify the move handler wiring + add the ▶ control to parallel the CV rows.

### Loop still flooding after 1.50.77 (owner, with rAF flood) — gate everything on the probe
Owner reports the `requestAnimationFrame` violation flood persists, AND: HIWC bullets not editable in the section panel, HIWC empty-template bullets not visible in preview, privacy FAB still flickers.
- **All four are downstream of HIWC-RERENDER-LOOP-001, not separate bugs:**
  - **HIWC-BULLET-EDIT-001:** `how-contribute-controls-245.renderBulletList` IS guarded (binds the input once per textarea via `data-antcv-hiwc-bullets-bound`). The guard is defeated when the loop re-creates the textarea ELEMENT each cycle → fresh unbound textarea → input rebuilt → focus lost → typing doesn't stick. Fixing the loop fixes editability.
  - **HIWC-EMPTY-PREVIEW-001:** the empty template can't settle while the section re-renders ~12/sec (prv-bullets3 + the loop racing).
  - **PRIVACY-FAB still flickers:** the loop re-mounts the topbar → `topbar-tools-347` re-parents the FAB each cycle (the v1.50.74 transition/guard fix only addressed the FAB's own repaint, not topbar re-mounting under the loop).
- **Blocker / next step:** confirm the owner is actually on ≥1.50.77 (`window.ANTCV_VERSION`; stale SW would serve the old bundle) and re-run the rAF-attribution probe for the new top-of-table. Round-1 (1.50.77) hit settings-front/wizard-step10/personality/row-controls; if a 12/sec residue remains, gate the next pump (candidate-preview-editor emit or the React-islands 39/sec re-render). Do NOT blind-patch more sidecars without the fresh table — the ~50-sidecar coupled oscillator can worsen.

### DATA-EXPORT-001 + DELETE-SAVE-001 — owner feature requests (APP.JS, registered)
- **DATA-EXPORT-001:** in the Personal menu, let the user download their stored data + personal analytics to a protected file. Layer: APP.JS (the data lives in `localStorage.personalInfo` + analytics keys; the menu is app.js). Plan: serialize the relevant localStorage keys (personalInfo, writingPrefs, analytics) to a JSON blob, offer download; "protected" = at minimum a clear filename + optional passphrase-encrypted variant (AES via WebCrypto) — confirm with owner whether encryption is required or just a local file.
- **DELETE-SAVE-001:** in the "Are you sure?" erase sequence (the red confirm card), add a checkbox "Save my data locally first" that triggers the DATA-EXPORT-001 download before `AntcvFullErase`. Layer: APP.JS (the delete card + `window.AntcvFullErase`/`AntcvAuth.signOut`). Shares the export serializer with DATA-EXPORT-001.

### PREVIEW-ICON-001 + MOBILE-NAV-OVERLAP-001 (1.50.78)
- **Preview tab icon (done):** the bottom-nav Preview tab had no icon while Section (¶) and Analysis (🎯) did. Extended `antcv-sections-icon-346.js` (one self-healing decorator, no new observer) to also prefix Preview with 👁 — groups: `[¶ Section] [🎯 Analysis] [👁 Preview]`. EN verified; DA Preview label matched on common forms.
- **Mobile bottom-nav overlap (done):** the fixed bottom nav (`.antcv-react-bottom-nav`, `left/right:10px`) is a flex row of ~8 controls; on narrow viewports the right-most (CV/CL) clipped off-screen (owner screenshot). Added a mobile rule: `flex-wrap:wrap; justify-content:center; max-height:38vh; overflow-y:auto` so every control stays visible. `antcv-mobile-controls.css?v=1.50.78-navwrap`.
- **Top-bar overlap (REGISTERED, not blind-patched):** owner also reports top-panel buttons folding. The top header left cluster (ant, EN, "Application history", CV/SB toggles, ↵) is app.js-rendered + the right tools are `topbar-tools-347`/`mobile-fab-cleanup-351`. Needs the specific clipped elements identified live (which button disappears at which width) before a safe wrap/scroll fix — risk of disturbing the contended FAB relocation. Cache-bust this batch: sw → `antcv-1.50.78`, TARGET → 1.50.78 (1.50.77 → STALE).

### HIWC-RERENDER-LOOP-001 — diagnosed via rAF probe + first round of fixes (1.50.77)
- **Measured (rAF-attribution probe, owner's prod session):** 798 rAF/sec. Top schedulers: `settings-front-327:20` and `wizard-section-format-step10:92` at ~61/sec (every frame), then ~50 sidecars all at exactly 12.2/sec — a herd reacting to a shared ~12/sec re-render storm. `personality:597` (forceRebuild) and `candidate-preview-editor:408` both in the 12/sec herd.
- **Mechanism:** (a) the two 61/sec sidecars each run a `documentElement` MutationObserver watching `style`/`class` whose callback WRITES style — so they fire every frame off their own writes + the herd's style churn; (b) `personality.forceRebuild` removes+appends its block on every `antcv:sections-updated`, a DOM mutation that wakes all ~50 body-observing sidecars, one of which re-emits → the 12/sec loop; (c) `row-controls-wording` rewrote button title/text and re-triggered its own title/childList observer ("rewrote 1 button(s)" flood).
- **Round-1 fixes (all behaviour-preserving), shipped 1.50.77:**
  - `personality` v…-loopgate: forceRebuild skips the remove+append when the block data signature is unchanged AND a single connected block already exists (identical-DOM rebuild = visual no-op) → removes the per-cycle mutation pump.
  - `settings-front-327` + `wizard-section-format-step10`: throttle their observer-driven scheduler to ≤2/sec (was per-frame) → removes the two top amplifiers; reactivity preserved via the existing timers/click/hashchange paths.
  - `row-controls-wording` v…-p1b3: disconnect the observer during its own sweep + 500 ms throttle → stops the self-feed.
- **Next:** owner re-runs `docs/qa/probes/raf-attribution-probe.js` after deploy; expect rafPerSec to drop sharply. If a 12/sec residue remains, the next pump is in the herd (candidate-preview-editor emit or another section-panel sidecar) — gate that emit on a real diff. Systemic root: ~50 sidecars each running a body-wide MutationObserver that also mutates the DOM (coupled oscillator); long-term they need shared-scheduler/observer hygiene.

### BLEEP-MULTI-001 — name + location + privacy all bleep together (video 2026-06-04)
- Owner attached a video: the candidate **Name**, **Location**, and the **Privacy** pill all pulse/"bleep" in sync.
- **Read:** three unrelated elements bleeping in lock-step is one global driver, not three bugs — the preview/topbar **re-render loop (HIWC-RERENDER-LOOP-001)** repaints the header and re-mounts the topbar. Under that loop: (a) `topbar-tools-347` re-parents the privacy FAB each tick → flicker (my v1.50.74 transition/guard fix stops the FAB's *own* repaint but not re-parenting under a topbar re-mount); (b) Location is re-rendered by app.js; (c) the Name oscillated because `antcv-name-align-fix` re-applied `text-align` inline on every re-render, fighting app.js's `left`.
- **Action this round:** hardened `antcv-name-align-fix` v1.1.0 — removed the per-render inline writes; alignment is now a single injected `!important` **stylesheet rule** that wins passively, so the Name no longer races app.js (no oscillation). `?v=1.1.0-norace`, sw → `antcv-1.50.75`, TARGET → 1.50.75 (1.50.74 → STALE).
- **Still root:** the loop itself. Location + privacy bleep until HIWC-RERENDER-LOOP-001 is fixed. Probe `docs/qa/probes/rerender-loop-probe.js` measures the loop rate, the `antcv:sections-updated` emit rate, and whether the FAB/name nodes are being recreated — run it live, then patch the emit at source.

### PRIVACY-FAB-FLICKER-001 — FIXED (the "bleeping" background)
- Owner (high priority): the privacy 🛡 pill in the top bar pulses ("bleeps") its background.
- **Diagnosis:** `worst` (the privacy level) is read from a stable localStorage key, so it does not legitimately flap. The only periodic actor is `antcv-privacy-led.js`'s **2 s `setInterval` → `refreshFabAppearance`**, which every tick rewrote `textContent`, detached/re-appended the `.antcv-privacy-dot`, and re-asserted `background … !important`. The element carried `transition: background-color 0.15s`, so each re-assert cross-faded the fill — a periodic repaint seen as a pulse. (`topbar-tools-347` restyles size/visibility only — no background; `mobile-fab-cleanup-351` uses a translucent fill but only on the separate mobile FAB, which privacy-led's `FAB_MARKER` selector does not match — so no cross-sidecar background contention on the desktop pill.)
- **Fix (v1.50.74):** (1) dropped `background-color` from the FAB's `transition` so the fill can never animate; (2) added an idempotency guard in `refreshFabAppearance` — a `data-antcv-pl-sig` (worst|glyph|calls) short-circuits all DOM writes when the visible appearance is unchanged, so the 2 s tick stops repainting. Border/glyph colour still fade on a real level change. Cache-bust: `?v=1.50.74-nobleep`, `sw.js` → `antcv-1.50.74`, `version-override` TARGET → `1.50.74` (1.50.73 → STALE).

### NAME-ALIGN-001 — FIXED (sidecar)
- Owner: the candidate Name renders `text-align: left` while its CJLR control reads "current: center". Confirmed the editor's `wrapEditable` does NOT touch text-align — the `left` comes from app.js rendering the Name with `text-align: y("name")`, which is desynced from the CJLR control. Pure app.js-internal state desync (the control's displayed value and `y("name")` disagree).
- **Fix:** new sidecar `pwa/antcv-name-align-fix.js` (v1.0.0) keeps the Name line's text-align in lock-step with its CJLR control: reads the control's `current: <align>`, persists it to `localStorage:antcv:nameLineAlign` (so it survives the panel being closed / reloads), and applies it `!important` to `[data-antcv-candidate-edit="name"]`, re-applying on re-render + on a CJLR click + a 1.2s backstop. Disable hatch `antcvDisableNameAlignFix`. Cache-bust: new tag `?v=1.0.0`, `sw.js` → `antcv-1.50.73`, `version-override` TARGET → `1.50.73` (1.50.72 → STALE).

### Candidate panel ↔ preview sync — TRIAGE (2026-06-04)
Owner reported, after the role/company fix landed: preview→panel input doesn't refresh; the Name panel input isn't connected to the preview Name; contact/Location fields aren't connected; the preview Specialisation line isn't editable; and the panel has a redundant combined "Location line" alongside city + country.
- **Root:** the contact/name/specialisation panel, the line-alignment store, and the "Location line" field all live in **minified `app.js`** (not the readable React islands). Each candidate field writes its own in-app state object and `app.js` owns the rendering, so a per-field sidecar bridge is the wrong shape (high-risk, untestable here, will conflict). The role/company fix only worked because that store was a clean top-level localStorage key (`meta`).
- **Recommendation:** treat the candidate panel↔preview two-way sync + field cleanup as one app.js/React task (plan CA-001..005), done with live testing — not a growing stack of blind sidecars.
- **Owner decisions captured (queued):** drop the redundant combined "Location line" input and relabel the city field to "Location" (keep country) — implementable as a safe hide/relabel sidecar next.

### CL-HEADER-001 — panel↔preview store mismatch FIXED (p0d-fix7)
- **Found via the panel + screenshot:** the Set-panel "Application — Role/Company" inputs and the top-bar chip use the localStorage **`meta`** object (chip renders `` `${meta.role} @ ${meta.company}` ``, app.js `setItem("meta")`). The preview sentence read `personalInfo.role/company` — a DIFFERENT store — so panel edits (`Gt`/`dfdf`) updated the chip but the sentence kept showing the showcase fallback (`Ideal: [Role] - That Company`, where `That Company` = `pi.targetCompany`).
- **Fix (`p0d-fix7`):** `candidate-preview-editor-341` now reads role/company from `meta` first (falling back to the legacy personalInfo keys) and writes preview edits back to `meta`, so the panel, the chip, and the preview sentence share one source of truth. Added a `storage`-event listener for the `meta` key to re-sweep. Cache-bust: `?v=p0d-fix7`, `sw.js` → `antcv-1.50.72`, `version-override` TARGET → `1.50.72` (1.50.71 → STALE).
- **Still owed (app.js, out of sidecar scope):** the panel exposes only Role + Company inputs, not the "Application" label word (CA-002 wants applicationLabel in the panel too); the label IS editable in the preview. Reverse sync (preview edit → live panel-input value) updates `meta` + chip but the panel input reads app in-memory state, so it refreshes on the app's next render, not instantly.

### CL-HEADER-001 — edit-safety guard (p0d-fix6, shipped #107)
- On 1.50.70 the host DOES attach: `<div data-antcv-candidate-application-sentence="1">` with three `contenteditable` spans (`applicationLabel` "Application", `role` "[Role]", `company` "[Company]"). The fields read are correct — the editor reads `pi.role`/`pi.company`, which the probe confirmed the panel writes.
- **Real root cause:** `wrapApplicationSentence` ran `host.innerHTML = ''` and rebuilt the spans on EVERY sweep. With the preview re-rendering constantly (HIWC-RERENDER-LOOP-001), each sweep destroyed the span the user was typing into → focus lost, text reverted to placeholder. So the line was un-editable and never showed the entered role/company (only the app-name chip updated).
- **Fix (`p0d-fix6`):** edit-safety + idempotency guard — skip the teardown when focus is inside the host (user is editing) or when the existing spans already match label/role/company. Cache-bust: `?v=p0d-fix6`, `sw.js` → `antcv-1.50.71`, `version-override` TARGET → `1.50.71` (1.50.70 added to STALE). Verify on 1.50.71: typing in Application/Role/Company spans sticks; panel edits flow into the sentence.
- **Still open sub-items:** the `nowrap; overflow:hidden` on the header line is CL-LAYOUT-002 (clips to page width). NAME-ALIGN-001 (below).

### OPEN — NAME-ALIGN-001
- Owner: the candidate Name renders `text-align: left` while its CJLR control reads "current: center". The center alignment is not applied to the Name line. Captured: `<div data-antcv-candidate-edit="name" style="...text-align: left;...">` with a CJLR button titled "CJLR for Name line — current: center". Fix: apply the stored CJLR value to the name node. Needs to confirm whether the alignment writer is `candidate-preview-editor-341`, a CJLR sidecar, or app.js.

### PRIVACY-FAB update (2026-06-04, on 1.50.71-era capture)
- The button itself now renders visible in the panel-open state (the captured node no longer carries `display:none`/`visibility:hidden`). What remains is the inner `<span class="antcv-privacy-dot">` blinking — likely a CSS pulse "live" indicator and possibly intentional. The "invisible when section tabs are closed" state was not captured; still needs the closed-state DOM + the style-mutation watch (capture B) to decide if any patch is warranted.

### Still-not-fixed reports (need version confirm / further work)
- **HIWC template still hidden in CL (owner):** `prv-bullets3` keeps the template when no real-data sibling exists; if it is still blank, either 1.50.70 had not loaded yet, or the empty template is not emitted by the app render at all (not a dedup case). Confirm `ANTCV_VERSION` = 1.50.70 after hard refresh; if still blank, this is an app-render gap, not the dedup.
- **PRIVACY-FAB-FLICKER-001 worse:** now invisible when section tabs are closed, flickers when the section panel is open; should be a persistent topbar pill. Captured node still carries `display:none !important` + `opacity:1 !important` + `data-antcv-topbar-moved="1"` — `mobile-fab-cleanup-351` / `topbar-tools-347` / `privacy-led` fighting. Needs a mutation-source probe before patching.

---

## 2026-06-04 — HIWC bullet-dedup console flood (fixed) + re-render loop (new, OPEN)

Owner report: in the cover-letter "How I Would Contribute" the second group of three bullets pops in and out continuously, and the console is flooded so a probe readout can't be taken.

### Fixed — console flood from `antcv-preview-bullets-dedup-341.js`
- **Root cause:** a re-render loop elsewhere keeps re-mounting the template `<ul data-antcv-hiwc-list="1">` as FRESH DOM nodes (without the `data-antcv-prv-bullets-hidden` marker), so the dedup re-hides each new node and logged a per-node `console.debug` every time — thousands of lines that drown the console.
- **Fix (v1.40.341-prv-bullets2):** collapse the per-node log into one debounced summary (`hid N template-only list(s) since last report`, ≤1 / 2s). Behaviour-preserving — hide/show logic unchanged. Cache-bust: `index.html ?v`, `sw.js CACHE` → `antcv-1.50.68`, `version-override` TARGET → `1.50.68` (+ 1.50.42..67 added to STALE). The reported count now doubles as a re-render-rate signal.

### Fixed — empty HIWC section rendered blank (`prv-bullets3`)
- **Symptom (owner):** after the flood fix, the HIWC bullets were fully hidden unless text was typed in the section panel; the empty template placeholders should stay visible.
- **Root cause:** `hideTemplateLists` hid EVERY template-only `<ul>`/`<ol>` unconditionally — including when no real-data render existed to fall back to — so an empty section went blank. The module header always intended a sibling check ("hide only when a sibling editable-text span shows the same text") that the code never implemented.
- **Fix (v1.40.341-prv-bullets3):** added `hasRealDataSibling(list)` — a bounded (≤4-ancestor) search for a `[data-antcv-editable-text="true"]` span with real, non-placeholder content outside the list. Hide the template only when such a sibling exists; otherwise keep the template visible. Worst case degrades to the prior duplicate render, never a blank section. Cache-bust: `?v=prv-bullets3`, `sw.js` → `antcv-1.50.69`, `version-override` TARGET → `1.50.69` (1.50.68 added to STALE; invariant preserved).

### OPEN — PRIVACY-FAB-FLICKER-001
- **Status:** OPEN — note only; not yet diagnosed.
- **Symptom (owner):** the Privacy 🛡 FAB "bleeps" (flickers). Captured node carries conflicting inline styles — `display:none !important; visibility:hidden !important; pointer-events:none !important` AND `opacity:1 !important` AND `data-antcv-topbar-moved="1"` — i.e. competing sidecars (`mobile-fab-cleanup-351` / `topbar-tools-347` / `privacy-led`) fighting over its visibility/placement (PRV-005). Needs a probe of which sidecar writes the style last on each tick before any patch.

### OPEN — HIWC-RERENDER-LOOP-001 (the actual flicker)
- **Status:** OPEN — needs a targeted probe before any patch (diagnostic-first; do not blind-patch a central sidecar).
- **Symptom:** the template HIWC bullet list re-mounts on a loop, so the dedup is in a perpetual race (visible flash → hidden → visible …).
- **Suspected driver:** `antcv-candidate-preview-editor-341` writes sections (`source: 'candidate-preview-editor-341'`) → `antcv-personality` `forceRebuild` on `antcv:sections-updated` → React re-mounts the section → editor's observer fires → writes again. Console shows this chain repeating.
- **Next step:** instrument which sidecar re-fires `antcv:sections-updated` without a real data change, then gate that emit on an actual diff. Candidate fix sits in `candidate-preview-editor-341` (and/or the personality forceRebuild trigger), both readable sidecars.
- **Related QA-spec IDs:** CL-003 (HIWC modelled as Intro + per-bullet rows + Closing), GEN-UI-003 (endless controls under generation), PRV.

---

## 2026-06-03 — test-infrastructure landing + roadmap status audit (branch `claude/antcv-roadmap-bugs-L9Sqa`)

Scope this entry covers: automated tests and status tracking only. No sidecar,
`app.js`, or React-island behaviour changed — the open UI/UX items below are
untouched and still owe live verification per the DoD gate.

### Landed
- **Proxy writing-engine unit tests (40, `node:test`).** `workers/proxy/test/writing-style-engine.test.mjs` (32) + `workers/proxy/test/registry-sync.test.mjs` (8). Pure logic, no Cloudflare bindings, no network — every LLM call is injected. `npm test` in `workers/proxy/` is now `node --test`. All 40 pass locally on Node 22.
- **Registry-drift guard.** `registry-sync.test.mjs` ties the worker's inline style + banned-list subset back to the canonical `writingSystems/registry.json` (style-id set, default, language partition, shared banned words + phrases exact, per-style active / allowed length / tone chips / glyph density, every legacy alias resolves, active-at-cut roster). The "keep in sync" comment in `writing-style-engine.js` is now enforced, not advisory.
- **CI gains a functional check.** `.github/workflows/deploy.yml` adds a `unit-tests` job (Node 22, `node --test`, no install step) and a `pull_request` trigger so `lint` + `unit-tests` run pre-merge. Deploy jobs stay gated on push-to-main / workflow_dispatch — a PR never deploys.
- **Docs updated:** `TESTING.md` (Unit row, new "Proxy worker" subsection, §8.4 row marked seeded, CI section), `README.md` Tests list.

### Roadmap status audit — confirmed implemented in code (live/visual verification per DoD is separate)
- **§4.7 writing-engine pipeline** — `workers/proxy/src/writing-style-engine.js`: request parse + normalisation, preamble enrichment, SCE banned-list filter, ≤2-retry loop with flagged third draft, ATS glyph conversion, telemetry. Now unit-covered.
- **§4.5 language-partitioned banned lists** — object keyed by ISO code in both registry and worker; a Danish output is never filtered against English bans. Now unit-covered (preamble + SCE partition tests).
- **§4.10 glyph rules** — `src/lib/glyph-rules.ts` (PWA) + worker copy; allowed bullets and ATS labels agree across both.
- **Registries present and driving output** — `packages/registry.json` (CSS bundle + DOCX palette), `writingSystems/registry.json` (12-style engine).
- **Pass-1 React islands** — present under `src/islands/` (LanguageCard, PreviewToolbar, SettingsRouter, PackagePicker, WritingStylePicker, ExportOptionsCard, LayoutPicker, Breadcrumbs, wizard pickers).
- **docx-worker per-package palette (v1.50.8)** — `workers/docx-worker/src/palette.js`, legacy-ATS Calibri fallback; baseline smoke (`test/smoke.js`) passes locally.

### Known environmental gap (not a product bug)
- `workers/access-relay/tests/*.mjs` hardcode the sql.js wasm at `/home/claude/work/sqljs/sql-wasm.{cjs,wasm}`, which is absent here, so both relay suites error on load (`MODULE_NOT_FOUND`) until that path is provisioned. They are not in CI for this reason. Candidate follow-up: make the wasm path overridable via env var and vendor or fetch sql.js so the relay suites can join the `unit-tests` job.

---

## SESSION LANDED — shipped to `main`, LIVE VERIFICATION OWED (highest priority)

Everything in this block is committed to `main` (code complete) but went straight to `main` **without passing the acceptance gate** (see DoD below). None of it has been confirmed on the live site. Treat live verification as the top open task — bias to short, careful checks, and do not mark any item FIXED until it passes in Preview + PDF + DOCX (where applicable) on **desktop and mobile**, with no Preview-only, wrong-item, or after-hard-refresh-only behaviour.

Deploy anchor: islands bundle rebuild + Export-options move landed at commit `c475c4b` on `main`. Verify Cloudflare Pages has built that commit, then `?hardReset=1` before testing (clears the service worker + caches).

### What landed this session
- **QA spec v4 ingest.** Memory pointer added; canonical index committed at `docs/qa/AntCV_QA_backlog_index_v4.md`; this `ACTIVE_BUGS.md` folds in the v4 backlog. (Documentation — no live behaviour to verify, but it is the source of the IDs referenced below.)
- **357 sidecars + loader.** `antcv-validation-severity-consumer-357.js` (VAL-001 / VF-016 — stamps Set-menu validation nodes by severity so warnings render yellow, errors red), `antcv-help-text-wording-357.js` (PB-005 / TB-003 — rewrites "Compress" to "Fit" on non-button help/legend/caption nodes), `antcv-page-break-icon-357.js` (PB-005 / GEN-003 — swaps the down-arrow glyph for the semantic next-page glyph U+2398 on identified page-break controls only), and `antcv-357-loader.js` (runtime registrar; index.html also carries direct tags — double-registration is a no-op via per-file version guards + the loader's already-present skip).
- **Analysis-panel JD block — clean v1.40.358.** `antcv-analysis-panel-jd-block-356.js` rewritten after the branch copy was found corrupted (two conflicting `findAnalysisPanel` definitions merged from parallel worktrees → syntax error that stopped the whole sidecar parsing). The clean version (a) attaches to the EMPTY-state panel — keyed on the "Generate a CV first to see the analysis" text, not just the "Application Analysis" heading that the empty state never renders — and (b) uses a TIGHTENED ancestor climb (stop at the app shell, stop when the candidate begins to contain shell controls / the Advanced-Style button, stop past ~2.2x the marker width) so the block lands in the panel column, not an oversized wrapper. Hides the native placeholder once attached.
- **Export-options → Layout subtab.** React-island source change (not a sidecar): `ExportOptionsCard` is now collapsible and **collapsed by default** (open state persists in `localStorage:antcv:exportOptionsOpen`; header shows an "N on" badge when collapsed). Its mount (`src/islands/ExportOptions/mount.tsx`) is gated on the new `isLayoutSubtab()` and anchored immediately ABOVE the "Open Advanced → Style" hand-off button via the new `findAdvancedStyleButton()` (both in `src/lib/settings-dom.ts`). Requires the rebuilt `antcv-react-islands.js` (shipped at `c475c4b`); source changes alone do nothing until that bundle is built + the bundle `?v=` is bumped.

### Verification checklist (run on live, desktop AND mobile)
- [ ] **Analysis panel (empty state):** shows the JD paste/upload + "Analyse JD" block instead of only "Generate a CV first to see the analysis." Block sits in the panel column (not an oversized wrapper). Console shows `[analysis-panel-jd-block-356] installed v1.40.358`. Run completes both /api/recheck-fit and /api/jd-analysis and renders in-panel.
- [ ] **Export-options in Layout subtab:** appears collapsed by default, immediately above the "Open Advanced → Style" button; caret expands/collapses; "N on" badge reflects active toggles. Both ATS-safe and Legacy-tier toggles work and PERSIST across Settings close/reopen (write to `personalInfo.exportPrefs`).
- [ ] **Export-options removed from Personal subtab** (no duplicate, no orphan).
- [ ] **VAL-001 / VF-016:** validation warnings render yellow, errors red, with distinct labels.
- [ ] **PB-005 / TB-003:** no user-facing "Compress" wording in help/legend/caption text; page-break control shows the semantic page glyph, never a down arrow.
- [ ] Confirm none of the above is Preview-only, wrong-item, or only-after-hard-refresh.

### Known follow-ups if verification fails
- `anchorForButton` (Export-options) climb is a heuristic (max 2 single-child wrappers). If the card lands in an odd spot, report the Advanced-Style button's parent structure and tighten.
- Empty-state panel selector: if the JD block attaches to an oversized container, report `window.AntcvAnalysisPanelJdBlock356._findPanel()` (className + width) and tighten `maxW`.
- **Relay CORS mismatch (unresolved):** access-relay returns `Access-Control-Allow-Origin: https://antcv.pages.dev`, but testing was done on `cv-generator-det.pages.dev`, which is CORS-blocked at `/config` ("no relay access"). Decide the canonical live domain first, then patch the allowed origin(s) in `workers/access-relay/src/index.js`. Do not patch before the domain is settled.
- `LayoutPicker/mount.tsx` comment is now stale (it still says "between WritingStylePicker and ExportOptionsCard"); its anchor falls back correctly so it is doc-drift only.

---

## OPEN (session-level, highest priority)

### CL-HEADER-001 — Cover-letter "Application: [Role] — [Company]" header not editable, wrong font/colour
- **Status:** OPEN — not yet touched.
- **Symptom:** The header line "Application: [Role] — [Company]" cannot be edited in the CL preview, and renders in the wrong font/colour versus the rest of the document.
- **Root cause (CONFIRMED 2026-06-04 via `antcv-cl-header-probe.js` watch):** Panel Role/Company edits DO reach storage — the probe logged `piRole` and `piCompany` changing on each panel keystroke, each firing `candidate-preview-editor-341` → `antcv-personality` forceRebuild. The break is the OTHER direction: the snapshot showed `visible sentence hosts (0)` and the `sentence` fingerprint never changed. So `personalInfo.role/company` update fine, but `candidate-preview-editor-341`'s `wrapApplicationSentence` never attaches an editable host (its anchor/block search returns nothing on the CL), so the visible "Application:" line is neither editable nor re-rendered from the updated personalInfo. The old "writes to a hidden anchor" theory is wrong — panel→storage works; storage→visible line is the gap.
- **Next:** capture the visible "Application:" line's DOM (why `findCandidateBlock`/anchor search misses it), then fix the attach in `candidate-preview-editor-341` so the sentence renders from `personalInfo.role/company` and is editable. Verify Preview + PDF + DOCX.
- **Fix direction:** Bridge panel Role/Company edits to the visible sentence spans (or make the visible sentence the single source of truth); correct font/colour to document tokens. Verify in Preview, PDF, and DOCX.
- **Diagnostic (next step):** `pwa/antcv-cl-header-probe.js` — read-only console probe (NOT loaded by index.html, never writes DOM/storage). Paste it into the live console on the CL Preview; it snapshots which `personalInfo` key holds role/company, the visible-sentence host text + computed style vs the name leaf, the hidden anchor, and the Settings-panel Role/Company field values, then `__clHeaderProbe.watch()` attributes a panel edit to a storage write and/or a re-render. Run reproduce → probe → targeted patch per CLAUDE.md; do not patch before the probe output identifies the key/render path.
- **Related QA-spec IDs:** CA-002 (Application sentence sync), CL-LAYOUT-002 (Application line width).

### APPHIST-ZIDX-001 — "Open in Settings →" opens Settings behind the preview
- **Status:** OPEN — needs live DOM evidence on fresh code before fixing.
- **Symptom:** From Application History, clicking "Open in Settings →" opens the Settings panel BEHIND the preview (z-index / stacking-context issue); user can't see/reach it.
- **Context:** app.js handler (v1.40.326) sets settingsTab + `window._antcvOpenSettingsRoute({tier:"standard",subtab:"apps"})`. Related sidecars: `antcv-app-history-zfix-291`, `antcv-app-history-back-to-preview-341`, `antcv-preview-shell-sticky-341`.
- **Fix direction:** Capture the stacking order live on current deployed code, then raise the Settings route above the preview shell (or lower the preview while Settings is foregrounded). Do not fix blind.
- **Diagnostic (next step):** `pwa/antcv-apphist-zindex-probe.js` — read-only console probe (NOT loaded by index.html, never writes DOM/storage). After clicking "Open in Settings →" so the mis-stacked panel is on screen, paste it into the console. It reports the chosen Settings panel + its full stacking-context chain (every ancestor that establishes a stacking context, with z-index), the preview-shell candidates and their chains, and — the ground truth — `paintOrderAtPanelCentre`: what `document.elementFromPoint` actually paints on top where the panel should be, and whether that topmost node is inside the preview or the panel. Distinct from `app-history-zfix-291` (which only raises the history dropdown above the slider). Run reproduce → probe → targeted patch.
- **Related QA-spec IDs:** AH-001 (Open in Settings foregrounds Application History).

### EXPORT-PAGE2-001 — Document-export preview: page 2 missing / no page breaks
- **Status:** OPEN — re-verify on fresh code.
- **Symptom:** Export preview shows only page 1 / page breaks not applied; page 2 content missing from the rendered preview.
- **Context:** Gate collects all `.antcv-preview-paper`; `antcv-pdf-page-mismatch.js` chips on count mismatch. Page-break sidecars: `antcv-page-breaks-everywhere-284`, `antcv-table-page-splits-327`, `antcv-sidebar-subsection-pagebreaks-329`. Watermark: `antcv-watermark-page-anchor-341`.
- **Fix direction:** Re-test on fresh deployed code. If still broken, determine whether the break is dropped in the preview render path or only in PDF/DOCX export; confirm against PB-001..006 gates.
- **Narrowed (2026-06-04):** the docx-worker page-break engine is healthy — `test/smoke-pagebreak.js` and `test/smoke-jd-questions-page2.js` pass 10/10 each, so the `.docx` export emits page 2 for the covered cases. That points the remaining defect at the CLIENT export-preview path: `antcv-pdf-preview-gate.js` builds `#antcv-pdf-preview-modal-iframe` and clones every `.antcv-preview-paper` into it (a v1.50.31 bug carried only page 1; v1.50.32 claims the fix). Preview page count = `[data-antcv-page-break="1"]` markers + 1.
- **Diagnostic (next step):** `pwa/antcv-export-page2-probe.js` — read-only console probe (NOT loaded by index.html, never writes DOM/storage). Open the export/PDF preview, paste it in. It compares the source `.antcv-preview-paper` papers + page-break markers against what the gate iframe actually carries (`paperCountSourceVsIframe`, `markerCountSourceVsIframe`), reports whether `break-before` is computed on the iframe markers, and flags any paper that overflows one page with no marker. That isolates whether page 2 is dropped in the clone, in the marker injection, or in the break CSS.
- **Related QA-spec IDs:** PB-001..006, WM-005.

---

## QA SPEC BACKLOG (merged from AntCV_UI_UX_Spec_and_QA_Plan_v4.docx)

Status legend: `[ ]` open · `[~]` partially addressed · `[x]` believed fixed (verify). Update as work lands.
Full ID list with severities: `docs/qa/AntCV_QA_backlog_index_v4.md`.

### Core rules / Definition of Done (GEN)
- **GEN-001..011** — [~] Preview/DOCX/PDF parity; control locality (a button acts only on its own item); standard control order = Page Break, CJLR, Enhance, Fit, Delete; "Compress" renamed "Fit" everywhere; edit persistence; no clipped/hidden controls; drag-drop parity; a11y labels; preview-utility responsive parity; warning = yellow, error = red; CL generation must capture table data.
- **Acceptance gate (DoD):** no fix accepted if it works in Preview but not DOCX/PDF; affects the wrong item; lands a drag-drop at the end when the indicator showed elsewhere; attaches the watermark to text flow instead of the page box; hides/clips controls; or only works after a hard refresh. Every fix verified in Preview + PDF + DOCX, desktop and mobile where relevant. Page Break icon must be a semantic page-change glyph, never a down arrow.

### Cover Letter (CL)
- **CL-001** — [ ] Remove duplicate Preview action-button overlay.
- **CL-002** — [ ] Make Closure directly editable + persist.
- **CL-003** — [ ] Model "How I Would Contribute" as Intro + per-bullet rows + Closing (closing never a bullet; +Add at end).
- **CL-004** — [ ] Attach one control group per Foundation textbox.
- **CL-005** — [ ] Normalize CL body controls + add section-move button. (Partially via `cl-body-move-button-341` ☰ Move — VERIFYING.)
- **CL-006** — [ ] Capture table data in CL generation.
- **CL-LAYOUT-002** — [ ] (High) Constrain Application line to usable page width in Preview/PDF/DOCX.

### Page Break (PB)
- **PB-001** — [ ] Manual break from main + sidebar updates state, page model, numbering, all outputs.
- **PB-002** — [ ] Break on first sub-subsection moves whole subsection to next page with original heading, no dup.
- **PB-003** — [ ] Non-first sub-subsection duplicates heading + localized "Cont." label 18pt from top.
- **PB-004** — [ ] Table: first row moves whole table; later row splits and repeats headers.
- **PB-005** — [~] Replace down-arrow icon and "Compress" text. (Semantic page glyph via `page-break-icon-357`; "Fit" wording via `help-text-wording-357`/`row-controls-wording-341` — VERIFYING this session.)
- **PB-006** — [ ] Keep Professional Experience CONT pattern.

### Watermark + Candidate (WM / CA)
- **WM-001** — [ ] Anchor watermark to last-page corner, page-level not text flow.
- **WM-002** — [ ] Avoid collision; lower corner by clearance.
- **WM-003** — [ ] Text-only, no border/fill/shadow.
- **WM-004** — [ ] CL watermark page-anchored.
- **WM-005** — [ ] PDF watermark last page only.
- **CA-001..005** — [ ] Candidate Preview editing; Application sentence sync (panel Role/Company vs rendered sentence, no dup label) [see CL-HEADER-001]; section-move on movable rows; insertion-point drag-drop; destination styling and Restore.

### Tables / Outcomes / Publications (TB / SO / PP)
- **TB-001** — [ ] Per-line CJLR on Core Competencies.
- **TB-002** — [ ] Page Break per row per PB-004.
- **TB-003** — [~] Fix "What I Bring" help text; no "Compress" or down arrow. (Help-text wording via `help-text-wording-357` — VERIFYING this session.)
- **SO-001** — [ ] Add Page Break, CJLR, Enhance, Fit before Delete on each Selected Outcome row.
- **SO-002** — [ ] New rows identical.
- **PP-001** — [ ] Expose hidden Publications controls in row layout.
- **PP-002** — [ ] Single input acts on whole entry.
- **PP-003** — [~] HIGH-RISK; shared row-control model only; buttons row-anchored and stable in generation. (Stale injected Enhance/Fit buttons addressed by `pub-injected-reaper-352` — VERIFYING.)

### Preview shell + validation (PRV / AH / VAL)
- **PRV-001** — [ ] Restore 3 desktop lower-right Preview utility buttons.
- **PRV-002** — [ ] Restore Privacy and Fuse CL-CV desktop placement, no hidden dups.
- **PRV-003** — [ ] PDF and DOCX buttons persistent in top Preview area, route-independent.
- **PRV-004** — [ ] Loading status not click-dismissable while a job runs.
- **PRV-005** — [ ] Circular buttons viewport-specific; mobile bottom-right kept. (Mobile FAB cleanup via `mobile-fab-cleanup-351` — VERIFYING.)
- **AH-001** — [ ] "Open in Settings" foregrounds Application History [see APPHIST-ZIDX-001].
- **VAL-001** — [~] Errors red, warnings yellow, distinct labels. (Token sidecar `validation-severity-341` + consumer `validation-severity-consumer-357` that stamps the rendered Set-menu nodes — VERIFYING this session. Overlaps GEN-011 / VF-016.)

### Onboarding / generation / layout / export / responsive (third + fourth pass)
- **LANG-001** — [ ] (Med) Settings vs top-bar language mismatch (Chinese ticked, not in bar); fallback EN+DA, wizard is source of truth.
- **IMPORT-001** — [~] (High) Import reports 0 work entries despite valid JSON; map experience/education/certifications/publicationsStructured lengths. Shipped fixes: `antcv-upload-recount-339.js` (dual-key normalise + toast recount) and the importer's experience→sections.cv bridge. The contract is now codified + regression-covered in `pwa/lib/import-normalize.js` + `pwa/test/unit/import-normalize.test.mjs` (18 tests, incl. a static drift guard over both sidecars and the Anita persona as fixture). Live verification of the in-app import still owed; adopting the shared module inside the sidecars is a follow-up (touches loaded scripts → needs browser verification).
- **ONBOARD-001** — [ ] (High) Step 3B writing-register list not scrollable on mobile; Next unreachable (dvh, sticky footer).
- **GEN-001b** — [ ] (High, §14.2) Kernel generation leaves major CV sections empty/underfilled; add unsolicited fallback + warnings.
- **GEN-002b** — [ ] (High, §14.2) CL generation drops What I Bring table signals + Why This Position bullets.
- **GEN-UI-001** — [ ] (Med) Redundant Enhance/Fit buttons under generation Cancel action.
- **GEN-UI-002** — [ ] (Med) Generation time estimate too optimistic; almost-done shown too early (use ~4 min default).
- **GEN-UI-003** — [ ] (High) Repeated/endless Fit controls under "Cancel & return to editor"; hard rendering guard when generation view active.
- **LAYOUT-001** — [ ] (High) Sidebar background does not extend to page bottom in Preview/PDF/DOCX.
- **EXPORT-001** — [ ] (Med) Missing download-start indicator for PDF/DOCX export.
- **EXPORT-002** — [ ] (Critical) PDF export fails; needs visible recovery + retry, must not corrupt current doc.
- **RESPONSIVE-001** — [ ] (High) Mobile Preview loads desktop split-pane layout; Section/Analysis/Preview must be mobile bottom modes.
- **PDF-LAYOUT-001** — [ ] (High) PDF page 2 shows stray Selected Outcomes heading before Professional Experience continuation.

---

## VERIFYING (shipped, confirm on fresh code)

- **export-options → Layout subtab (islands `c475c4b`)** — moved from Personal; collapsible, collapsed by default, above the Advanced-Style button. See SESSION LANDED checklist. (Export-options relocation.)
- **analysis-panel-jd-block-356 → v1.40.358** — clean rewrite; attaches to the empty-state panel + tightened ancestor selection; index.html tag + loader registered. See SESSION LANDED checklist. (Analysis panel empty-state usability.)
- **validation-severity-consumer-357** — stamps Set-menu validation nodes by severity (VAL-001 / VF-016). See SESSION LANDED checklist.
- **help-text-wording-357** — "Compress" → "Fit" on non-button help/legend/caption nodes (PB-005 / TB-003).
- **page-break-icon-357** — down-arrow → semantic page glyph U+2398 on identified page-break controls (PB-005 / GEN-003).
- **357-loader** — runtime registrar for the four sidecars above; skips any already present via a direct index.html tag.
- **section-panel-211 v1.40.350** — endless Publications mini-button flicker / re-injection. Idempotent attribute writes + observer guard + attribute-first classification.
- **pub-injected-reaper-352** — removes the two stale `data-antcv-pub-injected` Enhance/Fit buttons wherever they appear. (PP-003)
- **mobile-fab-cleanup-351** — hides mobile JD/Fusion FABs; relocates mobile Privacy into the top bar as a compact higher-contrast pill. (PRV-005)
- **cl-body-move-button-341 v1.40.350** — ☰ Move button mounts on CL body rows (`data-antcv-align-sid` selector fix). (CL-005)
- **personal-info-anti-thinning-353 → v1.40.354** — blocks load-time near-total wipe of local personalInfo; narrowed so it never touches generation/editing writes.
- **cloud-put-shrink-guard-355** — compares a thin /api/prefs PUT against a fresh cloud GET; blocks a large shrink. (Committed; wiring/verification pending.)

---

## NOTES / DEPENDENCIES

- Deployed app.js does NOT yet render `recruiter` / `red_flags` from `rationale`. The 356 block renders those in-panel itself (Option A). Native panel render of those fields needs an app.js push (manual; minified bundle).
- React-island changes (e.g. the Export-options move) require a Vite rebuild of `pwa/antcv-react-islands.js` and a bundle `?v=` bump — source edits alone never reach the live site. Last islands rebuild: `c475c4b`.
- Housekeeping (raised to MEDIUM): prune stale `.claude/worktrees/*`. These caused repeated git trouble this session — `main` advancing under local work, a recurring merge conflict on `antcv-analysis-panel-jd-block-356.js`, and an accidental push of `fix/validation-severity` (283 unpushed commits) from inside a worktree. Remove the ones not actively used before the next work session; confirm none is running an automated agent that pushes to `main`.
- The QA-spec IDs above are summarized from `AntCV_UI_UX_Spec_and_QA_Plan_v4.docx`; consult that doc for full per-ID prose, screenshots, and acceptance detail. The retrievable ID index is `docs/qa/AntCV_QA_backlog_index_v4.md`.

### LOOP-DAMPER REVERTED + HIWC focus-restore (1.50.89)
- **Owner test result:** disabling the loop damper (`localStorage.antcvDisableLoopDamper=1`) STOPPED the WIB/Experience/Core-Competencies control multiplying → the global `MutationObserver` wrap (1.50.85) regressed those per-row injectors' self-cleanup. **Reverted:** removed the `antcv-loop-damper.js` script tag from index.html (file kept in repo, not loaded). Loop now handled only by the targeted per-sidecar idempotency fixes (rounds 1-7), which were safe + converging.
- **HIWC still hard to type (damper OFF too):** the app re-renders the HIWC section and re-creates the bullet input, dropping the caret. Added focus preservation to `how-contribute-controls-245`: track the last-focused bullet index + caret (`noteHiwcFocus` on focus/keyup/click/input), and after the editor is rebuilt restore focus + caret to the same input (`restoreHiwcFocus`, sync + setTimeout(0)). Combined with the 600ms debounce (1.50.86) + edit-safety guard (1.50.87), typing should be uninterrupted. `?v=1.50.89-focus`, sw → `antcv-1.50.89`, TARGET → 1.50.89 (1.50.88 → STALE).
- **Net for release:** privacy blip fixed at source (CSS), HIWC double-bullets gone (app owns bullets), empty template preserved, panel/align attribute storms idempotent, and the multiplying regression removed. Remaining loop rAF is back (damper gone) but is far lower than the original after rounds 1-7; the visible user bugs (blip, multiply, double bullets) are resolved.

### DOCX-EXPORT-REGRESSION-001 — hardened the preview-modal export (1.50.90)
- Root: the preview/print-setup modal's "Save as DOCX" only did `document.querySelector('button[title^="Export as .docx"]').click()` and, if that app button wasn't reachable in the current view, alerted "isn't ready" and nothing downloaded (commit 0eaee37 added it; it was the single export surface per 1.50.49).
- Fix (`antcv-pdf-preview-gate.js` 1.50.90): `triggerDocxExport()` now (1) finds the app DOCX button via several selectors (title prefix/contains + text/Word match) and clicks it; (2) if it truly can't be found, calls `window.exportDocxViaWorker` DIRECTLY with a payload rebuilt from localStorage (sections/meta/doc/personalInfo/photo/styleConfig/fontSizes/language/navyColor) — the same worker path the app uses; (3) logs which path it took (`[pdf-preview-gate] DOCX: …`) so the failure mode is visible if it still fails. `?v=1.50.90-docx`, sw → `antcv-1.50.90`, TARGET → 1.50.90 (1.50.89 → STALE).
- Verify: open preview → export → Save as DOCX → file downloads. If not, the console line says whether it delegated, called the worker, or the worker URL is missing (Settings → Account).

### Remaining QA-pass items (registered, post-DOCX)
- CORE-COMP / WIB tables: 2 redundant page-break buttons per row; textarea/cell sizes too small; pressing the page button only flickers it (doesn't advance the row to the next page). Owners: table-row-page-controls-328 / core/wib row-control sidecars + page-cascade store.
- HIWC still reported not-editable + no preview template on 1.50.89 for the owner — recheck after the table/loop work; if persistent, the app re-render rate is still high enough to defeat the focus-restore (needs the editor's own rebuild gated harder).
