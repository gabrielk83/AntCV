// AntCV security escalation notifier (SECURITY-WEEKLY-001).
// ============================================================
// Sends the admin an EMAIL + SMS when a production/CRITICAL security
// finding needs immediate approval (see SECURITY_UPDATE_POLICY.md). Called
// by the weekly workflow on exit 2, or standalone:
//     node scripts/security-notify.mjs "message text"
//
// Providers are chosen by which secrets are present (GitHub Action secrets
// / env vars). NOTHING is hard-coded; with no secrets the script logs a
// clear "not configured" notice and exits 0 (it never fails the run — the
// audit already failed and the GitHub run itself is the fallback signal).
//
//   EMAIL  (any one):
//     - Resend:   RESEND_API_KEY            (+ optional SEC_FROM_EMAIL)
//     - SMTP:     SMTP_URL                   (smtp://user:pass@host:port) — via a tiny fetch-less fallback is NOT supported; Resend preferred
//   SMS:
//     - Twilio:   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM
//
// Recipients (fixed per owner directive 2026-06-13):
const ADMIN_EMAIL = 'karp.gabriel.a@gmail.com';
const ADMIN_SMS = '+4531710072';

const msg = process.argv.slice(2).join(' ').trim()
  || process.env.SEC_ALERT_MESSAGE
  || 'AntCV security audit flagged a PRODUCTION vulnerability or CRITICAL advisory. Review + approve a patch. See docs/security/SECURITY_UPDATE_POLICY.md.';
const subject = 'AntCV SECURITY — immediate approval needed';
const body = `${subject}\n\n${msg}\n\nRun: ${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${process.env.GITHUB_REPOSITORY || 'gabrielk83/AntCV'}/actions\nPolicy: docs/security/SECURITY_UPDATE_POLICY.md`;

let sent = 0;

async function sendEmail() {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.log('[notify] email: RESEND_API_KEY not set — skipped'); return; }
  const from = process.env.SEC_FROM_EMAIL || 'AntCV Security <onboarding@resend.dev>';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [ADMIN_EMAIL], subject, text: body }),
    });
    if (res.ok) { console.log('[notify] email sent to ' + ADMIN_EMAIL); sent++; }
    else console.log('[notify] email failed: HTTP ' + res.status + ' ' + (await res.text()).slice(0, 200));
  } catch (e) { console.log('[notify] email error: ' + (e && e.message)); }
}

async function sendSms() {
  const sid = process.env.TWILIO_ACCOUNT_SID, tok = process.env.TWILIO_AUTH_TOKEN, from = process.env.TWILIO_FROM;
  if (!sid || !tok || !from) { console.log('[notify] sms: TWILIO_* not set — skipped'); return; }
  try {
    const form = new URLSearchParams({ To: ADMIN_SMS, From: from, Body: subject + ' — ' + msg.slice(0, 240) });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: 'Basic ' + Buffer.from(sid + ':' + tok).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    if (res.ok) { console.log('[notify] SMS sent to ' + ADMIN_SMS); sent++; }
    else console.log('[notify] SMS failed: HTTP ' + res.status + ' ' + (await res.text()).slice(0, 200));
  } catch (e) { console.log('[notify] sms error: ' + (e && e.message)); }
}

await sendEmail();
await sendSms();

if (!sent) {
  console.log('[notify] NO channel configured — set RESEND_API_KEY (email) and/or TWILIO_* (SMS) as repo secrets.');
  console.log('[notify] Manual escalation REQUIRED now: email ' + ADMIN_EMAIL + ' + SMS ' + ADMIN_SMS);
}
process.exit(0); // never fail the run further; the audit exit-2 is the signal
