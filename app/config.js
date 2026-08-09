// Versionsstempel — sichtbar in Einstellungen & Anmelde-Fenster, damit sofort
// erkennbar ist, ob auf Netlify wirklich die neueste Version läuft.
window.APP_BUILD = '7.5';
window.APP_VERSION = 'Version 7.5 · 09.08.2026';

// Supabase-Konfiguration für echte Accounts, Fortschritt-Sync, Freunde und Live-Quiz.
//
// Trage hier deine eigenen Werte aus dem Supabase-Dashboard ein:
// Project Settings → API → "Project URL" und "anon public" Key.
// (Siehe SUPABASE_SETUP.md für die komplette Schritt-für-Schritt-Anleitung.)
//
// Ohne diese beiden Werte läuft die App weiter im reinen Offline-Modus wie bisher
// (localStorage-Fortschritt, keine Accounts) — sie stürzt nicht ab, zeigt aber
// beim Anmelden einen Hinweis, dass noch keine Supabase-Verbindung eingerichtet ist.
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
