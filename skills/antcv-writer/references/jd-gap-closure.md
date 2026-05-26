# JD Gap Closure

How user-confirmed claims about JD-vs-kernel gaps become factual evidence on subsequent generations. Loaded when `user_state.jdGapClaims` is non-empty for the current application.

JDs often ask for qualifications, tools, or experience the candidate has but has not surfaced in their kernel. Three failure modes if unhandled:

- The skill invents the qualification (bad).
- The skill drops the JD requirement (weakens the application).
- The skill asks the user mid-generation (slow).

The flow asks the user explicitly **before** generation: "Do you have X?". A confirmed answer becomes a `jdGapClaim` — structured evidence treated as factual on future generations.

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

`user_response` is `confirmed` (with optional `evidence_text`) or `denied`. Denied claims tell the skill not to claim that qualification.

---

## How claims are surfaced

The PWA runs JD analysis before generation. The analyser identifies stated requirements (years of experience, named certifications, named tools, named methodologies) and cross-references them against `user_state.profile`. A gap exists when a requirement is not unambiguously covered.

For each gap, the PWA shows a modal:

> "The JD asks for 5+ years in functional safety. Your profile shows ASPICE work at Innoviz but does not explicitly mention years in functional safety. Do you have 5+ years experience here?"

The user responds confirmed (with optional evidence text) or denied. Each response writes a `jdGapClaim` to `user:{uid}:jdGapClaims` KV plus a `jd_gap.user_confirmed` or `jd_gap.user_denied` event to D1.

---

## Confirmed claims

The skill treats a confirmed claim as **factual evidence equivalent to a `user_state.profile.experiences` entry**.

### With `linked_experience_id`

The claim folds into the linked experience. The skill surfaces the JD's specific qualification or scope alongside the experience on the next generation. The supporting experience entry is unchanged; the claim adds the framing the JD asked for.

**Example.** Claim "5+ years in functional safety" linked to `exp_innoviz_2` causes "five years in functional safety" to surface in the relevant CV section.

### Without `linked_experience_id`

Still factual, but unanchored. Surfaces in `core_competencies` or `selected_outcomes` using the claim's `evidence_text` as the body. Logged: `reason: "applied_jd_gap_claim", confidence: medium, risk: none`. The user can revise on the next pass.

### In the cover letter

Cover letters carry confirmed claims more easily than CV bullets — narrative absorbs the framing. `why_this_position` and `how_i_would_contribute` (`cl-skeleton.md`) reference claims directly.

**Example.**

> "My five years in functional safety include ISO 26262 lead assessor work at Innoviz, where I owned ASIL-D safety case development for the LiDAR optical subsystem."

"Five years in functional safety" is the claim; the rest is kernel.

---

## Denied claims

A denied claim tells the skill **not to imply** the requirement is met. Nothing surfaces in content — the JD requirement stays unaddressed, which is correct. The PWA lists denied claims in the application summary so the user knows which requirements went unaddressed.

Logged: `reason: "jd_requirement_unaddressed_per_user_denial", confidence: high, risk: none`. Risk is `none` because honest absence is correctness, not risk.

---

## Conflict handling

A `jdGapClaim` conflicts with `user_state.profile.experiences` when the claim asserts:

- A level of involvement (led, owned, designed) the experience entry contradicts (assisted, supported, observed).
- A year range the experience entry does not support.
- A scope (three programmes, two regions) the experience entry contradicts.

On conflict, the skill does **not** silently merge. It logs:

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

Uses the kernel value, not the claim. The PWA surfaces the conflict so the user can resolve it — edit the kernel to match the claim, or retract the claim.

The skill never smooths over a kernel-vs-claim conflict by picking the higher claim.

---

## Claim lifecycle

Claims persist within the same `application_id` and influence future applications for the same `role_slug`:

- **Promote** — Settings → Profile → "Confirmed JD claims" → "Add to profile" creates a permanent `experiences` entry and removes the claim from `jdGapClaims`.
- **Revoke** — same UI deletes the claim and writes `jd_gap.user_revoked`. The next generation does not surface it.
- **Per-application scope** — a claim made on application A is not reused on application B even for the same role. JD analysis re-runs per application; the user can re-confirm or change their answer.

---

## Privacy

`evidence_text` is user-asserted and can be more sensitive than the underlying CV. Retained per the `change_log` retention policy (default 90 days). Aggregated patterns inform `role_summary`; the raw text never aggregates across users.

"Wipe my analytics" (`AI_IMPLEMENTATION_GUIDE.md` § 8.2) deletes `jdGapClaims` with the rest of the per-user data. Per-claim revocation also lives in Settings → Privacy → "JD Gap Claims".

---

## Cross-references

- `cv-skeleton.md` § Content rules — sections where confirmed claims surface.
- `cl-skeleton.md` § `why_this_position` and `how_i_would_contribute` — narrative-friendly sections.
- `AI_IMPLEMENTATION_GUIDE.md` § 5 — endpoint and event flow.
- `personalization.md` — `jdGapClaims` is per-application; `role_summary` is per-role aggregate.
- `output-schema.md` — change-log entry shape.
