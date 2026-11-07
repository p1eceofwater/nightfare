/* Офлайн-режим: игра сохраняется в телефоне и работает без интернета.
   ВАЖНО: при каждом обновлении игры увеличь номер версии ниже — иначе игроки увидят старую версию. */
const VERSION = "nightfare-v1.2.1";
const FILES = [
  "./", "./index.html", "./css/style.css", "./manifest.webmanifest",
  "./js/i18n.js", "./js/content.js", "./js/core.js", "./js/art.js", "./js/audio.js", "./js/platform.js", "./js/ui.js",
  "./js/lang/ru.js", "./js/lang/en.js", "./js/lang/zh.js", "./js/lang/de.js", "./js/lang/fr.js", "./js/lang/es.js", "./js/lang/it.js",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable.png",
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// сначала сеть (чтобы обновления приходили сразу), без сети — из кэша
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).then((r) => {
      const copy = r.clone();
      caches.open(VERSION).then((c) => c.put(e.request, copy)).catch(() => {});
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
