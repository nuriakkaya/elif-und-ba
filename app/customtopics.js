/* ==============================================================
   Eigene Stapel (KI-generiert oder manuell) — Blueprint Phase 3
   "KI-Content-Erstellung: Grundgerüst".

   Gleiches Muster wie app/xp.js / app/srs.js: localStorage ist die
   synchrone Wahrheit für die UI, Supabase wird bei Login debounced
   nachgezogen (fire-and-forget). Ohne Login/Supabase funktioniert
   alles rein lokal weiter.

   Ein "eigener Stapel" hat exakt die gleiche Form wie ein Themengebiet
   aus app/data.js ({ id, name, color, meta, merksaetze, blocks:[{n,
   title, subtitle, cards, quiz, cases}] }) — dadurch funktionieren
   Lernen/Quiz/Test/Auswendig/Live-Quiz/SRS/XP für eigene Stapel exakt
   genauso wie für die kuratierten §34a-Themen, ganz ohne Sonderfälle.
   ============================================================== */
(function () {
  const KEY = 's34a_custom_topics_v1';

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
  }
  function persist(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* voll/gesperrt */ }
  }

  let topics = load();
  let listeners = [];
  function notify() { listeners.slice().forEach((fn) => { try { fn(topics); } catch (e) {} }); }
  function onChange(fn) { listeners.push(fn); return () => { listeners = listeners.filter((f) => f !== fn); }; }

  function recomputeCounts(t) {
    let cardCount = 0, quizCount = 0;
    (t.blocks || []).forEach((b) => { cardCount += (b.cards || []).length; quizCount += (b.quiz || []).length; });
    t.cardCount = cardCount; t.quizCount = quizCount;
    return t;
  }

  function uid() {
    return 'custom-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function list() { return topics; }

  function createEmpty(name, color) {
    const t = recomputeCounts({
      id: uid(),
      name: (name && name.trim()) || 'Eigener Stapel',
      color: color || 'var(--stack-lavender)',
      isCustom: true,
      meta: {},
      merksaetze: [],
      blocks: [{ n: 1, title: 'Eigene Karten', subtitle: '', cards: [], quiz: [], cases: [] }],
    });
    topics = [...topics, t];
    persist(topics);
    schedulePush(t.id);
    notify();
    return t;
  }

  // cards: [{q, a}] — kommt entweder von der KI (app/aigen.js: generateCardsFromText)
  // oder künftig von manuellem Hinzufügen. Landet als Quizfrage (q/a, engine.js macht
  // daraus automatisch MC/Lückentext/Ordnen/Abruf) UND als einfache Karteikarte (h/b).
  function addCardsToTopic(topicId, cards) {
    let updated = null;
    topics = topics.map((t) => {
      if (t.id !== topicId) return t;
      const block = t.blocks[0];
      const existingQ = new Set(block.quiz.map((q) => q.q.toLowerCase()));
      const fresh = (cards || []).filter((c) => c && c.q && !existingQ.has(c.q.toLowerCase()));
      const nt = {
        ...t,
        blocks: [{
          ...block,
          quiz: [...block.quiz, ...fresh],
          cards: [...block.cards, ...fresh.map((c) => ({ h: c.q, b: c.a }))],
        }],
      };
      updated = recomputeCounts(nt);
      return updated;
    });
    persist(topics);
    schedulePush(topicId);
    if (window.QEngine && window.QEngine._invalidate) window.QEngine._invalidate(topicId);
    notify();
    return updated;
  }

  function rename(topicId, name) {
    topics = topics.map((t) => (t.id === topicId ? { ...t, name: (name && name.trim()) || t.name } : t));
    persist(topics);
    schedulePush(topicId);
    notify();
  }

  // Kompletten Stapel mit fertigen Blöcken übernehmen (Klon aus der öffentlichen
  // Bibliothek, app/library.js, Phase 13) — danach ein ganz normaler eigener Stapel,
  // unabhängig vom Original.
  function importFrom(name, color, blocks) {
    const t = recomputeCounts({
      id: uid(),
      name: (name && name.trim()) || 'Importierter Stapel',
      color: color || 'var(--stack-lavender)',
      isCustom: true,
      meta: {},
      merksaetze: [],
      blocks: JSON.parse(JSON.stringify(blocks || [{ n: 1, title: 'Eigene Karten', subtitle: '', cards: [], quiz: [], cases: [] }])),
    });
    topics = [...topics, t];
    persist(topics);
    schedulePush(t.id);
    notify();
    return t;
  }

  // Stapel duplizieren (Kontextmenü, Phase 16) — tiefe Kopie unter neuer ID.
  function duplicate(topicId) {
    const src = topics.find((t) => t.id === topicId);
    if (!src) return null;
    return importFrom(src.name + ' (Kopie)', src.color, src.blocks);
  }

  // Archivieren/Dearchivieren (Kontextmenü, Phase 16) — archivierte Stapel werden
  // in "Meine Stapel" ausgeblendet (eigener Bereich), bleiben aber voll erhalten.
  function setArchived(topicId, archived) {
    topics = topics.map((t) => (t.id === topicId ? { ...t, archived: !!archived } : t));
    persist(topics);
    schedulePush(topicId);
    notify();
  }

  function remove(topicId) {
    topics = topics.filter((t) => t.id !== topicId);
    persist(topics);
    if (currentUserId && window.sb) {
      window.sb.from('custom_topics').delete().eq('id', topicId).eq('user_id', currentUserId)
        .then(({ error }) => { if (error) console.warn('[customtopics] Löschen fehlgeschlagen:', error.message); });
    }
    notify();
  }

  /* ---- Supabase-Sync (optional, nur bei Login) ---- */
  let currentUserId = null;
  const pushTimers = {};
  function pushOne(topicId) {
    if (!currentUserId || !window.sb) return;
    const t = topics.find((x) => x.id === topicId);
    if (!t) return;
    window.sb.from('custom_topics').upsert({
      id: t.id, user_id: currentUserId, name: t.name, color: t.color, blocks: t.blocks,
      archived: !!t.archived, // (Review 21.07.2026) vorher ging der Archiv-Status beim Gerätewechsel verloren
    }).then(({ error }) => { if (error) console.warn('[customtopics] Sync fehlgeschlagen:', error.message); });
  }
  function schedulePush(topicId) {
    if (!currentUserId || !window.sb) return;
    if (pushTimers[topicId]) clearTimeout(pushTimers[topicId]);
    pushTimers[topicId] = setTimeout(() => pushOne(topicId), 1500);
  }
  async function pullAndMerge(userId) {
    if (!window.sb) return;
    const { data, error } = await window.sb.from('custom_topics').select('*').eq('user_id', userId);
    if (error || !data) return;
    const localIds = new Set(topics.map((t) => t.id));
    const remoteOnly = data.filter((r) => !localIds.has(r.id)).map((r) => recomputeCounts({
      id: r.id, name: r.name, color: r.color, blocks: r.blocks, archived: !!r.archived, isCustom: true, meta: {}, merksaetze: [],
    }));
    let changed = false;
    if (remoteOnly.length) { topics = [...topics, ...remoteOnly]; changed = true; }
    if (changed) { persist(topics); notify(); }
    // Lokale Stapel, die auf diesem Gerät entstanden sind aber noch nie hochgeladen
    // wurden (z.B. weil damals nicht eingeloggt), jetzt nachschieben.
    topics.forEach((t) => { if (!data.find((r) => r.id === t.id)) pushOne(t.id); });
  }
  function setUser(userId) {
    currentUserId = userId || null;
    if (currentUserId) pullAndMerge(currentUserId);
  }

  window.CustomTopics = { list, onChange, createEmpty, addCardsToTopic, importFrom, duplicate, setArchived, rename, remove, setUser };
})();
