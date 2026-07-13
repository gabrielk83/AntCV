#!/usr/bin/env python3
"""quality_pass.py — PERSIST-QUALITY-001: the owner's 2026-07-13 review lessons
as ENFORCED rules, applied at gen-runner persist AND runnable as a sweep over
existing applications. No more per-application hunting: every rule fires on
every app, deterministically where possible, LLM-repaired behind the density
gates where language is needed.

Rules (each traceable to an owner report on app 808/797):
  R1 certs: strip years; rank by JD relevance; rugby/coaching/concussion
     certs rank LAST unless the JD is sports/people/community; cap the list.
  R2 education: the FVU Dansk line compresses to one short entry — full
     adult-education detail is noise on non-language roles.
  R3 sidebar one-liners: owner-specified compressions (Cultural exchange /
     Reading / Research outputs) — each at least one word shorter.
  R4 core_comp: keep the 4 highest-impact rows; repair TRUNCATED cell tails
     (the old char-cap cut mid-sentence) by trimming to the last complete
     clause; never mid-word, never a dangling connector.
  R5 results: a Results line without a NUMBER is a defect. Swap in the
     kernel's exact numeric result for the matching role when one exists;
     otherwise flag it in the report (never invent).
  R6 CL prose health: no dangling enumerations ("...optics, electronics,
     mechanical." with no closing noun), no lowercase paragraph starts,
     lead-ins inside sane length windows. Deterministic detection; LLM
     completion ONLY from kernel facts, cross-family fact-audited.

CLI:  python quality_pass.py --app N [--apply]     # one app
"""
import argparse
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import measure_density as MD
import density_fit as DF

# GOLD-RULES-SITE-001: the single control site (pwa/gold-rules.json) — caps,
# patterns and wordings read from it; module literals are fallbacks.
_G = MD.gold_rules()

_SPORT_JD = re.compile(r"sport|rugby|coach|community|idr[æa]t|club|athlet", re.I)
_RUGBY_CERT = re.compile(r"rugby|coaching|concussion", re.I)
_YEAR_SUFFIX = re.compile(r"\s*[\(,]\s*(19|20)\d{2}\s*\)?\s*$")
_NUM = re.compile(r"\d")
# RESULTS-OUTCOME-METRIC-001 (owner 2026-07-13: "7-person EO/optics team at
# the Sigma-Connectivity ODM site" is a role bullet, not a result). A Results
# line must show a CHANGE metric — a percentage, multiplier, from→to, a
# time/volume/money delta — not merely contain a digit (team sizes, years and
# site counts are descriptors).
# v2 (owner 2026-07-13, the IDF case): "100 users across 150 machines" IS a
# quantified outcome - the old change-metric whitelist rejected it. Inverted
# rule: digits QUALIFY unless every digit is descriptor-shaped (team size,
# headcount, calendar year). Pattern lives in gold-rules.json results.
_DESCRIPTOR_DIGIT = re.compile(
    (_G.get("results") or {}).get("descriptor_digit_pattern")
    or r"\d+\s*[-]?\s*(?:person|member|man|people|headcount)\b|\b(?:19|20)\d{2}\b", re.I)
# Partner/ODM names only with a strong JD signal (owner 2026-07-13: "do not
# mention Sigma-Connectivity directly if no strong signal").
_PARTNER_NAMES = [("Sigma-Connectivity", "an ODM partner"), ("Sigma Connectivity", "an ODM partner")]

def _is_outcome(text):
    t = str(text or "")
    if not _NUM.search(t):
        return False
    stripped = _DESCRIPTOR_DIGIT.sub(" ", t)
    return bool(_NUM.search(stripped))   # any NON-descriptor digit qualifies

# R3 — owner-specified compressions. SHAPE LESSON (owner caught it twice):
# interests are rich_block {b: label, t: value} SPLITS and additional is a
# labeled_list {l, v} — full-line pairs never match, so every pair here is a
# SUBSTRING of the VALUE field alone (label + URL survive around it).
LINE_COMPRESS = [tuple(p) for p in (_G.get("compressions") or [])] or [
    ("Languages, food culture and board games shared with friends",
     "Languages, food, board games"),
    ("Languages, food culture and board games", "Languages, food, board games"),
    ("Technology, society and systems thinking books and essays",
     "Technology and systems thinking"),
    ("Technology, society and systems thinking", "Technology and systems thinking"),
    ("technology, society and systems thinking", "technology and systems thinking"),
    ("Teknologi, samfund og systemtænkning", "Teknologi og systemtænkning"),
    ("Stability and calm under pressure", "Calm under pressure"),
    # owner wording 2026-07-13: keep "Details", drop "available".
    ("Details available via Google Scholar", "Details via Google Scholar"),
    ("Detaljer tilgængelige via Google Scholar", "Detaljer via Google Scholar"),
]
# R3b — the rugby interests line on a DENMARK-context application must carry
# "at Pan Idræt (foreningsarbejde)" (conditional-Danish; the fresh NVIDIA
# generation dropped it). Restored from the kernel-standard wording.
_DK_CONTEXT = re.compile(r"denmark|danmark|copenhagen|københavn|roskilde|farum|odense|aarhus|jutland", re.I)

def _restore_forening(cv, jd, language, report):
    if language != "da" and not _DK_CONTEXT.search(jd or ""):
        return
    for sec in cv:
        if sec.get("id") != "interests" or not isinstance(sec.get("items"), list):
            continue
        for it in sec["items"]:
            if not isinstance(it, dict):
                continue
            b, t = str(it.get("b", "")), str(it.get("t", ""))
            if re.search(r"rugby", b + " " + t, re.I) and "foreningsarbejde" not in (b + t) \
               and re.match(r"^Team operations\b(?! at Pan)", t):
                it["t"] = t.replace("Team operations", "Team operations at Pan Idræt (foreningsarbejde)", 1)
                report.append("interests: Pan Idræt (foreningsarbejde) restored (DK context)")
# R2 — the FVU verbosity class
_FVU = re.compile(r"FVU\s+Dansk[^.]*(?:KVUC|Voksenundervisning)[^.]*\.?(\s*Danish adult preparatory education\.?)?", re.I)
_FVU_SHORT = {"en": "FVU Dansk (KVUC), ongoing", "da": "FVU Dansk (KVUC), i gang"}

_CONNECTOR_END = re.compile(r"[,;]\s*(and|or|og|eller|med|with|across|for|und)?\s*$", re.I)


def _txt_fields(node):
    yield from DF._iter_texts(node)


def rule_certs(cv, jd, report):
    """R1: strip years, relevance-rank, rugby-class last, cap at 4."""
    sec = next((s for s in cv if s.get("id") == "certs"), None)
    if not sec or not isinstance(sec.get("items"), list):
        return
    gr = MD._gen_runner()
    jdkw = gr._jd_kw(jd or "")
    sporty = bool(_SPORT_JD.search(jd or ""))
    changed = 0
    items = []
    def _strip_year(v):
        # "(University of Toronto, 2020)" -> "(University of Toronto)";
        # "Concussion Management (2024)" -> "Concussion Management"
        n = re.sub(r",\s*(19|20)\d{2}\s*\)", ")", v)
        n = re.sub(r"\s*\(\s*(19|20)\d{2}\s*\)\s*$", "", n)
        return _YEAR_SUFFIX.sub("", n).rstrip(" ,")
    for it in sec["items"]:
        if isinstance(it, str):                       # certs are often bare strings
            new = _strip_year(it)
            if new != it:
                changed += 1
            items.append(new)
            continue
        if isinstance(it, dict) and not it.get("grp"):
            for k in ("b", "t"):
                v = it.get(k)
                if isinstance(v, str):
                    new = _strip_year(v)
                    if new != v:
                        it[k] = new
                        changed += 1
        items.append(it)
    sec["items"] = items
    reals = [(i, it) for i, it in enumerate(items)
             if isinstance(it, str) or (isinstance(it, dict) and not it.get("grp"))]
    def score(it):
        t = it if isinstance(it, str) else (str(it.get("b", "")) + " " + str(it.get("t", "")))
        s = gr._rel(t, jdkw)
        if "babok" in t.lower() and re.search(r"program|requirement|architect|business analy", jd or "", re.I):
            s += 5
        if _RUGBY_CERT.search(t) and not sporty:
            s = -1                      # rugby-class certs: last unless sports JD
        return s
    if len(reals) > 4 or any(score(it) < 0 for _, it in reals):
        ranked = sorted(reals, key=lambda x: -score(x[1]))
        keep_idx = {i for i, it in ranked[:4] if score(it) >= 0}
        # never keep BOTH rugby certs even on a sports JD unless nothing else exists
        rugby_kept = [i for i in keep_idx if _RUGBY_CERT.search(str(items[i]))]
        for extra in rugby_kept[1:]:
            keep_idx.discard(extra)
        if len(keep_idx) < len(reals):
            real_idx = {i for i, _ in reals}
            sec["items"] = [it for i, it in enumerate(items)
                            if i not in real_idx or i in keep_idx]
            report.append(f"certs: kept {len(keep_idx)}/{len(reals)} by relevance (rugby-class demoted)")
    if changed:
        report.append(f"certs: stripped years x{changed}")


def rule_education(cv, language, report):
    """R2: FVU Dansk compresses to one short entry. Education items use
    {deg, sch} keys the generic walker does not visit."""
    for sec in cv:
        if sec.get("type") != "education" or not isinstance(sec.get("items"), list):
            continue
        for it in sec["items"]:
            if not isinstance(it, dict):
                continue
            joined = str(it.get("deg", "")) + " " + str(it.get("sch", ""))
            if "FVU" in joined:
                da = language == "da"
                before = (it.get("deg"), it.get("sch"))
                if it.get("deg", "").startswith("FVU"):
                    it["deg"] = "FVU Dansk"
                if "KVUC" in str(it.get("sch", "")):
                    it["sch"] = "KVUC, i gang" if da else "KVUC, ongoing"
                # report only on ACTUAL change - idempotent re-runs were
                # logging "compressed" on every app (2026-07-13 noise)
                if (it.get("deg"), it.get("sch")) != before:
                    report.append("education: FVU line compressed")
    # generic text fields still get the regex form (rich_block variants)
    for _p, holder, key, text in list(_txt_fields({"cv": cv})):
        if isinstance(text, str) and _FVU.search(text):
            short = _FVU_SHORT.get("da" if language == "da" else "en")
            new = _FVU.sub(short, text).strip(" .")
            new = new if new.endswith(short) or short in new else short
            if new != text:
                holder[key] = new
                report.append("education: FVU line compressed")


def rule_line_compress(root, report):
    """R3: owner-specified one-liner compressions, exact-match substitutions."""
    n = 0
    for _p, holder, key, text in list(_txt_fields(root)):
        if not isinstance(text, str):
            continue
        for old, new in LINE_COMPRESS:
            if old in text:
                holder[key] = text.replace(old, new)
                text = holder[key]
                n += 1
    if n:
        report.append(f"sidebar one-liners compressed x{n}")


def _clause_complete(text):
    """Trim a truncated tail back to the last complete clause. Returns the
    repaired text or None when the text already ends cleanly."""
    t = str(text or "").rstrip()
    if not t or t[-1] in ".!?:)”\"'":
        return None
    # cut at the last strong boundary; drop a dangling connector if left
    for b in (";", ",", " - "):
        i = t.rfind(b)
        if i > len(t) * 0.5:
            cand = t[:i].rstrip(" ,;")
            if not DF._ends_dangling(cand, "en"):
                return cand + "."
    if DF._ends_dangling(t, "en"):
        words = t.split()
        return " ".join(words[:-1]).rstrip(" ,;") + "."
    return t + "."


def rule_core_comp(cv, jd, report):
    """R4: top-4 rows by relevance; truncated cell tails clause-completed."""
    sec = next((s for s in cv if s.get("id") == "core_comp"), None)
    if not sec or not isinstance(sec.get("rows"), list):
        return
    gr = MD._gen_runner()
    jdkw = gr._jd_kw(jd or "")
    rows = sec["rows"]
    # owner 2026-07-13 (NVIDIA review): "the table has 3!! rows - should have
    # been 2" — keep only the TWO highest-impact rows.
    _cap_rows = int((_G.get("caps") or {}).get("core_comp_data_rows", 2))
    if len(rows) > _cap_rows + 1:             # header + cap
        data = rows[1:]
        ranked = sorted(data, key=lambda r: -gr._rel(" ".join(map(str, r)), jdkw))
        keep = ranked[:_cap_rows]
        sec["rows"] = [rows[0]] + [r for r in data if r in keep]
        report.append(f"core_comp: rows {len(data)} -> {_cap_rows} by JD relevance")
    # owner 2026-07-13 round 2: the table must carry 3-4 rows, not 2. This is a
    # GENERATION requirement (a real competency + its expertise prose can't be
    # fabricated deterministically) — flag under-count so it is never silently
    # shipped; the fix is regenerating the table, not padding it here.
    _min_rows = int((_G.get("caps") or {}).get("core_comp_data_rows_min", 3))
    _ndata = len(sec.get("rows", [])) - 1
    if 0 < _ndata < _min_rows:
        report.append(f"core_comp: ONLY {_ndata} rows (<{_min_rows}) — NEEDS TABLE REGEN (cannot fabricate a competency)")
    # NARROW-CELL-CASCADE-001 lever 1 (persist-time, render-free). Two
    # deterministic compressions only - anything subtler is the measured
    # ladder's job (density_fit) so valid 2-line labels are never mutilated:
    #  a) strip a header-echo prefix ("Focus Area: X" under a "Focus Area"
    #     header cell is pure furniture duplication);
    #  b) past the HARD threshold (certain 3-line cascade shapes, site
    #     table_label_hard_chars) drop trailing ,/& segments down to the
    #     target cap, but keep at least 12 chars of meaning.
    _lcap = int((_G.get("caps") or {}).get("table_label_max_chars", 28))
    _lhard = int((_G.get("caps") or {}).get("table_label_hard_chars", 34))
    _lmap = {k: v for k, v in ((_G.get("compressions_labels") or {}).items()) if not k.startswith("_")}
    _hdr = str((sec["rows"][0][0] if sec["rows"] and sec["rows"][0] else "") or "").strip()
    for row in sec["rows"][1:]:
        lab = str(row[0] or "")
        newlab = _lmap.get(lab, lab)   # site synonym map first (lever 1b)
        if _hdr and newlab.lower().startswith(_hdr.lower() + ":"):
            newlab = newlab[len(_hdr) + 1:].strip()
        if len(newlab) > _lhard:
            while len(newlab) > _lcap:
                m2 = re.search(r"^(.*?)(?:\s*[,&]\s*|\s+&\s+)[^,&]+$", newlab)
                if not m2 or len(m2.group(1).strip()) < 12:
                    break
                newlab = m2.group(1).strip()
        if newlab != lab and len(newlab) >= 8:
            row[0] = newlab
            report.append(f"core_comp: label compressed '{lab[:32]}' -> '{newlab}'")
    fixed = 0
    for row in sec["rows"][1:]:
        for ci in range(1, len(row)):       # labels (c0) stay untouched
            rep = _clause_complete(row[ci])
            if rep and rep != row[ci]:
                row[ci] = rep
                fixed += 1
    if fixed:
        report.append(f"core_comp: {fixed} truncated cell tail(s) clause-completed")


def rule_results_numeric(cv, kernel, jd_text_for_partner, report, language="en"):
    """R5: Results lines must carry a number — swap in the kernel's exact
    numeric result for the role when available, else flag."""
    gr = MD._gen_runner()
    idy = gr._asdict((kernel or {}).get("identity"))
    # the kernel's numeric-outcome pool: identity.selectedOutcomes[] —
    # {role, position: "Role - Company", verb, title (metric summary), result}
    pool_entries = []
    for o in idy.get("selectedOutcomes") or []:
        if isinstance(o, dict):
            pool_entries.append({
                "role_id": str(o.get("role") or ""),
                "label": str(o.get("position") or "") + " " + str(o.get("role") or ""),
                "result": str(o.get("result") or ""),
            })
    exp = next((s for s in cv if s.get("type") == "experience"), None)
    if not exp:
        return
    def toks(s):
        return set(re.findall(r"[a-z]{3,}", str(s).lower()))
    for r in exp.get("roles") or []:
        res = str(r.get("results") or "")
        # RESULTS-OUTCOME-METRIC-001 v2: replace whenever the current line
        # lacks a qualifying metric (quantified outcome OR scope).
        if res and _is_outcome(res):
            continue
        # ID-EXACT MATCH (owner 2026-07-13: every Gabriel role HAS a kernel
        # outcome, so a miss is a matcher defect): the kernel pool's `role`
        # ids map onto role.id and merged roles' __covers (ROLE-COVERS-001).
        ids = set()
        if r.get("id"):
            ids.add(str(r["id"]))
        for cid in (r.get("__covers") or []):
            ids.add(str(cid))
        bullets_norm = {DF._norm(b).lower() for b in (r.get("bullets") or [])}
        best, bs = None, 0
        for entry in pool_entries:
            cand = entry["result"]
            if not cand or not _is_outcome(cand):
                continue
            if DF._norm(cand).lower() in bullets_norm:
                continue
            if entry["role_id"] and entry["role_id"] in ids:
                s = 100                                   # id-exact wins outright
            else:
                rt = toks(str(r.get("title", "")) + " " + str(r.get("company", "")))
                s = len(rt & toks(entry["label"])) if entry["label"] else 0
            if s > bs:
                best, bs = cand, s
        if best and bs >= 2:
            for pname, generic in _PARTNER_NAMES:
                if pname.lower() in best.lower() and pname.lower() not in (jd_text_for_partner or "").lower():
                    best = re.sub(re.escape(pname), generic, best, flags=re.I)
            r["results"] = best
            _langflag = " - NEEDS TRANSLATION (pool is en)" if language not in ("en", None, "") else ""
            report.append(f"results: outcome swap for '{str(r.get('title'))[:28]}' ({'id-exact' if bs >= 100 else 'label'}){_langflag}")
        else:
            report.append(f"results: NO METRIC, no kernel outcome match - '{str(r.get('title'))[:28]}' (MATCHER DEFECT if a kernel outcome exists)")


_DANGLING_ENUM = re.compile(r",\s*[\w&/-]+\s*,\s*[\w&/-]+\s*\.\s*$")
# never-final words from the control site (fallback = the same list inline);
# shared by the detector AND the deterministic connector-trim fallback
_NEVER_FINAL = set((_G.get("sentence_health") or {}).get("never_final_words")
                   or ["and", "or", "og", "eller", "samt", "med", "the", "a", "an",
                       "und", "from", "into", "of", "under", "across", "versus",
                       "via", "toward", "towards", "fra", "af", "mod"])

def _prose_issues(text, language):
    issues = []
    t = str(text or "").strip()
    if not t:
        return issues
    tail = t[-90:]
    if _DANGLING_ENUM.search(tail) and not re.search(r"\b(and|og|y|und|和)\b[^,]*\.\s*$", tail, re.I):
        issues.append("dangling enumeration — the final list has no closing conjunction/noun")
    if re.match(r"^[a-zæøå]", t) and not t.startswith(("i ", "iPhone")):
        issues.append("paragraph starts lowercase")
    # dangling CONJUNCTIONS/articles — and the NEVER-final prepositions
    # ("...risks identified and traceable from." is a truncation; "act on."
    # stays valid relative-clause English)
    last = t.rstrip(".!?").split()[-1].lower() if t.rstrip(".!?").split() else ""
    if last in _NEVER_FINAL and not t.rstrip().endswith(":"):
        issues.append("ends on a dangling connector/truncation")
    return issues


def rule_cl_prose(cl, cv, kernel_facts, language, report, use_llm=True):
    """R6: CL sentence health — detect deterministically, repair via one
    batched cross-family-audited LLM call (facts only from the text/kernel)."""
    targets = []
    for _p, holder, key, text in list(_txt_fields({"cl": cl, "cv_profile": [s for s in cv if s.get("id") in ("profile", "work_style")]})):
        if not isinstance(text, str) or len(text) < 40:
            continue
        issues = _prose_issues(text, language)
        if issues:
            targets.append({"holder": holder, "key": key, "text": text, "issues": issues})
    if not targets:
        return
    # deterministic first: capitalize lowercase starts
    for t in list(targets):
        if t["issues"] == ["paragraph starts lowercase"]:
            t["holder"][t["key"]] = t["text"][0].upper() + t["text"][1:]
            report.append("prose: capitalized paragraph start")
            targets.remove(t)
    if not targets or not use_llm:
        for t in targets:
            report.append(f"prose: FLAGGED ({'; '.join(t['issues'])}) — …{t['text'][-50:]}")
        return
    asks = [{"id": f"p{i}", "text": t["text"], "problems": t["issues"],
             "instruction": "complete/repair the sentence so it reads whole; +-25 chars"}
            for i, t in enumerate(targets)]
    sys_p = ("You repair broken CV/cover-letter sentences. Fix ONLY the stated problems: "
             "complete a dangling enumeration with the noun it obviously needs (drawn from the "
             "sentence itself or the VERIFIED FACTS), capitalize starts, close dangling "
             "connectors. Change nothing else; keep every number, proper noun and technical "
             "term EXACTLY; total length within +-25 characters. Never use em or en dashes. "
             'Return ONLY JSON: {"items":[{"id":"...","text":"..."}]}')
    user = ("VERIFIED FACTS you may draw a missing word from:\n" + (kernel_facts or "")[:2000] +
            "\n" + json.dumps({"items": asks}, ensure_ascii=False))
    try:
        raw = DF._post_llm("anthropic", DF.LLM_MODEL, sys_p, user)
        m = re.search(r"\{.*\}", raw, re.S)
        out = json.loads(m.group(0)) if m else {}
    except Exception as e:
        report.append(f"prose: repair call failed ({str(e)[:60]}) — flagged only")
        return
    got = {r0.get("id"): DF._norm(r0.get("text")) for r0 in out.get("items") or []}
    accepted = {}
    for i, t in enumerate(targets):
        new = got.get(f"p{i}")
        if not new or abs(len(new) - len(t["text"])) > 40:
            continue
        if DF._numbers(new) != DF._numbers(t["text"]) or set(DF._acronyms(t["text"])) - set(DF._acronyms(new)):
            continue
        if any(ch in new for ch in "—–‐‑"):
            continue
        accepted[f"p{i}"] = (t, new)
    if accepted:
        vetoed = DF.verify_no_new_claims(
            {k: (t["text"] + " || KERNEL FACTS THE REWRITE MAY USE: " + (kernel_facts or "")[:1200], new)
             for k, (t, new) in accepted.items()},
            provider="openai", model="gpt-5-mini")
        for k in vetoed:
            accepted.pop(k, None)
    for k, (t, new) in accepted.items():
        t["holder"][t["key"]] = new
        report.append(f"prose: repaired ({'; '.join(t['issues'])})")
    for i, t in enumerate(targets):
        if f"p{i}" not in accepted:
            # DETERMINISTIC FALLBACK (owner 2026-07-13, 808/790: the LLM
            # repair can fail its own gates): a sentence ending on trailing
            # never-final connectors is honestly fixable by TRIMMING them
            # back to the clause boundary - no fabrication, always clean.
            txt = t["text"]
            _nf = _NEVER_FINAL | DF._CONNECTORS.get(language, set()) | DF._CONNECTORS["en"]
            words = txt.rstrip(" .").split()
            trimmed = 0
            while words and words[-1].lower().strip(",;") in _nf:
                words.pop()
                trimmed += 1
            if trimmed and len(words) >= 5:
                new = " ".join(words).rstrip(",;") + "."
                t["holder"][t["key"]] = new
                report.append(f"prose: repaired by connector trim (-{trimmed}w) — …{new[-50:]}")
                continue
            report.append(f"prose: UNREPAIRED ({'; '.join(t['issues'])}) — …{t['text'][-50:]}")



def compress_slogan(slogan, language, report, use_llm=True):
    """SLOGAN-WORD-CAP-001 (owner 2026-07-13): a CL slogan must be <= max_words
    (site slogan.max_words, default 9) so it never wraps. Prefer a clean clause
    cut; fall back to an LLM condensation (kernel-safe, no new claims). Returns
    the compressed slogan or the original when already short/uncompressable."""
    t = str(slogan or "").strip()
    if not t:
        return t
    maxw = int(((_G.get("slogan") or {}).get("max_words")) or 9)
    if len(t.split()) <= maxw:
        return t
    # clean clause cut first (deterministic, no fabrication)
    for sep in (",", ";", " - ", " – ", " — ", ":"):
        i = t.find(sep)
        if i > 0:
            head = t[:i].strip()
            if 4 <= len(head.split()) <= maxw:
                report.append(f"slogan: clause-cut to {len(head.split())}w — '{head}'")
                return head
    if not use_llm:
        report.append(f"slogan: {len(t.split())}w OVER cap, no clean clause cut (flagged)")
        return t
    sys_p = ("Condense this CV cover-letter slogan to at most %d words while keeping "
             "its exact meaning and tone. No new facts, no dashes, no banned filler. "
             "Return ONLY the slogan text, nothing else." % maxw)
    try:
        out = DF._post_llm("anthropic", DF.LLM_MODEL, sys_p, t, max_tokens=60).strip().strip('"“”')
        out = out.split("\n")[0].strip()
        if out and 3 <= len(out.split()) <= maxw and not any(c in out for c in "—–‐‑"):
            report.append(f"slogan: LLM-condensed {len(t.split())}w -> {len(out.split())}w — '{out}'")
            return out
    except Exception as e:
        report.append(f"slogan: condense call failed ({str(e)[:50]}) — flagged")
    report.append(f"slogan: {len(t.split())}w OVER cap, uncompressed (flagged)")
    return t


def rule_bullet_periods(cv, report):
    """Owner screenshot 2026-07-13: bullets ending without terminal punctuation
    ("...defence-grade products", "...optical microscopy") are visible leaks."""
    n = 0
    for sec in cv:
        if sec.get("type") == "experience":
            for r in sec.get("roles") or []:
                bl = r.get("bullets") or []
                for i, b in enumerate(bl):
                    t = str(b).rstrip()
                    if t and t[-1] not in ".!?:)":
                        bl[i] = t + "."
                        n += 1
                res = str(r.get("results") or "").rstrip()
                if res and res[-1] not in ".!?:)":
                    r["results"] = res + "."
                    n += 1
    if n:
        report.append(f"punctuation: {n} bullet/result terminal period(s) added")



# ── PUB-CANONICAL-ORDER-001 (owner batch 2026-07-13): the worker's
# PUB-CHAIN-001 renders "TITLE + YEAR only" on non-academic CVs by splitting
# each citation at the first em/en dash or colon. A JOURNAL-FIRST entry
# ("Microsystem Technologies, 2010 - <title/authors>") therefore renders the
# JOURNAL as the title and DROPS the real title (808/810 content loss).
# Normalize to the canonical shape its siblings use: "Title - Authors,
# Journal, Year" (ASCII hyphen only, no colon) so the splitter leaves it whole.
_PUB_JOURNAL_FIRST = re.compile(
    # year forms: "Journal, 2010 - ..." AND "Journal (2010) - ..." (806 variant)
    r"^([A-Z][^,:()]{3,60})\s*[,(]\s*((?:19|20)\d\d)\)?\s*[-\u2013\u2014]\s*(.+)$")

def _canon_pub(item):
    m = _PUB_JOURNAL_FIRST.match(str(item).strip())
    if not m:
        return None
    journal, year, rest = m.group(1).strip(), m.group(2), m.group(3).strip()
    for ch in "\u2013\u2014\u2010\u2011":
        rest = rest.replace(ch, "-")
    # authors-first sub-shape: "Surname, X., Surname, Y.: Title."
    mc = re.match(r"^((?:[A-Z][\w'\u00c0-\u024f-]+,\s*[A-Z]\.(?:[A-Z]\.)?,?\s*)+):\s*(.+?)\.?$", rest)
    if mc:
        authors, title = mc.group(1).rstrip(", "), mc.group(2).strip()
        return f"{title} - {authors}, {journal}, {year}"
    return f"{rest} - {journal}, {year}" if " - " not in rest else f"{rest}, {journal}, {year}"

def rule_pubs(cv, report):
    for sec in cv or []:
        if not isinstance(sec, dict) or sec.get("id") != "pubs":
            continue
        items = sec.get("items") or []
        for i, it in enumerate(items):
            if not isinstance(it, str):
                continue
            fixed = _canon_pub(it)
            if fixed and fixed != it:
                items[i] = fixed
                report.append(f"pubs: journal-first citation reordered -> '{fixed[:60]}'")

def apply_all(cv, cl, jd, kernel, language="en", use_llm=True):
    """Run every rule in place. Returns the report list."""
    report = []
    kernel_facts = DF.kernel_digest(kernel)
    rule_certs(cv, jd, report)
    rule_education(cv, language, report)
    rule_line_compress({"cv": cv, "cl": cl}, report)
    rule_core_comp(cv, jd, report)
    rule_results_numeric(cv, kernel, jd, report, language=language)
    _restore_forening(cv, jd, language, report)
    rule_pubs(cv, report)
    rule_bullet_periods(cv, report)
    rule_cl_prose(cl, cv, kernel_facts, language, report, use_llm=use_llm)
    return report


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--app", type=int, required=True)
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--no-llm", dest="llm", action="store_false")
    args = ap.parse_args()
    gr = MD._gen_runner()
    c, resp = gr._req(gr.RELAY, f"/api/applications/{args.app}")
    a = resp.get("application") or resp
    def _j(v, d): return json.loads(v) if isinstance(v, str) else (v if v is not None else d)
    cv, cl = _j(a.get("cv_sections"), []), _j(a.get("cl_sections"), [])
    kernel = gr.load_kernel()
    rep = apply_all(cv, cl, a.get("jd_text") or "", kernel,
                    language=a.get("jd_language") or "en", use_llm=args.llm)
    for line in rep:
        print("  " + line)
    if args.apply and rep:
        c2, _ = gr._req(gr.RELAY, f"/api/applications/{args.app}", "PUT",
                        {"cv_sections": cv, "cl_sections": cl})
        print(f"applied: PUT {c2}")
    elif not rep:
        print("  clean — no rule fired")


if __name__ == "__main__":
    main()
