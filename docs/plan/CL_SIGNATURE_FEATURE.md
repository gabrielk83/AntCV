# CL Signature image feature (owner 2026-06-28)

Upload an image signature appended to the END of the cover letter. In-memory like the profile
photo. Hideable. Align LEFT/CENTER/RIGHT (default CENTER). Size adjustable. Controls = an
expandable/collapsible block in the LAYOUT tab, UNDER the photo/figure controls. NOTHING sticky.

## Storage (standalone localStorage keys — survive cloud-restore, see sidecar-prefs-clobber-hazard)
- `antcv:signatureB64`    — data-URL / base64 of the uploaded image
- `antcv:signatureAlign`  — 'left' | 'center' | 'right' (default 'center')
- `antcv:signatureSize`   — width px (default 160)
- `antcv:signatureAspect` — image height/width ratio, computed at UPLOAD via `new Image()` (so the
  export preserves the real ratio; worker height = width × aspect). default 0.4 if absent.
- `antcv:signatureHidden` — '1' | '0' (default '0')

## Layers + integration points
1. **Export — worker** `workers/docx-worker/src/index.js` `buildLinearDocument`: after the typed-name
   Paragraph (~25092-25110) push an inline `ImageRun` Paragraph, alignment from `pi.signature_align`,
   `transformation {width: signature_size_px, height: width×signature_aspect}`, try/catch skip on bad
   image. Reuse `base64ToUint8Array` / `detectImageType` / `ImageRun`. **[DONE 1.14.93]**
2. **Export — docx-client** `pwa/antcv-docx-client.js` buildPayload personal_info (~646): forward
   `signature_b64 / signature_align / signature_size_px / signature_aspect` from the localStorage keys,
   CL-only, only when present + not hidden. **[DONE 1.14.93 batch]**
3. **Layout control** — a SIDECAR (`antcv-cl-signature-control.js`, NO app.js mirror) that injects an
   upload + Hidden + 3 align buttons + size slider into the Layout tab UNDER the photo controls,
   collapsible (extend antcv-photo-control-collapse.js pattern), computes+stores the aspect on upload,
   its OWN marker attr (NOT the photo's), single mount site → no sticky leak (the photo control's
   sticky bug was a DUPLICATE leaking to another tab — render once, no persistent display styles on
   shared ancestors). **[TODO]**
4. **Preview render** — `app.src.js` CL closure/sign-off HTML string (~26679-26696, the `srcdoc`
   builder; rebuilt every render so it's robust): append `<img>` after the name `<td>`, align via
   text-align, width via size, height auto (preserves aspect), skipped when hidden/no b64. Needs the
   app.js mirror. **[TODO]**

## Build order
Export (1+2) first — self-contained, verify via document.xml diag (inject signature_b64 → trailing
image paragraph present, alignment correct). Then control (3, sidecar). Then preview (4, app.js mirror).
Each verified before the next. Cache-bust quintet on every PWA file; worker deploy for 1.

## No-sticky note
The photo control "stuck on the Account tab" = a duplicate leaked into another panel. The signature
control must mount ONCE (in the Layout control tree only), use its own data-marker, and set no
persistent inline `display` on shared/ancestor nodes.
