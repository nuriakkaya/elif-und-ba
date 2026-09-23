/* global React */
// Icons & mascot — pure SVG, no external assets
const { useId } = React;

// 2D outline icons (lucide-ish, 24px)
const Icon = {
  Home: (p) => (<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/></svg>),
  Swords: (p) => (<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6"/><path d="m16 16 4 4"/><path d="m19 21 2-2"/><path d="M14.5 6.5 18 3h3v3l-3.5 3.5"/><path d="m5 14 4 4"/><path d="m7 17-3 3"/><path d="m3 19 2 2"/></svg>),
  School: (p) => (<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14 22v-4a2 2 0 1 0-4 0v4"/><path d="m18 10 4 2v10H2V12l4-2"/><path d="M18 5v17"/><path d="m4 6 8-4 8 4"/><path d="M6 5v17"/><circle cx="12" cy="9" r="2"/></svg>),
  Flame: (p) => (<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3c.5 4 4 4.5 4 8.5A4 4 0 0 1 12 16a3 3 0 0 1-3-3c0-1.5 1-2 1-3.5 0-2-1-3-3-3.5 1 3-2 4-2 7a7 7 0 0 0 14 0c0-5-4-6-5-10z"/></svg>),
  Folder: (p) => (<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>),
  Globe: (p) => (<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14 0 18M12 3c-3 3.5-3 14 0 18"/></svg>),
  Bell: (p) => (<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 8a6 6 0 0 1 12 0c0 4 2 5 2 7H4c0-2 2-3 2-7z"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>),
  Plus: (p) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" {...p}><path d="M12 5v14M5 12h14"/></svg>),
  Search: (p) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>),
  Close: (p) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" {...p}><path d="M6 6l12 12M18 6 6 18"/></svg>),
  Back: (p) => (<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m15 5-7 7 7 7"/></svg>),
  Arrow: (p) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12h14M13 5l7 7-7 7"/></svg>),
  Caret: (p) => (<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m9 6 6 6-6 6"/></svg>),
  ChevDown: (p) => (<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m6 9 6 6 6-6"/></svg>),
  More: (p) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" {...p}><circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/></svg>),
  Upload: (p) => (<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3v13M7 8l5-5 5 5"/><path d="M5 21h14"/></svg>),
  Youtube: (p) => (<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" {...p}><rect x="2" y="6" width="20" height="12" rx="3"/><path d="m10 9 6 3-6 3z" fill="currentColor"/></svg>),
  Share: (p) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 13v6h14v-6"/></svg>),
  History: (p) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 12a8 8 0 1 0 2-5.3L4 9"/><path d="M4 4v5h5"/><path d="M12 8v5l3 2"/></svg>),
  Check: (p) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m5 12 5 5L20 7"/></svg>),
  Crown: (p) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" {...p}><path d="m3 17 2-10 5 5 2-8 2 8 5-5 2 10z" fill="currentColor"/><path d="M3 17h18v3H3z"/></svg>),
  Coin: (p) => (<svg viewBox="0 0 24 24" width="20" height="20" {...p}><defs><linearGradient id={"g"+(p.id||"c")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F0B12C"/><stop offset="1" stopColor="#C97D14"/></linearGradient></defs><circle cx="12" cy="12" r="9" fill={`url(#g${p.id||"c"})`}/><circle cx="12" cy="12" r="6" fill="#FFD15A"/><path d="M9 12h6M12 9v6" stroke="#9A5A0C" strokeWidth="1.8" strokeLinecap="round"/></svg>),
  Gem: (p) => (<svg viewBox="0 0 24 24" width="20" height="20" {...p}><defs><linearGradient id={"gg"+(p.id||"g")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#B6C0DA"/><stop offset="1" stopColor="#6E7A99"/></linearGradient></defs><path d="M6 4h12l4 5-10 13L2 9z" fill={`url(#gg${p.id||"g"})`} stroke="#3C4663" strokeWidth=".8" strokeLinejoin="round"/><path d="M6 4 12 9l6-5M2 9h20M12 9 8 22M12 9l4 13" stroke="#3C4663" strokeWidth=".6" fill="none"/></svg>),
  Gamepad: (p) => (<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" {...p}><path d="M7 7h10a4 4 0 0 1 4 4v3a3 3 0 0 1-5.3 2L14 14H10l-1.7 2A3 3 0 0 1 3 14v-3a4 4 0 0 1 4-4zm-.5 4.5h2v-2h-1v1h-1zm0 0v1h1v1h1v-1h1v-1h-1v-1m6 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm2 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/></svg>),
  Sparkle: (p) => (<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" {...p}><path d="M12 2 13.5 9 21 10.5 13.5 12 12 19 10.5 12 3 10.5 10.5 9z"/></svg>),
  Heart: (p) => (<svg viewBox="0 0 24 24" width="20" height="20" {...p}><defs><linearGradient id={"hh"+(p.id||"h")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7BC6F2"/><stop offset="1" stopColor="#3E7FD0"/></linearGradient></defs><path d="M12 21c-7-4.5-9-9-9-12.5C3 5 5.5 3 8 3c1.6 0 3 .8 4 2 1-1.2 2.4-2 4-2 2.5 0 5 2 5 5.5C21 12 19 16.5 12 21z" fill={`url(#hh${p.id||"h"})`} stroke="#1F4A87" strokeWidth=".6"/></svg>),
  Key: (p) => (<svg viewBox="0 0 24 24" width="20" height="20" {...p}><defs><linearGradient id={"kk"+(p.id||"k")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F8D26A"/><stop offset="1" stopColor="#C98610"/></linearGradient></defs><circle cx="7.5" cy="9.5" r="4" fill={`url(#kk${p.id||"k"})`} stroke="#7A4F00" strokeWidth=".6"/><path d="M10.5 11 22 22.5l-2 2L8 13z" fill={`url(#kk${p.id||"k"})`} stroke="#7A4F00" strokeWidth=".6"/><circle cx="7.5" cy="9.5" r="1.5" fill="#fff"/></svg>),
  Book: (p) => (<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" {...p}><path d="M3 5h8v15H4a1 1 0 0 1-1-1z"/><path d="M21 5h-8v15h7a1 1 0 0 0 1-1z" opacity=".7"/></svg>),
  Link: (p) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}><path d="M10 14a4 4 0 0 1 0-6l3-3a4 4 0 1 1 6 6l-1 1"/><path d="M14 10a4 4 0 0 1 0 6l-3 3a4 4 0 1 1-6-6l1-1"/></svg>),
  Sort: (p) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M7 4v16M7 4l-3 3M7 4l3 3"/><path d="M17 20V4M17 20l-3-3M17 20l3-3"/></svg>),
  FolderPlus: (p) => (<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 11v6M9 14h6"/></svg>),
  Wave: (p) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" {...p}><path d="M14.5 2.5a2 2 0 1 1 3 2.5L15 8l4 4a3 3 0 1 1-4 4l-5-5a3 3 0 0 1 0-4z"/></svg>),
  Lock: (p) => (<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>),
  Dice: (p) => (<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.3" fill="currentColor"/><circle cx="16" cy="8" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="8" cy="16" r="1.3" fill="currentColor"/><circle cx="16" cy="16" r="1.3" fill="currentColor"/></svg>),
  Vote: (p) => (<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 9v11h16V9"/><path d="M12 3 3 9h18z"/><path d="M12 13v4"/></svg>),
};

/* ============= the AXOLOTL — meditating ============= */
/* ============= AXI, DER AXOLOTL — das Maskottchen (11.0, 07.09.2026) =============
   Zurück zum Axolotl von früher, aber lebendig: er atmet, blinzelt, schaut sich
   um, die Kiemen wippen, der Schwanz wedelt. Stimmungen:
     'happy' (Standard) · 'cheer' (jubelt, Arme hoch, hüpft) · 'sad' (Kiemen
     hängen, Träne) · 'sleep' (schläft, Zzz) · 'think' (schaut nach oben).
   Reines SVG; die Bewegung steckt in index.html, Abschnitt „AXI, DER AXOLOTL".
   window.Hudhud zeigt aus Kompatibilität hierher — alle alten Aufrufe laufen. */
const AXO_INK = '#2A2352';
function AxoKiemen({ seite, u }) {
  /* (11.0, zweite Fassung) Statt der langen Kiemen-„Haare": zwei kurze, weiche
     Noppen je Seite — man erkennt den Axolotl noch, aber nichts sticht ab. */
  return (
    <g className={'axo-kiemen axo-kiemen-' + seite} transform={seite === 'r' ? 'matrix(-1 0 0 1 240 0)' : undefined}>
      <g className="axo-kieme"><ellipse cx="58" cy="98" rx="14" ry="9" fill={u('kieme')} transform="rotate(-25 58 98)"/><circle cx="47" cy="93" r="5" fill="#FFB1C4"/></g>
      <g className="axo-kieme"><ellipse cx="60" cy="120" rx="13" ry="8.5" fill={u('kieme')} transform="rotate(10 60 120)"/><circle cx="48" cy="123" r="4.6" fill="#FFB1C4"/></g>
    </g>
  );
}
/* Kostüme (app/kostuem.js): liegen als letzte Ebene im SVG, damit Brille über
   den Augen und Hüte über dem Kopf sitzen. */
function AxiKostuem({ id }) {
  switch (id) {
    case 'blume': return (<g className="axo-kostuem">
      {[0, 72, 144, 216, 288].map(function (w) { return <ellipse key={w} cx="174" cy="60" rx="9" ry="6" fill="#FF8DA8" transform={'rotate(' + w + ' 174 60) translate(9 0)'}/>; })}
      <circle cx="174" cy="60" r="6" fill="#F5B000"/></g>);
    case 'schleife': return (<g className="axo-kostuem">
      <path d="M76 56 C58 42 46 50 52 64 C58 70 70 64 76 56 Z" fill="#FF7A9E"/>
      <path d="M76 56 C94 42 106 50 100 64 C94 70 82 64 76 56 Z" fill="#FF7A9E"/>
      <circle cx="76" cy="56" r="6" fill="#FFB1C4"/></g>);
    case 'brille': return (<g className="axo-kostuem" fill="none" stroke="#2A2352" strokeWidth="4.5" strokeLinecap="round">
      <circle cx="94" cy="106" r="24"/><circle cx="146" cy="106" r="24"/>
      <path d="M116 104 q4 -6 8 0"/><path d="M70 102 l-12 -6"/><path d="M170 102 l12 -6"/></g>);
    case 'muetze': return (<g className="axo-kostuem">
      <path d="M58 76 C66 26 174 26 182 76 Q120 60 58 76 Z" fill="#6A5AE0"/>
      <path d="M56 74 Q120 56 184 74 L184 88 Q120 72 56 88 Z" fill="#DCD7FF"/>
      <path d="M92 50 Q120 36 148 50" stroke="#DCD7FF" strokeWidth="6" fill="none" strokeLinecap="round"/>
      <circle cx="120" cy="28" r="12" fill="#FFB1C4"/></g>);
    case 'fes': return (<g className="axo-kostuem">
      <path d="M90 54 L150 54 L143 18 L97 18 Z" fill="#C8102E"/>
      <path d="M96 20 L144 20 L143 18 L97 18 Z" fill="#8F0A20"/>
      <rect x="86" y="50" width="68" height="8" rx="4" fill="#A50D26"/>
      <path d="M142 22 C150 18 158 24 156 38" stroke="#1E1B3A" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <circle cx="156" cy="42" r="5" fill="#1E1B3A"/></g>);
    case 'kopfhoerer': return (<g className="axo-kostuem">
      <path d="M54 104 C54 38 186 38 186 104" stroke="#2D2470" strokeWidth="9" fill="none" strokeLinecap="round"/>
      <rect x="40" y="92" width="24" height="36" rx="10" fill="#2D2470"/><rect x="176" y="92" width="24" height="36" rx="10" fill="#2D2470"/>
      <rect x="46" y="98" width="12" height="24" rx="6" fill="#8F82FF"/><rect x="182" y="98" width="12" height="24" rx="6" fill="#8F82FF"/></g>);
    case 'krone': return (<g className="axo-kostuem">
      <path d="M86 52 L94 18 L110 38 L120 10 L130 38 L146 18 L154 52 Z" fill="#F5B000"/>
      <rect x="84" y="48" width="72" height="9" rx="4" fill="#C98A00"/>
      <circle cx="120" cy="38" r="4.5" fill="#FF7A9E"/><circle cx="100" cy="44" r="3.5" fill="#3D8BFD"/><circle cx="140" cy="44" r="3.5" fill="#2EC46E"/></g>);
    default: return null;
  }
}
function Axolotl({ size = 220, mood = 'happy', className, style, kostuem }) {
  const id = useId().replace(/:/g, '');
  const u = (n) => `url(#${n}${id})`;
  const m = ['cheer', 'sad', 'sleep', 'think'].includes(mood) ? mood : 'happy';
  let augen;
  if (m === 'cheer') {
    augen = (<g stroke={AXO_INK} strokeWidth="6" strokeLinecap="round" fill="none">
      <path d="M78 108 q16 -18 32 0"/><path d="M130 108 q16 -18 32 0"/></g>);
  } else if (m === 'sleep') {
    augen = (<g stroke={AXO_INK} strokeWidth="5.5" strokeLinecap="round" fill="none">
      <path d="M78 108 q16 12 32 0"/><path d="M130 108 q16 12 32 0"/></g>);
  } else {
    augen = (<g>
      <ellipse cx="94" cy="106" rx="19" ry="21.5" fill="#fff"/><ellipse cx="146" cy="106" rx="19" ry="21.5" fill="#fff"/>
      <g className="axo-pupille">
        <circle cx="96" cy="109" r="11" fill={AXO_INK}/><circle cx="148" cy="109" r="11" fill={AXO_INK}/>
        <circle cx="100.5" cy="103.5" r="4.2" fill="#fff"/><circle cx="152.5" cy="103.5" r="4.2" fill="#fff"/>
        <circle cx="91.5" cy="114" r="2" fill="#fff" opacity=".9"/><circle cx="143.5" cy="114" r="2" fill="#fff" opacity=".9"/>
      </g>
      <g className="axo-lid">
        <ellipse cx="94" cy="106" rx="20" ry="22.5" fill={u('kopf')}/><ellipse cx="146" cy="106" rx="20" ry="22.5" fill={u('kopf')}/>
      </g>
      {m === 'sad' && (<g>
        <g stroke={AXO_INK} strokeWidth="4" strokeLinecap="round" fill="none"><path d="M76 92 l24 -8"/><path d="M164 92 l-24 -8"/></g>
        <path className="axo-traene" d="M160 126 q7 10 0 16 q-7 -6 0 -16z" fill="#8FC6FF"/>
      </g>)}
    </g>);
  }
  let mund;
  if (m === 'cheer') mund = (<g><path d="M104 134 q16 26 32 0 z" fill="#3A2C66"/><path d="M112 144 q8 8 16 0 q-8 4 -16 0z" fill="#FF8DA8"/></g>);
  else if (m === 'sad') mund = <path d="M110 148 q10 -9 20 0" stroke={AXO_INK} strokeWidth="4.5" fill="none" strokeLinecap="round"/>;
  else if (m === 'sleep') mund = (<g>
    <path d="M113 141 q7 4 14 0" stroke={AXO_INK} strokeWidth="4" fill="none" strokeLinecap="round"/>
    <text className="axo-z" x="178" y="66" fontSize="24" fontWeight="900" fill={AXO_INK}>z</text>
    <text className="axo-z" x="196" y="44" fontSize="18" fontWeight="900" fill={AXO_INK}>z</text>
  </g>);
  else if (m === 'think') mund = <ellipse cx="120" cy="142" rx="6" ry="6.5" fill="#3A2C66"/>;
  else mund = <path d="M108 138 q6 8 12 0 q6 8 12 0" stroke={AXO_INK} strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>;

  return (
    <svg viewBox="0 0 240 240" width={size} height={size} style={Object.assign({ display: 'block', overflow: 'visible' }, style || {})}
         className={'axo axo--' + m + (className ? ' ' + className : '')} role="img" aria-label="Axi, der kleine Axolotl">
      <defs>
        <linearGradient id={'kopf' + id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#AFA2FF"/><stop offset=".55" stopColor="#8273F5"/><stop offset="1" stopColor="#5D4DD6"/></linearGradient>
        <linearGradient id={'arm' + id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9385F8"/><stop offset="1" stopColor="#5D4DD6"/></linearGradient>
        <linearGradient id={'bauch' + id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#EEEBFF"/><stop offset="1" stopColor="#CFC6FF"/></linearGradient>
        <linearGradient id={'kieme' + id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFC2D1"/><stop offset="1" stopColor="#FF86A8"/></linearGradient>
      </defs>
      <ellipse className="axo-schatten" cx="120" cy="224" rx="60" ry="7.5" fill="rgba(46,36,112,.14)"/>
      <g className="axo-koerper">
        <path className="axo-arm axo-arm-l" d="M86 164 C72 166 62 180 68 194 C76 199 86 190 90 178 Z" fill={u('arm')}/>
        <path className="axo-arm axo-arm-r" d="M154 164 C168 166 178 180 172 194 C164 199 154 190 150 178 Z" fill={u('arm')}/>
        <ellipse cx="120" cy="182" rx="48" ry="34" fill={u('kopf')}/>
        <ellipse cx="120" cy="190" rx="30" ry="18" fill={u('bauch')}/>
        <ellipse cx="100" cy="212" rx="14" ry="7" fill="#5D4DD6"/><ellipse cx="140" cy="212" rx="14" ry="7" fill="#5D4DD6"/>
        <AxoKiemen seite="l" u={u}/><AxoKiemen seite="r" u={u}/>
        <ellipse cx="120" cy="106" rx="70" ry="63" fill={u('kopf')}/>
        <ellipse cx="92" cy="70" rx="26" ry="13" fill="#fff" opacity=".22"/>
        <path d="M110 46 q10 -14 20 0 q-10 -4 -20 0z" fill={u('kieme')}/>
        <ellipse cx="74" cy="132" rx="14" ry="9" fill="#FF8DA8" opacity=".5"/><ellipse cx="166" cy="132" rx="14" ry="9" fill="#FF8DA8" opacity=".5"/>
        {augen}
        {mund}
        <AxiKostuem id={kostuem !== undefined ? kostuem : (window.Kostuem ? window.Kostuem.active() : '')}/>
      </g>
    </svg>
  );
}

/* ============= LOGO DER GEMEINDE (11.0) =============
   Das Oval aus assets/logo-gemeinde.jpg; die Rundung schneidet den Papierrand
   des Originals weg. Text kommt aus window.GEMEINDE_NAME (app/config.js). */
function GemeindeLogo({ size = 40, text }) {
  return (
    <span className="gemeinde">
      <img src="assets/logo-gemeinde.jpg" alt={window.GEMEINDE_NAME || 'Logo der Gemeinde'} style={{ height: size, width: 'auto' }}/>
      {text}
    </span>
  );
}

/* ============= MINI-AXI (Navigation, Tutor-Blase) ============= */
function MiniAxolotl({ size = 32 }) {
  const id = useId().replace(/:/g,'');
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} className="axo-mini" aria-hidden="true">
      <defs>
        <linearGradient id={"mb"+id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#AFA2FF"/><stop offset="1" stopColor="#5D4DD6"/></linearGradient>
        <linearGradient id={"mf"+id} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#FFC2D1"/><stop offset="1" stopColor="#FF86A8"/></linearGradient>
      </defs>
      <ellipse cx="7" cy="20" rx="4" ry="2.6" fill={`url(#mf${id})`} transform="rotate(-25 7 20)"/>
      <ellipse cx="33" cy="20" rx="4" ry="2.6" fill={`url(#mf${id})`} transform="rotate(25 33 20)"/>
      <circle cx="20" cy="21" r="15" fill={`url(#mb${id})`}/>
      <path d="M17.5 7 q2.5 -3.5 5 0 q-2.5 -1 -5 0z" fill={`url(#mf${id})`}/>
      <ellipse cx="15" cy="20.5" rx="4.2" ry="4.7" fill="#fff"/><ellipse cx="25" cy="20.5" rx="4.2" ry="4.7" fill="#fff"/>
      <circle cx="15.5" cy="21.2" r="2.4" fill="#2A2352"/><circle cx="25.5" cy="21.2" r="2.4" fill="#2A2352"/>
      <circle cx="16.4" cy="20" r=".9" fill="#fff"/><circle cx="26.4" cy="20" r=".9" fill="#fff"/>
      <path d="M17.5 27.5 q1.25 1.8 2.5 0 q1.25 1.8 2.5 0" stroke="#2A2352" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <ellipse cx="10.5" cy="26" rx="2.6" ry="1.7" fill="#FF8DA8" opacity=".55"/><ellipse cx="29.5" cy="26" rx="2.6" ry="1.7" fill="#FF8DA8" opacity=".55"/>
    </svg>
  );
}


/* ============= MAMMUT (Auswendig) ============= */
function Mammoth({ size = 86 }) {
  const id = useId().replace(/:/g,'');
  return (
    <svg viewBox="0 0 100 100" width={size} height={size}>
      <defs>
        <linearGradient id={"mam"+id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#54CDB3"/><stop offset="1" stopColor="#1D8973"/>
        </linearGradient>
      </defs>
      <ellipse cx="55" cy="68" rx="35" ry="22" fill={`url(#mam${id})`} />
      <rect x="28" y="74" width="8" height="14" rx="3" fill="#177562"/>
      <rect x="46" y="74" width="8" height="14" rx="3" fill="#177562"/>
      <rect x="66" y="74" width="8" height="14" rx="3" fill="#177562"/>
      <ellipse cx="32" cy="50" rx="22" ry="20" fill={`url(#mam${id})`} />
      <path d="M22 60 Q14 70 14 78 Q14 86 22 86" stroke={`url(#mam${id})`} strokeWidth="9" fill="none" strokeLinecap="round"/>
      <path d="M22 78 Q26 84 30 86 L36 82" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M16 64 Q10 60 12 56" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round"/>
      <circle cx="28" cy="46" r="3.2" fill="#fff"/>
      <circle cx="29" cy="47" r="1.8" fill="#1A1F36"/>
      <path d="M52 78 Q60 85 70 82" stroke="#1A1F36" strokeWidth="1.5" fill="none" opacity=".15"/>
    </svg>
  );
}

/* ============= EULE (KI-Tutor) ============= */
function Owl({ size = 86 }) {
  const id = useId().replace(/:/g,'');
  return (
    <svg viewBox="0 0 100 100" width={size} height={size}>
      <defs>
        <linearGradient id={"ow"+id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5DA1F5"/><stop offset="1" stopColor="#2D6CC9"/>
        </linearGradient>
      </defs>
      <ellipse cx="50" cy="58" rx="32" ry="32" fill={`url(#ow${id})`} />
      <path d="M22 38 L34 22 L38 40 Z" fill={`url(#ow${id})`}/>
      <path d="M78 38 L66 22 L62 40 Z" fill={`url(#ow${id})`}/>
      <ellipse cx="50" cy="70" rx="20" ry="20" fill="#A6CDF5" opacity=".5"/>
      <circle cx="38" cy="52" r="11" fill="#fff"/>
      <circle cx="62" cy="52" r="11" fill="#fff"/>
      <circle cx="38" cy="54" r="6" fill="#1A1F36"/>
      <circle cx="62" cy="54" r="6" fill="#1A1F36"/>
      <circle cx="40" cy="52" r="2" fill="#fff"/>
      <circle cx="64" cy="52" r="2" fill="#fff"/>
      <path d="M44 64 L50 70 L56 64 Z" fill="#F6A93D"/>
      <path d="M40 84 L46 90 L50 84" stroke="#F6A93D" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <path d="M50 84 L54 90 L60 84" stroke="#F6A93D" strokeWidth="3" fill="none" strokeLinecap="round"/>
    </svg>
  );
}

/* ============= JOYSTICK (Gizmo Live) ============= */
function Joystick({ size = 86 }) {
  const id = useId().replace(/:/g,'');
  return (
    <svg viewBox="0 0 100 100" width={size} height={size}>
      <defs>
        <linearGradient id={"js"+id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7E66E8"/><stop offset="1" stopColor="#3F2DA3"/>
        </linearGradient>
      </defs>
      <path d="M16 76 L50 60 L84 76 L50 92 Z" fill={`url(#js${id})`} />
      <path d="M16 76 L16 80 L50 96 L84 80 L84 76 L50 92 Z" fill="#2A1D7A"/>
      <rect x="46" y="38" width="8" height="28" rx="3" fill="#3F2DA3"/>
      <circle cx="50" cy="32" r="14" fill="#E04F4F"/>
      <ellipse cx="46" cy="28" rx="5" ry="3" fill="#FF9E9E"/>
    </svg>
  );
}

/* ============= ZIELSCHEIBE (Übungstest) ============= */
function Target({ size = 86 }) {
  const id = useId().replace(/:/g,'');
  return (
    <svg viewBox="0 0 100 100" width={size} height={size}>
      <defs>
        <linearGradient id={"tg"+id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff"/><stop offset="1" stopColor="#E6E9F0"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="38" fill="#E14F4F" stroke="#9D2828" strokeWidth="2"/>
      <circle cx="50" cy="50" r="28" fill={`url(#tg${id})`} stroke="#9D2828" strokeWidth="1.5"/>
      <circle cx="50" cy="50" r="18" fill="#E14F4F"/>
      <circle cx="50" cy="50" r="8" fill={`url(#tg${id})`}/>
      <line x1="78" y1="22" x2="48" y2="52" stroke="#3A6DC9" strokeWidth="5" strokeLinecap="round"/>
      <path d="M78 22 L84 16 L86 22 L80 24 Z" fill="#5DA1F5"/>
      <path d="M48 52 L52 56 L48 60 L44 56 Z" fill="#1A1F36"/>
    </svg>
  );
}

/* ============= Import source icons (3D-ish flat colored shapes) ============= */
// onClick optional: fehlt es, ist die Kachel rein dekorativ/deaktiviert (Quelle noch
// nicht angeschlossen, siehe BUILD_BLUEPRINT.md Phase 4 — nach und nach werden mehr
// Kacheln "scharf" geschaltet, angefangen mit "notes" in Phase 3).
function ImportTile({ kind, label, onClick }) {
  const map = {
    pdf:     { bg: '#FCE2E2', icon: <rect x="22" y="14" width="36" height="52" rx="6" fill="#E14F4F"/>, ttl: 'PDF' },
    notes:   { bg: '#FFF1D6', icon: <rect x="20" y="14" width="40" height="52" rx="6" fill="#F4B73A"/>, ttl: '📝' },
    ppt:     { bg: '#FFDCC4', icon: <rect x="14" y="20" width="52" height="40" rx="6" fill="#E97324"/>, ttl: 'PPT' },
    youtube: { bg: '#FCE2E2', icon: <><rect x="12" y="22" width="56" height="36" rx="9" fill="#E14F4F"/><path d="M34 30 l16 10 -16 10z" fill="#fff"/></>, ttl: 'YT' },
    photo:   { bg: '#DAF2E1', icon: <><rect x="14" y="20" width="52" height="40" rx="6" fill="#5DC07C"/><circle cx="30" cy="36" r="4" fill="#fff"/><path d="M14 56 L34 40 L56 56" stroke="#fff" strokeWidth="3" fill="none"/></>, ttl: '📷' },
    quizlet: { bg: '#D9ECFB', icon: <rect x="16" y="20" width="48" height="40" rx="6" fill="#3F8FD3"/>, ttl: 'Q' },
    anki:    { bg: '#D6F0F4', icon: <rect x="16" y="20" width="48" height="40" rx="6" fill="#2EA9C9"/>, ttl: 'A' },
    table:   { bg: '#D7F1E0', icon: <><rect x="16" y="20" width="48" height="40" rx="6" fill="#41A36A"/><path d="M16 34h48M16 47h48M40 20v40" stroke="#fff" strokeWidth="1.5"/></>, ttl: '📊' },
    web:     { bg: '#E1E5F1', icon: <><circle cx="40" cy="40" r="22" fill="#6B7B99"/><path d="M18 40h44M40 18a30 18 0 0 1 0 44M40 18a30 18 0 0 0 0 44" stroke="#fff" strokeWidth="1.6" fill="none"/></>, ttl: '🔗' },
    word:    { bg: '#DCE8FB', icon: <rect x="16" y="20" width="48" height="40" rx="6" fill="#3B6FCF"/>, ttl: 'W' },
  };
  const m = map[kind];
  return (
    <button className={"import-card" + (onClick ? '' : ' is-disabled')} onClick={onClick}
            title={onClick ? undefined : 'Bald verfügbar'}>
      <div style={{width:64, height:64, borderRadius:14, background:m.bg, display:'grid', placeItems:'center', boxShadow:'inset 0 -3px 0 rgba(0,0,0,0.06)'}}>
        <svg viewBox="0 0 80 80" width="56" height="56">{m.icon}</svg>
      </div>
      <span>{label}</span>
    </button>
  );
}

/* ============= AVATAR — 3D-ish animal emoji ring ============= */
function AnimalAvatar({ kind = '🦔', size = 32, ring = '#fff' }) {
  return (
    <div className="avatar" style={{width:size, height:size, fontSize: size*0.62, background: ring, flexBasis: size}}>
      <span>{kind}</span>
    </div>
  );
}

window.Icon = Icon;
window.Axolotl = Axolotl;
window.MiniAxolotl = MiniAxolotl;
window.AxiKostuem = AxiKostuem;
window.GemeindeLogo = GemeindeLogo;
window.Mammoth = Mammoth;
window.Owl = Owl;
window.Joystick = Joystick;
window.Target = Target;
window.ImportTile = ImportTile;
window.AnimalAvatar = AnimalAvatar;

/* Der Wiedehopf Huedhued (10.0) ist in Rente - alle alten Aufrufe landen bei Axi. */
window.Hudhud = Axolotl;   // (11.0) Der Wiedehopf ist in Rente — alle Aufrufe zeigen auf Axi
