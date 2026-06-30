# Next session prompt — AntCV (start 2026-07-01)

Paste this as the opening message of the next session.

---

You are continuing AntCV (React PWA on Cloudflare Pages + Workers). **SYNC FIRST**: `git fetch origin && git pull --rebase origin main`. Never force `main`. Read `CLAUDE.md` and the memory index before editing.

**Read first:** `docs/qa/SESSION_2026-06-30_CL_HARDENING.md` (full open/closed log) and the memories `appjs-appsrc-contribute-divergence`, `data-loss-on-restore`, `sidebar-fill-gap-is-antiblank-slack`.

**Current state (1.50.990 + docx-worker deployed 2026-06-30):** the unsolicited CL now generates correctly — opening/who/why real and relevant, foundation lead filled, HWIC present, bring rows present, slogan/closure/name editable inline. Three sidecars protect it: `antcv-cl-prose-loss-guard-985` (re-applies prose + signature/editable keys after a refresh-restore), `antcv-cl-prose-richblock-fill-987` (bridges generated prose `.content`→rich_block `items[0].t`, fills foundation lead). The worker now decodes the data-URL signature.

**FIRST — confirm with the owner these landed (real generate→refresh→export cycle):**
1. Signature renders in the **CloudConvert** PDF (the data-URL atob fix, worker 1.50.990).
2. "What I bring" shows the label with no "(click to add)".

**Then work this priority order (each needs the owner to verify a real export):**
1. **AI-notice two-box design (owner's spec).** Render a sidebar-colored box at the bottom of BOTH columns (sidebar width); show the notice TEXT only in the column with fewer text lines; the box doubles as closing the sidebar-color gap to the page bottom. WORKER change in `workers/docx-worker/src/index.js` (current notice = a bottom-corner VML frame + `aiWmSide`; sidebar fill is separate). CAUTION: extending the sidebar fill re-triggered PDF-BLANK-PAGE before — implement BOTTOM-ANCHORED, do not grow the column; verify with a real export.
2. **CV orphans** (main bullets + sidebar comma-lists + table cells leave 20–40-char tails). Harder per-line cap in the generation prompt (the ORPHAN RULE isn't holding); sidebar lists/table cells aren't covered by bullet compression. Verify by regen.
3. **Strategic Expertise cell text slides past the border** (CV CORE COMPETENCIES + CL WHAT I BRING tables) — worker table-cell width/padding.
4. **Zoom step 5%** (currently 10%, app.src.js preview zoom control) + **export-preview default 75%**.
5. **Eliminate the refresh for CloudConvert** — `__antcvUseServerPdf` (app.src.js ~1441) only flips once config `B` loads, so the first export is browser-print and a refresh is needed (and the refresh is the data-loss trigger). Make server-PDF available on the first export.
6. **Admin "raw template" export** — the template export strips bracketed instructions via `clean()`, so it doesn't reproduce the owner's full source template. Add a mode that preserves the instructions as a reference.

**Hard-won gotchas:**
- `pwa/app.js` is the DEPLOYED file; `pwa/app.src.js` has DIVERGED in the CL apply — grep app.js directly, count-guarded edits, mirror logic (not text) to app.src.js. Can't Read whole app.js (960KB single line).
- Cache-bust quintet on every PWA change (app.js?v, sidecar ?v, sw CACHE, version-override TARGET+STALE, ANTCV_VERSION seed). Never put the current version in STALE_VERSIONS.
- Images are data-URLs; the worker strips the `data:…,` prefix before atob.
- You CANNOT reproduce a real LLM generation / the full gate+worker+CloudConvert+sync timing headlessly — verify sidecar/decode logic by node simulation; ask the owner to verify generation/export-quality fixes on a real cycle. Workaround for the owner meanwhile: export WITHOUT refreshing (the live state is correct).
- Worker deploy: `gh workflow run deploy.yml -f target=docx-worker -f mode=deploy -f confirm=docx-worker` (one worker at a time; preserves bindings).
