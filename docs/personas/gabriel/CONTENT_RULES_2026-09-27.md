# Gabriel — content rules (owner corrections, 2026-09-27 session)

Owner-issued rules from the executive-linear package batch (Terma 1030–1034, Hamamatsu 1035, UL 1036). They apply to EVERY AntCV output for this persona — generator, writer prompts, kernel, and the house-style scripts in `Application Generator Files/housestyle_pdf_generator/`. When a generated document and this file disagree, this file wins.

## Facts and wording

| Rule | Detail |
|---|---|
| Current role first | **Project Manager, Hardware Development & Supply — Trackman A/S, Hørsholm (2026 – present)**. Trackman's own language (sponsor Charlotte Doyle, 2026-09-24): *Project Management Assistant (PMA)*, not MDA; *hardware projects*, not modules; *supplier selection* + *supplier agreements*; *2–4 phases*. |
| Innoviz is two roles | System Architect, Automotive LiDAR (2017–2020) and Change Control Lead & Customer Change Request Manager (2020–2025). Never one 8-year line. |
| Education | Two separate degrees taken in parallel: **B.Sc. Physics** and **B.Sc. Electrical Engineering**, Tel Aviv University 2000–2005. Never "Dual B.Sc.". Listed as two entries. |
| Publications | **Two** peer-reviewed papers and a conference poster (carbon-nanotube NEMS). Never "three". Google Scholar link: `scholar.google.com/citations?user=E6q1Y34AAAAJ&hl=en`. |
| Project | AntCV (2026) appears in the closing details table as its own row with a live link `github.com/gabrielk83/AntCV`. |
| ISO 9001 | Plain "ISO 9001". Never clause numbers (§8.3 / §8.4). |
| "team player" | Exactly once per document, only next to the rugby line ("Operations manager (foreningsarbejde) at Pan Idræt – literally a team player" / letter: "literally, as operations manager of an inclusive rugby club"). Work-style sentences use other wording. |
| Russia clause | "no ties to Russia or Russian-allied states" only when the ad strictly asks. Default: omit. |
| Hearing line | CV: the Accessibility row (centred label). Letters in the executive style: never. Employers who ask for no health data (Hamamatsu): drop the row from the CV too. |
| Interests | Rugby line, then a full-width 3-column strip: Tai-chi · Cultural exchange (Languages, food, board games) · Hiking. |
| Banned words | The `workers/proxy/src/writing-style-engine.js` en list, plus: collaborative → team-based, cross-functional → multi-disciplinary, end-to-end → from start to finish, leading → running. Scrub must preserve capitals. |
| Results by impact type | Owner 2026-10-01 (Improve Academy, "looking for impact"): every Results line and achievement bullet is one of four types. **Performance**: what rose or fell (time, cost, quality, efficiency, delivery), with its number. **Deliverables**: what was built or completed, with a count or scope. **Improvements**: what works better (faster, clearer, standardised). **Business and target audience**: who benefited, at what scale. Per job, the type the ad asks for most gets weight in choosing results, after JD relevance; motivation lines stay. Spread types across roles. `RESULTS-IMPACT-TYPES-001` in `pwa/gold-rules.json`. |
| Languages order | Danish first, then English, Spanish, Hebrew (owner 2026-10-01). `LANGUAGES-ORDER-001`. |
| Trackman is an internship | Said in the role body, never in the role line: first bullet label "… (internship):". Owner 2026-10-01, `ROLE-BODY-NOTE-001`. |
| Course on the CV | Add "Effective Job Creation Strategies, Improve Business Academy" to Certificates & courses (owner 2026-10-01, course pointer). Needs one entry in the app's stored certificates. |
| References | Names of the two most relevant referees, ending "contact details available upon request". No phone or e-mail. `REFERENCES-ON-REQUEST-001`. |
| Skills | Few and grouped: hard skills in Core Competencies and Tools & Methods, soft skills in the "Work style:" line. `SKILLS-GROUPED-001`. |
| Course pointers | Picture, course, references, readable font, grouped skills, margins. Where each one lives: `cv_pointers` in `pwa/gold-rules.json`. |
| The Checklist runs by default | Owner 2026-10-01: the course CV checklist (compendium p 22, 8 groups) is filled for every generated CV. `gen-runner.py run` writes `checklist_<uk>.md` + `.json` beside the review bundle; `export_pdfs.py` / `export_docx.py` write `<name>.checklist.md` + `.json` beside each CV. Opt out: `--no-checklist`. `COURSE-CHECKLIST-DEFAULT-001`. |

## Profile (owner 2026-10-01, Improve Academy session 1)

| Rule | Detail |
|---|---|
| Heading slogan (PROFILE-SLOGAN-001) | The heading reads **"Profile: <slogan>"** by default (owner 2026-10-01: "so it is clear that it still is a profile section"), e.g. "PROFILE: MAKE THE CASE BEFORE THE SPEC". Slogan: 3–8 words, their product + their need. It shares **no content word** with the cover-letter slogan. AntCV: gen returns `cv_overrides.profile_slogan`, and `antcv-cv-profile-heading.js` sets it as the heading. A slogan that repeats the cover-letter slogan is not applied. Layout tab → **CV PROFILE HEADING** to edit the text or switch Slogan / PROFILE. |
| "I" (PROFILE-VOICE-001) | Written with "I". Never third person, never "Experienced engineer with…". |
| From me to them (PROFILE-VOICE-001) | Only the opening sentence is personal: "I am a <role> who…" + 1–2 real results. After it, every sentence faces the company: "<Company> does X / faces Y" → "As your <role> I will…" + outcome. Never "I'm excited / I enjoy / I'm drawn to / I thrive / I want to develop". |
| No buzzword list (PROFILE-NO-BUZZWORD-LIST-001) | Every sentence has a subject, a verb and something concrete. No stacks of adjectives or nouns ("Results-driven, detail-oriented…", "Risk, agile, delivery"). |
| Structure | Who I Am / How I Work / What I Bring. Name the target company. Name past work by product, not by Israeli employer names (Trackman stays when relevant). |

Checks: `pwa/antcv-profile-rules.js` (Layout control + `pwa/test/unit/profile-slogan.test.mjs`). Prompt rules: `pwa/gold-rules.json` prompt_block 1.9.2. Current Veo and Hamamatsu profiles: `PROFILES_2026-10-01_veo-hamamatsu.md`.

## Layout (executive-linear style, CV and letter)

| Rule | Detail |
|---|---|
| Whole lines only | A bullet or paragraph is one full line or two full lines, never 1.5. Extend with a concrete clause or cut. Owner reviews renders line by line. |
| Line-fill pass | Compress first (character spacing to −0.4 pt, then one −0.5 pt font step); extend with ≤ +0.2 pt spacing. **Never Word "Distribute"** — it spreads letters. Table cells included; header box excluded. |
| One-line elements | Header `TITLE \| slogan • Copenhagen, Denmark`, the letter's application line, and short details rows (Availability & Travel) must be ONE line: shorten the slogan/text and condense, never wrap. |
| Certifications | Full-width row spanning both education columns, below MBA/M.Sc. (left) and the two B.Sc. (right). |
| Header | Light box `#F8FAFC`, 0.75 pt `#0369A1` frame on all sides; CV: circular photo left with `#0070C0` ring and a 3 pt `#0070C0` bar; letter: no photo, all header text centred. |
| Experience line | `Title — Company` left, `years \| location` right-tabbed, company 10 pt. |
| Page furniture | Running header on page 2+ (`Name — Title (Experience & Technical Arsenal)`), AI-assisted watermark footer on page 2+ only. |
| Budgets | CV exactly 2 pages; letter 1 page with the sign-off and signature visible (Edge clips — check text, not page count). |

## Where these are implemented today

- Generator: `exec_pkgs.mjs` (data), `exec_cv_lib.mjs` (DOCX), `exec_lib.mjs` (letter HTML), `exec_build_all.mjs` (scrub + Russia opt-in), `exec_word_pass.ps1` (line fill), `exec_finish.mjs` (budgets), `exec_gate.mjs` (banned words).
- Kernel snapshot: `kernel_snapshot_2026-06-16.md` (Trackman role, hand-mirrored; D1 write pending).
- AntCV app, content rules: shipped 1.51.4586 (2026-09-29, VEO-ROLE-LEAK) in `pwa/gold-rules.json` 1.6.0 — target role is the posting's own title (never a partner role named in the ad), example isolation, same-company roles never merged, parallel degrees as two entries, levels/counts as stored, current role first, kernel placement notes obeyed, the banned-word replacements above, standards without clause numbers, Russia clause only on ask, accessibility line (CV only). Example isolation also in `workers/proxy` + `workers/demo-proxy` `prompt-augment.js` — **those two workers still need a workflow_dispatch deploy**.
- AntCV app, stored facts: kernel v13g (local `Gabriel_personalInfo_modernized_2026-08-20_v13.json`, 2026-09-29) now has Trackman first, Innoviz titles as above, Kanzen closed 2022–2026, Danish B2. **D1 mirror pending** — AntCV generates from D1 until the file is imported.
- AntCV app, layout: NOT yet — the executive-linear layout is steps 3–5 of `docs/design/EXECUTIVE_LINEAR_LAYOUT_PROPOSAL.md`; only `role.location` + role-line format shipped (1.51.4566).

## Lessons from the Veo Director CV (owner edits, 2026-10-05)

Source: the owner's own Word edits to `CV_Veo_Director_enriched.docx` (AntCV-course-exercises, executive-linear layout) compared with the generated version, plus the owner's corrections in the same session.

### Type and spacing

| Rule | Detail |
|---|---|
| Body font | **Calibri 10.5 pt** for body, bullets and table cells (owner replaced Arial 10 pt). Calibri is narrower, so 10.5 pt fits the same lines. Section headings in **Trebuchet MS**. |
| Character spacing | Line fill is done per paragraph with condensed spacing in small steps: −0.1, −0.2, −0.3, −0.4, −0.5, −0.6 and up to −0.8 pt, with 99 % character scale on dense lines. Extends the −0.4 pt limit above for single lines; still never Word "Distribute". |
| Whole lines | Re-check after EVERY text edit: a one-word or short second line ("gates.", "product.") is a defect. Shorten the clause or condense; do not leave 1.5 lines. |
| Extending a line | When a bullet ends short, extend it by 30-50 characters with stored facts (e.g. "battery system design and testing", "fully operating SWIR sight demonstrator"), never with new claims. |
| Page 2 start | One explicit page-break paragraph before "Professional experience (Cont.)". Never stacked empty spacer paragraphs: when page 1 grew, four spacers spilled to the top of page 2 and pushed the CV to 3 pages. |
| Document end | Keep exactly one empty paragraph after the last table (1 pt exact line height); a second one creates a blank page 3. |

### Wording

| Rule | Detail |
|---|---|
| Tense | Present tense in ALL job bullets, earlier roles included, and in Results lines: Chair, Establish, Present, Own, Lead, Develop, Qualify, Supervise; "cuts rejects", "ships". |
| Supplier names | Do not name suppliers or contract manufacturers from former employers (NDA risk). Use categories: "global optics, crystal and microdisplay manufacturers", "display, camera-module and image-sensor suppliers". |
| Audits | Supplier audits: Sirin Labs and Meprolight (led and performed in person). Innoviz: customer audits of Innoviz as a supplier, 2 audits, central contributor, own areas fully owned. |
| Kanzen offers | "input to nearly 100 client offers, with pricing and decision material for 4 clients". Never "100+" or "4 offers". |
| Rugby | "Team Operations Manager & Coaching Assistant (foreningsarbejde), Copenhagen Wolves RFC (Pan Idræt)"; World Rugby Level 1 coaching course completed; assists the coaches. Never "coach", "coaching" as the role, or "Assistant Coach". |
| Standards (camera employers) | EMVA 1288 · ISO 12233 · ISO 15739 · IEC 60529 · IEC 60068 · MIL-STD-810 · CE/RED · ISO 9001, on one line, no explanatory parentheses (from the owner's 2026-09-10 regulatory list). |
| Supplier qualification | Keep "four countries (Israel, China, Taiwan, Sweden)". |

### Structure

| Rule | Detail |
|---|---|
| Details tables | The closing details are three tables, each with its own heading: CREDENTIALS (standards, courses, patent) · LANGUAGES & PERSONAL (languages, rugby, accessibility) · AVAILABILITY & REFERENCES. Not one "Languages, interests & profile details" table. AntCV app change (preview + docx-worker) pending owner approval. |
| Bullet order | Lead each role with the people and decision signal (budget, hiring, team incl. its manager, change board), technical depth second. |
