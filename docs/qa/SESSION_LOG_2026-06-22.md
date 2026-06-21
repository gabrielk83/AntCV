# Session work log — 2026-06-22 (1.50.768 → 788)

A long single session. Shipped fixes (all live on `main`, PWA auto-deploys). The recurring blocker was
the **stale service worker** masking unloaded app.js — see [[stale-sw-version-mask-hazard]]; force-fresh
with `unregister SWs + caches.delete all + reload`.

## Shipped
- **768–770** Publications: repopulate from `personalInfo.publicationsStructured` when placeholder;
  patent dedup (structured vs top-level); self-healing re-run passes.
- **771 / 779** Languages: concise proficiency, **keep CEFR** ("intermediate (B1)"), EN/HE native;
  re-source a lost CEFR from `personalInfo.additional`.
- **772** Boot-storm damper: coalesce the `antcv:sections-updated` burst (~16% less boot blocking).
  Root cause of "gate hangs / refresh twice" = ~18s main-thread block on a big doc → see
  [[boot-storm-gate-freeze]].
- **773** Strip leaked me() authoring instructions ("[PROFILE — 2-3 sentences…]") from real content.
- **774** Export-settled gate: defer the first export until cloud-restore + migrations settle.
- **775** Version-display unify; killed the stale "1.50.9-babel-fish" seed flash (CLAUDE.md step 8).
- **776** Interests → rich_block (415's interests coercers made rich_block-aware).
- **777** Generation prompt: forbid ungrouped/floating TOOLS & METHODS rows (regen-gated).
- **778** CL Application Q&A page P1 (`antcv-application-qa-section.js`) — renders from
  `antcv:applicationQuestions`; P2 detection + P3 answers deferred. Spec:
  `docs/plan/CL_APPLICATION_QA_2026-06-22.md`.
- **779** Junior-rugby scrub (shape-agnostic) — regression from 776's 415 change.
- **780** TOOLS & METHODS merge-dedup: collapse the duplicated concise-top + groups (stash trimmed on
  `section.trimmedItems`) — the sidebar-bloat root cause behind the salmon/6-page-export mess.
- **781** Review-my-data modal z-index above the set-menu.
- **782** 🔒 **SECURITY — account delete wipes ALL local data in app.js** (cloud `DELETE /api/prefs` +
  `localStorage`/`sessionStorage.clear`), not the AntcvFullErase sidecar keep-list. All 3 delete paths.
- **783** Core-comp caps: CL bring 105 chars, CV core_comp 60 (tighter); Focus-Area abbreviations
  (Documentation→Docs).
- **784** Removed the "SIGN IN" heading from the loading cover.
- **785** Multi-tab sign-out: one tab signing out/deleting signs out all tabs (shared-localStorage
  re-sync was defeating delete).
- **786** Owner-present gate in 415: a fresh/deleted user no longer gets Gabriel's `CANON_INTERESTS`
  or the `placeRecs` recommendations re-planted.
- **787** Templated the recommendations default (me() skeleton + recs-as-list) — was "Danish and
  international recommenders…".
- **788** Template polish: `[References]` label; added the missing **Expertise** group to the TOOLS &
  METHODS skeleton.

## Reports / specs produced
- `docs/plan/GENERATION_OPTIMIZATION_2026-06-22.md` — root cause of the leak/empties (the hydration
  ternary falling through to the placeholder skeleton) + how to retire ~15 patch sidecars.
- `docs/plan/CL_APPLICATION_QA_2026-06-22.md` — the employer-questions → CL Q&A feature.
- `docs/qa/BUGFIX_KICKOFF_2026-06-22.md` — the open-issues board.
- Delivered `Gabriel_personalInfo_modernized_2026-06-22.json`; the diff showed the live kernel had
  LOST the **AntCV project** + `proofPointsByProject` (owner's corrected file restores them).

## OPEN for the NEXT session (priority)
1. **SW staleness** — the #1 systemic issue; fixes don't load. Needs a real fix (de-masking +
   guaranteed-fresh hard-refresh).
2. **Preserved relay/docx config after delete — DECIDED (owner 2026-06-22).** Finding: the DELETE DID
   wipe the user KV (`prefs2:<hash>` + D1 confirmed in the response). The relay/docx URLs the owner
   still sees are in localStorage (`proxyUrl`/`relayUrl`/`docxWorkerUrl`) and are currently RE-DEFAULTED
   on boot from app config — that auto-re-appearance is **NOT approved**. OWNER DECISION (revised 2026-06-22): the delete sequence
   removes **ONLY the relay URL** — **do NOT delete the API secrets** (keep them), nor necessarily the
   docx URL. The **WIZARD re-asks the relay URL**, and from it the **docx-worker URL + API secrets are
   mapped automatically** (they're retained/derived, not re-entered). So: (a) stop the boot-time
   re-default of the relay URL (clear it on delete), (b) the wizard has the user re-insert the relay
   URL → docx + secrets auto-map. This folds into the fresh-start-mode work (#3).
3. **Clean-delete → WIZARD** — the floor restores a skeleton that wizard-detection reads as "has data"
   → editor instead of wizard. Build a "fresh-start mode" flag (set on delete) that suppresses
   floor/canon/relay restores and forces the wizard, cleared on wizard completion. See the kickoff doc.
4. **GEN-CONTAMINATION** (owner insight) — a FULL regen must wipe the prior D1 generated output
   (`application`/`active_application`/`language_view`) as stage 1; quick gen keeps current.
5. **Salmon/pagination** — the tools-dedup (780) attacks the sidebar bloat; verify the export is no
   longer 6 pages, then the two-column balancing if still off.
6. **Focus-area CV/CL naming** — needs the app.src↔app.js Focus-area drift sorted first (788 note).
7. **Universal table-type redesign** (owner 2026-06-22) — the CORE COMPETENCIES / WHAT I BRING row
   editor is REGRESSED for both tables; rebuild as a full-control table type (heading/rule toggles,
   header+table CJLR, bold/italic, column-ratio + table-size drag, per-row hide/page/CJLR/enhance/fit/
   up-down/delete/+Add, settings-only gap/heading/2-col/heading-color/banded/char-caps, preview-editable).
   Spec: `docs/plan/TABLE_TYPE_REDESIGN_2026-06-22.md`.
8. Remaining kickoff items: rugby-in-Sirin-results scrub (may be moot after the JSON re-upload); sidebar
   photo spacing; Nordea CL lock; certs-missing-unsolicited.
