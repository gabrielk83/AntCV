# JOB-TRACKER-001 · Phase 3 — Web UI design

Status: design (approved to build after review). Phases 1–2 done: D1 endpoint
`/api/job-tracker` (live), doc-driven Excel + sync CLI, doc schema v2 with
per-row `support` + `artifacts`. This doc specifies the AntCV in-app UI.

## Goal

Let the owner review and drive the job-search workbook from inside AntCV:
review/edit the full weekly list, add new JDs, focus on each Top-5 role,
generate CV/CL/Analysis per role, and drop a Top-5 company with a reason that
feeds back into the Dream Envelope. D1 stays the source of truth; the Excel
workbook and this UI are both clients of the same `/api/job-tracker` doc.

## Vehicle — React island (NOT an app.js rewrite)

Build as a new island `src/islands/JobTracker/` (TSX), Vite-built into
`pwa/antcv-react-islands.js` — the same safe, real-build path as the existing
`JobSearchTargeting` / `SettingsRouter` islands. This avoids the minified-
`app.js` blue-screen risk (APPJS-BLUESCREEN-001).

The only `app.js` / `index.html` touch is minimal and surgical:
- an entry point (a "Job Tracker" button in the upload menu / main nav), and
- a mount node the island loader hydrates (follow the existing island
  registration pattern — a `data-island="job-tracker"` node or the loader's
  registry, whichever the current islands use).

Cache-bust + deploy + browser-verify protocol applies to that touch (see below).

## Data contract

`GET/PUT /api/job-tracker` (access-relay, per-user, live). Doc schema v2:

```
{ version:2,
  envelope:[[dimension,target,range,notes]...],           // Dream Envelope
  rows:[[rank,company,role,location,commute,group,fit,
         posting,tracked,next,flag,urlkey,band]...],       // weekly tracker
  urls:{urlkey:url},
  support:{urlkey:"ROLE/FIT/FLAG + top-5 needs·bring·insight"},  // → Additional Signals
  artifacts:{urlkey:{cv_url,cl_url,analysis_url,generated_at}} }
```

Writes use optimistic concurrency: PUT `{doc, base_rev}`; on 409 the island
re-fetches, row-merges, and retries (same contract the CLI uses). The island
holds `rev` in state and passes it as `base_rev`.

## Views

### V1 — Full weekly list (review + edit)
- Table of `rows`, tier-banded, sortable/filterable (by tier, tracked status).
- Inline-edit: `tracked` (dropdown, same vocabulary as the xlsx), `next`,
  `flag`/notes, `rank`. Company link opens `urls[urlkey]`.
- Debounced save → PUT with `base_rev`; toast on success/conflict-merge.

### V2 — Add a new link / JD
- Input: paste a URL (or raw JD text).
- URL → `POST /api/fetch-jd-url` (proxy pipeline; same one that unlocked the
  LinkedIn set) → returns `{text,title}` → prefill company/role (editable).
- New row appended (default tier T2, tracked "Not started"); `support[urlkey]`
  seeded from the fetched JD + fit note; `urls[urlkey]=url`. PUT.
- Raw-text paste path skips the fetch.

### V3 — Top-5 focus view (per role)
- Selectable role → panel showing: status line, `support` broken into
  **Company needs / What I bring / Signals & insights**, and the posting link.
- Actions:
  - **Generate CV / CL / Analysis** → auto-seed an AntCV application from the
    row's stored JD (`jd_text`) with `supporting_context` = `support[urlkey]` +
    the relevant `envelope` guidelines, then run the existing generation flow
    (client assembles the prompt; Additional Signals is the injection channel —
    no worker change). Store results in `artifacts[urlkey]`.
  - **Open artifacts** → hyperlinks to the generated CV/CL/Analysis.
- "Top 5" membership = the 5 rows flagged as top-5 (add a `top5` marker to those
  rows, or derive from rank ≤ N with an explicit pin set — decide at build).

### V4 — Drop a company from the Top 5 → why → update Dream Envelope
1. "Drop from Top 5" on a focus card opens a required prompt:
   **"Why are you dropping {company}?"** (free text).
2. Record on the row: `tracked → "Archive / closed"`, `drop_reason`, `drop_date`;
   remove its top-5 marker.
3. **Classify + update the envelope** (approved behavior):
   - Send the reason + the envelope dimension list to the LLM (a small classify
     call via the proxy, jd-analysis-style) → returns `{dimension, learning}`
     where `dimension ∈ {Salary, Title, Work tasks, Commuting, Work hours,
     Location/atmosphere, Values}`.
   - Append a dated learning to that dimension's `notes` in `envelope`
     (e.g. Commuting += "2026-07-08 dropped KK Group: 3-day on-site in Jutland
     too far without offset"). Never overwrite the target/range; append only.
   - Show the proposed envelope edit inline as it's applied (visible, not silent).
4. PUT the doc (row + envelope) in one write.

The Excel `pull --render` then reflects the archived row + the envelope learning
on next sync.

## Generation seeding detail (V3)

- Auto-seed maps onto the existing flow: `POST /api/applications` with
  `jd_text` = `support`-linked stored JD, `supporting_context` = `support[urlkey]`
  + envelope guidelines (app.src.js:15480 path). The client already folds
  Additional Signals into the generation prompt, so company intel + envelope
  reach the LLM with no prompt-augment change.
- Artifact write-back: after generation, PUT the doc with
  `artifacts[urlkey] = {cv_url, cl_url, analysis_url, generated_at}`.

## app.js / index.html touch (surgical) + release protocol

1. Add the entry button + mount node; register the island (mirror `app.src.js`).
2. Cache-bust: bump `app.js?v=` and the island/script `?v` in `index.html`,
   `sw.js` CACHE, `antcv-version-override.js` TARGET_VERSION (+ extend
   STALE_VERSIONS with the previous), and the `ANTCV_VERSION` seed.
3. Build the island (Vite). Deploy PWA (auto on push to main).
4. Verify in a real browser: island mounts, list loads, add-JD fetches, a
   generate round-trips, a drop updates the envelope. No console errors.

## Build order within Phase 3

1. Island scaffold + mount + V1 (list review/edit) against the live endpoint.
2. V2 (add JD).
3. V3 (top-5 focus + generate + artifacts).
4. V4 (drop → classify → envelope).

## Open decisions (resolve at build)

- Top-5 membership: add a `top5:bool`/`pin` to rows vs derive from rank. Prefer
  an explicit `top5` marker so pinning is independent of rank churn.
- Entry point location: upload menu vs main nav vs both.
- Classify model: reuse the analysis model (proxy router) at low cost tier.
- Mobile layout: the island must degrade to a single-column card list (MOB rules).
