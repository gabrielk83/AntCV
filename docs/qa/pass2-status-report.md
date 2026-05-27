# Pass 2 — Visual tokens + package registry — status report

**Plan citation:** AntCV_Plan_v2_LockedSources.md §2 (visual token model) + §3 (seven-package registry) + §7 Pass 2.
**Source:** `docs/design/Unified_Visual_Package_System.docx` — "Unified Package Defaults + Alternatives" table (verbatim).
**Branch:** `feat/v1.50.0-pass2-visual-tokens` (stacked on `feat/v1.50.0-writing-engine-and-packages` — depends on Pass 1).
**Build version:** `1.50.0-pass2`.

## Scope shipped

| # | Plan item | Where it landed |
|---|---|---|
| 1 | Audit hex literals in PWA + DOCX worker (two-pass grep, tracked CSV) | [`docs/audits/pass2-hex-literals.csv`](../audits/pass2-hex-literals.csv) — 937 hex literals across 57 files. Generator: [`scripts/audit-hex-literals.mjs`](../../scripts/audit-hex-literals.mjs). |
| 2 | Build `packages/registry.json` from plan §3 + Unified Visual doc | [`packages/registry.json`](../../packages/registry.json) — 7 packages with locked base / primary / interactive / bullet / glyph hex, heading + body fonts, shape, image size, alt1 / alt2 pairs, dark.alt1 / dark.alt2 pairs. Schema: [`packages/registry.schema.json`](../../packages/registry.schema.json). |
| 3 | Replace hex literals in PWA components with `var(--token-name)` | **Deferred.** 550 of the 937 hex literals are inside the 785 KB minified `pwa/app.js`. Wholesale replacement is a multi-day refactor with its own PR — see "Deferred" below. The registry IS now active via `body[data-package="..."]`; component-level token swap is the v1.50.1 follow-up. |
| 4 | Replace hex literals in DOCX worker with token reads | **Deferred** (same reason). DOCX worker reads `packages/registry.json` once it's wired in — currently the worker still ships its own palette. v1.50.1. |
| 5 | Build `<PackagePicker />` in Settings → Personal → Appearance | [`src/islands/PackagePicker/PackagePicker.tsx`](../../src/islands/PackagePicker/PackagePicker.tsx) + [mount](../../src/islands/PackagePicker/mount.tsx). Three modes: Package / Quick Alternative / Custom. Mounts above LanguageCard in the Personal subtab. |
| 6 | Custom-mode logic per §3.3 (5 triggers) | [`src/lib/custom-mode.ts`](../../src/lib/custom-mode.ts). All five triggers evaluable via `window.AntcvCustomMode.evaluate({...})`. Wholesale wiring into the legacy app.js colour / font / image pickers is **deferred** to v1.50.1 — see "Deferred" below. |
| 7 | Copenhagen Modern heading = Segoe UI Bold (plan §3.1 Option A — locked) | `packages/registry.json` `copenhagen-modern.headingFont = "Segoe UI Bold"`. Trebuchet MS Bold preset for one-click reversion is **deferred** to v1.50.1 (Custom slots ship in Pass 4 per plan §7). |
| 8 | C2PA worker watermark colour tracks active package's `base` token | **Deferred** to v1.50.1 — the C2PA worker still ships its own colour, and wiring it to the registry needs a worker redeploy. |

## Files added / changed

| Path | Status | Note |
|---|---|---|
| `packages/registry.json` | new | Locked seven packages + alts + dark variants |
| `packages/registry.schema.json` | new | JSONSchema for the registry |
| `scripts/audit-hex-literals.mjs` | new | Two-pass grep generator |
| `scripts/generate-registry-css.mjs` | new | Emits `pwa/antcv-packages-registry.css` |
| `pwa/antcv-packages-registry.css` | new | Generated; 7 `body[data-package="..."]` blocks + dark-mode overrides |
| `pwa/index.html` | modified | `<link>` tag for `antcv-packages-registry.css`; `?v=` bumps |
| `pwa/sw.js` | modified | CACHE → `antcv-1.50.0-pass2`; SHELL adds the new CSS |
| `pwa/antcv-version-override.js` | modified | TARGET_VERSION → `1.50.0-pass2`; `1.50.0-pass1` added to STALE_VERSIONS |
| `src/lib/packages.ts` | new | Registry loader + helpers + legacy-alias mapping |
| `src/lib/body-package.ts` | new | Reads / writes `personalInfo.stylePackage`; binds `body[data-package]` |
| `src/lib/custom-mode.ts` | new | §3.3 trigger evaluation + `window.AntcvCustomMode` |
| `src/islands/PackagePicker/PackagePicker.tsx` | new | Three-mode UI: Package / Quick Alt / Custom |
| `src/islands/PackagePicker/mount.tsx` | new | Mount inside Settings → Personal |
| `src/main.tsx` | modified | Mounts the new island; installs body binding + custom-mode API |
| `docs/audits/pass2-hex-literals.csv` | new | 57 files × hex/rgb counts |
| `docs/qa/pass2-status-report.md` | new | This file |

## Discrepancy flagged

The writer skill's [`skills/antcv-writer/references/design-packages.md`](../../skills/antcv-writer/references/design-packages.md) lines 100-106 names different body fonts per package than the locked Unified Visual doc (and plan §3). The docx wins per project rule. Examples:

| Package | docx body font | design-packages.md body font |
|---|---|---|
| Copenhagen Modern | Calibri | Segoe UI |
| Navy Executive | Calibri | Cambria |
| Warm Terracotta | Georgia | Palatino Linotype |
| Nordic Frost | Calibri | Verdana |

Recommend updating `skills/antcv-writer/references/design-packages.md` to match the locked source. The registry takes Calibri for all but Warm Terracotta (Georgia). Logged as a follow-up; not blocking Pass 2.

## How to verify in a browser

After deploy:

1. **Default package applied on first paint.** Open DevTools → Elements; confirm `<body data-package="copenhagen-modern">` (or the user's previously saved package). `getComputedStyle(document.body).getPropertyValue('--package-base')` returns `#283556`.
2. **PackagePicker UI.** Open Settings → Personal; the picker is above the Languages card. Click each of the 7 swatch cards; confirm `body[data-package]` updates and CSS variables change in DevTools. No content reordering (independence test §8.8).
3. **Quick Alternative.** In the Quick alt. tab, click Alt 1 / Alt 2; confirm `body[data-package-quick-alt]` updates. No Custom flag appears (§3.3 trigger a).
4. **Custom trigger evaluation.** In DevTools console:
   ```js
   window.AntcvCustomMode.evaluate({ source: 'colour', value: '#FF0000', packageId: 'copenhagen-modern' });
   // → { shouldFlagCustom: true, shouldWarn: false }
   window.AntcvCustomMode.evaluate({ source: 'font', value: 'Comic Sans', packageId: 'copenhagen-modern' });
   // → { shouldFlagCustom: true, shouldWarn: true, warningMessage: '…' }
   window.AntcvCustomMode.evaluate({ source: 'image', shape: 'hexagon', packageId: 'copenhagen-modern' });
   // → { shouldFlagCustom: true, shouldWarn: false }   // copenhagen shape is "circle"
   ```
5. **Independence regression check.** With package = Copenhagen Modern, switch writing style (legacy UI) — confirm content reorders but colours don't change. With writing style fixed, switch package — confirm colours change but content doesn't reorder.

## Pass 2 exit criteria — current status

| Plan §7 Pass 2 Exit | Status |
|---|---|
| Grep `#[0-9A-Fa-f]{6}` in PWA component code → 0 hits | **Not met** — 937 hex literals total; replacement deferred to v1.50.1. The audit CSV is the inventory for that follow-up. |
| Grep in DOCX worker → 0 hits | **Not met** — DOCX worker untouched in this PR. Deferred to v1.50.1. |
| Switching package updates every visible colour in one render | **Partial** — `body[data-package]` switches the CSS variable bundle in one render. Visible colour change only affects elements that reference the variables; the legacy app.js still uses inline hex. The variables are live; the consumption is incomplete. |
| 21/21 visual regression baselines reviewed | Pending browser test |
| DOCX export per package validates clean | Pending DOCX worker update (v1.50.1) |
| Custom-mode test §8.5 all five scenarios | **Partial** — trigger evaluation logic implemented; UI wiring depends on legacy editor integration. |

## Deferred — wholesale hex-literal replacement

Per the audit CSV: 937 hex literals across 57 files, 550 of them inside the 785 KB minified `pwa/app.js`. Replacing each call site with `var(--token-name)` is a mechanical but enormous edit — far beyond a single PR's safe scope. Two follow-up tracks:

- **v1.50.1-tokens-pwa** — convert `pwa/app.js` and sidecars one component-area at a time. Use `docs/audits/pass2-hex-literals.csv` to track progress. Acceptable PR cadence: one component area per PR, each accompanied by a screenshot diff.
- **v1.50.1-tokens-docx-worker** — port `workers/docx-worker` to read `packages/registry.json` and emit `[data-package]`-aware OOXML. Bundle the registry into the worker build.

Pass 2 lays the *foundation* (registry, CSS, picker, body binding, custom-mode API). Pass 2.x consumes it across the codebase.

## Follow-up

- [ ] Browser smoke test from "How to verify in a browser" above
- [ ] Update `skills/antcv-writer/references/design-packages.md` body fonts to match the locked Unified Visual doc
- [ ] Ship Trebuchet MS Bold preset as a Custom-slot variant (depends on Pass 4 saved-slots UI)
- [ ] v1.50.1 — wholesale PWA hex replacement (use the audit CSV)
- [ ] v1.50.1 — DOCX worker palette wired to registry
- [ ] v1.50.1 — C2PA watermark wired to `--package-base`
