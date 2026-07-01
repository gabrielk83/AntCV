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

---

# v2 — evidence from export (16) + the orphan-FREE strategy (2026-07-02, after 1.51.52)

Owner: "the orphans are still present — analyse all orphans in the document and build a strategy to keep
[orphan]-free documents."

## 7. Orphan inventory — export (16), main column

L1+L2+L3 (1.51.44–48) ran before this export. Result: **zero single-word orphans** (L2 works) but
**13 multi-word runts** (2–3 word last lines) survived:

| Role | Line | Runt |
|------|------|------|
| Change Request Lead | b2 | "customer-facing work." |
| Sirin | b1 | "for high-security smartphones." |
| Sirin | b2 | "and Qualcomm tools." |
| Sirin | b3 | "constraints, and manufacturability." |
| Sirin | Results | "commercial devices." |
| EO Team Leader | b3 | "system trade-offs." |
| EO Team Leader | b4 | "and production handover." |
| Research Assistant | b1 | "probe stations." |
| Research Assistant | b2 | "plasma processing." |
| Research Assistant | b3 | "in MEMS/NEMS." |
| CSA / IDF | b2 | "restore procedures." |
| Students Council | b2 | "raised by classmates." |
| Students Council | b3 | "faculty forums." |

Sidebar (narrow column, cosmetically tolerable but same class): "photonics integration", "fabrication",
"workflows", "equipment", "and testing".

## 8. Why v1 fell short — three verified causes

1. **Preview breaks ≠ PDF breaks.** L1 measures the PREVIEW column at preview zoom; CloudConvert typesets
   the DOCX column. Most of the 13 PDF runts were simply not runts in the preview (and vice versa), so L1
   never flagged them. This is THE dominant cause.
2. **RUNT_FRAC = 0.32 misses 3-word runts.** "constraints, and manufacturability." is ~40% of the column —
   below no threshold at 0.32. The detector was tuned for 1–2 word orphans.
3. **L3 wrote by preview index and CORRUPTED data (fixed 1.51.52).** The preview path `roles.N.bullets.M`
   uses the RENDER index; the stored array also holds hidden (`on:false`) + empty skeleton roles, so
   preview N ≠ stored N. A shortened CSA/IDF bullet landed in the Teaching-Assistant and Kanzen roles
   (export 16, both repaired live). **ORPHAN-WRITE-VERIFY-001** makes every L2/L3 write text-verified:
   the path is only a hint; the target must match the measured text (tense-lead-tolerant) or be the UNIQUE
   match in the section, else the write aborts. Attempted-map keys are now text-sig-based, not path-based.

## 9. v2 architecture — measure like the export, fix before the export

- **EXPORT-METRIC-MEASURE-001 (L1', the core fix).** Measure runts in an OFFSCREEN div styled with the
  EXPORT font family/size and the EXPORT main-column width (the client already mirrors export budgets in
  preview px — SIDEBAR-INFLATE-GRPWHOLE-001 precedent). Same `getClientRects` mechanics, but detection now
  tracks the PDF ~1:1 instead of the preview. Scope: bullets + Results first, then sidebar groups + CL body.
- **Threshold: RUNT_FRAC 0.32 → 0.40 in the export-metric pass** (catches 3-word runts). Keep 0.32 for the
  live preview ticks so on-screen churn stays low.
- **EXPORT-PREFLIGHT-ORPHANS-001 (L3', deterministic timing).** Run the orphan pass as an EXPORT PREFLIGHT
  inside `exportDocxViaWorker`: measure (export metrics) → L2 bind → ONE batched L3 call for all residue →
  safeShorten gate → RE-MEASURE each accepted rewrite (reject any that still runts or gains a line) →
  text-verified write → build payload. Bounded by a 12s timeout (export proceeds with whatever landed);
  progress line in the export overlay. This kills the race where the export leaves before the async tick
  fires — the reason only 4 lines ever reached L3 in export 16.
- **L0 (cheap, optional).** One generation-prompt line: write bullets to fill complete typeset lines
  (~95–110 chars/line in the main column); avoid 2–3 word final fragments. Reduces incidence only.

Order: WRITE-VERIFY (shipped 1.51.52) → EXPORT-METRIC-MEASURE → EXPORT-PREFLIGHT → threshold/scope tuning
→ L0 prompt line. Each behind its own kill-switch; verify on a real export PDF after each stage.
