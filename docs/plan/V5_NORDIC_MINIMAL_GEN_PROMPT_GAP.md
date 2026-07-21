# v5 → Nordic Minimal generation-prompt GAP REPORT

Read-only analysis (2026-07-21). Source spec: **General CV + Cover-Letter Generator Prompt v5**
(`C:\Users\karpg\Downloads\General_CV_CL_Generator_Prompt_v5.docx`). Target: the DEFAULT WRITING style
**Nordic Minimal** (`toneRegister: nordic-minimal`). Companion to
`docs/plan/STABLE_PALETTE_AND_LOAD_FIDELITY.md` (the visual/palette half).

**Naming:** v5 calls it "Mandatory DANISH cover-letter logic". In AntCV it must be referred to as the
**Mandatory NORDIC MINIMAL cover-letter logic** — Nordic Minimal is the style id; the logic is not
Danish-language-specific (it applies to en/da/es/zh/he/am alike).

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

## 4. Structural separation rule
| v5 requirement | status | evidence |
|---|---|---|
| Employer problem / candidate capability / proposed solution must be **3 separate sections**, never combined in one bullet | **MISSING** | no rule text in either prompt; and structurally impossible today since "How I see the role" (the employer-problem section) does not exist |

## 5. CV content & structure
| v5 requirement | status | evidence | note |
|---|---|---|---|
| PROFILE | **PINNED** | `cv_profile` gen-runner.py:422 | matches (2-3 sentences + Work style) |
| **Focus Areas mirror the 3 employer priorities** | **CONTRADICTED** | `cv_core` l.424 says *"Backward-looking, **role-independent**"* | v5 requires them to **mirror the three selected priorities** — direct conflict, needs an owner decision |
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
1. **Add "How I see the role"** + **reorder the CL** to the v5 sequence (`why → see_role → bring → contribute → who`). Biggest structural gap; everything else in §3/§4 depends on it. *(gen-runner.py:427-436 + :1441; app.src.js:43802)*
2. **Rework "What I bring"** from 4-5 `Focus Area | Expertise` rows → **3 evidence bullets** (foundation / strongest hands-on result / stakeholder direction), and fold `FOUNDATION` into it.
3. **Add the structural-separation rule** (employer need ≠ candidate evidence ≠ solution).
4. **MISWG factual rule** — accuracy/risk.
5. **Voice completions** — no contractions, British spelling, explicit voice block.
6. **Results-line formula** (`outcome + scale + mechanism`).
7. **Resolve the Focus-Areas conflict** — v5 "mirror the 3 priorities" vs current "backward-looking, role-independent" (**owner decision needed**).
8. **Micro-compression ladder** incl. wording-before-font-size.
9. **Document-QA block** stated to the model (stop authoring what sidecars must repair).
10. **Modes A/B + source precedence + JSON-delta** — largest new surface; lowest urgency for the nightly clean-gen path.

## Open question for the owner
**§5 Focus Areas** is a genuine contradiction, not an omission: `cv_core` is deliberately *"backward-looking,
role-independent"* (a stable competency table), while v5 wants Focus Areas to **mirror the three JD priorities**
(role-specific). These are incompatible designs — confirm which wins before implementing.
