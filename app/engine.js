/* ==============================================================
   QEngine — dynamische Fragen-Generierung aus Kartenmaterial,
   nachgebaut nach Live-Analyse des Original-"Auswendig"-Modus
   von app.gizmo.ai (14.07.2026, echter Account, echte Decks).

   Beobachtete Formate im Original:
   1) MC          — kurze Antwort -> 3 Optionen, Distraktoren stammen
                    erkennbar aus verwandten Karten desselben Themas
                    (z.B. "Carl Gustav Jung"/"B. F. Skinner" als
                    Distraktoren zur Maslow-Karte).
   2) Lückentext  — Schlüsselbegriff wird INLINE im Satz geblankt
                    ("...zuständige ▁?" / "...oder sie müssen eine ▁
                    dabei haben."), Auswahl per Optionen darunter.
   3) Ordnen      — "Ordnen Sie ... :" -> Elemente in richtiger
                    Reihenfolge anklicken, jedes Element wird beim
                    Klick grün nummeriert, Fehlklick zählt als Fehler.
   4) Offener Abruf — lange Prosa-Antworten: "Denk zuerst an die
                    Antwort" -> Aufdecken -> Selbsteinschätzung
                    ("😊 Gut" / "😐 Nicht sicher").
   Wiederauftauchen (Requeue nach Fehler) erzwingt IMMER zuerst die
   Abruf-Hürde ("Denk zuerst an die Antwort" + "Optionen anzeigen"),
   erst danach erscheint wieder das normale Format der Karte.
   Blitzfragen (gemeisterte Karten): Countdown 3–24 s je nach
   Umfang, Optionen erst nach "Uhr starten".
   ============================================================== */
(function () {
  const STOP = new Set(['der','die','das','und','oder','ein','eine','einen','einem','einer','eines','für','von','mit','auf','bei','aus','dem','den','des','ist','sind','wird','werden','kann','können','sich','auch','nicht','zum','zur','als','wie','was','wer','wann','wo','im','in','an','am','um','durch','über','unter','gegen','nach','vor','ohne','man','sie','er','es','ihre','ihr','sein','seine','wenn','dass','diese','dieser','dieses','alle','allen','sowie','beim','bzw','etc','ggf','muss','darf','sollte','haben','hat','sind','nur','noch','mehr','sehr']);

  function words(s) {
    return String(s || '').replace(/[()„“”"":;,.!?–—/\\]/g, ' ').split(/\s+/).filter(Boolean);
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Schlüsselbegriff in der Antwort finden, der sich blanken lässt:
  // längstes großgeschriebenes Wort (dt. Substantiv-Heuristik), das nicht
  // schon in der Frage vorkommt und kein Stoppwort ist. Optional 2-Gramm,
  // wenn das Folgewort ebenfalls großgeschrieben ist ("soziale Absicherung"
  // wäre im Original auch ein markierter Begriff gewesen).
  function keyTerm(answer, question) {
    const raw = String(answer || '');
    const ql = String(question || '').toLowerCase();
    const ws = words(answer);
    let best = null;
    for (let i = 0; i < ws.length; i++) {
      const w = ws[i];
      if (w.length < 5 || w.length > 30) continue;
      if (!/^[A-ZÄÖÜ]/.test(w)) continue;
      if (STOP.has(w.toLowerCase())) continue;
      if (ql.includes(w.toLowerCase())) continue;
      if (!raw.includes(w)) continue; // muss wörtlich im Text stehen (sonst nicht blankbar)
      let cand = w;
      const nx = ws[i + 1];
      const two = w + ' ' + nx;
      if (nx && /^[A-ZÄÖÜ]/.test(nx) && !STOP.has(nx.toLowerCase()) && (w.length + nx.length) <= 30 && !ql.includes(two.toLowerCase()) && raw.includes(two)) {
        cand = two;
      }
      if (!best || cand.length > best.length) best = cand;
    }
    return best;
  }

  // Antwort als Liste interpretieren (für Ordnen- und generierte Multi-MC):
  // Trenner sind Zeilenumbrüche, Semikolons, Bullets und " - "-Aufzählungen.
  function splitList(answer) {
    // Nur ECHTE Listenstruktur akzeptieren: Zeilenumbrüche, Semikolons,
    // Bullets oder Spiegelstriche am Zeilenanfang — kein Aufbrechen von
    // Fließtext an zufälligen Binde-Strichen (erzeugt sonst Wortsalat).
    let parts = String(answer || '')
      .split(/\n+|;|•|\s[-–]\s/) // " - " nur mit Leerzeichen davor+danach — Wort-Kompositum wie "Ausgangs- und" bleibt heil
      .map(s => s.trim().replace(/^[-–•\s]+/, '').replace(/^\d+[.)]\s*/, ''))
      .filter(s => s.length >= 3);
    parts = [...new Set(parts)];
    const clean = parts.every(p => p.length <= 70 && !/\n/.test(p));
    // Mehrheit sollte wie ein Listenpunkt aussehen (großgeschrieben beginnen)
    const capish = parts.filter(p => /^[A-ZÄÖÜ0-9]/.test(p)).length >= Math.ceil(parts.length * 0.6);
    if (parts.length >= 3 && parts.length <= 8 && clean && capish) return parts;
    return null;
  }

  const ORDER_RX = /ordnen|reihenfolge|sortier|von unten nach oben|von oben nach unten|in welcher folge|schritte in/i;

  /* -------- Distraktoren-Pools pro Thema (gecached) --------
     Distraktoren kommen bevorzugt aus dem GLEICHEN Block (fachlich
     verwandt und daher plausibel — genau wie im Original beobachtet),
     danach aus dem restlichen Thema. */
  const cache = {};
  function pools(topicId) {
    if (cache[topicId]) return cache[topicId];
    // Eigene (KI-generierte) Stapel (app/customtopics.js) haben genau die gleiche Form
    // wie die kuratierten §34a-Themen — hier mit einbeziehen, damit Distraktoren für
    // eigene Quiz-Fragen aus dem EIGENEN Stapel kommen, nicht aus fremdem §34a-Inhalt.
    const staticTopics = window.S34A_TOPICS || [];
    const customTopics = (window.CustomTopics && window.CustomTopics.list()) || [];
    const topics = staticTopics.concat(customTopics, window.QURAN_TOPICS || []);
    const topic = topics.find(t => t.id === topicId);
    const scan = topic ? [topic] : topics;
    const pool = { topic: { short: [], terms: [], items: [] }, byBlock: new Map(), blockOfQ: new Map() };
    for (const t of scan) {
      for (const b of (t.blocks || [])) {
        const bp = { short: [], terms: [], items: [] };
        for (const qq of (b.quiz || [])) {
          pool.blockOfQ.set(qq.q, bp);
          const a = (qq.a || '').trim();
          if (qq.options && qq.options.length) continue;
          // Kurzantworten als MC-Distraktoren: nur saubere Einzeiler, die wie
          // eine Antwort aussehen (keine Spiegelstrich-/Fragment-Reste).
          if (a && a.length >= 3 && a.length <= 60 && !/\n/.test(a) && !/^[-–•]/.test(a)) {
            bp.short.push(a); pool.topic.short.push(a);
          }
          const kt = keyTerm(a, qq.q);
          if (kt) { bp.terms.push(kt); pool.topic.terms.push(kt); }
          const li = splitList(a);
          if (li) {
            const shortItems = li.filter(x => x.length <= 60);
            bp.items.push(...shortItems);
            pool.topic.items.push(...shortItems);
          }
        }
        pool.byBlock.set(b, bp);
      }
    }
    ['short', 'terms', 'items'].forEach(k => { pool.topic[k] = [...new Set(pool.topic[k])]; });
    cache[topicId] = pool;
    return pool;
  }

  // n Distraktoren wählen: erst gleicher Block, dann Thema; ähnliche Länge
  // bevorzugt, nichts was wörtlich in der richtigen Antwort steckt.
  function distractors(pool, card, correct, n, kind) {
    const bp = pool.blockOfQ.get(card.q);
    const key = kind === 'terms' ? 'terms' : kind === 'items' ? 'items' : 'short';
    const corrLow = String(correct).toLowerCase();
    const answerLow = String(card.a || '').toLowerCase();
    const ok = x => {
      const xl = x.toLowerCase();
      return xl !== corrLow && !answerLow.includes(xl) && !corrLow.includes(xl);
    };
    const local = bp ? bp[key].filter(ok) : [];
    const global = pool.topic[key].filter(x => ok(x) && !local.includes(x));
    const cl = correct.length;
    const rank = xs => shuffle(xs).sort((x, y) => Math.abs(x.length - cl) - Math.abs(y.length - cl));
    const picked = [];
    for (const src of [rank(local), rank(global)]) {
      for (const x of src) {
        if (picked.length >= n) break;
        if (!picked.includes(x)) picked.push(x);
      }
    }
    return picked.slice(0, n);
  }

  /* -------- Format-Generator --------
     Gibt ein render-fertiges Frageobjekt zurück:
     { kind:'mc'|'cloze'|'order'|'recall', ... } */
  /* ==============================================================
     SCHWIERIGER, ABER FAIR (12.08.2026, Nutzerwunsch „an vielen Stellen
     noch zu einfach — der Lerneffekt muss größer werden").

     Der größte Hebel sind die FALSCHEN Antworten: Bisher kamen sie
     zufällig — wer ب lernt, bekam ك und م daneben, das errät jedes Kind
     an der Form. Jetzt kommen zuerst die VERWECHSEL-GESCHWISTER (gleicher
     Grundkörper, nur die Punkte unterscheiden sich): ب ت ث ن ي,
     ج ح خ, د ذ, ر ز, س ش, ص ض, ط ظ, ع غ, ف ق. Man muss wirklich
     hinschauen. Zusätzlich haben Koran-Fragen jetzt FÜNF statt vier
     Antworten. Kindgerecht bleibt es: Die richtige Antwort ist immer da,
     und nach jedem Fehler kommt die Karte einfach wieder.
     ============================================================== */
  const FAMILIES = [
    ['ا', 'أ', 'إ', 'آ', 'ٱ'], ['ب', 'ت', 'ث', 'ن', 'ي'], ['ج', 'ح', 'خ'],
    ['د', 'ذ'], ['ر', 'ز'], ['س', 'ش'], ['ص', 'ض'], ['ط', 'ظ'],
    ['ع', 'غ'], ['ف', 'ق'], ['ه', 'ة'], ['و', 'ؤ'],
  ];
  const FAM_BY = {};
  FAMILIES.forEach(f => f.forEach(ch => { FAM_BY[ch] = f; }));
  function familyOf(ch) { return FAM_BY[ch] || null; }

  /* Falsche NAMEN zu einer Koran-Karte: erst die Namen der Verwechsel-
     Geschwister (aus derselben Lektion, also mit demselben Zeichen davor/
     dahinter), dann Auffüller aus dem Stapel. */
  function quranNameWrongs(card, topicId, a, n) {
    const bare = String(card.q).replace(/[\u064B-\u0652\u0670\u0640]/g, '').replace(/[^\u0600-\u06FF]/g, '');
    const base = bare[0];
    const fam = familyOf(base);
    const topic = (window.QURAN_TOPICS || []).concat(window.QURAN_EXTRA_TOPICS || []).find(t => t.id === topicId);
    const out = [];
    if (fam && topic) {
      const sisters = [];
      topic.blocks.forEach(b => (b.quiz || []).forEach(c => {
        const cb = String(c.q).replace(/[\u064B-\u0652\u0670\u0640]/g, '').replace(/[^\u0600-\u06FF]/g, '');
        if (cb.length === bare.length && cb !== bare && fam.indexOf(cb[0]) >= 0
            && String(c.q).replace(cb[0], '') === String(card.q).replace(base, '')
            && c.a && c.a !== a && sisters.indexOf(c.a) < 0) sisters.push(c.a);
      }));
      shuffle(sisters).forEach(x => { if (out.length < n && out.indexOf(x) < 0) out.push(x); });
    }
    if (out.length < n) {
      const pool = pools(topicId);
      distractors(pool, card, a, n * 2, 'short').forEach(x => {
        if (out.length < n && out.indexOf(x) < 0 && x !== a) out.push(x);
      });
    }
    return out;
  }

  /* Falsche GLYPHEN zu einer Silben-Karte (13.08.2026): gleiche Harekat,
     anderer Grundbuchstabe — Verwechsel-Geschwister zuerst. Ersetzt die
     beiden Hör-Auswahlen: "Wo ist be?" funktioniert ohne Computerstimme. */
  function quranSisterGlyphs(card, topicId, n) {
    const strip = s => String(s).replace(/[\u064B-\u0652\u0670\u0640]/g, '').replace(/[^\u0600-\u06FF]/g, '');
    const bare = strip(card.q);
    const base = bare[0];
    const fam = familyOf(base) || [];
    const topic = (window.QURAN_TOPICS || []).concat(window.QURAN_EXTRA_TOPICS || []).find(t => t.id === topicId);
    if (!topic) return [];
    const sisters = [], rest = [];
    topic.blocks.forEach(b => (b.quiz || []).forEach(c => {
      const cb = strip(c.q);
      if (cb.length !== bare.length || cb === bare) return;
      if (String(c.q).replace(cb[0], '') !== String(card.q).replace(base, '')) return; // gleiche Harekat-Form
      if (c.q === card.q) return;
      (fam.indexOf(cb[0]) >= 0 ? sisters : rest).push(c.q);
    }));
    const out = [];
    shuffle(sisters).concat(shuffle(rest)).forEach(g => {
      if (out.length < n && out.indexOf(g) < 0 && g !== card.q) out.push(g);
    });
    return out;
  }

  /* ---- 🔗 Paare verbinden (13.08.2026, Nutzerwunsch "Nummer 2, überall"):
     vier Karten derselben Lektion — die aktuelle plus drei Nachbarn, die
     Verwechsel-Geschwister zuerst. Links Arabisch, rechts die Lesung. ---- */
  function quranPairsGen(card, topicId, a) {
    const strip = s => String(s).replace(/[\u064B-\u0652\u0670\u0640]/g, '').replace(/[^\u0600-\u06FF]/g, '');
    const kurz = c => String(c.a || '').length <= 26 && strip(c.q).length <= 12;
    if (!kurz(card)) return null;
    const topic = (window.QURAN_TOPICS || []).concat(window.QURAN_EXTRA_TOPICS || []).find(t => t.id === topicId);
    if (!topic) return null;
    const alle = [];
    topic.blocks.forEach(b => (b.quiz || []).forEach(c => { if (c.q && c.a) alle.push(c); }));
    const base = strip(card.q)[0];
    const fam = familyOf(base) || [];
    const usedQ = { }; usedQ[card.q] = 1;
    const usedA = { }; usedA[String(a).toLowerCase()] = 1;
    const sis = [], rest = [];
    alle.forEach(c => {
      if (usedQ[c.q] || !kurz(c)) return;
      const cb = strip(c.q);
      ((cb[0] && fam.indexOf(cb[0]) >= 0) ? sis : rest).push(c);
    });
    const picked = [card];
    shuffle(sis).concat(shuffle(rest)).forEach(c => {
      const al = String(c.a).toLowerCase();
      if (picked.length < 4 && !usedQ[c.q] && !usedA[al]) { picked.push(c); usedQ[c.q] = 1; usedA[al] = 1; }
    });
    if (picked.length < 4) return null;
    const pairs = picked.map((c, i) => ({ id: i, ar: c.q, tr: c.a }));
    return {
      kind: 'pairs', generated: true, q: 'Welche Paare gehören zusammen?', a, say: card.q, tr: a,
      pairs: pairs, left: shuffle(pairs), right: shuffle(pairs),
    };
  }

  /* ---- 🧱 Wort-Baukasten (13.08.2026, "Nummer 3"): Lesung steht da, das Wort
     wird aus Silben-Kacheln zusammengebaut — plus zwei Fallen-Kacheln aus der
     Verwechsel-Familie (gleiche Harekat, anderer Grundbuchstabe). ---- */
  function quranBuildGen(card, a) {
    if (!window.QuranForms || !window.QuranForms.splitClusters) return null;
    const q = String(card.q || '');
    if (/\s/.test(q)) return null;                       // nur einzelne Wörter
    const cls = window.QuranForms.splitClusters(q);
    if (!cls || cls.length < 2 || cls.length > 6) return null;
    const traps = [];
    shuffle(cls.slice()).forEach(c => {
      if (traps.length >= 2) return;
      const alt = shuffle((familyOf(c[0]) || []).filter(x => x !== c[0]))[0];
      if (!alt) return;
      const t = alt + c.slice(1);
      if (cls.indexOf(t) < 0 && traps.indexOf(t) < 0) traps.push(t);
    });
    return {
      kind: 'build', generated: true, q: a, a, ar: q, say: q, tr: a,
      clusters: cls, tiles: shuffle(cls.concat(traps)),
    };
  }

  /* ---- 🎤 Lese-Check (13.08.2026, "Nummer 1"): Wort laut vorlesen, der
     Browser prüft mit (dieselbe Technik wie beim Suren-Nachsprechen).
     Nur wenn das Gerät wirklich zuhören kann — sonst greift der normale Mix.
     Die 5er-Auswahl fährt als Ausweich-Antwort mit ("Lieber antippen"). ---- */
  function quranReadGen(card, topicId, a) {
    if (!window.Recite || window.Recite.mode() !== 'speech') return null;
    const wrongs = quranNameWrongs(card, topicId, a, 4);
    const options = wrongs.length >= 3
      ? shuffle([{ t: a, c: true }, ...wrongs.map(t => ({ t, c: false }))])
      : null;
    return { kind: 'readCheck', generated: true, q: card.q, a, say: card.q, tr: a, options: options };
  }

  function generate(card, topicId) {
    const pool = pools(topicId);
    const a = (card.a || '').trim();

    // 1) Echte Prüfungs-MC (mit importierten Optionen): unverändert, gemischt.
    if (card.options && card.options.length) {
      return { kind: 'mc', multi: !!card.multi, q: card.q, options: shuffle(card.options.map(o => ({ ...o }))) };
    }

    // Koran-Kurs (Elif & Ba), Frage-Mix wie im Vorbild-Video:
    if (/^quran-/.test(topicId)) {
      // 0) Formen-Lektion: eigene Übungsformate (Lehrkarte mit Formen-Panel,
      //    "Klicke auf den richtigen Buchstaben", "Errate den hervorgehobenen
      //    Buchstaben") — siehe app/quranforms.js. Liefert null -> normaler Mix.
      if (topicId === 'quran-formen' && window.QuranForms) {
        const fx = window.QuranForms.generate(card);
        if (fx) return fx;
      }
      // 1) Richtungswechsel: bei Buchstaben-Karten fragt rund ein Drittel der
      //    Auftritte ANDERSHERUM — der Name steht da, der richtige Buchstabe
      //    ist unter vier arabischen Glyphen zu finden (groß + RTL gerendert).
      const bare = String(card.q).replace(/[\u064B-\u0652\u0670\u0640]/g, '').replace(/[^\u0600-\u06FF]/g, '');
      const uniq = [...new Set(bare.split(''))];
      const isLetterCard = !/[\u064B-\u0652]/.test(card.q) && bare.length >= 1 && uniq.length === 1 && String(a).length <= 8;
      const hf = (window.QURAN_TOPICS || []).find(t => t.id === 'quran-harfler');
      const rMix = Math.random();
      if (isLetterCard && hf && rMix < 0.35) {
        const alle = hf.blocks[0].quiz.map(x => x.q).filter(g => g !== uniq[0]);
        const fam = (familyOf(uniq[0]) || []).filter(g => g !== uniq[0] && alle.indexOf(g) >= 0);
        const rest = shuffle(alle.filter(g => fam.indexOf(g) < 0));
        const wrongs = shuffle(fam).concat(rest).slice(0, 4);   // 5 Antworten
        if (wrongs.length >= 3) {
          return {
            kind: 'mc', multi: false, generated: true, arabicOptions: true,
            q: 'Wo ist „' + a + '“?', a: uniq[0],
            options: shuffle([{ t: uniq[0], c: true }, ...wrongs.map(t => ({ t, c: false }))]),
          };
        }
      }
      // 1a) Buchstaben: 🔗 Paare verbinden (Buchstabe ↔ Name)
      if (isLetterCard && rMix < 0.55) {
        const p = quranPairsGen(card, topicId, a);
        if (p) return p;
      }
      // 1b) Silben: Richtungswechsel wie bei den Buchstaben (13.08.2026,
      //     Nutzerwunsch: beide Hör-Auswahlen raus — sie hingen an der
      //     Computerstimme). Die Lesung steht da ("Wo ist be?"), gewählt
      //     wird unter fünf Silben mit gleicher Harekat — die falschen sind
      //     Geschwister-Silben. 🔊 auf der Karte spielt den Klang weiter ab.
      const isSyllCard = /[\u064B-\u0652]/.test(card.q) && bare.length === 1;
      if (isSyllCard && rMix < 0.35) {
        const glyphs = quranSisterGlyphs(card, topicId, 4);
        if (glyphs.length >= 3) {
          return {
            kind: 'mc', multi: false, generated: true, arabicOptions: true,
            q: 'Wo ist \u201E' + a + '\u201C?', a: card.q, say: card.q, tr: a,
            options: shuffle([{ t: card.q, c: true }, ...glyphs.map(t => ({ t, c: false }))]),
          };
        }
      }
      // 1c) Silben: 🔗 Paare verbinden (Silbe ↔ Lesung)
      if (isSyllCard && rMix < 0.55) {
        const p = quranPairsGen(card, topicId, a);
        if (p) return p;
      }
      // 2) Abruf NUR noch für echte Wörter (13.08.2026: "Errate das Wort
      //    überall behalten" — für einzelne Buchstaben und Silben ist er raus,
      //    dort gibt es nur noch prüfbare Auswahl-Fragen).
      const isWordCard = bare.length >= 2 && bare !== '\u0644\u0627';
      if (isWordCard) {
        const spaced = /\s/.test(String(card.q));
        const isExtra = topicId === 'quran-vokabeln' || topicId === 'quran-gebete';
        if (rMix < 0.28) return { kind: 'recall', q: card.q, a };
        if (!spaced && !isExtra && rMix < 0.46) {
          const rc = quranReadGen(card, topicId, a);          // 🎤 Lese-Check
          if (rc) return rc;
        }
        if (!spaced && rMix < 0.64) {
          const bd = quranBuildGen(card, a);                  // 🧱 Wort-Baukasten
          if (bd) return bd;
        }
        if (rMix < 0.78) {
          const p = quranPairsGen(card, topicId, a);          // 🔗 Paare
          if (p) return p;
        }
      }
      // 3) Sonst: Auswahl-Frage mit VERWECHSEL-Antworten und 5 Optionen.
      if (a) {
        const wrongs = quranNameWrongs(card, topicId, a, 4);
        if (wrongs.length >= 3) {
          return { kind: 'mc', multi: false, generated: true, q: card.q, a,
                   options: shuffle([{ t: a, c: true }, ...wrongs.map(t => ({ t, c: false }))]) };
        }
      }
    }

    const listItems = splitList(a);

    // 2) Ordnen — nur wenn die Frage nach einer Reihenfolge fragt.
    if (listItems && ORDER_RX.test(card.q)) {
      return { kind: 'order', q: card.q, a, order: listItems, items: shuffle(listItems) };
    }

    // 2b) KI-generierte Variante (app/aigen.js), falls für diese Karte schon
    //     im Hintergrund erzeugt — Original-Qualität, schlägt die Heuristik.
    const ai = window.AIGen ? window.AIGen.get(topicId, card) : null;
    if (ai && ai.type === 'cloze' && a.includes(ai.term)) {
      return {
        kind: 'cloze', q: card.q, a, term: ai.term, aiGen: true,
        masked: a.replace(ai.term, '▁▁▁▁'),
        options: shuffle([{ t: ai.term, c: true }, ...ai.wrongTerms.map(t => ({ t, c: false }))]),
      };
    }
    if (ai && ai.type === 'mc') {
      return {
        kind: 'mc', multi: false, generated: true, aiGen: true, q: card.q, a,
        options: shuffle([{ t: a, c: true }, ...ai.distractors.map(t => ({ t, c: false }))]),
      };
    }

    // 3) Listen-Antwort -> generierte Multi-Select-MC (2-3 richtige aus der
    //    Liste + 2 plausible falsche aus Nachbarkarten).
    if (listItems) {
      const rights = shuffle(listItems).slice(0, Math.min(3, listItems.length - 0));
      const wrongs = distractors(pool, card, rights[0], 2, 'items');
      if (wrongs.length >= 2) {
        return {
          kind: 'mc', multi: true, generated: true, q: card.q, a,
          options: shuffle([...rights.map(t => ({ t, c: true })), ...wrongs.map(t => ({ t, c: false }))]),
        };
      }
    }

    // 3b) NEU (26.07.2026, Live-Erkundung): Wahr/Falsch — Gizmo zeigt zwischendurch
    //     "Wahr oder falsch?"-Karten mit einer Aussage und zwei großen ✓/✗-Buttons.
    //     Wir bauen die Aussage aus Frage + behaupteter Antwort; bei 50 % ist die
    //     Behauptung die echte Antwort (wahr), sonst eine plausible Nachbar-Antwort
    //     aus demselben Block (falsch). Nur für kurze, eindeutige Antworten und nur
    //     mit ~30 % Wahrscheinlichkeit, damit das Format die MC/Lückentext-Mischung
    //     auflockert statt sie zu verdrängen.
    if (a.length >= 3 && a.length <= 60 && Math.random() < 0.3) {
      const isTrue = Math.random() < 0.5;
      let claim = a;
      if (!isTrue) {
        const alts = distractors(pool, card, a, 1, 'short');
        if (alts.length) claim = alts[0];
      }
      // Ohne brauchbaren Distraktor keine Falsch-Aussage möglich -> nur wenn wahr
      // oder claim wirklich abweicht; sonst unten normal weitermachen.
      if (isTrue || claim.toLowerCase() !== a.toLowerCase()) {
        return { kind: 'truefalse', generated: true, q: card.q, a, claim, truth: isTrue || claim.toLowerCase() === a.toLowerCase() };
      }
    }

    // 4) Lückentext — Begriff inline blanken, wenn genug Satzkontext übrig bleibt.
    const kt = keyTerm(a, card.q);
    const clozeOk = kt && a.length <= 160 && (a.length - kt.length) >= 12;

    // 5) Kurze Antwort -> generierte Single-MC.
    const mcOk = a.length <= 60;

    if (clozeOk && (!mcOk || Math.random() < 0.5)) {
      const wrongTerms = distractors(pool, card, kt, 2, 'terms');
      if (wrongTerms.length >= 2) {
        return {
          kind: 'cloze', q: card.q, a, term: kt,
          masked: a.replace(kt, '▁▁▁▁'),
          options: shuffle([{ t: kt, c: true }, ...wrongTerms.map(t => ({ t, c: false }))]),
        };
      }
    }
    if (mcOk) {
      const wrongs = distractors(pool, card, a, 2, 'short');
      if (wrongs.length >= 2) {
        return { kind: 'mc', multi: false, generated: true, q: card.q, a, options: shuffle([{ t: a, c: true }, ...wrongs.map(t => ({ t, c: false }))]) };
      }
    }

    // 6) Fallback: offener Abruf (lange Prosa — im Original ebenfalls reiner
    //    "Denk zuerst an die Antwort"-Modus mit Selbsteinschätzung).
    return { kind: 'recall', q: card.q, a };
  }

  // Blitzfragen-Countdown: im Original 3 s (kurze MC), 5 s / 7 s (mittel)
  // bis 24 s (Ordnen). Skaliert hier mit dem Lese-Umfang.
  function blitzSeconds(gen) {
    if (gen.kind === 'order') return 24;
    if (gen.kind === 'truefalse') return Math.max(3, Math.min(8, 3 + Math.floor(((gen.q || '').length + (gen.claim || '').length) / 80)));
    if (gen.kind === 'recall') return Math.max(3, Math.min(24, 3 + Math.floor((gen.a || '').length / 40)));
    const chars = (gen.options || []).reduce((s, o) => s + o.t.length, 0);
    return Math.max(3, Math.min(12, 3 + Math.floor(chars / 60)));
  }

  window.QEngine = {
    generate, blitzSeconds, keyTerm, splitList, shuffle, familyOf, _pools: pools,
    _invalidate: (topicId) => { delete cache[topicId]; },
  };
})();
