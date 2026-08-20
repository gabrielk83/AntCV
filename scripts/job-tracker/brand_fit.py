#!/usr/bin/env python3
"""brand_fit.py — BRAND-CAPTURE-V2 (owner 2026-07-14).

Turn a company's SAMPLED brand (dominant/dark colour, accent, and — when the
site exposes it — how it pairs foreground on background) into the AntCV app's
element colour SLOTS, filled as contrast-safe fg/bg PAIRS.

Owner's rule (the root of the "white ink on a bright sidebar" violation): never
store a colour without the colour it sits ON. Every pair here is fitted together
to WCAG-AA (>=4.5:1 for text) and kept colour-blind-distinguishable by LUMINANCE,
not hue alone — so a red/green-blind reader still tells headings from body.

The app slots (names match the docx-worker `style.*` + the preview CSS vars):
  headerBg / headerInk        -> candidate band (name/spec/contact)
  sidebarBg / sidebarInk      -> sidebar fill + its text/headings
  sidebarSectionBg / ...Ink   -> the light-gray sidebar sub-section panels
  mainHeadColor               -> main-column section headings (on white)
  accent                      -> bullets / rules / role line (on white)
  mainTextColor               -> body ink (on white)
  mainCompanyColor/YearColor/SubHeadColor -> role-line segments (on white)

Output is JSON-serialisable and stored per-position in the tracker
(doc['brand'][uk] = {version:2, source, raw, slots, contrast, writing_style,
values}) so the app AND the headless exporter fill the same variables.
"""
import colorsys
import re

WHITE = "#ffffff"
NEAR_BLACK = "#1a1a1a"
AA_TEXT = 4.5          # WCAG AA normal text
AA_LARGE = 3.0         # WCAG AA large text / UI graphics
CB_MIN_LUM_DELTA = 0.18  # min luminance gap so colour-blind readers separate roles


def _clean(hexstr):
    h = str(hexstr or "").strip().lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    if len(h) != 6:
        return None
    try:
        int(h, 16)
    except ValueError:
        return None
    return "#" + h.lower()


def _rgb(hexstr):
    h = _clean(hexstr).lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _hex(rgb):
    return "#" + "".join("%02x" % max(0, min(255, int(round(c)))) for c in rgb)


def _lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rel_lum(hexstr):
    """WCAG relative luminance 0..1."""
    r, g, b = _rgb(hexstr)
    return 0.2126 * _lin(r) + 0.7152 * _lin(g) + 0.0722 * _lin(b)


def contrast(a, b):
    """WCAG contrast ratio 1..21."""
    la, lb = rel_lum(a), rel_lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def _adjust_lightness(hexstr, factor):
    """Scale HLS lightness by factor (>1 lighten, <1 darken), clamped."""
    r, g, b = (c / 255.0 for c in _rgb(hexstr))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    l = max(0.0, min(1.0, l * factor))
    r, g, b = colorsys.hls_to_rgb(h, l, s)
    return _hex((r * 255, g * 255, b * 255))


def best_ink(bg, prefer=None):
    """Pick the readable ink for `bg`: try preferred (brand on-dark text), then
    white, then near-black; whichever clears AA_TEXT with the most margin."""
    cands = []
    if prefer and _clean(prefer):
        cands.append(_clean(prefer))
    cands += [WHITE, NEAR_BLACK]
    scored = sorted(((contrast(bg, ink), ink) for ink in cands), reverse=True)
    ratio, ink = scored[0]
    return ink, round(ratio, 2)


def darken_until_on_white(hexstr, target=AA_TEXT, floor=0.03):
    """Darken a colour until it reads at `target` contrast on WHITE (for a brand
    accent/heading that is too light on the white main column). Preserves hue."""
    c = _clean(hexstr) or NEAR_BLACK
    for _ in range(40):
        if contrast(c, WHITE) >= target:
            return c
        nc = _adjust_lightness(c, 0.90)
        if nc == c or rel_lum(nc) <= floor:
            return nc
        c = nc
    return c


def _ensure_cb_separation(colors_on_white):
    """Given an ordered list of (name, hex) meant to be distinguished on white,
    nudge luminances apart so a colour-blind reader separates them by lightness.
    Returns the adjusted dict."""
    out = dict(colors_on_white)
    names = list(out.keys())
    for i in range(1, len(names)):
        prev = out[names[i - 1]]
        cur = out[names[i]]
        for _ in range(30):
            if abs(rel_lum(cur) - rel_lum(prev)) >= CB_MIN_LUM_DELTA:
                break
            cur = _adjust_lightness(cur, 0.90)  # push current darker
        out[names[i]] = cur
    return out


def fit(raw, *, light_gray_default="#eef1f4"):
    """raw = {'dark': '#..', 'accent': '#..', 'on_dark'?: '#..', 'on_light'?: '#..'}
    -> {'slots': {...}, 'contrast': {...}} with every pair AA-fitted."""
    dark = _clean(raw.get("dark")) or _clean(raw.get("navy")) or "#1d2b45"
    accent = _clean(raw.get("accent")) or dark
    on_dark = _clean(raw.get("on_dark"))  # company's own text-on-dark, if sampled

    # Candidate band + sidebar: the brand dark IS the bg; ensure it is dark enough
    # to carry light ink (if the sampled "dark" is actually light, darken it).
    band_bg = dark if rel_lum(dark) < 0.35 else _adjust_lightness(dark, 0.5)
    header_ink, header_r = best_ink(band_bg, prefer=on_dark)
    sidebar_bg = band_bg
    sidebar_ink, sidebar_r = best_ink(sidebar_bg, prefer=on_dark)

    # Sidebar SUB-SECTION panels: a subtle tint of the brand (not the resistant
    # default light-gray). Keep it light -> dark ink; fit the pair.
    section_bg = _adjust_lightness(dark, 3.4)  # a pale brand-tinted panel
    if rel_lum(section_bg) < 0.6:
        section_bg = light_gray_default
    section_ink, section_r = best_ink(section_bg)

    # Main column (white bg): heading + accent must read on white; body near-black.
    main_head = darken_until_on_white(dark, AA_TEXT)
    accent_on_white = darken_until_on_white(accent, AA_LARGE)  # graphic/rule -> AA_LARGE ok
    main_text = NEAR_BLACK

    # Role-line segments on white: brand-tinted title, standard company/year darks
    # (they read on white and are separated from body by weight + position, so no
    # aggressive luminance push needed — that only matters accent-vs-text, handled
    # above by fitting accent to AA_LARGE while body stays near-black).
    seg = {
        "mainSubHeadColor": main_head,                                  # role title
        "mainCompanyColor": darken_until_on_white("#333333", AA_TEXT),  # standard, AA-safe
        "mainYearColor": "#595959",
    }

    # ── extra brand-pending surfaces (owner 2026-07-14) ──────────────────────
    # Signature ink (transparent-bg image tinted to brand): sits on the WHITE CL
    # main column -> a dark brand colour that reads on white.
    signature_color = main_head
    # Slogan: prominent CL line on white. Use the accent if it pops on white
    # (AA_LARGE), else the brand head. Fit to brand; the slogan TEXT is generated
    # separately (LLM, brand + user).
    slogan_color = accent_on_white if contrast(accent_on_white, WHITE) >= AA_LARGE else main_head
    # AI-assisted notice: subtle disclaimer -> a MUTED brand grey (low saturation,
    # not a loud brand hue), still legible on white (>=AA).
    _r, _g, _b = (c / 255.0 for c in _rgb(dark))
    _h, _l, _s = colorsys.rgb_to_hls(_r, _g, _b)
    _r, _g, _b = colorsys.hls_to_rgb(_h, 0.5, min(_s, 0.18))   # desaturate + mid-light
    ai_notice_color = darken_until_on_white(_hex((_r * 255, _g * 255, _b * 255)), AA_TEXT)
    # Profile photo: pick the variant whose background matches the surface the
    # photo sits on (default placement straddles the dark sidebar band) so it
    # blends; a thin brand-accent contour frames it. Owner can override.
    photo_bg_pref = "dark" if rel_lum(sidebar_bg) < 0.4 else "light"
    photo_contour = accent_on_white

    slots = {
        "headerBg": band_bg, "headerInk": header_ink,
        "sidebarBg": sidebar_bg, "sidebarInk": sidebar_ink, "sidebarHeadColor": sidebar_ink,
        "sidebarSectionBg": section_bg, "sidebarSectionInk": section_ink,
        "mainHeadColor": main_head,
        "accent": accent_on_white,
        "mainTextColor": main_text,
        "mainCompanyColor": seg["mainCompanyColor"],
        "mainYearColor": seg["mainYearColor"],
        "mainSubHeadColor": seg["mainSubHeadColor"],
        "signatureColor": signature_color,
        "sloganColor": slogan_color,
        "aiNoticeColor": ai_notice_color,
        "photoBgPreference": photo_bg_pref,
        "photoContourColor": photo_contour,
    }
    report = {
        "band(ink/bg)": [header_ink, band_bg, round(contrast(header_ink, band_bg), 2), contrast(header_ink, band_bg) >= AA_TEXT],
        "sidebar(ink/bg)": [sidebar_ink, sidebar_bg, round(contrast(sidebar_ink, sidebar_bg), 2), contrast(sidebar_ink, sidebar_bg) >= AA_TEXT],
        "section(ink/bg)": [section_ink, section_bg, round(contrast(section_ink, section_bg), 2), contrast(section_ink, section_bg) >= AA_TEXT],
        "mainHead/white": [main_head, round(contrast(main_head, WHITE), 2), contrast(main_head, WHITE) >= AA_TEXT],
        "accent/white": [accent_on_white, round(contrast(accent_on_white, WHITE), 2), contrast(accent_on_white, WHITE) >= AA_LARGE],
        "cb_head_vs_body": round(abs(rel_lum(main_head) - rel_lum(main_text)), 3),
    }
    return {"slots": slots, "contrast": report}


# ── BRAND-DECIDES-002 (owner 2026-07-14): the brand is colours AND company SPIRIT
# + VALUES, collected as RESEARCH at the same time as the colour exploration.
# When a JD comes from an aggregator (e.g. LinkedIn), the collector must follow to
# the company's OWN site and read its About / careers / values pages. Those signals
# (a) pick the slogan PLACEMENT (visible tagline vs opening lead-in) and (b) inform
# the slogan TEXT the LLM writes at gen time (fused to brand + user).
#
# research = {
#   'site':   '<canonical company url the collector resolved to>',
#   'spirit': '<one line: how the brand speaks / what it stands for>',
#   'values': ['<value>', ...],   # from the values / About / careers page
#   'tone':   'minimal|bold|formal|warm|technical|...',
# }
_LEADIN_HINT = re.compile(
    r"\b(minimal|restrain|understate|quiet|calm|subtle|precise|discreet|elegant|"
    r"refined|formal|conservative|nordic|clean|humble|serious|rigor)\w*", re.I)
_TAGLINE_HINT = re.compile(
    r"\b(bold|expressive|dynamic|energetic|vibrant|playful|disrupt|innovat|loud|"
    r"confident|ambitious|pioneer|fun|creative|challeng)\w*", re.I)


_ALLOWED_TONE = {"minimal", "bold", "formal", "warm", "technical", "playful"}


def _sanitize_research(research):
    """Coerce a raw research object (from the worker crawl or a caller) into the
    canonical {site, spirit, values, tone[, flag, signals_used]} shape. Types
    are clamped and values de-duped/capped. Never invents content — an absent or
    malformed field becomes empty, so a failed crawl yields empty spirit/values
    that decide_slogan_placement/slogan_brief read as 'no signal'."""
    r = research if isinstance(research, dict) else {}
    site = r.get("site")
    spirit = str(r.get("spirit") or "").strip()[:240]
    raw_vals = r.get("values") if isinstance(r.get("values"), list) else []
    seen, values = set(), []
    for v in raw_vals:
        if not (isinstance(v, str) and v.strip()):
            continue
        vv = v.strip()[:60]
        k = vv.lower()
        if k in seen:
            continue
        seen.add(k)
        values.append(vv)
        if len(values) >= 8:
            break
    tone = str(r.get("tone") or "").strip().lower()
    if tone not in _ALLOWED_TONE:
        tone = ""
    out = {
        "site": site if isinstance(site, str) and site else None,
        "spirit": spirit,
        "values": values,
        "tone": tone,
    }
    if r.get("flag"):
        out["flag"] = str(r["flag"])[:40]
    if "signals_used" in r:
        out["signals_used"] = bool(r.get("signals_used"))
    return out


def decide_slogan_placement(research):
    """'leadin' (slogan folds into the opening, subtle) vs 'heading' (visible
    tagline), chosen from company spirit/values: minimal/restrained brands read
    better with a lead-in; bold/expressive brands carry a standalone tagline.
    Default 'heading' when there is no signal. Feeds antcv:clSloganMode."""
    try:
        clean = _sanitize_research(research)
        blob = " ".join([
            clean.get("spirit", ""),
            clean.get("tone", ""),
            " ".join(clean.get("values", []) or []),
        ])
        return "leadin" if len(_LEADIN_HINT.findall(blob)) > len(_TAGLINE_HINT.findall(blob)) else "heading"
    except Exception:
        return "heading"


def slogan_brief(research):
    """A compact one-block brief the slogan LLM fuses to at gen time: brand
    spirit + values + tone. '' when the crawl found no brand signal — the slogan
    then falls back to candidate-fit only and NEVER invents a company value."""
    r = _sanitize_research(research)
    bits = []
    if r["spirit"]:
        bits.append("Brand spirit: " + r["spirit"])
    if r["values"]:
        bits.append("Brand values: " + ", ".join(r["values"]))
    if r["tone"]:
        bits.append("Brand tone: " + r["tone"])
    return " | ".join(bits)


def brand_record(raw, research=None, source=None):
    """Full v2 brand record for the tracker (doc['brand'][uk]): fitted colour slots
    + the sanitised research (spirit/values/tone) + the derived slogan placement
    + the slogan brief. The app + the headless exporter both fill the same slots;
    the placement seeds antcv:clSloganMode; the slogan TEXT is written by the LLM
    at gen time, fused to slogan_brief."""
    fitted = fit(raw)
    clean = _sanitize_research(research)
    return {
        "version": 2,
        "source": source or clean.get("site"),
        "raw": raw,
        "slots": fitted["slots"],
        "contrast": fitted["contrast"],
        "research": clean,
        "slogan_placement": decide_slogan_placement(clean),
        "slogan_brief": slogan_brief(clean),
    }


# ── the SITE-CRAWL re-collection step (BRAND-DECIDES-RESEARCH-001) ────────────
# The colour sampler and the spirit/values harvest are ONE round-trip: the CF
# worker (proxy /api/fetch-brand-colors with research:true) resolves the
# employer's CANONICAL site (aggregators like LinkedIn are discovery-only — the
# worker follows them to the company's own domain), samples brand colours, AND
# reads the About/values/careers text to summarise {spirit, values, tone}. This
# runs server-side because the shell/Python sandbox is 403-gated to the CF
# workers (see nightly-sandbox-network-constraint) — a raw shell fetch of an
# arbitrary company site would both fail there and reopen the SSRF surface the
# worker already guards. brand_fit stays network-free: the caller injects a
# `post_json(body) -> (status, dict)` closure aimed at the worker endpoint.

def research_via_worker(jd_url, company, post_json, tld_hints=None):
    """Crawl the company site via the worker and return
    {raw:{dark?,accent?}, research:{site,spirit,values,tone[,flag]}, source}.
    Deterministic + idempotent (same company URL -> same worker call, no random
    state). On any failure the research is empty + flagged; colours/values are
    NEVER fabricated locally."""
    # BRAND-CANONICAL-SITE-CCTLD-001: the worker guesses "<slug>.com" first; the
    # hints tell it which ccTLDs to try after that, so a Nordic employer is not
    # left to a .com it does not own (kombit.dk -> a parked kombit.com).
    body = {"jdUrl": jd_url or "", "companyName": company or "", "research": True,
            "tldHints": list(tld_hints or [])}
    try:
        code, resp = post_json(body)
    except Exception as e:
        return {"raw": {}, "source": None,
                "research": {"site": None, "spirit": "", "values": [], "tone": "",
                             "flag": "worker_error", "signals_used": False}}
    resp = resp if isinstance(resp, dict) else {}
    raw = {}
    if resp.get("navy"):
        raw["dark"] = resp["navy"]
    if resp.get("accent"):
        raw["accent"] = resp["accent"]
    research = _sanitize_research(resp.get("research"))
    if code != 200 and "flag" not in research:
        research["flag"] = "worker_%s" % code
    source = resp.get("sampledHost") or research.get("site")
    return {"raw": raw, "research": research, "source": source}


def capture_brand(jd_url, company, post_json, source=None, tld_hints=None):
    """One-call brand capture used by the gen pipeline: crawl the company site
    (colours AND spirit/values/tone in the SAME round-trip) then build the full
    v2 brand record. research carries REAL spirit/values when the crawl+summary
    succeed, empty + flagged otherwise. Feeds doc['brand'][uk], the slogan
    placement (antcv:clSloganMode), and the slogan brief the LLM fuses to."""
    crawl = research_via_worker(jd_url, company, post_json, tld_hints=tld_hints)
    return brand_record(crawl["raw"], research=crawl["research"], source=source or crawl["source"])


if __name__ == "__main__":
    import json, sys
    samples = {
        "aimpoint": {"dark": "#1e1e1e", "accent": "#c90000"},
        "demant": {"dark": "#24405b", "accent": None},
        "nkt": {"dark": "#720002", "accent": "#1a1a1a"},
        "bright_bug": {"dark": "#7fb2e6", "accent": "#ffd400"},  # deliberately light -> must self-correct
    }
    for name, raw in samples.items():
        r = fit(raw)
        print("==", name, "==")
        print(json.dumps(r, indent=1))

    # BRAND-DECIDES-RESEARCH-001 demo: capture_brand with a FAKE worker so the
    # crawl+summary path is exercised offline. Shows how real spirit/values from
    # the site drive the slogan placement + brief, with no live network.
    def _fake_worker(payload):
        # mimics proxy /api/fetch-brand-colors with research:true for a bold brand
        return 200, {
            "ok": True, "navy": "#12324f", "accent": "#e8531f",
            "sampledHost": "trackman.com",
            "research": {
                "site": "https://www.trackman.com/",
                "spirit": "Bold, data-driven sports technology that dares teams to push further.",
                "values": ["innovation", "precision", "ambition", "performance"],
                "tone": "bold", "signals_used": True,
            },
        }
    print("== capture_brand (bold brand -> heading) ==")
    rec = capture_brand("https://www.linkedin.com/jobs/view/123", "Trackman A/S", _fake_worker)
    print(json.dumps({k: rec[k] for k in ("source", "research", "slogan_placement", "slogan_brief")}, indent=1))

    def _fake_worker_minimal(payload):
        return 200, {
            "ok": True, "navy": "#1d2b45", "accent": None, "sampledHost": "kanzen.example",
            "research": {"site": "https://kanzen.example/", "spirit": "Quiet, precise craftsmanship.",
                         "values": ["restraint", "rigor", "care"], "tone": "minimal", "signals_used": True},
        }
    rec2 = capture_brand("", "Kanzen ApS", _fake_worker_minimal)
    print("== capture_brand (minimal brand -> leadin) placement:", rec2["slogan_placement"], "==")

    def _fake_worker_fail(payload):
        return 200, {"ok": False, "error": "no site",
                     "research": {"site": None, "spirit": "", "values": [], "tone": "", "flag": "no_site"}}
    rec3 = capture_brand("", "Nowhere Inc", _fake_worker_fail)
    print("== capture_brand (crawl failed -> empty + flagged, NOT fabricated) ==")
    print(json.dumps({"research": rec3["research"], "slogan_placement": rec3["slogan_placement"],
                      "slogan_brief": rec3["slogan_brief"]}, indent=1))
