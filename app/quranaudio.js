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
  let arVoice = null;
  function findVoice() {
    try {
      const vs = window.speechSynthesis ? speechSynthesis.getVoices() : [];
      arVoice = vs.find(v => /^ar/i.test(v.lang)) || vs.find(v => /arab/i.test(v.name)) || null;
    } catch (e) { arVoice = null; }
  }
  if (window.speechSynthesis) { findVoice(); speechSynthesis.addEventListener('voiceschanged', findVoice); }

  /* (06.08.2026, Nutzerkritik "Stimme verzerrt — lass die Stimme original"):
     Zurück zur puren Aufnahme — Originaltempo (playbackRate 1.0), volle
     Lautstärke, KEIN Verstärker und keine Umwege über WebAudio. Die
     wahrgenommene Präsenz kommt jetzt allein daher, dass der Feedback-Ton
     leise ist und die Stimme fast sofort (60 ms) startet. */
  function playFile(name, opts) {
    opts = opts || {};
    let a = cache[name];
    if (!a) { a = new Audio(CDN + name + '.mp3'); cache[name] = a; }
    try {
      if ('preservesPitch' in a) a.preservesPitch = true;
      a.playbackRate = opts.slow ? 0.7 : 1.0; // 🐢 langsam ohne Tonhöhen-Änderung
      a.volume = 1; a.currentTime = 0;
      a.play().catch(function(){});
    } catch (e) {}
  }
  function tts(text, opts) {
    opts = opts || {};
    if (!window.speechSynthesis) return;
    if (!arVoice) findVoice();
    if (!arVoice) return; // keine arabische Stimme installiert -> lieber still
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = arVoice; u.lang = arVoice.lang || 'ar-SA';
      u.rate = opts.slow ? 0.6 : 0.85; u.pitch = 1; u.volume = 1;
      speechSynthesis.speak(u);
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
    // 1) Lehrer-Aufnahme (Aussprache-Studio) — die beste Quelle, wenn vorhanden
    if (window.QuranVoice && window.QuranVoice.play(ar, opts)) return;
    const hasHarakat = /[\u064B-\u0652]/.test(ar);
    const bare = ar.replace(/[\u064B-\u0652\u0670\u0640]/g, '').replace(/\s+/g, '');
    if (!hasHarakat) {
      // 2) echte Buchstaben-Tonaufnahme (Soundboard)
      if (FILES[bare]) { playFile(FILES[bare], opts); return; }          // einzelner Buchstabe / لا
      const uniq = Array.from(new Set(bare.split('')));
      if (uniq.length === 1 && FILES[uniq[0]]) { playFile(FILES[uniq[0]], opts); return; } // Formen-Reihe
    }
    tts(ar, opts); // 3) Silben & Wörter ohne Aufnahme: arabische Systemstimme
  }
  function speakForCard(topicId, card, delayMs) {
    if (!/^quran-/.test(String(topicId || ''))) return;
    if (card && card.options) return; // Suren-Wissensfragen (deutsch) nicht vorlesen
    if (delayMs) { setTimeout(function () { speakText(card && card.q); }, delayMs); return; }
    speakText(card && card.q);
  }
  return { speakForCard: speakForCard, speakText: speakText };
})();
