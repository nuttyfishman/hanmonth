const CACHE = 'hanmonth-v1';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// 저장된 걸 바로 보여주고 뒤에서 새 버전을 받아둔다. 수정본은 다음 실행 때 반영된다.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(event.request, { ignoreSearch: true });
      const refresh = fetch(event.request).then((res) => {
        if (res.ok) cache.put(event.request, res.clone());
        return res;
      });
      if (cached) {
        refresh.catch(() => {});
        return cached;
      }
      return refresh.catch(() => cache.match('index.html'));
    }),
  );
});
