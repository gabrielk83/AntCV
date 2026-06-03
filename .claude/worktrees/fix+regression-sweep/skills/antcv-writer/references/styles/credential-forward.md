# Style: Credential Forward

**Primary constraint.** Credentials surfaced early. Name the credential, then the work it enabled.

**Row in style-matrix.md.** Density `medium`. Words per bullet 12 – 18. Profile 260 – 340 chars. ATS-Modern native-safe.

---

## What this style sounds like

The candidate's credentials lead the document. Certifications are surfaced before or alongside experience, and bullets reference qualifications, accreditations, and named methodologies. The reader is partly buying the accreditations — ISO certifications, regulatory body designations, named-methodology levels (Six Sigma Black Belt, ASPICE Level 2 assessor, PMP, CIPP/E) — so the document foregrounds them.

This style fits regulated industries: medical devices (ISO 13485, IEC 62304, FDA QSR), automotive functional safety (ISO 26262 ASIL-D, ASPICE), pharmaceutical quality (GxP, EU GMP), financial compliance (CFA, FRM, CIPM), data protection (CIPP/E, CIPM, CIPT), and academic-adjacent roles where the credential itself is the entry signal.

It does not fit roles where the credential is incidental rather than essential — most general commercial PM, sales, marketing, growth roles are better served by `achievement-driven` or `measured-professional`.

---

## Section-by-section

### `profile`

Two to three sentences. 260 – 340 characters. Lead with role and primary credentials.

- Sentence 1: role + primary credential or accreditation as the lede.
- Sentence 2: how the credentials apply — what kinds of audits, certifications, or regulated environments.
- Sentence 3 (optional): current focus.

**Good:**

> Functional safety specialist, ISO 26262 lead assessor and ASPICE Level 2 certified, with twelve years in automotive perception and ECU programmes. Coordinates safety case development, hazard analysis, and assessor reviews across multi-vendor supplier networks. Currently leading ASIL-D safety case work for next-generation LiDAR systems.

**Avoid:** opening with experience without credentials ("Functional safety specialist with twelve years..."). Listing credentials without naming where they apply.

### `core_competencies`

`table-grid` format. Credentials surface in the first or second row. 5 – 7 rows. Focus area + named credential / framework.

**Good:**

| Focus area | Strategic expertise |
|---|---|
| Functional safety governance | ISO 26262 lead assessor; ASIL-D safety case work across three programmes |
| Process compliance | ASPICE Level 2 certified; led two re-certifications with zero major findings |
| Quality systems | Six Sigma Black Belt; FMEA and DFMEA review chair |
| Regulatory affairs | EU MDR liaison; medical device classification reviews |
| Cybersecurity (automotive) | ISO/SAE 21434 awareness training delivered to three engineering teams |

**Avoid:** focus areas without credentials when credentials exist for that domain. Generic skill claims ("Strong knowledge of compliance").

### `selected_outcomes`

3 – 5 bullets. Each title names the credentialed activity and outcome; body 12 – 18 words.

**Good:**

- **ISO 26262 ASIL-D safety case approved on first submission.** Authored the hazard analysis, risk assessment, and safety case as lead assessor across optical and ECU subsystems.
- **ASPICE Level 2 re-certification, zero major findings.** Coordinated preparation across three engineering teams; led two assessor review cycles ahead of formal assessment.
- **EU MDR Class IIa classification confirmed for two product lines.** Authored the classification rationale and regulatory dossier; submission accepted without further inquiry.

**Avoid:** outcomes without credential framing. Bullets that describe the work without naming the standard or accreditation.

### `experience`

3 bullets per role. Each 12 – 18 words. Each role's bullets reference the credentials applied.

**Good (Functional Safety Specialist, Innoviz, 2020 – 2025):**

- Served as ISO 26262 lead assessor across three automotive tier-1 customer programmes; owned ASIL-D safety case development for the LiDAR optical subsystem.
- Led ASPICE Level 2 governance for the customer change request workflow; introduced pre-board screening that reduced average cycle time by 40 per cent.
- Coordinated two re-certifications with zero major findings; trained two assessor candidates within the team to ASPICE Level 1.

**Avoid:** experience bullets that describe the work without naming the framework or credential applied.

### `certifications`

Promoted to high-prominence position — typically top of sidebar, or as the first main-column section after the profile. Each entry exact verbatim: `Credential — Issuing body (Year)`.

**Good:**

- ISO 26262 Lead Assessor — VDA QMC (2022)
- ASPICE Level 2 Assessor — intacs (2021)
- Six Sigma Black Belt — ASQ (2019)
- CIPP/E — IAPP (2023)

**Avoid:** in-progress credentials without explicit marking. Paraphrased credential names — use the exact name issued.

### Other sections

`tools_methods`, `education`, `publications_patents`, `additional_information` follow `cv-skeleton.md` defaults.

---

## Banned forms specific to credential-forward

In addition to the global banned word/phrase lists, this style rejects:

- Implied qualifications: "Strong knowledge of ISO 26262" — either you are certified or you are not. State explicitly.
- Paraphrased credential names: "Functional safety certified" rather than "ISO 26262 Lead Assessor". Use the exact issued name.
- "In progress" credentials in the main credentials list — list separately or omit until awarded.
- Credentials applied generically without scope: "ASPICE expertise" needs the scope (Level 2 assessor, applied across X programmes).
- Generic skill claims that the credential should replace: "Quality methodology expertise" — replace with named credentials.

---

## Preferred forms

- **Credential as the lede in bullets.** "ISO 26262 ASIL-D safety case" beats "safety case for LiDAR".
- **Named issuing bodies.** "VDA QMC", "intacs", "ASQ", "IAPP", "PMI", "Linux Foundation" — accreditation source is part of the credential.
- **Accreditation level explicit.** "ASPICE Level 2 assessor", not "ASPICE certified". "Six Sigma Black Belt", not "Six Sigma trained". "CIPP/E", not "GDPR certified".
- **Year of certification in citations.** Year matters for credentials that lapse or require re-certification.
- **Scope of credential application.** "Across three customer programmes", "Across the optical and ECU subsystems", "For two product lines" — show where the credential was used.

---

## JD signals that suggest this style

Recommend `credential-forward` when the JD shows any of:

- Required credentials listed prominently: "ISO 26262 certification required", "ASPICE Level 2 preferred", "CIPP/E essential".
- Regulated industry employers: medical devices, automotive functional safety, pharmaceutical, financial services compliance, data protection.
- Roles where the credential gates the work — e.g., assessor roles, regulated-product specialist roles, compliance officer roles.
- JDs that name multiple framework requirements in the same paragraph.
- Industries where third-party accreditation is part of the hiring decision (defence contractors, government suppliers, certified bodies).

Do **not** recommend `credential-forward` when:

- The candidate's history has experience but few formal credentials — the style will read as performative.
- The role is general commercial without a credential requirement.
- Academic roles (use `research-formal`).
- Outreach contexts (use `cold-outreach`).

---

## Compression behaviour

When over budget:

1. The `certifications` section is sacrosanct — do not drop credentials to save space.
2. Bullet bodies compress before bullets drop. The credential name and scope stay; surrounding text trims.
3. Profile compresses sentence 3 first; sentence 1 (credential lede) is preserved.
4. `core_competencies` reduces rows before dropping the credential reference within any row.

Compression priorities to preserve: certification names, regulatory references, accreditation levels, issuing bodies, scope of credential application.

---

## Tone-chip compatibility

Style defaults to `["credentialed", "accredited", "named-methodology"]`. Additional compatible chips: `precise`, `factual`, `disciplined`, `method-led`, `formal`.

Conflicts: never accept `narrative`, `speculative`, `conversational`, `brief` (credentials need length to anchor properly).

---

## Cross-references

- `style-matrix.md` — the row definition this file expands on.
- `cv-skeleton.md` — section keys and placement; certifications surface higher in this style.
- `design-packages.md` § Recommended pairings — Delhi Technical (primary) and Copenhagen Modern (alternative).
- `structured-professional.md` — adjacent style; switch when the framework application matters more than the credential itself.
- `change-log-application.md` — recurring `risk=overstated` in this style usually signals credential inflation; the skill demands the issuing body and year for every credential claim.
