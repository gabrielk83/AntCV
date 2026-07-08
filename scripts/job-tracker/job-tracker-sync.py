#!/usr/bin/env python3
# JOB-TRACKER-001 — local sync client for the AntCV job-search workbook.
# Syncs a canonical job_tracker_doc.json <-> the D1-backed /api/job-tracker
# endpoint on the access-relay. D1 is the source of truth; the Excel workbook
# is rendered FROM the doc (build script, doc-driven via JOB_DOC).
#
# This tool is GENERIC (no personal data). The doc + the Excel build script
# live locally (not committed) per the repo's "no candidate data" rule.
#
# Auth: the relay verifies a JWT (the same token the PWA holds after sign-in).
#   Provide it via  env ANTCV_TOKEN  or a file (default ~/.antcv/token).
#   Get it from the PWA: DevTools > Application > Local Storage > your token,
#   or however you export your session key.
#
# Commands:
#   pull            GET the cloud doc -> write local doc + snapshot; --render also rebuilds the .xlsx
#   push            PUT the local doc with the snapshot's base_rev; on 409 do a row-level 3-way merge and retry
#   import-xlsx      read the (edited) Weekly Tracker sheet back into the local doc, then run `push`
#   status           show local rev vs cloud rev and whether they diverge
#
# Config via env (all optional):
#   ANTCV_RELAY   default https://antcv-access-relay.karp-gabriel-a.workers.dev
#   ANTCV_TOKEN   JWT bearer token (else read ANTCV_TOKEN_FILE)
#   ANTCV_TOKEN_FILE  default ~/.antcv/token
#   JOB_DOC       path to job_tracker_doc.json (canonical)
#   JOB_BUILD     path to the local doc-driven Excel build script (for --render)
#   JOB_XLSX      path to the .xlsx (for import-xlsx)
import os, sys, json, hashlib, subprocess, urllib.request, urllib.error

RELAY = os.environ.get("ANTCV_RELAY", "https://antcv-access-relay.karp-gabriel-a.workers.dev").rstrip("/")
DOC   = os.environ.get("JOB_DOC",  os.path.expanduser("~/job_tracker_doc.json"))
BUILD = os.environ.get("JOB_BUILD")
XLSX  = os.environ.get("JOB_XLSX")
SNAP  = DOC + ".sync"          # snapshot: {"rev": int, "doc": {...}}
ENDPOINT = RELAY + "/api/job-tracker"

def _token():
    t = os.environ.get("ANTCV_TOKEN")
    if t: return t.strip()
    p = os.environ.get("ANTCV_TOKEN_FILE", os.path.expanduser("~/.antcv/token"))
    if os.path.exists(p):
        return open(p, "r", encoding="utf-8").read().strip()
    sys.exit("No token. Set ANTCV_TOKEN or put it in " + p)

def _req(method, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(ENDPOINT, data=data, method=method,
        headers={"Authorization": "Bearer " + _token(),
                 "Content-Type": "application/json",
                 "Origin": "https://antcv.pages.dev"})
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try: payload = json.loads(e.read().decode() or "{}")
        except Exception: payload = {}
        return e.code, payload

def _load(p, default=None):
    return json.load(open(p, "r", encoding="utf-8")) if os.path.exists(p) else default

def _save(p, obj):
    os.makedirs(os.path.dirname(os.path.abspath(p)), exist_ok=True)
    json.dump(obj, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

def _rows_by_id(doc):
    # row id = urlkey (index 11 in the tuple/list); fall back to company+role.
    out = {}
    for row in (doc.get("rows") or []):
        rid = row[11] if len(row) > 11 and row[11] else (str(row[1]) + "|" + str(row[2]))
        out[rid] = row
    return out

def cmd_status():
    code, remote = _req("GET")
    snap = _load(SNAP, {"rev": 0})
    local = _load(DOC)
    print(f"cloud rev: {remote.get('rev') if code==200 else 'ERR '+str(code)}")
    print(f"snapshot rev: {snap.get('rev', 0)}")
    print(f"local doc: {'present' if local else 'MISSING'} ({DOC})")
    if code == 200 and local:
        diverged = remote.get("rev") != snap.get("rev")
        localdirty = _load(SNAP, {}).get("doc") != local
        print(f"cloud advanced since last sync: {diverged}")
        print(f"local edited since last sync:  {localdirty}")

def cmd_pull(render=False):
    code, remote = _req("GET")
    if code != 200: sys.exit(f"pull failed: {code} {remote}")
    doc = remote.get("doc")
    if doc is None:
        print("cloud is empty — nothing to pull. (Run push to seed it.)")
        return
    _save(DOC, doc)
    _save(SNAP, {"rev": remote.get("rev", 0), "doc": doc})
    print(f"pulled rev {remote.get('rev')} -> {DOC}")
    if render:
        if not BUILD: sys.exit("--render needs JOB_BUILD (path to the doc-driven Excel build script)")
        env = dict(os.environ, JOB_DOC=DOC)
        subprocess.run([sys.executable, BUILD], check=True, env=env)
        print("rebuilt .xlsx from pulled doc")

def _merge(base, local, remote):
    # Row-level 3-way by id. For each id: if only one side changed vs base, take
    # that side; if both changed the same row differently, LOCAL wins and the id
    # is reported as a conflict (never silently dropped).
    b, l, r = _rows_by_id(base or {}), _rows_by_id(local), _rows_by_id(remote)
    ids = list(dict.fromkeys(list(r.keys()) + list(l.keys())))
    merged, conflicts = [], []
    for i in ids:
        bl, ll, rr = b.get(i), l.get(i), r.get(i)
        if ll is None: merged.append(rr); continue          # deleted locally? keep remote (safe)
        if rr is None: merged.append(ll); continue          # new local row
        if ll == rr: merged.append(ll); continue
        lc, rc = (ll != bl), (rr != bl)
        if lc and not rc: merged.append(ll)
        elif rc and not lc: merged.append(rr)
        else: merged.append(ll); conflicts.append(i)        # both changed -> local wins, flag
    out = dict(local)
    out["rows"] = merged
    # envelope: last-writer (local) wins whole-block; report if it differs from remote
    if remote.get("envelope") != local.get("envelope"): conflicts.append("envelope(local-wins)")
    out["urls"] = {**(remote.get("urls") or {}), **(local.get("urls") or {})}
    return out, conflicts

def cmd_push():
    local = _load(DOC)
    if not local: sys.exit(f"no local doc at {DOC}")
    snap = _load(SNAP, {"rev": 0, "doc": None})
    code, resp = _req("PUT", {"doc": local, "base_rev": snap.get("rev", 0)})
    if code == 200:
        _save(SNAP, {"rev": resp["rev"], "doc": local})
        print(f"pushed -> rev {resp['rev']}")
        return
    if code == 409:
        remote = resp.get("doc")
        print(f"conflict: cloud is at rev {resp.get('rev')} (snapshot {snap.get('rev')}). Merging…")
        merged, conflicts = _merge(snap.get("doc"), local, remote)
        code2, resp2 = _req("PUT", {"doc": merged, "base_rev": resp.get("rev")})
        if code2 != 200: sys.exit(f"merge push failed: {code2} {resp2}")
        _save(DOC, merged); _save(SNAP, {"rev": resp2["rev"], "doc": merged})
        print(f"merged & pushed -> rev {resp2['rev']}")
        if conflicts: print("CONFLICTS (local kept, review these ids):", ", ".join(conflicts))
        return
    sys.exit(f"push failed: {code} {resp}")

def cmd_import_xlsx():
    # Read the edited Weekly Tracker sheet back into the local doc, preserving
    # each row's url-key (col 12) + band colour (from the row fill) by matching
    # on rank -> then company+role. Then push.
    from openpyxl import load_workbook
    if not XLSX: sys.exit("import-xlsx needs JOB_XLSX (path to the .xlsx)")
    doc = _load(DOC) or {"version": 1, "rows": [], "envelope": [], "urls": {}}
    old = _rows_by_id(doc)
    by_rank = {row[0]: row for row in doc.get("rows", [])}
    wb = load_workbook(XLSX)
    ws = wb["Weekly Tracker"]
    # header row is 4; data starts row 5. Columns: 2=Rank..12=Flag (1-based).
    new_rows = []
    for r in range(5, ws.max_row + 1):
        rank = ws.cell(r, 2).value
        comp = ws.cell(r, 3).value
        if rank is None and not comp: continue
        vals = [ws.cell(r, c).value for c in range(2, 13)]  # rank..flag (11 fields)
        prev = by_rank.get(rank) or old.get(str(rank) + "|" + str(comp))
        uk = prev[11] if prev and len(prev) > 11 else (str(comp or "row").lower().split()[0])
        band = None
        f = ws.cell(r, 2).fill
        if f and f.fgColor and f.fgColor.rgb and str(f.fgColor.rgb) not in ("00000000",):
            band = str(f.fgColor.rgb)[-6:]
        if not band and prev and len(prev) > 12: band = prev[12]
        new_rows.append(list(vals) + [uk, band or "E2EFDA"])
    doc["rows"] = new_rows
    _save(DOC, doc)
    print(f"imported {len(new_rows)} tracker rows from .xlsx -> {DOC}")
    cmd_push()

def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    if cmd == "pull": cmd_pull(render=("--render" in sys.argv))
    elif cmd == "push": cmd_push()
    elif cmd == "import-xlsx": cmd_import_xlsx()
    elif cmd == "status": cmd_status()
    else: sys.exit("usage: job-tracker-sync.py [pull [--render] | push | import-xlsx | status]")

if __name__ == "__main__":
    main()
