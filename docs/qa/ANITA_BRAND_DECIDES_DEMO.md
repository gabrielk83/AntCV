# Anita demo — BRAND-DECIDES-RESEARCH-001 (headless brand + slogan)

Live end-to-end demo of the brand-decides site-crawl on the **Anita Myre-Kornfeldt**
test persona (`docs/personas/anita/`), against the application delivered in her
folder (**BeezKneez Logistics**, "Hive Operations Engineer", Copenhagen). Run
2026-07-15 through the **deployed** `cv-proxy` worker (PR #352, live).

The point of the demo: prove that with the SAME candidate (Anita) and JD, the
generated slogan **fuses to whatever the site-crawl finds** — and, when the
employer has no reachable site, the crawl returns **empty + a flag** and the
slogan falls back to Anita's own candidate-fit value, **never inventing a
company value**.

Candidate: Anita Myre-Kornfeldt — *Operations and Winter Preparedness Specialist*.
Her stored candidate-fit `clSlogan`: `"I keep operations steady through every winter"`.

## Arm A — Anita's actual folder application (BeezKneez, synthetic `.example` employer)

The crawl resolves the two guessed domains, finds no reachable brand site, and
degrades honestly:

```
capture_brand("", "BeezKneez Logistics")  [LIVE cv-proxy]
  colours:  navy=(none)  accent=(none)   source=None
  research: spirit=""  values=[]  tone=""  flag="no_site"  signals_used=False
  slogan_placement: heading            (-> antcv:clSloganMode)
  slogan_brief:     ""                 (no brand block reaches the slogan prompt)

  FUSED SLOGAN (raw): "Winter-ready operations that keep automated routes and supplies reliably moving"
```

The slogan is derived from Anita's fit + the JD alone — **zero invented BeezKneez
brand value**. This is the no-fabrication guarantee on a real application.

## Arm B — real logistics brand (DSV) — positive fusion

Same Anita, same operational JD, but a **real** employer whose site the crawl can
read:

```
capture_brand("", "DSV")  [LIVE cv-proxy]
  colours:  navy=#0a34a1  accent=#181818   source=www.dsv.com
  research: spirit="Keeping the world connected through reliable, end-to-end logistics"
            values=["reliability","global connectivity","digital innovation","operational control"]
            tone="formal"  flag=None  signals_used=True   (summary: claude-sonnet-5)
  slogan_placement: heading
  slogan_brief: "Brand spirit: Keeping the world connected through reliable, end-to-end
                 logistics | Brand values: reliability, global connectivity, digital
                 innovation, operational control | Brand tone: formal"

  FUSED SLOGAN (raw): "Reliable seasonal operations that keep last-mile routes winter-ready and audit-ready"
```

The slogan now **opens on DSV's first brand value ("Reliable")** and keeps Anita's
own operational substance ("seasonal operations", "winter-ready"). Contrast the
two openings — same candidate, brand-driven divergence:

| Arm | Employer | Brand signal | Slogan opening |
|---|---|---|---|
| A | BeezKneez (no site) | none (`no_site`) | *Winter-ready operations…* (candidate-fit) |
| B | DSV (real) | reliability / formal | ***Reliable** seasonal operations…* (brand-fused) |

## What this exercises

- The deployed worker (`/api/fetch-brand-colors` with `research:true`) — same
  round-trip samples colours AND summarises spirit/values/tone.
- `brand_fit.capture_brand` → `brand_record` (research + `slogan_placement` +
  `slogan_brief`), driven by an injected `post_json` (network-free, deterministic).
- `gen-runner`'s real `cl_slogan` section prompt (`_user_turn` with the brand
  block) + a single-section gen-job — the actual generation path, not a mock.
- The honesty guarantee: unreachable employer → empty + flag → candidate-fit only.

## Known separate issue (NOT brand-decides) — FIXED (SLOGAN-WORD-CAP-DANGLE-001, 1.51.1484)

The word cap (`_cap_slogan_words`, SLOGAN-WORD-CAP-001) hard-chopped a >9-word
slogan with no early clause break, and could leave a trailing conjunction — e.g.
Arm B raw (12 words) capped to `"…last-mile routes winter-ready and"`. The
fusion was always correct; only the cap's hard-truncation fallback was wrong.

Fixed: the hard-chop fallback now drops a trailing dangling stopword
(and/or/nor/but/with/to/through/for/of/the/a/an + Nordic og/eller/som/både) so
the capped line ends on a content word — Arm B now caps to
`"…last-mile routes winter-ready"`. The clause-cut path (comma/dash/semicolon/
colon) is unchanged. The app-side `window.__antcvSloganCap`
(`pwa/app.js` / `pwa/app.src.js`) carries the identical single-drop scrub so
preview == export. Unit coverage: `scripts/job-tracker/test_slogan_cap.py`.

## Reproduce

`scratchpad/anita_brand_demo.py` (session scratch) loads Anita's `personalInfo.json`,
runs `capture_brand` live for both arms, and drives the real `cl_slogan` section.
Costs ~1 LLM call per arm with a reachable site (brand summary + slogan); Arm A's
no-site crawl makes no summary call.
