# Gabriel — content rules (owner corrections, 2026-09-27 session)

Owner-issued rules from the executive-linear package batch (Terma 1030–1034, Hamamatsu 1035, UL 1036). They apply to EVERY AntCV output for this persona — generator, writer prompts, kernel, and the house-style scripts in `Application Generator Files/housestyle_pdf_generator/`. When a generated document and this file disagree, this file wins.

## Facts and wording

| Rule | Detail |
|---|---|
| Current role first | **Project Management Intern, Hardware Development & Supply — Trackman A/S, Hørsholm (Nov 2026 – present)** (owner 2026-11-08, the LinkedIn title; was "Project Manager, Hardware Development & Supply"). Trackman's own language (sponsor Charlotte Doyle, 2026-09-24): *Project Management Assistant (PMA)*, not MDA; *hardware projects*, not modules; *supplier selection* + *supplier agreements*; *2–4 phases*. |
| Innoviz is two roles | System Architect, Automotive LiDAR (2017–2020) and Change Control Lead & Customer Change Request Manager (2020–2025). Never one 8-year line. |
| Education | Two separate degrees taken in parallel, listed as two entries, Electrical Engineering first: **B.Sc. Electrical Engineering · Tel Aviv University (double degree)** and **B.Sc. Physics · Tel Aviv University (double degree)** (owner wording 2026-10-05). Never "Dual B.Sc." and never one merged line. Years as stored in the kernel. |
| Publications | **Two** peer-reviewed papers and a conference poster (carbon-nanotube NEMS). Never "three". Google Scholar link: `scholar.google.com/citations?user=E6q1Y34AAAAJ&hl=en`. |
| Project | AntCV (2026) appears in the closing details table as its own row with a live link `github.com/gabrielk83/AntCV`. |
| ISO 9001 | Plain "ISO 9001". Never clause numbers (§8.3 / §8.4). |
| "team player" | Exactly once per document, only next to the rugby line ("Operations manager (foreningsarbejde) at Pan Idræt – literally a team player" / letter: "literally, as operations manager of an inclusive rugby club"). Work-style sentences use other wording. |
| Russia clause | "no ties to Russia or Russian-allied states" only when the ad strictly asks. Default: omit. |
| Hearing line | Superseded 2026-11-01 by COMMS-LINE-001 (see the end of this file): CV row titled **Communication**, no disability label. Letters: never. Employers who ask for no health data (Hamamatsu): drop the row from the CV too. |
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

## Executive-linear CV rules (owner edits, 2026-10-05)

General rules for every role and every executive-linear CV/letter, learned from the owner's own Word edits to a generated CV (Veo Director of Hardware Engineering, 2026-10-05). Persona facts confirmed in the same session are listed separately at the end.

### Type and spacing

| Rule | Detail |
|---|---|
| Body font | Calibri 10.5 pt for body, bullets and table cells; section headings in Trebuchet MS. Calibri is narrower than Arial, so 10.5 pt fits the lines that Arial 10 pt filled. |
| Tables use body size | Tools & methods, Credentials, Languages & personal and Availability & references tables use the SAME Calibri 10.5 pt as the body (owner raised them from 10 pt), with condensed letter spacing where a cell would wrap. Smaller table text is only a fallback when page 2 has no room. |
| Character spacing | Fill lines per paragraph with condensed spacing in small steps (−0.1 to −0.8 pt), 99 % character scale on dense lines. This extends the −0.4 pt line-fill limit above for single lines. Never Word "Distribute". |
| Whole lines | Re-check every bullet after EVERY text edit: a short last line (one word, or under about a third of the width) is a defect. Shorten the clause or condense. |
| Extending a line | A short bullet is extended by 30-50 characters with stored facts only, never with new claims. |
| Page 2 start | One explicit page-break paragraph before "Professional experience (Cont.)". Never stacked empty spacer paragraphs: they spill to the top of page 2 when page 1 grows. |
| Document end | Exactly one empty paragraph after the last table (1 pt exact line height); a second one can create a blank last page. |

### Wording

| Rule | Detail |
|---|---|
| Tense | Present tense in ALL job bullets, earlier roles included, and in Results lines (Chair, Establish, Present, Own, Lead, Develop, Qualify, Supervise; "cuts", "ships"). |
| Third-party names | Never name suppliers, contract manufacturers or customers of former employers (NDA risk). Use categories ("display, camera-module and image-sensor suppliers"). |
| Audit direction | Say which way an audit went: supplier audits (the candidate audited suppliers) vs customer audits (customers audited the candidate's employer as a supplier). Never mix them. |
| Counts and costs | No "100+"-style inflation; use the stored wording ("nearly 100"). Do not state a cost direction (higher/lower) unless the stored fact says it. |
| Volunteer roles | Label the row "Foreningsarbejde: Rugby team Operations Manager ..." (owner 2026-11-03). Never upgrade a supporting sports role to "coach" or "Assistant Coach". |
| Standards | Match the standards list to the employer's domain (e.g. image-sensor and image-quality standards for a camera company), taken only from the candidate's stored list; one line, no explanatory parentheses. |
| Banned words | Re-run the banned-word scrub after manual edits (a hand edit reintroduced "cross-functional"). |

### Structure

| Rule | Detail |
|---|---|
| Details tables | The closing details are three tables, each with its own heading: CREDENTIALS (standards, courses, patents) · LANGUAGES & PERSONAL (languages, sport/interests, accessibility) · AVAILABILITY & REFERENCES. Not one combined "Languages, interests & profile details" table. Shipped in AntCV 1.51.4873 (preview + docx-worker, `LINEAR-DETAILS-ENRICHED-001`: courses and a stand-alone patent are CREDENTIALS rows, every table reads its theme name, rows in the order above; `LINEAR-CONT-001`: the export opens page 2 with "Professional experience (Cont.)" after one explicit page break from the preview's role page). |
| Bullet order | Lead each role with the people and decision signal (budget, hiring, team incl. its manager, change board), technical depth second. |
| Education detail | Every degree gets a one-line focus under it (subjects, research group, papers, award), from stored facts, styled like the MBA note line. Never only title + school + years. |
| Interests | Keep the Interests row in EVERY layout, humour included ("home supervision of three feline strategic napping experts"). Converting two-column to linear must carry over every section; nothing personal is dropped silently. |
| Enriched CV | An "enriched" CV carries the cover-letter and contact signals itself (profile, bullets, competencies) and is uploaded ALONE when a portal takes one file. Never append a cover-letter page to it. |
| Cut order | To fit the page budget, cut the lowest-priority optional bullets and shorten details rows (courses, referees on one line) first. Never cut personality, education detail or interests to save space. |
| Cloned lines | When a new line is cloned from an existing paragraph, clear hidden paragraph marks (w:vanish); a hidden mark merges the new line into the next heading. |

### Persona facts confirmed 2026-10-05 (Gabriel)

- Supplier audits: Sirin Labs and Meprolight (led and performed in person). Innoviz: customer audits of Innoviz as a supplier, central contributor, own areas fully owned.
- Kanzen: input to nearly 100 client offers, with pricing and decision material for 4 clients.
- **Cover letter is a letter, never a copy of the CV (LETTER-NOT-CV-001, owner 2026-11-03):** one column under a letterhead (photo, name, target title, contact line); no side panel, no proof points, no languages block.
- **One-file portals (ONE-FILE-PORTAL-001, owner 2026-11-03):** when an employer accepts a single upload (e.g. Hamamatsu Workday), send the CV only and fold the letter's argument into an enriched profile ("Why this role", two or three lines). No letter+CV combined document.
- Foreningsarbejde: Rugby team Operations Manager & Coaching Assistant, Copenhagen Wolves RFC (Pan Idræt); World Rugby Level 1 coaching course completed; assists the coaches. (RUGBY-ROW-001, owner 2026-11-03: the row label is always "Foreningsarbejde" and the text opens "Rugby team Operations Manager", in English and Danish CVs; never "Rugby: Team Operations Manager".)
- Meprolight microdisplay end-of-life: higher-performance replacement at lower unit cost; it needed lead time to test it and build a new interface.
- Supplier qualification: four countries (Israel, China, Taiwan, Sweden).
- Education focus: M.Sc. EE - optics, photonics and nanotechnology, in a photonics research group, two peer-reviewed papers; both B.Sc. degrees - optics, VLSI and DSP; MBA - business plan honourable mention at Tsinghua University.
- Interests: Tai-chi · hiking · cultural exchange (languages, food, board games) · home supervision of three feline strategic napping experts.

Generator twin of the 2026-10-05 structure: `housestyle_pdf_generator/course_cvs_2026-10-01/gen_linear3.py` (`linear_enriched`; first package 1041 microTECH, 2026-10-08).

**Enriched CV scope (owner 2026-10-08):** the enriched CV is used ONLY when the posting or portal will not accept a cover letter (no letter field; an agency asking for "a CV"). Otherwise: plain linear CV + separate letter. In AntCV it is the output of the editor's "Fuse" (cover letter into CV) button - opt-in, never the default export.

## 2026-10-18 - Improve Academy review of the Veo package (Anne) -> rules of record (REVIEW-VEO-001)

The reviewer read page 1 only: education, Meprolight, the patent, supplier qualification and the 2006 start all sit on page 2 of the enriched CV. Fix of record: page 1 carries a footer cue "Page 1 of 2 - continued" (finish_pkgs.ps1); the profile year count must be visible against the roles shown on page 1.

| Rule | Wording of record |
|---|---|
| Core-competencies headings | "The role needs" / "What I bring, with proof" (DA "Rollen kræver" / "Det bringer jeg, med belæg"). Rows use the ad's own words on the left, delivery plus proof on the right (VALUE-FOR-ROLE-001). AntCV app, docx worker, sidecars and prompts renamed at 1.51.5033 (CC-HEADERS-PLAIN-001, 2026-10-18); a saved document with the old header pair is migrated on load and mapped at render and export. |
| Profile shape | One hook sentence (identity + strongest concept-to-product proof), then at most three lines of What I Bring and two lines of Work style. Never "I will" / "I would" in a CV (gate_html.mjs fails on it); promises belong in the letter. |
| Role bullets | Same order in every role: owned (people, budget, scope), did, bold Results. At most three bullets plus Results. |
| Leadership targets | Budget ownership (with the number when on record), hiring and mentoring bullets are mandatory where the source has them (Meprolight SWIR-sight budget, Sirin electro-optics budget, one hire at Kanzen). Influence without line authority (ODM team, matrix board) is said plainly. One line on trade-off calls outside the own speciality reduces the breadth doubt. |
| Claim parity | Same attribution wording in CV and letter: "analysis behind a 90% (10x) unit-cost reduction", never "cut the cost tenfold". Internal numbers ($8M NRE, ~30% of FY2025 revenue) are cleared for use (owner 2026-10-18: Innoviz is fine with the numbers). |
| Timeline | Kanzen place line states the overlap: "Copenhagen, alongside Innoviz until 2025" (KANZEN_PLACE); owner confirmed 2026-10-18 that Kanzen ran in parallel to Innoviz. Trackman carries the motivation line: internship within the Improve Academy project-management programme (2025 - 2026), staying hands-on after Innoviz. AntCV under Kanzen is two bullets (what shipped, what it shows); no pipeline detail. |
| Cover letter | Sentence-case headline (clbuild2 warns on caps). About 400 body words (warns above 420). Not every section opens with "I will": mix "I would", "what I would want to understand first", one or two first-90-days questions. One sentence on the stakeholder functions the ad names; one sentence connecting something true about the candidate to the employer's stated mission; leadership targets add a budget-building and first-hire sentence. Trackman only with its one-clause explanation. |
| AntCV app | Same rules added to the proxy and demo-proxy writing engine (INTEGRITY_RULES cv-no-promises, profile-shape, role-bullet-order, leadership-evidence, claim-parity, timeline-complete, cl-modality-mix, cl-stakeholders-mission, cl-headline-case) and to the cv_profile / cl_general task prompts. |

Not adopted: the margin (sidebar) layout. The linear layout was chosen for ATS parsing and is the owner's design of record; the proof-points idea is served by the Results lines and the competencies table.

| Accessibility (owner 2026-10-25, **superseded 2026-11-01 by COMMS-LINE-001**) | "Hearing impaired; live-transcription glasses caption and translate speech, and clear spoken communication with written follow-ups works well." The glasses caption and translate Danish; a letter that mentions Danish level or hearing names them. Kernel v13k. |

| Snowflake (owner 2026-11-01) | Basic interfacing only: connecting Snowflake to Power BI, cloud services and SharePoint for reporting. Listed in Software tools and as a Kanzen bullet (kernel v13l); shown on data/BI-flavoured targets, never claimed as data engineering or warehouse ownership. |

| Arena PLM (owner 2026-11-01) | Used in the Innoviz Change Request Lead role: change orders, item and BOM revisions, approvals and release, alongside Codebeamer traceability (kernel v13n). Listed in Software tools. Never a PLM-administration or data-model claim. |

## 2026-11-01 - Communication instead of disability (COMMS-LINE-001)

Source: written advice from Anne (Improve Academy), 2026-11-01. "Hearing impaired" tells the reader nothing about what the candidate can do, so some employers fill the gap with worst-case assumptions. Describe what works instead of the label.

| Rule | Wording of record |
|---|---|
| CV row | Title **Communication** (da *Kommunikation*, es *Comunicación*). Stored section id stays `accessibility`; the label and text change. Wording: COMMS-LINE-002 below (the 2026-11-01 sentence is superseded). |
| CV row wording (COMMS-LINE-002, owner 2026-11-05) | EN: "English and Danish at work; live captions and written follow-ups in meetings." DA: "Engelsk og dansk i arbejdet; liveundertekster og skriftlig opfølgning i møder." Replaces the COMMS-LINE-001 sentence ("I work in English and Danish and follow meetings best with live captions and written follow-ups." / "Jeg arbejder på engelsk og dansk og følger møder bedst med liveundertekster og skriftlig opfølgning."), which needed the font squeezed to 86-90 % to stay on one line; the new line fits at 100 %. ES (not owner-worded, parallel form): "Inglés y danés en el trabajo; subtítulos en directo y seguimiento por escrito en las reuniones." |
| Second language (COMMS-LANG-001, owner 2026-11-05) | The second language follows the job. Danish when the job needs Danish; otherwise the job's own language: Spanish for a Spanish-language ad or a Spanish-speaking location, Hebrew for Israel. Both when the job needs Danish and the other ("English, Danish and Spanish at work; ..."). No signal: Danish. Spanish text says *castellano* or *español* as the ad does; otherwise *castellano* for Catalonia, Valencia, the Balearic Islands, the Basque Country, Navarre, Galicia, Argentina, Uruguay and Paraguay, *español* elsewhere. Examples: EN "English and Spanish at work; ...", "English and Hebrew at work; ..."; ES "Inglés y español en el trabajo; ..."; DA "Engelsk og spansk i arbejdet; ...". |
| Never in a CV | "hearing impaired", "hearing-impaired", "deaf", "cochlear implant", "disability". Replaces the 2026-06-12 "accessibility items state the impairment" rule and the 2026-10-25 line. |
| Cover letter | No hearing or communication-needs line (unchanged). |
| Neutral option | When an employer asks for no health data, or the owner wants the CV fully neutral, drop the Communication row; nothing about it goes into the CV. |
| When to disclose | No general duty to disclose. Default: raise it when invited to interview, as logistics with a solution. |
| Interview request (template) | "Thank you for the invitation. I follow conversations best with live captions. Could we hold the interview in Teams with captions on, and could you send the agenda in writing beforehand? I am happy to help with the set-up." |
| Work support (for later) | The Danish scheme for compensation to disabled persons in employment can fund up to 20 h/week of interpreting (e.g. a writing interpreter) or personal assistance in full-time work; applied for with the employer through the municipality's jobcenter, usually paid to the employer. Interpreter funding for interviews: ask the municipality or Den Nationale Tolkemyndighed. |

Enforcement: `pwa/antcv-profile-access-scrub.js` (COMMS-LINE-001, Gabriel name-guarded, preview + export read the stored sections; since 1.51.5465 it also rewrites rows that still hold the COMMS-LINE-001 sentence), `pwa/gold-rules.json` 1.10.2 (`communication`, `accessibility_line`, prompt_block; fallback copy in `pwa/antcv-bullet-targets.js`), `workers/proxy` + `workers/demo-proxy` `writing-style-engine.js` (communication-what-works; **both need a workflow_dispatch deploy**). The workers paraphrase the rule (languages, live captions, written follow-ups) and do not quote the sentence, so COMMS-LINE-002 needed no worker deploy. Kernel: the stored `personalInfo.accessibility` text may still hold older wording; the scrub overrides it at render.

## 2026-11-05 - No orphans, in every application (NO-ORPHAN-001)

Owner, 2026-11-05: "make sure not to have orphans - especially in tables. always, in all antCV applications."

| Rule | Detail |
|---|---|
| Definition | A paragraph of two or more typeset lines is an orphan when its last line fills less than 60 % of the line (the same floor as the app's RUNT_FRAC 0.60) or holds a single word. Applies to CVs and cover letters: requirement tables, bullets, Results lines, sidebar rows, references, interests, letter paragraphs. |
| Fix order | 1. Character-width compression (body down to 96 %, table cells down to 94 %, spacing to -0.5 pt) when it pulls the line back. 2. Slight widening (102-104 %) when it fills the last line without adding one. 3. Otherwise reword: shorten to fewer lines or lengthen with true facts only (no new claims). |
| Gate | No file is delivered while the orphan check reports a hit. House generator: `orphan_audit.py` (matches each Word paragraph to its PDF lines) after every CV and letter build; rewordings are measured before they go into the source. AntCV app: the export preflight (`pwa/antcv-orphan-export-preflight.js`) covers table cells, marker rows, bullet lists, education, lists and the whole cover letter, in the fix order above (1.51.5505 + 1.51.5565); `python scripts/orphan-audit.py <payload.json> --engine both` renders an export with the local worker and lists every orphan in LibreOffice (the CloudConvert PDF) and Word. |
| Length guide (two-column CV, main column) | About 75 characters per line: a bullet is either one line (70 or fewer) or two full lines (125-145). |
| No early wraps (NO-ORPHAN-005, owner 2026-11-08) | Gluing the last words of a paragraph together (a non-breaking bind) moves them down as one block and leaves the line above short ("…programmes with supplier scoring / on quality, lead time…"). Owner: "is not okay"; chose "cap binds". A bind may not leave the line above under 75 % of the column; what the capped bind cannot fix goes to the reword, which now gets a character budget measured from the paragraph (sidebar rows: one line beside the bold lead). Only when the reword fails does the old bind ship, so an orphan is never shipped instead. Measured on #3527: binds that left the line above under 75 % went from 7 to 0 (Word and LibreOffice); orphans went from 3 to 1 (LibreOffice) and 2 to 0 (Word), with a stand-in reword. |

## 2026-11-05 - The app CV follows the academy format (ACADEMY-FORMAT-001)

Owner, 2026-11-05: "make sure the application fully match academy format - for sidebars, for profile bullets number etc...". Shape of record: house package 1051 (`pkgs_1051.py`, EN) and 1050 (`pkgs_1050.py`, DA) on `gen_margin.py`. Audit of saved application #3491 (Kaleido, margin, da): 9 roles with 4+ bullets, bullets of 3-5 lines, English Results lines / "Work style" lead / table header / proof points in a Danish CV, 12 tools rows, 10 certificates, English-first languages, 6 interest rows, publications + regulatory + outcomes blocks, 5 pages.

| Rule | In the app (margin CV export, the default layout) |
|---|---|
| Roles | At most 6 detailed roles, newest first. University research / teaching roles (unless the job is research) and the oldest roles beyond 6 fold into ONE "Earlier career" entry, one line per employer ("Title / Title, Company (years)"). No role is merged or retitled (STORED-FACTS-001); a research job keeps its university roles. |
| Bullets | At most 3 bullets + Results per role; bullets that fit two lines (145 chars) first; a longer one only fills a role up to two bullets. A bullet over two lines keeps its first complete sentence or "; " clause when that part fits. A Results line over two lines keeps its first sentence or clause that carries a number. Cut only, never reworded. |
| Sidebar | Proof points <= 5; Tools & Methods 4 rows, no group header rows, <= 6 items per row (JD items first), one row per group first, rows in the CV language first; certificates <= 4 (JD hits, current courses, no language tests, rugby/coaching only for a sports JD, no years except BABOK); languages Danish first; interests = the Foreningsarbejde rugby row + ONE strip (house wording RUGBY_ROW / INTERESTS_ROW, Gabriel name-guarded); regulatory only the standards the JD names; a Patent row after education. |
| Hidden blocks | Selected outcomes (the Results lines carry them), publications and the additional-info block, unless the job is research. |
| Language | A da/es CV gets the house labels ("Arbejdsstil", "Rollen kræver" / "Det bringer jeg, med belæg", language names and levels). Results lines never come from English kernel text in a da/es CV: the English candidate is swapped for its translated twin (the SELECTED OUTCOMES item or role bullet that shares its numbers and acronyms), else the role falls through to the translated pool / its own bullets. Applies in preview and export (`applyOutcomesMode`). The Trackman internship note follows the CV language ("Praktik:"). |
| Not fixed by code | A profile that never names the company (stale or generic translation), English proof points / education rows / tools rows in a Danish CV, bullets still over two lines, a missing Results line, "MAFAT": the export logs them as `[ACADEMY-FORMAT-001] still off the house format` (console, `window.__antcvAcademyLast.audit`). A fresh generation (prompt line ACADEMY-FORMAT-001 in `pwa/gold-rules.json`) is the fix. |
| Languages order conflict | gold-rules LANGUAGES-ORDER-001 (revised 2026-10-23, course reviewer on Veo v7) says English first; the house template since 2026-11-01 and this file say Danish first. The margin export uses Danish first (`academy_format.languages_first`); the stored sort and the other layouts keep English first until the owner decides. |

Code: `pwa/antcv-academy-format.js` (pure, payload only; `audit()` + `apply()`), called from `antcv-docx-client.js` buildPayload after sanitizeForExport; rules in `pwa/gold-rules.json` `academy_format` + prompt line; tests `pwa/test/unit/academy-format.test.mjs`. Kill switch `antcv:disable-academy-format=1`. Measured on the stored D1 sections (local worker + LibreOffice, before the export preflight): #3491 da 4 -> 2 pages, raw orphans 57 -> 32; #3527 en 3 -> 2 pages, 48 -> 26.

### Real content only (ACADEMY-EMPTY-001, owner 2026-11-06)

Owner on a margin preview: "go to academy rule. notice that you lest sub headings empty on application" (TOOLS & METHODS, CERTIFICATES and REGULATORY CONTEXT headings with no rows, "[Language]: [level]" rows, the skeleton's ADDITIONAL INFORMATION instruction, and the owner's education and Communication line under Anita Myre-Kornfeldt's name).

| Rule | In the app |
|---|---|
| No empty heading | A section with no real row (all rows hidden, empty, placeholders or group headers with nothing under them) is not rendered: export (`apply()`, `on:false`) and margin preview (`pwa/antcv-academy-preview.js`, DOM `display:none`, never writes storage). A blank template (fewer than 3 real sections) keeps its skeleton in the preview. |
| No template text | Rows with a bracket placeholder (Markdown links excepted) or skeleton instruction text ("Add only items that support the JD ... Drop if not needed") are hidden. |
| No other person's rows | Under any name but the owner's, rows that carry the owner's facts (Technion + Tsinghua, Tel Aviv University degrees, KVUC, live captions / hearing wording, patent 241997, Innoviz / Sirin / Meprolight / Kanzen / Copenhagen Wolves, "Karp") are hidden, and the owner's patent row is never added. The Communication row shows only when the person stores a communication / accessibility line. Experience roles are not filtered (hiding them would hide the CV): an export with the owner's roles under another name is a data fault the audit reports as LEAK. |
| Owner wording | For the owner, a Communication row that still holds the COMMS-LINE-001 sentence exports in COMMS-LINE-002 wording. |

### Page budget and balance (ACADEMY-PAGES-001 / ACADEMY-BALANCE-001, owner 2026-11-06 / 2026-11-08)

Owner 2026-11-08: "you can increas white spaces in the main bar to improve this - and this is a general role - you do not want page 1 to be too coruded while page 2 is sparse. if needed do even more sparsing of page 1 to keep everthing readable."

| Rule | In the app (margin CV export) |
|---|---|
| 2 pages | The page plan comes from the preview, which still shows every stored role; after the academy projection, breaks past page 2 are dropped (1.51.6205). #3527: 3 -> 2 pages in LibreOffice and Word. |
| Roles whole | A role never splits (worker keepNext chain, ROLE-KEEP-WHOLE-001); the page-2 break sits before a role. |
| Page-1 balance | After the export preflight, `AntcvAcademyFormat.balance` estimates where page 1's main column ends (geometry fitted on the LibreOffice render of #3527; canvas text widths in the app) and gives 60 % of the free height to the section and role gaps, at most 10 pt each, when 24 pt or more is free. #3527: page 1 ended 70 pt short (LO) / 91 pt (Word); with +8.4 pt per gap it ends 28 / 49 pt short, page 2 still 195 pt short, orphans unchanged. The role gaps need docx-worker with ACADEMY-BALANCE-001 (`style.roleGap` was dropped by mergeStyle); an older worker widens the section gaps only. Kill switch `antcv:disable-academy-balance=1`. |
| Photo | The export carries the photo in `personal_info.photo_b64` (the margin card draws the 84 px ringed photo). The photo-less PDFs of 2026-11-08 came from a capture whose photo was blanked to keep the file small, not from the app. |

### Links, open end dates, Trackman (owner 2026-11-08)

Owner: "linkedin.com/in/gabriel-karp need to be active link (but keep the document color sceme, not a hyperlink blue if nor relevant to the document). next: make sure that if it is an AI-oriented position (like CIP) add a link to the antcv git. and tell more about the position at trackman (we are already past week 1)".

| Rule | In the app |
|---|---|
| LinkedIn link (LINKEDIN-LINK-001) | Already a working link in every header (margin card, band CV and letter, linear) in the header's own colour; checked in LibreOffice and Word PDFs. Inline Markdown links (Google Scholar, AntCV) no longer use the fixed #0B4F8A: they keep the paragraph colour with an underline, in the export (docx-worker inlineRuns) and the preview (app.js / app.src.js). |
| AntCV link on AI jobs (AI-REPO-LINK-001) | AI-oriented = the target title names AI / ML / LLM / generative / agentic work, or the ad has 3 different AI terms at least 5 times (the stored category does not tell). The first AntCV mention in a bullet or text row links to https://github.com/gabrielk83/AntCV in the CV (every layout) and the letter; on an AI job the CV keeps the AntCV bullet when it caps a role at 3. Never on other jobs. Kill switch `antcv:disable-ai-repo-link=1`. |
| Open end date (DATE-PRESENT-SAME-YEAR-001) | A role that started this year keeps "present" ("Nov 2026 - present"); older open roles still end on the current year (DATE-NO-PRESENT-001, 2026-07-09). docx-worker. |
| Trackman (kernel v13r) | Bullets and public wording = the owner's LinkedIn entry (organise the review baseline; group standards and supplier tests; reusable checklists and trackers; route questions to owners; evaluate AI-assisted workflows with a dummy-data check), employer line "Radar and camera-based tracking for golf and other sports", note "These tools support decisions. Technical, commercial and project decisions stay with the responsible owners.", on-site. The earlier internal bullets and the dated outcome (clause counts, pilot plan) moved to internal fields that are never printed. Title (owner 2026-11-08): "Project Management Intern, Hardware Development & Supply", the LinkedIn title, in the kernel (experience, workHistory, the trackman block; old title in `titlePrevious`), in gold-rules `roles.canon_titles.trackman` (da "Praktikant i projektledelse, hardwareudvikling og forsyning") and in every export: TRACKMAN-TITLE-001 swaps the exact old phrases in stored role lines and prose. D1 user_kernel and the local kernel file v13r, 2026-11-08. |
