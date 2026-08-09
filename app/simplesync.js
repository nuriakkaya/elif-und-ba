/* ==============================================================
   ELIF & BA — KONTEN & SYNCHRONISIERUNG (Version 7, 09.08.2026)

   Ziel dieser Fassung: Ein Kind tippt AUF „Anmelden“, schreibt seinen
   NAMEN, drückt einmal — und ist im Kurs. Kein Kurs-Code, kein Passwort,
   keine Fehlermeldung. Die Lehrkraft sieht jedes Kind mit vollem
   Fortschritt, ohne dass irgendjemand einen Code abtippen muss.

   Drei Dinge, die in Version 6 schiefgingen, sind jetzt gelöst:

   1) „Not found“. Die App fragte starr /api/auth. Liegt die Netlify-
      Umleitung nicht vor, antwortet Netlify mit einer HTML-404 — die
      App zeigte den nackten Text „Not found“. Jetzt probiert der Client
      DREI Wege durch (/api/…, /.netlify/functions/sync/…, …?r=…) und
      merkt sich den, der antwortet. Erkennungsmerkmal: Nur echtes JSON
      kommt von unserem Server.
   2) Kurs-Code als Pflicht. Jetzt landet jedes Konto automatisch in der
      Sammelklasse „ALLE“; ein Code ist NUR noch zum Aufteilen da.
   3) Fortschritt „fehlte“, weil die Klassenmeldung eine zweite, eigene
      Anfrage war. Jetzt reist die Kurzmeldung im SELBEN Aufruf mit dem
      Spielstand mit — kommt der Spielstand an, kommt der Fortschritt an.

   Auto-Sync wie bei An-Ki: beim Start, 4 s nach jeder Änderung, beim
   Wegschalten des Tabs, bei „online“, plus alle 5 Minuten.
   ============================================================== */
(function () {
  const ACC_KEY = 'lern_account_v1';
  const META_KEY = 'lern_sync_meta_v1';
  const TEACHER_FLAG = 'lern_teacher_v1';
  const EP_KEY = 'lern_endpoint_v1';
  const TEACHER_PW = '1907';          // muss zu netlify/functions/sync.mjs passen
  const DEFAULT_CLASS = 'ALLE';       // Sammelklasse — hier landet jedes Kind

  /* Diese localStorage-Schlüssel bilden zusammen den „Spielstand“. */
  const KEYS = [
    's34a_srs_v1', 's34a_srs_answered_v1', 's34a_xp_v1', 's34a_hearts_v1',
    's34a_monsters_v1', 's34a_lesson_v1', 's34a_custom_topics_v1', 's34a_tweaks_v1',
    's34a_history_v1', 'quran_intro_seen_v1', 'quran_forms_taught_v1',
    'quran_surah_done_v1', 's34a_blitz_off', 'eb_student_name_v1',
  ];
  const PREFIXES = ['s34a_mastered_'];
  const isSyncedKey = (k) => KEYS.indexOf(k) >= 0 || PREFIXES.some((p) => String(k).indexOf(p) === 0);

  /* ---------------- kleine Helfer ---------------- */
  const lsGetRaw = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const parse = (s) => { try { return JSON.parse(s); } catch (e) { return undefined; } };
  let suppressTouch = false;
  const origSetItem = Storage.prototype.setItem;
  const lsSetRaw = (k, v) => { try { suppressTouch = true; origSetItem.call(localStorage, k, v); } finally { suppressTouch = false; } };

  function account() { return parse(lsGetRaw(ACC_KEY)) || null; }
  function saveAccount(a) { if (a) lsSetRaw(ACC_KEY, JSON.stringify(a)); else { try { localStorage.removeItem(ACC_KEY); } catch (e) {} } }
  function meta() { return parse(lsGetRaw(META_KEY)) || { rev: 0, lastSync: 0, lastClassPost: 0 }; }
  function saveMeta(m) { lsSetRaw(META_KEY, JSON.stringify(m)); }

  /* ==============================================================
     1) ENDPUNKT-AUTOERKENNUNG
     Netlify kann unseren Mini-Server über drei Adressen anbieten. Welche
     davon greift, hängt davon ab, wie die Seite hochgeladen wurde. Statt
     zu raten, probieren wir der Reihe nach — und merken uns den Gewinner.
     ============================================================== */
  const BASES = ['api', 'fn', 'fnq'];
  function buildUrl(base, route, query) {
    let u;
    if (base === 'api') u = '/api/' + route;
    else if (base === 'fn') u = '/.netlify/functions/sync/' + route;
    else u = '/.netlify/functions/sync?r=' + encodeURIComponent(route === 'media' ? 'media' : route);
    const qs = [];
    for (const k in (query || {})) if (query[k] !== undefined && query[k] !== null) qs.push(encodeURIComponent(k) + '=' + encodeURIComponent(query[k]));
    if (qs.length) u += (u.indexOf('?') >= 0 ? '&' : '?') + qs.join('&');
    return u;
  }
  function knownBase() { const b = lsGetRaw(EP_KEY); return BASES.indexOf(b) >= 0 ? b : null; }
  function rememberBase(b) { if (knownBase() !== b) lsSetRaw(EP_KEY, b); }
  function baseOrder() {
    const k = knownBase();
    return k ? [k].concat(BASES.filter((b) => b !== k)) : BASES.slice();
  }
  // Öffentliche Adresse (z. B. fürs Aussprache-Studio, das Audio direkt lädt)
  function url(route, query) { return buildUrl(knownBase() || 'api', route, query); }

  /* Eine Anfrage — probiert alle Wege, bis echtes JSON zurückkommt.
     Kommt nirgends JSON: entweder ist der Server nicht deployt (missing)
     oder das Gerät ist offline (offline). Beides wird unterschieden. */
  async function req(route, opts) {
    opts = opts || {};
    let sawNetwork = false, sawHttp = false, lastStatus = 0;
    for (const base of baseOrder()) {
      const target = buildUrl(base, route, opts.query);
      let res;
      try {
        res = await fetch(target, {
          method: opts.method || 'GET',
          headers: opts.headers || { 'Content-Type': 'application/json' },
          body: opts.body,
          cache: 'no-store',
        });
      } catch (e) { sawNetwork = true; continue; }   // kein Netz / blockiert
      sawHttp = true; lastStatus = res.status;
      let body = null;
      try { body = await res.json(); } catch (e) { body = null; }
      if (body === null) continue;                   // HTML-404 → nächster Weg
      rememberBase(base);
      return { status: res.status, body, base };
    }
    const err = new Error(sawHttp && !sawNetwork
      ? 'Mini-Server nicht gefunden (' + lastStatus + ')'
      : 'Keine Verbindung');
    err.missing = sawHttp; err.offline = !sawHttp;
    throw err;
  }

  /* gzip für große Spielstände (spart Datenvolumen der Kinder) */
  async function gzipBody(obj) {
    const raw = JSON.stringify(obj);
    if (typeof CompressionStream === 'undefined' || raw.length < 4096) return { body: raw, gz: false };
    try {
      const stream = new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'));
      return { body: await new Response(stream).arrayBuffer(), gz: true };
    } catch (e) { return { body: raw, gz: false }; }
  }

  /* ---------------- Selbsttest ---------------- */
  async function ping() {
    try {
      const r = await req('ping');
      if (r.body && r.body.ok) return { ok: true, base: r.base, version: r.body.version, storage: r.body.storage };
      return { ok: false, error: (r.body && r.body.error) || 'Unerwartete Antwort' };
    } catch (e) { return { ok: false, missing: !!e.missing, offline: !!e.offline, error: e.message }; }
  }
  /* Ausführliche Diagnose: prüft JEDEN Weg einzeln und liefert Klartext. */
  async function diagnose() {
    const tried = [];
    let winner = null, info = null;
    for (const base of BASES) {
      const target = buildUrl(base, 'ping');
      const row = { base, url: target, status: 0, note: '' };
      try {
        const res = await fetch(target, { cache: 'no-store' });
        row.status = res.status;
        let body = null; try { body = await res.json(); } catch (e) {}
        if (body && body.ok) { row.note = 'antwortet ✓'; if (!winner) { winner = base; info = body; } }
        else row.note = body ? 'antwortet, aber unerwartet' : 'kein Mini-Server (HTML/404)';
      } catch (e) { row.note = 'nicht erreichbar'; }
      tried.push(row);
    }
    if (winner) rememberBase(winner);
    return {
      ok: !!winner, base: winner, tried,
      version: info && info.version, storage: info && info.storage,
      online: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
    };
  }

  /* ==============================================================
     2) SPIELSTAND EINSAMMELN / ANWENDEN / ZUSAMMENFÜHREN
     ============================================================== */
  function collect() {
    const data = {};
    KEYS.forEach((k) => { const v = lsGetRaw(k); if (v !== null) data[k] = v; });
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (PREFIXES.some((p) => k.indexOf(p) === 0)) data[k] = lsGetRaw(k);
      }
    } catch (e) {}
    return { v: 1, ts: Date.now(), data };
  }
  function applyData(data) {
    Object.keys(data || {}).forEach((k) => {
      if (isSyncedKey(k) && typeof data[k] === 'string') lsSetRaw(k, data[k]);
    });
  }
  function deepNumMax(a, b) {
    if (a === undefined) return b;
    if (b === undefined) return a;
    if (typeof a === 'number' && typeof b === 'number') return Math.max(a, b);
    if (typeof a === 'string' && typeof b === 'string' && /^\d{4}-\d{2}-\d{2}/.test(a) && /^\d{4}-\d{2}-\d{2}/.test(b)) return a > b ? a : b;
    if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
      const out = {};
      new Set(Object.keys(a).concat(Object.keys(b))).forEach((k) => { out[k] = deepNumMax(a[k], b[k]); });
      return out;
    }
    return b;
  }
  const unionMap = (a, b) => Object.assign({}, a || {}, b || {});

  function mergeKey(key, remoteRaw, localRaw) {
    if (remoteRaw === undefined || remoteRaw === null) return localRaw;
    if (localRaw === undefined || localRaw === null) return remoteRaw;
    if (remoteRaw === localRaw) return localRaw;
    const r = parse(remoteRaw), l = parse(localRaw);
    if (r === undefined || l === undefined) return localRaw;
    try {
      if (key === 's34a_srs_v1') {
        const out = Object.assign({}, r);
        Object.keys(l || {}).forEach((ck) => {
          const a = out[ck], b = l[ck];
          out[ck] = (!a || (b && (b.updatedAt || 0) >= (a.updatedAt || 0))) ? b : a;
        });
        return JSON.stringify(out);
      }
      if (key === 's34a_srs_answered_v1') return JSON.stringify(deepNumMax(r, l));
      if (key === 'quran_intro_seen_v1' || key === 'quran_forms_taught_v1' || key === 'quran_surah_done_v1') return JSON.stringify(unionMap(r, l));
      if (key === 's34a_history_v1') {
        const seen = new Set(); const out = [];
        [].concat(Array.isArray(l) ? l : [], Array.isArray(r) ? r : []).forEach((e) => {
          const id = JSON.stringify(e); if (!seen.has(id)) { seen.add(id); out.push(e); }
        });
        out.sort((x, y) => ((y && y.ts) || 0) - ((x && x.ts) || 0));
        return JSON.stringify(out.slice(0, 200));
      }
      if (key === 's34a_xp_v1' || key === 's34a_lesson_v1') return JSON.stringify(deepNumMax(r, l));
      if (key === 's34a_custom_topics_v1' && Array.isArray(r) && Array.isArray(l)) {
        const byId = {};
        r.concat(l).forEach((t) => { if (t && t.id) byId[t.id] = (byId[t.id] && (byId[t.id].updatedAt || 0) > (t.updatedAt || 0)) ? byId[t.id] : t; });
        return JSON.stringify(Object.values(byId));
      }
    } catch (e) {}
    return localRaw;
  }
  function mergeCols(remoteCol, localCol) {
    const out = { v: 1, ts: Date.now(), data: {} };
    const rd = (remoteCol && remoteCol.data) || {};
    const ld = (localCol && localCol.data) || {};
    new Set(Object.keys(rd).concat(Object.keys(ld))).forEach((k) => {
      const m = mergeKey(k, rd[k], ld[k]);
      if (m !== undefined && m !== null) out.data[k] = m;
    });
    return out;
  }

  /* ---------------- Status & Ereignisse ---------------- */
  let state = 'idle';  // idle | syncing | ok | offline | error | lokal
  let lastError = '';
  const listeners = [];
  const emit = () => listeners.forEach((fn) => { try { fn(status()); } catch (e) {} });
  function setState(s, err) { state = s; lastError = err || ''; emit(); }
  function status() {
    const m = meta();
    const acc = account();
    return { account: acc, state, error: lastError, lastSync: m.lastSync || 0, local: !!(acc && acc.local) };
  }

  /* ==============================================================
     3) KURZMELDUNG FÜR DIE LEHRKRAFT
     ============================================================== */
  function buildSummary(acc) {
    try {
      if (window.Classroom && window.Classroom.snapshot) {
        const snap = window.Classroom.snapshot(acc.name);
        try { snap.tdxp = (window.XP && window.XP.todayXp) ? window.XP.todayXp() : 0; } catch (e) {}
        return snap;
      }
      if (window.Classroom && window.Classroom.encode) {
        const snap = window.Classroom.decode(window.Classroom.encode(acc.name));
        if (snap) return snap;
      }
    } catch (e) {}
    return { v: 1, n: acc.name, d: new Date().toISOString().slice(0, 10) };
  }

  /* ==============================================================
     4) SYNCHRONISIEREN
     ============================================================== */
  function localLogin(name, classCode) {
    const n = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    if (n.length < 2) return { error: 'Name zu kurz' };
    saveAccount({ name: n, key: null, classCode: String(classCode || '').trim().toUpperCase() || DEFAULT_CLASS, role: 'student', local: true });
    try { window.Classroom && window.Classroom.setName && window.Classroom.setName(n); } catch (e) {}
    setState('lokal');
    return { ok: true, local: true, account: account() };
  }
  /* Nur-Gerät-Konto still in ein echtes verwandeln, sobald der Server da ist. */
  async function tryUpgrade(acc) {
    try {
      const r = await req('auth', { method: 'POST', body: JSON.stringify({ action: 'join', name: acc.name, pass: '', classCode: acc.classCode || '' }) });
      if (r.body && r.body.ok) {
        saveAccount({ name: r.body.name, key: r.body.key, classCode: r.body.classCode || DEFAULT_CLASS, role: r.body.role || 'student' });
        return true;
      }
      if (r.status === 401) return false;   // fremder Name mit Geheimwort
    } catch (e) {}
    return false;
  }

  let syncing = false, dirty = false;
  async function syncNow() {
    let acc = account();
    if (!acc) return;
    if (!acc.key) {
      const ok = await tryUpgrade(acc);
      if (!ok) { setState('lokal'); return; }
      acc = account();
    }
    if (syncing) { dirty = true; return; }
    syncing = true;
    setState('syncing');
    try {
      const m = meta();
      let local = collect();
      // a) Server-Stand holen und einmergen
      const got = await req('sync', { query: { key: acc.key } });
      let baseRev = (got.body && got.body.rev) || 0;
      if (got.body && got.body.found && got.body.col) {
        const merged = mergeCols(got.body.col, local);
        applyData(merged.data);
        local = merged;
      }
      // b) Hochladen — Spielstand UND Kurzmeldung in einem Rutsch
      let done = false;
      for (let attempt = 0; attempt < 3 && !done; attempt++) {
        const payload = {
          key: acc.key, col: local, baseRev,
          name: acc.role === 'teacher' ? '' : acc.name,
          classCode: acc.classCode || DEFAULT_CLASS,
          summary: acc.role === 'teacher' ? null : buildSummary(acc),
        };
        const { body, gz } = await gzipBody(payload);
        const r = await req('sync', {
          method: 'POST',
          headers: gz ? { 'Content-Type': 'application/json', 'X-Gzip': '1' } : { 'Content-Type': 'application/json' },
          body,
        });
        const rb = r.body || {};
        if (r.status === 409 && rb.col) {
          const merged = mergeCols(rb.col, local);
          applyData(merged.data);
          local = merged;
          baseRev = rb.rev || 0;
          continue;
        }
        if (rb.ok) {
          saveMeta(Object.assign(m, { rev: rb.rev, lastSync: Date.now(), lastClassPost: Date.now() }));
          done = true;
          break;
        }
        throw new Error(rb.error || 'Abgleich fehlgeschlagen');
      }
      setState(done ? 'ok' : 'error', done ? '' : 'Abgleich fehlgeschlagen');
    } catch (e) {
      if (e && e.offline) setState('offline', 'Keine Verbindung');
      else if (e && e.missing) setState('error', 'Mini-Server nicht gefunden');
      else setState('error', (e && e.message) || 'Abgleich fehlgeschlagen');
    }
    syncing = false;
    if (dirty) { dirty = false; schedule(1500); }
  }

  /* Nur die Kurzmeldung (z. B. direkt nach dem Anmelden, damit das Kind
     sofort in der Liste der Lehrkraft steht). */
  async function postClassSummary(force) {
    const acc = account();
    if (!acc || !acc.key || acc.role === 'teacher') return;
    const m = meta();
    if (!force && Date.now() - (m.lastClassPost || 0) < 60000) return;
    try {
      await req('class', { method: 'POST', body: JSON.stringify({ code: acc.classCode || DEFAULT_CLASS, name: acc.name, summary: buildSummary(acc) }) });
      saveMeta(Object.assign(meta(), { lastClassPost: Date.now() }));
    } catch (e) {}
  }

  /* ==============================================================
     5) LEHRKRAFT
     ============================================================== */
  async function fetchClass(codeOverride) {
    const code = String(codeOverride === undefined ? (account() || {}).classCode || '' : codeOverride).toUpperCase();
    try {
      const r = await req('class', { query: { code: code === DEFAULT_CLASS ? '' : code, tpw: TEACHER_PW } });
      if (r.body && r.body.students) return { ok: true, code: code || DEFAULT_CLASS, students: r.body.students };
      return { error: (r.body && r.body.error) || 'Klasse nicht gefunden' };
    } catch (e) {
      return { error: e.offline ? 'Keine Verbindung' : 'Mini-Server nicht gefunden', missing: !!e.missing };
    }
  }
  async function removeStudentRemote(name, codeOverride) {
    const code = String(codeOverride || (account() || {}).classCode || DEFAULT_CLASS).toUpperCase();
    try {
      const r = await req('class', { method: 'POST', body: JSON.stringify({ code, remove: name, tpw: TEACHER_PW }) });
      return r.body || {};
    } catch (e) { return { error: 'Server nicht erreichbar' }; }
  }
  async function listNames() {
    try {
      const r = await req('auth', { method: 'POST', body: JSON.stringify({ action: 'list' }) });
      return (r.body && r.body.names) || [];
    } catch (e) { return []; }
  }

  /* ==============================================================
     6) ANMELDEN — ein Feld, ein Klick
     ============================================================== */
  async function check(name) {
    try {
      const r = await req('auth', { method: 'POST', body: JSON.stringify({ action: 'check', name }) });
      return r.body || {};
    } catch (e) { return { error: e.message, missing: !!e.missing, offline: !!e.offline }; }
  }

  /* join(): legt an ODER meldet an — das Kind merkt keinen Unterschied.
     Ist der Server nicht da, wird STILL ein Nur-Gerät-Konto angelegt, damit
     niemand vor einer Fehlermeldung steht. Es verbindet sich später selbst. */
  async function join(name, pass, opts) {
    opts = opts || {};
    const n = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    if (n.length < 2) return { error: 'Bitte gib deinen Namen ein (mindestens 2 Buchstaben).' };
    const body = { action: 'join', name: n, pass: pass || '', classCode: String(opts.classCode || '').toUpperCase() };
    if (opts.teacher) { body.teacher = true; body.tpw = opts.teacherPw || ''; }
    let r;
    try {
      r = await req('auth', { method: 'POST', body: JSON.stringify(body) });
    } catch (e) {
      const res = localLogin(n, opts.classCode);
      res.local = true;
      res.notice = e.offline
        ? 'Gerade keine Verbindung — du kannst sofort loslegen, der Abgleich läuft später automatisch.'
        : 'Der Mini-Server antwortet auf dieser Seite noch nicht — du kannst trotzdem sofort loslegen. Sobald er da ist, verbindet sich dein Konto von selbst.';
      return res;
    }
    if (r.status === 401 || (r.body && r.body.needPass)) return { needPass: true, error: r.body && r.body.error };
    if (r.body && r.body.ok) {
      saveAccount({ name: r.body.name, key: r.body.key, classCode: r.body.classCode || DEFAULT_CLASS, role: r.body.role || 'student' });
      if ((r.body.role || '') === 'teacher') lsSetRaw(TEACHER_FLAG, '1');
      try { window.Classroom && window.Classroom.setName && window.Classroom.setName(r.body.name); } catch (e) {}
      setState('idle');
      syncNow();
      postClassSummary(true);
      return { ok: true, created: !!r.body.created, account: account() };
    }
    return { error: (r.body && r.body.error) || 'Anmeldung hat nicht geklappt' };
  }
  const smartLogin = join;   // alter Name bleibt gültig

  /* Geheimwort setzen / ändern / entfernen */
  async function setPassword(oldPass, newPass) {
    const acc = account();
    if (!acc || !acc.key) return { error: 'Nicht angemeldet' };
    try {
      const r = await req('auth', { method: 'POST', body: JSON.stringify({
        action: 'setpass', name: acc.name, oldPass: oldPass || '', newPass: newPass || '' }) });
      if (r.body && r.body.ok) return { ok: true, hasPass: !!r.body.hasPass };
      return { error: (r.body && r.body.error) || 'Das hat nicht geklappt' };
    } catch (e) { return { error: e.offline ? 'Keine Verbindung' : 'Server nicht erreichbar' }; }
  }
  /* Hat mein Konto ein Geheimwort? */
  async function hasPassword() {
    const acc = account();
    if (!acc) return false;
    const info = await check(acc.name);
    return !!info.hasPass;
  }
  /* Eigenes Konto endgültig löschen (Server + Gerät) */
  async function deleteAccount(pass) {
    const acc = account();
    if (!acc) return { error: 'Nicht angemeldet' };
    try {
      if (acc.key) {
        const r = await req('auth', { method: 'POST', body: JSON.stringify({ action: 'delete', name: acc.name, pass: pass || '' }) });
        if (!(r.body && r.body.ok)) return { error: (r.body && r.body.error) || 'Löschen fehlgeschlagen' };
      }
    } catch (e) { return { error: 'Server nicht erreichbar' }; }
    logout();
    return { ok: true };
  }

  async function setClassCode(code) {
    const acc = account();
    if (!acc) return { error: 'Nicht angemeldet' };
    acc.classCode = String(code || '').trim().toUpperCase() || DEFAULT_CLASS;
    saveAccount(acc);
    emit();
    postClassSummary(true);
    return { ok: true };
  }

  function logout() {
    saveAccount(null);
    try { localStorage.removeItem(META_KEY); } catch (e) {}
    setState('idle');
  }

  /* ---------------- Lehrer-Modus ---------------- */
  function isTeacher() {
    const acc = account();
    return (acc && acc.role === 'teacher') || lsGetRaw(TEACHER_FLAG) === '1';
  }
  function setTeacherMode(v) {
    if (v) lsSetRaw(TEACHER_FLAG, '1');
    else { try { localStorage.removeItem(TEACHER_FLAG); } catch (e) {} }
    emit();
  }

  /* ---------------- Auto-Sync-Auslöser ---------------- */
  let timer = null;
  function schedule(ms) {
    if (!account()) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; syncNow(); }, ms == null ? 4000 : ms);
  }
  try {
    Storage.prototype.setItem = function (k, v) {
      origSetItem.call(this, k, v);
      try { if (!suppressTouch && this === window.localStorage && isSyncedKey(k)) schedule(); } catch (e) {}
    };
  } catch (e) {}
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') syncNow();
    else if (state === 'error' || state === 'offline' || state === 'lokal') syncNow();
  });
  window.addEventListener('online', () => syncNow());
  setInterval(() => syncNow(), 5 * 60 * 1000);
  setTimeout(() => syncNow(), 1200);

  window.SimpleSync = {
    account, status, onChange: (fn) => { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
    join, smartLogin, check, logout, syncNow, setClassCode,
    setPassword, hasPassword, deleteAccount,
    fetchClass, removeStudentRemote, postClassSummary, listNames,
    isTeacher, setTeacherMode,
    ping, diagnose, localLogin, url, req,
    TEACHER_PW, DEFAULT_CLASS,
  };
})();
