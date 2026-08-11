/* ==============================================================
   QuranIntro — Regel-Intro-Screens im Stil des Vorbild-Videos
   ("Kurze Vokale": dunkelblauer Vollbild-Verlauf, ℹ️-Infobox mit der
   Regel, 3 weiße Beispielkarten mit Lautsprecher, LERNEN BEGINNEN).

   Erscheint EINMAL beim ersten Start jeder Koran-Lektion (localStorage-
   Flag) und ist danach über das ℹ️ im Quiz erneut aufrufbar. Die
   Regel-Texte folgen dem eingescannten Elifba-Buch (kindgerecht gekürzt).
   ============================================================== */
(function () {
  const { useState } = React;

  const INTROS = {
    'quran-harfler': {
      title: 'Die Buchstaben', sub: 'Harfler',
      teach: ['Das arabische Alphabet hat 29 Buchstaben – und man liest von RECHTS nach LINKS!', 'Jeder Buchstabe hat einen Namen, so wie im Kurs und in der Moschee: Elif, Be, Te, Se, Cim … Hör dir jeden Buchstaben an und sprich ihn laut nach.'],
    },
    'quran-formen': {
      title: 'Die Formen der Buchstaben', sub: 'Başta – Ortada – Sonda',
      teach: ['Im Arabischen ändert jeder Buchstabe seine Form je nach Position im Wort: am Anfang, in der Mitte oder am Ende.', 'Sechs Einzelgänger verbinden sich nie nach links: ا د ذ ر ز و', 'Beobachte den Buchstaben ب in jeder Position:'],
      cards: [
        { hl: 'بَيْت', target: 'ب', name: 'ANFANG', tr: 'beyt' },
        { hl: 'سَبِيل', target: 'ب', name: 'MITTE', tr: 'sebîl' },
        { hl: 'قَلْب', target: 'ب', name: 'ENDE', tr: 'kalb' },
      ],
    },
    'quran-mahrec': {
      title: 'Die Aussprache-Schule', sub: 'Mahreç',
      teach: ['Jeder Buchstabe entsteht an seinem eigenen Platz im Mund oder in der Kehle – das ist sein Mahreç.', 'Es gibt HELLE (ince) Buchstaben, die fein klingen, und DUNKLE (kalın), die voll und kräftig klingen: خ ص ض ط ظ غ ق – und ر ist mal so, mal so.'],
    },
    'quran-ustun': {
      title: 'Üstün – der a/e-Strich', sub: 'Üstün (Fatha)',
      teach: ['Die kleinen Zeichen an den Buchstaben heißen Harekeler – sie sagen dir, welcher Vokal gesprochen wird.', 'ÜSTÜN ist ein kleiner Strich ÜBER dem Buchstaben: helle Buchstaben liest man mit „e“ (بَ = be), dunkle mit „a“ (صَ = sa).'],
      cards: [
        { ar: 'بَ', name: 'Üstün', tr: 'be' },
        { ar: 'بِ', name: 'Esre', tr: 'bi' },
        { ar: 'بُ', name: 'Ötre', tr: 'bü' },
      ],
    },
    'quran-esre': {
      title: 'Esre – der i-Strich', sub: 'Esre (Kasra)',
      teach: ['ESRE ist ein kleiner Strich UNTER dem Buchstaben.', 'Er macht bei hellen Buchstaben ein „i“ (بِ = bi) und bei dunklen ein dumpfes „ı“ (صِ = sı). Merkhilfe: Der Strich unten zieht die Stimme nach unten zum „i“!'],
    },
    'quran-otre': {
      title: 'Ötre – die u-Schleife', sub: 'Ötre (Damma)',
      teach: ['ÖTRE sieht aus wie ein kleines و über dem Buchstaben.', 'Es macht bei hellen Buchstaben ein „ü“ (بُ = bü) und bei dunklen ein „u“ (صُ = su). Jetzt kennst du alle drei Harekeler – damit kannst du schon richtige Wörter lesen!'],
    },
    'quran-cezim': {
      title: 'Cezim – der Stopper', sub: 'Cezim (Sükun)',
      teach: ['CEZIM ist ein kleiner Kreis über dem Buchstaben: بْ', 'Der Buchstabe bekommt keinen eigenen Vokal, sondern wird mit dem Buchstaben davor ZUSAMMEN gelesen: اَبْ = „eb“, قُلْ = „kul“. So entstehen geschlossene Silben!'],
    },
    'quran-sedde': {
      title: 'Şedde – der Verdoppler', sub: 'Şedde',
      teach: ['ŞEDDE sieht aus wie ein kleines „w“ über dem Buchstaben: بّ', 'Der Buchstabe wird ZWEIMAL gelesen – erst als Stopper, dann mit seiner Hareke: جَلَّ liest man wie جَلْ + لَ → „cel-le“.'],
    },
    'quran-tenvin': {
      title: 'Tenvin – die Doppel-Zeichen', sub: 'Tenvin',
      teach: ['TENVIN heißt: Die Hareke steht doppelt da – und am Ende liest man ein „n“ dazu!', 'Zwei Üstün بً = „ben/ban“ · zwei Esre بٍ = „bin“ · zwei Ötre بٌ = „bün/bun“. Tenvin steht immer am Wortende.'],
    },
    'quran-yuvarlakte': {
      title: 'Das runde Te', sub: 'Yuvarlak Te (ة)',
      teach: ['Am Wortende gibt es ein besonderes Te: das runde Te ة – es sieht aus wie He mit zwei Punkten.', 'Liest du weiter, klingt es wie „t“ (جَنَّةٌ = cennetün). Hältst du an, klingt es wie ein sanftes „h“ (cenneh).'],
    },
    'quran-ceker': {
      title: 'Das Dehnungszeichen', sub: 'Uzatma / Çeker',
      teach: ['Der kleine senkrechte Strich über einem Buchstaben ist ein ÇEKER – er dehnt den Vokal lang: هٰـ = „hâ“.', 'Ganz berühmte Wörter haben dieses Zeichen: هٰذَا (hâzâ), رَحْمٰنٌ (rahmânün), قُرْاٰنٌ (kur’ânün).'],
    },
    'quran-medelif': {
      title: 'Dehnung mit Elif', sub: 'Uzatan Elif (ا)',
      teach: ['Ein Elif OHNE Hareke nach einem Üstün-Buchstaben macht den Vokal laaang: بَا = „bâ“.', 'So liest man قَالَ als „kâle“ und كِتَابٌ als „kitâbün“. Zieh den Ton etwa „ein Elif lang“ – so sagt man im Kurs!'],
    },
    'quran-medye': {
      title: 'Dehnung mit Ye', sub: 'Uzatan Ye (ى)',
      teach: ['Ein Ye OHNE Hareke nach einem Esre-Buchstaben macht ein langes „î“: بِي = „bî“.', 'So liest man دِين als „dîn“ und رَحِيم als „rahîm“ – mit langem, schönem î.'],
    },
    'quran-medvav': {
      title: 'Dehnung mit Vav', sub: 'Uzatan Vav (و)',
      teach: ['Ein Vav OHNE Hareke nach einem Ötre-Buchstaben macht ein langes „û“: بُو = „bû“ – wie in نُور (nûr, Licht!).', 'Wichtig: Nach dem Vav am Wortende steht oft ein stummes Elif, das man NICHT liest: قَالُوا = „kâlû“.'],
    },
    'quran-maksura': {
      title: 'Besondere Dehnungen', sub: 'Uzatan Harfler',
      teach: ['Manchmal springen ى und و für das Elif ein und machen ein langes „â“!', 'Das Ye ohne Punkte am Wortende liest man „â“: كَفٰى = „kefâ“, مُوسٰى = „Mûsâ“. Auch in صَلٰوةٌ (salâtün, das Gebet!) klingt das و wie „â“.'],
    },
    'quran-hemze': {
      title: 'Hemze', sub: 'Hemze (ء)',
      teach: ['Das HEMZE ء ist ein kleiner Knacklaut – wie das kurze Stoppen in „be-achten“.', 'Es sitzt allein oder huckepack auf Elif (أ إ), Vav (ؤ) oder einem punktlosen Ye (ئ): جِئْتَ = „ci’-te“, يُؤْمِنُ = „yü’-mi-nü“.'],
    },
    'quran-lafza': {
      title: 'Das Wort „Allah“ lesen', sub: 'Lafzatullah',
      teach: ['Das schönste Wort zum Schluss: اَللّٰهُ', 'Die Regel aus dem Buch: Nach Üstün oder Ötre liest man das L DUNKEL und voll („Allah“), nach Esre HELL („billâhi“). Sprich es immer mit Liebe und Respekt aus!'],
    },
      };

  const SEEN_KEY = 'quran_intro_seen_v1';
  function seenMap() { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch (e) { return {}; } }
  function hasIntro(topicId) { return !!INTROS[topicId]; }
  function isSeen(topicId) { return !!seenMap()[topicId]; }
  function markSeen(topicId) {
    const m = seenMap(); m[topicId] = 1;
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(m)); } catch (e) {}
  }

  /* Beispielkarten: definierte cards, sonst die ersten 3 Karten der Lektion. */
  function introCards(topicId) {
    const def = INTROS[topicId] || {};
    if (def.cards) return def.cards;
    const t = (window.QURAN_TOPICS || []).find(x => x.id === topicId);
    if (!t) return [];
    return t.blocks[0].cards.slice(0, 3).map(c => ({ ar: c.q, name: c.a, tr: '' }));
  }

  function hlWord(word, target) {
    const cls = (window.QuranForms ? window.QuranForms.splitClusters(word) : [word]);
    return cls.map((c, i) => c[0] === target
      ? <span key={i} className="qp-hl">{c}</span>
      : <React.Fragment key={i}>{c}</React.Fragment>);
  }

  function Overlay({ topicId, onStart, onClose }) {
    const def = INTROS[topicId];
    if (!def) return null;
    const cards = introCards(topicId);
    const speak = (txt) => { if (window.QuranAudio) window.QuranAudio.speakText(txt, true); };
    return (
      <div className="qi-wrap">
        <div className="qi-inner">
          <div style={{ textAlign: 'right' }}>
            <button className="qi-x" onClick={onClose || onStart}>✕</button>
          </div>
          <div className="qi-title">{def.title}<br/><small>{def.sub}</small></div>
          <div className="qi-info">
            {def.teach.map((t, i) => <p key={i}>{i === 0 ? 'ℹ️ ' : ''}{t}</p>)}
          </div>
          <div className="qi-cards">
            {cards.map((c, i) => (
              <div key={i} className="qi-card">
                {c.name ? <div className="qi-name">{c.name}</div> : null}
                <div className="qi-ar" dir="rtl">{c.hl ? hlWord(c.hl, c.target) : c.ar}</div>
                {c.tr ? <div className="qi-tr">{c.tr}</div> : null}
                <button className="qi-spk" onClick={() => speak(c.hl || c.ar)}>🔊</button>
              </div>
            ))}
          </div>
          <div style={{ flex: 1 }}/>
          <button className="qi-start" onClick={onStart}>Lernen beginnen</button>
        </div>
      </div>
    );
  }

  window.QuranIntro = { has: hasIntro, seen: isSeen, markSeen: markSeen, Overlay: Overlay };
})();
