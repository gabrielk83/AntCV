// JOB-TRACKER-001 Phase 3 — "add strong-fit uploads to the weekly" watcher.
// When a JD is uploaded through the REGULAR uploader for generation (the app
// writes it to localStorage 'antcv:lastJdText'), score it against the user's
// cluster top-20 (the same demand signal used elsewhere) + the weekly tracker's
// domain. If it's a strong fit and not already tracked, offer to add it to the
// weekly list. Pure island behavior — no app.js edit.

import { getDoc, putDoc, fetchClusterTop20, isAuthed, type Row, type TrackerDoc } from './api';

const NAVY = '#1F3864';
const POLL_MS = 2500;
const STUB = /^(GENERAL CV|Manual save)/i;

let lastSeen = '';
let offeredHashes = new Set<string>();

function hash(s: string): string { return String(s.length) + ':' + s.slice(0, 80) + s.slice(-40); }
function tokens(s: string): Set<string> {
  return new Set((s.toLowerCase().match(/[a-zà-ú][a-zà-ú+#.-]{2,}/g) || []).map((w) => w.replace(/[.]+$/, '')));
}

interface Score { strong: boolean; hits: string[]; }
function scoreFit(jd: string, top20: { qual: string }[], doc: TrackerDoc | null): Score {
  const jdl = jd.toLowerCase();
  const jdTok = tokens(jd);
  // cluster demand hits: a top-20 qual counts if its significant words appear in the JD.
  const hits: string[] = [];
  for (const q of top20) {
    const qWords = (q.qual || '').toLowerCase().match(/[a-zà-ú][a-zà-ú+#.-]{2,}/g) || [];
    if (!qWords.length) continue;
    const present = qWords.filter((w) => jdTok.has(w) || jdl.includes(w)).length;
    if (present >= Math.max(1, Math.ceil(qWords.length * 0.6))) hits.push(q.qual);
  }
  // weekly-domain overlap: does the JD share vocabulary with existing T1/T2 rows?
  let weeklyHit = false;
  const rows = (doc?.rows || []) as Row[];
  const domainWords = tokens(rows.map((r) => r[2] + ' ' + r[6]).join(' '));  // role + fit
  let shared = 0;
  for (const w of jdTok) if (w.length > 4 && domainWords.has(w)) shared++;
  if (shared >= 6) weeklyHit = true;
  const strong = hits.length >= 5 || (hits.length >= 3 && weeklyHit);
  return { strong, hits: hits.slice(0, 6) };
}

function alreadyTracked(jd: string, doc: TrackerDoc | null): boolean {
  const probe = jd.slice(0, 120).toLowerCase();
  const sup = doc?.support || {};
  for (const k of Object.keys(sup)) {
    if (String(sup[k] || '').toLowerCase().includes(probe)) return true;
  }
  return false;
}

function slug(s: string): string {
  return (s || 'row').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'row';
}

async function addToWeekly(jd: string, hits: string[]): Promise<boolean> {
  const { doc, rev } = await getDoc();
  const d: TrackerDoc = doc || { version: 2, rows: [], urls: {}, support: {}, artifacts: {} };
  const company = window.prompt('Add to Job Tracker — Company?') || '';
  const role = window.prompt('Role / title?') || '';
  if (!company && !role) return false;
  const uk = slug(company + '-' + role) + '-' + String(Date.now()).slice(-4);
  const maxRank = Math.max(0, ...(d.rows || []).map((r) => Number(r[0]) || 0));
  const fit = 'Strong cluster fit — matches: ' + (hits.join(', ') || 'your cluster');
  const row: Row = [maxRank + 1, company, role, '', '', '', fit, 'OPEN', 'Not started', '', 'Added from upload (strong fit)', uk, 'E2EFDA'];
  d.rows = [...(d.rows || []), row];
  d.jd = { ...(d.jd || {}), [uk]: jd };
  d.support = { ...(d.support || {}), [uk]: 'ROLE: ' + company + ' — ' + role + '\nFIT: ' + fit };
  const res = await putDoc(d, rev);
  return !!res.ok;
}

function toast(hits: string[], jd: string): void {
  if (document.getElementById('antcv-jt-fit-toast')) return;
  const box = document.createElement('div');
  box.id = 'antcv-jt-fit-toast';
  Object.assign(box.style, {
    position: 'fixed', right: '16px', bottom: '16px', zIndex: '99997', maxWidth: '340px',
    background: '#fff', border: '1px solid ' + NAVY, borderRadius: '10px', padding: '12px 14px',
    boxShadow: '0 6px 24px rgba(0,0,0,0.25)', fontFamily: 'inherit', fontSize: '13px', color: '#1a2233',
  } as CSSStyleDeclaration);
  const h = hits.length ? ('Matches your cluster: ' + hits.slice(0, 4).join(', ') + '.') : 'Matches your target profile.';
  box.innerHTML = '<div style="font-weight:700;color:' + NAVY + ';margin-bottom:4px">Strong fit for your weekly list</div>'
    + '<div style="margin-bottom:10px;line-height:1.35">' + h + '</div>';
  const add = document.createElement('button');
  add.textContent = 'Add to Job Tracker';
  Object.assign(add.style, { background: NAVY, color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', marginRight: '8px' } as CSSStyleDeclaration);
  const no = document.createElement('button');
  no.textContent = 'Dismiss';
  Object.assign(no.style, { background: '#eef1f6', color: '#333', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' } as CSSStyleDeclaration);
  const close = () => { try { box.remove(); } catch { /* */ } };
  add.addEventListener('click', async () => {
    add.disabled = true; add.textContent = 'Adding…';
    try { const ok = await addToWeekly(jd, hits); add.textContent = ok ? 'Added ✓' : 'Failed'; setTimeout(close, ok ? 1200 : 2500); }
    catch { add.textContent = 'Failed'; setTimeout(close, 2500); }
  });
  no.addEventListener('click', close);
  box.appendChild(add); box.appendChild(no);
  document.body.appendChild(box);
  setTimeout(close, 18000);
}

async function check(jd: string): Promise<void> {
  const hh = hash(jd);
  if (offeredHashes.has(hh)) return;
  const [{ top20 }, docState] = await Promise.all([fetchClusterTop20(), getDoc()]);
  if (alreadyTracked(jd, docState.doc)) { offeredHashes.add(hh); return; }
  const s = scoreFit(jd, top20, docState.doc);
  if (s.strong) { offeredHashes.add(hh); toast(s.hits, jd); }
}

export function startFitWatch(): void {
  setInterval(() => {
    if (!isAuthed()) return; // never before login
    let jd = '';
    try { jd = String(localStorage.getItem('antcv:lastJdText') || '').trim(); } catch { /* */ }
    if (!jd || jd === lastSeen || jd.length < 200 || STUB.test(jd)) { lastSeen = jd; return; }
    lastSeen = jd;
    void check(jd).catch(() => { /* */ });
  }, POLL_MS);
}
