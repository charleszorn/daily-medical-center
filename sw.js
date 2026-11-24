const CACHE = 'dmc-v81';
const ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/storage.js',
  '/js/app.js',
  '/js/medications.js',
  '/js/doctors.js',
  '/js/image-crop.js',
  '/js/symptoms.js',
  '/js/schedule.js',
  '/js/history.js',
  '/js/reports.js',
  '/manifest.json',
  '/assets/icon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(()=>{}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      if (list.length > 0) { list[0].focus(); return; }
      return clients.openWindow('/');
    })
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // Network-first for CSS/JS/HTML to avoid stale assets
  e.respondWith(
    fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone)).catch(()=>{});
      return res;
    }).catch(() => caches.match(e.request))
  );
});
