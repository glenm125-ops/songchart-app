// Service worker for Chart Scroller — caches the app shell + PDF.js for offline use.
const VERSION = 'v2';
const CACHE = 'chartscroller-' + VERSION;
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Best-effort: cache cross-origin CDN scripts even if opaque.
    await Promise.all(APP_SHELL.map(u =>
      cache.add(u).catch(err => console.warn('SW: failed to cache', u, err))
    ));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Network-first for the app shell so updates land quickly, fall back to cache offline.
  e.respondWith((async () => {
    try {
      const net = await fetch(req);
      const cache = await caches.open(CACHE);
      cache.put(req, net.clone()).catch(() => {});
      return net;
    } catch (err) {
      const cached = await caches.match(req);
      if (cached) return cached;
      // Last resort for navigations: serve the cached index.html.
      if (req.mode === 'navigate') {
        const fallback = await caches.match('./index.html');
        if (fallback) return fallback;
      }
      throw err;
    }
  })());
});
