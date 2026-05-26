# Personalization

How `role_summary` and `role_summary_global` modulate the skill's output. Loaded when `role_summary` is non-null.

The skill personalises across two axes: per-user history with this `role_slug`, and global aggregate behaviour across all users on the same `role_slug`. The two are blended based on data density — when the user has limited history, the global prior carries more weight.

---

## Inputs

The worker passes two objects:

- `role_summary` — per-user rollup keyed `user:{uid}:role-summary:{slug}` in `ANALYTICS` KV.
- `role_summary_global` — anonymised aggregate keyed `global:role-summary:{slug}`.

Both follow the same shape:

```json
{
  "application_count": 7,
  "outcome_count": 3,
  "preferred_styles": [{"style": "achievement-driven", "selections": 4, "acceptances": 4}],
  "preferred_packages": [{"package": "navy-executive", "selections": 5}],
  "section_density_observed": {
    "profile": {"avg_chars_after_edit": 312, "avg_bullets": null},
    "selected_outcomes": {"avg_bullets_after_edit": 4, "avg_chars_per_bullet": 88}
  },
  "section_format_observed": {
    "core_competencies": {"table_grid": 5, "bullets": 1}
  },
  "manual_edit_signals": {
    "common_user_replacements": [
      {"from": "drove", "to": "led", "count": 6}
    ]
  },
  "last_updated_ts": 1748257200
}
```

The user copy may be null when the user has not yet generated for this role; the global copy is null only when no user anywhere has generated for this role (uncommon after the first weeks of operation).

---

## Blending logic

The skill uses a density threshold to decide weighting:

- **`application_count` >= 3** for `role_summary`: trust the user's per-role history fully; ignore `role_summary_global` for that role.
- **`application_count` < 3** for `role_summary`: blend the user's history with the global prior. The user's signals still dominate for style choice (they made an explicit selection), but density and format defaults come from `role_summary_global`.
- **`role_summary` is null**: use `role_summary_global` as the prior for density and format defaults. Style is taken from the user's current `writingPrefs.style`.
- **Both null**: cold start. Use the style row's `sectionFormatDefaults` and density values verbatim from `style-matrix.md`.

---

## What gets personalised

The skill applies `role_summary` signals to these output decisions, **not** to content correctness:

| Signal | Effect on output |
|---|---|
| `section_density_observed.{section}.avg_bullets_after_edit` | Targets bullet count for that section toward the user's revealed preference (within the style's range). |
| `section_density_observed.{section}.avg_chars_per_bullet` | Targets bullet length toward the user's revealed preference (within the style's range). |
| `section_format_observed.{section}` | If the user has consistently overridden the style default to a different format for this role, the skill uses the user's format. |
| `manual_edit_signals.common_user_replacements` | The skill avoids generating words the user has consistently replaced. E.g., if the user replaces "drove" with "led" six times, the skill uses "led" by default for this role. |
| `preferred_styles` | When `writing_style` is not explicitly set, default to the most-accepted style for this role. |
| `preferred_packages` | When `package` is not explicitly set, default to the most-selected package for this role. |

What `role_summary` **does not** affect:

- Banned word lists (those are absolute).
- Style constraints (`primaryConstraint`, `constraintAvoid`, `constraintPrefer`) — these are pure functions of the style.
- Section presence (the skeleton decides which sections exist).
- ATS tier (decided per `cv-skeleton.md` § Tier inference).
- JD Gap Closure claim validity.

---

## Global prior usage

`role_summary_global` is used in two contexts:

1. **Cold start for a user.** When the user has no history with this `role_slug`, the global prior informs density and format defaults so the first generation does not feel arbitrary.
2. **Sparse user history.** When `application_count < 3` for the user, the global signals contribute to density and format defaults via the blend.

The global prior is never used for content. It informs structure (how long a bullet typically is for a Product Manager application) but never wording (no user's specific phrasing is ever surfaced to another user).

---

## Sparse-data fallback

When `role_summary_global` is also null or has fewer than 50 applications across all users, the skill falls back to `global:section-defaults` — a coarser prior built from all applications across all roles. This is the cold-start cold-start.

`global:section-defaults` is a single KV entry of the same shape as `role_summary` but with `role_slug=ALL`. It is updated by the rollup function on every event regardless of role.

---

## Manual-edit signals — privacy considerations

`manual_edit_signals.common_user_replacements` captures word-level patterns from the user's own change log. The signal stays per-user — it is never aggregated into `role_summary_global` because individual word preferences can leak personal voice.

When the daily retention sweeper trims `change_log.before_text` and `after_text` past the retention threshold, the manual-edit signals already aggregated into `role_summary` persist as counts (no raw text). The aggregate survives the text trim.

If the user calls "Wipe my analytics" (see `AI_IMPLEMENTATION_GUIDE.md` § 8.2), the per-user `role_summary` is deleted along with the events. The user starts cold on the next generation.

---

## When to override personalisation

The skill ignores `role_summary` in these cases:

- **`writingPrefs.overrides[field] === true`** for any field the personalisation would affect. The user's explicit override always wins.
- **Style cascade just happened.** When `style.cascade` fires within the last 30 seconds, the new style's `sectionFormatDefaults` win over the personalisation observed under the previous style.
- **JD Gap Closure claim conflicts.** If a JD Gap claim demands a section that the user has historically dropped, the claim wins and the section appears.

---

## Effects on change-log

Every personalisation effect produces a change-log entry with `reason` naming the signal:

```json
{
  "section": "selected_outcomes",
  "source": "llm",
  "before_text": null,
  "after_text": "...",
  "reason": "personalisation_signal_density_observed_avg_4_bullets_for_this_role",
  "confidence": "medium",
  "risk": "none"
}
```

When the user later edits that section, the edit is captured against the same `application_id` and the rollup updates the signal — closing the feedback loop.

---

## Cross-references

- `style-matrix.md` — base defaults that personalisation modifies.
- `cv-skeleton.md` / `cv-skeleton-academic.md` — section structure that personalisation respects.
- `change-log-application.md` — adjacent reference; change-log patterns are the other behavioural signal alongside `role_summary`.
- `AI_IMPLEMENTATION_GUIDE.md` § 7 — rollup function that populates `role_summary`.
- `output-schema.md` — change-log entry shape for personalisation signals.
