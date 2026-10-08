// Coffee Identity — Service Worker نسخه‌ی ۳ (مرحله‌ی ۵ امنیت، ۸ اکتبر ۲۰۲۶)
// قاعده‌ها:
//  • فقط فایل‌های عمومی و ثابتِ همین دامنه که در فهرست مجاز هستند کش می‌شوند (پوسته‌ی اپ، manifest، آیکون‌ها، کتابخانه).
//  • هیچ پاسخ API، حساب، سفارش، BeanCredit، رسید یا صفحه‌ی ادمین کش نمی‌شود — آن درخواست‌ها اصلاً از SW رد نمی‌شوند.
//  • نام کش به دامنه و نسخه وابسته است؛ با تغییر دامنه یا نسخه، کش قدیمی پاک می‌شود.
//  • پیام CLEAR_CACHES (هنگام خروج/حذف حساب) همه‌ی کش‌ها را پاک می‌کند.
const VERSION = 'v3';
const CACHE_NAME = 'ci-shell-' + self.location.hostname + '-' + VERSION;
const SCOPE_PATH = new URL(self.registration.scope).pathname; // مثلاً /roastery-cafe/ یا /

// فهرست مجاز (نسبت به scope). فقط همین‌ها کش می‌شوند.
const PRECACHE = [
  'cafe-app-soshians.html',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png'
];
const RUNTIME_ALLOW = [
  /^cafe-app-soshians\.html$/,
  /^manifest\.json$/,
  /^icons\/[a-z0-9-]+\.png$/,
  /^supabase-js-[0-9.]+\.js$/
];
// هرگز از SW رد نشوند (نه کش، نه پاسخ از کش)
const NEVER = [/^roastery-admin/i, /admin/i, /PRIVATE|readable/i];

function relPath(url) {
  return url.pathname.startsWith(SCOPE_PATH) ? url.pathname.slice(SCOPE_PATH.length) : null;
}
function isAllowed(url) {
  if (url.origin !== self.location.origin) return false;
  if (url.search) return false;               // نشانی با پارامتر کش نمی‌شود
  const p = relPath(url);
  if (p === null) return false;
  if (NEVER.some((r) => r.test(p))) return false;
  return RUNTIME_ALLOW.some((r) => r.test(p));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(PRECACHE.map((p) => cache.add(p).catch(() => {}))))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHES') {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;            // فقط GET
  const url = new URL(req.url);
  if (!isAllowed(url)) return;                 // هر چیز دیگر (Supabase، ادمین، CDN، ...) مستقیم از شبکه، بدون کش
  if (req.headers.get('authorization')) return;

  // Network First: همیشه آخرین نسخه؛ کش فقط برای حالت آفلاین
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const cc = res.headers.get('cache-control') || '';
          if (!/no-store|private/i.test(cc)) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone)).catch(() => {});
          }
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
