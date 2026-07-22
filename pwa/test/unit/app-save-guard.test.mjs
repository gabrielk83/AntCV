// APP-SAVE-GUARD-001 — the Application-History "switch save-prior" (which persists the
// in-memory sections to the OUTGOING app id `Fl`/`es`) is the vector that overwrote cloud
// records with another app's content when `Fl` desynced from what's on screen. It is now
// gated behind an explicit `antcv:switch-autosave === "on"` flag (default OFF = skip) so it
// can never silently write the wrong content to a record. Guard must be present in BOTH the
// human source and the deployed minified mirror.
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const pwa = path.join(dir, '../..');

test('app.src.js gates both switch save-prior sites on antcv:switch-autosave', () => {
  const s = fs.readFileSync(path.join(pwa, 'app.src.js'), 'utf8');
  const guarded = s.split('if (Fl && Fl !== e.id && "on" ===').length - 1;
  assert.equal(guarded, 2, 'both save-prior sites guarded');
  assert.equal(s.includes('if (Fl && Fl !== e.id)') , false, 'no un-guarded save-prior remains');
  assert.ok(s.includes('antcv:switch-autosave'), 'flag key present');
});

test('app.js (deployed mirror) gates both switch save-prior sites', () => {
  const s = fs.readFileSync(path.join(pwa, 'app.js'), 'utf8');
  const guarded = s.split('if(es&&es!==e.id&&"on"===').length - 1;
  assert.equal(guarded, 2, 'both save-prior sites guarded in the minified mirror');
  assert.equal(s.includes('if(es&&es!==e.id)'), false, 'no un-guarded save-prior remains in the mirror');
});
