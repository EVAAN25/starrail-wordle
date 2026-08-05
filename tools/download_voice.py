#!/usr/bin/env python3
"""只下载：读取 data/voice.json 里的 src URL，下载转码到 assets/voice/ 并把 voice.json 改指本地文件。
（fetch_voice.py 已解析过 URL 时用本脚本，避免重复打 BWIKI。）"""
import json, os, subprocess, time
from concurrent.futures import ThreadPoolExecutor

voice = json.load(open("data/voice.json"))
os.makedirs("assets/voice", exist_ok=True)
os.makedirs("/tmp/srvoice", exist_ok=True)

jobs = []
for cid, v in voice.items():
    for cl in v["clips"]:
        if "src" not in cl: continue
        ext = "mp3" if cl["src"].endswith(".mp3") else "ogg"
        jobs.append((cl["src"], f"/tmp/srvoice/{cid}_{cl['n']}.{ext}", f"assets/voice/{cid}_{cl['n']}.m4a"))
print("jobs:", len(jobs))

def work(job):
    src, raw, out = job
    if os.path.exists(out) and os.path.getsize(out) > 1000: return "skip"
    for _ in range(5):
        r = subprocess.run(["curl", "-sL", "--max-time", "60", "-o", raw, src])
        if r.returncode == 0 and os.path.exists(raw) and os.path.getsize(raw) > 1000: break
        time.sleep(1)
    else:
        return f"DL-FAIL {src}"
    r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", raw,
                        "-ac", "1", "-b:a", "32k", "-f", "mp4", out])
    return "ok" if r.returncode == 0 else f"FF-FAIL {raw}"

with ThreadPoolExecutor(8) as ex:
    results = list(ex.map(work, jobs))
fails = [r for r in results if r not in ("ok", "skip")]
print("ok:", results.count("ok"), "skip:", results.count("skip"), "fail:", len(fails))
for f in fails[:10]: print(f)

for cid, v in voice.items():
    v["clips"] = [cl for cl in v["clips"]
                  if os.path.exists(f"assets/voice/{cid}_{cl['n']}.m4a")]
    for cl in v["clips"]:
        cl["file"] = f"assets/voice/{cid}_{cl['n']}.m4a"
        cl.pop("src", None)
voice = {cid: v for cid, v in voice.items() if len(v["clips"]) >= 4}
json.dump(voice, open("data/voice.json", "w"), ensure_ascii=False, indent=1)
print("final:", len(voice), "chars,", sum(len(v["clips"]) for v in voice.values()), "clips")
