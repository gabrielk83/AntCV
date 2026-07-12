#!/usr/bin/env python3
"""measure_density.py — GOLD-TARGET-LAYOUT-DENSITY-001 measurement backbone.

Extends the byte-exact render pipeline (render_payload.mjs -> docx-worker
/generate-pdf -> PyMuPDF) from page-count to LINE metrics:

  - per-item LAST-LINE FILL ratio (the runt metric: last rendered line of every
    bullet/paragraph must fill >= 60% of its column content width)
  - per-item char deltas: how many chars to ADD to reach the fill band, or to
    TRIM to pull the last line back entirely
  - sidebar bottom-gap px per page (column balance: both columns bottom out
    together)
  - page count vs the per-style page budget

Method (memory line-distribution-guidelines): PyMuPDF get_text("words"),
grouped into visual lines by y-band (justified text fragments in "dict" mode).
Every payload text item is located in the PDF by token-sequence matching, so
fill is measured on the block's OWN geometry (its justified full lines define
the true right margin).

Usage:
  python measure_density.py --app 790            # fetch app, render CV, report
  python measure_density.py --app 790 --doc cl   # cover letter
  python measure_density.py --payload p.json --pdf out.pdf   # offline pair
  python measure_density.py --app 790 --json report.json     # machine output

Importable API (used by density_fit.py and gen-runner):
  payload_for_app(app_id) / render_pdf(payload) / measure(pdf_bytes, payload)
"""
import argparse
import importlib.util
import json
import os
import re
import sys
import unicodedata
import urllib.request

_HERE = os.path.dirname(os.path.abspath(__file__))

def _gen_runner():
    """Lazy-import gen-runner.py (hyphenated name) for relay/_req/payload reuse."""
    if "gen_runner" in sys.modules:
        return sys.modules["gen_runner"]
    spec = importlib.util.spec_from_file_location("gen_runner", os.path.join(_HERE, "gen-runner.py"))
    mod = importlib.util.module_from_spec(spec)
    sys.modules["gen_runner"] = mod
    spec.loader.exec_module(mod)
    return mod

# ── thresholds (owner spec 2026-07-12 red/green screenshots) ─────────────────
RUNT_FRAC = 0.60          # last line below this fill = runt (owner threshold)
FILL_LO, FILL_HI = 0.65, 0.97  # rewrite target band for the last line
SIDEBAR_GAP_MAX = 40.0    # px (PDF pt) allowed between column bottoms per page
LINE_BAND = 3.0           # words within this y-distance are one visual line
PARA_GAP = 1.9            # vertical gap > PARA_GAP * line-height = new block

# Item policy: what the rewrite loop may do with a runt in each section.
#   rewrite  — prose; trim/lengthen via the constrained rewriter
#   listedit — comma/semicolon list; add/drop entries deterministically (data-only)
#   verbatim — names/titles/furniture; NEVER rewritten (report-only)
SECTION_POLICY = {
    "profile": "rewrite", "work_style": "rewrite", "outcomes": "rewrite",
    "experience": "rewrite", "interests": "rewrite",
    "tools": "listedit", "regulatory": "listedit", "additional": "listedit",
    "core_comp": "verbatim",   # one-line-per-cell rule, owned by the table fitter
    "certs": "verbatim", "education": "verbatim", "pubs": "verbatim",
    "recommendations": "verbatim", "languages": "verbatim",
    "accessibility": "verbatim",
    # CL prose sections
    "greeting": "verbatim", "closure": "verbatim",
    "opening": "rewrite", "why": "rewrite", "who": "rewrite",
    "foundation": "rewrite", "bring": "rewrite", "contribute": "rewrite",
}

# ── text normalisation / tokenising ──────────────────────────────────────────
_MARKERS = "▪•·◦‣–—*"

def _norm(s):
    s = unicodedata.normalize("NFKC", str(s or ""))
    s = s.replace(" ", " ")
    return re.sub(r"\s+", " ", s).strip()

def _tok(s):
    """Comparison tokens: lowercase, marker glyphs stripped, edge punct dropped."""
    out = []
    for w in _norm(s).split(" "):
        w = w.strip(_MARKERS).strip()
        w = w.strip(".,;:!?()[]\"'`")
        if w:
            out.append(w.lower())
    return out

# ── payload -> measurable items ──────────────────────────────────────────────
def collect_items(payload):
    """Flatten the worker payload into measurable text items.
    Each: {sec, path, kind, loc, text, policy}. path is a stable address into
    the payload for the rewriter (json-pointer-ish list)."""
    items = []
    def add(sec, path, kind, loc, text):
        text = _norm(text)
        if len(_tok(text)) >= 2:  # single tokens can't be located reliably
            items.append({"sec": sec["id"], "path": path, "kind": kind, "loc": loc,
                          "text": text, "policy": SECTION_POLICY.get(sec["id"], "rewrite")})
    for si, sec in enumerate(payload.get("sections") or []):
        if sec.get("on") is False:
            continue
        loc = sec.get("loc") or "main"
        t = sec.get("type")
        if t == "rich_block":
            for ii, it in enumerate(sec.get("items") or []):
                if it.get("grp"):
                    continue  # group headers = furniture
                b, tx = _norm(it.get("b")), _norm(it.get("t"))
                text = (b + " " + tx).strip() if b else tx
                kind = "bullet" if it.get("mk") or b else "para"
                add(sec, ["sections", si, "items", ii], kind, loc, text)
        elif t == "experience":
            for ri, r in enumerate(sec.get("roles") or []):
                for bi, btx in enumerate(r.get("bullets") or []):
                    add(sec, ["sections", si, "roles", ri, "bullets", bi], "bullet", loc, btx)
                if _norm(r.get("results")):
                    add(sec, ["sections", si, "roles", ri, "results"], "result", loc, r["results"])
        elif t == "labeled_list":
            for ii, it in enumerate(sec.get("items") or []):
                lab, val = _norm(it.get("l")), _norm(it.get("v"))
                add(sec, ["sections", si, "items", ii, "v"], "side_label", loc,
                    (lab + ": " + val) if lab else val)
        elif t == "table":
            for ri, row in enumerate(sec.get("rows") or []):
                if ri == 0:
                    continue  # header row
                for ci, cell in enumerate(row):
                    add(sec, ["sections", si, "rows", ri, ci], "cell", loc, cell)
        elif t in ("list_italic", "education"):
            for ii, it in enumerate(sec.get("items") or []):
                text = it if isinstance(it, str) else _norm(" ".join(_norm(v) for v in it.values() if isinstance(v, str)))
                add(sec, ["sections", si, "items", ii], "entry", loc, text)
        elif t in ("text", "text_inline"):
            add(sec, ["sections", si, "content"], "para", loc, sec.get("content"))
    return items

def get_at(payload, path):
    node = payload
    for p in path:
        node = node[p]
    return node

def set_at(payload, path, value):
    node = payload
    for p in path[:-1]:
        node = node[p]
    node[path[-1]] = value

# ── PDF geometry ─────────────────────────────────────────────────────────────
def _lines_of(words):
    """Group PyMuPDF word tuples into visual lines by y-band; sort by x."""
    lines = []
    for w in sorted(words, key=lambda w: (round(w[1] / LINE_BAND), w[0])):
        if lines and abs(w[1] - lines[-1]["y"]) <= LINE_BAND:
            lines[-1]["words"].append(w)
        else:
            lines.append({"y": w[1], "words": [w]})
    for ln in lines:
        ln["words"].sort(key=lambda w: w[0])
        ln["x0"] = min(w[0] for w in ln["words"])
        ln["x1"] = max(w[2] for w in ln["words"])
        ln["y1"] = max(w[3] for w in ln["words"])
        ln["h"] = ln["y1"] - min(w[1] for w in ln["words"])
    return lines

def _column_streams(doc, payload):
    """Split each page's words into sidebar/main columns; return per-column
    ordered token streams with line refs + per-page column extents."""
    ratio = float(payload.get("sidebar_ratio") or 0.36)
    side = ((payload.get("style") or {}).get("sidebarPosition") or "left").lower()
    W = doc[0].rect.width
    bound = W * ratio if side == "left" else W * (1 - ratio)
    cols = {"sidebar": {"tokens": [], "lines": []}, "main": {"tokens": [], "lines": []}}
    pages = []
    for pno in range(doc.page_count):
        words = doc[pno].get_text("words")
        sb, mn = [], []
        for w in words:
            mid = (w[0] + w[2]) / 2
            left = mid < bound
            (sb if (left == (side == "left")) else mn).append(w)
        page = {"n": pno + 1}
        for name, ws in (("sidebar", sb), ("main", mn)):
            lines = _lines_of(ws)
            for ln in lines:
                ln["page"] = pno + 1
                ln["col"] = name
            cols[name]["lines"].extend(lines)
            page[name] = lines
        pages.append(page)
    # token streams in reading order (page, then y)
    for name, c in cols.items():
        for li, ln in enumerate(c["lines"]):
            for w in ln["words"]:
                for piece in _tok(w[4]) or [None]:
                    if piece:
                        c["tokens"].append((piece, li, w))
    return cols, pages, {"bound": bound, "side": side, "W": W, "H": doc[0].rect.height}

def _match_item(tokens, item_toks, used):
    """Find item_toks as a near-contiguous run in the column token stream.
    Tolerates hyphenation splits (stream 'laser'+'source' vs item 'laser-source'
    normalises equal after _tok) and small OCR-ish mismatches. Returns
    (start, end) stream indices or None. `used` marks consumed stream tokens so
    duplicate items (rare) match their own occurrence."""
    n, m = len(tokens), len(item_toks)
    if m == 0:
        return None
    first = item_toks[0]
    for s in range(n):
        if used[s] or tokens[s][0] != first:
            continue
        ti, si, miss = 1, s + 1, 0
        last_hit = s
        while ti < m and si < n:
            st, it = tokens[si][0], item_toks[ti]
            if st == it:
                ti += 1; last_hit = si; si += 1
            elif st + (tokens[si + 1][0] if si + 1 < n else "") == it:
                si += 2; ti += 1; last_hit = si - 1
            elif it + (item_toks[ti + 1] if ti + 1 < m else "") == st:
                si += 1; ti += 2; last_hit = si - 1
            else:
                miss += 1
                if miss > max(2, m // 8):
                    break
                # try skipping one stream token OR one item token
                if si + 1 < n and tokens[si + 1][0] == it:
                    si += 1
                else:
                    ti += 1
        if ti >= m - max(1, m // 10):  # matched (nearly) all item tokens
            return (s, last_hit)
    return None

# ── measurement ──────────────────────────────────────────────────────────────
def measure(pdf_bytes, payload, style_budget=None):
    """Measure a rendered PDF against its payload. Returns the report dict."""
    import fitz
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    items = collect_items(payload)
    cols, pages, geo = _column_streams(doc, payload)
    used = {name: [False] * len(c["tokens"]) for name, c in cols.items()}
    report = {"pages": doc.page_count, "items": [], "runts": [], "unmatched": [],
              "sidebar_gaps": [], "geometry": geo}

    for it in items:
        col = "sidebar" if it["loc"] == "sidebar" else "main"
        stream = cols[col]
        toks = _tok(it["text"])
        hit = _match_item(stream["tokens"], toks, used[col])
        if not hit:
            report["unmatched"].append({"sec": it["sec"], "text": it["text"][:60]})
            continue
        s, e = hit
        for k in range(s, e + 1):
            used[col][k] = True
        line_idx = sorted({stream["tokens"][k][1] for k in range(s, e + 1)})
        lines = [stream["lines"][li] for li in line_idx]
        last = lines[-1]
        # Block edges: left = min x0 of the block's own lines; right = the max
        # x1 across its lines (justified non-final lines reach the margin). For
        # 1-line blocks fall back to the column-wide right edge on that page.
        L = min(ln["x0"] for ln in lines)
        if len(lines) >= 2:
            R = max(ln["x1"] for ln in lines)
        else:
            same = [ln for ln in stream["lines"] if ln["page"] == last["page"]]
            R = max(ln["x1"] for ln in same) if same else last["x1"]
        width = max(R - L, 1.0)
        fill = (last["x1"] - L) / width
        # avg char width from the block's own words -> char deltas
        chars = sum(len(w[4]) for ln in lines for w in ln["words"])
        wsum = sum(w[2] - w[0] for ln in lines for w in ln["words"])
        acw = (wsum / chars) if chars else 5.0
        last_chars = sum(len(w[4]) + 1 for w in last["words"]) - 1
        m = {**{k: it[k] for k in ("sec", "path", "kind", "loc", "text", "policy")},
             "page": last["page"], "lines": len(lines), "fill": round(fill, 3),
             "add_min": max(0, int((RUNT_FRAC * width - (last["x1"] - L)) / acw) + 1),
             "add_lo": max(0, int((FILL_LO * width - (last["x1"] - L)) / acw)),
             "add_hi": max(0, int((FILL_HI * width - (last["x1"] - L)) / acw)),
             "add_wrap": max(0, int((width - (last["x1"] - L)) / acw)),
             "trim_chars": last_chars}
        report["items"].append(m)
        if fill < RUNT_FRAC and it["kind"] != "cell":
            report["runts"].append(m)

    # column balance: per page, bottom of each column's content (measured from
    # matched-item lines only, so the banner/AI-notice never skew it)
    matched_lines = {"sidebar": {}, "main": {}}
    for name in ("sidebar", "main"):
        line_used = set()
        for k, t in enumerate(cols[name]["tokens"]):
            if used[name][k]:
                line_used.add(t[1])
        for li in line_used:
            ln = cols[name]["lines"][li]
            matched_lines[name].setdefault(ln["page"], []).append(ln)
    for pg in range(1, doc.page_count + 1):
        sbot = max((ln["y1"] for ln in matched_lines["sidebar"].get(pg, [])), default=None)
        mbot = max((ln["y1"] for ln in matched_lines["main"].get(pg, [])), default=None)
        gap = (mbot - sbot) if (sbot is not None and mbot is not None) else None
        report["sidebar_gaps"].append({"page": pg, "sidebar_bottom": sbot,
                                       "main_bottom": mbot,
                                       "gap": round(gap, 1) if gap is not None else None})
    report["max_sidebar_gap"] = max((g["gap"] for g in report["sidebar_gaps"]
                                     if g["gap"] is not None), default=0.0)
    report["runt_count"] = len(report["runts"])
    report["rewritable_runts"] = len([r for r in report["runts"] if r["policy"] != "verbatim"])
    if style_budget:
        report["page_budget"] = style_budget
        report["over_budget"] = doc.page_count > style_budget
    return report

# ── render helpers (reuse gen-runner's byte-exact pipeline) ──────────────────
def render_pdf(payload, timeout=150):
    gr = _gen_runner()
    data = json.dumps(payload).encode()
    req = urllib.request.Request(gr.DOCX_WORKER + "/generate-pdf", data=data, method="POST",
                                 headers={"Content-Type": "application/json",
                                          "User-Agent": gr.UA, "Origin": gr.ORIGIN})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def payload_for_app(app_id, doc="cv"):
    """Fetch a live application and build its byte-exact worker payload."""
    gr = _gen_runner()
    c, resp = gr._req(gr.RELAY, f"/api/applications/{app_id}")
    if c != 200:
        raise RuntimeError(f"app fetch failed: {c}")
    a = resp.get("application") or resp
    def _j(v): return json.loads(v) if isinstance(v, str) else (v or [])
    cv, cl = _j(a.get("cv_sections")), _j(a.get("cl_sections"))
    kernel = gr.load_kernel()
    pi = gr._pi_from_kernel(kernel, a.get("subtitle") or "")
    meta = {"subtitle": a.get("subtitle") or "", "role": a.get("jd_role") or "",
            "company": a.get("jd_company") or ""}
    lang = a.get("jd_language") or "en"
    sc = gr._export_style_config()
    payload = gr._build_payload_exact(cv, cl, pi, sc, meta, lang)
    if payload is None:
        raise RuntimeError("byte-exact payload build unavailable (fixture/node/module)")
    if doc == "cl":
        job = {"sections": {"cv": cv, "cl": cl}, "personalInfo": pi, "styleConfig": sc,
               "doc": "cl", "meta": meta,
               "language": lang if lang in ("en", "da", "es", "zh") else "en"}
        payload = _build_doc(gr, job)
        if payload is None:
            raise RuntimeError("CL payload build failed")
    return payload, a

def _build_doc(gr, job):
    """Like gen-runner._build_payload_exact but honouring job['doc']."""
    import subprocess
    mjs = gr._docx_client_mjs()
    env = {**os.environ, "ANTCV_DOCX_CLIENT": mjs, "ANTCV_SETTINGS": gr._EXPORT_SETTINGS}
    p = subprocess.run(["node", gr._HARNESS], input=json.dumps(job).encode("utf-8"),
                       capture_output=True, timeout=60, env=env)
    if p.returncode != 0:
        print("[measure] payload build failed:", p.stderr.decode("utf-8", "replace")[:160])
        return None
    return json.loads(p.stdout.decode("utf-8"))

# ── report printing ──────────────────────────────────────────────────────────
def print_report(rep, label=""):
    print(f"── density report {label} " + "─" * max(1, 40 - len(label)))
    print(f"pages: {rep['pages']}" + (f"  (budget {rep['page_budget']}, {'OVER' if rep.get('over_budget') else 'ok'})" if rep.get("page_budget") else ""))
    print(f"items measured: {len(rep['items'])}  unmatched: {len(rep['unmatched'])}")
    print(f"runts (<{int(RUNT_FRAC*100)}% last-line fill): {rep['runt_count']}  rewritable: {rep['rewritable_runts']}")
    for r in rep["runts"]:
        tag = "" if r["policy"] != "verbatim" else " [verbatim]"
        print(f"  p{r['page']} {r['loc'][:4]:>4} {r['sec']:<12} fill={r['fill']:.2f} "
              f"lines={r['lines']} +{r['add_lo']}..{r['add_hi']}ch / -{r['trim_chars']}ch{tag}  "
              f"…{r['text'][-58:]}")
    for g in rep["sidebar_gaps"]:
        flag = " <-- GAP" if (g["gap"] is not None and abs(g["gap"]) > SIDEBAR_GAP_MAX) else ""
        gap_s = f"{g['gap']:+.0f}px" if g["gap"] is not None else "n/a"
        print(f"  page {g['page']}: sidebar ends {gap_s} above main bottom{flag}")
    if rep["unmatched"]:
        for u in rep["unmatched"][:8]:
            print(f"  unmatched: {u['sec']}: {u['text']}")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--app", type=int, help="live application id")
    ap.add_argument("--doc", default="cv", choices=["cv", "cl"])
    ap.add_argument("--payload", help="payload JSON file (offline mode)")
    ap.add_argument("--pdf", help="rendered PDF file (offline mode)")
    ap.add_argument("--json", help="write full report JSON here")
    ap.add_argument("--budget", type=float, help="page budget override")
    args = ap.parse_args()

    if args.payload and args.pdf:
        payload = json.load(open(args.payload, encoding="utf-8"))
        pdf = open(args.pdf, "rb").read()
        label = os.path.basename(args.pdf)
    elif args.app:
        payload, _a = payload_for_app(args.app, doc=args.doc)
        pdf = render_pdf(payload)
        label = f"app {args.app} {args.doc}"
    else:
        ap.error("need --app or (--payload and --pdf)")
    rep = measure(pdf, payload, style_budget=args.budget)
    print_report(rep, label)
    if args.json:
        json.dump(rep, open(args.json, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
        print("report ->", args.json)

if __name__ == "__main__":
    main()
