/* ==============================================================
   KORAN-AUSSPRACHE (Elif & Ba) — wie im Vorbild-Video: nach jeder
   Antwort wird der Buchstabe korrekt vorgesprochen.
   Quelle der Aufnahmen: öffentliches Arabisch-Alphabet-Soundboard
   (github.com/adnan/Arabic-Alphabet, 30 MP3s: alif…yaa inkl. hamza
   und lamelif), ausgeliefert über den jsDelivr-CDN. Für vokalisierte
   Silben/Wörter (بَ، رَزَقَ) gibt es keine Aufnahmen-Datenbank — dort
   spricht die arabische Systemstimme (speechSynthesis), langsam.
   ============================================================== */
window.QuranAudio = (function () {
  const CDN = 'https://cdn.jsdelivr.net/gh/adnan/Arabic-Alphabet@master/sounds/';
  const FILES = {
    'ا':'1_alif','أ':'1_alif','إ':'1_alif','آ':'1_alif','ء':'28_hamzah',
    'ب':'2_baa','ت':'3_taa','ة':'3_taa','ث':'4_thaa','ج':'5_jeem','ح':'6_haa','خ':'7_khaa',
    'د':'8_daal','ذ':'9_zaal','ر':'10_raa','ز':'11_zaa','س':'12_seen','ش':'13_sheen',
    'ص':'14_saad','ض':'15_daad','ط':'16_taah','ظ':'17_zhaa','ع':'18_ain','غ':'19_ghain',
    'ف':'20_faa','ق':'21_qaaf','ك':'22_kaaf','ل':'23_laam','م':'24_meem','ن':'25_noon',
    'ه':'26_haah','و':'27_waw','ي':'30_yaa','ى':'30_yaa','لا':'29_laaa','ئ':'28_hamzah','ؤ':'28_hamzah'
  };
  const cache = {};
  /* ==============================================================
     STIMMEN (Neufassung 12.08.2026, „oft funktioniert die Sprachausgabe
     nicht"). Drei echte Ursachen, drei Gegenmittel:

     1. Ohne arabische Stimme blieb die App STILL („lieber still").
        Jetzt gibt es eine ERSATZSTIMME: Die Lesung der Karte („ab · ib
        · ub", „be", „ra-ha-be") wird von einer türkischen (sonst
        deutschen) Stimme gesprochen — Türkisch ist lautgetreu, das
        klingt für Elifba-Silben richtig. Eine tr/de-Stimme hat
        praktisch jedes Gerät.
     2. Chrome verschluckt ein speak() direkt nach cancel() — deshalb
        jetzt immer ~60 ms Abstand plus ein Wachhund, der einmal
        nachschiebt, wenn nichts zu hören ist.
     3. Chrome PAUSIERT die Sprachausgabe beim Tab-Wechsel und bleibt
        pausiert — deshalb resume() beim Zurückkommen und vor jedem
        Sprechen.
     ============================================================== */
  let arVoice = null;
  let latVoice = null;
  function findVoice() {
    try {
      const vs = window.speechSynthesis ? speechSynthesis.getVoices() : [];
      arVoice = vs.find(v => /^ar[-_]sa/i.test(v.lang))
        || vs.find(v => /^ar/i.test(v.lang))
        || vs.find(v => /arab/i.test(v.name)) || null;
      latVoice = vs.find(v => /^tr/i.test(v.lang))
        || vs.find(v => /^de/i.test(v.lang))
        || vs.find(v => /^en/i.test(v.lang)) || null;
    } catch (e) { arVoice = null; latVoice = null; }
  }
  if (window.speechSynthesis) {
    findVoice();
    speechSynthesis.addEventListener('voiceschanged', findVoice);
    // Chrome bleibt nach Tab-Wechsel dauerhaft „paused" — hier wieder anwerfen.
    document.addEventListener('visibilitychange', function () {
      try { if (!document.hidden && speechSynthesis.paused) speechSynthesis.resume(); } catch (e) {}
    });
  }

  /* Lesung („ab · ib · ub") in etwas verwandeln, das eine Stimme gut spricht. */
  function cleanReading(r) {
    const t = String(r || '')
      .replace(/\(.*?\)/g, ' ')
      .replace(/[·|]/g, ', ')
      .replace(/-/g, '')
      .replace(/[^A-Za-zÀ-žçğıöşüÇĞİÖŞÜâîûÂÎÛ’',\s]/g, ' ')
      .replace(/\s+/g, ' ').replace(/\s+,/g, ',').trim();
    return t.length >= 1 && /[A-Za-zçğıöşüÇĞİÖŞÜ]/.test(t) ? t : '';
  }

  /* Sprechen mit Chrome-Reparaturen: cancel -> kurze Pause -> speak,
     resume() falls pausiert, und EIN Nachschub, wenn nichts anläuft. */
  function speakUtter(u) {
    try {
      let started = false;
      const prevStart = u.onstart;
      u.onstart = function (ev) { started = true; if (prevStart) prevStart(ev); };
      speechSynthesis.cancel();
      setTimeout(function () {
        try {
          speechSynthesis.speak(u);
          if (speechSynthesis.paused) speechSynthesis.resume();
          setTimeout(function () {
            try {
              // Wachhund: NUR nachschieben, wenn die Ausgabe nie angelaufen ist
              // (Chrome-Verschlucker) — eine kurze Silbe, die längst fertig
              // ist, darf nicht doppelt kommen.
              if (!started && !speechSynthesis.speaking && !speechSynthesis.pending) {
                speechSynthesis.speak(u);
                if (speechSynthesis.paused) speechSynthesis.resume();
              }
            } catch (e) {}
          }, 700);
        } catch (e) {}
      }, 60);
    } catch (e) {}
  }
  function latinTts(reading, opts) {
    if (!latVoice) return false;
    const u = new SpeechSynthesisUtterance(reading);
    u.voice = latVoice; u.lang = latVoice.lang || 'tr-TR';
    u.rate = opts && opts.slow ? 0.62 : 0.85; u.pitch = 1; u.volume = 1;
    speakUtter(u);
    return true;
  }

  /* (06.08.2026, Nutzerkritik "Stimme verzerrt — lass die Stimme original"):
     Zurück zur puren Aufnahme — Originaltempo (playbackRate 1.0), volle
     Lautstärke, KEIN Verstärker und keine Umwege über WebAudio. Die
     wahrgenommene Präsenz kommt jetzt allein daher, dass der Feedback-Ton
     leise ist und die Stimme fast sofort (60 ms) startet. */
  /* (09.08.2026) Fehler werden nicht mehr verschluckt: Lädt die Datei nicht
     (CDN gesperrt, Repo weg, kein Netz), fällt die App hörbar auf die
     Systemstimme zurück statt still zu bleiben. Zusätzlich merkt sich die App,
     welche Buchstaben nicht geladen werden konnten — die Lehrkraft sieht das
     im Klassenzimmer unter „Ton prüfen". */
  /* ---------- Buchstaben-Töne AUS DER APP (09.08.2026) ----------
     Alle 30 Aufnahmen liegen gebündelt in assets/letters.mp3; wir springen
     an die passende Stelle und stoppen nach der Länge des Buchstabens.
     Dadurch braucht die App für die Buchstaben KEINEN fremden Server mehr:
     sie klingt im Schul-WLAN, im Flugmodus und auf jedem Gerät gleich. */
  let sprite = null, spriteReady = null, spriteTimer = null, spriteBroken = false;
  function spriteEl() {
    if (sprite) return sprite;
    const S = window.LETTER_SPRITE;
    if (!S) return null;
    sprite = new Audio(S.file);
    sprite.preload = 'auto';
    if ('preservesPitch' in sprite) sprite.preservesPitch = true;
    spriteReady = new Promise(function (res) {
      const done = function () { res(true); };
      sprite.addEventListener('canplaythrough', done, { once: true });
      sprite.addEventListener('loadeddata', done, { once: true });
      sprite.addEventListener('error', function () { spriteBroken = true; res(false); }, { once: true });
      setTimeout(function () { res(sprite.readyState >= 2); }, 6000);
    });
    try { sprite.load(); } catch (e) {}
    return sprite;
  }
  // Beim Start still vorladen, damit der erste Buchstabe sofort kommt
  setTimeout(function () { try { spriteEl(); } catch (e) {} }, 1200);

  function playSprite(name, opts, fallbackText) {
    opts = opts || {};
    const S = window.LETTER_SPRITE;
    if (!S || !S.at || !S.at[name] || spriteBroken) return false;
    const el = spriteEl();
    if (!el) return false;
    const at = S.at[name];
    const rate = opts.slow ? 0.7 : 1;
    const target = at[0] / 1000;
    const startAt = function (tries) {
      try {
        if (spriteTimer) { clearTimeout(spriteTimer); spriteTimer = null; }
        el.playbackRate = rate;
        el.volume = 1;
        el.currentTime = target;
        // Konnte nicht gesprungen werden (Datei noch nicht weit genug geladen),
        // einmal auf "canplaythrough" warten und erneut versuchen.
        if (Math.abs(el.currentTime - target) > 0.15 && tries > 0) {
          el.addEventListener('canplaythrough', function () { startAt(tries - 1); }, { once: true });
          try { el.load(); } catch (e) {}
          return;
        }
        const p = el.play();
        spriteTimer = setTimeout(function () { try { el.pause(); } catch (e) {} }, (at[1] + 90) / rate);
        if (p && p.catch) p.catch(function () { if (fallbackText) tts(fallbackText, opts); });
      } catch (e) { if (fallbackText) tts(fallbackText, opts); }
    };
    spriteReady.then(function (ok) {
      if (!ok) { if (fallbackText) tts(fallbackText, opts); return; }
      startAt(1);
    });
    return true;
  }

  const failed = {};
  function playFile(name, opts, fallbackText) {
    opts = opts || {};
    if (failed[name]) { if (fallbackText) tts(fallbackText, opts); return; }
    let a = cache[name];
    if (!a) {
      a = new Audio(CDN + name + '.mp3');
      a.addEventListener('error', function () {
        failed[name] = true;
        delete cache[name];
        try { window.dispatchEvent(new CustomEvent('quran-audio-failed', { detail: { name: name } })); } catch (e) {}
        if (fallbackText) tts(fallbackText, opts);
      });
      cache[name] = a;
    }
    try {
      if ('preservesPitch' in a) a.preservesPitch = true;
      a.playbackRate = opts.slow ? 0.7 : 1.0; // 🐢 langsam ohne Tonhöhen-Änderung
      a.volume = 1; a.currentTime = 0;
      a.play().catch(function () {
        // Autoplay-Sperre oder Ladefehler → wenigstens die Systemstimme
        if (fallbackText) tts(fallbackText, opts);
      });
    } catch (e) { if (fallbackText) tts(fallbackText, opts); }
  }
  function tts(text, opts) {
    opts = opts || {};
    if (!window.speechSynthesis) return;
    if (!arVoice || !latVoice) findVoice();
    const reading = cleanReading(opts.reading);
    try {
      /* CEZIM & Co. (12.08.2026): Geschlossene Silben mit Sukun (اَبْ) und
         die Dreier-Drills (اَبْ اِبْ اُبْ) kann KEINE arabische Computer-
         stimme sauber sprechen — sie buchstabiert oder nuschelt. Wenn die
         Karte eine Lesung hat („ab · ib · ub"), spricht sie deshalb die
         lautgetreue Ersatzstimme (türkisch/deutsch): klar und richtig. */
      const hasSukun = /\u0652/.test(text);
      if (hasSukun && reading && latVoice) { latinTts(reading, opts); return; }
      if (arVoice) {
        const u = new SpeechSynthesisUtterance(text);
        u.voice = arVoice; u.lang = arVoice.lang || 'ar-SA';
        u.rate = opts.slow ? 0.6 : 0.85; u.pitch = 1; u.volume = 1;
        if (reading) u.onerror = function () { latinTts(reading, opts); };
        speakUtter(u);
        return;
      }
      // Keine arabische Stimme: statt Stille die Lesung mit der Ersatzstimme.
      if (reading && latinTts(reading, opts)) return;
      try { window.dispatchEvent(new CustomEvent('quran-tts-missing')); } catch (e) {}
    } catch (e) {}
  }
  let last = { t: '', at: 0 };
  // Spricht arabischen Inhalt einer Frage: einzelne Buchstaben (auch als
  // Formen-Reihe بـ ـبـ ـب) mit echter Aufnahme, Vokalisiertes per TTS.
  function speakText(text, force, opts) {
    opts = opts || {};
    const str = String(text || '');
    const now = Date.now();
    if (!force && str === last.t && now - last.at < 2500) return; // Doppel-Trigger (Aufdecken + Auflösen) schlucken
    last = { t: str, at: now };
    const ar = str.replace(/[^\u0600-\u06FF\s]/g, ' ').trim();
    if (!ar) return;
    // 1) Lehrer-Aufnahme (Aussprache-Studio) — die beste Quelle, wenn vorhanden.
    //    opts.skipOwn übergeht sie absichtlich (Werkstatt: „Standardstimme anhören").
    if (!opts.skipOwn && window.QuranVoice && window.QuranVoice.play(ar, opts)) return;
    const hasHarakat = /[\u064B-\u0652]/.test(ar);
    const bare = ar.replace(/[\u064B-\u0652\u0670\u0640]/g, '').replace(/\s+/g, '');
    if (!hasHarakat) {
      // 2) echte Buchstaben-Tonaufnahme (Soundboard)
      const uniq0 = Array.from(new Set(bare.split('')));
      const name = FILES[bare] || (uniq0.length === 1 ? FILES[uniq0[0]] : null);
      if (name) {
        // 2) mitgelieferte Aufnahme aus der App (kein fremder Server nötig)
        if (playSprite(name, opts, ar)) return;
        // 3) Notnagel: dieselbe Aufnahme aus dem Internet
        playFile(name, opts, ar); return;
      }
    }
    tts(ar, opts); // 3) Silben & Wörter ohne Aufnahme: arabische Systemstimme
  }
  function speakForCard(topicId, card, delayMs) {
    if (!/^quran-/.test(String(topicId || ''))) return;
    if (card && card.options) return; // Suren-Wissensfragen (deutsch) nicht vorlesen
    const opts = { reading: card && card.a };
    if (delayMs) { setTimeout(function () { speakText(card && card.q, false, opts); }, delayMs); return; }
    speakText(card && card.q, false, opts);
  }
  /* Welche Quelle würde für diesen Text benutzt? (für „Ton prüfen") */
  function sourceFor(text) {
    const ar = String(text || '').replace(/[^\u0600-\u06FF\s]/g, ' ').trim();
    if (!ar) return { src: 'keine', label: 'kein arabischer Text' };
    if (window.QuranVoice && window.QuranVoice.has(ar)) return { src: 'eigen', label: 'eigene Aufnahme' };
    const hasHarakat = /[\u064B-\u0652]/.test(ar);
    const bare = ar.replace(/[\u064B-\u0652\u0670\u0640]/g, '').replace(/\s+/g, '');
    if (!hasHarakat) {
      const uniq = Array.from(new Set(bare.split('')));
      const name = FILES[bare] || (uniq.length === 1 ? FILES[uniq[0]] : null);
      if (name) {
        const S = window.LETTER_SPRITE;
        if (S && S.at && S.at[name] && !spriteBroken) return { src: 'app', label: 'in der App enthalten', file: name };
        return failed[name] ? { src: 'fehler', label: 'Tondatei nicht ladbar', file: name }
                            : { src: 'internet', label: 'Tondatei aus dem Internet', file: name };
      }
    }
    if (/\u0652/.test(ar)) return { src: 'lesung', label: 'Ersatzstimme liest die Umschrift (Cezim)' };
    return arVoice
      ? { src: 'stimme', label: 'arabische Systemstimme' }
      : latVoice
        ? { src: 'lesung', label: 'Ersatzstimme liest die Umschrift' }
        : { src: 'fehler', label: 'keine Stimme installiert' };
  }
  function letterFiles() { return Object.assign({}, FILES); }
  function cdnUrl(name) { return CDN + name + '.mp3'; }

  function voiceInfo() {
    if (!arVoice || !latVoice) findVoice();
    return {
      ar: arVoice ? (arVoice.name + ' (' + arVoice.lang + ')') : null,
      latin: latVoice ? (latVoice.name + ' (' + latVoice.lang + ')') : null,
    };
  }
  return { speakForCard: speakForCard, speakText: speakText,
           sourceFor: sourceFor, letterFiles: letterFiles, cdnUrl: cdnUrl,
           voiceInfo: voiceInfo, _cleanReading: cleanReading,
           failedFiles: function () { return Object.keys(failed); } };
})();
