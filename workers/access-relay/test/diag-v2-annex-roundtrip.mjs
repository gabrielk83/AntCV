/* DIAGNOSTIC — V2-ANNEX-ROUNDTRIP-001 (owner 2026-06-18).
 * Asserts that a FULL expanded-kernel personalInfo (the V2 annex —
 * semanticConstraintsV2, bannedContextual, mergeGroups, personalFigure,
 * positioning, headlines, proofPointsByRole, selectedOutcomes, stylePrefs,
 * workStyle, qualityGuards, targetRoles/Industries, skillsInventory, and
 * experience[] with nested outcomes/bullets/altTitles + grouped tools/
 * regulatory) survives a PUT /api/prefs -> GET /api/prefs round-trip BYTE-FOR-
 * BYTE. The relay decomposes personalInfo into D1 identity (catch-all) + history
 * (PI_HISTORY_KEYS) columns and rebuilds via mergePersonalInfo; this guards that
 * the split/merge stays lossless as the kernel schema grows.
 * Run: node test/diag-v2-annex-roundtrip.mjs */
import { writeSync } from 'node:fs';
const log = (...a) => writeSync(1, a.join(' ') + '\n');
const relay = (await import('../src/index.js')).default;

const SECRET = 'roundtrip-test-secret-0123456789abcdef0123456789';
const EMAIL = 'karp.gabriel.a@gmail.com';
const ORIGIN = 'https://antcv.pages.dev';

function b64url(bytes) { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
async function mint(email) {
  const enc = new TextEncoder(); const now = Math.floor(Date.now() / 1000);
  const h = b64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const p = b64url(enc.encode(JSON.stringify({ sub: email, email, iat: now, exp: now + 3600, iss: 'antcv-access-relay' })));
  const key = await crypto.subtle.importKey('raw', enc.encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${h}.${p}`));
  return `${h}.${p}.${b64url(new Uint8Array(sig))}`;
}

// Mock D1 holding ONE user_kernel row (mirrors diag-empty-overwrite-guard).
function mockDB(row) {
  return {
    _row: () => row,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (/FROM user_kernel/.test(sql)) return row;
              return null;
            },
            async run() {
              if (/INSERT INTO user_kernel/.test(sql)) {
                row = { user_hash: args[0], identity: args[1], history: args[2], preferences: args[3], photo_b64: args[4], created_at: args[5], updated_at: args[6] };
              }
              return { success: true, meta: {} };
            },
          };
        },
      };
    },
    async batch() { return []; },
  };
}
function kvMock() { const m = new Map(); return { async get(k) { return m.has(k) ? m.get(k) : null; }, async put(k, v) { m.set(k, v); }, async delete(k) { m.delete(k); } }; }

function env(db) { return { JWT_SECRET: SECRET, DB: db, KV_BINDING: kvMock(), ALLOWED_ORIGINS: ORIGIN }; }
async function call(method, path, token, db, bodyObj) {
  const init = { method, headers: { 'Origin': ORIGIN, 'Authorization': 'Bearer ' + token } };
  if (bodyObj !== undefined) { init.headers['content-type'] = 'application/json'; init.body = JSON.stringify(bodyObj); }
  const res = await relay.fetch(new Request('https://relay.example.com' + path, init), env(db), { waitUntil: () => {} });
  let body = null; try { body = await res.json(); } catch (_) {}
  return { status: res.status, body };
}

// Full expanded-kernel personalInfo — one representative entry per annex type.
const FULL_PI = {
  name: 'Gabriel Alexander Karp-Gershon',
  email: EMAIL,
  headline: 'Processes & Products | People',
  location: '2300, København S',
  citizenship: 'EU Citizen',
  // history-column keys (PI_HISTORY_KEYS) — grouped tools/regulatory included.
  tools: [{ group: 'Expertise' }, { l: 'Imaging', v: 'Camera architecture, ISP, MTF/SFR' }],
  regulatory: [{ group: 'Systems, Safety & Cybersecurity' }, { l: 'ASPICE', v: 'Requirements, traceability' }, { l: 'ISO 26262', v: 'Functional safety' }],
  education: [{ deg: 'M.Sc. EE — GPA 91.7', sch: 'Tel Aviv University' }],
  certifications: ['Six Sigma Black Belt (CSSC)', 'Business Analysis / BABOK'],
  languages: [{ lang: 'English', level: 'native' }, { lang: 'Danish', level: 'B1', note: 'Prøve i dansk 2' }],
  additional: [{ l: 'Languages', v: 'English (Native), Danish (B1)' }],
  publications: ['<b>CNT Integration</b> — Karp et al., 2009'],
  patentNumber: '241997',
  patentDescription: 'Cover-window geometry reducing optical crosstalk',
  // identity catch-all keys — the whole V2 annex.
  headlines: { unsolicited: 'Processes & Products | People', photonicsEO: 'Electro-Optics Engineer', commercialProduct: 'Technical Product Manager', broad: 'IT Professional' },
  stylePrefs: {
    banned_words: 'spearhead, ensure, foster',
    banned_phrases: 'team player, proven track record',
    preferred_tone: 'clear, calm, direct',
    semanticConstraintsV2: [
      { id: 'team-coordination', trigger: 'team coordination without direct line management', avoid: ['led a team', 'managed a team'], prefer: ['supervised technically', 'coordinated engineering work'], reason: 'Avoid overstating people-management.', scope: { role_company: 'Sirin Labs', site: 'Sweden' } },
    ],
    bannedContextual: [
      { avoid: 'led a team', use_instead: 'supervised technically, coordinated engineering work', note: 'Avoid overstating people-management.', when: { role_company: 'Sirin Labs' } },
    ],
  },
  experience: [
    { id: 'innoviz-ccr', title: 'Change Control Lead', company: 'Innoviz Technologies', years: '2020 – 2025', on: true, altTitles: ['Customer Change Requests Specialist'], bullets: ['Owned change governance under ASPICE and ISO 26262.'], outcomes: ['Cut the change cycle from ~250 to ~10 days.'] },
    { id: 'tau-security', title: 'Security Guard', company: 'Tel Aviv University', years: '2010', on: true, _visibilityNote: 'VISIBLE per owner — unsolicited application.', bullets: ['Maintained safety and order.'], outcomes: [] },
  ],
  mergeGroups: [{ company: 'Innoviz Technologies', atomic: ['innoviz-sa', 'innoviz-ccr'], default: 'split' }],
  personalFigure: { status: 'available_from_user_attachment', allowed_outputs: ['profile_page', 'non_ATS_CV'], suggested_controls: { shape: ['circle', 'square'], size_px_range: [70, 180] } },
  positioning: { primary: 'Broad IT / product / business-analysis profile.', unsolicitedSpecializationLine: 'Processes & Products | People' },
  proofPoints: ['Co-inventor of Patent No. 241997', 'Cut change cycle ~250 -> ~10 days'],
  proofPointsByRole: { 'innoviz-ccr': ['$8M customer NRE', 'ASPICE CL1 audit passed (2025)'], 'tau-security': ['750 residents'] },
  selectedOutcomes: [{ title: 'Change cycle: ~250 -> ~10 days', result: 'Via a Change Control Board process.' }],
  workStyle: { keywords: ['calm', 'analytical'], strengths: ['Trade-off analysis'], work_style_line_en: 'Calm, structured decisions from measured data.' },
  personality: { keywords: ['calm', 'structured'], summary: 'Calm, structured engineer who reads people as well as data.' },
  specialization: 'Processes • Products • People',
  qualityGuards: { emptyFieldPolicy: 'Do not invent missing facts.', verbRule: 'Never bare "led a team".' },
  targetRoles: ['Product Manager, Technical Products', 'Change Control Lead'],
  targetIndustries: ['Automotive / mobility', 'LiDAR', 'Machine vision'],
  skillsInventory: ['System Architecture', 'Change Management', 'SQL', 'Optical Metrology'],
};

const token = await mint(EMAIL);
const db = mockDB(null); // empty -> PUT inserts the row

const putRes = await call('PUT', '/api/prefs', token, db, { personalInfo: FULL_PI });
log('PUT status:', putRes.status, '| saved includes personalInfo:', !!(putRes.body && (putRes.body.saved || []).join(',').includes('personalInfo')));

const getRes = await call('GET', '/api/prefs', token, db);
const out = (getRes.body && getRes.body.prefs && getRes.body.prefs.personalInfo) || null;

let pass = true;
if (getRes.status !== 200 || !out) { log('GET status:', getRes.status, '— no personalInfo returned'); pass = false; }

const mismatches = [];
if (out) {
  for (const k of Object.keys(FULL_PI)) {
    if (k === 'email') continue; // server-pinned to the JWT email (same value here, but skip to be safe)
    const a = JSON.stringify(FULL_PI[k]);
    const b = JSON.stringify(out[k]);
    if (a !== b) { mismatches.push(k); }
  }
  // email must come back as the signed-in identity.
  if (out.email !== EMAIL) mismatches.push('email(pinned)');
}

if (mismatches.length) {
  pass = false;
  log('MISMATCHED keys (' + mismatches.length + '):', mismatches.join(', '));
  for (const k of mismatches.slice(0, 6)) {
    log('  · ' + k + '\n     in : ' + JSON.stringify(FULL_PI[k]) + '\n     out: ' + JSON.stringify(out ? out[k] : undefined));
  }
} else if (out) {
  log('All ' + (Object.keys(FULL_PI).length) + ' personalInfo keys round-tripped intact (incl. full V2 annex).');
}

log(pass ? 'V2-ANNEX-ROUNDTRIP OK' : 'V2-ANNEX-ROUNDTRIP FAIL');
process.exitCode = pass ? 0 : 1;
