# AntCV security-update policy (SECURITY-WEEKLY-001)

Owner directive 2026-06-13: implement security updates on a weekly basis,
report to admin when needed or done; if a supplier ships a **critical**
update, advise the admin **immediately** (email + SMS) and ask for
immediate approval before applying.

## Admin contact

- **Email:** karp.gabriel.a@gmail.com
- **SMS / phone:** +45 31710072

## Weekly cadence (every Monday)

1. Run `node scripts/security-audit.mjs` (npm audit, production vs dev split)
   over the repo + the Cloudflare worker runtimes.
2. Also review supplier advisories for the production suppliers:
   - **Cloudflare** Workers/Pages runtime + `wrangler` releases.
   - **LLM providers** (Anthropic, OpenAI, Mistral, Gemini) API/security notices.
   - **CloudConvert** (PDF render) + any approved **custom LLM** endpoints.
   - npm production dependencies (currently: none with known vulns).
3. **Report to admin** with the verdict:
   - `OK` (exit 0) — 0 production vulnerabilities → a short "weekly security
     report: clean" note. Dev-only advisories are listed but not escalated.
   - `ESCALATE` (exit 2) — a production vulnerability or any CRITICAL
     advisory → see escalation below.

## Escalation — critical supplier update

When a supplier issues a **critical** update, or the audit returns exit 2:

1. **Immediately** notify the admin by **email AND SMS** (+45 31710072) with:
   the advisory id, the affected supplier/component, the production impact,
   and the proposed patch.
2. **Ask for explicit approval** before applying — do NOT auto-deploy a
   breaking or supplier-critical change without the admin's go-ahead.
3. On approval: apply, run the full gate (tests + boot-smoke + identity
   round-trip for app.js), deploy, and report **done** with the version.

## Decision rule (severity in context, not a blind green audit)

- A **dev-only** advisory (e.g. the esbuild/vite dev-server issues —
  GHSA-67mh-4wv8-2f99, GHSA-gv7w-rqvm-qjhr, GHSA-4w7w-66w2-5vf9) is NOT
  escalated: the shipped `app.js` is built with **terser**, the vite dev
  server is never run in CI/prod, and `npm audit --omit=dev` = 0. Tracked
  in `package.json` `comment:security`; a breaking vite-6 major is
  deliberately deferred.
- A **production** vulnerability (anything in `npm audit --omit=dev`, or a
  Cloudflare/LLM-provider/CloudConvert critical) IS escalated immediately.

## Automation

- `scripts/security-audit.mjs` — the weekly audit (exit 0 = report, exit 2
  = escalate).
- `.github/workflows/security-audit.yml` — runs the audit every Monday
  08:07 UTC (+ on demand). On exit 2 the run FAILS and the **Notify admin**
  step runs `scripts/security-notify.mjs`, which sends the alert.
- `scripts/security-notify.mjs` — sends EMAIL + SMS to the admin
  (karp.gabriel.a@gmail.com / +45 31710072). It is **auto-send-ready** but
  inert until the channel secrets are added (it logs "manual escalation
  required" and exits 0 if none are set, so it never blocks).

### One-time setup to enable auto-send (repo → Settings → Secrets → Actions)

- **Email (Resend):** `RESEND_API_KEY` (free tier). Optional
  `SEC_FROM_EMAIL` (a verified sender; defaults to Resend's onboarding
  address for testing).
- **SMS (Twilio):** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
  `TWILIO_FROM` (a Twilio number). Sends to +45 31710072.

Add either or both — the notifier uses whatever is present. Until then the
failing GitHub run + this policy are the escalation signal.

## Log

| Date | Finding | Production impact | Action | Admin notified |
|------|---------|-------------------|--------|----------------|
| 2026-06-13 | esbuild/vite dev-server advisories (3) | **none** (0 prod) | bumped vite 5.4.11→5.4.21; documented dev-only accepted risk; deferred breaking vite-6 | weekly report (no escalation — dev-only) |
