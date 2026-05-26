# Personalization

How `role_summary` and `role_summary_global` modulate output. Loaded when `role_summary` is non-null.

Two signals: per-user history for this `role_slug`, and anonymised global aggregate across all users on the same `role_slug`. They blend by data density — sparse user history shifts weight to the global prior.

---

## Inputs

The worker passes two objects of identical shape:

- `role_summary` — per-user, keyed `user:{uid}:role-summary:{slug}` in `ANALYTICS` KV.
- `role_summary_global` — anonymised aggregate, keyed `global:role-summary:{slug}`.

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

The user copy is null until the first generation for this role. The global copy is null only when no user has generated for this role anywhere.

---

## Blending logic

| `application_count` | Behaviour |
|---|---|
| ≥ 3 | Trust per-user history fully. Ignore the global prior. |
| 1 – 2 | Blend. User signals decide style choice; density and format come from the global prior. |
| 0 (null `role_summary`) | Use the global prior for density and format. Style comes from `writingPrefs.style`. |
| Both null | Cold start. Use `style-matrix.md` defaults verbatim. |

---

## What gets personalised

`role_summary` shapes output decisions, not content correctness:

| Signal | Effect |
|---|---|
| `section_density_observed.{section}.avg_bullets_after_edit` | Targets bullet count toward the user's revealed preference, within the style's range. |
| `section_density_observed.{section}.avg_chars_per_bullet` | Targets bullet length toward the user's revealed preference. |
| `section_format_observed.{section}` | Uses the user's revealed format when it consistently overrides the style default. |
| `manual_edit_signals.common_user_replacements` | Generates the user's preferred replacement instead of the original (e.g., "led" instead of "drove" after six edits). |
| `preferred_styles` | When `writing_style` is unset, defaults to the most-accepted style. |
| `preferred_packages` | When `package` is unset, defaults to the most-selected package. |

What `role_summary` does **not** touch:

- Banned word lists (absolute).
- Style constraints (`primaryConstraint`, `constraintAvoid`, `constraintPrefer`) — pure functions of the style.
- Section presence (the skeleton decides).
- ATS tier (`cv-skeleton.md` § Tier inference).
- JD Gap Closure claim validity.

---

## Global prior usage

`role_summary_global` informs structure (typical bullet length for a Product Manager) but never wording — no user's specific phrasing surfaces to another user. Used in two contexts:

1. **Cold start** — user has no history with this `role_slug`.
2. **Sparse history** — `application_count < 3` triggers the blend.

When `role_summary_global` is also null or has fewer than 50 applications across all users, fall back to `global:section-defaults` — a coarser prior built across all roles. Single KV entry, same shape, `role_slug=ALL`. Updated on every event.

---

## Privacy

`manual_edit_signals.common_user_replacements` captures word-level patterns from the user's change log. The signal stays per-user — never aggregated globally, because individual word choices can leak personal voice.

When the daily retention sweeper trims `change_log.before_text` and `after_text`, the manual-edit signals already aggregated into `role_summary` persist as counts. The aggregate survives the text trim.

"Wipe my analytics" (`AI_IMPLEMENTATION_GUIDE.md` § 8.2) deletes the user's `role_summary` along with the events. The user starts cold next time.

---

## When personalisation is ignored

- **`writingPrefs.overrides[field] === true`** — the user's explicit override wins for that field.
- **Recent style cascade** — within 30 seconds of `style.cascade`, the new style's `sectionFormatDefaults` win over previously observed preferences.
- **JD Gap Closure conflict** — a confirmed claim demanding a section the user has dropped causes the section to appear regardless.

---

## Change-log entries

Every personalisation effect produces a change-log entry naming the signal:

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

User edits to that section are captured against the same `application_id`; the next rollup updates the signal.

---

## Cross-references

- `style-matrix.md` — base defaults that personalisation modifies.
- `cv-skeleton.md` / `cv-skeleton-academic.md` — section structure that personalisation respects.
- `change-log-application.md` — the other behavioural signal.
- `AI_IMPLEMENTATION_GUIDE.md` § 7 — rollup function.
- `output-schema.md` — change-log entry shape.
