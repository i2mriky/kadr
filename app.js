// 2mriky Reel — editor. Reads a reel folder (reel.json + assets) from disk via the File System Access API.
// Nothing is uploaded. Edits autosave into the same folder.
'use strict';
const $=id=>document.getElementById(id);
const el=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;};
const PREVIEW_SCALE=.5;               // live preview at 540×960 — light on older laptops
const S={dir:null,file:'reel.json',reel:null,images:{},urls:{},videos:{},eng:null,t:0,playing:false,
  sel:0,tab:'scene',undo:[],redo:[],burst:0,savedOnce:false,saveTimer:0,stillTimer:0,dirty:false,safe:false};

// ---------- scene types: Arabic name + editable fields ----------
const TYPE_NAME={shot:'لقطة فيديو',titleCard:'كارت عنوان',bigStat:'رقم كبير',ctaCard:'تواصل / CTA',hookPullback:'هوك — سحب للخلف',pressToClip:'ضغطة ← فيديو',bentoThree:'بنتو 3 كروت',loupe:'عدسة',
  clipFull:'فيديو كامل',coloursOnBeat:'ألوان على البيت',bentoPick:'اختار لونك',filmstrip:'شريط صور',outro:'أوتـرو',
  searchUI:'بحث (واجهة)',cards3D:'كروت 3D',mapPin:'خريطة + دبوس',iconGrid:'أيقونات (كيبورد)',planCard:'كارت سداد 3D'};
// timings that belong to the END of a scene: they move with the duration
const END_ANCHORED={_:[['text','exit']],bentoThree:[['morphAt',0],['morphAt',1]],bentoPick:[['exitAt']],pressToClip:[]};
const TRANS=[['cut','قطع مباشر'],['slam','سلام (زووم في الكاميرا)'],['glitch','جليتش'],['iris','آيرس «لمسة»'],['match','ماتش-بوش (زووم جوه تفصيلة)'],['whip','ويب (يمين)'],['push','بوش (لفوق)'],['flash','فلاش']];
const TRANS_DEF={slam:{type:'slam',dur:.4,fill:'#FFFFFF'},glitch:{type:'glitch',dur:.3},iris:{type:'iris',dur:.45,cx:540,cy:960,fill:'$paper',ring:'$red'},match:{type:'match',dur:.5,a:[540,900],b:[540,900],z:2.3},whip:{type:'whip',dur:.32},push:{type:'push',dur:.4},flash:{type:'flash',dur:.25,fill:'#FFFFFF'}};
const COLOR_NAME={paper:'الورق (الخلفية)',stone:'ستون',red:'لون البراند',ink:'الحبر (الكلام)',inkL:'كلام فاتح',mut:'كلام باهت',card:'الكروت'};

// ---------- file helpers ----------
async function fileAt(path){const p=path.split('/').filter(Boolean);let d=S.dir;for(const x of p.slice(0,-1))d=await d.getDirectoryHandle(x);return (await d.getFileHandle(p.at(-1))).getFile();}
async function writeAt(path,data){const p=path.split('/').filter(Boolean);let d=S.dir;for(const x of p.slice(0,-1))d=await d.getDirectoryHandle(x,{create:true});
  const w=await (await d.getFileHandle(p.at(-1),{create:true})).createWritable();await w.write(data);await w.close();}
async function urlOf(path){if(S.urls[path])return S.urls[path];const u=URL.createObjectURL(await fileAt(path));S.urls[path]=u;return u;}
const loadImg=src=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=src;});

// ---------- remember last folder (IndexedDB) ----------
const idb=(mode,fn)=>new Promise(r=>{try{const q=indexedDB.open('2mriky-reel',1);q.onupgradeneeded=()=>q.result.createObjectStore('kv');
  q.onsuccess=()=>{const tx=q.result.transaction('kv',mode);const st=tx.objectStore('kv');const res=fn(st);tx.oncomplete=()=>r(res&&res.result);tx.onerror=()=>r(null);};q.onerror=()=>r(null);}catch(e){r(null);}});
const rememberDir=h=>idb('readwrite',st=>st.put(h,'last'));
const lastDir=()=>idb('readonly',st=>st.get('last'));

// ---------- open ----------
async function pickFolder(){
  let h; try{h=await window.showDirectoryPicker({id:'reel',mode:'readwrite'});}catch(e){return;}
  await openDir(h);
}
async function openDir(h){
  S.dir=h; rememberDir(h);
  const jsons=[]; for await(const [n,e] of h.entries()) if(e.kind==='file'&&/^reel.*\.json$/i.test(n))jsons.push(n);
  if(!jsons.length){toast('الفولدر ده مفيهوش reel.json');return;}
  jsons.sort((a,b)=>a==='reel.json'?-1:b==='reel.json'?1:a.localeCompare(b));
  if(jsons.length===1)return loadReel(jsons[0]);
  $('start').style.display='none';$('chooser').style.display='';const L=$('chooseList');L.textContent='';
  jsons.forEach(n=>{const b=el('button',null,n);b.onclick=()=>{$('chooser').style.display='none';loadReel(n);};L.appendChild(b);});
}
async function loadReel(name){
  S.file=name; toast('بيفتح…');
  try{ const fl=await fileAt(name); S.mtime=fl.lastModified; S.reel=JSON.parse(await fl.text()); }catch(e){toast('reel.json فيه غلطة ومش بيتقري');console.error(e);return;}
  const R=S.reel; S.images={}; S.videos={}; S.undo=[]; S.redo=[]; S.savedOnce=false; S.sel=0;
  // fonts
  for(const [fam,list] of Object.entries(R.fonts||{}))for(const f of list){try{const ff=new FontFace(fam,await (await fileAt(f.file)).arrayBuffer(),{weight:String(f.weight)});await ff.load();document.fonts.add(ff);}catch(e){console.warn('font',f.file);}}
  await loadAssets();
  for(const [k,c] of Object.entries(R.clips||{}))await loadClip(k,c);
  $('start').style.display='none';$('chooser').style.display='none';$('app').style.display='';$('proj').style.display='';$('actions').style.display='';
  $('projName').textContent=`${R.name||S.dir.name}`; setSave('');
  rebuild(); selectScene(0); toast('جاهز');
}
async function loadAssets(){
  await Promise.all(Object.entries(S.reel.assets).map(async([k,p])=>{ if(S.images[k]&&S.images[k]._p===p)return;
    try{const i=await loadImg(await urlOf(p));i._p=p;S.images[k]=i;}catch(e){console.warn('missing',p);} }));
  S.lotties=S.lotties||{}; for(const [k,p] of Object.entries(S.reel.lotties||{})){ if(S.lotties[k])continue; try{S.lotties[k]=await (await fetch(await urlOf(p))).json();}catch(e){console.warn('missing',p);} }
}
async function loadClip(k,c){
  if(!c.video)return; try{const v=document.createElement('video');v.muted=true;v.playsInline=true;v.preload='auto';v.src=await urlOf(c.video);
    await new Promise(r=>{v.onloadeddata=r;v.onerror=r;setTimeout(r,4000);});S.videos[k]=v;}catch(e){console.warn('clip',c.video);}
}

// ---------- engine ----------
const used=new Set();
const clipT=(name,v,lt)=>{const c=(S.reel.clips||{})[name]||{},a=c.in||0,e=c.dur?a+c.dur-.04:(v.duration||3)-.05;return Math.min(Math.max(a,a+lt),e);};
function clipHook(name,lt){const v=S.videos[name];if(!v)return null;used.add(name);
  const t=clipT(name,v,lt);
  if(S.playing){ if(v.paused){v.currentTime=t;v.play().catch(()=>{});} else if(Math.abs(v.currentTime-t)>.2)v.currentTime=t; }
  return v.readyState>=2?v:null;}
function needHook(name,lt){const v=S.videos[name];if(!v)return null;const t=clipT(name,v,lt);
  if(Math.abs(v.currentTime-t)<.017&&v.readyState>=2)return null;
  return new Promise(r=>{const done=()=>{v.removeEventListener('seeked',done);r();};v.addEventListener('seeked',done);v.currentTime=t;setTimeout(done,1500);});}
function makeEngine(canvas,scale,sub){return ReelEngine.create(canvas,S.reel,{images:S.images,lotties:S.lotties,clip:clipHook,needClip:needHook,scale,sub});}
function rebuild(){S.eng=makeEngine($('cv'),PREVIEW_SCALE,1);$('tDur').textContent=fmt(S.eng.DUR);if(S.t>S.eng.DUR)S.t=0;drawTimeline();renderPanel();paint();}
function paint(){ if(!S.eng)return; used.clear(); S.eng.draw(S.t,Math.round(S.t*30));
  if(!S.playing)for(const [k,v] of Object.entries(S.videos))if(!used.has(k)&&!v.paused)v.pause();
  movePlayhead(); if(!S.playing)scheduleStill(); }
// when paused: re-render the exact frame (motion blur + exact clip frame) = what the export looks like
const stillCv=document.createElement('canvas');
function scheduleStill(){clearTimeout(S.stillTimer);S.stillTimer=setTimeout(async()=>{ if(S.playing||!S.reel)return; const t=S.t, reel=S.reel;
  try{const e=makeEngine(stillCv,PREVIEW_SCALE,5); await e.render(t,Math.round(t*30));
    if(S.t!==t||S.playing||S.reel!==reel)return; const c=$('cv').getContext('2d');c.globalAlpha=1;c.drawImage(stillCv,0,0);}catch(err){console.error('still',err);} },220);}

// ---------- playback ----------
let raf=0,t0=0,n0=0;
function play(){ if(!S.eng||!S.eng.DUR)return; S.playing=true;$('btnPlay').textContent='❚❚'; if(S.t>=S.eng.DUR-.05)S.t=0; t0=S.t;n0=performance.now(); S.eng=makeEngine($('cv'),PREVIEW_SCALE,1); raf=requestAnimationFrame(tick);}
function pause(){ S.playing=false;$('btnPlay').textContent='▶';cancelAnimationFrame(raf);for(const v of Object.values(S.videos))v.pause();paint();}
function tick(now){ if(!S.playing)return; S.t=t0+(now-n0)/1000; if(S.t>=S.eng.DUR){S.t=0;t0=0;n0=now;}
  const cur=S.eng.sceneAt(S.t),i=S.reel.scenes.findIndex(d=>d.id===cur); if(i>=0&&i!==S.sel&&S.tab==='scene'){S.sel=i;markSel();renderPanel();}
  paint(); raf=requestAnimationFrame(tick);}
const fmt=t=>{const m=Math.floor(t/60),s=t-m*60;return `${m}:${s.toFixed(1).padStart(4,'0')}`;};
function seek(t){ if(S.playing)pause(); S.t=Math.max(0,Math.min(S.eng.DUR-1/30,t)); paint(); }

// ---------- timeline ----------
function drawTimeline(){const tr=$('track');[...tr.querySelectorAll('.blk')].forEach(b=>b.remove());const D=S.eng.DUR||1;
  S.eng.scenes.forEach(sc=>{const i=S.reel.scenes.findIndex(d=>d.id===sc.id),d=S.reel.scenes[i];
    const b=el('div','blk'+(i===S.sel?' sel':''));b.dataset.i=i;b.style.left=`calc(${sc.s/D*100}% + 2px)`;b.style.width=`calc(${(sc.e-sc.s)/D*100}% - 4px)`;
    const th=el('div','th');if(S.thumbs&&S.thumbs[d.id])th.style.backgroundImage=`url(${S.thumbs[d.id]})`;b.appendChild(th);
    b.appendChild(el('div','n',d.label||d.id));b.appendChild(el('div','d',`${(+d.dur).toFixed(1)} ث`));
    const g=el('div','grip');g.title='اسحب لتغيير المدة';b.appendChild(g);
    g.addEventListener('pointerdown',ev=>startResize(ev,i,b));
    b.addEventListener('pointerdown',ev=>{if(ev.target===g)return;ev.stopPropagation();selectScene(i);});
    tr.appendChild(b);});
  const hr=$('hiddenRow');hr.textContent='';const off=S.reel.scenes.map((d,i)=>[d,i]).filter(([d])=>d.off);
  if(off.length){hr.appendChild(el('span',null,'مخفي:'));off.forEach(([d,i])=>{const b=el('button',null,'＋ '+(d.label||d.id));b.title='رجّع المشهد';b.onclick=()=>{edit(()=>{delete d.off;});};hr.appendChild(b);});}
  movePlayhead();scheduleThumbs();}
// small frame per scene on the timeline
const thumbCv=document.createElement('canvas');let thumbT=0;
function scheduleThumbs(){clearTimeout(thumbT);thumbT=setTimeout(()=>{ if(!S.reel)return; S.thumbs=S.thumbs||{};
  const e=makeEngine(thumbCv,.06,1);
  e.scenes.forEach(sc=>{ e.draw(sc.s+Math.min(1.4,(sc.e-sc.s)*.6)); S.thumbs[sc.id]=thumbCv.toDataURL('image/jpeg',.75);
    const i=S.reel.scenes.findIndex(d=>d.id===sc.id); const b=document.querySelector(`.blk[data-i="${i}"] .th`); if(b)b.style.backgroundImage=`url(${S.thumbs[sc.id]})`; });
  if(!S.playing)paint(); },500);}
function markSel(){document.querySelectorAll('.blk').forEach(b=>b.classList.toggle('sel',+b.dataset.i===S.sel));}
function movePlayhead(){const D=S.eng?S.eng.DUR:1;$('playhead').style.left=`${S.t/D*100}%`;$('tNow').textContent=fmt(S.t);}
$('track').addEventListener('pointerdown',ev=>{ if(!S.eng)return; const tr=$('track'),r=tr.getBoundingClientRect();
  const go=e=>seek((e.clientX-r.left)/r.width*S.eng.DUR); go(ev); tr.setPointerCapture(ev.pointerId);
  const mv=e=>go(e), up=()=>{tr.removeEventListener('pointermove',mv);tr.removeEventListener('pointerup',up);}; tr.addEventListener('pointermove',mv);tr.addEventListener('pointerup',up);});
function startResize(ev,i,b){ev.stopPropagation();ev.preventDefault();pause();const d=S.reel.scenes[i],tr=$('track').getBoundingClientRect();
  const pxPerSec=tr.width/S.eng.DUR, x0=ev.clientX, d0=+d.dur; snapshot();
  const mv=e=>{const nd=Math.max(.5,Math.round((d0+(e.clientX-x0)/pxPerSec)*10)/10); if(nd!==+d.dur){setDur(d,nd,false);b.querySelector('.d').textContent=nd.toFixed(1)+' ث';}};
  const up=()=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);afterEdit();};
  window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up);}
function setDur(d,nd,commit=true){const delta=nd-d.dur; d.dur=+nd.toFixed(2);
  for(const path of [...END_ANCHORED._,...(END_ANCHORED[d.type]||[])]){let o=d;for(const k of path.slice(0,-1)){o=o&&o[k];}const k=path.at(-1);if(o&&typeof o[k]==='number')o[k]=+(o[k]+delta).toFixed(2);}
  if(commit)afterEdit(); else { S.eng=makeEngine($('cv'),PREVIEW_SCALE,1); paint(); }}
function moveScene(dir){const i=S.sel,j=i+dir,A=S.reel.scenes;if(j<0||j>=A.length)return;edit(()=>{[A[i],A[j]]=[A[j],A[i]];S.sel=j;});selectScene(j);}
const NEW_SCENE={
  searchUI:()=>({type:'searchUI',dur:4.4,bg:'dark',kicker:'',headline:{words:[{w:'لاقي'},{w:'بيتك',red:true}],y:420,size:112},window:'Search',placeholder:'دوّر…',query:'اكتب البحث هنا',typeAt:.45,cps:20,filters:['فلتر ١','فلتر ٢'],clickAt:2.3,statusAt:2.55,status:[{t:'بنحلّل {n} نتيجة',count:1000},{t:'أفضل تطابق',tag:'98%'}]}),
  cards3D:()=>({type:'cards3D',dur:3.4,bg:'dark',pickAt:1.55,text:{words:[{w:'النتيجة'},{w:'الأفضل',red:true}],y:300,size:96,exit:1.9},cards:[0,1,2,3,4].map(i=>({img:Object.keys(S.reel.assets)[i%Object.keys(S.reel.assets).length],title:'عنوان '+(i+1),place:'',price:'',tags:[],hero:i===2}))}),
  mapPin:()=>({type:'mapPin',dur:4.2,pin:{pos:[.53,.56],title:'اسم المكان',sub:''},pinAt:1.5,roads:[{name:'شارع رئيسي',pts:[[0,.62],[1,.6]],w:34}],landmarks:[{name:'مَعلَم',time:'٥ د',pos:[.6,.49]}],text:{words:[{w:'الموقع'}],y:330,size:96,exit:3.8},tin:{type:'whip',dur:.32}}),
  iconGrid:()=>({type:'iconGrid',dur:3.4,bg:'dark',title:{words:[{w:'كل'},{w:'المميزات',red:true}],y:330,size:100},onAt:1.1,step:.15,items:[['bed-double','غرف'],['bath','حمام'],['car','جراج'],['shield-check','أمن'],['trees','لاندسكيب'],['waves','بيسين']].map(([icon,label])=>({icon,label})),tin:{type:'glitch',dur:.3}}),
  planCard:()=>({type:'planCard',dur:3.6,bg:'dark',window:'Payment Plan',text:{words:[{w:'نظام'},{w:'السداد',red:true}],y:330,size:100},price:{label:'السعر',value:1000000,unit:'ج.م'},rows:[{icon:'percent',k:'المقدم',v:'10%'},{icon:'calendar-clock',k:'مدة التقسيط',v:'8 سنين'}],years:8,yearsLabel:'',tin:{type:'whip',dur:.32}}),
  titleCard:()=>({type:'titleCard',dur:1.8,bg:'dark',kicker:'',text:{words:[{w:'عنوان'},{w:'جديد',red:true}],y:1000,size:160,fx:'type',st:.25},tin:{type:'slam',dur:.36,fill:'#FFFFFF'}}),
  bigStat:()=>({type:'bigStat',dur:2.2,bg:'dark',value:100,unit:'',ring:true,countDur:1.2,sub:{words:[{w:'وصف'},{w:'الرقم',red:true}],y:1330,size:72,weight:700},tin:{type:'glitch',dur:.3}}),
  shot:()=>({type:'shot',dur:2,clip:Object.keys(S.reel.clips||{})[0]||'',zoomFrom:1.06,zoomTo:1.14,scrim:'dark',chip:{text:'',at:.3},tin:{type:'whip',dur:.32}}),
  ctaCard:()=>({type:'ctaCard',dur:3,bg:'dark',logoWidth:360,logoY:640,text:{words:[{w:'كلّمنا'},{w:'دلوقتي',red:true}],y:1080,size:120,fx:'hl'},phone:'',phoneY:1260,small:'',tin:{type:'iris',dur:.45,cx:540,cy:960,fill:'$dark',ring:'$red'}})};
function addScenePicker(){const M=$('mbox');M.textContent='';M.appendChild(el('h2',null,'مشهد جديد'));const G=el('div','grid');
  Object.keys(NEW_SCENE).forEach(k=>{const b=el('button');b.append(el('div','im'),el('span',null,TYPE_NAME[k]));b.querySelector('.im').style.background='var(--p3)';
    b.onclick=()=>{closeModal();const A=S.reel.scenes;const d=NEW_SCENE[k]();let n=1;while(A.some(x=>x.id===k+n))n++;d.id=k+n;d.label=TYPE_NAME[k];
      edit(()=>{A.splice(S.sel+1,0,d);});selectScene(S.sel+1);};G.appendChild(b);});M.appendChild(G);openModal();}
function dupScene(){const A=S.reel.scenes,d=A[S.sel];const c=JSON.parse(JSON.stringify(d));let n=2;while(A.some(x=>x.id===d.id+'_'+n))n++;c.id=d.id+'_'+n;c.label=(d.label||d.id)+' '+n;
  edit(()=>{A.splice(S.sel+1,0,c);});selectScene(S.sel+1);toast('اتعملت نسخة من المشهد');}
function selectScene(i){S.sel=i;S.tab='scene';setTab();markSel();const sc=S.eng.scenes.find(x=>x.id===S.reel.scenes[i].id);
  if(sc)seek(sc.s+Math.min(1.2,(sc.e-sc.s)*.5));renderPanel();}

// ---------- edits / undo / save ----------
function snapshot(){S.undo.push(JSON.stringify(S.reel));if(S.undo.length>80)S.undo.shift();S.redo=[];}
function edit(fn){const now=Date.now();if(now-S.burst>700)snapshot();S.burst=now;fn();afterEdit();}
function afterEdit(){S.eng=makeEngine($('cv'),PREVIEW_SCALE,1);$('tDur').textContent=fmt(S.eng.DUR);drawTimeline();paint();queueSave();}
function undo(){if(!S.undo.length)return;S.redo.push(JSON.stringify(S.reel));S.reel=JSON.parse(S.undo.pop());afterEdit();renderPanel();toast('تراجع');}
function redo(){if(!S.redo.length)return;S.undo.push(JSON.stringify(S.reel));S.reel=JSON.parse(S.redo.pop());afterEdit();renderPanel();}
function setSave(s){const e=$('saveState');e.textContent=s;e.className='save'+(s==='محفوظ ✓'?' ok':'');}
function queueSave(){S.dirty=true;setSave('بيحفظ…');clearTimeout(S.saveTimer);S.saveTimer=setTimeout(save,700);}
async function save(){try{
  if(!S.savedOnce){ // keep the original the first time we touch it this session
    const orig=await (await fileAt(S.file)).text(); const d=new Date(),p=n=>String(n).padStart(2,'0');
    await writeAt(`versions/${S.file.replace(/\.json$/,'')}-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.json`,orig); S.savedOnce=true;}
  const cur=await fileAt(S.file); if(S.mtime&&cur.lastModified!==S.mtime&&S.savedOnce){ /* changed outside (e.g. by Claude) since we loaded */
    await writeAt(`versions/${S.file.replace(/\.json$/,'')}-outside-${Date.now()}.json`,await cur.text()); toast('الملف كان اتعدّل برّه — اتحفظت نسخته في versions'); }
  await writeAt(S.file,JSON.stringify(S.reel,null,2)); S.mtime=(await fileAt(S.file)).lastModified; S.dirty=false; setSave('محفوظ ✓');
}catch(e){console.error(e);setSave('مااتحفظش — دوس ⌘S');}}

// ---------- panel ----------
function setTab(){document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===S.tab));}
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{S.tab=b.dataset.tab;setTab();renderPanel();});
function renderPanel(){const P=$('pbody');if(!S.reel)return;
  const keepFocus=document.activeElement&&P.contains(document.activeElement)?document.activeElement.dataset.key:null;
  P.textContent=''; if(S.tab==='brand')brandPanel(P); else scenePanel(P);
  if(keepFocus){const f=P.querySelector(`[data-key="${keepFocus}"]`);if(f){f.focus();if(f.setSelectionRange&&f.type==='text'){const n=f.value.length;f.setSelectionRange(n,n);}}}}
const sec=(P,title)=>{const s=el('div','sec');if(title)s.appendChild(el('h3',null,title));P.appendChild(s);return s;};
const row=(parent,label,...ctl)=>{const r=el('div','row');r.appendChild(el('label',null,label));const c=el('div','ctl');ctl.forEach(x=>c.appendChild(x));r.appendChild(c);parent.appendChild(r);return r;};
function textIn(obj,key,{dk,ph}={}){const i=el('input','in');i.type='text';i.value=obj[key]??'';i.dataset.key=dk||key;if(ph)i.placeholder=ph;i.oninput=()=>edit(()=>{obj[key]=i.value;});return i;}
function csvIn(obj,key,{dk}={}){const i=el('input','in');i.type='text';i.value=(obj[key]||[]).join('، ');i.dataset.key=dk||key;i.placeholder='افصل بفاصلة';i.oninput=()=>edit(()=>{obj[key]=i.value.split(/[،,]/).map(x=>x.trim()).filter(Boolean);});return i;}
function numIn(obj,key,{min=0,max=99,step=.1,unit='',dk}={}){const w=el('div','num');const i=el('input');i.type='text';i.inputMode='decimal';i.dataset.key=dk||key;
  const dec=(String(step).split('.')[1]||'').length;if(obj[key]==null||isNaN(+obj[key]))obj[key]=min;const show=()=>{i.value=(+obj[key]).toFixed(dec);};show();
  const set=v=>{v=Math.max(min,Math.min(max,Math.round(v/step)*step));v=+v.toFixed(dec);if(v===+obj[key])return show();edit(()=>{if(key==='dur'&&obj.type)setDur(obj,v,false);else obj[key]=v;});show();};
  const m=el('button',null,'−'),p=el('button',null,'+');m.onclick=()=>set(+obj[key]-step);p.onclick=()=>set(+obj[key]+step);
  i.onchange=()=>set(parseFloat(i.value.replace(',','.'))||+obj[key]);w.append(m,i,p);if(unit)w.appendChild(el('span','u',unit));return w;}
function colorIn(obj,key,{dk}={}){const box=el('span','sw');const i=el('input');i.type='color';let v0=obj[key];if(typeof v0==='string'&&v0[0]==='$')v0=S.reel.brand.colors[v0.slice(1)];i.value=/^#[0-9a-f]{6}$/i.test(v0)?v0:'#ffffff';i.dataset.key=dk||key;box.appendChild(i);
  const hex=el('span','hex',obj[key]);i.oninput=()=>{edit(()=>{obj[key]=i.value.toUpperCase();});hex.textContent=i.value.toUpperCase();};return [box,hex];}
function toggleIn(obj,key,label){const b=el('button','toggle'+(obj[key]?' on':''),label);b.onclick=()=>edit(()=>{obj[key]=!obj[key];renderPanel();});return b;}
function selectIn(obj,key,opts){const s=el('select','sel-in');opts.forEach(([v,l])=>{const o=el('option',null,l);o.value=v;if(String(obj[key])===String(v))o.selected=true;s.appendChild(o);});
  s.onchange=()=>edit(()=>{obj[key]=isNaN(+s.value)||s.value===''?s.value:+s.value;renderPanel();});return s;}
function imageIn(obj,key){const t=el('button','thumb pick');const k=obj[key];if(S.urls[S.reel.assets[k]])t.style.backgroundImage=`url("${S.urls[S.reel.assets[k]]}")`;
  t.title='غيّر الصورة';t.onclick=()=>assetPicker(k,nk=>edit(()=>{obj[key]=nk;renderPanel();}));return [t,el('span','imgname',k||'—')];}
// the line of Arabic words: type the line, tap a word to colour it
function wordsIn(P,tx,title='الكلام'){ if(!tx)return; const s=sec(P,title);
  const i=el('input','in');i.type='text';i.dir='rtl';i.dataset.key='words';i.value=tx.words.map(w=>w.w).join(' ');
  const chips=el('div','words');
  const drawChips=()=>{chips.textContent='';tx.words.forEach((w,n)=>{const c=el('button','word'+(w.red?' red':''),w.w);c.title='دوسة = لون البراند';
    c.onclick=()=>edit(()=>{w.red=!w.red;drawChips();});chips.appendChild(c);});};
  i.oninput=()=>edit(()=>{const parts=i.value.trim().split(/\s+/).filter(Boolean);const same=parts.length===tx.words.length;
    tx.words=parts.map((w,n)=>{const o=tx.words[n]||{};const x={w};if(o.red)x.red=true;if(same&&o.at!=null)x.at=o.at;return x;});drawChips();});
  s.appendChild(i);s.appendChild(chips);s.appendChild(el('div','hint','اكتب السطر، ودوس على أي كلمة تاخد لون البراند.'));
  drawChips(); const r=el('div');s.appendChild(r);
  row(s,'حجم الخط',numIn(tx,'size',{min:40,max:260,step:2,unit:'px',dk:'tsize'}));
  row(s,'مكانه من فوق',numIn(tx,'y',{min:150,max:1700,step:5,unit:'px',dk:'ty'}));
  row(s,'حركة الكلام',selectIn(tx,'fx',[['','طلوع كلمة كلمة'],['hl','هايلايت على الكلمة الملوّنة'],['type','كتابة + مؤشر'],['decode','فك شفرة (حروف عشوائية)']]));}
function listItems(P,title,arr,fn){const s=sec(P,title);arr.forEach((it,n)=>{const b=el('div','item');fn(b,it,n);s.appendChild(b);});}

function scenePanel(P){const d=S.reel.scenes[S.sel];if(!d){P.appendChild(el('div','empty','اختار مشهد من التايملاين'));return;}
  const head=sec(P);const ti=el('input','in title-in');ti.value=d.label||d.id;ti.dataset.key='label';ti.oninput=()=>edit(()=>{d.label=ti.value;});
  head.appendChild(ti);head.appendChild(el('span','type',TYPE_NAME[d.type]||d.type));
  const g=sec(P,'التوقيت');row(g,'المدة',numIn(d,'dur',{min:.5,max:20,step:.1,unit:'ث'}));
  const hid=el('button','toggle'+(d.off?' on':''),d.off?'مخفي — رجّعه':'اخفي المشهد');hid.onclick=()=>edit(()=>{d.off=!d.off;renderPanel();});
  const up=el('button','toggle','→ قبل'),dn=el('button','toggle','بعد ←'),dup=el('button','toggle','نسخة');
  up.title='حرّك المشهد لورا';dn.title='حرّك المشهد لقدام';dup.title='اعمل نسخة من المشهد ده';
  up.onclick=()=>moveScene(-1);dn.onclick=()=>moveScene(1);dup.onclick=dupScene;row(g,'',hid,dup);row(g,'الترتيب',up,dn);const add=el('button','toggle','＋ مشهد جديد بعده');add.onclick=addScenePicker;row(g,'',add);
  if(S.sel>0){const tr=sec(P,'الدخول (الانتقال من اللي قبله)');const cur=d.tin?d.tin.type:'cut';
    const ts=el('select','sel-in');TRANS.forEach(([v,l])=>{const o=el('option',null,l);o.value=v;if(v===cur)o.selected=true;ts.appendChild(o);});
    ts.onchange=()=>edit(()=>{d.tin=ts.value==='cut'?undefined:JSON.parse(JSON.stringify(TRANS_DEF[ts.value]));if(!d.tin)delete d.tin;renderPanel();});row(tr,'النوع',ts);
    if(d.tin){row(tr,'المدة',numIn(d.tin,'dur',{min:.15,max:1.2,step:.01,unit:'ث',dk:'tdur'}));
      if(d.tin.type==='iris'){row(tr,'لون الدايرة',...colorIn(d.tin,'fill',{dk:'tfill'}));row(tr,'لون الطوق',...colorIn(d.tin,'ring',{dk:'tring'}));
        row(tr,'مركزها',numIn(d.tin,'cx',{min:0,max:1080,step:10,unit:'x',dk:'tcx'}),numIn(d.tin,'cy',{min:0,max:1920,step:10,unit:'y',dk:'tcy'}));}
      if(d.tin.type==='flash')row(tr,'لون الفلاش',...colorIn(d.tin,'fill',{dk:'tfl'}));
      if(d.tin.type==='match')row(tr,'الزووم',numIn(d.tin,'z',{min:1.2,max:3.5,step:.1,unit:'×',dk:'tz'}));}}
  if(d.type==='filmstrip'){const s=sec(P,'العنوان');s.appendChild(textIn(d,'title'));}
  if(d.type==='bentoThree'){const s=sec(P,'الرقم الكبير');s.appendChild(textIn(d,'number'));}
  wordsIn(P,d.text);
  const img=(key,label)=>{const s=P.lastChild.classList&&P.lastChild.dataset.media?P.lastChild:(()=>{const x=sec(P,'الصور والفيديو');x.dataset.media=1;return x;})();row(s,label,...imageIn(d,key));};
  const clipSel=(key,label)=>{const s=sec(P,'الفيديو');row(s,label,selectIn(d,key,Object.keys(S.reel.clips||{}).map(k=>[k,k])));
    const add=el('button','toggle','＋ فيديو من جهازك');add.onclick=()=>addVideo(nk=>edit(()=>{d[key]=nk;renderPanel();}));row(s,'',add);};
  switch(d.type){
    case 'hookPullback': img('product','المنتج'); {const s=sec(P,'الحركة');row(s,'زووم الدخلة',numIn(d,'startZoom',{min:1,max:2.6,step:.05,unit:'×'}));} break;
    case 'pressToClip': img('product','المنتج'); clipSel('clip','الفيديو'); {const s=P.lastChild;row(s,'يبدأ بعد',numIn(d,'clipAt',{min:.3,max:d.dur-.3,step:.1,unit:'ث'}));row(s,'عمق الضغطة',numIn(d,'pressDepth',{min:10,max:70,step:2,unit:'px'}));} break;
    case 'bentoThree': listItems(P,'الكروت',d.cards,(b,c)=>{row(b,'الاسم',textIn(c,'label',{dk:'card'+c.img}));row(b,'الصورة',...imageIn(c,'img'));
        if(c.morphTo)row(b,'بيكبر لـ',...imageIn(c,'morphTo'));}); break;
    case 'loupe': img('image','الصورة'); listItems(P,'البادجات',d.pills,(b,p,n)=>row(b,'نص '+(n+1),textIn(p,'text',{dk:'pill'+n})));
        {const s=sec(P,'العدسة');row(s,'التكبير',numIn(d,'mag',{min:1.3,max:3.5,step:.1,unit:'×'}));row(s,'الحجم',numIn(d,'radius',{min:120,max:320,step:10,unit:'px'}));} break;
    case 'clipFull': clipSel('clip','الفيديو'); row(P.lastChild,'زووم',numIn(d,'zoom',{min:1.06,max:1.4,step:.01,unit:'×'})); break;
    case 'coloursOnBeat': listItems(P,'الألوان (ثانية لكل لون)',d.colours,(b,c,n)=>{row(b,'الطقم',selectIn(c,'set',S.reel.sets.map((x,i)=>[i,x.name])));
        row(b,'السواتش',...colorIn(c,'swatch',{dk:'sw'+n}));row(b,'الإطار',...colorIn(c,'rim',{dk:'rim'+n}));row(b,'خلفية غامقة',toggleIn(c,'dark',c.dark?'أيوه':'لأ'));}); break;
    case 'bentoPick': listItems(P,'الكروت',d.cards,(b,c,n)=>row(b,'كارت '+(n+1),selectIn(c,'set',S.reel.sets.map((x,i)=>[i,x.name])))); break;
    case 'filmstrip': listItems(P,'الصور',d.images,(b,m)=>row(b,'صورة',...imageIn(m,'img'))); {const s=sec(P,'السطر الصغير');s.appendChild(textIn(d,'caption'));} break;
    case 'shot': if(d.zoomFrom==null)d.zoomFrom=1.06; if(d.zoomTo==null)d.zoomTo=1.14; if(!d.scrim)d.scrim='dark'; clipSel('clip','الفيديو'); {const s=P.lastChild;row(s,'زووم من',numIn(d,'zoomFrom',{min:1,max:1.6,step:.01,unit:'×'}));row(s,'زووم لـ',numIn(d,'zoomTo',{min:1,max:1.6,step:.01,unit:'×'}));
        const c=(S.reel.clips||{})[d.clip]; if(c){row(s,'يبدأ من الثانية',numIn(c,'in',{min:0,max:600,step:.1,unit:'ث',dk:'cin'}));row(s,'طول القطعة',numIn(c,'dur',{min:.3,max:60,step:.1,unit:'ث',dk:'cdur'}));}
        row(s,'تغميق فوق',selectIn(d,'scrim',[['dark','غامق'],['paper','ورق فاتح'],['none','من غير']]));}
      if(!d.chip)d.chip={text:'',at:.3}; {const s=sec(P,'بادج صغير تحت (اسم الأوضة مثلاً)');s.appendChild(textIn(d.chip,'text',{dk:'chip'}));row(s,'أيقونة',textIn(d.chip,'icon',{dk:'chipi',ph:'sofa / bed-double …'}));const gb=el('button','toggle',d.chip.glass?'✓ زجاج':'زجاج');gb.onclick=()=>edit(()=>{d.chip.glass=!d.chip.glass;renderPanel();});row(s,'الشكل',gb);}
      if(!d.text){const b=el('button','toggle','＋ عنوان فوق');b.onclick=()=>edit(()=>{d.text={words:[{w:'عنوان'}],y:430,size:140,fx:'hl'};renderPanel();});sec(P,'').appendChild(b);} break;
    case 'searchUI': {const s=sec(P,'البحث');row(s,'جملة البحث',textIn(d,'query',{dk:'q'}));row(s,'قبل الكتابة',textIn(d,'placeholder',{dk:'ph'}));row(s,'سطر فوق',textIn(d,'kicker',{dk:'kk'}));row(s,'الفلاتر',csvIn(d,'filters',{dk:'fl'}));
        row(s,'يبدأ يكتب',numIn(d,'typeAt',{min:0,max:d.dur,step:.05,unit:'ث'}));row(s,'سرعة الكتابة',numIn(d,'cps',{min:6,max:60,step:1,unit:'حرف/ث'}));row(s,'الضغطة',numIn(d,'clickAt',{min:.5,max:d.dur,step:.05,unit:'ث'}));row(s,'التحليل يبدأ',numIn(d,'statusAt',{min:.5,max:d.dur,step:.05,unit:'ث'}));}
      listItems(P,'سطور التحليل ({n} = عدّاد)',d.status||[],(b,r,n)=>{row(b,'سطر '+(n+1),textIn(r,'t',{dk:'st'+n}));row(b,'علامة يسار',textIn(r,'tag',{dk:'sg'+n}));if(r.count!=null)row(b,'العدّاد',numIn(r,'count',{min:0,max:1e7,step:1,dk:'sc'+n}));}); break;
    case 'cards3D': {const s=sec(P,'الحركة');row(s,'اختيار الكارت',numIn(d,'pickAt',{min:.6,max:d.dur-.6,step:.05,unit:'ث'}));row(s,'الكارت المختار',selectIn({h:d.cards.findIndex(c=>c.hero)},'h',d.cards.map((c,i)=>[i,c.title||('كارت '+(i+1))])));
        s.lastChild.querySelector('select').onchange=e=>edit(()=>{d.cards.forEach((c,i)=>{if(i==e.target.value)c.hero=true;else delete c.hero;});renderPanel();});}
      listItems(P,'الكروت',d.cards,(b,c,n)=>{row(b,'الصورة',...imageIn(c,'img'));row(b,'العنوان',textIn(c,'title',{dk:'ct'+n}));row(b,'المكان',textIn(c,'place',{dk:'cp'+n}));row(b,'السعر',textIn(c,'price',{dk:'cr'+n}));row(b,'تاجز',csvIn(c,'tags',{dk:'cg'+n}));row(b,'بادج',textIn(c,'badge',{dk:'cb'+n}));}); break;
    case 'mapPin': {const s=sec(P,'الدبوس');row(s,'الاسم',textIn(d.pin,'title',{dk:'pt'}));row(s,'تحت الاسم',textIn(d.pin,'sub',{dk:'ps'}));row(s,'ينزل عند',numIn(d,'pinAt',{min:.3,max:d.dur,step:.05,unit:'ث'}));}
      listItems(P,'أماكن قريبة',d.landmarks||[],(b,L,n)=>{row(b,'المكان',textIn(L,'name',{dk:'ln'+n}));row(b,'المسافة',textIn(L,'time',{dk:'lt'+n}));});
      listItems(P,'الشوارع',(d.roads||[]).filter(r=>r.name!=null),(b,r,n)=>row(b,'شارع '+(n+1),textIn(r,'name',{dk:'rn'+n}))); break;
    case 'iconGrid': {const s=sec(P,'الحركة');row(s,'تنوّر من',numIn(d,'onAt',{min:.3,max:d.dur,step:.05,unit:'ث'}));row(s,'بين كل واحدة',numIn(d,'step',{min:.05,max:.6,step:.01,unit:'ث'}));
        const im=el('button','toggle',d.implode!=null?'✓ تتسحب للنص في الآخر':'تتسحب للنص في الآخر');im.onclick=()=>edit(()=>{if(d.implode!=null)delete d.implode;else d.implode=Math.max(.5,d.dur-.6);renderPanel();});row(s,'',im);}
      listItems(P,'الأيقونات (اسم من lucide.dev/icons)',d.items,(b,o,n)=>{row(b,'الأيقونة',textIn(o,'icon',{dk:'ic'+n}));row(b,'الكلمة',textIn(o,'label',{dk:'il'+n}));}); break;
    case 'planCard': {const s=sec(P,'السعر');row(s,'العنوان',textIn(d.price,'label',{dk:'pl'}));row(s,'الرقم',numIn(d.price,'value',{min:0,max:1e10,step:1000,dk:'pv'}));row(s,'العملة',textIn(d.price,'unit',{dk:'pu'}));row(s,'عدد السنين (أعمدة)',numIn(d,'years',{min:0,max:15,step:1,dk:'py'}));row(s,'سطر تحت',textIn(d,'yearsLabel',{dk:'pyl'}));}
      listItems(P,'السطور',d.rows,(b,r,n)=>{row(b,'البند',textIn(r,'k',{dk:'rk'+n}));row(b,'القيمة',textIn(r,'v',{dk:'rv'+n}));}); break;
    case 'titleCard': {const s=sec(P,'الخلفية');row(s,'الخلفية',selectIn(d,'bg',[['dark','غامق'],['paper','ورق'],['brand','لون البراند']]));row(s,'سطر صغير فوق',textIn(d,'kicker',{dk:'kick'}));} break;
    case 'bigStat': {const s=sec(P,'الرقم');row(s,'الرقم',numIn(d,'value',{min:0,max:1e9,step:1,dk:'val'}));row(s,'الوحدة',textIn(d,'unit',{dk:'unit'}));row(s,'قبل الرقم',textIn(d,'prefix',{dk:'pre'}));
        row(s,'مدة العدّ',numIn(d,'countDur',{min:.2,max:4,step:.1,unit:'ث',dk:'cd'}));row(s,'دايرة عدّاد',toggleIn(d,'ring',d.ring?'أيوه':'لأ'));
        row(s,'الخلفية',selectIn(d,'bg',[['dark','غامق'],['paper','ورق'],['brand','لون البراند']]));row(s,'ملاحظة صغيرة',textIn(d,'note',{dk:'note'}));}
      wordsIn(P,d.sub,'الكلام تحت الرقم'); break;
    case 'ctaCard': {const s=sec(P,'التواصل');row(s,'الرقم',textIn(d,'phone',{dk:'ph'}));row(s,'سطر صغير',textIn(d,'small',{dk:'sm'}));row(s,'حجم اللوجو',numIn(d,'logoWidth',{min:150,max:800,step:10,unit:'px',dk:'lw2'}));} break;
    case 'outro': {const s=sec(P,'السطر تحت اللوجو');row(s,'الجزء الأول',textIn(d.tagline,0,{dk:'tg0'}));row(s,'بلون البراند',textIn(d.tagline,1,{dk:'tg1'}));row(s,'حجم اللوجو',numIn(d,'logoWidth',{min:260,max:960,step:10,unit:'px'}));} break;
  }
}
function brandPanel(P){const R=S.reel;
  const n=sec(P,'اسم الريل');n.appendChild(textIn(R,'name',{dk:'rname'}));
  const c=sec(P,'الألوان');Object.keys(R.brand.colors).forEach(k=>row(c,COLOR_NAME[k]||k,...colorIn(R.brand.colors,k,{dk:'c'+k})));
  const l=sec(P,'اللوجو');row(l,'اللوجو',...imageIn(R.brand,'logo'));row(l,'عرضه فوق',numIn(R.brand.logoBadge,'width',{min:80,max:300,step:5,unit:'px',dk:'lw'}));
  listItems(P,'الأطقم (الألوان المتاحة)',R.sets,(b,s,i)=>{row(b,'الاسم',textIn(s,'name',{dk:'sn'+i}));row(b,'الصورة',...imageIn(s,'img'));row(b,'لون الكارت',...colorIn(s,'card',{dk:'sc'+i}));});
}

// ---------- asset picker (+ add new images into the folder) ----------
function assetPicker(cur,done){const M=$('mbox');M.textContent='';M.appendChild(el('h2',null,'اختار صورة'));const G=el('div','grid');
  Object.entries(S.reel.assets).forEach(([k,p])=>{ if(!/\.(png|jpe?g|webp)$/i.test(p))return; const b=el('button',k===cur?'on':'');const im=el('div','im');
    if(S.urls[p])im.style.backgroundImage=`url("${S.urls[p]}")`;b.append(im,el('span',null,k));b.onclick=()=>{closeModal();done(k);};G.appendChild(b);});
  const add=el('button','add','＋ صورة من جهازك');const f=el('input');f.type='file';f.accept='image/png,image/jpeg,image/webp';f.style.display='none';
  add.onclick=()=>f.click(); f.onchange=async()=>{const file=f.files[0];if(!file)return;
    const safe=file.name.replace(/[^\w.\-]+/g,'_'); const path='images/'+safe; await writeAt(path,file);
    let k=safe.replace(/\.[^.]+$/,'').toLowerCase().slice(0,24)||'img',n=k,x=2;while(S.reel.assets[n])n=k+'_'+x++;
    delete S.urls[path]; S.reel.assets[n]=path; await loadAssets(); closeModal(); done(n); toast('الصورة اتضافت للفولدر');};
  G.appendChild(add);M.append(G,f);openModal();}
function addVideo(done){const f=el('input');f.type='file';f.accept='video/mp4,video/quicktime,video/webm';f.onchange=async()=>{const file=f.files[0];if(!file)return;toast('بيضيف الفيديو…');
  const safe=file.name.replace(/[^\w.\-]+/g,'_');let k=safe.replace(/\.[^.]+$/,'').toLowerCase().slice(0,20)||'clip',n=k,x=2;S.reel.clips=S.reel.clips||{};while(S.reel.clips[n])n=k+'_'+x++;
  const path='clips/'+n+safe.slice(safe.lastIndexOf('.'));await writeAt(path,file);const c={video:path,dir:`clips/${n}F/`,n:0};await loadClip(n,c);
  const v=S.videos[n];c.n=Math.max(1,Math.floor((v&&v.duration||3)*30));S.reel.clips[n]=c;done(n);toast('الفيديو اتضاف للفولدر');};f.click();}
function openModal(){$('modal').style.display='';}function closeModal(){$('modal').style.display='none';}
$('modal').addEventListener('pointerdown',e=>{if(e.target.id==='modal'&&!S.exporting)closeModal();});

// ---------- export (in the browser, no install) ----------
async function exportMp4(){ if(!('VideoEncoder' in window)){toast('المتصفح ده مايدعمش التصدير — استخدم Chrome');return;}
  pause(); if(S.dirty)await save(); const [W,H]=S.reel.size, fps=S.reel.fps||30;
  let codec=null; for(const [c,m] of [['avc1.640028','avc'],['avc1.4d0028','avc'],['vp09.00.40.08','vp9']]){
    try{const r=await VideoEncoder.isConfigSupported({codec:c,width:W,height:H,bitrate:12e6,framerate:fps});if(r.supported){codec=[c,m];break;}}catch(e){} }
  if(!codec){toast('مفيش كوديك فيديو متاح في المتصفح ده');return;}
  const M=$('mbox');M.textContent='';M.append(el('h2',null,'Export MP4'),el('p','hint','بيرندر بالموشن بلر الكامل. سيب التاب مفتوحة لحد ما يخلص. (من غير مزيكا)'));
  const bar=el('div','bar'),fill=el('i');bar.appendChild(fill);const info=el('div','hint','');const r=el('div','mrow');const cancel=el('button','ghost','إلغاء');r.appendChild(cancel);M.append(bar,info,r);openModal();
  S.exporting=true;let stop=false;cancel.onclick=()=>{stop=true;};
  const cv=document.createElement('canvas');const eng=ReelEngine.create(cv,S.reel,{images:S.images,lotties:S.lotties,clip:clipHook,needClip:needHook,scale:1,sub:5});
  const N=Math.round(eng.DUR*fps);
  const muxer=new Mp4Muxer.Muxer({target:new Mp4Muxer.ArrayBufferTarget(),video:{codec:codec[1],width:W,height:H,frameRate:fps},fastStart:'in-memory'});
  let err=null;const enc=new VideoEncoder({output:(ch,meta)=>muxer.addVideoChunk(ch,meta),error:e=>{err=e;}});
  enc.configure({codec:codec[0],width:W,height:H,bitrate:12e6,framerate:fps,latencyMode:'quality'});
  const t0=performance.now();
  try{for(let i=0;i<N;i++){ if(stop||err)break;
      await eng.render(i/fps,i);
      const vf=new VideoFrame(cv,{timestamp:Math.round(i*1e6/fps),duration:Math.round(1e6/fps)});enc.encode(vf,{keyFrame:i%60===0});vf.close();
      while(enc.encodeQueueSize>3)await new Promise(r=>setTimeout(r,4));
      if(i%3===0){const p=(i+1)/N;fill.style.width=(p*100).toFixed(1)+'%';const el_=(performance.now()-t0)/1000;info.textContent=`${i+1} / ${N} فريم · فاضل تقريباً ${Math.max(0,Math.round(el_/p-el_))} ث`;}}
    if(stop||err){enc.close();S.exporting=false;closeModal();toast(err?'حصلت مشكلة في التصدير':'اتلغى');if(err)console.error(err);return;}
    await enc.flush();enc.close();muxer.finalize();
    const d=new Date(),p=n=>String(n).padStart(2,'0');const name=`renders/${(S.reel.name||'reel').replace(/[^\w؀-ۿ\- ]+/g,'').trim().replace(/\s+/g,'-')}-${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.mp4`;
    await writeAt(name,new Blob([muxer.target.buffer],{type:'video/mp4'}));
    M.textContent='';M.append(el('h2',null,'خلص ✓'),el('p','hint','اتحفظ في الفولدر:'),el('code',null,name));const ok=el('button','cu','تمام');ok.onclick=closeModal;const rr=el('div','mrow');rr.appendChild(ok);M.appendChild(rr);
  }catch(e){console.error(e);toast('حصلت مشكلة في التصدير');closeModal();}
  S.exporting=false; paint();}

// ---------- misc ----------
let toastT=0;function toast(s){const t=$('toast');t.textContent=s;t.style.display='';clearTimeout(toastT);toastT=setTimeout(()=>t.style.display='none',2200);}
async function saveAs(){const M=$('mbox');M.textContent='';M.appendChild(el('h2',null,'احفظ كنسخة جديدة'));const i=el('input','in');i.placeholder='مثلاً: ستايل-2';i.dir='auto';
  const r=el('div','mrow');const ok=el('button','cu','احفظ');const no=el('button','ghost','إلغاء');r.append(ok,no);M.append(i,el('div','hint','هتتحفظ جنب الأصلية، وبعدها التعديلات بتروح على النسخة الجديدة.'),r);openModal();i.focus();
  no.onclick=closeModal;ok.onclick=async()=>{const n=i.value.trim().replace(/[^\w؀-ۿ\-]+/g,'-');if(!n)return;const f=`reel-${n}.json`;
    await writeAt(f,JSON.stringify(S.reel,null,2));S.file=f;S.savedOnce=true;closeModal();setSave('محفوظ ✓');$('projName').textContent=`${S.reel.name} · ${n}`;toast('اتعملت نسخة: '+f);};}
async function copyClaude(){const sc=S.reel.scenes[S.sel];const msg=`رندر «${S.reel.name}» — الفولدر: ${S.dir.name} — الملف: ${S.file}${sc?` (أو المشهد «${sc.label||sc.id}» بس)`:''}`;
  try{await navigator.clipboard.writeText(msg);toast('اتنسخت الرسالة — الزقها لـ Claude');}catch(e){toast(msg);}}

$('btnOpen').onclick=pickFolder; $('btnPlay').onclick=()=>S.playing?pause():play();
$('btnUndo').onclick=undo; $('btnRedo').onclick=redo; $('btnExport').onclick=exportMp4; $('btnSaveAs').onclick=saveAs; $('btnClaude').onclick=copyClaude;
$('btnSafe').onclick=()=>{S.safe=!S.safe;$('safe').style.display=S.safe?'':'none';$('btnSafe').classList.toggle('on',S.safe);};
window.addEventListener('keydown',e=>{ if(!S.reel||S.exporting)return; const typing=/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
  const mod=e.metaKey||e.ctrlKey;
  if(mod&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}
  if(mod&&e.key.toLowerCase()==='s'){e.preventDefault();clearTimeout(S.saveTimer);save();return;}
  if(typing)return;
  if(e.code==='Space'){e.preventDefault();S.playing?pause():play();}
  else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();const dir=(e.key==='ArrowRight')?1:-1;seek(S.t+dir*(e.shiftKey?1:1/30));}
  else if(e.key.toLowerCase()==='s'&&!mod)$('btnSafe').click();});
// back to the tab: if reel.json changed outside (Claude edited it) and we have no unsaved edits → reload it
window.addEventListener('focus',async()=>{ if(!S.dir||S.dirty||S.exporting)return; try{const f=await fileAt(S.file);
  if(S.mtime&&f.lastModified!==S.mtime){S.mtime=f.lastModified;S.reel=JSON.parse(await f.text());await loadAssets();for(const [k,c] of Object.entries(S.reel.clips||{}))if(!S.videos[k])await loadClip(k,c);afterEditNoSave();renderPanel();toast('اتحدّث من الملف');}}catch(e){}});
function afterEditNoSave(){S.eng=makeEngine($('cv'),PREVIEW_SCALE,1);$('tDur').textContent=fmt(S.eng.DUR);drawTimeline();paint();}
window.addEventListener('beforeunload',e=>{if(S.dirty){e.preventDefault();e.returnValue='';}});

(async()=>{ if(!window.showDirectoryPicker){$('noFs').style.display='';$('btnOpen').disabled=true;$('btnOpen').style.opacity=.4;return;}
  const h=await lastDir(); if(h){const b=$('btnResume');b.style.display='';b.textContent='كمّل: '+h.name;
    b.onclick=async()=>{try{if(await h.requestPermission({mode:'readwrite'})==='granted')return openDir(h);}catch(e){} pickFolder();};}})();
