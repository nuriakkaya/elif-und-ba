/* Elif & Ba — Service Worker (Version 7.1, 09.08.2026)

   WICHTIGE ÄNDERUNG: App-Code wird NICHT mehr aus dem Zwischenspeicher
   bevorzugt. Vorher galt "cache-first mit stillem Hintergrund-Update" auch
   für app/*.js — dadurch sah man nach einem neuen Hochladen beim ERSTEN
   Öffnen weiterhin die alte App (und wer die Seite danach schloss, blieb
   dauerhaft auf dem alten Stand hängen). Genau daran lag es, dass Änderungen
   scheinbar "nicht ankamen".

   Strategie jetzt:
   - Navigationen und App-Code (HTML/JS/CSS/Manifest): NETZ ZUERST, der
     Zwischenspeicher ist nur der Rettungsanker fürs Offline-Lernen.
   - Unveränderliches (Schriften, Töne, Bilder, vendor/): Zwischenspeicher
     zuerst — das ändert sich praktisch nie und soll schnell sein.
   - Mini-Server (/api/…, /.netlify/functions/…): immer live.
     Einzige Ausnahme: die Aussprache-Aufnahmen (Route "media"), damit sie
     offline hörbar bleiben.
*/
const CACHE = 'elifba-8-1';

const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png',
  'favicon-32.png',
  'vendor/react.development.js',
  'vendor/react-dom.development.js',
  'vendor/babel.min.js',
  'vendor/supabase.js',
  'vendor/qrcode.min.js',
  'assets/letters.mp3',
  'assets/sounds/correct.mp3',
  'assets/sounds/wrong.mp3',
  'assets/sounds/combo.mp3',
  'assets/sounds/round.mp3',
  'assets/sounds/level.mp3',
  'assets/sounds/streak.mp3',
  'assets/sounds/master.mp3',
  'assets/sounds/tick.mp3',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(PRECACHE.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Die App kann einen sofortigen Wechsel anstoßen ("App aktualisieren"). */
self.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.type === 'SKIP_WAITING') self.skipWaiting();
  if (d.type === 'CLEAR_CACHE') {
    e.waitUntil(caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k)))));
  }
});

const APP_CODE = /\.(?:html|js|css|webmanifest)$/i;

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin !== location.origin) return;

  const isServer = url.pathname.includes('/api/') || url.pathname.includes('/.netlify/functions/');
  const isMedia = /\/media\/audio$/.test(url.pathname) || /\/media$/.test(url.pathname)
    || url.searchParams.get('r') === 'media';
  if (isServer && !isMedia) return;                     // Anmelden/Abgleich immer live

  const isVendor = url.pathname.indexOf('/vendor/') >= 0;
  const netFirst = e.request.mode === 'navigate' || (APP_CODE.test(url.pathname) && !isVendor);

  if (netFirst) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request.mode === 'navigate' ? 'index.html' : e.request, copy));
          }
          return res;
        })
        .catch(() => caches.match(e.request.mode === 'navigate' ? 'index.html' : e.request)
          .then((hit) => hit || caches.match('index.html')))
    );
    return;
  }

  // Unveränderliches: Zwischenspeicher zuerst, still im Hintergrund erneuern
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const update = fetch(e.request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || update;
    })
  );
});
