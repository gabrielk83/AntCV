# DAMC — Requests to internal Legal and IT teams

**Status: DRAFT — NOT SENT.** Owner instruction 2026-11-05: prepare, do not send at this stage.

| Field | Value |
|---|---|
| Document ID | DAMC-REQ-001 |
| Version | 0.3 (draft). 0.3: attachments point to guidelines v0.5; requests follow DAMC-STY-001 Section 9; scope expansion repeats L-01 (step 8). 0.2: entailment (NLI) models in IT-05 scope, evaluation sandbox and monthly tool watch (IT-05 items 10–11). |
| Date | 2026-11-05 |
| Belongs to | DAMC-IG-001 v0.5 (`docs/plan/DAMC_Implementation_Guidelines_2026-11-05.md`) |
| Sender (role) | PMO lead, DAMC system owner |
| Phase | Phase 0, Governance |

---

## How to use these drafts

1. Replace every `<placeholder>`. Remove requests that do not fit the company's team structure; merge where one team covers two areas.
2. Send through the channel each team uses (ticket system, shared mailbox). One request per team keeps ownership clear.
3. Attach DAMC-IG-001 v0.5 as PDF. Point to section and requirement IDs; do not paste the guidelines into the request.
4. No personal data, no customer names, no project content in any request.
5. Log every request in the request log (last section) on the day it is sent. Phase 0 cannot close until each row is closed or carried with a date.
6. Every IT request says "implement only if not already in place". Ask for what exists before asking for anything new.
7. Format each request per DAMC-STY-001 Section 9: one to two pages, numbered asks, each with a "done when".
8. When DAMC's scope expands to a new country, region, site, language or legislation, repeat L-01 sections A–G and the affected IT requests for that scope (scope expansion step, Guidelines 11.4).

---

## Shared context block (paste at the top of every request)

> We are preparing an internal tool, working name DAMC (Document Analysis, Monitoring and Control). It reads project-management and hardware-process documents on the company OneDrive. It checks them for factual errors, inconsistencies within and between documents, missing process evidence, unclear wording, and language and regional format problems. Findings go to a human reviewer, who decides.
>
> Design limits:
> - It runs on one managed company device, with a local AI model and no internet access.
> - Human-written files stay read-only. It writes only its own reports, and updates only files that company tools generated.
> - It does not score, rank or monitor people. It does not infer emotions.
> - It is not built yet. We are in the governance phase (Phase 0) and want your input before any build starts.
>
> The implementation guidelines (DAMC-IG-001 v0.5) are attached. References in this request (e.g. GDPR-05, SEC-21) point to requirement IDs in that document.

---

## Part A — Internal Legal

### L-01 Legal department (main request)

**To:** `<Legal department / legal counsel for IT, data and technology>`
**Cc:** `<DPO, if separate>`, `<HR contact for employee consultation>`
**Subject:** Legal review request — internal AI document-analysis tool (DAMC), Phase 0

`<Shared context block>`

We ask Legal to answer the questions below. For each one, a short written answer is enough: **confirmed**, **changed** (with the change), or **needs external counsel** (with the reason). We also ask for one named legal contact for the project.

**A. EU AI Act**
1. Please confirm our reading: the company is provider and deployer of an in-house AI system, and the system is not high-risk as long as it never scores, ranks or monitors individuals (NG-1) and never infers emotions (NG-2). (Guidelines 6.1)
2. Article 50: do our internal reports need the visible AI disclosure and machine-readable marker we propose (AIA-04, DOC-02)? Is there company-standard wording?
3. Article 4, AI literacy: does the company already have a training programme and record format we should reuse? (AIA-02)
4. Please confirm the Digital Omnibus on AI dates and regulation number listed in Appendix B (reported as Regulation (EU) 2026/1744; Annex III high-risk obligations moved to 2 Dec 2027).
5. Who in the company signs the AI Act classification memo and the per-feature checks? (AIA-01)

**B. GDPR**
1. Lawful basis: is legitimate interest (Art. 6(1)(f)) the right basis for scanning project documents? Who writes and approves the legitimate-interest assessment? (GDPR-01)
2. DPIA: please confirm it is required. Which company template, and who owns it? (GDPR-12)
3. Retention: please approve or set the periods proposed in GDPR-05 (text cache ≤ 30 days, findings 24 months, audit log per records policy).
4. Staff notice: please approve the text and the distribution channel. (GDPR-02)
5. Record of processing: who updates the company RoPA entry? (GDPR-09)
6. Data subject requests: which route and deadline handling should DAMC follow? (GDPR-14)
7. Employment-context rules: the Danish Data Protection Act provision on employment data (§ 12) and the equivalent rules in each other country where project staff work.

**C. Employee consultation** (please coordinate with HR)
1. Which information or consultation steps apply per country (Denmark, Sweden, Norway, Finland, Germany, `<other sites>`)? What notice periods apply, and who runs each step? (Guidelines 5.1)
2. Do these steps still apply when the design provably does not monitor individuals?

**D. Confidential third-party information**
1. May an internal tool with a local AI model analyse supplier and customer documents covered by NDAs? Are there contracts that forbid automated or AI processing? (HW-16)
2. Default rule for naming third parties in DAMC reports: we propose role-level wording only.

**E. Licences for local reference copies** (Guidelines 9, MIR-07)
1. May we keep internal copies of: EU and national law texts (EUR-Lex, Retsinformation, Riksdagen/SFS, Lovdata, Finlex)? Language references (Retskrivningsordbogen, SAOL, Bokmålsordboka/Nynorskordboka, Kielitoimiston sanakirja)? Standards metadata (number, title, edition, status)?
2. Open-source libraries (e.g. `pypdf`) and open-weight AI models: any licence types the company restricts?

**F. Optional external AI service** (Tier 2, off by default)
1. If an external enterprise AI service is ever switched on: which DPA terms, data location, no-training clause and transfer assessment does the company require? Is there an approved provider list? (GDPR-08, GDPR-13)

**G. Liability, records, international**
1. Disclaimer wording for advisory findings, and who may sign a report. (NG-6, DOC-01)
2. Retention of the audit log and evidence packs under the company records policy.
3. Sites outside the EU (`<e.g. US, China, Japan, Korea, India, LATAM>`): which need local counsel before their documents are analysed? (INTL-11)
4. Please confirm or correct every item tagged `[C]` or `[V2]` in Appendix B. Until confirmed, the guidelines forbid `[C]` items from driving high-severity findings.

**What we need back:** written answers per question; one named legal contact; sign-off of Appendix B.
**Proposed timing:** 45-minute kick-off within `<2>` weeks; written answers within `<4>` weeks.
**Attachments:** DAMC-IG-001 v0.5 (PDF).

Kind regards,
`<name>`, `<role>`

---

### L-02 Data Protection Officer (if separate from Legal)

**To:** `<DPO>`
**Subject:** DPO consultation — DPIA and privacy design for DAMC (Art. 35(2) GDPR)

`<Shared context block>`

Under Art. 35(2) GDPR we seek the DPO's advice before the DPIA. We ask for:

1. Your view on whether a DPIA is required, and the template to use. (GDPR-12)
2. Review of the privacy design: role tokens in place of names before any AI processing, blocking of special-category data and national ID numbers, no person-level views. (GDPR-03, GDPR-04, GDPR-07, NG-1)
3. Retention periods and the automatic deletion job. (GDPR-05)
4. The store inventory and erasure test for data subject requests. (GDPR-14)
5. The breach runbook and the 72-hour notification path. (GDPR-11, INC-01)
6. The learning data from reviewer disagreement: kept per check and per role, reviewer identity as a keyed hash, no per-person statistics. (LEARN-09)

**What we need back:** DPO opinion in writing; named DPO contact for the DPIA.
**Proposed timing:** `<date>`.

Kind regards,
`<name>`, `<role>`

---

### L-03 Trade compliance / export control

**To:** `<Trade compliance / export control function>`
**Subject:** Export control handling — internal document-analysis tool (DAMC)

`<Shared context block>`

DAMC will read hardware-process documents (specifications, drawings metadata, BOMs, test reports). Some may hold export-controlled technical data.

1. How are export-controlled documents marked today (ECCN, EU dual-use, ITAR/EAR notes, internal labels)? We need the exact markings so DAMC can detect them. (SEC-25, HW-11)
2. Please confirm the proposed handling: such documents are processed only by deterministic rules on the local device (Tier 0), never by any external service, never leave the EU, and reports show the finding without the controlled content.
3. Does any customer or supplier contract add restrictions beyond the regulations?
4. Who classifies documents when the marking is missing or unclear?

**What we need back:** marking list, handling confirmation, classification contact.

Kind regards,
`<name>`, `<role>`

---

## Part B — IT teams

Every IT request: **implement only if not already in place. Please tell us first what exists.**

### IT-01 Workplace / endpoint team — managed device

**To:** `<Endpoint / workplace services>`
**Subject:** Managed device for an offline internal analysis tool (DAMC)

`<Shared context block>`

| # | Request | Done when |
|---|---|---|
| 1 | One company device enrolled in device management, with a spec able to run a local AI model: `<CPU/GPU/RAM/disk — to be sized with IT-05>` | Device enrolled and compliant |
| 2 | Full-disk encryption on, EDR active | Compliance report shows both |
| 3 | No local admin rights for the operator account | Confirmed in policy |
| 4 | Application allowlisting (WDAC/AppLocker or company equivalent): only approved DAMC components and the local model runtime may run | Policy applied; an unapproved binary is blocked in a test |
| 5 | USB storage blocked; screen lock per policy | Policy applied |
| 6 | Patch SLA for OS and runtimes (critical within `<14>` days or company policy) | SLA confirmed |
| 7 | No remote desktop from outside the corporate network | Policy applied |

Linked IDs: ENV-01, SEC-02. Phase 0–1.

---

### IT-02 Network team — egress control

**To:** `<Network / firewall team>`
**Subject:** Default-deny outbound network for the DAMC device

`<Shared context block>`

| # | Request | Done when |
|---|---|---|
| 1 | Outbound traffic from the DAMC device denied by default | A test call to a public site is blocked and logged |
| 2 | Allowlist only the Microsoft 365 endpoints needed for OneDrive sync | OneDrive sync works; nothing else reachable |
| 3 | Per-executable rule: document-parsing and model processes get no network at all, including M365 | A connection attempt from these processes fails and is logged |
| 4 | An empty allowlist must mean deny all, never allow all | Confirmed in rule design |
| 5 | Blocked attempts logged and forwarded to the SIEM (see IT-06) | Event visible in the SIEM |

Linked IDs: ENV-03, MIR-14 (outbound network disabled). Phase 1.

---

### IT-03 Identity and access team

**To:** `<Identity / Entra ID team>`
**Subject:** Access groups and identity setup for DAMC

`<Shared context block>`

| # | Request | Done when |
|---|---|---|
| 1 | Security groups: DAMC operators, DAMC reviewers, DAMC admins (separate memberships) | Groups created; owner named |
| 2 | MFA and Conditional Access for all three groups; access only from the managed device | Policy applied and tested |
| 3 | Quarterly access review; leavers removed the same day | Review scheduled |
| 4 | Phase 5 only: a service identity for unattended monthly runs, with a certificate credential in a TPM-backed store and rotation per policy. Not needed now; please tell us the lead time. | Lead time known |

Linked IDs: SEC-03 to SEC-06. Phase 1 (items 1–3), Phase 5 (item 4).

---

### IT-04 Microsoft 365 / collaboration team — OneDrive and SharePoint

**To:** `<M365 / collaboration platform team>`
**Cc:** `<Identity team>`
**Subject:** Read-only OneDrive access and a restricted report folder for DAMC

`<Shared context block>`

| # | Request | Done when |
|---|---|---|
| 1 | Phase 1: confirm DAMC may read the OneDrive sync folders of `<project libraries>` through the operator's own access. No new app registration. | Confirmed in writing |
| 2 | A report folder (Zone F) per project, restricted to a named group, with versioning on | Folder exists; access tested |
| 3 | Sensitivity labels: can a local process read labelled or encrypted files? Which labels must DAMC never process? | Answer in writing |
| 4 | Retention labels on the report folder per the records policy (from L-01 G2) | Labels applied |
| 5 | Phase 5: an app registration with delegated, selected-scope permissions (per-site or per-file grants; write grants per generated file only). No tenant-wide `Files.Read.All` or `Sites.Read.All`. Please confirm the current permission names and approval process. | Process and lead time known |
| 6 | Version history and change detection (eTag) for delta scans in Phase 5 | Approach confirmed |

Linked IDs: ENV-02, ENV-07, SEC-28 to SEC-32. Phase 1 (items 1–4), Phase 5 (items 5–6).

---

### IT-05 Platform / DevOps team — internal package and model mirror

**To:** `<Platform / DevOps / software repository team>`
**Subject:** Controlled internal mirror for DAMC libraries and model weights

`<Shared context block>`

We ask for a controlled internal mirror of `pypdf` and the other libraries listed below, so PDF and document processing stays inside company infrastructure, external access is blocked, and software supply-chain risk drops.

**Implementation approach.** Apply the controls through a company-managed deployment package. Implement only if the IT team has not built one already. Do not modify the core libraries: upstream updates stay compatible and maintenance cost stays low.

| # | Control | Done when |
|---|---|---|
| 1 | **Automated security testing.** Checks for known vulnerabilities, dependency integrity and unauthorised network activity. | Scan clean or exceptions signed; integrity check passes; network test shows zero outbound attempts |
| 2 | **Outbound network disabled.** External connections are blocked during PDF and document processing, so confidential documents cannot reach third-party services (with IT-02). | A connection attempt from the processing process fails and is logged |
| 3 | **Restricted file access.** PDF reading and writing limited to authorised company directories. | A read outside the allowlist is refused and logged |
| 4 | **Internal dependency mirror.** `pypdf` and its dependencies are downloaded only from approved company repositories. | Clean install succeeds with public registries blocked |

**Packages and artifacts in scope** (versions pinned with hashes):

| Class | Item |
|---|---|
| PDF | `pypdf` and optional extras (`cryptography` for encrypted PDFs, `Pillow` for images) |
| Office files | DOCX and XLSX readers `<names after tool choice>` |
| OCR | `<OCR engine>` |
| Local AI | `<local model runtime>`; model weights `<model name, version>` from an approved source, hash-pinned |
| Entailment (NLI) models | English: `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli` (preferred candidate) and FactCG (lower priority for English); multilingual candidate for Nordic text `<to be selected>`. All hash-pinned; adopted only after DAMC gold-set tests (Guidelines 8.10). |
| Language | Spell checkers, tokenisers, language-ID data `<names>` |
| Advisory data | Vulnerability advisory data mirrored internally for offline scans |

**Also requested:**

| # | Request | Done when |
|---|---|---|
| 5 | Internal Git hosting for DAMC with a protected main branch, two-person review, no force push | Repo created; rules applied |
| 6 | CI runners without internet access, using only the internal mirror | A build passes with public registries blocked |
| 7 | Pre-commit and CI secret scanning | A planted test secret blocks the commit |
| 8 | One-way transfer path for monthly reference-data refresh: a connected workstation downloads and scans, then a controlled transfer to the DAMC device | Path documented and tested once |
| 9 | Monthly check of upstream releases and advisories; security fixes promoted outside the cycle after DAMC's regression tests pass | Owner and schedule named |
| 10 | Evaluation sandbox: an isolated test environment, no network, no live project data, where candidate tools from the mirror are installed and tested against DAMC's gold set | Sandbox exists; one candidate installed and tested |
| 11 | Monthly tool watch support: a route for the QA lead to request new candidate tools into the mirror (Guidelines 17.5) | Request route documented |

Linked IDs: ENV-05, M7, MIR-12 to MIR-17, SEC-10 to SEC-14, FACT-31 to FACT-34, MON-08 to MON-13. Phase 1 (items 1–9), Phase 3 (items 10–11).

---

### IT-06 Security operations (SOC) and application security

**To:** `<IT security / SOC / AppSec>`
**Subject:** Security review, monitoring and incident path for DAMC

`<Shared context block>`

| # | Request | Done when |
|---|---|---|
| 1 | Review of the DAMC threat model (Guidelines 7.1) before build | Review notes returned |
| 2 | SIEM intake for DAMC security events (metadata only: integrity failures, blocked egress, guard refusals, injection-detector hits) | Test event visible |
| 3 | EDR rules or alerts for DAMC processes, if the SOC uses process-level rules | Confirmed |
| 4 | SAST, dependency and licence scanning in CI; SBOM storage per release | Pipeline runs; SBOM stored |
| 5 | Weekly dependency audit with alerts on critical findings; no upgrade without approval | Schedule and alert channel set |
| 6 | Incident path: SOC contact, playbook entry for DAMC, kill-switch procedure | Playbook entry exists |
| 7 | Penetration test or security review before go-live | Test booked |

Linked IDs: SEC-01, SEC-11, SEC-16 to SEC-20, INC-01. Phase 0 (item 1), Phase 1–3 (items 2–7).

---

### IT-07 Infrastructure team — backup, certificates, scheduling

**To:** `<Infrastructure / PKI / backup team>`
**Subject:** Backup, signing certificate and scheduling for DAMC

`<Shared context block>`

| # | Request | Done when |
|---|---|---|
| 1 | Encrypted backup of the DAMC evidence store; quarterly restore test | First restore test passed |
| 2 | Signing certificate from the internal CA for signing reports (ES256 if the PKI supports it) | Certificate issued; rotation set |
| 3 | Timestamping: access to an internal or approved RFC 3161 time-stamping service, if available | Answer in writing |
| 4 | Credential storage for DAMC secrets in the company vault or OS credential store | Approach confirmed |
| 5 | Alert channel for missed or failed monthly runs (heartbeat alarm), internal only | Test alert received |

Linked IDs: SEC-07, SEC-19, DOC-02, MON-01. Phase 1–3.

---

### IT-08 Service management / change advisory board

**To:** `<IT service management / CAB / software approval>`
**Subject:** Register DAMC as an internal application

`<Shared context block>`

| # | Request | Done when |
|---|---|---|
| 1 | Register DAMC in the application and asset inventory, with system owner and data classification | Entry exists |
| 2 | Software approval for the libraries and model runtime in IT-05 | Approval recorded |
| 3 | Change process for DAMC releases: which changes need CAB, which are standard changes | Process agreed |
| 4 | Model licence and AI model register entry, if the company keeps one | Entry exists or "not applicable" |

Linked IDs: CHG-01 to CHG-11, Section 16.3. Phase 0.

---

## Request log

| ID | To (role/team) | Subject (short) | Sent | Answer due | Status | Answer reference |
|---|---|---|---|---|---|---|
| L-01 | Legal | Legal review, Phase 0 | — | — | Draft, not sent | — |
| L-02 | DPO | DPIA and privacy design | — | — | Draft, not sent | — |
| L-03 | Trade compliance | Export control handling | — | — | Draft, not sent | — |
| IT-01 | Endpoint | Managed device | — | — | Draft, not sent | — |
| IT-02 | Network | Default-deny egress | — | — | Draft, not sent | — |
| IT-03 | Identity | Groups, MFA, access review | — | — | Draft, not sent | — |
| IT-04 | M365 | OneDrive access, report folder | — | — | Draft, not sent | — |
| IT-05 | Platform/DevOps | Internal package and model mirror | — | — | Draft, not sent | — |
| IT-06 | SOC/AppSec | Security review and monitoring | — | — | Draft, not sent | — |
| IT-07 | Infrastructure | Backup, certificate, scheduling | — | — | Draft, not sent | — |
| IT-08 | Service management | Register application | — | — | Draft, not sent | — |

## Before sending (checklist)

- [ ] System owner approved sending
- [ ] Placeholders filled; teams merged or removed to fit the company structure
- [ ] Guidelines v0.5 exported to PDF and attached
- [ ] No personal data, customer names or project content in any request
- [ ] Each request checked against DAMC-STY-001 (Section 9 structure, Section 10 checklist)
- [ ] Request log updated with send date and due date
