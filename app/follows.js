/* global React */
const { useState: useStateFollows, useEffect: useEffectFollows } = React;

/* ==============================================================
   Follows — einseitiges Folgen + davon abgeleiteter Aktivitäts-Feed
   (Blueprint Phase 7, 20.07.2026). Bewusst eine eigene Tabelle/Modul,
   getrennt von app/friends.js: Folgen ist einseitig und braucht keine
   Bestätigung, Freundschaft ist beidseitig und braucht eine Anfrage
   (siehe app/friends.js) — beides existiert bei Gizmo nebeneinander.

   Der Aktivitäts-Feed selbst ist KEINE eigene Datenbanktabelle, sondern
   wird clientseitig aus bereits vorhandenen Daten abgeleitet:
   - Streak-Meilensteine: aus xp_daily (welche Tage hatte der Nutzer XP?)
   - Level-ups: aus xp_daily-Deltas + dem aktuellen profiles.total_xp
     (Kumulierung rückwärts von "heute" aus, siehe computeLevelUps unten)
   - "Test bestanden": aus test_results (siehe supabase/schema.sql
     Abschnitt 13 — musste neu angelegt werden, der Übungstest hatte
     bisher GAR KEINE Persistenz, nicht mal lokal dauerhaft)
   ============================================================== */

/* ---------- reine, ohne Supabase testbare Berechnungen ---------- */

function fwDayKey(d) {
  const x = d || new Date();
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
}
function fwLastNDays(n, endDate) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(endDate || new Date());
    d.setDate(d.getDate() - i);
    out.push(fwDayKey(d));
  }
  return out; // älteste -> neueste, inkl. heute
}

// Eigene Level-Kurve, exakt dieselbe Formel wie in app/xp.js (dort nicht exportiert,
// weil sie in einer IIFE steckt — hier bewusst dupliziert, es sind nur zwei Zeilen).
function fwThreshold(level) { return 150 * (level - 1) * (level - 1); }
const FW_TITLES = [[18, 'Legende'], [16, 'Champion'], [13, 'Master'], [11, 'Experte'], [8, 'Profi'], [5, 'Kenner'], [3, 'Azubi'], [1, 'Neuling']];
function levelForXp(total) {
  let lvl = 1;
  while (fwThreshold(lvl + 1) <= total) lvl++;
  const title = (FW_TITLES.find(([min]) => lvl >= min) || FW_TITLES[FW_TITLES.length - 1])[1];
  return { level: lvl, title };
}

// Streak-Meilenstein wie im Combo-System (app/xp.js mult()): bei 3, 5, danach jedem 5er.
function isStreakMilestone(n) { return n === 3 || n === 5 || (n > 5 && n % 5 === 0); }

// dailyXpByDay: Array (älteste -> neueste, EXAKT windowDays lange, lückenlos) von
// {day, xp}. Gibt Feed-Einträge zurück für jeden Tag, an dem die Konsekutiv-Länge
// (Tage in Folge mit xp>0, endend an diesem Tag) einen Meilenstein trifft.
// (Review 21.07.2026) Gezählt werden nur "GEERDETE" Serien — solche, deren Beginn
// (ein inaktiver Tag davor) INNERHALB des Fensters sichtbar ist. Eine Serie, die
// schon am ersten Fenstertag lief, kann in Wahrheit viel länger sein; vorher hätte
// der Feed dafür falsche Meilensteine gemeldet ("15-Tage-Serie" bei real 100), die
// zudem mit dem täglich wandernden Fenster jeden Tag den Tag gewechselt hätten.
function computeStreakMilestones(dailyXpByDay) {
  const out = [];
  let run = 0;
  let grounded = false; // erst nach dem ersten beobachteten inaktiven Tag belastbar
  for (const d of dailyXpByDay) {
    if (d.xp > 0) {
      run += 1;
      if (grounded && isStreakMilestone(run)) out.push({ day: d.day, streakDays: run });
    } else {
      run = 0;
      grounded = true;
    }
  }
  return out;
}

// totalNow = aktueller Gesamt-XP-Stand (profiles.total_xp). dailyXpByDay: siehe oben.
// Rekonstruiert die Kumulierung rückwärts (baseline = totalNow - Summe des Fensters)
// und meldet jeden Tag, an dem die Level-Schwelle überschritten wurde.
function computeLevelUps(totalNow, dailyXpByDay) {
  const windowSum = dailyXpByDay.reduce((s, d) => s + (d.xp || 0), 0);
  let running = totalNow - windowSum;
  const out = [];
  for (const d of dailyXpByDay) {
    const before = levelForXp(running);
    const after = levelForXp(running + (d.xp || 0));
    if (after.level > before.level) out.push({ day: d.day, level: after.level, title: after.title });
    running += (d.xp || 0);
  }
  return out;
}

/* ---------- Supabase-Zugriffe ---------- */

async function fwSearchUsers(query, excludeId) {
  if (!window.sb || !query.trim()) return [];
  // Private Profile (profiles.is_private, Phase 16) tauchen in der Suche nicht auf.
  // `.or(...is.null...)`: Bestandszeilen von vor der Spalten-Einführung könnten null
  // sein, je nachdem wann das Schema-Update eingespielt wurde — null zählt als öffentlich.
  const { data, error } = await window.sb
    .from('profiles').select('id, username, avatar')
    .ilike('username', `%${query.trim()}%`).neq('id', excludeId)
    .or('is_private.is.null,is_private.eq.false')
    .limit(20);
  if (error) { console.warn('[follows] Suche fehlgeschlagen:', error.message); return []; }
  return data || [];
}

async function fwFollow(myId, otherId) {
  const { error } = await window.sb.from('follows').insert({ follower_id: myId, followee_id: otherId });
  if (error) throw error;
  // (Review 21.07.2026) Benachrichtigung pro Zielperson nur EINMAL pro Gerät —
  // vorher ließ sich die fremde Inbox per Follow/Unfollow-Toggle beliebig fluten.
  // (Fremde Inboxen sind per RLS nicht lesbar, deshalb clientseitige Drossel.)
  try {
    const notifKey = 's34a_follow_notified_' + myId;
    const notified = JSON.parse(localStorage.getItem(notifKey) || '[]');
    if (notified.includes(otherId)) return;
    notified.push(otherId);
    localStorage.setItem(notifKey, JSON.stringify(notified.slice(-500)));
  } catch (e) { /* localStorage gesperrt — dann eben ohne Drossel */ }
  // Neuer Follower -> Benachrichtigung in die Inbox der/des Gefolgten (Blueprint
  // Phase 10). Fire-and-forget, ein fehlgeschlagener Insert soll den Follow selbst
  // nicht rückgängig machen.
  if (window.Notifications) window.Notifications.insert(otherId, myId, 'follow', {});
}
async function fwUnfollow(myId, otherId) {
  const { error } = await window.sb.from('follows').delete().eq('follower_id', myId).eq('followee_id', otherId);
  if (error) throw error;
}

async function fwLoadFollowing(myId) {
  if (!window.sb || !myId) return [];
  const { data, error } = await window.sb.from('follows').select('followee_id').eq('follower_id', myId);
  if (error || !data || !data.length) return [];
  const ids = data.map((r) => r.followee_id);
  const { data: profs } = await window.sb.from('profiles').select('id, username, avatar').in('id', ids);
  return profs || [];
}
async function fwLoadFollowers(myId) {
  if (!window.sb || !myId) return [];
  const { data, error } = await window.sb.from('follows').select('follower_id').eq('followee_id', myId);
  if (error || !data || !data.length) return [];
  const ids = data.map((r) => r.follower_id);
  const { data: profs } = await window.sb.from('profiles').select('id, username, avatar').in('id', ids);
  return profs || [];
}
async function fwCounts(userId) {
  if (!window.sb || !userId) return { followers: 0, following: 0 };
  const [a, b] = await Promise.all([
    window.sb.from('follows').select('follower_id', { count: 'exact', head: true }).eq('followee_id', userId),
    window.sb.from('follows').select('followee_id', { count: 'exact', head: true }).eq('follower_id', userId),
  ]);
  return { followers: a.count || 0, following: b.count || 0 };
}

// Übungstest-Ergebnis speichern (neu, siehe schema.sql Abschnitt 13 — nur so kann
// der Aktivitäts-Feed "Test bestanden" überhaupt zeigen).
async function fwRecordTestResult(userId, { topicId, topicTitle, score, total, passed }) {
  if (!window.sb || !userId) return;
  const { error } = await window.sb.from('test_results').insert({
    user_id: userId, topic_id: topicId || null, topic_title: topicTitle || '?', score, total, passed,
  });
  if (error) console.warn('[follows] Testergebnis-Sync fehlgeschlagen:', error.message);
}

const FEED_WINDOW_DAYS = 14;
const FEED_LIMIT = 30;

// Baut den "Folge ich"-Aktivitäts-Feed für myId. Siehe Modul-Kopf für die Herleitung
// der drei Ereignistypen. Bewusst auf FEED_WINDOW_DAYS begrenzt (nicht "alles"), sonst
// müsste für jeden gefolgten Nutzer unbegrenzt viel xp_daily-Historie geladen werden.
async function fwBuildFeed(myId) {
  if (!window.sb || !myId) return [];
  const following = await fwLoadFollowing(myId);
  if (!following.length) return [];
  const ids = following.map((f) => f.id);
  const profileById = {};
  following.forEach((f) => { profileById[f.id] = f; });

  const days = fwLastNDays(FEED_WINDOW_DAYS + 5); // ein paar Tage Puffer für die Baseline
  const fromDay = days[0];

  const [{ data: profs }, { data: dailyRows }, { data: testRows }] = await Promise.all([
    window.sb.from('profiles').select('id, total_xp').in('id', ids),
    window.sb.from('xp_daily').select('user_id, day, xp').in('user_id', ids).gte('day', fromDay),
    window.sb.from('test_results').select('id, user_id, topic_title, score, total, passed, created_at')
      .in('user_id', ids).eq('passed', true).gte('created_at', fromDay).order('created_at', { ascending: false }).limit(50),
  ]);

  const totalXpById = {};
  (profs || []).forEach((p) => { totalXpById[p.id] = p.total_xp || 0; });

  const xpByUserDay = {};
  (dailyRows || []).forEach((r) => {
    xpByUserDay[r.user_id] = xpByUserDay[r.user_id] || {};
    xpByUserDay[r.user_id][r.day] = r.xp || 0;
  });

  const windowDays = fwLastNDays(FEED_WINDOW_DAYS + 5); // gleich wie 'days', explizit fürs Streak-Zählen
  const items = [];

  ids.forEach((uid) => {
    const prof = profileById[uid];
    if (!prof) return;
    const dailyXpByDay = windowDays.map((day) => ({ day, xp: (xpByUserDay[uid] && xpByUserDay[uid][day]) || 0 }));
  
    computeStreakMilestones(dailyXpByDay).forEach(({ day, streakDays }) => {
      if (!windowDays.slice(-FEED_WINDOW_DAYS).includes(day)) return;
      items.push({
        eventKey: `streak:${uid}:${day}`, userId: uid, profile: prof, day,
        icon: '🔥', text: `hat eine ${streakDays}-Tage-Serie erreicht`,
      });
    });

    computeLevelUps(totalXpById[uid] || 0, dailyXpByDay).forEach(({ day, level, title }) => {
      if (!windowDays.slice(-FEED_WINDOW_DAYS).includes(day)) return;
      items.push({
        eventKey: `levelup:${uid}:${day}`, userId: uid, profile: prof, day,
        icon: '🎉', text: `ist jetzt Level ${level} (${title})`,
      });
    });
  });

  (testRows || []).forEach((r) => {
    const prof = profileById[r.user_id];
    if (!prof) return;
    const day = fwDayKey(new Date(r.created_at));
    const pct = Math.round((r.score / Math.max(1, r.total)) * 100);
    items.push({
      eventKey: `test:${r.id}`, userId: r.user_id, profile: prof, day,
      icon: '✅', text: `hat den Übungstest zu "${r.topic_title}" bestanden (${pct}%)`,
      ts: new Date(r.created_at).getTime(),
    });
  });

  items.forEach((it) => { if (!it.ts) it.ts = new Date(it.day + 'T12:00:00').getTime(); });
  items.sort((a, b) => b.ts - a.ts);
  const capped = items.slice(0, FEED_LIMIT);

  if (capped.length) {
    const keys = capped.map((it) => it.eventKey);
    const { data: reactions } = await window.sb.from('feed_reactions').select('event_key, user_id').in('event_key', keys);
    const byKey = {};
    (reactions || []).forEach((r) => {
      byKey[r.event_key] = byKey[r.event_key] || { count: 0, mine: false };
      byKey[r.event_key].count += 1;
      if (r.user_id === myId) byKey[r.event_key].mine = true;
    });
    capped.forEach((it) => {
      const r = byKey[it.eventKey] || { count: 0, mine: false };
      it.reactionCount = r.count; it.myReaction = r.mine;
    });
  }
  return capped;
}

async function fwToggleReaction(eventKey, myId) {
  if (!window.sb || !myId) return { ok: false };
  const { data } = await window.sb.from('feed_reactions').select('event_key').eq('event_key', eventKey).eq('user_id', myId).maybeSingle();
  if (data) {
    await window.sb.from('feed_reactions').delete().eq('event_key', eventKey).eq('user_id', myId);
    return { ok: true, reacted: false };
  }
  await window.sb.from('feed_reactions').insert({ event_key: eventKey, user_id: myId });
  return { ok: true, reacted: true };
}

/* ============== FOLLOW-BUTTON (kleine wiederverwendbare Komponente) ============== */
function FollowButton({ myId, otherId, initiallyFollowing, onChange }) {
  const [following, setFollowing] = useStateFollows(!!initiallyFollowing);
  const [busy, setBusy] = useStateFollows(false);
  const toggle = async () => {
    if (!myId || busy) return;
    setBusy(true);
    try {
      if (following) { await fwUnfollow(myId, otherId); setFollowing(false); }
      else { await fwFollow(myId, otherId); setFollowing(true); }
      onChange && onChange();
    } catch (e) { /* z.B. schon gefolgt — UI ignoriert das still */ }
    setBusy(false);
  };
  return (
    <button className={'btn ' + (following ? 'btn-ghost' : 'btn-primary')} style={{ padding: '8px 16px', fontSize: 13 }} disabled={busy} onClick={toggle}>
      {following ? 'Gefolgt' : 'Folgen'}
    </button>
  );
}

window.Follows = {
  search: fwSearchUsers, follow: fwFollow, unfollow: fwUnfollow,
  loadFollowing: fwLoadFollowing, loadFollowers: fwLoadFollowers, counts: fwCounts,
  buildFeed: fwBuildFeed, toggleReaction: fwToggleReaction, recordTestResult: fwRecordTestResult,
  FollowButton,
  _pure: { levelForXp, isStreakMilestone, computeStreakMilestones, computeLevelUps, dayKey: fwDayKey, lastNDays: fwLastNDays },
};
