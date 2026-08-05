/* 版本排排坐（Timeline 式）：5 角色按实装版本排序，3 次机会 */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const SRD = window.SRD;

  const characters = window.SRD_DATA;
  const byId = {};
  characters.forEach((c) => { byId[c.id] = c; });
  const MAX_TRIES = 3;

  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
  };
  const loadJSON = (k, fb) => { try { const v = JSON.parse(store.get(k)); return v == null ? fb : v; } catch (e) { return fb; } };

  let daily = null, practice = null, inPractice = false;
  let selIdx = -1;

  function shuffle(ids, rng) {
    const a = ids.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function randomPicks() {
    const pool = characters.slice();
    const picked = [], used = new Set();
    while (picked.length < 5) {
      const c = pool[Math.floor(Math.random() * pool.length)];
      if (used.has(c.version) || picked.includes(c.id)) continue;
      picked.push(c.id); used.add(c.version);
    }
    return picked;
  }

  function initDaily() {
    const date = SRD.dateStr();
    const picks = SRD.timelineDailyPicks(date, characters);
    const saved = loadJSON(SRD.timelineStorageKey(date), null);
    const sameSet = saved && saved.picks.length === picks.length &&
      saved.picks.every((id) => picks.includes(id));
    if (sameSet) daily = saved;
    else {
      const rng = SRD.mulberry32(SRD.hash32("tl-order:" + date));
      daily = { picks, order: shuffle(picks, rng), tries: 0, status: "playing" };
    }
  }

  function state() { return inPractice ? practice : daily; }
  function persist() {
    if (!inPractice) store.set(SRD.timelineStorageKey(SRD.dateStr()), JSON.stringify(daily));
  }

  const POS = ["最早", "第 2 早", "中间", "第 4 早", "最晚"];

  function render() {
    const s = state();
    const over = s.status !== "playing";
    $("#tlStatus").textContent =
      (inPractice ? "练习模式 · 不影响每日进度" : `排序每日题 #${SRD.dateStr()}`) +
      (over ? "" : ` · 剩余机会 ${MAX_TRIES - s.tries}/${MAX_TRIES}`);
    $("#tlBackBtn").classList.toggle("hidden", !inPractice);
    $("#tlPracticeBtn").textContent = inPractice ? "再换一组" : "换一组练习";
    $("#tlList").innerHTML = s.order.map((id, i) => {
      const c = byId[id];
      const ver = over ? `<span class="ver">v${c.version}</span>` : "";
      return `<div class="tl-item ${i === selIdx ? "sel" : ""}" data-i="${i}">
        <span class="pos">${POS[i]}</span><img src="${c.icon}" alt=""><span>${c.display}</span>${ver}
      </div>`;
    }).join("");
    if (!over) {
      $("#tlList").querySelectorAll(".tl-item").forEach((el) => {
        el.onclick = () => tapSwap(Number(el.dataset.i));
      });
    }
    $("#tlSubmit").disabled = over;
    if (over) renderResult();
    else $("#tlResult").classList.add("hidden");
  }

  function tapSwap(i) {
    if (selIdx < 0) { selIdx = i; }
    else if (selIdx === i) { selIdx = -1; }
    else {
      const s = state();
      [s.order[selIdx], s.order[i]] = [s.order[i], s.order[selIdx]];
      selIdx = -1;
      persist();
    }
    render();
  }

  function submit() {
    const s = state();
    if (s.status !== "playing") return;
    s.tries++;
    if (SRD.timelineJudge(s.order, byId)) s.status = "won";
    else if (s.tries >= MAX_TRIES) {
      s.status = "lost";
      s.order = s.order.slice().sort((a, b) => SRD.versionNum(byId[a].version) - SRD.versionNum(byId[b].version));
    } else toast("顺序还不对，再调调");
    selIdx = -1;
    persist();
    render();
  }

  function renderResult() {
    const s = state();
    const won = s.status === "won";
    $("#tlResult").innerHTML = `
      <h2>${won ? `排对了！用 ${s.tries}/${MAX_TRIES} 次` : "正确答案已亮出"}</h2>
      <p class="r-meta">${s.order.map((id) => `${byId[id].display} v${byId[id].version}`).join(" → ")}</p>
      <div class="btn-row"><button class="btn" id="tlShareBtn">复制分享卡</button></div>`;
    $("#tlResult").classList.remove("hidden");
    $("#tlShareBtn").onclick = () =>
      copyText(SRD.buildTimelineShareText({ date: SRD.dateStr(), tries: s.tries, won, practice: inPractice }));
  }

  function copyText(text) {
    const done = () => toast("分享卡已复制，去群里粘贴吧");
    if (navigator.clipboard && navigator.clipboard.writeText)
      navigator.clipboard.writeText(text).then(done, () => fallback(text, done));
    else fallback(text, done);
  }
  function fallback(text, done) {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); done(); } catch (e) { toast("复制失败"); }
    document.body.removeChild(ta);
  }
  let toastTimer = null;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg; el.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), 2000);
  }

  $("#tlSubmit").addEventListener("click", submit);
  $("#tlPracticeBtn").addEventListener("click", () => {
    inPractice = true;
    const picks = randomPicks();
    practice = { picks, order: shuffle(picks, Math.random), tries: 0, status: "playing" };
    selIdx = -1;
    render();
  });
  $("#tlBackBtn").addEventListener("click", () => { inPractice = false; selIdx = -1; render(); });

  initDaily();
  render();
})();
