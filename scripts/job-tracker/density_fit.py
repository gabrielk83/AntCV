#!/usr/bin/env python3
"""density_fit.py — GOLD-TARGET-LAYOUT-DENSITY-001 MEASURE->TARGET->REWRITE loop.

Drives generated CV/CL sections to layout density: every bullet/paragraph ends
on a last rendered line filling >= 60% of its column width (owner red/green
standard: red = pull the runt back 1-3 words at a clause boundary, green =
lengthen from facts already in the line — NEVER fabricate).

Loop (max 3 iterations):
  1. MEASURE  — byte-exact render (app's own buildPayload -> docx-worker
                /generate-pdf) + measure_density line metrics.
  2. TARGET   — per runt decide trim vs lengthen from the measured char delta.
  3. REWRITE  — deterministic clause-boundary trims locally; lengthening via
                ONE batched cv-proxy /v1/messages call (SSE-forced), each
                rewrite gated: numbers + acronyms survive verbatim, length in
                band, no banned words, no em/en dashes.
  4. Re-render, keep the best state, converge.

Mutation unit = the app's STORED sections (cv_sections/cl_sections), rebuilt
into the payload each iteration — so a converged result persists correctly.
Every write target is located by EXACT normalised-text match in the sections
(ORPHAN-WRITE-VERIFY-001: the path is only a hint; never index-trust).

CLI:
  python density_fit.py --app 795            # fit a live app's CV (dry: report only)
  python density_fit.py --app 795 --apply    # PUT the fitted sections back
  python density_fit.py --app 795 --doc cl   # cover letter
"""
import argparse
import copy
import json
import os
import re
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import measure_density as MD

MAX_ITERS = 4
TRIM_MAX_CHARS = 28          # a runt line short enough to pull back deterministically
# Personality-carrying sections: never trim deterministically (a clause there —
# the team joke, a work-style note — is content the standing deliverable rules
# protect). The LLM path handles them with fact gates.
NO_TRIM_SECTIONS = {"interests", "profile", "work_style", "accessibility"}
# Owner-approved deterministic substitutions (2026-07-13): exact pairs only,
# applied to a wrapped runt (any policy, incl. verbatim certs) when the saved
# chars pull its dangling line back.
COMPACT_SUBS = [("Uni. of Toronto", "UofToronto"),
                ("University of Toronto", "UofToronto")]
# Re-space length windows per section (owner 2026-07-13: the profile block may
# move well beyond the default +-12).
RESPACE_BAND = {"profile": (-30, 30), "work_style": (-30, 30)}
RESPACE_DEFAULT = (-12, 15)
LLM_MODEL = os.environ.get("ANTCV_DENSITY_MODEL", "claude-sonnet-5")
PROXY = os.environ.get("ANTCV_PROXY", "https://cv-proxy.karp-gabriel-a.workers.dev").rstrip("/")
# Multi-model pass (owner 2026-07-13): candidates come from TWO model families;
# each accepted rewrite is fact-audited by the OTHER family (a verifier that
# does not share the writer's blind spots is more restrictive). gpt-5-mini is
# the proven cheap cross-family model (cost-quality benchmark 2026-07-11).
CANDIDATE_PROVIDERS = [
    ("anthropic", LLM_MODEL),
    ("openai", os.environ.get("ANTCV_DENSITY_MODEL2", "gpt-5-mini")),
    ("mistral", os.environ.get("ANTCV_DENSITY_MODEL3", "mistral-large-latest")),
]
VERIFY_BY = {"anthropic": ("openai", "gpt-5-mini"),
             "openai": ("anthropic", LLM_MODEL),
             "mistral": ("anthropic", LLM_MODEL)}

# clause-boundary candidates for the deterministic trim, by language
_BOUNDS = {"default": [", ", "; ", " ("], "zh": ["，", "、", "；", ", "]}
# a trimmed text may not end on a dangling connector (visible-leak floor)
_CONNECTORS = {
    "en": {"and", "or", "with", "for", "of", "to", "in", "on", "via", "the", "a", "an", "plus"},
    "da": {"og", "eller", "med", "for", "til", "i", "på", "via", "samt", "en", "et"},
    "es": {"y", "o", "con", "para", "de", "a", "en", "el", "la", "los", "las"},
    "zh": set(),
}

def _norm(s):
    return MD._norm(s)

def _numbers(s):
    return sorted(re.findall(r"\d+(?:[.,]\d+)?", s or ""))

def _acronyms(s):
    return sorted(set(re.findall(r"\b[A-Z][A-Z0-9][A-Z0-9-]*\b", s or "")))

def _ends_dangling(text, language):
    last = _norm(text).rstrip(".,;:!?)").split(" ")[-1].lower()
    conn = _CONNECTORS.get(language, _CONNECTORS["en"]) | _CONNECTORS["en"]
    return last in conn or text.rstrip().endswith(("-", "&", "+", ","))

# ── deterministic clause-boundary trim ───────────────────────────────────────
def trim_text(text, need_chars, cpl, language="en"):
    """Cut the text back at a clause boundary so its runt line disappears and
    the new last line stays >= 60% filled. Returns the trimmed text or None
    (no clean cut / cut would drop a number or acronym / dangling connector)."""
    text = str(text or "")
    terminal = "." if text.rstrip().endswith(".") else ""
    bounds = _BOUNDS.get(language, _BOUNDS["default"])
    cuts = []
    for b in bounds:
        i = 0
        while True:
            j = text.find(b, i)
            if j < 0:
                break
            cuts.append(j)
            i = j + 1
    for cut in sorted(cuts, reverse=True):
        removed = len(text) - cut
        if removed < need_chars:
            continue                       # cut too late: runt line survives
        over = removed - need_chars        # chars taken off the new last line
        if cpl and (over / cpl) > 0.40:    # new last line would dip below ~60%
            continue
        seg = text[cut:]
        if _numbers(seg) or _acronyms(seg):
            return None                    # never silently drop a fact
        if len(_norm(seg).strip(",;. ()").split()) > 3:
            return None                    # owner red rule: pull back 1-3 words,
                                           # never amputate a clause (LLM instead)
        cand = text[:cut].rstrip(" ,;([")
        if not cand or _ends_dangling(cand, language):
            continue
        if cand.count("(") > cand.count(")"):
            cand += ")"                    # visible-leak floor: rebalance parens
        if terminal and not cand.endswith("."):
            cand += "."
        return cand
    return None

# ── batched LLM lengthen (cv-proxy /v1/messages, SSE-forced) ─────────────────
def _token():
    return MD._gen_runner()._token()

def _sse_text(raw):
    text = ""
    for line in raw.splitlines():
        if line.startswith("data: "):
            try:
                ev = json.loads(line[6:])
            except Exception:
                continue
            d = ev.get("delta") or {}
            if d.get("type") == "text_delta":
                text += d.get("text", "")
            # OpenAI-style stream chunk
            for ch in ev.get("choices") or []:
                dd = ch.get("delta") or {}
                if isinstance(dd.get("content"), str):
                    text += dd["content"]
    return text

def _post_llm(provider, model, system, user, max_tokens=3000, timeout=120):
    """POST to cv-proxy /v1/messages with x-provider routing. Returns the
    model's text, tolerating all three response shapes the proxy emits:
    anthropic SSE deltas, OpenAI-style SSE chunks, plain chat.completion JSON."""
    gr = MD._gen_runner()
    body = {"model": model, "max_tokens": max_tokens, "stream": True,
            "system": system, "messages": [{"role": "user", "content": user}]}
    req = urllib.request.Request(PROXY + "/v1/messages", data=json.dumps(body).encode(),
                                 method="POST",
                                 headers={"Content-Type": "application/json",
                                          "Authorization": "Bearer " + _token(),
                                          "x-provider": provider,
                                          "Origin": gr.ORIGIN, "User-Agent": gr.UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read().decode("utf-8", "replace")
    if raw.lstrip().startswith("{"):
        try:
            obj = json.loads(raw)
            ch = (obj.get("choices") or [{}])[0]
            msg = (ch.get("message") or {}).get("content")
            if isinstance(msg, str):
                return msg
            content = obj.get("content")
            if isinstance(content, list):   # anthropic non-stream shape
                return "".join(b.get("text", "") for b in content if isinstance(b, dict))
        except Exception:
            pass
    return _sse_text(raw)

def _gate_candidate(it, new, language, gr):
    """Length + fact + style gates for one candidate. Returns (ok, reason)."""
    old = it["text"]
    delta = len(new) - len(old)
    mode = it.get("mode", "refit")
    if mode == "reorder":
        # pubs: order/punctuation may change, every word must survive (owner-
        # approved reordering; token multiset equality IS the fact gate here)
        import collections
        if collections.Counter(MD._tok(new)) != collections.Counter(MD._tok(old)):
            return False, "reorder changed, added, or dropped a word — reorder only"
        if not (-8 <= delta <= 8) or new == old:
            return False, f"reorder length drift {delta:+d} outside [-8,8]"
        return True, ""
    if mode == "respace":
        # paragraph-appeal fix: re-wording either way, never past wrap
        blo, bhi = ((-18, 0) if it["kind"] == "cell"
                    else RESPACE_BAND.get(it["sec"], RESPACE_DEFAULT))
        hi = min(bhi, max(0, it.get("add_wrap", bhi) - 2))
        lo = blo
        band_ok = (lo <= delta <= hi) and new != old
        reason = f"length change {delta:+d} outside the re-space band [{lo},{hi}]"
    else:
        # grow floor = clearing the 60% runt line (add_min), not the stated
        # 65% target — landing between the two already de-runts the item.
        # Ceiling = the WRAP point: growth past it spills a NEW short line and
        # the loop chases its tail (observed on 1-line sidebar labels).
        grow_cap = min(it["add_hi"] + 18, max(it.get("add_wrap", it["add_hi"] + 18) - 2, it["add_lo"]))
        grow_ok = it["add_lo"] >= 2 and (it.get("add_min", it["add_lo"]) - 2 <= delta <= grow_cap)
        if grow_ok and delta > 0:
            # TAIL RULE: added chars must land on the LAST rendered line — a
            # mid-text insertion hits the band yet leaves the dangling line
            # untouched (observed: profile grew an inner sentence 4 rounds
            # running with zero fill change). The edit must start in the final
            # 40% of the original text.
            cp = 0
            while cp < min(len(old), len(new)) and old[cp] == new[cp]:
                cp += 1
            if cp < 0.6 * len(old):
                return False, ("the growth was inserted MID-TEXT so the short last line is "
                               "unchanged — extend the FINAL clause / end of the text instead")
        shrink_ok = it.get("cut_lo", 0) >= 2 and \
            (-(it.get("cut_hi", 0) + 12) <= delta <= -(it.get("cut_lo", 0) - 2)) and \
            len(new) >= 0.45 * len(old) and not _ends_dangling(new, language)
        band_ok = grow_ok or shrink_ok
        reason = (f"your text changed the length by {delta:+d} chars, outside "
                  f"every allowed band — hit the char budget exactly")
    if not band_ok:
        return False, reason
    if _numbers(new) != _numbers(old) or set(_acronyms(old)) - set(_acronyms(new)):
        return False, "a number or acronym was changed or lost — keep all facts verbatim"
    if gr.banned_hits(new) or "—" in new or "–" in new:
        return False, "used a banned word or an em/en dash"
    return True, ""

def llm_refit(items, language="en", facts="", n_families=None):
    """items: [{id, text, sec, kind, mode, add_*, cut_*, context, feedback}] ->
    ({id: new_text}, {id: reason}). Candidates are gathered from TWO model
    families (CANDIDATE_PROVIDERS), gated, the best-fitting candidate wins per
    item, and each winner is fact-audited by the OTHER family (owner 2026-07-13:
    more-restrictive cross-model inputs). `facts` = the user-kernel digest the
    rewrites may draw from (owner: everything in the kernel is fair game)."""
    if not items:
        return {}, {}
    gr = MD._gen_runner()
    lang_name = {"en": "English", "da": "Danish", "es": "Spanish", "zh": "Simplified Chinese"}.get(language, "English")
    sys_p = (
        "You re-fit CV/cover-letter lines so each ends on a FULL typeset line with even "
        "word spacing. STRICT RULES: never invent facts, numbers, tools, employers, or "
        "claims. When growing, draw ONLY from what the line states or from the VERIFIED "
        "CANDIDATE FACTS block, and EXTEND THE END of the text (the final clause) — an "
        "insertion mid-text leaves the short last line unchanged. If a budget cannot be "
        "met without inventing, return the item's text UNCHANGED instead. When shrinking, "
        "prefer replacing words with SHORTER SYNONYMS of identical meaning; drop no fact. "
        "For re-space items, re-word so the justified lines break evenly (avoid one very "
        "long word forcing wide gaps). "
        "Keep every number, proper noun, certification code, and technical "
        f"term EXACTLY. Write in {lang_name}. Never use em or en dashes; use a hyphen or comma. "
        "Avoid: spearhead, leverage, robust, passionate, committed, cutting-edge, world-class, "
        "results-driven, dynamic, innovative, synergy. "
        "Return ONLY valid JSON: {\"items\":[{\"id\":\"...\",\"text\":\"...\"}]}"
    )
    asks = []
    for it in items:
        # ABSOLUTE length windows (2026-07-13): models miss relative "+N chars"
        # deltas by a handful; "your output must be LEN1-LEN2 characters" lands
        # far more often. Offer every allowed window explicitly.
        n = len(it["text"])
        a = {"id": it["id"], "where": f"{it['sec']} {it['kind']}", "text": it["text"],
             "current_length_chars": n}
        windows = []
        if it.get("mode") == "reorder":
            a["fix"] = ("reorder ONLY: shuffle the elements (authors / title / venue / year) "
                        "and separators so the last line fills; every word must survive "
                        "verbatim — nothing added, nothing dropped, nothing reworded")
            windows.append([n - 8, n + 8])
        elif it.get("mode") == "respace":
            blo, bhi = ((-18, 0) if it["kind"] == "cell"
                        else RESPACE_BAND.get(it["sec"], RESPACE_DEFAULT))
            lo, hi = blo, min(bhi, max(0, it.get("add_wrap", bhi) - 2))
            a["fix"] = ("re-space: this block justifies with WIDE word gaps; re-word (shorter "
                        "synonyms, similar-length words) so lines break with even spacing")
            windows.append([n + lo, n + hi])
        else:
            if it["add_hi"] >= it["add_lo"] and it["add_lo"] >= 2:
                cap = min(it["add_hi"], max(it.get("add_wrap", it["add_hi"]) - 2, it["add_lo"]))
                windows.append([n + it["add_lo"], n + max(it["add_lo"], cap)])
            if it.get("cut_hi", 0) >= it.get("cut_lo", 0) and it.get("cut_lo", 0) >= 2:
                windows.append([n - it["cut_hi"], n - it["cut_lo"]])
        a["rewritten_length_must_be_within_one_of"] = windows
        if it.get("context"):
            a["role_facts"] = it["context"]
        if it.get("feedback"):
            a["previous_attempt_failed"] = it["feedback"]
        asks.append(a)
    user = ("Fix EACH item. Its rewritten text's TOTAL LENGTH IN CHARACTERS (count them, "
            "including spaces and punctuation) must land inside ONE of the item's "
            "rewritten_length_must_be_within_one_of windows [min,max]. A longer window "
            "means grow by elaborating from the item, role_facts, or the VERIFIED "
            "CANDIDATE FACTS; a shorter window means shrink using shorter synonyms with "
            "identical meaning. Outside every window the typeset line still dangles or "
            "wraps a new short line, so count before you answer. Same meaning, same facts.\n"
            + ("VERIFIED CANDIDATE FACTS (you may draw from these to grow any item):\n" + facts + "\n"
               if facts else "")
            + json.dumps({"items": asks}, ensure_ascii=False))
    by_id = {it["id"]: it for it in items}
    # gather gated candidates per item from each provider family
    cands = {}    # id -> list of (new_text, provider, band_dist)
    failed = {}
    for provider, model in CANDIDATE_PROVIDERS[:n_families or len(CANDIDATE_PROVIDERS)]:
        try:
            text = _post_llm(provider, model, sys_p, user)
        except Exception as e:
            print(f"   [density] {provider} candidates failed ({str(e)[:70]})")
            continue
        m = re.search(r"\{.*\}", text, re.S)
        if not m:
            continue
        try:
            out = json.loads(m.group(0))
        except Exception:
            continue
        for row in out.get("items") or []:
            it = by_id.get(row.get("id"))
            new = _norm(row.get("text"))
            if not it or not new:
                continue
            ok, reason = _gate_candidate(it, new, language, gr)
            if not ok:
                failed.setdefault(it["id"], reason)
                continue
            # rank: distance from the middle of the aimed band (0 = perfect)
            delta = len(new) - len(it["text"])
            if it.get("mode") == "respace":
                dist = abs(delta)
            elif delta >= 0:
                dist = abs(delta - (it["add_lo"] + it["add_hi"]) / 2.0)
            else:
                dist = abs(-delta - (it.get("cut_lo", 0) + it.get("cut_hi", 0)) / 2.0)
            cands.setdefault(it["id"], []).append((new, provider, dist))
    accepted, src = {}, {}
    for iid, lst in cands.items():
        lst.sort(key=lambda t: t[2])
        accepted[iid] = lst[0][0]
        src[iid] = lst[0][1]
        failed.pop(iid, None)
    for it in items:
        if it["id"] not in accepted and it["id"] not in failed:
            failed[it["id"]] = "no usable rewrite returned"
    # adversarial fact gate, CROSS-FAMILY: a grown line may only ELABORATE,
    # never CLAIM. Each winner is audited by the OTHER model family.
    if accepted:
        by_verifier = {}
        for iid in list(accepted.keys()):
            if by_id[iid].get("mode") == "reorder":
                continue   # token-multiset equality is a stronger gate than the auditor
            vprov, vmodel = VERIFY_BY.get(src.get(iid, "anthropic"), ("openai", "gpt-5-mini"))
            by_verifier.setdefault((vprov, vmodel), {})[iid] = (
                by_id[iid]["text"]
                + (" || ROLE FACTS THE REWRITE MAY USE: " + by_id[iid]["context"]
                   if by_id[iid].get("context") else "")
                + (" || KERNEL FACTS THE REWRITE MAY USE: " + facts[:1500] if facts else ""),
                accepted[iid])
        for (vprov, vmodel), pairs in by_verifier.items():
            vetoed = verify_no_new_claims(pairs, provider=vprov, model=vmodel)
            for k, what in vetoed.items():
                failed[k] = "the rewrite asserted a NEW claim not present in the original — " + what
                accepted.pop(k, None)
    return accepted, failed

def verify_no_new_claims(pairs, provider="anthropic", model=LLM_MODEL):
    """pairs: {id: (old_plus_allowed_context, new)}. Returns {id: reason} for
    rewrites asserting anything the original + allowed facts do not state or
    directly imply. Fails CLOSED for items the verifier flags, OPEN for a
    broken verifier call (the length and number/acronym gates still hold).
    `provider` is chosen CROSS-FAMILY from the writer (VERIFY_BY)."""
    sys_p = ("You are a strict fact auditor for CV lines. For each pair decide whether NEW "
             "asserts any fact, scope, outcome, or qualifier that OLD (including any "
             "'FACTS THE REWRITE MAY USE' blocks inside it) does not state or directly "
             "imply. Elaborating a term already present (naming what a cited standard "
             "covers, unpacking an abbreviation) is OK, and so is content grounded in the "
             "provided FACTS blocks. New commercial outcomes, quantities, scopes, "
             "audiences, or achievements are NOT. Return ONLY JSON: "
             "{\"items\":[{\"id\":\"...\",\"new_claim\":false}|{\"id\":\"...\",\"new_claim\":true,\"what\":\"...\"}]}")
    asks = [{"id": k, "old": o, "new": n} for k, (o, n) in pairs.items()]
    try:
        text = _post_llm(provider, model, sys_p,
                         json.dumps({"items": asks}, ensure_ascii=False),
                         max_tokens=1400, timeout=90)
        m = re.search(r"\{.*\}", text, re.S)
        out = json.loads(m.group(0)) if m else {}
    except Exception as e:
        print(f"   [density] claim-verify ({provider}) unavailable ({str(e)[:60]}) — keeping gated rewrites")
        return {}
    return {row["id"]: str(row.get("what") or "unspecified")
            for row in out.get("items") or []
            if row.get("new_claim") and row.get("id") in pairs}

# ── section-store write-back (text-verified, never index-trusted) ────────────
def _iter_texts(node, path=()):
    """Yield (path, holder, key, text) for every rewritable string in sections."""
    if isinstance(node, dict):
        for k, v in node.items():
            if isinstance(v, str) and k in ("t", "v", "content", "results"):
                yield (path + (k,), node, k, v)
            elif isinstance(v, (dict, list)):
                yield from _iter_texts(v, path + (k,))
    elif isinstance(node, list):
        for i, v in enumerate(node):
            if isinstance(v, str):
                yield (path + (i,), node, i, v)
            elif isinstance(v, (dict, list)):
                yield from _iter_texts(v, path + (i,))

_FIXTURE_BACKED_UP = False

def write_back_fixture(old_norm, new_text):
    """Owner-approved MILD pin-source edit (2026-07-13): when an item's payload
    text is sourced from the export-settings fixture (antcv:outcomesGuard /
    antcv:resultsOverride and friends) a cv_sections write is a no-op — apply
    the SAME gated rewrite to the fixture string instead. Unique-match only,
    whitespace/NBSP-tolerant, JSON-validated after the splice, one .bak backup
    per run. Returns True when exactly one site changed."""
    global _FIXTURE_BACKED_UP
    if '"' in new_text or "\\" in new_text:
        return False                       # never risk breaking the JSON string
    path = MD._gen_runner()._EXPORT_SETTINGS
    try:
        raw = open(path, encoding="utf-8").read()
    except Exception:
        return False
    pat = re.compile("[\\s ]+".join(re.escape(w) for w in old_norm.split(" ")))
    hits = list(pat.finditer(raw))
    if len(hits) != 1:
        return False
    new_raw = raw[:hits[0].start()] + new_text + raw[hits[0].end():]
    try:
        json.loads(new_raw)                # the fixture must stay valid JSON
    except Exception:
        return False
    if not _FIXTURE_BACKED_UP:
        try:
            import shutil
            shutil.copyfile(path, path + ".bak")
        except Exception:
            pass
        _FIXTURE_BACKED_UP = True
    open(path, "w", encoding="utf-8").write(new_raw)
    return True

def write_back(sections_root, measured_text, new_text):
    """Find measured_text in the stored sections by normalised equality (or a
    unique lead-in split 'B t' -> item {b:B, t:t}) and replace it. Returns the
    number of sites changed (must be exactly 1 to count as applied).
    Matching is terminal-punctuation-insensitive: buildPayload may add or drop
    a trailing period relative to the stored text."""
    def _cmp(s):
        return _norm(s).rstrip(".")
    tgt = _cmp(measured_text)
    hits = []
    for path, holder, key, text in _iter_texts(sections_root):
        cand = _cmp(text)
        if cand == tgt:
            hits.append((holder, key, None))
        elif isinstance(holder, dict) and key == "t" and holder.get("b"):
            if _cmp(str(holder.get("b")) + " " + text) == tgt:
                hits.append((holder, key, _norm(holder.get("b"))))
    if len(hits) != 1:
        return 0
    holder, key, lead = hits[0]
    out = new_text
    if lead is not None:
        # measured text carried the bold lead-in; strip it back off
        if _norm(out).lower().startswith(lead.lower()):
            out = _norm(out)[len(lead):].lstrip(" :,-")
    holder[key] = out
    return 1

# ── the loop ─────────────────────────────────────────────────────────────────
def kernel_digest(kernel, extra=""):
    """Compact fact pool the rewrites may draw from (owner 2026-07-13:
    everything supported by the user kernel + additional information)."""
    if not kernel:
        return (extra or "")[:1500]
    gr = MD._gen_runner()
    try:
        prof = gr.compact_profile(kernel)
    except Exception:
        prof = {}
    blob = json.dumps(prof, ensure_ascii=False, separators=(",", ":"))
    out = blob[:4000]
    if extra:
        out += " || APPLICATION CONTEXT: " + _norm(extra)[:1500]
    return out

# Effort profiles (owner 2026-07-13: "fast can get a lower quality faster run").
# fast     — deterministic only (COMPACT_SUBS + clause trims), 1 render, no LLM.
# balanced — 2 iterations, FIRST candidate family only, no respace pass.
# thorough — the full loop: 4 iterations, all families, respace, pin-fix.
EFFORT = {
    "fast":     {"iters": 1, "families": 0, "respace": False},
    "balanced": {"iters": 2, "families": 1, "respace": False},
    "thorough": {"iters": MAX_ITERS, "families": len(CANDIDATE_PROVIDERS), "respace": True},
}

def fit_density(cv, cl, pi, style_config, meta, language, doc="cv",
                max_iters=None, page_budget=None, verbose=True,
                kernel_facts="", fix_pins=True, effort="thorough"):
    """Mutates cv/cl toward the QUALITY_TARGET (97.5% of measured items free of
    runt AND stretch defects). Returns (cv, cl, {'before','after','log',
    'rewrites','pinned'}) — cv/cl are the BEST state seen (never worse than
    the input)."""
    gr = MD._gen_runner()
    prof = EFFORT.get(effort, EFFORT["thorough"])
    if max_iters is None:
        max_iters = prof["iters"]
    log = []
    def _payload(cur_cv, cur_cl):
        job = {"sections": {"cv": cur_cv, "cl": cur_cl}, "personalInfo": pi,
               "styleConfig": style_config, "doc": doc, "meta": meta,
               "language": language if language in ("en", "da", "es", "zh") else "en"}
        return MD._build_doc(gr, job)

    def _measure(cur_cv, cur_cl):
        payload = _payload(cur_cv, cur_cl)
        if payload is None:
            return None, None
        pdf = MD.render_pdf(payload)
        return MD.measure(pdf, payload, style_budget=page_budget), payload

    rep, payload = _measure(cv, cl)
    if rep is None:
        return cv, cl, {"before": None, "after": None, "log": ["measure unavailable"]}
    before = rep
    best = (copy.deepcopy(cv), copy.deepcopy(cl), rep)
    root = {"cv": cv, "cl": cl}
    attempts = {}          # norm(text) -> {"n": tries, "feedback": last reason}
    rewrites = []          # applied (sec, how, old, new) for review
    pending = {}           # norm(old) -> sec : applied last round, must vanish
    pinned = []            # items whose payload text survives a section write
                           # (buildPayload sources them from fixture pins /
                           # overrides — not fixable by editing cv_sections)

    for it in range(1, max_iters + 1):
        # PIN DETECTION: an item we rewrote last round whose OLD text is still
        # in this round's measured payload was overridden upstream (fixture
        # pins, resultsOverride, export merges) — a section write is a no-op.
        # Owner-approved follow-up: apply the SAME gated rewrite to the fixture
        # pin source; only when that also fails is the item reported pinned.
        if pending:
            now = {_norm(r["text"]) for r in rep["items"]}
            for old_key, info in pending.items():
                if old_key in now:
                    if fix_pins and info.get("new") and write_back_fixture(old_key, info["new"]):
                        rewrites.append({"sec": info["sec"], "how": "pin-fix",
                                         "old": old_key, "new": info["new"]})
                        if verbose:
                            print(f"   [density] pin-fix {info['sec']}: fixture source updated")
                        continue
                    pinned.append({"sec": info["sec"], "text": old_key[:80]})
                    attempts[old_key] = {"n": 99, "feedback": "pinned upstream"}
            pending = {}
        if rep.get("quality_pct", 0) >= MD.QUALITY_TARGET:
            break
        live = lambda r: attempts.get(_norm(r["text"]), {}).get("feedback") != "pinned upstream"
        # owner-approved deterministic substitutions run FIRST — they also
        # apply to verbatim items (that is their point: pre-cleared rewordings)
        for r in rep["runts"]:
            if r["lines"] < 2 or not live(r):
                continue
            for pat, sub in COMPACT_SUBS:
                if pat in r["text"] and (len(pat) - len(sub)) >= r["trim_chars"] - 2:
                    new = r["text"].replace(pat, sub, 1)
                    if write_back(root, r["text"], new):
                        rewrites.append({"sec": r["sec"], "how": "sub", "old": r["text"], "new": new})
                        pending[_norm(r["text"])] = {"sec": r["sec"], "new": new}
                    break
        targets = [r for r in rep["runts"]
                   if r["policy"] in ("rewrite", "listedit", "reorder") and live(r)
                   and _norm(r["text"]) not in pending]
        for r in targets:
            if r["policy"] == "reorder":
                r["mode"] = "reorder"
        runt_ids = {id(r) for r in targets}
        # paragraph appeal (owner 2026-07-13): stretched-but-not-runt items go
        # through the same machinery in `respace` mode. Table cells qualify —
        # they are generated content and shrink-only synonym swaps keep the
        # one-line-per-cell rule.
        respace = [] if not prof["respace"] else \
                  [r for r in rep.get("stretched", [])
                   if id(r) not in runt_ids and live(r)
                   and (r["policy"] in ("rewrite", "listedit") or r["kind"] == "cell")]
        for r in respace:
            r["mode"] = "respace"
        targets = targets + respace
        if not targets:
            break
        cpl_of = lambda r: max(20.0, (r["trim_chars"] + r["add_hi"]) / 0.97) if r["add_hi"] else 60.0
        trims, asks, applied = [], [], 0
        for i, r in enumerate(targets):
            seen = attempts.get(_norm(r["text"]), {})
            if seen.get("n", 0) >= 2:
                continue   # two failed LLM rounds — leave it, report honestly
            # red/green split: a short dangling line pulls back deterministically;
            # everything else goes to the batched LLM re-fit, which may grow
            # (from facts in the line/role/kernel) OR tighten wording — bidirectional.
            if r.get("mode") not in ("respace", "reorder") and r["lines"] >= 2 \
               and r["trim_chars"] <= TRIM_MAX_CHARS \
               and r["sec"] not in NO_TRIM_SECTIONS:
                new = trim_text(r["text"], r["trim_chars"], cpl_of(r), language)
                if new:
                    trims.append((r, new))
                    continue
            cpl = cpl_of(r)
            # Personality-carrying sections are GROW-ONLY: an LLM shrink there
            # drops exactly the content the deliverable standards protect (the
            # team joke, "(foreningsarbejde)", accessibility phrasing).
            may_shrink = r["lines"] >= 2 and r["sec"] not in NO_TRIM_SECTIONS
            # Experience items may grow from their ROLE's real facts (owner
            # spec: "expand only from facts already in the item/app") — hand
            # the role record to both the rewriter and the claim verifier.
            context = ""
            if r["sec"] == "experience" and len(r["path"]) >= 4:
                try:
                    role = MD.get_at(payload, r["path"][:4])
                    context = (f"role: {role.get('title')} at {role.get('company')} "
                               f"({role.get('years')}); results: {role.get('results')}; "
                               f"other bullets: " + " | ".join(
                                   b for b in role.get("bullets") or [] if _norm(b) != _norm(r["text"])))
                except Exception:
                    context = ""
            ask = {"id": f"i{i}", "text": r["text"], "sec": r["sec"], "kind": r["kind"],
                   "mode": r.get("mode", "refit"),
                   "context": context,
                   "add_min": r.get("add_min", r["add_lo"]),
                   "add_lo": r["add_lo"], "add_hi": r["add_hi"],
                   "add_wrap": r.get("add_wrap", r["add_hi"] + 18),
                   # shrink band: remove the runt line without starving the new
                   # last line below ~60% (same 0.40*cpl guard as trim_text)
                   "cut_lo": r["trim_chars"] if may_shrink else 0,
                   "cut_hi": (r["trim_chars"] + int(0.35 * cpl)) if may_shrink else 0,
                   "feedback": seen.get("feedback")}
            if ask["mode"] == "respace" or ask["add_lo"] >= 2 or ask["cut_lo"] >= 2:
                asks.append(ask)
        for r, new in trims:
            n = write_back(root, r["text"], new)
            applied += n
            if n:
                rewrites.append({"sec": r["sec"], "how": "trim", "old": r["text"], "new": new})
                pending[_norm(r["text"])] = {"sec": r["sec"], "new": new}
        if asks and prof["families"] > 0:
            got, failed = llm_refit(asks, language=language, facts=kernel_facts,
                                    n_families=prof["families"])
            for ask in asks:
                new = got.get(ask["id"])
                if new and write_back(root, ask["text"], new):
                    applied += 1
                    rewrites.append({"sec": ask["sec"], "how": "llm", "old": ask["text"], "new": new})
                    pending[_norm(ask["text"])] = {"sec": ask["sec"], "new": new}
                elif new and fix_pins and write_back_fixture(_norm(ask["text"]), new):
                    # the text never existed in cv_sections — it is sourced from
                    # the fixture pins directly (owner-approved mild pin edit)
                    applied += 1
                    rewrites.append({"sec": ask["sec"], "how": "pin-fix", "old": ask["text"], "new": new})
                    if verbose:
                        print(f"   [density] pin-fix {ask['sec']}: fixture source updated")
                else:
                    key = _norm(ask["text"])
                    prev = attempts.get(key, {"n": 0})
                    reason = failed.get(ask["id"]) or \
                        ("rewrite could not be located uniquely in the "
                         "stored sections" if new else "no usable rewrite")
                    attempts[key] = {"n": prev["n"] + 1, "feedback": reason}
                    if verbose:
                        print(f"   [density] reject {ask['sec']}: {reason} …{ask['text'][-40:]}")
        log.append(f"iter {it}: runts={len(targets)} trims={len(trims)} "
                   f"llm-asks={len(asks)} applied={applied}")
        if verbose:
            print("   [density] " + log[-1])
        if applied == 0:
            # an all-rejected round still produced per-item feedback — retry
            # once more while any asked item has attempts left
            retryable = any(attempts.get(_norm(a["text"]), {}).get("n", 0) < 2 for a in asks)
            if not (asks and retryable):
                break
            continue
        rep, payload = _measure(cv, cl)
        if rep is None:
            break
        # page budget dominates; then total DEFECTS (runts + stretched = the
        # paragraph-appeal quality metric), then runts, then column balance
        def _key(rp):
            return (rp["pages"] > page_budget if page_budget else False,
                    rp.get("defect_count", rp["runt_count"]),
                    rp["rewritable_runts"], rp["runt_count"], abs(rp["max_sidebar_gap"]))
        if _key(rep) < _key(best[2]):
            best = (copy.deepcopy(cv), copy.deepcopy(cl), rep)
    final_cv, final_cl, after = best
    log.append(f"result: QUALITY {before.get('quality_pct', 0)} -> {after.get('quality_pct', 0)}% "
               f"(target {MD.QUALITY_TARGET}%), "
               f"runts {before['rewritable_runts']} -> {after['rewritable_runts']} "
               f"(all: {before['runt_count']} -> {after['runt_count']}), "
               f"stretched {len(before.get('stretched', []))} -> {len(after.get('stretched', []))}, "
               f"max sidebar gap {before['max_sidebar_gap']:.0f} -> {after['max_sidebar_gap']:.0f}px, "
               f"pages {before['pages']} -> {after['pages']}"
               + (f"; {len(pinned)} item(s) pinned upstream (fixture pins/overrides — "
                  f"not fixable via cv_sections)" if pinned else ""))
    if verbose:
        print("   [density] " + log[-1])
        for rw in rewrites:
            print(f"   [density] {rw['how']} {rw['sec']}:\n"
                  f"      - {rw['old']}\n      + {rw['new']}")
    return final_cv, final_cl, {"before": before, "after": after, "log": log,
                                "rewrites": rewrites, "pinned": pinned}

# ── CLI: fit a live application ──────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--app", type=int, required=True)
    ap.add_argument("--doc", default="cv", choices=["cv", "cl"])
    ap.add_argument("--apply", action="store_true", help="PUT fitted sections back to the relay")
    ap.add_argument("--effort", default="thorough", choices=list(EFFORT))
    ap.add_argument("--iters", type=int, default=None)
    ap.add_argument("--json", help="write before/after report JSON")
    args = ap.parse_args()

    gr = MD._gen_runner()
    c, resp = gr._req(gr.RELAY, f"/api/applications/{args.app}")
    if c != 200:
        sys.exit(f"app fetch failed: {c}")
    a = resp.get("application") or resp
    def _j(v): return json.loads(v) if isinstance(v, str) else (v or [])
    cv, cl = _j(a.get("cv_sections")), _j(a.get("cl_sections"))
    kernel = gr.load_kernel()
    pi = gr._pi_from_kernel(kernel, a.get("subtitle") or "")
    meta = {"subtitle": a.get("subtitle") or "", "role": a.get("jd_role") or "",
            "company": a.get("jd_company") or ""}
    language = a.get("jd_language") or "en"
    sc = gr._export_style_config()

    facts = kernel_digest(kernel, extra=str(a.get("supporting_context") or ""))
    cv2, cl2, out = fit_density(cv, cl, pi, sc, meta, language, doc=args.doc,
                                max_iters=args.iters, kernel_facts=facts,
                                effort=args.effort)
    if out["before"]:
        MD.print_report(out["before"], f"app {args.app} {args.doc} BEFORE")
        MD.print_report(out["after"], f"app {args.app} {args.doc} AFTER")
    if args.json:
        json.dump({k: out.get(k) for k in ("before", "after", "log", "rewrites", "pinned")},
                  open(args.json, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    if args.apply and out["after"] and out["before"] and \
       (out["after"].get("defect_count", out["after"]["runt_count"])
        < out["before"].get("defect_count", out["before"]["runt_count"])):
        c2, b2 = gr._req(gr.RELAY, f"/api/applications/{args.app}", "PUT",
                         {"cv_sections": cv2, "cl_sections": cl2})
        print(f"applied: PUT {c2}")
    elif args.apply:
        print("apply skipped: no improvement to persist")

if __name__ == "__main__":
    main()
