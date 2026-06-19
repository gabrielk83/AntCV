// CLUSTER-QUAL-001 (owner 2026-06-19): job-search targeting preferences — WHERE the
// user is looking (region/country), WHICH model (employed vs independent consultant)
// and WHICH format (onsite/hybrid/remote). These parameterize the demand model so the
// per-cluster top-20s (and the nightly recruitment-site research) get more targeted.
//
// Persisted under personalInfo.jobSearchPrefs — the cloud-synced writingPrefs/
// layoutPrefs pattern (NOT a sidecar-written personalInfo.stylePrefs.* field, which
// the cloud-restore rewrite clobbers). The demand sidecar (antcv-cluster-demand.js)
// reads localStorage.personalInfo.jobSearchPrefs.

export type EmploymentModel = 'employed' | 'consultant';
export type WorkFormat = 'onsite' | 'hybrid' | 'remote';

export interface JobSearchPrefs {
  regions: string[];              // region ids from REGION_OPTIONS
  employment: EmploymentModel[];  // multi — a user may target both
  formats: WorkFormat[];          // multi
}

export const REGION_OPTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'dk', label: 'Denmark' },
  { id: 'nordics', label: 'Nordics' },
  { id: 'eu', label: 'EU / EEA' },
  { id: 'uk', label: 'United Kingdom' },
  { id: 'il', label: 'Israel' },
  { id: 'us', label: 'United States' },
  { id: 'remote', label: 'Remote (global)' },
];

export const EMPLOYMENT_OPTIONS: ReadonlyArray<{ id: EmploymentModel; label: string }> = [
  { id: 'employed', label: 'Employed' },
  { id: 'consultant', label: 'Independent consultant' },
];

export const FORMAT_OPTIONS: ReadonlyArray<{ id: WorkFormat; label: string }> = [
  { id: 'onsite', label: 'Onsite' },
  { id: 'hybrid', label: 'Hybrid' },
  { id: 'remote', label: 'Remote' },
];

const EMPLOYMENT_SET = new Set<EmploymentModel>(['employed', 'consultant']);
const FORMAT_SET = new Set<WorkFormat>(['onsite', 'hybrid', 'remote']);
const REGION_SET = new Set<string>(REGION_OPTIONS.map((r) => r.id));

interface PersonalInfoBlob { jobSearchPrefs?: Partial<JobSearchPrefs>; [k: string]: unknown }

function readPI(): PersonalInfoBlob {
  try { return (JSON.parse(localStorage.getItem('personalInfo') || '{}') as PersonalInfoBlob) || {}; }
  catch { return {}; }
}

function strArr(v: unknown, allow: Set<string>): string[] {
  return Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === 'string' && allow.has(x)) : [];
}

export function readJobSearchPrefs(): JobSearchPrefs {
  const jp = readPI().jobSearchPrefs ?? {};
  return {
    regions: strArr(jp.regions, REGION_SET),
    employment: strArr(jp.employment, EMPLOYMENT_SET as Set<string>) as EmploymentModel[],
    formats: strArr(jp.formats, FORMAT_SET as Set<string>) as WorkFormat[],
  };
}

export function writeJobSearchPrefs(patch: Partial<JobSearchPrefs>): JobSearchPrefs {
  const pi = readPI();
  const merged: JobSearchPrefs = { ...readJobSearchPrefs(), ...patch };
  pi.jobSearchPrefs = merged;
  try { localStorage.setItem('personalInfo', JSON.stringify(pi)); } catch { /* */ }
  // Mirror writeWritingPrefs: push to cloud so a fresh-device "Load from cloud" keeps it.
  try { (window as unknown as { _antcvCloudWrite?: (p: unknown) => void })._antcvCloudWrite?.({ personalInfo: pi }); } catch { /* */ }
  try { window.dispatchEvent(new CustomEvent('antcv:job-search-prefs-changed', { detail: merged })); } catch { /* */ }
  return merged;
}
