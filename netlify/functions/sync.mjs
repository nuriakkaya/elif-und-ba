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
     GET  class   ?tpw=1907[&code=…]                Klassenliste (Lehrkraft)
     POST class   { … }                             Kurzmeldung / entfernen
     GET  audio   ?list=1 | ?k=…                    Aussprache-Aufnahmen
     POST audio   { action:'put'|'del', tpw, … }
     GET  media/audio ?k=…                          dasselbe, aber cachebar
============================================================================ */

import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { Buffer } from "node:buffer";

const VERSION = "7.5";
const TEACHER_PW = "1907";          // Lehrer-Passwort — hier zentral änderbar
const DEFAULT_CLASS = "ALLE";       // Klasse, in die JEDES Kind automatisch kommt
const STORE = "site:elifba-sync";   // Blobs-Store (Präfix "site:" = siteweit)

/* ---------------------------------------------------------------------------
   1) Speicher: Netlify Blobs ohne SDK
   Netlify legt in der Function-Umgebung die Variable NETLIFY_BLOBS_CONTEXT ab
   (Base64-JSON mit siteID, token, edgeURL, uncachedEdgeURL, apiURL). Genau die
   liest auch das offizielle Paket — wir sparen uns nur den Import.
--------------------------------------------------------------------------- */
let _ctx;
function ctx() {
  if (_ctx !== undefined) return _ctx;
  const raw =
    globalThis.netlifyBlobsContext ||
    (typeof process !== "undefined" && process.env && process.env.NETLIFY_BLOBS_CONTEXT) ||
    "";
  if (!raw) { _ctx = null; return _ctx; }
  try { _ctx = JSON.parse(Buffer.from(String(raw), "base64").toString("utf8")); }
  catch (e) { _ctx = null; }
  return _ctx;
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

async function target(key, method, params) {
  const c = ctx();
  if (!c || !c.siteID || !c.token) return null;
  const direct = edgeURL(c, key, params);
  if (direct) return { url: direct, headers: authHdr(c) };
  return await apiURLFor(c, key, method, params);
}

/* Notnagel: Wenn gar kein Blobs-Zugang da ist, wird wenigstens nach /tmp
   geschrieben, damit die App nicht komplett tot ist. Das überlebt allerdings
   keinen Server-Neustart — deshalb meldet "ping" in diesem Fall ehrlich
   storage:"temporaer", und die App zeigt der Lehrkraft eine Warnung. */
import { readFileSync, writeFileSync, unlinkSync, readdirSync, mkdirSync, existsSync } from "node:fs";
const TMP = "/tmp/elifba-store";
const tmpName = (k) => TMP + "/" + Buffer.from(String(k)).toString("hex") + ".json";
function tmpEnsure() { try { if (!existsSync(TMP)) mkdirSync(TMP, { recursive: true }); return true; } catch (e) { return false; } }

let STORAGE_MODE = "unbekannt";

async function bGet(key) {
  const t = await target(key, "GET");
  if (!t) { STORAGE_MODE = "temporaer"; try { return JSON.parse(readFileSync(tmpName(key), "utf8")); } catch (e) { return null; } }
  const r = await fetch(t.url, { headers: t.headers });
  if (r.status === 404) { STORAGE_MODE = "blobs"; return null; }
  if (!r.ok) throw new Error("Speicher-Lesefehler " + r.status);
  STORAGE_MODE = "blobs";
  const txt = await r.text();
  if (!txt) return null;
  try { return JSON.parse(txt); } catch (e) { return null; }
}

async function bSet(key, value) {
  const body = JSON.stringify(value);
  const t = await target(key, "PUT");
  if (!t) {
    STORAGE_MODE = "temporaer";
    if (!tmpEnsure()) throw new Error("Kein Speicher verfügbar");
    writeFileSync(tmpName(key), body); return true;
  }
  const r = await fetch(t.url, {
    method: "PUT",
    headers: { ...t.headers, "cache-control": "max-age=0, stale-while-revalidate=60" },
    body,
  });
  if (!r.ok) throw new Error("Speicher-Schreibfehler " + r.status);
  STORAGE_MODE = "blobs";
  return true;
}

async function bDel(key) {
  const t = await target(key, "DELETE");
  if (!t) { try { unlinkSync(tmpName(key)); } catch (e) {} return true; }
  await fetch(t.url, { method: "DELETE", headers: t.headers });
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
    const t = await target("", "GET", params);
    const r = await fetch(t.url, { headers: t.headers });
    if (r.status === 404) break;
    if (!r.ok) throw new Error("Speicher-Listenfehler " + r.status);
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
      out[nm] = { name: nm, classCode: ck.slice(6), ...(out[nm] || {}), ...s,
                  ts: Math.max(s.ts || 0, (out[nm] && out[nm].ts) || 0) };
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

      if (body.action === "list") {                       // Namensliste fürs Antippen
        const keys = await bList("user:");
        const names = [];
        for (const k of keys) {
          const rec = await bGet(k);
          if (rec && rec.name && (rec.role || "student") !== "teacher") {
            names.push({ name: rec.name, hasPass: !!rec.hash });
          }
        }
        names.sort((a, b) => a.name.localeCompare(b.name, "de"));
        return json({ ok: true, names: names.slice(0, 300) });
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
        if (wantTeacher && String(body.tpw || "") !== TEACHER_PW)
          return json({ error: "Lehrer-Passwort falsch" }, 403);

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
            created: Date.now(), lastSeen: Date.now(), summary: {},
          };
          await bSet(ukey, rec);
          await joinClass(rec);
          return json({ ok: true, created: true, key: rec.syncKey, name: rec.name,
                        classCode: rec.classCode, role: rec.role });
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
        const cc = cleanCode(body.classCode || "");
        if (cc && cc !== rec.classCode) rec.classCode = cc;
        if (!rec.classCode) rec.classCode = DEFAULT_CLASS;
        if (wantTeacher) rec.role = "teacher";
        rec.lastSeen = Date.now();
        await bSet(ukey, rec);
        await joinClass(rec);
        return json({ ok: true, created: false, key: rec.syncKey, name: rec.name,
                      classCode: rec.classCode || DEFAULT_CLASS, role: rec.role || "student" });
      }
      return json({ error: "Unbekannte Aktion" }, 400);
    }

    /* ---------- class: Klassenzimmer ---------- */
    if (route === "class") {
      if (req.method === "GET") {
        if ((url.searchParams.get("tpw") || "") !== TEACHER_PW)
          return json({ error: "Lehrer-Passwort erforderlich" }, 403);
        const code = cleanCode(url.searchParams.get("code") || "");
        const students = await rosterFor(code);
        return json({ ok: true, found: true, students, defaultClass: DEFAULT_CLASS });
      }
      if (req.method === "POST") {
        const body = await readBody(req);
        const code = cleanCode(body.code || DEFAULT_CLASS) || DEFAULT_CLASS;
        if (body.remove) {
          if (String(body.tpw || "") !== TEACHER_PW) return json({ error: "Lehrer-Passwort erforderlich" }, 403);
          const nm = cleanName(body.remove);
          const reg = (await bGet("class:" + code)) || { students: {} };
          delete reg.students[nm];
          await bSet("class:" + code, reg);
          await bDel(userKey(nm.toLowerCase()));
          return json({ ok: true, removed: true });
        }
        const name = cleanName(body.name);
        if (!name) return json({ error: "Name fehlt" }, 400);
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
        if (String(body.tpw || "") !== TEACHER_PW) return json({ error: "Lehrer-Passwort erforderlich" }, 403);
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
    if (route === "cards") {
      if (req.method === "GET") {
        const rec = (await bGet("card-overrides")) || { cards: {}, rev: 0 };
        return json({ ok: true, cards: rec.cards || {}, rev: rec.rev || 0 });
      }
      if (req.method === "POST") {
        const body = await readBody(req);
        if (String(body.tpw || "") !== TEACHER_PW) return json({ error: "Lehrer-Passwort erforderlich" }, 403);
        const q = String(body.q || "").trim().slice(0, 60);
        if (!q) return json({ error: "Karte fehlt" }, 400);
        const rec = (await bGet("card-overrides")) || { cards: {}, rev: 0 };
        rec.cards = rec.cards || {};
        if (body.del) delete rec.cards[q];
        else {
          const a = String(body.a || "").trim().slice(0, 80);
          if (!a) return json({ error: "Neue Umschrift fehlt" }, 400);
          rec.cards[q] = { a, ts: Date.now() };
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
        const code = cleanCode(body.classCode || DEFAULT_CLASS) || DEFAULT_CLASS;
        const sum = { ...(body.summary || {}), ts: Date.now() };
        try {
          const reg = (await bGet("class:" + code)) || { students: {} };
          reg.students[nm] = { ...(reg.students[nm] || {}), ...sum };
          await bSet("class:" + code, reg);
          const ukey = userKey(nm.toLowerCase());
          const rec = await bGet(ukey);
          if (rec) { rec.summary = sum; rec.lastSeen = Date.now(); rec.classCode = code; await bSet(ukey, rec); }
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
