// hdr-type-controls.test.mjs
// ============================================================
// HDR-TYPE-CONTROLS-001 (owner 2026-07-29) — the Font sizes (pt) panel controls
// SIZE and LETTER SPACING for the five identity lines, in all modes, on the CV
// and the CL, in preview AND export:
//   Name · Specialisation · Application line · Contact line · Slogan
// Specialisation and Application are SEPARATE rows now (they no longer sit in
// the same place: the spec stays in the header band, the application line sits
// under the slogan on the cover letter). Letter spacing steps by 0.05pt —
// exactly one DOCX w:spacing unit — signed, expansion positive.
//
// Owner requirement "make sure nothing prevents the user from controlling these
// values" is the reason for the whitelist / override assertions below: every
// layer that could silently drop or outrank a panel value is pinned here.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const here = (p) => new URL(p, import.meta.url);
const app = await readFile(here('../../app.js'), 'utf8');
const src = await readFile(here('../../app.src.js'), 'utf8');
const cph = await readFile(here('../../antcv-copenhagen-v2-001.js'), 'utf8');
const docxClient = await readFile(here('../../antcv-docx-client.js'), 'utf8');
const gate = await readFile(here('../../antcv-pdf-preview-gate.js'), 'utf8');
const index = await readFile(here('../../index.html'), 'utf8');

const SIZE_KEYS = ['nameSize', 'specialisation', 'applicationSize', 'contactSize', 'sloganSize'];
const TRACK_KEYS = ['nameTrack', 'specTrack', 'applicationTrack', 'contactTrack', 'sloganTrack'];

// ---------------------------------------------------------------- state + panel

test('every size and track key ships in the app.js defaults', () => {
  for (const k of [...SIZE_KEYS, ...TRACK_KEYS]) {
    assert.ok(app.includes(k), 'app.js carries ' + k);
  }
  // the two new sizes default to the values the EXPORT already drew, so the
  // panel opens at parity instead of moving the document on first paint
  assert.ok(app.includes('applicationSize:10.5'), 'applicationSize defaults to the export 10.5pt');
  assert.ok(app.includes('sloganSize:11'), 'sloganSize defaults to the export 11pt');
  // tracks are DELTAS: 0 must mean "unchanged"
  for (const k of TRACK_KEYS) assert.ok(app.includes(k + ':0'), k + ' defaults to 0');
});

test('the tracking stepper rounds to 0.05pt and is clamped', () => {
  assert.ok(app.includes('__antcvTrkStep=(e,t)=>'), 'stepper exists');
  assert.ok(app.includes('Math.round(20*((Number(n[e])||0)+t))/20'), 'rounds to 0.05 (1/20 pt)');
  assert.ok(app.includes('Math.max(-2,Math.min(4,Math.round(20*'), 'clamped to [-2pt, +4pt]');
  // persisted exactly like the size stepper, so every consumer sees it at once
  assert.ok(/__antcvTrkStep=[\s\S]{0,220}L\.set\("fontSizes",o\)/.test(app), 'writes localStorage fontSizes');
  assert.ok(/__antcvTrkStep=[\s\S]{0,260}fo\(\{fontSizes:o\}\)/.test(app), 'writes styleConfig.fontSizes');
});

test('the panel splits Specialisation from Application and adds Slogan', () => {
  assert.ok(!app.includes('"Specialisation / Application","specialisation"'), 'the fused row is gone');
  assert.ok(app.includes('["Specialisation","specialisation"'), 'Specialisation is its own row');
  assert.ok(app.includes('["Application line","applicationSize"'), 'Application line is its own row');
  assert.ok(app.includes('["Slogan","sloganSize"'), 'Slogan has a row');
  assert.ok(app.includes('["Name","nameSize"'), 'Name row kept');
  assert.ok(app.includes('["Contact line","contactSize"'), 'Contact line row kept');
});

test('each identity row carries a signed 0.05 letter-spacing control', () => {
  for (const k of TRACK_KEYS) {
    assert.ok(app.includes('"' + k + '"]'), k + ' is wired to a panel row');
  }
  assert.ok(app.includes('__antcvTrkStep(__tk,-.05)'), 'compression button steps -0.05');
  assert.ok(app.includes('__antcvTrkStep(__tk,.05)'), 'expansion button steps +0.05');
  assert.ok(app.includes('(e>0?"+":e<0?"−":"±")'), 'the readout is signed');
  assert.ok(app.includes('"Font sizes (pt) + letter spacing — tap to expand"'), 'the panel says so');
});

// ---------------------------------------------------------------- render legs

test('the live preview band reads the tracking for name, spec and contact', () => {
  assert.ok(app.includes('fontSize:(ca.nameSize||16)*(96/72),letterSpacing:__antcvTrkCss("nameTrack")'), 'band name');
  assert.ok(app.includes('fontSize:(ca.specialisation||ur||11)*(96/72),letterSpacing:__antcvTrkCss("specTrack")'), 'band spec');
  assert.ok(app.includes('fontSize:((ca.contactSize||10)+1)*(96/72),letterSpacing:__antcvTrkCss("contactTrack")'), 'band contact');
});

test('the header-as-sections leg (figure layouts) reads the same tracking', () => {
  // preview
  assert.ok(app.includes('fontSize:r(e),letterSpacing:__antcvTrkCss("nameTrack")'), 'preview name_block');
  assert.ok(app.includes('fontSize:r(n),letterSpacing:__antcvTrkCss("specTrack")'), 'preview spec_block');
  assert.ok(app.includes('fontSize:r(o),letterSpacing:__antcvTrkCss("contactTrack")'), 'preview contact_line');
  // HTML export
  assert.ok(app.includes('font-size:${p.nameSize}pt;letter-spacing:${__antcvTrackPt("nameTrack")}pt'), 'export name_block');
  assert.ok(app.includes('font-size:${p.specialisation}pt;letter-spacing:${__antcvTrackPt("specTrack")}pt'), 'export spec_block');
  assert.ok(app.includes('font-size:${p.contactSize}pt;letter-spacing:${__antcvTrackPt("contactTrack")}pt'), 'export contact_line');
});

test('the CL slogan and application line are no longer hard-pinned', () => {
  // preview: both were literal px (15 / 11) with em tracking and unreachable
  assert.ok(!app.includes('fontSize:15,fontWeight:700,letterSpacing:"0.08em"'), 'preview slogan unpinned');
  assert.ok(!app.includes('fontSize:11,fontWeight:600,letterSpacing:"0.02em"'), 'preview app line unpinned');
  assert.ok(app.includes('fontSize:(Number(ca.sloganSize)||11)*(96/72)'), 'preview slogan reads the panel');
  assert.ok(app.includes('fontSize:(Number(ca.applicationSize)||10.5)*(96/72)'), 'preview app line reads the panel');
  assert.ok(app.includes('__antcvTrackPx("sloganTrack")'), 'preview slogan tracking');
  assert.ok(app.includes('__antcvTrackPx("applicationTrack")'), 'preview app-line tracking');
  // HTML export
  assert.ok(!app.includes("font-size:11pt;font-weight:700;letter-spacing:.08em"), 'export slogan unpinned');
  assert.ok(!app.includes("font-size:10.5pt;font-weight:600;letter-spacing:.02em"), 'export app line unpinned');
  assert.ok(app.includes('__antcvFontPt("sloganSize",11)'), 'export slogan reads the panel');
  assert.ok(app.includes('__antcvFontPt("applicationSize",10.5)'), 'export app line reads the panel');
});

test('PREVIEW/EXPORT PARITY: the app line is the same size on both surfaces', () => {
  // it used to be 11px in preview and 10.5pt (14px) in export — a 27% split
  assert.ok(app.includes('(Number(ca.applicationSize)||10.5)'), 'preview default 10.5pt');
  assert.ok(app.includes('__antcvFontPt("applicationSize",10.5)'), 'export default 10.5pt');
});

test('the in-app DOCX stylesheet emits w:spacing for the header runs', () => {
  assert.ok(app.includes('__tkN=Math.round(20*__antcvTrackPt("nameTrack"))'), 'name twips');
  assert.ok(app.includes('__tkS=Math.round(20*__antcvTrackPt("specTrack"))'), 'spec twips');
  assert.ok(app.includes('__tkC=Math.round(20*__antcvTrackPt("contactTrack"))'), 'contact twips');
  assert.ok(app.includes('__tkX=e=>e?`<w:spacing w:val="${e}"/>`:""'), 'zero emits nothing');
});

// ------------------------------------------------- nothing may outrank the user

test('the copenhagen measured fit yields to the panel tracking', () => {
  // the fit emits letter-spacing !important for the name; the panel delta has to
  // be emitted AFTER it or the user cannot move the name tracking at all
  assert.ok(cph.includes("HDR-TYPE-CONTROLS-001"), 'the sidecar knows about the controls');
  assert.ok(cph.includes("__trk('nameTrack')"), 'name track read');
  assert.ok(cph.includes("__trk('specTrack')"), 'spec track read');
  assert.ok(cph.includes("__trk('contactTrack')"), 'contact track read');
  const fitAt = cph.lastIndexOf("if (__fit.specFs != null)");
  const trkAt = cph.lastIndexOf("__tkName");
  assert.ok(trkAt > fitAt, 'the panel rules are emitted after the fit rules (source order wins)');
});

test('the DOCX payload whitelist carries every new key', () => {
  for (const k of ['applicationSize', 'sloganSize', ...TRACK_KEYS]) {
    assert.ok(docxClient.includes("'" + k + "'"), 'buildFontSizes forwards ' + k);
  }
});

test('the fallback export path reads the canonical fontSizes key', () => {
  assert.ok(gate.includes("pi.fontSizes || j('fontSizes', null)"), 'falls back to localStorage fontSizes');
});

// ---------------------------------------------------------------- mirror lock

// pwa/app.src.js is the de-minified maintained mirror. Its short names come
// from an OLDER minifier pass, so mirroring is by MEANING, not byte-for-byte
// (the fontSizes state is `Yr` there and `ca` in app.js). What must hold is
// COVERAGE: every key and helper this feature introduced exists in both files,
// the same number of times. Counting catches the failure the prose can't — a
// site mirrored in one bundle but forgotten in the other.
test('mirror lock: app.src.js carries every key and helper, at the same count', () => {
  for (const k of [...SIZE_KEYS.filter((x) => x !== 'specialisation' && x !== 'nameSize' && x !== 'contactSize'), ...TRACK_KEYS]) {
    assert.equal(src.split(k).length - 1, app.split(k).length - 1, k + ': count must match app.js');
  }
  for (const h of ['__antcvTrkStep', '__antcvTrkCss', '__antcvTrackPx', '__antcvFontPt', '__antcvTrkPtOf', '__tkX']) {
    assert.equal(src.split(h).length - 1, app.split(h).length - 1, h + ': count must match app.js');
  }
});

test('mirror lock: app.src.js splits the rows and drives the same steppers', () => {
  assert.ok(!/\["?"?Specialisation \/ Application"/.test(src.replace(/\s+/g, ' ')), 'the fused row is gone from the source too');
  for (const label of ['"Specialisation"', '"Application line"', '"Slogan"', '"All Identity Lines ↔"']) {
    assert.ok(src.includes(label), 'app.src.js carries the ' + label + ' row');
  }
  assert.ok(/__antcvTrkStep\(__tk, -0\.05\)/.test(src), 'source compression button steps -0.05');
  assert.ok(/__antcvTrkStep\(__tk, 0\.05\)/.test(src), 'source expansion button steps +0.05');
  assert.ok(/Math\.round\(20 \* \(\(Number\(n\[e\]\) \|\| 0\) \+ t\)\) \/ 20/.test(src), 'source stepper rounds to 0.05');
});

test('mirror lock: app.src.js unpins the CL slogan and application line too', () => {
  assert.ok(!src.includes('letterSpacing: "0.08em"'), 'source slogan unpinned');
  assert.ok(!src.includes('letterSpacing: "0.02em"'), 'source app line unpinned');
  assert.ok(src.includes('(Number(Yr.sloganSize) || 11)'), 'source slogan reads the panel');
  assert.ok(src.includes('(Number(Yr.applicationSize) || 10.5)'), 'source app line reads the panel');
});

// The rationale comments only survive in app.src.js — minification strips them,
// so this file is the sole home of ~376 ticket-marked design decisions. Nothing
// may regenerate it from app.js: that would delete all of them.
test('mirror lock: app.src.js remains the rationale home (never regenerate it)', () => {
  const marks = (s) => new Set([...s.matchAll(/\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+){1,5}-\d{3}[a-z]?\b/g)].map((m) => m[0]));
  const inSrc = marks(src), inApp = marks(app);
  const missing = [...inApp].filter((m) => !inSrc.has(m));
  assert.deepEqual(missing, [], 'every ticket marker in app.js must also appear in app.src.js');
  assert.ok(inSrc.size > 300, 'app.src.js should carry the full rationale set, got ' + inSrc.size);
  assert.ok(inSrc.size > inApp.size, 'app.src.js documents strictly more than the minified bundle can');
});

// ---------------------------------------------------------------- cache bust

test('the changed assets are cache-busted to the same version', () => {
  const m = index.match(/app\.src = 'app\.js\?v=([^']+)'/);
  assert.ok(m, 'app.js carries a ?v');
  const v = m[1];
  assert.ok(index.includes("window.ANTCV_VERSION = '" + v + "'"), 'the boot seed matches app.js');
  for (const f of ['antcv-copenhagen-v2-001.js', 'antcv-pdf-preview-gate.js', 'antcv-docx-client.js']) {
    assert.ok(index.includes(f + '?v=' + v), f + ' busted to ' + v);
  }
});
