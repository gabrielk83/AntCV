// askai-insight.test.mjs
// ============================================================
// ASKAI-INSIGHT-001 (owner 2026-11-16): "new inputs from contacts should be verified
// against the full files and impact the cv and cl." The Ask AI panel
// (antcv-doc-chatbot-440.js) takes a contact's message, sends ONE call with a digest of
// the FULL kernel and BOTH documents, fact-checks every cited fact against the kernel,
// applies edits to the cv OR the cl array, and saves the insight per row. The saved
// insight reaches full generations through antcv-bullet-targets.js.
//
// Synthetic kernel only (no real candidate data). The case mirrors the NPI one: the
// facts that back "yield shows readiness" and "Operations signs off" sit deep in role
// bullet lists (index 5-6), where a first-3-bullets digest would never reach them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const CHAT = readFileSync(new URL('../../antcv-doc-chatbot-440.js', import.meta.url), 'utf8');
const TARGETS = readFileSync(new URL('../../antcv-bullet-targets.js', import.meta.url), 'utf8');

const KERNEL = {
  name: 'Test Candidate',
  experience: [
    {
      id: 'orbit-ccl', title: 'Change Control Lead', company: 'Orbit Sensors', years: '2020 – 2025', on: true,
      bullets: [
        'Chaired the change board for a 400-person sensor organisation.',
        'Cut change-request cycle time from about 250 to about 10 days.',
        'Wrote the change policy and trained 40 engineers on it.',
        'Ran the customer change-request channel for two automotive programmes.',
        'Kept the change log audit-ready for ISO 9001 reviews.',
        'Ran weekly reviews across optics, electronics, firmware and suppliers; tracked KPIs on cycle time, rework and customer-found defects.',
        'Reduced late-stage change friction by formalising gate criteria for system-level acceptance.',
      ],
      outcomes: ['Change cycle cut from ~250 to ~10 days.'],
      results: 'Cut the change cycle from about 250 to about 10 days.',
    },
    {
      id: 'lumen-eng', title: 'Senior Optics Engineer', company: 'Lumen Devices', years: '2017 – 2020', on: true,
      bullets: [
        'Designed the camera module optics for a consumer handset.',
        'Qualified two lens suppliers.',
        'Wrote the optical test plan.',
        'Ran tolerance analysis for the lens stack.',
        'Supported the pilot line in the first build.',
        'Set up the optical test lab; defined acceptance test procedures for incoming and outgoing optical assemblies.',
      ],
      results: [],
    },
    {
      id: 'beam-tl', title: 'Electro-Optics Team Leader', company: 'Beam Instruments', years: '2012 – 2017', on: true,
      bullets: ['Led a team of five engineers.', 'Guided workflow improvements for optical-system validation, supplier review, and production handover.'],
      outcomes: [],
    },
    { id: 'old-admin', title: 'Systems Administrator', company: 'Army', years: '2001 – 2004', on: false, bullets: ['Kept 300 workstations running.'] },
  ],
  proofPointsByRole: { 'orbit-ccl': ['Change board: ~250 to ~10 days.'] },
  selectedOutcomes: [{ role: 'lumen-eng', verb: 'Shipped', title: 'Camera module', result: 'Shipped the camera module in 2019.' }],
  proofPoints: ['Co-inventor of a patent on optical crosstalk.'],
  toolsItems: [{ group: 'Expertise' }, { l: 'Quality', v: 'FMEA, 8D, SPC' }],
  skillsInventory: ['Project Management', 'Optics', 'Supplier Quality', 'Statistics'],
};

const SECTIONS = {
  cv: [
    { id: 'profile', title: 'Profile', content: 'I am a project manager who brings hardware to market.' },
    { id: 'experience', type: 'experience', title: 'Experience', roles: [
      { title: 'Change Control Lead', company: 'Orbit Sensors', bullets: ['Chaired the change board for a 400-person sensor organisation.', 'Wrote the change policy and trained 40 engineers on it.'] },
      { title: 'Senior Optics Engineer', company: 'Lumen Devices', bullets: ['Qualified two lens suppliers.'] },
    ] },
  ],
  cl: [
    { id: 'opening', title: 'Opening', content: 'Your team brings complex products into production.' },
    { id: 'why', title: 'Why', content: 'I have moved products from design to the line.' },
  ],
};

function storage(map) {
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
  };
}

// The chatbot in a vm window. `answer` is the model text the stubbed proxy returns.
function load({ answer = '', doc = 'cv', row = '3536', meta = { company: 'Hamamatsu Photonics', role: 'NPI Project Manager' }, sse = false } = {}) {
  const store = new Map(Object.entries({
    personalInfo: JSON.stringify(KERNEL),
    sections: JSON.stringify(SECTIONS),
    meta: JSON.stringify(meta),
    doc: JSON.stringify(doc),
    proxyUrl: 'https://proxy.test',
  }));
  const events = [], calls = [], pushes = [];
  const et = new EventTarget();
  const win = {
    console: { debug() {}, log() {}, info() {}, warn() {}, error() {} },
    localStorage: storage(store),
    document: {
      readyState: 'complete', addEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
      getElementById: () => null, body: { appendChild() {} }, documentElement: {},
    },
    requestAnimationFrame() { return 0; }, setTimeout() { return 0; }, clearTimeout() {},
    MutationObserver: function () { this.observe = () => {}; },
    CustomEvent: class extends Event { constructor(t, o) { super(t); this.detail = o && o.detail; } },
    addEventListener: et.addEventListener.bind(et),
    dispatchEvent: (e) => { events.push({ type: e.type, detail: e.detail }); return et.dispatchEvent(e); },
    AntcvJdScope: { getCurrentAppId: () => row, nsKey: (b, id) => 'antcv:app:' + (id || row) + ':' + b },
    AntcvAnalysisPersist: { push: () => pushes.push(1) },
    fetch: (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      const raw = sse
        ? 'event: content_block_delta\ndata: ' + JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: answer } }) + '\n\n'
        : JSON.stringify({ content: [{ type: 'text', text: answer }] });
      return Promise.resolve({ ok: true, headers: { get: () => (sse ? 'text/event-stream' : 'application/json') }, text: async () => raw });
    },
    JSON, Date, Promise, Event, EventTarget,
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(CHAT, win);
  return { api: win.AntcvDocChatbot, store, events, calls, pushes, win };
}

const sec = (store) => JSON.parse(store.get('sections'));
const plain = (x) => JSON.parse(JSON.stringify(x));

test('the digest keeps every bullet of a shown role, deep ones included', () => {
  const { api } = load();
  const d = api._kernelDigest(KERNEL, 20000);
  assert.match(d.text, /ROLE \[orbit-ccl\] Change Control Lead \| Orbit Sensors \| 2020 – 2025/);
  assert.match(d.text, /gate criteria for system-level acceptance/, 'bullet 7 of orbit-ccl');
  assert.match(d.text, /incoming and outgoing optical assemblies/, 'bullet 6 of lumen-eng');
  assert.match(d.text, /production handover/);
  assert.match(d.text, /Proof point: Change board/);
  assert.match(d.text, /Outcome: Camera module — Shipped the camera module in 2019\./, 'selectedOutcomes join their role');
  assert.match(d.text, /Quality: FMEA, 8D, SPC/);
  assert.match(d.text, /SKILLS:\n Project Management, Optics/);
  assert.match(d.text, /ROLE \[old-admin\].*\(hidden in the CV\)/);
  assert.equal(d.dropped, 0);
});

test('a tight cap drops skills, tools and outcomes before any bullet of a shown role', () => {
  const { api } = load();
  const full = api._kernelDigest(KERNEL, 20000).text;
  const bulletsOnly = full.split('\n').filter((l) => /^ROLE \[(orbit|lumen|beam)|^ - |^ Result: /.test(l) && !/^ - (Co-inventor|Quality)/.test(l));
  const cap = bulletsOnly.join('\n').length + 40;
  const d = api._kernelDigest(KERNEL, cap);
  assert.ok(d.text.length <= cap, d.text.length + ' > ' + cap);
  assert.match(d.text, /gate criteria for system-level acceptance/);
  assert.match(d.text, /incoming and outgoing optical assemblies/);
  assert.doesNotMatch(d.text, /SKILLS/);
  assert.doesNotMatch(d.text, /Systems Administrator/, 'hidden roles go before shown bullets');
  assert.ok(d.dropped > 0);
});

test('fact check: verbatim and near-verbatim facts pass, invented ones fail', () => {
  const { api } = load();
  const idx = api._factIndex(KERNEL);
  const v1 = api._verifyFact(idx, 'lumen-eng', 'defined acceptance test procedures for incoming and outgoing optical assemblies');
  assert.equal(v1.verified, true); assert.equal(v1.foundIn, 'lumen-eng');
  const v2 = api._verifyFact(idx, 'orbit-ccl', 'Formalised gate criteria for system-level acceptance, reducing late-stage change friction');
  assert.equal(v2.verified, true, 'reordered wording, same tokens');
  const v3 = api._verifyFact(idx, 'orbit-ccl', 'Raised first-pass yield from 70% to 95% on the pilot line');
  assert.equal(v3.verified, false, 'no such fact in the kernel');
  const v4 = api._verifyFact(idx, 'orbit-ccl', 'Guided workflow improvements for optical-system validation, supplier review, and production handover.');
  assert.equal(v4.verified, true); assert.equal(v4.foundIn, 'beam-tl', 'wrong role cited, fact found in its real role');
  assert.equal(api._verifyFact(idx, '', 'FMEA 8D').verified, false, 'too short to count');
  assert.equal(api._verifyFact(idx, '', 'FMEA, 8D, SPC').verified, true, 'an exact kernel phrase counts');
  assert.equal(api._verifyFact(idx, 'profile', 'Co-inventor of a patent on optical crosstalk').foundIn, 'profile');
});

const ANSWER = {
  reply: 'They are telling you yield decides readiness and Operations signs off. I tied both to your acceptance and handover work.',
  insights: [
    { point: 'Yield is the measurable sign a product is ready to transfer.', support: [
      { role: 'orbit-ccl', fact: 'tracked KPIs on cycle time, rework and customer-found defects' },
      { role: 'orbit-ccl', fact: 'Raised first-pass yield to 98%' },
    ] },
    { point: 'Operations, as the receiver, has a big say in transfer readiness.', support: [
      'lumen-eng: defined acceptance test procedures for incoming and outgoing optical assemblies',
      { role: 'beam-tl', fact: 'Guided workflow improvements for optical-system validation, supplier review, and production handover.' },
    ] },
    { point: 'Products struggle on their way to Operations.', support: [] },
  ],
  edits: [
    { doc: 'cv', sid: 'profile', find: 'brings hardware to market', replace: 'brings hardware to a production handover that Operations accepts',
      why: 'Insight 2 - fact [beam-tl]', cites: [{ role: 'beam-tl', fact: 'production handover' }, { role: 'beam-tl', fact: 'Guided workflow improvements for optical-system validation, supplier review, and production handover.' }] },
    { sid: 'experience', find: 'Wrote the change policy and trained 40 engineers on it.',
      replace: 'Reduced late-stage change friction by formalising gate criteria for system-level acceptance.',
      why: 'Insight 1 - fact [orbit-ccl]', cites: [{ role: 'orbit-ccl', fact: 'Reduced late-stage change friction by formalising gate criteria for system-level acceptance.' }] },
    { doc: 'cl', sid: 'why', find: 'I have moved products from design to the line.',
      replace: 'I have moved products to the line and raised yield by 40% for 2 products.',
      why: 'Insight 1', cites: [{ role: 'orbit-ccl', fact: 'tracked KPIs on cycle time, rework and customer-found defects' }] },
    { doc: 'cl', sid: 'opening', find: 'not in the letter', replace: 'x', why: 'Insight 2', cites: [{ role: 'lumen-eng', fact: 'defined acceptance test procedures for incoming and outgoing optical assemblies' }] },
    { doc: 'cv', sid: 'profile' },
  ],
  questions: ['Did you track production yield in any role? Your profile names rework KPIs, not yield.'],
};

test('parse: tolerant JSON, doc inferred from the sid, every check flagged', () => {
  const { api } = load();
  const txt = 'Here you go:\n```json\n' + JSON.stringify(ANSWER) + '\n```';
  const r = api._parseInsightReply(txt, { index: api._factIndex(KERNEL), sections: SECTIONS, active: 'cl' });
  assert.equal(r.parsed, true);
  assert.equal(r.insights.length, 3);
  assert.deepEqual(plain(r.insights[0].support.map((s) => s.verified)), [true, false], 'invented yield fact is not verified');
  assert.equal(r.insights[1].support[0].role, 'lumen-eng', 'string "role: fact" support parsed');
  assert.equal(r.insights[1].support[0].verified, true);
  assert.equal(r.insights[2].support.length, 0);
  assert.equal(r.edits.length, 4, 'the edit without find/replace is dropped');
  const [profile, exp, why, missing] = r.edits;
  assert.equal(exp.doc, 'cv', 'experience exists only in the cv, so the missing doc is inferred');
  assert.equal(profile.found && profile.verified, true, 'an exact substring of a real bullet verifies');
  assert.equal(api._safeEdit(exp), true);
  assert.deepEqual(plain(why.newNumbers), ['40', '2'], 'numbers in neither the old text nor a cited fact ("40 engineers" elsewhere in the kernel does not count)');
  assert.equal(api._safeEdit(why), false);
  assert.equal(missing.found, false);
  assert.equal(r.questions.length, 1);
});

test('parse: a non-JSON answer becomes a plain reply', () => {
  const { api } = load();
  const r = api._parseInsightReply('I could not read that message.', { index: api._factIndex(KERNEL), sections: SECTIONS });
  assert.equal(r.parsed, false);
  assert.equal(r.reply, 'I could not read that message.');
  assert.equal(r.edits.length, 0);
});

test('apply: an edit to the cover letter lands in sections.cl while the CV is on screen, and undoes', () => {
  const { api, store, events } = load({ doc: 'cv' });
  const undo = api._applyEdit({ doc: 'cl', sid: 'why', find: 'from design to the line', replace: 'from design to a production handover' });
  assert.equal(typeof undo, 'function');
  assert.equal(sec(store).cl[1].content, 'I have moved products from design to a production handover.');
  assert.deepEqual(sec(store).cv, SECTIONS.cv, 'cv untouched');
  const ev = events.filter((e) => e.type === 'antcv:sections-updated');
  assert.equal(ev.at(-1).detail.doc, 'cl');
  assert.equal(undo(), true);
  assert.deepEqual(sec(store).cl, SECTIONS.cl);
  assert.equal(api._applyEdit({ doc: 'cv', sid: 'why', find: 'line', replace: 'x' }), null, 'no "why" section in the cv');
  // an edit without doc still targets the active document
  assert.equal(typeof api._applyEdit({ sid: 'profile', find: 'project manager', replace: 'programme manager' }), 'function');
  assert.match(sec(store).cv[0].content, /programme manager/);
});

test('askInsight: one call with both documents and the full kernel, result checked and saved to the row', async () => {
  const { api, store, calls, pushes } = load({ answer: JSON.stringify(ANSWER), sse: true });
  const out = await api._askInsight({ text: 'Yield tells us when a product is ready. Operations is the receiver.', from: 'A. Contact', fromRole: 'NPI Manager' });
  assert.equal(calls.length, 1);
  const sys = calls[0].body.system;
  assert.match(sys, /THE CV \(one line per section/);
  assert.match(sys, /THE COVER LETTER/);
  assert.match(sys, /\[why\] Why: I have moved products/);
  assert.match(sys, /gate criteria for system-level acceptance/, 'deep kernel bullet reaches the model');
  assert.match(sys, /TARGET: NPI Project Manager at Hamamatsu Photonics/);
  assert.equal(calls[0].body.max_tokens, 4000);
  assert.match(calls[0].body.messages[0].content, /CONTACT MESSAGE from A\. Contact \(NPI Manager\)/);
  assert.equal(out.parsed, true);
  assert.equal(out.edits.filter(api._safeEdit).length, 2, 'profile + experience; the letter edit adds numbers');
  const saved = JSON.parse(store.get('antcv:app:3536:insights'));
  assert.equal(saved.length, 1);
  assert.equal(saved[0].company, 'Hamamatsu Photonics');
  assert.equal(saved[0].from, 'A. Contact');
  assert.deepEqual(plain(saved[0].points[0].support.map((s) => s.verified)), [true, false]);
  assert.equal(pushes.length, 1, 'analysis-persist nudged to sync the row');
  assert.equal(out.row, '3536');
});

test('saved insights: newest first, capped at 8, and in later Ask AI turns', async () => {
  const { api } = load();
  for (let i = 0; i < 10; i++) api._saveInsight({ text: 'msg ' + i, insights: [{ point: 'Point ' + i, support: [{ role: 'orbit-ccl', fact: 'f', verified: true }] }] });
  const all = api.storedInsights();
  assert.equal(all.length, 8);
  assert.equal(all[0].text, 'msg 9');
  assert.match(api._buildSystem(), /CONTACT INSIGHTS SAVED FOR THIS APPLICATION[\s\S]*Point 9 \(backed by \[orbit-ccl\] f\)/);
});

test('generation block: only for a JD naming the same company, never the contact or the raw message', () => {
  const { api } = load();
  api._saveInsight({ from: 'A. Contact', text: 'Secret raw words', insights: [
    { point: 'Yield shows readiness.', support: [{ role: 'orbit-ccl', fact: 'tracked KPIs on cycle time, rework and customer-found defects', verified: true }] },
    { point: 'Products struggle on the way.', support: [] },
  ] });
  const block = api.insightsPromptBlock('JOB DESCRIPTION: Hamamatsu is hiring an NPI Project Manager...');
  assert.match(block, /CONTACT INSIGHTS \(ASKAI-INSIGHT-001: what people at Hamamatsu Photonics/);
  assert.match(block, /Yield shows readiness\. \(backed by \[orbit-ccl\]/);
  assert.match(block, /Products struggle on the way\. \(no backing fact yet: do not claim it\)/);
  assert.doesNotMatch(block, /A\. Contact|Secret raw words/);
  assert.equal(api.insightsPromptBlock('JOB DESCRIPTION: Axis Communications is hiring...'), '');
  assert.equal(api.insightsPromptBlock('Hamamatsuo is not the same word'), '');
});

// bullet-targets: the generation request carries the block; other requests do not.
function loadTargets(block) {
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent() { return true; }, AntcvDocChatbot: { insightsPromptBlock: () => block } },
    document: {
      readyState: 'complete', addEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
      createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, getContext: () => null }),
      getElementById: () => null, head: { appendChild() {} }, body: null, documentElement: {},
    },
    localStorage: storage(new Map()),
    console: { info() {}, warn() {}, log() {}, error() {}, debug() {} },
    setTimeout() { return 0; }, clearTimeout() {},
    MutationObserver: function () { this.observe = () => {}; this.disconnect = () => {}; },
    TextEncoder: function () { this.encode = (s) => ({ length: s.length }); },
    fetch: () => Promise.resolve({}),
    JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean, isFinite, parseInt, parseFloat, Date, Infinity, NaN, Promise,
  };
  vm.createContext(sandbox);
  vm.runInContext(TARGETS, sandbox);
  return sandbox.window.AntcvBulletTargets;
}

test('bullet-targets appends the block to the generation user turn only', () => {
  const t = loadTargets('\n\nCONTACT INSIGHTS (ASKAI-INSIGHT-001: what people at Hamamatsu ...');
  const gen = JSON.stringify({ system: 'SYS', messages: [{ role: 'user', content: [{ type: 'text', text: 'JOB DESCRIPTION: Hamamatsu' }, { type: 'text', text: 'Analyse all content and return adapted CV + cover letter as JSON per instructions.' }] }] });
  const out = JSON.parse(t._maybeInjectInsights(gen));
  assert.equal(out.system, 'SYS', 'system prefix untouched');
  assert.equal(out.messages[0].content.length, 3);
  assert.match(out.messages[0].content[2].text, /^CONTACT INSIGHTS \(ASKAI-INSIGHT-001/);
  assert.equal(t._maybeInjectInsights(JSON.stringify(out)), null, 'never twice');
  const strGen = JSON.stringify({ messages: [{ role: 'system', content: 'S' }, { role: 'user', content: 'x return adapted CV + cover letter y' }] });
  assert.match(JSON.parse(t._maybeInjectInsights(strGen)).messages[1].content, /y\n\nCONTACT INSIGHTS/);
  const compress = JSON.stringify({ messages: [{ role: 'user', content: 'Compress this CV/cover letter section by approximately 15%.' }] });
  assert.equal(t._maybeInjectInsights(compress), null);
  assert.equal(loadTargets('')._maybeInjectInsights(gen), null, 'no saved insight for this JD: unchanged');
});
