# 🔗 Einmal einrichten: GitHub + Netlify (ca. 10 Minuten)

Danach lädst du Updates **nie wieder** irgendwo hin — du ersetzt die Dateien
einmal auf GitHub, und Netlify baut und veröffentlicht die Seite von selbst.
**Nur so installiert Netlify auch den Mini-Server** (Anmelden, Geräte-Abgleich,
Klassenzimmer). Beim Ziehen von Dateien auf die „Deploys"-Seite läuft kein
Build — deshalb konnte es bisher gar nicht klappen.

Du brauchst: einen Computer (nicht Handy), die ZIP-Datei, 10 Minuten.

---

## Schritt 1 — ZIP entpacken

Doppelklick auf die ZIP-Datei. Es entsteht ein Ordner. Öffne ihn: Darin muss
**`index.html` direkt** liegen (daneben `app`, `netlify`, `netlify.toml`, …).
Diesen Ordner offen lassen.

## Schritt 2 — GitHub-Konto (falls noch keins)

1. **github.com** öffnen → **Sign up** → E-Mail, Passwort, Benutzername.
2. Kostenlos, keine Zahlungsdaten. E-Mail bestätigen.

## Schritt 3 — Ablage („Repository") anlegen

1. Oben rechts auf **+** → **New repository**.
2. **Repository name:** `elif-und-ba`
3. **Public** ausgewählt lassen. Sonst nichts ankreuzen (kein README!).
4. **Create repository**.

## Schritt 4 — Dateien hochladen

1. Auf der leeren Seite steht ein Link **„uploading an existing file"** —
   darauf klicken. (Alternativ: **Add file → Upload files**.)
2. Im entpackten Ordner **alles markieren** (Strg+A bzw. Cmd+A) — also alle
   Dateien **und** die Ordner `app`, `vendor`, `netlify`, `assets`, `fonts`.
3. Alles in das große Feld im Browser ziehen. Warten, bis die Liste vollständig
   ist (99 Dateien).
4. Unten auf **Commit changes** klicken.

> Wichtig: Nicht den äußeren Ordner ziehen, sondern **seinen Inhalt**.
> Nach dem Hochladen muss `index.html` in der Dateiliste ganz oben stehen.

## Schritt 5 — Netlify mit GitHub verbinden

1. **app.netlify.com** öffnen → **Add new site** → **Import an existing project**.
2. **Deploy with GitHub** → GitHub-Konto autorisieren.
3. Bei „Pick a repository" das eben angelegte **`elif-und-ba`** auswählen.
4. Die Bau-Einstellungen liest Netlify aus der mitgelieferten Datei
   `netlify.toml` — du musst nichts eintragen. Falls doch gefragt wird:
   - **Build command:** `echo build`
   - **Publish directory:** `.`
   - **Functions directory:** `netlify/functions`
5. **Deploy** klicken und warten, bis **„Published"** erscheint.

## Schritt 6 — Prüfen

Die neue Adresse öffnen (z. B. `zufallsname-1234.netlify.app`) und dahinter
**`/check.html`** anhängen. Dort muss oben grün stehen:

> ✅ Alles in Ordnung — Der Klassen-Server läuft (Version 7.5), Speicher: dauerhaft ✓

Dann: zurück zur App, **Anmelden**, Namen eintippen — fertig. Im Klassenzimmer
(Lehrer-Passwort `1907`) erscheint jedes Kind automatisch.

## Schritt 7 — Schöne Adresse (optional)

In Netlify: **Site configuration → Change site name** → z. B. `elif-be`.
Die Adresse lautet dann `elif-be.netlify.app`. Die alte Netlify-Seite kannst
du danach löschen (**Site configuration → Delete this site**), damit die Kinder
nicht versehentlich die alte öffnen.

---

## Ab jetzt: Update in 1 Minute

Neue ZIP von mir → entpacken → auf GitHub ins Repository gehen →
**Add file → Upload files** → Inhalt hineinziehen → **Commit changes**.
Netlify baut automatisch neu. Nach ein bis zwei Minuten ist die neue Version
online; die App holt sie sich beim nächsten Öffnen von selbst.

## Wenn etwas klemmt

- **Netlify meldet „Build failed"** → im Deploy-Protokoll die letzte rote Zeile
  kopieren und mir schicken.
- **`/check.html` bleibt rot** → Screenshot davon schicken. Dort steht jede
  geprüfte Adresse mit Statuscode.
- **GitHub lädt nicht alle Dateien hoch** → die Weboberfläche schafft 100
  Dateien pro Vorgang; dieses Paket hat bewusst nur 99. Falls doch etwas fehlt,
  einfach nochmal **Add file → Upload files** für den fehlenden Ordner.
