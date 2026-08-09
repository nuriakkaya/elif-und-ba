// Website-Link-Import (Blueprint Phase 4, sechste Quelle). Anders als
// PDF/Word/PowerPoint MUSS das serverseitig passieren: ein Browser-fetch()
// auf eine beliebige fremde Website scheitert praktisch immer an CORS
// (die Zielseite müsste explizit unsere Origin erlauben, tut sie nie).
// Nimmt { url } vom Client entgegen, holt die Seite serverseitig, entfernt
// <script>/<style>/Tags grob per Regex (kein DOM im Serverless-Umfeld nötig,
// spart eine schwere HTML-Parser-Abhängigkeit) und gibt den reinen Text
// zurück. Der Client schickt den Text danach wie bei "Notizen" an
// generateCardsFromText — diese Function generiert selbst keine Karten.

function json(o, s) {
  return new Response(JSON.stringify(o), { status: s || 200, headers: { "content-type": "application/json; charset=utf-8" } });
}

// Grober Schutz gegen SSRF auf interne/private Adressen. Kein vollständiger
// DNS-Rebinding-Schutz (dafür bräuchte es eine Resolve-vor-Fetch-Prüfung mit
// fixiertem IP-Ziel) — für dieses Einzelnutzer-Lernapp-Szenario ausreichend,
// aber bewusst kein Ersatz für eine echte Produktions-Absicherung.
function isBlockedHost(hostname) {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local")) return true;
  if (/^127\./.test(h) || h === "0.0.0.0" || h === "::1") return true;
  if (/^10\./.test(h) || /^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true; // Cloud-Metadata-Adressen
  return false;
}

function htmlToText(html) {
  let s = html;
  s = s.replace(/<script[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  s = s.replace(/<(br|p|div|li|h[1-6]|tr)[^>]*>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  s = s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return s;
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const b = await req.json().catch(() => null);
  const rawUrl = b && typeof b.url === "string" ? b.url.trim() : "";
  if (!rawUrl) return json({ error: "Keine URL übergeben." }, 400);

  let target;
  try {
    target = new URL(rawUrl);
  } catch (e) {
    return json({ error: "Das ist keine gültige URL." }, 400);
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return json({ error: "Nur http/https-Links werden unterstützt." }, 400);
  }
  if (isBlockedHost(target.hostname)) {
    return json({ error: "Diese Adresse kann nicht abgerufen werden." }, 400);
  }

  try {
    const r = await fetch(target.toString(), {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; lern-34a-import/1.0)" },
    });
    if (!r.ok) return json({ error: "Seite antwortete mit " + r.status }, 502);
    const contentType = r.headers.get("content-type") || "";
    if (!contentType.includes("html") && !contentType.includes("text")) {
      return json({ error: "Diese Adresse liefert keinen lesbaren Seiteninhalt (kein HTML/Text)." }, 400);
    }
    const raw = await r.text();
    const capped = raw.slice(0, 800000); // Sicherheitsgrenze gegen extrem große Seiten
    const text = htmlToText(capped).slice(0, 20000);
    if (text.length < 40) {
      return json({ error: "Auf dieser Seite wurde kein brauchbarer Text gefunden." }, 400);
    }
    return json({ text });
  } catch (e) {
    return json({ error: "Seite konnte nicht abgerufen werden.", detail: String((e && e.message) || e) }, 500);
  }
};
