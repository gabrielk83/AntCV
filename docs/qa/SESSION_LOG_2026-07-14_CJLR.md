# Session log — 2026-07-14 — CJLR trio + tools/table + panel wrap

Long session on the alignment (CJLR) controls across the preview: header/section-heading,
group (role lines + general rich_block groups), per-row, and the section-panel layout.
All PWA-only (auto-deploys from `main`); the docx-worker is NOT updated (manual deploy).

## Shipped + live-verified

### 1.51.1184 → 1.51.1224 (header CJLR, group CJLR on roles, panel wrap)
- **Header / section-heading CJLR now moves the PREVIEW** (HEADLINE-LOC-PREVIEW-001).
  The "MAIN/SIDEBAR headline alignment" ↔ button (`antcv-section-panel-211.js`, loc store
  `antcv.sectionHeadlineAlignment.v1`) drove EXPORT only. Two causes: the old
  `[data-edit-path="title"]` hook the aligner relied on no longer exists in the render, and
  the headline editable SPAN is `display:inline` (aligning it is inert — the parent heading
  DIV positions the title). Fix: render marks the heading DIV `data-antcv-section-headline`;
  `panel-211` applies the loc alignment to it via `applyPreviewHeadlines()` on click + its own
  sweep (rAF + 2500ms interval + MutationObserver on `style`), so it survives every React
  commit. Only when the loc was user-touched. **Verified:** MAIN=right→heading right,
  MAIN=center→center.
- **Group CJLR on roles** (GROUP-CJLR-ROLES-001). The role line is a flex `space-between`
  row → `textAlign` (how `__group__` was applied) is INERT on a flex row. Fix: the role line
  is now ALWAYS a flex row marked `data-antcv-role-line`; its `justifyContent` follows the
  align (justify=space-between, left=flex-start, center=center, right=flex-end). Stable
  structure lets `antcv-item-align.applyOne` toggle it live. `renderRoleHead` gets
  `ctx.align` + stamps `data-antcv-rowkey`. **Verified:** all four states move the role line.
- **Panel-211 row wraps** (PANEL-WRAP-001). `flex-wrap:wrap` + title `flex:0 0 100%` → the
  lead-in owns row 1, the action buttons wrap to row 2 (was nowrap, squeezed a button to 0).
- Reversioned to 1.51.1224 (fresh lane) because a parallel session shipped
  1.51.1204-cjlr-rerender (SLOGAN-CJLR-RERENDER-001 = forces preview re-render on
  slogan/standalone localStorage changes) ABOVE my in-flight 1185 claim; shipping 1185 would
  have regressed the displayed version.

### 1.51.1225 (tools/general group-CJLR persist + focus-table left col)
- **GROUP-HEAD-CJLR-001** (owner: "tools CJLR switches after leaving the subsection panel").
  The legacy plain group heading (tools "Methods" and any rich_block group with no `seg[]`
  and not a roleHead) was rendered WITHOUT `data-antcv-group-head`/`data-antcv-rowkey`/
  `data-antcv-rowalign`, so item-align + section-align couldn't hold `__group__` across the
  re-render when the editor closes → it reverted. Now stamped like role/seg heads.
- **GROUP-HEAD-JUSTIFY-001** (owner: "tools first group fighting between left and justify").
  A single-line heading can't justify; the sidebar de-justify pass flips justify→left every
  frame, so `__group__=justify` oscillated. Fix: resolve justify→left for plain group heads
  in BOTH the render and item-align. Role heads keep justify (=space-between).
  **Verified:** center→center, right→right, justify→left STABLE, persists across re-render.
- **FOCUS-TABLE-LEFTCOL-JUSTIFY-001** (owner: "table focus area left row make default
  justify"). The focus-area (core_comp) table left `[Focus]` column defaulted to left while
  the right column justified. Defaulted it to justify. Owner may revert to left if short
  labels open ugly gaps. **Preview-only — worker not updated.**

## Files touched
- `pwa/app.js` + `pwa/app.src.js` — headline DIV marker; `renderRoleHead` ctx.align; legacy
  group-head CJLR markers + justify→left; focus-table left `td` textAlign:justify.
- `pwa/antcv-roles-richblock-adapter.js` — `renderRoleHead` always-flex + justifyContent.
- `pwa/antcv-item-align.js` — role-line justifyContent applier; group-head justify→left.
- `pwa/antcv-section-panel-211.js` — `applyPreviewHeadlines()`; panel wrap CSS.
- `pwa/antcv-section-align.js` — headline-loc bridge (211 is authoritative).

## Open issues → see ACTIVE_BUGS.md (CJLR section) and memory roles-as-richblock-migration.
Profile per-row not responding; education per-row missing (structured section); worker
export parity for all 1184–1225 CJLR wins; focus-table justify gap watch; panel-211 ☰
ordering; E cutover pending.

## Discipline notes
- Heavy origin churn from parallel sessions — rebased forward repeatedly; resolved
  minified-`app.js` conflicts by taking origin then re-applying the two surgical edits, and
  version-file conflicts by taking the higher version + folding the previous TARGET into
  STALE. Windows worktree `rebase-merge` cleanup warnings are benign (rm the dir + continue).
- Live verification done in the in-app Browser pane (Bash sandbox can't reach the live site);
  cleared SW + caches before each reload to defeat the stale-SW version mask.

## Continuation 2026-07-15 — E cutover + export pagination

### 1.51.1264 — E CUTOVER (roles-as-rich_block is now DEFAULT)
Owner: "E is approved — do it." `AntcvRolesRichBlock.isOn()` flipped opt-in (`flag==='1'`) →
default-on (`flag!=='0'`); flag kept as a `'0'` rollback. Verified live with the flag REMOVED:
experience renders as rich_block (role heads + role-lines + 64 bullets, editable), NO
double-render, stored `roles[]` intact + `items[]` empty + no `__fromRoles` residue → EXPORT
reads roles[] unaffected. Chimera dead-code retained as the rollback (deletion deferred).

### 1.51.1265 — AUTOPAGES-ITEM-TO-ROLE-001 (cutover export regression)
The cutover flattened experience to items[], so the autoPages measurer keyed page-breaks by
ITEM index (13/36/66) while the docx-client read them by ROLE index (0..N) → no role.page →
worker never split roles / emitted "(Cont.)" → columns collapsed to sequential → 8-page PDF
(preview 3). Fix: adapter `itemAutoPagesToRoleAutoPages()` maps item-break → containing role
via `item._key`; docx-client calls it in the experience case gated on `isOn()`. Validated
live: `{13:2,36:3,66:4}` → `{1:2,4:3,10:4}`. Export 8→6 pages, cont-headers + parallel
sidebar restored.

### Export evaluation (6-page PDF) + routing
- Under-role line now exports for every role (docx-worker 1.14.157, deployed) — closes the
  "line in preview but not export" complaint.
- Remaining, ROUTED to the "Density frontier → 97.5%" session (owner-approved): (a) preview↔
  export line-drift (3 vs 4 pp — measurer vs Word line counts); (b) sidebar group-swap /
  page-fill pack (reorder overflowing sidebar groups long+short on page 1; NOT a mid-group
  split; must apply in preview AND docx-worker for parity).

### Spawn status — CORRECTED
A "0-commits-ahead + clean worktree" reads identically to "stalled" and to "work MERGED to
main" — I misread merged spawns as stalled and over-nudged. Actual status:
- **Profile per-row CJLR = NOT A BUG** — cycler works; the "doesn't respond" was a stale
  service worker serving pre-1.51.1065 app.js. Clear SW; no code change.
- **Education per-row CJLR** — landed (preview 1.51.1424 + worker export 1.14.160, test-locked).
- **Worker CJLR export parity** — landed (docx-worker 1.14.156-159).
LESSON: to judge a spawn's progress, check whether its feature is in `main` (by commit/feature),
NOT the worktree's ahead-count — a merged worktree is 0-ahead + clean.

### Deploy status — all live
PWA auto-deploys on push (main 1.51.1484). docx-worker 1.14.160 manually deployed via
`workflow_dispatch` (`deploy-worker` job, 23:19 UTC, after the 1.14.160 commit).
