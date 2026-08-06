/* 语音猜人（Heardle 式）：独立种子 / 独立存储 / 独立分享卡 */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const SRD = window.SRD;

  const characters = window.SRD_DATA;
  const byId = {};
  characters.forEach((c) => { byId[c.id] = c; });
  const voice = window.SRD_VOICE;              // {cid: {clips:[{n,type,text,file}]}}
  const eligible = Object.keys(voice);         // 有语音的角色

  const store = (() => {
    try { localStorage.setItem("srd.__t", "1"); localStorage.removeItem("srd.__t"); }
    catch (e) { const m = {}; return { get: (k) => m[k], set: (k, v) => { m[k] = v; } }; }
    return {
      get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
      set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
    };
  })();
  const loadJSON = (k, fb) => { try { const v = JSON.parse(store.get(k)); return v == null ? fb : v; } catch (e) { return fb; } };

  let daily = null, practice = null, inPractice = false;
  let sugIndex = -1, sugItems = [];

  function dailyTarget() {
    const date = SRD.dateStr();
    const cid = eligible[SRD.voiceDailyIndex(date, eligible.length)];
    const clips = voice[cid].clips;
    const ci = SRD.voiceDailyClip(date, cid, clips.length);
    return { cid, clip: clips[ci] };
  }

  function initDaily() {
    const t = dailyTarget();
    const saved = loadJSON(SRD.voiceStorageKey(SRD.dateStr()), null);
    daily = saved && saved.cid === t.cid && saved.clipN === t.clip.n
      ? saved
      : { cid: t.cid, clipN: t.clip.n, guesses: [], status: "playing" };
  }

  function state() { return inPractice ? practice : daily; }
  function clipOf() {
    const s = state();
    return voice[s.cid].clips.find((c) => c.n === s.clipN);
  }
  function persist() {
    if (!inPractice) store.set(SRD.voiceStorageKey(SRD.dateStr()), JSON.stringify(daily));
  }
  function wrongCount() { return state().guesses.length - (state().status === "won" ? 1 : 0); }
  function unlockedSecs() {
    const s = state();
    if (s.status !== "playing") return Infinity;
    return SRD.VOICE_LEVELS[Math.min(wrongCount(), SRD.VOICE_LEVELS.length - 1)];
  }

  // ---------- 播放（整段音频 + 定时截停） ----------
  const audio = new Audio();
  let stopAt = 0;
  audio.addEventListener("timeupdate", () => {
    if (audio.currentTime >= stopAt) { audio.pause(); $("#playBtn").textContent = "▶"; }
  });
  audio.addEventListener("ended", () => { $("#playBtn").textContent = "▶"; });

  function playCurrent() {
    const cl = clipOf();
    const limit = unlockedSecs();
    if (!audio.src.endsWith(cl.file)) { audio.src = cl.file; }
    audio.currentTime = 0;
    stopAt = limit;
    audio.play();
    $("#playBtn").textContent = "⏸";
  }

  // ---------- 渲染 ----------
  function render() {
    const s = state();
    const wrong = wrongCount();
    const left = SRD.MAX_GUESSES - s.guesses.length;
    const lv = ["2 秒", "5 秒", "10 秒", "完整"];
    $("#voiceUnlocks").innerHTML = lv.map((t, i) =>
      `<span class="${i <= Math.min(wrong, 3) ? "on" : ""}">${t}</span>`).join("");
    $("#voiceProgress").textContent =
      (inPractice ? "练习模式 · 不影响每日成绩" : `语音每日题 #${SRD.dateStr()}`) +
      (s.status === "playing" ? ` · 剩 ${left}/${SRD.MAX_GUESSES} 次 · 当前可听 ${lv[Math.min(wrong, 3)]}` : "");
    $("#vBackBtn").classList.toggle("hidden", !inPractice);
    $("#vPracticeBtn").textContent = inPractice ? "再换一条" : "换一条练习";
    // 兜底：最后一次机会显示台词文字
    const quote = $("#voiceQuote");
    if (s.status === "playing" && left === 1) {
      quote.textContent = "兜底提示（台词）：「" + clipOf().text + "」";
      quote.classList.remove("hidden");
    } else quote.classList.add("hidden");
    $("#vChips").innerHTML = s.guesses.map((id) =>
      `<span class="chip ${id === s.cid ? "hit" : "wrong"}">${byId[id].display}</span>`).join("");
    $("#vInput").disabled = s.status !== "playing";
    if (s.status !== "playing") renderResult();
    else $("#vResult").classList.add("hidden");
  }

  function renderResult() {
    const s = state();
    const t = byId[s.cid];
    const cl = clipOf();
    const won = s.status === "won";
    const tries = s.guesses.length;
    $("#vResult").innerHTML = `
      <img class="r-portrait" src="${t.portrait}" alt="${t.display}">
      <h2>${won ? "听出来了！" : "揭晓答案"}：${t.display}</h2>
      <p class="r-meta">语音「${cl.type}」：${cl.text}</p>
      <p class="r-grade">${tries}/${SRD.MAX_GUESSES} 次 · 评级 <b>${SRD.grade(tries, won)}</b></p>
      <p class="r-pct">${won && !inPractice ? `估算超越 ${SRD.percentile(tries, won)}% 的玩家（本地估算）` : ""}</p>
      <div class="btn-row">
        <button class="btn" id="vAgainBtn">再听一条（随机）</button>
        <button class="btn ghost" id="vShareBtn">复制分享卡</button>
      </div>
      ${!inPractice ? '<p class="r-stats">每日题已完成，可以一直听随机题 · 成绩与分享卡已定格</p>' : ""}`;
    $("#vResult").classList.remove("hidden");
    $("#vShareBtn").onclick = () =>
      copyText(SRD.buildVoiceShareText({ date: SRD.dateStr(), tries, won, practice: inPractice }));
    $("#vAgainBtn").onclick = () => newPractice();
  }

  function newPractice() {
    inPractice = true;
    const cid = eligible[Math.floor(Math.random() * eligible.length)];
    const clips = voice[cid].clips;
    practice = { cid, clipN: clips[Math.floor(Math.random() * clips.length)].n, guesses: [], status: "playing" };
    audio.pause(); audio.removeAttribute("src");
    render();
  }

  // ---------- 猜测 ----------
  function submit(id) {
    const s = state();
    if (s.status !== "playing") return;
    if (s.guesses.includes(id)) { toast("这个角色已经猜过了"); return; }
    s.guesses.push(id);
    if (id === s.cid) s.status = "won";
    else if (s.guesses.length >= SRD.MAX_GUESSES) s.status = "lost";
    persist();
    render();
  }

  // ---------- 自动补全（候选=有语音的角色） ----------
  const pool = eligible.map((id) => byId[id]);
  function openSug(list) {
    sugItems = list; sugIndex = list.length ? 0 : -1;
    const ul = $("#vSuggest");
    ul.innerHTML = list.map((c, i) => `
      <li data-id="${c.id}" class="${i === sugIndex ? "active" : ""}">
        <img loading="lazy" src="${c.icon}" alt="">
        <span class="s-name">${c.display}</span>
        <span class="s-meta">${c.rarity}★ ${c.path}·${c.element}</span>
      </li>`).join("");
    ul.classList.toggle("hidden", !list.length);
    ul.querySelectorAll("li").forEach((li) =>
      li.addEventListener("pointerdown", (e) => { e.preventDefault(); pick(li.dataset.id); }));
  }
  function closeSug() { $("#vSuggest").classList.add("hidden"); sugItems = []; sugIndex = -1; }
  function moveSug(d) {
    if (!sugItems.length) return;
    sugIndex = (sugIndex + d + sugItems.length) % sugItems.length;
    $("#vSuggest").querySelectorAll("li").forEach((li, i) => li.classList.toggle("active", i === sugIndex));
  }
  function pick(id) { $("#vInput").value = ""; closeSug(); submit(id); }

  // ---------- 复制 ----------
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
    toastTimer = setTimeout(() => el.classList.add("hidden"), 2200);
  }

  // ---------- 启动 ----------
  function init() {
    initDaily();
    const input = $("#vInput");
    input.addEventListener("input", () => openSug(SRD.search(pool, input.value, state().guesses)));
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); moveSug(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); moveSug(-1); }
      else if (e.key === "Enter") {
        e.preventDefault();
        if (sugItems.length) pick(sugItems[Math.max(sugIndex, 0)].id);
      } else if (e.key === "Escape") closeSug();
    });
    input.addEventListener("blur", () => setTimeout(closeSug, 120));
    $("#playBtn").addEventListener("click", () => {
      if (audio.paused) playCurrent();
      else { audio.pause(); $("#playBtn").textContent = "▶"; }
    });
    $("#vPracticeBtn").addEventListener("click", () => newPractice());
    $("#vBackBtn").addEventListener("click", () => {
      inPractice = false; audio.pause(); audio.removeAttribute("src"); render();
    });
    render();
  }
  init();
})();
