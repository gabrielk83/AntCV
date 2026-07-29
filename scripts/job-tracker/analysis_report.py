#!/usr/bin/env python3
"""analysis_report.py — detailed JD-fit analysis report per application.

Owner 2026-07-15: "detailed analysis reports (with expanded gap reports and how
to cover)". For each app: JD + the candidate's TAILORED CV + their FULL kernel ->
one LLM analysis pass -> structured fit report with EXPANDED gaps, each carrying
what the JD wants, why it matters, whether the candidate covers it, and HOW to
cover it — grounded ONLY in real background (no fabrication; a genuinely missing
requirement is named honestly with a mitigation, never invented). Rendered to
Markdown (+ the raw JSON).

Usage:
  python analysis_report.py --apps 807,806 --out "C:/.../dir" [--model claude-sonnet-5]
"""
import argparse, json, os, sys, re, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import measure_density as MD

PROXY = os.environ.get("ANTCV_PROXY", "https://cv-proxy.karp-gabriel-a.workers.dev").rstrip("/")


def _post(provider, model, sys_p, user, timeout=180):
    gr = MD._gen_runner()
    body = {"model": model, "max_tokens": 4000, "system": sys_p,
            "messages": [{"role": "user", "content": user}], "stream": True}
    req = urllib.request.Request(PROXY + "/v1/messages", data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json", "x-provider": provider,
                                          "User-Agent": gr.UA, "Origin": gr.ORIGIN,
                                          "Authorization": "Bearer " + gr._token()})
    out = []
    with urllib.request.urlopen(req, timeout=timeout) as r:
        for raw in r:
            line = raw.decode("utf-8", "replace").strip()
            if not line.startswith("data:"):
                continue
            payload = line[5:].strip()
            if payload == "[DONE]":
                break
            try:
                ev = json.loads(payload)
            except Exception:
                continue
            d = ev.get("delta") or {}
            if d.get("type") == "text_delta" or "text" in d:
                out.append(d.get("text", ""))
            elif ev.get("type") == "content_block_delta":
                out.append((ev.get("delta") or {}).get("text", ""))
    return "".join(out)


SYS = ("You are a sharp, honest career analyst advising a specific candidate on a specific "
       "job. You are given the JOB DESCRIPTION, the candidate's TAILORED CV for this role, and "
       "their FULL BACKGROUND (kernel). Produce a rigorous fit analysis. Rules: ground every "
       "claim in the provided material; NEVER invent a credential, tool, or experience the "
       "candidate does not have. For a gap the candidate genuinely lacks, say so plainly and give "
       "an HONEST way to mitigate or frame it (transferable skill, fast-ramp evidence, a question "
       "to ask) — do not paper over it. Be concrete and specific to THIS job, not generic. "
       "Return ONLY JSON in this exact shape:\n"
       "{\n"
       ' "overall_fit": "strong|good|moderate|stretch",\n'
       ' "fit_summary": "2-3 sentences on the match",\n'
       ' "strengths": [{"point":"...", "evidence":"from CV/kernel"}],\n'
       ' "gaps": [{"requirement":"what the JD asks", "why_it_matters":"...", '
       '"status":"covered|partial|missing", "how_to_cover":"concrete, real-background-grounded steps"}],\n'
       ' "questions_to_employer": ["..."],\n'
       ' "positioning_advice": "how to lead the pitch for this role",\n'
       ' "red_flags": ["optional concerns"]\n'
       "}")


def analyze(app_id, model, provider="anthropic"):
    cv, cl, pi, sc, meta, language, a = MD.job_context_for_app(app_id)
    jd = str(a.get("jd_text") or "")[:9000]
    gr = MD._gen_runner()
    kernel = gr.load_kernel()
    try:
        kdigest = json.dumps(gr.compact_profile(kernel), ensure_ascii=False)[:5000]
    except Exception:
        kdigest = json.dumps(kernel, ensure_ascii=False)[:5000]
    cvtxt = json.dumps(cv, ensure_ascii=False)[:9000]
    user = (f"JOB: {a.get('jd_company')} — {a.get('jd_role')} (language {language})\n\n"
            f"JOB DESCRIPTION:\n{jd}\n\n"
            f"CANDIDATE TAILORED CV (sections JSON):\n{cvtxt}\n\n"
            f"CANDIDATE FULL BACKGROUND (kernel digest):\n{kdigest}\n\n"
            "Analyze the fit and return the JSON.")
    text = _post(provider, model, SYS, user)
    m = re.search(r"\{.*\}", text, re.S)
    data = json.loads(m.group(0)) if m else {}
    data["_app"] = app_id
    data["_company"] = a.get("jd_company")
    data["_role"] = a.get("jd_role")
    return data


def to_md(d):
    L = []
    L.append(f"# JD-Fit Analysis — {d.get('_company','?')}: {d.get('_role','?')}")
    L.append(f"_Application {d.get('_app')} · overall fit: **{str(d.get('overall_fit','?')).upper()}**_\n")
    L.append(d.get("fit_summary", "") + "\n")
    if d.get("strengths"):
        L.append("## Strengths matched")
        for s in d["strengths"]:
            L.append(f"- **{s.get('point','')}** — {s.get('evidence','')}")
        L.append("")
    if d.get("gaps"):
        L.append("## Gaps — expanded, with how to cover")
        for g in d["gaps"]:
            st = str(g.get("status", "")).upper()
            L.append(f"### {g.get('requirement','')}  ·  _{st}_")
            L.append(f"- **Why it matters:** {g.get('why_it_matters','')}")
            L.append(f"- **How to cover:** {g.get('how_to_cover','')}")
            L.append("")
    if d.get("questions_to_employer"):
        L.append("## Questions to ask the employer")
        for q in d["questions_to_employer"]:
            L.append(f"- {q}")
        L.append("")
    if d.get("positioning_advice"):
        L.append("## Positioning")
        L.append(d["positioning_advice"] + "\n")
    if d.get("red_flags"):
        L.append("## Watch-outs")
        for r in d["red_flags"]:
            L.append(f"- {r}")
        L.append("")
    return "\n".join(L)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apps", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--model", default=os.environ.get("ANTCV_ANALYSIS_MODEL", "claude-sonnet-5"))
    ap.add_argument("--provider", default="anthropic")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    idx = []
    for app_id in [int(a) for a in args.apps.split(",") if a.strip()]:
        try:
            d = analyze(app_id, args.model, args.provider)
            company = str(d.get("_company") or "app").replace(" ", "_").replace("/", "-")[:24]
            base = f"{app_id}_{company}_ANALYSIS"
            json.dump(d, open(os.path.join(args.out, base + ".json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
            open(os.path.join(args.out, base + ".md"), "w", encoding="utf-8").write(to_md(d))
            ng = len(d.get("gaps") or [])
            idx.append({"app": app_id, "fit": d.get("overall_fit"), "gaps": ng, "file": base + ".md"})
            print(f"{app_id} {company}: fit={d.get('overall_fit')} gaps={ng} -> {base}.md", flush=True)
        except Exception as e:
            idx.append({"app": app_id, "status": f"FAILED {str(e)[:70]}"})
            print(f"{app_id}: FAILED {str(e)[:90]}", flush=True)
    json.dump(idx, open(os.path.join(args.out, "_analysis_index.json"), "w", encoding="utf-8"), indent=1)
    print("index ->", os.path.join(args.out, "_analysis_index.json"))


if __name__ == "__main__":
    main()
