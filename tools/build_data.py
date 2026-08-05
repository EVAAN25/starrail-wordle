#!/usr/bin/env python3
"""合并 StarRailRes + BWIKI 数据，生成最终 data/characters.json"""
import json

PATH_CN = {"Knight":"存护","Warrior":"毁灭","Rogue":"巡猎","Mage":"智识",
           "Shaman":"同谐","Warlock":"虚无","Priest":"丰饶","Memory":"记忆","Elation":"欢愉"}
ELEM_CN = {"Ice":"冰","Fire":"火","Wind":"风","Thunder":"雷",
           "Quantum":"量子","Imaginary":"虚数","Physical":"物理"}

src = json.load(open("tools/source_characters.json"))
extra = json.load(open("data/wiki_extra.json"))

# 同名角色消歧：三月七 两个形态，下拉与展示需要区分
DISPLAY = {"1001": "三月七·存护", "1224": "三月七·巡猎"}

# 同一本体的不同形态（用于“接近/同本体”橙色语义）
GROUPS = {
    "1001": "三月七", "1224": "三月七",
    "1002": "丹恒", "1213": "丹恒", "1414": "丹恒",
    "1013": "黑塔", "1401": "黑塔",
    "1003": "姬子", "1510": "姬子",
    "1006": "银狼", "1506": "银狼",
    "1205": "刃", "1507": "刃",
}

out = []
for cid, c in src.items():
    if c["name"] == "{NICKNAME}":   # 开拓者 星/穹 占位形态，排除
        continue
    ex = extra[cid]
    assert ex["ok"], f"{cid} {c['name']} 缺 BWIKI 数据"
    sp = c.get("max_sp")
    sp_special = (sp is None) or (sp < 50)   # 黄泉/飞霄/遐蝶/白厄/昔涟：无常规能量机制
    out.append({
        "id": cid,
        "name": c["name"],
        "display": DISPLAY.get(cid, c["name"]),
        "group": GROUPS.get(cid, c["name"]),
        "rarity": c["rarity"],
        "path": PATH_CN[c["path"]],
        "element": ELEM_CN[c["element"]],
        "max_sp": None if sp_special else sp,
        "gender": ex["gender"],
        "version": ex["version"],
        "icon": f"assets/icons/{cid}.png",
        "portrait": f"assets/portraits/{cid}.jpg",
    })

out.sort(key=lambda x: x["id"])
json.dump(out, open("data/characters.json", "w"), ensure_ascii=False, indent=1)
# 浏览器通过 <script> 直接加载的版本（file:// 双击可跑，无需 fetch）
with open("data/characters.js", "w") as f:
    f.write("window.SRD_DATA = ")
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")
print("total:", len(out))
print("sample:", json.dumps(out[0], ensure_ascii=False))
vers = sorted({c["version"] for c in out}, key=lambda v: [int(p) for p in v.split(".")])
print("version range:", vers[0], "-", vers[-1])
