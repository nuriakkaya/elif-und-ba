/* ==============================================================
   ♾️ UNENDLICH-XP — Version 8.2, 12.08.2026

   Nutzerwunsch wörtlich: „Ein Modus, wo alles abgefragt wird, alles
   gleichzeitig, vor allem von den Buchstaben — kreuz und quer. Und
   wenn man das nicht gut genug gemacht hat, muss man die Sachen, die
   man falsch gemacht hat, wiederholen, bevor man eine neue Runde
   startet, bis alles sitzt. Das soll auch Punkte geben … Unendlich-XP-
   Modus. Aber erst ganz am Ende freischaltbar, wenn man alles
   mindestens zweimal durchgespielt hat."

   So ist es gebaut:

   FREISCHALTUNG. Der Modus bleibt zu, bis JEDE der 17 Lektionen
   (a) einmal auf 100 % steht und (b) danach noch einen kompletten
   Durchgang hatte (der „zweite Durchgang" aus app/replay.js). Wer das
   geschafft hat, hat jede Karte mehrfach richtig beantwortet. Einmal
   offen, bleibt es offen — auch wenn später mal eine Karte wieder
   wackelt. Lehrkräfte sehen den Modus immer (zum Vorführen).

   WELLEN STATT RUNDEN. Eine Welle sind 12 Fragen, quer durch alle
   Lektionen gemischt und in beide Richtungen gefragt: mal „welcher
   Name gehört zu diesem Zeichen", mal „welches Zeichen gehört zu
   diesem Namen". Dadurch kann man nichts auswendig „durchklicken".

   NACHSITZEN. Jede falsch beantwortete Karte wandert in den Korb.
   Ist die Welle durch, geht es NICHT weiter, bevor der Korb leer ist:
   Jede Karte darin muss noch einmal richtig kommen; wer wieder daneben
   liegt, sieht sie später erneut. Erst dann die nächste Welle.

   PUNKTE. Hier geht das Punktesammeln nie aus — das ist der Sinn des
   Namens. Fertige Lektionen geben irgendwann nichts mehr (halbe, dann
   keine Punkte), dieser Modus immer:
     richtig .............. 12 XP × Wellenfaktor
     Wellenfaktor ......... +10 % je abgeschlossener Welle, bis 2×
     5er-Serie ............ +25 XP
     Welle ohne Fehler .... +60 XP
     Welle mit Nachsitzen . +25 XP
     im Nachsitzen richtig . 4 XP
   Bewusst weniger als die 17 XP einer normalen Lernfrage: Neues zu
   lernen soll sich mehr lohnen als zu trainieren — dafür hört es hier
   nie auf.

   Der Karteikasten (app/srs.js) wird hier ABSICHTLICH nicht verändert.
   Dieser Modus ist eine Trainingshalle; der Lernstand der Lektionen
   soll davon weder profitieren noch leiden. Die Lehrkraft sieht die
   Trainingszahlen trotzdem — sie stehen im Klassenzimmer.
   ============================================================== */
(function () {
  const { useState, useEffect, useRef, useMemo, useCallback } = React;

  const KEY = 'eb_inf_v1';
  const WAVE = 12;               // Fragen je Welle
  const XP_BASE = 12;
  const XP_FIX = 4;
  const XP_STREAK = 25;
  const XP_WAVE_CLEAN = 60;
  const XP_WAVE = 25;

  /* ---------------- Stand ---------------- */
  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (o && typeof o === 'object') {
        o.w = o.w || {};
        o.open = Number(o.open || 0); o.waves = Number(o.waves || 0);
        o.xp = Number(o.xp || 0); o.best = Number(o.best || 0);
        o.correct = Number(o.correct || 0); o.wrong = Number(o.wrong || 0);
        return o;
      }
    } catch (e) {}
    return { v: 1, open: 0, waves: 0, xp: 0, best: 0, correct: 0, wrong: 0, w: {} };
  }
  function save(st) { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }

  /* ---------------- Freischaltung ---------------- */
  function flatQuiz(t) {
    const out = [];
    (t.blocks || []).forEach(function (b) { (b.quiz || []).forEach(function (q) { out.push(q); }); });
    return out;
  }
  function unlockInfo() {
    const teacher = !!(window.SimpleSync && window.SimpleSync.isTeacher && window.SimpleSync.isTeacher());
    const st = load();
    const list = (window.QuranCourse && window.QuranCourse.ordered()) || [];
    let ok = 0; const missing = [];
    list.forEach(function (t) {
      const qs = flatQuiz(t);
      const done = !!(window.SRS && window.SRS.progressPct && window.SRS.progressPct(t.id, qs) >= 100);
      const twice = !!(window.Replay && window.Replay.runs(t.id) >= 1);
      if (done && twice) ok++; else missing.push({ name: t.name, done: done, twice: twice });
    });
    const earned = list.length > 0 && ok === list.length;
    if (earned && !st.open) { st.open = 1; save(st); }
    return {
      open: teacher || !!st.open || earned,
      teacher: teacher && !st.open && !earned,
      done: ok, total: list.length, missing: missing,
    };
  }

  /* ---------------- Kartenpool ----------------
     (12.08.2026, Nutzerwunsch) Das ANFANGS-ALPHABET bleibt draußen: Lektion 1
     („Die Buchstaben") und Lektion 2 („Die Formen") sind reines Buchstaben-
     Benennen. Wer diesen Modus überhaupt erreicht hat, kann das längst — dann
     ist es Zeitverschwendung und verwässert das Training. Gefragt wird also
     alles ab Lektion 3, also das echte Lesen: Harekeler, Cezim, Şedde, Tenvin,
     die Dehnungen, Hemze und das Wort „Allah". Wer die Grundlagen trotzdem
     mitnehmen will, kann sie auf dem Startbildschirm dazuschalten. */
  const GRUNDLAGEN = ['quran-harfler', 'quran-formen'];
  const bare = (s) => String(s || '').replace(/[ً-ْٰـ\s·]/g, '');
  function buildPool(mitGrundlagen) {
    const list = ((window.QuranCourse && window.QuranCourse.ordered()) || [])
      .filter(function (t) { return mitGrundlagen || GRUNDLAGEN.indexOf(t.id) < 0; });
    const seen = {}, out = [];
    list.forEach(function (t) {
      flatQuiz(t).forEach(function (c) {
        const q = String(c.q || '').trim(), a = String(c.a || '').trim();
        if (!q || !a) return;
        const k = q + '|' + a;
        if (seen[k]) return;
        seen[k] = 1;
        out.push({ q: q, a: a, k: k, topicId: t.id, topicName: t.name,
                   letter: bare(q).length <= 2, grund: GRUNDLAGEN.indexOf(t.id) >= 0 });
      });
    });
    return out;
  }
  const SCOPES = [
    { id: 'alle', t: 'Alles gemischt', d: 'Silben, Wörter und Lesestücke ab Lektion 3 — kreuz und quer' },
    { id: 'wort', t: 'Nur Lesestücke', d: 'Die längeren Wörter, keine Einzelsilben' },
    { id: 'grund', t: 'Mit Grundlagen', d: 'Zusätzlich das Buchstaben-Alphabet aus Lektion 1 und 2' },
  ];
  function scoped(pool, scope) {
    if (scope === 'wort') return pool.filter(function (c) { return !c.letter; });
    return pool;
  }
  function poolFor(scope) { return scoped(buildPool(scope === 'grund'), scope); }

  /* ---------------- Fragen bauen (kreuz und quer) ---------------- */
  function shuffle(a) {
    const x = a.slice();
    for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = x[i]; x[i] = x[j]; x[j] = t; }
    return x;
  }
  function makeQuestion(card, pool) {
    // 60 % „Zeichen -> Name", 40 % „Name -> Zeichen"
    const dir = Math.random() < 0.6 ? 'ar2name' : 'name2ar';
    const correct = dir === 'ar2name' ? card.a : card.q;
    const opts = [correct];
    const others = shuffle(pool);
    for (let i = 0; i < others.length && opts.length < 4; i++) {
      const o = others[i];
      if (o.k === card.k) continue;
      if (o.a === card.a || o.q === card.q) continue;      // wäre auch richtig
      const val = dir === 'ar2name' ? o.a : o.q;
      if (opts.indexOf(val) >= 0) continue;
      opts.push(val);
    }
    return { card: card, dir: dir, prompt: dir === 'ar2name' ? card.q : card.a, options: shuffle(opts), correct: correct };
  }

  /* ---------------- Für das Klassenzimmer ---------------- */
  function teacherSnapshot() {
    const st = load();
    if (!st.waves && !st.correct) return null;
    const worst = Object.keys(st.w || {})
      .map(function (k) { return { c: k.split('|')[0] + ' (' + k.split('|')[1] + ')', n: st.w[k] }; })
      .sort(function (a, b) { return b.n - a.n; }).slice(0, 5);
    const total = st.correct + st.wrong;
    return { o: st.open ? 1 : 0, wv: st.waves, xp: st.xp, best: st.best,
             q: total, pct: total ? Math.round(100 * st.correct / total) : 0, top: worst };
  }

  window.InfinityMode = {
    load: load, save: save, unlockInfo: unlockInfo, buildPool: buildPool, scoped: scoped,
    makeQuestion: makeQuestion, teacherSnapshot: teacherSnapshot, SCOPES: SCOPES,
    poolFor: poolFor, GRUNDLAGEN: GRUNDLAGEN,
    WAVE: WAVE, XP_BASE: XP_BASE, KEY: KEY,
    reset: function () { try { localStorage.removeItem(KEY); } catch (e) {} },
  };

  /* ==============================================================
     Bildschirm
     ============================================================== */
  function Screen({ ctx }) {
    const { go } = ctx;
    const info = unlockInfo();
    const [phase, setPhase] = useState('intro');    // intro | play | wave
    const [scope, setScope] = useState('alle');
    const cards = useMemo(function () { return poolFor(scope); }, [scope]);

    /* Warteschlange, Korb und Zähler liegen in refs, NICHT im State.
       Grund: Nach einer Antwort läuft der Wechsel zur nächsten Frage in einem
       setTimeout. Ein dort eingefrorener State wäre veraltet — die gerade
       falsch beantwortete Karte würde nicht im Korb landen. Mit refs stimmt
       der Stand immer, und ein leeres force() zeichnet die Anzeige neu. */
    const queueRef = useRef([]);
    const basketRef = useRef([]);
    const wrongRef = useRef(0);
    const doneRef = useRef(0);
    const [, force] = useState(0);
    const redraw = useCallback(function () { force(function (x) { return x + 1; }); }, []);

    const [item, setItem] = useState(null);
    const [fixing, setFixing] = useState(false);
    const [picked, setPicked] = useState(null);
    const [streak, setStreak] = useState(0);
    const [wave, setWave] = useState(0);             // abgeschlossene Wellen in dieser Sitzung
    const [waveXp, setWaveXp] = useState(0);
    const [flash, setFlash] = useState(null);        // {txt, good}
    const [sessionXp, setSessionXp] = useState(0);
    const timer = useRef(null);
    useEffect(function () { return function () { if (timer.current) clearTimeout(timer.current); }; }, []);

    const factor = Math.min(2, 1 + 0.1 * wave);

    function startWave() {
      const picks = shuffle(cards).slice(0, Math.min(WAVE, cards.length));
      const qs = picks.map(function (c) { return makeQuestion(c, cards); });
      queueRef.current = qs.slice(1);
      basketRef.current = [];
      wrongRef.current = 0;
      doneRef.current = 0;
      setItem(qs[0]); setFixing(false); setPicked(null); setWaveXp(0); setFlash(null);
      setPhase('play');
    }

    function award(n) {
      if (n <= 0) return 0;
      const st = load(); st.xp += n; save(st);
      try { if (window.XP && window.XP.addBonus) window.XP.addBonus(n); } catch (e) {}
      setWaveXp(function (x) { return x + n; });
      setSessionXp(function (x) { return x + n; });
      return n;
    }

    function choose(opt) {
      if (picked !== null || !item) return;
      const right = opt === item.correct;
      setPicked(opt);
      const st = load();
      if (right) {
        st.correct += 1;
        const ns = streak + 1;
        setStreak(ns);
        if (ns > (st.best || 0)) st.best = ns;
        save(st);
        const n = fixing ? XP_FIX : Math.round(XP_BASE * factor);
        award(n);
        let txt = '+' + n + ' XP';
        if (!fixing && ns % 5 === 0) {
          award(XP_STREAK);
          txt = ns + ' in Folge! +' + (n + XP_STREAK) + ' XP';
          try { if (window.Sound) window.Sound.comboMilestone(2); } catch (e) {}
        } else { try { if (window.Sound) window.Sound.correct(); } catch (e) {} }
        setFlash({ txt: txt, good: true });
      } else {
        st.wrong += 1;
        st.w[item.card.k] = (st.w[item.card.k] || 0) + 1;
        save(st);
        setStreak(0);
        if (!fixing) wrongRef.current += 1;
        basketRef.current = basketRef.current.concat([item.card]);
        try { if (window.Sound) window.Sound.wrong(); } catch (e) {}
        setFlash({ txt: 'Kommt gleich nochmal', good: false });
      }
      // Aussprache anspielen — auch beim Danebenliegen, dann bleibt es hängen.
      try { if (window.QuranAudio) window.QuranAudio.speakText(item.card.q, true); } catch (e) {}
      timer.current = setTimeout(next, right ? 950 : 1900);
    }

    function next() {
      setFlash(null); setPicked(null);
      doneRef.current += 1;
      if (queueRef.current.length) {
        const q = queueRef.current[0];
        queueRef.current = queueRef.current.slice(1);
        setFixing(false);
        setItem(q);
        return;
      }
      if (basketRef.current.length) {                   // Nachsitzen
        const c = basketRef.current[0];
        basketRef.current = basketRef.current.slice(1);
        setFixing(true);
        setItem(makeQuestion(c, cards));
        return;
      }
      // Welle fertig
      const sauber = wrongRef.current === 0;
      award(sauber ? XP_WAVE_CLEAN : XP_WAVE);
      const st = load(); st.waves += 1; save(st);
      setWave(function (w) { return w + 1; });
      setItem(null); setFixing(false);
      try { if (window.Sound) window.Sound.roundEnd(); } catch (e) {}
      if (sauber) { try { if (window.Celebrate) window.Celebrate.burst(); } catch (e) {} }
      setPhase('wave');
      redraw();
    }

    /* ---------- gesperrt ---------- */
    if (!info.open) {
      return (
        <div className="content">
          <button className="btn btn-ghost" style={{ marginBottom: 10 }} onClick={function () { go('decks'); }}>← Zurück</button>
          <div className="inf-locked">
            <div className="inf-lock-ico">🔒</div>
            <h1 style={{ margin: '6px 0' }}>♾️ Unendlich-XP</h1>
            <p>
              Das ist der letzte Modus der App — hier wird <b>alles kreuz und quer</b> abgefragt, aus allen
              Lektionen gleichzeitig, und die Punkte gehen <b>nie</b> aus. Er öffnet sich, wenn du jede
              Lektion <b>zweimal komplett</b> durchgespielt hast.
            </p>
            <div className="inf-progress">
              <div className="xp-bar"><div className="fill" style={{ width: (info.total ? Math.round(100 * info.done / info.total) : 0) + '%' }}/></div>
              <b>{info.done} von {info.total} Lektionen sind zweimal durch</b>
            </div>
            <div className="inf-missing">
              <div className="muted" style={{ fontWeight: 700, marginBottom: 6 }}>Das fehlt noch:</div>
              {info.missing.slice(0, 6).map(function (m, i) {
                return <div key={i} className="inf-miss">
                  <span>{m.name}</span>
                  <em>{!m.done ? 'noch nicht bei 100 %' : 'einmal geschafft — jetzt noch ein Durchgang'}</em>
                </div>;
              })}
              {info.missing.length > 6 && <div className="muted" style={{ fontSize: 12.5 }}>… und {info.missing.length - 6} weitere</div>}
            </div>
            <button className="qp-btn" style={{ marginTop: 14 }} onClick={function () { go('decks'); }}>Zu den Lektionen</button>
          </div>
        </div>
      );
    }

    /* ---------- Startbildschirm ---------- */
    if (phase === 'intro') {
      const st = load();
      return (
        <div className="content">
          <button className="btn btn-ghost" style={{ marginBottom: 10 }} onClick={function () { go('decks'); }}>← Zurück</button>
          <div className="inf-hero">
            <div className="inf-ico">♾️</div>
            <div>
              <h1 style={{ margin: 0 }}>Unendlich-XP</h1>
              <div className="inf-sub">Alles auf einmal — kreuz und quer, bis alles sitzt.</div>
            </div>
          </div>
          {info.teacher && <div className="hz-note">🔓 Lehrer-Modus: Du siehst den Modus, obwohl er für die Kinder noch zu ist.</div>}
          <div className="inf-rules">
            <div><b>12 Fragen</b> pro Welle, gemischt aus dem ganzen Kurs — mal wird das Zeichen gefragt, mal die Lesung. Das reine Buchstaben-Alphabet ist raus: das kannst du längst.</div>
            <div><b>Falsch?</b> Die Karte kommt in den Korb. Der Korb muss leer sein, bevor die nächste Welle startet.</div>
            <div><b>Punkte:</b> {XP_BASE} XP je richtige Antwort, +{XP_STREAK} für jede 5er-Serie, +{XP_WAVE_CLEAN} für eine Welle ohne Fehler. Und das <b>ohne Ende</b>.</div>
          </div>
          <div className="inf-scopes">
            {SCOPES.map(function (s) {
              const n = poolFor(s.id).length;
              return (
                <button key={s.id} className={'inf-scope' + (scope === s.id ? ' is-active' : '')} onClick={function () { setScope(s.id); }}>
                  <b>{s.t}</b><em>{s.d}</em><span>{n} Karten</span>
                </button>
              );
            })}
          </div>
          <button className="qp-btn hz-primary" disabled={cards.length < 4} onClick={startWave}>
            {cards.length < 4 ? 'Zu wenige Karten in dieser Auswahl' : '▶️ Welle starten'}
          </button>
          {(st.waves > 0) && (
            <div className="inf-stats">
              <span className="pill">🌊 {st.waves} Wellen</span>
              <span className="pill">✨ {st.xp} XP hier verdient</span>
              <span className="pill">🔥 Beste Serie: {st.best}</span>
              <span className="pill">🎯 {st.correct + st.wrong > 0 ? Math.round(100 * st.correct / (st.correct + st.wrong)) : 0}% richtig</span>
            </div>
          )}
        </div>
      );
    }

    /* ---------- Wellen-Ende ---------- */
    if (phase === 'wave') {
      const st = load();
      return (
        <div className="content">
          <div className="inf-done">
            <div className="inf-done-ico">{wrongRef.current === 0 ? '🌊' : '✅'}</div>
            <h2>{wrongRef.current === 0 ? 'Welle ohne einen Fehler!' : 'Welle geschafft — alles nachgeholt!'}</h2>
            <div className="hz-reward-xp">+{waveXp} XP</div>
            <div className="inf-stats" style={{ justifyContent: 'center' }}>
              <span className="pill">🌊 Welle {wave}</span>
              <span className="pill">✖️ {wrongRef.current} Fehler</span>
              <span className="pill">Nächste Welle: ×{Math.min(2, 1 + 0.1 * wave).toFixed(1)} Punkte</span>
            </div>
            <div className="hz-row" style={{ marginTop: 16, justifyContent: 'center' }}>
              <button className="qp-btn hz-primary" onClick={startWave}>▶️ Nächste Welle</button>
              <button className="btn btn-ghost" onClick={function () { setPhase('intro'); }}>Schluss für heute</button>
            </div>
            <div className="muted" style={{ marginTop: 12, fontSize: 12.5 }}>
              Insgesamt hier: {st.waves} Wellen · {st.xp} XP · beste Serie {st.best}
            </div>
          </div>
        </div>
      );
    }

    /* ---------- Spiel ---------- */
    const total = WAVE;
    const pct = Math.min(100, Math.round(100 * doneRef.current / total));
    const isAr = item && item.dir === 'ar2name';
    return (
      <div className="content inf-play">
        <div className="inf-top">
          <button className="icon-btn" onClick={function () { if (timer.current) clearTimeout(timer.current); setPhase('intro'); }}>✕</button>
          <div className="inf-bar"><div style={{ width: pct + '%' }}/></div>
          <span className="pill">✨ {sessionXp}</span>
        </div>
        <div className="inf-meta">
          {fixing
            ? <span className="inf-fix">🔁 Nachsitzen — noch {basketRef.current.length + 1} {basketRef.current.length + 1 === 1 ? 'Karte' : 'Karten'}</span>
            : <span>Frage {Math.min(total, doneRef.current + 1)} von {total}{wrongRef.current > 0 ? ' · ' + wrongRef.current + ' im Korb' : ''}</span>}
          {streak >= 2 && <span className="inf-streak">🔥 {streak} in Folge</span>}
        </div>

        {item && (
          <>
            <div className={'inf-prompt' + (isAr ? ' is-ar' : '')} dir={isAr ? 'rtl' : 'ltr'}>
              {item.prompt}
              {isAr && <button className="inf-spk" onClick={function () { try { window.QuranAudio && window.QuranAudio.speakText(item.card.q, true); } catch (e) {} }}>🔊</button>}
            </div>
            <div className="inf-hint">{isAr ? 'Wie liest man das?' : 'Welches Zeichen ist das?'}</div>
            <div className="inf-opts">
              {item.options.map(function (o, i) {
                let cls = 'inf-opt';
                const optAr = item.dir === 'name2ar';
                if (picked !== null) {
                  if (o === item.correct) cls += ' is-right';
                  else if (o === picked) cls += ' is-wrong';
                  else cls += ' is-off';
                }
                return (
                  <button key={i} className={cls + (optAr ? ' is-ar' : '')} dir={optAr ? 'rtl' : 'ltr'}
                          disabled={picked !== null} onClick={function () { choose(o); }}>{o}</button>
                );
              })}
            </div>
            {flash && <div className={'inf-flash' + (flash.good ? ' is-good' : ' is-bad')}>{flash.txt}</div>}
            {picked !== null && picked !== item.correct && (
              <div className="inf-solution">
                Richtig ist: <b dir="rtl">{item.correct}</b> <span className="muted">({item.card.topicName})</span>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  window.InfinityScreen = Screen;
})();
