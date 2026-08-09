/* ==============================================================
   useTweaks — kleine Persistenz für UI-Einstellungen (Dunkelmodus, Akzent-
   farbe, Sounds, Haptik, ...), die überall über ctx.tweaks/ctx.setTweak
   gelesen/geschrieben werden.

   FUND (17.07.2026, beim Bau des Sound-Systems): `window.useTweaks` wurde in
   main.js zwar erwartet (`window.useTweaks ? window.useTweaks(...) : [...,
   ()=>{}]`), war aber nirgendwo im Projekt definiert — d.h. `setTweak` war
   bisher IMMER die No-op-Fallback-Funktion. Das betraf auch den bereits
   angeschlossenen Dunkelmodus-Toggle in den Einstellungen: er hat den
   Body-CSS-Klasse zwar sofort umgeschaltet (das passiert lokal im `tweaks`-
   State von App()), aber nach einem Neuladen der Seite war die Einstellung
   wieder weg, weil nichts gespeichert wurde. Mit diesem Modul werden alle
   Tweaks jetzt tatsächlich in localStorage persistiert.
   ============================================================== */
(function () {
  const KEY = 's34a_tweaks_v1';

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function save(all) {
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) { /* voll/gesperrt */ }
  }

  function useTweaks(defaults) {
    const [state, setState] = React.useState(function () {
      return Object.assign({}, defaults, load());
    });
    function setTweak(key, value) {
      setState(function (prev) {
        const next = Object.assign({}, prev);
        next[key] = value;
        save(next);
        return next;
      });
    }
    return [state, setTweak];
  }

  window.useTweaks = useTweaks;
})();
