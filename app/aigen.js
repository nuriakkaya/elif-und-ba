/* ==============================================================
   AIGen — KI-Fragengenerierung in Original-Qualität.

   Das echte Gizmo erzeugt Distraktoren und Lückentext-Begriffe mit
   einer KI (beobachtet: fachlich verwandte, plausible, aber klar
   falsche Optionen wie "Carl Gustav Jung"/"B. F. Skinner" zur
   Maslow-Karte). Unsere Heuristik (app/engine.js) kommt nah ran,
   aber die KI-Variante ist besser — deshalb hier:

   - Beim Start einer Runde werden für die Karten der Runde (ohne
     eigene MC-Optionen) im Hintergrund KI-Varianten über die schon
     vorhandene Netlify-Function (/.netlify/functions/tutor, Gemini)
     erzeugt — EIN Batch-Request pro Runde, max. 8 Karten.
   - Ergebnisse landen dauerhaft im localStorage (s34a_aigen_v1):
     jede Karte wird nur EINMAL generiert (Kosten + Tempo).
   - engine.js benutzt die KI-Daten automatisch, sobald vorhanden;
     bis dahin (und wenn der Endpoint fehlt, z.B. lokal ohne
     Netlify) greift die Heuristik. Die App funktioniert also
     unverändert offline.
   ============================================================== */
(function () {
  const KEY = 's34a_aigen_v1';
  let mem = null;
  const failed = new Set(); // in dieser Sitzung erfolglos versucht -> kein Refetch-Loop
  let inflight = false;

  function load() {
    if (mem === null) {
      try { mem = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { mem = {}; }
    }
    return mem;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* voll */ }
  }
  function keyOf(topicId, card) {
    return window.SRS ? window.SRS.cardKey(topicId, card) : String(topicId) + '::' + String(card.q || '');
  }

  function get(topicId, card) {
    const m = load();
    return m[keyOf(topicId, card)] || null;
  }

  // Strikte Validierung der KI-Ausgabe — nur speichern, was die Engine
  // sicher rendern kann (Begriff muss wörtlich in der Antwort stehen usw.).
  function validate(entry, card) {
    if (!entry || typeof entry !== 'object') return null;
    const a = (card.a || '').trim();
    const clean = (x) => typeof x === 'string' ? x.trim().replace(/\s+/g, ' ') : '';
    if (entry.type === 'cloze') {
      const term = clean(entry.term);
      if (!term || term.length < 3 || term.length > 40 || !a.includes(term)) return null;
      if ((a.length - term.length) < 10) return null; // es muss Satzkontext übrig bleiben
      const w = (Array.isArray(entry.wrongTerms) ? entry.wrongTerms : [])
        .map(clean).filter(x => x && x.length <= 40 && x.toLowerCase() !== term.toLowerCase());
      if (w.length < 2) return null;
      return { type: 'cloze', term, wrongTerms: [...new Set(w)].slice(0, 3) };
    }
    if (entry.type === 'mc') {
      if (a.length > 90) return null; // lange Prosa taugt nicht als MC-Option
      const d = (Array.isArray(entry.distractors) ? entry.distractors : [])
        .map(clean).filter(x => x && x.length <= 90 && x.toLowerCase() !== a.toLowerCase());
      if (d.length < 2) return null;
      return { type: 'mc', distractors: [...new Set(d)].slice(0, 3) };
    }
    return null;
  }

  function buildPrompt(items) {
    return (
      'Du erzeugst Quiz-Varianten für eine deutsche Lern-App zur §34a-Sachkundeprüfung (Bewachungsgewerbe). ' +
      'Für jede Karte (Frage + korrekte Antwort) liefere GENAU EIN Objekt:\n' +
      '- Wenn die Antwort kurz ist (max. ~90 Zeichen): {"i":<index>,"type":"mc","distractors":["...","..."]} — ' +
      '2 bis 3 plausible, fachlich verwandte, aber EINDEUTIG falsche Antwortoptionen in gleichem Stil und ähnlicher Länge wie die richtige Antwort.\n' +
      '- Sonst: {"i":<index>,"type":"cloze","term":"...","wrongTerms":["...","..."]} — "term" ist ein Schlüsselbegriff, ' +
      'der WÖRTLICH (zeichengenau!) in der Antwort vorkommt und sich als Lücke eignet; "wrongTerms" sind 2-3 plausible falsche Begriffe derselben Kategorie.\n' +
      'Regeln: Nur Deutsch. Distraktoren dürfen NIE ebenfalls richtig sein. Keine Erklärungen. ' +
      'Antworte AUSSCHLIESSLICH mit einem JSON-Array, ohne Markdown.\n\n' +
      'Karten:\n' + JSON.stringify(items)
    );
  }

  // Für die Karten einer Runde fehlende KI-Varianten nachziehen (1 Request).
  async function warmup(cards, topicId) {
    if (inflight || !cards || !cards.length) return;
    const m = load();
    const todo = cards.filter(c =>
      c && c.a && c.a.trim() && !(c.options && c.options.length) &&
      !m[keyOf(topicId, c)] && !failed.has(keyOf(topicId, c))
    ).slice(0, 8);
    if (!todo.length) return;
    inflight = true;
    try {
      const items = todo.map((c, i) => ({ i, frage: c.q, antwort: (c.a || '').slice(0, 420) }));
      const r = await fetch('/.netlify/functions/tutor', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: buildPrompt(items), model: 'gemini-2.5-flash' }),
      });
      const j = await r.json().catch(() => ({}));
      let text = (j && j.text) || '';
      text = text.replace(/```json/gi, '```').split('```').join('').trim();
      const s = text.indexOf('['), e = text.lastIndexOf(']');
      if (s < 0 || e <= s) throw new Error('kein JSON im Modell-Output');
      const arr = JSON.parse(text.slice(s, e + 1));
      todo.forEach((c, idx) => {
        const raw = (Array.isArray(arr) ? arr : []).find(x => x && x.i === idx);
        const v = validate(raw, c);
        const k = keyOf(topicId, c);
        if (v) m[k] = v; else failed.add(k);
      });
      save();
    } catch (err) {
      // Endpoint fehlt (lokal) oder Modell-Output unbrauchbar: Heuristik bleibt aktiv.
      todo.forEach(c => failed.add(keyOf(topicId, c)));
    }
    inflight = false;
  }

  // Anteil der Karten mit KI-Variante (für Anzeige/Debug)
  function coverage(cards, topicId) {
    const m = load();
    const rel = cards.filter(c => c.a && c.a.trim() && !(c.options && c.options.length));
    const done = rel.filter(c => m[keyOf(topicId, c)]).length;
    return { done, total: rel.length };
  }

  window.AIGen = { get, warmup, coverage };
})();
