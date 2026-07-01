# Orphan control — investigation + architecture (2026-07-02)

Owner: "lots of orphans especially in the Results section, also some on role bullets. Need an actual
investigation and architecture for a solution."

An **orphan** = a wrapped paragraph/bullet whose LAST line holds only a few dangling words (a short runt).

## 1. Where orphans actually come from

Two DISTINCT render paths — this is the crux:

- **Preview** = React → HTML. CSS applies. `index.html` sets `.antcv-preview-paper { text-wrap: pretty }`,
  so the browser already avoids most runts on screen.
- **Export** = `docx-worker` builds a binary DOCX → CloudConvert renders the PDF. **CSS does NOT apply.**
  `text-wrap: pretty` is ignored. The owner's PDF orphans live HERE.

So the on-screen preview can look clean while the exported PDF still orphans. Any real fix must act on the
**export payload / DOCX**, not on preview CSS.

## 2. What already exists (and why it is not enough)

| Layer | Mechanism | Gap |
|-------|-----------|-----|
| Generation prompt | `COMPRESSION-TIGHT-001` (app.src.js ~3015): "if a line wraps leaving a ≤30-char orphan, RE-TIGHTEN the whole text" | LLM-dependent, inconsistent; the model often ignores it |
| Client NBSP bind | `antcv-docx-client.js` `bindOrphan` (~1383): glue the **last** word to the previous with U+00A0 | Fixes only a **single-word** orphan; skips if the last word >14 chars; one gap only. A 2–3 word runt survives |
| Prose glue | `_glueOrphan` (~1746): last-word NBSP for profile/work_style/who/why/foundation | Prose only; single-word only |
| DOCX typography | `keepLines`, `keepNext` on paragraphs | These stop **page** splits, NOT an intra-paragraph short last line. No `widowControl` (and widowControl wouldn't fix runts anyway) |
| LLM `fix_orphans` | `Qi()` (~19099): NBSP pre-pass + LLM word-substitution | **User-triggered** ("Fix Orphans" button), not automatic; costs an LLM call |

**Why Results is the worst:** the Results line is a single paragraph capped at 260 chars (app.src.js ~6419).
It wraps several lines, so its last line is very likely a runt — and the single-word `bindOrphan` can't pull
a 2–3 word runt back up.

## 3. The key finding that unlocks a real fix

The investigation concluded "client-side line measurement doesn't exist / is too hard." That's true for the
existing block-height measurer — but it missed one capability:

> **`Range.getClientRects()` returns one rectangle PER RENDERED LINE** of a wrapped text node.

That means, in the preview, we CAN deterministically read — per bullet, per Results line — how many lines it
wraps to and **how wide each line is**, including the last one. Orphan = `lastRect.width < threshold`.

And because AntCV's preview paper is a **scaled real page** (same font family — Calibri — same relative column
width), the preview's line breaks are a close proxy for the DOCX's line breaks. Not identical (justification,
kerning, hyphenation differ), but far better than today's blind single-word guess.

## 4. Proposed architecture — layered, escalating

Keep each layer cheap and let residue fall through to the next.

- **Layer 0 — Generation (keep as-is).** The ≤30-char re-tighten prompt. Reduces incidence; never relied on.

- **Layer 1 — Measure (NEW, deterministic).** A client pass over each Results line and role bullet in the
  preview: build a `Range` over the text, `getClientRects()`, classify the last line as an orphan when its
  width is below a threshold (e.g. < 30% of the column, or ≤ ~2 words). Zero LLM, zero content change.

- **Layer 2 — Multi-word NBSP bind (NEW, deterministic, content-preserving).** For each detected orphan,
  bind the **right number** of trailing words with U+00A0 so the last line clears the threshold **without
  creating a new runt** — computed from the Layer-1 measurement. This generalises today's single-word
  `bindOrphan`. The NBSP is already carried into the DOCX by `docx-client`, so **the same fix lands in the
  PDF.** Apply to Results + experience bullets (the owner's two hotspots) first.

- **Layer 3 — Auto LLM re-tighten (reuse `fix_orphans`).** Only the residue that NBSP can't fix (binding
  would overflow the line, or the text is inherently one runt too long) is auto-routed to the existing
  `fix_orphans` task — no button press. Cheap-provider-first, per the ee() router.

## 5. Trade-offs / caveats

- Preview≈export is an **approximation**. Justified bullets, Word kerning, and DOCX auto-hyphenation can shift
  a break by a word. Layer 2 should bind conservatively (leave a small margin) so an approximation error
  doesn't itself create a runt. Layer 3 catches what slips through.
- NBSP binding can, in the worst case, push one more word down — the measurement gate prevents binding when it
  would make things worse (fall through to Layer 3 instead).
- Results may also simply be **too long**; consider lowering the 260-char cap or letting Results be shorter as
  a separate lever.

## 6. Recommended first step

Implement **Layer 1 + Layer 2** as one new sidecar (`antcv-orphan-measure-bind.js`) scoped to Results +
experience bullets, wired on `sections-updated` + a preview-settle tick, writing the NBSP into the stored text
so the export inherits it. Ship behind a kill-switch (`localStorage['antcv:disable-orphan-bind']`). Verify on a
real export PDF (can't be confirmed headlessly). Then wire Layer 3 auto-escalation.

This is deterministic, no per-generation LLM cost, and fixes the export (not just the preview) — the gap that
made every prior attempt fall short.
