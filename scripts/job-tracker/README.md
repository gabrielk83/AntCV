# Job Tracker sync (JOB-TRACKER-001)

Two-way sync between a local job-search **Excel workbook** and the AntCV
**Cloudflare D1** database, via the access-relay endpoint `/api/job-tracker`.

**D1 is the source of truth.** The Excel workbook is rendered *from* a canonical
`job_tracker_doc.json`; editing the workbook is pushed back into D1.

```
Excel  <--(build: doc->xlsx)--  job_tracker_doc.json  <--(sync: PUT/GET)-->  D1 (ant_memory.job_tracker)
  |                                      ^
  +--(import-xlsx: xlsx->doc)------------+
```

## Endpoint (access-relay)

`GET/PUT/DELETE https://antcv-access-relay.karp-gabriel-a.workers.dev/api/job-tracker`

- Auth: same JWT the PWA uses (Bearer). Per-user, keyed by `SHA-256(email)`.
- Body of PUT: `{ "doc": {...}, "base_rev": <int|null> }`.
- Optimistic concurrency: a stale `base_rev` returns **409** with the current
  `{ doc, rev }` so the client 3-way merges and retries — never a silent clobber.
- Storage: one JSON `doc` per user in the `job_tracker` table (self-heals /
  `CREATE TABLE IF NOT EXISTS`; also in `schema.sql`).

The `doc` schema: `{ version, envelope:[...], rows:[[rank,company,role,location,commute,group,fit,posting,tracked,next,flag,urlkey,band]...], urls:{urlkey:url}, ... }`.

## Local setup

This tool is generic; your personal doc + the Excel build script are **not**
committed (repo rule: no candidate data). They live in your Drive folder.

```sh
# 1. token — from the PWA session (DevTools > Application > Local Storage), once:
mkdir -p ~/.antcv && printf '%s' '<YOUR_JWT>' > ~/.antcv/token

# 2. point the tool at your local files:
export JOB_DOC="G:/My Drive/Job Hunt (2026)/Shared material/Job Seek 2026 Nischa/job_tracker_doc.json"
export JOB_BUILD="G:/My Drive/Job Hunt (2026)/Shared material/Job Seek 2026 Nischa/build_workbook.py"
export JOB_XLSX="G:/My Drive/Job Hunt (2026)/Shared material/Job Seek 2026 Nischa/Gabriel_Job_Search_Workbook_2026.xlsx"
```

## Commands

```sh
python job-tracker-sync.py status           # local rev vs cloud rev; has either side changed?
python job-tracker-sync.py push             # local doc -> D1 (merges on 409)
python job-tracker-sync.py pull --render     # D1 -> local doc, then rebuild the .xlsx
python job-tracker-sync.py import-xlsx       # edited .xlsx -> local doc, then push
python gen-runner.py health                 # every artifacts[uk].application_id resolves? exit 1 = dead pointer, 2 = list failed (JT-HEALTH-CMD-001)
```

Typical loops:
- **Edited in Excel** → `import-xlsx` (parses the Weekly Tracker sheet back, preserving url-keys + band colours, then pushes).
- **Edited in the AntCV web UI** (Phase 3) or on another device → `pull --render`.
- First time: `push` seeds the cloud from your current workbook.

## Phase status

- **Phase 1 (this)** — schema, endpoint, sync CLI, doc-driven Excel. ✅ built + tested.
- **Phase 2** — CV/CL/Analysis generation seeded from a row's signals + the envelope guidelines; artifact URLs written back onto the row.
- **Phase 3** — AntCV web UI: review/edit the table, download PDF, generate buttons, artifact hyperlinks.

## Course CV checklist (COURSE-CV-CHECKLIST-001)

`course_checklist.py` runs the Improve Business Academy CV checklist (course compendium p 22) over a
finished CV: the PDF, DOCX or text a recruiter sees. Each item is OK, WARN, FAIL, or MANUAL when only a
person can judge it. Exit 1 on any FAIL.

```
python course_checklist.py --cv CV.pdf --jd jd.txt --company "NKT Photonics" --title "Technical Project Manager"
python test_course_checklist.py   # pure units, negative-controlled
```

**Runs by default (COURSE-CHECKLIST-DEFAULT-001).** Every CV the pipeline produces gets The Checklist,
filled under the 8 p 22 headings (1. Overall ... 8. Final Check), one line per item with its status and note:

| Path | Checks | Writes |
|---|---|---|
| `gen-runner.py run` | the final persisted CV (`--persist`), else the generated `cv_*` sections | `checklist_<uk>.md` + `.json` beside `gen_<uk>.json`; summary in `index.json` and the run log |
| `export_pdfs.py` / `export_docx.py` | the exported CV PDF (the DOCX when `--no-pdf`) | `<name>.checklist.md` + `.json` beside it; summary in the report JSON and the printed line |

Opt out with `--no-checklist`. A checklist error is logged as `[checklist] skipped (...)` and never stops
generation. `--out DIR` on `course_checklist.py` writes the same report for any CV by hand.

```
python test_checklist_default.py  # default-on, opt-out, crash isolation (no network)
```

## Text guards (TEXT-GUARDS-001, 2026-11-05)

Tier-0 checks: deterministic, no model, no network, English / Danish / Swedish. They are ported from
ai-job-search PRs #783 and #807 (MIT) and extended for Danish and Swedish. Word lists and thresholds
live in `guard_rules.json`.

| Tool | Flags | Exit 1 on |
|---|---|---|
| `fact_guard.py --draft X --kernel k.json [--jd jd.txt]` | figures, credentials, names in the draft that the kernel does not support (see below) | any FAIL |
| `echo_check.py --draft X --jd jd.txt [--letters DIR]` | LIFT: 5+ shared words; NEAR-LIFT: a reworded job-ad sentence; REUSE: a sentence from an earlier letter | LIFT, REUSE |
| `ats_text.py CV.pdf [--email] [--phone]` | what an ATS parses: glyph junk, contact as literal text, the two columns interleaving | any FAIL |

What `fact_guard.py` accepts as support for a figure:
- A kernel figure in any number format: 1.200 / 1,200 / 1 200, 2,2 mio. / 2.2M, number words.
- A year range such as 2017-20.
- Years of experience within the career span.
- A hedged figure rounded DOWN from a kernel figure ("over 40" from 45). Rounding up is never accepted.

The job ad never supports a figure or a credential. A name found only in the job ad is a WARN: it is fine
for the employer's own names and a fabrication when claimed as the candidate's skill.

`gen-runner.py run` runs `fact_guard.py` and `echo_check.py` over every generated `cv_*` / `cl_*` section
and writes `guards_<uk>.json`. Opt out with `--no-guards`. `export_pdfs.py` runs `ats_text.py` on every
exported CV and prints `ATS ...` on a FAIL. The checks advise; they never block. Research on stronger
tiers (a local NLI model, Workers AI) is in `docs/analysis/TEXT_GUARDS_RESEARCH_2026-11-05.md`.

```
python test_text_guards.py   # synthetic kernel, PDFs built with PyMuPDF
```

## Follow-ups (FOLLOWUP-001, 2026-11-05)

`followups.py` keeps the dates in the tracker doc's `followups[uk]` map; the agent writes the draft.

```
python followups.py stamp                # nightly: date the first sweep that sees a row as Submitted
python followups.py due [--json]         # Submitted rows quiet 10+ days with fewer than 2 follow-ups
python followups.py log --uk UK          # after the owner SENT it (--kind thanks for a thank-you note)
python followups.py set-submitted --uk UK --date 2026-10-20   # the real date, replaces "first-seen"
```

Drafting rules:
- Length and language: 60-120 words, in the application's language.
- Address: the hiring manager when `notes[uk].hm` is set, else the team.
- Content: one sentence restating interest in this role, and one concrete value reminder taken from the
  submitted CV or cover letter. No new claims: every claim must already be in the submitted materials.
- Close: one polite question about the timeline. No "just checking in".
- At most two follow-ups per application. The tool refuses a third.
- Drafts only: the owner sends it, then runs `log`.

After an interview stage, offer a short thank-you note and log it with `--kind thanks`.

```
python test_followups.py
```

## Company financials (COMPANY-FINANCIALS-001, 2026-11-05)

`company_financials.py` reads the employer's newest Danish annual report from Virk's open filings index
(`distribution.virk.dk/offentliggoerelser`, no key). These are the figures Proff shows. Proff itself is not
read: its robots.txt bars AI agents (anthropic-ai, ClaudeBot) from the whole site.

The summary line covers revenue or gross profit, operating result, net result, equity, total assets and
average employees, with the change from the prior year. `gen-runner.py` adds it to the employer research
in the prompt and caches it 90 days in `doc.financials[uk]`.

Where the CVR number comes from, in order:
1. The cache.
2. A Jobnet ad's `cvr`. Discovery passes it as `"cvr"`, and it is stored on the row.
3. The CVR register, when `ANTCV_CVR_USER` / `ANTCV_CVR_PASS` are set (free system-to-system access from
   Erhvervsstyrelsen, cvrselvbetjening@erst.dk).
4. cvrapi.dk, which has a small daily quota.
5. A "CVR" label in research snippets.

The filed company name is compared with the employer's name, and a mismatch stays in the line as `CHECK:`.

```
python company_financials.py show --name "Novo Nordisk" --cvr 24256790
python company_financials.py enrich [--uk UK] [--dry]   # fill live rows
python test_company_financials.py
```

Swedish employers (Bolagsverket) are not covered yet.

**FIN-ANGLES-001: what the figures change.** `company_financials.angles()` reads signals from the
figures:
- loss (and a second loss year), back to profit;
- growth of 15% or more, decline of 5% or more;
- operating margin under 3%;
- negative equity, or an equity ratio under 20%;
- headcount up or down 10% or more.

Each signal turns into four things, stored in `financials[uk].angles`:
- a question for the recruiter or hiring manager (`questions`);
- a cover-letter angle (`cl_angles`): which of the candidate's proof to lead with. A loss means
  cost / yield / time proof, growth means scaling proof. Negative equity gives no angle, because it is
  a risk for the candidate to weigh;
- a question the interviewer may ask, and what to rehearse (`interview`).

Where the angles are used:
- `gen-runner.py` puts the figures and the angle in an EMPLOYER FINANCIALS prompt block. The letter
  proves the angle with kernel facts only and never quotes or alludes to a loss or a weak figure.
- `analysis_report.py` puts 1-2 of the questions into `questions_to_employer`.
- The interview-prep pack and the mock interview read `angles.interview`.
