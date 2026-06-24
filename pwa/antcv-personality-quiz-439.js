/* AntCV personality-kernel quiz (v1.50.439)
 * ============================================================================
 * PERSONALITY-KERNEL-001 quiz (owner 2026-06-13). The personality KERNEL itself
 * already ships (Round 38 / 1.50.403): GABRIEL_BG injects personalInfo.personality
 * into generation as behaviour-evidence, the canonical work-style line, and the
 * render constraints. What was missing is the QUIZ that BUILDS a kernel for a
 * brand-new user (not Gabriel) from a few questions, and gives the user a written
 * response about their kernel.
 *
 * Deterministic (no LLM): 8 forced-choice questions tally the six trait clusters
 * (calm / analytical / clear-communicator / professional-pride / moral-empathic /
 * people-oriented). The top traits become personalInfo.personality — the same
 * shape the writer kernel uses (traits with GENERIC, domain-neutral evidence
 * phrasings, an assembled work-style line, the usage rule + render constraints) —
 * so generation renders them as behaviour, never raw adjectives. The user then
 * sees a friendly summary of their kernel.
 *
 * Entry points: a "PERSONALITY KERNEL" collapsible in Settings → Personal (under
 * the Languages card) AND window.AntcvPersonalityQuiz.open() so the wizard slide
 * can launch it. No fetch wrap.
 */
(function () {
  'use strict';
  var VERSION = '1.50.853-personality-results';
  if (window.__antcvPersonalityQuiz439 === VERSION) return;
  window.__antcvPersonalityQuiz439 = VERSION;

  var MODAL_ID = 'antcv-personality-quiz-modal';
  var CARD_ID = 'antcv-personality-kernel-card';

  // The six trait clusters with GENERIC (domain-neutral) evidence + a work-style
  // fragment. Mirrors gabriel-kernel-personality-v1.json's structure, but the
  // phrasings work for any candidate.
  var TRAITS = {
    calm: {
      label: 'Calm under pressure',
      ws: 'calm',
      evidence: ['Keeps decisions steady when timelines tighten', 'Stays the calm point of contact when requests stack up', 'Handles escalations without raising the temperature'],
    },
    analytical: {
      label: 'Analytical & structured',
      ws: 'structured decisions from measured data',
      evidence: ['Works from clear criteria before committing', 'Builds the framework before the decision', 'Maps the downstream impact before acting'],
    },
    communicator: {
      label: 'Clear communicator & action-taker',
      ws: 'clear written outcomes',
      evidence: ['Turns complex detail into a scope others can act on', 'Writes short decisions with owners and dates', 'Moves from analysis to commitment without circling'],
    },
    pride: {
      label: 'Professional pride',
      ws: 'a high standard of finish',
      evidence: ['Holds the work to a high standard whether or not anyone checks', 'Finishes the documentation before handover', 'Owns the result, including the unglamorous fixes'],
    },
    moral: {
      label: 'Fair & principled',
      ws: 'fair, principled judgement',
      evidence: ['Gives credit where the work happened', 'Raises problems early and to the right person', 'Fair in team and supplier dealings'],
    },
    people: {
      label: 'People-oriented & relationship builder',
      ws: 'works through relationships',
      evidence: ['Builds working relationships across teams and functions', 'Adapts the message to the listener', 'First to help unblock a colleague'],
    },
  };

  var QUESTIONS = [
    ['A tough call lands on your desk. You first…', [
      ['Map the trade-offs and downstream impact', 'analytical'],
      ['Get the right people in the room', 'people'],
      ['Make the call and move', 'communicator'],
      ['Stay calm and work it methodically', 'calm'],
    ]],
    ['Under a tight deadline, colleagues would say you…', [
      ['Keep everyone steady', 'calm'],
      ['Drive to a decision', 'communicator'],
      ['Hold the quality bar', 'pride'],
      ['Keep people informed and supported', 'people'],
    ]],
    ['What you are most proud of in your work is…', [
      ['The standard of finish', 'pride'],
      ['The relationships you built', 'people'],
      ['The clarity of your decisions', 'communicator'],
      ['The fairness you brought', 'moral'],
    ]],
    ['When you disagree with a decision, you…', [
      ['Lay out the analysis', 'analytical'],
      ['Raise it early, to the right person', 'moral'],
      ['State your view plainly and move on', 'communicator'],
      ['Look for the common ground', 'people'],
    ]],
    ['Your default with a new team is to…', [
      ['Build trust and relationships', 'people'],
      ['Set up the structure and criteria', 'analytical'],
      ['Stay calm and observe first', 'calm'],
      ['Lead by the standard of your work', 'pride'],
    ]],
    ['When a project succeeds, you…', [
      ['Give credit where the work happened', 'moral'],
      ['Point to the team', 'people'],
      ['Note the decisions that got it there', 'communicator'],
      ['Let the quality speak', 'pride'],
    ]],
    ['Pressure makes you…', [
      ['Steadier', 'calm'],
      ['More structured', 'analytical'],
      ['More decisive', 'communicator'],
    ]],
    ['People come to you for…', [
      ['A calm read of the situation', 'calm'],
      ['A clear next step', 'communicator'],
      ['A fair hearing', 'moral'],
      ['Help getting unblocked', 'people'],
    ]],
  ];

  function readPI() { try { return JSON.parse(localStorage.getItem('personalInfo') || '{}') || {}; } catch (_) { return {}; } }

  function rankTraits(answers) {
    var score = {};
    Object.keys(TRAITS).forEach(function (k) { score[k] = 0; });
    answers.forEach(function (tid) { if (tid && score[tid] != null) score[tid] += 1; });
    return Object.keys(TRAITS).sort(function (a, b) { return score[b] - score[a]; })
      .map(function (k) { return { id: k, score: score[k] }; });
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // Build personalInfo.personality (kernel shape) from the ranked traits.
  function buildKernel(ranked) {
    var present = ranked.filter(function (r) { return r.score > 0; });
    if (!present.length) present = ranked.slice(0, 3); // fallback: top 3
    var top = present.slice(0, 4);
    var wsParts = top.map(function (r) { return TRAITS[r.id].ws; });
    // Assemble the work-style line: "Calm, structured decisions…; clear …; works …".
    var wsLine = cap(wsParts.join('; ')).replace(/^Calm;/, 'Calm,') + '.';
    var traitObjs = present.map(function (r) {
      return { id: r.id, label: TRAITS[r.id].label, evidence_phrasings: TRAITS[r.id].evidence.slice(0, 3) };
    });
    return {
      kernel_extension: 'personality',
      version: '1.1.0-quiz',
      source: 'antcv-personality-quiz',
      usage_rule: "Traits feed PHRASING and EVIDENCE selection. Never render trait labels as a raw adjective list — show each trait through a concrete behaviour or outcome. Respect all banned-word/phrase lists.",
      traits: traitObjs,
      work_style_line: { en: wsLine },
      render_constraints: {
        max_personality_sentences_in_profile: 1,
        never_render_raw: ["people's person", 'team player', 'empathy', 'passionate', 'proactive', 'dynamic'],
        banned_lists_apply: true,
        rule: 'One personality-bearing sentence in Profile maximum; the rest carried by the work-style line and cover-letter Who I Am. Behaviour over adjectives.',
      },
    };
  }

  function saveKernel(kernel) {
    try {
      var pi = readPI();
      pi.personality = kernel;
      localStorage.setItem('personalInfo', JSON.stringify(pi));
      window.dispatchEvent(new CustomEvent('antcv:personality-kernel-saved', { detail: { source: 'quiz' } }));
      // nudge cloud-sync / restore listeners (personalInfo changed)
      try { window.dispatchEvent(new StorageEvent('storage', { key: 'personalInfo', newValue: JSON.stringify(pi) })); } catch (_) {}
    } catch (_) {}
  }

  function el(tag, css, text) { var n = document.createElement(tag); if (css) n.style.cssText = css; if (text != null) n.textContent = text; return n; }

  function closeModal() { var m = document.getElementById(MODAL_ID); if (m) m.remove(); }

  function open() {
    closeModal();
    var backdrop = el('div', 'position:fixed;inset:0;z-index:2147483600;background:rgba(8,17,38,0.8);display:flex;align-items:center;justify-content:center;padding:18px;font-family:Calibri,Arial,sans-serif;');
    backdrop.id = MODAL_ID;
    var panel = el('div', 'background:#1b2945;color:#fff;border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,0.5);padding:20px 22px 16px;max-width:540px;width:100%;max-height:88vh;overflow:auto;border:1px solid rgba(1,183,187,0.4);');
    backdrop.appendChild(panel);

    var heading = el('div', 'font-size:17px;font-weight:800;color:#01B7BB;letter-spacing:.5px;margin-bottom:4px;', 'Build your personality kernel');
    panel.appendChild(heading);
    panel.appendChild(el('div', 'font-size:12.5px;color:rgba(255,255,255,0.72);line-height:1.5;margin-bottom:14px;', '8 quick questions. Your answers shape how AntCV writes your CV — through concrete behaviour, never adjective lists. You can retake this any time.'));

    var answers = new Array(QUESTIONS.length).fill(null);
    var qWrap = el('div', '');
    panel.appendChild(qWrap);

    QUESTIONS.forEach(function (q, qi) {
      var block = el('div', 'margin:0 0 14px;');
      block.appendChild(el('div', 'font-size:13px;font-weight:700;margin-bottom:7px;', (qi + 1) + '. ' + q[0]));
      q[1].forEach(function (opt) {
        var b = el('button', 'display:block;width:100%;text-align:left;padding:8px 11px;margin:0 0 6px;border-radius:8px;border:1px solid rgba(255,255,255,0.16);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.9);cursor:pointer;font-size:12.5px;font-family:inherit;', opt[0]);
        b.type = 'button';
        b.setAttribute('data-q', String(qi));
        b.setAttribute('data-trait', opt[1]);
        b.onclick = function () {
          answers[qi] = opt[1];
          block.querySelectorAll('button').forEach(function (x) {
            var on = x === b;
            x.style.background = on ? 'rgba(1,183,187,0.14)' : 'rgba(255,255,255,0.04)';
            x.style.border = '1px solid ' + (on ? '#01B7BB' : 'rgba(255,255,255,0.16)');
            x.style.color = on ? '#fff' : 'rgba(255,255,255,0.9)';
          });
          updateState();
        };
        block.appendChild(b);
      });
      qWrap.appendChild(block);
    });

    var result = el('div', 'display:none;margin-top:6px;');
    panel.appendChild(result);

    var row = el('div', 'display:flex;gap:8px;justify-content:space-between;align-items:center;margin-top:8px;');
    var status = el('div', 'flex:1;font-size:11px;color:rgba(255,255,255,0.55);');
    var cancel = el('button', 'padding:9px 13px;border-radius:8px;border:1px solid rgba(255,255,255,0.22);background:transparent;color:rgba(255,255,255,0.85);cursor:pointer;font-size:12.5px;font-weight:700;', 'Close');
    cancel.type = 'button'; cancel.onclick = closeModal;
    var finish = el('button', 'padding:10px 16px;border-radius:8px;border:0;background:#01B7BB;color:#06243a;cursor:pointer;font-size:13px;font-weight:800;', 'See my kernel →');
    finish.type = 'button';
    finish.setAttribute('data-antcv-quiz-finish', '1');
    row.appendChild(status); row.appendChild(cancel); row.appendChild(finish);
    panel.appendChild(row);

    function answered() { return answers.filter(Boolean).length; }
    function updateState() {
      var n = answered();
      status.textContent = n + ' / ' + QUESTIONS.length + ' answered';
      finish.disabled = n < 4;
      finish.style.opacity = n < 4 ? '0.5' : '1';
    }
    updateState();

    finish.onclick = function () {
      if (answered() < 4) { status.textContent = 'Answer at least 4 to build a kernel.'; return; }
      var ranked = rankTraits(answers);
      var kernel = buildKernel(ranked);
      saveKernel(kernel);
      showResult(kernel, ranked);
    };

    function showResult(kernel, ranked) {
      result.style.display = 'block';
      result.innerHTML = '';
      result.setAttribute('data-antcv-quiz-result', '1');
      result.appendChild(el('div', 'font-size:10px;font-weight:800;letter-spacing:.4px;color:#01B7BB;margin:10px 0 6px;', 'YOUR KERNEL'));
      var box = el('div', 'background:rgba(1,183,187,0.08);border:1px solid rgba(1,183,187,0.35);border-radius:9px;padding:11px 12px;');
      var top = ranked.filter(function (r) { return r.score > 0; }).slice(0, 3).map(function (r) { return TRAITS[r.id].label; });
      box.appendChild(el('div', 'font-size:12.5px;line-height:1.5;margin-bottom:7px;',
        'Work style: ' + (kernel.work_style_line.en || '')));
      box.appendChild(el('div', 'font-size:12px;color:rgba(255,255,255,0.82);line-height:1.5;margin-bottom:7px;',
        'You lead with ' + top.join(', ') + '.'));
      var ex = (kernel.traits[0] && kernel.traits[0].evidence_phrasings[0]) || '';
      box.appendChild(el('div', 'font-size:11.5px;color:rgba(255,255,255,0.62);line-height:1.5;font-style:italic;',
        'In your CV this shows as behaviour, not adjectives — e.g. “' + ex + '.”'));
      result.appendChild(box);
      result.appendChild(el('div', 'font-size:11px;color:#01B7BB;font-weight:700;margin-top:8px;', '✓ Saved to your profile — generation will use it.'));
      finish.textContent = 'Done';
      finish.onclick = closeModal;
      try { result.scrollIntoView({ behavior: 'smooth', block: 'end' }); } catch (_) {}
    }

    (document.body || document.documentElement).appendChild(backdrop);
  }

  // PERSONAL-MERGE-5 (owner 2026-06-24): the standalone languages anchor was
  // retired (LanguageCard is embedded in the writing-style island), so the old
  // anchor made this card vanish. Anchor on the writing-style-picker column (the
  // Personal flex column), falling back to the legacy anchor for safety.
  function findPersonalCol() {
    var a = document.getElementById('antcv-react-writing-style-picker')
      || document.querySelector('[data-antcv-react-mount="writing-style-picker"]')
      || document.getElementById('antcv-react-personal-languages');
    if (!a) return null;
    var n = a;
    for (var i = 0; i < 8 && n && n.parentElement; i++) {
      try { var cs = getComputedStyle(n.parentElement); if (cs.display === 'flex' && /column/.test(cs.flexDirection)) return n.parentElement; } catch (_) {}
      n = n.parentElement;
    }
    return a.parentElement || null;
  }

  // ─── Settings → Personal entry (collapsible; shows the kernel result) ──────
  function injectCard() {
    var col = findPersonalCol();
    if (!col) { var ex0 = document.getElementById(CARD_ID); if (ex0) ex0.remove(); return; }
    var existing = document.getElementById(CARD_ID);
    if (existing) { if (existing.parentElement !== col) existing.remove(); else return; }
    // PERSONAL-CARDS-VERTICAL-001 (owner 2026-06-13): full-width so it stacks
    // vertically (never beside the other controls); order 45 places it after
    // Banned Words (40), i.e. last before the Done button; margin-bottom is the
    // BREAK the owner asked for so it never sits horizontally next to Done.
    var box = el('details', 'order:45;margin:6px 0 16px;padding:0;width:100%;flex:0 0 100%;box-sizing:border-box;border:1px solid rgba(1,183,187,0.35);border-radius:8px;font-size:12px;color:#cfe9ea;');
    box.id = CARD_ID;
    var sum = el('summary', 'cursor:pointer;user-select:none;font-size:10px;font-weight:700;letter-spacing:0.8px;color:#01B7BB;padding:9px 12px;list-style:none;text-transform:uppercase;', 'Personality kernel');
    box.appendChild(sum);
    var body = el('div', 'padding:2px 12px 11px;');
    var pi = readPI();
    var has = pi && pi.personality && pi.personality.traits && pi.personality.traits.length;
    body.appendChild(el('div', 'font-size:11px;color:rgba(255,255,255,0.55);line-height:1.45;margin-bottom:8px;',
      has ? 'Your kernel is set — generation writes your traits as behaviour, not adjectives. Retake to update it.'
          : 'An 8-question quiz that teaches AntCV how to write you — as concrete behaviour, never adjective lists.'));
    // Results readout: the ranked trait labels + the work-style line the kernel produced.
    if (has) {
      var rwrap = el('div', 'margin:0 0 9px;');
      var chips = el('div', 'display:flex;flex-wrap:wrap;gap:4px;margin:0 0 6px;');
      (pi.personality.traits || []).forEach(function (tr) {
        var lbl = (tr && (tr.label || tr.id)) || '';
        if (lbl) chips.appendChild(el('span', 'font-size:11px;padding:2px 8px;border-radius:11px;background:rgba(1,183,187,0.16);color:#bdf0f1;', String(lbl)));
      });
      if (chips.childNodes.length) rwrap.appendChild(chips);
      var wsl = pi.personality.work_style_line;
      wsl = wsl && (wsl.en || (typeof wsl === 'string' ? wsl : ''));
      if (wsl) rwrap.appendChild(el('div', 'font-size:11px;opacity:.75;line-height:1.45;font-style:italic;', String(wsl)));
      if (rwrap.childNodes.length) body.appendChild(rwrap);
    }
    var btn = el('button', 'padding:7px 13px;border-radius:7px;border:0;background:#01B7BB;color:#06243a;cursor:pointer;font-size:12px;font-weight:800;', has ? 'Retake the quiz' : 'Take the quiz');
    btn.type = 'button';
    btn.setAttribute('data-antcv-personality-quiz-open', '1');
    btn.onclick = open;
    body.appendChild(btn);
    box.appendChild(body);
    col.appendChild(box);
  }

  var pending = false;
  function schedule() { if (pending) return; pending = true; requestAnimationFrame(function () { pending = false; try { injectCard(); } catch (_) {} }); }
  function boot() {
    schedule();
    [200, 700, 1800, 3500].forEach(function (ms) { setTimeout(schedule, ms); });
    try { new MutationObserver(schedule).observe(document.body || document.documentElement, { childList: true, subtree: true }); } catch (_) {}
    // let the wizard slide (or anything) open it
    window.addEventListener('antcv:open-personality-quiz', open);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.AntcvPersonalityQuiz = { version: VERSION, open: open, _buildKernel: buildKernel, _rankTraits: rankTraits, _traits: TRAITS, _questions: QUESTIONS };
  try { console.debug('[personality-quiz-439] installed v' + VERSION); } catch (_) {}
})();
