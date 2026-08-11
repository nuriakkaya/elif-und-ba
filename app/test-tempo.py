#!/usr/bin/env python3
"""Prüft die drei Korrekturen: Ton per Tipp, nur Arabisch, Tempo-Grenze."""
import os, subprocess, sys, time, json, signal
from playwright.sync_api import sync_playwright
APP='/home/claude/work'; PORT=8981; BASE=f'http://127.0.0.1:{PORT}'
errors=[]
def check(n,c,x=''):
    print(('[OK  ] ' if c else '[FAIL] ')+n+(f' — {x}' if x else ''))
    if not c: errors.append(n)
env=dict(os.environ,MODE='full',PORT=str(PORT))
pr=subprocess.Popen(['node','test-site.mjs'],cwd=APP,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.STDOUT,preexec_fn=os.setsid)
import urllib.request
for _ in range(80):
    time.sleep(0.25)
    try: urllib.request.urlopen(BASE+'/index.html',timeout=1).read(1); break
    except Exception: pass
FAKE = r"""
window.__say=''; window.__delay=200;
function FakeSR(){this.lang='';}
FakeSR.prototype.start=function(){var s=this;setTimeout(function(){
  var r={0:{transcript:window.__say},length:1,isFinal:true};
  if(s.onresult)s.onresult({resultIndex:0,results:{0:r,length:1}});if(s.onend)s.onend();},window.__delay);};
FakeSR.prototype.stop=function(){};FakeSR.prototype.abort=function(){};
window.SpeechRecognition=FakeSR;
"""
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=b.new_context(viewport={'width':412,'height':1100})
    ctx.route('https://cdn.islamic.network/**', lambda r: r.fulfill(status=404,body=''))
    ctx.route('https://**', lambda r: r.fulfill(status=404,body=''))
    ctx.add_init_script(FAKE)
    pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto(BASE+'/index.html',wait_until='domcontentloaded'); pg.wait_for_timeout(5200)

    print('\n=== 1. Tempo-Fenster ===')
    t=pg.evaluate("""()=>({kurz:window.Hifz.tempoLimit('قُلْ هُوَ اللَّهُ أَحَدٌ'),
      lang:window.Hifz.tempoLimit('صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ'),
      eins:window.Hifz.tempoLimit('قُلْ')})""")
    check('kurzer Vers ~12 s', 10<=t['kurz']<=14, str(t['kurz'])+' s')
    check('langer Vers mehr Zeit', t['lang']>t['kurz'] and t['lang']<=75, str(t['lang'])+' s')
    check('Mindestzeit 6 s', t['eins']>=6, str(t['eins'])+' s')

    print('\n=== 2. Kein Ton ohne Fingertipp ===')
    pg.evaluate("""()=>{const s={v:1,items:{kevser:{heard:1,p:{0:1},chain:0,done:0,best:0,xp:0,rn:0,rlast:0,self:0}},xp:0};
      localStorage.setItem('eb_hifz_v1',JSON.stringify(s));}""")
    pg.evaluate("()=>{window.__plays=0;const P=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){window.__plays++;return P.apply(this,arguments);} }")
    pg.reload(wait_until='domcontentloaded'); pg.wait_for_timeout(5200)
    pg.evaluate("()=>{window.__plays=0;const P=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){window.__plays++;return P.apply(this,arguments);} }")
    def click(t,nth=0,w=900):
        r=pg.evaluate('''([t,n])=>{const e=[...document.querySelectorAll('button,.hz-card,.hz-suggest')];
          const h=e.filter(x=>(x.textContent||'').trim().includes(t)); if(h[n]){h[n].click();return true;} return false;}''',[t,nth]); pg.wait_for_timeout(w); return r
    if not click('Weitermachen'): click('Loslegen')
    click('Al-Kauthar'); click('Weiter: Vers 1', w=1600)
    hdr=pg.evaluate("()=>{const e=document.querySelector('.hz-prac-title b');return e?e.innerText:'-'}")
    check('Nachsprech-Stufe offen', 'Nachsprechen' in hdr, hdr)
    check('nichts spielt von allein', pg.evaluate("()=>window.__plays")==0, str(pg.evaluate("()=>window.__plays")))

    print('\n=== 3. Beim Nachsprechen steht nur Arabisch ===')
    v=pg.evaluate("""()=>{const e=document.querySelector('.hz-verse');return {txt:e?e.innerText:'',tr:!!document.querySelector('.hz-tr'),de:!!document.querySelector('.hz-de'),hint:!!document.querySelector('.hz-onlyar')};}""")
    check('keine Umschrift sichtbar', not v['tr'], v['txt'][:60].replace('\n',' '))
    check('keine Übersetzung sichtbar', not v['de'])
    check('Hinweis „nur Arabisch"', v['hint'])
    check('Umschrift-Hilfe als Knopf da', 'Umschrift' in pg.evaluate("()=>document.body.innerText"))
    check('Tempo-Hinweis sichtbar', 'Sekunden' in pg.evaluate("()=>document.body.innerText"))

    print('\n=== 4. Zu langsam = halbe Punkte ===')
    xp0=pg.evaluate("()=>window.XP.state().total")
    lim=pg.evaluate("()=>window.Hifz.tempoLimit('إِنَّا أَعْطَيْنَاكَ الْكَوْثَرَ')")
    pg.evaluate("(l)=>{window.__say='انا اعطيناك الكوثر';window.__delay=(l+2)*1000;}",lim)
    pg.evaluate("()=>{const b=document.querySelector('.hz-mic');b&&b.click();}")
    pg.wait_for_timeout((lim+4)*1000)
    t=pg.evaluate("()=>document.body.innerText").lower()
    check('meldet „zu langsam"', 'zu langsam' in t, t[-180:].replace('\n',' '))
    pg.wait_for_timeout(3000)
    st=pg.evaluate("()=>window.Hifz.itemState('kevser')")
    gain=pg.evaluate("()=>window.XP.state().total")-xp0
    check('Stufe trotzdem geschafft', int(st['p'].get('1',st['p'].get(1,0)) if False else st['p'].get('0',0))>=2, json.dumps(st['p']))
    check('nur halbe Punkte (12 statt 25)', gain==13 or gain==12, str(gain)+' XP')

    print('\n=== 5. Flüssig = volle Punkte ===')
    pg.evaluate("""()=>{const s=JSON.parse(localStorage.getItem('eb_hifz_v1'));s.items.kevser.p={0:1};s.xp=0;localStorage.setItem('eb_hifz_v1',JSON.stringify(s));}""")
    pg.reload(wait_until='domcontentloaded'); pg.wait_for_timeout(5200)
    if not click('Weitermachen'): click('Loslegen')
    click('Al-Kauthar'); click('Weiter: Vers 1', w=1600)
    xp0=pg.evaluate("()=>window.XP.state().total")
    pg.evaluate("()=>{window.__say='انا اعطيناك الكوثر';window.__delay=1200;}")
    pg.evaluate("()=>{const b=document.querySelector('.hz-mic');b&&b.click();}")
    pg.wait_for_timeout(4200)
    gain=pg.evaluate("()=>window.XP.state().total")-xp0
    check('volle 25 Punkte', gain==25, str(gain)+' XP')
    check('kein „zu langsam"', 'zu langsam' not in pg.evaluate("()=>document.body.innerText").lower())

    print('\n=== 6. Suren im Aussprache-Studio ===')
    pg.evaluate("()=>{localStorage.setItem('lern_teacher_v1','1');}")
    pg.reload(wait_until='domcontentloaded'); pg.wait_for_timeout(5200)
    n=pg.evaluate("""()=>{const seen=new Set();let n=0;
      (window.HIFZ_ITEMS||[]).forEach(it=>it.parts.forEach(p=>{const ar=String(p.ar).replace(/[^\\u0600-\\u06FF\\s]/g,' ').trim().replace(/\\s+/g,' ');
        if(ar&&!seen.has(ar)){seen.add(ar);n++;}}));return n;}""")
    check('77 Suren-Teile aufnehmbar', n>=70, str(n))

    print('\n=== 7. Keine Fehler ===')
    check('keine Laufzeitfehler', not errs, '; '.join(errs[:3]))
    b.close()
os.killpg(os.getpgid(pr.pid),signal.SIGTERM)
print('\n'+('❌ '+str(len(errors))+' Fehler: '+', '.join(errors) if errors else '✅ Alles bestanden'))
sys.exit(1 if errors else 0)
