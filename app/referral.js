/* ==============================================================
   Referral-Programm — "Freunde einladen" (Blueprint Phase 16,
   20.07.2026). Bei Gizmo beobachtet: Einladen per QR-Code, Link und
   Social-Share-Buttons, Belohnung "10 Superherzen pro eingeladenem
   Freund".

   Eigene, dokumentierte Abweichungen:
   - Belohnung: 10 MÜNZEN statt 10 Superherzen (Münzen sind bei uns die
     knappe Universal-Währung, mit der sich auch Super-Herzen kaufen
     lassen — flexibler für die Eingeladenen-Werber:in). Damit gibt es
     erstmals eine Münz-Verdienquelle jenseits der Combo-Meilensteine
     (Checkliste Abschnitt 5).
   - Share-Buttons: WhatsApp, Telegram, E-Mail (statt Snapchat/TikTok/
     GroupMe — sinnvollere Auswahl für den deutschsprachigen
     §34a-Kontext).
   - QR-Code über die qrcodejs-CDN-Bibliothek; ist sie nicht ladbar
     (z.B. Offline-Vorschau), erscheint stattdessen der Link als Text —
     kein harter Fehler.

   Ablauf ohne Server-Trigger (wie alles in dieser App):
   1. Einladung = Link mit ?ref=<user_id>. Beim Öffnen merkt sich der
      Client den ref-Parameter in localStorage (captureFromUrl).
   2. Registriert sich die eingeladene Person und loggt sich ein,
      schreibt IHR Client eine Zeile in `referrals` (RLS: nur als man
      selbst, nur einmal — new_user_id ist Primary Key) und legt als
      Aktor:in eine Benachrichtigung in die Inbox der Werber:in.
      Guard: das eigene Konto muss jünger als 3 Tage sein, damit sich
      Bestandskonten nicht nachträglich als "geworben" eintragen.
   3. Die Werber:in prüft bei jedem Login checkRewards(): noch nicht
      belohnte referrals-Zeilen (rewarded_at is null, serverseitig
      einmalig markiert) geben je +10 Münzen.
   ============================================================== */
(function () {
  const REWARD_COINS = 10;
  const PENDING_KEY = 's34a_pending_ref';
  const MAX_ACCOUNT_AGE_DAYS = 3;

  function inviteLink(myId) {
    return location.origin + location.pathname + '?ref=' + encodeURIComponent(myId);
  }

  // Beim App-Start aufrufen: ?ref=... aus der URL in localStorage übernehmen.
  function captureFromUrl() {
    try {
      const params = new URLSearchParams(location.search);
      const ref = params.get('ref');
      if (ref && ref.length > 10) localStorage.setItem(PENDING_KEY, ref);
      return ref || null;
    } catch (e) { return null; }
  }

  // Reine Prüfung (testbar): darf dieses Konto als "geworben" gelten?
  function isEligible(myId, refId, accountCreatedAtMs, nowMs) {
    if (!myId || !refId || refId === myId) return false;
    const ageDays = (nowMs - accountCreatedAtMs) / 86400000;
    return ageDays >= 0 && ageDays <= MAX_ACCOUNT_AGE_DAYS;
  }

  // Nach Login der (potenziell) eingeladenen Person: referrals-Zeile anlegen.
  async function claimPending(myId) {
    if (!window.sb || !myId) return;
    let refId = null;
    try { refId = localStorage.getItem(PENDING_KEY); } catch (e) { return; }
    if (!refId) return;
    try {
      // Schon eingetragen? (new_user_id ist PK — doppelt geht ohnehin nicht.)
      const { data: existing } = await window.sb.from('referrals').select('new_user_id').eq('new_user_id', myId).maybeSingle();
      if (existing) { localStorage.removeItem(PENDING_KEY); return; }
      const { data: prof } = await window.sb.from('profiles').select('created_at').eq('id', myId).single();
      const createdAt = prof && prof.created_at ? new Date(prof.created_at).getTime() : 0;
      if (!isEligible(myId, refId, createdAt, Date.now())) { localStorage.removeItem(PENDING_KEY); return; }
      const { error } = await window.sb.from('referrals').insert({ new_user_id: myId, referrer_id: refId });
      if (!error) {
        if (window.Notifications) await window.Notifications.insert(refId, myId, 'referral', { reward: REWARD_COINS });
        localStorage.removeItem(PENDING_KEY);
      } else if (error.code === '23505' || error.code === '23503' || error.code === '23514') {
        // Duplikat/FK/Check-Verstoß: dauerhaft aussichtslos -> Pending aufräumen.
        localStorage.removeItem(PENDING_KEY);
      }
      // (Review 21.07.2026) Bei transienten Fehlern (Netz/5xx) bleibt der Pending-Key
      // erhalten und der nächste Login versucht es erneut — vorher ging der Anspruch
      // bei jedem Fehlschlag endgültig verloren.
    } catch (e) { /* kein Supabase o.ä. — Pending bleibt für den nächsten Versuch */ }
  }

  // Nach Login der Werber:in: noch nicht belohnte Referrals gutschreiben.
  // (Review 21.07.2026) Vorher nur ein localStorage-Diff — auf jedem neuen Gerät
  // wären ALLE bestehenden Referrals erneut belohnt worden (beliebig farmbar).
  // Jetzt serverseitig einmalig: rewarded_at wird direkt in der referrals-Zeile
  // gesetzt (RLS-update-Policy nur für die Werber:in, schema.sql Abschnitt 24).
  // WICHTIG: erst markieren, DANN gutschreiben — schlägt das Markieren fehl,
  // entgeht einem schlimmstenfalls eine Belohnung bis zum nächsten Versuch,
  // aber es gibt nie eine Doppel-Gutschrift.
  async function checkRewards(myId) {
    if (!window.sb || !myId) return 0;
    try {
      const { data: rows } = await window.sb.from('referrals')
        .select('new_user_id').eq('referrer_id', myId).is('rewarded_at', null);
      if (!rows || !rows.length) return 0;
      const ids = rows.map((r) => r.new_user_id);
      const { data: marked, error } = await window.sb.from('referrals')
        .update({ rewarded_at: new Date().toISOString() })
        .eq('referrer_id', myId).is('rewarded_at', null).in('new_user_id', ids)
        .select('new_user_id');
      if (error || !marked || !marked.length) return 0;
      if (window.XP) window.XP.addCoins(marked.length * REWARD_COINS);
      return marked.length;
    } catch (e) { return 0; }
  }

  window.Referral = {
    REWARD_COINS, inviteLink, captureFromUrl, claimPending, checkRewards,
    _pure: { isEligible },
  };
  // ref-Parameter sofort beim Laden sichern (bevor irgendeine Navigation die URL ändert).
  captureFromUrl();
})();
