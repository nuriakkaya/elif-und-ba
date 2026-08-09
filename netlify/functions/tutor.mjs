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

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return json({ error: "Server-Konfiguration fehlt: GEMINI_API_KEY ist in Netlify nicht gesetzt (Site settings → Environment variables)." }, 500);
  }

  const b = await req.json().catch(() => null);
  const prompt = b && typeof b.prompt === "string" ? b.prompt : "";
  if (!prompt.trim()) return json({ error: "Kein Prompt übergeben." }, 400);

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
