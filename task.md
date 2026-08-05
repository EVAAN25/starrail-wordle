# 任务说明：星穹铁道猜角色网页小游戏原型

## 需求

对标 loldle.net / mer.dev/arknights-wordle，做一个崩坏：星穹铁道猜角色小游戏，必须补齐对标产品缺失的两个增长引擎：**每日一题**与**成绩分享卡**。

- 中文、纯静态、无构建步骤，双击 index.html 或任意静态服务器可跑。
- 数据源：StarRailRes `index_min/cn/characters.json` + 同仓图片；缺失的性别/实装版本用 BWIKI MediaWiki API 补齐（30 分钟搞不定再手工映射）。
- 功能：每日模式（本地日期种子、6 次机会、localStorage 进度）、无限模式、自动补全猜测输入、六维属性比对格（绿/红/橙/箭头）、像素立绘独立玩法（独立每日种子与存储、canvas 6 档、练习模式）、emoji 分享卡一键复制、评级 + 伪百分位、同人声明页脚。
- 工程：index.html + game.js（纯函数、node 可跑）+ data/characters.json + assets/ + README.md + node 自测 + http.server curl 验证。
- 风格：暖纸底色 + 星铁蓝紫点缀，移动端可用；首屏资源克制，立绘按需加载。

## 交付物清单

| 文件 | 说明 |
|---|---|
| index.html / style.css / app.js | 页面与交互 |
| game.js | 纯逻辑层（种子、比对、分享卡、评级），node 可 require |
| data/characters.json（85 角色）+ characters.js（内嵌版） | 游戏数据 |
| data/wiki_extra.json / data/DATA_SOURCES.md | BWIKI 原始抓取记录与来源说明 |
| assets/icons/*.png（85）/ assets/portraits/*.jpg（85） | 本地化图片，共约 7MB |
| tools/fetch_wiki.py / tools/build_data.py | 数据管线，可重复执行 |
| test.js | node 自测，13 项全过 |
| README.md | 玩法 / 运行 / 部署（Cloudflare Pages、GitHub Pages） |

## 关键决策记录

- 开拓者（8001–8010，name 为 `{NICKNAME}` 占位）整体排除；三月七双形态保留并消歧。
- 能量特殊角色（黄泉/飞霄/遐蝶/白厄/昔涟）max_sp 记 null，按「特殊」类别处理。
- 橙色「接近」语义 = 同一本体不同形态（丹恒×3、三月七×2、黑塔/姬子/银狼/刃×2）。
- 立绘 PNG 转 JPG（暖纸衬底）以满足单张 <100KB；头像保留 PNG 透明。
- 双击可跑：数据另出一份 `characters.js` 用 `<script>` 内嵌加载，规避 file:// 下 fetch 限制。
- 像素立绘是独立玩法而非主游戏附属：独立 salt（`srdle-pixel-daily:`，同日答案与主模式不同）、独立 localStorage 键（`srd_pixel_daily_*`）、独立猜测/结算/分享流程；「换一张练习」只存在于内存，不写入存储、不影响每日成绩。

## 遗留 TODO

- `game.js` 中 `SITE_URL` 已设为 GitHub Pages 地址（https://evaan25.github.io/starrail-wordle/），如换域名需同步替换。
- BWIKI 数据如需更新，重跑 tools 管线并人工确认 1224 的重定向修正。
- 未做真实玩家统计，「超越 x% 玩家」为本地估算（页面已注明）。
