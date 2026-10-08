/* Офлайн-режим веб-версии: сначала сеть (чтобы обновления приходили сразу), без сети — кэш. */
const CACHE = "comlog-v2";
const CORE = [
  "./", "index.html", "manifest.webmanifest", "css/style.css",
  "fonts/inter-latin.woff2", "fonts/inter-latin-ext.woff2", "fonts/inter-cyrillic.woff2",
  "icons/icon-192.png", "icons/apple-touch-icon.png", "icons/favicon.png",
  ...["logo", "util", "store", "sync", "chart", "character", "game", "autocomplete", "reminders", "orders", "analytics", "clients", "pricelist", "hero", "settings", "main"].map(f => `js/${f}.js`),
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;   // GitHub API и прочее — мимо кэша
  e.respondWith(
    fetch(req, { cache: "no-cache" }).then(res => {   // с проверкой свежести — обновления видны сразу
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("index.html")))
  );
});
