# Session log — 2026-07-29 · CL load-hydration, empty-opening, app-2810, Terma build-guide

Owner-driven live-debugging session on the deployed AntCV app + relay. All findings below are from the running app (antcv.pages.dev) + the access-relay, not guesses.

## 1. CL load-hydration bug — "sections not saved / regenerate over and over" — FIXED (load side)
**Symptom:** a saved CL opened with placeholder greeting ("Dear [Hiring Team / Name]") + empty opening ("(click to add)"), so the owner kept regenerating.
**Reality:** the SAVE was always fine — a 56-app relay audit found **55/56 complete**; only app 2729 (Aimpoint AB, Optical Engineer) is genuinely incomplete. The *load* was dropping greeting+opening.
**Root cause:** `pwa/app.src.js` Open / Read-from-Cloud sites (two) set `lo({ greeting:(io&&io.greeting), opening:(io&&io.opening) })` — from the STALE current `io`, not from the loaded app `e`. Company/role loaded from `e`; greeting/opening didn't.
**Fixes (shipped):**
- `UNSOL-CL-LOAD-HYDRATE-001` (1.51.3962) — read greeting from `e.cl_sections[greeting].content` and opening from `e.cl_sections[opening].content||items[0].t`, fall back to `io`. Both load sites + minified app.js mirror. **Verified live:** greeting now shows "Dear Hiring Team," on load.
- `CL-OPENING-SEED-985` (1.51.3983) — the opening (rich_block) renders from its section items (not the meta), which a `me()`-enforce step reverts to the template placeholder on load; the prose-loss guard (`antcv-cl-prose-loss-guard-985.js`) had **no local snapshot on a fresh cloud load**. Fix: seed `antcv:clProseGuard[company|role|lang]` from the loaded `cl_sections` (opening/why/who/foundation/contribute/closure/bring, real prose only) so the guard re-applies them.

## 2. Empty opening at GENERATION — NOT fixed (owed, gen-flow)
Distinct from #1. The CL skeleton opening (app.src.js:4634) is a rich_block with a bracketed instruction item. When generation's opening is rejected as placeholder-like (prose guard bracket-LED detection) or the LLM omits the slot, it's cleared to empty, and with no prior real opening it stays blank. The load fixes preserve a *real* opening but don't make generation produce one. **Fix owed in the proxy/writing-engine: guarantee the opening slot is generated (or fall back to a real opener) and never persisted empty.** (Register: UNSOL-GEN-DEFECTS pt "CL opening empty".)

## 3. App 2810 (Terma, Advanced Systems Engineer) — opening + greeting fixed via relay
Opening was genuinely empty in the save. Set opening to Erika's cockpit-MBSE framing (per build guide) + greeting → "Dear Erika," (hiring-manager name). PUT to relay, verified. Full build-guide alignment = §6 below (in progress / owed).

## 4. Other defects surfaced live (registered: UNSOL-GEN-DEFECTS + UNSOL-APP-DEFECTS 2026-07-29)
- Generator (render-dependent, app-side): 5-page over-split (18 body tables), 3-line Strategic-Expertise cells (should be 1), 9-line profile (cap ≤7), gap before profile, page-1 cramming, banner figure+text NOT inside the Word header (in body → shifts), contact "Copenhagen S" should be "København S".
- App-side: `Fuse` "no response" = native `confirm()` **suppressed in the embedded Browser pane** (works in real Chrome; app should use its own modal). `✏ apply to docs` script error — **already fixed by a parallel session (GAP-APPLY-RICHBLOCK-001, 1.51.3942)**. Brand-fit colours too bright / ≠ real Terma site — brand-sampler (`[export-header-colors]`). CL missing slogan — app not forwarding `meta.cl_slogan` (worker already resolves it, CL-SLOGAN-META-FIELD-001).
- JD-list edit position/company — spawned as its own session (fix B).

## 5. Content defaults (memory `gabriel-cv-output-defaults`)
Merged role = "Electro-Optics Engineer & Team Leader" (Engineer first, no R&D); never name the ODM ("an ODM in Sweden"); accessibility "Hearing impaired" no "(cochlear implant)"; 6-item interests default (incl. cats); default visual = figure header-left + rounded boxes (navy-executive / photoPosition header-left); unsolicited spec = Process · Products · People.

## 6. Terma build-guide alignment for 2810 (`Terma_..._Build_Guide (1).pdf`) — (a) in progress
Hiring contact: **Erika** (cockpit-related MBSE, research-mindset). Instructions:
- CL: open with Erika's cockpit-MBSE framing [DONE]; position academic-research + industrial-architecture as the differentiator; address the formal-MBSE gap positively ("architecture work included requirements, traceability, functional interactions, quantitative analysis, structured technical models; formal MBSE is the next development step"); mirror 6-month (active learning, contribute to models/requirements, spot reusable concepts) + 12-month (proactive knowledge-sharing, innovation ambassador); close on curiosity + making new knowledge reusable. One page.
- CV: architecture + research focus, governance SECONDARY; **separate Innoviz System Architect from Change Request Lead**; add a visible **Research & Innovation** section (CNT→MEMS/NEMS, method + publications) high on p1/early p2; Sirin = integrated camera/display/biometric architecture + patented crosstalk; Meprolight = multispectral sensing/system trade-offs/field behaviour; tools prioritise Enterprise Architect/Python/MATLAB/LabVIEW/Codebeamer + requirements/traceability; SysML only if used, else "developing"; de-emphasise supplier-qualification/compliance/production-handover/image-quality. Remove photo + age. **Terma only** (remove DFDS/Teledyne/unrelated validation wording). Two pages. Submit immediately (interviews underway).

## Deliverables produced this session (Downloads)
KOMBIT CV+CL (gold, hand-built), PM-EN unsolicited CV (interim, hand-corrected). Render env note: Word COM wedged mid-session; local LibreOffice over-paginates every CV (metrics mismatch with the pre-paginated worker layout) — use the app's CloudConvert export.
