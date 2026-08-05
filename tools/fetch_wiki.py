#!/usr/bin/env python3
"""从 BWIKI (wiki.biligame.com/sr) MediaWiki API 批量抓取角色 性别 / 实装版本。
输出 data/wiki_extra.json: {id: {gender, version, source_page, ok}}
"""
import json, re, time, urllib.parse, urllib.request

BASE = "https://wiki.biligame.com/sr/api.php"
PATH_CN = {"Knight":"存护","Warrior":"毁灭","Rogue":"巡猎","Mage":"智识",
           "Shaman":"同谐","Warlock":"虚无","Priest":"丰饶","Memory":"记忆","Elation":"欢愉"}

src = json.load(open("tools/source_characters.json"))
chars = [v for v in src.values() if v["name"] != "{NICKNAME}"]  # 排除开拓者占位
print("playable:", len(chars))

def api(params):
    url = BASE + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 fan-tool"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

def fetch_titles(titles):
    """批量取 wikitext，自动跟重定向。返回 {最终标题: wikitext}"""
    out = {}
    d = api({"action":"query","prop":"revisions","rvprop":"content","rvslots":"main",
             "redirects":"1","format":"json","titles":"|".join(titles)})
    redirects = {r["to"]: r["from"] for r in d.get("query",{}).get("redirects",[])}
    for p in d.get("query",{}).get("pages",{}).values():
        if "missing" in p: continue
        title = p["title"]
        wt = p["revisions"][0]["slots"]["main"]["*"]
        out[title] = wt
    # 把重定向前的原始标题也映射上
    for to, frm in redirects.items():
        if to in out: out[frm] = out[to]
    return out

def parse_fields(wt):
    g = re.search(r"\|\s*性别\s*=\s*([^\n|}]*)", wt)
    v = re.search(r"\|\s*实装版本\s*=\s*([^\n|}]*)", wt)
    g = g.group(1).strip() if g else None
    v = v.group(1).strip() if v else None
    if g and g not in ("男","女"): g = None
    if v:
        m = re.match(r"^(\d+\.\d+)", v)
        v = m.group(1) if m else None
    return g, v

result = {}
# 候选标题：先试 名字 本体（会自动重定向，如 三月七→三月七•存护），再试 名字•命途
todo = {}
for c in chars:
    cid, name, path = c["id"], c["name"], PATH_CN[c["path"]]
    todo[cid] = [name, f"{name}•{path}"]

# 第一轮：所有首选标题批量查
first = [t[0] for t in todo.values()]
fetched = {}
for i in range(0, len(first), 40):
    batch = first[i:i+40]
    fetched.update(fetch_titles(batch))
    time.sleep(1)

need_second = []
for c in chars:
    cid, name = c["id"], c["name"]
    wt = fetched.get(todo[cid][0])
    if wt and "{{角色图鉴" in wt:
        g, v = parse_fields(wt)
        if g and v:
            result[cid] = {"gender": g, "version": v, "source_page": todo[cid][0], "ok": True}
            continue
    need_second.append(c)

print("first round ok:", len(result), "need fallback:", len(need_second))
# 第二轮：fallback 标题逐个查（含 名字•命途）
for c in need_second:
    cid = c["id"]
    got = False
    for t in todo[cid]:
        try:
            pages = fetch_titles([t])
        except Exception as e:
            print(cid, t, "ERR", e); time.sleep(2); continue
        wt = pages.get(t)
        if wt and "{{角色图鉴" in wt:
            g, v = parse_fields(wt)
            if g and v:
                result[cid] = {"gender": g, "version": v, "source_page": t, "ok": True}
                got = True
                break
        time.sleep(0.5)
    if not got:
        result[cid] = {"gender": None, "version": None, "source_page": None, "ok": False}
        print("MISS", cid, c["name"])

json.dump(result, open("data/wiki_extra.json","w"), ensure_ascii=False, indent=1)
ok = sum(1 for r in result.values() if r["ok"])
print(f"done: {ok}/{len(chars)} ok -> data/wiki_extra.json")
