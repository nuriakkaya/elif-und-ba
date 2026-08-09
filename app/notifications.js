/* ==============================================================
   Notifications — echtes Benachrichtigungszentrum (Blueprint Phase 10).
   Reines JS (kein JSX), lädt vor den React-Komponenten, analog zu
   app/xp.js / app/presence.js. Siehe supabase/schema.sql Abschnitt 15
   für die RLS-Begründung (kein Server-Trigger, deshalb schreibt der
   auslösende Client direkt in die Inbox der Empfänger:in).

   Drei Trigger sind angeschlossen:
   - 'follow'     — app/follows.js fwFollow() schreibt bei jedem neuen
                     Follow eine Zeile in die Inbox der/des Gefolgten.
   - 'overtaken'  — checkLeaderboardOvertake() unten, einmal pro Login
                     aufgerufen (App.js useEffect, wie Presence.setUser).
   - 'group_quiz' — app/groups.js gSubmitDailyAnswer() (Blueprint Phase 9,
                     20.07.2026 gebaut): wer als Erste:r in einer Gruppe die
                     Tagesfrage beantwortet, schreibt direkt in die Inbox
                     aller anderen Mitglieder ("Das tägliche Quiz ist bereit
                     für [Gruppenname]"). Kein Server-Cron nötig — der/die
                     erste Antwortende IST der Auslöser.
   ============================================================== */
(function () {
  const RANK_CACHE_PREFIX = 's34a_notif_rank_';

  async function nInsert(userId, actorId, type, payload) {
    if (!window.sb || !userId) return;
    const { error } = await window.sb.from('notifications').insert({
      user_id: userId, actor_id: actorId || null, type, payload: payload || {},
    });
    if (error) console.warn('[notifications] Insert fehlgeschlagen:', error.message);
  }

  async function nList(userId, limit) {
    if (!window.sb || !userId) return [];
    const { data, error } = await window.sb.from('notifications')
      .select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit || 30);
    if (error) { console.warn('[notifications] Laden fehlgeschlagen:', error.message); return []; }
    return data || [];
  }

  async function nMarkRead(id) {
    if (!window.sb) return;
    await window.sb.from('notifications').update({ read: true }).eq('id', id);
  }
  async function nMarkAllRead(userId) {
    if (!window.sb || !userId) return;
    await window.sb.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
  }

  // Übersetzt einen Benachrichtigungs-Typ + Payload + Aktor-Namen in einen
  // deutschen Anzeigetext. Reine Funktion, ohne Supabase testbar.
  function formatNotifText(n, actorName) {
    const name = actorName || 'Jemand';
    if (n.type === 'follow') return `${name} folgt dir jetzt`;
    if (n.type === 'overtaken') return `${name} hat dich überholt${n.payload && n.payload.newRank ? ` — du bist jetzt Platz ${n.payload.newRank}` : ''}`;
    if (n.type === 'group_quiz') return `Das tägliche Quiz ist bereit für ${(n.payload && n.payload.groupName) || 'deine Gruppe'}`;
    if (n.type === 'referral') return `${name} ist über deinen Einladungslink beigetreten — +${(n.payload && n.payload.reward) || 10} Münzen für dich 🎉`;
    if (n.type === 'streak_reminder') return `${name} erinnert dich: Lern heute eine Runde, damit eure gemeinsame Serie nicht reißt! 🔥`;
    return `${name} hat etwas gemacht`;
  }

  /* ---- Leaderboard-Überholt-Check (einmal pro Login, kein Dauer-Polling) ---- */
  async function checkLeaderboardOvertake(userId) {
    if (!window.sb || !userId || !window.fLoadAll) return;
    try {
      const d = await window.fLoadAll(userId);
      const friendIds = d.friends.map((f) => (f.user_a === userId ? f.user_b : f.user_a));
      if (!friendIds.length) return;
      const ids = [...friendIds, userId];
      const { data: profs } = await window.sb.from('profiles').select('id, username, total_xp').in('id', ids);
      if (!profs) return;
      const me = profs.find((p) => p.id === userId);
      if (!me) return;
      const myXp = me.total_xp || 0;
      const aboveNow = profs.filter((p) => p.id !== userId && (p.total_xp || 0) > myXp);
      const rank = 1 + aboveNow.length;

      const cacheKey = RANK_CACHE_PREFIX + userId;
      let prevAboveIds = null;
      try {
        const raw = localStorage.getItem(cacheKey);
        prevAboveIds = raw === null ? null : JSON.parse(raw);
      } catch (e) { prevAboveIds = null; }

      // (Review 21.07.2026) Erster Lauf auf diesem Gerät (kein Cache): nur den
      // Ausgangsstand merken, KEINE Benachrichtigungen — vorher bekam man beim
      // allerersten Login (und auf jedem neuen Gerät) für JEDEN Freund mit mehr XP
      // ein "hat dich überholt", obwohl niemand überholt hatte.
      if (prevAboveIds !== null) {
        const newlyAbove = aboveNow.filter((p) => !prevAboveIds.includes(p.id));
        for (const p of newlyAbove) {
          await nInsert(userId, p.id, 'overtaken', { newRank: rank });
        }
      }
      localStorage.setItem(cacheKey, JSON.stringify(aboveNow.map((p) => p.id)));
    } catch (e) { /* kein Supabase konfiguriert o.ä. */ }
  }

  /* ---- Realtime: Badge/Liste live aktuell halten ---- */
  let channel = null;
  let currentUserId = null;
  let items = [];
  let listeners = [];
  function notify() { listeners.slice().forEach((fn) => { try { fn(items); } catch (e) {} }); }

  async function refresh(userId) {
    items = await nList(userId);
    notify();
  }

  function setUser(userId) {
    // removeChannel statt unsubscribe: entfernt den Channel auch aus dem Client,
    // sonst sammeln sich bei Login/Logout-Wechseln Instanzen an (Review 21.07.2026).
    if (channel) { try { window.sb && window.sb.removeChannel(channel); } catch (e) {} channel = null; }
    currentUserId = userId || null;
    items = [];
    if (!currentUserId) { notify(); return; }
    refresh(currentUserId);
    checkLeaderboardOvertake(currentUserId);
    if (!window.sb) return;
    channel = window.sb.channel('notif:' + currentUserId);
    channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + currentUserId }, (msg) => {
      items = [msg.new, ...items];
      notify();
    });
    channel.subscribe();
  }

  function list() { return items; }
  function unreadCount() { return items.filter((n) => !n.read).length; }
  function onChange(fn) { listeners.push(fn); return () => { listeners = listeners.filter((f) => f !== fn); }; }

  async function markRead(id) {
    await nMarkRead(id);
    items = items.map((n) => (n.id === id ? { ...n, read: true } : n));
    notify();
  }
  async function markAllRead() {
    if (!currentUserId) return;
    await nMarkAllRead(currentUserId);
    items = items.map((n) => ({ ...n, read: true }));
    notify();
  }

  window.Notifications = {
    insert: nInsert, list, unreadCount, onChange, markRead, markAllRead, setUser,
    formatNotifText, checkLeaderboardOvertake,
    _pure: { formatNotifText },
  };
})();
