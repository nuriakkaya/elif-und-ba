/* global React */
/* ==============================================================
   ⚔️ LIVE-DUELL (09.08.2026)

   Zwei (oder bis zu sechs) Kinder spielen dieselben Fragen
   gleichzeitig gegeneinander. Läuft komplett über den eigenen
   Mini-Server — kein Supabase, keine Anmeldung, kein Zusatzkonto.

   Ablauf: Kind A tippt einen Mitschüler an → Einladung erscheint
   bei Kind B → beide sehen dieselbe Frage, wer schneller richtig
   ist, bekommt mehr Punkte. Ersatzweg ohne Namen: ein 4-Zeichen-Code.

   Technisch bewusst schlicht: die Geräte fragen den Raum im
   Sekundentakt ab. Das ist robust, funktioniert hinter jedem
   Schul-WLAN und braucht keine Dauerverbindung.
   ============================================================== */
(function () {
  const PER_Q = 15000;

  /* ---------- Fragen bauen (aus den Kursdaten) ---------- */
  function buildQuestions(topic, n) {
    const pool = [];
    (topic.blocks || []).forEach(b => (b.quiz || []).forEach(q => {
      if (q && q.q && q.a) pool.push({ q: q.q, a: q.a });
    }));
    if (pool.length < 4) return [];
    const shuffled = pool.slice().sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, Math.min(n || 8, pool.length));
    return picked.map(item => {
      const wrong = pool.filter(x => x.a !== item.a).sort(() => Math.random() - 0.5).slice(0, 3).map(x => x.a);
      const opts = [item.a].concat(wrong).sort(() => Math.random() - 0.5);
      return { q: item.q, a: item.a, opts };
    });
  }

  /* ---------- Server-Aufrufe ---------- */
  const SS = () => window.SimpleSync;
  async function post(body) {
    const r = await SS().req('duel', { method: 'POST', body: JSON.stringify(body) });
    return r.body || {};
  }
  async function getRoom(code) {
    const r = await SS().req('duel', { query: { code } });
    return r.body || {};
  }
  async function getInvites(name) {
    try {
      const r = await SS().req('duel', { query: { inv: name } });
      return (r.body && r.body.invites) || [];
    } catch (e) { return []; }
  }

  window.Duel = { buildQuestions, post, getRoom, getInvites, PER_Q };

  /* ==============================================================
     Einladungs-Wecker: prüft im Hintergrund, ob jemand herausfordert
     ============================================================== */
  let invites = [];
  const invListeners = [];
  const emitInv = () => invListeners.forEach(f => { try { f(invites); } catch (e) {} });
  async function pollInvites() {
    const acc = SS() && SS().account();
    if (!acc || !acc.key || document.visibilityState === 'hidden') return;
    const list = await getInvites(acc.name);
    if (JSON.stringify(list) !== JSON.stringify(invites)) {
      const isNew = list.length > invites.length;
      invites = list;
      emitInv();
      if (isNew) { try { window.Sound && window.Sound.streakSecured && window.Sound.streakSecured(); } catch (e) {} }
    }
  }
  setTimeout(pollInvites, 4000);
  setInterval(pollInvites, 45000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pollInvites(); });
  window.DuelInvites = {
    list: () => invites,
    refresh: pollInvites,
    clear: (code) => { invites = invites.filter(i => i.code !== code); emitInv(); },
    onChange: (fn) => { invListeners.push(fn); return () => { const i = invListeners.indexOf(fn); if (i >= 0) invListeners.splice(i, 1); }; },
  };
})();

/* ==============================================================
   Bildschirm
   ============================================================== */
function DuelScreen({ ctx }) {
  const SS = window.SimpleSync;
  const acc = SS && SS.account();
  const [view, setView] = React.useState('start');   // start | warten | spiel | ende
  const [room, setRoom] = React.useState(null);
  const [mates, setMates] = React.useState([]);
  const [topicId, setTopicId] = React.useState(null);
  const [joinCode, setJoinCode] = React.useState('');
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [now, setNow] = React.useState(Date.now());
  const [picked, setPicked] = React.useState(null);
  const [invites, setInvites] = React.useState(window.DuelInvites ? window.DuelInvites.list() : []);
  const codeRef = React.useRef(null);

  const topics = (window.QURAN_TOPICS || []).filter(t => (t.blocks || []).some(b => (b.quiz || []).length >= 4));

  React.useEffect(() => {
    if (!topicId && topics.length) setTopicId(topics[0].id);
  }, [topics.length]);

  React.useEffect(() => {
    if (SS && SS.listNames && acc) SS.listNames().then(l => setMates((l || []).filter(x => x.name !== acc.name)));
  }, []);

  React.useEffect(() => window.DuelInvites && window.DuelInvites.onChange(setInvites), []);

  // Uhr für die Zeitleiste
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  // Raum im Sekundentakt abfragen
  React.useEffect(() => {
    if (!room || view === 'start') return;
    let dead = false;
    const tick = async () => {
      if (dead) return;
      try {
        const r = await window.Duel.getRoom(room.code);
        if (r && r.room && !dead) {
          setRoom(r.room);
          if (r.room.state === 'run' && view !== 'spiel') setView('spiel');
          if (r.room.state === 'done' && view !== 'ende') {
            setView('ende');
            try { window.Sound && window.Sound.roundEnd && window.Sound.roundEnd(); } catch (e) {}
          }
        }
      } catch (e) {}
    };
    const iv = setInterval(tick, view === 'spiel' ? 1200 : 2000);
    tick();
    return () => { dead = true; clearInterval(iv); };
  }, [room && room.code, view]);

  // Bei Fragenwechsel Auswahl zurücksetzen
  React.useEffect(() => { setPicked(null); }, [room && room.i]);

  if (!acc || !acc.key) {
    return (
      <div className="page" style={{ maxWidth: 520 }}>
        <div className="card" style={{ padding: 26, textAlign: 'center' }}>
          <div style={{ fontSize: 44 }}>⚔️</div>
          <h1 style={{ fontSize: 22, marginTop: 8 }}>Live-Duell</h1>
          <div className="muted" style={{ marginBottom: 16 }}>
            Melde dich kurz mit deinem Namen an — dann kannst du deine Freunde herausfordern.
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => ctx.openModal('auth')}>Mit Namen anmelden</button>
        </div>
      </div>
    );
  }

  const topic = topics.find(t => t.id === topicId) || topics[0];

  const challenge = async (mateName) => {
    setErr(''); setBusy(true);
    const qs = window.Duel.buildQuestions(topic, 8);
    if (!qs.length) { setBusy(false); setErr('Diese Lektion hat zu wenige Karten fürs Duell.'); return; }
    const r = await window.Duel.post({
      action: 'create', name: acc.name, qs,
      topic: topic.id, topicName: topic.name, invite: mateName || '',
    }).catch(() => ({ error: 'Server nicht erreichbar' }));
    setBusy(false);
    if (r.ok) { setRoom(r.room); setView('warten'); }
    else setErr(r.error || 'Duell konnte nicht gestartet werden.');
  };

  const join = async (code) => {
    setErr(''); setBusy(true);
    const r = await window.Duel.post({ action: 'join', code, name: acc.name }).catch(() => ({ error: 'Server nicht erreichbar' }));
    setBusy(false);
    if (r.ok) {
      window.DuelInvites && window.DuelInvites.clear(code);
      setRoom(r.room);
      setView(r.room.state === 'run' ? 'spiel' : 'warten');
    } else setErr(r.error || 'Beitreten hat nicht geklappt.');
  };

  const start = async () => {
    const r = await window.Duel.post({ action: 'start', code: room.code, name: acc.name }).catch(() => ({}));
    if (r.room) { setRoom(r.room); setView('spiel'); }
  };

  const answer = async (opt) => {
    if (picked !== null || !room || room.state !== 'run') return;
    setPicked(opt);
    const q = room.qs[room.i];
    const correct = opt === q.a;
    try {
      if (correct) window.Sound && window.Sound.correct && window.Sound.correct();
      else window.Sound && window.Sound.wrong && window.Sound.wrong();
    } catch (e) {}
    const ms = window.Duel.PER_Q - Math.max(0, (room.deadline || 0) - Date.now());
    const r = await window.Duel.post({ action: 'answer', code: room.code, name: acc.name, i: room.i, correct, ms }).catch(() => ({}));
    if (r.room) setRoom(r.room);
  };

  const leave = async () => {
    if (room) { try { await window.Duel.post({ action: 'leave', code: room.code, name: acc.name }); } catch (e) {} }
    setRoom(null); setView('start'); setPicked(null);
  };

  const players = room ? Object.keys(room.players || {}).map(n => ({ n, ...room.players[n] })).sort((a, b) => (b.score || 0) - (a.score || 0)) : [];

  /* ---------------- Startbildschirm ---------------- */
  if (view === 'start') {
    return (
      <div className="page" style={{ maxWidth: 620 }}>
        <h1 style={{ margin: 0 }}>⚔️ Live-Duell</h1>
        <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>
          Fordere jemanden aus deiner Klasse heraus — ihr bekommt dieselben Fragen.
          Wer schneller richtig antwortet, bekommt mehr Punkte.
        </div>

        {invites.length > 0 && (
          <div className="card" style={{ padding: 16, marginTop: 14, borderLeft: '5px solid var(--accent, #2A6BE0)' }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>🔔 Du wirst herausgefordert!</div>
            {invites.map(iv => (
              <div key={iv.code} className="row" style={{ gap: 10, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 160px', fontWeight: 700 }}>
                  {iv.from} <span className="muted" style={{ fontWeight: 400 }}>· {iv.topicName || 'Duell'}</span>
                </div>
                <button className="btn btn-primary" disabled={busy} onClick={() => join(iv.code)}>Annehmen</button>
                <button className="btn btn-ghost" onClick={() => {
                  window.Duel.post({ action: 'decline', code: iv.code, name: acc.name }).catch(() => {});
                  window.DuelInvites.clear(iv.code);
                }}>Später</button>
              </div>
            ))}
          </div>
        )}

        <div className="card" style={{ padding: 16, marginTop: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>1. Welche Lektion?</div>
          <select value={topicId || ''} onChange={e => setTopicId(e.target.value)}
                  style={{ width: '100%', padding: '11px 12px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)', font: 'inherit' }}>
            {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 2 }}>2. Wen forderst du heraus?</div>
          <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>
            Tippe einen Namen an. Die Einladung erscheint sofort auf dem anderen Gerät.
          </div>
          {mates.length === 0 && (
            <div className="muted" style={{ fontSize: 13 }}>
              Noch niemand sonst angemeldet. Du kannst trotzdem ein Duell eröffnen und den Code weitergeben.
            </div>
          )}
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {mates.slice(0, 40).map(m => (
              <button key={m.name} className="pill" disabled={busy}
                      style={{ cursor: 'pointer', border: '1px solid var(--line)', background: 'var(--surface)' }}
                      onClick={() => challenge(m.name)}>
                ⚔️ {m.name}
              </button>
            ))}
          </div>
          <button className="btn btn-primary btn-full btn-lg" style={{ marginTop: 12 }} disabled={busy}
                  onClick={() => challenge('')}>
            {busy ? 'Einen Moment…' : '🎲 Duell eröffnen (Code weitergeben)'}
          </button>
        </div>

        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Oder mit Code beitreten</div>
          <div className="row" style={{ gap: 8 }}>
            <input ref={codeRef} value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
                   placeholder="z. B. K7QM" maxLength={4}
                   style={{ flex: 1, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)', font: 'inherit', fontSize: 20, fontWeight: 800, letterSpacing: 4, textAlign: 'center' }} />
            <button className="btn btn-primary" disabled={joinCode.length !== 4 || busy} onClick={() => join(joinCode)}>Beitreten</button>
          </div>
        </div>
        {!!err && <div style={{ color: 'var(--rose, #D64545)', fontWeight: 700, marginTop: 12 }}>{err}</div>}
      </div>
    );
  }

  /* ---------------- Warteraum ---------------- */
  if (view === 'warten' && room) {
    return (
      <div className="page" style={{ maxWidth: 520 }}>
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <div className="muted" style={{ fontSize: 13, fontWeight: 700 }}>{room.topicName}</div>
          <div style={{ fontSize: 13, marginTop: 12 }} className="muted">Dein Duell-Code</div>
          <div style={{ fontSize: 46, fontWeight: 900, letterSpacing: 8, margin: '2px 0 10px' }}>{room.code}</div>
          <div className="muted" style={{ fontSize: 13.5 }}>
            {Object.keys(room.players || {}).length < 2
              ? 'Warte auf deinen Gegner … er muss nur auf „Annehmen" tippen oder den Code eingeben.'
              : 'Alle da! Los geht’s.'}
          </div>
          <div className="row" style={{ gap: 8, justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
            {Object.keys(room.players || {}).map(n => <span key={n} className="pill">🧒 {n}</span>)}
          </div>
          {room.host === acc.name ? (
            <button className="btn btn-primary btn-full btn-lg" style={{ marginTop: 18 }}
                    disabled={Object.keys(room.players || {}).length < 2}
                    onClick={start}>
              {Object.keys(room.players || {}).length < 2 ? 'Warten auf Gegner …' : '▶️ Start!'}
            </button>
          ) : (
            <div className="muted" style={{ marginTop: 18, fontWeight: 700 }}>⏳ {room.host} startet gleich …</div>
          )}
          <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={leave}>Abbrechen</button>
        </div>
      </div>
    );
  }

  /* ---------------- Spiel ---------------- */
  if (view === 'spiel' && room && room.qs && room.qs[room.i]) {
    const q = room.qs[room.i];
    const left = Math.max(0, (room.deadline || 0) - now);
    const pct = Math.max(0, Math.min(100, (left / window.Duel.PER_Q) * 100));
    return (
      <div className="page" style={{ maxWidth: 560 }}>
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {players.map(p => (
            <span key={p.n} className="pill" style={{ fontWeight: 800, background: p.n === acc.name ? 'var(--success-soft, #E7F7EE)' : undefined }}>
              {p.n === acc.name ? '🫵' : '🧒'} {p.n}: {p.score || 0}
            </span>
          ))}
          <span className="pill" style={{ marginLeft: 'auto' }}>Frage {room.i + 1}/{room.qs.length}</span>
        </div>

        <div style={{ height: 8, borderRadius: 999, background: 'var(--line, #eee)', overflow: 'hidden', margin: '12px 0 16px' }}>
          <div style={{ width: pct + '%', height: '100%', background: pct > 33 ? 'var(--success, #1B8A5A)' : 'var(--rose, #D64545)', transition: 'width .2s linear' }} />
        </div>

        <div className="card" style={{ padding: '28px 18px', textAlign: 'center' }}>
          <div dir="rtl" style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.25, fontFamily: '"Amiri Quran", "Scheherazade New", serif' }}>{q.q}</div>
          <button className="btn btn-ghost" style={{ marginTop: 8 }}
                  onClick={() => window.QuranAudio && window.QuranAudio.speakText && window.QuranAudio.speakText(q.q, true)}>🔊 Anhören</button>
        </div>

        <div className="col" style={{ gap: 10, marginTop: 16 }}>
          {q.opts.map(opt => {
            const chosen = picked === opt;
            const reveal = picked !== null;
            const good = opt === q.a;
            return (
              <button key={opt} disabled={picked !== null} onClick={() => answer(opt)}
                      className="btn btn-ghost btn-full btn-lg"
                      style={{
                        justifyContent: 'center', fontSize: 18, fontWeight: 800,
                        borderColor: reveal && good ? 'var(--success, #1B8A5A)' : chosen ? 'var(--rose, #D64545)' : undefined,
                        background: reveal && good ? 'var(--success-soft, #E7F7EE)' : chosen ? 'var(--rose-soft, #FDECEC)' : undefined,
                        opacity: reveal && !good && !chosen ? .5 : 1,
                      }}>
                {opt}
              </button>
            );
          })}
        </div>
        {picked !== null && (
          <div className="muted" style={{ textAlign: 'center', marginTop: 14, fontWeight: 700 }}>
            ⏳ Warte auf den anderen …
          </div>
        )}
      </div>
    );
  }

  /* ---------------- Ergebnis ---------------- */
  if (view === 'ende' && room) {
    const me = players.find(p => p.n === acc.name) || { score: 0 };
    const top = players[0] || {};
    const win = top.n === acc.name && players.length > 1 && (players[1] || {}).score !== top.score;
    const tie = players.length > 1 && (players[1] || {}).score === top.score;
    return (
      <div className="page" style={{ maxWidth: 520 }}>
        <div className="card" style={{ padding: 26, textAlign: 'center' }}>
          <div style={{ fontSize: 54 }}>{tie ? '🤝' : win ? '🏆' : '💪'}</div>
          <h1 style={{ fontSize: 24, marginTop: 6 }}>
            {tie ? 'Unentschieden!' : win ? 'Gewonnen!' : 'Gut gekämpft!'}
          </h1>
          <div className="col" style={{ gap: 8, marginTop: 16 }}>
            {players.map((p, i) => (
              <div key={p.n} className="row" style={{ gap: 10, alignItems: 'center', padding: '10px 14px', borderRadius: 12, background: p.n === acc.name ? 'var(--success-soft, #E7F7EE)' : 'var(--surface)', border: '1px solid var(--line)' }}>
                <span style={{ fontWeight: 900, width: 26 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                <span style={{ fontWeight: 800, flex: 1, textAlign: 'left' }}>{p.n}</span>
                <span style={{ fontWeight: 900 }}>{p.score || 0}</span>
              </div>
            ))}
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 12 }}>
            {me.answered ? Object.values(me.answered).filter(x => x.c).length : 0} von {room.qs.length} richtig
          </div>
          <div className="row" style={{ gap: 10, marginTop: 18 }}>
            <button className="btn btn-primary btn-full" onClick={() => {
              const other = players.find(p => p.n !== acc.name);
              setRoom(null); setView('start');
              setTimeout(() => challenge(other ? other.n : ''), 60);
            }}>🔁 Revanche</button>
            <button className="btn btn-ghost btn-full" onClick={leave}>Fertig</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 520 }}>
      <div className="card" style={{ padding: 24, textAlign: 'center' }}>
        <div className="muted">⏳ Einen Moment …</div>
        <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={leave}>Zurück</button>
      </div>
    </div>
  );
}

window.DuelScreen = DuelScreen;
