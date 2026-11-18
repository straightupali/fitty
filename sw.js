// Fitty service worker — makes the app work offline.
// Bump VERSION whenever you change app files so phones pick up the update.
// Only clear our own old caches (a test copy of the app may share this site).
const CACHE_PREFIX = 'fitty-v';
const VERSION = CACHE_PREFIX + '3.0.0';
const SHELL = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  './js/app.js', './js/db.js', './js/weather.js', './js/recommend.js', './js/images.js', './js/bg-worker.js',
  './js/colors.js', './js/cutout-clean.js', './js/i18n.js', './js/lang-ar.js', './js/learn.js', './js/planner.js', './js/ideas.js',
  './js/config.js', './js/share.js', './js/transfer.js', './js/vendor/qrcode.min.js', './js/vendor/jsqr.min.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png',
];
const RUNTIME = 'fitbud-runtime'; // old name kept so the downloaded AI model stays cached

self.addEventListener('install', (e) => {
  // cache: 'reload' skips the browser's HTTP cache so an update never re-saves old files.
  e.waitUntil(caches.open(VERSION)
    .then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => (k.startsWith(CACHE_PREFIX) && k !== VERSION) || k.startsWith('fitty-beta-')).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Weather: always network (the app keeps its own offline copy).
  if (url.hostname.endsWith('open-meteo.com')) return;

  // App files: cache first, refresh in the background.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req, { ignoreSearch: true }).then(hit => {
        const net = fetch(req, { cache: 'no-cache' }).then(res => {
          if (res.ok) caches.open(VERSION).then(c => c.put(req, res.clone()));
          return res;
        }).catch(() => hit || caches.match('./index.html'));
        if (hit) { e.waitUntil(net.catch(() => { })); return hit; }
        return net;
      })
    );
    return;
  }

  // Fonts + background-removal library/model: cache forever once downloaded.
  if (/fonts\.(googleapis|gstatic)\.com$|cdn\.jsdelivr\.net$|staticimgly\.com$/.test(url.hostname)) {
    e.respondWith(
      caches.open(RUNTIME).then(async c => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') c.put(req, res.clone());
        return res;
      })
    );
  }
});
