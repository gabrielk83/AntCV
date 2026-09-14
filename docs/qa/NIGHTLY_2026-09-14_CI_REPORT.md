# AntCV CI Nightly — 2026-09-14 (GitHub Actions, unattended, Opus 4.8)

**Substrate:** GitHub Actions, fresh isolated clone, no signed-in Browser pane, no real LLM/render,
`ALLOW_DEPLOY=false`. **Scope:** Band-E E1 register staleness sweep — docs/registers only, pushed
straight to main (permitted by the CI safety override for docs/registers/reports).

## SYNC + baseline

- `git fetch origin && git pull --rebase origin main` → already up to date, HEAD `ae556c6c`.
- Suite `node scripts/run-tests.mjs pwa` → **1715 / 1715 pass, 0 fail** (main GREEN on entry).
- `node scripts/check-register.mjs` → OK, 93 ACTIVE / 93 detail, index 16.9 KB.

## Why Bands A–D were not shipped

Every Band A/B/C/D candidate is blocked on a capability this environment lacks: signed-in live
verification on `antcv.pages.dev`, real LLM generation, a real second device, a real CloudConvert
PDF render, or a worker deploy (`ALLOW_DEPLOY=false`). Owner hard rule — "an end result, not a
brickable mid-product" — so no speculative `app.js`/worker surgery. Ran the never-skip Band E.

## Band E1 — register staleness sweep (the 2026-07-13 cohort, now the stalest)

After the 09-13 run bumped the 07-08/09 batch, the genuinely stalest `verified:` rows are the
2026-07-13 job-tracker / Aimpoint deliverable batch (~63 days stale): rows 75, 77, 78, 81, 83, 86,
87, 88. Verify-first against HEAD `ae556c6c`.

### CLOSED this run

- **Row 78 — JOBTRACKER-OPEN-DESKTOP-REVERIFY-001 — CLOSED.** Its head already reads
  `CLOSED 2026-07-13`: owner live-verified end-to-end on the deployed **1.51.392** via the Browser
  pane on a FRESH device (the exact stale-pointer scenario — tracker Open on the brand-fitted NVIDIA
  row → after reload the panel shows the NVIDIA JD, 4840 chars, byte-match to D1; `window.__antcvBrandFit=true`
  + 🎨 checkbox TICKED; 📋 opens the tracker via the pure delegated path; `active_application_device`
  gained a row for the pane device → 724). The only remaining leg is an **optional** owner desktop
  spot-check. It passed `check-register.mjs` only because the detail body carries OPEN_MARKER words
  (`Owed`, `re-test`) that now describe that optional check — the same close class as rows 46/48
  (09-11 run). Verify-first confirmed the shipped code intact on HEAD (`antcv:jdRemoved` tombstone +
  per-device pointer guards mirrored in both bundles) before the move. Moved to `REGISTER_CLOSED.md`;
  index + detail section removed. Register now **92 ACTIVE / 92 detail**.

### Swept + refreshed to 2026-09-14 (kept ACTIVE — remaining legs CI-impossible)

| Row | ID | Verify-first result at HEAD | Why kept ACTIVE |
|---|---|---|---|
| 75 | JOBTRACKER-AUTOFILL-ADDFLOW-VERIFY-001 | `src/islands/JobTracker/rank.ts` present; autofill code in the islands sidecars; suite green | Owner-gated real URL/PDF add-test — would add a junk row to the live tracker; needs a throwaway account / owner |
| 77 | JOBTRACKER-TOP5-PERIODIC-RESCORE-001 | Confirmed on-add/on-change re-rank covers the stated need | Optional periodic re-score — not built by design, awaiting owner confirm |
| 81 | PHOTO-FUSE-OWNER-VERIFY-001 | `＋ Add photos…` is the sole upload button in `antcv-photo-library.js`; suite green | Owner on-device visual pass after a hard refresh |
| 83 | JD-REMOVE-OWNER-VERIFY-001 | `antcv:jdRemoved` tombstone key present in BOTH `app.src.js` and `app.js` | Owner live pass (Remove → refresh stays removed; Reopen re-stages; Read-from-Cloud returns) |
| 86 | GOLD-SESSION-FOLLOWUPS-001 | Leg (f) done — `gold_audit.py role_canon` wired + `test_gold_residue.py` present | Legs a–e content-gen / translation / proxy-fetch / core-comp backfill — owner/model-gated |
| 87 | OWNER-ROUND-2-RESIDUE-001 | Golden/detection/label/slogan/Scholar fixes landed (prior) | Core-comp 3–4-row regen, per-app brand palette persist, signature upload, role-split worker deploy — all owner/live/model/deploy-gated |
| 88 | OWNER-ROUND-3-BACKLOG | Round-3 shipped (prior); rules baked | 19-app rollout, fit-page-flow y-alignment, table geometry, density — all owner/live/render-gated |

## Post-edit re-verify (09-08 lesson)

The 2026-09-08 incident: a run edited the register after its baseline suite and pushed on a stale
green. This run re-ran the full suite AFTER the register edits: **1715 / 1715, 0 fail**;
`check-register.mjs` OK — **92 ACTIVE / 92 detail**.

## Cache-bust / version / shift

None. Docs and registers only; no `pwa/` loaded asset changed, no version number consumed, no shift
claim required.

## OWED to a desktop / owner run

- Row 75 — one real add-test (reject after) on a throwaway account.
- Row 81 — on-device photo-panel visual pass after a hard refresh.
- Row 83 — live JD-remove-sticky pass (Remove/refresh/Reopen/Read-from-Cloud/re-upload).
- Rows 86 / 87 / 88 — content-gen regen (core-comp tables, translated Results), per-app brand
  palette + signature, role-split worker deploy + CloudConvert render, fit-page-flow y-alignment.
- All Band B/C `app.js` surgery (rows 40/41/42/43/44) still wants a PR (CI push-gated).

No PWA change shipped → **no post-deploy live-verify owed** from this run.

## Registers updated (this commit)

- `OPEN_REGISTER.md` — rows 75/77/81/83/86/87/88 dated 2026-09-14; row 78 removed.
- `REGISTER_ACTIVE_DETAIL.md` — row 78 section removed; the other seven `_verified:` dates advanced.
- `REGISTER_CLOSED.md` — row 78 close entry with evidence.
- `REGISTER_RUNLOG.md` — 2026-09-14 CI entry at top.
- `ACTIVE_BUGS.md` — top-block hygiene-close note.
