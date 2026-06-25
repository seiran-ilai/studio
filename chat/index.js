"use strict";
let uid=1; const nid=()=>'i'+(uid++);

// ---- fonts ----
const FONTS={
  'noto-sans':{name:'思源黑體',fam:'"Noto Sans TC"',reg:400,bold:700,type:'google',q:'Noto+Sans+TC:wght@400;500;700'},
  'huninn':{name:'粉圓體',fam:'"Huninn"',reg:400,bold:700,type:'google',q:'Huninn'},
  'noto-serif':{name:'思源宋體',fam:'"Noto Serif TC"',reg:400,bold:700,type:'google',q:'Noto+Serif+TC:wght@400;700'},
  'jhenghei':{name:'微軟正黑體（系統字）',fam:'"Microsoft JhengHei","PMingLiU",sans-serif',reg:400,bold:700,type:'local',
    note:'使用本機系統字型，非 Windows 環境可能無此字'},
};

const S={
  mode:'group', ratio:'9:16',
  fontKey:'noto-sans', fontReg:400, fontBold:700,
  room:{ name:'深夜の作戰會議', bg:'color', c1:'#e8edf3', c2:'#c2cede', angle:135, img:null, zoom:1, fx:0.5, fy:0.5 },
  style:{
    font:'"Noto Sans TC"',
    headerBg:'#ffffff', headerInk:'#1c1c1e', nameInk:'#6b7280',
    sysBg:'#000000', sysAlpha:0.28, sysInk:'#ffffff',
    timeInk:'#9aa0a6', readLabel:'已讀', readInk:'#9aa0a6',
    meBg:'#3aa0ff', meInk:'#ffffff', otherBg:'#ffffff', otherInk:'#1c1c1e', radius:0.55,
  },
  chars:[], msgs:[],
  interval:0.8, tail:1.2, showTime:false, startTime:'21:30', showRead:true, readCount:2, showMeAvatar:true, showMeName:true, fps:30,
};

function pad2(n){ return String(n).padStart(2,'0'); }
// 依聊天開始時間，每則訊息往後 +1 分鐘
function msgTime(i){
  const parts=(S.startTime||'21:30').split(':');
  const base=(+parts[0]||0)*60+(+parts[1]||0);
  let total=(base+i)%1440; if(total<0) total+=1440;
  return pad2(Math.floor(total/60))+':'+pad2(total%60);
}

const PALETTE=['#e8705a','#5b9bd5','#8a6fc9','#43a98a','#d98ab0','#c9a23f','#6c8ab0','#b0746c'];
let bgTouched=false;

const SCHEMES={
  '經典綠':{bg:'#8fb0d4',headerBg:'#ffffff',headerInk:'#222222',nameInk:'#5b6470',meBg:'#06c755',meInk:'#ffffff',otherBg:'#ffffff',otherInk:'#1b1b1b',timeInk:'#7c8694',readInk:'#7c8694'},
  '海洋藍':{bg:'#eef2f7',headerBg:'#f7f7f8',headerInk:'#000000',nameInk:'#8a8a8e',meBg:'#0a84ff',meInk:'#ffffff',otherBg:'#e9e9eb',otherInk:'#000000',timeInk:'#8a8a8e',readInk:'#8a8a8e'},
  '暗夜':{bg:'#0e1116',headerBg:'#171a21',headerInk:'#e7ecf3',nameInk:'#9aa3b2',meBg:'#3a7afe',meInk:'#ffffff',otherBg:'#262b35',otherInk:'#e7ecf3',timeInk:'#7a8392',readInk:'#7a8392'},
  '莫蘭迪':{bg:'#d8d2c8',headerBg:'#efeae1',headerInk:'#4a443c',nameInk:'#857c6f',meBg:'#a3907a',meInk:'#ffffff',otherBg:'#fbf8f3',otherInk:'#4a443c',timeInk:'#9c9285',readInk:'#9c9285'},
  '少女粉':{bg:'#ffe3ec',headerBg:'#fff0f5',headerInk:'#8a3b5c',nameInk:'#b07089',meBg:'#ff6f9c',meInk:'#ffffff',otherBg:'#ffffff',otherInk:'#5c2a3e',timeInk:'#c08aa0',readInk:'#c08aa0'},
  '森林':{bg:'#e7efe4',headerBg:'#f3f7f1',headerInk:'#2f4632',nameInk:'#6d8470',meBg:'#5a9367',meInk:'#ffffff',otherBg:'#ffffff',otherInk:'#2f4632',timeInk:'#8aa08d',readInk:'#8aa08d'},
};

function makeChar(name,me=false){
  return {id:nid(),name,me,color:PALETTE[S.chars.length%PALETTE.length],img:null,
    useBub:false, bubBg: me?S.style.meBg:S.style.otherBg, bubInk: me?S.style.meInk:S.style.otherInk};
}
function seed(){
  S.room.name='死線監獄';
  S.chars=[makeChar('典獄長'),makeChar('獄卒'),makeChar('犯人',true)];
  S.msgs=[
    {id:nid(),cid:S.chars[0].id,text:'今天有六名犯人',time:'',read:false},
    {id:nid(),cid:S.chars[1].id,text:'但我們只有五名獄卒',time:'',read:false},
    {id:nid(),cid:S.chars[2].id,text:'該不會……？',time:'',read:false},
    {id:nid(),cid:S.chars[0].id,text:'我會親自監督。',time:'',read:false},
  ];
}

const DIMS={'9:16':[1080,1920],'4:5':[1080,1350],'1:1':[1080,1080]};
const cv=document.getElementById('cv'), ctx=cv.getContext('2d');
function setSize(){ const [w,h]=DIMS[S.ratio]; cv.width=w; cv.height=h; }
function hexToRgba(hex,a){ let h=hex.replace('#',''); if(h.length===3)h=h.split('').map(c=>c+c).join(''); const n=parseInt(h,16); return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`; }

// ---- font loading ----
const loadedFonts=new Set();
function injectLink(href){ if([...document.querySelectorAll('link')].some(l=>l.href===href))return; const l=document.createElement('link'); l.rel='stylesheet'; l.href=href; document.head.appendChild(l); }
async function selectFont(key){
  const f=FONTS[key]; S.fontKey=key; S.style.font=f.fam; S.fontReg=f.reg; S.fontBold=f.bold;
  document.getElementById('fontNote').textContent=f.note||'';
  document.getElementById('fmtBadge').dataset.prev=document.getElementById('fmtBadge').textContent;
  if(!loadedFonts.has(key)){
    try{ if(f.type==='google') injectLink(`https://fonts.googleapis.com/css2?family=${f.q}&display=swap`); }catch(e){}
    loadedFonts.add(key);
  }
  try{ await document.fonts.load(`${f.reg} 40px ${f.fam}`,'字Aa1'); await document.fonts.load(`${f.bold} 40px ${f.fam}`,'字Aa1'); }catch(e){}
  render(1);
}

// ---- inline markup parser ----
function parseInline(str, style){
  style = style||{};
  const markers=[['**','b'],['~~','s'],['__','u'],['++','big'],['--','small'],['*','i']];
  let best=null;
  for(const [d,flag] of markers){
    const open=str.indexOf(d); if(open<0) continue;
    const close=str.indexOf(d, open+d.length); if(close<0) continue;
    if(best===null || open<best.open || (open===best.open && d.length>best.d.length)) best={open,close,d,flag};
  }
  if(!best) return [{text:str, st:style}];
  const before=str.slice(0,best.open), inner=str.slice(best.open+best.d.length,best.close), after=str.slice(best.close+best.d.length);
  const ist={...style};
  if(best.flag==='big') ist.size=(style.size||0)+1;
  else if(best.flag==='small') ist.size=(style.size||0)-1;
  else ist[best.flag]=true;
  const out=[];
  if(before) out.push(...parseInline(before,style));
  out.push(...parseInline(inner,ist));
  if(after) out.push(...parseInline(after,style));
  return out;
}

const SIZE_MUL=[0.62,0.8,1,1.3,1.6];
function styledFont(st, baseFs){
  const sz=Math.max(-2,Math.min(2,st.size||0));
  const fs=baseFs*SIZE_MUL[sz+2];
  const w=st.b?S.fontBold:S.fontReg;
  const ital=st.i?'italic ':'';
  return {font:`${ital}${w} ${Math.round(fs)}px ${S.style.font}`, fs};
}
const CJK=/[⺀-鿿豈-﫿＀-￯　-〿]/;
function atomize(text, st, out){
  let buf='';
  const flush=()=>{ if(buf){out.push({text:buf,st}); buf='';} };
  for(const ch of text){
    if(ch==='\n'){ flush(); out.push({text:'\n',st}); }
    else if(CJK.test(ch)){ flush(); out.push({text:ch,st}); }
    else if(ch===' '){ flush(); out.push({text:' ',st}); }
    else buf+=ch;
  }
  flush();
}
function measureRich(text, maxW, baseFs){
  const segs=parseInline(text);
  const atoms=[]; segs.forEach(s=>atomize(s.text, s.st, atoms));
  atoms.forEach(a=>{ const f=styledFont(a.st,baseFs); ctx.font=f.font; a.fs=f.fs; a.font=f.font; a.w=(a.text==='\n')?0:ctx.measureText(a.text).width; });
  const lines=[]; let cur=[], curW=0;
  const push=()=>{ const w=cur.reduce((s,a)=>s+a.w,0); const fsMax=cur.reduce((m,a)=>Math.max(m,a.fs),baseFs); lines.push({atoms:cur,w,h:fsMax*1.34,fsMax}); cur=[]; curW=0; };
  for(const a of atoms){
    if(a.text==='\n'){ push(); continue; }
    if(a.w>maxW){ // long latin: char break
      for(const ch of a.text){ const f=styledFont(a.st,baseFs); ctx.font=f.font; const w=ctx.measureText(ch).width;
        if(curW+w>maxW && cur.length) push();
        cur.push({text:ch,st:a.st,fs:f.fs,font:f.font,w}); curW+=w; }
      continue;
    }
    if(curW+a.w>maxW && cur.length){ push(); if(a.text===' ') continue; }
    cur.push(a); curW+=a.w;
  }
  if(cur.length||lines.length===0) push();
  const w=Math.max(...lines.map(l=>l.w),0), h=lines.reduce((s,l)=>s+l.h,0);
  return {lines,w,h};
}

function meChar(){ return S.chars.find(c=>c.me); }
function charById(id){ return S.chars.find(c=>c.id===id); }
function bubColors(c,isMe){
  const st=S.style;
  return { bg: c&&c.useBub?c.bubBg:(isMe?st.meBg:st.otherBg),
           ink: c&&c.useBub?c.bubInk:(isMe?st.meInk:st.otherInk) };
}

function layout(W,H){
  const PAD=W*0.045, headerH=Math.round(H*0.085);
  const fs=Math.round(W*0.035), nameFs=Math.round(W*0.026), timeFs=Math.round(W*0.022), avA=Math.round(W*0.072);
  const maxBubble=W*0.66, padX=fs*0.7, padY=fs*0.5, gapRun=fs*0.34, gapNew=fs*0.95;
  const blocks=[]; let y=headerH+PAD; let prev=null;
  S.msgs.forEach((m,i)=>{
    if(m.cid==='__sys'){ blocks.push({type:'sys',m,y,h:fs*1.7}); y+=fs*1.7+gapNew*0.7; prev=null; return; }
    const c=charById(m.cid); if(!c) return;
    const isMe=!!c.me, same=prev&&prev.cid===m.cid&&prev.type!=='sys';
    const rich=measureRich(m.text, maxBubble-padX*2, fs);
    const bw=Math.min(maxBubble, rich.w+padX*2), bh=rich.h+padY*2;
    const showName=(S.mode==='group')&&!same&&(isMe?S.showMeName:true), showAva=!same&&(isMe?S.showMeAvatar:true), reserveAva=isMe?S.showMeAvatar:true;
    if(i>0) y+=same?gapRun:gapNew;
    if(showName) y+=nameFs*1.5;
    blocks.push({type:'msg',m,c,isMe,rich,bw,bh,y,showName,showAva,reserveAva,fs,nameFs,timeFs,avA,padX,padY,PAD,idx:i,last:i===S.msgs.length-1});
    y+=bh; prev={cid:m.cid,type:'msg'};
  });
  return {blocks,headerH,contentBottom:y+PAD,PAD};
}

function rr(x,y,w,h,r){ r=Math.min(r,w/2,h/2); ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function drawAvatar(c,x,y,d){
  ctx.save(); ctx.beginPath(); ctx.arc(x+d/2,y+d/2,d/2,0,Math.PI*2); ctx.clip();
  if(c.img){ const s=Math.max(d/c.img.width,d/c.img.height),iw=c.img.width*s,ih=c.img.height*s; ctx.drawImage(c.img,x+(d-iw)/2,y+(d-ih)/2,iw,ih); }
  else{ ctx.fillStyle=c.color; ctx.fillRect(x,y,d,d); ctx.fillStyle='#fff'; ctx.font=`700 ${d*0.46}px ${S.style.font}`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText((c.name||'?').slice(0,1),x+d/2,y+d/2+d*0.02); }
  ctx.restore();
}
function drawRich(rich, x0, y0, ink){
  let yc=y0;
  for(const ln of rich.lines){
    const baseline=yc+ln.fsMax*0.96; let x=x0;
    for(const a of ln.atoms){
      ctx.font=a.font; ctx.fillStyle=ink; ctx.textAlign='left'; ctx.textBaseline='alphabetic';
      ctx.fillText(a.text,x,baseline);
      if(a.st&&a.st.u){ ctx.strokeStyle=ink; ctx.lineWidth=Math.max(1,a.fs*0.06); ctx.beginPath(); ctx.moveTo(x,baseline+a.fs*0.14); ctx.lineTo(x+a.w,baseline+a.fs*0.14); ctx.stroke(); }
      if(a.st&&a.st.s){ ctx.strokeStyle=ink; ctx.lineWidth=Math.max(1,a.fs*0.06); ctx.beginPath(); ctx.moveTo(x,baseline-a.fs*0.3); ctx.lineTo(x+a.w,baseline-a.fs*0.3); ctx.stroke(); }
      x+=a.w;
    }
    yc+=ln.h;
  }
}

function render(progress=1){
  if(!cv.width) setSize();
  const W=cv.width,H=cv.height,st=S.style;
  // bg
  if(S.room.bg==='img'&&S.room.img){ drawBgCover(ctx,W,H,S.room.img,S.room.zoom||1, S.room.fx==null?0.5:S.room.fx, S.room.fy==null?0.5:S.room.fy); }
  else if(S.room.bg==='grad'){ const a=S.room.angle*Math.PI/180,x=Math.cos(a),y=Math.sin(a); const g=ctx.createLinearGradient(W/2-x*W/2,H/2-y*H/2,W/2+x*W/2,H/2+y*H/2); g.addColorStop(0,S.room.c1); g.addColorStop(1,S.room.c2); ctx.fillStyle=g; ctx.fillRect(0,0,W,H); }
  else{ ctx.fillStyle=S.room.c1; ctx.fillRect(0,0,W,H); }

  const L=layout(W,H), n=S.msgs.length;
  const total=n>0?(n-1)*S.interval+0.45+S.tail:1, tNow=progress*total, ANIM=0.42, appearOf=i=>i*S.interval;
  let visCount=0; for(let i=0;i<n;i++){ if(tNow>=appearOf(i)-0.001) visCount=i+1; }
  if(progress>=1) visCount=n;
  const headerH=L.headerH; let scroll=0;
  if(L.contentBottom>H){ const ref=L.blocks.slice(0,visCount).pop(); const tb=ref?ref.y+(ref.h||ref.bh||0)+L.PAD:H; scroll=Math.max(0,tb-H); scroll=Math.min(scroll,L.contentBottom-H); }

  ctx.save(); ctx.beginPath(); ctx.rect(0,headerH,W,H-headerH); ctx.clip();
  for(let i=0;i<visCount;i++){
    const b=L.blocks[i]; if(!b) continue;
    let k=(tNow-appearOf(i))/ANIM; k=Math.max(0,Math.min(1,k)); const ease=1-Math.pow(1-k,3);
    const yy=b.y-scroll+(1-ease)*W*0.05;
    if(yy>H+60||(yy+(b.h||b.bh||0))<headerH-60) continue;
    ctx.globalAlpha=ease;
    if(b.type==='sys'){
      ctx.font=`500 ${Math.round(W*0.026)}px ${st.font}`;
      const tw=ctx.measureText(b.m.text).width, pw=tw+W*0.06, ph=W*0.055, px=(W-pw)/2;
      ctx.fillStyle=hexToRgba(st.sysBg,st.sysAlpha); rr(px,yy,pw,ph,ph/2); ctx.fill();
      ctx.fillStyle=st.sysInk; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(b.m.text,W/2,yy+ph/2);
      ctx.globalAlpha=1; continue;
    }
    const sc=0.92+0.08*ease;
    const {c,isMe,rich,bw,bh,fs,nameFs,timeFs,avA,padX,padY,PAD,showName,showAva,reserveAva}=b;
    let bx,avX; if(isMe){ if(reserveAva){ avX=W-PAD-avA; bx=avX-W*0.022-bw; } else { avX=W-PAD-avA; bx=W-PAD-bw; } } else { avX=PAD; bx=PAD+avA+W*0.022; }
    const col=bubColors(c,isMe);
    ctx.save(); const ox=isMe?bx+bw:bx, oy=yy+bh/2; ctx.translate(ox,oy); ctx.scale(sc,sc); ctx.translate(-ox,-oy);
    if(showName){ ctx.fillStyle=st.nameInk; ctx.font=`500 ${nameFs}px ${st.font}`; ctx.textBaseline='alphabetic';
      if(isMe){ ctx.textAlign='right'; ctx.fillText(c.name,bx+bw-padX*0.3,yy-nameFs*0.5); }
      else{ ctx.textAlign='left'; ctx.fillText(c.name,bx+padX*0.3,yy-nameFs*0.5); } }
    if(showAva) drawAvatar(c,avX,yy,avA);
    ctx.fillStyle=col.bg; const maxR=Math.min(bh*0.5,W*0.06); rr(bx,yy,bw,bh,maxR*st.radius); ctx.fill();
    drawRich(rich, bx+padX, yy+padY, col.ink);
    ctx.font=`400 ${timeFs}px ${st.font}`; const metaY=yy+bh-timeFs*0.2;
    if(S.showTime){ ctx.fillStyle=st.timeInk; ctx.textAlign=isMe?'right':'left'; const tx=isMe?bx-W*0.012:bx+bw+W*0.012; ctx.fillText(msgTime(b.idx),tx,metaY-timeFs*0.2); }
    if(isMe&&S.showRead){ ctx.fillStyle=st.readInk; ctx.textAlign='right'; const rl=S.mode==='group'?st.readLabel+' '+S.readCount:st.readLabel; ctx.fillText(rl,bx-W*0.012,metaY-timeFs*1.4); }
    ctx.restore(); ctx.globalAlpha=1;
  }
  ctx.restore();

  // header
  ctx.fillStyle=st.headerBg; ctx.fillRect(0,0,W,headerH);
  ctx.strokeStyle='rgba(0,0,0,.08)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(0,headerH); ctx.lineTo(W,headerH); ctx.stroke();
  ctx.strokeStyle=st.headerInk; ctx.lineWidth=W*0.006; ctx.lineCap='round';
  const ax=W*0.05,ay=headerH/2,as=W*0.022; ctx.beginPath(); ctx.moveTo(ax+as,ay-as); ctx.lineTo(ax,ay); ctx.lineTo(ax+as,ay+as); ctx.stroke();
  ctx.fillStyle=st.headerInk; ctx.textBaseline='middle'; ctx.textAlign='left'; const tx=W*0.11;
  if(S.mode==='group'){ ctx.font=`700 ${Math.round(W*0.036)}px ${st.font}`; ctx.fillText(S.room.name,tx,headerH*0.44);
    ctx.fillStyle=st.nameInk; ctx.font=`400 ${Math.round(W*0.024)}px ${st.font}`; ctx.fillText('成員 '+S.chars.length+' 人',tx,headerH*0.7); }
  else{ ctx.font=`700 ${Math.round(W*0.036)}px ${st.font}`; ctx.fillText(S.room.name,tx,headerH*0.5); }
}

let exporting=false;

// ---- animation/export ----
let playing=false;
function animDuration(){ const n=S.msgs.length; return n>0?(n-1)*S.interval+0.45+S.tail:1; }
function runAnim(onFrame){ return new Promise(res=>{ playing=true; const dur=animDuration(),t0=performance.now();
  (function step(now){ const p=Math.min(1,(now-t0)/(dur*1000)); render(p); onFrame&&onFrame(p); if(p<1&&playing)requestAnimationFrame(step); else{playing=false;res();} })(performance.now()); }); }
function fname(e){ return 'chat_'+Date.now()+'.'+e; }
function dl(blob,e){ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=fname(e); a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),2000); }
function exportPNG(){ exporting=true; render(1); cv.toBlob(b=>{ dl(b,'png'); exporting=false; render(1); },'image/png'); }
async function exportMP4(){
  if(playing) return;
  const fmts=['video/mp4;codecs=avc1.42E01E','video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'];
  const mt=fmts.find(f=>window.MediaRecorder&&MediaRecorder.isTypeSupported(f))||''; const isMp4=mt.startsWith('video/mp4');
  const stream=cv.captureStream(S.fps); const rec=new MediaRecorder(stream,mt?{mimeType:mt,videoBitsPerSecond:10000000}:{});
  const chunks=[]; rec.ondataavailable=e=>{ if(e.data&&e.data.size)chunks.push(e.data); }; const stopped=new Promise(r=>rec.onstop=r);
  const btn=document.getElementById('mp4Btn'); btn.textContent='● 錄製中…';
  exporting=true;
  rec.start(); render(0); await new Promise(r=>setTimeout(r,120)); await runAnim(); await new Promise(r=>setTimeout(r,180));
  rec.stop(); await stopped; exporting=false; render(1); dl(new Blob(chunks,{type:isMp4?'video/mp4':'video/webm'}), isMp4?'mp4':'webm');
  btn.textContent='🎬 輸出影片 MP4';
  document.getElementById('exportHint').textContent= isMp4?'已輸出 MP4。':'此瀏覽器 MediaRecorder 不支援 MP4，已輸出 WebM（建議 Chrome / Edge）。';
}

// ============ UI ============
const $=s=>document.querySelector(s);

// collapse columns
document.querySelectorAll('.collapse').forEach(b=>b.onclick=()=>{
  const sec=b.closest('.side'); sec.classList.toggle('collapsed');
  const collapsed=sec.classList.contains('collapsed'), isLeft=sec.classList.contains('left');
  b.textContent = isLeft ? (collapsed?'▶':'◀') : (collapsed?'◀':'▶');
});

function segPick(seg,val,cb){ seg.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.v===val)); cb&&cb(val); }
$('#modeSeg').onclick=e=>{ const b=e.target.closest('button'); if(!b)return; segPick($('#modeSeg'),b.dataset.v,v=>S.mode=v); syncToggleRows(); render(1); };
$('#ratioSeg').onclick=e=>{ const b=e.target.closest('button'); if(!b)return; segPick($('#ratioSeg'),b.dataset.v,v=>{S.ratio=v;setSize();}); render(1); updateDur(); };
$('#uiSeg').onclick=e=>{ const b=e.target.closest('button'); if(!b)return; segPick($('#uiSeg'),b.dataset.v,v=>{ document.body.dataset.ui=v; }); };

// outer tabs
$('#apTabs').onclick=e=>{ const b=e.target.closest('.tab'); if(!b)return;
  document.querySelectorAll('#apTabs .tab').forEach(t=>t.classList.toggle('on',t===b));
  document.querySelectorAll('[data-pane]').forEach(p=>p.classList.toggle('hidden',p.dataset.pane!==b.dataset.tab)); };
// char/lines tabs
$('#clTabs').onclick=e=>{ const b=e.target.closest('.tab'); if(!b)return;
  document.querySelectorAll('#clTabs .tab').forEach(t=>t.classList.toggle('on',t===b));
  document.querySelectorAll('[data-clpane]').forEach(p=>p.classList.toggle('hidden',p.dataset.clpane!==b.dataset.cl)); };
$('#inTabs').onclick=e=>{ const b=e.target.closest('.tab'); if(!b)return;
  document.querySelectorAll('#inTabs .tab').forEach(t=>t.classList.toggle('on',t===b));
  document.querySelectorAll('[data-inpane]').forEach(p=>p.classList.toggle('hidden',p.dataset.inpane!==b.dataset.in));
  if(b.dataset.in==='text') $('#bulkText').value=serializeMsgs(); };

// font select
function buildFontSel(){ const s=$('#fontSel'); s.innerHTML=''; Object.entries(FONTS).forEach(([k,f])=>{ const o=document.createElement('option'); o.value=k; o.textContent=f.name; s.appendChild(o); }); s.value=S.fontKey; }
$('#fontSel').onchange=e=>selectFont(e.target.value);

// bg
$('#bgSeg').onclick=e=>{ const b=e.target.closest('button'); if(!b)return; bgTouched=true;
  segPick($('#bgSeg'),b.dataset.v,v=>{ S.room.bg=v;
    $('#bgC2').classList.toggle('hidden',v!=='grad'); $('#bgAngleWrap').classList.toggle('hidden',v!=='grad');
    $('#bgC1').classList.toggle('hidden',v==='img');
    $('#bgEditRow').classList.toggle('hidden',v!=='img'); }); render(1); };
$('#roomName').oninput=e=>{ S.room.name=e.target.value; render(1); };
$('#meAvatar').onchange=e=>{ S.showMeAvatar=e.target.checked; render(1); };
$('#meName').onchange=e=>{ S.showMeName=e.target.checked; render(1); };
$('#bgC1').oninput=e=>{ bgTouched=true; S.room.c1=e.target.value; render(1); };
$('#bgC2').oninput=e=>{ bgTouched=true; S.room.c2=e.target.value; render(1); };
$('#bgAngle').oninput=e=>{ S.room.angle=+e.target.value; $('#bgAngleV').textContent=e.target.value+'°'; render(1); };
$('#bgEditBtn').onclick=()=>openBgEditor();

// shared focal-point cover (ratio-independent): one position works across every output ratio
function drawBgCover(c,W,H,img,zoom,fx,fy){
  const cover=Math.max(W/img.width,H/img.height), s=cover*zoom, dw=img.width*s, dh=img.height*s;
  let x=W/2-fx*dw, y=H/2-fy*dh; x=Math.min(0,Math.max(W-dw,x)); y=Math.min(0,Math.max(H-dh,y));
  c.clearRect(0,0,W,H); c.drawImage(img,x,y,dw,dh);
}

// ---- background image editor modal ----
const bgCv=document.getElementById('bgCv'), bgCtx=bgCv.getContext('2d');
const BGM=560; let bgCropState=null, bgCropDrag=null;
function bgFrame(ratio){ const [rw,rh]=ratio.split(':').map(Number); let w,h; if(rw>=rh){w=BGM;h=BGM*rh/rw;}else{h=BGM;w=BGM*rw/rh;} return [Math.round(w),Math.round(h)]; }
function drawBgModal(){
  const [W,H]=bgFrame(bgCropState.ratio); bgCv.width=W; bgCv.height=H;
  const disp=300, sc=disp/Math.max(W,H); bgCv.style.width=(W*sc)+'px'; bgCv.style.height=(H*sc)+'px';
  if(bgCropState.img){
    drawBgCover(bgCtx,W,H,bgCropState.img,bgCropState.zoom,bgCropState.fx,bgCropState.fy);
  } else {
    bgCtx.fillStyle='#0a0c10'; bgCtx.fillRect(0,0,W,H);
    bgCtx.fillStyle='#5f6878'; bgCtx.textAlign='center'; bgCtx.textBaseline='middle';
    bgCtx.font='600 16px "Noto Sans TC",sans-serif'; bgCtx.fillText('點此上傳背景圖片', W/2, H/2);
  }
  bgCtx.strokeStyle='rgba(255,255,255,.85)'; bgCtx.lineWidth=2; bgCtx.strokeRect(1,1,W-2,H-2);
}
function openBgEditor(){
  bgCropState={img:S.room.img, zoom:S.room.zoom||1, fx:S.room.fx==null?0.5:S.room.fx, fy:S.room.fy==null?0.5:S.room.fy, ratio:S.ratio};
  segPick($('#bgRatioSeg'),bgCropState.ratio);
  $('#bgZoom').value=bgCropState.zoom; $('#bgZoomV').textContent=Math.round(bgCropState.zoom*100)+'%';
  $('#bgModal').classList.remove('hidden'); drawBgModal();
}
$('#bgImgFile').onchange=e=>loadImg(e.target.files[0],im=>{
  bgTouched=true; S.room.img=im; S.room.zoom=1; S.room.fx=0.5; S.room.fy=0.5;
  if(bgCropState){ bgCropState.img=im; bgCropState.zoom=1; bgCropState.fx=0.5; bgCropState.fy=0.5;
    $('#bgZoom').value=1; $('#bgZoomV').textContent='100%'; drawBgModal(); }
  render(1);
});
$('#bgRatioSeg').onclick=e=>{ const b=e.target.closest('button'); if(!b||!bgCropState)return; segPick($('#bgRatioSeg'),b.dataset.v); bgCropState.ratio=b.dataset.v; drawBgModal(); };
$('#bgZoom').oninput=e=>{ if(!bgCropState)return; bgCropState.zoom=+e.target.value; $('#bgZoomV').textContent=Math.round(e.target.value*100)+'%'; drawBgModal(); };
$('#bgCropReset').onclick=()=>{ if(!bgCropState)return; bgCropState.zoom=1; bgCropState.fx=0.5; bgCropState.fy=0.5; $('#bgZoom').value=1; $('#bgZoomV').textContent='100%'; drawBgModal(); };
bgCv.addEventListener('pointerdown',e=>{ if(!bgCropState)return; bgCropDrag={x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,moved:false}; try{bgCv.setPointerCapture(e.pointerId);}catch(_){} });
bgCv.addEventListener('pointermove',e=>{ if(!bgCropDrag||!bgCropState)return;
  if(Math.abs(e.clientX-bgCropDrag.sx)>4||Math.abs(e.clientY-bgCropDrag.sy)>4) bgCropDrag.moved=true;
  if(!bgCropState.img)return; // 沒圖時只能點擊上傳，不可拖曳
  const r=bgCv.getBoundingClientRect(); const [W,H]=bgFrame(bgCropState.ratio);
  const dx=(e.clientX-bgCropDrag.x)*(W/r.width), dy=(e.clientY-bgCropDrag.y)*(H/r.height); bgCropDrag.x=e.clientX; bgCropDrag.y=e.clientY;
  const im=bgCropState.img, s=Math.max(W/im.width,H/im.height)*bgCropState.zoom, dw=im.width*s, dh=im.height*s;
  bgCropState.fx=Math.min(1,Math.max(0,bgCropState.fx - dx/dw)); bgCropState.fy=Math.min(1,Math.max(0,bgCropState.fy - dy/dh)); drawBgModal(); });
bgCv.addEventListener('pointerup',e=>{ if(bgCropDrag&&!bgCropDrag.moved) $('#bgImgFile').click(); });
window.addEventListener('pointerup',()=>{ bgCropDrag=null; });
$('#bgCropCancel').onclick=()=>{ $('#bgModal').classList.add('hidden'); bgCropState=null; };
$('#bgCropOk').onclick=()=>{ if(!bgCropState)return; S.room.zoom=bgCropState.zoom; S.room.fx=bgCropState.fx; S.room.fy=bgCropState.fy; $('#bgModal').classList.add('hidden'); bgCropState=null; render(1); };

// style color inputs
document.querySelectorAll('[data-st]').forEach(el=>el.addEventListener('input',()=>{
  const k=el.dataset.st;
  if(k==='sysAlpha'){ S.style.sysAlpha=+el.value; $('#sysAlphaV').textContent=Math.round(el.value*100)+'%'; }
  else if(k==='radius'){ S.style.radius=+el.value; $('#radiusV').textContent=Math.round(el.value*100)+'%'; }
  else S.style[k]=el.value;
  render(1);
}));

function buildSwatches(){ const box=$('#swatches'); box.innerHTML='';
  Object.entries(SCHEMES).forEach(([name,sc])=>{ const s=document.createElement('div'); s.className='sw';
    s.style.background=`linear-gradient(135deg,${sc.meBg} 50%,${sc.otherBg} 50%)`; s.innerHTML=`<small>${name}</small>`; s.title=name;
    s.onclick=()=>applyScheme(sc); box.appendChild(s); }); }
function applyScheme(sc){
  Object.assign(S.style,{headerBg:sc.headerBg,headerInk:sc.headerInk,nameInk:sc.nameInk,meBg:sc.meBg,meInk:sc.meInk,otherBg:sc.otherBg,otherInk:sc.otherInk,timeInk:sc.timeInk,readInk:sc.readInk});
  if(!bgTouched){ S.room.bg='color'; S.room.c1=sc.bg; segPick($('#bgSeg'),'color'); $('#bgC2').classList.add('hidden'); $('#bgAngleWrap').classList.add('hidden'); $('#bgEditRow').classList.add('hidden'); $('#bgC1').classList.remove('hidden'); }
  syncStyleInputs(); render(1);
}
function syncStyleInputs(){ document.querySelectorAll('[data-st]').forEach(el=>el.value=S.style[el.dataset.st]); $('#bgC1').value=S.room.c1; $('#sysAlphaV').textContent=Math.round(S.style.sysAlpha*100)+'%'; $('#radiusV').textContent=Math.round(S.style.radius*100)+'%'; }

// animation/export controls
$('#interval').oninput=e=>{ S.interval=+e.target.value; $('#intervalV').textContent=e.target.value+'s'; updateDur(); };
$('#tail').oninput=e=>{ S.tail=+e.target.value; $('#tailV').textContent=e.target.value+'s'; updateDur(); };
function syncToggleRows(){
  $('#startTimeRow').classList.toggle('hidden',!S.showTime);
  $('#readCountRow').classList.toggle('hidden',!(S.mode==='group'&&S.showRead));
}
$('#timeToggle').onclick=e=>{ S.showTime=!S.showTime; e.target.classList.toggle('on',S.showTime); e.target.textContent=S.showTime?'開':'關'; syncToggleRows(); render(1); };
$('#readToggle').onclick=e=>{ S.showRead=!S.showRead; e.target.classList.toggle('on',S.showRead); e.target.textContent=S.showRead?'開':'關'; syncToggleRows(); render(1); };
$('#startTime').oninput=e=>{ S.startTime=e.target.value||'21:30'; render(1); };
$('#readCount').oninput=e=>{ S.readCount=Math.max(1,Math.min(99,+e.target.value||1)); render(1); };
$('#playBtn').onclick=()=>{ if(!playing) runAnim(); };
$('#pngBtn').onclick=exportPNG; $('#mp4Btn').onclick=exportMP4;
$('#addChar').onclick=()=>{ S.chars.push(makeChar('角色'+(S.chars.length+1))); renderChars(); renderQuick(); render(1); };
$('#clearMsgs').onclick=()=>{ S.msgs=[]; renderMsgs(); render(1); };
$('#quickInput').addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); quickAdd(); }});
$('#quickAdd').onclick=quickAdd;
$('#applyBulk').onclick=()=>{ parseBulk($('#bulkText').value); renderChars(); renderQuick(); renderMsgs(); render(1); };
$('#loadBulk').onclick=()=>{ $('#bulkText').value=serializeMsgs(); };

function loadImg(file,cb){
  if(!file) return;
  const r=new FileReader();
  r.onerror=()=>alert('圖片讀取失敗，請換一張試試。');
  r.onload=()=>{
    const im=new Image();
    im.onerror=()=>alert('這張圖片無法載入（可能是 HEIC 等不支援的格式），請改用 JPG / PNG。');
    im.onload=()=>{
      const MAX=2000, long=Math.max(im.width,im.height);
      if(long<=MAX){ cb(im); return; }
      try{
        const k=MAX/long, oc=document.createElement('canvas');
        oc.width=Math.round(im.width*k); oc.height=Math.round(im.height*k);
        oc.getContext('2d').drawImage(im,0,0,oc.width,oc.height);
        const out=new Image(); out.onload=()=>cb(out); out.src=oc.toDataURL('image/png');
      }catch(err){ cb(im); }
    };
    im.src=r.result;
  };
  r.readAsDataURL(file);
}
function splitLine(line){ const m=line.match(/^\s*([^:：]+?)\s*[:：]\s*(.*)$/); return m?{name:m[1].trim(),text:m[2]}:null; }
function findOrCreateChar(name){
  if(name==='系統'||name.toLowerCase()==='system')return '__sys';
  let me=false;
  if(/[（(]\s*我\s*[）)]\s*$/.test(name)){ me=true; name=name.replace(/[（(]\s*我\s*[）)]\s*$/,'').trim(); }
  let c=S.chars.find(c=>c.name===name);
  if(!c){ c=makeChar(name,me); S.chars.push(c); }
  if(me){ S.chars.forEach(x=>x.me=false); c.me=true; }
  return c.id;
}
function quickAdd(){ const v=$('#quickInput').value.trim(); if(!v)return; const p=splitLine(v);
  if(p){ S.msgs.push({id:nid(),cid:findOrCreateChar(p.name),text:p.text,time:'',read:false}); }
  else{ const me=meChar(); const cid=me?me.id:(S.chars[0]&&S.chars[0].id); if(cid)S.msgs.push({id:nid(),cid,text:v,time:'',read:false}); }
  refreshRead(); $('#quickInput').value=''; renderChars(); renderQuick(); renderMsgs(); render(1); $('#quickInput').focus(); }
function parseBulk(txt){ const out=[]; txt.split('\n').forEach(line=>{ if(line.trim()==='')return; const p=splitLine(line);
  if(p){ out.push({id:nid(),cid:findOrCreateChar(p.name),text:p.text,time:'',read:false}); } else if(out.length){ out[out.length-1].text+='\n'+line; } });
  S.msgs=out; refreshRead(); }
function serializeMsgs(){ return S.msgs.map(m=>{ const name=m.cid==='__sys'?'系統':(charById(m.cid)?.name||'?'); return name+': '+m.text.replace(/\n/g,'\\n'); }).join('\n'); }
function refreshRead(){ let last=-1; S.msgs.forEach((m,i)=>{ const c=charById(m.cid); if(c&&c.me)last=i; }); S.msgs.forEach((m,i)=>m.read=(i===last)); }

function escapeAttr(s){ return String(s).replace(/"/g,'&quot;'); }
function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function renderChars(){
  const box=$('#charList'); box.innerHTML='';
  S.chars.forEach(c=>{
    const el=document.createElement('div'); el.className='char';
    el.innerHTML=`<div class="topr">
      <div class="avatar" data-av="${c.id}" style="${c.img?'':'background:'+c.color}">${c.img?`<img src="${c.img.src}">`:(c.name||'?').slice(0,1)}</div>
      <div class="meta">
        <input type="text" data-name="${c.id}" value="${escapeAttr(c.name)}">
        <div class="ctl">
          <button class="pill ${c.me?'on':''}" data-me="${c.id}">${c.me?'★ 我':'設為我'}</button>
          <input type="color" data-color="${c.id}" value="${c.color}" title="頭像底色">
          <button class="x" data-del="${c.id}">✕</button>
        </div>
        <div class="ctl2">
          <button class="pill ${c.useBub?'on':''}" data-bubtoggle="${c.id}">對話框色</button>
          <span class="bubwrap ${c.useBub?'':'hidden'}" style="display:flex;gap:6px;align-items:center">
            <input type="color" data-bubbg="${c.id}" value="${c.bubBg}" title="泡泡色">
            <input type="color" data-bubink="${c.id}" value="${c.bubInk}" title="文字色">
          </span>
        </div>
      </div></div>`;
    box.appendChild(el);
  });
  box.querySelectorAll('[data-av]').forEach(a=>a.onclick=()=>{ const f=document.createElement('input'); f.type='file'; f.accept='image/*'; f.onchange=e=>loadImg(e.target.files[0],im=>openCropper(im,cropped=>{ charById(a.dataset.av).img=cropped; renderChars(); renderQuick(); render(1); })); f.click(); });
  box.querySelectorAll('[data-name]').forEach(i=>i.oninput=e=>{ charById(i.dataset.name).name=e.target.value; renderQuick(); renderMsgs(); render(1); });
  box.querySelectorAll('[data-color]').forEach(i=>i.oninput=e=>{ charById(i.dataset.color).color=e.target.value; renderChars(); render(1); });
  box.querySelectorAll('[data-me]').forEach(b=>b.onclick=()=>{ S.chars.forEach(c=>c.me=false); charById(b.dataset.me).me=true; refreshRead(); renderChars(); renderQuick(); renderMsgs(); render(1); });
  box.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{ S.chars=S.chars.filter(c=>c.id!==b.dataset.del); S.msgs=S.msgs.filter(m=>m.cid!==b.dataset.del); refreshRead(); renderChars(); renderQuick(); renderMsgs(); render(1); });
  box.querySelectorAll('[data-bubtoggle]').forEach(b=>b.onclick=()=>{ const c=charById(b.dataset.bubtoggle); c.useBub=!c.useBub; if(c.useBub){ c.bubBg=c.me?S.style.meBg:S.style.otherBg; c.bubInk=c.me?S.style.meInk:S.style.otherInk; } renderChars(); render(1); });
  box.querySelectorAll('[data-bubbg]').forEach(i=>i.oninput=e=>{ charById(i.dataset.bubbg).bubBg=e.target.value; render(1); });
  box.querySelectorAll('[data-bubink]').forEach(i=>i.oninput=e=>{ charById(i.dataset.bubink).bubInk=e.target.value; render(1); });
}

function renderQuick(){
  const box=$('#quickChips'); box.innerHTML='';
  S.chars.forEach(c=>{ const b=document.createElement('button'); b.className='pill'; b.textContent=(c.me?'★ ':'')+c.name+' ＋'; b.onclick=()=>{ const inp=$('#quickInput'); inp.value=c.name+': '; inp.focus(); }; box.appendChild(b); });
  const sys=document.createElement('button'); sys.className='pill'; sys.textContent='系統 ＋'; sys.onclick=()=>{ const inp=$('#quickInput'); inp.value='系統: '; inp.focus(); }; box.appendChild(sys);
}

function renderMsgs(){
  const box=$('#msgList'); box.innerHTML=''; $('#msgCount').textContent='共 '+S.msgs.length+' 句';
  S.msgs.forEach(m=>{
    const name=m.cid==='__sys'?'系統':(charById(m.cid)?.name||'?');
    const el=document.createElement('div'); el.className='msg';
    el.innerHTML=`<div class="who">${escapeHtml(name)}</div>
      <textarea data-text="${m.id}" rows="1">${escapeHtml(m.text)}</textarea>
      <div class="side2"><button class="mv" data-up="${m.id}">▲</button><button class="mv" data-down="${m.id}">▼</button><button class="mv" data-rm="${m.id}" style="color:var(--danger)">✕</button></div>`;
    box.appendChild(el);
  });
  box.querySelectorAll('[data-text]').forEach(t=>{ autoGrow(t); t.oninput=e=>{ S.msgs.find(m=>m.id===t.dataset.text).text=e.target.value; autoGrow(t); render(1); }; });
  box.querySelectorAll('[data-up]').forEach(b=>b.onclick=()=>move(b.dataset.up,-1));
  box.querySelectorAll('[data-down]').forEach(b=>b.onclick=()=>move(b.dataset.down,1));
  box.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{ S.msgs=S.msgs.filter(m=>m.id!==b.dataset.rm); refreshRead(); renderMsgs(); render(1); });
}
function move(id,dir){ const i=S.msgs.findIndex(m=>m.id===id),j=i+dir; if(j<0||j>=S.msgs.length)return; [S.msgs[i],S.msgs[j]]=[S.msgs[j],S.msgs[i]]; refreshRead(); renderMsgs(); render(1); }
function autoGrow(t){ t.style.height='auto'; t.style.height=Math.min(t.scrollHeight,120)+'px'; }
function updateDur(){ $('#dur').textContent='時長 '+animDuration().toFixed(1)+'s'; }

// ---- avatar cropper ----
const cropCv=document.getElementById('cropCv'), cropCtx=cropCv.getContext('2d');
const CROP_N=600; cropCv.width=CROP_N; cropCv.height=CROP_N;
let cropState=null, cropDrag=null;
function drawCropTo(c,size,st){
  const im=st.img, base=Math.max(size/im.width,size/im.height), s=base*st.scale;
  const iw=im.width*s, ih=im.height*s, x=(size-iw)/2+st.ox*size, y=(size-ih)/2+st.oy*size;
  c.clearRect(0,0,size,size); c.drawImage(im,x,y,iw,ih);
}
function drawCrop(){
  drawCropTo(cropCtx,CROP_N,cropState);
  cropCtx.save(); cropCtx.fillStyle='rgba(0,0,0,.5)'; cropCtx.beginPath();
  cropCtx.rect(0,0,CROP_N,CROP_N); cropCtx.arc(CROP_N/2,CROP_N/2,CROP_N/2,0,Math.PI*2,true); cropCtx.fill('evenodd');
  cropCtx.restore();
  cropCtx.strokeStyle='rgba(255,255,255,.9)'; cropCtx.lineWidth=2; cropCtx.beginPath(); cropCtx.arc(CROP_N/2,CROP_N/2,CROP_N/2-1,0,Math.PI*2); cropCtx.stroke();
}
function openCropper(img,onDone){
  cropState={img,scale:1,ox:0,oy:0,onDone};
  $('#cropZoom').value=1; $('#cropZoomV').textContent='100%';
  $('#cropModal').classList.remove('hidden'); drawCrop();
}
cropCv.addEventListener('pointerdown',e=>{ if(!cropState)return; cropDrag={x:e.clientX,y:e.clientY}; try{cropCv.setPointerCapture(e.pointerId);}catch(_){} });
cropCv.addEventListener('pointermove',e=>{ if(!cropDrag||!cropState)return; const r=cropCv.getBoundingClientRect();
  cropState.ox+=(e.clientX-cropDrag.x)/r.width; cropState.oy+=(e.clientY-cropDrag.y)/r.height; cropDrag.x=e.clientX; cropDrag.y=e.clientY; drawCrop(); });
window.addEventListener('pointerup',()=>{ cropDrag=null; });
$('#cropZoom').oninput=e=>{ if(!cropState)return; cropState.scale=+e.target.value; $('#cropZoomV').textContent=Math.round(e.target.value*100)+'%'; drawCrop(); };
$('#cropReset').onclick=()=>{ if(!cropState)return; cropState.scale=1; cropState.ox=0; cropState.oy=0; $('#cropZoom').value=1; $('#cropZoomV').textContent='100%'; drawCrop(); };
$('#cropCancel').onclick=()=>{ $('#cropModal').classList.add('hidden'); cropState=null; };
$('#cropOk').onclick=()=>{ if(!cropState)return; const out=document.createElement('canvas'); out.width=out.height=256;
  drawCropTo(out.getContext('2d'),256,cropState); const fin=cropState.onDone;
  const im=new Image(); im.onload=()=>{ fin(im); }; im.src=out.toDataURL('image/png');
  $('#cropModal').classList.add('hidden'); cropState=null; };

// init
seed(); setSize(); buildFontSel(); buildSwatches(); syncStyleInputs();
$('#roomName').value=S.room.name; refreshRead();
renderChars(); renderQuick(); renderMsgs(); updateDur(); syncToggleRows();
$('#fmtBadge').textContent=(window.MediaRecorder&&['video/mp4;codecs=avc1.42E01E','video/mp4'].some(f=>MediaRecorder.isTypeSupported(f)))?'MP4':'WebM';
document.body.dataset.ui='std';
selectFont('noto-sans');
