/* ==============================================================
   🕌 AUSWENDIG LERNEN — die Daten (11.08.2026)

   Nutzerwunsch: „ein System, das ein bisschen anders ist als das
   Buchstaben-Lernen — die Kinder lernen ganze Suren auswendig. Vor
   allem Fâtiha, Sübhâneke, Kevser und İhlâs. Und das soll am meisten
   Punkte geben."

   Hier steht NUR, WAS gelernt wird. Wie gelernt wird (Stufen, Kette,
   Mikrofon, Punkte) steht in app/hifz.js.

   Quellen: Der arabische Text der Suren kommt aus app/surahdata.js
   (quran-simple / alquran.cloud, Übersetzung Bubenheim & Elyas) —
   bewusst NICHT hier nochmal abgetippt, damit es keine zwei
   Wahrheiten gibt. Die Gebete (Sübhâneke, Ettehiyyâtü …) stammen aus
   app/quranvocab.js, dem Stapel „Gebete im Namaz".

   Ergänzt wird hier je Sure:
     - warum man sie im Namaz braucht (Motivation),
     - ein Merk-Tipp fürs Auswendiglernen,
     - für die vier Kern-Suren: die Umschrift Wort für Wort, damit
       beim Wort-Puzzle unter jedem arabischen Baustein steht, wie
       man ihn liest.

   NEUE SURE HINZUFÜGEN: einfach unten in LIST einen Eintrag
   ergänzen. Für eine Sure aus dem Koran reicht {src:'surah', n:114};
   Text, Umschrift und Ton holt die App automatisch. Für ein Gebet
   die Teile direkt bei `parts` eintragen.
   ============================================================== */
(function () {

  /* ---------- 1. Die Gebete (kein Korantext -> hier vollständig) ---------- */
  const SUEBHANEKE = [
    { ar: 'سُبْحَانَكَ اللّٰهُمَّ وَبِحَمْدِكَ', tr: 'Sübhâneke’llâhümme ve bi hamdik',
      de: 'Gepriesen bist du, o Allah, und dir gebührt das Lob,',
      w: [['سُبْحَانَكَ', 'sübhâneke'], ['اللّٰهُمَّ', 'llâhümme'], ['وَبِحَمْدِكَ', 've bi hamdik']] },
    { ar: 'وَتَبَارَكَ اسْمُكَ', tr: 'Ve tebârake’smük', de: 'gesegnet ist dein Name,',
      w: [['وَتَبَارَكَ', 've tebârake'], ['اسْمُكَ', 'smük']] },
    { ar: 'وَتَعَالٰى جَدُّكَ', tr: 'Ve teâlâ ceddük', de: 'erhaben ist deine Größe,',
      w: [['وَتَعَالٰى', 've teâlâ'], ['جَدُّكَ', 'ceddük']] },
    { ar: 'وَلَا إِلٰهَ غَيْرُكَ', tr: 'Ve lâ ilâhe ğayruk', de: 'und es gibt keinen Gott außer dir.',
      w: [['وَلَا', 've lâ'], ['إِلٰهَ', 'ilâhe'], ['غَيْرُكَ', 'ğayruk']] },
  ];

  const ETTEHIYYATU = [
    { ar: 'اَلتَّحِيَّاتُ لِلّٰهِ وَالصَّلَوَاتُ وَالطَّيِّبَاتُ', tr: 'Ettehiyyâtü lillâhi ves-salevâtü vet-tayyibât',
      de: 'Alle Ehrungen, Gebete und guten Dinge gehören Allah.' },
    { ar: 'اَلسَّلَامُ عَلَيْكَ أَيُّهَا النَّبِيُّ وَرَحْمَةُ اللّٰهِ وَبَرَكَاتُهُ', tr: 'Esselâmü aleyke eyyühen-nebiyyü ve rahmetullâhi ve berakâtüh',
      de: 'Friede sei mit dir, o Prophet, und Allahs Barmherzigkeit und sein Segen.' },
    { ar: 'اَلسَّلَامُ عَلَيْنَا وَعَلٰى عِبَادِ اللّٰهِ الصَّالِحِينَ', tr: 'Esselâmü aleynâ ve alâ ibâdillâhis-sâlihîn',
      de: 'Friede sei mit uns und mit Allahs rechtschaffenen Dienern.' },
    { ar: 'أَشْهَدُ أَنْ لَا إِلٰهَ إِلَّا اللّٰهُ', tr: 'Eşhedü en lâ ilâhe illallâh',
      de: 'Ich bezeuge: Es gibt keinen Gott außer Allah.' },
    { ar: 'وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ', tr: 'Ve eşhedü enne Muhammeden abdühû ve rasûlüh',
      de: 'Und ich bezeuge: Muhammed ist sein Diener und sein Gesandter.' },
  ];

  const SALLI = [
    { ar: 'اَللّٰهُمَّ صَلِّ عَلٰى مُحَمَّدٍ وَعَلٰى آلِ مُحَمَّدٍ', tr: 'Allâhümme salli alâ Muhammedin ve alâ âli Muhammed',
      de: 'O Allah, segne Muhammed und die Familie Muhammeds,' },
    { ar: 'كَمَا صَلَّيْتَ عَلٰى إِبْرَاهِيمَ وَعَلٰى آلِ إِبْرَاهِيمَ', tr: 'Kemâ salleyte alâ İbrâhîme ve alâ âli İbrâhîm',
      de: 'wie du Ibrahim und die Familie Ibrahims gesegnet hast.' },
    { ar: 'إِنَّكَ حَمِيدٌ مَجِيدٌ', tr: 'İnneke hamîdün mecîd', de: 'Du bist der Gelobte, der Ruhmreiche.' },
  ];

  const BARIK = [
    { ar: 'اَللّٰهُمَّ بَارِكْ عَلٰى مُحَمَّدٍ وَعَلٰى آلِ مُحَمَّدٍ', tr: 'Allâhümme bârik alâ Muhammedin ve alâ âli Muhammed',
      de: 'O Allah, schenke Muhammed und der Familie Muhammeds Segen,' },
    { ar: 'كَمَا بَارَكْتَ عَلٰى إِبْرَاهِيمَ وَعَلٰى آلِ إِبْرَاهِيمَ', tr: 'Kemâ bârakte alâ İbrâhîme ve alâ âli İbrâhîm',
      de: 'wie du Ibrahim und der Familie Ibrahims Segen geschenkt hast.' },
    { ar: 'إِنَّكَ حَمِيدٌ مَجِيدٌ', tr: 'İnneke hamîdün mecîd', de: 'Du bist der Gelobte, der Ruhmreiche.' },
  ];

  const RABBENA = [
    { ar: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً', tr: 'Rabbenâ âtinâ fid-dünyâ haseneten',
      de: 'Unser Herr, gib uns im Diesseits Gutes' },
    { ar: 'وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ', tr: 'Ve fil-âhirati haseneten ve kınâ azâben-nâr',
      de: 'und im Jenseits Gutes, und bewahre uns vor der Strafe des Feuers.' },
  ];

  const RABBENAGFIR = [
    { ar: 'رَبَّنَا اغْفِرْ لِي وَلِوَالِدَيَّ', tr: 'Rabbena’ğfirlî ve li vâlideyye',
      de: 'Unser Herr, vergib mir und meinen Eltern' },
    { ar: 'وَلِلْمُؤْمِنِينَ يَوْمَ يَقُومُ الْحِسَابُ', tr: 'Ve lil-mü’minîne yevme yekûmül-hisâb',
      de: 'und den Gläubigen an dem Tag, an dem die Abrechnung stattfindet.' },
  ];

  /* ---------- 2. Umschrift Wort für Wort (die vier Kern-Suren) ---------- */
  /* Reihenfolge = Vers für Vers. Wo nichts steht, zeigt die App beim
     Puzzle nur das arabische Wort — das genügt völlig. */
  const WORDS = {
    fatiha: [
      [['بِسْمِ', 'bismi'], ['اللَّهِ', 'llâhi'], ['الرَّحْمَٰنِ', 'r-rahmâni'], ['الرَّحِيمِ', 'r-rahîm']],
      [['الْحَمْدُ', 'el-hamdü'], ['لِلَّهِ', 'lillâhi'], ['رَبِّ', 'rabbi'], ['الْعَالَمِينَ', 'l-âlemîn']],
      [['الرَّحْمَٰنِ', 'er-rahmâni'], ['الرَّحِيمِ', 'r-rahîm']],
      [['مَالِكِ', 'mâliki'], ['يَوْمِ', 'yevmi'], ['الدِّينِ', 'd-dîn']],
      [['إِيَّاكَ', 'iyyâke'], ['نَعْبُدُ', 'na’büdü'], ['وَإِيَّاكَ', 've iyyâke'], ['نَسْتَعِينُ', 'neste’în']],
      [['اهْدِنَا', 'ihdine'], ['الصِّرَاطَ', 's-sırâta'], ['الْمُسْتَقِيمَ', 'l-müstekîm']],
      [['صِرَاطَ', 'sırâta'], ['الَّذِينَ', 'llezîne'], ['أَنْعَمْتَ', 'en’amte'], ['عَلَيْهِمْ', 'aleyhim'],
       ['غَيْرِ', 'ğayri'], ['الْمَغْضُوبِ', 'l-mağdûbi'], ['عَلَيْهِمْ', 'aleyhim'], ['وَلَا', 've le'], ['الضَّالِّينَ', 'd-dâllîn']],
    ],
    kevser: [
      [['إِنَّا', 'innâ'], ['أَعْطَيْنَاكَ', 'a’taynâke'], ['الْكَوْثَرَ', 'l-kevser']],
      [['فَصَلِّ', 'fe salli'], ['لِرَبِّكَ', 'li rabbike'], ['وَانْحَرْ', 'venhar']],
      [['إِنَّ', 'inne'], ['شَانِئَكَ', 'şânieke'], ['هُوَ', 'hüve'], ['الْأَبْتَرُ', 'l-ebter']],
    ],
    ihlas: [
      [['قُلْ', 'kul'], ['هُوَ', 'hüve'], ['اللَّهُ', 'llâhü'], ['أَحَدٌ', 'ehad']],
      [['اللَّهُ', 'Allâhü'], ['الصَّمَدُ', 's-samed']],
      [['لَمْ', 'lem'], ['يَلِدْ', 'yelid'], ['وَلَمْ', 've lem'], ['يُولَدْ', 'yûled']],
      [['وَلَمْ', 've lem'], ['يَكُنْ', 'yekün'], ['لَهُ', 'lehû'], ['كُفُوًا', 'küfüven'], ['أَحَدٌ', 'ehad']],
    ],
  };

  /* ---------- 3. Die Liste ---------- */
  /* src:'surah' -> Text kommt aus window.SURAHS_DATA (Nummer n)
     src:'dua'   -> Text steht oben in dieser Datei
     stern: true -> gehört zu den vier, die man für den Namaz zuerst braucht */
  const LIST = [
    { id: 'suebhaneke', src: 'dua', parts: SUEBHANEKE, stern: true,
      name: 'Sübhâneke', arName: 'سُبْحَانَكَ', deName: 'Das Lobgebet',
      why: 'Der allererste Satz im Namaz — direkt nach „Allâhu ekber“.',
      tip: 'Vier kurze Stücke. Sprich jedes Stück dreimal laut, dann hängst du sie aneinander wie Perlen auf eine Schnur.' },

    { id: 'fatiha', src: 'surah', n: 1, stern: true, words: WORDS.fatiha,
      why: 'Sie wird in JEDER Gebetseinheit gelesen — ohne Fâtiha kein Namaz.',
      tip: 'Vers 1–3 loben Allah, Vers 4–5 sind das Versprechen, Vers 6–7 die Bitte. Merk dir diese drei Teile — dann weißt du immer, wo du bist.' },

    { id: 'kevser', src: 'surah', n: 108, stern: true, words: WORDS.kevser,
      why: 'Die kürzeste Sure im Koran — der perfekte Einstieg als „zamm-ı sure“ nach der Fâtiha.',
      tip: 'Nur drei Verse. Jeder Vers endet auf „-er“: kevser – venhar – ebter. Der Reim hilft dir!' },

    { id: 'ihlas', src: 'surah', n: 112, stern: true, words: WORDS.ihlas,
      why: 'Der Prophet ﷺ sagte: Sie ist so wertvoll wie ein Drittel des Korans.',
      tip: 'Vers 3 und 4 fangen beide mit „lem/ve lem“ an. Achte auf das kleine „ve“ — daran erkennst du Vers 4.' },

    { id: 'felak', src: 'surah', n: 113,
      why: 'Eine der beiden Schutzsuren — der Prophet ﷺ las sie jeden Abend.',
      tip: 'Ab Vers 2 beginnt jeder Vers mit „min şerri“ (vor dem Übel von …). Zähle mit: vier Mal „min şerri“.' },

    { id: 'nas', src: 'surah', n: 114,
      why: 'Die zweite Schutzsure und die letzte Sure des Korans.',
      tip: 'Die ersten drei Verse enden alle auf „nâs“: rabbi’n-nâs, meliki’n-nâs, ilâhi’n-nâs.' },

    { id: 'asr', src: 'surah', n: 103,
      why: 'Drei Verse, die den ganzen Islam zusammenfassen — sehr beliebt als kurze Sure im Namaz.',
      tip: 'Vers 3 ist der lange. Teile ihn in zwei Hälften: erst „âmenû ve amilus-sâlihât“, dann die beiden „tevâsav“.' },

    { id: 'nasr', src: 'surah', n: 110,
      why: 'Eine der letzten Suren, die offenbart wurden — kurz und feierlich.',
      tip: 'Drei Verse: Hilfe kommt – Menschen kommen – danke Allah. Erzähl es dir als Geschichte.' },

    { id: 'kafirun', src: 'surah', n: 109,
      why: 'Der Prophet ﷺ las sie oft zusammen mit İhlâs vor dem Schlafengehen.',
      tip: 'Achtung, Vers 3 und Vers 5 sind wortgleich! Merk dir: dazwischen liegt der Vers mit „ene“ (ich).' },

    { id: 'fil', src: 'surah', n: 105,
      why: 'Die Geschichte vom Elefantenheer — Kinder lieben sie.',
      tip: 'Erzähl den Film mit: Frage – List zerstört – Vögel – Steine – wie abgefressene Halme.' },

    { id: 'kureys', src: 'surah', n: 106,
      why: 'Sie gehört inhaltlich direkt an die Elefanten-Sure — oft zusammen gelesen.',
      tip: 'Vers 1 und 2 beginnen fast gleich („li-îlâfi / îlâfihim“). Das ist die Stelle zum Aufpassen.' },

    { id: 'masad', src: 'surah', n: 111,
      why: 'Fünf kurze Verse mit klarem Rhythmus.',
      tip: 'Der Reim trägt dich: tebb – keseb – leheb – hatab – mesed.' },

    { id: 'maun', src: 'surah', n: 107,
      why: 'Sie erklärt, woran man echten Glauben erkennt: an guten Taten.',
      tip: 'Vier Verse beginnen mit „ellezî(ne)“. Zähle sie beim Üben mit den Fingern mit.' },

    { id: 'ettehiyyatu', src: 'dua', parts: ETTEHIYYATU,
      name: 'Ettehiyyâtü', arName: 'اَلتَّحِيَّاتُ', deName: 'Das Sitz-Gebet',
      why: 'Wird in jedem Sitzen (Ka‘de) des Namaz gesprochen.',
      tip: 'Zwei Mal „Esselâmü“ hintereinander — einmal an den Propheten ﷺ, einmal an uns alle. Danach zwei Mal „Eşhedü“.' },

    { id: 'salli', src: 'dua', parts: SALLI,
      name: 'Allâhümme salli', arName: 'اَللّٰهُمَّ صَلِّ', deName: 'Segensgruß, Teil 1',
      why: 'Kommt im letzten Sitzen direkt nach Ettehiyyâtü.',
      tip: 'Salli und Bârik sind fast gleich gebaut. Lerne erst Salli richtig — Bârik ist dann fast geschenkt.' },

    { id: 'barik', src: 'dua', parts: BARIK,
      name: 'Allâhümme bârik', arName: 'اَللّٰهُمَّ بَارِكْ', deName: 'Segensgruß, Teil 2',
      why: 'Folgt direkt auf Allâhümme salli.',
      tip: 'Nimm Salli und tausche „salli/salleyte“ gegen „bârik/bârakte“. Der Rest ist wortgleich.' },

    { id: 'rabbena', src: 'dua', parts: RABBENA,
      name: 'Rabbenâ âtinâ', arName: 'رَبَّنَا آتِنَا', deName: 'Bittgebet 1',
      why: 'Das bekannteste Bittgebet am Ende des Namaz.',
      tip: 'Nur zwei Stücke: erst das Diesseits, dann das Jenseits.' },

    { id: 'rabbenagfir', src: 'dua', parts: RABBENAGFIR,
      name: 'Rabbenâğfirlî', arName: 'رَبَّنَا اغْفِرْ', deName: 'Bittgebet 2',
      why: 'Ein Gebet für dich, deine Eltern und alle Gläubigen.',
      tip: 'Denk beim Sprechen an deine Eltern — dann sitzt es viel schneller.' },
  ];

  /* ---------- 4. Zusammenbauen ---------- */
  function splitWords(ar) {
    return String(ar || '').trim().split(/\s+/).filter(Boolean).map(function (w) { return [w, '']; });
  }
  function build() {
    const surahs = window.SURAHS_DATA || [];
    const out = [];
    LIST.forEach(function (e, i) {
      let parts = [], name = e.name, arName = e.arName, deName = e.deName;
      let audioStart = null, place = '', meaning = '', fact = '', num = null;
      if (e.src === 'surah') {
        const s = surahs.filter(function (x) { return x.n === e.n; })[0];
        if (!s) return;                                  // Sure fehlt in surahdata.js -> überspringen
        num = s.n; name = name || s.name; arName = arName || s.arName; deName = deName || s.deName;
        audioStart = s.audioStart; place = s.place; meaning = s.meaning; fact = s.fact;
        parts = s.ayahs.map(function (a, k) {
          const w = (e.words && e.words[k]) ? e.words[k] : splitWords(a.ar);
          return { ar: a.ar, tr: a.tr, de: a.de, w: w };
        });
      } else {
        parts = (e.parts || []).map(function (p) {
          return { ar: p.ar, tr: p.tr, de: p.de, w: p.w || splitWords(p.ar) };
        });
      }
      if (!parts.length) return;
      out.push({
        id: e.id, kind: e.src === 'surah' ? 'sure' : 'gebet', n: num, order: i + 1,
        name: name, arName: arName, deName: deName, place: place,
        why: e.why || '', tip: e.tip || '', meaning: meaning, fact: fact,
        stern: !!e.stern, audioStart: audioStart, parts: parts,
        wordCount: parts.reduce(function (n, p) { return n + p.w.length; }, 0),
      });
    });
    return out;
  }

  window.HIFZ_ITEMS = build();
  window.HIFZ_BY_ID = {};
  window.HIFZ_ITEMS.forEach(function (it) { window.HIFZ_BY_ID[it.id] = it; });
})();
