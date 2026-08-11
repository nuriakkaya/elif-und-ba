/* ==============================================================
   🎤 NACHSPRECH-BONUS — nur in Lektion 1 „Die Buchstaben"
   (eingeführt 11.08.2026, eingegrenzt am selben Tag auf Nutzerwunsch:
   „das Gesprochene bitte nur bei dem ersten Buchstaben-Level")

   Warum nur dort? Weil nur dort verlässlich prüfbar ist, was das Kind
   sagt. In Lektion 1 nennt es den NAMEN des Buchstabens — „Elif",
   „Be", „Te" — also ein richtiges türkisches Wort, das jede
   Spracherkennung sauber versteht. Ab Lektion 2 geht es um einzelne
   Silben (بَ، رَزَقَ); die erkennt keine Spracherkennung zuverlässig,
   und ein Bonus, der zufällig mal klappt und mal nicht, ärgert Kinder
   mehr, als er sie motiviert.

   Ablauf: Karte beantwortet -> kleiner Knopf „🎤 Sag ‚Elif‘ laut".
   Antippen, sprechen, fertig. Trifft es, gibt es +8 XP obendrauf.
   Trifft es nicht, passiert gar nichts — es ist ein Bonus, keine Hürde.
   Der Browser hört hier auf TÜRKISCH zu (tr-TR), nicht auf Arabisch.

   Der Vergleich ist bewusst streng (siehe app/recite.js): „Be" und
   „Te" trennt genau ein Buchstabe. Erlaubt sind nur die unten
   aufgeführten Schreibweisen — und niemals der Name eines anderen
   Buchstabens.
   ============================================================== */
(function () {
  const { useState, useEffect, useRef } = React;
  const XP_ECHO = 8;

  /* Nur diese Lektion bekommt den Bonus. Weitere IDs hier ergänzen,
     falls später doch mehr dazukommen soll. */
  const ECHO_TOPICS = ['quran-harfler'];

  /* Erlaubte Schreibweisen je Buchstabenname. Bewusst KEINE Namen
     anderer Buchstaben — sonst bekäme man den Bonus für den falschen. */
  const ALIAS = {
    'elif': ['elif', 'alif', 'elf'],
    'be': ['be', 'bee'],
    'te': ['te', 'tee'],
    'se': ['se', 'peltek se'],
    'cim': ['cim', 'jim'],
    'ha': ['ha'],
    'cha': ['cha', 'hı', 'kha', 'chi'],
    'dal': ['dal'],
    'zel': ['zel', 'peltek zel'],
    'ra': ['ra'],
    'ze': ['ze'],
    'sin': ['sin'],
    'şın': ['şın', 'şin'],
    'sad': ['sad', 'sat'],
    'dat': ['dat', 'dad'],
    'tı': ['tı'],
    'zı': ['zı'],
    'ayın': ['ayın', 'ayn', 'ain'],
    'ğayın': ['ğayın', 'gayın', 'gayn', 'ğayn'],
    'fe': ['fe'],
    'qaf': ['qaf', 'kaf', 'kaaf'],
    'kef': ['kef'],
    'lam': ['lam'],
    'mim': ['mim'],
    'nun': ['nun'],
    'vav': ['vav', 'waw'],
    'he': ['he'],
    'lamelif': ['lamelif', 'lam elif'],
    'ye': ['ye'],
  };
  const key = (s) => String(s || '').trim().replace(/I/g, 'ı').replace(/İ/g, 'i').toLowerCase();
  function acceptedFor(name) { return ALIAS[key(name)] || [key(name)]; }
  /* Alle anderen Buchstabennamen — sie dürfen NIE als Treffer gelten. */
  function denyFor(name) {
    const me = key(name);
    const out = [];
    Object.keys(ALIAS).forEach(function (k) { if (k !== me) out.push.apply(out, ALIAS[k]); });
    return out;
  }

  function EchoBonus({ answer, topicId, factor, seq }) {
    const [phase, setPhase] = useState('idle');   // idle | listening | ok | miss | error
    const [tries, setTries] = useState(0);
    const [gotXp, setGotXp] = useState(0);
    const [heard, setHeard] = useState('');
    const ctrl = useRef(null);

    useEffect(function () { setPhase('idle'); setTries(0); setGotXp(0); setHeard(''); }, [seq, answer]);
    useEffect(function () { return function () { if (ctrl.current && ctrl.current.abort) ctrl.current.abort(); }; }, []);

    const name = String(answer || '').trim();
    if (!name || ECHO_TOPICS.indexOf(String(topicId || '')) < 0) return null;
    if (!window.Recite || window.Recite.mode() !== 'speech') return null;   // ohne echte Prüfung kein Bonus
    if (!ALIAS[key(name)]) return null;                                     // unbekannter Name -> lieber nichts
    const f = (factor == null) ? 1 : factor;
    const reward = Math.round(XP_ECHO * f);

    function start() {
      setPhase('listening'); setHeard('');
      ctrl.current = window.Recite.listen({
        lang: 'tr-TR',
        maxMs: 6000,
        onDone: function (text) {
          const g = window.Recite.gradeName(name, text, acceptedFor(name), denyFor(name));
          setHeard(g.heard || '');
          const t = tries + 1;
          setTries(t);
          if (g.level === 'gut') {
            setPhase('ok');
            if (reward > 0 && window.XP) {
              window.XP.addBonus(reward);
              if (topicId && window.XP.bumpTopic) window.XP.bumpTopic(topicId, reward);
              setGotXp(reward);
            }
            try { if (window.Sound) window.Sound.correct(); } catch (e) {}
          } else {
            setPhase(t >= 2 ? 'miss' : 'again');
          }
        },
        onError: function () { setPhase('error'); },
      });
    }

    if (phase === 'ok') {
      return <div className="echo-row is-ok">🎉 Richtig gesagt!{gotXp > 0 ? ' +' + gotXp + ' XP' : ''}</div>;
    }
    if (phase === 'miss') {
      return <div className="echo-row is-miss">Kein Problem — beim nächsten Buchstaben klappt es. 💪</div>;
    }
    if (phase === 'error') {
      return <div className="echo-row is-miss">🎤 Das Mikrofon war gerade nicht bereit.</div>;
    }
    return (
      <button className={'echo-row is-btn' + (phase === 'listening' ? ' is-live' : '')}
              onClick={phase === 'listening' ? function () { ctrl.current && ctrl.current.stop(); } : start}>
        {phase === 'listening' ? '🔴 Ich höre dich … (antippen zum Beenden)'
          : phase === 'again' ? ('🙂 Ich habe ' + (heard ? '„' + heard + '"' : 'nichts') + ' verstanden — nochmal?')
          : '🎤 Sag „' + name + '" laut' + (reward > 0 ? ' — Bonus +' + reward + ' XP' : '')}
      </button>
    );
  }

  window.EchoBonus = EchoBonus;
  window.EchoBonusInfo = { ECHO_TOPICS: ECHO_TOPICS, ALIAS: ALIAS, acceptedFor: acceptedFor, denyFor: denyFor };
})();
