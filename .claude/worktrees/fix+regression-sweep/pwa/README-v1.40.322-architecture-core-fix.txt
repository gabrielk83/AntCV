AntCV v1.40.322 architecture-core-fix

Implemented in this build:
1. Settings wheel no longer opens wizard through cloud-restore fallback.
   - Cloud restore now defaults missing wizard flags to skipped and closes wizard.
   - Wizard should be opened only via explicit onboarding controls.
2. Settings route support added in app.js.
   - window._antcvOpenSettingsRoute({tier, subtab}) is exposed from the React closure.
   - Application history dropdown uses the direct route Standard -> Application history.
3. Settings Advanced tab now lands on Sync first.
4. Preview toolbar action buttons moved into app.js render tree.
   - JD Analysis, Fuse CV/CL, Privacy Status render once before PDF/DOCX.
   - DOM reparent/injection toolbar sidecars are disabled in index.html.
5. Language selector rewritten.
   - antcv-language-prefs.js now owns exactly one panel.
   - It mounts only when Settings -> Standard -> Personal is active.
   - It removes stray language panels outside Personal.
   - It controls top-bar language visibility only; it does not start translation.
   - At least one language remains selected.
6. Conflicting language/toolbar sidecars disabled in index.html.

Validation:
- node --check app.js passes.
- node --check antcv-language-prefs.js passes.
- node --check antcv-language-prefs-defaults.js passes.

Known remaining major work:
- Full row/page-break model for all table sections.
- Full HOW I WOULD CONTRIBUTE editor refactor.
- DOCX/PDF page-break parity for those new controls.
