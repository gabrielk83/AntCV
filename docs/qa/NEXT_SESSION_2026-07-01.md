# Next session prompt — AntCV (start 2026-07-01)

Paste this as the opening message of the next session.

---

You are continuing AntCV (React PWA on Cloudflare Pages + Workers). **SYNC FIRST**: `git fetch origin && git pull --rebase origin main`. Never force `main`. Read `CLAUDE.md` and the memory index before editing.

**Read first:**
- `docs/qa/CL_CV_GENERIC_TEMPLATES_2026-06-30.md` — the owner's generic CL+CV templates (embedded WRITING RULES + recruiter-questions page), what's DONE, what's OPEN.
- `docs/qa/SESSION_2026-06-30_CL_HARDENING.md` — the earlier CL/CV export-hardening log.
- Memories: `appjs-appsrc-contribute-divergence`, `data-loss-on-restore`, `sidebar-fill-gap-is-antiblank-slack`, `gabriel-semantic-constraints-and-banned`, `nordic-cl-template`.

**State (1.50.993 + docx-worker deployed 2026-06-30):** the unsolicited CL generates well (opening/who/why/foundation real + relevant, signature renders in CloudConvert, prose survives the refresh). The owner's GENERIC templates are adopted: me() Nordic CL = the generic body; the full WRITING RULES (expanded banned words/phrases + semantic constraints) are enforced in THREE layers — me() template, generation prompt (Nordic rule pts 7-9), and the semantic-constraints audit floor (`antcv-banned-audit` BASELINE). A RECRUITER-QUESTIONS-001 generation rule handles JD-asks-questions.

**Work this priority order (each needs the owner to verify a real generate/export):**
1. **me() CV admin/export template → `CV_Template_AntCV_Prompts_Generic`.** Rebuild the CV admin template (positioning triad ≤3, PROFILE 2-3 sentences, Work-Style one line ending on a people skill, 6 CORE COMPETENCIES rows by JD priority, Results: headline per role, Tools&Methods groups, etc.). The CV *generation* prompt already covers most rules; this is the exportable admin template. (Same divergence rule: edit deployed app.js directly; mirror logic to app.src.js.)
2. **Recruiter-answers PAGE** — verify the CL renders exactly N question+answer blocks (header band + "Kind regards," + AI notice), ONLY when the JD has questions, on a real export. The generation rule + `questions_in_jd` + worker `jd_questions` already exist; this is end-to-end verification + any rendering fix.
3. **`bring_intro` generation field** — so the WHAT I BRING intro line is emitted on a fresh generation (schema + apply + the antcv-cl-prose-richblock-fill-987 bridge). Today the lead is clean but empty.
4. **AI-notice two-box (owner's design)** — sidebar-colored box at the bottom of BOTH columns; notice text only in the column with fewer text lines; the box closes the sidebar-color gap. WORKER change. CAUTION: growing the sidebar fill re-triggered PDF-BLANK-PAGE before — implement BOTTOM-ANCHORED only; verify with a real export.
5. **CV orphans** (20-40-char tails in bullets + sidebar lists + table cells), **Strategic Expertise cell overflow** (worker table cell width), **zoom 5% step + export-preview default 75%**, **eliminate the refresh for CloudConvert** (`__antcvUseServerPdf` ~app.src.js 1441 — make server-PDF available on the first export so the data-loss-triggering refresh isn't needed).

**Hard-won gotchas:**
- `pwa/app.js` is the DEPLOYED file; `pwa/app.src.js` has DIVERGED in the CL apply — grep app.js directly, count-guarded edits, mirror logic (not text) to app.src.js. Can't Read whole app.js (single 960KB line).
- Cache-bust quintet every PWA change (app.js?v, sidecar ?v, sw CACHE, version-override TARGET+STALE, ANTCV_VERSION seed); never put the current version in STALE.
- Images are data-URLs; the worker strips the `data:…,` prefix before atob (fixed 990).
- The banned-audit is a FLAG, not auto-strip; `BASELINE_WORDS`/`BASELINE_PHRASES` is the global floor merged with the user's `stylePrefs.banned_words`.
- You CANNOT reproduce a real LLM generation / the full gate+worker+CloudConvert+sync timing headlessly — verify sidecar/decode/template logic by node simulation; ask the owner to verify generation/export-quality on a real cycle. Owner workaround meanwhile: export WITHOUT refreshing (live state is correct).
- Worker deploy: `gh workflow run deploy.yml -f target=docx-worker -f mode=deploy -f confirm=docx-worker`.
