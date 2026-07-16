# Job-Tracker Nightly — 2026-07-16

**Run type:** scheduled `antcv-job-tracker-nightly` (desktop). SYNC FIRST clean (origin already up to date at start; a general-nightly push landed mid-run — rebased cleanly on top, no regression). Token valid (self-renewing). Skeleton + export fixtures present.

## Task 1 — generation queue

Doc rev 90, 33 rows. Under the `jd_content_len>200` gate exactly **one** row was eligible: `terma-career-opportuniti-0782` (raw 277c / 172c real — a SuccessFactors careers-SPA scrape that captured only the title + requisition line; skipped as a hollow stub the prior three nights).

Rather than skip a fourth time, **recovered the real posting**:
- WebFetch + a raw `curl` of `career5.successfactors.eu/career?...career_job_req_id=1167` returned the full server-rendered HTML; keyword presence confirmed the JD body is genuinely in-page (MISWG, Defense Intelligence, MBSE, PhD/Postdoc, Strategic Funding, clearance — not a summarizer confabulation).
- Extracted + cleaned a 6764c JD, wrote it to `doc.jd`.
- Wrote a grounded **clearance/MISWG differentiator** to `signals[uk]` (the JD requires *Danish Defense Intelligence Service clearance + NATO/EU/MISWG 7-year residency*; Gabriel held an IDF development-division defence clearance and Israel is a MISWG state — framed as forward eligibility only, explicitly no PhD/doctorate fabrication, and a "render without photo/age" note since Terma asks for it).
- Wrote role intel to `support[uk]`.
- Cleared the stale `nvidia_siph` `queue=True` ⏰ flag (already had artifact 2608). PUT rev 90→91.

**Generated (high tier, opus-4-8):** `terma-career-opportuniti-0782` → **Terma / Advanced Systems Engineer, Strategic Funding & Collaboration (req 1167)**, Søborg.
- 12/12 sections, coherence done in 114s, density loop ran (quality 64→79%, 2 pages).
- Persisted **application_id=2642**, category `engineering_hardware` (correct — not unsolicited), doc rev 91→92, active-app pointer restored to 1008.

**Research folded in:** the runner's Brave research (6 findings) + brand crawl (terma.com → tone formal, values innovation/technological-excellence/partnership/vigilance) + category-recall prior-app reference (engineering_hardware) + the clearance/MISWG signal.

### Verification (byte-exact `export_pdfs.py`)
- CV **2 pages**, CL **1 page**, status OK.
- **0 banned dashes** — direct glyph scan of both rendered PDFs (em/en/figure/U+2010/U+2011/minus all zero). The `�` banned-word console log was the predicted U+2014-pre-sanitize render; `sanitize_text` scrubbed it on persist.
- Relay GET of app 2642: 15 CV + 8 CL sections, jd_text 6764c saved, subtitle = "Systems Architecture & Requirements • Modelling & Measurement Analysis • Cross-Disciplinary Integration", slogan set, jd_language en.
- **No fabricated doctorate** — zero PhD/Postdoc/doctor claims despite the JD preferring one (correct anti-fabrication). Profile honestly surfaces the IDF development-division defence-clearance service + NATO/EU/MISWG exposure. Clearance differentiator also present in core_comp + the cover letter.
- DK-dates scrubbed ("2022-2026 (present)" → "2022-2026"; "2023-present" → "2023-2026"). Pan Idræt correctly demoted to a `foreningsarbejde` interest (technical role, not people/sports).

**Excel refreshed** (Drive mounted) — `job-tracker-sync.py pull --render`, rev 92, primary + Downloads copy + Proposed Inbox tab.

**Owner PushNotified.** Deliverable note: Terma explicitly asks applicants to **omit photo and age** — toggle the profile photo off on open (the headless persist carries the global photo style).

## Task 2 — build increment

No code shipped this run. The meaningful, verified increment is the **JD recovery + high-tier persist of app 2642**, which resolves the owner-owed leg of OPEN_REGISTER row 95 (req-1167 "paste the real JD") and delivers a genuine defence-tailored application.

A code fix for the underlying scrape gap was **registered, not shipped** (unsafe unattended): **JOBTRACKER-SUCCESSFACTORS-SCRAPE-TITLEONLY-001** (OPEN_REGISTER row 96) — the add-time proxy JD-fetch should extract the SuccessFactors `jobDescription` block from the raw HTML for `*.successfactors.eu` / `career_job_req_id` URLs. Needs a proxy deploy + live-SPA test → owner/desktop, deploy-gated.

## Needs the owner
- Eyeball app **2642** (first persist of this row); toggle photo off (Terma no-photo request).
- Optional: the sibling `career-opportunities-ter-7765` (req 1244, Associate Project Manager, Program Excellence) can be recovered the same way for a clean regen — it currently carries a placeholder artifact (aid 2568) over a 155c stub JD.
- The SuccessFactors scrape fix (row 96) when unpressured.

## Registers updated
- `docs/qa/OPEN_REGISTER.md` — 2026-07-16 STATUS ADVANCE block; row 95 advanced (req-1167 resolved); NEW row 96.
- `docs/qa/ACTIVE_BUGS.md` — top entry `JOBTRACKER-TERMA-JD-RECOVERY-001`.
- `docs/FEATURES_REGISTRY.md` — increment (26), FT-JOBTRACKER.
