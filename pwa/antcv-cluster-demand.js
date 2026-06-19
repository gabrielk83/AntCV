/* antcv-cluster-demand.js — CLUSTER-QUAL-001 client demand signal (owner 2026-06-19)
 * ===========================================================================
 * The "20 most demanded skills" model. The full pipeline (JD extraction →
 * application_qualification → cluster_top_qualifications recompute → fit scoring →
 * generation visibility) lives in the proxy + D1 per docs/plan/CLUSTER-QUAL-001.md.
 * THIS file is the deterministic, client-side READ half: it embeds the analyst-
 * reviewed per-cluster top-20 qualifications (docs/analysis/cluster_top20_seed_2026-06.json,
 * the 16-JD sample → 3 of the 12 categories: pm_process / photonics_eng / research_phd)
 * and exposes a demand SCORE so the canonical-ordering layer can "keep the demanded
 * skill higher" — alongside the numeric-first rule.
 *
 * Use (read-only, never throws):
 *   window.AntcvClusterDemand.activeClusters()  -> ['pm_process', ...]
 *       JD present + classifiable -> that one cluster; else (unsolicited) -> all three.
 *   window.AntcvClusterDemand.score(text)       -> number >= 0
 *       higher = more demanded. Unsolicited SUMS across clusters, so a cross-cluster
 *       (shared / ABC) skill is pumped — the owner's "requested in top 2 in most
 *       job clusters" rule. A non-matching line scores 0.
 *
 * Wired as a SECONDARY ordering key (after the numeric tier), so it only reorders
 * within an equal-strength group — never demotes a quantified result below a duty.
 */
(function () {
  'use strict';
  var VERSION = '1.50.711';
  if (window.AntcvClusterDemand && window.AntcvClusterDemand.version === VERSION) return;

  // Embedded seed (verbatim ranks/share from the analyst-reviewed JSON). Keeping it
  // inline avoids a fetch of docs/ (not deployed with the PWA). When the D1 top-20
  // recompute ships, this becomes the cold-start fallback only.
  var SEED = {
    pm_process: { label: 'PM / Product / Process Management', top20: [
      [1, 'Project management methodology (PMP / Agile / lifecycle)', 'none'],
      [2, 'Stakeholder management & cross-functional coordination', 'ABC'],
      [3, 'Requirements management & translating needs into specs', 'AB'],
      [4, 'Risk identification, assessment & mitigation (risk register)', 'AB'],
      [5, 'Process design, modelling & documentation (BPM / BABOK / BPMN)', 'none'],
      [6, 'Process / continuous improvement (Lean / Six Sigma)', 'AB'],
      [7, 'Change & governance control', 'none'],
      [8, 'Project planning, time plans & milestone tracking', 'none'],
      [9, 'Product lifecycle management (concept to field)', 'none'],
      [10, 'Supplier / vendor collaboration & spec management', 'AB'],
      [11, 'ERP / CRM or system-implementation experience', 'none'],
      [12, 'Hardware product development (mechanics/electronics/RF)', 'AB'],
      [13, 'Design verification & validation vs specifications', 'AB'],
      [14, 'International product certification (CE / FCC / UL / EASA-145)', 'none'],
      [15, 'Audit / compliance & CAPA handling', 'none'],
      [16, 'Commercial & financial understanding', 'AB'],
      [17, 'Status communication to senior management / board', 'ABC'],
      [18, 'Matrix-organisation work with competing priorities', 'none'],
      [19, 'Obsolescence management & cost optimisation', 'AB'],
      [20, 'English fluency (Danish an advantage)', 'ABC']
    ] },
    photonics_eng: { label: 'Photonics / Optical / Test Engineering', top20: [
      [1, 'Optical / photonics systems engineering (free-space & fiber)', 'BC'],
      [2, 'Photonic integrated circuit (PIC) design / sim / tape-out', 'none'],
      [3, 'Device & sensor / EO characterization', 'BC'],
      [4, 'Optical measurement setups, calibration & instrumentation', 'BC'],
      [5, 'Laser systems (seed lasers, amplifiers, stabilization)', 'none'],
      [6, 'Semiconductor / silicon-photonics test programs', 'none'],
      [7, 'Test concept development, yield & test-time improvement', 'none'],
      [8, 'Foundry PDKs & simulation tools (e.g. COMSOL)', 'BC'],
      [9, 'Data acquisition, automation & analysis (Python)', 'BC'],
      [10, 'Quantum technology / QPU context awareness', 'BC'],
      [11, 'Patent & IP generation (Patent No. 241997)', 'AB'],
      [12, 'IP strategy, patent portfolio & licensing frameworks', 'none'],
      [13, 'Multivariate analysis / spectrometer technology', 'none'],
      [14, 'Requirements capture from customer applications', 'AB'],
      [15, 'Manufacturability & production scalability', 'AB'],
      [16, 'Technical leadership & mentoring engineers', 'ABC'],
      [17, 'Cross-disciplinary R&D collaboration', 'ABC'],
      [18, 'Supplier coordination & quality issues', 'AB'],
      [19, 'Medtech / healthtech / deep-tech domain exposure', 'none'],
      [20, 'English fluency; ~10% travel willingness', 'ABC']
    ] },
    research_phd: { label: 'PhD / Research positions', top20: [
      [1, 'Completed M.Sc. (physics / EE / engineering) eligibility', 'AC'],
      [2, 'Independent, structured research-project management', 'AC'],
      [3, 'Experimental design & lab work (optics / spectroscopy)', 'BC'],
      [4, 'Scientific computing (Python / MATLAB)', 'BC'],
      [5, 'Machine learning / chemometrics / data modelling', 'BC'],
      [6, 'Data acquisition, processing & visualisation (large sets)', 'BC'],
      [7, 'Hyperspectral / spectroscopic measurement techniques', 'BC'],
      [8, 'Peer-reviewed publication record (2 papers + poster)', 'none'],
      [9, 'Conference presentation & dissemination', 'ABC'],
      [10, 'Quantum optics / light-source characterization', 'BC'],
      [11, 'Innovation systems / STI policy & technology transfer', 'none'],
      [12, 'Interdisciplinary collaboration with external partners', 'ABC'],
      [13, 'Teaching / knowledge dissemination (2 TAU courses)', 'none'],
      [14, 'International mobility (China / external research stay)', 'none'],
      [15, 'Clear technical communication, clarity & precision', 'ABC'],
      [16, 'Reproducible documentation (LaTeX / Jupyter)', 'none'],
      [17, 'Curiosity, initiative & self-ownership of research', 'none'],
      [18, 'Domain expertise in a specified subfield (depth)', 'none'],
      [19, 'English fluency (+ language test if non-native)', 'ABC'],
      [20, 'Methodological rigour & critical analysis', 'BC']
    ] }
  };

  var SHARE_MULT = { ABC: 1.5, AB: 1.2, AC: 1.2, BC: 1.2, none: 1.0 };
  // generic words that carry no demand signal on their own
  var STOP = { with: 1, from: 1, into: 1, your: 1, that: 1, this: 1, they: 1, them: 1,
    their: 1, then: 1, than: 1, when: 1, where: 1, which: 1, work: 1, role: 1, also: 1,
    using: 1, used: 1, will: 1, must: 1, have: 1, more: 1, etc: 1, advantage: 1, e: 1 };

  function toks(s) {
    return (String(s == null ? '' : s).toLowerCase().match(/[a-zà-ÿ][a-zà-ÿ-]{2,}/g) || [])
      .filter(function (w) { return w.length >= 3 && !STOP[w]; });
  }

  // Precompute a keyword Set per qualification.
  var INDEX = {};
  Object.keys(SEED).forEach(function (cid) {
    INDEX[cid] = SEED[cid].top20.map(function (q) {
      return { r: q[0], q: q[1], share: q[2], kw: new Set(toks(q[1])) };
    });
  });

  function jdText() { try { return String(localStorage.getItem('antcv:lastJdText') || '').toLowerCase(); } catch (_) { return ''; } }

  // CLUSTER-QUAL-001 job-search targeting (owner 2026-06-19): WHERE (region) / WHICH
  // model (employed|consultant) / WHICH format (onsite|hybrid|remote), set in the
  // wizard + Personal/kernel settings (src/lib/job-search-prefs.ts), persisted under
  // personalInfo.jobSearchPrefs. These parameterize the demand top-20s: a future
  // keyed bucket (cluster × region × model × format), produced by the nightly
  // recruitment-site research, is preferred when present; until then scoring uses the
  // analyst seed and the prefs are simply exposed (so the nightly + pipeline can use
  // them, and contextKey() names the bucket to look up).
  function readPrefs() {
    try {
      var pi = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {};
      var jp = pi.jobSearchPrefs || {};
      return {
        regions: Array.isArray(jp.regions) ? jp.regions : [],
        employment: Array.isArray(jp.employment) ? jp.employment : [],
        formats: Array.isArray(jp.formats) ? jp.formats : []
      };
    } catch (_) { return { regions: [], employment: [], formats: [] }; }
  }
  // Stable bucket key for a cluster under the current targeting (sorted so it is
  // order-independent). The nightly writes keyed top-20s under keys of this shape.
  function contextKey(clusterId) {
    var p = readPrefs();
    var part = function (a) { return (a || []).slice().sort().join('+') || 'any'; };
    return clusterId + '|r=' + part(p.regions) + '|m=' + part(p.employment) + '|f=' + part(p.formats);
  }

  // Best-cluster classification from the JD: the cluster whose top-20 keywords the JD
  // text overlaps most. Returns null when there is no JD or no clear winner.
  function classifyJD() {
    var jd = jdText();
    if (jd.trim().length < 30) return null;
    var jt = new Set(toks(jd));
    if (!jt.size) return null;
    var best = null, bestScore = 0, second = 0;
    Object.keys(INDEX).forEach(function (cid) {
      var sc = 0;
      INDEX[cid].forEach(function (q) {
        var hit = 0; q.kw.forEach(function (w) { if (jt.has(w)) hit++; });
        if (hit) sc += hit * (21 - q.r) / 20;
      });
      if (sc > bestScore) { second = bestScore; bestScore = sc; best = cid; }
      else if (sc > second) { second = sc; }
    });
    // require a real signal and a margin over the runner-up, else treat as broad
    if (bestScore < 3 || bestScore < second * 1.25) return null;
    return best;
  }

  function activeClusters() {
    var c = classifyJD();
    return c ? [c] : Object.keys(SEED);
  }

  // Demand score of a text given the active clusters. For each active cluster, take the
  // best-matching qualification (>=2 shared keywords, or 1 keyword that is itself >=5
  // chars to avoid generic single-word hits), weight by rank (21-r) and share. Unsolicited
  // SUMS across clusters so a cross-cluster skill outscores a single-cluster one.
  function scoreFor(text, clusters) {
    var tt = new Set(toks(text));
    if (!tt.size) return 0;
    var total = 0;
    clusters.forEach(function (cid) {
      var best = 0;
      (INDEX[cid] || []).forEach(function (q) {
        var hit = 0, strong = false;
        q.kw.forEach(function (w) { if (tt.has(w)) { hit++; if (w.length >= 5) strong = true; } });
        if (hit >= 2 || (hit === 1 && strong)) {
          var d = (21 - q.r) * (SHARE_MULT[q.share] || 1);
          if (d > best) best = d;
        }
      });
      total += best;
    });
    return total;
  }

  var _cache = { key: '', clusters: null };
  function _active() {
    var c = activeClusters();
    var key = c.join(',');                 // memoize per JD so a long sort is cheap
    if (_cache.key !== key) { _cache.key = key; _cache.clusters = c; }
    return _cache.clusters;
  }
  function score(text) { try { return scoreFor(text, _active()); } catch (_) { return 0; } }

  // Normalized demand in ~[0,1] for blending with a [0,1] numeric term. The raw score
  // sums across active clusters, so divide by the active-cluster count × a per-cluster
  // reference (≈ a rank-5 'none' hit) — this makes a single-JD (1 cluster) and an
  // unsolicited (3 clusters) score on the SAME scale, so skill-relevance counts under
  // a JD too. A top-2 / cross-cluster skill saturates to 1.0.
  var PER_CLUSTER_REF = 18;
  function scoreNorm(text) {
    try {
      var c = _active();
      var raw = scoreFor(text, c);
      return Math.min(1, raw / (PER_CLUSTER_REF * Math.max(1, c.length)));
    } catch (_) { return 0; }
  }

  window.AntcvClusterDemand = {
    version: VERSION,
    clusters: SEED,
    activeClusters: activeClusters,
    classifyJD: classifyJD,
    score: score,
    scoreNorm: scoreNorm,
    prefs: readPrefs,
    contextKey: contextKey,
    _scoreFor: scoreFor
  };
  // a prefs change should drop the active-cluster memo so the next score() re-reads
  try { window.addEventListener('antcv:job-search-prefs-changed', function () { _cache.key = ''; }); } catch (_) {}
  try { console.debug('[cluster-demand] installed v' + VERSION + ' (' + Object.keys(SEED).length + ' clusters)'); } catch (_) {}
})();
