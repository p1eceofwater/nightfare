/* Ночной тариф — ядро: состояние, смена, заказы, поездки, события, экономика, прогресс, сохранения.
   Здесь нет работы с экраном — только правила игры. */
(function () {
  "use strict";
  const NF = (window.NF = window.NF || {});
  const SHIFT_LEN = (NF.SHIFT_LEN = 480); // 22:00 → 06:00
  const LEVEL_CAP = (NF.LEVEL_CAP = 200);
  const SAVE_KEY = "nightfare_save_v1";
  const clamp = (NF.clamp = (v, a, b) => Math.max(a, Math.min(b, v)));
  NF.cfg = NF.cfg || { zen: false };

  // ───────── шина событий для интерфейса ─────────
  NF.listeners = [];
  NF.on = (fn) => NF.listeners.push(fn);
  const emit = (NF.emit = (type, data) => {
    for (const f of NF.listeners) {
      try { f(type, data); } catch (e) { console.error(e); }
    }
  });

  // ───────── случайность (своя, чтобы «Ночь дня» была одинаковой у всех) ─────────
  function rnd(s) {
    const sh = s && s.shift;
    if (!sh) return Math.random();
    let a = (sh.rs = (sh.rs + 0x6d2b79f5) | 0);
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const ri = (s, a, b) => a + Math.floor(rnd(s) * (b - a + 1));
  const pick = (s, arr) => arr[Math.floor(rnd(s) * arr.length)];
  function wpick(s, arr, wf) {
    let tot = 0;
    const ws = arr.map((x) => { const w = Math.max(0, wf(x) || 0); tot += w; return w; });
    if (tot <= 0) return null;
    let r = rnd(s) * tot;
    for (let i = 0; i < arr.length; i++) { r -= ws[i]; if (r <= 0) return arr[i]; }
    return arr[arr.length - 1];
  }
  function hashStr(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h | 0;
  }
  NF.rnd = rnd; NF.hashStr = hashStr;

  // ───────── дата, сезон ─────────
  const today = (NF.today = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  NF.seasonOf = function (d = new Date()) {
    const m = d.getMonth() + 1, day = d.getDate();
    const winter = m === 12 || m <= 2;
    let season = winter ? "winter" : m <= 5 ? "spring" : m <= 8 ? "summer" : "autumn";
    if ((m === 12 && day >= 24) || (m === 1 && day <= 7)) season = "newyear";
    if ((m === 10 && day >= 24) || (m === 11 && day <= 2)) season = "halloween";
    return { season, winter };
  };

  // ───────── время смены ─────────
  NF.hourOf = (min) => (22 + Math.floor(min / 60)) % 24;
  NF.clock = (min) => `${String(NF.hourOf(min)).padStart(2, "0")}:${String(Math.floor(min) % 60).padStart(2, "0")}`;

  // ───────── новое состояние ─────────
  NF.newState = function (lang) {
    return {
      v: 1, lang: lang || "en", created: Date.now(), nights: 0,
      money: 60, rating: 4.2, karma: 0, xp: 0, level: 1, sp: 0,
      skills: { charm: 0, eye: 0, econ: 0, stamina: 0, city: 0 },
      ups: {}, cars: ["komet"], car: "komet", carIdx: 0,
      districts: ["sleepy"], district: "sleepy",
      fuel: 100, energy: 100, cond: 100,
      flags: {}, arcs: {}, arcNext: {}, later: [],
      album: {}, postcards: {}, items: {}, lost: [], journal: [], recent: [],
      stats: { rides: 0, km: 0, earned: 0, tips: 0, five: 0, returned: 0, stormRides: 0, dawns: 0, zenNights: 0, events: 0, bestShift: 0, tow: 0 },
      ach: {}, fleet: { cars: 0, garage: 0, earned: 0 }, legend: 0, dayBest: {}, daily: null,
      shift: null, ride: null, pending: null, lastSummary: null,
      hour: 22, minute: 0, season: "autumn", winter: false, boostUntil: 0, streak: null, adFree: null, storyDay: "",
    };
  };
  function migrate(o) {
    const base = NF.newState(o.lang);
    for (const k in base) if (o[k] === undefined) o[k] = base[k];
    for (const k of ["skills", "stats", "fleet"]) for (const kk in base[k]) if (o[k][kk] === undefined) o[k][kk] = base[k][kk];
    o.carIdx = Math.max(0, NF.CARS.findIndex((c) => c.id === o.car));
    return o;
  }

  // ───────── сохранение ─────────
  NF.save = function (s) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); return true; } catch (e) { return false; }
  };
  NF.load = function () {
    try { const t = localStorage.getItem(SAVE_KEY); return t ? migrate(JSON.parse(t)) : null; } catch (e) { return null; }
  };
  NF.wipe = () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} };
  NF.exportCode = (s) => "NF1:" + btoa(unescape(encodeURIComponent(JSON.stringify(s))));
  NF.importCode = function (code) {
    code = String(code || "").trim();
    if (!code.startsWith("NF1:")) return null;
    try {
      const o = JSON.parse(decodeURIComponent(escape(atob(code.slice(4)))));
      if (!o || typeof o.money !== "number" || !Array.isArray(o.districts)) return null;
      return migrate(o);
    } catch (e) { return null; }
  };

  // ───────── производные величины ─────────
  const up = (s, id) => s.ups[id] || 0;
  const car = (s) => NF.CAR[s.car];
  NF.xpNeed = (L) => Math.round(120 * Math.pow(1.12, L - 1));
  const moneyScale = (s) => 1 + (s.level - 1) * 0.04 + (NF.D[s.district].mult - 1) * 0.5;
  NF.moneyScale = moneyScale;
  const legendMul = (s) => 1 + s.legend * 0.1;
  function surge(s) {
    let m = 1;
    if (s.hour >= 2 && s.hour < 5) m *= 1.15;
    const w = s.shift ? s.shift.weather : "clear";
    m *= { clear: 1, rain: 1.1, storm: 1.25, snow: 1.2, fog: 1.05 }[w] || 1;
    return m;
  }
  NF.surge = surge;
  // машина классом выше — тариф выше (эконом → комфорт → бизнес → премиум)
  const fareFor = (s, km, d) => Math.max(4, Math.round((4 + km * 1.8) * d.mult * surge(s) * legendMul(s) * (1 + s.carIdx * 0.15)));
  const fuelPerKm = (s) => car(s).eff * 0.5 * (1 - up(s, "eco") * 0.05) * (1 - s.skills.econ * 0.04);
  NF.refuelCost = (s) => Math.ceil((100 - s.fuel) * 0.5 * (1 - s.skills.econ * 0.03));
  NF.repairCost = (s) => Math.ceil((100 - s.cond) * 1.5 * (1 + s.carIdx * 0.5) * (1 - s.skills.econ * 0.04));
  NF.coffeeCost = (s) => Math.round(4 * moneyScale(s));
  NF.upPrice = (s, u) => Math.round(NF.upCost(u, up(s, u.id)) * (1 - s.skills.econ * 0.02));
  NF.skillCost = (s, id) => s.skills[id] + 1;
  NF.fleetOpen = (s) => s.level >= 20 && s.districts.includes("business");
  NF.fleetCap = (s) => 5 + s.fleet.garage * 5;
  NF.fleetCarCost = (s) => Math.round(30000 * Math.pow(1.25, s.fleet.cars));
  NF.garageCost = (s) => Math.round(50000 * Math.pow(2, s.fleet.garage));
  NF.fleetIncome = (s) => Math.round(s.fleet.cars * 140 * legendMul(s));
  NF.legendNeed = (s) => ({ level: 60 + 20 * s.legend, money: Math.round(1e6 * Math.pow(3, s.legend)) });
  NF.canLegend = (s) => { const n = NF.legendNeed(s); return s.level >= n.level && s.money >= n.money && s.districts.length >= NF.DISTRICTS.length; };
  NF.stations = (s) => ["lofi"].concat(up(s, "music") >= 2 ? ["jazz"] : [], up(s, "music") >= 4 ? ["rain"] : []);

  // ───────── журнал ─────────
  function journal(s, entry) {
    entry.n = s.nights + (s.shift ? 1 : 0);
    s.journal.push(entry);
    if (s.journal.length > 500) s.journal.splice(0, s.journal.length - 500);
  }

  // ───────── опыт ─────────
  function addXP(s, n) {
    n = Math.round(n);
    if (s.level >= LEVEL_CAP) return;
    s.xp += n;
    if (s.shift) s.shift.xp += n;
    while (s.level < LEVEL_CAP && s.xp >= NF.xpNeed(s.level)) {
      s.xp -= NF.xpNeed(s.level);
      s.level++; s.sp++;
      if (s.shift) s.shift.levels++;
      journal(s, { k: "level", v: s.level });
      emit("levelUp", s.level);
    }
    if (s.level >= LEVEL_CAP) s.xp = 0;
  }
  NF.addXP = addXP;

  // ───────── ежедневные задания ─────────
  const DAILY_TYPES = ["rides", "earn", "five", "km", "events", "tone"];
  NF.ensureDaily = function (s) {
    const key = today();
    if (s.daily && s.daily.date === key) return s.daily;
    let h = hashStr("daily" + key);
    const r = () => { h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9) | 0; return ((h >>> 0) % 10000) / 10000; };
    const types = DAILY_TYPES.slice().sort(() => r() - 0.5).slice(0, 3);
    const best = Math.max(150, s.stats.bestShift);
    const goals = {
      rides: 6 + Math.floor(r() * 7), earn: Math.round((best * (0.5 + r() * 0.3)) / 10) * 10, five: 3 + Math.floor(r() * 4),
      km: 40 + Math.floor(r() * 5) * 10, events: 3 + Math.floor(r() * 3), tone: 4 + Math.floor(r() * 5),
    };
    s.daily = { date: key, tasks: types.map((t) => ({ t, goal: goals[t], prog: 0, done: false })) };
    return s.daily;
  };
  function daily(s, t, n) {
    const d = NF.ensureDaily(s);
    for (const task of d.tasks) {
      if (task.t !== t || task.done) continue;
      task.prog = Math.min(task.goal, task.prog + n);
      if (task.prog >= task.goal) {
        task.done = true;
        const m = Math.round(60 * moneyScale(s) * legendMul(s));
        s.money += m; s.stats.earned += m;
        addXP(s, NF.xpNeed(s.level) * 0.12);
        emit("daily", { task, m });
      }
    }
  }

  // ───────── достижения ─────────
  function checkAch(s) {
    for (const [id, fn] of NF.ACH) {
      if (s.ach[id]) continue;
      let ok = false;
      try { ok = fn(s); } catch (e) {}
      if (ok) { s.ach[id] = Date.now(); emit("ach", id); }
    }
  }
  NF.checkAch = checkAch;

  // ───────── погода ─────────
  function rollWeather(s) {
    const W = s.winter ? { clear: 3, snow: 3, fog: 1.5, storm: 0.3, rain: 0.5 } : { clear: 4, rain: 3, storm: 1, fog: 1.5 };
    const keys = Object.keys(W);
    return wpick(s, keys, (k) => W[k]);
  }

  // ───────── начало смены ─────────
  NF.canDaily = (s) => !s.dayBest[today()];
  NF.startShift = function (s, opt = {}) {
    if (s.shift) return s.shift;
    const sz = NF.seasonOf();
    s.season = sz.season; s.winter = sz.winter;
    const date = today();
    const isDaily = !!opt.daily && NF.canDaily(s);
    s.shift = {
      n: s.nights + 1, date, daily: isDaily, zen: !!NF.cfg.zen,
      rs: isDaily ? hashStr("nightfare-" + date) : (Math.random() * 2 ** 31) | 0,
      weather: "clear", wChange: null, min: 0, acc: 0, oid: 0, orders: [],
      earned: 0, tips: 0, extra: 0, fuelCost: 0, rides: 0, km: 0, starSum: 0, five: 0, xp: 0, levels: 0,
      events: 0, toneHits: 0, arcDone: {}, busy: null, idleEv: 0, lastEv: -99, fleet: 0, startMoney: s.money, startRating: s.rating,
    };
    const sh = s.shift;
    sh.weather = rollWeather(s);
    if (rnd(s) < 0.35) {
      let to = rollWeather(s);
      if (to !== sh.weather) sh.wChange = { at: ri(s, 100, 360), to };
    }
    s.energy = 100; s.minute = 0; s.hour = 22; s.ride = null; s.pending = null;
    s.carIdx = Math.max(0, NF.CARS.findIndex((c) => c.id === s.car));
    NF.ensureDaily(s);
    spawnOrder(s); spawnOrder(s);
    emit("shiftStart", sh);
    return sh;
  };

  // ───────── заказы ─────────
  function hourWeight(s, a) {
    const h = s.hour;
    if (a.id === "party") return h >= 0 && h < 5 ? 1.6 : 0.8;
    if (a.id === "nurse" || a.id === "doctor" || a.id === "worker") return h >= 5 || h < 1 ? 1.4 : 0.8;
    if (a.id === "granny" || a.id === "mom") return h >= 22 || h < 1 ? 1.2 : 0.5;
    if (a.id === "pilot") return s.district === "airport" ? 2 : 0.3;
    return 1;
  }
  function pickMood(s, arch) {
    const base = { calm: 4, hurry: 1.5, tipsy: 0.3, silent: 1.5, chatty: 1.5, sad: 0.8, happy: 1 };
    if (arch === "party") { base.tipsy = 6; base.happy = 2; }
    if (arch === "office" || arch === "pilot" || arch === "boss") base.hurry = 3;
    if (arch === "granny" || arch === "tourist" || arch === "sailor") base.chatty = 4;
    if (arch === "nurse" || arch === "guard" || arch === "doctor") base.silent = 4;
    if (arch === "bride" || arch === "couple") base.happy = 3;
    return wpick(s, NF.MOODS, (m) => base[m]);
  }
  function arcEligible(s, a) {
    const step = s.arcs[a.id] || 0;
    if (step >= a.eps || s.shift.arcDone[a.id]) return false;
    if (s.nights < (s.arcNext[a.id] || 0)) return false;
    if (s.level < (a.minLevel || 2)) return false;
    if (a.id === "red" && step === 3 && !s.districts.includes("harbor")) return false;
    if (a.id === "coal") return !!s.flags.coal_met;
    if (a.idle) return true;
    return a.where.includes(s.district);
  }
  function spawnOrder(s, arcId) {
    const sh = s.shift, d = NF.D[s.district];
    let arch;
    if (arcId) arch = NF.ARC[arcId].arch;
    else {
      const pool = NF.ARCH.filter((a) => (a.id !== "star" || s.level >= 5) && (a.id !== "bride" || s.level >= 3));
      arch = wpick(s, pool, (a) => (a.where.includes(s.district) ? 3 : 0.6) * (a.rich >= 3 ? (d.mult >= 1.25 ? 1 : 0.12) : 1) * hourWeight(s, a)).id;
    }
    let to = rnd(s) < 0.6 ? s.district : pick(s, s.districts);
    if (arch === "pilot" && s.districts.includes("airport")) to = "airport";
    const same = to === s.district;
    const km = Math.round((same ? 1.5 + rnd(s) * 6 : 4 + rnd(s) * 10) * 10) / 10;
    const o = {
      id: ++sh.oid, arch, g: arcId ? NF.ARC_G[arcId] : rnd(s) < (NF.A[arch] ? NF.A[arch].g : 0.5) ? "f" : "m", nameIdx: ri(s, 0, 9999), fromIdx: ri(s, 0, 99), toIdx: ri(s, 0, 99), from: s.district, to, km,
      fare: fareFor(s, km, d), mood: arcId ? "calm" : pickMood(s, arch), seed: ri(s, 1, 1e9),
      exp: sh.zen ? 1e9 : sh.min + (arcId ? 30 : ri(s, 6, 14)), arc: arcId ? { id: arcId, n: (s.arcs[arcId] || 0) + 1 } : null,
    };
    if (o.arc) o.fare = Math.round(o.fare * 1.3);
    sh.orders.push(o);
    emit("order", o);
    return o;
  }
  NF.spawnOrder = spawnOrder;

  // ───────── принять заказ ─────────
  NF.accept = function (s, oid) {
    const sh = s.shift;
    if (!sh || s.ride || s.pending || sh.busy) return false;
    const i = sh.orders.findIndex((o) => o.id === oid);
    if (i < 0) return false;
    const o = sh.orders.splice(i, 1)[0];
    const pick = Math.max(1, Math.round(ri(s, 2, 6) * (1 - up(s, "nav") * 0.04) * (1 - s.skills.city * 0.02)));
    const r = Object.assign({}, o, {
      phase: "pickup", t: pick, total: pick, pickupMin: pick, tone: null,
      evAt: o.arc ? 0.5 : rnd(s) < 0.4 ? 0.3 + rnd(s) * 0.4 : null, evDone: false,
      roadAt: rnd(s) < 0.1 ? 0.15 + rnd(s) * 0.7 : null, roadDone: false,
      rmod: 0, tip: 0, mf: 0, fareMul: 1, kmDone: 0,
    });
    s.ride = r;
    emit("accept", r);
    return true;
  };
  NF.decline = function (s, oid) {
    const sh = s.shift;
    if (!sh) return;
    sh.orders = sh.orders.filter((o) => o.id !== oid);
  };
  NF.setTone = function (s, tone) {
    if (s.ride && ["talk", "music", "quiet"].includes(tone)) s.ride.tone = tone;
  };
  function rideMinutes(s, km) {
    const w = s.shift.weather;
    const wf = w === "storm" || w === "snow" ? 1.15 : w === "fog" ? 1.1 : 1;
    return Math.max(3, Math.round((km / car(s).speed) * wf * (1 - s.skills.city * 0.03) * (1 - up(s, "nav") * 0.02)));
  }

  // ───────── оценка поездки ─────────
  NF.prefTone = (r) => (r.mood === "chatty" ? "talk" : r.mood === "silent" ? "quiet" : r.mood === "tipsy" ? "music" : (NF.A[r.arch] || {}).like || "quiet");
  function rideStars(s, r) {
    const w = s.shift.weather, bad = w !== "clear";
    let q = 4.15 + car(s).comfort * 0.6 + up(s, "seats") * 0.03 + up(s, "clean") * 0.025 + up(s, "climate") * (bad ? 0.05 : 0.02) +
      up(s, "charger") * 0.01 + s.skills.charm * 0.03 + s.legend * 0.02;
    const tone = r.tone || "quiet";
    const hit = tone === NF.prefTone(r);
    q += hit ? 0.45 : -0.4;
    if (tone === "music") q += up(s, "music") * 0.03;
    if (r.mood === "hurry" && r.pickupMin > 4) q -= 0.5;
    if (s.energy < 25) q -= 0.5;
    if (s.cond < 40) q -= 0.4;
    if (s.cond < 20) q -= 0.4;
    q += r.rmod * 0.5;
    q += (rnd(s) - 0.5) * 0.8;
    return { stars: clamp(Math.round(q), 1, 5), hit };
  }

  // ×2 чаевых по времени (подарок от друга); boostUntil — отметка времени в мс
  NF.tipBoost = (s) => (s.boostUntil && Date.now() < s.boostUntil && !(s.shift && s.shift.daily) ? 2 : 1);
  NF.boostLeft = (s) => Math.max(0, Math.ceil(((s.boostUntil || 0) - Date.now()) / 60000));
  NF.giveBoost = (s, min) => { s.boostUntil = Math.max(Date.now(), s.boostUntil || 0) + min * 60000; };

  function finishRide(s) {
    const r = s.ride, sh = s.shift, a = NF.A[r.arch] || { tip: 0.1 };
    const { stars, hit } = rideStars(s, r);
    const fare = Math.round(r.fare * r.fareMul);
    const pay = Math.max(0, Math.round(fare + r.mf * fare));
    const tipRate = a.tip + s.skills.charm * 0.01 + up(s, "snacks") * 0.012 + (s.flags.cat ? 0.03 : 0);
    const tm = stars >= 5 ? 1.5 : stars === 4 ? 1 : stars === 3 ? 0.3 : 0;
    const tip = Math.max(0, Math.round((fare * tipRate * tm + r.tip * fare) * NF.tipBoost(s)));
    s.money += pay + tip;
    s.stats.earned += pay + tip; s.stats.tips += tip;
    sh.earned += pay; sh.tips += tip; sh.rides++; sh.km += r.km; sh.starSum += stars;
    s.rating = clamp(s.rating + (stars - s.rating) * 0.05, 1, 5);
    const xp = (6 + r.km * 0.6 + stars) * NF.D[r.from].mult * legendMul(s);
    s.album[r.arch] = (s.album[r.arch] || 0) + 1;
    s.stats.rides++; s.stats.km += r.km;
    if (stars === 5) { s.stats.five++; sh.five++; }
    if (sh.weather === "storm" || sh.weather === "snow") s.stats.stormRides++;
    if (hit) sh.toneHits++;
    addXP(s, xp);
    if (NF.D[r.to] && s.districts.includes(r.to)) s.district = r.to;
    s.ride = null;
    daily(s, "rides", 1); daily(s, "earn", pay + tip); daily(s, "km", r.km);
    if (stars === 5) daily(s, "five", 1);
    if (hit) daily(s, "tone", 1);
    emit("rideEnd", { arch: r.arch, nameIdx: r.nameIdx, seed: r.seed, stars, pay, tip, xp: Math.round(xp), hit, pref: NF.prefTone(r), arc: r.arc, mood: r.mood });
    checkAch(s);
    if (s.fuel <= 0) { tow(s); return; }
    // сразу после поездки: иногда напоминает о себе прошлое или случается сценка
    const due = s.later.findIndex((l) => l.n <= s.nights + 1);
    if (due >= 0 && rnd(s) < 0.3) triggerEvent(s, s.later.splice(due, 1)[0].id);
    else if (sh.idleEv < 7 && rnd(s) < 0.07) { sh.idleEv++; rollEvent(s, "idle"); }
  }

  function tow(s) {
    const cost = Math.round(40 * moneyScale(s));
    s.money = Math.max(0, s.money - cost);
    s.fuel = 25; s.stats.tow++;
    if (s.shift) { s.shift.busy = { kind: "tow", t: 30, total: 30 }; s.shift.towCost = (s.shift.towCost || 0) + cost; }
    emit("tow", cost);
  }

  // ───────── события ─────────
  function eventCtx(s) {
    const r = s.ride;
    return {
      arch: r ? r.arch : null, g: r ? r.g : rnd(s) < 0.5 ? "f" : "m", nameIdx: r ? r.nameIdx : ri(s, 0, 9999), seed: r ? r.seed : ri(s, 1, 1e9),
      fare: r ? Math.round(r.fare * r.fareMul) : 0, from: r ? r.from : s.district, to: r ? r.to : s.district,
      fromIdx: r ? r.fromIdx : ri(s, 0, 99), toIdx: r ? r.toIdx : ri(s, 0, 99), item: pick(s, NF.LOST_ITEMS), district: s.district,
    };
  }
  function triggerEvent(s, id) {
    const e = NF.EV[id];
    if (!e) return false;
    s.pending = { id, ctx: eventCtx(s) };
    s.recent.push(id);
    if (s.recent.length > 40) s.recent.shift();
    if (s.shift) { s.shift.lastEv = s.shift.min; s.shift.events++; }
    emit("event", s.pending);
    return true;
  }
  NF.triggerEvent = triggerEvent;
  function rollEvent(s, cat) {
    const r = s.ride;
    const pool = NF.EVENTS.filter((e) => {
      if (e.cat !== cat) return false;
      if (!e.when) return true;
      try { return !!e.when(s, r); } catch (er) { return false; }
    });
    const recent = s.recent.slice(-30);
    const e = wpick(s, pool, (x) => (typeof x.w === "function" ? x.w(s, r) : x.w) * (recent.includes(x.id) ? 0.08 : 1));
    return e ? triggerEvent(s, e.id) : false;
  }
  NF.chance = function (s, opt) {
    if (opt.p == null) return 1;
    let c = opt.p + (opt.sk ? s.skills[opt.sk] * 0.03 : 0) + (s.flags.lucky_charm ? 0.04 : 0) + (s.flags.cat ? 0.03 : 0);
    if (opt.sk === "eye" || opt.sk === "city") c += up(s, "tires") * 0.01;
    return clamp(c, 0.03, 0.95);
  };
  NF.choose = function (s, i) {
    const p = s.pending;
    if (!p) return null;
    const e = NF.EV[p.id], opt = e.o[i];
    if (!opt) return null;
    let key, fx;
    if (opt.p != null) {
      const ok = rnd(s) < NF.chance(s, opt);
      key = i + (ok ? "s" : "f"); fx = ok ? opt.ok : opt.no;
    } else { key = String(i); fx = opt.fx; }
    s.pending = null;
    s.stats.events++;
    const delta = applyFx(s, fx || {}, p);
    journal(s, { k: "ev", id: p.id, key, ctx: { arch: p.ctx.arch, g: p.ctx.g, nameIdx: p.ctx.nameIdx, item: p.ctx.item, from: p.ctx.from, to: p.ctx.to, fromIdx: p.ctx.fromIdx, toIdx: p.ctx.toIdx, fare: p.ctx.fare } });
    if (e.cat !== "later") daily(s, "events", 1);
    const res = { id: p.id, key, delta, ctx: p.ctx };
    emit("eventResult", res);
    if (delta.skip) for (let k = 0; k < delta.skip && s.shift && !s.pending; k++) stepMinute(s, true);
    checkAch(s);
    return res;
  };
  function applyFx(s, fx, p) {
    const d = {}, r = s.ride, sc = moneyScale(s);
    if (fx.m) {
      let v = fx.m * sc;
      if (v < 0) v *= 1 - up(s, "dashcam") * 0.05;
      v = Math.round(v);
      s.money = Math.max(0, s.money + v);
      if (v > 0) s.stats.earned += v;
      if (s.shift) s.shift.extra += v;
      d.m = v;
    }
    if (fx.mf && r) { r.mf += fx.mf; d.m = (d.m || 0) + Math.round(fx.mf * r.fare * r.fareMul); }
    if (fx.tip && r) { r.tip += fx.tip; d.tip = Math.round(fx.tip * r.fare * r.fareMul); }
    if (fx.fare && r) { r.fareMul *= fx.fare; d.fare = fx.fare; }
    if (fx.r && r) { r.rmod += fx.r; d.r = fx.r; }
    if (fx.time) {
      if (r) { r.t = Math.max(1, r.t + fx.time); r.total = Math.max(r.total, r.t); }
      else if (fx.time > 0) d.skip = fx.time;
      d.time = fx.time;
    }
    if (fx.k) { s.karma += fx.k; d.k = fx.k; }
    if (fx.en) { s.energy = clamp(s.energy + fx.en, 0, 100); d.en = fx.en; }
    if (fx.fu) { s.fuel = clamp(s.fuel + fx.fu, 0, 100); d.fu = fx.fu; }
    if (fx.c) { const v = fx.c < 0 ? fx.c * (1 - up(s, "tires") * 0.05) : fx.c; s.cond = clamp(s.cond + v, 0, 100); d.c = Math.round(v); }
    if (fx.xp) { const v = Math.round(fx.xp * (1 + s.level * 0.05)); addXP(s, v); d.xp = v; }
    if (fx.fame) { s.rating = clamp(s.rating + fx.fame, 1, 5); d.fame = fx.fame; }
    if (fx.sp) { s.sp += fx.sp; d.sp = fx.sp; }
    if (fx.flag) s.flags[fx.flag] = true;
    if (fx.unflag) delete s.flags[fx.unflag];
    if (fx.item) {
      const it = fx.item === "auto" ? p.ctx.item : fx.item;
      if (NF.LOST_ITEMS.includes(it) || it === "case") { s.lost.push({ it, n: s.nights + 1, arch: p.ctx.arch }); d.lost = it; }
      else { s.items[it] = (s.items[it] || 0) + 1; d.item = it; }
    }
    if (fx.pc) {
      const key = fx.pc === 1 ? `${s.district}_${s.shift ? s.shift.weather : "clear"}` : String(fx.pc);
      const fresh = !s.postcards[key];
      s.postcards[key] = (s.postcards[key] || 0) + 1;
      d.pc = key; d.pcNew = fresh;
    }
    if (fx.later) {
      const [id, a, b, prob] = fx.later;
      if (rnd(s) < prob) s.later.push({ id, n: s.nights + ri(s, a, b) });
    }
    if (fx.arc) {
      const [id, step] = fx.arc, a = NF.ARC[id];
      s.arcs[id] = Math.max(s.arcs[id] || 0, step);
      s.arcNext[id] = s.nights + 1 + a.gap;
      if (s.shift) s.shift.arcDone[id] = true;
      journal(s, { k: "arc", id, v: step });
      d.arc = [id, step];
      if (step >= a.eps) emit("arcDone", id);
    }
    return d;
  }

  // ───────── действия в ожидании ─────────
  NF.canAct = (s) => !!s.shift && !s.ride && !s.pending && !s.shift.busy;
  NF.act = function (s, kind, arg) {
    if (!NF.canAct(s)) return false;
    const sh = s.shift;
    if (kind === "coffee") {
      const c = NF.coffeeCost(s);
      if (s.money < c) return false;
      s.money -= c; sh.extra -= c;
      sh.busy = { kind, t: 10, total: 10 };
    } else if (kind === "nap") {
      sh.busy = { kind, t: 40, total: 40 };
    } else if (kind === "refuel") {
      const c = NF.refuelCost(s);
      if (s.fuel >= 99 || s.money < c) return false;
      s.money -= c; sh.fuelCost += c;
      sh.busy = { kind, t: 6, total: 6 };
    } else if (kind === "move") {
      if (!s.districts.includes(arg) || arg === s.district) return false;
      const t = ri(s, 12, 20);
      sh.busy = { kind, t, total: t, to: arg, road: rnd(s) < 0.25 ? ri(s, 3, t - 2) : -1 };
      sh.orders = [];
    } else return false;
    emit("busy", sh.busy);
    return true;
  };
  function finishBusy(s) {
    const b = s.shift.busy;
    s.shift.busy = null;
    if (b.kind === "coffee") s.energy = clamp(s.energy + 25, 0, 100);
    if (b.kind === "nap") s.energy = clamp(s.energy + 35, 0, 100);
    if (b.kind === "refuel") s.fuel = 100;
    if (b.kind === "move") { s.district = b.to; spawnOrder(s); }
    emit("busyEnd", b);
  }

  // ───────── шаг времени ─────────
  NF.update = function (s, dt) {
    const sh = s.shift;
    if (!sh || s.pending) return;
    sh.acc += dt;
    while (sh.acc >= 1 && s.shift && !s.pending) { sh.acc -= 1; stepMinute(s, false); }
    if (s.pending && s.shift) s.shift.acc = 0;
  };
  function stepMinute(s, quiet) {
    const sh = s.shift;
    sh.min++;
    s.minute = sh.min; s.hour = NF.hourOf(sh.min);
    if (sh.wChange && sh.min >= sh.wChange.at) { sh.weather = sh.wChange.to; sh.wChange = null; emit("weather", sh.weather); }
    const r = s.ride;
    const drain = (r ? 0.11 : 0.06) * (1 - s.skills.stamina * 0.05) * (sh.zen ? 0.6 : 1);
    s.energy = clamp(s.energy - drain, 0, 100);
    // заказы: истекают и появляются
    const before = sh.orders.length;
    sh.orders = sh.orders.filter((o) => o.exp > sh.min);
    if (sh.orders.length !== before) emit("ordersChanged");
    if (sh.min < SHIFT_LEN - 8) {
      const hf = { 22: 1.2, 23: 1.3, 0: 1.3, 1: 1.1, 2: 0.8, 3: 0.7, 4: 0.7, 5: 0.9 }[s.hour] || 1;
      const wf = { rain: 1.3, storm: 1.5, snow: 1.3, fog: 1.1 }[sh.weather] || 1;
      const cap = 3 + Math.floor(up(s, "nav") / 4);
      if (sh.orders.length < cap && rnd(s) < 0.2 * hf * wf * (1 + s.skills.city * 0.04)) spawnOrder(s);
      for (const a of NF.ARCS) {
        if (a.idle || sh.orders.some((o) => o.arc && o.arc.id === a.id) || (r && r.arc && r.arc.id === a.id)) continue;
        if (arcEligible(s, a) && rnd(s) < 0.002) spawnOrder(s, a.id);
      }
    }
    if (r) {
      const kmMin = r.phase === "pickup" ? car(s).speed * 0.6 : r.km / r.total;
      const fuelUse = kmMin * fuelPerKm(s);
      s.fuel = clamp(s.fuel - fuelUse, 0, 100);
      s.cond = clamp(s.cond - kmMin * 0.08 * (1 - up(s, "tires") * 0.06), 0, 100);
      r.t--;
      if (r.phase === "pickup") {
        if (r.t <= 0) { r.phase = "ride"; r.total = r.t = rideMinutes(s, r.km); emit("pickup", r); }
      } else {
        const prog = 1 - r.t / r.total;
        r.kmDone = r.km * prog;
        if (!quiet && r.evAt != null && !r.evDone && prog >= r.evAt) {
          r.evDone = true;
          if (r.arc) triggerEvent(s, `${r.arc.id}_${r.arc.n}`);
          else rollEvent(s, "ride");
        } else if (!quiet && r.roadAt != null && !r.roadDone && prog >= r.roadAt) {
          r.roadDone = true; rollEvent(s, "road");
        }
        if (r.t <= 0 && !s.pending) finishRide(s);
      }
    } else if (sh.busy) {
      const b = sh.busy;
      b.t--;
      if (b.kind === "move" || b.kind === "tow") s.fuel = clamp(s.fuel - (b.kind === "move" ? car(s).speed * fuelPerKm(s) : 0), 0, 100);
      if (!quiet && b.kind === "move" && b.road === b.total - b.t) { rollEvent(s, "road"); }
      if (b.t <= 0) finishBusy(s);
    } else if (!quiet) {
      // пока ждём: последствия прошлых ночей, сюжеты на стоянке, мелкие сцены
      const due = sh.min > 15 ? s.later.findIndex((l) => l.n <= s.nights + 1) : -1;
      if (due >= 0 && rnd(s) < 0.15) {
        const l = s.later.splice(due, 1)[0];
        triggerEvent(s, l.id);
      } else if (sh.min - sh.lastEv > 12) {
        const idleArc = NF.ARCS.find((a) => a.idle && arcEligible(s, a));
        if (idleArc && rnd(s) < 0.012) triggerEvent(s, `${idleArc.id}_${(s.arcs[idleArc.id] || 0) + 1}`);
        else if (sh.idleEv < 7 && rnd(s) < 0.022) { sh.idleEv++; rollEvent(s, "idle"); }
      }
      if (s.fuel <= 0 && !s.pending) tow(s);
    }
    if (!s.pending && !s.ride && !sh.busy) {
      if (sh.min >= SHIFT_LEN) NF.endShift(s, false);
      else if (s.energy <= 0) NF.endShift(s, true, "tired");
    }
  }
  NF.stepMinute = stepMinute;

  // ───────── конец смены ─────────
  NF.endShift = function (s, early, reason) {
    const sh = s.shift;
    if (!sh || s.ride) return null;
    s.pending = null;
    const fleet = NF.fleetIncome(s);
    if (fleet) { s.money += fleet; s.stats.earned += fleet; s.fleet.earned += fleet; }
    s.nights++;
    const total = sh.earned + sh.tips;
    if (!early) s.stats.dawns++;
    if (sh.zen) s.stats.zenNights++;
    s.stats.bestShift = Math.max(s.stats.bestShift, total);
    if (sh.daily) s.dayBest[sh.date] = Math.max(s.dayBest[sh.date] || 0, total);
    const sum = {
      night: s.nights, earned: sh.earned, tips: sh.tips, extra: sh.extra, fuelCost: sh.fuelCost, fleet,
      net: s.money - sh.startMoney, rides: sh.rides, km: Math.round(sh.km * 10) / 10,
      avg: sh.rides ? Math.round((sh.starSum / sh.rides) * 100) / 100 : 0, five: sh.five, xp: sh.xp, levels: sh.levels,
      rating: s.rating, ratingDelta: s.rating - sh.startRating, weather: sh.weather, early: !!early, reason: reason || null,
      daily: sh.daily, date: sh.date, call: ri(s, 0, 999), events: sh.events, district: s.district, towCost: sh.towCost || 0,
    };
    journal(s, { k: "shift", v: total });
    s.shift = null; s.ride = null; s.energy = 100; s.minute = 0; s.hour = 22;
    s.lastSummary = sum;
    checkAch(s);
    NF.save(s);
    emit("shiftEnd", sum);
    return sum;
  };

  // ───────── гараж, навыки, город ─────────
  NF.buyUpgrade = function (s, id) {
    const u = NF.UPGRADES.find((x) => x.id === id);
    if (!u || up(s, id) >= NF.UP_MAX) return false;
    const c = NF.upPrice(s, u);
    if (s.money < c) return false;
    s.money -= c; s.ups[id] = up(s, id) + 1;
    checkAch(s);
    return true;
  };
  NF.buyCar = function (s, id) {
    const c = NF.CAR[id];
    if (!c || s.cars.includes(id) || s.money < c.price || s.ride) return false;
    s.money -= c.price; s.cars.push(id); s.car = id; s.cond = 100;
    s.carIdx = NF.CARS.indexOf(c);
    journal(s, { k: "car", id });
    checkAch(s);
    return true;
  };
  NF.selectCar = function (s, id) {
    if (!s.cars.includes(id) || s.ride) return false;
    s.car = id; s.carIdx = NF.CARS.findIndex((c) => c.id === id);
    return true;
  };
  // ───────── серия ночей: награда за каждый день подряд ─────────
  NF.STREAK = [1, 1.5, 2, 2.5, 3, 4, 6];
  NF.streakInfo = function (s) {
    const st = s.streak || { last: "", n: 0 };
    const t = NF.today(), y = NF.today(new Date(Date.now() - 864e5));
    const claimed = st.last === t;
    const n = claimed ? st.n : st.last === y ? st.n + 1 : 1; // номер дня, который забираем (или забрали) сегодня
    const day = ((n - 1) % 7) + 1;
    return { n, day, claimed, money: Math.round(25 * NF.STREAK[day - 1] * moneyScale(s)), boost: day === 7 };
  };
  NF.claimStreak = function (s) {
    const i = NF.streakInfo(s);
    if (i.claimed) return null;
    s.streak = { last: NF.today(), n: i.n };
    s.money += i.money; s.stats.earned += i.money;
    if (i.boost) NF.giveBoost(s, 30);
    return i;
  };
  // бесплатная заправка/ремонт за рекламу — по разу за ночь
  NF.adFreeLeft = (s, k) => !s.adFree || s.adFree.n !== s.nights || !s.adFree[k];
  NF.useAdFree = function (s, k) {
    if (!s.adFree || s.adFree.n !== s.nights) s.adFree = { n: s.nights };
    s.adFree[k] = 1;
    if (k === "fuel") s.fuel = 100;
    if (k === "repair") s.cond = 100;
  };

  NF.repair = function (s) {
    const c = NF.repairCost(s);
    if (s.cond >= 100 || s.money < c) return false;
    s.money -= c; s.cond = 100;
    return true;
  };
  NF.refuelHome = function (s) {
    const c = NF.refuelCost(s);
    if (s.fuel >= 100 || s.money < c) return false;
    s.money -= c; s.fuel = 100;
    return true;
  };
  NF.learn = function (s, id) {
    if (!(id in s.skills) || s.skills[id] >= NF.SKILL_MAX) return false;
    const c = NF.skillCost(s, id);
    if (s.sp < c) return false;
    s.sp -= c; s.skills[id]++;
    return true;
  };
  NF.unlockCheck = function (s, id) {
    const d = NF.D[id], n = d.need;
    return {
      rating: s.rating >= n.rating, level: s.level >= n.level, fee: s.money >= n.fee, flag: !n.flag || !!s.flags[n.flag],
      ok: s.rating >= n.rating && s.level >= n.level && s.money >= n.fee && (!n.flag || !!s.flags[n.flag]),
    };
  };
  NF.unlock = function (s, id) {
    if (s.districts.includes(id) || !NF.unlockCheck(s, id).ok) return false;
    s.money -= NF.D[id].need.fee;
    s.districts.push(id);
    journal(s, { k: "unlock", id });
    checkAch(s);
    return true;
  };
  NF.buyFleetCar = function (s) {
    if (!NF.fleetOpen(s) || s.fleet.cars >= NF.fleetCap(s)) return false;
    const c = NF.fleetCarCost(s);
    if (s.money < c) return false;
    s.money -= c; s.fleet.cars++;
    checkAch(s);
    return true;
  };
  NF.buyGarage = function (s) {
    if (!NF.fleetOpen(s)) return false;
    const c = NF.garageCost(s);
    if (s.money < c) return false;
    s.money -= c; s.fleet.garage++;
    return true;
  };
  NF.becomeLegend = function (s) {
    if (!NF.canLegend(s) || s.shift) return false;
    s.money -= NF.legendNeed(s).money;
    s.legend++;
    journal(s, { k: "legend", v: s.legend });
    checkAch(s);
    return true;
  };
  // Бюро находок: вернуть владельцу (карма, иногда благодарность) или оставить себе (деньги)
  NF.returnLost = function (s, i) {
    const l = s.lost[i];
    if (!l) return false;
    s.lost.splice(i, 1);
    s.karma += 3; s.stats.returned++;
    if (Math.random() < 0.5) s.later.push({ id: "owner_call", n: s.nights + 1 + Math.floor(Math.random() * 3) });
    checkAch(s);
    return true;
  };
  NF.keepLost = function (s, i) {
    const l = s.lost[i];
    if (!l) return false;
    s.lost.splice(i, 1);
    const v = Math.round(25 * moneyScale(s));
    s.money += v; s.karma -= 3;
    return v;
  };

  // ───────── заголовок водителя по рейтингу и уровню ─────────
  NF.titleIdx = (s) => (s.legend > 0 ? 7 : Math.min(6, Math.floor(s.level / 10)));
})();
