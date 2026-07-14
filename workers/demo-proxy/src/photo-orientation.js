// PHOTO-FLIP-001 — photo-orientation vision endpoint (POST /api/photo-orientation)
// ============================================================================
// The client's local BlazeFace model reads HEAD yaw only; for a near-frontal
// head with an angled torso it returns center/unknown. This endpoint is the
// cost-GATED fallback the client calls ONLY in that case: a vision LLM decides
// which way the person is oriented (head + shoulders) and returns one word.
//
// Provider order (cheap -> capable): Mistral `pixtral-12b` FIRST (owner's
// preference; Mistral's own vision recipe uses the BARE model id `pixtral-12b`,
// NOT pixtral-12b-2409/-latest, which this key silently swaps for the text model
// ministral-14b). We call Mistral directly (no json_object — pixtral's vision
// path returns plain text) and ONLY accept it when the served model is actually
// a pixtral model — otherwise we treat it as a blind substitution and fall
// through to Claude (claude-sonnet-5, the writer key) then OpenAI (gpt-4o),
// each with its native image-block shape.
//
// Identical file lives in workers/proxy and workers/demo-proxy (near-copies).
import { callAnyLLMForJSON, getKeyForProvider } from './multi-llm.js';

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
function parseFacing(t) {
  if (!t) return null;
  try {
    const f = String(JSON.parse(t).facing || '').toLowerCase();
    if (f === 'left' || f === 'right' || f === 'center') return f;
  } catch { /* fall through to a loose scan of the plain text */ }
  const s = String(t).toLowerCase();
  if (/\bleft\b/.test(s) && !/\bright\b/.test(s)) return 'left';
  if (/\bright\b/.test(s) && !/\bleft\b/.test(s)) return 'right';
  if (/\bcenter\b|\bfront\b|\bcentre\b/.test(s)) return 'center';
  return null;
}
const isFacing = (t) => parseFacing(t) !== null;

// Direct Mistral Pixtral vision call (bare `pixtral-12b`, image_url string form,
// no json_object). Returns { facing, model } only when a real pixtral model
// served it; null on any failure OR a blind ministral substitution.
async function mistralPixtral(env, media, b64) {
  try {
    const key = await getKeyForProvider(env, 'mistral');
    if (!key) return null;
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'pixtral-12b',
        max_tokens: 30,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: SYSTEM + '\n\n' + TEXT },
            { type: 'image_url', image_url: `data:${media};base64,${b64}` },
          ],
        }],
      }),
    });
    if (res.status !== 200) return null;
    const data = await res.json().catch(() => null);
    const served = String((data && data.model) || '');
    if (!/pixtral/i.test(served)) return null; // blind substitution (e.g. ministral) -> reject
    const facing = parseFacing(data?.choices?.[0]?.message?.content || '');
    if (!facing) return null;
    return { facing, model: served, provider: 'mistral' };
  } catch (_) { return null; }
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

  // 1) Mistral Pixtral (cheap, owner's preference) — accepted only if a real
  //    pixtral model served it.
  const mp = await mistralPixtral(env, media, b64);
  if (mp) return jsonResponse({ ok: true, facing: mp.facing, provider: mp.provider, model: mp.model }, 200, cors);

  // 2) Fallback to genuinely-multimodal providers via the shared cascade, each
  //    with its native image-block shape.
  const anthropicContent = [
    { type: 'text', text: TEXT },
    { type: 'image', source: { type: 'base64', media_type: media, data: b64 } },
  ];
  const openaiContent = [
    { type: 'text', text: TEXT },
    { type: 'image_url', image_url: { url: `data:${media};base64,${b64}` } },
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
  const facing = parseFacing(r.text) || 'center';
  return jsonResponse({ ok: true, facing, provider: r.provider, model: r.model }, 200, cors);
}
