// KI-Tutor-Backend für die neue lern-34a-App.
// 1:1 aus der bestehenden §34a-Lernplan-App übernommen (netlify/functions/tutor.mjs):
// nimmt { prompt, model } vom Client entgegen, ruft serverseitig die Gemini-API mit
// einem in Netlify hinterlegten Umgebungsvariablen-Key auf und gibt { text } zurück.
//
// Ohne diese Datei (bzw. ohne gesetzte Umgebungsvariable) bleibt der "Erklären"-Button
// im Quiz auf echtem Netlify stumm — der Client rief vorher window.claude.complete()
// auf, das nur in der Claude-eigenen Vorschau existiert.
//
// Setup in Netlify: Site settings -> Environment variables -> GEMINI_API_KEY setzen
// (Key erzeugen unter https://aistudio.google.com/apikey).

function json(o, s) {
  return new Response(JSON.stringify(o), { status: s || 200, headers: { "content-type": "application/json; charset=utf-8" } });
}

/* ==============================================================
   SCHUTZ VOR FREMDNUTZUNG (14.09.2026)

   Diese Funktion rief bisher mit Nuris hinterlegtem Gemini-Schluessel jeden
   beliebigen Text ab, den irgendjemand hineinschickte — ohne Anmeldung, ohne
   Begrenzung, ohne Laengenpruefung. Wer die Adresse kannte, konnte den
   Schluessel auf fremde Rechnung leerlaufen lassen.

   Drei einfache Bremsen, die den Kindern nicht im Weg stehen:
     1. Die Anfrage muss von der eigenen Seite kommen (Origin/Referer).
     2. Der Text ist auf 2.000 Zeichen begrenzt — eine Karten-Erklaerung
        braucht ein Zehntel davon.
     3. Hoechstens 20 Anfragen je Absender und Stunde, und 300 je laufender
        Instanz. Das reicht fuer eine Klasse und stoppt ein Skript.

   Das ersetzt keine Anmeldung. Wenn die KI-Funktionen wirklich gestrichen
   bleiben (Nuris Planwechsel), ist das Richtige, diese Datei und
   GEMINI_API_KEY in Netlify ganz zu entfernen — das ist seine Entscheidung.
   ============================================================== */
const ZAEHLER = new Map();          // Absender -> { n, bis }
let GESAMT = { n: 0, bis: 0 };
const STUNDE = 3600000;

function zuOft(absender) {
  const jetzt = Date.now();
  if (jetzt > GESAMT.bis) GESAMT = { n: 0, bis: jetzt + STUNDE };
  if (++GESAMT.n > 300) return true;
  const e = ZAEHLER.get(absender);
  if (!e || jetzt > e.bis) { ZAEHLER.set(absender, { n: 1, bis: jetzt + STUNDE }); return false; }
  e.n++;
  if (ZAEHLER.size > 500) ZAEHLER.clear();          // Speicher nicht volllaufen lassen
  return e.n > 20;
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);

  /* Nur von der eigenen Seite. Ein Browser setzt Origin bei POST immer; fehlt
     er ganz, kommt die Anfrage nicht aus einer Seite, sondern aus einem
     Werkzeug. */
  const eigen = new URL(req.url).host;
  const woher = req.headers.get("origin") || req.headers.get("referer") || "";
  let fremd = true;
  try { fremd = !woher || new URL(woher).host !== eigen; } catch (e) { fremd = true; }
  if (fremd) return json({ error: "Diese Funktion gehört zur App und lässt sich nicht von außen aufrufen." }, 403);

  const absender = req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "?";
  if (zuOft(absender)) return json({ error: "Gerade zu viele Anfragen — bitte später noch einmal." }, 429);

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return json({ error: "Server-Konfiguration fehlt: GEMINI_API_KEY ist in Netlify nicht gesetzt (Site settings → Environment variables)." }, 500);
  }

  const b = await req.json().catch(() => null);
  const prompt = b && typeof b.prompt === "string" ? b.prompt : "";
  if (!prompt.trim()) return json({ error: "Kein Prompt übergeben." }, 400);
  if (prompt.length > 2000) return json({ error: "Die Frage ist zu lang." }, 400);

  let model = (b && typeof b.model === "string" && b.model.trim()) || "gemini-2.5-flash";
  if (model === "gemini-2.0-flash") model = "gemini-2.5-flash"; // abgekündigtes Modell automatisch ersetzen

  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(key);

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 8192 },
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: (j.error && j.error.message) || ("Gemini " + r.status) }, 502);
    const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
    const text = parts.map((p) => (p && p.text) ? p.text : "").join("").trim() || "(keine Antwort)";
    return json({ text });
  } catch (e) {
    return json({ error: "server", detail: String((e && e.message) || e) }, 500);
  }
};
