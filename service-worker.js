const CACHE_NAME = 'ghahvato-shell-v1';
const ASSETS_TO_CACHE = [
  './cafe-app-fa-final.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .catch(() => {}) // اگه یکی از فایل‌ها موقع نصب پیدا نشد، کل نصب رو خراب نکنه
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // درخواست‌های Supabase و Apps Script هیچ‌وقت کش نمی‌شن — همیشه باید زنده و به‌روز باشن
  if (url.hostname.includes('supabase.co') || url.hostname.includes('script.google.com')) {
    return;
  }
  // فقط GET قابل کش‌شدنه
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.ok && url.origin === location.origin) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached); // آفلاین: برگرد به نسخه‌ی کش‌شده
      return cached || networkFetch;
    })
  );
});
