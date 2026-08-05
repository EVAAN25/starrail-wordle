#!/usr/bin/env python3
"""抓取星铁 B站官号全部视频，按角色匹配角色PV/千星纪游/走近星穹播放量 -> data/popularity.json
真数据，页面需注明抓取日期。用法: python3 tools/fetch_popularity.py
"""
import json, os, re, sys, time, datetime
sys.path.insert(0, "tools")
from wbi_test import bootstrap_cookies, get_mixin_key, wbi_sign, get, MID

chars = json.load(open("data/characters.json"))

def fetch_all():
    mk = None
    videos = []
    cache = "tools/bili_videos_cache.json"
    if os.path.exists(cache):
        videos = json.load(open(cache))
        print("resume from cache:", len(videos))
    pn = len(videos) // 30 + 1
    fails = 0
    while True:
        data = None
        for attempt in range(20):
            time.sleep(12)
            if mk is None or attempt >= 3:
                bootstrap_cookies()
                mk = get_mixin_key()
            q = wbi_sign({"mid": MID, "ps": 30, "pn": pn, "order": "pubdate"}, mk)
            try:
                data = json.loads(get(f"https://api.bilibili.com/x/space/wbi/arc/search?{q}"))
            except Exception as e:
                print(f"  pn{pn} attempt{attempt+1} err {e}")
                continue
            if data.get("code") == 0:
                break
            print(f"  pn{pn} retry {attempt+1}: code={data.get('code')}")
        if not data or data.get("code") != 0:
            json.dump(videos, open(cache, "w"), ensure_ascii=False)
            raise RuntimeError(f"page {pn} failed, partial={len(videos)} saved")
        vl = data["data"]["list"]["vlist"]
        videos += vl
        json.dump(videos, open(cache, "w"), ensure_ascii=False)
        total = data["data"]["page"]["count"]
        print(f"page {pn}: {len(vl)} (cum {len(videos)}/{total})")
        if len(videos) >= total or not vl:
            break
        pn += 1
    return videos

TYPE_RANK = ["角色PV", "千星纪游", "走近星穹", "PV"]

def match_video(name, videos, used):
    """返回 (type, video)。优先 角色PV > 千星纪游 > 走近星穹；已被更长名字占用的视频跳过。"""
    hits = [v for v in videos if name in v["title"] and v["bvid"] not in used]
    for t in TYPE_RANK:
        for v in hits:
            if t in v["title"]:
                return t, v
    return None, None

def main():
    cache = "tools/bili_videos_cache.json"
    if os.path.exists(cache) and len(json.load(open(cache))) >= 300:
        videos = json.load(open(cache))
        print("use cache:", len(videos))
    else:
        videos = fetch_all()
        json.dump(videos, open(cache, "w"), ensure_ascii=False)
    out = {}
    unmatched = []
    seen_names = set()
    used_bvids = set()
    # 名字长的先匹配（如「大黑塔」先于「黑塔」），避免短名抢占长名的视频
    ordered = sorted(chars, key=lambda c: -len(c["name"]))
    for c in ordered:  # 同名的形态只算一次（用第一次出现的 id）
        if c["name"] in seen_names: continue
        seen_names.add(c["name"])
        t, v = match_video(c["name"], videos, used_bvids)
        if v:
            used_bvids.add(v["bvid"])
            out[c["id"]] = {"name": c["name"], "views": v["play"], "title": v["title"],
                            "bvid": v["bvid"], "vtype": t}
        else:
            unmatched.append(c["name"])
    result = {
        "source": "B站「崩坏星穹铁道」官号 (space.bilibili.com/1340190821)",
        "fetched_at": datetime.date.today().isoformat(),
        "estimated": False,
        "note": "取每角色播放量最高的一条官方角色PV/千星纪游/走近星穹；无独立角色视频的角色按 0 处理，不入题池",
        "data": out,
    }
    json.dump(result, open("data/popularity.json", "w"), ensure_ascii=False, indent=1)
    print(f"matched {len(out)}/{len(seen_names)}, unmatched: {unmatched}")

if __name__ == "__main__":
    main()
