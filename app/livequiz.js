/* global React, Icon, AnimalAvatar */
const { useState: useStateLQ, useEffect: useEffectLQ, useRef: useRefLQ } = React;

/* ==============================================================
   Live-Quiz-Modus ("Gizmo Live", Roadmap-Punkt 12) — echte Echtzeit-
   Synchronisation über Supabase Realtime statt Polling: der Host
   schreibt current_idx/status auf quiz_rooms, Supabase pusht die
   Änderung sofort an alle Clients, die auf den Raum subscribt sind.

   Umfang v1 (bewusst begrenzt, siehe README):
   - Nur Multiple-Choice-Fragen (die 203 "Prüfung"-getaggten mit echten
     Optionen) — die offenen Abruf-Karten passen nicht zu einem
     Live-Wettkampfformat mit Punkten.
   - Der Host steuert das Tempo manuell ("Nächste Frage"), kein Timer.
   - Kein Reconnect-Handling nach Seiten-Reload in dieser Version.
   ============================================================== */

function makeRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne verwechselbare Zeichen (I/O/0/1)
  let out = '';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function pickRandom(arr, n) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

/* ==============================================================
   "Beliebiges Thema" — KI generiert spontan ein Live-Quiz zu einem frei
   eingegebenen Thema statt zu einem eigenen Stapel (Blueprint Phase 2).
   Braucht KEINE neue Netlify Function: nutzt denselben generischen
   Prompt-Endpunkt (/.netlify/functions/tutor) wie der KI-Tutor und
   app/aigen.js, nur mit einem anderen Prompt. Ohne Backend (z.B. in der
   Standalone-Vorschau ohne Server) schlägt das mit einer klaren
   Fehlermeldung fehl, statt stillschweigend nichts zu tun.
   ============================================================== */
function buildFreeTopicPrompt(topic, count) {
  return (
    'Du erzeugst ein Multiple-Choice-Quiz auf Deutsch zum Thema "' + topic + '" ' +
    'für eine Quiz-App (Freunde spielen gegeneinander, es zählt Allgemeinwissen zu diesem Thema). ' +
    'Erzeuge genau ' + count + ' Fragen. Jede Frage hat GENAU 4 Antwortoptionen, davon GENAU EINE richtig. ' +
    'Antworten sind kurz (max. 90 Zeichen). Keine Trick- oder Fangfragen, klare eindeutige Fakten. ' +
    'Antworte AUSSCHLIESSLICH mit einem JSON-Array, ohne Markdown, ohne Erklärungen. Format je Element:\n' +
    '{"q":"<Frage>","options":[{"t":"<Text>","c":true|false}, ... genau 4 Stück]}'
  );
}

function validateFreeTopicQuestions(raw, count) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  raw.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const q = typeof entry.q === 'string' ? entry.q.trim() : '';
    const opts = Array.isArray(entry.options) ? entry.options : [];
    if (!q || q.length > 220 || opts.length !== 4) return;
    const clean = opts.map((o) => ({
      t: (o && typeof o.t === 'string') ? o.t.trim().replace(/\s+/g, ' ') : '',
      c: !!(o && o.c === true),
    }));
    if (clean.some((o) => !o.t || o.t.length > 90)) return;
    const correctCount = clean.filter((o) => o.c).length;
    if (correctCount !== 1) return;
    const uniq = new Set(clean.map((o) => o.t.toLowerCase()));
    if (uniq.size !== 4) return; // Optionen müssen sich unterscheiden
    out.push({ q, options: clean });
  });
  return out.slice(0, count);
}

async function generateFreeTopicQuestions(topic, count) {
  const r = await fetch('/.netlify/functions/tutor', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: buildFreeTopicPrompt(topic, count), model: 'gemini-2.5-flash' }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || (j && j.error)) {
    throw new Error((j && j.error) || ('KI-Backend antwortete mit ' + r.status));
  }
  let text = (j && j.text) || '';
  text = text.replace(/```json/gi, '```').split('```').join('').trim();
  const s = text.indexOf('['), e = text.lastIndexOf(']');
  if (s < 0 || e <= s) throw new Error('Die KI hat kein verwertbares JSON geliefert.');
  const arr = JSON.parse(text.slice(s, e + 1));
  const valid = validateFreeTopicQuestions(arr, count);
  if (valid.length < 5) throw new Error('Zu wenige brauchbare Fragen generiert (' + valid.length + '). Versuch ein etwas allgemeineres Thema.');
  return valid;
}

/* ============== LOBBY: Raum erstellen ODER per Code beitreten ============== */
function LiveLobbyReal({ ctx }) {
  const { session, profile, topics } = ctx;
  const [stage, setStage] = useStateLQ('choose'); // choose | create | join | ai
  const [topicId, setTopicId] = useStateLQ((topics && topics[0] && topics[0].id) || '');
  const [code, setCode] = useStateLQ('');
  const [freeTopic, setFreeTopic] = useStateLQ('');
  const [busy, setBusy] = useStateLQ(false);
  const [err, setErr] = useStateLQ('');
  const [room, setRoom] = useStateLQ(null); // sobald erstellt/beigetreten -> LiveQuizRoom übernimmt

  if (!window.Auth || !window.Auth.isConfigured()) {
    return (
      <div className="page" style={{ maxWidth: 720 }}>
        <h1 style={{ textAlign: 'center' }}>Gizmo Live</h1>
        <div className="card flat tinted" style={{ padding: 20, textAlign: 'center' }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Noch nicht eingerichtet</div>
          <div className="muted">Live-Quiz braucht ein verbundenes Supabase-Projekt (siehe SUPABASE_SETUP.md).</div>
        </div>
      </div>
    );
  }
  if (!session) {
    return (
      <div className="page" style={{ maxWidth: 720 }}>
        <h1 style={{ textAlign: 'center' }}>Gizmo Live</h1>
        <div className="card flat tinted" style={{ padding: 20, textAlign: 'center' }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Erst anmelden</div>
          <div className="muted" style={{ marginBottom: 14 }}>Melde dich an, um ein Live-Quiz zu starten oder beizutreten.</div>
          <button className="btn btn-primary" onClick={() => ctx.openModal('auth')}>Anmelden</button>
        </div>
      </div>
    );
  }

  if (room) return <LiveQuizRoom ctx={ctx} room={room} onLeave={() => setRoom(null)} />;

  const createRoom = async () => {
    setErr(''); setBusy(true);
    try {
      const topic = (topics || []).find(t => t.id === topicId);
      if (!topic) throw new Error('Bitte ein Themengebiet wählen.');
      const all = [];
      topic.topic.blocks.forEach(b => b.quiz.forEach(q => { if (q.options && q.options.length) all.push(q); }));
      if (all.length < 5) throw new Error('Dieses Themengebiet hat zu wenige Multiple-Choice-Fragen für ein Live-Quiz.');
      const questions = pickRandom(all, Math.min(10, all.length));
      const roomCode = makeRoomCode();
      const { data, error } = await window.sb.from('quiz_rooms').insert({
        code: roomCode, host_id: session.user.id, topic_id: topic.id, topic_name: topic.name,
        questions, status: 'lobby', current_idx: 0,
      }).select().single();
      if (error) throw error;
      await window.sb.from('quiz_room_players').insert({
        room_id: data.id, user_id: session.user.id,
        display_name: (profile && profile.username) || 'Host', avatar: (profile && profile.avatar) || '🦔', score: 0,
      });
      setRoom({ ...data, isHost: true });
    } catch (e) { setErr((e && e.message) || 'Raum konnte nicht erstellt werden.'); }
    setBusy(false);
  };

  const joinRoom = async () => {
    setErr(''); setBusy(true);
    try {
      const cleanCode = code.trim().toUpperCase();
      const { data: rows, error } = await window.sb.from('quiz_rooms').select('*').eq('code', cleanCode).limit(1);
      if (error) throw error;
      const found = rows && rows[0];
      if (!found) throw new Error('Kein Raum mit diesem Code gefunden.');
      if (found.status !== 'lobby') throw new Error('Dieser Raum hat schon begonnen oder ist beendet.');
      await window.sb.from('quiz_room_players').upsert({
        room_id: found.id, user_id: session.user.id,
        display_name: (profile && profile.username) || 'Spieler', avatar: (profile && profile.avatar) || '🦔', score: 0,
      });
      setRoom({ ...found, isHost: found.host_id === session.user.id });
    } catch (e) { setErr((e && e.message) || 'Beitritt fehlgeschlagen.'); }
    setBusy(false);
  };

  const createAiRoom = async () => {
    setErr(''); setBusy(true);
    try {
      const topicText = freeTopic.trim();
      if (!topicText) throw new Error('Bitte ein Thema eingeben.');
      if (topicText.length > 120) throw new Error('Thema bitte etwas kürzer fassen (max. 120 Zeichen).');
      const questions = await generateFreeTopicQuestions(topicText, 10);
      const roomCode = makeRoomCode();
      const { data, error } = await window.sb.from('quiz_rooms').insert({
        code: roomCode, host_id: session.user.id, topic_id: 'ai:' + topicText.toLowerCase().slice(0, 60),
        topic_name: '✨ ' + topicText, questions, status: 'lobby', current_idx: 0,
      }).select().single();
      if (error) throw error;
      await window.sb.from('quiz_room_players').insert({
        room_id: data.id, user_id: session.user.id,
        display_name: (profile && profile.username) || 'Host', avatar: (profile && profile.avatar) || '🦔', score: 0,
      });
      if (window.AIHistory) window.AIHistory.log({ type: 'chat', title: topicText, subtitle: 'Live · Beliebiges Thema' });
      setRoom({ ...data, isHost: true });
    } catch (e) { setErr((e && e.message) || 'Quiz konnte nicht erstellt werden.'); }
    setBusy(false);
  };

  if (stage === 'create') {
    return (
      <div className="page" style={{ maxWidth: 640 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button className="icon-btn" onClick={() => setStage('choose')}><Icon.Back /></button>
          <h1 style={{ fontSize: 22 }}>Raum erstellen</h1>
          <div style={{ width: 34 }} />
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Themengebiet</div>
          <select value={topicId} onChange={e => setTopicId(e.target.value)}
                  style={{ width: '100%', padding: 14, borderRadius: 14, border: '1px solid var(--line)', background: 'var(--surface)', fontSize: 15 }}>
            {(topics || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <div className="muted" style={{ marginTop: 10, fontSize: 13 }}>
            Es werden 10 zufällige Multiple-Choice-Fragen aus diesem Themengebiet gezogen.
          </div>
          {err && <div style={{ color: 'var(--rose)', fontWeight: 600, marginTop: 10 }}>{err}</div>}
          <button className="btn btn-primary btn-full btn-lg" style={{ marginTop: 16 }} disabled={busy} onClick={createRoom}>
            {busy ? 'Einen Moment…' : 'Raum erstellen'}
          </button>
        </div>
      </div>
    );
  }
  if (stage === 'join') {
    return (
      <div className="page" style={{ maxWidth: 640 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button className="icon-btn" onClick={() => setStage('choose')}><Icon.Back /></button>
          <h1 style={{ fontSize: 22 }}>Mit Code beitreten</h1>
          <div style={{ width: 34 }} />
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Raumcode</div>
          <input value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => e.key === 'Enter' && joinRoom()}
                 placeholder="z. B. K3P9QZ" style={{ width: '100%', padding: 14, fontSize: 22, textAlign: 'center', letterSpacing: '0.1em', fontFamily: 'Geist Mono, monospace', borderRadius: 14, border: '1px solid var(--line)', background: 'var(--surface)' }} />
          {err && <div style={{ color: 'var(--rose)', fontWeight: 600, marginTop: 10 }}>{err}</div>}
          <button className="btn btn-primary btn-full btn-lg" style={{ marginTop: 16 }} disabled={busy} onClick={joinRoom}>
            {busy ? 'Einen Moment…' : 'Beitreten'}
          </button>
        </div>
      </div>
    );
  }
  if (stage === 'ai') {
    return (
      <div className="page" style={{ maxWidth: 640 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button className="icon-btn" onClick={() => setStage('choose')}><Icon.Back /></button>
          <h1 style={{ fontSize: 22 }}>Beliebiges Thema</h1>
          <div style={{ width: 34 }} />
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Worüber soll das Quiz gehen?</div>
          <input value={freeTopic} onChange={e => setFreeTopic(e.target.value)} onKeyDown={e => e.key === 'Enter' && !busy && createAiRoom()}
                 placeholder="z. B. Fußball-Weltmeisterschaften, Weltraum, 90er-Jahre..." maxLength={120}
                 style={{ width: '100%', padding: 14, fontSize: 15, borderRadius: 14, border: '1px solid var(--line)', background: 'var(--surface)' }} />
          <div className="muted" style={{ marginTop: 10, fontSize: 13 }}>
            Die KI generiert 10 Multiple-Choice-Fragen zu diesem Thema — funktioniert zu praktisch
            jedem Thema, nicht nur §34a. Braucht das KI-Tutor-Backend (Netlify Function); ohne
            eigenen Server (z. B. in einer reinen Vorschau-Datei) nicht verfügbar.
          </div>
          {err && <div style={{ color: 'var(--rose)', fontWeight: 600, marginTop: 10 }}>{err}</div>}
          <button className="btn btn-primary btn-full btn-lg" style={{ marginTop: 16 }} disabled={busy} onClick={createAiRoom}>
            {busy ? 'Quiz wird erstellt…' : 'Quiz erstellen'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <h1 style={{ textAlign: 'center' }}>Gizmo Live</h1>
      <div className="muted center">Spiel mit deinen Freunden — in Echtzeit</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginTop: 8 }}>
        <button className="mode-card" onClick={() => setStage('create')} style={{ padding: 26 }}>
          <div style={{ fontSize: 40 }}>📚</div>
          <div className="mode-ttl">Raum erstellen</div>
          <div className="mode-sub">Aus einem Themengebiet, du bist Host</div>
        </button>
        <button className="mode-card" onClick={() => setStage('join')} style={{ padding: 26 }}>
          <div style={{ fontSize: 40 }}>🔢</div>
          <div className="mode-ttl">Mit Code beitreten</div>
          <div className="mode-sub">Tritt einem laufenden Raum bei</div>
        </button>
        <button className="mode-card" onClick={() => setStage('ai')} style={{ padding: 26 }}>
          <div style={{ fontSize: 40 }}>✨</div>
          <div className="mode-ttl">Beliebiges Thema</div>
          <div className="mode-sub">KI erstellt ein Quiz zu allem</div>
        </button>
      </div>
    </div>
  );
}

/* ============== EIN RAUM: Lobby-Warteraum → Spiel → Ergebnisse ============== */
function LiveQuizRoom({ ctx, room: initialRoom, onLeave }) {
  const { session, profile } = ctx;
  const [room, setRoom] = useStateLQ(initialRoom);
  const [players, setPlayers] = useStateLQ([]);
  const [myAnswerIdx, setMyAnswerIdx] = useStateLQ(null); // Antwort auf die aktuelle Frage
  const channelRef = useRefLQ(null);

  const refreshPlayers = async () => {
    const { data } = await window.sb.from('quiz_room_players').select('*').eq('room_id', room.id).order('score', { ascending: false });
    setPlayers(data || []);
  };

  useEffectLQ(() => {
    refreshPlayers();
    const ch = window.sb.channel('room-' + room.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_rooms', filter: `id=eq.${room.id}` },
        (payload) => { setRoom(r => ({ ...r, ...payload.new })); setMyAnswerIdx(null); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_room_players', filter: `room_id=eq.${room.id}` },
        () => { refreshPlayers(); })
      .subscribe();
    channelRef.current = ch;
    return () => { window.sb.removeChannel(ch); };
  }, [room.id]);

  const isHost = room.host_id === session.user.id;
  const questions = room.questions || [];
  const current = questions[room.current_idx];

  const startGame = async () => { await window.sb.from('quiz_rooms').update({ status: 'playing', current_idx: 0 }).eq('id', room.id); };
  const nextQuestion = async () => {
    const nextIdx = room.current_idx + 1;
    if (nextIdx >= questions.length) await window.sb.from('quiz_rooms').update({ status: 'finished' }).eq('id', room.id);
    else await window.sb.from('quiz_rooms').update({ current_idx: nextIdx }).eq('id', room.id);
  };
  const leave = () => { if (channelRef.current) window.sb.removeChannel(channelRef.current); onLeave(); };

  const answer = async (idx) => {
    if (myAnswerIdx !== null || !current) return;
    setMyAnswerIdx(idx);
    const correct = !!(current.options[idx] && current.options[idx].c);
    try {
      await window.sb.from('quiz_room_answers').insert({ room_id: room.id, user_id: session.user.id, question_idx: room.current_idx, correct });
      if (correct) {
        const me = players.find(p => p.user_id === session.user.id);
        await window.sb.from('quiz_room_players').update({ score: (me ? me.score : 0) + 100 }).eq('room_id', room.id).eq('user_id', session.user.id);
      }
    } catch (e) { console.warn('[livequiz] Antwort konnte nicht gespeichert werden:', e && e.message); }
  };

  if (room.status === 'lobby') {
    return (
      <div className="page" style={{ maxWidth: 720 }}>
        <h1 style={{ textAlign: 'center' }}>{room.topic_name}</h1>
        <div className="code-card">
          <div>
            <div style={{ color: 'var(--ink-mute)', fontWeight: 800, fontSize: 14 }}>Raumcode</div>
            <div className="code">{room.code}</div>
            <div className="muted">Andere geben diesen Code beim Beitreten ein</div>
          </div>
          <div className="qr" />
        </div>
        <LobbyInviteRow code={room.code} />
        <div style={{ fontWeight: 800, marginTop: 8 }}>Mitspieler ({players.length})</div>
        <div className="col">
          {players.map(p => (
            <div key={p.user_id} className="card flat" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 14 }}>
              <div style={{ fontSize: 26 }}>{p.avatar}</div>
              <div style={{ flex: 1, fontWeight: 700 }}>{p.display_name}{p.user_id === room.host_id ? ' · Host' : ''}</div>
            </div>
          ))}
        </div>
        {isHost ? (
          <button className="btn btn-primary btn-full btn-lg" onClick={startGame}>Spiel starten</button>
        ) : (
          <div className="muted center">Warte, bis der Host das Spiel startet…</div>
        )}
        <button className="btn btn-ghost btn-full" onClick={leave}>Raum verlassen</button>
      </div>
    );
  }

  if (room.status === 'finished') {
    const sorted = players.slice().sort((a, b) => b.score - a.score);
    return (
      <div className="page" style={{ maxWidth: 720 }}>
        <h1 style={{ textAlign: 'center' }}>Ergebnisse</h1>
        <div className="col">
          {sorted.map((p, i) => (
            <div key={p.user_id} className="card flat" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 14 }}>
              {i < 3 ? <div className={'medal ' + (i === 1 ? 'silver' : i === 2 ? 'bronze' : '')}>{i + 1}</div> : <div style={{ width: 28, textAlign: 'center', fontWeight: 800 }}>{i + 1}</div>}
              <div style={{ fontSize: 26 }}>{p.avatar}</div>
              <div style={{ flex: 1, fontWeight: 700 }}>{p.display_name}</div>
              <span className="xp-pill">{p.score} Punkte</span>
            </div>
          ))}
        </div>
        <button className="btn btn-primary btn-full btn-lg" onClick={leave}>Fertig</button>
      </div>
    );
  }

  // status === 'playing'
  if (!current) return null;
  return (
    <div className="quiz-shell">
      <div className="quiz-topbar">
        <button className="icon-btn" onClick={leave}><Icon.Close /></button>
        <div className="quiz-stack">{room.topic_name} <span className="muted" style={{ fontWeight: 600 }}>· {room.current_idx + 1}/{questions.length}</span></div>
        <div style={{ width: 30 }} />
      </div>
      <div className="quiz-stage">
        <div className="stage-inner">
          <div className="question-card"><div className={'qtext' + (window.QuranCourse && window.QuranCourse.isArabicHeavy(current.q) ? ' qtext-arabic' : '')}>{current.q}</div></div>
          <div className="options">
            {current.options.map((o, i) => {
              let cls = 'option';
              if (myAnswerIdx !== null) {
                if (o.c) cls += ' is-correct';
                else if (i === myAnswerIdx) cls += ' is-wrong';
                else cls += ' is-disabled';
              }
              return <button key={i} className={cls} onClick={() => answer(i)}>{o.t}</button>;
            })}
          </div>
          {myAnswerIdx !== null && <div className="muted center">Warte auf die anderen Spieler…</div>}
          <div style={{ fontWeight: 800, marginTop: 8 }}>Punktestand</div>
          {players.slice().sort((a, b) => b.score - a.score).map(p => (
            <div key={p.user_id} className="row" style={{ justifyContent: 'space-between', padding: '6px 4px' }}>
              <span>{p.avatar} {p.display_name}</span><span style={{ fontWeight: 800 }}>{p.score}</span>
            </div>
          ))}
          {isHost && (
            <button className="btn btn-primary btn-full btn-lg" onClick={nextQuestion}>
              {room.current_idx + 1 < questions.length ? 'Nächste Frage' : 'Spiel beenden'} <Icon.Arrow />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* "Freunde einladen"-Zeile im Lobby-Warteraum (Parity-Checkliste Abschnitt 10,
   20.07.2026 nachgezogen): Code kopieren + direkt per WhatsApp/Telegram teilen. */
function LobbyInviteRow({ code }) {
  const [copied, setCopied] = useStateLQ(false);
  const text = 'Spiel mit mir ein §34a-Live-Quiz! Raumcode: ' + code;
  const copy = () => {
    try { navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }, () => {}); } catch (e) {}
  };
  return (
    <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
      <button className="btn btn-ghost" onClick={copy}>{copied ? 'Kopiert ✅' : '📋 Code kopieren'}</button>
      <a className="btn btn-ghost" href={'https://wa.me/?text=' + encodeURIComponent(text)} target="_blank" rel="noopener noreferrer">WhatsApp</a>
      <a className="btn btn-ghost" href={'https://t.me/share/url?url=' + encodeURIComponent(location.origin + location.pathname) + '&text=' + encodeURIComponent(text)} target="_blank" rel="noopener noreferrer">Telegram</a>
    </div>
  );
}

window.LiveLobbyReal = LiveLobbyReal;
