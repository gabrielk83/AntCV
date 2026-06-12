# PREVIEW-CHATBOT-001 — stage 1 (shipped) + stage 2 (designed)

Owner spec 2026-06-07; staged delivery directive 2026-06-12.

## Operation (stage 1, live)

1. **Trigger** — select any text inside the preview paper. A small
   "✨ AI edit" pill appears by the selection (mouse-up on desktop, the same
   selection event covers mobile long-press selections). Click it — or just
   right-click a selection — to open the panel.
2. **Panel** — anchored near the selection, one card:
   - the selected text quoted at the top (the edit target);
   - four QUICK ACTIONS: `Shorten` · `More concrete` · `Calmer tone` ·
     `Fix wording` — one tap, no typing;
   - a free-instruction box ("say what should change…") + **Ask**;
   - result area: the proposed rewrite + a one-line **Why** (the model
     explains its change, anchored to the writing rules), then
     **Apply** / **Discard**; after Apply, **Undo** restores the exact
     pre-edit state.
3. **Engine** — one buffered LLM call through the cv-proxy root pipeline
   (`x-provider` header), so the request automatically gets: the
   writing-style envelope from the islands fetch-wrap, the SCE banned-word /
   structure checks WITH retries server-side, demo enforcement, and the
   flagged-draft toast on a dirty third draft. The system prompt pins the
   contract: respect every AntCV rule (banned words, hyphen-not-em-dash,
   keep numbers/proper nouns/length), return JSON `{rewrite, reason}` only.
4. **Apply** — the rewrite replaces the selected text IN PLACE in the
   sections store via the same text-match model the preview editor uses
   (walks every text-bearing shape: content/items/{b,t}/{l,v}/roles/rows…),
   then `antcv:sections-updated` re-renders. Undo = one-click restore of the
   pre-edit sections snapshot.

## Step-2 readiness (UI already shaped for it)

- The **Why** line is a dedicated element fed from the model's `reason` —
  step 2 upgrades it to RULE-ANCHORED citations (`rules` array in the JSON:
  e.g. `banned-word: spearhead→led`, `ORPHAN rule: ≥4 words on final line`)
  rendered as chips in the existing `data-antcv-aibot-rules` container
  (present, empty in stage 1).
- The panel body is a conversation column (`data-antcv-aibot-log`) — stage 1
  shows one exchange; step 2 appends turns for iterative refinement.
- Per-element context: the matcher already identifies the owning section —
  step 2 passes the section id + type into the prompt for section-specific
  rules (PROFILE vs OUTCOMES budgets) and a diff-preview before apply.

## Stage-2 backlog (the step after this)

1. Rule-citation chips (`rules[]` in the response contract).
2. Multi-turn refinement ("shorter still", "keep the number").
3. Section-aware budgets in the system prompt (per-section char budgets).
4. Move/relocate commands ("move this to the sidebar") via section ops.
5. Colour/format commands routed to styleConfig instead of text.
