/* ==============================================================
   🤝 UNSERE KLASSE (11.08.2026)

   Nutzerwunsch: „Können wir den Fortschritt-Modus ausbauen, dass man
   sich gegenseitig anspornt?"

   Bewusste Grundhaltung: In einer Koranklasse soll nicht der Beste
   gewinnen, sondern jeder weiterkommen. Deshalb steht das GEMEINSAME
   Ziel ganz oben und die Rangliste darunter — und zwar nach den
   Punkten der letzten 7 Tage, nicht nach der Gesamtsumme. So kann
   auch ein Kind, das später dazukommt, diese Woche vorne stehen;
   niemand ist dauerhaft abgehängt.

   Fünf Bausteine:
     1. 🎯 Klassenziel   — was die Klasse zusammen geschafft hat
     2. 🔥 Diese Woche   — Rangliste nach Punkten der letzten 7 Tage
     3. ⭐ Gesamt        — Rangliste nach ALLEN Punkten seit Tag 1
        (14.08.2026, Nutzerwunsch: „Kaan hatte doch 42000?" — die
        Wochen-Tafel hatte für Verwirrung gesorgt; jetzt sieht jedes
        Kind beide Sichten und nichts wirkt „weggenommen")
     4. 🏆 Auswendig     — wer wie viele Suren auswendig kann
     5. 💪 Anfeuern      — ein Zeichen an eine Mitschülerin schicken
        (nur 💪 👏 🔥 🤲, kein freier Text — so kann hier niemand
        etwas Gemeines schreiben; drei Zurufe pro Tag und Person)

   Alles läuft über den vorhandenen Mini-Server. Die Kinder-Abfrage
   liefert absichtlich nur Punkte, Level, Serie und Suren — Schwächen
   und Lektionsdetails sieht weiterhin nur die Lehrkraft.
   ============================================================== */
(function () {
  const { useState, useEffect, useRef, useCallback } = React;
  const CACHE_KEY = 'eb_board_cache_v1';
  const SEEN_KEY = 'eb_cheer_seen_v1';
  const KINDS = [
    { k: '💪', t: 'Du schaffst das!' },
    { k: '👏', t: 'Maschallah!' },
    { k: '🔥', t: 'Stark!' },
    { k: '🤲', t: 'Ich bete für dich' },
  ];

  function loadCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (e) { return null; } }
  function saveCache(b) { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ board: b, ts: Date.now() })); } catch (e) {} }

  /* ---------------- Daten holen ---------------- */
  function useBoard() {
    const cached = loadCache();
    const [board, setBoard] = useState(cached ? cached.board : null);
    const [stale, setStale] = useState(!!cached);
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    const load = useCallback(function () {
      const SS = window.SimpleSync;
      if (!SS || !SS.fetchBoard) { setErr('kein Server'); return; }
      setBusy(true);
      SS.fetchBoard().then(function (r) {
        setBusy(false);
        if (r && r.ok) { setBoard(r.board); setStale(false); setErr(''); saveCache(r.board); }
        else setErr((r && r.error) || 'Klasse nicht erreichbar');
      });
    }, []);
    useEffect(function () {
      load();
      const t = setInterval(load, 90000);          // still im Hintergrund auffrischen
      const vis = function () { if (!document.hidden) load(); };
      document.addEventListener('visibilitychange', vis);
      return function () { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
    }, [load]);
    return { board: board, stale: stale, err: err, busy: busy, reload: load };
  }

  /* ---------------- Zurufe ---------------- */
  function useCheers() {
    const [list, setList] = useState([]);
    useEffect(function () {
      const SS = window.SimpleSync;
      if (!SS || !SS.fetchCheers) return undefined;
      let alive = true;
      const pull = function () {
        SS.fetchCheers(false).then(function (r) { if (alive) setList((r && r.cheers) || []); });
      };
      pull();
      const t = setInterval(pull, 60000);
      return function () { alive = false; clearInterval(t); };
    }, []);
    return list;
  }
  function seenIds() { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch (e) { return []; } }
  function markSeen(list) {
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(list.map(function (c) { return c.from + ':' + c.ts; }).slice(-60))); } catch (e) {}
  }

  /* Kleine Karte für die Startseite: „3 Mitschüler feuern dich an!" */
  function CheerBanner({ ctx }) {
    const cheers = useCheers();
    const [open, setOpen] = useState(false);
    if (!cheers.length) return null;
    const seen = seenIds();
    const neu = cheers.filter(function (c) { return seen.indexOf(c.from + ':' + c.ts) < 0; });
    const froms = [];
    cheers.forEach(function (c) { if (froms.indexOf(c.from) < 0) froms.push(c.from); });
    return (
      <div className="card cb-cheerbanner" style={{ padding: 16, marginTop: 14 }}
           onClick={function () { setOpen(function (o) { return !o; }); markSeen(cheers); }}>
        <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 30 }}>{cheers[cheers.length - 1].kind || '💪'}</div>
          <div style={{ flex: '1 1 200px' }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>
              {neu.length > 0 ? '🔔 ' : ''}
              {froms.length === 1 ? froms[0] + ' feuert dich an!' : froms.slice(0, 3).join(', ') + (froms.length > 3 ? ' und ' + (froms.length - 3) + ' weitere' : '') + ' feuern dich an!'}
            </div>
            <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
              {open ? 'Antippen zum Zuklappen.' : 'Antippen und alle Zurufe ansehen.'}
            </div>
          </div>
          {ctx && <button className="btn btn-ghost" onClick={function (e) { e.stopPropagation(); ctx.go('progress'); }}>Zur Klasse</button>}
        </div>
        {open && (
          <div className="cb-cheerlist">
            {cheers.slice().reverse().slice(0, 12).map(function (c, i) {
              const kind = KINDS.filter(function (k) { return k.k === c.kind; })[0];
              return <div key={i} className="cb-cheerrow"><span>{c.kind}</span> <b>{c.from}</b> <em>{kind ? kind.t : ''}</em></div>;
            })}
          </div>
        )}
      </div>
    );
  }

  /* ---------------- Die große Klassen-Karte (Fortschrittsseite) ---------------- */
  function ClassCard({ ctx }) {
    const { board, stale, err, busy, reload } = useBoard();
    const cheers = useCheers();
    const [tab, setTab] = useState('woche');       // woche | auswendig
    const [pick, setPick] = useState(null);        // wen feuere ich gerade an?
    const [sent, setSent] = useState({});
    const acc = (window.SimpleSync && window.SimpleSync.account()) || null;
    const myName = acc ? acc.name : '';

    if (!acc) {
      return (
        <div className="card" style={{ padding: 18 }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 20 }}>🤝 Unsere Klasse</h2>
          <div className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>
            Melde dich mit deinem Namen an — dann siehst du hier, wie weit deine Mitschüler sind,
            und ihr könnt euch gegenseitig anfeuern.
          </div>
          <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={function () { ctx.openModal('auth'); }}>Mit Namen anmelden</button>
        </div>
      );
    }

    const list = (board || []).filter(function (b) { return !b.teacher; });
    const meRow = list.filter(function (b) { return b.n === myName; })[0] || null;
    const byWeek = list.slice().sort(function (a, b) { return b.w7 - a.w7 || b.xp - a.xp; });
    const byTotal = list.slice().sort(function (a, b) { return b.xp - a.xp || b.w7 - a.w7; });
    const byHifz = list.slice().sort(function (a, b) { return b.hzd - a.hzd || b.hzv - a.hzv || b.xp - a.xp; });
    const rows = tab === 'woche' ? byWeek : tab === 'gesamt' ? byTotal : byHifz;
    const myPos = byWeek.map(function (b) { return b.n; }).indexOf(myName);

    /* Klassenziel: was haben alle zusammen geschafft? */
    const totalSuren = list.reduce(function (n, b) { return n + (b.hzd || 0); }, 0);
    const totalWeek = list.reduce(function (n, b) { return n + (b.w7 || 0); }, 0);
    const surenZiel = Math.max(10, Math.ceil((totalSuren + 1) / 10) * 10);
    const wochenZiel = Math.max(1000, Math.ceil((totalWeek + 1) / 1000) * 1000);

    /* Wer ist direkt vor mir? Das ist der stärkste Ansporn — und immer erreichbar. */
    const vorMir = (myPos > 0) ? byWeek[myPos - 1] : null;
    const hinterMir = (myPos >= 0 && myPos + 1 < byWeek.length) ? byWeek[myPos + 1] : null;

    function cheer(name, kind) {
      if (!window.SimpleSync || !window.SimpleSync.sendCheer) return;
      setSent(function (s) { const o = Object.assign({}, s); o[name] = kind; return o; });
      try { if (window.Sound) window.Sound.correct(); } catch (e) {}
      window.SimpleSync.sendCheer(name, kind).then(function (r) {
        if (r && r.limited) setSent(function (s) { const o = Object.assign({}, s); o[name] = 'limit'; return o; });
      });
      setPick(null);
    }

    return (
      <div className="card" style={{ padding: 18 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 8, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>🤝 Unsere Klasse</h2>
          <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 12.5 }} onClick={reload}>
            {busy ? '… lädt' : '🔄 Auffrischen'}
          </button>
        </div>

        {cheers.length > 0 && (
          <div className="cb-inbox">
            <b>{cheers[cheers.length - 1].kind} Du wirst angefeuert!</b>{' '}
            {(function () {
              const f = []; cheers.forEach(function (c) { if (f.indexOf(c.from) < 0) f.push(c.from); });
              return f.slice(0, 4).join(', ') + (f.length > 4 ? ' und ' + (f.length - 4) + ' weitere' : '');
            })()} {cheers.length === 1 ? 'denkt' : 'denken'} an dich.
          </div>
        )}

        {err && !board && (
          <div className="muted" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
            Die Klassenliste ist gerade nicht erreichbar ({err}). Dein eigener Fortschritt ist davon nicht betroffen —
            sobald wieder Internet da ist, erscheint sie von selbst.
          </div>
        )}
        {stale && board && <div className="cb-stale">Zuletzt gespeicherter Stand — wird gerade aufgefrischt …</div>}

        {board && list.length === 0 && (
          <div className="muted" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
            Noch ist niemand sonst da. Sobald deine Mitschüler ihren Namen eingeben, stehen sie hier.
          </div>
        )}

        {board && list.length > 0 && (
          <>
            {/* 1) Gemeinsames Ziel */}
            <div className="cb-goal">
              <div className="cb-goal-head">🎯 Das schafft ihr zusammen</div>
              <div className="cb-goal-row">
                <span>🏆 {totalSuren} von {surenZiel} Suren auswendig</span>
                <span className="muted">{list.length} {list.length === 1 ? 'Kind' : 'Kinder'}</span>
              </div>
              <div className="xp-bar"><div className="fill" style={{ width: Math.min(100, Math.round(100 * totalSuren / surenZiel)) + '%' }}/></div>
              <div className="cb-goal-row" style={{ marginTop: 8 }}>
                <span>🔥 {totalWeek} von {wochenZiel} XP diese Woche</span>
              </div>
              <div className="xp-bar"><div className="fill" style={{ width: Math.min(100, Math.round(100 * totalWeek / wochenZiel)) + '%' }}/></div>
            </div>

            {/* 2) Persönlicher Ansporn */}
            {meRow && (vorMir || hinterMir) && (
              <div className="cb-nudge">
                {vorMir
                  ? <>👀 <b>{vorMir.n}</b> ist diese Woche nur <b>{Math.max(1, vorMir.w7 - meRow.w7)} XP</b> vor dir — eine Runde, und du bist vorbei!</>
                  : <>🥇 Du führst diese Woche! <b>{hinterMir.n}</b> ist dir {Math.max(1, meRow.w7 - hinterMir.w7)} XP auf den Fersen.</>}
              </div>
            )}

            {/* 3) Tafeln */}
            <div className="sur-tabs" style={{ margin: '12px 0 8px' }}>
              <button className={'sur-tab' + (tab === 'woche' ? ' is-active' : '')} onClick={function () { setTab('woche'); }}>🔥 Diese Woche</button>
              <button className={'sur-tab' + (tab === 'gesamt' ? ' is-active' : '')} onClick={function () { setTab('gesamt'); }}>⭐ Gesamt</button>
              <button className={'sur-tab' + (tab === 'auswendig' ? ' is-active' : '')} onClick={function () { setTab('auswendig'); }}>🏆 Auswendig</button>
            </div>

            <div className="cb-list">
              {rows.slice(0, 25).map(function (b, i) {
                const mine = b.n === myName;
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) + '.';
                return (
                  <div key={b.n} className={'cb-row' + (mine ? ' is-me' : '')}>
                    <span className="cb-rank">{medal}</span>
                    <span className="cb-name">{b.n}{mine ? ' (du)' : ''}</span>
                    <span className="cb-val">
                      {tab === 'woche'
                        ? <>{b.w7} XP {b.streak > 0 ? <em>🔥{b.streak}</em> : null}</>
                        : tab === 'gesamt'
                        ? <>{b.xp} XP <em>Level {b.lvl}</em></>
                        : <>{b.hzd} 🏆 <em>{b.hzv} Verse</em></>}
                    </span>
                    {!mine && (
                      sent[b.n]
                        ? <span className="cb-sent">{sent[b.n] === 'limit' ? 'genug für heute 🙂' : sent[b.n] + ' gesendet'}</span>
                        : <button className="cb-cheer" title={'\u201E' + b.n + '\u201C anfeuern'}
                                  onClick={function () { setPick(pick === b.n ? null : b.n); }}>💪<span>Anfeuern</span></button>
                    )}
                    {pick === b.n && (
                      <div className="cb-picker">
                        {KINDS.map(function (k) {
                          return <button key={k.k} className="cb-pick" title={k.t} onClick={function () { cheer(b.n, k.k); }}>{k.k}<em>{k.t}</em></button>;
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="muted" style={{ fontSize: 12, marginTop: 10, lineHeight: 1.6 }}>
              Die Wochen-Tafel zählt nur die letzten 7 Tage — wer neu dazukommt, kann sofort vorne mitspielen.
              Unter ⭐ Gesamt zählen alle Punkte seit dem ersten Tag; dort geht nie etwas verloren.
              Anfeuern geht dreimal am Tag pro Mitschüler, und es sind nur diese vier Zeichen möglich.
            </div>
          </>
        )}
      </div>
    );
  }

  window.ClassBoard = { ClassCard: ClassCard, CheerBanner: CheerBanner, KINDS: KINDS };
})();
