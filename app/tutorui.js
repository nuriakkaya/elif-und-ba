/* global React, MiniAxolotl, Icon */
/* ==============================================================
   KI-TUTOR (Oberfläche) — app/tutorui.js   ·  NEU 03.08.2026

   Gegenstück zu app/tutor.js (Logik). Enthält drei Bausteine:

   TutorMarkdown  — rendert die Blockliste aus Tutor.mdBlocks() als
                    echte React-Knoten. Bewusst OHNE
                    dangerouslySetInnerHTML: Modelltext wird nie als
                    HTML interpretiert, damit aus einer Modellantwort
                    kein Markup in die Seite gelangen kann.

   TutorPanel     — das Herzstück: strukturierte Erklärung zur Karte,
                    darunter "Mehr Details" und "Stelle eine Frage"
                    (freies Nachfragen mit Gesprächsverlauf), plus drei
                    Vorschlags-Chips wie im Original.

   TutorCollapse  — zusammengeklappte Variante für Stellen, an denen
                    der Tutor nicht sofort aufgehen soll (Lektion,
                    Runden-Log): erst ein Knopf, dann das Panel.

   Warum blockweises Einblenden statt Zeichen-für-Zeichen?
   Unser Endpunkt liefert die Antwort am Stück (kein Streaming). Ein
   Zeichen-für-Zeichen-Effekt über Markdown würde mitten in einer
   **Fettung** brechen und flackern. Stattdessen wird die fertige
   Antwort blockweise eingeblendet (~140 ms) — das wirkt wie Tippen,
   zeigt aber nie kaputtes Markup.
   ============================================================== */

/* Ein Textabschnitt mit Auszeichnungen (fett/kursiv/code). */
function tutorSpans(text) {
  return window.Tutor.mdInline(text).map((s, i) => {
    if (s.b) return <b key={i}>{s.text}</b>;
    if (s.i) return <i key={i}>{s.text}</i>;
    if (s.code) return <code key={i} className="tutor-code">{s.text}</code>;
    return <React.Fragment key={i}>{s.text}</React.Fragment>;
  });
}

function TutorMarkdown({ md, reveal }) {
  const blocks = React.useMemo(() => window.Tutor.mdBlocks(md), [md]);
  const [shown, setShown] = React.useState(reveal ? 0 : blocks.length);

  React.useEffect(() => {
    if (!reveal) { setShown(blocks.length); return undefined; }
    setShown(1);
    let i = 1;
    const t = setInterval(() => {
      i++;
      setShown(i);
      if (i >= blocks.length) clearInterval(t);
    }, 140);
    return () => clearInterval(t);
  }, [md, reveal, blocks.length]);

  return (
    <div className="tutor-md">
      {blocks.slice(0, Math.max(1, shown)).map((b, i) => {
        if (b.t === 'h') return <div key={i} className="tutor-h">{tutorSpans(b.text)}</div>;
        if (b.t === 'note') return <div key={i} className="tutor-note">{tutorSpans(b.text)}</div>;
        if (b.t === 'ul') return <ul key={i} className="tutor-list">{b.items.map((it, j) => <li key={j}>{tutorSpans(it)}</li>)}</ul>;
        if (b.t === 'ol') return <ol key={i} className="tutor-list">{b.items.map((it, j) => <li key={j}>{tutorSpans(it)}</li>)}</ol>;
        return <p key={i}>{tutorSpans(b.text)}</p>;
      })}
    </div>
  );
}

/* Vorschläge fürs Nachfragen — im Original stehen unter der Erklärung
   ebenfalls fertige Einstiege, weil die meisten Leute sonst nicht wissen,
   was sie den Tutor fragen sollen. */
const TUTOR_CHIPS = ['Warum ist das so?', 'Gib mir ein Beispiel', 'Wie merke ich mir das?'];

function TutorPanel({ card, topicId, answerTxt, wrong, auto, compact }) {
  const [text, setText] = React.useState('');
  const [source, setSource] = React.useState('');
  const [loading, setLoading] = React.useState(!!auto);
  const [level, setLevel] = React.useState('kurz');
  const [chat, setChat] = React.useState([]);          // { role:'user'|'assistant', text }
  const [asking, setAsking] = React.useState(false);   // Eingabefeld sichtbar?
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const aliveRef = React.useRef(true);
  React.useEffect(() => () => { aliveRef.current = false; }, []);

  const opts = { topicId, answerTxt, wrong };

  const loadExplain = React.useCallback(async (lvl) => {
    setLoading(true);
    const r = await window.Tutor.explainCard(card, { ...opts, level: lvl });
    if (!aliveRef.current) return;
    setText(r.text);
    setSource(r.source);
    setLevel(lvl);
    setLoading(false);
  }, [card, topicId, answerTxt]);

  React.useEffect(() => { if (auto) loadExplain('kurz'); }, [auto, loadExplain]);

  const send = async (qRaw) => {
    const q = (qRaw == null ? input : qRaw).trim();
    if (!q || busy) return;
    setInput('');
    setAsking(true);
    const history = chat.slice();
    setChat([...history, { role: 'user', text: q }, { role: 'assistant', text: '' }]);
    setBusy(true);
    const r = await window.Tutor.askAboutCard(card, { ...opts, question: q, history });
    if (!aliveRef.current) return;
    setChat(c => {
      const copy = c.slice();
      copy[copy.length - 1] = { role: 'assistant', text: r.text, fresh: true };
      return copy;
    });
    setBusy(false);
  };

  return (
    <div className={'tutor-panel' + (compact ? ' is-compact' : '')}>
      <div className="tutor-head">
        <div className="mini-mascot"><MiniAxolotl size={26} /></div>
        <div className="tutor-title">KI-Tutor</div>
        {source === 'offline' && <span className="tutor-src" title="Ohne Online-Backend erklärt der Tutor aus dem Kartenmaterial.">Offline-Erklärung</span>}
        {source === 'cache' && <span className="tutor-src">gespeichert</span>}
      </div>

      <div className="tutor-body">
        {loading && !text
          ? <span className="spinner-dots"><span /><span /><span /></span>
          : <TutorMarkdown md={text} reveal={source === 'ki'} />}
      </div>

      {!loading && text && (
        <div className="tutor-actions">
          {level === 'kurz' && (
            <button className="tutor-act" onClick={() => loadExplain('detail')}>📖 Mehr Details</button>
          )}
          {!asking && (
            <button className="tutor-act" onClick={() => setAsking(true)}>💬 Stelle eine Frage</button>
          )}
        </div>
      )}

      {chat.length > 0 && (
        <div className="tutor-chat">
          {chat.map((m, i) => m.role === 'user' ? (
            <div key={i} className="tutor-q">{m.text}</div>
          ) : (
            <div key={i} className="tutor-a">
              {m.text ? <TutorMarkdown md={m.text} reveal={!!m.fresh} /> : <span className="spinner-dots"><span /><span /><span /></span>}
            </div>
          ))}
        </div>
      )}

      {asking && (
        <div className="tutor-ask">
          {chat.length === 0 && (
            <div className="tutor-chips">
              {TUTOR_CHIPS.map(c => (
                <button key={c} className="tutor-chip" disabled={busy} onClick={() => send(c)}>{c}</button>
              ))}
            </div>
          )}
          <div className="tutor-ask-row">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send(); }}
              placeholder="Frag den Tutor zu dieser Karte…"
              aria-label="Frage an den KI-Tutor"
            />
            <button className="tutor-send" onClick={() => send()} disabled={busy || !input.trim()} aria-label="Frage senden">
              <Icon.Arrow />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* Zusammengeklappt: erst ein Knopf, das Panel lädt erst beim Öffnen.
   Wichtig, weil sonst jede Inhaltskarte einer Lektion sofort einen
   Modellaufruf auslösen würde. */
function TutorCollapse({ card, topicId, answerTxt, label }) {
  const [open, setOpen] = React.useState(false);
  if (!open) {
    return (
      <button className="btn btn-ghost btn-full tutor-open" onClick={() => setOpen(true)}>
        🦉 {label || 'Tutor erklärt dir das'}
      </button>
    );
  }
  return <TutorPanel card={card} topicId={topicId} answerTxt={answerTxt} auto />;
}

window.TutorMarkdown = TutorMarkdown;
window.TutorPanel = TutorPanel;
window.TutorCollapse = TutorCollapse;
