// row-write-guard.js — APP-ROW-WRITE-GUARD-001 (owner 2026-11-03, D1 application 3524)
//
// At 2026-11-01 16:55:11Z the ASSA ABLOY editor state (sections, meta, subtitle) was
// PUT into application 3524, the Ambu row: the client's auto-sync targeted a stale
// active-row id and its company check trusted a local stamp. The server knows the
// row's real employer and role, so it refuses a CONTENT write (cv_sections /
// cl_sections / meta) whose employer AND role both differ from the row's. A rename
// (jd_company / jd_role only) always passes, as does a write where the employer OR the
// role still matches. body.allow_company_change === true is the deliberate override.
//
// The matcher is a port of pwa/antcv-company-match.js (COMPANY-MATCH-001);
// tests/row-write-guard.test.mjs fails if the two disagree.

const GENERIC = new Set(('the and of for a an de og i at group company companies corporation corp holding holdings ' +
  'international global technologies technology systems solutions industries services career careers ' +
  'opportunities opportunity jobs job vacancy vacancies position role experienced senior engineer manager ' +
  'denmark danmark europe emea emeia nordic nordics scandinavia opening openings danish swedish norwegian ' +
  'finnish german european american scandinavian royal national university institute copenhagen kobenhavn ' +
  'aarhus malmo').split(' '));
const LEGAL = /\b(a\/s|aps|a\.s\.|as|ab|asa|oy|oyj|ag|gmbh|kg|se|sa|s\.a\.|sas|srl|spa|bv|b\.v\.|nv|n\.v\.|plc|ltd|limited|llc|inc|inc\.|co|co\.|corp\.|l\.p\.)\b\.?/gi;
const UNSOL = /^(unsolicited|open\s+application|n\/?a|uopfordret(\s+ansøgning)?|åben\s+ansøgning)$/i;

export function fold(s) {
  s = String(s == null ? '' : s);
  try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (_) { /* keep */ }
  return s.toLowerCase().replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/å/g, 'a').replace(/ß/g, 'ss');
}
export function clean(s) {
  return fold(s).replace(LEGAL, ' ').replace(/[^a-z0-9&+]+/g, ' ').replace(/\s+/g, ' ').trim();
}
export function isTargeted(company) {
  const c = String(company == null ? '' : company).trim();
  return !!c && !UNSOL.test(c) && !!clean(c);
}
export function tokens(company) {
  const raw = String(company == null ? '' : company);
  const out = [];
  const push = (v) => {
    v = clean(v);
    if (!v || v.length < 2 || out.includes(v) || /^[0-9 ]+$/.test(v)) return;
    if (v.split(' ').every((w) => GENERIC.has(w))) return;
    out.push(v);
  };
  const paren = raw.match(/\(([^)]{2,60})\)/g) || [];
  const base = raw.replace(/\([^)]*\)/g, ' ');
  base.split(/\s*[:|–—]\s*|\s+-\s+|,/).forEach((part) => {
    const c = clean(part);
    if (!c) return;
    push(c);
    const words = c.split(' ').filter((w) => !GENERIC.has(w));
    if (words.length > 1 && words[0].length >= 4) push(words[0]);
    if (words.length && words.join(' ') !== c) push(words.join(' '));
  });
  paren.forEach((p) => push(p.slice(1, -1)));
  return out;
}
export function sameCompany(a, b) {
  const ta = tokens(a), tb = tokens(b);
  if (!ta.length && !tb.length) return true;
  if (!ta.length || !tb.length) return false;
  for (const x of ta) {
    for (const y of tb) {
      if (x === y || (' ' + x + ' ').includes(' ' + y + ' ') || (' ' + y + ' ').includes(' ' + x + ' ')) return true;
    }
  }
  return false;
}
function roleWords(r) {
  return clean(r).split(' ').filter((w) => w.length >= 3 && !/^(and|the|for|med|til|with)$/.test(w));
}
export function sameRole(a, b) {
  const ca = clean(a), cb = clean(b);
  if (ca === cb) return true;
  if (!ca || !cb) return false;
  if ((' ' + ca + ' ').includes(' ' + cb + ' ') || (' ' + cb + ' ').includes(' ' + ca + ' ')) return true;
  const wa = roleWords(a), wb = roleWords(b);
  if (!wa.length || !wb.length) return false;
  const hit = wa.filter((w) => wb.includes(w)).length;
  return hit / Math.min(wa.length, wb.length) >= 0.6;
}

// The identities a PUT body claims; [] for a non-content write (a rename).
export function claimsOf(body) {
  if (!body || typeof body !== 'object') return [];
  const content = body.cv_sections !== undefined || body.cl_sections !== undefined || body.meta !== undefined;
  if (!content) return [];
  const out = [];
  const m = body.meta && typeof body.meta === 'object' ? body.meta : null;
  if (m && (m.company || m.role)) out.push({ company: String(m.company || ''), role: String(m.role || '') });
  if (typeof body.jd_company === 'string' && body.jd_company.trim()) {
    out.push({ company: body.jd_company, role: String(body.jd_role || (m && m.role) || '') });
  }
  return out;
}

// null when the write may proceed, else { company, role } of the foreign claim.
export function rowWriteMismatch(row, body) {
  if (!row || !body || body.allow_company_change === true) return null;
  if (!isTargeted(row.jd_company)) return null;
  for (const c of claimsOf(body)) {
    if (!isTargeted(c.company)) continue;
    if (sameCompany(row.jd_company, c.company) || sameRole(row.jd_role, c.role)) continue;
    return c;
  }
  return null;
}
