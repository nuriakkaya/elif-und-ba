/* ==============================================================
   YouTube-Transkript-Import (Blueprint Phase 4, siebte Quelle).
   Es gibt keine offizielle, schlüsselfreie API für Untertitel-Text —
   diese Function nutzt denselben öffentlich sichtbaren Weg, den ein
   abgemeldeter Browser beim Aufruf einer Video-Seite auch geht: die
   Wiedergabeseite liefert im eingebetteten "ytInitialPlayerResponse" eine
   Liste der verfügbaren Untertitel-Spuren ("captionTracks") inkl. einer
   Text-URL pro Spur. Es werden nur Daten gelesen, die auch ein normaler
   Seitenaufruf im Browser sehen würde (keine Anmeldedaten, keine private
   API, kein Umgehen von Zugriffsbeschränkungen) — funktioniert deshalb nur
   bei Videos, die öffentlich abspielbar sind und Untertitel haben.
   ============================================================== */
function json(o, s) {
  return new Response(JSON.stringify(o), { status: s || 200, headers: { "content-type": "application/json; charset=utf-8" } });
}

function extractVideoId(input) {
  const s = String(input || "").trim();
  let m = s.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  m = s.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  m = s.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  m = s.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  return null;
}

function decodeEntities(s) {
  return String(s || "")
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCharCode(parseInt(n, 10)); } catch (e) { return ""; } })
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

// Findet zu einem JSON-Schlüssel das zugehörige Array im rohen HTML/JS-Text,
// per Klammer-Zählung (statt einem naiven, bei verschachtelten Objekten
// unzuverlässigen Regex-Greedy-Match).
function extractJsonArrayAfterKey(text, key) {
  const idx = text.indexOf('"' + key + '":');
  if (idx === -1) return null;
  const i = text.indexOf("[", idx);
  if (i === -1) return null;
  let depth = 0, inStr = false, esc = false;
  for (let j = i; j < text.length; j++) {
    const ch = text[j];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === "[") depth++;
    else if (ch === "]") { depth--; if (depth === 0) return text.slice(i, j + 1); }
  }
  return null;
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const b = await req.json().catch(() => null);
  const rawUrl = b && typeof b.url === "string" ? b.url.trim() : "";
  const videoId = extractVideoId(rawUrl);
  if (!videoId) return json({ error: "Keine gültige YouTube-Video-URL oder -ID erkannt." }, 400);

  const ua = { "User-Agent": "Mozilla/5.0 (compatible; lern-34a-import/1.0)", "Accept-Language": "de-DE,de;q=0.9,en;q=0.5" };
  let pageHtml;
  try {
    const pageRes = await fetch("https://www.youtube.com/watch?v=" + videoId + "&hl=de", { headers: ua });
    if (!pageRes.ok) return json({ error: "Video-Seite antwortete mit " + pageRes.status + " (privates/gelöschtes/regional gesperrtes Video?)." }, 502);
    pageHtml = await pageRes.text();
  } catch (e) {
    return json({ error: "Video-Seite konnte nicht abgerufen werden.", detail: String((e && e.message) || e) }, 500);
  }

  const tracksText = extractJsonArrayAfterKey(pageHtml, "captionTracks");
  if (!tracksText) return json({ error: "Für dieses Video wurden keine Untertitel gefunden (privat, eingeschränkt oder keine Untertitel vorhanden)." }, 400);

  let tracks;
  try { tracks = JSON.parse(tracksText); } catch (e) { return json({ error: "Untertitel-Liste konnte nicht gelesen werden." }, 500); }
  if (!Array.isArray(tracks) || !tracks.length) return json({ error: "Für dieses Video wurden keine Untertitel gefunden." }, 400);

  const track = tracks.find((t) => t && t.languageCode === "de")
    || tracks.find((t) => t && typeof t.languageCode === "string" && t.languageCode.startsWith("en"))
    || tracks[0];
  if (!track || !track.baseUrl) return json({ error: "Kein nutzbarer Untertitel-Track gefunden." }, 400);

  let xml;
  try {
    const capRes = await fetch(track.baseUrl, { headers: ua });
    if (!capRes.ok) return json({ error: "Untertitel konnten nicht geladen werden (" + capRes.status + ")." }, 502);
    xml = await capRes.text();
  } catch (e) {
    return json({ error: "Untertitel konnten nicht geladen werden.", detail: String((e && e.message) || e) }, 500);
  }

  const parts = [];
  const re = /<text[^>]*>([\s\S]*?)<\/text>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const seg = decodeEntities(m[1]).replace(/\n/g, " ").trim();
    if (seg) parts.push(seg);
  }
  const text = parts.join(" ").replace(/[ \t]+/g, " ").trim().slice(0, 20000);
  if (text.length < 40) return json({ error: "Aus den Untertiteln konnte kein brauchbarer Text extrahiert werden." }, 400);

  return json({ text, videoId, languageCode: track.languageCode || "" });
};
