/* ==============================================================
   Monster-Sammlung (Blueprint Phase 11, 20.07.2026). Bei Gizmo live
   beobachtet (GIZMO_PARITY_CHECKLISTE.md Abschnitt 6): eine volle
   Sammel-Mechanik mit Monster-Ei ("Hatch"), Seltenheitsstufen,
   passivem XP-Bonus je ausgerüstetem Monster (z.B. "Phönix = +50% XP"),
   einer "Nicht gefangen"-Silhouetten-Galerie und Freischaltung an
   Streak-Tage-Meilensteine gekoppelt (20/30/50/75/100/365 laut
   "Top-Sammelobjekte" live abgelesen).

   Eigene, dokumentierte Freiheiten gegenüber dem Original:
   - Die ersten Schwellen (1/3/5/7/10/14 Tage) sind ERGÄNZT, damit die
     Sammlung nicht erst nach 20 Tagen anfängt, Spaß zu machen — bei
     Gizmo wurden nur die höheren Schwellen live abgelesen.
   - Monster-Namen/Emojis sind eigene (das Grid in unserer App nutzte
     diese 15 Emojis schon vorher als Deko — jetzt sind sie echt).
   - Kein Zufalls-Gacha: die Freischaltung ist deterministisch an die
     Serienlänge gekoppelt (das war auch bei Gizmo so ablesbar —
     "Freischaltung nach Streak-Tagen", kein Loot-Box-Kauf).
   - "Geschlüpft" = Schwelle erreicht. Einmal freigeschaltet, bleibt ein
     Monster für immer — auch wenn die Serie später bricht.

   Gleiches Speicher-Muster wie app/xp.js: localStorage ist die synchrone
   Wahrheit, Supabase-Sync (user_monsters + profiles.equipped_monster,
   schema.sql Abschnitt 20) läuft bei Login fire-and-forget hinterher.
   ============================================================== */
(function () {
  const KEY = 's34a_monsters_v1';

  // Seltenheit ergibt sich aus der Schwelle; Bonus gilt nur fürs AUSGERÜSTETE Monster.
  // (Ausbau 23.07.2026) Bonus-Werte an die LIVE bei Gizmo abgelesenen angeglichen:
  // dort gab ein "Frosch" (Gewöhnlich) +20% XP und ein "Phönix" (Selten) +50% XP —
  // deutlich großzügiger als unsere alten 5/10/25/50%. Episch/Legendär sind über die
  // beobachtete Kurve hinaus extrapoliert (75%/100%, dokumentierte Eigenwahl).
  const RARITIES = {
    common:    { label: 'Gewöhnlich', bonus: 0.20, color: '#8FA3B8' },
    rare:      { label: 'Selten',     bonus: 0.50, color: '#56CCF2' },
    epic:      { label: 'Episch',     bonus: 0.75, color: '#A06AF9' },
    legendary: { label: 'Legendär',   bonus: 1.00, color: '#F6C445' },
  };
  const MONSTERS = [
    { id: 'geist',    emoji: '👻', name: 'Geisterchen',   days: 1,   rarity: 'common' },
    { id: 'einhorn',  emoji: '🦄', name: 'Einhorn',       days: 3,   rarity: 'common' },
    { id: 'panzerix', emoji: '🐢', name: 'Panzerix',      days: 5,   rarity: 'common' },
    { id: 'flatter',  emoji: '🦋', name: 'Flatterling',   days: 7,   rarity: 'common' },
    { id: 'kraki',    emoji: '🐙', name: 'Kraki',         days: 10,  rarity: 'rare' },
    { id: 'adler',    emoji: '🦅', name: 'Adlerauge',     days: 14,  rarity: 'rare' },
    { id: 'wolf',     emoji: '🐺', name: 'Nachtwolf',     days: 20,  rarity: 'rare' },
    { id: 'skunki',   emoji: '🦨', name: 'Skunki',        days: 30,  rarity: 'rare' },
    { id: 'delfino',  emoji: '🐬', name: 'Delfino',       days: 50,  rarity: 'epic' },
    { id: 'rexi',     emoji: '🦖', name: 'Rexi',          days: 75,  rarity: 'epic' },
    { id: 'walter',   emoji: '🐳', name: 'Walter',        days: 100, rarity: 'epic' },
    { id: 'drakon',   emoji: '🐉', name: 'Drakon',        days: 150, rarity: 'legendary' },
    { id: 'zebrino',  emoji: '🦓', name: 'Zebrino',       days: 200, rarity: 'legendary' },
    { id: 'smaragd',  emoji: '🐲', name: 'Smaragdling',   days: 250, rarity: 'legendary' },
    { id: 'goldigel', emoji: '🦔', name: 'Goldigel',      days: 365, rarity: 'legendary' },
  ];

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function save(st) {
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* voll/gesperrt */ }
  }
  function state() {
    const st = load();
    // owned: { monsterId: unlockedAt-ISO }; pending: [monsterId,…] noch nicht
    // geschlüpfte Eier (Ausbau 23.07.2026, Gizmo-Egg/Hatch-Mechanik);
    // everEquipped: wurde je bewusst (ab-)ausgerüstet?
    return { owned: st.owned || {}, pending: st.pending || [], equipped: st.equipped || null, everEquipped: !!st.everEquipped };
  }

  let listeners = [];
  function notify() { listeners.slice().forEach((fn) => { try { fn(state()); } catch (e) {} }); }
  function onChange(fn) { listeners.push(fn); return () => { listeners = listeners.filter((f) => f !== fn); }; }

  // Reine, ohne localStorage/Supabase testbare Kernlogik: welche Monster sind bei
  // Serienlänge `streakDays` freigeschaltet, welches ist das nächste Ei?
  function unlockedFor(streakDays) {
    return MONSTERS.filter((m) => m.days <= (streakDays || 0)).map((m) => m.id);
  }
  function nextEgg(ownedIds) {
    const set = new Set(ownedIds || []);
    return MONSTERS.find((m) => !set.has(m.id)) || null; // MONSTERS ist aufsteigend sortiert
  }
  function bonusFor(monsterId) {
    const m = MONSTERS.find((x) => x.id === monsterId);
    return m ? RARITIES[m.rarity].bonus : 0;
  }

  // Wird nach jeder Serien-Verlängerung (app/xp.js touchDay) und beim Rendern der
  // Sammlung aufgerufen. Legt für jedes neu freigeschaltete Monster ein EI in die
  // pending-Warteschlange (statt es sofort zu besitzen) — geschlüpft wird per
  // hatch() mit Reveal-Animation (Gizmo-Egg/Hatch-Mechanik, Ausbau 23.07.2026).
  // Einmal freigeschaltet -> Ei liegt bereit -> nach dem Schlüpfen für immer besessen.
  function checkUnlocks() {
    if (!window.XP) return 0;
    const streak = window.XP.state().streakDays || 0;
    const st = state();
    const have = new Set([...Object.keys(st.owned), ...st.pending]);
    const fresh = unlockedFor(streak).filter((id) => !have.has(id));
    if (!fresh.length) return 0;
    st.pending = [...st.pending, ...fresh]; // Reihenfolge bleibt (aufsteigende Schwelle)
    save(st);
    notify();
    return st.pending.length; // wie viele Eier warten insgesamt
  }

  // Ein bereitliegendes Ei schlüpfen lassen: nimmt das nächste pending-Monster,
  // macht es besessen (auto-equip, falls nie bewusst gewählt), synct und liefert
  // das geschlüpfte Monster zurück (für die Reveal-Animation). null, wenn kein Ei.
  function hatch() {
    const st = state();
    if (!st.pending.length) return null;
    const id = st.pending[0];
    st.pending = st.pending.slice(1);
    st.owned[id] = new Date().toISOString();
    if (!st.equipped && !st.everEquipped) st.equipped = id;
    save(st);
    pushRemote([id]);
    notify();
    return MONSTERS.find((m) => m.id === id) || null;
  }
  function pendingCount() { return state().pending.length; }

  function equip(monsterId) {
    const st = state();
    if (monsterId !== null && !st.owned[monsterId]) return { ok: false, reason: 'not-owned' };
    st.equipped = monsterId;
    st.everEquipped = true; // bewusste Nutzer-Entscheidung — kein Auto-Equip mehr danach
    save(st);
    if (currentUserId && window.sb) {
      window.sb.from('profiles').update({ equipped_monster: monsterId }).eq('id', currentUserId)
        .then(({ error }) => { if (error) console.warn('[monsters] equip-Sync fehlgeschlagen:', error.message); });
    }
    notify();
    return { ok: true };
  }

  // Passiver XP-Bonus des ausgerüsteten Monsters (0..0.5) — wird von app/xp.js
  // award() zur Laufzeit abgefragt (xp.js lädt früher, ruft aber erst später auf).
  function equippedBonus() {
    const st = state();
    return st.equipped ? bonusFor(st.equipped) : 0;
  }

  /* ---- Supabase-Sync ---- */
  let currentUserId = null;
  function pushRemote(freshIds) {
    if (!currentUserId || !window.sb) return;
    const st = state();
    const ids = freshIds || Object.keys(st.owned);
    ids.forEach((id) => {
      window.sb.from('user_monsters').upsert({
        user_id: currentUserId, monster_id: id, unlocked_at: st.owned[id] || new Date().toISOString(),
      }).then(({ error }) => { if (error) console.warn('[monsters] Sync fehlgeschlagen:', error.message); });
    });
  }
  async function pullAndMerge(userId) {
    if (!window.sb) return;
    try {
      const [{ data: rows }, { data: prof }] = await Promise.all([
        window.sb.from('user_monsters').select('monster_id, unlocked_at').eq('user_id', userId),
        window.sb.from('profiles').select('equipped_monster').eq('id', userId).single(),
      ]);
      const st = state();
      let changed = false;
      (rows || []).forEach((r) => {
        if (!st.owned[r.monster_id]) { st.owned[r.monster_id] = r.unlocked_at; changed = true; }
      });
      // (Ausbau 23.07.2026) Auf einem anderen Gerät schon geschlüpfte Monster nicht
      // erneut als Ei anbieten — aus der pending-Warteschlange entfernen.
      const prunedPending = st.pending.filter((id) => !st.owned[id]);
      if (prunedPending.length !== st.pending.length) { st.pending = prunedPending; changed = true; }
      if (!st.equipped && prof && prof.equipped_monster && st.owned[prof.equipped_monster]) {
        st.equipped = prof.equipped_monster; changed = true;
      }
      if (changed) { save(st); notify(); }
      pushRemote();
    } catch (e) { /* kein Supabase konfiguriert o.ä. */ }
  }
  function setUser(userId) {
    currentUserId = userId || null;
    if (currentUserId) pullAndMerge(currentUserId);
  }

  window.Monsters = {
    MONSTERS, RARITIES,
    state, onChange, checkUnlocks, hatch, pendingCount, equip, equippedBonus, setUser,
    _pure: { unlockedFor, nextEgg, bonusFor },
  };
})();
