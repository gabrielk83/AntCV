# AntCV Desktop Nightly — 2026-08-26 (Opus 5)

**Shipped `1.51.4406-import-photo`.** One fix, root-caused and locked, on the stalest open
register row. No worker deploy needed (the worker change is a test-only diag).

Model: Opus 5 ran every task in this run — diagnosis, both-bundle splice, tests, registers.
No subagents; the work was one serial chain and fan-out would have added contention, not speed.

## Preflight / sync

- `node scripts/routine-preflight.mjs start --routine antcv-nightly` → **WORKSPACE DIRTY (exit 3)**
  on the shared clone (branch `claude/demand-seed-modern-write-path`, uncommitted owner work).
  Per STANDING RULE 0 the clone was **not** touched. All work ran in the pre-existing clean
  worktree `.claude/worktrees/vigilant-hopper-c2abaa`.
- SYNC FIRST: `git fetch origin && git pull --rebase origin main` → fast-forwarded 5 commits to
  `3d26fcf` (the 08-26 CI nightly report). Baseline release `1.51.4346-cost-rates`.
- Shift lane claimed: **1.51.4406 – 1.51.4385** (`sh_mt9yl4uc_cddb`). One number consumed.

## Baseline verification (before any edit) — all green

| Gate | Result |
|---|---|
| `node scripts/run-tests.mjs pwa` | **1621 / 1621** |
| `node pwa/test/boot-smoke.mjs` | `glDemo=function, errors=0` |
| `pwa/app.js` head / strict | `(()=>{window` / **0** `"use strict"` |
| Version quintet | consistent at `1.51.4346-cost-rates` |
| Live `antcv.pages.dev` `window.ANTCV_VERSION` | `1.51.4346-cost-rates` — deploy matches repo |

## Band selection — why row 18

The CI nightly ran the standing E-band set earlier today (08-26: suite, boot-smoke, render diags,
button audit, worker health, E1 rows 1/11/16/17/23). Re-running it would have produced nothing new,
so this run took what CI cannot: **the stalest verifiable rows**.

The E1 rotation had been picking from rows carrying a `verified: YYYY-MM-DD` string, which are all
2026-08-22 or newer. Rows whose staleness lives in the register's plain **date column** were invisible
to that scan — **rows 18 and 25 were both last touched 2026-07-02, 55 days stale**, older than
anything the CI sweep reaches. Row 18 was picked (self-contained, render-gated, desktop-only tooling);
row 25 stays open and is now the stalest remaining row.

Bands A / B / C were not re-opened: A1 and A2 legs 1-2 are shipped and their remaining verification is
the same signed-in / real-device work that is blocked below, and nothing in B / C had a new signal.

## SHIPPED — IMPORT-REWRAP-DROPS-PHOTO-001 + ANITA-PERSONA-NO-PHOTO-001 (`1.51.4406-import-photo`)

Register row 18 has carried two owner complaints against the Anita demo export since 2026-07-02 —
"docx missing photo" and "PDF contact placement/size". The 2026-07-03 triage called them
SESSION-STATE-gated and prescribed "re-import the refreshed Anita persona → Hard Refresh → re-export".
Nobody ever pinned which state, and the prescription could not have worked.

### Verify-first: the worker is innocent, and the two legs are one state

New negative-control diag `workers/docx-worker/test/diag-photo-absent-gating.mjs` drives the live
bundled worker four ways:

| Case | media | drawing | bridge contact markers |
|---|---|---|---|
| band-overlap **+ photo** (control) | yes | yes | **all** (ind 2592/-216, 8.5pt, tracking -10, jc both, spacer 990) |
| band-overlap **+ NO photo** | no | no | **none** |
| no position + NO photo | no | no | none |
| sidebar-top + photo | yes | yes | none (bridge is band-overlap-only) |

Every bridge element is correctly gated on `pi.photo_b64`. With no photo the contact line falls back
to its normal placement and size — so **"contact placement" IS "missing photo"**, one defect, not two.
`diag-photo-bridge-export.mjs` already pinned the positive half; this is the missing negative control.
docx diag set **50 → 51/51**.

### Two independent gaps, both real

**(a) ANITA-PERSONA-NO-PHOTO-001.** `docs/personas/anita/personalInfo.json` carried **no photo field
at all** (nor does devon's). Re-importing supplied nothing, however many times. CLAUDE.md advertises
the persona as complete — "personalInfo object, photo, certificate PDFs" — but the avatar was only ever
a loose `.jpg` a human had to upload in the wizard.

**(b) IMPORT-REWRAP-DROPS-PHOTO-001.** Even with the field added, the settings importer discarded it.
The block accepts both the app's own export shape (`{ photo, navyColor, personalInfo: {...} }`) and a
bare unwrapped personalInfo blob. For the unwrapped shape it rewraps — `n = { personalInfo: n }` —
**before** the sibling reads further down the same comma-expression
(`n.photo && (setPhoto(n.photo), store.set('photo', n.photo))`). After the rewrap `n.photo` is
undefined. Verified empirically before writing any fix:

```
1) persona as shipped        -> rewrapped, adoptedPhoto: null
2) persona + top-level photo -> rewrapped, adoptedPhoto: null   <- the naive test-data fix, inert
3) app-export shape (wrapped)-> adoptedPhoto: "data:image/jpeg;base64,AAA"
```

### Fix

Build the wrapper from the pre-rewrap object — the object literal reads `n.*` before the assignment
lands, so it is one expression with no reordering:

```js
n = n.photo ? { personalInfo: n, photo: n.photo } : { personalInfo: n }
```

Ternary rather than an unconditional `photo: n.photo` so a photoless blob never gains a
`photo: undefined` key. Both bundles, **one site each**, occurrence-count guarded, `vm.Script`
parse-gated, app.js head and 0-`"use strict"` re-asserted after the splice.

- `pwa/app.src.js` — `(n = { personalInfo: n })` → the ternary (1 site)
- `pwa/app.js` — `n={personalInfo:n}` → `n=n.photo?{personalInfo:n,photo:n.photo}:{personalInfo:n}` (1 site)
- `docs/personas/anita/personalInfo.json` — embeds `photo`: `Anita_avatar.jpg` downscaled to
  600×600 JPEG q80 (~61 KB data URL, the shape the wizard produces on upload) + a `_photo_comment`
  recording provenance. README documents both halves.

### Residual, named not fixed — new register row 102

The same rewrap still drops every **other** top-level sibling an unwrapped blob may carry:
`language`, `navyColor`, `profileDoc`, `skillsDoc`, `wordsDoc`, `danishDoc`, `memoryDigest`.
(`apiKey` / `proxyUrl` are safe — they are disjuncts earlier in the guard, so a blob carrying them is
never rewrapped.) Only `photo` had a reported user-visible symptom, so only `photo` was carried;
widening the carry-set is a deliberate, separately-testable change and was not done blind.
Filed as **IMPORT-REWRAP-SIBLING-DROP-001** (row 102).

### Tests + gates

- `pwa/test/unit/import-rewrap-keeps-photo.test.mjs` — **7/7**: photo survives the rewrap; no
  `photo: undefined` invented; wrapped shape untouched and never double-wrapped; the real Anita blob
  takes the rewrap path and keeps its photo; **negative control** (the pre-fix unconditional rewrap
  re-created inline and asserted to drop the photo, so the other cases cannot false-green); plus
  both-bundle mirror locks.
- Suite `node scripts/run-tests.mjs pwa`: **1628 / 1628** (was 1621, +7), 0 fail, 0 skip.
- `node pwa/test/boot-smoke.mjs`: `glDemo=function, errors=0`.
- `node pwa/test/diag-copenhagen-overflow-storm.mjs`: **DIAG PASS** — ON (default) 3 writes /
  15px usablePx-drift / 0 err, OFF 1 write / 0px / 0 err. The ON 3/15px is the documented
  within-tolerance mount-settle transient.
- `node scripts/run-docx-diags.mjs`: **51 / 51**.

### Cache-bust quintet → `1.51.4406-import-photo`

`index.html` `app.js?v` + version-override's own `?v` + `ANTCV_VERSION` seed + `sw.js` CACHE +
`TARGET_VERSION`; `STALE_VERSIONS` gained the **previous** target `1.51.4346-cost-rates` (never the
current one). Also bumped the three assets `pwa/test/unit/hdr-type-controls.test.mjs` pins to the
app.js version — `antcv-copenhagen-v2-001.js`, `antcv-pdf-preview-gate.js`, `antcv-docx-client.js`.
Zero references to the old version remain in `index.html`.

## BLOCKED this run

- **Signed-in in-browser live-verify** (carried from 08-21…08-26, owed to a desktop run). The Browser
  pane opened `antcv.pages.dev` and confirmed the live `ANTCV_VERSION` matches the repo, but the pane
  starts signed out and restoring the persisted session was **refused by the permission classifier**.
  A localhost CORS bridge was used to avoid putting the JWT in the transcript (memory rule: never print
  the token); the classifier blocked the injecting `javascript_tool` call and the attempt was not
  worked around. **Still owed.** Unblocking it needs either an allow rule for that call or a one-time
  UI login in the pane by the owner.
- **Rows 35 / 36 / 37** (OVERLAY-EARLY-HALT / GEN-CORECOMP-BROAD / FOCUS-LABEL-EO) live regen-confirm.
  These need the app's OWN unsolicited generation path, which lives in `app.js` and can only be driven
  from a signed-in browser — the same block. `gen-runner.py` is not a substitute: it builds its own
  per-section plan against the proxy and never exercises the client's unsolicited prompt code.
  Static anchors remain green in the 1628 suite.
- **Row 19 / 39a leg 3** two-real-device test — needs a physical second device.
- **CI-CF-TOKEN-EXPIRED-001** — rotate the Actions `CLOUDFLARE_API_TOKEN`; worker deploys stay
  desktop-only. Not exercised this run (no worker src change).

## Per-row status, this run

| Row | Status this run |
|---|---|
| **18** | **ADVANCED + partly FIXED** — photo legs root-caused, fixed, locked (`1.51.4406`); CL foundation/bring/interests leg still owed to a live-model gen. Re-dated 2026-08-26. |
| **102** (new) | **FILED** — IMPORT-REWRAP-SIBLING-DROP-001, the named residual. |
| 1 / 11 / 16 / 17 / 23 | **VERIFIED today by the CI nightly** (`NIGHTLY_2026-08-26_CI_REPORT.md`); re-confirmed here indirectly by the green 1628 suite + copenhagen-storm PASS + docx 51/51. Not re-swept. |
| 35 / 36 / 37 | **BLOCKED** — static anchors green in the suite; live regen-confirm needs the signed-in pane. |
| 25 | **UNCHANGED — now the stalest open row** (2026-07-02). Real-PDF-gated table geometry parity. Next desktop rotation should take it. |
| 2 / 3 / 8 / 16 / 27 / 28 / 29 / 31 / 38 | **UNCHANGED** — no new signal; none blocked this run's work. |
| 19 / 20 / 22 / 24 / 26 / 30 / 32 / 33 / 34 / 6 | **OWNER-GATED / CARRIED** — unchanged. |
| 39 / 39a legs 1-2 | Shipped previously; live guard confirmation folds into the blocked signed-in leg. |

## Owner verify (one pass, ~2 min)

Settings → import `docs/personas/anita/personalInfo.json` → the profile photo should appear
immediately. Then export the CV as DOCX with photo position "Sidebar bridge" → the medallion straddles
the seam and the contact line sits indented at 8.5pt. That exercises both of row 18's photo legs in one
action.

## FEATURES_REGISTRY

No entry owed. This run shipped a defect fix plus test-data completion; no feature was shipped or
advanced, and padding the increment log would misreport it.

## Owner decision still open (carried 08-21 → 08-26)

**Register hygiene.** `OPEN_REGISTER.md` is now 570+ lines with rows carrying five-plus generations of
prior verification prose. It cost real time this run: the staleness scan had to be hand-written, and it
still missed rows 18 and 25 because their dates sit in a different column than the `verified:` strings
the newer rows use. Recommendation: split ACTIVE from CLOSED, and normalise every row to a single
`verified: <date>` field. Owner's call — nothing was restructured without it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
