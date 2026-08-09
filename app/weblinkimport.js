/* ==============================================================
   Website-Link-Import (Blueprint Phase 4, sechste angeschlossene Quelle).
   Anders als PDF/Word/PowerPoint läuft die eigentliche Abfrage NICHT im
   Browser (fremde Websites erlauben so gut wie nie CORS für unsere
   Origin) — braucht die neue, kleine Netlify Function
   netlify/functions/fetch-url.mjs, die serverseitig lädt und den reinen
   Text zurückgibt. Genau wie bei den anderen Quellen fließt der Text
   danach in dieselbe generateCardsFromText-Pipeline wie "Notizen".
   ============================================================== */
(function () {
  async function extractTextFromUrl(url) {
    const clean = (url || '').trim();
    if (!clean) throw new Error('Bitte zuerst einen Link eingeben.');
    let withScheme = clean;
    if (!/^https?:\/\//i.test(withScheme)) withScheme = 'https://' + withScheme;

    const r = await fetch('/.netlify/functions/fetch-url', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: withScheme }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || (j && j.error)) {
      throw new Error((j && j.error) || ('Seite konnte nicht geladen werden (' + r.status + ').'));
    }
    return { text: j.text || '' };
  }

  window.WebLinkImport = { extractTextFromUrl };
})();
