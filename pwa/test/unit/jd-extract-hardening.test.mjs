// JD-SCAN-HALLUCINATION-001 hardening (1.51.100) — three legs:
//  1. garble detector charset statistics (replacement-char flood, control/PUA
//     ratio, Unicode-letter ratio — language-neutral, unlike the EN/DA
//     common-word check);
//  2. filename↔content echo (fnEcho): if no meaningful filename token appears
//     in the extracted text, warn filename_mismatch(...) — never block;
//  3. visible notices in the upload chip (vision/OCR + mismatch), fed by the
//     caller now propagating `warning` into the upload state.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PWA = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = readFileSync(join(PWA, 'app.src.js'), 'utf8');
const app = readFileSync(join(PWA, 'app.js'), 'utf8');

for (const [name, text] of [['app.src.js', src], ['app.js', app]]) {
  test(`${name}: hardening markers present`, () => {
    assert.ok(text.includes('filename_mismatch('), `${name}: fnEcho marker missing`);
    assert.ok(text.includes('Read visually (OCR)'), `${name}: OCR notice missing`);
    assert.ok(text.includes('57344'), `${name}: charset-statistics block (PUA range) missing`);
    // caller must forward the warning into the upload state
    assert.ok(/warning:\s*w\s*}/.test(text) || text.includes('fileName:e.name,warning:w}'), `${name}: caller does not propagate warning`);
  });
}

// ---- detector replica (keep in sync with app.src.js f()) ----
function garbled(e) {
  if (
    e.length < 50 || e.startsWith('%PDF-') || e.includes('\nobj\n') || e.includes('\nendobj') ||
    /[A-Za-z0-9+/]{60,}/.test(e) ||
    (e.match(/\b(stream|endstream|xref|startxref|obj|endobj|trailer)\b/g) || []).length > 3 ||
    (e.match(/\(cid:\d+\)/g) || []).length > 3
  ) return true;
  if ((e.match(/�/g) || []).length > 10) return true;
  {
    const c = e.replace(/\s/g, '');
    if (c.length > 200) {
      let letters = 0, ctrl = 0;
      for (const ch of c) {
        if (/[\p{L}\p{N}]/u.test(ch)) letters++;
        const cc = ch.codePointAt(0);
        if (cc < 32 || (cc >= 57344 && cc <= 63743)) ctrl++;
      }
      if (ctrl / c.length > 0.05) return true;
      if (letters / c.length < 0.35) return true;
    }
  }
  const t = (e.match(/\b(the|and|or|of|to|in|is|for|with|on|at|that|this|are|as|be|by|we|our|you|your|will|have|from|will|can|not|but|all|any|new|one|out|use|how|its|who|has|had|was|were|been|og|er|en|et|den|det|der|som|af|til|på|med|for|ikke|har|kan|skal|vil|jeg|du|vi|de)\b/gi) || []).length;
  const n = (e.match(/\S+/g) || []).length;
  if ((n > 80 && t / n < 0.03) || (e.match(/[a-zA-Z][\[\]\\`<>{}~^_|][a-zA-Z]/g) || []).length > 25) return true;
  const o = (e.match(/\b[A-Z]{4,}\b/g) || []).length;
  return n > 100 && o / n > 0.4;
}

test('detector: punctuation/control garble (NIL-shaped, letters < 35%) is flagged', () => {
  const junk = ('!"#$%&\'()*+,-. /01:;<=> ?@ ' + ' ').repeat(40);
  assert.equal(garbled(junk), true);
});

test('detector: replacement-char flood is flagged', () => {
  const good = 'We are looking for an engineer to join the team and work with our partners. ';
  assert.equal(garbled(good.repeat(3) + '�'.repeat(12)), true);
});

test('detector: private-use-area glyph soup is flagged', () => {
  const pua = Array.from({ length: 300 }, (_, i) => String.fromCodePoint(57344 + (i % 100))).join('');
  assert.equal(garbled(pua), true);
});

test('detector: Danish JD is NOT flagged', () => {
  const da = 'Vi søger en erfaren ingeniør til vores optikafdeling i København. Du vil arbejde med design og validering af optiske komponenter, og du skal kunne samarbejde med leverandører og interne teams om krav, sporbarhed og kvalitet i hele produktudviklingen. Der er tale om en fuldtidsstilling med gode muligheder for faglig udvikling og et stærkt kollegialt miljø.';
  assert.equal(garbled(da), false);
});

test('detector: Hebrew JD is NOT flagged (language-neutral letter ratio)', () => {
  const he = 'אנחנו מחפשים מהנדס אופטיקה מנוסה להצטרף לצוות הפיתוח שלנו בתל אביב. התפקיד כולל אפיון רכיבים אופטיים, עבודה מול ספקים, כתיבת דרישות ובדיקות קבלה, ושיתוף פעולה עם צוותי חומרה ותוכנה. נדרש ניסיון של חמש שנים לפחות בתחום, יכולת עבודה עצמאית ותקשורת מצוינת בכתב ובעל פה. המשרה מלאה וממוקמת במרכז הארץ עם אפשרות לעבודה היברידית.';
  assert.equal(garbled(he), false);
});

test('detector: Chinese JD is NOT flagged', () => {
  const zh = '我们正在寻找一位经验丰富的光学工程师加入我们的研发团队。您将负责光学元件的设计与验证，与供应商和内部团队合作，确保需求、可追溯性和质量贯穿整个产品开发过程。要求具有五年以上相关经验，能够独立工作，并具备良好的书面和口头沟通能力。这是一个全职职位，工作地点在上海，提供有竞争力的薪酬和良好的职业发展机会。'.repeat(2);
  assert.equal(garbled(zh), false);
});

// ---- fnEcho replica (keep in sync with app.src.js h() fnEcho) ----
function fnEcho(fileName, result) {
  const base = String(fileName || '').replace(/\.[a-z0-9]+$/i, '');
  const stop = /^(?:jd|job|description|posting|position|vacancy|opening|role|copy|final|draft|version|the|and|for|with|som|til|hos|med|stilling|jobopslag)$/i;
  const toks = (base.match(/[\p{L}\p{N}]{4,}/gu) || []).filter((t) => !stop.test(t) && !/^\d+$/.test(t));
  if (toks.length && result.text) {
    const low = result.text.toLowerCase();
    if (!toks.some((t) => low.includes(t.toLowerCase()))) {
      result.warning = (result.warning || '') + '; filename_mismatch(' + toks.slice(0, 4).join(',') + ')';
    }
  }
  return result;
}

test('fnEcho: NIL filename vs real NIL text → no mismatch', () => {
  const r = fnEcho('Nanooptics Prototyping Engineer - NIL Technology.pdf',
    { text: 'NIL Technology is looking for a Nanooptics Prototyping Engineer in Kongens Lyngby.', warning: null });
  assert.equal(r.warning, null);
});

test('fnEcho: NIL filename vs Terma text → mismatch flagged', () => {
  const r = fnEcho('Nanooptics Prototyping Engineer - NIL Technology.pdf',
    { text: 'Terma builds electro-optical systems for defence and aerospace programmes.', warning: null });
  assert.match(String(r.warning), /filename_mismatch\(/);
});

test('fnEcho: generic filename ("JD final.pdf") → never a false mismatch', () => {
  const r = fnEcho('JD final.pdf', { text: 'Any extracted text at all.', warning: null });
  assert.equal(r.warning, null);
});
