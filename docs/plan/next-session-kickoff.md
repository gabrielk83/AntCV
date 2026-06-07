# Next-session kickoff — kernel/app-history + page-split (paste as the first message)

> Durable copy of the fresh-session kickoff prompt. Paste the fenced block below as
> the first message of a new Claude Code session to continue both work tracks with
> full tooling, remote control, and the working protocol. Keep this file updated as
> versions advance (current baseline below).
>
> **Baseline at authoring:** branch `claude/antcv-roadmap-bugs-L9Sqa`, version
> **1.50.218**, PR **#265** (draft).

```
You are continuing AntCV development. Work ONLY on branch
`claude/antcv-roadmap-bugs-L9Sqa`, develop → commit → push there, and keep PR
#265 (draft) as the single PR. Current deployed version on that branch: 1.50.218.

## Start of session (do this FIRST, in order)
1. Run `/login` and complete it to authorize remote control (remote control will not
   attach without a completed login).
2. Run `/remote-control` to attach remote control for this session.
3. Load the AntCV Claude API (load the AntCV Claude API integration AFTER login/remote
   is attached, so API-backed actions are available).
4. Check the relay/worker `/config` (via the Cloudflare MCP tools / a fetch) so demo
   mode, proxy URLs and worker endpoints are known before you change anything.
5. GitHub MCP scope is ONLY `gabrielk83/antcv` (use mcp__github__* tools; no gh CLI).
6. Sync the checkout (see env note) before reading/editing.

## First action — review + ownership (BEFORE any code change)
Open with a short, factual overview (no filler), then wait for the owner's go on the
priority before editing:
1. **Current feature/bug review** — read `docs/qa/ACTIVE_BUGS.md` (2026-06-07 section)
   and `docs/FEATURES_REGISTRY.md`; summarise the OPEN items in both tracks (A kernel/
   app-history, B page-split/export) and what's already shipped/working (don't regress).
2. **Next-step plan with explicit ownership** — for each open item, state who owns the
   next action and present it as a table:
   - **You (agent):** investigate / read-only trace / write the fix / cache-bust / push.
   - **Me (owner):** in-browser preview check, PDF/DOCX export check, live kernel/
     app-history reproduction, deploy approval (deploy.yml), and any product decision.
   Make clear which items are blocked on an owner verification vs. ready for you to start.
3. Recommend the order (highest testing-pain-relief first: kernel persist+reload, then
   stuck-on-last-command) and confirm the priority with the owner before coding.

## Environment & remote control
- This is the Claude-Code-on-the-web remote env. The container REPEATEDLY reverts the
  local checkout to a stale commit. So at start, and before EVERY edit:
    git fetch origin claude/antcv-roadmap-bugs-L9Sqa && git reset --hard origin/<branch>
  and after every push, re-fetch and verify the REMOTE tree (git show origin/<branch>:path)
  — never trust the local working copy.
- Cloudflare tooling is available via deferred MCP tools (load with ToolSearch): Pages
  deploy + status, Workers deploy/get_code, and the relay/worker `/config`. Deploy PWA +
  workers ONLY via deploy.yml (one deployer at a time, never in parallel).
- The docx-worker lives in workers/docx-worker/ (src/generate.js is the source;
  generate.js is the bundle). Tests: `npm run test:smoke` and
  `node --test workers/docx-worker/test/palette.test.mjs`.

## Build rules (CRITICAL — read docs/deployment/app-js-source-and-rebuild.md)
- pwa/app.src.js is the canonical source for pwa/app.js. EDIT app.src.js, then rebuild
  with TERSER ONLY: `npx --yes terser pwa/app.src.js -c -m -o pwa/app.js`. esbuild is
  UNSAFE (adds "use strict" → blue screen). After rebuild verify: `node --check pwa/app.js`,
  it starts with `(()=>{`, and `grep -c "use strict" pwa/app.js` == 0.
- Sidecars (pwa/antcv-*.js) are edited directly (not minified).
- After ANY change, bump the cache-bust trio: the file's `?v=` in pwa/index.html,
  `CACHE` in pwa/sw.js, and `TARGET_VERSION` in pwa/antcv-version-override.js. INVARIANT:
  never put the current TARGET_VERSION in STALE_VERSIONS; when bumping, add the PREVIOUS
  target to STALE.
- Run unit tests before pushing: `node --test pwa/test/unit/*.test.mjs` (29 tests),
  plus proxy + docx tests if the worker changed.

## Verification loop
- The owner verifies the PREVIEW in a real browser and EXPORTS the PDF/DOCX — you have
  NO PDF/DOCX renderer, so for every worker/export change, push a small change and ask the
  owner to export once and report. Do not claim export behaviour you can't see.

## The work — two tracks, all logged in docs/qa/ACTIVE_BUGS.md (2026-06-07 section)

### Track A — kernel / application history (start here; map code READ-ONLY first)
- KERNEL-STUCK-LAST-CMD-001: generation finishes but the UI stays "generating" until a
  browser refresh (result is ready, not surfaced). Likely a kernelShowcaseInProgress flag
  not cleared / missing re-render on completion. See app.src.js around
  `kernelShowcaseInProgress` / `kernelShowcaseGenerated` (~lines 12569, 21204).
- APPHISTORY-RELOAD-001: clicking a saved Application-History item does NOT load it.
- APPHISTORY-SAME-LINE-001: saving to Application History writes to the same
  (specialization) line/slot instead of its own.
- KERNEL-SPECIALIZATION-LINE-001: kernel does not write to the specialization line.
- KERNEL-CLOUD-PERSIST-001: generated kernel isn't saved to cloud memory (regenerated
  every session/tab-switch — makes testing brutal; persist + reload is the highest-value
  pair).
- WARNING: cloud-persistence + generation logic. Trace the exact save/load/cloud paths
  READ-ONLY first, propose the surgical fix, then change one path at a time and have the
  owner verify live. Never blind-edit save/restore — risk is lost saved applications.

### Track B — page split / export (remaining)
- PB-WORKER-CONT-HEADER-001: in the exported PDF/DOCX the EXPERIENCE continuation heading
  on page 2 reads "SELECTED OUTCOMES" instead of "EXPERIENCE (CONT.)". Only in the export,
  never the preview → docx-worker (generate.js) (Cont.) field-code / heading pairing bug.
- PB-WORKER-SIDEBAR-FILL-001: navy sidebar doesn't fill to the page bottom on a
  continuation page IN THE EXPORT (Word table-cell full-height technique). Preview fill was
  addressed 1.50.216 (page-row min-height:1123 + stretch in
  antcv-sidebar-subsection-pagebreaks-329) — confirm it holds; if not, switch technique.
- PB-PREVIEW-GROUPNAME-EDIT-001: a group-name edit made from the PREVIEW (inline) doesn't
  persist; only PANEL edits stick (panel race fixed 1.50.217).
- PB-AUTO-OVERFLOW-001: auto-overflow was built then STOOD DOWN (1.50.215) because it
  didn't render on mobile and forwarding the sidebar auto-break into the 2-column worker
  scrambled the PDF. The sidecar antcv-auto-overflow-362.js currently only clears
  antcv:autoPages. A proper rebuild needs (a) unpaginated height measurement (sum content
  height, not the current paginated DOM — the naive re-measure oscillated) and (b)
  worker-side group/role-aware 2-column pagination so the export breaks between groups.

## What already works (don't regress)
Manual page breaks across HIWC, foundation, single-content, lists, both tables (WHAT I
BRING / CORE COMPETENCIES), sidebar groups, and CV main-column page-boxes (incl.
core-competencies) — shipped 1.50.202–210; preview navy fill (1.50.216); group-name
panel-edit persistence (1.50.217); Selected-Outcomes page-break data-loss fix (1.50.218).
Model is antcv:itemPages ({sid:{itemKey:page}}); the CV preview paginates via the
"cv"===Lt page-box engine (oMain for the main column, the Di flatMap for the sidebar);
__antcvEffBucket merges itemPages (+ the now-inert autoPages).

Operate autonomously: investigate, fix, cache-bust, push, keep the draft PR, and report
when each fix is ready to verify. Use AskUserQuestion only for genuinely ambiguous or
destructive decisions. Be honest about what you can't verify (exports) and never
blind-edit the cloud/generation or worker paths without a read-only trace first.
```
