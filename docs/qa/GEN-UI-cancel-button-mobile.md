# GEN-UI: mobile "Cancel & return to editor" button buried during generation [OPEN]

**Reported:** 2026-06-09 (mobile, antcv.pages.dev). Confirmed in screenshot at ~57% zoom.

## Symptom
During CV/CL generation the progress screen renders a "Stuck? Tap below to return
to the editor…" note + a "↺ Cancel & return to editor" button. On mobile this
button sits at the very bottom of the overlay — BELOW the full two-column LIVE
PREVIEW track (PROFILE, WORK STYLE, SELECTED OUTCOMES, CORE COMPETENCIES,
PROFESSIONAL EXPERIENCE, TOOLS & METHODS … on the CV side, plus the whole Cover
Letter column). The user must scroll past the entire preview to reach it, so it is
effectively hidden (barely visible even zoomed out to 57%). If generation hangs,
the escape hatch is exactly when it's hardest to find.

## Location (verified in pwa/app.src.js)
- Overlay component: function `Ue({...})` (the "Generating…" screen).
- Cancel block: ~line 11307-11345. Structure:
    React.createElement("div", { style:{ borderTop:"1px solid rgba(255,255,255,0.08)",
      paddingTop:14, marginTop:6 } },
      <div> "Stuck? Tap below to return to the editor — your CV draft is safe." </div>,
      <button onClick:o style:{ padding:"10px 18px", background:"rgba(255,80,80,0.15)",
        border:"1px solid rgba(255,120,120,0.45)", color:"#ffb4b4", borderRadius:7,
        fontSize:12, fontWeight:600, cursor:"pointer", minWidth:180 }}
        "↺ Cancel & return to editor" )
    )
  The button's `onClick` is `o` (the cancel/return handler passed into `Ue`).
- The LIVE PREVIEW track is rendered before this block, so the cancel control is
  pushed off-screen on mobile viewports.

## Fix options (pick one; mobile-first)
1. **Preferred — keep cancel near the status header.** Move the Stuck?/Cancel block
   to render ABOVE the LIVE PREVIEW (right under the "Generating… / Wrapping up…"
   progress line + bar), so it's visible without scrolling. Desktop is unaffected
   (plenty of vertical room).
2. **Or make it sticky.** Wrap the cancel block in a position:sticky footer that
   pins to the bottom of the viewport while the preview scrolls underneath:
     style:{ position:"sticky", bottom:0, zIndex:5,
             background:"linear-gradient(180deg, transparent, <overlay-bg> 40%)",
             paddingTop:14 }
   (use the overlay's background colour so the button sits on an opaque strip).
3. **Or cap the preview height + internal scroll.** Give the LIVE PREVIEW container
   a maxHeight (e.g. `min(55vh, 520px)`) with `overflowY:"auto"`, so the
   Stuck?/Cancel block stays on-screen below it instead of being pushed down by the
   full-length preview.

Recommendation: option 1 (move above preview) is the smallest, least risky change
and directly matches the user's note ("set higher / less visible area of status
track"). Option 2 is the most robust if we want it always reachable mid-scroll.

This is a layout change in the minified `app.js` AND the readable mirror
`app.src.js`. Apply in both. Validate with `node --check pwa/app.js` and
`node --check pwa/app.src.js`. Verify on a real mobile viewport during an actual
generation (the preview must be long enough to scroll), desktop unaffected.

## Note
Edit must go through a terminal/Codespaces session — `app.js` (848 KB) can't be
written inline through the antcv-mcp tools. The minified token names in `app.js`
for this block: button `onClick:o`, same style object as above; search the minified
file for `Cancel & return to editor` to anchor the block.
