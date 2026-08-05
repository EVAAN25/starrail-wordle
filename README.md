# 猜！星！铁！

崩坏：星穹铁道「每日猜角色」网页小游戏（非官方粉丝同人）。对标 loldle.net 的玩法，补齐了**每日一题**与**成绩分享卡**两个增长引擎。纯静态、无构建步骤。

## 玩法

- **每日挑战**：按本地日期确定性出题，同一天所有访客答案相同，6 次猜测机会，进度存 localStorage，刷新不丢。
- **无限模式**：随机出题，随便玩，不计入每日成绩。
- **像素立绘**：每猜错一次，目标角色立绘从重度像素化变清晰一档（共 6 档，canvas 实现），联动你最近游玩的对局。
- **比对维度**：性别 / 星级 / 命途 / 元素 / 实装版本 / 能量上限。
  - 🟩 精确匹配；🟥 不对；🟧 接近（同一角色的不同形态，如「丹恒」与「丹恒•饮月」）。
  - 数值维度（星级 / 版本 / 能量）用 ⬆️⬇️ 提示答案更高或更低。
  - 黄泉 / 飞霄 / 遐蝶 / 白厄 / 昔涟 没有常规能量条，能量维度标记为「特殊」，只能精确匹配。
- **分享卡**：结算后一键复制 emoji 方格成绩（🟩🟥🟧⬆️⬇️）+ 评级（S/A/B/C/D/F）+「估算超越 x% 玩家」（前端按假设分布本地计算，非真实统计）。

## 本地运行

方式一：直接双击 `index.html`（数据通过 `<script>` 内嵌加载，file:// 协议可跑）。

方式二：任意静态服务器，例如：

```bash
python3 -m http.server 8000
# 打开 http://127.0.0.1:8000
```

## 部署

- **Cloudflare Pages**：新建 Pages 项目 → 直接上传本目录（Direct Upload），构建命令留空，输出目录填 `/`。上线后把 `game.js` 里的 `SRD.SITE_URL` 占位替换为真实域名。
- **GitHub Pages**：push 到仓库 → Settings → Pages → 选分支根目录。同样记得替换 `SITE_URL`。

## 自测

```bash
node test.js
```

覆盖：数据完整性、每日种子确定性（同日同题、一年内索引分布）、比对逻辑（含橙色接近、方向箭头、特殊能量）、评级/百分位单调性、分享卡格式、模糊搜索与消歧。

## 目录结构

```
index.html            页面结构
style.css             暖纸底 + 蓝紫点缀样式
game.js               纯逻辑层（无 DOM 依赖，node 可直接 require）
app.js                UI 层（渲染、交互、localStorage、像素 canvas）
data/characters.json  85 个可玩角色的完整数据（canonical）
data/characters.js    同一份数据的 <script> 内嵌版（file:// 双击可跑）
data/wiki_extra.json  BWIKI 抓取的性别/实装版本原始记录（含来源页）
data/DATA_SOURCES.md  数据来源与加工说明
assets/icons/         角色头像 128px PNG（85 张）
assets/portraits/     角色立绘 512px JPG（85 张，已压到 <100KB/张）
tools/                数据抓取与构建脚本（可重复执行）
test.js               node 自测脚本
```

## 重新生成数据

```bash
python3 tools/fetch_wiki.py   # 从 BWIKI 抓性别/实装版本 -> data/wiki_extra.json
python3 tools/build_data.py   # 合并生成 data/characters.json + characters.js
```

图片下载与压缩步骤见 `data/DATA_SOURCES.md`。

## 声明

非官方粉丝同人作品，与米哈游（HoYoverse）无关。角色形象与素材版权归原厂商所有。数据来自 StarRailRes 与 BWIKI。
