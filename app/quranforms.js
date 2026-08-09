/* ==============================================================
   QuranForms — die Formen-Übungen aus dem Vorbild-Video (05.08.2026,
   Nachtausbau Punkt 2 der Nutzer-Liste):

   1) formTeach — Lehrkarte: Buchstabe groß + Panel "Buchstabenformen"
      (Ende · Mitte · Anfang) + Warnbox bei Nicht-Verbindern + WEITER.
      Erscheint beim ERSTEN Auftritt einer Formen-Karte (SRS-Zustand
      "neu"), genau wie im Video erst gezeigt, dann geübt wird.
   2) tilePick — "Klicke auf den richtigen Buchstaben": ein echtes,
      vokalisiertes Wort aus dem Elifba-Kurs wird in Einzel-Kacheln
      zerlegt (korrekte verbundene Schreibform pro Kachel, RTL), das
      Kind tippt die Form des Zielbuchstabens an → BESTÄTIGEN.
   3) hiPick — "Errate den hervorgehobenen Buchstaben": die Umkehrung.
      Ein Wort wird gezeigt, EINE Form ist blau markiert; erst selbst
      überlegen ("Errate den Buchstaben"), dann aufdecken, dann die
      ehrliche Ja/Vage/Nein-Bewertung.

   Der Wortpool stammt aus den echten Lesewörtern der Elifba-Stapel
   (Üstün bis Lafzatullah) — keine erfundenen Wörter.
   ============================================================== */
(function () {
  /* Buchstaben, die sich NICHT mit dem folgenden (linken) Buchstaben
     verbinden — inkl. Hemze-Träger und rundem Te. */
  const JOIN_FALSE = new Set(['ا', 'أ', 'إ', 'آ', 'ٱ', 'د', 'ذ', 'ر', 'ز', 'و', 'ؤ', 'ة']);
  const TATWEEL = 'ـ';

  function isJoin(ch) { return !JOIN_FALSE.has(ch); }

  /* Wort in Cluster zerlegen: Basiszeichen + anhängende Harekat. */
  function splitClusters(w) {
    return String(w).match(/[ء-يٱ-ۓ][ً-ْٰ]*/g) || [];
  }

  /* Verbundene Schreibform einer einzelnen Kachel per Tatweel-Trick. */
  function clusterDisp(cl, i, arr) {
    const prevJoins = i > 0 && isJoin(arr[i - 1][0]);
    const selfJoins = isJoin(cl[0]);
    return (prevJoins ? TATWEEL : '') + cl + ((selfJoins && i < arr.length - 1) ? TATWEEL : '');
  }

  /* Buchstabenname (Elif, Be, …) je Basiszeichen — aus dem Harfler-Stapel. */
  let NAME_BY_CHAR = null;
  function nameByChar(ch) {
    if (!NAME_BY_CHAR) {
      NAME_BY_CHAR = {};
      const hf = (window.QURAN_TOPICS || []).find(t => t.id === 'quran-harfler');
      if (hf) hf.blocks[0].cards.forEach(c => { NAME_BY_CHAR[c.q] = c.a; });
    }
    return NAME_BY_CHAR[ch] || null;
  }

  /* Echte Lesewörter aus dem Elifba-Kurs (3–6 Cluster, ohne Leerzeichen). */
  let POOL = null;
  function wordPool() {
    if (POOL) return POOL;
    POOL = [];
    const OK = /^quran-(ustun|esre|otre|cezim|sedde|tenvin|yuvarlakte|ceker|medelif|medye|medvav|maksura|hemze)$/;
    (window.QURAN_TOPICS || []).forEach(t => {
      if (!OK.test(t.id)) return;
      t.blocks.forEach(b => (b.cards || []).forEach(c => {
        const q = String(c.q || '');
        if (q.indexOf(' ') >= 0) return;
        const cls = splitClusters(q);
        if (cls.length < 3 || cls.length > 6) return;
        POOL.push({ ar: q, tr: c.a || '', cls: cls });
      }));
    });
    return POOL;
  }

  /* Ein Wort finden, in dem der Zielbuchstabe GENAU EINMAL vorkommt —
     sonst wäre die Kachel-Übung mehrdeutig. */
  function findWordFor(base) {
    const cands = wordPool().filter(w => w.cls.filter(c => c[0] === base).length === 1);
    if (!cands.length) return null;
    const w = cands[Math.floor(Math.random() * cands.length)];
    return { word: w, target: w.cls.findIndex(c => c[0] === base) };
  }

  /* Formen-Panel-Daten aus der Karten-Frage ("بـ  ـبـ  ـب" bzw. "ا  ـا"). */
  function formsOf(cardQ) {
    const parts = String(cardQ).trim().split(/\s+/);
    if (parts.length >= 3) return { joins: true, start: parts[0], mid: parts[1], end: parts[2] };
    return { joins: false, alone: parts[0] || '', end: parts[1] || '' };
  }

  /* "Schon gelehrt?"-Gedächtnis: Die Lehrkarte zählt bewusst NICHT als
     beantwortete Frage (kein SRS-Eintrag), deshalb eigenes, kleines
     localStorage-Flag pro Buchstabe — 1. Auftritt Lehrkarte, danach Übungen. */
  const TAUGHT_KEY = 'quran_forms_taught_v1';
  function taughtMap() {
    try { return JSON.parse(localStorage.getItem(TAUGHT_KEY) || '{}'); } catch (e) { return {}; }
  }
  function markTaught(base) {
    const m = taughtMap(); m[base] = 1;
    try { localStorage.setItem(TAUGHT_KEY, JSON.stringify(m)); } catch (e) {}
  }

  /* Haupteinstieg: liefert ein Frage-Objekt für den Auswendig-Modus —
     oder null (dann greift die normale Engine: MC/Abruf). */
  function generate(card) {
    const base = String(card.q).replace(/[ًٌٍَُِّْٰـ\s]/g, '')[0];
    if (!base) return null;
    const name = card.a;
    const say = base;

    /* Erster Auftritt: erst die Lehrkarte, wie im Video. */
    if (!taughtMap()[base]) {
      markTaught(base);
      return { kind: 'formTeach', q: base, say: say, a: name, forms: formsOf(card.q) };
    }

    const r = Math.random();
    if (r < 0.55) {
      const f = findWordFor(base);
      if (f) {
        return {
          kind: 'tilePick', q: base, say: say, a: name,
          word: f.word.ar, wordTr: f.word.tr,
          tiles: f.word.cls.map((c, i) => clusterDisp(c, i, f.word.cls)),
          correct: f.target,
        };
      }
    }
    if (r < 0.82) {
      const f = findWordFor(base);
      if (f) {
        return {
          kind: 'hiPick', q: f.word.ar, say: say, a: name,
          clusters: f.word.cls.slice(), target: f.target, wordTr: f.word.tr,
        };
      }
    }
    return null; /* Engine-Fallback: "Wo ist X?" -MC oder Abruf-Karte */
  }

  window.QuranForms = {
    generate: generate,
    splitClusters: splitClusters,
    clusterDisp: clusterDisp,
    isJoin: isJoin,
    nameByChar: nameByChar,
    wordPool: wordPool,
  };
})();
