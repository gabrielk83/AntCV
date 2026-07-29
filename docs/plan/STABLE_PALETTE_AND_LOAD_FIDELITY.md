# Stable Palette Architecture + Full-Fidelity Save/Load

Owner-approved rebuild (2026-07-21). Do the **palette architecture first**, then the Copenhagen Modern
visual redesign + v5 Nordic Minimal writing update in the next pass (see memory
`copenhagen-modern-refresh-and-palette-first`). This doc covers two coupled workstreams that share one
principle: **one resolved source of truth per thing, feeding BOTH preview and export.**

---

## Part A — Stable palette (colours must not "stick"; switch instantly; no leak)

### Diagnosis (confirmed in code)
1. **Active palette rides on GLOBAL state that is never cleared.** The paper wrapper
   (`pwa/app.src.js:51030-51054`) sets the CSS custom properties (`--header-bg`, `--sidebar-bg`,
   `--brand-accent`, `--header-name-color`, `--brand-slogan-color`, …) from the **global** key
   `antcv:brandV2`, gated on the runtime flag `window.__antcvBrandFit`. There is **no
   `removeItem("antcv:brandV2")` anywhere**, and no code forces the flag false on app switch. Open a
   branded app → globals set → open a non-branded app → previous brand still paints. **This is the leak.**
2. **~5 unsynced copies of every colour:** `meta.styleConfig` (per-app legacy: navyColor / headerBg /
   headerNameColor / sidebarBg / accent / aiNoticeColor / sloganColor / signatureColor), `meta.brandV2`
   (per-app v2 slots), `antcv:brandV2` (global), the CSS vars, and the docx meta. A write to one does
   not update the others → drift.
3. **Preview ≠ export:** preview reads the CSS var (from global `antcv:brandV2`); export reads
   per-package tokens / meta (see memory `preview-palette-band-source`). They can disagree.
4. **cloud-restore clobbers** loose style keys (memory `sidecar-prefs-clobber-hazard`).

Existing clean model to build on: `brandV2.slots = { headerBg, headerInk, sidebarBg, accent,
aiNoticeColor, sloganColor, signatureColor }`.

### Target architecture
- **Single source of truth = the ACTIVE APP's `meta.brandV2`** (`{ slots, branded: true|false }`).
  Unbranded → slots resolve from the package default.
- **One pure resolver** `resolveActivePalette(appMeta, packageId) -> slots`:
  `PALETTES[packageId]` (package default) ← overlaid by brand `slots` (if `branded`) ← overlaid by any
  per-app user override. No side effects.
- **One bridge:** the paper wrapper sets **all** CSS vars **unconditionally** from `resolveActivePalette()`
  (drop the `__antcvBrandFit` gate — branded-vs-default is decided *inside* the resolver). Package
  defaults now flow through the same vars as brands, killing the "unset var → hardcoded fallback" path
  and the preview/export split.
- **Export uses the same resolver** (PDF srcdoc header + `antcv-docx-client.js`) → preview == export by
  construction.
- **Switching = one write** to the active app's `meta.brandV2` + re-render. Nothing global to clear,
  because the bridge always re-derives from the *active app*. Any retained global (`antcv:brandV2`) is a
  **derived cache** rewritten on EVERY app switch (or removed), never authoritative.

### Migration stages (each independently shippable + verifiable)
1. **`PALETTES[packageId]` map** — formalize per-package defaults (copenhagen-modern, navy-executive,
   warm-terracotta, nordic-frost, pampas-contemporary), each a full 7-slot set. Source current values
   from the existing per-package tables (~`app.src.js:20108/20251`) + the `var(--x, DEFAULT)` fallbacks.
2. **`resolveActivePalette()` + unconditional bridge** — highest-leverage, lowest-risk. Paper wrapper
   (51030-51054) reads the resolver for every slot, always. (STAGE 1-2 = first ship, verify live.)
3. **Export parity** — route PDF srcdoc header/sidebar colours and `antcv-docx-client.js` meta through
   the same resolver.
4. **Load/switch derivation** — on app load/switch, derive palette from `meta.brandV2`; stop treating
   `navyColor` / global `styleConfig` / `antcv:brandV2` as authoritative (keep read-only shims for old
   records; write `antcv:brandV2` only as a derived cache, overwritten every switch).
5. **Brand-clear** — checkbox off sets `meta.branded=false` → resolver falls to package default (no
   stale global to clear).
6. **cloud-restore** — carry `meta.brandV2` per-app; never let a global overwrite it. Remove the loose
   style keys from the restore clobber path.

---

## Part B — Full-fidelity save/load (owner 2026-07-21)

**Requirement:** saving then loading an application must restore **all** CV, CL, and JD-analysis
sections, **fully LIVE** — never a templated/unexecuted placeholder, never a mix of live + template,
never "visible in preview but empty in export" (e.g. slogan). Every subsection is live or intentionally
hidden — never skeleton.

### Three integrity properties
1. **Completeness** — load restores every store the app owns:
   - CV sections (`application.cv_sections`), CL sections (`application.cl_sections`),
   - JD analysis = THREE stores (memory `analysis-panel-data-model`): `rationale`, `gapState_*`,
     `applicationQuestions`,
   - identity/meta (`meta`: company/role/subtitle/cl_slogan/styleConfig/brandV2), standalone keys
     (slogan/signature/etc.).
   A load that restores CV but leaves stale analysis (or vice-versa) is a bug.
2. **Liveness** — after load, no section may contain an **unexecuted template placeholder**
   (`/^\[\s*Specialis/i`, `[Domain expertise …]`, `fokusområder`, any `^\[…\]$` skeleton). If a
   placeholder is present it means generation never filled that slot — surface it (a "needs regenerate"
   marker), do NOT silently render the skeleton as if it were content.
3. **Parity** — every subsection renders from the **same resolved source** in preview and export. The
   slogan/subtitle bug class exists because preview and export read *different* chains (override key vs
   `io.subtitle` vs kernelShowcase — see 1.51.1558 gates + memories `subtitle-lang-source`,
   `cl-slogan-signature-standalone-keys`, `export-sanitize-and-preview-parity`). Fix = a single
   `resolveSlogan()` / `resolveSubtitle()` / `resolveSection()` used by BOTH surfaces (same pattern as
   `resolveActivePalette`).

### Approach (mirrors Part A)
- **Content resolvers**: one function per contested field (slogan, subtitle, each section) that both
  the preview render and the export (srcdoc + docx-client) call. No surface re-implements the fallback
  chain. (1.51.1558 already unified the slogan `io.subtitle` gate across the 3 sites — extend that to a
  named shared resolver.)
- **Load audit / liveness guard**: on load, run a completeness+liveness check over cv/cl/analysis; if a
  required store is missing or a placeholder survived, flag it (console + a non-destructive UI marker),
  never fabricate. Ties into the kernel floor (memory `kernel-recovery-and-floor`) which restores the
  `me()` skeleton — the audit distinguishes "intentionally hidden" (`on:false`) from
  "templated/unexecuted".
- **Round-trip test**: a headless save→load→diff harness asserting cv/cl/analysis are byte-equal after a
  round trip and that no placeholder regex matches any rendered subsection, for a branded and an
  unbranded app, preview and export.

### Stages
B1. Inventory every load path (topbar load, tracker Open, cold-restore, read-from-cloud) and every
    store each does/doesn't restore — produce the gap table.
B2. Shared content resolvers (slogan/subtitle first — highest-visibility parity bug), used by preview +
    both exports.
B3. Load audit + liveness guard (flag placeholders + missing stores; no silent skeletons).
B4. Round-trip fidelity test in the headless suite.

---

## Sequencing & verification
- Ship **A1-A2** first (resolver + unconditional bridge), verify live on antcv.pages.dev (switch a
  branded ↔ unbranded app, confirm no stick; preview band == export band), then check back before A3-A6.
- Part B interleaves after the palette bridge lands (same resolver pattern; B2 slogan/subtitle resolver
  can piggy-back on the 1.51.1558 work).
- All changes follow CLAUDE.md: edit minified `app.js` + mirror `app.src.js`, cache-bust quartet,
  shift-claim a lane, verify live, one deployer at a time.
