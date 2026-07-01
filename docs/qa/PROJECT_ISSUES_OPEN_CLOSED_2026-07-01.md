# AntCV — Open / Closed issues — 2026-07-01 (interactive corrections session)

State at end of session: **PWA 1.51.40** · **docx-worker 1.14.114** · access-relay 1.3.2 · suite 587/587.
This session ran interactively against the owner's LIVE signed-in app (Chrome MCP) + worker diagnostics.

---

## CLOSED this session (shipped + verified)

| ID | Fix | Version | Verified by |
|----|-----|---------|-------------|
| CV-CORECOMP-BLANK-001 | Snapshot/restore guard sidecar for the core_comp table | 1.51.28 | node-sim |
| CV-CORECOMP partial+dup | Row-level clean: drop placeholder rows + EXACT-DUPLICATE rows ("Optics, photonics &" ×2); snapshot clean-only | 1.51.30 / 1.51.36 | node-sim (9 tests) |
| CL-BLANK-001 | `proseOf` body-only (empty-body-but-labelled no longer masks); SYNC snapshot on sections-updated captures prose before the stale-restore clobber | 1.51.28 / 1.51.31 | node-sim; owner confirmed CL preview no longer empty |
| CV-ACCESS-DROP-001 | `repairAccessibilityFromPI` CREATES the section when absent; text→labeled_list so the PREVIEW renders it (was type:text, invisible in preview) | 1.51.28 / 1.51.32 | node-sim + live DOM |
| EXPERIENCE-EMPTY-SLOT-HIDE-001 | Hide fully-empty `[Role title]` slots (on:false) | 1.51.32 | node-sim (5 tests) |
| CONTRIBUTE-RICHBLOCK-EXPORT-001 | HWIC missing in PDF: the legacy merge ran rich_block OBJECT items through `String()` → "[object Object]" and blanked them; skip the merge for object items | 1.51.32 | node-sim + live (confirmed contribute populated) |
| WORK-STYLE-REPAIR-001 + ORPHAN-134 | Fill empty work_style body from `personalInfo.work_style` + cap the line under 134 chars | 1.51.36 / 1.51.40 | node-sim (6 tests) |
| CL-BOTTOM-RULE-MATCH-002 | Closure rule now byte-identical to the rich_block headlineRule (bottom, navy, sz8) | wk 1.14.113 | `diag-cl-rules.mjs` |
| SIGNATURE-PAD-002 | Signature clip: upload rebuilds ink on a larger canvas w/ wide bottom margin (root: 4px crop + edge-flush ink, NOT a circular clip) | 1.51.33 | live pixel analysis |
| SIGNATURE-THUMB-ADAPT-001 | Settings thumbnail: transparent bg + light-flip ink on the dark panel | 1.51.34 | node-sim (4 tests) |
| AI-NOTICE-POSITION-CONTROL-001 | Layout control (Auto / bottom L/C/R); forwarded + honored in preview + worker (incl. 'center') | 1.51.35 / wk 1.14.114 | `diag-ai-notice-pos.mjs` (manual overrides auto) |
| WM-CONTRAST-002 | AI-notice preview colour by ACTUAL sidebar luminance (was assumed-navy → white-on-pale illegible) | 1.51.37 | live DOM |
| AI-NOTICE-AUTO-SIDEBAR-001 | AUTO defaults to the sidebar (emptier column); old block-count counted blocks-not-height → pushed to the dense main column | wk 1.14.115 | `diag-ai-notice-pos.mjs` |
| PREVIEW-HYPERLINK-STYLE-002 | Markdown/URLs → styled links in preview; colour by background (white on navy header, teal on light); killed the LinkedIn blink (v001 fought React) | 1.51.38 / 1.51.39 | LIVE (white on header, idempotent 2nd pass, 0 errors) + 5 tests |
| Blank-section "dancing" | (from prior batches) — **owner confirmed FIXED** | — | owner |

**Verified-correct, needs a fresh export (not code):**
- **AI-notice export stayed right** — worker + client chain verified (`diag-ai-notice-pos` passes incl. override of `ai_wm_side:'right'`; deployed client v1.51.35 forwards `ai_notice_pos`; `antcv:aiNoticePos='left'`). The stale export was **pre-deploy or the browser-print fallback**. Re-export server-PDF on 1.51.40 with Left set → lands left.
- **CL "only lower rule visible"** — the rules MATCH when `why` is real; the missing upper rule is because `why` is currently a **placeholder** (body drops). Resolves once the CL generates non-blank (see overlay timing).

---

## OPEN (carry forward — in priority order)

1. **GENERATION-OVERLAY-TIMING (ROOT of blank content).** The "purple-black" generation overlay closes BEFORE generation + JD analysis finish, so the owner sees blank why/who/bring and exports a semi-empty CL/CV. Owner: "keep it on ≥4 more minutes… generation does not end before the JD analysis is ready… 1st-time generation seems stuck on this stage." FIX: keep the overlay up until JD-analysis + lamination complete (app.js generation flow). This is the upstream cause of: CL semi-empty (why/who/bring placeholders), CL "only lower rule", and the completeness warning ("2 key sections need content"). NOT headlessly reproducible — needs one real regen to verify.

2. **ROLE-DEDUP + ORDERING.** EXPERIENCE shows DUPLICATE roles from company-spelling variants: Computer Systems Administrator ("IDF, Communication Corps" vs "Israel Defense Forces, Communication Corps"), Students Council Representative ("Tel Aviv University" vs "…- Electrical Engineering"), Team Operations Manager ("(foreningsarbejde), Pan Idræt" vs "& Assistant Coach (Volunteer), Copenhagen Wolves RFC - Pan Idræt"). Plus **3 empty roles jump in/out** right after the PROFESSIONAL EXPERIENCE heading. `antcv-sections-normalize-415.js` `dedupeRoles` only merges IDENTICAL titles + overlapping years — it must merge SAME-title / same-year-range roles whose companies are spelling variants (normalise company: expand acronyms / strip trailing qualifiers), keep the richer bullet set. **Students Council is VOLUNTARY → must sort LAST** (voluntary/foreningsarbejde roles after paid history). The empty-role jump is likely the empty-slot-hide (1.51.32) fighting another injector on the storm — stabilise (idempotent + no re-add).

3. **COVER LETTER open issues (do after 1+2).** Once the overlay/convergence lands: verify who/why/bring/contribute/closure all fill on ONE generation; confirm both CL rules render+match on a real export; CL signature intact; recruiter-Q&A page (if JD has questions). Most CL blanks are downstream of the overlay timing.

4. **Focus-area label (generation/kernel).** "Optics, photonics &" (truncated) → owner wants Focus Area **"EO & Photonic devices"**, Strategic Expertise **"Electro-optics (EO), photonics, semiconductor physics"**. This is LLM-GENERATED (no source string) — fix in the generation prompt / Gabriel kernel seed (regen-gated). Owner already inline-edited the live data.

5. **AI-notice AUTO — FIXED wk 1.14.115** (was: pushed RIGHT almost always). Auto now defaults to the sidebar side (the emptier column on a typical CV); the block-count proxy is removed. Re-export to confirm; manual L/C/R overrides the rare sidebar-is-fuller CV. _(original note:)_ Auto used a crude last-page BLOCK-COUNT proxy. The worker uses a crude last-page BLOCK-COUNT proxy (`__lastSideN < __lastMainN`), preferring the forwarded preview hint only on a tie. **What's needed from the owner:** the specific CV (its `localStorage.sections` + which side auto chose vs which column is actually emptier on the last page) so the block-count-vs-preview-measured-gap disagreement can be traced and fixed correctly. Manual L/C/R is the reliable override meanwhile.

6. **d1_write_failed (backend).** Server-side D1 write failure from access-relay `user_kernel`/prefs sync (`env.DB…run()`), surfaced to the client (not a PWA logic bug; the string isn't in app.js/app.src.js). Fired once during rapid tapping → likely transient write contention. FIX: client retry-with-backoff on the kernel/prefs PUT (careful: fetch-wrapper hazard) + confirm root via D1/wrangler logs. Low urgency unless it blocks saves.

---

## Session mechanics
Shipped 1.51.28→1.51.40 (PWA auto-deploy on push) + worker 1.14.113/114 (gh deploy.yml). Suite 587/587,
boot-smoke green after every push. New worker diags: `diag-ai-notice-pos.mjs`, `diag-cl-rules.mjs`.
