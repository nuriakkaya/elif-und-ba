/* ==============================================================
   🎤 SPRECH-PRÜFUNG (11.08.2026) — "sag es mir vor, ich höre zu".

   Dieses Modul beantwortet genau eine Frage: Hat das Kind den
   arabischen Text ungefähr richtig gesprochen? Es wird an zwei
   Stellen gebraucht — beim Auswendiglernen der Suren (app/hifz.js)
   und beim Nachsprechen einzelner Karten (app/quiz.js).

   Wie es funktioniert
   -------------------
   1) Der Browser hört über die eingebaute Spracherkennung zu
      (SpeechRecognition, Sprache "ar-SA"). Das Kind spricht, der
      Browser schreibt mit.
   2) Das Mitgeschriebene wird mit dem Sollvers verglichen — nicht
      Buchstabe für Buchstabe (das würde nie passen), sondern Wort
      für Wort und großzügig:
        - alle Zeichen über/unter den Buchstaben (Harekeler) weg,
        - Alif-Varianten أ إ آ ٱ ى -> ا, ة -> ه, ؤ -> و, ئ -> ي,
        - der Artikel "ال" und angehängte Vorsilben (و ف ب ل ك)
          dürfen fehlen,
        - pro Wort sind 1-3 Buchstaben Abweichung erlaubt
          (je nach Wortlänge).
      Anschließend werden Soll- und Ist-Folge wie zwei Sätze
      gegeneinander ausgerichtet (Needleman-Wunsch), damit auch ein
      ausgelassenes Wort in der Mitte richtig erkannt wird.
   3) Ergebnis: Prozentwert + für JEDES Wort ein Häkchen, ein
      "gefehlt" oder ein "anders gesagt" — daraus baut die App das
      farbige Wort-für-Wort-Feedback.

   Wenn kein Mikrofon geht
   -----------------------
   Firefox kennt die Spracherkennung nicht, manche Kinder dürfen das
   Mikrofon nicht freigeben, und ohne Internet geht sie auch nicht.
   Dann schaltet die App automatisch um:
     - "aufnehmen & selbst anhören" (MediaRecorder) — das Kind hört
       sich selbst und bestätigt ehrlich, oder
     - ganz ohne Ton das Wort-Puzzle (siehe app/hifz.js).
   Es gibt also NIE eine Sackgasse.

   Datenschutz (steht so auch in der Hilfe): Die Spracherkennung von
   Chrome schickt den Ton zu Google, die von Safari zu Apple. Es wird
   nichts gespeichert und nichts an unseren Server geschickt. Die
   Lehrkraft kann das Mikrofon im Klassenzimmer komplett abschalten
   (Schalter "Mikrofon erlauben"), dann nutzt die App nur Puzzle.
   ============================================================== */
window.Recite = (function () {
  const MIC_OFF_KEY = 'eb_mic_off_v1';

  /* ---------------- 1. Text aufbereiten ---------------- */
  // Alles weg, was nicht Aussprache ist: Harekeler, Koran-Zeichen,
  // Vers-Nummern, lateinische Buchstaben, Satzzeichen.
  const STRIP = /[ؐ-ًؚ-ٰٟۖ-ۭـ۝۞۩]/g;
  function normalize(text) {
    return String(text || '')
      .replace(STRIP, '')
      .replace(/[آأإاٱى]/g, 'ا') // آ أ إ ا ٱ ى -> ا
      .replace(/ة/g, 'ه')                                  // ة -> ه
      .replace(/ؤ/g, 'و')                                  // ؤ -> و
      .replace(/[ئیي]/g, 'ي')                    // ئ ی ي -> ي
      .replace(/[^ء-ي\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function words(text) {
    const n = normalize(text);
    return n ? n.split(' ').filter(Boolean) : [];
  }

  /* Vorsilben, die die Spracherkennung gern verschluckt oder dazudichtet. */
  function stem(w) {
    // Erst Artikel (mit oder ohne Vorsilbe), sonst nur die Vorsilbe.
    let s = w.replace(/^[\u0648\u0641\u0628\u0644\u0643]?\u0627\u0644/, '');
    if (s === w) s = w.replace(/^[\u0648\u0641\u0628\u0644\u0643]/, '');
    // Wenn nach dem Abschneiden fast nichts mehr übrig ist, war es keine
    // Vorsilbe, sondern Teil des Wortes (الله ist nicht ال + له!).
    return s.length >= 3 ? s : w;
  }

  function lev(a, b, max) {
    if (a === b) return 0;
    const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > max) return max + 1;
    let prev = new Array(lb + 1), cur = new Array(lb + 1);
    for (let j = 0; j <= lb; j++) prev[j] = j;
    for (let i = 1; i <= la; i++) {
      cur[0] = i;
      let best = cur[0];
      for (let j = 1; j <= lb; j++) {
        const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (cur[j] < best) best = cur[j];
      }
      if (best > max) return max + 1;
      const t = prev; prev = cur; cur = t;
    }
    return prev[lb];
  }

  function tolerance(w) { return w.length <= 3 ? 1 : w.length <= 6 ? 2 : 3; }

  /* Passen zwei Wörter zusammen? 1 = perfekt, 0.75 = fast, 0 = nein. */
  function wordScore(exp, got) {
    if (!exp || !got) return 0;
    if (exp === got) return 1;
    const a = stem(exp), b = stem(got);
    if (a === b) return 1;
    const tol = tolerance(a);
    const d = lev(a, b, tol);
    if (d === 0) return 1;
    if (d <= tol) return d === 1 ? 0.85 : 0.7;
    // "Zusammengezogen": bismillah statt bismi + allah o. Ä.
    if (a.length >= 4 && b.length >= 4 && (b.indexOf(a) >= 0 || a.indexOf(b) >= 0)) return 0.7;
    return 0;
  }

  /* ---------------- 2. Zwei Wortfolgen ausrichten ----------------
     Needleman-Wunsch: findet die beste Zuordnung inklusive Lücken,
     damit ein vergessenes Wort in der Mitte nicht alles danach
     "verschiebt". Rückgabe: pro Sollwort ein Status.            */
  function align(expWords, gotWords) {
    const n = expWords.length, m = gotWords.length;
    const GAP = -0.6;
    const M = [];
    for (let i = 0; i <= n; i++) { M.push(new Float64Array(m + 1)); }
    const P = [];
    for (let i = 0; i <= n; i++) { P.push(new Int8Array(m + 1)); }
    for (let i = 1; i <= n; i++) { M[i][0] = M[i - 1][0] + GAP; P[i][0] = 1; }
    for (let j = 1; j <= m; j++) { M[0][j] = M[0][j - 1] + GAP; P[0][j] = 2; }
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        const s = wordScore(expWords[i - 1], gotWords[j - 1]);
        const diag = M[i - 1][j - 1] + (s > 0 ? s : -0.4);
        const up = M[i - 1][j] + GAP;
        const left = M[i][j - 1] + GAP;
        let best = diag, p = 0;
        if (up > best) { best = up; p = 1; }
        if (left > best) { best = left; p = 2; }
        M[i][j] = best; P[i][j] = p;
      }
    }
    const marks = new Array(n);
    let i = n, j = m, extra = 0;
    while (i > 0 || j > 0) {
      const p = (i === 0) ? 2 : (j === 0) ? 1 : P[i][j];
      if (p === 0) {
        const s = wordScore(expWords[i - 1], gotWords[j - 1]);
        marks[i - 1] = { w: expWords[i - 1], got: gotWords[j - 1], score: s,
                         st: s >= 0.99 ? 'ok' : s > 0 ? 'fast' : 'falsch' };
        i--; j--;
      } else if (p === 1) {
        marks[i - 1] = { w: expWords[i - 1], got: '', score: 0, st: 'fehlt' };
        i--;
      } else { extra++; j--; }
    }
    return { marks: marks, extra: extra };
  }

  /* ---------------- 3. Bewertung ---------------- */
  /* Rückgabe:
       pct    0-100  (gewichtete Trefferquote)
       level  'gut' | 'fast' | 'nochmal'
       marks  pro Sollwort {w, got, st}   st: ok|fast|falsch|fehlt
       heard  was der Browser verstanden hat (normalisiert)         */
  function grade(expected, heard, opts) {
    opts = opts || {};
    const e = words(expected);
    const g = words(heard);
    if (!e.length) return { pct: 0, level: 'nochmal', marks: [], heard: '', empty: true };
    if (!g.length) {
      return { pct: 0, level: 'nochmal', heard: '', empty: true,
               marks: e.map(function (w) { return { w: w, got: '', score: 0, st: 'fehlt' }; }) };
    }
    const a = align(e, g);
    let sum = 0;
    a.marks.forEach(function (mk) { sum += mk.score; });
    const raw = Math.round(100 * sum / e.length);
    let pct = raw;
    // Ein bisschen weiterzusprechen ist kein Fehler (beim Ketten-Üben sogar
    // erwünscht). Nur wer wahllos drauflosredet, in der Hoffnung, dass schon
    // die richtigen Wörter dabei sind, bekommt einen Abzug.
    const allowedExtra = Math.max(6, e.length * 2);
    if (a.extra > allowedExtra) pct = Math.max(0, pct - Math.min(40, (a.extra - allowedExtra) * 5));
    const passAt = opts.passAt || 85, nearAt = opts.nearAt || 60;
    const level = pct >= passAt ? 'gut' : pct >= nearAt ? 'fast' : 'nochmal';
    return { pct: pct, raw: raw, level: level, marks: a.marks, heard: normalize(heard),
             extra: a.extra, over: a.extra > Math.max(2, Math.ceil(e.length * 0.5)) };
  }

  /* ==============================================================
     3b) NAMEN PRÜFEN (lateinisch) — für die Buchstaben-Lektion
     Dort sagt das Kind nicht Arabisch, sondern den NAMEN des
     Buchstabens auf Türkisch: „Elif", „Be", „Te" … Deshalb hört der
     Browser hier auf Türkisch zu und wir vergleichen lateinische
     Wörter statt arabischer.

     Wichtig: Bei so kurzen Wörtern muss der Vergleich STRENG sein.
     „Be" und „Te" unterscheiden sich um genau einen Buchstaben — mit
     der üblichen Fehlertoleranz würde jeder Buchstabe zu jedem passen
     und der Bonus wäre geschenkt. Deshalb: exakter Treffer, plus eine
     Liste erlaubter Schreibweisen je Buchstabe (siehe app/echo.js).
     ============================================================== */
  function normalizeLatin(text) {
    return String(text || '')
      .replace(/\u0130/g, 'i').replace(/I/g, '\u0131')   // İ -> i, I -> ı (türkisch!)
      .toLowerCase()
      .replace(/[\u00E2\u00E4\u00E0]/g, 'a').replace(/[\u00EE\u00EF]/g, 'i')
      .replace(/[\u00FB]/g, 'u').replace(/[\u00F4]/g, 'o').replace(/[\u00EA\u00E9\u00E8]/g, 'e')
      .replace(/[^a-z\u00E7\u011F\u0131\u00F6\u015F\u00FC\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* Hat das Kind den Namen gesagt? accepted = erlaubte Schreibweisen.
     Rückgabe wie grade(): { pct, level, heard, hit }. */
  function gradeName(expected, heard, accepted, deny) {
    const want = [].concat(accepted && accepted.length ? accepted : [expected])
      .map(normalizeLatin).filter(Boolean);
    const got = normalizeLatin(heard);
    if (!got) return { pct: 0, level: 'nochmal', heard: '', hit: '', empty: true };
    const toks = got.split(' ').filter(Boolean);
    // 1) ganzer Satz oder ein einzelnes Wort trifft genau
    for (let i = 0; i < want.length; i++) {
      if (got === want[i] || toks.indexOf(want[i]) >= 0) return { pct: 100, level: 'gut', heard: got, hit: want[i] };
      if (want[i].indexOf(' ') > 0 && got.indexOf(want[i]) >= 0) return { pct: 100, level: 'gut', heard: got, hit: want[i] };
    }
    // 2) Bei längeren Namen (ab 4 Zeichen) ist EIN Buchstabe Abweichung erlaubt —
    //    aber nur, wenn das Gehörte nicht der Name eines ANDEREN Buchstabens ist.
    //    Sonst würde „Ayın" als „Ğayın" durchgehen (ein Buchstabe Unterschied).
    const verboten = (deny || []).map(normalizeLatin);
    for (let i = 0; i < want.length; i++) {
      if (want[i].length < 4) continue;
      for (let k = 0; k < toks.length; k++) {
        if (verboten.indexOf(toks[k]) >= 0) continue;
        if (lev(want[i], toks[k], 1) <= 1) return { pct: 80, level: 'gut', heard: got, hit: want[i] };
      }
    }
    return { pct: 0, level: 'nochmal', heard: got, hit: '' };
  }

  /* ---------------- 4. Mikrofon ---------------- */
  function SR() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }
  function micAllowed() {
    try { return localStorage.getItem(MIC_OFF_KEY) !== '1'; } catch (e) { return true; }
  }
  function setMicAllowed(on) {
    try { on ? localStorage.removeItem(MIC_OFF_KEY) : localStorage.setItem(MIC_OFF_KEY, '1'); } catch (e) {}
  }
  function canRecord() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  }
  /* 'speech'  = der Browser versteht Arabisch und prüft selbst
     'record'  = nur aufnehmen + selbst anhören und ehrlich bestätigen
     'none'    = gar kein Mikrofon -> die App nimmt das Puzzle       */
  function mode() {
    if (!micAllowed()) return 'none';
    if (SR() && navigator.onLine !== false) return 'speech';
    if (canRecord()) return 'record';
    return 'none';
  }
  function modeLabel() {
    const m = mode();
    return m === 'speech' ? 'Der Browser hört zu und prüft mit.'
      : m === 'record' ? 'Dein Browser kann Arabisch nicht prüfen — du nimmst dich auf und hörst selbst nach.'
      : 'Ohne Mikrofon: Du setzt den Vers aus Wort-Bausteinen zusammen.';
  }

  /* Startet das Zuhören. Rückgabe: { stop(), abort() }.
     onDone(text, info)  — Ergebnis (kann leer sein)
     onPartial(text)     — Zwischenstand, für "Ich höre dich…"
     onError(code)       — 'not-allowed' | 'no-speech' | 'network' | … */
  function listen(handlers) {
    handlers = handlers || {};
    const Ctor = SR();
    if (!Ctor || !micAllowed()) {
      setTimeout(function () { handlers.onError && handlers.onError('unsupported'); }, 0);
      return { stop: function () {}, abort: function () {} };
    }
    let rec = null, finished = false, best = '', partial = '';
    try { rec = new Ctor(); } catch (e) {
      setTimeout(function () { handlers.onError && handlers.onError('unsupported'); }, 0);
      return { stop: function () {}, abort: function () {} };
    }
    rec.lang = handlers.lang || 'ar-SA';
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 5;

    // Der Browser hört manchmal ewig weiter — nach maxMs machen wir Schluss.
    const maxMs = handlers.maxMs || 15000;
    const timer = setTimeout(function () { try { rec.stop(); } catch (e) {} }, maxMs);

    rec.onresult = function (ev) {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) {
          // Aus allen Alternativen die nehmen, die am besten passt.
          let pick = r[0].transcript, pickScore = -1;
          if (handlers.expected) {
            for (let k = 0; k < r.length; k++) {
              const s = grade(handlers.expected, r[k].transcript).pct;
              if (s > pickScore) { pickScore = s; pick = r[k].transcript; }
            }
          }
          best += (best ? ' ' : '') + pick;
        } else interim += r[0].transcript + ' ';
      }
      partial = interim.trim();
      if (handlers.onPartial) handlers.onPartial((best + ' ' + partial).trim());
    };
    rec.onerror = function (ev) {
      if (finished) return;
      const code = (ev && ev.error) || 'error';
      if (code === 'no-speech' || code === 'aborted') return; // onend übernimmt
      finished = true;
      clearTimeout(timer);
      if (handlers.onError) handlers.onError(code);
    };
    rec.onend = function () {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      const text = (best || partial || '').trim();
      if (handlers.onDone) handlers.onDone(text, { empty: !text });
    };
    try { rec.start(); } catch (e) {
      finished = true; clearTimeout(timer);
      setTimeout(function () { handlers.onError && handlers.onError('start-failed'); }, 0);
    }
    return {
      stop: function () { try { rec.stop(); } catch (e) {} },
      abort: function () { finished = true; clearTimeout(timer); try { rec.abort(); } catch (e) {} },
    };
  }

  /* Reines Aufnehmen zum Selbst-Anhören (Fallback ohne Spracherkennung). */
  function record(handlers) {
    handlers = handlers || {};
    if (!canRecord() || !micAllowed()) {
      setTimeout(function () { handlers.onError && handlers.onError('unsupported'); }, 0);
      return { stop: function () {} };
    }
    let mr = null, stream = null, chunks = [], stopped = false;
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
      if (stopped) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
      stream = s;
      try { mr = new MediaRecorder(s); } catch (e) { mr = new MediaRecorder(s, { mimeType: 'audio/webm' }); }
      mr.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      mr.onstop = function () {
        try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
        const blob = new Blob(chunks, { type: (mr && mr.mimeType) || 'audio/webm' });
        if (handlers.onDone) handlers.onDone(blob, blob.size ? URL.createObjectURL(blob) : '');
      };
      mr.start();
      if (handlers.onStart) handlers.onStart();
    }).catch(function (e) {
      if (handlers.onError) handlers.onError((e && e.name === 'NotAllowedError') ? 'not-allowed' : 'error');
    });
    return { stop: function () { stopped = true; try { mr && mr.state !== 'inactive' && mr.stop(); } catch (e) {} } };
  }

  function errorText(code) {
    switch (code) {
      case 'not-allowed':
      case 'service-not-allowed':
        return 'Das Mikrofon ist nicht freigegeben. Tippe in der Adresszeile auf das Schloss 🔒 und erlaube das Mikrofon.';
      case 'network':
        return 'Für das Zuhören braucht der Browser Internet. Nimm solange das Wort-Puzzle!';
      case 'unsupported':
      case 'start-failed':
        return 'Dieser Browser kann noch nicht mithören. Nimm das Wort-Puzzle — das zählt genauso!';
      case 'no-speech':
        return 'Ich habe nichts gehört. Sprich bitte etwas lauter und näher am Gerät.';
      default:
        return 'Das hat gerade nicht geklappt. Probier es nochmal oder nimm das Wort-Puzzle.';
    }
  }

  return {
    normalize: normalize, words: words, grade: grade, wordScore: wordScore, align: align,
    normalizeLatin: normalizeLatin, gradeName: gradeName,
    listen: listen, record: record, mode: mode, modeLabel: modeLabel,
    micAllowed: micAllowed, setMicAllowed: setMicAllowed, canRecord: canRecord,
    hasSpeech: function () { return !!SR(); }, errorText: errorText,
  };
})();
