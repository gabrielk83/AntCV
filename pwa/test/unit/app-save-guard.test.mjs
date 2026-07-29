// APP-SAVE-GUARD-001/002 — the Application-History "switch save-prior" persists the in-memory
// sections to the OUTGOING app id (Fl/es). Because Fl can desync from what's on screen, that
// write corrupted cloud records with another app's content. -002 (smart): the save-prior now
// fires when the in-memory content provably belongs to Fl (window.__antcvContentAppId === Fl,
// stamped by the apps client's setActive) OR the manual antcv:switch-autosave==='on' override.
// A desync (stamp != Fl) skips -> no corruption, while normal switching keeps auto-saving.
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const pwa = path.join(dir, '../..');
const src = fs.readFileSync(path.join(pwa, 'app.src.js'), 'utf8');
const js = fs.readFileSync(path.join(pwa, 'app.js'), 'utf8');

test('app.src.js: both save-prior sites use the smart stamp guard, no un-guarded/flag-only site remains', () => {
  assert.equal(src.split('String(window.__antcvContentAppId||"") === String(Fl)').length - 1, 2, 'both sites stamp-guarded');
  assert.equal(src.includes('if (Fl && Fl !== e.id)'), false, 'no bare save-prior');
  assert.equal(src.includes('if (Fl && Fl !== e.id && "on" === (function'), false, 'no flag-only save-prior');
});

test('app.js (deployed mirror): both save-prior sites use the smart stamp guard', () => {
  assert.equal(js.split('String(window.__antcvContentAppId||"")===String(es)').length - 1, 2, 'both mirror sites stamp-guarded');
  assert.equal(js.includes('if(es&&es!==e.id)'), false, 'no bare save-prior in mirror');
  assert.equal(js.includes('if(es&&es!==e.id&&"on"===(function'), false, 'no flag-only save-prior in mirror');
});

test('the content stamp is set in the apps client setActive() in both files', () => {
  assert.ok(src.includes('window.__antcvContentAppId = String(e)'), 'src setActive stamps');
  assert.ok(js.includes('window.__antcvContentAppId=String(e)'), 'mirror setActive stamps');
});
