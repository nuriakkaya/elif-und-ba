/* ==============================================================
   Anki-Import (Blueprint Phase 4, achte angeschlossene Quelle).
   .apkg ist technisch eine ZIP-Datei (schon vorhanden: JSZip), die als
   Hauptbestandteil eine SQLite-Datenbank enthält ("collection.anki21" bei
   neueren Anki-Versionen, sonst "collection.anki2"). Die Notizen liegen in
   der Tabelle "notes", Spalte "flds" — die Felder eines Notiztyps getrennt
   durch das Unit-Separator-Zeichen \x1f. Für die allermeisten Kartentypen
   (Standard "Basic" & Varianten) sind Feld 0 = Vorderseite, Feld 1 =
   Rückseite — das deckt die große Mehrheit echter Decks ab; Notiztypen mit
   abweichender Feldreihenfolge werden bestmöglich (Feld 0/1) übernommen.

   Läuft bewusst OHNE KI (wie Tabellen/Quizlet) — die Daten sind bereits
   fertige Frage/Antwort-Paare, eine KI-Neuformulierung würde nur Qualität
   verlieren. Braucht sql.js (WASM-SQLite, vendor/sql-wasm.js +
   vendor/sql-wasm.wasm) zum Lesen der Datenbank direkt im Browser — die
   .apkg-Datei geht dabei nie an einen Server.

   Einschränkung wie bei PDF: das separate .wasm braucht einen echten
   Netzwerk-Fetch zur Laufzeit, das funktioniert in der Web-App/Netlify,
   aber NICHT in der komplett zu einer Datei zusammengefassten
   Offline-Einzeldatei-Vorschau — dort erscheint eine klare Fehlermeldung
   statt eines Absturzes (wie beim PDF-Worker).
   ============================================================== */
(function () {
  let sqlPromise = null;
  function loadSql() {
    if (!sqlPromise) {
      if (!window.initSqlJs) {
        sqlPromise = Promise.reject(new Error('Anki-Import ist in dieser Umgebung nicht verfügbar (sql.js fehlt).'));
      } else {
        // locateFile bekommt den intern erwarteten Dateinamen (je nach sql.js-Build z.B.
        // "sql-wasm-browser.wasm"); wir mappen das immer fest auf unsere eine vendored
        // .wasm-Datei, unabhängig vom übergebenen Namen.
        sqlPromise = window.initSqlJs({ locateFile: () => 'vendor/sql-wasm.wasm' }).catch((e) => {
          throw new Error('Die SQLite-Engine (sql.js) konnte nicht geladen werden — in der Offline-Einzeldatei-Vorschau nicht verfügbar. In der echten Web-App funktioniert der Anki-Import.');
        });
      }
    }
    return sqlPromise;
  }

  function stripHtml(s) {
    let t = String(s || '');
    t = t.replace(/<br\s*\/?>/gi, '\n');
    t = t.replace(/<[^>]+>/g, ' ');
    t = t.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'");
    t = t.replace(/\[sound:[^\]]*\]/gi, ''); // Audio-Referenzen entfernen, keine echte Karte
    t = t.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
    return t;
  }

  async function extractCardsFromApkg(file) {
    if (!window.JSZip) throw new Error('ZIP-Bibliothek konnte nicht geladen werden.');
    const SQL = await loadSql();

    const buf = await file.arrayBuffer();
    let zip;
    try { zip = await window.JSZip.loadAsync(buf); }
    catch (e) { throw new Error('Diese Datei konnte nicht geöffnet werden (beschädigt oder keine echte .apkg-Datei?).'); }

    const dbPath = zip.files['collection.anki21'] ? 'collection.anki21'
      : zip.files['collection.anki2'] ? 'collection.anki2' : null;
    if (!dbPath) throw new Error('In dieser Datei wurde keine Anki-Datenbank gefunden (ist es wirklich eine .apkg-Datei?).');

    const dbBytes = await zip.files[dbPath].async('uint8array');
    let db;
    try { db = new SQL.Database(dbBytes); }
    catch (e) { throw new Error('Die Anki-Datenbank in dieser Datei konnte nicht gelesen werden (evtl. beschädigt oder ein sehr altes/neues, inkompatibles Format).'); }

    let rows;
    try {
      const res = db.exec('SELECT flds FROM notes');
      rows = (res && res[0] && res[0].values) || [];
    } catch (e) {
      db.close();
      throw new Error('In dieser Anki-Datenbank wurde keine "notes"-Tabelle gefunden.');
    }
    db.close();

    const out = [];
    const seen = new Set();
    for (const row of rows) {
      const flds = String(row[0] || '');
      const parts = flds.split(String.fromCharCode(31)); // Anki-Feldtrenner (Unit Separator, \x1f)
      const q = stripHtml(parts[0] || '');
      const a = stripHtml(parts[1] || '');
      if (!q || !a) continue;
      if (q.length > 400 || a.length > 400) continue;
      const key = q.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ q, a });
      if (out.length >= 300) break;
    }
    if (!out.length) throw new Error('Es konnten keine brauchbaren Karten aus dieser .apkg-Datei gelesen werden (evtl. ein Notiztyp ohne einfache Vorder-/Rückseite, z. B. Lückentext oder Bild-Okklusion).');
    return out;
  }

  window.AnkiImport = { extractCardsFromApkg };
})();
