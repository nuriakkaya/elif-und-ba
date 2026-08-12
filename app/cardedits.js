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
        if (!item || (!item.q && !item._q0)) return;
        if (item._q0 === undefined) item._q0 = item.q;   // Original-Schreibweise merken
        if (item._a0 === undefined) item._a0 = item.a;   // Original-Umschrift merken
        const ov = map[item._q0];
        // (12.08.2026) Auch die SCHREIBWEISE ist überschreibbar. Der Eintrag
        // hängt IMMER an der Original-Schreibweise (_q0) — dadurch bleibt er
        // stabil, egal wie oft umgeschrieben wird, und der Karteikasten
        // (srs.js schlüsselt auf _q0) verliert keinen Fortschritt.
        item.q = ov && ov.ar ? ov.ar : item._q0;
        item.a = ov && ov.a ? ov.a : item._a0;
      });
    });
  }

  /* ---------- wo kommt dieser Buchstabe überall vor? ---------- */
  function places(key) {
    const names = [];
    allLists().forEach(({ t, arr }) => {
      if (arr.some(x => x && (x._q0 || x.q) === key) && names.indexOf(t.name) < 0) names.push(t.name);
    });
    return names;
  }

  /* ---------- durchsuchbare Liste für den Editor ---------- */
  function catalog() {
    const seen = {};
    const out = [];
    allLists().forEach(({ t, arr }) => {
      arr.forEach(item => {
        if (!item || (!item.q && !item._q0)) return;
        if (item._q0 === undefined) item._q0 = item.q;
        if (item._a0 === undefined) item._a0 = item.a;
        if (seen[item._q0]) return;
        seen[item._q0] = true;
        const ov = map[item._q0] || null;
        out.push({
          key: item._q0,                 // stabiler Schlüssel (Original-Schreibweise)
          q: item.q,                     // aktuelle Schreibweise
          a: item.a,                     // aktuelle Umschrift
          origQ: item._q0,
          origA: item._a0,
          changed: !!ov,
          changedQ: !!(ov && ov.ar),
          changedA: !!(ov && ov.a),
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
  /* set(key, {a, ar}) — nur die tatsächlich geänderten Felder mitgeben.
     a = neue Umschrift, ar = neue Schreibweise. Beides leer -> reset(). */
  async function set(key, ov) {
    const SS = window.SimpleSync;
    const a = String((ov && ov.a) || '').trim();
    const ar = String((ov && ov.ar) || '').trim();
    if (!a && !ar) return reset(key);
    try {
      const r = await SS.req('cards', {
        method: 'POST',
        body: JSON.stringify({ tpw: SS.TEACHER_PW, q: key, a: a || undefined, ar: ar || undefined }),
      });
      if (r.body && r.body.ok) {
        map[key] = { ts: Date.now() };
        if (a) map[key].a = a;
        if (ar) map[key].ar = ar;
        try { localStorage.setItem(KEY, JSON.stringify({ cards: map, ts: Date.now() })); } catch (e) {}
        apply(); emit();
        return { ok: true };
      }
      return { error: (r.body && r.body.error) || 'Speichern fehlgeschlagen' };
    } catch (e) { return { error: 'Server nicht erreichbar' }; }
  }
  async function reset(key) {
    const SS = window.SimpleSync;
    try {
      const r = await SS.req('cards', {
        method: 'POST',
        body: JSON.stringify({ tpw: SS.TEACHER_PW, q: key, del: true }),
      });
      if (r.body && r.body.ok) {
        delete map[key];
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
    get: (key) => map[key],
    count: () => Object.keys(map).length,
    onChange: (fn) => { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
  };
})();
