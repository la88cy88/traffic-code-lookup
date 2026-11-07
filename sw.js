/* 违法代码速查 · Service Worker
 * 策略：在线时永远取网络（保证加到主屏后也能自动拿到新版），离线时回落缓存。
 * 右上角「↻ 刷新」会注销本 SW 并清空缓存，用于强制更新。
 */
const VERSION = 'tc-v3-2026-11-08-national';
const CACHE = 'tc-cache-' + VERSION;
const CORE = [
  './', './index.html', './styles.css', './app.js',
  './data/codes.js', './manifest.webmanifest', './icon.svg', './apple-touch-icon.png',
];
const abs = (p) => new URL(p, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => Promise.all(
      CORE.map((p) => c.add(abs(p)).catch(() => null))
    )).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.indexOf('tc-cache-') === 0 && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(req).then((res) => {
      if (res && res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(req).then((hit) => {
      if (hit) return hit;
      if (req.mode === 'navigate') return caches.match(abs('./index.html'));
      return Response.error();
    }))
  );
});
