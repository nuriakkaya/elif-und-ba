# 🌙 Elif & Ba — Einrichtung & Update (Version 8.6)

**Das Wichtigste in einem Satz:** Ein Kind tippt auf *Anmelden*, schreibt seinen
**Namen**, drückt einmal — und ist im Kurs. Kein Anmeldecode, kein Passwort,
keine E-Mail. Du als Lehrkraft siehst danach automatisch **jedes Kind mit
seinem kompletten Fortschritt**.

---

## 🚀 Neue Version hochladen (1 Minute) — ZIP NICHT ENTPACKEN

Die ZIP-Datei ist ab Version 7.2 so gebaut, dass sie **direkt** hochgeladen
werden kann. `index.html`, `netlify.toml`, `_redirects` und der Ordner
`netlify` liegen darin ganz oben — **ohne Ordner drumherum**.

1. **https://app.netlify.com** → deine Seite → Reiter **„Deploys“**.
2. Die **ZIP-Datei** ins große Feld ziehen (oder „browse to upload“ und die
   ZIP auswählen). **Nicht vorher entpacken.**
3. Warten, bis oben **„Published“** steht.
4. Im Browser **`deine-adresse.netlify.app/check.html`** öffnen.
   Dort steht in einem Satz, ob alles läuft, und welche Version wirklich
   auf dem Server liegt.

> **Warum das vorher schiefging:** Lag beim Hochladen noch ein Ordner um die
> Dateien herum (z. B. `Elif-und-Ba/`), findet Netlify die Datei
> `netlify.toml` nicht und richtet den Mini-Server nie ein. Die App lud zwar,
> aber beim Anmelden kam „Not found“. Die Prüfseite erkennt genau diesen Fall
> und sagt es dir im Klartext.

**Ab Version 7.1 kommt jedes Update sofort an.** Die App fragt beim Start eine
winzige Datei (`version.json`) ohne Zwischenspeicher ab. Steht dort eine neuere
Version, räumt sie den alten Zwischenspeicher weg und lädt sich einmal selbst
neu. Falls doch mal etwas hängt: **`/check.html` öffnen → „Zwischenspeicher
leeren“**, oder in der App unter „🔧 Verbindung prüfen“.

## 🩺 Die Prüfseite `/check.html`

Sie ist der schnellste Weg, jedes Problem einzugrenzen — sie braucht die App
nicht und funktioniert auch dann, wenn die App selbst noch alt ist:

- **Hochgeladene Version** — was wirklich auf dem Server liegt.
- **Mini-Server** — alle drei Wege einzeln geprüft, mit Statuscode.
- **Dateien** — was im Hochgeladenen angekommen ist.
- **Urteil in einem Satz** plus konkrete Reparaturanleitung.

Adresse: deine Netlify-Adresse + `/check.html`.

## 👧👦 So melden sich die Kinder an

1. App öffnen → oben rechts **„Anmelden“**.
2. **Namen eingeben** → „Los geht's! 🚀“. **Fertig.**
3. Wer schon einmal da war, tippt seinen Namen einfach in der Liste
   **„Schon mal dabei gewesen?“** an — ein Fingertipp genügt.
4. Auf einem zweiten Gerät denselben Namen eingeben → der Fortschritt ist da.

Optional unter **„▾ Mehr“**: ein **Geheimwort** (schützt den Namen, falls zwei
Kinder gleich heißen) und eine **Gruppe** (nur nötig, wenn du mehrere Klassen
getrennt sehen willst).

## 🧑‍🏫 Klassenzimmer (Lehrkraft)

1. In der Navigation auf **„🏫 Klassenzimmer“** (am Handy: Tab „Klasse“).
2. **Lehrer-Passwort: `1907`** eingeben (oder eine eigene PIN festlegen).
3. Die Liste ist **sofort da** — ohne Code, ohne Einladung. Jedes Kind, das
   irgendwo seinen Namen eingetragen hat, steht drin.

### Wer steht genau wo? (neu in 7.1)

Ganz oben liegt das Raster **„🗺️ Wer steht wo?“**: eine Zeile pro Kind, eine
Spalte pro Lektion, jedes Feld zeigt den Prozentwert und wird umso grüner, je
sicherer die Lektion sitzt. Ein Blick genügt, um zu sehen, wer hängt und wer
vorausgeeilt ist.

In der Liste darunter steht bei jedem Kind direkt unter dem Namen, **wo es
gerade ist** — z. B. „📍 ist bei: 3. Üstün · 7 von 24 Karten sicher · 31 %“ —
plus „zuletzt: vor 20 Min.“. Sortieren kannst du nach Name, Fortschritt oder
zuletzt aktiv.

Ein Klick auf ein Kind öffnet die Einzelheiten:

- **🎯 wie viele Karten sitzen** (sicher / am Lernen / noch nie gesehen),
- **die letzten 7 Tage** als kleiner Balkenstreifen (wer übt regelmäßig?),
- **🔁 woran es gerade hakt** — die konkreten Buchstaben und Silben, die immer
  wieder schiefgehen, mit Anzahl der Fehlversuche,
- **Fortschritt je Lektion** als Balkenliste.
4. Die Liste aktualisiert sich alle 45 Sekunden von selbst; „🔄 Aktualisieren“
   geht auch sofort.
5. **„🔓 Lehrer-Modus“**: alle Lektionen ohne Freischaltung — zum Vorbereiten
   und Vorführen.
6. Mehrere Klassen? Unter **„▾ Nur eine bestimmte Gruppe anzeigen“** einen
   Gruppennamen eintragen (z. B. `KLASSE4A`) und denselben den Kindern unter
   „▾ Mehr“ eintragen lassen. Ohne Gruppe sind alle in einer Sammelliste.

## ✏️ Die Buchstaben-Werkstatt (ausgebaut am 12.08.2026)

Klassenzimmer → **„✏️ Buchstaben-Werkstatt"**. Jede der ~430 Karten gehört dir —
mit voller Kontrolle und ohne dass irgendetwas endgültig wäre:

**Texte:** Du kannst die **Schreibweise (arabisch)** UND die **Umschrift**
ändern. Beides gilt sofort überall (Lektionen, Antwortauswahlen,
Buchstaben-Übersicht, Unendlich-XP). Der Fortschritt der Kinder bleibt dabei
erhalten — die App merkt sich Karten intern an der Original-Schreibweise.
„↩︎ Original wiederherstellen" bringt jederzeit den Auslieferungszustand zurück.

**Ton — mit Probehören:**

- Ein Chip zeigt, **was gerade gilt**: 🎙️ deine Aufnahme, 🔊 App-Aufnahme oder 🗣 Systemstimme.
- **▶️ So klingt es jetzt** spielt genau das ab, was die Kinder hören.
- **🎙️ Selbst einsprechen** nimmt bis zu 10 Sekunden auf — danach hörst du die
  **Probeaufnahme erst an** und entscheidest: ✅ Übernehmen, 🔁 Nochmal oder
  🗑️ Verwerfen. Nichts geht ungehört online.
- **🗑️ Aufnahme löschen → Standardstimme**: Deine Aufnahme verschwindet, und es
  gilt automatisch wieder die Standardstimme. Mit **🔊 Standardstimme anhören**
  kannst du vorher vergleichen, wie es dann klänge.

Die Filter oben („✏️ Geändert", „🎙️ Eigene") zeigen dir auf einen Blick, was du
schon angefasst hast.

## ✏️ Buchstaben & Silben selbst ändern (neu in 7.4)

Du musst für Korrekturen niemanden mehr fragen. **Klassenzimmer → „✏️ Buchstaben
& Silben bearbeiten" → Bearbeiten.**

1. **Suchen**: Tippe in das Suchfeld, was du ändern willst — den arabischen
   Buchstaben, die Umschrift („cha") oder den Lektionsnamen. Aus über
   500 Karten bleibt sofort nur die eine übrig.
2. **Antippen**: Die Karte klappt auf. Oben steht, in welchen Lektionen dieser
   Buchstabe überall vorkommt.
3. **Umschreiben**: Feld ändern → **💾 Speichern**. Fertig.
4. **Neu einsprechen**: Im selben Kasten **🎙️ Aussprache aufnehmen** → sprechen
   → ⏹. Mit ▶️ probehören, jederzeit überschreiben.
5. **Zurück zum Original**: **↩︎ Original** stellt die mitgelieferte Fassung
   wieder her.

**Eine Änderung gilt sofort überall.** Der Eintrag hängt an der arabischen
Seite der Karte — also greift er in jeder Lektion, auf jeder Karteikarte, in
jeder Antwortauswahl, in der Buchstabenübersicht und im Duell. Die Kinder
bekommen die neue Fassung beim nächsten Öffnen automatisch, ohne etwas zu tun.

**Der Lernfortschritt bleibt erhalten.** Der Karteikasten merkt sich jede Karte
an ihrer arabischen Seite, nicht an der Umschrift — Umbenennen setzt also nichts
zurück.

Der Filter **„Nur geänderte"** zeigt auf einen Blick, was du bereits angepasst
hast.

## ⚔️ Live-Duell: Freunde herausfordern (neu in 7.4)

Zwei bis sechs Kinder spielen dieselben Fragen gleichzeitig gegeneinander —
über euren eigenen Server, ohne Zusatzkonto.

1. Startseite → **„Duell starten"** (am Handy der Tab **⚔️ Duell**).
2. Lektion wählen.
3. Einen **Mitschüler antippen** — die Einladung erscheint sofort auf dessen
   Gerät („🔔 … fordert dich heraus!"), er tippt auf **Annehmen**.
   Ohne Namen geht es auch: **Duell eröffnen** und den **4-Zeichen-Code**
   weitergeben.
4. Der Herausforderer drückt **▶️ Start!** — dann läuft es.

Pro Frage 15 Sekunden. Richtig gibt 100 Punkte, wer schneller ist, bekommt bis
zu 50 Punkte Tempo-Bonus obendrauf. Beide sehen live den Punktestand des
anderen. Am Ende gibt es das Siegertreppchen und **🔁 Revanche**.

Die Aussprache-Aufnahmen und deine geänderten Umschriften gelten im Duell
genauso wie beim Lernen.

## 🔊 Der Ton: nichts einzurichten

**Alle 30 Buchstaben-Aufnahmen sind fest in der App enthalten** — als eine Datei
(`assets/letters.mp3`, 496 KB), alle auf dieselbe Lautstärke gebracht und ohne
Rauschen am Anfang. Kein fremder Server, kein Nachladen: Der Ton läuft im
Schul-WLAN, im Flugmodus und auf jedem Gerät gleich.

Die Reihenfolge, in der die App eine Aussprache sucht:

1. **Deine eigene Aufnahme** (Aussprache-Studio) — hat immer Vorrang.
2. **Die mitgelieferte Aufnahme** aus der App.
3. **Die Systemstimme** des Handys — nur für Silben und Wörter, für die es
   keine Aufnahme gibt.

Unter **Klassenzimmer → „🔊 Ton prüfen"** siehst du für jeden Buchstaben, woher
der Ton gerade kommt, und kannst ihn direkt anhören. Dort steht auch, wie viele
Buchstaben du bereits mit deiner eigenen Stimme belegt hast.

## 🎙️ Aussprache-Studio (wenn du es selbst sprechen willst)

Die mitgelieferten Aufnahmen decken die **Buchstaben** ab. Für **Silben und
Wörter** (بَ، رَزَقَ) gibt es keine fertigen Aufnahmen — die spricht sonst die
Systemstimme, und die klingt nicht immer schön. Genau dafür ist das Studio da:

1. **Klassenzimmer** → Karte **„🎙️ Aussprache-Studio"** → „Öffnen".
2. Beim ersten 🎙️ fragt der Browser nach dem **Mikrofon** → erlauben.
3. Für jede Silbe: **🎙️ drücken → deutlich sprechen → ⏹ Stopp.** Die Aufnahme
   lädt automatisch hoch. Mit ▶️ probehören, mit 🎙️ überschreiben.
4. Ab sofort hören **alle Kinder auf allen Geräten deine Aufnahme** — beim
   Lernen, beim Aufdecken, im Duell und über die 🔊/🐢-Knöpfe.
5. Reihenfolge-Tipp: erst die Silben-Lektionen (Üstün/Esre/Ötre), dann Wörter —
   die Buchstaben sind ja schon fertig.

Einen einzelnen Buchstaben neu einsprechen geht am schnellsten über
**„✏️ Buchstaben & Silben bearbeiten"** → Karte suchen → 🎙️.

Einmal gehört, bleibt jede Aufnahme auf dem Gerät (offline nutzbar).

## 🕌 Auswendig lernen — das neue Herzstück (neu in 8.0)

**Feinschliff 12.08.2026:** Die kleinen Zwischenschritte (zuhören, nachsprechen,
puzzeln) unterbrechen nicht mehr mit einer ganzen Belohnungsseite — ein kurzes
Häkchen mit +XP, und nach einer Sekunde geht es von selbst beim nächsten Schritt
weiter. Oben zeigen vier kleine Symbole (👂🎤🧩🌟), auf welcher Stufe des Verses
das Kind gerade ist. Die große Feier gibt es weiterhin da, wo sie hingehört:
frei aufgesagt, Kette geschafft, ganze Sure. Außerdem behoben: Auf manchen
Geräten meldete die App fälschlich „keine arabische Stimme", obwohl eine da war
(der Browser meldet seine Stimmen erst verspätet) — deshalb wirkte das Zuhören
kaputt.

Der Weg dorthin: **Startseite → 🕌 Auswendig lernen** (oder *Meine Stapel →
„🕌 Auswendig lernen"*). Dahinter steckt bewusst ein **anderes System als die
Karteikarten**: Kinder lernen hier eine ganze Sure, nicht eine einzelne Karte.

**Die Leiter je Vers** — vier Stufen, immer in dieser Reihenfolge:

| Stufe | Was das Kind tut | Punkte |
|---|---|---|
| 👂 Hören & Mitlesen | zuhören, mitlesen — **Pflicht, aber ohne Punkte** | 0 |
| 🎤 Nachsprechen | laut nachsprechen — **gesprochen!** | +30 |
| 🧩 Wort-Puzzle | die Wörter in die richtige Reihenfolge tippen | +15 |
| 🌟 Aus dem Kopf | Text verdeckt, **frei aufsagen** | +75 |

**Punkte-Umbau 12.08.2026:** Fürs bloße Anhören gibt es nichts mehr — Punkte
gibt es erst, wenn das Kind **selbst spricht**. Zusammen bleibt es bei 120 XP
je Vers, nur die Verteilung folgt jetzt dem Sprechen.

**Danach die Kette** (die klassische Hafız-Methode): Vers 1+2 am Stück, dann
1+2+3 … je neue Kettenstufe +40. Zum Schluss die **ganze Sure am Stück** — dafür
gibt es die 🏆 Krone und den großen Bonus.

**Der Bonus wächst mit jeder Sure:** die erste fertige Sure bringt 200,
die zweite 300, die dritte 400 … die zehnte 1100 Punkte. Genau das war der
Wunsch „umso mehr die Kinder auswendig lernen, umso mehr Punkte". Damit ist
Auswendiglernen die punktestärkste Tätigkeit der ganzen App — eine komplette
Fâtiha bringt mit allen Stufen über 1000 Punkte.

**Auffrischung statt Vergessen:** Nach 1, 3, 7, 14 und dann alle 30 Tage fragt
die App: „Kannst du sie noch?" Einmal aufsagen genügt (+50). Wird eine Sure
überfällig, blasst ihre Kachel sanft aus — die Krone bleibt aber **immer**.

**Enthalten sind 18 Suren und Gebete**, in dieser Reihenfolge empfohlen:
Sübhâneke, Fâtiha, Kevser, İhlâs (die vier für den Namaz), dann Felak, Nâs,
Asr, Nasr, Kâfirûn, Fîl, Kureyş, Tebbet, Mâûn sowie Ettehiyyâtü, Allâhümme
salli, Allâhümme bârik und die beiden Rabbenâ-Duas. Jede hat einen Satz
„wofür brauchst du sie" und einen Merk-Tipp fürs Auswendiglernen.

## 🎤 Das Mikrofon — und was mit dem Ton passiert (neu in 8.0)

Beim Nachsprechen hört der Browser mit und vergleicht Wort für Wort. Er ist
dabei absichtlich großzügig: Zeichen über den Buchstaben, der Artikel „ال" und
kleine Abweichungen zählen nicht als Fehler. Ab **85 %** gibt es die vollen
Punkte, zwischen 60 und 85 % heißt es „fast — nochmal", darunter „hör nochmal
zu". Nach dem Sprechen sieht das Kind jedes Wort grün, gelb oder rot.

**Es geht immer auch ohne Mikrofon.** Firefox kennt die Spracherkennung nicht,
manche Kinder dürfen das Mikrofon nicht freigeben, und ohne Internet geht sie
auch nicht. Dann schaltet die App von selbst um:

- Statt „Nachsprechen" heißt es *laut mitlesen und bestätigen*.
- Statt „Aus dem Kopf" kommt das **Blind-Puzzle** (Wörter zusammensetzen, ohne
  den Vers vorher zu sehen — samt ein paar falscher Wörter zum Verwechseln).
- Statt der Kette werden die **Verse in die richtige Reihenfolge** gebracht.

Punkte gibt es dabei genauso viele. In der Klassenliste steht bei diesen
Kindern „🤝 selbst bestätigt" — dann weißt du, dass du einmal persönlich
abhören solltest.

**Datenschutz, ehrlich gesagt:** Die Spracherkennung ist die des Browsers.
Chrome schickt den Ton kurz zu Google, Safari zu Apple. Es wird nichts
gespeichert und **nichts an unseren Server geschickt**. Willst du das nicht,
schalte es ab: **Klassenzimmer → „🎤 Mikrofon beim Auswendiglernen" → Aus.**
Dann benutzt die App auf diesem Gerät nur noch die Puzzles.

## 🔁 Wiederholen: halbe, dann keine Punkte (neu in 8.0)

Eine Lektion, die auf 100 % steht, bleibt **für immer spielbar** — Üben soll nie
verboten sein. Aber sie wirft nicht endlos Punkte ab:

1. solange die Lektion noch nicht fertig ist → **volle** Punkte,
2. der erste komplette Durchgang danach → **halbe** Punkte,
3. jeder weitere Durchgang → **keine** Punkte.

Oben im Quiz steht dann in Klartext „🔁 Wiederholung — halbe Punkte" bzw.
„🔁 Nur zum Üben — keine Punkte mehr". Verbraucht wird eine Wiederholung erst
am **Ende** einer Runde; wer abbricht, verliert seine halbe Portion nicht.

### 🎙️ Gebete direkt in der Sure einsprechen (12.08.2026)

Die Suren aus dem Koran haben eine echte Internet-Rezitation. Die
**Namaz-Gebete** (Sübhâneke, Ettehiyyâtü, Salli, Bârik, Rabbenâ …) gibt es in
keiner Koran-Aufnahme — ohne deine Stimme bleibt dort nur die Computerstimme.

Deshalb siehst du als Lehrkraft jetzt direkt im Auswendiglernen:

- In der **Übersicht** einen Chip „🗣 Computerstimme" an jedem Gebet, das noch
  nicht eingesprochen ist (und „🎙️ deine Stimme", wenn alles da ist).
- In der Sure ein **Banner** („Dieses Gebet läuft noch mit der Computerstimme")
  mit dem Knopf **„🎙️ Jetzt selbst einsprechen"**.
- Einen eigenen Tab **„🎙️ Ton"**: Dort steht jeder Vers mit Status, und du
  kannst ihn **einsprechen (bis 30 Sekunden), probehören, übernehmen oder
  verwerfen** — und jederzeit **löschen**, dann gilt wieder die Rezitation bzw.
  Computerstimme. „▶️ So klingt es jetzt" spielt immer genau das, was die
  Kinder hören.

Deine Aufnahme spielt ab sofort **überall zuerst** — beim Zuhören, beim
Vormachen, in jeder Stufe, auch offline. Die Kinder sehen den Ton-Tab nicht.

### Wann sich der Bereich öffnet (12.08.2026)

Auswendiglernen ist bewusst **die Kür, nicht der Einstieg**: Wer eine Sure
auswendig lernt, soll sie vorher lesen können. Der Bereich öffnet sich deshalb
erst, wenn **alle 17 Lektionen einmal auf 100 %** stehen. Vorher sieht das Kind
kein stummes Schloss, sondern seinen Stand („12 von 17 Lektionen stehen auf
100 %") und die Liste dessen, was noch fehlt.

Damit gibt es eine klare Leiter durch die App:

| Stufe | Was dafür nötig ist |
|---|---|
| Die 17 Lektionen | von Anfang an offen, eine schaltet die nächste frei |
| 🕌 Auswendig lernen | **alles einmal** auf 100 % |
| ♾️ Unendlich-XP | **alles zweimal** durchgespielt |

Einmal offen, bleibt offen. Du als Lehrkraft siehst beides jederzeit.

### Ton, „nur Arabisch" und Tempo (nachgebessert am 11.08.2026)

Drei Dinge sind nach deinem Hinweis anders:

**1. Der Ton startet jetzt immer per Fingertipp.** Vorher spielte die App den
Vers von selbst an — und genau das blockieren Handys und iPads still, wenn kein
Fingertipp davor liegt. Es kam schlicht nichts. Jetzt steht dort ein Knopf
(„🔊 Vers anhören"), und die Reihenfolge der Tonquellen ist:

1. **deine eigene Aufnahme** aus dem Aussprache-Studio (liegt auf deinem Server, läuft offline),
2. die Rezitation aus dem Internet (Alafasy),
3. die Systemstimme des Geräts.

Klappt nichts davon, sagt die App das im Klartext, statt still zu bleiben —
inklusive Hinweis, dass du die Sure im Studio einsprechen kannst. **Genau dafür
stehen jetzt alle 75 Suren- und Gebetsteile im Aussprache-Studio.** Sprichst du
sie einmal ein, hören die Kinder ab dann dich — auf jedem Gerät, auch ohne
Internet.

**2. Beim Nachsprechen steht nur noch das Arabische da.** Umschrift und
Übersetzung gibt es in der Hör-Stufe. Wer sie beim Aufsagen braucht, kann sie mit
„👀 Umschrift" einblenden — dann zählt der Schritt aber nur halb. Wer mitliest,
liest; er sagt nicht auf.

**Nachgebessert am 12.08.2026 („die KI erkennt es nicht, wenn die Kinder es
richtig sagen"):** Die Bewertung ist jetzt deutlich näher an dem, was
Spracherkennungen wirklich liefern.

- **Verschmolzene und geteilte Wörter** werden repariert: „bismillâh" als ein
  Wort oder „wa bihamdik" als zwei zählen genauso wie richtig getrennt.
- **Kurze Bindewörter zählen weniger.** Ein verschlucktes „wa", „mâ" oder „rabbi"
  ist ein Fehler der Erkennung, keine Lücke im Kopf — ein ausgelassenes
  **Inhaltswort** (ab fünf Buchstaben) dagegen schon: dann heißt es „fast" und
  das Kind muss nochmal ran.
- **Die Schwelle richtet sich nach der Verslänge:** bei drei Wörtern 62 %, bei
  fünf 70 %, bei neun 76 %. Vorher galten starre 85 % — bei einem Drei-Wort-Vers
  ist ein einziges Wort schon ein Drittel, das war schlicht zu streng.
- Unter dem Ergebnis steht jetzt **„Verstanden: …"** — so siehst du sofort, ob
  das Kind falsch gesprochen hat oder ob der Browser es falsch verstanden hat.

**3. Es gibt ein Zeitfenster.** Jede Mikrofon-Aufgabe bekommt eine Zeit nach
Wortzahl (rund 2,2 Sekunden pro Wort plus 3 Sekunden Anlauf — großzügig, aber
Buchstabieren reißt es sicher). Während des Sprechens läuft ein Balken mit. Wer
richtig, aber zu langsam ist, liest: „🐌 Richtig — aber zu langsam. Das war eher
Lesen als Aufsagen" und bekommt **die halbe Punktzahl**.

Dieselbe Regel gilt jetzt überall im Auswendig-Bereich: **Volle Punkte für alles,
was die App wirklich prüfen kann** — flüssig ins Mikrofon gesprochen, Wort-Puzzle
gelöst, Verse richtig geordnet. **Halbe Punkte für alles, wo das Kind sich selbst
bewertet** oder eine Hilfe genutzt hat. Geschenkt gibt es nichts mehr.

**🎤 Nachsprech-Bonus — nur in Lektion 1:** Nach jeder Karte in
„1. Die Buchstaben" taucht ein kleiner Knopf auf: *„Sag ‚Elif‘ laut"*. Wer den
Namen des Buchstabens richtig sagt, bekommt +8 Punkte obendrauf. Freiwillig —
wer nicht mag, tippt einfach „Weiter".

Warum nur dort? Weil nur dort verlässlich prüfbar ist, was das Kind sagt: In
Lektion 1 nennt es den **Namen** des Buchstabens, also ein richtiges türkisches
Wort, das jede Spracherkennung sauber versteht (sie hört hier auf Türkisch zu,
nicht auf Arabisch). Ab Lektion 2 geht es um einzelne Silben wie بَ — die
erkennt keine Spracherkennung zuverlässig, und ein Bonus, der mal klappt und
mal nicht, ärgert Kinder mehr, als er sie anspornt. Der Vergleich ist bewusst
streng: „Be" und „Te" trennt genau ein Buchstabe, deshalb zählt nur der richtige
Name (plus ein paar übliche Schreibweisen wie „alif" für Elif) — und nie der
Name eines anderen Buchstabens.

## ♾️ Unendlich-XP: der letzte Modus (neu in 8.0)

Ganz am Ende der App wartet ein Modus, in dem **alles gleichzeitig** abgefragt
wird — kreuz und quer aus allen 17 Lektionen, mal wird das Zeichen gefragt, mal
der Name. Er heißt **Unendlich-XP**, weil hier die Punkte nie ausgehen: Fertige
Lektionen geben irgendwann nur noch die Hälfte und dann gar nichts mehr, dieser
Modus immer.

**Freigeschaltet wird er erst zum Schluss.** Jede der 17 Lektionen muss einmal
auf 100 % stehen **und** danach noch einen kompletten Durchgang gehabt haben —
also mindestens zweimal durchgespielt. Solange es noch nicht so weit ist, sieht
das Kind kein stummes Schloss, sondern genau, was noch fehlt: „5 von 17
Lektionen sind zweimal durch" und darunter die Liste. Einmal offen, bleibt es
offen. Du als Lehrkraft siehst den Modus immer (zum Vorführen).

**Wellen statt Runden.** Eine Welle sind 12 Fragen aus dem gesamten Stoff.
**Das reine Anfangs-Alphabet ist bewusst draußen** (12.08.2026): Lektion 1 „Die
Buchstaben" und Lektion 2 „Die Formen" sind Buchstaben-Benennen — wer diesen
Modus überhaupt erreicht hat, kann das längst, und es würde das Training nur
verwässern. Gefragt wird alles **ab Lektion 3**, also das echte Lesen: Harekeler,
Cezim, Şedde, Tenvin, die Dehnungen, Hemze und das Wort „Allah" — 374 Karten.
Wer die Grundlagen trotzdem mitnehmen will, schaltet sie mit einem Tipp dazu
(dann 432 Karten); alternativ gibt es „Nur Lesestücke" ohne Einzelsilben.

**Nachsitzen — das ist der Kern.** Jede falsch beantwortete Karte wandert in
einen Korb. Ist die Welle durch, geht es **nicht** weiter, bevor der Korb leer
ist: Jede Karte darin muss noch einmal richtig kommen, wer wieder danebenliegt,
sieht sie später erneut. Erst wenn alles sitzt, startet die nächste Welle. Nach
jeder falschen Antwort steht die richtige Lösung da, und die Aussprache wird
abgespielt — es ist also lernbar, nicht bloß eine Strafe.

**Punkte:**

| | |
|---|---|
| richtige Antwort | 12 XP × Wellenfaktor |
| Wellenfaktor | +10 % je abgeschlossener Welle, bis 2× |
| 5er-Serie | +25 XP |
| Welle ganz ohne Fehler | +60 XP |
| Welle mit Nachsitzen | +25 XP |
| richtig im Nachsitzen | 4 XP |

Bewusst weniger als die 17 XP einer normalen Lernfrage: **Neues zu lernen soll
sich mehr lohnen als zu trainieren** — dafür hört es hier nie auf.

**Der Karteikasten bleibt unberührt.** Dieser Modus ist eine Trainingshalle; er
verändert den Lernstand der Lektionen weder zum Guten noch zum Schlechten. Du
siehst die Trainingszahlen trotzdem: Im Klassenzimmer steht pro Kind, wie viele
Wellen es geschafft hat, die Trefferquote, die beste Serie — und die fünf
Karten, die **auch nach allem** noch am häufigsten danebengehen. Das ist die
ehrlichste Fehlerliste, die die App hat.

## 🔊 Sprachausgabe: verlässlich + Cezim repariert (12.08.2026)

**Warum es „oft mal nicht funktionierte":** Drei echte Ursachen, alle behoben.

1. **Ohne arabische Stimme blieb die App still.** Viele Geräte (besonders
   Schul-Tablets) haben gar keine arabische Systemstimme installiert. Jetzt
   gibt es eine **Ersatzstimme**: Die App spricht dann die **Umschrift** der
   Karte („be", „ab, ib, ub", „ra-hı-me") mit der türkischen — sonst deutschen
   — Stimme. Türkisch ist lautgetreu, das klingt für Elifba-Silben richtig,
   und eine türkische/deutsche Stimme hat praktisch jedes Gerät.
2. **Chrome verschluckt Sprachbefehle**, die zu schnell nach einem Abbruch
   kommen — jetzt mit kurzem Abstand und einem „Wachhund", der genau einmal
   nachschiebt, wenn nichts angelaufen ist.
3. **Chrome pausiert die Sprachausgabe beim Tab-Wechsel und bleibt pausiert.**
   Die App weckt sie jetzt beim Zurückkommen automatisch wieder auf.

**Cezim klingt jetzt richtig:** Geschlossene Silben mit Stopper (اَبْ) und die
Drills (اَبْ اِبْ اُبْ) kann **keine** arabische Computerstimme sauber sprechen —
sie buchstabiert oder nuschelt. Diese Karten nutzen deshalb immer die
Ersatzstimme mit der Lesung („ab, ib, ub") — klar und richtig. Noch besser
klingt natürlich deine eigene Aufnahme: Cezim-Karten lassen sich wie alles
andere in der **Werkstatt** einsprechen.

**Neu im „Ton prüfen"-Kasten (Klassenzimmer):** Zwei Chips zeigen sofort, ob
das Gerät eine arabische Stimme und eine Ersatzstimme hat, daneben zwei
Testknöpfe („be" und der Cezim-Drill). So siehst du in fünf Sekunden, woran
es auf einem bestimmten Gerät liegt.

## 🧠 Schwieriger, aber fair (12.08.2026)

Zwei Umbauten machen das Lernen überall im Kurs anspruchsvoller, ohne die
Kinder zu ärgern:

**1. Verwechsel-Antworten statt Zufallsantworten.** Die falschen Antworten
kommen jetzt zuerst aus der **Verwechsel-Familie** des Buchstabens — die
Geschwister mit demselben Grundkörper, die sich nur durch die Punkte
unterscheiden (ب ت ث ن ي · ج ح خ · د ذ · ر ز · س ش · ص ض · ط ظ · ع غ · ف ق).
Wer ب lernt, hat jetzt ت, ث, ن und ي als Auswahl daneben — man muss wirklich
hinschauen. Außerdem haben Koran-Fragen jetzt **fünf statt vier Antworten**.
Fair bleibt es: Die richtige Antwort ist immer dabei, und nach einem Fehler
kommt die Karte einfach wieder.

**2. Lektion 2 (Formen) hat zwei neue Übungsformen.** Neben dem Wort-Antippen
und dem Erraten der markierten Form gibt es jetzt:

- **„Wie sieht Be in der MITTE eines Wortes aus?"** — fünf verbundene Formen
  zur Auswahl, darunter ـتـ, ـثـ, ـنـ und ـيـ. Wer nur den Grundkörper kennt,
  kommt hier nicht durch.
- **Eine einzelne Form steht groß da** (z. B. ـبـ) — welcher Buchstabe ist das?
  Genau die Blickrichtung, die man beim echten Lesen braucht.

Der Anteil der Abruf-Karten („erst selbst denken, dann aufdecken") ist im
ganzen Kurs leicht erhöht.

## ✨ Drei neue Fragetypen (13.08.2026, Version 8.8)

Auf Wunsch der Lehrkraft („Nummer 1, 2 und 3 — generell überall") sind drei
neue, **prüfbare** Übungsformen im ganzen Koran-Kurs eingebaut:

**🎤 Lese-Check** (Wort-Lektionen): Das Wort steht groß da, das Kind liest es
**laut** vor — der Browser hört zu und prüft mit (dieselbe Technik wie beim
Suren-Nachsprechen). Flüssig gelesen = sauber gelöst mit vollen Punkten;
„👀 Lesung zeigen" oder erst der zweite Anlauf zählt wie eine Auswahl-Frage
mit Fehlversuch (Karte kommt wieder). Kann das Gerät nicht zuhören, erscheint
der Lese-Check gar nicht erst; hakt das Mikrofon, bietet die Karte
„🔤 Lieber antippen" als Ausweich-Auswahl an.

**🔗 Paare verbinden** (überall): Vier Karten derselben Lektion — links
Arabisch, rechts die Lesung bzw. der Name. Links antippen, rechts das
Passende. Die falschen Kandidaten sind wie immer Verwechsel-Geschwister.
Bis zu ein Fehlversuch bleibt sauber, ab zwei kommt die Karte später erneut.

**🧱 Wort-Baukasten** (Wort-Lektionen): Die Lesung steht oben („ke · te · be"),
das Kind baut das arabische Wort aus Silben-Kacheln zusammen — von **rechts
nach links**, wie Arabisch wirklich funktioniert. Zwei Kacheln sind Fallen
aus der Verwechsel-Familie. Am Ende erscheint das fertige Wort samt Ton.

Der Mix pro Karte: Buchstaben/Silben ≈ 35 % „Wo ist …?", 20 % Paare, Rest
Auswahl · Wörter ≈ 28 % „Errate das Wort", je ~18 % Lese-Check und Baukasten,
~14 % Paare, Rest Auswahl. Alle drei passen ohne Scrollen auf kleine Handys.

## 🧹 Schlanker Fragen-Mix + kleine Handys (13.08.2026, Version 8.7)

Auf Wunsch der Lehrkraft wurde der Fragen-Mix im Koran-Kurs ausgemistet und
das Layout für kleine Handys überarbeitet:

**Raus sind:**

- das **Regel-Intro** vor jeder Lektion (über ℹ️ in der Kopfzeile weiterhin
  freiwillig abrufbar),
- die **Lehrkarten** vor jeder neuen Karte (neue Karten kommen direkt als
  Frage — der Name steht in den Antworten, 🔊 spielt den Klang). Die
  **Formen-Lehrkarte in Lektion 2 bleibt**,
- der **Abruf für Buchstaben und einzelne Silben** („Errate den Buchstaben/
  die Silbe" mit Ja/Vage/Nein). Für **echte Wörter bleibt „Errate das Wort"
  überall erhalten** — laut lesen ist der Kern der Wort-Lektionen,
- die **Blitzfragen** im Koran-Kurs (in eigenen Stapeln gibt es sie weiter),
- **beide Hör-Auswahlen** der Silben-Lektionen („passendes Audio wählen" und
  „richtige Schrift wählen") — sie hingen an der unzuverlässigen
  Computerstimme,
- in Lektion 2 das selbstbewertete „Errate den hervorgehobenen Buchstaben".

**Neu dafür:** Die Silben-Lektionen arbeiten jetzt wie Lektion 1 — zusätzlich
zur Auswahl-Frage gibt es **„Wo ist ‚be'?"**: Die Lesung steht da, gewählt
wird unter fünf Silben mit gleicher Harekat, die falschen sind
Geschwister-Silben (تَ ثَ نَ يَ zu بَ). 🔊 auf der Karte spielt den Klang.

**Kleine Handys:** Auf kurzen Displays (unter ~760 px Höhe) schrumpfen
Fragekarte, Schrift und Antwort-Knöpfe automatisch so weit, dass **alles ohne
Scrollen** auf den Bildschirm passt — Bestätigen/Weiter sind immer sofort
erreichbar. Geprüft bis hinunter zu 320 × 568 (altes iPhone SE).

## 🗂 Suren & Gebete direkt in „Meine Stapel" (12.08.2026)

Die Kinder müssen nicht mehr suchen: Unter **Meine Stapel** steht jetzt der
Abschnitt **„🕌 Suren & Gebete — Auswendig lernen"** mit allen 18 Suren und
Gebeten als eigene Kacheln — mit Fortschrittsbalken, 🏆 bei auswendig, ⭐ bei
den vier Namaz-Suren und dem Hinweis „🔁 Auffrischung fällig". Eine Kachel
antippen öffnet die Sure direkt. Solange der Bereich noch gesperrt ist, zeigen
die Kacheln das Schloss und den Stand.

## 🤝 „Unsere Klasse": sich gegenseitig anspornen (neu in 8.0)

Auf der Seite **Fortschritt** steht ab sofort eine Klassen-Karte. Die Kinder
sehen dort einander — aber nur das, was anspornt, nichts Persönliches.

**1. Das gemeinsame Ziel steht oben.** „🏆 5 von 10 Suren auswendig" und
„🔥 1740 von 2000 XP diese Woche", jeweils mit Balken für die ganze Klasse. In
einer Koranklasse soll nicht der Beste gewinnen, sondern jeder weiterkommen —
deshalb zuerst das, was alle zusammen schaffen.

**2. Die Wochen-Tafel zählt nur die letzten 7 Tage**, nicht die Gesamtpunkte.
Wer neu dazukommt oder eine Woche gefehlt hat, kann sofort wieder vorne
mitspielen; niemand ist dauerhaft abgehängt. Daneben gibt es die Tafel
**🏆 Auswendig** — wer wie viele Suren kann.

**3. Ein persönlicher Anstupser.** Direkt über der Tafel steht, wer unmittelbar
vor dem Kind liegt: *„👀 Deniz ist diese Woche nur 140 XP vor dir — eine Runde,
und du bist vorbei!"* Das ist erfahrungsgemäß der stärkste Motivator, weil das
Ziel immer erreichbar ist. Wer führt, sieht stattdessen, wer ihm im Nacken sitzt.

**4. Anfeuern.** Neben jedem Mitschüler steht ein 💪-Knopf. Antippen, eins von
vier Zeichen wählen — **💪 Du schaffst das! · 👏 Maschallah! · 🔥 Stark! ·
🤲 Ich bete für dich** — fertig. Der andere sieht es beim nächsten Öffnen auf
der Startseite („Ayla und Cemre feuern dich an!").

Bewusst gibt es **keinen freien Text**: Es sind nur diese vier Zeichen möglich,
also kann hier niemand etwas Gemeines schreiben. Und pro Mitschüler und Tag sind
drei Zurufe erlaubt, damit es Ansporn bleibt und nicht Spam wird.

**Was die Kinder NICHT voneinander sehen:** keine Fehler, keine
Schwachstellen-Liste, keine Lektionsdetails, keine „zuletzt gesehen"-Zeiten. Der
Server liefert an Kinder nur Name, Punkte, Level, Serie, Gesamtfortschritt und
die Zahl der auswendig gelernten Suren. Alles Weitere bekommt weiterhin
ausschließlich das Klassenzimmer mit dem Lehrer-Passwort.

## ⚙️ Einstellungen, Hilfe & Konto (neu in 7.5)

- **Hilfe** und **Kontakt** sind jetzt echte Seiten mit Antworten auf die
  häufigsten Fragen (Anmelden, Lernen, Duell, Installieren, kein Ton).
- **Konto & Sicherheit**: zeigt Name, Rolle, Gruppe und Abgleich-Zustand.
  Dort kannst du ein **Geheimwort setzen, ändern oder entfernen** und dein
  Konto endgültig löschen. Vorher stand dort „bitte anmelden", obwohl man
  angemeldet war — das lag an Resten der alten Supabase-Anmeldung.
- **Freunde einladen** teilt jetzt einfach die Adresse der App.

## 📲 Als App installieren

- **Android:** blaues Banner auf der Startseite → „Installieren“.
  Alternativ Browser-Menü ⋮ → „App installieren“.
- **iPhone/iPad:** Safari → Teilen-Symbol → **„Zum Home-Bildschirm“**.
- Auch in **Einstellungen → „📲 Als App installieren“**.

## 🛟 Was Version 7 gegen „Not found“ tut

Früher fragte die App starr die Adresse `/api/...`. Fehlte auf der Netlify-Seite
die Umleitung dorthin, antwortete Netlify mit seiner eigenen Fehlerseite — und
in der App stand das nackte **„Not found“**. Jetzt gilt:

- Die App probiert **drei Adressen** durch (`/api/…`, `/.netlify/functions/sync/…`
  und `…?r=…`) und merkt sich die, die antwortet. Eine fehlende Umleitung fällt
  gar nicht mehr auf.
- Der Mini-Server braucht **kein einziges npm-Paket** mehr. Er läuft deshalb
  auch bei Drag-&-Drop-Uploads, bei denen Netlify keinen Build ausführt.
- Antwortet trotzdem nichts, wird das Kind **still lokal angemeldet** und kann
  sofort lernen. Sobald der Server da ist, verwandelt sich das Konto von selbst
  in ein richtiges und der Fortschritt wandert hoch — ohne dass jemand etwas tun
  muss.
- Für dich gibt es **„🔧 Verbindung prüfen“** (im Profil und im Klassenzimmer):
  zeigt jede geprüfte Adresse, den Speicherzustand und die genaue Anleitung.

## 🎮 Altes Supabase-Duell (nicht mehr nötig)

Das frühere Echtzeit-Duell über Supabase ist überflüssig geworden — das neue
Live-Duell läuft über euren eigenen Server. Der Supabase-Zugang unter
„⚙️ Experten" im Anmelde-Fenster bleibt nur für alte Einrichtungen erhalten
und kann ignoriert werden.

## 🤖 Optional: KI-Erklärungen (Gemini)

https://aistudio.google.com/apikey → kostenlosen Key erstellen → bei Netlify
unter **Site settings → Environment variables** als `GEMINI_API_KEY` eintragen
→ neu deployen.

## 🛡️ Warum kein Kind mehr „verschwinden" kann (7.6)

Am 09.08. trat einmal die Meldung **„Serverfehler: Speicher-Lesefehler 401"**
auf, und die Klassenliste war leer. Die Ursache lag tief im Mini-Server:
Netlify reicht bei jedem Aufruf einen **frischen, kurzlebigen Schlüssel** für
den Speicher durch. Der Server hatte sich den allerersten Schlüssel gemerkt
und für immer weiterbenutzt — solange derselbe Prozess warmlief, ging das gut;
lief der Schlüssel ab, wurde ab da **jede** Anfrage abgewiesen.

Drei Dinge sind seitdem anders:

1. Der Schlüssel wird bei **jedem** Aufruf frisch gelesen.
2. Wird er trotzdem einmal abgewiesen, holt der Server **automatisch einen
   neuen und wiederholt die Anfrage**.
3. Das Klassenzimmer zeigt bei einer Störung den **zuletzt bekannten Stand**
   mit einem Hinweis, statt eine leere Liste anzuzeigen. Auch nach einem
   Neuladen bleibt die Klasse sichtbar.

Wichtig zu wissen: **Bei so einem Fehler geht nie etwas verloren.** Konten,
Fortschritt und Aufnahmen liegen unverändert im Speicher — nur der Zugang
dorthin war kurzzeitig blockiert.

## Stolpersteine

- **„Es hat sich nichts geändert“** → fast immer läuft noch die alte Version:
  Profil → Anmelde-/Konto-Fenster → ganz unten muss
  **„Version 7.6 · 09.08.2026“** stehen. Sonst „🔄 App aktualisieren“ drücken.
- **Klassenzimmer bleibt leer** → auf „🔧 Verbindung prüfen“ tippen. Steht dort
  grün „Alles in Ordnung“, hat sich schlicht noch kein Kind angemeldet.
- **„Speicher-Lesefehler" / „Zugang abgelehnt"** → seit 7.6 heilt sich das
  von selbst. Bleibt es stehen: Seite in Netlify einmal neu veröffentlichen.
  Die Daten sind davon nicht betroffen.
- **„Speicher nur vorübergehend“** in der Prüfung → der Server läuft, kann aber
  nicht dauerhaft speichern. Seite bei Netlify einmal neu deployen; in den
  Site-Einstellungen muss **Blobs** verfügbar sein.
- **Zwei Kinder heißen gleich** → das zweite Kind hängt eine Zahl an
  (z. B. „Amina 2“) oder das erste legt unter „▾ Mehr“ ein Geheimwort fest.
