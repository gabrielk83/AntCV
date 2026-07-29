# Job-Tracker nightly — 2026-07-11 (work log + handoff)

Automated `antcv-job-tracker-nightly` run (desktop). Prereqs all present on host:
`~/.antcv/token` (self-renewing), `~/.antcv/cv_skeleton.json`, Drive access.

## TASK 1 — first real pilot persist

- **demant_pm (high / claude-opus-4-8) persisted as real `application_id=670`.**
  category `product_management` (real id, not targeted/unsolicited), 15 CV + 8 CL
  structured sections (full sidebar + experience + furniture), **zero banned dashes**.
  `sanitize_text` scrubs em-dash→hyphen on the persist path; the runner's
  "BANNED-WORD HITS ['�']" log line is only the Windows console rendering U+2014
  — the doc and the persisted app are clean (verified by codepoint).
- **Owner PushNotified** to open Demant Senior PM (app 670) in AntCV and eyeball the
  rendered CV+CL. The remaining ~14 quick rows are HELD pending that eyeball
  (the "eyeball the FIRST persisted app first" gate). Only demant_pm was `high`;
  the rest are `quick`.
- Housekeeping: `nvidia_ose` had a stale `queue=True` flag while already carrying
  artifact app 590 → cleared (doc rev 17). Excel workbook re-rendered from the doc.

## TASK 2 — build increment (shipped, commit a6dba07)

- **gen-runner now GENERATES the CL opening + closure** (was clean-filled flat
  furniture: "I am applying for the <role> position at <company>." / "I would
  welcome the chance to discuss..."). Two new plan sections `cl_opening` +
  `cl_closure` (10 total, was 8), overlaid in `build_structured_sections` with a
  furniture fallback when a section returns empty. Greeting stays
  "Dear Hiring Team," (no hiring-manager name is captured; owner rule = greet only
  a named manager).
- Verified live end-to-end: siemens (haiku/quick, 10/10) and a fresh demant_pm
  (opus/high) — opening leads with the personal cochlear-implant hook, closure
  names Demant's brands (Oticon/Philips/Bernafon) with an invitation and no echo of
  the opening. App 670 was refreshed in-place (non-destructive PUT) with this
  higher-quality opus generation so the pilot is fully representative.

## Owner-side (NOT repo — Drive tooling)

- `G:\...\build_workbook.py`: `U[uk]` → `U.get(uk)` so rows added from a pasted JD
  with no source URL (the two `teledyne-*` rows) no longer KeyError the Excel render.

## HANDOFF — next nightly

- After the owner eyeballs app 670, flip `--persist` on for the remaining eligible
  batch (`gen-runner run --persist`, respects tier caps `--max-high`/`--max-quick`).
  All ~14 remaining eligible rows are `quick`.
- The CL opening/closure follow-up is now DONE. Remaining runner follow-ups: a
  structured cv_sections mapping refinement for edge cases; new per-row capture
  fields (hiring-manager name → greeting, deadline, per-row "why me") only on owner
  greenlight.
- Persist is SAFE + verified; skeleton fixture must exist on the run host
  (`~/.antcv/cv_skeleton.json`) — the cloud routine host won't have it (falls back
  to flat; run persist on the desktop).
