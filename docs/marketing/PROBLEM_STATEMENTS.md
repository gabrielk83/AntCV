# AntCV — problem statements

Purpose: give every post, demo, and persona a clear problem before the solution.
Terence's note (2026-06-10) was right in substance even where the first post
chose otherwise: lead with the problem and the person, not the feature. A reader
who knows *who this is for* and *what it fixes* knows what to expect from the
rest. State the problem; let the product follow.

This doc is the source for that framing. It is **not** a sales script — no hype,
no banned words. The same restraint the writing engine enforces on candidate
prose applies here.

Cross-references: [FEATURES_REGISTRY.md](../FEATURES_REGISTRY.md) (what shipped),
[qa/ACTIVE_BUGS.md](../qa/ACTIVE_BUGS.md) (issue history), and the test personas
under [docs/personas/](../personas/).

---

## 1. The general problem statement

Framed as a question the target reader answers "yes" to — Terence's method.

> **You read the job description and you can do the work. You are just not sure
> your application proves it.**
>
> The fit is real, but it is scattered across years of roles, and the cover
> letter never quite connects your experience to what *this* employer needs. So
> a recruiter who would have called skims past instead.

That is the problem AntCV addresses: not "writing a CV" but **closing the gap
between a real fit and an application that shows it** — to a specific job, in the
candidate's own voice, under the candidate's own control.

Three sub-problems it answers:

- **Coverage** — "Did I miss a requirement the JD actually asked for?" AntCV maps
  the posting to the candidate's real history and surfaces what to pull forward.
- **Value, not duties** — "Does the reader see the outcome, or just the task?"
  The engine reframes responsibilities as results without inventing them.
- **Control & honesty** — "Is this still *me*, and is it true?" Own LLM keys or a
  shared demo provider, an anti-fabrication rule, and per-element human review.

### What it is *not* (the deliberate non-pitch)

AntCV is a working demonstration of product thinking + applied AI, built solo.
The point of a post is not to sell a tool to job seekers; it is to show the
thinking. So the problem statement sets context — it is the hook, not a closer.
Per the Terence exchange: a problem statement read out of context reads as a
sales pitch. In a post, pair it with the *why* — why this problem, why this
build — so the reader sees the reasoning, not an ad.

---

## 2. Personas — problem → how AntCV answers it

Each persona is a distinct problem shape. The synthetic ones double as test
fixtures (see [docs/personas/](../personas/)); they must stay **clearly
distinct** from each other and from the owner's real profile — no domain
bleed between them.

### 2a. The career-changer (software engineer) — *new persona*

> *"I have the skills, but my title doesn't say 'engineer' yet. Will the
> recruiter see the fit, or stop at my last job title?"*

A capable builder moving **into** a software role from an adjacent one. Strong
transferable skills, real projects, but a CV that reads as the old career.

How AntCV answers it:
- Reframes adjacent experience in the target role's vocabulary (pull the real
  project forward; never claim a title not held).
- Names the gap honestly in *How I Would Contribute* — a concrete plan to close
  it — instead of faking experience in the profile.
- The fit analysis shows which JD requirements are already covered and which need
  a reframe, so the cover letter connects skill to need.

Fixture: [docs/personas/devon/](../personas/devon/).

### 2b. Anita Myre-Kornfeldt — operations & seasonal logistics *(synthetic)*

> *"I prepare early and document everything, but my CV reads as a list of
> seasons survived, not value delivered."*

Ant-themed, deliberately unmistakable. Domain: **colony logistics, granary
planning, seasonal risk control** — and it stays there. Used to prove every
section type renders and to regression-test import flows. Her domain must never
leak into the owner's real profile (see 2c).

Fixture: [docs/personas/anita/](../personas/anita/).

### 2c. Gabriel Alexander Karp-Gershon — the owner *(real)*

> *"Recruiters see the product-management years; some still question hands-on AI
> depth. How do I show both at once, without it reading as a pitch?"*

Specialization (unsolicited / no posted role): **Processes & Products | People.**
Real background: 15+ years taking hardware–software products from concept to
production across consumer and regulated markets — change control, validation,
supplier coordination — plus solo GenAI work.

Two rules for his own application, from owner feedback (2026-06-13):
- **No domain leak with Anita.** His specialization is exactly *Processes &
  Products | People*, not "Seasonal Operations · Storage Planning" — that phrasing is
  Anita's logistics domain bleeding in and must not appear on his CV.
- **AntCV is evidence, not the headline.** It belongs **under the Kanzen
  consultancy experience entry** as a shipped project, not as the focus of the
  profile/summary. The profile leads with process/product/people judgment; AntCV
  is one proof point beneath Kanzen.

> Note: Gabriel's live CV data is stored in his browser (localStorage
> `personalInfo`), not in this repo, so the subtitle is regenerated from his own
> stored profile. The fix is applied in the running app (specialization →
> *Processes & Products | People*; move AntCV under the Kanzen role), not by a
> repo edit. This doc records the intended positioning so generation stays on it.

---

## 3. Engineering as problem → solution (the v~1.50.300 band)

For posts that show the *building*, the work around v1.50.300–310 reads cleanly
as problems solved, not changelog lines. Each is a real user-facing problem with
a one-line fix. (IDs cross-ref [qa/ACTIVE_BUGS.md](../qa/ACTIVE_BUGS.md).)

| # | Problem (what the user hit) | Solution shipped | Version |
|---|------------------------------|------------------|---------|
| ACCESS-REQ | A new user whose email wasn't allow-listed saw a raw error code and no way forward. | A clear "request submitted → withdraw" access panel on the login gate, with an admin approve/reject workflow. | 1.50.300–302 |
| LOGIN-POLISH | The "back to sign in" control was invisible (wrong colour token); a transient relay-config fetch could fail during a service-worker swap. | Fixed the token; added a transient retry so the gate settles instead of stalling. | 1.50.302–303 |
| BYOK-TEST | A user bringing their own key couldn't test it — the wizard demanded a worker URL and failed with "no worker set". | Test now mirrors the real dispatch chain (own worker → shared relay fallback), so the key is actually exercised. | 1.50.304 |
| BYOK-ROUTE | With only Claude + OpenAI keys, the router still tried Mistral/Gemini → 401; requests also 400'd on internal `_antcv_*` fields. | Restrict the provider list to the keys the user actually holds; strip internal fields before forwarding (demo and regular proxy both). | 1.50.305–306 |
| BYOK-DEMO | Users on their own keys still saw the DEMO badge and watermark. | Demo markers now show only in true demo mode with no own key. | 1.50.307 |
| BYOK-PDF | Own-key users consumed the shared CloudConvert key for server PDF. | Gate worker PDF on demo / own-worker / own CloudConvert key; added an optional key field. | 1.50.308–309 |
| CL-SALMON | The cover letter had no page-break indicator — the measurer only scanned CV columns. | Tag the CL flow; add a cover-letter pass so auto page breaks fire there too. | 1.50.310 |

Common thread for a post: **most of these are honesty-and-control bugs** — making
"bring your own key" mean what it says, and making failure states legible. That
is the product story underneath the fixes.

---

## 4. Tone guard (applies to every post and persona line above)

- Problem first, in the reader's words. No feature before the reader knows why.
- No banned words, no American resume-speak, no "transformative / passionate /
  results-driven". Calm, factual, concrete — the same register the engine
  enforces on candidates.
- A problem statement out of context reads as a pitch. In a post, pair it with
  the *why* (why this problem, why this build) so it reads as thinking, not an ad.
