// AntCV weekly security audit (SECURITY-DEPS-001 / SECURITY-WEEKLY-001).
// ============================================================
// Runs `npm audit` for the repo, separates PRODUCTION vulnerabilities
// (the ones that ship) from dev-only advisories, and prints a report the
// weekly scheduled routine relays to the admin.
//
// Exit codes (consumed by the scheduled routine):
//   0  = clean OR dev-only advisories only (informational — weekly report)
//   2  = NEW production vulnerability OR any CRITICAL severity -> ESCALATE
//        to the admin immediately (email + SMS +45 31710072) for approval.
//
// Run: node scripts/security-audit.mjs
import { execSync } from 'node:child_process';

function audit(args) {
  try {
    const out = execSync('npm audit --json ' + args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return JSON.parse(out);
  } catch (e) {
    // npm audit exits non-zero when vulns exist; the JSON is still on stdout
    try { return JSON.parse(e.stdout || '{}'); } catch (_) { return {}; }
  }
}

function counts(report) {
  const m = (report && report.metadata && report.metadata.vulnerabilities) || {};
  return { critical: m.critical || 0, high: m.high || 0, moderate: m.moderate || 0, low: m.low || 0, total: m.total || 0 };
}

const full = audit('');
const prod = audit('--omit=dev');
const fc = counts(full);
const pc = counts(prod);

const advisories = [];
try {
  for (const k of Object.keys(full.vulnerabilities || {})) {
    const v = full.vulnerabilities[k];
    (v.via || []).forEach((via) => {
      if (via && typeof via === 'object' && via.title) advisories.push(`${v.severity.toUpperCase()} ${via.title} (${via.url || 'no-url'})`);
    });
  }
} catch (_) {}

const stamp = new Date().toISOString().slice(0, 10);
console.log(`=== AntCV security audit ${stamp} ===`);
console.log(`PRODUCTION (ships): critical=${pc.critical} high=${pc.high} moderate=${pc.moderate} low=${pc.low}`);
console.log(`FULL (incl dev):    critical=${fc.critical} high=${fc.high} moderate=${fc.moderate} low=${fc.low}`);
if (advisories.length) {
  console.log('Advisories:');
  [...new Set(advisories)].forEach((a) => console.log('  - ' + a));
}

const escalate = pc.total > 0 || fc.critical > 0;
if (escalate) {
  console.log('\nVERDICT: ESCALATE — production vulnerability or CRITICAL advisory present.');
  console.log('ACTION: notify admin immediately (email karp.gabriel.a@gmail.com + SMS +45 31710072) and request approval before patching.');
  process.exit(2);
}
console.log('\nVERDICT: OK — 0 production vulnerabilities (dev-only advisories tracked in package.json comment:security). Weekly report only.');
process.exit(0);
