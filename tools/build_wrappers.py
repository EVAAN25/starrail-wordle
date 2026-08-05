#!/usr/bin/env python3
"""把 data/*.json 包装成 <script> 可加载的 data/*.js（file:// 双击可跑）"""
import json

WRAPS = [
    ("data/voice.json", "data/voice.js", "SRD_VOICE"),
    ("data/popularity.json", "data/popularity.js", "SRD_POPULARITY"),
    ("data/connections.json", "data/connections.js", "SRD_CONNECTIONS"),
]
for src, dst, var in WRAPS:
    obj = json.load(open(src))
    with open(dst, "w") as f:
        f.write(f"window.{var} = ")
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    print(dst, "ok")
