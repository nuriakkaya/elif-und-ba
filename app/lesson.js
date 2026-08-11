/* global React, Icon, MiniAxolotl, Owl, TutorCollapse */
/* ==============================================================
   LEKTIONEN-MODUS ("Schritt-für-Schritt-Lektion" wie im Original).

   Im echten Gizmo tauchen Lektionen als Kacheln mit Fortschritts-%
   auf ("43% · Sicherheitszeichen ASR A1.3 · Schritt-für-Schritt-
   Lektion"). Aufbau hier: eine Lektion = ein Baustein (Block) eines
   Themengebiets. Die Inhaltskarten des Blocks werden schrittweise
   präsentiert, nach je ~2 Inhalten kommt ein Verständnis-Check
   (MC/Lückentext aus demselben Block, generiert über app/engine.js,
   ein Versuch, +17 XP bei Treffer). Fortschritt wird pro Lektion
   gespeichert (localStorage s34a_lesson_v1) — Wiedereinstieg beim
   letzten Schritt, Prozent-Anzeige im Lektionen-Tab.
   ============================================================== */
(function () {
  const KEY = 's34a_lesson_v1';
  function loadAll() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function saveAll(all) {
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) { /* voll */ }
  }
  function lessonKey(topicId, block) { return String(topicId) + '::block' + String(block.n); }
  function getProgress(topicId, block) {
    const st = loadAll()[lessonKey(topicId, block)];
    if (!st || !st.total) return { pct: 0, step: 0, done: false };
    return { pct: st.done ? 100 : Math.round((st.step / st.total) * 100), step: st.step, done: !!st.done };
  }
  function setProgress(topicId, block, step, total, done) {
    const all = loadAll();
    all[lessonKey(topicId, block)] = { step, total, done: !!done, updatedAt: Date.now() };
    saveAll(all);
  }
  window.LessonStore = { getProgress, setProgress };
})();

function buildLessonSteps(block, topicId) {
  const E = window.QEngine;
  const checks = E.shuffle(block.quiz || [])
    .map(q => ({ card: q, gen: E.generate(q, topicId) }))
    .filter(x => x.gen.kind === 'mc' || x.gen.kind === 'cloze');
  const steps = [];
  let ci = 0;
  (block.cards || []).forEach((c, i) => {
    steps.push({ type: 'content', card: c });
    const isPairEnd = (i % 2 === 1) || (i === block.cards.length - 1);
    if (isPairEnd && ci < checks.length) steps.push({ type: 'check', ...checks[ci++] });
  });
  if (!steps.length && checks.length) steps.push({ type: 'check', ...checks[ci++] });
  return steps;
}

/* Verständnis-Check innerhalb der Lektion: ein Versuch, dann Auflösung. */
function LessonCheck({ step, topicId, onDone }) {
  const gen = step.gen;
  const isMulti = gen.kind === 'mc' && gen.multi;
  const correctIdxs = gen.options.map((o, i) => o.c ? i : -1).filter(i => i >= 0);
  const [selected, setSelected] = React.useState([]);
  const [revealed, setRevealed] = React.useState(false);
  const [wasRight, setWasRight] = React.useState(null);
  const doneRef = React.useRef(false);

  const resolve = (sel) => {
    if (doneRef.current) return;
    doneRef.current = true;
    const cset = new Set(correctIdxs);
    const right = sel.length === cset.size && sel.every(x => cset.has(x));
    setRevealed(true);
    setWasRight(right);
    // Wie eine normale richtige Antwort — inklusive Wiederholungs-Faktor
    // (app/replay.js): ein drittes Durchspielen bringt keine Punkte mehr.
    if (right && window.XP) {
      const f = window.Replay ? window.Replay.factor(topicId) : 1;
      const n = Math.round(17 * f);
      if (n > 0) { window.XP.addBonus(n); window.XP.bumpTopic(topicId, n); }
    }
    window.Sound && (right ? window.Sound.correct() : window.Sound.wrong());
  };
  const pick = (i) => {
    if (revealed) return;
    if (isMulti) { setSelected(s => s.includes(i) ? s.filter(x => x !== i) : [...s, i]); return; }
    setSelected([i]);
    resolve([i]);
  };

  return (
    <>
      <div className="question-card">
        <span className="qtag">🦉 Verständnis-Check</span>
        <div className="qtext">{gen.q}</div>
        {gen.kind === 'cloze' && (
          <div className="cloze-line">
            {revealed
              ? gen.a.split(gen.term).flatMap((part, i, arr) => i < arr.length - 1 ? [part, <span key={i} className="cloze-filled">{gen.term}</span>] : [part])
              : gen.masked.split('▁▁▁▁').flatMap((part, i, arr) => i < arr.length - 1 ? [part, <span key={i} className="cloze-blank">&nbsp;&nbsp;&nbsp;&nbsp;</span>] : [part])}
          </div>
        )}
        {isMulti && !revealed && <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>Wähle alle richtigen Antworten · {selected.length} ausgewählt</div>}
      </div>
      <div className="options">
        {gen.options.map((o, i) => {
          const isSel = selected.includes(i);
          let cls = 'option';
          if (revealed) {
            if (o.c) cls += ' is-correct';
            else if (isSel) cls += ' is-wrong';
            else cls += ' is-disabled';
          } else if (isSel) cls += ' is-correct';
          return <button key={i} className={cls} onClick={() => pick(i)}>{o.t}</button>;
        })}
      </div>
      {isMulti && !revealed && (
        <button className="btn btn-primary btn-full btn-lg" disabled={!selected.length} onClick={() => resolve(selected)} style={{ opacity: selected.length ? 1 : 0.4 }}>Prüfen</button>
      )}
      {/* Nach der Auflösung: Tutor zur Check-Frage (03.08.2026). Zugeklappt —
          wer den Check richtig hatte, will meist einfach weiter. */}
      {revealed && (
        <TutorCollapse
          card={step.card}
          topicId={topicId}
          answerTxt={gen.options.filter(o => o.c).map(o => o.t).join(', ')}
          label="Warum ist das so?"
        />
      )}
      {revealed && (
        <button className="btn btn-primary btn-full btn-lg" onClick={() => onDone(wasRight)}>
          {wasRight ? '✅ Richtig — weiter' : 'Weiter'} <Icon.Arrow />
        </button>
      )}
    </>
  );
}

function LessonScreen({ go, stackName, topicId, blockIdx }) {
  const topic = ((window.QURAN_TOPICS || []).concat(window.S34A_TOPICS || [], (window.CustomTopics && window.CustomTopics.list()) || [])).find(t => t.id === topicId);
  const block = topic && topic.blocks[blockIdx];
  const [steps] = React.useState(() => block ? buildLessonSteps(block, topicId) : []);
  const saved = block ? window.LessonStore.getProgress(topicId, block) : { step: 0 };
  const [idx, setIdx] = React.useState(() => Math.min(saved.done ? 0 : saved.step, Math.max(0, steps.length - 1)));
  const [finished, setFinished] = React.useState(false);
  const [checksRight, setChecksRight] = React.useState(0);
  const [checksTotal, setChecksTotal] = React.useState(0);
  const [seq, setSeq] = React.useState(0);

  if (!block || !steps.length) {
    return (
      <div className="quiz-shell">
        <div className="quiz-stage" style={{ display: 'grid', placeItems: 'center' }}>
          <div className="card flat" style={{ padding: 24, textAlign: 'center' }}>
            <div style={{ fontWeight: 800 }}>Diese Lektion hat noch keinen Inhalt.</div>
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => go('deck')}>Zurück</button>
          </div>
        </div>
      </div>
    );
  }

  const advance = (fromCheck, wasRight) => {
    if (fromCheck) { setChecksTotal(t => t + 1); if (wasRight) setChecksRight(r => r + 1); }
    const next = idx + 1;
    if (next >= steps.length) {
      window.LessonStore.setProgress(topicId, block, steps.length, steps.length, true);
      setFinished(true);
    } else {
      window.LessonStore.setProgress(topicId, block, next, steps.length, false);
      setIdx(next);
      setSeq(s => s + 1);
    }
  };

  if (finished) {
    return (
      <div className="quiz-shell">
        <div className="quiz-topbar">
          <button className="icon-btn" onClick={() => go('deck')}><Icon.Close /></button>
          <div style={{ flex: 1 }} />
        </div>
        <div className="quiz-stage" style={{ display: 'grid', placeItems: 'center' }}>
          <div style={{ textAlign: 'center', display: 'grid', gap: 14, justifyItems: 'center', maxWidth: 460 }}>
            <Owl size={110} />
            <div className="roundend-title">Lektion abgeschlossen!</div>
            <div className="muted" style={{ fontWeight: 700 }}>Baustein {block.n}: {block.title}</div>
            {checksTotal > 0 && (
              <span className="pill" style={{ background: 'var(--success-soft, #E7F7EE)', color: 'var(--success, #1B8A5A)', fontWeight: 800 }}>
                {checksRight}/{checksTotal} Checks richtig · +{checksRight * 17} XP
              </span>
            )}
            <div className="row" style={{ gap: 10 }}>
              <button className="btn btn-ghost" style={{ padding: '12px 22px' }} onClick={() => {
                window.LessonStore.setProgress(topicId, block, 0, steps.length, false);
                go('lesson', { blockIdx });
              }}>🔁 Nochmal</button>
              <button className="btn btn-primary" style={{ padding: '12px 22px' }} onClick={() => go('deck')}>Zurück zum Stapel</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const step = steps[idx];
  const detail = step.type === 'content' ? (step.card.detail || {}) : {};

  return (
    <div className="quiz-shell">
      <div className="quiz-progress"><div className="bar" style={{ width: `${(idx / steps.length) * 100}%` }} /></div>
      <div className="quiz-topbar">
        <button className="icon-btn" onClick={() => go('deck')}><Icon.Close /></button>
        <div className="quiz-stack">
          <span className="stack-dot" style={{ background: 'var(--stack-green)' }} />
          {block.title} <span className="muted" style={{ fontWeight: 600 }}>· Schritt {idx + 1}/{steps.length}</span>
        </div>
        <span className="pill">🦉 Lektion</span>
      </div>
      <div className="quiz-stage">
        <div className="stage-inner">
          {step.type === 'content' ? (
            <>
              <div className="card flat" style={{ padding: 22 }}>
                {detail.kat && <div className="muted" style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6 }}>{detail.kat}</div>}
                <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 900, fontSize: 22, marginBottom: 8 }}>{step.card.h}</div>
                <div style={{ lineHeight: 1.55 }}>{step.card.b}</div>
                {Array.isArray(detail.funktion) && detail.funktion.length > 0 && (
                  <ul style={{ margin: '12px 0 0', paddingLeft: 20, lineHeight: 1.55 }}>
                    {detail.funktion.slice(0, 4).map((f, i) => <li key={i} style={{ marginBottom: 6 }}>{f}</li>)}
                  </ul>
                )}
              </div>
              {detail.merksatz && (
                <div className="card flat" style={{ padding: 16, background: 'var(--accent-soft)', border: 'none', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 22 }}>💡</div>
                  <div><b>Merksatz:</b> {detail.merksatz}</div>
                </div>
              )}
              {/* KI-Tutor zur Inhaltskarte (03.08.2026). Im Original hängt unter
                  jedem Lektionsschritt ein Tutor, den man alles fragen kann.
                  Zugeklappt, damit nicht jeder Schritt ungefragt einen
                  Modellaufruf auslöst — key={idx}, sonst bliebe die Erklärung
                  des vorherigen Schritts stehen. */}
              <TutorCollapse
                key={idx}
                card={{ q: step.card.h, a: step.card.b, detail }}
                topicId={topicId}
                answerTxt={step.card.b}
                label="Tutor erklärt dir das"
              />
              <button className="btn btn-primary btn-full btn-lg" onClick={() => advance(false)}>Verstanden — weiter <Icon.Arrow /></button>
            </>
          ) : (
            <LessonCheck key={seq} step={step} topicId={topicId} onDone={(right) => advance(true, right)} />
          )}
        </div>
      </div>
    </div>
  );
}

window.LessonScreen = LessonScreen;
