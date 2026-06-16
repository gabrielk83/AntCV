# WM bucket — AI-notice last-page anchoring: fix spec

Generated 2026-06-16. Scope: WM-001, WM-002, WM-004, WM-005 (+ the active
`AI-WATERMARK-EXPORT-LOCATION-001`). WM-003 is owner-confirmed resolved — out of scope.

Verified against deployed code: docx-worker 1.14.74 (`workers/docx-worker/src/index.js`),
preview sidecar `pwa/antcv-watermark-page-anchor-341.js` (sha 3e2be0c), Pages 69aec3a1.

Owner decision (2026-06-16): the AI notice anchors to the **actual bottom of the last page**,
uniformly. NOT beside the signature. The CV keeps its dynamic horizontal corner (left/right by
gap); the CL stays bottom-right.

---

## 1. Current state — the three mechanisms

| # | Mechanism | Where | Anchoring today |
|---|---|---|---|
| 1 | DEMO watermark | `postProcessDocx` → `header1.xml`, VML `AntCVWatermark`, rotated -30°, centred | Page-anchored via `sectPr` headerReference → **every page**. Out of scope. |
| 2 | AI notice — CV (two-column) | worker `buildTwoColumnDocument` / `buildAiDisclosureHangingTextbox` | A flowed `Paragraph` appended to ONE column (chosen by `ctx.aiWmSide`). Rides that column's content end. |
| 3 | AI notice — CL (linear) | worker `buildLinearDocument` | 1-page: disclosure on the signature line via a RIGHT tab stop (`PAGE_W-400`). 2-page (`jd_questions`): `buildAiDisclosureHangingTextbox` at the end of the page-2 signature block. Both flowed. |

Preview (sidecar) already does the RIGHT thing for all of them: hides every non-last-page
instance, absolute-positions the survivor at the page-box bottom corner (scale-aware for mobile
zoom), strips the box (WM-003), recolours (WM-002), and forwards the CV corner to the worker as
`ai_wm_side` via `stashWmSide`/`window.__antcvAiWmSide`.

## 2. The gap (preview is correct; export is not)

The preview sidecar's own header comment encodes a FALSE assumption:
> "DOCX worker v1.14.13 already renders the AI disclosure on the last page as a styled paragraph
> anchored to the page flow."

"Anchored to the page flow" is the contradiction. The worker emits a **flowed paragraph**, so:

- **WM-001 / WM-004** (anchor to last-page bottom, CV+CL): preview ✓, export ✗. When content is
  short the export paragraph floats mid-page; the preview shows it pinned to the bottom →
  divergence (= the active `AI-WATERMARK-EXPORT-LOCATION-001`).
- **WM-002** (corner + clearance): preview ✓ (chooseCorner + ~16/18px insets), export ✗ (no
  anchor → no inset concept).
- **WM-005** (last page only): preview ✓ (hides all but last-page). Export: **CV is the
  violation** — the notice is on a COLUMN that may end on page 1 of a 2-page CV. CL 2-page is
  already correct; CL 1-page is trivially correct.

## 3. Why a footer can't carry it (the apples-to-oranges resolution)

Investigated and ruled out:

- Both builders emit a **single Word section** (`sections: [ { ... } ]`), margins `0,0,0,0` (CV).
  No per-page section split exists, so Word's first/last-page section-footer variants are not
  available without restructuring the whole document into multiple sections (high blast radius,
  breaks pagination).
- The worker's OWN comment (`buildTwoColumnDocument` ~26947): "Word header parts serialize EMPTY
  through this tree-shaken bundle ... so BOTH corner choices render through the FOOTER in the
  export." That is why page numbers go through `footers.default` and why the DEMO mark is injected
  as RAW header XML in `postProcessDocx` AFTER the docx lib runs.
- `footers.default` repeats on **every** page (that's how page numbers appear on all pages). So a
  footer-borne AI notice would re-violate WM-005.

Therefore: a docx-lib footer/header is the wrong carrier. The right carrier is the same layer the
DEMO mark already proves survives CloudConvert/LibreOffice → **raw VML/anchored-shape injection in
`postProcessDocx`, targeted at the LAST page** instead of the section header.

## 4. The fix — one worker change, two faces

### 4.1 Remove the flowed AI notice from BOTH builders
- CV (`buildTwoColumnDocument`): drop the `aiDisclosurePara` append. Keep `aiWmSide` plumbing — it
  still chooses the horizontal corner.
- CL (`buildLinearDocument`):
  - 1-page branch: remove the signature-line tab-stop disclosure (the "ITEM-2" `TextRun` with the
    `\t AI-assisted…` text). Per owner: notice goes to the bottom, not beside the signature.
  - 2-page branch: remove the `buildAiDisclosureHangingTextbox(ctx,{context:"linear"})` append on
    the page-2 signature block.
- This leaves the signature blocks clean in both docs.

### 4.2 Inject the notice as a last-page-anchored VML text frame in `postProcessDocx`
Reuse the DEMO mark's anchoring technique, with three changes:
1. **Aim at the bottom corner, not centre**: in the shape `style`, set
   `mso-position-vertical:bottom; mso-position-vertical-relative:margin` and
   `mso-position-horizontal:{left|right}; mso-position-horizontal-relative:margin`. No rotation,
   1× scale, text-only (WM-003 already met by using a plain textpath/textbox with `stroked="f"`,
   no fill).
2. **Last page only (WM-005)**: the DEMO mark attaches to the single `sectPr` headerReference →
   every page. The AI notice must NOT. Instead anchor it to the **last page's content**. The CV
   builds explicit per-page tables (`makePageTable` per `p`, separated by `pageBreakBefore`), so
   the final page table is identifiable in `document.xml`. Inject the anchored shape into a
   run inside the LAST page's last paragraph (anchory:page/margin keeps it page-positioned, but it
   only EXISTS on the last page → renders once). For the CL, inject into the last paragraph of the
   body (1-page) or the page-2 block (2-page).
3. **Horizontal corner**: CV honours `opts.aiWmSide` (forward `payload.ai_wm_side` into
   `postProcessDocx` opts, same as `headerBg` is forwarded today). CL = always `right`.

### 4.3 Clearance (WM-002)
Bottom inset ≈ 14pt and side inset ≈ 14pt in the shape margins, matching the preview's
DEFAULT_INSET (18px ≈ 14pt) so preview and export read identically.

## 5. Preview parity
No behavioural change needed in `antcv-watermark-page-anchor-341.js` — it already does the target
behaviour. Update only its stale header comment (the "anchored to the page flow" sentence) to
state the worker now injects a last-page VML frame. Keep `stashWmSide`/`ai_wm_side` forwarding for
the CV corner.

## 6. Acceptance (must hold in Preview + DOCX + PDF, desktop + mobile)
1. 1-page CV: notice in one bottom corner, last (only) page, not over text. Corner = larger-gap side.
2. 2-page CV: notice ONLY on page 2, bottom corner. (WM-005 — the current violation.)
3. 3-page CV: notice ONLY on page 3.
4. 1-page CL: notice bottom-RIGHT, last page, NOT on the signature line.
5. 2-page CL (jd_questions): notice ONLY on page 2, bottom-right.
6. Reflow test: add/remove a role so a page boundary shifts → notice stays in the last-page bottom
   corner in both preview and a fresh PDF (no mid-page float).
7. WM-003 regression: no border/fill/shadow in any of the above.
8. Preview corner === export corner for every CV case (closes AI-WATERMARK-EXPORT-LOCATION-001).

## 7. Risk + verification notes
- The ONLY real risk is DOCX→PDF survivability of a bottom-anchored VML text frame through
  CloudConvert/LibreOffice. The DEMO mark proves an anchored VML shape survives; the delta is
  position (bottom vs centre) and scope (last page vs all). Verify with a real CloudConvert PDF,
  not just the DOCX.
- `postProcessDocx` is the inlined bundle copy — no build step ([[docx-worker-bundle-no-build]]).
  Edit `workers/docx-worker/src/index.js` directly; manual `wrangler deploy`; one deployer.
- Mirror nothing to proxy/demo-proxy — this is docx-worker only.
- Add a unit test asserting: (a) no `AI-assisted` run remains in the flowed body of either builder
  output; (b) exactly ONE anchored AI-notice shape exists; (c) it is inside the last page's XML.

## 8. Sequencing
WM-001 §4.1+§4.2 is the keystone — it satisfies WM-001, WM-002, WM-004, WM-005, and the active
export-location bug at once. WM-002 clearance (§4.3) is a parameter on the same shape. Do them in
one change; verify the 8 acceptance cases before closing any WM row.
