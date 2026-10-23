# EU AI Act and GDPR: what AntCV must do, what it does, what is open

Status 2026-10-23. Not legal advice. Law text as amended by the Digital Omnibus (applies since 27 Jul 2026); check the AI Act Explorer (artificialintelligenceact.eu) before relying on a date.

## 1. Role and risk level

| Question | Answer for AntCV | Evidence |
|---|---|---|
| AI system? | Yes. Generates CV and letter text from user input. | - |
| Role | **Provider** of the AntCV system (own name, made available, free or paid). Anthropic, OpenAI, Mistral, Google = providers of the general-purpose models underneath; their Art. 53-55 duties (since 2 Aug 2025) are theirs. A user who sends the output to an employer is not a deployer: purely personal, non-professional use is outside the Act. | - |
| Banned (Art. 5)? | No. No emotion recognition, no biometric categorisation, no manipulation. | - |
| High-risk (Annex III point 4, from 2 Dec 2027)? | No. Annex III covers AI used **by employers or recruiters** to place job ads, filter, rank or evaluate candidates. AntCV drafts the candidate's own documents. | AI notice: "not a recruitment, screening, or candidate-evaluation tool" (`pwa/app.src.js`, `AntcvShowAiNotice`) |
| Transparency (Art. 50) | Applies since 2 Aug 2026. Art. 50(2): provider marks AI-generated text in a machine-readable, detectable way. Systems already on the market before 2 Aug 2026 have until **2 Dec 2026** (Art. 111). | Section 2 |
| AI literacy (Art. 4) | Applies to AntCV's own team since 2 Feb 2025. | - |

**Guard rail (AI-ACT-SCOPE-001).** Any feature that ranks, scores or filters candidates for a third party, or is sold to employers or agencies, moves AntCV into Annex III high-risk. Do not build one without a conformity plan. Position discovery and the job tracker rank **jobs for the candidate**, which is outside Annex III.

## 2. AI Act duties: done and open

| Duty | Status | Where |
|---|---|---|
| Tell the user the text is AI-generated, before first use | Done | AI notice modal (`AntcvShowAiNotice`), acknowledgement stored as `aiDisclosureAccepted` / `aiNoticeAccepted` (`workers/access-relay`) |
| Visible AI notice on the document | Done | AI-NOTICE-FOOTER-001: footer of the last CV page; CL inline notice |
| Machine-readable marking, DOCX | **Done 2026-10-23** (AI-ACT-MARK-001) | `docProps/custom.xml` `AIGenerated=true`, `AIDisclosure`; core `keywords` "AI-assisted" on all three layouts (two-column CV, linear CV, letter). Test: `workers/docx-worker/test/ai-mark-props.test.mjs` |
| Machine-readable marking, robust (C2PA) | **Open, deadline 2 Dec 2026** | `workers/c2pa-worker` is a skeleton: WASM signer and `fetch_tsa` not wired (README section 7). Custom properties are easy to strip; C2PA is the robust layer the Code of Practice expects |
| Machine-readable marking, PDF | **Open** | PDF goes through the converter; add XMP `dc:description` / custom metadata with the same text, or C2PA |
| Model provider terms | Check yearly | Each provider's usage policy and data terms; record the date checked here |

## 3. GDPR

AntCV is **controller** for account data, stored settings and stored CV data. Cloudflare, the e-mail sender and, with the shared demo keys, the LLM providers are **processors**. With the user's own API key, the user's own agreement with that provider applies. The user-facing text is `pwa/privacy.html` (PRIVACY-NOTICE-001); keep it in step with this table.

| Item | Status | Where |
|---|---|---|
| Lawful basis | Contract (Art. 6(1)(b)) for account, profile, drafts and job tracker. Legitimate interest (Art. 6(1)(f)) for the pseudonymous AI usage records (`llm_calls`: hash, provider, model, timing, tokens, error class; no document text) | `pwa/privacy.html` section 3 |
| Information to the user (Art. 13) | **Done 2026-10-23**, one blank: the operator's name and contact e-mail | `pwa/privacy.html`, linked from Settings → Personal ("Privacy notice and AI use") |
| Right of access and portability (Art. 15, 20) | **Done 2026-10-23** (GDPR-RIGHTS-001). "Download my data" covered the browser only; the server half was missing | `GET /api/prefs/export`: KV prefs (API key values masked), every D1 row keyed by the user's hash, retention status, recipients. Button "Copy of my cloud data" (`pwa/antcv-data-export-360.js`) |
| Right to erasure (Art. 17) | **Fixed 2026-10-23** (GDPR-RIGHTS-001). `DELETE /api/prefs` named seven tables and left `job_tracker`, `kernel_showcase`, `kernel_showcase_styled`, `kernel_language_view`, `application_fit`, `application_qualification` and legacy per-user `cluster_top_qualifications` rows to ON DELETE CASCADE; four of them have no foreign key, so their rows survived an account delete | `workers/access-relay/src/gdpr-user-data.js` `USER_TABLES`; `tests/gdpr-user-data.test.mjs` fails when a new `user_hash` table is not listed |
| Storage limitation (Art. 5(1)(e)) | **Partial.** Usage records: 90 days raw, 30 days health (`telemetry.js` `pruneOld`). Account data: yearly renewal prompt (`RETENTION_DAYS` 365, reminder e-mail, `/api/prefs/renew`), but the reminder is sent only when the user signs in, and nothing deletes an account that never returns | Open item 4 |
| Minimisation | Done | CL-GDPR-CV-001 (CV on request in unsolicited letters); REFERENCES-RELATION-001 (only agreed referees, contact details on request); the photo reaches a vision model only when the local orientation check is unsure (`photo-orientation.js`) |
| Special categories (Art. 9) | **Rule 2026-10-23** (SPECIAL-CATEGORIES-001) | `pwa/gold-rules.json` 1.9.7 prompt block: never infer, add or expand health, belief, politics, union, ethnicity, sex life, criminal records; no ID number, date of birth, marital status or children unless the source states it and the country expects it |
| Processors and transfers (Art. 28, 44-46) | **Done in the notice**; contracts to confirm | `pwa/privacy.html` section 4: Cloudflare, Anthropic, OpenAI, Google, Mistral AI (EU), Resend; US transfers under the EU-US Data Privacy Framework or SCCs per each DPA. Open item 5 |
| No training on user data | **To confirm per provider** | Demo keys must be paid API accounts whose terms exclude training on input. A free-tier Gemini key may be used for product improvement; never put one behind the demo proxy |
| Security (Art. 32) | Done | API keys server-side in KV and masked in the data copy, rows keyed by e-mail hash, export passphrase option, privacy LED (`pwa/antcv-privacy-led.js`) |
| Breach (Art. 33) | Process | Report to the supervisory authority (Datatilsynet) within 72 hours where required |
| Automated decisions (Art. 22) | Not applicable | AntCV makes no decision about the user and gives no score to an employer (see AI-ACT-SCOPE-001) |

### Where the two laws meet in AntCV

```
              job seeker (data subject, author of the documents)
                     │ profile, job ad, photo
                     ▼
   ┌──────────────── AntCV (GDPR controller · AI Act provider) ────────────────┐
   │ PWA (browser storage)  ──►  relay: D1 + KV (Cloudflare, processor)        │
   │        │                                                                  │
   │        └──► proxy ──► LLM providers (GPAI providers; processors on demo)  │
   │                                                                           │
   │ out: CV / letter with visible AI notice + machine-readable AI mark         │
   └───────────────────────────────────────────────────────────────────────────┘
                     │ the user sends it (personal use: outside the AI Act)
                     ▼
              employer ── ranks candidates with AI? THAT tool is Annex III high-risk,
                          AntCV is not, as long as AI-ACT-SCOPE-001 holds
```

## 4. Open items, in order

1. **C2PA signing live before 2 Dec 2026** (Art. 50(2), Art. 111). Owner: c2pa-worker.
2. **PDF marking** with the same text as AI-ACT-MARK-001.
3. **Operator name and contact e-mail** in `pwa/privacy.html` section 1 before any public launch (Art. 13(1)(a)).
4. **Inactive-account deletion**: a scheduled job that deletes accounts not renewed within `RETENTION_DAYS` + 30 days (and sends the reminder from the cron, not only on sign-in). Irreversible, so it ships behind a dry-run log first.
5. **Provider terms check**, yearly: data processing terms, transfer basis and "no training on API input" for each demo key; record the date here.
6. AI literacy (Art. 4): one page for anyone who operates AntCV, pointing to this file.

## Sources

- Regulation (EU) 2024/1689 (AI Act): Art. 3, 4, 5, 25, 50, 53, 111, 113, Annex III. AI Act Explorer and Compliance Checker, artificialintelligenceact.eu.
- Regulation (EU) 2016/679 (GDPR): Art. 5, 6, 9, 13, 15, 16, 17, 18, 20, 21, 22, 28, 32, 33, 44-46.
- Datatilsynet, fundamental concepts, datatilsynet.dk/english.
- Improve Business Academy, Applied AI course deck "AI Ethics & Compliance" (2026): dates table and SME checklist.
