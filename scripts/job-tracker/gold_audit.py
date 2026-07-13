#!/usr/bin/env python3
"""gold_audit.py — the GOLD STANDARD LOCKER audit: assert every measurable
rule from the control site (pwa/gold-rules.json) against exported PDFs +
their live application data. Failures are named per file, never smoothed.

Usage: python gold_audit.py --apps 808,811 --dir "C:/.../exports"
"""
import argparse
import glob
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import measure_density as MD
import quality_pass as QP

G = MD.gold_rules()


def audit_app(app_id, out_dir):
    import fitz
    gr = MD._gen_runner()
    checks = {}
    c, resp = gr._req(gr.RELAY, f"/api/applications/{app_id}")
    a = resp.get("application") or resp
    def _j(v, d): return json.loads(v) if isinstance(v, str) else (v if v is not None else d)
    cv = _j(a.get("cv_sections"), [])
    lang = a.get("jd_language") or "en"
    jd = str(a.get("jd_text") or "")

    # ── data-level assertions ────────────────────────────────────────────────
    exp = next((s for s in cv if s.get("type") == "experience"), None)
    bad_results = []
    for r in (exp.get("roles") if exp else []) or []:
        res = str(r.get("results") or "")
        if res and not QP._is_outcome(res):
            bad_results.append(str(r.get("title"))[:24])
    checks["results_metric"] = "OK" if not bad_results else "FAIL: " + ",".join(bad_results)
    core = next((s for s in cv if s.get("id") == "core_comp"), None)
    n_rows = (len(core.get("rows", [])) - 1) if core else 0
    cap = int((G.get("caps") or {}).get("core_comp_data_rows", 2))
    checks["core_rows<=cap"] = "OK" if n_rows <= cap else f"FAIL: {n_rows}"
    certs = next((s for s in cv if s.get("id") == "certs"), None)
    blob = json.dumps(certs.get("items", []), ensure_ascii=False) if certs else ""
    checks["certs_no_years"] = "OK" if not re.search(r"\(?(19|20)\d{2}\)?", blob) else "FAIL"

    # ── PDF-level assertions ─────────────────────────────────────────────────
    for doc in ("cv", "cl"):
        pdfs = glob.glob(os.path.join(out_dir, f"{app_id}_*_{doc.upper()}*.pdf"))
        if not pdfs:
            checks[f"{doc}_pdf"] = "MISSING"
            continue
        d = fitz.open(pdfs[0])
        text_all = " ".join(d[p].get_text() for p in range(d.page_count))
        flat = " ".join(text_all.split())
        # banned separators on rendered glyphs
        bad_sep = [ch for ch in (G.get("typography", {}).get("banned_separators") or []) if ch in text_all]
        checks[f"{doc}_separators"] = "OK" if not bad_sep else "FAIL: " + ",".join(hex(ord(x)) for x in bad_sep)
        # notice
        checks[f"{doc}_notice"] = "OK" if ("AI" in d[d.page_count - 1].get_text() or "人工智能" in text_all) else "FAIL"
        # blank pages
        blank = [p + 1 for p in range(d.page_count) if len(d[p].get_text("words")) < 5]
        checks[f"{doc}_blank_pages"] = "OK" if not blank else f"FAIL: {blank}"
        if doc == "cv":
            p1 = d[0]
            checks["photo"] = "OK" if p1.get_images() else "FAIL"
            head = " ".join(p1.get_text().splitlines()[:4])
            checks["banner_triad"] = "OK" if "Application:" not in head else "FAIL (Application line)"
            # Danish slogan leak on non-da apps
            if lang != "da":
                checks["slogan_lang"] = "OK" if "JEG FORBINDER" not in text_all.upper() else "FAIL (Danish slogan)"
            # Koebenhavn on DK JDs
            if lang != "da" and re.search(r"denmark|danmark|copenhagen|københavn|roskilde", jd, re.I):
                checks["kobenhavn"] = "OK" if "København" in text_all else "FAIL (anglicized)"
            # header ink: glyph-core contrast on the table header word
            words = p1.get_text("words")
            fa = [w for w in words if w[4] in ("Focus", "Fokusområde", "Fokus")]
            if fa:
                x0, y0, x1, y1 = fa[0][:4]
                mat = fitz.Matrix(4, 4)
                lum = lambda c: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
                # The glyph rect holds BOTH fill and ink pixels; the strip
                # left of the word is pure fill. Ink may be lighter OR darker
                # than the fill, so contrast = the larger of (glyph max - bg)
                # and (bg - glyph min). Min-only was blind to white-on-navy
                # (its darkest glyph-rect pixel IS the fill -> delta 0).
                pix = p1.get_pixmap(matrix=mat, clip=fitz.Rect(x0, y0, x1, y1))
                lums = [lum(pix.pixel(i, j)) for i in range(pix.width) for j in range(pix.height)]
                gmin, gmax = min(lums), max(lums)
                bgp = p1.get_pixmap(matrix=mat, clip=fitz.Rect(max(0, x0 - 8), y0, x0 - 2, y1))
                bgl = [lum(bgp.pixel(i, j)) for i in range(bgp.width) for j in range(bgp.height)]
                bg = sum(bgl) / len(bgl)
                delta = max(gmax - bg, bg - gmin)
                checks["header_ink"] = "OK" if delta > 60 else f"FAIL (glyph {int(gmin)}-{int(gmax)} vs bg {int(bg)})"
            # spine to page bottom
            payload, _a2 = MD.payload_for_app(app_id, doc="cv")
            style = payload.get("style") or {}
            rgb = tuple(int(str(style.get("sidebarBg", "")).lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)) if len(str(style.get("sidebarBg", "")).lstrip("#")) == 6 else None
            if rgb:
                pg = d[d.page_count - 1]
                W, H = pg.rect.width, pg.rect.height
                ratio = float(payload.get("sidebar_ratio") or 0.36)
                side = (style.get("sidebarPosition") or "left").lower()
                x = W * ratio / 2 if side == "left" else W - W * ratio / 2
                pix2 = pg.get_pixmap(clip=fitz.Rect(x - 2, H - 6, x + 2, H - 2))
                n = pix2.width * pix2.height
                avg = tuple(sum(pix2.pixel(i, j)[k] for i in range(pix2.width) for j in range(pix2.height)) // n for k in range(3))
                checks["spine"] = "OK" if all(abs(avg[k] - rgb[k]) <= 18 for k in range(3)) else "FAIL"
            # content completeness + density quality (token audit on the file bytes)
            rep = MD.measure(open(pdfs[0], "rb").read(), payload)
            checks["content_complete"] = "OK" if not rep["unmatched"] else f"FAIL: {len(rep['unmatched'])}"
            casc = rep.get("cell_cascades", [])
            checks["cell_cascade"] = "OK" if not casc else f"FAIL: {len(casc)} cell(s)"
            checks["quality_pct"] = rep["quality_pct"]
    return checks


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apps", required=True)
    ap.add_argument("--dir", required=True)
    args = ap.parse_args()
    all_ok = True
    for app in [int(x) for x in args.apps.split(",") if x.strip()]:
        try:
            ch = audit_app(app, args.dir)
        except Exception as e:
            print(f"{app}: AUDIT ERROR {str(e)[:90]}")
            all_ok = False
            continue
        fails = {k: v for k, v in ch.items() if isinstance(v, str) and v.startswith(("FAIL", "MISSING"))}
        q = ch.get("quality_pct", "-")
        if fails:
            all_ok = False
            print(f"{app}: quality={q}%  " + "  ".join(f"{k}={v}" for k, v in fails.items()))
        else:
            print(f"{app}: quality={q}%  ALL CHECKS OK")
    print("AUDIT:", "GREEN" if all_ok else "FAILURES PRESENT")


if __name__ == "__main__":
    main()
