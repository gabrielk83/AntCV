# Copenhagen Modern visual pass — staged plan

Owner-approved (2026-07-21). The DEFAULT visual style `copenhagen-modern` gets the consultant's
"floating inset panels" refresh reverse-engineered from the Ibsen 1017 CV v4 / CL v3 PDFs
(see memory `copenhagen-modern-refresh-and-palette-first` for the measured spec). Unblocked now that the
palette is stable (A4, 1.51.1793) and colours resolve per-app via `__antcvResolvePaperVars`.

## Verification constraint (read first)
These are VISUAL changes to the header/sidebar/photo render across three surfaces. They CANNOT be
behaviour-verified from an unauthenticated session (the app shows a login screen; the preview render needs
real app state). Each stage below must be eyeballed on the OWNER's logged-in browser (or a rendered
srcdoc harness for the PDF path). Ship each stage **kill-switched** (`antcv:disable-copenhagen-v2` or a
per-stage flag) so a bad render is one localStorage key away from reverting. Do NOT batch stages.

## Colour sourcing (already solved — do not hardcode)
All box/border/accent colours come from the CSS vars the palette resolver sets on the paper wrapper
(`__antcvResolvePaperVars`, app.src.js prelude): `--header-bg` (box fill), `--brand-accent` /
`--header-line-color` (border + rules), `--sidebar-bg`, `--header-name-color`. Amber/navy show ONLY for a
brand-fitted or Ibsen app; the Copenhagen Modern default palette (`va["copenhagen-modern"]`: headerBg
#33446F, sidebarBg #C9D6EC, line #01B7BB) flows through the SAME vars. So every stage binds to a var, never a hex.

## Three surfaces (each stage touches all three unless noted)
1. **Preview** (React) — the paper wrapper (app.src.js ~51050) + the candidate band + sidebar + photo render.
2. **PDF export** (srcdoc HTML) — the export header table (app.src.js ~29572 / ~45375, `background:var(--header-bg,${Ke})`); CSS `border-radius` works in the print pipeline.
3. **DOCX** (`workers/docx-worker/src/index.js`, `buildLinearDocument`) — Word tables CANNOT round corners. ATS-safe rule: decorative rounded-rect DrawingML shapes as BACKGROUNDS with the real name/contact/sidebar tables ON TOP; the rounded box lives in the header region, the AI-notice in the footer. Where a shape would bury readable text, that surface stays square. Separate deploy (`gh workflow run` / wrangler), not a PWA cache-bust.

## Stages (ship + verify one at a time)
### V1 — Rounded header box
Header band (name+spec+contact, + photo on CV) becomes a rounded rectangle: radius ≈20pt, border 1.5pt in
`--brand-accent`, fill `--header-bg`, inset ~10pt L/R + ~7pt top, height ≈122pt.
- Preview: the band container gets `border-radius` + `border` + inset margins.
- PDF: same on the srcdoc header table.
- DOCX: rounded-rect background shape behind the header table (or accept square + note it).
Risk: clipping/misalignment of the existing photo/contact axis — verify visually.

### V2 — Floating inset panels
Everything inset ~10L/9R/7top from the page edges. CV **sidebar** becomes an inset panel: gap ≈12.5pt below
the header box, **bottom gap ≈27pt** (floats above the page end), sidebar→main gutter ≈7pt, fill `--sidebar-bg`.
Owner decision: sidebar corners rounded too IF ATS-safe (background shape behind the readable table); else square-with-gaps.

### V3 — Photo heading-left + rounded frame
Photo ≈102×102, top-left INSIDE the box, rounded frame + `--brand-accent` border. (Copenhagen Modern photo
shape is currently "circle" in `antcv-docx-client.js` — reconcile with the rounded-square frame.)

### V4 — Accent rules
Section-heading underline rules + body dividers in `--brand-accent` (2pt); spec line in the accent-orange;
table header row tint. Mostly already partly present — align to the spec.

### V5 — Application subtitle + heading↔spec swap + side-panel  (owner 2026-07-21; ATOMIC — see below)
Today the CL header spec-row shows `[role, company].join(" - ")` (the "application" line), app.src.js ~13398
(`k ? [t.role,t.company]... : t.subtitle || (ie()||{}).specialization`).
- Change the CL heading to show the **SPECIALISATION line** (same expression as the CV: `t.subtitle || spec`).
- Move the `role · company · location` info into a NEW dedicated **application-subtitle element** rendered
  BELOW the slogan (navy italic, centred, amber rule under it — the rule is V4). It is FURNITURE derived
  from meta (role/company/location), NOT an LLM section — model it like the greeting furniture and the
  slogan element (`antcv-cl-slogan-element.js` is the template for a CL element + its side-panel row).
- Reflect BOTH in the sections SIDE-PANEL: the CL header row now shows/labels specialisation; add an
  "Application subtitle" element to the CL editor list.
- **ATOMIC:** the swap and the new element MUST ship together — doing the swap alone deletes the
  application context from the CL (regression). Render on all 3 surfaces + the panel.
- CL order: the element slots between slogan and greeting via `pwa/antcv-nordic-cl-order-971.js`.

### V6 — DOCX parity sweep
Bring V1-V5 to the docx worker (rounded backgrounds, inset panels, photo frame, accent rules, application
subtitle). Separate worker deploy; verify with the Word-COM → PDF → PyMuPDF measure harness (memory
`render-and-measure-capability`) since ATS-safe shapes must sit behind readable tables.

## Sequencing & guardrails
- Follow CLAUDE.md: edit minified `app.js` + mirror `app.src.js`, cache-bust quartet, shift-claim a lane,
  ONE deployer at a time. Expect version-collision churn (parallel sessions are active) — sync tight, and
  recover a jammed rebase by reset-to-origin + deterministic re-apply (memory notes).
- Kill-switch every stage. Verify each on the owner's session before the next.
- V5 is the highest owner-priority visual item (it completes the v5 writing package's headline/subtitle);
  V1 is the most visible. Suggested order: V1 → V5 → V2 → V3 → V4 → V6.
