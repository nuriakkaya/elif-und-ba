/* global React */
const { useState: useStateFriends, useEffect: useEffectFriends } = React;

/* ==============================================================
   Echte Freunde-Funktion über Supabase (ersetzt die hardcodierte
   FRIENDS-Liste aus main.js für die Teile, die im letzten Durchgang
   als "echt machen" ausgewählt wurden: Freundschaftsanfragen senden/
   annehmen, echte Freundesliste). Level/XP/Streak-Fassade bleibt wie
   besprochen unangetastet und weiterhin Fake.

   Kanonische Paar-Ordnung: pro Freundschaft wird immer die kleinere
   UUID als user_a gespeichert, damit die unique(user_a,user_b)-
   Constraint in Supabase Duplikate in beide Richtungen verhindert.
   ============================================================== */
function pairOrder(a, b) { return a < b ? [a, b] : [b, a]; }

async function fSearchUsers(query, excludeId) {
  if (!window.sb || !query.trim()) return [];
  // (Ausbau 21.07.2026) Private Profile (profiles.is_private) auch hier ausblenden —
  // der Filter war zunächst nur in der Follower-Suche (app/follows.js) gelandet.
  const { data, error } = await window.sb
    .from('profiles')
    .select('id, username, avatar')
    .ilike('username', `%${query.trim()}%`)
    .neq('id', excludeId)
    .or('is_private.is.null,is_private.eq.false')
    .limit(20);
  if (error) { console.warn('[friends] Suche fehlgeschlagen:', error.message); return []; }
  return data || [];
}

async function fSendRequest(myId, otherId) {
  const [user_a, user_b] = pairOrder(myId, otherId);
  const { error } = await window.sb.from('friendships').insert({ user_a, user_b, status: 'pending', requested_by: myId });
  if (error) throw error;
}

async function fAcceptRequest(rowId) {
  const { error } = await window.sb.from('friendships').update({ status: 'accepted' }).eq('id', rowId);
  if (error) throw error;
}

// (Ausbau 21.07.2026) Löschen deckt drei Fälle ab: Freund entfernen, eingehende
// Anfrage ablehnen, eigene Anfrage zurückziehen — RLS friendships_delete_own
// erlaubt beiden Seiten das Löschen (schema.sql Abschnitt 25).
async function fRemoveFriendship(rowId) {
  const { error } = await window.sb.from('friendships').delete().eq('id', rowId);
  if (error) throw error;
}

async function fLoadAll(myId) {
  if (!window.sb || !myId) return { friends: [], incoming: [], outgoing: [] };
  const { data, error } = await window.sb
    .from('friendships')
    .select('*')
    .or(`user_a.eq.${myId},user_b.eq.${myId}`);
  if (error) { console.warn('[friends] Laden fehlgeschlagen:', error.message); return { friends: [], incoming: [], outgoing: [] }; }
  const rows = data || [];
  const otherIdOf = (row) => (row.user_a === myId ? row.user_b : row.user_a);
  const friendRows = rows.filter(r => r.status === 'accepted');
  const incomingRows = rows.filter(r => r.status === 'pending' && r.requested_by !== myId);
  const outgoingRows = rows.filter(r => r.status === 'pending' && r.requested_by === myId);
  const otherIds = Array.from(new Set(rows.map(otherIdOf)));
  let profileById = {};
  if (otherIds.length) {
    const { data: profs } = await window.sb.from('profiles').select('id, username, avatar').in('id', otherIds);
    (profs || []).forEach(p => { profileById[p.id] = p; });
  }
  const withProfile = (row) => ({ ...row, profile: profileById[otherIdOf(row)] || { username: '?', avatar: '🦔' } });
  return {
    friends: friendRows.map(withProfile),
    incoming: incomingRows.map(withProfile),
    outgoing: outgoingRows.map(withProfile),
  };
}

/* ============== FRIENDS MODAL ============== */
function FriendsModal({ ctx }) {
  const { session } = ctx;
  const [data, setData] = useStateFriends({ friends: [], incoming: [], outgoing: [] });
  const [tab, setTab] = useStateFriends('freunde');
  const [q, setQ] = useStateFriends('');
  const [results, setResults] = useStateFriends([]);
  const [busy, setBusy] = useStateFriends(false);
  const [msg, setMsg] = useStateFriends('');

  const refresh = async () => { if (session) setData(await fLoadAll(session.user.id)); };
  useEffectFriends(() => { refresh(); }, [session && session.user.id]);

  if (!window.Auth || !window.Auth.isConfigured()) {
    return (
      <>
        <ModalHead title="Freunde" onClose={ctx.closeModal} />
        <div className="modal-body">
          <div className="card flat tinted" style={{ padding: 18 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Noch nicht eingerichtet</div>
            <div className="muted">Echte Freundschaften brauchen ein verbundenes Supabase-Projekt (siehe SUPABASE_SETUP.md).</div>
          </div>
        </div>
      </>
    );
  }
  if (!session) {
    return (
      <>
        <ModalHead title="Freunde" onClose={ctx.closeModal} />
        <div className="modal-body">
          <div className="card flat tinted" style={{ padding: 18, textAlign: 'center' }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Erst anmelden</div>
            <div className="muted" style={{ marginBottom: 14 }}>Melde dich an, um echte Freunde hinzuzufügen.</div>
            <button className="btn btn-primary" onClick={() => ctx.openModal('auth')}>Anmelden</button>
          </div>
        </div>
      </>
    );
  }

  const search = async () => {
    setBusy(true);
    setResults(await fSearchUsers(q, session.user.id));
    setBusy(false);
  };
  const send = async (otherId) => {
    setMsg('');
    try { await fSendRequest(session.user.id, otherId); setMsg('Anfrage gesendet.'); await refresh(); }
    catch (e) { setMsg((e && e.message) || 'Das hat nicht geklappt.'); }
  };
  const accept = async (rowId) => { await fAcceptRequest(rowId); await refresh(); };
  const [confirmRemove, setConfirmRemove] = useStateFriends(null); // rowId mit offener Entfernen-Bestätigung
  const removeRow = async (rowId) => {
    if (confirmRemove !== rowId) { setConfirmRemove(rowId); return; }
    setConfirmRemove(null);
    try { await fRemoveFriendship(rowId); } catch (e) { setMsg((e && e.message) || 'Das hat nicht geklappt.'); }
    await refresh();
  };

  return (
    <>
      <ModalHead title="Freunde" onClose={ctx.closeModal} />
      <div className="modal-body">
        <div className="tabs" style={{ marginBottom: 14 }}>
          <button className={'tab ' + (tab === 'freunde' ? 'is-active' : '')} onClick={() => setTab('freunde')}>
            Freunde ({data.friends.length})
          </button>
          <button className={'tab ' + (tab === 'anfragen' ? 'is-active' : '')} onClick={() => setTab('anfragen')}>
            Anfragen {data.incoming.length > 0 ? `(${data.incoming.length})` : ''}
          </button>
          <button className={'tab ' + (tab === 'suchen' ? 'is-active' : '')} onClick={() => setTab('suchen')}>Hinzufügen</button>
        </div>

        {tab === 'freunde' && (
          <div className="col">
            {!data.friends.length && <div className="muted">Noch keine Freunde — wechsle zu "Hinzufügen", um jemanden zu finden.</div>}
            {data.friends.map(f => (
              <div key={f.id} className="card flat" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 14 }}>
                <div style={{ fontSize: 28 }}>{f.profile.avatar}</div>
                <div style={{ flex: 1, fontWeight: 700 }}>{f.profile.username}</div>
                <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: 13, color: confirmRemove === f.id ? 'var(--rose)' : undefined }}
                        onClick={() => removeRow(f.id)}>
                  {confirmRemove === f.id ? 'Wirklich entfernen?' : 'Entfernen'}
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === 'anfragen' && (
          <div className="col">
            {!data.incoming.length && !data.outgoing.length && <div className="muted">Keine offenen Anfragen.</div>}
            {data.incoming.map(f => (
              <div key={f.id} className="card flat" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 14 }}>
                <div style={{ fontSize: 28 }}>{f.profile.avatar}</div>
                <div style={{ flex: 1, fontWeight: 700 }}>{f.profile.username}</div>
                <button className="btn btn-ghost" style={{ padding: '8px 12px', fontSize: 13 }} onClick={() => removeRow(f.id)}>
                  {confirmRemove === f.id ? 'Wirklich?' : 'Ablehnen'}
                </button>
                <button className="btn btn-primary" style={{ padding: '8px 16px' }} onClick={() => accept(f.id)}>Annehmen</button>
              </div>
            ))}
            {data.outgoing.map(f => (
              <div key={f.id} className="card flat" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 14, opacity: 0.7 }}>
                <div style={{ fontSize: 28 }}>{f.profile.avatar}</div>
                <div style={{ flex: 1, fontWeight: 700 }}>{f.profile.username}</div>
                <button className="btn btn-ghost" style={{ padding: '8px 12px', fontSize: 13 }} onClick={() => removeRow(f.id)}>
                  {confirmRemove === f.id ? 'Wirklich?' : 'Zurückziehen'}
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === 'suchen' && (
          <div className="col">
            <div className="row" style={{ gap: 8 }}>
              <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()}
                     placeholder="Nutzername suchen…"
                     style={{ flex: 1, padding: 12, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)' }} />
              <button className="btn btn-primary" disabled={busy} onClick={search}>Suchen</button>
            </div>
            {msg && <div className="muted" style={{ fontSize: 13 }}>{msg}</div>}
            {results.map(r => (
              <div key={r.id} className="card flat" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 14 }}>
                <div style={{ fontSize: 28 }}>{r.avatar}</div>
                <div style={{ flex: 1, fontWeight: 700 }}>{r.username}</div>
                <button className="btn btn-ghost" style={{ padding: '8px 16px' }} onClick={() => send(r.id)}>Anfrage senden</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

window.FriendsModal = FriendsModal;
