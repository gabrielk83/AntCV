// PHOTO-FLIP-001 — photo-orientation vision endpoint (POST /api/photo-orientation)
// ============================================================================
// The client's local BlazeFace model reads HEAD yaw only; for a near-frontal
// head with an angled torso it returns center/unknown. This endpoint is the
// cost-GATED fallback the client calls ONLY in that case: a vision LLM decides
// which way the person is oriented (head + shoulders) and returns one word.
//
// Provider note: `mistral` is VISION-BLIND on this account — the key silently
// serves a text model (ministral-14b) for any requested model, so it can't see
// the image. We therefore use genuinely-multimodal providers: Claude first
// (the configured writer key, vision-capable), then OpenAI (gpt-4o) as a
// fallback. Each needs its OWN image-block shape (callAnyLLMForJSON forwards
// the content verbatim, so we format per provider).
//
// Identical file lives in workers/proxy and workers/demo-proxy (near-copies).
import { callAnyLLMForJSON } from './multi-llm.js';

const MAX_B64 = 5_000_000; // ~3.75 MB decoded, matches the OCR cap
const SYSTEM =
  'You classify the orientation of the person in a CV portrait photo. ' +
  'Consider the HEAD direction AND the shoulders/torso. Reply with STRICT JSON only: ' +
  '{"facing":"left"|"right"|"center"}. ' +
  '"left" = the person is oriented toward the viewer\'s LEFT side of the image; ' +
  '"right" = toward the viewer\'s RIGHT; ' +
  '"center" = front-facing or genuinely ambiguous. No prose, JSON only.';
const TEXT = 'Which way is this person oriented (head + shoulders)? Return the JSON only.';

function jsonResponse(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
function isFacing(t) {
  try {
    const f = String(JSON.parse(t).facing || '').toLowerCase();
    return f === 'left' || f === 'right' || f === 'center';
  } catch { return false; }
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

  // Anthropic image-block shape (Claude) and OpenAI image_url shape.
  const anthropicContent = [
    { type: 'text', text: TEXT },
    { type: 'image', source: { type: 'base64', media_type: media, data: b64 } },
  ];
  const openaiContent = [
    { type: 'text', text: TEXT },
    { type: 'image_url', image_url: { url: 'data:' + media + ';base64,' + b64 } },
  ];

  let r;
  try {
    r = await callAnyLLMForJSON(env, SYSTEM, anthropicContent, { order: ['anthropic'], validate: isFacing });
    if (!r || !r.ok) {
      r = await callAnyLLMForJSON(env, SYSTEM, openaiContent, { order: ['openai'], validate: isFacing });
    }
  } catch (e) {
    return jsonResponse({ ok: false, error: 'vision_exception', detail: String(e && e.message || e) }, 502, cors);
  }

  if (!r || !r.ok) {
    return jsonResponse({ ok: false, error: 'vision_failed', attempts: (r && r.attempts) || null }, 502, cors);
  }
  let facing = 'center';
  try { facing = String(JSON.parse(r.text).facing || '').toLowerCase(); } catch { /* keep center */ }
  if (facing !== 'left' && facing !== 'right' && facing !== 'center') facing = 'center';

  return jsonResponse({ ok: true, facing, provider: r.provider, model: r.model }, 200, cors);
}
