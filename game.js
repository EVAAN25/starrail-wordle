/*
 * 猜！星！铁！ —— 纯逻辑层（不依赖 DOM，可直接在 node 中 require 跑自测）
 * 维度顺序：性别 / 星级 / 命途 / 元素 / 实装版本 / 能量上限
 */
(function (root, factory) {
  const SRD = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = SRD;
  else root.SRD = SRD;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const MAX_GUESSES = 6;
  const SITE_NAME = "猜！星！铁！";
  const SITE_URL = "https://evaan25.github.io/starrail-wordle/"; // 部署域名

  // ---------- 随机与每日种子 ----------

  // FNV-1a 32bit
  function hash32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 本地日期 YYYY-MM-DD（不用 UTC，保证"今天"符合玩家直觉）
  function dateStr(d) {
    d = d || new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${dd}`;
  }

  // 同一天所有访客得到同一答案：date -> [0, count)
  function dailyIndex(date, count) {
    const rng = mulberry32(hash32("srdle-daily:" + date));
    return Math.floor(rng() * count);
  }

  function dailyAnswer(date, characters) {
    return characters[dailyIndex(date, characters.length)];
  }

  // 像素立绘模式：独立 salt，与主每日模式同一天答案一般不同
  function pixelDailyIndex(date, count) {
    const rng = mulberry32(hash32("srdle-pixel-daily:" + date));
    return Math.floor(rng() * count);
  }

  function pixelDailyAnswer(date, characters) {
    return characters[pixelDailyIndex(date, characters.length)];
  }

  // localStorage 键：主游戏与像素模式完全分开
  function dailyStorageKey(date) { return "srdle.daily." + date; }
  function pixelStorageKey(date) { return "srd_pixel_daily_" + date; }

  // ---------- 比对逻辑 ----------

  // 数值维度：0 相等；1 目标更高（提示 ↑）；-1 目标更低（提示 ↓）
  function cmpNumeric(g, t) {
    if (g === t) return 0;
    return t > g ? 1 : -1;
  }

  function versionNum(v) {
    const p = String(v).split(".").map(Number);
    return p[0] * 100 + (p[1] || 0);
  }

  function numCell(g, t) {
    const dir = cmpNumeric(g, t);
    if (dir === 0) return { status: "green" };
    return { status: dir > 0 ? "up" : "down", dir };
  }

  // 能量上限：null 表示无常规能量机制（黄泉/飞霄等），只能精确匹配
  function spCell(g, t) {
    if (g == null && t == null) return { status: "green" };
    if (g == null || t == null) return { status: "red" };
    return numCell(g, t);
  }

  /*
   * 比对一次猜测。
   * green=精确 red=不对 orange=接近（同一角色的不同形态，如猜「丹恒•饮月」目标是「丹恒」）
   * up/down=数值维度方向提示
   */
  function compare(g, t) {
    const groupHit = g.group === t.group && g.id !== t.id;
    return {
      win: g.id === t.id,
      groupHit,
      cells: {
        gender: { status: g.gender === t.gender ? "green" : "red" },
        rarity: numCell(g.rarity, t.rarity),
        path: { status: g.path === t.path ? "green" : groupHit ? "orange" : "red" },
        element: { status: g.element === t.element ? "green" : groupHit ? "orange" : "red" },
        version: numCell(versionNum(g.version), versionNum(t.version)),
        sp: spCell(g.max_sp, t.max_sp),
      },
    };
  }

  const CELL_ORDER = ["gender", "rarity", "path", "element", "version", "sp"];
  const CELL_LABEL = { gender: "性别", rarity: "星级", path: "命途", element: "元素", version: "版本", sp: "能量" };
  const CELL_EMOJI = { green: "🟩", red: "🟥", orange: "🟧", up: "⬆️", down: "⬇️" };

  // ---------- 评级与伪百分位 ----------

  // 估算分布：假设全体玩家本日猜中次数占比（1~6 次及失败），纯前端估算
  const DIST = { 1: 0.02, 2: 0.08, 3: 0.18, 4: 0.26, 5: 0.22, 6: 0.16, fail: 0.08 };

  function grade(tries, won) {
    if (!won) return "F";
    return { 1: "S", 2: "S", 3: "A", 4: "B", 5: "C", 6: "D" }[tries] || "D";
  }

  // “超越 x% 玩家”= 成绩严格更差（次数更多或失败）的玩家占比，本地估算
  function percentile(tries, won) {
    if (!won) return 0;
    let worse = DIST.fail;
    for (let k = tries + 1; k <= MAX_GUESSES; k++) worse += DIST[k];
    return Math.round(worse * 100);
  }

  // ---------- 分享卡 ----------

  function shareRows(results) {
    return results.map((r) => CELL_ORDER.map((k) => CELL_EMOJI[r.cells[k].status]).join(""));
  }

  function buildShareText(opts) {
    const { date, results, tries, won, mode } = opts;
    const modeLabel = mode === "infinite" ? "无限模式" : `每日挑战 #${date}`;
    const head = won
      ? `我在《${SITE_NAME}》${modeLabel} 用了 ${tries}/${MAX_GUESSES} 次`
      : `我在《${SITE_NAME}》${modeLabel} 没能猜出来 X/${MAX_GUESSES}`;
    const lines = [head, ...shareRows(results)];
    if (mode !== "infinite") {
      lines.push(`评级 ${grade(tries, won)} · 估算超越 ${percentile(tries, won)}% 玩家（本地估算）`);
    }
    lines.push(SITE_URL);
    return lines.join("\n");
  }

  // 像素立绘模式分享卡：🟥=猜错一步，🟩=最终猜中
  function buildPixelShareText(opts) {
    const { date, tries, won, practice } = opts;
    const label = practice ? "像素立绘·练习" : `像素立绘 #${date}`;
    const head = won
      ? `我在《${SITE_NAME}》${label} 用了 ${tries}/${MAX_GUESSES} 次`
      : `我在《${SITE_NAME}》${label} 没能猜出来 X/${MAX_GUESSES}`;
    const emoji = "🟥".repeat(tries - (won ? 1 : 0)) + (won ? "🟩" : "");
    const lines = [head, emoji];
    if (!practice) {
      lines.push(`评级 ${grade(tries, won)} · 估算超越 ${percentile(tries, won)}% 玩家（本地估算）`);
    }
    lines.push(SITE_URL);
    return lines.join("\n");
  }

  // ---------- 模糊搜索 ----------
  function normalize(s) {
    return String(s).replace(/[·•.\s]/g, "").toLowerCase();
  }

  function search(characters, query, excludeIds, limit) {
    const q = normalize(query);
    if (!q) return [];
    const ex = new Set(excludeIds || []);
    const out = [];
    for (const c of characters) {
      if (ex.has(c.id)) continue;
      const hay = normalize(c.display + " " + c.name);
      if (hay.includes(q)) {
        // 前缀命中的排前面
        out.push({ c, score: normalize(c.display).startsWith(q) || normalize(c.name).startsWith(q) ? 0 : 1 });
      }
    }
    out.sort((a, b) => a.score - b.score || a.c.id.localeCompare(b.c.id));
    return out.slice(0, limit || 8).map((x) => x.c);
  }

  return {
    MAX_GUESSES, SITE_NAME, SITE_URL,
    CELL_ORDER, CELL_LABEL, CELL_EMOJI, DIST,
    hash32, mulberry32, dateStr, dailyIndex, dailyAnswer,
    pixelDailyIndex, pixelDailyAnswer, dailyStorageKey, pixelStorageKey,
    cmpNumeric, versionNum, compare, spCell,
    grade, percentile, shareRows, buildShareText, buildPixelShareText,
    normalize, search,
  };
});
