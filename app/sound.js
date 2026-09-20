/* ==============================================================
   Sound- & Haptik-Feedback — KOMPLETT NEU (06.08.2026).

   Dritte Runde Nutzerkritik ("die Töne sind so komisch — bitte ganz
   anders machen"): Schluss mit synthetischen Oszillator-Tönen zur
   Laufzeit. Die App spielt jetzt RICHTIGE, vorproduzierte Klänge ab
   (assets/sounds/*.mp3): warme Kalimba/Marimba-Plucks mit echtem
   Anschlag, weichem Ausklingen und einem Hauch Raumhall — eigens für
   die App synthetisiert (44,1 kHz, mono, ~20-50 KB je Datei, offline
   nutzbar, keine Lizenzfragen).

   Klang-Katalog:
     correct  → sanfter Zwei-Ton-Ping aufwärts (G5→C6), kurz & warm
     wrong    → EIN runder tiefer Holzton (D4) — neutral, nicht traurig
     combo    → flottes Dur-Arpeggio mit Glitzer
     round    → fröhliche Fanfare + Schluss-Akkord (Rundenende)
     level    → zweistufige Fanfare (Level-up)
     streak   → warme Aufwärts-Terz (Tages-Serie gesichert)
     master   → große ~2,3-s-Fanfare (Stapel gemeistert)
     tick     → dezenter Einzelton (Aufdecken/Lehrkarte)

   Technik: HTMLAudio mit kleinem Klon-Pool (schnelle Wiederholungen
   überlappen sauber), Lautstärke zentral, API unverändert — alle
   bisherigen Aufrufer (quiz.js, xp.js, …) funktionieren ohne Anpassung.
   ============================================================== */
(function () {
  let enabled = true;
  let hapticEnabled = true;
  let master = 1.0; // zentrale Lautstärke (0..1)

  const BASE = 'assets/sounds/';
  const FILES = {
    correct: 'correct.mp3',
    wrong: 'wrong.mp3',
    combo: 'combo.mp3',
    round: 'round.mp3',
    level: 'level.mp3',
    streak: 'streak.mp3',
    master: 'master.mp3',
    tick: 'tick.mp3',
  };

  // Pro Klang ein Original-Element + Klone für Überlappungen.
  const bank = {};
  function get(name) {
    if (!bank[name]) {
      const a = new Audio(BASE + FILES[name]);
      a.preload = 'auto';
      bank[name] = { proto: a, pool: [a], next: 0 };
    }
    return bank[name];
  }
  // Beim ersten Nutzer-Klick alle Klänge anstupsen (Browser-Autoplay-Regeln):
  // einmal laden reicht — abgespielt wird später sowieso nur nach Klicks.
  let warmed = false;
  function warmup() {
    if (warmed) return;
    warmed = true;
    Object.keys(FILES).forEach(n => { try { get(n).proto.load(); } catch (e) {} });
  }
  document.addEventListener('pointerdown', warmup, { once: true, capture: true });

  function play(name, opts) {
    if (!enabled) return;
    opts = opts || {};
    try {
      const b = get(name);
      let a = b.pool.find(x => x.paused || x.ended);
      if (!a) {
        if (b.pool.length < 4) { a = b.proto.cloneNode(); b.pool.push(a); }
        else { a = b.pool[b.next % b.pool.length]; b.next++; }
      }
      a.volume = Math.max(0, Math.min(1, (opts.volume != null ? opts.volume : 1) * master));
      a.playbackRate = opts.rate || 1;
      a.currentTime = 0;
      const p = a.play();
      if (p && p.catch) p.catch(function () { /* Autoplay blockiert: still bleiben */ });
    } catch (e) { /* Audio nicht verfügbar: still bleiben */ }
  }

  function vibrate(pattern) {
    if (!hapticEnabled) return;
    if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) { /* nicht unterstützt */ } }
  }

  const Sound = {
    setEnabled: function (v) { enabled = !!v; },
    setHapticEnabled: function (v) { hapticEnabled = !!v; },
    setVolume: function (v) { master = Math.max(0, Math.min(1, Number(v) || 0)); },

    // Richtige Antwort (v2, 06.08.2026): tiefes, weiches "du-dum" auf Filz-
    // Marimba (G4→C5) — bewusst leise und rund, damit die arabische
    // Aussprache direkt danach angenehm darüberliegen kann.
    correct: function () { play('correct', { volume: 0.45 }); vibrate([8]); },

    // Falsche Antwort: ein einzelner weicher Tiefton — "hm, nochmal", ohne Härte.
    wrong: function () { play('wrong', { volume: 0.4 }); vibrate([18]); },

    // Combo-Meilenstein (3er/5er): Arpeggio; beim 2x-Multiplikator minimal
    // schneller/höher (playbackRate) für spürbare Steigerung.
    comboMilestone: function (mult) {
      play('combo', { volume: 0.9, rate: mult >= 2 ? 1.09 : 1 });
      vibrate(mult >= 2 ? [15, 40, 15] : [20]);
    },

    // Rundenende: kleine Fanfare mit Schluss-Akkord.
    roundEnd: function () { play('round', { volume: 0.95 }); vibrate([18, 26, 30]); },

    // Level-up: zweistufige Fanfare.
    levelUp: function () { play('level', { volume: 1 }); vibrate([20, 30, 20, 30, 40]); },

    // Tages-Serie gesichert: warme Aufwärts-Terz.
    streakSecured: function () { play('streak', { volume: 0.9 }); vibrate([15, 30, 15]); },

    // Kompletter Stapel gemeistert: die große Fanfare.
    stackMastered: function () { play('master', { volume: 1 }); vibrate([30, 40, 30, 40, 30, 60, 90, 60, 120]); },

    // Dezente Bausteine
    sparkle: function () { play('combo', { volume: 0.45, rate: 1.15 }); },
    tick: function () { play('tick', { volume: 0.5 }); },
  };

  window.Sound = Sound;
})();
