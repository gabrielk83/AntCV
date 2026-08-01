# Session log — 2026-07-29 (desktop, Opus 5): JD-list Open, and gap-closure Apply

Two owner-reported buttons that did nothing useful. Both turned out to be **the
same shape of defect**: a producer changed the data (or the document schema) and
a consumer was never updated, so the failure surfaced as silence or a raw
`TypeError` instead of an actionable message.

Shipped: PWA `1.51.3902-jt-open-fix` (owner-confirmed working) and PWA
`1.51.3942-gap-richblock`.

---

## 1. JD list → Open → approve the popup → nothing happens

**IDs:** JT-DOC-NONSTRING-001, JT-OPEN-NOJD-001 · **PWA 1.51.3902-jt-open-fix** ·
`src/islands/JobTracker/{api.ts,JobTracker.tsx}` + rebuilt
`pwa/antcv-react-islands.js`

### What the owner saw

> "I am in the JD list. I press Open, I get a popup with a question, approve to
> open and nothing happens."

Then, on the second report, a red banner:
`Could not open in AntCV: (e || "").trim is not a function`.

### Diagnosis without a repro

The Browser pane cannot sign in to `antcv.pages.dev`, so there was no live
reproduction available. D1 substituted for one:

| Question | Query | Answer |
| --- | --- | --- |
| Did the click reach `createApplication`? | newest `application` rows | **No** — every row created that morning came from the nightly runner |
| Who wrote a given tracker artifact? | `artifacts[].generated_at` | **seconds** = `gen-runner.py`; **ms** = the island (`Date.now()`) |
| Which rows can never open? | `json_type(doc,'$.support.<uk>')` over `rows` | one row typed `object` instead of `text` |

That last query found it: `doc.support['terma-career-opportuniti-0782']` was a
structured object `{needs:[…],bring:[…]}` where `TrackerDoc` declares
`Record<string,string>`.

### Root cause 1 — untyped co-writers

The tracker doc is **one shared JSON written by three independent authors**: the
React island, `scripts/job-tracker/gen-runner.py`, and cloud/LLM routines. A
routine wrote the object; `mergeResearchBlock`'s `(roleIntel || '').trim()`
threw; `prepareAndOpen` died in its own catch.

The island cannot police its co-writers, so it stopped trusting value **types**:

- `normalizeDoc()` (`api.ts`) coerces every text map — `urls`, `jd`, `gen`,
  `signals`, `support`, `webintel` — plus `sigfiles` entries and row cells, **as
  the doc enters**: on the `GET` and on the 409 `serverDoc`.
- `asText()` renders an object as labelled lines rather than `[object Object]`,
  so genuine intel still reaches generation.
- The two former throw sites coerce as well (defence in depth).
- The live corrupt value self-heals on the next tracker save.

**When you add a new doc map, add it to `TEXT_MAPS`.**

### Root cause 2 — the silent dead end

About 13 rows carry only a careers **listing** URL (Terma, Hilti, 3Shape,
Microsoft…). Running the real handler offline settled what the fetch does:

```bash
node -e "const {handleFetchJdUrl}=await import('./workers/demo-proxy/src/fetch-jd-url.js')"
```

`https://www.terma.com/join-us/apply-for-a-job/open-positions/` →
`ok:false, wall:true, HTTP 403`. So Open hit `No JD text for this role` and
returned — a banner that reads as nothing happening.

Open now raises an in-place JD paste/attach modal, seeded from anything already
in that row's Signals, and stores the JD on the row (one-time). The JD column's
`—` became a `＋ JD` button that does the same without going through Open.

### Two more fixes in the same handler

- **The reload no longer depends on the tracker-doc PUT.** The application is
  already created and active by then; a rev race with the nightly runner (which
  writes this doc every few minutes) used to strand the owner with a created app
  and an inert panel.
- **Every exit path logs a `[jt-open]` breadcrumb.** This shipped with no console
  output at all, which is why "nothing happens" was undiagnosable from the
  owner's log.

### Verification

`pwa/antcv-jobtracker-doc-nonstring.test.mjs` — 11 tests. The behavioural half
runs the REAL `api.ts` through `ts.transpileModule`; it **skips cleanly** when
`typescript` is not installed, so a bare clone or worktree does not fail the
suite. Deployed bundle confirmed live over HTTP before reporting done.

---

## 2. JD Gap Closure → "✏ I cover this — apply to docs"

**ID:** GAP-APPLY-RICHBLOCK-001 · **PWA 1.51.3942-gap-richblock** ·
`pwa/app.src.js` + minified mirror `pwa/app.js`

### The defect

The handler builds a `Current state` payload of the CV/CL sections and asks the
model to patch them. That builder (`app.src.js` ~12770, the `o=e=>e&&e.on?…`
chain) handled **text / text_inline / text_bullets / foundation / bullets /
table / experience** and returned **`null` for everything else — including
`rich_block`**.

The documents migrated to `rich_block` (roles cutover + CL v5). Measured on the
owner's actual application:

```sql
SELECT json_extract(s.value,'$.type'), COUNT(*)
FROM application a, json_each(a.cv_sections) s WHERE a.id=2751 GROUP BY 1;
--  cv: rich_block 15        (15 of 15)
--  cl: rich_block 7, text 2 (7 of 9)
```

So the model was handed **2 of 24 sections** and asked to patch the rest. It
could only return empty patches ("0 CV sections, 0 CL sections updated") or
invent section ids it had never seen.

### Why it was missed

The identical `rich_block` gap was found and closed for the **compress** path on
2026-06-29 (`pwa/test/unit/compress-rich-block.test.mjs`). That fix touched the
compress source-builder, the compress prompt chain, and `Pe()` — the shared
applier. `Pe()` has had a `rich_block` branch ever since. Only the **gap-closure
builder**, a separate source half, was left behind.

### The fix

A `rich_block` branch emitting exactly the rows `Pe()`'s applier consumes, in
order — skipping `grp` sub-headings, `hidden` rows and empty-`t` rows — so the
value→row mapping cannot desync (**FIXIT-DESYNC-001**, which previously bit
`labeled_list`). Plus one prompt rule: keep every `"b"` lead-in frozen, rewrite
only `"t"`, same count and same order.

Mirrored into minified `app.js` by single-occurrence anchored replacement; both
bundles parse-checked with `new Function(...)`.

### Verification

`pwa/test/unit/gap-apply-richblock.test.mjs` — 7 tests that **extract and run
the real builder out of the shipping `app.js`**, not a replica. Proven to fail
before the patch and pass after:

```
PRE-PATCH  build({type:'rich_block', …}) -> null
POST-PATCH build({type:'rich_block', …}) -> {id, type:'rich_block', items:[…]}
```

Full pwa suite **1554 / 1554**.

### Left open, deliberately

- The exact **"SCRIPT ERROR"** string the owner saw was never captured, so it is
  not proven this was the only fault behind that click. The apply path's own
  catch reports `Apply failed: …` in-panel, so an *uncaught* overlay error would
  point somewhere else — capture the console message if it recurs.
- The builder still omits `labeled_list` / `list` / `education`, which `Pe()` can
  apply. None appear in any current document; filed rather than widened blind.

---

## Reusable lessons

1. **A shared JSON document needs a type boundary.** When more than one program
   writes a store, the reader must coerce at the edge. `normalizeDoc()` is that
   boundary for the tracker doc.
2. **When a schema migrates, grep for every producer AND consumer of the old
   type set.** `rich_block` reached the compress path in June and the
   gap-closure path never — one `grep -n '"experience" === e.type'` would have
   found both builders in the same file.
3. **A feature that fails must say so where the user is looking.** Both bugs
   reported as "nothing happens": one wrote to a banner above the fold of a wide
   panel, the other logged nothing at all. Breadcrumbs are cheap.
4. **D1 is a substitute for a repro** when the app cannot be signed into
   headlessly — row existence and timestamp units identify which writer ran and
   how far a flow got.
5. **Tests that extract the shipping artifact beat tests that replicate it.**
   Both new test files run the real committed code, so they fail when the mirror
   is missed.

## Files

| Path | Change |
| --- | --- |
| `src/islands/JobTracker/api.ts` | `asText()`, `normalizeDoc()`, `TEXT_MAPS`; normalize on GET + 409 |
| `src/islands/JobTracker/JobTracker.tsx` | JD paste/attach modal, `＋ JD` cell button, un-gated reload, `[jt-open]` breadcrumbs, coercion at the throw sites |
| `pwa/antcv-react-islands.js` | rebuilt (`npm run build`) |
| `pwa/app.src.js` + `pwa/app.js` | gap-closure builder `rich_block` branch + prompt rule |
| `pwa/antcv-jobtracker-doc-nonstring.test.mjs` | 11 tests |
| `pwa/test/unit/gap-apply-richblock.test.mjs` | 7 tests |
| `docs/qa/ACTIVE_BUGS.md`, `docs/qa/OPEN_REGISTER.md` | entries above |
