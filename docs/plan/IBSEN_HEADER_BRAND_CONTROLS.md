# Ibsen header: per-element colour controls + brand-over-text/lines + CL photo + contact bug

Owner 2026-07-22, from `1017_Ibsen_Photonics_CV_FINAL_v4.pdf` + `..._CL_FIX.docx`.
Reference facts: the applied CL uses brand **amber `D97706`** on text runs AND on **2 horizontal
rule borders** (white `FFFFFF` on the dark band). The CL image is the **Signature** (318×128),
NOT a headshot — so "no figure in the CL" = suppress the candidate **photo**, keep the signature.

## Exact per-element colour scheme (owner 2026-07-22, from the Ibsen applied files)
Colours are **per element** (NOT one brand ink):
| Element | Colour | Surface |
|---|---|---|
| Name | white (`FFFFFF`) | CV + CL band |
| Specialisation | orange (`D97706`) | CV + CL band |
| Contact | white (`FFFFFF`) | CV + CL band (both) |
| Band internal horizontal rules | HIDDEN (blue-on-blue, i.e. rules OFF inside the band) | band |
| Box contour | 1.5px in the accent (orange) | band |
| Slogan | BRAND colour (Ibsen = deep blue, the brand primary/navy — NOT black) — `brandV2.sloganColor` | CL body, white bg |
| Application (role·company) | dark gray (~`595959`) | CL body, white bg (this is the V5 line, moved below the slogan) |
| CL body rules | 2 orange lines (`D97706`), 1.5px | CL, white bg |

Implication: `COMPANY-BRAND-FIT-001` currently collapses `headerNameColor = headerSpecColor =
headerContactColor = __ink` (`app.src.js:27103`) — WRONG. Must set per element: name/contact = readable
ink (white on the dark band), spec = accent (orange). Worker already has the 3 separate slots, so the
export renders per-element once the collapse is removed. Band rules must be OFF (hidden); the box contour
(copenhagen-v2, 1.5px accent) carries the band edge. In the CL body: slogan = BRAND colour (Ibsen deep
blue, `brandV2.sloganColor` — NOT black), application = dark gray, 2 accent rules — ties to V5
(application-subtitle moved below the slogan onto the white body). EVERY header element
(name/spec/contact/slogan/application) takes a per-element BRAND colour; white/orange/blue/gray here are
just Ibsen's brand values, not hardcoded defaults.

## The five asks + exact hooks (from the code map)

### #4 — No candidate photo in the cover letter
- **Export (DONE, shipped):** `workers/docx-worker/src/index.js` — `buildLinearDocument` is CL-only;
  `photoInHeaderCL`/`photoInMainCL` forced to `null` (CL-NO-PHOTO-001). Deployed.
- **Preview (TODO — bundle edit):** the band medallion `zn && ("header-left"===er||"header-right"===er)`
  at `app.src.js:45445` is NOT doc-gated. Add `"cv"===Lt` to that condition (and the MSO-HTML export
  photo builder `:29671`–`:29688`). Alternative lighter touch: sidecar CSS hides the CL band photo, or
  the client forces `photoPosition:"none"` in the CL export payload.

### #5 — Contact row click collapses the whole CAND panel (BUG)
- Root cause: the "📇 Cand. ▾" collapse header at `app.src.js:48658`–`:48663` does DOUBLE DUTY — its
  `onClick` toggles `oi("candidate")` AND it carries `data-candidate-drop-loc="topbar"`. The contact
  row's pointer drag-drop inference (`je`, `:13056`/`:13061`–`:13080`) resolves the nearest
  `[data-candidate-drop-loc]` within 160px; a press on Contact (directly below the header) lands on the
  collapse header → collapses the panel. Prior mitigations: `HEADER-DRAG-DROP-NOMOVE-001` `:13047`,
  and the mobile grab-zone note `:48582`.
- **Fix (bundle edit):** split `data-candidate-drop-loc="topbar"` onto a separate NON-clickable node
  (not the collapse toggle), OR exclude the collapse header from the `je` drop fallback (`:13068`), OR
  make the collapse `onClick` ignore synthetic drops. Needs visual verification.

### #2 — Per-element colour control in each side-panel row
- Rows render via `je(...)` `app.src.js:12958`; the 5 elements: NAME (`:13502`), SPECIALISATION/APPLICATION
  (`:13548`, label flips in CL `:13550`), CONTACT (`:13823`), SLOGAN (standalone sidecar
  `antcv-cl-slogan-element.js`), APPLICATION (same row as spec). Control-button cluster per row:
  reorder `:13159/:13178`, loc `:13247/:13270`, visibility `:13294`, edit `:13314`.
- **Add:** a colour-control button per row writing the per-element colour key. Colour keys already exist
  in `styleConfig`: `headerNameColor / headerSpecColor / headerContactColor` (+ slogan via brandV2
  `sloganColor`). Lines via the header-rule store (`headerItemRule[field].color`, sidecar
  `antcv-header-rule-control.js`). **Injecting the control buttons is sidecar-friendly** (like other
  injected row controls); wiring them to the keys is the work.

### #3 — Brand applied over the 5 text elements + the horizontal lines
- **Text — export ALREADY branded:** worker applies `style.headerNameColor/SpecColor/ContactColor`
  (`:25929/:25949/:26053`), fed by brand `headerInk` (COMPANY-BRAND-FIT-001 `:27103`). Slogan via
  `meta.slogan_color`.
- **Text — preview NOT branded (bundle edit):** the live band HARDCODES white — name `app.src.js:45288`
  (`#fff`), spec `:45331` (`rgba(255,255,255,.9)`), contact `:45364/:45249` (`#fff`) — it ignores the
  CSS vars the resolver already sets (`--header-name-color` etc. via `__antcvResolvePaperVars:2436`).
  Fix: change those 3 sites to `var(--header-name-color,#fff)` / `var(--header-spec-color,…)` /
  `var(--header-contact-color,#fff)`. (Or a sidecar CSS `!important` override on those spans.)
- **Lines — worker ALREADY honours `header_rules[k].color`** (`:25920/:26004`); that's how the Ibsen
  export got amber lines. So brand-over-lines = set `header_rules[name|spec|contact].color` (+ `.on`)
  from the brand line colour **client-side** (the store is the `antcv-header-rule-control.js` sidecar).
  Do NOT rewire the worker fallback (`sidebarHeadColor`) — that would regress the default look.
- **Brand line colour source:** `brandV2.accent` / package `headerLineColor` (palettes `:20142`+, e.g.
  Ibsen amber). `__antcvResolvePaperVars` already emits `--header-line-color = accent||headerInk`.

### #1 — "The modifications" = the above + the Copenhagen visual pass (rounded box / floating panels /
photo-corner, already shipped opt-in). No separate work beyond #2–#4.

## Sequencing (pane-gated)
Bundle edits (#5 contact bug, #4 preview gate, #3 preview band-text vars, #2 control UI) MUST be
visually verified on the owner's logged-in session — the Browser pane was DOWN when this was mapped, and
blind minified-bundle edits have blue-screened before (APPJS-BLUESCREEN lineage). Sidecar-only pieces
(#3 brand→header_rules colours; a preview CL-photo hide) are reversible and can ship without the pane,
kill-switched. Export pieces (#4 DONE) are render-verifiable via Word-COM.
