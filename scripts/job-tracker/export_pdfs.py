#!/usr/bin/env python3
"""export_pdfs.py — headless CV+CL PDF export with density-era verification.

Renders each application through the byte-exact pipeline (the app's own
buildPayload -> deployed docx-worker /generate-pdf) and saves the PDFs, then
verifies each file:
  - page count (and no blank trailing page — the 2-slot split class)
  - AI notice present on the last page (owner: "pay attention to the 2 slot
    split bugfix" — notice anchoring differs on 1-slot vs 2-slot docs)
  - SIDEBAR-SPINE-VML-001: the sidebar color reaches the true page bottom
    (pixel-sampled at the sidebar's x-center a few points above the edge)

Usage:
  python export_pdfs.py --apps 807,806,805 --out "C:/Users/x/Downloads/dir"
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import measure_density as MD


def _hex_rgb(hexstr):
    h = str(hexstr or "").strip().lstrip("#")
    if len(h) != 6:
        return None
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


# BANNED-DASH-MEASURE-001: deliverable-standards §6/§7 — "measure the RENDERED
# PDF for —/–, footer/AI-notice included; ALWAYS a plain hyphen." The runner's
# sanitize_text scrubs these on persist, but a leak can still reach the page via
# skeleton furniture, a stale style fixture (clSlogan), or a pre-gate app. The
# only trustworthy check is on the rendered glyphs, so scan them here.
_BANNED_SEPARATORS = {
    0x2010: "U+2010", 0x2011: "U+2011", 0x2012: "U+2012", 0x2013: "U+2013(en-dash)",
    0x2014: "U+2014(em-dash)", 0x2015: "U+2015", 0x2212: "U+2212(minus)",
}


def scan_banned_dashes(pdf_doc):
    hits = {}
    for pno in range(pdf_doc.page_count):
        for ch in pdf_doc[pno].get_text():
            name = _BANNED_SEPARATORS.get(ord(ch))
            if name:
                hits[name] = hits.get(name, 0) + 1
    return hits


def verify_pdf(pdf_bytes, payload, doc):
    import fitz
    d = fitz.open(stream=pdf_bytes, filetype="pdf")
    out = {"pages": d.page_count, "blank_pages": [], "notice_last_page": None,
           "spine_bottom": None, "banned_dashes": scan_banned_dashes(d)}
    for pno in range(d.page_count):
        words = d[pno].get_text("words")
        if len(words) < 5:
            out["blank_pages"].append(pno + 1)
    last_text = d[d.page_count - 1].get_text()
    # notice text is localized; 'AI' survives every language currently shipped
    out["notice_last_page"] = ("AI" in last_text) or ("人工智能" in last_text)
    if doc == "cv":
        style = payload.get("style") or {}
        rgb = _hex_rgb(style.get("sidebarBg"))
        ratio = float(payload.get("sidebar_ratio") or 0.36)
        side = (style.get("sidebarPosition") or "left").lower()
        if rgb:
            pg = d[d.page_count - 1]
            W, H = pg.rect.width, pg.rect.height
            x = W * ratio / 2 if side == "left" else W - W * ratio / 2
            clip = fitz.Rect(x - 2, H - 6, x + 2, H - 2)
            pix = pg.get_pixmap(clip=clip)
            # average the sample
            n = pix.width * pix.height
            samples = [pix.pixel(i, j) for i in range(pix.width) for j in range(pix.height)]
            avg = tuple(sum(s[c] for s in samples) // n for c in range(3))
            out["spine_bottom"] = all(abs(avg[c] - rgb[c]) <= 18 for c in range(3))
            out["_spine_avg"] = avg
            out["_spine_want"] = rgb
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apps", required=True, help="comma-separated application ids")
    ap.add_argument("--out", required=True)
    ap.add_argument("--docs", default="cv,cl")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    gr = MD._gen_runner()
    rows = []
    for app_id in [int(a) for a in args.apps.split(",") if a.strip()]:
        for doc in args.docs.split(","):
            try:
                payload, a = MD.payload_for_app(app_id, doc=doc)
                pdf = MD.render_pdf(payload)
                company = str(a.get("jd_company") or "app").replace(" ", "_").replace("/", "-")[:24]
                name = f"{app_id}_{company}_{doc.upper()}.pdf"
                open(os.path.join(args.out, name), "wb").write(pdf)
                v = verify_pdf(pdf, payload, doc)
                flags = []
                if v["blank_pages"]:
                    flags.append("BLANK p" + ",".join(map(str, v["blank_pages"])))
                if not v["notice_last_page"]:
                    flags.append("NO-NOTICE")
                if doc == "cv" and v["spine_bottom"] is False:
                    flags.append(f"SPINE-GAP avg={v.get('_spine_avg')} want={v.get('_spine_want')}")
                if v["banned_dashes"]:
                    flags.append("BANNED-DASH " + ",".join(f"{k}x{n}" for k, n in v["banned_dashes"].items()))
                rows.append((app_id, doc, name, v["pages"], "OK" if not flags else "; ".join(flags)))
                print(f"{app_id} {doc}: {name}  pages={v['pages']}  {'OK' if not flags else '; '.join(flags)}")
            except Exception as e:
                rows.append((app_id, doc, "-", "-", f"FAILED {str(e)[:70]}"))
                print(f"{app_id} {doc}: FAILED {str(e)[:90]}")
    json.dump([{"app": r[0], "doc": r[1], "file": r[2], "pages": r[3], "status": r[4]} for r in rows],
              open(os.path.join(args.out, "_export_report.json"), "w", encoding="utf-8"), indent=1)
    print("report ->", os.path.join(args.out, "_export_report.json"))


if __name__ == "__main__":
    main()
