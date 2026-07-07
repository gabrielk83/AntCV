# Handoff prompt — Trackman + Unsolicited exports & AntCV generator implementation

*Paste the block below into a fresh session. Everything is staged; the KOMBIT CV+CL are the gold reference.*

---

You are continuing AntCV work. A previous session delivered a polished Danish **KOMBIT "AI-udvikler"** CV + cover letter (the GOLD reference) and shipped/deployed one generator fix. Read these memories first (they hold the full design spec and toolkit): `header-banner-design-rules`, `line-distribution-guidelines`, `render-and-measure-capability`, `docx-hand-edit-namespace-corruption`. Also read `docs/qa/OPEN_REGISTER.md` **row 62** (HEADER-BANNER-DESIGN-RULES-001) and rows 52–61. Sync first: `git fetch origin && git pull --rebase origin main`.

## Gold reference (match this exactly)
`C:\Users\karpg\Downloads\CV_Gabriel_Alexander_Karp_Gershon_KOMBIT_AI-udvikler_20260706_DA.{docx,pdf}` and `CoverLetter_..._DA.{docx,pdf}`. Study the docx structure — it embodies every rule below.

## The design rules (apply to ALL exports)
1. **Header = one centered stack**: name / specialization(CV) or application(CL) / contact, all centered on the CONTACT line's axis. Not name/spec in one row and contact in another.
2. **Contact line**: `jc=center`, NOT justified. Icon glyphs (⌂ ★ ✉ ☎ 🔗) are the separators — remove `" • "` (use ~3 spaces). Email icon = ✉ (U+2709), never `@`.
3. **Contact controls two white rules** (`pBdr` top+bottom, `single sz=4` = 0.5pt, white) bracketing it. With a figure in the header, tighten the contact indent so the rules HUG the text and CLEAR the photo (KOMBIT gold: `ind left=3024 / right=144` twips). With no figure (CL), the rules span normally.
4. **Photo**: floating, centered over the SIDEBAR column (photo-center-x = sidebar-center-x; KOMBIT `Hoff≈541020` EMU for a 1.5" photo). Tightening can open a bottom gap → extend body-row `trHeight` + realign photo `Voff`.
5. **Banner→body divider**: use the **body-cell TOP borders** (both cells, `single sz=12` → renders ~1.4pt uniform). Do NOT use the banner gridSpan-cell bottom border — it renders a sub-pixel seam at the internal grid line AND a red-undercut thinning. (A truly seam-free divider needs the header split into its own 1-column table — optional, risky.)
6. **Bullet markers** = brand color in `word/numbering.xml` (`lvl>rPr>color`), NOT document.xml.
7. **Invisible Word header** — already fixed in the docx-worker + deployed. For any HAND-edited docx, ensure `header1.xml` has NO `w:shd` navy fill and a 1pt (`sz=2`) paragraph mark, `line=40` exact.
8. **Table cells** (competencies): 6pt bottom cell margin (`tblCellMar bottom=120`) so text clears the row rule.
9. **Line distribution**: no runts, last lines reach the margin, columns bottom out together. A justified line that strands a lone short word (e.g. "i") → either drop justify for that paragraph OR reword as an enhancement + NBSP-bind the preposition. All year ranges same gray (`#595959`).
10. **THEME-COLOUR TRAP**: setting `w:color w:val` does NOT override a `w:themeColor`/`w:themeTint` on the same element — strip theme attrs. Verify colour in the RENDER (PyMuPDF span colour), not the XML.

## Toolkit (measure, don't guess)
- Render docx→PDF via Word COM: PowerShell `New-Object -ComObject Word.Application; $d.ExportAsFixedFormat($pdf,17); $d.ComputeStatistics(2)` (=pages). Definitive; matches the owner's Word view.
- Measure with **PyMuPDF (fitz)**: page count, span `bbox`/`color`, border thickness, gaps.
- Hand-edit docx WITHOUT corruption: parse with ElementTree, re-serialize, then `restore_ns()` (rebuild on the pristine original's `<w:document>` root + inject every body-used prefix), and validate with strict `lxml.fromstring` + `python-docx`. **Owner opens files in Word and re-saves — Word reverts direct table formatting (borders, cell margins); re-apply at the XML level and treat the PDF as the safe final.**
- CloudConvert (LibreOffice) is still prod's server-side export; local Word render is dev/verify only.

## TASK A — Trackman CV + CL (English)
Job ad: `C:\Users\karpg\Downloads\Trackman A_S - Project Manager, Hardware.pdf` — **English**, "Project Manager, Hardware", Trackman A/S (Hørsholm), R&D, next-gen modular hardware platform, works with mechanics/optics/electronics teams. Strong fit for Gabriel's electro-optics/hardware background (Meprolight, Sirin, Innoviz).
- **Brand**: orange / white / dark gray / medium gray (Trackman orange ≈ `#F37021`; dark gray `#333333`, medium gray `#666666`). Re-brand the 5 synced palette copies (band, bullets, section headings, sidebar tint, table header) — see memory `palette-token-copies`.
- **Photo**: BRIGHT-background (owner flipped it for Trackman) — `C:\Users\karpg\Downloads\Gemini_Generated_Image_demn8mdemn8mdemn.png` (2048², prepped 400² at `scratchpad/trackman_photo_400.jpg`). Center over sidebar.
- **Content base**: an existing English Trackman docx (`CV_..._Trackman_A_S_Project_Manager_Hardware_20260706*.docx`) has the hardware-PM-tailored content, but with OLD styling — apply ALL rules above + re-brand + photo swap, OR regenerate via the docx-worker and hand-polish.
- **Tailoring**: emphasize hardware project management, optics/electronics, idea→production→field, senior-stakeholder coordination. Recall relevant kernel items; trim JD-irrelevant bullets (rows 54–56).
- Deliver job-named `CV_..._Trackman..._Project_Manager_Hardware_2026xxxx.{docx,pdf}` + CL.

## TASK B — Unsolicited CV + CL
- Pull from the **unsolicited kernel** (memory `hwic-target-gabriel-unsolicited`, `docs/qa/HWIC_TARGET_GABRIEL_UNSOLICITED.md`; Nordic unsolicited style — memory `nordic-unsolicited-application`). Dialogue-opening, <1 page CL, research+call framing.
- Brand: pick a neutral/personal package (or owner's choice). Photo: dark-bg default `1769681137698.jpg`.
- Apply all design rules. Deliver job-named docx+pdf pair.

## TASK C — Implement modifications in AntCV (generator) + bugfixes
Bake the design rules into the generator so future output needs no hand-fixing. **`workers/docx-worker/src/index.js`** already has: bridge-photo mode (`__bridgePhotoOn`, photo floats on contact para, `ind 2592/-216`), per-field contact rule panel control (`__ruleFor`/`header_rules` payload), invisible header (shipped). Remaining, per the banner-refactor plan (register row 62):
- Drop `" • "` separators (worker `sep` var ~L25769) → icons separate.
- Center name/spec on the contact axis when bridged.
- Photo-center-over-sidebar verify/tune (bridge geometry ~L24933).
- Brand bullet color tracks the package (numbering).
- Banner→body divider: body-cell-top borders, uniform.
- Deploy: `gh workflow run deploy.yml -f target=docx-worker -f mode=deploy -f confirm=docx-worker` (curl `https://docx-worker.karp-gabriel-a.workers.dev/health` first; gating tests must pass). Worker tests: `node test/<diag>.mjs` (harness = POST `/generate`, unzip). Add a regression test per change.
- **Open bugfixes** (register): row 58 MOBILE-BUGS (MOB-001..009, P0 = MOB-008/009), row 60 PANEL-CONTROLS, row 53 CROSS-APP-EXPORT-CONTAMINATION, row 49 SIDEBAR-GROUP-PAGE-BREAK. Preview/Fit-it should measure the live DOM per-device (render-and-measure memory corollary).

## Discipline
Sync-first, never force-push, `git commit -F -` with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Cache-bust protocol for any `pwa/app.js` edit (see CLAUDE.md). PWA auto-deploys on push to main; workers deploy manually. Don't commit real candidate data.
