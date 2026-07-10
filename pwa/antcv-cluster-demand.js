/* antcv-cluster-demand.js — CLUSTER-QUAL-001 client demand signal (owner 2026-06-19)
 * ===========================================================================
 * The "20 most demanded skills" model. The full pipeline (JD extraction →
 * application_qualification → cluster_top_qualifications recompute → fit scoring →
 * generation visibility) lives in the proxy + D1 per docs/plan/CLUSTER-QUAL-001.md.
 * THIS file is the deterministic, client-side READ half: it embeds per-cluster
 * top-20 qualifications and exposes a demand SCORE so the canonical-ordering layer
 * can "keep the demanded skill higher". Three clusters (pm_process / photonics_eng /
 * research_phd) are the analyst-reviewed 16-JD sample (docs/analysis/
 * cluster_top20_seed_2026-06.json); the other six (engineering_software /
 * data_analytics / consulting / executive / finance / people_soft) are stage-4
 * research-derived from current market postings, refreshed weekly per
 * docs/deployment/google-cse-setup.md (docs/analysis/
 * cluster_top20_research_2026-07-10.json, latest — supersedes the 2026-07-05
 * revision) — together the 9 clusters the 12 categories fold into. This is the
 * cold-start fallback; the live D1 path (antcv-cluster-demand-live.js) overtakes
 * it once real-JD data accumulates.
 * The demand score is wired alongside the numeric-first rule as a secondary key.
 *
 * Use (read-only, never throws):
 *   window.AntcvClusterDemand.activeClusters()  -> ['pm_process', ...]
 *       JD present + classifiable -> that one cluster; else (unsolicited) -> ALL 9
 *       clusters, so an open CV is weighted by whole-market demand.
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
  var VERSION = '1.51.246';
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
      [11, 'Patent & IP generation (invention disclosures, patent filings)', 'AB'],
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
      [8, 'Peer-reviewed publication record', 'none'],
      [9, 'Conference presentation & dissemination', 'ABC'],
      [10, 'Quantum optics / light-source characterization', 'BC'],
      [11, 'Innovation systems / STI policy & technology transfer', 'none'],
      [12, 'Interdisciplinary collaboration with external partners', 'ABC'],
      [13, 'Teaching / knowledge dissemination', 'none'],
      [14, 'International research mobility / collaboration', 'none'],
      [15, 'Clear technical communication, clarity & precision', 'ABC'],
      [16, 'Reproducible documentation (LaTeX / Jupyter)', 'none'],
      [17, 'Curiosity, initiative & self-ownership of research', 'none'],
      [18, 'Domain expertise in a specified subfield (depth)', 'none'],
      [19, 'English fluency (+ language test if non-native)', 'ABC'],
      [20, 'Methodological rigour & critical analysis', 'BC']
    ] },
    // ── CLUSTER-QUAL-001 stage 4 (spec 7.6, owner 2026-07-05): the 6 remaining
    // clusters, research-derived from current (2025-2026) market postings +
    // skills reports (Robert Half, LinkedIn, Coursera, CFI, AIHR, Pluralsight,
    // BLS et al.; sources in docs/analysis/cluster_top20_research_2026-07.json).
    // These extend the COLD-START classifier/weighting to all 9 clusters so a
    // targeted JD in software / data / consulting / executive / finance / HR
    // gets real demand weighting from the seed before the user accumulates
    // enough real-JD D1 data for the live path (antcv-cluster-demand-live.js).
    // The share flag is a demand-UNIVERSALITY tier here (not the 3-cluster A/B/C
    // membership of the original seed): 'ABC' = universal transferable skill,
    // 'AB' = shared across adjacent clusters, 'none' = cluster-specific. Both map
    // onto the same SHARE_MULT tiers, so no scoring-code change is needed.
    engineering_software: { label: 'Software Engineering', top20: [
      [1, 'Proficiency in a core language (Python / Java / Go / TypeScript)', 'none'],
      [2, 'AI-assisted & agentic coding tools (Copilot / Cursor / Claude Code) and LLM/prompt integration', 'ABC'],
      [3, 'System design & scalable architecture', 'none'],
      [4, 'Cloud platforms & deployment (AWS / GCP / Azure)', 'none'],
      [5, 'CI/CD pipelines & automated testing', 'none'],
      [6, 'Data structures, algorithms & problem-solving', 'none'],
      [7, 'Version control & collaborative workflows (Git)', 'AB'],
      [8, 'Containerisation & orchestration (Docker / Kubernetes)', 'none'],
      [9, 'API design & microservices (REST / gRPC)', 'none'],
      [10, 'Databases & data modelling (SQL & NoSQL)', 'AB'],
      [11, 'Secure coding & application security (NIS2 compliance)', 'none'],
      [12, 'Infrastructure as code & platform engineering (Terraform / developer portals)', 'none'],
      [13, 'Agile / Scrum delivery & iteration', 'AB'],
      [14, 'Frontend frameworks (React / TypeScript)', 'none'],
      [15, 'Observability, monitoring & debugging', 'none'],
      [16, 'Evaluating & reviewing AI-generated code / agent output', 'AB'],
      [17, 'Code review & mentoring engineers', 'AB'],
      [18, 'Performance optimisation & profiling', 'none'],
      [19, 'Cross-functional collaboration & clear technical communication (product, design, docs)', 'ABC'],
      [20, 'English fluency (Danish an advantage)', 'ABC']
    ] },
    data_analytics: { label: 'Data & Analytics', top20: [
      [1, 'SQL & data querying', 'AB'],
      [2, 'Python / R for analysis', 'none'],
      [3, 'Data visualisation & BI (Power BI / Tableau / Looker)', 'none'],
      [4, 'Statistics & probability (hypothesis testing)', 'none'],
      [5, 'Data cleaning, wrangling & quality', 'none'],
      [6, 'AI/agentic tools & prompt engineering for analytics workflows', 'ABC'],
      [7, 'Machine learning & predictive modelling', 'none'],
      [8, 'Excel / spreadsheet modelling', 'AB'],
      [9, 'Data pipelines & warehousing (dbt / Snowflake / Spark)', 'none'],
      [10, 'Business acumen & translating data to decisions', 'ABC'],
      [11, 'Experiment design & A/B testing', 'none'],
      [12, 'Cloud data platforms (BigQuery / Databricks / Azure)', 'none'],
      [13, 'Dashboard & KPI reporting', 'none'],
      [14, 'Data storytelling & stakeholder communication', 'ABC'],
      [15, 'ETL / data engineering fundamentals', 'none'],
      [16, 'Domain / industry knowledge', 'AB'],
      [17, 'Version control & reproducible analysis (Git)', 'none'],
      [18, 'Data governance, privacy & ethics', 'none'],
      [19, 'Critical thinking & problem-solving', 'ABC'],
      [20, 'English fluency (Danish an advantage)', 'ABC']
    ] },
    consulting: { label: 'Consulting', top20: [
      [1, 'Structured problem-solving (hypothesis-driven, 80/20)', 'none'],
      [2, 'Quantitative & financial analysis / modelling', 'AB'],
      [3, 'Client relationship & stakeholder management', 'ABC'],
      [4, 'Executive communication & storytelling (slides)', 'none'],
      [5, 'AI-augmented delivery & GenAI tool fluency (prompt engineering)', 'ABC'],
      [6, 'Data analysis & synthesis (Excel)', 'AB'],
      [7, 'Project / workstream management', 'ABC'],
      [8, 'Business & commercial judgement', 'ABC'],
      [9, 'Presentation & facilitation skills', 'none'],
      [10, 'Industry / domain expertise', 'AB'],
      [11, 'Adaptability & fast learning', 'none'],
      [12, 'Analytical rigour & attention to detail', 'AB'],
      [13, 'Market research & competitive analysis', 'none'],
      [14, 'Change management & implementation', 'AB'],
      [15, 'ESG & sustainability advisory (CSRD)', 'AB'],
      [16, 'Teamwork & collaboration under pressure', 'ABC'],
      [17, 'Strategic thinking & framing', 'AB'],
      [18, 'Data visualisation & dashboards (Power BI / Tableau)', 'none'],
      [19, 'Relationship building & trust', 'ABC'],
      [20, 'English fluency (Danish an advantage)', 'ABC']
    ] },
    executive: { label: 'Executive / Senior Leadership', top20: [
      [1, 'Strategic vision & execution', 'none'],
      [2, 'P&L ownership & financial stewardship', 'AB'],
      [3, 'Building & leading high-performing teams', 'ABC'],
      [4, 'AI & digital strategy fluency', 'ABC'],
      [5, 'Stakeholder, board & investor communication', 'ABC'],
      [6, 'Organisational change & transformation leadership', 'AB'],
      [7, 'Commercial growth & revenue architecture', 'AB'],
      [8, 'Operational excellence & execution', 'none'],
      [9, 'Financial acumen (EBITDA, balance sheet, ROI)', 'AB'],
      [10, 'Judgment & decision-making under ambiguity', 'none'],
      [11, 'Emotional intelligence & people leadership', 'ABC'],
      [12, 'Cross-functional & enterprise-wide alignment', 'ABC'],
      [13, 'Governance, risk, ESG & CSRD compliance oversight', 'AB'],
      [14, 'Coaching, culture & talent development', 'none'],
      [15, 'Negotiation & partnership building', 'AB'],
      [16, 'Vision communication & influence', 'ABC'],
      [17, 'Market & competitive strategy', 'AB'],
      [18, 'Resilience, adaptability & learning agility', 'none'],
      [19, 'Global / multi-market & cross-cultural leadership', 'none'],
      [20, 'English fluency (Danish an advantage)', 'ABC']
    ] },
    finance: { label: 'Finance', top20: [
      [1, 'Financial modelling & forecasting (FP&A)', 'AB'],
      [2, 'Financial reporting & month-end close', 'none'],
      [3, 'Advanced Excel & spreadsheet analysis', 'AB'],
      [4, 'Data analysis & SQL fundamentals', 'AB'],
      [5, 'AI & automation in finance', 'ABC'],
      [6, 'BI & data visualisation (Power BI / Tableau)', 'AB'],
      [7, 'ERP & finance systems (SAP / Oracle / NetSuite)', 'AB'],
      [8, 'Accounting standards (IFRS / GAAP)', 'none'],
      [9, 'Budgeting, planning & variance analysis', 'none'],
      [10, 'Business partnering & stakeholder communication', 'ABC'],
      [11, 'Scenario modelling & sensitivity analysis', 'none'],
      [12, 'Regulatory, ESG & sustainability reporting (CSRD)', 'AB'],
      [13, 'Internal controls, audit & compliance (SOX)', 'AB'],
      [14, 'Commercial & business acumen', 'ABC'],
      [15, 'Cash flow & working-capital management', 'none'],
      [16, 'Cost analysis & profitability management', 'none'],
      [17, 'Professional qualification (CPA / ACCA / CFA / CIMA)', 'none'],
      [18, 'Attention to detail & accuracy', 'none'],
      [19, 'Cross-functional collaboration', 'ABC'],
      [20, 'English fluency (Danish an advantage)', 'ABC']
    ] },
    people_soft: { label: 'People / HR', top20: [
      [1, 'HR business partnering & stakeholder advisory', 'ABC'],
      [2, 'Employee relations & labour-law compliance', 'none'],
      [3, 'Talent acquisition & full-cycle recruiting', 'none'],
      [4, 'AI literacy & AI-fluency in HR / recruiting automation', 'ABC'],
      [5, 'People analytics & data-driven HR', 'AB'],
      [6, 'HRIS & people systems (Workday / SuccessFactors / Oracle)', 'AB'],
      [7, 'Business acumen & commercial understanding', 'ABC'],
      [8, 'Critical thinking, complex problem-solving & judgment', 'ABC'],
      [9, 'Coaching, influencing & emotional intelligence', 'ABC'],
      [10, 'Change management & organisational development', 'AB'],
      [11, 'Cross-functional stakeholder management & collaboration', 'ABC'],
      [12, 'Performance management & development', 'none'],
      [13, 'Learning & development (L&D), incl. AI-enabled learning', 'none'],
      [14, 'Compensation, benefits & total rewards', 'none'],
      [15, 'Culture, employee experience & belonging', 'none'],
      [16, 'Skills-based workforce & succession planning', 'none'],
      [17, 'Employer branding & candidate experience', 'none'],
      [18, 'Diversity, equity, inclusion & belonging', 'none'],
      [19, 'HR policy & governance', 'none'],
      [20, 'English fluency (Danish an advantage)', 'ABC']
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

  // Untargeted (unsolicited / unclassified) -> ALL clusters (owner 2026-07-05).
  // A general/open CV isn't aimed at one cluster, so its demand weighting should
  // reflect the WHOLE market: a skill demanded across many of the 9 career
  // clusters (communication, stakeholder management, AI literacy, data) is what a
  // general CV should foreground. scoreNorm divides by the active-cluster count so
  // the score stays on a [0,1] scale regardless of how many clusters are active —
  // a broadly-transferable skill still saturates toward 1, a single-cluster niche
  // skill scores low (correct for an untargeted CV). Note this DOES down-weight a
  // deeply niche single-cluster skill relative to the old 3-cluster default; that
  // is the intended "weight what the broad market demands" behaviour for an
  // unsolicited application.
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
