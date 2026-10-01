/* antcv-profile-rules.js — PROFILE-VOICE-001 / PROFILE-NO-BUZZWORD-LIST-001 / PROFILE-SLOGAN-001
 * (owner 2026-10-01, Improve Academy CV session)
 *
 * Pure checks for the CV PROFILE and its heading slogan. No DOM, no storage: runs in the
 * browser (window.__antcvProfileRules) and in node (module.exports) so the unit test and the
 * Layout-tab control (antcv-cv-profile-heading.js) share one rule set.
 *
 * Owner rules:
 *  - The profile never reads as a list of buzzwords.
 *  - Written with "I". The opening sentence is personal (introduce yourself by role); after it,
 *    turn to the company ("from me to them"): what they do or face, then "As your <role> I will…".
 *    Never self-focused motivation ("I'm excited", "I enjoy", "I'm drawn to").
 *  - The heading "PROFILE" is replaced by a slogan. The slogan must not repeat the cover-letter
 *    slogan: no shared content word.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.__antcvProfileRules = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var STOP = {
    a: 1, an: 1, the: 1, of: 1, and: 1, or: 1, with: 1, for: 1, to: 1, in: 1, on: 1, at: 1, by: 1,
    from: 1, into: 1, that: 1, this: 1, who: 1, what: 1, is: 1, are: 1, be: 1, it: 1, its: 1,
    their: 1, your: 1, you: 1, my: 1, i: 1, me: 1, we: 1, our: 1, as: 1, than: 1, before: 1,
    after: 1, every: 1, each: 1, one: 1, knack: 1, friendly: 1
  };
  // Plain section labels the slogan replaces (any UI language).
  var PLAIN_LABELS = /^(profile|profil|perfil|个人简介|executive profile|professional profile|summary|resumé|resume|profilo)$/i;

  // Trait labels and filler that turn a profile into a buzzword list.
  var BUZZ = [
    'results-driven', 'result-driven', 'results-oriented', 'detail-oriented', 'goal-oriented',
    'self-starter', 'self-motivated', 'highly motivated', 'motivated', 'dynamic', 'passionate',
    'proactive', 'innovative', 'hard-working', 'hardworking', 'team player', 'go-getter',
    'strong communicator', 'excellent communication', 'synergy', 'synergies', 'thought leader',
    'visionary', 'strategic thinker', 'out of the box', 'best-in-class', 'world-class',
    'track record', 'proven ability', 'skilled in', 'expertise in', 'people person',
    "people's person", 'can-do', 'enthusiastic', 'versatile', 'adaptable', 'reliable',
    'driven', 'seasoned', 'ninja', 'rockstar'
  ];
  // "From me to them" (course slide): self-focused motivation the profile must not use.
  var SELF_FOCUSED = /\b(i'?m|i am|i feel)\s+(so\s+|really\s+|very\s+)?(excited|thrilled|eager|passionate|motivated|drawn|keen)\b|\bi\s+(really\s+)?(enjoy|love|thrive|want to (develop|grow|learn)|would love|am looking for)\b|\b(excites|motivates|inspires|drives)\s+me\b|\bmy (dream|passion)\b/i;
  var FIRST_PERSON = /\b(i|i'm|i've|i'll|my|me)\b/i;
  var OPENS_PERSONAL = /^\s*(i\s+(am|'m|have|build|run|plan|make|take|work)\b|i'm\b|i've\b|as an?\s+[^,]{2,60},\s*i\b)/i;
  var VERBISH = /\b(am|is|are|was|were|been|have|has|had|will|would|can|could|do|does|did|make|makes|made|take|takes|took|keep|keeps|kept|bring|brings|brought|build|builds|built|run|runs|ran|plan|plans|lead|leads|ship|ships|turn|turns|put|puts|write|writes|wrote|cut|cuts|need|needs|face|faces|follow|follows|\w{3,}ed)\b/i;

  function clean(s) { return String(s == null ? '' : s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }
  function stem(w) {
    w = w.toLowerCase();
    if (w.length > 5 && /ing$/.test(w)) return w.slice(0, -3);
    if (w.length > 4 && /ies$/.test(w)) return w.slice(0, -3) + 'y';
    if (w.length > 4 && /(ed|es)$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && /s$/.test(w) && !/ss$/.test(w)) return w.slice(0, -1);
    return w;
  }
  function contentStems(s) {
    var out = [];
    String(s == null ? '' : s).toLowerCase().split(/[^\p{L}\p{N}]+/u).forEach(function (w) {
      if (!w || STOP[w] || w.length < 3) return;
      var st = stem(w);
      if (out.indexOf(st) < 0) out.push(st);
    });
    return out;
  }
  // Shared content words between the profile slogan and the cover-letter slogan.
  function sloganOverlap(a, b) {
    var A = contentStems(a), B = contentStems(b);
    return A.filter(function (x) { return B.indexOf(x) >= 0; });
  }
  function isPlainLabel(t) { return PLAIN_LABELS.test(clean(t)); }
  function sentences(text) {
    return clean(text).split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/).map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function buzzHits(text) {
    var t = ' ' + clean(text).toLowerCase() + ' ';
    return BUZZ.filter(function (b) {
      return new RegExp('[^a-z-]' + b.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '[^a-z-]').test(t);
    });
  }
  // A sentence that is mostly a run of short comma/slash/bullet items with no verb.
  function listSentences(text) {
    return sentences(text).filter(function (s) {
      var segs = s.replace(/[.!?]$/, '').split(/\s*[,;/•|·]\s*|\s+-\s+/).filter(Boolean);
      if (segs.length < 3) return false;
      var shortSegs = segs.filter(function (g) { return g.split(/\s+/).length <= 3; }).length;
      if (shortSegs < 3) return false;
      return !VERBISH.test(s) || shortSegs >= segs.length - 1 && segs[0].split(/\s+/).length <= 4;
    });
  }

  // Check one profile. opts: { slogan, clSlogan, company }
  // Returns [{ id, ok, msg }]; every rule always reports, so the UI can show a full checklist.
  function checkProfile(text, opts) {
    opts = opts || {};
    var t = clean(text);
    var sents = sentences(t);
    var res = [];
    function add(id, ok, msg) { res.push({ id: id, ok: !!ok, msg: msg }); }

    add('PROFILE-FIRST-PERSON-001', FIRST_PERSON.test(t), 'Written with "I"');
    add('PROFILE-OPEN-PERSONAL-001', !!sents[0] && OPENS_PERSONAL.test(sents[0]),
      'Opens personal: "I am a <role> who…"');
    var rest = sents.slice(1).join(' ');
    var co = clean(opts.company);
    var themRe = co ? new RegExp('\\byou(r)?\\b|' + co.split(/\s+/)[0].replace(/[^\p{L}\p{N}]/gu, '') , 'iu') : /\byou(r)?\b|\b[A-Z][\p{L}]+(?:'s)?\s+(team|cameras?|customers?|lab|products?|systems?)\b/u;
    add('PROFILE-ME-TO-THEM-001', sents.length > 1 && themRe.test(rest),
      'After the opening, turns to the company ("You / ' + (co || 'Company') + ' … As your <role> I will…")');
    add('PROFILE-NO-SELF-FOCUS-001', !SELF_FOCUSED.test(t), 'No "I\'m excited / I enjoy / drawn to"');
    var hits = buzzHits(t), lists = listSentences(t);
    add('PROFILE-NO-BUZZWORD-LIST-001', hits.length < 2 && lists.length === 0,
      hits.length >= 2 ? 'Buzzwords: ' + hits.join(', ')
        : lists.length ? 'Reads as a list: "' + lists[0].slice(0, 60) + '…"'
          : 'Sentences, not a buzzword list');

    var sl = clean(opts.slogan);
    if (opts.slogan !== undefined) {
      var words = sl ? sl.split(/\s+/).length : 0;
      add('PROFILE-SLOGAN-001', !!sl && !isPlainLabel(sl) && words >= 2 && words <= 9 && !/\.$/.test(sl),
        !sl || isPlainLabel(sl) ? 'Heading is the plain label, not a slogan' : 'Heading slogan, 2-9 words, no full stop');
      var ov = sloganOverlap(sl, opts.clSlogan);
      add('PROFILE-SLOGAN-DISTINCT-001', !sl || !clean(opts.clSlogan) || ov.length === 0,
        ov.length ? 'Repeats the cover-letter slogan: ' + ov.join(', ') : 'Differs from the cover-letter slogan');
    }
    return res;
  }

  return {
    version: '1.0.0',
    checkProfile: checkProfile,
    sloganOverlap: sloganOverlap,
    contentStems: contentStems,
    isPlainLabel: isPlainLabel,
    buzzHits: buzzHits,
    listSentences: listSentences,
    sentences: sentences
  };
});
