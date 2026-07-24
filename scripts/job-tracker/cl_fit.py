#!/usr/bin/env python3
"""cl_fit.py — CL-PAGE-BUDGET-ORPHAN-001: fit a cover letter to ONE page.

gen-runner's fit_to_pages tightens the CV only; the v5 CL structure under the
copenhagen band left the sign-off block (At your service / signature) orphaned
on page 2 on every generated application (2026-07-23 full-list regen). This
module is the CL leg: measured (byte-exact render), structure-safe, gated.

Levers, safest first (the page budget is the governor — owner rule):
  A. structural — targeted generation orders each section's items by JD
     relevance, so drop the LAST non-lead item of the fullest section; never
     intro lines ending ':', never numbered/patent items, keep >=2 non-lead
     items per section;
  B. line-aware shrink — freeing chars only helps when an item crosses a line
     boundary (line-distribution-guidelines), so clear nearly-empty LAST lines:
     deterministic 1-3-word clause trims (density_fit.trim_text) first, then a
     gated LLM compression to just under the boundary (numbers + acronyms
     verbatim, no banned dashes, must actually shrink).

Acceptance is only ever the MEASURED page count. Never touches greeting /
closure (verbatim) or rich_block lead-ins in the first wave.

Module use (gen-runner persist leg):
    import cl_fit
    cl2, rep = cl_fit.fit_cl(cv, cl, pi, style_config, meta, language)

CLI (live app, PUTs only on success, base_rev-guarded):
    python cl_fit.py --app N [--apply] [--out DIR]
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
import density_fit as DF

try:
    import fitz
    _HAVE_FITZ = True
except Exception:
    _HAVE_FITZ = False

VERBATIM_IDS = {"greeting", "closure"}
CPL = 66        # linear CL column, measured from rendered blocks (~62-70 c/line)
FLIP_Y = 700    # sign-off chain fits when the p1 body ends above ~this (wk 1.14.167, post CL-BLANK-TRAIL-001)
LINE_PT = 13.8  # 10.5pt body at 1.15
_BANNED_CH = set("‐‑‒–—―−")


def _render(gr, cv, cl, pi, sc, meta, language):
    job = {"sections": {"cv": cv, "cl": cl}, "personalInfo": pi,
           "styleConfig": sc, "doc": "cl", "meta": meta,
           "language": language if language in ("en", "da", "es", "zh") else "en"}
    payload = MD._build_doc(gr, job)
    if payload is None:
        return None, None, None
    pdf = MD.render_pdf(payload)
    if not pdf:
        return None, None, None
    d = fitz.open(stream=pdf, filetype="pdf")
    body_end = 0
    for b in d[0].get_text("blocks"):
        if b[1] < 810 and b[3] < 825:
            body_end = max(body_end, b[3])
    return d.page_count, pdf, body_end


def _body_items(cl, include_leads=False):
    out = []
    for s in cl:
        if not isinstance(s, dict) or s.get("on") is False:
            continue
        if (s.get("id") or "") in VERBATIM_IDS:
            continue
        for it in (s.get("items") or []):
            if not isinstance(it, dict):
                continue
            t = str(it.get("t") or "")
            if len(t) < 80:
                continue
            if (it.get("b") == "lead") and not include_leads:
                continue
            out.append((s, it, len(t)))
    out.sort(key=lambda x: -x[2])
    return out


def _droppable(s):
    out = []
    for it in (s.get("items") or []):
        if not isinstance(it, dict) or it.get("b") == "lead":
            continue
        t = str(it.get("t") or "")
        if len(t) < 40 or t.rstrip().endswith(":") or re.search(r"\d", t):
            continue
        out.append(it)
    return out


def _llm(gr, sys_p, user):
    body = {"model": os.environ.get("ANTCV_DENSITY_MODEL", "claude-sonnet-5"),
            "max_tokens": 600, "system": sys_p, "stream": True,
            "messages": [{"role": "user", "content": user}]}
    req = urllib.request.Request(DF.PROXY + "/v1/messages", data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json", "x-provider": "anthropic",
                                          "User-Agent": gr.UA, "Origin": gr.ORIGIN,
                                          "Authorization": "Bearer " + gr._token()})
    with urllib.request.urlopen(req, timeout=180) as r:
        return DF._sse_text(r.read().decode("utf-8", "replace"))


def _llm_shrink(gr, it, language, ratio, log):
    old = str(it.get("t") or "")
    target = int(len(old) * ratio)
    sys_p = ("You compress one cover-letter passage. Keep the SAME language (%s). "
             "Keep every number and every acronym VERBATIM - none may disappear, none may be added. "
             "Do not add facts. Only plain hyphens, never em or en dashes. "
             "Return ONLY the compressed passage, no quotes, no preamble." % language)
    user = ("Compress to AT MOST %d characters (it is now %d). Keep meaning and tone, cut filler "
            "and redundancy, keep it fluent:\n%s" % (target, len(old), old))
    try:
        new = _llm(gr, sys_p, user).strip().strip('"')
    except Exception as e:
        log.append("llm error " + str(e)[:60])
        return 0
    reason = None
    if not new or len(new) > len(old) * 0.92:
        reason = "not shorter"
    elif any(c in _BANNED_CH for c in new):
        reason = "banned dash"
    elif DF._numbers(new) != DF._numbers(old):
        reason = "numbers changed"
    elif DF._acronyms(new) != DF._acronyms(old):
        reason = "acronyms changed"
    if reason:
        log.append("reject %s: %s" % (str(old)[:24], reason))
        return 0
    it["t"] = new
    return len(old) - len(new)


def fit_cl(cv, cl0, pi, sc, meta, language, max_renders=10):
    """Returns (cl, report). cl is the input object when already fitting, else a
    fitted deep copy. report: {pages, body_end, log, renders, fitted}."""
    if not _HAVE_FITZ:
        return cl0, {"fitted": False, "log": ["fitz unavailable"], "pages": None}
    gr = MD._gen_runner()
    cl = copy.deepcopy(cl0)
    pages, pdf, body_end = _render(gr, cv, cl, pi, sc, meta, language)
    if pages is None:
        return cl0, {"fitted": False, "log": ["measure unavailable"], "pages": None}
    log = ["start %dp body_end %.0f" % (pages, body_end)]
    renders = 1
    if pages == 1:
        return cl0, {"fitted": True, "pages": 1, "body_end": body_end, "log": log, "renders": renders}

    # LEVER A — drop relevance-tail items while the deficit is > ~3 lines
    drops = 0
    while pages > 1 and body_end - FLIP_Y > 3 * LINE_PT and drops < 6 and renders < max_renders:
        best = None
        for s in cl:
            if not isinstance(s, dict) or s.get("on") is False or (s.get("id") or "") in VERBATIM_IDS:
                continue
            nonlead = [it for it in (s.get("items") or []) if isinstance(it, dict) and it.get("b") != "lead"]
            dr = _droppable(s)
            if len(nonlead) <= 2 or not dr:
                continue
            if best is None or len(nonlead) > best[0]:
                best = (len(nonlead), s, dr[-1])
        if best is None:
            break
        _, s, it = best
        s["items"] = [x for x in s["items"] if x is not it]
        drops += 1
        log.append("drop %s last item: %r" % (s.get("id"), str(it.get("t"))[:60]))
        pages, pdf, body_end = _render(gr, cv, cl, pi, sc, meta, language)
        renders += 1
        log.append("-> %dp body_end %.0f" % (pages, body_end))

    # LEVER B — line-aware shrink waves
    shrunk = set()
    wave = 0
    while pages > 1 and wave < 4 and renders < max_renders:
        wave += 1
        lines_target = max(2, int((body_end - FLIP_Y) / LINE_PT + 0.999) + 1)
        freed_lines = 0
        cands = []
        for s, it, ln in _body_items(cl, include_leads=(wave > 1)):
            if id(it) in shrunk or ln < CPL:
                continue
            cands.append((ln % CPL, s, it, ln))
        cands.sort(key=lambda x: x[0])
        for last, s, it, ln in cands:
            if freed_lines >= lines_target:
                break
            shrunk.add(id(it))
            old_len = len(str(it.get("t") or ""))
            new = DF.trim_text(str(it.get("t") or ""), last + 6, CPL, language)
            if new:
                it["t"] = new
                freed_lines += 1
                log.append("trim %s: %d->%d" % (s.get("id"), old_len, len(new)))
                continue
            target = ((ln // CPL) * CPL) - 10
            ratio = target / float(ln)
            if ratio < 0.55:
                continue
            freed = _llm_shrink(gr, it, language, ratio, log)
            if freed:
                got_line = len(str(it.get("t") or "")) <= target + 6
                if got_line:
                    freed_lines += 1
                log.append("llm %s: %d->%d%s" % (s.get("id"), old_len, len(str(it.get("t"))), "" if got_line else " (partial)"))
        log.append("wave %d: ~%d lines (target %d)" % (wave, freed_lines, lines_target))
        if freed_lines == 0 and wave > 1:
            break
        pages, pdf, body_end = _render(gr, cv, cl, pi, sc, meta, language)
        renders += 1
        log.append("-> %dp body_end %.0f" % (pages, body_end))

    # CLOSING LEVER: boundary cases stall ~1 line over with every item
    # single-shot exhausted — up to 3 more structural tail drops.
    extra = 0
    while pages > 1 and extra < 3 and renders < max_renders:
        best = None
        for s in cl:
            if not isinstance(s, dict) or s.get("on") is False or (s.get("id") or "") in VERBATIM_IDS:
                continue
            nonlead = [it for it in (s.get("items") or []) if isinstance(it, dict) and it.get("b") != "lead"]
            dr = _droppable(s)
            if len(nonlead) <= 2 or not dr:
                continue
            if best is None or len(nonlead) > best[0]:
                best = (len(nonlead), s, dr[-1])
        if best is None:
            break
        _, s, it = best
        s["items"] = [x for x in s["items"] if x is not it]
        extra += 1
        log.append("closing drop %s: %r" % (s.get("id"), str(it.get("t"))[:50]))
        pages, pdf, body_end = _render(gr, cv, cl, pi, sc, meta, language)
        renders += 1
        log.append("-> %dp body_end %.0f" % (pages, body_end))

    fitted = pages == 1
    return (cl if fitted else cl0), {"fitted": fitted, "pages": pages,
                                     "body_end": body_end, "log": log,
                                     "renders": renders, "pdf": pdf if fitted else None}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--app", type=int, required=True)
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()
    gr = MD._gen_runner()
    cv, cl, pi, sc, meta, language, a = MD.job_context_for_app(args.app)
    cl2, rep = fit_cl(cv, cl, pi, sc, meta, language)
    for line in rep["log"]:
        print("   [cl-fit] " + line)
    if not rep["fitted"]:
        print("cl-fit: NOT fitted (pages=%s)" % rep.get("pages"))
        sys.exit(1)
    if args.apply and cl2 is not cl:
        c, b = gr._req(gr.RELAY, "/api/applications/%d" % args.app, "PUT",
                       {"cl_sections": cl2, "base_rev": a.get("updated_at")})
        print("apply: PUT %s" % c)
        if c == 409:
            sys.exit("409 stale (live tab?) — not applied")
    if args.out and rep.get("pdf"):
        os.makedirs(args.out, exist_ok=True)
        p = os.path.join(args.out, "%d_CL_fitted.pdf" % args.app)
        open(p, "wb").write(rep["pdf"])
        print("saved " + p)


if __name__ == "__main__":
    main()
