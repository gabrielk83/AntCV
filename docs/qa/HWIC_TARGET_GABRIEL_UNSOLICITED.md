# Target HWIC content — Gabriel, UNSOLICITED application

> Owner-approved (2026-06-26) **gold target** for the "HOW I WOULD CONTRIBUTE" section on Gabriel's
> **unsolicited / open** application. Keep generated unsolicited HWIC aligned to this — same shape
> (intro lead-in → 4 verb-led bullets → closing line), same voice (direct, concrete, no filler),
> same length band. This is the reference to compare a fresh generation against, and the seed/few-shot
> source if we later wire it into the unsolicited HWIC prompt.

## Rendered content (as the owner approved it)

**HOW I WOULD CONTRIBUTE**

I would start by listening: understanding the products, teams, open risks, and where decisions get
stuck. From there:

- **Map** technical value, unclear requirements, validation gaps, and weak change control
- **Translate** engineering input into clear material for management, suppliers, customers, or partners
- **Support** product and project work across electro-optics, systems, validation, suppliers, and governance
- **Reduce** repeated discussions, late changes, and hidden technical risk

The goal: clearer decisions, better technical traceability, and less critical knowledge stuck in
people's heads.

## Structure notes (what makes it the target)

- **Intro** is a markerless lead-in ending with a colon (": From there:") — sets up the bullets.
- **Four bullets**, each a **bold one-word verb lead-in** (`b`) + a concrete body (`t`):
  Map / Translate / Support / Reduce. Parallel, action-first, no hedging.
- **Closing** is a markerless line starting "The goal:" — names the outcome, not the activity.
- Voice: plain, specific, owner's banned-word standard. No "leverage / passionate / synergy" etc.
- Domain anchors that must survive (Gabriel-real): electro-optics, systems, validation, suppliers,
  governance, change control, requirements, traceability.

## rich_block shape (the `contribute` section, `items[]`)

```json
{
  "id": "contribute",
  "title": "HOW I WOULD CONTRIBUTE",
  "loc": "main",
  "on": true,
  "type": "rich_block",
  "items": [
    { "b": "", "t": "I would start by listening: understanding the products, teams, open risks, and where decisions get stuck. From there:" },
    { "b": "Map", "t": "technical value, unclear requirements, validation gaps, and weak change control", "mk": true },
    { "b": "Translate", "t": "engineering input into clear material for management, suppliers, customers, or partners", "mk": true },
    { "b": "Support", "t": "product and project work across electro-optics, systems, validation, suppliers, and governance", "mk": true },
    { "b": "Reduce", "t": "repeated discussions, late changes, and hidden technical risk", "mk": true },
    { "b": "", "t": "The goal: clearer decisions, better technical traceability, and less critical knowledge stuck in people's heads." }
  ]
}
```

Intro/closing carry NO `mk` (markerless paragraphs); the four middle rows carry `mk: true` (bulleted).
This matches the 760 converter's intro-by-colon detection — see [[cl-leadins-and-methods-richblock]] and
HWIC-INTRO-DETECT-001.
