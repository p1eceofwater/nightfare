/* Ночной тариф — звук. Музыка генерируется на лету (WebAudio), никаких файлов.
   Три станции: lo-fi, ночной джаз, дождь-эмбиент. Плюс шум дождя за окном и тихие звуки интерфейса. */
(function () {
  "use strict";
  const NF = (window.NF = window.NF || {});
  const AU = (NF.audio = { ctx: null, on: false, station: "lofi", radio: true, vol: { music: 0.6, rain: 0.6, sfx: 0.7 }, weather: "rain" });
  let master, musicBus, rainBus, sfxBus, rainNoise, rainFilter, crackle, timer = null;
  let nextT = 0, step = 0, chordIdx = 0;

  function noiseBuffer(ctx, sec, pink) {
    const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (pink) { b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048; d[i] = (b0 + b1 + b2) * 0.9; }
      else d[i] = w;
    }
    return b;
  }

  AU.init = function () {
    if (AU.ctx) { if (AU.ctx.state === "suspended") AU.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (AU.ctx = new AC());
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.connect(master);
    musicBus = ctx.createGain(); musicBus.connect(comp);
    rainBus = ctx.createGain(); rainBus.connect(comp);
    sfxBus = ctx.createGain(); sfxBus.connect(comp);
    // шум дождя
    AU.noise = noiseBuffer(ctx, 2, false);
    rainNoise = ctx.createBufferSource(); rainNoise.buffer = noiseBuffer(ctx, 4, true); rainNoise.loop = true;
    rainFilter = ctx.createBiquadFilter(); rainFilter.type = "lowpass"; rainFilter.frequency.value = 1400;
    const rg = ctx.createGain(); rg.gain.value = 0.9;
    rainNoise.connect(rainFilter); rainFilter.connect(rg); rg.connect(rainBus); rainNoise.start();
    // треск винила (только у lo-fi)
    crackle = ctx.createGain(); crackle.gain.value = 0; crackle.connect(musicBus);
    AU.on = true;
    AU.apply();
    nextT = ctx.currentTime + 0.1;
    timer = setInterval(schedule, 90);
  };

  AU.apply = function () {
    if (!AU.ctx) return;
    const t = AU.ctx.currentTime;
    musicBus.gain.setTargetAtTime(AU.radio ? AU.vol.music * 0.5 : 0, t, 0.4);
    const wr = { clear: 0.05, fog: 0.08, snow: 0.06, rain: 0.55, storm: 0.95 }[AU.weather] ?? 0.4;
    rainBus.gain.setTargetAtTime(AU.vol.rain * wr * 0.6, t, 0.8);
    rainFilter.frequency.setTargetAtTime(AU.weather === "storm" ? 2200 : 1300, t, 0.5);
    sfxBus.gain.setTargetAtTime(AU.vol.sfx * 0.6, t, 0.05);
  };
  AU.setWeather = (w) => { AU.weather = w; AU.apply(); };
  AU.setStation = (s) => { AU.station = s; step = 0; AU.apply(); };
  AU.setRadio = (on) => { AU.radio = on; AU.apply(); };
  AU.suspend = () => { if (AU.ctx && AU.ctx.state === "running") AU.ctx.suspend(); };
  AU.resume = () => { if (AU.ctx && AU.ctx.state === "suspended") AU.ctx.resume(); };

  // ───────── инструменты ─────────
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function tone(bus, t, midi, dur, type, vol, opts = {}) {
    const ctx = AU.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = mtof(midi);
    if (opts.detune) o.detune.value = opts.detune;
    let node = o;
    if (opts.lp) { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = opts.lp; o.connect(f); node = f; }
    node.connect(g); g.connect(bus);
    const a = opts.a ?? 0.02, r = opts.r ?? dur * 0.8;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + r);
    if (opts.trem) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = opts.trem; lg.gain.value = vol * 0.3; l.connect(lg); lg.connect(g.gain); l.start(t); l.stop(t + dur + r); }
    o.start(t); o.stop(t + dur + r + 0.05);
  }
  function noiseHit(bus, t, dur, vol, type, freq, q) {
    const ctx = AU.ctx, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = AU.noise; f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
    s.connect(f); f.connect(g); g.connect(bus);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  function kick(t, vol) {
    const ctx = AU.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.35);
  }

  // ───────── станции ─────────
  const LOFI = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]]; // Fmaj7 Em7 Dm7 Cmaj7
  const JAZZ = [[50, 53, 57, 60], [55, 59, 62, 65], [48, 52, 55, 59], [45, 48, 52, 55]]; // Dm7 G7 Cmaj7 Am7
  const PENTA = [60, 62, 64, 67, 69, 72, 74, 76];
  function schedule() {
    const ctx = AU.ctx;
    if (!ctx || ctx.state !== "running") return;
    const st = AU.station;
    const bpm = st === "jazz" ? 100 : st === "rain" ? 60 : 72;
    const sixteenth = 60 / bpm / 4;
    while (nextT < ctx.currentTime + 0.3) {
      if (AU.radio) playStep(st, nextT, step, sixteenth);
      // свинг для lo-fi и джаза
      const swing = st === "rain" ? 0 : step % 2 === 0 ? 0.08 : -0.08;
      nextT += sixteenth * (1 + swing);
      step = (step + 1) % 64;
    }
  }
  function playStep(st, t, s, six) {
    const bar = Math.floor(s / 16), beat = s % 16;
    if (st === "lofi") {
      const ch = LOFI[bar % 4];
      if (beat === 0) ch.forEach((n, i) => tone(musicBus, t + i * 0.012, n, six * 14, "triangle", 0.05, { lp: 1100, a: 0.06, detune: (i - 1.5) * 6 }));
      if (beat === 0 || beat === 10) tone(musicBus, t, ch[0] - 12, six * 5, "sine", 0.16, { a: 0.01 });
      if (beat === 0 || beat === 7 || beat === 10) kick(t, 0.22);
      if (beat === 4 || beat === 12) noiseHit(musicBus, t, 0.16, 0.08, "bandpass", 1800, 0.8);
      if (beat % 2 === 0) noiseHit(musicBus, t, 0.03, 0.025, "highpass", 7000);
      if (beat === 8 && Math.random() < 0.6) tone(musicBus, t, ch[1 + Math.floor(Math.random() * 3)] + 12, six * 3, "sine", 0.05, { a: 0.01 });
      if (Math.random() < 0.08) noiseHit(musicBus, t + Math.random() * six, 0.006, 0.05, "highpass", 3000); // винил
    } else if (st === "jazz") {
      const ch = JAZZ[bar % 4];
      if (beat % 4 === 0) { // шагающий бас
        const walk = [ch[0], ch[2], ch[1] + 12, ch[3]][beat / 4];
        tone(musicBus, t, walk - 12, six * 3.5, "triangle", 0.2, { lp: 700, a: 0.01 });
      }
      if (beat === 2 || beat === 10 || (beat === 7 && Math.random() < 0.5)) ch.slice(1).forEach((n) => tone(musicBus, t, n, six * 2, "sine", 0.045, { trem: 5, a: 0.01 }));
      if (beat % 4 === 0 || beat % 4 === 3) noiseHit(musicBus, t, beat % 4 === 0 ? 0.12 : 0.06, 0.035, "highpass", 5000); // щётки
      if (Math.random() < 0.12 && beat % 2 === 0) tone(musicBus, t, ch[Math.floor(Math.random() * 4)] + 24, six * 1.5, "sine", 0.04, { a: 0.005 });
    } else {
      if (beat === 0 && bar % 2 === 0) [48, 55, 64].forEach((n) => tone(musicBus, t, n, six * 30, "sine", 0.04, { a: 1.5, r: 3 }));
      if (beat % 3 === 0 && Math.random() < 0.35) tone(musicBus, t, PENTA[Math.floor(Math.random() * PENTA.length)], six * 2, "sine", 0.06, { a: 0.005, r: 1.5 });
    }
  }

  // ───────── звуки интерфейса ─────────
  AU.sfx = function (name) {
    const ctx = AU.ctx;
    if (!ctx || ctx.state !== "running") return;
    const t = ctx.currentTime + 0.01;
    switch (name) {
      case "order": tone(sfxBus, t, 81, 0.08, "sine", 0.12); tone(sfxBus, t + 0.09, 88, 0.12, "sine", 0.1); break;
      case "coin": tone(sfxBus, t, 84, 0.06, "square", 0.05, { lp: 3000 }); tone(sfxBus, t + 0.07, 91, 0.18, "square", 0.05, { lp: 3000 }); break;
      case "click": tone(sfxBus, t, 72, 0.02, "sine", 0.06, { r: 0.03 }); break;
      case "event": tone(sfxBus, t, 76, 0.3, "sine", 0.08, { r: 0.6 }); tone(sfxBus, t + 0.12, 83, 0.3, "sine", 0.06, { r: 0.6 }); break;
      case "good": [72, 76, 79].forEach((n, i) => tone(sfxBus, t + i * 0.07, n, 0.12, "triangle", 0.08)); break;
      case "bad": tone(sfxBus, t, 60, 0.25, "triangle", 0.08); tone(sfxBus, t + 0.12, 56, 0.3, "triangle", 0.07); break;
      case "level": [72, 76, 79, 84, 88].forEach((n, i) => tone(sfxBus, t + i * 0.08, n, 0.16, "triangle", 0.08)); break;
      case "door": noiseHit(sfxBus, t, 0.12, 0.2, "lowpass", 500); kick(t, 0.05); break;
      case "thunder": noiseHit(rainBus, t, 2.5, 0.5, "lowpass", 180); break;
    }
  };
})();
