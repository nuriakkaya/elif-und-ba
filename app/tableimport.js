/* ==============================================================
   Tabellen-Import (Blueprint Phase 4, vierte angeschlossene Quelle).
   Anders als Notizen/PDF/Word geht dieser Import NICHT über die KI —
   eine Tabelle mit "Frage,Antwort"-Zeilen ist bereits fertig strukturiert,
   eine KI-Generierung würde nur ungenauer machen, was schon exakt da ist.
   Erkennt Komma, Semikolon oder Tab als Trenner automatisch, überspringt
   eine erkennbare Kopfzeile ("Frage"/"Antwort"/"Question"/"Answer" o.ä.),
   nimmt bei mehr als 2 Spalten die ersten beiden.
   ============================================================== */
(function () {
  function detectDelimiter(line) {
    const counts = { '\t': (line.match(/\t/g) || []).length, ',': (line.match(/,/g) || []).length, ';': (line.match(/;/g) || []).length };
    let best = '\t', bestCount = counts['\t'];
    if (counts[','] > bestCount) { best = ','; bestCount = counts[',']; }
    if (counts[';'] > bestCount) { best = ';'; bestCount = counts[';']; }
    return bestCount > 0 ? best : null;
  }

  // Sehr simpler CSV-Zeilen-Splitter mit Anführungszeichen-Unterstützung
  // (reicht für "Frage","Antwort"-Exporte aus Excel/Google Sheets/Anki-CSV).
  function splitRow(line, delim) {
    const out = [];
    let cur = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; }
          else inQuotes = false;
        } else cur += ch;
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === delim) {
        out.push(cur); cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map((s) => s.trim());
  }

  const HEADER_WORDS = new Set(['frage', 'antwort', 'question', 'answer', 'front', 'back', 'begriff', 'definition', 'term']);

  function parseTable(text) {
    const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return [];
    const delim = detectDelimiter(lines[0]) || detectDelimiter(lines[1] || '') || ',';
    let rows = lines.map((l) => splitRow(l, delim)).filter((r) => r.length >= 2);
    if (!rows.length) return [];
    const first = rows[0].slice(0, 2).map((s) => s.toLowerCase());
    if (first.every((s) => HEADER_WORDS.has(s))) rows = rows.slice(1);
    const out = [];
    const seen = new Set();
    rows.forEach((r) => {
      const q = (r[0] || '').trim();
      const a = (r[r.length >= 2 ? 1 : 1] || '').trim();
      if (!q || !a) return;
      if (q.length > 300 || a.length > 300) return;
      const key = q.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ q, a });
    });
    return out.slice(0, 200); // großzügige, aber endliche Sicherheitsgrenze
  }

  window.TableImport = { parseTable };
})();
