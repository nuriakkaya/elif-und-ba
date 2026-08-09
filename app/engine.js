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

  /* -------- Silben-Varianten (Koran) --------
     Gleiche Basis, drei Harekat (بَ/بِ/بُ) — das Verwechslungs-Training der
     Vokale aus dem Vorbild-Video. Labels kommen aus den ECHTEN Karten der
     drei Silben-Lektionen (be/bi/bü); nur wenn alle drei existieren, wird
     eine Hör-Übung generiert. */
  function syllableVariants(base, q) {
    const H = [['\u064E', 'quran-ustun'], ['\u0650', 'quran-esre'], ['\u064F', 'quran-otre']];
    const out = [];
    for (const [mark, tid] of H) {
      const t = (window.QURAN_TOPICS || []).find(x => x.id === tid);
      const hit = t && t.blocks[0].quiz.find(x => x.q === base + mark);
      if (!hit) return null;
      out.push({ ar: base + mark, t: hit.a });
    }
    const variants = shuffle(out);
    const correct = variants.findIndex(v => v.ar === q);
    if (correct < 0) return null;
    return { variants: variants, correct: correct };
  }

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
      if (isLetterCard && hf && Math.random() < 0.35) {
        const wrongs = shuffle(hf.blocks[0].quiz.map(x => x.q).filter(g => g !== uniq[0])).slice(0, 3);
        if (wrongs.length >= 3) {
          return {
            kind: 'mc', multi: false, generated: true, arabicOptions: true,
            q: 'Wo ist „' + a + '“?', a: uniq[0],
            options: shuffle([{ t: uniq[0], c: true }, ...wrongs.map(t => ({ t, c: false }))]),
          };
        }
      }
      // 1b) Silben (Üstün/Esre/Ötre): Hör-Übungen wie im Vorbild-Video —
      //     Typ B (Silbe sehen → Audio wählen) und Typ C (Audio hören →
      //     Schrift wählen), je ~30 % der Auftritte.
      if (/[\u064B-\u0652]/.test(card.q) && bare.length === 1) {
        const v = syllableVariants(bare, card.q);
        if (v) {
          const r2 = Math.random();
          if (r2 < 0.3) return { kind: 'audioPick', q: card.q, say: card.q, a, variants: v.variants, correct: v.correct };
          if (r2 < 0.6) return { kind: 'scriptPick', q: 'Höre zu und wähle die richtige Schrift', say: card.q, a, variants: v.variants, correct: v.correct };
        }
      }
      // 2) Active-Recall-Schwerpunkt: knapp ein Drittel reiner Abruf
      //    ("ansehen → laut sagen → aufdecken → ehrlich bewerten").
      if (Math.random() < 0.3) return { kind: 'recall', q: card.q, a };
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
    generate, blitzSeconds, keyTerm, splitList, shuffle, _pools: pools,
    _invalidate: (topicId) => { delete cache[topicId]; },
  };
})();
