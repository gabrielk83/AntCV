#!/usr/bin/env python3
"""cv_fit.py — CV-3P-UNDER-STAGE4-001: fit a CV to its page budget by
COMPRESSION ONLY.

gen-runner's `fit_to_pages` is the generation-time page governor, but every one
of its levers DELETES content (sidebar rows, a whole role, bullets->2). That is
correct as a last resort during generation and wrong as a repair for an already
saved application: the owner rule for a saved CV is "compress, never wholesale
-delete". Under the taller Stage-4 header (docx-worker 1.14.165+) two saved CVs
spilled a few lines past two pages and the destructive levers would have paid
for those lines with a whole role.

This module is the non-destructive leg, built the way `cl_fit.py` is built:

  MEASURE (byte-exact render -> PyMuPDF page count + measure_density line
  metrics) -> TARGET (how many rendered LINES the main column must give back)
  -> REWRITE (line-aware: kill the cheapest last lines first) -> re-render.

Line-aware is the whole point (line-distribution-guidelines): freeing characters
only frees HEIGHT when the text stops crossing a line boundary. So candidates are
ranked by `trim_chars` — the characters sitting on the item's LAST rendered line
— ascending: the item whose last line is nearly empty is the cheapest whole line
in the document.

Levers, safest first, both compression-only:
  1. deterministic clause-boundary pull-back (`density_fit.trim_text`, 1-3 words,
     numbers + acronyms never dropped);
  2. gated LLM compression to just under the line boundary (same gates as
     cl_fit: same language, numbers verbatim, acronyms verbatim, no em/en dash,
     must actually shrink).

NOTHING is ever deleted: no item, no bullet, no role, no sidebar row. If the
budget cannot be met by compression the ORIGINAL sections are returned unchanged
and `fitted` is False — a visible failure beats a silent amputation.

Acceptance is only ever the MEASURED page count.

Module use:
    import cv_fit
    cv2, rep = cv_fit.fit_cv(cv, cl, pi, style_config, meta, language)

CLI (live app; PUTs only on success, base_rev-guarded):
    python cv_fit.py --app N [--apply] [--out DIR] [--max-pages 2]
"""
import argparse
import copy
import difflib
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import measure_density as MD
import density_fit as DF
import cl_fit as CLF

try:
    import fitz
    _HAVE_FITZ = True
except Exception:
    _HAVE_FITZ = False

# Sections whose text is protected from compression. `verbatim`/`reorder`
# policies (certs, education, pubs, languages, recommendations, accessibility,
# core_comp) already say "every word survives"; these ids are the extra
# personality/fact carriers the standing deliverable rules protect.
PROTECTED_SECTIONS = {"interests", "accessibility", "languages", "education",
                      "certs", "pubs", "recommendations", "core_comp"}
PROTECTED_POLICIES = {"verbatim", "reorder"}
LINE_PT = 13.8          # 10.5pt body at 1.15, same constant cl_fit measures with
MIN_ITEM_CHARS = 70     # shorter than this and there is no room to compress
MIN_SHRINK_RATIO = 0.62 # never ask the model for more than a ~38% cut
MULTILINE_MIN = 6       # a prose block this tall may be asked for >1 line at once
MULTILINE_KEEP = 5      # ...but never below this many lines
MAX_TRIES_PER_SITE = 2  # the LLM is sampled; one failed attempt is not a verdict
LOCATE_MIN = 0.88       # similarity floor for locating the stored source string
LOCATE_MARGIN = 0.06    # and it must beat the runner-up by this much


def _render(gr, cv, cl, pi, sc, meta, language):
    """Byte-exact render. Returns (pages, pdf_bytes, payload) or (None, None, None)."""
    job = {"sections": {"cv": cv, "cl": cl}, "personalInfo": pi,
           "styleConfig": sc, "doc": "cv", "meta": meta,
           "language": language if language in ("en", "da", "es", "zh") else "en"}
    payload = MD._build_doc(gr, job)
    if payload is None:
        return None, None, None
    pdf = MD.render_pdf(payload)
    if not pdf:
        return None, None, None
    return fitz.open(stream=pdf, filetype="pdf").page_count, pdf, payload


def _main_left(payload):
    """Left edge of the main column, from the rendered geometry the measurer
    already derives. Falls back to a conservative A4 mid-page split."""
    try:
        geo = payload["__geo_main_x0"]
        if geo:
            return float(geo)
    except Exception:
        pass
    return 200.0


def overflow_lines(pdf_bytes, max_pages):
    """Rendered LINES of main-column text sitting past the page budget, plus the
    furniture (heading + space-before) that travels with them. This is the number
    of lines the main column has to give back."""
    d = fitz.open(stream=pdf_bytes, filetype="pdf")
    if d.page_count <= max_pages:
        return 0
    # main column = the right-hand stream; take the page-2 split point as the
    # midpoint between the sidebar and main x0 clusters on an overflow page.
    xs = []
    for p in range(d.page_count):
        for b in d[p].get_text("blocks"):
            xs.append(b[0])
    xs.sort()
    split = (xs[0] + xs[-1]) / 2.0 if xs else 200.0
    n = 0
    for p in range(max_pages, d.page_count):
        for b in d[p].get_text("blocks"):
            if b[0] < split:
                continue          # sidebar remnant, does not govern the main flow
            if b[3] > 815:
                continue          # the AI-notice footer rides every page
            n += max(1, len(str(b[4]).strip().splitlines()))
    # + 2: a section heading carries its own space-before, and the last line
    # pulled up must still clear the bottom margin.
    return n + 2


def _cpl(report):
    """Characters per full line in the main column, from the measured items."""
    caps = [m["trim_chars"] + m["add_wrap"] for m in report["items"]
            if m.get("loc") != "sidebar" and (m.get("lines") or 0) >= 2
            and (m.get("trim_chars") or 0) + (m.get("add_wrap") or 0) > 20]
    if not caps:
        return 78
    caps.sort()
    return caps[len(caps) // 2]


def _candidates(report, done):
    """Main-column items that may be compressed, GENTLEST first.

    Ranking by absolute cost (the shortest last line) looks right and is wrong:
    a 90-character bullet with a 40-character tail has to give up 45% of itself
    to lose that line, and what comes back is telegraphic ("optical metrology,
    stray-light, EO"). The same line taken out of the 760-character profile
    costs it 6%. So candidates rank by RELATIVE cost - the fraction of the item
    that has to go for one rendered line to disappear - and the gentle blocks
    pay first."""
    out = []
    for m in report["items"]:
        if m.get("loc") == "sidebar":
            continue
        if m.get("policy") in PROTECTED_POLICIES or m.get("sec") in PROTECTED_SECTIONS:
            continue
        if (m.get("lines") or 0) < 2:
            continue                       # a 1-line item cannot give a line back
        text = m.get("text") or ""
        if len(text) < MIN_ITEM_CHARS or text in done:
            continue
        m["_cost"] = float((m.get("trim_chars") or 0) + 4) / max(1, len(text))
        out.append(m)
    out.sort(key=lambda m: m["_cost"])
    return out


def _stored_variants(root):
    """Every rewritable stored string, plus the lead-in-joined form the payload
    builds for a rich_block item ({b, t} -> 'B t'). Yields
    (holder, key, stored_text, compare_text, lead)."""
    for path, holder, key, text in DF._iter_texts(root):
        if not isinstance(text, str) or len(text) < 20:
            continue
        yield (holder, key, text, text, None)
        if isinstance(holder, dict) and key == "t" and holder.get("b"):
            lead = DF._norm(holder.get("b"))
            yield (holder, key, text, (lead + " " + text).strip(), lead)


def locate_stored(root, measured):
    """Find the STORED string the measured text was rendered from.

    Exact normalised equality is not enough: the app's `expTense` preference
    rewrites experience verbs inside buildPayload, so the rendered bullet
    ("Prepare decision material...") is never byte-equal to the stored one
    ("Prepared decision material..."). Match on similarity instead, and only
    accept a match that is both strong AND clearly better than the runner-up
    (ORPHAN-WRITE-VERIFY-001: an ambiguous locate is a miss, never a guess).

    Returns (holder, key, stored_text, lead) or None."""
    tgt = DF._norm(measured).rstrip(".").lower()
    ranked = []
    for holder, key, stored, cmp_text, lead in _stored_variants(root):
        cand = DF._norm(cmp_text).rstrip(".").lower()
        if cand == tgt:
            return (holder, key, stored, lead)
        ratio = difflib.SequenceMatcher(None, tgt, cand).ratio()
        ranked.append((ratio, holder, key, stored, lead))
    if not ranked:
        return None
    ranked.sort(key=lambda x: -x[0])
    best = ranked[0]
    if best[0] < LOCATE_MIN:
        return None
    site = (id(best[1]), best[2])
    runner = next((r for r in ranked[1:] if (id(r[1]), r[2]) != site), None)
    if runner and best[0] - runner[0] < LOCATE_MARGIN:
        return None
    return (best[1], best[2], best[3], best[4])


_SYS = ("You compress one CV line for a page budget. Keep the SAME language (%s). "
        "Keep every number and every acronym VERBATIM - none may disappear, none may be added. "
        "Do not add facts and do not generalise a specific one away. "
        "NEVER abbreviate a word: write 'development', not 'dev'; 'application', not 'app'. "
        "The result must read as a complete, grammatical line in the same register - "
        "never a telegraphic list of fragments. Prefer dropping one whole redundant clause "
        "over shortening every word. "
        "Only plain hyphens, never em or en dashes. "
        "Return ONLY the compressed line, no quotes, no preamble.")

_WORD = re.compile(r"[^\W\d_]{2,}", re.UNICODE)


def _abbreviated(new, original):
    """True when the rewrite bought its characters by CLIPPING words rather than
    by cutting content - 'application-level development' coming back as
    'app-level dev'. Any short new word that is a strict prefix of a word the
    original spelled out is an abbreviation, and abbreviations read as sloppy on
    a CV, so they are refused however well they fit the line."""
    orig = {w.lower() for w in _WORD.findall(original)}
    for w in _WORD.findall(new):
        lw = w.lower()
        if len(lw) > 5 or lw in orig:
            continue
        if any(o != lw and o.startswith(lw) for o in orig):
            return lw
    return None


def _invented(new, original):
    """The first CONTENT word in the rewrite that the original never used.

    "Do not add facts" is only a rule if it is mechanical. Compression is
    subtractive by definition, so any content word in the output that has no
    stem in the input is something the model brought with it - the 2026-07-26
    case was "management, suppliers, engineering, and customer-facing teams"
    coming back as "management, supplier, engineering, sales", which passed the
    number, acronym and abbreviation gates while inventing a department.
    Matched on a 4-character stem so ordinary morphology (test/tests,
    assembly/assemblies) is not flagged."""
    stems = {w.lower()[:4] for w in _WORD.findall(original)}
    for w in _WORD.findall(new):
        if len(w) < 4:
            continue                       # function words carry no fact
        if w.lower()[:4] not in stems:
            return w
    return None


def _gate(new, original, language, log):
    """cl_fit's gates - actually shorter, no em/en dash, numbers verbatim,
    acronyms verbatim, no dangling connector - plus the no-abbreviation rule.
    Returns the text or None."""
    reason = None
    abbr = None
    if not new or len(new) >= len(original):
        reason = "not shorter"
    elif any(c in CLF._BANNED_CH for c in new):
        reason = "banned dash"
    elif DF._numbers(new) != DF._numbers(original):
        reason = "numbers changed"
    elif DF._acronyms(new) != DF._acronyms(original):
        reason = "acronyms changed"
    elif DF._ends_dangling(new, language):
        reason = "dangling connector"
    else:
        abbr = _abbreviated(new, original)
        if abbr:
            reason = "abbreviated '%s'" % abbr
        else:
            inv = _invented(new, original)
            if inv:
                reason = "invented '%s'" % inv
    if reason:
        log.append("reject %r: %s" % (original[:28], reason))
        return None
    # terminal punctuation is furniture, not content - restore it rather than
    # spend a whole rewrite attempt on it
    if original.rstrip().endswith(".") and not new.rstrip().endswith("."):
        new = new.rstrip() + "."
    return new


def _llm_shrink(gr, text, language, target, log, passes=2):
    """Gated compression to at most `target` characters.

    Line-aware means the target is a LINE BOUNDARY, not a suggestion: a result
    that lands above it frees no height at all. So the ask is repeated against
    the model's own output (up to `passes`) until it clears the boundary, and
    every candidate is gated against the ORIGINAL text - so a second pass can
    never launder away a number or an acronym the first pass still carried.
    Returns the best gated candidate (even one still above target, which the
    caller counts as partial) or None."""
    best = None
    cur = text
    for _ in range(max(1, passes)):
        user = ("Compress to AT MOST %d characters (it is now %d). Keep every fact, cut filler, "
                "redundancy and hedging, keep it readable:\n%s" % (target, len(cur), cur))
        try:
            new = CLF._llm(gr, _SYS % language, user).strip().strip('"')
        except Exception as e:
            log.append("llm error " + str(e)[:60])
            break
        new = _gate(new, text, language, log)
        if not new:
            break
        best = new
        if len(new) <= target:
            break
        cur = new
    return best


def fit_cv(cv0, cl, pi, sc, meta, language, max_pages=2, max_renders=8):
    """Returns (cv, report). `cv` is the input object when it already fits, a
    compressed deep copy when the fit succeeded, and the ORIGINAL object when it
    did not (never a half-compressed CV)."""
    if not _HAVE_FITZ:
        return cv0, {"fitted": False, "pages": None, "log": ["fitz unavailable"], "renders": 0}
    gr = MD._gen_runner()
    pages, pdf, payload = _render(gr, cv0, cl, pi, sc, meta, language)
    if pages is None:
        return cv0, {"fitted": False, "pages": None, "log": ["measure unavailable"], "renders": 0}
    log = ["start %dp (budget %d)" % (pages, max_pages)]
    renders = 1
    if pages <= max_pages:
        return cv0, {"fitted": True, "pages": pages, "log": log, "renders": renders, "pdf": pdf}

    cv = copy.deepcopy(cv0)
    done = set()          # measured texts of items already rewritten or unlocatable
    tries = {}            # site -> attempts (the LLM is sampled, so one miss is not a verdict)
    wave = 0
    while pages > max_pages and wave < 4 and renders < max_renders:
        wave += 1
        report = MD.measure(pdf, payload)
        cpl = _cpl(report)
        need_lines = overflow_lines(pdf, max_pages)
        # The compression frontier gives ground wave by wave: the first pass
        # only takes the gentle cuts, and only a CV that is still over budget
        # pays a deeper one.
        floor = max(0.56, MIN_SHRINK_RATIO - 0.02 * (wave - 1))
        freed = 0
        touched = 0
        # A rewrite that frees no line is refused, so the wave keeps going past
        # it - but not without limit: cap the rewrites so a stubborn boundary
        # cannot quietly compress the whole CV.
        cap = need_lines + 3
        for m in _candidates(report, done):
            if freed >= need_lines or touched >= cap:
                break
            measured = m["text"]
            loc = locate_stored(cv, measured)
            if not loc:
                done.add(measured)
                log.append("locate miss: %r" % measured[:40])
                continue
            holder, key, stored, lead = loc
            # Track the SITE, not the text: a later wave measures the already
            # compressed string, which is a different key, and would compress
            # the same bullet twice. A site that was TRIED but produced nothing
            # is not retired - the model is sampled, and the 2026-07-26 runs
            # differed by two whole line kills between identical invocations -
            # but it is capped, so a hopeless item cannot spin the loop.
            site = (id(holder), key)
            if tries.get(site, 0) >= MAX_TRIES_PER_SITE:
                continue
            tries[site] = tries.get(site, 0) + 1
            # The rewrite operates on the STORED string (what gets persisted);
            # the measurement that sized the cut came from the rendered one.
            # When the payload joined a bold lead-in onto the text, only `t` is
            # ever rewritten - the lead-in is furniture.
            src = stored
            # How many rendered lines to ask this item for. One, normally; a
            # tall prose block may give several at once because each extra line
            # costs it only cpl/len - far gentler than taking the same lines off
            # several short bullets.
            want = 1
            lines_now = m.get("lines") or 2
            if lines_now >= MULTILINE_MIN:
                want = max(1, min(need_lines - freed, lines_now - MULTILINE_KEEP, 3))
            # chars that must go for those last line(s) to vanish
            need = (m.get("trim_chars") or 0) + (want - 1) * cpl + 4
            if need >= len(src):
                continue
            new = DF.trim_text(src, need, cpl, language) if want == 1 else None
            how = "trim"
            if not new:
                target = len(src) - need
                if target < len(src) * floor:
                    continue           # too deep a cut to stay honest
                new = _llm_shrink(gr, src, language, target, log)
                how = "llm"
            if not new:
                continue
            # A rewrite that frees no LINE is pure content churn: the CV reads
            # differently and renders identically. Refuse it (line-distribution
            # -guidelines: characters only become height at a line boundary).
            # `need` above carries +4 of slack so the ASK clears the boundary;
            # the acceptance test must not, or a rewrite that lands exactly on
            # the boundary is thrown away. Removing `trim_chars` characters is
            # by definition the last line.
            cut = len(src) - len(new)
            one = max(4, (m.get("trim_chars") or 0) - 2)
            got = 0 if cut < one else 1 + int((cut - one) // max(1, cpl))
            if got < 1:
                log.append("skip %s: -%d chars frees no line" % (m.get("sec"), cut))
                continue
            holder[key] = new
            done.add(measured)
            touched += 1
            freed += min(got, want)
            log.append("%s %s: %d->%d (-%d line%s)"
                       % (how, m.get("sec"), len(src), len(new), min(got, want),
                          "" if min(got, want) == 1 else "s"))
        log.append("wave %d: freed ~%d line(s) (target %d, floor %.2f)"
                   % (wave, freed, need_lines, floor))
        if freed == 0 and wave > 1:
            break
        pages, pdf, payload = _render(gr, cv, cl, pi, sc, meta, language)
        renders += 1
        log.append("-> %dp" % pages)
        if pages is None:
            return cv0, {"fitted": False, "pages": None, "log": log, "renders": renders}

    fitted = pages is not None and pages <= max_pages
    return (cv if fitted else cv0), {"fitted": fitted, "pages": pages, "log": log,
                                     "renders": renders, "pdf": pdf if fitted else None}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--app", type=int, required=True)
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--out", default=None)
    ap.add_argument("--max-pages", type=int, default=2)
    args = ap.parse_args()
    gr = MD._gen_runner()
    # LIVE-DATA GUARD: never rewrite the application the owner is looking at.
    code, prefs = gr._req(gr.RELAY, "/api/prefs")
    active = ((prefs or {}).get("active_application") or {}).get("id") if code == 200 else None
    if args.apply and active and int(active) == args.app:
        sys.exit("refusing to write app %d - it is the ACTIVE application" % args.app)
    cv, cl, pi, sc, meta, language, a = MD.job_context_for_app(args.app)
    cv2, rep = fit_cv(cv, cl, pi, sc, meta, language, max_pages=args.max_pages)
    for line in rep["log"]:
        print("   [cv-fit] " + line)
    if not rep["fitted"]:
        print("cv-fit: NOT fitted (pages=%s) - sections left UNCHANGED" % rep.get("pages"))
        sys.exit(1)
    if args.apply and cv2 is not cv:
        c, b = gr._req(gr.RELAY, "/api/applications/%d" % args.app, "PUT",
                       {"cv_sections": cv2, "base_rev": a.get("updated_at")})
        print("apply: PUT %s" % c)
        if c == 409:
            sys.exit("409 stale (live tab?) - not applied")
    if args.out and rep.get("pdf"):
        os.makedirs(args.out, exist_ok=True)
        p = os.path.join(args.out, "%d_CV_fitted.pdf" % args.app)
        open(p, "wb").write(rep["pdf"])
        print("saved " + p)


if __name__ == "__main__":
    main()
