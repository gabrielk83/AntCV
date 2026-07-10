// Shared QA check list, driven by either scripts/browser-qa.mjs (desktop
// Chromium) or scripts/phone-qa.mjs (real Android Chrome over adb). Both
// callers hand this a Playwright `page` plus a `ctx` of
// { baseUrl, persona, seed(state), screenshot(name) } and get back results.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');

export const persona = JSON.parse(
  readFileSync(join(ROOT, 'docs', 'personas', 'anita', 'personalInfo.json'), 'utf8')
);

// Patch number of the repo's committed TARGET_VERSION (e.g. 260 from
// '1.51.260-shift-versionfix'). The version-live check compares the LIVE
// window.ANTCV_VERSION against this to catch a deploy that never flipped or a
// merge that REGRESSED the version below what shipped (the 245/246 incident).
export function repoTargetPatch() {
  try {
    const vo = readFileSync(join(ROOT, 'pwa', 'antcv-version-override.js'), 'utf8');
    const m = vo.match(/TARGET_VERSION\s*=\s*'1\.51\.(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  } catch { return null; }
}
const patchOf = (v) => { const m = String(v || '').match(/1\.51\.(\d+)/); return m ? parseInt(m[1], 10) : null; };

// Sidecars whose presence on the LIVE bundle proves a specific feature actually
// shipped (beats grepping the minified file — this asserts the deployed code wired it).
export const LIVE_SIDECAR_PROBES = [
  { path: 'AntcvJdScope.devQ',       feature: 'per-device pointer query (PARALLEL-GEN-POINTER-002)' },
  { path: 'AntcvJdScope.deviceId',   feature: 'per-install device id (JD-SCOPE-ISOLATION-001)' },
  { path: 'AntcvJdScope.getCurrentAppId', feature: 'per-tab app id (PARALLEL-GEN-ISO-001)' },
  { path: 'AntcvTabDocIso.tabId',    feature: 'tab-doc isolation sidecar (1.51.253)' },
  { path: 'AntcvDebug.open',         feature: 'debug logger' },
];

// Registry id scheme (packages/registry.json). app.js legacy aliases that must
// NOT survive a reload are the orphans: stylePackage "scandinavian",
// toneRegister "scandinavian".
export const REGISTRY_PACKAGE_IDS = new Set([
  'copenhagen-modern', 'navy-executive', 'warm-terracotta', 'nordic-frost',
  'pampas-contemporary', 'tokyo-precision', 'delhi-technical', 'custom',
]);

export const CHECKS = [
  {
    id: 'version-live',
    desc: 'The LIVE window.ANTCV_VERSION is present and NOT below the repo TARGET_VERSION '
        + '(catches a deploy that never flipped, or a merge that regressed the version below '
        + "what shipped — the 245/246 incident). Against production, expects the deploy to have settled.",
    async run(page, ctx) {
      await page.goto(ctx.baseUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      const live = await page.evaluate(() => window.ANTCV_VERSION || null);
      const livePatch = patchOf(live);
      const repoPatch = repoTargetPatch();
      // Pass when the live build is at/above the repo target. Below = regression or
      // an unfinished deploy; missing = the seed never ran (bundle boot failure).
      const pass = livePatch != null && repoPatch != null && livePatch >= repoPatch;
      return {
        pass,
        detail: {
          live, livePatch, repoTargetPatch: repoPatch,
          note: livePatch == null ? 'no ANTCV_VERSION on the page — boot failure'
            : livePatch >= repoPatch ? 'live is at/ahead of repo target — deploy healthy'
            : `live (${livePatch}) is BELOW repo target (${repoPatch}) — regression or deploy not live yet`,
        },
      };
    },
  },
  {
    id: 'sidecars-live',
    desc: 'Feature sidecars are wired on the LIVE bundle (AntcvJdScope.devQ/deviceId/'
        + 'getCurrentAppId, AntcvTabDocIso, AntcvDebug) — proves the deployed code, not just '
        + 'the repo, carries the parallel-gen + isolation features.',
    async run(page, ctx) {
      await page.goto(ctx.baseUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      const found = await page.evaluate((probes) => probes.map((p) => {
        const parts = p.path.split('.');
        let o = window, ok = true;
        for (const k of parts) { if (o && (k in o || o[k] !== undefined)) o = o[k]; else { ok = false; break; } }
        return { path: p.path, feature: p.feature, present: ok && o !== undefined };
      }), LIVE_SIDECAR_PROBES);
      await ctx.screenshot('sidecars-live');
      const missing = found.filter((f) => !f.present);
      return { pass: missing.length === 0, detail: { missing: missing.map((m) => m.path), all: found } };
    },
  },
  {
    id: 'boot',
    desc: 'App boots with the persona loaded; no uncaught console errors',
    async run(page, ctx) {
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      await ctx.seed({ personalInfo: JSON.stringify(persona) });
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(2500);
      await ctx.screenshot('boot');
      // Filter noise: 3rd-party + favicon + known benign network aborts.
      // Off-production origins can't reach the *.workers.dev relay/proxy, so
      // CORS + resource-load failures on /config are expected, not bundle bugs.
      const real = errors.filter((e) =>
        !/favicon|net::ERR_|Failed to load resource|the server responded|blocked by CORS|Access-Control-Allow|workers\.dev/i.test(e));
      return { pass: real.length === 0, detail: real.slice(0, 5) };
    },
  },
  {
    id: 'debug-logger',
    desc: 'antcv-debug-logger — window.AntcvDebug present, captures an error to '
        + 'localStorage synchronously, and the viewer overlay opens.',
    async run(page, ctx) {
      await ctx.seed({ personalInfo: JSON.stringify(persona) });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(800);
      const out = await page.evaluate(() => {
        const present = !!(window.AntcvDebug && typeof window.AntcvDebug.open === 'function');
        // Synthetic error event — caught by the logger's capture-phase listener.
        try {
          window.dispatchEvent(new ErrorEvent('error', {
            message: '__antcv_qa_probe__', error: new Error('__antcv_qa_probe__'),
          }));
        } catch (e) {}
        let logged = false;
        try {
          const raw = localStorage.getItem('antcv:debug:log') || '[]';
          logged = JSON.parse(raw).some((e) => (e.message || '').includes('__antcv_qa_probe__'));
        } catch (e) {}
        let opened = false;
        try { window.AntcvDebug.open(); opened = !!document.querySelector('[data-antcv-debug-panel]'); } catch (e) {}
        return { present, logged, opened };
      });
      await ctx.screenshot('debug-logger');
      return { pass: !!(out.present && out.logged && out.opened), detail: out };
    },
  },
  {
    id: 'palette-mix',
    desc: 'PACKAGE-PALETTE-MIX-001 — orphan "scandinavian" must resolve to a '
        + 'registry package id on reload; localStorage.stylePackage and '
        + 'body[data-package] must agree (no black-mix render).',
    async run(page, ctx) {
      // Seed the returning-user orphan exactly as the bug describes.
      await ctx.seed({
        personalInfo: JSON.stringify(persona),
        stylePackage: 'scandinavian',
        toneRegister: 'scandinavian',
      });
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(2500);
      const state = await page.evaluate(() => ({
        ls: localStorage.getItem('stylePackage'),
        tone: localStorage.getItem('toneRegister'),
        dataPkg: document.body?.getAttribute('data-package') || null,
      }));
      await ctx.screenshot('palette-mix');
      const lsResolved = state.ls && REGISTRY_PACKAGE_IDS.has(state.ls);
      const agree = state.ls === state.dataPkg;
      const toneResolved = state.tone && state.tone !== 'scandinavian';
      return {
        pass: !!(lsResolved && agree && toneResolved),
        detail: {
          stylePackage: state.ls,
          dataPackage: state.dataPkg,
          toneRegister: state.tone,
          lsResolved, dataPackageAgrees: agree, toneResolved,
          note: lsResolved && agree
            ? 'persisted id unified — APPJS-ID-SCHEME-UNIFY appears LANDED'
            : 'persisted id still orphan — bug OPEN (render-time mitigation only)',
        },
      };
    },
  },
  {
    id: 'demo-config',
    desc: 'DEMO-PERSIST-001 — /config reports user_mode/demo_mode for the signed-in '
        + 'account (auth-gated).',
    auth: true,
    async run(page, ctx) {
      const cfg = await page.evaluate(async () => {
        try {
          const r = await fetch('/config', { credentials: 'include' });
          return { status: r.status, body: await r.json() };
        } catch (e) { return { error: String(e) }; }
      });
      return {
        pass: cfg.body && typeof cfg.body.demo_mode === 'boolean',
        detail: {
          status: cfg.status,
          user_mode: cfg.body?.user_mode,
          demo_mode: cfg.body?.demo_mode,
          note: 'A demo account must read demo_mode:true. paid+demo_mode:false '
              + 'for a demo user == DEMO-PERSIST-001 still OPEN.',
        },
      };
    },
  },
  {
    id: 'demo-mode-roundtrip',
    desc: 'DEMO-PERSIST-001 — POST /api/user/mode {demo} then GET must read back '
        + 'demo (auth-gated; proves the write path, not an allowlist pin).',
    auth: true,
    async run(page, ctx) {
      const out = await page.evaluate(async () => {
        const post = await fetch('/api/user/mode', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ mode: 'demo' }),
        });
        const postBody = await post.json().catch(() => ({}));
        const get = await fetch('/api/user/mode', { credentials: 'include' });
        const getBody = await get.json().catch(() => ({}));
        return { postStatus: post.status, postBody, getStatus: get.status, getBody };
      });
      return {
        pass: out.postStatus === 200 && out.getBody?.mode === 'demo',
        detail: out,
      };
    },
  },
  {
    id: 'mobile-panel-zoom',
    desc: 'MOBILE-PANEL-ZOOM-001 — the generation options cluster (Speed / Cap $ / Brand fit) '
        + 'below "Generate CV & Cover Letter" must be reachable by scroll on a short viewport, '
        + 'never permanently clipped (root cause was the upload-screen .fade container missing '
        + 'its own scroll while #root is viewport-locked).',
    async run(page, ctx) {
      await ctx.seed({ personalInfo: JSON.stringify(persona) });
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(2500);
      const brandFit = page.getByText('Brand fit', { exact: false }).first();
      if ((await brandFit.count()) === 0) {
        await ctx.screenshot('mobile-panel-zoom');
        return { pass: false, detail: { found: false, note: 'Brand fit control not found — selector or app state changed' } };
      }
      await brandFit.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const box = await brandFit.boundingBox();
      const viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
      await ctx.screenshot('mobile-panel-zoom');
      const visible = !!(box && box.y >= 0 && box.y + box.height <= viewport.height);
      return {
        pass: visible,
        detail: {
          box, viewport, visible,
          note: visible
            ? 'Brand fit reachable by scroll — MOBILE-PANEL-ZOOM-001 fix holds'
            : 'Brand fit still clipped after scroll — regression or fix incomplete',
        },
      };
    },
  },
];

// Runs the selected checks against an already-open `page`, in-process (no
// browser lifecycle here — caller owns launch/close). Returns the same
// `results` array shape both harnesses used to build inline.
export async function runChecks(page, ctx, { only = null, jwt = null } = {}) {
  const selected = CHECKS.filter((c) => (only ? c.id === only : true));
  const results = [];
  for (const c of selected) {
    if (c.auth && !jwt) {
      results.push({ id: c.id, skipped: true, reason: 'auth-gated; pass --jwt to run' });
      console.log(`SKIP  ${c.id} — needs --jwt`);
      continue;
    }
    process.stdout.write(`RUN   ${c.id} … `);
    try {
      const r = await c.run(page, ctx);
      results.push({ id: c.id, desc: c.desc, ...r });
      console.log(r.pass ? 'PASS' : 'FAIL');
      if (!r.pass) console.log('      ' + JSON.stringify(r.detail));
    } catch (e) {
      results.push({ id: c.id, pass: false, error: String(e) });
      console.log('ERROR\n      ' + String(e));
    }
  }
  return results;
}
