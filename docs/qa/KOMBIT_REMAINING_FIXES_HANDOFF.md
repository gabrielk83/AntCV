# KOMBIT application + AntCV panel controls — remaining-fixes handoff (2026-07-07)

Paste the "PROMPT" block below into a fresh session to finish everything. Canonical
backlog = `docs/qa/OPEN_REGISTER.md` rows **53–60**. Read `CLAUDE.md` first
(app.js discipline, sync-first, cache-bust, PWA auto-deploys from main).

## Current state
- **CV** = `~/Downloads/CV_Gabriel_Alexander_Karp_Gershon_KOMBIT_AI-udvikler_20260706_DA_redhvid_v7.docx`
- **CL** = `~/Downloads/CoverLetter_..._KOMBIT_AI-udvikler_20260706_DA_redhvid_v6.docx`
- Both are **corruption-free** (namespace/`mc:Ignorable` fix, row 59B) — verify any new hand-edit with a **strict `lxml.etree.fromstring` parse** before shipping.
- v7: sidebar forced to fixed **2.4"** both pages; AI-notice at sidebar bottom; KERNEKOMP + Innoviz-bullet compressed.

## What's left (all in the register)
- **CV line-fill / orphan ENHANCE** — needs a renderer (rows 57/59C). ~15 owner-green-marked lines end too short and must be enriched to the right margin. Innoviz *title* still needs −2 (multi-run). Confirm sidebar 2.4" both pages renders.
- **Mobile** (row 58, MOB-001…009) — MOB-006 "can't switch language on mobile" **still broken** (owner re-confirmed); MOB-008 analysis-scroll + MOB-009 CV-PDF-split are **CRITICAL**; MOB-001 Danish-UI-English-content.
- **Panel controls** (row 60) — rule-line for spec/contact; CL slogan/signature/sign-off align+eye writing the wrong keys; per-line hide for closing+sign-off name; signature width **in the panel AND settings** + a separate signature **colour** control; button colour/contrast.

---

## PROMPT (paste into a new session)

Finish Gabriel's KOMBIT "AI-udvikler" application and the AntCV panel-control fixes.
Read `CLAUDE.md` and `docs/qa/OPEN_REGISTER.md` rows 53–60 first; `git fetch origin && git pull --rebase origin main` before editing; never force-push; PWA auto-deploys from main so verify before pushing app changes.

Global rules (rows 54–59, memory targeted-jd-kernel-recall-and-furniture): output uses ONLY "-" (never em/en dash); BOLD-RED is only for labels/headings, content runs stay regular dark 262626; interests joke works by reveal; on any hand-edited .docx, rebuild on the pristine original root + guarantee every body namespace prefix is declared, then **verify with a strict lxml parse** (row 59B); one-sentence bullets; one-line results that state the mechanism; no trailing "," / "." in table cells; consistent sidebar width; fill page-1 before overflow.

1. **CV LINE-FILL (blocker: no renderer here).** Install LibreOffice `soffice`, convert the CV docx→pdf, and MEASURE real line breaks (the whole v1→v7 orphan pain was blind guessing). On `~/Downloads/CV_..._KOMBIT_AI-udvikler_20260706_DA_redhvid_v7.docx`, ENRICH each owner-green-marked line so its last line reaches the right margin: the Kanzen AntCV bullet; the Innoviz result; the Sirin ODM bullet; the Meprolight 2nd bullet + result; the TAU bullet + result; the IDF role line + both bullets + result; the Pan role line + 2nd bullet + result; and the two KERNEKOMP cells ("AI use cases til drift…", "Krav, sporbarhed, CCB…"). Also: Innoviz title −2 chars (it's split across runs); confirm the sidebar renders 2.4" on BOTH pages and both columns bottom out together. Deliver a v8 that passes strict lxml.

2. **MOBILE (row 58).** Diagnostic-first on the real device (scripts/phone-qa.mjs). Fix MOB-008 (Analysis panel won't scroll once an application is detected — ties row 51), MOB-009 (exported CV PDF badly split), MOB-006 (tapping the language area doesn't open the translation panel — owner: STILL can't switch language on mobile), MOB-001 (Danish UI shows English content). Reproduce → probe → targeted patch; cache-bust per CLAUDE.md.

3. **PANEL CONTROLS (row 60).** Boot `scripts/browser-qa.mjs` (Playwright is available; it seeds localStorage from docs/personas then reloads) and capture live DOM. Then: (a) make the "Rule line below" row mount in the Specialization/Application + Contact detailed editors (antcv-header-rule-control.js:90 detection only matches "Full name"); (b/c) the CL slogan/signature/sign-off preview CJLR + eye currently write `antcvItemAlignment` / `items[i].on` (antcv-item-align.js) which the CL special-element render never reads — rewire them to write the keys the render DOES read: `clSloganAlign`/`clSloganHidden`/`signatureAlign`/`signatureHidden`/`clClosingAlign`/`clSignNameAlign` (render sites: app.src.js:27688-27730, 44356-44514; antcv-docx-client.js:765-851); (d) add `antcv:clClosingHidden` + `antcv:clSignNameHidden` and read them at all 3 render sites (currently no hide for closing/sign-off name); (e) match the CL panel buttons to the other panel buttons' colour + raise label contrast; (f) put a signature WIDTH slider inside the preview panel (contained, no overflow) AND keep it in Settings, plus a separate signature COLOUR control (`antcv:signatureColor`) applied in `window.__antcvClSigEl` (preview) and the docx export. Verify each in the harness before any push; cache-bust (index.html ?v=, sw.js CACHE, antcv-version-override.js) per CLAUDE.md.

Report against rows 53–60; update the register + memory with anything new.
