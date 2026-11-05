"""NO-ORPHAN-002 export audit (owner 2026-11-05: "make sure not to have orphans - especially in tables. always, in
all antCV applications"). Port of the house generator's orphan_audit.py for AntCV exports.

Every paragraph of the DOCX is matched to its typeset lines in a PDF rendered from it. A paragraph of two or more
lines is an ORPHAN when its last line fills less than 60 % of its column (RUNT_FRAC 0.60, the owner floor) or holds
a single word. Fill is measured against the column width (the widest line on the page starting at the same left
edge), not against the paragraph's own first line, which a bind may have shortened.

    python scripts/orphan-audit.py PAYLOAD.json|FILE.docx [...] [--engine lo|word|both] [--full] [--keep DIR]

  PAYLOAD.json  an export payload; rendered with the LOCAL docx-worker (scripts/orphan-audit-render.mjs), and its
                sections tag each hit (table cell rows.R.C, marker row, bullet, cover-letter row, ...).
  FILE.docx     an exported document; hits are tagged bullet / para only.
  --engine      lo = LibreOffice, the CloudConvert PDF path (default); word = Microsoft Word via COM (Windows);
                both = report each.
  --keep DIR    keep the rendered DOCX/PDFs in DIR.

Needs PyMuPDF (pip install pymupdf) and LibreOffice (soffice on PATH, $SOFFICE, or the default install path).
Run it with plain `python` (not -I) when PyMuPDF sits in the user site. Exit code = number of orphans (max 100).
"""
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
import xml.etree.ElementTree as ET

import pymupdf

FLOOR = 0.60
HEADING_PT = 13          # display type (the name band) is not body text
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
REPO = pathlib.Path(__file__).resolve().parent.parent


def key(s):
    # letters and digits only: bullets, emoji, NBSP, U+2011 and punctuation never break the match
    return ''.join(ch for ch in str(s).lower() if ch.isalnum())


# ── payload tags ────────────────────────────────────────────────────────────────────────────────────────────────
def payload_tags(payload):
    """(key, tag) for every paragraph the payload renders; a DOCX paragraph takes the longest tag key it ends with
    (leads such as "Results:", "Hands-on:" or an emoji sit in front of the payload text)."""
    tags = []
    def add(text, tag):
        k = key(text)
        if len(k) >= 6:
            tags.append((k, tag))
    for s in payload.get('sections') or []:
        if not isinstance(s, dict):
            continue
        sid, t = s.get('id') or '?', s.get('type')
        side = 'sidebar ' if s.get('loc') == 'sidebar' else ''
        if t == 'table':
            for r, row in enumerate(s.get('rows') or []):
                for c, cell in enumerate((row or [])[:2]):
                    add(cell, '%scell %s:rows.%d.%d' % (side, sid, r, c))
        elif t == 'experience':
            for ri, role in enumerate(s.get('roles') or []):
                for bi, b in enumerate((role or {}).get('bullets') or []):
                    add(b, 'experience bullet %s:roles.%d.bullets.%d' % (sid, ri, bi))
                if (role or {}).get('results'):
                    add(role['results'], 'results %s:roles.%d.results' % (sid, ri))
        elif t == 'rich_block':
            for i, it in enumerate(s.get('items') or []):
                if isinstance(it, dict) and not it.get('grp'):
                    kind = 'marker row' if it.get('mk') else 'row'
                    add((it.get('b') or '') + ' ' + (it.get('t') or ''), '%s%s %s:items.%d' % (side, kind, sid, i))
        elif t in ('text', 'text_inline'):
            for pi, part in enumerate(re.split(r'\n{2,}', s.get('content') or '')):
                add(part, '%stext %s:content.%d' % (side, sid, pi))
        elif t == 'text_bullets':
            add(s.get('intro') or '', 'text %s:intro' % sid)
            for i, it in enumerate([x for x in (s.get('items') or []) if x]):
                add(it, '%sbullet %s:items.%d' % (side, sid, i))
            add(s.get('closing') or '', 'text %s:closing' % sid)
        elif t == 'bullets':
            for i, it in enumerate([x for x in (s.get('items') or []) if x and (isinstance(x, str) or x.get('t'))]):
                add(it if isinstance(it, str) else (it.get('b') or '') + ' ' + it.get('t'), '%sbullet %s:items.%d' % (side, sid, i))
        elif t in ('list', 'list_italic'):
            for i, it in enumerate(s.get('items') or []):
                add(it if isinstance(it, str) else (it or {}).get('text') or '', '%slist %s:items.%d' % (side, sid, i))
        elif t == 'labeled_list':
            for i, it in enumerate(s.get('items') or []):
                if isinstance(it, dict):
                    add((it.get('l') or it.get('label') or '') + ' ' + (it.get('v') or it.get('value') or ''), '%slabel %s:items.%d' % (side, sid, i))
        elif t == 'education':
            for i, it in enumerate(s.get('items') or []):
                if isinstance(it, dict):
                    add((it.get('deg') or '') + ' ' + (it.get('sch') or ''), '%seducation %s:items.%d' % (side, sid, i))
    tags.sort(key=lambda kt: -len(kt[0]))
    return tags


def tag_for(par_key, is_bullet, tags):
    for k, tag in tags:
        if par_key == k or par_key.endswith(k):
            return tag
    return 'bullet' if is_bullet else 'para'


# ── DOCX paragraphs + PDF lines ─────────────────────────────────────────────────────────────────────────────────
def docx_paragraphs(path):
    with zipfile.ZipFile(path) as z:
        root = ET.fromstring(z.read('word/document.xml'))
    out = []
    for p in root.iter(W + 'p'):
        if any(br.get(W + 'type') in (None, 'textWrapping') for br in p.iter(W + 'br')):
            continue  # an intentional line break (signature block, address) is not a wrapped paragraph
        parts = []
        for el in p.iter():
            if el.tag == W + 't':
                parts.append(el.text or '')
            elif el.tag == W + 'noBreakHyphen':
                parts.append('-')
            elif el.tag == W + 'tab':
                parts.append(' ')
        text = ''.join(parts)
        k = key(text)
        if len(k) >= 6:
            out.append((text.strip(), k, p.find('.//' + W + 'numPr') is not None))
    return out


def pdf_lines(path):
    flags = pymupdf.TEXTFLAGS_DICT & ~pymupdf.TEXT_PRESERVE_LIGATURES
    lines = []
    with pymupdf.open(str(path)) as d:
        for pno, page in enumerate(d):
            for b in page.get_text('dict', flags=flags)['blocks']:
                for ln in b.get('lines', []):
                    text = ''.join(sp['text'] for sp in ln['spans'])
                    k = key(text)
                    if k:
                        x0, y0, x1, y1 = ln['bbox']
                        lines.append(dict(page=pno, x0=x0, x1=x1, y=round((y0 + y1) / 2, 1), text=text.strip(), k=k,
                                          size=max(sp['size'] for sp in ln['spans'])))
    return lines


def match(par_key, lines, start):
    """Indices of the consecutive PDF lines whose letters spell the paragraph, searching from `start` first."""
    for i in list(range(start, len(lines))) + list(range(0, start)):
        if not par_key.startswith(lines[i]['k']):
            continue
        acc, j, got = '', i, []
        while j < len(lines) and par_key.startswith(acc + lines[j]['k']):
            acc += lines[j]['k']; got.append(j); j += 1
            if acc == par_key:
                return got
    return None


def visual_lines(idx, lines):
    """Merge PDF lines that sit on the same baseline (justified text can come out as several pieces)."""
    vis = []
    for i in idx:
        ln = lines[i]
        if vis and vis[-1]['page'] == ln['page'] and abs(vis[-1]['y'] - ln['y']) < 2:
            v = vis[-1]; v['x0'] = min(v['x0'], ln['x0']); v['x1'] = max(v['x1'], ln['x1']); v['text'] += ' ' + ln['text']
        else:
            vis.append(dict(ln))
    return vis


def column_widths(lines):
    """Widest line per (page, left edge rounded to 2 pt): the text width of each column / indent level."""
    best = {}
    for ln in lines:
        b = (ln['page'], round(ln['x0'] / 2))
        best[b] = max(best.get(b, 0), ln['x1'] - ln['x0'])
    return best


def audit(docx_path, pdf_path, tags, full=False, label=''):
    pars, lines = docx_paragraphs(docx_path), pdf_lines(pdf_path)
    cols = column_widths(lines)
    hits, unmatched, pos, checked = [], 0, 0, 0
    for text, k, is_bullet in pars:
        idx = match(k, lines, pos)
        if idx is None:
            unmatched += len(k) > 90  # long enough to wrap; short ones (headings, one-line labels) do not matter
            continue
        pos = idx[-1] + 1
        vis = visual_lines(idx, lines)
        if len(vis) < 2 or lines[idx[0]]['size'] >= HEADING_PT:
            continue  # one line, or a stacked display heading set on two lines by design
        checked += 1
        last, others = vis[-1], vis[:-1]
        own = max(o['x1'] for o in others) - last['x0']
        col = max(own, cols.get((last['page'], round(last['x0'] / 2)), 0))
        fill = (last['x1'] - last['x0']) / col if col > 0 else 1.0
        words = [w for w in re.split(r'[\s\u00a0]+', last['text']) if re.search(r'\w', w)]
        if fill < FLOOR or len(words) <= 1:
            cpl = sum(len(o['text']) for o in others) / len(others)
            hint = '+%d / -%d' % (max(1, round((0.75 - fill) * cpl)), len(last['text']) + 2)
            hits.append((tag_for(k, is_bullet, tags), fill, len(vis), last['text'], text, hint))
    for tag, fill, n, last, text, hint in hits:
        print('  ORPHAN %-44s %.2f lines=%d fix=%-9s last=%r | %s' % (tag[:44], fill, n, hint, last, text if full else text[:80]))
    kinds = {}
    for h in hits:
        kinds[h[0].split(' ')[0]] = kinds.get(h[0].split(' ')[0], 0) + 1
    print('orphan_audit %s%s orphans=%d checked=%d unmatched_long=%d %s' % (
        pathlib.Path(docx_path).name, label, len(hits), checked, unmatched,
        ' '.join('%s=%d' % kv for kv in sorted(kinds.items()))))
    return len(hits)


# ── rendering ───────────────────────────────────────────────────────────────────────────────────────────────────
def soffice():
    for c in (os.environ.get('SOFFICE'), shutil.which('soffice'), shutil.which('soffice.com'),
              r'C:\Program Files\LibreOffice\program\soffice.com', '/Applications/LibreOffice.app/Contents/MacOS/soffice'):
        if c and pathlib.Path(c).exists():
            return c
    raise SystemExit('LibreOffice not found: install it or set SOFFICE')


def to_pdf_lo(docx, outdir):
    subprocess.run([soffice(), '--headless', '--convert-to', 'pdf', '--outdir', str(outdir), str(docx)],
                   check=True, capture_output=True)
    return pathlib.Path(outdir) / (pathlib.Path(docx).stem + '.pdf')


def to_pdf_word(docx, outdir):
    pdf = pathlib.Path(outdir) / (pathlib.Path(docx).stem + '.word.pdf')
    ps = ("$w = New-Object -ComObject Word.Application; $w.Visible = $false; $w.DisplayAlerts = 0; "
          "try { $d = $w.Documents.Open('%s', $false, $true); $d.SaveAs2('%s', 17); $d.Close($false) } "
          "finally { $w.Quit(); [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($w) }") % (docx, pdf)
    # Headless Word sometimes drops the COM session on a cover letter ("remote procedure call failed", seen
    # 2026-11-05 with both the old and the new worker build) - retry before giving up.
    err = ''
    for _ in range(3):
        r = subprocess.run(['powershell', '-NoProfile', '-NonInteractive', '-Command', ps], capture_output=True, text=True)
        if r.returncode == 0 and pdf.exists():
            return pdf
        err = (r.stderr or r.stdout).strip()[:400]
    raise SystemExit('Word conversion failed: ' + err)


def main(argv):
    full = '--full' in argv
    engine, keep, files, i = 'lo', None, [], 0
    while i < len(argv):
        a = argv[i]
        if a == '--engine':
            engine = argv[i + 1]; i += 2; continue
        if a == '--keep':
            keep = argv[i + 1]; i += 2; continue
        if not a.startswith('--'):
            files.append(a)
        i += 1
    if not files or engine not in ('lo', 'word', 'both'):
        print(__doc__); return 2
    work = pathlib.Path(keep) if keep else pathlib.Path(tempfile.mkdtemp(prefix='orphan-audit-'))
    work.mkdir(parents=True, exist_ok=True)
    total = 0
    for f in files:
        src = pathlib.Path(f).resolve()
        tags = []
        if src.suffix.lower() == '.json':
            payload = json.loads(src.read_text(encoding='utf-8'))
            tags = payload_tags(payload)
            docx = work / (src.stem + '.docx')
            subprocess.run(['node', str(REPO / 'scripts' / 'orphan-audit-render.mjs'), str(src), str(docx)], check=True)
        else:
            docx = work / src.name
            if docx != src:
                shutil.copyfile(src, docx)
        if engine in ('lo', 'both'):
            total += audit(docx, to_pdf_lo(docx, work), tags, full, ' [libreoffice]')
        if engine in ('word', 'both'):
            total += audit(docx, to_pdf_word(docx, work), tags, full, ' [word]')
    if not keep:
        shutil.rmtree(work, ignore_errors=True)
    return min(total, 100)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.exit(main(sys.argv[1:]))
