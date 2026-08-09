/* ==============================================================
   XP — echtes Punktesystem, exakt nach den im Original gemessenen
   Werten (Live-Session app.gizmo.ai, 14.07.2026):

   - 17 XP pro richtiger Antwort (ohne Fehlversuch in diesem Auftritt).
   - Combo-Multiplikator: ab 3 richtigen in Folge 1,5x (= +26 XP),
     ab 5 in Folge 2x (= +34 XP). Popup "3 in Folge!" / "5 in Folge!".
   - Combo bricht bei JEDEM Fehlversuch sofort auf 0.
   - +1 Münze bei jedem Combo-Meilenstein (3, 5, 10, 15, ...).
   - Requeue-Karten ("Erneut versuchen") geben beim 2. Auftritt ganz
     normal XP — die Combo läuft über sie weiter (gemessen: Retry-Kette
     17 -> 17 -> 26 -> 26 -> 34 -> 34).
   - Blitzfragen und "Erklären"/"Aufdecken" geben KEINE XP.
   - Rundenabschluss: +8 XP Bonus (gemessen auf dem Runden-Ende-Screen).
   - Tages-Serie (Streak): Kalendertag zählt erst, wenn ein kleines Tages-Soll an
     richtigen Antworten erreicht ist (16.07.2026 live beobachtet: Fortschritt-Seite
     zeigte mitten am Tag "2 Fragen, um deine Serie fortzusetzen" — also NICHT schon
     nach der 1. Antwort gesichert, wie wir vorher angenommen hatten). Die genaue
     Sollzahl ist nicht abschließend vermessen, siehe STREAK_DAILY_TARGET unten.

   Shop-Items (Blueprint Phase 6, 20.07.2026 — eigene Feature-Entscheidung, NICHT bei
   Gizmo live vermessen, da im Shop dort nicht im Detail geprüft):
   - **Serien-Freeze** (buyStreakFreeze, Kosten STREAK_FREEZE_COST): wird VOR einem
     verpassten Tag gekauft und liegt als Inventar bereit. Verpasst man trotzdem genau
     einen Tag, wird beim nächsten touchDay() automatisch ein Freeze verbraucht statt
     die Serie zurückzusetzen.
   - **Serien-Reparatur** (repairStreak, Kosten STREAK_REPAIR_COST): wird NACH einem
     gerade erst (am selben Kalendertag) gebrochenen Streak gekauft und stellt den
     alten Stand wieder her — reine Nachträglich-Aktion, nur am Bruchtag selbst
     möglich (siehe lastBreak).
   - **Cosmetics/Avatare** (buyCosmetic, 20.07.2026 — "Restliche Shop-Items", eigene
     Feature-Entscheidung): ein paar zusätzliche Avatar-Emojis (PREMIUM_AVATARS) sind
     im Shop käuflich freischaltbar, statt von Anfang an frei wählbar zu sein (die
     bisherigen 16 Tier-Avatare in EditProfileModal bleiben alle kostenlos). Einmal
     gekauft, taucht der Avatar dauerhaft im Auswahl-Raster auf.
   ============================================================== */
(function () {
  const KEY = 's34a_xp_v1';
  const BASE = 17;
  const ROUND_BONUS = 8;
  // ACHTUNG: nur eine grobe Annahme, KEIN gemessener Wert. Live bei Gizmo wurde einmal
  // mitten in einem Tag "2 Fragen, um deine Serie fortzusetzen" beobachtet — das belegt
  // nur, dass es ein kleines Tages-Soll gibt (nicht "1 Antwort reicht"), nicht die genaue
  // Zahl. 5 ist ein plausibler Duolingo-artiger Standardwert. Vor einem Release nochmal
  // an einem frischen Tag live nachmessen und hier korrigieren.
  const STREAK_DAILY_TARGET = 5;
  // (Ausbau 25.07.2026, nach Live-Erkundung von app.gizmo.ai) Gizmo zeigt NEBEN dem
  // kleinen Serien-Tagesziel ein zweites, höheres Tagesziel: "N Fragen, um deine
  // Gold-Serie zu bekommen". Erreicht man es, wird der Tag zum "Gold-Tag" (im Kalender
  // golden markiert), und aufeinanderfolgende Gold-Tage bilden eine eigene "Gold-Serie".
  // Der genaue Zielwert war live nicht sicher ablesbar — 15 ist eine plausible, bewusst
  // dokumentierte Annahme (3× das normale Tagesziel), vor Release live nachzumessen.
  const GOLD_DAILY_TARGET = 15;
  // Shop-Preise (Blueprint Phase 6) — eigene, nicht bei Gizmo live vermessene Werte,
  // bewusst niedrig gehalten, weil Münzen selten (nur an Combo-Meilensteinen) anfallen.
  const STREAK_FREEZE_COST = 5;
  const STREAK_REPAIR_COST = 8;
  // Cosmetics: käuflich freischaltbare Zusatz-Avatare (die 16 Basis-Avatare in
  // EditProfileModal bleiben unabhängig davon alle kostenlos).
  const PREMIUM_AVATARS = [
    { id: '🐲', name: 'Drache', cost: 6 },
    { id: '🦁', name: 'Löwe', cost: 6 },
    { id: '🐯', name: 'Tiger', cost: 6 },
    { id: '🦖', name: 'T-Rex', cost: 8 },
    { id: '🦩', name: 'Flamingo', cost: 8 },
  ];

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function save(st) {
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* voll/gesperrt */ }
  }
  function state() {
    const st = load();
    return {
      total: st.total || 0,
      coins: st.coins || 0,
      days: st.days || {},          // 'YYYY-MM-DD' -> XP an dem Tag
      topics: st.topics || {},      // topicId -> XP in diesem Themengebiet (fürs Deck-Leaderboard)
      streakDays: st.streakDays || 0,
      lastActive: st.lastActive || null, // letzter Tag mit Aktivität
      answersToday: st.answersToday || null, // { date, count } - richtige Antworten heute
      goldDays: st.goldDays || {},  // 'YYYY-MM-DD' -> true, Tage mit erreichtem Gold-Ziel (Ausbau 25.07.2026)
      streakFreezes: st.streakFreezes || 0, // gekaufte Serien-Freezes (Shop, Phase 6)
      lastBreak: st.lastBreak || null, // { prevStreak, brokenOn } - nur am selben Tag reparierbar
      ownedCosmetics: st.ownedCosmetics || [], // gekaufte Premium-Avatar-Emojis (Shop, Phase 6)
      walletTs: st.walletTs || 0, // Zeitstempel der letzten Muenz-/Freeze-Aenderung (Review 21.07.2026)
    };
  }
  function dayKey(d) {
    const x = d || new Date();
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  }

  // Wie viele richtige Antworten wurden HEUTE schon gezählt (für das Serien-Tagesziel)?
  function answersToday(st) {
    const today = dayKey();
    return (st.answersToday && st.answersToday.date === today) ? st.answersToday.count : 0;
  }
  function bumpAnswersToday(st) {
    const today = dayKey();
    if (!st.answersToday || st.answersToday.date !== today) st.answersToday = { date: today, count: 0 };
    st.answersToday.count += 1;
    // Gold-Tagesziel erreicht -> Tag als Gold-Tag markieren (Ausbau 25.07.2026).
    if (st.answersToday.count >= GOLD_DAILY_TARGET) {
      if (!st.goldDays) st.goldDays = {};
      st.goldDays[today] = true;
    }
  }

  function mult(combo) { return combo >= 5 ? 2 : combo >= 3 ? 1.5 : 1; }

  // combo = Stand NACH dieser richtigen Antwort (1-basiert).
  // Meilenstein bei 3, 5 und danach jedem 5er-Schritt.
  // Ausgerüstetes Monster (app/monsters.js, Phase 11) gibt einen passiven
  // XP-Bonus obendrauf — bei Gizmo live beobachtet ("Phönix = +50% XP").
  function award(combo) {
    const m = mult(combo);
    const monsterBonus = (window.Monsters && window.Monsters.equippedBonus()) || 0;
    const xp = Math.round(BASE * m * (1 + monsterBonus));
    const milestone = combo === 3 || combo === 5 || (combo > 5 && combo % 5 === 0);
    const coins = milestone ? 1 : 0;
    const st = state();
    st.total += xp;
    st.coins += coins;
    if (coins > 0) st.walletTs = Date.now(); // Wallet-LWW, siehe pullAndMerge
    const dk = dayKey();
    st.days[dk] = (st.days[dk] || 0) + xp;
    bumpAnswersToday(st);
    save(st);
    schedulePush();
    return { xp, coins, mult: m, milestone, combo };
  }

  function addBonus(xp) {
    const st = state();
    st.total += xp;
    const dk = dayKey();
    st.days[dk] = (st.days[dk] || 0) + xp;
    save(st);
    schedulePush();
    return xp;
  }
  function endRound() { return addBonus(ROUND_BONUS); }

  // XP einem Thema gutschreiben (fürs Deck-Leaderboard). Wird zusätzlich zu total/days
  // aufgerufen, nie stattdessen — topics ist eine reine Aufschlüsselung nach Stapel.
  function bumpTopic(topicId, xp) {
    if (!topicId || !xp) return;
    const st = state();
    st.topics = st.topics || {};
    st.topics[topicId] = (st.topics[topicId] || 0) + xp;
    save(st);
    schedulePush();
  }

  // Tages-Serie fortschreiben. Anders als vorher NICHT mehr beim ersten Treffer des
  // Tages, sondern erst wenn das Tages-Soll (STREAK_DAILY_TARGET richtige Antworten)
  // erreicht ist — so wie live bei Gizmo beobachtet ("2 Fragen, um deine Serie
  // fortzusetzen" mitten am Tag, nicht "bereits gesichert nach 1 Antwort").
  // Rückgabe: { extended, streakDays, needed, freezeUsed } — needed = noch fehlende
  // Antworten heute, freezeUsed = ein gekaufter Serien-Freeze (Shop, Phase 6) hat
  // automatisch genau einen verpassten Tag abgefedert.
  function touchDay() {
    const st = state();
    const today = dayKey();
    if (st.lastActive === today) return { extended: false, streakDays: st.streakDays, needed: 0 };
    const done = answersToday(st);
    if (done < STREAK_DAILY_TARGET) {
      return { extended: false, streakDays: st.streakDays, needed: STREAK_DAILY_TARGET - done };
    }
    const y1 = new Date(); y1.setDate(y1.getDate() - 1);
    const yesterday = dayKey(y1);
    // Wie viele KOMPLETTE Tage wurden seit dem letzten aktiven Tag verpasst?
    // (Review 21.07.2026: vorher deckte ein Freeze nur GENAU einen verpassten Tag
    // ab — wer 2 Freezes gehortet hatte und 2 Tage aussetzte, verlor die Serie
    // trotzdem. Jetzt verbrauchen n verpasste Tage n Freezes, wenn genug da sind.)
    let missedDays = null;
    if (st.lastActive) {
      const last = new Date(st.lastActive + 'T00:00:00');
      const now = new Date(today + 'T00:00:00');
      missedDays = Math.round((now - last) / 86400000) - 1; // 0 = lückenlos
    }
    let freezeUsed = false;
    if (st.lastActive === yesterday) {
      // Serie lückenlos fortgesetzt — nichts zu reparieren.
      st.streakDays = st.streakDays + 1;
      st.lastBreak = null;
    } else if (missedDays !== null && missedDays >= 1 && (st.streakFreezes || 0) >= missedDays) {
      // Verpasste Tage werden durch gehortete Freezes gedeckt (n Tage = n Freezes) —
      // die Serie zählt so, als wären die verpassten Tage mitgezählt worden.
      st.streakFreezes = st.streakFreezes - missedDays;
      st.walletTs = Date.now();
      st.streakDays = st.streakDays + 1;
      st.lastBreak = null;
      freezeUsed = true;
    } else {
      // Serie gebrochen. Den alten Stand kurz merken (nur heute reparierbar per
      // repairStreak(), siehe unten), dann auf 1 zurücksetzen.
      st.lastBreak = st.streakDays > 1 ? { prevStreak: st.streakDays, brokenOn: today } : null;
      st.streakDays = 1;
    }
    st.lastActive = today;
    save(st);
    schedulePush();
    // Monster-Freischaltungen prüfen (Phase 11) — Serienlänge hat sich gerade geändert.
    const hatched = (window.Monsters && window.Monsters.checkUnlocks()) || [];
    return { extended: true, streakDays: st.streakDays, needed: 0, freezeUsed, hatched };
  }

  // Bequemer Status für die UI (Fortschritt-Seite): wie viele Antworten fehlen noch,
  // um die Serie heute zu sichern, und ist sie schon gesichert?
  function streakStatus() {
    const st = state();
    const today = dayKey();
    const done = answersToday(st);
    const needed = Math.max(0, STREAK_DAILY_TARGET - done);
    return { needed, target: STREAK_DAILY_TARGET, done, secured: st.lastActive === today || needed <= 0 };
  }

  // Zweites, höheres Tagesziel (Ausbau 25.07.2026): wie viele Antworten fehlen noch für
  // den heutigen Gold-Tag, und ist er schon erreicht?
  function goldStatus() {
    const st = state();
    const done = answersToday(st);
    const needed = Math.max(0, GOLD_DAILY_TARGET - done);
    return { needed, target: GOLD_DAILY_TARGET, done, achieved: !!st.goldDays[dayKey()] || needed <= 0 };
  }

  // Länge der aktuellen Gold-Serie: aufeinanderfolgende Gold-Tage, die bis heute oder
  // gestern reichen (heute darf noch offen sein, ohne die Serie zu brechen — analog zur
  // normalen Serie). Reine Ableitung aus st.goldDays.
  function goldStreakDays() {
    const st = state();
    const gold = st.goldDays || {};
    let count = 0;
    // Startpunkt: heute, falls heute schon Gold; sonst gestern (heute noch offen).
    const start = new Date();
    if (!gold[dayKey(start)]) start.setDate(start.getDate() - 1);
    for (let d = new Date(start); gold[dayKey(d)]; d.setDate(d.getDate() - 1)) count++;
    return count;
  }

  // Münzen atomar abziehen (Shop-Kauf, Phase 6). Gibt false zurück und ändert nichts,
  // wenn der Kontostand nicht reicht — "atomar" heißt hier: Prüfung + Abzug in einem
  // synchronen Schritt auf dem lokalen State, kein Zwischenzustand mit halbem Abzug.
  function spend(cost) {
    const st = state();
    if (st.coins < cost) return false;
    st.coins -= cost;
    st.walletTs = Date.now();
    save(st);
    schedulePush();
    return true;
  }

  // Münzen gutschreiben (bislang einzige Quelle: Combo-Meilensteine in award()).
  // Neu dazugekommen als Verdienquelle: Referral-Belohnung (app/referral.js, Phase 16).
  function addCoins(n) {
    if (!n || n <= 0) return;
    const st = state();
    st.coins += n;
    st.walletTs = Date.now();
    save(st);
    schedulePush();
  }

  // Shop-Item 1: Serien-Freeze kaufen — schützt beim nächsten touchDay() automatisch
  // genau einen verpassten Tag vor dem Streak-Reset (siehe touchDay() oben).
  function buyStreakFreeze() {
    if (!spend(STREAK_FREEZE_COST)) return { ok: false, reason: 'coins' };
    const st = state();
    st.streakFreezes = (st.streakFreezes || 0) + 1;
    st.walletTs = Date.now();
    save(st);
    schedulePush();
    return { ok: true, streakFreezes: st.streakFreezes };
  }

  // Shop-Item 2: Serien-Reparatur — repariert eine HEUTE gebrochene Serie rückwirkend
  // (nur im selben Kalendertag möglich, siehe lastBreak in touchDay()). Reine
  // Kauf-Aktion im Nachhinein, anders als der Freeze, der VOR dem Bruch gekauft wird.
  function repairStreak() {
    const st = state();
    const today = dayKey();
    if (!st.lastBreak || st.lastBreak.brokenOn !== today) return { ok: false, reason: 'nothing-to-repair' };
    if (!spend(STREAK_REPAIR_COST)) return { ok: false, reason: 'coins' };
    const fresh = state();
    fresh.streakDays = fresh.lastBreak.prevStreak + 1;
    fresh.lastBreak = null;
    save(fresh);
    schedulePush();
    return { ok: true, streakDays: fresh.streakDays };
  }

  // Shop-Item 3: Cosmetics/Avatare — schaltet ein Premium-Avatar-Emoji dauerhaft frei.
  function buyCosmetic(avatarId) {
    const item = PREMIUM_AVATARS.find((a) => a.id === avatarId);
    if (!item) return { ok: false, reason: 'unknown' };
    const st = state();
    if ((st.ownedCosmetics || []).includes(avatarId)) return { ok: false, reason: 'already-owned' };
    if (!spend(item.cost)) return { ok: false, reason: 'coins' };
    const fresh = state();
    fresh.ownedCosmetics = Array.from(new Set([...(fresh.ownedCosmetics || []), avatarId]));
    save(fresh);
    schedulePush();
    return { ok: true, ownedCosmetics: fresh.ownedCosmetics };
  }

  // Level-Kurve: kumulierte Schwelle für Level n. Eigene Kurve (die
  // Original-Schwellen sind nicht einsehbar), quadratisch steigend:
  // L2 = 150 XP, L3 = 600, L5 = 2.400, L10 = 12.150, L18 = 43.350.
  function threshold(level) { return 150 * (level - 1) * (level - 1); }
  const TITLES = [[18, 'Legende'], [16, 'Champion'], [13, 'Master'], [11, 'Experte'], [8, 'Profi'], [5, 'Kenner'], [3, 'Azubi'], [1, 'Neuling']];
  function levelInfo() {
    const st = state();
    let lvl = 1;
    while (threshold(lvl + 1) <= st.total) lvl++;
    const cur = threshold(lvl), next = threshold(lvl + 1);
    const title = (TITLES.find(([min]) => lvl >= min) || TITLES[TITLES.length - 1])[1];
    return {
      level: lvl, title,
      total: st.total,
      nextAt: next,
      progress: Math.min(1, (st.total - cur) / Math.max(1, next - cur)),
    };
  }

  function fmt(n) {
    if (n >= 100000) return Math.round(n / 1000) + 'k';
    if (n >= 10000) return (Math.round(n / 100) / 10) + 'k';
    if (n >= 1000) return (Math.round(n / 100) / 10) + 'k';
    return String(n);
  }

  // Letzte n Kalendertage für den Serien-Kalender (Fortschritt-Seite).
  function recentDays(n) {
    const st = state();
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = dayKey(d);
      out.push({
        date: d, key,
        dayNum: d.getDate(),
        weekday: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][d.getDay()],
        xp: st.days[key] || 0,
        gold: !!(st.goldDays && st.goldDays[key]), // Gold-Tag (Ausbau 25.07.2026)
        isToday: i === 0,
        future: false,
      });
    }
    return out;
  }

  function todayXp() { const st = state(); return st.days[dayKey()] || 0; }

  /* ---- Supabase-Sync (optional, nur bei Login) ----
     Gleiches Muster wie app/srs.js: localStorage bleibt die synchrone
     Wahrheit für die UI; bei Login wird einmalig gemergt (max() je Wert —
     das Gerät mit mehr Fortschritt gewinnt) und danach jede Änderung
     debounced in die profiles-Zeile geschrieben (Spalten total_xp, coins,
     streak_days, last_active, streak_freezes, last_break — siehe
     supabase/schema.sql Abschnitt 7 + 11). */
  let currentUserId = null;
  let pushTimer = null;
  function pushRemote() {
    if (!currentUserId || !window.sb) return;
    const st = state();
    window.sb.from('profiles').update({
      total_xp: st.total, coins: st.coins, streak_days: st.streakDays,
      last_active: st.lastActive || null,
      streak_freezes: st.streakFreezes || 0, last_break: st.lastBreak || null,
      owned_cosmetics: st.ownedCosmetics || [],
      wallet_ts: st.walletTs || 0,
    }).eq('id', currentUserId).then(({ error }) => {
      if (error) console.warn('[xp] Supabase-Sync fehlgeschlagen:', error.message);
    });
    // Tagessumme fürs Zeitraum-Ranking (Tag/Woche/Monat). (Review 21.07.2026)
    // Vorher blind überschreibend — ein frisch eingeloggtes Zweitgerät mit 0 XP
    // hätte den heutigen Tageswert des Erstgeräts im Ranking auf 0 gesetzt.
    // Jetzt: vorher lesen und nur den höheren Wert schreiben.
    const today = dayKey();
    const localToday = st.days[today] || 0;
    window.sb.from('xp_daily').select('xp').eq('user_id', currentUserId).eq('day', today).maybeSingle()
      .then(({ data }) => {
        const remoteToday = (data && data.xp) || 0;
        if (localToday >= remoteToday) {
          return window.sb.from('xp_daily').upsert({
            user_id: currentUserId, day: today, xp: localToday,
          });
        }
        // Remote ist höher (anderes Gerät hat heute mehr gesammelt) — lokal übernehmen.
        const fresh = state();
        if (remoteToday > (fresh.days[today] || 0)) {
          fresh.days[today] = remoteToday;
          save(fresh);
        }
        return { error: null };
      })
      .then((r) => { if (r && r.error) console.warn('[xp] xp_daily-Sync fehlgeschlagen:', r.error.message); });
    // Themen-Summen fürs Deck-Leaderboard — überschreibend, kein Delta, siehe
    // supabase/schema.sql Abschnitt 8 (xp_topic).
    const topics = st.topics || {};
    Object.keys(topics).forEach((topicId) => {
      window.sb.from('xp_topic').upsert({
        user_id: currentUserId, topic_id: topicId, xp: topics[topicId] || 0,
      }).then(({ error }) => { if (error) console.warn('[xp] xp_topic-Sync fehlgeschlagen:', error.message); });
    });
  }
  function schedulePush() {
    if (!currentUserId || !window.sb) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(pushRemote, 1500);
  }
  // Merged wird nur profiles (total_xp/coins/streak_days/last_active) — die tägliche und
  // themenbezogene Aufschlüsselung (xp_daily/xp_topic) wird NICHT zurückgeholt. Auf einem
  // neuen Gerät fängt die Zeitraum-/Deck-Rangliste also lokal bei 0 an und baut sich mit
  // der Zeit wieder auf; nur die Gesamtsumme ("Insgesamt") ist von Anfang an korrekt.
  async function pullAndMerge(userId) {
    if (!window.sb) return;
    const { data, error } = await window.sb.from('profiles')
      .select('total_xp, coins, streak_days, last_active, streak_freezes, last_break, owned_cosmetics, wallet_ts').eq('id', userId).single();
    if (error || !data) return;
    const st = state();
    let changed = false;
    if ((data.total_xp || 0) > st.total) { st.total = data.total_xp; changed = true; }
    // Muenzen + Freezes: Last-Write-Wins über wallet_ts statt max() — max() hätte
    // auf Gerät A ausgegebene Münzen vom veralteten Gerät B wiederhergestellt
    // (Duplizierung). (Review 21.07.2026)
    if ((data.wallet_ts || 0) > (st.walletTs || 0)) {
      st.coins = data.coins || 0;
      st.streakFreezes = data.streak_freezes || 0;
      st.walletTs = data.wallet_ts;
      changed = true;
    }
    // Serie: Remote-Stand nur übernehmen, wenn er AKTUELLER ist (last_active
    // jünger) — vorher konnte ein höherer, aber uralter Remote-Streak die intakte
    // lokale Serie überschreiben und der nächste touchDay() hätte sie resettet;
    // umgekehrt konnte derselbe Tag doppelt verlängert werden. (Review 21.07.2026)
    if ((data.streak_days || 0) > st.streakDays
        && data.last_active
        && (!st.lastActive || data.last_active >= st.lastActive)) {
      st.streakDays = data.streak_days;
      st.lastActive = data.last_active;
      changed = true;
    }
    // last_break ist nur am selben Tag nutzbar (siehe repairStreak()) — nur übernehmen,
    // wenn lokal noch keiner vorliegt UND der Bruch heute passiert ist.
    if (!st.lastBreak && data.last_break && data.last_break.brokenOn === dayKey()) {
      st.lastBreak = data.last_break; changed = true;
    }
    // Cosmetics: Union statt max() — einmal gekauft, immer freigeschaltet, egal auf
    // welchem Gerät.
    const remoteCosmetics = data.owned_cosmetics || [];
    const localCosmetics = st.ownedCosmetics || [];
    if (remoteCosmetics.some((c) => !localCosmetics.includes(c))) {
      st.ownedCosmetics = Array.from(new Set([...localCosmetics, ...remoteCosmetics]));
      changed = true;
    }
    if (changed) save(st);
    pushRemote();
  }
  function setUser(userId) {
    currentUserId = userId || null;
    if (currentUserId) pullAndMerge(currentUserId);
  }

  window.XP = {
    award, endRound, addBonus, bumpTopic, touchDay, streakStatus, goldStatus, goldStreakDays, levelInfo, recentDays, todayXp,
    state, fmt, mult, setUser, spend, addCoins, buyStreakFreeze, repairStreak, buyCosmetic, _schedulePush: schedulePush,
    BASE, ROUND_BONUS, STREAK_DAILY_TARGET, GOLD_DAILY_TARGET, STREAK_FREEZE_COST, STREAK_REPAIR_COST, PREMIUM_AVATARS,
  };
})();
