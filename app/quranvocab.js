/* ==============================================================
   Koran-Wortschatz & Namaz-Gebete.

   AUSBAU 07.08.2026 (Nutzerwunsch "kann viel mehr ausgeweitet
   werden — mach dich schlau, welche Wörter"): Der Wortschatz folgt
   jetzt dem bewährten Häufigkeits-Prinzip der klassischen
   "80 %-Wörter des Korans"-Lehrpläne: Die kleinen Partikel und
   Pronomen (min, fī, alā, mā, illā …) machen zusammen mit den
   häufigsten Nomen und Verben den Löwenanteil des Korantextes aus.
   Wer diese ~144 Wörter kennt, erkennt in fast jedem Vers etwas
   wieder. 9 kindgerechte Blöcke, vom Wichtigsten zum Speziellen:

     1  Allah & Glaube                 (die Kernbegriffe)
     2  Menschen & Welt                (Schöpfung)
     3  Gutes tun & erste Verben       (qāla, kāna, chalaqa …)
     4  Die häufigsten kleinen Wörter  (Partikel — Top-Frequenz!)
     5  Häufige Tu-Wörter              (dscha'ala, nazala …)
     6  Beten & Gottesdienst           (masdschid, sadschada …)
     7  Familie & Menschen             (ab, umm, ach, ucht …)
     8  Der Jüngste Tag                (qiyāma, hisāb …)
     9  Die Propheten                  (Namen aus dem Koran)

   Die IDs beginnen bewusst mit "quran-": dadurch bekommen beide
   Stapel automatisch das Quran-Progress-Lernerlebnis — aber sie
   hängen NICHT am Freischalt-Pfad der 18 Elifba-Lektionen.
   Reihenfolge im Export: GEBETE zuerst, WORTSCHATZ als letzter
   Stapel ganz unten (der Elifba-Kurs hat Vorrang).
   ============================================================== */
(function () {
  function topic(id, name, color, blocks) {
    const bl = blocks.map((b, i) => ({
      n: i + 1, title: b.t, subtitle: b.s || '',
      cards: b.items.map(x => ({ q: x[0], a: x[1] })),
      quiz: b.items.map(x => ({ q: x[0], a: x[1] })),
      cases: [],
    }));
    const count = bl.reduce((n, b) => n + b.cards.length, 0);
    return { id, tg: 0, name, color, meta: {}, merksaetze: [], blocks: bl, cardCount: count, quizCount: count };
  }

  const VOKABELN = topic('quran-vokabeln', 'Koran verstehen – Wortschatz', '#2E77C6', [
    { t: 'Allah & Glaube', s: 'Die wichtigsten Wörter', items: [
      ['اَللّٰه', 'Allah'], ['رَبّ', 'Herr'], ['رَسُول', 'Gesandter'], ['نَبِيّ', 'Prophet'],
      ['مَلَك', 'Engel'], ['كِتَاب', 'Buch'], ['قُرْآن', 'Koran'], ['آيَة', 'Zeichen / Vers'],
      ['دِين', 'Religion'], ['إِيمَان', 'Glaube'], ['إِسْلَام', 'Islam (Hingabe)'], ['صَلَاة', 'Gebet'],
      ['زَكَاة', 'Zekat (Armengabe)'], ['صَوْم', 'Fasten'], ['حَجّ', 'Pilgerfahrt'], ['رَحْمَة', 'Barmherzigkeit'],
    ]},
    { t: 'Menschen & Welt', s: 'Was Allah erschaffen hat', items: [
      ['نَاس', 'Menschen'], ['إِنْسَان', 'Mensch'], ['قَلْب', 'Herz'], ['نَفْس', 'Seele / Selbst'],
      ['يَوْم', 'Tag'], ['لَيْل', 'Nacht'], ['أَرْض', 'Erde'], ['سَمَاء', 'Himmel'],
      ['شَمْس', 'Sonne'], ['قَمَر', 'Mond'], ['مَاء', 'Wasser'], ['جَنَّة', 'Paradies (Garten)'],
      ['نَار', 'Feuer'], ['دُنْيَا', 'Diesseits (diese Welt)'], ['آخِرَة', 'Jenseits'], ['نُور', 'Licht'],
    ]},
    { t: 'Gutes tun & erste Verben', s: 'Kommen im Koran ganz oft vor', items: [
      ['خَيْر', 'Gutes'], ['شَرّ', 'Schlechtes'], ['حَقّ', 'Wahrheit / Recht'], ['صَبْر', 'Geduld'],
      ['شُكْر', 'Dankbarkeit'], ['عِلْم', 'Wissen'], ['عَمَل', 'Tat / Werk'], ['أَجْر', 'Lohn'],
      ['قَالَ', 'er sagte'], ['كَانَ', 'er war'], ['آمَنَ', 'er glaubte'], ['عَلِمَ', 'er wusste'],
      ['سَمِعَ', 'er hörte'], ['خَلَقَ', 'er erschuf'], ['عَبَدَ', 'er diente (Allah)'], ['غَفَرَ', 'er vergab'],
    ]},
    { t: 'Die häufigsten kleinen Wörter', s: 'Sie stecken in fast jedem Vers!', items: [
      ['مِنْ', 'von / aus'], ['فِي', 'in'], ['عَلَى', 'auf / über'], ['إِلَى', 'zu / nach'],
      ['عَنْ', 'über / weg von'], ['مَعَ', 'mit / zusammen mit'], ['لَهُ', 'für ihn / ihm gehört'], ['بِسْمِ', 'im Namen (von)'],
      ['لَا', 'nein / nicht'], ['مَا', 'was / nicht'], ['إِنَّ', 'wahrlich / gewiss'], ['إِلَّا', 'außer'],
      ['كُلّ', 'alle / jedes'], ['هُوَ', 'er'], ['هُمْ', 'sie (mehrere)'], ['الَّذِي', 'der, welcher'],
    ]},
    { t: 'Häufige Tu-Wörter', s: 'Verben, die immer wieder auftauchen', items: [
      ['جَعَلَ', 'er machte'], ['أَرَادَ', 'er wollte'], ['رَأَى', 'er sah'], ['جَاءَ', 'er kam'],
      ['أَخَذَ', 'er nahm'], ['آتَى', 'er gab'], ['دَخَلَ', 'er trat ein'], ['خَرَجَ', 'er ging hinaus'],
      ['أَكَلَ', 'er aß'], ['شَرِبَ', 'er trank'], ['وَجَدَ', 'er fand'], ['رَجَعَ', 'er kehrte zurück'],
      ['نَزَلَ', 'er kam herab'], ['هَدَى', 'er leitete recht'], ['نَصَرَ', 'er half'], ['ذَكَرَ', 'er dachte (an Allah)'],
    ]},
    { t: 'Beten & Gottesdienst', s: 'Rund um Namaz & Moschee', items: [
      ['مَسْجِد', 'Moschee'], ['دُعَاء', 'Bittgebet'], ['سَجَدَ', 'er warf sich nieder'], ['رَكَعَ', 'er verbeugte sich'],
      ['ذِكْر', 'Gedenken an Allah'], ['سَبَّحَ', 'er pries (Allah)'], ['حَمْد', 'Lob / Dank'], ['قِبْلَة', 'Gebetsrichtung'],
      ['وُضُوء', 'Gebetswaschung'], ['أَذَان', 'Gebetsruf'], ['إِمَام', 'Vorbeter'], ['جُمُعَة', 'Freitag(sgebet)'],
      ['رَمَضَان', 'Ramadan'], ['عِيد', 'Fest'], ['نِيَّة', 'Absicht'], ['دَعَا', 'er rief / betete'],
    ]},
    { t: 'Familie & Menschen', s: 'Wer im Koran vorkommt', items: [
      ['أَب', 'Vater'], ['أُمّ', 'Mutter'], ['اِبْن', 'Sohn'], ['بِنْت', 'Tochter'],
      ['أَخ', 'Bruder'], ['أُخْت', 'Schwester'], ['أَهْل', 'Familie / Leute'], ['وَلَد', 'Kind / Junge'],
      ['رَجُل', 'Mann'], ['اِمْرَأَة', 'Frau'], ['صَاحِب', 'Gefährte / Freund'], ['جَار', 'Nachbar'],
      ['يَتِيم', 'Waisenkind'], ['مِسْكِين', 'Bedürftiger'], ['ضَيْف', 'Gast'], ['قَوْم', 'Volk'],
    ]},
    { t: 'Der Jüngste Tag', s: 'Woran wir glauben', items: [
      ['يَوْمُ الْقِيَامَةِ', 'der Tag der Auferstehung'], ['بَعَثَ', 'er erweckte (zum Leben)'], ['حِسَاب', 'Abrechnung'], ['مِيزَان', 'Waage'],
      ['صِرَاط', 'der (gerade) Weg'], ['عَذَاب', 'Strafe'], ['ثَوَاب', 'Belohnung'], ['مَوْت', 'Tod'],
      ['حَيَاة', 'Leben'], ['رُوح', 'Seele / Geist'], ['قَبْر', 'Grab'], ['خَالِدِينَ', 'für immer (darin bleibend)'],
      ['فَوْز', 'Sieg / großer Gewinn'], ['نَعِيم', 'Glückseligkeit'], ['شَفَاعَة', 'Fürsprache'], ['تَوْبَة', 'Reue / Umkehr'],
    ]},
    { t: 'Die Propheten', s: 'Namen, die der Koran erzählt', items: [
      ['آدَم', 'Adam'], ['نُوح', 'Nuh (Noah)'], ['إِبْرَاهِيم', 'Ibrahim (Abraham)'], ['إِسْمَاعِيل', 'Ismail'],
      ['مُوسَى', 'Musa (Moses)'], ['هَارُون', 'Harun (Aaron)'], ['عِيسَى', 'Isa (Jesus)'], ['يُوسُف', 'Yusuf (Josef)'],
      ['يَعْقُوب', 'Yakub (Jakob)'], ['يُونُس', 'Yunus (Jona)'], ['دَاوُد', 'Dawud (David)'], ['سُلَيْمَان', 'Sulayman (Salomo)'],
      ['أَيُّوب', 'Ayyub (Hiob)'], ['زَكَرِيَّا', 'Zakariyya'], ['يَحْيَى', 'Yahya (Johannes)'], ['مُحَمَّد', 'Muhammed ﷺ'],
    ]},
  ]);

  const GEBETE = topic('quran-gebete', 'Gebete im Namaz', '#8E5AB5', [
    { t: 'Sübhaneke', s: 'Am Anfang des Gebets', items: [
      ['سُبْحَانَكَ اللّٰهُمَّ وَبِحَمْدِكَ', 'Sübhânekellâhümme ve bi hamdik · Gepriesen bist du, Allah, mit deinem Lob'],
      ['وَتَبَارَكَ اسْمُكَ', 'Ve tebârakesmük · Gesegnet ist dein Name'],
      ['وَتَعَالٰى جَدُّكَ', 'Ve teâlâ ceddük · Erhaben ist deine Größe'],
      ['وَلَا إِلٰهَ غَيْرُكَ', 'Ve lâ ilâhe ğayruk · Es gibt keinen Gott außer dir'],
    ]},
    { t: 'Ettehiyyatü', s: 'Im Sitzen', items: [
      ['اَلتَّحِيَّاتُ لِلّٰهِ وَالصَّلَوَاتُ وَالطَّيِّبَاتُ', 'Ettehiyyâtü lillâhi vessalevâtü vettayyibât · Alle Ehrungen, Gebete und guten Dinge gehören Allah'],
      ['اَلسَّلَامُ عَلَيْكَ أَيُّهَا النَّبِيُّ وَرَحْمَةُ اللّٰهِ وَبَرَكَاتُهُ', 'Esselâmü aleyke eyyühen-nebiyyü ve rahmetullâhi ve berakâtüh · Friede sei mit dir, o Prophet, und Allahs Barmherzigkeit und Segen'],
      ['اَلسَّلَامُ عَلَيْنَا وَعَلٰى عِبَادِ اللّٰهِ الصَّالِحِينَ', 'Esselâmü aleynâ ve alâ ibâdillâhis-sâlihîn · Friede sei mit uns und mit Allahs rechtschaffenen Dienern'],
      ['أَشْهَدُ أَنْ لَا إِلٰهَ إِلَّا اللّٰهُ', 'Eşhedü en lâ ilâhe illallâh · Ich bezeuge: Es gibt keinen Gott außer Allah'],
      ['وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ', 'Ve eşhedü enne Muhammeden abdühû ve rasûlüh · und ich bezeuge, dass Muhammed sein Diener und Gesandter ist'],
    ]},
    { t: 'Allahumme salli', s: 'Segensgruß für den Propheten ﷺ', items: [
      ['اَللّٰهُمَّ صَلِّ عَلٰى مُحَمَّدٍ وَعَلٰى آلِ مُحَمَّدٍ', 'Allâhümme salli alâ Muhammedin ve alâ âli Muhammed · O Allah, segne Muhammed und seine Familie'],
      ['كَمَا صَلَّيْتَ عَلٰى إِبْرَاهِيمَ وَعَلٰى آلِ إِبْرَاهِيمَ', 'Kemâ salleyte alâ İbrâhîme ve alâ âli İbrâhîm · wie du Ibrahim und seine Familie gesegnet hast'],
      ['إِنَّكَ حَمِيدٌ مَجِيدٌ', 'İnneke hamîdün mecîd · Du bist der Gelobte, der Ruhmreiche'],
    ]},
    { t: 'Allahumme barik', s: 'Segensgruß, zweiter Teil', items: [
      ['اَللّٰهُمَّ بَارِكْ عَلٰى مُحَمَّدٍ وَعَلٰى آلِ مُحَمَّدٍ', 'Allâhümme bârik alâ Muhammedin ve alâ âli Muhammed · O Allah, schenke Muhammed und seiner Familie Segen'],
      ['كَمَا بَارَكْتَ عَلٰى إِبْرَاهِيمَ وَعَلٰى آلِ إِبْرَاهِيمَ', 'Kemâ bârakte alâ İbrâhîme ve alâ âli İbrâhîm · wie du Ibrahim und seiner Familie Segen geschenkt hast'],
      ['إِنَّكَ حَمِيدٌ مَجِيدٌ', 'İnneke hamîdün mecîd · Du bist der Gelobte, der Ruhmreiche'],
    ]},
    { t: 'Rabbena-Duas', s: 'Bittgebete am Ende', items: [
      ['رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً', 'Rabbenâ âtinâ fid-dünyâ haseneh · Unser Herr, gib uns im Diesseits Gutes'],
      ['وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ', 'Ve fil-âhirati haseneten ve kınâ azâben-nâr · und im Jenseits Gutes, und bewahre uns vor der Strafe des Feuers'],
      ['رَبَّنَا اغْفِرْ لِي وَلِوَالِدَيَّ', 'Rabbenâğfirlî ve li vâlideyye · Unser Herr, vergib mir und meinen Eltern'],
      ['وَلِلْمُؤْمِنِينَ يَوْمَ يَقُومُ الْحِسَابُ', 'Ve lil-mü’minîne yevme yekûmül-hisâb · und allen Gläubigen an dem Tag, an dem die Abrechnung stattfindet'],
    ]},
    { t: 'Kelime-i Tevhid & Şehadet', s: 'Die Glaubensworte', items: [
      ['لَا إِلٰهَ إِلَّا اللّٰهُ مُحَمَّدٌ رَسُولُ اللّٰهِ', 'Lâ ilâhe illallâh, Muhammedün rasûlullâh · Es gibt keinen Gott außer Allah, Muhammed ist Allahs Gesandter'],
      ['أَشْهَدُ أَنْ لَا إِلٰهَ إِلَّا اللّٰهُ وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ', 'Eşhedü en lâ ilâhe illallâh ve eşhedü enne Muhammeden abdühû ve rasûlüh · Ich bezeuge, dass es keinen Gott außer Allah gibt, und dass Muhammed sein Diener und Gesandter ist'],
    ]},
  ]);

  // Gebete zuerst, der Wortschatz als LETZTER Stapel (Nutzerwunsch 07.08.2026).
  window.QURAN_EXTRA_TOPICS = [GEBETE, VOKABELN];
})();
