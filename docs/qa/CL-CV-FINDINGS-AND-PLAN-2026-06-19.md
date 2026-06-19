# CL + CV findings and treatment plan — 2026-06-19 (owner live review)

## PROGRESS / HANDOFF (live session 2026-06-19, shipped through 1.50.705)

**KEY UNLOCK — live domain:** the app is **`https://antcv.pages.dev`** (NOT
cv-generator-det, which is dead ~2 months). The owner's signed-in session
(karp.gabriel.a@gmail.com, real kernel, 12 roles) is there. Drive it via Claude-in-
Chrome on that URL. Memory [[domain-and-outcomes-parity]] corrected.

**Shipped + LIVE-VERIFIED this session:**
- `1.50.704` **F5 preview Results repetition** — ROOT CAUSE was NOT role-ids
  (unique, fine) nor the `__antcvRR` memo (distinct, fine): the app.js render emits
  `data-antcv-role-results` as **0 for ~all roles** ([0,1,0,0,…]), so
  `antcv-results-laminate-510.js` did `exp.roles[0]`=Kanzen everywhere. Fixed the
  sidecar to map i-th div → i-th VISIBLE role (document order). Verified live: 2→12
  distinct results.
- `1.50.705` **NYX evidence-artifact in the LAMINATED result** — 698 cleaned bullets
  but the NYX line survived in (a) a SELECTED OUTCOMES `{b,t}` item entirely-
  fabrication (stripArtifact returns null → item wasn't removed) and (b)
  `personalInfo.experience/workHistory[].bullets`. Fixed both in the strip sidecar.
  Verified live: mepro-tl now laminates "Manage prototype-to-production transfer; …"
  (no NYX). NOTE: strip self-heals on a 4s interval after cloud-restore re-hydrates.

**Metadata leak (C7):** GONE in live data (data changed since the export) — not
reproducible; deprioritise.

**Shipped this session (code landed, needs live-verify on antcv.pages.dev):**
- `1.50.706` **RESULTS-NEAR-DUP-001 within-result redundancy** — the lamination joined
  the top-2 outcomes, which are often NEAR-DUPLICATES (Sirin: "Direct a 7-person task
  force…; Directed a 7-person EO and optics team…" = same fact twice). Added
  `_dedupNear()` that collapses texts with ≥3 shared stemmed tokens AND ≥0.6 overlap of
  the smaller set, keeping the stronger/numeric one (higher `_metricScore`; tie →
  longer). Wired into `antcv-docx-client.js` `_capJoin` (tiers 2/3) + the distribution
  join, AND mirrored in `antcv-results-laminate-510.js lamFor` (preview parity; sidecar
  uses an ndScore numeric-favour proxy since it has no `_metricScore`). Tests 339/339.
- `1.50.707` **RESULTS-NEAR-DUP-001 anchor clause** — LIVE-verified on antcv.pages.dev
  that 706's token-overlap alone did NOT collapse the REAL Sirin pair: both lines are
  long and share only 0.44 of tokens (each carries distinct tail detail — "ODM
  engineering" vs "camera/display/biometric stack") even though both open "Direct(ed)
  a 7-person … smartphone optics team". Added an OR clause: near-dup also when two
  texts share ≥3 tokens AND open on the SAME verb+object headline (identical first two
  meaningful stems, e.g. both → "direct,person"). Re-verified live (AntcvApplyOutcomesMode
  on the real 12-role kernel): Sirin now ONE line; distinct outcomes ("Reduce cost" vs
  "Reduce cycle", "Cut" vs "Owned") stay separate. NOTE: this kernel stores NO per-role
  outcomes, so Results come from the SELECTED-OUTCOMES distribution path — the dedup at
  the `assign[i]` join (not just `_capJoin`) is what fires. C5 numeric-surfacing already
  partly visible: System Architect now leads "Reduce product cost by 90%".
  **LIVE-VERIFIED** on antcv.pages.dev (707 loaded, AntcvApplyOutcomesMode on the real
  kernel): Sirin Results collapsed from two headline-equal outcomes to one ("Direct a
  7-person EO and optics team for a high-security smartphone product; owned camera,
  display, and biometric optical stack." — the "task force … ODM engineering" twin is
  gone). RESULTS-NEAR-DUP-001 DONE.

**NEW live findings (next):**
- **E1 broken mixed tense in joined clause** — "Manage … ; owned …" (leading verb
  re-tensed, rest not). Needs full-clause tensing, not leading-verb-only.

**Next item to execute:** E1 full-clause tense. Then C5 numeric-surfacing,
INTERESTS-missing seeding, CL heading consistency (INLINE_LABEL_IDS).

---


Source: owner review of the real exports `CV_…_20260619.pdf` (4pp) +
`CoverLetter_…_20260619.pdf`, plus owner observations. This is the authoritative
issue inventory + ordered treatment plan. Status tags: **[SHIPPED]** (fix landed,
applies on hard-refresh/regen — this export predates it), **[DET]** (deterministic,
no regen, headless-verifiable), **[GEN]** (generation/prompt — needs a GABRIEL_BG
regen to verify), **[LAYOUT]** (pagination/measure/worker).

---

## 1. FINDINGS

### A. CL ↔ CV duplication (synergy — the two docs copy each other)
A1. **WHAT I BRING (CL) ≈ CORE COMPETENCIES (CV)** — 3/4 Focus Areas identical
    (Change Governance, Technical-Commercial Evaluation, Cross-Disciplinary
    Coordination). Root: the CL `bring` table mirrors the CV `core_comp` rows when
    the model omits `bring_rows` ([[two-tables-mirror-and-results-numeric]]).
A2. **WHO I AM (CL) ≈ PROFILE (CV)** — same identity paragraph.
A3. **CL FOUNDATION→Professionally ≈ CV "Work style"** — same "keep decisions
    visible / written follow-ups" content.
A4. **CL HOW-I-CONTRIBUTE bullets ≈ CV past bullets** (Power BI KPI; structured
    change processes) — the CL "future plan" is the CV "past work" reworded.
A5. **Identity phrase-cluster repeated 4×** across both docs
    ("automotive/defence/deep-tech · concept→production · requirements/validation/
    supplier coordination").

### B. CL internal
B1. **Heading inconsistency** — WHO I AM is `text_inline` (colored inline opening),
    WHY YOUR COMPANY / HOW I WOULD CONTRIBUTE / FOUNDATION are `text` (separate
    heading). Owner: pick ONE, never both. DECISION: uniform colored inline opening
    for prose; the WHAT I BRING table keeps its heading.
B2. **WHO I AM repeats the opening paragraph** almost verbatim.
B3. **One sentence verbatim twice** — WHO I AM and FOUNDATION→Professionally both
    end "…so anyone joining later can see what was decided and why."
B4. **"landacross"** — missing space ("make hard changes land across").
B5. **"production-requirements"** — jammed dash (should be "production — requirements").
B6. **Em-dash in the CL subtitle** — "Product / Project Expert — Unsolicited" uses a
    banned "—" (the em-dash→hyphen pass missed the CL subtitle line).
B7. **"WHY YOUR COMPANY" with no company** (unsolicited) — heading + generic filler;
    should reframe for unsolicited.
B8. **"invitation for a conversation"** — awkward phrasing.
B9. **"15 years"** (CL) vs **"15+ years"** (CV/canonical).

### C. CV content / attribution
C1. **Cross-role bleed** — Meprolight Team Leader Results = Sirin's "Direct a
    7-person EO… high-security smartphone…". **[SHIPPED 1.50.699]**
C2. **IDF fabrication** — Computer Systems Administrator Results = "…free-space
    optical communication systems… NIR/SWIR/thermal multi-band image fusion" (wrong
    role + fabricated optics).
C3. **NYX fabrication** on Kanzen Results. **[SHIPPED 1.50.698]**
C4. **Kanzen Results = Innoviz's work** ("Own change governance for the LiDAR
    product line under ASPICE…") — duplicated with the Innoviz CC bullet.
C5. **Weak numerical results (BIGGEST content issue)** — strong quantified kernel
    outcomes are NOT surfaced; roles laminate duties/compliance/bled lines instead.
    Only 250→10 days survives. MISSING from the CV though in the kernel:
    - System Architect: **90% LiDAR cost cut (10×)** + **3,400/3,600 requirements**
      (shows the duty "Specify component requirements…aligned with ASPICE").
    - Meprolight R&D: **scaled 500→20,000 units/week** (shows "Design and
      characterised low-light…").
    - Innoviz: **~30% of revenue governed** + **ASPICE CL1 audit (2025)**.
    - Meprolight TL: **250+ field-test hours, SWIR sight demonstrator**.
C6. **Results = duties not outcomes** (System Architect).
C7. **Proof-point metadata leaks into Results text** — "Cut … 250 to 10 days
    **Innoviz Technologies - automotive LiDAR under ASPICE**"; "Direct a 7-person
    electro-optics task force **Sirin Labs - high-security smartphone optics**".

### D. CV structure / missing
D1. **INTERESTS missing entirely** (sidebar has no Interests; the 20260618 DOCX had
    it). Owner-flagged.
D2. **Missing groups (UNSOLICITED-BREADTH)** — REGULATORY CONTEXT shrank to ONE
    group ("Systems, Safety and Cybersecurity", 3 items); Imaging & Electro-Optical,
    Electrical & EMC, Environmental/Durability/Materials groups are GONE. TOOLS &
    METHODS similarly thinned. For unsolicited it should show FULL breadth.
D3. **Identity** — CV opens "Hardware-software product engineer"; canonical
    unsolicited identity is the broad "IT professional".
D4. **PROFILE doesn't end on the people/communication close** (ends on "GenAI…").
D5. **"Work style:" dangling labeled line** after PROFILE.
D6. **Accessibility "It has not limited his career"** (3rd-person). **[SHIPPED 1.50.697]**

### E. Tense
E1. **Broken mixed tense inside a single Results line** — "Design and characterised…",
    "Own change governance… requirements". The lamination re-tenses only the LEADING
    verb, leaving the rest past → grammatically broken. Leading-verb-only is not
    enough.
E2. **Bullets fully past** even on the current role.

### F. Pagination / layout / preview
F1. **Page 4 orphan** — only "RECOMMENDATIONS: references on request" on its own
    page, AND the **AI-assisted watermark overlaps that line**.
F2. **Page 2 main column empty** — sidebar fills page 2 while PROFESSIONAL
    EXPERIENCE jumps to page 3 (sidebar↔main pagination imbalance / "ratios").
F3. **Page 3 not shown in the EXPORT PREVIEW** — the pager mis-counts when the two
    columns desync.
F4. **Preview pagination / sidebar page-count disagrees with the real export.**
F5. **Preview Results are REPETITIVE** — the same result repeats under multiple roles
    in the preview (export is correct). role-id-stabilize (1.50.693) not resolving it;
    suspect the `__antcvRR` memo serving stale or React-state vs localStorage role
    desync. QUEUE item 1.
F6. **Sentence "sliding" in bullets/tables** — justified text stretching into big
    inter-word gaps / words sliding apart within cells ("audit-ready" hyphen-split).

---

## 2. TREATMENT PLAN (ordered)

### Phase 0 — verify the already-shipped fixes on a fresh regen
The owner's browser is open (signed in). Trigger a GABRIEL_BG regen + export and
confirm: C1 (bleed), C3 (NYX), D6 (accessibility), B (ISO-metric), E (verb-map
Results). These are SHIPPED but unverified on real output.

### Phase 1 — deterministic, data-side (no regen) — highest confidence
1. **D1 INTERESTS missing** [DET] — `antcv-sections-normalize-415.js`
   explodeAdditionalToSections / interests handling: ensure an INTERESTS sidebar
   section is created/kept even when the generation omits `interests_items` (seed
   from the canonical hobbies). Headless-verify it renders.
2. **C7 Results metadata leak** [DET] — strip the trailing
   "<Company> - <context>" provenance tokens from laminated Results text
   (antcv-docx-client.js applyOutcomesMode / the proof-point text). Unit-testable.
3. **B6 / em-dash in CL subtitle** [DET] — extend the em-dash→hyphen render pass to
   the CL subtitle line.
4. **F1 AI-watermark overlap + F2/F3/F4 pagination** [LAYOUT] — the two-map
   measurer + the export-preview pager: balance sidebar↔main, stop the orphan page,
   place the watermark clear of content, fix the preview page count. (Investigate
   first; [[pagination-two-map-and-worker-test]].)
5. **F5 preview Results repetition** [DET] — diagnose the `__antcvRR` memo / role-id
   path live (browser) then fix the stale-map / desync.

### Phase 2 — deterministic but needs care
6. **B1 CL heading consistency** [DET] — extend `INLINE_LABEL_IDS`
   (antcv-sections-normalize-415.js:330) so all CL prose sections are uniformly
   `text_inline`; confirm heading-label-dedup strips any double label.
7. **C5 numeric-results surfacing** [DET+GEN] — make each role prefer its own
   strongest NUMERIC kernel outcome over a compliance/duty/bled line (extend the
   lamination's tier selection + the BLEED-002 ground-truth). Verify the 90%/10×,
   30%, 3400/3600, 500→20k, CL1, 250-hrs lines surface.
8. **E1 broken mixed tense** [DET] — re-tense the WHOLE leading clause, not just the
   first word (or gate the fold so it never produces "Design and characterised"); OR
   move tense fully to generation (E via prompt).

### Phase 3 — generation / prompt (verify via regen in the browser)
9. **A1–A5 CL↔CV de-duplication** [GEN] — prompt: WHO I AM ≠ PROFILE; WHAT I BRING
   focus areas DISJOINT from CORE COMPETENCIES; CL contributions not lifted from CV
   bullets. (+ deterministic backstop for the bring↔core mirror.)
10. **D2 group breadth (unsolicited)** [GEN] — stop shrinking REGULATORY/TOOLS groups
    when no JD (UNSOLICITED-BREADTH-001 hardening).
11. **D3 identity** ("IT professional" not "Hardware-software product engineer"),
    **D4 profile close**, **C2/C4/C6 right-outcome-per-role**, **B2/B3/B7/B8/B9 CL
    polish**, **E2 bullet tense** — prompt-side, verify on regen.

### Phase 4 — verify each in Preview + DOCX/PDF, desktop + mobile
Re-export after each batch; confirm in the real PDF, not preview-only.
