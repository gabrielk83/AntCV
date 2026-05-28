# Opening prompt — fresh chat to continue antcv-writer audit

Use this as the first message of the next fresh chat. The `antcv-mcp` MCP server gained one tool since the last session — the new chat discovers all 9 antcv-mcp tools (8 prior + `github_read_docx`) on first connect.

---

## Paste this into the new chat:

Continuing the `gabrielk83/AntCV` `antcv-writer` skill work. Last session (2026-05-26):

- Added `github_read_docx` MCP tool to antcv-mcp worker so .docx files in the repo are now readable (commit `43342f9`).
- Flagged per-style drift in `skills/antcv-writer/references/style-matrix.md` § Source-doc alignment status. Largest drift: `precision-formal` reads as numerical-engineering precision; canonical (LockedSources §4.2) is Japanese-register consistency / respect / organisational fit.
- Tightened LockedSources §4.2 (normative one-liner note) and added §4.5.3 trigger-rule schema.

Mission, in order:

### 1. Source-document audit

Read the source doc:

```
github_read_docx({
  owner: "gabrielk83",
  repo:  "AntCV",
  path:  "docs/design/Writing_System_Engine_Specification.docx"
})
```

Then read `docs/plan/AntCV_Plan_v2_LockedSources.md` §4. Cross-check. LockedSources §4 should be faithful to the docx. If gaps exist, patch LockedSources first with `(added <date> from source §X)` inline notes.

### 2. Per-style audit and rewrite

For each style flagged in `style-matrix.md` § Source-doc alignment status:

1. Locate its paragraph in the docx.
2. Read the matching `skills/antcv-writer/references/styles/{name}.md`.
3. Rewrite `primaryConstraint`, `constraintAvoid`, `constraintPrefer`, content rules, banned forms, preferred forms, and JD-signals to match the docx paragraph.
4. Update the corresponding row in `style-matrix.md` if its constraint fields were rewritten.
5. Clear the alignment-status entry.

The largest case is **precision-formal**. Current file is numerical-engineering register (Zemax, MTF, ±0.15 mm, etc.); canonical is Japanese-register consistency / respect / organisational fit. The engineering-precision content does not match the named style and may belong as a JD-triggered chip combination on `structured-professional` or `credential-forward`, or be dropped.

Other flagged styles: `measured-professional`, `structured-professional`, `mediterranean-formal`, `prestige-structured`, `credential-forward`, `context-rich`, `cold-outreach`, `hybrid-balanced` — partial drift each.

Already aligned: `nordic-minimal`, `achievement-driven`, `research-formal`.

### 3. Trigger-based rules

Per LockedSources §4.5.3, each style optionally has Trigger + Avoid + Prefer + Reason quadruples that stay dormant until the trigger matches. Surface these from the docx and add a `## Triggered rules` section to each per-style file.

### 4. Continue tightening pass (from commit `d2ca093`)

Same compression patterns as the prior pass — wordy conditionals → tables, soft hedging cut, redundant scope qualifiers dropped, two-sentence merges. Target files:

- `cl-skeleton.md` (15.6 KB)
- `role-inference.md` (13.2 KB)
- `language-output.md` (10.6 KB)
- `output-schema.md` (13.5 KB)

Target 15-25% reduction per file. No contract changes.

### 5. PWA implementation hand-off

After audit + tightening land, hand off to a Claude Code session using the opening prompt prepared in the prior transcript. Three-phase plan: D1 migration; worker proxy `/v1/generate` (7-step pipeline, ATS advisory, cascades, JD Gap Closure, change-log capture, retention sweeper, CL generation, language honouring, schema validation); PWA UI work.

---

## Constraints (project memory)

- Every `wrangler.toml` needs `[observability.logs]` with `enabled = true` and `invocation_logs = true` immediately after `compatibility_date`
- Em dashes only in prose; en dashes allowed in numeric ranges (e.g., "8 – 14")
- No exclamation marks
- 30 banned words + 9 banned phrases per LockedSources §4.5
- LinkedIn never dropped from contact items in any language
- JSON section keys stay English regardless of `target_language`
- Regex `\s` must use loop-based char-comparison helpers (test harness brace-counter mishandles backslash in regex)
- JSX text positions cannot contain `\u` Unicode escapes
- OOXML strict validator must report zero errors/warnings
- Comment stripper only strips standalone `//` lines

## Communication style

Clear, calm, direct. Short factual sentences. Concrete actions. Measurable examples when available. No corporate language. Rapid iteration with drift-flag commits is preferred over conservative full-rewrite passes.
