/* ==============================================================
   ✏️ BUCHSTABEN & SILBEN ÄNDERN (09.08.2026)

   Die Lehrkraft kann jede einzelne Karte umschreiben, ohne dass
   jemand am Code etwas ändert. Der Eintrag hängt an der ARABISCHEN
   Vorderseite — deshalb wirkt eine Änderung sofort ÜBERALL, wo
   dieser Buchstabe vorkommt: in jeder Lektion, auf jeder Karte, in
   jeder Antwortauswahl und in der Buchstaben-Übersicht.

   Der Lernfortschritt bleibt erhalten: Der Karteikasten merkt sich
   Karten an der arabischen Seite, nicht an der Umschrift.

   Die Aussprache wird getrennt davon im 🎙️ Studio aufgenommen
   (app/quranvoice.js) — ebenfalls an der arabischen Seite, also
   ebenfalls überall gültig.
   ============================================================== */
(function () {
  const KEY = 'lern_card_edits_v1';
  let map = {};          // { "ب": { a: "Be (weich)" } }
  let loadedAt = 0;
  const listeners = [];

  try {
    const o = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (o && o.cards) { map = o.cards; loadedAt = o.ts || 0; }
  } catch (e) {}

  function emit() { listeners.forEach(fn => { try { fn(); } catch (e) {} }); }

  /* ---------- alle Kartenlisten der App einsammeln ---------- */
  function allLists() {
    const out = [];
    const push = (topics) => {
      (topics || []).forEach(t => (t.blocks || []).forEach(b => {
        if (Array.isArray(b.cards)) out.push({ t: t, arr: b.cards });
        if (Array.isArray(b.quiz)) out.push({ t: t, arr: b.quiz });
      }));
    };
    push(window.QURAN_TOPICS);
    push(window.QURAN_EXTRA_TOPICS);
    return out;
  }

  /* ---------- Überschreibungen anwenden (direkt am Objekt) ----------
     Wir verändern die vorhandenen Karten-Objekte, statt neue Listen zu
     bauen — dadurch greifen die Änderungen auch in bereits abgeleiteten
     Strukturen (Stapelübersicht, Quiz-Warteschlange) ohne Neuladen. */
  function apply() {
    allLists().forEach(({ arr }) => {
      arr.forEach(item => {
        if (!item || !item.q) return;
        if (item._a0 === undefined) item._a0 = item.a;   // Original merken
        const ov = map[item.q];
        item.a = ov && ov.a ? ov.a : item._a0;
      });
    });
  }

  /* ---------- wo kommt dieser Buchstabe überall vor? ---------- */
  function places(q) {
    const names = [];
    allLists().forEach(({ t, arr }) => {
      if (arr.some(x => x && x.q === q) && names.indexOf(t.name) < 0) names.push(t.name);
    });
    return names;
  }

  /* ---------- durchsuchbare Liste für den Editor ---------- */
  function catalog() {
    const seen = {};
    const out = [];
    allLists().forEach(({ t, arr }) => {
      arr.forEach(item => {
        if (!item || !item.q || seen[item.q]) return;
        seen[item.q] = true;
        if (item._a0 === undefined) item._a0 = item.a;
        out.push({
          q: item.q,
          a: item.a,
          orig: item._a0,
          changed: !!map[item.q],
          topic: t.name,
          topicId: t.id,
        });
      });
    });
    return out;
  }

  /* ---------- vom Server holen ---------- */
  async function refresh(force) {
    if (!force && Date.now() - loadedAt < 5 * 60000 && Object.keys(map).length) { apply(); return; }
    try {
      const SS = window.SimpleSync;
      if (!SS || !SS.req) return;
      const r = await SS.req('cards');
      if (r.body && r.body.ok) {
        map = r.body.cards || {};
        loadedAt = Date.now();
        try { localStorage.setItem(KEY, JSON.stringify({ cards: map, ts: loadedAt })); } catch (e) {}
        apply();
        emit();
      }
    } catch (e) { apply(); }   // offline: gespeicherter Stand gilt weiter
  }

  /* ---------- ändern / zurücksetzen (nur Lehrkraft) ---------- */
  async function set(q, a) {
    const SS = window.SimpleSync;
    try {
      const r = await SS.req('cards', {
        method: 'POST',
        body: JSON.stringify({ tpw: SS.TEACHER_PW, q: q, a: a }),
      });
      if (r.body && r.body.ok) {
        map[q] = { a: a, ts: Date.now() };
        try { localStorage.setItem(KEY, JSON.stringify({ cards: map, ts: Date.now() })); } catch (e) {}
        apply(); emit();
        return { ok: true };
      }
      return { error: (r.body && r.body.error) || 'Speichern fehlgeschlagen' };
    } catch (e) { return { error: 'Server nicht erreichbar' }; }
  }
  async function reset(q) {
    const SS = window.SimpleSync;
    try {
      const r = await SS.req('cards', {
        method: 'POST',
        body: JSON.stringify({ tpw: SS.TEACHER_PW, q: q, del: true }),
      });
      if (r.body && r.body.ok) {
        delete map[q];
        try { localStorage.setItem(KEY, JSON.stringify({ cards: map, ts: Date.now() })); } catch (e) {}
        apply(); emit();
        return { ok: true };
      }
      return { error: (r.body && r.body.error) || 'Zurücksetzen fehlgeschlagen' };
    } catch (e) { return { error: 'Server nicht erreichbar' }; }
  }

  // Gespeicherten Stand sofort anwenden (auch offline), dann frisch holen.
  // Bewusst früh: die geänderte Umschrift soll schon beim ersten Bild stehen.
  apply();
  setTimeout(() => refresh(), 400);
  setTimeout(() => refresh(), 2500);          // falls der Server beim ersten Mal noch schlief
  window.addEventListener('online', () => refresh(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
  });

  window.CardEdits = {
    apply, refresh, set, reset, places, catalog,
    get: (q) => map[q],
    count: () => Object.keys(map).length,
    onChange: (fn) => { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
  };
})();
