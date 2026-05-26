# JD Gap Closure

How user-confirmed claims about gaps in the JD vs the candidate's profile become factual evidence the skill uses on subsequent generations. Loaded when `user_state.jdGapClaims` is non-empty for the current application.

The flow exists because JDs often ask for qualifications, tools, or experience the candidate has but has not surfaced in their kernel. Rather than the skill silently asserting the candidate has what the JD asks for (which would invent), or silently dropping the JD's requirement (which would weaken the application), the PWA asks the user explicitly: "Do you have X?". A confirmed answer becomes a `jdGapClaim` — a structured piece of evidence the skill treats as factual on future generations.

---

## Inputs

```json
{
  "user_id": "uid_xxx",
  "application_id": "app_xxx",
  "jdGapClaims": [
    {
      "id": "claim_xxx",
      "ts": 1748257200,
      "application_id": "app_xxx",
      "gap_id": "gap_xxx",
      "jd_requirement": "5+ years in functional safety",
      "user_response": "confirmed",
      "evidence_text": "Led ASPICE assessment at Innoviz 2022 – 2024",
      "linked_experience_id": "exp_innoviz_2"
    },
    {
      "id": "claim_yyy",
      "ts": 1748257300,
      "application_id": "app_xxx",
      "gap_id": "gap_yyy",
      "jd_requirement": "Six Sigma certification preferred",
      "user_response": "denied",
      "evidence_text": null,
      "linked_experience_id": null
    }
  ]
}
```

Each claim has a `user_response` of `confirmed` or `denied`. Confirmed claims with `evidence_text` are usable; denied claims are recorded so the skill knows not to claim that qualification.

---

## How claims are surfaced

The PWA runs JD analysis before generation. The analyser identifies stated requirements (years of experience, named certifications, named tools, named methodologies) and cross-references them against `user_state.profile`. A gap exists when a JD requirement is not unambiguously covered by the profile.

For each gap, the PWA surfaces a modal: "The JD asks for 5+ years in functional safety. Your profile shows ASPICE work at Innoviz but does not explicitly mention years in functional safety. Do you have 5+ years experience here?" The user responds confirmed (with optional evidence text) or denied.

Each response writes a `jdGapClaim` to `user:{uid}:jdGapClaims` KV with the structure above. The PWA also writes an event (`jd_gap.user_confirmed` or `jd_gap.user_denied`) to D1.

---

## How the skill uses confirmed claims

The skill treats a confirmed claim as **factual evidence equivalent to a `user_state.profile.experiences` entry**, subject to these rules:

### Surfacing in content

A confirmed claim with `linked_experience_id` is folded into the relevant section's content. Where the JD requirement names a specific qualification or scope, the skill surfaces that qualification on the next generation alongside the linked experience.

**Example.** A confirmed claim "5+ years in functional safety" linked to `exp_innoviz_2` causes the skill to surface "five years in functional safety" in the relevant CV section. The supporting experience entry is unchanged; the claim adds the framing the JD asked for.

### Surfacing without a linked experience

A confirmed claim without `linked_experience_id` is still factual evidence, but the skill cannot anchor it to a specific role. It surfaces in `core_competencies` or `selected_outcomes` with the claim's `evidence_text` providing the body.

The skill generates a `change_log_proposals` entry: `reason: "applied_jd_gap_claim", confidence: medium, risk: none`. The user sees the surfaced claim in the next generation and can revise if needed.

### Surfacing in cover letter

Confirmed claims are particularly important in the cover letter (`cl-skeleton.md`). The `why_this_position` and `how_i_would_contribute` sections can reference confirmed claims directly, because the cover letter narrative supports the framing better than CV bullets do.

**Example cover letter sentence:**

> "My five years in functional safety include ISO 26262 lead assessor work at Innoviz, where I owned ASIL-D safety case development for the LiDAR optical subsystem."

The "five years in functional safety" is the claim; the rest is from the kernel.

---

## How the skill uses denied claims

A denied claim tells the skill **not to imply** the requirement is met. The skill does not surface a denial in content — the JD requirement remains unaddressed, which is fine. The PWA surfaces denied claims in the application summary so the user knows which JD requirements went unaddressed in this generation.

The skill records the denial in `change_log_proposals`: `reason: "jd_requirement_unaddressed_per_user_denial", confidence: high, risk: none`. The risk is `none` because honest absence is not a risk; it is correctness.

---

## Conflict handling

A `jdGapClaim` conflicts with `user_state.profile.experiences` when:

- The claim asserts a level of involvement (led, owned, designed) that the experience entry contradicts (assisted, supported, observed).
- The claim asserts a year range that the experience entry does not support.
- The claim asserts a scope (three programmes, two regions) that the experience entry contradicts.

When a conflict is detected, the skill does **not** silently merge. It emits a `change_log_proposals` entry:

```json
{
  "section": "selected_outcomes",
  "source": "llm",
  "before_text": null,
  "after_text": null,
  "reason": "jd_gap_claim_conflicts_with_kernel_experience",
  "confidence": "low",
  "risk": "overstated"
}
```

And uses the kernel value, not the claim. The PWA surfaces the conflict so the user can resolve it — either by editing the kernel experience entry to match the claim, or by retracting the claim.

This rule is enforced strictly. The skill never "smooths over" a kernel-vs-claim conflict by picking the higher claim.

---

## Claim lifecycle

Claims persist across generations within the same `application_id`. They also influence future applications for the same `role_slug`:

- The user can promote a claim to a permanent kernel entry via Settings → Profile → "Confirmed JD claims" → "Add to profile". This creates a new `user_state.profile.experiences` entry from the claim and removes the claim from `jdGapClaims`.
- The user can revoke a claim via the same UI. Revocation deletes the claim and writes a `jd_gap.user_revoked` event. The next generation does not surface the claim.
- The skill respects per-application boundaries: a claim made on application A is not automatically used on application B, even for the same role. The PWA re-runs JD analysis per application and may surface the same gap; the user can re-confirm or change their answer.

---

## Privacy considerations

JD Gap Claims contain user-asserted information that may be more sensitive than the underlying CV. The user's text in `evidence_text` is captured verbatim and retained per the same retention policy as `change_log` (default 90 days). Aggregated across multiple applications, recurring JD Gap Claim patterns inform the user's `role_summary` — but the raw text is never aggregated across users.

The "Wipe my analytics" flow (see `AI_IMPLEMENTATION_GUIDE.md` § 8.2) deletes `jdGapClaims` along with the other per-user data. There is also a per-claim revocation in Settings → Privacy → "JD Gap Claims".

---

## Cross-references

- `cv-skeleton.md` § Content rules — sections where confirmed claims surface.
- `cl-skeleton.md` § `why_this_position` and `how_i_would_contribute` — sections particularly informed by claims.
- `AI_IMPLEMENTATION_GUIDE.md` § 5 — full implementation of the JD Gap Closure endpoint and event flow.
- `personalization.md` — adjacent reference; `jdGapClaims` is per-application, while `role_summary` is per-role aggregate.
- `output-schema.md` — change-log entry shape for claim surfacing and conflicts.
