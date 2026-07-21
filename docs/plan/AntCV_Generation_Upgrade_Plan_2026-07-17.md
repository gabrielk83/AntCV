# AntCV Generation Upgrade Plan — 2026-07-17

Source of truth for this work: `General_CV_CL_Generator_Prompt_v5.docx` (the owner's
authoritative generator spec) + the Ibsen `FINAL` reference pair (`..._CL_FINAL_v3.docx`,
`..._CV_FINAL_v4.docx`) as the visual/brand gold, diffed against the raw AntCV output
(`1017/1018/1019_*_CV.docx` / `_CL.docx`) to establish the gaps.

Goal: make AntCV's generation + Fit-it + Enhance produce, without hand-fixing, the quality
the owner currently reaches by manual correction — correct **brand colours**, the v5
**cover-letter structure**, JD-**critical-signal** targeting, and typographic **fit**.

---

## 0. What the diffs proved (grounded)

Raw AntCV export vs the hand-corrected `FINAL`/`FIX` targets:

| Dimension | Raw AntCV today | Target (`FINAL`/`FIX`) |
|---|---|---|
| **Brand colours** | Default **teal/navy** package palette (`#00746E`, `#283556`, `#C9D6EC`) — the sampled Ibsen brand never reaches the doc | Ibsen brand: `#0B4F8A` blue, `#D97706` amber, `#E97132` accent |
| CV candidate section | In the **body**, no rounded box | First-page **header** rounded box (blue fill, amber border) |
| CV photo | **Missing entirely** (no media part) | 1.4″ ellipse, amber ring, anchored in header |
| CL photo | none | none — **correct; figure is CV-only** |
| AI notice (CV) | body paragraph | **footer** (CL already correct) |
| Colored underline | 0 | subtitle + lead-ins, amber `w:u w:color="D97706"` |
| Letter-spacing (tracking) | ~18 passive runs | ~98 active condense/expand runs |
| Margins | all-zero | `header=144` (0.1″), `left/right≈200` |
| CL structure | old order, no "How I see the role", evidence+need+solution fused | v5 sequence (below) |

The **brand-colour miss is the root gap** — the rounded box, underlines and focus tables are
worthless if the palette feeding them is the wrong (teal/navy) default. Everything else is
recomposition of primitives the worker already ships.

---

## 1. Recommended cover-letter structure (v5 — mandatory Danish logic)

Formal application sequence. The engine may reorder/rebuild even in baseline-fix mode when the
current order hides the argument (v5 §MANDATORY DANISH COVER-LETTER LOGIC + STRUCTURAL
SEPARATION RULE).

1. **Headline, subtitle, greeting** — outcome-oriented headline tied to the role; short
   application subtitle; named-contact greeting when verified.
2. **Opening & application context** — name the role; mention verified prior contact briefly
   (e.g. the coffee meeting); second sentence bridges to professional identity. No full summary.
3. **Why this position:** — role/company-specific; why the mix of work/interfaces/stage fits.
   No generic praise.
4. **How I see the role:** — one lead sentence ("The work appears to centre on three connected
   priorities:") + **exactly three** employer-centred bullets (lead-in + one sentence). State
   the problem only — **no candidate evidence, no solution** here.
5. **What I bring:** — one linking sentence + **three** evidence bullets: (a) decision
   foundation (evidence/requirements/supplier/risk/gates), (b) strongest hands-on cost/technical
   result, (c) project/team/stakeholder direction. Lead with the most role-critical metric.
6. **How I will contribute:** — adapt-with-the-team lead-in + 3–4 bullets: first-weeks shared
   direction; decision rhythm; connect technical/lab work to validation/production; a **separate
   team-trust bullet** when people coordination is central. Name only role-relevant tools, tied
   to a concrete purpose, in collaborative voice ("I would", "with the team").
7. **Who I am** (compact block near the end; heading must carry a lead sentence): **Professional
   summary** / **How I operate** / **Eligibility** / **My goal**. Eligibility only when
   confirmed + relevant. "My goal" = contribution wanted, not unilateral control.
8. **Closing** — connect strongest match, invite a conversation, shorter than the body.

**The structural change vs today:** the "How I see the role" subsection is **new**, the
employer-need / candidate-evidence / solution are **split into §4/§5/§6** instead of fused per
bullet, and the identity block ("Who I am" → Professional summary / How I operate / **Eligibility**
/ My goal) moves to the **end**. Eligibility (Copenhagen-based EU citizen; clean criminal record;
no Russia/allied family ties) is a **new candidate-confirmed line** for security-relevant roles.

Document-purpose variants: FORMAL = full logic; PRE-APPLICATION = shorter, focused questions,
one invitation; POST-APPLICATION = brief reference + new context + next-step ask.

---

## 2. Fit-it upgrade — a lever ladder, cheapest-first

Today "Fit-it" is a single lever: an LLM **compress-by-~X%** rewrite (+ reorder). v5 §MICRO-
COMPRESSION defines a richer, mostly non-LLM fit. Rebuild Fit-it as a measure-driven ladder that
escalates only when the cheaper lever fails, targeting **"fit to end of line"** (minimise
overflow and ragged last-line orphans). Measure, don't guess ([[line-distribution-guidelines]]).

**Ladder (stop at first success):**
1. **Character tracking (`w:spacing`, condense/expand)** — deterministic, lossless, no word
   change. Best for a near-fit line or a lonely last-line orphan. Bounded range (e.g.
   −20…+20 twentieths) to stay legible; the worker already emits this primitive
   (`index.js:11612`, used for the contact bridge) — Fit-it just needs to drive it per line.
2. **Flip / reorder** — reorder tokens or segments to fill the line; no content loss.
3. **Micro-compression (LLM-lite, v5 rules)** — remove repeated context, drop unnecessary
   articles, shorter active verb, combine duplicated qualifiers, move context established
   elsewhere. Never sacrifice grammar/precision; prefer a wording change over a font-size drop.
4. **Compress ~X%** — the current LLM behaviour (larger overflows only).
5. **Expand** — grow a too-short line/section to fill.

Rules carried from v5: keep every number/proper-noun/tool/term; never invent; British spelling;
introduce abbreviations once; no informal shortening ("cams") unless pinned. Font-size reduction
is the **last** resort, after tracking + wording.

---

## 3. Enhance alignment

Enhance should apply the v5 **BASELINE-LEARNING RULE**: learn transformation *principles*
(tighter capability wording; Expertise/Tools/Methods separation; strongest evidence to page 1;
Results lines = outcome + scale + mechanism; split eligibility/security/references; preserve
candidate-pinned phrases), and **not** learn accidents (typos, mixed tense, invented
abbreviations, spelling inconsistency, unsupported superlatives). Enhance must respect
FACTUAL & AUTHORITY RULES: preserve verified numbers exactly, flag conflicting numbers rather
than pick the larger, distinguish line management from technical supervision, never inflate
authority/clearance. MISWG expands on first use (Multinational Industrial Security Working Group;
an international industrial-security group with member states + observers incl. NATO — **not** a
NATO body); never infer clearance from residence/citizenship.

---

## 4. Brand-colour fix (prerequisite — must land first)

**The worker is NOT the bug.** `docx-worker` `palette.js` + `mergeStyle()` honour
`payload.style` colour overrides over the package defaults (any explicit colour wins), and
`buildStyle()`'s passthrough already forwards `headerBg`/`sidebarBg`/`photoBorderColor`/
`mainHeadColor` (antcv-docx-client.js:2020-2024). The fix is entirely **PWA-side**.

### Confirmed root causes (traced 2026-07-17)
1. **Session-only opt-in, default OFF** — brand-fit runs only when `window.__antcvBrandFit===true`
   (the 🎨 checkbox), app.src.js:26603/26921. The raw 1017/1018/1019 exports were generated
   with it off → default Copenhagen (`#00746E/#283556/#C9D6EC`). Primary cause of the wrong palette.
2. **Fragile sampling** — colour source ladder is `/api/fetch-brand-colors` (needs relay +
   resolvable company site) → LLM `brand_fit` → JD-hex regex (`antcv-brandfit-sample.js`, "virtually
   never fires" — job ads carry no CSS). Many companies miss on all three → no brand.
3. **Export/preview parity break** — the export resolves `--header-bg`/`--sidebar-bg` from
   `document.body` (EXPORT-PALETTE-PARITY-001, antcv-docx-client.js:2096-2130), but brand-fit
   sets the colour as an **inline var on the paper-wrapper** (a descendant, app.src.js:50989 /
   scope rule 26975). `getComputedStyle(document.body)` therefore reads the PACKAGE value, not the
   brand — unless the package flipped to `custom` and body carries no token. Preview can look
   branded while export stays default.
4. **Per-app persistence** — restore (BRAND-FIT-OPEN, app.src.js:17419-17440) re-applies brand
   only from `meta.styleConfig`/`meta.brandV2`. If brand lived in the global session styleConfig
   and wasn't copied into per-app meta at save, restore finds nothing (owner's "lost on load of a
   saved application" symptom). [[brandfit-per-app-leak]], [[sidecar-prefs-clobber-hazard]].

### Fix (single source of truth, per-app, deterministic)
- **Persist the per-app brand on the application record** — `meta.brandV2` (v2 slots) +
  `meta.styleConfig`, cloud-safe standalone, keyed by app id; written at save/generate. This is
  what BRAND-FIT-OPEN already reads, so restore then works.
- **Export reads the same brand the preview uses.** In `buildStyle()`, after the body-token
  block, when a brand is active (`antcv:brandV2` + `__antcvBrandFit`) inject `brandV2.slots`
  (headerBg/sidebarBg/accent/photoBorderColor) into `out.*` so brand wins over the package token
  — closing the wrapper-vs-body parity gap. (Alternative: also stamp the vars on `document.body`
  when brand active; rejected — it would recolour app chrome, which scope rule 26975 forbids.)
- **Allow an explicit per-app brand** (from a known-company map or manual set) so a company whose
  site/JD carries no usable colour still gets its real brand (e.g. Ibsen blue `#0B4F8A`, amber
  `#D97706`) without relying on the fragile sampler.
- **QA assert** at generate: brand active but emitted `headerBg`==default package → fail the gate.

Deliverable: a persisted per-app brand flows end-to-end — preview **and** worker export —
surviving cloud-restore and reload of a saved application.

---

## 5. CV header / figure (CV-only) + footer notice + margins

Recompose existing worker primitives (`roundRect` map `index.js:23774`; `w:hdr`/`headerReference`;
anchored `ellipse` photo; `photoPosition`; footer `_aiNotice`):
- **CV**: first-page header = rounded box (blue fill, amber 1.5pt border, ~17% radius, full
  content width) holding name (tracking +4) / subtitle (accent, amber colored underline,
  tracking −9) / contact line (tracking −16). Photo = 1.4″ ellipse + amber ring anchored inside
  the header, left. Margins `header=144` (0.1″), `left/right≈200`, `top/bottom=0`. AI notice →
  footer. `titlePg` so the box is first-page only.
- **CL**: **no figure, no rounded candidate box** (owner rule — figure is CV-only). CL keeps the
  lighter header + palette + footer notice + colored lead-in underlines.

Encode "figure/rounded-box = CV-only" as a **doc-type rule**, not a global toggle.

---

## 6. JD critical-signal targeting (three-priority evidence map)

Wire v5's evidence map into generation so Profile, Focus Areas and page-1 evidence all serve the
**same three ranked employer priorities**:

For each priority: employer need → why top-3 → supported candidate evidence → relevant
tools/methods → realistic first contribution → 3–6-month contribution → residual uncertainty.
Distinguish responsibilities / qualifications / personality requirements / eligibility. Never
turn a candidate hypothesis or unanswered question into a confirmed employer need. The existing
per-app `ANALYSIS.json` (`gaps`, `strengths`, `questions_to_employer`, `positioning_advice`,
`red_flags`) is the seed for these signals.

---

## 7. Fixing the current applications

| App | Role | Fit | Status |
|---|---|---|---|
| 1017 Ibsen Photonics | Project Manager for SBC | moderate | Reference done (`FINAL v3/v4`) — becomes the gold template |
| 1018 Aimpoint AB | Optical Engineer (Malmö; red-dot/reflex sights) | good | Regenerate: brand + v5 structure; JD signals = red-dot optics, Sweden work-auth |
| 1019 Demant | Senior PM, Hearing Solution Quality (medical, SAFe) | good | Regenerate: brand + v5 structure; JD signals = regulated/medical PM, SAFe, product registration |

Each regenerated pair carries: correct brand, v5 CL structure, Gabriel facts incl. the **LiDAR
substitute 10× cost cut** ([[gabriel-cv-facts]]), CV-only header photo/box, colored underlines,
tracking, footer notice. Deliver a per-app **gap analysis** (raw → target) alongside.

---

## 8. Deliverables & sequencing

1. **This plan** (done).
2. **Brand-colour fix** (prerequisite for any auto-generation).
3. **Fit-it ladder** + **Enhance** alignment.
4. **CV header/figure + footer + margins** recomposition; **CV-only figure** rule.
5. **JD-critical-signal** wiring.
6. **Evidence artifacts**: brand-correct CV+CL for Ibsen (ref) / Aimpoint / Demant; per-app gap
   analyses; **Word versions of the three JDs**.

Production mechanism for the six evidence documents is a fork (see chat): **(A)** land the
worker brand-fix first, then auto-generate all three via the docx-worker (scalable, but a
production worker change + deploy + identity test), or **(B)** hand-produce them now from the v5
spec + FINAL template (fast evidence, no engine change). Recommendation: **A** — the whole point
is the engine, and hand-produced docs prove nothing about generation.

Discipline: worker/`pwa` changes need a shift-lane claim + version bump + deploy + preview
parity ([[export-sanitize-and-preview-parity]]); `docx-worker` `src/index.js` is hand-maintained
([[docx-worker-bundle-no-build]]). This doc is docs-only.
