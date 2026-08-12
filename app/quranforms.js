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

  /* Formen je Buchstabe (aus den Karten der Formen-Lektion selbst). */
  let FORMS_BY = null;
  function formsByChar() {
    if (FORMS_BY) return FORMS_BY;
    FORMS_BY = {};
    const t = (window.QURAN_TOPICS || []).find(x => x.id === 'quran-formen');
    if (t) t.blocks[0].cards.forEach(c => {
      const base = String(c.q).replace(/[ًٌٍَُِّْٰـ\s]/g, '')[0];
      if (base) FORMS_BY[base] = { forms: formsOf(c.q), name: c.a };
    });
    return FORMS_BY;
  }
  function famOf(ch) {
    return (window.QEngine && window.QEngine.familyOf && window.QEngine.familyOf(ch)) || [];
  }

  /* NEU (12.08.2026, „vor allem der zweite Stapel muss mehr Lerneffekt
     haben"): zwei zusätzliche Übungsformen, beide mit Verwechsel-
     Geschwistern als falschen Antworten —

     formPos:  „Wie sieht Be in der MITTE aus?" → fünf verbundene Formen
               zur Auswahl, darunter ـتـ ـثـ ـنـ ـيـ. Wer nur den
               Grundkörper kennt, kommt hier nicht durch.
     posName:  eine EINZELNE Form steht groß da (z. B. ـبـ) → welcher
               Buchstabe ist das? Genau die Blickrichtung, die man beim
               echten Lesen braucht. */
  function formPos(base, name) {
    const F = formsByChar();
    const me = F[base];
    if (!me || !me.forms.joins) return null;
    const pos = Math.random() < 0.55 ? 'mid' : 'end';
    const get = ch => (pos === 'mid' ? F[ch].forms.mid : F[ch].forms.end);
    const fam = famOf(base).filter(ch => ch !== base && F[ch] && F[ch].forms.joins);
    const rest = Object.keys(F).filter(ch => ch !== base && F[ch].forms.joins && fam.indexOf(ch) < 0);
    const wrong = fam.concat(rest.sort(() => Math.random() - 0.5)).slice(0, 4);
    if (wrong.length < 3) return null;
    const opts = [{ t: get(base), c: true }].concat(wrong.map(ch => ({ t: get(ch), c: false })));
    return {
      kind: 'mc', multi: false, generated: true, arabicOptions: true,
      q: 'Wie sieht „' + name + '“ ' + (pos === 'mid' ? 'in der MITTE eines Wortes' : 'am ENDE eines Wortes') + ' aus?',
      a: get(base), say: base,
      options: opts.sort(() => Math.random() - 0.5),
    };
  }
  function posName(base, name) {
    const F = formsByChar();
    const me = F[base];
    if (!me) return null;
    const forms = me.forms.joins
      ? [me.forms.mid, me.forms.end, me.forms.start]
      : [me.forms.alone, me.forms.end].filter(Boolean);
    const form = forms[Math.floor(Math.random() * forms.length)];
    if (!form) return null;
    const famNames = famOf(base).map(ch => F[ch] && F[ch].name).filter(n => n && n !== name);
    const restNames = Object.keys(F).map(ch => F[ch].name).filter(n => n !== name && famNames.indexOf(n) < 0);
    const wrong = famNames.concat(restNames.sort(() => Math.random() - 0.5)).slice(0, 4);
    if (wrong.length < 3) return null;
    return {
      kind: 'mc', multi: false, generated: true,
      q: form, a: name, say: base,
      options: [{ t: name, c: true }].concat(wrong.map(t => ({ t, c: false }))).sort(() => Math.random() - 0.5),
    };
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
    if (r < 0.30) {
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
    if (r < 0.55) {
      const f = findWordFor(base);
      if (f) {
        return {
          kind: 'hiPick', q: f.word.ar, say: say, a: name,
          clusters: f.word.cls.slice(), target: f.target, wordTr: f.word.tr,
        };
      }
    }
    if (r < 0.78) {
      const fx = formPos(base, name);
      if (fx) return fx;
    }
    const px = posName(base, name);
    if (px) return px;
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
