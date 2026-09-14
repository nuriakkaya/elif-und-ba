// Versionsstempel — sichtbar in Einstellungen & Anmelde-Fenster, damit sofort
// erkennbar ist, ob auf Netlify wirklich die neueste Version läuft.
window.APP_BUILD = '11.7';
window.APP_VERSION = 'Version 11.7 · 13.09.2026';

// Supabase-Konfiguration für echte Accounts, Fortschritt-Sync, Freunde und Live-Quiz.
//
// Trage hier deine eigenen Werte aus dem Supabase-Dashboard ein:
// Project Settings → API → "Project URL" und "anon public" Key.
// (Siehe SUPABASE_SETUP.md für die komplette Schritt-für-Schritt-Anleitung.)
//
// Ohne diese beiden Werte läuft die App weiter im reinen Offline-Modus wie bisher
// (localStorage-Fortschritt, keine Accounts) — sie stürzt nicht ab, zeigt aber
// beim Anmelden einen Hinweis, dass noch keine Supabase-Verbindung eingerichtet ist.
// (11.0) Gemeinde/Verein hinter dem Kurs — Name neben dem Logo (assets/logo-gemeinde.jpg).
// Leer lassen = nur das Logo. Beispiel: 'Türkisch-Islamische Gemeinde Musterstadt'
window.GEMEINDE_NAME = '';

window.SUPABASE_URL = '';
window.SUPABASE_ANON_KEY = '';

// (05.08.2026) Einrichtung OHNE Datei-Editieren: Die App kann die beiden Werte
// auch direkt im Anmelden-Fenster entgegennehmen ("Verbindung einrichten") und
// speichert sie dann hier im Browser (localStorage). Ein dort gespeicherter
// Wert übersteuert die leeren Konstanten oben — so funktioniert die Einrichtung
// auch in der fertig deployten App, ganz ohne Code anzufassen.
try {
  var _sbCfg = JSON.parse(localStorage.getItem('app_supabase_cfg') || 'null');
  if (_sbCfg && _sbCfg.url && _sbCfg.key) {
    window.SUPABASE_URL = _sbCfg.url;
    window.SUPABASE_ANON_KEY = _sbCfg.key;
  }
} catch (e) { /* localStorage gesperrt: Datei-Werte gelten */ }

/* ==============================================================
   GIBT ES EINEN EIGENEN MINI-SERVER?  (11.09.2026, am selben Tag korrigiert)

   JA, DEN GIBT ES. Er liegt in netlify/functions/sync.mjs — 899 Zeilen mit
   den Routen `klasse` (anlegen/anmelden/umbenennen), `auth`, `cards`,
   `config` und `media`. netlify.toml leitet /api/* dorthin um. Nuri laedt das
   Projekt zu GitHub, GitHub ist mit Netlify verbunden, Netlify baut — und
   dabei werden die Functions installiert.

   ICH HATTE DAS FALSCH ANGENOMMEN. In der Nacht zum 11.09.2026 habe ich aus
   dem Commit „Netlify raus, KI-Funktionen gestrichen" geschlossen, es gebe
   keinen Server mehr, und diesen Schalter auf `false` gesetzt. Gemessen hatte
   ich richtig — auf dem Testserver (tools/server.mjs) laufen die Anfragen
   tatsaechlich ins Leere. Nur ist der Testserver nicht die Wirklichkeit, in
   der die Kinder lernen. Der Schluss war falsch, die Messung stimmte.

   Der Schalter bleibt, weil er zweierlei taugt:

     · Wer die App auf GitHub Pages oder als lose Dateien ausliefert, hat
       keinen Mini-Server. Dort spart `false` bei jedem Start fuenf Anfragen,
       die nur auf ihr Zeitlimit warten.
     · Zum Pruefen: Mit `false` sieht man sofort, ob ein Bildschirm auch ohne
       Server einen brauchbaren Weg anbietet.

   Voreinstellung ist `true` — das ist die Wirklichkeit auf Netlify. Im
   Browser umstellen mit
       localStorage.setItem('app_eigener_server', '0')
   ============================================================== */
window.EIGENER_SERVER = true;
try {
  const wahl = localStorage.getItem('app_eigener_server');
  if (wahl === '0') window.EIGENER_SERVER = false;
  if (wahl === '1') window.EIGENER_SERVER = true;
} catch (e) { /* localStorage gesperrt: es bleibt beim Wert oben */ }
