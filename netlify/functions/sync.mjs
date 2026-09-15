/* ============================================================================
   Elif & Ba — Klassen-Server (Version 7)
   ---------------------------------------------------------------------------
   WICHTIGSTE ÄNDERUNG GEGENÜBER VERSION 6:
   Diese Datei ist jetzt KOMPLETT EIGENSTÄNDIG. Sie importiert NICHTS aus npm
   (früher: "@netlify/blobs"). Grund: Wer die App per Drag & Drop zu Netlify
   hochlädt, hat keinen Build-Schritt — und ohne Build wird "npm install" nie
   ausgeführt. Die Funktion stürzte dann beim Start ab bzw. war gar nicht
   erreichbar → im Browser stand "Not found".
   Jetzt sprechen wir den Netlify-Blobs-Speicher direkt über seine HTTP-
   Schnittstelle an (Zugangsdaten liefert Netlify im Environment mit).
   Es bleiben nur node:-Bordmittel (crypto, zlib, buffer, fs).

   ROUTEN (funktionieren unter BEIDEN Adressen —
   /api/xxx  und  /.netlify/functions/sync/xxx  und zusätzlich  ?r=xxx):

     GET  ping    → { ok, version, storage }        Selbsttest der App
     POST auth    → { action:'check'|'register'|'login'|'list' , … }
     GET  sync    ?key=…                            eigener Spielstand
     POST sync    { key, col, baseRev, summary }    speichern + Klassenmeldung
     GET  klasse  ?code=1234                        Klassenzimmer nachschlagen (11.0)
     POST klasse  { action:'create'|'login'|'rename', … }   anlegen / öffnen
     GET  class   ?tpw=<EB_LEHRER_PW>[&code=…] | ?code=…&pin=… Klassenliste (Lehrkraft)
     POST class   { … }                             Kurzmeldung / entfernen
     GET  audio   ?list=1 | ?k=…                    Aussprache-Aufnahmen
     POST audio   { action:'put'|'del', tpw, … }
     GET  media/audio ?k=…                          dasselbe, aber cachebar
============================================================================ */

import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { Buffer } from "node:buffer";

const VERSION = "10.5";
/* LEHRER-PASSWORT — NICHT MEHR IM CODE. (14.09.2026)

   Hier stand ein festes vierstelliges Passwort im Klartext. Dieselbe Zeile stand in
   app/simplesync.js und wurde damit ins öffentliche Bündel gebaut: Wer
   https://elif-be.de/app/bundle.js öffnete, las das Passwort im Klartext und
   kam an den vollständigen Fortschritt samt Schwächen ALLER Kinder.

   Jetzt kommt es aus der Umgebungsvariablen EB_LEHRER_PW (Netlify →
   Site configuration → Environment variables). Ist sie nicht gesetzt, gibt es
   den Sammelklassen-Weg gar nicht mehr; dann zählt ausschließlich
   Klassencode + PIN, und die PIN liegt nur als Hash auf dem Server.
   Ein leeres Passwort darf NIE passen — deshalb die Längenprüfung. */
const TEACHER_PW = String(process.env.EB_LEHRER_PW || "");
const tpwOk = (v) => TEACHER_PW.length >= 4 && String(v || "") === TEACHER_PW;
const DEFAULT_CLASS = "ALLE";       // Klasse, in die JEDES Kind automatisch kommt
const STORE = "site:elifba-sync";   // Blobs-Store (Präfix "site:" = siteweit)

/* ---------------------------------------------------------------------------
   1) Speicher: Netlify Blobs ohne SDK
   Netlify legt in der Function-Umgebung die Variable NETLIFY_BLOBS_CONTEXT ab
   (Base64-JSON mit siteID, token, edgeURL, uncachedEdgeURL, apiURL). Genau die
   liest auch das offizielle Paket — wir sparen uns nur den Import.
--------------------------------------------------------------------------- */
/* ---------------------------------------------------------------------------
   WICHTIGE KORREKTUR (09.08.2026) — Ursache des Fehlers „Speicher-Lesefehler 401":

   Netlify legt die Zugangsdaten für den Speicher NICHT ein für alle Mal ab,
   sondern reicht bei JEDEM Aufruf einen frischen, kurzlebigen Schlüssel
   durch (globalThis.netlifyBlobsContext). Die alte Fassung hat den allerersten
   Schlüssel in einer Variablen gemerkt und für immer weiterbenutzt. Solange
   derselbe Server-Prozess warmlief, ging das gut — sobald der Schlüssel
   ablief, antwortete der Speicher auf JEDE Anfrage mit 401. Für die Lehrkraft
   sah das so aus, als wären plötzlich alle Schüler verschwunden.

   Jetzt gilt: der Kontext wird bei jedem Aufruf frisch gelesen (nur das
   Zerlegen desselben Textes wird gespart), und bei 401/403 wird EINMAL mit
   neu geholtem Schlüssel wiederholt. Damit kann dieser Fehler nicht wiederkehren.
--------------------------------------------------------------------------- */
let _rawSeen = null, _ctxCache = null;
function rawContext() {
  const g = globalThis.netlifyBlobsContext;
  if (g && typeof g === "object") return g;                 // manche Laufzeiten reichen ein Objekt durch
  return (typeof g === "string" && g)
    || (typeof process !== "undefined" && process.env && process.env.NETLIFY_BLOBS_CONTEXT)
    || "";
}
function ctx(forceFresh) {
  const raw = rawContext();
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  if (!forceFresh && raw === _rawSeen) return _ctxCache;     // identischer Text → nicht neu zerlegen
  try {
    _ctxCache = JSON.parse(Buffer.from(String(raw), "base64").toString("utf8"));
    _rawSeen = raw;
  } catch (e) { _ctxCache = null; _rawSeen = raw; }
  return _ctxCache;
}

const authHdr = (c) => ({ authorization: "Bearer " + c.token });

function edgeURL(c, key, params) {
  const base = c.uncachedEdgeURL || c.edgeURL;   // uncached = immer frische Daten
  if (!base) return null;
  let path = "/" + c.siteID + "/" + STORE + (key ? "/" + key : "");
  const u = new URL(path, base);
  for (const k in (params || {})) u.searchParams.set(k, params[k]);
  return u.toString();
}

// Zweitweg (z. B. lokal mit "netlify dev"): offizielle API + signierte URL
async function apiURLFor(c, key, method, params) {
  const u = new URL(
    "/api/v1/blobs/" + c.siteID + "/" + STORE + (key ? "/" + key : ""),
    c.apiURL || "https://api.netlify.com"
  );
  for (const k in (params || {})) u.searchParams.set(k, params[k]);
  if (!key) return { url: u.toString(), headers: authHdr(c) };
  if (method === "DELETE") return { url: u.toString(), headers: authHdr(c) };
  const r = await fetch(u.toString(), {
    method,
    headers: { ...authHdr(c), accept: "application/json;type=signed-url" },
  });
  if (!r.ok) throw new Error("Blobs-API " + r.status);
  const j = await r.json();
  return { url: j.url, headers: {} };
}

async function target(key, method, params, forceFresh) {
  const c = ctx(forceFresh);
  if (!c || !c.siteID || !c.token) return null;
  const direct = edgeURL(c, key, params);
  if (direct) return { url: direct, headers: authHdr(c) };
  return await apiURLFor(c, key, method, params);
}

/* Eine Speicher-Anfrage — mit genau einer Wiederholung, falls der Schlüssel
   zwischenzeitlich abgelaufen ist (401/403). */
async function blobRequest(key, method, { params, body, extraHeaders } = {}) {
  let t = await target(key, method, params);
  if (!t) return null;                                   // kein Blobs-Zugang → Notbetrieb
  const send = (tt) => fetch(tt.url, {
    method: method === "GET" ? undefined : method,
    headers: { ...tt.headers, ...(extraHeaders || {}) },
    body,
  });
  let r = await send(t);
  if (r.status === 401 || r.status === 403) {
    const t2 = await target(key, method, params, true);   // Schlüssel frisch holen
    if (t2) r = await send(t2);
  }
  return r;
}

/* Notnagel: Wenn gar kein Blobs-Zugang da ist, wird wenigstens nach /tmp
   geschrieben, damit die App nicht komplett tot ist. Das überlebt allerdings
   keinen Server-Neustart — deshalb meldet "ping" in diesem Fall ehrlich
   storage:"temporaer", und die App zeigt der Lehrkraft eine Warnung. */
import { readFileSync, writeFileSync, unlinkSync, readdirSync, mkdirSync, existsSync } from "node:fs";
const TMP = "/tmp/elifba-store";
const tmpName = (k) => TMP + "/" + Buffer.from(String(k)).toString("hex") + ".json";
function tmpEnsure() { try { if (!existsSync(TMP)) mkdirSync(TMP, { recursive: true }); return true; } catch (e) { return false; } }

/* Fehlermeldungen, die einer Lehrkraft etwas sagen */
function storageMsg(was, status) {
  if (status === 401 || status === 403)
    return "Der Zugang zum Speicher wurde abgelehnt (" + status + "). Bitte die Seite in Netlify einmal neu veröffentlichen — deine Daten sind nicht verloren.";
  if (status === 429) return "Der Speicher ist gerade überlastet — bitte in einer Minute nochmal.";
  return "Speicher konnte nicht " + was + " (" + status + ").";
}

let STORAGE_MODE = "unbekannt";

async function bGet(key) {
  const r = await blobRequest(key, "GET");
  if (!r) { STORAGE_MODE = "temporaer"; try { return JSON.parse(readFileSync(tmpName(key), "utf8")); } catch (e) { return null; } }
  if (r.status === 404) { STORAGE_MODE = "blobs"; return null; }
  if (!r.ok) throw new Error(storageMsg("lesen", r.status));
  STORAGE_MODE = "blobs";
  const txt = await r.text();
  if (!txt) return null;
  try { return JSON.parse(txt); } catch (e) { return null; }
}

async function bSet(key, value) {
  const body = JSON.stringify(value);
  const r = await blobRequest(key, "PUT", {
    body, extraHeaders: { "cache-control": "max-age=0, stale-while-revalidate=60" },
  });
  if (!r) {
    STORAGE_MODE = "temporaer";
    if (!tmpEnsure()) throw new Error("Kein Speicher verfügbar");
    writeFileSync(tmpName(key), body); return true;
  }
  if (!r.ok) throw new Error(storageMsg("schreiben", r.status));
  STORAGE_MODE = "blobs";
  return true;
}

async function bDel(key) {
  const r = await blobRequest(key, "DELETE");
  if (!r) { try { unlinkSync(tmpName(key)); } catch (e) {} return true; }
  return true;
}

async function bList(prefix) {
  const c = ctx();
  if (!c || !c.siteID || !c.token) {
    STORAGE_MODE = "temporaer";
    try {
      return readdirSync(TMP)
        .map((f) => Buffer.from(f.replace(/\.json$/, ""), "hex").toString("utf8"))
        .filter((k) => k.startsWith(prefix));
    } catch (e) { return []; }
  }
  const keys = [];
  let cursor = null;
  for (let i = 0; i < 25; i++) {                     // max. 25 Seiten = viele tausend Kinder
    const params = { prefix };
    if (cursor) params.cursor = cursor;
    const r = await blobRequest("", "GET", { params });
    if (!r) break;
    if (r.status === 404) break;
    if (!r.ok) throw new Error(storageMsg("auflisten", r.status));
    const page = await r.json();
    (page.blobs || []).forEach((b) => { if (b && b.key) keys.push(b.key); });
    if (!page.next_cursor) break;
    cursor = page.next_cursor;
  }
  STORAGE_MODE = "blobs";
  return keys;
}

/* --------------------------------------------------------------------------
   2) Kleinkram
-------------------------------------------------------------------------- */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Gzip",
};
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...CORS },
  });

const cleanCode = (s) => String(s || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
const cleanName = (s) => String(s || "").trim().replace(/\s+/g, " ").slice(0, 40);
const cleanKey = (s) => String(s || "").replace(/[^a-z0-9]/gi, "").slice(0, 40);
const hashOf = (p, saltHex) => pbkdf2Sync(p, Buffer.from(saltHex, "hex"), 120000, 32, "sha256").toString("hex");
// Namen dürfen Umlaute/Emoji enthalten — als Blob-Schlüssel taugt das nicht,
// deshalb wird der Kleinbuchstaben-Name hex-kodiert abgelegt.
const userKey = (uname) => "user:" + Buffer.from(uname, "utf8").toString("hex");

async function readBody(req) {
  if ((req.headers.get("x-gzip") || "") === "1") {
    const buf = Buffer.from(await req.arrayBuffer());
    return JSON.parse(gunzipSync(buf).toString("utf8"));
  }
  const txt = await req.text();
  return txt ? JSON.parse(txt) : {};
}

/* --------------------------------------------------------------------------
   3) Klassenliste: Schüler werden aus den KONTEN abgeleitet, nicht aus einer
   Meldung des Kindes. Dadurch taucht jedes Kind sofort beim Anmelden auf —
   auch wenn es noch keine einzige Karte gelernt hat.
-------------------------------------------------------------------------- */
/* ---------- Klassenzimmer mit Code (11.0) ----------
   klasse:<code> = { code, name, teacher, salt, pinHash, created }
   Vier Ziffern, die die Lehrkraft beim Anlegen bekommt. Lehrer-Rechte gibt es
   entweder mit dem alten zentralen Lehrer-Passwort (Sammelklasse) oder mit
   Code + PIN der eigenen Klasse — dann aber NUR für diese eine Klasse. */
const istZahlenCode = (c) => /^\d{4}$/.test(String(c || ""));
async function klasseFor(code) { const c = cleanCode(code); return c ? (await bGet("klasse:" + c)) : null; }
async function teacherOk(code, tpw, pin) {
  if (tpwOk(tpw)) return true;
  const k = await klasseFor(code);
  if (!k || !k.pinHash || !pin) return false;
  const a = Buffer.from(hashOf(String(pin), k.salt), "hex"), b = Buffer.from(k.pinHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/* Gehört der mitgeschickte Schlüssel wirklich zu diesem Namen? (14.09.2026)

   Der syncKey ist der einzige Nachweis, den ein Kind hat — er wird beim
   Anlegen des Kontos vergeben und liegt nur auf seinem Gerät. Bis heute wurde
   er dort NICHT geprüft, wo ein Name mitkam: Jedes Kind konnte unter fremdem
   Namen eine Kurzmeldung schicken (fremden Fortschritt überschreiben), fremde
   Zurufe lesen und leeren. Ein Blob-Lesevorgang schließt das. */
async function keyGehoertZu(name, key) {
  const nm = cleanName(name); const k = cleanCode(key);
  if (!nm || k.length < 4) return false;
  const rec = await bGet(userKey(nm.toLowerCase()));
  return !!(rec && rec.syncKey && rec.syncKey === k);
}

async function joinClass(rec) {
  const code = cleanCode(rec.classCode || DEFAULT_CLASS) || DEFAULT_CLASS;
  const reg = (await bGet("class:" + code)) || { students: {} };
  if (!reg.students[rec.name]) {
    reg.students[rec.name] = { ts: Date.now(), joined: Date.now() };
    await bSet("class:" + code, reg);
  }
  return code;
}

async function rosterFor(code) {
  const wantAll = !code || code === DEFAULT_CLASS || code === "*";
  const out = {};
  // a) alle Konten durchgehen
  const keys = await bList("user:");
  for (const k of keys) {
    const rec = await bGet(k);
    if (!rec || !rec.name) continue;
    const cc = cleanCode(rec.classCode || DEFAULT_CLASS) || DEFAULT_CLASS;
    if (!wantAll && cc !== code) continue;
    out[rec.name] = {
      name: rec.name,
      classCode: cc,
      role: rec.role || "student",
      created: rec.created || 0,
      lastSeen: rec.lastSeen || 0,
      ...(rec.summary || {}),
      ts: (rec.summary && rec.summary.ts) || rec.lastSeen || rec.created || 0,
    };
  }
  // b) zusätzlich die klassische Klassen-Datei (Altbestand / Gastmeldungen)
  const codes = wantAll ? await bList("class:") : ["class:" + code];
  for (const ck of codes) {
    const reg = await bGet(ck);
    if (!reg || !reg.students) continue;
    for (const nm in reg.students) {
      const s = reg.students[nm] || {};
      const da = out[nm];
      /* (14.09.2026) Hier stand `...(out[nm] || {}), ...s` — die alte
         Sammeldatei überschrieb also den frisch aus dem Konto gelesenen Stand.
         Wenn zwei Kinder gleichzeitig abglichen, gewann anschließend eine
         Datei, in der eines von beiden noch mit den Zahlen von vorgestern
         stand. Jetzt zählt, was neuer ist; nur unbekannte Kinder kommen aus
         der Sammeldatei ganz hinzu. */
      if (!da) { out[nm] = { name: nm, classCode: ck.slice(6), ...s, ts: s.ts || 0 }; continue; }
      const neuer = (s.ts || 0) > (da.ts || 0);
      out[nm] = neuer ? { ...da, ...s, ts: s.ts || 0 } : { ...s, ...da, ts: da.ts || 0 };
    }
  }
  return out;
}

/* --------------------------------------------------------------------------
   4) Hauptfunktion
-------------------------------------------------------------------------- */
export default async (req) => {
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: CORS });

  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  let route = (url.searchParams.get("r") || "").toLowerCase();
  if (!route) {
    if (/\/media\/audio$/.test(path)) route = "media";
    else route = (path.split("/").pop() || "sync").toLowerCase();
  }
  if (route === "media/audio") route = "media";

  try {
    /* ---------- ping: Selbsttest ---------- */
    if (route === "ping") {
      let storage = "fehlt", detail = "";
      try {
        await bSet("ping-test", { ts: Date.now() });
        const back = await bGet("ping-test");
        storage = back && back.ts ? STORAGE_MODE : "fehlt";
      } catch (e) { storage = "fehlt"; detail = String(e && e.message || e); }
      return json({ ok: true, version: VERSION, storage, detail, defaultClass: DEFAULT_CLASS });
    }

    /* ---------- auth: Konten (nur Name, Geheimwort optional) ---------- */
    if (route === "auth") {
      if (req.method !== "POST") return json({ error: "Methode nicht unterstützt" }, 405);
      const body = await readBody(req);

      /* Namensliste fürs Antippen — NUR mit dem Code einer wirklichen Klasse.
         (14.09.2026) Vorher gab diese Route jedem, der sie aufrief, bis zu 300
         Kindernamen heraus: ohne Anmeldung, ohne Klasse, aus allen Gemeinden.
         Zusammen mit der Anmeldung ohne Geheimwort war das der bequemste Weg,
         einen fremden Lernstand zu übernehmen. Wer den vierstelligen Code hat,
         sitzt im Unterricht — das ist die Hürde, die zur Wirklichkeit passt. */
      if (body.action === "list") {
        const code = cleanCode(body.classCode || "");
        if (!istZahlenCode(code)) return json({ ok: true, names: [] });
        if (!(await klasseFor(code))) return json({ ok: true, names: [] });
        const keys = await bList("user:");
        const names = [];
        for (const k of keys) {
          const rec = await bGet(k);
          if (!rec || !rec.name) continue;
          if ((rec.role || "student") === "teacher") continue;
          if ((cleanCode(rec.classCode || DEFAULT_CLASS) || DEFAULT_CLASS) !== code) continue;
          names.push({ name: rec.name, hasPass: !!rec.hash });
        }
        names.sort((a, b) => a.name.localeCompare(b.name, "de"));
        return json({ ok: true, names: names.slice(0, 120) });
      }

      const displayName = cleanName(body.name);
      const uname = displayName.toLowerCase();
      const pass = String(body.pass || "");
      if (uname.length < 2) return json({ error: "Name zu kurz (mindestens 2 Zeichen)" }, 400);
      const ukey = userKey(uname);
      const wantClass = cleanCode(body.classCode || "") || DEFAULT_CLASS;

      if (body.action === "check") {
        const rec = await bGet(ukey);
        return json({ ok: true, exists: !!rec, hasPass: !!(rec && rec.hash) });
      }

      /* Geheimwort setzen / ändern / entfernen */
      if (body.action === "setpass") {
        const rec = await bGet(ukey);
        if (!rec) return json({ error: "Konto nicht gefunden" }, 404);
        /* Ein Konto OHNE Geheimwort war bisher schutzlos in die andere
           Richtung: Jeder konnte für einen fremden Namen eins SETZEN und das
           Kind damit für immer aussperren — sein Lernstand lag hinter einem
           Wort, das es nie erfahren würde. Deshalb gilt hier dieselbe Regel
           wie beim Anmelden: nur vom eigenen Gerät. (14.09.2026) */
        if (!rec.hash) {
          const dev = cleanKey(body.device);
          const bekannt = Array.isArray(rec.devices) ? rec.devices : [];
          if (bekannt.length && (!dev || bekannt.indexOf(dev) < 0))
            return json({ error: "Das geht nur auf dem Gerät, auf dem der Name angelegt wurde." }, 403);
        }
        if (rec.hash) {                                  // altes Geheimwort prüfen
          const old = String(body.oldPass || "");
          const a = Buffer.from(hashOf(old, rec.salt), "hex");
          const b = Buffer.from(rec.hash, "hex");
          if (!old || a.length !== b.length || !timingSafeEqual(a, b))
            return json({ error: "Das bisherige Geheimwort stimmt nicht" }, 401);
        }
        const np = String(body.newPass || "");
        if (np && np.length < 4) return json({ error: "Geheimwort zu kurz (mindestens 4 Zeichen)" }, 400);
        rec.hash = np ? hashOf(np, rec.salt) : "";
        await bSet(ukey, rec);
        return json({ ok: true, hasPass: !!rec.hash });
      }

      /* Eigenes Konto löschen (Kind) — Lehrkraft nutzt dafür das Klassenzimmer */
      if (body.action === "delete") {
        const rec = await bGet(ukey);
        if (!rec) return json({ ok: true, removed: true });
        if (rec.hash) {
          const pw = String(body.pass || "");
          const a = Buffer.from(hashOf(pw, rec.salt), "hex");
          const b = Buffer.from(rec.hash, "hex");
          if (!pw || a.length !== b.length || !timingSafeEqual(a, b))
            return json({ error: "Geheimwort erforderlich" }, 401);
        } else {
          /* Ohne Geheimwort darf nur das eigene Gerät löschen — sonst könnte
             ein Kind das Konto eines anderen mitsamt Lernstand auslöschen,
             indem es dessen Namen schickt. (14.09.2026) */
          const dev = cleanKey(body.device);
          const bekannt = Array.isArray(rec.devices) ? rec.devices : [];
          if (bekannt.length && (!dev || bekannt.indexOf(dev) < 0))
            return json({ error: "Das geht nur auf dem Gerät, auf dem der Name angelegt wurde." }, 403);
        }
        const code = cleanCode(rec.classCode || DEFAULT_CLASS) || DEFAULT_CLASS;
        try {
          const reg = (await bGet("class:" + code)) || { students: {} };
          delete reg.students[rec.name];
          await bSet("class:" + code, reg);
        } catch (e) {}
        try { if (rec.syncKey) await bDel("col:" + rec.syncKey); } catch (e) {}
        await bDel(ukey);
        return json({ ok: true, removed: true });
      }

      /* "join" = der neue Ein-Klick-Weg: existiert der Name → anmelden,
         sonst → anlegen. Das Kind merkt von dem Unterschied nichts. */
      if (body.action === "join" || body.action === "register" || body.action === "login") {
        let rec = await bGet(ukey);
        const wantTeacher = !!body.teacher;
        if (wantTeacher && !(await teacherOk(wantClass, body.tpw, body.pin)))
          return json({ error: "Lehrer-Passwort oder PIN falsch" }, 403);
        // Vierstellige Codes müssen zu einem angelegten Klassenzimmer gehören.
        if (istZahlenCode(wantClass) && !(await klasseFor(wantClass)))
          return json({ error: "Diesen Klassen-Code gibt es nicht — frag deine Lehrkraft.", badCode: true }, 404);
        const klasseInfo = async (c) => { const k = istZahlenCode(c) ? await klasseFor(c) : null; return k ? { className: k.name, teacherName: k.teacher } : {}; };

        if (!rec) {
          if (body.action === "login") return json({ error: "Konto nicht gefunden" }, 404);
          if (pass && pass.length < 4)
            return json({ error: "Geheimwort zu kurz (mindestens 4 Zeichen — oder leer lassen)" }, 400);
          const salt = randomBytes(16).toString("hex");
          rec = {
            name: displayName, salt,
            hash: pass ? hashOf(pass, salt) : "",
            syncKey: "U" + randomBytes(9).toString("hex").toUpperCase(),
            classCode: wantClass,
            role: wantTeacher ? "teacher" : "student",
            devices: cleanKey(body.device) ? [cleanKey(body.device)] : [],
            created: Date.now(), lastSeen: Date.now(), summary: {},
          };
          await bSet(ukey, rec);
          await joinClass(rec);
          return json({ ok: true, created: true, key: rec.syncKey, name: rec.name,
                        classCode: rec.classCode, role: rec.role, ...(await klasseInfo(rec.classCode)) });
        }

        // Konto existiert → Geheimwort prüfen (falls eines gesetzt wurde)
        if (rec.hash) {
          if (!pass) return json({ error: "Für diesen Namen ist ein Geheimwort gesetzt", needPass: true }, 401);
          const a = Buffer.from(hashOf(pass, rec.salt), "hex");
          const b = Buffer.from(rec.hash, "hex");
          if (a.length !== b.length || !timingSafeEqual(a, b))
            return json({ error: "Falsches Geheimwort", needPass: true }, 401);
        } else if (body.action === "register" && pass) {
          // Erstmalig ein Geheimwort nachtragen
          rec.hash = hashOf(pass, rec.salt);
        }

        /* WESSEN NAME IST DAS? — Gerätebindung. (14.09.2026)

           Die Anmeldung ist mit Absicht kinderleicht: Name eintippen, fertig.
           Genau deshalb kam bisher aber auch jeder in den Lernstand eines
           anderen: „Ayşe" tippen konnte jedes Kind, und der Server gab den
           Schlüssel heraus. Für einen Achtjährigen, dessen Punkte plötzlich
           einem anderen gehören, ist das kein Randfall, sondern der Tag, an
           dem er aufhört zu üben.

           Die Lösung, die nichts an der Leichtigkeit ändert: Beim Anlegen
           merkt sich das Konto das Gerät. Dasselbe Kind auf demselben Handy
           merkt nie etwas. Kommt ein NEUES Gerät und hat das Konto kein
           Geheimwort, braucht es einmal die PIN der Lehrkraft — die sitzt im
           Unterricht daneben. Bis zu fünf Geräte darf ein Kind haben
           (Handy der Mutter, Tablet, Rechner der Moschee).

           Konten aus der Zeit davor haben noch keine Liste; das erste Gerät,
           das sich meldet, übernimmt sie. Und in der Sammelklasse „ALLE" gibt
           es keine PIN, gegen die man prüfen könnte — dort bleibt es wie
           bisher (ein Grund mehr, eine richtige Klasse anzulegen). */
        if (!rec.hash && !wantTeacher) {
          const dev = cleanKey(body.device);
          const bekannt = Array.isArray(rec.devices) ? rec.devices : [];
          if (!bekannt.length) {
            if (dev) rec.devices = [dev];
          } else if (!dev || bekannt.indexOf(dev) < 0) {
            const eigeneKlasse = await klasseFor(rec.classCode);
            const pinStimmt = !!eigeneKlasse && !!body.klassenPin &&
                              (await teacherOk(rec.classCode, "", body.klassenPin));
            if (eigeneKlasse && !pinStimmt)
              return json({ error: "Diesen Namen gibt es schon. Wenn das dein Name ist, frag kurz deine Lehrkraft — sie tippt ihre PIN ein.",
                            needTeacher: true }, 401);
            if (dev) rec.devices = bekannt.concat([dev]).slice(-5);
          }
        }

        const cc = cleanCode(body.classCode || "");
        if (cc && cc !== rec.classCode) rec.classCode = cc;
        if (!rec.classCode) rec.classCode = DEFAULT_CLASS;
        if (wantTeacher) rec.role = "teacher";
        rec.lastSeen = Date.now();
        await bSet(ukey, rec);
        await joinClass(rec);
        return json({ ok: true, created: false, key: rec.syncKey, name: rec.name,
                      classCode: rec.classCode || DEFAULT_CLASS, role: rec.role || "student",
                      ...(await klasseInfo(rec.classCode)) });
      }
      return json({ error: "Unbekannte Aktion" }, 400);
    }

    /* ---------- klasse: Klassenzimmer anlegen / nachschlagen / öffnen (11.0) ---------- */
    if (route === "klasse") {
      if (req.method === "GET") {
        const k = await klasseFor(url.searchParams.get("code") || "");
        if (!k) return json({ ok: true, found: false });
        return json({ ok: true, found: true, code: k.code, name: k.name, teacher: k.teacher });
      }
      if (req.method !== "POST") return json({ error: "Methode nicht unterstützt" }, 405);
      const body = await readBody(req);
      if (body.action === "create") {
        const name = cleanName(body.name), teacher = cleanName(body.teacher), pin = String(body.pin || "").trim();
        if (name.length < 2) return json({ error: "Bitte einen Namen für die Klasse eingeben" }, 400);
        if (teacher.length < 2) return json({ error: "Bitte deinen Namen eingeben" }, 400);
        if (!/^\d{4,8}$/.test(pin)) return json({ error: "Die PIN braucht 4 bis 8 Ziffern" }, 400);
        let code = "";
        for (let t = 0; t < 25 && !code; t++) {
          const c = String(1000 + (randomBytes(2).readUInt16BE(0) % 9000));
          if (!(await bGet("klasse:" + c))) code = c;
        }
        if (!code) return json({ error: "Gerade kein freier Code — bitte nochmal versuchen" }, 500);
        const salt = randomBytes(16).toString("hex");
        /* NOTFALL-WORT. (14.09.2026) Bisher war eine vergessene PIN das Ende
           des Klassenzimmers: Der Server kannte keinen Weg zurück, und die
           Anleitung riet zu einer neuen Klasse — womit zwanzig Kinder ihren
           Code neu abtippen müssten. Beim Anlegen gibt es jetzt EINMAL ein
           Wort zum Aufschreiben, mit dem sich die PIN neu setzen lässt.
           Gespeichert wird nur sein Hash; wer es verliert, ist so weit wie
           vorher, aber niemand muss es verlieren. */
        const AB = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";     // ohne I/O/0/1
        const rb = randomBytes(8);
        let notfall = "";
        for (let i = 0; i < 8; i++) notfall += AB[rb[i] % AB.length];
        await bSet("klasse:" + code, { code, name, teacher, salt, pinHash: hashOf(pin, salt),
                                       notfallHash: hashOf(notfall, salt), created: Date.now() });
        return json({ ok: true, code, name, teacher, notfall });
      }
      if (body.action === "login") {
        const code = cleanCode(body.code);
        const k = await klasseFor(code);
        if (!k) return json({ error: "Diesen Klassen-Code gibt es nicht" }, 404);
        if (!(await teacherOk(code, body.tpw, body.pin))) return json({ error: "Die PIN stimmt nicht" }, 401);
        return json({ ok: true, code: k.code, name: k.name, teacher: k.teacher });
      }
      /* PIN neu setzen — mit dem Notfall-Wort vom Anlegen oder mit der alten PIN. */
      if (body.action === "pinNeu") {
        const code = cleanCode(body.code);
        const k = await klasseFor(code);
        if (!k) return json({ error: "Diesen Klassen-Code gibt es nicht" }, 404);
        const neu = String(body.pin || "").trim();
        if (!/^\d{4,8}$/.test(neu)) return json({ error: "Die neue PIN braucht 4 bis 8 Ziffern" }, 400);
        let darf = await teacherOk(code, body.tpw, body.altPin);
        if (!darf && k.notfallHash && body.notfall) {
          const wort = String(body.notfall).trim().toUpperCase();
          const a = Buffer.from(hashOf(wort, k.salt), "hex"), b = Buffer.from(k.notfallHash, "hex");
          darf = a.length === b.length && timingSafeEqual(a, b);
        }
        if (!darf) return json({ error: "Dafür braucht es die alte PIN oder das Notfall-Wort." }, 401);
        k.pinHash = hashOf(neu, k.salt);
        await bSet("klasse:" + code, k);
        return json({ ok: true, code: k.code, name: k.name, teacher: k.teacher });
      }
      if (body.action === "rename") {
        const code = cleanCode(body.code);
        const k = await klasseFor(code);
        if (!k) return json({ error: "Diesen Klassen-Code gibt es nicht" }, 404);
        if (!(await teacherOk(code, body.tpw, body.pin))) return json({ error: "Die PIN stimmt nicht" }, 401);
        const name = cleanName(body.name);
        if (name.length < 2) return json({ error: "Name zu kurz" }, 400);
        k.name = name; await bSet("klasse:" + code, k);
        return json({ ok: true, code: k.code, name: k.name, teacher: k.teacher });
      }
      return json({ error: "Unbekannte Aktion" }, 400);
    }

    /* ---------- class: Klassenzimmer ---------- */
    if (route === "class") {
      if (req.method === "GET") {
        const codeQ = cleanCode(url.searchParams.get("code") || "");
        const globalTeacher = tpwOk(url.searchParams.get("tpw"));
        const isTeacher = globalTeacher || await teacherOk(codeQ, "", url.searchParams.get("pin"));
        // Eine Klassen-Lehrkraft (PIN) sieht nur ihre eigene Klasse, nie „alle".
        if (isTeacher && !globalTeacher && !codeQ) return json({ error: "Code fehlt" }, 400);
        const me = cleanName(url.searchParams.get("me") || "");
        /* Kinder-Sicht (11.08.2026, „gegenseitig anspornen"): Ohne Lehrer-Passwort,
           aber mit dem eigenen Namen, gibt es eine BEWUSST ABGESPECKTE Liste —
           nur was fürs gegenseitige Anfeuern nötig ist: Name, Punkte, Level,
           Serie, Gesamtfortschritt, auswendig gelernte Suren und die Punkte der
           letzten 7 Tage. KEINE Schwachstellen, KEINE Lektionsdetails, KEINE
           Zeitstempel-Historie — das bleibt Sache der Lehrkraft. */
        if (!isTeacher && !me) {
          /* Sagen, WAS zu tun ist — nicht nur, dass es nicht ging. Wer ein
             Passwort schickt und keins hinterlegt ist, soll erfahren warum.
             (14.09.2026) */
          if (url.searchParams.get("tpw") && TEACHER_PW.length < 4)
            return json({ error: "Auf diesem Server ist kein Sammelklassen-Passwort hinterlegt (EB_LEHRER_PW). Lege ein Klassenzimmer mit Code und PIN an — das ist der sichere Weg." }, 403);
          return json({ error: "Lehrer-Passwort erforderlich" }, 403);
        }
        /* DIE TAFEL GEHÖRT ZUR KLASSE. (14.09.2026) Ohne Klassencode lieferte
           sie bisher die Sammelklasse „ALLE" — also Namen und Punkte JEDES
           Kindes, das die App je benutzt hat, quer über alle Gemeinden. Ein
           Kind soll seine Mitschüler sehen, nicht Fremde. Ohne richtigen Code
           gibt es deshalb keine Tafel, sondern einen Hinweis. */
        if (!isTeacher && !istZahlenCode(codeQ))
          return json({ ok: true, found: true, board: [], ohneKlasse: true, me, defaultClass: DEFAULT_CLASS });
        const code = codeQ;
        const students = await rosterFor(code);
        if (isTeacher) {
          const k = await klasseFor(code);
          return json({ ok: true, found: true, students, defaultClass: DEFAULT_CLASS,
                        klasse: k ? { code: k.code, name: k.name, teacher: k.teacher } : null });
        }
        /* ZWISCHENSPEICHER FÜR DIE TAFEL. (14.09.2026)

           rosterFor() liest JEDES Konto einzeln aus dem Blob-Speicher. Die
           Kinder-Tafel fragt alle 90 Sekunden nach — bei 30 Kindern sind das
           30 × 30 = 900 Lesevorgänge je anderthalb Minuten, bei 100 Kindern
           schon 10.000. Das wächst im Quadrat und wäre die erste Wand, gegen
           die mehrere Gemeinden laufen.

           Die Tafel braucht keine Sekundengenauigkeit: Punkte, Level, Serie.
           Deshalb wird sie einmal je Minute berechnet und bis dahin aus einer
           kleinen Datei beantwortet — ein Lesevorgang statt dreißig. */
        const TAFEL_FRISCH = 60000;
        const tafelKey = "board:" + (code || DEFAULT_CLASS);
        const zwischen = await bGet(tafelKey);
        if (zwischen && Array.isArray(zwischen.board) && Date.now() - (zwischen.ts || 0) < TAFEL_FRISCH)
          return json({ ok: true, found: true, board: zwischen.board, me, defaultClass: DEFAULT_CLASS, cached: true });

        const board = [];
        for (const nm in students) {
          const s = students[nm] || {};
          const d7 = Array.isArray(s.d7) ? s.d7 : [];
          board.push({
            n: s.name || nm,
            xp: Number(s.xp || 0),
            lvl: Number(s.lvl || 1),
            streak: Number(s.streak || 0),
            all: Number(s.all || 0),
            hzd: Number((s.hz && s.hz.d) || 0),
            hzv: Number((s.hz && s.hz.v) || 0),
            w7: d7.reduce((a, b) => a + (Number(b) || 0), 0),
            teacher: (s.role || "student") === "teacher" ? 1 : 0,
          });
        }
        board.sort((a, b) => b.w7 - a.w7 || b.xp - a.xp);
        try { await bSet(tafelKey, { board, ts: Date.now() }); } catch (e) { /* Tafel geht auch ohne */ }
        return json({ ok: true, found: true, board, me, defaultClass: DEFAULT_CLASS });
      }
      if (req.method === "POST") {
        const body = await readBody(req);
        const code = cleanCode(body.code || DEFAULT_CLASS) || DEFAULT_CLASS;
        if (body.remove) {
          if (!(await teacherOk(code, body.tpw, body.pin))) return json({ error: "Lehrer-Passwort oder PIN erforderlich" }, 403);
          const nm = cleanName(body.remove);
          const reg = (await bGet("class:" + code)) || { students: {} };
          delete reg.students[nm];
          await bSet("class:" + code, reg);
          /* (14.09.2026) Bisher wurde nur der Kontoeintrag gelöscht. Der
             Spielstand blieb als verwaiste Datei col:<Schlüssel> liegen — für
             immer, weil niemand mehr wusste, wem er gehörte. Und die Tafel
             fiel danach in den alten Zustand zurück, weil der Zwischenspeicher
             das Kind noch kannte. Beides geht jetzt mit. */
          const weg = await bGet(userKey(nm.toLowerCase()));
          try { if (weg && weg.syncKey) await bDel("col:" + weg.syncKey); } catch (e) {}
          await bDel(userKey(nm.toLowerCase()));
          try { await bDel("board:" + code); } catch (e) {}
          return json({ ok: true, removed: true });
        }
        const name = cleanName(body.name);
        if (!name) return json({ error: "Name fehlt" }, 400);
        /* (14.09.2026) Diese Route stand jedem offen: Ein Kind konnte die
           Kurzmeldung eines anderen überschreiben — Punkte auf null, Schwächen
           erfunden. Jetzt weist sich das Kind mit seinem eigenen Schlüssel aus. */
        if (!(await keyGehoertZu(name, body.key)))
          return json({ error: "Nicht angemeldet" }, 403);
        const reg = (await bGet("class:" + code)) || { students: {} };
        reg.students[name] = { ...(reg.students[name] || {}), ...(body.summary || {}), ts: Date.now() };
        await bSet("class:" + code, reg);
        const ukey = userKey(name.toLowerCase());
        const rec = await bGet(ukey);
        if (rec) { rec.summary = { ...(body.summary || {}), ts: Date.now() }; rec.lastSeen = Date.now(); await bSet(ukey, rec); }
        return json({ ok: true });
      }
      return json({ error: "Methode nicht unterstützt" }, 405);
    }

    /* ---------- cheer: „Ich feuere dich an!" (11.08.2026) ----------
       Ein Kind tippt ein anderes an und schickt ihm ein Zeichen (💪 👏 🔥 🤲).
       Der Empfänger sieht es beim nächsten Öffnen der App. Bewusst winzig
       gehalten: nur Absender, Zeichen und Zeitpunkt — kein freier Text, damit
       hier niemand etwas Gemeines schreiben kann. Pro Absender und Tag sind
       drei Zurufe erlaubt, sonst wäre es Spam statt Ansporn. */
    if (route === "cheer") {
      const cheerKey = (n) => "cheer:" + Buffer.from(cleanName(n).toLowerCase(), "utf8").toString("hex");
      const MAXAGE = 3 * 86400000;      // drei Tage
      const fresh = (list) => (list || []).filter((x) => Date.now() - (x.ts || 0) < MAXAGE);

      if (req.method === "GET") {
        const name = cleanName(url.searchParams.get("name") || "");
        if (!name) return json({ error: "Name fehlt" }, 400);
        /* (14.09.2026) Ohne Nachweis konnte jeder den Briefkasten jedes Kindes
           lesen UND mit `clear=1` leeren — die Zurufe waren weg, bevor das Kind
           sie gesehen hatte. */
        if (!(await keyGehoertZu(name, url.searchParams.get("key"))))
          return json({ error: "Nicht angemeldet" }, 403);
        const rec = (await bGet(cheerKey(name))) || { list: [] };
        const list = fresh(rec.list);
        if (url.searchParams.get("clear")) await bSet(cheerKey(name), { list: [] });
        return json({ ok: true, cheers: list });
      }
      if (req.method === "POST") {
        const body = await readBody(req);
        const to = cleanName(body.to || ""), from = cleanName(body.from || "");
        if (!to || !from) return json({ error: "Name fehlt" }, 400);
        // Nur im eigenen Namen anfeuern — sonst wäre der Absender frei erfunden.
        if (!(await keyGehoertZu(from, body.key)))
          return json({ error: "Nicht angemeldet" }, 403);
        if (to.toLowerCase() === from.toLowerCase())
          return json({ error: "Sich selbst anfeuern gilt nicht \uD83D\uDE42" }, 400);
        const kind = String(body.kind || "\uD83D\uDCAA").slice(0, 8);
        const rec = (await bGet(cheerKey(to))) || { list: [] };
        let list = fresh(rec.list);
        const day = new Date().toISOString().slice(0, 10);
        if (list.filter((x) => x.from === from && x.d === day).length >= 3)
          return json({ ok: true, limited: true });
        list.push({ from, kind, ts: Date.now(), d: day });
        if (list.length > 40) list = list.slice(-40);
        await bSet(cheerKey(to), { list });
        return json({ ok: true, sent: true });
      }
      return json({ error: "Methode nicht unterstützt" }, 405);
    }

    /* ---------- audio: Aussprache-Studio ---------- */
    if (route === "audio" || route === "media") {
      if (req.method === "GET") {
        if (url.searchParams.get("list")) {
          const idx = (await bGet("audio-index")) || { keys: [] };
          return json({ ok: true, keys: idx.keys || [] });
        }
        const k = cleanKey(url.searchParams.get("k"));
        if (!k) return json({ error: "key fehlt" }, 400);
        const rec = await bGet("audio:" + k);
        if (!rec || !rec.b64) return json({ error: "nicht gefunden" }, 404);
        return new Response(Buffer.from(rec.b64, "base64"), {
          status: 200,
          headers: { "Content-Type": rec.mime || "audio/webm", "Cache-Control": "public, max-age=31536000", ...CORS },
        });
      }
      if (req.method === "POST") {
        const body = await readBody(req);
        if (!(await teacherOk(body.code, body.tpw, body.pin))) return json({ error: "Lehrer-Passwort oder PIN erforderlich" }, 403);
        const k = cleanKey(body.key);
        if (!k) return json({ error: "key fehlt" }, 400);
        const idx = (await bGet("audio-index")) || { keys: [] };
        if (body.action === "del") {
          idx.keys = (idx.keys || []).filter((x) => x !== k);
          await bSet("audio-index", idx);
          await bDel("audio:" + k);
          return json({ ok: true, removed: true });
        }
        const b64 = String(body.data || "");
        if (!b64 || b64.length > 900000) return json({ error: "Aufnahme fehlt oder zu groß (max ~650 KB)" }, 400);
        await bSet("audio:" + k, { mime: String(body.mime || "audio/webm"), b64, ts: Date.now() });
        if (!(idx.keys || []).includes(k)) { idx.keys = [...(idx.keys || []), k]; await bSet("audio-index", idx); }
        return json({ ok: true, count: (idx.keys || []).length });
      }
      return json({ error: "Methode nicht unterstützt" }, 405);
    }

    /* ==========================================================
       cards: Buchstaben & Silben von der Lehrkraft überschreiben
       Ein Eintrag gilt für die ARABISCHE Vorderseite — dadurch wirkt
       eine Änderung automatisch in jeder Lektion, in der sie vorkommt.
       GET  cards                       → { ok, cards, rev }
       POST cards {tpw, q, a}           → setzen
       POST cards {tpw, q, del:true}    → zurücksetzen
    ========================================================== */
    /* ==========================================================
       config: Klassen-Einstellungen der Lehrkraft (14.08.2026) —
       gilt automatisch auf allen Kinder-Geräten.
         GET  config?code=ALLE            → { ok, cfg }
         POST config {tpw, code, cfg}     → speichern (nur Lehrkraft)
       cfg kennt bisher:
         tekrar : 0|3|5|7   Wiederhol-Ziel je neuem Vers (0 = aus, Standard 7)
         voice  : 'lehr'|'fluessig'   Rezitations-Stimme (Ḥuṣarî Muʿallim / Alafasy)
    ========================================================== */
    if (route === "config") {
      const code = cleanCode(url.searchParams.get("code") || (req.method === "POST" ? "" : "")) || DEFAULT_CLASS;
      if (req.method === "GET") {
        const rec = (await bGet("classcfg:" + code)) || {};
        return json({ ok: true, cfg: rec.cfg || {} });
      }
      if (req.method === "POST") {
        const body = await readBody(req);
        const c = cleanCode(String(body.code || "")) || DEFAULT_CLASS;
        if (!(await teacherOk(c, body.tpw, body.pin))) return json({ error: "Lehrer-Passwort oder PIN erforderlich" }, 403);
        const inCfg = body.cfg || {};
        const cfg = {};
        const t = Number(inCfg.tekrar);
        if ([0, 3, 5, 7].indexOf(t) >= 0) cfg.tekrar = t;
        if (inCfg.voice === "lehr" || inCfg.voice === "fluessig") cfg.voice = inCfg.voice;
        // Wer hat bei den Koranversen Vorrang: Ḥuṣarî oder die eigene Aufnahme?
        if (inCfg.surahVoice === "husari" || inCfg.surahVoice === "lehrer") cfg.surahVoice = inCfg.surahVoice;
        const rec = (await bGet("classcfg:" + c)) || {};
        rec.cfg = Object.assign({}, rec.cfg || {}, cfg);
        rec.ts = Date.now();
        await bSet("classcfg:" + c, rec);
        return json({ ok: true, cfg: rec.cfg });
      }
      return json({ error: "Methode nicht unterstützt" }, 405);
    }

    if (route === "cards") {
      if (req.method === "GET") {
        const rec = (await bGet("card-overrides")) || { cards: {}, rev: 0 };
        return json({ ok: true, cards: rec.cards || {}, rev: rec.rev || 0 });
      }
      if (req.method === "POST") {
        const body = await readBody(req);
        if (!(await teacherOk(cleanCode(body.code || ""), body.tpw, body.pin)))
          return json({ error: "Lehrer-Passwort oder PIN erforderlich" }, 403);
        const q = String(body.q || "").trim().slice(0, 60);
        if (!q) return json({ error: "Karte fehlt" }, 400);
        const rec = (await bGet("card-overrides")) || { cards: {}, rev: 0 };
        rec.cards = rec.cards || {};
        if (body.del) delete rec.cards[q];
        else {
          /* (12.08.2026) Neben der Umschrift (a) darf jetzt auch die arabische
             SCHREIBWEISE (ar) überschrieben werden. Der Schlüssel bleibt immer
             die URSPRÜNGLICHE Schreibweise — so bleibt der Eintrag stabil,
             auch wenn mehrfach umgeschrieben wird. */
          const a = String(body.a || "").trim().slice(0, 80);
          const ar = String(body.ar || "").trim().slice(0, 60);
          if (!a && !ar) return json({ error: "Nichts zu speichern" }, 400);
          const ov = { ts: Date.now() };
          if (a) ov.a = a;
          if (ar) ov.ar = ar;
          rec.cards[q] = ov;
        }
        rec.rev = (rec.rev || 0) + 1;
        await bSet("card-overrides", rec);
        return json({ ok: true, rev: rec.rev, count: Object.keys(rec.cards).length });
      }
      return json({ error: "Methode nicht unterstützt" }, 405);
    }

    /* ==========================================================
       duel: Live-Duell (zwei oder mehr Kinder gegeneinander)
       Der Raum liegt als eine kleine Datei im Speicher; die Geräte
       fragen ihn im Sekundentakt ab. Kein WebSocket nötig.
    ========================================================== */
    if (route === "duel") {
      const PER_Q = 15000;        // Zeit je Frage
      const roomKey = (c) => "duel:" + cleanCode(c);
      const invKey = (n) => "inv:" + Buffer.from(cleanName(n).toLowerCase(), "utf8").toString("hex");
      const newCode = () => {
        const AB = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // ohne I/O/0/1
        let out = "";
        const b = randomBytes(4);
        for (let i = 0; i < 4; i++) out += AB[b[i] % AB.length];
        return out;
      };
      /* Zustand fortschreiben: alle geantwortet oder Zeit um → nächste Frage */
      const tick = (room) => {
        if (room.state !== "run") return room;
        const names = Object.keys(room.players || {});
        const allIn = names.length > 0 && names.every((n) => (room.players[n].answered || {})[room.i] !== undefined);
        if (allIn || Date.now() > (room.deadline || 0)) {
          room.i = (room.i || 0) + 1;
          if (room.i >= (room.qs || []).length) { room.state = "done"; room.endedAt = Date.now(); }
          else room.deadline = Date.now() + PER_Q;
        }
        return room;
      };

      if (req.method === "GET") {
        // Einladungen abholen
        const inv = url.searchParams.get("inv");
        if (inv) {
          const rec = (await bGet(invKey(inv))) || { list: [] };
          const fresh = (rec.list || []).filter((x) => Date.now() - (x.ts || 0) < 10 * 60000);
          return json({ ok: true, invites: fresh });
        }
        const code = cleanCode(url.searchParams.get("code"));
        if (code.length !== 4) return json({ error: "Code fehlt" }, 400);
        let room = await bGet(roomKey(code));
        if (!room) return json({ ok: true, found: false });
        const before = JSON.stringify({ i: room.i, s: room.state });
        room = tick(room);
        if (JSON.stringify({ i: room.i, s: room.state }) !== before) await bSet(roomKey(code), room);
        return json({ ok: true, found: true, room });
      }

      if (req.method === "POST") {
        const body = await readBody(req);
        const name = cleanName(body.name);
        if (!name) return json({ error: "Name fehlt" }, 400);

        if (body.action === "create") {
          const qs = Array.isArray(body.qs) ? body.qs.slice(0, 15) : [];
          if (!qs.length) return json({ error: "Fragen fehlen" }, 400);
          let code = newCode();
          for (let t = 0; t < 5 && (await bGet(roomKey(code))); t++) code = newCode();
          const room = {
            code, host: name, topic: String(body.topic || "").slice(0, 60),
            topicName: String(body.topicName || "").slice(0, 60),
            qs, state: "lobby", i: 0, created: Date.now(),
            players: { [name]: { score: 0, answered: {}, ts: Date.now() } },
          };
          await bSet(roomKey(code), room);
          // Einladung hinterlegen
          const target = cleanName(body.invite || "");
          if (target) {
            const rec = (await bGet(invKey(target))) || { list: [] };
            rec.list = (rec.list || []).filter((x) => Date.now() - (x.ts || 0) < 10 * 60000 && x.from !== name);
            rec.list.push({ from: name, code, topicName: room.topicName, ts: Date.now() });
            await bSet(invKey(target), rec);
          }
          return json({ ok: true, room });
        }

        const code = cleanCode(body.code);
        if (code.length !== 4) return json({ error: "Code fehlt" }, 400);
        let room = await bGet(roomKey(code));
        if (!room) return json({ error: "Dieses Duell gibt es nicht (mehr)" }, 404);

        if (body.action === "join") {
          if (!room.players[name]) {
            if (Object.keys(room.players).length >= 6) return json({ error: "Das Duell ist voll" }, 409);
            room.players[name] = { score: 0, answered: {}, ts: Date.now() };
          } else room.players[name].ts = Date.now();
          await bSet(roomKey(code), room);
          return json({ ok: true, room });
        }
        if (body.action === "start") {
          if (room.state === "lobby") {
            room.state = "run"; room.i = 0; room.deadline = Date.now() + PER_Q; room.startedAt = Date.now();
            await bSet(roomKey(code), room);
          }
          return json({ ok: true, room });
        }
        if (body.action === "answer") {
          const p = room.players[name];
          if (!p) return json({ error: "Nicht im Duell" }, 400);
          const idx = Number(body.i);
          if (!(idx >= 0) || idx !== room.i || room.state !== "run") return json({ ok: true, room });
          p.answered = p.answered || {};
          if (p.answered[idx] === undefined) {
            const ms = Math.max(0, Math.min(PER_Q, Number(body.ms) || PER_Q));
            const correct = !!body.correct;
            // Punkte: richtig = 100, plus bis zu 50 Tempo-Bonus
            const pts = correct ? 100 + Math.round(50 * (1 - ms / PER_Q)) : 0;
            p.answered[idx] = { c: correct, ms, pts };
            p.score = (p.score || 0) + pts;
            p.ts = Date.now();
          }
          room = tick(room);
          await bSet(roomKey(code), room);
          return json({ ok: true, room });
        }
        if (body.action === "leave") {
          delete room.players[name];
          if (!Object.keys(room.players).length) await bDel(roomKey(code));
          else await bSet(roomKey(code), room);
          return json({ ok: true });
        }
        if (body.action === "decline") {
          const rec = (await bGet(invKey(name))) || { list: [] };
          rec.list = (rec.list || []).filter((x) => x.code !== code);
          await bSet(invKey(name), rec);
          return json({ ok: true });
        }
        return json({ error: "Unbekannte Aktion" }, 400);
      }
      return json({ error: "Methode nicht unterstützt" }, 405);
    }

    /* ---------- sync: persönlicher Spielstand ---------- */
    if (req.method === "GET") {
      const key = cleanCode(url.searchParams.get("key") || url.searchParams.get("code"));
      if (key.length < 4) return json({ error: "Schlüssel fehlt" }, 400);
      const data = await bGet("col:" + key);
      return json(data ? { ok: true, found: true, col: data.col, ts: data.ts, rev: data.rev || 1 }
                       : { ok: true, found: false, rev: 0 });
    }
    if (req.method === "POST") {
      const body = await readBody(req);
      const key = cleanCode(body.key || body.code);
      if (key.length < 4) return json({ error: "Schlüssel fehlt" }, 400);
      if (!body.col || typeof body.col !== "object") return json({ error: "Daten fehlen" }, 400);
      const cur = await bGet("col:" + key);
      const curRev = cur ? (cur.rev || 1) : 0;
      if (body.baseRev !== undefined && Number(body.baseRev) !== curRev)
        return json({ conflict: true, rev: curRev, col: cur ? cur.col : null }, 409);
      const payload = { col: body.col, ts: Date.now(), rev: curRev + 1 };
      await bSet("col:" + key, payload);

      // Klassenmeldung im SELBEN Aufruf — dadurch kann der Fortschritt der
      // Lehrkraft nie "fehlen", weil eine zweite Anfrage nicht ankam.
      if (body.name) {
        const nm = cleanName(body.name);
        /* Hat die Lehrkraft dieses Kind entfernt, gibt es kein Konto mehr.
           Bisher glich das Gerät munter weiter ab und legte eine verwaiste
           Datei nach der anderen an; in der Klassenliste tauchte das Kind
           nicht mehr auf, auf seinem Handy sah alles normal aus. Jetzt
           erfährt das Gerät es. (14.09.2026) */
        if (!(await bGet(userKey(nm.toLowerCase()))))
          return json({ error: "Dieses Konto gibt es nicht mehr.", entfernt: true }, 404);
        const code = cleanCode(body.classCode || DEFAULT_CLASS) || DEFAULT_CLASS;
        const sum = { ...(body.summary || {}), ts: Date.now() };
        /* (14.09.2026) Der Spielstand hing schon immer am Schlüssel — der NAME
           daneben aber nicht. Ein Kind mit gültigem eigenen Schlüssel konnte
           „name": "Ayşe" mitschicken und damit Ayşes Meldung an die Lehrkraft
           überschreiben. Der Schlüssel muss zum Namen gehören, sonst wird nur
           der eigene Spielstand gespeichert und die Meldung stillschweigend
           verworfen (der Abgleich selbst soll deswegen nicht scheitern). */
        const darf = await keyGehoertZu(nm, key);
        if (darf) try {
          /* NUR NOCH IN DEN EIGENEN KONTO-DATENSATZ. (14.09.2026)

             Hier wurde bisher zusätzlich die Sammeldatei class:<code> komplett
             gelesen und komplett zurückgeschrieben — bei jedem Abgleich jedes
             Kindes. Gleichzeitige Abgleiche löschten sich dabei gegenseitig:
             Wer zuletzt schrieb, schrieb den Stand, den er vor seiner eigenen
             Anfrage gelesen hatte. Nötig ist die Datei nicht, denn die
             Klassenliste wird ohnehin aus den Konto-Datensätzen gebaut
             (rosterFor, Teil a), und jedes Kind hat seinen eigenen. Damit
             fallen Wettlauf und halbe Schreiblast weg. Die Sammeldatei bleibt
             als Altbestand lesbar; hineingeschrieben wird nur noch beim
             Anlegen (joinClass) und über die Route `class`. */
          const ukey = userKey(nm.toLowerCase());
          const rec = await bGet(ukey);
          if (rec) { rec.summary = sum; rec.lastSeen = Date.now(); rec.classCode = code; await bSet(ukey, rec); }
          try { await bDel("board:" + code); } catch (e) {}   // Tafel neu rechnen lassen
        } catch (e) { /* Spielstand ist gespeichert — Meldung darf scheitern */ }
      }
      return json({ ok: true, ts: payload.ts, rev: payload.rev });
    }
    return json({ error: "Methode nicht unterstützt" }, 405);
  } catch (e) {
    return json({ error: "Serverfehler: " + (e && e.message ? e.message : String(e)) }, 500);
  }
};

export const config = { path: ["/api/*", "/media/audio"] };
