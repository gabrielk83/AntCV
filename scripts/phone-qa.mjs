// AntCV physical-device browser QA — runs the same checks as browser-qa.mjs,
// but against real Chrome on a USB (or wireless-adb) connected Android phone.
// No emulation: this is the actual device browser, actual JS engine, actual
// network stack.
//
// Drives it via Playwright's chromium.connectOverCDP() against Chrome's own
// devtools socket (manually adb-forwarded), NOT Playwright's `_android`
// module's launchBrowser(). launchBrowser() hangs indefinitely on a stock
// retail ("user" build) phone — it depends on Chrome's command-line-flags
// file (/data/local/tmp/chrome-command-line), which production Android
// builds ignore for security (only userdebug/eng builds honor it). Chrome's
// CDP socket itself works fine on a stock phone the moment USB/Wi-Fi
// debugging is on — verified directly (`adb forward` + GET /json/version)
// before writing this — so we drive that socket ourselves instead.
//
//   node scripts/phone-qa.mjs --list-devices
//   node scripts/phone-qa.mjs                          # localhost:8788 dev server
//   node scripts/phone-qa.mjs --url http://localhost:8788
//   node scripts/phone-qa.mjs --url https://antcv.pages.dev
//   node scripts/phone-qa.mjs --serial <deviceSerial>   # pick device when >1 connected
//   node scripts/phone-qa.mjs --only palette-mix
//   node scripts/phone-qa.mjs --jwt "<token>"
//
// One-time prereqs (per machine):
//   1. Install Android platform-tools (adb) — `winget install Google.PlatformTools`
//      or download from developer.android.com/tools/releases/platform-tools.
//   2. On the phone: Settings > About phone > tap "Build number" 7x to unlock
//      Developer Options, then Settings > Developer options > USB debugging: on.
//   3. Plug the phone in via USB (or `adb pair`/`adb connect` for wireless) and
//      accept the "Allow USB debugging?" RSA-key prompt on the phone screen —
//      check "Always allow from this computer" so it isn't re-asked.
//   4. `adb devices` should list the phone as "device", not "unauthorized" or
//      "offline". If it shows nothing, re-check step 2/3.
//   5. npm i -D playwright  (already a devDependency here)
//
// How the target URL reaches the phone: a phone and this desktop are separate
// network namespaces, so "localhost" on the phone means the phone itself, not
// this machine's dev server. For a `--url http://localhost:PORT` target, this
// script runs `adb reverse tcp:PORT tcp:PORT` first, which makes the phone's
// localhost:PORT tunnel back to this machine's PORT over the USB/adb link —
// works even with the phone on cellular data, no shared Wi-Fi needed. Pass
// --no-reverse if your --url is already directly reachable from the phone
// (a LAN IP, or a public URL like the production site).
//
// Checks live in scripts/qa-checks.mjs and are shared with browser-qa.mjs.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { persona, runChecks } from './qa-checks.mjs';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const SHOT_DIR = join(ROOT, 'docs', 'qa', 'screenshots', 'phone');
const REPORT = join(ROOT, 'docs', 'qa', 'last-phone-qa.json');

// ── args ───────────────────────────────────────────────────────────────────
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}
const baseUrl = String(arg('url', 'http://localhost:8788')).replace(/\/$/, '');
const serial = arg('serial', null);
const only = arg('only', null);
const jwt = arg('jwt', process.env.ANTCV_QA_JWT || null);
const noReverse = !!arg('no-reverse', false);
const listOnly = !!arg('list-devices', false);
const timeoutMs = Number(arg('timeout-ms', 120000));
const cdpPort = Number(arg('cdp-port', 9333));

// The phone's screen locking/timing out mid-run can drop the debug session
// silently (no socket error, just a dead connection) — without a watchdog
// device.launchBrowser()/runChecks() then hangs forever instead of failing.
function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const localMatch = baseUrl.match(/^https?:\/\/(?:localhost|127\.0\.0\.1):(\d+)$/);
const reversePort = localMatch ? localMatch[1] : null;

function adb(args, { serial: s } = {}) {
  const full = s ? ['-s', s, ...args] : args;
  return spawnSync('adb', full, { encoding: 'utf8' });
}

// The adb server on 127.0.0.1:5037 is a shared singleton — any other
// adb-based tool (scrcpy, SuperDisplay, Android Studio, Vysor...) can kill
// and replace it mid-session if it bundles a different adb version, which
// surfaces here as an unhandled ECONNRESET/ECONNREFUSED on Playwright's
// android-driver socket, not a catchable exception from our own calls.
process.on('uncaughtException', (e) => {
  if (e && (e.code === 'ECONNRESET' || e.code === 'ECONNREFUSED') && e.port === 5037) {
    console.error(
      '\nLost the adb server connection mid-run (port 5037 reset/refused).\n'
      + 'Usually caused by another adb-based app (scrcpy, SuperDisplay, Vysor,\n'
      + 'Android Studio...) restarting the shared adb server with a different\n'
      + 'version while this script was using it. Quit any such app and re-run.\n'
    );
    process.exit(2);
  }
  throw e;
});

// Polls Chrome's devtools HTTP endpoint until it answers (cold-start after
// `am start` isn't instant) and returns the browser-level webSocket URL.
async function waitForCdp(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${port}/json/version`);
      const json = await res.json();
      if (json.webSocketDebuggerUrl) return json.webSocketDebuggerUrl;
    } catch (e) { lastErr = e; }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Chrome devtools socket never answered on :${port} — ${lastErr}`);
}

async function main() {
  let _android, chromium;
  try {
    ({ _android, chromium } = await import('playwright'));
  } catch {
    console.error(
      '\nPlaywright is not installed. One-time setup:\n'
      + '  npm i -D playwright\n'
      + '\n(Android support ships inside the playwright package itself — no\n'
      + 'separate "playwright install" step is needed for a real device.)\n'
    );
    process.exit(2);
  }

  // Sanity-check adb is reachable before asking Playwright to talk to the ADB
  // server — a clearer error than whatever Playwright's internal client throws.
  const probe = spawnSync('adb', ['version'], { encoding: 'utf8' });
  if (probe.error) {
    console.error(
      '\nadb not found on PATH. Install Android platform-tools first:\n'
      + '  winget install Google.PlatformTools\n'
      + 'then re-open your shell so PATH picks it up.\n'
    );
    process.exit(2);
  }

  const devices = await _android.devices();
  if (listOnly) {
    if (!devices.length) {
      console.log('No devices. Run `adb devices` — phone should show as "device" (not "unauthorized").');
    } else {
      for (const d of devices) {
        console.log(`${d.serial()}  ${await d.model()}`);
      }
    }
    process.exit(0);
  }
  if (!devices.length) {
    console.error(
      '\nNo Android devices detected via adb.\n'
      + 'Checklist:\n'
      + '  - USB cable plugged in (or `adb connect <ip>:<port>` for wireless)\n'
      + '  - Developer options > USB debugging: on\n'
      + '  - Accept the "Allow USB debugging?" prompt on the phone screen\n'
      + '  - `adb devices` shows the phone as "device", not "unauthorized"/"offline"\n'
    );
    process.exit(2);
  }
  const device = serial
    ? devices.find((d) => d.serial() === serial)
    : devices[0];
  if (!device) {
    console.error(`No connected device with serial ${serial}. Devices: ${devices.map((d) => d.serial()).join(', ')}`);
    process.exit(2);
  }
  if (!serial && devices.length > 1) {
    console.log(`Multiple devices connected; using ${device.serial()} (${await device.model()}). `
      + `Pass --serial to pick another: ${devices.map((d) => d.serial()).join(', ')}`);
  }
  console.log(`Device: ${await device.model()} (${device.serial()})`);

  let reversed = false;
  if (reversePort && !noReverse) {
    const r = adb(['reverse', `tcp:${reversePort}`, `tcp:${reversePort}`], { serial: device.serial() });
    if (r.status !== 0) {
      console.error(`adb reverse failed:\n${r.stderr || r.stdout}`);
      process.exit(2);
    }
    reversed = true;
    console.log(`adb reverse tcp:${reversePort} tcp:${reversePort} — phone's localhost:${reversePort} now reaches this machine.`);
  }

  mkdirSync(SHOT_DIR, { recursive: true });

  // Fresh Chrome, forwarded devtools socket. Force-stop first so a leftover
  // tab/session from a prior aborted run can't wedge the new connection.
  adb(['shell', 'am', 'force-stop', 'com.android.chrome'], { serial: device.serial() });
  adb(['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', 'about:blank', 'com.android.chrome'],
    { serial: device.serial() });
  adb(['forward', '--remove', `tcp:${cdpPort}`], { serial: device.serial() }); // stale forward from a prior run
  const fwd = adb(['forward', `tcp:${cdpPort}`, 'localabstract:chrome_devtools_remote'], { serial: device.serial() });
  if (fwd.status !== 0) {
    console.error(`adb forward (devtools) failed:\n${fwd.stderr || fwd.stdout}`);
    process.exit(2);
  }

  let browser, results = [];
  try {
    results = await withTimeout((async () => {
      const wsUrl = await waitForCdp(cdpPort, 15000);
      browser = await chromium.connectOverCDP(wsUrl);
      const context = browser.contexts()[0] || await browser.newContext();
      if (jwt) {
        await context.setExtraHTTPHeaders({ Authorization: `Bearer ${jwt}` });
      }
      // Reuse the tab `am start` just opened rather than adding another —
      // avoids piling up blank tabs across repeated runs.
      const page = context.pages()[0] || await context.newPage();

      const ctx = {
        baseUrl,
        persona,
        async seed(state) {
          await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
          await page.evaluate((kv) => {
            for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
          }, state);
        },
        async screenshot(name) {
          await page.screenshot({ path: join(SHOT_DIR, `${name}.png`), fullPage: false });
        },
      };

      return runChecks(page, ctx, { only, jwt });
    })(), timeoutMs, `Timed out after ${timeoutMs}ms — the phone likely dropped the debug `
      + `session (screen locked/timed out, or USB/Wi-Fi link died mid-run). Keep the phone `
      + `screen awake and reconnected for the duration of the test, then re-run.`);
  } finally {
    // Cleanup itself talks to the same (possibly-dead) connection — cap it
    // short rather than let a hung close() re-introduce the original hang.
    if (browser) await withTimeout(browser.close(), 5000, 'close timed out').catch(() => {});
    adb(['forward', '--remove', `tcp:${cdpPort}`], { serial: device.serial() });
    if (reversed) adb(['reverse', '--remove', `tcp:${reversePort}`], { serial: device.serial() });
  }

  const report = { baseUrl, device: device.serial(), ranAt: new Date().toISOString(), results };
  mkdirSync(dirname(REPORT), { recursive: true });
  writeFileSync(REPORT, JSON.stringify(report, null, 2));

  const ran = results.filter((r) => !r.skipped);
  const failed = ran.filter((r) => !r.pass);
  console.log(`\n${ran.length - failed.length}/${ran.length} passed `
    + `(${results.length - ran.length} skipped). Report → docs/qa/last-phone-qa.json`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(`\n${e.message || e}\n`);
  process.exit(2);
});
