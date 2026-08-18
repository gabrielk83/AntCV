# CLUSTER-QUAL-001 — Job Clustering, Per-Cluster Top-20 Qualifications, and Fit Scoring

**Status:** Proposed
**Owner:** Gabriel
**Date:** 2026-06-16
**Scope:** `cv-proxy` (+ `demo-proxy` mirror), `ant_memory` D1, PWA fit-surfacing, generation prompts
**Related:** three-axis kernel model (`user_kernel` / `application` / `language_view`), QA core parity rule

---

## 0. Correction to assumptions

There is **no `antcvanalysis` D1 database**. The analytics and kernel tables live in **`ant_memory`**
(uuid `499c3de9-8371-428a-9b9f-5d695d58e32b`, EU jurisdiction). All work in this spec targets `ant_memory`.

The `application` table **already clusters** every uploaded JD via its `category` column (one of the 12
category ids) and already stores the per-JD LLM analysis in `rationale` (JSON). What is **missing** is:

1. A durable, per-user **cluster → top-20 qualifications** structure that accumulates as more JDs arrive.
2. A way to **extract qualification signals from each JD at upload time** and feed them into that structure.
3. A **fit score** per application computed against the cluster top-20.
4. Surfacing of the high-weight (cross-cluster shared) qualifications into CV/CL generation so relevant
   signals get more visibility.

This spec adds those four things without changing the existing three-axis model.

---

## 1. Clusters vs categories

The 12 `category` ids are fine-grained. For top-20 accumulation we group them into **clusters** — coarse
families that share a qualification profile. The June 2026 16-role sample produced three natural clusters:

| Cluster id | Label | Example categories folded in |
|---|---|---|
| `pm_process` | PM / Product / Process Management | project-management, product-management, process/BA, compliance-ops |
| `photonics_eng` | Photonics / Optical / Test Engineering | optics/photonics, test/characterization, hardware-eng, IP/licensing |
| `research_phd` | PhD / Research positions | research, academic/phd, data-science-research |

**Mapping rule:** maintain a static `CATEGORY_TO_CLUSTER` map in the proxy (one of the 12 → one of N
cluster ids). Clusters are not hard-coded to three; the table is data-driven so new clusters can be added.
A JD's cluster is derived from its already-assigned `category` — no second LLM classification call.

**Do not** collapse genuinely distinct roles when they share a company (e.g. the two NKT roles: #13 quantum
laser MSc-level vs #16 fiber-design PhD-level are different rows and may land in the same cluster but must
never be deduped against each other; `jd_hash` already guarantees this).

---

## 2. Data model — new tables in `ant_memory`

### 2.1 `application_qualification` — per-JD extracted signals

One row per (application, qualification) pair. Populated at upload time from `rationale`.

```sql
CREATE TABLE IF NOT EXISTS application_qualification (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id  INTEGER NOT NULL,
  user_hash       TEXT    NOT NULL,
  cluster_id      TEXT    NOT NULL,         -- derived from application.category
  qual_text       TEXT    NOT NULL,         -- normalized qualification phrase
  qual_canonical  TEXT    NOT NULL,         -- lowercased, stop-stripped key for grouping
  weight          REAL    NOT NULL DEFAULT 1.0,  -- 1.0 required / 0.5 preferred / 0.25 nice-to-have
  source          TEXT    NOT NULL DEFAULT 'jd', -- 'jd' | 'seed' | 'manual'
  created_at      INTEGER NOT NULL,
  FOREIGN KEY (application_id) REFERENCES application(id) ON DELETE CASCADE,
  FOREIGN KEY (user_hash)      REFERENCES user_kernel(user_hash) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_appqual_user_cluster
  ON application_qualification (user_hash, cluster_id, qual_canonical);
```

### 2.2 `cluster_top_qualifications` — accumulated per-user, per-cluster top-20

Materialized rollup. Recomputed whenever a new distinguishable JD lands in that user+cluster.

```sql
CREATE TABLE IF NOT EXISTS cluster_top_qualifications (
  user_hash       TEXT    NOT NULL,
  cluster_id      TEXT    NOT NULL,
  rank            INTEGER NOT NULL,          -- 1..20
  qual_canonical  TEXT    NOT NULL,
  qual_display    TEXT    NOT NULL,          -- human-readable phrase
  frequency       INTEGER NOT NULL,          -- # JDs in cluster citing it
  weight_sum      REAL    NOT NULL,          -- sum of weight across citing JDs
  shared_clusters TEXT,                       -- JSON array of other cluster_ids sharing this qual
  jd_count        INTEGER NOT NULL,          -- total JDs in cluster at compute time
  updated_at      INTEGER NOT NULL,
  PRIMARY KEY (user_hash, cluster_id, rank),
  FOREIGN KEY (user_hash) REFERENCES user_kernel(user_hash) ON DELETE CASCADE
);
```

### 2.3 `application_fit` — per-application fit score vs cluster top-20

```sql
CREATE TABLE IF NOT EXISTS application_fit (
  application_id  INTEGER PRIMARY KEY,
  user_hash       TEXT    NOT NULL,
  cluster_id      TEXT    NOT NULL,
  fit_score       REAL    NOT NULL,          -- 0..100
  matched         TEXT    NOT NULL,          -- JSON: qualifications user demonstrably has
  gaps            TEXT    NOT NULL,          -- JSON: cluster top-20 quals not evidenced in kernel
  tier            TEXT,                       -- 'T1'..'T4' bucket from score thresholds
  computed_at     INTEGER NOT NULL,
  FOREIGN KEY (application_id) REFERENCES application(id) ON DELETE CASCADE,
  FOREIGN KEY (user_hash)      REFERENCES user_kernel(user_hash) ON DELETE CASCADE
);
```

---

## 3. Pipeline changes (cv-proxy, mirror to demo-proxy)

### 3.1 At JD upload (extend existing analysis step)

The proxy already calls the LLM to produce `rationale`. Extend that prompt to **also** return a
`qualifications` array — each item `{text, weight}` where weight is in {1.0, 0.5, 0.25} for
required / preferred / nice-to-have. No extra round-trip.

On receipt:
1. Derive `cluster_id = CATEGORY_TO_CLUSTER[application.category]`.
2. Normalize each qualification to `qual_canonical` (lowercase, strip stopwords/punctuation, light
   lemmatize). Insert into `application_qualification`.
3. If this JD is **distinguishable** (its `jd_hash` is new for this user+cluster), trigger a top-20
   recompute for that user+cluster (3.2).

### 3.2 Top-20 recompute (per user+cluster)

```
SELECT qual_canonical,
       COUNT(DISTINCT application_id) AS frequency,
       SUM(weight)                    AS weight_sum,
       MAX(qual_text)                 AS qual_display
FROM application_qualification
WHERE user_hash = ? AND cluster_id = ?
GROUP BY qual_canonical
ORDER BY weight_sum DESC, frequency DESC
LIMIT 20;
```

- Rank 1..20, write to `cluster_top_qualifications` (delete+insert for that user+cluster).
- Compute `shared_clusters`: for each `qual_canonical`, list other clusters where it also appears in the
  top-20. These shared quals are the **high-visibility** signals.
- Store `jd_count` = number of JDs in the cluster so the UI can show confidence ("based on N jobs").

### 3.3 Fit scoring (per application)

For the application's cluster top-20, mark each qualification matched if the user kernel evidences it
(string/skill match against `history.tools`, `history.workHistory[].bullets`, `certifications`,
`education`, `regulatory`). Then:

```
fit_score = 100 * sum(weight_sum_i for matched i) / sum(weight_sum_i for all top-20 i)
```

Tier thresholds (tunable): T1 >= 75, T2 >= 55, T3 >= 35, else T4. Persist to `application_fit` with
`matched` and `gaps` JSON. Gaps drive both the fit panel and the JD-Gap-Closure flow.

### 3.4 Generation visibility

When generating CV/CL for an application, pass the cluster top-20 (with `shared_clusters` flags) into the
generation prompt as a **priority signal list**. The generator must:
- Ensure every **matched** top-20 qualification appears with concrete evidence (outcome + number where the
  locked numeric outcomes allow).
- Foreground **shared** (cross-cluster) qualifications — these are the transferable signals that pay off
  across multiple target roles.
- Never fabricate to close a gap; gaps are surfaced to the user, not invented. Honour all banned-word /
  banned-phrase / verb rules (e.g. `led -> directed/supervised/ran`).
- Maintain Preview / DOCX / PDF parity for any new signal surfacing.

---

## 4. Cold-start: seeding from the June 2026 sample

Until a user has enough JDs per cluster, top-20s are sparse. Seed the three clusters with the analyst-
reviewed top-20s from the 16-role sample as `source='seed'` rows in `application_qualification` (with a
sentinel `application_id` of a synthetic seed application, or a nullable seed mechanism). Seed rows carry
lower weight so real JD signals overtake them as data accumulates, and are excluded from
`jd_count`. **0.4 is the CEILING (`RESEARCH_WEIGHT`), not a flat per-row value** — the shipped writer
rank-scales it, `RESEARCH_WEIGHT * (21 - rank) / 20`; see 7.6. Writing a flat 0.4 across a top-20 ties
every row under `recomputeClusterTop20`'s `ORDER BY weight_sum DESC` and destroys the researched order. The three seed lists (A/B/C) and their shared-qualification colour map are in
`docs/analysis/cluster_top20_seed_2026-06.json` (see 6).

---

## 5. Gabriel kernel updates (separate, immediate)

Independent of the pipeline work, two kernel edits for user `GVdLYawOzO5SmG8ehBfy0Z6m43pb_5QC`:

1. **Tools** — add LaTeX and Jupyter. The `Engineering` tools row becomes:
   `Python, MATLAB, LabVIEW, Docker, LaTeX, Jupyter`.
2. **MISWG compatibility** — add to `history.additional[]` an eligibility signal:
   `{ "l": "Security-clearance eligibility", "v": "Resident in MISWG / NATO / EU countries (incl. Israel, a MISWG participant); eligible for Danish DDIS clearance review" }`.
   Rationale: two Terma roles gate on DDIS clearance with a 7-year NATO/EU/MISWG residency rule; Israel's
   MISWG participation keeps that path open. Surfaced as an eligibility signal, not a CV bullet, so the
   generator can cite it only when a JD requires clearance.

Both are applied via the migration in 6.

---

## 6. Rollout

1. Apply DDL (2) to `ant_memory`. Idempotent `CREATE TABLE IF NOT EXISTS`. (DONE 2026-06-16)
2. Load `CATEGORY_TO_CLUSTER` map into cv-proxy; mirror byte-identical to demo-proxy.
3. Extend the JD-analysis prompt to emit `qualifications[]`; wire 3.1-3.3.
4. Seed the three clusters (4) for Gabriel from the reviewed sample. (DONE 2026-06-16, 60 rows)
5. Apply Gabriel kernel edits (5). (DONE 2026-06-16)
6. PWA: add a fit panel (score + matched/gaps) on each application; show "based on N jobs" confidence.
7. Both proxies get separate CI deploys. Verify Preview/DOCX/PDF parity on a regenerated document.

## 7.5 Client demand model — SHIPPED 1.50.710 (read half)

Ahead of the proxy pipeline (3.1–3.4), the **read half** ships client-side so the
canonical-ordering layer can already weight by demand:

- `pwa/antcv-cluster-demand.js` embeds the analyst-reviewed seed top-20 for the **3
  seeded clusters** (pm_process / photonics_eng / research_phd — ~3 of the 12
  categories). It classifies the active JD to one cluster (keyword overlap vs each
  top-20; margin-gated) or, when there is no JD, treats the CV as **unsolicited =
  union of all 3** so cross-cluster (shared/ABC) skills are pumped.
- `score()` / `scoreNorm()`: `scoreNorm` divides the raw cross-cluster sum by
  (active-cluster count × per-cluster ref) so a single-JD and an unsolicited CV land
  on the same `[0,1]` scale — skill-relevance counts under a JD too.
- **Ordering is blended, not numeric-first** (owner: "numeric + skill-relevant =
  higher score"): `score = numNorm + demNorm`. Wired into bullet order
  (`antcv-sections-normalize-415.js _bulletScore`) and outcome/result order
  (`antcv-docx-client.js _rankScore`, all three `applyOutcomesMode` sort sites).
  Guarded: `demNorm = 0` when the model is absent → degrades to pure numeric.

## 7.6 Nightly refresh — PLANNED (owner 2026-06-19)

> **SEARCH LEG = BRAVE, not CSE (2026-07-10).** Google CSE is dead on this account (see
> `docs/deployment/google-cse-setup.md` top note). The demand-seeding job's web-research
> leg must use the relay `POST /api/research` (Brave, `env.BRAVE_API_KEY`; BYOK via
> `x-brave-key`). Copy the distil pattern from `src/islands/JobTracker` `webCompanyBrief()`
> (research() → askAI). The `POST /api/cluster-demand-research` writer is unchanged.

A nightly job (antcv-nightly dispatch surface) should keep the demand model current
from **live recruitment-site research**, two tracks:

1. **Sharpen the remaining 9 categories.** Only 3 of the 12 `category` ids have seed
   top-20s. For each of the other 9, web-research current postings (job boards /
   recruiters in the user's regions), extract the recurring required/preferred
   qualifications, and produce a ranked top-20 (+ long tail) in the same shape as the
   seed clusters.
2. **Tighten the 3 seeded clusters.** Re-derive their top-20s from fresh postings so
   ranks track the current market, not just the June-2026 16-JD sample.

**Targeting parameters (owner 2026-06-19, SHIPPED capture 1.50.711).** The research —
and the top-20 buckets it produces — are keyed by the user's **job-search targeting**:
WHERE (region/country), WHICH model (employed vs independent consultant), WHICH format
(onsite/hybrid/remote). Captured in the wizard + Personal/kernel settings via the
`JobSearchTargeting` island, persisted under `personalInfo.jobSearchPrefs`, exposed
client-side by `window.AntcvClusterDemand.prefs()` / `.contextKey(clusterId)` (the
bucket name the nightly writes). The nightly should query postings filtered by these
params and store keyed top-20s (`cluster × region × model × format`); the client then
prefers the matching keyed bucket over the un-keyed seed for a more targeted ranking.
Consultant vs employed especially shifts the qualification mix (delivery/commercial/
independence vs role-fit/team), so it is a first-class key, not a display-only field.

Output merges into `application_qualification` (`source='research'`, dated) and the
`cluster_top_qualifications` rollup so real user-JD signals still overtake it over
time; the client `SEED` map becomes a cold-start fallback. Must respect robots/ToS of
any site queried and never fabricate a qualification not actually seen in postings.

**WRITER BUILT 2026-07-13** (closes this leg — register row 9). The production
`source='research'` writer now exists: `POST /api/cluster-demand-research`
(access-relay, token `CLUSTER_RESEARCH_TOKEN`) + `insertResearchQualifications`
+ `scripts/cluster-demand-research-push.mjs`. Research rows go in under
`__global_market__` with `application_id` NULL and a **rank-scaled** weight
`RESEARCH_WEIGHT * (21 - rank) / 20` — deterministic order, and every value ≤
`RESEARCH_WEIGHT` (0.4) < a real required-JD qual (1.0), so live user-JD signal
overtakes research exactly as this section requires. The weekly routine's write
step is now `node scripts/cluster-demand-research-push.mjs` (was a manual D1
write). Tests: `cluster-demand-research-writer.test.mjs` (12) +
`cluster-demand-research-push.test.mjs` (6). Setup/deploy gate:
`docs/deployment/google-cse-setup.md` §8 (owner sets `CLUSTER_RESEARCH_TOKEN` +
deploys access-relay; not live until that deploy).

## 8. Acceptance

- Uploading a JD writes `application_qualification` rows and updates `cluster_top_qualifications`.
- A second distinguishable JD in the same cluster changes the top-20 ranking.
- Each application shows a fit score and a gap list.
- Generated CV/CL visibly foreground matched + shared qualifications, with parity across all three outputs.
- Gabriel's tools include LaTeX + Jupyter; MISWG eligibility is present and only surfaces when a JD needs it.
