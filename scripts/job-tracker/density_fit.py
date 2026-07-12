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

MAX_ITERS = 3
TRIM_MAX_CHARS = 28          # a runt line short enough to pull back deterministically
# Personality-carrying sections: never trim deterministically (a clause there —
# the team joke, a work-style note — is content the standing deliverable rules
# protect). The LLM path handles them with fact gates.
NO_TRIM_SECTIONS = {"interests", "profile", "work_style", "accessibility"}
LLM_MODEL = os.environ.get("ANTCV_DENSITY_MODEL", "claude-sonnet-5")
PROXY = os.environ.get("ANTCV_PROXY", "https://cv-proxy.karp-gabriel-a.workers.dev").rstrip("/")

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
    return text

def llm_refit(items, language="en", model=LLM_MODEL):
    """items: [{id, text, sec, kind, add_lo, add_hi, cut_lo, cut_hi}] ->
    {id: new_text}. One batched call. Each item may be fixed EITHER way
    (owner's bidirectional rule: green = lengthen, red = pull back): grow by
    [add_lo, add_hi] chars from facts already present, or shrink by
    [cut_lo, cut_hi] chars by tightening wording. Anything failing the
    fact/length/banned gates is dropped (the original stays)."""
    if not items:
        return {}
    gr = MD._gen_runner()
    lang_name = {"en": "English", "da": "Danish", "es": "Spanish", "zh": "Simplified Chinese"}.get(language, "English")
    sys_p = (
        "You re-fit CV/cover-letter lines so each ends on a FULL typeset line. "
        "STRICT RULES: never invent facts, numbers, tools, employers, or claims. "
        "When growing, only elaborate what the line already states: name the mechanism or "
        "scope it implies, unpack a compressed phrase. If a budget cannot be met without "
        "inventing a new claim, return the item's text UNCHANGED instead. When shrinking, "
        "tighten wording only; drop no fact. "
        "Keep every number, proper noun, certification code, and technical "
        f"term EXACTLY. Write in {lang_name}. Never use em or en dashes; use a hyphen or comma. "
        "Avoid: spearhead, leverage, robust, passionate, committed, cutting-edge, world-class, "
        "results-driven, dynamic, innovative, synergy. "
        "Return ONLY valid JSON: {\"items\":[{\"id\":\"...\",\"text\":\"...\"}]}"
    )
    asks = []
    for it in items:
        a = {"id": it["id"], "where": f"{it['sec']} {it['kind']}", "text": it["text"]}
        if it["add_hi"] >= it["add_lo"] and it["add_lo"] >= 2:
            a["grow_by_chars"] = [it["add_lo"], it["add_hi"]]
        if it.get("cut_hi", 0) >= it.get("cut_lo", 0) and it.get("cut_lo", 0) >= 2:
            a["shrink_by_chars"] = [it["cut_lo"], it["cut_hi"]]
        if it.get("context"):
            a["verified_facts_you_may_draw_from"] = it["context"]
        if it.get("feedback"):
            a["previous_attempt_failed"] = it["feedback"]
        asks.append(a)
    user = ("Each item's text currently ends on a short dangling last line. Fix EACH item by "
            "EITHER growing its text by between grow_by_chars[0] and grow_by_chars[1] EXTRA "
            "characters OR shrinking it by between shrink_by_chars[0] and shrink_by_chars[1] "
            "characters (whichever reads better; only offered directions are allowed). The exact "
            "char budget matters: outside it the line still dangles or wraps a new short line. "
            "Same meaning, same facts.\n"
            + json.dumps({"items": asks}, ensure_ascii=False))
    body = {"model": model, "max_tokens": 3000, "stream": True, "system": sys_p,
            "messages": [{"role": "user", "content": user}]}
    req = urllib.request.Request(PROXY + "/v1/messages", data=json.dumps(body).encode(),
                                 method="POST",
                                 headers={"Content-Type": "application/json",
                                          "Authorization": "Bearer " + _token(),
                                          "x-provider": "anthropic",
                                          "Origin": gr.ORIGIN, "User-Agent": gr.UA})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            raw = r.read().decode("utf-8", "replace")
            text = _sse_text(raw) if "event-stream" in (r.headers.get("Content-Type") or "") else raw
    except Exception as e:
        print(f"   [density] lengthen call failed ({str(e)[:80]}) — trims only this round")
        return {}
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        return {}, {it["id"]: "no JSON in model reply" for it in items}
    try:
        out = json.loads(m.group(0))
    except Exception:
        return {}, {it["id"]: "unparseable model reply" for it in items}
    by_id = {it["id"]: it for it in items}
    accepted, failed = {}, {}
    for row in out.get("items") or []:
        it = by_id.get(row.get("id"))
        new = _norm(row.get("text"))
        if not it or not new:
            continue
        old = it["text"]
        delta = len(new) - len(old)
        # grow floor = clearing the 60% runt line (add_min), not the stated
        # 65% target — landing between the two already de-runts the item.
        # Ceiling = the WRAP point: growth past it spills a NEW short line and
        # the loop chases its tail (observed on 1-line sidebar labels).
        grow_cap = min(it["add_hi"] + 18, max(it.get("add_wrap", it["add_hi"] + 18) - 2, it["add_lo"]))
        grow_ok = it["add_lo"] >= 2 and (it.get("add_min", it["add_lo"]) - 2 <= delta <= grow_cap)
        shrink_ok = it.get("cut_lo", 0) >= 2 and \
            (-(it.get("cut_hi", 0) + 12) <= delta <= -(it.get("cut_lo", 0) - 2)) and \
            len(new) >= 0.45 * len(old) and not _ends_dangling(new, language)
        if not (grow_ok or shrink_ok):
            failed[it["id"]] = (f"your text changed the length by {delta:+d} chars, outside "
                                f"every allowed band — hit the char budget exactly")
            continue
        if _numbers(new) != _numbers(old) or set(_acronyms(old)) - set(_acronyms(new)):
            failed[it["id"]] = "a number or acronym was changed or lost — keep all facts verbatim"
            continue
        if gr.banned_hits(new) or "—" in new or "–" in new:
            failed[it["id"]] = "used a banned word or an em/en dash"
            continue
        accepted[it["id"]] = new
    for it in items:
        if it["id"] not in accepted and it["id"] not in failed:
            failed[it["id"]] = "no usable rewrite returned"
    # adversarial fact gate: a grown line may only ELABORATE, never CLAIM.
    # (Observed leak: "now in commercial devices" grew into "sold across
    # multiple product lines" — plausible, invented.) One batched check.
    if accepted:
        vetoed = verify_no_new_claims(
            {k: ((by_id[k]["text"] +
                  (" || VERIFIED CONTEXT THE REWRITE MAY USE: " + by_id[k]["context"]
                   if by_id[k].get("context") else "")), v)
             for k, v in accepted.items()},
            model=model)
        for k in vetoed:
            failed[k] = "the rewrite asserted a NEW claim not present in the original — " + vetoed[k]
            accepted.pop(k, None)
    return accepted, failed

def verify_no_new_claims(pairs, model=LLM_MODEL):
    """pairs: {id: (old, new)}. Returns {id: reason} for rewrites that assert
    anything the original does not state or directly imply. Fails CLOSED for
    items the verifier flags, OPEN for a broken verifier call (the length and
    number/acronym gates still hold)."""
    gr = MD._gen_runner()
    sys_p = ("You are a strict fact auditor for CV lines. For each pair decide whether NEW "
             "asserts any fact, scope, outcome, or qualifier that OLD does not state or "
             "directly imply. Elaborating a term already present (naming what a cited "
             "standard covers, unpacking an abbreviation) is OK. New commercial outcomes, "
             "quantities, scopes, audiences, or achievements are NOT. Return ONLY JSON: "
             "{\"items\":[{\"id\":\"...\",\"new_claim\":false}|{\"id\":\"...\",\"new_claim\":true,\"what\":\"...\"}]}")
    asks = [{"id": k, "old": o, "new": n} for k, (o, n) in pairs.items()]
    body = {"model": model, "max_tokens": 1200, "stream": True, "system": sys_p,
            "messages": [{"role": "user", "content": json.dumps({"items": asks}, ensure_ascii=False)}]}
    req = urllib.request.Request(PROXY + "/v1/messages", data=json.dumps(body).encode(),
                                 method="POST",
                                 headers={"Content-Type": "application/json",
                                          "Authorization": "Bearer " + _token(),
                                          "x-provider": "anthropic",
                                          "Origin": gr.ORIGIN, "User-Agent": gr.UA})
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            raw = r.read().decode("utf-8", "replace")
            text = _sse_text(raw) if "event-stream" in (r.headers.get("Content-Type") or "") else raw
        m = re.search(r"\{.*\}", text, re.S)
        out = json.loads(m.group(0)) if m else {}
    except Exception as e:
        print(f"   [density] claim-verify unavailable ({str(e)[:60]}) — keeping gated rewrites")
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
def fit_density(cv, cl, pi, style_config, meta, language, doc="cv",
                max_iters=MAX_ITERS, page_budget=None, verbose=True):
    """Mutates cv/cl toward zero rewritable runts. Returns
    (cv, cl, {'before': rep0, 'after': repN, 'log': [...]}) — cv/cl are the
    BEST state seen (never worse than the input)."""
    gr = MD._gen_runner()
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
        if pending:
            now = {_norm(r["text"]) for r in rep["items"]}
            for old_key, sec in pending.items():
                if old_key in now:
                    pinned.append({"sec": sec, "text": old_key[:80]})
                    attempts[old_key] = {"n": 99, "feedback": "pinned upstream"}
            pending = {}
        targets = [r for r in rep["runts"] if r["policy"] in ("rewrite", "listedit")
                   and attempts.get(_norm(r["text"]), {}).get("feedback") != "pinned upstream"]
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
            # (from facts already in the line) OR tighten wording — bidirectional.
            if r["lines"] >= 2 and r["trim_chars"] <= TRIM_MAX_CHARS \
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
                   "context": context,
                   "add_min": r.get("add_min", r["add_lo"]),
                   "add_lo": r["add_lo"], "add_hi": r["add_hi"],
                   "add_wrap": r.get("add_wrap", r["add_hi"] + 18),
                   # shrink band: remove the runt line without starving the new
                   # last line below ~60% (same 0.40*cpl guard as trim_text)
                   "cut_lo": r["trim_chars"] if may_shrink else 0,
                   "cut_hi": (r["trim_chars"] + int(0.35 * cpl)) if may_shrink else 0,
                   "feedback": seen.get("feedback")}
            if ask["add_lo"] >= 2 or ask["cut_lo"] >= 2:
                asks.append(ask)
        for r, new in trims:
            n = write_back(root, r["text"], new)
            applied += n
            if n:
                rewrites.append({"sec": r["sec"], "how": "trim", "old": r["text"], "new": new})
                pending[_norm(r["text"])] = r["sec"]
        if asks:
            got, failed = llm_refit(asks, language=language)
            for ask in asks:
                new = got.get(ask["id"])
                if new and write_back(root, ask["text"], new):
                    applied += 1
                    rewrites.append({"sec": ask["sec"], "how": "llm", "old": ask["text"], "new": new})
                    pending[_norm(ask["text"])] = ask["sec"]
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
            break
        rep, payload = _measure(cv, cl)
        if rep is None:
            break
        # page budget dominates: a density gain that adds a page is a loss
        def _key(rp):
            return (rp["pages"] > page_budget if page_budget else False,
                    rp["rewritable_runts"], rp["runt_count"], abs(rp["max_sidebar_gap"]))
        if _key(rep) < _key(best[2]):
            best = (copy.deepcopy(cv), copy.deepcopy(cl), rep)
    final_cv, final_cl, after = best
    log.append(f"result: runts {before['rewritable_runts']} -> {after['rewritable_runts']} "
               f"(all: {before['runt_count']} -> {after['runt_count']}), "
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
    ap.add_argument("--iters", type=int, default=MAX_ITERS)
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

    cv2, cl2, out = fit_density(cv, cl, pi, sc, meta, language, doc=args.doc,
                                max_iters=args.iters)
    if out["before"]:
        MD.print_report(out["before"], f"app {args.app} {args.doc} BEFORE")
        MD.print_report(out["after"], f"app {args.app} {args.doc} AFTER")
    if args.json:
        json.dump({k: out[k] for k in ("before", "after", "log")},
                  open(args.json, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    if args.apply and out["after"] and out["before"] and \
       out["after"]["rewritable_runts"] < out["before"]["rewritable_runts"]:
        c2, b2 = gr._req(gr.RELAY, f"/api/applications/{args.app}", "PUT",
                         {"cv_sections": cv2, "cl_sections": cl2})
        print(f"applied: PUT {c2}")
    elif args.apply:
        print("apply skipped: no improvement to persist")

if __name__ == "__main__":
    main()
