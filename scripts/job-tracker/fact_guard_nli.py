#!/usr/bin/env python3
"""fact_guard_nli.py — FACT-GUARD-NLI-001 (tier 1 of TEXT-GUARDS-001, owner-approved 2026-11-05).

Claim-level grounding with local NLI models, CPU only, no network after the one-time download.
fact_guard.py (tier 0) catches unsupported figures, names and credentials; this catches a
sentence whose MEANING the kernel does not support ("led" where the kernel says "contributed",
a fact moved to another role).

  Danish / Swedish  alexandrainst/scandi-nli-large-v2 (Apache-2.0; entailment / neutral /
                    contradiction)
  English           MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli (MIT;
                    entailment / neutral / contradiction). It replaced FactCG-DeBERTa-v3-Large,
                    which failed --self-test on 2026-11-05 (FACT-GUARD-NLI-EN-001).

For each claim sentence of the draft: retrieve the k kernel facts that share the most stemmed
content words, score the claim against them joined AND one by one (max, the AlignScore
pattern, so one CV line merging several facts is not punished), then:
  SUPPORTED     support >= 0.5
  CONTRADICTED  contradiction >= 0.6                                       FAIL
  UNSUPPORTED   otherwise ("neutral": inferred wording, or a real gap)    WARN
Intent sentences ("I will", "Jeg vil") and headings are skipped.

Heavy dependencies live in their own venv (~/.antcv/nli-venv: CPU torch, transformers), so
the other job-tracker scripts keep running on plain Python. gen-runner calls this through
that venv with `run --nli`. Models are pinned to a commit and loaded from safetensors only.

Usage (with the venv's python):
  python fact_guard_nli.py --download                 # one-time, about 2.3 GB
  python fact_guard_nli.py --draft CL.txt --kernel kernel.json [--lang da] [--json]
  python fact_guard_nli.py --batch in.json --out out.json    # gen-runner's interface
  python fact_guard_nli.py --self-test                # label orientation on two known pairs
"""
import argparse
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import guard_common as G  # noqa: E402

VENV_PY = os.path.join(os.path.expanduser("~"), ".antcv", "nli-venv",
                       "Scripts" if os.name == "nt" else "bin", "python.exe" if os.name == "nt" else "python")
MODELS = {
    # pinned 2026-11-05; override with ANTCV_NLI_*_REV only after re-running --self-test
    "scandi": {"id": "alexandrainst/scandi-nli-large-v2",
               "rev": os.environ.get("ANTCV_NLI_SCANDI_REV", "6172daba8d0b47341488abdad4e8e375b1d18956"),
               "langs": ("da", "sv"), "kind": "nli3"},
    # FACT-GUARD-NLI-EN-001 (owner 2026-11-05): FactCG-DeBERTa-v3-Large failed --self-test (an invented
    # claim scored 0.83 support, a true one 0.71) and was replaced by this 3-label NLI model, so English
    # flags contradictions too. ANTCV_NLI_EN=0 turns English off.
    "en": {"id": "MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli",
           "rev": os.environ.get("ANTCV_NLI_EN_REV", "b3546ea6b0346eb6f8d5d68b13c7dc6d0376b3d7"),
           "langs": ("en",), "kind": "nli3", "enabled": os.environ.get("ANTCV_NLI_EN", "1") != "0"},
}


def enabled(lang):
    return MODELS[model_for(lang)].get("enabled", True)
SUPPORT_MIN, CONTRADICT_MIN, TOP_K, MIN_WORDS = 0.5, 0.6, 4, 6


def model_for(lang):
    return "scandi" if lang in ("da", "sv") else "en"


# ------------------------------------------------------------------ retrieval (no model)
def kernel_facts(kernel_text):
    """Fact units: kernel lines / sentences of 4+ words, de-duplicated, in order."""
    seen, out = set(), []
    for s in G.sentences(kernel_text or ""):
        s = s.strip(" -•\t")
        if len(G.words(s)) >= 4 and s.lower() not in seen:
            seen.add(s.lower())
            out.append(s)
    return out


def _content(text, lang):
    sw = G.stopwords(lang)
    return {G.stem(w, lang) for w in G.words(text) if w.lower() not in sw and len(w) > 2}


def retrieve(claim, facts, lang, k=TOP_K):
    """The k facts sharing the most stemmed content words with the claim (ties: shorter first)."""
    c = _content(claim, lang)
    scored = sorted(((len(c & _content(f, lang)), -len(f), f) for f in facts), reverse=True)
    return [f for n, _, f in scored[:k] if n > 0]


def claims(draft, lang):
    """Sentences worth checking: 6+ words, not an intent sentence, quoted text removed."""
    intent = [m for m in G.rules()["intent_markers"]]
    out = []
    for s in G.sentences(G.strip_quoted(draft)):
        low = s.lower()
        if len(G.words(s)) < MIN_WORDS or any(low.startswith(m) or (" " + m + " ") in low for m in intent):
            continue
        out.append(s)
    return out


# ------------------------------------------------------------------ scoring
class Scorer:
    """Lazy-loaded NLI models. score(premise, hypothesis, lang) -> (support, contradiction|None)."""

    def __init__(self):
        self._m = {}

    def _load(self, key):
        if key not in self._m:
            import torch  # noqa: F401  (venv only)
            from transformers import AutoConfig, AutoModelForSequenceClassification, AutoTokenizer
            spec = MODELS[key]
            kw = {"revision": spec["rev"]}
            if spec["kind"] == "binary":
                cfg = AutoConfig.from_pretrained(spec["id"], num_labels=2, **kw)
                model = AutoModelForSequenceClassification.from_pretrained(spec["id"], config=cfg,
                                                                           use_safetensors=True, **kw)
            else:
                model = AutoModelForSequenceClassification.from_pretrained(spec["id"], use_safetensors=True, **kw)
            tok = AutoTokenizer.from_pretrained(spec["id"], **kw)
            model.eval()
            self._m[key] = (tok, model, spec)
        return self._m[key]

    def score(self, premise, hypothesis, lang):
        import torch
        tok, model, spec = self._load(model_for(lang))
        enc = tok(premise, hypothesis, truncation="only_first", max_length=512, return_tensors="pt")
        with torch.no_grad():
            p = torch.softmax(model(**enc).logits[0], dim=-1).tolist()
        if spec["kind"] == "nli3":
            lab = {v.lower(): int(k) for k, v in model.config.id2label.items()}
            return p[lab["entailment"]], p[lab["contradiction"]]
        return p[spec["support_index"]], None


def verdict(support, contra):
    """Support from ANY kernel fact wins (a claim can match one role and clash with another);
    otherwise a strong contradiction fails; otherwise it is unsupported."""
    if support >= SUPPORT_MIN:
        return "SUPPORTED", None
    if contra is not None and contra >= CONTRADICT_MIN:
        return "CONTRADICTED", "FAIL"
    return "UNSUPPORTED", "WARN"


def check(draft, kernel_text, lang=None, scorer=None, k=TOP_K):
    """[{sentence, verdict, severity, support, contradiction, evidence}] for the claim sentences."""
    lang = lang or G.detect_lang(draft)
    if not enabled(lang):
        return []                                        # no model that passed --self-test
    scorer = scorer or Scorer()
    facts = kernel_facts(kernel_text)
    out = []
    for s in claims(draft, lang):
        ev = retrieve(s, facts, lang, k)
        if not ev:
            out.append({"sentence": s[:200], "verdict": "UNSUPPORTED", "severity": "WARN",
                        "support": 0.0, "contradiction": None, "evidence": []})
            continue
        best_s, best_c = scorer.score(" ".join(ev), s, lang)
        for f in ev if len(ev) > 1 else []:              # each fact alone as well
            sp, ct = scorer.score(f, s, lang)
            best_s = max(best_s, sp)
            if ct is not None:
                best_c = ct if best_c is None else max(best_c, ct)
        v, sev = verdict(best_s, best_c)
        if sev:
            out.append({"sentence": s[:200], "verdict": v, "severity": sev, "support": round(best_s, 3),
                        "contradiction": None if best_c is None else round(best_c, 3), "evidence": ev[:2]})
    return out


# ------------------------------------------------------------------ CLI
def _download():
    from huggingface_hub import snapshot_download
    for key, spec in MODELS.items():
        path = snapshot_download(spec["id"], revision=spec["rev"],
                                 allow_patterns=["*.json", "*.safetensors", "*.txt", "spm.model", "*.model"])
        print("%s -> %s" % (spec["id"], path))


SELF_TEST = [
    ("en", "Led NPI of 12 laser modules at Lumen Optics from 2017 to 2020.",
     "At Lumen Optics I led the NPI of twelve laser modules.", "SUPPORTED"),
    ("en", "Led NPI of 12 laser modules at Lumen Optics from 2017 to 2020.",
     "At Lumen Optics I managed a team of 40 software developers building a banking app.",
     ("UNSUPPORTED", "CONTRADICTED")),        # an invented claim: any flag, never SUPPORTED
    ("en", "Led NPI of 12 laser modules at Lumen Optics from 2017 to 2020.",
     "At Lumen Optics I never worked with laser modules.", "CONTRADICTED"),
    ("da", "Ledede NPI af 12 lasermoduler hos Lumen Optics fra 2017 til 2020.",
     "Hos Lumen Optics ledede jeg NPI af tolv lasermoduler.", "SUPPORTED"),
    ("da", "Ledede NPI af 12 lasermoduler hos Lumen Optics fra 2017 til 2020.",
     "Hos Lumen Optics har jeg aldrig arbejdet med lasermoduler.", "CONTRADICTED"),
]


def self_test():
    sc = Scorer()
    ok = True
    for lang, prem, hyp, want in SELF_TEST:
        if not enabled(lang):
            print("%s skipped (model off: ANTCV_NLI_EN=0)" % lang)
            continue
        s, c = sc.score(prem, hyp, lang)
        got = verdict(s, c)[0]
        ok &= got in (want if isinstance(want, tuple) else (want,))
        print("%s %-12s want %-12s support %.3f contra %s | %s" % (lang, got, "/".join(want) if isinstance(want, tuple) else want,
                                                                    s, "-" if c is None else "%.3f" % c,
                                                                    hyp[:60]))
    print("SELF-TEST", "PASS" if ok else "FAIL")
    return ok


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass
    ap = argparse.ArgumentParser(description="Tier-1 NLI fact check (FACT-GUARD-NLI-001)")
    ap.add_argument("--download", action="store_true")
    ap.add_argument("--self-test", action="store_true")
    ap.add_argument("--draft")
    ap.add_argument("--kernel")
    ap.add_argument("--lang", choices=["en", "da", "sv"])
    ap.add_argument("--batch", help='JSON {"kernel_text": str, "sections": {id: text}, "lang": str|null}')
    ap.add_argument("--out")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    if a.download:
        _download()
        return
    if a.self_test:
        sys.exit(0 if self_test() else 1)
    if a.batch:
        job = json.load(open(a.batch, encoding="utf-8"))
        sc = Scorer()
        res = {sid: check(text, job.get("kernel_text", ""), job.get("lang"), sc)
               for sid, text in (job.get("sections") or {}).items() if str(text).strip()}
        json.dump(res, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        return
    if not (a.draft and a.kernel):
        ap.error("--draft and --kernel (or --batch / --download / --self-test)")
    ktext = "\n".join(G.flatten(json.load(open(a.kernel, encoding="utf-8"))))
    res = check(G.read_text(a.draft), ktext, a.lang)
    if a.json:
        print(json.dumps(res, ensure_ascii=False, indent=1))
    else:
        for r in res:
            print("%-12s s=%.2f %s" % (r["verdict"], r["support"], r["sentence"][:110]))
        print("%d to confirm, %d contradicted" % (len(res), sum(r["severity"] == "FAIL" for r in res)))
    sys.exit(1 if any(r["severity"] == "FAIL" for r in res) else 0)


if __name__ == "__main__":
    main()
