/* ==============================================================
   Word-Dokument-Text-Extraktion (Blueprint Phase 4, dritte angeschlossene
   Quelle nach "Notizen einfügen" und "PDF"). Läuft komplett clientseitig
   über mammoth.js (vendor/mammoth.browser.min.js, lokal statt CDN — gleicher
   Grund wie bei vendor/supabase.js und vendor/pdf.min.js). Anders als PDF
   braucht mammoth.js KEINEN separaten Worker — dadurch funktioniert diese
   Quelle (im Gegensatz zu PDF) auch in der Offline-Einzeldatei-Vorschau.

   Wie bei PDF geht die Datei selbst NIE an einen Server — nur der
   extrahierte Text fließt anschließend wie bei "Notizen" in
   generateCardsFromText.
   ============================================================== */
(function () {
  async function extractTextFromDocx(file) {
    if (!window.mammoth) {
      throw new Error('Word-Bibliothek konnte nicht geladen werden.');
    }
    const buf = await file.arrayBuffer();
    let result;
    try {
      result = await window.mammoth.extractRawText({ arrayBuffer: buf });
    } catch (e) {
      throw new Error('Diese Datei konnte nicht als Word-Dokument gelesen werden (beschädigt oder kein echtes .docx?).');
    }
    const full = (result && result.value || '').replace(/[ \t]+/g, ' ').trim();
    if (full.length < 40) {
      throw new Error('Aus diesem Word-Dokument konnte kein brauchbarer Text extrahiert werden.');
    }
    return { text: full };
  }

  window.DocxImport = { extractTextFromDocx };
})();
