# v2 kernel upload-test fixtures

Valid **v2-schema** kernel JSON files for testing the §4 upload→kernel ingestion pipeline
(the "🧬 Build / update kernel from CV" button in Settings → Personal / the onboarding wizard).
Each is generated and **validated through the real engine** (`projectV2ToWorkHistory` +
`detectGaps` + `mergeKernels`) by `scripts/gen_test_kernels.mjs` — regenerate with
`node scripts/gen_test_kernels.mjs`.

| File | Persona | Roles | Current role | Domain |
|---|---|---|---|---|
| `gabriel-kernel-v2.json` | Gabriel (compact **test fixture**, NOT his full canonical kernel) | 4 | kanzen | process / products / people |
| `anita-kernel-v2.json` | Anita Myre-Kornfeldt (synthetic) | 4 | northfield | operations / logistics |
| `devon-kernel-v2.json` | Devon Hale (synthetic) | 3 | freelance | software (career-changer) |

## What they exercise

- **JSON passthrough** — `ingestFile` detects a kernel `.json` (has `experience[]`) and skips the
  heuristic text parser, going straight to create/merge.
- **create vs merge** — upload into an empty account → `create`; re-upload (or upload a second
  persona) → `merge` with keep-both-and-flag conflicts.
- **tense** — every kernel sets `tenseMode: 'auto'` with exactly one `isCurrent` role, so after
  "Apply to my CV" + regenerate, the current role renders present-tense, the rest past.
- **language** — each `language.crossPolicy` + per-role `langInvariantTokens` exercise the §3
  cross-lingual rule (try generating in Danish/Spanish and confirm company names, metrics, and
  tool/standard names stay verbatim).
- **gaps** — all three are gap-free (every role has scope + outcomes + proofPoints); to test the
  gap-flagging path, delete a role's `outcomes`/`proofPoints` before uploading.

## How to test

1. Open the app → Settings → Personal (or the onboarding wizard).
2. Click **🧬 Build / update kernel from CV** → pick one of these `.json` files.
3. Review the preview modal (roles / conflicts / gaps).
4. **Apply to my CV** (writes `personalInfo.workHistory`, backed up to `antcv:workHistoryBackup`)
   or **Apply + save to account** (also POSTs to D1 `user_kernel.kernel_v2`).
5. Regenerate → the CV is rebuilt from the imported kernel.

> Anita and Devon are **synthetic** test personas — their content is fabricated on purpose (they
> are not real people). The Gabriel file is a deliberately **compact** fixture, not his real kernel.
