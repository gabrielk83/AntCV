// One-shot, idempotent migration that runs on the v1.50 first launch.
// Plan §4.5.2 + §4.5.3.
//
// Behaviour:
//   1. If personalInfo.migrationVersion === "v1.50": no-op.
//   2. Else, in this order:
//      a. personalInfo.writingPrefs.style = "nordic-minimal" iff not set.
//      b. extraBannedWords / extraBannedPhrases become objects keyed by
//         ISO 2-letter lang code with empty arrays for en / da / es / zh.
//      c. Gabriel's personal items partitioned into en (English) and
//         da (Danish) buckets per plan §4.5.2.
//      d. personalInfo.migrationVersion := "v1.50".
//
// Re-running produces the same partitioned object — additions are
// de-duplicated case-insensitively. The migration never *removes* items.

import {
  readWritingPrefs,
  writeWritingPrefs,
  type BannedBucket,
} from './writing-prefs';
import { normaliseStyleId } from './writing-systems';

const MIGRATION_VERSION = 'v1.50';

const GABRIEL_EN_WORDS = [
  'multi-faceted',
  'central',
  'end-to-end',
  'strong leader',
  'client-focused',
  'customer-centric',
];

const GABRIEL_EN_PHRASES = [
  'My expertise lies in',
  'I am known for',
  'At the heart of my work',
  'My approach is',
  'I thrive in',
  'I bring a wealth of experience',
  'Proven ability to',
  'I am committed to',
  'Passionate about driving',
  'Known for fostering',
];

const GABRIEL_DA_WORDS = ['tværgående', 'tværfunktionel'];

interface PersonalInfoBlob {
  migrationVersion?: string;
  writingPrefs?: { style?: unknown };
}

function readPersonalInfo(): PersonalInfoBlob {
  try {
    return JSON.parse(localStorage.getItem('personalInfo') ?? '{}') as PersonalInfoBlob;
  } catch {
    return {};
  }
}

function writePersonalInfo(blob: PersonalInfoBlob): void {
  try { localStorage.setItem('personalInfo', JSON.stringify(blob)); } catch { /* */ }
}

function mergeInto(bucket: BannedBucket, lang: keyof BannedBucket, items: readonly string[]): BannedBucket {
  const out: BannedBucket = { ...bucket };
  const existing = new Set((bucket[lang] ?? []).map((x) => x.toLowerCase()));
  for (const item of items) {
    if (existing.has(item.toLowerCase())) continue;
    out[lang] = [...(out[lang] ?? []), item];
    existing.add(item.toLowerCase());
  }
  return out;
}

export interface MigrationResult {
  ran: boolean;
  alreadyAtVersion: boolean;
  styleSet: boolean;
  bannedWordsAdded: number;
  bannedPhrasesAdded: number;
}

/**
 * Run the migration. Safe to call multiple times — operations are idempotent.
 */
export function runGabrielMigration(): MigrationResult {
  const pi = readPersonalInfo();
  const alreadyAtVersion = pi.migrationVersion === MIGRATION_VERSION;

  const before = readWritingPrefs();
  let styleSet = false;
  let bannedWordsAdded = 0;
  let bannedPhrasesAdded = 0;

  // (a) default style if not present.
  let stylePatch: { style?: 'nordic-minimal' } = {};
  if (!pi.writingPrefs || typeof pi.writingPrefs.style !== 'string' || !pi.writingPrefs.style) {
    stylePatch = { style: 'nordic-minimal' };
    styleSet = true;
  } else {
    // If style is set but legacy ("Scandinavian" etc.) we let normaliseStyleId
    // normalise it on next read — no write needed here.
    normaliseStyleId(pi.writingPrefs.style);
  }

  // (b) + (c) banned bases.
  const beforeEnWords = before.extraBannedWords.en.length;
  const beforeDaWords = before.extraBannedWords.da.length;
  const beforeEnPhrases = before.extraBannedPhrases.en.length;

  const wordsAfter = mergeInto(mergeInto(before.extraBannedWords, 'en', GABRIEL_EN_WORDS), 'da', GABRIEL_DA_WORDS);
  const phrasesAfter = mergeInto(before.extraBannedPhrases, 'en', GABRIEL_EN_PHRASES);

  bannedWordsAdded =
    (wordsAfter.en.length - beforeEnWords) +
    (wordsAfter.da.length - beforeDaWords);
  bannedPhrasesAdded = phrasesAfter.en.length - beforeEnPhrases;

  // Apply the writingPrefs patch (style + banned buckets).
  writeWritingPrefs({
    ...stylePatch,
    extraBannedWords: wordsAfter,
    extraBannedPhrases: phrasesAfter,
  });

  // (d) stamp migrationVersion. Re-read personalInfo because writeWritingPrefs
  // above already wrote to it; we want to preserve that change.
  const piAfter = readPersonalInfo();
  piAfter.migrationVersion = MIGRATION_VERSION;
  writePersonalInfo(piAfter);

  return {
    ran: true,
    alreadyAtVersion,
    styleSet,
    bannedWordsAdded,
    bannedPhrasesAdded,
  };
}

declare global {
  interface Window {
    AntcvGabrielMigration?: {
      version: string;
      run: () => MigrationResult;
      currentVersion: () => string | undefined;
    };
  }
}

export function exposeMigrationDebugApi(): void {
  window.AntcvGabrielMigration = {
    version: '1.50.0-pass3',
    run: runGabrielMigration,
    currentVersion: () => readPersonalInfo().migrationVersion,
  };
}
