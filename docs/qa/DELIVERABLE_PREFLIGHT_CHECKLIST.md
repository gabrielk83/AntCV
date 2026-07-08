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
      **Trackman leads captured** (from `Downloads/LinkedIn Message Improvement.pdf`,
      Nicolaj's exchange, "resonated directly with the CTO"): the STRONGEST signal is
      **platform reuse that survives organizational growth / reuse over time** — center
      it. Also: lead with CURIOSITY about the engineering problem (not selling); name
      sensor breadth (cameras, LiDAR, tracking, electro-optics, multi-sensor) NATURALLY;
      frame PM as requirements / architecture decisions / change governance / planning &
      prioritization / cross-functional execution / stakeholder alignment (not generic
      "project management"); show that different sports need different sensing/tracking/
      analytics (product thinking). TONE: "I was curious how… / My experience has been…";
      AVOID "I am the ideal candidate", "extensive experience", and buzzwords
      (innovation, cutting-edge, world-class). Concrete engineering language only
      (platform, requirements, architecture, trade-offs, reuse, scaling, planning,
      execution). The existing draft already leans this way — the re-do makes reuse-over-time
      the spine.

## 1. MANDATORY sections (never drop)
- [ ] **ACCESSIBILITY** section present — Gabriel-mandatory. **EXACT wording only:**
      "Hearing-impaired; clear visual contact and written follow-up work well." **NEVER add
      "Hearing has not limited my career" (or any equivalent) — BANNED in every application**
      (owner 2026-07-08). No medical detail beyond the one sentence.
- [ ] **INTERESTS/SPORT** includes the **cats** item (punchline LAST; "team player" stays
      unwritten per kernel `never_render_raw` — the wit is the rugby↔cats juxtaposition).
      **Every interest item carries a WHY or a specific — never a bare word** (owner 2026-07-08:
      "Hiking" → "Hiking - long-distance walking to reset and think clearly"; "Cultural exchange"
      → name the countries). Bare single-word interests are a defect.
- [ ] LANGUAGES with real levels — **Danish = "Intermediate"** (not "B1"; owner 2026-07-08);
      EDUCATION (abbreviate once then reuse — "M.Sc. Electrical Engineering (EE)" then "B.Sc. EE");
      CERTIFICATIONS; STANDARDS; PUBLICATIONS/PATENTS.
- [ ] **DK volunteer/community roles use the Danish word "foreningsarbejde"**, NOT "Volunteer"
      (owner 2026-07-08). Keep the role header on ONE line (shorten the company if it wraps —
      e.g. "Copenhagen Wolves RFC", drop the "Pan Idræt" umbrella).
- [ ] **REFERENCES: generic only — "International and Danish references available on request."
      NEVER name recommenders the owner did not surface** (owner 2026-07-08: names were listed
      that he deliberately did not expose). No Innoviz/Welltec/TAU/Pan-Idræt names.
- [ ] **PUBLICATION COUNT is owner-set — state TWO peer-reviewed publications, do NOT inflate to
      3 or 4** (owner 2026-07-08 "I keep you on 2 on purpose"). Don't add LinkedIn to the pubs
      link line (LinkedIn is already in the header); Google Scholar link only.
- [ ] **INTERESTS: one concise line each** — a why/specific but NOT a 3-line sprawl (owner
      2026-07-08 "over-enhanced again"): "Hiking - to clear the head", "Cross-cultural work
      (Israel to Denmark)". Balance between bare words (banned) and over-enhancement (banned).

## 2. CV layout / formatting
- [ ] **DATES: never "20XX - present" for Gabriel — always "20XX - 2026"** (owner, KOMBIT +
      2026-07-08). Kanzen ApS ends 2026; every current role reads "… - 2026".
- [ ] **PATENT NUMBER appears exactly ONCE** in the whole CV (owner 2026-07-08): if there is a
      PUBLICATIONS/PATENT section, the number lives there and the Sirin role says only
      "a patented …" (no number); if there is no such section, the number goes in Sirin.
- [ ] **PUBLICATIONS brief for non-research roles** (PM etc.): patent + a one-line summary
      ("Three peer-reviewed publications on …") + an active-link line — NOT full citations.
- [ ] **AI-assisted notice** = **PINNED at the page bottom** in the sidebar column (NOT flowed
      after the last sidebar line — owner 2026-07-08: an inline notice "regressed to the initial
      problem"). The worker keeps the **page-anchored VML** and lifts it up the page so it lands
      fully visible (docx-worker 1.14.136, AI-NOTICE-ANCHOR-FIX-001, `__mt` 806pt — 824pt put the
      box edge ON the page edge and Word clipped it). Route to the sidebar side via `ai_wm_side` =
      the sidebar's physical side. VERIFY "author retains" sits at ~y 806-824 of the last page.
- [ ] **Sidebar fills to the page end** on **every** page (no dead space at the bottom).
- [ ] **Columns bottom out together**; main column not far short of the sidebar.
- [ ] **No orphans / short lines** — measure last-line fill ratio; ENRICH short lines and
      TRIM runts (bidirectional, render-measured — line-distribution-guidelines). **The two-column
      main body is ~76 chars/line at 10.5pt; RESULTS lines must be ONE line (≤ ~74 chars);**
      reword any paragraph whose last line is a single word (measure every wrapped block, headings
      and table cells excepted). This is the owner's repeated ask — implement it, don't ship runts.
- [ ] List-shaped sidebar sections are **bulleted** (CORE STRENGTHS, SPORT & INTERESTS,
      PUBLICATIONS), not cramped paragraphs. CORE STRENGTHS: tabular OR justify the choice.
- [ ] **COMPETENCY TABLE: narrow the Focus column (`tableRatio` ≈ 0.22) AND trim each Strengths
      cell so it sits on ONE line** (owner 2026-07-08 "at least 3-4 items on one line"). Measure:
      most/all rows single-line in the render.
- [ ] **Section HEADING must hug a following table** — no 2pt after-space gap (worker
      HEADING-TABLE-GAP-001, 1.14.136: heading after-space = 0 for `type:'table'` sections).
- [ ] **TOOLS & METHODS keeps its GROUP structure** (owner 2026-07-08 "missing groups") — the
      full kernel grouping (Project & delivery / Requirements & ALM / Quality & methods /
      Qualification / Sensing & optics / Engineering & imaging / Data & reporting), not a
      flattened few. A fuller sidebar also fills page-1 dead space.
- [ ] **KNOWN GAP (deferred): page-2+ sidebar content dead-space / columns to the exact page
      end** — a genuine fix needs the FLOAT-SPINE; reducing the row-fill slack re-triggers
      PDF-BLANK-PAGE (8-blank-pages incident). Do NOT shrink the slack blind; track it.
- [ ] **REFERENCES** at the **main column's end**, not the sidebar.
- [ ] **STANDARDS** given room; include electro-optics / **imaging standards** (MTF/SFR, EMVA 1288, etc.).
- [ ] **Google Scholar / LinkedIn** rendered as **active hyperlinks**, not plain text.
      **Use `[text](url)` markdown in any text/bullet** — the worker turns it into a clickable
      ExternalHyperlink (inlineRuns / RICH-BLOCK-HYPERLINK-001). Verify with PDF link annots.
- [ ] Main column carries a **light brand tint** to balance a dark sidebar (rule 12: not both
      pure). **Set `style.mainTint`** (a light hex, e.g. `FCF3EC`; worker 1.14.135 MAIN-TINT-001).
- [ ] Header gold rules (row 62): centered name/spec/contact stack, ✉+icon contacts, photo over sidebar, divider.

## 3. Cover letter
- [ ] **Application line** in the header (NOT the specialization line; CL subtitle = application).
      NB generator quirk: CL renders subtitle twice — fix the generator, don't blank the line.
- [ ] **Slogan is PERSONAL + brand/fit-derived** (owner 2026-07-08): not a generic product tagline.
      It must reflect a real read of the company brand and the candidate's fit. **Support BOTH
      placements in the generator; render only ONE visible, chosen by the TONE of the posting**
      (owner 2026-07-08): a formal/corporate posting → a top slogan line; a warmer/curiosity-led
      posting → the embedded opening LEAD-IN (Trackman: "The work I care about most is making the
      invisible manufacturable:"). Keep the other option available, not deleted. Never a weak top
      slogan competing with a strong lead-in. (Keep `meta.slogan` non-empty regardless, to avoid
      the subtitle double-render.)
- [ ] **Signature: CENTERED by default** (owner 2026-07-08) unless AntCV/owner orders otherwise —
      `signature_align:'center'` (the worker already defaults to center; never override to 'left'
      without instruction). **Recolor the ink to the brand / visual style** — do NOT ship the raw
      blue pen. Key out the white background to transparent and remap ink to the brand dark tone
      (Trackman: blue → dark gray `#333333` = header charcoal). Method: Pillow, `alpha = (255-luma)`,
      `RGB = brand-dark`. Signature sits above/below the typed name, centered.
- [ ] **Closure = homework/fit MIXED with a personal, job-adapted signal + an invitation**
      (owner 2026-07-08 — "make this pattern stay, adapted to the job and candidate's signals;
      mix and make strong, not only here but AntCV in general"). Show you did the research and read
      a strong fit ("From what I have learned about <Company>, I understand the priorities behind this
      role … and see a strong match with my experience and the way I work"). **Serve the
      homework/priorities read SOFT at the open and let conviction BUILD across the paragraph**
      (owner 2026-07-08): use "I see / observe / to my understanding / my sense is …" then rise
      to "the closer I look, the stronger the match" — NEVER a blunt "I understand the priorities
      behind this role" (too assertive, not the owner's voice). Fold in a REAL personal
      signal adapted to the employer (Trackman is sports → the inclusive-rugby-club operations line),
      and CLOSE on a concrete invitation ("learn more about your needs, introduce myself further, and
      share a few early ideas on where I could contribute"). Don't ship only the homework half or only
      the signal half — blend both.
- [ ] Lead-ins are **orange rich_block leads** (`b:'Goal'`), NOT section headings — incl. **Goal**.
- [ ] Prose **compressed to the owner's targets** (measured char deltas — e.g. the LiDAR
      contribute bullet −12, the Goal line −8); one-line results; no orphans.
- [ ] Banned em/en dashes → hyphen only; banned-words clean. **Incl. the worker's built-in
      AI-assisted notice** (fixed docx-worker 1.14.134 — the "AI-assisted — author…" footer used an
      em dash on EVERY doc; also the value+citation join and doc-title metadata). Measure the rendered
      PDF for any `—`/`–`, footer included, not just the body you authored.

## 4. Verify (measure, don't guess)
- [ ] Word-COM render → **rm the PDF first** (stale-cache trap) → PyMuPDF measure:
      page count, AI-notice Y, sidebar-bottom gap, per-line fill ratios, hyperlink annots,
      span colours (theme-trap). Screenshot every page.
- [ ] Diff against the owner's known gold (KOMBIT) for parity.
