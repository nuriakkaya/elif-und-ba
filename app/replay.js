/* ==============================================================
   🔁 WIEDERHOLUNGS-PUNKTE (11.08.2026)

   Nutzerwunsch wörtlich: „Schon durchgespielte Stapel sollen genau
   noch mal durchspielbar sein, aber dann gibt's nur noch die Hälfte
   der Punkte und dann auch nur einmal ein zweites Mal durchspielen,
   was Punkte bringt, danach war's das."

   Also drei Stufen je Lektion:
     1. Solange die Lektion noch nicht bei 100 % ist  -> volle Punkte
     2. Der erste komplette Durchgang DANACH          -> halbe Punkte
     3. Jeder weitere Durchgang                       -> keine Punkte
   Spielbar bleibt eine Lektion IMMER — Üben soll nie verboten sein,
   es soll nur nicht endlos Punkte nachwerfen.

   Gezählt wird eine Wiederholung erst am Ende einer Runde, und nur
   wenn die Lektion beim Start der Runde schon fertig war. Wer eine
   Runde abbricht, verbraucht seine halbe Portion also nicht.

   Gespeichert wird nur eine Zahl je Lektion — dadurch kann der
   Geräte-Abgleich sie ohne Sonderregel zusammenführen ("die höhere
   Zahl gewinnt", siehe app/simplesync.js).
   ============================================================== */
window.Replay = (function () {
  const KEY = 'eb_replay_v1';

  function load() {
    try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); return (o && typeof o === 'object') ? o : {}; }
    catch (e) { return {}; }
  }
  function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }

  function runs(topicId) { return Number(load()[topicId] || 0); }

  /* Alle Quizfragen einer Lektion — wird gebraucht, wenn der Aufrufer sie
     nicht mitgibt (z. B. app/lesson.js). Sucht in den Elifba-Lektionen, den
     Zusatz-Stapeln (Wortschatz/Gebete) und den selbst angelegten Stapeln. */
  function questionsOf(topicId) {
    const pools = [window.QURAN_TOPICS, window.QURAN_EXTRA_TOPICS,
                   (window.CustomTopics && window.CustomTopics.list && window.CustomTopics.list()) || null];
    for (let i = 0; i < pools.length; i++) {
      const list = pools[i];
      if (!Array.isArray(list)) continue;
      for (let k = 0; k < list.length; k++) {
        if (list[k] && list[k].id === topicId) {
          const out = [];
          (list[k].blocks || []).forEach(function (b) { (b.quiz || []).forEach(function (q) { out.push(q); }); });
          return out;
        }
      }
    }
    return [];
  }

  /* Ist die Lektion durchgespielt? Gleiche Quelle wie überall: der
     gewichtete Fortschritt aus dem Karteikasten. */
  function isDone(topicId, questions) {
    try {
      if (!window.SRS || !window.SRS.progressPct) return false;
      const qs = (questions && questions.length) ? questions : questionsOf(topicId);
      if (!qs.length) return false;
      return window.SRS.progressPct(topicId, qs) >= 100;
    } catch (e) { return false; }
  }

  /* Punkt-Faktor für eine Runde, die JETZT startet. */
  function factor(topicId, questions) {
    if (!isDone(topicId, questions)) return 1;      // noch am Lernen
    const n = runs(topicId);
    return n === 0 ? 0.5 : 0;
  }

  function label(f) {
    return f >= 1 ? '' : f > 0 ? '🔁 Wiederholung — halbe Punkte' : '🔁 Nur zum Üben — keine Punkte mehr';
  }
  function note(f) {
    return f >= 1 ? ''
      : f > 0 ? 'Diese Lektion sitzt schon. Dieser Durchgang bringt noch die Hälfte der Punkte — danach ist sie nur noch zum Üben da.'
      : 'Diese Lektion hast du zweimal geschafft. Üben kannst du sie so oft du willst — Punkte gibt es dafür keine mehr. Hol dir neue Punkte in der nächsten Lektion oder beim Auswendiglernen!';
  }

  /* Am Ende einer Runde aufrufen. wasDone = war die Lektion beim Start
     der Runde schon fertig? Nur dann verbraucht sich eine Wiederholung. */
  function finishRound(topicId, wasDone) {
    if (!wasDone || !topicId) return runs(topicId);
    const o = load();
    o[topicId] = Number(o[topicId] || 0) + 1;
    save(o);
    return o[topicId];
  }

  function reset(topicId) {
    const o = load();
    if (topicId) delete o[topicId]; else Object.keys(o).forEach(function (k) { delete o[k]; });
    save(o);
  }

  return { factor: factor, runs: runs, isDone: isDone, finishRound: finishRound, questionsOf: questionsOf,
           label: label, note: note, reset: reset, KEY: KEY };
})();
