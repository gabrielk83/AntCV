# AntCV — Next session handoff (2026-06-29)

## ► COPY-PASTE NEW-SESSION PROMPT
> AntCV — continue from `docs/qa/NEXT_SESSION_2026-06-29.md` (PWA **1.50.969**, docx-worker **1.14.97**,
> access-relay **1.3.2**, suite 521/521). SYNC FIRST (`git fetch && git pull --rebase origin main`).
> Read that handoff + MEMORY.md ([[data-loss-on-restore]], [[sidebar-fill-gap-is-antiblank-slack]],
> [[pagination-two-map-and-worker-test]], [[docx-worker-bundle-no-build]], [[minified-mirror-shadow-hazard]]).
> There is **NO local renderer** here — docx pagination/header fixes are verified STRUCTURALLY via the
> worker node harness; PIXELS need the owner's real CloudConvert export. The top open item is the
> **CV 3-page convergence (A)** + the **candidate-header contacts-spread-left (B)** — they share ONE
> root: the page-1 photo-header bridge uses a different column grid than pages 2-3. Fix them together
> in `workers/docx-worker/src/index.js` (finer/separate header grid + equal page-table grids + drop the
> photo-path trailing break), ship FLAG-GATED if needed, owner verifies the export. Then the export-only
> pagination parity (E) and the floating-spine spine fill.
> ALSO (owner "do not forget", NOT render-gated — section "OPEN — COVER-LETTER FORMAT SETTINGS"):
> **F1 DONE** (SLOGAN-CL-EDIT-001, 1.50.969 — editable slogan section + control, standalone keys,
> read in preview/export/worker). **F2 already shipped** (antcv-bring-to-rich-block-761, Nordic-scoped).
> **F3** still open: surface the signature control as a subsection in the CL format panel (today it's
> under Layout's PROFILE PHOTO — the slogan control now mounts beside it, forming a CL cluster).
> One verified fix at a time; cache-bust quintet; worker deploy via deploy.yml.

---

**Current state:** PWA **1.50.969**, docx-worker **1.14.97**, access-relay **1.3.2**, unit suite 521/521.
SYNC FIRST (`git fetch && git pull --rebase origin main`). Cache-bust quintet on every loaded PWA file;
`app.js` is the minified mirror of `app.src.js` (surgical count-guarded edits). Worker deploy =
`gh workflow run deploy.yml -f target=docx-worker -f mode=deploy -f confirm=docx-worker`.

NO LOCAL RENDERER here (no LibreOffice; Office is Word, not CloudConvert's engine). Pagination/layout
fixes can be STRUCTURALLY verified by driving the worker in node + inspecting `word/document.xml`, but
their PIXEL result needs the owner to export a real CloudConvert PDF. Don't ship blind render changes.

---

## OPEN — NORDIC CL TEMPLATE (owner 2026-06-29, `CoverLetter_Template.docx`) — IN PROGRESS

Owner gave a new CL template to enforce as the **Nordic-Minimal default** (changeable later) across
structure, generation, section order, the settings panel, the preview, and the export output.

**Locked model** (all rich_block, headline hidden, unless noted), body order:
1. **positioning** = the F1 slogan (top-of-body tagline, align supported) — NOT a separate section.
2. greeting (text) — "Dear [Hiring Team / Name],"
3. opening — "I am applying for [Role] at [Company]…"
4. **why** — lead-in "Why this company and role:" + body
5. **who** — lead-in "Who I am:" + body
6. **foundation** — 3 rows: "Foundation:" (paragraph) · "Hands-on:" (bullet) · "Professionally:" (bullet)
7. **bring** — NO heading, lead-in "What I bring:" + **4 visible bullets** `[Need]: [action]`
8. **contribute** — intro "How I would contribute:" + 4 bullets + **"Goal:" closing** line
9. closure (text)
- sign-off: "At your service," → name → signature (existing). **AI notice: KEEP CURRENT format**
  (the template's pasted AI line was a mistake — ignore it).

**Phase 1 DONE (1.50.971)** — `antcv-nordic-cl-order-971.js` enforces the ORDER on live cl + makes
bring data-rows visible bullets. Layers on the existing converters (foundation-758 already gives the
3-row foundation; bring-761; hwic-760). Verified.

**Phase 2 DONE (1.50.973)** — me() CL skeleton is GATED on Nordic: `cl: GATE ? [nordic] : [legacy]`
(app.src.js + app.js mirror), so the admin-tab Export-template (derives from me(), renders raw) now
shows the new order + rich_block structure + the template's placeholder content. Non-Nordic =
legacy byte-identical (zero risk). Verified: app.js boots clean, Nordic vs legacy order, template-derive
guard. Fixes the owner's ORIGINAL "admin templates missing elements" complaint.

**Phase 3 DONE (1.50.974, structural)** — the Nordic order sidecar now adds the "Goal:" lead-in to a
GENERATED contribute's closing row (me() already seeds it). Positioning = the F1 slogan (no separate
section -> no dup). AI notice = current format (unchanged, per owner).

**SIGN-OFF NAME DONE (1.50.975 / worker 1.14.99 / relay 1.3.5) — CL-SIGNNAME-001.** The sign-off NAME
is now editable (`antcv:clSignName`, default = first word of the full name, e.g. "Gabriel") with its OWN
CJLR (`antcv:clSignNameAlign`, default CENTER), independent of the signature (was NAME-FOLLOWS-SIG). The
header band name is unchanged. Control: "Sign-off name" input + L/C/R in the CL control. Read at the 4
sign-off sites + worker via `meta.cl_sign_name`/`_align`; cloud-persist (relay + cl-cloud-sync MAP).
Verified worker 4/4 + boot-smoke. See [[cl-slogan-signature-standalone-keys]].

**REMAINING — B: adapt the CL GENERATION prompt + C: consensus.** UNVERIFIABLE in this harness (no LLM)
— ship with the OWNER reviewing a real generation; the STRUCTURE is already enforced post-generation
(me() + sidecars reshape any output), so this is CONTENT-quality, not a blocker.
- **B (sites):** the CL output schema/prompt at app.src.js **23816 / 23992 / 24042** (who_content,
  why_content, `bring_rows`, contribute_items, foundation_hands_on, foundation_professionally) + the
  interlocking table rules **~2944-2982** (TABLES-DISTINCT-001, FOCUS-LABELS-001, TABLE-DIRECTION-001
  — these treat WHAT I BRING as a Focus-Area/Expertise TABLE vs the CV CORE COMPETENCIES). Update to the
  new shape: positioning line; why/who lead-in paragraphs; foundation = Foundation + Hands-on +
  Professionally; **bring = "[Need from JD]: [matching action]" rows** (not Focus Area/Expertise);
  contribute = intro + 4 actions + **Goal:**. Mirror to app.js. Reconcile the table-distinctness rules
  (bring is no longer a Focus-Area table — it's JD-need:action, which is already distinct from core_comp).
- **C (consensus):** the consensus POLL (app.src.js **~25711**, task `consensus_poll`) polls 2+ LLMs and
  returns 5-8 **JD signals** (what the JD asks for). Wire those signals into the new bring "[Need from
  JD]" rows + the contribute "[Specific Lead from JD]" actions, so the consensus output drives the
  new-format content. (`consensus_reinforce` at 1767/1851 is the other consensus task.)
- Authoritative template content: `docs/qa/nordic-cl-template-2026-06-29.md`.

---

## SHIPPED THIS SESSION (2026-06-29 later) — verified, suite/boot/worker green

- **1.50.972 / worker 1.14.98 / relay 1.3.4 — CL-CLOSING-EDIT-001.** Sign-off closing was hardcoded
  "Kind regards," (reverted the owner's "At your service,"). Now EN default = **"At your service,"**
  (da/es/zh keep theirs), editable via standalone key `antcv:clClosing` (persists: relay allowlist +
  cl-cloud-sync MAP + a "Sign-off closing" input in the CL control). Read at all 4 sign-off sites
  (srcdoc + React×2 + inline-docx fallback + worker via `meta.cl_closing`). Verified worker 3/3 +
  boot-smoke. See [[cl-slogan-signature-standalone-keys]].
- **1.50.971-974 — NORDIC-CL-TEMPLATE-001 phases 1-3.** Live CL + admin template + generated CL all
  follow the owner's new Nordic template (order greeting→opening→why→who→foundation→bring→contribute→
  closure; rich_block lead-ins; foundation 3-row w/ Hands-on/Professionally bullets; bring no-heading
  lead + 4 bullets; contribute intro+bullets+Goal). me() Nordic-gated (1.50.973); order/bullets/Goal
  sidecar (971/974). Only the generation prompt CONTENT remains (refinement). See the section above.
- **1.50.970 / access-relay 1.3.3 — CL-SIG-SLOGAN-CLOUD-001.** The CL signature + editable slogan now
  cloud-persist (were local-only; lost on hard reset). Allowlisted their camelCase forms in the relay
  `KERNEL_PREFS_STR_FIELDS` + new sidecar `antcv-cl-cloud-sync-extra.js` (push via `_antcvCloudWrite`,
  restore via GET `j.prefs`, apply only when locally missing). See [[cl-slogan-signature-standalone-keys]].
  NOTE: a signature uploaded BEFORE this deploy must be re-uploaded once to push it to the cloud.
- **1.50.969 / worker 1.14.97 — SLOGAN-CL-EDIT-001 (F1).** The CL slogan is now EDITABLE instead of
  silently derived from `meta.subtitle`. New control sidecar `antcv-cl-slogan-control.js` (text / hide /
  align), mounted once after the CL signature control in Layout (CL-format cluster). Standalone,
  cloud-restore-safe keys: `antcv:clSlogan` (override; empty -> subtitle fallback), `antcv:clSloganHidden`,
  `antcv:clSloganAlign` (default center). Read at all 3 sites: export srcdoc CL branch (app.src.js + app.js
  mirror), the React on-screen CL preview (slogan element now rendered — was export-only), and the worker
  `buildLinearDocument` `__slogan` block via `antcv-docx-client` `meta.slogan` / `slogan_hidden` /
  `slogan_align`. Backward-compatible (old/absent override -> subtitle). Verified: unit 521/521; worker
  `diag-cl-slogan-override` 3/3 + `diag-cl-slogan-sig` 2/2; real-Chromium boot-smoke (app.js boots, both
  sidecars register, resolver correct for fallback/override/hidden/align). Worker deployed via deploy.yml.
- **F2 was already shipped** (before this session): `antcv-bring-to-rich-block-761.js` (1.50.963/964)
  converts WHAT I BRING table -> rich_block, scoped to Nordic-Minimal (the owner's style). If the owner
  wants it for ALL styles, widen the `isNordicMinimal()` gate. Verify on a real Nordic CL.

## SHIPPED EARLIER (2026-06-28/29) — all verified, suite/boot green

- **access-relay 1.3.2 — GEN-CONTAMINATION-PRESERVE-DRAFTS-001** (CRITICAL data loss). `/api/prefs/
  wipe-generated` blanket-nulled EVERY saved app's cv/cl_sections on a full regen; scoped to the ACTIVE
  app only. Verified live (3 of 4 of the owner's saved apps had been nulled) + `diag-wipe-generated-
  preserves-drafts.mjs` 4/4. See [[data-loss-on-restore]].
- **1.50.957 — DATA-LOSS-LOAD-GRACE-001.** Loading an empty/damaged saved app no longer blanks the
  editor into the me() template; keeps the current draft + shows a notice. Both switch sites (topbar +
  Settings) + app.js mirror. The 3 already-nulled drafts are UNRECOVERABLE — owner must regen them.
- **1.50.958 — TOOLS-PAGE1-BAND-001.** `SIDEBAR_PAGE1_BAND` 300→270. TOOLS & METHODS (627px) now fits
  page 1 (budget 624→654); CERTS still flows to page 2. Verified live (`autoPages.tools` = no break).
- **1.50.959 — CL-SIGNATURE-CONTROL-001.** Layout upload control (sidecar `antcv-cl-signature-
  control.js`, no app.js mirror) + CL-end preview `<img>` (app.src.js + app.js mirror). Export was
  already done (worker 1.14.93). End-to-end: upload PNG/JPG in Layout → CL preview + exported PDF.
- **1.50.960 / worker 1.14.94 — SLOGAN-CL-001 + NAME-FOLLOWS-SIG-001.** (1) A tagline heading at the
  top of the CL body (candidate subtitle uppercased; Gabriel unsolicited = "PROCESSES • PRODUCTS •
  PEOPLE", reuses meta.subtitle). (2) CL sign-off reordered to "Kind regards," → signature → typed
  name, and the name adopts the signature's CJLR alignment. Preview (app.src.js + app.js mirror) +
  worker buildLinearDocument; verified `diag-cl-slogan-sig.mjs` 2/2 + existing CL diags green.
- **1.50.961 — FORCE-LAST-GRP-SETTLE-001.** Environmental, Durability & Compliance now cuts to page 3.
  The `__forceLastGrpStick` cache re-applied on block-count alone, pinning a stale start page (after
  TOOLS freed page 2, regulatory now starts page 2). Fix: cache validity also requires the section's
  start page to match; re-evaluates on a genuine settle, dance-damping preserved. Verified LIVE
  (`autoPages.regulatory = {0:2,19:3}` → Environmental on page 3, stable across 5 re-measures, no dance).

---

## OPEN — COVER-LETTER FORMAT SETTINGS (owner 2026-06-29, "do not forget") — NOT render-gated

Owner wants these CL features promoted into the **cover-letter format settings panel** (the CL
Settings/format panel, not only the Layout tab). All three are preview-verifiable (no real export needed
for the control/preview; the export side for slogan + signature already ships — worker 1.14.94).

### F1. SLOGAN as an editable SECTION + a panel control — DONE (SLOGAN-CL-EDIT-001, 1.50.969 / worker 1.14.97)
Shipped via standalone keys (the signature-control pattern, not a sections-schema entry): `antcv:clSlogan`
(override; empty -> `meta.subtitle` fallback), `antcv:clSloganHidden`, `antcv:clSloganAlign`. New sidecar
`antcv-cl-slogan-control.js` (text/hide/align) mounts after the CL signature control. Read in the export
srcdoc, the React preview, and the worker (`meta.slogan*`). Original spec below for reference.

SLOGAN-CL-001 (1.50.960) currently DERIVES the slogan from `meta.subtitle` (uppercased) — there is no way
to edit the slogan text independently or hide it. Owner wants a real **slogan section** with its own
control in the CL format panel: editable text (default for Gabriel unsolicited = "PROCESSES • PRODUCTS •
PEOPLE"), show/hide, and (nice) alignment. Storage: a standalone key (e.g. `antcv:clSlogan` /
`antcv:clSloganHidden`) like the signature keys, OR a real CL section `{id:'slogan', type:'rich_block'/
heading}` that the builder reads. Builder reads it INSTEAD of `meta.subtitle` when present (subtitle stays
the fallback default). Touch: preview srcdoc builder (app.src.js CL branch — the slogan IIFE I inlined at
the top of the CL body td) + app.js mirror + worker `buildLinearDocument` (the `__slogan` block at the top
of `bodyChildren`) + a panel control sidecar (mirror the `antcv-cl-signature-control.js` pattern).

### F2. WHAT I BRING — default to rich_block (rich_context), not `table` — ALREADY SHIPPED (antcv-bring-to-rich-block-761, 1.50.963/964)
Done before this session, scoped to Nordic-Minimal (the owner's style): the sidecar converts the `bring`
table -> rich_block (header row dropped; each `[label,value]` -> `{b,t}`; `headlineOff:true`; idempotent +
late-settle timers for cloud-restore). Non-Nordic styles keep the table. To widen to ALL styles, relax the
`isNordicMinimal()` gate. Original spec below for reference.

The CL `bring` section is `type:"table"` (rows). Owner wants the DEFAULT to be `rich_block` (the universal
"rich_context" type), like the other CL sections already converted ([[rich-block-universal-section]]).
Add a migration sidecar (mirror `antcv-hwic-to-rich-block-760.js` / the bring is the LAST own-type CL
section besides greeting/closure) that converts `bring` table rows → rich_block items (each row's
`[label, value]` → a `{b:label, t:value}` row, or a grp+rows shape), idempotent + self-converging; and/or
change the me() skeleton + generation hydration to emit rich_block for `bring`. Verify preview + worker
render + the diag-full-doc-health. NOTE the bring table is referenced in CL width/closure logic — check
nothing reads `bring.rows` after conversion.

### F3. SIGNATURE control as a subsection in the CL format panel
The signature control (`antcv-cl-signature-control.js`, 1.50.959) currently injects under the PROFILE
PHOTO control in the **Layout** tab. Owner wants it ALSO/instead as a **subsection in the CL format
panel**. Either add a second mount target (the CL format panel) or move it there. Keep the single-mount /
own-marker / no-sticky-leak discipline (mount ONCE per panel; if mounted in two panels, guard each with a
distinct marker so neither leaks). Same standalone keys; no behavior change — just placement.

---

## OPEN — owner batch 2026-06-29 (late) — CL sign-off, compress, quick-gen, Professionally

### G. CL sign-off: order + CJLR + editable defaults
- Order must be **closing → name → signature** (signature AFTER the name). NOTE: NAME-FOLLOWS-SIG-001
  currently puts sig BEFORE name — REVERSE it. Sites: worker `buildLinearDocument` (move the sig
  Paragraph after the name), the React preview (`window.__antcvClSigEl` is dropped between closing &
  name today — move it after the name), and the export srcdoc `m`.
- **All three (closing, name, signature) share the SAME CJLR alignment** (the signature's align). The
  closing ("Kind regards,") is currently left-default — align it like the name+sig.
- **Editable defaults:** closing default = **"At your service,"** (was "Kind regards,"); sign-off NAME
  default = **"Gabriel"** (personal/short, NOT the full header name). Both EDITABLE. Add standalone keys
  (e.g. `antcv:clClosing`, `antcv:clSignName`) + small controls (mirror the signature control pattern in
  the Layout/CL panel) + read them in the React preview + worker + srcdoc. The header name stays the
  full name; only the SIGN-OFF name changes.

### H. rich_block not compressible ("Section type \"rich_block\" is not compressible here.")
Foundation is now rich_block; the per-section compress handler (app.src.js ~19749) supports
foundation/experience/table/labeled_list/list/education but NOT rich_block → it alerts + leaves a
"junk processing" state. FIX: add a `rich_block` branch — build `{id,type:'rich_block',items:[{b,t}]}`
(preserve b lead-ins / grp / mk; compress only the `t` bodies), add a rich_block compress prompt
(tighten `t`, keep b/grp/mk + numbers/tools/proper-nouns), map the result back to items[].t. Also fix
the error-path cleanup so a rejected/failed compress fully resets the processing state (no junk
spinner). app.src.js + app.js mirror.

### I. Quick generation — converge a 4-page kernel to ~1.5–2 pages
Owner: a QUICK generation that starts from the 4-page unsolicited kernel must HIDE irrelevant
positions + bullets + tools (on:false / hidden:true — NOT delete) to converge to a reasonable 1.5–2
pages. Today quick-gen keeps content essentially verbatim (no relevance pruning). Add a quick-gen
pruning pass (JD-relevance or recency/seniority when no JD): mark low-relevance roles on:false, trim
each kept role's bullets, hide off-topic tools/regulatory — to a page target. Generation-side
(app.src.js ~23820 __quickGen path) + the prompt. Substantial; spec + verify on a real quick-gen.

### K. Headline CJLR not working (body / main / Candidate) + missing on Rich_Content heading
Owner 2026-06-29: the headline alignment cycler (`data-antcv-headline-cjlr` / `data-antcv-align-cycler=
"headline"`, "MAIN headline alignment: left (click to cycle)") does not work, and the rich_block
(Rich_Content) heading has no CJLR control at all. Two root causes:
1. **Export gap (main):** the section-headline alignment lives in `antcv.sectionHeadlineAlignment.v1` and
   is applied PREVIEW-ONLY by sidecars `antcv-section-panel-208.js` / `-211.js` via injected CSS
   (`[data-antcv-section-title-211][data-antcv-title-align=…]{text-align:… !important}`). NOTHING reads it
   in `antcv-docx-client.js` or the worker → the headline alignment NEVER exports. FIX: forward the
   per-section headline align (by sid/loc) from the client + apply it to the worker's `headingParagraph`
   alignment (CV two-col headings + CL + candidate band). Render-gated for pixels.
2. **Preview button conflict / empty:** the cycler button carries `data-antcv-panel-action-207`,
   `-208`, AND `-211` (three panel sidecars contend for the same button) and can render with EMPTY text
   (the ⇤/glyph in `data-antcv-panel-label-211` isn't applied as the button's content) → invisible /
   non-cycling. FIX: make ONE sidecar own the headline cycler (de-dupe 207/208/211), ensure its glyph +
   click handler are set, and confirm it sets `data-antcv-title-align` on a `[data-antcv-section-title-211]`
   title element so the CSS applies. Verify the cycle actually changes the preview heading.
3. **Rich_Content heading CJLR:** the rich_block title currently has no headline cycler — give it one
   (it must get `data-antcv-section-title-211` + the cycler), separate from the existing per-row /
   `__group__` body CJLR (`antcvItemAlignment`) which already works.

### J. CL Foundation "Professionally" — no bold body
Owner: "Professionally does not need bold text immediately after it." The Hands-on lead-in dup is FIXED
(FOUNDATION-LEADIN-DEDUP-001, 1.50.968). For Professionally the body has no bold markers + the
rich_block render only bolds the lead-in `b` — so confirm with the owner what reads as bold (possibly
the bold teal lead-in "Professionally" itself, or a render colon-emphasis) and adjust (e.g. leadBold
off for that row, or don't emphasise the body's pre-colon clause).

## OPEN — TOP NEXT: kernel role bullets/results + Students-Council dup (owner 2026-06-29, explicit rules)

OWNER'S EXACT RULES for the fix (do these FIRST next session, carefully + verified — high-stakes kernel data):
1. **Dup = hide the BULLET, not the result.** When a role has no real outcome and the laminator derives the
   "Results:" line from a bullet, KEEP the result line and HIDE the source bullet (don't drop the result).
   A "dedup-hide below" ALREADY exists for the seeded-from-bullet case (`applyOutcomesMode`, docx-client
   ~2342-2347 "the dedup-hide below then removes the duplicate source bullet") but it is NOT firing for
   Students Council — find why (the bullet-fallback may not seed/pin an outcome for an outcome-less +
   proofPoint-less role, so there's nothing the dedup keys on) and make the bullet hide. Mirror in the
   preview laminator (app.src.js) for parity.
2. **Manual result stays SEPARATE from bullets.** If the owner adds a result manually, it must NOT
   overwrite/consume a bullet — result and bullet are independent fields. (i.e. role.results string is its
   own field; never promote-and-delete a bullet when a real result is present.)
3. **Students-Council result is "lost several times" — READ/PERSISTENCE bug.** The Council result keeps
   disappearing. Investigate the read/save path for role.results / role.outcomes on the council role (kernel
   D1 split + the laminator + any migration that strips it). This is the [[data-loss-on-restore]] class —
   confirm a written result PERSISTS across reload + regen.
4. **Write the owner's authoritative content** (owner OK'd) for the 3 roles into the kernel
   (personalInfo.workHistory bullets + role.results) AND verify it persists. Set role.results (tier-1
   verbatim, wins above all) so it laminates without deriving from a bullet:
   - CSA (Computer Systems Administrator | IDF, Communication Corps, 2001-2003): bullets = [Administer
     classified IT infrastructure… provisioning, hardware procurement, incident response, first-line
     support; Write documentation preserving continuity across commander rotations; Build the unit's first
     automated backup-and-restore procedure, cutting recovery time from hours to minutes; Train recruits on
     help-desk routines, access handling & recovery procedures]; result = "Support 100 users across 150
     machines in a classified construction centre, with documented access, support, and recovery workflows."
   - Team Operations Manager (foreningsarbejde) | Pan Idræt, 2023-present: bullets = [Manage logistics for
     ~25 players and coaches across Denmark and abroad; co-organise annual sports and social events; World
     Rugby Level 1 coach and assistant coach; handle practical team support (equipment, kit, storage,
     setup); Operations and assistant-coaching for Copenhagen Wolves RFC, an inclusive amateur rugby club
     under Pan Idræt]; result = "Coordinate a 25-player squad, 300-guest club events, and club
     representation with Rugby Danmark and IGR Europe."
   - Students Council Representative | Tel Aviv University, 2005-2007: bullets = [Represent EE students to
     faculty on curriculum and welfare matters; Coordinate between student body and academic staff to
     resolve issues]; result = "Modernised 15 outdated EE exam-preparation booklets with updated examples,
     cleaner coverage, and improved print quality."
   NOTE: setting role.results gives Council a REAL result → the laminator stops deriving from a bullet →
   resolves the dup at the source (rule 1 is then the robustness backstop for other outcome-less roles).
   CSA generation also dropped a bullet (kernel 3 → CV 2) — the kernel write + a regen restores it.

### Original capture:

Owner: 3 roles' bullets/results "not saved to the unsolicited Gabriel CV", esp. Students Council
"a bullet was chosen as result and both bullet and result are seen." Diagnosed on live data
(personalInfo.workHistory, 12 roles; proofPointsByRole 11; selectedOutcomes 22):
- **Students-Council DUP — root cause:** Council has **0 outcomes** in the kernel (`hasOutcomes:0`,
  no proofPoints). The per-role result lamination (role.results → outcomes[] → proofPointIds →
  best-match → DERIVE) falls through to DERIVING a result from a BULLET → the bullet shows as both a
  bullet AND the "Results:" line. FIX (tractable, benefits every outcome-less role): in the laminator
  (`applyOutcomesMode` — docx-client + the app.src.js preview), when the derived result has no REAL
  outcome source (no role.results / outcomes[] / proofPoint) OR equals/contains a visible bullet, DROP
  the result (or drop the duplicated bullet) so it never double-prints. Render-gated for the export.
- **Bullets/results content gap:** kernel CSA has 3 bullets (owner wants 4 — missing "Train recruits…"),
  Council 3 (owner wants 2 + a real result "Modernised 15 outdated EE exam-prep booklets…"), and the CV
  GENERATION dropped CSA 3→2. The kernel content ≠ the owner's authoritative set. SAFEST fix: owner sets
  the correct bullets + per-role Results via the experience editor (persists to the kernel + cloud), OR
  confirms the pasted text is authoritative and a session writes personalInfo.workHistory[bullets] +
  the per-role outcome/result for these 3 roles (then verify it survives a regen — this is the
  [[data-loss-on-restore]] class; confirm the save persists). Owner's authoritative content is in the
  2026-06-29 message (CSA 4 bullets + result; Ops 3 + result; Council 2 + "Modernised 15…").

## OPEN — TOP PRIORITY: candidate-header photo/text placement (owner 2026-06-29, precise measurements)

Owner gave exact target geometry (default 1.52" photo) for the bridge candidate header
(`docs`: "Location in sidebridge.docx"). The CURRENT bug (#6): the header's 2 cells get SNAPPED
to the BODY column grid `[sidebarW, mainW]` (sidebar 2.75"), so the candidate text starts at 2.75"
instead of 2.31" — too far right. The `sidebarW-540` pull-back (PDF-HEADER-LEFT-001) is overridden
by the table grid. FIX = a **3-column grid + gridSpan** so the header and body split at DIFFERENT
points (the handoff's "finer table grid" option), keeping ONE table (navy band + page-anchored
medallion unaffected — lower risk than a separate header table):

TARGET (inches → DXA @1440, PAGE_W=11906):
- left header cell **2.31"** = 3326 DXA · right header cell **5.97"** = 8580 · sidebar **2.75"** = 3960
  (`ctx.sidebarW`) · main 5.52" = 7946 (`mainW`) · photo **1.52"** · figure center **1.47" from left**
  = 2117 (→ medallion left = 1.47−0.76 = 0.71" = 1022) · picture & sidebar-text **0.27"** from top ·
  candidate band height **0.2"**.

PLAN (workers/docx-worker/src/index.js, buildTwoColumnDocument ~24832-24930):
1. `colWidths` (~24681) → 3 cols: `[HDR_L, sidebarW - HDR_L, mainW]`, `HDR_L = clamp(3326, 1200, sidebarW-200)`.
2. `makeSidebarCell` → add `columnSpan: 2` (spans col0+col1 = sidebarW); `makeMainCell` = col2 (mainW).
3. bridge `headerRow`: left cell width=HDR_L (col0, NO span); right cell `columnSpan: 2`, width=PAGE_W-HDR_L.
4. `makeSlimHeaderRow` + the non-bridge header cell: `columnSpan: 2` → `3`.
5. Medallion (Part 2): set the band-overlap photo's horizontal offset so the figure CENTER = 1.47"
   from the page left (left ≈ 1022 DXA/EMU) and top = 0.27" — in `buildPhotoParagraph` band-overlap.
VERIFY: structural diags (twocol-paged / ownerlike — table/cell counts + grid widths in document.xml)
catch a malformed grid; the PIXEL result (text at 2.31", figure at 1.47") needs the owner's real
CloudConvert export. Ship with the owner exporting to confirm each step. This is the #6 item.

## OPEN — RENDER-GATED (need the owner's real CloudConvert export to verify)

### A. [HIGH] CV 3-page convergence — tail (INTERESTS/ACCESSIBILITY/RECOMMENDATIONS) spills to page 4
Owner attached a hand-edited **`..._3page proper.docx`** that renders 3 pages with IDENTICAL text. A
structural diff (agent, 2026-06-29) found the 3-page version differs ONLY in layout mechanics:
1. **Removed a trailing empty `pageBreakBefore` paragraph** before the final `<w:sectPr>` (the direct
   4th-page driver in the owner's real export). NOTE: a clean no-photo CV does NOT reproduce this in the
   current worker (`test/diag-trailing-page.mjs`: 3 tables, 2 breaks, no trailing break) — so the stray
   break is tied to the PHOTO-HEADER page-1 path. Investigate the page-1 bridge/header branch of
   `buildTwoColumnDocument` for an extra `__pageBreakPara()` / empty render slot when a photo header is
   present.
2. **Equalized the page-table grids.** The hand-fix made every two-column page-table use the SAME
   `gridCol` pair `4230 / 7328` (tblW 11558). The owner's export had page-2 at `4320 / 7382` (11702) —
   WIDER — because the page-1 candidate-header bridge uses a 3-col grid (`3420 / 810 / 7676`) that
   doesn't match pages 2-3. Same root as issue B (header). Make all page-table grids identical.
3. **Structural model (the documented "page-anchored floating spine"):** the hand-fix converts the
   page-2/3 tables to floating text-anchored tables (`<w:tblpPr w:vertAnchor="text" w:tblpY="1"/>` +
   `<w:tblOverlap w:val="never"/>`) under a `<w:sectPr w:type="continuous"/>`, so they pack against the
   preceding content instead of each being pushed to a guaranteed inline page. This is the real fix and
   matches [[sidebar-fill-gap-is-antiblank-slack]]'s "page-anchored floating spine" direction. Larger
   rework — implement FLAG-GATED (default off, like `balanceOverflow`), structurally verify (`tblpPr`
   present), owner verifies the render, then default-on.
Extracted XML: scratchpad `current.xml` / `target.xml`; probe: `test/diag-trailing-page.mjs`.

### B. [HIGH] Candidate-header contacts not spread leftwards (export only; preview is correct) — issue #6
The bridge header's photo + text cells snap to the body column grid, so the contact line stays centered/
right instead of spreading left. Owner: "left-align is NOT the fix; the cells aren't actually separate."
Fix = a finer header grid (3 cols + gridSpan) OR a SEPARATE header table so the photo cell is genuinely
narrower and the contact line reclaims the width. `workers/docx-worker/src/index.js` bridge headerRow
(~24827) + the page-1 grid. This is the SAME page-1-grid mismatch feeding A.2 — fix together.

### C. Environmental, Durability & Compliance → page 3 — DONE (FORCE-LAST-GRP-SETTLE-001, 1.50.961, verified live)

### D. [MED] Change Request Lead role → page 1
Page-1 main through that role = 774px; export page-1 main holds ~744 (ROLE-ORPHAN-PAGE1-001 set
`MAIN_PDF_LINE_BONUS`=20 on THIS exact role to stop its bullets orphaning in the PDF). ~30px over. Owner
chose to TRIM one bullet (the longest: "Coordinated cross-team change requests… impact analysis across
optics, electronics, firmware, validation, suppliers…") rather than push the budget. Owner is doing the
trim in the editor. After trim, the role fits page 1 with no budget change.

### E. Lower-priority queue (carried)
- Export-only pagination PARITY (Recommendations/Interests/Accessibility land later in the PDF than the
  preview): `assembleColumn` (`buildTwoColumnDocument` ~24636) advances `running` only via
  `__firstPageOf` (a section's FIRST page) and never counts the INTERNAL `__antcvPB` markers that
  spanning sections (experience/split-lists/rich_block) emit — so a tail section's leading break is
  wrongly kept, landing it a page late. Fix: advance `running` by each section's internal break count.
  (Related to A — same column-assembly function.)
- Sidebar colored spine stops ~2cm short of the page bottom — DELIBERATE anti-blank-page slack; the real
  fix is the floating-spine (A.3). Do NOT raise the body-row mins ([[sidebar-fill-gap-is-antiblank-slack]]).
- "SW projects: AntCV" Additional-Info value should be a live hyperlink (markdown/URL → ExternalHyperlink).
- AI-notice → sidebar computed as the LAST step (post-pagination).

## DISCIPLINE
- A/B/E touch the docx worker and need a REAL CloudConvert export to verify pixels — ship structural
  changes flag-gated or with the owner exporting. C/D are coordinator-side and preview-verifiable.
- Worker has no build step ([[docx-worker-bundle-no-build]]); edit `src/index.js`. Deploy via deploy.yml.
