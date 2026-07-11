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

### Fix 2 — residual render-furniture (INVESTIGATED 2026-07-11 — mostly already done)
Bucket A is ~90% already implemented. Verified state per item:
- **"Application:" label** — ALREADY translated. Dict entries exist (da `Ansøgning:`,
  es `Postulación:`, zh `申请：` @ 4391/4598/4677) and routed via `ye()`/`o()` at all 3
  sites (28225 export, 29491, 43684). NO WORK. What renders English is `io.role`
  (content → Bucket B) + `io.company` ("Unsolicited" sentinel, see below).
- **"Hands-on:" / "Professionally:" labels** — ALREADY translated. Dict entries
  (da/es/zh @ 4396/4603/4682) + routed via `L()` in the foundation-TYPE case (5818).
  NOTE: the CL foundation is a `rich_block` whose `b` = "Hands-on"/"Professionally" is
  CONTENT (collector n(["items",i,"b"])) → Bucket B, not furniture.
- **"(CONT.)"** — dict entries exist; but line 177 (inside __antcvSalmon, PERMANENT)
  hardcodes `contTitle + " (CONT.)"` and the zh dict maps "(CONT.)"→"(CONT.)" (identity —
  confirm intended zh form, maybe 续). Minor + sensitive location.
- **CL sign-off "At your service,"** — REAL BUG (confirmed live: antcv:clClosing =
  "At your service,"). Two problems:
  (a) override is honored BEFORE the language map → the auto-seeded English default pins
      English on every language.
  (b) the two REACT PREVIEW sites have NO language map at all:
      - **45216** and **45317** (45317 = the contentEditable sign-off the user sees;
        its onBlur writes antcv:clClosing) both render `n ? "Med venlig hilsen," :
        (ov || "At your service,")` — da via `n`, everything else → override-or-English.
      - 28276 (export inline-docx fallback) and 29544-29553 (worker-down fallback) DO
        have the full `{da,es,zh,he,am,ar}[je]` map.
  Fix at ALL four: `ov && ov !== "At your service," ? ov : ({da,es,zh,he,am,ar}[je] ||
  "At your service,")`. For 45216/45317 this REPLACES the `n ? DA : …` ternary with the
  je-map — VERIFY `je` is in scope in that React render before editing; a bad ref blanks
  the preview. Live-verifiable by switching language (no gen needed).
- **"Unsolicited" / "Open Application" app-name** — SENTINEL, not a display label. Code
  branches on `io.company === "Unsolicited"` in ~12 places (15759, 16936, 17036, 17061,
  17080, 17119, 17195…). MUST translate at DISPLAY time only (a render-map applied where
  the subtitle/nav shows io.company/io.role) — NEVER translate the stored value.

Conclusion: there is NO clean "safe dict-wrap" Bucket A pass. The labels are done; the
residue (sign-off override + multi-site map, sentinel display-map, salmon (CONT.)) is
render-logic in sensitive/multi-site code that needs the SAME live gen+translate
verification as Bucket B. FOLD Bucket A residue INTO the Bucket B focused pass.

### Fix 1b — collector: widen role title/company/years beyond _isWide to include da
`if (_isWide)` gate @ ~18038 excludes Danish ⇒ da role headers + "Present" never
collected. Widen so da role title/years are collected too.

## Risk note
Fix 1 touches the gen→translate flow and the app.js mirror — the class of edit that
blue-screened the app twice when rushed. Do Fix 2 (dict furniture) first (low risk,
proven), then Fix 1 with live verification. One deployer at a time; full cache-bust.

---

## 2026-07-11 (PM) — SHIPPED 1.51.334-unsol-pillar (commit 377e3c5)

### Done + live-verified on antcv.pages.dev
- **CL sign-off (item 9): FIXED at all four sites.** React preview sites now use the
  je map; override honored only when it differs from the auto-seeded English default.
  Live probe: zh ribbon + pinned "At your service," override → renders 此致敬礼，;
  a REAL custom override still wins (verified both directions, state restored).
- **Unsolicited pillar (owner decision — supersedes the display-map plan):** the
  sentinel now COVERS every language variant instead of translating at display time.
  ONE canonical matcher in index.html <head> (`window.__ANTCV_UNSOL_RE` +
  `window.__antcvUnsol`); all 20 app.js comparisons routed through it; 13 sidecar
  gates widened (old regex kept as fallback). Writes still seed canonical
  "Unsolicited". docx-client:692 display-label ternary deliberately NOT widened —
  a stored translated variant should fall through and display as-is.
- **Translate prompt pins (Pr):** "Unsolicited"/"Open Application" → EXACTLY
  Uopfordret / Candidatura espontánea / 主动申请 / מועמדות יזומה / ያልተጠየቀ ማመልከቻ /
  طلب عفوي (matcher-aligned); rich meaningful-name rule extended zh → he/am/ar
  (established given-name forms; dignified surname transliteration; zh Gabriel pin
  exact); Latin-name keep extended to da; "Present" in year ranges now translates
  (nu / actualidad / 至今 / היום / እስከ አሁን / حتى الآن). Items 1, 8, 11.
- **Fix 1b:** da now collects role title/company/years (was _isWide-only) + meta
  company for da. Name stays _isWide-gated (da keeps Latin names).

### Fix 1 diagnosis (live, zh ribbon over English content @ 1.51.334)
- babel-relang trigger is NOT the problem: fired repeatedly ("content not in zh —
  re-rendering (thorough)"), all guards clear (view=editor, no manual guard, no
  kill switch, quota fine).
- `__antcvRelangHeadless('zh')` invoked manually → full pipeline RUNS: "Translating
  to 中文… (n/11)" banner, chunks apply incrementally (CJK ratio 0.093 → 0.151+ @ 4/11).
- ⇒ The pipeline works when driven; the historical "stayed English" was most likely
  interrupted runs (reloads mid-translate) or the pre-334 state. NOTE: an ~11-chunk
  thorough translate runs MINUTES — a mid-run reload/nav kills it silently and the
  20s-backoff + MAX_ATTEMPTS=2 per pageload can leave content mixed until the next
  load. Candidate hardening (not yet done): persist attempt state / resume, or drop
  chunk size for the headless path.
### Still open
- CL-section-loss on translate (#12) — apply-back path is structurally safe
  (only replaces collected paths); suspicion moves to the languageCache restore /
  Nr snapshot. Verify after a full translate completes.
- Salmon "(CONT.)" zh form (dict identity today; owner to confirm 续).

## 2026-07-11 (late) — babel-native pivot SHIPPED 1.51.337/338 (bd1c615, fff6659)

Owner: "build a solution based on the babel fish concept — generation in the
TARGET language." Native gen was already correct; the destroyers were the
post-gen ENGLISH re-injectors. Shipped:
- BABEL-DEDUP-SCRIPT-001 (normalize-415): Unicode title cores (BOTH _titleCore
  AND dedupeRoles' local norm), 至今/היום/حتى الآن = present, cross-script pairs
  collapse via company+years with the ribbon-language survivor. Live effect on
  the damaged doc: 52 → 23 roles, 13 pages → normal.
- BABEL-PINS-LANG-GATE-001 (docx-client): English _GAB_EXACT pins + kernel-outcome
  lamination never touch a wide-script role; native role.results wins; empty stays
  empty. (Kills the CSA-under-学生会代表 leak class.)
- ANTHROPIC-CONTENT-GUARD-001: w.content.map crash on API error bodies → real
  provider error (the mid-gen "All 1 LLM provider failed for parse_jd" popup).

### Residue for the NEXT session (before/during the 16-kernel regen)
1. OWNER ASK: tightening (post-gen compress) must be INSIDE the generation
   window — the purple bar closes ~2-3 min early; extend kernelShowcaseInProgress
   / the overlay through the compress pass.
2. Languages list values ("English: native / fluent") — prompt pin shipped in
   1.51.336; verify on the next translate/gen; if the LLM still holds them,
   consider a furniture dict for language names.
3. Preview labeled_list does not linkify [text](url) (export DOES) — Google
   Scholar link shows raw markdown in preview; linkify lives inside the
   contentEditable U component (careful change).
4. Damaged-doc leftovers (zh-synonym twins 保安/宿舍保安, 学生会代表/学生委员会代表,
   IDF company variants) — regen replaces the document; no more machinery.
5. Then: owner regenerates all 16 style×lang kernels on ≥1.51.338 and audits
   the credential-forward zh one first.
