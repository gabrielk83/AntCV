// AntCV DOCX post-processor — v1.10.1 (Word-safe + circular photo).
// =================================================================
// Two responsibilities:
//
//   1. Strip the `__ANTCV_CONT_<N>__` placeholder runs left behind
//      by generate.js's headingParagraph(). These were intended to be
//      replaced with complex IF/PAGE/PAGEREF fields for "(Cont.)"
//      suffixes on continuation pages — but those fields broke Word's
//      strict parser when nested inside a doubly-nested table-header
//      row. We strip the markers and accept "no (Cont.) suffix" as
//      the right trade-off for Word compatibility.
//
//   2. Rewrite the picture's preset geometry from "rect" (the docx-js
//      hard-coded default) to "ellipse" so the profile photo renders
//      as a circle. docx-js's PresetGeometry class always emits
//      `prst="rect"` regardless of options; the simplest fix is to
//      patch the output XML in place. The replacement only touches
//      `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` inside a
//      `<pic:spPr>` context, so other rect shapes in the document
//      (if any) are untouched.
//
// Bookmarks (`antcv_sec_<N>`) are left in place — harmless.

import { unzipSync, zipSync, strFromU8, strToU8 } from './vendor/fflate.mjs';

const PLACEHOLDER_T_RE = /<w:t(?:\s[^>]*)?>[\s\u00A0]*__ANTCV_CONT_(\d+)__[\s\u00A0]*<\/w:t>/g;
const RUN_OPEN_RE = /<w:r\b[^>]*>/g;
const RUN_CLOSE_TAG = '</w:r>';

// Match a picture's shape-properties block and pull out its prstGeom.
// We only rewrite prstGeom that lives inside a <pic:spPr>...</pic:spPr>
// container — i.e. profile photos and other inline images. Other
// shapes (text boxes, drawings) keep their rect geometry.
const PIC_SP_PR_RE = /<pic:spPr\b[^>]*>([\s\S]*?)<\/pic:spPr>/g;

function stripPlaceholderRuns(documentXml) {
  PLACEHOLDER_T_RE.lastIndex = 0;
  const placeholders = [];
  let pm;
  while ((pm = PLACEHOLDER_T_RE.exec(documentXml)) !== null) {
    placeholders.push({
      tStart: pm.index,
      tEnd: pm.index + pm[0].length,
      contId: pm[1],
    });
  }
  if (placeholders.length === 0) return { xml: documentXml, count: 0 };

  const removals = [];
  for (const p of placeholders) {
    RUN_OPEN_RE.lastIndex = 0;
    let lastOpen = -1;
    let om;
    while ((om = RUN_OPEN_RE.exec(documentXml)) !== null) {
      if (om.index >= p.tStart) break;
      lastOpen = om.index;
    }
    if (lastOpen < 0) continue;

    const closeIdx = documentXml.indexOf(RUN_CLOSE_TAG, p.tEnd);
    if (closeIdx < 0) continue;
    const closeEnd = closeIdx + RUN_CLOSE_TAG.length;

    removals.push({ start: lastOpen, end: closeEnd });
  }

  removals.sort((a, b) => b.start - a.start);
  let out = documentXml;
  for (const r of removals) {
    out = out.substring(0, r.start) + out.substring(r.end);
  }

  return { xml: out, count: removals.length };
}

// Rewrite every <pic:spPr>...<a:prstGeom prst="rect">...</a:prstGeom>...</pic:spPr>
// so the rect geometry becomes "ellipse" — turns inline images into
// circular crops without changing any other shape in the document.
function makePhotosCircular(documentXml) {
  let count = 0;
  const next = documentXml.replace(PIC_SP_PR_RE, (full, inner) => {
    const rewritten = inner.replace(
      /<a:prstGeom\s+prst="rect"\s*>/g,
      () => { count++; return '<a:prstGeom prst="ellipse">'; },
    );
    if (rewritten === inner) return full;
    return full.replace(inner, rewritten);
  });
  return { xml: next, count };
}

/**
 * Post-process a .docx buffer produced by `Packer.toBuffer`.
 *
 * 1. Strips `__ANTCV_CONT_N__` placeholder runs cleanly.
 * 2. Rewrites picture shape geometry from rect → ellipse (circular photo).
 * 3. (v1.12) Injects a diagonal VML watermark behind body text when `opts.watermark` is set.
 *
 * @param {Uint8Array | ArrayBuffer | Buffer} input - raw .docx bytes
 * @param {{ watermark?: string }} [opts] - optional features
 * @returns {{ buffer: Uint8Array, replacements: number, photosCircular: number, watermarked: boolean }}
 */
export function postProcessDocx(input, opts = {}) {
  let bytes;
  if (input instanceof Uint8Array) {
    bytes = input;
  } else if (input instanceof ArrayBuffer) {
    bytes = new Uint8Array(input);
  } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer && Buffer.isBuffer(input)) {
    bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  } else if (input && typeof input.byteLength === 'number') {
    bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  } else {
    throw new Error('postProcessDocx: unsupported input type');
  }

  const files = unzipSync(bytes);

  let replacements = 0;
  let photosCircular = 0;
  let watermarked = false;

  if (files['word/document.xml']) {
    let xml = strFromU8(files['word/document.xml']);

    const placeholderResult = stripPlaceholderRuns(xml);
    if (placeholderResult.count > 0) {
      xml = placeholderResult.xml;
      replacements = placeholderResult.count;
    }

    const photoResult = makePhotosCircular(xml);
    if (photoResult.count > 0) {
      xml = photoResult.xml;
      photosCircular = photoResult.count;
    }

    /* v1.12: diagonal VML watermark behind body text.
       Injects a <w:pict> with a VML shape inside the first <w:p> of
       the body. The shape uses position:absolute + z-index:-251654144
       so it sits BEHIND text rather than pushing layout. Word renders
       it as a translucent grey diagonal banner on every page where
       the body paragraph appears — close enough to a classic Word
       watermark without needing a separate header XML file.
       The mso namespace prefix is declared at the document root by
       Packer; we only emit the v: and o: elements. */
    if (opts && opts.watermark && String(opts.watermark).trim()) {
      const wm = String(opts.watermark).trim().replace(/[<>&"]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;' }[c]));
      const watermarkRun =
        '<w:r><w:rPr><w:noProof/></w:rPr><w:pict>' +
        '<v:shapetype id="_x0000_t136" coordsize="21600,21600" o:spt="136" adj="10800" path="m@7,l@8,m@5,21600l@6,21600e">' +
        '<v:formulas><v:f eqn="sum #0 0 10800"/><v:f eqn="prod #0 2 1"/><v:f eqn="sum 21600 0 @1"/>' +
        '<v:f eqn="sum 0 0 @2"/><v:f eqn="sum 21600 0 @3"/><v:f eqn="if @0 @3 0"/>' +
        '<v:f eqn="if @0 21600 @1"/><v:f eqn="if @0 0 @2"/><v:f eqn="if @0 @4 21600"/>' +
        '<v:f eqn="mid @5 @6"/><v:f eqn="mid @8 @5"/><v:f eqn="mid @7 @8"/>' +
        '<v:f eqn="mid @6 @7"/><v:f eqn="sum @6 0 @5"/></v:formulas>' +
        '<v:path o:extrusionok="f" gradientshapeok="t" o:connecttype="custom" o:connectlocs="@9,0;@10,10800;@11,21600;@12,10800" o:connectangles="270,180,90,0" textpathok="t"/>' +
        '<v:textpath on="t" fitshape="t"/><v:handles><v:h position="#0,bottomRight" xrange="6629,14971"/></v:handles>' +
        '<o:lock v:ext="edit" text="t" shapetype="t"/>' +
        '</v:shapetype>' +
        '<v:shape id="AntCVWatermark" type="#_x0000_t136" style="position:absolute;margin-left:0;margin-top:0;width:468pt;height:117pt;rotation:-30;z-index:-251654144;mso-position-horizontal:center;mso-position-horizontal-relative:margin;mso-position-vertical:center;mso-position-vertical-relative:margin" fillcolor="#D0D0D0" stroked="f">' +
        '<v:fill opacity=".4"/>' +
        '<v:textpath style="font-family:&quot;Arial&quot;;font-size:1pt" string="' + wm + '"/>' +
        '<w10:wrap anchorx="margin" anchory="margin"/>' +
        '</v:shape>' +
        '</w:pict></w:r>';
      // Insert immediately after the first <w:body> opening tag, inside
      // a new <w:p> wrapper so Word's body-paragraph rule is satisfied.
      const bodyOpenIdx = xml.indexOf('<w:body>');
      if (bodyOpenIdx >= 0) {
        const after = bodyOpenIdx + '<w:body>'.length;
        xml = xml.slice(0, after) + '<w:p>' + watermarkRun + '</w:p>' + xml.slice(after);
        watermarked = true;
        // Microsoft Word (unlike LibreOffice/CloudConvert, which renders the PDF)
        // silently DROPS the VML watermark unless the VML namespaces are declared
        // on the <w:document> root. The packer does not declare xmlns:v/o/w10, so
        // the DEMO mark showed only in the PDF, not in Word. Ensure them here.
        xml = xml.replace(/<w:document\b[^>]*>/, (tag) => {
          let t = tag;
          if (!/\bxmlns:v=/.test(t)) t = t.replace(/>$/, ' xmlns:v="urn:schemas-microsoft-com:vml">');
          if (!/\bxmlns:o=/.test(t)) t = t.replace(/>$/, ' xmlns:o="urn:schemas-microsoft-com:office:office">');
          if (!/\bxmlns:w10=/.test(t)) t = t.replace(/>$/, ' xmlns:w10="urn:schemas-microsoft-com:office:word">');
          return t;
        });
      }
    }

    if (placeholderResult.count > 0 || photoResult.count > 0 || watermarked) {
      files['word/document.xml'] = strToU8(xml);
    }
  }

  const out = zipSync(files);

  return { buffer: out, replacements, photosCircular, watermarked };
}
