#!/usr/bin/env python3
"""Calibrate the PWA line-fill parity estimator (Vi / __pdfMainW) against a
ground-truth Word-COM render.

The PWA estimator (app.src.js `Vi`) lays a hidden DOM div at width `__pdfMainW`
(px, Calibri/Carlito) and counts wrapped lines to detect orphans BEFORE export.
Its accuracy hinges entirely on `__pdfMainW` matching the REAL docx-worker PDF
column. Default is a stale 466px; a ratio-aware formula (~512px @0.33) is flagged
off pending validation. This script measures the ACTUAL column from a rendered
PDF and finds the px width whose greedy-wrap (Calibri, matching the browser)
reproduces the render's per-paragraph line counts — the value to bake in.

Desktop/CI-only. Safe: reads a PDF + a font, prints a calibrated width. Never
touches production rendering.

Usage: python scripts/calibrate-linefill.py <rendered.pdf> [font_px]
"""
import sys
from PIL import ImageFont
import fitz

FONT_PATH = r"C:\Windows\Fonts\calibri.ttf"


def render_paragraphs(pdf_path):
    """Extract main-column body PARAGRAPHS (word-grouped) from the render:
    a paragraph = consecutive justified (fill~1.0) lines + one short last line.
    Returns [(text, actual_line_count, colwidth_px)] and the measured col width."""
    d = fitz.open(pdf_path)
    paras = []
    for pg in d:
        W = pg.rect.width
        words = [w for w in pg.get_text("words") if w[0] > W * 0.36]
        if not words:
            continue
        # visual lines by y-band
        lines = {}
        for w in words:
            lines.setdefault(round(w[1]), []).append(w)
        ys = sorted(lines)
        merged = []
        for y in ys:
            if merged and y - merged[-1][0] <= 3:
                merged[-1][1].extend(lines[y])
            else:
                merged.append([y, list(lines[y])])
        rmax = max(w[2] for w in words)
        lmin = min(w[0] for w in words)
        colw_pt = rmax - lmin
        # group merged lines into paragraphs: a new paragraph starts after a
        # short line (fill < 0.85) — that line ended the previous paragraph.
        cur = []
        for y, ws in merged:
            ws.sort(key=lambda w: w[0])
            s = " ".join(w[4] for w in ws).strip()
            if s.isupper() and len(s) < 40:  # heading
                if cur:
                    paras.append(cur); cur = []
                continue
            x1 = max(w[2] for w in ws)
            fill = (x1 - lmin) / colw_pt
            cur.append((s, fill))
            if fill < 0.85:  # end of a wrapped paragraph
                paras.append(cur); cur = []
        if cur:
            paras.append(cur)
    out = []
    for p in paras:
        if not p:
            continue
        text = " ".join(s for s, _ in p)
        out.append((text, len(p)))
    return out, colw_pt * 96 / 72  # width in px


def greedy_lines(text, width_px, font):
    """Replicate the browser greedy word-wrap: count lines for `text` in width_px."""
    words = text.split()
    if not words:
        return 0
    lines, cur = 0, ""
    for w in words:
        trial = (cur + " " + w).strip()
        if font.getlength(trial) <= width_px or not cur:
            cur = trial
        else:
            lines += 1
            cur = w
    return lines + (1 if cur else 0)


def main():
    pdf = sys.argv[1] if len(sys.argv) > 1 else "Trackman_CV.pdf"
    font_px = int(sys.argv[2]) if len(sys.argv) > 2 else 14  # 10.5pt
    font = ImageFont.truetype(FONT_PATH, font_px)
    paras, measured_px = render_paragraphs(pdf)
    multi = [(t, n) for t, n in paras if n >= 2 and len(t) > 40]
    print(f"rendered main-col width: {measured_px:.0f}px  |  {len(multi)} multi-line paras")
    # bullets have a padLeft (~10px) vs plain text; test a small indent offset too.
    print(f"{'width':>6} {'padL':>5} {'exact':>7} {'±1line':>7} {'mean_err':>9}")
    best = None
    for width in [456, 466, 478, 486, 492, 500, 512]:
        for padL in (0, 10, 14):
            eff = width - padL
            exact = near = 0
            errs = []
            for t, actual in multi:
                pred = greedy_lines(t, eff, font)
                errs.append(abs(pred - actual))
                if pred == actual:
                    exact += 1
                if abs(pred - actual) <= 1:
                    near += 1
            me = sum(errs) / len(errs)
            score = (exact, -me)
            if best is None or score > best[0]:
                best = (score, width, padL)
            print(f"{width:>6} {padL:>5} {exact:>7} {near:>7} {me:>9.2f}")
    print(f"\nBEST: width={best[1]}px padLeft={best[2]}  (measured render={measured_px:.0f}px)")


if __name__ == "__main__":
    main()
