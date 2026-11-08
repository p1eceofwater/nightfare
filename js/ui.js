/* Ночной тариф — интерфейс: меню, гараж и город между сменами, экран смены, окна событий, настройки. */
(function () {
  "use strict";
  const NF = window.NF;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const T = (k, v) => esc(NF.t(k, v));
  const VERSION = "1.2.2";
  NF.VERSION = VERSION;

  // ───────── настройки ─────────
  const SET_KEY = "nightfare_settings_v1";
  const DEF = { lang: null, music: 0.6, rain: 0.6, sfx: 0.7, station: "lofi", radio: true, speed: 1, text: "m", vib: true, reduce: false, zen: false, chances: true };
  let SET = Object.assign({}, DEF);
  try { Object.assign(SET, JSON.parse(localStorage.getItem(SET_KEY) || "{}")); } catch (e) {}
  const saveSet = () => { try { localStorage.setItem(SET_KEY, JSON.stringify(SET)); } catch (e) {} };

  let S = null; // состояние игры
  const UI = { screen: "menu", tab: "shift", coll: "album", speed: SET.speed, last: 0, acc: 0, mov: 0, nextAmb: 8, nextNews: 40, sheet: null, startDistrict: null };
  NF.ui = UI;

  // ───────── полезное ─────────
  const vib = (p) => { if (SET.vib && navigator.vibrate) try { navigator.vibrate(p); } catch (e) {} };
  const sfx = (n) => NF.audio && NF.audio.sfx(n);
  const stars = (n) => "★".repeat(n) + "☆".repeat(5 - n);
  const WICON = { clear: "🌙", rain: "🌧", storm: "⛈", snow: "❄", fog: "🌫" };
  const TONE_ICON = { talk: "💬", music: "🎵", quiet: "🤫" };
  const SK_ICON = { charm: "😊", eye: "👁", econ: "🪙", stamina: "💪", city: "🧭" };
  const UP_ICON = { seats: "💺", clean: "🧽", music: "🔊", climate: "❄", nav: "🧭", eco: "🍃", tires: "🛞", charger: "🔌", snacks: "🍬", dashcam: "📹" };
  const ITEM_ICON = { phone: "📱", wallet: "👛", umbrella: "☂", keys: "🔑", ring: "💍", scarf: "🧣", book: "📕", toy: "🧸", watch: "⌚", camera: "📷", glasses: "👓", letter: "✉", case: "💼", coin: "🪙", autograph: "✍", sketch: "🖼", gift: "🎁", scarf_gift: "🧣" };
  function applyText() { document.documentElement.style.fontSize = { s: "14px", m: "16px", l: "18.5px" }[SET.text] || "16px"; }
  function setLang(l) {
    NF.lang = l; SET.lang = l; saveSet();
    document.documentElement.lang = l;
    document.title = NF.t("meta.title") + " · Night Fare";
    if (S) S.lang = l;
    rerender();
  }
  function rerender() {
    if (UI.screen === "menu") renderMenu();
    if (UI.screen === "hub") renderHub();
    if (UI.screen === "shift") renderShift();
  }
  function show(screen) {
    UI.screen = screen;
    for (const id of ["menu", "hub", "shift"]) $("#scr-" + id).classList.toggle("hidden", id !== screen);
    rerender();
    for (const el of document.querySelectorAll(".hub-body, #scr-menu, .panel")) el.scrollTop = 0;
  }
  function save(force) { if (S) { NF.save(S); NF.platform.cloudSave(S, force); } }

  // ───────── всплывающие уведомления ─────────
  function toast(html, cls = "") {
    const box = $("#toasts"), el = document.createElement("div");
    el.className = "toast " + cls; el.innerHTML = html;
    box.appendChild(el);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => el.classList.add("out"), 2600);
    setTimeout(() => el.remove(), 3200);
  }

  // ───────── нижние листы (модальные окна) ─────────
  function sheet(html, opt = {}) {
    UI.sheet = opt.kind || "info";
    const w = $("#sheet"), c = $("#sheet-card");
    c.innerHTML = html;
    w.classList.remove("hidden");
    c.scrollTop = 0;
    w.onclick = (e) => { if (e.target === w && opt.dismiss !== false) closeSheet(); };
    paintCanvases(c);
    return c;
  }
  function closeSheet() {
    $("#sheet").classList.add("hidden");
    UI.sheet = null;
    if (UI.onClose) { const f = UI.onClose; UI.onClose = null; f(); }
  }
  NF.closeSheet = closeSheet;

  // ───────── отрисовка маленьких холстов (портреты, машины, открытки) ─────────
  function paintCanvases(root) {
    for (const c of $$("canvas.pt", root)) {
      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, c.width, c.height);
      if (c.dataset.lock) { ctx.globalAlpha = 0.25; }
      NF.drawPortrait(ctx, 0, 1, 1, c.dataset.arch, +c.dataset.seed, c.dataset.g);
      if (c.dataset.lock) { ctx.globalCompositeOperation = "source-atop"; ctx.fillStyle = "#1a1d2b"; ctx.fillRect(0, 0, 16, 18); ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1; }
    }
    for (const c of $$("canvas.car", root)) {
      const ctx = c.getContext("2d"), car = NF.CARS[+c.dataset.idx];
      ctx.clearRect(0, 0, c.width, c.height);
      NF.drawCar(ctx, 0, 0, 1, +c.dataset.idx, car.color);
    }
    for (const c of $$("canvas.pc", root)) NF.drawPostcard(c, c.dataset.d, c.dataset.w, c.dataset.m ? +c.dataset.m : null);
  }
  const ptc = (arch, seed, g, lock) => `<canvas class="pt" width="16" height="18" data-arch="${arch}" data-seed="${seed}" data-g="${g || "m"}"${lock ? ' data-lock="1"' : ""}></canvas>`;
  const archSeed = (a) => Math.abs(NF.hashStr("album" + a)) % 1e6;

  // ════════════════ ГЛАВНОЕ МЕНЮ ════════════════
  function renderMenu() {
    const root = $("#menu-body");
    const sz = NF.seasonOf();
    const badge = sz.season === "halloween" || sz.season === "newyear" ? `<div class="badge season">${T("ui.season_" + sz.season)}</div>` : "";
    const best = S && S.dayBest[NF.today()];
    root.innerHTML = `
      <div class="logo">${T("meta.title")}</div>
      <div class="sub">${T("meta.sub")}</div>${badge}
      <div class="menu-btns">
        ${S ? `<button class="btn big primary" data-a="continue">${T("ui.continue")}<small>${T("ui.night")} ${S.nights + (S.shift ? 1 : 0)} · ${T("ui.level")} ${S.level} · ${NF.money(S.money)}</small></button>` : ""}
        <button class="btn big ${S ? "" : "primary"}" data-a="new">${T("ui.newGame")}</button>
        <button class="btn" data-a="daily">🌃 ${T("ui.dailyNight")}${best ? `<small>${T("ui.dailyBest")}: ${NF.money(best)}</small>` : `<small>${T("ui.dailyHint")}</small>`}</button>
        <div class="row2">
          <button class="btn" data-a="settings">⚙ ${T("ui.settings")}</button>
          <button class="btn" data-a="lang">🌐 ${esc(NF.L("meta.name"))}</button>
        </div>
        <button class="btn ghost" data-a="about">✦ ${T("ui.about")}</button>
      </div>
      <div class="foot"><span class="age">12+</span> v${VERSION} · ${T("ui.footer")}</div>`;
    root.onclick = (e) => {
      const b = e.target.closest("[data-a]");
      if (!b) return;
      sfx("click");
      const a = b.dataset.a;
      if (a === "continue") { if (S.shift) show("shift"); else show("hub"); }
      if (a === "new") {
        if (S) sheet(`<h2>${T("ui.newGame")}</h2><p>${T("ui.confirmNew")}</p><div class="row2"><button class="btn" data-x="no">${T("ui.cancel")}</button><button class="btn danger" data-x="yes">${T("ui.startOver")}</button></div>`).onclick = (ev) => {
          const x = ev.target.closest("[data-x]");
          if (!x) return;
          closeSheet();
          if (x.dataset.x === "yes") newGame();
        };
        else newGame();
      }
      if (a === "daily") startDaily();
      if (a === "settings") openSettings();
      if (a === "lang") openLang(false);
      if (a === "about") openAbout();
    };
  }
  function newGame() {
    S = NF.newState(NF.lang);
    save();
    const intro = NF.L("intro") || [];
    sheet(`<div class="intro"><div class="logo small">${T("meta.title")} <span class="age">12+</span></div>${intro.map((p) => `<p>${esc(p)}</p>`).join("")}<button class="btn big primary" data-x="go">${T("ui.letsgo")}</button></div>`, { dismiss: false }).onclick = (e) => {
      if (e.target.closest("[data-x]")) { closeSheet(); UI.tab = "shift"; show("hub"); }
    };
  }
  function startDaily() {
    if (!S) { S = NF.newState(NF.lang); }
    if (S.shift) { show("shift"); return; }
    if (!NF.canDaily(S)) { toast(`🌃 ${T("ui.dailyDone")} ${NF.money(S.dayBest[NF.today()])}`); return; }
    sheet(`<h2>🌃 ${T("ui.dailyNight")}</h2><p>${T("ui.dailyAbout")}</p><div class="row2"><button class="btn" data-x="no">${T("ui.cancel")}</button><button class="btn primary" data-x="yes">${T("ui.startShift")}</button></div>`).onclick = (e) => {
      const x = e.target.closest("[data-x]");
      if (!x) return;
      closeSheet();
      if (x.dataset.x === "yes") beginShift(true);
    };
  }

  // ════════════════ МЕЖДУ СМЕНАМИ ════════════════
  const TABS = [["shift", "🚕"], ["garage", "🔧"], ["skills", "⭐"], ["city", "🗺"], ["coll", "📚"], ["journal", "📓"], ["fleet", "🏢"]];
  function renderHub() {
    if (!S) { show("menu"); return; }
    NF.ensureDaily(S);
    const need = NF.xpNeed(S.level);
    const head = $("#hub-head");
    head.innerHTML = `
      <div class="hh-top">
        <button class="icon" data-h="menu" aria-label="menu">☰</button>
        <div class="hh-title"><b>${esc((NF.L("titles") || [])[NF.titleIdx(S)] || "")}</b><span>${T("ui.night")} ${S.nights} · ${T("ui.level")} ${S.level}${S.legend ? " · ♛" + S.legend : ""}</span></div>
        <button class="icon" data-h="settings" aria-label="settings">⚙</button>
      </div>
      <div class="xp"><i style="width:${S.level >= NF.LEVEL_CAP ? 100 : Math.round((S.xp / need) * 100)}%"></i></div>
      <div class="hh-stats"><span class="money">${NF.money(S.money)}</span><span>★ ${NF.num(S.rating, 2)}</span>${S.sp ? `<span class="sp" data-h="sp">+${S.sp} ${T("ui.sp")}</span>` : ""}</div>
      <nav class="tabs">${TABS.map(([id, ic]) => `<button class="tab ${UI.tab === id ? "on" : ""}" data-tab="${id}"><span>${ic}</span>${T("ui.tab_" + id)}${id === "coll" && S.lost.length ? '<em class="dot"></em>' : ""}</button>`).join("")}</nav>`;
    head.onclick = (e) => {
      const t = e.target.closest("[data-tab]");
      if (t) { sfx("click"); UI.tab = t.dataset.tab; renderHub(); $("#hub-body").scrollTop = 0; return; }
      const h = e.target.closest("[data-h]");
      if (!h) return;
      sfx("click");
      if (h.dataset.h === "menu") { save(); show("menu"); }
      if (h.dataset.h === "settings") openSettings();
      if (h.dataset.h === "sp") { UI.tab = "skills"; renderHub(); }
    };
    const body = $("#hub-body");
    body.innerHTML = `<div class="hub-cols">${({ shift: tabShift, garage: tabGarage, skills: tabSkills, city: tabCity, coll: tabColl, journal: tabJournal, fleet: tabFleet }[UI.tab] || tabShift)()}</div>`;
    body.onclick = hubClick;
    paintCanvases(body);
  }

  function tabShift() {
    const d = NF.ensureDaily(S);
    const ls = S.lastSummary;
    const start = UI.startDistrict && S.districts.includes(UI.startDistrict) ? UI.startDistrict : S.district;
    UI.startDistrict = start;
    const news = NF.L("news") || [];
    const karmaKey = S.karma >= 30 ? "k_saint" : S.karma >= 10 ? "k_good" : S.karma <= -25 ? "k_dark" : S.karma <= -8 ? "k_shady" : "k_plain";
    return `
      <div class="card hero">
        <canvas class="pc wide" width="256" height="128" data-d="${start}" data-w="clear" data-m="30"></canvas>
        <div class="hero-in">
          <h2>${T("ui.night")} ${S.nights + 1}</h2>
          <p class="muted">${T("ui.startFrom")}</p>
          <div class="chips">${S.districts.map((id) => `<button class="chip ${id === start ? "on" : ""}" data-start="${id}">${esc(NF.dname(id))}</button>`).join("")}</div>
          <button class="btn big primary" data-act="start">🚕 ${T("ui.startShift")}</button>
          ${NF.canDaily(S) ? `<button class="btn" data-act="daily">🌃 ${T("ui.dailyNight")}<small>${T("ui.dailyHint")}</small></button>` : `<p class="muted center">🌃 ${T("ui.dailyDone")} ${NF.money(S.dayBest[NF.today()] || 0)}</p>`}
        </div>
      </div>
      <div class="card">
        <h3>📋 ${T("ui.dailyTasks")}</h3>
        ${d.tasks.map((t) => `<div class="task ${t.done ? "done" : ""}"><span>${t.done ? "✅" : "▫"} ${T("daily." + t.t, { n: t.t === "earn" ? NF.money(t.goal) : t.goal })}</span><b>${t.t === "earn" ? NF.money(t.prog) : NF.num(t.prog, t.t === "km" ? 1 : 0)}/${t.t === "earn" ? NF.money(t.goal) : t.goal}</b></div>`).join("")}
        <p class="muted small">${T("ui.dailyReset")}</p>
      </div>
      ${ls ? `<div class="card"><h3>🌅 ${T("ui.lastShift")}</h3><div class="kv"><span>${T("ui.earned")}</span><b>${NF.money(ls.earned + ls.tips)}</b></div><div class="kv"><span>${T("ui.rides")}</span><b>${ls.rides}</b></div><div class="kv"><span>${T("ui.avgStars")}</span><b>★ ${NF.num(ls.avg, 2)}</b></div></div>` : ""}
      <div class="card"><h3>🚖 ${T("ui.you")}</h3>
        <div class="kv"><span>${T("ui.reputation")}</span><b>${T("ui." + karmaKey)}</b></div>
        <div class="kv"><span>${T("ui.totalRides")}</span><b>${NF.num(S.stats.rides)}</b></div>
        <div class="kv"><span>${T("ui.totalKm")}</span><b>${NF.num(S.stats.km)} ${T("ui.km")}</b></div>
        <div class="kv"><span>${T("ui.totalEarned")}</span><b>${NF.money(S.stats.earned)}</b></div>
        <div class="kv"><span>${T("ui.car")}</span><b>${T("car." + S.car + ".n")}</b></div>
      </div>
      ${news.length ? `<div class="card radio"><span>📻</span> ${esc(news[(S.nights * 7 + new Date().getDate()) % news.length])}</div>` : ""}`;
  }

  function bar(v, cls = "") { return `<div class="bar ${cls}"><i style="width:${Math.round(Math.max(0, Math.min(100, v)))}%"></i></div>`; }
  function tabGarage() {
    const c = NF.CAR[S.car], idx = S.carIdx;
    const ups = NF.UPGRADES.map((u) => {
      const lv = S.ups[u.id] || 0, max = lv >= NF.UP_MAX, cost = NF.upPrice(S, u);
      return `<div class="item">
        <div class="ic">${UP_ICON[u.id]}</div>
        <div class="grow"><b>${T("up." + u.id + ".n")}</b><div class="muted small">${T("up." + u.id + ".d")}</div><div class="pips">${"■".repeat(lv)}<span>${"■".repeat(NF.UP_MAX - lv)}</span></div></div>
        <button class="btn sm ${!max && S.money >= cost ? "primary" : ""}" data-up="${u.id}" ${max || S.money < cost ? "disabled" : ""}>${max ? T("ui.max") : NF.money(cost)}</button></div>`;
    }).join("");
    const cars = NF.CARS.map((k, i) => {
      const own = S.cars.includes(k.id), cur = S.car === k.id;
      return `<div class="item carrow ${cur ? "cur" : ""}">
        <canvas class="car" width="64" height="24" data-idx="${i}"></canvas>
        <div class="grow"><b>${T("car." + k.id + ".n")}</b><div class="muted small">${T("car." + k.id + ".d")}</div>
        <div class="small">🛋 +${Math.round(k.comfort * 100)}% · ⛽ ${k.eff} · 💵 +${i * 15}%</div></div>
        ${cur ? `<span class="tag">${T("ui.driving")}</span>` : own ? `<button class="btn sm" data-sel="${k.id}">${T("ui.select")}</button>` : `<button class="btn sm ${S.money >= k.price ? "primary" : ""}" data-car="${k.id}" ${S.money < k.price ? "disabled" : ""}>${NF.money(k.price)}</button>`}
      </div>`;
    }).join("");
    return `
      <div class="card garage-hero">
        <div class="car-big"><canvas class="car" width="64" height="24" data-idx="${idx}"></canvas></div>
        <h2>${T("car." + c.id + ".n")}</h2><p class="muted">${T("car." + c.id + ".d")}</p>
        <div class="gauge"><span>🔧 ${T("ui.cond")}</span>${bar(S.cond, S.cond < 40 ? "warn" : "")}<button class="btn sm" data-act="repair" ${S.cond >= 100 || S.money < NF.repairCost(S) ? "disabled" : ""}>${S.cond >= 100 ? "✓" : NF.money(NF.repairCost(S))}</button></div>
        <div class="gauge"><span>⛽ ${T("ui.fuel")}</span>${bar(S.fuel, S.fuel < 25 ? "warn" : "")}<button class="btn sm" data-act="refuel" ${S.fuel >= 100 || S.money < NF.refuelCost(S) ? "disabled" : ""}>${S.fuel >= 100 ? "✓" : NF.money(NF.refuelCost(S))}</button></div>
      </div>
      <div class="card"><h3>🛠 ${T("ui.upgrades")}</h3>${ups}</div>
      <div class="card"><h3>🚗 ${T("ui.showroom")}</h3><p class="muted small">${T("ui.showroomHint")}</p>${cars}</div>`;
  }

  function tabSkills() {
    return `<div class="card"><h3>⭐ ${T("ui.skills")}</h3><p class="muted">${T("ui.skillsHint")}</p><div class="sp-big">${S.sp} ${T("ui.sp")}</div>
      ${NF.SKILLS.map((id) => {
        const r = S.skills[id], max = r >= NF.SKILL_MAX, cost = NF.skillCost(S, id);
        return `<div class="item"><div class="ic">${SK_ICON[id]}</div><div class="grow"><b>${T("sk." + id + ".n")}</b> <span class="muted">${r}/${NF.SKILL_MAX}</span><div class="muted small">${T("sk." + id + ".d")}</div><div class="pips">${"■".repeat(r)}<span>${"■".repeat(NF.SKILL_MAX - r)}</span></div></div>
        <button class="btn sm ${!max && S.sp >= cost ? "primary" : ""}" data-sk="${id}" ${max || S.sp < cost ? "disabled" : ""}>${max ? T("ui.max") : `${cost} ${T("ui.spShort")}`}</button></div>`;
      }).join("")}</div>`;
  }

  function tabCity() {
    return `<div class="card"><h3>🗺 ${T("ui.city")}</h3><p class="muted">${T("ui.cityHint")}</p></div>` + NF.DISTRICTS.map((d) => {
      const open = S.districts.includes(d.id), chk = NF.unlockCheck(S, d.id), n = d.need;
      const secret = n.flag && !S.flags[n.flag] && !open;
      return `<div class="card district ${open ? "" : "locked"}">
        <canvas class="pc wide ${open ? "" : "dim"}" width="256" height="128" data-d="${d.id}" data-w="clear" data-m="${open ? 120 : 200}"></canvas>
        <div class="d-in"><div class="d-top"><b>${secret ? "???" : T("d." + d.id + ".n")}</b><span class="tag">×${NF.num(d.mult, 2)}</span></div>
        <p class="muted small">${secret ? T("ui.secretDistrict") : T("d." + d.id + ".d")}</p>
        ${open ? (S.district === d.id ? `<span class="tag ok">📍 ${T("ui.youAreHere")}</span>` : "") :
          secret ? "" : `<div class="reqs"><span class="${chk.rating ? "ok" : ""}">★ ${NF.num(n.rating, 2)}</span><span class="${chk.level ? "ok" : ""}">${T("ui.level")} ${n.level}</span><span class="${chk.fee ? "ok" : ""}">${NF.money(n.fee)}</span></div>
          <button class="btn ${chk.ok ? "primary" : ""}" data-unlock="${d.id}" ${chk.ok ? "" : "disabled"}>🔓 ${T("ui.unlock")}</button>`}
        </div></div>`;
    }).join("");
  }

  const COLL = [["album", "👤"], ["cards", "📮"], ["items", "🎁"], ["lost", "📦"], ["stories", "📖"], ["ach", "🏆"]];
  function tabColl() {
    const sub = `<div class="chips sub">${COLL.map(([id, ic]) => `<button class="chip ${UI.coll === id ? "on" : ""}" data-coll="${id}">${ic} ${T("ui.coll_" + id)}${id === "lost" && S.lost.length ? ` (${S.lost.length})` : ""}</button>`).join("")}</div>`;
    let body = "";
    if (UI.coll === "album") {
      const met = NF.ARCH.filter((a) => S.album[a.id]).length;
      body = `<p class="muted">${T("ui.albumHint")} ${met}/${NF.ARCH.length}</p><div class="grid">` + NF.ARCH.map((a) => {
        const n = S.album[a.id] || 0;
        return `<div class="cell ${n ? "" : "lock"}">${ptc(a.id, archSeed(a.id), a.g > 0.6 ? "f" : "m", !n)}<b>${n ? T("arch." + a.id) : "???"}</b><span class="muted small">${n ? `×${n} · ${TONE_ICON[a.like]}` : ""}</span>${n ? `<p class="small">${T("archd." + a.id)}</p>` : ""}</div>`;
      }).join("") + "</div>";
    } else if (UI.coll === "cards") {
      const keys = [];
      for (const d of NF.DISTRICTS) for (const w of ["clear", "rain", "storm", "fog", "snow"]) keys.push([d.id + "_" + w, d.id, w]);
      const special = Object.keys(S.postcards).filter((k) => !k.includes("_"));
      const got = Object.keys(S.postcards).length;
      body = `<p class="muted">${T("ui.cardsHint")} ${got}/${keys.length + 2}</p>` +
        (special.length ? `<div class="grid2">${special.map((k) => `<div class="pcard"><canvas class="pc" width="256" height="128" data-d="${k === "lighthouse" ? "lighthouse" : "river"}" data-w="clear" data-m="${k === "far" ? 470 : 200}"></canvas><b>✦ ${T("ui.pc_" + k)}</b></div>`).join("")}</div>` : "") +
        `<div class="grid2">${keys.map(([k, d, w]) => S.postcards[k] ? `<div class="pcard"><canvas class="pc" width="256" height="128" data-d="${d}" data-w="${w}"></canvas><b>${esc(NF.dname(d))} · ${WICON[w]}</b></div>` : `<div class="pcard empty"><div class="q">?</div><b>${S.districts.includes(d) ? esc(NF.dname(d)) : "???"} · ${WICON[w]}</b></div>`).join("")}</div>`;
    } else if (UI.coll === "items") {
      const ks = Object.keys(S.items);
      body = ks.length ? ks.map((k) => `<div class="item"><div class="ic">${ITEM_ICON[k] || "🎁"}</div><div class="grow"><b>${T("items." + k)}</b> ×${S.items[k]}<div class="muted small">${T("itemsd." + k)}</div></div></div>`).join("") : `<p class="muted">${T("ui.itemsEmpty")}</p>`;
    } else if (UI.coll === "lost") {
      body = `<p class="muted">${T("ui.lostHint")}</p>` + (S.lost.length ? S.lost.map((l, i) => `<div class="item"><div class="ic">${ITEM_ICON[l.it] || "📦"}</div><div class="grow"><b>${T("items." + l.it)}</b><div class="muted small">${T("ui.night")} ${l.n}${l.arch ? " · " + T("arch." + l.arch) : ""}</div></div>
        <button class="btn sm primary" data-ret="${i}">${T("ui.giveBack")}</button><button class="btn sm" data-keep="${i}">${T("ui.keep")}</button></div>`).join("") : `<p class="muted">${T("ui.lostEmpty")}</p>`);
    } else if (UI.coll === "stories") {
      body = NF.ARCS.map((a) => {
        const st = S.arcs[a.id] || 0, done = st >= a.eps;
        return `<div class="item story ${st ? "" : "lock"}">${ptc(a.arch === "cat" ? "cat" : a.arch, archSeed("arc" + a.id), NF.ARC_G[a.id], !st)}<div class="grow"><b>${st ? T("arcs." + a.id + ".n") : "???"}</b> <span class="muted">${st}/${a.eps}${done ? " ✓" : ""}</span><div class="muted small">${st ? T("arcs." + a.id + ".d") : T("ui.storyLocked")}</div>${bar((st / a.eps) * 100)}</div></div>`;
      }).join("");
    } else {
      const got = Object.keys(S.ach).length;
      body = `<p class="muted">${got}/${NF.ACH.length}</p>` + NF.ACH.map(([id]) => {
        const has = !!S.ach[id], a = NF.L("ach." + id) || [id, ""];
        return `<div class="item ach ${has ? "" : "lock"}"><div class="ic">${has ? "🏆" : "🔒"}</div><div class="grow"><b>${esc(a[0])}</b><div class="muted small">${esc(a[1])}</div></div></div>`;
      }).join("");
    }
    return `<div class="card">${sub}${body}</div>`;
  }

  function journalText(e) {
    if (e.k === "ev") {
      const v = NF.L("ev." + e.id + ".r." + e.key);
      return v ? NF.fmt(v, NF.evVars(e.ctx)) : "";
    }
    if (e.k === "arc") return NF.t("jr.arc", { n: NF.t("arcs." + e.id + ".n"), c: e.v });
    if (e.k === "level") return NF.t("jr.level", { n: e.v });
    if (e.k === "unlock") return NF.t("jr.unlock", { d: NF.dname(e.id) });
    if (e.k === "car") return NF.t("jr.car", { c: NF.t("car." + e.id + ".n") });
    if (e.k === "shift") return NF.t("jr.shift", { m: NF.money(e.v) });
    if (e.k === "legend") return NF.t("jr.legend", { n: e.v });
    return "";
  }
  function tabJournal() {
    const list = S.journal.slice(-160).reverse();
    if (!list.length) return `<div class="card"><h3>📓 ${T("ui.tab_journal")}</h3><p class="muted">${T("ui.journalEmpty")}</p></div>`;
    let html = "", cur = -1;
    for (const e of list) {
      if (e.n !== cur) { if (cur !== -1) html += "</div>"; cur = e.n; html += `<div class="card jr"><h3>${T("ui.night")} ${e.n}</h3>`; }
      const icon = { ev: "·", arc: "📖", level: "⬆", unlock: "🔓", car: "🚗", shift: "🌅", legend: "♛" }[e.k] || "·";
      const txt = journalText(e);
      if (txt) html += `<p class="jl jl-${e.k}"><span>${icon}</span>${esc(txt)}</p>`;
    }
    return html + "</div>";
  }

  function tabFleet() {
    if (!NF.fleetOpen(S)) {
      return `<div class="card"><h3>🏢 ${T("ui.tab_fleet")}</h3><p>${T("ui.fleetLocked")}</p><div class="reqs"><span class="${S.level >= 20 ? "ok" : ""}">${T("ui.level")} 20</span><span class="${S.districts.includes("business") ? "ok" : ""}">${T("d.business.n")}</span></div></div>` + legendCard();
    }
    const cap = NF.fleetCap(S), cost = NF.fleetCarCost(S), gc = NF.garageCost(S);
    return `<div class="card"><h3>🏢 ${T("ui.tab_fleet")}</h3><p class="muted">${T("ui.fleetHint")}</p>
      <div class="kv"><span>${T("ui.fleetCars")}</span><b>${S.fleet.cars}/${cap}</b></div>
      <div class="kv"><span>${T("ui.fleetIncome")}</span><b>${NF.money(NF.fleetIncome(S))}</b></div>
      <div class="kv"><span>${T("ui.fleetEarned")}</span><b>${NF.money(S.fleet.earned)}</b></div>
      <div class="fleet-row">${Array.from({ length: Math.min(S.fleet.cars, 40) }, (_, i) => `<canvas class="car" width="64" height="24" data-idx="${i % 4}"></canvas>`).join("")}</div>
      <button class="btn ${S.money >= cost && S.fleet.cars < cap ? "primary" : ""}" data-act="fleetcar" ${S.money < cost || S.fleet.cars >= cap ? "disabled" : ""}>🚕 ${T("ui.fleetBuy")} · ${NF.money(cost)}</button>
      <button class="btn" data-act="garage" ${S.money < gc ? "disabled" : ""}>🏗 ${T("ui.fleetGarage")} (+5) · ${NF.money(gc)}</button></div>` + legendCard();
  }
  function legendCard() {
    const n = NF.legendNeed(S);
    return `<div class="card legend"><h3>♛ ${T("ui.legend")}${S.legend ? " ×" + S.legend : ""}</h3><p class="muted">${T("ui.legendHint")}</p>
      <div class="reqs"><span class="${S.level >= n.level ? "ok" : ""}">${T("ui.level")} ${n.level}</span><span class="${S.districts.length >= NF.DISTRICTS.length ? "ok" : ""}">${T("ui.allDistricts")}</span><span class="${S.money >= n.money ? "ok" : ""}">${NF.money(n.money)}</span></div>
      <button class="btn ${NF.canLegend(S) ? "primary" : ""}" data-act="legend" ${NF.canLegend(S) ? "" : "disabled"}>♛ ${T("ui.legendBtn")}</button></div>`;
  }

  function hubClick(e) {
    const b = e.target.closest("button");
    if (!b || b.disabled) return;
    const ds = b.dataset;
    let ok = null;
    if (ds.start) { UI.startDistrict = ds.start; sfx("click"); renderHub(); return; }
    if (ds.coll) { UI.coll = ds.coll; sfx("click"); renderHub(); return; }
    if (ds.act === "start") { beginShift(false); return; }
    if (ds.act === "daily") { startDaily(); return; }
    if (ds.act === "repair") ok = NF.repair(S);
    if (ds.act === "refuel") ok = NF.refuelHome(S);
    if (ds.act === "fleetcar") ok = NF.buyFleetCar(S);
    if (ds.act === "garage") ok = NF.buyGarage(S);
    if (ds.act === "legend") {
      sheet(`<h2>♛ ${T("ui.legend")}</h2><p>${T("ui.legendConfirm")}</p><div class="row2"><button class="btn" data-x="no">${T("ui.cancel")}</button><button class="btn primary" data-x="yes">${T("ui.legendBtn")}</button></div>`).onclick = (ev) => {
        const x = ev.target.closest("[data-x]");
        if (!x) return;
        closeSheet();
        if (x.dataset.x === "yes" && NF.becomeLegend(S)) { sfx("level"); toast(`♛ ${T("ui.legendDone")}`, "gold"); save(); renderHub(); }
      };
      return;
    }
    if (ds.up) ok = NF.buyUpgrade(S, ds.up);
    if (ds.car) ok = NF.buyCar(S, ds.car);
    if (ds.sel) ok = NF.selectCar(S, ds.sel);
    if (ds.sk) ok = NF.learn(S, ds.sk);
    if (ds.unlock) { ok = NF.unlock(S, ds.unlock); if (ok) { toast(`🔓 ${T("jr.unlock", { d: NF.dname(ds.unlock) })}`, "gold"); UI.startDistrict = ds.unlock; } }
    if (ds.ret) { ok = NF.returnLost(S, +ds.ret); if (ok) toast(`📦 ${T("ui.returned")}`); }
    if (ds.keep) { const v = NF.keepLost(S, +ds.keep); ok = !!v; if (v) toast(`+${NF.money(v)}`); }
    if (ok !== null) { sfx(ok ? "coin" : "bad"); if (ok) { vib(15); save(); } renderHub(); }
  }

  // ════════════════ СМЕНА ════════════════
  // Реклама между экранами — только во время явной загрузки новой ночи (правила ВКонтакте и Яндекса):
  // не при запуске игры, не в первую ночь, не чаще раза в 3 минуты.
  const SESSION_START = Date.now();
  let lastAd = 0;
  function beginShift(daily) {
    NF.audio.init();
    const now = Date.now();
    if (!S.shift && NF.platform.hasAds() && S.nights >= 1 && now - SESSION_START > 120000 && now - lastAd > 180000 && !UI.adLoading) {
      UI.adLoading = true;
      sheet(`<div class="loading-night"><div class="spinner"></div><p>🌃 ${T("ui.loadingNight")}</p></div>`, { kind: "loading", dismiss: false });
      setTimeout(() => NF.platform.interstitial(() => { lastAd = Date.now(); UI.adLoading = false; closeSheet(); beginShift(daily); }), 900);
      return;
    }
    if (!S.shift) {
      if (!daily && UI.startDistrict && S.districts.includes(UI.startDistrict)) S.district = UI.startDistrict;
      NF.cfg.zen = SET.zen;
      NF.startShift(S, { daily });
    }
    UI.nextAmb = S.minute + 3; UI.nextNews = S.minute + 45;
    show("shift");
    NF.audio.setWeather(S.shift.weather);
    save();
    if (!S.flags.tut) {
      S.flags.tut = true;
      const how = NF.L("howto") || [];
      sheet(`<h2>🚕 ${T("ui.howTitle")}</h2>${how.map((l) => `<p>${esc(l)}</p>`).join("")}<button class="btn big primary" data-x="ok">${T("ui.gotIt")}</button>`, { kind: "how" }).onclick = (e) => { if (e.target.closest("[data-x]")) closeSheet(); };
    }
  }

  function renderShift() {
    if (!S || !S.shift) { show(S ? "hub" : "menu"); return; }
    const top = $("#shift-top");
    top.innerHTML = `
      <span class="clock" id="s-clock"></span><span id="s-weather"></span>
      <span class="money" id="s-money"></span><span id="s-rating"></span>
      <span class="sp-flex"></span>
      <button class="icon" data-s="radio" id="s-radio"></button>
      <button class="icon" data-s="speed" id="s-speed"></button>
      <button class="icon" data-s="pause">⏸</button>`;
    top.onclick = (e) => {
      const b = e.target.closest("[data-s]");
      if (!b) return;
      sfx("click");
      if (b.dataset.s === "pause") openPause();
      if (b.dataset.s === "speed") { UI.speed = UI.speed >= 3 ? 1 : UI.speed + 1; SET.speed = UI.speed; saveSet(); refreshDyn(); }
      if (b.dataset.s === "radio") cycleRadio();
    };
    renderPanel();
    renderActions();
    refreshDyn();
  }
  function cycleRadio() {
    NF.audio.init();
    const list = NF.stations(S);
    if (!SET.radio) { SET.radio = true; SET.station = list[0]; }
    else {
      const i = list.indexOf(SET.station);
      if (i < 0 || i === list.length - 1) SET.radio = false;
      else SET.station = list[i + 1];
    }
    saveSet();
    NF.audio.setStation(SET.station); NF.audio.setRadio(SET.radio);
    if (SET.radio) amb("📻 " + NF.t("ui.station_" + SET.station));
    refreshDyn();
  }

  function orderCard(o) {
    const a = NF.A[o.arch] || NF.A.office;
    const vars = { g: o.g };
    const name = o.arc ? NF.t("arcs." + o.arc.id + ".n") : NF.pname(o);
    const knows = (S.album[o.arch] || 0) >= 3 || S.skills.eye >= 2;
    const toD = o.to !== o.from ? ` <span class="muted">(${esc(NF.dname(o.to))})</span>` : "";
    return `<div class="order ${o.arc ? "arc" : ""}" data-id="${o.id}">
      ${ptc(o.arch === "cat" ? "cat" : o.arch, o.arc ? archSeed("arc" + o.arc.id) : o.seed, o.g)}
      <div class="o-main">
        <div class="o-top"><b>${esc(name)}</b> <span class="muted">· ${T("arch." + o.arch)}</span>${o.arc ? ` <span class="tag gold">★ ${T("ui.story")}</span>` : ""}</div>
        <div class="o-route">${esc(NF.place(o.from, o.fromIdx))} → ${esc(NF.place(o.to, o.toIdx))}${toD}</div>
        <div class="o-tags"><span class="mood m-${o.mood}">${esc(NF.t("mood." + o.mood, vars))}</span><span>${NF.num(o.km, 1)} ${T("ui.km")}</span>${knows ? `<span title="${T("tone." + NF.prefTone(o))}">${TONE_ICON[NF.prefTone(o)]}</span>` : ""}</div>
        <div class="exp"><i data-exp="${o.id}"></i></div>
      </div>
      <div class="o-side"><div class="fare">${NF.money(o.fare)}</div><button class="btn sm primary" data-take="${o.id}">${T("ui.take")}</button><button class="x" data-skip="${o.id}" aria-label="skip">✕</button></div>
    </div>`;
  }
  function renderPanel() {
    const p = $("#panel");
    if (!p || !S || !S.shift) return;
    const sh = S.shift, r = S.ride;
    let html = "";
    if (r) {
      const name = r.arc ? NF.t("arcs." + r.arc.id + ".n") : NF.pname(r);
      const tone = r.tone || "quiet";
      html = `<div class="ride">
        <div class="r-head">${ptc(r.arch, r.arc ? archSeed("arc" + r.arc.id) : r.seed, r.g)}<div><b>${esc(name)}</b><div class="muted small">${T("arch." + r.arch)} · ${esc(NF.t("mood." + r.mood, { g: r.g }))}</div></div><div class="fare">${NF.money(Math.round(r.fare * r.fareMul))}</div></div>
        <div class="r-route">${r.phase === "pickup" ? `🚕 ${T("ui.pickingUp")} · ${esc(NF.place(r.from, r.fromIdx))}` : `📍 ${esc(NF.place(r.from, r.fromIdx))} → ${esc(NF.place(r.to, r.toIdx))}`}</div>
        <div class="bar ride-bar"><i id="ride-prog"></i></div>
        <p class="muted small">${r.phase === "pickup" ? T("ui.toneAsk") : T("ui.toneNow")}</p>
        <div class="tones">${["talk", "music", "quiet"].map((t) => `<button class="tone ${tone === t ? "on" : ""}" data-tone="${t}">${TONE_ICON[t]}<span>${T("tone." + t)}</span></button>`).join("")}</div>
      </div>`;
    } else if (sh.busy) {
      const b = sh.busy;
      html = `<div class="busy"><div class="b-ic">${{ coffee: "☕", nap: "😴", refuel: "⛽", move: "🗺", tow: "🚛" }[b.kind]}</div><div class="grow"><b>${T("ui.busy_" + b.kind, { d: b.to ? NF.dname(b.to) : "" })}</b><div class="bar"><i id="busy-prog"></i></div></div></div>`;
    } else if (sh.orders.length) {
      html = `<div class="p-title">${T("ui.orders")} · ${esc(NF.dname(S.district))}</div>` + sh.orders.map(orderCard).join("");
    } else {
      html = `<div class="waiting"><div class="spinner"></div><p>${T("ui.waiting")}</p><p class="muted small">${T("ui.waitingHint")}</p></div>`;
    }
    p.innerHTML = html;
    p.onclick = (e) => {
      const b = e.target.closest("[data-take],[data-skip],[data-tone]");
      if (!b) return;
      NF.audio.init();
      if (b.dataset.take) { if (NF.accept(S, +b.dataset.take)) { sfx("door"); vib(10); } }
      else if (b.dataset.skip) { NF.decline(S, +b.dataset.skip); sfx("click"); renderPanel(); }
      else if (b.dataset.tone) { NF.setTone(S, b.dataset.tone); sfx("click"); $$(".tone", p).forEach((x) => x.classList.toggle("on", x === b)); }
    };
    paintCanvases(p);
    refreshDyn();
  }
  function renderActions() {
    const a = $("#actions");
    if (!a || !S || !S.shift) return;
    const can = NF.canAct(S);
    a.innerHTML = `
      <button data-do="coffee" ${can && S.money >= NF.coffeeCost(S) ? "" : "disabled"}>☕<span>${T("ui.coffee")} ${NF.money(NF.coffeeCost(S))}</span></button>
      <button data-do="nap" ${can ? "" : "disabled"}>😴<span>${T("ui.nap")}</span></button>
      <button data-do="refuel" ${can && S.fuel < 99 && S.money >= NF.refuelCost(S) ? "" : "disabled"}>⛽<span>${T("ui.refuel")} ${NF.money(NF.refuelCost(S))}</span></button>
      <button data-do="move" ${can && S.districts.length > 1 ? "" : "disabled"}>🗺<span>${T("ui.move")}</span></button>
      <button data-do="home" ${can ? "" : "disabled"}>🏠<span>${T("ui.home")}</span></button>`;
    a.onclick = (e) => {
      const b = e.target.closest("[data-do]");
      if (!b || b.disabled) return;
      NF.audio.init();
      sfx("click");
      const d = b.dataset.do;
      if (d === "move") {
        sheet(`<h2>🗺 ${T("ui.move")}</h2><p class="muted">${T("ui.moveHint")}</p>${S.districts.filter((x) => x !== S.district).map((x) => `<button class="btn" data-mv="${x}">${esc(NF.dname(x))} <small>×${NF.num(NF.D[x].mult, 2)}</small></button>`).join("")}<button class="btn ghost" data-mv="">${T("ui.cancel")}</button>`, { kind: "move" }).onclick = (ev) => {
          const m = ev.target.closest("[data-mv]");
          if (!m) return;
          closeSheet();
          if (m.dataset.mv) NF.act(S, "move", m.dataset.mv);
        };
        return;
      }
      if (d === "home") {
        sheet(`<h2>🏠 ${T("ui.home")}</h2><p>${T("ui.homeConfirm")}</p><div class="row2"><button class="btn" data-x="no">${T("ui.cancel")}</button><button class="btn primary" data-x="yes">${T("ui.home")}</button></div>`, { kind: "home" }).onclick = (ev) => {
          const x = ev.target.closest("[data-x]");
          if (!x) return;
          closeSheet();
          if (x.dataset.x === "yes") NF.endShift(S, S.minute < NF.SHIFT_LEN - 20, "home");
        };
        return;
      }
      NF.act(S, d);
    };
  }
  function refreshDyn() {
    if (UI.screen !== "shift" || !S || !S.shift) return;
    const sh = S.shift;
    const set = (id, v) => { const el = $("#" + id); if (el && el.innerHTML !== v) el.innerHTML = v; };
    set("s-clock", NF.clock(S.minute));
    set("s-weather", WICON[sh.weather] + (NF.surge(S) > 1.01 ? ` <small class="surge">×${NF.num(NF.surge(S), 2)}</small>` : ""));
    set("s-money", NF.money(S.money));
    set("s-rating", "★" + NF.num(S.rating, 2));
    set("s-speed", UI.speed + "×");
    set("s-radio", SET.radio ? "📻" : "🔇");
    const g = (id, v) => { const el = $("#" + id); if (el) { el.style.width = Math.max(0, Math.min(100, v)) + "%"; el.parentElement.classList.toggle("warn", v < 25); } };
    g("g-fuel", S.fuel); g("g-energy", S.energy); g("g-cond", S.cond);
    set("g-district", esc(NF.dname(S.district)) + (sh.daily ? " · 🌃" : "") + (sh.zen ? " · 🍃" : ""));
    for (const el of $$("[data-exp]")) {
      const o = sh.orders.find((x) => x.id === +el.dataset.exp);
      if (o) el.style.width = (o.exp > 1e8 ? 100 : Math.max(0, Math.min(100, ((o.exp - S.minute) / 14) * 100))) + "%";
    }
    const r = S.ride;
    const rp = $("#ride-prog");
    if (r && rp) rp.style.width = Math.round((1 - r.t / Math.max(1, r.total)) * 100) + "%";
    const bp = $("#busy-prog");
    if (sh.busy && bp) bp.style.width = Math.round((1 - sh.busy.t / sh.busy.total) * 100) + "%";
    const prog = Math.min(100, (S.minute / NF.SHIFT_LEN) * 100);
    const np = $("#night-prog"); if (np) np.style.width = prog + "%";
  }

  function amb(text) {
    const el = $("#amb");
    if (!el) return;
    el.classList.remove("in");
    void el.offsetWidth;
    el.textContent = text;
    el.classList.add("in");
  }
  function ambientTick() {
    if (!S.shift) return;
    if (S.minute >= UI.nextAmb) {
      UI.nextAmb = S.minute + 30 + Math.random() * 35;
      const A = NF.L("amb") || {};
      const pool = [].concat(A.any || [], A[S.shift.weather] || [], A["d_" + S.district] || [], S.hour >= 2 && S.hour < 5 ? A.late || [] : [], S.hour >= 5 && S.hour < 6 ? A.dawn || [] : [], S.minute < 60 ? A.dusk || [] : []);
      if (pool.length) amb(pool[Math.floor(Math.random() * pool.length)]);
    } else if (SET.radio && S.minute >= UI.nextNews) {
      UI.nextNews = S.minute + 80 + Math.random() * 60;
      const N = NF.L("news") || [];
      if (N.length) amb("📻 " + N[Math.floor(Math.random() * N.length)]);
    }
  }

  // ───────── события ─────────
  function deltaChips(d, ctx) {
    const c = [];
    if (d.m) c.push(`<span class="${d.m > 0 ? "pos" : "neg"}">${d.m > 0 ? "+" : "−"}${NF.money(Math.abs(d.m))}</span>`);
    if (d.tip) c.push(`<span class="pos">+${NF.money(d.tip)} ${T("ui.tipShort")}</span>`);
    if (d.r) c.push(`<span class="${d.r > 0 ? "pos" : "neg"}">${d.r > 0 ? "☺" : "☹"} ${T(d.r > 0 ? "ui.paxHappy" : "ui.paxUnhappy")}</span>`);
    if (d.fame) c.push(`<span class="${d.fame > 0 ? "pos" : "neg"}">★ ${d.fame > 0 ? "+" : "−"}${NF.num(Math.abs(d.fame), 2)}</span>`);
    if (d.en) c.push(`<span class="${d.en > 0 ? "pos" : "neg"}">⚡ ${d.en > 0 ? "+" : ""}${d.en}</span>`);
    if (d.c) c.push(`<span class="${d.c > 0 ? "pos" : "neg"}">🔧 ${d.c > 0 ? "+" : ""}${d.c}</span>`);
    if (d.fu) c.push(`<span>⛽ ${d.fu}</span>`);
    if (d.time) c.push(`<span>⏱ ${d.time > 0 ? "+" : ""}${d.time} ${T("ui.min")}</span>`);
    if (d.xp) c.push(`<span class="pos">+${d.xp} XP</span>`);
    if (d.sp) c.push(`<span class="pos">+${d.sp} ${T("ui.spShort")}</span>`);
    if (d.item) c.push(`<span class="gold">${ITEM_ICON[d.item] || "🎁"} ${T("items." + d.item)}</span>`);
    if (d.lost) c.push(`<span>📦 ${T("ui.toLost")}</span>`);
    if (d.pc) c.push(`<span class="gold">📮 ${T(d.pcNew ? "ui.newCard" : "ui.cardAgain")}</span>`);
    if (d.fare) c.push(`<span>🧭 ${T("ui.routeChanged")}</span>`);
    if (d.arc) c.push(`<span class="gold">📖 ${T("arcs." + d.arc[0] + ".n")} ${d.arc[1]}/${NF.ARC[d.arc[0]].eps}</span>`);
    return c.length ? `<div class="chips-res">${c.join("")}</div>` : "";
  }
  function showEvent(p) {
    const e = NF.EV[p.id];
    if (!e) return;
    const vars = NF.evVars(p.ctx);
    const txt = NF.L("ev." + p.id) || { t: p.id, o: e.o.map((_, i) => "#" + (i + 1)) };
    let label;
    if (e.cat === "arc") label = `📖 ${T("arcs." + e.arc + ".n")} · ${T("ui.chapter")} ${e.n}`;
    else label = { ride: "🚕 " + T("ui.lbl_ride"), road: "🛣 " + T("ui.lbl_road"), idle: "☕ " + T("ui.lbl_idle"), later: "🕰 " + T("ui.lbl_later") }[e.cat];
    let portrait = "";
    if (e.cat === "arc") portrait = ptc(NF.ARC[e.arc].arch === "cat" ? "cat" : NF.ARC[e.arc].arch, archSeed("arc" + e.arc), NF.ARC_G[e.arc]);
    else if (p.ctx.arch && (e.cat === "ride")) portrait = ptc(p.ctx.arch, p.ctx.seed, p.ctx.g);
    const opts = e.o.map((o, i) => {
      const ch = NF.chance(S, o);
      const badge = o.p != null && SET.chances ? `<em class="chance">${Math.round(ch * 100)}%${o.sk ? " " + SK_ICON[o.sk] : ""}</em>` : o.p != null ? `<em class="chance">🎲</em>` : "";
      return `<button class="opt" data-o="${i}">${esc(NF.fmt((txt.o || [])[i] || "…", vars))}${badge}</button>`;
    }).join("");
    sfx("event"); vib([10, 40, 10]);
    sheet(`<div class="ev"><div class="ev-head">${portrait ? `<div class="ev-pt">${portrait}</div>` : ""}<div class="ev-lbl">${label}</div></div>
      <p class="ev-text">${esc(NF.fmt(txt.t, vars))}</p><div class="opts">${opts}</div></div>`, { kind: "event", dismiss: false }).onclick = (ev) => {
      const b = ev.target.closest("[data-o]");
      if (!b || !S.pending) return;
      const res = NF.choose(S, +b.dataset.o);
      if (!res) return;
      const rt = NF.L("ev." + p.id + ".r." + res.key) || "";
      const good = (res.delta.m || 0) >= 0 && (res.delta.r || 0) >= 0 && !res.key.endsWith("f");
      sfx(res.key.endsWith("f") ? "bad" : good ? "good" : "click");
      const card = $("#sheet-card");
      card.innerHTML = `<div class="ev"><div class="ev-head">${portrait ? `<div class="ev-pt">${portrait}</div>` : ""}<div class="ev-lbl">${label}</div></div>
        ${res.key.endsWith("s") ? `<div class="roll ok">🎲 ${T("ui.success")}</div>` : res.key.endsWith("f") ? `<div class="roll no">🎲 ${T("ui.fail")}</div>` : ""}
        <p class="ev-text">${esc(NF.fmt(rt, vars))}</p>${deltaChips(res.delta)}
        <button class="btn big primary" data-x="next">${T("ui.next")}</button></div>`;
      paintCanvases(card);
      card.onclick = (x) => { if (x.target.closest("[data-x]")) { closeSheet(); afterSheet(); } };
      save();
    };
  }
  function afterSheet() {
    if (!S) return;
    if (S.pending) { showEvent(S.pending); return; }
    if (UI.pendingSummary) { const s = UI.pendingSummary; UI.pendingSummary = null; showSummary(s); return; }
    if (UI.screen === "shift") { renderPanel(); renderActions(); }
  }

  // ───────── конец смены ─────────
  function showSummary(sum) {
    if (UI.sheet) { UI.pendingSummary = sum; return; }
    const calls = NF.L("calls") || [""];
    const call = calls[sum.call % calls.length];
    const row = (k, v, cls = "") => `<div class="kv ${cls}"><span>${k}</span><b>${v}</b></div>`;
    sfx("level");
    sheet(`<div class="summary">
      <canvas class="pc wide" width="256" height="128" data-d="${sum.district}" data-w="${sum.weather}" data-m="470"></canvas>
      <h2>🌅 ${T(sum.early ? (sum.reason === "tired" ? "ui.tiredEnd" : "ui.earlyEnd") : "ui.dawn")}</h2>
      <p class="muted">${T("ui.night")} ${sum.night}${sum.daily ? " · 🌃 " + T("ui.dailyNight") : ""}</p>
      ${row(T("ui.fares"), NF.money(sum.earned))}${row(T("ui.tips"), NF.money(sum.tips))}
      ${sum.extra ? row(T("ui.other"), (sum.extra > 0 ? "+" : "−") + NF.money(Math.abs(sum.extra)), sum.extra > 0 ? "pos" : "neg") : ""}
      ${sum.fuelCost ? row(T("ui.fuelCost"), "−" + NF.money(sum.fuelCost), "neg") : ""}
      ${sum.fleet ? row(T("ui.fleetIncome"), "+" + NF.money(sum.fleet), "pos") : ""}
      ${row(T("ui.net"), (sum.net >= 0 ? "+" : "−") + NF.money(Math.abs(sum.net)), "total")}
      ${row(T("ui.rides"), sum.rides)}${row(T("ui.km"), NF.num(sum.km, 1))}
      ${row(T("ui.avgStars"), "★ " + NF.num(sum.avg, 2))}
      ${row(T("ui.rating"), NF.num(sum.rating, 2) + ` <small class="${sum.ratingDelta >= 0 ? "pos" : "neg"}">${sum.ratingDelta >= 0 ? "▲" : "▼"}${NF.num(Math.abs(sum.ratingDelta), 2)}</small>`)}
      ${row("XP", "+" + NF.num(sum.xp) + (sum.levels ? ` · ⬆${sum.levels}` : ""))}
      ${call ? `<div class="call"><b>📞 ${T("ui.callHome")}</b><p>${esc(call)}</p></div>` : ""}
      ${NF.platform.hasAds() ? (sum.tips > 0 ? `<button class="btn" data-x="reward">📺 ${T("ui.adDouble", { m: NF.money(sum.tips) })}</button>` : "") + `<button class="btn primary" data-x="hub">${T("ui.toGarage")}</button>`
        : `<div class="row2"><button class="btn" data-x="share">📤 ${T("ui.share")}</button><button class="btn primary" data-x="hub">${T("ui.toGarage")}</button></div>`}
    </div>`, { kind: "summary", dismiss: false }).onclick = (e) => {
      const x = e.target.closest("[data-x]");
      if (!x) return;
      if (x.dataset.x === "share") shareCard(sum);
      else if (x.dataset.x === "reward") {
        x.disabled = true;
        NF.platform.rewarded(() => { S.money += sum.tips; S.stats.earned += sum.tips; save(true); toast(`📺 +${NF.money(sum.tips)}`, "gold"); sfx("coin"); }, () => x.remove());
      } else { closeSheet(); UI.tab = "shift"; save(true); show("hub"); }
    };
  }

  // карточка смены картинкой — поделиться с друзьями
  function shareCard(sum) {
    const c = document.createElement("canvas");
    c.width = 720; c.height = 960;
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 0, 960);
    g.addColorStop(0, "#141a33"); g.addColorStop(1, "#0b0d16");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 720, 960);
    const sc = document.createElement("canvas");
    sc.width = 256; sc.height = 160;
    NF.drawScene(sc.getContext("2d"), { district: sum.district, min: 470, weather: sum.weather, moving: 0, interior: true, reduce: true, cat: S.flags.cat, meter: sum.earned + sum.tips }, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sc, 24, 24, 672, 420);
    ctx.fillStyle = "#f2c66d"; ctx.font = "bold 52px system-ui, sans-serif"; ctx.textAlign = "center";
    ctx.fillText(NF.t("meta.title"), 360, 520);
    ctx.fillStyle = "#cfd6f5"; ctx.font = "28px system-ui, sans-serif";
    ctx.fillText(`${NF.t("ui.night")} ${sum.night} · ${NF.dname(sum.district)}`, 360, 566);
    const lines = [[NF.t("ui.earned"), NF.money(sum.earned + sum.tips)], [NF.t("ui.rides"), String(sum.rides)], [NF.t("ui.km"), NF.num(sum.km, 1)], [NF.t("ui.avgStars"), "★ " + NF.num(sum.avg, 2)], [NF.t("ui.level"), String(S.level)]];
    ctx.font = "30px system-ui, sans-serif";
    lines.forEach(([k, v], i) => {
      const y = 640 + i * 52;
      ctx.textAlign = "left"; ctx.fillStyle = "#8b93b8"; ctx.fillText(k, 120, y);
      ctx.textAlign = "right"; ctx.fillStyle = "#ffffff"; ctx.fillText(v, 600, y);
    });
    ctx.textAlign = "center"; ctx.fillStyle = "#5f6790"; ctx.font = "22px system-ui, sans-serif";
    ctx.fillText(NF.t("meta.sub"), 360, 930);
    c.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], "night-fare.png", { type: "image/png" });
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: NF.t("meta.title") }); return; }
      } catch (e) { if (e && e.name === "AbortError") return; }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "night-fare-" + sum.night + ".png";
      document.body.appendChild(a); a.click(); a.remove();
      toast("📤 " + NF.t("ui.saved"));
    }, "image/png");
  }

  // ───────── пауза, настройки, язык, об игре ─────────
  function openPause() {
    sheet(`<h2>⏸ ${T("ui.pause")}</h2>
      <button class="btn big primary" data-x="go">▶ ${T("ui.resume")}</button>
      <button class="btn" data-x="settings">⚙ ${T("ui.settings")}</button>
      <button class="btn" data-x="menu">☰ ${T("ui.toMenu")}</button>
      <p class="muted small center">${T("ui.pauseHint")}</p>`, { kind: "pause" }).onclick = (e) => {
      const x = e.target.closest("[data-x]");
      if (!x) return;
      closeSheet();
      if (x.dataset.x === "settings") openSettings();
      if (x.dataset.x === "menu") { save(); show("menu"); }
    };
  }
  function openSettings() {
    const sl = (k) => `<input type="range" min="0" max="1" step="0.05" value="${SET[k]}" data-set="${k}">`;
    const tg = (k) => `<button class="switch ${SET[k] ? "on" : ""}" data-tg="${k}"><i></i></button>`;
    const c = sheet(`<h2>⚙ ${T("ui.settings")}</h2>
      <div class="set"><span>🌐 ${T("ui.language")}</span><button class="btn sm" data-x="lang">${esc(NF.L("meta.name"))}</button></div>
      <div class="set"><span>🎵 ${T("ui.vMusic")}</span>${sl("music")}</div>
      <div class="set"><span>🌧 ${T("ui.vRain")}</span>${sl("rain")}</div>
      <div class="set"><span>🔔 ${T("ui.vSfx")}</span>${sl("sfx")}</div>
      <div class="set"><span>🔠 ${T("ui.textSize")}</span><div class="seg">${["s", "m", "l"].map((x) => `<button class="${SET.text === x ? "on" : ""}" data-text="${x}">${x === "s" ? "A" : x === "m" ? "A+" : "A++"}</button>`).join("")}</div></div>
      <div class="set"><span>🎲 ${T("ui.showChances")}</span>${tg("chances")}</div>
      <div class="set"><span>🍃 ${T("ui.zen")}<small>${T("ui.zenHint")}</small></span>${tg("zen")}</div>
      <div class="set"><span>📳 ${T("ui.vibration")}</span>${tg("vib")}</div>
      <div class="set"><span>🌫 ${T("ui.reduce")}</span>${tg("reduce")}</div>
      <h3>💾 ${T("ui.saveData")}</h3>
      <div class="row2"><button class="btn sm" data-x="export">${T("ui.export")}</button><button class="btn sm" data-x="import">${T("ui.import")}</button></div>
      <button class="btn sm danger" data-x="reset">${T("ui.reset")}</button>
      <button class="btn primary" data-x="close">${T("ui.done")}</button>`, { kind: "settings" });
    c.oninput = (e) => {
      const k = e.target.dataset.set;
      if (!k) return;
      SET[k] = +e.target.value; saveSet();
      NF.audio.vol[k] = SET[k]; NF.audio.apply();
    };
    c.onclick = (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      sfx("click");
      if (b.dataset.tg) { const k = b.dataset.tg; SET[k] = !SET[k]; saveSet(); b.classList.toggle("on", SET[k]); if (k === "zen") NF.cfg.zen = SET.zen; return; }
      if (b.dataset.text) { SET.text = b.dataset.text; saveSet(); applyText(); $$("[data-text]", c).forEach((x) => x.classList.toggle("on", x === b)); return; }
      const x = b.dataset.x;
      if (x === "close") closeSheet();
      if (x === "lang") { closeSheet(); openLang(true); }
      if (x === "export") {
        if (!S) return;
        const code = NF.exportCode(S);
        sheet(`<h2>${T("ui.export")}</h2><p class="muted">${T("ui.exportHint")}</p><textarea class="code" readonly>${esc(code)}</textarea><button class="btn primary" data-x="copy">${T("ui.copy")}</button>`).onclick = (ev) => {
          if (!ev.target.closest("[data-x]")) return;
          const ta = $("textarea.code"); ta.select();
          (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(() => toast("✓ " + NF.t("ui.copied")), () => { document.execCommand("copy"); toast("✓ " + NF.t("ui.copied")); });
        };
      }
      if (x === "import") {
        sheet(`<h2>${T("ui.import")}</h2><p class="muted">${T("ui.importHint")}</p><textarea class="code" placeholder="NF1:..."></textarea><button class="btn primary" data-x="load">${T("ui.import")}</button>`).onclick = (ev) => {
          if (!ev.target.closest("[data-x]")) return;
          const st = NF.importCode($("textarea.code").value);
          if (!st) { toast("✕ " + NF.t("ui.importBad"), "bad"); return; }
          S = st; S.shift = null; S.ride = null; S.pending = null; save(); closeSheet(); toast("✓ " + NF.t("ui.importOk")); show("hub");
        };
      }
      if (x === "reset") {
        sheet(`<h2>${T("ui.reset")}</h2><p>${T("ui.resetConfirm")}</p><div class="row2"><button class="btn" data-x="no">${T("ui.cancel")}</button><button class="btn danger" data-x="yes">${T("ui.reset")}</button></div>`).onclick = (ev) => {
          const y = ev.target.closest("[data-x]");
          if (!y) return;
          closeSheet();
          if (y.dataset.x === "yes") { NF.wipe(); S = null; show("menu"); }
        };
      }
    };
  }
  function openLang(back) {
    sheet(`<h2>🌐 Language · Язык · 语言</h2><div class="langs">${NF.LANG_ORDER.filter((l) => LANGS[l]).map((l) => `<button class="btn ${NF.lang === l ? "primary" : ""}" data-l="${l}">${esc(LANGS[l].meta.name)}</button>`).join("")}</div>`, { kind: "lang", dismiss: !!SET.lang }).onclick = (e) => {
      const b = e.target.closest("[data-l]");
      if (!b) return;
      setLang(b.dataset.l);
      closeSheet();
      if (back) openSettings();
    };
  }
  function openAbout() {
    const f = NF.L("feats") || [];
    sheet(`<h2>✦ ${T("ui.about")}</h2><p>${T("ui.aboutText")}</p><ol class="feats">${f.map(([t, d]) => `<li><b>${esc(t)}</b> — ${esc(d)}</li>`).join("")}</ol><p class="muted small">v${VERSION}</p><button class="btn primary" data-x="ok">${T("ui.done")}</button>`).onclick = (e) => { if (e.target.closest("[data-x]")) closeSheet(); };
  }

  // ───────── реакции на ядро ─────────
  NF.on((type, d) => {
    if (!S) return;
    const inShift = UI.screen === "shift";
    switch (type) {
      case "event": if (inShift) showEvent(d); break;
      case "order": if (inShift && !S.ride && !S.shift.busy) { sfx("order"); renderPanel(); } break;
      case "ordersChanged": if (inShift && !S.ride && !S.shift.busy) renderPanel(); break;
      case "accept": case "pickup": case "busy": if (inShift) { renderPanel(); renderActions(); } break;
      case "busyEnd": if (inShift) { renderPanel(); renderActions(); if (d.kind === "move") toast("📍 " + NF.dname(S.district)); } break;
      case "rideEnd":
        if (inShift) {
          sfx("coin"); vib(20);
          toast(`<span class="stars">${stars(d.stars)}</span> <b>+${NF.money(d.pay)}</b>${d.tip ? ` <span class="pos">+${NF.money(d.tip)} ${T("ui.tipShort")}</span>` : ""} <small>+${d.xp} XP</small><br><small class="${d.hit ? "pos" : "muted"}">${d.hit ? "✓ " + T("ui.toneHit") : T("ui.toneMiss") + " " + TONE_ICON[d.pref] + " " + T("tone." + d.pref)}</small>`, d.stars >= 5 ? "gold" : d.stars <= 2 ? "bad" : "");
          renderPanel(); renderActions();
        }
        break;
      case "levelUp": sfx("level"); toast(`⬆ ${T("ui.levelUp", { n: d })} · +1 ${T("ui.spShort")}`, "gold"); break;
      case "ach": { const a = NF.L("ach." + d) || [d]; toast(`🏆 ${esc(a[0])}`, "gold"); break; }
      case "daily": toast(`📋 ${T("ui.taskDone")} +${NF.money(d.m)}`, "gold"); break;
      case "tow": toast(`🚛 ${T("ui.towed", { m: NF.money(d) })}`, "bad"); break;
      case "arcDone": toast(`📖 ${T("ui.arcDone", { n: NF.t("arcs." + d + ".n") })}`, "gold"); break;
      case "weather": NF.audio.setWeather(d); amb(WICON[d] + " " + NF.t("weather." + d)); break;
      case "shiftEnd": UI.mov = 0; NF.platform.cloudSave(S, true); if (inShift) showSummary(d); break;
    }
  });

  // ───────── главный цикл ─────────
  const sceneCv = () => (UI.screen === "menu" ? $("#menu-cv") : UI.screen === "shift" ? $("#shift-cv") : null);
  let dynAcc = 0, saveAcc = 0, menuT = 0;
  function frame(ts) {
    const dt = Math.min(0.1, (ts - (UI.last || ts)) / 1000);
    UI.last = ts;
    if (UI.screen === "shift" && S && S.shift && !UI.sheet && !S.pending) {
      NF.update(S, dt * UI.speed);
      if (S.shift) ambientTick();
    }
    const cv = sceneCv();
    if (cv) {
      const ctx = cv.getContext("2d");
      if (UI.screen === "menu") {
        menuT += dt;
        NF.drawScene(ctx, { district: S ? S.district : "neon", min: 40 + ((menuT * 3) % 400), weather: "rain", moving: SET.reduce ? 0 : 0.6, interior: true, radioOn: true, season: NF.seasonOf().season, cat: S && S.flags.cat, reduce: SET.reduce }, dt);
      } else if (S && S.shift) {
        const r = S.ride, sh = S.shift;
        const target = r ? (r.phase === "ride" ? 1 : 0.7) : sh.busy && sh.busy.kind === "move" ? 1 : 0;
        UI.mov += (target - UI.mov) * Math.min(1, dt * 1.5);
        const meter = r ? Math.round(r.phase === "ride" ? r.fare * r.fareMul * (1 - r.t / Math.max(1, r.total)) : 0) : null;
        NF.drawScene(ctx, {
          district: S.district, min: S.minute, weather: sh.weather, moving: UI.mov,
          ride: r && r.phase === "ride" ? { arch: r.arch, seed: r.arc ? archSeed("arc" + r.arc.id) : r.seed, g: r.g, sleep: S.pending && S.pending.id === "drunk_sleep" } : null,
          cat: S.flags.cat, season: S.season, meter, radioOn: SET.radio, reduce: SET.reduce,
        }, dt);
      }
    }
    NF.platform.setActive(UI.screen === "shift" && !!(S && S.shift) && !UI.sheet && !document.hidden && !NF.platform.adOpen);
    dynAcc += dt; saveAcc += dt;
    if (dynAcc > 0.25) { dynAcc = 0; refreshDyn(); }
    if (saveAcc > 15) { saveAcc = 0; if (UI.screen === "shift") save(); }
    requestAnimationFrame(frame);
  }

  // ───────── запуск ─────────
  function boot() {
    applyText();
    NF.lang = SET.lang && LANGS[SET.lang] ? SET.lang : NF.detectLang();
    document.documentElement.lang = NF.lang;
    document.title = NF.t("meta.title") + " · Night Fare";
    S = NF.load();
    if (S && S.shift && S.pending) S.pending = S.pending; // событие покажется при входе в смену
    NF.audio.vol = { music: SET.music, rain: SET.rain, sfx: SET.sfx };
    NF.audio.station = SET.station; NF.audio.radio = SET.radio;
    NF.cfg.zen = SET.zen;
    UI.speed = SET.speed || 1;
    const unlockAudio = () => { NF.audio.init(); NF.audio.setStation(SET.station); NF.audio.setRadio(SET.radio); if (UI.screen !== "shift") NF.audio.setWeather("rain"); };
    window.addEventListener("pointerdown", unlockAudio, { once: true });
    document.addEventListener("contextmenu", (e) => e.preventDefault());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { save(); NF.audio.suspend(); if (UI.screen === "shift" && !UI.sheet) openPause(); }
      else if (!NF.platform.adOpen) NF.audio.resume();
    });
    const _show = show;
    show = function (scr) {
      _show(scr);
      if (scr === "shift" && S && S.pending && !UI.sheet) showEvent(S.pending);
      if (scr !== "shift" && NF.audio.ctx) NF.audio.setWeather("rain");
      if (scr === "shift" && S && S.shift) NF.audio.setWeather(S.shift.weather);
    };
    show("menu");
    NF.platform.init().then(async (ok) => {
      if (ok) {
        if (!SET.lang) { setLang(NF.platform.lang); }
        const cloud = await NF.platform.cloudLoad();
        if (cloud && typeof cloud.money === "number" && (!S || (cloud.nights || 0) > (S.nights || 0))) {
          const st = NF.importCode(NF.exportCode(cloud));
          if (st) { S = st; NF.save(S); rerender(); }
        }
      } else if (!SET.lang) openLang(false);
      NF.platform.ready();
    });
    requestAnimationFrame(frame);
    if (!NF.platform.isYandex() && !NF.platform.isVK() && "serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  NF.debug = { get S() { return S; }, set S(v) { S = v; }, UI, show: (s) => show(s), SET };
  window.addEventListener("DOMContentLoaded", boot);
})();
