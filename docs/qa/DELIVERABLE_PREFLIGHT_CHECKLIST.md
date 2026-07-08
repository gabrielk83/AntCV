# Deliverable pre-flight checklist (CV + CL)

Run this **before** handing the owner any generated CV/CL. Born from the Trackman
2026-07-08 review, where a deliverable built by transcribing a lossy docx export
(instead of the authoritative kernel) dropped mandatory furniture and shipped on
an eyeball pass instead of a checklist. Cross-refs: OPEN_REGISTER rows 54–62,
memories `generate-deliverables-via-worker`, `header-banner-design-rules`,
`gabriel-master-profile-and-lamination`, `gabriel-cv-facts`, `line-distribution-guidelines`.

## 0. SOURCE (root-cause prevention)
- [ ] Content comes from the **authoritative source** — the owner's master-profile
      JSON (`Downloads/AntCV_master_profile_gabriel_*.json`) or the live app kernel —
      **NOT** a re-typed docx/PDF export (exports are lossy: they drop mandatory
      sections, jokes, hyperlinks, accessibility).
- [ ] If a raw docx-worker payload is used, remember it **bypasses the app's belts**
      (kernel-completeness, furniture, orphan-measure, AI-notice-anchor,
      references-placement) — so those rules must be applied by hand OR the
      deliverable must be generated through the full app pipeline.

## 0b. JD-DOMAIN RELEVANCE RECALL (row 54)
- [ ] **Recall kernel items that fit the EMPLOYER'S DOMAIN**, not just the literal JD.
      E.g. Trackman is a **sports** company → the **Copenhagen Wolves rugby
      volunteering** is a real fit signal and should be ELEVATED to a CV role
      (or at least mentioned in the CL), not buried in a sidebar interests line.
      Also: military comms for public-sector/comms roles, inclusive-sport for
      values-driven employers. Don't just narrow the JD set — pull the relevant
      background forward.
- [ ] **Contact LEADS (row 55c) — distinguish role:** GREET only the actual HIRING
      MANAGER when named ("Dear <Name>,"). A contact who is a **signal source but
      NOT the hiring manager** (Trackman: **Nicolaj**) must **NOT** be greeted —
      use their LinkedIn signals (recent posts, stated priorities, team focus) as
      holistic/specific LEADS woven into the WHY / HOW-I-CONTRIBUTE sections only,
      and keep the greeting generic/appropriate (Trackman: the CTO / Tracking
      Systems team). Requires the actual content: owner pastes it or provides the
      profile URL for a browsing session (LinkedIn is auth-gated, not fetchable blind).

## 1. MANDATORY sections (never drop)
- [ ] **ACCESSIBILITY** section present (hearing-impaired, not limiting) — Gabriel-mandatory.
- [ ] **INTERESTS/SPORT** includes the **cats** item and the witty reveal
      ("literally a team player" for rugby; cats punchline) — the joke lands by REVEAL.
- [ ] LANGUAGES with real levels; EDUCATION; CERTIFICATIONS; STANDARDS; PUBLICATIONS/PATENTS.

## 2. CV layout / formatting
- [ ] **AI-assisted notice** = LAST element at the **bottom of the sidebar** (anchored),
      not floating below page 2. Measure its Y vs page bottom (PyMuPDF).
- [ ] **Sidebar fills to the page end** on **every** page (no dead space at the bottom).
- [ ] **Columns bottom out together**; main column not far short of the sidebar.
- [ ] **No orphans / short lines** — measure last-line fill ratio; ENRICH short lines and
      TRIM runts (bidirectional, render-measured — line-distribution-guidelines).
- [ ] List-shaped sidebar sections are **bulleted** (CORE STRENGTHS, SPORT & INTERESTS,
      PUBLICATIONS), not cramped paragraphs. CORE STRENGTHS: tabular OR justify the choice.
- [ ] **REFERENCES** at the **main column's end**, not the sidebar.
- [ ] **STANDARDS** given room; include electro-optics / **imaging standards** (MTF/SFR, EMVA 1288, etc.).
- [ ] **Google Scholar / LinkedIn** rendered as **active hyperlinks**, not plain text.
- [ ] Main column carries a **light brand tint** to balance a dark sidebar (rule 12: not both pure).
- [ ] Header gold rules (row 62): centered name/spec/contact stack, ✉+icon contacts, photo over sidebar, divider.

## 3. Cover letter
- [ ] **Application line** in the header (NOT the specialization line; CL subtitle = application).
      NB generator quirk: CL renders subtitle twice — fix the generator, don't blank the line.
- [ ] **Slogan** present (CL slogan element).
- [ ] **Signature** image present above the typed name.
- [ ] Lead-ins are **orange rich_block leads** (`b:'Goal'`), NOT section headings — incl. **Goal**.
- [ ] Prose **compressed to the owner's targets** (measured char deltas — e.g. the LiDAR
      contribute bullet −12, the Goal line −8); one-line results; no orphans.
- [ ] Banned em/en dashes → hyphen only; banned-words clean.

## 4. Verify (measure, don't guess)
- [ ] Word-COM render → **rm the PDF first** (stale-cache trap) → PyMuPDF measure:
      page count, AI-notice Y, sidebar-bottom gap, per-line fill ratios, hyperlink annots,
      span colours (theme-trap). Screenshot every page.
- [ ] Diff against the owner's known gold (KOMBIT) for parity.
