/* ==============================================================
   Dünner Supabase-Client-Wrapper: Auth + Profile-Helfer.
   Reines JS (kein JSX), lädt vor allen React-Komponenten. Degradiert
   sauber, wenn app/config.js noch keine echten Werte enthält — dann
   ist window.Auth.isConfigured() false und alle Aufrufe werfen einen
   klaren Fehler statt die App zum Absturz zu bringen.
   ============================================================== */
(function () {
  var URL = window.SUPABASE_URL || '';
  var KEY = window.SUPABASE_ANON_KEY || '';
  var hasSdk = !!(window.supabase && window.supabase.createClient);
  var configured = !!(URL && KEY && hasSdk);
  var client = configured ? window.supabase.createClient(URL, KEY) : null;

  function isConfigured() { return configured; }

  function requireClient() {
    if (!client) throw new Error('Supabase ist noch nicht eingerichtet — app/config.js mit Projekt-URL und anon key ausfüllen.');
    return client;
  }

  async function signUp(email, password, username) {
    const c = requireClient();
    const { data, error } = await c.auth.signUp({ email, password, options: { data: { username: username || '' } } });
    if (error) throw error;
    return data;
  }

  async function signIn(email, password) {
    const c = requireClient();
    const { data, error } = await c.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    if (!client) return;
    await client.auth.signOut();
  }

  async function getSession() {
    if (!client) return null;
    const { data } = await client.auth.getSession();
    return (data && data.session) || null;
  }

  // cb(session|null) wird bei jedem Login/Logout/Token-Refresh aufgerufen.
  // Rückgabewert ist eine Unsubscribe-Funktion.
  function onChange(cb) {
    if (!client) return function () {};
    const { data: sub } = client.auth.onAuthStateChange(function (_event, session) { cb(session); });
    return function () { sub.subscription.unsubscribe(); };
  }

  async function getProfile(userId) {
    if (!client || !userId) return null;
    const { data, error } = await client.from('profiles').select('*').eq('id', userId).single();
    if (error) { console.warn('[supabase] getProfile:', error.message); return null; }
    return data;
  }

  async function updateProfile(userId, fields) {
    const c = requireClient();
    const { data, error } = await c.from('profiles').update(fields).eq('id', userId).select().single();
    if (error) {
      // (Ausbau 21.07.2026) Unique-Verstoß auf lower(username) freundlich übersetzen.
      if (error.code === '23505') throw new Error('Dieser Name ist schon vergeben — bitte einen anderen wählen.');
      throw error;
    }
    return data;
  }

  // (Ausbau 21.07.2026) Ist der Nutzername schon vergeben (case-insensitiv)?
  // Für die Vorab-Prüfung in Registrierung und "Profil bearbeiten". Die harte
  // Durchsetzung übernimmt der Unique-Index (schema.sql Abschnitt 27) — dieser
  // Check ist nur die freundliche Frühwarnung.
  async function isUsernameTaken(name, excludeId) {
    if (!client || !name || !name.trim()) return false;
    let q = client.from('profiles').select('id').ilike('username', name.trim()).limit(1);
    if (excludeId) q = q.neq('id', excludeId);
    const { data } = await q;
    return !!(data && data.length);
  }

  window.sb = client;
  window.Auth = { isConfigured, signUp, signIn, signOut, getSession, onChange, getProfile, updateProfile, isUsernameTaken };
})();
