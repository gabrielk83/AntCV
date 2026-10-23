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

AntCV is **controller** for account data, stored settings and stored CV data. LLM providers, Cloudflare and the e-mail sender are **processors** or independent controllers per their terms.

| Item | Status | Where |
|---|---|---|
| Lawful basis | Contract (Art. 6(1)(b)): the user asks AntCV to draft their documents | - |
| Information to the user (Art. 13) | **Partial.** The AI notice names the providers and says text goes to the chosen one. No privacy notice page lists controller contact, purposes, retention, processors, transfers and rights | Open: add `pwa/privacy.html` and link it from the AI notice and the sign-in screen |
| Right of access and portability (Art. 15, 20) | Done | "Download my data" (`pwa/antcv-data-export-360.js`) |
| Right to erasure (Art. 17) | Done | `DELETE /api/prefs` full-account deletion (`workers/access-relay`) |
| Storage limitation (Art. 5(1)(e)) | Done | `RETENTION_DAYS` (default 365), reminder e-mail, `/api/prefs/renew` (`workers/access-relay`) |
| Minimisation | Done for letters | CL-GDPR-CV-001: unsolicited letters offer the CV on request instead of attaching it |
| Special categories (Art. 9) | Rule | Health, beliefs, union membership and similar appear only if the user typed them; the writing engine never infers or adds them. An accessibility line is the user's own choice |
| Processors and transfers (Art. 28, 44) | **Open** | List each LLM provider, Cloudflare and the e-mail sender with region and transfer basis in the privacy notice |
| Security (Art. 32) | Done | API keys server-side in KV, export passphrase option, privacy LED (`pwa/antcv-privacy-led.js`) |
| Breach (Art. 33) | Process | Report to the supervisory authority (Datatilsynet) within 72 hours where required |

## 4. Open items, in order

1. **C2PA signing live before 2 Dec 2026** (Art. 50(2), Art. 111). Owner: c2pa-worker.
2. **PDF marking** with the same text as AI-ACT-MARK-001.
3. **Privacy notice page** (Art. 13) with the processor list (Art. 28).
4. Record the yearly check of provider terms in section 2.

## Sources

- Regulation (EU) 2024/1689 (AI Act): Art. 3, 4, 5, 25, 50, 53, 111, 113, Annex III. AI Act Explorer and Compliance Checker, artificialintelligenceact.eu.
- Regulation (EU) 2016/679 (GDPR): Art. 5, 6, 9, 13, 15, 17, 20, 28, 32, 33, 44.
- Datatilsynet, fundamental concepts, datatilsynet.dk/english.
- Improve Business Academy, Applied AI course deck "AI Ethics & Compliance" (2026): dates table and SME checklist.
