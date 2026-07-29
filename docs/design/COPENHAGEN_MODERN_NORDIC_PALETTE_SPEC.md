# Copenhagen Modern / Nordic Minimal — authoritative palette + typography spec

Owner spec, 2026-07-22 (from two gold docx + two written spec messages). This is the
SINGLE source of truth for the Copenhagen Modern visual applied to the Nordic Minimal
style, across **preview (app.src.js/app.js) + docx export (docx-worker + docx-client)**.
Gold files:
- Layout gold: `Downloads/AntCV_regen_2026-07-15/1017_Ibsen_Photonics_CV_FIX_3.docx` (CL layout/positions).
- Palette + v5-structure gold: `Downloads/1017_Ibsen_Photonics_CL_FINAL_v3_Nordic .docx`.

## Two-tone rule (the core)
- **Section HEADS (CV) / lead-ins (CL: Why / How I see the role / What I bring / Who I am / My goal): navy `#0B4F8A`, bold.**  ← palette token `mainHeadColor` (SHIPPED 1.51.2622).
- **Slogan headline, horizontal lines, bullet accents: teal `#00746E`.**  ← `mainLineColor` / `mainBulletColor` (kept teal).

## MAIN / body column (CV)
| Element | Colour | Size / weight | Token / where |
|---|---|---|---|
| Section heads | navy `#0B4F8A` | bold | `mainHeadColor` ✅ |
| **Sub-section names** | **teal `#00746E`** | **11 pt, bold** | `mainSubHeadColor` (colour ok; enforce 11 pt) |
| **Bullet markers** | **teal `#00746E`** | — | `mainBulletColor` ✅ (owner correction: bullets teal) |
| Role name | **teal `#00746E`** | — | role-name colour (find; currently mainHeadColor-derived) |
| Company name | (default `#333333`) | **italic** | `mainCompanyColor` + italic |
| Date / years | **`#777777`** | — | `mainYearColor` (was `#595959`) |
| Body text | `#333333` | — | `mainTextColor` ✅ |
| **Main/body head underline** | **`#777777`** | — | the rule under body section heads |
| **Rule under role–company–years** | **teal `#00746E`** | **1.5 pt** | `mainLineColor`, 1.5 pt |

## SIDEBAR column (CV)
| Element | Colour | Size / weight / spacing | Token / where |
|---|---|---|---|
| **Sidebar background** | **`#DCE5EA`** | — | `sidebarBg` (was `#DDE6F2` base / `#C9D6EC` preset) |
| Sidebar section names | teal `#00746E` | bold, Calibri, **1 pt before / 1 pt after** | `sidebarHeadColor` (colour ok; enforce spacing) |
| **Rule under sidebar section names** | **teal `#00746E`** | **1.5 pt** | `sidebarLineColor` (was `#283556`) |
| Sidebar GROUP names | teal `#00746E` | — | group-name colour |
| **Sidebar group-name underline** | **`#777777`, DOUBLE** | — | double underline, grey |
| Sidebar lead-ins | navy `#283556` | bold, 10.5 pt Calibri, **3 pt before / 3 pt after** | |
| Sidebar lead-in underline | navy `#283556` | (matches lead-in) | |
| Sidebar text | navy `#283556` | bold, 10.5 pt Calibri, 3 pt before / 3 pt after | `sidebarTextColor` ✅ |

## COVER LETTER header (from the golds — no name/spec band; owner keeps name in header)
- ~122 pt top gap, then **slogan headline** (Trebuchet MS 11 pt, teal `#00746E`, bold, centred).
- **Application subtitle** below it: grey `#808080`, 10 pt bold, centred, with a **teal `#00746E` bottom rule, 1.5 pt** (the "line after the application line"). It replaces the in-heading application line (heading↔spec swap, shipped 2520/2541).
- **Specialisation line** the owner wants **teal `#00746E`**, not white.
- Section lead-ins: navy `#0B4F8A` bold **+ underline** (currently missing; owner said "dark green" verbally but the Nordic gold OOXML shows the underline as **navy**, matching the lead text — RESOLVE before rendering).
- Two **2 pt `lineRule=atLeast` split-line spacers**: after the opening, and before the closing.
- Body: justified, ~1.11× line, Calibri 10.5 pt.

## v5 CL structure (generator, not render)
Order: greeting → opening → Why → **How I see the role (role_view: lead + 3 employer bullets)** → What I bring → How I will contribute → **Who I am AT END (Professional summary / How I operate / Eligibility / My goal)** → closing.
- role_view's 3 bullets and the Who-I-am end-block must be **filled by generation** (a migrated pre-v5 letter shows unfilled `[Employer priority N]` placeholders + a lead-only Who block).
- **Foundation / Hands-on / Professionally are FOLDED into Who I am** (Professional summary + How I operate) and hidden — the owner flagged the current overlap (foundation still `on:true` while Who repeats its content).

## Implementation notes / hazards
- Colours live in palette objects in `app.src.js` + minified `app.js` (base default ~L364 + the `va.copenhagen-modern` preset ~L20152), and in the docx export (`docx-worker/src/index.js` + `antcv-docx-client.js`). Change the **Copenhagen copies only** — `#595959`/`#283556` are shared across OTHER package presets (navy/brown/teal themes), so use targeted per-token edits, never replace-all.
- The CL header / application-line sidecar (`antcv-application-line-001.js`) is under ACTIVE development by the HEADER-APP-LINE-001 lane — coordinate to avoid collision.
- Typography (11 pt sub-heads, 10.5 pt sidebar, 1 pt / 3 pt spacing) + line rules (1.5 pt, double underline) are render-code, not palette tokens.
- **Requires live visual verification** — do this in a render-capable session.

## LOCKED via interactive mockup (owner, 2026-07-22) — these OVERRIDE the tentative values above

Source of truth: the print-accurate A4 mockup (artifact `91ba69e4-…`, file
`scratchpad/copenhagen_preview.html`), iterated to owner sign-off. Implement these
exact values into app render (preview) + docx-worker + docx-client.

### Heading box (CV band + CL headbox — IDENTICAL type + spacing on both)
- Box background **navy `#33446F`**, `border: 1.5pt solid #01B9BD` (cyan), radius ~9px.
- **Name**: Trebuchet MS bold, **24px** (hard cap — owner tried 22/23/25, settled 24 then 23; final render at 23-24px range, `letter-spacing: .14em`) — expanded tracking so it frames the photo like a 2nd ring.
- **Specialisation line**: **cyan `#01B9BD`** (NOT white, NOT teal), Trebuchet bold 11pt, `letter-spacing:.04em`.
- **Contact line**: 9.5pt, `transform: scaleX(.73)` (condensed), **single space** between every word/icon (NO ` · ` middots — emojis separate), `letter-spacing:-.01em`. Width ≈ the name width.
- **Header hyperlinks (email, LinkedIn)**: **white `#fff`** underlined (dark box → NOT blue/cyan, which "break the aesthetics").
- CV photo: **1.4in circle**, `border: 1.5pt solid #01B9BD` (cyan contour), inset **0.15in** from box top/bottom/left; box `min-height: 1.7in`, content vertically centered, text centered.
- CL header = same box/type; no photo; same 1.7in height + centering so placement matches the CV.

### CV layout — equal horizontal spacings (owner equation)
`X + xS + St + xS + xM + Mt + X = page width`, with **X = xS = xM = 0.15in**
(X = page margin, xS = sidebar-text inset, xM = sidebar→main-text gap; St/Mt = the two text widths). Floating inset panels (rounded sidebar `#DCE5EA`). Narrow ~0.14-0.15in page margins throughout (anti line/page slide).

### Body links
Light-ground hyperlinks: blue `#0B4F8A`, underlined (dark-box links are white — above).

### Two-tone structure (teal-led)
- Section heads (main), sub-heads, role names, sidebar heads, bullets, all rules: **teal `#00746E`**.
- Navy is reserved for the heading box (`#33446F`) + sidebar text (`#283556`); the per-role horizontal rule is DROPPED (bold teal role name + spacing carries it).
- **All horizontal lines / underlines ≈ 1.5pt**, uniform. Lead-in / "At your service" underlines grey `#777777`; "At your service" is teal + NON-bold + cyan `#01B9BD` underline.

### Core Competencies table (the `type:"table"` in main)
- Heading + underline, then ~6pt gap before the table.
- Header row: **navy `#33446F` background, white text**, centered.
- Body rows: **banded** white / sidebar-light `#DCE5EA`; **first column bold** (navy `#283556`), second column normal; rows **justified** (short first-col labels left).
- **Cyan `#01B9BD` outer frame** on the table.

### Results / sub-sections / AI notice
- Per-role **Results** lead-in line (teal lead-in + text) under each role's bullets, incl. Earlier career.
- Sidebar GROUP names + main sub-subsections (e.g. "Earlier career") are **centered**; equal spacing between sub-subsections (first tighter to its section head).
- **AI notice** ("AI-assisted document" CV / "AI-assisted" CL): auto-placed on the larger-gap side — **right** for the CL, **left** for this CV; flips for RTL.
- Publications/patents entry pattern: lead-in + short text + hyperlink; **left-aligned** (justify opens dead space).

### Global
- **ASCII hyphen only** — never `—`/`–` anywhere (gold-rules.json typography.banned_separators; applies to output too, [[emdash-hyphen-three-layers]]).
- Compression / Fit-it avoids visually jarring orphans (`text-wrap:pretty` in preview; density loop for content).

### Implementation staging (avoid colliding with the active HEADER-COLOR / appline lane)
1. **Palette tokens** (colors only) in the `va.copenhagen-modern` preset + base default (app.src.js + app.js): cyan `#01B9BD` spec/border/photo-ring, navy box `#33446F`, table header/band, sidebar `#DCE5EA`, link colors. Lowest-risk, targeted per-token (NEVER replace-all — shared hexes).
2. **Competency-table render** (banding + blue header + cyan frame + bold-first-col + centered-header/justified-rows): preview React table + export HTML + docx-worker `renderCompetencyTable` — self-contained, high-value, does NOT touch the header area.
3. **Header render** (photo ring, spec cyan, contact condense/single-space, white links, box layout, name tracking): COORDINATE with the header-color/elem-colors/appline sidecars (antcv-header-elem-colors.js, antcv-header-color-controls.js, antcv-copenhagen-v2-001.js, antcv-appline-rule.js) — this is their territory; splice in-body or extend their sidecars, do not fork.
4. **docx parity** for all of the above (docx-worker + antcv-docx-client.js), then live-verify a real export.

## MOCKUP-DIVERGENCE FLAGS (self-verification audit, 2026-07-22 late)

Full render-vs-mockup audit (16 items, code-verified in app.src.js). FIXED = shipped
this session; OPEN = flagged render work; JUDGMENT = owner live-tuned value conflicts
with the mockup — owner call, do not silently change.

### FIXED (1.51.3001-3101 + wk 1.14.163/164)
- Tokens: spec/border/photo-ring/table-frame cyan #01B9BD; sidebar+banding #DCE5EA
  (ALL five copies synced: preset, base, worker bundle+palette.js, registry css);
  mainHeadColor → teal #00746E (CL-CV-TWO-TONE navy superseded); mainYearColor →
  #777777; sidebarLineColor → teal; headerContactColor → #DBE4F0; photo ring 1.5pt.
- Table: banding token-driven all surfaces; cyan outer frame (preview + export HTML
  + worker per-cell perimeter); header centered; first col LEFT (supersedes
  FOCUS-TABLE-LEFTCOL-JUSTIFY-001); heading→table gap 8px≈6pt ✓.
- Header band (preview, copenhagen-v2 sidecar DEFAULT ON, kill '0'): name tracking
  .14em, contact scaleX(.73), white band links, cyan border fallback #01B9BD.
- Contact line joins with single spaces, no middots ✓ (was already correct).
- CL band = CV band (same builder) ✓. Company italic #333 ✓. Years #777777 ✓.

### OPEN — render-structure flags (well-scoped batch; all cite app.src.js ~lines)
1. **ALL rules/underlines render 1px CSS (0.75pt); mockup = 1.5pt (2px)** — one
   thickness sweep covers section-head rule (~8374), sidebar-head rule, lead-in
   underlines, group lines. THE cross-cutting fix.
2. **Section-head underline COLOR**: renders mainHeadColor (now teal); mockup wants
   grey #777777 under the teal heads (~8374; same for CL lead-in underline color).
3. **Role row draws a teal 1px bottom rule (~7366); mockup: NO per-role rule.**
4. Role title 10.5pt italic; mockup 11pt bold non-italic (7318-7321).
5. "Results" lead-in: teal bold italic, NO underline; mockup adds 1.5pt #777
   underline, non-italic (7645-7658).
6. {grp} sub-heads (Earlier career / sidebar groups): centered ✓ but NO underline,
   no inline years; mockup: teal 1.5pt rule (main) / thick #777 line (sidebar
   groups) + years #777 right (6703-6730; roleHead variant lives in the
   roles-richblock sidecar).
7. Body links #0563C1; mockup #0B4F8A (2634).
8. Sidebar panel: no border-radius in render; mockup rounded ~9px (46040-67;
   partially covered by the copenhagen-v2 sidecar margins — radius still missing).
9. CL application line: teal, no rule; mockup #808080 text + full-width 1.5pt teal
   rule under it (46889-900) — COORDINATE with the appline lane (antcv-appline-rule.js
   shipped 2861; check whether that sidecar now draws the rule before editing).
10. "At your service,": black, no underline; mockup teal non-bold + 1.5pt cyan
    #01B9BD underline (47014-29).
11. CL AI notice: 7px teal; mockup ~7.5pt grey #777 (51361-88).
12. Stage 4 docx parity for the header (box border/radius, name tracking, contact
    condense, white links) — preview-only so far.

### JUDGMENT — owner live-tuned vs mockup (ASK, do not override)
- Band radius: sidecar 22px (owner live-tuned "perfect" 2026-07-21) vs mockup 9px.
- Panel insets: sidecar 7.4px vs mockup equation 0.15in (14.4px) X=xS=xM.
- Photo: app 82px medallion + tuned nudge vs mockup 1.4in circle @0.15in inset.
- Band name size: render 16pt vs mockup 23px (~17.3pt at A4 scale) — close; exact
  pinning is a docx-parity (Stage 4) decision.

## Live-tuning round (owner screenshots, 2026-07-23 — SHIPPED 1.51.3121-3202)
The owner tuned the deployed preview; these SUPERSEDE the corresponding mockup
values above and are the CURRENT preview truth (all in antcv-copenhagen-v2-001.js
unless noted):
- Header band is a GRID: photo column (158px) + text column; photo **134px**
  (1.4in) circle, left inset 18px, vertically centered; box min-height **174px**;
  text rows even 7px gap, group vertically centered; text sizes name **24px**
  (+.14em tracking), spec **18px**, contact **13px** + `scaleX(.73)` +
  `white-space:nowrap` (ONE line). Band radius 22px, cyan 1.5px border.
- NO rules inside the header box (antcv-header-rule-control defaults all OFF;
  HEADER-RULE-DEFAULTS-002 added slogan[def-off] + application[def-ON] fields).
- Application line: `data-antcv-app-line-native` marker; grey text (elem-colors)
  + teal 1.5pt rule (appline-rule, merged into headerItemRule.application store);
  pulled up toward the slogan (margin-top -7px) with 7px air above its rule.
- "At your service," sign-off: teal, non-bold, 1.5px cyan underline
  (SIGNOFF-UNDERLINE-001 painter). Spec line cyan #01B9BD (SPEC-LINE-COLOR-001).
- ORPHAN-RULE-GATE-001: a headline-off section with empty/placeholder body no
  longer draws its standalone rule (both bundles).

## Stage 4 — DOCX/PDF export parity (SHIPPED 2026-07-23, wk 1.14.165-copenhagen-stage4 + pwa 1.51.3622-stage4-docx)
Export must match the tuned preview above. Work order (docx-worker + docx-client
+ export-HTML; hand-maintained bundle, docx-worker-bundle-no-build):
1. Header box: navy #33446F fill + **cyan 1.5pt border, rounded** (VML roundrect
   behind the header, the SIDEBAR-SPINE-VML-001 pattern) — square-border fallback
   acceptable first increment.
2. Photo **1.4in** circle, ring 1.5pt #01B9BD (verify photoBorderWidth forwards).
3. Name: ~17.5pt + expanded tracking (`w:spacing`); spec cyan (token ✓ forwards);
   contact **char-scaling `w:w="73"`** single line; band links WHITE.
4. NO internal header rules by default (header_rules payload now defaults empty —
   verify the worker draws none on absent config).
5. CL: app-line grey #808080 + teal 1.5pt rule under it, spacing per preview;
   sign-off teal + cyan underline (`w:u` color); orphan-rule gate parity.
6. Verify with a REAL CloudConvert export (`/generate-pdf` + `/diag/convert-docx`)
   against the preview screenshots; then the deliverable set per NIGHTLY hard
   rule 8 (CV+CL DOCX, CV+CL PDF, analysis PDF).

## Status
- ✅ Mockup locked (2026-07-22); live-tuning round shipped (2026-07-23, → 1.51.3202).
- ✅ Stages 1-3 + mockup-parity tokens + five header/CL defects + band grid.
- ✅ **Stage 4 export parity SHIPPED (2026-07-23, wk 1.14.165-copenhagen-stage4,
  pwa 1.51.3622-stage4-docx).** All six items, gated on package=copenhagen-modern
  (`style._cph`), legacy payloads byte-identical (diag legacy checks):
  1. Band box = page-anchored VML roundrect (navy 33446F + cyan 1.5pt, 22px-radius
     arcsize) in a FIRST-PAGE header part + `titlePg`; band cells un-shaded, rows
     pinned 152pt, centered; page-1 spine starts below the box.
  2. Photo 1.4in + 1.5pt cyan ring at every medallion site (there is no
     photoBorderWidth token anywhere — the ring width was hardcoded 1pt; now
     hardcoded 1.5pt under the gate; colour = forwarded photoBorderColor).
  3. Name 17.5pt + w:spacing 49; spec cyan bold 13.5pt; contact 9.5pt w:w=73
     single-space ONE line; band links white.
  4. Absent header_rules → NO internal rules (copenhagen only).
  5. CL app line grey + teal 1.5pt rule (worker defaults; export-header-colors 1.1
     now ALSO patches /generate-pdf — the PDF path never got the colour patch),
     slogan→app-line gap tightened; sign-off teal + cyan w:u; ORPHAN-RULE-GATE
     parity. NOTE: app-line grey is 808080 (worker default, per this work order)
     / 595959 when the elem-colors sidecar forwards (preview APP_GRAY) — flag if
     the owner wants one number.
  6. VERIFIED on real CloudConvert renders (synthetic anita persona): CV + CL
     /generate-pdf pixel-checked (rounded box, ring, one-line contact, table
     frame, app-line rule, sign-off underline all render); 2-page CV clean (box
     page-1-only, full spine p2, no blank-page cascade); Word COM opens both
     DOCX without repair and renders identically. Deploy diag:
     workers/docx-worker/test/diag-copenhagen-stage4.mjs (26 checks).
  Owner's REAL deliverable set (NIGHTLY hard rule 8) regenerates on the next
  nightly / owner export now that wk 1.14.165 is live.
- ✅ **ALL eight render flags SHIPPED (2026-07-26, CPH-RENDER-FLAGS-001; PWA
  `1.51.3822-cph-flags` + `1.51.3823-cph-flags2`, wk `1.14.172-cph-render-flags`,
  both deployed).** Gated on copenhagen-modern (preview `__antcvCphPkg`, export
  `style._cph`) so every other package renders byte-identically:
  rule thickness sweep 1px→1.5pt via one helper (`__antcvCphRule`; export mirror
  border size 8→12 eighths of a point); grey `#777777` section-head underlines
  (MAIN heads only — sidebar heads keep `sidebarHeadColor`); per-role rule
  DROPPED (the worker never drew one, so this was preview catching up to export);
  "Results:" lead-in upright with a 1.5pt grey underline (italics stay reserved
  for the company line); {grp} sub-heads on their own rule (teal main / grey
  sidebar) with the group's years right-set in `#777777`, floated so the
  heading's own centered alignment is untouched; body links `#0563C1`→`#0B4F8A`
  (preview + both worker sites); sidebar panel radius 9px in the copenhagen-v2
  sidecar (no `overflow:hidden`, so a straddling photo is still never clipped).
  **Gotcha worth keeping:** since ROLES-AS-RICHBLOCK-001 the role rows render in
  `pwa/antcv-roles-richblock-adapter.js`, NOT the app.js experience branch — the
  per-role-rule fix applied to app.js alone left the rule on screen; 1.51.3823
  drops it in the adapter path too and gives the PAGINATED continuation head the
  same 1.5pt grey (it draws its rule on a separate render path from the section
  head). AI notice 7→7.5pt on copenhagen in the same pass.
  Logs: `docs/qa/SESSION_LOG_2026-07-26_BUGFIX.md`.
- ⬜ Nothing open in this spec beyond the JUDGMENT items above, which are
  owner-locked by design (band radius 22px, panel insets, photo size).
