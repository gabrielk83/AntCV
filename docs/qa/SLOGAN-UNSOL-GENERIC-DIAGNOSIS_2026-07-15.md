# Diagnosis — unsolicited slogan is tailored + truncated ("AS A PRODUCT AND PROJECT EXPERT, I BRIDGE")

Owner 2026-07-15 (unsolicited app generated ~02:03): the CL slogan read
"AS A PRODUCT AND PROJECT EXPERT, I BRIDGE" — a dangling transitive verb ("bridge"
with no object), AND it was a role-tailored slogan on an **unsolicited** application
instead of the generic standing default. Two independent root causes.

## Root cause A — the awkward "…I BRIDGE" (truncation leaves a dangling verb)

The stored slogan was longer than the cap and got guillotined mid-clause.

- **App-side cap `__antcvSloganCap`** (`pwa/app.src.js:2359`, mirrored `pwa/app.js`) hard-chops
  to 8 words, then scrubs only a trailing **punctuation** or **stopword**
  (`and|or|nor|but|with|to|through|for|of|the|a|an|og|eller|som|både`). It has **NO clause-cut**
  (unlike the Python side) and does **not** drop a dangling **content verb**. So
  "As a product and project expert, I bridge <strategy and delivery>" → first 8 words →
  "As a product and project expert, I bridge" → nothing to scrub → dangling "bridge".
- **Python cap `_cap_slogan_words`** (`scripts/job-tracker/gen-runner.py:1461`) DOES prefer a
  clause cut (first comma/dash → head if 4..9 words) and scrubs a trailing stopword
  (SLOGAN-WORD-CAP-DANGLE-001), but likewise does not drop a dangling verb. The export path
  uses the APP cap (via `__antcvResolveSlogan`), so the app cap's missing clause-cut is what
  shows in the exported PDF/DOCX.

## Root cause B — unsolicited was not treated as "use the generic"

The slogan **generation** has no unsolicited branch:

- `gen-runner.py:431` (and the in-app gen prompt) always instruct: *"a specific statement of the
  value THIS candidate brings to THIS employer, FUSED to the EMPLOYER BRAND block."* For an
  unsolicited/open application there is **no employer and no brand block**, so the model is
  forced to manufacture a "value to the employer" line with nothing to anchor to → a strained,
  generic-but-broken personal claim.
- The rule the owner expected — *"unsolicited keeps the standing default"* (SLOGAN-SMART-STATEMENT-001)
  — lives ONLY on the render side and only fires when there is **no stored slogan**. But generation
  DID store one:
  - `gen-runner.py:1579` writes `_meta["slogan"] = slogan` unconditionally.
  - On load, `pwa/app.src.js:41202` / `:47625` copy `meta.cl_slogan || meta.slogan` into the
    `antcv:clSlogan` override, stamped `clSloganCtx.app = <this app>`.
  - `antcv-cl-slogan-fresh.js` keeps an override **owned by this app** (its unsolicited branch
    only clears a slogan that stuck from a DIFFERENT app), so the tailored line survives.
  - The render's shared resolver `__antcvResolveSlogan` (`pwa/app.src.js:2397`) reads
    `io.cl_slogan` → override → subtitle with **no unsolicited gate**, so it returns the tailored
    slogan. (Note: not every render site uses the shared resolver — the React standalone render
    reads `meta.cl_slogan` directly too.)

Net: the generic-for-unsolicited intent is defeated upstream because generation always emits a
tailored slogan and the load path promotes it to the sticky override.

## Fix (owner chose option (a): unsolicited → the generic standing default)

1. **Generation (both paths): unsolicited emits NO tailored slogan.**
   - `gen-runner.py`: gate `_meta["slogan"]` (line 1579) on not-unsolicited (company matches the
     unsol set / category == 'unsolicited'); optionally skip the `cl_slogan` field for unsolicited.
   - In-app gen prompt: same carve-out.
2. **Render/export: unsolicited yields the tailored slogan to the generic.**
   - `__antcvResolveSlogan` (app.src.js:2397 + app.js): if `window.__antcvUnsol(io.company)`, skip
     `io.cl_slogan` AND an override that is merely the auto-copied generated slogan (matches
     `io.cl_slogan`), fall through to `io.subtitle` (the Processes • Products • People triad). A
     genuinely USER-EDITED override (differs from the gen slogan) is still honored.
   - Apply the same unsolicited gate at the other render sites that read `meta.cl_slogan` directly
     (React standalone render, srcdoc, and the load-path copy at 41202/47625 — do not copy the gen
     slogan into the override for unsolicited).
   - `antcv-cl-slogan-fresh.js` `!isTargeted` branch: also drop an override that equals the gen's
     `io.cl_slogan`/`meta.slogan` (fixes ALREADY-generated unsolicited apps without a regen).
3. **Cap never strands a verb (defensive, both caps).**
   - `__antcvSloganCap` (app) + `_cap_slogan_words` (python): add a clause-cut to the app cap to
     match Python, and extend the dangle scrub to also drop a trailing `pronoun + transitive-verb`
     fragment ("I bridge", "that connect", "we deliver") so a hard chop always ends on a complete
     phrase.

All app.js edits are surgical mirrors of `app.src.js` (never rebuild), behind the existing slogan
kill switches where practical, cache-bust quartet on every changed pwa asset.
