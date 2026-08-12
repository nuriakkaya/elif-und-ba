/* ==============================================================
   🕌 AUSWENDIG LERNEN (Hifz) — Version 8.2, 12.08.2026

   Warum ein EIGENES System (Nutzerwunsch wörtlich): „ein System, das
   ein bisschen anders ist als das Buchstaben-Lernen — einfach, dass
   man die Suren auswendig lernt … und das soll am meisten Punkte
   hergeben."

   Karteikarten fragen EINE Karte aus einem Stapel ab. Auswendiglernen
   funktioniert anders: Man baut einen Text Stück für Stück auf und
   hängt die Stücke aneinander. Genau so ist dieses Modul gebaut — es
   ist die klassische Hafız-Methode („Kettenmethode"), kindgerecht:

   ┌ Für JEDEN Vers nacheinander vier Stufen ─────────────────────┐
   │ 1  👂 Hören & Mitlesen   — zuhören, mitlesen, Klang aufnehmen │
   │ 2  🎤 Nachsprechen       — mit Text vor Augen laut sagen       │
   │ 3  🧩 Wort-Puzzle        — die Wörter in die richtige Folge    │
   │ 4  🌟 Aus dem Kopf       — Text verdeckt, frei aufsagen        │
   └───────────────────────────────────────────────────────────────┘
   Danach immer sofort die KETTE: Vers 1+2 am Stück, dann 1+2+3 …
   Zum Schluss die GANZE Sure am Stück -> 🏆 Krone + großer Bonus.
   Und dann die AUFFRISCHUNG nach 1, 3, 7, 14, 30 Tagen — denn
   auswendig heißt: auch nächsten Monat noch.

   Punkte (bewusst die höchsten der ganzen App):
     Stufe 1/2/3/4 je Vers ....... 10 / 25 / 25 / 60
     jede neue Kettenstufe ....... 40
     ganze Sure geschafft ........ 200 + 100 je bereits gekonnter Sure
                                   (1. Sure 200, 2. Sure 300, 3. 400 …)
     Auffrischung ................ 50
   Der wachsende Abschluss-Bonus ist der Kern des Wunsches „umso mehr
   die Kinder auswendig lernen, umso mehr Punkte": Sure Nummer zehn
   bringt allein 1100 Punkte — mehr als eine ganze Buchstaben-Lektion.

   Ohne Mikrofon geht ALLES trotzdem: Stufe 2 wird zum lauten
   Mitlesen, Stufe 4 zum Blind-Puzzle, die Kette zum Verse-Ordnen.
   Kein Kind steht je vor einer verschlossenen Tür. Siehe app/recite.js.
   ============================================================== */
(function () {
  const { useState, useEffect, useRef, useMemo, useCallback } = React;

  /* ==============================================================
     TEIL A — Der Lernstand (rechnet, speichert, vergibt Punkte)
     ============================================================== */
  const KEY = 'eb_hifz_v1';
  const AUDIO_BASE = 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/';

  const XP_STAGE = [0, 10, 25, 25, 60];   // Index = Stufe
  const XP_LISTEN_ALL = 15;               // die ganze Sure einmal anhören
  const XP_CHAIN = 40;
  const XP_DONE_BASE = 200;
  const XP_DONE_STEP = 100;
  const XP_REFRESH = 50;
  const REP_DAYS = [1, 3, 7, 14, 30];
  /* Zeitfenster fürs Aufsagen (11.08.2026, Nutzerwunsch „das muss in einem
     bestimmten Tempo passieren, geschenkt gibt es nichts"). Grundlage: eine
     ruhige Kinder-Rezitation liegt bei gut 1,5 Sekunden je Wort. Mit 2,2
     Sekunden je Wort plus 3 Sekunden Anlauf ist das großzügig — wer aber Wort
     für Wort entziffert, statt aus dem Kopf zu sprechen, reißt es sicher. */
  function tempoLimit(text) {
    const n = (window.Recite ? window.Recite.words(text) : String(text || '').split(/\s+/)).length || 1;
    return Math.max(6, Math.min(75, Math.round(n * 2.2 + 3)));
  }
  const DAY = 86400000;

  const RANKS = [
    { n: 0,  t: 'Neu dabei',        i: '🌱' },
    { n: 1,  t: 'Hafız-Lehrling',   i: '🌟' },
    { n: 3,  t: 'Suren-Sammler',    i: '📿' },
    { n: 5,  t: 'Namaz-bereit',     i: '🕌' },
    { n: 8,  t: 'Hafız-Meister',    i: '🏅' },
    { n: 12, t: 'Kronenträger',     i: '👑' },
    { n: 18, t: 'Elif & Ba Hafız',  i: '💎' },
  ];

  const listeners = [];
  function emit() { listeners.forEach(function (f) { try { f(); } catch (e) {} }); }
  function onChange(fn) { listeners.push(fn); return function () { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; }

  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (o && typeof o === 'object') {
        o.items = o.items || {};
        // Zähler immer als Zahl — sonst stolpern Anzeige und Abgleich über undefined.
        o.xp = Number(o.xp || 0); o.mic = Number(o.mic || 0); o.self = Number(o.self || 0);
        o.open = Number(o.open || 0);
        return o;
      }
    } catch (e) {}
    return { v: 1, items: {}, xp: 0, mic: 0, self: 0, open: 0 };
  }
  function save(st) { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} emit(); }

  /* Ein Eintrag ist absichtlich rein aus Zahlen gebaut — dadurch kann der
     Geräte-Abgleich (app/simplesync.js) ihn ohne Sonderregel zusammenführen:
     „die höhere Zahl gewinnt" ist hier immer die richtige Antwort. */
  function blank() { return { heard: 0, p: {}, chain: 0, done: 0, doneAt: 0, best: 0, xp: 0, rn: 0, rlast: 0, self: 0 }; }
  function itemState(id) {
    const st = load();
    return Object.assign(blank(), st.items[id] || {});
  }
  function writeItem(id, fn) {
    const st = load();
    const it = Object.assign(blank(), st.items[id] || {});
    fn(it);
    st.items[id] = it;
    save(st);
    return it;
  }

  /* Punkte gutschreiben — fließen in dasselbe Punktekonto wie alles andere
     (Level, Liga, Klassenzimmer), werden aber zusätzlich hier mitgezählt,
     damit die Seite „so viel hast du mit Auswendiglernen verdient" zeigen kann. */
  function award(n, id) {
    if (!n) return 0;
    const st = load();
    st.xp = (st.xp || 0) + n;
    if (id) {
      const it = Object.assign(blank(), st.items[id] || {});
      it.xp = (it.xp || 0) + n;
      st.items[id] = it;
    }
    save(st);
    try { if (window.XP && window.XP.addBonus) window.XP.addBonus(n); } catch (e) {}
    return n;
  }

  function stageOf(id, i) { const it = itemState(id); return Number(it.p[i] || it.p[String(i)] || 0); }

  /* Stufe erreichen. Punkte gibt es nur für NEU erreichte Stufen —
     Wiederholen ist erlaubt und erwünscht, bringt aber nichts doppelt. */
  function reachStage(id, i, stage, opts) {
    opts = opts || {};
    const before = stageOf(id, i);
    if (stage <= before) return { xp: 0, already: true };
    let xp = 0;
    for (let s = before + 1; s <= stage; s++) xp += XP_STAGE[s] || 0;
    /* Halbe Portion, wenn nachgebessert, zu langsam, mit Umschrift-Hilfe oder
       nur selbst bestätigt (11.08.2026, „geschenkt gibt es nichts"). Die Regel
       dahinter ist einfach und fair: VOLLE Punkte gibt es für alles, was die App
       wirklich prüfen kann (Mikrofon flüssig, Puzzle, Verse ordnen) — halbe für
       alles, wo das Kind sich selbst bewertet oder eine Hilfe genutzt hat. */
    if (opts.half || opts.self) xp = Math.round(xp * 0.5);
    writeItem(id, function (it) {
      it.p[i] = stage;
      if (opts.self) it.self = (it.self || 0) + 1;
    });
    if (opts.self) { const st = load(); st.self = (st.self || 0) + 1; save(st); }
    else if (opts.mic) { const st = load(); st.mic = (st.mic || 0) + 1; save(st); }
    award(xp, id);
    return { xp: xp, already: false };
  }

  /* Erstes Kennenlernen: einmal komplett anhören. Öffnet den Weg und gibt
     einen kleinen Startbonus — Zuhören ist beim Auswendiglernen kein Beiwerk,
     sondern der erste echte Lernschritt. */
  function markHeard(id) {
    const it = itemState(id);
    if (it.heard) return { xp: 0, already: true };
    writeItem(id, function (x) { x.heard = 1; });
    return { xp: award(XP_LISTEN_ALL, id), already: false };
  }

  function reachChain(id, k, half) {
    const it = itemState(id);
    if (k <= (it.chain || 0)) return { xp: 0, already: true };
    writeItem(id, function (x) { x.chain = k; });
    return { xp: award(half ? Math.round(XP_CHAIN * 0.5) : XP_CHAIN, id), already: false, half: !!half };
  }

  function doneCount() {
    const st = load();
    return Object.keys(st.items).filter(function (k) { return st.items[k] && st.items[k].done; }).length;
  }
  function completionBonus() { return XP_DONE_BASE + XP_DONE_STEP * doneCount(); }

  /* Wie viele Punkte bringt diese Sure insgesamt, wenn man sie ganz schafft?
     Zuhören + 4 Stufen je Vers + alle Kettenstufen + Abschluss-Bonus. */
  function maxXp(item) {
    if (!item) return 0;
    const n = item.parts.length;
    const stages = XP_STAGE[1] + XP_STAGE[2] + XP_STAGE[3] + XP_STAGE[4];
    return XP_LISTEN_ALL + n * stages + Math.max(0, n - 2) * XP_CHAIN + completionBonus();
  }

  /* Ganze Sure geschafft: Krone, großer Bonus, Auffrischungs-Uhr startet. */
  function finishItem(id, pct, half) {
    const it = itemState(id);
    const now = Date.now();
    if (it.done) {                       // schon gekonnt -> das ist eine Auffrischung
      writeItem(id, function (x) {
        x.rn = (x.rn || 0) + 1; x.rlast = now;
        if (pct > (x.best || 0)) x.best = pct;
      });
      return { xp: award(half ? Math.round(XP_REFRESH * 0.5) : XP_REFRESH, id), refresh: true, half: !!half };
    }
    const bonus = half ? Math.round(completionBonus() * 0.5) : completionBonus();
    writeItem(id, function (x) {
      x.done = 1; x.doneAt = now; x.rlast = now; x.rn = 0;
      x.chain = Math.max(x.chain || 0, 99);
      if (pct > (x.best || 0)) x.best = pct;
      const item = window.HIFZ_BY_ID[id];
      if (item) item.parts.forEach(function (p, i) { if (!(x.p[i] >= 4)) x.p[i] = 4; });
    });
    award(bonus, id);
    return { xp: bonus, refresh: false, rank: rank(), half: !!half };
  }

  function nextRepAt(it) {
    if (!it.done) return 0;
    const d = REP_DAYS[Math.min(it.rn || 0, REP_DAYS.length - 1)];
    return (it.rlast || it.doneAt || 0) + d * DAY;
  }
  function repDue(id) {
    const it = itemState(id);
    if (!it.done) return 0;
    const at = nextRepAt(it);
    return at && Date.now() >= at ? Math.floor((Date.now() - at) / DAY) + 1 : 0;
  }
  /* „Verblasst" = überfällig. Nur eine sanfte Optik, die Krone bleibt IMMER. */
  function freshness(id) {
    const it = itemState(id);
    if (!it.done) return 1;
    const over = repDue(id);
    if (!over) return 1;
    return Math.max(0.35, 1 - over / 21);
  }

  /* Der nächste sinnvolle Schritt — das Herz des „Weiterlernen"-Knopfes. */
  function nextStep(id) {
    const item = window.HIFZ_BY_ID[id];
    if (!item) return null;
    const it = itemState(id);
    const N = item.parts.length;
    if (!it.heard) return { kind: 'listen' };
    for (let i = 0; i < N; i++) {
      const s = Number(it.p[i] || 0);
      if (s < 4) return { kind: 'verse', i: i, stage: s + 1 };
      if (i > 0 && i + 1 < N && (it.chain || 0) < i + 1) return { kind: 'chain', k: i + 1 };
    }
    if (!it.done) return { kind: 'whole' };
    if (repDue(id)) return { kind: 'refresh' };
    return null;
  }

  function progressPct(id) {
    const item = window.HIFZ_BY_ID[id];
    if (!item) return 0;
    const it = itemState(id);
    if (it.done) return 100;
    const N = item.parts.length;
    let steps = 0;
    for (let i = 0; i < N; i++) steps += Math.min(4, Number(it.p[i] || 0));
    const chainMax = Math.max(0, N - 2);
    const chainHave = Math.min(chainMax, Math.max(0, (it.chain || 0) - 1));
    const total = N * 4 + chainMax + 1;      // +1 = die ganze Sure
    return Math.min(99, Math.round(100 * (steps + chainHave) / total));
  }

  function rank() {
    const n = doneCount();
    let r = RANKS[0];
    RANKS.forEach(function (x) { if (n >= x.n) r = x; });
    const next = RANKS.filter(function (x) { return x.n > n; })[0] || null;
    return { n: n, title: r.t, icon: r.i, next: next };
  }

  function summary() {
    const items = window.HIFZ_ITEMS || [];
    const st = load();
    let verses = 0, versesTotal = 0, due = 0, started = 0;
    items.forEach(function (it) {
      versesTotal += it.parts.length;
      const s = st.items[it.id];
      if (!s) return;
      let any = 0;
      it.parts.forEach(function (p, i) { const v = Number(s.p && (s.p[i] || s.p[String(i)]) || 0); if (v > 0) any = 1; if (v >= 4) verses++; });
      if (any || s.done) started++;
      if (repDue(it.id)) due++;
    });
    return { done: doneCount(), total: items.length, verses: verses, versesTotal: versesTotal,
             xp: st.xp || 0, due: due, started: started, rank: rank(), mic: st.mic || 0, self: st.self || 0 };
  }

  /* Kurzfassung fürs Klassenzimmer (app/classroom.js -> Lehrer-Ansicht). */
  function teacherSnapshot() {
    const s = summary();
    const st = load();
    const per = {};
    (window.HIFZ_ITEMS || []).forEach(function (it) {
      const x = st.items[it.id];
      if (!x) return;
      const v = it.parts.filter(function (p, i) { return Number(x.p && (x.p[i] || x.p[String(i)]) || 0) >= 4; }).length;
      if (!v && !x.done) return;
      per[it.id] = { n: it.name, d: x.done ? 1 : 0, v: v, t: it.parts.length, b: x.best || 0, due: repDue(it.id) };
    });
    return { d: s.done, t: s.total, v: s.verses, vt: s.versesTotal, xp: s.xp, r: s.rank.title, self: s.self, per: per };
  }

  /* ==============================================================
     FREISCHALTUNG (12.08.2026, Nutzerwunsch)
     Auswendiglernen ist kein Einstieg, sondern die Kür: Es öffnet sich erst,
     wenn ALLE 17 Elifba-Lektionen einmal auf 100 % stehen — wer die Verse
     auswendig lernt, soll sie vorher lesen können. Der Unendlich-XP-Modus
     (app/infinity.js) verlangt danach noch einen zweiten Durchgang.
     Einmal offen, bleibt offen. Lehrkräfte sehen es immer.
     ============================================================== */
  function courseInfo() {
    const teacher = !!(window.SimpleSync && window.SimpleSync.isTeacher && window.SimpleSync.isTeacher());
    const st = load();
    const list = (window.QuranCourse && window.QuranCourse.ordered()) || [];
    let ok = 0; const missing = [];
    list.forEach(function (t) {
      const qs = [];
      (t.blocks || []).forEach(function (b) { (b.quiz || []).forEach(function (q) { qs.push(q); }); });
      const pct = (window.SRS && window.SRS.progressPct) ? window.SRS.progressPct(t.id, qs) : 0;
      if (pct >= 100) ok++; else missing.push({ name: t.name, pct: pct });
    });
    const earned = list.length > 0 && ok === list.length;
    if (earned && !st.open) { st.open = 1; save(st); }
    return { open: teacher || !!st.open || earned, teacher: teacher && !st.open && !earned,
             done: ok, total: list.length, missing: missing };
  }

  function resetAll() { try { localStorage.removeItem(KEY); } catch (e) {} emit(); }

  window.Hifz = {
    load: load, itemState: itemState, stageOf: stageOf, reachStage: reachStage, reachChain: reachChain,
    finishItem: finishItem, nextStep: nextStep, progressPct: progressPct, summary: summary, rank: rank,
    repDue: repDue, nextRepAt: nextRepAt, freshness: freshness, completionBonus: completionBonus, maxXp: maxXp,
    tempoLimit: tempoLimit,
    teacherSnapshot: teacherSnapshot, onChange: onChange, resetAll: resetAll, award: award,
    courseInfo: courseInfo,
    markHeard: markHeard,
    XP_STAGE: XP_STAGE, XP_CHAIN: XP_CHAIN, XP_REFRESH: XP_REFRESH, XP_LISTEN_ALL: XP_LISTEN_ALL, KEY: KEY,
  };

  /* ==============================================================
     TEIL B — Ton
     Suren: die Vers-Aufnahme von Mischary Alafasy (Internet).
     Gebete: es gibt keine Koran-Aufnahme -> die App nimmt die
     Aufnahme der Lehrkraft, sonst die arabische Systemstimme
     (beides über app/quranaudio.js).
     ============================================================== */
  /* Chrome liefert getVoices() beim ERSTEN Aufruf oft eine leere Liste und
     füllt sie erst nach dem 'voiceschanged'-Ereignis. Vorher haben wir das
     als „keine arabische Stimme" gedeutet und fälschlich einen Fehler gezeigt
     — DAS war der „Zuhören funktioniert nicht"-Eindruck (12.08.2026).
     Jetzt: solange unbekannt, optimistisch abspielen; die Fehlermeldung kommt
     nur noch, wenn sicher KEINE arabische Stimme existiert. */
  let VOICES_AR = null;                        // null = noch unbekannt
  function checkVoices() {
    try {
      const v = (window.speechSynthesis && window.speechSynthesis.getVoices()) || [];
      if (v.length) VOICES_AR = v.some(function (x) { return /^ar/i.test(x.lang || ''); });
    } catch (e) {}
  }
  checkVoices();
  try {
    if (window.speechSynthesis && window.speechSynthesis.addEventListener) {
      window.speechSynthesis.addEventListener('voiceschanged', checkVoices);
    }
  } catch (e) {}

  function useAudio(item) {
    const [playing, setPlaying] = useState(-1);
    const [all, setAll] = useState(false);
    const [failed, setFailed] = useState('');     // Klartext, warum kein Ton kam
    const [source, setSource] = useState('');     // eigen | internet | stimme
    const ref = useRef(null);
    const queue = useRef(false);

    const stop = useCallback(function () {
      queue.current = false;
      setAll(false); setPlaying(-1);
      if (ref.current) { try { ref.current.pause(); } catch (e) {} ref.current = null; }
      try { if (window.QuranVoice) window.QuranVoice.stopAll(); } catch (e) {}
      try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
    }, []);
    useEffect(function () { return stop; }, [stop]);

    /* Reihenfolge (11.08.2026, nach „man hört nichts"):
         1. die Aufnahme der LEHRKRAFT  — liegt auf dem eigenen Server, geht offline
         2. die Rezitation aus dem Internet (Alafasy)
         3. die Systemstimme des Geräts
       Klappt gar nichts, sagen wir das offen statt still zu bleiben. Und es wird
       NICHTS von allein abgespielt: Handys blockieren Ton ohne Fingertipp — genau
       daran lag die Stille. Jeder Ton startet jetzt durch Antippen. */
    const play = useCallback(function (i, opts, onEnd) {
      opts = opts || {};
      if (ref.current) { try { ref.current.pause(); } catch (e) {} ref.current = null; }
      try { if (window.QuranVoice) window.QuranVoice.stopAll(); } catch (e) {}
      const part = item.parts[i];
      if (!part) return;
      setPlaying(i); setFailed('');

      // 1) eigene Aufnahme
      try {
        if (window.QuranVoice && window.QuranVoice.has(part.ar)) {
          const ok = window.QuranVoice.play(part.ar, {
            slow: opts.slow,
            onEnd: function (good) {
              setPlaying(-1);
              if (!good) { setFailed('Die eigene Aufnahme ließ sich nicht abspielen.'); }
              if (onEnd) onEnd(good);
            },
          });
          if (ok) { setSource('eigen'); return; }
        }
      } catch (e) {}

      // 2) Rezitation aus dem Internet
      if (item.audioStart) {
        const a = new Audio(AUDIO_BASE + (item.audioStart + i) + '.mp3');
        ref.current = a;
        if ('preservesPitch' in a) a.preservesPitch = true;
        a.playbackRate = opts.slow ? 0.75 : 1;
        a.onended = function () { setSource('internet'); setPlaying(-1); if (onEnd) onEnd(true); };
        a.onerror = function () { speakFallback(part, opts, onEnd, true); };
        const pr = a.play();
        if (pr && pr.catch) pr.catch(function () { speakFallback(part, opts, onEnd, true); });
        return;
      }

      // 3) Systemstimme
      speakFallback(part, opts, onEnd, false);
    }, [item]);

    function speakFallback(part, opts, onEnd, warEsInternet) {
      let spoke = false;
      try {
        if (window.QuranAudio && window.QuranAudio.speakText) { window.QuranAudio.speakText(part.ar, true, opts); spoke = true; }
      } catch (e) {}
      checkVoices();
      const hatStimme = VOICES_AR !== false;    // unbekannt = optimistisch
      if (!spoke || !hatStimme) {
        setFailed(warEsInternet
          ? 'Die Rezitation aus dem Internet kam nicht durch, und dein Gerät hat keine arabische Stimme. Bitte deine Lehrkraft, die Sure im Aussprache-Studio einzusprechen — dann hörst du sie immer.'
          : 'Für dieses Gebet gibt es noch keine Aufnahme. Deine Lehrkraft kann es im Aussprache-Studio einsprechen.');
      } else setSource('stimme');
      // Die Systemstimme meldet kein sauberes Ende — grob nach Textlänge schätzen.
      const ms = Math.min(14000, 900 + part.ar.length * (opts && opts.slow ? 150 : 95));
      setTimeout(function () { setPlaying(-1); if (onEnd) onEnd(spoke && hatStimme); }, (spoke && hatStimme) ? ms : 500);
    }

    const playAll = useCallback(function (from) {
      if (queue.current) { stop(); return; }
      queue.current = true; setAll(true);
      const step = function (i) {
        if (!queue.current) return;
        if (i >= item.parts.length) { stop(); return; }
        play(i, {}, function () { if (queue.current) setTimeout(function () { step(i + 1); }, 300); });
      };
      step(from || 0);
    }, [item, play, stop]);

    return { playing: playing, all: all, failed: failed, source: source, play: play, playAll: playAll, stop: stop };
  }

  /* ==============================================================
     TEIL C — Bausteine für die Oberfläche
     ============================================================== */
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /* Der große runde Mikrofon-Knopf mit allen Zuständen. */
  function MicButton({ expected, onResult, onSelf, passAt, hint, limitS }) {
    const [phase, setPhase] = useState('idle');    // idle | listening | thinking | error
    const [partial, setPartial] = useState('');
    const [err, setErr] = useState('');
    const [blobUrl, setBlobUrl] = useState('');
    const [left, setLeft] = useState(0);           // Restsekunden im Zeitfenster
    const ctrl = useRef(null);
    const t0 = useRef(0);
    const tick = useRef(null);
    const mode = window.Recite ? window.Recite.mode() : 'none';
    const limit = limitS || 0;
    useEffect(function () { return function () { if (tick.current) clearInterval(tick.current); }; }, []);
    function startClock() {
      t0.current = Date.now();
      if (!limit) return;
      setLeft(limit);
      if (tick.current) clearInterval(tick.current);
      tick.current = setInterval(function () {
        const rest = limit - (Date.now() - t0.current) / 1000;
        setLeft(rest > 0 ? rest : 0);
      }, 100);
    }
    function stopClock() { if (tick.current) { clearInterval(tick.current); tick.current = null; } return (Date.now() - t0.current) / 1000; }

    useEffect(function () { return function () { if (ctrl.current && ctrl.current.abort) ctrl.current.abort(); }; }, []);

    function startSpeech() {
      setPhase('listening'); setPartial(''); setErr('');
      startClock();
      ctrl.current = window.Recite.listen({
        expected: expected,
        maxMs: limit ? Math.round(limit * 1000 + 5000) : 15000,
        onPartial: function (t) { setPartial(t); },
        onDone: function (text) {
          const dauer = stopClock();
          setPhase('thinking');
          // Ohne feste Schwelle: recite.js entscheidet nach Verslänge (12.08.2026).
          const g = window.Recite.grade(expected, text, passAt ? { passAt: passAt } : {});
          g.seconds = Math.round(dauer * 10) / 10;
          g.slow = !!(limit && dauer > limit);
          setTimeout(function () { setPhase('idle'); onResult(g, text); }, 250);
        },
        onError: function (code) {
          stopClock();
          setPhase('error');
          setErr(window.Recite.errorText(code));
        },
      });
    }
    function startRecord() {
      setPhase('listening'); setErr(''); setBlobUrl(''); startClock();
      ctrl.current = window.Recite.record({
        onDone: function (blob, url) { setPhase('idle'); setBlobUrl(url); },
        onError: function (code) { setPhase('error'); setErr(window.Recite.errorText(code)); },
      });
    }
    function stopNow() { if (ctrl.current && ctrl.current.stop) ctrl.current.stop(); }

    if (mode === 'none') {
      return <div className="hz-note">🔇 Mikrofon ist aus — dieser Schritt läuft als Puzzle.</div>;
    }

    if (mode === 'record') {
      return (
        <div className="hz-mic-wrap">
          {!blobUrl && (
            <button className={'hz-mic' + (phase === 'listening' ? ' is-live' : '')}
                    onClick={phase === 'listening' ? stopNow : startRecord}>
              <span className="hz-mic-ico">{phase === 'listening' ? '⏹' : '🎤'}</span>
            </button>
          )}
          <div className="hz-mic-label">
            {phase === 'listening' ? 'Ich nehme auf — sprich jetzt! Danach auf ⏹ tippen.'
              : blobUrl ? 'Hör dir selbst zu und sei ehrlich: Hat es gepasst?'
              : (hint || 'Antippen und aufsagen')}
          </div>
          {blobUrl && (
            <>
              <audio className="hz-audio" src={blobUrl} controls/>
              <div className="hz-row">
                <button className="qp-btn" onClick={function () { onSelf && onSelf(true); }}>👍 Ja, das war richtig</button>
                <button className="btn btn-ghost" onClick={function () { setBlobUrl(''); }}>🔁 Nochmal aufnehmen</button>
              </div>
            </>
          )}
          {err && <div className="hz-err">{err}</div>}
        </div>
      );
    }

    return (
      <div className="hz-mic-wrap">
        <button className={'hz-mic' + (phase === 'listening' ? ' is-live' : '') + (phase === 'thinking' ? ' is-think' : '')}
                onClick={phase === 'listening' ? stopNow : startSpeech} disabled={phase === 'thinking'}>
          <span className="hz-mic-ico">{phase === 'listening' ? '⏹' : phase === 'thinking' ? '⏳' : '🎤'}</span>
        </button>
        <div className="hz-mic-label">
          {phase === 'listening' ? 'Ich höre dich…' : phase === 'thinking' ? 'Einen Moment…' : (hint || 'Antippen und aufsagen')}
        </div>
        {limit > 0 && phase !== 'listening' && (
          <div className="hz-tempo-hint">⏱ Du hast {limit} Sekunden — sag es flüssig, nicht buchstabierend.</div>
        )}
        {limit > 0 && phase === 'listening' && (
          <div className={'hz-tempo' + (left <= 0 ? ' is-over' : '')}>
            <div className="hz-tempo-bar"><div style={{ width: Math.max(0, Math.min(100, 100 * left / limit)) + '%' }}/></div>
            <span>{left > 0 ? Math.ceil(left) + ' s' : 'zu langsam'}</span>
          </div>
        )}
        {phase === 'listening' && partial && <div className="hz-partial" dir="rtl">{partial}</div>}
        {err && (
          <div className="hz-err">
            {err}
            <div style={{ marginTop: 8 }}><button className="btn btn-ghost" onClick={function () { setPhase('idle'); setErr(''); }}>Nochmal versuchen</button></div>
          </div>
        )}
      </div>
    );
  }

  /* Wort-für-Wort-Rückmeldung nach dem Sprechen. */
  function WordFeedback({ marks }) {
    if (!marks || !marks.length) return null;
    return (
      <div className="hz-feedback" dir="rtl">
        {marks.map(function (m, i) {
          const cls = m.st === 'ok' ? 'ok' : m.st === 'fast' ? 'near' : 'miss';
          return <span key={i} className={'hz-fw is-' + cls}>{m.w}</span>;
        })}
      </div>
    );
  }

  /* Wort-Puzzle: die Bausteine in die richtige Reihenfolge tippen. */
  function WordPuzzle({ words, onDone, showHint, distractors }) {
    const pool = useMemo(function () {
      const base = words.map(function (w, i) { return { ar: w[0], tr: w[1], idx: i }; });
      const extra = (distractors || []).map(function (w, i) { return { ar: w, tr: '', idx: -1 - i }; });
      return shuffle(base.concat(extra));
    }, [words, distractors]);
    const [placed, setPlaced] = useState([]);
    const [shake, setShake] = useState(-1);
    const [wrongs, setWrongs] = useState(0);

    const next = placed.length;
    function tap(t) {
      if (t.idx === next) {
        const np = placed.concat([t]);
        setPlaced(np);
        try { if (window.Sound) window.Sound.correct(); } catch (e) {}
        if (np.length === words.length) setTimeout(function () { onDone(wrongs); }, 420);
      } else {
        setShake(t.idx); setWrongs(function (w) { return w + 1; });
        try { if (window.Sound) window.Sound.wrong(); } catch (e) {}
        setTimeout(function () { setShake(-1); }, 420);
      }
    }
    const usedIdx = {};
    placed.forEach(function (p) { usedIdx[p.idx] = 1; });

    return (
      <div className="hz-puz">
        <div className="hz-puz-line" dir="rtl">
          {placed.length === 0 && <span className="hz-puz-empty">Tippe das erste Wort an …</span>}
          {placed.map(function (p, i) {
            return <span key={i} className="hz-tile is-set">{p.ar}{p.tr ? <em>{p.tr}</em> : null}</span>;
          })}
        </div>
        <div className="hz-puz-pool" dir="rtl">
          {pool.map(function (t, i) {
            if (usedIdx[t.idx]) return <span key={i} className="hz-tile is-used"/>;
            return (
              <button key={i} className={'hz-tile' + (shake === t.idx ? ' is-shake' : '')} onClick={function () { tap(t); }}>
                {t.ar}{t.tr ? <em>{t.tr}</em> : null}
              </button>
            );
          })}
        </div>
        {showHint && placed.length === 0 && <div className="hz-note">💡 Tipp: Sag den Vers leise mit, dann findest du das nächste Wort von selbst.</div>}
      </div>
    );
  }

  /* Verse in die richtige Reihenfolge bringen (Kette ohne Mikrofon). */
  function OrderVerses({ parts, onDone }) {
    const pool = useMemo(function () { return shuffle(parts.map(function (p, i) { return { p: p, idx: i }; })); }, [parts]);
    const [placed, setPlaced] = useState([]);
    const [shake, setShake] = useState(-1);
    const used = {}; placed.forEach(function (x) { used[x.idx] = 1; });
    function tap(t) {
      if (t.idx === placed.length) {
        const np = placed.concat([t]); setPlaced(np);
        try { if (window.Sound) window.Sound.correct(); } catch (e) {}
        if (np.length === parts.length) setTimeout(function () { onDone(); }, 420);
      } else {
        setShake(t.idx); try { if (window.Sound) window.Sound.wrong(); } catch (e) {}
        setTimeout(function () { setShake(-1); }, 420);
      }
    }
    return (
      <div>
        <div className="hz-ord-done">
          {placed.map(function (x, i) { return <div key={i} className="hz-ord-row is-set"><b>{i + 1}</b><span dir="rtl">{x.p.ar}</span></div>; })}
        </div>
        <div className="hz-ord-pool">
          {pool.map(function (t, i) {
            if (used[t.idx]) return null;
            return <button key={i} className={'hz-ord-row' + (shake === t.idx ? ' is-shake' : '')} onClick={function () { tap(t); }}>
              <b>?</b><span dir="rtl">{t.p.ar}</span>
            </button>;
          })}
        </div>
      </div>
    );
  }

  /* ==============================================================
     TEIL D — Der Übungs-Bildschirm (eine Stufe nach der anderen)
     ============================================================== */
  const STAGE_INFO = [
    null,
    { ic: '👂', t: 'Hören & Mitlesen', s: 'Hör genau hin und lies mit. Der Klang ist der halbe Weg.' },
    { ic: '🎤', t: 'Nachsprechen',     s: 'Jetzt du — sag es laut nach. Der Text darf dabei vor dir stehen.' },
    { ic: '🧩', t: 'Wort-Puzzle',      s: 'Der Vers ist zugedeckt — bau ihn aus den Wörtern wieder auf. Spicken ist erlaubt.' },
    { ic: '🌟', t: 'Aus dem Kopf',     s: 'Der Text ist verdeckt. Sag den Vers frei auf!' },
  ];

  function Practice({ item, step, onFinish, onExit }) {
    const audio = useAudio(item);
    const mode = window.Recite ? window.Recite.mode() : 'none';
    const [result, setResult] = useState(null);   // {level, pct, marks}
    const [tries, setTries] = useState(0);
    const [heardOnce, setHeardOnce] = useState(false);
    const [peek, setPeek] = useState(false);
    const [helped, setHelped] = useState(false);  // Umschrift eingeblendet -> halbe Punkte
    const [reward, setReward] = useState(null);
    const [toast, setToast] = useState(null);     // kleine Zwischenmeldung statt großer Seite
    const autoPlayed = useRef(false);
    const autoNext = useRef(null);
    useEffect(function () { return function () { if (autoNext.current) clearTimeout(autoNext.current); }; }, []);

    const isVerse = step.kind === 'verse';
    const isListen = step.kind === 'listen';
    const part = isVerse ? item.parts[step.i] : null;
    const chainTo = step.kind === 'chain' ? step.k : (step.kind === 'whole' || step.kind === 'refresh' ? item.parts.length : 0);
    const chainParts = chainTo ? item.parts.slice(0, chainTo) : [];
    const expected = isVerse ? part.ar : chainParts.map(function (p) { return p.ar; }).join(' ');
    const stage = isVerse ? step.stage : 4;

    /* KEIN Auto-Abspielen mehr (11.08.2026, „man hört nichts"): Handys und
       iPads blockieren jeden Ton, der nicht direkt aus einem Fingertipp kommt —
       die App wirkte deshalb stumm. Jeder Ton startet jetzt per Knopf; erst nach
       einem echten Abspielversuch geht es weiter. */
    function hoeren(opts) {
      autoPlayed.current = true;
      if (isListen) { audio.playAll(0); setTimeout(function () { setHeardOnce(true); }, 1200); return; }
      audio.play(step.i, opts || {}, function () { setHeardOnce(true); });
      setTimeout(function () { setHeardOnce(true); }, 2500);   // auch bei stummem Gerät nicht feststecken
    }
    useEffect(function () { if (isListen && autoPlayed.current && !audio.all) setHeardOnce(true); }, [isListen, audio.all]);

    function finish(xpInfo, extra) {
      const info = Object.assign({ xp: 0 }, xpInfo, extra || {});
      /* Beta-Gefühl raus (12.08.2026): Die kleinen Zwischenschritte (zuhören,
         Stufe 1–3 eines Verses) unterbrechen nicht mehr mit einer ganzen
         Belohnungsseite. Stattdessen: kurzes Häkchen mit +XP, und nach gut
         einer Sekunde geht es VON SELBST beim nächsten Schritt weiter.
         Die große Seite mit Feier bleibt für die Momente, die sie verdienen:
         frei aufgesagt (Stufe 4), Kette, ganze Sure, Auffrischung. */
      const klein = isListen || (step.kind === 'verse' && stage < 4);
      if (klein) {
        setToast(info);
        autoNext.current = setTimeout(function () { onFinish(true); }, 1150);
        return;
      }
      setReward(info);
    }

    /* ---- die einzelnen Stufen ---- */
    function doneStage(opts) {
      const r = window.Hifz.reachStage(item.id, step.i, stage, opts || {});
      try { if (window.Sound) (stage >= 4 ? window.Sound.roundEnd() : window.Sound.correct()); } catch (e) {}
      if (stage >= 4) { try { if (window.Celebrate) window.Celebrate.burst(); } catch (e) {} }
      finish(r);
    }
    function doneChain(half) {
      const r = window.Hifz.reachChain(item.id, step.k, half);
      try { if (window.Sound) window.Sound.roundEnd(); } catch (e) {}
      try { if (window.Celebrate) window.Celebrate.burst(); } catch (e) {}
      finish(r, { chain: step.k });
    }
    function doneWhole(pct, half) {
      const r = window.Hifz.finishItem(item.id, pct || 0, half);
      try { if (window.Sound && window.Sound.stackMastered) window.Sound.stackMastered(); } catch (e) {}
      try { if (window.Celebrate) window.Celebrate.bigCelebration({ count: r.refresh ? 40 : 110 }); } catch (e) {}
      finish(r, { whole: true, refresh: r.refresh });
    }

    function handleSpeech(g) {
      setResult(g);
      setTries(function (t) { return t + 1; });
      // „gut" entscheidet die Bewertung selbst (längenabhängig, siehe recite.js).
      // Beim zweiten Anlauf reicht „fast" — dann aber nur die halbe Punktzahl.
      const bestanden = g.level === 'gut' || (tries >= 1 && g.level === 'fast');
      if (bestanden) {
        // Halbe Punkte, wenn nur knapp getroffen, wenn zu langsam gesprochen
        // (das war Lesen, nicht Aufsagen) oder wenn die Umschrift eingeblendet war.
        const half = g.level !== 'gut' || !!g.slow || helped;
        try { if (window.Sound) window.Sound.correct(); } catch (e) {}
        setTimeout(function () {
          if (step.kind === 'verse') {
            const r = window.Hifz.reachStage(item.id, step.i, stage, { half: half, mic: true });
            if (stage >= 4) { try { if (window.Celebrate) window.Celebrate.burst(); } catch (e) {} }
            finish(r, { pct: g.pct, slow: g.slow, helped: helped });
          } else if (step.kind === 'chain') doneChain(g.slow || helped);
          else doneWhole(g.pct, g.slow || helped);
        }, g.slow ? 2000 : 1000);
      } else {
        try { if (window.Sound) window.Sound.wrong(); } catch (e) {}
      }
    }
    function handleSelf() {
      if (step.kind === 'verse') { const r = window.Hifz.reachStage(item.id, step.i, stage, { self: true }); finish(r, { self: true }); }
      else if (step.kind === 'chain') doneChain(true);
      else doneWhole(0, true);
    }

    /* ---- kleine Zwischenmeldung (Auto-Weiter) ---- */
    if (toast) {
      return (
        <div className="hz-prac">
          <div className="hz-toast">
            <div className="hz-toast-ico">✅</div>
            <div className="hz-toast-txt">
              {toast.xp > 0 ? <b>+{toast.xp} XP</b> : <b>Geübt!</b>}
              {toast.half || toast.slow || toast.self ? <em>halbe Punkte</em> : null}
            </div>
            <div className="hz-toast-sub">weiter …</div>
          </div>
        </div>
      );
    }

    /* ---- Belohnungs-Bildschirm ---- */
    if (reward) {
      const nxt = window.Hifz.nextStep(item.id);
      return (
        <div className="hz-reward">
          <div className="hz-reward-ico">{isListen ? '👂' : reward.whole ? (reward.refresh ? '🔁' : '🏆') : reward.chain ? '🔗' : stage >= 4 ? '🌟' : '✅'}</div>
          <h2>{isListen ? 'Gut zugehört!'
            : reward.whole
            ? (reward.refresh ? 'Sitzt immer noch!' : 'Maschallah — du kannst sie auswendig!')
            : reward.chain ? ('Kette geschafft: Vers 1 bis ' + reward.chain + ' am Stück!')
            : stage >= 4 ? 'Aus dem Kopf — stark!' : 'Geschafft!'}</h2>
          {reward.xp > 0
            ? <div className="hz-reward-xp">+{reward.xp} XP</div>
            : <div className="muted">Diese Stufe hattest du schon — Üben ist trotzdem gut!</div>}
          {reward.whole && !reward.refresh && (
            <div className="hz-reward-sub">
              Du hast jetzt <b>{window.Hifz.rank().n}</b> von {(window.HIFZ_ITEMS || []).length} auswendig ·
              Rang: <b>{window.Hifz.rank().icon} {window.Hifz.rank().title}</b><br/>
              <span className="muted">Die nächste Sure bringt dir sogar {window.Hifz.completionBonus()} XP.</span>
            </div>
          )}
          {reward.self && <div className="muted" style={{ marginTop: 6 }}>Selbst bestätigt (ohne Mikrofon) — dafür gibt es die halbe Punktzahl, und deine Lehrkraft sieht es.</div>}
          {reward.slow && <div className="muted" style={{ marginTop: 6 }}>🐌 Zu langsam gesprochen — halbe Punktzahl. Flüssig aufgesagt zählt voll!</div>}
          {reward.helped && !reward.slow && <div className="muted" style={{ marginTop: 6 }}>👀 Mit Umschrift-Hilfe — halbe Punktzahl.</div>}
          <div className="hz-row" style={{ marginTop: 18 }}>
            {nxt && <button className="qp-btn" onClick={function () { onFinish(true); }}>▶️ Weiter</button>}
            <button className="btn btn-ghost" onClick={function () { onFinish(false); }}>Zur Übersicht</button>
          </div>
        </div>
      );
    }

    const info = STAGE_INFO[stage];
    const title = step.kind === 'verse' ? (info.ic + ' ' + info.t)
      : isListen ? '👂 Erst einmal zuhören'
      : step.kind === 'chain' ? '🔗 Die Kette'
      : step.kind === 'refresh' ? '🔁 Auffrischung'
      : '🏆 Die ganze ' + (item.kind === 'sure' ? 'Sure' : 'Dua');
    const sub = step.kind === 'verse' ? info.s
      : isListen ? 'Lehn dich zurück und hör die ganze ' + (item.kind === 'sure' ? 'Sure' : 'Dua') + ' einmal an. Lies dabei ruhig mit — der Klang bleibt hängen.'
      : step.kind === 'chain' ? ('Sag Vers 1 bis ' + step.k + ' am Stück auf — ohne Pause dazwischen.')
      : step.kind === 'refresh' ? 'Kannst du sie noch? Einmal komplett aufsagen genügt.'
      : 'Jetzt alles am Stück — von vorne bis hinten, aus dem Kopf.';

    /* Ab Stufe 3 ist der Vers zugedeckt — sonst wäre das Puzzle bloßes Abschreiben
       und die Leiter würde nicht schwerer, sondern nur länger. Spicken bleibt
       jederzeit möglich und kostet nichts. */
    const hidden = !isListen && ((step.kind === 'verse' && stage >= 3 && !peek) || (step.kind !== 'verse' && !peek));

    /* ---- Zuhör-Schritt: die ganze Sure zum Mitlesen ---- */
    if (isListen) {
      return (
        <div className="hz-prac">
          <div className="hz-prac-top">
            <button className="btn btn-ghost" onClick={onExit}>← Zurück</button>
            <div className="hz-prac-title"><b>{title}</b><span className="muted">{item.name}</span></div>
            <span className="pill">+{XP_LISTEN_ALL} XP</span>
          </div>
          <div className="hz-prac-sub">{sub}</div>
          <div className="hz-row">
            <button className="qp-btn" onClick={function () { audio.all ? audio.stop() : hoeren(); }}>
              {audio.all ? '⏹ Stopp' : '🔊 Jetzt anhören'}
            </button>
          </div>
          <div style={{ marginTop: 12 }}>
            {item.kind === 'sure' && item.n !== 1 && <div className="sur-basmala" dir="rtl">{window.SURAH_BASMALA}</div>}
            {item.parts.map(function (p, i) {
              return (
                <div key={i} className={'sur-ayah' + (audio.playing === i ? ' is-playing' : '')}>
                  <div className="sur-ayah-ar" dir="rtl">{p.ar}</div>
                  <div className="sur-ayah-tr">{p.tr}</div>
                  <div className="sur-ayah-de">{p.de}</div>
                </div>
              );
            })}
          </div>
          {audio.failed && <div className="hz-err">🔇 {audio.failed}</div>}
          <button className="qp-btn hz-primary" disabled={!heardOnce}
                  onClick={function () { const r = window.Hifz.markHeard(item.id); try { if (window.Sound) window.Sound.correct(); } catch (e) {} finish(r); }}>
            {heardOnce ? '✅ Ich habe zugehört — los geht’s!' : '⏳ Hör erst einmal zu …'}
          </button>
          <div className="hz-mode-note">{window.Recite ? window.Recite.modeLabel() : ''}</div>
        </div>
      );
    }

    return (
      <div className="hz-prac">
        <div className="hz-prac-top">
          <button className="btn btn-ghost" onClick={onExit}>← Zurück</button>
          <div className="hz-prac-title">
            <b>{title}</b>
            <span className="muted">{item.name}{step.kind === 'verse' ? ' · Vers ' + (step.i + 1) + ' von ' + item.parts.length : ''}</span>
            {isVerse && (
              <span className="hz-stagechips">
                {[1, 2, 3, 4].map(function (k) {
                  return <em key={k} className={k < stage ? 'is-done' : k === stage ? 'is-now' : ''}>{STAGE_INFO[k].ic}</em>;
                })}
              </span>
            )}
          </div>
          <span className="pill">{step.kind === 'verse' ? '+' + (XP_STAGE[stage] || 0) : step.kind === 'chain' ? '+' + XP_CHAIN : step.kind === 'refresh' ? '+' + XP_REFRESH : '+' + window.Hifz.completionBonus()} XP</span>
        </div>
        <div className="hz-prac-sub">{sub}</div>

        {/* --- Der Text --- */}
        {/* Beim NACHSPRECHEN steht nur noch das Arabische da (Nutzerwunsch
            11.08.2026): Wer die Umschrift mitliest, liest — er sagt nicht auf.
            Umschrift und Deutsch gibt es in der Hör-Stufe, und auf Knopfdruck
            als Hilfe — dann aber nur die halbe Punktzahl. */}
        {isVerse ? (
          <div className={'hz-verse' + (hidden ? ' is-hidden' : '')}>
            <div className="hz-ar" dir="rtl">{hidden ? item.parts[step.i].w[0][0] + ' …' : part.ar}</div>
            {!hidden && (stage === 1 || helped) && <div className="hz-tr">{part.tr}</div>}
            {!hidden && stage === 1 && <div className="hz-de">{part.de}</div>}
            {!hidden && stage === 2 && !helped && <div className="hz-onlyar">Nur Arabisch — genau darum geht es.</div>}
            {hidden && <div className="hz-note">Nur das erste Wort steht da — der Rest kommt aus deinem Kopf.</div>}
          </div>
        ) : (
          <div className={'hz-verse' + (hidden ? ' is-hidden' : '')}>
            {hidden
              ? <div className="hz-ar" dir="rtl">{chainParts.map(function (p, i) { return (i ? ' … ' : '') + p.w[0][0]; }).join('')} …</div>
              : chainParts.map(function (p, i) { return <div key={i} className="hz-ar hz-ar-sm" dir="rtl">{p.ar}</div>; })}
          </div>
        )}

        {/* --- Bedienung je nach Stufe --- */}
        {isVerse && stage === 1 && (
          <>
            <div className="hz-row">
              <button className="qp-btn" onClick={function () { hoeren(); }}>
                {audio.playing === step.i ? '🔊 läuft …' : autoPlayed.current ? '🔊 Nochmal hören' : '🔊 Vers anhören'}
              </button>
              <button className="btn btn-ghost" onClick={function () { hoeren({ slow: true }); }}>🐢 Langsam</button>
            </div>
            {audio.failed && <div className="hz-err">🔇 {audio.failed}</div>}
            <button className="qp-btn hz-primary" disabled={!heardOnce} onClick={function () { doneStage(); }}>
              {heardOnce ? '✅ Ich habe gut zugehört' : '⏳ Tippe erst auf „Vers anhören"'}
            </button>
          </>
        )}

        {isVerse && stage === 2 && (
          <>
            <div className="hz-row">
              <button className="qp-btn" onClick={function () { audio.play(step.i); }}>🔊 Vormachen</button>
              <button className="btn btn-ghost" onClick={function () { audio.play(step.i, { slow: true }); }}>🐢 Langsam</button>
              {!helped && <button className="btn btn-ghost" onClick={function () { setHelped(true); }}>👀 Umschrift (halbe Punkte)</button>}
            </div>
            {audio.failed && <div className="hz-err">🔇 {audio.failed}</div>}
            {mode === 'none'
              ? <>
                  <div className="hz-note">Sag den Vers laut mit — deine Lehrkraft hat das Mikrofon ausgeschaltet. Selbst bestätigt gibt es die halbe Punktzahl.</div>
                  <button className="qp-btn hz-primary" onClick={function () { doneStage({ self: true }); }}>✅ Ich habe ihn laut nachgesprochen</button>
                </>
              : <MicButton expected={expected} limitS={window.Hifz.tempoLimit(expected)}
                           hint="Antippen und den Vers nachsprechen"
                           onResult={handleSpeech} onSelf={handleSelf}/>}
          </>
        )}

        {isVerse && stage === 3 && (
          <>
            <div className="hz-row">
              <button className="btn btn-ghost" onClick={function () { audio.play(step.i); }}>🔊 Nochmal hören</button>
              {!peek && <button className="btn btn-ghost" onClick={function () { setPeek(true); }}>👀 Kurz spicken</button>}
            </div>
            <WordPuzzle words={part.w} showHint onDone={function () { doneStage(); }}/>
          </>
        )}

        {isVerse && stage === 4 && (
          <>
            {mode === 'speech' || mode === 'record'
              ? <>
                  <MicButton expected={expected} limitS={window.Hifz.tempoLimit(expected)}
                             hint="Antippen und frei aufsagen"
                             onResult={handleSpeech} onSelf={handleSelf}/>
                  {!peek && <button className="btn btn-ghost" style={{ marginTop: 6 }} onClick={function () { setPeek(true); }}>👀 Kurz spicken</button>}
                </>
              : <>
                  <div className="hz-note">🧩 Blind-Puzzle: Setz den Vers zusammen, ohne ihn vorher zu sehen. Das prüft die App wirklich — deshalb gibt es volle Punkte.</div>
                  <WordPuzzle words={part.w}
                              distractors={(function () {
                                const other = [];
                                item.parts.forEach(function (p, k) { if (k !== step.i) p.w.forEach(function (w) { other.push(w[0]); }); });
                                return shuffle(other).slice(0, Math.min(3, other.length));
                              })()}
                              onDone={function () { doneStage(); }}/>
                </>}
          </>
        )}

        {!isVerse && (
          mode === 'none'
            ? <>
                <div className="hz-note">🧩 Ohne Mikrofon: Bring die Verse in die richtige Reihenfolge. Auch das prüft die App — volle Punkte.</div>
                <OrderVerses parts={chainParts} onDone={function () { if (step.kind === 'chain') doneChain(false); else doneWhole(0, false); }}/>
              </>
            : <>
                <MicButton expected={expected} limitS={window.Hifz.tempoLimit(expected)}
                           hint={step.kind === 'chain' ? 'Antippen und Vers 1 bis ' + step.k + ' aufsagen' : 'Antippen und alles am Stück aufsagen'}
                           onResult={handleSpeech} onSelf={handleSelf}/>
                {!peek && <button className="btn btn-ghost" style={{ marginTop: 6 }} onClick={function () { setPeek(true); }}>👀 Kurz spicken</button>}
              </>
        )}

        {/* --- Rückmeldung nach dem Sprechen --- */}
        {result && (
          <div className={'hz-result is-' + result.level}>
            <div className="hz-result-head">
              <b>{result.level === 'gut' ? (result.slow ? '🐌 Richtig — aber zu langsam' : '🎉 Sehr gut!') : result.level === 'fast' ? '🙂 Fast!' : '💪 Nochmal!'}</b>
              <span>{result.pct}% richtig{result.seconds ? ' · ' + result.seconds + ' s' : ''}</span>
            </div>
            <WordFeedback marks={result.marks}/>
            {result.heard && (
              <div className="hz-heard">
                Verstanden: <span dir="rtl">{result.heard}</span>
              </div>
            )}
            {result.level === 'gut' && result.slow && (
              <div className="hz-result-tip">
                Das war eher Lesen als Aufsagen — deshalb gibt es nur die halbe Punktzahl.
                Hör dir den Vers nochmal an und sprich ihn flüssig am Stück, dann zählt er voll.
              </div>
            )}
            {result.level !== 'gut' && (
              <div className="hz-result-tip">
                {result.level === 'fast'
                  ? 'Ganz nah dran — die blassen Wörter fehlten noch. Beim nächsten Versuch zählt es ab 60 %.'
                  : 'Hör dir den Vers nochmal an und sprich langsam mit.'}
              </div>
            )}
            {result.level !== 'gut' && (
              <div className="hz-row">
                <button className="btn btn-ghost" onClick={function () { isVerse ? audio.play(step.i, { slow: true }) : audio.playAll(0); }}>🔊 Nochmal vormachen</button>
                <button className="btn btn-ghost" onClick={function () { setResult(null); }}>🎤 Neuer Versuch</button>
              </div>
            )}
          </div>
        )}

        <div className="hz-mode-note">{window.Recite ? window.Recite.modeLabel() : ''}</div>
      </div>
    );
  }

  /* ==============================================================
     TEIL D½ — 🎙️ TON-TAB (12.08.2026)

     Nutzerwunsch wörtlich: „Sübhaneke ist noch mit \'ner Computerstimme —
     da hätte ich gern die Option, das selber aufzunehmen."

     Die Suren aus dem Koran haben eine echte Rezitation aus dem Internet.
     Die NAMAZ-GEBETE (Sübhâneke, Ettehiyyâtü, Salli, Bârik, Rabbenâ …)
     gibt es in keiner Koran-Aufnahme — ohne eigene Aufnahme bleibt dort
     nur die Computerstimme. Deshalb kann die Lehrkraft jetzt DIREKT in
     der Sure einsprechen, Vers für Vers: aufnehmen, probehören,
     übernehmen oder verwerfen, löschen. Die Aufnahme liegt auf dem
     eigenen Server und spielt ab sofort ÜBERALL zuerst — beim Zuhören,
     beim Vormachen, offline. (Dasselbe geht weiter auch im Studio.)
     ============================================================== */
  function istLehrkraft() {
    try { return !!(window.SimpleSync && window.SimpleSync.isTeacher()); } catch (e) { return false; }
  }
  function partsRecorded(item) {
    const QV = window.QuranVoice;
    if (!QV) return 0;
    return item.parts.filter(function (p) { return QV.has(p.ar); }).length;
  }

  function PartRecorder({ item, part, i, audio }) {
    const QV = window.QuranVoice;
    const [rec, setRec] = useState(false);
    const [secs, setSecs] = useState(0);
    const [take, setTake] = useState(null);      // {blob, url}
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [, force] = useState(0);
    const recRef = useRef(null);
    const tickRef = useRef(null);
    const playRef = useRef(null);
    useEffect(function () {
      return function () {
        try { recRef.current && recRef.current.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
        if (tickRef.current) clearInterval(tickRef.current);
      };
    }, []);
    if (!QV) return null;
    const has = QV.has(part.ar);

    const discard = function () { if (take && take.url) URL.revokeObjectURL(take.url); setTake(null); };
    const start = async function () {
      setErr(''); discard();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', ''].find(function (m) { return !m || (window.MediaRecorder && MediaRecorder.isTypeSupported(m)); });
        const mr = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 64000 } : undefined);
        const chunks = [];
        mr.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        mr.onstop = function () {
          stream.getTracks().forEach(function (t) { t.stop(); });
          if (tickRef.current) clearInterval(tickRef.current);
          setRec(false);
          const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
          if (blob.size < 1200) { setErr('Die Aufnahme war zu kurz — bitte nochmal.'); return; }
          setTake({ blob: blob, url: URL.createObjectURL(blob) });
        };
        recRef.current = { mr: mr, stream: stream };
        mr.start();
        setRec(true); setSecs(0);
        tickRef.current = setInterval(function () { setSecs(function (x) { return x + 1; }); }, 1000);
        // Verse sind länger als Buchstaben: bis 30 Sekunden, dann Auto-Stopp.
        setTimeout(function () { try { if (recRef.current && recRef.current.mr === mr && mr.state === 'recording') mr.stop(); } catch (e) {} }, 30000);
      } catch (e) { setErr('Mikrofon nicht verfügbar — bitte den Zugriff erlauben.'); }
    };
    const stop = function () { try { recRef.current && recRef.current.mr.state === 'recording' && recRef.current.mr.stop(); } catch (e) {} };
    const playTake = function () {
      if (!take) return;
      if (playRef.current) { try { playRef.current.pause(); } catch (e) {} }
      playRef.current = new Audio(take.url);
      playRef.current.play().catch(function () {});
    };
    const keep = async function () {
      if (!take) return;
      setBusy(true); setErr('');
      const r = await QV.put(part.ar, take.blob);
      setBusy(false);
      if (r.ok) discard();
      else setErr(r.error || 'Hochladen fehlgeschlagen — läuft die App über die Netlify-Adresse?');
      force(function (x) { return x + 1; });
    };
    const remove = async function () {
      setBusy(true); setErr('');
      const r = await QV.del(part.ar);
      setBusy(false);
      if (!r.ok) setErr(r.error || 'Löschen fehlgeschlagen.');
      force(function (x) { return x + 1; });
    };

    const chip = has
      ? <span className="pill" style={{ background: 'var(--success-soft, #E7F7EE)', color: 'var(--success, #1B8A5A)', fontWeight: 800 }}>🎙️ deine Aufnahme</span>
      : item.audioStart
        ? <span className="pill" style={{ background: '#E3EFFA', color: '#2364A5', fontWeight: 800 }}>🌐 Internet-Rezitation</span>
        : <span className="pill" style={{ background: '#FDF1E0', color: '#8a5a06', fontWeight: 800 }}>🗣 Computerstimme</span>;

    return (
      <div className="hz-ton-row">
        <div className="hz-ton-head">
          <b>{item.kind === 'sure' ? 'Vers ' : 'Teil '}{i + 1}</b>
          {chip}
        </div>
        <div className="hz-ton-ar" dir="rtl">{part.ar}</div>
        <div className="hz-ton-tr">{part.tr}</div>
        {!rec && !take && (
          <div className="hz-row" style={{ marginTop: 8 }}>
            <button className="btn btn-ghost" onClick={function () { audio.play(i); }}>▶️ So klingt es jetzt</button>
            <button className="btn btn-primary" disabled={busy} onClick={start}>🎙️ {has ? 'Neu einsprechen' : 'Einsprechen'}</button>
            {has && (
              <button className="btn btn-ghost" disabled={busy} style={{ color: 'var(--rose, #D64545)' }} onClick={remove}>
                🗑️ Löschen{item.audioStart ? ' → Rezitation' : ' → Computerstimme'}
              </button>
            )}
          </div>
        )}
        {rec && (
          <div className="hz-row" style={{ marginTop: 8, alignItems: 'center' }}>
            <button className="btn" style={{ background: '#F02048', color: '#fff', fontWeight: 800 }} onClick={stop}>⏹ Fertig</button>
            <span style={{ fontWeight: 800, color: '#B3123A' }}>● Aufnahme läuft … {secs}s</span>
            <span className="muted" style={{ fontSize: 12 }}>(max. 30 s)</span>
          </div>
        )}
        {take && (
          <div className="hz-ton-take">
            <div style={{ fontWeight: 800, fontSize: 13 }}>Probeaufnahme — erst anhören, dann entscheiden:</div>
            <div className="hz-row" style={{ marginTop: 6 }}>
              <button className="btn btn-ghost" onClick={playTake}>▶️ Probehören</button>
              <button className="btn btn-primary" disabled={busy} onClick={keep}>{busy ? '⏳ Lädt hoch…' : '✅ Übernehmen'}</button>
              <button className="btn btn-ghost" onClick={start}>🔁 Nochmal</button>
              <button className="btn btn-ghost" style={{ color: 'var(--rose, #D64545)' }} onClick={discard}>🗑️ Verwerfen</button>
            </div>
          </div>
        )}
        {err && <div className="hz-err" style={{ marginTop: 8 }}>{err}</div>}
      </div>
    );
  }

  function TonTab({ item, audio }) {
    const [, force] = useState(0);
    useEffect(function () { return window.QuranVoice ? window.QuranVoice.onChange(function () { force(function (x) { return x + 1; }); }) : undefined; }, []);
    useEffect(function () { if (window.QuranVoice) window.QuranVoice.refresh(true); }, []);
    const done = partsRecorded(item);
    return (
      <div>
        <div className="hz-note" style={{ marginTop: 0 }}>
          {item.audioStart
            ? 'Diese Sure hat eine Internet-Rezitation. Deine eigene Aufnahme spielt trotzdem zuerst — und geht auch offline.'
            : 'Für dieses Gebet gibt es keine Koran-Rezitation — ohne deine Aufnahme bleibt nur die Computerstimme. Sprich es hier Vers für Vers ein; die Kinder hören ab sofort dich.'}
          {' '}<b>{done} von {item.parts.length}</b> eingesprochen.
        </div>
        {item.parts.map(function (p, i) {
          return <PartRecorder key={i} item={item} part={p} i={i} audio={audio}/>;
        })}
      </div>
    );
  }

  /* ==============================================================
     TEIL E — Die Detailseite einer Sure
     ============================================================== */
  function ItemDetail({ item, onBack }) {
    const [, force] = useState(0);
    const [step, setStep] = useState(null);
    const [tab, setTab] = useState('weg');   // weg | text | warum | ton
    const audio = useAudio(item);
    useEffect(function () { return window.Hifz.onChange(function () { force(function (x) { return x + 1; }); }); }, []);
    useEffect(function () { return window.QuranVoice ? window.QuranVoice.onChange(function () { force(function (x) { return x + 1; }); }) : undefined; }, []);
    const teacher = istLehrkraft();

    const st = window.Hifz.itemState(item.id);
    const next = window.Hifz.nextStep(item.id);
    const pct = window.Hifz.progressPct(item.id);
    const due = window.Hifz.repDue(item.id);

    if (step) {
      /* WICHTIG: der key hängt am Schritt. Ohne ihn würde React beim Sprung
         „Vers 1 fertig -> Vers 2" dieselbe Komponente weiterverwenden und der
         Belohnungs-Bildschirm bliebe stehen (genau das ist beim Testen
         passiert). Mit dem key startet jeder Schritt sauber bei null. */
      const stepKey = step.kind + ':' + (step.i != null ? step.i : '') + ':' + (step.stage || '') + ':' + (step.k || '');
      return <Practice key={stepKey} item={item} step={step}
                       onExit={function () { setStep(null); }}
                       onFinish={function (goOn) {
                         const n = window.Hifz.nextStep(item.id);
                         setStep(goOn && n ? n : null);
                       }}/>;
    }

    function startListen() {
      // Der Knopf „Ganz anhören" ist zugleich der erste Lernschritt.
      audio.playAll(0);
      window.Hifz.markHeard(item.id);
    }

    return (
      <div className="content hz-detail">
        <div className="hz-head">
          <button className="btn btn-ghost" onClick={function () { audio.stop(); onBack(); }}>←</button>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0 }}>{item.name} <span className="sur-ar-inline" dir="rtl">{item.arName}</span></h1>
            <div className="muted" style={{ fontSize: 13 }}>
              {item.kind === 'sure' ? 'Sure ' + item.n + ' · ' : 'Gebet · '}„{item.deName}" · {item.parts.length} {item.kind === 'sure' ? 'Verse' : 'Teile'}
              {st.done ? ' · 🏆 auswendig' : ''}
            </div>
          </div>
        </div>

        <div className="hz-bar"><div className="hz-bar-fill" style={{ width: pct + '%' }}/></div>
        <div className="hz-bar-note">{st.done ? '🏆 Geschafft! Halte sie mit der Auffrischung wach.' : pct + '% des Weges'}</div>

        {due > 0 && <div className="hz-due">🔁 Auffrischung fällig (seit {due} {due === 1 ? 'Tag' : 'Tagen'}) — einmal aufsagen, +{XP_REFRESH} XP.</div>}

        <div className="hz-row" style={{ marginTop: 10 }}>
          {next
            ? <button className="qp-btn hz-primary" onClick={function () { audio.stop(); setStep(next); }}>
                {next.kind === 'listen' ? '👂 Anhören & starten'
                  : next.kind === 'verse' ? '▶️ Weiter: Vers ' + (next.i + 1) + ' · ' + STAGE_INFO[next.stage].t
                  : next.kind === 'chain' ? '🔗 Kette: Vers 1–' + next.k
                  : next.kind === 'refresh' ? '🔁 Auffrischen'
                  : '🏆 Ganze ' + (item.kind === 'sure' ? 'Sure' : 'Dua') + ' aufsagen'}
              </button>
            : <button className="qp-btn" disabled style={{ opacity: .6 }}>✅ Alles erledigt — Maschallah!</button>}
          <button className="btn btn-ghost" onClick={startListen}>{audio.all ? '⏹ Stopp' : '🔊 Ganz anhören'}</button>
        </div>

        <div className="sur-tabs" style={{ marginTop: 14 }}>
          <button className={'sur-tab' + (tab === 'weg' ? ' is-active' : '')} onClick={function () { setTab('weg'); }}>🪜 Dein Weg</button>
          <button className={'sur-tab' + (tab === 'text' ? ' is-active' : '')} onClick={function () { setTab('text'); }}>📖 Text</button>
          <button className={'sur-tab' + (tab === 'warum' ? ' is-active' : '')} onClick={function () { setTab('warum'); }}>💛 Warum</button>
          {teacher && <button className={'sur-tab' + (tab === 'ton' ? ' is-active' : '')} onClick={function () { setTab('ton'); }}>🎙️ Ton</button>}
        </div>

        {/* Lehrkraft-Hinweis: Gebet läuft noch mit der Computerstimme */}
        {teacher && tab !== 'ton' && !item.audioStart && partsRecorded(item) < item.parts.length && (
          <div className="hz-tonbanner">
            🗣 Dieses Gebet läuft noch {partsRecorded(item) > 0 ? 'teilweise ' : ''}mit der <b>Computerstimme</b>.
            <button className="btn btn-primary" onClick={function () { setTab('ton'); }}>🎙️ Jetzt selbst einsprechen</button>
          </div>
        )}

        {tab === 'weg' && (
          <div className="hz-ladder">
            {item.parts.map(function (p, i) {
              const s = Number(st.p[i] || 0);
              return (
                <div key={i} className={'hz-step' + (s >= 4 ? ' is-done' : '')}>
                  <div className="hz-step-n">{i + 1}</div>
                  <div className="hz-step-mid">
                    <div className="hz-step-ar" dir="rtl">{p.ar}</div>
                    <div className="hz-dots">
                      {[1, 2, 3, 4].map(function (k) {
                        return <button key={k} className={'hz-dot' + (s >= k ? ' is-on' : '') + (s + 1 === k ? ' is-next' : '')}
                                       title={STAGE_INFO[k].t + ' (+' + XP_STAGE[k] + ' XP)'}
                                       onClick={function () { audio.stop(); setStep({ kind: 'verse', i: i, stage: k }); }}>
                          {STAGE_INFO[k].ic}
                        </button>;
                      })}
                    </div>
                  </div>
                  <button className="hz-step-play" onClick={function () { audio.play(i); }}>{audio.playing === i ? '🔈' : '🔊'}</button>
                </div>
              );
            })}
            {item.parts.length > 2 && (
              <div className="hz-chainrow">
                <b>🔗 Kette</b>
                <div className="hz-chain-dots">
                  {item.parts.slice(1, item.parts.length - 1).map(function (p, k) {
                    const link = k + 2;
                    return <button key={k} className={'hz-cdot' + ((st.chain || 0) >= link ? ' is-on' : '')}
                                   title={'Vers 1 bis ' + link + ' am Stück (+' + XP_CHAIN + ' XP)'}
                                   onClick={function () { audio.stop(); setStep({ kind: 'chain', k: link }); }}>1–{link}</button>;
                  })}
                  <button className={'hz-cdot is-big' + (st.done ? ' is-on' : '')} title={'Alles am Stück (+' + window.Hifz.completionBonus() + ' XP)'}
                          onClick={function () { audio.stop(); setStep({ kind: st.done ? 'refresh' : 'whole' }); }}>🏆 alles</button>
                </div>
              </div>
            )}
            <div className="hz-legend">
              👂 hören +{XP_STAGE[1]} · 🎤 nachsprechen +{XP_STAGE[2]} · 🧩 puzzeln +{XP_STAGE[3]} · 🌟 aus dem Kopf +{XP_STAGE[4]} ·
              🔗 Kette +{XP_CHAIN} · 🏆 ganze {item.kind === 'sure' ? 'Sure' : 'Dua'} +{window.Hifz.completionBonus()}
            </div>
          </div>
        )}

        {tab === 'text' && (
          <div className="hz-text">
            {item.kind === 'sure' && item.n !== 1 && <div className="sur-basmala" dir="rtl">{window.SURAH_BASMALA}</div>}
            {item.parts.map(function (p, i) {
              return (
                <div key={i} className={'sur-ayah' + (audio.playing === i ? ' is-playing' : '')}>
                  <div className="sur-ayah-ar" dir="rtl">{p.ar}</div>
                  <div className="sur-ayah-tr">{p.tr}</div>
                  <div className="sur-ayah-de">{p.de}</div>
                  <div className="row" style={{ gap: 8, marginTop: 6 }}>
                    <span className="sur-versnum">{item.kind === 'sure' ? 'Vers ' : 'Teil '}{i + 1}</span>
                    <button className="sur-play" onClick={function () { audio.play(i); }}>🔊</button>
                    <button className="sur-play" onClick={function () { audio.play(i, { slow: true }); }}>🐢</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'ton' && teacher && <TonTab item={item} audio={audio}/>}

        {tab === 'warum' && (
          <>
            <div className="sur-meaning"><b>Wofür brauchst du sie?</b><p>{item.why}</p></div>
            <div className="sur-fact"><b>💡 Merk-Tipp</b><p>{item.tip}</p></div>
            {item.meaning && <div className="sur-meaning"><b>Worum geht es?</b><p>{item.meaning}</p></div>}
            {item.fact && <div className="sur-fact"><b>🤔 Wusstest du?</b><p>{item.fact}</p></div>}
          </>
        )}
      </div>
    );
  }

  /* ==============================================================
     TEIL F — Die Übersichtsseite
     ============================================================== */
  function Screen({ ctx }) {
    const { go } = ctx;
    const [selId, setSelId] = useState(null);
    const [, force] = useState(0);
    useEffect(function () { return window.Hifz.onChange(function () { force(function (x) { return x + 1; }); }); }, []);

    const items = window.HIFZ_ITEMS || [];
    const frei = window.Hifz.courseInfo();
    const sel = selId ? window.HIFZ_BY_ID[selId] : null;
    if (!frei.open) {
      return (
        <div className="content">
          <button className="btn btn-ghost" style={{ marginBottom: 10 }} onClick={function () { go('decks'); }}>← Zurück</button>
          <div className="inf-locked">
            <div className="inf-lock-ico">🔒</div>
            <h1 style={{ margin: '6px 0' }}>🕌 Auswendig lernen</h1>
            <p>
              Hier lernst du ganze Suren auswendig — <b>Sübhâneke, Fâtiha, Kevser, İhlâs</b> und mehr.
              Damit das gelingt, musst du sie erst <b>lesen</b> können: Der Bereich öffnet sich, sobald du
              alle Lektionen des Kurses einmal auf 100 % gebracht hast.
            </p>
            <div className="inf-progress">
              <div className="xp-bar"><div className="fill" style={{ width: (frei.total ? Math.round(100 * frei.done / frei.total) : 0) + '%' }}/></div>
              <b>{frei.done} von {frei.total} Lektionen stehen auf 100 %</b>
            </div>
            <div className="inf-missing">
              <div className="muted" style={{ fontWeight: 700, marginBottom: 6 }}>Das fehlt noch:</div>
              {frei.missing.slice(0, 6).map(function (m, i) {
                return <div key={i} className="inf-miss"><span>{m.name}</span><em>{m.pct}%</em></div>;
              })}
              {frei.missing.length > 6 && <div className="muted" style={{ fontSize: 12.5 }}>… und {frei.missing.length - 6} weitere</div>}
            </div>
            <button className="qp-btn" style={{ marginTop: 14 }} onClick={function () { go('decks'); }}>Zu den Lektionen</button>
          </div>
        </div>
      );
    }
    if (sel) return <ItemDetail item={sel} onBack={function () { setSelId(null); }}/>;

    const s = window.Hifz.summary();
    const due = items.filter(function (it) { return window.Hifz.repDue(it.id); });
    // Empfehlung: erst die vier Namaz-Suren, dann der Rest — angefangene zuerst.
    const suggestion = (function () {
      const started = items.filter(function (it) { const x = window.Hifz.itemState(it.id); return !x.done && window.Hifz.progressPct(it.id) > 0; });
      if (started.length) return started[0];
      const fresh = items.filter(function (it) { return !window.Hifz.itemState(it.id).done; });
      const stars = fresh.filter(function (it) { return it.stern; });
      return stars[0] || fresh[0] || null;
    })();

    return (
      <div className="content">
        <button className="btn btn-ghost" style={{ marginBottom: 10 }} onClick={function () { go('decks'); }}>← Zurück</button>

        <div className="hz-hero">
          <div className="hz-crown">{s.rank.icon}</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h1 style={{ margin: 0 }}>🕌 Auswendig lernen</h1>
            <div className="hz-hero-rank">{s.rank.title} · {s.done} von {s.total} auswendig</div>
            <div className="hz-bar" style={{ marginTop: 8 }}><div className="hz-bar-fill" style={{ width: (s.total ? Math.round(100 * s.done / s.total) : 0) + '%' }}/></div>
            <div className="hz-hero-stats">
              <span className="pill">🌟 {s.verses}/{s.versesTotal} Verse sitzen</span>
              <span className="pill">✨ {s.xp} XP verdient</span>
              {s.rank.next && <span className="pill">Noch {s.rank.next.n - s.done} bis {s.rank.next.i} {s.rank.next.t}</span>}
            </div>
          </div>
        </div>

        {frei.teacher && <div className="hz-note">🔓 Lehrer-Modus: Du siehst den Bereich, obwohl er für die Kinder noch zu ist.</div>}
        <div className="hz-intro">
          Hier lernst du ganz anders als bei den Buchstaben: Du nimmst dir eine Sure vor und baust sie Vers für Vers
          in deinem Kopf auf — hören, nachsprechen, puzzeln, frei aufsagen. Dann hängst du die Verse zu einer Kette
          zusammen. <b>Das gibt die meisten Punkte in der ganzen App</b> — und je mehr Suren du schon kannst, desto
          mehr bringt die nächste: allein der Abschluss-Bonus für die nächste fertige Sure ist
          <b> {window.Hifz.completionBonus()} XP</b> wert.
        </div>

        {due.length > 0 && (
          <div className="hz-duecard">
            <b>🔁 Auffrischung fällig</b>
            <div className="muted" style={{ margin: '2px 0 8px' }}>Einmal aufsagen genügt — so bleibt es für immer sitzen (+{XP_REFRESH} XP je Sure).</div>
            <div className="hz-row">
              {due.slice(0, 4).map(function (it) {
                return <button key={it.id} className="btn btn-primary" onClick={function () { setSelId(it.id); }}>{it.name}</button>;
              })}
            </div>
          </div>
        )}

        {suggestion && (
          <button className="hz-suggest" onClick={function () { setSelId(suggestion.id); }}>
            <span className="hz-suggest-ic">▶️</span>
            <span>
              <b>Weiterlernen: {suggestion.name}</b>
              <em>{window.Hifz.progressPct(suggestion.id) > 0 ? window.Hifz.progressPct(suggestion.id) + '% geschafft' : suggestion.why}</em>
            </span>
          </button>
        )}

        <div className="hz-sec">⭐ Für den Namaz zuerst</div>
        <div className="hz-grid">{items.filter(function (i) { return i.stern; }).map(function (it) { return <Card key={it.id} item={it} onOpen={setSelId}/>; })}</div>

        <div className="hz-sec">📖 Weitere Suren</div>
        <div className="hz-grid">{items.filter(function (i) { return !i.stern && i.kind === 'sure'; }).map(function (it) { return <Card key={it.id} item={it} onOpen={setSelId}/>; })}</div>

        <div className="hz-sec">🤲 Weitere Gebete im Namaz</div>
        <div className="hz-grid">{items.filter(function (i) { return !i.stern && i.kind === 'gebet'; }).map(function (it) { return <Card key={it.id} item={it} onOpen={setSelId}/>; })}</div>

        <div className="muted" style={{ marginTop: 16, fontSize: 12.5, lineHeight: 1.6 }}>
          🎧 Rezitation: Mischary Raschid Alafasy · Text: quran-simple (alquran.cloud) · Übersetzung: Bubenheim &amp; Elyas.
          Die Gebete spricht die Stimme deiner Lehrkraft — sie kann jeden Vers direkt in der Sure einsprechen (🎙️ Ton) — sonst die eingebaute Stimme deines Geräts.<br/>
          🎤 {window.Recite ? window.Recite.modeLabel() : ''} Beim Zuhören schickt Chrome den Ton kurz zu Google, Safari zu Apple —
          es wird nichts gespeichert und nichts an unseren Server geschickt. Deine Lehrkraft kann das Mikrofon im Klassenzimmer abschalten.
        </div>
      </div>
    );
  }

  function Card({ item, onOpen }) {
    const st = window.Hifz.itemState(item.id);
    const teacher = istLehrkraft();
    const rec = teacher ? partsRecorded(item) : 0;
    const pct = window.Hifz.progressPct(item.id);
    const due = window.Hifz.repDue(item.id);
    const fresh = window.Hifz.freshness(item.id);
    return (
      <button className={'hz-card' + (st.done ? ' is-done' : '')} onClick={function () { onOpen(item.id); }}
              style={st.done ? { opacity: 0.55 + 0.45 * fresh } : null}>
        <div className="hz-card-top">
          <span className="hz-card-name">{item.name}</span>
          <span className="hz-card-ar" dir="rtl">{item.arName}</span>
        </div>
        <div className="hz-card-sub">
          {item.deName} · {item.parts.length} {item.kind === 'sure' ? 'Verse' : 'Teile'}
          {teacher && !item.audioStart && rec < item.parts.length && (
            <span className="hz-tts-chip" title="Läuft noch mit der Computerstimme — im 🎙️ Ton-Tab selbst einsprechen"> 🗣 Computerstimme</span>
          )}
          {teacher && rec >= item.parts.length && item.parts.length > 0 && (
            <span className="hz-rec-chip" title="Komplett mit deiner Stimme eingesprochen"> 🎙️ deine Stimme</span>
          )}
        </div>
        <div className="hz-bar hz-bar-sm"><div className="hz-bar-fill" style={{ width: pct + '%' }}/></div>
        <div className="hz-card-foot">
          <span>{st.done ? '🏆 auswendig' : pct > 0 ? pct + '%' : 'noch nicht begonnen'}</span>
          {due > 0 ? <span className="hz-badge">🔁 fällig</span>
            : st.done ? <span className="hz-badge is-ok">✓ frisch</span>
            : <span className="hz-badge is-xp" title="So viele Punkte bringt diese Sure insgesamt, wenn du sie ganz schaffst.">bis +{window.Hifz.maxXp(item)} XP</span>}
        </div>
      </button>
    );
  }

  window.HifzScreen = Screen;
  window.HifzModule = { Screen: Screen, MicButton: MicButton, WordPuzzle: WordPuzzle, WordFeedback: WordFeedback };
})();
