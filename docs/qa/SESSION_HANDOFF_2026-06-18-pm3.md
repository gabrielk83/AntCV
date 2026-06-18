# AntCV handoff — 2026-06-18 (PM3). Authoritative current state + next-session prompt.

Shipped `1.50.640 → 1.50.652` this session. All PWA changes are sidecar / island /
prompt / CSS, EXCEPT the surgical `app.js` mirrors (640-648, 651) which were each
`node --check` + `node pwa/test/boot-smoke.mjs` verified. One deployer at a time.

Cache-bust QUARTET on every release: the changed file's `?v=` in `index.html` +
`CACHE` in `sw.js` + `TARGET_VERSION` in `antcv-version-override.js` (+ add the
PREVIOUS version to `STALE_VERSIONS`, NEVER the current). `app.js` edits are
surgical-in-place, mirrored to `app.src.js`; `npm run build:app` is BANNED
(blue-screens). After any `app.js` edit run boot-smoke.

---

## CLOSED this session (verified)

- **SELECT-DARK-DROPDOWN-001** `[640]` — `color-scheme:light` on form controls; native `<select>` dropdown no longer a black box on Windows dark mode.
- **GPA-EDITOR-001 / GPA-CHIP-LINE-001** `[641, 643]` — education editor GPA input + 👁/🙈 `showGpa` toggle; GPA renders on its OWN line after the degree content line (owner-corrected position).
- **DASH-HYPHEN-001 (prompt half)** `[642]` — global PUNCTUATION-DASHES prompt rule: model emits only `-`, never `—`/`–`. (Content sidecar `antcv-emdash-to-hyphen.js` from 636 handles the stored blob.)
- **TOOLS-METHODS-FIXIT-LOOP-001 + FIXIT-DESYNC-001** `[644]` — Fix-It on Tools & Methods. (1) `Pe()` wrote to an undefined `items` instead of local `n` (app.src.js ~9853 labeled_list_item, ~9866 education_item) → compress no-op → orphan-retry spun. (2) whole-section `labeled_list` apply skipped only groups while the build excluded group+hidden → hidden items shifted every value (the mangling). Apply now skips group OR hidden.
- **WHO-I-AM-LABEL-DUP-001** `[645]` — `antcv-heading-label-dedup.js` strips a leading `<TITLE>:` from `type:"text"` sections (own-title match → language-agnostic; bold either side of the colon; skips `text_inline`; never blanks).
- **PUBLICATIONS-DUP-001** `[646]` — `antcv-publications-dedup.js` removes textually-identical entries (normalised: strip HTML, collapse whitespace, lowercase → `<b>`-wrapped vs plain collapse) from `personalInfo.publications`/`publicationsStructured` + the sections publications items. Distinct year/title survives.
- **PHOTO-SHAPE-SQUARE-001** `[647]` — selector wrote only top-level `photoShape`; the React render reads `stylePrefs.photoShape`. `antcv-photo-ui-427.js writePhotoShape` now writes BOTH + dispatches `antcv:sections-updated` for an immediate repaint.
- **PROFILE-REWRITE-001** `[648 — regen-gated]` — swapped the canonical unsolicited PROFILE (app.src.js ~2783) for the owner's text.
- **ADDITIONAL-EXPLODE-001** `[649]` — `antcv-sections-normalize-415.js explodeAdditionalToSections` splits ADDITIONAL INFORMATION into separate LANGUAGES / INTERESTS / ACCESSIBILITY sidebar sections by default (idempotent; preserves an existing split; Other items stay in a trimmed ADDITIONAL).
- **BANNER-ENDS-EARLY-002** `[650]` — `antcv-showcase-banner-persist.js genActive()` now also treats `step="generating"` as in-progress so the purple banner spans the whole generation, not just the kernel commit; quiesce 6s, cap 180s.
- **ORPHAN-PRETTY-001 (preview)** `[652]` — `text-wrap:pretty` on `.antcv-preview-paper` so the browser avoids single-word last lines. Preview only.

---

## OPEN (next session) — ordered

1. **TABLES-DISTINCT — verify after regen** `[651 strengthened the prompt]`. Owner's screenshots showed CORE COMPETENCIES repeating WHAT I BRING Focus Areas + Nordic cells wrapping 2-3 lines; the rule (app.src.js ~2758) now forces a side-by-side zero-overlap check + hard cell caps (WHAT I BRING ~48 chars/1 line, CORE ~28/half line, Nordic never wraps). **If it STILL repeats after a regen:** add a deterministic post-pass sidecar that, when `bring` and `core_comp` share a normalised Focus Area, drops the duplicate CORE row ONLY if `core_comp` keeps ≥2 distinct rows (else leave it — a sparse table is worse). Tables are `bring` + `core_comp`, type `table`, rows[0]=header, rows[1+]=[focus,expertise].

2. **EXPORT orphans (NBSP)** — `text-wrap:pretty` (652) fixes only the preview; the CloudConvert/LibreOffice PDF ignores it. Add an NBSP-binding pass on the content sent to the worker (`antcv-docx-client.js`) or worker-side: bind the last 1-2 short words of each bullet / table cell with ` ` so a single word never orphans. Only the manual `fix_orphans` LLM task exists today (app.src.js ~18227, ~17982 "Make it fit"). Keep it idempotent (don't double-bind).

3. **EMDASH render-separator half** — the literal `" — "` separators between data fields (the content sidecar + prompt already hyphenate generated CONTENT). Pure-display ones are safe one-way swaps, but several READ BACK on `" — "` and must convert atomically with a round-trip test:
   - saved-application label pair — writers app.src.js ~37410 / ~43722 / ~43753 / ~40120 (`jd_company — jd_role`) ↔ readers ~21943 / ~21963 / ~21984 / ~22824 (`.split(" — ")`). Converting in isolation breaks STORED saved-applications.
   - CL combined-header editor pair ~6448 (`.join(" — ")`) ↔ ~6449.
   - deg—sch enrichment strip ~17835 (writer) ↔ ~18120 / ~44560 (`.replace(deg + " — ", "")`).
   - safe display-only: education deg—sch ~2637 / ~12040 / ~12055 / export HTML ~25726; role—company headers ~11149 / ~11235 / ~11238 / ~11994 / ~27032 / ~25795 / ~41178; title sep ~6098. (Line numbers drift — re-grep `'join(" — ")'` etc. first.) See `emdash-hyphen-three-layers` memory.

4. **SPEC-LINE-GONE-001 — verify after regen.** The prompt ALREADY pins Gabriel's "Processes • Products • People" for unsolicited (app.src.js ~2732, name-guarded). If the line is still missing after a regen, the cause is the subtitle render having NO fallback: `t.subtitle || ""` at app.src.js ~11147 / ~11233 / ~11236 — add a fallback to `personalInfo.specialization` when `meta.subtitle` is empty (3 sites + app.js mirror).

5. **Nordic tight cells — verify after regen** (folded into 651). If cells still wrap, the lever beyond the prompt is the per-cell compress ("Fit") or a deterministic char-cap (risky — can truncate; prefer compress).

6. **SUBSECTION-GAP-60 + FIGURE-GAP-DECOUPLE-001** (owner 2026-06-18) — two parts:
   - **Allow up to 60pt subsection gap.** The three subsection-gap sliders are capped at max 30 (app.src.js ~13191-13193: `["mainSectionGap", "CV main · subsection gap", 0, 30, 14]`, `["sidebarSectionGap", …, 0, 30, 12]`, `["bodySectionGap", …, 0, 30, 16]`; the tuple is `[key, label, min, max, default]`). Raise max 30 → 60 on all three (keep min 0 + defaults). app.src.js + app.js mirror (the same `[…].map(([key,label,min,max,def]) => …)` array in app.js).
   - **Decouple the figure distance from the subsection gap.** `__secGap` (app.src.js ~6272, resolved from `sidebarSectionGap`/`bodySectionGap`/`mainSectionGap`, sidebar fallback 12) is applied between EVERY subsection, INCLUDING the first sidebar section directly under the photo — so raising the gap also pushes the figure away. Owner: the photo→first-subsection distance must be governed ONLY by figure placement (`photoPosition`/`photoSize`), not by the subsection-gap slider. Fix: suppress `__secGap` above the FIRST sidebar subsection (give the photo its own fixed gap), so the slider spaces subsections from each other without moving the figure. Verify in preview AND export (worker uses its own spacing — check `antcv-docx-client.js` / the docx-worker sidebar gap).

7. **Carried from PM2 (still open):** see `docs/qa/OWNER-BATCH-2026-06-18-PM2.md`. Older docs: PREVIEW-STYLE-FIDELITY cluster (A/C/D/F + B hexagon/rounded-square preview reader), WIZARD-NO-SHOW-AFTER-DELETE-001 (needs live repro), LOADING-LAMP-ICON-001 (document-only), tools build-default (3-most-relevant per group, unsolicited=all).

---

## INDEPENDENT-SESSION PROMPT (self-contained)

> Continue the AntCV owner-directed work. AntCV is a React PWA (Cloudflare Pages
> + Workers). Read `CLAUDE.md`, `docs/qa/SESSION_HANDOFF_2026-06-18-pm3.md`, and
> the memories `emdash-hyphen-three-layers`, `outcomes-verbs-and-unsolicited-spec`,
> `minified-mirror-shadow-hazard`, `headless-pwa-testing` BEFORE any edit.
>
> Rules (hard): ONE deployer at a time — confirm `git status` is clean and no
> parallel session is mid-flight first. `pwa/app.src.js` is the de-minified
> SOURCE; `pwa/app.js` is the deployed MINIFIED artifact — edit `app.js`
> surgically in place and mirror the SAME change to `app.src.js`; NEVER run
> `npm run build:app` (it prepends "use strict" and blue-screens). After EVERY
> `app.js` edit: `node --check pwa/app.js` AND `node pwa/test/boot-smoke.mjs`
> (must print BOOT-SMOKE OK), and grep both files to confirm 1:1 parity. Prefer
> a content sidecar (loaded in `index.html`, registered in `sw.js` SHELL) over
> app.js surgery when the fix is data-shaped — it's restore-proof and zero
> blue-screen risk. Cache-bust QUARTET every release: the changed file's `?v=`
> in `index.html` + `CACHE` in `sw.js` + `TARGET_VERSION` in
> `antcv-version-override.js`, and add the PREVIOUS version to `STALE_VERSIONS`
> (NEVER the current — it self-matches and grows). Ship tight named bundles;
> commit + push to `main` (PWA auto-deploys); workers deploy via
> `gh workflow run deploy.yml`. End commit messages with the Co-Authored-By
> trailer. The owner tests live generations — flag every item that needs a
> regen to verify.
>
> Do, in order (each its own bundle): (1) After the owner regenerates, VERIFY
> TABLES-DISTINCT (no shared Focus Areas, tight cells) and SPEC-LINE (the
> "Processes • Products • People" subtitle is back); if tables still overlap add
> the deterministic CORE-row de-dup post-pass, if the subtitle is still missing
> add the `personalInfo.specialization` render fallback (both described in this
> doc's OPEN section with anchors). (2) EXPORT-side orphan NBSP-binding pass for
> the CloudConvert PDF. (3) The EMDASH render-separator conversion — convert each
> writer↔reader group ATOMICALLY with a round-trip test (saved-application labels
> especially: save an app, reload, confirm it still loads), per the pair map in
> this doc. Owner comms style: direct, factual, compression-oriented, short
> sentences, no filler; banned long dash `—` everywhere (use `-`).
