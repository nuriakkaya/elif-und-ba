/* global React, Icon */
const { useState: useStateG, useEffect: useEffectG } = React;

/* ==============================================================
   Lerngruppen (Blueprint Phase 9, 20.07.2026). Bei Gizmo live beobachtet:
   Gruppen mit einer täglichen gemeinsamen Quizfrage ("Antworte als
   Erste:r"), Fortschrittsanzeige ("1 Person hat geantwortet") und einem
   eigenen "Quiz starten"-Button pro Gruppe im Fortschritt-Tab und im Profil.

   Beitritt läuft über einen teilbaren 6-stelligen Code (wie
   `quiz_rooms.code` bei Gizmo Live, app/livequiz.js) statt über
   Nutzersuche — hält den Umfang klein.

   Tägliche Gruppen-Quizfrage: bewusst KEINE eigene Fragen-Tabelle — die
   Frage wird clientseitig deterministisch aus dem vorhandenen Fragenpool
   (window.S34A_TOPICS) via Hash(group_id + Tag) ausgewählt, sodass ALLE
   Mitglieder einer Gruppe an einem Tag exakt dieselbe Frage sehen, ohne
   dass sie irgendwo gespeichert werden muss (gleiches Ableitungs-Prinzip
   wie beim Aktivitäts-Feed/den Freundesserien). `study_group_answers`
   speichert nur, WER wann geantwortet hat.
   Bekannte Einschränkung (Review 21.07.2026): der Tages-Key nutzt die
   LOKALE Zeitzone — Mitglieder in verschiedenen Zeitzonen können um
   Mitternacht herum kurzzeitig verschiedene "Tagesfragen" sehen. Für den
   deutschsprachigen §34a-Kontext (eine Zeitzone) bewusst hingenommen;
   eine UTC-Umstellung würde bestehende xp_daily-Tageskeys brechen.
   ============================================================== */

function gDayKey(d) {
  const x = d || new Date();
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
}

// Simple deterministic String-Hash (djb2-Variante) — bewusst kein Crypto-Hash
// nötig, nur "gleiche Eingabe -> gleiche Zahl" für alle Mitglieder.
function gHashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h >>> 0;
}

function gBuildQuestionPool(topics) {
  const pool = [];
  (topics || []).forEach((t) => {
    (t.blocks || []).forEach((b) => {
      (b.quiz || []).forEach((q) => {
        if (q.options && q.options.length) pool.push({ q: q.q, options: q.options, topicName: t.name });
      });
    });
  });
  return pool;
}

// Reine, ohne Supabase testbare Auswahl: liefert für dieselbe (groupId, day)-
// Kombination IMMER dieselbe Frage aus dem Pool.
function gPickDailyQuestion(pool, groupId, day) {
  if (!pool || !pool.length) return null;
  const idx = gHashStr(groupId + '|' + day) % pool.length;
  return pool[idx];
}

function gMakeInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne verwechselbare Zeichen (I/O/0/1)
  let out = '';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/* ---- Supabase-Zugriffe ---- */

async function gCreateGroup(myId, name) {
  const cleanName = (name || '').trim().slice(0, 60);
  if (!cleanName) throw new Error('Bitte einen Namen für die Gruppe eingeben.');
  // (Review 21.07.2026) Bei einer (seltenen) Code-Kollision (unique-Verstoß 23505)
  // wird bis zu 3x ein neuer Code generiert, statt mit DB-Fehler abzubrechen.
  let data = null, lastError = null;
  for (let attempt = 0; attempt < 3 && !data; attempt++) {
    const code = gMakeInviteCode();
    const r = await window.sb.from('study_groups')
      .insert({ name: cleanName, invite_code: code, created_by: myId }).select().single();
    if (!r.error) { data = r.data; break; }
    lastError = r.error;
    if (r.error.code !== '23505') break;
  }
  if (!data) throw lastError || new Error('Gruppe konnte nicht erstellt werden.');
  const { error: memErr } = await window.sb.from('study_group_members').insert({ group_id: data.id, user_id: myId });
  if (memErr) throw memErr;
  return data;
}

async function gJoinGroup(myId, code) {
  const cleanCode = (code || '').trim().toUpperCase();
  if (!cleanCode) throw new Error('Bitte einen Beitrittscode eingeben.');
  const { data: rows, error } = await window.sb.from('study_groups').select('*').eq('invite_code', cleanCode).limit(1);
  if (error) throw error;
  const group = rows && rows[0];
  if (!group) throw new Error('Keine Gruppe mit diesem Code gefunden.');
  // (Review 21.07.2026) ignoreDuplicates: study_group_members hat bewusst keine
  // update-Policy — ein normales upsert wäre beim Re-Beitritt an RLS gescheitert.
  const { error: memErr } = await window.sb.from('study_group_members')
    .upsert({ group_id: group.id, user_id: myId }, { ignoreDuplicates: true });
  if (memErr) throw memErr;
  return group;
}

async function gLeaveGroup(myId, groupId) {
  await window.sb.from('study_group_members').delete().eq('group_id', groupId).eq('user_id', myId);
}

async function gLoadMyGroups(myId) {
  if (!window.sb || !myId) return [];
  const { data: memRows, error } = await window.sb.from('study_group_members').select('group_id').eq('user_id', myId);
  if (error || !memRows || !memRows.length) return [];
  const ids = memRows.map((r) => r.group_id);
  const { data: groups } = await window.sb.from('study_groups').select('*').in('id', ids);
  return (groups || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

async function gMemberCount(groupId) {
  if (!window.sb) return 0;
  const { count } = await window.sb.from('study_group_members').select('user_id', { count: 'exact', head: true }).eq('group_id', groupId);
  return count || 0;
}

async function gLoadDailyAnswers(groupId, day) {
  if (!window.sb) return [];
  const { data } = await window.sb.from('study_group_answers').select('user_id, correct, answered_at')
    .eq('group_id', groupId).eq('day', day).order('answered_at', { ascending: true });
  return data || [];
}

// Speichert die Tagesantwort und benachrichtigt bei der ERSTEN Antwort des
// Tages alle anderen Mitglieder ("Das tägliche Quiz ist bereit für ...") —
// siehe app/notifications.js für die RLS-Begründung: die antwortende Person
// schreibt als Aktor:in in die Inbox der anderen, kein Server-Cron nötig.
async function gSubmitDailyAnswer(myId, groupId, groupName, day, correct) {
  const { error } = await window.sb.from('study_group_answers').insert({ group_id: groupId, day, user_id: myId, correct });
  if (error) {
    if (error.code === '23505') return { ok: false, reason: 'already' }; // unique-Verstoß: heute schon geantwortet
    throw error;
  }
  try {
    // (Review 21.07.2026) "Erste:r"-Bestimmung über die früheste answered_at-Zeile
    // statt über einen Count — antworten zwei Mitglieder fast gleichzeitig, sah
    // vorher jede:r nur die eigene Zeile (Count=1) und BEIDE hätten die komplette
    // Benachrichtigungs-Schleife an alle Mitglieder ausgelöst (doppelte Inserts).
    const { data: firstRow } = await window.sb.from('study_group_answers')
      .select('user_id').eq('group_id', groupId).eq('day', day)
      .order('answered_at', { ascending: true }).limit(1).maybeSingle();
    const isFirst = firstRow && firstRow.user_id === myId;
    if (isFirst && window.Notifications) {
      const { data: members } = await window.sb.from('study_group_members').select('user_id').eq('group_id', groupId);
      const others = (members || []).map((m) => m.user_id).filter((id) => id !== myId);
      for (const id of others) {
        await window.Notifications.insert(id, myId, 'group_quiz', { groupId, groupName, day });
      }
    }
  } catch (e) { console.warn('[groups] Gruppen-Benachrichtigung fehlgeschlagen:', e && e.message); }
  // Leichtgewichtiges Event, damit GroupRow-Zähler/Buttons sofort aktualisieren
  // (Review 21.07.2026: vorher blieben sie bis zur nächsten Navigation stale).
  try { window.dispatchEvent(new CustomEvent('s34a-group-answered', { detail: { groupId, day } })); } catch (e) {}
  return { ok: true };
}

/* ---- UI ---- */

function GroupsModal({ ctx }) {
  const { session } = ctx;
  const myId = session && session.user && session.user.id;
  const [groups, setGroups] = useStateG([]);
  const [stage, setStage] = useStateG('list'); // list | create | join
  const [name, setName] = useStateG('');
  const [code, setCode] = useStateG('');
  const [busy, setBusy] = useStateG(false);
  const [err, setErr] = useStateG('');
  const [createdCode, setCreatedCode] = useStateG(null);

  const refresh = () => { if (myId) gLoadMyGroups(myId).then(setGroups); };
  useEffectG(() => { refresh(); }, [myId]);

  if (!session) {
    return (
      <>
        <ModalHead title="Lerngruppen" onClose={ctx.closeModal} />
        <div className="modal-body">
          <div className="card flat tinted" style={{ padding: 20, textAlign: 'center' }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Erst anmelden</div>
            <div className="muted" style={{ marginBottom: 14 }}>Melde dich an, um Lerngruppen zu erstellen oder beizutreten.</div>
            <button className="btn btn-primary" onClick={() => { ctx.closeModal(); ctx.openModal('auth'); }}>Anmelden</button>
          </div>
        </div>
      </>
    );
  }

  const doCreate = async () => {
    setErr(''); setBusy(true);
    try {
      const g = await gCreateGroup(myId, name);
      setCreatedCode(g.invite_code);
      setName('');
      refresh();
    } catch (e) { setErr((e && e.message) || 'Gruppe konnte nicht erstellt werden.'); }
    setBusy(false);
  };
  const doJoin = async () => {
    setErr(''); setBusy(true);
    try {
      await gJoinGroup(myId, code);
      setCode('');
      setStage('list');
      refresh();
    } catch (e) { setErr((e && e.message) || 'Beitritt fehlgeschlagen.'); }
    setBusy(false);
  };
  const doLeave = async (groupId) => {
    await gLeaveGroup(myId, groupId);
    refresh();
  };

  if (stage === 'create') {
    return (
      <>
        <ModalHead title="Gruppe erstellen" onClose={ctx.closeModal} />
        <div className="modal-body">
          {createdCode ? (
            <div className="code-card">
              <div>
                <div style={{ color: 'var(--ink-mute)', fontWeight: 800, fontSize: 14 }}>Beitrittscode</div>
                <div className="code">{createdCode}</div>
                <div className="muted">Teile diesen Code, damit andere beitreten können</div>
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Gruppenname</div>
              <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !busy && doCreate()}
                placeholder="z. B. Sicherheitsdienst AB" maxLength={60}
                style={{ width: '100%', padding: 14, fontSize: 15, borderRadius: 14, border: '1px solid var(--line)', background: 'var(--surface)' }} />
              {err && <div style={{ color: 'var(--rose)', fontWeight: 600, marginTop: 10 }}>{err}</div>}
            </>
          )}
        </div>
        <div className="modal-foot">
          {createdCode ? (
            <button className="btn btn-primary btn-full btn-lg" onClick={() => { setCreatedCode(null); setStage('list'); }}>Fertig</button>
          ) : (
            <button className="btn btn-primary btn-full btn-lg" disabled={busy} onClick={doCreate}>{busy ? 'Einen Moment…' : 'Erstellen'}</button>
          )}
        </div>
      </>
    );
  }

  if (stage === 'join') {
    return (
      <>
        <ModalHead title="Mit Code beitreten" onClose={ctx.closeModal} />
        <div className="modal-body">
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Beitrittscode</div>
          <input value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !busy && doJoin()}
            placeholder="z. B. K3P9QZ" style={{ width: '100%', padding: 14, fontSize: 22, textAlign: 'center', letterSpacing: '0.1em', fontFamily: 'Geist Mono, monospace', borderRadius: 14, border: '1px solid var(--line)', background: 'var(--surface)' }} />
          {err && <div style={{ color: 'var(--rose)', fontWeight: 600, marginTop: 10 }}>{err}</div>}
        </div>
        <div className="modal-foot">
          <button className="btn btn-primary btn-full btn-lg" disabled={busy} onClick={doJoin}>{busy ? 'Einen Moment…' : 'Beitreten'}</button>
        </div>
      </>
    );
  }

  return (
    <>
      <ModalHead title="Lerngruppen" onClose={ctx.closeModal} />
      <div className="modal-body">
        {groups.length === 0 && <div className="muted center" style={{ padding: '20px 0' }}>Noch in keiner Gruppe.</div>}
        <div className="col">
          {groups.map((g) => (
            <div key={g.id} className="card flat" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 14 }}>
              <div style={{ fontSize: 26 }}>👥</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{g.name}</div>
                <div className="muted" style={{ fontSize: 12.5 }}>Code: {g.invite_code}</div>
              </div>
              <button className="btn btn-ghost" onClick={() => doLeave(g.id)}>Verlassen</button>
            </div>
          ))}
        </div>
      </div>
      <div className="modal-foot" style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-ghost btn-full" onClick={() => setStage('join')}>Beitreten</button>
        <button className="btn btn-primary btn-full" onClick={() => setStage('create')}>+ Erstellen</button>
      </div>
    </>
  );
}

// Eine Zeile pro Gruppe (in GroupsCard) — zeigt Fortschritt des Tages und
// öffnet bei Klick das GroupQuiz-Modal.
function GroupRow({ ctx, group, myId }) {
  const [count, setCount] = useStateG(null);
  const [answered, setAnswered] = useStateG(false);
  const day = gDayKey();
  useEffectG(() => {
    let cancelled = false;
    const loadRows = () => gLoadDailyAnswers(group.id, day).then((rows) => {
      if (cancelled) return;
      setCount(rows.length);
      setAnswered(rows.some((r) => r.user_id === myId));
    });
    loadRows();
    // Nach eigener Antwort im GroupQuiz-Modal sofort aktualisieren (Review 21.07.2026).
    const onAnswered = (e) => { if (e.detail && e.detail.groupId === group.id) loadRows(); };
    window.addEventListener('s34a-group-answered', onAnswered);
    return () => { cancelled = true; window.removeEventListener('s34a-group-answered', onAnswered); };
  }, [group.id, day]);
  return (
    <div className="card flat" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 14 }}>
      <div style={{ fontSize: 26 }}>👥</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700 }}>{group.name}</div>
        <div className="muted" style={{ fontSize: 12.5 }}>
          {count === null ? '…' : `${count} ${count === 1 ? 'Person hat' : 'Personen haben'} heute geantwortet`}
        </div>
      </div>
      <button className="btn btn-primary" disabled={answered}
        onClick={() => ctx.openModal('groupQuiz', { groupId: group.id, groupName: group.name })}>
        {answered ? 'Erledigt ✅' : 'Quiz starten'}
      </button>
    </div>
  );
}

// Wiederverwendbare Karte für Fortschritt-Tab UND Profil (Blueprint-Vorgabe:
// "sichtbar im Fortschritt-Tab und im Profil").
function GroupsCard({ ctx, myId }) {
  const [groups, setGroups] = useStateG([]);
  const [loading, setLoading] = useStateG(true);
  useEffectG(() => {
    let cancelled = false;
    if (!myId) { setGroups([]); setLoading(false); return; }
    setLoading(true);
    gLoadMyGroups(myId).then((g) => { if (!cancelled) { setGroups(g); setLoading(false); } });
    return () => { cancelled = true; };
  }, [myId]);

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontWeight: 800 }}>Lerngruppen</div>
        <button className="link" onClick={() => ctx.openModal('groups')}>{groups.length ? '+ Mehr' : '+ Gruppe'}</button>
      </div>
      {!ctx.session && <div className="muted">Melde dich an, um mit einer Lerngruppe die tägliche Quizfrage zu lösen.</div>}
      {ctx.session && loading && <div className="muted">Lädt…</div>}
      {ctx.session && !loading && groups.length === 0 && <div className="muted">Noch in keiner Gruppe — erstelle eine oder tritt mit einem Code bei.</div>}
      {ctx.session && !loading && groups.length > 0 && (
        <div className="col">{groups.map((g) => <GroupRow key={g.id} ctx={ctx} group={g} myId={myId} />)}</div>
      )}
    </div>
  );
}

function GroupQuizModal({ ctx }) {
  const { session, modal } = ctx;
  const myId = session && session.user && session.user.id;
  const groupId = modal && modal.groupId;
  const groupName = modal && modal.groupName;
  const day = gDayKey();
  const [question] = useStateG(() => gPickDailyQuestion(gBuildQuestionPool(window.QURAN_TOPICS || []), groupId, day));
  const [answers, setAnswers] = useStateG([]);
  const [myAnswerIdx, setMyAnswerIdx] = useStateG(null);
  const [busy, setBusy] = useStateG(false);

  const refresh = () => gLoadDailyAnswers(groupId, day).then(setAnswers);
  useEffectG(() => { refresh(); }, [groupId]);

  const alreadyAnswered = answers.some((r) => r.user_id === myId);
  const firstResponderId = answers.length ? answers[0].user_id : null;

  const submit = async (idx) => {
    if (busy || alreadyAnswered || myAnswerIdx !== null || !question) return;
    setMyAnswerIdx(idx);
    setBusy(true);
    const correct = !!(question.options[idx] && question.options[idx].c);
    try {
      await gSubmitDailyAnswer(myId, groupId, groupName, day, correct);
      await refresh();
    } catch (e) {
      console.warn('[groups] Antwort konnte nicht gespeichert werden:', e && e.message);
      setMyAnswerIdx(null); // (Review 21.07.2026) sonst zeigte die UI "beantwortet", obwohl nichts gespeichert wurde
    }
    setBusy(false);
  };

  if (!question) {
    return (
      <>
        <ModalHead title={groupName} onClose={ctx.closeModal} />
        <div className="modal-body"><div className="muted center">Kein Fragenpool verfügbar.</div></div>
      </>
    );
  }

  return (
    <>
      <ModalHead title={groupName} onClose={ctx.closeModal} />
      <div className="modal-body">
        <div className="question-card"><div className="qtext">{question.q}</div></div>
        <div className="options">
          {question.options.map((o, i) => {
            let cls = 'option';
            const showState = alreadyAnswered || myAnswerIdx !== null;
            if (showState) {
              if (o.c) cls += ' is-correct';
              else if (i === myAnswerIdx) cls += ' is-wrong';
              else cls += ' is-disabled';
            }
            return <button key={i} className={cls} disabled={showState} onClick={() => submit(i)}>{o.t}</button>;
          })}
        </div>
        <div style={{ fontWeight: 800, marginTop: 14 }}>
          {answers.length} {answers.length === 1 ? 'Person hat' : 'Personen haben'} heute geantwortet
        </div>
        {firstResponderId && (
          <div className="muted" style={{ marginTop: 4 }}>
            🥇 {firstResponderId === myId ? 'Du warst' : 'Jemand war'} heute die/der Erste
          </div>
        )}
      </div>
    </>
  );
}

window.Groups = {
  createGroup: gCreateGroup, joinGroup: gJoinGroup, leaveGroup: gLeaveGroup,
  loadMyGroups: gLoadMyGroups, memberCount: gMemberCount, loadDailyAnswers: gLoadDailyAnswers,
  submitDailyAnswer: gSubmitDailyAnswer,
  GroupsModal, GroupsCard, GroupQuizModal,
  _pure: { dayKey: gDayKey, hashStr: gHashStr, buildQuestionPool: gBuildQuestionPool, pickDailyQuestion: gPickDailyQuestion },
};
