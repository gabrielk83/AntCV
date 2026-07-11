# Translate coverage — global work order (2026-07-11)

Verified live on antcv.pages.dev @ 1.51.331 with a zh ribbon over freshly generated
nordic-minimal content. Probe confirmed the **LLM path works** (full gen ran, hit
/api/kernel-showcase + /api/jd-analysis, all 200) — this is NOT an LLM-route outage.

Owner directive: **global solution, not a patch per application / language / style.**

## What DOES translate today (leave alone)
- Section headings (工具与方法, 个人简介, 核心能力, 职业经验) — furniture dict.
- `成果：` Results label — furniture dict (Re fix, 1.51.330). Keep.
- Profile text + `工作风格:` work-style text — LLM translate reaches these.

## What does NOT translate (the gap) — full list from owner
| # | Element | Bucket | Where it lives |
|---|---------|--------|----------------|
| 1 | Name "Gabriel Alexander Karp-Gershon" (→ 柯葛顺·加百列·亚历山大 zh) | B translate | personalInfo.name / io.name |
| 2 | "Copenhagen" (→ 哥本哈根) | B translate | contact_line / personalInfo.address |
| 3 | "EU citizen" (→ 欧盟公民) | B translate | contact_line item value |
| 4 | "Foundations" (section) content | B translate | foundation section |
| 5 | "Hands-On:" lead-in | A furniture | foundation render label |
| 6 | "Professionally:" lead-in | A furniture | foundation render label |
| 7 | "Cont." / "(CONT.)" | A furniture | pagination continuation label |
| 8 | "Present" (2022 - Present) | B translate | role.years (da also needs collector widen) |
| 9 | "At your service," (CL sign-off) | A furniture | CL closing render |
| 10 | "Application: Product / Project Expert - Unsolicited" | A furniture | subtitle template line |
| 11 | "Gabriel" (CL signature name) | B translate | CL signature / io.name |
| 12 | ALL CL lead-ins + ALL CL content | B translate | cl sections (also: CL loses sections on translate) |

## Root cause (from reading collector @ app.src.js ~18036-18182)
- For **zh** (_isWide) the collector ALREADY gathers role title/company/years/bullets/
  results, rich_block, labeled_list group labels, contact_line values; and the translate
  PROMPT already handles name→Chinese, Copenhagen→哥本哈根, EU Citizen→欧盟公民.
- Yet these render in English ⇒ the translate pass **did not run / apply on the freshly
  generated content**. The zh on screen (headings, profile) is furniture-dict + stale.
  ⇒ Bucket B is fundamentally a **trigger/apply-after-generation** problem, not missing
  collector cases.

## Two-part fix
### Fix 1 — run translate-apply on generated content when ribbon ≠ en (the big one)
- After a generation completes, if `je !== 'en'`, route the new sections through the
  existing translate pass (Pr/i()) OR ensure the babel-relang sidecar detects the fresh
  English content and fires the headless translate. Investigate why the sidecar's
  post-gen watcher + threshold is not firing on this content.
- CL-section-loss on translate (#12) must be fixed in the same pass — translate must not
  drop cl sections (who/opening/closure). Check the apply-back step for cl.

### Fix 2 — route residual render-furniture through the shared dict (safe, proven pattern)
Mirror the Re-fix pattern (wrap literal in `ye(str, je)` / `L(...)`):
- "(Cont.)" / "(CONT.)" continuation label (preview sites ~7456, salmon 177, 43982; export)
- Foundation "Hands-On:" / "Professionally:" labels
- "At your service," / CL sign-off (preview ~45124 + export)
- Application subtitle "Application: {role} - {company}" template
Add da/es/zh/he dict entries for each.

### Fix 1b — collector: widen role title/company/years beyond _isWide to include da
`if (_isWide)` gate @ ~18038 excludes Danish ⇒ da role headers + "Present" never
collected. Widen so da role title/years are collected too.

## Risk note
Fix 1 touches the gen→translate flow and the app.js mirror — the class of edit that
blue-screened the app twice when rushed. Do Fix 2 (dict furniture) first (low risk,
proven), then Fix 1 with live verification. One deployer at a time; full cache-bust.
