# Pass 1 P0-5 — `topbarOrder` ReferenceError investigation

**Plan citation:** AntCV_Plan_v2_LockedSources.md §7 Pass 1 step 5 / Appendix A row "app.js ~line 2001 — Fix `topbarOrder` ReferenceError".

**Build basis:** v1.40.337-ai-notice-fix (`pwa/app.js`, character offsets given here are post-minification — line numbers from the original source no longer apply).

## All references to `topbarOrder` in the current build

| # | Char offset | Context | Type |
|---|---|---|---|
| 1 | 171825 | `function He({...,topbarOrder:s,setTopbarOrderState:c,...})` | Prop destructure — `topbarOrder` renamed to local `s` |
| 2 | 172126 | `w=e=>{c(e),u.set("topbarOrder",e)}` | Setter inside `He` — string-literal storage key + destructured setter `c` |
| 3 | 230195 | `[hr,yr]=React.useState((()=>u.get("topbarOrder",["name","specialisation","contact"])))` | Parent state init from storage |
| 4 | 525604 | `[...,"topbarOrder","fontSizes",...]` | String literal in a key-list (cloud-sync allow-list) |
| 5 | 763940 | `React.createElement(He,{...,topbarOrder:hr,setTopbarOrderState:yr,...})` | Prop passed to `He` |

All five references are correct uses (destructure, string literal, state binding, prop pass-through). There is no bare `topbarOrder` identifier read outside of destructuring or string-key context. The parked ReferenceError described in the plan is not reproducible in v1.40.337.

## Likely fix history

The plan was written against build basis v1.40.334-fixed. Between v1.40.334 and v1.40.337 the relevant `He` component was either renamed or its destructure tightened — the current shape (`{...,topbarOrder:s,setTopbarOrderState:c,...}` with the local rename to `s`) is the safe form.

## Pass 1 disposition

No code change required. If the user encounters a `ReferenceError: topbarOrder is not defined` (or similar) at runtime, capture the stack trace from DevTools and re-open as a follow-up.
