/* ==============================================================
   "Fotografiere deine Notizen" (Foto-Upload + OCR, Blueprint Phase 4,
   neunte angeschlossene Quelle). Läuft komplett CLIENTSEITIG über
   tesseract.js (WASM-Texterkennung) — das Foto selbst geht dabei nie an
   einen Server, nur der erkannte Text fließt danach wie bei "Notizen" in
   generateCardsFromText. Vendort (npm install tesseract.js /
   tesseract.js-core, offizielle Pakete, kein CDN): `vendor/tesseract.min.js`
   (Haupt-API), `vendor/tesseract-worker.min.js` (läuft in einem Web Worker,
   damit das Erkennen die UI nicht blockiert) und `vendor/tesseract-core-lstm.js`
   + `vendor/tesseract-core-lstm.wasm` (die eigentliche LSTM-Erkennungs-Engine).

   EINSCHRÄNKUNG (bewusst, siehe README): die Sprachdaten selbst
   (deutsche/englische Schrifterkennungs-Modelle, je ca. 1-2 MB) werden NICHT
   vendort — die lädt tesseract.js beim ersten Lauf automatisch von seinem
   offiziellen CDN nach (Standardverhalten der Bibliothek, kein eigener Code
   nötig). Das braucht eine echte Internetverbindung im Browser der
   Person, die die App nutzt — funktioniert in der echten Web-App
   (Netlify) und in der Offline-Einzeldatei-Vorschau, SOFERN der Browser
   selbst online ist. In dieser Sandbox hier lässt sich der eigentliche
   Erkennungslauf deshalb nicht Ende-zu-Ende testen (kein Zugriff auf
   externe CDNs) — Ladefehler des Worker-Scripts liefern wie bei
   PDF/Anki eine klare Fehlermeldung statt eines Absturzes.
   ============================================================== */
(function () {
  let workerPromise = null;

  // WICHTIG: Wenn beim internen Laden der Sprachdaten (Aktion "loadLanguage") ein Fehler
  // auftritt, ruft tesseract.js intern zwar einen Fehler-Callback auf, löst aber NICHT das
  // von createWorker() zurückgegebene Promise auf — ohne Gegenmaßnahme würde die App hier
  // ewig "lädt…" anzeigen (bekannte Einschränkung der Bibliothek). Deshalb: eigener
  // errorHandler UND ein Timeout als Sicherheitsnetz, beide lösen dasselbe Promise ab.
  function getWorker() {
    if (!workerPromise) {
      if (!window.Tesseract) {
        workerPromise = Promise.reject(new Error('OCR ist in dieser Umgebung nicht verfügbar (Tesseract fehlt).'));
      } else {
        workerPromise = new Promise((resolve, reject) => {
          let settled = false;
          const fail = (msg) => {
            if (settled) return;
            settled = true;
            workerPromise = null; // nächster Versuch (z. B. nach Internetverbindung) startet neu
            reject(new Error(msg));
          };
          const timeoutId = setTimeout(() => {
            fail('Die OCR-Engine antwortet nicht (Zeitüberschreitung) — braucht eine Internetverbindung, um die Spracherkennungsdaten zu laden.');
          }, 20000);

          window.Tesseract.createWorker('deu', 1, {
            workerPath: 'vendor/tesseract-worker.min.js',
            // Dateiname bewusst wie im npm-Paket belassen (nicht z.B. zu "tesseract-core.js"
            // umbenannt): die generierte Emscripten-Glue-Datei referenziert ihre eigene .wasm
            // per hartcodiertem Namen ("tesseract-core-lstm.wasm") intern selbst — bei einer
            // Umbenennung würde der Worker die falsche/eine nicht existierende Datei suchen.
            corePath: 'vendor/tesseract-core-lstm.js',
            // Standardmäßig lädt tesseract.js sein Worker-Skript als Blob-URL nach — darin
            // kann die (relative) Kern-.wasm-Datei aber nicht mehr aufgelöst werden ("Failed
            // to parse URL"), weil ein Blob keine sinnvolle Basis-Adresse hat. Mit
            // workerBlobURL:false wird der Worker stattdessen direkt von workerPath
            // instanziiert (echte, auflösbare URL).
            workerBlobURL: false,
            logger: () => {},
            errorHandler: (e) => fail('Die OCR-Engine konnte nicht geladen werden: ' + ((e && e.message) || e) + ' — braucht eine Internetverbindung für die Spracherkennungsdaten.'),
          }).then((w) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            resolve(w);
          }).catch((e) => {
            clearTimeout(timeoutId);
            fail('Die OCR-Engine konnte nicht geladen werden: ' + ((e && e.message) || e));
          });
        });
      }
    }
    return workerPromise;
  }

  function isImageFile(file) {
    if (file && typeof file.type === 'string' && file.type.indexOf('image/') === 0) return true;
    return /\.(png|jpe?g|webp|bmp|gif)$/i.test((file && file.name) || '');
  }

  async function extractTextFromImage(file) {
    if (!file) throw new Error('Bitte zuerst ein Foto auswählen.');
    if (!isImageFile(file)) throw new Error('Das ist keine unterstützte Bilddatei (JPG, PNG, WEBP, BMP).');
    if (file.size > 15 * 1024 * 1024) throw new Error('Das Foto ist zu groß (max. 15 MB).');

    const worker = await getWorker();
    let result;
    try {
      result = await worker.recognize(file);
    } catch (e) {
      throw new Error('Der Text im Foto konnte nicht erkannt werden. ' + ((e && e.message) || ''));
    }
    let text = (result && result.data && result.data.text) || '';
    text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (text.length < 15) {
      throw new Error('Im Foto wurde kein brauchbarer Text erkannt — schärfer fotografieren, mehr Licht oder direkter auf den Text zoomen hilft meistens.');
    }
    return { text };
  }

  window.OCRImport = { extractTextFromImage };
})();
