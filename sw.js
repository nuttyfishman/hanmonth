const CACHE = 'hanmonth-v2';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];

// 브라우저 HTTP 캐시(GitHub Pages는 10분)를 거치지 않고 서버에 새 버전이 있는지 꼭 확인한다.
// 이걸 안 하면 새 index.html에 예전 style.css가 섞여서 화면이 깨진다.
const fresh = (request) => fetch(request, { cache: 'no-cache' });

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// 인터넷이 되면 늘 서버 것을 쓰고 저장해 둔다. 안 되면 저장해 둔 걸 보여준다.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      try {
        const res = await fresh(event.request);
        if (res.ok) cache.put(event.request, res.clone());
        return res;
      } catch {
        return (await cache.match(event.request, { ignoreSearch: true })) || cache.match('index.html');
      }
    }),
  );
});
