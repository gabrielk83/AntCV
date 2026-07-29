# Language, brand and the contamination family (2026-07-24)

Owner orders, in the order they arrived:
1. "when loading an application, it starts translating it from one language to
   other and starts translating applications in all open windows ... do not
   translate - load app from memory and force change of the language button
   without re-translating from llm."
2. "for all saved roles: decrease the specialization line to always be shorter,
   decrease the figure by 0.05in, make sure the font controls are available.
   also make sure slogans are sharp and good."
3. "which applications have no brand? they all should have brand and fit in both
   color and content to brand" / "if applications have brand why is it not
   applying the colors when moving to the relevant colors?"

Shipped: PWA `1.51.3742-load-no-retranslate`, `1.51.3743-spec-photo124`; relay
`auth-36-jd-cross-app-guard`; docx-worker `1.14.171-spec-photo`.

## 1. APP-LOAD-NO-RETRANSLATE-001 + TRANSLATE-TAB-ISOLATION-001

Three independent causes were stacking, which is why it looked random:

**(a) The load selector was Latin-blind.** It detected only WIDE scripts
(zh/he/am/ar); Latin content fell through to `jd_language`. A wrong or
contaminated `jd_language` therefore set a ribbon the content was NOT in, and
babel-relang "healed" the mismatch with a real LLM translate on every load.
Fix: NEW `__antcvContentLang` - the existing wide-script test plus POSITIVE
Latin identification (marker words + orthography scoring, a language wins only
when it clearly dominates). The app-switch and boot-restore sites now resolve
`contentScript || __antcvContentLang || jd_language`.

**(b) The language-bar preference filter force-flipped the ribbon.** Whenever
the active language was outside the preferred set it shoved the ribbon to the
preference's first language - right after an app load - and the healer followed
with a translate. Fix: the loaded app's own language wins over the preference
bar (`antcv:app-load-lang` stamp), and that automated dispatch is source-tagged
so it can never be mistaken for a user gesture.

**(c) The cross-tab gates were too weak.** They were visibility + a 180s lease.
Two side-by-side OS windows are BOTH "visible", and the lease expires mid-run,
so every open window joined the translate. Fix: the LLM path additionally
requires `document.hasFocus()` - exactly one window on a desktop has focus.

The governing rule now: **without a recent LOCAL user gesture (a language-bar
click, or a generation finishing), a ribbon/content mismatch SNAPS THE RIBBON to
the content language. The content never moves.** Loading an application is not a
gesture.

Tests: +6 in `pwa/antcv-babel-relang.contentscript.test.mjs` (snap-before-lease
ordering, focus gate, gesture tagging, both bundle sites stamped, ui-429
no-flip).

## 2. JD-CROSS-APP-GUARD-001 - the re-contamination writer

Found while auditing, not reported: **8 of 28 applications had been RE-poisoned
with the 3Shape jd_text**, hours after the night regen created them clean, and
the 07-23 batch had lost its stored slogans.

Root cause on the write path: a tab whose per-tab JD scope was stuck auto-POSTed
a foreign `jd_text` with the CURRENT app's company/role. That POST matched
DEDUP-BY-EMPLOYER-ROLE-001, and the dedupe UPDATE then overwrote the healthy
row's `jd_text` AND its `meta` (killing the slogan) on every app open.

Relay fix (`auth-36`):
- a dedupe update whose incoming `jd_text` (i) REPLACES a different non-empty
  jd_text and (ii) verbatim-equals ANOTHER of this user's applications is
  REFUSED outright; the row returns `ok:true, guarded:"jd_cross_app"` so no
  client retry storm. A genuine JD revision matches no other row, so legitimate
  re-pastes still update.
- `meta` is COALESCE'd on BOTH write legs, so a POST without meta can never null
  a stored slogan or brand record again.

Data healed from tracker-canonical JDs: 2736, 2738, 2741, 2742, 2743, 2744,
2748 (7/7), each with a fresh slogan generated from the CORRECT JD. Separately,
8 apps missing slogans entirely were backfilled with the V5 slogan prompt.

## 3. Spec line, figure, font controls

- **SPEC-SHORTER-001** and **CPH-PHOTO-124**: see
  `SESSION_LOG_2026-07-23_COPENHAGEN_STAGE4.md` (Owner follow-ups) - same
  change, documented with the rest of the Copenhagen work.
- **Font controls**: verified present and authoritative. An explicit "Font sizes
  (pt)" value overrides both new auto-fits (name width-match and spec shrink) on
  both surfaces.

## 4. Brand everywhere

**The colour complaint's real cause**: the client applies per-app colours from
`meta.brandV2` on load, and the 07-24 meta-clobber (above) had STRIPPED it. The
tracker doc had held the brand records the whole time. Backfilled `meta.brandV2`
(+ `brand_research`, `slogan_placement`) onto every app with a real brand - so
colours apply again the moment an app is loaded.

Re-researched real brands for KK Group (kkwindsolutions), Hamamatsu, Siemens,
Nordea AM, Aimpoint, and REPLACED Napatech's record, which had been researched
off the RECRUITER's site (iheadhunt.dk) rather than the employer.

Content-to-brand: the four machine-only apps were REGENERATED with brand fused
at generation - new rows 2763 Siemens, 2764 Napatech, 2765 Nordea, 2766 KK (each
15 CV + 9 CL sections, 3 role_view bullets, 1-page CL). Their superseded
duplicates were removed and the tracker artifacts repointed.

Neutral BY DESIGN, not a defect: DTU Wind and Lightera (no derivable brand
signal - honest neutral beats invented colour), Hays and CMC (hidden-employer
recruiter postings; branding the recruiter would be wrong).

Runner hardening - **BRAND-URL-RECRUITER-GUARD-001**: a posting URL whose host
shares no token with the employer name no longer drives brand research; the
employer's canonical site is resolved from the name instead. Worst case is no
brand (honest), never a wrong brand. This closes the recruiter-brand poisoning
path that hit Napatech twice.

## 5. Application 2734 - resolved

2734 was contaminated (3Shape jd_text, company flipped to "Terma", no slogan)
and was the owner's ACTIVE app, so it was left untouched until the owner said
"fix now". On inspection its CONTENT was Terma too - the KK Bionic content had
been overwritten entirely, so restoring KK metadata onto it would have produced
a mismatched app. Resolution: `kk_bionic` was REGENERATED fresh as app 2761
(Danish, correct busbar/power-conversion JD - "Bionic Solutions" is KK's team
name), tracker artifact repointed. 2748 was verified as the healthy canonical
Terma app; 2734 was left for the owner to compare and delete.
