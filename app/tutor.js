/* ==============================================================
   KI-TUTOR (Logik) — app/tutor.js   ·  NEU 03.08.2026

   Warum es dieses Modul gibt
   --------------------------
   Das Original zeigt zu JEDER Karte eine live erzeugte, STRUKTURIERTE
   Erklärung (Fettungen, Stichpunkte, Merksatz) und darunter zwei
   Aktionen: "Mehr Details" und "Stelle eine Frage" — freies Nachfragen
   zu genau dieser Karte. Unser bisheriger "Erklären"-Helfer lieferte
   nur zwei Sätze Fließtext in einer Sprechblase. Das war laut
   Status-Bericht (Abschnitt 3.1) die größte verbliebene Lücke zum
   Original — dieses Modul plus app/tutorui.js schließt sie.

   Aufgeteilt in Logik (hier, reines JS) und Oberfläche
   (app/tutorui.js, React): so ist der Markdown-Parser und der
   Prompt-Bau ohne Browser-Oberfläche testbar (window.Tutor._pure).

   Drei Probleme, die hier gelöst werden
   -------------------------------------
   1) VERFÜGBARKEIT. Den Endpunkt /.netlify/functions/tutor gibt es nur
      auf echtem Netlify mit gesetztem GEMINI_API_KEY. In der
      Einzeldatei-Vorschau (file://) existiert er nicht — bisher gab das
      pro Aufruf eine CORS-/Netzwerkfehlermeldung in der Konsole. Wir
      prüfen das Protokoll vorab und merken uns einen Fehlschlag für die
      ganze Sitzung: danach wird gar nicht erst angefragt.

   2) OFFLINE-ERSATZ. Statt einer Fehlermeldung baut offlineExplain()
      aus dem Kartenmaterial selbst eine strukturierte Erklärung
      (Kernsatz, Stichpunkte aus den Teilsätzen der Antwort, Merksatz
      aus card.detail). Die Vorschau sieht damit genauso aus wie die
      Online-Version — nur eben ohne echtes Sprachmodell. Das wird auch
      offen gesagt (Quelle "offline"), nichts wird vorgetäuscht.

   3) KOSTEN. Jede Karte wird pro Stufe (kurz/detail) nur EINMAL erklärt,
      das Ergebnis liegt dauerhaft im localStorage (s34a_tutor_v1). Beim
      zweiten Auftritt derselben Karte kommt die Erklärung sofort und
      ohne Modellaufruf. Rückfragen werden bewusst NICHT gecacht (die
      sind pro Person und Situation verschieden).
   ============================================================== */
(function () {
  const KEY = 's34a_tutor_v1';
  const MODEL = 'gemini-2.5-flash';
  const MAX_CACHE = 300;           // Einträge; darüber werden die ältesten verworfen
  const ENDPOINT = '/.netlify/functions/tutor';

  let mem = null;
  let endpointDown = false;        // in dieser Sitzung schon fehlgeschlagen -> nicht nochmal

  /* ---------- Cache ---------- */
  function load() {
    if (mem === null) {
      try { mem = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { mem = {}; }
    }
    return mem;
  }
  function save() {
    const m = load();
    const keys = Object.keys(m);
    if (keys.length > MAX_CACHE) {
      keys.sort((a, b) => (m[a].at || 0) - (m[b].at || 0))
          .slice(0, keys.length - MAX_CACHE)
          .forEach(k => { delete m[k]; });
    }
    try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (e) { /* Speicher voll */ }
  }
  function cacheKey(topicId, card, level) {
    const base = window.SRS ? window.SRS.cardKey(topicId, card) : String(topicId) + '::' + String((card && card.q) || '');
    return base + '::' + level;
  }
  function clearCache() { mem = {}; try { localStorage.removeItem(KEY); } catch (e) {} }

  /* ---------- Verfügbarkeit ----------
     file:// hat keine Netlify-Functions; ein fetch darauf erzeugt nur
     Konsolenrauschen. Genauso, wenn der Endpunkt einmal 404/500 lieferte. */
  function available() {
    if (endpointDown) return false;
    try { if (location.protocol === 'file:') return false; } catch (e) { return false; }
    return typeof fetch === 'function';
  }

  /* ---------- Roher Modellaufruf ----------
     Gibt { ok, text } oder { ok:false, error } zurück; wirft nie. */
  async function ask(prompt, opts) {
    opts = opts || {};
    if (!available()) return { ok: false, error: 'offline' };
    try {
      const r = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt, model: opts.model || MODEL }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j || !j.text) {
        // 500 = Key fehlt in Netlify, 404 = Function nicht deployt. Beides ist
        // ein Zustand, der sich in dieser Sitzung nicht mehr ändert.
        if (r.status === 404 || r.status === 405) endpointDown = true;
        return { ok: false, error: (j && j.error) || ('HTTP ' + r.status) };
      }
      return { ok: true, text: String(j.text).trim() };
    } catch (e) {
      endpointDown = true;   // Netzwerkfehler: Endpunkt existiert hier nicht
      return { ok: false, error: 'offline' };
    }
  }

  /* ==============================================================
     MARKDOWN-LEICHT
     Das Modell antwortet in Markdown (so ist es angewiesen). Eine
     komplette Markdown-Bibliothek wäre für Fettung + Listen deutlich
     überdimensioniert, deshalb ein kleiner eigener Parser: er liefert
     eine Blockliste, die React ohne dangerouslySetInnerHTML rendern
     kann — also ohne jedes HTML-Einschleusungsrisiko aus Modelltext.
     ============================================================== */

  /* Zerlegt eine Zeile in Textstücke mit Auszeichnung.
     **fett** / __fett__ / *kursiv* / `code` */
  function mdInline(text) {
    const src = String(text == null ? '' : text);
    const out = [];
    const re = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\n]+\*)/g;
    let last = 0, m;
    while ((m = re.exec(src)) !== null) {
      if (m.index > last) out.push({ text: src.slice(last, m.index) });
      const tok = m[0];
      if (tok.slice(0, 2) === '**') out.push({ text: tok.slice(2, -2), b: true });
      else if (tok.slice(0, 2) === '__') out.push({ text: tok.slice(2, -2), b: true });
      else if (tok[0] === '`') out.push({ text: tok.slice(1, -1), code: true });
      else out.push({ text: tok.slice(1, -1), i: true });
      last = m.index + tok.length;
    }
    if (last < src.length) out.push({ text: src.slice(last) });
    return out.length ? out : [{ text: '' }];
  }

  /* Zerlegt den Antworttext in Blöcke:
     { t:'h', level, text } | { t:'p', text } | { t:'ul'|'ol', items:[] } | { t:'note', text } */
  function mdBlocks(md) {
    const lines = String(md == null ? '' : md).replace(/\r/g, '').split('\n');
    const blocks = [];
    let para = [];
    const flush = () => {
      if (!para.length) return;
      const text = para.join(' ').trim();
      para = [];
      if (!text) return;
      // "💡 Merke: ..." bekommt einen eigenen Blocktyp (eigene Optik).
      if (/^(💡|ℹ️|⚠️|📌)/.test(text) || /^\*{0,2}(Merke|Eselsbrücke|Tipp)\*{0,2}\s*:/i.test(text)) {
        blocks.push({ t: 'note', text });
      } else {
        blocks.push({ t: 'p', text });
      }
    };
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (!t) { flush(); continue; }
      let m;
      if ((m = t.match(/^(#{1,4})\s+(.*)$/))) {
        flush(); blocks.push({ t: 'h', level: m[1].length, text: m[2].trim() }); continue;
      }
      if (/^([-*•])\s+/.test(t)) {
        flush();
        const items = [];
        while (i < lines.length && /^\s*([-*•])\s+/.test(lines[i])) {
          items.push(lines[i].trim().replace(/^([-*•])\s+/, ''));
          i++;
        }
        i--;
        blocks.push({ t: 'ul', items });
        continue;
      }
      if (/^\d+[.)]\s+/.test(t)) {
        flush();
        const items = [];
        while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
          items.push(lines[i].trim().replace(/^\s*\d+[.)]\s+/, ''));
          i++;
        }
        i--;
        blocks.push({ t: 'ol', items });
        continue;
      }
      if (/^>\s?/.test(t)) { flush(); blocks.push({ t: 'note', text: t.replace(/^>\s?/, '') }); continue; }
      para.push(t);
    }
    flush();
    return blocks;
  }

  /* ==============================================================
     PROMPTS
     Bewusst eng geführt: feste Struktur, feste Länge, Du-Form,
     Prüfungsbezug §34a. Ohne Formatvorgabe liefert das Modell
     Fließtext-Absätze — genau das, was wir loswerden wollten.
     ============================================================== */
  const ROLE =
    'Du bist der KI-Tutor einer Lern-App für die Sachkundeprüfung nach §34a GewO ' +
    '(Bewachungsgewerbe, IHK, Deutschland). Du erklärst freundlich, konkret und ohne Fülltext.';

  function buildExplainPrompt(o) {
    o = o || {};
    const level = o.level === 'detail' ? 'detail' : 'kurz';
    const ctx = [];
    if (o.kat) ctx.push('THEMENFELD: ' + o.kat);
    ctx.push('FRAGE: ' + (o.q || ''));
    if (o.a) ctx.push('RICHTIGE ANTWORT: ' + String(o.a).slice(0, 600));
    if (o.wrong && o.wrong.length) ctx.push('HÄUFIG VERWECHSELT MIT: ' + o.wrong.slice(0, 3).join(' | '));

    if (level === 'detail') {
      return ROLE + '\n\n' + ctx.join('\n') + '\n\n' +
        'Erkläre das ausführlich auf Deutsch in der Du-Form. Antworte in Markdown, genau in dieser Reihenfolge:\n' +
        '1. Eine Zeile "**Kurz gesagt:** …" mit dem Kern in einem Satz.\n' +
        '2. Drei bis fünf Stichpunkte mit "- ", je ein Aspekt, Fachbegriffe **fett**.\n' +
        '3. Eine Zeile "**Typischer Prüfungsfehler:** …".\n' +
        '4. Eine Zeile "**Aus der Praxis:** …" mit einem kurzen Beispiel aus dem Wachdienst.\n' +
        '5. Eine Zeile "💡 **Merke:** …" mit einer Eselsbrücke.\n' +
        'Höchstens 220 Wörter. Keine Überschriften, keine Einleitung, keine Rückfrage am Ende.';
    }
    return ROLE + '\n\n' + ctx.join('\n') + '\n\n' +
      'Erkläre das kurz auf Deutsch in der Du-Form. Antworte in Markdown, genau in dieser Reihenfolge:\n' +
      '1. Eine Zeile "**Kurz gesagt:** …" mit dem Kern in einem Satz.\n' +
      '2. Zwei bis vier Stichpunkte mit "- ", je ein Aspekt, Fachbegriffe **fett**.\n' +
      '3. Eine Zeile "💡 **Merke:** …" mit einer Eselsbrücke.\n' +
      'Höchstens 120 Wörter. Keine Überschriften, keine Einleitung, keine Rückfrage am Ende.';
  }

  function buildFollowUpPrompt(o) {
    o = o || {};
    const hist = (o.history || []).slice(-4)
      .map(m => (m.role === 'user' ? 'LERNENDE PERSON: ' : 'DU: ') + String(m.text).slice(0, 500))
      .join('\n');
    return ROLE + '\n\n' +
      'Es geht um diese Karteikarte:\n' +
      'FRAGE: ' + (o.q || '') + '\n' +
      (o.a ? 'RICHTIGE ANTWORT: ' + String(o.a).slice(0, 600) + '\n' : '') +
      (hist ? '\nBISHERIGES GESPRÄCH:\n' + hist + '\n' : '') +
      '\nNEUE FRAGE: ' + String(o.question || '').slice(0, 500) + '\n\n' +
      'Antworte auf Deutsch in der Du-Form, höchstens 110 Wörter, in Markdown mit **Fettungen** ' +
      'und wo sinnvoll Stichpunkten ("- "). Bleib beim Thema der Karte. Wenn die Frage nichts mit ' +
      'der Karte oder dem §34a-Stoff zu tun hat, sag das freundlich in einem Satz.';
  }

  /* ==============================================================
     OFFLINE-ERSATZ
     Baut aus der Karte selbst eine Erklärung im gleichen Format.
     Kein Modell, keine Erfindung: es wird nur umgestellt, was in der
     Karte ohnehin steht.
     ============================================================== */
  /* Satztrennung ohne Lookbehind-Regex: die gibt es erst ab Safari 16.4,
     und die App soll auch auf älteren iPhones laufen. */
  function splitSentences(text) {
    const s = String(text || '');
    const out = [];
    let buf = '';
    for (let i = 0; i < s.length; i++) {
      buf += s[i];
      if (s[i] === '.' || s[i] === '!' || s[i] === '?') {
        const sep = s[i + 1], after = s[i + 2];
        if ((sep === ' ' || sep === '\n') && after && /[A-ZÄÖÜ0-9§]/.test(after)) {
          out.push(buf.trim()); buf = ''; i++;
        }
      }
    }
    if (buf.trim()) out.push(buf.trim());
    return out.filter(x => x.length > 2);
  }

  function offlineExplain(o) {
    o = o || {};
    const detail = o.detail || {};
    const sents = splitSentences(o.a);
    const lines = [];
    if (sents.length) {
      lines.push('**Kurz gesagt:** ' + sents[0]);
      const rest = sents.slice(1, o.level === 'detail' ? 6 : 4);
      if (rest.length) { lines.push(''); rest.forEach(s => lines.push('- ' + s)); }
    } else if (o.q) {
      lines.push('**Kurz gesagt:** Präg dir zu „' + o.q + '" die markierte Lösung ein.');
    }
    if (Array.isArray(detail.funktion) && detail.funktion.length) {
      if (!lines.length || lines[lines.length - 1] !== '') lines.push('');
      detail.funktion.slice(0, 3).forEach(f => lines.push('- ' + f));
    }
    if (detail.merksatz) { lines.push(''); lines.push('💡 **Merke:** ' + detail.merksatz); }
    else if (sents.length > 1) { lines.push(''); lines.push('💡 **Merke:** ' + sents[sents.length - 1]); }
    if (!lines.length) lines.push('Zu dieser Karte liegt noch kein Erklärtext vor.');
    return lines.join('\n');
  }

  /* ==============================================================
     ÖFFENTLICHE API
     ============================================================== */

  /* Erklärung zu einer Karte. Reihenfolge: Cache -> Modell -> Offline-Ersatz.
     Liefert { text, source: 'cache'|'ki'|'offline', error? } */
  async function explainCard(card, o) {
    o = o || {};
    const level = o.level === 'detail' ? 'detail' : 'kurz';
    const answer = o.answerTxt || (card && card.a) || '';
    const ck = cacheKey(o.topicId, card, level);

    const m = load();
    if (m[ck] && m[ck].text) return { text: m[ck].text, source: 'cache' };

    const res = await ask(buildExplainPrompt({
      q: (card && card.q) || o.q || '',
      a: answer,
      kat: o.kat || (card && card.detail && card.detail.kat) || '',
      wrong: o.wrong || [],
      level,
    }));

    if (res.ok) {
      m[ck] = { text: res.text, at: Date.now() };
      save();
      if (window.AIHistory) {
        window.AIHistory.log({
          type: 'tutor',
          title: (card && card.q) || o.q || 'Karte',
          subtitle: 'KI-Tutor · ' + (level === 'detail' ? 'Ausführlich' : 'Erklärt'),
          topicId: o.topicId,
        });
      }
      return { text: res.text, source: 'ki' };
    }

    return {
      text: offlineExplain({ q: (card && card.q) || o.q || '', a: answer, detail: (card && card.detail) || o.detail, level }),
      source: 'offline',
      error: res.error,
    };
  }

  /* Freie Rückfrage zu genau dieser Karte.
     Liefert { text, source: 'ki'|'offline' } */
  async function askAboutCard(card, o) {
    o = o || {};
    const res = await ask(buildFollowUpPrompt({
      q: (card && card.q) || o.q || '',
      a: o.answerTxt || (card && card.a) || '',
      history: o.history || [],
      question: o.question || '',
    }));
    if (res.ok) {
      if (window.AIHistory) {
        window.AIHistory.log({
          type: 'tutor',
          title: String(o.question || '').slice(0, 80),
          subtitle: 'KI-Tutor · Rückfrage',
          topicId: o.topicId,
        });
      }
      return { text: res.text, source: 'ki' };
    }
    // Ehrlich bleiben: keine erfundene Antwort, sondern der Hinweis, was fehlt.
    return {
      text: 'Für freie Rückfragen brauche ich die Online-Version der App ' +
            '(Netlify mit hinterlegtem Modell-Schlüssel). Hier in der Vorschau kann ich dir nur ' +
            'die Erklärung aus dem Kartenmaterial zeigen.\n\n' +
            '💡 **Merke:** ' + (splitSentences(o.answerTxt || (card && card.a) || '')[0] || 'Schau dir die markierte Lösung nochmal an.'),
      source: 'offline',
    };
  }

  window.Tutor = {
    ask, explainCard, askAboutCard, available, clearCache,
    mdBlocks, mdInline,
    _pure: { mdBlocks, mdInline, buildExplainPrompt, buildFollowUpPrompt, offlineExplain, splitSentences },
  };
})();
