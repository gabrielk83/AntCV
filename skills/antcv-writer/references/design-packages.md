# Design Packages — visual axis of the AntCV output

Every AntCV deliverable is a 2D vector: **(writing_style, package)**. This reference covers the package axis. It is **orientation material**, not a runtime input — the skill does not need to read it on each call. Read once to understand the matrix and the independence contract.

The single source of truth for package values (hex codes, font names, shape, image size, alternative pairs, dark-mode variants) is `packages/registry.json` in the AntCV repo. This document describes character and contract — not values.

---

## The independence contract

From the locked-source plan §4.1:

> Per the source doc §AI Pipeline Step 7: changing writing style must not modify visual design tokens, fonts, image settings, or colour packages. Changing the package must not modify section order, content text, or section choice.

The independence test §8.8 enforces this:

- Switching writing style across all 12 with package fixed → screenshot diff should show **content reordering only**, no colour/font changes.
- Switching package across all 7 with style fixed → screenshot diff should show **colour/font changes only**, no content reordering.

Any cross-contamination is a fail. The skill enforces this from its side by:

1. **Never** emitting hex codes, font names, or visual style values in output.
2. **Never** changing section content based on the `package` input. The package field is provided for context but is not used to vary text.
3. **Never** changing section ordering or naming based on the `package` input. Order and naming are functions of `writing_style` and `target_use_case` only.

---

## The seven packages

Package values live in `packages/registry.json` per locked-source plan §3. The list below describes the **character** of each package and the typical positioning context — not the values.

| Package | Character | Typical context |
|---|---|---|
| **Copenhagen Modern** | Navy band with green and blue accents. Segoe UI Bold headings and Segoe UI body — unified Microsoft system font family. Circular photo. The AntCV default. | Default for European and global commercial roles. Strong choice when no specific cultural fit is needed. |
| **Navy Executive** | Deep navy with gold accent. Cambria Bold headings and Cambria body — full-serif executive document. Rounded photo. | Senior commercial roles in finance, consulting, executive search. Conveys formality without stiffness. |
| **Warm Terracotta** | Earthy terracotta with deep brown accent. Georgia Bold headings, Palatino Linotype body — warm serif character throughout with parser-safe Microsoft system fonts. Rounded photo, slightly larger. | Humanities, creative industries, education, NGOs. Pairs naturally with narrative writing styles (Context Rich, Mediterranean Formal). |
| **Nordic Frost** | Cool blue with teal accent. Trebuchet MS Bold headings, Verdana body — humanist sans designed for screen reading. Circular photo. | Nordic-region applications, public sector, healthcare. Calm visual register. |
| **Pampas Contemporary** | Navy with terracotta accent. Palatino Linotype Bold headings and Palatino Linotype body — classical executive feel. Rounded-square photo. | LATAM-region applications, hybrid creative-commercial roles. Pairs naturally with Context Rich. |
| **Tokyo Precision** | Charcoal with cool grey-blue accent. Tahoma Bold headings and Tahoma body — geometric coherence. Square photo, smallest size (90 px). | Dense-information roles: engineering, research, technical product management. Maximises content density. |
| **Delhi Technical** | Navy with teal and bright teal accent. Segoe UI Bold headings and Segoe UI body — modern technical feel. Hexagon or square photo, also small (85 px). | Engineering, applied science, technical academic positions. Pairs naturally with Research Formal and Credential Forward. |

Each package also ships with two quick-alternative pairs (`alt1.head/sidebar`, `alt2.head/sidebar`) and dark-mode equivalents per the Unified Visual doc. These are visual variations within a package — not separate packages — and do not affect the (writing × package) matrix.

---

## The 2D matrix

Twelve writing styles × seven packages = **84 valid combinations**. All combinations are legitimate. The plan's independence test (§8.8) explicitly requires every combination to render correctly.

```
                Copenhagen  Navy      Warm       Nordic   Pampas        Tokyo      Delhi
                Modern      Executive Terracotta Frost    Contemporary  Precision  Technical
nordic-minimal         ✓        ✓        ✓        ✓        ✓        ✓        ✓
achievement-driven     ✓        ✓        ✓        ✓        ✓        ✓        ✓
measured-professional  ✓        ✓        ✓        ✓        ✓        ✓        ✓
structured-pro         ✓        ✓        ✓        ✓        ✓        ✓        ✓
mediterranean-formal   ✓        ✓        ✓        ✓        ✓        ✓        ✓
prestige-structured    ✓        ✓        ✓        ✓        ✓        ✓        ✓
credential-forward     ✓        ✓        ✓        ✓        ✓        ✓        ✓
precision-formal       ✓        ✓        ✓        ✓        ✓        ✓        ✓
context-rich           ✓        ✓        ✓        ✓        ✓        ✓        ✓
cold-outreach          ✓        ✓        ✓        ✓        ✓        ✓        ✓
research-formal        ✓        ✓        ✓        ✓        ✓        ✓        ✓
hybrid-balanced        ✓        ✓        ✓        ✓        ✓        ✓        ✓
```

---

## Recommended pairings

The PWA surfaces these as positive nudges during onboarding and whenever the user changes one axis. Format: "You've selected Achievement-Driven — consider Navy Executive or Tokyo Precision for visual weight that matches your content's impact-forward voice." The pairings are recommendations, not constraints — any of the 84 (style × package) combinations is valid.

For each writing style, a primary recommendation and an alternative for a different mood:

| Writing style | Primary recommendation | Alternative | Why this pairing |
|---|---|---|---|
| Nordic Minimal | Copenhagen Modern | Nordic Frost | Restraint on both axes — visual quiet matches written calm |
| Achievement-Driven | Navy Executive | Tokyo Precision | Strong visual weight matches outcome-forward content |
| Measured Professional | Copenhagen Modern | Nordic Frost | Quiet authority on both axes |
| Structured Professional | Tokyo Precision | Delhi Technical | Precision visual for process-driven content |
| Mediterranean Formal | Warm Terracotta | Pampas Contemporary | Warmer palette matches warmer register |
| Prestige Structured | Navy Executive | Copenhagen Modern | Institutional weight visually |
| Credential Forward | Delhi Technical | Copenhagen Modern | Technical visual for credential density |
| Precision Formal | Tokyo Precision | Copenhagen Modern | Geometric precision throughout |
| Context Rich | Warm Terracotta | Pampas Contemporary | Narrative register, narrative visual |
| Cold Outreach | Copenhagen Modern | Tokyo Precision | Clean visual for fast-scan content |
| Research Formal | Copenhagen Modern | Delhi Technical | Scientific register; both pair with publication-heavy CVs |
| Hybrid Balanced | (user-defined) | (user-defined) | User defines the pairing |

When the user picks a non-recommended combination, the PWA does not warn — it accepts the choice. The recommendation is a one-time nudge, not a recurring complaint.

---

## Font choices

Body fonts are matched per package to the heading font's typographic family. All defaults are Microsoft / Apple system fonts with mature ATS-Modern parser support and PDF embedding for cross-device rendering fidelity.

| Package | Heading | Body (default) | ATS-Modern safety |
|---|---|---|---|
| Copenhagen Modern | Segoe UI Bold | Segoe UI | 99% |
| Navy Executive | Cambria Bold | Cambria | 98% |
| Warm Terracotta | Georgia Bold | Palatino Linotype | 98% |
| Nordic Frost | Trebuchet MS Bold | Verdana | 99% |
| Pampas Contemporary | Palatino Linotype Bold | Palatino Linotype | 98% |
| Tokyo Precision | Tahoma Bold | Tahoma | 99% |
| Delhi Technical | Segoe UI Bold | Segoe UI | 99% |

Confidence figures reflect modern ATS parser handling (Greenhouse, Lever, Ashby, modern Workday). The gap between Calibri (99%) and the chosen body fonts (98 – 99%) is statistically zero — the "Calibri is universally safest" advice from 2010 – 2015 is no longer accurate for ATS-Modern. PDF embedding makes the parsing server's font availability irrelevant for text extraction.

When `target_ats_tier === "legacy"`, the per-package body font is overridden and **Calibri is forced**. Legacy parsers (Taleo pre-2018, iCIMS pre-2018, older SuccessFactors) have genuinely narrower font tables, so Calibri or Arial is required at that tier. This is the Legacy rule, not a package property.

When a user wants to override the per-package body font for stylistic reasons, the PWA offers a per-application toggle in the package picker. The override is logged as an `ats_font.user_override` event. Calibri is always available as the override choice — the legacy-safe option remains one click away even in Modern.

---

## ATS as a third orthogonal flag

ATS is not a package and not a writing style. It is a boolean export flag the user toggles per-export. When `ats: true`:

- The active package's photo is suppressed.
- Tables flatten to text per the active style's `atsBehavior` rule.
- Glyphs replace with text labels (☎ → "Phone:", ✉ → "Email:", 🔗 → "Link:", ⌂ → "Location:").
- Font forces to Calibri.
- Section headings may switch to standard names per style policy.

The writing style and package selections still apply — the user does not lose their style when exporting ATS-safe. The skill produces content that survives ATS flattening (no reliance on visual hierarchy for meaning, parser-safe separators in flattenable tables).

This means the deliverable space is actually 12 styles × 7 packages × 2 ATS states = **168 combinations**. The plan §8 testing matrix covers a representative subset.

---

## What the skill produces vs. what the visual layer does

| Layer | Produces | Reads from |
|---|---|---|
| **antcv-writer skill** | Section content as JSON, with section keys, format types, character counts, change-log proposals | `user_state`, `role_summary`, JD, style row from `writingSystems/registry.json` |
| **Layout + Section Engine (worker)** | Section ordering and placement (main vs sidebar) | Style row's `sectionOrder` and `mainSidebarPlacement` |
| **Density + Compression Engine (worker)** | Compressed section content if over budget | Style row's density defaults, package's `imageSize` (sidebar space calculation) |
| **Visual layer (DOCX worker, PWA preview)** | Rendered output with colours, fonts, photo, glyphs | `packages/registry.json` for the active package |
| **ATS/Export Engine (worker)** | Flattened ATS-safe export | All three engines + ATS flag |

The skill never reads `packages/registry.json` and never writes visual values. The visual layer never reads `user_state` or `role_summary`.

---

## When the (writing × package) axes seem to interact (they don't, structurally)

Three places where the layers appear to touch — but the touching is mediated by the worker's engines, never by the skill:

1. **Photo size affects sidebar space.** Tokyo Precision (90 px) leaves more sidebar room than Warm Terracotta (130 px). The Density Engine accounts for this when sizing sidebar content. The skill is unaware — it produces content within `lineLimits` and the Density Engine compresses.

2. **Heading font height affects line counts.** Cambria has different metrics than Calibri. The Layout Engine handles this when paginating. The skill produces character counts and item counts; the engine maps to lines.

3. **Dark mode (per-package variants).** When the user previews in dark mode, the package swaps tokens; content is unchanged. The skill is unaware of light/dark.

In all three cases, the writing layer remains structurally independent. The interaction is layout/density, not content.

---

## Implications for the AI implementer

For the agent implementing the worker:

- Build `packages/registry.json` per locked-source plan §3 verbatim. The skill never reads it; only the visual layer does.
- The `package` field on every request is informational for the skill (it's logged, it's part of `applications`, it's tracked in change-log) but the skill never branches content on it.
- The independence test (§8.8) is a release-gate test. CI must verify: for every (style × package) pairing, switching one axis changes only the other.
- Visual-package events (`package.switch`, `package.cascade`) are written to D1 with `package` populated and `writing_style` carried over from the user's current state. They are not skill-driven events.

For the agent calling the skill at runtime:

- Pass the active package on every request even though it doesn't change content. Future analytics queries depend on it being present.
- Honour the user's package + style choices exactly. Never silently substitute.
