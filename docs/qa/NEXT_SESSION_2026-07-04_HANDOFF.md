# HANDOFF 2026-07-04 — open vs. closed + next-session prompt

Owner ask (2026-07-03 evening): "document all open vs. closed issues and give me a prompt
for a new session to handle all remaining issues." Authoritative detail lives in
`docs/qa/OPEN_REGISTER.md` (row numbers below reference it) and
`docs/qa/JD-SPECIFIC-CV-COMPRESSION-SPEC.md` (rules 1-44). This file is the snapshot + the prompt.

## CLOSED — NIL campaign + this session (PWA 1.51.101→1.51.117, workers wk 1.14.126→132, relay/proxy current)

| Area | What shipped | Where |
|---|---|---|
| NIL application | Final CV(9)/CL(10) pair delivered, 14/14 owner checks green; Q&A standalone page 2 with own closing + alternate sign-off; header trim | 1.51.107-112, wk 1.14.126/127 |
| Meta reverts | BOTH downgrade writers killed (277 mirror + second cloud-adoption block); NIL meta survives reload + export | 1.51.105/108, guards test-locked |
| Stale row-restores | Guard classifier v2: any bracketed segment = placeholder → poisoned buckets purge, restores AUTO-HEAL (no more same-tick re-edit races) | 1.51.113 |
| JD extraction | Garble→vision reorder, charset gates, filename-echo warning, OCR chips; vision-blind provider pinned out | 1.51.99-102 |
| Kernel | v10/v10b: Scholar + AntCV project with render gates; banned career-comment scrubbed at the SOURCE; 12/12 role results | Downloads + OneDrive |
| Export belts | ROLE-CLASS-HIDE, BULLET-CAP (4/5), placeholder gate, sidebar 32%, access one-liner, profile/access scrub, patent word | 1.51.103/104/109 |
| Merged roles | Join with " & ", function first; cap 5 bullets; owner confirmed Innoviz order | 1.51.113 (rule 41) |
| Hidden-group family | Per-app "Hidden - <category>" review rows (never render anywhere); least-space restore; long-press/right-click menu (per-token hide + restore); visibility analytics → gen-prompt feedback; UNDO for hide + sidebar/table resize; all shape-aware after RICHBLOCK-SHAPE-001 root cause | 1.51.114-117 (rules 42-44) |
| Sidebar gen rule | Line economy: long+short adjacency, hide irrelevant, compressed forms | 1.51.113 (rule 40) |
| CL polish | AI notice on every CL page at true bottom (section footer); rule lines visually centred in PDF | wk 1.14.131/132 |
| Prod repair | app.js placeholder-drop regex had lost its backslashes (dead in prod) — restored + test-locked | 1.51.117 |

Suite: 854/854. Deployed and live: `app.js?v=1.51.117`.

## OPEN — owner priority order

**P1 (row 27 + row 28 page target): MAIN-RUNT-ORPHAN-SWEEP-001 → ~1.5-page targeted CV.**
Baseline measured in `docs/qa/RUNT_INVENTORY_UNSOL_20260703.md`: ~19 main-column last-lines
<60% fill, 5 force-justified stretched lines, near-blank page 3, suspected Work-style tail
truncation. Owner rules: last-line fill ≥60% via merge/expand/rebalance; the fixer must be able
to LENGTHEN (add a concrete stored detail) not only compress; NEVER mid-line force-justify
(rule 30); no cross-section dedup. Machinery: orphan-measure-bind v2 export preflight (1.51.57)
+ sidebar half (1.51.71/75) currently BOTH under- and over-fixes. Include the deterministic half
of rule 40 (sidebar packing/measure belt — order long+short within groups). This is the main
lever toward the 1.5-page target (row 28 leg).

**P2 (row 28 leg): Scholar/AntCV hyperlinks in the PDF.** Kernel v10 carries
`googleScholar`/`publicationsScholar` (renderAsHyperlink + showWhenJDContainsAny research gate)
and the AntCV project (SW/AI/PM gate). Worker leg: render real hyperlinks in the DOCX
(w:hyperlink + rels) so CloudConvert PDFs carry clickable links; wire docx-client payload +
respect the JD gates. Related old row 2 (SW-projects hyperlink) closes with this.

**P3 (row 28 leg): BRAND-FIT-PALETTE-001 (rule 37).** The brand-fit flag must apply sampled JD
colours (NIL sample #0373c6/#00355a) to the EXPORT palette. A package colour touches FIVE synced
copies (memory: palette-token-copies); preview band = --header-bg, export = per-package band token.

**P4 (rows 29/31 residuals):** (a) 277 sequence/timestamp guard — never let OLDER cloud meta
overwrite NEWER local; (b) CL hydration race — synchronous cl_overrides→sections apply or an
export preflight gate; (c) poisoned-row repair — auto-save must not persist a DOWNGRADED meta
into a targeted row (guard v2 auto-heals CL prose, meta legs remain); (d) em-dash scrub for
meta-sourced CL prose.

**P5 (rest of the register, staleness order):** row 25 TABLE-GEOMETRY-PARITY (real-PDF
measurement); row 26 remainder (owner gold-text for Instruments/Lab as deterministic rule);
row 22 phase 2 (CL slogan as real rich_block section — double-render hazard); row 30 ee()
image-aware routing; row 23 preview-button audit (standing nightly); rows 1/3/9/14/16/17/18;
row 19 two-device test (owner); CL-RULE-BALANCE-002 preview leg (live measurement);
QA-page signature image duplicate (worker); row 20 owner verify list.

**Owner-eye pending (no code):** long-press feel on the real phone (550ms/8px); neardup
backfill on real data (1.51.95); wk 1.14.122 alignment spacer in a real PDF; analytics buttons
after hard refresh; rules 23 adaptive slogan on a FRESH generation.

**Standing order:** 97.5% alignment loop (spec rule 38) — measure every fix against a FRESH
generation, not hand-guided exports.

## PROMPT FOR THE NEW SESSION

Paste everything between the lines into a fresh session:

---
Read CLAUDE.md first. Then read docs/qa/NEXT_SESSION_2026-07-04_HANDOFF.md,
docs/qa/OPEN_REGISTER.md and docs/qa/JD-SPECIFIC-CV-COMPRESSION-SPEC.md (rules 1-44)
end-to-end before touching anything. Sync first: git fetch origin && git pull --rebase origin main.

State: PWA 1.51.117 live, suite 854/854, NIL campaign closed (see the handoff's CLOSED table —
do not re-diagnose anything there). Work my priorities IN ORDER, one release at a time,
diagnostic-first, and measure results on FRESH generations (97.5% loop, spec rule 38):

1. ROW 27 ORPHAN SWEEP toward the ~1.5-PAGE targeted CV (spec rules 30 + 40). Baseline =
docs/qa/RUNT_INVENTORY_UNSOL_20260703.md. Recalibrate the orphan-measure-bind v2 preflight:
last-line fill >=60%, fixer must be able to LENGTHEN from stored kernel detail (never fabricate),
NEVER mid-line force-justify, no cross-section dedup. Add the deterministic sidebar packing belt
(order long+short values adjacent within groups; respects the Hidden-group family from
1.51.114-117 — tools is RICH_BLOCK: items {b,t,bullets}, visibility = section-level hidden map,
use the shape helpers in antcv-tools-hidden-residue.js). Verify page count on a fresh NIL-targeted
generation export.

2. SCHOLAR/ANTCV HYPERLINKS in the PDF. Kernel v10 (Gabriel_personalInfo_modernized_2026-07-04_v10.json)
carries googleScholar/publicationsScholar with renderAsHyperlink + showWhenJDContainsAny
(research terms) and the AntCV project (SW/AI/PM gate, not for cleanroom roles). Implement the
worker render leg (real w:hyperlink + rels in workers/docx-worker/src/index.js — hand-maintained
bundle, no build step) + the docx-client payload wire, honoring the JD gates. Worker deploys are
manual: gh workflow run deploy.yml -f target=docx-worker -f mode=deploy -f confirm=docx-worker;
curl /health to confirm. Verify links are CLICKABLE in a real CloudConvert PDF.

3. BRAND-FIT-PALETTE-001 (spec rule 37): the brand-fit flag applies sampled JD colours
(#0373c6/#00355a for NIL) to the EXPORT palette. A package colour has FIVE synced copies
(memory palette-token-copies) — update all; preview band reads --header-bg.

4. Rows 29/31 residuals: 277 sequence/timestamp guard (older cloud meta never overwrites newer
local); CL hydration race (synchronous cl_overrides->sections apply or export preflight gate);
auto-save must never persist a DOWNGRADED meta into a targeted row; em-dash scrub for
meta-sourced CL prose.

5. Then the register in staleness order: row 25 table geometry parity (measure in the REAL
CloudConvert PDF), row 26 gold-text remainder, row 22 phase 2, row 30 image-aware ee(), row 23
preview-button audit, rows 1/3/9/14/16/17/18, CL-RULE-BALANCE-002 preview leg.

Discipline (non-negotiable): app.src.js edits mirror into minified app.js (names DIFFER — anchor
on string literals; NEVER rebuild via esbuild); author every JS-literal patch with Write/node
scripts, NEVER bash/python heredocs (backslash-eating shipped bugs twice); parse-gate app.js with
new vm.Script; full cache-bust per release (index.html ?v lines + ANTCV_VERSION seed ~line 340 +
sw.js CACHE + version-override TARGET_VERSION + append PREVIOUS version to STALE_VERSIONS);
suite = node scripts/run-tests.mjs pwa (never raw node --test) and it must be GREEN before every
push; grep for <<<<<<< before committing; register every fix in docs/qa/ACTIVE_BUGS.md + advance
docs/qa/OPEN_REGISTER.md rows; push to main only (PWA auto-deploys — poll antcv.pages.dev for the
new ?v), never force-push.
---
