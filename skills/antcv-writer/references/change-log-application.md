# Change-log application

How recurring Confidence/Risk patterns in `change_log` modulate output on subsequent generations. Loaded when `change_log_patterns` is non-null.

The change-log is the skill's behavioural memory. Every generation produces entries with `confidence` (high / medium / low) and `risk` (invented / overstated / too-generic / none). Recurring patterns in a user × role × style cell trigger softening rules.

---

## Input

A summary object built from `change_log` rows:

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

Patterns are scoped per user × role × style — each style draws different content shapes from the same kernel, so risk profiles diverge.

---

## Pattern recognition

A pattern is **recurring** when either holds for that section × risk type:

- count ≥ 3 entries, or
- count ≥ 25% of samples.

Below both thresholds, the style's base behaviour applies.

---

## Softening rules

### `risk=invented`

The skill has been fabricating content the user removes — usually unverified metrics.

1. Suppress speculative metrics. Generate the outcome qualitatively unless a number is verifiable in `user_state.profile.experiences[*]`.
2. Demand kernel traceability: every fact must trace to a `user_state` field, or the bullet drops it.
3. Log `reason: "softened_due_to_recurring_risk_invented"`, `confidence: medium`, `risk: none`.

**Example.**  
Before: "Cut review cycles 40 per cent across three programmes."  
After: "Reduced review cycle time across three programmes."

### `risk=overstated`

The skill has been claiming more than the kernel supports — usually scope or leadership inflation.

1. Weaken claim verbs. "Led" → "Coordinated", "Owned" → "Worked on", "Drove" → "Contributed to".
2. Tighten scope. "Across three programmes" survives only when the kernel confirms three; otherwise "Across multiple programmes".
3. Log `reason: "softened_due_to_recurring_risk_overstated"`, `confidence: medium`, `risk: none`.

**Example.**  
Before: "Led customer change governance across three tier-1 customer programmes."  
After: "Coordinated customer change governance across automotive tier-1 customer programmes."

### `risk=too-generic`

Bullets the user finds insufficiently specific — usually missing a concrete example or named methodology.

1. Demand a concrete example or named method per bullet. If neither is in `user_state.profile.experiences[*]`, leave the bullet minimal and log `risk: too-generic, confidence: low, reason: "insufficient_evidence_to_specify"`.
2. Surface JD Gap claims aggressively when they substantiate the example.
3. Reduce bullet count. Fewer, more specific bullets beat more generic ones.

**Example.**  
Before: "Strong experience in change governance."  
After: "Led ASPICE-aligned change governance across three customer programmes at Innoviz."

### `risk=none` (no recurring risk)

With `user_acceptance_rate ≥ 0.8` and no recurring risk patterns, the cell is trusted. Generate at the upper end of the style's density range and try novel framings.

---

## `common_replacements`

When the user has changed the same word three or more times (e.g., "drove" → "led" six times):

- Word-level: replace at generation time before drafting.
- Phrase-level: avoid the source phrase; prefer the replacement.
- Below three replacements: pattern observed but not applied.

Log the substitution with `reason: "applied_user_replacement_pattern"`.

---

## Window and freshness

Patterns scope to the last 90 days by default (matches the retention window). Older patterns still feed the rollup in `role_summary` but do not drive softening — softening is a short-term correction, not long-term identity.

The worker can pass a shorter window (e.g., 14 days) when the user has been heavily revising recently.

---

## User reverts the softening

The user sees softening effects in the change-log proposals. If they revert (e.g., re-add the dropped metric):

- The revert writes a `source=user` row with `reason: null`.
- The next rollup treats the revert as evidence the original "invented" flag may have been wrong.
- After three reverts of the same type, the softening rule pauses for that section × risk type. Worker emits `change_log_softening.paused`.

This keeps softening from becoming an irreversible quality regression.

---

## Style switching

Changing `writing_style` does not transfer change-log patterns. Each style accumulates its own risk profile per role.

- Switching from `achievement-driven` to `nordic-minimal` resets softening. Output runs at base behaviour until enough new samples accumulate.
- Switching back re-applies the previous softening (the rows are still in `change_log`).

---

## Cross-references

- `style-matrix.md` — base style behaviour that softening modifies.
- `personalization.md` — the other behavioural signal alongside `change_log_patterns`.
- `AI_IMPLEMENTATION_GUIDE.md` § 6 — change-log capture and retention.
- `cv-skeleton.md` § Content rules — base content rules per section.
- `output-schema.md` — change-log entry shape.
