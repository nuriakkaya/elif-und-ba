/* ==============================================================
   KI-Content-Erstellung: Grundgerüst (Blueprint Phase 3).
   Erzeugt Frage/Antwort-Karten aus Rohtext — braucht KEINE eigene
   Netlify Function, sondern nutzt denselben generischen
   /.netlify/functions/tutor-Endpunkt wie der KI-Tutor (app/aigen.js)
   und "Beliebiges Thema" im Live-Modus (app/livequiz.js): Prompt rein,
   Text raus, hier streng als JSON geparst und validiert.

   Erste angeschlossene Quelle (Blueprint Phase 4): "Notizen einfügen"
   (Freitext). Die restlichen 11 Quellen aus dem "Magischer Import"-
   Dialog (PDF, PowerPoint, YouTube, Foto/OCR, ...) bauen auf demselben
   generateCardsFromText auf, sobald ihre jeweilige Text-Extraktion
   angeschlossen ist — deshalb bewusst text-zentriert gehalten.
   ============================================================== */
(function () {
  function buildCardGenPrompt(text, count) {
    return (
      'Du erstellst Lernkarten (Frage/Antwort) auf Deutsch aus einem gegebenen Text, ' +
      'für eine Karteikarten- und Quiz-App. Lies den folgenden Text und erzeuge bis zu ' +
      count + ' sinnvolle, in sich abgeschlossene Frage-Antwort-Paare, die die wichtigsten ' +
      'Fakten, Begriffe und Zusammenhänge abdecken. Jede Antwort ist kurz und präzise ' +
      '(max. 160 Zeichen, idealerweise unter 60), ein Satz oder Begriff, keine Aufzählungen ' +
      'mit Zeilenumbrüchen. Keine Duplikate, keine Trivial- oder Fangfragen. ' +
      'Antworte AUSSCHLIESSLICH mit einem JSON-Array, ohne Markdown, ohne Erklärungen. ' +
      'Format je Element:\n{"q":"<Frage>","a":"<Antwort>"}\n\n' +
      'Text:\n"""\n' + text.slice(0, 12000) + '\n"""'
    );
  }

  function validateGeneratedCards(raw, count) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    const seen = new Set();
    raw.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      const q = typeof entry.q === 'string' ? entry.q.trim().replace(/\s+/g, ' ') : '';
      const a = typeof entry.a === 'string' ? entry.a.trim().replace(/\s+/g, ' ') : '';
      if (!q || !a) return;
      if (q.length > 220 || a.length > 220) return;
      const key = q.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ q, a });
    });
    return out.slice(0, count);
  }

  /* ==============================================================
     "Startseite als KI-Einstieg" (Blueprint Phase 5): statt aus einem vom
     Nutzer gelieferten Text erzeugt die KI hier Karten direkt aus ihrem
     eigenen Wissen zu einem frei eingegebenen Thema (z. B. "Deeskalation
     im Sicherheitsdienst") — dasselbe Prinzip wie buildFreeTopicPrompt in
     app/livequiz.js ("Beliebiges Thema"), nur mit {q,a}-Karten statt
     fertigen Multiple-Choice-Optionen, damit direkt ein neuer "Eigener
     Stapel" draus wird (gleiche Pipeline wie jede andere Import-Quelle).
     ============================================================== */
  function buildTopicGenPrompt(topic, count) {
    return (
      'Du erstellst Lernkarten (Frage/Antwort) auf Deutsch zum Thema "' + topic + '" ' +
      'für eine Karteikarten- und Quiz-App, aus deinem eigenen Wissen (kein Text vorgegeben). ' +
      'Erzeuge genau ' + count + ' sinnvolle, in sich abgeschlossene Frage-Antwort-Paare, die die ' +
      'wichtigsten Fakten, Begriffe und Zusammenhänge zu diesem Thema abdecken. Jede Antwort ist ' +
      'kurz und präzise (max. 160 Zeichen, idealerweise unter 60), ein Satz oder Begriff, keine ' +
      'Aufzählungen mit Zeilenumbrüchen. Keine Duplikate, keine Trivial- oder Fangfragen. Falls das ' +
      'Thema zu vage, unsinnig oder nicht lernbar ist, erzeuge trotzdem dein bestes Verständnis davon. ' +
      'Antworte AUSSCHLIESSLICH mit einem JSON-Array, ohne Markdown, ohne Erklärungen. ' +
      'Format je Element:\n{"q":"<Frage>","a":"<Antwort>"}'
    );
  }

  async function generateCardsFromTopic(topic, count) {
    const clean = (topic || '').trim();
    if (!clean) throw new Error('Bitte zuerst ein Thema eingeben.');
    if (clean.length < 3) throw new Error('Das Thema ist noch zu kurz.');
    const n = count || 16;
    const r = await fetch('/.netlify/functions/tutor', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: buildTopicGenPrompt(clean, n), model: 'gemini-2.5-flash' }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || (j && j.error)) throw new Error((j && j.error) || ('KI-Backend antwortete mit ' + r.status));
    let out = (j && j.text) || '';
    out = out.replace(/```json/gi, '```').split('```').join('').trim();
    const s = out.indexOf('['), e = out.lastIndexOf(']');
    if (s < 0 || e <= s) throw new Error('Die KI hat kein verwertbares JSON geliefert.');
    const arr = JSON.parse(out.slice(s, e + 1));
    const valid = validateGeneratedCards(arr, n);
    if (valid.length < 3) throw new Error('Zu wenige brauchbare Karten erzeugt (' + valid.length + '). Versuch ein etwas anderes oder allgemeineres Thema.');
    return valid;
  }

  async function generateCardsFromText(text, count) {
    const clean = (text || '').trim();
    if (!clean) throw new Error('Bitte zuerst Text eingeben oder einfügen.');
    if (clean.length < 40) throw new Error('Der Text ist noch zu kurz, um sinnvolle Karten zu erzeugen (mind. ca. 40 Zeichen).');
    const n = count || 20;
    const r = await fetch('/.netlify/functions/tutor', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: buildCardGenPrompt(clean, n), model: 'gemini-2.5-flash' }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || (j && j.error)) throw new Error((j && j.error) || ('KI-Backend antwortete mit ' + r.status));
    let out = (j && j.text) || '';
    out = out.replace(/```json/gi, '```').split('```').join('').trim();
    const s = out.indexOf('['), e = out.lastIndexOf(']');
    if (s < 0 || e <= s) throw new Error('Die KI hat kein verwertbares JSON geliefert.');
    const arr = JSON.parse(out.slice(s, e + 1));
    const valid = validateGeneratedCards(arr, n);
    if (valid.length < 3) throw new Error('Zu wenige brauchbare Karten erzeugt (' + valid.length + '). Versuch einen längeren oder klareren Text.');
    return valid;
  }

  window.AIImport = { buildCardGenPrompt, validateGeneratedCards, generateCardsFromText, buildTopicGenPrompt, generateCardsFromTopic };
})();
