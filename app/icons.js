/* global React */
// Icons & mascot — pure SVG, no external assets
const { useId } = React;

// 2D outline icons (lucide-ish, 24px)
const Icon = {
  Home: (p) => (<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/></svg>),
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
function Axolotl({ size = 220 }) {
  const id = useId().replace(/:/g,'');
  return (
    <svg viewBox="0 0 240 240" width={size} height={size} style={{display:'block'}}>
      <defs>
        <linearGradient id={"body"+id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9587D4"/>
          <stop offset="0.55" stopColor="#6C5BB5"/>
          <stop offset="1" stopColor="#3F3175"/>
        </linearGradient>
        <linearGradient id={"belly"+id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C3B7E8"/>
          <stop offset="1" stopColor="#8E7FCC"/>
        </linearGradient>
        <linearGradient id={"fin"+id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E8B5C8"/>
          <stop offset="1" stopColor="#B8638C"/>
        </linearGradient>
        <radialGradient id={"cheek"+id} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#D89DB3" stopOpacity=".55"/>
          <stop offset="1" stopColor="#D89DB3" stopOpacity="0"/>
        </radialGradient>
        <filter id={"sh"+id}><feGaussianBlur stdDeviation="2"/></filter>
      </defs>

      {/* back fins (gills behind head) */}
      <g>
        <path d="M62 78 Q40 70 38 92 Q56 86 70 96 Z" fill={`url(#fin${id})`}/>
        <path d="M55 100 Q28 100 32 124 Q52 112 70 116 Z" fill={`url(#fin${id})`}/>
        <path d="M178 78 Q200 70 202 92 Q184 86 170 96 Z" fill={`url(#fin${id})`}/>
        <path d="M185 100 Q212 100 208 124 Q188 112 170 116 Z" fill={`url(#fin${id})`}/>
      </g>

      {/* tail fin behind body */}
      <path d="M120 215 Q145 220 155 200 L120 175 Q85 220 120 215 Z" fill={`url(#fin${id})`} opacity=".95"/>

      {/* body (sitting) */}
      <ellipse cx="120" cy="160" rx="64" ry="42" fill={`url(#body${id})`} />

      {/* arms folded across belly */}
      <path d="M75 150 Q70 170 90 178 Q105 180 110 168" fill={`url(#body${id})`} stroke="#3A1F70" strokeWidth="1" strokeOpacity=".25"/>
      <path d="M165 150 Q170 170 150 178 Q135 180 130 168" fill={`url(#body${id})`} stroke="#3A1F70" strokeWidth="1" strokeOpacity=".25"/>

      {/* belly */}
      <ellipse cx="120" cy="170" rx="40" ry="22" fill={`url(#belly${id})`} />

      {/* head */}
      <ellipse cx="120" cy="105" rx="62" ry="52" fill={`url(#body${id})`} />

      {/* head shine */}
      <ellipse cx="100" cy="82" rx="22" ry="12" fill="#fff" opacity=".22"/>

      {/* cheeks */}
      <circle cx="86" cy="120" r="11" fill={`url(#cheek${id})`}/>
      <circle cx="154" cy="120" r="11" fill={`url(#cheek${id})`}/>

      {/* closed peaceful eyes */}
      <path d="M92 110 Q100 116 108 110" stroke="#1A0F40" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <path d="M132 110 Q140 116 148 110" stroke="#1A0F40" strokeWidth="3" fill="none" strokeLinecap="round"/>

      {/* smile */}
      <path d="M110 132 Q120 140 130 132" stroke="#1A0F40" strokeWidth="3" fill="none" strokeLinecap="round"/>

      {/* top fin */}
      <path d="M100 56 Q120 28 140 56 Q130 60 120 56 Q110 60 100 56 Z" fill={`url(#fin${id})`}/>
    </svg>
  );
}

/* ============= MINI AXOLOTL (for nav, KI bubble) ============= */
function MiniAxolotl({ size = 32 }) {
  const id = useId().replace(/:/g,'');
  return (
    <svg viewBox="0 0 40 40" width={size} height={size}>
      <defs>
        <linearGradient id={"mb"+id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9587D4"/><stop offset="1" stopColor="#4D3E96"/>
        </linearGradient>
        <linearGradient id={"mf"+id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#E8B5C8"/><stop offset="1" stopColor="#B8638C"/>
        </linearGradient>
      </defs>
      <path d="M8 22 Q3 22 4 28 Q10 26 13 28 Z" fill={`url(#mf${id})`}/>
      <path d="M32 22 Q37 22 36 28 Q30 26 27 28 Z" fill={`url(#mf${id})`}/>
      <circle cx="20" cy="22" r="14" fill={`url(#mb${id})`}/>
      <path d="M14 22 Q17 25 20 22" stroke="#fff" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
      <path d="M20 22 Q23 25 26 22" stroke="#fff" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
      <path d="M17 28 Q20 30 23 28" stroke="#fff" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
      <path d="M14 12 Q20 6 26 12" fill={`url(#mf${id})`}/>
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
window.Mammoth = Mammoth;
window.Owl = Owl;
window.Joystick = Joystick;
window.Target = Target;
window.ImportTile = ImportTile;
window.AnimalAvatar = AnimalAvatar;
