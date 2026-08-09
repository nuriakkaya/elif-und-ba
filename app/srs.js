/* ==============================================================
   Einfaches Spaced-Repetition/Fortschritts-Tracking, rein clientseitig
   (localStorage, kein Backend). Bewusst simpel gehalten und an die
   Vier-Zustands-Klassifikation angelehnt, die wir bei Gizmo beobachtet
   haben: neu / am_lernen / gemeistert / vergessen.

   Kartenschlüssel: topicId + '::' + Fragetext. Das ist stabil genug,
   solange sich Fragetexte innerhalb eines Themengebiets nicht doppeln
   (geprüft: sie tun es nicht) und braucht keine Änderung an data.js.
   ============================================================== */
(function () {
  const SRS_KEY = 's34a_srs_v1';
  const MASTER_STREAK = 3; // so viele richtige Wiederholungen in Folge = "gemeistert"

  // Bei eingeloggten Nutzern (echte Accounts, Punkt 13) wird der Fortschritt zusätzlich
  // nach Supabase gespiegelt (Tabelle srs_progress) — localStorage bleibt aber immer die
  // schnelle, synchron lesbare lokale Kopie, damit die UI unverändert synchron bleibt.
  // Ohne Login oder ohne konfiguriertes Supabase-Projekt verhält sich alles exakt wie
  // vorher (reines localStorage, kein Backend).
  let currentUserId = null;

  function loadAll() {
    try {
      const raw = localStorage.getItem(SRS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function saveAll(all) {
    try { localStorage.setItem(SRS_KEY, JSON.stringify(all)); } catch (e) { /* storage voll/gesperrt: einfach ignorieren */ }
  }
  function cardKey(topicId, q) {
    return String(topicId || '?') + '::' + String((q && q.q) || '');
  }
  function getState(topicId, q) {
    const all = loadAll();
    return all[cardKey(topicId, q)] || { state: 'neu', streak: 0 };
  }

  // Schreibt eine einzelne Karte fire-and-forget nach Supabase (nicht blockierend,
  // Fehler werden nur geloggt — die lokale Kopie ist immer die Wahrheit für die UI).
  function pushOne(key, entry) {
    if (!currentUserId || !window.sb) return;
    window.sb.from('srs_progress').upsert({
      user_id: currentUserId,
      card_key: key,
      state: entry.state,
      streak: entry.streak,
      wrong_count: entry.wrongCount || 0,
      updated_at: new Date().toISOString(),
    }).then(({ error }) => { if (error) console.warn('[srs] Supabase-Sync fehlgeschlagen:', error.message); });
  }

  // Beim Login: einmalig Remote-Stand holen und mit localStorage mergen (neuerer
  // updated_at gewinnt pro Karte). Läuft im Hintergrund, blockiert die UI nicht.
  async function pullAndMerge(userId) {
    if (!window.sb) return;
    const { data, error } = await window.sb.from('srs_progress').select('*').eq('user_id', userId);
    if (error) { console.warn('[srs] Supabase-Pull fehlgeschlagen:', error.message); return; }
    const all = loadAll();
    (data || []).forEach((row) => {
      const local = all[row.card_key];
      const remoteTime = new Date(row.updated_at).getTime();
      const localTime = local && local.updatedAt ? local.updatedAt : 0;
      if (!local || remoteTime > localTime) {
        all[row.card_key] = { state: row.state, streak: row.streak, wrongCount: row.wrong_count || 0, updatedAt: remoteTime };
      }
    });
    saveAll(all);
  }

  // Wird beim Login/Logout aufgerufen (main.js), damit srs.js weiß, ob synchronisiert
  // werden soll. userId === null schaltet den Supabase-Sync wieder aus (Offline-Modus).
  function setUser(userId) {
    currentUserId = userId || null;
    if (currentUserId) pullAndMerge(currentUserId);
  }

  // correct: wurde die Karte in diesem Auftritt letztlich richtig beantwortet?
  // firstTry: war das der allererste Klick auf diese Karte in diesem Auftritt (kein Fehlversuch davor)?
  function recordAnswer(topicId, q, correct, firstTry) {
    const all = loadAll();
    const key = cardKey(topicId, q);
    const cur = all[key] || { state: 'neu', streak: 0 };
    // (Ausbau 23.07.2026) Kumulativer Fehler-Zähler pro Karte — Grundlage für die
    // "Problemkarten"-Analyse (weakCards unten): welche Karten gehen IMMER WIEDER
    // schief, nicht nur "welche sind gerade vergessen".
    const wrongCount = (cur.wrongCount || 0) + (correct && firstTry ? 0 : 1);
    let next;
    if (correct && firstTry) {
      const streak = (cur.streak || 0) + 1;
      next = { state: streak >= MASTER_STREAK ? 'gemeistert' : 'am_lernen', streak, wrongCount };
    } else if (correct && !firstTry) {
      // nach mind. einem Fehlversuch doch noch richtig -> zurück auf "am Lernen", Streak halbiert statt genullt
      next = { state: 'am_lernen', streak: Math.max(1, Math.floor((cur.streak || 0) / 2)), wrongCount };
    } else {
      // am Ende falsch (bzw. per Aufdecken aufgelöst)
      next = { state: cur.state === 'gemeistert' ? 'vergessen' : 'am_lernen', streak: 0, wrongCount };
    }
    next.updatedAt = Date.now();
    all[key] = next;
    saveAll(all);
    pushOne(key, next);
    return next;
  }

  /* ---- Problemkarten-Analyse (Ausbau 23.07.2026) ----
     Liefert die "Wackelkandidaten" eines Stapels, sortiert nach Dringlichkeit:
     zuerst Vergessenes (war schon gemeistert und ging wieder verloren), dann
     nach Fehlerhäufigkeit. So lässt sich das eigene Lernverhalten konkret
     analysieren ("an welchen Karten scheitere ich immer wieder?") und gezielt
     nur mit diesen Karten üben ("Problemkarten üben"-Button im Deck). */
  function weakCards(topicId, questions) {
    const all = loadAll();
    const rank = { vergessen: 0, am_lernen: 1, neu: 2, gemeistert: 3 };
    return questions
      .map((q) => {
        const st = all[cardKey(topicId, q)] || { state: 'neu', streak: 0 };
        return { q, state: st.state, streak: st.streak || 0, wrongCount: st.wrongCount || 0 };
      })
      .filter((e) => e.state === 'vergessen' || (e.wrongCount > 0 && e.state !== 'gemeistert'))
      .sort((a, b) => (rank[a.state] - rank[b.state]) || (b.wrongCount - a.wrongCount));
  }

  function topicStats(topicId, questions) {
    const all = loadAll();
    const out = { neu: 0, am_lernen: 0, gemeistert: 0, vergessen: 0, total: questions.length };
    questions.forEach((q) => {
      const st = all[cardKey(topicId, q)];
      const state = st ? st.state : 'neu';
      out[state] = (out[state] || 0) + 1;
    });
    return out;
  }

  /* ---- Gewichteter Stapel-Fortschritt (06.08.2026, Nutzerkritik "der
     Fortschritt lädt nicht") ----
     "% gemeistert" allein bleibt nach der ersten Runde IMMER 0 %, weil eine
     Karte erst nach 3 fehlerfreien Auftritten als gemeistert gilt — das wirkt
     kaputt und demotiviert. Deshalb überall sichtbarer Fortschritt mit
     Teil-Guthaben: jede richtige Wiederholung füllt die Karte um 1/3.
       neu = 0 · am Lernen = streak/3 · gemeistert = 1 · vergessen = 0,15 */
  function cardScore(entry) {
    if (!entry) return 0;
    if (entry.state === 'gemeistert') return 1;
    const s = Math.min(entry.streak || 0, MASTER_STREAK) / MASTER_STREAK;
    if (entry.state === 'vergessen') return Math.max(0.15, s * 0.5);
    return s;
  }
  function progressPct(topicId, questions) {
    if (!questions || !questions.length) return 0;
    const all = loadAll();
    let sum = 0;
    questions.forEach((q) => { sum += cardScore(all[cardKey(topicId, q)]); });
    return Math.round((100 * sum) / questions.length);
  }

  /* ---- Kumulativer "insgesamt beantwortete Fragen"-Zähler pro Themengebiet ----
     Anders als topicStats() NICHT auf eindeutige Karten gedeckelt, sondern zählt
     jeden Auswendig-Durchgang mit (auch Wiederholungen derselben Karte). Grund:
     live bei Gizmo hat ein 45-Karten-Stapel (WaffG) "Beantworte 182 Fragen zum
     Freischalten" für den Übungstest verlangt — das übersteigt die Kartenzahl
     selbst deutlich, kann also kein reiner "jede Karte einmal"-Zähler sein.
     Eigener Key (getrennt vom SRS-Zustand je Karte), damit ein "vergessen"-Reset
     einer Karte den Übungstest-Fortschritt nicht zurücksetzt. */
  const ANSWERED_KEY = 's34a_srs_answered_v1';
  function loadAnswered() {
    try { return JSON.parse(localStorage.getItem(ANSWERED_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveAnswered(all) {
    try { localStorage.setItem(ANSWERED_KEY, JSON.stringify(all)); } catch (e) { /* voll/gesperrt */ }
  }
  function bumpAnswered(topicId) {
    const all = loadAnswered();
    const k = String(topicId || '?');
    all[k] = (all[k] || 0) + 1;
    saveAnswered(all);
    return all[k];
  }
  function getAnswered(topicId) {
    return loadAnswered()[String(topicId || '?')] || 0;
  }

  window.SRS = { getState, recordAnswer, topicStats, progressPct, cardScore, weakCards, cardKey, setUser, bumpAnswered, getAnswered };
})();
