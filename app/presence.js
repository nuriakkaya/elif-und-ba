/* global React */
const { useState: useStatePresence, useEffect: useEffectPresence } = React;

/* ==============================================================
   Presence — Online-Anzeige + "👋 Winken" (Blueprint Phase 7, 20.07.2026).
   Nutzt Supabase Realtime Presence (ein einziger gemeinsamer Kanal,
   'presence:lern34a', presence-key = eigene user_id) statt eines
   Heartbeat/last_seen-Feldes in der DB — echtes Live-Presence-Feature
   statt einer Annäherung, wie im Blueprint vorgeschlagen ("braucht
   Realtime-Presence, z.B. Supabase Presence").

   "Winken" ist bewusst EPHEMER (kein Datenbank-Insert): ein Broadcast-
   Event auf demselben gemeinsamen Kanal mit einem "to"-Feld — nur der
   Empfänger (und nur wenn er GERADE online ist) zeigt einen Toast. Es
   gibt noch kein Notification-Center (Phase 8, offene Entscheidung),
   das Winken dauerhaft speichern könnte — ist der Empfänger offline,
   verpufft es einfach. Das ist ein bewusster Scope-Schnitt, keine
   halbfertige Umsetzung.
   ============================================================== */

/* ---------- reine, ohne Supabase testbare Funktion ---------- */
// rawState hat die Form { [presenceKey]: [{ user_id, username, avatar, online_at }, ...] },
// wie sie RealtimeChannel.presenceState() von Supabase zurückgibt (presence-key =
// user_id, siehe setUser() unten -> nur der erste Eintrag pro Key wird verwendet).
function computeOnlineMap(rawState) {
  const out = {};
  Object.keys(rawState || {}).forEach((key) => {
    const metas = rawState[key];
    if (!metas || !metas.length) return;
    const m = metas[0];
    if (m && m.user_id) out[m.user_id] = { username: m.username || '?', avatar: m.avatar || '🦔', onlineAt: m.online_at };
  });
  return out;
}

(function () {
  let channel = null;
  let onlineMap = {};
  let currentUserId = null;
  let currentProfile = null;
  let changeListeners = [];
  let waveListeners = [];

  function notifyChange() { changeListeners.slice().forEach((fn) => { try { fn(onlineMap); } catch (e) {} }); }
  function notifyWave(payload) { waveListeners.slice().forEach((fn) => { try { fn(payload); } catch (e) {} }); }

  async function trackSelf() {
    if (!channel || !currentUserId) return;
    await channel.track({
      user_id: currentUserId,
      username: (currentProfile && currentProfile.username) || 'Nutzer',
      avatar: (currentProfile && currentProfile.avatar) || '🦔',
      online_at: new Date().toISOString(),
    });
  }
  function onVisibility() {
    if (!channel) return;
    if (document.hidden) channel.untrack();
    else trackSelf();
  }

  function setUser(userId, profile) {
    currentProfile = profile || currentProfile;
    if (userId === currentUserId && channel) { trackSelf(); return; }
    if (channel) { try { window.sb && window.sb.removeChannel(channel); } catch (e) {} channel = null; }
    currentUserId = userId || null;
    onlineMap = {};
    notifyChange();
    if (!currentUserId || !window.sb) return;
    channel = window.sb.channel('presence:lern34a', { config: { presence: { key: currentUserId } } });
    channel.on('presence', { event: 'sync' }, () => {
      onlineMap = computeOnlineMap(channel.presenceState());
      notifyChange();
    });
    // (Review 21.07.2026) Winken nur akzeptieren, wenn der angebliche Absender
    // tatsächlich im Presence-Kanal steht — payload-Felder sind clientgesetzt und
    // ließen sich sonst trivial im Namen beliebiger Nutzer fälschen. (Vollständiger
    // Schutz bräuchte private Channels/Server — dokumentiertes Restrisiko.)
    channel.on('broadcast', { event: 'wave' }, (msg) => {
      const claimedFrom = msg && msg.payload && msg.payload.from;
      if (!claimedFrom || !onlineMap[claimedFrom]) return;
      const payload = msg && msg.payload;
      if (payload && payload.to === currentUserId) notifyWave(payload);
    });
    channel.subscribe((status) => { if (status === 'SUBSCRIBED') trackSelf(); });
    document.addEventListener('visibilitychange', onVisibility);
  }

  function sendWave(targetUserId) {
    if (!channel || !currentUserId) return;
    channel.send({
      type: 'broadcast', event: 'wave',
      payload: { to: targetUserId, from: currentUserId, fromName: (currentProfile && currentProfile.username) || 'Jemand', fromAvatar: (currentProfile && currentProfile.avatar) || '🦔' },
    });
  }

  function isOnline(userId) { return !!onlineMap[userId]; }
  function onlineIds() { return Object.keys(onlineMap); }
  function onChange(fn) { changeListeners.push(fn); return () => { changeListeners = changeListeners.filter((f) => f !== fn); }; }
  function onWave(fn) { waveListeners.push(fn); return () => { waveListeners = waveListeners.filter((f) => f !== fn); }; }

  window.Presence = { setUser, sendWave, isOnline, onlineIds, onChange, onWave, _pure: { computeOnlineMap } };
})();
