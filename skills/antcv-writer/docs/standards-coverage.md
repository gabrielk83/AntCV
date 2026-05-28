# Standards and Regulatory Coverage

A re-evaluation of AntCV's claimed alignment with relevant standards and regulations after the v1.50 architecture changes (seven-package visual system, twelve-style writing system, five-engine pipeline, change-log with confidence and risk, JD Gap Closure flow, retention controls).

This document is factual, not aspirational. "Aligned with" means specific mechanisms in the codebase that map to specific provisions. It does **not** mean certified compliance. AntCV is self-assessed against published guidelines; no third-party assessment has been carried out yet.

---

## Scope

Four reference frameworks:

1. **EU AI Act** — Regulation (EU) 2024/1689
2. **WCAG 2.2** — Web Content Accessibility Guidelines, W3C Recommendation October 2023
3. **GDPR** — Regulation (EU) 2016/679
4. **C2PA** — Coalition for Content Provenance and Authenticity, technical specification 2.0

Each section below: what AntCV currently does, which provisions it addresses, where the gaps are, and what is on the roadmap.

---

## 1. EU AI Act

### Classification

AntCV is a candidate-side tool. It helps the individual job-seeker produce their own application materials. The AI Act's high-risk classification for employment AI (Annex III §4) covers systems used by employers for screening, selection, or workforce decisions — none of which AntCV does.

Under that reading AntCV is **not high-risk**. It falls under general-purpose AI obligations and general transparency expectations, not Chapter III obligations.

This classification rests on AntCV staying candidate-side. **Employer-facing scoring contradicts the spirit of AntCV and is not on the roadmap.** A separate product for employers, drawing on aggregated insights from the AntCV ecosystem rather than individual user data, is in ideation as a distinct app — if it is built, it would be subject to a fresh AI Act classification before release and would never use individual users' content or analytics directly.

### Alignment mechanisms

| Area | Mechanism |
|---|---|
| Transparency (Art. 13, 52) | Every modification — LLM-source or user-source — is recorded in the `change_log` table with `source`, `actor_id`, `reason`, `confidence` (high/medium/low), and `risk` (invented/overstated/too-generic/none). User can view this per generation. |
| Human oversight (Art. 14 principle) | All output is reviewed by the user in the AntCV editor before submission. No auto-send. JD Gap Closure flow puts the user in the loop explicitly when the system detects a gap. |
| Data governance (Art. 10 principle) | Per-user data isolation via Cloudflare Access JWT. EU jurisdiction on D1. Retention controls (30/90/180/off). Wipe-my-analytics endpoint. |
| Documentation | The locked-source plan, this doc, the skill folder. Versioned in Git. |
| Accuracy and robustness | Semantic Constraint Engine post-filter catches banned words, metric integrity violations, role-boundary violations. Two retry attempts before a `flagged: true` returns to the user. |

### Gaps

- No formal AI Act conformity assessment (none is mandated for the current classification, but documenting one would strengthen the position).
- No incident reporting mechanism. Should be added if user-reportable hallucination categories are extended.
- No formal risk-assessment document. The locked-source plan §10 Risk Register covers product risk, not AI-specific risk per the Act's framing.

### Roadmap

- Write an AI Act risk-classification rationale doc (this section, expanded) and link from the public README.
- Add an in-app "report a hallucination" button that writes a structured `incident` event to D1.

---

## 2. WCAG 2.2

WCAG applies to two surfaces: the PWA itself, and the documents AntCV generates.

### Alignment mechanisms

**PWA (Level A and AA targets):**

| Success criterion | Status |
|---|---|
| 1.3.1 Info and Relationships | Heading hierarchy preserved across sections. After Pass 1 React refactor, semantic structure is React-component-owned, not DOM-patched. |
| 1.4.3 Contrast (Minimum) | The seven visual packages were designed with foreground/background contrast in mind. Formal contrast measurement per package pending — see Gaps. |
| 1.4.10 Reflow | The mobile breakpoint at 375 px tested per release. |
| 2.1.1 Keyboard | Wizard, editor, settings all keyboard-navigable. Modal stacking tested per locked-source plan §8.7. |
| 2.4.7 Focus Visible | React component focus management implemented Pass 1. |
| 3.1.1 Language of Page | `<html lang>` set to current UI language (en/da). |
| 4.1.2 Name, Role, Value | Standard HTML5 form elements throughout. ARIA labels on custom controls — pending audit. |

**Generated DOCX/PDF:**

| Area | Status |
|---|---|
| Document language metadata | `w:lang` set in DOCX per `target_language`. PDF language tag set on export. |
| Heading hierarchy | Section headings use Word's built-in Heading 1 / Heading 2 styles, not just bold-larger-text. Screen readers see structure. |
| Tables | `core_competencies` and `what_i_bring` use real Word tables with header rows (`<w:tblHeader/>`). ATS-Legacy export flattens tables to text per §3 below. |
| Alt text on profile photo | Pending per-package implementation — see Gaps. |
| Reading order | Sidebar/main pagination preserves logical reading order (sidebar consumed before main resumes on page 2). |

### Gaps

- Formal contrast measurement per (package × text token) combination. Should be added to the §8.2 visual regression matrix as a per-screenshot contrast check.
- ARIA label audit on editor custom controls (line sliders, section format picker).
- Alt text on profile photo per package. Currently relies on the user's filename or a generic label.
- No accessibility statement in the app or repo (WCAG 2.2 best practice).

### Roadmap

- Add a contrast-ratio check to CI per-package: assert AA (4.5:1 for body text, 3:1 for large text) on every package's `(text_color, background_color)` pair.
- Add an accessibility statement to the repo and link from the in-app About modal.

---

## 3. GDPR

AntCV processes personal data (CVs are personal data per Art. 4(1)). User is data subject, AntCV is data controller, the LLM providers are data processors under the BYOK model where the user's own contract with the provider governs.

### Alignment mechanisms

| Article | Mechanism |
|---|---|
| Art. 5(1)(a) Lawfulness, fairness, transparency | Privacy notice in onboarding wizard (planned — see Gaps); change log shows the user what AI did to their content. |
| Art. 5(1)(b) Purpose limitation | Data collected for CV generation only. No secondary use. |
| Art. 5(1)(c) Data minimisation | Section-level prompt assembly only sends the fields needed for that section. Profile-only regeneration does not transmit phone/address. |
| Art. 5(1)(e) Storage limitation | Retention controls 30/90/180/off, default 90. Daily cron trims `change_log.before_text` and `after_text` past the threshold to first 40 chars plus length suffix. Aggregates retained. |
| Art. 6(1)(a) Consent | "Off" retention selection requires explicit modal confirmation with explanation of the privacy implications. |
| Art. 13/14 Information to data subject | Privacy notice integrated into the onboarding wizard alongside the existing AI notice — single combined disclosure covering AI use, data storage, retention, and user rights. Settings → Privacy page documents what is stored, where, for how long. |
| Art. 17 Right to erasure | "Wipe my analytics" button deletes all `events`, `change_log`, `outcomes`, `applications` rows and all `user:{uid}:*` KV keys for the requesting user. Global aggregates remain anonymised. |
| Art. 20 Right to portability | "Download my data" button in Settings → Privacy → Advanced returns a signed JSON archive of the user's profile, applications, events, and change-log entries. |
| Art. 25 Privacy by design | EU jurisdiction by default; demo data treated as full citizen but never linked to a different user; no localStorage of analytics; banned-word lists for user-extended bans live per-user, not in cross-user aggregates. |
| Art. 32 Security | Cloudflare Access JWT on every endpoint. PWA never touches KV/D1 directly. `OAUTH_KV`, `SESSIONS`, `ANTCV_RELAY` off-limits to the writing pipeline. Worker validates `uid` from JWT, not from request body. |
| Art. 44 International transfer | D1 in EU jurisdiction. KV namespaces are global by default but key contents respect user data residency expectations (no PII stored in `global:*` keys). LLM provider calls go to the user's own provider account under BYOK. |

### Gaps

- Formal DPO designation. AntCV is a single-developer project; no formal DPO is required unless processing scale changes, but a contact address for privacy queries should be in the repo and app.
- DSAR mechanism beyond wipe and download. Right to rectification beyond editing, right to restriction.

### Roadmap

- Repo-level `PRIVACY.md` with contact address.
- DSAR mechanism for rectification and restriction.

---

## 4. C2PA / Content Provenance

C2PA defines a technical standard for cryptographically signed content provenance manifests. AntCV ships **groundwork**, not full conformance.

### Current state

| Component | Status |
|---|---|
| `antcv-c2pa-worker` | Exists. Watermark colour tracks the active package's base token via request payload. Per locked-source plan §9.3. |
| Change-log data backbone | The `change_log` table captures every modification with source, actor, before/after, reason, confidence, risk. This is the data the future C2PA manifest will sign. |
| Action chain | `change_log` rows keyed to a `generation_id` give a verifiable action history per generation. |
| Producer / model attribution | `actor_id` column captures LLM model name (e.g., `claude-opus-4-7`) or user UID. |

### Gaps (the work to reach C2PA 2.0 conformance)

- Cryptographic signing infrastructure. AntCV does not currently issue signed manifests. A PKI (or a third-party signing service like a C2PA trust list provider) is required.
- Signed manifests on DOCX/PDF exports. The export pipeline does not currently embed C2PA `c2pa.manifest` blocks.
- Asset hash binding. Each export should hash the rendered file and bind the hash to the manifest.
- Verifiable claims with public keys. Requires a published signing key and a verification flow.

### Roadmap

- Treat C2PA as a v1.6 deliverable. The locked-source plan covers up to v1.52; C2PA conformance is post-1.52.
- Pre-conformance: publish a `provenance-summary.json` alongside each export, containing the same fields the future C2PA manifest will carry but unsigned. This is honest provenance without claiming cryptographic guarantee.

---

## Summary table

| Standard | Status | Honest framing |
|---|---|---|
| EU AI Act | Aligned with applicable provisions; not high-risk under current classification | "AntCV is candidate-side and not classified high-risk; transparency and human-oversight mechanisms are in place." |
| WCAG 2.2 | Substantially aligned; per-package contrast verification and ARIA audit pending | "Aligned with WCAG 2.2 Level AA principles; formal per-package contrast verification and ARIA audit on the roadmap." |
| GDPR | Aligned with core articles; DSAR mechanism for rectification pending | "Aligned with GDPR. EU storage, retention controls, right-to-erasure, right-to-portability, and combined wizard privacy notice implemented." |
| C2PA | Groundwork only | "Early provenance groundwork on top of the change-log spine. Full C2PA manifest signing is post-v1.52 work." |

---

## Disclosure

AntCV was built with these standards in mindset from the outset. The mechanisms described above are self-assessed against published guidelines. **AntCV has not been submitted to any standards body or certifier for formal compliance assessment**, and no third-party audit has been carried out. The wording throughout this document is "aligned with" or "built with these standards in mind" — never "certified" or "compliant" in a formal sense.

Users should make their own determination of whether AntCV's mechanisms meet their specific regulatory needs. Organisations with strict compliance requirements should treat this document as a starting point for their own assessment, not as a substitute for one.

For privacy questions: see `PRIVACY.md` in the repository root.
For accessibility questions: see the in-app About modal and `ACCESSIBILITY.md` in the repository root.

---

*Last reviewed: [date pending approval].*
*Author: Gabriel Alexander Karp-Gershon.*
