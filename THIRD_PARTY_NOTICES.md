# Third-party notices

AntCV is proprietary (see `LICENSE`). The material below is third-party work. Its own licence
governs it, and AntCV's licence does not restrict it.

## ai-job-search (MIT)

Source: https://github.com/ai-job-search-dev/ai-job-search

Ported or adapted, with changes for AntCV (Danish and Swedish handling, AntCV's grounding rules,
JavaScript ports). The file headers say what was changed.
- Text guards: `scripts/job-tracker/guard_common.py`, `fact_guard.py`, `echo_check.py`,
  `guard_rules.json`. Adapted from upstream PRs #783 and #807.
- Discovery rules: the language gate, the stale-posting and mass-posting rules in
  `scripts/job-tracker/discover-positions.py`, and the source health check in `job_sources.py`.
  Adapted from upstream's `/scrape`, `/rank` and `04-job-evaluation.md`.
- Follow-ups: `scripts/job-tracker/followups.py`. Adapted from upstream's `/outcome followup`.
- ATS check: `scripts/job-tracker/ats_text.py`. Adapted from upstream's `/apply` step 5d.
- Posting integrity guard: `scripts/job-tracker/posting_guard.py`, `workers/proxy/src/posting-guard.js`,
  `workers/demo-proxy/src/posting-guard.js`. Adapted from upstream `tools/posting_guard.py`.

```
MIT License

Copyright (c) 2026 Mads Lorentzen

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Models used at run time (downloaded, not in this repository)

| Model | Licence | Used by |
|---|---|---|
| alexandrainst/scandi-nli-large-v2 | Apache-2.0 | `scripts/job-tracker/fact_guard_nli.py` (Danish / Swedish) |
| MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli | MIT | `scripts/job-tracker/fact_guard_nli.py` (English) |

## Data sources

The Danish annual-report figures in `scripts/job-tracker/company_financials.py` are public data
from Erhvervsstyrelsen's filings index (`distribution.virk.dk/offentliggoerelser`).
