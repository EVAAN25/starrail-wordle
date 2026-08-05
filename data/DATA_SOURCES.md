# 数据来源与加工说明

## characters.json 字段来源

| 字段 | 来源 | 说明 |
|---|---|---|
| id / name / rarity / path / element / max_sp | [StarRailRes](https://github.com/Mar-7th/StarRailRes) `index_min/cn/characters.json` | 命途/元素英文已映射为中文 |
| gender（性别） | [BWIKI](https://wiki.biligame.com/sr/) MediaWiki API，角色页模板字段「性别」 | 脚本批量抓取，85/85 命中，原始记录见 `data/wiki_extra.json` |
| version（实装版本） | 同上，模板字段「实装版本」 | 格式 `主.次`（如 1.0、2.3、4.4） |
| group（同本体组） | 手工整理 | 用于「接近」判定：三月七×2、丹恒×3、黑塔×2、姬子×2、银狼×2、刃×2 |
| icon / portrait | StarRailRes `icon/character/{id}.png`、`image/character_portrait/{id}.png` | 已本地化到 assets/ |

## 过滤与加工规则

- 排除开拓者（星/穹）：源数据中 id 8001–8010 共 10 条，name 为占位符 `{NICKNAME}`，不适合作为谜底/选项，整体排除。
- 三月七两个形态（1001 存护·冰 / 1224 巡猎·虚数）都是独立可玩形态，均保留；展示名消歧为「三月七·存护」「三月七·巡猎」。
- 1224（巡猎三月七）的 BWIKI 主条目会重定向到存护形态，其实装版本已单独从「三月七•巡猎」页修正为 2.4。
- max_sp 为 null 或 < 50 的角色（黄泉 9、飞霄 12、白厄 12、昔涟 24、遐蝶 null）属于无常规能量机制，数据中统一记为 `max_sp: null`，UI 显示「特殊」。
- 最终入选 **85** 个角色（rarity 4/5 且全部有立绘，无 NPC 混入）。

## 图片处理

```bash
# 下载（带断点续传重试）
curl -C - -o portrait_{id}.png https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/image/character_portrait/{id}.png
curl -C - -o icon_{id}.png      https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/icon/character/{id}.png
# 压缩
sips -Z 512 portrait_{id}.png   # 立绘缩到 512px 内
sips -Z 128 icon_{id}.png       # 头像 128px
# 立绘再转 JPG（暖纸底色 #f7f2e7 衬底，quality=82，单张 <100KB），见 tools 目录脚本
```

头像保留 PNG 透明通道；立绘因透明底 PNG 体积超标（约 340KB/张）转为 JPG，衬底色与页面底色一致。

## 待确认项

- 性别/实装版本全部来自 BWIKI 模板字段，未发现缺失；如 BWIKI 修订角色页，重跑 `tools/fetch_wiki.py` 后需重新确认 1224 的重定向修正是否仍然必要。
- 「超越 x% 玩家」为前端按假设分布的本地估算，无真实统计依据，页面上已注明。
