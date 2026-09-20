/* ==============================================================
   Herzen/Lives-System + Tipp-Schlüssel (Blueprint Phase 14, 20.07.2026).

   ENTSCHEIDUNG (stand bis jetzt aus, "Entscheidung nötig"): Das System
   wird NACHGEBAUT — für Gizmo-Parität (der Quiz-Topbar-Chip "🔑 ∞ 💗 ∞"
   und die Shop-Kacheln "Tipps"/"Super-Herzen" existierten bei uns bisher
   nur als Deko), ABER mit einem Abschalt-Toggle in den Einstellungen
   ("Herzen-System", standardmäßig AN). Wer den Frustrationsfaktor
   begrenzter Versuche nicht will, schaltet ihn aus und spielt wie bisher
   unbegrenzt — damit sind beide Optionen aus dem Blueprint abgedeckt
   statt nur einer.

   Regeln (eigene, an Duolingo/Gizmo angelehnte Werte — bei Gizmo nicht im
   Detail vermessen, dokumentierte Annahmen):
   - Maximal 5 Herzen. 1 Herz Verlust pro falsch beantworteter Karte im
     Auswendig-Quiz (pro Karte höchstens eins, egal wie viele Fehlversuche
     innerhalb der Karte). Blitzfragen, Lektionen und der Übungstest
     kosten KEINE Herzen (der Test ist Prüfungssimulation mit eigener
     Wertung — doppelt bestrafen wäre unfair).
   - Regeneration: 1 Herz pro 30 Minuten, lazy beim Lesen berechnet
     (kein Timer nötig).
   - Shop: "Herzen auffüllen" (3 Münzen, sofort volle 5), "Super-Herzen"
     (10 Münzen, 24 Stunden unbegrenzte Herzen — bei Gizmo als
     "Superherzen" beobachtet), "Tipps" (2 Münzen für 3 Schlüssel 🔑).
   - Tipp-Schlüssel: der bisher kostenlose "Tipp"-Helfer im Quiz (50:50,
     app/quiz.js onTip) kostet bei aktivem Herzen-System 1 Schlüssel.
     Bei ausgeschaltetem Herzen-System bleibt er gratis/unbegrenzt (∞),
     wie bisher.

   Gleiches Speicher-Muster wie app/xp.js: localStorage synchron,
   Supabase-Sync (profiles.hearts_state jsonb, schema.sql Abschnitt 21)
   fire-and-forget bei Login.
   ============================================================== */
(function () {
  const KEY = 's34a_hearts_v1';
  const MAX_HEARTS = 5;
  const REGEN_MINUTES = 30;
  const REFILL_COST = 3;
  const SUPER_COST = 10;
  const SUPER_HOURS = 24;
  const TIPS_COST = 2;
  const TIPS_PER_PACK = 3;
  // (Ausbau 25.07.2026, nach Live-Erkundung von app.gizmo.ai) Gizmo bietet Power-ups
  // zusätzlich als Mengen-Bündel mit Mengenrabatt an (5er/10er/25er billiger pro Stück
  // als der Einzelkauf). Wir bilden das mit drei Stufen ab: Einzeln (kein Rabatt),
  // 5er (~20% günstiger) und 10er (~25% günstiger). Die konkreten Preise sind eigene,
  // an unsere Münz-Ökonomie angepasste Werte (Gizmo-Zahlen gelten für dessen Währung).
  const TIP_BUNDLES = [
    { id: 1, packs: 1, tips: TIPS_PER_PACK, cost: TIPS_COST, save: 0 },
    { id: 5, packs: 5, tips: TIPS_PER_PACK * 5, cost: 8, save: 20 },   // statt 5×2=10
    { id: 10, packs: 10, tips: TIPS_PER_PACK * 10, cost: 15, save: 25 }, // statt 10×2=20
  ];

  // Klassen-Edition (05.08.2026): Herzen & Schlüssel sind für alle Schüler

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function save(st) {
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* voll/gesperrt */ }
  }

  // Reine Regenerations-Berechnung (testbar): wie viele Herzen sind aus
  // (count, updatedAt) bei jetzt=now geworden? Regeneriert 1 Herz pro
  // REGEN_MINUTES, kappt bei MAX_HEARTS. Liefert auch das neue updatedAt
  // (nur um die tatsächlich verbrauchten Regenerationsschritte vorgerückt,
  // damit angebrochene Intervalle nicht verloren gehen).
  function regen(count, updatedAtMs, nowMs, regenMinutes, maxHearts) {
    const rm = regenMinutes || REGEN_MINUTES;
    const mx = maxHearts || MAX_HEARTS;
    if (count >= mx) return { count, updatedAt: nowMs };
    const elapsed = Math.max(0, nowMs - (updatedAtMs || 0));
    const steps = Math.floor(elapsed / (rm * 60000));
    const gained = Math.min(steps, mx - count);
    return { count: count + gained, updatedAt: (updatedAtMs || 0) + gained * rm * 60000 };
  }

  function state() {
    const st = load();
    const now = Date.now();
    let count = (typeof st.count === 'number') ? st.count : MAX_HEARTS;
    let updatedAt = st.updatedAt || now;
    const r = regen(count, updatedAt, now);
    if (r.count !== count) { st.count = r.count; st.updatedAt = r.updatedAt; save(st); schedulePush(); }
    const superUntil = st.superUntil || 0;
    const superActive = superUntil > now;
    return {
      enabled,
      hearts: r.count,
      max: MAX_HEARTS,
      superActive,
      superUntil,
      tips: (typeof st.tips === 'number') ? st.tips : 3, // Startguthaben: 3 Schlüssel
      // Minuten bis zum nächsten Herz (nur relevant wenn < max und kein Super aktiv)
      nextInMin: r.count >= MAX_HEARTS ? 0 : Math.ceil((r.updatedAt + REGEN_MINUTES * 60000 - now) / 60000),
    };
  }

  let listeners = [];
  function notify() { listeners.slice().forEach((fn) => { try { fn(state()); } catch (e) {} }); }
  function onChange(fn) { listeners.push(fn); return () => { listeners = listeners.filter((f) => f !== fn); }; }

  function setEnabled(on) { enabled = on !== false; notify(); }

  // 1 Herz verlieren (falsch beantwortete Karte im Auswendig-Quiz). Liefert den
  // neuen Stand; bei ausgeschaltetem System oder aktiven Super-Herzen passiert nichts.
  function loseHeart() {
    const s = state();
    if (!s.enabled || s.superActive) return s;
    const st = load();
    if ((st.count === undefined ? MAX_HEARTS : st.count) <= 0) return s;
    st.count = Math.max(0, (st.count === undefined ? MAX_HEARTS : st.count) - 1);
    if (st.count === MAX_HEARTS - 1) st.updatedAt = Date.now(); // Regen-Uhr startet beim ersten Verlust
    st.modifiedAt = Date.now();
    save(st);
    schedulePush();
    notify();
    return state();
  }

  function canPlay() {
    const s = state();
    return !s.enabled || s.superActive || s.hearts > 0;
  }

  /* ---- Shop-Käufe (Münzen via window.XP.spend) ---- */
  function buyRefill() {
    const s = state();
    if (s.hearts >= MAX_HEARTS) return { ok: false, reason: 'full' };
    if (!window.XP || !window.XP.spend(REFILL_COST)) return { ok: false, reason: 'coins' };
    const st = load();
    st.count = MAX_HEARTS; st.updatedAt = Date.now(); st.modifiedAt = Date.now();
    save(st); schedulePush(); notify();
    return { ok: true };
  }
  function buySuper() {
    if (!window.XP || !window.XP.spend(SUPER_COST)) return { ok: false, reason: 'coins' };
    const st = load();
    const base = Math.max(Date.now(), st.superUntil || 0);
    st.superUntil = base + SUPER_HOURS * 3600000;
    st.modifiedAt = Date.now();
    save(st); schedulePush(); notify();
    return { ok: true, superUntil: st.superUntil };
  }
  // buyTips(bundleId): kauft ein Tipp-Bündel (1/5/10). Ohne Argument = Einzelkauf,
  // damit alte Aufrufe weiter funktionieren. Zieht den Bündelpreis atomar ab und
  // schreibt die volle Bündel-Tippzahl gut.
  function buyTips(bundleId) {
    const bundle = TIP_BUNDLES.find((b) => b.id === (bundleId || 1)) || TIP_BUNDLES[0];
    if (!window.XP || !window.XP.spend(bundle.cost)) return { ok: false, reason: 'coins' };
    const st = load();
    st.tips = (typeof st.tips === 'number' ? st.tips : 3) + bundle.tips;
    st.modifiedAt = Date.now();
    save(st); schedulePush(); notify();
    return { ok: true, tips: st.tips, added: bundle.tips };
  }

  // Einen Tipp-Schlüssel verbrauchen (app/quiz.js onTip). Bei ausgeschaltetem
  // Herzen-System gratis (true ohne Abzug), sonst nur wenn Guthaben da ist.
  function useTip() {
    if (!enabled) return true;
    const st = load();
    const tips = typeof st.tips === 'number' ? st.tips : 3;
    if (tips <= 0) return false;
    st.tips = tips - 1;
    st.modifiedAt = Date.now();
    save(st); schedulePush(); notify();
    return true;
  }

  /* ---- Supabase-Sync (eine jsonb-Spalte, profiles.hearts_state) ---- */
  let currentUserId = null;
  let pushTimer = null;
  function pushRemote() {
    if (!currentUserId || !window.sb) return;
    const st = load();
    window.sb.from('profiles').update({ hearts_state: st }).eq('id', currentUserId)
      .then(({ error }) => { if (error) console.warn('[hearts] Sync fehlgeschlagen:', error.message); });
  }
  function schedulePush() {
    if (!currentUserId || !window.sb) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(pushRemote, 1500);
  }
  async function pullAndMerge(userId) {
    if (!window.sb) return;
    try {
      const { data } = await window.sb.from('profiles').select('hearts_state').eq('id', userId).single();
      const remote = (data && data.hearts_state) || null;
      // (Review 21.07.2026) LWW über modifiedAt (jede echte Mutation stempelt) statt
      // über die Regen-Uhr updatedAt — sonst hätte ein Gerät mit jüngerer Regen-Uhr
      // frisch GEKAUFTE Tipps/Super-Herzen des anderen Geräts überschrieben.
      const local = load();
      const remoteTs = remote ? (remote.modifiedAt || remote.updatedAt || 0) : 0;
      const localTs = local.modifiedAt || local.updatedAt || 0;
      if (remote && remoteTs > localTs) {
        save(remote); // das zuletzt GEÄNDERTE Gerät gewinnt
        notify();
      }
      pushRemote();
    } catch (e) { /* kein Supabase o.ä. */ }
  }
  function setUser(userId) {
    currentUserId = userId || null;
    if (currentUserId) pullAndMerge(currentUserId);
  }

  window.Hearts = {
    state, onChange, setEnabled, loseHeart, canPlay, buyRefill, buySuper, buyTips, useTip, setUser,
    MAX_HEARTS, REGEN_MINUTES, REFILL_COST, SUPER_COST, TIPS_COST, TIPS_PER_PACK, TIP_BUNDLES,
    _pure: { regen },
  };
})();
