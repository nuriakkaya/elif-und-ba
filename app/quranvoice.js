/* ==============================================================
   🎙️ LEHRER-AUSSPRACHE (07.08.2026) — das Herz des Audio-Erlebnisses.

   Die Lehrkraft nimmt im Klassenzimmer ("Aussprache-Studio") jede
   Silbe / jedes Wort EINMAL selbst auf — mit richtigem Tajwid.
   Die Aufnahmen liegen zentral auf dem Server (Netlify Blobs) und
   werden auf ALLEN Geräten bevorzugt abgespielt:

       1. Lehrer-Aufnahme  (dieses Modul)
       2. Buchstaben-Tonaufnahme (Soundboard, app/quranaudio.js)
       3. Systemstimme (TTS) als letzter Ersatz

   /media/audio läuft NICHT über /api/ — der Service Worker cacht
   die Dateien deshalb automatisch: einmal gehört = offline verfügbar.
   ============================================================== */
(function () {
  const IDX_KEY = 'lern_audio_index_v1';
  const REV_KEY = 'lern_audio_rev_v1';

  /* Stabiler Schlüssel für einen arabischen Text (Doppel-Hash, kollisionsarm).
     WICHTIG (09.08.2026): Der Text wird VORHER genauso normalisiert wie beim
     Abspielen — nur arabische Zeichen, Rest zu Leerzeichen, mehrfach zu einfach.
     Vorher konnten Aufnahme und Wiedergabe unterschiedliche Schlüssel bilden
     (z. B. bei Karten mit „·" dazwischen), dann war die Aufnahme unauffindbar. */
  function normalize(text) {
    return String(text || '').replace(/[^\u0600-\u06FF\s]/g, ' ').trim().replace(/\s+/g, ' ');
  }
  function rawHash(s) {
    let h1 = 5381, h2 = 52711;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 = ((h1 * 33) ^ c) >>> 0;
      h2 = ((h2 * 31) ^ c) >>> 0;
    }
    return h1.toString(16) + h2.toString(16);
  }
  function hashKey(text) { return rawHash(normalize(text)); }
  // Alte Aufnahmen (vor der Normalisierung) bleiben auffindbar
  function legacyKey(text) { return rawHash(String(text || '').trim().replace(/\s+/g, ' ')); }
  function keyFor(text) {
    const k = hashKey(text);
    if (idx && idx.has(k)) return k;
    const l = legacyKey(text);
    if (idx && idx.has(l)) return l;
    return k;
  }

  /* Adresse des Mini-Servers: nutzt die Autoerkennung aus simplesync.js,
     damit die Aufnahmen auch dann laden, wenn /api/... nicht umgeleitet wird. */
  function ep(route, q) {
    if (window.SimpleSync && window.SimpleSync.url) return window.SimpleSync.url(route, q);
    var s = '/api/' + route, a = [];
    for (var k in (q || {})) a.push(encodeURIComponent(k) + '=' + encodeURIComponent(q[k]));
    return a.length ? s + '?' + a.join('&') : s;
  }
  /* Für das ABSPIELEN bevorzugen wir /media/audio: diese Adresse darf der
     Service Worker cachen (= einmal gehört, danach offline verfügbar). */
  function mediaUrl(k, v) {
    var known = null;
    try { known = localStorage.getItem('lern_endpoint_v1'); } catch (e) {}
    if (!known || known === 'api') return '/media/audio?k=' + k + '&v=' + v;
    return ep('media', { k: k, v: v });
  }
  async function post(payload) {
    if (window.SimpleSync && window.SimpleSync.req) {
      var r = await window.SimpleSync.req('audio', { method: 'POST', body: JSON.stringify(payload) });
      return r.body || {};
    }
    var res = await fetch('/api/audio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return await res.json();
  }

  let idx = null;      // Set der Schlüssel, für die es Aufnahmen gibt
  let fetchedAt = 0;
  const listeners = [];
  function emit() { listeners.forEach(fn => { try { fn(); } catch (e) {} }); }
  try {
    const o = JSON.parse(localStorage.getItem(IDX_KEY) || 'null');
    if (o && o.keys) { idx = new Set(o.keys); fetchedAt = o.ts || 0; }
  } catch (e) {}

  async function refresh(force) {
    if (!force && idx && Date.now() - fetchedAt < 3600000) return;
    try {
      const r = await fetch(ep('audio', { list: 1 }), { cache: 'no-store' });
      const j = await r.json();
      if (j && Array.isArray(j.keys)) {
        idx = new Set(j.keys);
        fetchedAt = Date.now();
        try { localStorage.setItem(IDX_KEY, JSON.stringify({ keys: j.keys, ts: fetchedAt })); } catch (e) {}
        emit();
      }
    } catch (e) { /* offline/lokal: alter Index bleibt */ }
  }
  setTimeout(() => refresh(), 1800);
  window.addEventListener('online', () => refresh(true));

  function revOf(k) { try { return (JSON.parse(localStorage.getItem(REV_KEY) || '{}') || {})[k] || 0; } catch (e) { return 0; } }
  function bumpRev(k) {
    try {
      const m = JSON.parse(localStorage.getItem(REV_KEY) || '{}') || {};
      m[k] = (m[k] || 0) + 1;
      localStorage.setItem(REV_KEY, JSON.stringify(m));
    } catch (e) {}
  }

  const pool = {};
  function has(text) { return !!(idx && (idx.has(hashKey(text)) || idx.has(legacyKey(text)))); }
  function stopAll() { Object.values(pool).forEach(a => { try { a.pause(); } catch (e) {} }); }
  function play(text, opts) {
    opts = opts || {};
    if (!has(text)) return false;
    const k = keyFor(text);
    const url = mediaUrl(k, revOf(k));
    let a = pool[k];
    if (!a || a.src.indexOf('v=' + revOf(k)) < 0) { a = new Audio(url); pool[k] = a; }
    try {
      stopAll();
      if ('preservesPitch' in a) a.preservesPitch = true;
      a.playbackRate = opts.slow ? 0.65 : 1;
      a.volume = 1;
      a.currentTime = 0;
      // (11.08.2026) Ende melden — das Auswendiglern-Modul braucht das, um zu
      // wissen, wann ein Vers durchgelaufen ist.
      a.onended = function () { if (opts.onEnd) opts.onEnd(true); };
      a.onerror = function () { if (opts.onEnd) opts.onEnd(false); };
      const p = a.play();
      if (p && p.catch) p.catch(function () { if (opts.onEnd) opts.onEnd(false); });
      return true;
    } catch (e) { return false; }
  }

  /* ---------- Studio: Aufnahme hochladen / löschen ---------- */
  async function put(text, blob) {
    const b64 = await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result).split(',')[1] || '');
      fr.onerror = rej;
      fr.readAsDataURL(blob);
    });
    const j = await post({
      action: 'put',
      tpw: (window.SimpleSync && window.SimpleSync.TEACHER_PW) || '1907',
      key: hashKey(text), mime: blob.type || 'audio/webm', data: b64,
    });
    if (j && j.ok) {
      if (!idx) idx = new Set();
      idx.add(hashKey(text));
      bumpRev(hashKey(text));
      delete pool[hashKey(text)];
      try { localStorage.setItem(IDX_KEY, JSON.stringify({ keys: [...idx], ts: Date.now() })); } catch (e) {}
      emit();
    }
    return j || {};
  }
  async function del(text) {
    const j = await post({ action: 'del', tpw: (window.SimpleSync && window.SimpleSync.TEACHER_PW) || '1907', key: hashKey(text) });
    if (j && j.ok) {
      if (idx) idx.delete(hashKey(text));
      delete pool[hashKey(text)];
      try { localStorage.setItem(IDX_KEY, JSON.stringify({ keys: idx ? [...idx] : [], ts: Date.now() })); } catch (e) {}
      emit();
    }
    return j || {};
  }

  window.QuranVoice = {
    hashKey, normalize, has, play, refresh, put, del, stopAll,
    count: function () { return idx ? idx.size : 0; },
    onChange: function (fn) { listeners.push(fn); return function () { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
  };
})();
