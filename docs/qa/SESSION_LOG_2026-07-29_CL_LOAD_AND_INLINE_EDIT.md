# Session log — 2026-07-29 (desktop, Opus 5): cover-letter load fidelity, header type controls, inline editing

Nine owner-reported defects across three rounds, all on the cover letter. They
fall into **three recurring shapes**, and naming the shape is the useful part:

1. **A global key that no per-application load path resets.** The slogan mode,
   the sticky hide, the brand palette. Load app A, then app B, and B renders A's
   state. Four of the nine defects were this.
2. **Two consumers of the same value reading different stores.** The panel wrote
   the canonical `localStorage.fontSizes`; the band read `styleConfig.fontSizes`,
   a legacy mirror that is normally absent. The control looked dead.
3. **A default that outlived the ask that created it.** The rule above WHY was
   stamped on by a sidecar because an owner asked for it weeks ago; the owner
   now wants it hidden.

Shipped: PWA `1.51.3882-cl-load-fidelity`, `1.51.3922-hdr-type-source-key`,
`1.51.3982-inline-edit-appline`; docx-worker `1.14.174-appline-edit`
(deployed, `/health`-confirmed).

**Diagnosis method that carried the whole session:** querying production D1
(`ant_memory` `499c3de9`) directly instead of reasoning about the render chain.
Two queries — `json_extract(meta,'$.slogan_placement')` etc. over the last 25
`application` rows, and `json_each(cl_sections)` for one app — turned four
"maybe" hypotheses into confirmed facts and additionally exposed two content
defects the owner had not yet reported.

---

## Round 1 — loading from the preview topbar's Application History

> "when I upload from the application history (from the preview top bar) the
> slogen (in cover letter) is emapty, the horizontal line under the application
> is bleeping, and the horizontal line under the opening / befor why this
> position is visible instead of hidden by default, and many times also the
> specialization line. was seen on mobile. in addition the color sceme is
> locking on one application (for example therma) and not chaning for others."

**PWA `1.51.3882-cl-load-fidelity`.** Test:
`pwa/test/unit/cl-load-from-history.test.mjs` (18).

### SLOGAN-PLACEMENT-PERAPP-001 — the empty slogan

`antcv:clSloganMode` and `antcv:clSloganHidden` are GLOBAL sticky keys that no
load path ever reset. Meanwhile the per-app placement the generator decides
rides in `meta.slogan_placement` (`brand_fit.decide_slogan_placement` →
`"heading"` | `"leadin"`) and was **never read by the PWA** — the key was
documented as seeding `clSloganMode`, and only the user control ever wrote it.
One `leadin` app therefore made `__antcvSloganStandaloneHidden()` return true for
**every** app loaded after it, and the standalone tagline rendered nothing.

Evidence (D1): `#2796` is `slogan_placement: "leadin"`; `#2802 / #2801 / #2800`
are `"heading"`.

Fix: `window.__antcvApplySloganPlacement(meta)`, called from BOTH
Application-History loaders — symmetric with the existing
SLOGAN-LOAD-SYMMETRIC-001 clear of the slogan TEXT.

### SUBTITLE-PI-FALLBACK-001 — the missing specialisation line

The loaders resolve subtitle from the `subtitle` column, then `meta.subtitle`.
The nightly `gen-runner` writes a MINIMAL meta
(`source/tier/urlkey/slogan/slogan_placement/brand_research`) with no subtitle —
**23 of the last 25 rows** — and rows 2797-2800 also carry an EMPTY `subtitle`
column. So it resolved to `""` and the line vanished.

Fix: fall back to `personalInfo.specialization`. It is what the header already
renders and it is global to the candidate, so it cannot leak the previously
loaded application's identity. `gen-runner` now also persists `meta.subtitle`
so the record describes itself.

### PALETTE-STICK-CLEAR-APPLOAD-001 — colours locked to one application

The JD-list *Open* path has cleared `antcv:brandV2` + `window.__antcvBrandFit`
symmetrically since PALETTE-STICK-CLEAR-001. The two Application-History loaders
never did, so the first branded app's colours survived every switch.

Fix: both loaders clear first, then re-arm only THIS app's brand
(`meta.brandV2`, else its `meta.styleConfig` slots; a slotless or headerless
record arms nothing). Pairs with the BRAND-COLORS-PERSIST-001 runner + island
halves committed the same day, which give new apps a per-app palette to restore
in the first place.

### APPLINE-RULE-NATIVE-001 — the "bleeping" rule

`antcv-appline-rule.js` wrote the rule as an INLINE style on the React-owned
`__cl_appline` node. React dropped it on every `sections-updated` re-render and
the sidecar painted it back 150ms later — a visible blink.

Fix: React renders it, from the same `headerItemRule.application` store (legacy
`antcv:applineRule` honoured, default visible at 1.5pt, an explicit user OFF
respected). `position` is owned by React too, so the sidecar writes nothing. The
sidecar keeps only the control.

### SLOGAN-RULE-MISTARGET-001 — a rule under the opening

`sloganEl()` ended in "the first contenteditable inside the CL flow". Whenever
the slogan did not render — the normal state per the bug above — that is the
OPENING paragraph, so the slogan rule was drawn under it.

Fix: the native slogan node carries `data-antcv-cl-slogan-native`; the generic
fallback is gone.

**This was a real defect but NOT the line the owner was reporting** — see
WHY-RULE-DEFAULT-OFF-001 below. Two independent causes in the same place.

### CL-V5-CONTRIB-3-CLOSE-001 / CL-V5-WHO-GOAL-001 — content shape

Same round, from the owner: *"How will I contribute should include opening, 3
bullets and closing. Who I am should include the goal lead-in."*

Ground truth from D1 (`#2802`): `contribute` shipped a lead + **2 unlabelled
bullets and no closing**; `who` shipped lead + Professional summary + How I
operate + Eligibility and **no "My goal" row**.

Three causes for contribute: the v5 skeleton had 4 bullets and no closing row;
the apply chain wrote `intro`/`items`/`closing` FIELDS that a `rich_block` does
not render; and `gen-runner`'s `Goal:` matcher took only the English label with a
`:`/`-` separator while discarding any trailing prose line. For `who`: the
completeness gate only OR'd `who_goal` with `who_operate`, so a goal-less draft
scored, and the runner's parser matched one exact label and dropped every
unlabelled line after the first.

Fixed across the skeleton, both preview/apply paths, all three prompt surfaces
and `gen-runner.py`. `who_goal` is scored on its own (gate 5/7, was 4/6). The
runner accepts label aliases, promotes a trailing unlabelled line, keeps v5 row
order, and logs when it still ships without one.

---

## Round 2 — the panel controls, and the line that was still there

> "font size resizing and compressin is not doing anything in the preview. the
> horizontal line before why this company is still visible"

**PWA `1.51.3922-hdr-type-source-key`.** Test:
`pwa/test/unit/hdr-type-source-key.test.mjs` (10).

### HDR-TYPE-SOURCE-KEY-001 — the controls were inert on the band

`antcv-copenhagen-v2-001.js` emits the band's name/spec/contact `font-size` and
`letter-spacing` with `!important`, so it overrides the panel's React inline
styles **by design**. That is only safe if it reads the SAME store the panel
writes — and it did not. The panel writes the canonical top-level
`localStorage.fontSizes`; the sidecar read `styleConfig.fontSizes`.

So `__fsOv0` was `{}` on every pass: the static 23/18/13px defaults shipped over
whatever the user set, and every tracking delta resolved to 0.

This is the exact sibling of the `antcv-pdf-preview-gate` `personalInfo.fontSizes`
bug fixed in `1.51.3862` — that sweep caught one legacy mirror and missed this
one. **When a control looks dead, check that its writer and its renderer name the
same key before looking at anything else.**

### HDR-TYPE-USER-WINS-001 — reading the right key was not enough

The measured fit (`__fit.nameFs` / `specFs` / `contFs`) is emitted LAST and
unconditionally, so it overwrote the panel size even once the value was read.
Per the owner's standing rule for these controls — *"nothing may prevent the user
from setting those values"* — a line whose panel size has been moved OFF the app
default is no longer re-fitted.

**Known trade-off, owner should be aware:** once a size is set by hand, the
width-matching fit stops managing that line, so an over-long name can overflow
the band. A line still on its default keeps the fit exactly as before. The test
is differs-from-default, not key-present: the panel writes the WHOLE `fontSizes`
object on any change, so presence proves nothing.

### Repaint — nothing rebuilt the stylesheet on a panel change

The sidecar rebuilds on `antcv:sections-updated`, `storage` and a few boot
timeouts. A font-size change fires none of those in the writing tab, so even a
correct value only appeared after some unrelated re-render. The three `fontSizes`
setters now dispatch `antcv:fontsizes-changed` and the sidecar listens;
`buildCSS` is a pure re-derive so re-running is cheap.

### WHY-RULE-DEFAULT-OFF-001 — the rule above WHY, correctly identified

It is **not** the slogan rule. `antcv-cl-text-cleanup.js` stamps
`headlineRule: true` onto the `why` section of every letter (Item 8, owner
2026-07) and `app.js` renders it via the `t.headlineOff ? (t.headlineRule && …)`
leg. That is why hardening the slogan finder in `1.51.3882` left the line
standing.

The default is reversed. The sidecar now CLEARS the rule **it** set, keyed on its
own `__whyRuleSet` marker so a rule the user turns on in the section editor
survives, and the marker is dropped on the way out so the heal converges in one
pass per letter. Each saved letter clears on first open after the deploy.

### CL-V5-CONTRIB-3-CLOSE-001 follow-up

`ensureContribStructure` un-marked the LAST contribute row unconditionally,
treating it as the Goal line. On a section with no closing row that silently
demoted the third BULLET to a paragraph — a second, independent cause of "two
bullets and a stray line". It now requires the full locked shape (lead + 3
bullets + closing = 5 rows) before demoting anything.

---

## Round 3 — inline editing, and the NaN readout

> "allow editing of the slogen and of the application line in the preview.
> pressing Applkication line resizing is gernerating NaNPt between the + and -"

**PWA `1.51.3982-inline-edit-appline`** + **docx-worker `1.14.174-appline-edit`**
(deployed). Test: `pwa/test/unit/appline-slogan-inline-edit.test.mjs` (13).

### FONTSIZE-STEP-NAN-001

The panel ROW displays a fallback when a key is missing, but the stepper added to
the RAW value: `undefined + 0.5 = NaN`, and NaN **persisted** —
`JSON.stringify(NaN)` is `null`, so it came back as null on the next boot and
stayed broken.

The key goes missing because the set-all setter REPLACES the whole `fontSizes`
object, so any caller passing a pre-`1.51.3862` object drops every key that
release added — which is why the owner hit it on the Application line row first.

Three guards: set-all merges over the defaults; the stepper falls back to the
value the row displays (passed in) then to the default; a non-finite result is
refused instead of stored. An already-persisted `null` self-heals on next press.

### APPLINE-EDIT-001

The application line was a composed, read-only string. It now resolves
override-first over a new standalone key `antcv:clAppLine`.
`__antcvAppLineText` was split into `__antcvAppLineComposed` (the old body) + a
resolver, so ONE edit reaches all three surfaces.

Two details worth keeping:

- The editable text is an **INNER span**, not the div. `antcv-appline-rule`
  appends its control cluster to the div, and a ref managing the DIV's
  `textContent` would delete that control on every model change — the sidecar
  would re-add it and the blink removed in `1.51.3882` would be back.
- The commit reads through `__antcvEditableText`, which strips any
  `contenteditable="false"` descendant. Reading `textContent` straight would have
  stored the rule control's own glyphs into the line.
- Typing the composed sentence back verbatim, or clearing the field, REMOVES the
  override, so the line goes back to tracking role/company instead of freezing.

Worker leg: the client forwards `meta.app_line` and the worker prefers it,
**short-circuiting its own composition** rather than being overwritten by it. The
first cut cleared `__role` but left `__company`, so the `if (__role || __company)`
branch recomposed straight over the owner's text; the whole block is now gated on
`!__alText`. An absent field leaves every existing document byte-identical.

### SLOGAN-EDIT-EMPTY-001

The slogan was already `contentEditable` — the problem was that the node was not
RENDERED at all when it resolved empty, so on a letter without one there was
nothing to click. **Editable in principle, unreachable in practice.** Both fields
now show a faded prompt when empty ("Positioning line" / "Application line").
PREVIEW ONLY: the export srcdoc, the DOCX client and the worker all still resolve
`""` and emit nothing, so an untouched prompt can never ship.

---

## Still open

- **SALMON-MAIN-LENGTH (owner, round 1):** *"the salmon pagination of the main
  section makes no sense — is much longer than the actual export."* NOT
  addressed. `SALMON-BREAK-SITE-001` (`1.51.3802`) already moved the CV preview
  onto the export map and its own commit message names the residual page-box
  whitespace as the open follow-up. Acting further needs a live mobile capture of
  `antcv:autoPages` against a real export — not a guess at a measurer with ~15
  hand-tuned constants. Owed to a render-capable session with the owner's device.
- **Live verification owed for all three batches.** Shipped bytes were verified
  on `origin/main` and the worker via `/health`; the rendered result on the
  owner's mobile was not.
- **`pwa/antcv-jobtracker-doc-nonstring.test.mjs` fails on main** — PRE-EXISTING,
  verified against a clean tree, not from this session. It is a stray test file
  sitting in `pwa/` instead of `pwa/test/unit/`.

## Process notes worth keeping

- **The shift ledger was unreliable all session.** `shift.mjs` handed out
  `1.51.3942-3961`, a range a parallel session had already claimed — its
  `NIGHT_SHIFT.md` read was stale because the shared clone sat mid-merge with
  that file conflicted. Then a second session claimed AND shipped `1.51.3962`
  while this branch was in flight. Took `1.51.3982`, above both.
- **A parallel session aborted this session's rebase and `reset --hard` main**
  out from under it, orphaning two finished commits (reflog:
  `HEAD@{2}: rebase (abort)`, `HEAD@{0}: reset: moving to origin/main`). Nothing
  was lost only because the objects survived in the reflog. **Push a backup
  branch the moment you have commits, before rebasing** — it costs seconds and
  makes the work immune to any local reset. Recover with `reflog` +
  `cherry-pick`, not by re-rebasing.
- **Resolve a conflicted minified `app.js` deterministically, never by hand:**
  `git checkout <upstream> -- pwa/app.js`, then re-apply from a node script that
  asserts an exact occurrence count per anchor and exits non-zero on any
  mismatch. Git's 3-way merge on that file produces ~460KB "hunks". The script is
  reusable verbatim on a second rebase attempt — it was used twice here.
- **The mirror-lock test counts raw key occurrences,** so a code COMMENT
  mentioning `applicationSize` in `app.src.js` broke `app.js` parity. Keep new
  rationale comments free of the literal key names they discuss.
