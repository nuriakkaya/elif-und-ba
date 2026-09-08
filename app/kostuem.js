/* ==============================================================
   👒 AXIS KLEIDERSCHRANK (11.0, 08.09.2026)
   Kostüme für das Maskottchen — gekauft mit Münzen im Shop, angezogen
   auf jedem Bildschirm, auf dem Axi auftaucht. Das ist die Sammel-
   und Ausdrucks-Schleife: Münzen aus Combos und der Tageskiste haben
   endlich ein Ziel, und jedes Kind hat „seinen" Axi.

   Rein lokal gespeichert (localStorage) — gleiches Muster wie die
   Premium-Avatare in xp.js. Die Zeichnungen selbst stehen in
   app/icons.js (AxiKostuem), damit sie direkt im SVG von Axi liegen.
   ============================================================== */
(function () {
  const KEY = 'eb_axi_kostuem_v1';
  const KOSTUEME = [
    { id: 'blume',      name: 'Blume',       preis: 5,  hinweis: 'Eine Blüte am Ohr' },
    { id: 'schleife',   name: 'Schleife',    preis: 6,  hinweis: 'Korallenrot, wie die Kiemen' },
    { id: 'brille',     name: 'Brille',      preis: 10, hinweis: 'Für den klugen Blick' },
    { id: 'muetze',     name: 'Mütze',       preis: 12, hinweis: 'Warm und mit Bommel' },
    { id: 'fes',        name: 'Fes',         preis: 15, hinweis: 'Rot mit Quaste' },
    { id: 'kopfhoerer', name: 'Kopfhörer',   preis: 18, hinweis: 'Hört gerade Sure Yasin' },
    { id: 'krone',      name: 'Krone',       preis: 30, hinweis: 'Für den König der Buchstaben' },
  ];
  let listeners = [];
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(st) { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} listeners.slice().forEach(function (fn) { try { fn(); } catch (e) {} }); }
  function owned() { return (load().owned || []).slice(); }
  function hat(id) { return owned().indexOf(id) >= 0; }
  function active() { const a = load().active || ''; return hat(a) ? a : ''; }
  function info(id) { return KOSTUEME.filter(function (k) { return k.id === id; })[0] || null; }
  function buy(id) {
    const k = info(id);
    if (!k) return { ok: false, reason: 'unknown' };
    if (hat(id)) return { ok: true, already: true };
    if (!window.XP || !window.XP.spend(k.preis)) return { ok: false, reason: 'coins' };
    const st = load(); st.owned = (st.owned || []).concat([id]); st.active = id; save(st);
    return { ok: true };
  }
  function wear(id) {
    const st = load();
    st.active = (id && hat(id)) ? id : '';
    save(st);
    return st.active;
  }
  function onChange(fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; }
  window.Kostuem = { list: function () { return KOSTUEME.slice(); }, owned, hat, active, info, buy, wear, onChange };
})();
