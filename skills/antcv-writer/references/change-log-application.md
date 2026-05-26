# Change-log application

How recurring patterns in the `change_log` table (Confidence and Risk values across past generations for a user and role) modulate the skill's output on subsequent generations. Loaded when `change_log_patterns` is non-null.

The change-log is the skill's behavioural memory. Every generation produces change-log entries with `confidence` (high / medium / low) and `risk` (invented / overstated / too-generic / none). Recurring risk patterns for a user × role × style cell signal that the skill should soften its output in specific ways.

---

## Input

The worker passes a summary object built from `change_log` rows:

```json
{
  "user_id": "uid_xxx",
  "role_slug": "product-manager",
  "writing_style": "achievement-driven",
  "section_risk_patterns": {
    "selected_outcomes": {
      "samples": 14,
      "risk_counts": {
        "invented": 4,
        "overstated": 2,
        "too-generic": 1,
        "none": 7
      },
      "user_acceptance_rate": 0.71,
      "common_replacements": [
        {"from": "30% improvement", "to": "improvement", "count": 3}
      ]
    },
    "profile": {
      "samples": 8,
      "risk_counts": {"too-generic": 5, "none": 3},
      "user_acceptance_rate": 0.625
    }
  },
  "window_days": 90
}
```

The patterns are scoped by user × role × style — different styles for the same role can have different risk profiles, because each style draws different content shapes from the same kernel.

---

## Pattern recognition

A risk pattern is **recurring** when:

- The risk count for that section × risk type is at least 3 entries; OR
- The risk count exceeds 25 per cent of samples for the section.

When both conditions fail, the change-log patterns do not modify generation. The style's base behaviour applies.

When a pattern is recurring, the skill applies the corresponding softening rule below.

---

## Softening rules by risk type

### `risk=invented` (≥3 entries or ≥25% of samples)

The skill has been fabricating content the user removes — typically invented metrics or invented outcomes.

**Softening:**

1. Suppress speculative metrics in this section. Generate the outcome qualitatively, without a number, unless a real number is verifiable in `user_state.profile.experiences[*]`.
2. Demand kernel traceability: every fact in this section must be traceable to a `user_state` field. If a fact cannot be traced, the bullet is generated without it.
3. Add a `change_log_proposals` entry on the new generation: `reason: "softened_due_to_recurring_risk_invented"`, `confidence: medium`, `risk: none`.

**Example:**

Before pattern: "Cut review cycles 40 per cent across three programmes."
After pattern: "Reduced review cycle time across three programmes."

The qualitative form survives; the unverified number is dropped.

### `risk=overstated` (≥3 entries or ≥25% of samples)

The skill has been claiming more than the kernel supports — typically scope inflation or leadership claims beyond the actual role.

**Softening:**

1. Reduce claim strength on verbs. "Led" becomes "Coordinated"; "Owned" becomes "Worked on"; "Drove" becomes "Contributed to".
2. Tighten scope claims. "Across three programmes" stays only when the kernel confirms three programmes. "Across multiple programmes" replaces it when only one is verifiable.
3. Add a `change_log_proposals` entry: `reason: "softened_due_to_recurring_risk_overstated"`, `confidence: medium`, `risk: none`.

**Example:**

Before pattern: "Led customer change governance across three tier-1 customer programmes."
After pattern: "Coordinated customer change governance across automotive tier-1 customer programmes."

### `risk=too-generic` (≥3 entries or ≥25% of samples)

The skill has been producing bullets the user finds insufficiently specific — typically missing the concrete example or the named methodology.

**Softening:**

1. Demand a concrete example or named methodology for every bullet. If no example or method is available in `user_state.profile.experiences[*]`, leave the bullet minimal with a `change_log_proposals` entry: `risk: too-generic`, `confidence: low`, `reason: "insufficient_evidence_to_specify"`.
2. Surface JD Gap claims more aggressively. If a JD Gap claim could substantiate a specific example for this section, use it.
3. Lower the bullet count slightly. A section with recurring too-generic risk often benefits from fewer, more specific bullets rather than more bullets.

**Example:**

Before pattern: "Strong experience in change governance."
After pattern: "Led ASPICE-aligned change governance across three customer programmes at Innoviz."

### `risk=none` (the absence of recurring risk)

When the user × role × style cell has high `user_acceptance_rate` (>= 0.8) and no recurring risk patterns, the skill trusts the cell. It can generate at the upper end of the style's density range without softening, and it can be more confident about novel framings.

---

## Interaction with `common_replacements`

When `common_replacements` shows a recurring user edit pattern (e.g., the user changes "drove" to "led" six times), the skill applies the replacement at generation time:

- Word-level: replace the source word with the user's preferred replacement before generation.
- Phrase-level: avoid generating the source phrase; prefer the replacement.
- Threshold: at least 3 replacements of the same pair for the substitution to be applied; below that threshold, the pattern is observed but not yet applied.

The substitution is logged in the change-log with `reason: "applied_user_replacement_pattern"`.

---

## Window and freshness

Change-log patterns are scoped to the last 90 days by default (matching the default retention window). Older patterns still influence the rollup in `role_summary`, but they do not directly drive the softening rules above — those are short-term behavioural corrections, not long-term style identity.

The worker can pass a shorter window for fresh signals (e.g., the last 14 days) when the user has been heavily revising in the recent past.

---

## When the user adjusts the softening

The user can see the softening effects in the generation's change-log proposals. If the user accepts the softened bullet, the cell's risk pattern continues to apply on the next generation. If the user reverts the softening (e.g., re-adds the invented metric), that is a signal to the worker:

- The `change_log` captures the user's re-addition as a `source=user` row with `reason: null`.
- The next rollup considers the user's revert as evidence that the original "invented" classification may have been mis-flagged.
- After three reverts of the same type, the softening rule pauses for that section × risk type, with an event `change_log_softening.paused` for analytics.

This prevents the softening from becoming an irreversible quality regression — the user has the last word.

---

## Interaction with style switching

When the user changes `writing_style`, the change-log patterns from the previous style do not transfer. Each style accumulates its own risk profile per role.

This means:

- Switching from `achievement-driven` to `nordic-minimal` resets the recurring-risk softening. The skill generates `nordic-minimal` output at its base behaviour until enough samples accumulate under the new style.
- Switching back to `achievement-driven` re-applies the previous softening (the rows are still in `change_log`).

---

## Cross-references

- `style-matrix.md` — base style behaviour that the softening modifies.
- `personalization.md` — adjacent reference; `role_summary` and `change_log_patterns` are the two behavioural signals.
- `AI_IMPLEMENTATION_GUIDE.md` § 6 — change-log capture and retention.
- `cv-skeleton.md` § Content rules — base content rules per section.
- `output-schema.md` — change-log entry shape.
