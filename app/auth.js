/* global Axolotl, React, Icon */
const { useState: useStateAuth } = React;

/* ==============================================================
   ANMELDEN — ein Feld, ein Klick (Version 7, 09.08.2026).

   Für ein Kind gibt es genau EINEN Weg: Namen tippen → „Los geht's“.
   Kein Kurs-Code, kein Passwort, keine Fehlermeldung. Wer schon mal
   da war, tippt einfach seinen Namen in der Liste an.

   Antwortet der Server nicht, wird das Konto STILL auf dem Gerät
   angelegt und später automatisch verbunden — ein Kind soll nie vor
   einer technischen Meldung stehen. Für die Lehrkraft gibt es dafür
   den Knopf „🔧 Verbindung prüfen“ mit Klartext-Diagnose.
   ============================================================== */

/* Supabase bleibt Experten-Option (nur fürs Live-Duell relevant). */
function SupabaseSetupPanel({ ctx, onBack }) {
  const [url, setUrl] = React.useState('');
  const [key, setKey] = React.useState('');
  const [status, setStatus] = React.useState(null);
  const [msg, setMsg] = React.useState('');
  const cleanUrl = () => url.trim().replace(/\/+$/, '');
  const test = async () => {
    setStatus('testing'); setMsg('');
    try {
      const r = await fetch(cleanUrl() + '/auth/v1/health', { headers: { apikey: key.trim() } });
      if (r.ok) { setStatus('ok'); setMsg('Verbindung steht! ✅ Jetzt speichern.'); }
      else { setStatus('fail'); setMsg('Antwort ' + r.status + ' — prüfe URL und anon key (Project Settings → API).'); }
    } catch (e) {
      setStatus('fail'); setMsg('Keine Verbindung — ist die Projekt-URL richtig (https://…supabase.co)?');
    }
  };
  const save = () => {
    if (!cleanUrl() || !key.trim()) { setMsg('Bitte beide Felder ausfüllen.'); setStatus('fail'); return; }
    try { localStorage.setItem('app_supabase_cfg', JSON.stringify({ url: cleanUrl(), key: key.trim() })); } catch (e) {}
    location.reload();
  };
  return (
    <>
      <ModalHead title="Experten: Supabase (Live-Duell)" onClose={ctx.closeModal} />
      <div className="modal-body">
        <div className="card flat tinted" style={{ padding: 16, marginBottom: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>🔌 Nur fürs Live-Duell nötig</div>
          <div className="muted" style={{ fontSize: 13.5, lineHeight: 1.5 }}>
            Konten, Fortschritt und Klassenzimmer funktionieren <b>ohne</b> diese Einrichtung.
            Nur das Echtzeit-Duell braucht ein kostenloses Supabase-Projekt.
          </div>
        </div>
        <label className="muted" style={{ fontSize: 13, fontWeight: 700 }}>Projekt-URL</label>
        <input style={inputStyle} placeholder="https://xxxxx.supabase.co" value={url} onChange={e => setUrl(e.target.value)} />
        <label className="muted" style={{ fontSize: 13, fontWeight: 700, display: 'block', marginTop: 10 }}>anon public key</label>
        <input style={inputStyle} placeholder="eyJ…" value={key} onChange={e => setKey(e.target.value)} />
        {msg && (
          <div className="muted" style={{ marginTop: 10, fontWeight: 700, color: status === 'ok' ? 'var(--success, #1B8A5A)' : status === 'fail' ? '#D64545' : undefined }}>{msg}</div>
        )}
        <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={onBack}>← Zurück</button>
      </div>
      <div className="modal-foot">
        <div className="row" style={{ gap: 10 }}>
          <button className="btn btn-ghost btn-full" onClick={test} disabled={status === 'testing'}>
            {status === 'testing' ? 'Teste…' : '📡 Verbindung testen'}
          </button>
          <button className="btn btn-primary btn-full" onClick={save}>💾 Speichern &amp; neu laden</button>
        </div>
      </div>
    </>
  );
}

/* ---------- Klartext-Diagnose des Mini-Servers (für die Lehrkraft) ---------- */
function ServerCheckPanel({ ctx, onBack }) {
  const SS = window.SimpleSync;
  const [res, setRes] = React.useState(null);
  const [busy, setBusy] = React.useState(true);
  const run = React.useCallback(async () => {
    setBusy(true);
    setRes(await SS.diagnose());
    setBusy(false);
  }, []);
  React.useEffect(() => { run(); }, [run]);

  const okBox = res && res.ok;
  return (
    <>
      <ModalHead title="Verbindung prüfen" onClose={ctx.closeModal} />
      <div className="modal-body">
        {busy && <div className="muted" style={{ textAlign: 'center', padding: 20 }}>⏳ Prüfe alle Wege …</div>}
        {!busy && res && (
          <>
            <div className="card flat" style={{ padding: 16, marginBottom: 14, borderLeft: '5px solid ' + (okBox ? 'var(--success, #1B8A5A)' : '#D64545') }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>
                {okBox ? '✅ Alles in Ordnung' : (res.online ? '⚠️ Mini-Server antwortet nicht' : '📴 Dieses Gerät ist offline')}
              </div>
              <div className="muted" style={{ fontSize: 13.5, marginTop: 6, lineHeight: 1.55 }}>
                {okBox ? (
                  <>Der Klassen-Server läuft (Version {res.version}). Anmelden, Abgleich und
                    Klassenzimmer funktionieren. Speicher: <b>{res.storage === 'blobs' ? 'dauerhaft ✓' : res.storage}</b>.</>
                ) : res.online ? (
                  <>Die App ist aktuell, nur die kleine Server-Funktion fehlt. Netlify installiert sie
                    <b> nur bei einem Build</b> — wer Dateien auf die „Deploys“-Seite einer bestehenden
                    Website zieht, löst keinen Build aus. Lösung siehe unten.<br /><br />
                    Bis dahin läuft die App normal: anmelden, lernen, Fortschritt auf dem Gerät.
                    Nur Geräte-Abgleich und Klassenliste brauchen den Server.</>
                ) : (
                  <>Es besteht gerade keine Internetverbindung. Die Kinder können trotzdem lernen —
                    der Abgleich läuft automatisch nach, sobald wieder Netz da ist.</>
                )}
              </div>
            </div>

            {res.storage && res.storage !== 'blobs' && okBox && (
              <div className="card flat" style={{ padding: 12, marginBottom: 14, borderLeft: '4px solid #E0A800' }}>
                <div style={{ fontWeight: 800, fontSize: 13.5 }}>⚠️ Speicher nur vorübergehend</div>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.5 }}>
                  Der Server läuft, kann aber nicht dauerhaft speichern. In Netlify unter
                  <b> Site configuration → Blobs</b> nachsehen bzw. die Seite einmal neu deployen.
                </div>
              </div>
            )}

            <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 6 }}>Geprüfte Wege</div>
            {res.tried.map((t) => (
              <div key={t.base} className="row" style={{ gap: 8, alignItems: 'baseline', fontSize: 12.5, padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ width: 18 }}>{t.note.indexOf('✓') >= 0 ? '✅' : '—'}</span>
                <code style={{ flex: 1, opacity: .8, wordBreak: 'break-all' }}>{t.url}</code>
                <span className="muted">{t.status || '–'} · {t.note}</span>
              </div>
            ))}

            {!okBox && res.online && (
              <div className="card flat tinted" style={{ padding: 14, marginTop: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 6 }}>So bringst du ihn zum Laufen</div>
                <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
                  1. <b>app.netlify.com/drop</b> öffnen (nicht die Deploys-Seite der alten Website).<br />
                  2. Die ZIP-Datei dort hineinziehen — Netlify legt eine <b>neue</b> Seite an und führt
                     dabei einen Build aus. Nur dann kommt der Mini-Server mit.<br />
                  3. Warten bis „Published“, dann die neue Adresse + <b>/check.html</b> öffnen.<br />
                  4. Dauerhaft am saubersten: die Seite einmal mit <b>GitHub</b> verbinden.
                </div>
              </div>
            )}
          </>
        )}
        <div className="card flat" style={{ padding: 14, marginTop: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 13.5 }}>📦 Laufende Version</div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.5 }}>
            {window.APP_VERSION || '—'}<br />
            Steht hier eine ältere Version als die gerade hochgeladene, hat der Browser noch
            alte Dateien gespeichert. Der Knopf unten räumt sie weg und lädt die App neu.
          </div>
          <button className="btn btn-ghost btn-full" style={{ marginTop: 10 }}
                  onClick={() => window.forceAppUpdate && window.forceAppUpdate()}>
            🔄 App aktualisieren (Zwischenspeicher leeren)
          </button>
          <button className="btn btn-ghost btn-full" style={{ marginTop: 8 }}
                  onClick={() => { try { window.open('check.html', '_blank'); } catch (e) { location.href = 'check.html'; } }}>
            🩺 Große Prüfseite öffnen (check.html)
          </button>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Die Prüfseite läuft ohne die App und zeigt sofort, welche Version wirklich
            auf dem Server liegt. Auch direkt erreichbar: <b>…/check.html</b>
          </div>
        </div>
        <button className="btn btn-ghost" style={{ marginTop: 14 }} onClick={onBack}>← Zurück</button>
      </div>
      <div className="modal-foot">
        <button className="btn btn-primary btn-full" onClick={run} disabled={busy}>🔄 Nochmal prüfen</button>
      </div>
    </>
  );
}

function AuthModal({ ctx }) {
  const SS = window.SimpleSync;
  // Prüfhaken: ?pruef=1&ansicht=lehrer öffnet direkt die Lehrkraft-Ansicht (nur zum Anschauen)
  const [view, setView] = useStateAuth(() => { try { const q = new URLSearchParams(location.search); return (q.get('pruef') === '1' && q.get('ansicht')) || 'main'; } catch (e) { return 'main'; } }); // main | expert | check | lehrer | code
  const [name, setName] = useStateAuth(() => {
    const a = SS && SS.account();
    return (a && a.name) || '';
  });
  const [pass, setPass] = useStateAuth('');
  const [needPass, setNeedPass] = useStateAuth(false);
  const [showExtra, setShowExtra] = useStateAuth(false);
  const [classCode, setClassCode] = useStateAuth(() => {
    const a = SS && SS.account();
    const c = (a && a.classCode) || '';
    return c === (SS && SS.DEFAULT_CLASS) ? '' : c;
  });
  const [teacher, setTeacher] = useStateAuth(false);
  /* (11.0) Klassen-Code: aus der Adresse (?klasse=1234, z. B. vom Aushang), sonst
     aus dem Konto oder dem Zwischenspeicher. Vier Ziffern, live nachgeschlagen. */
  const [code, setCode] = useStateAuth(() => {
    let p = ''; try { p = new URLSearchParams(location.search).get('klasse') || ''; } catch (e) {}
    const a = SS && SS.account(); const k = SS && SS.classInfo ? SS.classInfo() : null;
    return /^\d{4}$/.test(p) ? p : (a && /^\d{4}$/.test(String(a.classCode || ''))) ? a.classCode : (k && k.code) || '';
  });
  const [codeInfo, setCodeInfo] = useStateAuth(null);
  React.useEffect(() => {
    if (!/^\d{4}$/.test(code) || !SS || !SS.lookupClass) { setCodeInfo(null); return undefined; }
    let dead = false;
    const t = setTimeout(() => { SS.lookupClass(code).then(r => { if (!dead) setCodeInfo(r); }); }, 250);
    return () => { dead = true; clearTimeout(t); };
  }, [code]);
  // Lehrkraft: Klassenzimmer anlegen / öffnen
  const [tKlasse, setTKlasse] = useStateAuth('');
  const [tName, setTName] = useStateAuth('');
  const [tPin, setTPin] = useStateAuth('');
  const [tPin2, setTPin2] = useStateAuth('');
  const [tCode, setTCode] = useStateAuth('');
  const [tLoginPin, setTLoginPin] = useStateAuth('');
  const [neuCode, setNeuCode] = useStateAuth('');
  const [teacherPw, setTeacherPw] = useStateAuth('');
  const [busy, setBusy] = useStateAuth(false);
  const [err, setErr] = useStateAuth('');
  const [okMsg, setOkMsg] = useStateAuth('');
  const [notice, setNotice] = useStateAuth('');
  const [names, setNames] = useStateAuth([]);
  const [, force] = useStateAuth(0);

  const acc = SS && SS.account();
  const st = SS && SS.status();
  const klasse = SS && SS.classInfo ? SS.classInfo() : null;
  const installLink = (c) => location.origin + location.pathname.replace(/[^/]*$/, '') + 'installieren.html?klasse=' + c;
  const teilenKlasse = (c) => {
    const txt = 'Unser Koran-Kurs bei Elif & Ba 🌙\nKlassen-Code: ' + c + '\nApp installieren: ' + installLink(c);
    if (navigator.share) navigator.share({ title: 'Elif & Ba', text: txt }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => { setOkMsg('Kopiert ✅'); setTimeout(() => setOkMsg(''), 2000); }).catch(() => {});
  };

  // Bekannte Namen holen, damit Kinder ihren Namen nur antippen müssen.
  React.useEffect(() => {
    let dead = false;
    if (SS && SS.listNames && !acc) SS.listNames().then(l => { if (!dead) setNames(l || []); });
    return () => { dead = true; };
  }, []);

  if (view === 'expert') return <SupabaseSetupPanel ctx={ctx} onBack={() => setView('main')} />;
  if (view === 'check') return <ServerCheckPanel ctx={ctx} onBack={() => setView('main')} />;

  /* ---------- Lehrkraft: Klassenzimmer anlegen oder öffnen (11.0) ---------- */
  if (view === 'lehrer') {
    const anlegen = async () => {
      setErr('');
      if (tKlasse.trim().length < 2) { setErr('Wie heißt die Klasse? Zum Beispiel „Klasse 3b" oder „Samstagskurs".'); return; }
      if (tName.trim().length < 2) { setErr('Bitte deinen Namen eingeben — den sehen die Kinder.'); return; }
      if (!/^\d{4,8}$/.test(tPin)) { setErr('Die PIN braucht 4 bis 8 Ziffern.'); return; }
      if (tPin !== tPin2) { setErr('Die beiden PINs sind nicht gleich.'); return; }
      setBusy(true); const r = await SS.createClass({ name: tKlasse.trim(), teacher: tName.trim(), pin: tPin }); setBusy(false);
      if (r.ok) { setNeuCode(r.code); setView('code'); } else setErr(r.error || 'Das hat nicht geklappt.');
    };
    const oeffnen = async () => {
      setErr('');
      if (!/^\d{4}$/.test(tCode)) { setErr('Der Klassen-Code hat vier Ziffern.'); return; }
      if (!tLoginPin) { setErr('Bitte die PIN eingeben.'); return; }
      setBusy(true); const r = await SS.teacherLogin(tCode, tLoginPin); setBusy(false);
      if (r.ok) { ctx.closeModal(); ctx.go && ctx.go('teacher'); } else setErr(r.error || 'Das hat nicht geklappt.');
    };
    return (
      <>
        <ModalHead title="Für Lehrkräfte" onClose={ctx.closeModal} />
        <div className="modal-body">
          <button className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }} onClick={() => { setErr(''); setView('main'); }}>← Zurück</button>
          <div className="card flat" style={{ padding: 16 }}>
            <div style={{ fontWeight: 900, fontSize: 17 }}>🆕 Neues Klassenzimmer anlegen</div>
            <div className="muted" style={{ fontSize: 13, margin: '4px 0 12px', lineHeight: 1.45 }}>
              Du bekommst einen <b>Code mit vier Ziffern</b>. Den gibst du den Kindern — sie tippen beim
              Anmelden Namen und Code ein und sind in deiner Klasse. Mehr ist es nicht.
            </div>
            <label className="feld">Name der Klasse
              <input value={tKlasse} onChange={e => setTKlasse(e.target.value)} placeholder="z. B. Klasse 3b oder Samstagskurs" style={inputStyle} />
            </label>
            <label className="feld">Dein Name (sehen die Kinder)
              <input value={tName} onChange={e => setTName(e.target.value)} placeholder="z. B. Frau Yılmaz" style={inputStyle} />
            </label>
            <div className="row" style={{ gap: 8 }}>
              <label className="feld" style={{ flex: 1 }}>PIN (4 Ziffern)
                <input type="password" inputMode="numeric" value={tPin} onChange={e => setTPin(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="••••" style={inputStyle} />
              </label>
              <label className="feld" style={{ flex: 1 }}>PIN wiederholen
                <input type="password" inputMode="numeric" value={tPin2} onChange={e => setTPin2(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="••••" style={inputStyle} />
              </label>
            </div>
            <div className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>Mit Code + PIN öffnest du dein Klassenzimmer auf jedem Gerät. Die PIN kennst nur du.</div>
            <button className="btn btn-primary btn-full" disabled={busy} onClick={anlegen}>{busy ? 'Einen Moment…' : 'Klassenzimmer anlegen'}</button>
          </div>
          <div className="card flat" style={{ padding: 16, marginTop: 12 }}>
            <div style={{ fontWeight: 900, fontSize: 17 }}>🔑 Mein Klassenzimmer öffnen</div>
            <div className="muted" style={{ fontSize: 13, margin: '4px 0 10px' }}>Du hast schon eins? Code und PIN eingeben.</div>
            <div className="row" style={{ gap: 8 }}>
              <input inputMode="numeric" value={tCode} onChange={e => setTCode(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Code" style={{ ...inputStyle, flex: 1, textAlign: 'center', letterSpacing: 4, fontWeight: 900 }} />
              <input type="password" inputMode="numeric" value={tLoginPin} onChange={e => setTLoginPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && oeffnen()} placeholder="PIN" style={{ ...inputStyle, flex: 1, textAlign: 'center' }} />
            </div>
            <button className="btn btn-ghost btn-full" style={{ marginTop: 10 }} disabled={busy} onClick={oeffnen}>Öffnen</button>
          </div>
          {err && <div style={{ color: 'var(--rose)', fontWeight: 700, fontSize: 13.5, marginTop: 10, textAlign: 'center' }}>{err}</div>}
          <details style={{ marginTop: 14 }}>
            <summary className="muted" style={{ fontSize: 12.5, cursor: 'pointer' }}>Alter Weg: Sammelklasse mit Lehrer-Passwort</summary>
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Dein Name" style={{ ...inputStyle, flex: 1 }} />
              <input type="password" value={teacherPw} onChange={e => setTeacherPw(e.target.value)} placeholder="Lehrer-Passwort" style={{ ...inputStyle, flex: 1 }} />
            </div>
            <button className="btn btn-ghost btn-full" style={{ marginTop: 8 }} disabled={busy} onClick={() => { setTeacher(true); setCode(''); setTimeout(() => submit(), 0); }}>Als Lehrkraft der Sammelklasse anmelden</button>
          </details>
        </div>
      </>
    );
  }
  if (view === 'code') {
    return (
      <>
        <ModalHead title="Dein Klassenzimmer steht" onClose={ctx.closeModal} />
        <div className="modal-body" style={{ textAlign: 'center' }}>
          <div style={{ display: 'grid', placeItems: 'center' }}><Axolotl size={100} mood="cheer"/></div>
          <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>Das ist der Code für deine Kinder:</div>
          <div className="klassen-code">{neuCode}</div>
          <div className="muted" style={{ fontSize: 13.5, lineHeight: 1.45 }}>
            Die Kinder öffnen die App, tippen <b>Namen</b> und diesen <b>Code</b> ein — fertig, sie sind in deiner
            Klasse. Schreib ihn an die Tafel oder schick ihn in die Eltern-Gruppe.
          </div>
          {okMsg && <div style={{ color: 'var(--success-3)', fontWeight: 800, marginTop: 8 }}>{okMsg}</div>}
          <div className="col" style={{ gap: 8, marginTop: 14 }}>
            <button className="btn btn-ghost btn-full" onClick={() => teilenKlasse(neuCode)}>📤 Code + Installier-Link teilen</button>
            <a className="btn btn-ghost btn-full" href={installLink(neuCode)} target="_blank" rel="noopener">🖨️ Aushang für die Klassentür</a>
            <button className="btn btn-primary btn-full btn-lg" onClick={() => { ctx.closeModal(); ctx.go && ctx.go('teacher'); }}>Zum Klassenzimmer</button>
          </div>
        </div>
      </>
    );
  }

  /* ---------- schon angemeldet ---------- */
  if (acc) {
    const stateTxt = st.state === 'syncing' ? '⏳ Wird gerade abgeglichen …'
      : st.state === 'lokal' ? '📱 Nur auf diesem Gerät gespeichert — verbindet sich automatisch, sobald der Server da ist.'
      : st.state === 'offline' ? '📴 Offline — Abgleich startet automatisch, sobald Internet da ist.'
      : st.state === 'error' ? '⚠️ ' + (st.error || 'Abgleich fehlgeschlagen') + ' — dein Fortschritt ist auf dem Gerät sicher, die App versucht es automatisch weiter.'
      : st.lastSync ? '✅ Fortschritt gesichert (zuletzt ' + new Date(st.lastSync).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr)'
      : '🔄 Erster Abgleich läuft gleich …';
    return (
      <>
        <ModalHead title="Dein Konto" onClose={ctx.closeModal} />
        <div className="modal-body">
          <div className="card flat tinted" style={{ padding: 18, textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 44 }}>{acc.role === 'teacher' ? '🧑‍🏫' : '🧒'}</div>
            <div style={{ fontWeight: 900, fontSize: 22, marginTop: 4 }}>{acc.name}</div>
            {acc.role === 'teacher' && <div className="pill" style={{ marginTop: 6 }}>Lehrkraft · alle Lektionen offen</div>}
            <div className="muted" style={{ fontSize: 13.5, marginTop: 8 }}>{stateTxt}</div>
          </div>
          {acc.role === 'teacher' && (
            <button className="btn btn-primary btn-full btn-lg" style={{ marginBottom: 14 }}
                    onClick={() => { ctx.closeModal(); ctx.go && ctx.go('teacher'); }}>
              🏫 Klassenzimmer öffnen
            </button>
          )}
          {klasse ? (
            <div className="card flat tinted" style={{ padding: 14, textAlign: 'center' }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>🏫 {klasse.name}</div>
              <div className="muted" style={{ fontSize: 13 }}>
                {acc.role === 'teacher' ? 'Dein Klassen-Code für die Kinder:' : 'bei ' + (klasse.teacher || 'deiner Lehrkraft') + ' · Code ' + klasse.code}
              </div>
              {acc.role === 'teacher' && <div className="klassen-code" style={{ margin: '4px 0 8px' }}>{klasse.code}</div>}
              {acc.role === 'teacher' && <button className="btn btn-ghost" onClick={() => teilenKlasse(klasse.code)}>📤 Code + Installier-Link teilen</button>}
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 13, textAlign: 'center' }}>Du bist in der Sammelklasse — ohne Klassen-Code.</div>
          )}
          {acc.role !== 'teacher' && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>{klasse ? 'Klasse wechseln' : 'Klassen-Code eingeben'}</div>
              <div className="row" style={{ gap: 8 }}>
                <input inputMode="numeric" maxLength={4} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                       placeholder="Code (4 Ziffern)" style={{ ...inputStyle, flex: 1, textAlign: 'center', letterSpacing: 3, fontWeight: 800 }} />
                <button className="btn btn-primary" disabled={code.length !== 4 || !(codeInfo && codeInfo.found)} onClick={async () => {
                  await SS.setClassCode(code);
                  setOkMsg('Gespeichert! ✅'); setTimeout(() => setOkMsg(''), 2500); force(x => x + 1);
                }}>Speichern</button>
              </div>
              {code.length === 4 && codeInfo && (
                <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>{codeInfo.found ? '✅ ' + codeInfo.name + (codeInfo.teacher ? ' bei ' + codeInfo.teacher : '') : '❌ Diesen Code gibt es nicht.'}</div>
              )}
            </div>
          )}
          {okMsg && <div style={{ color: 'var(--success-3)', fontWeight: 700, marginTop: 8 }}>{okMsg}</div>}
          <div className="row" style={{ gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={() => SS.syncNow()}>🔄 Jetzt abgleichen</button>
            <button className="btn btn-ghost" onClick={() => setView('check')}>🔧 Verbindung prüfen</button>
            <button className="btn btn-ghost" style={{ color: 'var(--rose, #D64545)' }} onClick={() => { SS.logout(); force(x => x + 1); }}>
              Abmelden
            </button>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 14 }}>
            Dein Fortschritt bleibt auf diesem Gerät gespeichert — beim Abmelden geht nichts verloren.
          </div>
          <button className="btn btn-ghost" style={{ marginTop: 10, fontSize: 12.5, opacity: .75 }} onClick={() => setView('expert')}>
            ⚙️ Experten: Supabase fürs Live-Duell
          </button>
          <div className="muted" style={{ textAlign: 'center', fontSize: 11.5, marginTop: 10, opacity: .7 }}>{window.APP_VERSION || ''}</div>
        </div>
      </>
    );
  }

  /* ---------- Anmelden ---------- */
  const submit = async (overrideName) => {
    const n = String(overrideName == null ? name : overrideName).trim();
    setErr(''); setNotice('');
    if (n.length < 2) { setErr('Bitte gib deinen Namen ein (mindestens 2 Buchstaben).'); return; }
    if (teacher && teacherPw.trim() === '') { setErr('Bitte das Lehrer-Passwort eingeben.'); return; }
    if (code && code.length < 4) { setErr('Der Klassen-Code hat vier Ziffern — oder lass ihn leer.'); return; }
    setBusy(true);
    const res = await SS.join(n, pass.trim(), { classCode: code || classCode.trim(), teacher, teacherPw: teacherPw.trim() });
    setBusy(false);
    if (res.ok) {
      window.Sound && window.Sound.streakSecured && window.Sound.streakSecured();
      ctx.closeModal();
      return;
    }
    if (res.needPass) {
      setNeedPass(true);
      setErr(res.error || 'Für diesen Namen gibt es ein Geheimwort — bitte eingeben.');
      return;
    }
    setErr(res.error || 'Das hat nicht geklappt — bitte nochmal versuchen.');
  };

  const known = names.filter(x => x && x.name);
  return (
    <>
      <ModalHead title="Anmelden" onClose={ctx.closeModal} />
      <div className="modal-body">
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          {/* (11.0) Axi begrüßt — statt eines stummen Mond-Emojis */}
          <div style={{ display: 'grid', placeItems: 'center', marginBottom: 2 }}><Axolotl size={108} mood="happy"/></div>
          <div style={{ fontWeight: 900, fontSize: 20 }}>Wie heißt du?</div>
          <div className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>
            Namen eintippen und los — mehr braucht es nicht. Du bist dann sofort im Kurs
            und dein Fortschritt ist auf jedem Gerät wieder da.
          </div>
          <div className="gemeinde-zeile">
            <GemeindeLogo size={40}/>
            <span>Koran-Kurs{window.GEMEINDE_NAME ? <b>{window.GEMEINDE_NAME}</b> : null}</span>
          </div>
        </div>
        <input value={name} onChange={e => setName(e.target.value)} autoFocus
               onKeyDown={e => e.key === 'Enter' && submit()}
               placeholder="Dein Name, z. B. Amina"
               style={{ ...inputStyle, fontSize: 18, textAlign: 'center', fontWeight: 700 }} />
        <div className="code-block">
          <div className="code-titel">🏫 Klassen-Code <span className="muted">(von deiner Lehrkraft)</span></div>
          <input inputMode="numeric" pattern="[0-9]*" maxLength={4} value={code}
                 onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                 onKeyDown={e => e.key === 'Enter' && submit()}
                 placeholder="0000" className="code-eingabe" aria-label="Klassen-Code" />
          <div className={'code-stand' + (codeInfo && codeInfo.found ? ' ist-ok' : (codeInfo && !codeInfo.error && code.length === 4) ? ' ist-falsch' : '')}>
            {code.length < 4 ? 'Keinen Code bekommen? Dann leer lassen.'
              : !codeInfo ? 'Suche Klasse…'
              : codeInfo.found ? '✅ ' + codeInfo.name + (codeInfo.teacher ? ' bei ' + codeInfo.teacher : '')
              : codeInfo.error ? 'Gerade keine Verbindung — der Code wird beim Anmelden geprüft.'
              : '❌ Diesen Code gibt es nicht. Frag deine Lehrkraft.'}
          </div>
        </div>
        {(needPass || pass) && (
          <input type="password" value={pass} onChange={e => setPass(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && submit()}
                 placeholder="Geheimwort" style={{ ...inputStyle, marginTop: 8, textAlign: 'center' }} />
        )}
        {err && <div style={{ color: 'var(--rose, #D64545)', fontWeight: 700, fontSize: 13.5, marginTop: 8, textAlign: 'center' }}>{err}</div>}
        {notice && <div className="muted" style={{ fontSize: 12.5, marginTop: 8, textAlign: 'center' }}>{notice}</div>}

        {known.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div className="muted" style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6, textAlign: 'center' }}>
              Schon mal dabei gewesen? Tipp deinen Namen an:
            </div>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
              {known.slice(0, 40).map(x => (
                <button key={x.name} className="pill" style={{ cursor: 'pointer', border: '1px solid var(--line)', background: 'var(--surface)' }}
                        onClick={() => { setName(x.name); if (!x.hasPass) submit(x.name); else setNeedPass(true); }}>
                  {x.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <button className="btn btn-ghost btn-full" style={{ marginTop: 14 }} onClick={() => { setErr(''); setView('lehrer'); }}>🧑‍🏫 Ich bin Lehrkraft</button>
        <button className="btn btn-ghost" style={{ marginTop: 10, fontSize: 13 }} onClick={() => setShowExtra(s => !s)}>
          {showExtra ? '▴ Weniger' : '▾ Mehr (Geheimwort)'}
        </button>
        {showExtra && !needPass && (
          <div className="card flat" style={{ padding: 14, marginTop: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 13.5 }}>🔒 Geheimwort (optional)</div>
            <div className="muted" style={{ fontSize: 12.5, margin: '2px 0 6px' }}>
              Nur wenn du dein Konto schützen willst — sonst einfach leer lassen.
            </div>
            <input type="password" value={pass} onChange={e => setPass(e.target.value)}
                   placeholder="Leer lassen = ohne Geheimwort" style={inputStyle} />
          </div>
        )}
        <div className="row" style={{ gap: 10, marginTop: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" style={{ fontSize: 12, opacity: .8 }} onClick={() => setView('check')}>🔧 Verbindung prüfen</button>
          <button className="btn btn-ghost" style={{ fontSize: 12, opacity: .7 }} onClick={() => setView('expert')}>⚙️ Experten</button>
        </div>
        <div className="muted" style={{ textAlign: 'center', fontSize: 11.5, marginTop: 8, opacity: .7 }}>{window.APP_VERSION || ''}</div>
      </div>
      <div className="modal-foot">
        <button className="btn btn-primary btn-full btn-lg" disabled={busy} onClick={() => submit()}>
          {busy ? 'Einen Moment…' : 'Los geht’s! 🚀'}
        </button>
      </div>
    </>
  );
}

const inputStyle = { width: '100%', padding: 14, fontSize: 15, borderRadius: 14, border: '1px solid var(--line)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box' };

window.AuthModal = AuthModal;
window.ServerCheckPanel = ServerCheckPanel;
