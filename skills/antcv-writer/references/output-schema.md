# Output schema

The full JSON shape the skill returns. Loaded on every call. Strict — the worker validates against this schema before passing the output downstream.

The skill always returns valid JSON. No prose preamble, no postamble, no Markdown wrappers. Errors are JSON objects too (see § Error responses).

---

## Top-level shape

```json
{
  "schema_version": "0.1.0",
  "generation_id": "gen_xxx",
  "application_id": "app_xxx",
  "role_slug": "product-manager",
  "role_label_raw": "Senior Product Manager — Maersk",
  "writing_style": "achievement-driven",
  "package": "navy-executive",
  "target_language": "en",
  "target_pages": 1.5,
  "target_ats_tier": "modern",
  "target_use_case": "commercial",
  "career_stage": null,
  "commercial_seniority": "senior",
  "sections": { /* see § Sections */ },
  "change_log_proposals": [ /* see § Change log proposals */ ],
  "flagged": false,
  "warnings": []
}
```

| Field | Required | Notes |
|---|---|---|
| `schema_version` | yes | Always `"0.1.0"` at this version. |
| `generation_id` | yes | Echoed from the request; identifies this generation in `change_log`. |
| `application_id` | yes | Echoed from the request. |
| `role_slug` | yes | Inferred or echoed from request. |
| `role_label_raw` | yes | Verbatim from the JD heading; not normalised. |
| `writing_style` | yes | One of the twelve canonical names. |
| `package` | yes | Echoed from request; never modifies content (independence contract). |
| `target_language` | yes | Two-letter ISO code. |
| `target_pages` | yes | Number from the request. |
| `target_ats_tier` | yes | `"modern"` or `"legacy"`. |
| `target_use_case` | yes | `"commercial"`, `"academic"`, `"cold-outreach"`, or `"hybrid"`. |
| `career_stage` | conditional | Required when `target_use_case === "academic"`; null otherwise. |
| `commercial_seniority` | conditional | Required when `target_use_case !== "academic"`; null otherwise. |
| `sections` | yes | The generated content. Required keys vary by `target_use_case` and `requested_sections`. |
| `change_log_proposals` | yes | Array; can be empty when nothing was modified. |
| `flagged` | yes | `true` when the worker should surface a retry decision to the user. |
| `warnings` | yes | Array of strings; can be empty. |

---

## Sections

The `sections` object's keys come from the canonical section set per `cv-skeleton.md` (commercial) or `cv-skeleton-academic.md` (academic). Each section's value follows a per-section sub-schema.

### Paragraph sections

For `profile`, `who_i_am`, `why_this_position`, `research_summary`:

```json
{
  "profile": {
    "format": "paragraph",
    "content": "...",
    "char_count": 312
  }
}
```

| Field | Notes |
|---|---|
| `format` | Always `"paragraph"` for paragraph sections. |
| `content` | The rendered text in `target_language`. |
| `char_count` | Character count of `content`. |

### Bullet sections

For `selected_outcomes`, `selected_research_outcomes`, `tools_methods` (in some styles), `certifications`, `publications_patents`, `additional_information`, `conferences_talks`:

```json
{
  "selected_outcomes": {
    "format": "bullets",
    "items": [
      {
        "title": "Cut review cycles 40%",
        "body": "Pre-screened customer change requests against ASPICE checklist before formal board, reducing average closure time from 25 days to 15.",
        "word_count": 24
      },
      {
        "title": "Two ASPICE re-certifications, zero findings",
        "body": "Drove preparation across optical, electrical, and software teams; coordinated assessor reviews; closed all open items pre-audit.",
        "word_count": 19
      }
    ]
  }
}
```

| Field | Notes |
|---|---|
| `format` | `"bullets"` or `"bullets-prominent"` or `"bullets-narrative"` or `"bullets-condensed"` depending on style. |
| `items` | Array. Each item has `title` (optional for some styles) and `body`. |
| `items[*].word_count` | Word count of `body`. Used by the Density Engine. |

For bullets that have no title (e.g., `experience` bullets):

```json
{
  "items": ["Led change control across three automotive tier-1 customer programmes; owned customer change request closure and system architecture handover.", "Built requirements traceability between optical subsystem and ECU software teams; introduced pre-board ASPICE screening to reduce review cycles.", "Cut average review cycle time 40%; supported two ASPICE re-certifications with zero major findings."]
}
```

### Table-grid sections

For `core_competencies`, `what_i_bring`, `tools_methods` (in some styles):

```json
{
  "core_competencies": {
    "format": "table-grid",
    "parser_safe_separator": "em_dash",
    "rows": [
      {"focus_area": "Change governance", "expertise": "Multi-vendor change boards across three tier-1 customer programmes"},
      {"focus_area": "System architecture", "expertise": "Hardware-software interface ownership; requirements traceability"}
    ]
  }
}
```

| Field | Notes |
|---|---|
| `format` | `"table-grid"` or `"structured-grid"` (denser, two or three columns). |
| `parser_safe_separator` | `"em_dash"` for em dash. Always set on table-grid for ATS-Legacy flattening. |
| `rows` | Array of objects with two or three columns (`focus_area` + `expertise` is the standard pair). |

When `target_ats_tier === "legacy"`, the same content is emitted as `bullets`:

```json
{
  "core_competencies": {
    "format": "bullets",
    "items": [
      "Change governance — Multi-vendor change boards across three tier-1 customer programmes",
      "System architecture — Hardware-software interface ownership; requirements traceability"
    ]
  }
}
```

### Experience section

The `experience` key is special — it is an array of role objects, not a single section object:

```json
{
  "experience": [
    {
      "company": "Innoviz Technologies",
      "role": "System Architect & Change Control Lead",
      "years": "2020 — 2025",
      "location": "Israel / Remote",
      "format": "bullets",
      "items": ["...", "...", "..."]
    }
  ]
}
```

Same shape for `research_experience` in academic skeletons.

### Structured-grid sections

For `publications` (academic), `teaching_supervision`, `grants_fellowships`:

```json
{
  "publications": {
    "format": "structured-grid",
    "groups": [
      {
        "type": "journal",
        "entries": [
          {
            "authors": "Karp-Gershon, G., Garcia, M., et al.",
            "year": 2023,
            "title": "Low-loss As-Se waveguides on silicon for mid-infrared sensing",
            "venue": "Optics Express",
            "volume_issue_pages": "31(15), 24578 – 24590",
            "doi": "10.1364/OE.485124",
            "candidate_role": "first author"
          }
        ]
      }
    ]
  }
}
```

### Cover letter section

When the request includes cover-letter sections, the output has a top-level `cover_letter` key:

```json
{
  "cover_letter": {
    "cl_header": {
      "name": "Gabriel Alexander Karp-Gershon",
      "application_line": "Application: Senior Product Manager — Maersk",
      "contacts": ["email@example.com", "linkedin.com/in/...", "Copenhagen, Denmark"]
    },
    "cl_opener": {
      "salutation": "Dear Hiring Team,",
      "opening": "I am applying for the Senior Product Manager position at Maersk..."
    },
    "who_i_am": "I am a technical product manager with twelve years across...",
    "what_i_bring": {
      "format": "table-grid",
      "parser_safe_separator": "em_dash",
      "rows": [
        {"focus_area": "Customer-facing product ownership", "expertise": "..."}
      ]
    },
    "why_this_position": "This role sits at the intersection of...",
    "how_i_would_contribute": ["...", "...", "..."],
    "foundation": {
      "hands_on": "I am ready to spend the first weeks...",
      "professionally": "This role would be a natural continuation..."
    },
    "cl_close": {
      "sign_off": "Kind regards,",
      "signature": "Gabriel Alexander Karp-Gershon"
    },
    "char_count": 1240
  }
}
```

See `cl-skeleton.md` for the per-section rules.

---

## Change log proposals

Every modified section produces one or more change-log proposals:

```json
{
  "change_log_proposals": [
    {
      "section": "profile",
      "source": "llm",
      "before_text": null,
      "after_text": "Technical product manager with 15 years across...",
      "reason": "first draft applying measured-professional voice",
      "confidence": "high",
      "risk": "none",
      "char_delta": 312
    },
    {
      "section": "selected_outcomes",
      "source": "llm",
      "before_text": null,
      "after_text": "...",
      "reason": "applied jd_gap_claim_xxx as factual evidence for 5+ years functional safety claim",
      "confidence": "medium",
      "risk": "none",
      "char_delta": 450
    }
  ]
}
```

| Field | Notes |
|---|---|
| `section` | The section key the entry applies to. |
| `source` | `"llm"` for skill-generated; `"user"` for user-edited (worker generates user-source entries). |
| `before_text` | Previous content; null on first generation. |
| `after_text` | New content. |
| `reason` | Free-form human-readable. The skill writes diagnostic reasons that the user sees. |
| `confidence` | `"high"`, `"medium"`, or `"low"`. |
| `risk` | `"invented"`, `"overstated"`, `"too-generic"`, or `"none"`. |
| `char_delta` | `len(after_text) - len(before_text)`. |

### Confidence and risk semantics

**Confidence:**

- `high` — the content is fully supported by the kernel and the skill is confident in the framing.
- `medium` — the content is supported but the framing involves a judgement (which outcome to lead with, how to phrase a transition).
- `low` — the content is partially supported or the skill had to make a judgement under uncertainty (e.g., applying a JD Gap Claim without a linked experience).

**Risk:**

- `invented` — the content includes a fact not traceable to the kernel. The skill should not produce `invented` entries; this value appears when a downstream filter detects the issue.
- `overstated` — the content claims more than the kernel supports (scope, level of involvement, recency).
- `too-generic` — the content lacks the specificity expected for the style or section.
- `none` — the content is well-supported and appropriately specific.

---

## Flagged generations

`flagged: true` signals to the worker that the user should be involved before this generation is accepted. The skill flags in these cases:

- The post-filter retry exhausted (the worker handles retries; the skill receives the request as a re-run and may flag if retries continue).
- A JD Gap Claim conflicts with the kernel (see `jd-gap-closure.md`).
- A section came back with `confidence: low, risk: invented` after softening from `change-log-application.md`.

The worker decides what to do with the flag — typically surface it to the user with the change-log entry's reason.

---

## Warnings

Free-form strings the worker can surface to the user. Examples:

- `"truncated_experience_section_to_fit_target_pages"` — `target_pages = 1` cut some roles.
- `"package_recommendation_mismatch"` — the chosen package is not in the style's recommended pairings (informational, not blocking).
- `"jd_gap_claim_applied_without_linked_experience"` — a confirmed JD Gap Claim is used without a kernel anchor.

---

## Error responses

When the skill cannot produce content, it returns an error object instead of the standard output:

```json
{
  "schema_version": "0.1.0",
  "error": "unknown_section",
  "section": "executive_summary",
  "context": "section key not in cv-skeleton.md or cv-skeleton-academic.md"
}
```

Error types:

- `unknown_section` — `requested_sections` includes a name not in either skeleton.
- `unsupported_language` — `target_language` not in the supported list.
- `unknown_writing_style` — `writing_style` not in `style-matrix.md`.
- `insufficient_input` — `user_state.profile` is empty or missing required fields for the requested operation.
- `jd_text_empty` — `jd_text` is empty or below the minimum threshold (40 characters).

The worker surfaces errors to the PWA with the structured payload; the PWA displays the user-facing message.

---

## Validation

The worker validates the skill's output against this schema before passing it downstream. Validation failures retry with a corrective prompt (up to 2 retries per generation). After 2 failed retries, the worker surfaces a generation failure to the PWA.

The skill's responsibility is to produce valid output that satisfies this schema on the first try whenever possible.

---

## Cross-references

- `SKILL.md` § Output — the same schema, condensed.
- `cv-skeleton.md` — section keys for commercial output.
- `cv-skeleton-academic.md` — section keys for academic output.
- `cl-skeleton.md` — cover letter section structure.
- `change-log-application.md` — how `confidence` and `risk` values modulate subsequent generations.
- `jd-gap-closure.md` — how confirmed JD Gap Claims surface in `change_log_proposals`.
- `language-output.md` — how `target_language` affects section content (but not section keys).
- `AI_IMPLEMENTATION_GUIDE.md` § 6 — worker-side change-log capture.
