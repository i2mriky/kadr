// ================= REEL ENGINE v5.3 — data-driven (3D UI kit, icons, Lottie, sound cues) =================
// Everything editable lives in reel.json. This file = drawing primitives + scene types + compositor.
// Rule: a scene type reads its numbers/text from `d` (its JSON entry). No copy text in here.
// Host usage:  const eng = ReelEngine.create(canvas, reelJson, {images, clip, needClip, scale, sub})
//   images: {assetKey: Image|ImageBitmap}   clip(name, lt) → drawable|null   needClip(name, lt) → Promise|null
//   eng.render(t, frameNo) async · eng.DUR · eng.scenes [{id,s,e}]
window.ReelEngine={create(main,R,O={}){
const [W,H]=R.size, FPS=R.fps, SCALE=O.scale||1;
main.width=Math.round(W*SCALE); main.height=Math.round(H*SCALE); const mctx=main.getContext('2d');
const off=document.createElement('canvas'); off.width=main.width; off.height=main.height; const ctx=off.getContext('2d');
const C=R.brand.colors;
const col=v=>(typeof v==='string'&&v[0]==='$')?C[v.slice(1)]:v;   // "$red" → brand red
const IM=O.images||{};

// ---------- easing ----------
const bez=(x1,y1,x2,y2)=>t=>{let u=t;for(let i=0;i<8;i++){const x=3*(1-u)**2*u*x1+3*(1-u)*u*u*x2+u**3-t;const dx=3*(1-u)**2*x1+6*(1-u)*u*(x2-x1)+3*u*u*(1-x2);if(Math.abs(dx)<1e-6)break;u-=x/dx;}u=Math.min(1,Math.max(0,u));return 3*(1-u)**2*u*y1+3*(1-u)*u*u*y2+u**3;};
const E={out:bez(.16,1,.3,1), inOut:bez(.65,0,.35,1), snap:bez(.45,0,.15,1), expand:bez(.5,0,.15,1), whip:bez(.77,0,.175,1), in:bez(.32,0,.67,0), back:bez(.34,1.56,.64,1), sine:t=>.5-.5*Math.cos(Math.PI*t)};
const spring=(t,k=210,c=12)=>{if(t<=0)return 0;const w0=Math.sqrt(k),z=c/(2*Math.sqrt(k));const wd=w0*Math.sqrt(1-z*z);return 1-Math.exp(-z*w0*t)*(Math.cos(wd*t)+z*w0/wd*Math.sin(wd*t));};
const cl=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)), seg=(t,a,b)=>cl((t-a)/(b-a)), lerp=(a,b,p)=>a+(b-a)*p;

// ---------- surfaces ----------
let NOISE; function mkNoise(){let _s=1337;const rnd=()=>{_s|=0;_s=_s+0x6D2B79F5|0;let t=Math.imul(_s^_s>>>15,1|_s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
  NOISE=document.createElement('canvas');NOISE.width=NOISE.height=256;const g=NOISE.getContext('2d');const d=g.createImageData(256,256);for(let i=0;i<d.data.length;i+=4){const v=rnd()*255;d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=255;}g.putImageData(d,0,0);}
function grain(fr){ctx.save();ctx.globalAlpha=.035;const ox=(fr*97)%256, oy=(fr*57)%256;ctx.translate(-ox,-oy);ctx.fillStyle=ctx.createPattern(NOISE,'repeat');ctx.fillRect(0,0,W+256,H+256);ctx.restore();}
function paper(c=C.paper,ribs=true,t=0){
  ctx.fillStyle=c;ctx.fillRect(0,0,W,H);
  if(ribs){ctx.save();ctx.globalAlpha=.055;ctx.fillStyle='#000';for(let x=12;x<W;x+=26)ctx.fillRect(x,0,3,H);ctx.restore();}
  const gx=W/2+120*Math.sin(t*.35), gy=H*.52+80*Math.cos(t*.3);
  const g=ctx.createRadialGradient(gx,gy,100,gx,gy,1200);g.addColorStop(0,'rgba(255,255,255,.55)');g.addColorStop(.6,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(60,40,20,.10)');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
}
function redField(t){ctx.fillStyle=C.red;ctx.fillRect(0,0,W,H);
  const gx=W/2+140*Math.sin(t*.4), gy=H*.55;const g=ctx.createRadialGradient(gx,gy,80,gx,gy,1150);
  g.addColorStop(0,'rgba(255,90,90,.45)');g.addColorStop(1,'rgba(90,0,10,.35)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);}
function rr(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function card(x,y,w,h,{r=44,fill=C.card,rim='rgba(255,255,255,.9)',shadow=.22,glow=true}={}){
  ctx.save();ctx.shadowColor=`rgba(40,20,10,${shadow})`;ctx.shadowBlur=60;ctx.shadowOffsetY=26;rr(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();ctx.restore();
  if(glow){ctx.save();rr(x,y,w,h,r);ctx.clip();const g=ctx.createRadialGradient(x+w/2,y+h*1.15,10,x+w/2,y+h*1.15,h*.95);g.addColorStop(0,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(x,y,w,h);ctx.restore();}
  ctx.save();rr(x+1,y+1,w-2,h-2,r);ctx.strokeStyle=rim;ctx.lineWidth=2;ctx.stroke();ctx.restore();
}
function cshadow(cx,by,w,a=.35){ctx.save();const g=ctx.createRadialGradient(cx,by,0,cx,by,w/2);g.addColorStop(0,`rgba(30,20,10,${a})`);g.addColorStop(1,'rgba(30,20,10,0)');ctx.translate(cx,by);ctx.scale(1,.08);ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,w/2,0,7);ctx.fill();ctx.restore();}
const SH=document.createElement('canvas'), shc=SH.getContext('2d');
function prod(img,cx,by,w,{a=1,sc=1,sh=.33,sheen=-1,rot=0}={}){ if(!img||a<=0)return; const h=w*img.height/img.width;
  ctx.save();ctx.globalAlpha=a;cshadow(cx,by-3,w*1.02*sc,sh);ctx.translate(cx,by);ctx.rotate(rot);ctx.scale(sc,sc);
  if(sheen>=0&&sheen<=1){SH.width=Math.ceil(w);SH.height=Math.ceil(h);shc.clearRect(0,0,w,h);shc.drawImage(img,0,0,w,h);shc.globalCompositeOperation='source-atop';
    const cx2=lerp(-.5,1.5,E.inOut(sheen))*w;const g=shc.createLinearGradient(cx2-w*.25,0,cx2+w*.25,h*.35);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.5,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');
    shc.fillStyle=g;shc.fillRect(0,0,w,h);shc.globalCompositeOperation='source-over';ctx.drawImage(SH,-w/2,-h);}
  else ctx.drawImage(img,-w/2,-h,w,h);
  ctx.restore(); return h;}
function cover(img,fx,fy,sc,box=[0,0,W,H]){if(!img)return;const iw=img.videoWidth||img.width, ih=img.videoHeight||img.height;const[bx,by,bw,bh]=box;const s=Math.max(bw/iw,bh/ih)*sc;ctx.drawImage(img,bx+bw/2-fx*s,by+bh/2-fy*s,iw*s,ih*s);}
function cam(s,fx,fy,tx=W/2,ty=H/2,rot=0){ctx.translate(tx,ty);ctx.rotate(rot);ctx.scale(s,s);ctx.translate(-fx,-fy);}

// ---------- type (RTL, word-level) ----------
const hash=(a,b)=>{let h=(a*374761393+b*668265263)|0;h=Math.imul(h^h>>>13,1274126177);return((h^h>>>16)>>>0)/4294967296;};
const GLY_L='ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#$%&@*+=?', GLY_A='ابتثجحخدذرزسشصضطظعغفقكلمنهوي';
function words(list,t,y,size,{col:c=C.ink,red=C.red,w=900,exit=99,st=.09,font='TH',fx='',hl=null,hlText=null}={}){
  ctx.save();ctx.font=`${w} ${size}px ${font}`;let sp=size*.26;let ws=list.map(o=>ctx.measureText(o.w).width);
  {const t0=ws.reduce((a,b)=>a+b,0)+sp*(list.length-1),mx=W*.88; if(t0>mx){size=size*mx/t0;ctx.font=`${w} ${size}px ${font}`;sp=size*.26;ws=list.map(o=>ctx.measureText(o.w).width);}} // auto-fit long lines
  const tot=ws.reduce((a,b)=>a+b,0)+sp*(list.length-1);let x=W/2+tot/2;
  if(!fx){
  list.forEach((o,i)=>{const at=(o.at??i*st);const p=E.out(seg(t,at,at+.7));const q=E.in(seg(t,exit+i*.03,exit+i*.03+.3));
    if(p>0&&q<1){ctx.save();ctx.globalAlpha=p*(1-q);ctx.fillStyle=o.red?red:c;ctx.textAlign='right';
      const yy=y+size*.55*(1-p)-size*.7*q;ctx.translate(x,yy);ctx.scale(1,1+.35*(1-p));
      ctx.shadowColor='rgba(0,0,0,.10)';ctx.shadowBlur=18;ctx.shadowOffsetY=4;ctx.fillText(o.w,0,0);ctx.restore();}
    x-=ws[i]+sp;});ctx.restore();return;}
  // fx: 'type' (typewriter + cursor) · 'decode' (random glyphs resolve) · 'hl' (brand block behind key words)
  const fr=Math.floor(t*24); let lastX=null;
  list.forEach((o,i)=>{const at=(o.at??i*st);const q=E.in(seg(t,exit+i*.03,exit+i*.03+.3));
    const isAr=/[\u0600-\u06FF]/.test(o.w); let txt=o.w, a=1, dy=0;
    if(fx==='type'){const n=Math.ceil(o.w.length*seg(t,at,at+Math.max(.12,o.w.length*.045)));txt=o.w.slice(0,n);a=n>0?1:0;if(n>0)lastX=x-ctx.measureText(txt).width;}
    else if(fx==='decode'){const p=seg(t,at,at+.55);a=p>0?1:0;const G=isAr?GLY_A:GLY_L;
      txt=[...o.w].map((ch,j)=>(ch===' '||hash(i*31+j,1)<p*1.15)?ch:G[Math.floor(hash(i*31+j,fr)*G.length)]).join('');}
    else if(fx==='hl'){const p=E.out(seg(t,at,at+.6));a=p;dy=size*.35*(1-p);}
    if(a>0&&q<1){ctx.save();ctx.globalAlpha=a*(1-q);ctx.textAlign='right';
      const yy=y+dy-size*.7*q;
      if(o.red&&(fx==='hl'||hl)){const hp=E.snap(seg(t,at+.1,at+.45));const pad=size*.14;
        ctx.fillStyle=col(hl)||red;ctx.fillRect(x+pad-(ws[i]+2*pad)*hp,yy-size*.86,(ws[i]+2*pad)*hp,size*1.12);
        ctx.fillStyle=hp>.5?(col(hlText)||'#111'):c;}
      else ctx.fillStyle=o.red?red:c;
      ctx.fillText(txt,x,yy);ctx.restore();}
    x-=ws[i]+sp;});
  if(fx==='type'&&lastX!==null&&Math.floor(t*2.2)%2===0){ctx.fillStyle=red;ctx.fillRect(lastX-size*.12,y-size*.8,size*.07,size*.95);}
  ctx.restore();}
// JSON text block → words()
function T(tx,t,over={}){ if(!tx)return; const o={};
  if(tx.col!==undefined)o.col=col(tx.col); if(tx.st!==undefined)o.st=tx.st; if(tx.exit!==undefined)o.exit=tx.exit; if(tx.weight!==undefined)o.w=tx.weight; if(tx.fx)o.fx=tx.fx; if(tx.hl)o.hl=tx.hl; if(tx.hlText)o.hlText=tx.hlText; if(tx.font)o.font=tx.font;
  words(tx.words,t,tx.y,tx.size,Object.assign(o,over)); }
function label(txt,t,at,x,y,size,c,{font='BW',w=700,align='center',ls='1px',exit=99}={}){const p=E.out(seg(t,at,at+.5)),q=seg(t,exit,exit+.25);if(p<=0||q>=1)return;
  ctx.save();ctx.globalAlpha=p*(1-q);ctx.fillStyle=c;ctx.font=`${w} ${size}px ${font}`;ctx.textAlign=align;ctx.letterSpacing=ls;ctx.fillText(txt,x,y+18*(1-p));ctx.restore();}
function logoBadge(a=1){ const img=IM[R.brand.logo]; if(a<=0||!img)return; const b=R.brand.logoBadge, w=b.width, h=w*img.height/img.width;
  ctx.save();ctx.globalAlpha=a;ctx.shadowColor='rgba(255,255,255,.9)';ctx.shadowBlur=18;ctx.drawImage(img,W/2-w/2,b.y,w,h);ctx.restore();}

// ---------- clips (frame sequences, loaded on demand) ----------
const needClip=(c,lt)=>O.needClip?O.needClip(c,lt):null;
function drawClip(c,lt,sc=1,fy=960){const im=O.clip&&O.clip(c,lt);if(!im)return;const iw=im.videoWidth||im.width,ih=im.videoHeight||im.height;cover(im,iw/2,fy*ih/H,sc);} // fy in 1080x1920 space, any source size
function pocket(h=760,a=.93){const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,`rgba(243,239,233,${a})`);g.addColorStop(.55,`rgba(243,239,233,${a*.85})`);g.addColorStop(1,'rgba(243,239,233,0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,h);}

// ================= SCENE TYPES =================
// each: draw(t, d) where t = local time, d = the scene's JSON (+ d.s = start). optional need(t,d).
const TYPES={};

TYPES.hookPullback={draw(t,d){
  paper(C.paper,true,t+d.s);
  const F=d.focus, p=E.snap(seg(t,0,1.25));
  const sc=lerp(d.startZoom,1,p)*(1+.03*E.sine(seg(t,1.25,2.5)));
  const fx=lerp(F[0],540,p), fy=lerp(F[1]+60,1010,p);
  ctx.save();cam(sc,fx,fy);prod(IM[d.product],540,d.productBottom,d.productWidth,{sheen:seg(t,1.3,2.1)});ctx.restore();
  T(d.text,t);
}};

TYPES.pressToClip={draw(t,d){
  if(t<d.clipAt){
    paper(C.paper,true,t+d.s);
    const img=IM[d.product], w=d.productWidth, h=w*img.height/img.width, s=w/img.width, cx=540, by=d.productBottom, top=by-h;
    const dn=E.in(seg(t,.55,.72)), up=spring(seg(t,.8,1.4),260,14);
    const press=d.pressDepth*dn*(1-up);
    const push=1+.05*E.sine(seg(t,0,1.5));
    ctx.save();cam(push,cx,top+320,cx,top+320);
    cshadow(cx,by-3,w*1.02,.38);
    const cut=d.capCut;ctx.drawImage(img,0,cut,img.width,img.height-cut,cx-w/2,top+cut*s,w,h-cut*s);
    ctx.save();ctx.beginPath();ctx.rect(0,0,W,top+cut*s+3);ctx.clip();ctx.drawImage(img,0,0,img.width,cut,cx-w/2,top+press,w,cut*s);ctx.restore();
    const tx=cx+40, ty=top+110+press, a=seg(t,.2,.62), b=seg(t,.7,1.45);
    ctx.save();ctx.strokeStyle=C.red;ctx.fillStyle=C.red;
    if(a>0&&b<1){ctx.globalAlpha=1-b;ctx.lineWidth=6;ctx.beginPath();ctx.arc(tx,ty,150-122*E.out(a),0,7);ctx.stroke();
      ctx.beginPath();ctx.arc(tx,ty,15*E.back(a),0,7);ctx.fill();}
    for(let i=0;i<3;i++){const bb=seg(t,.72+i*.09,1.45+i*.09);if(bb>0&&bb<1){ctx.globalAlpha=(1-bb)*.75;ctx.lineWidth=5-i;ctx.beginPath();ctx.arc(tx,ty,30+360*E.out(bb),0,7);ctx.stroke();}}
    ctx.restore();ctx.restore();
  } else {
    const lt=t-d.clipAt; drawClip(d.clip,lt,d.clipZoom+.03*E.sine(seg(lt,0,2.5)),d.clipFocusY);
    pocket(700,.9);
  }
  T(d.text,t);
},need(t,d){return t>=d.clipAt?needClip(d.clip,t-d.clipAt):null;}};

TYPES.bentoThree={draw(t,d){
  redField(t);
  const np=spring(seg(t,.05,1.2),200,12);ctx.save();ctx.fillStyle='#fff';ctx.font='900 230px BW';ctx.textAlign='center';
  ctx.globalAlpha=cl(np*2);ctx.translate(540,470);ctx.scale(.75+.25*np,.75+.25*np);ctx.fillText(d.number,0,0);ctx.restore();
  T(d.text,t);
  const L=d.layout, m=E.snap(seg(t,d.morphAt[0],d.morphAt[1]));
  const tw=(W-2*L.x0-L.gap)/2;
  const slot={tallRight:[L.x0+tw+L.gap,L.tallY,tw,L.tallH],tallLeft:[L.x0,L.tallY,tw,L.tallH],wide:[L.x0,L.wideY,W-2*L.x0,L.wideH]};
  const cards=d.cards.map(c=>[c,...slot[c.slot]]);
  cards.sort((a,b)=>(!!a[0].morphTo)-(!!b[0].morphTo));
  cards.forEach(([c,x,y,w,h])=>{
    const at=c.at, p=spring(seg(t,at,at+1.3),190,14); if(p<=0)return;
    const isM=!!c.morphTo; let X=x,Y=y+(1-Math.min(p,1))*380,Ww=w,Hh=h,Rr=36;
    if(isM&&m>0){X=lerp(x,-40,m);Y=lerp(y,-40,m);Ww=lerp(w,W+80,m);Hh=lerp(h,H+80,m);Rr=lerp(36,0,m);}
    ctx.save(); if(!isM&&m>0)ctx.globalAlpha=1-m; else ctx.globalAlpha=cl(p*3);
    const tilt=(1-p)*c.tilt;ctx.translate(X+Ww/2,Y+Hh);ctx.rotate(tilt);ctx.translate(-(X+Ww/2),-(Y+Hh));
    card(X,Y,Ww,Hh,{r:Rr,fill:'#D9D1C6',rim:'rgba(255,255,255,.55)',shadow:.3});
    if(isM&&m>0){ctx.save();rr(X,Y,Ww,Hh,Rr);ctx.clip();ctx.globalAlpha=m;cover(IM[c.morphTo],640,1060,1.08,[X,Y,Ww,Hh]);ctx.restore();}
    const fade=isM?cl(1-m/.5):1;
    if(fade>0){ctx.save();ctx.globalAlpha*=fade;prod(IM[c.img],X+Ww/2+c.dx,Y+Hh-c.dy,c.imgW,{sh:.28,sheen:seg(t,at+.9,at+1.6)});
      ctx.fillStyle=C.ink;ctx.font='800 24px BW';ctx.letterSpacing='3px';ctx.textAlign='left';ctx.fillText(c.label.toUpperCase(),X+28,Y+48);ctx.restore();}
    ctx.restore();
  });
}};

TYPES.loupe={draw(t,d){
  ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);
  const img=IM[d.image]; if(!img)return;
  const z=1.08+.07*E.sine(seg(t,0,3));const base=d.base;cover(img,base[0],base[1],z);
  pocket(720,.97);
  T(d.text,t);
  const s=Math.max(W/img.width,H/img.height)*z;
  const toScr=(x,y)=>[W/2+(x-base[0])*s, H/2+(y-base[1])*s];
  const P0=toScr(...d.path[0]), P1=toScr(...d.path[1]), P2=toScr(...d.path[2]);
  const p=E.inOut(seg(t,.35,2.1)); const ap=E.out(seg(t,.2,.6));
  const lx=p<.5?lerp(P0[0],P1[0],p*2):lerp(P1[0],P2[0],(p-.5)*2), ly=p<.5?lerp(P0[1],P1[1],p*2):lerp(P1[1],P2[1],(p-.5)*2);
  const Rr=d.radius*ap*(1+.04*Math.sin(Math.PI*seg(t,2.1,2.4))), mag=d.mag;
  if(Rr>2){ctx.save();ctx.shadowColor='rgba(0,0,0,.35)';ctx.shadowBlur=50;ctx.shadowOffsetY=20;ctx.beginPath();ctx.arc(lx,ly,Rr,0,7);ctx.fillStyle='#fff';ctx.fill();ctx.restore();
    ctx.save();ctx.beginPath();ctx.arc(lx,ly,Rr-8,0,7);ctx.clip();
    const sx=base[0]+(lx-W/2)/s, sy=base[1]+(ly-H/2)/s; const S2=s*mag; ctx.drawImage(img,lx-sx*S2,ly-sy*S2,img.width*S2,img.height*S2);
    const hl=ctx.createLinearGradient(lx-Rr,ly-Rr,lx+Rr,ly+Rr);hl.addColorStop(0,'rgba(255,255,255,.28)');hl.addColorStop(.4,'rgba(255,255,255,0)');ctx.fillStyle=hl;ctx.fillRect(lx-Rr,ly-Rr,2*Rr,2*Rr);ctx.restore();
    ctx.save();ctx.strokeStyle=C.red;ctx.lineWidth=5;ctx.beginPath();ctx.arc(lx,ly,Rr+6,0,7);ctx.stroke();ctx.restore();
    const pill=(txt,a)=>{if(a<=0)return;ctx.save();ctx.globalAlpha=a;ctx.font='700 40px TH';const tw=ctx.measureText(txt).width;const x=lx, y=ly+Rr+40;
      rr(x-tw/2-30,y,tw+60,70,35);ctx.fillStyle=C.red;ctx.fill();ctx.fillStyle='#fff';ctx.textAlign='center';ctx.fillText(txt,x,y+50);ctx.restore();};
    d.pills.forEach(pl=>{let a=seg(t,pl.in[0],pl.in[1]); if(pl.out)a=a*(1-seg(t,pl.out[0],pl.out[1])); pill(pl.text,a);});
  }
}};

TYPES.clipFull={draw(t,d){
  drawClip(d.clip,t,d.zoom+.03*E.sine(seg(t,0,2.5)),d.focusY);
  pocket(700,.9);
  T(d.text,t);
},need(t,d){return needClip(d.clip,t);}};

function v1bg(dark){ctx.fillStyle=dark?'#1D1B1A':'#F2EEE8';ctx.fillRect(0,0,W,H);
  ctx.save();ctx.globalAlpha=dark?.045:.05;ctx.fillStyle=dark?'#fff':'#000';for(let x=9;x<W;x+=22)ctx.fillRect(x,0,2,H);ctx.restore();
  const g=ctx.createRadialGradient(W/2,H*.55,200,W/2,H*.55,1250);g.addColorStop(0,'rgba(255,255,255,'+(dark?.06:.25)+')');g.addColorStop(1,'rgba(0,0,0,'+(dark?.35:.10)+')');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);}
const v1spring=x=>x<=0?0:1-Math.exp(-7*x)*Math.cos(10*x);
TYPES.coloursOnBeat={draw(lt,d){
  const K=d.colours, N=K.length, last=N-1, O=d.rippleFrom;
  const k=cl(Math.floor((lt-.5)/1.0),0,last), kt=lt-.5-k*1.0;
  const drawColour=i=>{const dk=!!K[i].dark;v1bg(dk);const bounce=i===k?v1spring(cl(kt/.8)):1;
    prod(IM[R.sets[K[i].set].img],540,d.productBottom,d.productWidth,{sc:.94+.06*bounce,sh:dk?.45:.3});};
  drawColour(k);
  if(k<last){const rt=seg(kt,.78,1.0);if(rt>0){ctx.save();ctx.beginPath();ctx.arc(O[0],O[1],2300*E.inOut(rt),0,7);ctx.clip();drawColour(k+1);ctx.restore();}}
  const kk=Math.min(last,k+(kt>.9&&k<last?1:0)), dk=!!K[kk].dark;
  T(d.text,lt,{col:dk?'#F5F1EC':C.ink});
  for(let i=0;i<N;i++){const x=540+(i-(N-1)/2)*110,y=1600,act=i===kk;const p=E.out(seg(lt,.1+i*.06,.5+i*.06));if(p<=0)continue;
    ctx.save();ctx.globalAlpha=p;ctx.fillStyle=K[i].rim;ctx.beginPath();ctx.arc(x,y,act?40:28,0,7);ctx.fill();
    ctx.fillStyle=K[i].swatch;ctx.beginPath();ctx.arc(x,y,act?30:20,0,7);ctx.fill();
    if(act){ctx.strokeStyle=C.red;ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,50,0,7);ctx.stroke();}ctx.restore();}
  ctx.save();ctx.fillStyle=dk?'#F5F1EC':'#141212';ctx.font='800 40px BW';ctx.textAlign='center';ctx.letterSpacing='2px';
  ctx.globalAlpha=E.out(seg(lt,.3,.7));ctx.fillText(R.sets[K[kk].set].name,W/2,1520);ctx.restore();
}};

TYPES.bentoPick={draw(t,d){
  paper(C.paper,true,t+d.s);
  T(d.text,t);
  const n0=d.cards.length-1;
  d.cards.forEach(({set,x,y,w,h},n)=>{const at=.15+n*.1;const p=spring(seg(t,at,at+1.3),200,13);if(p<=0)return;const S=R.sets[set];
    const ex=E.in(seg(t,d.exitAt+(n0-n)*.03,d.exitAt+.5+(n0-n)*.03))*1400;
    ctx.save();const tilt=(1-p)*(n%2?.2:-.2);ctx.translate(x+w/2+ex,y+h);ctx.rotate(tilt);ctx.scale(.85+.15*p,.85+.15*p);ctx.translate(-(x+w/2),-(y+h));
    ctx.globalAlpha=cl(p*3);card(x,y+(1-p)*260,w,h,{fill:S.card,r:40});
    const yy=y+(1-p)*260;prod(IM[S.img],x+w/2,yy+h-86,w*.8,{sh:.25,sheen:seg(t,1.3+n*.08,2.0+n*.08)});
    ctx.fillStyle=C.ink;ctx.font='800 24px BW';ctx.textAlign='center';ctx.letterSpacing='2px';ctx.fillText(S.name,x+w/2,yy+h-34);ctx.restore();});
}};

TYPES.filmstrip={draw(t,d){
  paper(C.paper,true,t+d.s);
  const cw=700,ch=930,gap=46,y0=560;
  const settle=E.out(seg(t,0,.9)); const travel=-(cw+gap)*1.2*(1-settle) + (cw+gap)*2.0*E.inOut(seg(t,.7,2.5));
  d.images.forEach((m,i)=>{const img=IM[m.img]; if(!img)return; const X=W/2-cw/2-(i*(cw+gap))+travel+ (cw+gap)*0.0; if(X>W+50||X+cw<-50)return;
    const dd=(X+cw/2-W/2)/W; ctx.save();ctx.translate(X+cw/2,y0+ch/2);ctx.rotate(dd*.08);const sc=1-Math.abs(dd)*.12;ctx.scale(sc,sc);ctx.translate(-(X+cw/2),-(y0+ch/2));
    card(X-8,y0-8,cw+16,ch+16,{r:44,glow:false});ctx.save();rr(X,y0,cw,ch,38);ctx.clip();
    const f=m.focus||[img.width/2,img.height*.6], z=(m.zoom??1.02), zr=(m.zoomRate??.04);
    cover(img,f[0],f[1],z+zr*t,[X,y0,cw,ch]);ctx.restore();ctx.restore();});
  ctx.save();ctx.fillStyle=C.ink;ctx.font='900 92px BW';ctx.textAlign='center';const p=E.out(seg(t,.2,.8));ctx.globalAlpha=p;ctx.fillText(d.title,W/2,370+30*(1-p));ctx.restore();
  T(d.text,t);
  label(d.caption,t,.7,W/2,1580,26,C.mut,{exit:d.text.exit});
}};

TYPES.outro={draw(t,d){
  paper(C.paper,true,t+d.s);
  const img=IM[R.brand.logo], w=d.logoWidth, p=spring(seg(t,.05,1.3),230,11);
  if(img){const h=w*img.height/img.width;ctx.save();ctx.globalAlpha=cl(p*3);ctx.translate(540,880);ctx.scale(.75+.25*p,.75+.25*p);ctx.drawImage(img,-w/2,-h/2,w,h);ctx.restore();}
  const [a1,a2]=d.tagline;
  const q=E.out(seg(t,.6,1.2));ctx.save();ctx.globalAlpha=q;ctx.letterSpacing='3px';ctx.font='500 50px BW';const w1=ctx.measureText(a1).width;ctx.font='900 50px BW';const w2=ctx.measureText(a2).width;const x0=540-(w1+w2)/2;
  ctx.fillStyle=C.ink;ctx.font='500 50px BW';ctx.fillText(a1,x0,1230+20*(1-q));ctx.fillStyle=C.red;ctx.font='900 50px BW';ctx.fillText(a2,x0+w1,1230+20*(1-q));ctx.restore();
}};


// ---------- LAUNCH / REAL-ESTATE kit (v5.1) ----------
function bgFill(kind,t,s0=0){ // 'paper' | 'dark' | 'brand' | '#hex'
  if(kind==='paper'||!kind){paper(C.paper,true,t+s0);return;}
  if(kind==='brand'){redField(t);return;}
  const base=kind==='dark'?(C.dark||'#0C0C0E'):col(kind);ctx.fillStyle=base;ctx.fillRect(0,0,W,H);
  if(kind==='dark'){const gx=W/2+160*Math.sin(t*.5),gy=H*.46;const g=ctx.createRadialGradient(gx,gy,40,gx,gy,1100);
    g.addColorStop(0,hexA(C.red,.22));g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    ctx.save();ctx.globalAlpha=.07;ctx.strokeStyle='#fff';ctx.lineWidth=1;for(let x=0;x<=W;x+=90){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}for(let y=0;y<=H;y+=90){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}ctx.restore();}
}
function hexA(h,a){const m=/^#?([0-9a-f]{6})$/i.exec(h||'');if(!m)return `rgba(255,255,255,${a})`;const n=parseInt(m[1],16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`;}
const onDark=k=>k==='dark'||k==='brand';
function scrim(kind,h=760){ if(kind==='paper'){pocket(h,.9);return;} if(kind!=='dark')return;
  const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgba(0,0,0,.62)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,h);
  const g2=ctx.createLinearGradient(0,H-620,0,H);g2.addColorStop(0,'rgba(0,0,0,0)');g2.addColorStop(1,'rgba(0,0,0,.55)');ctx.fillStyle=g2;ctx.fillRect(0,H-620,W,620);}
function chip(txt,t,at,{y=1420,size=46,bg=C.red,fg='#fff',align='right',icon=null,glass=false}={}){ if(!txt)return; const p=E.out(seg(t,at,at+.55)); if(p<=0)return;
  ctx.save();ctx.font=`700 ${size}px TH`;const tw=ctx.measureText(txt).width, iw=icon?size*1.2:0, pw=tw+size*1.1+iw, ph=size*1.55;
  const x=align==='right'?W-90-pw:90; ctx.globalAlpha=p; ctx.translate((align==='right'?1:-1)*60*(1-p),0);
  rr(x,y,pw*Math.min(1,p*1.4),ph,ph/2);ctx.fillStyle=glass?'rgba(14,14,18,.62)':bg;ctx.fill(); if(glass){ctx.lineWidth=2;ctx.strokeStyle=hexA(bg,.8);ctx.stroke();}
  ctx.save();rr(x,y,pw,ph,ph/2);ctx.clip();ctx.fillStyle=glass?'#fff':fg;ctx.textAlign='center';ctx.direction='rtl';ctx.fillText(txt,x+(pw-iw)/2,y+ph*.7);
  if(icon)iconOn(ctx,icon,x+pw-size*.55-iw/2+size*.1,y+ph/2,size*.85,glass?bg:fg,{lw:2.4,p:cl(p*1.2)});ctx.restore();ctx.restore();}

// full-bleed video shot: slow push-in, scrim, optional title + room chip
TYPES.shot={cues:d=>d.chip?[{t:(d.chip.at??.35),k:'pop'}]:[],draw(t,d){
  ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);
  const z=lerp(d.zoomFrom??1.06,d.zoomTo??1.14,E.sine(seg(t,0,d.dur)));
  drawClip(d.clip,t,z,d.focusY??960);
  scrim(d.scrim||'dark');
  if(d.text)T(d.text,t,{col:d.text.col?col(d.text.col):(d.scrim==='paper'?C.ink:'#FFFFFF')});
  if(d.chip)chip(d.chip.text,t,d.chip.at??.35,{y:d.chip.y??1420,bg:col(d.chip.bg)||C.red,fg:col(d.chip.fg)||'#fff',icon:d.chip.icon,glass:!!d.chip.glass});
},need(t,d){return needClip(d.clip,t);}};

// kinetic title card: kicker + big line with fx (type / decode / hl)
TYPES.titleCard={draw(t,d){
  bgFill(d.bg,t,d.s); const dk=onDark(d.bg);
  if(d.kicker)label(d.kicker,t,.05,W/2,(d.text?d.text.y:900)-(d.text?d.text.size:140)*1.05,34,dk?'rgba(255,255,255,.7)':C.mut,{font:'TH',w:700});
  T(d.text,t,{col:d.text&&d.text.col?col(d.text.col):(dk?'#FFFFFF':C.ink)});
  if(d.sub)T(d.sub,t,{col:d.sub.col?col(d.sub.col):(dk?'rgba(255,255,255,.75)':C.mut)});
}};

// big number counter (price, area, rooms, %): odometer count + label + optional ring gauge
TYPES.bigStat={draw(t,d){
  bgFill(d.bg,t,d.s); const dk=onDark(d.bg), fg=dk?'#FFFFFF':C.ink;
  const p=E.out(seg(t,.1,.1+(d.countDur??1.3))); const v=lerp(d.from??0,d.value,E.out(seg(qT(t),.1,.1+(d.countDur??1.3))));
  const dec=d.decimals??0; const fmt=x=>{let n=x.toFixed(dec);if(d.sep!==false)n=n.replace(/\B(?=(\d{3})+(?!\d))/g,',');return (d.prefix||'')+n;};
  const num=fmt(v), y=d.y??1010; let size=d.size??300;
  // unit: split a trailing ²/³ so Arabic units don't break bidi
  let uMain=d.unit||'', uSup=''; const m=uMain.match(/^(.*?)([²³])$/); if(m){uMain=m[1];uSup=m[2]==='²'?'2':'3';}
  const r=(d.size??300)*1.05, cy=y-(d.size??300)*.33;
  // measure the FINAL value so the size doesn't jump while counting; fit inside the ring
  const meas=sz=>{ctx.font=`900 ${sz}px BW`;const nw=ctx.measureText(fmt(d.value)).width;ctx.font=`800 ${sz*.34}px ${d.unitFont||'TH'}`;
    const uw=uMain?ctx.measureText(uMain).width:0; ctx.font=`800 ${sz*.2}px BW`;const sw=uSup?ctx.measureText(uSup).width:0;
    return {nw,uw,sw,gap:(uMain||uSup)?sz*.07:0};};
  let M=meas(size); const lim=d.ring?r*1.62:W*.86; const tot=()=>M.nw+M.gap+M.uw+M.sw;
  if(tot()>lim){size*=lim/tot();M=meas(size);}
  if(d.ring){const a0=Math.PI*.75, a1=a0+Math.PI*1.5*p; ctx.save();ctx.lineCap='round';
    ctx.lineWidth=r*.067;ctx.strokeStyle=dk?'rgba(255,255,255,.12)':'rgba(0,0,0,.08)';ctx.beginPath();ctx.arc(W/2,cy,r,a0,a0+Math.PI*1.5);ctx.stroke();
    ctx.strokeStyle=C.red;ctx.setLineDash([r*.048,r*.033]);ctx.beginPath();ctx.arc(W/2,cy,r,a0,a1);ctx.stroke();ctx.restore();}
  const sp=spring(seg(t,0,1.1),200,13), ny=d.ring?cy+size*.36:y;
  ctx.save();ctx.globalAlpha=cl(sp*3);ctx.translate(W/2,ny);ctx.scale(.82+.18*sp,.82+.18*sp);ctx.direction='ltr';
  const x0=-tot()/2; // group: [number][gap][unit][sup]  (centred as one block)
  ctx.textAlign='right';ctx.font=`900 ${size}px BW`;ctx.fillStyle=fg;ctx.fillText(num,x0+M.nw,0);
  if(uMain||uSup){ctx.fillStyle=C.red;ctx.textAlign='left';let ux=x0+M.nw+M.gap;
    if(uMain){ctx.font=`800 ${size*.34}px ${d.unitFont||'TH'}`;ctx.fillText(uMain,ux,-size*.02);ux+=M.uw;}
    if(uSup){ctx.font=`800 ${size*.2}px BW`;ctx.fillText(uSup,ux+2,-size*.26);}}
  ctx.restore();
  const below=d.ring?cy+r*.72:y+size*.25;
  if(d.sub){const sy=Math.max(d.sub.y??0,below+(d.sub.size||72)*1.1);T(Object.assign({},d.sub,{y:sy}),t,{col:d.sub.col?col(d.sub.col):(dk?'rgba(255,255,255,.82)':C.ink)});
    if(d.note)label(d.note,t,.9,W/2,sy+(d.sub.size||72)*.95,30,dk?'rgba(255,255,255,.55)':C.mut,{font:'TH',w:500});}
  else if(d.note)label(d.note,t,.9,W/2,below+70,30,dk?'rgba(255,255,255,.55)':C.mut,{font:'TH',w:500});
}};

TYPES.bigStat.cues=d=>[{t:.1,k:'ticks',v:d.countDur??1.3},{t:.1+(d.countDur??1.3),k:'pop'}];
TYPES.titleCard.cues=d=>d.text&&d.text.fx==='type'?[{t:0,k:'typing',v:.9}]:[];
// call-to-action card: logo + line + phone
TYPES.ctaCard={cues:d=>[{t:.05,k:'hit'},{t:.7,k:'pop'}],draw(t,d){
  bgFill(d.bg||'dark',t,d.s); const dk=onDark(d.bg||'dark');
  const img=IM[R.brand.logo]; const p=spring(seg(t,.05,1.2),220,12);
  if(img){const w=d.logoWidth||360,h=w*img.height/img.width;ctx.save();ctx.globalAlpha=cl(p*3);ctx.translate(W/2,d.logoY??620);ctx.scale(.8+.2*p,.8+.2*p);ctx.drawImage(img,-w/2,-h/2,w,h);ctx.restore();}
  T(d.text,t,{col:dk?'#FFFFFF':C.ink});
  if(d.phone){const q=E.out(seg(t,.7,1.3));ctx.save();ctx.globalAlpha=q;ctx.font='800 92px BW';ctx.letterSpacing='4px';ctx.textAlign='center';ctx.fillStyle=C.red;ctx.fillText(d.phone,W/2,(d.phoneY??1250)+30*(1-q));ctx.restore();}
  if(d.small)label(d.small,t,1.0,W/2,(d.phoneY??1250)+90,34,dk?'rgba(255,255,255,.65)':C.mut,{font:'TH',w:500});
}};


// ================= v5.2 — SaaS / UI motion kit (3D via Three.js, icons, cursor, map) =================
// Needs vendor/three.min.js (optional — falls back to flat 2D) and vendor/icons.js (Lucide).
const ICN=window.ICONS||{}; const P2D={};
function iconPath(n){ if(!P2D[n]){const ps=ICN[n]||ICN['circle']||[];P2D[n]=ps.map(d=>new Path2D(d));} return P2D[n]; }
// icon on any 2D context; p = draw-on progress 0..1
function iconOn(g,n,x,y,size,color,{lw=2,p=1,a=1}={}){ if(p<=0||a<=0)return; const s=size/24; g.save();g.globalAlpha*=a;g.translate(x-size/2,y-size/2);g.scale(s,s);
  g.strokeStyle=color;g.lineWidth=lw;g.lineCap='round';g.lineJoin='round'; if(p<1)g.setLineDash([p*70,70]);
  iconPath(n).forEach(q=>g.stroke(q)); g.restore(); }
function coverOn(g,img,box,sc=1,fx,fy){ if(!img)return; const iw=img.videoWidth||img.width, ih=img.videoHeight||img.height; const[bx,by,bw,bh]=box;
  const s=Math.max(bw/iw,bh/ih)*sc; fx=fx??iw/2; fy=fy??ih/2; g.drawImage(img,bx+bw/2-fx*s,by+bh/2-fy*s,iw*s,ih*s); }
const rrOn=(g,x,y,w,h,r)=>{g.beginPath();g.roundRect(x,y,w,h,r);};
const arDigits=s=>String(s).replace(/[0-9]/g,c=>'٠١٢٣٤٥٦٧٨٩'[c]);
const fmtN=(v,dec=0)=>v.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g,',');
const qT=t=>Math.round(t*FPS)/FPS;
const GOLD=()=>C.red, DARK=()=>C.dark||'#0C0C0E';

// ---------- Three.js layer ----------
const THREE=window.THREE; let G3=null;
// one WebGL renderer per output size is shared by every engine instance (the editor re-creates engines on each edit;
// browsers cap live WebGL contexts at ~16). Textures are per instance; old instances' textures get disposed.
function g3(){ if(G3||!THREE)return G3;
  const RG=window.__REEL_GL=window.__REEL_GL||{rs:{},gens:[]}; const w=Math.round(W*SCALE), h=Math.round(H*SCALE), key=w+'x'+h;
  let base=RG.rs[key]; if(!base){const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
    const r=new THREE.WebGLRenderer({canvas:cv,alpha:true,antialias:true,preserveDrawingBuffer:true}); r.setPixelRatio(1); r.setSize(w,h,false);
    r.outputEncoding=THREE.sRGBEncoding; r.setClearColor(0x000000,0); base=RG.rs[key]={r,cv,aniso:r.capabilities.getMaxAnisotropy()};}
  const fov=30, dist=(H/2)/Math.tan(fov*Math.PI/360);
  G3={r:base.r,cv:base.cv,aniso:base.aniso,camera:new THREE.PerspectiveCamera(fov,W/H,20,60000),dist,fov,scene:new THREE.Scene(),items:{}};
  RG.gens.push(G3); while(RG.gens.length>4){const old=RG.gens.shift();Object.values(old.items).forEach(it=>{it.tex.dispose();it.mesh.geometry.dispose();it.mesh.material.dispose();});old.items={};}
  return G3; }
// a 2D-painted plane. key = cache id. paint(g,w,h) draws its face. static → painted once.
function item3(key,pw,ph,paint,{res=1,isStatic=false}={}){ const G=g3(); let it=G.items[key];
  if(!it){const cv=document.createElement('canvas');cv.width=Math.round(pw*res);cv.height=Math.round(ph*res);
    const tex=new THREE.CanvasTexture(cv); tex.encoding=THREE.sRGBEncoding; tex.anisotropy=G.aniso;
    const mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide,depthWrite:false});
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(pw,ph),mat); it=G.items[key]={cv,g:cv.getContext('2d'),tex,mesh,pw,ph,res,painted:false};}
  if(!isStatic||!it.painted){const g=it.g;g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,it.cv.width,it.cv.height);g.setTransform(it.res,0,0,it.res,0,0);paint(g,pw,ph);it.tex.needsUpdate=true;it.painted=true;}
  return it; }
// screen px ↔ world: x=px-W/2, y=H/2-py. Default camera sees the z=0 plane 1:1.
function camDefault(){const G=g3();const c=G.camera;c.fov=G.fov;c.updateProjectionMatrix();c.up.set(0,1,0);c.position.set(0,0,G.dist);c.lookAt(0,0,0);c.updateMatrixWorld();}
function proj(x,y,z){const G=g3();const v=new THREE.Vector3(x,y,z).project(G.camera);return [(v.x+1)/2*W,(1-v.y)/2*H,v.z];}
// draw a list of placed items: [{it, x,y (screen px), z, rx,ry,rz (deg), s, a, shadow}]
function draw3(list,{shadows=true,memo=null}={}){ const G=g3(); const sc=G.scene; while(sc.children.length)sc.remove(sc.children[0]);
  const D=Math.PI/180; const quads=[];
  list.forEach(o=>{const m=o.it.mesh; m.position.set((o.x??W/2)-W/2,H/2-(o.y??H/2),o.z||0); m.rotation.set((o.rx||0)*D,(o.ry||0)*D,(o.rz||0)*D,'YXZ');
    m.scale.setScalar(o.s??1); m.material.opacity=o.a??1; m.renderOrder=o.order||0; m.updateMatrixWorld(); sc.add(m);
    if(shadows&&o.shadow&&(o.a??1)>0){const hw=o.it.pw/2,hh=o.it.ph/2;quads.push({a:(o.a??1)*o.shadow,pts:[[-hw,hh],[hw,hh],[hw,-hh],[-hw,-hh]].map(([px,py])=>{const v=new THREE.Vector3(px,py,0).applyMatrix4(m.matrixWorld);return proj(v.x,v.y,v.z);})});}});
  const out=memo?memoCanvas(memo):null, g=out?out.g:ctx;
  if(out){g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,out.cv.width,out.cv.height);g.setTransform(SCALE,0,0,SCALE,0,0);}
  quads.forEach(q=>{g.save();g.shadowColor=`rgba(0,0,0,${.75*q.a})`;g.shadowBlur=70*SCALE;g.shadowOffsetY=45*SCALE;g.fillStyle=`rgba(0,0,0,${.35*q.a})`;
    g.beginPath();q.pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]+10):g.moveTo(p[0],p[1]+10));g.closePath();g.fill();g.restore();});
  G.r.render(sc,G.camera);
  if(out){g.setTransform(1,0,0,1,0,0);g.drawImage(G.cv,0,0);ctx.drawImage(out.cv,0,0,W,H);} else ctx.drawImage(G.cv,0,0,W,H); }
// GL is slow in software: render once per output frame, reuse for the motion-blur sub-frames
function memoCanvas(memo){const G=g3();G.memo=G.memo||{};let m=G.memo[memo.k];
  if(!m){const cv=document.createElement('canvas');cv.width=G.cv.width;cv.height=G.cv.height;m=G.memo[memo.k]={cv,g:cv.getContext('2d')};} m.f=memo.f; return m;}
function memoHit(memo){ if(!memo||!G3||!G3.memo)return null; const m=G3.memo[memo.k]; return m&&m.f===memo.f?m:null; }
function glOut(sc,memo){const G=g3(); const h=memoHit(memo); if(h){ctx.drawImage(h.cv,0,0,W,H);return;} const out=memo?memoCanvas(memo):null; G.r.render(sc,G.camera);
  if(out){out.g.setTransform(1,0,0,1,0,0);out.g.clearRect(0,0,out.cv.width,out.cv.height);out.g.drawImage(G.cv,0,0);ctx.drawImage(out.cv,0,0,W,H);} else ctx.drawImage(G.cv,0,0,W,H);}
const mf=(k,t)=>SUB>1?{k,f:Math.round(t*FPS)}:null;

// ---------- shared UI bits ----------
function cursor(x,y,{s=1,a=1,press=0}={}){ if(a<=0)return; ctx.save();ctx.globalAlpha=a;ctx.translate(x,y);ctx.scale(s*(1-.18*press),s*(1-.18*press));
  ctx.shadowColor='rgba(0,0,0,.45)';ctx.shadowBlur=18;ctx.shadowOffsetY=8;
  ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,62);ctx.lineTo(15,48);ctx.lineTo(26,73);ctx.lineTo(37,68);ctx.lineTo(26,44);ctx.lineTo(46,44);ctx.closePath();
  ctx.fillStyle='#fff';ctx.fill();ctx.shadowColor='transparent';ctx.lineWidth=4;ctx.strokeStyle='#111';ctx.lineJoin='round';ctx.stroke();ctx.restore(); }
function ripple(x,y,p,c){ if(p<=0||p>=1)return; ctx.save();ctx.globalAlpha=1-p;ctx.strokeStyle=c;ctx.lineWidth=6*(1-p)+1;ctx.beginPath();ctx.arc(x,y,20+150*E.out(p),0,7);ctx.stroke();ctx.restore(); }
const bz=(a,b,c,p)=>[(1-p)**2*a[0]+2*(1-p)*p*b[0]+p*p*c[0],(1-p)**2*a[1]+2*(1-p)*p*b[1]+p*p*c[1]];
function spinner(g,x,y,r,t,c){g.save();g.strokeStyle=c;g.lineWidth=r*.28;g.lineCap='round';g.beginPath();g.arc(x,y,r,t*9,t*9+4.2);g.stroke();g.restore();}
function checkMark(g,x,y,r,p,c,fg='#111'){ if(p<=0)return; const s=.6+.4*E.back(cl(p)); g.save();g.translate(x,y);g.scale(s,s);g.fillStyle=c;g.beginPath();g.arc(0,0,r,0,7);g.fill();
  g.strokeStyle=fg;g.lineWidth=r*.24;g.lineCap='round';g.lineJoin='round';g.setLineDash([r*3*cl(p*1.4),r*3]);g.beginPath();g.moveTo(-r*.42,0);g.lineTo(-r*.1,r*.32);g.lineTo(r*.45,-r*.3);g.stroke();g.restore(); }
// soft perspective floor grid (2D) — gives depth to dark UI scenes
function floorGrid(t,{y0=H*.62,c='rgba(255,255,255,.10)',speed=60}={}){ ctx.save();ctx.strokeStyle=c;ctx.lineWidth=2;const vx=W/2,vy=y0-420;
  for(let i=-12;i<=12;i++){ctx.beginPath();ctx.moveTo(vx+i*20,vy+420);ctx.lineTo(vx+i*260,H+40);ctx.stroke();}
  const off=(t*speed)%1; for(let k=0;k<14;k++){const q=((k+off)/14)**2;const y=y0+q*(H-y0+40);ctx.globalAlpha=q;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  const g=ctx.createLinearGradient(0,y0,0,y0+260);g.addColorStop(0,DARK());g.addColorStop(1,hexA(DARK(),0));ctx.globalAlpha=1;ctx.fillStyle=g;ctx.fillRect(0,y0-2,W,262);ctx.restore(); }
function windowChrome(g,w,h,{title='',r=46,fill='rgba(22,22,26,.92)'}={}){
  rrOn(g,2,2,w-4,h-4,r);g.fillStyle=fill;g.fill();
  const gl=g.createLinearGradient(0,0,w,h);gl.addColorStop(0,'rgba(255,255,255,.10)');gl.addColorStop(.5,'rgba(255,255,255,0)');g.fillStyle=gl;g.fill();
  g.lineWidth=3;const bd=g.createLinearGradient(0,0,0,h);bd.addColorStop(0,'rgba(255,255,255,.35)');bd.addColorStop(1,'rgba(255,255,255,.06)');g.strokeStyle=bd;g.stroke();
  ['#FF5F57','#FEBC2E','#28C840'].forEach((c,i)=>{g.fillStyle=c;g.beginPath();g.arc(56+i*36,56,11,0,7);g.fill();});
  if(title){g.fillStyle='rgba(255,255,255,.55)';g.font='600 28px BW';g.textAlign='center';g.fillText(title,w/2,66);} }

// ---------- SEARCH UI: typed query → cursor click → analysing ----------
TYPES.searchUI={draw(t,d){
  bgFill(d.bg||'dark',t,d.s); floorGrid(t);
  const gold=GOLD(), q=d.query||'', tA=d.typeAt??.45, cps=d.cps??20, nCh=Math.floor(cl((t-tA)*cps,0,q.length)), typed=q.slice(0,nCh);
  const kA=d.clickAt??(tA+q.length/cps+.55), sA=d.statusAt??(kA+.25), FL=d.filters||[], ST=d.status||[];
  if(d.headline)T(d.headline,t,{col:'#fff'});
  if(d.kicker)label(d.kicker,t,.05,W/2,(d.headline?d.headline.y-d.headline.size*1.1:300),32,'rgba(255,255,255,.6)',{font:'TH',w:700});
  const pw=940,ph=d.ph||(562+(d.status||[]).length*118), fx=60, fy=150, fw=pw-120, fh=150, bx=fx+75; // search field + button (button on the LEFT, RTL)
  const paint=(g,w,h)=>{ windowChrome(g,w,h,{title:d.window||'Smart Search'});
    // field
    const press=E.out(seg(t,kA,kA+.12))*(1-E.out(seg(t,kA+.12,kA+.4)));
    rrOn(g,fx,fy,fw,fh,fh/2);g.fillStyle='rgba(255,255,255,.07)';g.fill();g.lineWidth=3;g.strokeStyle=nCh>0?hexA(gold,.9):'rgba(255,255,255,.18)';g.stroke();
    iconOn(g,'search',fx+fw-70,fy+fh/2,46,'rgba(255,255,255,.7)',{lw:2.4});
    g.save();g.direction='rtl';g.textAlign='right';g.font='700 50px TH';{const full=g.measureText(q).width, room=fw-125-150; if(full>room)g.font=`700 ${Math.floor(50*room/full)}px TH`;}g.fillStyle=nCh?'#fff':'rgba(255,255,255,.35)';
    const txt=nCh?typed:(d.placeholder||'دوّر…'); g.fillText(txt,fx+fw-125,fy+fh/2+18);
    if(t<kA&&Math.floor(t*2.4)%2===0){const tw=nCh?g.measureText(typed).width:0;g.fillStyle=gold;g.fillRect(fx+fw-125-tw-10,fy+fh/2-34,5,64);} g.restore();
    // button
    g.save();g.translate(bx,fy+fh/2);g.scale(1-.12*press,1-.12*press);g.fillStyle=gold;g.beginPath();g.arc(0,0,56,0,7);g.fill();
    if(t>kA){g.globalAlpha=1-seg(t,kA,kA+.5);g.strokeStyle=gold;g.lineWidth=4;g.beginPath();g.arc(0,0,56+60*E.out(seg(t,kA,kA+.5)),0,7);g.stroke();g.globalAlpha=1;}
    iconOn(g,'arrow-left',0,0,48,'#111',{lw:3});g.restore();
    // filters
    let x=fx+fw; g.font='700 36px TH';
    FL.forEach((f,i)=>{const at=(d.filtersAt??tA+.2)+i*.18, p=E.out(seg(t,at,at+.35)); const on=t>at+.25+(d.filterOn??.5); const tw=g.measureText(f).width+56;
      if(x-tw<fx){return;} if(p>0){g.save();g.globalAlpha=p;rrOn(g,x-tw,fy+fh+40+20*(1-p),tw,74,37);g.fillStyle=on?gold:'rgba(255,255,255,.06)';g.fill();g.strokeStyle=on?gold:'rgba(255,255,255,.2)';g.lineWidth=2;g.stroke();
        g.fillStyle=on?'#111':'rgba(255,255,255,.8)';g.textAlign='center';g.direction='rtl';g.fillText(f,x-tw/2,fy+fh+40+20*(1-p)+50);g.restore();} x-=tw+18;});
    // status rows
    const sy=fy+fh+190; g.save();g.globalAlpha=E.out(seg(t,sA-.1,sA+.3));g.fillStyle='rgba(255,255,255,.08)';g.fillRect(fx,sy-40,fw,2);g.restore();
    ST.forEach((s,i)=>{const at=sA+i*(d.rowStep??.42), p=E.out(seg(t,at,at+.35)); if(p<=0)return; const done=seg(t,at+.32,at+.5), y=sy+40+i*118;
      g.save();g.globalAlpha=p;g.translate(0,26*(1-p));
      if(done<=0)spinner(g,fx+fw-30,y,22,t,gold); else checkMark(g,fx+fw-30,y,28,done,gold);
      g.direction='rtl';g.textAlign='right';g.font='700 44px TH';g.fillStyle=done>0?'#fff':'rgba(255,255,255,.7)';
      let line=s.t; if(s.count){const c=Math.round(s.count*E.out(seg(qT(t),at,at+.9)));line=s.t.replace('{n}',fmtN(c));}
      g.fillText(line,fx+fw-80,y+15);
      if(s.tag){g.font='800 34px BW';g.textAlign='left';g.direction='ltr';g.fillStyle=gold;g.fillText(s.tag,fx+8,y+13);}
      g.restore();});
    // progress
    const pp=E.inOut(seg(t,sA,sA+(d.progressDur??ST.length*.42+.3)));
    if(t>sA-.1){rrOn(g,fx,h-90,fw,14,7);g.fillStyle='rgba(255,255,255,.08)';g.fill();rrOn(g,fx+fw*(1-pp),h-90,fw*pp,14,7);g.fillStyle=gold;g.fill();}
  };
  const cy=d.panelY??(560+ph/2), ip=spring(seg(t,0,1.2),150,14), out=E.in(seg(t,d.dur-.45,d.dur));
  const press=E.out(seg(t,kA,kA+.12))*(1-E.out(seg(t,kA+.12,kA+.4)));
  const pose={x:W/2,y:cy+120*(1-ip),z:-900*(1-ip)-40*press+out*700,rx:24*(1-ip)+3*Math.sin(t*1.1)+6*out,ry:-20*(1-ip)+4*Math.sin(t*.8),rz:-3*(1-ip),a:cl(ip*2),shadow:.9};
  let btn=[W/2-pw/2+bx,cy-ph/2+fy+fh/2];
  if(g3()){const mk=mf('s'+d.id,t), hit=memoHit(mk); if(hit){ctx.drawImage(hit.cv,0,0,W,H);btn=hit.btn;} else {const it=item3('search:'+d.id,pw,ph,paint,{res:1.25});camDefault();draw3([Object.assign({it},pose)],{memo:mk});
    const m=it.mesh, v=new THREE.Vector3(bx-pw/2,ph/2-(fy+fh/2),0).applyMatrix4(m.matrixWorld); btn=proj(v.x,v.y,v.z); if(mk)G3.memo[mk.k].btn=btn;}}
  else{const cv=document.createElement('canvas');cv.width=pw;cv.height=ph;paint(cv.getContext('2d'),pw,ph);ctx.drawImage(cv,W/2-pw/2,cy-ph/2);}
  // cursor flies in, clicks the button
  const c0=[W+80,H*.86], c1=[W*.78,H*.62], cp=E.inOut(seg(t,kA-1.0,kA-.08)), ca=cl(seg(t,kA-1.0,kA-.8)*1)*(1-seg(t,kA+.6,kA+.9));
  if(ca>0){const [x,y]=bz(c0,c1,[btn[0]+6,btn[1]+8],cp);cursor(x,y,{a:ca,press});ripple(btn[0],btn[1],seg(t,kA,kA+.55),'#fff');}
},cues(d){const c=[],q=d.query||'',tA=d.typeAt??.45,cps=d.cps??20,kA=d.clickAt??(tA+q.length/cps+.55),sA=d.statusAt??(kA+.25);
  c.push({t:0,k:'swoosh'}); for(let i=0;i<q.length;i++)if(q[i]!==' ')c.push({t:tA+i/cps,k:'key'});
  c.push({t:kA,k:'click'}); (d.status||[]).forEach((s,i)=>c.push({t:sA+i*(d.rowStep??.42)+.36,k:'ding'})); return c;}};

// ---------- 3D CARD CAROUSEL → pick hero → fly into its photo (matches the next `shot`) ----------
TYPES.cards3D={draw(t,d){
  bgFill(d.bg||'dark',t,d.s); floorGrid(t,{y0:H*.7});
  const CW=d.cardW||540, CH=d.cardH||960, cards=d.cards||[], n=cards.length, hi=Math.max(0,cards.findIndex(c=>c.hero));
  const pk=d.pickAt??1.5, end=d.dur, gold=GOLD();
  if(d.text)T(d.text,t,{col:'#fff'});
  const paintCard=(c,i,ov)=>(g,w,h)=>{ const R0=c.hero?rad:40; g.save();rrOn(g,0,0,w,h,R0);g.clip();g.fillStyle='#222';g.fillRect(0,0,w,h);
    const img=IM[c.img]; if(img){const iw=img.width,ih=img.height; coverOn(g,img,[0,0,w,h],c.zoom??1.06,iw/2,(c.focusY??960)*ih/H);}
    if(ov>0){g.globalAlpha=ov;const gr=g.createLinearGradient(0,h*.45,0,h);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(1,'rgba(0,0,0,.88)');g.fillStyle=gr;g.fillRect(0,0,w,h);
      g.direction='rtl';g.textAlign='right';g.fillStyle='#fff';g.font='800 50px TH';g.fillText(c.title||'',w-40,h-215);
      iconOn(g,'map-pin',w-56,h-163,30,gold,{lw:2.4});g.font='600 32px TH';g.fillStyle='rgba(255,255,255,.75)';g.fillText(c.place||'',w-86,h-152);
      g.direction='ltr';g.textAlign='left';g.font='900 50px BW';g.fillStyle=gold;g.fillText(c.price||'',40,h-56);
      let x=w-40; g.direction='rtl'; g.font='700 28px TH'; (c.tags||[]).forEach(tg=>{const tw=g.measureText(tg).width+36;rrOn(g,x-tw,h-120,tw,50,25);g.fillStyle='rgba(255,255,255,.14)';g.fill();g.fillStyle='#fff';g.textAlign='center';g.fillText(tg,x-tw/2,h-85);x-=tw+12;});
      if(c.badge){g.font='800 30px TH';const tw=g.measureText(c.badge).width+50;rrOn(g,w-40-tw,36,tw,58,29);g.fillStyle=gold;g.fill();g.fillStyle='#111';g.textAlign='center';g.fillText(c.badge,w-40-tw/2,75);}
      g.globalAlpha=1;}
    g.restore(); if(c.hero&&t>pk){g.save();rrOn(g,3,3,w-6,h-6,Math.max(0,R0-2));g.lineWidth=8*ov;g.strokeStyle=gold;g.stroke();g.restore();}
    else{rrOn(g,1,1,w-2,h-2,40);g.lineWidth=2;g.strokeStyle='rgba(255,255,255,.25)';g.stroke();} };
  const spin=E.inOut(seg(t,.2,pk)), lift=E.inOut(seg(t,pk,pk+.55)), dive=E.inOut(seg(t,pk+.45,end-.1)), rad=40*(1-dive);
  const G=g3(); if(!G){ // flat fallback
    const c=cards[hi]; if(c&&IM[c.img])cover(IM[c.img],IM[c.img].width/2,IM[c.img].height/2,1.06); return; }
  const mk=mf('c'+d.id,t), hit=memoHit(mk); if(hit){ctx.drawImage(hit.cv,0,0,W,H);return;}
  camDefault(); const D=G.dist, list=[], gap=CW*.62;
  cards.forEach((c,i)=>{ const isH=i===hi; let k=i-hi; const travel=(1-spin)*(n*.9); const pos=k+travel; // cards slide right→left to land on hero
    const fi=spring(seg(t,i*.07,i*.07+1.0),160,15); let x=pos*gap, z=-Math.abs(pos)*420-260, ry=-pos*24, a=cl(fi*2)*cl(1.6-Math.abs(pos)*.35);
    let y=0; z-=900*(1-fi);
    if(isH){ z=lerp(z,-60,lift); ry=lerp(ry,0,lift); x=lerp(x,0,lift);
      const zf=D/2; z=lerp(z,zf,dive); y=0; }
    else{ a*=1-.75*lift; z-=500*lift; y=-120*lift; a*=1-dive; }
    const ov=isH?(1-E.out(seg(t,pk+.45,end-.3))):1;
    const it=item3('card:'+d.id+':'+i,CW,CH,paintCard(c,i,ov),{res:1.15,isStatic:!isH});
    list.push({it,x:W/2+x,y:H/2-60*(1-dive)+y,z,ry,rx:2*Math.sin(t+i),a,shadow:.7*(1-dive),order:isH?10:Math.round(-Math.abs(pos)*2)});});
  list.sort((a,b)=>a.z-b.z); draw3(list,{memo:mf('c'+d.id,t)});
},cues(d){const pk=d.pickAt??1.5;return [{t:0,k:'swoosh'},{t:.25,k:'riser',v:pk-.25},{t:pk,k:'click'},{t:pk+.5,k:'whoosh'}];}};

// ---------- MAP: stylised city plane, camera tilts in, pin drops, routes to landmarks ----------
function paintMap(g,S,d){ const gold=GOLD(), rnd=(()=>{let s=d.seed??7;return()=>{s=(s*16807)%2147483647;return s/2147483647;};})();
  g.fillStyle=d.mapBg||'#101216';g.fillRect(0,0,S,S);
  // blocks (rotated districts)
  for(let k=0;k<9;k++){const cx=rnd()*S,cy=rnd()*S,ang=(rnd()-.5)*.8,R=S*(.18+rnd()*.14);g.save();g.translate(cx,cy);g.rotate(ang);
    for(let x=-R;x<R;x+=62)for(let y=-R;y<R;y+=62){if(Math.hypot(x,y)>R||rnd()<.12)continue;g.fillStyle=`rgba(255,255,255,${.035+rnd()*.035})`;rrOn(g,x,y,48+rnd()*8,48,6);g.fill();}g.restore();}
  (d.parks||[]).forEach(p=>{g.fillStyle='rgba(60,140,90,.22)';g.beginPath();g.ellipse(p[0]*S,p[1]*S,p[2]*S,p[3]*S,p[4]||0,0,7);g.fill();});
  const line=(pts,w,c)=>{g.strokeStyle=c;g.lineWidth=w;g.lineCap='round';g.lineJoin='round';g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0]*S,p[1]*S):g.moveTo(p[0]*S,p[1]*S));g.stroke();};
  for(let k=0;k<26;k++){const v=rnd()<.5, a=rnd(); line(v?[[a,0],[a+(rnd()-.5)*.2,1]]:[[0,a],[1,a+(rnd()-.5)*.2]],5,'rgba(255,255,255,.07)');}
  (d.roads||[]).forEach(r=>{line(r.pts,r.w||26,'rgba(255,255,255,.10)');line(r.pts,(r.w||26)*.45,hexA(gold,.55));
    if(r.name){const [a,b]=[r.pts[r.labelAt??0],r.pts[(r.labelAt??0)+1]];const mx=(a[0]+b[0])/2*S,my=(a[1]+b[1])/2*S;let ang=Math.atan2((b[1]-a[1]),(b[0]-a[0]));if(Math.abs(ang)>Math.PI/2)ang+=Math.PI;
      g.save();g.translate(mx,my);g.rotate(ang);g.font='700 44px TH';g.direction='rtl';g.textAlign='center';g.lineWidth=10;g.strokeStyle=d.mapBg||'#101216';g.strokeText(r.name,0,-26);g.fillStyle='rgba(255,255,255,.8)';g.fillText(r.name,0,-26);g.restore();}});
  if(d.zone){g.save();g.beginPath();d.zone.forEach((p,i)=>i?g.lineTo(p[0]*S,p[1]*S):g.moveTo(p[0]*S,p[1]*S));g.closePath();g.fillStyle=hexA(gold,.18);g.fill();g.setLineDash([22,14]);g.lineWidth=6;g.strokeStyle=gold;g.stroke();g.restore();}
  (d.areas||[]).forEach(a=>{g.font='800 54px TH';g.direction='rtl';g.textAlign='center';g.fillStyle='rgba(255,255,255,.28)';g.fillText(a.name,a.pos[0]*S,a.pos[1]*S);});
}
TYPES.mapPin={draw(t,d){
  bgFill('dark',t,d.s); const G=g3(), gold=GOLD(); if(!G){T(d.text,t,{col:'#fff'});return;}
  const S=d.mapSize||4400, P=d.pin.pos, pinW=[(P[0]-.5)*S,0,(P[1]-.5)*S];
  const it=item3('map:'+d.id,2400,2400,(g,w)=>paintMap(g,w,d),{isStatic:true,res:1.7}); it.mesh.geometry.dispose();
  if(!it.sized){it.mesh.geometry=new THREE.PlaneGeometry(S,S);it.sized=true;}
  const m=it.mesh; m.position.set(0,0,0); m.rotation.set(-Math.PI/2,0,0); m.scale.setScalar(1); m.material.opacity=1; m.updateMatrixWorld();
  const p=E.inOut(seg(t,0,d.camDur??2.2)), dist=lerp(d.distFrom??7200,d.distTo??2300,p), pitch=lerp(d.pitchFrom??6,d.pitchTo??52,p)*Math.PI/180, yaw=(lerp(d.yawFrom??-25,d.yawTo??8,p)+t*1.2)*Math.PI/180;
  const tg=new THREE.Vector3(lerp(0,pinW[0],p),0,lerp(0,pinW[2],p)+lerp(0,-260,p)), c=G.camera;
  c.fov=G.fov;c.updateProjectionMatrix();c.up.set(0,1,0);c.position.set(tg.x+dist*Math.sin(pitch)*Math.sin(yaw),dist*Math.cos(pitch),tg.z+dist*Math.sin(pitch)*Math.cos(yaw));c.lookAt(tg);c.updateMatrixWorld();
  const sc=G.scene; while(sc.children.length)sc.remove(sc.children[0]); sc.add(m); glOut(sc,mf('m'+d.id,t));
  // horizon fog
  const fg=ctx.createLinearGradient(0,0,0,H*.5);fg.addColorStop(0,DARK());fg.addColorStop(.55,hexA(DARK(),.6));fg.addColorStop(1,hexA(DARK(),0));ctx.fillStyle=fg;ctx.fillRect(0,0,W,H*.5);
  const gp=(u,v)=>proj((u-.5)*S,0,(v-.5)*S);
  const pinAt=d.pinAt??1.5, pp=gp(P[0],P[1]);
  // routes to landmarks
  (d.landmarks||[]).forEach((L,i)=>{const at=pinAt+.35+i*(d.lmStep??.4), q=E.inOut(seg(t,at,at+.55)); if(q<=0)return;
    const pts=[P,...(L.via||[]),L.pos]; const N=40, seg2=[]; for(let k=0;k<=N;k++){const f=k/N*(pts.length-1),j=Math.min(pts.length-2,Math.floor(f)),u=f-j;seg2.push(gp(lerp(pts[j][0],pts[j+1][0],u),lerp(pts[j][1],pts[j+1][1],u)));}
    const upto=Math.max(1,Math.floor(N*q)); ctx.save();ctx.strokeStyle=gold;ctx.lineWidth=7;ctx.setLineDash([16,12]);ctx.lineDashOffset=-t*60;ctx.lineCap='round';ctx.beginPath();for(let k=0;k<=upto;k++){const s2=seg2[k];k?ctx.lineTo(s2[0],s2[1]):ctx.moveTo(s2[0],s2[1]);}ctx.stroke();ctx.restore();
    const e=seg2[N]; if(q>.95){const a=E.out(seg(t,at+.5,at+.85)); ctx.save();ctx.globalAlpha=a;ctx.fillStyle=gold;ctx.beginPath();ctx.arc(e[0],e[1],14,0,7);ctx.fill();
      ctx.font='700 40px TH';ctx.direction='rtl';const name=L.name, tm=L.time||''; const tw=ctx.measureText(name).width; ctx.font='800 40px TH';const tw2=ctx.measureText(tm).width;
      const bw=tw+tw2+120, bh=86, lx=cl(e[0]-bw/2,40,W-40-bw), ly=e[1]-bh-34+20*(1-a);
      rrOn(ctx,lx,ly,bw,bh,bh/2);ctx.fillStyle='rgba(16,16,20,.88)';ctx.fill();ctx.strokeStyle=hexA(gold,.6);ctx.lineWidth=2;ctx.stroke();
      ctx.fillStyle='#fff';ctx.font='700 40px TH';ctx.textAlign='right';ctx.fillText(name,lx+bw-36,ly+57);
      ctx.fillStyle=gold;ctx.font='800 40px TH';ctx.textAlign='left';ctx.fillText(tm,lx+34,ly+57);ctx.restore();}});
  // pin: pulse rings on the ground + drop with bounce
  const dp=seg(t,pinAt,pinAt+.7); if(dp>0){
    for(let r=0;r<3;r++){const rp=((t-pinAt)*.7+r/3)%1; ctx.save();ctx.globalAlpha=(1-rp)*.8;ctx.strokeStyle=gold;ctx.lineWidth=4;ctx.beginPath();
      for(let k=0;k<=48;k++){const a=k/48*Math.PI*2,rr2=(60+340*rp)/S; const s2=gp(P[0]+Math.cos(a)*rr2,P[1]+Math.sin(a)*rr2); k?ctx.lineTo(s2[0],s2[1]):ctx.moveTo(s2[0],s2[1]);}ctx.stroke();ctx.restore();}
    const drop=1-spring(dp,260,11), py=pp[1]-drop*500;
    ctx.save();ctx.translate(pp[0],py);ctx.shadowColor=hexA(gold,.8);ctx.shadowBlur=40;ctx.fillStyle=gold;ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(-30,-60,-62,-92,-62,-140);ctx.arc(0,-140,62,Math.PI,0);ctx.bezierCurveTo(62,-92,30,-60,0,0);ctx.fill();
    ctx.shadowColor='transparent';ctx.fillStyle=DARK();ctx.beginPath();ctx.arc(0,-140,24,0,7);ctx.fill();ctx.restore();
    // pin card
    const ca=E.out(seg(t,pinAt+.3,pinAt+.8)); if(ca>0&&d.pin.title){ctx.save();ctx.globalAlpha=ca;ctx.font='800 54px TH';const tw=ctx.measureText(d.pin.title).width;ctx.font='600 34px TH';const sw=ctx.measureText(d.pin.sub||'').width;
      const bw=Math.max(tw,sw)+90, bh=d.pin.sub?150:96, bx=cl(pp[0]-bw/2,40,W-40-bw), by=py-260-bh+30*(1-ca);
      rrOn(ctx,bx,by,bw,bh,32);ctx.fillStyle=gold;ctx.fill();ctx.fillStyle='#111';ctx.textAlign='center';ctx.direction='rtl';ctx.font='800 54px TH';ctx.fillText(d.pin.title,bx+bw/2,by+66);
      if(d.pin.sub){ctx.font='600 34px TH';ctx.fillStyle='rgba(0,0,0,.7)';ctx.fillText(d.pin.sub,bx+bw/2,by+120);}ctx.restore();}}
  if(d.text)T(d.text,t,{col:'#fff'});
},cues(d){const pa=d.pinAt??1.5,c=[{t:0,k:'whoosh'},{t:pa+.12,k:'thud'}];(d.landmarks||[]).forEach((L,i)=>c.push({t:pa+.35+i*(d.lmStep??.4)+.55,k:'pop'}));return c;}};

// ---------- ICON GRID (keycaps): scatter in → settle → features light up → optional implode ----------
TYPES.iconGrid={draw(t,d){
  bgFill(d.bg||'dark',t,d.s); const gold=GOLD(), its=d.items||[], cols=d.cols||3, ts=d.tile||250, gap=d.gap||40, rows=Math.ceil(its.length/cols);
  const gw=cols*ts+(cols-1)*gap, x0=W/2-gw/2, y0=d.gridY??(H/2-(rows*(ts+70))/2+40), oA=d.onAt??1.1, step=d.step??.2, imp=d.implode;
  if(d.title)T(d.title,t,{col:'#fff'});
  its.forEach((o,i)=>{ const r=Math.floor(i/cols), c=(cols-1)-(i%cols); // RTL order
    const tx=x0+c*(ts+gap)+ts/2, ty=y0+r*(ts+70)+ts/2;
    const sx=W/2+(hash(i,3)-.5)*W*1.5, sy=H/2+(hash(i,5)-.5)*H*1.2, srot=(hash(i,7)-.5)*1.4;
    const p=spring(seg(t,.05+hash(i,9)*.35,.05+hash(i,9)*.35+1.2),170,14);
    let x=lerp(sx,tx,p), y=lerp(sy,ty,p), rot=srot*(1-p), s=lerp(.5,1,cl(p)), a=cl(p*2.5);
    const onT=o.on===false?99:oA+i*step, on=t>onT, pr=E.out(seg(t,onT,onT+.1))*(1-E.out(seg(t,onT+.1,onT+.35)));
    if(imp!==undefined){const q=E.in(seg(t,imp+hash(i,11)*.25,imp+hash(i,11)*.25+.45));const ang=Math.atan2(y-H/2,x-W/2)+q*2.5, rad=Math.hypot(x-W/2,y-H/2)*(1-q);x=W/2+Math.cos(ang)*rad;y=H/2+Math.sin(ang)*rad;s*=1-q*.8;rot+=q*3;a*=1-seg(q,.7,1);}
    if(a<=0)return; ctx.save();ctx.globalAlpha=a;ctx.translate(x,y);ctx.rotate(rot);ctx.scale(s*(1-.07*pr),s*(1-.07*pr));
    const h2=ts/2, dep=16*(1-pr);
    rrOn(ctx,-h2,-h2+dep,ts,ts,44);ctx.fillStyle=on?'#8A6E32':'#0A0A0C';ctx.fill(); // side
    rrOn(ctx,-h2,-h2,ts,ts,44);const gg=ctx.createLinearGradient(0,-h2,0,h2);
    if(on){gg.addColorStop(0,'#F2D28A');gg.addColorStop(1,gold);}else{gg.addColorStop(0,'#2A2A30');gg.addColorStop(1,'#1B1B20');}ctx.fillStyle=gg;ctx.fill();
    ctx.lineWidth=2;ctx.strokeStyle=on?'rgba(255,255,255,.6)':'rgba(255,255,255,.14)';ctx.stroke();
    if(on){ctx.save();ctx.shadowColor=hexA(gold,.9);ctx.shadowBlur=60*(1-seg(t,onT,onT+.8))+20;rrOn(ctx,-h2,-h2,ts,ts,44);ctx.strokeStyle=hexA(gold,.8);ctx.stroke();ctx.restore();}
    iconOn(ctx,o.icon,0,-18,ts*.38,on?'#141210':'rgba(255,255,255,.75)',{lw:2,p:cl(p*1.3)});
    if(o.value){ctx.font=`900 ${ts*.15}px BW`;ctx.textAlign='center';ctx.fillStyle=on?'#141210':'rgba(255,255,255,.6)';ctx.fillText(o.value,0,h2-34);}
    ctx.restore();
    if(o.label&&imp===undefined||(imp!==undefined&&t<imp)){const la=E.out(seg(t,onT+.05,onT+.4))*(o.on===false?0:1)*a;if(la>0){ctx.save();ctx.globalAlpha=la;ctx.font='700 38px TH';ctx.direction='rtl';ctx.textAlign='center';ctx.fillStyle='#fff';ctx.fillText(o.label,x,y+ts/2+56+12*(1-la));ctx.restore();}}
  });
  if(imp!==undefined&&d.burst){const q=E.out(seg(t,imp+.55,imp+1.1));if(q>0){ctx.save();ctx.globalAlpha=1-seg(t,imp+1.0,imp+1.4);ctx.fillStyle=gold;ctx.beginPath();ctx.arc(W/2,H/2,40+260*q,0,7);ctx.fill();
    ctx.fillStyle='#111';ctx.font='900 120px BW';ctx.textAlign='center';ctx.globalAlpha*=q;ctx.fillText(d.burst,W/2,H/2+42);ctx.restore();}}
},cues(d){const c=[{t:.05,k:'scatter'}],its=d.items||[],oA=d.onAt??1.1,st=d.step??.2;its.forEach((o,i)=>{if(o.on!==false)c.push({t:oA+i*st,k:'key2'});});if(d.implode!==undefined)c.push({t:d.implode,k:'riser',v:.5},{t:d.implode+.55,k:'hit'});return c;}};

// ---------- PLAN CARD: 3D tilted panel, price counter + payment rows + year bars ----------
TYPES.planCard={draw(t,d){
  bgFill(d.bg||'dark',t,d.s); floorGrid(t,{y0:H*.74}); const gold=GOLD();
  if(d.text)T(d.text,t,{col:'#fff'});
  const pw=920,ph=d.ph||1080, rows=d.rows||[], yrs=d.years||0, pr=d.price||{};
  const paint=(g,w,h)=>{ windowChrome(g,w,h,{title:d.window||''});
    g.direction='rtl';g.textAlign='right';g.fillStyle='rgba(255,255,255,.6)';g.font='700 40px TH';g.fillText(pr.label||'',w-70,180);
    const v=(pr.value||0)*E.out(seg(qT(t),.3,1.5)); g.direction='ltr';g.textAlign='right';g.font='900 118px BW';g.fillStyle='#fff';g.fillText(fmtN(v),w-70,320);
    if(pr.unit){g.font='800 44px TH';g.fillStyle=gold;g.textAlign='left';g.fillText(pr.unit,70,316);}
    rows.forEach((r,i)=>{const at=.8+i*.28, p=E.out(seg(t,at,at+.4)); if(p<=0)return; const y=420+i*130;
      g.save();g.globalAlpha=p;g.translate(40*(1-p),0);g.fillStyle='rgba(255,255,255,.08)';g.fillRect(70,y,w-140,2);
      if(r.icon)iconOn(g,r.icon,w-100,y+68,44,gold,{lw:2.2});
      g.direction='rtl';g.textAlign='right';g.font='700 46px TH';g.fillStyle='rgba(255,255,255,.85)';g.fillText(r.k,w-(r.icon?150:70),y+84);
      g.textAlign='left';const isA=/[\u0600-\u06FF]/.test(r.v);g.direction=isA?'rtl':'ltr';g.font=isA?'800 50px TH':'900 52px BW';g.fillStyle=gold;g.fillText(r.v,70,y+86);g.restore();});
    if(yrs){const by=h-120, bw=(w-140-(yrs-1)*14)/yrs; for(let k=0;k<yrs;k++){const at=1.4+k*.08,p=E.out(seg(t,at,at+.35)),bh=(60+k*14)*p;
      g.fillStyle=k===yrs-1?gold:hexA(gold,.35+.06*k);rrOn(g,70+k*(bw+14),by-bh,bw,bh,8);g.fill();}
      g.font='600 30px TH';g.direction='rtl';g.textAlign='right';g.fillStyle='rgba(255,255,255,.5)';g.fillText(d.yearsLabel||'',w-70,h-50);}
  };
  const ip=spring(seg(t,0,1.2),150,14), cy=d.panelY??1060;
  const pose={x:W/2,y:cy+100*(1-ip),z:-800*(1-ip),rx:16*(1-ip)+4+2*Math.sin(t*1.2),ry:18*(1-ip)-6+5*Math.sin(t*.7),a:cl(ip*2),shadow:.9};
  if(g3()){const mk=mf('p'+d.id,t), hit=memoHit(mk); if(hit)ctx.drawImage(hit.cv,0,0,W,H); else {const it=item3('plan:'+d.id,pw,ph,paint,{res:1.25});camDefault();draw3([Object.assign({it},pose)],{memo:mk});}}
  else{const cv=document.createElement('canvas');cv.width=pw;cv.height=ph;paint(cv.getContext('2d'),pw,ph);ctx.drawImage(cv,W/2-pw/2,cy-ph/2);}
},cues(d){const c=[{t:0,k:'swoosh'},{t:.3,k:'ticks',v:1.2}];(d.rows||[]).forEach((r,i)=>c.push({t:.8+i*.28,k:'pop'}));return c;}};

// ---------- Lottie overlay on any scene: "lottie":{"name":"x","at":0,"x":540,"y":960,"w":400,"speed":1} ----------
const LOT={};
function drawLottie(L,t){ const data=O.lotties&&O.lotties[L.name]; if(!data||!window.lottie)return; let o=LOT[L.name];
  if(!o){const cv=document.createElement('canvas');cv.width=data.w;cv.height=data.h;const anim=lottie.loadAnimation({renderer:'canvas',loop:false,autoplay:false,animationData:JSON.parse(JSON.stringify(data)),rendererSettings:{context:cv.getContext('2d'),clearCanvas:true}});o=LOT[L.name]={cv,anim,fr:data.fr,op:data.op,ip:data.ip||0};}
  const lt=(t-(L.at||0))*(L.speed||1); if(lt<0)return; let f=o.ip+lt*o.fr; if(L.loop)f=o.ip+(f-o.ip)%(o.op-o.ip); if(f>o.op)f=o.op-.01; o.anim.goToAndStop(f,true);
  const w=L.w||400,h=w*o.cv.height/o.cv.width; ctx.save();ctx.globalAlpha=L.a??1;ctx.drawImage(o.cv,(L.x??W/2)-w/2,(L.y??H/2)-h/2,w,h);ctx.restore(); }


// ================= v5.3 — TALK reels: presenter footage + motion-graphic callouts + live captions =================
// scene {type:'talk', clip, offset?, zoom?, g:{kind,...}, lines:[{at,end,text,key?}] }  — clip time = scene start + t (+offset)
const GL_DARK='rgba(18,16,14,.80)';
// glass card with a REAL soft shadow (shadow follows the shape — no slab behind)
function glass(x,y,w,h,{r=34,a=1,fill=GL_DARK,rim=.22,gold=0}={}){ if(a<=0)return; ctx.save();ctx.globalAlpha*=a;
  ctx.shadowColor='rgba(0,0,0,.38)';ctx.shadowBlur=50;ctx.shadowOffsetY=22;rr(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();ctx.shadowColor='transparent';
  const g=ctx.createLinearGradient(x,y,x,y+h);g.addColorStop(0,'rgba(255,255,255,.10)');g.addColorStop(.45,'rgba(255,255,255,0)');ctx.fillStyle=g;rr(x,y,w,h,r);ctx.fill();
  rr(x+1,y+1,w-2,h-2,r);ctx.lineWidth=2;ctx.strokeStyle=gold?hexA(GOLD(),gold):`rgba(255,255,255,${rim})`;ctx.stroke();ctx.restore(); }
// enter/exit envelope for a callout living inside [a,b] (local secs). returns {p (spring 0..1+), q (exit 0..1), v (visible alpha)}
function env2(t,a,b,{k=190,c=14}={}){const p=spring(seg(t,a,a+1.2),k,c), q=E.in(seg(t,b-.32,b)); return {p,q,v:cl(p*2.2)*(1-q)};}
function pop(x,y,s,fn){ctx.save();ctx.translate(x,y);ctx.scale(s,s);fn();ctx.restore();}
function txt(s,x,y,size,{w=800,font='TH',col='#fff',align='center',dir}={}){ctx.font=`${w} ${size}px ${font}`;ctx.fillStyle=col;ctx.textAlign=align;ctx.direction=dir||(/[؀-ۿ]/.test(s)?'rtl':'ltr');ctx.fillText(s,x,y);}
function tw(s,size,w=800,font='TH'){ctx.font=`${w} ${size}px ${font}`;return ctx.measureText(s).width;}
const TOP=300; // nothing above this line except the logo badge

// ---------- live captions: one phrase at a time, active word in gold ----------
function captions(lines,t,{y=1440,size=54}={}){ if(!lines)return;
  const L=lines.find(l=>t>=l.at-.05&&t<l.end+.1); if(!L)return;
  const ws=L.text.split(/\s+/).filter(Boolean), n=ws.length, dur=Math.max(.3,L.end-L.at);
  const lens=ws.map(w=>w.length+2), tot=lens.reduce((a,b)=>a+b,0); let acc=0; const st=lens.map(l=>{const s=acc/tot;acc+=l;return s;});
  const pin=E.out(seg(t,L.at-.05,L.at+.25)), pout=E.in(seg(t,L.end-.02,L.end+.1));
  ctx.save();ctx.font=`800 ${size}px TH`;const sp=size*.28, W2=ws.map(w=>ctx.measureText(w).width), full=W2.reduce((a,b)=>a+b,0)+sp*(n-1);
  const sc=Math.min(1,(W*.86)/full), bw=full*sc+size*1.1, bh=size*1.75, bx=W/2-bw/2, by=y-bh*.68;
  ctx.globalAlpha=pin*(1-pout); glass(bx,by+14*(1-pin),bw,bh,{r:bh/2,fill:'rgba(14,12,10,.62)',rim:.12});
  ctx.translate(W/2,y+14*(1-pin));ctx.scale(sc,sc);let x=full/2;
  ws.forEach((w,i)=>{const on=(t-L.at)/dur>=st[i]-.02, cur=on&&(i===n-1||(t-L.at)/dur<st[i+1]);
    const pp=E.out(seg((t-L.at)/dur,st[i]-.04,st[i]+.08));
    ctx.save();ctx.globalAlpha*=.45+.55*pp;ctx.fillStyle=cur?GOLD():'#fff';ctx.textAlign='right';ctx.direction=/[\u0600-\u06FF]/.test(w)?'rtl':'ltr';
    ctx.translate(x-W2[i]/2,0);ctx.scale(1+.08*(cur?1:0),1+.08*(cur?1:0));ctx.fillText(w,W2[i]/2,0);ctx.restore(); x-=W2[i]+sp;});
  ctx.restore(); }

// ---------- callout graphics (each reads only from g) ----------
const GFX={};
// hook: big discount stamp + delivery pill, then project title with location pin
GFX.hook=(t,g,d)=>{ const gold=GOLD();
  const A=env2(t,g.stampAt??.15,g.stampEnd??3.2,{k:260,c:13});
  if(A.v>0){const s=.6+.4*A.p; ctx.save();ctx.globalAlpha=A.v;ctx.translate(W/2,TOP+230);ctx.rotate(-.06*(1-Math.min(1,A.p)));ctx.scale(s,s);
    ctx.shadowColor='rgba(0,0,0,.35)';ctx.shadowBlur=40;ctx.shadowOffsetY=18;ctx.beginPath();ctx.arc(0,0,200,0,7);ctx.fillStyle=gold;ctx.fill();ctx.shadowColor='transparent';
    ctx.lineWidth=5;ctx.strokeStyle='rgba(20,18,16,.55)';ctx.setLineDash([10,9]);ctx.beginPath();ctx.arc(0,0,176,0,7);ctx.stroke();ctx.setLineDash([]);
    txt(g.stampTop||'خصم',0,-70,56,{col:'#141210'}); txt(g.stamp||'25%',0,62,150,{w:900,font:'BW',col:'#141210'}); ctx.restore();
    const B=env2(t,(g.stampAt??.15)+.9,g.stampEnd??3.2); if(B.v>0&&g.pill){const pw=tw(g.pill,46,700)+90;glass(W/2-pw/2,TOP+470+30*(1-Math.min(1,B.p)),pw,92,{r:46,a:B.v,gold:.7});
      ctx.save();ctx.globalAlpha=B.v;iconOn(ctx,g.pillIcon||'key-round',W/2+pw/2-52,TOP+516+30*(1-Math.min(1,B.p)),40,gold,{lw:2.4});txt(g.pill,W/2-18,TOP+532+30*(1-Math.min(1,B.p)),44,{w:700});ctx.restore();}}
  const C=env2(t,g.titleAt??3.3,g.titleEnd??d.dur);
  if(C.v>0){ctx.save();ctx.globalAlpha=C.v;const y=TOP+140;
    if(g.kicker)txt(g.kicker,W/2,y-20+20*(1-Math.min(1,C.p)),36,{w:700,col:hexA(gold,1)});
    T({words:(g.title&&g.title.words)||g.title||[{w:'هايد'},{w:'بارك',red:true}],y:y+130,size:150,fx:'hl',st:.12},t-(g.titleAt??3.3),{col:'#fff'});
    const pw=tw(g.place||'',40,700)+100, py=y+210; if(g.place){glass(W/2-pw/2,py,pw,84,{r:42,a:E.out(seg(t,(g.titleAt??3.3)+.4,(g.titleAt??3.3)+.9))});
      iconOn(ctx,'map-pin',W/2+pw/2-50,py+42,36,gold,{lw:2.4,p:seg(t,(g.titleAt??3.3)+.5,(g.titleAt??3.3)+1.1)});txt(g.place,W/2-16,py+56,40,{w:700});}
    ctx.restore();}
};
GFX.hook.cues=g=>[{t:g.stampAt??.15,k:'hit'},{t:(g.stampAt??.15)+.9,k:'pop'},{t:g.titleAt??3.3,k:'whoosh'}];
// search question: typed query in a pill + cursor tap
GFX.search=(t,g,d)=>{ const gold=GOLD(), A=env2(t,.05,d.dur), q=g.query||'', n=Math.floor(cl((t-.3)*(g.cps||18),0,q.length));
  if(A.v<=0)return; const w=900,h=150,x=W/2-w/2,y=TOP+120+40*(1-Math.min(1,A.p)), kA=g.clickAt??(0.3+q.length/(g.cps||18)+.3);
  glass(x,y,w,h,{r:75,a:A.v,gold:n>0?.8:0}); ctx.save();ctx.globalAlpha=A.v;
  iconOn(ctx,'search',x+w-70,y+h/2,44,'rgba(255,255,255,.75)',{lw:2.4});
  ctx.font='700 46px TH';let fs=46;{const full=ctx.measureText(q).width;if(full>w-260)fs=46*(w-260)/full;}
  txt(n?q.slice(0,n):(g.placeholder||'…'),x+w-120,y+h/2+16,fs,{w:700,col:n?'#fff':'rgba(255,255,255,.4)',align:'right'});
  const pr=E.out(seg(t,kA,kA+.1))*(1-E.out(seg(t,kA+.1,kA+.35)));
  pop(x+75,y+h/2,1-.12*pr,()=>{ctx.fillStyle=gold;ctx.beginPath();ctx.arc(0,0,52,0,7);ctx.fill();iconOn(ctx,'arrow-left',0,0,44,'#141210',{lw:3});});
  ctx.restore(); const c0=[W+60,y+420],c1=[W*.6,y+330],cp=E.inOut(seg(t,kA-.75,kA-.05));
  if(t>kA-.8&&t<kA+.7){const [cx,cy]=bz(c0,c1,[x+80,y+h/2+6],cp);cursor(cx,cy,{a:A.v*(1-seg(t,kA+.4,kA+.7)),press:pr});ripple(x+75,y+h/2,seg(t,kA,kA+.5),'#fff');}
  if(g.answer){const B=env2(t,kA+.25,d.dur);const aw=tw(g.answer,44,800)+110;glass(W/2-aw/2,y+h+40+20*(1-Math.min(1,B.p)),aw,96,{r:48,a:B.v,fill:hexA(gold,.95),rim:0});
    ctx.save();ctx.globalAlpha=B.v;checkMark(ctx,W/2+aw/2-50,y+h+88+20*(1-Math.min(1,B.p)),24,seg(t,kA+.4,kA+.8),'#141210',gold);txt(g.answer,W/2-20,y+h+104+20*(1-Math.min(1,B.p)),44,{col:'#141210'});ctx.restore();}
};
GFX.search.cues=g=>{const q=g.query||'',c=[{t:.05,k:'swoosh'}];for(let i=0;i<q.length;i+=2)c.push({t:.3+i/(g.cps||18),k:'key'});const kA=g.clickAt??(0.3+q.length/(g.cps||18)+.3);c.push({t:kA,k:'click'});if(g.answer)c.push({t:kA+.45,k:'ding'});return c;};
// budget slider: knob travels, value counts, result chip
GFX.budget=(t,g,d)=>{ const gold=GOLD(),A=env2(t,.05,d.dur);if(A.v<=0)return; const w=920,h=290,x=W/2-w/2,y=TOP+80+40*(1-Math.min(1,A.p));
  glass(x,y,w,h,{a:A.v}); ctx.save();ctx.globalAlpha=A.v; txt(g.label||'ميزانيتك',x+w-60,y+78,40,{w:700,col:'rgba(255,255,255,.7)',align:'right'});
  const p=E.inOut(seg(qT(t),.4,(g.moveDur??2.2)+.4)), v=lerp(g.from??1,g.to??10,p);
  if(!g.noValue)txt((g.prefix||'')+v.toFixed(g.decimals??1)+(g.unit?' '+g.unit:''),x+60,y+82,52,{w:900,font:'BW',col:gold,align:'left'});
  const sx=x+70,sw=w-140,sy=y+180; rr(sx,sy-7,sw,14,7);ctx.fillStyle='rgba(255,255,255,.12)';ctx.fill();
  const kx=sx+sw*(1-p); rr(kx,sy-7,sx+sw-kx,14,7);ctx.fillStyle=gold;ctx.fill(); // RTL: fills from the right
  ctx.shadowColor='rgba(0,0,0,.4)';ctx.shadowBlur=16;ctx.beginPath();ctx.arc(kx,sy,26,0,7);ctx.fillStyle='#fff';ctx.fill();ctx.shadowColor='transparent';
  (g.ticks||[]).forEach((tk,i,arr)=>{const tx=sx+sw*(1-i/(arr.length-1));txt(tk,tx,sy+68,30,{w:600,col:'rgba(255,255,255,.5)'});});
  ctx.restore(); if(t>.6&&t<(g.moveDur??2.2)+.9)cursor(kx+8,sy+12,{a:A.v*cl((t-.6)*4)*(1-seg(t,(g.moveDur??2.2)+.5,(g.moveDur??2.2)+.9))});
  if(g.result){const B=env2(t,(g.moveDur??2.2)+.5,d.dur);const aw=tw(g.result,44,800)+110;glass(W/2-aw/2,y+h+36+20*(1-Math.min(1,B.p)),aw,96,{r:48,a:B.v,fill:hexA(gold,.95),rim:0});
    ctx.save();ctx.globalAlpha=B.v;checkMark(ctx,W/2+aw/2-50,y+h+84+20*(1-Math.min(1,B.p)),24,seg(t,(g.moveDur??2.2)+.6,(g.moveDur??2.2)+1),'#141210',gold);txt(g.result,W/2-20,y+h+100+20*(1-Math.min(1,B.p)),44,{col:'#141210'});ctx.restore();}
};
GFX.budget.cues=g=>[{t:.05,k:'swoosh'},{t:.4,k:'ticks',v:g.moveDur??2.2},{t:(g.moveDur??2.2)+.6,k:'ding'}];
// versus: two option rows, cursor picks the right one
GFX.versus=(t,g,d)=>{ const gold=GOLD(),A=env2(t,.05,d.dur);if(A.v<=0)return; const w=900,x=W/2-w/2,y0=TOP+90; const pk=g.pickAt??1.6;
  [[g.no||'أرض فاضية','x',0],[g.yes||'كمبوند ساكن',1,1]].forEach(([s,_,good],i)=>{const B=env2(t,.05+i*.18,d.dur);const y=y0+i*150+30*(1-Math.min(1,B.p));
    const on=good&&t>pk, off=!good&&t>pk; glass(x,y,w,124,{r:62,a:B.v*(off?.55:1),fill:on?hexA(gold,.95):GL_DARK,rim:on?0:.2});
    ctx.save();ctx.globalAlpha=B.v*(off?.55:1);if(on)checkMark(ctx,x+w-66,y+62,30,seg(t,pk,pk+.35),'#141210',gold);else{ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=4;ctx.beginPath();ctx.arc(x+w-66,y+62,28,0,7);ctx.stroke();}
    txt(s,x+w-120,y+80,50,{col:on?'#141210':'#fff',align:'right'}); if(off){ctx.strokeStyle='rgba(255,255,255,.6)';ctx.lineWidth=4;const sw=tw(s,50);ctx.beginPath();ctx.moveTo(x+w-120,y+64);ctx.lineTo(x+w-120-sw*E.out(seg(t,pk,pk+.3)),y+64);ctx.stroke();}
    if(g.tags&&g.tags[i])txt(g.tags[i],x+60,y+78,34,{w:700,font:'TH',col:on?'#141210':'rgba(255,255,255,.55)',align:'left'});ctx.restore();});
  const kx=x+w-66, ky=y0+150+62, c0=[W+40,ky+300], cp=E.inOut(seg(t,pk-.7,pk-.05)), pr=E.out(seg(t,pk,pk+.1))*(1-E.out(seg(t,pk+.1,pk+.35)));
  if(t>pk-.75&&t<pk+.8){const [cx,cy]=bz(c0,[W*.75,ky+150],[kx+6,ky+8],cp);cursor(cx,cy,{a:A.v*(1-seg(t,pk+.5,pk+.8)),press:pr});ripple(kx,ky,seg(t,pk,pk+.5),'#fff');}
};
GFX.versus.cues=g=>[{t:.05,k:'swoosh'},{t:g.pickAt??1.6,k:'click'},{t:(g.pickAt??1.6)+.1,k:'ding'}];
// big counter in the sky (300 فدان / 41 فدان)
GFX.counter=(t,g,d)=>{ const gold=GOLD(),A=env2(t,g.at??.1,d.dur,{k:230,c:13});if(A.v<=0)return; const y=g.y??(TOP+250), r=g.ring?210:0;
  const v=Math.round(lerp(g.from??0,g.value||0,E.out(seg(qT(t),(g.at??.1)+.1,(g.at??.1)+(g.countDur??1.4)))));
  ctx.save();ctx.globalAlpha=A.v;
  if(g.card!==false){const cw=g.cardW||640,ch=g.cardH||(g.label?470:380);glass(W/2-cw/2,y-ch/2+10+20*(1-Math.min(1,A.p)),cw,ch,{r:48,a:1,gold:.35});}
  if(g.icon)iconOn(ctx,g.icon,W/2,y-160,58,gold,{lw:2,p:seg(t,(g.at??.1)+.2,(g.at??.1)+.9)});
  const s=.85+.15*Math.min(A.p,1.05); pop(W/2,y+40,s,()=>{ctx.direction='ltr';const nw=tw(String(v),170,900,'BW'),uw=tw(g.unit||'',62,800);const tot=nw+20+uw;
    ctx.textAlign='left';ctx.font='900 170px BW';ctx.fillStyle='#fff';ctx.fillText(String(v),-tot/2,0);ctx.font='800 62px TH';ctx.fillStyle=gold;ctx.fillText(g.unit||'',-tot/2+nw+20,-8);});
  if(g.label)txt(g.label,W/2,y+150,42,{w:700,col:'rgba(255,255,255,.8)'});
  ctx.restore();
};
GFX.counter.cues=g=>[{t:g.at??.1,k:'thud'},{t:(g.at??.1)+.1,k:'ticks',v:(g.countDur??1.4)-.1}];
// floating chip (green spaces etc.)
GFX.chip=(t,g,d)=>{ const gold=GOLD(); (g.items||[{text:g.text,icon:g.icon,at:g.at??.1}]).forEach((it,i)=>{const B=env2(t,it.at??(.1+i*.35),it.end??d.dur);if(B.v<=0)return;
  const pw=tw(it.text,46,800)+130, y=(g.y??TOP+160)+i*130+26*(1-Math.min(1,B.p)), x=W/2-pw/2+(i%2?-60:60)*(g.stagger?1:0);
  glass(x,y,pw,104,{r:52,a:B.v,gold:.5}); ctx.save();ctx.globalAlpha=B.v;iconOn(ctx,it.icon||'sparkles',x+pw-58,y+52,44,gold,{lw:2.4,p:seg(t,(it.at??.1)+.2,(it.at??.1)+.8)});txt(it.text,x+pw/2-28,y+68,46);ctx.restore();});};
GFX.chip.cues=g=>(g.items||[{at:g.at??.1}]).map((it,i)=>({t:it.at??(.1+i*.35),k:'pop'}));
// phone app mockup: service grid, finger tap → toast
GFX.phone=(t,g,d)=>{ const gold=GOLD(),A=env2(t,g.at??.05,d.dur,{k:170,c:15});if(A.v<=0)return; const pw=470,ph=820,x=(g.x??W*.5)-pw/2,y=(g.y??TOP+30)+60*(1-Math.min(1,A.p));
  const SC=g.scale??1; ctx.save();ctx.globalAlpha=A.v;ctx.translate(x+pw/2,y);ctx.scale(SC,SC);ctx.translate(-(x+pw/2),-y);ctx.translate(x+pw/2,y+ph/2);ctx.rotate((g.tilt??-.05)*(1+(1-Math.min(1,A.p))*2));ctx.translate(-(x+pw/2),-(y+ph/2));
  ctx.shadowColor='rgba(0,0,0,.45)';ctx.shadowBlur=60;ctx.shadowOffsetY=30;rr(x,y,pw,ph,64);ctx.fillStyle='#0E0D0C';ctx.fill();ctx.shadowColor='transparent';
  rr(x+14,y+14,pw-28,ph-28,52);ctx.fillStyle='#17150F';ctx.fill(); rr(x+pw/2-60,y+30,120,30,15);ctx.fillStyle='#000';ctx.fill();
  const ix=x+14,iy=y+14,iw=pw-28; txt(g.app||'Hyde Park',ix+iw-34,iy+120,36,{w:800,font:/[؀-ۿ]/.test(g.app||'')?'TH':'BW',align:'right'});
  txt(g.sub||'خدماتك كلها هنا',ix+iw-34,iy+165,26,{w:500,col:'rgba(255,255,255,.55)',align:'right'});
  const items=g.items||[], cols=3, cw=(iw-68-2*16)/cols; items.forEach((it,i)=>{const r=Math.floor(i/cols),c=(cols-1)-(i%cols),bx=ix+34+c*(cw+16),by=iy+210+r*(cw+52);
    const B=E.out(seg(t,(g.at??.05)+.35+i*.07,(g.at??.05)+.75+i*.07)); const hit=i===(g.tapIndex??1), ta=g.tapAt??1.6, prs=hit?E.out(seg(t,ta,ta+.1))*(1-E.out(seg(t,ta+.1,ta+.35))):0;
    ctx.save();ctx.globalAlpha*=B;ctx.translate(bx+cw/2,by+cw/2);ctx.scale((.8+.2*B)*(1-.1*prs),(.8+.2*B)*(1-.1*prs));
    rr(-cw/2,-cw/2,cw,cw,28);ctx.fillStyle=hit&&t>ta?gold:'rgba(255,255,255,.07)';ctx.fill();iconOn(ctx,it.icon,0,0,cw*.42,hit&&t>ta?'#141210':gold,{lw:2});ctx.restore();
    ctx.save();ctx.globalAlpha*=B;txt(it.label||'',bx+cw/2,by+cw+34,24,{w:600,col:'rgba(255,255,255,.75)'});ctx.restore();});
  const ta=g.tapAt??1.6; if(g.toast){const T2=env2(t,ta+.35,d.dur);ctx.save();ctx.globalAlpha*=T2.v;const tw2=iw-60,ty=iy+ph-28-140+30*(1-Math.min(1,T2.p));rr(ix+30,ty,tw2,96,48);ctx.fillStyle=gold;ctx.fill();
    checkMark(ctx,ix+30+tw2-48,ty+48,22,seg(t,ta+.4,ta+.8),'#141210',gold);txt(g.toast,ix+30+tw2/2-14,ty+62,32,{col:'#141210'});ctx.restore();}
  ctx.restore();
  const it=g.tapIndex??1, r=Math.floor(it/cols), c=(cols-1)-(it%cols); const tx=x+pw/2+(ix+34+c*(cw+16)+cw/2-(x+pw/2))*SC, ty=y+(iy+210+r*(cw+52)+cw/2-y)*SC;
  if(t>ta-.8&&t<ta+.8){const cp=E.inOut(seg(t,ta-.7,ta-.05));const [cx,cy]=bz([W+40,ty+400],[W*.8,ty+200],[tx+4,ty+6],cp);cursor(cx,cy,{a:A.v*(1-seg(t,ta+.5,ta+.8)),press:E.out(seg(t,ta,ta+.1))*(1-E.out(seg(t,ta+.1,ta+.35)))});ripple(tx,ty,seg(t,ta,ta+.5),'#fff');}
};
GFX.phone.cues=g=>[{t:g.at??.05,k:'swoosh'},...(g.items||[]).map((x,i)=>({t:(g.at??.05)+.35+i*.07,k:'key',gain:.6})),{t:g.tapAt??1.6,k:'click'},{t:(g.tapAt??1.6)+.4,k:'ding'}];
// checklist card: items tick one by one
GFX.checklist=(t,g,d)=>{ const gold=GOLD(),A=env2(t,.05,d.dur);if(A.v<=0)return; const its=g.items||[], w=840, rh=110, h=(g.title?120:40)+its.length*rh+30, x=W/2-w/2, y=TOP+40+30*(1-Math.min(1,A.p));
  glass(x,y,w,h,{a:A.v,gold:.3}); ctx.save();ctx.globalAlpha=A.v; if(g.title)txt(g.title,x+w-56,y+84,44,{align:'right'});
  its.forEach((it,i)=>{const at=it.at??((g.firstAt??.5)+i*(g.step??.55)), p=E.out(seg(t,at-.25,at+.15)), ck=seg(t,at,at+.3), yy=y+(g.title?120:40)+i*rh;
    ctx.save();ctx.globalAlpha*=p;ctx.translate(30*(1-p),0); if(i)ctx.fillStyle='rgba(255,255,255,.08)',ctx.fillRect(x+50,yy,w-100,2);
    if(ck>0)checkMark(ctx,x+w-80,yy+rh/2,28,ck,gold,'#141210');else{ctx.strokeStyle='rgba(255,255,255,.3)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x+w-80,yy+rh/2,26,0,7);ctx.stroke();}
    txt(it.text,x+w-136,yy+rh/2+16,46,{w:700,col:ck>0?'#fff':'rgba(255,255,255,.6)',align:'right'}); if(it.icon)iconOn(ctx,it.icon,x+76,yy+rh/2,46,ck>0?gold:'rgba(255,255,255,.35)',{lw:2,p:ck});
    ctx.restore();}); ctx.restore(); };
GFX.checklist.cues=g=>[{t:.05,k:'swoosh'},...(g.items||[]).map((x,i)=>({t:x.at??((g.firstAt??.5)+i*(g.step??.55)),k:'ding'}))];
// unit-type slider: chips slide, highlight travels
GFX.units=(t,g,d)=>{ const gold=GOLD(),A=env2(t,g.at??.05,d.dur);if(A.v<=0)return; const its=g.items||[], y=g.y??TOP+300;
  if(g.head){const H2=env2(t,g.at??.05,d.dur);const pw=tw(g.head,46,800)+130;glass(W/2-pw/2,y-260,pw,104,{r:52,a:H2.v,gold:.5});ctx.save();ctx.globalAlpha=H2.v;iconOn(ctx,g.headIcon||'shopping-cart',W/2+pw/2-58,y-208,44,gold,{lw:2.4});txt(g.head,W/2-28,y-192,46);ctx.restore();}
  const sa=g.slideAt??1.2, p=E.inOut(seg(t,sa,sa+(g.slideDur??2.4))), act=Math.min(its.length-1,Math.floor(p*its.length*.999+.0001));
  ctx.save();ctx.globalAlpha=E.out(seg(t,sa-.4,sa))*(1-E.in(seg(t,d.dur-.3,d.dur)));ctx.font='800 44px TH';const ws=its.map(s=>ctx.measureText(s).width+80), gap=22;
  let tot=0;const xs=ws.map(w=>{const x=tot;tot+=w+gap;return x;}); const focus=xs[act]+ws[act]/2, off=W/2+lerp(xs[0]+ws[0]/2,focus,1)-0;
  its.forEach((s,i)=>{const cx=W/2+(focus-(xs[i]+ws[i]/2)), on=i===act, wv=ws[i]; // RTL: later items to the left
    glass(cx-wv/2,y,wv,104,{r:52,a:on?1:.85,fill:on?hexA(gold,.96):GL_DARK,rim:on?0:.18}); txt(s,cx,y+68,44,{col:on?'#141210':'rgba(255,255,255,.85)'});});
  ctx.restore(); if(g.caption)txt(g.caption,W/2,y+190,38,{w:700,col:'rgba(255,255,255,.85)'});
};
GFX.units.cues=g=>{const n=(g.items||[]).length,sa=g.slideAt??1.2,sd=g.slideDur??2.4,c=[{t:g.at??.05,k:'pop'}];for(let i=1;i<n;i++)c.push({t:sa+sd*i/n,k:'key2',gain:.7});return c;};
// big kinetic line in the sky
GFX.line=(t,g,d)=>{ T(Object.assign({y:TOP+260,size:140,fx:g.fx||'hl',st:.14},g.text),t-(g.at??.1),{col:'#fff'}); if(g.sub){const B=env2(t,(g.at??.1)+.6,d.dur);ctx.save();ctx.globalAlpha=B.v;txt(g.sub,W/2,(g.text&&g.text.y||TOP+260)+90,40,{w:700,col:'rgba(255,255,255,.85)'});ctx.restore();}};
GFX.line.cues=g=>[{t:g.at??.1,k:'whoosh'}];
// discount + delivery timeline
GFX.offer=(t,g,d)=>{ const gold=GOLD(); const A=env2(t,g.at??.05,d.dur,{k:280,c:12});
  if(A.v>0){const s=.55+.45*A.p;ctx.save();ctx.globalAlpha=A.v;ctx.translate(W/2-170,TOP+180);ctx.rotate(-.08);ctx.scale(s,s);ctx.shadowColor='rgba(0,0,0,.35)';ctx.shadowBlur=40;ctx.shadowOffsetY=18;
    rr(-200,-120,400,240,40);ctx.fillStyle=gold;ctx.fill();ctx.shadowColor='transparent';txt(g.stampTop||'خصم',0,-40,48,{col:'#141210'});txt(g.stamp||'25%',0,90,140,{w:900,font:'BW',col:'#141210'});ctx.restore();}
  const B=env2(t,(g.yearsAt??1.1),d.dur); if(B.v>0){const w=880,x=W/2-w/2,y=TOP+380+30*(1-Math.min(1,B.p)),n=g.years||4;glass(x,y,w,250,{a:B.v});ctx.save();ctx.globalAlpha=B.v;
    txt(g.yearsLabel||'استلم على ٤ سنين',x+w-50,y+76,44,{align:'right'}); iconOn(ctx,'calendar-check',x+70,y+60,46,gold,{lw:2});
    const fp=E.inOut(seg(t,(g.yearsAt??1.1)+.3,(g.yearsAt??1.1)+1.4)), lx=x+80,lw=w-160,ly=y+170; rr(lx,ly-5,lw,10,5);ctx.fillStyle='rgba(255,255,255,.12)';ctx.fill();rr(lx+lw*(1-fp),ly-5,lw*fp,10,5);ctx.fillStyle=gold;ctx.fill();
    for(let i=0;i<=n;i++){const px=lx+lw*(1-i/n),on=fp>=i/n-.001;ctx.beginPath();ctx.arc(px,ly,on?16:11,0,7);ctx.fillStyle=on?gold:'rgba(255,255,255,.3)';ctx.fill(); if(i>0)txt(String(i),px,ly+56,30,{w:700,font:'BW',col:on?'#fff':'rgba(255,255,255,.4)'});}
    ctx.restore();}};
GFX.offer.cues=g=>[{t:g.at??.05,k:'hit'},{t:g.yearsAt??1.1,k:'swoosh'},{t:(g.yearsAt??1.1)+.3,k:'ticks',v:1.1}];
// call to action: phase badge + logo + phone, cursor presses the button
GFX.cta=(t,g,d)=>{ const gold=GOLD(),A=env2(t,.05,d.dur+1);if(A.v<=0)return; const w=860,h=600,x=W/2-w/2,y=TOP+40+40*(1-Math.min(1,A.p));
  glass(x,y,w,h,{a:A.v,gold:.4}); ctx.save();ctx.globalAlpha=A.v; const img=IM[R.brand.logo];
  if(g.badge){const bw=tw(g.badge,36,800)+70;rr(W/2-bw/2,y-34,bw,68,34);ctx.fillStyle=gold;ctx.fill();txt(g.badge,W/2,y+12,36,{col:'#141210'});}
  if(img){const lw=230,lh=lw*img.height/img.width;ctx.drawImage(img,W/2-lw/2,y+60,lw,lh);}
  txt(g.line||'احجز وحدتك دلوقتي',W/2,y+340,54); const ba=g.pressAt??1.6, pr=E.out(seg(t,ba,ba+.1))*(1-E.out(seg(t,ba+.1,ba+.35)));
  const bw2=560,bh=110,bx=W/2-bw2/2,by=y+390; pop(W/2,by+bh/2,1-.06*pr,()=>{rr(-bw2/2,-bh/2,bw2,bh,55);ctx.fillStyle=gold;ctx.fill();iconOn(ctx,t>ba+.2?'check':'phone',bw2/2-70,0,44,'#141210',{lw:3});txt(t>ba+.2?(g.done||'هنكلمك حالاً'):(g.phone||'0114 4111 636'),-24,16,t>ba+.2?44:48,{w:900,font:t>ba+.2?'TH':'BW',col:'#141210'});});
  ctx.restore(); if(t>ba-.8&&t<ba+.9){const cp=E.inOut(seg(t,ba-.7,ba-.05));const [cx,cy]=bz([W+40,by+450],[W*.8,by+250],[W/2+120,by+bh/2+8],cp);cursor(cx,cy,{a:A.v*(1-seg(t,ba+.55,ba+.9)),press:pr});ripple(W/2+110,by+bh/2,seg(t,ba,ba+.5),'#fff');}
};
GFX.cta.cues=g=>[{t:.05,k:'swoosh'},{t:g.pressAt??1.6,k:'click'},{t:(g.pressAt??1.6)+.2,k:'ding'}];

TYPES.talk={draw(t,d){ ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);
  const ct=d.s+t+(d.offset||0); drawClip(d.clip,ct,d.zoom||1.0,d.focusY??960);
  if(d.g&&d.g.kind!=='none'){const tg=ctx.createLinearGradient(0,0,0,1050);tg.addColorStop(0,'rgba(0,0,0,.42)');tg.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=tg;ctx.fillRect(0,0,W,1050);}
  const bg=ctx.createLinearGradient(0,H-760,0,H);bg.addColorStop(0,'rgba(0,0,0,0)');bg.addColorStop(1,'rgba(0,0,0,.45)');ctx.fillStyle=bg;ctx.fillRect(0,H-760,W,760);
  if(d.g&&GFX[d.g.kind])GFX[d.g.kind](t,d.g,d);
  captions(d.lines,t,R.captionStyle||{});
},need(t,d){return needClip(d.clip,d.s+t+(d.offset||0));},cues(d){return d.g&&GFX[d.g.kind]&&GFX[d.g.kind].cues?GFX[d.g.kind].cues(d.g):[];}};

// ================= timeline from JSON =================
const S=[], CUES=[]; let acc=0;
R.scenes.forEach(d=>{ if(d.off)return; const s=+acc.toFixed(6); acc+=d.dur; const e=+acc.toFixed(6);
  const ty=TYPES[d.type]; if(!ty){console.log('UNKNOWN TYPE',d.type);return;}
  const tin=d.tin?Object.assign({},d.tin,{fill:col(d.tin.fill),ring:col(d.tin.ring)}):null;
  const dd=Object.assign({},d,{s});
  S.push({s,e,id:d.id,tin,draw:t=>{ty.draw(t,dd);if(dd.lottie)[].concat(dd.lottie).forEach(L=>drawLottie(L,t));},need:ty.need?(t=>ty.need(t,dd)):null});
  // sound cues (global seconds) → sfx.py
  const TC={iris:'whoosh',match:'whoosh',whip:'whip',push:'whip',slam:'hit',flash:'hit',glitch:'glitch'};
  if(tin&&TC[tin.type])CUES.push({t:Math.max(0,s-(tin.type==='slam'||tin.type==='flash'?0:.12)+(tin.type==='slam'?tin.dur/2:0)),k:TC[tin.type]});
  if(ty.cues)ty.cues(dd).forEach(c=>CUES.push(Object.assign({},c,{t:s+c.t})));
  if(d.sfx)[].concat(d.sfx).forEach(c=>CUES.push(Object.assign({},c,{t:s+(c.t||0)}))); });
const DUR=S.length?S[S.length-1].e:0;
const outroS=(S.find(x=>R.scenes.find(d=>d.id===x.id).type==='outro')||{s:DUR+1}).s;

// ================= compositor =================
function sceneAt(t){let i=0;for(let k=0;k<S.length;k++)if(t>=S[k].s)i=k;return i;}
function drawAt(t){
  const i=sceneAt(t), s=S[i], lt=t-s.s, tr=s.tin;
  if(i>0&&tr&&lt<tr.dur){const P=S[i-1], pl=t-P.s, p=lt/tr.dur;
    if(tr.type==='iris'){P.draw(pl);const Rr=E.expand(p)*2350;ctx.save();ctx.beginPath();ctx.arc(tr.cx,tr.cy,Rr,0,7);ctx.clip();ctx.fillStyle=tr.fill;ctx.fillRect(0,0,W,H);s.draw(lt);ctx.restore();
      ctx.save();ctx.strokeStyle=tr.ring;ctx.lineWidth=14*(1-p)+3;ctx.globalAlpha=1-p*.6;ctx.beginPath();ctx.arc(tr.cx,tr.cy,Rr*1.03+8,0,7);ctx.stroke();ctx.restore();}
    else if(tr.type==='match'){
      const Z=tr.z;
      if(p<.5){ctx.save();cam(1+(Z-1)*E.in(p*2),tr.a[0],tr.a[1],tr.a[0],tr.a[1]);P.draw(pl);ctx.restore();}
      else {ctx.save();cam(Z-(Z-1)*E.out((p-.5)*2),tr.b[0],tr.b[1],lerp(tr.a[0],tr.b[0],E.out((p-.5)*2)),lerp(tr.a[1],tr.b[1],E.out((p-.5)*2)));s.draw(lt);ctx.restore();}
      if(Math.abs(p-.5)<.08){ctx.save();ctx.globalAlpha=1-Math.abs(p-.5)/.08;ctx.fillStyle=C.paper;ctx.globalAlpha*=.35;ctx.fillRect(0,0,W,H);ctx.restore();}}
    else if(tr.type==='slam'){ // old scene rushes into camera, new one lands
      if(p<.5){const q=E.in(p*2);ctx.save();cam(1+1.6*q,W/2,H/2);P.draw(pl);ctx.restore();ctx.save();ctx.globalAlpha=q*.85;ctx.fillStyle=tr.fill||'#fff';ctx.fillRect(0,0,W,H);ctx.restore();}
      else{const q=E.out((p-.5)*2);ctx.save();cam(1.22-.22*q,W/2,H/2);s.draw(lt);ctx.restore();ctx.save();ctx.globalAlpha=(1-q)*.85;ctx.fillStyle=tr.fill||'#fff';ctx.fillRect(0,0,W,H);ctx.restore();}}
    else if(tr.type==='glitch'){ if(p<.5)P.draw(pl); else s.draw(lt);
      const fr=Math.floor(t*30); GL.width=off.width;GL.height=off.height;const g=GL.getContext('2d');g.drawImage(off,0,0);
      const amt=1-Math.abs(p-.5)*2, n=9; for(let k=0;k<n;k++){ if(hash(k,fr)>.55+.3*(1-amt))continue;
        const y0=Math.floor(hash(k+50,fr)*H), hh=20+hash(k+90,fr)*140, dx=(hash(k+7,fr)-.5)*260*amt;
        ctx.drawImage(GL,0,y0*SCALE,GL.width,hh*SCALE,dx,y0,W,hh);
        if(hash(k+3,fr)>.6){ctx.save();ctx.globalAlpha=.35*amt;ctx.fillStyle=k%2?C.red:'#00E5FF';ctx.fillRect(0,y0,W,hh*.25);ctx.restore();}}}
    else if(tr.type==='push'){const q=E.whip(p);ctx.save();ctx.translate(0,-q*H);P.draw(pl);ctx.restore();ctx.save();ctx.translate(0,(1-q)*H);s.draw(lt);ctx.restore();}
    else if(tr.type==='flash'){ if(p<.5)P.draw(pl); else s.draw(lt); ctx.save();ctx.globalAlpha=1-Math.abs(p-.5)*2;ctx.fillStyle=tr.fill||'#fff';ctx.fillRect(0,0,W,H);ctx.restore();}
    else if(tr.type==='whip'){const q=E.whip(p);ctx.save();ctx.translate(q*W,0);P.draw(pl);ctx.restore();ctx.save();ctx.translate(-(1-q)*W,0);s.draw(lt);ctx.restore();}
    else s.draw(lt);
  } else s.draw(lt);
  const la=1-seg(t,outroS-.4,outroS); logoBadge(la*E.out(seg(t,0.15,.5)));
}
const GL=document.createElement('canvas');
const SUB=O.sub||5, SHUT=.55/FPS;
const subT=(t,k)=>SUB===1?Math.max(0,t):Math.max(0,t+SHUT*(k/(SUB-1)-.5));
async function prepare(t){const ps=[];for(let k=0;k<SUB;k++){const tk=subT(t,k);const i=sceneAt(tk);[S[i],S[i-1]].forEach(sc=>{if(sc&&sc.need){const r=sc.need(tk-sc.s);if(r)ps.push(r);}});}await Promise.all(ps);}
function frame(t,fr){
  mctx.fillStyle='#000';mctx.fillRect(0,0,main.width,main.height);
  if(!S.length)return;
  for(let k=0;k<SUB;k++){const tk=subT(t,k);ctx.setTransform(SCALE,0,0,SCALE,0,0);ctx.globalAlpha=1;drawAt(tk);mctx.globalAlpha=1/(k+1);mctx.drawImage(off,0,0);}
  mctx.globalAlpha=1;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,off.width,off.height);ctx.setTransform(SCALE,0,0,SCALE,0,0);grain(fr);ctx.setTransform(1,0,0,1,0,0);mctx.drawImage(off,0,0);
}
mkNoise();
return {
  render:async(t,fr=0)=>{await prepare(t);frame(t,fr);},   // exact (waits for clip frames)
  draw:(t,fr=0)=>frame(t,fr),                              // immediate (live preview)
  DUR, cues:CUES, scenes:S.map(x=>({id:x.id,s:x.s,e:x.e})), sceneAt:t=>S.length?S[sceneAt(t)].id:null
};
}};
