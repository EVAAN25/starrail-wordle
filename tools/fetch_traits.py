#!/usr/bin/env python3
"""从 BWIKI 角色页模板批量抓取 阵营/中文CV/体型 -> data/traits.json"""
import json, re, time, urllib.parse, urllib.request

BASE = "https://wiki.biligame.com/sr/api.php"

def api(params):
    url = BASE + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 fan-tool"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

chars = json.load(open("data/characters.json"))
names = [c["name"] for c in chars]

fetched = {}
for i in range(0, len(names), 40):
    batch = names[i:i+40]
    d = api({"action":"query","prop":"revisions","rvprop":"content","rvslots":"main",
             "redirects":"1","format":"json","titles":"|".join(batch)})
    red = {r["from"]: r["to"] for r in d.get("query",{}).get("redirects",[])}
    pages = {}
    for p in d.get("query",{}).get("pages",{}).values():
        if "missing" not in p:
            pages[p["title"]] = p["revisions"][0]["slots"]["main"]["*"]
    for n in batch:
        t = red.get(n, n)
        if t in pages: fetched[n] = pages[t]
    time.sleep(1)

def field(wt, name):
    m = re.search(r"\|\s*" + re.escape(name) + r"\s*=\s*([^\n|}]*)", wt)
    return m.group(1).strip() if m else ""

out, miss = {}, []
for c in chars:
    wt = fetched.get(c["name"], "")
    faction = field(wt, "阵营")
    cv = field(wt, "中文CV")
    body = field(wt, "体型")
    if not (faction and cv and body):
        miss.append((c["id"], c["name"], faction, cv, body))
    out[c["id"]] = {"faction": faction, "cv": cv, "body": body}

json.dump(out, open("data/traits.json","w"), ensure_ascii=False, indent=1)
print("done:", len(out), "missing fields:", miss)
from collections import Counter
print("factions:", Counter(v["faction"] for v in out.values()))
print("bodies:", Counter(v["body"] for v in out.values()))
