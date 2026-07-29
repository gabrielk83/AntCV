# Copenhagen Stage 4 - DOCX/PDF export parity (2026-07-23)

Owner order: "fix docx with all the modifs" - the last open leg of
`docs/design/COPENHAGEN_MODERN_NORDIC_PALETTE_SPEC.md`, whose "Stage 4 -
DOCX/PDF export parity" section is the authoritative work order.

Shipped: docx-worker `1.14.165-copenhagen-stage4`, PWA `1.51.3622-stage4-docx`.
Later refined by `1.14.171-spec-photo` / PWA `1.51.3743-spec-photo124` (see the
"Owner follow-ups" section at the end).

## The gate that made it safe

Everything is gated on the payload naming the copenhagen-modern package:

    style._cph = package present AND normalisePackageId(package) === "copenhagen-modern"
    style._cphCyan = payload.style.photoBorderColor (a branded export sends its own accent) or #01B9BD

A legacy payload with no `package` renders byte-identically to before. The
deploy diag asserts that explicitly, so the blast radius stays provable rather
than assumed.

## The six work-order items

### 1. Header box - navy fill + cyan 1.5pt rounded border
A page-anchored **VML roundrect** (fill #33446F, stroke #01B9BD 1.5pt,
`arcsize="15000f"` for the ~22px radius) hosted in a FIRST-PAGE header part with
`<w:titlePg/>`. This is the SIDEBAR-SPINE-VML-001 layer - the one proven to
render behind content in Word AND LibreOffice/CloudConvert. A body-anchored
negative-z rect was not attempted: the converter is known to drop it.

Consequences handled in the same pass:
- the band table cells DROP their navy shading (the rect is the fill now), and
  the rows pin to 152pt with `verticalAlign: CENTER` so the text sits inside the
  rect rather than above it;
- the page-1 spine starts BELOW the box (`margin-top:158pt`, height reduced)
  so no pale sliver peeks around the rounded corners now that the cells carry no
  shading. Pages 2+ keep the full-height spine.
- `<w:titlePg/>` is inserted in valid sectPr child order (before `<w:docGrid>`),
  verified in the emitted XML.

### 2. Photo - 1.4in circle, 1.5pt cyan ring
`photoBorderWidth` does not exist anywhere in the client or the worker - the
ring width was hardcoded 1pt (12700 EMU). It is now 1.5pt (19050 EMU) under the
gate, at EVERY medallion site, with the colour taken from the forwarded
`photoBorderColor`. (Diameter later became 1.29in - see follow-ups.)

### 3. Band typography
- Name ~17.5pt with `w:spacing` 49 tracking (.14em), line rule `auto` (an exact
  rule clipped the taller face).
- Specialisation cyan, bold, 13.5pt (the tuned preview's 18px).
- Contact 9.5pt with character scaling `w:w="73"` - the OOXML equivalent of the
  preview's `scaleX(.73)` - single-space separators, so the whole line holds ONE
  line at about the name's width without shrinking glyph height.
- Band hyperlinks render WHITE (blue/cyan "break the aesthetics" on the dark
  box, per the mockup lock).

### 4. No internal header rules by default
An ABSENT `header_rules` payload now draws NO rules inside the box on
copenhagen (HEADER-RULE-DEFAULTS-002 parity). Legacy packages keep their
default-on behaviour; an explicit `on:true` still wins everywhere.

### 5. Cover letter
- Application line grey #808080 with a teal #00746E 1.5pt rule under it, both as
  worker defaults when the sidecar payload is absent.
- The slogan-to-app-line gap tightens when an app line follows (APPLINE-SPACING
  parity), which required computing the app-line text BEFORE the slogan renders.
- Sign-off teal, non-bold, with a CYAN `w:u` underline (SIGNOFF-UNDERLINE-001).
- ORPHAN-RULE-GATE-001 parity: a headline-off section with placeholder-only body
  no longer draws its standalone rule. Body paragraphs exist even for
  all-placeholder content, so `body.length` alone was not a sufficient test; the
  worker now applies the same real-content test the preview uses.

### 6. Verified on REAL renders, not just XML
- CV + CL generated through the DEPLOYED worker and converted by the real
  CloudConvert path (`/generate-pdf`), rendered to PNG with PyMuPDF and read:
  rounded navy box, cyan ring, one-line contact, cyan table frame, app-line rule
  and sign-off underline all present.
- A MULTI-PAGE CV was rendered specifically to prove the box is page-1-only and
  the spine runs full height on page 2, with no blank-page cascade.
- Word itself (COM automation) opened both DOCX files without a repair prompt
  and exported PDFs that match.

## Regression net

NEW `workers/docx-worker/test/diag-copenhagen-stage4.mjs` - 26 checks covering
every item above PLUS a legacy no-regression block (no header box part, band
still shaded, name still 16pt, no titlePg, default rules still drawn). Kept
green ever since; it is part of the pre-deploy gate set.

A note for future readers: two checks failed on first run purely because the
assertions assumed OOXML attribute ORDER. The emitted order is
`w:val w:color w:sz w:space`. The tests were corrected, not the code.

## Owner follow-ups (same spec, later the same day)

- **SPEC-SHORTER-001**: the specialisation line must always render NARROWER than
  the name. It now shrinks (floor 10pt worker / 11px preview) until its ink is
  <= 0.92x the fitted name width, on both surfaces, using each surface's own
  width model so the rule agrees by construction. An explicit "Font sizes (pt)"
  panel value always wins - the panel stays authoritative.
- **CPH-PHOTO-124**: band photo 129 -> 124px in the preview and 134 -> 124px
  (1.29in) in the worker, including the header-left placement and the name-fit
  clearance clamp. Ring stays 1.5pt cyan.
- The stale pinned-17.5pt name assertions in the diag were replaced by the
  CPH-NAME-WIDTH fit model (15-30pt, tracking = .14em of the fitted size).

## Deploy trail

`gh workflow run deploy.yml -f target=docx-worker` then `/health` confirmed
`1.14.165-copenhagen-stage4`, later `1.14.171-spec-photo`. PWA cache-bust
quintet complete on every PWA-side change.
