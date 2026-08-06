/* 猜！星！铁！ —— UI 层（依赖 game.js 的纯逻辑 SRD） */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const SRD = window.SRD;

  const PIXEL_FACTORS = [80, 40, 20, 10, 4, 1]; // 猜错 0~5 次 → 6 档清晰度

  let characters = [];
  let byId = {};
  let modes = {};          // daily / infinite 的对局状态
  let activeGame = "daily";
  let suggestIndex = -1;
  let suggestItems = [];

  // ---------- 本地存储（file:// 下也尽量可用，失败则降级为内存） ----------
  const store = (() => {
    try { localStorage.setItem("srdle.__t", "1"); localStorage.removeItem("srdle.__t"); }
    catch (e) { const m = {}; return { get: (k) => m[k], set: (k, v) => { m[k] = v; } }; }
    return {
      get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
      set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
    };
  })();

  function loadJSON(k, fallback) {
    try { const v = JSON.parse(store.get(k)); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  }

  // ---------- 对局状态 ----------

  function newState(target) {
    return { targetId: target.id, guesses: [], results: [], status: "playing" };
  }

  function todayKey() { return SRD.dailyStorageKey(SRD.dateStr()); }

  function initDaily() {
    const date = SRD.dateStr();
    const target = SRD.dailyAnswer(date, characters);
    const saved = loadJSON(todayKey(), null);
    if (saved && saved.targetId === target.id) {
      modes.daily = saved;
      modes.daily.results = saved.guesses.map((id) => SRD.compare(byId[id], target));
    } else {
      modes.daily = newState(target);
    }
  }

  function initInfinite() {
    const target = characters[Math.floor(Math.random() * characters.length)];
    modes.infinite = newState(target);
  }

  function state() { return modes[activeGame]; }
  function target() { return byId[state().targetId]; }

  function persistDaily() {
    if (activeGame !== "daily") return;
    const s = state();
    store.set(todayKey(), JSON.stringify({ targetId: s.targetId, guesses: s.guesses, status: s.status }));
  }

  // ---------- 渲染 ----------

  function renderBanner() {
    const el = $("#modeBanner");
    if (activeGame === "daily") {
      el.innerHTML = `今日题目 <b>#${SRD.dateStr()}</b> · 所有人的答案都一样 · 进度自动保存`;
    } else {
      el.innerHTML = `无限模式 · 随机出题 · 不计入每日成绩`;
    }
  }

  function renderTries() {
    const left = SRD.MAX_GUESSES - state().guesses.length;
    $("#triesLeft").innerHTML = `剩 <b>${left}</b> / ${SRD.MAX_GUESSES} 次`;
  }

  function cellHTML(cell, text) {
    let arrow = "";
    if (cell.status === "up") arrow = '<span class="arrow">⬆</span>';
    if (cell.status === "down") arrow = '<span class="arrow">⬇</span>';
    return `<div class="cell ${cell.status}"><span>${text}</span>${arrow}</div>`;
  }

  function rowHTML(c, res) {
    const cells = res.cells;
    return `<div class="row">
      <div class="cell name"><img loading="lazy" src="${c.icon}" alt=""><span>${c.display}</span></div>
      ${cellHTML(cells.gender, c.gender)}
      ${cellHTML(cells.rarity, c.rarity + "★")}
      ${cellHTML(cells.path, c.path)}
      ${cellHTML(cells.element, c.element)}
      ${cellHTML(cells.version, "v" + c.version)}
      ${cellHTML(cells.sp, c.max_sp == null ? "特殊" : c.max_sp)}
    </div>`;
  }

  function renderRows() {
    const s = state();
    $("#rows").innerHTML = s.guesses.map((id, i) => rowHTML(byId[id], s.results[i])).join("");
  }

  function renderGame() {
    renderBanner();
    renderTries();
    renderRows();
    const s = state();
    $("#guessInput").disabled = s.status !== "playing";
    $("#guessInput").placeholder = s.status === "playing" ? "输入角色名，如：卡芙卡" : "本局已结束";
    if (s.status !== "playing") renderResult();
    else $("#result").classList.add("hidden");
    closeSuggest();
  }

  // ---------- 结算 ----------

  function stats() { return loadJSON("srdle.stats", { played: 0, won: 0, streak: 0, lastDaily: null }); }

  function updateStats(won) {
    const st = stats();
    const today = SRD.dateStr();
    if (st.lastDaily === today) return st; // 防重复
    st.played++;
    if (won) {
      st.won++;
      const y = new Date(); y.setDate(y.getDate() - 1);
      st.streak = st.lastDaily === SRD.dateStr(y) ? st.streak + 1 : 1;
    } else {
      st.streak = 0;
    }
    st.lastDaily = today;
    store.set("srdle.stats", JSON.stringify(st));
    return st;
  }

  function renderResult() {
    const s = state();
    const t = target();
    const won = s.status === "won";
    const tries = s.guesses.length;
    const g = SRD.grade(tries, won);
    const pct = SRD.percentile(tries, won);
    const st = activeGame === "daily" ? stats() : null;
    const statLine = st
      ? `每日累计 ${st.played} 局 · 猜中 ${st.won} 局 · 当前连中 ${st.streak} 天`
      : "";
    $("#result").innerHTML = `
      <img class="r-portrait" src="${t.portrait}" alt="${t.display}">
      <h2>${won ? "猜中了！" : "揭晓答案"}：${t.display}</h2>
      <p class="r-meta">${t.rarity}★ · ${t.gender} · ${t.path} · ${t.element} · v${t.version} · 能量 ${t.max_sp == null ? "特殊" : t.max_sp}</p>
      <p class="r-grade">${tries}/${SRD.MAX_GUESSES} 次 · 评级 <b>${g}</b></p>
      <p class="r-pct">${won ? `估算超越 ${pct}% 的玩家（本地估算）` : "明天再来一局！"}</p>
      <div class="btn-row">
        ${activeGame === "daily"
          ? '<button class="btn" id="goInfiniteBtn">再来一题（随机）</button>'
          : '<button class="btn" id="againBtn">再来一局</button>'}
        <button class="btn ghost" id="shareBtn">复制分享卡</button>
      </div>
      ${activeGame === "daily" ? '<p class="r-stats">每日题已完成，可以一直玩随机题 · 成绩与分享卡已定格</p>' : ""}
      ${statLine ? `<p class="r-stats">${statLine}</p>` : ""}`;
    $("#result").classList.remove("hidden");
    $("#shareBtn").onclick = copyShare;
    const gi = $("#goInfiniteBtn"); if (gi) gi.onclick = () => { initInfinite(); switchTab("infinite"); };
    const ag = $("#againBtn"); if (ag) ag.onclick = () => { initInfinite(); renderGame(); };
  }

  function copyText(text) {
    const done = () => toast("分享卡已复制，去群里粘贴吧");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    } else fallbackCopy(text, done);
  }

  function copyShare() {
    const s = state();
    copyText(SRD.buildShareText({
      date: SRD.dateStr(), results: s.results,
      tries: s.guesses.length, won: s.status === "won", mode: activeGame,
    }));
  }

  function fallbackCopy(text, done) {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); done(); } catch (e) { toast("复制失败，请手动复制"); }
    document.body.removeChild(ta);
  }

  // ---------- 猜测 ----------

  function submitGuess(id) {
    const s = state();
    if (s.status !== "playing") return;
    if (s.guesses.includes(id)) { toast("这个角色已经猜过了"); return; }
    const res = SRD.compare(byId[id], target());
    s.guesses.push(id);
    s.results.push(res);
    if (res.win) {
      s.status = "won";
      if (activeGame === "daily") updateStats(true);
    } else if (s.guesses.length >= SRD.MAX_GUESSES) {
      s.status = "lost";
      if (activeGame === "daily") updateStats(false);
    }
    persistDaily();
    renderGame();
  }

  // ---------- 自动补全 ----------

  function guessedIds() { return state().guesses; }

  function openSuggest(list) {
    suggestItems = list;
    suggestIndex = list.length ? 0 : -1;
    const ul = $("#suggestList");
    ul.innerHTML = list.map((c, i) => `
      <li data-id="${c.id}" class="${i === suggestIndex ? "active" : ""}">
        <img loading="lazy" src="${c.icon}" alt="">
        <span class="s-name">${c.display}</span>
        <span class="s-meta">${c.rarity}★ ${c.path}·${c.element}</span>
      </li>`).join("");
    ul.classList.toggle("hidden", !list.length);
    ul.querySelectorAll("li").forEach((li) => {
      li.addEventListener("pointerdown", (e) => { e.preventDefault(); pick(li.dataset.id); });
    });
  }

  function closeSuggest() { $("#suggestList").classList.add("hidden"); suggestItems = []; suggestIndex = -1; }

  function moveSuggest(delta) {
    if (!suggestItems.length) return;
    suggestIndex = (suggestIndex + delta + suggestItems.length) % suggestItems.length;
    $("#suggestList").querySelectorAll("li").forEach((li, i) => li.classList.toggle("active", i === suggestIndex));
  }

  function pick(id) {
    $("#guessInput").value = "";
    closeSuggest();
    submitGuess(id);
  }

  function bindInput() {
    const input = $("#guessInput");
    input.addEventListener("input", () => {
      openSuggest(SRD.search(characters, input.value, guessedIds()));
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); moveSuggest(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); moveSuggest(-1); }
      else if (e.key === "Enter") {
        e.preventDefault();
        if (suggestItems.length) pick(suggestItems[Math.max(suggestIndex, 0)].id);
        else {
          const m = SRD.search(characters, input.value, guessedIds(), 1);
          if (m.length) pick(m[0].id);
        }
      } else if (e.key === "Escape") closeSuggest();
    });
    input.addEventListener("blur", () => setTimeout(closeSuggest, 120));
    input.addEventListener("focus", () => {
      if (input.value) openSuggest(SRD.search(characters, input.value, guessedIds()));
    });
  }

  // ---------- 像素立绘（独立玩法：独立题目 / 独立流程 / 独立存储） ----------

  const portraitCache = {};
  let pixelDaily = null;     // 每日题 {targetId, guesses, status}，持久化到 srd_pixel_daily_*
  let pixelPractice = null;  // 练习题，只在内存，不进存储
  let inPractice = false;
  let pSugIndex = -1, pSugItems = [];

  function initPixelDaily() {
    const date = SRD.dateStr();
    const t = SRD.pixelDailyAnswer(date, characters);
    const saved = loadJSON(SRD.pixelStorageKey(date), null);
    pixelDaily = saved && saved.targetId === t.id
      ? saved
      : { targetId: t.id, guesses: [], status: "playing" };
  }

  function pixelState() { return inPractice ? pixelPractice : pixelDaily; }

  function persistPixel() {
    if (!inPractice) store.set(SRD.pixelStorageKey(SRD.dateStr()), JSON.stringify(pixelDaily));
  }

  function pixelWrongCount() {
    const s = pixelState();
    return s.guesses.filter((id) => id !== s.targetId).length;
  }

  function drawPixel() {
    const s = pixelState();
    const t = byId[s.targetId];
    const level = s.status === "won" ? PIXEL_FACTORS.length - 1 : Math.min(pixelWrongCount(), PIXEL_FACTORS.length - 1);
    const canvas = $("#pixelCanvas");
    const ctx = canvas.getContext("2d");
    const img = portraitCache[t.id] || (portraitCache[t.id] = new Image());
    img.onload = () => {
      const f = PIXEL_FACTORS[level];
      const w = canvas.width, h = canvas.height;
      const sw = Math.max(1, Math.round(w / f)), sh = Math.max(1, Math.round(h / f));
      const off = document.createElement("canvas");
      off.width = sw; off.height = sh;
      off.getContext("2d").drawImage(img, 0, 0, sw, sh);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(off, 0, 0, w, h);
    };
    if (img.complete && img.naturalWidth) img.onload();
    else img.src = t.portrait;
  }

  function renderPixel() {
    const s = pixelState();
    const left = SRD.MAX_GUESSES - s.guesses.length;
    $("#pixelStatus").textContent =
      (inPractice ? "练习模式 · 不影响每日进度" : `像素每日题 #${SRD.dateStr()}`) +
      (s.status === "playing" ? ` · 剩 ${left}/${SRD.MAX_GUESSES} 次` : s.status === "won" ? " · 已猜中" : " · 已揭晓");
    $("#practiceBtn").textContent = inPractice ? "再换一张" : "换一张练习";
    $("#backDailyBtn").classList.toggle("hidden", !inPractice);
    $("#pixelChips").innerHTML = s.guesses.map((id) =>
      `<span class="chip ${id === s.targetId ? "hit" : "wrong"}">${byId[id].display}</span>`).join("");
    $("#pixelInput").disabled = s.status !== "playing";
    drawPixel();
    if (s.status !== "playing") renderPixelResult();
    else $("#pixelResult").classList.add("hidden");
    closePixelSuggest();
  }

  function renderPixelResult() {
    const s = pixelState();
    const t = byId[s.targetId];
    const won = s.status === "won";
    const tries = s.guesses.length;
    $("#pixelResult").innerHTML = `
      <h2>${won ? "猜中了！" : "揭晓答案"}：${t.display}</h2>
      <p class="r-meta">${t.rarity}★ · ${t.gender} · ${t.path} · ${t.element} · v${t.version} · 能量 ${t.max_sp == null ? "特殊" : t.max_sp}</p>
      <p class="r-grade">${tries}/${SRD.MAX_GUESSES} 次 · 评级 <b>${SRD.grade(tries, won)}</b></p>
      <p class="r-pct">${won && !inPractice ? `估算超越 ${SRD.percentile(tries, won)}% 的玩家（本地估算）` : ""}</p>
      <div class="btn-row">
        <button class="btn" id="pixelAgainBtn">再来一题（随机）</button>
        <button class="btn ghost" id="pixelShareBtn">复制分享卡</button>
      </div>
      ${!inPractice ? '<p class="r-stats">每日题已完成，可以一直玩随机题 · 成绩与分享卡已定格</p>' : ""}`;
    $("#pixelResult").classList.remove("hidden");
    $("#pixelShareBtn").onclick = () =>
      copyText(SRD.buildPixelShareText({ date: SRD.dateStr(), tries, won, practice: inPractice }));
    $("#pixelAgainBtn").onclick = () => newPixelPractice();
  }

  function newPixelPractice() {
    inPractice = true;
    const t = characters[Math.floor(Math.random() * characters.length)];
    pixelPractice = { targetId: t.id, guesses: [], status: "playing" };
    renderPixel();
  }

  function submitPixelGuess(id) {
    const s = pixelState();
    if (s.status !== "playing") return;
    if (s.guesses.includes(id)) { toast("这个角色已经猜过了"); return; }
    s.guesses.push(id);
    if (id === s.targetId) s.status = "won";
    else if (s.guesses.length >= SRD.MAX_GUESSES) s.status = "lost";
    persistPixel();
    renderPixel();
  }

  // 像素页自动补全（与主游戏同一套交互，独立 DOM）
  function openPixelSuggest(list) {
    pSugItems = list;
    pSugIndex = list.length ? 0 : -1;
    const ul = $("#pixelSuggest");
    ul.innerHTML = list.map((c, i) => `
      <li data-id="${c.id}" class="${i === pSugIndex ? "active" : ""}">
        <img loading="lazy" src="${c.icon}" alt="">
        <span class="s-name">${c.display}</span>
        <span class="s-meta">${c.rarity}★ ${c.path}·${c.element}</span>
      </li>`).join("");
    ul.classList.toggle("hidden", !list.length);
    ul.querySelectorAll("li").forEach((li) => {
      li.addEventListener("pointerdown", (e) => { e.preventDefault(); pickPixel(li.dataset.id); });
    });
  }

  function closePixelSuggest() { $("#pixelSuggest").classList.add("hidden"); pSugItems = []; pSugIndex = -1; }

  function movePixelSuggest(delta) {
    if (!pSugItems.length) return;
    pSugIndex = (pSugIndex + delta + pSugItems.length) % pSugItems.length;
    $("#pixelSuggest").querySelectorAll("li").forEach((li, i) => li.classList.toggle("active", i === pSugIndex));
  }

  function pickPixel(id) {
    $("#pixelInput").value = "";
    closePixelSuggest();
    submitPixelGuess(id);
  }

  function bindPixelInput() {
    const input = $("#pixelInput");
    const exclude = () => pixelState().guesses;
    input.addEventListener("input", () => openPixelSuggest(SRD.search(characters, input.value, exclude())));
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); movePixelSuggest(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); movePixelSuggest(-1); }
      else if (e.key === "Enter") {
        e.preventDefault();
        if (pSugItems.length) pickPixel(pSugItems[Math.max(pSugIndex, 0)].id);
        else {
          const m = SRD.search(characters, input.value, exclude(), 1);
          if (m.length) pickPixel(m[0].id);
        }
      } else if (e.key === "Escape") closePixelSuggest();
    });
    input.addEventListener("blur", () => setTimeout(closePixelSuggest, 120));
    input.addEventListener("focus", () => {
      if (input.value) openPixelSuggest(SRD.search(characters, input.value, exclude()));
    });
    $("#practiceBtn").addEventListener("click", () => newPixelPractice());
    $("#backDailyBtn").addEventListener("click", () => { inPractice = false; renderPixel(); });
  }

  // ---------- 标签页 ----------

  function switchTab(tab) {
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    $("#view-game").classList.toggle("hidden", tab === "pixel");
    $("#view-pixel").classList.toggle("hidden", tab !== "pixel");
    if (tab === "pixel") { renderPixel(); return; }
    if (tab === "infinite" && !modes.infinite) initInfinite();
    activeGame = tab;
    renderGame();
  }

  // ---------- 提示条 ----------

  let toastTimer = null;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), 2200);
  }

  // ---------- 启动 ----------

  async function init() {
    // 优先用 <script> 内嵌数据（file:// 双击可跑）；没有再走 fetch（静态服务器）
    if (window.SRD_DATA) characters = window.SRD_DATA;
    else characters = await (await fetch("data/characters.json")).json();
    characters.forEach((c) => { byId[c.id] = c; });
    initDaily();
    initPixelDaily();
    bindInput();
    bindPixelInput();
    document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));
    renderGame();
    if (location.hash === "#pixel") switchTab("pixel");
    else if (location.hash === "#infinite") switchTab("infinite");
  }

  init().catch((e) => {
    document.querySelector("main").innerHTML =
      `<p style="text-align:center;color:#8f352d;padding:40px">数据加载失败：${e.message}<br>请通过本地服务器访问（见 README），不要直接双击也能跑的话请检查浏览器限制。</p>`;
  });
})();
