# CLUSTER-QUAL-001-IMPL — Implementation Brief for Proxy Code Session

**For:** a code session with write access to `cv-proxy`, `demo-proxy`, and `ant_memory` D1.
**Reads with:** `docs/plan/CLUSTER-QUAL-001.md` (design) and `docs/analysis/cluster_top20_seed_2026-06.json` (seed).
**Status of prerequisites:** D1 tables and Gabriel seed/kernel edits are ALREADY APPLIED (see section 0). Your job is the proxy code, the corrected schema for the long tail and versioned clusters, the recompute/fit logic, and the PWA panel.

> **Single source of truth (non-negotiable).** `ant_memory` D1 is authoritative for all user-kernel, qualification, cluster, and fit data. No file in the repo is a writable copy of that state. Any Markdown/JSON "snapshot" of a kernel is a **generated, read-only artifact** produced by a script that reads D1 — never hand-edited, never written back to D1. See section 7 for the snapshot generator and the rule the code session must honour.

---

## 0. What is already done (do NOT redo)

In `ant_memory` (uuid `499c3de9-8371-428a-9b9f-5d695d58e32b`, EU):
- Tables created: `application_qualification`, `cluster_top_qualifications`, `application_fit`.
- 60 seed rows in `cluster_top_qualifications` for user `GVdLYawOzO5SmG8ehBfy0Z6m43pb_5QC` (3 clusters x 20).
- Kernel edits applied: tools row `Engineering` = `Python, MATLAB, LabVIEW, Docker, LaTeX, Jupyter`; `history.additional[]` has a `Security-clearance eligibility` (MISWG/NATO/EU incl. Israel, DDIS-eligible) entry; `certifications[4]` annotated BABOK/BPMN; Meprolight bullet annotated NIR/SWIR/thermal multi-band image fusion.

Verify these exist before starting; if any are missing, the design doc section 2 and section 5 have the DDL/edits.

---

## 1. Corrections to the original design (apply these)

### 1.1 It is ONE table, not 12

`cluster_top_qualifications` is keyed by `(user_hash, cluster_id, rank)`. N clusters = N x rank rows, not N tables. Never create per-cluster tables. Adding or splitting clusters only adds `cluster_id` values.

### 1.2 The long tail is the source of truth; top-20 is a cache

`application_qualification` holds EVERY extracted qualification from EVERY JD, untruncated. Never prune it.
`cluster_top_qualifications` is a **disposable materialized projection** recomputed from the full tail. This is what makes the ranking correct as more JDs arrive: a qualification sitting at rank 25 today can overtake rank 18 after two more JDs cite it — only possible if the tail was kept.

Concretely:
- Do NOT `LIMIT 20` on insert into `application_qualification`. Store all.
- Cache **top-40** in `cluster_top_qualifications` (buffer above the displayed 20) so tie-breaks and minor re-sorts on read don't force a full recompute, and so the UI can show "and N more" without a round trip. `rank` 1..40.
- The displayed top-N is a parameter (`DISPLAY_TOP_N`, default 20), read from the cached 40.

### 1.3 Clusters must be versioned and re-derivable

Clustering will change over time. Add a `cluster_definition` table so the category->cluster map is data, not code, and so historical assignments can be re-derived after a remap.

```sql
CREATE TABLE IF NOT EXISTS cluster_definition (
  cluster_version INTEGER NOT NULL,          -- bump when the map changes
  category        TEXT    NOT NULL,          -- one of the 12 category ids
  cluster_id      TEXT    NOT NULL,          -- target cluster
  cluster_label   TEXT    NOT NULL,
  active          INTEGER NOT NULL DEFAULT 1, -- 1 = current map
  created_at      INTEGER NOT NULL,
  PRIMARY KEY (cluster_version, category)
);
```

- The proxy reads the `active` rows to build `CATEGORY_TO_CLUSTER` at runtime — no hard-coded map in code.
- `application_qualification.cluster_id` is denormalized (stored per row) but `application.category` is the durable truth, so a remap = insert a new `cluster_version`, flip `active`, then re-derive `cluster_id` on all `application_qualification` rows and recompute every affected `cluster_top_qualifications`. Provide a `remap` admin routine that does exactly this in a transaction.
- Seed the v1 map from the three-cluster grouping in the design doc section 1 (the 12 categories -> pm_process / photonics_eng / research_phd). Until all 12 category ids are confirmed in production data, map known ones and default unknown categories to a `general` cluster rather than dropping them.

### 1.4 Add cluster_version stamps

Add `cluster_version INTEGER` to both `application_qualification` and `cluster_top_qualifications` (nullable, backfill existing rows to 1). Lets you detect rows computed under an old map and lazily recompute.

---

## 2. Migration SQL to run (idempotent)

```sql
-- versioned cluster map
CREATE TABLE IF NOT EXISTS cluster_definition (
  cluster_version INTEGER NOT NULL,
  category        TEXT    NOT NULL,
  cluster_id      TEXT    NOT NULL,
  cluster_label   TEXT    NOT NULL,
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      INTEGER NOT NULL,
  PRIMARY KEY (cluster_version, category)
);

-- version stamps (SQLite: guarded add; ignore "duplicate column" error if re-run)
ALTER TABLE application_qualification     ADD COLUMN cluster_version INTEGER;
ALTER TABLE cluster_top_qualifications    ADD COLUMN cluster_version INTEGER;
UPDATE application_qualification  SET cluster_version = 1 WHERE cluster_version IS NULL;
UPDATE cluster_top_qualifications SET cluster_version = 1 WHERE cluster_version IS NULL;
```

Seed `cluster_definition` v1: insert one row per known category mapping to its cluster_id + label, `active=1`. (Map source: design doc section 1 table. Add a `('<unknown>','general','General')` fallback handled in code, not a literal row.)

> Note the cache depth change: `cluster_top_qualifications.rank` now ranges 1..40, not 1..20. Existing seed rows (rank 1..20) are valid; the recompute will extend them to 40 where enough tail exists.

---

## 3. Proxy pipeline (cv-proxy, mirror byte-identical to demo-proxy)

Per the AntCV parity rule: any change under `workers/proxy/src` must be checked against `workers/demo-proxy/src` and applied to both where a matching copy exists; both get separate CI deploys.

### 3.1 Build CATEGORY_TO_CLUSTER at runtime
On cold start (or cached per request), `SELECT category, cluster_id FROM cluster_definition WHERE active=1`. Unknown category -> `general`.

### 3.2 JD-analysis prompt extension
Extend the existing analysis call (the one producing `application.rationale`) so the model ALSO returns:
```json
"qualifications": [ { "text": "string", "weight": 1.0 } ]
```
`weight` in {1.0 required, 0.5 preferred, 0.25 nice-to-have}. No second round-trip. Keep output JSON-only, parse defensively, strip fences.

### 3.3 On upload (extraction)
1. `cluster_id = CATEGORY_TO_CLUSTER[application.category]`, `cluster_version` = active version.
2. For each qualification: compute `qual_canonical` (lowercase, strip punctuation/stopwords, light lemmatize — keep the function shared between proxy copies). Insert a row into `application_qualification` (NO truncation, `source='jd'`).
3. If `jd_hash` is new for this `(user_hash, cluster_id)` -> trigger recompute (section 3.4).

### 3.4 Recompute (per user+cluster), caches top-40
```sql
SELECT qual_canonical,
       COUNT(DISTINCT application_id) AS frequency,
       SUM(weight)                    AS weight_sum,
       MAX(qual_text)                 AS qual_display
FROM application_qualification
WHERE user_hash = ? AND cluster_id = ?
GROUP BY qual_canonical
ORDER BY weight_sum DESC, frequency DESC
LIMIT 40;
```
Delete+insert the `(user_hash, cluster_id)` block in `cluster_top_qualifications` (rank 1..<=40), stamp `cluster_version`, set `jd_count` = distinct JDs in cluster (exclude `source='seed'`), and compute `shared_clusters` (other clusters where this `qual_canonical` is in their top-20). Seed rows (weight 0.4) stay in the pool so cold-start users still get a list; they are naturally overtaken by real JD weights.

### 3.5 Fit scoring (per application) -> application_fit
Match each of the cluster's displayed top-20 against the user kernel (`history.tools`, `history.workHistory[].bullets`, `certifications`, `education`, `regulatory`, `additional`). Then:
```
fit_score = 100 * sum(weight_sum_i for matched) / sum(weight_sum_i for all top-20)
```
Tiers (tunable consts): T1 >= 75, T2 >= 55, T3 >= 35, else T4. Persist `matched`/`gaps` JSON. Gaps feed JD-Gap-Closure.

### 3.6 Generation visibility
Pass the displayed top-20 + `shared_clusters` flags into CV/CL generation as a priority signal list:
- Every MATCHED top-20 qual must appear with concrete evidence (outcome + locked number where allowed).
- FOREGROUND shared (cross-cluster) quals — highest transfer value.
- Never fabricate to close a gap. Honour banned words/phrases and the verb rule (`led -> directed/supervised/ran`).
- Preview / DOCX / PDF parity is mandatory for any new surfacing.

---

## 4. PWA
Add a fit panel per application: score, tier, matched list, gap list, and a "based on N jobs" confidence line from `jd_count`. Show shared-cluster quals with a distinct marker (they are the transferable ones). No browser storage APIs.

---

## 5. Acceptance / QA (every fix must hold in Preview, DOCX, and PDF, desktop + mobile)
1. Uploading a JD writes untruncated `application_qualification` rows and refreshes the cached top-40.
2. A second distinguishable JD in the same cluster changes the displayed top-20 ordering, and a previously-rank-25 qual can rise into the top-20 (proves the tail is retained).
3. Each application shows fit score + gaps.
4. Remapping clusters (new `cluster_version`, flip `active`, run `remap`) re-derives `cluster_id` on all tail rows and recomputes every affected top-40 without data loss.
5. Generated CV/CL foreground matched + shared quals, parity across all three outputs.
6. Both proxies deployed separately; `workers/proxy/src` and `workers/demo-proxy/src` byte-identical where copies match.
7. Gabriel: tools include LaTeX + Jupyter; MISWG eligibility present and surfaces only when a JD requires clearance.

## 6. Out of scope / guardrails

> Renumbered: this was previously section 6; the snapshot rule below is section 7. Numbers shifted, content unchanged.

- Do not write files >50KB inline via github tools; full-file restores use desktop git.
- Do not collapse distinct roles sharing a company (jd_hash already prevents dedup; keep it).
- Every `wrangler.toml` you touch keeps `[observability.logs] enabled=true, invocation_logs=true` just after `compatibility_date`.

## 7. Single source of truth & kernel snapshots

**Rule:** D1 (`ant_memory`) is the only authoritative store of kernel/qualification/cluster/fit data. The repo holds **specs, seeds, code, and generated artifacts** — never a second editable copy of live state.

**Kernel snapshots** (e.g. `docs/personas/<user>/kernel_snapshot_*.md`) are produced on demand by `scripts/gen_kernel_snapshot.mjs`, which:
- READS `user_kernel.history` from D1 and renders deterministic Markdown.
- NEVER writes to D1.
- Stamps the output with a "GENERATED ARTIFACT — DO NOT HAND-EDIT" header.

In a Worker/proxy context the script's HTTP `d1()` call is replaced by the D1 binding (`env.DB.prepare(sql).bind(...).all()`); SQL and field extraction are identical. The code session should:
1. Keep the generator as the only path that creates snapshot files; treat any hand-edited snapshot as a bug.
2. If a kernel field needs to change, change it in D1 (via the kernel-edit path / `memory_user_edits`-equivalent), then regenerate the snapshot — do not edit the file and reconcile later.
3. Optionally wire a CI step (or a `/admin/regen-snapshot` route) that regenerates the snapshot after any kernel write, so the artifact never drifts. This is the durable replacement for the hand-maintained mirror committed earlier (which has been removed).
4. Apply the same principle to the seed JSON: it is an input seed, not a mirror of `cluster_top_qualifications`; the live top-N rollup is always recomputed from `application_qualification` per section 3.4, never read back from the file.

**Acceptance for this section:** the repo contains no hand-maintained copy of live kernel state; the only kernel snapshot present was emitted by the generator and carries the do-not-edit header; running the generator twice with no D1 change yields a byte-identical file (modulo the date stamp).
