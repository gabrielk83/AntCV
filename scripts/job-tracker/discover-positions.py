#!/usr/bin/env python3
"""discover-positions.py — safe persistence half of the position-discovery task.

The AGENT does the judgment (web-search against the Dream Envelope, vet fit,
extract company/role/location/url, optionally the JD). This script does only the
DETERMINISTIC, SAFE part: dedup, append PROPOSED rows to the job-tracker doc, and
maintain a "discovered" ledger so a lead is never re-proposed after the owner
deletes or ignores it.

HARD SAFETY INVARIANTS (never auto-apply, never auto-generate):
  - Every proposed row gets queue[uk]=False. The gen nightly's gate is
    `bool(q) or (q is None and not has_art)` — an explicit False is NOT truthy
    and NOT None, so a proposed row is INELIGIBLE until the owner flips the ⏰
    flag (queue=True) in the UI. (Verified against gen-runner.eligible_rows.)
  - No application is created, no CV/CL is generated, nothing is submitted.
  - Rows land in group "Proposed" with flag "🔎" so they are visually separate.

Commands:
  context                       -> print existing companies/roles/urls + ledger
                                   keys (feed the agent so it does not re-search
                                   what is already tracked or already proposed)
  add --candidates <file.json>  -> file is a JSON list of objects:
      {company, role, location, url, why, fit?, jd?, tier?}
    Appends the non-duplicate ones as Proposed rows, updates the ledger, PUTs
    the doc rev-safe (re-fetch+merge+retry on 409). Prints what was added/skipped.

Auth: ~/.antcv/token (the PWA JWT). Requests send a browser User-Agent (CF 403s
the default python UA) and Origin https://antcv.pages.dev .
"""
import argparse
import datetime
import json
import os
import re
import sys
import urllib.request

RELAY = os.environ.get("ANTCV_RELAY", "https://antcv-access-relay.karp-gabriel-a.workers.dev").rstrip("/")
_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"


def _token():
    p = os.path.expanduser("~/.antcv/token")
    if not os.path.exists(p):
        sys.exit("NO TOKEN at ~/.antcv/token — owner must re-save it from the PWA console.")
    return open(p, encoding="utf-8").read().strip()


def _req(path, method="GET", body=None, timeout=60):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(RELAY + path, data=data, method=method, headers={
        "Authorization": "Bearer " + _token(), "User-Agent": _UA,
        "Origin": "https://antcv.pages.dev", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, {"error": e.read().decode()[:300]}


def get_doc():
    c, b = _req("/api/job-tracker")
    if c != 200:
        sys.exit(f"job-tracker GET failed: {c} {str(b)[:200]}")
    return b.get("rev"), (b.get("doc") or {})


def _norm_url(u):
    u = (u or "").strip().lower()
    u = re.sub(r"^https?://(www\.)?", "", u)
    u = u.split("#")[0].split("?")[0].rstrip("/")
    return u


def _norm_cr(company, role):
    def n(s):
        return re.sub(r"[^a-z0-9]+", "", (s or "").lower())
    return n(company) + "|" + n(role)


def _slug(company, existing):
    base = re.sub(r"[^a-z0-9]+", "_", (company or "job").lower()).strip("_")[:20] or "job"
    uk = base
    i = 2
    while uk in existing:
        uk = f"{base}_{i}"
        i += 1
    return uk


def _existing_keys(doc):
    """Every dedup key already represented: existing-row url/company|role AND the
    ledger. A lead matching any of these is skipped."""
    rows = doc.get("rows") or []
    urls = doc.get("urls") or {}
    keys = set()
    uks = set()
    for row in rows:
        uk = row[11] if len(row) > 11 and row[11] else (str(row[1]) + "|" + str(row[2]))
        uks.add(uk)
        keys.add(_norm_cr(row[1] if len(row) > 1 else "", row[2] if len(row) > 2 else ""))
    for u in urls.values():
        if u:
            keys.add(_norm_url(u))
    for k in (doc.get("discovered") or {}):
        keys.add(k)
    return keys, uks


def cmd_context(_):
    _, doc = get_doc()
    rows = doc.get("rows") or []
    urls = doc.get("urls") or {}
    led = doc.get("discovered") or {}
    print(f"# tracker has {len(rows)} rows, {len(led)} discovered-ledger keys")
    print("## already tracked (company | role | location):")
    for row in rows:
        loc = row[3] if len(row) > 3 else ""
        print(f"  - {row[1]} | {row[2]} | {loc}")
    print("## posting URLs already tracked:")
    for u in urls.values():
        if u:
            print(f"  - {u}")
    print("## discovered-ledger keys (already proposed once; do NOT re-propose):")
    for k, v in led.items():
        print(f"  - {k}  ({(v or {}).get('first_seen','?')})")


def cmd_add(args):
    cands = json.load(open(args.candidates, encoding="utf-8"))
    if not isinstance(cands, list):
        sys.exit("--candidates must be a JSON list")
    today = datetime.date.today().isoformat()
    added, skipped = [], []

    for attempt in range(4):
        rev, doc = get_doc()
        doc.setdefault("rows", [])
        doc.setdefault("urls", {})
        doc.setdefault("jd", {})
        doc.setdefault("queue", {})
        doc.setdefault("gen", {})
        doc.setdefault("discovered", {})
        keys, uks = _existing_keys(doc)
        added, skipped = [], []
        ranks = [row[0] for row in doc["rows"] if isinstance(row[0], (int, float))]
        next_rank = (max(ranks) + 1) if ranks else 1

        for c in cands:
            company = str(c.get("company") or "").strip()
            role = str(c.get("role") or "").strip()
            url = str(c.get("url") or "").strip()
            if not company or not role:
                skipped.append((company or url or "?", "missing company/role"))
                continue
            ck_url = _norm_url(url) if url else None
            ck_cr = _norm_cr(company, role)
            if (ck_url and ck_url in keys) or ck_cr in keys:
                skipped.append((f"{company} / {role}", "duplicate/already-proposed"))
                continue
            uk = _slug(company, uks)
            uks.add(uk)
            loc = str(c.get("location") or "").strip()
            fit = str(c.get("fit") or "").strip()
            jd = str(c.get("jd") or "").strip()
            # row schema: [rank,company,role,location,commute,group,fit,posting,
            #              tracked,next,flag,urlkey,band]
            doc["rows"].append([
                next_rank, company, role, loc, "", "Proposed", fit, url,
                today, "Review", "🔎", uk, "proposed"])
            next_rank += 1
            if url:
                doc["urls"][uk] = url
            if len(jd) > 200:
                doc["jd"][uk] = jd            # stored, but NEVER auto-generated:
            doc["queue"][uk] = False          # <-- the hard safety gate
            if c.get("tier"):
                doc["gen"][uk] = str(c["tier"])
            ledkey = ck_url or ck_cr
            doc["discovered"][ledkey] = {"first_seen": today, "uk": uk,
                                         "company": company, "role": role, "url": url,
                                         "why": str(c.get("why") or "")[:300]}
            keys.add(ledkey)
            if ck_url:
                keys.add(ck_url)
            keys.add(ck_cr)
            added.append((f"{company} / {role}", uk, "jd" if len(jd) > 200 else "url-only"))

        if not added:
            break
        c, b = put_doc(doc, rev)
        if c == 200:
            break
        if c == 409:
            print(f"  409 (rev moved to {b.get('rev')}), re-merging (attempt {attempt+1})…")
            continue
        sys.exit(f"PUT failed: {c} {str(b)[:200]}")

    print(f"\nADDED {len(added)} proposed row(s):")
    for name, uk, mode in added:
        print(f"  + {name}  [{uk}, {mode}, queue=False]")
    print(f"SKIPPED {len(skipped)}:")
    for name, why in skipped:
        print(f"  - {name}  ({why})")
    # machine-readable tail for the agent's report
    print("\nJSON " + json.dumps({"added": len(added), "skipped": len(skipped),
                                  "added_rows": [{"name": n, "uk": u} for n, u, _ in added]}))


def put_doc(doc, base_rev):
    return _req("/api/job-tracker", "PUT", {"doc": doc, "base_rev": base_rev})


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("context").set_defaults(fn=cmd_context)
    a = sub.add_parser("add")
    a.add_argument("--candidates", required=True)
    a.set_defaults(fn=cmd_add)
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
