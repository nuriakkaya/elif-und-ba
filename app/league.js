/* global React, Icon, AnimalAvatar */
const { useState: useStateLg, useEffect: useEffectLg } = React;

/* ==============================================================
   Aura-Liga (Blueprint Phase 12, 20.07.2026). Bei Gizmo live beobachtet:
   ein globales wöchentliches Liga-System mit mehreren Stufen (Pilz/
   Diamant/Wolke/Aura/… vermutlich weitere gesperrte Folgestufen, die
   live nicht erreicht/vermessen wurden — wir bilden deshalb nur diese
   vier ab), Top-5 steigen wöchentlich auf, Countdown bis Rundenende,
   echtes globales Ranking (nicht nur Freunde) mit eigener Position
   hervorgehoben. Unterscheidet sich bewusst von `FriendsRanking`
   (app/main.js): hier werden zufällige ~30er-Gruppen ("Kohorten") aus
   ALLEN Nutzer:innen einer Stufe gebildet.

   Kein Server-Cron für den wöchentlichen Reset — siehe
   supabase/schema.sql Abschnitt 19 für die vollständige Begründung des
   Lazy-Wochenwechsels und den bewusst in Kauf genommenen
   Kohorten-Zuteilungs-Race.

   **Annahme, nicht bei Gizmo verifiziert**: die Abstiegs-Regel (letzte 5
   steigen ab) ist bei Gizmo live nicht beobachtet worden (nur der Aufstieg
   der Top-5 ist in der Checkliste vermerkt) — ohne irgendeine Form von
   Abstieg wäre das System aber nach ein paar Wochen bedeutungslos (alle
   Nutzer:innen würden sich in der höchsten Stufe stauen), deshalb bewusst
   ergänzt, analog zum "kleines Tages-Soll für die Serie"-Muster (dort
   ebenfalls dokumentierte Annahme statt Erfindung ohne Kennzeichnung).
   ============================================================== */

// (Ausbau 23.07.2026, nach Live-Erkundung von app.gizmo.ai) Gizmo zeigt in der
// Liga-Leiste 7 Stufen: die vier live sichtbaren (Pilz/Diamant/Wolke/Aura) plus
// DREI höhere, die als gesperrtes "?" dargestellt werden, solange man sie nicht
// erreicht hat. Wir bilden das jetzt genauso ab: die Namen der obersten drei sind
// bei Gizmo nicht einsehbar (immer "?"), unsere Namen (Nova/Galaxie/Kosmos) sind
// daher eine bewusste, dokumentierte Eigenwahl — angezeigt werden sie ohnehin erst,
// wenn man die Stufe erreicht; darunter erscheint wie im Original ein Schloss + "?".
const LEAGUE_TIERS = [
  { name: 'Pilz', icon: '🍄' },
  { name: 'Diamant', icon: '💎' },
  { name: 'Wolke', icon: '☁️' },
  { name: 'Aura', icon: '✨' },
  { name: 'Nova', icon: '⭐' },
  { name: 'Galaxie', icon: '🌌' },
  { name: 'Kosmos', icon: '🪐' },
];
const MAX_COHORT_SIZE = 30;
const PROMOTE_COUNT = 5;
const DEMOTE_COUNT = 5;
const MIN_COHORT_FOR_DEMOTION = 10;

function lgWeekKey(d) {
  const x = new Date(d || new Date());
  const dow = (x.getDay() + 6) % 7; // 0 = Montag
  x.setDate(x.getDate() - dow);
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
}
function lgPrevWeekKey(weekKey) {
  const d = new Date(weekKey + 'T00:00:00');
  d.setDate(d.getDate() - 7);
  return lgWeekKey(d);
}

// Reine Auf-/Abstiegs-Logik: Top PROMOTE_COUNT steigen auf (falls nicht schon
// höchste Stufe), untere DEMOTE_COUNT steigen ab (nur bei ausreichend großer
// Kohorte, sonst bleibt jede:r auf der Stufe) — ohne Supabase testbar.
// (Review 21.07.2026) Aufstieg zusätzlich nur mit >0 Wochen-XP — vorher stieg man
// in einer 1-Personen-Kohorte mit 0 XP jede Woche automatisch auf, und alle hätten
// sich nach wenigen Wochen untätig in "Aura" gestaut.
function lgNextTierIndex(tierIndex, rank, cohortSize, maxTierIndex, weekXp) {
  if (rank <= PROMOTE_COUNT && tierIndex < maxTierIndex && (weekXp === undefined || weekXp > 0)) return tierIndex + 1;
  if (cohortSize >= MIN_COHORT_FOR_DEMOTION && rank > cohortSize - DEMOTE_COUNT && tierIndex > 0) return tierIndex - 1;
  return tierIndex;
}

// Reine Kohorten-Zuteilung: findet unter vorhandenen Mitgliedschafts-Zeilen
// (nur { cohort_key } nötig) eine Kohorte mit < maxSize Mitgliedern, sonst null
// (Aufrufer legt dann eine neue Kohorte an).
function lgFindCohortWithRoom(existingRows, maxSize) {
  const counts = {};
  (existingRows || []).forEach((r) => { counts[r.cohort_key] = (counts[r.cohort_key] || 0) + 1; });
  const withRoom = Object.keys(counts).find((k) => counts[k] < maxSize);
  return withRoom || null;
}

// Reine Countdown-Berechnung: Millisekunden bis zum Beginn der nächsten
// Kalenderwoche (Montag 00:00), aufgeteilt in Tage/Stunden/Minuten.
function lgCountdownParts(now) {
  const n = now || new Date();
  const weekKey = lgWeekKey(n);
  const nextMonday = new Date(weekKey + 'T00:00:00');
  nextMonday.setDate(nextMonday.getDate() + 7);
  const ms = Math.max(0, nextMonday.getTime() - n.getTime());
  const totalMin = Math.floor(ms / 60000);
  return { days: Math.floor(totalMin / 1440), hours: Math.floor((totalMin % 1440) / 60), minutes: totalMin % 60 };
}

/* ---- Supabase-Zugriffe ---- */

async function lgGetOrCreateMembership(myId) {
  const weekKey = lgWeekKey();
  const { data: existing } = await window.sb.from('league_memberships').select('*').eq('user_id', myId).eq('week_key', weekKey).maybeSingle();
  if (existing) return existing;

  // Startstufe: aus der Vorwoche ableiten (Auf-/Abstieg), sonst Startstufe 0 (Pilz).
  let tierIndex = 0;
  const prevWeekKey = lgPrevWeekKey(weekKey);
  const { data: prevMembership } = await window.sb.from('league_memberships').select('*').eq('user_id', myId).eq('week_key', prevWeekKey).maybeSingle();
  if (prevMembership) {
    tierIndex = prevMembership.tier_index;
    const { data: cohortRows } = await window.sb.from('league_memberships').select('user_id')
      .eq('week_key', prevWeekKey).eq('cohort_key', prevMembership.cohort_key);
    const ids = (cohortRows || []).map((r) => r.user_id);
    if (ids.length) {
      const { data: xpRows } = await window.sb.from('xp_daily').select('user_id, day, xp')
        .in('user_id', ids).gte('day', prevWeekKey).lt('day', weekKey);
      const sums = {}; ids.forEach((id) => { sums[id] = 0; });
      (xpRows || []).forEach((r) => { sums[r.user_id] = (sums[r.user_id] || 0) + (r.xp || 0); });
      // Tiebreaker über die user_id: bei XP-Gleichstand wäre die Reihenfolge sonst
      // je Client zufällig — zwei Punktgleiche an der Auf-/Abstiegsgrenze hätten
      // unterschiedliche Ränge berechnet. (Review 21.07.2026)
      const sorted = ids.slice().sort((a, b) => ((sums[b] || 0) - (sums[a] || 0)) || (a < b ? -1 : 1));
      const myRank = sorted.indexOf(myId) + 1;
      tierIndex = lgNextTierIndex(prevMembership.tier_index, myRank, ids.length, LEAGUE_TIERS.length - 1, sums[myId] || 0);
    }
  }

  const { data: tierRows } = await window.sb.from('league_memberships').select('cohort_key').eq('week_key', weekKey).eq('tier_index', tierIndex);
  let cohortKey = lgFindCohortWithRoom(tierRows || [], MAX_COHORT_SIZE);
  if (!cohortKey) cohortKey = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : ('c-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));

  const { data: inserted, error } = await window.sb.from('league_memberships')
    .insert({ user_id: myId, week_key: weekKey, tier_index: tierIndex, cohort_key: cohortKey }).select().single();
  if (error) {
    // Race: eine andere Session hat evtl. inzwischen schon eine Zeile für diese Woche angelegt.
    const { data: retry } = await window.sb.from('league_memberships').select('*').eq('user_id', myId).eq('week_key', weekKey).maybeSingle();
    if (retry) return retry;
    throw error;
  }
  return inserted;
}

async function lgLoadCohortRanking(membership, myId) {
  if (!window.sb || !membership) return [];
  const { data: memberRows } = await window.sb.from('league_memberships').select('user_id')
    .eq('week_key', membership.week_key).eq('cohort_key', membership.cohort_key);
  const ids = (memberRows || []).map((r) => r.user_id);
  if (!ids.length) return [];
  // (Review 21.07.2026) Obere Datumsgrenze ergänzt — ohne sie hätten Nutzer:innen in
  // vorauseilenden Zeitzonen mit bereits geschriebenen Montags-Zeilen ins ALTE
  // Wochenranking hineingezählt. (Untergrenze war schon korrekt.)
  const nextWeek = lgWeekKey(new Date(new Date(membership.week_key + 'T00:00:00').getTime() + 8 * 86400000));
  const [{ data: profs }, { data: xpRows }] = await Promise.all([
    window.sb.from('profiles').select('id, username, avatar, is_private').in('id', ids),
    window.sb.from('xp_daily').select('user_id, day, xp').in('user_id', ids).gte('day', membership.week_key).lt('day', nextWeek),
  ]);
  const sums = {}; ids.forEach((id) => { sums[id] = 0; });
  (xpRows || []).forEach((r) => { sums[r.user_id] = (sums[r.user_id] || 0) + (r.xp || 0); });
  return (profs || [])
    .map((p) => ({
      ...p,
      // Private Profile (Phase 16) erscheinen im globalen Kohorten-Ranking anonymisiert
      // (außer für sich selbst) — die Liga braucht die Zeile fürs Ranking, aber nicht
      // den Klarnamen. (Review 21.07.2026)
      username: (p.is_private && p.id !== myId) ? 'Anonym' : p.username,
      avatar: (p.is_private && p.id !== myId) ? '🕶️' : p.avatar,
      weekXp: sums[p.id] || 0,
    }))
    .sort((a, b) => (b.weekXp - a.weekXp) || (a.id < b.id ? -1 : 1));
}

/* ---- UI ---- */

function LeagueCard({ ctx, myId }) {
  const { go, session } = ctx;
  const [membership, setMembership] = useStateLg(null);
  const [ranking, setRanking] = useStateLg(null);
  const [countdown, setCountdown] = useStateLg(() => lgCountdownParts());

  useEffectLg(() => {
    let cancelled = false;
    if (!myId || !window.sb) { setMembership(null); setRanking(null); return; }
    lgGetOrCreateMembership(myId).then((m) => {
      if (cancelled) return;
      setMembership(m);
      lgLoadCohortRanking(m, myId).then((r) => { if (!cancelled) setRanking(r); });
    }).catch((e) => console.warn('[league] Mitgliedschaft konnte nicht geladen werden:', e && e.message));
    return () => { cancelled = true; };
  }, [myId]);

  useEffectLg(() => {
    const t = setInterval(() => setCountdown(lgCountdownParts()), 60000);
    return () => clearInterval(t);
  }, []);

  const tier = LEAGUE_TIERS[(membership && membership.tier_index) || 0];
  const myRank = (ranking && myId) ? (ranking.findIndex((r) => r.id === myId) + 1) : 0;

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontWeight: 800 }}>Aura-Liga</div>
        {session && <button className="link" onClick={() => go('league')}>Alle ansehen</button>}
      </div>
      {!session && <div className="muted">Melde dich an, um an der Aura-Liga teilzunehmen — einer globalen Wochen-Rangliste mit Auf- und Abstieg.</div>}
      {session && !ranking && <div className="muted">Lädt…</div>}
      {session && ranking && (
        <>
          <div className="row" style={{ gap: 14, alignItems: 'center' }}>
            <div style={{ fontSize: 34 }}>{tier.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800 }}>{tier.name}-Liga{myRank > 0 ? ` · Platz ${myRank} von ${ranking.length}` : ''}</div>
              <div className="muted" style={{ fontSize: 12.5 }}>Endet in {countdown.days > 0 ? `${countdown.days} Tg. ` : ''}{countdown.hours} Std. {countdown.minutes} Min.</div>
            </div>
          </div>
          <div className="col" style={{ marginTop: 12 }}>
            {ranking.slice(0, 3).map((p, i) => (
              <div key={p.id} className="row" style={{ justifyContent: 'space-between', padding: '6px 0' }}>
                <span>{i + 1}. {p.username}{p.id === myId ? ' (du)' : ''}</span>
                <span style={{ fontWeight: 800 }}>{p.weekXp} XP</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LeagueScreen({ ctx }) {
  const { session, go } = ctx;
  const myId = session && session.user && session.user.id;
  const [membership, setMembership] = useStateLg(null);
  const [ranking, setRanking] = useStateLg(null);
  const [countdown, setCountdown] = useStateLg(() => lgCountdownParts());

  useEffectLg(() => {
    let cancelled = false;
    if (!myId || !window.sb) return;
    lgGetOrCreateMembership(myId).then((m) => {
      if (cancelled) return;
      setMembership(m);
      lgLoadCohortRanking(m, myId).then((r) => { if (!cancelled) setRanking(r); });
    }).catch((e) => console.warn('[league] Liga konnte nicht geladen werden:', e && e.message));
    return () => { cancelled = true; };
  }, [myId]);

  useEffectLg(() => {
    const t = setInterval(() => setCountdown(lgCountdownParts()), 60000);
    return () => clearInterval(t);
  }, []);

  if (!session) {
    return (
      <div className="page" style={{ maxWidth: 720 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button className="icon-btn" onClick={() => go('progress')}><Icon.Back /></button>
          <h1 style={{ fontSize: 22 }}>Aura-Liga</h1>
          <div style={{ width: 34 }} />
        </div>
        <div className="card flat tinted" style={{ padding: 20, textAlign: 'center' }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Erst anmelden</div>
          <div className="muted" style={{ marginBottom: 14 }}>Melde dich an, um an der Aura-Liga teilzunehmen.</div>
          <button className="btn btn-primary" onClick={() => ctx.openModal('auth')}>Anmelden</button>
        </div>
      </div>
    );
  }

  const tier = LEAGUE_TIERS[(membership && membership.tier_index) || 0];
  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button className="icon-btn" onClick={() => go('progress')}><Icon.Back /></button>
        <h1 style={{ fontSize: 22 }}>{tier.icon} {tier.name}-Liga</h1>
        <div style={{ width: 34 }} />
      </div>
      <div className="card flat tinted" style={{ padding: 16, textAlign: 'center', marginBottom: 10 }}>
        <div className="muted">Endet in {countdown.days > 0 ? `${countdown.days} Tage ` : ''}{countdown.hours} Std. {countdown.minutes} Min.</div>
        <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>Top {PROMOTE_COUNT} steigen auf · letzte {DEMOTE_COUNT} steigen ab</div>
      </div>
      {/* Stufen-Leiste: aktuelle Stufe hervorgehoben, höhere Stufen wie bei Gizmo
          gesperrt als 🔒/? (Name erst sichtbar, sobald erreicht). */}
      <div className="row" style={{ gap: 6, marginBottom: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {LEAGUE_TIERS.map((t, i) => {
          const cur = membership ? membership.tier_index : 0;
          const locked = i > cur;
          return (
            <span key={t.name} className="pill" title={locked ? 'Noch gesperrt' : (t.name + '-Liga')}
                  style={{ opacity: i === cur ? 1 : locked ? 0.35 : 0.55, fontWeight: i === cur ? 800 : 600 }}>
              {locked ? '🔒 ?' : `${t.icon} ${t.name}`}
            </span>
          );
        })}
      </div>
      {!ranking && <div className="muted center">Lädt…</div>}
      {ranking && (() => {
        // Auf-/Abstiegszonen-Trennlinien wie bei Gizmo ("↓ Abstiegszone ↓"):
        // grüne Aufstiegslinie nach den Top PROMOTE_COUNT, rote Abstiegslinie vor
        // den letzten DEMOTE_COUNT (nur wenn die Kohorte groß genug für Abstieg ist).
        const n = ranking.length;
        const notTop = (membership && membership.tier_index >= LEAGUE_TIERS.length - 1);
        const promoteAfter = notTop ? -1 : PROMOTE_COUNT; // höchste Stufe: kein Aufstieg
        const demoteBefore = (n >= MIN_COHORT_FOR_DEMOTION && membership && membership.tier_index > 0) ? (n - DEMOTE_COUNT) : -1;
        const rows = [];
        ranking.forEach((p, i) => {
          const me = p.id === myId;
          rows.push(
              <div key={p.id} className="card flat" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 14, background: me ? 'var(--accent-soft)' : undefined }}>
                {i < 3 ? <div className={'medal ' + (i === 1 ? 'silver' : i === 2 ? 'bronze' : '')}>{i + 1}</div> : <div style={{ width: 28, textAlign: 'center', fontWeight: 800 }}>{i + 1}</div>}
                <AnimalAvatar kind={p.avatar || '🦔'} size={40} />
                <div style={{ flex: 1, fontWeight: 700 }}>{p.username}{me ? ' (du)' : ''}</div>
                <span className="xp-pill">{p.weekXp} XP</span>
              </div>
          );
          if (i + 1 === promoteAfter && i + 1 < n) {
            rows.push(<div key="promo" style={{ textAlign: 'center', fontWeight: 800, fontSize: 12.5, color: 'var(--success)', padding: '4px 0' }}>↑ Aufstiegszone ↑</div>);
          }
          if (i + 1 === demoteBefore && i + 1 < n) {
            rows.push(<div key="demo" style={{ textAlign: 'center', fontWeight: 800, fontSize: 12.5, color: 'var(--rose)', padding: '4px 0' }}>↓ Abstiegszone ↓</div>);
          }
        });
        return <div className="col">{rows}</div>;
      })()}
    </div>
  );
}

window.League = {
  getOrCreateMembership: lgGetOrCreateMembership, loadCohortRanking: lgLoadCohortRanking,
  LeagueCard, LeagueScreen, TIERS: LEAGUE_TIERS,
  _pure: { weekKey: lgWeekKey, prevWeekKey: lgPrevWeekKey, nextTierIndex: lgNextTierIndex, findCohortWithRoom: lgFindCohortWithRoom, countdownParts: lgCountdownParts },
};
