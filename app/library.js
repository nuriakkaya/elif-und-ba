/* ==============================================================
   Öffentliche Stapel-Bibliothek (Blueprint Phase 13, 20.07.2026).

   Bei Gizmo: eine durchsuchbare, nach Fachbereichen kategorisierte
   Bibliothek öffentlicher Stapel. Unsere `PublicDecks`-Seite war bisher
   reine Deko (6 Fake-Kategorien mit erfundenen Zahlen). Jetzt echt:
   eigene Stapel lassen sich aus dem Stapel-Kontextmenü heraus
   veröffentlichen (Kategorie wählen), tauchen dann für ALLE
   angemeldeten Nutzer:innen in der Bibliothek auf und können von dort
   mit einem Klick in die eigenen Stapel übernommen werden (Klon —
   danach unabhängig vom Original, wie ein Quizlet-Import).

   Bewusste Scope-Entscheidungen (dokumentiert):
   - Kein Download-Zähler (bräuchte eine update-Policy für fremde Zeilen
     oder einen Server-Zähler — beides passt nicht zum RLS-Muster
     "nur eigene Zeilen schreiben" dieser App).
   - Feste Kategorienliste statt freier Tags (einfacher zu browsen).
   - Veröffentlichen ist ein Snapshot: spätere Änderungen am eigenen
     Stapel aktualisieren die veröffentlichte Kopie nicht automatisch
     (erneut veröffentlichen ersetzt die alte Version).
   ============================================================== */
(function () {
  const CATEGORIES = [
    { id: 'recht',    label: '⚖️ Recht & Sicherheit' },
    { id: 'sprachen', label: '🇬🇧 Sprachen' },
    { id: 'medizin',  label: '🩺 Medizin' },
    { id: 'wirtschaft', label: '💼 Wirtschaft' },
    { id: 'mint',     label: '🧮 MINT' },
    { id: 'allgemein', label: '📚 Allgemein' },
  ];

  function countCards(blocks) {
    let cards = 0, quiz = 0;
    (blocks || []).forEach((b) => { cards += (b.cards || []).length; quiz += (b.quiz || []).length; });
    return { cards, quiz };
  }

  // Eigenen Stapel veröffentlichen (oder erneut veröffentlichen = Version ersetzen).
  // topic_ref = die lokale Stapel-ID, damit erneutes Veröffentlichen die alte
  // Zeile ersetzt statt Duplikate anzuhäufen (unique (author_id, topic_ref)).
  async function publish(myId, topic, categoryId) {
    if (!window.sb || !myId || !topic) throw new Error('Nicht angemeldet.');
    const { error } = await window.sb.from('public_decks').upsert({
      author_id: myId, topic_ref: topic.id,
      name: topic.name, color: topic.color || 'var(--stack-lavender)',
      category: categoryId || 'allgemein', blocks: topic.blocks || [],
    }, { onConflict: 'author_id,topic_ref' });
    if (error) throw error;
    return true;
  }

  async function unpublish(myId, topicRef) {
    if (!window.sb || !myId) return;
    await window.sb.from('public_decks').delete().eq('author_id', myId).eq('topic_ref', topicRef);
  }

  // Bibliothek durchsuchen: optional Kategorie + Namenssuche. Autor:innen-Profile
  // werden nachgeladen (Avatar + Name auf der Karte).
  async function browse(opts) {
    if (!window.sb) return [];
    let q = window.sb.from('public_decks').select('*').order('created_at', { ascending: false }).limit(60);
    if (opts && opts.category) q = q.eq('category', opts.category);
    // (Review 21.07.2026) auch Backslash strippen — ein abschließender '\\' hätte
    // sonst das schließende %-Wildcard escaped und die Suche verfälscht.
    if (opts && opts.search) q = q.ilike('name', '%' + opts.search.replace(/[\\%_]/g, '') + '%');
    const { data, error } = await q;
    if (error || !data) return [];
    const authorIds = Array.from(new Set(data.map((d) => d.author_id)));
    let profs = [];
    if (authorIds.length) {
      const r = await window.sb.from('profiles').select('id, username, avatar').in('id', authorIds);
      profs = r.data || [];
    }
    const byId = {};
    profs.forEach((p) => { byId[p.id] = p; });
    return data.map((d) => ({ ...d, author: byId[d.author_id] || null, counts: countCards(d.blocks) }));
  }

  // Öffentlichen Stapel in die eigenen Stapel übernehmen (Klon, danach unabhängig).
  function importDeck(deck) {
    if (!window.CustomTopics || !window.CustomTopics.importFrom) return null;
    return window.CustomTopics.importFrom(deck.name, deck.color, deck.blocks);
  }

  // Welche eigenen topic_refs habe ich schon veröffentlicht? (fürs Kontextmenü)
  async function myPublished(myId) {
    if (!window.sb || !myId) return [];
    const { data } = await window.sb.from('public_decks').select('topic_ref, category').eq('author_id', myId);
    return data || [];
  }

  window.Library = { CATEGORIES, publish, unpublish, browse, importDeck, myPublished, _pure: { countCards } };
})();
