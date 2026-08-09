/* ==============================================================
   "Geschichte" — durchsuchbarer Verlauf bisheriger KI-Interaktionen
   (Blueprint Phase 5). Gleiches Grundmuster wie app/customtopics.js:
   localStorage als synchrone Quelle der Wahrheit, Supabase-Sync bei Login
   nur fire-and-forget im Hintergrund.

   Bewusst kein komplexes Session-Objekt, sondern ein schlankes
   Append-only-Log zweier Ereignis-Typen, die es in der App tatsächlich
   gibt:
   - "tutor": eine KI-Tutor-"Erklären"-Antwort (im Quiz oder in der
     Runden-Zusammenfassung, app/quiz.js)
   - "chat": ein per Chat-Eingabefeld/Freitext-Thema von der KI komplett neu
     erzeugter Stapel (Startseite-Chat-Einstieg, app/aiimport.js
     generateCardsFromTopic; genauso "Beliebiges Thema" im Live-Modus)

   Anders als bei custom_topics (wo eine Zeile wiederholt verändert wird)
   ist ein Verlaufseintrag ein abgeschlossenes, nie im Nachhinein
   verändertes Ereignis — ein einfaches Insert pro Eintrag reicht, kein
   Merge-Konflikt möglich.
   ============================================================== */
(function () {
  const KEY = 's34a_history_v1';
  const MAX = 300;

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
  }
  function persist(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* voll o.ä. — Verlauf ist nicht kritisch */ }
  }

  let items = load();
  let listeners = [];
  function notify() { listeners.slice().forEach((fn) => { try { fn(items); } catch (e) {} }); }
  function onChange(fn) { listeners.push(fn); return () => { listeners = listeners.filter((f) => f !== fn); }; }

  function uid() { return 'h-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }

  function list() { return items; }

  function log(entry) {
    const title = (entry && entry.title || '').trim().replace(/\s+/g, ' ');
    if (!title) return null;
    const row = {
      id: uid(),
      type: (entry && entry.type) || 'tutor',
      title: title.slice(0, 200),
      subtitle: (entry && entry.subtitle || '').slice(0, 120),
      topicId: (entry && entry.topicId) || null,
      ts: Date.now(),
    };
    items = [row, ...items].slice(0, MAX);
    persist(items);
    pushOne(row);
    notify();
    return row;
  }

  function remove(id) {
    items = items.filter((x) => x.id !== id);
    persist(items);
    notify();
  }

  // ---- Supabase-Sync (fire-and-forget, wie bei allen anderen Modulen hier) ----
  let currentUserId = null;

  function pushOne(row) {
    if (!currentUserId || !window.sb) return;
    window.sb.from('ai_history').insert({
      id: row.id, user_id: currentUserId, type: row.type, title: row.title,
      subtitle: row.subtitle, topic_id: row.topicId, created_at: new Date(row.ts).toISOString(),
    }).then(() => {}, () => {});
  }

  async function pullAndMerge(userId) {
    if (!window.sb) return;
    try {
      const { data, error } = await window.sb
        .from('ai_history').select('*').eq('user_id', userId)
        .order('created_at', { ascending: false }).limit(MAX);
      if (error || !data) return;
      const localIds = new Set(items.map((x) => x.id));
      const remoteOnly = data
        .filter((r) => !localIds.has(r.id))
        .map((r) => ({
          id: r.id, type: r.type, title: r.title, subtitle: r.subtitle || '',
          topicId: r.topic_id || null, ts: new Date(r.created_at).getTime(),
        }));
      if (remoteOnly.length) {
        items = [...items, ...remoteOnly]
          .sort((a, b) => b.ts - a.ts)
          .slice(0, MAX);
        persist(items);
        notify();
      }
    } catch (e) { /* kein Supabase konfiguriert o.ä. — Verlauf bleibt lokal */ }
  }

  function setUser(userId) {
    currentUserId = userId || null;
    if (currentUserId) pullAndMerge(currentUserId);
  }

  window.AIHistory = { list, log, remove, onChange, setUser };
})();
