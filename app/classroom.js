/* ==============================================================
   KLASSENZIMMER (Elif & Ba) — komplett offline, ohne Server.
   Schüler-Seite: erzeugt einen kompakten Fortschritts-Code ('EB2.' +
   Base64-JSON) mit Name, XP, Level, Serie und Fortschritt pro Koran-
   Lektion (aus dem SRS-Karteikasten). Lehrer-Seite: eigene PIN,
   Codes einsammeln (Einfügen, auch mehrere auf einmal), Klassenliste
   in localStorage. Kein Supabase nötig (config.js ist leer).
   ============================================================== */
window.Classroom = (function () {
  const NAME_KEY = 'eb_student_name_v1';
  const ROSTER_KEY = 'eb_class_roster_v1';
  const PIN_KEY = 'eb_teacher_pin_v1';
  const CLASS_KEY = 'eb_class_name_v1';
  function lsGet(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function topics() { return window.QURAN_TOPICS || []; }
  function topicProgress(t) {
    let total = 0, mastered = 0, learning = 0;
    (t.blocks || []).forEach(function (b) { (b.quiz || []).forEach(function (q) {
      total++;
      try {
        const st = window.SRS ? window.SRS.getState(t.id, q).state : 'neu';
        if (st === 'gemeistert') mastered++; else if (st !== 'neu') learning++;
      } catch (e) {}
    }); });
    // Gewichteter Fortschritt (wie überall in der App seit 06.08.2026):
    // jede richtige Wiederholung füllt 1/3 — so sieht die Lehrkraft schon
    // nach der ersten Runde Bewegung, nicht erst nach 3 fehlerfreien Runden.
    let pct = total ? Math.round(100 * mastered / total) : 0;
    try {
      if (window.SRS && window.SRS.progressPct) {
        const qs = [];
        (t.blocks || []).forEach(function (b) { (b.quiz || []).forEach(function (q) { qs.push(q); }); });
        pct = window.SRS.progressPct(t.id, qs);
      }
    } catch (e) {}
    return { total: total, mastered: mastered, learning: learning, pct: pct };
  }
  /* Karten-Beschriftung für die Lehrer-Ansicht ("woran hakt es?") */
  function cardLabel(q) {
    if (!q) return '';
    const front = q.q || q.h || q.f || '';
    const back = q.a || q.b || '';
    return String(back ? (front ? front + ' (' + back + ')' : back) : front).slice(0, 28);
  }

  /* Vollständiger Fortschritts-Schnappschuss eines Kindes.
     Erweitert am 09.08.2026 um genau das, was die Lehrkraft wissen will:
     WO steht das Kind gerade, WIE VIELE Karten sitzen wirklich, WORAN
     hakt es und WANN hat es zuletzt geübt. */
  function snapshot(name) {
    const tp = {}; let sum = 0, n = 0, mc = 0, tc = 0, lc = 0;
    const list = topics();
    const weak = [];
    list.forEach(function (t) {
      const p = topicProgress(t);
      tp[t.id] = { p: p.pct, m: p.mastered, l: p.learning, t: p.total, nm: t.name };
      sum += p.pct; n++; mc += p.mastered; tc += p.total; lc += p.learning;
      if (weak.length < 6) {
        try {
          const qs = [];
          (t.blocks || []).forEach(function (b) { (b.quiz || []).forEach(function (q) { qs.push(q); }); });
          (window.SRS.weakCards(t.id, qs) || []).slice(0, 3).forEach(function (w) {
            if (weak.length < 6) weak.push({ c: cardLabel(w.q), w: w.wrongCount || 0, s: w.state, t: t.name });
          });
        } catch (e) {}
      }
    });
    /* "Wo steht das Kind gerade?" — erste angefangene, sonst erste offene Lektion. */
    let cur = null;
    for (let i = 0; i < list.length; i++) {
      const p = tp[list[i].id];
      if (p && p.p > 0 && p.p < 100) { cur = { id: list[i].id, nm: list[i].name, p: p.p, m: p.m, t: p.t, st: 'lernt' }; break; }
    }
    if (!cur) {
      for (let i = 0; i < list.length; i++) {
        const p = tp[list[i].id];
        if (p && p.p === 0) { cur = { id: list[i].id, nm: list[i].name, p: 0, m: 0, t: p.t, st: 'offen' }; break; }
      }
    }
    if (!cur && list.length) {
      const last = list[list.length - 1];
      cur = { id: last.id, nm: last.name, p: 100, m: tp[last.id].m, t: tp[last.id].t, st: 'fertig' };
    }
    let xp = 0, lvl = 1, streak = 0, d7 = [];
    try { const s = window.XP.state(); xp = s.total != null ? s.total : (s.totalXp != null ? s.totalXp : (s.xp || 0)); } catch (e) {}
    try { const li = window.XP.levelInfo ? window.XP.levelInfo() : null; if (li && li.level) lvl = li.level; } catch (e) {}
    try { const ss = window.XP.streakStatus ? window.XP.streakStatus() : null; if (ss) streak = ss.days != null ? ss.days : (ss.streak != null ? ss.streak : (ss.current || 0)); } catch (e) {}
    try { d7 = (window.XP.recentDays(7) || []).map(function (x) { return x.xp || 0; }); } catch (e) {}
    return { v: 1, n: String(name || '').trim().slice(0, 24) || 'Ohne Namen', d: new Date().toISOString().slice(0, 10),
             xp: xp, lvl: lvl, streak: streak, all: n ? Math.round(sum / n) : 0, tp: tp,
             cur: cur, wk: weak, mc: mc, tc: tc, lc: lc, d7: d7 };
  }
  function encode(name) {
    const json = JSON.stringify(snapshot(name));
    return 'EB2.' + btoa(unescape(encodeURIComponent(json)));
  }
  function decode(code) {
    const c = String(code || '').trim();
    if (c.indexOf('EB2.') !== 0) return null;
    try {
      const o = JSON.parse(decodeURIComponent(escape(atob(c.slice(4)))));
      if (!o || o.v !== 1 || !o.n) return null;
      return o;
    } catch (e) { return null; }
  }
  function roster() { try { return JSON.parse(localStorage.getItem(ROSTER_KEY)) || []; } catch (e) { return []; } }
  function saveRoster(r) { lsSet(ROSTER_KEY, JSON.stringify(r)); }
  // Codes einsammeln: Text darf mehrere Codes (Leerzeichen/Zeilen getrennt) enthalten.
  // Gleicher Name (Groß/klein egal) = Update statt Duplikat.
  function addCodes(text) {
    const parts = String(text || '').split(/\s+/).filter(function (x) { return x.indexOf('EB2.') === 0; });
    const r = roster(); let added = 0, updated = 0, bad = 0;
    parts.forEach(function (p) {
      const o = decode(p);
      if (!o) { bad++; return; }
      o.addedAt = Date.now();
      const i = r.findIndex(function (e) { return e.n.toLowerCase() === o.n.toLowerCase(); });
      if (i >= 0) { r[i] = o; updated++; } else { r.push(o); added++; }
    });
    if (!parts.length) bad++;
    r.sort(function (a, b) { return a.n.localeCompare(b.n, 'de'); });
    saveRoster(r);
    return { added: added, updated: updated, bad: bad };
  }
  function removeStudent(name) {
    saveRoster(roster().filter(function (e) { return e.n !== name; }));
  }
  return {
    getName: function () { return lsGet(NAME_KEY, ''); },
    setName: function (v) { lsSet(NAME_KEY, String(v || '').slice(0, 24)); },
    encode: encode, decode: decode, snapshot: snapshot,
    roster: roster, addCodes: addCodes, removeStudent: removeStudent,
    getPin: function () { return lsGet(PIN_KEY, ''); },
    setPin: function (v) { lsSet(PIN_KEY, String(v || '')); },
    getClassName: function () { return lsGet(CLASS_KEY, 'Meine Klasse'); },
    setClassName: function (v) { lsSet(CLASS_KEY, String(v || '').slice(0, 40)); },
    topics: topics,
  };
})();
