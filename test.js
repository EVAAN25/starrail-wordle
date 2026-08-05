/* node 自测：每日种子确定性 / 比对逻辑 / 分享卡生成 / 搜索 */
const assert = require("assert");
const SRD = require("./game.js");
const characters = require("./data/characters.json");

let passed = 0;
function ok(name, fn) { fn(); passed++; console.log("✓", name); }

// ---------- 数据完整性 ----------
ok("数据：85 个角色、字段齐全、版本格式合法", () => {
  assert.strictEqual(characters.length, 85);
  const ids = new Set();
  for (const c of characters) {
    assert(c.id && c.name && c.display && c.group, "缺基本字段 " + c.id);
    assert([4, 5].includes(c.rarity), "rarity " + c.id);
    assert(c.path && c.element && ["男", "女"].includes(c.gender), "维度字段 " + c.id);
    assert(/^\d+\.\d+$/.test(c.version), "version " + c.id);
    assert(c.max_sp === null || (c.max_sp >= 50 && c.max_sp <= 500), "max_sp " + c.id);
    assert(!ids.has(c.id)); ids.add(c.id);
  }
});

// ---------- 每日种子 ----------
ok("每日种子：同一天多次计算结果一致", () => {
  const a = SRD.dailyIndex("2026-08-05", characters.length);
  const b = SRD.dailyIndex("2026-08-05", characters.length);
  assert.strictEqual(a, b);
  const c1 = SRD.dailyAnswer("2026-08-05", characters);
  const c2 = SRD.dailyAnswer("2026-08-05", characters);
  assert.strictEqual(c1.id, c2.id);
});

ok("每日种子：一年内索引都在范围内且有区分度", () => {
  const seen = new Set();
  const d = new Date(2026, 0, 1);
  for (let i = 0; i < 365; i++) {
    const idx = SRD.dailyIndex(SRD.dateStr(d), characters.length);
    assert(idx >= 0 && idx < characters.length);
    seen.add(idx);
    d.setDate(d.getDate() + 1);
  }
  assert(seen.size > characters.length * 0.6, "区分度过低: " + seen.size);
});

ok("每日种子：dateStr 格式为本地 YYYY-MM-DD", () => {
  assert.strictEqual(SRD.dateStr(new Date(2026, 7, 5)), "2026-08-05");
  assert.strictEqual(SRD.dateStr(new Date(2026, 0, 3)), "2026-01-03");
});

// ---------- 比对逻辑 ----------
const m37 = characters.find((c) => c.id === "1001");   // 三月七·存护 女 4 存护 冰 1.0 120
const m37h = characters.find((c) => c.id === "1224");  // 三月七·巡猎 女 4 巡猎 虚数 2.4 110
const kafka = characters.find((c) => c.name === "卡芙卡"); // 女 5 虚无 雷 1.2 120
const feixiao = characters.find((c) => c.name === "飞霄"); // max_sp null
const jy = characters.find((c) => c.name === "景元");   // 男 5 智识 雷 1.0 130

ok("比对：精确命中全部绿色且 win", () => {
  const r = SRD.compare(kafka, kafka);
  assert(r.win);
  for (const k of SRD.CELL_ORDER) assert.strictEqual(r.cells[k].status, "green", k);
});

ok("比对：同本体不同形态 → 命途/元素橙色，性别绿色", () => {
  const r = SRD.compare(m37h, m37);
  assert(!r.win && r.groupHit);
  assert.strictEqual(r.cells.gender.status, "green");
  assert.strictEqual(r.cells.path.status, "orange");
  assert.strictEqual(r.cells.element.status, "orange");
});

ok("比对：数值维度方向箭头正确", () => {
  // 猜卡芙卡(5星 v1.2 sp120)，目标景元(5星 v1.0 sp130)
  const r = SRD.compare(kafka, jy);
  assert.strictEqual(r.cells.rarity.status, "green");
  assert.strictEqual(r.cells.version.status, "down");  // 目标版本更低
  assert.strictEqual(r.cells.sp.status, "up");         // 目标能量更高
  assert.strictEqual(r.cells.gender.status, "red");
  assert.strictEqual(r.cells.element.status, "green"); // 都是雷
});

ok("比对：特殊能量（null）只能精确匹配", () => {
  const r1 = SRD.compare(feixiao, kafka);
  assert.strictEqual(r1.cells.sp.status, "red");       // null vs 120
  const r2 = SRD.compare(feixiao, feixiao);
  assert.strictEqual(r2.cells.sp.status, "green");     // null vs null
  const r3 = SRD.compare(kafka, kafka);
  assert.strictEqual(r3.cells.sp.status, "green");
});

ok("比对：版本数值按 主.次 比较（1.10 > 1.9 语义可靠）", () => {
  assert(SRD.versionNum("3.10") > SRD.versionNum("3.9"));
  assert(SRD.versionNum("2.0") > SRD.versionNum("1.9"));
});

// ---------- 评级 / 百分位 ----------
ok("评级与百分位：档位合法、百分位单调", () => {
  assert.strictEqual(SRD.grade(1, true), "S");
  assert.strictEqual(SRD.grade(6, true), "D");
  assert.strictEqual(SRD.grade(6, false), "F");
  let last = 101;
  for (let t = 1; t <= 6; t++) {
    const p = SRD.percentile(t, true);
    assert(p >= 0 && p < last, "百分位应随次数递减");
    last = p;
  }
  assert.strictEqual(SRD.percentile(6, false), 0);
});

// ---------- 分享卡 ----------
ok("分享卡：行数=猜测次数、emoji 合法、含日期与次数", () => {
  const results = [SRD.compare(kafka, jy), SRD.compare(m37h, jy), SRD.compare(jy, jy)];
  const text = SRD.buildShareText({ date: "2026-08-05", results, tries: 3, won: true, mode: "daily" });
  const lines = text.split("\n");
  assert(lines[0].includes("2026-08-05") && lines[0].includes("3/6"));
  assert.strictEqual(lines.length, 1 + 3 + 1 + 1); // 标题 + 3 行格子 + 评级 + URL
  const grid = lines.slice(1, 4);
  for (const row of grid) {
    const cells = [...row].filter((ch) => "🟩🟥🟧⬆⬇".includes(ch));
    assert.strictEqual(cells.length, 6, "每行 6 格: " + row);
  }
  assert(grid[2].includes("🟩")); // 命中行
  assert(lines[3 + 1].includes("评级"));
  console.log("---- 分享卡示例 ----\n" + text + "\n--------------------");
});

ok("分享卡：失败与无限模式文案", () => {
  const r = [SRD.compare(kafka, jy)];
  const t1 = SRD.buildShareText({ date: "2026-08-05", results: r, tries: 6, won: false, mode: "daily" });
  assert(t1.includes("X/6"));
  const t2 = SRD.buildShareText({ date: "2026-08-05", results: r, tries: 1, won: true, mode: "infinite" });
  assert(t2.includes("无限模式") && !t2.includes("评级"));
});

// ---------- 搜索 ----------
ok("搜索：模糊匹配、消歧、排除已猜", () => {
  const r1 = SRD.search(characters, "三月", []);
  assert(r1.length === 2, "三月七两个形态都应出现");
  const r2 = SRD.search(characters, "卡夫卡", []); // 常见错字不应命中，正式名应命中
  const r3 = SRD.search(characters, "卡芙卡", []);
  assert(r3.length === 1 && r3[0].name === "卡芙卡");
  const r4 = SRD.search(characters, "丹恒", []);
  assert(r4.length === 3, "丹恒×3 形态");
  const r5 = SRD.search(characters, "丹恒", ["1002", "1213", "1414"]);
  assert(r5.length === 0, "已猜角色应被排除");
  assert.strictEqual(r2.length, 0);
});

// ---------- 像素立绘模式（独立玩法） ----------
ok("像素种子：同一天多次计算结果一致", () => {
  const a = SRD.pixelDailyAnswer("2026-08-05", characters);
  const b = SRD.pixelDailyAnswer("2026-08-05", characters);
  assert.strictEqual(a.id, b.id);
});

ok("像素种子：与主每日种子相互独立（一年内大量日期答案不同）", () => {
  let diff = 0;
  const d = new Date(2026, 0, 1);
  for (let i = 0; i < 365; i++) {
    const ds = SRD.dateStr(d);
    const main = SRD.dailyIndex(ds, characters.length);
    const pixel = SRD.pixelDailyIndex(ds, characters.length);
    assert(pixel >= 0 && pixel < characters.length);
    if (main !== pixel) diff++;
    d.setDate(d.getDate() + 1);
  }
  assert(diff > 300, `一年仅 ${diff} 天答案不同，种子可能未独立`);
});

ok("像素存储键：与主游戏完全分开", () => {
  const dk = SRD.dailyStorageKey("2026-08-05");
  const pk = SRD.pixelStorageKey("2026-08-05");
  assert.notStrictEqual(dk, pk);
  assert(pk.startsWith("srd_pixel_daily_"));
  assert(dk.startsWith("srdle.daily."));
});

ok("像素练习模式：抽练习題不影响每日答案与存储键", () => {
  const date = "2026-08-05";
  const before = SRD.pixelDailyAnswer(date, characters);
  const keyBefore = SRD.pixelStorageKey(date);
  // 模拟练习抽题（随机）后，每日题与键不变
  for (let i = 0; i < 10; i++) Math.random();
  assert.strictEqual(SRD.pixelDailyAnswer(date, characters).id, before.id);
  assert.strictEqual(SRD.pixelStorageKey(date), keyBefore);
});

ok("像素分享卡：猜中/失败/练习三种文案", () => {
  const t1 = SRD.buildPixelShareText({ date: "2026-08-05", tries: 3, won: true, practice: false });
  const l1 = t1.split("\n");
  assert(l1[0].includes("像素立绘 #2026-08-05") && l1[0].includes("3/6"));
  assert.strictEqual(l1[1], "🟥🟥🟩");           // 错 2 步 + 猜中
  assert(l1[2].includes("评级"));
  const t2 = SRD.buildPixelShareText({ date: "2026-08-05", tries: 6, won: false, practice: false });
  assert(t2.includes("X/6") && t2.split("\n")[1] === "🟥🟥🟥🟥🟥🟥");
  const t3 = SRD.buildPixelShareText({ date: "2026-08-05", tries: 1, won: true, practice: true });
  assert(t3.includes("练习") && !t3.includes("评级") && t3.split("\n")[1] === "🟩");
  console.log("---- 像素分享卡示例 ----\n" + t1 + "\n------------------------");
});

console.log(`\n全部通过：${passed} 项`);
