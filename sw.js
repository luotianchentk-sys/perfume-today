/* 今日穿香 · Service Worker v1
 * 策略：install 预缓存核心壳，运行时 cache-first + 按需缓存图片（ph/）。
 * 仅在 https 或 localhost 下注册生效。
 */
const CACHE = "jinrichuanxiang-20261031-locked-v1";
const CORE = [
  "./",
  "./index.html",
  "./manifest.json?v=20261030-icon-v5",
  "./css/app-v1.css",
  "./js/calendar.js",
  "./js/data.js",
  "./js/recommendation.js",
  "./js/app-v1.js",
  "./icons/icon-192-v5.png",
  "./icons/icon-512-v5.png",
  "./icons/apple-touch-icon-v5.png",
  "./icons/favicon-v5.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 天气 API 走网络，不缓存
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match("./index.html"));
    })
  );
});
