/* ==============================================================
   Freundesserien — kombinierte 2er-Streaks zwischen Freunden
   (Blueprint Phase 8, 20.07.2026). Bei Gizmo live beobachtet: ein
   wachsendes Pflanzen-Icon je nach gemeinsamer Serienlänge, "+"-Slots
   zum Hinzufügen weiterer Streak-Partner (siehe GIZMO_PARITY_CHECKLISTE.md
   Abschnitt 4).

   Bewusst KEINE eigene Tabelle — die kombinierte Serie wird rein
   rechnerisch aus der bereits vorhandenen `xp_daily`-Tabelle beider
   Nutzer:innen abgeleitet (gleiches Prinzip wie die Streak-Meilensteine
   im Aktivitäts-Feed, app/follows.js): ein Tag zählt als "aktiv", wenn
   `xp_daily.xp > 0` war (nicht am STREAK_DAILY_TARGET-Soll gemessen —
   dieselbe bewusste Vereinfachung wie im Feed). Die Serie hält nur so
   lange, wie BEIDE an jedem Tag aktiv waren — bricht bei EINER Person
   ab, bricht sie für beide.
   ============================================================== */

function fsDayKey(d) {
  const x = d || new Date();
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
}
function fsLastNDays(n, endDate) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(endDate || new Date());
    d.setDate(d.getDate() - i);
    out.push(fsDayKey(d));
  }
  return out; // älteste -> neueste, inkl. heute
}

// Reine, ohne Supabase testbare Berechnung: myActiveDays/friendActiveDays sind
// Sets von 'YYYY-MM-DD'-Strings (Tage mit xp>0). orderedDays ist eine
// chronologische Tagesliste (älteste -> neueste, siehe fsLastNDays). Läuft vom
// letzten Tag rückwärts, solange BEIDE aktiv waren.
function computeCombinedStreak(orderedDays, myActiveDays, friendActiveDays) {
  let streak = 0;
  // (Review 21.07.2026) HEUTE (letzter Eintrag) zählt mit, wenn schon beide aktiv
  // waren — bricht die Serie aber NICHT, wenn heute einfach noch nicht beide
  // gelernt haben (der Tag läuft ja noch). Vorher zeigte eine intakte 20-Tage-
  // Serie jeden Morgen 0, bis beide aktiv waren.
  let i = orderedDays.length - 1;
  const today = orderedDays[i];
  if (myActiveDays.has(today) && friendActiveDays.has(today)) {
    streak++;
    i--;
  } else {
    i--; // heute noch offen — Zählung beginnt bei gestern
  }
  for (; i >= 0; i--) {
    const day = orderedDays[i];
    if (myActiveDays.has(day) && friendActiveDays.has(day)) streak++;
    else break;
  }
  return streak;
}

// Wachstumsstufen fürs Pflanzen-Icon, an Gizmos "wachsendes Pflanzen-Icon je nach
// Streak-Länge" angelehnt (eigene Stufen-Grenzen, nicht 1:1 vermessen).
function plantForStreak(n) {
  if (n <= 0) return '🌰';
  if (n < 3) return '🌱';
  if (n < 7) return '🌿';
  if (n < 14) return '🍀';
  if (n < 30) return '🌳';
  return '🌲';
}

const FS_WINDOW_DAYS = 40; // genug Puffer für auch längere gemeinsame Serien

async function fsBuildFriendStreaks(myId) {
  if (!window.sb || !myId || !window.fLoadAll) return [];
  const d = await window.fLoadAll(myId);
  if (!d.friends.length) return [];
  const friendIds = d.friends.map((f) => (f.user_a === myId ? f.user_b : f.user_a));
  const ids = [...friendIds, myId];

  const orderedDays = fsLastNDays(FS_WINDOW_DAYS);
  const fromDay = orderedDays[0];
  const { data: rows } = await window.sb.from('xp_daily').select('user_id, day, xp').in('user_id', ids).gte('day', fromDay);

  const activeByUser = {};
  ids.forEach((id) => { activeByUser[id] = new Set(); });
  (rows || []).forEach((r) => { if ((r.xp || 0) > 0) activeByUser[r.user_id].add(r.day); });

  const myActive = activeByUser[myId] || new Set();
  const today = fsDayKey();
  return d.friends
    .map((f) => {
      const friendId = f.user_a === myId ? f.user_b : f.user_a;
      const fActive = activeByUser[friendId] || new Set();
      const streak = computeCombinedStreak(orderedDays, myActive, fActive);
      // (Ausbau 26.07.2026, Live-Erkundung) Gizmo zeigt unter dem Serien-Raster
      // eine "Serie in Gefahr"-Liste: Freunde, die HEUTE noch nicht gelernt haben,
      // obwohl eine gemeinsame Serie läuft — mit "Erinnern"-Button.
      const friendActiveToday = fActive.has(today);
      return {
        friendId, profile: f.profile, streak, plant: plantForStreak(streak),
        friendActiveToday,
        atRisk: streak > 0 && !friendActiveToday,
      };
    })
    .sort((a, b) => b.streak - a.streak);
}

/* "Erinnern" (26.07.2026): schickt dem Freund eine Benachrichtigung über das
   bestehende notifications-System (Typ 'streak_reminder'). Höchstens 1x pro
   Freund und Tag (localStorage-Flag), damit der Button nicht zum Spam-Knopf
   wird — Gizmo graut ihn nach dem Klick ebenfalls aus. */
function fsRemind(myId, friendId) {
  const key = 's34a_fs_remind_' + friendId + '_' + fsDayKey();
  try { if (localStorage.getItem(key)) return { ok: false, reason: 'already' }; } catch (e) {}
  if (!window.Notifications || !myId || !friendId) return { ok: false, reason: 'unavailable' };
  window.Notifications.insert(friendId, myId, 'streak_reminder', {});
  try { localStorage.setItem(key, '1'); } catch (e) {}
  return { ok: true };
}
function fsRemindedToday(friendId) {
  try { return !!localStorage.getItem('s34a_fs_remind_' + friendId + '_' + fsDayKey()); } catch (e) { return false; }
}

window.FriendStreaks = {
  build: fsBuildFriendStreaks, remind: fsRemind, remindedToday: fsRemindedToday,
  _pure: { computeCombinedStreak, plantForStreak, lastNDays: fsLastNDays, dayKey: fsDayKey },
};
