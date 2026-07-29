# PHOTO-FLIP-001 — Photo horizontal flip (Off / On / Auto)

**Owner request (2026-07-14):** In Settings → Layout, inside the expandable/collapsible
photo control, add a photo horizontal flip: **Off / On / Auto**.
- **On** = manual mirror (flip the photo direction from the source image).
- **Auto** = detect the person's orientation and ensure their posture faces INTO the
  content, not toward the near page corner. Relevant especially when the sidebar
  changes side or the photo-position button is left at default.

Feature code: `pwa/antcv-photo-ui-427.js` MODULE D (preview + control + detection) and
`pwa/antcv-docx-client.js` (export mirror). Owner-facing memory:
`.claude/…/memory/photo-horizontal-flip.md`.

---

## DONE / WORKING (shipped, verified in a real browser)

| Piece | Version | Status |
|---|---|---|
| Off / On segmented control in Settings → Layout **PROFILE PHOTO** (collapsible) control | 1.51.761 → 1.51.842 | ✅ Working |
| **On** mirrors the live CV preview (`transform: scaleX(-1)`) | 1.51.761 | ✅ |
| **On** mirrors the exported DOCX/PDF (client canvas-mirrors the PNG before send) | 1.51.761 | ✅ |
| **On** mirrors the upload-menu avatar (photo-library carousel `.antcv-carousel-pic`) | 1.51.802 | ✅ (owner confirmed) |
| Settings placement fixed — control now lives in the all-caps **PROFILE PHOTO** Layout control, not the title-case "Profile Photo" upload block | 1.51.842 | ✅ (owner confirmed) |
| Flip mode + detected facing in STANDALONE keys (`antcv:photoFlip` / `antcv:photoFacing`) so **Reset all** / cloud-restore don't wipe them | 1.51.781 | ✅ |
| Re-detect gate (`antcv:photoFacingVer` = `DET_VER`) so a new detector re-runs on cached photos with no re-upload | 1.51.802 | ✅ |

### Key fixes along the way
- **1.51.781** — moved mode/facing out of `personalInfo.stylePrefs` (which "Reset all"
  and cloud-restore wipe) into standalone keys.
- **1.51.784** — bundled a real face model (BlazeFace / TensorFlow.js, lazy-loaded from
  CDN; correct UMD is `dist/blazeface.min.umd.js`).
- **1.51.802** — detector-version tag (auto-heals stale `unknown`); Auto force-detects;
  carousel thumbnail flips by class.
- **1.51.842** — anchor the control to the **position-button row's parent** (never the
  label text; the collapse sidecar caps the label at <40 chars, and label pollution was
  making the whole panel vanish). Case-SENSITIVE `PROFILE PHOTO` so it never grabs the
  upload block. `ensureUI` dedups + relocates a drifted control.

---

## SHIPPED (1.51.942) — gated vision fallback for AUTO orientation

When the FREE local detector (BlazeFace + heuristic) returns center/unknown, the
client (MODULE D) POSTs the photo ONCE to `{proxyUrl}/api/photo-orientation`
(new endpoint in BOTH `workers/proxy` + `workers/demo-proxy`) which asks a vision
LLM which way the person is oriented (head + shoulders) → `{facing}`. Gated so it
bills only on the ambiguous photos; never per render/export; 12 s abort; any
failure keeps the local result. `DET_VER=m4` re-runs cached center/unknown.

**Provider order:** Mistral **`pixtral-12b`** FIRST (owner's preference, cheapest),
then Claude (`claude-sonnet-5`, the writer key), then OpenAI (`gpt-4o`) — each with
its native image-block shape.

**Mistral finding (CONFIRMED 2026-07-14, raw API response captured):** tried
Mistral's exact documented recipe — bare model id `pixtral-12b` (not
`pixtral-12b-2409`/`-latest`), `image_url` string form, no `json_object`. This
account's Mistral **key still answers `pixtral-12b` with `served: "ministral-14b-latest"`**
(HTTP 200) — a TEXT model that can't see the image and returns a blind guess. So
it's an **account/key limitation, not a model-id or format issue**: this key has
no Pixtral vision access. The handler therefore GUARDS the Mistral result (accepts
it only when the *served* model is actually a pixtral model) and otherwise falls
through to Claude. The Mistral path stays first, so it activates automatically if
the key later gains Pixtral. Claude does the real work today — verified live: a
clear left-profile → `left`, its horizontal flip → `right`.

**Owner action for Mistral vision:** enable a Mistral plan/key with **Pixtral**
access; no code change needed then.

Follow-up: if demo users hit the **access-relay** (not cv-proxy directly), the
relay may need `/api/photo-orientation` added to its forward allowlist.

## Historical — why AUTO needed the vision fallback (near-frontal photos)

**Symptom (owner, 2026-07-14):** Auto still reports "orientation unclear / not detected"
on the owner's headshot (near head-frontal, torso angled left→right).

**Root cause:** BlazeFace detects **head yaw only** (nose vs eyes/ears). The owner's photo
is roughly head-frontal with an **angled torso/shoulders** — a *body* orientation cue the
face model can't see. The canvas fallback heuristic (skin-region + feature/skin asymmetry)
is not reliable enough for body orientation either. Thresholds were lowered (1.51.842) to
be more decisive, but a genuinely frontal head still reads `center`.

**Workaround today:** **On / Off** is the deterministic manual override.

---

## PLAN — gated vision-LLM fallback (Mistral)

Owner pointed to Mistral vision (https://docs.mistral.ai/studio-api/conversations/vision)
and noted the relay already supports it. Confirmed:
- `workers/access-relay` `ALLOWED_PROVIDERS = {claude, openai, mistral, gemini}`.
- `workers/demo-proxy/src/index.js` already has vision plumbing that translates an
  Anthropic-style image block to each provider's shape, incl. **Mistral**
  (`{ type: 'image_url', image_url: "data:…;base64,…" }`, string form).
- Existing precedent: `POST {proxyUrl}/api/extract-jd-image` (`{image_base64, media_type}`
  → vision OCR) wired from `pwa/antcv-recheck-fit.js` `extractTextFromImage`.

**Design (cost-gated so it bills only on ambiguous photos):**
1. **New demo-proxy endpoint** `POST /api/photo-orientation` — body `{image_base64, media_type}`.
   Builds a vision message: *"This is a portrait for a CV. Which way is the person
   oriented / facing — reply with exactly one word: left, right, or center (front-facing)."*
   Routes to a vision model (Mistral **pixtral**; cascade to the existing vision provider on
   error). Parses the one-word answer → `{ ok, facing: 'left'|'right'|'center' }`.
2. **Client** (`antcv-photo-ui-427.js` MODULE D): only when the **local** detector returns
   `center`/`unknown` (BlazeFace + heuristic), call `/api/photo-orientation` once, store the
   result under the same `antcv:photoFacing` (+ `DET_VER`) keys. Runs once per photo at
   upload — never per render, never per export. If the relay/proxy is unreachable, keep the
   local result (no hard failure).
3. **Cost:** one vision call only on photos the free local model can't resolve; near-zero on
   the rest. Honours the owner's "as long as you are not more expensive" — the local model
   stays the default and this is the exception path.

**Requires:** a demo-proxy worker change + deploy (workers deploy via manual
`gh workflow run`, per `deploy-model` memory), plus a Mistral key present on the proxy
(secret `MISTRAL_API_KEY` — already referenced by `workers/demo-proxy/src/index.js`).

**Status:** NOT built yet — documented here as the actionable next step, pending go-ahead.
