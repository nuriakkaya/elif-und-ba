/* ==============================================================
   SurahModule — "Suren lesen & hören" (Nachtausbau Punkt 1):
   Das komplette Suren-Modul aus der Elif&Ba-App, eingebaut in LERN.

   - Liste: Al-Fatiha + die 11 kurzen Suren, mit 🏆 wenn auswendig.
   - Detail, drei Tabs wie im Original:
       📖 Lesen      — Vers-Karten (Arabisch groß, Umschrift, Bubenheim)
                       mit Vers-Audio (Alafasy) + "Ganze Sure anhören"
                       inkl. Mitlauf-Hervorhebung.
       🧠 Auswendig  — 4 Stufen (Mit allem → Ohne Deutsch → Nur Arabisch
                       → Aus dem Kopf mit Blur-Aufdecken) + "Ich kann
                       sie auswendig!" (XP-Bonus + große Feier).
       💛 Bedeutung  — kindgerechte Erklärung + "Wusstest du?".
   Audio braucht Internet; bei Fehlern gibt es einen freundlichen Hinweis.
   ============================================================== */
(function () {
  const { useState, useEffect, useRef } = React;
  const AUDIO_BASE = 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/';
  const DONE_KEY = 'quran_surah_done_v1';

  function doneMap() { try { return JSON.parse(localStorage.getItem(DONE_KEY) || '{}'); } catch (e) { return {}; } }
  function markDone(n) {
    const m = doneMap(); m[n] = 1;
    try { localStorage.setItem(DONE_KEY, JSON.stringify(m)); } catch (e) {}
  }

  function Screen({ ctx }) {
    const { go } = ctx;
    const [selN, setSelN] = useState(null);
    const surahs = window.SURAHS_DATA || [];
    const sel = surahs.find(s => s.n === selN) || null;
    if (sel) return <Detail surah={sel} onBack={() => setSelN(null)} ctx={ctx}/>;
    const dm = doneMap();
    const doneCount = surahs.filter(s => dm[s.n]).length;
    return (
      <div className="content">
        <button className="btn btn-ghost" style={{ marginBottom: 10 }} onClick={() => go('decks')}>← Zurück</button>
        <h1 style={{ margin: 0 }}>📖 Suren lesen &amp; hören</h1>
        <div className="muted" style={{ margin: '4px 0 14px' }}>
          Al-Fatiha und die 11 kurzen Suren — mit Ton zum Mitsprechen, Schritt für Schritt auswendig. {doneCount}/{surahs.length} auswendig 🏆
        </div>
        <div className="sur-grid">
          {surahs.map(s => (
            <button key={s.n} className="sur-card" onClick={() => setSelN(s.n)}>
              <span className="sur-num">{s.n}</span>
              <span className="sur-mid">
                <span className="sur-name">{s.name}</span>
                <span className="sur-sub">{s.deName} · {s.ayahs.length} Verse</span>
              </span>
              <span className="sur-ar" dir="rtl">{s.arName}</span>
              {dm[s.n] ? <span className="sur-done">🏆</span> : <span className="sur-chev">›</span>}
            </button>
          ))}
        </div>
        <div className="muted" style={{ marginTop: 12, fontSize: 12.5 }}>
          🎧 Rezitation: Mischary Raschid Alafasy · Text: quran-simple (alquran.cloud) · Übersetzung: Bubenheim &amp; Elyas. Für den Ton brauchst du Internet.
        </div>
      </div>
    );
  }

  function Detail({ surah, onBack, ctx }) {
    const [tab, setTab] = useState('read');       // read | learn | meaning
    const [stage, setStage] = useState(1);        // Auswendig-Stufen 1-4
    const [playing, setPlaying] = useState(-1);   // Vers-Index, der gerade läuft
    const [queueOn, setQueueOn] = useState(false);
    const [revealed, setRevealed] = useState({}); // Stufe 4: aufgedeckte Verse
    const [isDone, setIsDone] = useState(!!doneMap()[surah.n]);
    const audioRef = useRef(null);
    const queueRef = useRef(null); // {idx} während "Ganze Sure"

    const stopAudio = () => {
      queueRef.current = null;
      setQueueOn(false);
      setPlaying(-1);
      if (audioRef.current) { try { audioRef.current.pause(); } catch (e) {} audioRef.current = null; }
    };
    useEffect(() => stopAudio, []); // beim Verlassen aufräumen
    useEffect(() => { setRevealed({}); }, [stage, tab]);

    const audioFail = () => {
      stopAudio();
      alert('🌐 Für den Ton brauchst du Internet — probier es später nochmal!');
    };
    const playAyah = (i, thenNext) => {
      if (audioRef.current) { try { audioRef.current.pause(); } catch (e) {} }
      const a = new Audio(AUDIO_BASE + (surah.audioStart + i) + '.mp3');
      audioRef.current = a;
      setPlaying(i);
      a.onended = () => {
        if (thenNext && queueRef.current) {
          const next = i + 1;
          if (next < surah.ayahs.length) { playAyah(next, true); return; }
        }
        stopAudio();
      };
      a.onerror = audioFail;
      a.play().catch(audioFail);
    };
    const togglePlayAll = () => {
      if (queueRef.current) { stopAudio(); return; }
      queueRef.current = { on: true };
      setQueueOn(true);
      playAyah(0, true);
    };
    const finishMemorized = () => {
      if (!isDone) {
        markDone(surah.n);
        setIsDone(true);
        if (window.XP && window.XP.addBonus) window.XP.addBonus(40);
        if (window.Sound && window.Sound.stackMastered) window.Sound.stackMastered();
        if (window.Celebrate) window.Celebrate.bigCelebration({ count: 80 });
      }
    };

    const showTr = !(tab === 'learn' && stage >= 3);
    const showDe = !(tab === 'learn' && stage >= 2);
    const blur = tab === 'learn' && stage === 4;

    return (
      <div className="content">
        <div className="row" style={{ alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
          <button className="btn btn-ghost" onClick={() => { stopAudio(); onBack(); }}>←</button>
          <div>
            <h1 style={{ margin: 0 }}>{surah.name} <span className="sur-ar-inline" dir="rtl">{surah.arName}</span></h1>
            <div className="muted" style={{ fontSize: 13 }}>Sure {surah.n} · „{surah.deName}“ · {surah.ayahs.length} Verse · offenbart in {surah.place}{isDone ? ' · 🏆 auswendig!' : ''}</div>
          </div>
        </div>
        <div className="sur-tabs">
          <button className={'sur-tab' + (tab === 'read' ? ' is-active' : '')} onClick={() => { stopAudio(); setTab('read'); }}>📖 Lesen</button>
          <button className={'sur-tab' + (tab === 'learn' ? ' is-active' : '')} onClick={() => { stopAudio(); setTab('learn'); }}>🧠 Auswendig</button>
          <button className={'sur-tab' + (tab === 'meaning' ? ' is-active' : '')} onClick={() => { stopAudio(); setTab('meaning'); }}>💛 Bedeutung</button>
        </div>

        {tab === 'meaning' ? (
          <>
            <div className="sur-meaning"><b>Worum geht es?</b><p>{surah.meaning}</p></div>
            <div className="sur-fact"><b>🤔 Wusstest du?</b><p>{surah.fact}</p></div>
          </>
        ) : (
          <>
            {tab === 'learn' && (
              <div className="sur-stages">
                {[1, 2, 3, 4].map(n => (
                  <button key={n} className={'sur-stage' + (stage === n ? ' is-active' : '')} onClick={() => setStage(n)}>
                    {n}. {['Mit allem', 'Ohne Deutsch', 'Nur Arabisch', 'Aus dem Kopf!'][n - 1]}
                  </button>
                ))}
              </div>
            )}
            <button className="qp-btn" style={{ marginBottom: 12 }} onClick={togglePlayAll}>
              {queueOn ? '⏹ Stopp' : '▶️ Ganze Sure anhören'}
            </button>
            {surah.basmala && <div className="sur-basmala" dir="rtl">{window.SURAH_BASMALA}</div>}
            {surah.ayahs.map((a, i) => (
              <div key={i} className={'sur-ayah' + (playing === i ? ' is-playing' : '')}>
                <div className={'sur-ayah-ar' + (blur && !revealed[i] ? ' is-blur' : '')} dir="rtl"
                     onClick={() => blur && setRevealed(r => ({ ...r, [i]: !r[i] }))}>{a.ar}</div>
                {blur && !revealed[i] && <div className="sur-covernote">👆 Erst aus dem Kopf sagen, dann zum Prüfen antippen!</div>}
                {showTr && !(blur && !revealed[i]) && <div className="sur-ayah-tr">{a.tr}</div>}
                {showDe && !(blur && !revealed[i]) && <div className="sur-ayah-de">{a.de}</div>}
                <div className="row" style={{ gap: 8, marginTop: 6 }}>
                  <span className="sur-versnum">Vers {i + 1}</span>
                  <button className="sur-play" onClick={() => { queueRef.current = null; setQueueOn(false); playAyah(i, false); }}>🔊</button>
                </div>
              </div>
            ))}
            {tab === 'learn' && (
              isDone
                ? <button className="qp-btn" disabled style={{ opacity: .55 }}>🏆 Schon geschafft — Maschallah!</button>
                : <button className="qp-btn" style={{ background: '#F0C33C', color: '#5a4508' }} onClick={finishMemorized}>🏆 Ich kann die Sure auswendig!</button>
            )}
          </>
        )}
      </div>
    );
  }

  window.SurahModule = { Screen };
})();
