AntCV v1.40.294 — deployment increment
========================================

Overlays onto your existing deployment folder. NOT a from-scratch
standalone deploy — your ~89 other antcv-*.js sidecars stay in place.

What changed since v293
-----------------------

Three more bundle patches addressing translation gaps that the v293
deploy still showed in ZH mode:

  Gap 1: contact_line items not translated (Copenhagen, Denmark,
         EU Citizen all stayed English).
         Root cause: contact_line is type "labeled_list" but its items
         have shape {key, label, icon, value, hidden} — not the {l, v}
         shape my labeled_list branch handled. Removing it from the
         skip list in v292 wasn't enough; the extractor still had
         nothing to extract.
         Fix (Patch E): dedicated branch keyed on `e.id ===
         "contact_line"` that extracts `items[N].value` for each
         non-hidden item. Hidden items are honoured.

  Gap 2: section titles not translated (EDUCATION, PROFESSIONAL
         EXPERIENCE, PUBLICATIONS & PATENT, ADDITIONAL INFORMATION,
         NAME, CONTACT, APPLICATION — all stayed English in ZH mode).
         Root cause: `section.title` was never extracted by the
         translator. The renderer applies a static EN→DA dictionary
         to titles which covers DA but leaves ES/ZH untranslated.
         Fix (Patch F): outer loop now also pushes a `["title"]`
         entry for every section with a non-empty title, including
         spec_block (whose title is still visible even though its
         content is skipped). The same LLM pass that translates
         section content now also returns translated titles which
         the write-back applies to section.title.

  Gap 3: job titles next to organisation names kept English ("Rugby
         Operations Manager" preserved verbatim because the LLM read
         the surrounding "Pan Idræt (Copenhagen Wolves RFC)" as a
         proper-noun cluster). Same effect on the candidate's name:
         "Gabriel Alexander Karp-Gershon" preserved because the
         prompt said "Keep proper nouns unchanged" without
         distinguishing org names from person names.
         Fix (Patch G): the "Keep proper nouns unchanged" rule has
         been replaced with categorised handling:
           KEEP VERBATIM — company / organisation names (Innoviz,
             Sirin Labs, Pan Idræt, Copenhagen Wolves RFC), product
             names, university names, technology names, standards
             codes (ISO 26262, ASPICE, BABOK).
           TRANSLATE — job titles and role names, even when adjacent
             to an org name. Examples in prompt: "Operations Manager"
             → ES "Gerente de Operaciones" / ZH "运营经理"; "Senior
             System Engineer" → ES "Ingeniero Senior de Sistemas" /
             ZH "高级系统工程师".
           TRANSLATE — city and country names. Copenhagen →
             København (DA) / Copenhague (ES) / 哥本哈根 (ZH).
             Denmark → Danmark (DA) / Dinamarca (ES) / 丹麦 (ZH).
           TRANSLATE — civic terms like "EU Citizen". DA "EU-borger",
             ES "Ciudadano UE", ZH "欧盟公民".
           ES TARGET: keep person names in Latin script unchanged.
           ZH TARGET: TRANSLITERATE the candidate's person name to
             Chinese characters (e.g., "Gabriel Alexander Karp-
             Gershon" → "加布里埃尔·亚历山大·卡普-格申"). Apply only
             to values that are clearly full personal names; do NOT
             transliterate company / org names.

What is in this zip
-------------------

  index.html               (cache key bumped: app.js?v=1.40.294)
  app.js                   (patched bundle, 5 surgical edits — see below)
  antcv-language-ui-fixes-292.js   (unchanged from v292/293)
  antcv-app-history-zfix-291.js    (from earlier turn)
  antcv-kernel-completeness-290.js (from earlier turn)
  antcv-cloud-put-shrink-guard-289.js (from earlier turn)
  antcv-wizard-escape-hatch-285.js (you uploaded — included for
                                    reference resolution)
  README-v1.40.294.txt     (this file)

The bundle's five surgical edits, cumulative since unpatched:
  Patch A (v292) — extractor expansion: per-language scope, education
                   .sch, experience role title/company/years for ES/ZH,
                   meta name/company for ES/ZH, skip-list reshape.
  Patch B (v292) — CL closing line per-language.
  Patch C (v293) — publications <b>...</b> sentinel preservation
                   (extractor branch keyed on id="publications").
  Patch D (v294) — contact_line items .value extraction (keyed on id);
                   section.title extraction in outer loop;
                   prompt proper-noun rule replaced with categorised
                   handling (KEEP VERBATIM / TRANSLATE / TRANSLITERATE).
  Patch E (v293) — write-back substitutes sentinels back to <b>...</b>
                   markup before applying to section data.

Deploy steps
------------

  1. Back up your current Cloudflare Pages folder.
  2. Copy the 7 files (8 with README) from this zip into that folder,
     overwriting same-named files.
  3. Push the Cloudflare Pages deployment.
  4. Hard-refresh the SW cache via Settings → Hard Refresh, or open
     in an incognito window first to verify cache-bust by the
     ?v=1.40.294 query string.

Tests run before shipping
-------------------------

  All 5 bundle patches apply cleanly to the original /uploads/app.js.
  node --check on the patched bundle: OK.

  v294 extractor unit tests (4 tests, 14 assertions):
    - ZH target extracts: 6 section titles, name_block content,
      contact_line location + citizenship, labeled_list volunteer
      value, experience role title, education.sch.
    - Hidden contact items skipped.
    - DA target: name_block content skipped (correct narrow scope),
      experience role title skipped, but section titles + contact_line
      values still extracted (DA needs "EU Citizen" → "EU-borger").
    - spec_block: title extracted, content correctly skipped.
    - Empty/whitespace titles correctly skipped.

  v293 publications sentinel tests (8 tests, 18 assertions):
    - Single <b> + em-dash description: title verbatim, prose
      translated, no sentinel leak.
    - Multiple <b> runs: KEEP_1 / KEEP_2 numbered in position order.
    - <B> uppercase and <strong> variants detected.
    - Items with only <b>-wrapped content correctly skipped.
    - Non-publications list_italic (e.g., certifications) untouched
      by the publications branch.
    - <b class="..."> with attributes preserved.

  v292 sidecar tests (10 tests):
    - Chinese added to enabledLanguages; null list left alone.
    - Progress bar text corrected for ES/ZH; re-corrects on React
      re-render.
    - Kind regards override for ES/ZH.
    - EU Citizen override for DA/ES/ZH with whitespace tolerance.
    - Unrelated text untouched.
    - Idempotent: no infinite loop when already-correct text observed.

Per-language translation policy now in effect
---------------------------------------------

  Target = DA / EN:
    Translated:  text content, intro/bullets/closing prose, experience
                 role bullets, education degree + school description,
                 contact line items (city, country, EU Citizen tag,
                 etc.), publication descriptions (paper title
                 preserved via <b> sentinels), meta subtitle + role,
                 section.title (lookup falls back to LLM if not in
                 static EN→DA dictionary).
    Not translated: candidate person name (Latin name in Latin
                 script), company names, role titles, role years
                 (under DA the bundle's old narrower scope applies),
                 publication titles in <b>...</b>.

  Target = ES / ZH:
    Translated:  everything DA/EN gets, PLUS candidate name
                 (transliterated for ZH; kept Latin for ES), company
                 names (translated literally if generic, kept verbatim
                 if they're proper-noun org names), role titles,
                 role years ("2017 - Present" → "2017 - Presente" /
                 "2017 - 至今"), meta company, section.title.
    Not translated: brand / org / university / product / technology
                 names (LiDAR, Innoviz, Technion, Power BI, ISO 26262,
                 etc.); publication titles wrapped in <b>; sentinel
                 tokens.

Still unresolved (from your earlier message)
--------------------------------------------

  - Privacy LED popup auto-close: need antcv-privacy-led.js to
    investigate. Most likely the same dismiss-overlay pattern that
    Application History had (z-index war between dropdown and the
    click-outside-to-close overlay), but I won't ship a fix without
    seeing the code.
  - 9× forceRebuild storage:personalInfo loop during translation:
    need antcv-personality.js to trace the trigger chain. The v292-294
    bundle changes do not add new personalInfo writes during
    translation, so the loop is unchanged.

Version
-------

AntCV v1.40.294 (May 21, 2026)
