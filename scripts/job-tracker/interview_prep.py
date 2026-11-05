#!/usr/bin/env python3
"""interview_prep.py — INTERVIEW-PREP-001 (owner 2026-11-05: "add interview preparation resources
pack and support for positions that are advancing towards an interview ... relate it to the
interview preparation and mock interview").

From ai-job-search's /interview, shaped to the owner's own prep format (memory
interview-prep-format, 2026-10-04): tabs and tap-to-open cards, short sentences, a tick-off
checklist, salary ALWAYS, practice drills for rusty hands-on skills, and never a "fix the CV"
section (only "if they ask about this line, say ...").

Sources, per tracker row (urlkey):
  the job ad (doc.jd), the hiring manager (doc.notes), the version actually SUBMITTED
  (doc.submitted[uk].application_id when the tracker has one, else artifacts[uk]), the kernel
  (facts; the only source of STAR stories), the employer's annual-report angles
  (doc.financials[uk].angles, FIN-ANGLES-001), the eligibility verdict (doc.eligibility,
  ELIGIBILITY-GATE-001), the stage history (doc.history), the salary envelope (doc.envelope)
  and fresh web research.

Output: <out>/interview_<uk>_<stage>.json, .md and a self-contained .html (tabs, cards,
checklist, mock-interview cards); `--write` also stores doc.interview[uk] = {stage,
generated_at, md, json} for the tracker's Interview prep area.

  python interview_prep.py pack --uk UK --stage 1st [--out DIR] [--write]
  python interview_prep.py mock --uk UK [--stage 1st]   # terminal mock interview with feedback
"""
import argparse
import datetime
import html
import importlib.util
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
STAGES = ("screening", "1st", "2nd", "final", "case")
MODEL = os.environ.get("ANTCV_INTERVIEW_MODEL", "claude-sonnet-5")


def _load(name, file):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, file))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


# ------------------------------------------------------------------ context
def salary_line(doc):
    for row in doc.get("envelope") or []:
        if row and str(row[0]).strip().lower() in ("salary", "løn", "pay"):
            return " / ".join(str(c) for c in row[1:] if str(c).strip())
    return ""


def status_history(doc, uk):
    """A row's dated status list, as the tracker island keeps it (OUTCOME-RECORD-002):
    status_history[uk], else a MAP-shaped legacy history[uk]. The doc also holds a legacy
    `history` ARRAY (not per row), which is never read as a row's history."""
    for key in ("status_history", "history"):
        m = doc.get(key)
        if isinstance(m, dict) and isinstance(m.get(uk), list):
            return m[uk]
    return []


def gather(doc, uk, stage, kernel_digest="", app_text=None, research=""):
    """Everything the pack may use, as plain text blocks. `app_text(app_id)` -> (cv, cl) text."""
    row = next((r for r in doc.get("rows") or [] if isinstance(r, list) and len(r) > 11 and r[11] == uk), None)
    if not row:
        raise KeyError("no row with urlkey %r" % uk)
    sub = (doc.get("submitted") or {}).get(uk) or {}
    app_id = sub.get("application_id") or ((doc.get("artifacts") or {}).get(uk) or {}).get("application_id")
    cv, cl = (app_text(app_id) if (app_text and app_id) else ("", ""))
    notes = (doc.get("notes") or {}).get(uk)
    fin = (doc.get("financials") or {}).get(uk) or {}
    return {
        "company": row[1], "role": row[2], "location": row[3], "stage": stage,
        "jd": str((doc.get("jd") or {}).get(uk) or "")[:8000],
        "hiring_manager": (notes or {}).get("hm", "") if isinstance(notes, dict) else "",
        "submitted": {"application_id": app_id, "frozen": bool(sub), "cv": cv[:6000], "cl": cl[:4000]},
        "financials": {"summary": fin.get("summary", ""), "interview": (fin.get("angles") or {}).get("interview") or {},
                       "questions": (fin.get("angles") or {}).get("questions") or []},
        "eligibility": (doc.get("eligibility") or {}).get(uk) or {},
        "history": status_history(doc, uk),
        "salary_envelope": salary_line(doc),
        "kernel": kernel_digest[:7000],
        "research": research[:2500],
    }


SYS = """You build an interview prep pack for ONE candidate, ONE job, ONE interview stage.
Hard rules:
- Facts about the candidate come ONLY from KERNEL and the SUBMITTED CV/CL. Never invent experience,
  numbers, employers, tools or credentials. A gap gets an honest bridge answer, never a made-up story.
- STAR stories: built from kernel facts only; each names the kernel fact it rests on ("proof").
- Consistency brief: the claims the interviewer has READ in the submitted CV/CL, so answers match them.
  No "fix the CV" advice; at most "if they ask about this line, say ...".
- Salary ALWAYS: one line to ask, one line if they ask first, and the envelope given.
- Short sentences. Each card fits on a phone screen.
- Write the pack in English; write answer phrasings in the language of the job ad.
- Company figures (FINANCIALS) shape what to rehearse and what to ask; never criticise the employer.
- Practice: for hands-on skills the ad needs that the kernel shows as older or thin, give a short drill
  with steps (what to set up, what to measure, what good looks like).
Return ONLY JSON:
{"summary": "two sentences: the role and what this stage tests",
 "likely_questions": [{"q": "", "why": "", "answer_outline": ["", ""], "proof": ""}],
 "star_stories": [{"title": "", "situation": "", "task": "", "action": "", "result": "", "proof": "", "fits": [""]}],
 "consistency": [{"claim": "", "if_asked": ""}],
 "tough_questions": [{"q": "", "honest_bridge": ""}],
 "company": [{"point": "", "use_it": ""}],
 "questions_to_ask": [""],
 "salary": {"ask": "", "if_asked_first": "", "envelope": ""},
 "eligibility": [""],
 "practice": [{"skill": "", "steps": ["", ""], "good": ""}],
 "logistics": [""],
 "checklist": [""],
 "mock_interview": {"opening": "", "questions": [{"q": "", "follow_up": "", "good_answer": ""}], "rubric": [""]}}
Give 8-10 likely questions, 4-6 STAR stories, 6-10 mock questions for this STAGE."""


def user_turn(ctx):
    return ("STAGE: %(stage)s\nJOB: %(company)s - %(role)s (%(location)s)\nHIRING MANAGER: %(hiring_manager)s\n\n"
            "JOB AD:\n%(jd)s\n\nSUBMITTED CV (what they read):\n%(cv)s\n\nSUBMITTED COVER LETTER:\n%(cl)s\n\n"
            "KERNEL (the candidate's facts):\n%(kernel)s\n\nFINANCIALS: %(fin)s\nRehearse: %(rehearse)s\n"
            "Likely from the figures: %(fq)s\nQuestions the figures suggest asking: %(ask)s\n\n"
            "ELIGIBILITY: %(elig)s\nSTAGE HISTORY: %(hist)s\nSALARY ENVELOPE: %(sal)s\n\nWEB RESEARCH:\n%(research)s"
            % {"stage": ctx["stage"], "company": ctx["company"], "role": ctx["role"], "location": ctx["location"],
               "hiring_manager": ctx["hiring_manager"] or "unknown", "jd": ctx["jd"],
               "cv": ctx["submitted"]["cv"] or "(not available)", "cl": ctx["submitted"]["cl"] or "(not available)",
               "kernel": ctx["kernel"], "fin": ctx["financials"]["summary"] or "none on file",
               "rehearse": "; ".join(ctx["financials"]["interview"].get("rehearse") or []) or "-",
               "fq": "; ".join(ctx["financials"]["interview"].get("likely_questions") or []) or "-",
               "ask": "; ".join(ctx["financials"]["questions"]) or "-",
               "elig": json.dumps(ctx["eligibility"], ensure_ascii=False) or "-",
               "hist": json.dumps(ctx["history"], ensure_ascii=False) or "-",
               "sal": ctx["salary_envelope"] or "-", "research": ctx["research"] or "-"})


def parse_pack(text):
    m = re.search(r"\{.*\}", text or "", re.S)
    if not m:
        raise ValueError("model returned no JSON")
    pack = json.loads(m.group(0))
    pack.setdefault("salary", {})
    return pack


# ------------------------------------------------------------------ render
TABS = [("likely_questions", "Likely questions"), ("star_stories", "Your stories"),
        ("consistency", "What they read"), ("tough_questions", "Tough ones"), ("company", "Company"),
        ("questions_to_ask", "Ask them"), ("salary", "Salary"), ("eligibility", "Eligibility"),
        ("practice", "Practice"), ("mock_interview", "Mock interview"), ("checklist", "Checklist")]


def _card_lines(key, item):
    if isinstance(item, str):
        return item, []
    if key == "likely_questions":
        return item.get("q", ""), ["Why: " + item.get("why", "")] + ["- " + a for a in item.get("answer_outline", [])] + \
            (["Proof: " + item["proof"]] if item.get("proof") else [])
    if key == "star_stories":
        return item.get("title", ""), ["S: " + item.get("situation", ""), "T: " + item.get("task", ""),
                                       "A: " + item.get("action", ""), "R: " + item.get("result", ""),
                                       "Proof: " + item.get("proof", ""), "Fits: " + ", ".join(item.get("fits", []))]
    if key == "consistency":
        return item.get("claim", ""), ["If asked: " + item.get("if_asked", "")]
    if key == "tough_questions":
        return item.get("q", ""), ["Honest bridge: " + item.get("honest_bridge", "")]
    if key == "company":
        return item.get("point", ""), ["Use it: " + item.get("use_it", "")]
    if key == "practice":
        return item.get("skill", ""), ["%d. %s" % (i + 1, s) for i, s in enumerate(item.get("steps", []))] + \
            ["Good looks like: " + item.get("good", "")]
    return json.dumps(item, ensure_ascii=False), []


def _cards(pack, key):
    if key == "salary":
        s = pack.get("salary") or {}
        return [("Ask", [s.get("ask", "")]), ("If they ask first", [s.get("if_asked_first", "")]),
                ("Your envelope", [s.get("envelope", "")])]
    if key == "mock_interview":
        mi = pack.get("mock_interview") or {}
        out = [("Opening", [mi.get("opening", "")])]
        out += [(q.get("q", ""), ["Follow-up: " + q.get("follow_up", ""), "Good answer: " + q.get("good_answer", "")])
                for q in mi.get("questions", [])]
        out += [("How you are scored", ["- " + r for r in mi.get("rubric", [])])]
        return out
    return [_card_lines(key, it) for it in pack.get(key) or []]


def to_md(pack, ctx):
    L = ["# Interview prep: %s - %s (%s)" % (ctx["company"], ctx["role"], ctx["stage"]), "", pack.get("summary", ""), ""]
    if ctx["financials"]["summary"]:
        L += ["> " + ctx["financials"]["summary"], ""]
    for key, title in TABS:
        cards = _cards(pack, key)
        if not cards or not any(t or b for t, b in cards):
            continue
        L.append("## " + title)
        for t, body in cards:
            if key == "checklist":
                L.append("- [ ] " + t)
                continue
            L.append("**%s**" % t)
            L += ["  " + b for b in body if b]
        L.append("")
    return "\n".join(L)


def to_html(pack, ctx):
    e = html.escape
    tabs, panels = [], []
    for i, (key, title) in enumerate(TABS):
        cards = _cards(pack, key)
        if not cards or not any(t or b for t, b in cards):
            continue
        tabs.append('<button role="tab" data-t="%d"%s>%s</button>' % (i, ' aria-selected="true"' if not tabs else "", e(title)))
        if key == "checklist":
            body = "".join('<label class="chk"><input type="checkbox" data-k="%s-%d"> %s</label>' % (e(ctx["uk"]), j, e(t))
                           for j, (t, _) in enumerate(cards))
        else:
            body = "".join("<details><summary>%s</summary>%s</details>" % (e(t), "".join("<p>%s</p>" % e(b) for b in bs if b))
                           for t, bs in cards)
        panels.append('<section data-p="%d"%s>%s</section>' % (i, "" if len(panels) == 0 else " hidden", body))
    fin = ('<p class="fin">%s</p>' % e(ctx["financials"]["summary"])) if ctx["financials"]["summary"] else ""
    return """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Interview prep</title><style>
:root{--bg:#fff;--fg:#1b1f24;--mut:#5b6573;--card:#f4f6f8;--acc:#1f5fbf}
@media (prefers-color-scheme:dark){:root{--bg:#121417;--fg:#e8eaed;--mut:#9aa3ad;--card:#1d2126;--acc:#7fb0ff}}
body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:16px/1.45 system-ui,sans-serif;max-width:760px}
h1{font-size:1.25rem;margin:0 0 4px}.sum,.fin{color:var(--mut);margin:4px 0 12px}
nav{display:flex;gap:6px;overflow-x:auto;padding-bottom:8px}nav button{border:1px solid var(--mut);background:none;color:var(--fg);
border-radius:16px;padding:6px 12px;white-space:nowrap;cursor:pointer}nav button[aria-selected=true]{background:var(--acc);color:#fff;border-color:var(--acc)}
details{background:var(--card);border-radius:10px;margin:8px 0;padding:10px 12px}summary{cursor:pointer;font-weight:600}
details p{margin:6px 0}.chk{display:block;padding:8px 0}</style></head><body>
<h1>%s - %s</h1><p class="sum">%s stage. %s</p>%s<nav role="tablist">%s</nav>%s
<script>
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('nav button').forEach(x=>x.removeAttribute('aria-selected'));
b.setAttribute('aria-selected','true');document.querySelectorAll('section').forEach(s=>s.hidden=s.dataset.p!==b.dataset.t)});
document.querySelectorAll('.chk input').forEach(c=>{try{c.checked=localStorage.getItem(c.dataset.k)==='1'}catch(e){}
c.onchange=()=>{try{localStorage.setItem(c.dataset.k,c.checked?'1':'0')}catch(e){}}});
</script></body></html>""" % (e(ctx["company"]), e(ctx["role"]), e(ctx["stage"]), e(pack.get("summary", "")), fin,
                               "".join(tabs), "".join(panels))


# ------------------------------------------------------------------ mock interview (terminal)
MOCK_SYS = ("You are the interviewer's coach. Given ONE interview question, what a good answer contains, the "
            "candidate's kernel facts and the candidate's answer: give feedback in at most 6 short lines - what "
            "landed, what was missing, one better phrasing grounded ONLY in the kernel, and a score 1-5. Never "
            "invent experience. If the answer claims something the kernel does not hold, say so.")


def mock(pack, kernel, ask=input, say=print, llm=None):
    """One question at a time; the answer ends with an empty line; 'q' quits. -> transcript list."""
    mi = pack.get("mock_interview") or {}
    say(mi.get("opening", "Mock interview. Answer as you would in the room; an empty line ends an answer."))
    log = []
    for i, item in enumerate(mi.get("questions", []), 1):
        say("\nQ%d. %s" % (i, item.get("q", "")))
        lines = []
        while True:
            ln = ask("")
            if ln.strip().lower() == "q" and not lines:
                return log
            if not ln.strip():
                break
            lines.append(ln)
        answer = "\n".join(lines)
        fb = llm(MOCK_SYS, "QUESTION: %s\nGOOD ANSWER CONTAINS: %s\nKERNEL:\n%s\n\nANSWER:\n%s" % (
            item.get("q", ""), item.get("good_answer", ""), kernel[:6000], answer)) if (llm and answer) else ""
        if fb:
            say(fb.strip())
        if item.get("follow_up"):
            say("Follow-up they may ask: " + item["follow_up"])
        log.append({"q": item.get("q", ""), "answer": answer, "feedback": fb})
    say("\nRubric: " + "; ".join(mi.get("rubric", [])))
    return log


# ------------------------------------------------------------------ CLI
def _context_live(uk, stage, research=True):
    gr = _load("gen_runner", "gen-runner.py")
    md = _load("measure_density", "measure_density.py")
    import course_checklist as CC
    _, doc = gr.get_doc()
    kernel = gr.load_kernel()
    kdig = json.dumps(gr.compact_profile(kernel), ensure_ascii=False)

    def app_text(app_id):
        cv, cl, pi, *_ = md.job_context_for_app(int(app_id))
        return CC.sections_to_text(cv, pi), CC.sections_to_text(cl, pi)
    row = next(r for r in doc.get("rows") or [] if isinstance(r, list) and len(r) > 11 and r[11] == uk)
    rs = gr.research(row[1], row[2]) if research else ""
    return gr, doc, kdig, gather(doc, uk, stage, kdig, app_text, rs)


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass
    ap = argparse.ArgumentParser(description="Interview prep pack + mock interview (INTERVIEW-PREP-001)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("pack", "mock"):
        p = sub.add_parser(name)
        p.add_argument("--uk", required=True)
        p.add_argument("--stage", choices=STAGES, default="1st")
        p.add_argument("--out", default=os.path.join(os.path.expanduser("~"), "Downloads", "antcv-interview"))
        p.add_argument("--model", default=MODEL)
        p.add_argument("--no-research", dest="research", action="store_false")
    sub.choices["pack"].add_argument("--write", action="store_true", help="store doc.interview[uk] for the tracker")
    a = ap.parse_args()
    ar = _load("analysis_report", "analysis_report.py")
    llm = lambda sys_p, user: ar._post("anthropic", a.model, sys_p, user, timeout=600, max_tokens=12000)  # noqa: E731
    os.makedirs(a.out, exist_ok=True)
    stem = os.path.join(a.out, "interview_%s_%s" % (a.uk, a.stage))
    if a.cmd == "mock" and os.path.exists(stem + ".json"):
        pack = json.load(open(stem + ".json", encoding="utf-8"))["pack"]
        gr = _load("gen_runner", "gen-runner.py")
        kdig = json.dumps(gr.compact_profile(gr.load_kernel()), ensure_ascii=False)
    else:
        gr, doc, kdig, ctx = _context_live(a.uk, a.stage, a.research)
        ctx["uk"] = a.uk
        raw = llm(SYS, user_turn(ctx))
        try:
            pack = parse_pack(raw)
        except ValueError:
            open(stem + ".raw.txt", "w", encoding="utf-8").write(raw)
            sys.exit("the model's pack did not parse (cut off?); raw output -> %s.raw.txt" % stem)
        md_text, html_text = to_md(pack, ctx), to_html(pack, ctx)
        json.dump({"ctx": {k: v for k, v in ctx.items() if k not in ("kernel", "jd")}, "pack": pack},
                  open(stem + ".json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        open(stem + ".md", "w", encoding="utf-8").write(md_text)
        open(stem + ".html", "w", encoding="utf-8").write(html_text)
        print("pack -> %s.html (.md, .json)" % stem)
        if a.cmd == "pack" and a.write:
            import followups as F
            rec = {"stage": a.stage, "generated_at": datetime.date.today().isoformat(), "md": md_text, "json": pack}
            F._write(lambda d: d.setdefault("interview", {}).__setitem__(a.uk, rec) or True)
            print("stored doc.interview[%s]" % a.uk)
    if a.cmd == "mock":
        log = mock(pack, kdig, llm=llm)
        json.dump(log, open(stem + "_mock_%s.json" % datetime.datetime.now().strftime("%Y%m%d-%H%M"), "w",
                            encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
