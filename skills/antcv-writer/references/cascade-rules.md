# Cascade rules

Reference for which `writingPrefs` and `layoutPrefs` fields are re-seeded when the user changes `writing_style` or `package`. The cascade is executed by the worker (see `AI_IMPLEMENTATION_GUIDE.md` § 4); the skill always reads post-cascade state.

The skill never triggers cascades. This document exists so an implementer (or a reader debugging unexpected output) can see exactly what gets re-seeded and what is preserved across a style or package change.

---

## Style cascade

Triggered when the user changes `writing_style` via the PWA. The PWA calls `/v1/prefs/style` with the new style name. The worker updates `user:{uid}:writingPrefs` per the rules below and emits a `style.cascade` event.

### Fields re-seeded from the new style row

When `writingPrefs.overrides[field]` is not `true`, the field is re-seeded from the new style's row in `style-matrix.md`:

| Field | Source on cascade |
|---|---|
| `chips` | `style.defaultToneChips` |
| `lineDensity` | `style.lineDensity` |
| `wordsPerBullet` | `style.wordsPerBullet` |
| `profileChars` | `style.profileChars` |
| `sectionFormatDefaults` | `style.sectionFormatDefaults` |
| `compressionTolerance` | `style.compressionTolerance` |
| `preserveCompressPriority` | `style.preserveCompressPriority` |

### Fields preserved when the user has overridden them

If `writingPrefs.overrides[field] === true` (set by the editor when the user customised the field), the cascade leaves it alone.

Common override patterns:

- User customised `sectionFormatDefaults.profile` to `bullets` for a specific style and wants that to persist across style switches. `overrides.sectionFormatDefaults` set to `true`.
- User explicitly added `concrete` to tone chips and wants it to survive style changes. `overrides.chips` set to `true`.
- User adjusted `wordsPerBullet` for personal density preference. `overrides.wordsPerBullet` set to `true`.

### Fields not cached on `writingPrefs`

These are pure functions of the style and are read at generation time from `style-matrix.md` and `styles/{name}.md`. They are not stored in `writingPrefs`, do not cascade, and cannot be overridden at the style level:

- `primaryConstraint`
- `constraintAvoid`
- `constraintPrefer`
- `contentRule`
- `avoidRule`
- `atsBehavior`

To override these, the user would change to a different style — they are the style's identity.

### Cascade event payload

```json
{
  "event_type": "style.cascade",
  "ts": 1748257200,
  "user_id": "uid_xxx",
  "from": "measured-professional",
  "to": "achievement-driven",
  "cascaded_fields": ["chips", "lineDensity", "wordsPerBullet", "profileChars", "sectionFormatDefaults", "compressionTolerance", "preserveCompressPriority"],
  "preserved_overrides": []
}
```

When `preserved_overrides` is non-empty, the user has overrides that the cascade respected.

---

## Package cascade

Triggered when the user changes `package` via the PWA. The PWA calls `/v1/prefs/package`. The worker updates `user:{uid}:profile.activePackage` and the visual-token snapshot, then emits a `package.cascade` event.

The package cascade affects **only visual tokens**, never content. The skill's output is unchanged by a package cascade — see the independence contract in `design-packages.md`.

### Fields re-seeded from the new package

| Field | Source on cascade |
|---|---|
| `tokens.base` | `package.base` |
| `tokens.primary` | `package.primary` |
| `tokens.interactive` | `package.interactive` |
| `tokens.bullet` | `package.bullet` |
| `tokens.glyph` | `package.glyph` |
| `tokens.headingFont` | `package.headingFont` |
| `tokens.bodyFont` | `package.bodyFont` |
| `tokens.shape` | `package.shape` (photo shape) |
| `tokens.imageSize` | `package.imageSize` |

These come from `packages/registry.json` in the AntCV repo.

### Fields preserved on package cascade

If the user has set per-token overrides (e.g., custom photo shape independent of the package), the cascade respects them. The override flag lives on the user's `profile.packageOverrides[field]`.

### Why package cascade does not touch `writingPrefs`

Visual tokens (`tokens.*`) live on `profile`, not on `writingPrefs`. The two cascades are independent — switching package never modifies `writingPrefs`, and switching style never modifies `profile.tokens.*`. This separation enforces the independence contract.

### Cascade event payload

```json
{
  "event_type": "package.cascade",
  "ts": 1748257200,
  "user_id": "uid_xxx",
  "from": "copenhagen-modern",
  "to": "warm-terracotta",
  "cascaded_fields": ["base", "primary", "interactive", "bullet", "glyph", "headingFont", "bodyFont", "shape", "imageSize"],
  "preserved_overrides": []
}
```

---

## ATS tier change

`target_ats_tier` is not stored on `writingPrefs` or on `profile` — it is a per-application export choice that the worker reads from the request, or infers from the JD per `cv-skeleton.md` § Tier inference. Switching the tier does not trigger a cascade. The worker simply uses the requested tier on the next generation.

If the user wants a different tier as the default, they set it in Settings → Export → ATS tier. That setting stores in `profile.defaultAtsTier`; the worker uses it as the default when no explicit `target_ats_tier` is in the request.

---

## Cascade ordering

If the user changes both style and package in rapid succession (e.g., picks a new style during onboarding, then changes the package immediately), the worker handles the two cascades sequentially:

1. Style cascade fires first, updating `writingPrefs`.
2. Package cascade fires next, updating `profile.tokens.*`.
3. The next generation reads both post-cascade states.

The PWA debounces user input by 500 ms before triggering cascades; intermediate clicks are dropped.

---

## Cascade rollback

The PWA does not provide a "undo cascade" UI. If the user wants to revert, they change the style or package back; the cascade fires again with the previous value.

Per-field rollback is also not provided. To revert a specific field after a cascade, the user edits the field directly in Settings, which sets `overrides[field] = true` and the value stays through future cascades.

---

## Cross-references

- `AI_IMPLEMENTATION_GUIDE.md` § 4 — full cascade implementation including code.
- `style-matrix.md` § Cascade interactions — the per-field list.
- `design-packages.md` § The independence contract — why style and package cascades are independent.
- `personalization.md` — `role_summary` signals do not cascade; they are role-scoped, not style-scoped.
