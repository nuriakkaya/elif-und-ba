# 🌙 Elif & Ba — Einrichtung & Update (Version 7.4)

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

## 🎙️ Aussprache-Studio (sehr empfohlen!)

Die wichtigste Zutat ist die richtige Aussprache — und die kommt am besten von
DIR statt von einer Computerstimme:

1. **Klassenzimmer** → Karte **„🎙️ Aussprache-Studio“** → „Öffnen“.
2. Beim ersten 🎙️ fragt der Browser nach dem **Mikrofon** → erlauben.
3. Für jede Silbe: **🎙️ drücken → deutlich sprechen → ⏹ Stopp.** Die Aufnahme
   lädt automatisch hoch. Mit ▶️ probehören, mit 🎙️ überschreiben.
4. Ab sofort hören **alle Kinder auf allen Geräten deine Aufnahme** — beim
   Lernen, beim Aufdecken und über die 🔊/🐢-Knöpfe (🐢 = langsam, ohne dass
   sich die Stimme verändert).
5. Reihenfolge-Tipp: erst die Silben-Lektionen (Üstün/Esre/Ötre), dann Wörter —
   die 29 Buchstaben haben bereits echte Aufnahmen.

Einmal gehört, bleibt jede Aufnahme auf dem Gerät (offline nutzbar).

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

## Stolpersteine

- **„Es hat sich nichts geändert“** → fast immer läuft noch die alte Version:
  Profil → Anmelde-/Konto-Fenster → ganz unten muss
  **„Version 7.4 · 09.08.2026“** stehen. Sonst „🔄 App aktualisieren“ drücken.
- **Klassenzimmer bleibt leer** → auf „🔧 Verbindung prüfen“ tippen. Steht dort
  grün „Alles in Ordnung“, hat sich schlicht noch kein Kind angemeldet.
- **„Speicher nur vorübergehend“** in der Prüfung → der Server läuft, kann aber
  nicht dauerhaft speichern. Seite bei Netlify einmal neu deployen; in den
  Site-Einstellungen muss **Blobs** verfügbar sein.
- **Zwei Kinder heißen gleich** → das zweite Kind hängt eine Zahl an
  (z. B. „Amina 2“) oder das erste legt unter „▾ Mehr“ ein Geheimwort fest.
