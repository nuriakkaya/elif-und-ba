/* global React, ReactDOM, Icon, Axolotl, MiniAxolotl, Mammoth, Owl, Joystick, Target, ImportTile, AnimalAvatar, TutorMarkdown */
const { useState, useEffect, useRef, useMemo, useCallback } = React;

/* ============== DATA ============== */
// Die 8 echten Themengebiete kommen aus data.js (window.S34A_TOPICS), das aus der
// bestehenden §34a-Lernplan-App konvertiert wurde (251 Karten, 913 Quizfragen, Fallbeispiele).
// Dazu kommen eigene (KI-generierte oder manuelle) Stapel aus app/customtopics.js
// (Blueprint Phase 3) — gleiche Form, gleiche Behandlung überall in der App. Da sich
// eigene Stapel zur Laufzeit ändern können (neu erstellt, Karten hinzugefügt), sind
// das hier bewusst KEINE einmalig berechneten consts mehr, sondern ein "Index", der
// bei jeder Änderung neu gebaut wird (rebuildTopicIndex(), von App() abonniert).
let S34A_CHILDREN = [];
let QURAN_CHILDREN = [];
let EXTRA_CHILDREN = [];
let CUSTOM_CHILDREN = [];
let ARCHIVED_CHILDREN = [];
let SHARED_CHILDREN = [];
let S34A_BY_ID = {};
let STACKS = [];

function rebuildTopicIndex() {
  // Sachkunde/§34a-Inhalte auf Nutzerwunsch entfernt (05.08.2026) — data.js bleibt
  // als Datei liegen, wird aber nirgendwo mehr angezeigt. Hauptinhalt: Koran-Kurs.
  S34A_CHILDREN = [];
  // Koran-Modul (Elif & Ba Fusion): gleiche Form, eigener Freischalt-Pfad (app/quran.js)
  QURAN_CHILDREN = ((window.QuranCourse && window.QuranCourse.ordered()) || []).map(t => ({ id: t.id, name: t.name, color: t.color, topic: t }));
  // Nachtausbau P5: Koran-Wortschatz + Namaz-Gebete — frei lernbare Stapel
  // mit dem Quran-Progress-Lernerlebnis, außerhalb des Freischalt-Pfads.
  EXTRA_CHILDREN = (window.QURAN_EXTRA_TOPICS || []).map(t => ({ id: t.id, name: t.name, color: t.color, topic: t }));
  const customTopics = (window.CustomTopics && window.CustomTopics.list()) || [];
  // Archivierte Stapel (Kontextmenü, Phase 16) bleiben voll erhalten und lernbar,
  // werden aber aus der Haupt-Ansicht/den Auswahllisten herausgehalten.
  CUSTOM_CHILDREN = customTopics.filter(t => !t.archived).map(t => ({ id: t.id, name: t.name, color: t.color, topic: t }));
  ARCHIVED_CHILDREN = customTopics.filter(t => t.archived).map(t => ({ id: t.id, name: t.name, color: t.color, topic: t }));
  // Geteilte/kollaborative Stapel (app/sharedstacks.js, Phase 16) — nur bei Login vorhanden.
  const sharedTopics = (window.SharedStacks && window.SharedStacks.list()) || [];
  SHARED_CHILDREN = sharedTopics.map(t => ({ id: t.id, name: t.name, color: t.color, topic: t }));

  S34A_BY_ID = {};
  S34A_CHILDREN.forEach(c => { S34A_BY_ID[c.id] = c.topic; });
  QURAN_CHILDREN.forEach(c => { S34A_BY_ID[c.id] = c.topic; });
  EXTRA_CHILDREN.forEach(c => { S34A_BY_ID[c.id] = c.topic; });
  CUSTOM_CHILDREN.forEach(c => { S34A_BY_ID[c.id] = c.topic; });
  ARCHIVED_CHILDREN.forEach(c => { S34A_BY_ID[c.id] = c.topic; });
  SHARED_CHILDREN.forEach(c => { S34A_BY_ID[c.id] = c.topic; });

  STACKS = [
    { id: 'quran', name: 'Koran lesen – Elif & Ba', color: '#1B7A6E', hasChildren: true, children: QURAN_CHILDREN },
    ...EXTRA_CHILDREN.map(c => ({ id: c.id, name: c.name, color: c.color, topic: c.topic })),
    ...CUSTOM_CHILDREN.map(c => ({ id: c.id, name: c.name, color: c.color, topic: c.topic })),
    ...SHARED_CHILDREN.map(c => ({ id: c.id, name: c.name, color: c.color, topic: c.topic })),
    ...ARCHIVED_CHILDREN.map(c => ({ id: c.id, name: c.name, color: c.color, topic: c.topic })),
  ];
}
rebuildTopicIndex();

function flatQuiz(topic) {
  if (!topic) return [];
  const out = [];
  topic.blocks.forEach(b => b.quiz.forEach(q => out.push(q)));
  return out;
}
function flatCards(topic) {
  if (!topic) return [];
  const out = [];
  topic.blocks.forEach(b => b.cards.forEach(c => out.push(c)));
  return out;
}
function flatCases(topic) {
  if (!topic) return [];
  const out = [];
  topic.blocks.forEach(b => b.cases.forEach(c => out.push({ ...c, blockTitle: b.title })));
  return out;
}

// Klassen-Edition: die frühere FRIENDS-Beispiel-Liste (Fake-Namen) ist entfernt —
// ohne Anmeldung zeigen Feed & Ranglisten jetzt einen ehrlichen Leerzustand.

/* (07.08.2026, Nutzerwunsch) Navigation entschlackt: "Öffentliche Stapel" und
   "Profil" sind raus — das Profil erreicht man über den eigenen Namens-Chip
   oben rechts. Unten bleiben 4 klare Ziele: Start, Fortschritt, Stapel, Klasse. */
const NAV = [
  { id: 'home', label: 'Startseite', icon: 'Home' },
  { id: 'progress', label: 'Fortschritt', icon: 'Flame' },
  { id: 'decks', label: 'Meine Stapel', icon: 'Folder' },
];


// findet einen Stack ODER Unterstapel (Themengebiet) über die ganze STACKS-Struktur
function findStack(id) {
  for (const s of STACKS) {
    if (s.id === id) return s;
    if (s.children) { const c = s.children.find(x => x.id === id); if (c) return c; }
  }
  return null;
}

/* ============== TWEAKS DEFAULTS ============== */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#7A7BF5",
  "dark": false,
  "questionStyle": "Multiple Choice",
  "sounds": true,
  "haptik": true
}/*EDITMODE-END*/;

/* ============== ROOT ============== */
function App() {
  const [tweaks, setTweak] = window.useTweaks ? window.useTweaks(TWEAK_DEFAULTS) : [TWEAK_DEFAULTS, ()=>{}];
  // Von der Lehrkraft geänderte Buchstaben: sobald neue Überschreibungen
  // eintreffen, wird die ganze Oberfläche neu gezeichnet — dadurch steht die
  // neue Umschrift sofort überall, ohne dass jemand neu laden muss.
  const [, bumpCards] = useState(0);
  useEffect(() => window.CardEdits && window.CardEdits.onChange(() => bumpCards(x => x + 1)), []);

  // apply tweak side-effects
  useEffect(() => {
    document.body.classList.toggle('theme-dark', !!tweaks.dark);
    document.documentElement.style.setProperty('--accent', tweaks.accent);
    // recompute accent-soft as light tint
    document.documentElement.style.setProperty('--accent-soft', hexToTint(tweaks.accent, 0.12));
  }, [tweaks.dark, tweaks.accent]);

  // Sound-/Haptik-Einstellungen (Settings-Toggles) an das Sound-Modul weiterreichen.
  useEffect(() => {
    if (window.Sound) {
      window.Sound.setEnabled(tweaks.sounds !== false);
      window.Sound.setHapticEnabled(tweaks.haptik !== false);
    }
  }, [tweaks.sounds, tweaks.haptik]);

  const [route, setRoute] = useState({ screen: 'home' });
  const [modal, setModal] = useState(null);   // { kind, ...payload }
  const [activeStack, setActiveStack] = useState((QURAN_CHILDREN[0] && QURAN_CHILDREN[0].id) || 'quran-harfler');
  const [scrolled, setScrolled] = useState(false);
  const [teacherUnlocked, setTeacherUnlocked] = useState(false);
  const mainRef = useRef(null);

  // Echte Accounts (Roadmap-Punkt 13, Supabase Auth) — session ist null, solange
  // niemand eingeloggt ist oder kein Supabase-Projekt konfiguriert ist (app/config.js).
  // Der Rest der App bleibt dann exakt beim bisherigen localStorage-only-Verhalten.
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!window.Auth || !window.Auth.isConfigured()) return;
    let cancelled = false;
    window.Auth.getSession().then((s) => { if (!cancelled) setSession(s); });
    const unsub = window.Auth.onChange((s) => setSession(s));
    return () => { cancelled = true; unsub(); };
  }, []);

  useEffect(() => {
    const userId = session && session.user && session.user.id;
    if (window.SRS && window.SRS.setUser) window.SRS.setUser(userId || null);
    if (window.XP && window.XP.setUser) window.XP.setUser(userId || null);
    if (window.CustomTopics && window.CustomTopics.setUser) window.CustomTopics.setUser(userId || null);
    if (window.AIHistory && window.AIHistory.setUser) window.AIHistory.setUser(userId || null);
    if (window.Presence && window.Presence.setUser) window.Presence.setUser(userId || null, null);
    if (window.Notifications && window.Notifications.setUser) window.Notifications.setUser(userId || null);
    if (window.Monsters && window.Monsters.setUser) window.Monsters.setUser(userId || null);
    if (window.Hearts && window.Hearts.setUser) window.Hearts.setUser(userId || null);
    if (window.SharedStacks && window.SharedStacks.setUser) window.SharedStacks.setUser(userId || null);
    // Referral-Programm (Phase 16): eigenen ausstehenden Einladungslink einlösen
    // + neue geworbene Freunde belohnen (beides fire-and-forget, app/referral.js).
    if (userId && window.Referral) {
      window.Referral.claimPending(userId);
      window.Referral.checkRewards(userId);
    }
    if (!userId) { setProfile(null); return; }
    let cancelled = false;
    window.Auth.getProfile(userId).then((p) => { if (!cancelled) setProfile(p); });
    return () => { cancelled = true; };
  }, [session && session.user && session.user.id]);

  // Presence trackt Nutzername/Avatar mit — die kommen erst mit `profile` nach (siehe
  // Effekt oben), deshalb hier ein zweites Mal aktualisieren, sobald es geladen ist.
  useEffect(() => {
    const userId = session && session.user && session.user.id;
    if (userId && profile && window.Presence && window.Presence.setUser) window.Presence.setUser(userId, profile);
  }, [profile]);

  // Einfach-Konto (Name-Login über app/simplesync.js, 06.08.2026): Stand für
  // Topbar-Chip & Co. abonnieren — komplett unabhängig von Supabase.
  const [ssStatus, setSsStatus] = useState(() => (window.SimpleSync ? window.SimpleSync.status() : { account: null, state: 'idle' }));
  useEffect(() => {
    if (!window.SimpleSync) return undefined;
    return window.SimpleSync.onChange((st) => setSsStatus(st));
  }, []);

  // Eigene Stapel (app/customtopics.js) können sich jederzeit ändern (neu erstellt,
  // KI-Karten hinzugefügt, vom Server nachgeladen) — Index neu bauen und Re-Render
  // erzwingen, damit z.B. "Meine Stapel" und die Live-Themenauswahl sofort aktuell sind.
  const [, setCustomVersion] = useState(0);
  useEffect(() => {
    if (!window.CustomTopics) return undefined;
    return window.CustomTopics.onChange(() => {
      rebuildTopicIndex();
      setCustomVersion((v) => v + 1);
    });
  }, []);
  // Geteilte Stapel (app/sharedstacks.js) ändern sich bei Login/Beitritt/Karten-Sync —
  // gleiche Re-Index-Logik wie bei den eigenen Stapeln.
  useEffect(() => {
    if (!window.SharedStacks) return undefined;
    return window.SharedStacks.onChange(() => {
      rebuildTopicIndex();
      setCustomVersion((v) => v + 1);
    });
  }, []);
  // Herzen-System-Toggle (Settings, Phase 14): ans Hearts-Modul weiterreichen.
  useEffect(() => {
    if (window.Hearts) window.Hearts.setEnabled(false); // Klassen-Edition: immer unbegrenzt ∞
  }, [tweaks.hearts]);

  // expose nav for child components
  const go = useCallback((screen, payload = {}) => setRoute({ screen, ...payload }), []);
  const openModal = useCallback((kind, payload = {}) => setModal({ kind, ...payload }), []);
  const closeModal = useCallback(() => setModal(null), []);

  // bind scroll for sticky topbar shadow
  useEffect(() => {
    const el = mainRef.current; if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 4);
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // (07.08.2026, Nutzerkritik "wenn man auf einen Stapel klickt, muss man erst
  // hochscrollen"): Bei JEDEM Seitenwechsel nach ganz oben springen — die alte
  // Scroll-Position der Liste darf nicht in den nächsten Screen mitwandern.
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
    try { window.scrollTo(0, 0); } catch (e) {}
  }, [route.screen, activeStack]);

  // Profil nach einem Speichern sofort neu laden (Review 21.07.2026: vorher zeigten
  // Topbar-Avatar/Profilkopf bis zum Neuladen die alten Werte, weil `profile` nur
  // beim Wechsel der User-ID geladen wurde).
  const refreshProfile = useCallback(() => {
    const userId = session && session.user && session.user.id;
    if (userId && window.Auth) window.Auth.getProfile(userId).then((p) => setProfile(p));
  }, [session && session.user && session.user.id]);

  const ctx = { route, go, modal, openModal, closeModal, activeStack, setActiveStack, tweaks, setTweak, teacherUnlocked, setTeacherUnlocked, session, profile, refreshProfile, ssAccount: ssStatus.account, ssState: ssStatus.state, topics: S34A_CHILDREN.concat(QURAN_CHILDREN, EXTRA_CHILDREN, CUSTOM_CHILDREN, SHARED_CHILDREN) };

  // quiz takes over full screen
  if (route.screen === 'quiz') {
    const activeTopic = S34A_BY_ID[activeStack];
    const questions = route.questions || flatQuiz(activeTopic);
    return <>
      <QuizScreen go={go} stackName={(findStack(activeStack)||{}).name || 'Stapel'} questionStyle={tweaks.questionStyle} questions={questions} topicId={activeStack} roundSize={route.roundSize}/>
      {modal && <Modals ctx={ctx} />}
    </>;
  }
  if (route.screen === 'quizLoading') {
    // roundSize ("Große Runde" aus dem Modus-Modal) über den Ladescreen weiterreichen.
    return <QuizLoading onDone={() => go('quiz', { roundSize: route.roundSize })}/>;
  }
  if (route.screen === 'lesson') {
    return <>
      <LessonScreen go={go} stackName={(findStack(activeStack)||{}).name || 'Stapel'} topicId={activeStack} blockIdx={route.blockIdx || 0}/>
      {modal && <Modals ctx={ctx} />}
    </>;
  }
  if (route.screen === 'test') {
    const activeTopic = S34A_BY_ID[activeStack];
    const questions = route.questions || flatQuiz(activeTopic);
    return <>
      <TestScreen go={go} stackName={(findStack(activeStack)||{}).name || 'Stapel'} questions={questions} topicId={activeStack} count={route.count || 20} userId={ctx.session && ctx.session.user && ctx.session.user.id}/>
      {modal && <Modals ctx={ctx} />}
    </>;
  }

  return (
    <div className="app">
      <Sidebar ctx={ctx} />
      <MobileNav ctx={ctx} />
      <main className="main" ref={mainRef} style={{maxHeight:'100vh', overflow:'auto'}}>
        <Topbar ctx={ctx} scrolled={scrolled}/>
        <Routes ctx={ctx} />
      </main>
      {modal && <Modals ctx={ctx} />}
      <WaveToasts/>
    </div>
  );
}

/* Zeigt eingehende "👋 Winken"-Broadcasts (app/presence.js) als kurze Toasts an —
   bewusst rein visuell/ephemer, siehe Kommentar-Kopf in presence.js. Sitzt hier auf
   App-Ebene statt nur auf der Startseite, damit ein Wink ankommt, egal welche Seite
   gerade offen ist (Quiz/Lektion/Test-Vollbildschirme ausgenommen, die rendern früher
   und ohne diesen Wrapper). */
function WaveToasts() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    if (!window.Presence) return;
    return window.Presence.onWave((payload) => {
      const id = payload.from + ':' + Date.now();
      setToasts((t) => [...t, { id, ...payload }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
    });
  }, []);
  if (!toasts.length) return null;
  return (
    <div style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 200, display: 'grid', gap: 8 }}>
      {toasts.map((t) => (
        <div key={t.id} className="card flat" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 16px', boxShadow: '0 6px 24px rgba(0,0,0,.15)' }}>
          <span style={{ fontSize: 22 }}>{t.fromAvatar || '🦔'}</span>
          <span style={{ fontWeight: 700 }}>👋 {t.fromName || 'Jemand'} hat dir gewunken!</span>
        </div>
      ))}
    </div>
  );
}

function hexToTint(hex, alpha) {
  if (!hex || hex[0] !== '#') return 'rgba(122,123,245,0.12)';
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ============== 📲 INSTALL-BANNER (Home, nur mobil im Browser) ==============
   Gut sichtbarer Weg zur Installation (Nutzerkritik 06.08.2026: "Ich hab
   nirgendwo das Installieren gefunden"). Android: echter Install-Dialog über
   beforeinstallprompt; iPhone/iPad: Schritt-Anleitung. In der installierten
   App (standalone) und am Desktop erscheint das Banner nicht. */
function InstallBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem('lern_install_dismissed_v1') === '1'; } catch (e) { return true; }
  });
  const [showSteps, setShowSteps] = useState(false);
  const [, force] = useState(0);
  useEffect(() => {
    const h = () => force(x => x + 1);
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (dismissed || standalone || !isMobile) return null;
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const doInstall = () => {
    if (window.PWAInstall && window.PWAInstall.prompt()) return; // Android: echter Dialog
    setShowSteps(true); // sonst: Kurz-Anleitung zeigen
  };
  const close = () => { setDismissed(true); try { localStorage.setItem('lern_install_dismissed_v1', '1'); } catch (e) {} };
  return (
    <div className="install-banner">
      <span className="ib-emoji">📲</span>
      <div className="ib-txt">
        <div className="ib-title">Als App aufs Handy!</div>
        <div className="ib-sub">Eigenes Icon, Vollbild, funktioniert auch offline.</div>
        {showSteps && (
          <div className="install-steps">
            {ios
              ? <>In <b>Safari</b>: unten das <b>Teilen-Symbol</b> (Viereck mit Pfeil) tippen → <b>„Zum Home-Bildschirm“</b> → Hinzufügen. Fertig! 🎉</>
              : <>Im Browser-Menü <b>⋮</b> (oben rechts) auf <b>„App installieren“</b> bzw. <b>„Zum Startbildschirm hinzufügen“</b> tippen. Fertig! 🎉</>}
          </div>
        )}
      </div>
      {!showSteps && <button className="ib-btn" onClick={doInstall}>Installieren</button>}
      <button className="ib-close" onClick={close} title="Ausblenden">✕</button>
    </div>
  );
}

/* ============== KLASSENZIMMER: SCHÜLER-KARTE (Home) ============== */
// Seit 06.08.2026 automatisch: Wer mit Namen angemeldet ist und einen Kurs-Code
// hat, dessen Fortschritt wandert von selbst zur Lehrkraft (SimpleSync →
// /api/class). Der alte Kopier-Code bleibt als Offline-Ersatz erhalten.
/* Einstieg ins Live-Duell auf der Startseite — mit Hinweis, wenn
   gerade jemand herausfordert. */
function DuelCard({ ctx }) {
  const [inv, setInv] = useState(window.DuelInvites ? window.DuelInvites.list() : []);
  useEffect(() => window.DuelInvites && window.DuelInvites.onChange(setInv), []);
  const has = inv.length > 0;
  return (
    <div className="card" style={{padding: 16, marginTop: 14,
         borderLeft: has ? '5px solid var(--accent, #2A6BE0)' : undefined}}>
      <div className="row" style={{gap: 12, alignItems: 'center', flexWrap: 'wrap'}}>
        <div style={{fontSize: 30}}>⚔️</div>
        <div style={{flex: '1 1 200px'}}>
          <div style={{fontWeight: 800, fontSize: 16}}>
            {has ? '🔔 ' + inv[0].from + ' fordert dich heraus!' : 'Live-Duell'}
          </div>
          <div className="muted" style={{fontSize: 13, marginTop: 2}}>
            {has
              ? 'Tippe auf Annehmen — ihr bekommt beide dieselben Fragen.'
              : 'Spiel gegen deine Freunde: gleiche Fragen, wer schneller richtig ist, gewinnt.'}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => ctx.go('duel')}>
          {has ? 'Annehmen' : 'Duell starten'}
        </button>
      </div>
    </div>
  );
}

/* 🕌 Auswendig-Karte auf der Startseite (11.08.2026).
   Zeigt Rang + Krone, den nächsten sinnvollen Schritt und — ganz wichtig
   für die Motivation — was die nächste fertige Sure einbringt. Ist eine
   Auffrischung fällig, wird die Karte zur Erinnerung. */
function HifzCard({ ctx }) {
  const [, force] = useState(0);
  useEffect(() => (window.Hifz ? window.Hifz.onChange(() => force((x) => x + 1)) : undefined), []);
  if (!window.Hifz || !(window.HIFZ_ITEMS || []).length) return null;
  if (window.Hifz.courseInfo && !window.Hifz.courseInfo().open) return null;   // erst nach dem Kurs
  const s = window.Hifz.summary();
  const due = (window.HIFZ_ITEMS || []).filter((it) => window.Hifz.repDue(it.id));
  const started = (window.HIFZ_ITEMS || []).find((it) => !window.Hifz.itemState(it.id).done && window.Hifz.progressPct(it.id) > 0);
  const nextItem = started || (window.HIFZ_ITEMS || []).find((it) => it.stern && !window.Hifz.itemState(it.id).done)
                 || (window.HIFZ_ITEMS || []).find((it) => !window.Hifz.itemState(it.id).done);
  return (
    <div className="card" style={{padding: 16, marginTop: 14,
         borderLeft: due.length ? '5px solid #F0C33C' : undefined}}>
      <div className="row" style={{gap: 12, alignItems: 'center', flexWrap: 'wrap'}}>
        <div style={{fontSize: 30}}>{s.done > 0 ? s.rank.icon : '🕌'}</div>
        <div style={{flex: '1 1 200px'}}>
          <div style={{fontWeight: 800, fontSize: 16}}>
            {due.length ? '🔁 ' + due[0].name + ' auffrischen' : s.done > 0 ? s.rank.title + ' · ' + s.done + ' auswendig' : 'Suren auswendig lernen'}
          </div>
          <div className="muted" style={{fontSize: 13, marginTop: 2}}>
            {due.length
              ? 'Einmal aufsagen genügt, dann sitzt es wieder — und es gibt +' + window.Hifz.XP_REFRESH + ' XP.'
              : nextItem
                ? 'Als Nächstes: ' + nextItem.name + ' — die höchsten Punkte der App (+' + window.Hifz.completionBonus() + ' XP für die nächste fertige Sure).'
                : 'Alles auswendig — maschallah! Halte es mit den Auffrischungen wach.'}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => ctx.go('hifz')}>
          {due.length ? 'Auffrischen' : s.done > 0 ? 'Weitermachen' : 'Loslegen'}
        </button>
      </div>
    </div>
  );
}

/* ♾️ Der Knopf zum Unendlich-XP-Modus (11.08.2026).
   Vor der Freischaltung zeigt er ehrlich, wie weit es noch ist — ein
   Schloss ohne Erklärung frustriert Kinder nur. */
/* Startseiten-Karte für den Unendlich-Modus — erscheint erst, wenn er
   freigeschaltet ist. Vorher wäre sie nur eine Dauer-Enttäuschung. */
/* 🕌 Knopf zum Auswendiglernen — zeigt vor der Freischaltung ehrlich den Stand.
   Auswendiglernen ist die Kür: erst lesen können, dann auswendig lernen. */
function HifzButton({ ctx }) {
  if (!window.Hifz || !window.Hifz.courseInfo) {
    return <button className="btn btn-primary" onClick={() => ctx.go('hifz')}>🕌 Auswendig lernen</button>;
  }
  const info = window.Hifz.courseInfo();
  if (info.open) return <button className="btn btn-primary" onClick={() => ctx.go('hifz')}>🕌 Auswendig lernen</button>;
  return (
    <button className="btn btn-ghost" title={'Noch ' + (info.total - info.done) + ' Lektionen auf 100 % bringen'}
            onClick={() => ctx.go('hifz')}>
      🔒 🕌 Auswendig lernen · {info.done}/{info.total}
    </button>
  );
}

function InfinityCard({ ctx }) {
  if (!window.InfinityMode) return null;
  const info = window.InfinityMode.unlockInfo();
  if (!info.open) return null;
  const st = window.InfinityMode.load();
  return (
    <div className="card" style={{padding: 16, marginTop: 14, borderLeft: '5px solid #4B2E83'}}>
      <div className="row" style={{gap: 12, alignItems: 'center', flexWrap: 'wrap'}}>
        <div style={{fontSize: 30}}>♾️</div>
        <div style={{flex: '1 1 200px'}}>
          <div style={{fontWeight: 800, fontSize: 16}}>Unendlich-XP</div>
          <div className="muted" style={{fontSize: 13, marginTop: 2}}>
            {st.waves > 0
              ? st.waves + ' Wellen geschafft · ' + st.xp + ' XP hier verdient · beste Serie ' + st.best
              : 'Alles kreuz und quer abgefragt — und die Punkte gehen nie aus.'}
          </div>
        </div>
        <button className="btn" style={{background:'#4B2E83', color:'#fff'}} onClick={() => ctx.go('infinity')}>Welle starten</button>
      </div>
    </div>
  );
}

function InfinityButton({ ctx }) {
  if (!window.InfinityMode) return null;
  const info = window.InfinityMode.unlockInfo();
  if (info.open) {
    return <button className="btn" style={{background:'#4B2E83', color:'#fff'}} onClick={() => ctx.go('infinity')}>♾️ Unendlich-XP</button>;
  }
  return (
    <button className="btn btn-ghost" title={'Noch ' + (info.total - info.done) + ' Lektionen zweimal durchspielen'}
            onClick={() => ctx.go('infinity')}>
      🔒 ♾️ Unendlich-XP · {info.done}/{info.total}
    </button>
  );
}

function ClassroomCard({ ctx }) {
  const CR = window.Classroom;
  const [name, setName] = useState(() => (CR ? CR.getName() : ''));
  const [copied, setCopied] = useState(false);
  const [show, setShow] = useState(false);
  if (!CR) return null;
  const acc = window.SimpleSync && window.SimpleSync.account();
  // Lehrkraft: direkter Sprung ins Klassenzimmer statt Schüler-Ansicht.
  if (acc && acc.role === 'teacher') {
    return (
      <div className="card" style={{padding: 16, marginTop: 14}}>
        <div className="row" style={{gap: 12, alignItems: 'center', flexWrap: 'wrap'}}>
          <div style={{flex: '1 1 200px'}}>
            <div style={{fontWeight: 800, fontSize: 16}}>🏫 Dein Klassenzimmer</div>
            <div className="muted" style={{fontSize: 13, marginTop: 2}}>
              Jedes Kind, das sich mit seinem Namen anmeldet, erscheint hier automatisch —
              mit Fortschritt je Lektion.
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => ctx && ctx.go && ctx.go('teacher')}>Klassenzimmer öffnen</button>
        </div>
      </div>
    );
  }
  // Kein Konto: freundlich zum Namen-Login führen (kein Code-Kopieren mehr nötig).
  if (!acc) {
    return (
      <div className="card" style={{padding: 16, marginTop: 14}}>
        <div className="row" style={{gap: 12, alignItems: 'center', flexWrap: 'wrap'}}>
          <div style={{flex: '1 1 200px'}}>
            <div style={{fontWeight: 800, fontSize: 16}}>🏫 Klassenzimmer</div>
            <div className="muted" style={{fontSize: 13, marginTop: 2}}>
              Melde dich oben mit deinem <b>Namen</b> an — mehr braucht es nicht. Du bist dann
              sofort im Kurs und deine Lehrkraft sieht, wie fleißig du lernst.
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => ctx && ctx.openModal && ctx.openModal('auth')}>Mit Namen anmelden</button>
        </div>
      </div>
    );
  }
  if (acc && acc.role !== 'teacher') {
    return (
      <div className="card" style={{padding: 16, marginTop: 14}}>
        <div style={{fontWeight: 800, fontSize: 16}}>🏫 Klassenzimmer</div>
        <div className="muted" style={{fontSize: 13.5, marginTop: 4}}>
          ✅ Alles automatisch: Als <b>{acc.name}</b> angemeldet — deine Lehrkraft sieht deinen
          Fortschritt von selbst. Du musst nichts kopieren oder abschicken.
        </div>
      </div>
    );
  }
  const doCopy = async () => {
    CR.setName(name);
    let ok = false;
    try { await navigator.clipboard.writeText(CR.encode(name)); ok = true; } catch (e) {}
    if (!ok) setShow(true);
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  };
  return (
    <div className="card" style={{padding: 16, marginTop: 14}}>
      <div style={{fontWeight: 800, fontSize: 16}}>🏫 Klassenzimmer</div>
      <div className="muted" style={{fontSize: 13, margin: '4px 0 10px'}}>
        Kopiere deinen Fortschritts-Code und schick ihn deiner Lehrkraft — so sieht sie, wie weit du bist.
      </div>
      <div className="row" style={{gap: 8, flexWrap: 'wrap'}}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Dein Name"
               style={{flex: '1 1 130px', minWidth: 0, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', font: 'inherit'}}/>
        <button className="btn btn-primary" disabled={!name.trim()} style={{opacity: name.trim() ? 1 : .5}} onClick={doCopy}>{copied ? 'Kopiert ✓' : 'Code kopieren'}</button>
        <button className="btn btn-ghost" onClick={() => { CR.setName(name); setShow(s => !s); }}>{show ? 'Verbergen' : 'Anzeigen'}</button>
      </div>
      {show && !!name.trim() && (
        <textarea readOnly value={CR.encode(name)} onFocus={e => e.target.select()}
                  style={{width: '100%', marginTop: 10, minHeight: 74, padding: 10, borderRadius: 10, border: '1px solid var(--line)', fontFamily: 'monospace', fontSize: 12, boxSizing: 'border-box'}}/>
      )}
    </div>
  );
}

/* ============== SIDEBAR ============== */
function Sidebar({ ctx }) {
  const { route, go, activeStack, setActiveStack, openModal, teacherUnlocked } = ctx;
  // Elternstapel mit Kindern (z.B. "§34a – Sachkunde") starten aufgeklappt, weil das
  // unser Hauptinhalt ist — "Mündliche Prüfungsfragen" bleibt zu, da noch leer.
  const [expanded, setExpanded] = useState({ quran: true });
  const onStack = (s) => { setActiveStack(s.id); go('deck'); };
  const toggleExpand = (id, e) => { e.stopPropagation(); setExpanded(x => ({ ...x, [id]: !x[id] })); };

  return (
    <aside className="sidebar">
      <div className="logo">LERN.</div>
      <nav className="nav">
        {NAV.map(n => (
          <button key={n.id} className={"nav-item " + (route.screen === n.id || (n.id==='decks' && route.screen==='deck') ? 'is-active' : '')}
                  onClick={() => go(n.id)}>
            <span className="nav-icon">
              {n.icon === 'Hedgehog' ? <span style={{fontSize:24}}>🦔</span> : React.createElement(Icon[n.icon])}
            </span>
            {n.label}
          </button>
        ))}
        <button className={"nav-item " + (route.screen === 'teacher' ? 'is-active' : '')} onClick={() => go('teacher')}>
          <span className="nav-icon"><span style={{fontSize:22}}>🏫</span></span>
          Klassenzimmer{teacherUnlocked ? ' 🔓' : ''}
        </button>
      </nav>
      <div className="cta-block">
        <button className="btn btn-primary btn-full" onClick={() => openModal('modes')}>
          <Icon.Gamepad/> Lernen
        </button>
        <button className="btn btn-ghost btn-full" onClick={() => openModal('add')}>
          <Icon.Plus/> Hinzufügen
        </button>
      </div>
      <div className="stacks">
        <div className="stacks-head">
          <span>Meine Stapel</span>
          <button className="icon-btn" style={{width:24,height:24,border:'none',background:'transparent'}} onClick={() => openModal('newStack')}><Icon.Plus/></button>
        </div>
        {STACKS.filter(s => !(s.topic && s.topic.archived)).map(s => (
          <React.Fragment key={s.id}>
            <div className={"stack-row " + (activeStack === s.id ? 'is-active' : '') + (s.hasChildren ? ' has-caret':'')}
                 onClick={() => s.hasChildren ? toggleExpand(s.id, { stopPropagation(){} }) : onStack(s)}>
              {s.hasChildren && (
                <span className="caret" onClick={(e) => toggleExpand(s.id, e)}
                      style={{transform: expanded[s.id] ? 'rotate(90deg)' : 'none', transition:'transform .15s'}}>
                  <Icon.Caret/>
                </span>
              )}
              <span className="stack-dot" style={{background: s.color}}></span>
              <span className="name">{s.name}</span>
            </div>
            {s.hasChildren && expanded[s.id] && (s.children || []).map(c => (
              <div key={c.id} className={"stack-row stack-child " + (activeStack === c.id ? 'is-active' : '')}
                   style={{paddingLeft: 34}}
                   onClick={() => onStack(c)}>
                <span className="stack-dot" style={{background: c.color, width:8, height:8}}></span>
                <span className="name">{c.name}</span>
              </div>
            ))}
            {s.hasChildren && expanded[s.id] && !(s.children || []).length && (
              <div className="stack-row stack-child" style={{paddingLeft: 34, opacity:.5, cursor:'default'}}>
                <span className="name">Noch keine Unterstapel</span>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </aside>
  );
}

/* ============== TOPBAR ============== */
/* Kleiner Zähler-Punkt auf dem Glocken-Icon (Blueprint Phase 10) — abonniert
   app/notifications.js direkt statt über Props durchgereicht zu werden, weil
   Realtime-Updates (neuer Follower, überholt) jederzeit von außerhalb React
   hereinkommen können. */
function NotifBadge() {
  const [count, setCount] = useState(() => (window.Notifications ? window.Notifications.unreadCount() : 0));
  useEffect(() => {
    if (!window.Notifications) return;
    return window.Notifications.onChange(() => setCount(window.Notifications.unreadCount()));
  }, []);
  if (!count) return null;
  return (
    <span style={{
      position:'absolute', top:-3, right:-3, minWidth:16, height:16, padding:'0 3px', borderRadius:8,
      background:'var(--rose)', color:'#fff', fontSize:10.5, fontWeight:800,
      display:'grid', placeItems:'center', lineHeight:1,
    }}>{count > 9 ? '9+' : count}</span>
  );
}

/* ============== MOBILE BOTTOM-NAV (Klassen-Edition) ============== */
function MobileNav({ ctx }) {
  const { route, go } = ctx;
  return (
    <nav className="mobilenav">
      {NAV.map(n => (
          <button key={n.id} className={"mn-item " + (route.screen === n.id || (n.id==='decks' && route.screen==='deck') ? 'is-active' : '')}
                  onClick={() => go(n.id)}>
            <span className="mn-ico">
              {n.icon === 'Hedgehog' ? <span style={{fontSize:24}}>🦔</span> : React.createElement(Icon[n.icon])}
            </span>
            {n.label}
          </button>
        ))}
      <button className={"mn-item " + (route.screen === 'duel' ? 'is-active' : '')} onClick={() => go('duel')}>
        <span className="mn-ico" style={{position:'relative'}}>
          <span style={{fontSize:22}}>⚔️</span>
          {!!(window.DuelInvites && window.DuelInvites.list().length) && (
            <span style={{position:'absolute', top:-2, right:-4, width:9, height:9, borderRadius:9, background:'var(--rose, #D64545)'}}/>
          )}
        </span>
        Duell
      </button>
      <button className={"mn-item " + (route.screen === 'teacher' ? 'is-active' : '')} onClick={() => go('teacher')}>
        <span className="mn-ico"><span style={{fontSize:22}}>🏫</span></span>
        Klasse
      </button>
    </nav>
  );
}

function Topbar({ ctx, scrolled }) {
  const { openModal, go, session, profile } = ctx;
  // Echte Freundeszahl statt Fake-"14 Freunde", sobald eingeloggt (Roadmap-Punkt 13).
  const [friendCount, setFriendCount] = useState(null);
  useEffect(() => {
    let cancelled = false;
    if (session && window.sb) {
      fLoadAll(session.user.id).then((d) => { if (!cancelled) setFriendCount(d.friends.length); });
    } else {
      setFriendCount(null);
    }
    return () => { cancelled = true; };
  }, [session && session.user && session.user.id]);

  return (
    <header className={"topbar " + (scrolled ? 'scrolled':'')}>
      {ctx.route.screen === 'deck' && (
        <button className="icon-btn" onClick={() => go('decks')}><Icon.Back/></button>
      )}
      <div className="spacer"/>
      <button className="pill tb-hide" onClick={() => openModal('history')}><Icon.History/> Geschichte</button>
      <button className="pill tb-hide" onClick={() => openModal('friends')}>
        <span style={{width:8, height:8, borderRadius:'50%', background:'var(--success)'}}></span>
        {friendCount === null ? 'Freunde' : `${friendCount} Freunde`}
      </button>
      {/* Die frühere zweite Währungs-Pille ("893 Edelsteine") war reine Deko aus der
          UI-Hüllen-Phase und ist entfernt (20.07.2026): diese App hat bewusst EINE
          Währung (Münzen, echte Pille links) — ein zweites Fake-Guthaben würde nur
          verwirren. */}
      <button className="icon-btn" style={{position:'relative'}} onClick={() => openModal('notifs')}>
        <Icon.Bell/>
        <NotifBadge/>
      </button>
      {session ? (
        <button className="avatar-btn" onClick={() => go('profile')}>
          <AnimalAvatar kind={(profile && profile.avatar) || '🦔'} size={28}/>
          <Icon.ChevDown/>
        </button>
      ) : ctx.ssAccount ? (
        /* Namens-Chip: Tippen öffnet das PROFIL (07.08.2026 — Profil ist aus
           der unteren Navigation raus, hier ist sein Zuhause). Konto & Sync
           sitzen als Knopf im Profil. */
        <button className="pill" style={{fontWeight:800, gap:8}} onClick={() => go('profile')}>
          <span style={{width:8, height:8, borderRadius:'50%',
            background: ctx.ssState === 'ok' ? 'var(--success, #1B8A5A)' : ctx.ssState === 'syncing' ? '#E8B93E' : ctx.ssState === 'error' || ctx.ssState === 'offline' ? '#D64545' : 'var(--line)'}}/>
          {ctx.ssAccount.role === 'teacher' ? '🧑‍🏫' : '🧒'} {ctx.ssAccount.name}
        </button>
      ) : (
        <button className="btn btn-primary" style={{padding:'8px 16px'}} onClick={() => openModal('auth')}>Anmelden</button>
      )}
    </header>
  );
}

/* ============== ROUTES ============== */
function Routes({ ctx }) {
  const { route } = ctx;
  switch (route.screen) {
    case 'home':     return <Home ctx={ctx}/>;
    case 'progress': return <Progress ctx={ctx}/>;
    case 'decks':    return <DecksGrid ctx={ctx}/>;
    case 'quranletters': return <QuranLetters ctx={ctx}/>;
    case 'surah': return window.SurahModule ? <window.SurahModule.Screen ctx={ctx}/> : <Home ctx={ctx}/>;
    case 'hifz': return window.HifzScreen ? <window.HifzScreen ctx={ctx}/> : <Home ctx={ctx}/>;
    case 'infinity': return window.InfinityScreen ? <window.InfinityScreen ctx={ctx}/> : <Home ctx={ctx}/>;
    case 'public':   return <PublicDecks ctx={ctx}/>;
    case 'deck':     return <DeckDetail ctx={ctx}/>;
    case 'profile':  return <Profile ctx={ctx}/>;
    case 'settings': return <Settings ctx={ctx}/>;
    case 'tutor':    return <TutorChat ctx={ctx}/>;
    case 'live':     return <LiveLobbyReal ctx={ctx}/>;
    case 'league':   return window.League ? <window.League.LeagueScreen ctx={ctx}/> : <Home ctx={ctx}/>;
    case 'teacher':  return <TeacherCorner ctx={ctx}/>;
    case 'cardedit': return <CardEditor ctx={ctx}/>;
    case 'account':  return <AccountScreen ctx={ctx}/>;
    case 'help':     return <HelpScreen ctx={ctx}/>;
    case 'duel':     return window.DuelScreen ? <window.DuelScreen ctx={ctx}/> : <Home ctx={ctx}/>;
    case '404':      return <NotFound ctx={ctx}/>;
    default:         return <Home ctx={ctx}/>;
  }
}

/* ============== HOME ============== */
function Home({ ctx }) {
  const { go, setActiveStack } = ctx;
  // (07.08.2026, Nutzerwunsch) Der KI-Eingabekasten "Was wollen wir lernen?"
  // ist raus — der Fokus liegt voll auf dem Elifba-Kurs. Die Startseite führt
  // jetzt direkt in die nächste offene Lektion.
  const next = (() => {
    const ordered = (window.QuranCourse && window.QuranCourse.ordered()) || [];
    let firstOpen = null;
    for (const t of ordered) {
      const info = window.QuranCourse.progressInfo(t.id);
      if (!info.unlocked) continue;
      const pct = (window.SRS && window.SRS.progressPct) ? window.SRS.progressPct(t.id, flatQuiz(t)) : 0;
      if (pct < 100) { firstOpen = { id: t.id, name: t.name, pct: pct }; break; }
    }
    if (!firstOpen && ordered.length) firstOpen = { id: ordered[0].id, name: ordered[0].name, pct: 100 };
    return firstOpen;
  })();

  return (
    <div className="page">
      <div className="home-hero">
        <div className="mascot-wrap">
          <Axolotl size={190}/>
          <div className="shadow"/>
        </div>
        <div className="hero-title">🌙 Koran lesen lernen</div>
        <div className="muted" style={{textAlign:'center', maxWidth:430, margin:'4px auto 0', fontSize:14.5, lineHeight:1.5}}>
          Schritt für Schritt vom ersten Buchstaben bis zum Koranlesen — mit Elif &amp; Ba.
        </div>
        {next && (
          <button className="btn btn-primary btn-lg" style={{marginTop:14, padding:'15px 28px', fontSize:16.5}}
                  onClick={() => { setActiveStack(next.id); go('deck'); }}>
            ▶️ Weiterlernen: {next.name.replace(/^\d+\.\s*/, '')}{next.pct > 0 && next.pct < 100 ? ' · ' + next.pct + '%' : ''}
          </button>
        )}
        <InstallBanner/>
        {window.ClassBoard && <window.ClassBoard.CheerBanner ctx={ctx}/>}
        <InfinityCard ctx={ctx}/>
        <HifzCard ctx={ctx}/>
        <DuelCard ctx={ctx}/>
        <ClassroomCard ctx={ctx}/>
      </div>

      <div className="section-head" style={{marginTop:24}}>
        <div className="title">Weitermachen</div>
        <button className="link" onClick={() => go('decks')}>Alle ansehen</button>
      </div>
      <div className="jumpback-row">
        {QURAN_CHILDREN.slice(0,5).map((c, i) => {
          // Echte Meisterungs-Quote statt der früheren erfundenen Fake-Prozente
          // (Review 21.07.2026) — gleiche Datenquelle wie die MasteryBar im Deck.
          const p = (window.SRS && window.SRS.progressPct) ? window.SRS.progressPct(c.id, flatQuiz(c.topic)) / 100 : 0;
          return (
          <button key={c.id} className="jump-card" onClick={() => { setActiveStack(c.id); go('deck'); }}>
            <Ring p={p}/>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontWeight:800, fontSize:15.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{c.name}</div>
              <div className="muted" style={{fontSize:13}}>{c.topic.blocks.length} Bausteine · {c.topic.cardCount} Karten</div>
            </div>
          </button>
          );
        })}
      </div>

      {/* (09.08.2026) Das alte Supabase-Live-Quiz ist raus — es funktionierte
          ohne Supabase-Projekt nie. Das echte Duell steht oben als eigene Karte. */}
      <div className="section-head" style={{marginTop:14}}>
        <div className="title">Freunde herausfordern</div>
        <button className="link" onClick={() => go('duel')}>Duell öffnen</button>
      </div>
      <div className="card" style={{textAlign:'center', padding:22}}>
        <div style={{fontSize:28}}>⚔️</div>
        <div style={{fontWeight:800, marginTop:4}}>Live gegeneinander spielen</div>
        <div className="muted" style={{fontSize:13}}>
          Tipp einen Mitschüler an — ihr bekommt dieselben Fragen, wer schneller richtig ist, gewinnt.
        </div>
        <button className="btn btn-primary" style={{marginTop:10}} onClick={() => go('duel')}>⚔️ Duell starten</button>
      </div>
    </div>
  );
}

/* "👋 Wer ist online?" (Blueprint Phase 7) — zeigt gefolgte Nutzer, die laut
   app/presence.js (Supabase Realtime Presence) gerade online sind, mit einem
   "Winken"-Button. Nur eingeloggt sichtbar, weil Folgen+Presence beide einen
   Account brauchen. */
function WaveSection({ ctx }) {
  const myId = ctx.session && ctx.session.user && ctx.session.user.id;
  const [following, setFollowing] = useState([]);
  const [onlineIds, setOnlineIds] = useState([]);
  const [waved, setWaved] = useState({});

  useEffect(() => {
    let cancelled = false;
    if (myId && window.Follows) window.Follows.loadFollowing(myId).then((list) => { if (!cancelled) setFollowing(list); });
    return () => { cancelled = true; };
  }, [myId]);

  useEffect(() => {
    if (!window.Presence) return;
    setOnlineIds(window.Presence.onlineIds());
    return window.Presence.onChange((map) => setOnlineIds(Object.keys(map)));
  }, []);

  const onlineFollowing = following.filter((f) => onlineIds.includes(f.id));
  if (!following.length) return null; // niemandem gefolgt -> Sektion macht noch keinen Sinn

  const wave = (id) => {
    if (!window.Presence) return;
    window.Presence.sendWave(id);
    setWaved((w) => ({ ...w, [id]: true }));
    setTimeout(() => setWaved((w) => ({ ...w, [id]: false })), 3000);
  };

  return (
    <>
      <div className="section-head" style={{marginTop:14}}>
        <div className="title">👋 Wer ist online?</div>
      </div>
      {!onlineFollowing.length && <div className="muted" style={{padding:'4px 2px 8px'}}>Gerade niemand aus deinem Netzwerk online.</div>}
      <div className="friends-row">
        {onlineFollowing.map((f) => (
          <div key={f.id} className="friend-card">
            <AnimalAvatar kind={f.avatar || '🦔'} size={44}/>
            <div className="meta">
              <div className="name">{f.username}</div>
              <div className="sub">🟢 Online</div>
            </div>
            <button className="btn btn-ghost" style={{padding:'8px 14px', fontSize:13}} onClick={() => wave(f.id)}>
              {waved[f.id] ? 'Gewunken!' : '👋 Winken'}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function Ring({ p }) {
  const r = 24, c = 2 * Math.PI * r;
  return (
    <div className="ring">
      <svg viewBox="0 0 56 56">
        <circle className="ring-bg" cx="28" cy="28" r={r} fill="none" strokeWidth="6"/>
        <circle className="ring-fg" cx="28" cy="28" r={r} fill="none" strokeWidth="6"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - p)}
                strokeLinecap="round"/>
      </svg>
      <span className="label">{Math.round(p*100)}%</span>
    </div>
  );
}

/* ============== PROGRESS ==============
   Seit dem XP-Umbau (app/xp.js) komplett ECHTE Daten: Level, XP,
   Tages-Serie und Kalender kommen aus dem lokalen Punktesystem,
   das exakt die im Original gemessenen Werte nutzt (17 XP, Combos). */
/* 🌙 "Dein Koran-Weg" auf der Fortschritts-Seite (Nachtausbau P4):
   alle 18 Elifba-Lektionen als Mini-Kacheln (%, 🔒, 🏅), darunter
   Suren-auswendig-Stand und die freien Stapel (Wortschatz, Gebete). */
function QuranProgressCard({ ctx }) {
  const rows = useMemo(function () {
    return ((window.QuranCourse && window.QuranCourse.ordered()) || []).map(function (t, i) {
      // Gewichteter Fortschritt (06.08.2026): füllt sich ab der ersten richtigen
      // Antwort (1/3 pro sauberer Wiederholung) statt erst bei voller Meisterung.
      const qs = flatQuiz(t);
      const pct = (window.SRS && window.SRS.progressPct) ? window.SRS.progressPct(t.id, qs)
        : (function () { const s = window.SRS ? window.SRS.topicStats(t.id, qs) : { total: 0, gemeistert: 0 }; return s.total ? Math.round(s.gemeistert / s.total * 100) : 0; })();
      const info = window.QuranCourse.progressInfo(t.id);
      return { n: i + 1, id: t.id, name: t.name.replace(/^\d+\.\s*/, ''), pct: pct, unlocked: info.unlocked };
    });
  }, []);
  const surahDone = (function () {
    try { return Object.keys(JSON.parse(localStorage.getItem('quran_surah_done_v1') || '{}')).length; } catch (e) { return 0; }
  })();
  const surahTotal = (window.SURAHS_DATA || []).length || 12;
  const hz = (window.Hifz && (window.HIFZ_ITEMS || []).length) ? window.Hifz.summary() : null;
  const extras = (window.QURAN_EXTRA_TOPICS || []).map(function (t) {
    const qs = flatQuiz(t);
    const pct = (window.SRS && window.SRS.progressPct) ? window.SRS.progressPct(t.id, qs)
      : (function () { const s = window.SRS ? window.SRS.topicStats(t.id, qs) : { total: 0, gemeistert: 0 }; return s.total ? Math.round(s.gemeistert / s.total * 100) : 0; })();
    return { name: t.name, pct: pct };
  });
  const doneCount = rows.filter(function (r) { return r.pct >= 100; }).length;
  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>🌙 Dein Koran-Weg</h2>
        <span className="pill">{doneCount}/{rows.length} Lektionen gemeistert</span>
      </div>
      <div className="qpr-grid">
        {rows.map(function (r) {
          return (
            <div key={r.id} className={'qpr-tile' + (r.pct >= 100 ? ' is-done' : '') + (!r.unlocked ? ' is-locked' : '')} title={r.name}>
              <div className="qpr-n">{r.unlocked ? r.n : '🔒'}</div>
              <div className="qpr-pct">{r.unlocked ? (r.pct >= 100 ? '🏅' : r.pct + '%') : ''}</div>
            </div>
          );
        })}
      </div>
      {hz && (
        <>
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 12, flexWrap: 'wrap', gap: 6 }}>
            <span style={{ fontWeight: 700 }}>🕌 Auswendig gelernt · {hz.rank.icon} {hz.rank.title}</span>
            <span className="muted">{hz.done} / {hz.total} 🏆 · {hz.verses}/{hz.versesTotal} Verse</span>
          </div>
          <div className="xp-bar" style={{ marginTop: 6 }}><div className="fill" style={{ width: (hz.total ? Math.round(hz.done / hz.total * 100) : 0) + '%' }}/></div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
            {hz.xp > 0 ? hz.xp + ' XP mit Auswendiglernen verdient' : 'Noch nicht begonnen — hier gibt es die meisten Punkte der App.'}
            {hz.due > 0 ? ' · 🔁 ' + hz.due + ' Auffrischung' + (hz.due === 1 ? '' : 'en') + ' fällig' : ''}
          </div>
        </>
      )}
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 12, flexWrap: 'wrap', gap: 6 }}>
        <span style={{ fontWeight: 700 }}>📖 Suren gelesen &amp; gehört</span>
        <span className="muted">{surahDone} / {surahTotal} 🏆</span>
      </div>
      <div className="xp-bar" style={{ marginTop: 6 }}><div className="fill" style={{ width: (surahTotal ? Math.round(surahDone / surahTotal * 100) : 0) + '%' }}/></div>
      {extras.map(function (e, i) {
        return (
          <div key={i}>
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 10, flexWrap: 'wrap', gap: 6 }}>
              <span style={{ fontWeight: 700 }}>{i === 0 ? '🧠' : '🤲'} {e.name}</span>
              <span className="muted">{e.pct}%</span>
            </div>
            <div className="xp-bar" style={{ marginTop: 6 }}><div className="fill" style={{ width: e.pct + '%' }}/></div>
          </div>
        );
      })}
    </div>
  );
}

function Progress({ ctx }) {
  const { openModal, session } = ctx;
  const myId = session && session.user && session.user.id;
  const xp = window.XP;
  const lv = xp ? xp.levelInfo() : { level: 1, title: 'Neuling', total: 0, nextAt: 150, progress: 0 };
  const st = xp ? xp.state() : { streakDays: 0, coins: 0 };
  const days = xp ? xp.recentDays(14) : [];
  const today = xp ? xp.todayXp() : 0;
  // Live bei Gizmo beobachtet: die Serie ist NICHT schon nach 1 Antwort gesichert,
  // sondern erst nach einem kleinen Tages-Soll ("2 Fragen, um deine Serie
  // fortzusetzen") — siehe STREAK_DAILY_TARGET in xp.js für die Annahme dazu.
  const streakSt = xp ? xp.streakStatus() : { needed: 0, target: 5, secured: true };
  const ringR = 24, ringC = 2 * Math.PI * ringR;
  const ringP = streakSt.target > 0 ? Math.max(0, Math.min(1, 1 - streakSt.needed / streakSt.target)) : 1;
  // Zweites, höheres Tagesziel: die Gold-Serie (Ausbau 25.07.2026, Gizmo-Live-Fund).
  const goldSt = xp ? xp.goldStatus() : { needed: 0, target: 15, done: 0, achieved: false };
  const goldStreak = xp ? xp.goldStreakDays() : 0;
  const goldP = goldSt.target > 0 ? Math.max(0, Math.min(1, goldSt.done / goldSt.target)) : 1;
  return (
    <div className="page">
      <div className="card level-card">
        <div className="level-shield">{lv.level}</div>
        <div style={{flex:1}}>
          <div className="row" style={{justifyContent:'space-between'}}>
            <div style={{fontFamily:'Fraunces, serif', fontWeight:900, fontSize:26}}>{lv.title}</div>
            <div className="muted">Level {lv.level + 1}: <b style={{color:'var(--ink)'}}>{xp ? xp.fmt(lv.nextAt) : lv.nextAt} XP</b></div>
          </div>
          <div className="xp-bar"><div className="fill" style={{width: `${Math.round(lv.progress * 100)}%`}}/></div>
          <div className="row" style={{marginTop:8}}>
            <span className="xp-pill">{xp ? xp.fmt(lv.total) : 0} XP <Icon.Sparkle/></span>
            {today > 0 && <span className="pill">heute +{today} XP</span>}
          </div>
        </div>
      </div>

      {/* 🌙 Koran-Weg (Nachtausbau P4): alle 18 Lektionen + Suren + Extras auf einen Blick */}
      <QuranProgressCard ctx={ctx}/>

      {/* 🤝 Unsere Klasse (11.08.2026): gemeinsames Ziel, Wochen-Tafel,
          Auswendig-Tafel und „Anfeuern" — siehe app/classboard.js. */}
      {window.ClassBoard && <window.ClassBoard.ClassCard ctx={ctx}/>}

      <div className="card streak-card">
        <div className="streak-head">
          <h2>{st.streakDays > 0 ? `${st.streakDays}-Tage-Serie!` : 'Starte deine Serie!'}</h2>
          <div className="row">
            <span className="pill">🪙 {st.coins}</span>
            <button className="icon-btn" onClick={() => openModal('share')}><Icon.Share/></button>
          </div>
        </div>
        <div className="row" style={{marginTop:14, alignItems:'stretch'}}>
          <div className="gem-card">
            <div style={{fontSize:48, lineHeight:1}}>🔥</div>
            <div className="gem-label">{st.streakDays} {st.streakDays === 1 ? 'Tag' : 'Tage'}</div>
          </div>
          <div style={{flex:1, padding:'8px 14px', display:'flex', alignItems:'center', gap:14}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:800, fontSize:18}}>{streakSt.secured ? 'Serie für heute gesichert ✅' : `${streakSt.needed} ${streakSt.needed === 1 ? 'Frage' : 'Fragen'}`}</div>
              <div className="muted">{streakSt.secured ? `+${today} XP heute gesammelt` : 'um deine Serie fortzusetzen'}</div>
            </div>
            {!streakSt.secured && (
              <div style={{position:'relative', width:56, height:56, flexShrink:0}}>
                <svg width="56" height="56" viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r={ringR} fill="none" stroke="var(--line)" strokeWidth="6"/>
                  <circle cx="28" cy="28" r={ringR} fill="none" stroke="#E4566E" strokeWidth="6" strokeLinecap="round"
                          strokeDasharray={ringC} strokeDashoffset={ringC * (1 - ringP)} transform="rotate(-90 28 28)"/>
                </svg>
                <span style={{position:'absolute', inset:0, display:'grid', placeItems:'center', fontSize:20}}>🔥</span>
              </div>
            )}
          </div>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:6, marginTop:14}}>
          {days.slice(0,7).map((dd) => <DayCell key={dd.key} {...dd}/>)}
          {days.slice(7,14).map((dd) => <DayCell key={dd.key} {...dd}/>)}
        </div>
        {/* Gold-Serie: zweites, höheres Tagesziel (Ausbau 25.07.2026, Gizmo-Live-Fund).
            Golden gerahmter Balken mit ⭐-Fortschritt; erreicht -> "Gold-Tag geschafft". */}
        <div style={{marginTop:14, padding:'12px 14px', borderRadius:16, background:'rgba(246,196,69,0.12)', boxShadow:'inset 0 0 0 1.5px rgba(246,196,69,0.5)'}}>
          <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
            <div style={{fontWeight:800, display:'flex', alignItems:'center', gap:6}}>
              <span style={{fontSize:18}}>⭐</span> Gold-Serie
              {goldStreak > 0 && <span className="pill" style={{background:'rgba(246,196,69,0.22)'}}>{goldStreak} {goldStreak === 1 ? 'Gold-Tag' : 'Gold-Tage'}</span>}
            </div>
            <div className="muted" style={{fontSize:12.5, fontWeight:700}}>{Math.min(goldSt.done, goldSt.target)}/{goldSt.target}</div>
          </div>
          <div style={{marginTop:8, height:9, borderRadius:99, background:'rgba(246,196,69,0.2)', overflow:'hidden'}}>
            <div style={{height:'100%', width:(goldP*100)+'%', borderRadius:99, background:'linear-gradient(90deg,#F6C445,#FFB020)', transition:'width .35s'}}/>
          </div>
          <div className="muted" style={{fontSize:12.5, marginTop:7}}>
            {goldSt.achieved ? '🏆 Gold-Tag heute geschafft!' : `Noch ${goldSt.needed} ${goldSt.needed === 1 ? 'richtige Antwort' : 'richtige Antworten'} für deinen Gold-Tag`}
          </div>
        </div>
        <button className="btn btn-primary btn-full btn-lg" style={{marginTop:18}} onClick={() => ctx.openModal('modes')}><Icon.Gamepad/> {streakSt.secured ? 'Weiter lernen' : 'Serie halten'}</button>
      </div>

      {window.League && <window.League.LeagueCard ctx={ctx} myId={myId}/>}
      {window.Groups && <window.Groups.GroupsCard ctx={ctx} myId={myId}/>}
      <FriendsRanking ctx={ctx}/>
    </div>
  );
}

// 'YYYY-MM-DD' im lokalen Kalender — gleiches Format wie app/xp.js dayKey(),
// nötig damit die Zeiträume hier zu den xp_daily-Zeilen passen, die dort geschrieben werden.
function rankDayKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
// ACHTUNG: "Woche" = Kalenderwoche Montag-heute, "Monat" = Kalendermonat 1.-heute
// (nicht rollierend, z.B. nicht "letzte 7 Tage"). Das ist eine Annahme — bei Gizmo live
// war nicht eindeutig erkennbar, ob dort rollierend oder kalendarisch gezählt wird.
function periodStartDay(period) {
  const now = new Date();
  if (period === 'today') return rankDayKey(now);
  if (period === 'week') {
    const d = new Date(now);
    const dow = (d.getDay() + 6) % 7; // 0 = Montag
    d.setDate(d.getDate() - dow);
    return rankDayKey(d);
  }
  if (period === 'month') return rankDayKey(new Date(now.getFullYear(), now.getMonth(), 1));
  return null; // 'all' -> kein Datumsfilter, profiles.total_xp direkt
}
const RANK_PERIODS = [['today', 'Tag'], ['week', 'Woche'], ['month', 'Monat'], ['all', 'Insgesamt']];

/* Echte Freunde-Rangliste mit Zeitraum-Tabs (Tag/Woche/Monat/Insgesamt) — Insgesamt
   kommt aus profiles.total_xp, die anderen drei aus xp_daily (siehe app/xp.js
   pushRemote() und supabase/schema.sql Abschnitt 8). Ohne Login/Supabase bleibt der
   bisherige Beispiel-Feed sichtbar. */
function FriendsRanking({ ctx }) {
  const { session } = ctx;
  const [period, setPeriod] = useState('today');
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let cancelled = false;
    if (!session || !window.sb) { setRows(null); return; }
    (async () => {
      const d = await fLoadAll(session.user.id);
      const ids = d.friends.map(f => (f.user_a === session.user.id ? f.user_b : f.user_a));
      ids.push(session.user.id);
      const { data: profs } = await window.sb.from('profiles')
        .select('id, username, avatar, total_xp, streak_days').in('id', ids);
      if (!profs) { if (!cancelled) setRows(null); return; }
      const from = periodStartDay(period);
      if (from === null) {
        if (!cancelled) setRows(profs.map(p => ({ ...p, xp: p.total_xp || 0 })).sort((a, b) => b.xp - a.xp));
        return;
      }
      const { data: xpRows } = await window.sb.from('xp_daily')
        .select('user_id, day, xp').in('user_id', ids).gte('day', from);
      const sums = {};
      ids.forEach(id => { sums[id] = 0; });
      (xpRows || []).forEach(r => { sums[r.user_id] = (sums[r.user_id] || 0) + (r.xp || 0); });
      if (!cancelled) setRows(profs.map(p => ({ ...p, xp: sums[p.id] || 0 })).sort((a, b) => b.xp - a.xp));
    })();
    return () => { cancelled = true; };
  }, [session && session.user && session.user.id, period]);

  if (!session || !rows) {
    return (
      <>
        <div className="section-head" style={{marginTop:8}}>
          <div className="title">Aktivität der Freunde</div>
          <a className="link" href="#">Alle ansehen</a>
        </div>
        <div className="card" style={{textAlign:'center', padding:26}}>
          <div style={{fontSize:30}}>👋</div>
          <div style={{fontWeight:800, marginTop:4}}>Noch keine Freunde-Aktivität</div>
          <div className="muted" style={{fontSize:13}}>Melde dich an, um die Aktivität deiner Freunde zu sehen.</div>
        </div>
      </>
    );
  }
  return (
    <>
      <div className="section-head" style={{marginTop:8}}>
        <div className="title">Rangliste deiner Freunde</div>
      </div>
      <div className="tabs" style={{marginBottom:10}}>
        {RANK_PERIODS.map(([key, label]) => (
          <button key={key} className={'tab ' + (period === key ? 'is-active' : '')} onClick={() => setPeriod(key)}>{label}</button>
        ))}
      </div>
      <div className="card">
        {rows.map((p, i) => {
          const me = session.user.id === p.id;
          return (
            <div key={p.id} className="feed-card" style={{borderBottom:'1px solid var(--line)', padding:'12px 0', background: me ? 'var(--accent-soft)' : 'transparent', borderRadius: me ? 12 : 0}}>
              <div style={{width:26, textAlign:'center', fontWeight:900, color:'var(--ink-mute)'}}>{i+1}</div>
              <AnimalAvatar kind={p.avatar || '🦔'} size={40}/>
              <div style={{flex:1}}>
                <div style={{fontWeight:800}}>{p.username}{me ? ' (du)' : ''}</div>
                {p.streak_days > 0 && <div className="muted" style={{fontSize:12.5}}>🔥 {p.streak_days}-Tage-Serie</div>}
              </div>
              <span className="pill" style={{fontWeight:800}}>{window.XP ? window.XP.fmt(p.xp || 0) : (p.xp || 0)} XP</span>
            </div>
          );
        })}
        {rows.length === 1 && <div className="muted" style={{fontSize:12.5, paddingTop:10}}>Noch keine Freunde — füge welche über die Freunde-Kachel oben hinzu.</div>}
      </div>
    </>
  );
}

function DayCell({ weekday, dayNum, xp, isToday, gold }) {
  const active = xp > 0;
  // Gold-Tag (Ausbau 25.07.2026): höheres Tagesziel erreicht -> goldener Kranz + gelbe
  // Flamme statt der normalen roten. Normale aktive Tage bleiben 🔥, leere Tage leer.
  return (
    <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:4, padding:'8px 0',
                 background: gold ? 'rgba(246,196,69,0.16)' : isToday ? 'var(--accent-soft)' : 'transparent',
                 borderRadius:18, boxShadow: gold ? 'inset 0 0 0 1.5px rgba(246,196,69,0.55)' : 'none'}}>
      <div style={{fontWeight:700, color:'var(--ink-mute)', fontSize:11}}>{weekday}</div>
      <div style={{fontWeight:700, color: active ? 'var(--ink)' : 'var(--ink-mute)', fontSize:14}}>{dayNum}</div>
      <div style={{width:30, height:30, display:'grid', placeItems:'center', fontSize:18}}>{gold ? '⭐' : active ? '🔥' : ''}</div>
    </div>
  );
}

/* ============== DECKS GRID ============== */
function DecksGrid({ ctx }) {
  const { go, setActiveStack, openModal } = ctx;
  return (
    <div className="page wide">
      <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
        <h1>Meine Stapel</h1>
        <div className="row">
          <button className="icon-btn"><Icon.Search/></button>
          <button className="btn btn-primary" onClick={() => openModal('newStack')}><Icon.Plus/> Neuer Stapel</button>
        </div>
      </div>
      <div className="deck-grid">
        {S34A_CHILDREN.map(c => (
          // Bewusst <div role="button"> statt <button>: enthält selbst einen "..."-Button
          // (Kontextmenü) — verschachtelte <button>-Elemente sind ungültiges HTML
          // (React-Warnung "validateDOMNesting"), obwohl Chrome es bisher stillschweigend
          // gerendert hat. tabIndex/role/onKeyDown erhalten die Tastatur-Bedienbarkeit.
          <div key={c.id} className="deck-card" role="button" tabIndex={0}
               onClick={() => { setActiveStack(c.id); go('deck'); }}
               onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveStack(c.id); go('deck'); } }}>
            <div className="row" style={{justifyContent:'space-between'}}>
              <div className="swatch" style={{background: c.color}}/>
              <button className="icon-btn" style={{width:32,height:32}} onClick={(e) => { e.stopPropagation(); openModal('stackContext', { id: c.id }); }}><Icon.More/></button>
            </div>
            <div className="deck-name">{c.name}</div>
            <div className="deck-meta">{c.topic.cardCount} Karten · {c.topic.quizCount} Quizfragen</div>
          </div>
        ))}
        {STACKS.filter(s => s.id !== 's34a' && s.id !== 'quran' && !/^quran-/.test(s.id) && !(s.topic && s.topic.archived)).map(s => (
          <div key={s.id} className="deck-card" role="button" tabIndex={0}
               onClick={() => { setActiveStack(s.id); go('deck'); }}
               onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveStack(s.id); go('deck'); } }}>
            <div className="row" style={{justifyContent:'space-between'}}>
              <div className="swatch" style={{background: s.color}}/>
              <div className="row" style={{gap:6}}>
                {s.topic && s.topic.isShared && <span className="pill" style={{fontSize:11, padding:'3px 8px'}} title="Geteilter Stapel — mehrere Mitwirkende">👥 Geteilt</span>}
                <button className="icon-btn" style={{width:32,height:32}} onClick={(e) => { e.stopPropagation(); openModal('stackContext', { id: s.id }); }}><Icon.More/></button>
              </div>
            </div>
            <div className="deck-name">{s.name}</div>
            <div className="deck-meta">
              {s.topic ? `${s.topic.cardCount || 0} Karten · ${s.topic.quizCount || 0} Quizfragen` : 'Noch leer'}
            </div>
          </div>
        ))}
        <button className="deck-card" style={{borderStyle:'dashed', alignItems:'center', justifyContent:'center', color:'var(--ink-mute)'}} onClick={() => openModal('newStack')}>
          <Icon.FolderPlus/>
          <div className="deck-name" style={{textAlign:'center'}}>Neuer Stapel</div>
        </button>
        {ctx.session && (
          <button className="deck-card" style={{borderStyle:'dashed', alignItems:'center', justifyContent:'center', color:'var(--ink-mute)'}} onClick={() => openModal('joinShared')}>
            <div style={{fontSize:28}}>👥</div>
            <div className="deck-name" style={{textAlign:'center'}}>Geteiltem Stapel beitreten</div>
            <div className="deck-meta">Mit 6-stelligem Code</div>
          </button>
        )}
      </div>
      {QURAN_CHILDREN.length > 0 && (
        <>
          <div className="section-head" style={{marginTop:18, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap'}}>
            <div className="title">🌙 Koran lesen – Elif &amp; Ba{' '}
              {window.SimpleSync && window.SimpleSync.isTeacher()
                ? <span className="pill" style={{fontSize:12, background:'var(--success-soft, #E7F7EE)', color:'var(--success, #1B8A5A)'}}>🔓 Lehrer-Modus: alles offen</span>
                : <span className="muted" style={{fontWeight:500, fontSize:13}}>Lektionen schalten sich Schritt für Schritt frei</span>}
            </div>
            <div className="row" style={{gap:8, flexWrap:'wrap'}}>
              <HifzButton ctx={ctx}/>
              <InfinityButton ctx={ctx}/>
              <button className="btn btn-ghost" onClick={() => go('surah')}>📖 Suren lesen &amp; hören</button>
              <button className="btn btn-ghost" onClick={() => go('quranletters')}>🔤 Buchstaben-Übersicht</button>
            </div>
          </div>
          <div className="deck-grid">
            {QURAN_CHILDREN.map(c => {
              const info = window.QuranCourse ? window.QuranCourse.progressInfo(c.id) : { unlocked: true };
              // Mini-Fortschritt je Lektion (06.08.2026): kleiner Balken + Prozent
              // direkt auf der Kachel — füllt sich ab der ersten richtigen Antwort.
              const pct = (window.SRS && window.SRS.progressPct) ? window.SRS.progressPct(c.id, flatQuiz(c.topic)) : 0;
              const open = () => { if (!info.unlocked) return; setActiveStack(c.id); go('deck'); };
              return (
                <div key={c.id} className={'deck-card' + (info.unlocked ? '' : ' locked')} role="button" tabIndex={0}
                     onClick={open}
                     onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && info.unlocked) { e.preventDefault(); open(); } }}>
                  {!info.unlocked && <div className="deck-lock">🔒</div>}
                  <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
                    <div className="swatch" style={{background: c.color}}/>
                    {info.unlocked && pct > 0 && <span className="pill" style={{fontSize:11.5, padding:'3px 9px', fontWeight:800, color: pct >= 100 ? 'var(--success, #1B8A5A)' : undefined}}>{pct >= 100 ? '🏅 100%' : pct + '%'}</span>}
                  </div>
                  <div className="deck-name">{c.name}</div>
                  {info.unlocked && pct > 0 && (
                    <div style={{height:6, borderRadius:999, background:'var(--line, #ECEBE6)', overflow:'hidden', margin:'6px 0 2px'}}>
                      <div style={{width: pct + '%', height:'100%', borderRadius:999, background: pct >= 100 ? 'var(--success, #1B8A5A)' : 'var(--accent, #2A6BE0)', transition:'width .5s ease'}}/>
                    </div>
                  )}
                  <div className="deck-meta">
                    {info.unlocked
                      ? (c.topic.quizCount + ' Fragen · Auswendig & Live')
                      : ('🔒 Noch ' + (info.needPrev - info.answeredPrev) + ' Fragen in \u201E' + info.prevName + '\u201C beantworten')}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      {/* (07.08.2026) Zusatz-Stapel GANZ NACH UNTEN — der Elifba-Kurs hat
          Vorrang. Reihenfolge: Gebete, dann Wortschatz als letzter Stapel. */}
      {EXTRA_CHILDREN.length > 0 && (
        <>
          <div className="section-head" style={{marginTop:18}}>
            <div className="title">🕌 Nach der Elifba: Beten &amp; Verstehen <span className="muted" style={{fontWeight:500, fontSize:13}}>frei lernbar, ohne Freischaltung</span></div>
          </div>
          <div className="deck-grid">
            {EXTRA_CHILDREN.map(c => {
              const pct = (window.SRS && window.SRS.progressPct) ? window.SRS.progressPct(c.id, flatQuiz(c.topic)) : 0;
              return (
                <div key={c.id} className="deck-card" role="button" tabIndex={0}
                     onClick={() => { setActiveStack(c.id); go('deck'); }}
                     onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveStack(c.id); go('deck'); } }}>
                  <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
                    <div className="swatch" style={{background: c.color}}/>
                    {pct > 0 && <span className="pill" style={{fontSize:11.5, padding:'3px 9px', fontWeight:800, color: pct >= 100 ? 'var(--success, #1B8A5A)' : undefined}}>{pct >= 100 ? '🏅 100%' : pct + '%'}</span>}
                  </div>
                  <div className="deck-name">{c.name}</div>
                  {pct > 0 && (
                    <div style={{height:6, borderRadius:999, background:'var(--line, #ECEBE6)', overflow:'hidden', margin:'6px 0 2px'}}>
                      <div style={{width: pct + '%', height:'100%', borderRadius:999, background: pct >= 100 ? 'var(--success, #1B8A5A)' : 'var(--accent, #2A6BE0)'}}/>
                    </div>
                  )}
                  <div className="deck-meta">{c.topic.cardCount} Karten · Auswendig &amp; Live</div>
                </div>
              );
            })}
          </div>
        </>
      )}
      {ARCHIVED_CHILDREN.length > 0 && (
        <>
          <div className="section-head" style={{marginTop:18}}>
            <div className="title">Archiv</div>
          </div>
          <div className="deck-grid">
            {ARCHIVED_CHILDREN.map(c => (
              <div key={c.id} className="deck-card" role="button" tabIndex={0} style={{opacity:0.65}}
                   onClick={() => { setActiveStack(c.id); go('deck'); }}
                   onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveStack(c.id); go('deck'); } }}>
                <div className="row" style={{justifyContent:'space-between'}}>
                  <div className="swatch" style={{background: c.color}}/>
                  <button className="icon-btn" style={{width:32,height:32}} onClick={(e) => { e.stopPropagation(); window.CustomTopics && window.CustomTopics.setArchived(c.id, false); }} title="Dearchivieren">📤</button>
                </div>
                <div className="deck-name">{c.name}</div>
                <div className="deck-meta">📦 Archiviert · {c.topic.cardCount} Karten</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* Öffentliche Stapel-Bibliothek (Blueprint Phase 13) — vorher 6 Fake-Kategorien mit
   erfundenen Zahlen, jetzt echte Supabase-Tabelle public_decks (app/library.js):
   suchen, nach Kategorie filtern, mit einem Klick in die eigenen Stapel übernehmen. */
function PublicDecks({ ctx }) {
  const { session } = ctx;
  const myId = session && session.user && session.user.id;
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState(null);
  const [decks, setDecks] = useState(null);
  const [imported, setImported] = useState({}); // deckId -> true nach Übernahme

  useEffect(() => {
    let cancelled = false;
    if (!myId || !window.Library) { setDecks(null); return; }
    const t = setTimeout(() => {
      window.Library.browse({ category: cat, search: search.trim() || null })
        .then((d) => { if (!cancelled) setDecks(d); });
    }, 250); // Debounce für die Suche
    return () => { cancelled = true; clearTimeout(t); };
  }, [myId, cat, search]);

  const doImport = (deck) => {
    const t = window.Library.importDeck(deck);
    if (t) setImported((m) => ({ ...m, [deck.id]: true }));
  };

  return (
    <div className="page wide">
      <h1>Öffentliche Stapel</h1>
      {!session && (
        <div className="card flat tinted" style={{padding:20, textAlign:'center'}}>
          <div style={{fontWeight:800, marginBottom:8}}>Erst anmelden</div>
          <div className="muted" style={{marginBottom:14}}>Melde dich an, um die öffentliche Stapel-Bibliothek zu durchsuchen und eigene Stapel zu veröffentlichen.</div>
          <button className="btn btn-primary" onClick={() => ctx.openModal('auth')}>Anmelden</button>
        </div>
      )}
      {session && (
        <>
          <div className="search-box" style={{maxWidth:520}}>
            <div className="row"><Icon.Search/>
              <input placeholder="Stapel suchen…" value={search} onChange={e => setSearch(e.target.value)}/>
            </div>
          </div>
          <div className="row" style={{gap:6, flexWrap:'wrap'}}>
            <button className={'pill'} style={{fontWeight: cat === null ? 800 : 600, opacity: cat === null ? 1 : 0.6}} onClick={() => setCat(null)}>Alle</button>
            {(window.Library ? window.Library.CATEGORIES : []).map(c => (
              <button key={c.id} className="pill" style={{fontWeight: cat === c.id ? 800 : 600, opacity: cat === c.id ? 1 : 0.6}} onClick={() => setCat(cat === c.id ? null : c.id)}>{c.label}</button>
            ))}
          </div>
          {!decks && <div className="muted">Lädt…</div>}
          {decks && decks.length === 0 && (
            <div className="card flat tinted" style={{padding:24, textAlign:'center'}}>
              <div style={{fontSize:36}}>🗂️</div>
              <div style={{fontWeight:800, marginTop:8}}>Noch nichts hier</div>
              <div className="muted">Veröffentliche deinen ersten Stapel über das ⋮-Menü in "Meine Stapel".</div>
            </div>
          )}
          {decks && decks.length > 0 && (
            <div className="deck-grid">
              {decks.map(d => (
                <div key={d.id} className="deck-card">
                  <div className="row" style={{justifyContent:'space-between'}}>
                    <div className="swatch" style={{background: d.color || 'var(--stack-lavender)'}}/>
                    <span className="pill" style={{fontSize:11, padding:'3px 8px'}}>
                      {((window.Library ? window.Library.CATEGORIES : []).find(c => c.id === d.category) || {label:'📚'}).label.split(' ')[0]}
                    </span>
                  </div>
                  <div className="deck-name">{d.name}</div>
                  <div className="deck-meta">{d.counts.cards} Karten · {d.counts.quiz} Quizfragen</div>
                  {d.author && (
                    <div className="row" style={{gap:6, marginTop:4}}>
                      <AnimalAvatar kind={d.author.avatar || '🦔'} size={22}/>
                      <span className="muted" style={{fontSize:12.5}}>{d.author.username}{d.author_id === myId ? ' (du)' : ''}</span>
                    </div>
                  )}
                  {d.author_id !== myId && (
                    <button className={'btn btn-full ' + (imported[d.id] ? 'btn-ghost' : 'btn-primary')} style={{marginTop:8}}
                            disabled={!!imported[d.id]} onClick={() => doImport(d)}>
                      {imported[d.id] ? 'Übernommen ✅' : '+ Zu meinen Stapeln'}
                    </button>
                  )}
                  {d.author_id === myId && (
                    <button className="btn btn-ghost btn-full" style={{marginTop:8}}
                            onClick={async () => { await window.Library.unpublish(myId, d.topic_ref); setDecks(list => (list || []).filter(x => x.id !== d.id)); }}>
                      Zurückziehen
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* Problemkarten-Analyse (Ausbau 23.07.2026) — beantwortet sichtbar die Frage
   "an welchen Karten scheitere ich immer wieder?": listet die Wackelkandidaten
   des Stapels (vergessene zuerst, dann nach Fehlerhäufigkeit, app/srs.js
   weakCards()) und startet auf Knopfdruck eine Runde NUR mit diesen Karten.
   Ergänzt die automatische Priorisierung, die ohnehin in jeder Runde greift
   (buildQueue: Vergessenes -> Angefangenes -> Neues + Sofort-Requeue in der
   Runde) um den gezielten, sichtbaren Angriff auf die eigenen Schwächen. */
function WeakCardsCard({ ctx, topicId, questions }) {
  const [expanded, setExpanded] = useState(false);
  const weak = useMemo(
    () => (window.SRS && window.SRS.weakCards ? window.SRS.weakCards(topicId, questions) : []),
    [topicId, questions]
  );
  if (!weak.length) return null;
  const practice = () => {
    ctx.go('quiz', { questions: weak.map(e => e.q) });
  };
  // Dezente Fassung (07.08.2026, Nutzerwunsch "kleiner und dezenter"):
  // eine schmale Zeile — aufklappen zeigt die Karten, "Üben" startet gezielt.
  return (
    <div className="weakslim">
      <div className="weakslim-head" role="button" tabIndex={0} onClick={() => setExpanded(v => !v)}
           onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(v => !v); } }}>
        <span className="weakslim-title">🎯 {weak.length} Problemkarte{weak.length > 1 ? 'n' : ''} <small>· kommen automatisch zuerst dran</small></span>
        <span className="row" style={{gap:8, alignItems:'center', flexShrink:0}}>
          <button className="weakslim-btn" onClick={(e) => { e.stopPropagation(); practice(); }}>Üben</button>
          <span className="weakslim-caret">{expanded ? '▴' : '▾'}</span>
        </span>
      </div>
      {expanded && (
        <div className="col" style={{gap:4, marginTop:6}}>
          {weak.slice(0, 20).map((e, i) => (
            <div key={i} className="row" style={{justifyContent:'space-between', gap:10, padding:'3px 2px'}}>
              <span className={window.QuranCourse && window.QuranCourse.isArabicHeavy(e.q.q) ? 'qcard-ar-inline' : ''}
                    style={{flex:1, fontSize:12.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{e.q.q}</span>
              <span className="muted" style={{fontSize:11, flexShrink:0, fontWeight:700, color: e.state === 'vergessen' ? 'var(--rose)' : undefined}}>
                {e.state === 'vergessen' ? 'Vergessen' : 'Am Lernen'}{e.wrongCount > 0 ? ` · ${e.wrongCount}x` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============== KORAN: BUCHSTABEN-ÜBERSICHT ============== */
// Wie im Vorbild-Video (Quran-Progress-Stil): alle 28 Buchstaben als Kacheln
// mit Fortschritts-Ring in Prozent. Der Fortschritt eines Buchstabens ist das
// Mittel seiner Karten aus den drei Buchstaben-Lektionen (Name / Formen /
// Aussprache): gemeistert = 100 %, Lernserie zählt anteilig (Streak/3),
// "vergessen" wird auf max. 20 % gedeckelt. Tippen spielt die echte Aufnahme.
function quranLetterCards() {
  const T = window.QURAN_TOPICS || [];
  const by = function (id) { const t = T.find(x => x.id === id); return t ? t.blocks[0].quiz : []; };
  const arab = function (s) { return String(s).replace(/[\u064B-\u0652\u0670\u0640]/g, '').replace(/[^\u0600-\u06FF]/g, ''); };
  return by('quran-harfler').map(function (card) {
    const ch = arab(card.q);
    const forms = by('quran-formen').find(function (x) { const a = arab(x.q); return a.length > 1 && a.split('').every(function (c) { return c === ch; }); }) || null;
    const mahrec = by('quran-mahrec').find(function (x) { return arab(x.q) === ch; }) || null;
    return { ch: ch, name: card.a, nameQ: card.q, forms: forms, mahrec: mahrec };
  });
}
function quranScore(topicId, q) {
  if (!window.SRS) return 0;
  const st = window.SRS.getState(topicId, { q: q });
  if (st.state === 'gemeistert') return 1;
  const s = Math.min(st.streak || 0, 3) / 3;
  return st.state === 'vergessen' ? Math.min(s, 0.2) : s;
}
function QuranLetters({ ctx }) {
  const { go, setActiveStack } = ctx;
  const [selIdx, setSelIdx] = useState(null);
  // 🎧 Hör-Modus (Video-Prinzip: zuhören und mitsprechen): läuft automatisch
  // durch alle Buchstaben — Name + die drei Silben (be, bi, bü), Highlight
  // wandert mit. Nochmal drücken stoppt.
  const [hearIdx, setHearIdx] = useState(null);
  const hearTimer = useRef(null);
  useEffect(function () { return function () { if (hearTimer.current) clearTimeout(hearTimer.current); }; }, []);
  const stopHearAll = function () {
    if (hearTimer.current) clearTimeout(hearTimer.current);
    setHearIdx(null);
    try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) {}
  };
  const hearStep = function (i, list) {
    if (i >= list.length) { stopHearAll(); return; }
    setHearIdx(i);
    setSelIdx(i);
    const ch = list[i].ch;
    // Lamelif (لا) hat keine Silbenreihe — nur den Buchstaben selbst sprechen.
    if (window.QuranAudio) window.QuranAudio.speakText(ch === 'لا' ? ch : ch + 'َ، ' + ch + 'ِ، ' + ch + 'ُ', true);
    hearTimer.current = setTimeout(function () { hearStep(i + 1, list); }, 3400);
  };
  const letters = useMemo(function () {
    // Gewichtung 06.08.2026 ("die einzelnen Buchstaben sollten einzeln laden"):
    // Der NAME zählt am meisten (60 %) — so füllt sich der Ring eines Buchstabens
    // sofort spürbar, sobald das Kind ihn in Lektion 1 richtig benennt. Formen
    // (25 %) und Aussprache-Lektion (15 %) kommen später oben drauf.
    return quranLetterCards().map(function (l) {
      let sum = quranScore('quran-harfler', l.nameQ) * 0.6;
      let wsum = 0.6;
      if (l.forms) { sum += quranScore('quran-formen', l.forms.q) * 0.25; wsum += 0.25; }
      if (l.mahrec) { sum += quranScore('quran-mahrec', l.mahrec.q) * 0.15; wsum += 0.15; }
      const pct = Math.round(100 * sum / wsum);
      return Object.assign({}, l, { pct: pct });
    });
  }, []);
  const total = letters.length ? Math.round(letters.reduce(function (s, l) { return s + l.pct; }, 0) / letters.length) : 0;
  const sel = selIdx == null ? null : letters[selIdx];
  const hear = function (l) { if (window.QuranAudio) window.QuranAudio.speakText(l.ch); };
  const practice = function (l) {
    // Kurz-Training nur mit diesem Buchstaben (Name + Formen); jede Karte trägt
    // ihre Heimat-Lektion in _topicId, damit der Ring hier mitwächst.
    const qs = [];
    (window.QURAN_TOPICS || []).forEach(function (t) {
      if (t.id !== 'quran-harfler' && t.id !== 'quran-formen') return;
      t.blocks[0].quiz.forEach(function (q) {
        const a = String(q.q).replace(/[\u064B-\u0652\u0670\u0640]/g, '').replace(/[^\u0600-\u06FF]/g, '');
        if (a === l.ch || (a.length > 1 && a.split('').every(function (c) { return c === l.ch; }))) qs.push(Object.assign({}, q, { _topicId: t.id }));
      });
    });
    if (!qs.length) return;
    setActiveStack('quran-harfler');
    go('quiz', { questions: qs });
  };
  const R = 16, CIRC = 2 * Math.PI * R;
  return (
    <div className="content">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <button className="btn btn-ghost" style={{ marginBottom: 10 }} onClick={function () { go('decks'); }}>← Zurück</button>
          <h1 style={{ margin: 0 }}>🔤 Buchstaben-Übersicht</h1>
          <div className="muted" style={{ marginTop: 4 }}>Fortschritt je Buchstabe aus Name, Formen und Aussprache. Tippen = anhören.</div>
        </div>
        <div className="card" style={{ padding: '10px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{total}%</div>
          <div className="muted" style={{ fontSize: 12 }}>Alphabet gesamt</div>
        </div>
      </div>
      <button className="btn btn-primary btn-full" style={{ marginBottom: 14 }}
              onClick={function () { hearIdx == null ? hearStep(0, letters) : stopHearAll(); }}>
        {hearIdx == null ? '🎧 Hör-Modus: alle Buchstaben anhören' : '⏹ Stopp (' + (hearIdx + 1) + '/' + letters.length + ')'}
      </button>
      <div className="ql-grid">
        {letters.map(function (l, i) {
          const done = l.pct >= 100;
          return (
            <button key={l.ch} className={'ql-tile' + (selIdx === i ? ' is-sel' : '') + (done ? ' is-done' : '')}
                    onClick={function () { setSelIdx(i === selIdx ? null : i); hear(l); }}>
              <span className="ql-ringwrap">
                <svg viewBox="0 0 40 40" width="64" height="64">
                  <circle cx="20" cy="20" r={R} fill="none" stroke="var(--line)" strokeWidth="3.5"/>
                  <circle cx="20" cy="20" r={R} fill="none" stroke={done ? 'var(--success, #1B8A5A)' : 'var(--accent, #2A6BE0)'} strokeWidth="3.5"
                          strokeLinecap="round" strokeDasharray={CIRC}
                          strokeDashoffset={CIRC * (1 - l.pct / 100)}
                          transform="rotate(-90 20 20)"/>
                </svg>
                <span className="ql-glyph arabic-glyph">{l.ch}</span>
              </span>
              <span className="ql-name">{l.name}</span>
              <span className={'ql-pct' + (done ? ' is-done' : '')}>{done ? '✓ 100%' : l.pct + '%'}</span>
            </button>
          );
        })}
      </div>
      {sel && (
        <div className="card ql-detail">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{sel.name} · {sel.pct}%</div>
              <div className="muted" style={{ fontSize: 13 }}>Formen: allein · Anfang · Mitte · Ende</div>
            </div>
            <div className="ql-forms">{sel.forms ? sel.forms.q : sel.ch}</div>
          </div>
          <div className="row" style={{ gap: 10, marginTop: 14 }}>
            <button className="btn btn-ghost" onClick={function () { hear(sel); }}>🔊 Anhören</button>
            <button className="btn btn-primary" onClick={function () { practice(sel); }}>🏋️ Nur diesen Buchstaben üben</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============== DECK DETAIL ============== */
function DeckDetail({ ctx }) {
  const { activeStack, openModal, go } = ctx;
  const stack = findStack(activeStack) || STACKS[0];
  const topic = S34A_BY_ID[activeStack] || null;
  const [tab, setTab] = useState('karten');
  const quizQuestions = useMemo(() => flatQuiz(topic), [topic]);
  const srsStats = useMemo(() => (window.SRS ? window.SRS.topicStats(activeStack, quizQuestions) : null), [activeStack, quizQuestions]);

  // Startet den Quiz-Modus direkt mit den Fragen EINES Bausteins (aus "Lektionen → Starten")
  const startBlockQuiz = (block) => {
    ctx.go('quiz', { questions: block.quiz.length ? block.quiz : flatQuiz(topic) });
  };

  return (
    <div className="page wide">
      <div className="row" style={{justifyContent:'space-between'}}>
        <div className="deck-head" style={{flex:1, minWidth:0}}>
          <div className="swatch-lg" style={{background: stack.color}}/>
          <h1>{stack.name}</h1>
        </div>
        {/* (07.08.2026) Die vier Deko-Icons oben rechts (Suche/Ordner/Teilen/…)
            sind raus — sie hatten keine Funktion für den Elifba-Kurs. */}
      </div>
      {topic && topic.meta && (topic.meta.relevanz || topic.meta.schriftlich || topic.meta.muendlich) && (
        <div className="row" style={{gap:8, flexWrap:'wrap'}}>
          {topic.meta.relevanz && <span className="pill">Relevanz: <b>{topic.meta.relevanz}</b></span>}
          {topic.meta.schriftlich && <span className="pill">Schriftlich: <b>{topic.meta.schriftlich}</b></span>}
          {topic.meta.muendlich && <span className="pill">Mündlich: <b>{topic.meta.muendlich}</b></span>}
        </div>
      )}
      {topic && topic.isShared && <SharedMembersStrip topic={topic}/>}
      {srsStats && srsStats.total > 0 && <MasteryBar stats={srsStats}/>}
      <WeakCardsCard ctx={ctx} topicId={activeStack} questions={quizQuestions}/>
      <div className="row" style={{justifyContent:'flex-end', gap:10}}>
        {/* "Hinzufügen" nur noch bei EIGENEN Stapeln — im Elifba-Kurs weg (07.08.2026). */}
        {topic && topic.isCustom && (
          <button className="btn btn-ghost" onClick={() => openModal('addCard')}><Icon.Plus/> Hinzufügen</button>
        )}
        <button className="btn btn-primary btn-lg" style={{flex: '1 1 auto', maxWidth: 420}} onClick={() => openModal('modes')}><Icon.Gamepad/> Lernen Stapel</button>
      </div>
      <div className="tabs">
        {/* Koran-Stapel (07.08.2026): nur relevante Tabs — "Karten" heißt hier
            "Fortschritt" (Kreis-Raster je Buchstabe), Notizen/Fallbeispiele
            gibt es in diesem Kurs nicht. */}
        {(/^quran-/.test(String(activeStack || ''))
          ? [['karten','Fortschritt'],['lektionen','Lektionen'],['rangliste','Rangliste']]
          : [['karten','Karten'],['notizen','Notizen'],['fallbeispiele','Fallbeispiele'],['lektionen','Lektionen'],['rangliste','Rangliste']]
        ).map(([k,l]) => (
          <button key={k} className={"tab " + (tab===k?'is-active':'')} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'karten' && <KartenTab topic={topic} topicId={activeStack}/>}
      {tab === 'notizen' && <NotesTab topic={topic}/>}
      {tab === 'fallbeispiele' && <FallbeispieleTab topic={topic}/>}
      {tab === 'lektionen' && <LessonsTab topic={topic} onStart={startBlockQuiz} ctxLessons={{ go: ctx.go, activeStack }}/>}
      {tab === 'rangliste' && <LeaderboardTab ctx={ctx} topicId={activeStack}/>}
    </div>
  );
}

// Echtes Fortschritts-Tracking (localStorage, s. app/srs.js) statt Fake-Zahlen —
// vier Zustände wie bei Gizmo beobachtet: Vergessen / Neu / Am Lernen / Gemeistert.
function MasteryBar({ stats }) {
  const pct = stats.total ? Math.round((stats.gemeistert / stats.total) * 100) : 0;
  const segs = [
    { k: 'gemeistert', color: 'var(--success, #2f9e5b)' },
    { k: 'am_lernen', color: 'var(--accent)' },
    { k: 'vergessen', color: 'var(--rose, #e0607a)' },
    { k: 'neu', color: 'var(--line-2, #e4e4ea)' },
  ];
  return (
    <div className="card flat" style={{padding:14}}>
      <div className="row" style={{justifyContent:'space-between'}}>
        <div style={{fontWeight:800}}>{pct}% dieses Themengebiets gemeistert</div>
        <div className="muted" style={{fontSize:12.5}}>{stats.gemeistert}/{stats.total} Karten</div>
      </div>
      <div style={{display:'flex', height:8, borderRadius:6, overflow:'hidden', marginTop:10, background:'var(--line-2, #e4e4ea)'}}>
        {segs.map(s => stats[s.k] > 0 && (
          <div key={s.k} style={{width: `${(stats[s.k] / stats.total) * 100}%`, background: s.color}}/>
        ))}
      </div>
      <div className="row" style={{gap:14, marginTop:10, flexWrap:'wrap'}}>
        <span className="muted" style={{fontSize:12.5}}>❓ Vergessen {stats.vergessen}</span>
        <span className="muted" style={{fontSize:12.5}}>🌱 Neu {stats.neu}</span>
        <span className="muted" style={{fontSize:12.5}}>🎓 Am Lernen {stats.am_lernen}</span>
        <span className="muted" style={{fontSize:12.5}}>🏆 Gemeistert {stats.gemeistert}</span>
      </div>
    </div>
  );
}

/* Fortschritt je Karte (07.08.2026, Nutzerwunsch): "runder Kreis, der sich
   GRÜN füllt, je mehr man gelernt hat" — pro Buchstabe/Silbe/Wort. Jede
   saubere Wiederholung füllt 1/3, bei voller Meisterung wird der Kreis satt
   grün mit Häkchen. Kurze Karten (Buchstaben, Silben) als Kreis-Raster,
   lange (Gebetszeilen, Wörter) als Zeile mit Ring rechts. */
function quranCardProgress(topicId, q) {
  const st = window.SRS ? window.SRS.getState(topicId, { q: q }) : { state: 'neu', streak: 0 };
  let score = st.state === 'gemeistert' ? 1 : Math.min(st.streak || 0, 3) / 3;
  if (st.state === 'vergessen') score = Math.min(score, 0.2);
  return { st: st.state, pct: Math.round(score * 100) };
}
function GreenRing({ pct, size, inner }) {
  const R = 26, C = 2 * Math.PI * R;
  const done = pct >= 100;
  return (
    <svg viewBox="0 0 64 64" width={size || 64} height={size || 64} className="qring">
      <circle cx="32" cy="32" r={R} fill={done ? 'var(--success-soft, #E7F7EE)' : 'none'} stroke="#E3EFE8" strokeWidth="5"/>
      <circle className="fg" cx="32" cy="32" r={R} fill="none"
              stroke="var(--success, #1B8A5A)" strokeWidth="5" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(100, pct) / 100)}
              transform="rotate(-90 32 32)" opacity={pct > 0 ? 1 : 0}/>
      {inner}
    </svg>
  );
}
function QuranCardTile({ topicId, card }) {
  const q = card.q != null ? card.q : card.h;
  const a = card.a != null ? card.a : card.b;
  const p = quranCardProgress(topicId, q);
  const done = p.pct >= 100;
  return (
    <div className={'qgrid-tile' + (done ? ' is-done' : '')}>
      <GreenRing pct={p.pct} size={66}
        inner={<text x="32" y="40" textAnchor="middle" className="qring-ar">{q}</text>}/>
      <span className="qgrid-name">{a}</span>
      <span className={'qgrid-pct' + (done ? ' is-done' : '')}>{done ? '✓ 100%' : p.pct + '%'}</span>
    </div>
  );
}
function QuranCardRow({ topicId, card }) {
  const q = card.q != null ? card.q : card.h;
  const a = card.a != null ? card.a : card.b;
  const p = quranCardProgress(topicId, q);
  const done = p.pct >= 100;
  return (
    <div className="qcard-row">
      <span className="qcard-ar is-long">{q}</span>
      <span className="qcard-name">
        {a}
        <small>{p.st === 'gemeistert' ? '🏆 Gemeistert' : p.st === 'am_lernen' ? '🎓 Am Lernen' : p.st === 'vergessen' ? '❓ Nochmal üben' : '🌱 Neu'}</small>
      </span>
      <span className="qcard-ring">
        <GreenRing pct={p.pct} size={46}
          inner={<text x="32" y="37" textAnchor="middle" style={{ fontSize: 14, fontWeight: 800, fill: done ? 'var(--success, #1B8A5A)' : 'var(--ink, #1c2a36)' }}>{done ? '✓' : p.pct + '%'}</text>}/>
      </span>
    </div>
  );
}

function KartenTab({ topic, topicId }) {
  const cards = useMemo(() => flatCards(topic), [topic]);
  const isQuran = /^quran-/.test(String(topicId || ''));
  // Leerer Stapel (egal ob gar kein Themengebiet oder ein frisch angelegter eigener
  // Stapel ohne Karten): "Magischer Import" nachgebaut (Blueprint Phase 3/4) — die
  // erste scharfe Quelle ist "Notizen einfügen" (Freitext -> KI -> Review -> Übernahme),
  // der Rest der Kacheln bleibt vorerst Deko (siehe app/icons.js ImportTile).
  if (!topic || cards.length === 0) {
    return <MagicImportEmptyState topic={topic} topicId={topicId}/>;
  }
  if (isQuran) {
    // Kreis-Raster für kurze Karten (Buchstaben/Silben/Formen), Zeilen für lange
    const bareOf = (c) => String(c.q != null ? c.q : c.h).replace(/[ً-ْٰـ]/g, '').replace(/[^؀-ۿ]/g, '');
    const short = cards.filter(c => bareOf(c).length <= 4);
    const long = cards.filter(c => bareOf(c).length > 4);
    const doneCount = cards.filter(c => quranCardProgress(topicId, c.q != null ? c.q : c.h).pct >= 100).length;
    return (
      <div className="col">
        <div className="row" style={{justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8}}>
          <div style={{fontWeight:800, fontSize:18}}>Dein Fortschritt</div>
          <span className="pill" style={doneCount === cards.length && cards.length ? {background:'var(--success-soft, #E7F7EE)', color:'var(--success, #1B8A5A)', fontWeight:800} : {fontWeight:700}}>
            🏆 {doneCount} / {cards.length} gemeistert
          </span>
        </div>
        <div className="muted" style={{fontSize:12.5, marginTop:-4}}>
          Jede fehlerfreie Runde füllt den Kreis um ein Drittel — dreimal sauber gewusst = gemeistert. ✊
        </div>
        {short.length > 0 && (
          <div className="qgrid">
            {short.map((c, i) => <QuranCardTile key={i} topicId={topicId} card={c}/>)}
          </div>
        )}
        {long.map((c, i) => <QuranCardRow key={'l' + i} topicId={topicId} card={c}/>)}
      </div>
    );
  }
  return (
    <div className="col">
      <div className="row" style={{justifyContent:'space-between'}}>
        <div style={{fontWeight:800, fontSize:18}}>Karten ({cards.length})</div>
        <button className="icon-btn"><Icon.Sort/></button>
      </div>
      {cards.map((c, i) => (
        <div key={i} className="flashcard">
          <div className="q">{c.h != null ? c.h : c.q}</div>
          <div className="divider"/>
          <div className="a">{c.b != null ? c.b : c.a}</div>
        </div>
      ))}
    </div>
  );
}

// "Magischer Import" (Blueprint Phase 3/4) für einen leeren Stapel. Nur bei eigenen
// (KI-fähigen) Stapeln (topic.isCustom) ist "Notizen" wirklich angeschlossen — die
// übrigen Kacheln bleiben bewusst Deko, bis ihre jeweilige Quelle (PDF-Text-Extraktion,
// YouTube-Transkript, OCR, ...) einzeln angeschlossen wird. Kuratierte §34a-Themen und
// der "Mündliche Prüfungsfragen"-Platzhalter (kein echtes topic) zeigen weiter die
// schlichte alte Meldung, weil dort nichts gespeichert werden könnte.
function MagicImportEmptyState({ topic, topicId }) {
  const canImport = !!(topic && topic.isCustom);
  // Klassen-Edition: alle Upload-/Import-Funktionen entfernt — leere Stapel
  // zeigen nur noch einen Hinweis (Karten von Hand im "Karten"-Tab anlegen).
  return (
    <div className="card" style={{padding: 28, textAlign: 'center'}}>
      <div style={{fontSize: 34}}>🗂️</div>
      <div style={{fontWeight: 800, fontSize: 18, marginTop: 6}}>Noch keine Karten</div>
      <div className="muted" style={{marginTop: 4}}>
        {canImport ? 'Füge Karten im Tab "Karten" von Hand hinzu.' : 'Dieser Stapel hat noch keinen Inhalt.'}
      </div>
    </div>
  );
  const [notesOpen, setNotesOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [fileBusy, setFileBusy] = useState(false); // Datei wird gerade gelesen (PDF/Word)
  const [fileBusyLabel, setFileBusyLabel] = useState(''); // "PDF"/"Word-Dokument", fürs UI
  const [pdfProgress, setPdfProgress] = useState(null); // {page, total}, nur bei PDF
  const [err, setErr] = useState('');
  const [review, setReview] = useState(null); // [{q,a,keep}] — Review vor dem Übernehmen
  const [tableOpen, setTableOpen] = useState(false);
  const [tableMode, setTableMode] = useState('table'); // 'table' | 'quizlet' — teilen sich Panel + Parser
  const [tableText, setTableText] = useState('');
  const [webOpen, setWebOpen] = useState(false);
  const [webUrl, setWebUrl] = useState('');
  const [webBusy, setWebBusy] = useState(false);
  const [ytOpen, setYtOpen] = useState(false);
  const [ytUrl, setYtUrl] = useState('');
  const [ytBusy, setYtBusy] = useState(false);
  const pdfInputRef = useRef(null);
  const docxInputRef = useRef(null);
  const pptxInputRef = useRef(null);
  const tableFileInputRef = useRef(null);
  const ankiInputRef = useRef(null);
  const [ankiBusy, setAnkiBusy] = useState(false);
  const photoInputRef = useRef(null);
  // Quelle des aktuellen Imports fürs Import-Protokoll (Phase 16: "Liste bereits
  // importierter Quelldokumente mit Datum" im Importe-Tab) — wird beim Übernehmen
  // (commit) als AIHistory-Eintrag vom Typ 'import' festgehalten.
  const sourceRef = useRef('Notizen');

  const generate = async () => {
    if (!window.AIImport) { setErr('KI-Import ist in dieser Umgebung nicht verfügbar.'); return; }
    setErr(''); setBusy(true);
    try {
      const generated = await window.AIImport.generateCardsFromText(text, 20);
      setReview(generated.map(c => ({ ...c, keep: true })));
    } catch (e) {
      setErr((e && e.message) || 'Karten konnten nicht erzeugt werden.');
    }
    setBusy(false);
  };

  // "PDF"-Kachel: Datei auswählen -> Text clientseitig extrahieren (app/pdfimport.js,
  // pdf.js) -> in dasselbe Textfeld wie "Notizen" übernehmen, damit der Nutzer den
  // erkannten Text noch prüfen/korrigieren kann, bevor die KI daraus Karten macht.
  // Die Datei selbst geht dabei NIE an einen Server, nur der extrahierte Text.
  const pickPdf = () => { setErr(''); pdfInputRef.current && pdfInputRef.current.click(); };
  const onPdfChosen = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // gleiche Datei später nochmal auswählbar machen
    if (!file) return;
    if (!window.PDFImport) { setErr('PDF-Import ist in dieser Umgebung nicht verfügbar.'); return; }
    setErr(''); setFileBusy(true); setFileBusyLabel('PDF'); setPdfProgress(null); setNotesOpen(true);
    try {
      const result = await window.PDFImport.extractTextFromPdf(file, (page, total) => setPdfProgress({ page, total }));
      setText(result.text);
      sourceRef.current = 'PDF \u00b7 ' + file.name;
    } catch (e2) {
      setErr((e2 && e2.message) || 'PDF konnte nicht gelesen werden.');
    }
    setFileBusy(false); setPdfProgress(null);
  };

  // "Word-Dokument"-Kachel: gleiches Prinzip wie PDF, nur über mammoth.js
  // (app/docximport.js) statt pdf.js — braucht keinen separaten Worker, funktioniert
  // dadurch auch in der Offline-Einzeldatei-Vorschau (im Unterschied zu PDF).
  const pickDocx = () => { setErr(''); docxInputRef.current && docxInputRef.current.click(); };
  const onDocxChosen = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!window.DocxImport) { setErr('Word-Import ist in dieser Umgebung nicht verfügbar.'); return; }
    setErr(''); setFileBusy(true); setFileBusyLabel('Word-Dokument'); setNotesOpen(true);
    try {
      const result = await window.DocxImport.extractTextFromDocx(file);
      setText(result.text);
      sourceRef.current = 'Word \u00b7 ' + file.name;
    } catch (e2) {
      setErr((e2 && e2.message) || 'Word-Dokument konnte nicht gelesen werden.');
    }
    setFileBusy(false);
  };

  // "PowerPoint"-Kachel: gleiches Prinzip wie PDF/Word, über JSZip + DOMParser
  // (app/pptximport.js) — kein separater Worker nötig, funktioniert auch offline.
  const pickPptx = () => { setErr(''); pptxInputRef.current && pptxInputRef.current.click(); };
  const onPptxChosen = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!window.PPTXImport) { setErr('PowerPoint-Import ist in dieser Umgebung nicht verfügbar.'); return; }
    setErr(''); setFileBusy(true); setFileBusyLabel('PowerPoint'); setNotesOpen(true);
    try {
      const result = await window.PPTXImport.extractTextFromPptx(file);
      setText(result.text);
      sourceRef.current = 'PowerPoint \u00b7 ' + file.name;
    } catch (e2) {
      setErr((e2 && e2.message) || 'PowerPoint-Datei konnte nicht gelesen werden.');
    }
    setFileBusy(false);
  };

  // "Tabellen"-Kachel: bewusst OHNE KI — eine Frage/Antwort-Tabelle ist bereits fertig
  // strukturiert, app/tableimport.js parst direkt in Review-Karten.
  const pickTableFile = () => { setErr(''); tableFileInputRef.current && tableFileInputRef.current.click(); };
  const onTableFileChosen = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const content = await file.text().catch(() => '');
    setTableText(content);
    sourceRef.current = 'Tabelle \u00b7 ' + file.name;
    setTableOpen(true);
  };
  const parseTableAndReview = () => {
    if (!window.TableImport) { setErr('Tabellen-Import ist in dieser Umgebung nicht verfügbar.'); return; }
    setErr('');
    const parsed = window.TableImport.parseTable(tableText);
    if (!parsed.length) { setErr('Es konnten keine Frage/Antwort-Zeilen erkannt werden. Format: eine Zeile pro Karte, Frage und Antwort getrennt durch Komma, Semikolon oder Tab.'); return; }
    if (!sourceRef.current.startsWith('Tabelle')) sourceRef.current = tableMode === 'quizlet' ? 'Quizlet-Export (eingef\u00fcgt)' : 'Tabelle (eingef\u00fcgt)';
    setReview(parsed.map(c => ({ ...c, keep: true })));
    setTableOpen(false); setTableText('');
  };

  // "Website-Link"-Kachel: braucht die neue Netlify Function fetch-url.mjs (CORS lässt
  // sich von fremden Websites aus dem Browser praktisch nie umgehen) — Text kommt von
  // dort, ab da läuft es wie bei Notizen/PDF/Word über dieselbe KI-Pipeline weiter.
  const loadWebLink = async () => {
    if (!window.WebLinkImport) { setErr('Website-Import ist in dieser Umgebung nicht verfügbar.'); return; }
    setErr(''); setWebBusy(true);
    try {
      const result = await window.WebLinkImport.extractTextFromUrl(webUrl);
      setText(result.text);
      sourceRef.current = 'Website \u00b7 ' + webUrl;
      setWebOpen(false); setWebUrl('');
      setNotesOpen(true);
    } catch (e2) {
      setErr((e2 && e2.message) || 'Seite konnte nicht geladen werden.');
    }
    setWebBusy(false);
  };

  // "YouTube"-Kachel: braucht ebenfalls einen Server (fetch-youtube-transcript.mjs) —
  // liest die öffentlich verfügbaren Untertitel eines Videos.
  const loadYoutube = async () => {
    if (!window.YouTubeImport) { setErr('YouTube-Import ist in dieser Umgebung nicht verfügbar.'); return; }
    setErr(''); setYtBusy(true);
    try {
      const result = await window.YouTubeImport.extractTranscriptFromUrl(ytUrl);
      setText(result.text);
      sourceRef.current = 'YouTube \u00b7 ' + ytUrl;
      setYtOpen(false); setYtUrl('');
      setNotesOpen(true);
    } catch (e2) {
      setErr((e2 && e2.message) || 'Transkript konnte nicht geladen werden.');
    }
    setYtBusy(false);
  };

  // "Foto · OCR"-Kachel: clientseitige Texterkennung per tesseract.js
  // (app/ocrimport.js) — das Foto geht nie an einen Server, nur der erkannte
  // Text landet danach wie bei "Notizen" im selben Textfeld zur Prüfung.
  const pickPhoto = () => { setErr(''); photoInputRef.current && photoInputRef.current.click(); };
  const onPhotoChosen = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!window.OCRImport) { setErr('Foto-Import ist in dieser Umgebung nicht verfügbar.'); return; }
    setErr(''); setFileBusy(true); setFileBusyLabel('Foto'); setNotesOpen(true);
    try {
      const result = await window.OCRImport.extractTextFromImage(file);
      setText(result.text);
      sourceRef.current = 'Foto-OCR \u00b7 ' + file.name;
    } catch (e2) {
      setErr((e2 && e2.message) || 'Text im Foto konnte nicht erkannt werden.');
    }
    setFileBusy(false);
  };

  // "Anki"-Kachel: .apkg ist eine ZIP mit einer SQLite-Datenbank drin (sql.js,
  // vendor/sql-wasm.js + .wasm) — bewusst OHNE KI, wie Tabellen/Quizlet.
  const pickAnki = () => { setErr(''); ankiInputRef.current && ankiInputRef.current.click(); };
  const onAnkiChosen = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!window.AnkiImport) { setErr('Anki-Import ist in dieser Umgebung nicht verfügbar.'); return; }
    setErr(''); setAnkiBusy(true);
    try {
      const cards = await window.AnkiImport.extractCardsFromApkg(file);
      sourceRef.current = 'Anki \u00b7 ' + file.name;
      setReview(cards.map(c => ({ ...c, keep: true })));
    } catch (e2) {
      setErr((e2 && e2.message) || '.apkg-Datei konnte nicht gelesen werden.');
    }
    setAnkiBusy(false);
  };

  const commit = () => {
    const approved = (review || [])
      .filter(c => c.keep && c.q.trim() && c.a.trim())
      .map(c => ({ q: c.q.trim(), a: c.a.trim() }));
    if (!approved.length) return;
    // Geteilte Stapel (Phase 16) haben ihren eigenen Speicherweg (Supabase statt
    // localStorage) — gleiche Schnittstelle, siehe app/sharedstacks.js.
    if (topic && topic.isShared && window.SharedStacks) window.SharedStacks.addCardsToTopic(topicId, approved);
    else if (window.CustomTopics) window.CustomTopics.addCardsToTopic(topicId, approved);
    else return;
    // Import-Protokoll (Phase 16): Quelle + Datum im Importe-Tab nachvollziehbar.
    if (window.AIHistory) window.AIHistory.log({ type: 'import', title: sourceRef.current, subtitle: approved.length + ' Karten übernommen', topicId });
    sourceRef.current = 'Notizen';
    setReview(null); setText(''); setNotesOpen(false);
  };

  if (review) {
    const keptCount = review.filter(c => c.keep).length;
    return (
      <div className="col">
        <div style={{fontWeight:800, fontSize:18}}>Vorschau — {keptCount} von {review.length} Karten übernehmen</div>
        <div className="muted" style={{fontSize:13}}>
          Prüf die erzeugten Karten. Text korrigieren geht direkt hier, mit ✕
          eine Karte aus der Übernahme ausschließen (nicht endgültig löschen — nochmal
          antippen holt sie zurück).
        </div>
        <div className="col">
          {review.map((c, i) => (
            <div key={i} className="card flat" style={{padding:14, opacity: c.keep ? 1 : 0.45}}>
              <div className="row" style={{justifyContent:'space-between', alignItems:'flex-start', gap:10}}>
                <div style={{flex:1}}>
                  <textarea value={c.q} rows={1}
                            onChange={e => { const v = e.target.value; setReview(r => r.map((x, j) => j === i ? { ...x, q: v } : x)); }}
                            style={{width:'100%', fontWeight:700, border:'none', background:'transparent', resize:'vertical', minHeight:26, fontFamily:'inherit', fontSize:15}}/>
                  <textarea value={c.a} rows={1}
                            onChange={e => { const v = e.target.value; setReview(r => r.map((x, j) => j === i ? { ...x, a: v } : x)); }}
                            style={{width:'100%', color:'var(--ink-mute)', border:'none', background:'transparent', resize:'vertical', minHeight:22, fontFamily:'inherit', fontSize:14}}/>
                </div>
                <button className="icon-btn" onClick={() => setReview(r => r.map((x, j) => j === i ? { ...x, keep: !x.keep } : x))}>
                  {c.keep ? <Icon.Close/> : <Icon.Plus/>}
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="row" style={{gap:10}}>
          <button className="btn btn-ghost" onClick={() => { setReview(null); sourceRef.current = 'Notizen'; }}>Verwerfen</button>
          <button className="btn btn-primary" disabled={!keptCount} onClick={commit}>
            {keptCount} Karten übernehmen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="col">
      <div className="card flat" style={{display:'grid', placeItems:'center', padding:'40px 20px', textAlign:'center', gap:10}}>
        <div style={{fontSize:48, opacity:0.7}}>📭</div>
        <div style={{fontWeight:800, fontSize:18}}>Noch keine Karten</div>
        <div className="muted">
          {canImport ? 'Importiere Inhalte oder füge Karten manuell hinzu.' : 'Dieser Stapel hat noch keinen Inhalt.'}
        </div>
      </div>
      {canImport && (
        <>
          <div style={{fontWeight:800, fontSize:16, marginTop:6}}>Magischer Import</div>
          <input ref={pdfInputRef} type="file" accept="application/pdf,.pdf" style={{display:'none'}} onChange={onPdfChosen}/>
          <input ref={docxInputRef} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style={{display:'none'}} onChange={onDocxChosen}/>
          <input ref={pptxInputRef} type="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" style={{display:'none'}} onChange={onPptxChosen}/>
          <input ref={tableFileInputRef} type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" style={{display:'none'}} onChange={onTableFileChosen}/>
          <input ref={ankiInputRef} type="file" accept=".apkg" style={{display:'none'}} onChange={onAnkiChosen}/>
          <input ref={photoInputRef} type="file" accept="image/*" style={{display:'none'}} onChange={onPhotoChosen}/>
          <div className="import-grid">
            <ImportTile kind="notes" label="Notizen" onClick={() => setNotesOpen(v => !v)}/>
            <ImportTile kind="pdf" label="PDF" onClick={pickPdf}/>
            <ImportTile kind="word" label="Word-Dokument" onClick={pickDocx}/>
            <ImportTile kind="ppt" label="PowerPoint" onClick={pickPptx}/>
            <ImportTile kind="youtube" label="YouTube" onClick={() => setYtOpen(v => !v)}/>
            <ImportTile kind="photo" label="Foto · OCR" onClick={pickPhoto}/>
            <ImportTile kind="table" label="Tabellen" onClick={() => { setTableMode('table'); setTableOpen(v => !v); }}/>
            <ImportTile kind="web" label="Website-Link" onClick={() => setWebOpen(v => !v)}/>
            <ImportTile kind="quizlet" label="Quizlet" onClick={() => { setTableMode('quizlet'); setTableOpen(v => !v); }}/>
            <ImportTile kind="anki" label="Anki" onClick={pickAnki}/>
          </div>
          {ankiBusy && <div className="muted" style={{fontSize:13}}>.apkg wird gelesen…</div>}
          {err && !notesOpen && !tableOpen && !webOpen && !ytOpen && <div style={{color:'var(--rose)', fontWeight:600}}>{err}</div>}
          {notesOpen && (
            <div className="card" style={{padding:18}}>
              <div style={{fontWeight:800, marginBottom:8}}>
                {fileBusy ? `${fileBusyLabel} wird gelesen…` : 'Notizen einfügen'}
              </div>
              {fileBusy && (
                <div className="muted" style={{fontSize:13, marginBottom:8}}>
                  {pdfProgress ? `Seite ${pdfProgress.page} von ${pdfProgress.total}…` : 'Datei wird geöffnet…'}
                </div>
              )}
              <textarea value={text} onChange={e => setText(e.target.value)} disabled={fileBusy}
                        placeholder="Füge hier deinen Lerntext ein (oder importiere eine Datei/Website) — die KI macht daraus automatisch Karten."
                        style={{width:'100%', minHeight:160, padding:14, borderRadius:14, border:'1px solid var(--line)', background:'var(--surface)', fontFamily:'inherit'}}/>
              <div className="muted" style={{fontSize:12.5, marginTop:8}}>
                Braucht das KI-Tutor-Backend (Netlify Function); ohne eigenen Server
                (z.B. in einer reinen Vorschau-Datei) nicht verfügbar. PDF-/Word-/PowerPoint-/
                Foto-Text wird direkt im Browser gelesen — nur der Text (nicht die Datei/das
                Foto) geht zur Kartenerzeugung raus.
              </div>
              {err && <div style={{color:'var(--rose)', fontWeight:600, marginTop:8}}>{err}</div>}
              <button className="btn btn-primary" style={{marginTop:12}} disabled={busy || fileBusy || text.trim().length < 10} onClick={generate}>
                {busy ? 'Karten werden erzeugt…' : 'Karten erstellen'}
              </button>
            </div>
          )}
          {tableOpen && (
            <div className="card" style={{padding:18}}>
              <div style={{fontWeight:800, marginBottom:8}}>{tableMode === 'quizlet' ? 'Aus Quizlet einfügen' : 'Tabelle einfügen'}</div>
              <div className="muted" style={{fontSize:12.5, marginBottom:8}}>
                {tableMode === 'quizlet'
                  ? 'In Quizlet bei einem Set auf "..." → "Exportieren" — die Liste kopieren und hier einfügen (Begriff und Definition durch Tab oder Komma getrennt, eine Zeile pro Karte). Läuft OHNE KI, direkt in die Vorschau — es gibt keine offizielle Quizlet-Schnittstelle, daher dieser Weg über den Export.'
                  : 'Eine Karte pro Zeile: Frage und Antwort getrennt durch Komma, Semikolon oder Tab (z. B. aus Excel/Google Sheets kopiert) — läuft OHNE KI, direkt in die Vorschau. Optional auch als .csv/.tsv-Datei.'}
              </div>
              {tableMode === 'table' && (
                <button className="btn btn-ghost" style={{marginBottom:10}} onClick={pickTableFile}>Datei auswählen…</button>
              )}
              <textarea value={tableText} onChange={e => setTableText(e.target.value)}
                        placeholder={tableMode === 'quizlet' ? 'Begriff\tDefinition\nPhotosynthese\tUmwandlung von Licht in Energie' : 'Frage,Antwort\nWas ist die Hauptstadt von Spanien?,Madrid'}
                        style={{width:'100%', minHeight:140, padding:14, borderRadius:14, border:'1px solid var(--line)', background:'var(--surface)', fontFamily:'monospace', fontSize:13}}/>
              {err && <div style={{color:'var(--rose)', fontWeight:600, marginTop:8}}>{err}</div>}
              <button className="btn btn-primary" style={{marginTop:12}} disabled={tableText.trim().length < 3} onClick={parseTableAndReview}>
                {tableMode === 'quizlet' ? 'Set einlesen' : 'Tabelle einlesen'}
              </button>
            </div>
          )}
          {webOpen && (
            <div className="card" style={{padding:18}}>
              <div style={{fontWeight:800, marginBottom:8}}>Website-Link</div>
              <input value={webUrl} onChange={e => setWebUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && !webBusy && loadWebLink()}
                     placeholder="z. B. de.wikipedia.org/wiki/Deeskalation" disabled={webBusy}
                     style={{width:'100%', padding:14, fontSize:15, borderRadius:14, border:'1px solid var(--line)', background:'var(--surface)'}}/>
              <div className="muted" style={{fontSize:12.5, marginTop:8}}>
                Ruft die Seite serverseitig ab (Netlify Function) und liest den Text daraus;
                ohne eigenen Server nicht verfügbar. Danach wie bei Notizen: Text prüfen,
                dann Karten erstellen.
              </div>
              {err && <div style={{color:'var(--rose)', fontWeight:600, marginTop:8}}>{err}</div>}
              <button className="btn btn-primary" style={{marginTop:12}} disabled={webBusy || webUrl.trim().length < 3} onClick={loadWebLink}>
                {webBusy ? 'Seite wird geladen…' : 'Text laden'}
              </button>
            </div>
          )}
          {ytOpen && (
            <div className="card" style={{padding:18}}>
              <div style={{fontWeight:800, marginBottom:8}}>YouTube-Link</div>
              <input value={ytUrl} onChange={e => setYtUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && !ytBusy && loadYoutube()}
                     placeholder="z. B. youtube.com/watch?v=... oder youtu.be/..." disabled={ytBusy}
                     style={{width:'100%', padding:14, fontSize:15, borderRadius:14, border:'1px solid var(--line)', background:'var(--surface)'}}/>
              <div className="muted" style={{fontSize:12.5, marginTop:8}}>
                Liest die öffentlich verfügbaren Untertitel des Videos serverseitig aus (Netlify
                Function); ohne eigenen Server nicht verfügbar. Funktioniert nur bei Videos mit
                Untertiteln (automatisch erzeugte zählen auch). Danach wie bei Notizen: Text
                prüfen, dann Karten erstellen.
              </div>
              {err && <div style={{color:'var(--rose)', fontWeight:600, marginTop:8}}>{err}</div>}
              <button className="btn btn-primary" style={{marginTop:12}} disabled={ytBusy || ytUrl.trim().length < 3} onClick={loadYoutube}>
                {ytBusy ? 'Transkript wird geladen…' : 'Transkript laden'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* Live bei Gizmo gibt es pro Stapel einen eigenen "Notizen"-Tab (dort offenbar
   KI-generiert/editierbar). Unsere Variante braucht keinen KI-Call: wir haben
   pro Karte in data.js bereits kuratierte Merksätze und Begriffs-Erklärungen
   (detail.merksatz / detail.begriffe) — die fassen wir hier pro Baustein zu
   einer Lernzusammenfassung zusammen. Deterministisch, kostenlos, sofort da. */
function NotesTab({ topic }) {
  if (!topic) {
    return (
      <div className="card flat" style={{display:'grid', placeItems:'center', padding:'60px 20px', textAlign:'center', gap:14}}>
        <div style={{fontSize:48, opacity:0.7}}>📝</div>
        <div style={{fontWeight:800, fontSize:18}}>Noch keine Notizen</div>
        <div className="muted">Für diesen Stapel gibt es noch keine Zusammenfassung.</div>
      </div>
    );
  }
  const blocks = topic.blocks.map((b, i) => {
    const merksaetze = (b.cards || []).map(c => c.detail && c.detail.merksatz).filter(Boolean);
    const begriffeMap = new Map();
    (b.cards || []).forEach(c => (c.detail && c.detail.begriffe || []).forEach(g => {
      const key = g.split('=')[0].trim();
      if (!begriffeMap.has(key)) begriffeMap.set(key, g);
    }));
    return { i, b, merksaetze, begriffe: Array.from(begriffeMap.values()) };
  }).filter(x => x.merksaetze.length || x.begriffe.length);

  if (!blocks.length) {
    return (
      <div className="card flat" style={{display:'grid', placeItems:'center', padding:'60px 20px', textAlign:'center', gap:14}}>
        <div style={{fontSize:48, opacity:0.7}}>📝</div>
        <div style={{fontWeight:800, fontSize:18}}>Noch keine Notizen</div>
      </div>
    );
  }
  return (
    <div className="col">
      {blocks.map(({ i, b, merksaetze, begriffe }) => (
        <div key={i} className="card flat" style={{padding:18}}>
          <div style={{fontWeight:800, fontSize:16, marginBottom:4}}>Baustein {b.n}: {b.title}</div>
          {merksaetze.length > 0 && (
            <div style={{marginTop:8}}>
              <div className="muted" style={{fontSize:12.5, fontWeight:700, textTransform:'uppercase', letterSpacing:'.03em', marginBottom:6}}>Merksätze</div>
              <ul style={{margin:0, paddingLeft:20, lineHeight:1.6}}>
                {merksaetze.map((m, j) => <li key={j} style={{marginBottom:6}}>{m}</li>)}
              </ul>
            </div>
          )}
          {begriffe.length > 0 && (
            <div style={{marginTop:14}}>
              <div className="muted" style={{fontSize:12.5, fontWeight:700, textTransform:'uppercase', letterSpacing:'.03em', marginBottom:6}}>Begriffe</div>
              <ul style={{margin:0, paddingLeft:20, lineHeight:1.6}}>
                {begriffe.map((g, j) => <li key={j} style={{marginBottom:4}}>{g}</li>)}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function FallbeispieleTab({ topic }) {
  const cases = useMemo(() => flatCases(topic), [topic]);
  const [open, setOpen] = useState({});
  if (!cases.length) {
    return (
      <div className="card flat" style={{display:'grid', placeItems:'center', padding:'60px 20px', textAlign:'center', gap:14}}>
        <div style={{fontSize:48, opacity:0.7}}>🧩</div>
        <div style={{fontWeight:800, fontSize:18}}>Noch keine Fallbeispiele</div>
        <div className="muted">Für diesen Stapel gibt es noch keine Praxisfälle.</div>
      </div>
    );
  }
  return (
    <div className="col">
      {cases.map((c, i) => (
        <div key={i} className="card flat" style={{padding:18}}>
          <div className="muted" style={{fontSize:12.5, fontWeight:700, textTransform:'uppercase', letterSpacing:'.03em'}}>{c.thema || c.blockTitle}</div>
          <div style={{fontWeight:700, marginTop:6}}>{c.scenario}</div>
          <div style={{marginTop:8, fontStyle:'italic'}}>{c.frage}</div>
          {open[i] ? (
            <div style={{marginTop:10, padding:'12px 14px', background:'var(--accent-soft)', borderRadius:12}}>{c.loesung}</div>
          ) : (
            <button className="btn btn-ghost" style={{marginTop:10}} onClick={() => setOpen(o => ({...o, [i]: true}))}>Lösung anzeigen</button>
          )}
        </div>
      ))}
    </div>
  );
}

function LessonsTab({ topic, onStart, ctxLessons }) {
  if (!topic) {
    return (
      <div className="card flat" style={{display:'grid', placeItems:'center', padding:'60px 20px', textAlign:'center', gap:14}}>
        <div style={{fontSize:48, opacity:0.7}}>📖</div>
        <div style={{fontWeight:800, fontSize:18}}>Noch keine Lektionen</div>
      </div>
    );
  }
  const { go, activeStack } = ctxLessons || {};
  return (
    <div className="col">
      {topic.blocks.map((b, i) => {
        const prog = window.LessonStore ? window.LessonStore.getProgress(activeStack, b) : { pct: 0, done: false };
        return (
          <div key={i} className="card" style={{display:'flex', alignItems:'center', gap:14}}>
            <div style={{width:48, height:48, borderRadius:14, background: prog.done ? 'var(--success-soft, #E7F7EE)' : 'var(--accent-soft)', display:'grid', placeItems:'center', fontSize:22}}>{prog.done ? '✅' : '📖'}</div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontWeight:800}}>Baustein {b.n}: {b.title}</div>
              <div className="muted">{b.subtitle || (b.cards.length + ' Karten · ' + b.quiz.length + ' Quizfragen')}</div>
              {prog.pct > 0 && (
                <div style={{display:'flex', alignItems:'center', gap:8, marginTop:6}}>
                  <div style={{flex:1, maxWidth:180, height:6, borderRadius:999, background:'var(--line)', overflow:'hidden'}}>
                    <div style={{width: prog.pct + '%', height:'100%', background: prog.done ? 'var(--success, #1B8A5A)' : 'var(--accent)'}}/>
                  </div>
                  <span className="muted" style={{fontSize:12}}>{prog.pct}%</span>
                </div>
              )}
            </div>
            <button className="btn btn-ghost" onClick={() => onStart(b)}>Quiz</button>
            <button className="btn btn-primary" onClick={() => go && go('lesson', { blockIdx: i })}>
              {prog.done ? 'Nochmal' : prog.pct > 0 ? 'Fortsetzen' : 'Lektion'}
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* Importe-Tab — seit 20.07.2026 (Phase 16) mit echtem Import-Protokoll: alle über
   den Magic-Import übernommenen Quellen (PDF/Word/PPT/YouTube/OCR/Anki/Tabellen/
   Website/Notizen) landen als AIHistory-Eintrag vom Typ 'import' und werden hier
   mit Quelle, Kartenzahl und Datum aufgelistet (gefiltert auf diesen Stapel). */
function ImportTab({ topicId, ctxImport }) {
  const [items, setItems] = useState(() => (window.AIHistory ? window.AIHistory.list() : []));
  useEffect(() => {
    if (!window.AIHistory) return undefined;
    return window.AIHistory.onChange(setItems);
  }, []);
  const imports = items.filter(x => x.type === 'import' && (!topicId || x.topicId === topicId));
  // (Ausbau 21.07.2026) Kacheln waren tote Deko — jetzt führen sie zum echten
  // Import-Flow (neuer eigener Stapel, dort öffnet sich der Quellen-Import).
  const toNewStack = ctxImport ? () => ctxImport.openModal('newStack') : undefined;
  return (
    <div className="col">
      <div style={{fontWeight:800, fontSize:18}}>Quellen importieren</div>
      <div className="import-grid">
        <ImportTile kind="pdf" label="PDF" onClick={toNewStack}/>
        <ImportTile kind="notes" label="Notizen" onClick={toNewStack}/>
        <ImportTile kind="ppt" label="PowerPoint" onClick={toNewStack}/>
        <ImportTile kind="youtube" label="YouTube" onClick={toNewStack}/>
        <ImportTile kind="photo" label="Foto · OCR" onClick={toNewStack}/>
        <ImportTile kind="quizlet" label="Quizlet" onClick={toNewStack}/>
        <ImportTile kind="anki" label="Anki" onClick={toNewStack}/>
        <ImportTile kind="table" label="Tabellen" onClick={toNewStack}/>
        <ImportTile kind="web" label="Website-Link" onClick={toNewStack}/>
      </div>
      <div className="muted" style={{fontSize:12.5}}>
        Quellen-Importe laufen über eigene Stapel: Kachel wählen → neuer Stapel → dort
        öffnet sich der Quellen-Import automatisch (PDF/Word/PPT/YouTube/OCR/Anki/…).
      </div>
      <div style={{fontWeight:800, fontSize:18, marginTop:10}}>Bereits importierte Quellen</div>
      {imports.length === 0 && (
        <div className="muted" style={{fontSize:13.5}}>
          Noch keine Importe für diesen Stapel — Quellen lassen sich über den Magic-Import
          eines (leeren) eigenen Stapels übernehmen.
        </div>
      )}
      {imports.map(x => (
        <div key={x.id} className="card flat" style={{display:'flex', gap:12, alignItems:'center', padding:12}}>
          <div style={{fontSize:22}}>📥</div>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{x.title}</div>
            <div className="muted" style={{fontSize:12.5}}>{x.subtitle}</div>
          </div>
          <span className="muted" style={{fontSize:12.5, flexShrink:0}}>{new Date(x.ts).toLocaleDateString('de-DE')}</span>
        </div>
      ))}
    </div>
  );
}

// Echte Rangliste für DIESEN Stapel (xp_topic, gefiltert auf Freunde + dich selbst) —
// vorher war das eine komplett feste Beispiel-Liste (FRIENDS) ohne jeden Bezug zum
// tatsächlichen Stapel. Ohne Login/Supabase bleibt die Beispiel-Liste als Vorschau sichtbar.
function LeaderboardTab({ ctx, topicId }) {
  const { session } = ctx || {};
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let cancelled = false;
    if (!session || !window.sb || !topicId) { setRows(null); return; }
    (async () => {
      const d = await fLoadAll(session.user.id);
      const ids = d.friends.map(f => (f.user_a === session.user.id ? f.user_b : f.user_a));
      ids.push(session.user.id);
      const { data: profs } = await window.sb.from('profiles')
        .select('id, username, avatar').in('id', ids);
      const { data: xpRows } = await window.sb.from('xp_topic')
        .select('user_id, xp').eq('topic_id', topicId).in('user_id', ids);
      if (cancelled || !profs) return;
      const sums = {};
      ids.forEach(id => { sums[id] = 0; });
      (xpRows || []).forEach(r => { sums[r.user_id] = r.xp || 0; });
      setRows(profs.map(p => ({ ...p, xp: sums[p.id] || 0 })).sort((a, b) => b.xp - a.xp));
    })();
    return () => { cancelled = true; };
  }, [session && session.user && session.user.id, topicId]);

  if (!session || !rows) {
    return (
      <div className="card flat" style={{textAlign:'center', padding:26}}>
        <div style={{fontSize:30}}>🏆</div>
        <div style={{fontWeight:800, marginTop:4}}>Noch keine Rangliste</div>
        <div className="muted" style={{fontSize:13}}>Melde dich an, um die echte Rangliste für diesen Stapel zu sehen.</div>
      </div>
    );
  }
  return (
    <div className="col">
      {rows.map((p, i) => {
        const me = session.user.id === p.id;
        return (
          <div key={p.id} className="card flat" style={{display:'flex', alignItems:'center', gap:14, padding:14, background: me ? 'var(--accent-soft)' : undefined}}>
            {i < 3 ? <div className={"medal " + (i===1?'silver':i===2?'bronze':'')}>{i+1}</div> : <div style={{width:28, textAlign:'center', fontWeight:800, color:'var(--ink-mute)'}}>{i+1}</div>}
            <AnimalAvatar kind={p.avatar || '🦔'} size={38}/>
            <div style={{flex:1, fontWeight:800}}>{p.username}{me ? ' (du)' : ''}</div>
            <span className="xp-pill">{window.XP ? window.XP.fmt(p.xp || 0) : (p.xp || 0)} XP</span>
          </div>
        );
      })}
      {rows.length === 1 && <div className="muted" style={{fontSize:12.5}}>Noch keine Freunde — füge welche über die Freunde-Kachel hinzu.</div>}
    </div>
  );
}

/* ============== TUTOR CHAT ============== */
/* 03.08.2026 überarbeitet. Der alte Stand rief window.claude.complete() auf —
   das gibt es nur in der Claude-eigenen Vorschau; auf echtem Netlify blieb der
   Chat stumm und landete immer im catch-Zweig ("Ups, ich konnte gerade nicht
   antworten"). Jetzt läuft er über dieselbe Strecke wie der Karten-Tutor
   (app/tutor.js → /.netlify/functions/tutor) und rendert strukturiert
   (TutorMarkdown). Außerdem hat der Modus "Neue Lektion" endlich eine
   Funktion: er schickt beim Start eine Eröffnungsfrage los, statt nur eine
   Kachel zu markieren und danach dasselbe zu tun wie "Stapel lernen". */
const TUTOR_CHAT_CHIPS = ['Erklär mir Notwehr und Nothilfe', 'Was kommt in der Prüfung oft dran?', 'Gib mir eine Eselsbrücke'];

function TutorChat({ ctx }) {
  const stack = findStack(ctx.activeStack) || {};
  const topic = (window.S34A_BY_ID || {})[ctx.activeStack];
  const blockTitles = (topic && topic.blocks ? topic.blocks : []).slice(0, 8).map(b => b.title);

  const [stage, setStage] = useState('pick'); // pick → chat
  const [mode, setMode] = useState('stack');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  const contextLine = (m) => m === 'stack'
    ? `Die lernende Person arbeitet gerade am Stapel "${stack.name || 'Koran lesen'}"`
      + (blockTitles.length ? ` mit diesen Bausteinen: ${blockTitles.join('; ')}.` : '.')
    : 'Die lernende Person möchte ein neues Thema rund ums Koran-Lesen kennenlernen (arabisches Alphabet, Harekeler, Dehnungen, kurze Suren) und noch nichts Bestimmtes wiederholen.';

  const buildPrompt = (q, history, m) => (
    'Du bist der KI-Tutor einer Koran-Lern-App für Kinder und Anfänger: Arabisch lesen lernen '
    + 'nach der Elifba-Methode (türkische Lesart: üstün=e/a, esre=i/ı, ötre=ü/u), kurze Suren. '
    + 'Antworte kindgerecht, warm und einfach. ' + contextLine(m) + '\n\n'
    + (history.length ? 'BISHERIGES GESPRÄCH:\n' + history.slice(-6)
        .map(x => (x.role === 'user' ? 'LERNENDE PERSON: ' : 'DU: ') + String(x.text).slice(0, 400)).join('\n') + '\n\n' : '')
    + 'NEUE NACHRICHT: ' + q + '\n\n'
    + 'Antworte auf Deutsch in der Du-Form, höchstens 140 Wörter, in Markdown: eine Zeile '
    + '"**Kurz gesagt:** …", danach zwei bis vier Stichpunkte mit "- " mit **fett** gesetzten '
    + 'Fachbegriffen, zum Schluss eine Zeile "💡 **Merke:** …". Keine Einleitung, keine Rückfrage am Ende.'
  );

  // Ehrlich statt erfunden: ohne Backend wird gesagt, was fehlt und was
  // stattdessen funktioniert.
  const OFFLINE_TXT =
    '**Kurz gesagt:** Der freie Chat braucht die Online-Version der App.\n\n'
    + '- Der Tutor läuft über die Netlify-Funktion `/.netlify/functions/tutor` mit hinterlegtem Modell-Schlüssel.\n'
    + '- In dieser Vorschau (Einzeldatei, ohne Server) gibt es die nicht.\n'
    + '- Was hier trotzdem geht: der **Erklären**-Knopf im Quiz und in den Lektionen — der erklärt jede Karte aus dem Kartenmaterial.\n\n'
    + '💡 **Merke:** Erst deployen, dann chatten.';

  const send = async (raw, m) => {
    const q = String(raw == null ? input : raw).trim();
    if (!q || busy) return;
    const useMode = m || mode;
    setInput('');
    const history = messages.filter(x => x.text);
    setMessages(prev => [...prev, { role: 'user', text: q }, { role: 'assistant', text: '' }]);
    setBusy(true);
    const r = await window.Tutor.ask(buildPrompt(q, history, useMode));
    if (r.ok && window.AIHistory) {
      window.AIHistory.log({ type: 'tutor', title: q.slice(0, 80), subtitle: 'KI-Tutor · Chat', topicId: ctx.activeStack });
    }
    setMessages(prev => {
      const copy = prev.slice();
      copy[copy.length - 1] = { role: 'assistant', text: r.ok ? r.text : OFFLINE_TXT, fresh: !!r.ok };
      return copy;
    });
    setBusy(false);
  };

  const start = () => {
    setStage('chat');
    if (mode === 'new') {
      // "Neue Lektion": gleich mit einem Vorschlag loslegen, statt die Person
      // vor ein leeres Eingabefeld zu setzen.
      send('Schlag mir ein Thema aus dem Koran-Lernplan vor, das ich als Nächstes lernen sollte, und erklär es mir in Kürze.', 'new');
    } else {
      setMessages([{ role: 'assistant', text:
        '**Kurz gesagt:** Ich bin dein KI-Tutor 🦉\n\n'
        + `- Frag mich alles zu **${stack.name || 'deinem Stapel'}** — Begriffe, Beispiele, Abgrenzungen.\n`
        + '- Ich antworte kurz und mit einer Eselsbrücke am Ende.' }]);
    }
  };

  if (stage === 'pick') {
    return (
      <div className="page">
        <div className="card" style={{padding:30}}>
          <div className="row" style={{justifyContent:'center', marginBottom:14}}>
            <Owl size={80}/>
          </div>
          <h1 style={{textAlign:'center', fontSize:28}}>Was möchtest du tun?</h1>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginTop:18}}>
            <button className={"mode-card " + (mode==='stack'?'is-selected':'')} onClick={() => setMode('stack')}>
              <div style={{fontSize:38}}>📚</div>
              <div className="mode-ttl">Stapel lernen</div>
              <div className="mode-sub">Mit deinem aktuellen Stapel chatten</div>
            </button>
            <button className={"mode-card " + (mode==='new'?'is-selected':'')} onClick={() => setMode('new')}>
              <div style={{fontSize:38}}>✨</div>
              <div className="mode-ttl">Neue Lektion</div>
              <div className="mode-sub">Lass den Tutor was Neues vorschlagen</div>
            </button>
          </div>
          <button className="btn btn-primary btn-full btn-lg" style={{marginTop:18}} onClick={start}>Loslegen</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{maxWidth:800}}>
      <h1>KI-Tutor</h1>
      <div className="col" style={{gap:12}}>
        {messages.map((m, i) => m.role === 'user' ? (
          <div key={i} className="row" style={{justifyContent:'flex-end'}}>
            <div className="tutor-q">{m.text}</div>
          </div>
        ) : (
          <div key={i} className="ki-bubble">
            <div className="mini-mascot"><MiniAxolotl size={26}/></div>
            <div className="text">
              {m.text
                ? <TutorMarkdown md={m.text} reveal={!!m.fresh}/>
                : <span className="spinner-dots"><span/><span/><span/></span>}
            </div>
          </div>
        ))}
      </div>
      {messages.length <= 1 && (
        <div className="tutor-chips" style={{marginTop:12}}>
          {TUTOR_CHAT_CHIPS.map(c => (
            <button key={c} className="tutor-chip" disabled={busy} onClick={() => send(c)}>{c}</button>
          ))}
        </div>
      )}
      <div className="search-box">
        <div className="row">
          <input value={input} onChange={e => setInput(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && send()}
                 placeholder="Was wollen wir lernen?"/>
          <button className="btn btn-accent" onClick={() => send()} disabled={busy || !input.trim()} style={{padding:'8px 14px'}}>
            <Icon.Arrow/>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============== AKTIVITÄTS-FEED ("Folge ich", Blueprint Phase 7) ============== */
function feedTimeAgo(ts) {
  const diffMs = Date.now() - ts;
  const h = Math.floor(diffMs / 3600000);
  if (h < 1) return 'gerade eben';
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'gestern';
  if (d < 14) return `vor ${d} Tg.`;
  return `vor ${Math.floor(d / 7)} Wo.`;
}

function FeedTab({ ctx, myId }) {
  const { session } = ctx;
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const refresh = async () => {
    if (!myId || !window.Follows) { setFeed([]); return; }
    setLoading(true);
    try { setFeed(await window.Follows.buildFeed(myId)); } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, [myId]);

  if (!window.Auth || !window.Auth.isConfigured() || !session) {
    return (
      <div className="card flat tinted" style={{ padding: 18, textAlign: 'center' }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Folgen &amp; Feed — Zusatzfunktion</div>
        <div className="muted" style={{ fontSize: 13.5 }}>
          Dieser Bereich (Leuten folgen, Aktivitäts-Feed) läuft über die optionale
          Experten-Verbindung. <b>Fürs Lernen, den automatischen Fortschritt und das
          Klassenzimmer brauchst du das nicht</b> — dafür reicht dein Name-Konto.
        </div>
      </div>
    );
  }

  const search = async () => {
    setSearching(true);
    setResults(await window.Follows.search(q, myId));
    setSearching(false);
  };

  const react = async (item) => {
    const r = await window.Follows.toggleReaction(item.eventKey, myId);
    if (!r.ok) return;
    setFeed((list) => list.map((it) => it.eventKey === item.eventKey
      ? { ...it, myReaction: r.reacted, reactionCount: (it.reactionCount || 0) + (r.reacted ? 1 : -1) }
      : it));
  };

  return (
    <div className="col">
      <button className="btn btn-ghost btn-full" onClick={() => setShowSearch((s) => !s)}>
        {showSearch ? 'Suche schließen' : '+ Leuten folgen'}
      </button>
      {showSearch && (
        <div className="card flat" style={{ padding: 14 }}>
          <div className="row" style={{ gap: 8 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()}
                   placeholder="Nutzername suchen…"
                   style={{ flex: 1, padding: 12, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)' }} />
            <button className="btn btn-primary" disabled={searching} onClick={search}>Suchen</button>
          </div>
          <div className="col" style={{ marginTop: 10 }}>
            {results.map((r) => (
              <div key={r.id} className="card flat" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 12 }}>
                <AnimalAvatar kind={r.avatar || '🦔'} size={36} />
                <div style={{ flex: 1, fontWeight: 700 }}>{r.username}</div>
                <window.Follows.FollowButton myId={myId} otherId={r.id} onChange={refresh} />
              </div>
            ))}
          </div>
        </div>
      )}
      {loading && <div className="muted">Lädt…</div>}
      {!loading && !feed.length && (
        <div className="muted" style={{ padding: '18px 4px' }}>
          Noch nichts los. Folge ein paar Leuten, dann tauchen hier ihre Serien-Meilensteine, Level-ups und bestandenen Übungstests auf.
        </div>
      )}
      {feed.map((it) => (
        <div key={it.eventKey} className="feed-card">
          <AnimalAvatar kind={(it.profile && it.profile.avatar) || '🦔'} size={40} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800 }}>{it.icon} {(it.profile && it.profile.username) || '?'} {it.text}</div>
            <div className="muted" style={{ fontSize: 13 }}>{feedTimeAgo(it.ts)}</div>
          </div>
          <button className="btn btn-ghost" style={{ padding: '8px 12px', fontSize: 13, color: it.myReaction ? 'var(--rose)' : undefined }} onClick={() => react(it)}>
            ❤️ {it.reactionCount || 0}
          </button>
        </div>
      ))}
    </div>
  );
}

/* Mitwirkenden-Band eines geteilten Stapels (Phase 16): Avatare aller
   Personen, die per Code beigetreten sind, plus der Beitrittscode selbst. */
function SharedMembersStrip({ topic }) {
  const [members, setMembers] = useState([]);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (window.SharedStacks) window.SharedStacks.members(topic.id).then((m) => { if (!cancelled) setMembers(m); });
    return () => { cancelled = true; };
  }, [topic.id]);
  const copy = () => {
    try { navigator.clipboard.writeText(topic.code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }, () => {}); } catch (e) {}
  };
  return (
    <div className="card flat tinted" style={{display:'flex', alignItems:'center', gap:12, padding:'10px 14px'}}>
      <span style={{fontSize:20}}>👥</span>
      <div className="row" style={{gap:2}}>
        {members.slice(0, 8).map(m => <AnimalAvatar key={m.id} kind={m.avatar || '🦔'} size={28}/>)}
      </div>
      <div style={{flex:1, fontWeight:700, fontSize:13.5}} className="muted">
        {members.length} {members.length === 1 ? 'Person arbeitet' : 'Personen arbeiten'} an diesem Stapel
      </div>
      <button className="pill" onClick={copy} style={{cursor:'pointer'}}>
        {copied ? 'Kopiert ✅' : `Code: ${topic.code}`}
      </button>
    </div>
  );
}

/* Monster-Sammlung (Blueprint Phase 11) — echte Freischalt-/Ausrüst-Mechanik
   (app/monsters.js) statt des bisherigen Fake-Grids mit erfundener "8 Tage"-Zahl.
   Nächstes gesperrtes Monster erscheint als Ei mit Fortschrittsbalken (Hatch-
   Mechanik), gesperrte Monster als Silhouetten ("Nicht gefangen"-Galerie),
   das ausgerüstete Monster gibt einen passiven XP-Bonus. */
function MonsterCollection() {
  const M = window.Monsters;
  const [, setV] = useState(0);
  const [reveal, setReveal] = useState(null); // gerade geschlüpftes Monster (Reveal-Overlay)
  const revealTimer = useRef(null);
  useEffect(() => () => { if (revealTimer.current) clearTimeout(revealTimer.current); }, []);
  useEffect(() => {
    if (!M) return undefined;
    // WICHTIG: erst abonnieren, DANN checkUnlocks() — sonst verpufft das notify()
    // einer frischen Freischaltung, bevor der Listener registriert ist, und die
    // Karte bliebe bis zur nächsten Interaktion auf dem alten Stand.
    const unsub = M.onChange(() => setV(v => v + 1));
    M.checkUnlocks(); // nachziehen, falls die Serie außerhalb eines Quiz gewachsen ist
    return unsub;
  }, []);
  if (!M) return null;
  const st = M.state();
  const streak = window.XP ? window.XP.state().streakDays : 0;
  const ownedCount = Object.keys(st.owned).length;
  const pending = st.pending || [];
  // nächste Schwelle: berücksichtigt Besessenes UND wartende Eier, damit die
  // Vorschau nicht auf ein bereits erhaltenes Ei zeigt.
  const egg = M._pure.nextEgg([...Object.keys(st.owned), ...pending]);
  const equipped = st.equipped ? M.MONSTERS.find(m => m.id === st.equipped) : null;

  // (Ausbau 23.07.2026) Egg/Hatch wie bei Gizmo: bereitliegende Eier schlüpfen per
  // Klick mit Reveal-Animation, statt still ins Raster zu poppen.
  const doHatch = () => {
    const hatched = M.hatch();
    if (hatched) {
      setReveal(hatched);
      window.Sound && window.Sound.stackMastered && window.Sound.stackMastered();
      window.Celebrate && window.Celebrate.bigCelebration({ count: 70 });
      if (revealTimer.current) clearTimeout(revealTimer.current);
      revealTimer.current = setTimeout(() => setReveal(null), 6000);
    }
  };

  return (
    <div className="card">
      {reveal && (
        <div className="mastered-overlay" onClick={() => setReveal(null)}>
          <div className="mastered-ring"/><div className="mastered-ring r2"/><div className="mastered-ring r3"/><div className="mastered-ring r4"/>
          <div className="mastered-card">
            <span className="mastered-trophy">{reveal.emoji}</span>
            <div className="mastered-title">{reveal.name} geschlüpft!</div>
            <div className="mastered-sub">{M.RARITIES[reveal.rarity].label} · +{Math.round(M.RARITIES[reveal.rarity].bonus*100)}% XP</div>
            <div><span className="mastered-badge">Neues Monster 🎉</span></div>
          </div>
        </div>
      )}
      <div className="row" style={{justifyContent:'space-between', marginBottom:10}}>
        <div style={{fontWeight:800}}>Monster-Sammlung · {ownedCount}/{M.MONSTERS.length}</div>
        {equipped && (
          <span className="pill" style={{fontSize:12}} title="Passiver XP-Bonus des ausgerüsteten Monsters">
            {equipped.emoji} +{Math.round(M.RARITIES[equipped.rarity].bonus * 100)}% XP
          </span>
        )}
      </div>
      {pending.length > 0 && (
        <div className="card flat tinted" style={{padding:14, marginBottom:12, textAlign:'center'}}>
          <div style={{fontWeight:800, marginBottom:8}}>🥚 {pending.length} {pending.length === 1 ? 'Ei ist' : 'Eier sind'} schlüpfbereit!</div>
          <div style={{fontSize:44, marginBottom:8, animation:'trophyBounce 1.4s ease infinite'}}>🥚</div>
          <button className="btn btn-primary btn-full" onClick={doHatch}>🎮 Lass dein Ei schlüpfen</button>
        </div>
      )}
      {pending.length === 0 && egg && (
        <div className="card flat tinted" style={{display:'flex', gap:14, alignItems:'center', padding:14, marginBottom:12}}>
          <div style={{fontSize:38}}>🥚</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:800}}>Nächstes Ei bei {egg.days} {egg.days === 1 ? 'Tag' : 'Tagen'} Serie</div>
            <div className="xp-bar" style={{marginTop:6}}>
              <div className="fill" style={{width: `${Math.min(100, Math.round((streak / egg.days) * 100))}%`}}/>
            </div>
            <div className="muted" style={{fontSize:12.5, marginTop:4}}>Aktuelle Serie: {streak} {streak === 1 ? 'Tag' : 'Tage'} · {M.RARITIES[egg.rarity].label}</div>
          </div>
        </div>
      )}
      <div className="collect-grid">
        {M.MONSTERS.map((m) => {
          const owned = !!st.owned[m.id];
          const isEquipped = st.equipped === m.id;
          return (
            <button key={m.id} className={"collect-cell " + (owned ? '' : 'locked')}
                    title={owned ? `${m.name} (${M.RARITIES[m.rarity].label}) — klicken zum ${isEquipped ? 'Ablegen' : 'Ausrüsten'} (+${Math.round(M.RARITIES[m.rarity].bonus*100)}% XP)` : `Noch nicht gefangen — schlüpft bei ${m.days} Tagen Serie`}
                    onClick={() => owned && M.equip(isEquipped ? null : m.id)}
                    style={{
                      cursor: owned ? 'pointer' : 'default', position:'relative', border:'none',
                      outline: isEquipped ? '3px solid ' + M.RARITIES[m.rarity].color : 'none',
                      filter: owned ? 'none' : 'grayscale(1) brightness(0.35)',
                      opacity: owned ? 1 : 0.5,
                    }}>
              {m.emoji}
              {!owned && <span style={{position:'absolute', bottom:2, right:4, fontSize:9.5, fontWeight:800, color:'var(--ink-mute)', filter:'none'}}>{m.days}T</span>}
              {isEquipped && <span style={{position:'absolute', top:-4, right:-4, fontSize:12}}>⭐</span>}
            </button>
          );
        })}
      </div>
      <div className="muted" style={{fontSize:12.5, marginTop:10}}>
        Monster schlüpfen bei Serien-Meilensteinen und bleiben für immer. Ein ausgerüstetes Monster (⭐) gibt einen passiven XP-Bonus auf jede richtige Antwort.
      </div>
    </div>
  );
}

/* "Freundesserien" (Blueprint Phase 8) — kombinierte 2er-Streaks, siehe
   app/friendstreaks.js für die Berechnung. Wachsendes Pflanzen-Icon je nach
   gemeinsamer Serienlänge, "+"-Slot zum Hinzufügen weiterer Streak-Partner
   (öffnet die "Hinzufügen"-Suche im bestehenden Freunde-Modal). */
function FriendStreaksCard({ ctx, myId }) {
  const [rows, setRows] = useState(null);
  const [remindedIds, setRemindedIds] = useState({}); // friendId -> true (heute erinnert)
  useEffect(() => {
    let cancelled = false;
    if (myId && window.FriendStreaks) window.FriendStreaks.build(myId).then((r) => {
      if (cancelled) return;
      setRows(r);
      const rem = {};
      r.forEach((x) => { if (window.FriendStreaks.remindedToday(x.friendId)) rem[x.friendId] = true; });
      setRemindedIds(rem);
    });
    else setRows(null);
    return () => { cancelled = true; };
  }, [myId]);

  const remind = (friendId) => {
    const res = window.FriendStreaks.remind(myId, friendId);
    if (res.ok || res.reason === 'already') setRemindedIds((m) => ({ ...m, [friendId]: true }));
  };

  // (Ausbau 26.07.2026, Live-Erkundung von app.gizmo.ai) Gizmo zeigt die
  // Freundesserien als 5-SLOT-RASTER: belegte Slots mit Pflanze + Avatar +
  // Tageszahl, freie Slots als gestrichelte "+"-Kacheln. Darunter die Liste
  // "Serie in Gefahr" mit Erinnern-Button für Freunde, die heute noch fehlen.
  const SLOTS = 5;
  const filled = (rows || []).slice(0, SLOTS);
  const empty = Math.max(0, SLOTS - filled.length);
  const atRisk = (rows || []).filter((r) => r.atRisk);

  return (
    <div className="card">
      <div className="row" style={{justifyContent:'space-between', marginBottom:10}}>
        <div style={{fontWeight:800}}>Freundesserien</div>
        <button className="link" onClick={() => ctx.openModal('friends')}>+ Partner hinzufügen</button>
      </div>
      {!myId && <div className="muted">Melde dich an, um gemeinsame Serien mit Freunden zu sehen.</div>}
      {myId && rows === null && <div className="muted">Lädt…</div>}
      {myId && rows !== null && (
        <>
          <div className="fs-grid">
            {filled.map((r) => (
              <div key={r.friendId} className={'fs-slot' + (r.atRisk ? ' at-risk' : '')}
                   title={(r.profile && r.profile.username) || '?'}>
                <div className="fs-plant">{r.plant}</div>
                <AnimalAvatar kind={(r.profile && r.profile.avatar) || '🦔'} size={30}/>
                <div className="fs-days">{r.streak > 0 ? r.streak + ' Tg.' : '—'}</div>
              </div>
            ))}
            {Array.from({ length: empty }).map((_, i) => (
              <button key={'e' + i} className="fs-slot fs-empty" onClick={() => ctx.openModal('friends')} title="Streak-Partner hinzufügen">
                <div className="fs-plant" style={{opacity:.5}}>🌰</div>
                <div style={{fontSize:22, fontWeight:800, color:'var(--ink-mute)'}}>+</div>
              </button>
            ))}
          </div>
          {rows.length === 0 && (
            <div className="muted" style={{marginTop:8}}>Noch keine Freunde — füge welche hinzu, um gemeinsame Serien zu starten.</div>
          )}
          {atRisk.length > 0 && (
            <div style={{marginTop:14}}>
              <div style={{fontWeight:800, fontSize:13.5, color:'var(--danger, #E4566E)', marginBottom:6}}>⚠️ Serie in Gefahr</div>
              <div className="col" style={{gap:6}}>
                {atRisk.map((r) => (
                  <div key={r.friendId} className="row" style={{justifyContent:'space-between'}}>
                    <div className="row" style={{gap:8}}>
                      <AnimalAvatar kind={(r.profile && r.profile.avatar) || '🦔'} size={26}/>
                      <span style={{fontWeight:700, fontSize:14}}>{(r.profile && r.profile.username) || '?'}</span>
                      <span className="muted" style={{fontSize:12.5}}>hat heute noch nicht gelernt</span>
                    </div>
                    <button className="btn btn-ghost" style={{padding:'5px 12px', fontSize:12.5}}
                            disabled={!!remindedIds[r.friendId]}
                            onClick={() => remind(r.friendId)}>
                      {remindedIds[r.friendId] ? '✓ Erinnert' : '🔔 Erinnern'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ============== PROFILE ============== */
function Profile({ ctx }) {
  const [tab, setTab] = useState('feed');
  const { session, profile } = ctx;
  const myId = session && session.user && session.user.id;
  // Kein Fake-"Nuri" mehr (07.08.2026): Der Profilkopf zeigt das echte
  // Namens-Konto (SimpleSync) — oder "Gast", solange niemand angemeldet ist.
  const ssAcc = window.SimpleSync && window.SimpleSync.account();
  const displayName = session ? ((profile && profile.username) || session.user.email) : (ssAcc ? ssAcc.name : 'Gast');
  const displayHandle = session ? `@${(profile && profile.username) || 'nutzer'}`
    : ssAcc ? (ssAcc.role === 'teacher' ? '🧑‍🏫 Lehrkraft-Konto' : '🧒 Namens-Konto · wird synchronisiert')
    : 'Noch nicht angemeldet — oben rechts den Namen eingeben';
  const [friendCount, setFriendCount] = useState(null);
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  useEffect(() => {
    let cancelled = false;
    if (session && window.sb) fLoadAll(session.user.id).then((d) => { if (!cancelled) setFriendCount(d.friends.length); });
    else setFriendCount(null);
    if (myId && window.Follows) window.Follows.counts(myId).then((c) => { if (!cancelled) setFollowCounts(c); });
    return () => { cancelled = true; };
  }, [myId]);
  const friendLabel = session ? `${friendCount === null ? '…' : friendCount} Freunde` : '14 Freunde (Demo)';
  return (
    <div className="page">
      <div className="card" style={{display:'flex', alignItems:'center', gap:16, padding:20}}>
        <AnimalAvatar kind={(profile && profile.avatar) || '🦔'} size={84}/>
        <div style={{flex:1}}>
          <h1 style={{fontSize:24}}>{displayName}</h1>
          <div className="muted">
            {displayHandle} · {friendLabel}
            {session && <> · {followCounts.followers} Follower · {followCounts.following} Folge ich</>}
          </div>
          {!session && !ssAcc && <div className="muted" style={{fontSize:12.5, marginTop:2}}>Melde dich oben rechts mit deinem Namen an.</div>}
        </div>
        {session ? (
          <button className="btn btn-ghost" onClick={() => ctx.openModal('editProfile')}>Profil bearbeiten</button>
        ) : ssAcc ? (
          <button className="btn btn-ghost" onClick={() => ctx.openModal('auth')}>👤 Konto &amp; Abgleich</button>
        ) : (
          <button className="btn btn-primary" onClick={() => ctx.openModal('auth')}>Anmelden</button>
        )}
        <button className="btn btn-ghost" onClick={() => ctx.go('settings')}>⚙️</button>
      </div>
      <div className="tabs">
        {[['feed','Feed'],['stats','Statistiken'],['stapel','Stapel'],['schule','Schule']].map(([k,l]) => (
          <button key={k} className={"tab " + (tab===k?'is-active':'')} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'feed' && <FeedTab ctx={ctx} myId={myId} />}
      {tab === 'stats' && (
        <div className="col">
          <div className="card">
            <div className="row" style={{justifyContent:'space-between'}}>
              <div style={{fontWeight:800}}>{window.XP ? window.XP.levelInfo().title : 'Neuling'} · {window.XP ? window.XP.fmt(window.XP.levelInfo().total) : 0} XP</div>
              <div className="muted">Level {window.XP ? window.XP.levelInfo().level : 1}</div>
            </div>
            <div className="xp-bar" style={{marginTop:8}}><div className="fill" style={{width: `${window.XP ? Math.round(window.XP.levelInfo().progress*100) : 0}%`}}/></div>
          </div>
          <FriendStreaksCard ctx={ctx} myId={myId} />
          {window.Groups && <window.Groups.GroupsCard ctx={ctx} myId={myId}/>}
          <MonsterCollection/>
          <div className="card">
            <div style={{fontWeight:800, marginBottom:10}}>Abzeichen</div>
            <div className="collect-grid">
              {['🏆','🥇','🔥','⭐','💎','🚀','📚','🎯','🎓'].map((m, i) => (
                <div key={i} className="collect-cell">{m}</div>
              ))}
            </div>
          </div>
        </div>
      )}
      {tab === 'stapel' && (
        <div className="col">
          {QURAN_CHILDREN.map(c => (
            <div key={c.id} className="card" style={{display:'flex', alignItems:'center', gap:14, padding:12, borderLeft:`5px solid ${c.color}`}}>
              <div style={{flex:1, fontWeight:800}}>{c.name}</div>
              <div className="muted">{c.topic.cardCount} Karten</div>
            </div>
          ))}
        </div>
      )}
      {tab === 'schule' && <SchoolTab ctx={ctx} myId={myId}/>}
    </div>
  );
}

/* ============== SHOP ============== */
// Blueprint Phase 6: "Echtes Abbuchen beim Kauf" + die ersten zwei echten Shop-Items
// (Serien-Freeze, Serien-Reparatur) — beide über app/xp.js (spend/buyStreakFreeze/
// repairStreak), Münzen atomar abgezogen, kein Fake-Kauf mehr.
// Seit Phase 14 (20.07.2026) sind auch "Tipps" und "Super-Herzen" ECHT (app/hearts.js):
// Tipps sind 🔑-Schlüssel für den 50:50-Helfer im Quiz, Super-Herzen geben 24h
// unbegrenzte Herzen, dazu "Herzen auffüllen" als drittes Herz-Item.
function Shop({ ctx }) {
  const [xpState, setXpState] = useState(() => (window.XP ? window.XP.state() : { coins: 0, streakFreezes: 0, lastBreak: null, ownedCosmetics: [] }));
  const [heartsState, setHeartsState] = useState(() => (window.Hearts ? window.Hearts.state() : { enabled: false, hearts: 5, max: 5, tips: 0, superActive: false }));
  const [msg, setMsg] = useState(null); // { text, ok } - kurzes Kauf-Feedback
  const FREEZE_COST = window.XP ? window.XP.STREAK_FREEZE_COST : 5;
  const REPAIR_COST = window.XP ? window.XP.STREAK_REPAIR_COST : 8;

  const refresh = () => {
    setXpState(window.XP ? window.XP.state() : { coins: 0, streakFreezes: 0, lastBreak: null, ownedCosmetics: [] });
    setHeartsState(window.Hearts ? window.Hearts.state() : { enabled: false, hearts: 5, max: 5, tips: 0, superActive: false });
  };
  // Regeneration/Käufe anderswo (z.B. im Quiz) live reflektieren (Review 21.07.2026).
  useEffect(() => {
    if (!window.Hearts) return undefined;
    return window.Hearts.onChange(refresh);
  }, []);

  const buyHeartItem = (fn, okText) => {
    if (!window.Hearts) return;
    const r = fn();
    if (r.ok) { setMsg({ text: okText, ok: true }); window.Sound && window.Sound.comboMilestone(1); }
    else if (r.reason === 'full') setMsg({ text: 'Deine Herzen sind schon voll.', ok: false });
    else setMsg({ text: 'Nicht genug Münzen.', ok: false });
    refresh();
    setTimeout(() => setMsg(null), 2200);
  };

  const canRepair = xpState.lastBreak && xpState.lastBreak.brokenOn === (() => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  })();

  const buyFreeze = () => {
    if (!window.XP) return;
    const r = window.XP.buyStreakFreeze();
    if (r.ok) { setMsg({ text: '❄️ Serien-Freeze gekauft!', ok: true }); window.Sound && window.Sound.comboMilestone(1); }
    else setMsg({ text: 'Nicht genug Münzen.', ok: false });
    refresh();
    setTimeout(() => setMsg(null), 2200);
  };
  const buyRepair = () => {
    if (!window.XP) return;
    const r = window.XP.repairStreak();
    if (r.ok) { setMsg({ text: `🔧 Serie repariert — wieder bei ${r.streakDays} Tagen!`, ok: true }); window.Sound && window.Sound.streakSecured(); }
    else setMsg({ text: r.reason === 'coins' ? 'Nicht genug Münzen.' : 'Gerade nichts zu reparieren.', ok: false });
    refresh();
    setTimeout(() => setMsg(null), 2200);
  };
  const buyCosmetic = (id) => {
    if (!window.XP) return;
    const r = window.XP.buyCosmetic(id);
    if (r.ok) { setMsg({ text: `${id} freigeschaltet! Auswählbar unter "Profil bearbeiten".`, ok: true }); window.Sound && window.Sound.comboMilestone(1); }
    else setMsg({ text: r.reason === 'coins' ? 'Nicht genug Münzen.' : 'Das hat nicht geklappt.', ok: false });
    refresh();
    setTimeout(() => setMsg(null), 2600);
  };

  return (
    <div className="page">
      <div className="row" style={{justifyContent:'space-between'}}>
        <button className="icon-btn" onClick={() => ctx.go('home')}><Icon.Back/></button>
        <h1 style={{fontSize:22}}>Shop</h1>
        <span className="pill"><Icon.Gem id="shop"/> {xpState.coins}</span>
      </div>
      {msg && (
        <div className="card flat" style={{marginTop:8, padding:'10px 14px', fontWeight:700, color: msg.ok ? 'var(--mint-ink, #1c7a4f)' : 'var(--rose)'}}>
          {msg.text}
        </div>
      )}
      <div style={{fontWeight:800, marginTop:4}}>Power-ups</div>
      <div className="row" style={{gap:10}}>
        <span className="pill"><Icon.Key id="s1"/> {heartsState.enabled ? heartsState.tips : '∞'}</span>
        <span className="pill"><Icon.Heart id="s2"/> {heartsState.enabled ? (heartsState.superActive ? '∞' : heartsState.hearts) : '∞'}</span>
      </div>
      {!heartsState.enabled && (
        <div className="muted" style={{fontSize:12.5}}>
          Das Herzen-System ist in den Einstellungen ausgeschaltet — Herzen und Tipps sind unbegrenzt.
        </div>
      )}
      <div className="shop-grid">
        <div className="shop-card">
          <Icon.Key id="sk"/>
          <div className="qty">{heartsState.enabled ? heartsState.tips : '∞'}</div>
          <div className="name">Tipps</div>
          <div className="muted" style={{fontSize:12.5, marginTop:2}}>Schlüssel für den 50:50-Helfer</div>
          {/* Mengen-Bündel mit Rabatt (Ausbau 25.07.2026, Gizmo-Live-Fund): je größer das
              Paket, desto günstiger pro Tipp. */}
          <div className="col" style={{gap:6, marginTop:8, width:'100%'}}>
            {(window.Hearts ? window.Hearts.TIP_BUNDLES : []).map((bd) => (
              <button key={bd.id} className="btn btn-ghost btn-full" style={{position:'relative', display:'flex', justifyContent:'space-between', alignItems:'center', gap:6}}
                      disabled={!heartsState.enabled || xpState.coins < bd.cost}
                      onClick={() => buyHeartItem(() => window.Hearts.buyTips(bd.id), '🔑 +' + bd.tips + ' Tipps gekauft!')}>
                <span style={{fontWeight:700}}>+{bd.tips} Tipps</span>
                <span className="row" style={{gap:4}}>
                  {bd.save > 0 && <span className="pill" style={{fontSize:10.5, padding:'1px 6px', background:'rgba(52,199,89,0.16)', color:'var(--success)'}}>-{bd.save}%</span>}
                  <span style={{fontWeight:800}}>{bd.cost} <Icon.Gem id={'bt'+bd.id}/></span>
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="shop-card">
          <div style={{fontSize:32}}>💗</div>
          <div className="qty">{heartsState.enabled ? (heartsState.superActive ? '∞' : heartsState.hearts) : '∞'}</div>
          <div className="name">Herzen auffüllen</div>
          <div className="muted" style={{fontSize:12.5, marginTop:2}}>Sofort wieder volle {heartsState.max} Herzen</div>
          <button className="btn btn-ghost btn-full" style={{marginTop:8}}
                  disabled={!heartsState.enabled || heartsState.superActive || heartsState.hearts >= heartsState.max || xpState.coins < (window.Hearts ? window.Hearts.REFILL_COST : 3)}
                  onClick={() => buyHeartItem(() => window.Hearts.buyRefill(), '💗 Herzen aufgefüllt!')}>
            {window.Hearts ? window.Hearts.REFILL_COST : 3} <Icon.Gem id="br"/> kaufen
          </button>
        </div>
        <div className="shop-card">
          <Icon.Heart id="sh"/>
          <div className="qty">{heartsState.superActive ? 'AKTIV' : '–'}</div>
          <div className="name">Super-Herzen</div>
          <div className="muted" style={{fontSize:12.5, marginTop:2}}>24 Stunden unbegrenzte Herzen</div>
          <button className="btn btn-ghost btn-full" style={{marginTop:8}}
                  disabled={!heartsState.enabled || xpState.coins < (window.Hearts ? window.Hearts.SUPER_COST : 10)}
                  onClick={() => buyHeartItem(() => window.Hearts.buySuper(), '💖 Super-Herzen aktiv — 24h unbegrenzt!')}>
            {window.Hearts ? window.Hearts.SUPER_COST : 10} <Icon.Gem id="bs"/> kaufen
          </button>
        </div>
      </div>

      <div style={{fontWeight:800, marginTop:18}}>Serie</div>
      <div className="shop-grid">
        <div className="shop-card">
          <div style={{fontSize:32}}>🧊</div>
          <div className="qty">{xpState.streakFreezes || 0}</div>
          <div className="name">Serien-Freeze</div>
          <div className="muted" style={{fontSize:12.5, marginTop:2}}>Rettet automatisch einen verpassten Tag</div>
          <button className="btn btn-ghost btn-full" style={{marginTop:8}} onClick={buyFreeze}
                  disabled={xpState.coins < FREEZE_COST}>
            {FREEZE_COST} <Icon.Gem id="bf"/> kaufen
          </button>
        </div>
        <div className="shop-card">
          <div style={{fontSize:32}}>🔧</div>
          <div className="qty">{canRepair ? '!' : '–'}</div>
          <div className="name">Serien-Reparatur</div>
          <div className="muted" style={{fontSize:12.5, marginTop:2}}>
            {canRepair ? `Stellt deine ${xpState.lastBreak.prevStreak}-Tage-Serie von heute wieder her` : 'Nur am Tag eines Serien-Bruchs verfügbar'}
          </div>
          <button className="btn btn-ghost btn-full" style={{marginTop:8}} onClick={buyRepair}
                  disabled={!canRepair || xpState.coins < REPAIR_COST}>
            {REPAIR_COST} <Icon.Gem id="brep"/> kaufen
          </button>
        </div>
      </div>

      <div style={{fontWeight:800, marginTop:18}}>Cosmetics</div>
      <div className="muted" style={{fontSize:12.5, marginTop:-6, marginBottom:4}}>Zusätzliche Avatare — einmal gekauft, dauerhaft wählbar unter "Profil bearbeiten"</div>
      <div className="shop-grid">
        {(window.XP ? window.XP.PREMIUM_AVATARS : []).map((item) => {
          const owned = (xpState.ownedCosmetics || []).includes(item.id);
          return (
            <div className="shop-card" key={item.id}>
              <div style={{fontSize:32}}>{item.id}</div>
              <div className="qty">{owned ? '✓' : '🔒'}</div>
              <div className="name">{item.name}</div>
              {owned ? (
                <div className="muted" style={{fontSize:12.5, marginTop:8, fontWeight:700}}>Freigeschaltet</div>
              ) : (
                <button className="btn btn-ghost btn-full" style={{marginTop:8}} onClick={() => buyCosmetic(item.id)}
                        disabled={xpState.coins < item.cost}>
                  {item.cost} <Icon.Gem id={'bc'+item.id}/> kaufen
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="premium-banner" style={{marginTop:18}}>
        <div style={{fontSize:42}}>🚀</div>
        <div style={{flex:1}}>
          <div className="ttl">Unlimited</div>
          <div>Unbegrenzte KI-Antworten · alle Importe · Premium-Stapel</div>
        </div>
        <button className="btn btn-light">Upgraden</button>
      </div>
    </div>
  );
}

/* ============== SETTINGS ============== */
/* Einstellungen — seit 20.07.2026 vollständig echt:
   - Der "Unlimited holen"-Fake-Premium-Banner ist ENTFERNT (Phase 15,
     Entscheidung: bewusst KEIN Freemium/Paywall-Modell — siehe README).
   - Toggle-Liste bereinigt: nur noch Toggles mit echter Wirkung (Sounds/
     Haptik/Dunkelmodus über app/tweaks.js + NEU "Herzen-System", Phase 14).
     Die alten wirkungslosen UI-Dummies (E-Mail-Benachrichtigungen,
     Karten-Erinnerungen, "Stapel öffentlich") sind entfernt — Stapel werden
     jetzt explizit pro Stapel über das ⋮-Menü veröffentlicht (Phase 13).
   - "Freunde einladen" öffnet das echte Referral-Modal (Phase 16).
   - Kontoinformationen / Anmeldung & Sicherheit / Konto löschen sind echte
     Aktionen (Phase 16, Standard-Kontoverwaltung). "Abonnement" entfällt
     ersatzlos (kein Bezahlmodell, Phase 15). */
function Settings({ ctx }) {
  const t = { sounds: ctx.tweaks.sounds !== false, haptik: ctx.tweaks.haptik !== false, dark: !!ctx.tweaks.dark };
  const SS = window.SimpleSync;
  const acc = SS && SS.account();
  const [msg, setMsg] = useState('');

  /* Freunde einladen = den Link zur App teilen. Kein Konto, keine Punkte —
     bei einer Klassen-App ist das Weitergeben der Adresse der ganze Zweck. */
  const invite = async () => {
    const url = location.origin + location.pathname.replace(/[^/]*$/, '');
    const text = 'Lern mit mir Koran lesen! 🌙 Elif & Ba — einfach Namen eingeben und loslegen: ' + url;
    try {
      if (navigator.share) { await navigator.share({ title: 'Elif & Ba', text: text, url: url }); return; }
      await navigator.clipboard.writeText(text);
      setMsg('Einladung kopiert ✅ — jetzt einfach einfügen und verschicken.');
    } catch (e) {
      setMsg('Adresse zum Weitergeben: ' + url);
    }
    setTimeout(() => setMsg(''), 6000);
  };

  const row = (icon, label, right, onClick) => (
    <div className="setting-row" style={onClick ? {cursor:'pointer'} : undefined} onClick={onClick}>
      {icon && <span style={{fontSize:22}}>{icon}</span>}
      <span className="lbl">{label}</span>
      {right !== undefined ? right : <Icon.Caret style={{color:'var(--ink-mute)'}}/>}
    </div>
  );

  return (
    <div className="page" style={{maxWidth:720}}>
      <div className="row" style={{justifyContent:'space-between'}}>
        <button className="icon-btn" onClick={() => ctx.go('profile')}><Icon.Back/></button>
        <h1 style={{fontSize:22}}>Einstellungen</h1>
        <div style={{width:40}}/>
      </div>

      <div className="card flat settings-list">
        {row('📲', 'Als App installieren', undefined, () => {
          if (window.PWAInstall && window.PWAInstall.prompt()) return;
          alert(/iPhone|iPad|iPod/i.test(navigator.userAgent)
            ? 'Auf dem iPhone/iPad: In Safari unten auf das Teilen-Symbol tippen und dann "Zum Home-Bildschirm" wählen.'
            : 'Im Browser-Menü (⋮) auf "App installieren" bzw. "Zum Startbildschirm hinzufügen" tippen — dann öffnet sich die App wie eine echte App mit eigenem Icon.');
        })}
        {row('📧', 'Freunde einladen', <span className="muted" style={{fontSize:12.5}}>Link teilen</span>, invite)}
        {row('❓', 'Hilfe', undefined, () => ctx.go('help'))}
        {row('💬', 'Kontakt', undefined, () => ctx.go('help'))}
        {row('🌍', 'Sprache', <span className="muted">Deutsch</span>, () => ctx.go('help'))}
      </div>
      {!!msg && <div className="muted" style={{fontWeight:700, margin:'8px 2px', fontSize:13}}>{msg}</div>}

      <div className="card flat settings-list">
        {[['sounds','Sounds'],['haptik','Haptik'],['dark','Dunkelmodus']].map(([k,l]) => (
          <div key={k} className="setting-row">
            <span className="lbl">{l}</span>
            <button className={"toggle " + (t[k]?'on':'')} onClick={() => ctx.setTweak(k, !t[k])}/>
          </div>
        ))}
      </div>

      <div className="card flat settings-list">
        {row(null, 'Konto & Sicherheit',
             <span className="muted" style={{fontSize:12.5}}>{acc ? acc.name : 'nicht angemeldet'}</span>,
             () => acc ? ctx.go('account') : ctx.openModal('auth'))}
        {row(null, '🔧 Verbindung prüfen', undefined, () => ctx.openModal('servercheck'))}
        {acc
          ? <div className="setting-row" style={{cursor:'pointer'}}
                 onClick={() => { if (window.confirm('Wirklich abmelden? Dein Fortschritt bleibt gespeichert.')) { SS.logout(); ctx.go('home'); } }}>
              <span className="lbl" style={{color:'var(--rose)'}}>Abmelden</span>
            </div>
          : <div className="setting-row" style={{cursor:'pointer'}} onClick={() => ctx.openModal('auth')}>
              <span className="lbl">Anmelden</span>
            </div>}
        <div className="setting-row" style={{cursor:'default'}}>
          <span className="lbl muted" style={{fontSize:12.5}}>🌙 Elif &amp; Ba — {window.APP_VERSION || 'Version unbekannt'}</span>
        </div>
      </div>
    </div>
  );
}

/* ==============================================================
   KONTO & SICHERHEIT — ersetzt die alten Supabase-Fenster, die ohne
   Supabase-Projekt nur „bitte anmelden" anzeigen konnten.
   ============================================================== */
function AccountScreen({ ctx }) {
  const SS = window.SimpleSync;
  const acc = SS && SS.account();
  const st = SS && SS.status();
  const [hasPass, setHasPass] = useState(null);
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [, force] = useState(0);

  useEffect(() => { if (SS && SS.hasPassword) SS.hasPassword().then(setHasPass); }, []);

  if (!acc) {
    return (
      <div className="page" style={{maxWidth:560}}>
        <div className="card" style={{padding:26, textAlign:'center'}}>
          <div style={{fontSize:40}}>🧒</div>
          <div style={{fontWeight:800, marginTop:6}}>Noch nicht angemeldet</div>
          <div className="muted" style={{fontSize:13.5, margin:'6px 0 14px'}}>
            Melde dich mit deinem Namen an — mehr braucht es nicht.
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => ctx.openModal('auth')}>Anmelden</button>
        </div>
      </div>
    );
  }

  const stateTxt = st.state === 'syncing' ? '⏳ Wird gerade abgeglichen …'
    : st.state === 'lokal' ? '📱 Nur auf diesem Gerät — verbindet sich automatisch, sobald der Server da ist.'
    : st.state === 'offline' ? '📴 Offline — der Abgleich läuft automatisch nach.'
    : st.state === 'error' ? '⚠️ ' + (st.error || 'Abgleich fehlgeschlagen')
    : st.lastSync ? '✅ Gesichert (zuletzt ' + new Date(st.lastSync).toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'}) + ' Uhr)'
    : '🔄 Erster Abgleich läuft gleich …';

  const savePass = async () => {
    setErr(''); setMsg(''); setBusy(true);
    const r = await SS.setPassword(oldPass, newPass);
    setBusy(false);
    if (r.ok) {
      setHasPass(!!r.hasPass); setOldPass(''); setNewPass('');
      setMsg(r.hasPass ? 'Geheimwort gespeichert ✅' : 'Geheimwort entfernt ✅ — du meldest dich jetzt wieder nur mit dem Namen an.');
      setTimeout(() => setMsg(''), 4000);
    } else setErr(r.error || 'Das hat nicht geklappt.');
  };

  const removeAccount = async () => {
    if (!window.confirm('Konto wirklich löschen? Dein Fortschritt wird vom Server entfernt. Das lässt sich nicht rückgängig machen.')) return;
    setBusy(true);
    const r = await SS.deleteAccount(oldPass);
    setBusy(false);
    if (r.ok) { ctx.go('home'); }
    else setErr(r.error || 'Löschen fehlgeschlagen.');
  };

  return (
    <div className="page" style={{maxWidth:600}}>
      <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
        <button className="icon-btn" onClick={() => ctx.go('settings')}><Icon.Back/></button>
        <h1 style={{fontSize:22, margin:0}}>Konto &amp; Sicherheit</h1>
        <div style={{width:40}}/>
      </div>

      <div className="card" style={{padding:18, marginTop:12}}>
        <div style={{fontWeight:800, marginBottom:8}}>Kontoinformationen</div>
        <div className="col" style={{gap:6, fontSize:14}}>
          <div className="row"><span className="muted" style={{flex:'0 0 46%'}}>Name</span><b>{acc.name}</b></div>
          <div className="row"><span className="muted" style={{flex:'0 0 46%'}}>Rolle</span><b>{acc.role === 'teacher' ? 'Lehrkraft' : 'Schüler:in'}</b></div>
          <div className="row"><span className="muted" style={{flex:'0 0 46%'}}>Gruppe</span><b>{acc.classCode || 'ALLE'}</b></div>
          <div className="row"><span className="muted" style={{flex:'0 0 46%'}}>Geheimwort</span><b>{hasPass === null ? '…' : hasPass ? 'gesetzt' : 'keins (nur Name)'}</b></div>
          <div className="row"><span className="muted" style={{flex:'0 0 46%'}}>Abgleich</span><span style={{fontWeight:700}}>{stateTxt}</span></div>
        </div>
        <div className="row" style={{gap:10, marginTop:14, flexWrap:'wrap'}}>
          <button className="btn btn-ghost" onClick={() => { SS.syncNow(); force(x => x + 1); }}>🔄 Jetzt abgleichen</button>
          <button className="btn btn-ghost" onClick={() => ctx.openModal('servercheck')}>🔧 Verbindung prüfen</button>
        </div>
      </div>

      <div className="card" style={{padding:18, marginTop:12}}>
        <div style={{fontWeight:800}}>🔒 Geheimwort</div>
        <div className="muted" style={{fontSize:13, margin:'4px 0 10px', lineHeight:1.5}}>
          Ein Geheimwort brauchst du nur, wenn zwei Kinder gleich heißen oder du sichergehen willst,
          dass niemand sonst deinen Namen benutzt. Ohne Geheimwort reicht der Name.
        </div>
        {hasPass && (
          <input type="password" value={oldPass} onChange={e => setOldPass(e.target.value)}
                 placeholder="Bisheriges Geheimwort"
                 style={{width:'100%', padding:'12px 14px', borderRadius:12, border:'1px solid var(--line)', background:'var(--surface)', font:'inherit', boxSizing:'border-box', marginBottom:8}}/>
        )}
        <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)}
               placeholder={hasPass ? 'Neues Geheimwort (leer = entfernen)' : 'Neues Geheimwort (mindestens 4 Zeichen)'}
               style={{width:'100%', padding:'12px 14px', borderRadius:12, border:'1px solid var(--line)', background:'var(--surface)', font:'inherit', boxSizing:'border-box'}}/>
        <button className="btn btn-primary" style={{marginTop:10}} disabled={busy} onClick={savePass}>
          {busy ? 'Einen Moment…' : hasPass ? 'Geheimwort ändern' : 'Geheimwort setzen'}
        </button>
        {!!msg && <div style={{color:'var(--success, #1B8A5A)', fontWeight:800, marginTop:10}}>{msg}</div>}
        {!!err && <div style={{color:'var(--rose, #D64545)', fontWeight:800, marginTop:10}}>{err}</div>}
      </div>

      <div className="card" style={{padding:18, marginTop:12}}>
        <div style={{fontWeight:800}}>Abmelden &amp; löschen</div>
        <div className="muted" style={{fontSize:13, margin:'4px 0 10px', lineHeight:1.5}}>
          <b>Abmelden</b> lässt alles stehen — mit demselben Namen bist du sofort wieder da.
          <b> Löschen</b> entfernt dein Konto und deinen Fortschritt endgültig vom Server.
        </div>
        <div className="row" style={{gap:10, flexWrap:'wrap'}}>
          <button className="btn btn-ghost" onClick={() => { if (window.confirm('Wirklich abmelden? Dein Fortschritt bleibt gespeichert.')) { SS.logout(); ctx.go('home'); } }}>Abmelden</button>
          <button className="btn btn-ghost" style={{color:'var(--rose, #D64545)'}} disabled={busy} onClick={removeAccount}>Konto löschen</button>
        </div>
      </div>
    </div>
  );
}

/* ==============================================================
   HILFE, KONTAKT & SPRACHE — echte Inhalte statt toter Zeilen.
   ============================================================== */
function HelpScreen({ ctx }) {
  const SS = window.SimpleSync;
  const isTeacher = SS && SS.isTeacher && SS.isTeacher();
  const Q = ({ q, children }) => (
    <div className="card" style={{padding:16, marginTop:10}}>
      <div style={{fontWeight:800, marginBottom:4}}>{q}</div>
      <div className="muted" style={{fontSize:13.5, lineHeight:1.6}}>{children}</div>
    </div>
  );
  return (
    <div className="page" style={{maxWidth:700}}>
      <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
        <button className="icon-btn" onClick={() => ctx.go('settings')}><Icon.Back/></button>
        <h1 style={{fontSize:22, margin:0}}>Hilfe</h1>
        <div style={{width:40}}/>
      </div>

      <Q q="Wie melde ich mich an?">
        Oben rechts auf <b>Anmelden</b> tippen, deinen <b>Namen</b> eintragen, fertig.
        Kein Code, kein Passwort. Wer schon einmal da war, tippt seinen Namen in der Liste an.
        Auf einem zweiten Gerät denselben Namen eingeben — der Fortschritt ist automatisch da.
      </Q>
      <Q q="Wie lerne ich?">
        Startseite → <b>▶️ Weiterlernen</b>. Jeder neue Buchstabe wird dir zuerst gezeigt und
        vorgesprochen, danach kommen die Fragen. Mit 🔊 hörst du ihn nochmal, mit 🐢 langsam.
        Der grüne Kreis füllt sich, je sicherer ein Buchstabe sitzt.
      </Q>
      <Q q="Wann darf ich auswendig lernen?">
        Auswendiglernen öffnet sich, wenn du <b>alle 17 Lektionen einmal auf 100 %</b> gebracht hast —
        erst lesen können, dann auswendig lernen. Unter „Meine Stapel" siehst du, wie viele es schon
        sind und was noch fehlt. Der <b>♾️ Unendlich-XP-Modus</b> kommt danach: Für ihn musst du alles
        <b>zweimal</b> durchgespielt haben.
      </Q>
      <Q q="Wie lerne ich eine Sure auswendig?">
        Startseite → <b>🕌 Auswendig lernen</b> (oder Meine Stapel → „🕌 Auswendig lernen").
        Such dir eine Sure aus — Sübhâneke, Fâtiha, Kevser und İhlâs brauchst du für den Namaz zuerst.
        Dann führt dich die App Vers für Vers durch vier Stufen: <b>👂 hören</b>, <b>🎤 nachsprechen</b>,
        <b>🧩 die Wörter puzzeln</b> und <b>🌟 frei aufsagen</b>. Danach hängst du die Verse zur
        <b>Kette</b> zusammen (1+2, dann 1+2+3 …) und sagst zum Schluss alles am Stück auf — dafür
        gibt es die 🏆 Krone. <b>Hier gibt es die meisten Punkte der ganzen App</b>, und je mehr
        Suren du schon kannst, desto mehr bringt die nächste.
      </Q>
      <Q q="Wann muss ich etwas laut sagen?">
        In <b>Lektion 1 „Die Buchstaben"</b> kommt nach jeder Karte ein kleiner Knopf:
        <b>„🎤 Sag ‚Elif‘ laut"</b>. Sagst du den Namen richtig, gibt es +8 Punkte extra.
        Freiwillig — wer nicht mag, tippt einfach „Weiter". In den anderen Lektionen gibt es das
        nicht: Einzelne Silben wie بَ versteht keine Spracherkennung zuverlässig genug.
        Beim <b>Auswendiglernen</b> der Suren sprichst du dagegen ganze Verse — dort hört der
        Browser auf Arabisch mit.
      </Q>
      <Q q="Ich höre beim Auswendiglernen nichts">
        Der Ton startet nur, wenn du ihn antippst („🔊 Vers anhören") — Handys blockieren Ton, der
        von allein losgeht. Kommt dann immer noch nichts, sagt dir die App warum. Am sichersten ist
        es, wenn deine Lehrkraft die Sure im <b>Aussprache-Studio</b> selbst einspricht: Dann hörst
        du sie überall, sogar ohne Internet.
      </Q>
      <Q q="Warum bekomme ich nur die halbe Punktzahl?">
        Volle Punkte gibt es für alles, was die App wirklich prüfen kann: flüssig ins Mikrofon
        aufgesagt, Wort-Puzzle gelöst, Verse richtig geordnet. Nur die Hälfte gibt es, wenn du
        <b> zu langsam</b> warst (dann hast du gelesen statt aufgesagt), wenn du dir die
        <b> Umschrift</b> eingeblendet hast oder wenn du ohne Mikrofon nur selbst bestätigst.
        Wie viel Zeit du hast, steht vor jeder Aufnahme — und ein Balken läuft mit.
      </Q>
      <Q q="Muss ich ins Mikrofon sprechen?">
        Nein — es geht immer auch ohne. Wenn dein Browser Arabisch versteht (Chrome, Safari),
        hört er beim Nachsprechen mit und zeigt dir Wort für Wort, was schon gut war. Kann er das
        nicht, oder hat deine Lehrkraft das Mikrofon abgeschaltet, setzt du den Vers stattdessen aus
        <b>Wort-Bausteinen</b> zusammen — das gibt genauso viele Punkte.<br/><br/>
        Die Prüfung ist absichtlich großzügig: verschmolzene oder geteilte Wörter werden repariert,
        und kleine Bindewörter dürfen fehlen — ein <b>ganzes Wort</b> darfst du aber nicht auslassen.
        Unter dem Ergebnis steht „Verstanden: …" — daran siehst du, was der Browser gehört hat.<br/><br/>
        <b>Datenschutz:</b> Beim Zuhören schickt Chrome den Ton kurz zu Google, Safari zu Apple.
        Es wird nichts aufbewahrt und nichts an unseren Server geschickt. Deine Lehrkraft kann das
        Mikrofon im Klassenzimmer für dieses Gerät komplett ausschalten.
      </Q>
      <Q q="Was ist der Unendlich-XP-Modus?">
        Der letzte Modus der App. Dort wird <b>alles gleichzeitig</b> abgefragt — kreuz und quer aus
        allen Lektionen, mal das Zeichen, mal der Name. Eine Welle sind 12 Fragen. Was du falsch
        hattest, kommt in den Korb: <b>Bevor die nächste Welle startet, musst du jede Karte aus dem
        Korb noch einmal richtig haben</b> — so lange, bis alles sitzt.<br/><br/>
        Er heißt Unendlich-XP, weil hier die Punkte nie ausgehen. Freigeschaltet wird er erst, wenn
        du <b>jede Lektion zweimal komplett</b> durchgespielt hast — unter „Meine Stapel" siehst du,
        wie viele es schon sind.
      </Q>
      <Q q={'Was ist „Unsere Klasse“?'}>
        Auf <b>Fortschritt</b> siehst du, wie weit deine Mitschüler sind. Ganz oben steht, was ihr
        <b>zusammen</b> geschafft habt — wie viele Suren die ganze Klasse auswendig kann und wie viele
        Punkte ihr diese Woche gesammelt habt. Darunter die Wochen-Tafel: Sie zählt nur die letzten
        7 Tage, du kannst also jede Woche neu vorne mitspielen.<br/><br/>
        Neben jedem Namen ist ein 💪-Knopf: Damit feuerst du jemanden an — <b>💪 Du schaffst das!</b>,
        <b>👏 Maschallah!</b>, <b>🔥 Stark!</b> oder <b>🤲 Ich bete für dich</b>. Er sieht es beim
        nächsten Öffnen der App. Schreiben kann man nichts, nur diese vier Zeichen schicken, und
        dreimal am Tag pro Person — so bleibt es ein Ansporn und wird kein Ärger.
      </Q>
      <Q q="Was sehen die anderen von mir?">
        Nur deinen Namen, deine Punkte, dein Level, deine Serie und wie viele Suren du auswendig
        kannst. <b>Deine Fehler sieht niemand</b> — woran es bei dir gerade hakt und wie weit du in
        welcher Lektion bist, sieht ausschließlich deine Lehrkraft im Klassenzimmer.
      </Q>
      <Q q="Warum gibt eine fertige Lektion weniger Punkte?">
        Weil du sie schon kannst. Eine Lektion, die auf 100 % steht, kannst du so oft wiederholen,
        wie du willst — der <b>erste</b> Durchgang danach bringt noch die <b>Hälfte</b> der Punkte,
        danach ist sie nur noch zum Üben da. Neue Punkte holst du dir in der nächsten Lektion oder
        beim Auswendiglernen.
      </Q>
      <Q q="Wie spiele ich gegen einen Freund?">
        Startseite → <b>⚔️ Duell starten</b> (am Handy der Tab „Duell"). Lektion wählen,
        Mitschüler antippen — bei ihm erscheint die Einladung. Wer schneller richtig ist, bekommt mehr Punkte.
      </Q>
      <Q q="Wie installiere ich die App aufs Handy?">
        <b>Android:</b> blaues Banner auf der Startseite → „Installieren", oder Browser-Menü ⋮ → „App installieren".<br/>
        <b>iPhone/iPad:</b> in Safari das Teilen-Symbol → „Zum Home-Bildschirm".
      </Q>
      <Q q="Ich höre keinen Ton">
        Prüfe zuerst, ob das Handy stummgeschaltet ist. Danach in den Einstellungen den Schalter
        <b> Sounds</b> ansehen. Bleibt es still, sag deiner Lehrkraft Bescheid — sie kann unter
        „Klassenzimmer → Ton prüfen" nachsehen und die Aussprache selbst einsprechen.
      </Q>
      <Q q="Etwas sieht alt aus oder klemmt">
        Einstellungen → <b>Konto &amp; Sicherheit</b> → „🔧 Verbindung prüfen". Dort steht in Klartext,
        ob alles läuft, und es gibt einen Knopf, der den Zwischenspeicher leert. Der Lernfortschritt bleibt dabei erhalten.
      </Q>

      <div className="card" style={{padding:16, marginTop:16, borderLeft:'5px solid var(--accent, #2A6BE0)'}}>
        <div style={{fontWeight:800, marginBottom:4}}>💬 Kontakt</div>
        <div className="muted" style={{fontSize:13.5, lineHeight:1.6}}>
          Diese App gehört deiner Lehrkraft — bei Fragen, falschen Buchstaben oder einer
          Aussprache, die nicht stimmt, sprich sie einfach an. Sie kann jeden Buchstaben
          selbst ändern und neu einsprechen.
          {isTeacher && <><br/><br/><b>Für dich als Lehrkraft:</b> Klassenzimmer → „✏️ Buchstaben &amp; Silben bearbeiten"
          und „🎙️ Aussprache-Studio". Die komplette Anleitung liegt als <b>EINRICHTUNG.md</b> im App-Ordner.</>}
        </div>
      </div>

      <div className="card" style={{padding:16, marginTop:12}}>
        <div style={{fontWeight:800, marginBottom:4}}>🌍 Sprache</div>
        <div className="muted" style={{fontSize:13.5, lineHeight:1.6}}>
          Die App ist auf <b>Deutsch</b>. Die Buchstabennamen folgen dem türkischen Elifba
          (Elif, Be, Te, Se …), weil der Kurs darauf aufbaut. Passt ein Name oder eine
          Umschrift nicht, kann die Lehrkraft ihn jederzeit ändern — die Änderung gilt dann überall.
          {isTeacher && (
            <div style={{marginTop:10}}>
              <button className="btn btn-primary" onClick={() => ctx.go('cardedit')}>✏️ Buchstaben bearbeiten</button>
            </div>
          )}
        </div>
      </div>

      <div className="muted" style={{textAlign:'center', fontSize:12, marginTop:16, opacity:.75}}>
        🌙 Elif &amp; Ba — {window.APP_VERSION || ''}
      </div>
    </div>
  );
}

/* ============== NEUE MODALS (Phase 13/14/16) ============== */

/* Referral: Einladungslink + QR-Code + Share-Buttons (Phase 16). QR über die
   gebündelte qrcodejs-Bibliothek; fehlt sie, bleibt der Link als Text nutzbar. */
function InviteModal({ ctx }) {
  const { session } = ctx;
  const myId = session && session.user && session.user.id;
  const [copied, setCopied] = useState(false);
  const qrRef = useRef(null);
  const link = myId && window.Referral ? window.Referral.inviteLink(myId) : null;

  useEffect(() => {
    if (!link || !qrRef.current || typeof window.QRCode === 'undefined') return;
    qrRef.current.innerHTML = '';
    try { new window.QRCode(qrRef.current, { text: link, width: 148, height: 148, correctLevel: window.QRCode.CorrectLevel.M }); } catch (e) {}
  }, [link]);

  if (!session) {
    return (
      <>
        <ModalHead title="Freunde einladen" onClose={ctx.closeModal}/>
        <div className="modal-body">
          <div className="card flat tinted" style={{padding:20, textAlign:'center'}}>
            <div style={{fontWeight:800, marginBottom:8}}>Erst anmelden</div>
            <div className="muted" style={{marginBottom:14}}>Melde dich an, um deinen persönlichen Einladungslink zu bekommen.</div>
            <button className="btn btn-primary" onClick={() => { ctx.closeModal(); ctx.openModal('auth'); }}>Anmelden</button>
          </div>
        </div>
      </>
    );
  }
  const copy = () => { try { navigator.clipboard.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }, () => {}); } catch (e) {} };
  const shareText = encodeURIComponent('Lern mit mir Koran lesen – Elif & Ba! ' + link);
  return (
    <>
      <ModalHead title="Freunde einladen" onClose={ctx.closeModal}/>
      <div className="modal-body" style={{textAlign:'center'}}>
        <div className="muted" style={{marginBottom:14}}>
          Für jede Person, die sich über deinen Link registriert, bekommst du <b>+{window.Referral ? window.Referral.REWARD_COINS : 10} Münzen</b>.
        </div>
        <div ref={qrRef} style={{display:'grid', placeItems:'center', minHeight:60, marginBottom:14}}/>
        <div className="card flat" style={{padding:12, fontSize:13, wordBreak:'break-all', fontFamily:'Geist Mono, monospace'}}>{link}</div>
        <button className="btn btn-primary btn-full" style={{marginTop:10}} onClick={copy}>{copied ? 'Kopiert ✅' : 'Link kopieren'}</button>
        <div className="row" style={{gap:8, marginTop:12, justifyContent:'center'}}>
          <a className="btn btn-ghost" href={'https://wa.me/?text=' + shareText} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <a className="btn btn-ghost" href={'https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent('Lern mit mir Koran lesen!')} target="_blank" rel="noopener noreferrer">Telegram</a>
          <a className="btn btn-ghost" href={'mailto:?subject=' + encodeURIComponent('Lern mit mir Koran lesen') + '&body=' + shareText}>E-Mail</a>
        </div>
      </div>
    </>
  );
}

/* Stapel veröffentlichen (Phase 13): Kategorie wählen, dann in die Bibliothek. */
function PublishDeckModal({ ctx }) {
  const { session, modal } = ctx;
  const myId = session && session.user && session.user.id;
  const topic = S34A_BY_ID[modal && modal.id];
  const [cat, setCat] = useState('allgemein');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  if (!topic) return <ModalHead title="Veröffentlichen" onClose={ctx.closeModal}/>;
  const publish = async () => {
    setBusy(true); setErr('');
    try {
      await window.Library.publish(myId, topic, cat);
      setDone(true);
    } catch (e) { setErr((e && e.message) || 'Veröffentlichen fehlgeschlagen.'); }
    setBusy(false);
  };
  return (
    <>
      <ModalHead title="In Bibliothek veröffentlichen" onClose={ctx.closeModal}/>
      <div className="modal-body">
        {done ? (
          <div className="card flat tinted" style={{padding:20, textAlign:'center'}}>
            <div style={{fontSize:36}}>🎉</div>
            <div style={{fontWeight:800, marginTop:8}}>"{topic.name}" ist jetzt öffentlich</div>
            <div className="muted">Alle angemeldeten Nutzer:innen finden den Stapel in der Bibliothek.</div>
          </div>
        ) : (
          <>
            <div style={{fontWeight:800, marginBottom:4}}>{topic.name}</div>
            <div className="muted" style={{fontSize:13, marginBottom:14}}>
              Veröffentlicht einen Schnappschuss des Stapels — spätere Änderungen aktualisieren die öffentliche Version nicht automatisch (einfach erneut veröffentlichen).
            </div>
            <div style={{fontWeight:800, marginBottom:8}}>Kategorie</div>
            <div className="col">
              {(window.Library ? window.Library.CATEGORIES : []).map(c => (
                <button key={c.id} className={'card flat' + (cat === c.id ? ' tinted' : '')} style={{padding:12, textAlign:'left', fontWeight: cat === c.id ? 800 : 600, border: cat === c.id ? '2px solid var(--accent)' : undefined}}
                        onClick={() => setCat(c.id)}>{c.label}</button>
              ))}
            </div>
            {err && <div style={{color:'var(--rose)', fontWeight:600, marginTop:10}}>{err}</div>}
          </>
        )}
      </div>
      <div className="modal-foot">
        {done
          ? <button className="btn btn-primary btn-full" onClick={ctx.closeModal}>Fertig</button>
          : <button className="btn btn-primary btn-full" disabled={busy || !myId} onClick={publish}>{busy ? 'Einen Moment…' : myId ? 'Veröffentlichen' : 'Erst anmelden'}</button>}
      </div>
    </>
  );
}

/* Geteilten Stapel erstellen (aus eigenem Stapel) bzw. Code anzeigen (Phase 16). */
function ShareStackModal({ ctx }) {
  const { modal } = ctx;
  const topic = S34A_BY_ID[modal && modal.id];
  const [result, setResult] = useState(null); // {id, code}
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!topic) return <ModalHead title="Gemeinsam bearbeiten" onClose={ctx.closeModal}/>;
  const create = async () => {
    setBusy(true); setErr('');
    try {
      const r = await window.SharedStacks.createFrom(topic);
      setResult(r);
    } catch (e) { setErr((e && e.message) || 'Konnte nicht erstellt werden.'); }
    setBusy(false);
  };
  return (
    <>
      <ModalHead title="Gemeinsam bearbeiten" onClose={ctx.closeModal}/>
      <div className="modal-body">
        {result ? (
          <div className="code-card">
            <div>
              <div style={{color:'var(--ink-mute)', fontWeight:800, fontSize:14}}>Beitrittscode</div>
              <div className="code">{result.code}</div>
              <div className="muted">Wer den Code eingibt, kann Karten zu "{topic.name}" beitragen</div>
            </div>
          </div>
        ) : (
          <>
            <div style={{fontWeight:800, marginBottom:4}}>{topic.name}</div>
            <div className="muted" style={{fontSize:13.5}}>
              Erstellt eine <b>geteilte Kopie</b> dieses Stapels, an der mehrere Personen gemeinsam
              Karten sammeln können (Beitritt per Code, Mitwirkende sichtbar im Stapel-Kopf).
              Dein privater Original-Stapel bleibt unverändert erhalten.
            </div>
            {err && <div style={{color:'var(--rose)', fontWeight:600, marginTop:10}}>{err}</div>}
          </>
        )}
      </div>
      <div className="modal-foot">
        {result
          ? <button className="btn btn-primary btn-full" onClick={ctx.closeModal}>Fertig</button>
          : <button className="btn btn-primary btn-full" disabled={busy || !ctx.session} onClick={create}>{busy ? 'Einen Moment…' : ctx.session ? 'Geteilte Kopie erstellen' : 'Erst anmelden'}</button>}
      </div>
    </>
  );
}

/* Geteiltem Stapel per Code beitreten (Phase 16). */
function JoinSharedModal({ ctx }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const join = async () => {
    setBusy(true); setErr('');
    try {
      const id = await window.SharedStacks.join(code);
      ctx.closeModal();
      ctx.setActiveStack(id);
      ctx.go('deck');
    } catch (e) { setErr((e && e.message) || 'Beitritt fehlgeschlagen.'); }
    setBusy(false);
  };
  return (
    <>
      <ModalHead title="Geteiltem Stapel beitreten" onClose={ctx.closeModal}/>
      <div className="modal-body">
        <div style={{fontWeight:800, marginBottom:10}}>Beitrittscode</div>
        <input value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => e.key === 'Enter' && !busy && join()}
               placeholder="z. B. K3P9QZ" style={{width:'100%', padding:14, fontSize:22, textAlign:'center', letterSpacing:'0.1em', fontFamily:'Geist Mono, monospace', borderRadius:14, border:'1px solid var(--line)', background:'var(--surface)'}}/>
        {err && <div style={{color:'var(--rose)', fontWeight:600, marginTop:10}}>{err}</div>}
      </div>
      <div className="modal-foot">
        <button className="btn btn-primary btn-full btn-lg" disabled={busy} onClick={join}>{busy ? 'Einen Moment…' : 'Beitreten'}</button>
      </div>
    </>
  );
}

/* Kontoinformationen (Phase 16, Standard-Kontoverwaltung). */
function AccountInfoModal({ ctx }) {
  const { session, profile } = ctx;
  return (
    <>
      <ModalHead title="Kontoinformationen" onClose={ctx.closeModal}/>
      <div className="modal-body">
        {!session ? (
          <div className="muted center" style={{padding:'20px 0'}}>Nicht angemeldet.</div>
        ) : (
          <div className="col">
            {[['E-Mail', session.user.email],
              ['Anzeigename', (profile && profile.username) || '—'],
              ['Konto erstellt', profile && profile.created_at ? new Date(profile.created_at).toLocaleDateString('de-DE') : '—'],
              ['Schule', (profile && profile.school) || '—'],
              ['Land', (profile && profile.country) || '—'],
              ['Profil', profile && profile.is_private ? 'Privat 🔒' : 'Öffentlich']].map(([l, v]) => (
              <div key={l} className="row" style={{justifyContent:'space-between', padding:'10px 4px', borderBottom:'1px solid var(--line)'}}>
                <span className="muted">{l}</span><span style={{fontWeight:700}}>{v}</span>
              </div>
            ))}
            <button className="btn btn-ghost btn-full" style={{marginTop:8}} onClick={() => { ctx.closeModal(); ctx.openModal('editProfile'); }}>Profil bearbeiten</button>
          </div>
        )}
      </div>
    </>
  );
}

/* Anmeldung & Sicherheit: Passwort ändern (Phase 16). */
function SecurityModal({ ctx }) {
  const { session } = ctx;
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // {text, ok}
  const change = async () => {
    setMsg(null);
    if (pw1.length < 6) { setMsg({ text: 'Mindestens 6 Zeichen.', ok: false }); return; }
    if (pw1 !== pw2) { setMsg({ text: 'Die Passwörter stimmen nicht überein.', ok: false }); return; }
    setBusy(true);
    try {
      const { error } = await window.sb.auth.updateUser({ password: pw1 });
      if (error) throw error;
      setMsg({ text: 'Passwort geändert ✅', ok: true });
      setPw1(''); setPw2('');
    } catch (e) { setMsg({ text: (e && e.message) || 'Ändern fehlgeschlagen.', ok: false }); }
    setBusy(false);
  };
  return (
    <>
      <ModalHead title="Anmeldung & Sicherheit" onClose={ctx.closeModal}/>
      <div className="modal-body">
        {!session ? (
          <div className="muted center" style={{padding:'20px 0'}}>Nicht angemeldet.</div>
        ) : (
          <div className="col">
            <div className="muted" style={{fontSize:13}}>Angemeldet als <b>{session.user.email}</b></div>
            <div style={{fontWeight:800, marginTop:8}}>Neues Passwort</div>
            <input type="password" value={pw1} onChange={e => setPw1(e.target.value)} placeholder="Mindestens 6 Zeichen"
                   style={{width:'100%', padding:14, borderRadius:14, border:'1px solid var(--line)', background:'var(--surface)'}}/>
            <div style={{fontWeight:800}}>Wiederholen</div>
            <input type="password" value={pw2} onChange={e => setPw2(e.target.value)} onKeyDown={e => e.key === 'Enter' && change()}
                   style={{width:'100%', padding:14, borderRadius:14, border:'1px solid var(--line)', background:'var(--surface)'}}/>
            {msg && <div style={{color: msg.ok ? 'var(--success)' : 'var(--rose)', fontWeight:600}}>{msg.text}</div>}
            <button className="btn btn-primary btn-full" disabled={busy} onClick={change}>{busy ? 'Einen Moment…' : 'Passwort ändern'}</button>
          </div>
        )}
      </div>
    </>
  );
}

/* Konto löschen (Phase 16). Löscht alle eigenen Datenzeilen über die RLS-delete-
   Policies und meldet ab. Der nackte auth.users-Eintrag lässt sich clientseitig
   NICHT löschen (bräuchte service_role/Server-Function — diese App hat keine);
   das wird hier transparent gesagt statt verschwiegen. */
function DeleteAccountModal({ ctx }) {
  const { session } = ctx;
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const myId = session && session.user && session.user.id;
  const wipe = async () => {
    if (confirmText.trim().toUpperCase() !== 'LÖSCHEN') { setErr('Bitte LÖSCHEN eintippen, um zu bestätigen.'); return; }
    setBusy(true); setErr('');
    try {
      const del = (table, col) => window.sb.from(table).delete().eq(col, myId).then(() => {}, () => {});
      await Promise.all([
        del('srs_progress', 'user_id'), del('xp_daily', 'user_id'), del('xp_topic', 'user_id'),
        del('custom_topics', 'user_id'), del('ai_history', 'user_id'),
        del('follows', 'follower_id'), del('follows', 'followee_id'),
        del('feed_reactions', 'user_id'), del('notifications', 'user_id'),
        del('test_results', 'user_id'), del('study_group_members', 'user_id'),
        del('study_group_answers', 'user_id'), del('league_memberships', 'user_id'),
        del('user_monsters', 'user_id'), del('shared_stack_members', 'user_id'),
        del('quiz_room_players', 'user_id'), del('quiz_room_answers', 'user_id'),
        // (Review 21.07.2026) fehlten: veröffentlichte Stapel wären sonst dauerhaft
        // in der öffentlichen Bibliothek geblieben; referrals analog.
        del('public_decks', 'author_id'),
        del('referrals', 'new_user_id'), del('referrals', 'referrer_id'),
        del('follows', 'followee_id'),
      ]);
      await window.sb.from('friendships').delete().or(`user_a.eq.${myId},user_b.eq.${myId}`).then(() => {}, () => {});
      await window.sb.from('profiles').delete().eq('id', myId).then(() => {}, () => {});
      try { localStorage.clear(); } catch (e) {}
      await window.Auth.signOut();
      ctx.closeModal();
      ctx.go('home');
    } catch (e) { setErr((e && e.message) || 'Löschen fehlgeschlagen.'); }
    setBusy(false);
  };
  return (
    <>
      <ModalHead title="Konto löschen" onClose={ctx.closeModal}/>
      <div className="modal-body">
        {!session ? (
          <div className="muted center" style={{padding:'20px 0'}}>Nicht angemeldet.</div>
        ) : (
          <div className="col">
            <div className="card flat" style={{padding:14, borderLeft:'4px solid var(--rose)'}}>
              <div style={{fontWeight:800, marginBottom:6}}>Das kann nicht rückgängig gemacht werden</div>
              <div className="muted" style={{fontSize:13.5}}>
                Löscht dauerhaft: Profil, Lernfortschritt, XP/Serie, eigene Stapel (Cloud),
                Freundschaften, Follower, Feed-Reaktionen, Benachrichtigungen, Testergebnisse,
                Gruppen-/Liga-Mitgliedschaften und Monster — und meldet dich ab. Auch die lokalen
                Daten auf diesem Gerät werden geleert.
              </div>
              <div className="muted" style={{fontSize:12.5, marginTop:8}}>
                Hinweis: Der reine Login-Eintrag (E-Mail) kann aus technischen Gründen nur vom
                Betreiber im Supabase-Dashboard entfernt werden — diese App hat bewusst keinen
                eigenen Server, der das dürfte.
              </div>
            </div>
            <div style={{fontWeight:800}}>Zur Bestätigung LÖSCHEN eintippen</div>
            <input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="LÖSCHEN"
                   style={{width:'100%', padding:14, borderRadius:14, border:'1px solid var(--line)', background:'var(--surface)'}}/>
            {err && <div style={{color:'var(--rose)', fontWeight:600}}>{err}</div>}
            <button className="btn btn-full" style={{background:'var(--rose)', color:'#fff', fontWeight:800}} disabled={busy} onClick={wipe}>
              {busy ? 'Wird gelöscht…' : 'Konto endgültig löschen'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

/* Profil-Tab "Schule" (Phase 16) — zeigt die eigene Schule + eine Mini-Rangliste
   aller Nutzer:innen mit derselben Schule (profiles.school, Feld jetzt echt in
   "Profil bearbeiten" pflegbar). */
function SchoolTab({ ctx, myId }) {
  const { profile, session } = ctx;
  const school = profile && profile.school;
  const [mates, setMates] = useState(null);
  useEffect(() => {
    let cancelled = false;
    if (!school || !window.sb) { setMates(null); return; }
    window.sb.from('profiles').select('id, username, avatar, total_xp')
      .eq('school', school).order('total_xp', { ascending: false }).limit(20)
      .then(({ data }) => { if (!cancelled) setMates(data || []); });
    return () => { cancelled = true; };
  }, [school]);
  if (!session) {
    return (
      <div className="card flat" style={{display:'grid', placeItems:'center', padding:'60px 20px', textAlign:'center', gap:14}}>
        <div style={{fontSize:48}}>🌀</div>
        <div style={{fontWeight:800, fontSize:18}}>Erst anmelden</div>
        <div className="muted">Melde dich an, um deine Schule zu verbinden.</div>
        <button className="btn btn-primary" onClick={() => ctx.openModal('auth')}>Anmelden</button>
      </div>
    );
  }
  if (!school) {
    return (
      <div className="card flat" style={{display:'grid', placeItems:'center', padding:'60px 20px', textAlign:'center', gap:14}}>
        <div style={{fontSize:48}}>🌀</div>
        <div style={{fontWeight:800, fontSize:18}}>Noch keine Schule</div>
        <div className="muted">Trag deine Schule im Profil ein, um mit Mitschüler:innen zu lernen.</div>
        <button className="btn btn-primary" onClick={() => ctx.openModal('editProfile')}>Schule eintragen</button>
      </div>
    );
  }
  return (
    <div className="col">
      <div className="card" style={{display:'flex', gap:14, alignItems:'center', padding:16}}>
        <div style={{fontSize:32}}>🏫</div>
        <div style={{flex:1}}>
          <div style={{fontWeight:800, fontSize:17}}>{school}</div>
          <div className="muted" style={{fontSize:12.5}}>{mates === null ? '…' : `${mates.length} ${mates.length === 1 ? 'Person' : 'Personen'} mit dieser Schule`}</div>
        </div>
        <button className="btn btn-ghost" onClick={() => ctx.openModal('editProfile')}>Ändern</button>
      </div>
      {mates && mates.length > 1 && (
        <div className="card">
          <div style={{fontWeight:800, marginBottom:10}}>Schul-Rangliste</div>
          {mates.map((p, i) => (
            <div key={p.id} className="row" style={{justifyContent:'space-between', padding:'8px 4px', background: p.id === myId ? 'var(--accent-soft)' : 'transparent', borderRadius: p.id === myId ? 10 : 0}}>
              <span style={{display:'flex', gap:10, alignItems:'center'}}>
                <b style={{width:22, textAlign:'center'}}>{i + 1}</b>
                <AnimalAvatar kind={p.avatar || '🦔'} size={30}/>
                <span style={{fontWeight:700}}>{p.username}{p.id === myId ? ' (du)' : ''}</span>
              </span>
              <span className="pill" style={{fontWeight:800}}>{window.XP ? window.XP.fmt(p.total_xp || 0) : (p.total_xp || 0)} XP</span>
            </div>
          ))}
        </div>
      )}
      {mates && mates.length === 1 && (
        <div className="muted" style={{fontSize:13}}>Noch niemand sonst mit dieser Schule — lade Mitschüler:innen über "Freunde einladen" ein.</div>
      )}
    </div>
  );
}

function NotFound({ ctx }) {
  return (
    <div className="page" style={{maxWidth:520, textAlign:'center'}}>
      <h1 style={{fontSize:56, fontFamily:'Fraunces, serif'}}>Ups!</h1>
      <div className="muted">Dieser Bildschirm existiert nicht.</div>
      <div className="card flat" style={{fontFamily:'monospace'}}>gizmo.ai/404</div>
      <button className="btn btn-primary" onClick={() => ctx.go('home')}>Geh zurück</button>
    </div>
  );
}

/* ============== KLASSENZIMMER (Lehrkraft) ============== */
// Eigene PIN (beim ersten Öffnen selbst festlegen, localStorage), dann:
// Klassenliste aus eingesammelten Fortschritts-Codes der Kinder. Komplett
// offline — kein Konto, kein Server. Codes kommen per WhatsApp/AirDrop/…
/* ============== 🎙️ AUSSPRACHE-STUDIO (07.08.2026) ==============
   Die Lehrkraft nimmt hier jede Silbe / jedes Wort des Kurses einmal
   selbst auf (MediaRecorder). Upload → Netlify Blobs; ab dann hören
   ALLE Kinder auf allen Geräten genau diese Aussprache (app/quranvoice.js
   spielt Lehrer-Aufnahmen mit höchster Priorität, offline-gecacht). */
function AudioStudio() {
  const [, force] = useState(0);
  const [open, setOpen] = useState(false);
  const [recAr, setRecAr] = useState(null);    // gerade laufende Aufnahme
  const [busyAr, setBusyAr] = useState(null);  // Upload läuft
  const [micErr, setMicErr] = useState('');
  const [showAll, setShowAll] = useState(false);
  const recRef = useRef(null);
  useEffect(() => (window.QuranVoice ? window.QuranVoice.onChange(() => force(x => x + 1)) : undefined), []);
  useEffect(() => { if (open && window.QuranVoice) window.QuranVoice.refresh(true); }, [open]);
  useEffect(() => () => { try { recRef.current && recRef.current.stream.getTracks().forEach(t => t.stop()); } catch (e) {} }, []);

  const items = useMemo(() => {
    const seen = new Set(); const out = [];
    const topics = ((window.QuranCourse && window.QuranCourse.ordered()) || []).concat(window.QURAN_EXTRA_TOPICS || []);
    topics.forEach(t => (t.blocks || []).forEach(b => (b.quiz || []).forEach(c => {
      const ar = String(c.q || '').replace(/[^\u0600-\u06FF\s]/g, ' ').trim().replace(/\s+/g, ' ');
      if (!ar || seen.has(ar)) return;
      seen.add(ar);
      out.push({ ar, label: String(c.a || '').slice(0, 60), lesson: String(t.name || '').replace(/^\d+\.\s*/, '') });
    })));
    /* (11.08.2026) Auch die Suren und Gebete zum Auswendiglernen stehen hier —
       damit die Aussprache NICHT vom Internet abhängt. Sprichst du sie einmal
       selbst ein, hören die Kinder ab sofort DICH, auf jedem Gerät und offline. */
    (window.HIFZ_ITEMS || []).forEach(it => (it.parts || []).forEach((prt, i) => {
      const ar = String(prt.ar || '').replace(/[^\u0600-\u06FF\s]/g, ' ').trim().replace(/\s+/g, ' ');
      if (!ar || seen.has(ar)) return;
      seen.add(ar);
      out.push({ ar, label: (it.kind === 'sure' ? 'Vers ' : 'Teil ') + (i + 1) + ' · ' + (prt.tr || '').slice(0, 40),
                 lesson: '🕌 ' + it.name });
    }));
    return out;
  }, []);
  const QV = window.QuranVoice;
  const doneCount = QV ? items.filter(it => QV.has(it.ar)).length : 0;
  const shown = (showAll ? items : items.filter(it => !QV || !QV.has(it.ar))).slice(0, 400);

  const startRec = async (it) => {
    setMicErr('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', ''].find(m => !m || (window.MediaRecorder && MediaRecorder.isTypeSupported(m)));
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 64000 } : undefined);
      const chunks = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
        setRecAr(null);
        if (blob.size < 1200) { setMicErr('Aufnahme war zu kurz — nochmal versuchen.'); return; }
        setBusyAr(it.ar);
        const r = await QV.put(it.ar, blob);
        setBusyAr(null);
        if (!r.ok) setMicErr(r.error || 'Hochladen fehlgeschlagen — läuft die App über die Netlify-Adresse?');
        force(x => x + 1);
      };
      recRef.current = { mr, stream };
      mr.start();
      setRecAr(it.ar);
      // Sicherheits-Stopp nach 6 s
      setTimeout(() => { try { if (recRef.current && recRef.current.mr === mr && mr.state === 'recording') mr.stop(); } catch (e) {} }, 6000);
    } catch (e) {
      setMicErr('Mikrofon nicht verfügbar — bitte Zugriff erlauben (Browser-Nachfrage) und nochmal versuchen.');
    }
  };
  const stopRec = () => { try { recRef.current && recRef.current.mr.state === 'recording' && recRef.current.mr.stop(); } catch (e) {} };

  return (
    <div className="card" style={{padding: 16, marginTop: 12}}>
      <div className="row" style={{justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap'}}>
        <div>
          <div style={{fontWeight: 800}}>🎙️ Aussprache-Studio</div>
          <div className="muted" style={{fontSize: 13, marginTop: 2}}>
            Sprich jede Silbe einmal selbst ein — alle Kinder hören dann überall DEINE Aussprache
            statt der Computerstimme. Einmal gehört, funktioniert sie sogar offline.
          </div>
        </div>
        <div className="row" style={{gap: 8, alignItems: 'center'}}>
          <span className="pill" style={doneCount >= items.length && items.length ? {background:'var(--success-soft, #E7F7EE)', color:'var(--success, #1B8A5A)', fontWeight:800} : {fontWeight:700}}>
            {doneCount} / {items.length} aufgenommen
          </span>
          <button className="btn btn-primary" onClick={() => setOpen(o => !o)}>{open ? 'Schließen' : 'Öffnen'}</button>
        </div>
      </div>
      {open && (
        <div style={{marginTop: 12}}>
          <div className="row" style={{gap: 8, flexWrap: 'wrap', alignItems: 'center'}}>
            <button className={'btn ' + (!showAll ? 'btn-primary' : 'btn-ghost')} style={{padding: '7px 14px', fontSize: 13}} onClick={() => setShowAll(false)}>Noch offen ({items.length - doneCount})</button>
            <button className={'btn ' + (showAll ? 'btn-primary' : 'btn-ghost')} style={{padding: '7px 14px', fontSize: 13}} onClick={() => setShowAll(true)}>Alle anzeigen</button>
            <span className="muted" style={{fontSize: 12.5}}>Tipp: 🎙️ drücken → deutlich sprechen → ⏹ — fertig ist die Aufnahme.</span>
          </div>
          {!!micErr && <div style={{color: 'var(--rose, #D64545)', fontWeight: 700, fontSize: 13, marginTop: 8}}>{micErr}</div>}
          <div className="col" style={{gap: 6, marginTop: 10, maxHeight: 420, overflowY: 'auto'}}>
            {shown.map(it => {
              const hasRec = QV && QV.has(it.ar);
              const isRec = recAr === it.ar;
              const isBusy = busyAr === it.ar;
              return (
                <div key={it.ar} className="studio-row">
                  <span className="studio-ar">{it.ar}</span>
                  <span className="studio-info">
                    <b>{it.label}</b>
                    <small>{it.lesson}</small>
                  </span>
                  <span className="row" style={{gap: 6, flexShrink: 0}}>
                    {hasRec && !isRec && (
                      <button className="studio-btn" title="Probehören" onClick={() => QV.play(it.ar, {})}>▶️</button>
                    )}
                    {isBusy ? (
                      <span className="muted" style={{fontSize: 12, fontWeight: 700}}>lädt hoch…</span>
                    ) : isRec ? (
                      <button className="studio-btn is-rec" title="Aufnahme beenden" onClick={stopRec}>⏹ Stopp</button>
                    ) : (
                      <button className="studio-btn" title={hasRec ? 'Neu aufnehmen' : 'Aufnehmen'} onClick={() => startRec(it)}>🎙️{hasRec ? '' : ' Aufnehmen'}</button>
                    )}
                    <span title={hasRec ? 'Aufnahme vorhanden' : 'noch keine Aufnahme'}>{hasRec ? '✅' : '⚪'}</span>
                  </span>
                </div>
              );
            })}
            {!shown.length && <div className="muted" style={{textAlign: 'center', padding: 14}}>🎉 Alles aufgenommen — deine Klasse hört überall deine Stimme!</div>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ==============================================================
   ✏️ BUCHSTABEN & SILBEN BEARBEITEN (Lehrkraft, 09.08.2026)
   Suchen, einzeln antippen, Umschrift ändern, Aussprache neu
   aufnehmen. Eine Änderung gilt SOFORT überall, wo der Buchstabe
   vorkommt — der Lernfortschritt der Kinder bleibt erhalten.
   ============================================================== */
/* ==============================================================
   🔊 TON PRÜFEN & BUCHSTABEN-TÖNE IN DIE APP HOLEN (09.08.2026)

   Bisher kamen die Buchstaben-Aufnahmen bei JEDEM Abspielen von einem
   fremden Server (jsDelivr). Ist der gesperrt — Schul-WLAN, Werbefilter,
   kein Netz — bleibt die App still, ohne es zu sagen. Mit einem Klick
   holt die Lehrkraft alle Tondateien EINMAL herüber und legt sie auf dem
   eigenen Server ab. Danach spielt die App sie von dort: unabhängig,
   offline-fähig und für jedes Kind gleich. Eigene Aufnahmen aus dem
   Studio werden dabei NIE überschrieben.
   ============================================================== */
function SoundCheck({ ctx }) {
  const QA = window.QuranAudio, QV = window.QuranVoice;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState(null);   // {done, total, fail}
  const [msg, setMsg] = useState('');
  const [, force] = useState(0);
  useEffect(() => QV && QV.onChange && QV.onChange(() => force(x => x + 1)), []);

  const letters = useMemo(() => {
    const t = (window.QURAN_TOPICS || [])[0];
    const out = [];
    ((t && t.blocks) || []).forEach(b => (b.cards || []).forEach(c => {
      if (c && c.q) out.push({ ch: c.q, name: c.a });
    }));
    return out;
  }, []);
  if (!QA || !QV || !letters.length) return null;

  const info = letters.map(l => Object.assign({}, l, QA.sourceFor(l.ch)));
  const own = info.filter(x => x.src === 'eigen').length;
  const ready = info.filter(x => x.src === 'eigen' || x.src === 'app').length;

  const grab = async () => {
    setBusy(true); setMsg(''); setProg({ done: 0, total: letters.length, fail: 0 });
    let done = 0, fail = 0, skipped = 0;
    const files = QA.letterFiles();
    for (const l of letters) {
      const bare = String(l.ch).replace(/[ً-ْٰـ]/g, '');
      const name = files[bare];
      if (QV.has(l.ch)) { skipped++; done++; setProg({ done, total: letters.length, fail }); continue; }
      if (!name) { fail++; done++; setProg({ done, total: letters.length, fail }); continue; }
      try {
        const res = await fetch(QA.cdnUrl(name), { mode: 'cors' });
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        if (blob.size < 800) throw new Error('leer');
        const r = await QV.put(l.ch, blob);
        if (!r.ok) throw new Error(r.error || 'Upload');
      } catch (e) { fail++; }
      done++;
      setProg({ done, total: letters.length, fail });
    }
    setBusy(false);
    setMsg(fail
      ? (letters.length - fail) + ' von ' + letters.length + ' Buchstaben geholt · ' + fail + ' nicht erreichbar (Netz oder Filter). Die fehlenden kannst du im Studio selbst einsprechen.'
      : 'Fertig ✅ — alle ' + letters.length + ' Buchstaben liegen jetzt auf deinem eigenen Server' + (skipped ? ' (' + skipped + ' eigene Aufnahmen blieben unangetastet)' : '') + '.');
    force(x => x + 1);
  };

  const badge = (x) => {
    const m = {
      eigen:    ['eigene Aufnahme', 'var(--success-soft, #E7F7EE)'],
      app:      ['in der App', 'var(--success-soft, #E7F7EE)'],
      internet: ['aus dem Internet', undefined],
      fehler:   ['nicht ladbar', 'var(--rose-soft, #FDECEC)'],
      stimme:   ['Systemstimme', 'var(--rose-soft, #FDECEC)'],
      keine:    ['—', undefined],
    }[x.src] || ['—', undefined];
    return <span className="pill" style={{ background: m[1], fontSize: 11.5 }}>{m[0]}</span>;
  };

  return (
    <div className="card" style={{padding: 16, marginTop: 12}}>
      <div className="row" style={{justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap'}}>
        <div style={{flex: '1 1 220px'}}>
          <div style={{fontWeight: 800}}>🔊 Ton prüfen</div>
          <div className="muted" style={{fontSize: 13, marginTop: 2}}>
            Alle Buchstaben-Aufnahmen sind fest in der App enthalten — sie laufen offline
            und ohne fremden Server. Hier siehst du für jeden Buchstaben, woher der Ton
            gerade kommt, und kannst ihn anhören.
          </div>
        </div>
        <div className="row" style={{gap: 8, alignItems: 'center'}}>
          <span className="pill" style={ready >= letters.length ? {background:'var(--success-soft, #E7F7EE)', fontWeight:800} : {fontWeight:700}}>
            {ready} / {letters.length} mit Ton{own ? ' · ' + own + '× deine Stimme' : ''}
          </span>
          <button className="btn btn-primary" onClick={() => setOpen(o => !o)}>{open ? 'Schließen' : 'Prüfen'}</button>
        </div>
      </div>

      {open && (
        <div style={{marginTop: 12}}>
          <div className="card flat tinted" style={{padding: 12}}>
            <div className="muted" style={{fontSize: 12.5, lineHeight: 1.55}}>
              Die 30 Buchstaben-Aufnahmen liegen als eine Datei in der App
              (<b>assets/letters.mp3</b>), auf gleiche Lautstärke gebracht. Du musst dafür
              nichts einrichten. Gefällt dir eine Aussprache nicht, sprich sie im
              <b> 🎙️ Aussprache-Studio</b> selbst ein — deine Aufnahme hat immer Vorrang.
            </div>
            <button className="btn btn-ghost btn-full" style={{marginTop: 8}} disabled={busy} onClick={grab}>
              {busy ? '⏳ Hole Töne … ' + (prog ? prog.done + '/' + prog.total : '')
                    : '⬇️ Zusätzlich auf den eigenen Server legen (optional)'}
            </button>
          </div>
          {!!msg && <div style={{fontWeight: 800, marginTop: 10, fontSize: 13.5}}>{msg}</div>}

          <div className="col" style={{gap: 4, marginTop: 12, maxHeight: 420, overflowY: 'auto'}}>
            {info.map(x => (
              <div key={x.ch} className="row" style={{alignItems: 'center', gap: 10, padding: '6px 4px', borderBottom: '1px solid var(--line)'}}>
                <span dir="rtl" style={{fontSize: 24, minWidth: 40, textAlign: 'center', fontFamily: '"Amiri Quran", "Scheherazade New", serif'}}>{x.ch}</span>
                <span style={{flex: 1, fontWeight: 700, fontSize: 13.5}}>{x.name}</span>
                {badge(x)}
                <button className="btn btn-ghost" style={{padding: '5px 10px', fontSize: 13}}
                        onClick={() => QA.speakText(x.ch, true)}>▶️</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ==============================================================
   ✏️ BUCHSTABEN-WERKSTATT (Neufassung 12.08.2026)

   Nutzerwunsch wörtlich: „Ich brauch da viel mehr Optionen, viel mehr
   Freiraum — ändern, umändern, sprechen, rauslöschen, die Standard-
   stimme wieder einfügen. Auch die Schreibart von dem Buchstaben."

   Pro Karte gibt es jetzt drei klar getrennte Bereiche:
     1. SCHREIBWEISE (arabisch) — überschreibbar, Original jederzeit zurück.
        Der Fortschritt der Kinder bleibt erhalten (srs.js schlüsselt auf
        die Original-Schreibweise).
     2. UMSCHRIFT / NAME — wie bisher.
     3. TON — mit voller Kontrolle:
        · zeigt, WAS gerade gilt (eigene Aufnahme / App-Aufnahme / Stimme)
        · „So klingt es jetzt" und „Standardstimme anhören" zum Vergleich
        · Aufnehmen MIT PROBEHÖREN: erst anhören, dann übernehmen
          oder verwerfen — nichts geht ungehört online
        · eigene Aufnahme löschen -> die Standardstimme gilt sofort wieder
   ============================================================== */
function CardEditor({ ctx }) {
  const CE = window.CardEdits;
  const QV = window.QuranVoice;
  const QA = window.QuranAudio;
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('alle');   // alle | geaendert | eigene
  const [sel, setSel] = useState(null);           // key = Original-Schreibweise
  const [draftQ, setDraftQ] = useState('');
  const [draftA, setDraftA] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [rec, setRec] = useState(false);          // Aufnahme läuft
  const [recSecs, setRecSecs] = useState(0);
  const [take, setTake] = useState(null);         // {blob, url} — Probeaufnahme
  const [busy, setBusy] = useState(false);
  const [, force] = useState(0);
  const recRef = useRef(null);
  const takeRef = useRef(null);
  const tickRef = useRef(null);

  useEffect(() => CE && CE.onChange(() => force(x => x + 1)), []);
  useEffect(() => { CE && CE.refresh(true); if (QV) QV.refresh(true); }, []);
  useEffect(() => () => {
    try { recRef.current && recRef.current.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
    if (tickRef.current) clearInterval(tickRef.current);
    if (take && take.url) URL.revokeObjectURL(take.url);
  }, []);

  if (!CE) return null;
  const all = CE.catalog();
  const needle = q.trim().toLowerCase();
  const list = all.filter(c => {
    if (filter === 'geaendert' && !c.changed) return false;
    if (filter === 'eigene' && !(QV && QV.has(c.q))) return false;
    if (!needle) return true;
    return c.q.indexOf(q.trim()) >= 0 || c.origQ.indexOf(q.trim()) >= 0
      || String(c.a).toLowerCase().indexOf(needle) >= 0
      || String(c.origA).toLowerCase().indexOf(needle) >= 0
      || String(c.topic).toLowerCase().indexOf(needle) >= 0;
  });
  const changedCount = all.filter(c => c.changed).length;
  const recCount = QV ? all.filter(c => QV.has(c.q)).length : 0;

  const discardTake = () => {
    if (take && take.url) URL.revokeObjectURL(take.url);
    setTake(null);
  };
  const open = (c) => {
    if (sel === c.key) { setSel(null); discardTake(); return; }
    setSel(c.key); setDraftQ(c.q); setDraftA(c.a); setMsg(''); setErr(''); discardTake();
  };
  const flash = (t) => { setMsg(t); setErr(''); setTimeout(() => setMsg(m => (m === t ? '' : m)), 3200); };

  /* ---- Texte speichern / zurücksetzen ---- */
  const save = async (c) => {
    const vQ = draftQ.trim(), vA = draftA.trim();
    if (!vQ || !vA) { setErr('Schreibweise und Umschrift dürfen nicht leer sein.'); return; }
    setErr(''); setMsg('Speichere …');
    const r = await CE.set(c.key, {
      ar: vQ !== c.origQ ? vQ : '',
      a: vA !== c.origA ? vA : '',
    });
    if (r.ok) flash('Gespeichert ✅ — gilt ab sofort überall.');
    else { setMsg(''); setErr(r.error || 'Das hat nicht geklappt.'); }
    force(x => x + 1);
  };
  const undo = async (c) => {
    setMsg('Setze zurück …');
    const r = await CE.reset(c.key);
    if (r.ok) { setDraftQ(c.origQ); setDraftA(c.origA); flash('Original wiederhergestellt ✅'); }
    else { setMsg(''); setErr(r.error || 'Das hat nicht geklappt.'); }
    force(x => x + 1);
  };

  /* ---- Aufnahme mit Probehören ---- */
  const startRec = async () => {
    setErr(''); discardTake();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', ''].find(m => !m || (window.MediaRecorder && MediaRecorder.isTypeSupported(m)));
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 64000 } : undefined);
      const chunks = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        if (tickRef.current) clearInterval(tickRef.current);
        setRec(false);
        const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
        if (blob.size < 1200) { setErr('Die Aufnahme war zu kurz — bitte nochmal.'); return; }
        setTake({ blob, url: URL.createObjectURL(blob) });
      };
      recRef.current = { mr, stream };
      mr.start();
      setRec(true); setRecSecs(0);
      tickRef.current = setInterval(() => setRecSecs(x => x + 1), 1000);
      setTimeout(() => { try { if (recRef.current && recRef.current.mr === mr && mr.state === 'recording') mr.stop(); } catch (e) {} }, 10000);
    } catch (e) { setErr('Mikrofon nicht verfügbar — bitte den Zugriff erlauben.'); }
  };
  const stopRec = () => { try { recRef.current && recRef.current.mr.state === 'recording' && recRef.current.mr.stop(); } catch (e) {} };
  const playTake = () => {
    if (!take) return;
    if (takeRef.current) { try { takeRef.current.pause(); } catch (e) {} }
    takeRef.current = new Audio(take.url);
    takeRef.current.play().catch(() => {});
  };
  const keepTake = async (c) => {
    if (!take) return;
    setBusy(true); setMsg('Lade hoch …');
    const r = await QV.put(c.q, take.blob);
    setBusy(false);
    if (r.ok) { discardTake(); flash('Deine Aufnahme gilt jetzt überall ✅'); }
    else { setMsg(''); setErr(r.error || 'Hochladen fehlgeschlagen — läuft die App über die Netlify-Adresse?'); }
    force(x => x + 1);
  };
  const delOwn = async (c) => {
    setBusy(true); setMsg('Lösche …');
    const r = await QV.del(c.q);
    setBusy(false);
    if (r.ok) flash('Aufnahme gelöscht — es gilt wieder die Standardstimme ✅');
    else { setMsg(''); setErr(r.error || 'Löschen fehlgeschlagen.'); }
    force(x => x + 1);
  };

  const srcChip = (c) => {
    if (!QA || !QA.sourceFor) return null;
    const src = QA.sourceFor(c.q);
    const style = src.src === 'eigen' ? { background: 'var(--success-soft, #E7F7EE)', color: 'var(--success, #1B8A5A)' }
      : src.src === 'app' ? { background: '#E3EFFA', color: '#2364A5' }
      : src.src === 'fehler' ? { background: '#FDE3E8', color: '#B3123A' }
      : { background: '#F2F2F5', color: '#66717b' };
    const label = src.src === 'eigen' ? '🎙️ deine Aufnahme'
      : src.src === 'app' ? '🔊 App-Aufnahme' : src.src === 'internet' ? '🌐 Internet-Aufnahme'
      : src.src === 'fehler' ? '⚠️ Ton nicht ladbar' : '🗣 Systemstimme';
    return <span className="pill" style={{ fontWeight: 800, ...style }}>{label}</span>;
  };

  return (
    <div className="page" style={{maxWidth: 780}}>
      <div className="row" style={{justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10}}>
        <h1 style={{margin: 0}}>✏️ Buchstaben-Werkstatt</h1>
        <button className="btn btn-ghost" onClick={() => ctx.go('teacher')}>← Klassenzimmer</button>
      </div>
      <div className="muted" style={{fontSize: 13.5, marginTop: 6, lineHeight: 1.55}}>
        Jede Karte gehört dir: <b>Schreibweise</b> und <b>Umschrift</b> ändern, die Aussprache <b>einsprechen,
        probehören, übernehmen oder löschen</b> — und jederzeit zurück zum Original. Alles gilt sofort überall;
        der Fortschritt der Kinder bleibt erhalten.
      </div>

      <div className="row" style={{gap: 8, marginTop: 14, flexWrap: 'wrap'}}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Suchen: Buchstabe, Umschrift oder Lektion…"
               style={{flex: '1 1 220px', minWidth: 0, padding: '11px 14px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)', font: 'inherit'}}/>
        <button className={'btn ' + (filter === 'geaendert' ? 'btn-primary' : 'btn-ghost')}
                onClick={() => setFilter(f => f === 'geaendert' ? 'alle' : 'geaendert')}>✏️ Geändert ({changedCount})</button>
        <button className={'btn ' + (filter === 'eigene' ? 'btn-primary' : 'btn-ghost')}
                onClick={() => setFilter(f => f === 'eigene' ? 'alle' : 'eigene')}>🎙️ Eigene ({recCount})</button>
      </div>
      {!!msg && <div style={{color: 'var(--success, #1B8A5A)', fontWeight: 800, marginTop: 10}}>{msg}</div>}
      {!!err && <div style={{color: 'var(--rose, #D64545)', fontWeight: 800, marginTop: 10}}>{err}</div>}
      <div className="muted" style={{fontSize: 12.5, marginTop: 8}}>{list.length} von {all.length} Karten</div>

      <div className="col" style={{gap: 8, marginTop: 10}}>
        {list.slice(0, 300).map(c => {
          const isOpen = sel === c.key;
          const hasRec = QV && QV.has(c.q);
          return (
            <div key={c.key} className="card" style={{padding: 12, cursor: 'pointer'}} onClick={() => open(c)}>
              <div className="row" style={{alignItems: 'center', gap: 12}}>
                <span dir="rtl" style={{fontSize: 30, fontWeight: 700, minWidth: 52, textAlign: 'center', fontFamily: '"Amiri Quran", "Scheherazade New", serif'}}>{c.q}</span>
                <span style={{flex: 1, minWidth: 0}}>
                  <div style={{fontWeight: 800, fontSize: 15}}>{c.a}</div>
                  <div className="muted" style={{fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{c.topic}</div>
                </span>
                <button className="icon-btn" title="Anhören" style={{width: 34, height: 34}}
                        onClick={e => { e.stopPropagation(); QA && QA.speakText(c.q, true); }}>🔊</button>
                {c.changedQ && <span className="pill" style={{background: '#FCF3D7', fontWeight: 800}} title="Schreibweise geändert">ابج</span>}
                {c.changedA && <span className="pill" style={{background: 'var(--success-soft, #E7F7EE)', fontWeight: 800}}>Text</span>}
                {hasRec && <span className="pill" title="eigene Aufnahme aktiv">🎙️</span>}
              </div>
              {isOpen && (
                <div style={{marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 12}} onClick={e => e.stopPropagation()}>
                  <div className="muted" style={{fontSize: 12.5, marginBottom: 10}}>
                    Kommt vor in: <b>{CE.places(c.key).join(' · ')}</b>
                  </div>

                  {/* ---- 1. Schreibweise & Umschrift ---- */}
                  <div className="row" style={{gap: 10, flexWrap: 'wrap'}}>
                    <div style={{flex: '1 1 180px'}}>
                      <label className="muted" style={{fontSize: 12.5, fontWeight: 700}}>Schreibweise (arabisch)</label>
                      <input value={draftQ} dir="rtl" onChange={e => setDraftQ(e.target.value)}
                             style={{width: '100%', marginTop: 4, padding: '10px 14px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)', fontFamily: '"Amiri Quran", "Scheherazade New", serif', fontSize: 26, boxSizing: 'border-box'}}/>
                      {c.origQ !== draftQ.trim() && <div className="muted" style={{fontSize: 12, marginTop: 4}}>Original: <b dir="rtl">{c.origQ}</b></div>}
                    </div>
                    <div style={{flex: '1 1 180px'}}>
                      <label className="muted" style={{fontSize: 12.5, fontWeight: 700}}>Umschrift / Name</label>
                      <input value={draftA} onChange={e => setDraftA(e.target.value)}
                             onKeyDown={e => e.key === 'Enter' && save(c)}
                             style={{width: '100%', marginTop: 4, padding: '13px 14px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)', font: 'inherit', fontSize: 16, fontWeight: 700, boxSizing: 'border-box'}}/>
                      {c.origA !== draftA.trim() && <div className="muted" style={{fontSize: 12, marginTop: 4}}>Original: <b>{c.origA}</b></div>}
                    </div>
                  </div>
                  <div className="row" style={{gap: 8, marginTop: 10, flexWrap: 'wrap'}}>
                    <button className="btn btn-primary" onClick={() => save(c)}>💾 Speichern</button>
                    {c.changed && <button className="btn btn-ghost" onClick={() => undo(c)}>↩︎ Original wiederherstellen</button>}
                  </div>

                  {/* ---- 2. Ton ---- */}
                  <div style={{marginTop: 14, background: 'var(--surface-2, #F7F7F9)', borderRadius: 12, padding: '12px 14px'}}>
                    <div className="row" style={{alignItems: 'center', gap: 8, flexWrap: 'wrap'}}>
                      <b style={{fontSize: 14}}>🔉 Aussprache</b>
                      {srcChip(c)}
                    </div>
                    <div className="row" style={{gap: 8, marginTop: 10, flexWrap: 'wrap'}}>
                      <button className="btn btn-ghost" onClick={() => QA && QA.speakText(c.q, true)}>▶️ So klingt es jetzt</button>
                      {hasRec && (
                        <button className="btn btn-ghost" title="Ohne deine Aufnahme — so klänge es nach dem Löschen"
                                onClick={() => QA && QA.speakText(c.q, true, { skipOwn: true })}>🔊 Standardstimme anhören</button>
                      )}
                    </div>

                    {/* Aufnahme mit Probehören */}
                    {!rec && !take && (
                      <div className="row" style={{gap: 8, marginTop: 10, flexWrap: 'wrap'}}>
                        <button className="btn btn-primary" disabled={busy} onClick={startRec}>
                          🎙️ {hasRec ? 'Neu einsprechen' : 'Selbst einsprechen'}
                        </button>
                        {hasRec && (
                          <button className="btn btn-ghost" disabled={busy} style={{color: 'var(--rose, #D64545)'}} onClick={() => delOwn(c)}>
                            🗑️ Aufnahme löschen → Standardstimme
                          </button>
                        )}
                      </div>
                    )}
                    {rec && (
                      <div className="row" style={{gap: 10, marginTop: 10, alignItems: 'center', flexWrap: 'wrap'}}>
                        <button className="btn" style={{background: '#F02048', color: '#fff', fontWeight: 800}} onClick={stopRec}>⏹ Fertig</button>
                        <span style={{fontWeight: 800, color: '#B3123A'}}>● Aufnahme läuft … {recSecs}s</span>
                        <span className="muted" style={{fontSize: 12}}>(stoppt von selbst nach 10 s)</span>
                      </div>
                    )}
                    {take && (
                      <div style={{marginTop: 10, background: '#fff', border: '1px dashed var(--line)', borderRadius: 10, padding: '10px 12px'}}>
                        <div style={{fontWeight: 800, fontSize: 13.5, marginBottom: 8}}>Probeaufnahme — erst anhören, dann entscheiden:</div>
                        <div className="row" style={{gap: 8, flexWrap: 'wrap'}}>
                          <button className="btn btn-ghost" onClick={playTake}>▶️ Probehören</button>
                          <button className="btn btn-primary" disabled={busy} onClick={() => keepTake(c)}>
                            {busy ? '⏳ Lädt hoch…' : '✅ Übernehmen'}
                          </button>
                          <button className="btn btn-ghost" onClick={startRec}>🔁 Nochmal aufnehmen</button>
                          <button className="btn btn-ghost" style={{color: 'var(--rose, #D64545)'}} onClick={discardTake}>🗑️ Verwerfen</button>
                        </div>
                      </div>
                    )}
                    <div className="muted" style={{fontSize: 12, marginTop: 10, lineHeight: 1.5}}>
                      Ohne eigene Aufnahme gilt automatisch die Standardstimme (App-Aufnahme bzw. Gerätestimme).
                      Löschen bringt sie jederzeit zurück — nichts ist endgültig.
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {list.length > 300 && (
        <div className="muted" style={{fontSize: 12.5, marginTop: 10}}>
          Es werden 300 Karten angezeigt — nutze die Suche, um gezielt eine zu finden.
        </div>
      )}
    </div>
  );
}

/* 🎤 Mikrofon-Schalter fürs Auswendiglernen (11.08.2026).
   Manche Schulen wollen kein Mikrofon im Unterricht, und in Firefox gibt es
   die Spracherkennung ohnehin nicht. Ist der Schalter aus, benutzt die App
   überall das Wort-Puzzle statt des Mikrofons — es bleibt alles lernbar und
   es gibt genauso viele Punkte. Der Schalter gilt für dieses Gerät. */
function MicSwitch() {
  const R = window.Recite;
  const [on, setOn] = useState(() => (R ? R.micAllowed() : true));
  if (!R) return null;
  const mode = R.mode();
  return (
    <div className="card" style={{padding: 16, marginTop: 12}}>
      <div className="row" style={{justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap'}}>
        <div style={{flex: '1 1 240px'}}>
          <div style={{fontWeight: 800}}>🎤 Mikrofon beim Auswendiglernen</div>
          <div className="muted" style={{fontSize: 13, marginTop: 2, lineHeight: 1.5}}>
            {on
              ? R.modeLabel() + ' Beim Zuhören schickt Chrome den Ton kurz zu Google, Safari zu Apple — nichts wird gespeichert, nichts geht an unseren Server.'
              : 'Aus — die Kinder setzen die Verse stattdessen aus Wort-Bausteinen zusammen. Gleiche Punkte, kein Mikrofon.'}
          </div>
          {on && mode === 'record' && (
            <div className="muted" style={{fontSize: 12.5, marginTop: 4}}>
              Hinweis: Dieser Browser kann Arabisch nicht selbst prüfen. Die Kinder nehmen sich auf, hören sich an
              und bestätigen selbst — du siehst das in der Klassenliste als „selbst bestätigt".
            </div>
          )}
        </div>
        <button className={'btn ' + (on ? 'btn-primary' : 'btn-ghost')}
                onClick={() => { R.setMicAllowed(!on); setOn(!on); }}>
          {on ? 'An' : 'Aus'}
        </button>
      </div>
    </div>
  );
}

function TeacherCorner({ ctx }) {
  const { teacherUnlocked, setTeacherUnlocked } = ctx;
  const CR = window.Classroom;
  const SS = window.SimpleSync;
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [paste, setPaste] = useState('');
  const [msg, setMsg] = useState('');
  const [sel, setSel] = useState(null);
  const [, force] = useState(0);
  const [className, setClassName] = useState(() => (CR ? CR.getClassName() : 'Meine Klasse'));
  // Automatisches Klassenzimmer (06.08.2026, An-Ki-Prinzip): Schüler melden
  // ihren Stand selbst an den Server (Kurs-Code) — die Lehrkraft lädt hier
  // einfach die Klasse, ganz ohne Code-Kopiererei.
  const [code, setCode] = useState(() => {
    const a = SS && SS.account();
    const c = (a && a.classCode) || (function () { try { return localStorage.getItem('lern_class_code_v1') || ''; } catch (e) { return ''; } })();
    return (c === 'ALLE') ? '' : c;   // "ALLE" = Sammelklasse → kein Filter
  });
  /* Die zuletzt erfolgreich geladene Klassenliste bleibt auf dem Gerät.
     Fällt der Server einmal aus, sieht die Lehrkraft weiterhin ihre Klasse
     (mit ehrlichem Hinweis) statt einer leeren Liste — niemand „verschwindet". */
  const [serverStudents, setServerStudents] = useState(() => {
    try { const o = JSON.parse(localStorage.getItem('eb_last_roster_v1') || 'null'); return (o && o.list) || null; }
    catch (e) { return null; }
  });
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(false);
  const [srvErr, setSrvErr] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [showGroup, setShowGroup] = useState(false);
  const [sortBy, setSortBy] = useState('name');   // name | fortschritt | aktiv
  const [teacherAll, setTeacherAll] = useState(() => (SS ? SS.isTeacher() : false));
  if (!CR) return null;
  const hasPin = !!CR.getPin();

  /* Klasse laden — OHNE Code. Leerer Code bedeutet: alle Kinder, die sich je
     mit ihrem Namen angemeldet haben. Ein Code filtert nur noch auf eine
     Gruppe, falls mehrere Klassen getrennt werden sollen. */
  const loadClass = async (c) => {
    const cc = String(c == null ? code : c).trim().toUpperCase();
    if (!SS) return;
    setLoading(true); setSrvErr('');
    try { localStorage.setItem('lern_class_code_v1', cc); } catch (e) {}
    const r = await SS.fetchClass(cc);
    setLoading(false);
    if (r.ok) {
      const list = Object.keys(r.students || {})
        .map(n => Object.assign({ n }, r.students[n]))
        .filter(e => (e.role || 'student') !== 'teacher');
      setServerStudents(list);
      setStale(false);
      try { localStorage.setItem('eb_last_roster_v1', JSON.stringify({ list, ts: Date.now(), code: cc })); } catch (e) {}
      if (!list.length) setSrvErr('Noch niemand angemeldet. Sobald ein Kind seinen Namen einträgt, erscheint es hier — sofort, noch bevor es die erste Karte lernt.');
    } else {
      // NICHTS löschen: die zuletzt bekannte Liste bleibt stehen.
      setStale(true);
      setSrvErr(r.missing
        ? 'Der Mini-Server antwortet auf dieser Seite nicht. Tippe unten auf „🔧 Verbindung prüfen“ — dort steht in Klartext, was zu tun ist.'
        : (r.error || 'Klasse konnte gerade nicht geladen werden.'));
    }
  };
  useEffect(() => { if (teacherUnlocked) loadClass(code); }, [teacherUnlocked]);
  // Alle 45 s still nachladen, damit die Liste während des Unterrichts mitläuft.
  useEffect(() => {
    if (!teacherUnlocked) return;
    const t = setInterval(() => loadClass(code), 45000);
    return () => clearInterval(t);
  }, [teacherUnlocked, code]);

  if (!teacherUnlocked) {
    const setup = !hasPin;
    const submit = () => {
      const p = pw.trim();
      const unlock = () => {
        setTeacherUnlocked(true); setErr('');
        if (SS) { SS.setTeacherMode(true); setTeacherAll(true); } // Lehrer-Modus: alle Lektionen offen
      };
      if (p === (SS ? SS.TEACHER_PW : '1907')) { if (!hasPin) CR.setPin(p); unlock(); return; } // Lehrer-Passwort geht immer
      if (setup) {
        if (p.length < 4) { setErr('Mindestens 4 Zeichen.'); return; }
        if (p !== pw2.trim()) { setErr('Die PINs stimmen nicht überein.'); return; }
        CR.setPin(p); unlock();
      } else if (p === CR.getPin()) { unlock(); }
      else setErr('Falsche PIN.');
    };
    return (
      <div className="page" style={{maxWidth: 440}}>
        <div className="card" style={{padding: 30, textAlign: 'center'}}>
          <div style={{fontSize: 40}}><Icon.Lock/></div>
          <h1 style={{fontSize: 24, marginTop: 10}}>Klassenzimmer</h1>
          <div className="muted" style={{marginBottom: 18}}>
            {setup ? 'Nur für Lehrkräfte — Lehrer-Passwort eingeben (oder eigene PIN festlegen).' : 'Nur für Lehrkräfte — PIN oder Lehrer-Passwort eingeben.'}
          </div>
          <input type="password" inputMode="numeric" value={pw} placeholder={setup ? 'Lehrer-Passwort oder neue PIN' : 'PIN'}
                 onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
                 style={{width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)', font: 'inherit', textAlign: 'center', boxSizing: 'border-box'}}/>
          {setup && (
            <input type="password" inputMode="numeric" value={pw2} placeholder="Neue PIN wiederholen (nur bei eigener PIN)"
                   onChange={e => setPw2(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
                   style={{width: '100%', marginTop: 8, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)', font: 'inherit', textAlign: 'center', boxSizing: 'border-box'}}/>
          )}
          {!!err && <div style={{color: 'var(--rose, #D64545)', fontWeight: 700, fontSize: 13, marginTop: 8}}>{err}</div>}
          <button className="btn btn-primary btn-full btn-lg" style={{marginTop: 14}} onClick={submit}>
            {setup ? 'Öffnen' : 'Öffnen'}
          </button>
        </div>
      </div>
    );
  }

  // Server-Schüler + manuell eingesammelte Codes zusammenführen (Server gewinnt)
  const localRoster = CR.roster();
  const merged = {};
  localRoster.forEach(e => { merged[e.n.toLowerCase()] = Object.assign({ src: 'code' }, e); });
  (serverStudents || []).forEach(e => { merged[e.n.toLowerCase()] = Object.assign({ src: 'auto' }, e); });
  const roster = Object.values(merged).sort((a, b) => {
    if (sortBy === 'fortschritt') return (b.all || 0) - (a.all || 0);
    if (sortBy === 'aktiv') return (b.ts || 0) - (a.ts || 0);
    return a.n.localeCompare(b.n, 'de');
  });
  const pctColor = (p) => p >= 100 ? '#1B8A5A'
    : p > 0 ? 'hsl(' + (152 - (100 - p) * 0.35) + ', ' + (34 + p * 0.38) + '%, ' + (88 - p * 0.28) + '%)'
    : 'var(--line, #eee)';
  const fmtSeen = (ts) => {
    if (!ts) return 'noch nie';
    const min = Math.round((Date.now() - ts) / 60000);
    if (min < 2) return 'gerade eben';
    if (min < 60) return 'vor ' + min + ' Min.';
    const h = Math.round(min / 60);
    if (h < 24) return 'vor ' + h + ' Std.';
    const d = Math.round(h / 24);
    return d === 1 ? 'gestern' : 'vor ' + d + ' Tagen';
  };

  const today = new Date().toISOString().slice(0, 10);
  const avg = roster.length ? Math.round(roster.reduce((s, e) => s + (e.all || 0), 0) / roster.length) : 0;
  const activeToday = roster.filter(e => e.d === today).length;
  const topicsList = CR.topics();
  const addNow = () => {
    const r = CR.addCodes(paste);
    setPaste('');
    setMsg(r.added + ' neu · ' + r.updated + ' aktualisiert' + (r.bad ? ' · ' + r.bad + ' unlesbar' : ''));
    force(x => x + 1);
    setTimeout(() => setMsg(''), 4000);
  };
  const removeOne = async (e) => {
    if (!window.confirm(e.n + ' wirklich entfernen?')) return;
    if (e.src === 'auto' && SS) {
      await SS.removeStudentRemote(e.n, code);
      loadClass(code);
    } else {
      CR.removeStudent(e.n);
    }
    setSel(null); force(x => x + 1);
  };
  return (
    <div className="page" style={{maxWidth: 860}}>
      <div className="row" style={{justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10}}>
        <h1 style={{margin: 0}}>🏫 Klassenzimmer</h1>
        <button className="btn btn-ghost" onClick={() => setTeacherUnlocked(false)}>Sperren 🔒</button>
      </div>
      <input value={className} onChange={e => { setClassName(e.target.value); CR.setClassName(e.target.value); }}
             style={{marginTop: 8, fontWeight: 800, fontSize: 17, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', width: '100%', maxWidth: 340, boxSizing: 'border-box'}}/>
      <div className="row" style={{gap: 8, marginTop: 12, flexWrap: 'wrap'}}>
        <span className="pill">👧👦 {roster.length} Schüler</span>
        <span className="pill">Ø Fortschritt {avg}%</span>
        <span className="pill">Heute aktiv: {activeToday}</span>
      </div>

      {/* Lehrer-Modus: alle Lektionen ohne Freischaltung (Nutzerwunsch 06.08.2026) */}
      <div className="card" style={{padding: 14, marginTop: 14}}>
        <label className="row" style={{gap: 10, alignItems: 'center', cursor: 'pointer', flexWrap: 'wrap'}}>
          <input type="checkbox" checked={teacherAll} style={{width: 18, height: 18}}
                 onChange={e => { setTeacherAll(e.target.checked); SS && SS.setTeacherMode(e.target.checked); force(x => x + 1); }}/>
          <span style={{fontWeight: 800}}>🔓 Lehrer-Modus: alle Lektionen ohne Freischaltung öffnen</span>
        </label>
        <div className="muted" style={{fontSize: 12.5, marginTop: 4}}>
          Gilt nur auf diesem Gerät — zum Vorbereiten und Vorführen jeder Lektion. Zum Testen aus Schüler-Sicht einfach ausschalten.
        </div>
      </div>

      {/* Live-Klasse: keine Codes, keine Einladungen — einfach da. */}
      <div className="card" style={{padding: 16, marginTop: 12}}>
        <div className="row" style={{justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap'}}>
          <div style={{fontWeight: 800}}>📡 Live-Klasse {loading ? '· lädt…' : ''}</div>
          <div className="row" style={{gap: 8, flexWrap: 'wrap'}}>
            <button className="btn btn-ghost" onClick={() => loadClass(code)}>🔄 Aktualisieren</button>
            <button className="btn btn-ghost" onClick={() => ctx && ctx.openModal && ctx.openModal('servercheck')}>🔧 Verbindung prüfen</button>
          </div>
        </div>
        <div className="muted" style={{fontSize: 13, margin: '6px 0 0'}}>
          Jedes Kind, das in der App seinen <b>Namen</b> einträgt, steht hier — ohne Code, ohne
          Einladung. Die Liste aktualisiert sich während des Unterrichts von selbst.
        </div>
        <button className="btn btn-ghost" style={{marginTop: 8, fontSize: 12.5}} onClick={() => setShowGroup(g => !g)}>
          {showGroup ? '▴ Gruppenfilter verbergen' : '▾ Nur eine bestimmte Gruppe anzeigen'}
        </button>
        {showGroup && (
          <div className="row" style={{gap: 8, flexWrap: 'wrap', marginTop: 8}}>
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Gruppe, z. B. KLASSE4A (leer = alle)"
                   style={{flex: '1 1 160px', minWidth: 0, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', font: 'inherit', textTransform: 'uppercase'}}/>
            <button className="btn btn-primary" disabled={loading} onClick={() => loadClass(code)}>Anzeigen</button>
            {!!code && <button className="btn btn-ghost" onClick={() => { setCode(''); loadClass(''); }}>Alle zeigen</button>}
          </div>
        )}
        {stale && (
          <div className="card flat" style={{padding: 12, marginTop: 10, borderLeft: '4px solid #E0A800'}}>
            <div style={{fontWeight: 800, fontSize: 13.5}}>⚠️ Gerade keine Verbindung zum Server</div>
            <div className="muted" style={{fontSize: 12.5, marginTop: 4, lineHeight: 1.5}}>
              Du siehst den <b>zuletzt bekannten Stand</b>. Es ist nichts verloren gegangen —
              sobald der Server wieder antwortet, aktualisiert sich die Liste von selbst.
            </div>
          </div>
        )}
        {!!srvErr && <div className="muted" style={{fontWeight: 700, fontSize: 13, marginTop: 8}}>{srvErr}</div>}
      </div>

      <div className="card" style={{padding: 16, marginTop: 12}}>
        <div className="row" style={{justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap'}}>
          <div style={{flex: '1 1 220px'}}>
            <div style={{fontWeight: 800}}>✏️ Buchstaben-Werkstatt</div>
            <div className="muted" style={{fontSize: 13, marginTop: 2}}>
              Schreibweise und Umschrift ändern, Aussprache einsprechen, probehören,
              löschen oder zur Standardstimme zurück — gilt sofort überall.
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => ctx.go('cardedit')}>✏️ Bearbeiten</button>
        </div>
      </div>

      <MicSwitch/>

      <SoundCheck ctx={ctx}/>

      <AudioStudio/>

      {/* Manuelles Einsammeln als Offline-Ersatz, eingeklappt */}
      <button className="btn btn-ghost" style={{marginTop: 10, fontSize: 13}} onClick={() => setShowPaste(s => !s)}>
        {showPaste ? '▴ Codes manuell einsammeln verbergen' : '▾ Codes manuell einsammeln (Offline-Ersatz)'}
      </button>
      {showPaste && (
        <div className="card" style={{padding: 16, marginTop: 8}}>
          <div style={{fontWeight: 800}}>Fortschritts-Codes einsammeln</div>
          <div className="muted" style={{fontSize: 13, margin: '4px 0 8px'}}>
            Falls mal kein Internet da ist: Die Kinder kopieren ihren Code auf der Startseite
            und schicken ihn dir. Hier einfügen — gleicher Name wird aktualisiert.
          </div>
          <textarea value={paste} onChange={e => setPaste(e.target.value)} placeholder="EB2.… (mehrere Codes einfach untereinander)"
                    style={{width: '100%', minHeight: 70, padding: 10, borderRadius: 10, border: '1px solid var(--line)', fontFamily: 'monospace', fontSize: 12, boxSizing: 'border-box'}}/>
          <div className="row" style={{gap: 10, marginTop: 8, alignItems: 'center', flexWrap: 'wrap'}}>
            <button className="btn btn-primary" disabled={!paste.trim()} style={{opacity: paste.trim() ? 1 : .5}} onClick={addNow}>Hinzufügen</button>
            {!!msg && <span className="muted" style={{fontWeight: 700, fontSize: 13}}>{msg}</span>}
          </div>
        </div>
      )}

      {roster.length === 0 && (
        <div className="card" style={{padding: 26, textAlign: 'center', marginTop: 12}}>
          <div style={{fontSize: 30}}>🌱</div>
          <div style={{fontWeight: 800, marginTop: 4}}>Noch keine Schüler</div>
          <div className="muted" style={{fontSize: 13.5}}>
            Lass die Kinder die App öffnen, oben rechts auf <b>Anmelden</b> tippen und ihren
            <b> Namen</b> eintragen. Mehr ist nicht nötig — sie stehen sofort hier.
          </div>
        </div>
      )}
      {/* Ueberblick: eine Zeile pro Kind, eine Spalte pro Lektion */}
      {roster.length > 0 && (
        <div className="card" style={{padding: 14, marginTop: 12}}>
          <div style={{fontWeight: 800, marginBottom: 2}}>🗺️ Wer steht wo?</div>
          <div className="muted" style={{fontSize: 12.5, marginBottom: 10}}>
            Je grüner, desto sicherer sitzt die Lektion. Tippe auf eine Zeile für die Einzelheiten.
          </div>
          <div style={{overflowX: 'auto', paddingBottom: 4}}>
            <div style={{minWidth: Math.max(260, 120 + topicsList.length * 26)}}>
              <div className="row" style={{gap: 2, marginBottom: 4}}>
                <div style={{width: 116, flex: '0 0 116px'}}/>
                {topicsList.map((t, i) => (
                  <div key={t.id} title={t.name} className="muted"
                       style={{width: 24, flex: '0 0 24px', textAlign: 'center', fontSize: 10.5, fontWeight: 800}}>
                    {i + 1}
                  </div>
                ))}
              </div>
              {roster.map(e => (
                <div key={e.n} className="row" style={{gap: 2, marginBottom: 3, alignItems: 'center', cursor: 'pointer'}}
                     onClick={() => setSel(sel === e.n ? null : e.n)}>
                  <div style={{width: 116, flex: '0 0 116px', fontSize: 12.5, fontWeight: 700,
                               overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{e.n}</div>
                  {topicsList.map(t => {
                    const p = (e.tp && e.tp[t.id] && e.tp[t.id].p) || 0;
                    return (
                      <div key={t.id} title={t.name + ': ' + p + ' %'}
                           style={{width: 24, flex: '0 0 24px', height: 20, borderRadius: 5,
                                   background: pctColor(p), border: '1px solid var(--line)',
                                   fontSize: 9, fontWeight: 800, color: p > 55 ? '#fff' : 'var(--muted, #667)',
                                   display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                        {p > 0 ? p : ''}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="muted" style={{fontSize: 11.5, marginTop: 8, lineHeight: 1.5}}>
            {topicsList.map((t, i) => (i + 1) + ' = ' + t.name).join('  ·  ')}
          </div>
        </div>
      )}

      {roster.length > 1 && (
        <div className="row" style={{gap: 6, marginTop: 12, alignItems: 'center', flexWrap: 'wrap'}}>
          <span className="muted" style={{fontSize: 12.5, fontWeight: 700}}>Sortieren:</span>
          {[['name', 'Name'], ['fortschritt', 'Fortschritt'], ['aktiv', 'zuletzt aktiv']].map(pair => (
            <button key={pair[0]} className="pill" onClick={() => setSortBy(pair[0])}
                    style={{cursor: 'pointer', border: '1px solid var(--line)',
                            background: sortBy === pair[0] ? 'var(--success-soft, #E7F7EE)' : 'var(--surface)',
                            fontWeight: sortBy === pair[0] ? 800 : 600}}>{pair[1]}</button>
          ))}
        </div>
      )}

      <div className="col" style={{gap: 10, marginTop: 12}}>
        {roster.map(e => {
          const open = sel === e.n;
          const lastSeen = e.ts ? new Date(e.ts) : null;
          return (
            <div key={e.n} className="card" style={{padding: 14, cursor: 'pointer'}} onClick={() => setSel(open ? null : e.n)}>
              <div className="row" style={{alignItems: 'center', gap: 10, flexWrap: 'wrap'}}>
                <div style={{fontWeight: 800, fontSize: 16, flex: '1 1 120px'}}>
                  {e.n} {e.src === 'auto' && <span title="automatisch über Kurs-Code" style={{fontSize: 13}}>📡</span>}
                </div>
                <span className="pill">Level {e.lvl || 1}</span>
                <span className="pill">⚡ {e.xp || 0} XP</span>
                {!!e.tdxp && <span className="pill">heute +{e.tdxp}</span>}
                <span className="pill">🔥 {e.streak || 0}</span>
                <span className="pill" style={{background: e.d === today ? 'var(--success-soft, #E7F7EE)' : undefined}}>
                  📅 {e.d || 'neu'}{lastSeen ? ' · ' + lastSeen.toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'}) : ''}
                </span>
              </div>
              <div className="row" style={{alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap'}}>
                <span style={{fontSize: 13.5, fontWeight: 700}}>
                  📍 {e.cur ? (e.cur.st === 'fertig' ? 'Alles geschafft — ' + e.cur.nm
                        : e.cur.st === 'offen' ? 'startet als Nächstes: ' + e.cur.nm
                        : 'ist bei: ' + e.cur.nm)
                      : 'noch nicht gestartet'}
                </span>
                {e.cur && e.cur.st === 'lernt' && (
                  <span className="muted" style={{fontSize: 12.5}}>
                    {e.cur.m} von {e.cur.t} Karten sicher · {e.cur.p}%
                  </span>
                )}
                {e.inf && e.inf.wv > 0 && (
                  <span className="pill" title="Hat den Unendlich-XP-Modus freigeschaltet und trainiert dort"
                        style={{background: '#F3EFFA', color: '#4B2E83'}}>♾️ {e.inf.wv}</span>
                )}
                {e.hz && e.hz.d > 0 && (
                  <span className="pill" title={'Auswendig gelernte Suren/Gebete' + (e.hz.self ? ' · ' + e.hz.self + '× selbst bestätigt' : '')}
                        style={{background: 'var(--warn-soft, #FDF1E0)'}}>🕌 {e.hz.d} auswendig</span>
                )}
                <span className="muted" style={{fontSize: 12.5, marginLeft: 'auto'}}>zuletzt: {fmtSeen(e.ts)}</span>
              </div>
              <div className="row" style={{alignItems: 'center', gap: 10, marginTop: 8}}>
                <div style={{flex: 1, height: 10, borderRadius: 999, background: 'var(--line, #eee)', overflow: 'hidden'}}>
                  <div style={{width: (e.all || 0) + '%', height: '100%', borderRadius: 999, background: 'var(--success, #1B8A5A)'}}/>
                </div>
                <div style={{fontWeight: 800, fontSize: 14, minWidth: 44, textAlign: 'right'}}>{e.all || 0}%</div>
              </div>
              {open && (
                <div style={{marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 10}} onClick={ev => ev.stopPropagation()}>
                  {!e.tp && (
                    <div className="muted" style={{fontSize: 12.5, marginBottom: 8}}>
                      Angemeldet, aber noch nicht gelernt — sobald die erste Runde läuft, füllen sich die Balken.
                    </div>
                  )}
                  {!!e.tc && (
                    <div className="row" style={{gap: 8, flexWrap: 'wrap', marginBottom: 10}}>
                      <span className="pill">🎯 {e.mc || 0} von {e.tc} Karten sitzen</span>
                      <span className="pill">📚 {e.lc || 0} am Lernen</span>
                      <span className="pill">📖 {(e.tc - (e.mc || 0) - (e.lc || 0))} noch nie gesehen</span>
                    </div>
                  )}
                  {Array.isArray(e.d7) && e.d7.length > 0 && (
                    <div style={{marginBottom: 10}}>
                      <div className="muted" style={{fontSize: 12.5, fontWeight: 700, marginBottom: 4}}>Die letzten 7 Tage</div>
                      <div className="row" style={{gap: 4, alignItems: 'flex-end', height: 34}}>
                        {e.d7.map((v, i) => {
                          const max = Math.max.apply(null, e.d7.concat([1]));
                          return (
                            <div key={i} title={v + ' XP'} style={{flex: 1, minWidth: 8}}>
                              <div style={{height: Math.max(3, Math.round(30 * v / max)), borderRadius: 4,
                                           background: v ? 'var(--success, #1B8A5A)' : 'var(--line, #eee)'}}/>
                            </div>
                          );
                        })}
                      </div>
                      <div className="muted" style={{fontSize: 11, marginTop: 3}}>
                        {['vor 6 Tagen', '', '', '', '', '', 'heute'].map((l, i) => (
                          <span key={i} style={{display: 'inline-block', width: 'calc(100%/7)', textAlign: i === 0 ? 'left' : i === 6 ? 'right' : 'center'}}>{l}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {e.hz && (e.hz.d > 0 || e.hz.v > 0) && (
                    <div style={{marginBottom: 12}}>
                      <div className="muted" style={{fontSize: 12.5, fontWeight: 700, marginBottom: 4}}>
                        🕌 Auswendig gelernt · {e.hz.r || ''}
                      </div>
                      <div className="row" style={{gap: 6, flexWrap: 'wrap', marginBottom: 6}}>
                        <span className="pill">🏆 {e.hz.d} von {e.hz.t} komplett</span>
                        <span className="pill">🌟 {e.hz.v} von {e.hz.vt} Versen sitzen</span>
                        <span className="pill">✨ {e.hz.xp || 0} XP dafür</span>
                        {e.hz.self > 0 && <span className="pill" title="Ohne Spracherkennung geübt und selbst bestätigt — bitte einmal persönlich abhören.">🤝 {e.hz.self}× selbst bestätigt</span>}
                      </div>
                      <div className="row" style={{gap: 6, flexWrap: 'wrap'}}>
                        {Object.keys(e.hz.per || {}).map(k => {
                          const x = e.hz.per[k];
                          return (
                            <span key={k} className="pill"
                                  title={x.n + ': ' + x.v + ' von ' + x.t + ' Versen frei aufgesagt' + (x.b ? ' · beste Bewertung ' + x.b + '%' : '')}
                                  style={{background: x.due ? 'var(--rose-soft, #FDECEC)' : x.d ? 'var(--success-soft, #E7F7EE)' : undefined}}>
                              {x.d ? '🏆 ' : ''}{x.n} {x.d ? (x.due ? '· auffrischen!' : '') : '· ' + x.v + '/' + x.t}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {e.inf && (
                    <div style={{marginBottom: 12}}>
                      <div className="muted" style={{fontSize: 12.5, fontWeight: 700, marginBottom: 4}}>♾️ Unendlich-XP (Training)</div>
                      <div className="row" style={{gap: 6, flexWrap: 'wrap', marginBottom: 6}}>
                        <span className="pill">🌊 {e.inf.wv} Wellen</span>
                        <span className="pill">🎯 {e.inf.pct}% richtig ({e.inf.q} Fragen)</span>
                        <span className="pill">🔥 beste Serie {e.inf.best}</span>
                        <span className="pill">✨ {e.inf.xp} XP</span>
                      </div>
                      {Array.isArray(e.inf.top) && e.inf.top.length > 0 && (
                        <div className="row" style={{gap: 6, flexWrap: 'wrap'}}>
                          <span className="muted" style={{fontSize: 12}}>Fällt auch im Training noch schwer:</span>
                          {e.inf.top.map((w, i) => (
                            <span key={i} className="pill" style={{background: 'var(--rose-soft, #FDECEC)'}}>{w.c} · {w.n}×</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {Array.isArray(e.wk) && e.wk.length > 0 && (
                    <div style={{marginBottom: 12}}>
                      <div className="muted" style={{fontSize: 12.5, fontWeight: 700, marginBottom: 4}}>🔁 Woran es gerade hakt</div>
                      <div className="row" style={{gap: 6, flexWrap: 'wrap'}}>
                        {e.wk.map((w, i) => (
                          <span key={i} className="pill" title={w.t + ' · ' + w.w + '× falsch'}
                                style={{background: w.s === 'vergessen' ? 'var(--rose-soft, #FDECEC)' : undefined}}>
                            {w.c}{w.w ? ' · ' + w.w + '×' : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="muted" style={{fontSize: 12.5, fontWeight: 700, marginBottom: 6}}>Fortschritt je Lektion</div>
                  {topicsList.map(t => {
                    const p = (e.tp && e.tp[t.id]) || { p: 0, m: 0, t: 0 };
                    return (
                      <div key={t.id} className="row" style={{alignItems: 'center', gap: 10, marginBottom: 6}}>
                        <div className="muted" style={{flex: '0 0 46%', fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{t.name}</div>
                        <div style={{flex: 1, height: 7, borderRadius: 999, background: 'var(--line, #eee)', overflow: 'hidden'}}>
                          <div style={{width: (p.p || 0) + '%', height: '100%', borderRadius: 999, background: 'var(--accent, #2A6BE0)'}}/>
                        </div>
                        <div className="muted" style={{fontSize: 12, fontWeight: 700, minWidth: 66, textAlign: 'right'}}>{p.m}/{p.t} · {p.p}%</div>
                      </div>
                    );
                  })}
                  <button className="btn btn-ghost" style={{marginTop: 6, color: 'var(--rose, #D64545)'}}
                          onClick={() => removeOne(e)}>
                    Schüler entfernen
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============== QUIZ LOADING ============== */
function QuizLoading({ onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 1400); return () => clearTimeout(t); }, []);
  return (
    <div className="loading-shell">
      <div style={{textAlign:'center'}}>
        <div className="mascot-anim"><Axolotl size={160}/></div>
        <div style={{fontFamily:'Fraunces, serif', fontWeight:900, fontSize:24, marginTop:10}}>Vorbereitung läuft…</div>
        <div className="muted">Wähle deine Fragen aus</div>
      </div>
    </div>
  );
}

window.App = App;
