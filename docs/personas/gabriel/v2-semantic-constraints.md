# Gabriel — semantic context constraints (V2 format)

Owner 2026-06-17: three semantic context constraints adapted to the **V2
constraints format** (`{ trigger, avoid[], prefer[], reason }`, with an optional
`scope` for conditionals). Paste the V2 array into Gabriel's kernel JSON
(`constraints`/`semanticConstraints`); the runtime reader is being widened to
accept this shape (see "Integration", below).

The third constraint is **already enforced in the generation engine** by
GEN-PROFILE-001 (strengthened in 1.50.562 to also catch "Deep Tech" / "Photonic"
/ "Electro-optics Engineer") — its V2 object is recorded here for completeness.

## V2 constraints

```json
[
  {
    "id": "team-coordination",
    "trigger": "team coordination without direct line management",
    "avoid": ["led a team", "managed a team", "people manager"],
    "prefer": [
      "supervised technically",
      "coordinated engineering work",
      "directed technical activities",
      "guided implementation",
      "owned technical direction",
      "coordinated the Sigma-Connectivity ODM engineering team (Sweden)"
    ],
    "reason": "Avoid overstating formal people-management responsibility. Gabriel coordinated technical work and guided implementation without holding formal line-management (HR) authority over reports. CANONICAL CASE — Sirin Labs: the 7-person task force he 'led' was the Sigma-Connectivity ODM (Original Design Manufacturer) engineering team at the SWEDEN site, coordinated across an ODM / partner relationship — an external manufacturing-partner team, NOT internal direct reports — so 'led/managed a team' materially overstates the relationship.",
    "scope": { "role_company": "Sirin Labs", "site": "Sweden", "partner": "Sigma-Connectivity (ODM)" }
  },
  {
    "id": "agile-out-of-pm-context",
    "trigger": "the word 'agile' used OUTSIDE a project-management workflow/tools context (i.e. as a general personal quality rather than the methodology)",
    "avoid": ["agile"],
    "prefer": ["flexible", "resourceful", "adaptable"],
    "reason": "Keep 'agile' ONLY when naming the PM methodology, framework, ceremony, or tooling (Scrum, Kanban, sprints, backlog). When the word would describe a personal trait or general way of working, use a plain synonym instead."
  },
  {
    "id": "unsolicited-profile-opener",
    "trigger": "the PROFILE subsection OPENING in an unsolicited application (empty / no posted position)",
    "avoid": ["Electro-optics Engineer", "Deep Tech", "Photonic"],
    "prefer": ["IT professional"],
    "reason": "An unsolicited / general application leads with the broad IT-professional identity, not a narrow specialty. Already enforced in-engine by GEN-PROFILE-001 (retry gate + instruction).",
    "scope": { "section": "profile", "position": "opening", "application_type": "unsolicited" }
  },
  {
    "id": "kanzen-no-independent-flight-risk",
    "trigger": "describing the Kanzen Konsulenter ApS engagement when the TARGET job in the JD is NOT a consultancy / independent / contractor position",
    "avoid": ["Independent", "Founder", "Co-Founder", "Establisher", "self-employed"],
    "prefer": ["advisory and project engagements", "delivered consulting projects for clients", "client advisory work"],
    "reason": "For a regular employee position, an 'Independent / Founder / Establisher' self-label on the Kanzen role signals a FLIGHT RISK — it reads as someone too independent who will leave quickly. Keep this framing ONLY when the target role is itself a consultancy / independent / contractor position.",
    "scope": { "role_company": "Kanzen Konsulenter ApS", "jd_excludes": ["consultancy", "independent", "contractor"] }
  }
]
```

Constraint #4 is **engine-enforced** (no kernel edit needed): ROLE-FOUNDER-001 in
the generation prompt was strengthened (1.50.563) to ban "Founder/Co-Founder/
Establisher" outright and to allow the "Independent" framing for Kanzen ONLY when
the JD itself names a consultancy/independent/contractor role — otherwise it
describes the actual advisory/client work without the self-label.

## Functional today — `stylePrefs.bannedContextual`

Constraints #1 and #2 also work **right now** without the V2 reader, in the
shape the live prompt already reads (`app.src.js` ~2811: avoid / use_instead /
note / optional `when`). Add these to `personalInfo.stylePrefs.bannedContextual`
(global — no `when`, so they apply across all prose):

```json
[
  {
    "avoid": "led a team, managed a team, people manager",
    "use_instead": "supervised technically, coordinated engineering work, directed technical activities, guided implementation, owned technical direction",
    "note": "team coordination without direct line management — do not overstate formal people-management authority",
    "when": { "role_company": "sirin" },
    "context_note": "At Sirin Labs the 7-person task force was the Sigma-Connectivity ODM engineering team at the Sweden site (an external partner team, not direct reports). Engine-enforced by SIRIN-SEMANTICS-001; this bannedContextual entry is the kernel mirror."
  },
  {
    "avoid": "agile",
    "use_instead": "flexible, resourceful, adaptable",
    "note": "ONLY when 'agile' is used outside a project-management workflow/tools context; keep 'agile' when naming the PM methodology, framework, ceremony, or tooling"
  }
]
```

Constraint #3 needs no `bannedContextual` entry — GEN-PROFILE-001 owns the
"unsolicited PROFILE opener → IT professional" rule end-to-end.

## Banned words (English)

- **"discuss"** (English output only) — owner 2026-06-17: to Danish / Scandinavian
  readers "discuss" reads as *urging / pressuring*. Use "talk through", "explore",
  "go through", or "a conversation about" instead. **Engine-enforced** (1.50.565):
  the CL closure structure, the placeholder template, and the hardcoded fallback
  closure were reworded off "discuss", and the closure instruction now carries an
  explicit English-only ban. Danish output may use "drøfte" / "tale om" normally.
  Add `discuss` to `stylePrefs.banned_words` in the kernel to also cover any
  non-closure prose.

## Integration notes

- The current `bannedContextual` reader supports `avoid`/`pattern`,
  `use_instead`/`replacement`, `note`, and `when.{role_company|role_title}`.
  The V2 fields (`trigger`, `avoid[]` array, `prefer[]` array, `reason`) are a
  **superset**; widening the reader to normalise them (`avoid[]→join`,
  `prefer[]→use_instead`, `reason→note`, `trigger→context phrase`) is the next
  step so V2 constraints become functional through the same channel. Until then,
  use the `bannedContextual` shapes above for #1/#2.
- `scope` (section/position/application_type) — as in #3 — is beyond the current
  role-match `when`; it is honoured today only for the profile-opener case via
  GEN-PROFILE-001. General `scope` support is part of the Kernel-v2 build.
