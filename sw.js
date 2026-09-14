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
const CACHE = 'elifba-11-10';

const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png',
  'favicon-32.png',
  'icon.svg',
  'vendor/react.js',
  'vendor/react-dom.js',
  'vendor/qrcode.min.js',
  'app/bundle.js',
  'fonts/nunito-latin.woff2',
  'fonts/nunito-latin-ext.woff2',
  'fonts/scheherazade-arabic-400.woff2',
  'fonts/scheherazade-arabic-700.woff2',
  'assets/letters.mp3',
  'assets/logo-gemeinde.jpg',
  'assets/sounds/correct.mp3',
  'assets/sounds/wrong.mp3',
  'assets/sounds/combo.mp3',
  'assets/sounds/round.mp3',
  'assets/sounds/level.mp3',
  'assets/sounds/streak.mp3',
  'assets/sounds/master.mp3',
  'assets/sounds/tick.mp3',
  'assets/sounds/bonus.m4a',
  'assets/sounds/perfect.m4a',
  'assets/sounds/chest.m4a',
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

/* Die Verzeichnisse der Aufnahmen sind KEINE unveraenderlichen Toene, sondern
   Listen. (11.09.2026)

   Sie standen bisher unter „unveraenderlich, Zwischenspeicher zuerst" — wie
   die mp3-Dateien daneben, weil die Regel nur auf die Endung sah und .json
   nicht zum App-Code zaehlte. Folge: Kommen neue Toene dazu, liest ein Geraet
   mit gefuelltem Zwischenspeicher weiter die ALTE Liste. Die App fragt dann
   gar nicht erst nach den neuen Dateien; sie spricht mit der Computerstimme
   weiter, obwohl der richtige Ton auf dem Server liegt. Erst beim
   uebernaechsten Start waere es aufgefallen.

   Die beiden Listen sind zusammen wenige Kilobyte. Netz zuerst, Speicher als
   Rettungsanker — dann sind neue Aufnahmen sofort da und offline bleibt
   alles hoerbar. */
const TON_LISTE = /\/media\/stimmen\/[^/]+\.json$/i;

/* version.json MUSS aus dem Netz kommen. (11.09.2026)

   An dieser Datei erkennt die App, dass eine neue Fassung da ist: Sie liest
   sie beim Start und vergleicht sie mit ihrem eigenen APP_BUILD; sind sie
   verschieden, leert sie Zwischenspeicher und Service Worker und laedt neu.

   Sie lag aber unter „unveraenderlich, Zwischenspeicher zuerst" — weil die
   Regel nur auf die Endung sieht und .json nicht zum App-Code zaehlt. Der
   Aufruf in index.html sagt zwar `cache: 'no-store'`, aber das gilt fuer den
   BROWSER-Zwischenspeicher; wir hier sitzen davor und haetten trotzdem die
   alte Antwort gereicht.

   Ergebnis waere gewesen: ein Geraet liest seine eigene, alte Versionsnummer
   und haelt sich fuer aktuell. Genau der Mechanismus, auf den sich die
   Auslieferung stuetzt, haette sich selbst blockiert. */
const VERSION_JSON = /\/version\.json$/i;

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin !== location.origin) return;

  const isServer = url.pathname.includes('/api/') || url.pathname.includes('/.netlify/functions/');
  const isMedia = /\/media\/audio$/.test(url.pathname) || /\/media$/.test(url.pathname)
    || url.searchParams.get('r') === 'media';
  if (isServer && !isMedia) return;                     // Anmelden/Abgleich immer live

  const isVendor = url.pathname.indexOf('/vendor/') >= 0;
  /* index.html haengt an jedes Skript ?v=<Version>, der Vorrat (PRECACHE) kennt die
     Adressen ohne. Cache.match vergleicht samt Anhang — beim ersten Besuch lag
     app/bundle.js?v=… deshalb NICHT im Speicher, und offline kam statt des
     Skripts die index.html zurueck: weisser Bildschirm. Fuer App-Code und
     vendor zaehlt der Anhang nicht; fuer Toene (.bin?v=Groesse) bleibt er der
     Schluessel, damit ein neues Buendel auch neu geladen wird. (13.09.2026) */
  const ohneQuery = (APP_CODE.test(url.pathname) || isVendor) ? { ignoreSearch: true } : undefined;
  const netFirst = e.request.mode === 'navigate'
    || (APP_CODE.test(url.pathname) && !isVendor)
    || TON_LISTE.test(url.pathname)
    || VERSION_JSON.test(url.pathname);

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
        .catch(() => caches.match(e.request.mode === 'navigate' ? 'index.html' : e.request, ohneQuery)
          /* Nur eine SEITE darf auf index.html zurueckfallen — ein Skript, das
             als HTML ankommt, ist ein SyntaxError statt einer Fehlermeldung. */
          .then((hit) => hit || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error())))
    );
    return;
  }

  // Unveränderliches: Zwischenspeicher zuerst, still im Hintergrund erneuern
  e.respondWith(
    caches.match(e.request, ohneQuery).then((cached) => {
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
