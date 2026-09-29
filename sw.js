// Offline shell. Stale-while-revalidate: opens instantly from cache, refreshes in the
// background — so an updated fee table appears on the SECOND open after you deploy it.
const CACHE = 'ags-calc-v1'; // bump to force a clean re-cache
const ASSETS = [
  './', 'index.html', 'styles.css', 'manifest.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
  'src/ui/ui.js', 'src/calculator/calculator.js', 'src/calculator/solver.js',
  'src/fees/feeSchemes.js', 'src/fees/feeEngine.js',
  'src/formatting/currency.js', 'src/formatting/percentage.js', 'src/validation/validation.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request, { ignoreSearch: true });
      const network = fetch(e.request).then((res) => {
        if (res.ok) cache.put(e.request, res.clone());
        return res;
      }).catch(() => cached || cache.match('index.html'));
      return cached || network;
    }),
  );
});
