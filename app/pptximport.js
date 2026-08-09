/* ==============================================================
   PowerPoint-Text-Extraktion (Blueprint Phase 4, fünfte angeschlossene
   Quelle). .pptx ist wie .docx ein ZIP-Container aus XML-Dateien —
   Folientexte stehen in ppt/slides/slideN.xml als <a:t>-Textknoten.
   Läuft komplett clientseitig über JSZip (vendor/jszip.min.js, lokal
   statt CDN) zum Entpacken + dem im Browser eingebauten DOMParser zum
   Auslesen der XML-Textknoten — braucht keine große XML-Bibliothek.
   Wie bei PDF/Word geht die Datei selbst NIE an einen Server.
   ============================================================== */
(function () {
  function naturalSlideOrder(a, b) {
    const na = parseInt((a.match(/slide(\d+)\.xml$/) || [])[1] || '0', 10);
    const nb = parseInt((b.match(/slide(\d+)\.xml$/) || [])[1] || '0', 10);
    return na - nb;
  }

  async function extractTextFromPptx(file) {
    if (!window.JSZip) {
      throw new Error('ZIP-Bibliothek konnte nicht geladen werden.');
    }
    const buf = await file.arrayBuffer();
    let zip;
    try {
      zip = await window.JSZip.loadAsync(buf);
    } catch (e) {
      throw new Error('Diese Datei konnte nicht geöffnet werden (beschädigt oder kein echtes .pptx?).');
    }

    const slidePaths = Object.keys(zip.files)
      .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
      .sort(naturalSlideOrder);
    if (!slidePaths.length) {
      throw new Error('In dieser Datei wurden keine Folien gefunden (ist es wirklich eine .pptx-Datei?).');
    }

    const parser = new DOMParser();
    const parts = [];
    for (const path of slidePaths.slice(0, 120)) { // Sicherheitsgrenze gegen extrem lange Decks
      const xmlText = await zip.files[path].async('text');
      const doc = parser.parseFromString(xmlText, 'application/xml');
      const nodes = doc.getElementsByTagName('a:t');
      const lineParts = [];
      for (let i = 0; i < nodes.length; i++) {
        const t = (nodes[i].textContent || '').trim();
        if (t) lineParts.push(t);
      }
      if (lineParts.length) parts.push(lineParts.join(' '));
    }

    const full = parts.join('\n\n').replace(/[ \t]+/g, ' ').trim();
    if (full.length < 40) {
      throw new Error('Aus dieser PowerPoint-Datei konnte kein brauchbarer Text extrahiert werden (evtl. nur Bilder/Diagramme ohne echten Text).');
    }
    return { text: full, slideCount: slidePaths.length };
  }

  window.PPTXImport = { extractTextFromPptx };
})();
