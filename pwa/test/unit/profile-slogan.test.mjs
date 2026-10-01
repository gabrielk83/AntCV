// PROFILE-VOICE-001 / PROFILE-NO-BUZZWORD-LIST-001 / PROFILE-SLOGAN-001 (owner 2026-10-01):
// "make sure profile never looks like a list of buzzwords ... replace the word PROFILE in the heading with a
// slogan (like the line in the cover letter), make sure they are not repeating each other ... use I in the profile"
// + "opening sentence of the profile is personal, after that direct towards company oriented".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const R = createRequire(import.meta.url)(path.join(dir, 'antcv-profile-rules.js'));
const fails = (text, opts) => R.checkProfile(text, opts).filter((r) => !r.ok).map((r) => r.id);

const VEO = "I am a hardware product manager and systems architect who has spent 15+ years taking camera, optical and sensor products from a written case to shipped units. Veo cameras already follow the play in 90+ countries, so the next one needs a step change in cost, optics or portability. As Veo's Staff Hardware Product Manager I will write the business case before the spec and bring optics, thermal, battery and cost into the decision while a change still costs a conversation.";
const VEO_CL = 'COACH-FRIENDLY HARDWARE PM WITH A KNACK FOR CAMERAS THAT EARN THEIR PLACE';

test('a first-person, me-to-them profile with a distinct slogan passes every check', () => {
  assert.deepEqual(fails(VEO, { company: 'Veo', slogan: 'Make the case before the spec', clSlogan: VEO_CL }), []);
});

test('a buzzword list fails', () => {
  assert.ok(fails('Results-driven, detail-oriented and proactive project manager.').includes('PROFILE-NO-BUZZWORD-LIST-001'));
  assert.ok(fails('I am a PM. Stakeholder management, risk, agile, delivery.').includes('PROFILE-NO-BUZZWORD-LIST-001'));
  assert.ok(fails('Strategic leader | Agile | Risk | Delivery').includes('PROFILE-NO-BUZZWORD-LIST-001'));
});

test('third person, self-focused motivation and no company turn fail', () => {
  const f = fails("Experienced engineer with 15 years in optics. He is excited about this role and enjoys working with people.");
  assert.ok(f.includes('PROFILE-FIRST-PERSON-001'));
  assert.ok(f.includes('PROFILE-OPEN-PERSONAL-001'));
  assert.ok(f.includes('PROFILE-ME-TO-THEM-001'));
  assert.ok(fails("I am a PM. I'm excited about this role because I enjoy stakeholders.").includes('PROFILE-NO-SELF-FOCUS-001'));
});

test('a slogan that repeats the cover-letter slogan fails; the plain label is not a slogan', () => {
  assert.deepEqual(R.sloganOverlap('The case before the camera', VEO_CL), ['camera']);
  assert.ok(fails(VEO, { company: 'Veo', slogan: 'The case before the camera', clSlogan: VEO_CL }).includes('PROFILE-SLOGAN-DISTINCT-001'));
  assert.ok(fails(VEO, { company: 'Veo', slogan: 'PROFILE', clSlogan: VEO_CL }).includes('PROFILE-SLOGAN-001'));
});

function loadHeading(store = {}) {
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const win = { localStorage: ls, addEventListener() {}, dispatchEvent() {}, CustomEvent: function () {} };
  win.window = win;
  const ctx = vm.createContext({ window: win, localStorage: ls, document: { body: null, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] }, MutationObserver: function () { this.observe = () => {}; }, setTimeout, CustomEvent: function () {}, module: undefined });
  vm.runInContext(fs.readFileSync(path.join(dir, 'antcv-profile-rules.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(dir, 'antcv-cv-profile-heading.js'), 'utf8'), ctx);
  return win.__antcvProfileHeading;
}

test('generation replaces PROFILE with the slogan by default and keeps it as sloganTitle', () => {
  const H = loadHeading();
  const s = H.applyGen({ id: 'profile', title: 'PROFILE' }, { profile_slogan: 'Make the case before the spec.' }, { cl_slogan: VEO_CL });
  assert.equal(s.title, 'Make the case before the spec');
  assert.equal(s.sloganTitle, 'Make the case before the spec');
});

test('a slogan that repeats the cover-letter slogan is not applied', () => {
  const H = loadHeading();
  const s = H.applyGen({ id: 'profile', title: 'PROFILE' }, { profile_slogan: 'The case before the camera' }, { cl_slogan: VEO_CL });
  assert.equal(s.title, 'PROFILE');
  assert.deepEqual([...s.sloganRepeat], ['camera']);
});

test('label mode keeps the plain heading; other sections and missing slogans pass through', () => {
  const H = loadHeading({ 'antcv:cvProfileHeadingMode': 'label' });
  assert.equal(H.applyGen({ id: 'profile', title: 'Old slogan' }, { profile_slogan: 'Make the case before the spec' }, {}).title, 'PROFILE');
  const w = { id: 'work_style', title: 'Work style' };
  assert.equal(H.applyGen(w, { profile_slogan: 'x y z' }, {}), w);
  const p = { id: 'profile', title: 'PROFILE' };
  assert.equal(H.applyGen(p, {}, {}), p);
});

test('app.js + mirror call the hook and ask for profile_slogan; index.html loads both sidecars', () => {
  for (const f of ['app.js', 'app.src.js']) {
    const s = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.equal(s.split('window.__antcvProfileHeading.applyGen(').length - 1, 1, f);
    assert.ok(s.includes('"cv_overrides":{"profile_slogan":'), f);
  }
  const idx = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  assert.ok(/<script src="antcv-profile-rules\.js\?v=[^"]+" defer><\/script>\s*<script src="antcv-cv-profile-heading\.js\?v=/.test(idx));
  const block = JSON.parse(fs.readFileSync(path.join(dir, 'gold-rules.json'), 'utf8')).prompt_block.join('\n');
  for (const id of ['PROFILE-VOICE-001', 'PROFILE-NO-BUZZWORD-LIST-001', 'PROFILE-SLOGAN-001']) assert.ok(block.includes(id), id);
});
