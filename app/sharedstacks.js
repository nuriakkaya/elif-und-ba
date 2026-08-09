/* ==============================================================
   Geteilte/kollaborative Stapel — echtes Multi-Autor-Deck
   (Blueprint Phase 16, 20.07.2026). Bei Gizmo beobachtet als Stapel
   mit Mitwirkenden-Avataren.

   Funktionsweise v1 (bewusst schlank):
   - Aus einem eigenen Stapel wird per Kontextmenü eine GETEILTE Kopie
     erstellt (der Stapel wandert in die Tabelle `shared_stacks`, der
     lokale Original-Stapel bleibt unangetastet als private Kopie).
   - Beitritt über einen 6-stelligen Code (gleiches Muster wie Live-Quiz
     und Lerngruppen) — wer beitritt, sieht den Stapel unter "Meine
     Stapel" und darf Karten hinzufügen.
   - Alle Mitwirkenden dürfen den kompletten Karten-Datensatz (blocks-
     jsonb) aktualisieren. Konfliktauflösung (seit Ausbau 21.07.2026):
     Compare-and-Swap über updated_at mit Merge-Retry — gleichzeitige
     Ergänzungen zweier Mitglieder vereinigen sich, statt sich zu
     überschreiben (siehe addCardsToTopic unten).
   - Mitwirkenden-Avatare werden im Deck-Kopf angezeigt.

   Geteilte Stapel haben dieselbe Form wie Themengebiete/eigene Stapel
   und laufen deshalb durch Lernen/Quiz/Test/SRS/XP ohne Sonderfälle
   (gleiches Prinzip wie app/customtopics.js). Ohne Login sind keine
   geteilten Stapel sichtbar (sie leben ausschließlich in Supabase).
   ============================================================== */
(function () {
  let stacks = []; // [{ id, name, color, blocks, code, created_by, isCustom:true, isShared:true, ... }]
  let listeners = [];
  let currentUserId = null;

  function notify() { listeners.slice().forEach((fn) => { try { fn(stacks); } catch (e) {} }); }
  function onChange(fn) { listeners.push(fn); return () => { listeners = listeners.filter((f) => f !== fn); }; }
  function list() { return stacks; }

  function makeCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }
  function uid() {
    return 'shared-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }
  function recompute(t) {
    let cardCount = 0, quizCount = 0;
    (t.blocks || []).forEach((b) => { cardCount += (b.cards || []).length; quizCount += (b.quiz || []).length; });
    t.cardCount = cardCount; t.quizCount = quizCount;
    return t;
  }
  function toTopic(row) {
    return recompute({
      id: row.id, name: row.name, color: row.color, blocks: row.blocks || [],
      code: row.code, created_by: row.created_by,
      isCustom: true, isShared: true, meta: {}, merksaetze: [],
    });
  }

  async function refresh() {
    if (!window.sb || !currentUserId) { stacks = []; notify(); return; }
    const { data: memberRows } = await window.sb.from('shared_stack_members').select('stack_id').eq('user_id', currentUserId);
    const ids = (memberRows || []).map((r) => r.stack_id);
    if (!ids.length) { stacks = []; notify(); return; }
    const { data: rows } = await window.sb.from('shared_stacks').select('*').in('id', ids);
    stacks = (rows || []).map(toTopic);
    notify();
  }

  // Aus einem eigenen (lokalen) Stapel eine geteilte Kopie machen.
  async function createFrom(topic) {
    if (!window.sb || !currentUserId) throw new Error('Nicht angemeldet.');
    const id = uid();
    const code = makeCode();
    const { error } = await window.sb.from('shared_stacks').insert({
      id, code, name: topic.name, color: topic.color || 'var(--stack-lavender)',
      blocks: topic.blocks || [], created_by: currentUserId,
    });
    if (error) throw error;
    const { error: memErr } = await window.sb.from('shared_stack_members').insert({ stack_id: id, user_id: currentUserId });
    if (memErr) {
      // (Review 21.07.2026) Kompensierendes Aufräumen: ohne Mitgliedszeile wäre die
      // gerade angelegte Stapelzeile eine verwaiste Leiche (für niemanden sichtbar).
      await window.sb.from('shared_stacks').delete().eq('id', id).then(() => {}, () => {});
      throw memErr;
    }
    await refresh();
    return { id, code };
  }

  async function join(code) {
    if (!window.sb || !currentUserId) throw new Error('Nicht angemeldet.');
    const clean = (code || '').trim().toUpperCase();
    if (!clean) throw new Error('Bitte einen Code eingeben.');
    const { data: rows, error } = await window.sb.from('shared_stacks').select('id').eq('code', clean).limit(1);
    if (error) throw error;
    const found = rows && rows[0];
    if (!found) throw new Error('Kein geteilter Stapel mit diesem Code gefunden.');
    // (Review 21.07.2026) ignoreDuplicates: ein normales upsert würde bei erneutem
    // Beitritt in ON CONFLICT DO UPDATE laufen — dafür gibt es (bewusst) keine
    // update-Policy, und der Re-Beitritt wäre mit RLS-Fehler gescheitert.
    const { error: memErr } = await window.sb.from('shared_stack_members')
      .upsert({ stack_id: found.id, user_id: currentUserId }, { ignoreDuplicates: true });
    if (memErr) throw memErr;
    await refresh();
    return found.id;
  }

  async function leave(stackId) {
    if (!window.sb || !currentUserId) return;
    await window.sb.from('shared_stack_members').delete().eq('stack_id', stackId).eq('user_id', currentUserId);
    await refresh();
  }

  // Karten hinzufügen — gleiches Interface wie CustomTopics.addCardsToTopic,
  // damit die Aufrufstellen (AddCardModal, Magic-Import) nur nach der ID-Präfix
  // verzweigen müssen. Last-Write-Wins auf blocks-Ebene (siehe Kopfkommentar).
  // (Ausbau 21.07.2026) Vom dokumentierten Last-Write-Wins auf echtes
  // Compare-and-Swap umgestellt: Es wird der frische Stand inkl. updated_at
  // gelesen, gemergt und nur dann geschrieben, wenn updated_at seitdem
  // unverändert ist (.eq auf den gelesenen Wert + .select zum Prüfen, ob
  // eine Zeile getroffen wurde). Kam jemand zuvor, wird neu gelesen und
  // erneut gemergt (bis zu 4 Versuche) — gleichzeitige Ergänzungen zweier
  // Mitglieder gehen damit nicht mehr verloren, sie vereinigen sich.
  async function addCardsToTopic(stackId, cards) {
    const t = stacks.find((x) => x.id === stackId);
    if (!t || !window.sb) return null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const { data: freshRow } = await window.sb.from('shared_stacks').select('blocks, updated_at').eq('id', stackId).maybeSingle();
      if (freshRow && Array.isArray(freshRow.blocks)) t.blocks = freshRow.blocks;
      const seenUpdatedAt = freshRow ? freshRow.updated_at : null;
      const block = t.blocks[0] || { n: 1, title: 'Eigene Karten', subtitle: '', cards: [], quiz: [], cases: [] };
      // Defensiv gegen kaputte Einträge von Mitautor:innen (q fehlt) — vorher hätte EIN
      // fehlerhafter Eintrag das Hinzufügen für ALLE Mitglieder dauerhaft zerbrochen.
      const existingQ = new Set((block.quiz || []).map((q) => ((q && q.q) || '').toLowerCase()));
      const fresh = (cards || []).filter((c) => c && c.q && c.a && !existingQ.has(c.q.toLowerCase()));
      if (!fresh.length) return t; // alles schon vorhanden (z.B. vom parallelen Schreiber gemergt)
      const newBlocks = [{
        ...block,
        quiz: [...(block.quiz || []), ...fresh],
        cards: [...(block.cards || []), ...fresh.map((c) => ({ h: c.q, b: c.a }))],
      }, ...t.blocks.slice(1)];
      let upd = window.sb.from('shared_stacks')
        .update({ blocks: newBlocks, updated_at: new Date().toISOString() })
        .eq('id', stackId);
      upd = seenUpdatedAt === null ? upd : upd.eq('updated_at', seenUpdatedAt);
      const { data: touched, error } = await upd.select('id');
      if (error) { console.warn('[sharedstacks] Speichern fehlgeschlagen:', error.message); return null; }
      if (touched && touched.length) {
        t.blocks = newBlocks;
        recompute(t);
        if (window.QEngine && window.QEngine._invalidate) window.QEngine._invalidate(stackId);
        notify();
        return t;
      }
      // updated_at hat sich geändert — jemand war schneller: neu lesen und erneut mergen.
    }
    console.warn('[sharedstacks] Speichern nach 4 Versuchen aufgegeben (sehr viele gleichzeitige Änderungen).');
    return null;
  }

  // Mitwirkende (fürs Avatar-Band im Deck-Kopf).
  async function members(stackId) {
    if (!window.sb) return [];
    const { data: rows } = await window.sb.from('shared_stack_members').select('user_id, joined_at').eq('stack_id', stackId);
    const ids = (rows || []).map((r) => r.user_id);
    if (!ids.length) return [];
    const { data: profs } = await window.sb.from('profiles').select('id, username, avatar').in('id', ids);
    return profs || [];
  }

  function setUser(userId) {
    currentUserId = userId || null;
    refresh();
  }

  window.SharedStacks = { list, onChange, createFrom, join, leave, addCardsToTopic, members, refresh, setUser };
})();
