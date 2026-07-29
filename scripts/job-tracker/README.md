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
```

Typical loops:
- **Edited in Excel** → `import-xlsx` (parses the Weekly Tracker sheet back, preserving url-keys + band colours, then pushes).
- **Edited in the AntCV web UI** (Phase 3) or on another device → `pull --render`.
- First time: `push` seeds the cloud from your current workbook.

## Phase status

- **Phase 1 (this)** — schema, endpoint, sync CLI, doc-driven Excel. ✅ built + tested.
- **Phase 2** — CV/CL/Analysis generation seeded from a row's signals + the envelope guidelines; artifact URLs written back onto the row.
- **Phase 3** — AntCV web UI: review/edit the table, download PDF, generate buttons, artifact hyperlinks.
