# Style: Precision Formal

**Primary constraint.** Numerical precision. Quantify wherever a real number is available.

**Row in style-matrix.md.** Density `medium-high`. Words per bullet 14 – 22. Profile 280 – 400 chars. ATS-Modern native-safe.

---

## What this style sounds like

Engineering-register. Exact numbers, ranges, units, technical vocabulary used precisely. Magnitude words are rejected when a number is available. "Reduced cycle time by 18 per cent" outperforms "significantly reduced cycle time". "Throughput of 240 Mbps" outperforms "high throughput". The voice signals expertise through precision rather than through claims.

This style fits hardware engineering (any seniority), senior software engineering, scientific roles, technical product management of complex systems, applied research in industry, and any technical-leader role where the reader is themselves technical and will discount imprecise framing. It does not fit roles where the audience is non-technical or where the reader is buying outcome framing rather than precision.

The register is formal but not institutional — closer to a published paper or a technical specification than a board memo. Technical vocabulary is used at full precision; acronyms are spelled out on first use where appropriate and then used freely.

---

## Section-by-section

### `profile`

Two to three sentences. 280 – 400 characters. Lead with role and a precise technical anchor.

- Sentence 1: role, years, technical domain with specificity (modality, frequency band, process technology, software stack).
- Sentence 2: how the candidate operates — specific subsystems, technical scope, or methodologies.
- Sentence 3 (optional): current focus with technical anchor.

**Good:**

> Senior optical systems engineer with twelve years across 905 nm LiDAR transmit and receive paths, automotive ASIL-D ECU integration, and electro-optical characterisation. Owns optical subsystem specification, hardware-software interface definition, and pre-board ASPICE assessment for automotive perception. Currently working on detector array architecture for 1550 nm next-generation LiDAR.

**Avoid:** opening without technical anchor ("Senior optical systems engineer with twelve years"). Soft framing ("Passionate about optical systems"). Magnitude words ("Extensive experience in LiDAR").

### `core_competencies`

`structured-grid` format — denser than other styles. 5 – 7 rows. Each row carries a technical focus area + precise scope.

**Good:**

| Focus area | Strategic expertise |
|---|---|
| LiDAR optical subsystems | 905 nm and 1550 nm transmit / receive paths, detector array architecture |
| EO characterisation | NA-matched optical bench, integrating sphere, MTF analysis to 0.6 cycles/pixel |
| Hardware-software interface | Register-level interface specification, ECU integration, ASIL-D safety mechanisms |
| Process compliance | ASPICE Level 2 assessor, ISO 26262 ASIL-D safety case authorship |
| Simulation and modelling | Zemax non-sequential ray tracing, Python signal-chain modelling |

**Avoid:** focus areas without precision ("Optical engineering"). Vocabulary used loosely.

### `selected_outcomes`

3 – 5 bullets. Each title 4 – 7 words; body 14 – 22 words with at least one exact number where the work supports it.

**Good:**

- **Detector array yield improved from 62 to 88 per cent.** Identified the dominant failure mode through E-beam process audit; redesigned the protective oxide stack from 70 nm to 110 nm thickness.
- **Optical subsystem MTF held above 0.45 at Nyquist across three production lots.** Tightened the lens assembly tolerance to ±0.15 mm decentration; validated through pre-production characterisation on twelve units.
- **ASIL-D safety case approved first submission on ECU integration.** Authored the hazard analysis covering twelve failure modes; coordinated independent review with the ASPICE assessor across three review cycles.

**Avoid:** outcomes with magnitude words instead of numbers. Bullets that name the work without quantifying the result when a number exists.

### `experience`

3 bullets per role. Each 14 – 22 words. At least one precise number per bullet where the work supports it. Past tense for past roles, present tense for the current role (the Auto tense default; Force present/past overrides it).

**Good (Senior Optical Systems Engineer, Innoviz, 2020 – 2025):**

- Owned the LiDAR transmit-side optical subsystem for the next-generation 905 nm platform, including beam-shaping optics and laser-driver interface.
- Authored the optical sub-system specification (162 requirements across mechanical, optical, and electrical interfaces) and the ASIL-D hazard analysis covering twelve failure modes.
- Reduced detector array yield-loss from 38 to 12 per cent over six production iterations; held subsystem MTF above 0.45 at Nyquist across three production lots.

**Avoid:** bullets without numbers when numbers are available. Generic technical claims without scope.

### `tools_methods`

Particularly important in this style. Group by technical domain with named methods, instruments, and software versions where relevant.

**Good:**

- **Optical design:** Zemax OpticStudio (non-sequential), CODE V, FRED
- **Characterisation:** Trioptics MTF benches, Newport integrating spheres, Bristol wavelength meters
- **Signal processing:** Python (NumPy, SciPy), MATLAB, LabVIEW
- **Compliance:** ASPICE Level 2, ISO 26262 ASIL-D, FMEDA, hazard analysis

### Other sections

Certifications, education, publications: see `cv-skeleton.md`. Publications often surface higher in this style when the candidate has them — technical reviewers value peer-reviewed output.

---

## Banned forms specific to precision-formal

In addition to the global banned word/phrase lists, this style rejects:

- Magnitude words as substitutes for numbers: `significantly`, `substantially`, `considerably`, `markedly`, `notably`, `dramatically`.
- Range-padding: "10 – 30 per cent improvement" when the actual delta is 18 per cent. Use the exact number.
- Generic technical claims: "Strong optical design skills" — name the design tool, the design type, and the design outcome.
- Outcome claims without measurement: "Improved system performance" — specify which performance metric and by how much.
- Vague unit handling: "improved by 20" without units; "high throughput" without rate; "fast response" without time.
- Hedging on technical capability: "familiar with", "exposed to", "worked alongside" — be precise about what the candidate did.

---

## Preferred forms

- **Exact numbers with units.** "905 nm wavelength", "0.6 cycles/pixel MTF", "±0.15 mm decentration", "240 Mbps throughput", "70 nm oxide thickness".
- **Before-and-after pairs.** "Reduced yield-loss from 38 to 12 per cent." Specific delta over a specific period.
- **Component-level naming.** "Beam-shaping optic", "laser-driver interface", "protective oxide stack" — name the specific component, not the subsystem level.
- **Process-step precision.** "E-beam process audit", "metal-1 to via-1 transition", "post-CMP planarisation" — process steps named precisely.
- **Quantified scope.** "Twelve failure modes", "three production lots", "162 requirements", "six review cycles" — counts that anchor the scope.

---

## JD signals that suggest this style

Recommend `precision-formal` when the JD shows any of:

- Hardware engineering, optical engineering, RF engineering, semiconductor, photonics roles.
- Senior or principal software engineering roles in performance-critical systems (compilers, kernels, embedded systems, networking, ML infrastructure).
- Scientific roles in industry (R&D, applied research, characterisation labs).
- Technical product management of complex hardware-software systems.
- JDs that themselves list precise technical requirements (wavelength bands, frequency ranges, throughput numbers, process nodes, software stack with versions).

Do **not** recommend `precision-formal` when:

- The audience is non-technical (general commercial PM, sales, marketing).
- The candidate's history lacks precise metrics — the style will read as forced.
- Academic roles (use `research-formal`; the registers are adjacent but the section sets differ).
- Cold outreach (use `cold-outreach`).

---

## Compression behaviour

When over budget:

1. Bullet bodies compress before bullets drop. Numbers stay; surrounding context trims.
2. Profile compresses sentence 3 first; sentence 1 (the technical anchor) is preserved.
3. `core_competencies` reduces rows before reducing technical specificity within a row.
4. `selected_outcomes` bullets compress by removing the supporting context, never by replacing numbers with magnitude words.

Compression priorities to preserve: exact metrics, technical specifications, units and ranges, component-level naming, named process steps.

---

## Tone-chip compatibility

Style defaults to `["precise", "quantified", "technical"]`. Additional compatible chips: `factual`, `concrete`, `disciplined`, `method-led`, `named-methodology`.

Conflicts: never accept `narrative`, `why-led`, `speculative`, `conversational`, `warm`, `relational` (they soften the register away from precision).

---

## Cross-references

- `style-matrix.md` — the row definition this file expands on.
- `cv-skeleton.md` — section keys and placement.
- `design-packages.md` § Recommended pairings — Tokyo Precision (primary) and Copenhagen Modern (alternative).
- `achievement-driven.md` — adjacent style at senior level; switch when outcomes matter more than technical precision.
- `research-formal.md` — adjacent register; switch when the role is academic or the deliverable is a publication record rather than industry outcomes.
- `change-log-application.md` — recurring `risk=invented` in this style usually signals fabricated metrics; the skill demands traceability to the kernel for every number.
