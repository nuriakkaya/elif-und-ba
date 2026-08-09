/* ==============================================================
   Feier-Effekte (Konfetti/Funken) — app/celebrate.js
   NEU 26.07.2026, auf Nutzerkritik: "der Effekt, wenn ich etwas
   durchgespielt habe, ist nicht so geil wie bei dem echten Gizmo."

   Warum ein eigenes Modul und kein React-Zustand?
   Die Feier wird von ZWEI Stellen ausgelöst (app/quiz.js "Stapel
   gemeistert" und app/main.js "Monster geschlüpft"). Als reine
   DOM-Funktion ist sie mit einer Zeile aufrufbar
   (`window.Celebrate.burst()`), braucht keinen React-State, keine
   Re-Renders und räumt sich selbst auf. Außerdem läuft sie damit auch
   dort, wo gar keine React-Komponente in der Nähe ist.

   Technik: eine fixierte Overlay-Ebene mit N absolut positionierten
   Schnipseln. Jeder Schnipsel bekommt seine Flugbahn über CSS-Variablen
   (--dx, --dy, --rot, --dur, --delay) mit; die Animation selbst
   (@keyframes confettiBurst in index.html) läuft komplett auf der
   GPU-freundlichen transform/opacity-Achse. Nach der längsten
   Flugdauer wird die ganze Ebene wieder entfernt — es bleibt kein
   Knoten im DOM zurück.

   `prefers-reduced-motion: reduce` wird respektiert: dann kein Konfetti.
   ============================================================== */
(function () {
  // Gizmo-nahe, freundliche Palette (Gold, Violett, Grün, Türkis, Rosa, Gelb).
  const COLORS = ['#F6C445', '#7A7BF5', '#34C759', '#56CCF2', '#FF6B9D', '#FFB020', '#A06AF9'];
  const SHAPES = ['sq', 'rect', 'circle', 'star'];

  function reducedMotion() {
    try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  }

  /* Reine Bahnberechnung (testbar, ohne DOM): verteilt `count` Schnipsel
     radial über den ganzen Kreis, mit etwas Streuung in Winkel, Weite und
     Dauer, und einer Aufwärts-Vorliebe (Konfetti-Kanone schießt nach oben,
     die Schwerkraft kommt aus dem Keyframe). Deterministisch pro Index bis
     auf den jitter-Parameter, damit man sie im Test prüfen kann. */
  function piecePath(i, count, jitter) {
    const j = jitter == null ? 0.5 : jitter;
    const angle = (i / count) * Math.PI * 2 + (j - 0.5) * 0.6;
    const spread = 120 + j * 220;                 // px vom Zentrum
    const dx = Math.cos(angle) * spread;
    const dy = Math.sin(angle) * spread * 0.75 - 90; // -90 = Aufwärts-Vorliebe
    return {
      dx: Math.round(dx),
      dy: Math.round(dy),
      rot: Math.round((j < 0.5 ? -1 : 1) * (240 + j * 540)),
      dur: 1.5 + j * 1.3,
      delay: (i % 8) * 0.035 + j * 0.12,
      color: COLORS[i % COLORS.length],
      shape: SHAPES[i % SHAPES.length],
      size: 7 + Math.round(j * 8),
    };
  }

  /* Konfetti-Explosion aus der Bildschirmmitte.
     opts: { count = 70, duration = 3200 (ms bis zum Aufräumen), top = '44%' } */
  function burst(opts) {
    opts = opts || {};
    if (reducedMotion()) return null;
    if (typeof document === 'undefined' || !document.body) return null;
    const count = opts.count || 70;

    // Eigene Klassen (.confetti-burst-layer/.confetti-bit): .confetti-piece ist
    // schon vom fallenden Rundenende-Konfetti (RoundEnd, index.html) belegt.
    const layer = document.createElement('div');
    layer.className = 'confetti-burst-layer';
    if (opts.top) layer.style.setProperty('--origin-top', opts.top);

    for (let i = 0; i < count; i++) {
      const p = piecePath(i, count, Math.random());
      const el = document.createElement('span');
      el.className = 'confetti-bit cf-' + p.shape;
      el.style.setProperty('--dx', p.dx + 'px');
      el.style.setProperty('--dy', p.dy + 'px');
      el.style.setProperty('--rot', p.rot + 'deg');
      el.style.setProperty('--dur', p.dur + 's');
      el.style.setProperty('--delay', p.delay + 's');
      el.style.setProperty('--size', p.size + 'px');
      if (p.shape === 'star') el.textContent = '✦';
      else el.style.background = p.color;
      el.style.color = p.color;
      layer.appendChild(el);
    }

    document.body.appendChild(layer);
    const life = opts.duration || 3200;
    setTimeout(function () { if (layer.parentNode) layer.parentNode.removeChild(layer); }, life);
    return layer;
  }

  /* Zweite Welle: dieselbe Explosion nochmal, leicht versetzt und kleiner.
     Genau das macht große Feiern "voll" — eine einzelne Salve wirkt dünn. */
  function bigCelebration(opts) {
    opts = opts || {};
    const first = burst({ count: opts.count || 80, duration: 3600 });
    setTimeout(function () { burst({ count: Math.round((opts.count || 80) * 0.6), duration: 3200 }); }, 620);
    setTimeout(function () { burst({ count: Math.round((opts.count || 80) * 0.45), duration: 3000 }); }, 1250);
    return first;
  }

  window.Celebrate = { burst, bigCelebration, _pure: { piecePath, COLORS, SHAPES } };
})();
