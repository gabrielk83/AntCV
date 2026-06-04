# Writing System Engine — Verification / Confidence section (formal spec)

> **Status:** formal specification for a NEW capability, authored 2026-06-04 at the owner's
> direction. The two locked source docs (`Unified_Visual_Package_System.docx`,
> `Writing_System_Engine_Specification.docx`) currently use "confidence" only in the *tone*
> sense. This document is the formal text for a new **"Verification / Confidence"** section to
> be folded into `Writing_System_Engine_Specification.docx` (the .docx remains the master; this
> markdown is the source text for that section, kept in-repo so engineering can build against
> it before the .docx is updated).
>
> Tracking ID: **FEATURE-CONF-001**.

## 1. Purpose

Surface, to the candidate, how well each sentence of the generated CV / cover letter is
**grounded in their own source facts** — so they can see and fix anything the model may have
overstated or invented before they send it. This is a *verification* aid, not a tone control.

## 2. Owner decisions (locked 2026-06-04)

- The control is a **button in the Analysis panel** (the same panel that hosts the JD analysis
  block), not a top-bar or preview control.
- Default **OFF**. Tinting is shown only while the toggle is ON.
- Confidence is produced **as part of the existing analysis pass** (`/api/jd-analysis`,
  `workers/demo-proxy/src/jd-analysis.js`) — not a separate self-check call. It reuses the
  pass's existing anti-fabrication / `grounded` logic.
- Tinting is **preview-only** and MUST NOT be serialised into DOCX or PDF (this is the one
  documented exception to GEN-001 parity: the confidence overlay is a screen-only review aid).

## 3. Data contract

The analysis pass receives the generated document content and returns, in its JSON result, a
new array:

```jsonc
"document_confidence": [
  {
    "doc": "cv" | "cl",        // which document the sentence belongs to
    "section_id": "string",     // the section id the sentence renders under
    "idx": 0,                   // sentence/bullet index within that section
    "text": "string",           // the sentence as scored (for re-matching in the DOM)
    "confidence": 0.0,          // 0..1, how well grounded in candidate source facts
    "issue": "string" | null    // short reason when confidence is low; null when high
  }
]
```

Scoring rule (same standard already enforced in the pass's ANTI-FABRICATION block and the
`"grounded": boolean` field on suggested answers): `confidence` reflects how well the sentence
is supported by `candidate_summary` / candidate source facts. An unsupported or overstated
claim scores low and carries an `issue`; a fully grounded sentence scores high with
`issue: null`. The model MUST NOT invent support.

## 4. Bands (rendering)

| Band | Range | Treatment |
|------|-------|-----------|
| Low | `confidence < 0.4` | reddish tint `rgba(200,40,40,.14)` + reddish underline |
| Medium | `0.4 ≤ confidence < 0.7` | yellowish tint `rgba(217,160,20,.16)` |
| High | `confidence ≥ 0.7` | untinted |

Hovering a tinted sentence shows a tooltip = `issue` + the numeric confidence (e.g.
`"Not supported by your CV — 0.31"`). When the toggle is switched OFF, all tinting is removed.

## 5. Layers / responsibilities

1. **Worker (`jd-analysis.js`):** extend the request to carry the generated document sections,
   add `document_confidence` to the system-prompt schema and to `normalize()`, scored under the
   existing anti-fabrication rule. Cheapest path; no second LLM call.
2. **app.js:** persist the returned `document_confidence` map alongside the generated sections
   (survives edits / re-renders); expose the Analysis-panel toggle (default OFF) in app state.
3. **UI sidecar (renderer):** when the toggle is ON, wrap each matched preview sentence in a
   span tinted by band with the tooltip; re-apply on re-render; strip on OFF. Never writes into
   the export payload.

## 6. Acceptance criteria

- Toggle lives in the Analysis panel, default OFF; turning it ON tints preview sentences by
  band; OFF removes all tinting with no residue.
- A sentence with no support in the candidate's data renders **low** (reddish) with a non-null
  `issue` in its tooltip; a fully grounded sentence renders **untinted**.
- DOCX and PDF exports are **byte-for-byte unaffected** by the toggle state (no tint, no marker
  spans) — verified by exporting with the toggle ON and OFF and diffing.
- The confidence map survives a preview edit + re-render without a re-analysis (persisted), and
  is refreshed on the next analysis run.
- No new LLM call is introduced; the data comes from the existing `/api/jd-analysis` pass.

## 7. Non-goals

- Not a tone/register control (that "confidence" already exists in the writing styles).
- Not an automatic rewrite — the overlay flags; the candidate edits.
- Not exported — never appears in the ATS/DOCX/PDF output.
