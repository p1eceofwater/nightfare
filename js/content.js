/* Ночной тариф — игровые данные и логика событий (тексты лежат в js/lang/*.js).
   Чтобы добавить событие: допиши его сюда (id, условия, варианты) и тексты с тем же id во все языки. */
(function () {
  "use strict";
  const NF = (window.NF = window.NF || {});

  // ───────── Районы ─────────
  // mult — множитель цены, need — условия открытия, sky/glow — палитра, mark — ориентир на горизонте
  NF.DISTRICTS = [
    { id: "sleepy", mult: 1.0, need: { rating: 0, level: 1, fee: 0 }, sky: ["#141a33", "#2a2650"], glow: "#f2c66d", mark: "blocks" },
    { id: "old", mult: 1.1, need: { rating: 4.3, level: 2, fee: 150 }, sky: ["#1a1530", "#3b2a4a"], glow: "#f5b45a", mark: "domes" },
    { id: "river", mult: 1.15, need: { rating: 4.4, level: 4, fee: 400 }, sky: ["#0f1d33", "#1f3b55"], glow: "#9fd3ff", mark: "bridge" },
    { id: "center", mult: 1.25, need: { rating: 4.5, level: 6, fee: 900 }, sky: ["#141833", "#2c2f5c"], glow: "#ffd98a", mark: "towers" },
    { id: "neon", mult: 1.35, need: { rating: 4.55, level: 9, fee: 2000 }, sky: ["#1b0f2e", "#40205a"], glow: "#ff5fa2", mark: "neon" },
    { id: "harbor", mult: 1.3, need: { rating: 4.6, level: 12, fee: 3500 }, sky: ["#0d1a26", "#1d3340"], glow: "#ffb35c", mark: "cranes" },
    { id: "airport", mult: 1.6, need: { rating: 4.7, level: 16, fee: 8000 }, sky: ["#101828", "#24324a"], glow: "#8fe3ff", mark: "airport" },
    { id: "business", mult: 1.8, need: { rating: 4.75, level: 22, fee: 20000 }, sky: ["#0e1424", "#222c48"], glow: "#cfe8ff", mark: "glass" },
    { id: "hills", mult: 2.3, need: { rating: 4.85, level: 30, fee: 60000 }, sky: ["#121a2c", "#2b3352"], glow: "#ffe2a8", mark: "villas" },
    { id: "lighthouse", mult: 3.0, need: { rating: 4.9, level: 45, fee: 120000, flag: "lighthouse_map" }, sky: ["#0a1422", "#1b2c44"], glow: "#fff1b8", mark: "lighthouse" },
  ];
  NF.D = Object.fromEntries(NF.DISTRICTS.map((d) => [d.id, d]));

  // ───────── Машины ─────────
  // eff — расход топлива (% бака на км), comfort — бонус к оценке, speed — км/игровую минуту, hue — цвет
  NF.CARS = [
    { id: "komet", price: 0, eff: 1.3, comfort: 0, speed: 0.55, color: "#e8b93c" },
    { id: "sparrow", price: 1500, eff: 1.1, comfort: 0.1, speed: 0.58, color: "#d9d2c3" },
    { id: "city", price: 6000, eff: 0.95, comfort: 0.2, speed: 0.6, color: "#f2c94c" },
    { id: "hybrid", price: 18000, eff: 0.6, comfort: 0.3, speed: 0.62, color: "#9bd1c8" },
    { id: "sedan", price: 45000, eff: 0.75, comfort: 0.45, speed: 0.66, color: "#2f3542" },
    { id: "volt", price: 120000, eff: 0.35, comfort: 0.55, speed: 0.7, color: "#e9eef5" },
    { id: "aurora", price: 400000, eff: 0.45, comfort: 0.75, speed: 0.74, color: "#1a1d26" },
    { id: "phantom", price: 2500000, eff: 0.3, comfort: 1.0, speed: 0.8, color: "#3a1f5c" },
  ];
  NF.CAR = Object.fromEntries(NF.CARS.map((c) => [c.id, c]));

  // ───────── Улучшения машины (уровни 0–10, цена растёт ×1.75) ─────────
  NF.UPGRADES = [
    { id: "seats", base: 120 }, { id: "clean", base: 90 }, { id: "music", base: 150 }, { id: "climate", base: 200 },
    { id: "nav", base: 260 }, { id: "eco", base: 300 }, { id: "tires", base: 220 }, { id: "charger", base: 80 },
    { id: "snacks", base: 140 }, { id: "dashcam", base: 350 },
  ];
  NF.UP_MAX = 10;
  NF.upCost = (u, lvl) => Math.round(u.base * Math.pow(1.75, lvl));

  // ───────── Навыки водителя (очки за уровни, 0–10) ─────────
  NF.SKILLS = ["charm", "eye", "econ", "stamina", "city"];
  NF.SKILL_MAX = 10;

  // ───────── Типы пассажиров ─────────
  // like — что ценит в поездке: talk / music / quiet; tip — щедрость; rich — достаток; where — любимые районы
  NF.ARCH = [
    { id: "office", like: "quiet", tip: 0.10, rich: 2, where: ["center", "business", "sleepy"] },
    { id: "student", like: "music", tip: 0.04, rich: 0, where: ["old", "sleepy", "neon"] },
    { id: "nurse", like: "quiet", tip: 0.10, rich: 1, where: ["center", "sleepy", "river"] },
    { id: "party", like: "music", tip: 0.16, rich: 1, where: ["neon", "old", "center"] },
    { id: "tourist", like: "talk", tip: 0.14, rich: 2, where: ["old", "river", "airport", "center"] },
    { id: "boss", like: "quiet", tip: 0.20, rich: 3, where: ["business", "hills", "airport"] },
    { id: "granny", like: "talk", tip: 0.06, rich: 0, where: ["sleepy", "old"] },
    { id: "musician", like: "music", tip: 0.08, rich: 0, where: ["neon", "old", "river"] },
    { id: "couple", like: "music", tip: 0.12, rich: 1, where: ["river", "neon", "center"] },
    { id: "worker", like: "talk", tip: 0.07, rich: 0, where: ["harbor", "sleepy"] },
    { id: "chef", like: "talk", tip: 0.10, rich: 1, where: ["center", "old", "neon"] },
    { id: "coder", like: "quiet", tip: 0.09, rich: 2, where: ["business", "center", "sleepy"] },
    { id: "pilot", like: "quiet", tip: 0.15, rich: 2, where: ["airport", "hills"] },
    { id: "sailor", like: "talk", tip: 0.09, rich: 1, where: ["harbor", "river"] },
    { id: "writer", like: "talk", tip: 0.07, rich: 1, where: ["old", "river"] },
    { id: "streamer", like: "music", tip: 0.11, rich: 1, where: ["neon", "center"] },
    { id: "athlete", like: "music", tip: 0.10, rich: 2, where: ["center", "hills"] },
    { id: "guard", like: "talk", tip: 0.05, rich: 0, where: ["business", "harbor"] },
    { id: "mom", like: "quiet", tip: 0.08, rich: 1, where: ["sleepy", "center"] },
    { id: "star", like: "quiet", tip: 0.35, rich: 3, where: ["hills", "neon", "airport"] },
    { id: "mystery", like: "quiet", tip: 0.25, rich: 2, where: ["harbor", "old", "lighthouse"] },
    { id: "artist", like: "talk", tip: 0.06, rich: 0, where: ["old", "river", "neon"] },
    { id: "doctor", like: "quiet", tip: 0.12, rich: 2, where: ["center", "hills"] },
    { id: "bride", like: "music", tip: 0.20, rich: 2, where: ["river", "hills", "center"] },
  ];
  // пол для склонений в текстах: фиксированный у некоторых типов, иначе случайный
  const GF = { granny: "f", bride: "f", mom: "f", nurse: 0.8 };
  NF.ARCH.forEach((a) => (a.g = GF[a.id] === undefined ? 0.5 : GF[a.id] === "f" ? 1 : GF[a.id]));
  NF.A = Object.fromEntries(NF.ARCH.map((a) => [a.id, a]));
  NF.MOODS = ["calm", "hurry", "tipsy", "silent", "chatty", "sad", "happy"];
  NF.LOST_ITEMS = ["phone", "wallet", "umbrella", "keys", "ring", "scarf", "book", "toy", "watch", "camera", "glasses", "letter"];

  // ───────── Достижения ─────────
  NF.ACH = [
    ["first_ride", (s) => s.stats.rides >= 1], ["rides_50", (s) => s.stats.rides >= 50], ["rides_500", (s) => s.stats.rides >= 500],
    ["rides_5000", (s) => s.stats.rides >= 5000], ["nights_10", (s) => s.nights >= 10], ["nights_100", (s) => s.nights >= 100],
    ["nights_365", (s) => s.nights >= 365], ["km_1000", (s) => s.stats.km >= 1000], ["km_40000", (s) => s.stats.km >= 40075],
    ["money_10k", (s) => s.stats.earned >= 10000], ["money_1m", (s) => s.stats.earned >= 1e6], ["money_1b", (s) => s.stats.earned >= 1e9],
    ["rating_48", (s) => s.rating >= 4.8], ["rating_495", (s) => s.rating >= 4.95], ["five_star_100", (s) => s.stats.five >= 100],
    ["all_districts", (s) => s.districts.length >= NF.DISTRICTS.length], ["lighthouse", (s) => s.districts.includes("lighthouse")],
    ["car_volt", (s) => s.cars.includes("volt")], ["car_phantom", (s) => s.cars.includes("phantom")],
    ["ups_max", (s) => NF.UPGRADES.every((u) => (s.ups[u.id] || 0) >= NF.UP_MAX)], ["level_25", (s) => s.level >= 25],
    ["level_100", (s) => s.level >= 100], ["cat", (s) => !!s.flags.cat], ["album_all", (s) => NF.ARCH.every((a) => s.album[a.id])],
    ["postcards_10", (s) => Object.keys(s.postcards).length >= 10], ["honest", (s) => s.karma >= 50], ["shady", (s) => s.karma <= -30],
    ["lost_returned_10", (s) => s.stats.returned >= 10], ["fleet_10", (s) => s.fleet.cars >= 10], ["fleet_100", (s) => s.fleet.cars >= 100],
    ["legend", (s) => s.legend >= 1], ["arcs_all", (s) => NF.ARCS.every((a) => (s.arcs[a.id] || 0) >= a.eps)],
    ["night_of_day", (s) => Object.keys(s.dayBest).length >= 1], ["storm_rider", (s) => s.stats.stormRides >= 25],
    ["dawn_10", (s) => s.stats.dawns >= 10], ["zen", (s) => s.stats.zenNights >= 5],
  ];

  // ───────── Сюжетные пассажиры (город помнит) ─────────
  // eps — число эпизодов; where — где может встретиться; gap — минимум ночей между эпизодами
  NF.ARCS = [
    { id: "felix", eps: 4, arch: "musician", where: ["old", "neon", "river"], gap: 2 },
    { id: "vera", eps: 4, arch: "nurse", where: ["center", "sleepy", "river"], gap: 2 },
    { id: "tim", eps: 4, arch: "student", where: ["sleepy", "old", "center"], gap: 3 },
    { id: "irma", eps: 4, arch: "writer", where: ["old", "river", "center"], gap: 2 },
    { id: "red", eps: 4, arch: "mystery", where: ["harbor", "old", "river"], gap: 3, minLevel: 8 },
    { id: "boris", eps: 4, arch: "worker", where: ["sleepy", "harbor", "center"], gap: 2, idle: true },
    { id: "coal", eps: 4, arch: "cat", where: null, gap: 1, idle: true },
    { id: "annamark", eps: 4, arch: "couple", where: ["river", "neon", "center"], gap: 2 },
  ];
  NF.ARC = Object.fromEntries(NF.ARCS.map((a) => [a.id, a]));
  NF.ARC_G = { felix: "m", vera: "f", tim: "m", irma: "f", red: "f", boris: "m", coal: "m", annamark: "f" };

  // ───────── События ─────────
  // cat: ride (во время поездки), road (на дороге), idle (пока ждёшь заказ), later (последствие), arc (сюжет), season
  // o: варианты. Без p — результат key "i"; с p — "is" (успех) / "if" (неудача). sk — навык, повышающий шанс.
  // Эффекты: m деньги, mf ×стоимость поездки, tip доп. чаевые ×стоимость, r оценка поездки, k карма, en энергия,
  //   fu топливо, c состояние машины, xp опыт, time минуты, item забытая вещь, pc открытка, flag, unflag,
  //   later [id, мин. ночей, макс. ночей, вероятность], fame рейтинг водителя, sp очко навыка, arc [id, шаг], fare ×цена поездки.
  const E = (NF.EVENTS = []);
  const ev = (id, cat, w, o, when) => E.push({ id, cat, w, o, when: when || null });
  const A = (r, ...ids) => r && ids.includes(r.arch);
  const H = (s, a, b) => (a <= b ? s.hour >= a && s.hour < b : s.hour >= a || s.hour < b);
  const W = (s, ...w) => w.includes(s.shift.weather);

  // — Тусовщики —
  ev("drunk_sleep", "ride", 2.2, [
    { fx: { r: 1, tip: 0.3, k: 2, later: ["drunk_thanks", 2, 6, 0.5] } },
    { fx: { r: -0.5 } },
    { p: 0.22, sk: "eye", ok: { mf: 2.5, k: -5, later: ["cop_brother", 2, 6, 0.7] }, no: { r: -3, k: -4, m: -20, en: -5 } },
  ], (s, r) => A(r, "party") && H(s, 0, 5));
  ev("drunk_sing", "ride", 1.6, [{ fx: { r: 1, tip: 0.2, en: -2 } }, { fx: { r: -0.5 } }, { fx: { r: 0.5 } }], (s, r) => A(r, "party"));
  ev("drunk_sick", "ride", 1.2, [
    { fx: { time: 4, r: 1, tip: 0.2 } },
    { p: 0.5, sk: "city", ok: { r: 0 }, no: { c: -6, m: -25, r: -1 } },
    { fx: { r: 0.5, m: -2 } },
  ], (s, r) => A(r, "party") && H(s, 1, 5));
  ev("party_food", "ride", 1.4, [{ fx: { time: 8, tip: 0.35, r: 1, en: 3 } }, { fx: { r: -0.5 } }], (s, r) => A(r, "party", "student"));
  ev("party_phone", "ride", 1.0, [
    { p: 0.6, ok: { time: 12, tip: 0.6, r: 1, k: 2 }, no: { time: 12, r: 0 } },
    { fx: { r: -1 } },
  ], (s, r) => A(r, "party"));
  // — Студенты —
  ev("student_broke", "ride", 1.6, [
    { fx: { mf: -0.6, k: 4, r: 1, later: ["student_return", 3, 10, 0.6] } },
    { fx: { item: "watch", mf: -0.3, k: -1 } },
    { fx: { mf: -0.4, r: -1, time: -3 } },
  ], (s, r) => A(r, "student"));
  ev("student_exam", "ride", 1.3, [{ fx: { r: 1 } }, { fx: { r: 0.5, tip: 0.1 } }, { fx: { r: -1 } }], (s, r) => A(r, "student") && H(s, 22, 3));
  ev("student_startup", "ride", 0.9, [
    { fx: { mf: -1, later: ["startup_win", 10, 30, 0.18] } },
    { fx: { r: 0 } },
  ], (s, r) => A(r, "student", "coder"));
  // — Медики и ночные работники —
  ev("nurse_sleep", "ride", 1.6, [{ fx: { r: 1.5, tip: 0.2, time: 2 } }, { fx: { r: 0 } }], (s, r) => A(r, "nurse", "doctor", "guard"));
  ev("doctor_rush", "ride", 1.2, [
    { p: 0.65, sk: "city", ok: { r: 1.5, tip: 0.3, k: 3, time: -4 }, no: { c: -5, r: 0, time: -2 } },
    { fx: { r: -0.5 } },
  ], (s, r) => A(r, "doctor", "nurse"));
  ev("worker_pie", "ride", 1.3, [{ fx: { en: 8, r: 1 } }, { fx: { r: 0 } }], (s, r) => A(r, "worker", "guard", "chef"));
  ev("guard_life", "ride", 1.0, [{ fx: { r: 1, en: -2, xp: 10 } }, { fx: { r: 0 } }], (s, r) => A(r, "guard"));
  // — Бизнес —
  ev("boss_call", "ride", 1.3, [
    { fx: { later: ["stock_tip", 2, 5, 0.5], k: -1 } },
    { fx: { r: 1 } },
  ], (s, r) => A(r, "boss", "coder"));
  ev("boss_case", "ride", 1.0, [
    { fx: { time: 6, k: 6, later: ["case_reward", 1, 3, 0.9] } },
    { p: 0.35, sk: "eye", ok: { m: 400, k: -8, later: ["case_police", 2, 5, 0.6] }, no: { k: -4, m: 0 } },
    { fx: { k: 3, item: "case" } },
  ], (s, r) => A(r, "boss"));
  ev("boss_hire", "ride", 0.7, [{ fx: { time: 70, mf: 5, en: -15, r: 1 } }, { fx: { r: 0 } }], (s, r) => A(r, "boss", "star") && s.minute < 300);
  ev("boss_overtip", "ride", 1.0, [{ fx: { k: 6, r: 1.5, later: ["honest_reward", 2, 6, 0.4] } }, { fx: { mf: 2, k: -3 } }], (s, r) => A(r, "boss", "party", "athlete"));
  // — Туристы —
  ev("tourist_photo", "ride", 1.3, [{ p: 0.75, sk: "city", ok: { r: 1, tip: 0.3 }, no: { time: 10, r: -0.5 } }, { fx: { time: 6, r: 0 } }], (s, r) => A(r, "tourist"));
  ev("tourist_view", "ride", 1.4, [{ fx: { time: 5, tip: 0.3, r: 1, pc: 1 } }, { fx: { r: -0.5 } }], (s, r) => A(r, "tourist", "couple"));
  ev("tourist_lang", "ride", 1.2, [{ p: 0.6, sk: "charm", ok: { r: 1.5, tip: 0.2 }, no: { r: -0.5, time: 3 } }, { fx: { r: 0.5 } }], (s, r) => A(r, "tourist"));
  ev("tourist_meter", "ride", 1.0, [
    { p: 0.6, ok: { mf: 1, k: -6, later: ["meter_complaint", 1, 4, 0.5] }, no: { r: -3, k: -4 } },
    { fx: { k: 3, r: 0.5 } },
  ], (s, r) => A(r, "tourist"));
  // — Пожилые —
  ev("granny_story", "ride", 1.6, [{ fx: { r: 1.5, en: -3, xp: 8 } }, { fx: { r: 0.5 } }], (s, r) => A(r, "granny"));
  ev("granny_coins", "ride", 1.2, [{ fx: { time: 3, r: 1 } }, { fx: { mf: -1, k: 6, r: 2, later: ["granny_jam", 2, 6, 0.6] } }], (s, r) => A(r, "granny"));
  ev("granny_dance", "ride", 0.9, [{ fx: { r: 1.5, tip: 0.2 } }, { fx: { r: 0.5 } }], (s, r) => A(r, "granny") && H(s, 22, 1));
  // — Пары —
  ev("couple_fight", "ride", 1.2, [
    { p: 0.45, sk: "charm", ok: { r: 2, tip: 0.4 }, no: { r: -1.5 } },
    { fx: { r: 0 } },
    { fx: { r: 1 } },
  ], (s, r) => A(r, "couple"));
  ev("couple_propose", "ride", 0.8, [{ fx: { time: 12, tip: 1.0, r: 2, pc: 1, xp: 15 } }, { fx: { r: -1 } }], (s, r) => A(r, "couple"));
  // — Загадочные —
  ev("myst_package", "ride", 0.9, [
    { fx: { m: 300, k: -4, later: ["package_police", 1, 4, 0.55] } },
    { fx: { k: 2, r: 0 } },
  ], (s, r) => A(r, "mystery", "boss"));
  ev("myst_follow", "ride", 0.9, [
    { p: 0.55, sk: "city", ok: { mf: 2, r: 1, time: 10 }, no: { time: 15, c: -4, r: -1 } },
    { fx: { r: -1 } },
  ], (s, r) => A(r, "mystery"));
  ev("myst_coin", "ride", 0.8, [{ fx: { item: "coin", mf: -1, k: 1 } }, { fx: { r: -0.5 } }], (s, r) => A(r, "mystery"));
  // — Знаменитости —
  ev("star_incognito", "ride", 1.0, [
    { fx: { r: 2, tip: 0.8 } },
    { fx: { item: "autograph", r: 0 } },
    { fx: { r: -1, later: ["paparazzi", 1, 3, 0.8] } },
  ], (s, r) => A(r, "star"));
  ev("star_escape", "ride", 0.8, [
    { p: 0.6, sk: "city", ok: { tip: 1.2, r: 2 }, no: { c: -5, r: 0 } },
    { fx: { r: -1 } },
  ], (s, r) => A(r, "star"));
  // — Родители и дети —
  ev("mom_kid", "ride", 1.5, [{ fx: { r: 1.5, time: 3 } }, { fx: { r: 0 } }], (s, r) => A(r, "mom"));
  ev("mom_hospital", "ride", 0.8, [
    { p: 0.7, sk: "city", ok: { r: 2, k: 6, time: -4, later: ["hospital_thanks", 2, 6, 0.6] }, no: { c: -6, r: 1, k: 4 } },
    { fx: { r: -1, k: -2 } },
  ], (s, r) => A(r, "mom"));
  // — Творческие и рабочие —
  ev("chef_food", "ride", 1.3, [{ fx: { en: 10, r: 1 } }, { fx: { r: 0 } }], (s, r) => A(r, "chef"));
  ev("musician_play", "ride", 1.3, [{ fx: { r: 1.5, tip: 0.1, xp: 6 } }, { fx: { r: -0.5 } }], (s, r) => A(r, "musician"));
  ev("artist_sketch", "ride", 1.0, [{ fx: { item: "sketch", r: 1 } }, { fx: { r: 0 } }], (s, r) => A(r, "artist"));
  ev("coder_bug", "ride", 1.0, [{ p: 0.3, ok: { tip: 0.8, r: 2 }, no: { r: 0 } }, { fx: { r: 1 } }], (s, r) => A(r, "coder"));
  ev("pilot_late", "ride", 1.0, [
    { p: 0.6, sk: "city", ok: { tip: 0.6, r: 2, time: -6 }, no: { r: -1, c: -3 } },
    { fx: { r: -0.5 } },
  ], (s, r) => A(r, "pilot"));
  ev("sailor_tale", "ride", 1.2, [{ fx: { r: 1.5, xp: 8 } }, { fx: { r: 1, en: 2 } }], (s, r) => A(r, "sailor"));
  ev("streamer_live", "ride", 1.0, [{ fx: { r: 1, later: ["viral", 1, 3, 0.5] } }, { fx: { r: -1 } }], (s, r) => A(r, "streamer"));
  ev("athlete_medal", "ride", 0.9, [{ fx: { r: 1.5, tip: 0.3 } }, { fx: { r: 0.5, xp: 6 } }], (s, r) => A(r, "athlete"));
  ev("bride_run", "ride", 0.7, [
    { fx: { time: 10, mf: 2, k: 1, later: ["bride_after", 5, 15, 0.7] } },
    { fx: { r: -1, k: 2 } },
  ], (s, r) => A(r, "bride"));
  // — Любой пассажир —
  ev("pass_cry", "ride", 1.0, [{ fx: { r: 1.5, en: -2, k: 2 } }, { fx: { r: 1 } }, { fx: { r: 0.5 } }], (s, r) => r && r.mood === "sad");
  ev("pass_bday", "ride", 0.8, [{ fx: { r: 1.5, tip: 0.2 } }, { fx: { r: 0 } }], (s, r) => r && r.mood === "happy");
  ev("pass_eat", "ride", 0.5, [{ fx: { c: -2, r: 1 } }, { fx: { r: -0.5 } }], (s, r) => !!r);
  ev("pass_smoke", "ride", 0.8, [{ fx: { c: -3, r: 1, k: -1 } }, { fx: { r: -0.5 } }], (s, r) => A(r, "party", "sailor", "worker", "boss"));
  ev("pass_window", "ride", 0.9, [{ fx: { c: -1, r: 1 } }, { fx: { r: -0.5 } }], (s, r) => W(s, "rain", "storm"));
  ev("pass_route", "ride", 0.61, [{ fx: { time: 5, r: 1 } }, { p: 0.5, sk: "city", ok: { time: -4, r: 1, xp: 5 }, no: { time: 6, r: -1.5 } }], (s, r) => !!r);
  ev("pass_card_fail", "ride", 0.55, [
    { p: 0.7, ok: { r: 0 }, no: { mf: -1, k: 2 } },
    { fx: { mf: -1, k: 6, r: 2, later: ["debt_return", 2, 7, 0.5] } },
    { fx: { time: 6, r: -1 } },
  ], (s, r) => !!r);
  ev("pass_change", "ride", 0.55, [{ fx: { fare: 1.8, time: 10, r: 1 } }, { fx: { r: -0.5 } }], (s, r) => !!r);
  ev("pass_charge", "ride", 0.55, [{ fx: { r: 1 } }, { fx: { r: -0.5 } }], (s, r) => !!r);
  ev("pass_dog", "ride", 0.9, [{ fx: { c: -2, r: 1.5, tip: 0.2 } }, { fx: { r: -1.5, k: -1 } }], (s, r) => A(r, "granny", "mom", "artist", "student", "coder"));
  ev("pass_luggage", "ride", 1.0, [{ fx: { en: -4, r: 1.5, tip: 0.2 } }, { fx: { r: -1 } }], (s, r) => A(r, "tourist", "pilot", "sailor", "boss"));
  ev("pass_late_date", "ride", 1.0, [{ p: 0.6, sk: "city", ok: { r: 2, tip: 0.3 }, no: { r: -1 } }, { fx: { r: 1 } }], (s, r) => r && r.mood === "hurry");
  ev("pass_compliment", "ride", 0.44, [{ fx: { r: 0.5 } }, { fx: { r: 1, xp: 5 } }], (s, r) => !!r && s.carIdx >= 2);
  ev("pass_meaning", "ride", 0.8, [{ fx: { r: 1, en: -2, xp: 8 } }, { fx: { r: 1 } }, { fx: { r: 0 } }], (s, r) => H(s, 2, 5));
  ev("pass_lottery", "ride", 0.33, [{ p: 0.08, ok: { m: 300 }, no: { m: 0 } }, { fx: { m: 0 } }], (s, r) => !!r);
  ev("pass_wrong_taxi", "ride", 0.44, [{ fx: { r: 1, tip: 0.1 } }, { fx: { mf: -1, k: 2 } }], (s, r) => !!r);
  ev("pass_secret", "ride", 0.6, [{ fx: { r: 1, flag: "kept_secret", k: 2 } }, { fx: { r: 0, k: -1 } }], (s, r) => H(s, 1, 5));
  ev("pass_share", "ride", 0.9, [{ fx: { mf: 0.6, r: -0.5 } }, { fx: { r: 0.5 } }], (s, r) => !!r && H(s, 23, 2));
  ev("pass_cold", "ride", 0.8, [{ fx: { r: 1.5 } }, { fx: { r: -1 } }], (s, r) => W(s, "snow", "storm"));
  ev("pass_quiet_ride", "ride", 1.1, [{ fx: { en: 4 } }, { fx: { r: 0.5 } }], (s, r) => r && r.mood === "silent");
  ev("pass_forgot", "ride", 0.72, [
    { fx: { k: 3, item: "auto" } },
    { p: 0.5, sk: "eye", ok: { k: 5, tip: 0.5, r: 2, time: 4 }, no: { time: 6, item: "auto" } },
    { fx: { k: -4, m: 30 } },
  ], (s, r) => !!r);

  // — Дорога —
  ev("road_police", "road", 1.0, [
    { fx: { time: 5 } },
    { p: 0.5, sk: "charm", ok: { time: 2, xp: 5 }, no: { time: 8, m: -30 } },
  ]);
  ev("road_flat", "road", 0.8, [{ fx: { time: 15, en: -6 } }, { fx: { m: -40, time: 6 } }]);
  ev("road_kitten", "road", 0.7, [{ fx: { time: 3, k: 3, flag: "coal_met" } }, { fx: { r: 0 } }], (s) => !s.flags.coal_met);
  ev("road_fog", "road", 1.0, [{ fx: { time: 6 } }, { p: 0.6, sk: "eye", ok: { time: -2 }, no: { c: -6, time: 3 } }], (s) => W(s, "fog"));
  ev("road_flood", "road", 1.0, [{ fx: { time: 8 } }, { p: 0.55, sk: "city", ok: { time: -2, xp: 5 }, no: { c: -8, time: 10, m: -30 } }], (s) => W(s, "storm", "rain"));
  ev("road_accident", "road", 0.6, [{ fx: { time: 15, k: 8, xp: 15, en: -4, later: ["accident_thanks", 2, 8, 0.6] } }, { fx: { k: -2 } }]);
  ev("road_hitch", "road", 0.7, [{ fx: { m: 15, k: 2, time: 5, later: ["hitch_card", 10, 30, 0.6] } }, { fx: { r: 0 } }], (s) => !s.ride);
  ev("road_works", "road", 0.9, [{ fx: { time: 6 } }, { fx: { time: 3, en: -1 } }]);
  ev("road_racer", "road", 0.7, [{ fx: { k: 1 } }, { p: 0.5, ok: { xp: 5 }, no: { m: -80, c: -3 } }], (s) => H(s, 23, 4));
  ev("road_wallet", "road", 0.6, [{ fx: { time: 6, k: 6, later: ["wallet_reward", 1, 5, 0.5] } }, { fx: { m: 60, k: -6 } }]);
  ev("road_fireworks", "road", 0.5, [{ fx: { time: 6, pc: 1, en: 4 } }, { fx: { r: 0 } }], (s) => W(s, "clear") && H(s, 23, 1));
  ev("road_blackout", "road", 0.5, [{ p: 0.6, sk: "eye", ok: { xp: 6 }, no: { c: -4, time: 5 } }, { fx: { time: 8 } }]);
  ev("road_fox", "road", 0.7, [{ fx: { time: 2, en: 3 } }, { fx: { r: 0 } }], (s) => s.district !== "center" && s.district !== "business");
  ev("road_snow_stuck", "road", 1.2, [{ fx: { time: 12, en: -6 } }, { fx: { m: -50, time: 5 } }], (s) => W(s, "snow"));

  // — Пока ждёшь заказ —
  ev("idle_rank", "idle", 1.2, [{ fx: { xp: 10, flag: "rank_tip" } }, { fx: { en: 12, time: 15 } }]);
  ev("idle_coffee", "idle", 1.2, [{ fx: { m: -4, en: 14 } }, { fx: { r: 0 } }]);
  ev("idle_busker", "idle", 1.0, [{ fx: { m: -5, k: 2, en: 4 } }, { fx: { en: 3, time: 5 } }], (s) => ["old", "neon", "river", "center"].includes(s.district));
  ev("idle_dog", "idle", 0.9, [{ fx: { m: -3, k: 3 } }, { fx: { r: 0 } }]);
  ev("idle_rival", "idle", 0.8, [{ p: 0.5, sk: "charm", ok: { xp: 8, flag: "rival_friend" }, no: { en: -3 } }, { fx: { time: 5 } }]);
  ev("idle_quiz", "idle", 0.8, [{ p: 0.3, sk: "city", ok: { m: 200 }, no: { m: 0 } }, { fx: { r: 0 } }]);
  ev("idle_wash", "idle", 0.7, [{ fx: { m: -15, c: 6, time: 12 } }, { fx: { r: 0 } }]);
  ev("idle_friend", "idle", 0.7, [{ fx: { en: 10, time: 20 } }, { fx: { r: 0 } }]);
  ev("idle_homeless", "idle", 0.8, [{ fx: { k: 5, en: -3 } }, { fx: { r: 0 } }], (s) => W(s, "snow", "rain", "storm"));
  ev("idle_market", "idle", 0.8, [{ fx: { m: -8, en: 16, time: 10 } }, { fx: { r: 0 } }], (s) => ["old", "harbor", "neon"].includes(s.district));
  ev("idle_moon", "idle", 0.6, [{ fx: { en: 5, pc: 1 } }, { fx: { r: 0 } }], (s) => W(s, "clear"));
  ev("idle_plane", "idle", 0.6, [{ fx: { en: 4 } }, { fx: { r: 0 } }], (s) => s.district === "airport");
  ev("idle_ship", "idle", 0.6, [{ fx: { en: 4, pc: 1 } }, { fx: { r: 0 } }], (s) => s.district === "harbor");

  // — Последствия прошлых ночей —
  ev("drunk_thanks", "later", 1, [{ fx: { m: 120, r: 0, fame: 0.02 } }]);
  ev("cop_brother", "later", 1, [{ fx: { m: -150, k: 2 } }, { p: 0.35, sk: "charm", ok: { k: 1 }, no: { m: -250, fame: -0.05 } }]);
  ev("student_return", "later", 1, [{ fx: { m: 40, k: 2, fame: 0.02 } }]);
  ev("startup_win", "later", 1, [{ fx: { m: 15000, xp: 100 } }]);
  ev("stock_tip", "later", 1, [{ p: 0.5, ok: { m: 600 }, no: { m: -200 } }, { fx: { k: 2 } }]);
  ev("case_reward", "later", 1, [{ fx: { m: 500, fame: 0.04, xp: 30 } }]);
  ev("case_police", "later", 1, [{ fx: { m: -400, k: 3 } }, { p: 0.4, ok: { k: -2 }, no: { m: -700, fame: -0.08 } }]);
  ev("honest_reward", "later", 1, [{ fx: { m: 300, fame: 0.03 } }]);
  ev("meter_complaint", "later", 1, [{ fx: { fame: -0.06 } }]);
  ev("granny_jam", "later", 1, [{ fx: { en: 20, k: 2 } }]);
  ev("package_police", "later", 1, [{ fx: { k: 5, m: -100 } }, { p: 0.5, ok: { k: -2 }, no: { m: -500, fame: -0.1 } }]);
  ev("paparazzi", "later", 1, [{ fx: { fame: -0.05 } }]);
  ev("hospital_thanks", "later", 1, [{ fx: { m: 150, fame: 0.04, xp: 20 } }]);
  ev("viral", "later", 1, [{ p: 0.6, ok: { fame: 0.08, xp: 40 }, no: { fame: -0.03 } }]);
  ev("bride_after", "later", 1, [{ fx: { m: 400, xp: 30 } }]);
  ev("debt_return", "later", 1, [{ fx: { m: 80, k: 2 } }]);
  ev("accident_thanks", "later", 1, [{ fx: { m: 250, fame: 0.05, xp: 25 } }]);
  ev("hitch_card", "later", 1, [{ fx: { pc: "far", xp: 15 } }]);
  ev("wallet_reward", "later", 1, [{ fx: { m: 120, k: 2 } }]);
  ev("owner_call", "later", 1, [{ fx: { m: 80, k: 1 } }, { fx: { k: 5, xp: 20 } }]);

  // — Сезонные (по реальной дате) —
  ev("ny_santa", "ride", 2.5, [{ fx: { tip: 0.8, r: 2 } }, { fx: { r: 1, item: "gift" } }], (s, r) => !!r && s.season === "newyear");
  ev("ny_midnight", "road", 3, [{ fx: { time: 5, pc: 1, en: 10 } }, { fx: { r: 0 } }], (s) => s.season === "newyear" && s.minute < 150);
  ev("halloween_costume", "ride", 2.5, [{ fx: { r: 1.5, tip: 0.3 } }, { fx: { r: 0 } }], (s, r) => !!r && s.season === "halloween");

  // ───────── Эпизоды сюжетов: id `${arc}_${n}`, n = 1..eps ─────────
  const arc = (id, n, o) => E.push({ id: `${id}_${n}`, cat: "arc", arc: id, n, w: 1, o, when: null });
  // Феликс — старый джазмен
  arc("felix", 1, [{ fx: { r: 1.5, arc: ["felix", 1] } }, { fx: { r: 0.5, arc: ["felix", 1] } }]);
  arc("felix", 2, [{ fx: { mf: -1, k: 5, arc: ["felix", 2] } }, { fx: { r: 0, arc: ["felix", 2], flag: "felix_paid" } }]);
  arc("felix", 3, [{ fx: { time: 30, en: 15, xp: 30, pc: 1, arc: ["felix", 3] } }, { fx: { arc: ["felix", 3] } }]);
  arc("felix", 4, [{ fx: { fame: 0.1, xp: 80, arc: ["felix", 4] } }]);
  // Вера — ночная медсестра
  arc("vera", 1, [{ fx: { r: 1.5, arc: ["vera", 1] } }, { fx: { r: 1, en: 3, arc: ["vera", 1] } }]);
  arc("vera", 2, [{ fx: { mf: -0.3, k: 3, arc: ["vera", 2], flag: "vera_regular" } }, { fx: { arc: ["vera", 2] } }]);
  arc("vera", 3, [{ fx: { en: 40, arc: ["vera", 3] } }]);
  arc("vera", 4, [{ fx: { item: "scarf_gift", xp: 60, k: 3, arc: ["vera", 4] } }]);
  // Тим — подросток, сбежавший из дома
  arc("tim", 1, [{ fx: { k: 6, arc: ["tim", 1], flag: "tim_home" } }, { fx: { k: -2, arc: ["tim", 1] } }, { fx: { k: 3, arc: ["tim", 1], flag: "tim_police" } }]);
  arc("tim", 2, [{ fx: { r: 1.5, xp: 20, arc: ["tim", 2] } }, { fx: { r: 0.5, arc: ["tim", 2] } }]);
  arc("tim", 3, [{ fx: { mf: -1, k: 4, arc: ["tim", 3] } }, { fx: { arc: ["tim", 3] } }]);
  arc("tim", 4, [{ fx: { m: 300, xp: 80, k: 4, arc: ["tim", 4] } }]);
  // Ирма — писательница
  arc("irma", 1, [{ fx: { r: 1.5, xp: 15, arc: ["irma", 1] } }, { fx: { r: 0.5, arc: ["irma", 1] } }]);
  arc("irma", 2, [{ fx: { xp: 20, arc: ["irma", 2] } }, { fx: { arc: ["irma", 2] } }]);
  arc("irma", 3, [{ fx: { time: 15, k: 2, arc: ["irma", 3] } }, { fx: { arc: ["irma", 3] } }]);
  arc("irma", 4, [{ fx: { fame: 0.12, item: "book", xp: 100, arc: ["irma", 4] } }]);
  // Женщина в красном — тайна Маяка
  arc("red", 1, [{ fx: { item: "coin", arc: ["red", 1] } }, { fx: { arc: ["red", 1], k: 1 } }]);
  arc("red", 2, [{ fx: { time: 10, arc: ["red", 2] } }, { fx: { arc: ["red", 2] } }]);
  arc("red", 3, [{ fx: { flag: "lighthouse_map", arc: ["red", 3], xp: 50 } }]);
  arc("red", 4, [{ fx: { pc: "lighthouse", xp: 150, arc: ["red", 4] } }]);
  // Борис — таксист-ветеран (встречается на стоянке)
  arc("boris", 1, [{ fx: { sp: 1, arc: ["boris", 1] } }, { fx: { en: 5, arc: ["boris", 1] } }]);
  arc("boris", 2, [{ fx: { m: -300, k: 6, arc: ["boris", 2], flag: "boris_lent" } }, { fx: { arc: ["boris", 2] } }]);
  arc("boris", 3, [{ fx: { time: 20, en: 10, xp: 40, arc: ["boris", 3] } }]);
  arc("boris", 4, [{ fx: { flag: "lucky_charm", sp: 1, arc: ["boris", 4] } }]);
  // Уголёк — уличный котёнок
  arc("coal", 1, [{ fx: { m: -3, k: 3, arc: ["coal", 1] } }, { fx: { arc: ["coal", 1] } }]);
  arc("coal", 2, [{ fx: { m: -3, k: 3, arc: ["coal", 2] } }, { fx: { arc: ["coal", 2] } }]);
  arc("coal", 3, [{ fx: { arc: ["coal", 3], en: 6 } }]);
  arc("coal", 4, [{ fx: { flag: "cat", arc: ["coal", 4], k: 5 } }, { fx: { arc: ["coal", 4] } }]);
  // Анна и Марк — от первого свидания до свадьбы
  arc("annamark", 1, [{ fx: { r: 1.5, arc: ["annamark", 1] } }, { fx: { r: 1, arc: ["annamark", 1] } }, { fx: { r: 0, arc: ["annamark", 1] } }]);
  arc("annamark", 2, [{ p: 0.6, sk: "charm", ok: { r: 2, arc: ["annamark", 2] }, no: { r: 0, arc: ["annamark", 2] } }, { fx: { arc: ["annamark", 2] } }]);
  arc("annamark", 3, [{ fx: { time: 12, tip: 1.2, pc: 1, arc: ["annamark", 3] } }, { fx: { arc: ["annamark", 3] } }]);
  arc("annamark", 4, [{ fx: { m: 250, en: 20, xp: 80, arc: ["annamark", 4] } }]);

  NF.EV = Object.fromEntries(E.map((e) => [e.id, e]));
})();
