/* Офлайн-режим веб-версии.
   Каждая сборка получает свой номер VERSION (tools/stamp_version.py). Новая версия скачивается целиком
   с ?v=VERSION — так запрос проходит мимо кэша GitHub — и включается сразу; страница перезагружается сама. */
const VERSION = "2026.10.10-1744";
const CACHE = "comlog-" + VERSION;
const CORE = [
  "./", "index.html", "manifest.webmanifest", "css/style.css",
  "fonts/inter-latin.woff2", "fonts/inter-latin-ext.woff2", "fonts/inter-cyrillic.woff2",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/favicon.png",
  ...["version", "logo", "util", "store", "sync", "chart", "character", "game", "autocomplete", "reminders", "orders", "analytics", "clients", "pricelist", "hero", "settings", "main"].map(f => `js/${f}.js`),
];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(CORE.map(async path => {
      const res = await fetch(`${path}?v=${VERSION}`, { cache: "no-store" });
      if (res.ok) await cache.put(new URL(path, self.registration.scope).href, res);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;   // GitHub API и прочее — мимо
  if (url.pathname.endsWith("/version.json")) return;                   // проверка обновлений — всегда из сети
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true })
      || (req.mode === "navigate" ? await cache.match(new URL("./", self.registration.scope).href) : null);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch {
      return new Response("", { status: 504 });
    }
  })());
});
