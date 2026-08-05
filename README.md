# 星铁游乐场

崩坏：星穹铁道粉丝小游戏合集（非官方同人）。纯静态、无构建步骤，双击 `index.html` 或任意静态服务器即可跑。

## 玩法一览

| 玩法 | 页面 | 说明 |
|---|---|---|
| 猜！星！铁！ | `classic.html` | 六维属性比对（性别/星级/命途/元素/版本/能量），每日挑战 + 无限模式 |
| 像素立绘 | `classic.html#pixel` | 从重度像素化立绘认人，猜错一次清晰一档，独立每日题 + 练习 |
| 语音猜人 | `voice.html` | Heardle 式：2s → 5s → 10s → 完整，6 次机会；最后一次机会给台词兜底；每日题 + 练习 |
| 人气对决 | `duel.html` | Higher-Lower：两位角色官方视频 B站播放量谁更高，连击计分 |
| 阵营连线 | `links.html` | NYT Connections 式：16 人分 4 组找共同点，最多错 4 次，黄绿蓝紫难度色 |
| 版本排排坐 | `timeline.html` | 5 个角色按实装版本排序，3 次机会 |

所有玩法：独立种子（每日题同一天所有人相同）、独立 localStorage 进度（刷新不丢）、独立分享卡（emoji 方格 + 一键复制）。老玩法 localStorage 键未动，旧进度不受影响。

## 本地运行

方式一：直接双击 `index.html`（数据通过 `<script>` 内嵌加载，file:// 可跑）。

方式二：任意静态服务器：

```bash
python3 -m http.server 8000   # 打开 http://127.0.0.1:8000
```

## 部署

- **GitHub Pages**：push 到仓库 → Settings → Pages → 分支根目录。
- **Cloudflare Pages**：Direct Upload 本目录，构建命令留空。
- 部署后把 `game.js` 里的 `SITE_URL` 改为真实域名。

## 自测

```bash
node test.js
```

覆盖：角色数据完整性、四个每日种子的确定性与相互独立性、比对逻辑、连线题库 66 题逐一唯一解暴力复验、人气数据完整性、版本排序判定、各玩法分享卡格式、搜索消歧。

## 数据来源

- 角色基础数据/图片：[StarRailRes](https://github.com/Mar-7th/StarRailRes)
- 性别/实装版本/阵营/中文CV/体型/语音：[BWIKI](https://wiki.biligame.com/sr/)（MediaWiki API 抓取，脚本在 tools/）
- 播放量：**真数据**，B站「崩坏星穹铁道」官号（mid 1340190821）空间视频列表 API（wbi 签名），取每角色播放量最高的一条角色PV/千星纪游/走近星穹，抓取日期记录在 `data/popularity.json` 的 `fetched_at` 字段并显示在页面上。校正方法：重跑 `python3 tools/fetch_popularity.py`（有 tools/bili_videos_cache.json 时只重匹配不打网络；删缓存则重抓全量，注意接口有风控，脚本已带限速与重试）。

## 目录结构

```
index.html            游乐场枢纽（玩法导航）
classic.html + app.js 六维猜角色（每日/无限）+ 像素立绘
voice.html + voice.js 语音猜人
duel.html + duel.js   人气对决
links.html + links.js 阵营连线
timeline.html + timeline.js 版本排排坐
game.js               全部玩法的纯逻辑层（node 可直接 require）
style.css             暖纸底 + 蓝紫点缀
data/                 characters / voice / popularity / connections / traits（.json + 内嵌 .js）
assets/icons|portraits|voice/  本地化素材
tools/                全部抓取与生成脚本（可重跑，详见 data/DATA_SOURCES.md）
test.js               node 自测
```

## 声明

非官方粉丝同人作品，与米哈游（HoYoverse）无关。角色形象、语音、视频等素材版权归原厂商所有。数据来自 StarRailRes / BWIKI / B站官号公开数据。
