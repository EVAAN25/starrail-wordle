/* 阵营连线（NYT Connections 式）：独立种子 / 独立存储 / 四色分享卡 */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const SRD = window.SRD;

  const characters = window.SRD_DATA;
  const byId = {};
  characters.forEach((c) => { byId[c.id] = c; });
  const puzzles = window.SRD_CONNECTIONS;
  const MAX_WRONG = 4;

  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
  };
  const loadJSON = (k, fb) => { try { const v = JSON.parse(store.get(k)); return v == null ? fb : v; } catch (e) { return fb; } };

  let daily = null, practice = null, inPractice = false;
  let selected = [];

  function shuffle(ids, rng) {
    const a = ids.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function newState(puzzleIdx, seedStr) {
    const ids = puzzles[puzzleIdx].groups.flatMap((g) => g.members);
    const rng = seedStr ? SRD.mulberry32(SRD.hash32("conn-order:" + seedStr)) : Math.random;
    return { puzzleIdx, order: shuffle(ids, rng), solved: [], mistakes: 0, history: [], status: "playing" };
  }

  function initDaily() {
    const date = SRD.dateStr();
    const idx = SRD.connDailyIndex(date, puzzles.length);
    const saved = loadJSON(SRD.connStorageKey(date), null);
    daily = saved && saved.puzzleIdx === idx ? saved : newState(idx, date);
  }

  function state() { return inPractice ? practice : daily; }
  function puzzle() { return puzzles[state().puzzleIdx]; }
  function persist() {
    if (!inPractice) store.set(SRD.connStorageKey(SRD.dateStr()), JSON.stringify(daily));
  }

  function groupOf(id) {
    const p = puzzle();
    for (let gi = 0; gi < 4; gi++) if (p.groups[gi].members.includes(id)) return gi;
    return -1;
  }

  function render() {
    const s = state();
    const p = puzzle();
    $("#connStatus").textContent =
      (inPractice ? "练习模式 · 不影响每日进度" : `连线每日题 #${SRD.dateStr()}`) +
      (s.status === "playing" ? ` · 剩余容错 ${MAX_WRONG - s.mistakes}/${MAX_WRONG}` : "");
    $("#connBackBtn").classList.toggle("hidden", !inPractice);
    $("#connPracticeBtn").textContent = inPractice ? "再换一题" : "换一题练习";
    $("#connSolved").innerHTML = s.solved.map((gi) =>
      `<div class="grp c${gi}"><b>${p.groups[gi].label}</b>　${p.groups[gi].members.map((id) => byId[id].display).join(" · ")}</div>`).join("");
    $("#connBoard").innerHTML = s.order.map((id) => {
      const gi = groupOf(id);
      const done = s.solved.includes(gi) || s.status === "lost";
      const cls = done ? `done c${gi}` : (selected.includes(id) ? "sel" : "");
      const label = done && s.status === "lost" && !s.solved.includes(gi)
        ? `${byId[id].display}` : byId[id].display;
      return `<div class="conn-card ${cls}" data-id="${id}">${label}</div>`;
    }).join("");
    $("#connBoard").querySelectorAll(".conn-card:not(.done)").forEach((el) => {
      el.onclick = () => toggle(el.dataset.id);
    });
    $("#connSubmit").disabled = selected.length !== 4 || s.status !== "playing";
    if (s.status !== "playing") renderResult();
    else $("#connResult").classList.add("hidden");
  }

  function toggle(id) {
    if (state().status !== "playing") return;
    const i = selected.indexOf(id);
    if (i >= 0) selected.splice(i, 1);
    else if (selected.length < 4) selected.push(id);
    render();
  }

  function submit() {
    const s = state();
    if (s.status !== "playing" || selected.length !== 4) return;
    const p = puzzle();
    const g0 = groupOf(selected[0]);
    const allSame = selected.every((id) => groupOf(id) === g0);
    if (allSame) {
      s.solved.push(g0);
      s.history.push([SRD.CONN_COLORS[g0], SRD.CONN_COLORS[g0], SRD.CONN_COLORS[g0], SRD.CONN_COLORS[g0]]);
      if (s.solved.length === 4) s.status = "won";
    } else {
      s.mistakes++;
      s.history.push(SRD.connRowColors(p, selected));
      // “差一个”提示
      const countByGroup = [0, 0, 0, 0];
      selected.forEach((id) => countByGroup[groupOf(id)]++);
      toast(countByGroup.includes(3) ? "差一个！" : "不对，再想想");
      if (s.mistakes >= MAX_WRONG) s.status = "lost";
    }
    selected = [];
    persist();
    render();
  }

  function newPracticeRound() {
    inPractice = true;
    practice = newState(Math.floor(Math.random() * puzzles.length), null);
    selected = [];
    render();
  }

  function renderResult() {
    const s = state();
    const won = s.status === "won";
    $("#connResult").innerHTML = `
      <h2>${won ? `连成 4 组！共 ${s.history.length} 步` : "连线失败"}</h2>
      <p class="r-meta">${won ? "每一组的颜色代表难度（黄易紫难）" : "正确答案已在上方亮出"}</p>
      <div class="btn-row">
        <button class="btn" id="connAgainBtn">再来一题（随机）</button>
        <button class="btn ghost" id="connShareBtn">复制分享卡</button>
      </div>
      ${!inPractice ? '<p class="r-stats">每日题已完成，可以一直玩随机题 · 成绩与分享卡已定格</p>' : ""}`;
    $("#connResult").classList.remove("hidden");
    $("#connShareBtn").onclick = () =>
      copyText(SRD.buildConnShareText({ date: SRD.dateStr(), rows: s.history, won, practice: inPractice }));
    $("#connAgainBtn").onclick = () => newPracticeRound();
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

  $("#connSubmit").addEventListener("click", submit);
  $("#connClear").addEventListener("click", () => { selected = []; render(); });
  $("#connPracticeBtn").addEventListener("click", () => newPracticeRound());
  $("#connBackBtn").addEventListener("click", () => { inPractice = false; selected = []; render(); });

  initDaily();
  render();
})();
