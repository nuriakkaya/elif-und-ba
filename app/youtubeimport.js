/* ==============================================================
   YouTube-Import (Blueprint Phase 4, siebte Quelle) — Client-Wrapper für
   netlify/functions/fetch-youtube-transcript.mjs. Genau wie beim
   Website-Link braucht das einen Server (Untertitel-Abruf ist von einer
   fremden Origin aus dem Browser nicht per fetch() möglich); der
   zurückgegebene Text fließt danach wie bei jeder anderen Quelle in
   dieselbe generateCardsFromText-Pipeline.
   ============================================================== */
(function () {
  async function extractTranscriptFromUrl(url) {
    const clean = (url || '').trim();
    if (!clean) throw new Error('Bitte zuerst einen YouTube-Link oder eine Video-ID eingeben.');
    const r = await fetch('/.netlify/functions/fetch-youtube-transcript', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: clean }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || (j && j.error)) {
      throw new Error((j && j.error) || ('Transkript konnte nicht geladen werden (' + r.status + ').'));
    }
    return { text: j.text || '', languageCode: j.languageCode || '' };
  }

  window.YouTubeImport = { extractTranscriptFromUrl };
})();
