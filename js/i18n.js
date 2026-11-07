/* Ночной тариф — языки. Каждый язык лежит в js/lang/xx.js и заполняет LANGS.xx.
   Если строки нет в выбранном языке, берётся английская, затем русская. */
(function () {
  "use strict";
  const NF = (window.NF = window.NF || {});
  window.LANGS = window.LANGS || {};
  NF.LANG_ORDER = ["ru", "en", "zh", "de", "fr", "es", "it"];
  NF.LOCALE = { ru: "ru-RU", en: "en-US", zh: "zh-CN", de: "de-DE", fr: "fr-FR", es: "es-ES", it: "it-IT" };
  NF.lang = "en";

  NF.detectLang = function () {
    const list = (navigator.languages || [navigator.language || "en"]).map((x) => String(x).slice(0, 2).toLowerCase());
    for (const l of list) if (NF.LANG_ORDER.includes(l) && LANGS[l]) return l;
    return "en";
  };
  function dig(o, path) {
    for (const p of path) { if (o == null) return undefined; o = o[p]; }
    return o;
  }
  // NF.L("ev.drunk_sleep.t") — сырое значение (строка, массив, объект)
  NF.L = function (key) {
    const path = key.split(".");
    for (const l of [NF.lang, "en", "ru"]) {
      const v = dig(LANGS[l], path);
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return undefined;
  };
  // подстановка {переменных} и [[мужской|женский]] вариантов
  NF.fmt = function (str, vars = {}) {
    if (typeof str !== "string") return str == null ? "" : String(str);
    str = str.replace(/\[\[([^|\]]*)\|([^\]]*)\]\]/g, (_, m, f) => (vars.g === "f" ? f : m));
    return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : "{" + k + "}"));
  };
  NF.t = function (key, vars) {
    const v = NF.L(key);
    if (v === undefined) return key.split(".").pop();
    return NF.fmt(Array.isArray(v) ? v[0] : v, vars);
  };
  NF.money = function (n) {
    n = Math.round(n || 0);
    const loc = NF.LOCALE[NF.lang] || "en-US";
    if (Math.abs(n) >= 1e7) return "$" + new Intl.NumberFormat(loc, { notation: "compact", maximumFractionDigits: 1 }).format(n);
    return "$" + new Intl.NumberFormat(loc).format(n);
  };
  NF.num = (n, d = 0) => new Intl.NumberFormat(NF.LOCALE[NF.lang] || "en-US", { maximumFractionDigits: d, minimumFractionDigits: d }).format(n);
  // имена и места
  NF.pname = function (ctx) {
    if (!ctx) return "";
    const list = NF.L("names." + (ctx.g === "f" ? "f" : "m")) || ["Alex"];
    return list[(ctx.nameIdx || 0) % list.length];
  };
  NF.place = function (district, idx) {
    const list = NF.L("d." + district + ".p") || ["?"];
    return list[(idx || 0) % list.length];
  };
  NF.dname = (id) => NF.t("d." + id + ".n");
  // переменные для текста события
  NF.evVars = function (ctx) {
    if (!ctx) return {};
    return {
      g: ctx.g, name: NF.pname(ctx), item: NF.t("items." + ctx.item), fare: NF.money(ctx.fare || 0),
      from: NF.place(ctx.from || "sleepy", ctx.fromIdx), to: NF.place(ctx.to || "sleepy", ctx.toIdx),
      district: NF.dname(ctx.district || ctx.from || "sleepy"), arch: NF.t("arch." + ctx.arch),
    };
  };
})();
