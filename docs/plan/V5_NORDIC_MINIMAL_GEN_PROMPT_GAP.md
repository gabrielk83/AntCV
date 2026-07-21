# v5 → Nordic Minimal generation-prompt GAP REPORT

Read-only analysis (2026-07-21). Source spec: **General CV + Cover-Letter Generator Prompt v5**
(`C:\Users\karpg\Downloads\General_CV_CL_Generator_Prompt_v5.docx`). Target: the DEFAULT WRITING style
**Nordic Minimal** (`toneRegister: nordic-minimal`). Companion to
`docs/plan/STABLE_PALETTE_AND_LOAD_FIDELITY.md` (the visual/palette half).

**Naming:** v5 calls it "Mandatory DANISH cover-letter logic". In AntCV it must be referred to as the
**Mandatory NORDIC MINIMAL cover-letter logic** — Nordic Minimal is the style id; the logic is not
Danish-language-specific (it applies to en/da/es/zh/he/am alike).

> ## ⚠ STATUS UPDATE (2026-07-21, same day) — a parallel session shipped part of this
> While this report was being written, **CL-V5-STRUCT-001** landed (`1.51.1922` + tone-gate fix
> `1.51.1942`). Re-verified against the tree, so the table below is **partly historical**:
>
> **DONE (verified):**
> - **`cl_how_i_see_role` now EXISTS** (gen-runner.py:432) — lead sentence + **exactly three rows**,
>   employer problem ONLY, "NO candidate evidence, NO proposed solution, no 'I'". Closes §3's biggest gap.
> - **`cl_what_i_bring` reworked** (gen-runner.py:430) — now **exactly three evidence rows**:
>   decision foundation / strongest hands-on result with its real number / project-team-stakeholder
>   direction. Exactly the v5 shape; `FOUNDATION` is folded in as row 1.
> - **§4 structural-separation rule is now ENCODED INLINE** in both asks ("do NOT restate the employer
>   problems from HOW I SEE THE ROLE and do NOT propose what you would do").
> - CL **ordering** is driven by the sidecar `pwa/antcv-nordic-cl-order-971.js` (that is why the `me()`
>   array at app.src.js:43815 still lists the old order — it is overridden at render).
>
> **STILL OPEN (re-verified by grep):** slogan role-linkage §3b (`cl_slogan` unchanged, still
> brand-fused) · Focus Areas §5 (`cv_core` still "Backward-looking, role-independent") · application
> subtitle (0 hits) · MISWG (0/0) · contractions (0/0) · British spelling · Results-line formula (0/1) ·
> Tools-vs-Methods classification (0/0) · micro-compression ladder · Document-QA block · Modes A/B +
> source precedence.

## Where generation is actually pinned
| source | role |
|---|---|
| `scripts/job-tracker/gen-runner.py` | the fullest prompt — `CV_SECTIONS` (l.421-426) + `CL_SECTIONS` (l.427-436) per-section asks; `_user_turn()` (l.438+) builds the turn; the **proxy prepends** the task frame + anti-fabrication + banned list |
| `pwa/app.src.js` | in-app generation prompts + the `me()` CL/CV **default template order** (l.43802) |
| `pwa/antcv-*.js` sidecars | post-processing (banned words, em-dash, rich_block lead-ins, orphan/QA) |

Note the split: **content rules** live in the prompt; **QA/layout rules** live app-side in sidecars. Several
v5 items are "enforced" only as post-processing, never stated to the model — flagged PARTIAL below.

---

## 1. Two modes (A fix-from-baseline / B clean-gen) + baseline-learning rule
| v5 requirement | status | evidence | insert point |
|---|---|---|---|
| MODE A — repair/adapt an existing baseline | **MISSING** | `grep -ic baseline gen-runner.py` = **0** | new prompt block in `_user_turn()` gen-runner.py:438 |
| MODE B — clean generation | **PINNED** | this is the only mode gen-runner implements | — |
| Baseline-learning rule (learn transformation principles, not typos/tense/abbrev errors) | **MISSING** | 0 hits | same block |

gen-runner is a **clean-generation-only** pipeline. Mode A has no representation at all.

## 2. Source precedence + JSON-delta
| v5 requirement | status | evidence | insert point |
|---|---|---|---|
| Candidate-fact precedence (verified session > JSON > baseline > reference > labelled inference) | **MISSING** | `grep -ic precedence` gen-runner **0**, app.src **1** | `_user_turn()` gen-runner.py:438 |
| Employer-need precedence | **MISSING** | 0 | same |
| Never promote hypothesis/unanswered question to confirmed employer need | **MISSING** | 0 | same |
| Return a compact JSON-delta for newly verified facts | **MISSING** | 0 | output contract |

## 3. Mandatory NORDIC MINIMAL cover-letter sequence — **the biggest gap**
v5 order: `Headline/Subtitle/Greeting → Opening → Why this position → How I see the role → What I bring → How I will contribute → Who I am → Closing`

**Actual default order** (`pwa/app.src.js:43802`, `me()` cl array):
`greeting → opening → who → bring → why → contribute → foundation → closure`

| v5 subsection | status | evidence |
|---|---|---|
| Greeting / Opening | **PINNED** | ids `greeting`,`opening`; `cl_opening` ask gen-runner.py:428 |
| "Why this position:" | **PINNED** (wrong position) | id `why`, title `WHY THIS POSITION`, ask l.431 — but sits **5th**, must be **3rd** |
| **"How I see the role"** (3 employer-centred bullets, before candidate evidence) | **MISSING ENTIRELY** | `grep -ic "How I see the role"` = **0** in gen-runner AND app.src; no section id | — |
| "What I bring" (3 evidence bullets) | **PARTIAL** | id `bring`, ask l.430 — but asks for **4-5 `Focus Area \| Strategic Expertise` rows**, not v5's **3 evidence bullets** covering foundation / strongest hands-on achievement / stakeholder direction |
| "How I will contribute" (3-4 plan bullets) | **PINNED** | id `contribute`, title `HOW I WOULD CONTRIBUTE`, ask l.432 (lead-in + 3-4 verb-led bullets + `Goal:`) — good match |
| "Who I am" (compact block near END) | **PINNED** (wrong position) | id `who`, ask l.429 — sits **3rd**, must be **2nd-to-last** |
| Closing | **PINNED** | id `closure`, ask l.434 |
| `FOUNDATION` as its own section | **DIVERGENCE** | id `foundation`, ask l.433 ('Hands-on:'/'Professionally:') — v5 **folds this into "What I bring"** as evidence bullet 1, not a separate section |

**Insert points:** add `("cl_how_i_see_role","HOW I SEE THE ROLE", …)` to `CL_SECTIONS` gen-runner.py:427-436;
add `"see_role"` to `GEN_CL` gen-runner.py:1441; insert the id + reorder the `me()` cl array app.src.js:43802.

## 3b. Slogan / headline, its PLACEMENT, and its link to the ROLE
v5 §1 "HEADLINE, SUBTITLE AND GREETING" (spec lines 133-136):
> *Use an **outcome-oriented headline linked to the role**. Add a short **application subtitle** when the
> template supports it. Address a named contact naturally when verified.*

plus MINIMUM-CHANGE RULE (spec l.311): *keep **headline position** when effective.*

In AntCV the "headline" **is the CL slogan** (`antcv:clSlogan`, the tagline at the top of the cover letter).

| v5 requirement | status | evidence |
|---|---|---|
| Headline is **outcome-oriented and LINKED TO THE ROLE** | **MISMATCH** | `cl_slogan` ask (gen-runner.py:435) asks for *"a statement of the value THIS candidate brings to THIS employer, **FUSED to the EMPLOYER BRAND block** (spirit/values/tone)"* — it never mentions the **role** and never asks for an **outcome**. Brand-fusion ≠ role-linkage. |
| Gold reference | — | Ibsen CL headline: *"A **PROJECT MANAGER** WHO **MOVES OPTICAL HARDWARE FROM LAB TO SCALABLE DELIVERY**"* = role noun + outcome. The current brand-fused ask would not reliably produce this shape. |
| **Application subtitle** (short line naming the application) | **MISSING ENTIRELY** | `grep -ic "An application for"` = **0** in app.src.js, gen-runner.py AND antcv-docx-client.js. Yet the gold Ibsen CL has *"An application for the SBC Project Manager position · Ibsen Photonics · Farum"* (navy italic, centred, amber rule under it) — the consultant added it by hand. No section id, no ask, no render site. |
| Headline **position** preserved | **PINNED** | `antcv:clSloganMode` = `heading` (tagline) \| `leadin` (folded into the opening's first sentence); 4 hits app.src.js. Placement is user-controlled and persisted, so v5's "keep headline position" is satisfiable. |
| Role-linkage implies: targeted ⇒ tailored headline, unsolicited ⇒ generic | **PINNED (consistent)** | SLOGAN-SMART-STATEMENT-001 (targeted → `meta.cl_slogan` or nothing, never the specialization triad) + SLOGAN-UNSOL-GENERIC-001 (unsolicited → generic standing default). This existing split *agrees* with v5: no role ⇒ no role-linked headline. Keep it. |
| 4-8 word cap | **PINNED** | `__antcvSloganCap` + `__antcvSloganDeDangle` (app.src.js ~2380-2404); gen ask says "max ~10 words" — minor inconsistency (10 vs 8) worth aligning. |

**Fix shape:** rewrite the `cl_slogan` ask to lead with **role + outcome**, keeping brand-fusion as a
*secondary* flavour rather than the organising principle; and add an **application-subtitle** element
(id + ask + render site in preview/PDF/DOCX) since none exists.

## 4. Structural separation rule
| v5 requirement | status | evidence |
|---|---|---|
| Employer problem / candidate capability / proposed solution must be **3 separate sections**, never combined in one bullet | **MISSING** | no rule text in either prompt; and structurally impossible today since "How I see the role" (the employer-problem section) does not exist |

## 5. CV content & structure
| v5 requirement | status | evidence | note |
|---|---|---|---|
| PROFILE | **PINNED** | `cv_profile` gen-runner.py:422 | matches (2-3 sentences + Work style) |
| **Focus Areas mirror the 3 employer priorities** | **CONTRADICTED → v5 WINS (owner 2026-07-21)** | `cv_core` l.424 says *"Backward-looking, **role-independent**"* | **RESOLVED: v5 wins.** Rewrite `cv_core` (gen-runner.py:424) so Focus Areas **mirror the three selected JD priorities** (role-specific). Drop "backward-looking, role-independent". |
| Three-priority evidence map | **MISSING** | no ranking/evidence-map step in gen-runner | |
| Expertise / Tools / Methods **split** | **TEMPLATE-SUPPLIED** | not in `CV_SECTIONS`; comes from the kernel/`me()` template + sidecars (`antcv-ai-assisted-to-methods.js`) | not a prompt gap per se |
| "Do not classify methods as tools / instruments as methods" | **MISSING** | `grep -ic "not classify\|methods as tools"` = **0** both | |
| Results-line formula `outcome + scale + mechanism` | **MISSING** | `grep -ic "scale or metric\|mechanism\|supported outcome"` gen-runner **0**, app.src **1** | `cv_outcomes` l.423 asks "verb-led outcomes, bold lead + body" — no formula |
| Interests pinned-phrase override / Accessibility / Eligibility-Security-References split | **TEMPLATE-SUPPLIED** | kernel/`me()` skeleton | |

## 6. MISWG rule
| v5 requirement | status | evidence |
|---|---|---|
| Expand on first use as "Multinational Industrial Security Working Group"; describe as international group incl. NATO members/observers; **do NOT call it a NATO body**; never infer clearance from residence/citizenship; distinguish screening eligibility from completed clearance | **MISSING** | `grep -ic "MISWG\|Multinational Industrial"` = **0** in gen-runner AND app.src (it appears only in persona/docs data) |

High-risk gap: this is a factual-accuracy rule about defence claims. Insert into the factual/authority block.

## 7. Voice
| v5 requirement | status | evidence |
|---|---|---|
| Banned words/phrases | **PINNED (strong)** | 25 hits gen-runner / 58 app.src; proxy prepends banned list; `antcv-banned-audit.js` |
| No em dashes | **PINNED** | 1 gen-runner / 7 app.src (+ `antcv-emdash-to-hyphen.js`) |
| **No contractions** | **MISSING** | `grep -ic contraction` = **0** both |
| **British spelling** (candidate's convention) | **PARTIAL/WEAK** | 0 gen-runner / 2 app.src — not pinned in the generation ask |
| Direct, calm, short sentences; no corporate filler / generic enthusiasm | **PARTIAL** | implied by banned list + per-section register hints, not stated as a voice block |

## 8. Micro-compression ladder
| v5 requirement | status | evidence |
|---|---|---|
| Ordered ladder (remove repeated context → shorter equivalent → drop articles → shorter active verb → combine qualifiers → move established context) | **MISSING** | 0 in gen-runner |
| **"Prefer a small wording change over reducing font size"** | **MISSING as a prompt rule** | app.src has compression passes (7 hits) but the *priority rule* is never stated to the model | 

Compression exists as an app-side **post-process** (`compress` task, 15/25/30/8 % passes), not as an authored
principle. That is why compression can degrade wording instead of trimming redundancy.

## 9. Document QA
| v5 requirement | status | evidence |
|---|---|---|
| Render + inspect every page at 100 %; no clipping/overlap/orphans; keep each heading with its lead sentence + first bullet; no stranded final line; one-page CL; preserve photo/signature/AI-notice | **PARTIAL — app-side only** | gen-runner **0** hits; app.src **54** (orphan-measure-bind, keep-whole, `antcv-cl-length-560.js` = 1-page default for Nordic Minimal, orphan-export-preflight) |

The QA outcomes are enforced by sidecars, but the **model is never told**, so it authors content that then has
to be mechanically repaired.

---

## Prioritised fix list (most impactful first)
> Items 1, 2 and 5 were **SHIPPED by CL-V5-STRUCT-001 (1.51.1922/1.51.1942)** — see the STATUS UPDATE
> at the top. They are struck through; the live queue starts at **item 3**.

1. ~~**Add "How I see the role"** + reorder the CL to the v5 sequence~~ — **DONE** (gen-runner.py:432; order via `antcv-nordic-cl-order-971.js`)
2. ~~**Rework "What I bring"** → 3 evidence rows, fold `FOUNDATION` in~~ — **DONE** (gen-runner.py:430)
3. **Slogan → role-linked** (§3b): rewrite the `cl_slogan` ask (gen-runner.py:435) to lead with **role + outcome**, brand-fusion secondary. Align the word cap (ask says ~10, `__antcvSloganCap` enforces 8).
4. **Focus Areas → mirror the 3 JD priorities** (§5) — **owner ruled v5 wins**; rewrite `cv_core` gen-runner.py:424, drop "backward-looking, role-independent".
5. ~~**Add the structural-separation rule**~~ — **DONE**, encoded inline in both asks (gen-runner.py:430,432).
6. **MISWG factual rule** — accuracy/risk.
7. **Application subtitle element** (§3b) — new id + ask + render site (preview/PDF/DOCX); does not exist today.
8. **Voice completions** — no contractions, British spelling, explicit voice block.
9. **Results-line formula** (`outcome + scale + mechanism`).
10. **Micro-compression ladder** incl. wording-before-font-size.
11. **Document-QA block** stated to the model (stop authoring what sidecars must repair).
12. **Modes A/B + source precedence + JSON-delta** — largest new surface; lowest urgency for the nightly clean-gen path.

## Owner decisions recorded
- **2026-07-21 — Focus Areas: v5 WINS.** Where v5 and the current prompt conflict, **v5 is authoritative**.
  `cv_core` becomes role-specific (mirrors the three JD priorities); the "backward-looking, role-independent"
  competency-table design is retired.
- **2026-07-21 — the slogan is in scope.** v5's headline/subtitle/placement guidance (§3b) is part of the
  writing update, not a separate track: the headline must be **outcome-oriented and linked to the role**.
