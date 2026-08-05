#!/usr/bin/env python3
"""离线生成「阵营连线」(NYT Connections 式) 题库 -> data/connections.json
每题 16 角色分 4 组，每组 4 人共享某个维度值；暴力枚举校验全题唯一解。
维度：命途 / 元素 / 阵营 / 体型 / 实装版本（同题内 4 组各用不同维度）。
"""
import json, random, itertools
from collections import Counter

random.seed(20260805)

chars = json.load(open("data/characters.json"))
traits = json.load(open("data/traits.json"))
byid = {c["id"]: c for c in chars}

DIMS = {
    "path": lambda cid: byid[cid]["path"],
    "element": lambda cid: byid[cid]["element"],
    "faction": lambda cid: traits[cid]["faction"],
    "body": lambda cid: traits[cid]["body"],
    "version": lambda cid: byid[cid]["version"].split(".")[0] + ".x",
}
DIM_LABEL = {"path": "命途", "element": "元素", "faction": "阵营", "body": "体型", "version": "实装版本"}
# 难度排序（黄=最易 -> 紫=最难）
DIM_RANK = {"body": 0, "element": 1, "faction": 2, "path": 3, "version": 4}

# 每个维度可用的值（至少 4 个角色）
POOL = {}
for dim, get in DIMS.items():
    cnt = Counter(get(c["id"]) for c in chars)
    POOL[dim] = {v: [c["id"] for c in chars if get(c["id"]) == v]
                 for v, n in cnt.items() if n >= 4}
for d in POOL: print(d, {v: len(ids) for v, ids in sorted(POOL[d].items())})

def shares_dim(quad):
    """4 人是否在某个维度上同值，返回 (dim, value) 或 None"""
    for dim, get in DIMS.items():
        vals = {get(cid) for cid in quad}
        if len(vals) == 1:
            return (dim, vals.pop())
    return None

def all_partitions(ids):
    """把 16 个 id 分成 4 组 4 人的所有分法（每组须同维度同值），返回分法数量与第一种"""
    ids = tuple(sorted(ids))
    solutions = []
    def rec(rest, groups):
        if not rest:
            solutions.append(groups)
            return len(solutions) > 1  # 找到两个就够，提前停
        first = rest[0]
        for combo in itertools.combinations(rest[1:], 3):
            quad = (first,) + combo
            if shares_dim(quad) is None: continue
            newrest = tuple(x for x in rest if x not in quad)
            if rec(newrest, groups + [quad]): return True
        return False
    rec(ids, [])
    return solutions

def make_puzzle():
    dims = random.sample(list(DIMS), 4)
    groups = []
    used = set()
    for dim in dims:
        cands = [(v, ids) for v, ids in POOL[dim].items()]
        random.shuffle(cands)
        picked = None
        for v, ids in cands:
            avail = [i for i in ids if i not in used]
            if len(avail) >= 4:
                members = random.sample(avail, 4)
                # 该维度的这个值，在已选角色里不能再出现（否则容易多解）
                if any(DIMS[dim](u) == v for u in used): continue
                picked = {"dim": dim, "value": v, "members": members}
                break
        if picked is None: return None
        used.update(picked["members"])
        groups.append(picked)
    # 唯一解校验：所有合法分法只有 intended 这一种
    sols = all_partitions(used)
    if len(sols) != 1: return None
    groups.sort(key=lambda g: DIM_RANK[g["dim"]])
    return {
        "groups": [
            {"label": f"{DIM_LABEL[g['dim']]}：{g['value']}",
             "dim": g["dim"], "value": g["value"],
             "members": sorted(g["members"])}
            for g in groups
        ]
    }

puzzles, seen = [], set()
tries = 0
while len(puzzles) < 66 and tries < 4000:
    tries += 1
    p = make_puzzle()
    if p is None: continue
    key = tuple(sorted(tuple(g["members"]) for g in p["groups"]))
    if key in seen: continue
    seen.add(key)
    puzzles.append(p)
    if len(puzzles) % 10 == 0: print("made", len(puzzles), "tries", tries)

json.dump(puzzles, open("data/connections.json", "w"), ensure_ascii=False, indent=1)
print(f"done: {len(puzzles)} puzzles, tries={tries}")
dimuse = Counter(g["dim"] for p in puzzles for g in p["groups"])
print("dim usage:", dimuse)
