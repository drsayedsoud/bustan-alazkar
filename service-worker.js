// Service Worker لتشغيل تطبيق البطل المسلم بدون إنترنت (أوفلاين)
const CACHE_NAME = 'bustan-alazkar-v8';
const ASSETS = [
  './',
  './index.html',
  './style.css?v=8',
  './manifest.json',
  './icons/icon.svg',
  './js/wake-lock.js?v=8',
  './js/azkar-data.js?v=8',
  './js/prayer-data.js?v=8',
  './js/aqeedah-data.js?v=8',
  './js/audio.js?v=8',
  './js/tree.js?v=8',
  './js/confetti.js?v=8',
  './js/app.js?v=8'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // تخزين كل ملف وتفادي توقف التثبيت في حال تعثر أي ملف
      await Promise.all(
        ASSETS.map(url =>
          cache.add(url).catch(err => {
            console.warn('[SW] تعذر تخزين مؤقت لملف:', url, err);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => {
          console.log('[SW] حذف الكاش القديم:', key);
          return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('message', event => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  // استراتيجية Network First لضمان تحميل أحدث نسخة دائماً عند توفر النت
  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // في حالة انقطاع النت (Offline): استرجاع الملفات المخزنة في الكاش
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html') || caches.match('./');
          }
          return null;
        });
      })
  );
});
