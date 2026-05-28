# Style: Hybrid Balanced

**Primary constraint.** Bridging two registers. Carry both registers without picking one.

**Row in style-matrix.md.** Density `medium`. Words per bullet 12 – 18. Profile 300 – 420 chars. ATS-Modern native-safe; section names follow user choice.

---

## What this style sounds like

A bridge between two adjacent registers. Most often: commercial structure + academic substance (industry roles at corporate research labs), or commercial structure + narrative voice (creative industry, design, communications-adjacent commercial roles), or academic structure + applied outcomes (industrial postdocs, applied-research positions).

The skill detects which two registers to bridge by reading the job description: if the JD names publications, grants, or research methods alongside commercial outcomes, the bridge is academic + commercial. If the JD names creative outputs alongside organisational scope, the bridge is narrative + commercial. The selected bridge is recorded as `writingPrefs.hybridBridge` so subsequent generations are consistent.

This is the most context-dependent style. It defaults to the safest version of each register and trims back wherever one register would alienate the other's audience. It does not commit fully to either register — that is the point.

---

## Section-by-section

### `profile`

Two to three sentences. 300 – 420 characters. Lead with role and the dual-register signal that will run through the rest of the document.

- Sentence 1: role + the primary domain (commercial framing).
- Sentence 2: methodological signature OR narrative trajectory (the secondary register).
- Sentence 3 (optional): current focus that reinforces the bridge.

**Good (commercial + academic bridge):**

> Senior research engineer with eight years bridging industrial product development and applied photonics research. Joined Innoviz from a postdoctoral position at ETH Zürich, bringing chalcogenide waveguide expertise into automotive LiDAR transmit-side optical design. Currently leading the optical subsystem specification for the next-generation 1550 nm LiDAR platform with two ongoing publications in preparation.

**Good (commercial + narrative bridge):**

> Programme designer with twelve years across cultural-sector commissioning and city-scale civic programmes. My work bridges the funding and governance demands of municipal partners with the curatorial logic that artists and creative teams operate within. Currently leading two parallel programmes for the Copenhagen Capital of Culture 2027 strand.

**Avoid:** committing fully to one register in the profile — the bridge must be visible in the lede.

### `core_competencies`

Default format follows the dominant register: `table-grid` if commercial dominates, `bullets-narrative` if narrative dominates. User can override per `writingPrefs.hybridLayout`. 5 – 7 rows.

**Good (commercial + academic bridge, table-grid):**

| Focus area | Strategic expertise |
|---|---|
| Optical subsystem design | LiDAR transmit-side architecture, 905 nm and 1550 nm platforms |
| Applied photonics research | Chalcogenide waveguide platforms, two journal publications |
| Hardware-software interface | Register-level specification, automotive ASIL-D ECU integration |
| Industry-academia liaison | Co-supervision of one MSc student with ETH; collaborative paper in preparation |

**Avoid:** rows that read as either pure commercial or pure academic — each row should either anchor the bridge or work as a base competence relevant to both.

### `selected_outcomes`

3 – 5 bullets. Each title 3 – 6 words; body 12 – 18 words. Mix outcome-types — some commercial, some methodological, with the bridge visible at the document level rather than within each bullet.

**Good (commercial + academic bridge):**

- **905 nm LiDAR optical specification shipped to three tier-1 customers.** Authored the subsystem specification and led the customer integration handover; ASIL-D safety case approved first submission.
- **Chalcogenide waveguide work published in Optics Express.** First-author paper drawing on PhD work at ETH; cited by the Innoviz next-generation platform design as the basis for the 1550 nm receiver path.
- **Industry-academia co-supervision programme established with ETH.** One MSc student now jointly supervised; framework adopted for two additional Innoviz-ETH supervisions starting next academic year.

**Avoid:** all-commercial outcomes (switch to `achievement-driven` or `precision-formal`). All-academic outcomes (switch to `research-formal`).

### `experience`

3 bullets per role. Each 12 – 18 words. Bullet rhythm follows the dominant register of that specific role — bullet ordering can differ between an industrial role and a research role within the same CV.

**Good (Industrial postdoc-equivalent role at Innoviz):**

- Led optical subsystem design for the next-generation 1550 nm LiDAR platform, bridging Innoviz product development with ongoing chalcogenide waveguide research from PhD work.
- Authored the optical subsystem specification (162 requirements) and the ASIL-D hazard analysis; coordinated with the automotive functional safety lead across two review cycles.
- Co-supervised one ETH MSc student on dispersion-engineering work directly applicable to the platform; first co-authored paper in preparation.

**Avoid:** experience bullets that pick only one register when the role itself spanned both.

### Other sections

`publications_patents` is typically more prominent in this style than in pure-commercial styles. `tools_methods`, `certifications`, `education`, `additional_information` follow `cv-skeleton.md` defaults.

For academic-leaning hybrids, consider surfacing `selected_research_outcomes` from the academic skeleton as a sidebar block alongside the commercial `selected_outcomes`.

---

## Banned forms specific to hybrid-balanced

In addition to the global banned word/phrase lists, this style rejects:

- Bullets that only one register would accept. If a bullet reads as pure academic or pure commercial without the other register being visible at the document level, switch styles instead.
- Hedge framing on the bridge itself: "Trying to combine industry and academia" — the bridge should be evidenced through the work, not described as an aspiration.
- Register clashes within one bullet: "Cut review cycles 40% while advancing the theoretical understanding of dispersion engineering" — pick one register per bullet; let the document level carry the bridge.
- Naming the bridge as the achievement: "Successfully bridged commercial and academic work" — show the bridge, do not describe it.
- Excessive code-switching within a single section. Three commercial bullets followed by three academic bullets reads better than alternating.

---

## Preferred forms

- **Document-level bridge framing.** Let the bridge come through across the document — one role anchors industry, another anchors research, with explicit cross-references where natural.
- **Cross-reference within bullets.** "Drawing on PhD work at ETH" / "Now part of the platform design" — these references are how the bridge becomes visible at the bullet level.
- **Role-specific register.** A purely-industrial role gets industrial framing; a purely-academic role gets academic framing. The bridge is in the document, not in every bullet.
- **Named institutional bridges.** "The Innoviz-ETH co-supervision programme", "The Maersk-DTU sustainability fellowship" — institutional bridges have names; use them.
- **Dual-output mentions.** Where work produced both commercial and scholarly outputs (e.g., a product that also yielded a publication), name both outputs.

---

## JD signals that suggest this style

Recommend `hybrid-balanced` when the JD shows any of:

- Industry-academic positions: corporate research labs (IBM Research, Microsoft Research, Bell Labs-equivalents, Google DeepMind), pharmaceutical R&D, semiconductor research divisions.
- Applied-research positions at universities (faculty in applied fields with industry collaboration expectations).
- Hybrid creative-commercial roles (creative director with funded-programme dimension, design lead with policy interface).
- Roles that explicitly name both publication record and product/programme delivery as evaluation criteria.
- Career-transition contexts where the candidate is moving between sectors but does not want to fully abandon one register.

Do **not** recommend `hybrid-balanced` when:

- The role is fully commercial or fully academic — pick the right register.
- The candidate has clear primary register and the secondary register is incidental.
- The JD is short and process-led — use `structured-professional`.
- Cold outreach (use `cold-outreach`).

---

## Compression behaviour

This style compresses by dropping the weaker register's content first. Identify which register dominates the target role, and trim the secondary register's section content before trimming the dominant register's.

When over budget:

1. Reduce the secondary register's bullets in `experience` before touching the dominant register's.
2. `core_competencies` rows from the secondary register drop first.
3. Profile sentence 3 (which reinforces the bridge) drops first; sentences 1 and 2 stay.
4. `selected_outcomes` bullets from the secondary register reduce first.

Compression priorities to preserve: bridging terms, dual-register signals (institutional bridge names, cross-reference clauses), and the dominant register's section content in full.

---

## Tone-chip compatibility

Style defaults to `["bridging", "dual-register", "jd-tuned"]`. Additional compatible chips depend on the chosen bridge:

- Commercial + academic bridge: `precise`, `methodological`, `factual`, `concrete`, `formal`.
- Commercial + narrative bridge: `narrative`, `concrete`, `relational`, `polished`.
- Academic + creative bridge: `narrative`, `methodological`, `concrete`.

Conflicts: avoid chips that fully commit to one register at the cost of the other. `outcome-led` fully commits to commercial; `publication-anchored` fully commits to academic. Both are fine if the bridge happens to favour that side, but they should not be defaults.

---

## Cross-references

- `style-matrix.md` — the row definition this file expands on.
- `cv-skeleton.md` and `cv-skeleton-academic.md` — both section sets are referenced; the user's `writingPrefs.hybridLayout` decides which dominates.
- `design-packages.md` § Recommended pairings — user-defined; the bridge does not have a canonical visual pairing.
- `achievement-driven.md`, `precision-formal.md`, `research-formal.md`, `context-rich.md` — adjacent styles; switch to one of these when the bridge is no longer needed.
- `change-log-application.md` — recurring `risk=overstated` in this style usually signals one register over-claiming territory the other should hold; the skill rebalances toward the dominant register.
