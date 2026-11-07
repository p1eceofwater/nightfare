/* Ночной тариф — пиксельная графика. Всё рисуется кодом, без картинок:
   вид из лобового стекла, районы, погода, приборная панель, зеркало с пассажиром, портреты, машины. */
(function () {
  "use strict";
  const NF = (window.NF = window.NF || {});
  const W = 256, H = 160, HZ = 100; // ширина, высота, линия горизонта
  NF.ART = { W, H };

  function rng(seed) {
    let a = seed | 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hx = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const toHex = (a) => "#" + a.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
  const mix = (a, b, t) => { const A = hx(a), B = hx(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); };
  const shade = (c, k) => toHex(hx(c).map((v) => v * k));
  NF.mixColor = mix;

  // ───────── пиксельный шрифт для таксометра (3×5) ─────────
  const FONT = {
    0: "111101101101111", 1: "010110010010111", 2: "111001111100111", 3: "111001111001111", 4: "101101111001001",
    5: "111100111001111", 6: "111100111101111", 7: "111001010010010", 8: "111101111101111", 9: "111101111001111",
    $: "011110010011110", ":": "000010000010000", ".": "000000000000010", "-": "000000111000000", " ": "000000000000000",
    k: "100101110101101", M: "101111111101101", B: "110101110101110",
  };
  function pixText(ctx, str, x, y, col) {
    ctx.fillStyle = col;
    for (const ch of String(str)) {
      const g = FONT[ch] || FONT[" "];
      for (let i = 0; i < 15; i++) if (g[i] === "1") ctx.fillRect(x + (i % 3), y + Math.floor(i / 3), 1, 1);
      x += 4;
    }
  }
  NF.pixText = pixText;
  const short = (n) => (n >= 1e9 ? (n / 1e9).toFixed(1) + "B" : n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e4 ? Math.round(n / 1e3) + "k" : String(Math.round(n)));

  // ───────── горизонт районов (кэш) ─────────
  const skyCache = {};
  function building(ctx, r, x, w, h, base, win, litP) {
    const top = HZ - h;
    ctx.fillStyle = base;
    ctx.fillRect(x, top, w, h);
    if (r() < 0.3) { ctx.fillRect(x + 1, top - 2, w - 2, 2); }
    if (r() < 0.2 && w > 6) { ctx.fillRect(x + Math.floor(w / 2), top - 6, 1, 6); }
    const lit = [];
    for (let yy = top + 2; yy < HZ - 2; yy += 3)
      for (let xx = x + 1; xx < x + w - 1; xx += 2) if (r() < litP) lit.push([xx, yy]);
    return lit;
  }
  function buildSkyline(id) {
    const d = NF.D[id];
    const c = document.createElement("canvas");
    c.width = W; c.height = HZ;
    const ctx = c.getContext("2d");
    const r = rng(NF.hashStr ? NF.hashStr(id) : 7);
    const far = shade(d.sky[1], 0.55), mid = shade(d.sky[0], 0.6);
    const lits = [];
    // дальний план
    for (let x = -4; x < W; ) {
      const w = 6 + Math.floor(r() * 10), h = 18 + Math.floor(r() * 28);
      lits.push(...building(ctx, r, x, w, h, far, d.glow, 0.12));
      x += w + Math.floor(r() * 3);
    }
    landmark(ctx, d, r);
    // ближний план
    const low = id === "hills" || id === "lighthouse" || id === "sleepy" ? 0.55 : 1;
    for (let x = -6; x < W; ) {
      const w = 10 + Math.floor(r() * 16), h = Math.floor((10 + r() * 34) * low);
      if (r() < 0.25) { x += w; continue; }
      lits.push(...building(ctx, r, x, w, h, mid, d.glow, 0.22));
      x += w + 2 + Math.floor(r() * 6);
    }
    return (skyCache[id] = { c, lits, seed: r() * 1e6 });
  }
  function landmark(ctx, d, r) {
    const c = shade(d.sky[1], 0.45), g = d.glow;
    ctx.fillStyle = c;
    switch (d.mark) {
      case "blocks":
        for (let i = 0; i < 3; i++) ctx.fillRect(40 + i * 70, HZ - 50, 26, 50);
        break;
      case "domes":
        for (const [x, rr] of [[60, 10], [150, 14], [205, 8]]) {
          ctx.beginPath(); ctx.arc(x, HZ - 30, rr, Math.PI, 0); ctx.fill();
          ctx.fillRect(x - rr, HZ - 30, rr * 2, 30); ctx.fillRect(x, HZ - 30 - rr - 6, 1, 6);
          ctx.fillStyle = g; ctx.fillRect(x, HZ - 30 - rr - 7, 1, 1); ctx.fillStyle = c;
        }
        break;
      case "bridge":
        ctx.fillRect(0, HZ - 22, W, 3);
        for (const x of [70, 186]) ctx.fillRect(x, HZ - 52, 4, 52);
        ctx.strokeStyle = c; ctx.beginPath();
        for (let x = 0; x <= W; x += 2) {
          const y = HZ - 22 - Math.max(0, 28 - Math.abs(((x - 72) % 116) - 58) * 0.48);
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.fillStyle = g;
        for (let x = 4; x < W; x += 12) ctx.fillRect(x, HZ - 23, 1, 1);
        break;
      case "towers":
        ctx.fillRect(110, HZ - 82, 14, 82); ctx.fillRect(116, HZ - 94, 2, 12);
        ctx.fillRect(160, HZ - 66, 12, 66);
        ctx.fillStyle = "#ff4a4a"; ctx.fillRect(116, HZ - 95, 2, 1);
        break;
      case "neon":
        for (let i = 0; i < 4; i++) ctx.fillRect(30 + i * 60, HZ - 60 - (i % 2) * 10, 18, 70);
        break;
      case "cranes":
        for (const x of [50, 140, 210]) {
          ctx.fillRect(x, HZ - 64, 3, 64); ctx.fillRect(x - 16, HZ - 64, 46, 2); ctx.fillRect(x + 28, HZ - 62, 1, 20);
        }
        break;
      case "airport":
        ctx.fillRect(170, HZ - 58, 4, 58); ctx.fillRect(164, HZ - 66, 16, 8);
        ctx.fillRect(20, HZ - 14, 120, 14);
        break;
      case "glass":
        for (const [x, w, h] of [[60, 18, 92], [90, 14, 76], [150, 20, 98], [200, 16, 70]]) ctx.fillRect(x, HZ - h, w, h);
        break;
      case "villas":
        ctx.beginPath(); ctx.moveTo(0, HZ); ctx.quadraticCurveTo(128, HZ - 70, W, HZ - 10); ctx.lineTo(W, HZ); ctx.fill();
        break;
      case "lighthouse":
        ctx.beginPath(); ctx.moveTo(150, HZ); ctx.quadraticCurveTo(190, HZ - 40, 250, HZ - 30); ctx.lineTo(W, HZ); ctx.fill();
        ctx.fillRect(196, HZ - 78, 8, 48); ctx.fillRect(194, HZ - 82, 12, 4);
        ctx.fillStyle = "#e8e2d0"; for (let y = HZ - 72; y < HZ - 34; y += 10) ctx.fillRect(196, y, 8, 4);
        break;
    }
  }

  // ───────── частицы погоды и лобовое стекло ─────────
  const P = { drops: [], streaks: [], flakes: [], glass: [], flash: 0, wiper: 0, wiperDir: 0, plane: -40, t: 0 };
  for (let i = 0; i < 160; i++) P.streaks.push([Math.random() * W, Math.random() * H, 0.5 + Math.random()]);
  for (let i = 0; i < 120; i++) P.flakes.push([Math.random() * W, Math.random() * H, 0.3 + Math.random() * 0.7, Math.random() * 6]);

  // ───────── главная сцена ─────────
  // st: { district, min (0..480), weather, moving (0..1), ride (portrait info) , cat, season, meter, station, interior, reduce, freshener }
  NF.drawScene = function (ctx, st, dt) {
    P.t += dt;
    const d = NF.D[st.district] || NF.D.sleepy;
    const sky = skyCache[st.district] || buildSkyline(st.district);
    const t = Math.max(0, Math.min(1, (st.min || 0) / 480));
    const w = st.weather || "clear";
    ctx.imageSmoothingEnabled = false;

    // небо: сумерки → ночь → рассвет
    let top = d.sky[0], bot = d.sky[1];
    if (t < 0.12) { const k = 1 - t / 0.12; top = mix(top, "#3a2a5c", k * 0.6); bot = mix(bot, "#d9775a", k * 0.55); }
    if (t > 0.82) { const k = (t - 0.82) / 0.18; top = mix(top, "#5d6fa8", k * 0.7); bot = mix(bot, "#f2a07b", k * 0.75); }
    if (w === "fog") { top = mix(top, "#5a6070", 0.35); bot = mix(bot, "#7a808c", 0.45); }
    if (w === "storm") { top = mix(top, "#0a0c14", 0.4); bot = mix(bot, "#1c2030", 0.4); }
    const g = ctx.createLinearGradient(0, 0, 0, HZ);
    g.addColorStop(0, top); g.addColorStop(1, bot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, HZ);

    // звёзды и луна при ясной погоде
    if (w === "clear" && t < 0.9) {
      const r = rng(42);
      for (let i = 0; i < 60; i++) {
        const x = r() * W, y = r() * 60, tw = Math.sin(P.t * (1 + r() * 2) + i) > 0.6;
        ctx.fillStyle = tw ? "#ffffff" : "#9aa3c7";
        ctx.fillRect(x | 0, y | 0, 1, 1);
      }
      const mx = 30 + t * 180, my = 22 + Math.sin(t * Math.PI) * -8;
      ctx.fillStyle = "#f4ecd0"; ctx.beginPath(); ctx.arc(mx, my, 6, 0, 7); ctx.fill();
      ctx.fillStyle = mix(top, "#f4ecd0", 0.15); ctx.beginPath(); ctx.arc(mx + 3, my - 2, 5, 0, 7); ctx.fill();
    }
    if (t > 0.86) { // солнце встаёт
      const k = (t - 0.86) / 0.14;
      const sg = ctx.createRadialGradient(200, HZ, 2, 200, HZ, 70);
      sg.addColorStop(0, `rgba(255,190,120,${0.55 * k})`); sg.addColorStop(1, "rgba(255,190,120,0)");
      ctx.fillStyle = sg; ctx.fillRect(0, 0, W, HZ);
    }
    // самолёт над аэропортом
    if (st.district === "airport" || (st.district === "business" && P.t % 40 < 20)) {
      P.plane += dt * 8; if (P.plane > W + 40) P.plane = -40;
      const py = 30 - P.plane * 0.05;
      ctx.fillStyle = "#2a3346"; ctx.fillRect(P.plane | 0, py | 0, 7, 1);
      if (Math.floor(P.t * 2) % 2) { ctx.fillStyle = "#ff5050"; ctx.fillRect((P.plane - 1) | 0, py | 0, 1, 1); }
      ctx.fillStyle = "#ffffff"; ctx.fillRect((P.plane + 7) | 0, py | 0, 1, 1);
    }

    // горизонт с окнами
    ctx.drawImage(sky.c, 0, 0);
    const dawnDim = t > 0.85 ? 1 - (t - 0.85) / 0.2 : 1;
    ctx.fillStyle = d.glow;
    ctx.globalAlpha = 0.85 * dawnDim;
    const lits = sky.lits, n = lits.length;
    const phase = Math.floor(P.t / 3);
    for (let i = 0; i < n; i++) {
      // окна иногда гаснут и зажигаются; к утру их меньше
      if (((i * 7919 + phase * (i % 13 === 0 ? 1 : 0)) % 100) / 100 > 0.92 - t * 0.35) continue;
      ctx.fillRect(lits[i][0], lits[i][1], 1, 1);
    }
    ctx.globalAlpha = 1;
    districtFx(ctx, st, d);

    // дорога в перспективе
    const vx = W / 2;
    // земля по сторонам дороги (тротуары, газоны) — перекрашивается каждый кадр
    const gg = ctx.createLinearGradient(0, HZ, 0, H);
    gg.addColorStop(0, w === "snow" ? "#5a6070" : "#10121a"); gg.addColorStop(1, w === "snow" ? "#b9bfcc" : "#1a1c26");
    ctx.fillStyle = gg; ctx.fillRect(0, HZ, W, H - HZ);
    const rg = ctx.createLinearGradient(0, HZ, 0, H);
    rg.addColorStop(0, "#1b1d26"); rg.addColorStop(1, w === "snow" ? "#9aa0ad" : "#2b2e3a");
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.moveTo(vx - 8, HZ); ctx.lineTo(vx + 8, HZ); ctx.lineTo(W + 60, H); ctx.lineTo(-60, H); ctx.fill();
    ctx.fillStyle = "#11131a"; ctx.fillRect(0, HZ, W, 1);
    if (w === "rain" || w === "storm") { // мокрый асфальт отражает огни
      ctx.globalAlpha = 0.18; ctx.fillStyle = d.glow;
      for (let i = 0; i < 18; i++) ctx.fillRect((i * 37 + 11) % W, HZ + 4 + ((i * 13) % 24), 1, 3 + (i % 4));
      ctx.globalAlpha = 1;
    }
    const spd = st.moving || 0;
    P.road = ((P.road || 0) + dt * spd * 0.9) % 1;
    for (let i = 0; i < 6; i++) { // разметка
      const p = (i / 6 + P.road) % 1, y = HZ + p * p * 60, wd = 1 + p * 4, hgt = 1 + p * 6;
      ctx.fillStyle = w === "snow" ? "#c9ccd6" : "#d8cf9a";
      ctx.fillRect(vx - wd / 2, y, wd, hgt);
    }
    for (let i = 0; i < 4; i++) { // фонари
      const p = (i / 4 + P.road) % 1, q = p * p;
      for (const side of [-1, 1]) {
        const x = vx + side * (12 + q * 170), ytop = HZ - 4 - q * 70, hh = 4 + q * 74;
        ctx.fillStyle = "#0c0d12"; ctx.fillRect(x, ytop, Math.max(1, q * 3), hh);
        ctx.fillRect(x - side * q * 10, ytop, q * 10 + 1, Math.max(1, q * 2));
        const lx = x - side * q * 10;
        const lg = ctx.createRadialGradient(lx, ytop + 2, 0, lx, ytop + 2, 6 + q * 22);
        lg.addColorStop(0, "rgba(255,214,140,0.55)"); lg.addColorStop(1, "rgba(255,214,140,0)");
        ctx.fillStyle = lg; ctx.fillRect(lx - 30, ytop - 28, 60, 60);
      }
    }
    // машина впереди
    if (spd > 0.2) {
      const sway = Math.sin(P.t * 0.4) * 6;
      ctx.fillStyle = "#14161e"; ctx.fillRect(vx - 7 + sway, HZ + 8, 14, 6);
      ctx.fillStyle = "#ff3b3b"; ctx.fillRect(vx - 6 + sway, HZ + 10, 2, 1); ctx.fillRect(vx + 4 + sway, HZ + 10, 2, 1);
      ctx.globalAlpha = 0.25; ctx.fillRect(vx - 7 + sway, HZ + 14, 14, 3); ctx.globalAlpha = 1;
    }

    weather(ctx, st, dt, w, top);
    if (st.interior !== false) interior(ctx, st, dt, w);
  };

  function districtFx(ctx, st, d) {
    const t = P.t;
    if (d.mark === "neon") {
      const cols = ["#ff5fa2", "#5ff0ff", "#ffe066", "#b388ff"];
      for (let i = 0; i < 6; i++) {
        if (Math.sin(t * 3 + i * 9) > 0.93) continue; // неон мерцает
        ctx.fillStyle = cols[i % 4];
        const x = 20 + i * 40, y = 46 + (i % 3) * 9;
        ctx.globalAlpha = 0.9; ctx.fillRect(x, y, 10 + (i % 2) * 6, 2);
        ctx.globalAlpha = 0.25; ctx.fillRect(x - 2, y - 2, 14 + (i % 2) * 6, 6);
      }
      ctx.globalAlpha = 1;
    } else if (d.mark === "lighthouse") {
      const a = t * 0.9, cx = 200, cy = HZ - 80;
      ctx.fillStyle = "#fff6c8"; ctx.fillRect(198, HZ - 81, 4, 3);
      ctx.globalAlpha = 0.18 + 0.1 * Math.max(0, Math.cos(a));
      ctx.fillStyle = "#fff1b8";
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * 260, cy + Math.sin(a) * 18 - 6); ctx.lineTo(cx + Math.cos(a) * 260, cy + Math.sin(a) * 18 + 10);
      ctx.fill(); ctx.globalAlpha = 1;
    } else if (d.mark === "towers" || d.mark === "glass" || d.mark === "airport" || d.mark === "cranes") {
      if (Math.floor(t * 1.2) % 2) { ctx.fillStyle = "#ff4a4a"; ctx.fillRect(d.mark === "airport" ? 171 : 117, HZ - (d.mark === "airport" ? 67 : 95), 1, 1); }
      if (d.mark === "cranes") { ctx.fillStyle = "#ffb35c"; for (const x of [51, 141, 211]) if ((Math.floor(t) + x) % 3) ctx.fillRect(x, HZ - 66, 1, 1); }
    } else if (d.mark === "villas") {
      const r = rng(9);
      for (let i = 0; i < 14; i++) {
        const x = 10 + r() * 236, y = HZ - 6 - Math.sin((x / W) * Math.PI) * 52 * (0.6 + r() * 0.4);
        ctx.fillStyle = "#151a2a"; ctx.fillRect(x, y, 7, 5);
        ctx.fillStyle = "#ffe2a8"; if (Math.sin(t * 0.3 + i) > -0.6) ctx.fillRect(x + 2, y + 2, 1, 1);
      }
    }
  }

  function weather(ctx, st, dt, w, top) {
    const outsideH = 128;
    if (w === "rain" || w === "storm") {
      const heavy = w === "storm" ? 1 : 0.55;
      ctx.strokeStyle = "rgba(170,190,230,0.35)"; ctx.lineWidth = 1; ctx.beginPath();
      const cnt = Math.floor(P.streaks.length * heavy);
      for (let i = 0; i < cnt; i++) {
        const s = P.streaks[i];
        if (!st.reduce) { s[1] += dt * 160 * s[2]; s[0] -= dt * 30 * s[2]; }
        if (s[1] > outsideH) { s[1] = -6; s[0] = Math.random() * (W + 30); }
        ctx.moveTo(s[0], s[1]); ctx.lineTo(s[0] - 1.5, s[1] + 5);
      }
      ctx.stroke();
      if (w === "storm" && !st.reduce) {
        if (Math.random() < dt * 0.12) P.flash = 1;
        if (P.flash > 0) { ctx.fillStyle = `rgba(220,230,255,${P.flash * 0.45})`; ctx.fillRect(0, 0, W, outsideH); P.flash -= dt * 2.5; }
      }
      // капли на стекле
      if (P.glass.length < 70 * heavy && Math.random() < dt * 30 * heavy) P.glass.push([Math.random() * W, Math.random() * 120, 0, 1 + Math.random()]);
      for (let i = P.glass.length - 1; i >= 0; i--) {
        const g = P.glass[i];
        g[2] += dt;
        if (g[3] > 1.6) g[1] += dt * 12;
        ctx.fillStyle = "rgba(200,215,245,0.5)"; ctx.fillRect(g[0], g[1], g[3] > 1.5 ? 2 : 1, g[3] > 1.5 ? 2 : 1);
        ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.fillRect(g[0], g[1], 1, 1);
        if (g[2] > 9 || g[1] > 125) P.glass.splice(i, 1);
      }
      // дворники
      if (!st.reduce) {
        P.wiper += dt * (w === "storm" ? 1.4 : 0.8);
        const a = Math.abs(Math.sin(P.wiper * Math.PI));
        const ang = Math.PI * (1.02 - a * 0.62);
        for (const ox of [70, 170]) {
          const x2 = ox + Math.cos(ang) * 92, y2 = 128 + Math.sin(ang) * 92;
          ctx.strokeStyle = "#0b0c10"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ox, 128); ctx.lineTo(x2, y2); ctx.stroke();
          P.glass = P.glass.filter((g) => Math.abs((g[1] - 128) * Math.cos(ang) - (g[0] - ox) * Math.sin(ang)) > 3);
        }
        ctx.lineWidth = 1;
      }
    } else if (w === "snow") {
      for (const f of P.flakes) {
        if (!st.reduce) { f[1] += dt * 14 * f[2]; f[0] += Math.sin(P.t + f[3]) * dt * 6; }
        if (f[1] > outsideH) { f[1] = -2; f[0] = Math.random() * W; }
        ctx.fillStyle = f[2] > 0.8 ? "#ffffff" : "#c9d3ea";
        ctx.fillRect(f[0] | 0, f[1] | 0, f[2] > 0.85 ? 2 : 1, f[2] > 0.85 ? 2 : 1);
      }
    } else if (w === "fog") {
      for (let i = 0; i < 4; i++) {
        const y = 60 + i * 16 + Math.sin(P.t * 0.3 + i) * 4;
        const fg = ctx.createLinearGradient(0, y - 14, 0, y + 14);
        fg.addColorStop(0, "rgba(160,168,184,0)"); fg.addColorStop(0.5, "rgba(160,168,184,0.32)"); fg.addColorStop(1, "rgba(160,168,184,0)");
        ctx.fillStyle = fg; ctx.fillRect(0, y - 14, W, 28);
      }
    }
  }

  // ───────── салон ─────────
  function interior(ctx, st, dt, w) {
    const dark = "#0b0c11", dash = "#151722", edge = "#232637";
    // стойки и крыша
    ctx.fillStyle = dark;
    ctx.fillRect(0, 0, W, 7);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(22, 0); ctx.lineTo(4, 128); ctx.lineTo(0, 128); ctx.fill();
    ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(W - 22, 0); ctx.lineTo(W - 4, 128); ctx.lineTo(W, 128); ctx.fill();
    // зеркало заднего вида
    const mx = 104, my = 7;
    ctx.fillStyle = dark; ctx.fillRect(127, 0, 2, 8);
    ctx.fillStyle = "#2c3044"; ctx.fillRect(mx - 1, my - 1, 50, 18);
    ctx.fillStyle = "#1a1d2b"; ctx.fillRect(mx, my, 48, 16);
    if (st.ride) {
      ctx.save(); ctx.beginPath(); ctx.rect(mx, my, 48, 16); ctx.clip();
      ctx.fillStyle = "#232638"; ctx.fillRect(mx, my, 48, 16);
      NF.drawPortrait(ctx, mx + 8, my - 6, 2, st.ride.arch, st.ride.seed, st.ride.g, { sleep: st.ride.sleep });
      ctx.restore();
    }
    ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(mx, my, 48, 2);
    // ароматизатор-ёлочка качается
    const sw = Math.sin(P.t * 1.6) * (st.moving ? 2 : 0.6);
    ctx.fillStyle = "#3a3f55"; ctx.fillRect(128, my + 16, 1, 6);
    ctx.fillStyle = st.season === "halloween" ? "#ff8a2a" : "#3fbf7f";
    ctx.beginPath(); ctx.moveTo(128 + sw, my + 21); ctx.lineTo(124 + sw, my + 30); ctx.lineTo(133 + sw, my + 30); ctx.fill();
    // приборная панель
    ctx.fillStyle = dash;
    ctx.beginPath(); ctx.moveTo(0, 124); ctx.quadraticCurveTo(128, 116, W, 124); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
    ctx.fillStyle = edge; ctx.fillRect(0, 128, W, 1);
    // руль
    ctx.strokeStyle = "#0d0e14"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(62, 172, 40, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
    ctx.strokeStyle = "#262a3a"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(62, 172, 42, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    // таксометр
    ctx.fillStyle = "#07080c"; ctx.fillRect(112, 134, 46, 14);
    ctx.fillStyle = "#1e2a1e"; ctx.fillRect(113, 135, 44, 12);
    const meter = st.meter != null ? "$" + short(st.meter) : "--";
    pixText(ctx, meter, 115, 138, st.meter != null ? "#7dff9a" : "#2f5a3a");
    // радио
    ctx.fillStyle = "#07080c"; ctx.fillRect(164, 136, 40, 10);
    ctx.fillStyle = st.radioOn ? "#ffb347" : "#3a2c1a";
    const bars = st.radioOn ? 6 : 0;
    for (let i = 0; i < 9; i++) {
      const hh = st.radioOn ? 1 + Math.floor(Math.abs(Math.sin(P.t * (2 + i) + i)) * bars) : 1;
      ctx.fillRect(166 + i * 4, 144 - hh, 2, hh);
    }
    // часы
    pixText(ctx, NF.clock ? NF.clock(st.min || 0) : "22:00", 214, 138, "#ff9d5c");
    // кот Уголёк спит на панели
    if (st.cat) catSprite(ctx, 224, 118, P.t);
    // сезонные украшения
    if (st.season === "halloween") {
      ctx.fillStyle = "#ff8a2a"; ctx.fillRect(18, 120, 8, 6); ctx.fillRect(19, 119, 6, 8);
      ctx.fillStyle = "#3a7a2a"; ctx.fillRect(21, 117, 2, 2);
      ctx.fillStyle = "#ffe066"; ctx.fillRect(20, 121, 1, 1); ctx.fillRect(23, 121, 1, 1); ctx.fillRect(20, 124, 4, 1);
    }
    if (st.season === "newyear") {
      const cols = ["#ff5f5f", "#ffe066", "#5ff0ff", "#7dff9a"];
      for (let i = 0; i < 24; i++) {
        ctx.fillStyle = cols[(i + Math.floor(P.t * 2)) % 4];
        ctx.fillRect(10 + i * 10, 8 + Math.round(Math.sin(i * 0.9) * 1.5), 1, 1);
      }
    }
  }
  function catSprite(ctx, x, y, t) {
    ctx.fillStyle = "#0a0a0d";
    ctx.fillRect(x, y + 2, 12, 5); ctx.fillRect(x + 9, y, 5, 5); ctx.fillRect(x + 9, y - 1, 1, 1); ctx.fillRect(x + 13, y - 1, 1, 1);
    ctx.fillRect(x - 3, y + 5, 4, 2);
    ctx.fillStyle = "#f2c66d";
    if (Math.sin(t * 0.5) > 0.95) { ctx.fillRect(x + 10, y + 2, 1, 1); ctx.fillRect(x + 12, y + 2, 1, 1); }
    // дыхание
    if (Math.sin(t * 1.3) > 0) { ctx.fillStyle = "#0a0a0d"; ctx.fillRect(x + 2, y + 1, 6, 1); }
  }

  // ───────── портреты пассажиров (16×16) ─────────
  const SKIN = ["#f6d7bd", "#eec09a", "#d9a07a", "#b9794f", "#8a5636", "#5e3a24"];
  const HAIR = ["#1b1b1f", "#3b2416", "#6b4423", "#b5813e", "#e0c27a", "#a83a2a", "#5a5a66"];
  const CLOTH = {
    office: "#3b4a6b", student: "#6b8f3b", nurse: "#7fc8c0", party: "#c03a7a", tourist: "#e2a23b", boss: "#22242e", granny: "#8a5a8a",
    musician: "#2a2a2a", couple: "#b04050", worker: "#d87a2a", chef: "#f0f0f0", coder: "#3a3a4a", pilot: "#1e2c4a", sailor: "#1e3a6a",
    writer: "#6a4a3a", streamer: "#7a3ad8", athlete: "#d83a3a", guard: "#2a3a2a", mom: "#c88aa0", star: "#111111", mystery: "#7a1020",
    artist: "#3a6a8a", doctor: "#e8eef2", bride: "#ffffff", cat: "#0a0a0d",
  };
  NF.drawPortrait = function (ctx, x, y, s, arch, seed, g, opt = {}) {
    const r = rng(seed || 1);
    const px = (cx, cy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x + cx * s, y + cy * s, w * s, h * s); };
    if (arch === "cat") {
      px(3, 7, 10, 7, "#0a0a0d"); px(3, 4, 3, 4, "#0a0a0d"); px(10, 4, 3, 4, "#0a0a0d");
      px(5, 9, 2, 2, "#f2c66d"); px(9, 9, 2, 2, "#f2c66d"); px(7, 12, 2, 1, "#ff9db0");
      return;
    }
    const skin = SKIN[Math.floor(r() * SKIN.length)];
    let hair = HAIR[Math.floor(r() * (HAIR.length - 1))];
    if (arch === "granny" || (arch === "sailor" && r() < 0.5)) hair = "#c9c9d2";
    if (arch === "mystery") hair = "#1b1b1f";
    const f = g === "f";
    const cloth = CLOTH[arch] || "#445";
    const longHair = f ? r() < 0.75 : r() < 0.1;
    // плечи
    px(2, 14, 12, 2, cloth); px(3, 13, 10, 1, cloth);
    if (arch === "office" || arch === "boss" || arch === "pilot") px(7, 13, 2, 3, arch === "boss" ? "#8a1a2a" : "#e8e8e8");
    if (arch === "doctor" || arch === "nurse") px(7, 14, 2, 2, "#3a8a8a");
    // волосы сзади
    if (longHair) px(3, 4, 10, f && r() < 0.5 ? 10 : 8, hair);
    // голова
    px(4, 4, 8, 9, skin); px(5, 3, 6, 1, skin); px(5, 13, 6, 1, skin);
    // волосы сверху
    const style = Math.floor(r() * 3);
    px(4, 2, 8, 2, hair); px(4, 4, 1, style === 0 ? 2 : 3, hair); px(11, 4, 1, style === 2 ? 3 : 2, hair);
    if (style === 1) px(5, 4, 3, 1, hair);
    if (arch === "granny") { px(6, 1, 4, 2, hair); }
    // глаза
    if (opt.sleep) { px(5, 8, 2, 1, "#2a1a14"); px(9, 8, 2, 1, "#2a1a14"); }
    else { px(5, 7, 2, 2, "#ffffff"); px(9, 7, 2, 2, "#ffffff"); px(6, 7, 1, 2, "#1a1a22"); px(10, 7, 1, 2, "#1a1a22"); }
    // румянец и рот
    if (arch === "party" || arch === "couple" || arch === "bride") { px(4, 10, 1, 1, "#e88a8a"); px(11, 10, 1, 1, "#e88a8a"); }
    px(7, 11, 2, 1, arch === "mystery" || arch === "star" ? "#b0102a" : "#8a4a3a");
    if (!f && r() < 0.3 && arch !== "student") px(5, 11, 6, 2, shade(hair, 0.9)); // борода
    // аксессуары
    switch (arch) {
      case "coder": case "writer": px(4, 7, 3, 2, "#99c"); px(9, 7, 3, 2, "#99c"); px(7, 7, 2, 1, "#99c"); px(5, 7, 1, 1, "#ccd"); break;
      case "star": px(4, 7, 8, 2, "#0a0a0a"); px(5, 7, 1, 1, "#556"); break;
      case "worker": px(3, 1, 10, 3, "#f2c94c"); px(3, 3, 11, 1, "#c9a23c"); break;
      case "guard": px(3, 1, 10, 3, "#22302a"); px(3, 3, 11, 1, "#111"); break;
      case "sailor": px(3, 1, 10, 2, "#f0f0f0"); px(3, 3, 10, 1, "#1e2c4a"); px(7, 1, 2, 1, "#f2c66d"); break;
      case "pilot": px(3, 1, 10, 2, "#1e2c4a"); px(3, 3, 10, 1, "#0a0a0a"); px(7, 1, 2, 1, "#f2c66d"); break;
      case "chef": px(4, -1, 8, 4, "#ffffff"); px(4, 3, 8, 1, "#ddd"); break;
      case "artist": px(3, 1, 9, 2, "#b0303a"); px(10, 0, 2, 1, "#b0303a"); break;
      case "streamer": case "musician": px(3, 3, 1, 6, "#222"); px(12, 3, 1, 6, "#222"); px(3, 2, 10, 1, "#222"); px(2, 7, 2, 3, arch === "streamer" ? "#7a3ad8" : "#444"); px(12, 7, 2, 3, arch === "streamer" ? "#7a3ad8" : "#444"); break;
      case "bride": px(2, 1, 12, 2, "#ffffff"); px(2, 3, 2, 10, "rgba(255,255,255,0.75)"); px(12, 3, 2, 10, "rgba(255,255,255,0.75)"); break;
      case "mystery": px(2, 2, 12, 1, "#7a1020"); px(4, 0, 8, 2, "#7a1020"); break;
      case "tourist": px(3, 1, 10, 2, "#e2a23b"); px(11, 3, 4, 1, "#e2a23b"); break;
      case "athlete": px(4, 3, 8, 1, "#d83a3a"); break;
      case "granny": px(2, 12, 12, 2, "#b07ab0"); break;
      case "party": if (r() < 0.5) { px(4, 0, 8, 1, "#ffe066"); px(7, -1, 2, 1, "#ff5fa2"); } break;
      case "student": px(3, 1, 10, 2, "#6b8f3b"); px(11, 3, 4, 1, "#6b8f3b"); break;
    }
  };

  // ───────── машины (вид сбоку, 64×24) ─────────
  const SHAPES = [
    { len: 46, h: 9, roof: [12, 34], rh: 7, box: 1 },
    { len: 40, h: 9, roof: [10, 30], rh: 8, box: 0 },
    { len: 48, h: 9, roof: [12, 38], rh: 8, box: 0 },
    { len: 50, h: 8, roof: [14, 38], rh: 8, box: 0, smooth: 1 },
    { len: 54, h: 8, roof: [16, 40], rh: 7, box: 0 },
    { len: 54, h: 8, roof: [12, 42], rh: 8, box: 0, smooth: 1 },
    { len: 58, h: 8, roof: [18, 44], rh: 7, box: 0 },
    { len: 62, h: 8, roof: [16, 50], rh: 7, box: 0, smooth: 1 },
  ];
  NF.drawCar = function (ctx, x, y, s, idx, color, t) {
    const sh = SHAPES[idx] || SHAPES[0];
    const px = (cx, cy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x + cx * s, y + cy * s, w * s, h * s); };
    const ox = Math.floor((64 - sh.len) / 2), base = 18;
    px(ox + 2, base + 4, sh.len - 4, 1, "rgba(0,0,0,0.35)");
    // кузов
    px(ox, base - sh.h, sh.len, sh.h, color);
    px(ox + 1, base - sh.h - 1, sh.len - 2, 1, color);
    px(ox, base - 2, sh.len, 2, shade(color, 0.7));
    // крыша и стёкла
    const [a, b] = sh.roof;
    px(ox + a, base - sh.h - sh.rh, b - a, sh.rh, color);
    if (sh.smooth) { px(ox + a - 2, base - sh.h - sh.rh + 3, 2, sh.rh - 3, color); px(ox + b, base - sh.h - sh.rh + 3, 3, sh.rh - 3, color); }
    else { px(ox + a - 1, base - sh.h - sh.rh + 2, 1, sh.rh - 2, color); px(ox + b, base - sh.h - sh.rh + 2, 1, sh.rh - 2, color); }
    const glass = "#9fc4e8";
    const mid = Math.floor((a + b) / 2);
    px(ox + a + 1, base - sh.h - sh.rh + 1, mid - a - 2, sh.rh - 2, glass);
    px(ox + mid + 1, base - sh.h - sh.rh + 1, b - mid - 2, sh.rh - 2, glass);
    px(ox + a + 1, base - sh.h - sh.rh + 1, 1, 1, "#e8f4ff");
    // шашечки такси
    const cx = ox + mid - 4;
    px(cx, base - sh.h - sh.rh - 3, 8, 3, "#f2c94c");
    for (let i = 0; i < 4; i++) px(cx + i * 2 + (i % 2), base - sh.h - sh.rh - 2, 1, 1, "#111");
    // фары и двери
    px(ox + sh.len - 2, base - sh.h + 2, 2, 2, "#fff3b0");
    px(ox, base - sh.h + 2, 1, 2, "#ff4040");
    px(ox + mid, base - sh.h + 1, 1, sh.h - 3, shade(color, 0.6));
    px(ox + a + 4, base - sh.h + 3, 3, 1, shade(color, 0.55));
    // колёса
    for (const wx of [ox + 7, ox + sh.len - 11]) {
      px(wx, base - 2, 6, 6, "#111");
      px(wx + 1, base - 1, 4, 4, "#2a2a2a");
      px(wx + 2, base, 2, 2, "#9a9aa8");
    }
  };

  // ───────── открытка района (для коллекций и карты) ─────────
  NF.drawPostcard = function (canvas, district, weatherKind, minute) {
    const ctx = canvas.getContext("2d");
    canvas.width = W; canvas.height = 128;
    NF.drawScene(ctx, { district, min: minute == null ? 200 : minute, weather: weatherKind || "clear", moving: 0, interior: false, reduce: true }, 0);
  };
})();
