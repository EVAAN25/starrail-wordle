/* 人气对决（Higher-Lower）：连胜计分，答错结算 */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const SRD = window.SRD;

  const characters = window.SRD_DATA;
  const byId = {};
  characters.forEach((c) => { byId[c.id] = c; });
  const pop = window.SRD_POPULARITY; // {source, fetched_at, estimated, data:{id:{name,views,title,bvid,vtype}}}

  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
  };

  // 题池：有播放量数据的角色
  const poolIds = Object.keys(pop.data);
  let order = [], ptr = 0;
  let left = null, right = null;   // 当前对决双方（id）
  let streak = 0, revealed = false, gameOver = false;

  function best() { return Number(store.get(SRD.duelStorageKey()) || 0); }

  function nextFromOrder(excludeViews) {
    while (ptr < order.length) {
      const id = order[ptr++];
      if (pop.data[id].views !== excludeViews) return id; // 播放量相同无法比较，跳过
    }
    // 序列用完就重洗一轮
    order = SRD.duelOrder(String(Date.now()), poolIds);
    ptr = 0;
    return nextFromOrder(excludeViews);
  }

  function newGame() {
    order = SRD.duelOrder(String(Date.now()), poolIds);
    ptr = 0;
    left = nextFromOrder();
    right = nextFromOrder(pop.data[left].views);
    streak = 0; gameOver = false; revealed = false;
    render();
  }

  function fmt(v) {
    if (pop.estimated) return "约 " + (v >= 10000 ? Math.round(v / 10000) + " 万" : v);
    return v >= 10000 ? (v / 10000).toFixed(1).replace(/\.0$/, "") + " 万" : String(v);
  }

  function cardHTML(id, side) {
    const c = byId[id], p = pop.data[id];
    const show = side === "left" || revealed;
    return `<div class="duel-card" data-side="${side}">
      <img src="${c.icon}" alt="">
      <h3>${c.display}</h3>
      ${show ? `<div class="views">${fmt(p.views)} 播放</div><div class="vtitle">${p.title}</div>`
             : `<div class="views">？播放</div><div class="vtitle">点击选择更高的一方</div>`}
    </div>`;
  }

  function render() {
    $("#duelStreak").innerHTML = `当前连胜 <b>${streak}</b> 场 · 历史最佳 ${best()} 场`;
    $("#duelStage").innerHTML = cardHTML(left, "left") + `<div class="duel-vs">VS</div>` + cardHTML(right, "right");
    $("#duelSource").textContent =
      `数据：${pop.source} · 抓取于 ${pop.fetched_at}` + (pop.estimated ? "（人工估算，待校正）" : "");
    if (!gameOver) {
      $("#duelStage").querySelectorAll(".duel-card").forEach((el) => {
        el.onclick = () => guess(el.dataset.side);
      });
    }
  }

  function guess(side) {
    if (gameOver || revealed) return;
    const lv = pop.data[left].views, rv = pop.data[right].views;
    const pickedHigher = side === "left" ? lv > rv : rv > lv;
    revealed = true;
    render();
    setTimeout(() => {
      if (pickedHigher) {
        streak++;
        const winner = lv > rv ? left : right;
        left = winner;
        right = nextFromOrder(pop.data[winner].views);
        revealed = false;
        render();
      } else {
        gameOver = true;
        if (streak > best()) store.set(SRD.duelStorageKey(), String(streak));
        renderResult();
      }
    }, 900);
  }

  function renderResult() {
    const isBest = streak >= best() && streak > 0;
    $("#duelResult").innerHTML = `
      <h2>连胜终结：${streak} 场</h2>
      <p class="r-meta">${isBest ? "新纪录！" : `历史最佳 ${best()} 场`}</p>
      <div class="btn-row">
        <button class="btn" id="duelShareBtn">复制分享卡</button>
        <button class="btn ghost" id="duelAgainBtn">再来一局</button>
      </div>`;
    $("#duelResult").classList.remove("hidden");
    $("#duelShareBtn").onclick = () => copyText(SRD.buildDuelShareText(streak));
    $("#duelAgainBtn").onclick = () => { $("#duelResult").classList.add("hidden"); newGame(); };
  }

  function copyText(text) {
    const done = () => {
      const el = $("#toast");
      el.textContent = "分享卡已复制，去群里粘贴吧";
      el.classList.remove("hidden");
      setTimeout(() => el.classList.add("hidden"), 2200);
    };
    if (navigator.clipboard && navigator.clipboard.writeText)
      navigator.clipboard.writeText(text).then(done, () => done());
    else done();
  }

  newGame();
})();
