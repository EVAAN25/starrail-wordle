#!/usr/bin/env python3
"""抓取 BWIKI 角色语音：解析 语音 页 wikitext -> 选 7 条短语音 -> 解析真实 URL -> 下载转码 m4a 32kbps
输出 data/voice.json + assets/voice/{cid}_{n}.m4a
用法: python3 tools/fetch_voice.py [--download]   (不加 --download 只生成清单)
"""
import json, re, sys, time, subprocess, urllib.parse, urllib.request, os
from concurrent.futures import ThreadPoolExecutor

BASE = "https://wiki.biligame.com/sr/api.php"
UA = {"User-Agent": "Mozilla/5.0 fan-tool"}
# 类型偏好顺序；避开剧透/关系类（关于、星魂、队伍编成、晋阶等）
PREFER = ["初次见面", "问候", "道别", "闲谈", "爱好", "烦恼", "分享", "战斗开始",
          "战技", "终结技", "普攻", "秘技", "天赋", "受击", "弱点击破", "轻伤", "重伤", "无法战斗"]
AVOID = ["关于", "星魂", "队伍编成", "晋阶", "满级", "行迹", "返场"]
PICK = 7

def api(params):
    url = BASE + "?" + urllib.parse.urlencode(params)
    for attempt in range(8):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
                return json.load(r)
        except Exception as e:
            wait = 2 * (attempt + 1)
            print(f"  api retry {attempt+1} ({e}), sleep {wait}s")
            time.sleep(wait)
    raise RuntimeError("api failed: " + url[:120])

chars = json.load(open("data/characters.json"))

# 1) 批量拉 语音 页 wikitext（主条目重定向自动跟随；巡猎三月七单独指名）
titles = []
for c in chars:
    titles.append("三月七•巡猎/语音" if c["id"] == "1224" else f"{c['name']}/语音")

pages = {}
for i in range(0, len(titles), 40):
    batch = titles[i:i+40]
    d = api({"action":"query","prop":"revisions","rvprop":"content","rvslots":"main",
             "redirects":"1","format":"json","titles":"|".join(batch)})
    red = {}
    for r in d.get("query",{}).get("redirects",[]): red[r["from"]] = r["to"]
    got = {}
    for p in d.get("query",{}).get("pages",{}).values():
        if "missing" not in p:
            got[p["title"]] = p["revisions"][0]["slots"]["main"]["*"]
    for t in batch:
        pages[t] = got.get(red.get(t, t), "")
    time.sleep(1)
    print(f"pages {i+len(batch)}/{len(titles)}")

def parse_voices(wt):
    out = []
    for block in re.findall(r"\{\{角色语音(.+?)\}\}", wt, re.S):
        def f(k):
            m = re.search(r"\|\s*" + k + r"\s*=\s*([^\n]*)", block)
            return m.group(1).strip() if m else ""
        typ, file, text = f("语音类型"), f("语音文件"), f("语音内容")
        if typ and file and text:
            out.append({"type": typ, "file": file, "text": text})
    return out

def score(v):
    t = v["type"]
    if any(a in t for a in AVOID): return -1
    for i, p in enumerate(PREFER):
        if t.startswith(p): return i
    return len(PREFER)

# 2) 每角色选 PICK 条
selection = {}
for c in chars:
    t = "三月七•巡猎/语音" if c["id"] == "1224" else f"{c['name']}/语音"
    vs = [v for v in parse_voices(pages.get(t, "")) if score(v) >= 0]
    vs.sort(key=score)
    if len(vs) >= 4:
        selection[c["id"]] = vs[:PICK]
print("chars with voice:", len(selection))

# 3) 批量解析 File: URL（先试 .ogg，missing 再试 .mp3）
def resolve(names, ext):
    res = {}
    for i in range(0, len(names), 40):
        batch = names[i:i+40]
        d = api({"action":"query","prop":"imageinfo","iiprop":"url","format":"json",
                 "titles":"|".join(f"File:{n}.{ext}" for n in batch)})
        # File: 可能被规范化为「文件:」，用 normalized 映射回原查询名
        norm = {n.get("to", ""): n.get("from", "") for n in d.get("query",{}).get("normalized",[])}
        for p in d.get("query",{}).get("pages",{}).values():
            title = p["title"]
            orig = norm.get(title, title)
            if ":" in orig: orig = orig.split(":", 1)[1]
            if orig.endswith("." + ext): orig = orig[: -len("." + ext)]
            if "missing" not in p and p.get("imageinfo"):
                res[orig] = p["imageinfo"][0]["url"]
        time.sleep(0.6)
    return res

all_files = sorted({v["file"] for vs in selection.values() for v in vs})
print("unique clips:", len(all_files))
urls = resolve(all_files, "ogg")
rest = [n for n in all_files if n not in urls]
if rest:
    print("retry mp3:", len(rest))
    urls.update(resolve(rest, "mp3"))
missing = [n for n in all_files if n not in urls]
print("resolved:", len(urls), "missing:", len(missing), missing[:5])

# 4) 生成 data/voice.json
voice = {}
for cid, vs in selection.items():
    clips = []
    for i, v in enumerate(vs):
        if v["file"] in urls:
            clips.append({"n": i, "type": v["type"], "text": v["text"], "src": urls[v["file"]]})
    if len(clips) >= 4:
        voice[cid] = {"clips": clips}
json.dump(voice, open("data/voice.json","w"), ensure_ascii=False, indent=1)
print("voice.json chars:", len(voice), "clips:", sum(len(v['clips']) for v in voice.values()))

# 5) 下载 + 转码（--download 时）
if "--download" in sys.argv:
    os.makedirs("assets/voice", exist_ok=True)
    os.makedirs("/tmp/srvoice", exist_ok=True)
    jobs = []
    for cid, v in voice.items():
        for cl in v["clips"]:
            ext = "mp3" if cl["src"].endswith(".mp3") else "ogg"
            raw = f"/tmp/srvoice/{cid}_{cl['n']}.{ext}"
            out = f"assets/voice/{cid}_{cl['n']}.m4a"
            jobs.append((cl["src"], raw, out))
    def work(job):
        src, raw, out = job
        if os.path.exists(out): return "skip"
        for _ in range(4):
            r = subprocess.run(["curl","-sL","--max-time","60","-o",raw,src])
            if r.returncode == 0 and os.path.getsize(raw) > 1000: break
            time.sleep(1)
        else: return f"DL-FAIL {src}"
        r = subprocess.run(["ffmpeg","-y","-loglevel","error","-i",raw,
                            "-ac","1","-b:a","32k","-f","mp4",out])
        return "ok" if r.returncode == 0 else f"FF-FAIL {raw}"
    with ThreadPoolExecutor(8) as ex:
        results = list(ex.map(work, jobs))
    fails = [r for r in results if r not in ("ok","skip")]
    print("downloaded:", results.count("ok"), "skip:", results.count("skip"), "fail:", len(fails))
    for f in fails[:10]: print(f)
    # 更新 voice.json 指向本地文件
    for cid, v in voice.items():
        for cl in v["clips"]:
            cl["file"] = f"assets/voice/{cid}_{cl['n']}.m4a"
            del cl["src"]
    json.dump(voice, open("data/voice.json","w"), ensure_ascii=False, indent=1)
    print("voice.json localized")
