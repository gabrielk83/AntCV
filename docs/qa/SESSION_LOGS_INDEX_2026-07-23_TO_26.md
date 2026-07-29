# Desktop session arc, 2026-07-23 to 2026-07-26 - index

One long desktop session that began with Copenhagen Stage 4 and ended with a
full bugfix sweep. Written up as five logs because the themes are independent;
this index is the map. `docs/qa/ACTIVE_BUGS.md` carries the one-paragraph DONE
entries; these logs carry the root causes and the reasoning.

| Log | Theme | Shipped |
|---|---|---|
| [SESSION_LOG_2026-07-23_COPENHAGEN_STAGE4.md](SESSION_LOG_2026-07-23_COPENHAGEN_STAGE4.md) | Stage 4 DOCX/PDF export parity: VML rounded header box, photo ring, band typography, CL app-line and sign-off, real CloudConvert verification. Plus the owner follow-ups (spec line always shorter, figure -0.05in, font controls). | wk `1.14.165`, later `1.14.171`; PWA `1.51.3622`, `1.51.3743` |
| [SESSION_LOG_2026-07-24_LANG_BRAND_CONTAMINATION.md](SESSION_LOG_2026-07-24_LANG_BRAND_CONTAMINATION.md) | Loading an app no longer LLM-translates; one window at a time. The relay JD-cross-app guard and the data heal. Brand everywhere (meta.brandV2 backfill, re-research, recruiter-brand guard). App 2734 resolution. | PWA `1.51.3742`/`3743`; relay `auth-36`; wk `1.14.171` |
| [SESSION_LOG_2026-07-25_SCOPE_AND_PAGINATION.md](SESSION_LOG_2026-07-25_SCOPE_AND_PAGINATION.md) | The client-side stuck-JD-scope ROOT cause (kernel staging never consumed). Quality and palette census. Per-app pagination maps. Salmon break site correct in BOTH columns, and the Word-equivalent preview sheet. | PWA `1.51.3762`, `3763`, `3802`, `3803` |
| [SESSION_LOG_2026-07-26_WHY_GATE.md](SESSION_LOG_2026-07-26_WHY_GATE.md) | Cover-letter WHY sections: no recited employer facts, no hollow bridges, no model meta-commentary. Prompts in both layers plus a gate, and a 50-app heal. | proxy (prompt-augment), gen-runner |
| [SESSION_LOG_2026-07-26_BUGFIX.md](SESSION_LOG_2026-07-26_BUGFIX.md) | The backlog run: CV fit by compression never deletion, the 50-app cap that ate originals, the night stub writer, and the eight Copenhagen render flags. | PWA `1.51.3822`/`3823`; wk `1.14.172`; relay `auth-37` |

## The through-line worth remembering

Most of these turned out to be ONE family. A JD pasted before an application
existed sat in the `kernel` staging scope and was never cleared; a cold-started
tab picked it up and auto-saved it under whatever app loaded next; the relay's
dedupe path then overwrote healthy rows' `jd_text` AND `meta`, which silently
stripped stored slogans and brand records, which in turn made colours stop
applying and made the language healer "fix" a mismatch it should never have
seen. It was closed from both ends - the relay refuses a cross-app JD
(`auth-36`), and the client consumes the staging slot on app adoption
(`1.51.3762`) - and the damaged data was healed from tracker-canonical sources.

## Process notes

- Two spawned background bugfix agents were killed by the host process exiting.
  The second had already landed AND deployed its work but died before reporting,
  leaving uncommitted follow-up WIP that a later inline pass recovered. For long
  autonomous runs prefer the foreground session, or commit far more often.
- Several defects were found by AUDIT rather than reported: the 8 re-poisoned
  apps, the Tech Mahindra meta-commentary letter, and the missing slogans. A
  census after every bulk operation earns its keep.
- Two detectors written this week over-fired on first contact with real data
  (the WHY joined-sentence rule, and a cross-mention scanner matching "Tech"
  inside "technical"). Both were narrowed against live output before shipping.
  A false positive that rewrites the owner's good writing is worse than a miss.
