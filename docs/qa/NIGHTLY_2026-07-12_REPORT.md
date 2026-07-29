# AntCV nightly — 2026-07-12 report (owner-attended session, continuation of the babel-fish push)

Baseline at close: PWA **1.51.357-translate-target** (main, in sync with origin). Suite **1222/1222**
green after every bundle. Four versions shipped tonight (354→357), all deployed and live-verified on
antcv.pages.dev. Owner was present and steering ("chase it and update nightly on what you completed").

## THE headline: the "templated CV/CL after kernel gen" mystery is SOLVED and fixed

Standing blocker from 07-11 (the 15-kernel batch was paused on it). The 1.51.354 diagnostic capture
caught it in one run:

```
KERNEL_INCOMPLETE: cl_overrides.contribute_intro (9 chars, need >=10)
```

`antcv-kernel-completeness-290.js` (the fetch/JSON.parse completeness guard) enforces ENGLISH
character floors on every prose field. Chinese is ~3x denser per character — a perfectly correct
7-9-hanzi contribute_intro failed the 10-char floor, the guard threw from INSIDE `JSON.parse`, the
whole response was discarded, and all 4 retries failed identically → the generation ended templated.
It also explains the intermittency (a wordier model occasionally cleared the floor) and why the
antcv:last-gen-keys capture never wrote on the first test (the parse threw before the capture site).

**Fix (1.51.356): CJK-LENGTH-EQUIV-001** — `effectiveLen()` counts each CJK char as 3 toward every
floor (`isFilledString` + `checkProseFieldStrict`; charCode loop, per the file's ASCII-only constraint).

**Verified live post-fix:** da kernel gen accepted on attempt 1, all 9 CL fields `real:<n>`,
`antcv:last-gen-who-src = "gen"`, and the CL WHO renders native Danish ("Jeg er ingeniør med 15+ års
erfaring i at bygge bro mellem tekniske løsninger og forretningsmæssige beslutninger…"). The CL-apply
path itself was never broken — the responses were being killed upstream.

## Shipped bundles

### 1.51.354 (f28d221) — diagnostics + pillar completion + identity twins
- **GEN-KEYS-CAPTURE-001**: after the accepted parse_jd destructure, `antcv:last-gen-keys` records
  {attempts, provider, top-level keys, per-CL-field verdict real/placeholder/empty}; the CL apply's
  WHO branch records which source won to `antcv:last-gen-who-src` (gen/section/neutral/default).
  One localStorage read now attributes any templated doc to model vs apply vs clobber.
- **UNSOL-PILLAR-GEN-META-001**: the last 3 literal `/^(unsolicited|open application|n\/a)$/i`
  regexes in the gen-response normalizer (GEN-UNSOL-003 scrub, `__jdNamedCompany`, the ghost-company
  neutralizer) now route through `window.__antcvUnsol` — a zh model echoing 主动申请 as meta.company
  is scrubbed as the sentinel instead of surviving as a "real employer".
- **LANG-IDENTITY-SWITCH-001 app.js twins**: `__ANTCV_WIDE_ID_RE` +
  `__antcvRestoreLatinIdentity`/`__antcvRestoreWideIdentity` + the ribbon call site were src-only;
  now shipped in the minified twin. Plus two gaps found during mirroring: `__antcvWriteContactItem`
  and the signname apply-back writer never stashed the Latin original before the FIRST wide
  overwrite — the first switch back to Latin had nothing to restore (the exact "name stayed in
  Chinese" symptom). Both files now stash on Latin→wide overwrite.

### 1.51.355 (50c2a29) — RELANG-SINGLE-FLIGHT-001
Owner question answered: "why is translation working on all tabs in chrome and the claude browser in
parallel?" Every babel-relang throttle (backoff, attempt cap, debounce) was a per-tab in-memory
variable — every open tab over the same localStorage independently fired the SAME heal, and other
signed-in browsers joined via the cloud echo. Parallel chunked translates then write-warred over
sections (jumpy preview, clobbered CL). Now: **only the visible tab heals**, and a cross-tab lease
(`antcv:relang-lease`, 180s) makes it one healing tab per browser profile. Cross-device parallelism
(two browsers both visible + signed in) is reduced, not eliminated — a cloud-side lease would be the
complete fix if it ever matters.

### 1.51.356 (26a0379) — CJK floors + location identity + boot heal + cell compactness
- **CJK-LENGTH-EQUIV-001** (the headline fix above).
- **LOCATION-IDENTITY-001**: `pi.location` is a FIFTH identity render source (the Settings panel +
  wizard bind `s.location` from ie()) that was never collected by translate and never in the restore
  legs — the owner's "locked on Chinese — it is in Settings too". Added to the collector
  (`pi_location` m-key, `__std: "piloc"`), the apply-back chain, snapshot/restore, and both
  restore-leg field arrays (src + minified).
- **BOOT-IDENTITY-LANG-HEAL-001**: new sidecar `antcv-identity-lang-heal.js` (data-level, wraps
  nothing). The restore legs only run AT a language switch; an already-wrong doc never self-repaired.
  The sidecar heals identity render sources toward the ribbon script on load + every 15s:
  stash-first, with Gabriel-NAME-GUARDED owner-pin token fallback (哥本哈根→København/Copenhagen,
  欧盟公民→EU-borger/EU Citizen, 柯葛顺·加百列·亚历山大→Gabriel Alexander Karp-Gershon, 加百列→Gabriel),
  including mixed artifacts like "2300, 哥本哈根 S". Kill: `antcv:disable-identity-heal`.
  Verified live: pane identity fully Latin on the da ribbon (name/city/location/signName).
- **TRANSLATE-CELL-COMPACT-001**: owner: "STRATEGIC EXPERTISE IS TOO LONG" (da cells wrapping to
  3 lines). The translate prompt now carries a ~60-char hard cap per translated table cell.

### 1.51.357 (pushed at close) — the "translate runs but content stays English" chase
Owner: "chase it". Fresh evidence from the instrumented pane (alert + console.warn capture):
the heal's 7 LLM chunks completed and the apply DID run (da markers 81→325), but PROFILE and
EXPERIENCE stayed English. Two real defects found:
- **TRANSLATE-RICHBLOCK-CONTENT-001**: the generated PROFILE is a `rich_block` whose prose lives in
  a BARE `content` field; the collector only walked `items[].b/t/bullets/group`, so PROFILE was
  never sent to the translator on ANY pass. Now collects `content`.
- **TRANSLATE-ROLE-ID-APPLY-001**: role translations were applied by ARRAY INDEX collected 2-3
  minutes earlier. The live doc had accumulated **24 roles** (en+da twins), and normalize/dedupe
  reorder or drop roles mid-flight — index-addressed writes landed on the WRONG role or were
  skipped by the SETIN guard, leaving experience in the source language. Entries now carry the
  role's stable id (`rid`) at collection; the apply re-resolves the index by id and skips (never
  mis-applies) if the role vanished.

## Verified live tonight
- 354/355/356 all confirmed served (ANTCV_VERSION + loaded app.js ?v + sidecar version exports).
- Post-356 da kernel gen: attempts=1, 9/9 CL fields real, whoSrc=gen, CL native Danish.
- Identity restore round-trip: pane pi fully Latin on da (name, city, location "2300, København S",
  citizenship EU-borger, signName Gabriel) with __zh_ stashes armed for the flip back (do not forget
  哥本哈根 — the reverse leg restores it without an LLM call).
- D1 llm_calls consulted throughout (parse_jd/long_context timing = the evidence trail).

## Open at close (next session)
1. **Verify 357 end-to-end**: on the ≥357 client run `__antcvRelangHeadless('da')` and confirm
   PROFILE + role bullets flip to Danish (the two fixes above); then the reverse zh flip.
2. **24-role accumulation**: the doc still holds ~24 roles (en+da twins, mostly hidden). Display
   dedupes, but the bloat inflates ratio checks and translate cost. Root-cause the re-adder
   (repairExperienceCompleteness vs kernel re-apply) before the batch.
3. **Native-gen language fidelity**: the post-356 da gen wrote the CL in Danish but most CV prose in
   English (model partially ignored LANGUAGE:). The heal pass is the designed backstop — with 357 it
   should now actually cover PROFILE + roles. If native fidelity matters more, strengthen the CV-side
   language lock in the gen prompt.
4. **15-kernel batch**: resume per runbook (nordic-minimal da → en → rest) on a ≥357 client —
   the CL-templated blocker is gone; commit slots only after a native-language + full-CL audit.
5. Un-owned residue from the work order: normalize-415 swallowed exception, upload-menu language
   modal, zh placeholder detector, preview __lamOfL wide-title gate, kernel-overwrite confirm modal.
6. The 00:03Z heal run whose apply never landed is consistent with the stale-index defect (2) but was
   not reproduced after the fix; if a no-apply recurs on ≥357, instrument `Rr` (in-progress flag) next.

Full evidence trail: docs/qa/TRANSLATE_COVERAGE_WORKORDER.md (2026-07-12 sections).

## Addendum (same session, after "chase it") — 357 verified + 358 shipped
- **1.51.357 VERIFIED LIVE**: post-fix heal run — PROFILE now Danish ("IT-fagperson med 15 års
  erfaring, der forbinder produktstrategi…"), visible role bullets Danish ("Byggede KPI- og
  rapporteringsstrukturer…"), en-markers 171→75. Both 357 defects were real and are gone.
- **1.51.358 (role twins)**: the verify exposed the accumulation at its worst — **25 VISIBLE roles**,
  every canonical role present as `<id>` + `<id>-2`/`-3` backfill twins plus gen schema ids (r1) beside
  canon ids (kanzen). Root cause: the completeness backfill's dup check (_samePosition) is
  translation-blind, so a da-titled role never matched its en canon → endless re-adds. Shipped:
  BASE-ID-SAME-POSITION-001 (same id root = same position) + GEN-ID-CANON-MATCH-001 (gen r-id vs
  canonical id at same company + same tenure, strict start / loose open end) in _samePosition (stops
  the re-adder), and the matching collapse branch in dedupeRoles (canonical id survives — the Results
  pins key on it — adopting the gen twin's fresh title+bullets; suffix twins keep the richer side).
  **Verified live: 25 → 12 roles, one per canonical id, kanzen carrying the fresh Danish title.**
  Suite 1222/1222.
- Final da heal fired on the deduped doc; with 357's id-resolved apply the surviving English
  titles/bullets translate onto the RIGHT roles. Next session starts the kernel batch from a clean,
  stable-identity document on 1.51.358.
