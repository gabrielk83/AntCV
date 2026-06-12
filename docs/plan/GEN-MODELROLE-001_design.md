# GEN-MODELROLE-001 — role-specialized model map (design)

Status: **DESIGN APPROVED-PENDING-OWNER** · 2026-06-12 · owner queue item
("writer/supervisor/coherence model map — design-first").

## Problem

The multi-LLM cascade (Anthropic → OpenAI → Mistral → Gemini) is FAILOVER
only: every pipeline stage runs on whichever provider answers first, and the
writer model checks its own output. Cost concentrates in the wrong places
(supervisor/SCE checks on top-tier models) and self-review shares the
writer's blind spots (GEN-SCE-FLAG-001, GEN-LANGFAB-001 both shipped past a
same-model check).

## Roles

| Role | Today | Target | Why |
|---|---|---|---|
| **WRITER** ("Heiko") | cascade head | strongest prose model, higher temperature | quality lives here; concentrate cost here |
| **SUPERVISOR** ("Feivel") | same as writer | a DIFFERENT, cheaper model, temp 0, JSON output | different blind spots; grounding/banned/VERB-LED checks are mechanical |
| **COHERENCE** | same as writer | large-context model (writer-class or dedicated) | cross-section pass needs the full doc in context |

## Wire design (v1 — minimal, fail-soft)

1. **Config**: one JSON env var on cv-proxy + demo-proxy:
   `MODEL_ROLES = {"writer":"anthropic","supervisor":"mistral","coherence":"anthropic"}`
   Values are provider ids the cascade already understands. Absent/invalid →
   current behavior exactly (cascade head for everything). No client change
   needed for v1.
2. **Routing hook**: the proxy already tags requests with `augTask` (the
   X-AntCV-Task / task field). Map task → role:
   - `supervisor_check`, SCE retry calls → `supervisor`
   - `gen_coherence` → `coherence`
   - everything generation-shaped (`parse_jd`, `generate_cv`, `enrich`,
     `compress`, section regens) → `writer`
   At the provider-selection point, when MODEL_ROLES names a provider for the
   resolved role AND a server key exists for it, PREFER it as the cascade
   head; the existing failover order follows unchanged (the map reorders, it
   never removes).
3. **Telemetry**: log `role` + chosen provider into the existing
   `writing-engine:*` / `llm_calls` records so the owner can compare quality
   and cost per role before hardening.
4. **Client (v2, optional)**: surface a read-only "model crew" line in
   Settings → Routing showing the live map (GET /api/config already returns
   public config).

## Per-role provider recommendation (initial)

- writer: `anthropic` (current de-facto head; strongest prose)
- supervisor: `mistral` (cheap, fast, structured-JSON reliable, different
  family from the writer)
- coherence: `anthropic` (large context; revisit if cost says otherwise)

## Decisions needed from the owner

1. Approve the provider assignments above (or name alternatives).
2. Whether the supervisor should ALSO take the SCE retry re-calls (cheaper,
   but the retry then re-writes prose with the weaker model — recommendation:
   NO for v1; retries stay on the writer).
3. Cost ceiling per generation, if any, before we add per-role model SIZES
   (e.g. haiku-class supervisor) rather than just per-role providers.

## Non-goals (v1)

- No per-role temperature/system-prompt changes (separate knob, later).
- No client-side routing changes — the proxy owns the map.
- No removal of the failover ladder.

## Acceptance

With `MODEL_ROLES` set: a generation shows writer-role calls on the writer
provider and supervisor/SCE-check calls on the supervisor provider in
`llm_calls` / KV telemetry; with the var unset, behavior is byte-identical
to today (covered by a unit test on the resolver).
