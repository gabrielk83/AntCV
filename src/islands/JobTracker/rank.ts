// JOBTRACKER-AUTOFILL-TOP5-001 — deterministic tier + fit scoring + Top-5 ordering.
// Pure, offline, unit-testable. The async LLM refine (in JobTracker.tsx) may UPGRADE
// the tier and fill semantic fields, but ranking always runs on this deterministic
// score so the Top-5 never jitters between identical states.

import { fitPercent, type Row, type TrackerDoc } from './api';

export const BAND = { T1: 'DDEBF7', T2: 'E2EFDA', T3: 'FCE4D6' } as const;

// Strong direct fit — electro-optics / photonics / optical-systems vocabulary.
const STRONG = /(electro-?optic|photonic|optic(s|al)|laser|lidar|\blens|\bbeam|imaging|spectroscop|interferomet|semiconductor|wafer|infrared|telescope|\bcamera|detector|collimat|waveguide)/i;
// Transferable / PM-side envelope fit.
const TRANSFER = /(product manager|product owner|requirement|specification|\bquality\b|\bqms\b|change control|\bprocess\b|project manager|programme|program manager|stakeholder|roadmap|validation|verification|test engineer|business analyst|systems? engineer|integration|\bhardware\b|technical product|workflow|prompt)/i;
// Conditional far-DK (Jutland / Fyn) — acceptable only with an offset; cap at T2.
const FARDK = /(jylland|jutland|aarhus|århus|odense|aalborg|ålborg|esbjerg|ikast|lystrup|billund|herning|kolding|vejle|horsens|silkeborg|\bfyn\b|funen)/i;
// Reachable — Greater Copenhagen / Zealand / Øresund-Skåne / remote.
const NEAROK = /(k(ø|o)benhavn|copenhagen|denmark|danmark|sj(æ|ae)lland|zealand|hovedstaden|malm(ø|o)|\blund\b|helsingborg|sk(å|a)ne|remote|hybrid|distributed)/i;
// Clearly on-site abroad (specific far cities/countries; bare "Sweden" stays neutral).
const ABROAD = /(germany|deutschland|münchen|munich|berlin|hamburg|poland|polska|warsaw|kraków|netherlands|nederland|amsterdam|eindhoven|france|paris|spain|españa|madrid|barcelona|italy|milano|norway|oslo|bergen|finland|helsinki|united kingdom|\buk\b|london|manchester|ireland|dublin|india|bangalore|hyderabad|china|shanghai|shenzhen|\busa\b|united states|switzerland|zurich|austria|vienna|belgium|brussels|portugal|lisbon|romania|bucharest|hungary|budapest|czech|prague|stockholm|gothenburg|g(ö|o)teborg)/i;

function clusterHits(text: string, cluster: { qual: string }[]): number {
  const low = (text || '').toLowerCase();
  let hits = 0;
  for (const q of cluster || []) {
    const words = (q.qual || '').toLowerCase().match(/[a-zà-ú][a-zà-ú+#.-]{2,}/g) || [];
    if (words.length && words.filter((w) => low.includes(w)).length >= Math.ceil(words.length * 0.6)) hits++;
  }
  return hits;
}

// Deterministic fit-tier band from the JD/role/location + cluster demand. The
// instant baseline on add (the async LLM refine may upgrade it), and the permanent
// fallback when the LLM is unreachable.
export function computeTier(jd: string, company: string, role: string, loc: string, cluster: { qual: string }[]): string {
  const text = (role + ' ' + company + ' ' + jd).slice(0, 6000);
  const locText = (loc + ' ' + jd).slice(0, 4000);
  const strong = (text.match(new RegExp(STRONG.source, 'gi')) || []).length;
  const hits = clusterHits(text, cluster);
  let tier: 1 | 2 | 3;
  if (strong >= 2 || (strong >= 1 && hits >= 3)) tier = 1;
  else if (TRANSFER.test(text) || hits >= 2) tier = 2;
  else tier = 3;
  // Location gate: on-site abroad drops to T3; conditional far-DK caps at T2.
  const remoteOk = /(remote|hybrid|distributed|work from home|\bwfh\b)/i.test(locText);
  if (!remoteOk) {
    if (ABROAD.test(locText) && !NEAROK.test(locText)) tier = 3;
    else if (FARDK.test(locText) && tier < 2) tier = 2;
  }
  return tier === 1 ? BAND.T1 : tier === 2 ? BAND.T2 : BAND.T3;
}

// Deterministic fit score (0-100) for Top-5 ordering. Base = tier + cluster demand
// (via fitPercent), plus a small bonus for a stored JD. STABLE across identical
// states so the Top-5 never reshuffles randomly.
export function fitScore(row: Row, doc: TrackerDoc, cluster: { qual: string }[]): number {
  const uk = row[11];
  const jd = (doc.jd || {})[uk] || '';
  const support = (doc.support || {})[uk] || '';
  const signals = (doc.signals || {})[uk] || '';
  let s = fitPercent(row[12], support + ' ' + jd + ' ' + signals, cluster);
  if (jd.length > 200) s += 3;
  return s;
}

// Top-5 = pinned rows first, then the highest-fit LIVE (non-closed, non-parked)
// rows by deterministic fitScore. The caller runs this in a useMemo, so any add
// re-evaluates against the current Top-5 automatically; a new lead that outscores
// the current #5 enters on the spot.
export function orderTop5(rows: Row[], doc: TrackerDoc, cluster: { qual: string }[], isClosed: (r: Row) => boolean): Row[] {
  const pin = doc.pin || {};
  const park = doc.park || {};
  const live = rows.filter((r) => !isClosed(r) && !park[r[11]]);
  const byScore = (a: Row, b: Row) => (fitScore(b, doc, cluster) - fitScore(a, doc, cluster)) || ((Number(a[0]) || 99) - (Number(b[0]) || 99));
  const pinned = live.filter((r) => pin[r[11]]).sort(byScore);
  const rest = live.filter((r) => !pin[r[11]]).sort(byScore);
  return [...pinned, ...rest].slice(0, 5);
}
