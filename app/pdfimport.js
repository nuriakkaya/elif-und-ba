/* ==============================================================
   PDF-Text-Extraktion (Blueprint Phase 4, erste angeschlossene Quelle
   nach "Notizen einfügen"). Läuft komplett clientseitig über pdf.js
   (vendor/pdf.min.js, lokal statt per CDN — gleicher Grund wie bei
   vendor/supabase.js: kein externer Netzwerkzugriff nötig/verlässlich).
   Es wird NIE die PDF-Datei selbst an einen Server geschickt — nur der
   daraus extrahierte TEXT geht anschließend (wie bei "Notizen") an
   /.netlify/functions/tutor zur Kartenerzeugung. Kein eigener
   Datei-Upload-Endpunkt nötig, keine Größenlimits eines Function-Bodys
   relevant.

   pdf.js braucht einen Web Worker für die eigentliche Verarbeitung.
   Der Worker-Code (vendor/pdf.worker.min.js) wird bewusst NICHT als
   normales <script> eingebunden (er ist für einen Worker-Kontext
   gebaut, nicht fürs Hauptfenster), sondern zur Laufzeit per fetch()
   geholt und als Blob-URL an pdf.js übergeben. Das funktioniert in der
   echten, über einen Server ausgelieferten App (Netlify, lokaler
   Dev-Server) — nicht aber in der Offline-Einzeldatei-Vorschau (dort
   gibt es keine separate Worker-Datei zum Nachladen); das ist die
   gleiche Einschränkung wie bei den KI-Funktionen, die das
   Netlify-Backend brauchen.
   ============================================================== */
(function () {
  let workerUrlPromise = null;

  async function ensureWorker() {
    if (workerUrlPromise) return workerUrlPromise;
    workerUrlPromise = (async () => {
      const r = await fetch('vendor/pdf.worker.min.js');
      if (!r.ok) throw new Error('worker-fetch-failed');
      const text = await r.text();
      const blob = new Blob([text], { type: 'application/javascript' });
      return URL.createObjectURL(blob);
    })();
    return workerUrlPromise;
  }

  // onProgress(page, totalPages) optional, fürs UI ("Seite 3 von 12 gelesen…")
  async function extractTextFromPdf(file, onProgress) {
    if (!window.pdfjsLib) {
      throw new Error('PDF-Bibliothek konnte nicht geladen werden.');
    }
    let workerUrl;
    try {
      workerUrl = await ensureWorker();
    } catch (e) {
      throw new Error('PDF-Import braucht die volle Web-App und funktioniert nicht in dieser Offline-Einzeldatei-Vorschau.');
    }
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

    const buf = await file.arrayBuffer();
    let doc;
    try {
      doc = await window.pdfjsLib.getDocument({ data: buf }).promise;
    } catch (e) {
      throw new Error('Diese Datei konnte nicht als PDF gelesen werden (beschädigt, passwortgeschützt oder kein echtes PDF?).');
    }

    const parts = [];
    const maxPages = Math.min(doc.numPages, 60); // Sicherheitsgrenze gegen extrem lange Dokumente
    for (let i = 1; i <= maxPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      parts.push(content.items.map((it) => it.str || '').join(' '));
      if (onProgress) onProgress(i, maxPages);
    }
    const full = parts.join('\n\n').replace(/[ \t]+/g, ' ').trim();
    if (full.length < 40) {
      throw new Error('Aus dieser PDF konnte kein brauchbarer Text extrahiert werden — vermutlich nur eingescannte Bilder ohne echten Text (dafür bräuchte es OCR, siehe "Foto · OCR").');
    }
    return { text: full, pagesRead: maxPages, totalPages: doc.numPages };
  }

  window.PDFImport = { extractTextFromPdf };
})();
