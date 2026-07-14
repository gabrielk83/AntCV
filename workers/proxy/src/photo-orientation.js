// PHOTO-FLIP-001 — photo-orientation vision endpoint (POST /api/photo-orientation)
// ============================================================================
// The client's local BlazeFace model reads HEAD yaw only; for a near-frontal
// head with an angled torso it returns center/unknown. This endpoint is the
// cost-GATED fallback the client calls ONLY in that case: it asks a vision LLM
// (Mistral Pixtral) which way the person is oriented — considering head AND
// shoulders/torso — and returns one word.
//
// Reuses the shared multi-provider helper. We force provider=mistral with a
// Pixtral (vision) model chain, and pass Mistral-shaped content (image_url as a
// STRING). We deliberately DON'T pass opts.messages so the VISION_BLIND filter
// (which assumes the default mistral-large is text-only) can't drop us — the
// explicit pixtral model override makes the call vision-capable.
//
// Identical file lives in workers/proxy and workers/demo-proxy (near-copies).
import { callAnyLLMForJSON } from './multi-llm.js';

// Vision models verified available on the account (pixtral-large-* returned
// invalid_model; pixtral-12b + the 2503+ small/medium multimodals work).
const VISION_MODELS = ['pixtral-12b-2409', 'pixtral-12b-latest', 'mistral-small-latest', 'mistral-medium-latest'];
const MAX_B64 = 5_000_000; // ~3.75 MB decoded, matches the OCR cap

function jsonResponse(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

export async function handlePhotoOrientation(request, env, corsHeadersFor, _serverKeyFor) {
  const cors = corsHeadersFor(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, cors);

  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ ok: false, error: 'bad_json' }, 400, cors); }

  const b64 = typeof body.image_base64 === 'string' ? body.image_base64 : '';
  let media = typeof body.media_type === 'string' ? body.media_type : 'image/jpeg';
  if (!/^image\/(png|jpe?g|webp|gif)$/i.test(media)) media = 'image/jpeg';
  if (!b64) return jsonResponse({ ok: false, error: 'no_image' }, 400, cors);
  if (b64.length > MAX_B64) return jsonResponse({ ok: false, error: 'image_too_large' }, 413, cors);

  const dataUrl = 'data:' + media + ';base64,' + b64;
  const system =
    'You classify the orientation of the person in a CV portrait photo. ' +
    'Consider the HEAD direction AND the shoulders/torso. Reply with STRICT JSON only: ' +
    '{"facing":"left"|"right"|"center"}. ' +
    '"left" = the person is oriented toward the viewer\'s LEFT side of the image; ' +
    '"right" = toward the viewer\'s RIGHT; ' +
    '"center" = front-facing or genuinely ambiguous. No prose, JSON only.';
  const userPrompt = [
    { type: 'text', text: 'Which way is this person oriented (head + shoulders)? Return the JSON only.' },
    { type: 'image_url', image_url: dataUrl }, // Mistral string form
  ];

  let r;
  try {
    r = await callAnyLLMForJSON(env, system, userPrompt, {
      order: ['mistral'],
      models: { mistral: VISION_MODELS },
      validate: (t) => {
        try {
          const f = String(JSON.parse(t).facing || '').toLowerCase();
          return f === 'left' || f === 'right' || f === 'center';
        } catch { return false; }
      },
    });
  } catch (e) {
    return jsonResponse({ ok: false, error: 'vision_exception', detail: String(e && e.message || e) }, 502, cors);
  }

  if (!r || !r.ok) {
    return jsonResponse({ ok: false, error: 'vision_failed', attempts: (r && r.attempts) || null }, 502, cors);
  }
  let facing = 'center';
  try {
    facing = String(JSON.parse(r.text).facing || '').toLowerCase();
  } catch { /* keep center */ }
  if (facing !== 'left' && facing !== 'right' && facing !== 'center') facing = 'center';

  return jsonResponse({ ok: true, facing, provider: r.provider, model: r.model }, 200, cors);
}
