/* global React, Icon, Mammoth, Owl, Joystick, Target, ImportTile, AnimalAvatar, MiniAxolotl, Axolotl, TutorPanel, TutorCollapse */
const { useState, useEffect, useRef } = React;

/* ==============================================================
   AUSWENDIG-MODUS — Runden-System, 1:1 nachgebaut nach der
   Live-Analyse des Originals (app.gizmo.ai, echter Account, 14.07.2026).

   Kernmechaniken (alle im Original direkt beobachtet):
   - Fragen werden pro Auftritt aus dem Kartenmaterial GENERIERT
     (app/engine.js): MC, Lückentext, Ordnen, offener Abruf.
   - Runden von ~7 Karten; falsch beantwortete Karten kommen später
     in derselben Runde wieder — beim Wiederauftritt IMMER zuerst
     die Abruf-Hürde ("Denk zuerst an die Antwort").
   - XP: 17 pro sauber richtiger Antwort, Combo 1,5x ab 3 in Folge,
     2x ab 5 in Folge, Combo-Popup, Reset bei Fehler (app/xp.js).
   - Blitzfragen: gemeisterte Karten tauchen mit Countdown wieder auf.
   - Rundenende: Konfetti, +8 XP Bonus, Meisterungs-Ring, Karten-Log
     mit Erklären, "Schwere Runde"/"Speed-run", danach Serien-Screen.
   ============================================================== */

function buildQueue(cards, topicId, opts = {}) {
  const by = { vergessen: [], am_lernen: [], neu: [], gemeistert: [] };
  cards.forEach(c => {
    const st = window.SRS ? window.SRS.getState(topicId, c).state : 'neu';
    (by[st] || by.neu).push(c);
  });
  const sh = window.QEngine.shuffle;
  const blitzOff = localStorage.getItem('s34a_blitz_off') === '1';

  // Koran-Kurs (06.08.2026, Nutzerkritik "am Anfang gab es nichts Gescheites
  // zu lernen"): Neue Karten kommen NICHT mehr zufällig durcheinander, sondern
  // in Kurs-Reihenfolge (Elif zuerst!) und höchstens 4 neue pro Runde — wie im
  // Vorbild: erst Wiederholen, dann eine kleine Portion Neues, sauber gelehrt.
  const isQuran = /^quran-/.test(String(topicId || ''));
  let fresh;
  if (opts.hard) {
    // "Schwere Runde": nur Wackelkandidaten (vergessen + am Lernen)
    fresh = sh([...by.vergessen, ...by.am_lernen]);
    if (!fresh.length) fresh = isQuran ? by.neu.slice() : sh(by.neu);
  } else if (isQuran) {
    const review = [...sh(by.vergessen), ...sh(by.am_lernen)];
    const size = opts.size || 7;
    const newCap = Math.max(2, Math.min(4, size - Math.min(review.length, size - 2)));
    fresh = [...review, ...by.neu.slice(0, newCap)]; // by.neu behält die Kurs-Reihenfolge
  } else {
    // Priorität wie beobachtet: Vergessenes zuerst, dann Angefangenes, dann Neues
    fresh = [...sh(by.vergessen), ...sh(by.am_lernen), ...sh(by.neu)];
  }
  let queue = fresh.slice(0, opts.size || 7).map(c => ({
    card: c, mode: opts.hard ? 'retry' : 'new', gen: window.QEngine.generate(c, topicId),
  }));

  if (opts.speed) {
    // Speed-run: alles als Blitzfrage mit knackigem 5s-Timer. Offene
    // Abruf-Karten lassen sich nicht sinnvoll timen (Antwort wäre sofort
    // sichtbar) — die laufen stattdessen mit Abruf-Hürde weiter.
    queue = queue.map(it => (it.gen.kind === 'recall' || it.gen.kind === 'audioPick' || it.gen.kind === 'scriptPick')
      ? { ...it, mode: 'retry' }
      : { ...it, mode: 'blitz', blitzSecs: 5 });
  } else if (!blitzOff && by.gemeistert.length && queue.length) {
    // Max. 2 Blitzfragen aus gemeisterten Karten in die Runde einstreuen —
    // nur Formate mit Optionen (MC/Lückentext/Ordnen), wie im Original.
    let injected = 0;
    for (const c of sh(by.gemeistert)) {
      if (injected >= 2) break;
      const gen = window.QEngine.generate(c, topicId);
      if (gen.kind === 'recall' || gen.kind === 'audioPick' || gen.kind === 'scriptPick') continue;
      queue.splice(Math.min(queue.length, 2 + injected * 3), 0, {
        card: c, mode: 'blitz', gen, blitzSecs: window.QEngine.blitzSeconds(gen),
      });
      injected++;
    }
  }

  if (!queue.length) {
    // Alles gemeistert: normale Wiederholungsrunde aus gemeisterten Karten
    queue = sh(by.gemeistert).slice(0, opts.size || 7).map(c => ({
      card: c, mode: 'new', gen: window.QEngine.generate(c, topicId),
    }));
  }
  // Koran (Video Typ A, ausgeweitet 06.08.2026): JEDE ganz neue Karte wird
  // zuerst als Lehrkarte gezeigt — Buchstabe/Silbe/Wort groß, Name sofort
  // sichtbar, Audio automatisch, "Verstanden"-Button. Erst DANACH kommt
  // dieselbe Karte als Übung. Vorher galt das nur für Silben; bei Lektion 1
  // war der allererste Kontakt deshalb eine Rate-Frage ohne jede Erklärung
  // ("da gab es nichts Gescheites zu lernen").
  if (/^quran-/.test(String(topicId || ''))) {
    const out = [];
    for (const it of queue) {
      const q = String(it.card.q || '');
      const bare = q.replace(/[\u064B-\u0652\u0670\u0640]/g, '').replace(/[^\u0600-\u06FF]/g, '');
      const st = window.SRS ? window.SRS.getState(topicId, it.card).state : 'neu';
      // Formen-Lektion lehrt über ihr eigenes Formen-Panel (quranforms.js) —
      // dort keine zusätzliche Lehrkarte davor.
      if (it.mode === 'new' && st === 'neu' && topicId !== 'quran-formen') {
        const isSyll = /[\u064B-\u0652]/.test(q) && bare.length === 1;
        const isLetter = !isSyll && (bare.length === 1 || bare === '\u0644\u0627'); // Lamelif z\u00E4hlt als Buchstabe
        const teachKind = isLetter ? 'Buchstabe' : isSyll ? 'Silbe' : 'Wort';
        out.push({ card: it.card, mode: 'teach', gen: { kind: 'teach', teachKind: teachKind, q: it.card.q, say: it.card.q, a: it.card.a } });
      }
      out.push(it);
    }
    queue = out;
  }
  return queue;
}

function srsBadge(topicId, item) {
  if (item.mode === 'teach') return { cls: 'qtag', label: '🌱 ' + (item.gen && item.gen.teachKind ? 'Neuer ' + item.gen.teachKind : 'Neu') + '!' };
  if (item.mode === 'retry') return { cls: 'qtag qtag-retry', label: '🔄 Erneut versuchen' };
  if (item.mode === 'blitz') return { cls: 'qtag qtag-blitz', label: '⚡ Blitzfrage' };
  const st = window.SRS ? window.SRS.getState(topicId, item.card).state : 'neu';
  if (st === 'gemeistert') return { cls: 'qtag qtag-mastered', label: '🏆 Gemeistert' };
  if (st === 'am_lernen') return { cls: 'qtag qtag-learning', label: '🎓 Am lernen' };
  if (st === 'vergessen') return { cls: 'qtag qtag-retry', label: '❓ Vergessen' };
  return { cls: 'qtag', label: '🌱 Neu' };
}

// Relative Zeitangabe für "Geschichte" (app/history.js) — bewusst eigene,
// kleine Implementierung statt einer Datumsbibliothek, deckt nur die hier
// gebrauchten Größenordnungen ab (Minuten bis Jahre).
function historyTimeAgo(ts) {
  const diffMs = Date.now() - ts;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'gestern';
  if (d < 7) return `vor ${d} Tg.`;
  const w = Math.floor(d / 7);
  if (w < 5) return `vor ${w} Wo.`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `vor ${mo} Mon.`;
  return `vor ${Math.floor(d / 365)} J.`;
}

/* fetchExplain() ist am 03.08.2026 entfallen: der KI-Tutor sitzt jetzt in
   app/tutor.js (Anfrage, Cache, Offline-Ersatz, Verfügbarkeitsprüfung) und
   app/tutorui.js (Darstellung). Der Aufruf hier hatte drei Schwächen, die das
   neue Modul behebt: er lief auch unter file:// ins Leere (Konsolenfehler pro
   Karte), er fragte dieselbe Karte bei jedem Auftritt neu an, und er lieferte
   unstrukturierten Fließtext statt der Stichpunkt-Form des Originals. */

// Harekat farbig hervorheben (Video-Detail): Basisbuchstabe bleibt dunkel, die
// Vokalzeichen (Üstün/Esre/Ötre …) werden blau — als React-Spans, damit das
// Kind sofort sieht, worum es in der Übung geht.
function tintAr(s) {
  const str = String(s || '');
  const rx = /([\u064B-\u0652\u0670]+)/g;
  const parts = []; let last = 0, m, k = 0;
  while ((m = rx.exec(str))) {
    if (m.index > last) parts.push(str.slice(last, m.index));
    parts.push(React.createElement('span', { key: k++, className: 'hareke' }, m[0]));
    last = m.index + m[0].length;
  }
  if (!parts.length) return str;
  if (last < str.length) parts.push(str.slice(last));
  return parts;
}

/* ============== EINZELNE KARTE (ein Auftritt) ============== */
function CardPlayer({ item, topicId, onDone, onDisableBlitz, xpFactor }) {
  const { card, mode, gen } = item;
  const kind = gen.kind;
  const isBlitz = mode === 'blitz';
  const isQuranCard = /^quran-/.test(String(topicId || ''));
  // Koran-Kurs: MC-Karten laufen OHNE Denk-Hürde — schnelles Tippen wie im
  // Vorbild-Video; aktives Abrufen übernehmen die reinen Abruf-Karten (~1/3)
  // und die Hürde nach Fehlern (mode 'retry').
  const needsGate = !isBlitz && (kind === 'recall' || kind === 'hiPick' || mode === 'retry');

  const [gate, setGate] = useState(needsGate ? 'think' : isBlitz ? 'blitz' : null);
  const [selected, setSelected] = useState([]);
  const [wrongPicks, setWrongPicks] = useState([]);
  const [placed, setPlaced] = useState([]);           // Ordnen: bereits richtig platzierte Texte
  const [flashWrong, setFlashWrong] = useState(null); // Ordnen: kurz rot aufblitzendes Element
  const [revealed, setRevealed] = useState(false);
  const [wasWrong, setWasWrong] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [needWeiter, setNeedWeiter] = useState(false);
  const [helpUsed, setHelpUsed] = useState({ tip: false, reveal: false, explain: false });
  // 03.08.2026: Die alte einzeilige KI-Sprechblase (kiText/kiStreaming) ist
  // durch das TutorPanel (app/tutorui.js) ersetzt — strukturierte Erklärung
  // plus "Mehr Details" und "Stelle eine Frage", wie im Original. Hier bleibt
  // nur noch ein Schalter übrig; Laden, Cache und Offline-Ersatz macht das Panel.
  const [tutorOpen, setTutorOpen] = useState(false);
  const [timerLeft, setTimerLeft] = useState(item.blitzSecs || 0);
  const timerRef = useRef(null);
  const doneRef = useRef(false);
  const revealedRef = useRef(false);
  useEffect(() => { revealedRef.current = revealed; }, [revealed]);
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const badge = srsBadge(topicId, item);
  const correctIdxs = (gen.options || []).map((o, i) => o.c ? i : -1).filter(i => i >= 0);
  const isMulti = kind === 'mc' && gen.multi;
  // Die richtige Antwort als Text — einmal pro Render berechnet, weil sie an
  // zwei Stellen gebraucht wird: als Prompt-Grundlage für den Tutor und als
  // Auflösung. Je nach Fragetyp steckt sie woanders.
  const answerText = (kind === 'recall' || kind === 'cloze' || kind === 'truefalse' || kind === 'teach' || kind === 'audioPick' || kind === 'scriptPick' || kind === 'formTeach' || kind === 'tilePick' || kind === 'hiPick') ? (gen.a || gen.term || '')
    : kind === 'order' ? (gen.order || []).join(' → ')
    : correctIdxs.map(i => gen.options[i].t).join(', ');
  const wrongTexts = (gen.options || []).filter(o => !o.c).map(o => o.t);

  const finish = (extra, delay) => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    const res = { correct: false, wasWrong, usedReveal: helpUsed.reveal, usedExplain: false, timeout: timedOut, blitz: isBlitz, ...extra };
    // Timing-Fix (05.08.2026, Nutzerkritik "Töne stören / zu spät"): Feedback-Ton
    // und Aussprache feuern SOFORT bei der Auflösung — vorher liefen sie erst
    // nach der Übergangs-Wartezeit (bis zu 1,2 s später) in advance(). Reihenfolge
    // wie im Vorbild-Video: kurzer Tick, ~160 ms später der Buchstabe.
    if (window.Sound && !res.blitz && !res.usedReveal && !res.usedExplain) {
      // Lehrkarten: nur ein dezenter Tick — kein "richtig"-Jingle für bloßes Ansehen.
      if (res.teach) { window.Sound.tick && window.Sound.tick(); }
      else { res.correct ? window.Sound.correct() : window.Sound.wrong(); }
    }
    // (06.08.2026) Aussprache kommt jetzt FAST sofort (60 ms statt 160 ms) —
    // der Feedback-Ton ist leiser abgemischt, die Stimme liegt klar darüber.
    if (window.QuranAudio && !res.teach) window.QuranAudio.speakForCard(topicId, { q: gen.arabicOptions ? gen.a : (gen.say || gen.q) }, 60);
    setTimeout(() => onDone(res), delay || 0);
  };

  /* ---- Blitz-Timer ---- */
  const startClock = () => {
    setGate(null);
    const total = item.blitzSecs * 1000;
    const t0 = Date.now();
    timerRef.current = setInterval(() => {
      const left = total - (Date.now() - t0);
      if (left <= 0) {
        clearInterval(timerRef.current);
        setTimerLeft(0);
        if (!revealedRef.current && !doneRef.current) {
          // Zeit abgelaufen: Original deckt die richtige Antwort automatisch auf
          setTimedOut(true);
          revealAll();
          setNeedWeiter(true);
        }
      } else {
        setTimerLeft(left / 1000);
      }
    }, 100);
  };

  const revealAll = () => {
    setRevealed(true);
    if (kind === 'order') setPlaced(gen.order.slice());
    // Koran-Kurs: beim Aufdecken sofort die richtige Aussprache vorsprechen
    if (window.QuranAudio) window.QuranAudio.speakForCard(topicId, { q: gen.arabicOptions ? gen.a : (gen.say || gen.q) });
  };

  // Koran (Video): Lehrkarten & "Schrift wählen" spielen ihr Audio automatisch
  useEffect(() => {
    if (gate) return;
    if ((kind === 'teach' || kind === 'scriptPick' || kind === 'formTeach') && window.QuranAudio) {
      window.QuranAudio.speakText(gen.say || gen.q, true);
    }
  }, [gate, kind]);

  /* ---- Antworten ---- */
  const pick = (i) => {
    if (revealed || gate || doneRef.current) return;
    if (wrongPicks.includes(i)) return;
    if (isMulti) {
      setSelected(s => s.includes(i) ? s.filter(x => x !== i) : [...s, i]);
      return;
    }
    if (gen.options[i].c) {
      setSelected([i]);
      setRevealed(true);
      // Koran (06.08.2026, "geh etwas langsamer zum nächsten"): Auflösung darf
      // atmen — Buchstabe fertig hören, Antwort ansehen, DANN weiter.
      finish({ correct: true }, isQuranCard ? 1500 : 850);
    } else {
      // Original: falsche Option blitzt rot, wird gesperrt, weiter raten
      setWasWrong(true);
      setSelected([i]);
      setWrongPicks(w => [...w, i]);
      setTimeout(() => { if (!revealedRef.current) setSelected([]); }, 550);
    }
  };

  const submitMulti = () => {
    const chosen = new Set(selected);
    const cset = new Set(correctIdxs);
    const right = chosen.size === cset.size && [...chosen].every(x => cset.has(x));
    if (!right) setWasWrong(true);
    setRevealed(true);
    finish({ correct: right, wasWrong: !right || wasWrong }, isQuranCard ? 1600 : 1200);
  };

  const pickOrder = (txt) => {
    if (revealed || gate || doneRef.current || placed.includes(txt)) return;
    const expected = gen.order[placed.length];
    if (txt === expected) {
      const p = [...placed, txt];
      setPlaced(p);
      if (p.length === gen.order.length) {
        setRevealed(true);
        finish({ correct: !wasWrong }, 950);
      }
    } else {
      setWasWrong(true);
      setFlashWrong(txt);
      setTimeout(() => setFlashWrong(null), 500);
    }
  };

  const selfAssess = (didKnow) => {
    if (doneRef.current) return;
    if (!didKnow) setWasWrong(true);
    finish({ correct: didKnow, wasWrong: !didKnow }, isQuranCard ? 800 : 350);
  };

  // Koran Hör-Übungen (Video Typ B/C): wählen → BESTÄTIGEN → Auflösung.
  const pickVariant = (i) => {
    if (revealed || gate || doneRef.current) return;
    setSelected([i]);
    if (kind === 'audioPick' && window.QuranAudio) window.QuranAudio.speakText(gen.variants[i].ar, true);
  };
  const confirmVariant = () => {
    if (revealed || doneRef.current || !selected.length) return;
    const ok = selected[0] === gen.correct;
    if (!ok) setWasWrong(true);
    setRevealed(true);
    if (window.QuranAudio) window.QuranAudio.speakText(gen.say || gen.q, true);
    finish({ correct: ok, wasWrong: !ok || wasWrong }, ok ? 1300 : 2100);
  };
  const variantDontKnow = () => {
    if (revealed || doneRef.current) return;
    setWasWrong(true);
    setRevealed(true);
    if (window.QuranAudio) window.QuranAudio.speakText(gen.say || gen.q, true);
    finish({ correct: false, wasWrong: true }, 2100);
  };

  // Formen-Kachel-Übung ("Klicke auf den richtigen Buchstaben", Video):
  // Kachel wählen → BESTÄTIGEN → richtige Kachel färbt sich türkis.
  const pickFormTile = (i) => {
    if (revealed || gate || doneRef.current) return;
    setSelected([i]);
  };
  const confirmFormTile = () => {
    if (revealed || doneRef.current || !selected.length) return;
    const ok = selected[0] === gen.correct;
    if (!ok) setWasWrong(true);
    setRevealed(true);
    if (window.QuranAudio) window.QuranAudio.speakText(gen.say || gen.q, true);
    finish({ correct: ok, wasWrong: !ok || wasWrong }, ok ? 1400 : 2200);
  };
  const formTileDontKnow = () => {
    if (revealed || doneRef.current) return;
    setWasWrong(true);
    setRevealed(true);
    if (window.QuranAudio) window.QuranAudio.speakText(gen.say || gen.q, true);
    finish({ correct: false, wasWrong: true }, 2200);
  };
  // "Vage" (Video): zählt als "nochmal üben", kostet aber kein Herz.
  const selfAssessVague = () => {
    if (doneRef.current) return;
    setWasWrong(true);
    finish({ correct: false, wasWrong: true, vague: true }, isQuranCard ? 800 : 350);
  };

  // Wahr/Falsch (26.07.2026): ein Versuch, sofortige Auflösung. Bei falscher
  // Aussage wird nach dem Antworten die echte Antwort eingeblendet, damit die
  // Karte trotzdem einen Lerneffekt hat (wie im Original beobachtet).
  const [tfChoice, setTfChoice] = useState(null); // true = "Wahr" geklickt
  const pickTF = (saidTrue) => {
    if (revealed || gate || doneRef.current) return;
    setTfChoice(saidTrue);
    const right = saidTrue === gen.truth;
    if (!right) setWasWrong(true);
    setRevealed(true);
    finish({ correct: right, wasWrong: !right }, right && gen.truth ? 900 : 1600);
  };

  /* ---- Helfer (Tipp / Aufdecken / Erklären) ---- */
  // Tipp (50:50) kostet seit Phase 14 einen 🔑-Schlüssel (app/hearts.js) — bei
  // ausgeschaltetem Herzen-System bleibt er wie früher gratis/unbegrenzt.
  const onTip = () => {
    if (helpUsed.tip || revealed || gate || kind === 'order' || kind === 'recall' || kind === 'truefalse') return;
    const wrongs = gen.options.map((o, i) => (!o.c && !wrongPicks.includes(i)) ? i : -1).filter(i => i >= 0);
    if (wrongs.length <= 1) return; // mind. 1 falsche Option stehen lassen
    if (window.Hearts && !window.Hearts.useTip()) return; // kein Schlüssel übrig
    const hide = wrongs[Math.floor(Math.random() * wrongs.length)];
    setWrongPicks(w => [...w, hide]);
    setHelpUsed(u => ({ ...u, tip: true }));
  };
  const heartsSnapshot = window.Hearts ? window.Hearts.state() : null; // einmal pro Render lesen
  const tipAvailable = !heartsSnapshot || !heartsSnapshot.enabled || heartsSnapshot.tips > 0;
  const onRevealHelp = () => {
    if (helpUsed.reveal || revealed || gate || kind === 'recall' || kind === 'teach' || kind === 'audioPick' || kind === 'scriptPick') return;
    setHelpUsed(u => ({ ...u, reveal: true }));
    revealAll();
    setNeedWeiter(true);
  };
  const onExplain = () => {
    if (helpUsed.explain || tutorOpen || revealed || doneRef.current) return;
    setHelpUsed(u => ({ ...u, explain: true }));
    // Original-Verhalten: Erklären VOR dem Antworten deckt die Lösung auf,
    // gibt keine XP und die Karte kommt später erneut dran.
    revealAll();
    setNeedWeiter(true);
    setTutorOpen(true);
  };
  const weiter = () => {
    finish({ correct: false, usedExplain: helpUsed.explain, usedReveal: helpUsed.reveal }, 0);
  };

  /* ---- Render ---- */
  // Quran-Progress-Wortlaut (Videos): Der Aufdeck-Button heißt je nach Lektion
  // "Errate den Buchstaben / die Silbe / das Wort" — sonst neutral.
  const isGuessKind = kind === 'recall' || kind === 'hiPick';
  const gateLabel = !isGuessKind ? 'Optionen anzeigen'
    : kind === 'hiPick' ? 'Errate den Buchstaben'
    : /^quran-(harfler|formen|mahrec)/.test(String(topicId||'')) ? 'Errate den Buchstaben'
    : /^quran-(ustun|esre|otre)/.test(String(topicId||'')) ? 'Errate die Silbe'
    : isQuranCard ? 'Errate das Wort'
    : 'Antwort aufdecken';
  const cardLabelText = kind === 'hiPick' ? 'Errate den hervorgehobenen Buchstaben'
    : isQuranCard
    ? (/^quran-(harfler|formen|mahrec)/.test(String(topicId||'')) ? 'Buchstabe' : 'Arabisch')
    : 'Frage';
  const showHelpers = !gate && !revealed && !isBlitzGateOpen() && !isQuranCard && kind !== 'teach' && kind !== 'audioPick' && kind !== 'scriptPick';
  function isBlitzGateOpen() { return isBlitz && gate === 'blitz'; }

  return (
    <div className="stage-inner">
      {/* Blitz-Countdown-Balken */}
      {isBlitz && !gate && !revealed && (
        <div className="blitz-timer">
          <span className="blitz-timer-label">⏱ {Math.ceil(timerLeft)}s</span>
          <div className="blitz-timer-track"><div className="blitz-timer-fill" style={{ width: `${(timerLeft / item.blitzSecs) * 100}%` }} /></div>
        </div>
      )}

      {/* Fragekarte im Quran-Progress-Look: navy Labelbalken ("Arabisch"/
          "Buchstabe") mit 🔊 direkt über der großen weißen Karte mit Navy-Rand. */}
      <div className="question-card qp-card">
        <div className="qp-cardlabel">
          <span>{cardLabelText}</span>
          <span className="qp-labelicons">
            <span className={badge.cls}>{badge.label}</span>
            {isQuranCard && <button className="qp-spk-mini" title="Anhören"
              onClick={() => window.QuranAudio && window.QuranAudio.speakText(gen.say || gen.q, true)}>🔊</button>}
            {isQuranCard && <button className="qp-spk-mini" title="Langsam anhören"
              onClick={() => window.QuranAudio && window.QuranAudio.speakText(gen.say || gen.q, true, { slow: true })}>🐢</button>}
          </span>
        </div>
        <div className="qp-cardbody">
        {kind === 'hiPick'
          ? <div className="qtext qtext-arabic" dir="rtl">{gen.clusters.map((c, i) =>
              i === gen.target
                ? <span key={i} className="qp-hl">{c}</span>
                : <React.Fragment key={i}>{c}</React.Fragment>)}</div>
          : <div className={'qtext' + (window.QuranCourse && window.QuranCourse.isArabicHeavy(gen.q) ? ' qtext-arabic' : '')}>{window.QuranCourse && window.QuranCourse.isArabicHeavy(gen.q) ? tintAr(gen.q) : gen.q}</div>}
        {/* Lückentext: Antwortsatz mit Lücke direkt in der Fragekarte (wie im Original) */}
        {kind === 'cloze' && !gate && (
          <div className="cloze-line">
            {revealed
              ? gen.a.split(gen.term).flatMap((part, i, arr) => i < arr.length - 1
                  ? [part, <span key={i} className="cloze-filled">{gen.term}</span>]
                  : [part])
              : gen.masked.split('▁▁▁▁').flatMap((part, i, arr) => i < arr.length - 1
                  ? [part, <span key={i} className="cloze-blank">&nbsp;&nbsp;&nbsp;&nbsp;</span>]
                  : [part])}
          </div>
        )}
        {isMulti && !gate && !revealed && (
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>Wähle alle richtigen Antworten · {selected.length} ausgewählt</div>
        )}
        </div>
      </div>

      {/* Blitzfrage-Intro (gelbe Karte mit "Uhr starten") */}
      {isBlitzGateOpen() && (
        <>
          <div className="card flat blitz-card">
            <div className="blitz-title">Blitz<br/>Frage</div>
            <div className="blitz-sub">Denk an die Antwort, bevor du die Uhr startest, um <b>aktives Abrufen</b> zu üben</div>
            <div className="blitz-chip">⏱ {item.blitzSecs} Sekunden</div>
            <div className="blitz-flashes">⚡⚡⚡⚡</div>
            <div style={{ width: '100%', borderTop: '1px solid rgba(0,0,0,0.08)', marginTop: 14, paddingTop: 12 }}>
              <button className="btn btn-ghost btn-full" onClick={startClock}>Uhr starten</button>
            </div>
          </div>
          <button className="btn btn-ghost" style={{ margin: '0 auto', padding: '10px 22px' }} onClick={onDisableBlitz}>Blitzfragen ausschalten</button>
        </>
      )}

      {/* Abruf-Hürde im Quran-Progress-Stil: kursive Hinweisbox + großer
          navy "Errate …"-Button (Wortlaut exakt wie im Vorbild-Video). */}
      {gate === 'think' && (
        <>
          <div className="qp-gatespacer"/>
          <div className="qp-hintbox">Denke über die richtige Antwort nach und klicke dann auf die nächste Schaltfläche</div>
          <button className="qp-btn" onClick={() => setGate(null)}>{gateLabel}</button>
        </>
      )}

      {/* Koran Typ A (Video, Ausbau 06.08.2026): Lehrkarte — der ERSTE Kontakt
          mit einem neuen Buchstaben/einer Silbe/einem Wort ist jetzt ein echter
          Lehr-Moment: Name sofort sichtbar, Audio automatisch + nochmal-Knopf,
          freundlicher Merk-Hinweis. Erst danach wird abgefragt. */}
      {!gate && kind === 'teach' && (
        <>
          <div className="qp-teachbox">
            <div className="qp-teachtitle">{gen.teachKind === 'Silbe' ? '🌱 Neue Silbe!' : gen.teachKind === 'Wort' ? '🌱 Neu!' : '🌱 Neuer Buchstabe!'}</div>
            <div className="qp-teachname">{gen.a}</div>
            <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
              <button className="qp-teachspk" onClick={() => window.QuranAudio && window.QuranAudio.speakText(gen.say || gen.q, true)}>
                🔊 Nochmal anhören
              </button>
              <button className="qp-teachspk" onClick={() => window.QuranAudio && window.QuranAudio.speakText(gen.say || gen.q, true, { slow: true })}>
                🐢 Langsam
              </button>
            </div>
          </div>
          <div className="qp-gatespacer"/>
          <div className="qp-hintbox">Schau genau hin und sprich laut mit — gleich wirst du danach gefragt! 😊</div>
          <button className="qp-btn" onClick={() => finish({ correct: true, teach: true }, 0)}>Verstanden — weiter</button>
        </>
      )}

      {/* Formen-Lehrkarte (Video "Buchstaben"): Formen-Panel Ende·Mitte·Anfang
          + Warnbox bei Einzelgängern + WEITER. */}
      {!gate && kind === 'formTeach' && (
        <>
          <div className="qp-formpanel">
            <div className="qp-formhead">Buchstabenformen</div>
            <div className="qp-formbody">
              {gen.forms.joins ? (
                <>
                  <div className="qp-formcell"><small>Ende</small><div className="qp-formar">{gen.forms.end}</div></div>
                  <div className="qp-formcell"><small>Mitte</small><div className="qp-formar">{gen.forms.mid}</div></div>
                  <div className="qp-formcell"><small>Anfang</small><div className="qp-formar">{gen.forms.start}</div></div>
                </>
              ) : (
                <>
                  <div className="qp-formcell"><small>Ende</small><div className="qp-formar">{gen.forms.end}</div></div>
                  <div className="qp-formcell"><small>Allein</small><div className="qp-formar">{gen.forms.alone}</div></div>
                </>
              )}
            </div>
          </div>
          {!gen.forms.joins && (
            <div className="qp-warnbox">⚠️ Dieser Buchstabe verbindet sich nicht mit dem folgenden Buchstaben.</div>
          )}
          <div className="qp-answrap">
            <div className="qp-cardlabel qp-cardlabel-slim">Deutsch</div>
            <div className="qp-ansfield">{gen.a}</div>
          </div>
          <div className="qp-gatespacer"/>
          <button className="qp-btn" onClick={() => finish({ correct: true, teach: true }, 0)}>Weiter</button>
        </>
      )}

      {/* Formen-Übung (Video): "Klicke auf den richtigen Buchstaben" —
          echtes Wort in Kacheln, Auswahl blau, Auflösung türkis/rot. */}
      {!gate && kind === 'tilePick' && (
        <>
          <div className="qp-formpanel">
            <div className="qp-formhead">Klicke auf den richtigen Buchstaben</div>
            <div className="qp-tilebox">
              <div className="qp-tilerow" dir="rtl">
                {gen.tiles.map((t, i) => {
                  let cls = 'qp-tile';
                  if (revealed) {
                    if (i === gen.correct) cls += ' is-ok';
                    else if (selected.includes(i)) cls += ' is-bad';
                  } else if (selected.includes(i)) cls += ' is-sel';
                  return <button key={i} className={cls} onClick={() => pickFormTile(i)}>{t}</button>;
                })}
              </div>
            </div>
          </div>
          {revealed && (
            <div className="qp-hintbox">{gen.word} = <b>{gen.wordTr}</b> · Das ist <b>{gen.a}</b></div>
          )}
          {!revealed && (
            <>
              <div className="qp-gatespacer"/>
              <button className="qp-btn" disabled={!selected.length} style={{ opacity: selected.length ? 1 : 0.45 }} onClick={confirmFormTile}>Bestätigen</button>
              <button className="qp-btn qp-btn-red" onClick={formTileDontKnow}>Ich weiss es nicht</button>
            </>
          )}
        </>
      )}

      {/* Koran Typ B (Video): Silbe sehen — passendes Audio aus drei wählen */}
      {!gate && kind === 'audioPick' && (
        <>
          <div className="muted" style={{ textAlign: 'center', fontSize: 13, fontWeight: 700 }}>Höre zu und wähle das passende Audio</div>
          <div className="spkrow">
            {gen.variants.map((v, i) => {
              let cls = 'spk-btn';
              if (revealed) {
                if (i === gen.correct) cls += ' is-ok';
                else if (selected.includes(i)) cls += ' is-bad';
              } else if (selected.includes(i)) cls += ' is-sel';
              return (
                <button key={i} className={cls} onClick={() => pickVariant(i)}>
                  {revealed && i === gen.correct ? String(v.t || '').toUpperCase() : '🔊'}
                </button>
              );
            })}
          </div>
          {!revealed && (
            <>
              <div className="qp-gatespacer"/>
              <button className="qp-btn" disabled={!selected.length} style={{ opacity: selected.length ? 1 : 0.45 }} onClick={confirmVariant}>Bestätigen</button>
              <button className="qp-btn qp-btn-red" onClick={variantDontKnow}>Ich weiss es nicht</button>
            </>
          )}
        </>
      )}

      {/* Koran Typ C (Video): Audio hören — richtige Schrift wählen */}
      {!gate && kind === 'scriptPick' && (
        <>
          <button className="bigspk" onClick={() => window.QuranAudio && window.QuranAudio.speakText(gen.say, true)} title="Nochmal anhören">🔊</button>
          <div className="script-row">
            {gen.variants.map((v, i) => {
              let cls = 'option option-arabic script-tile';
              if (revealed) {
                if (i === gen.correct) cls += ' is-correct';
                else if (selected.includes(i)) cls += ' is-wrong';
                else cls += ' is-disabled';
              } else if (selected.includes(i)) cls += ' is-correct';
              return <button key={i} className={cls} onClick={() => pickVariant(i)}>{tintAr(v.ar)}</button>;
            })}
          </div>
          {!revealed && (
            <>
              <div className="qp-gatespacer"/>
              <button className="qp-btn" disabled={!selected.length} style={{ opacity: selected.length ? 1 : 0.45 }} onClick={confirmVariant}>Bestätigen</button>
              <button className="qp-btn qp-btn-red" onClick={variantDontKnow}>Ich weiss es nicht</button>
            </>
          )}
        </>
      )}

      {/* Offener Abruf im Quran-Progress-Look: "Deutsch"-Antwortpanel +
          "Nicht schummeln!"-Hinweis + JA / VAGE / NEIN in den Videofarben.
          Gilt auch für "Errate den hervorgehobenen Buchstaben" (hiPick). */}
      {!gate && (kind === 'recall' || kind === 'hiPick') && (
        <>
          <div className="qp-answrap">
            <div className="qp-cardlabel qp-cardlabel-slim">{isQuranCard ? 'Deutsch' : 'Antwort'}</div>
            <div className="qp-ansfield" style={{ whiteSpace: 'pre-wrap' }}>{gen.a}{kind === 'hiPick' && gen.wordTr ? <small style={{display:'block',fontWeight:600,opacity:.7}}>{gen.q} = {gen.wordTr}</small> : null}</div>
          </div>
          {!revealed && !needWeiter && !doneRef.current && (
            <>
              <div className="qp-gatespacer"/>
              <div className="qp-hintbox">Also, hattest du die richtige Antwort? (Nicht schummeln!)</div>
              <div className="qp-raterow">
                <button className="qp-rate qp-rate-ja" onClick={() => selfAssess(true)}>Ja</button>
                <button className="qp-rate qp-rate-vage" onClick={selfAssessVague}>Vage</button>
                <button className="qp-rate qp-rate-nein" onClick={() => selfAssess(false)}>Nein</button>
              </div>
            </>
          )}
        </>
      )}

      {/* Wahr/Falsch (26.07.2026): Aussage + zwei große ✓/✗-Buttons wie bei Gizmo */}
      {!gate && kind === 'truefalse' && (
        <>
          <div className="card flat tf-claim" style={{ padding: 18 }}>
            <div className="muted" style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Wahr oder falsch?</div>
            <div style={{ lineHeight: 1.5, fontWeight: 600 }}>Antwort: „{gen.claim}“</div>
          </div>
          {!revealed && (
            <div className="row" style={{ gap: 10 }}>
              <button className="option tf-btn tf-false" style={{ flex: 1, textAlign: 'center', fontWeight: 800, fontSize: 17 }} onClick={() => pickTF(false)}>✗ Falsch</button>
              <button className="option tf-btn tf-true" style={{ flex: 1, textAlign: 'center', fontWeight: 800, fontSize: 17 }} onClick={() => pickTF(true)}>✓ Wahr</button>
            </div>
          )}
          {revealed && (
            <div className="row" style={{ gap: 10 }}>
              <div className={'option tf-btn ' + (gen.truth === false ? 'is-correct' : (tfChoice === false ? 'is-wrong' : 'is-disabled'))} style={{ flex: 1, textAlign: 'center', fontWeight: 800, fontSize: 17 }}>✗ Falsch</div>
              <div className={'option tf-btn ' + (gen.truth === true ? 'is-correct' : (tfChoice === true ? 'is-wrong' : 'is-disabled'))} style={{ flex: 1, textAlign: 'center', fontWeight: 800, fontSize: 17 }}>✓ Wahr</div>
            </div>
          )}
          {revealed && !gen.truth && (
            <div className="card flat" style={{ padding: 14, borderLeft: '4px solid var(--success, #1B8A5A)' }}>
              <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Richtige Antwort</div>
              <div style={{ lineHeight: 1.45 }}>{gen.a}</div>
            </div>
          )}
        </>
      )}

      {/* MC / Lückentext-Optionen */}
      {!gate && (kind === 'mc' || kind === 'cloze') && (
        <div className="options">
          {gen.options.map((o, i) => {
            const isSel = selected.includes(i);
            const wasWrongPick = wrongPicks.includes(i);
            let cls = 'option';
            if (revealed) {
              if (o.c) cls += ' is-correct';
              else if (isSel) cls += ' is-wrong';
              else cls += ' is-disabled';
            } else if (isSel && wasWrongPick) cls += ' is-wrong';
            else if (wasWrongPick) cls += ' is-disabled';
            else if (isSel) cls += ' is-correct';
            return <button key={i} className={cls + (gen.arabicOptions ? ' option-arabic' : '')} onClick={() => pick(i)}>{gen.arabicOptions ? tintAr(o.t) : o.t}</button>;
          })}
        </div>
      )}

      {!gate && isMulti && !revealed && (
        <button className="btn btn-primary btn-full btn-lg" disabled={!selected.length} onClick={submitMulti} style={{ opacity: selected.length ? 1 : 0.4 }}>
          Prüfen
        </button>
      )}

      {/* Ordnen */}
      {!gate && kind === 'order' && (
        <>
          <div className="order-hint">💡 Klicke die Elemente in der richtigen Reihenfolge</div>
          <div className="options">
            {(() => {
              // platzierte Elemente oben (nummeriert, grün), offene darunter in Ausgangsreihenfolge
              const rows = [
                ...placed.map((t, n) => ({ t, placedAt: n })),
                ...gen.items.filter(t => !placed.includes(t)).map(t => ({ t, placedAt: -1 })),
              ];
              return rows.map(({ t, placedAt }) => {
                let cls = 'option order-option';
                if (placedAt >= 0) cls += ' is-placed';
                if (flashWrong === t) cls += ' is-wrong';
                return (
                  <button key={t} className={cls} onClick={() => pickOrder(t)}>
                    {placedAt >= 0 && <span className="order-num">{placedAt + 1}.</span>} {t}
                  </button>
                );
              });
            })()}
          </div>
        </>
      )}

      {/* KI-Tutor zu genau dieser Karte (strukturiert + Rückfragen) */}
      {tutorOpen && (
        <TutorPanel card={card} topicId={topicId} answerTxt={answerText} wrong={wrongTexts} auto />
      )}

      {/* Helfer-Leiste */}
      {showHelpers && (
        <div className="helpers">
          {(kind === 'mc' || kind === 'cloze') && (
            <button className={'helper ' + (helpUsed.tip || !tipAvailable ? 'is-used' : '')} onClick={onTip}
                    title={tipAvailable ? undefined : 'Keine Tipp-Schlüssel mehr'}>
              <span className="helper-emoji">🔑</span> Tipp
            </button>
          )}
          {kind !== 'recall' && (
            <button className={'helper ' + (helpUsed.reveal ? 'is-used' : '')} onClick={onRevealHelp}>
              <span className="helper-emoji">🔍</span> Aufdecken
            </button>
          )}
          <button className={'helper ' + (helpUsed.explain ? 'is-used' : '')} onClick={onExplain} disabled={tutorOpen}>
            <span className="helper-emoji">🟣</span> Erklären
          </button>
        </div>
      )}

      {/* 🎤 Nachsprech-Bonus (app/echo.js): freiwillig, nach der Antwort.
          Das Modul entscheidet selbst, ob es sich zeigt — es tut das NUR in
          Lektion 1, wo das Kind den Buchstabennamen sagt („Elif", „Be"). */}
      {needWeiter && window.EchoBonus && kind !== 'teach' && (
        <window.EchoBonus answer={item && item.card ? (item.card.a || '') : ''}
                          topicId={(item && item.card && item.card._topicId) || topicId}
                          factor={xpFactor == null ? 1 : xpFactor}
                          seq={item && item.card ? (item.card.q || '') : ''}/>
      )}
      {needWeiter && (
        isQuranCard
          ? <button className="qp-btn" onClick={weiter}>Weiter</button>
          : <button className="btn btn-primary btn-full btn-lg" onClick={weiter}>Weiter <Icon.Arrow /></button>
      )}
    </div>
  );
}

/* ============== QUIZ-SESSION (Runden-Controller) ============== */
function QuizScreen({ go, stackName, questionStyle, questions, topicId, roundSize }) {
  const raw = (questions && questions.length) ? questions : window.QUESTIONS_DATA;
  const data = raw.filter(q => (q.options && q.options.length > 0) || (q.a && q.a.trim()));

  const [phase, setPhase] = useState('quiz'); // quiz | roundEnd | streak
  // Regel-Intro (Video "Kurze Vokale"): beim allerersten Start einer
  // Koran-Lektion zuerst die Regel zeigen; später über ℹ️ erneut abrufbar.
  const [introOpen, setIntroOpen] = useState(() =>
    /^quran-/.test(String(topicId || '')) && window.QuranIntro &&
    window.QuranIntro.has(topicId) && !window.QuranIntro.seen(topicId));
  const [round, setRound] = useState(1);
  /* 🔁 Wiederholungs-Punkte (11.08.2026, siehe app/replay.js): Der Faktor wird
     EINMAL beim Betreten der Lektion bestimmt und gilt für die ganze Sitzung.
     Sonst würde genau die Antwort, die die Lektion auf 100 % bringt, sich
     selbst noch halbieren — das wäre für Kinder nicht nachvollziehbar. */
  const replay = useRef(null);
  if (replay.current === null) {
    const wasDone = window.Replay ? window.Replay.isDone(topicId, data) : false;
    replay.current = { wasDone, factor: window.Replay ? window.Replay.factor(topicId, data) : 1, counted: false };
  }
  const xpFactor = replay.current.factor;
  const [queue, setQueue] = useState(() => buildQueue(data, topicId, roundSize ? { size: roundSize } : {}));
  const [idx, setIdx] = useState(0);
  const [playSeq, setPlaySeq] = useState(0);
  const [combo, setCombo] = useState(0);
  const [roundXp, setRoundXp] = useState(0);
  const [roundCoins, setRoundCoins] = useState(0);
  const [popup, setPopup] = useState(null);
  const [log, setLog] = useState([]);
  const [streakInfo, setStreakInfo] = useState(null);
  const [streakShown, setStreakShown] = useState(false);
  // Herzen-System (Blueprint Phase 14, app/hearts.js): Stand live abonnieren,
  // bei 0 Herzen wird die Runde mit einem "Keine Herzen mehr"-Screen unterbrochen.
  const [heartsState, setHeartsState] = useState(() => (window.Hearts ? window.Hearts.state() : { enabled: false, hearts: 5, max: 5, tips: 0, superActive: false, nextInMin: 0 }));
  useEffect(() => {
    if (!window.Hearts) return undefined;
    return window.Hearts.onChange(setHeartsState);
  }, []);
  // (Review 21.07.2026) Die Herz-Regeneration ist lazy (kein Timer im Modul) — auf
  // dem "Keine Herzen mehr"-Screen wären Countdown und Herzstand sonst eingefroren
  // geblieben. Solange 0 Herzen: alle 30s den Stand neu lesen.
  const outOfHearts = heartsState.enabled && !heartsState.superActive && heartsState.hearts <= 0;
  useEffect(() => {
    if (!outOfHearts || !window.Hearts) return undefined;
    const t = setInterval(() => setHeartsState(window.Hearts.state()), 30000);
    return () => clearInterval(t);
  }, [outOfHearts]);
  const popupTimer = useRef(null);
  useEffect(() => () => { if (popupTimer.current) clearTimeout(popupTimer.current); }, []);
  // (Ausbau 23.07.2026) Schwebende "+XP"-Partikel neben der XP-Pille.
  const [floats, setFloats] = useState([]);
  const floatSeq = useRef(0);
  const pushFloat = (text, big) => {
    const id = ++floatSeq.current;
    setFloats(f => [...f, { id, text, big: !!big }]);
    // Küken-Floats (Serientag gesichert) bleiben länger stehen — sie tragen mehr Info.
    setTimeout(() => setFloats(f => f.filter(x => x.id !== id)), big ? 1700 : 1050);
  };
  // (Ausbau 23.07.2026) "Stapel gemeistert"-Feier: feuert einmal, wenn alle Karten
  // des Stapels den Zustand "gemeistert" erreicht haben (localStorage-Flag pro
  // Stapel; fällt der Stand später wieder unter 100%, wird das Flag entfernt und
  // die nächste Voll-Meisterung erneut gefeiert).
  const [mastered, setMastered] = useState(false);
  const masteredTimer = useRef(null);
  useEffect(() => () => { if (masteredTimer.current) clearTimeout(masteredTimer.current); }, []);
  const checkMastered = () => {
    if (!window.SRS || !topicId || !data.length) return;
    const st = window.SRS.topicStats(topicId, data);
    const flagKey = 's34a_mastered_' + topicId;
    const done = st.total > 0 && st.gemeistert === st.total;
    let hasFlag = false;
    try { hasFlag = !!localStorage.getItem(flagKey); } catch (e) {}
    if (done && !hasFlag) {
      try { localStorage.setItem(flagKey, '1'); } catch (e) {}
      setMastered(true);
      window.Sound && window.Sound.stackMastered && window.Sound.stackMastered();
      // (Neufassung 26.07.2026) Konfetti in drei Salven — eine einzelne Salve
      // wirkte dünn. Läuft als reines DOM-Overlay neben React her.
      window.Celebrate && window.Celebrate.bigCelebration({ count: 90 });
      if (masteredTimer.current) clearTimeout(masteredTimer.current);
      masteredTimer.current = setTimeout(() => setMastered(false), 6200);
    } else if (!done && hasFlag) {
      try { localStorage.removeItem(flagKey); } catch (e) {}
    }
  };

  // KI-Varianten für die Karten dieser Runde im Hintergrund vorgenerieren
  // (einmal pro Runde, Ergebnisse landen im localStorage-Cache — siehe app/aigen.js).
  useEffect(() => {
    if (window.AIGen) window.AIGen.warmup(queue.map(it => it.card), topicId);
  }, [round]);

  const item = queue[idx];

  const showPopup = (p) => {
    setPopup(p);
    if (popupTimer.current) clearTimeout(popupTimer.current);
    popupTimer.current = setTimeout(() => setPopup(null), 1900);
  };

  const advance = (q2) => {
    if (idx + 1 < q2.length) {
      setQueue(q2);
      setIdx(idx + 1);
      setPlaySeq(s => s + 1);
    } else {
      // Rundenende: +8 XP Bonus (wie im Original auf dem Ende-Screen ausgewiesen)
      if (window.XP) {
        const bonusXp = window.XP.endRound(xpFactor);
        window.XP.bumpTopic(topicId, bonusXp);
        setRoundXp(x => x + bonusXp);
      }
      window.Sound && window.Sound.roundEnd();
      // Eine Wiederholung ist erst am RUNDENENDE verbraucht (Abbrechen zählt nicht).
      if (window.Replay && replay.current.wasDone && !replay.current.counted) {
        replay.current.counted = true;
        window.Replay.finishRound(topicId, true);
      }
      setQueue(q2);
      setPhase('roundEnd');
      // Klassenzimmer sofort auffrischen: die Lehrkraft sieht den neuen Stand
      // direkt nach der Runde (statt erst beim nächsten Sync-Puls).
      if (window.SimpleSync && window.SimpleSync.postClassSummary) window.SimpleSync.postClassSummary(true);
    }
  };

  const onDone = (res) => {
    const it = item;
    // Lehrkarten (Koran Typ A) sind reine Ansicht: kein SRS, keine XP, kein Log.
    if (res.teach) { advance(queue); return; }
    // ---- SRS-Fortschritt
    // Gezieltes Buchstaben-Training (Koran): Karten fremder Lektionen tragen ihre
    // Heimat-Lektion in _topicId — dort wird der Fortschritt verbucht, damit die
    // Buchstaben-Übersicht (Prozent-Ringe) mitwächst.
    const srsTopic = (it.card && it.card._topicId) || topicId;
    if (window.SRS) {
      if (res.usedExplain) {
        window.SRS.recordAnswer(srsTopic, it.card, false, false);
      } else {
        const clean = it.mode === 'new' && res.correct && !res.wasWrong && !res.usedReveal;
        window.SRS.recordAnswer(srsTopic, it.card, res.correct, clean);
      }
      // Kumulativer "beantwortete Fragen"-Zähler fürs Übungstest-Freischalten (zählt
      // jede aufgelöste Karte, nicht nur den ersten Versuch je Karte — siehe srs.js).
      if (!res.blitz) window.SRS.bumpAnswered(topicId);
    }
    // ---- Sound: richtig/falsch, aber nicht bei Blitz oder Aufdecken/Erklären (das
    // ist keine "falsche Antwort", sondern ein aktiv angeforderter Hinweis).
    // Feedback-Ton & Aussprache laufen seit dem Timing-Fix direkt in der Karte
    // (finish() in QuizCard) — hier würden sie erst nach der Übergangspause feuern.
    // ---- XP + Combo (Blitzfragen geben keine XP — im Original gemessen)
    const xpEligible = res.correct && !res.wasWrong && !res.usedReveal && !res.usedExplain && !res.blitz && !res.timeout;
    if (xpEligible && window.XP) {
      const nc = combo + 1;
      setCombo(nc);
      const levelBefore = window.XP.levelInfo().level;
      const r = window.XP.award(nc, xpFactor);
      window.XP.bumpTopic(topicId, r.xp);
      setRoundXp(x => x + r.xp);
      setRoundCoins(c => c + r.coins);
      // (Ausbau 26.07.2026, Live-Erkundung) Gizmo belohnt die Antwort, die den
      // Serientag sichert, mit einem niedlichen Tier-Float, der +Tag/+XP/+Münzen
      // KOMBINIERT (Küken-Motiv) — deshalb touchDay VOR dem Float auswerten.
      const t = window.XP.touchDay();
      const floatTxt = '+' + r.xp + ' XP' + (r.coins > 0 ? '  +' + r.coins + ' 🪙' : '');
      pushFloat(t.extended ? '🐤 +1 Tag  ' + floatTxt : floatTxt, t.extended);
      if (r.milestone) {
        showPopup({ combo: nc, mult: r.mult, xp: r.xp, coins: r.coins });
        window.Sound && window.Sound.comboMilestone(r.mult);
      }
      if (window.XP.levelInfo().level > levelBefore) window.Sound && window.Sound.levelUp();
      if (t.extended) {
        setStreakInfo(t);
        window.Sound && window.Sound.streakSecured();
      }
    } else if (!res.blitz || res.timeout || !res.correct) {
      setCombo(0);
    }
    // ---- Herzen (Phase 14): 1 Herz pro falsch beantworteter Karte — höchstens eins
    // pro Karte, egal wie viele Fehlversuche darin steckten. Blitzfragen und aktiv
    // angeforderte Hilfen (Aufdecken/Erklären) kosten kein Herz.
    if (window.Hearts && !res.blitz && !res.usedReveal && !res.usedExplain && !res.vague && (!res.correct || res.wasWrong)) {
      window.Hearts.loseHeart();
    }
    // ---- Requeue: Fehler, Aufdecken oder Erklären -> Karte kommt später erneut
    let q2 = queue;
    if (!res.blitz && (!res.correct || res.wasWrong || res.usedReveal || res.usedExplain)) {
      q2 = [...queue, { card: it.card, mode: 'retry', gen: window.QEngine.generate(it.card, topicId) }];
    }
    setLog(l => [...l, { card: it.card, correct: !!res.correct, blitz: res.blitz }]);
    checkMastered();
    advance(q2);
  };

  const onSkip = () => {
    if (!item) return;
    // Überspringen (⏭ wie im Original): keine Wertung, Karte ans Ende
    const q2 = [...queue, { ...item, gen: window.QEngine.generate(item.card, topicId) }];
    advance(q2);
  };

  const onDisableBlitz = () => {
    localStorage.setItem('s34a_blitz_off', '1');
    const q2 = queue.filter((it, i) => i <= idx || it.mode !== 'blitz');
    // aktuelle Blitzkarte auch überspringen
    if (idx + 1 < q2.length) { setQueue(q2); setIdx(idx + 1); setPlaySeq(s => s + 1); }
    else {
      if (window.XP) { const bonusXp = window.XP.endRound(xpFactor); window.XP.bumpTopic(topicId, bonusXp); setRoundXp(x => x + bonusXp); }
      window.Sound && window.Sound.roundEnd();
      setPhase('roundEnd');
    }
  };

  const startNextRound = (opts = {}) => {
    setQueue(buildQueue(data, topicId, opts));
    setIdx(0);
    setPlaySeq(s => s + 1);
    setRound(r => r + 1);
    setRoundXp(0);
    setRoundCoins(0);
    setLog([]);
    setPhase('quiz');
  };

  const nextFromRoundEnd = (opts) => {
    if (streakInfo && streakInfo.extended && !streakShown) {
      setStreakShown(true);
      setPhase('streak');
      return;
    }
    startNextRound(opts || {});
  };

  // Feier-Overlay (nicht blockierend, blendet sich nach ~6,2s selbst aus) —
  // wird sowohl über dem Quiz als auch über dem Rundenende gerendert, damit die
  // Feier nicht verschluckt wird, wenn die letzte Karte die Meisterung auslöst.
  // Vier Ringe + Abzeichen (Neufassung 26.07.2026, siehe index.html).
  const masteredEl = mastered ? (
    <div className="mastered-overlay">
      <div className="mastered-ring"/>
      <div className="mastered-ring r2"/>
      <div className="mastered-ring r3"/>
      <div className="mastered-ring r4"/>
      <div className="mastered-card">
        <span className="mastered-trophy">🏆</span>
        <div className="mastered-title">Stapel gemeistert!</div>
        <div className="mastered-sub">{stackName} — alle Karten sitzen. Stark!</div>
        <div><span className="mastered-badge">100 % gemeistert 🎉</span></div>
      </div>
    </div>
  ) : null;

  if (introOpen && window.QuranIntro) {
    return <window.QuranIntro.Overlay topicId={topicId}
      onStart={() => { window.QuranIntro.markSeen(topicId); setIntroOpen(false); }}
      onClose={() => { window.QuranIntro.markSeen(topicId); setIntroOpen(false); }}/>;
  }
  if (phase === 'roundEnd') {
    return <>
      {masteredEl}
      <RoundEnd go={go} stackName={stackName} topicId={topicId} data={data} log={log}
                     roundXp={roundXp} roundCoins={roundCoins} onNext={nextFromRoundEnd} />
    </>;
  }
  if (phase === 'streak') {
    return <StreakScreen streakDays={streakInfo ? streakInfo.streakDays : 1}
                         freezeUsed={streakInfo ? !!streakInfo.freezeUsed : false}
                         onNext={() => startNextRound({})} />;
  }
  // Keine Herzen mehr (Phase 14): Runde unterbrechen, Optionen anbieten. Erscheint
  // zwischen zwei Karten, nie mitten in einer (heartsState ändert sich in onDone).
  if (heartsState.enabled && !heartsState.superActive && heartsState.hearts <= 0) {
    return (
      <div className="quiz-shell">
        <div className="quiz-stage">
          <div className="stage-inner" style={{textAlign:'center', display:'grid', gap:14, placeItems:'center', paddingTop:40}}>
            <div style={{fontSize:64}}>💔</div>
            <h1 style={{fontSize:26}}>Keine Herzen mehr</h1>
            <div className="muted" style={{maxWidth:380}}>
              Nächstes Herz in ca. {heartsState.nextInMin} Min. — oder füll sie im Shop wieder auf
              (💗 {window.Hearts ? window.Hearts.REFILL_COST : 3} Münzen · 💖 Super-Herzen {window.Hearts ? window.Hearts.SUPER_COST : 10} Münzen für 24h ∞).
            </div>
            <button className="btn btn-primary btn-lg" onClick={() => {
              if (window.Hearts) {
                const r = window.Hearts.buyRefill();
                if (!r.ok) { window.Sound && window.Sound.wrong && window.Sound.wrong(); }
              }
            }}>💗 Auffüllen ({window.Hearts ? window.Hearts.REFILL_COST : 3} 🪙)</button>
            <button className="btn btn-ghost" onClick={() => go('deck')}>Zurück zum Stapel</button>
          </div>
        </div>
      </div>
    );
  }
  if (!item) {
    return <>
      {masteredEl}
      <RoundEnd go={go} stackName={stackName} topicId={topicId} data={data} log={log}
                     roundXp={roundXp} roundCoins={roundCoins} onNext={nextFromRoundEnd} />
    </>;
  }

  const progress = Math.min(100, (idx / queue.length) * 100);
  // Quran-Progress-Skin (05.08.2026): Der Auswendig-Modus der Koran-Stapel
  // bekommt das Vollbild-Erlebnis aus den Vorbild-Videos (hellblauer Verlauf,
  // navy Topbar mit rotem ✕, grüne Fortschrittslinie, navy Lernkarten).
  const qpSkin = /^quran-/.test(String(topicId || ''));

  return (
    <div className={'quiz-shell' + (qpSkin ? ' qp-skin' : '')}>
      {masteredEl}
      <div className="xp-float-layer">
        {floats.map(f => <span key={f.id} className={'xp-float' + (f.big ? ' xp-float-big' : '')}>{f.text}</span>)}
      </div>
      <div className="quiz-progress"><div className="bar" style={{ width: `${progress}%` }} /></div>
      {xpFactor < 1 && (
        <div className={'replay-note' + (xpFactor > 0 ? '' : ' is-none')} title={window.Replay ? window.Replay.note(xpFactor) : ''}>
          {window.Replay ? window.Replay.label(xpFactor) : ''}
        </div>
      )}
      {/* Topbar-Neufassung 06.08.2026 (Handy-Screenshot: "Runde 1" brach um,
          alles gequetscht): EINE Zeile, Titel mit Ellipsis, Runde+Schlüssel
          nur auf breiten Screens (CSS .hide-sm), Rest icon-kompakt. */}
      <div className="quiz-topbar">
        <button className="icon-btn" onClick={() => go('deck')}><Icon.Close /></button>
        <div className="quiz-stack">
          <span className="stack-dot hide-sm" style={{ background: 'var(--stack-blue)' }} />
          <span className="quiz-stack-name">{stackName}</span>
          <span className="muted hide-sm" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>· Runde {round}</span>
        </div>
        <div className="row quiz-toprow" style={{ gap: 8 }}>
          <span className="pill">
            <span className="hide-sm">🔑 {heartsState.enabled ? heartsState.tips : '∞'} &nbsp; </span>
            💗 {heartsState.enabled ? (heartsState.superActive ? '∞' : heartsState.hearts) : '∞'}
          </span>
          {combo >= 3 && <span className="pill combo-pill">🎯 {window.XP ? window.XP.mult(combo) : 1}x</span>}
          <span className={'pill xp-live ' + (roundXp > 0 ? 'has-xp' : '')}>+{roundXp} XP</span>
          {qpSkin && window.QuranIntro && window.QuranIntro.has(topicId) && (
            <button className="icon-btn" title="Regel ansehen" onClick={() => setIntroOpen(true)}>ℹ️</button>
          )}
          <button className="icon-btn" title="Überspringen" onClick={onSkip}><Icon.Arrow /></button>
        </div>
      </div>

      <div className="quiz-stage">
        <CardPlayer key={playSeq} item={item} topicId={topicId} onDone={onDone} onDisableBlitz={onDisableBlitz} xpFactor={xpFactor} />
      </div>

      {popup && (
        <div className="combo-popup">
          <div className="combo-popup-top">
            <div className="combo-targets">🎯🎯🎯</div>
            <div className="combo-title">{popup.combo} in Folge!</div>
            <div className="combo-mult">🎯 {popup.mult}x</div>
          </div>
          <div className="combo-popup-bottom">
            <span className="pill" style={{ background: 'var(--accent-soft)' }}>+ {popup.xp} XP</span>
            {popup.coins > 0 && <span className="pill">+ {popup.coins} 🪙</span>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============== RUNDEN-ENDE (Konfetti, Ring, Karten-Log) ============== */
/* (Ausbau 26.07.2026, Live-Erkundung von app.gizmo.ai) Post-Runden-Engagement:
   Gizmo zeigt nach dem Rundenende einen Mini-Liga-Stand ("Platz X · noch N XP
   bis Platz X−1") und einen Freunde-Serien-Hinweis ("… hat heute noch nicht
   gelernt" + Erinnern) — genau der Moment, in dem man gerade XP geholt hat und
   die Motivation am höchsten ist. Lädt still im Hintergrund; ohne Login,
   ohne Supabase oder ohne Daten rendert die Komponente einfach nichts. */
function PostRoundSocial() {
  const [league, setLeague] = useState(null);
  const [risk, setRisk] = useState([]);
  const [reminded, setReminded] = useState({});
  const myIdRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!window.Auth || !window.Auth.isConfigured()) return;
        const session = await window.Auth.getSession();
        const myId = session && session.user && session.user.id;
        if (!myId || cancelled) return;
        myIdRef.current = myId;
        if (window.League) {
          const m = await window.League.getOrCreateMembership(myId);
          const r = await window.League.loadCohortRanking(m, myId);
          if (!cancelled && m && r && r.length) setLeague({ membership: m, ranking: r, myId });
        }
        if (window.FriendStreaks) {
          const rows = await window.FriendStreaks.build(myId);
          if (!cancelled) {
            setRisk(rows.filter(x => x.atRisk).slice(0, 3));
            const rem = {};
            rows.forEach(x => { if (window.FriendStreaks.remindedToday(x.friendId)) rem[x.friendId] = true; });
            setReminded(rem);
          }
        }
      } catch (e) { /* offline/Demo: Panel bleibt einfach leer */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const remind = (friendId) => {
    const res = window.FriendStreaks.remind(myIdRef.current, friendId);
    if (res.ok || res.reason === 'already') setReminded(m => ({ ...m, [friendId]: true }));
  };

  if (!league && !risk.length) return null;
  const tier = league ? window.League.TIERS[(league.membership && league.membership.tier_index) || 0] : null;
  const myRank = league ? league.ranking.findIndex(r => r.id === league.myId) + 1 : 0;
  const me = league ? league.ranking[myRank - 1] : null;
  const above = (league && myRank > 1) ? league.ranking[myRank - 2] : null;
  const gap = (above && me) ? Math.max(0, above.weekXp - me.weekXp) : 0;

  return (
    <>
      {league && myRank > 0 && (
        <div className="card flat" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 30 }}>{tier.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800 }}>{tier.name}-Liga · Platz {myRank} von {league.ranking.length}</div>
            <div className="muted" style={{ fontSize: 13 }}>
              {above
                ? (gap > 0 ? `Noch ${gap} XP bis Platz ${myRank - 1} (${above.username})` : `Gleichauf mit ${above.username} — eine Runde entscheidet!`)
                : 'Du führst deine Liga an — weiter so! 👑'}
            </div>
          </div>
        </div>
      )}
      {risk.length > 0 && (
        <div className="card flat" style={{ padding: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--danger, #E4566E)', marginBottom: 8 }}>⚠️ Gemeinsame Serie in Gefahr</div>
          <div className="col" style={{ gap: 6 }}>
            {risk.map(r => (
              <div key={r.friendId} className="row" style={{ justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14 }}>
                  <b>{(r.profile && r.profile.username) || '?'}</b>
                  <span className="muted"> hat heute noch nicht gelernt · {r.plant} {r.streak} Tg.</span>
                </span>
                <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 12.5 }}
                        disabled={!!reminded[r.friendId]} onClick={() => remind(r.friendId)}>
                  {reminded[r.friendId] ? '✓ Erinnert' : '🔔 Erinnern'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function RoundEnd({ go, stackName, topicId, data, log, roundXp, roundCoins, onNext }) {
  const [more, setMore] = useState(false);
  const stats = (topicId && window.SRS) ? window.SRS.topicStats(topicId, data) : null;
  // Gewichteter Stapel-Fortschritt (06.08.2026, Nutzerkritik "der große
  // Fortschritt am Ende sollte laden"): vorher zählte der Ring NUR voll
  // gemeisterte Karten (3 fehlerfreie Runden nötig) und stand deshalb nach
  // jeder ersten Runde bei 0 %. Jetzt füllt jede richtige Antwort sichtbar
  // 1/3 der Karte — und der Ring animiert sich beim Aufklappen von 0 hoch.
  const masteredPct = (topicId && window.SRS && window.SRS.progressPct)
    ? window.SRS.progressPct(topicId, data)
    : (stats ? Math.round((stats.gemeistert / Math.max(1, stats.total)) * 100) : 0);
  const [ringShown, setRingShown] = useState(0);      // animierter Ring-Stand
  const [numShown, setNumShown] = useState(0);        // hochzählende Prozentzahl
  useEffect(() => {
    const t0 = setTimeout(() => setRingShown(masteredPct), 180);
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const k = Math.min(1, (now - start) / 1100);
      const eased = 1 - Math.pow(1 - k, 3);
      setNumShown(Math.round(eased * masteredPct));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { clearTimeout(t0); cancelAnimationFrame(raf); };
  }, [masteredPct]);
  const confetti = useRef(Array.from({ length: 36 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.9,
    dur: 2.2 + Math.random() * 1.6,
    color: ['#F6C445', '#7A7BF5', '#F2789F', '#6FCF97', '#56CCF2'][i % 5],
    rot: Math.random() * 360,
  }))).current;
  const rows = [
    { k: 'vergessen', label: 'Vergessen', emoji: '❓' },
    { k: 'neu', label: 'Neu', emoji: '🌱' },
    { k: 'am_lernen', label: 'Am Lernen', emoji: '🎓' },
    { k: 'gemeistert', label: 'Gemeistert', emoji: '🏆' },
  ];
  const R = 52, C = 2 * Math.PI * R;

  return (
    <div className="quiz-shell roundend">
      <div className="confetti-layer">
        {confetti.map((c, i) => (
          <span key={i} className="confetti-piece" style={{
            left: c.left + '%', background: c.color,
            animationDelay: c.delay + 's', animationDuration: c.dur + 's',
            transform: `rotate(${c.rot}deg)`,
          }} />
        ))}
      </div>
      <div className="quiz-topbar">
        <button className="icon-btn" onClick={() => go('deck')}><Icon.Close /></button>
        <div style={{ flex: 1 }} />
      </div>
      <div className="quiz-stage" style={{ overflow: 'auto' }}>
        <div className="stage-inner" style={{ gap: 16, paddingBottom: 110 }}>
          <div className="roundend-title">Runde<br/><span className="roundend-title-accent">abgeschlossen!</span></div>
          <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
            <span className="pill" style={{ background: 'var(--success-soft, #E7F7EE)', color: 'var(--success, #1B8A5A)', fontWeight: 800 }}>+{roundXp} XP</span>
            <span className="pill">+{roundCoins} 🪙</span>
          </div>
          {window.Replay && window.Replay.factor(topicId, data) < 1 && (
            <div className="muted" style={{ textAlign: 'center', fontSize: 13, maxWidth: 420, lineHeight: 1.55 }}>
              {window.Replay.note(window.Replay.factor(topicId, data))}
            </div>
          )}

          <div className="card flat" style={{ padding: 20, textAlign: 'center' }}>
            <div style={{ fontWeight: 800, marginBottom: 12 }}>{stackName}</div>
            <svg width="130" height="130" viewBox="0 0 130 130" style={{ margin: '0 auto', display: 'block' }}>
              <circle cx="65" cy="65" r={R} fill="none" stroke="var(--line)" strokeWidth="10" />
              <circle cx="65" cy="65" r={R} fill="none" stroke="var(--success, #1B8A5A)" strokeWidth="10"
                      strokeLinecap="round" strokeDasharray={C}
                      strokeDashoffset={C * (1 - ringShown / 100)}
                      style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.25,.9,.3,1)' }}
                      transform="rotate(-90 65 65)" />
              <text x="65" y="72" textAnchor="middle" style={{ fontSize: 24, fontWeight: 800, fill: 'var(--success, #1B8A5A)' }}>{numShown}%</text>
            </svg>
            <div style={{ fontWeight: 800, marginTop: 10 }}>{masteredPct}% Stapel-Fortschritt</div>
            {stats && (
              <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                {stats.gemeistert} von {stats.total} Karten gemeistert 🏆 — jede richtige Runde füllt den Ring weiter!
              </div>
            )}
            <button className="btn btn-ghost" style={{ margin: '10px auto 0', padding: '8px 18px' }} onClick={() => setMore(m => !m)}>
              Mehr anzeigen {more ? '▴' : '▾'}
            </button>
            {more && stats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, textAlign: 'center', marginTop: 14 }}>
                {rows.map(r => (
                  <div key={r.k}>
                    <div style={{ fontSize: 22 }}>{r.emoji}</div>
                    <div style={{ fontWeight: 800, fontSize: 20 }}>{stats[r.k]}</div>
                    <div className="muted" style={{ fontSize: 12.5 }}>{r.label}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="col" style={{ gap: 10, marginTop: 16 }}>
              <button className="btn btn-ghost btn-full" onClick={() => onNext({ hard: true })}>😈 Probier eine schwere Runde</button>
              <button className="btn btn-ghost btn-full" onClick={() => onNext({ speed: true })}>⚡ Versuch einen Speed-run</button>
            </div>
          </div>

          {/* Post-Runden-Engagement (26.07.2026): Mini-Liga-Stand + Serien-Hinweis */}
          <PostRoundSocial />

          {log.length > 0 && (
            <>
              <div style={{ fontWeight: 800 }}>Beantwortete Karten</div>
              {log.map((entry, i) => <AnsweredCard key={i} entry={entry} topicId={topicId} />)}
            </>
          )}
        </div>
      </div>
      <div className="roundend-foot">
        <button className="btn btn-ghost btn-full" onClick={() => {
          if (navigator.share) navigator.share({ title: 'LERN — ' + stackName, text: `Ich habe gerade +${roundXp} XP in "${stackName}" geholt!` }).catch(() => {});
        }}>📤 Quiz teilen</button>
        <button className="btn btn-primary btn-full btn-lg" onClick={() => onNext()}>Nächste Runde</button>
      </div>
    </div>
  );
}

function AnsweredCard({ entry, topicId }) {
  const { card, correct } = entry;
  // 03.08.2026: auch im Runden-Log der volle Tutor (mit Rückfragen) statt der
  // alten Zwei-Satz-Sprechblase. Zugeklappt, damit nicht für jede Karte des
  // Logs ungefragt ein Modellaufruf startet.
  const answer = (card.a && card.a.trim())
    ? card.a
    : (card.options || []).filter(o => o.c).map(o => o.t).join(' · ');
  return (
    <div className="card flat" style={{ padding: 16 }}>
      <div style={{ fontWeight: 800, display: 'flex', gap: 8, alignItems: 'baseline' }}>
        <span>{correct ? '✅' : '❌'}</span><span>{card.q}</span>
      </div>
      <div className="muted" style={{ marginTop: 6, lineHeight: 1.45, whiteSpace: 'pre-wrap', borderTop: '1px dashed var(--line)', paddingTop: 8 }}>{answer}</div>
      <div style={{ marginTop: 10 }}>
        <TutorCollapse card={card} topicId={topicId} answerTxt={answer} label="Erklären" />
      </div>
    </div>
  );
}

/* ============== SERIEN-SCREEN (Tages-Streak nach der Runde) ============== */
function StreakScreen({ streakDays, freezeUsed, onNext }) {
  const days = window.XP ? window.XP.recentDays(7) : [];
  // Woche so ausrichten, dass heute in der Mitte liegt (wie im Original: So..Sa-Reihe)
  return (
    <div className="quiz-shell streak-screen">
      <div className="quiz-stage" style={{ display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center', display: 'grid', gap: 18, justifyItems: 'center' }}>
          <div className="streak-title">{streakDays}-Tage-Serie!</div>
          {freezeUsed && (
            <div className="pill" style={{ background: 'var(--sky-10, #eef6ff)' }}>
              🧊 Ein Serien-Freeze hat einen verpassten Tag gerettet
            </div>
          )}
          <Axolotl size={150} />
          <div className="streak-week">
            {days.map((d) => (
              <div key={d.key} className="streak-day">
                <div className="muted" style={{ fontSize: 13, fontWeight: 700 }}>{d.weekday}</div>
                <div className={'streak-day-cell' + (d.isToday ? ' is-today' : d.xp > 0 ? ' is-done' : '')}>
                  {d.isToday ? '' : d.dayNum}
                </div>
                {d.isToday && <div className="streak-dot" />}
              </div>
            ))}
          </div>
          <button className="btn btn-ghost" style={{ padding: '12px 28px' }} onClick={() => {
            if (navigator.share) navigator.share({ title: 'LERN', text: `${streakDays}-Tage-Serie am Laufen! 🔥` }).catch(() => {});
          }}>📤 Serie teilen</button>
        </div>
      </div>
      <div className="roundend-foot" style={{ gridTemplateColumns: '1fr' }}>
        <button className="btn btn-primary btn-full btn-lg" onClick={onNext}>Weiter</button>
      </div>
    </div>
  );
}

/* Kompatibilität: alte Zusammenfassung wird nicht mehr genutzt, bleibt aber
   als schlanker Alias erhalten, falls extern referenziert. */
function QuizSummary(props) { return <RoundEnd {...props} log={[]} roundXp={0} roundCoins={0} onNext={() => props.go('deck')} />; }

window.QuizScreen = QuizScreen;
window.QuizSummary = QuizSummary;

/* ============== ÜBUNGSTEST ==============
   Wie die Original-Kachel ("Übungstest — Beantworte X Fragen zum
   Freischalten"): erst nach genügend beantworteten Fragen freigeschaltet.
   Im Test: nur MC/Lückentext, EIN Versuch pro Frage, keine Helfer, kein
   Requeue, keine XP — am Ende Ergebnis mit Bestehensgrenze 50 %
   (angelehnt an die schriftliche §34a-Prüfung) und Fragen-Review.

   Freischalt-Schwelle: live bei Gizmo (16.07.2026) zeigte ein 45-Karten-Stapel
   (WaffG) "Beantworte 182 Fragen zum Freischalten" — das ist ~4x die Kartenzahl
   und übersteigt die Kartenzahl selbst, kann also kein simples "jede Karte
   einmal beantwortet, Deckel bei Stapelgröße" sein (das war unsere alte Annahme:
   fix 20, gedeckelt auf Stapelgröße). Neue Annahme: ca. das 4-fache der Karten-
   zahl, ungedeckelt, gezählt über SRS.bumpAnswered() (kumulativ, auch Wieder-
   holungen). NICHT abschließend verifiziert — nur an einem einzigen Stapel
   beobachtet. Vor einer endgültigen Festlegung an 2-3 weiteren, unterschiedlich
   großen Stapeln nachmessen. */
const TEST_UNLOCK_RATIO = 4; // ≈ 182 / 45 Karten, beobachtet an "WaffG"
const TEST_UNLOCK_MIN = 20;  // Untergrenze für sehr kleine Stapel

function buildTestSet(cards, topicId, count) {
  const sh = window.QEngine.shuffle;
  const out = [];
  for (const c of sh(cards)) {
    if (out.length >= count) break;
    const gen = window.QEngine.generate(c, topicId);
    if (gen.kind === 'mc' || gen.kind === 'cloze') out.push({ card: c, gen });
  }
  return out;
}

function TestCard({ entry, onAnswer }) {
  const { gen } = entry;
  const isMulti = gen.kind === 'mc' && gen.multi;
  const correctIdxs = gen.options.map((o, i) => o.c ? i : -1).filter(i => i >= 0);
  const [selected, setSelected] = useState([]);
  const [revealed, setRevealed] = useState(false);
  const doneRef = useRef(false);

  const resolve = (sel) => {
    if (doneRef.current) return;
    doneRef.current = true;
    setRevealed(true);
    const cset = new Set(correctIdxs);
    const right = sel.length === cset.size && sel.every(x => cset.has(x));
    setTimeout(() => onAnswer({ correct: right, picked: sel.map(i => gen.options[i].t) }), isMulti ? 1300 : 1000);
  };

  const pick = (i) => {
    if (revealed) return;
    if (isMulti) { setSelected(s => s.includes(i) ? s.filter(x => x !== i) : [...s, i]); return; }
    setSelected([i]);
    resolve([i]); // Übungstest: genau EIN Versuch, keine zweite Chance
  };

  return (
    <div className="stage-inner">
      <div className="question-card">
        <span className="qtag">🎯 Übungstest</span>
        <div className={'qtext' + (window.QuranCourse && window.QuranCourse.isArabicHeavy(gen.q) ? ' qtext-arabic' : '')}>{gen.q}</div>
        {gen.kind === 'cloze' && (
          <div className="cloze-line">
            {revealed
              ? gen.a.split(gen.term).flatMap((part, i, arr) => i < arr.length - 1 ? [part, <span key={i} className="cloze-filled">{gen.term}</span>] : [part])
              : gen.masked.split('▁▁▁▁').flatMap((part, i, arr) => i < arr.length - 1 ? [part, <span key={i} className="cloze-blank">&nbsp;&nbsp;&nbsp;&nbsp;</span>] : [part])}
          </div>
        )}
        {isMulti && !revealed && <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>Wähle alle richtigen Antworten · {selected.length} ausgewählt</div>}
      </div>
      <div className="options">
        {gen.options.map((o, i) => {
          const isSel = selected.includes(i);
          let cls = 'option';
          if (revealed) {
            if (o.c) cls += ' is-correct';
            else if (isSel) cls += ' is-wrong';
            else cls += ' is-disabled';
          } else if (isSel) cls += ' is-correct';
          return <button key={i} className={cls} onClick={() => pick(i)}>{o.t}</button>;
        })}
      </div>
      {isMulti && !revealed && (
        <button className="btn btn-primary btn-full btn-lg" disabled={!selected.length} onClick={() => resolve(selected)} style={{ opacity: selected.length ? 1 : 0.4 }}>
          Prüfen
        </button>
      )}
    </div>
  );
}

function TestScreen({ go, stackName, questions, topicId, count, userId }) {
  const raw = (questions && questions.length) ? questions : [];
  const data = raw.filter(q => (q.options && q.options.length > 0) || (q.a && q.a.trim()));
  // Kumulativer Zähler (jede beantwortete Frage, auch Wiederholungen) statt der alten,
  // auf eindeutige Karten gedeckelten SRS-Stats — siehe Kommentar bei TEST_UNLOCK_RATIO.
  const answered = (window.SRS && topicId) ? window.SRS.getAnswered(topicId) : 0;
  const need = Math.max(TEST_UNLOCK_MIN, Math.round(data.length * TEST_UNLOCK_RATIO));
  const locked = answered < need;

  const [set, setSet] = useState(() => locked ? [] : buildTestSet(data, topicId, count || 20));
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState([]);
  const [seq, setSeq] = useState(0);
  // Verhindert, dass das Testergebnis mehrfach in Supabase landet (Ergebnis-Screen
  // rendert bei jedem Re-Render neu, ein useEffect unten mit dieser Ref läuft aber
  // nur EINMAL pro abgeschlossenem Testversuch — siehe unten, Blueprint Phase 7).
  const loggedRef = useRef(false);

  const restart = () => { setSet(buildTestSet(data, topicId, count || 20)); setIdx(0); setResults([]); setSeq(s => s + 1); loggedRef.current = false; };

  // Testergebnis einmal persistieren, sobald der Ergebnis-Screen erreicht ist (Blueprint
  // Phase 7 — der Aktivitäts-Feed braucht "Test bestanden"-Ereignisse, siehe
  // app/follows.js/supabase/schema.sql Abschnitt 13). Hook muss unconditional oben
  // stehen (nicht im Ergebnis-Render-Zweig unten), prüft die Bedingung selbst.
  useEffect(() => {
    if (idx >= set.length && set.length > 0 && !loggedRef.current) {
      loggedRef.current = true;
      const right = results.filter(r => r.correct).length;
      const passedNow = Math.round((right / set.length) * 100) >= 50;
      if (userId && window.Follows) {
        window.Follows.recordTestResult(userId, {
          topicId, topicTitle: stackName, score: right, total: set.length, passed: passedNow,
        });
      }
    }
  }, [idx, set.length]);

  /* ---- Gesperrt (wie die Original-Kachel mit Schloss) ---- */
  if (locked) {
    return (
      <div className="quiz-shell">
        <div className="quiz-topbar">
          <button className="icon-btn" onClick={() => go('deck')}><Icon.Close /></button>
          <div className="quiz-stack"><span className="stack-dot" style={{ background: 'var(--stack-blue)' }} />{stackName}</div>
          <div style={{ width: 30 }} />
        </div>
        <div className="quiz-stage" style={{ display: 'grid', placeItems: 'center' }}>
          <div className="card flat" style={{ maxWidth: 440, padding: '34px 28px', textAlign: 'center', display: 'grid', gap: 12, justifyItems: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--surface-2, #F2F2F8)', display: 'grid', placeItems: 'center', fontSize: 30 }}>🔒</div>
            <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 900, fontSize: 24 }}>Übungstest</div>
            <div className="muted">Beantworte noch <b style={{ color: 'var(--ink)' }}>{need - answered}</b> {need - answered === 1 ? 'Frage' : 'Fragen'} im Auswendig-Modus, um den Test freizuschalten.</div>
            <div style={{ width: '100%', height: 10, borderRadius: 999, background: 'var(--line)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.round((answered / need) * 100)}%`, height: '100%', background: 'var(--accent)', borderRadius: 999 }} />
            </div>
            <div className="muted" style={{ fontSize: 13 }}>{answered} / {need} beantwortet</div>
            <button className="btn btn-primary btn-full btn-lg" onClick={() => go('quizLoading')}>🐘 Zum Auswendig-Modus</button>
          </div>
        </div>
      </div>
    );
  }

  /* ---- Ergebnis ---- */
  if (idx >= set.length && set.length > 0) {
    const right = results.filter(r => r.correct).length;
    const pct = Math.round((right / set.length) * 100);
    const passed = pct >= 50;
    const R = 52, C = 2 * Math.PI * R;
    return (
      <div className="quiz-shell">
        <div className="quiz-topbar">
          <button className="icon-btn" onClick={() => go('deck')}><Icon.Close /></button>
          <div style={{ flex: 1 }} />
        </div>
        <div className="quiz-stage" style={{ overflow: 'auto' }}>
          <div className="stage-inner" style={{ gap: 16, paddingBottom: 110 }}>
            <div className="roundend-title">{passed ? 'Bestanden! 🎉' : 'Noch nicht bestanden'}</div>
            <div className="card flat" style={{ padding: 20, textAlign: 'center' }}>
              <svg width="130" height="130" viewBox="0 0 130 130" style={{ margin: '0 auto', display: 'block' }}>
                <circle cx="65" cy="65" r={R} fill="none" stroke="var(--line)" strokeWidth="10" />
                <circle cx="65" cy="65" r={R} fill="none" stroke={passed ? 'var(--success, #1B8A5A)' : '#E4566E'} strokeWidth="10"
                        strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} transform="rotate(-90 65 65)" />
                <text x="65" y="72" textAnchor="middle" style={{ fontSize: 24, fontWeight: 800, fill: passed ? 'var(--success, #1B8A5A)' : '#E4566E' }}>{pct}%</text>
              </svg>
              <div style={{ fontWeight: 800, marginTop: 10 }}>{right} von {set.length} richtig</div>
              <div className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>Bestehensgrenze wie in der schriftlichen §34a-Prüfung: 50 %</div>
            </div>
            <div style={{ fontWeight: 800 }}>Deine Antworten</div>
            {set.map((entry, i) => {
              const r = results[i] || {};
              const corr = entry.gen.options.filter(o => o.c).map(o => o.t).join(' · ');
              return (
                <div key={i} className="card flat" style={{ padding: 14 }}>
                  <div style={{ fontWeight: 800, display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <span>{r.correct ? '✅' : '❌'}</span><span>{entry.gen.q}</span>
                  </div>
                  <div className="muted" style={{ marginTop: 6, fontSize: 14 }}>Richtig: <b style={{ color: 'var(--success, #1B8A5A)' }}>{corr}</b></div>
                  {!r.correct && r.picked && r.picked.length > 0 && (
                    <div className="muted" style={{ fontSize: 14 }}>Deine Wahl: <span style={{ color: '#C0392B' }}>{r.picked.join(' · ')}</span></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="roundend-foot">
          <button className="btn btn-ghost btn-full" onClick={restart}>🔁 Nochmal</button>
          <button className="btn btn-primary btn-full btn-lg" onClick={() => go('deck')}>Fertig</button>
        </div>
      </div>
    );
  }

  if (!set.length) {
    return (
      <div className="quiz-shell">
        <div className="quiz-stage" style={{ display: 'grid', placeItems: 'center' }}>
          <div className="card flat" style={{ padding: 24, textAlign: 'center' }}>
            <div style={{ fontWeight: 800 }}>Keine testbaren Fragen gefunden.</div>
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => go('deck')}>Zurück</button>
          </div>
        </div>
      </div>
    );
  }

  const entry = set[idx];
  const onAnswer = (res) => {
    if (window.SRS) window.SRS.recordAnswer(topicId, entry.card, res.correct, res.correct);
    setResults(r => [...r, res]);
    setIdx(i => i + 1);
    setSeq(s => s + 1);
  };

  return (
    <div className="quiz-shell">
      <div className="quiz-progress"><div className="bar" style={{ width: `${(idx / set.length) * 100}%` }} /></div>
      <div className="quiz-topbar">
        <button className="icon-btn" onClick={() => go('deck')}><Icon.Close /></button>
        <div className="quiz-stack">
          <span className="stack-dot" style={{ background: 'var(--stack-blue)' }} />
          {stackName} <span className="muted" style={{ fontWeight: 600 }}>· Übungstest {idx + 1}/{set.length}</span>
        </div>
        <span className="pill">🎯 {results.filter(r => r.correct).length} richtig</span>
      </div>
      <div className="quiz-stage">
        <TestCard key={seq} entry={entry} onAnswer={onAnswer} />
      </div>
    </div>
  );
}

window.TestScreen = TestScreen;

/* ============== MODALS ============== */
function Modals({ ctx }) {
  const { modal, closeModal } = ctx;
  const stop = e => e.stopPropagation();
  if (!modal) return null;
  return (
    <div className="scrim" onClick={closeModal}>
      <div className="modal" onClick={stop}>
        {modal.kind === 'modes' && <ModesModal ctx={ctx}/>}
        {modal.kind === 'modeSetup' && <ModeSetupModal ctx={ctx}/>}
        {modal.kind === 'add' && <AddModal ctx={ctx}/>}
        {modal.kind === 'newStack' && <NewStackModal ctx={ctx}/>}
        {modal.kind === 'stackContext' && <StackContextModal ctx={ctx}/>}
        {modal.kind === 'addCard' && <AddCardModal ctx={ctx}/>}
        {modal.kind === 'history' && <HistoryModal ctx={ctx}/>}
        {modal.kind === 'notifs' && <NotifsModal ctx={ctx}/>}
        {modal.kind === 'live' && <LiveModal ctx={ctx}/>}
        {modal.kind === 'share' && <ShareModal ctx={ctx}/>}
        {modal.kind === 'editProfile' && <EditProfileModal ctx={ctx}/>}
        {modal.kind === 'auth' && <AuthModal ctx={ctx}/>}
        {modal.kind === 'servercheck' && window.ServerCheckPanel && <window.ServerCheckPanel ctx={ctx} onBack={closeModal}/>}
        {modal.kind === 'friends' && <FriendsModal ctx={ctx}/>}
        {modal.kind === 'groups' && window.Groups && <window.Groups.GroupsModal ctx={ctx}/>}
        {modal.kind === 'groupQuiz' && window.Groups && <window.Groups.GroupQuizModal ctx={ctx}/>}
        {modal.kind === 'invite' && <InviteModal ctx={ctx}/>}
        {modal.kind === 'publishDeck' && <PublishDeckModal ctx={ctx}/>}
        {modal.kind === 'shareStack' && <ShareStackModal ctx={ctx}/>}
        {modal.kind === 'joinShared' && <JoinSharedModal ctx={ctx}/>}
        {modal.kind === 'accountInfo' && <AccountInfoModal ctx={ctx}/>}
        {modal.kind === 'security' && <SecurityModal ctx={ctx}/>}
        {modal.kind === 'deleteAccount' && <DeleteAccountModal ctx={ctx}/>}
      </div>
    </div>
  );
}

function ModalHead({ title, onClose }) {
  return (
    <div className="modal-head">
      <div style={{width:34}}/>
      <div className="ttl">{title}</div>
      <button className="close-btn" onClick={onClose}><Icon.Close/></button>
    </div>
  );
}

function ModesModal({ ctx }) {
  const [sel, setSel] = useState('auswendig');
  const [scope, setScope] = useState('faellig');
  const [testCount, setTestCount] = useState(20);

  // Echte Freischalt-Zahlen fürs Übungstest statt der alten fest verdrahteten "20"
  // (siehe TEST_UNLOCK_RATIO/TEST_UNLOCK_MIN weiter oben in dieser Datei).
  // (Review 21.07.2026) Vorher nur in window.S34A_TOPICS gesucht — für eigene/
  // geteilte Stapel ergab das 0 Fragen und damit eine falsche Freischalt-Anzeige
  // ("Freigeschaltet" im Modal, Schloss im Test). ctx.topics enthält alle Stapel.
  const modalEntry = (ctx.topics || []).find(t => t.id === ctx.activeStack);
  const modalTopic = modalEntry ? modalEntry.topic : null;
  const modalQuizTotal = modalTopic ? modalTopic.blocks.reduce((n, b) => n + (b.quiz ? b.quiz.length : 0), 0) : 0;
  const testNeed = Math.max(TEST_UNLOCK_MIN, Math.round(modalQuizTotal * TEST_UNLOCK_RATIO));
  const testAnswered = (window.SRS && ctx.activeStack) ? window.SRS.getAnswered(ctx.activeStack) : 0;
  const testLocked = testAnswered < testNeed;
  // Herzen-Gate (Phase 14): Auswendig-Quiz kostet Herzen — ohne Herzen kein Start.
  // KI-Tutor/Live/Test bleiben frei (kosten keine Herzen, siehe app/hearts.js).
  const noHearts = !!(window.Hearts && !window.Hearts.canPlay());
  // (05.08.2026, Nutzerwunsch) Nur noch ZWEI Wege in den Stapel: "Auswendig"
  // (das Quran-Progress-Lernerlebnis) und "Live spielen". KI-Tutor und
  // Übungstest sind aus dem Menü raus — der Tutor bleibt als "Erklären"-Helfer
  // in Nicht-Koran-Karten erreichbar, der Test-Screen existiert nur noch im Code.
  const start = () => {
    if (sel === 'live') { ctx.closeModal(); ctx.go('live'); return; }
    if (noHearts) { ctx.closeModal(); ctx.go('shop'); return; }
    ctx.closeModal();
    ctx.go('quizLoading', { roundSize: scope === 'alle' ? Math.min(20, Math.max(7, modalQuizTotal)) : undefined });
  };
  return (
    <>
      <ModalHead title="Wie willst du lernen?" onClose={ctx.closeModal}/>
      <div className="modal-body">
        <div className="mode-grid" style={{gridTemplateColumns:'1fr 1fr'}}>
          <button className={"mode-card " + (sel==='auswendig'?'is-selected':'')} onClick={() => setSel('auswendig')}>
            <Mammoth size={86}/>
            <div className="mode-ttl">Auswendig</div>
            <div className="mode-sub">Lernen wie im Kurs</div>
          </button>
          <button className={"mode-card " + (sel==='live'?'is-selected':'')} onClick={() => setSel('live')}>
            <Joystick size={86}/>
            <div className="mode-ttl">Live spielen</div>
            <div className="mode-sub">Duell mit Familie &amp; Freunden</div>
          </button>
        </div>
        {sel === 'auswendig' && (
          <div style={{marginTop:22, display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
            <button className={"mode-card " + (scope==='faellig'?'is-selected':'')} onClick={() => setScope('faellig')} style={{padding:18}}>
              <div style={{fontSize:30}}>🎯</div>
              <div className="mode-ttl">Normale Runde</div>
              <div className="mode-sub">7 Karten · Fällige zuerst</div>
            </button>
            <button className={"mode-card " + (scope==='alle'?'is-selected':'')} onClick={() => setScope('alle')} style={{padding:18}}>
              <div style={{fontSize:30}}>📚</div>
              <div className="mode-ttl">Große Runde</div>
              <div className="mode-sub">{Math.min(20, Math.max(7, modalQuizTotal))} Karten am Stück</div>
            </button>
          </div>
        )}
      </div>
      <div className="modal-foot">
        {sel === 'auswendig' && noHearts && (
          <div className="muted" style={{textAlign:'center', fontSize:13, marginBottom:8}}>
            💔 Keine Herzen mehr — warte auf die Regeneration oder füll sie im Shop auf.
          </div>
        )}
        <button className="btn btn-primary btn-full btn-lg" onClick={start}>
          {sel === 'live' ? 'Live-Lobby öffnen' : noHearts ? 'Zum Shop 💗' : 'Lernen starten'}
        </button>
      </div>
    </>
  );
}

function ModeSetupModal({ ctx }) { return <ModesModal ctx={ctx}/>; }

/* (Ausbau 21.07.2026) Die Quellen-Kacheln waren hier tote Deko ("Bald verfügbar"),
   obwohl der Import längst existiert — er lebt im Magic-Import eines (leeren)
   eigenen Stapels. Jetzt führen alle Kacheln in genau diesen Flow: Klick legt
   zuerst einen neuen Stapel an (dort öffnet sich der Quellen-Import automatisch).
   Die manuellen Einträge öffnen das echte Karten-Modal. */
function AddModal({ ctx }) {
  const toNewStack = () => { ctx.closeModal(); ctx.openModal('newStack'); };
  return (
    <>
      <ModalHead title="Hinzufügen" onClose={ctx.closeModal}/>
      <div className="modal-body">
        <div style={{fontWeight:800, marginBottom:8}}>Aus Quelle</div>
        <div className="import-grid">
          <ImportTile kind="pdf" label="PDF" onClick={toNewStack}/>
          <ImportTile kind="notes" label="Notizen" onClick={toNewStack}/>
          <ImportTile kind="ppt" label="PowerPoint" onClick={toNewStack}/>
          <ImportTile kind="youtube" label="YouTube" onClick={toNewStack}/>
          <ImportTile kind="photo" label="Foto · OCR" onClick={toNewStack}/>
        </div>
        <div className="muted" style={{fontSize:12.5, marginTop:8}}>
          Quellen landen in einem eigenen Stapel: Kachel wählen → neuen Stapel anlegen →
          der Quellen-Import öffnet sich dort automatisch.
        </div>
        <div style={{fontWeight:800, marginTop:18, marginBottom:8}}>Manuell</div>
        <div className="col">
          <button className="card flat" style={{display:'flex', gap:14, alignItems:'center', padding:14}}
                  onClick={() => { ctx.closeModal(); ctx.openModal('addCard'); }}>
            <div style={{fontSize:30}}>🃏</div>
            <div style={{flex:1, textAlign:'left'}}><div style={{fontWeight:800}}>Karten</div><div className="muted">Frage / Antwort manuell (auch Multiple Choice)</div></div>
            <Icon.Caret style={{color:'var(--ink-mute)'}}/>
          </button>
          <button className="card flat" style={{display:'flex', gap:14, alignItems:'center', padding:14}} onClick={toNewStack}>
            <div style={{fontSize:30}}>📝</div>
            <div style={{flex:1, textAlign:'left'}}><div style={{fontWeight:800}}>Notizen</div><div className="muted">Freier Text mit KI-Karten (im neuen Stapel)</div></div>
            <Icon.Caret style={{color:'var(--ink-mute)'}}/>
          </button>
        </div>
      </div>
    </>
  );
}

const PALETTE = ['var(--stack-lavender)','var(--stack-blue)','var(--stack-mint)','var(--stack-green)','var(--stack-yellow)','var(--stack-orange)','var(--stack-rose)','var(--stack-pink)','var(--stack-coal)'];

function NewStackModal({ ctx }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(0);
  const [busy, setBusy] = useState(false);

  // Erstellt einen echten, leeren eigenen Stapel (app/customtopics.js, Blueprint
  // Phase 3) — vorher war "Erstellen" hier reine Deko und hat nichts gespeichert.
  // Übergeordneter Stapel wird bewusst (noch) nicht ausgewertet: eigene Stapel landen
  // aktuell immer als eigenständiger Haupteintrag (siehe rebuildTopicIndex in main.js).
  const create = () => {
    if (busy || !name.trim() || !window.CustomTopics) return;
    setBusy(true);
    const t = window.CustomTopics.createEmpty(name, color === -1 ? PALETTE[0] : PALETTE[color]);
    setBusy(false);
    ctx.closeModal();
    ctx.setActiveStack(t.id);
    ctx.go('deck');
  };

  return (
    <>
      <ModalHead title="Neuer Stapel" onClose={ctx.closeModal}/>
      <div className="modal-body">
        <div style={{fontWeight:800, marginBottom:6}}>Name</div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="z. B. Biologie · Genetik"
               onKeyDown={e => e.key === 'Enter' && create()}
               style={{width:'100%', padding:14, fontSize:16, borderRadius:14, border:'1px solid var(--line)', background:'var(--surface)', outline:'none'}}/>
        <div style={{fontWeight:800, marginTop:18, marginBottom:8}}>Farbe</div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(9, 1fr)', gap:10}}>
          {PALETTE.map((c, i) => (
            <button key={i} onClick={() => setColor(i)}
                    style={{aspectRatio:'1/1', borderRadius:12, background:c, border: i===color ? '3px solid var(--ink)':'2px solid transparent', boxShadow:'inset 0 -3px 0 rgba(0,0,0,0.08)'}}/>
          ))}
          <button onClick={() => setColor(-1)} style={{aspectRatio:'1/1', borderRadius:12, border: color===-1?'3px solid var(--ink)':'1.5px dashed var(--line-2)', display:'grid', placeItems:'center'}}>
            <Icon.Plus/>
          </button>
        </div>
        <div style={{fontWeight:800, marginTop:18, marginBottom:8}}>Übergeordneter Stapel (optional)</div>
        <select style={{width:'100%', padding:14, fontSize:15, borderRadius:14, border:'1px solid var(--line)', background:'var(--surface)'}}>
          <option>Kein – als Hauptstapel</option>
          <option>§34a – Sachkunde</option>
          <option>Mündliche Prüfungsfragen</option>
        </select>
      </div>
      <div className="modal-foot">
        <button className="btn btn-ghost btn-full" onClick={ctx.closeModal}>Abbrechen</button>
        <button className="btn btn-primary btn-full" disabled={busy || !name.trim()} onClick={create}>Erstellen</button>
      </div>
    </>
  );
}

/* Stapel-Kontextmenü — seit 20.07.2026 (Phase 16) echte Aktionen statt Deko:
   Umbenennen/Duplizieren/Veröffentlichen/Gemeinsam bearbeiten/Archivieren/Löschen
   je nach Stapel-Typ (kuratierte §34a-Themen sind nur duplizierbar — sie gehören
   der App, nicht dem Nutzer). "Verschieben" ist ersatzlos entfallen: es gibt
   keine Ordner-Hierarchie, in die man verschieben könnte (dokumentiert). */
/* Zeilen-Baustein des Stapel-Kontextmenüs — auf Modulebene statt inline definiert,
   damit React die Zeilen bei State-Wechseln (z.B. Lösch-Bestätigung) nicht
   unnötig neu mountet (Ausbau 21.07.2026). */
function StackCtxRow({ emoji, label, sub, onClick, danger }) {
  return (
    <button className="setting-row" style={{width:'100%', textAlign:'left'}} onClick={onClick}>
      <span style={{fontSize:22}}>{emoji}</span>
      <span className="lbl" style={danger ? {color:'var(--rose)'} : undefined}>{label}{sub && <span className="muted" style={{display:'block', fontSize:12, fontWeight:500}}>{sub}</span>}</span>
    </button>
  );
}

function StackContextModal({ ctx }) {
  const id = ctx.modal && ctx.modal.id;
  const topic = (window.S34A_TOPICS || []).find(t => t.id === id) || null;
  const customTopic = (window.CustomTopics ? window.CustomTopics.list() : []).find(t => t.id === id) || null;
  const sharedTopic = (window.SharedStacks ? window.SharedStacks.list() : []).find(t => t.id === id) || null;
  const target = customTopic || sharedTopic || topic;
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(target ? target.name : '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!target) {
    return (
      <div style={{padding:16, maxWidth:340}}>
        <div className="muted">Für diesen Eintrag gibt es keine Aktionen.</div>
      </div>
    );
  }

  const doRename = () => {
    if (newName.trim() && window.CustomTopics) window.CustomTopics.rename(id, newName);
    ctx.closeModal();
  };
  const doDuplicate = () => {
    if (customTopic && window.CustomTopics) window.CustomTopics.duplicate(id);
    else if (window.CustomTopics) window.CustomTopics.importFrom(target.name + ' (Kopie)', target.color, target.blocks);
    ctx.closeModal();
  };
  const doArchive = () => {
    if (window.CustomTopics) window.CustomTopics.setArchived(id, !customTopic.archived);
    ctx.closeModal();
  };
  const doLeaveShared = async () => {
    if (window.SharedStacks) await window.SharedStacks.leave(id);
    ctx.closeModal();
  };
  const doDelete = () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    if (window.CustomTopics) window.CustomTopics.remove(id);
    ctx.closeModal();
  };

  if (renaming) {
    return (
      <div style={{padding:16, maxWidth:340}}>
        <div style={{fontWeight:800, marginBottom:8}}>Umbenennen</div>
        <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && doRename()}
               style={{width:'100%', padding:12, borderRadius:12, border:'1px solid var(--line)', background:'var(--surface)'}} autoFocus/>
        <div className="row" style={{gap:8, marginTop:10}}>
          <button className="btn btn-ghost btn-full" onClick={() => setRenaming(false)}>Abbrechen</button>
          <button className="btn btn-primary btn-full" onClick={doRename}>Speichern</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{padding:8, maxWidth:360}}>
      <div style={{fontWeight:800, padding:'8px 14px 4px'}}>{target.name}</div>
      {customTopic && <StackCtxRow emoji="✏️" label="Umbenennen" onClick={() => setRenaming(true)}/>}
      <StackCtxRow emoji="📑" label="Duplizieren" sub={customTopic ? undefined : 'Als eigene, bearbeitbare Kopie'} onClick={doDuplicate}/>
      {customTopic && <StackCtxRow emoji="🌍" label="Veröffentlichen" sub="In die öffentliche Bibliothek" onClick={() => { ctx.closeModal(); ctx.openModal('publishDeck', { id }); }}/>}
      {customTopic && <StackCtxRow emoji="👥" label="Gemeinsam bearbeiten" sub="Geteilte Kopie mit Beitrittscode" onClick={() => { ctx.closeModal(); ctx.openModal('shareStack', { id }); }}/>}
      {customTopic && <StackCtxRow emoji="📦" label={customTopic.archived ? 'Dearchivieren' : 'Archivieren'} onClick={doArchive}/>}
      {sharedTopic && <StackCtxRow emoji="🚪" label="Stapel verlassen" sub="Du verlierst den Zugriff, andere behalten ihn" onClick={doLeaveShared} danger/>}
      {customTopic && <StackCtxRow emoji="🗑️" label={confirmDelete ? 'Wirklich löschen? (nochmal klicken)' : 'Löschen'} onClick={doDelete} danger/>}
      {!customTopic && !sharedTopic && (
        <div className="muted" style={{padding:'4px 14px 10px', fontSize:12.5}}>
          Kuratierte §34a-Themen lassen sich nicht bearbeiten oder löschen — dupliziere sie, um eine eigene Version zu bearbeiten.
        </div>
      )}
    </div>
  );
}

/* (Ausbau 21.07.2026) Vorher war dieses Modal komplett Deko — "Speichern" hat nur
   das Modal geschlossen, ohne irgendetwas zu speichern (im Review übersehen, beim
   Abarbeiten der Ausbau-Punkte entdeckt). Jetzt echt: speichert in eigene UND
   geteilte Stapel (gleiche Verzweigung wie der Magic-Import); für kuratierte
   §34a-Themen wird erklärt, dass sie bewusst unveränderlich sind (Duplizieren
   als Ausweg). MC-Karten landen mit ihren Optionen direkt als Quizfrage. */
function AddCardModal({ ctx }) {
  const [tab, setTab] = useState('karte');
  const [q, setQ] = useState('');
  const [a, setA] = useState('');
  const [mcOptions, setMcOptions] = useState([{ t: '', c: true }, { t: '', c: false }, { t: '', c: false }]);
  const [msg, setMsg] = useState(null); // { text, ok }

  const entry = (ctx.topics || []).find(t => t.id === ctx.activeStack);
  const topic = entry ? entry.topic : null;
  const editable = !!(topic && topic.isCustom);

  const setOpt = (i, patch) => setMcOptions(list => list.map((o, k) => (k === i ? { ...o, ...patch } : o)));
  const removeOpt = (i) => setMcOptions(list => (list.length > 2 ? list.filter((_, k) => k !== i) : list));
  const addOpt = () => setMcOptions(list => (list.length < 6 ? [...list, { t: '', c: false }] : list));

  const save = async () => {
    setMsg(null);
    if (!editable) return;
    let card = null;
    if (tab === 'mc') {
      const opts = mcOptions.map(o => ({ t: o.t.trim(), c: !!o.c })).filter(o => o.t);
      const correct = opts.filter(o => o.c);
      if (!q.trim() || opts.length < 2) { setMsg({ text: 'Frage und mindestens 2 Optionen ausfüllen.', ok: false }); return; }
      if (!correct.length) { setMsg({ text: 'Mindestens eine Option als richtig markieren.', ok: false }); return; }
      card = { q: q.trim(), a: correct.map(o => o.t).join(', '), options: opts, multi: correct.length > 1 };
    } else {
      if (!q.trim() || !a.trim()) { setMsg({ text: 'Frage und Antwort ausfüllen.', ok: false }); return; }
      card = { q: q.trim(), a: a.trim() };
    }
    let saved = null;
    if (topic.isShared && window.SharedStacks) saved = await window.SharedStacks.addCardsToTopic(topic.id, [card]);
    else if (window.CustomTopics) saved = window.CustomTopics.addCardsToTopic(topic.id, [card]);
    if (saved) {
      setMsg({ text: '✅ Karte gespeichert — direkt die nächste?', ok: true });
      setQ(''); setA(''); setMcOptions([{ t: '', c: true }, { t: '', c: false }, { t: '', c: false }]);
    } else {
      setMsg({ text: 'Speichern hat nicht geklappt (Frage evtl. schon vorhanden?).', ok: false });
    }
  };

  const inputCss = {width:'100%', padding:14, borderRadius:14, border:'1px solid var(--line)', background:'var(--surface)', fontFamily:'inherit'};
  return (
    <>
      <ModalHead title={'Karte hinzufügen' + (topic ? ' · ' + topic.name : '')} onClose={ctx.closeModal}/>
      <div className="modal-body">
        {!editable && (
          <div className="card flat tinted" style={{padding:16, marginBottom:14}}>
            <div style={{fontWeight:800, marginBottom:6}}>Kuratierter §34a-Stapel</div>
            <div className="muted" style={{fontSize:13.5}}>
              Die geprüften Prüfungsinhalte sind bewusst unveränderlich. Dupliziere den Stapel
              über das ⋮-Menü in "Meine Stapel", um eine eigene, bearbeitbare Version zu bekommen —
              oder füge Karten einem eigenen Stapel hinzu.
            </div>
          </div>
        )}
        <div className="tabs" style={{marginBottom:14}}>
          {[['karte','Karte'],['mc','Multiple Choice']].map(([k,l]) => (
            <button key={k} className={"tab " + (tab===k?'is-active':'')} onClick={() => { setTab(k); setMsg(null); }}>{l}</button>
          ))}
        </div>
        {tab !== 'mc' && (
          <>
            <div style={{fontWeight:800, marginBottom:6}}>Frage</div>
            <textarea value={q} onChange={e => setQ(e.target.value)} placeholder="Was kann Frustration auslösen?" style={{...inputCss, minHeight:80}} disabled={!editable}/>
            <div style={{fontWeight:800, marginTop:14, marginBottom:6}}>Antwort</div>
            <textarea value={a} onChange={e => setA(e.target.value)} placeholder="Aggression" style={{...inputCss, minHeight:60}} disabled={!editable}/>
            <div className="muted" style={{fontSize:12.5, marginTop:8}}>
              Wird als Karteikarte UND als Quizfrage angelegt — die Engine macht daraus automatisch
              Lückentext-/Abruf-Varianten.
            </div>
          </>
        )}
        {tab==='mc' && (
          <>
            <div style={{fontWeight:800, marginBottom:6}}>Frage</div>
            <textarea value={q} onChange={e => setQ(e.target.value)} placeholder="Wodurch kann die Wahrnehmung negativ beeinflusst werden?" style={{...inputCss, minHeight:60}} disabled={!editable}/>
            <div style={{fontWeight:800, marginTop:14, marginBottom:6}}>Optionen <span className="muted" style={{fontWeight:500, fontSize:12.5}}>(Schalter = richtige Antwort)</span></div>
            <div className="col">
              {mcOptions.map((o, i) => (
                <div key={i} className="row" style={{gap:10}}>
                  <button className={"toggle " + (o.c ? 'on' : '')} style={{width:38, height:24}} onClick={() => setOpt(i, { c: !o.c })} disabled={!editable}/>
                  <input value={o.t} onChange={e => setOpt(i, { t: e.target.value })} placeholder={'Option ' + (i + 1)}
                         style={{flex:1, padding:12, borderRadius:10, border:'1px solid var(--line)'}} disabled={!editable}/>
                  <button className="icon-btn" onClick={() => removeOpt(i)} disabled={!editable || mcOptions.length <= 2}><Icon.Close/></button>
                </div>
              ))}
              <button className="btn btn-ghost" style={{padding:'10px'}} onClick={addOpt} disabled={!editable || mcOptions.length >= 6}><Icon.Plus/> Option hinzufügen</button>
            </div>
          </>
        )}
        {msg && <div style={{color: msg.ok ? 'var(--success)' : 'var(--rose)', fontWeight:600, marginTop:12}}>{msg.text}</div>}
      </div>
      <div className="modal-foot">
        <button className="btn btn-ghost btn-full" onClick={ctx.closeModal}>Fertig</button>
        <button className="btn btn-primary btn-full" disabled={!editable} onClick={save}>Speichern</button>
      </div>
    </>
  );
}

// Fortschrittsring pro Eintrag (Blueprint Phase 5, "Fortschrittsring pro
// Eintrag") — nur für Einträge mit topicId, deren Stapel noch existiert und
// mindestens eine Karte hat. Nutzt exakt dieselbe Datenquelle wie die
// Fortschrittsanzeige im Deck-Detail (S34A_BY_ID + flatQuiz + SRS.topicStats,
// alle in app/main.js definiert, hier als globale Bezeichner erreichbar).
function HistoryEntryRing({ topicId }) {
  const topic = (typeof S34A_BY_ID !== 'undefined' && S34A_BY_ID) ? S34A_BY_ID[topicId] : null;
  if (!topic) return null;
  const questions = typeof flatQuiz === 'function' ? flatQuiz(topic) : [];
  const stats = (window.SRS && questions.length) ? window.SRS.topicStats(topicId, questions) : null;
  if (!stats || !stats.total) return null;
  // Gewichteter Fortschritt (06.08.2026): füllt sich schon ab der ersten
  // richtigen Antwort — nicht erst, wenn Karten voll gemeistert sind.
  const p = window.SRS.progressPct ? window.SRS.progressPct(topicId, questions) / 100 : stats.gemeistert / stats.total;
  return <Ring p={p} />;
}

function HistoryModal({ ctx }) {
  const [items, setItems] = useState(() => (window.AIHistory ? window.AIHistory.list() : []));
  const [q, setQ] = useState('');
  useEffect(() => {
    if (!window.AIHistory) return;
    return window.AIHistory.onChange((list) => setItems(list));
  }, []);
  const query = q.trim().toLowerCase();
  const filtered = query
    ? items.filter((x) => x.title.toLowerCase().includes(query) || (x.subtitle || '').toLowerCase().includes(query))
    : items;

  const openEntry = (x) => {
    if (!x.topicId) return;
    const topic = (typeof S34A_BY_ID !== 'undefined' && S34A_BY_ID) ? S34A_BY_ID[x.topicId] : null;
    if (!topic) return; // Stapel wurde inzwischen umbenannt/gelöscht — kein Sprung ins Leere
    ctx.closeModal();
    ctx.setActiveStack(x.topicId);
    ctx.go('deck');
  };

  return (
    <>
      <ModalHead title="Geschichte" onClose={ctx.closeModal}/>
      <div className="modal-body">
        {items.length > 0 && (
          <div className="row" style={{ marginBottom: 12 }}>
            <Icon.Search/>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Verlauf durchsuchen…"
                   style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 15 }}/>
          </div>
        )}
        {items.length === 0 && (
          <div className="muted" style={{ padding: '18px 4px' }}>
            Noch keine KI-Interaktionen. Sobald du "Erklären" beim Lernen nutzt oder über die
            Startseite/Live "Beliebiges Thema" einen Stapel per KI erzeugst, taucht er hier auf.
          </div>
        )}
        {items.length > 0 && filtered.length === 0 && (
          <div className="muted" style={{ padding: '18px 4px' }}>Keine Treffer für "{q}".</div>
        )}
        <div className="col">
          {filtered.map((x) => (
            <button key={x.id} className="card flat"
                    style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 14, textAlign: 'left', cursor: x.topicId ? 'pointer' : 'default' }}
                    onClick={() => openEntry(x)}>
              <div style={{ fontSize: 28, width: 34, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                {x.type === 'chat' ? '✨' : '🦉'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.title}</div>
                <div className="muted">{x.subtitle}{x.subtitle ? ' · ' : ''}{historyTimeAgo(x.ts)}</div>
              </div>
              {x.topicId && <HistoryEntryRing topicId={x.topicId}/>}
              {x.topicId && <Icon.Caret style={{ color: 'var(--ink-mute)' }}/>}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// Echtes Benachrichtigungszentrum (Blueprint Phase 10) — vorher komplett
// dekorativ mit vier festen Fake-Zeilen. Nutzt app/notifications.js (Liste +
// Live-Updates über Realtime, siehe dort) und lädt die Profile der Aktor:innen
// (wer hat's ausgelöst) nach, weil notifications-Zeilen nur actor_id speichern.
function NotifsModal({ ctx }) {
  const { session } = ctx;
  const myId = session && session.user && session.user.id;
  const [items, setItems] = useState(() => (window.Notifications ? window.Notifications.list() : []));
  const [profilesById, setProfilesById] = useState({});

  useEffect(() => {
    if (!window.Notifications) return;
    setItems(window.Notifications.list());
    return window.Notifications.onChange((list) => setItems(list));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const actorIds = Array.from(new Set(items.map((n) => n.actor_id).filter(Boolean).filter((id) => !profilesById[id])));
    if (!actorIds.length || !window.sb) return;
    window.sb.from('profiles').select('id, username, avatar').in('id', actorIds).then(({ data }) => {
      if (cancelled || !data) return;
      setProfilesById((m) => { const next = { ...m }; data.forEach((p) => { next[p.id] = p; }); return next; });
    });
    return () => { cancelled = true; };
  }, [items]);

  if (!window.Auth || !window.Auth.isConfigured() || !session) {
    return (
      <>
        <ModalHead title="Benachrichtigungen" onClose={ctx.closeModal}/>
        <div className="modal-body">
          <div className="card flat tinted" style={{ padding: 18, textAlign: 'center' }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Erst anmelden</div>
            <div className="muted" style={{ marginBottom: 14 }}>Melde dich an, um echte Benachrichtigungen zu sehen.</div>
            {!session && <button className="btn btn-primary" onClick={() => ctx.openModal('auth')}>Anmelden</button>}
          </div>
        </div>
      </>
    );
  }

  const markAll = () => window.Notifications && window.Notifications.markAllRead();
  const act = async (n) => {
    if (window.Notifications) window.Notifications.markRead(n.id);
    if (n.type === 'follow' && n.actor_id && window.Follows && myId) {
      try { await window.Follows.follow(myId, n.actor_id); } catch (e) { /* evtl. schon gefolgt */ }
    }
  };

  return (
    <>
      <ModalHead title="Benachrichtigungen" onClose={ctx.closeModal}/>
      <div className="modal-body">
        {items.length > 0 && (
          <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 8 }}>
            <button className="link" onClick={markAll}>Alle als gelesen</button>
          </div>
        )}
        {!items.length && (
          <div className="muted" style={{ padding: '18px 4px' }}>
            Noch nichts los. Sobald dir jemand folgt oder dich in der Freundes-Rangliste überholt, taucht es hier auf.
          </div>
        )}
        {items.map((n) => {
          const actor = profilesById[n.actor_id] || {};
          const text = window.Notifications ? window.Notifications.formatNotifText(n, actor.username) : '';
          return (
            <div key={n.id} className="notif-row" style={{ opacity: n.read ? 0.6 : 1, cursor: 'pointer' }} onClick={() => act(n)}>
              <AnimalAvatar kind={actor.avatar || '🦔'} size={44}/>
              <div className="meta">
                <div className="name">{actor.username || 'Jemand'}</div>
                <div className="sub">{text} · {historyTimeAgo(new Date(n.created_at).getTime())}</div>
              </div>
              {n.type === 'follow' && <button className="btn btn-ghost" style={{ padding: '8px 16px' }} onClick={(e) => { e.stopPropagation(); act(n); }}>Zurückfolgen</button>}
              {!n.read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--rose)', flexShrink: 0 }}/>}
            </div>
          );
        })}
      </div>
    </>
  );
}

function LiveModal({ ctx }) {
  const choose = (k) => { ctx.closeModal(); ctx.go('live'); };
  return (
    <>
      <ModalHead title="Gizmo Live" onClose={ctx.closeModal}/>
      <div className="modal-body">
        <div className="col">
          {[['📚','Aus Stapel spielen','Wähle einen deiner Stapel'],
            ['✨','Neues Thema','Lass KI Fragen erstellen'],
            ['🔢','Mit Code beitreten','Tritt einem Spiel bei']].map(([e,t,s],i) => (
            <button key={i} className="card flat" style={{display:'flex', gap:14, alignItems:'center', padding:18, textAlign:'left'}} onClick={() => choose(i)}>
              <div style={{fontSize:36}}>{e}</div>
              <div style={{flex:1}}><div style={{fontWeight:800, fontSize:17}}>{t}</div><div className="muted">{s}</div></div>
              <Icon.Caret style={{color:'var(--ink-mute)'}}/>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function ShareModal({ ctx }) {
  return (
    <>
      <ModalHead title="Fortschritt teilen" onClose={ctx.closeModal}/>
      <div className="modal-body" style={{display:'grid', placeItems:'center', gap:14}}>
        <div style={{background:'linear-gradient(135deg, var(--premium-a), var(--premium-b))', color:'#fff', borderRadius:24, padding:32, width:'100%', maxWidth:420, textAlign:'center', position:'relative', overflow:'hidden'}}>
          <div style={{fontFamily:'Fraunces, serif', fontWeight:900, fontSize:42, letterSpacing:'-0.02em'}}>Locked in.</div>
          <div style={{marginTop:8, opacity:.85, fontWeight:700}}>2-Tage-Serie · 19k XP · Level 14</div>
          <div style={{marginTop:18}}><Axolotl size={120}/></div>
          <div style={{marginTop:10, fontWeight:800}}>@nuri.de</div>
        </div>
        <div className="row" style={{gap:10, justifyContent:'center'}}>
          {['📲','💬','📧','🔗'].map((e,i) => <button key={i} className="icon-btn" style={{width:48, height:48, fontSize:22}}>{e}</button>)}
        </div>
      </div>
    </>
  );
}

function EditProfileModal({ ctx }) {
  const baseAnimals = ['🦔','🐱','🐙','🐼','🦝','🐧','🐺','🦊','👽','💀','🐶','🐟','🦄','🐨','🐰','🐸'];
  // Käuflich freigeschaltete Premium-Avatare (Shop, Blueprint Phase 6) hängen dahinter —
  // sobald gekauft, dauerhaft in diesem Raster wählbar wie alle anderen.
  const ownedCosmetics = (window.XP ? window.XP.state().ownedCosmetics : []) || [];
  const animals = [...baseAnimals, ...ownedCosmetics];
  const { session, profile } = ctx;
  const [pick, setPick] = useState(Math.max(0, animals.indexOf((profile && profile.avatar) || '🦔')));
  const [name, setName] = useState((profile && profile.username) || (window.SimpleSync && window.SimpleSync.account() && window.SimpleSync.account().name) || '');
  const [school, setSchool] = useState((profile && profile.school) || '');
  const [country, setCountry] = useState((profile && profile.country) || 'DE');
  const [isPrivate, setIsPrivate] = useState(!!(profile && profile.is_private));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Land-Auswahl (Phase 16) — vorher ein toter Fake-Button "🇩🇪 Deutschland".
  const COUNTRIES = [
    ['DE','🇩🇪 Deutschland'],['AT','🇦🇹 Österreich'],['CH','🇨🇭 Schweiz'],['TR','🇹🇷 Türkei'],
    ['PL','🇵🇱 Polen'],['NL','🇳🇱 Niederlande'],['FR','🇫🇷 Frankreich'],['IT','🇮🇹 Italien'],
    ['ES','🇪🇸 Spanien'],['GB','🇬🇧 Großbritannien'],['UA','🇺🇦 Ukraine'],['XX','🌍 Anderes Land'],
  ];

  const save = async () => {
    if (!session) { ctx.closeModal(); return; }
    setBusy(true); setErr('');
    try {
      // (Ausbau 21.07.2026) Eindeutige Nutzernamen: vorab prüfen (freundliche Meldung),
      // hart durchgesetzt vom Unique-Index (Unique-Fehler wird ebenfalls übersetzt).
      if (window.Auth.isUsernameTaken && await window.Auth.isUsernameTaken(name.trim(), session.user.id)) {
        setErr('Dieser Name ist schon vergeben — bitte einen anderen wählen.');
        setBusy(false);
        return;
      }
      await window.Auth.updateProfile(session.user.id, {
        username: name.trim() || 'Nutzer', avatar: animals[pick], school: school.trim() || null,
        country, is_private: isPrivate,
      });
      if (ctx.refreshProfile) ctx.refreshProfile(); // Topbar/Profilkopf sofort aktuell (Review 21.07.2026)
      ctx.closeModal();
    } catch (e) { setErr((e && e.message) || 'Speichern fehlgeschlagen.'); }
    setBusy(false);
  };

  return (
    <>
      <ModalHead title="Profil bearbeiten" onClose={ctx.closeModal}/>
      <div className="modal-body">
        <div style={{fontWeight:800, marginBottom:8}}>Avatar</div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(8, 1fr)', gap:8}}>
          {animals.map((a,i) => (
            <button key={i} onClick={() => setPick(i)}
              style={{aspectRatio:'1/1', borderRadius:'50%', background: i===pick? 'var(--accent-soft)':'var(--surface-2)', border: i===pick?'2px solid var(--accent)':'1px solid var(--line)', display:'grid', placeItems:'center', fontSize:28}}>
              {a}
            </button>
          ))}
        </div>
        <div style={{fontWeight:800, marginTop:18, marginBottom:6}}>Name</div>
        <input value={name} onChange={e => setName(e.target.value)} style={{width:'100%', padding:14, borderRadius:14, border:'1px solid var(--line)', background:'var(--surface)'}}/>
        <div style={{fontWeight:800, marginTop:14, marginBottom:6}}>Land</div>
        <select value={country} onChange={e => setCountry(e.target.value)}
                style={{width:'100%', padding:14, borderRadius:14, border:'1px solid var(--line)', background:'var(--surface)', fontSize:15}}>
          {COUNTRIES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
        </select>
        <div style={{fontWeight:800, marginTop:14, marginBottom:6}}>Schule</div>
        <input value={school} onChange={e => setSchool(e.target.value)} placeholder="z. B. TU Berlin" style={{width:'100%', padding:14, borderRadius:14, border:'1px solid var(--line)', background:'var(--surface)'}}/>
        <div className="row" style={{justifyContent:'space-between', marginTop:16, padding:'4px 2px'}}>
          <div>
            <div style={{fontWeight:800}}>Privates Profil</div>
            <div className="muted" style={{fontSize:12.5}}>Nicht in der Nutzersuche auffindbar — Freunde & Follower sehen dich weiterhin.</div>
          </div>
          <button className={"toggle " + (isPrivate ? 'on' : '')} onClick={() => setIsPrivate(v => !v)}/>
        </div>
        {!session && <div className="muted" style={{marginTop:10, fontSize:12.5}}>Nicht angemeldet — Änderungen werden nicht gespeichert.</div>}
        {err && <div style={{color:'var(--rose)', fontWeight:600, marginTop:10}}>{err}</div>}
      </div>
      <div className="modal-foot">
        <button className="btn btn-primary btn-full" disabled={busy} onClick={save}>{busy ? 'Speichern…' : 'Speichern'}</button>
      </div>
    </>
  );
}

window.Modals = Modals;
window.QUESTIONS_DATA = [
  {
    q: 'Welches Verhalten ist für einen Ladendetektiv empfehlenswert?',
    multi: false,
    tag: 'Neu',
    options: [
      { t: 'Laut Vorwürfe machen', c: false },
      { t: 'Ermahnen und Hausverbot androhen', c: false },
      { t: 'An neutralem Ort sprechen', c: true },
      { t: 'Ruhig und sachlich bleiben', c: false },
    ],
  },
  {
    q: 'Wodurch kann die Wahrnehmung negativ beeinflusst werden?',
    multi: true,
    tag: 'Multi-Auswahl',
    options: [
      { t: 'Angst', c: true },
      { t: 'Stress', c: true },
      { t: 'Aufmerksamkeit', c: false },
      { t: 'Interesse', c: false },
    ],
  },
  {
    q: 'Wie sollte eine Wachperson einer Person mit seelischer Behinderung begegnen?',
    multi: false,
    tag: 'Verbal',
    options: [
      { t: 'Mit Distanz und Strenge', c: false },
      { t: 'Mit Respekt und Toleranz', c: true },
      { t: 'Mit Ignoranz', c: false },
      { t: 'Mit Vorwürfen', c: false },
    ],
  },
  {
    q: 'Was kann Frustration auslösen?',
    multi: false,
    tag: 'Wiederholung',
    options: [
      { t: 'Lob und Anerkennung', c: false },
      { t: 'Aggression', c: true },
      { t: 'Mehr Pausen', c: false },
      { t: 'Klares Feedback', c: false },
    ],
  },
];
