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
  interval:0.8, tail:1.2, showTime:false, startTime:'21:30', showRead:true, readCount:2, showMeAvatar:true, showMeName:true, showInput:true, typeSpeed:1, fps:30,
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
    let rich=null, bw, bh, isImg=false, img=null, imgW=0, imgH=0, capRich=null;
    if(m.img){
      isImg=true; img=m.img;
      imgW=Math.min(maxBubble, W*0.62); imgH=imgW*(img.height/img.width);
      const maxIH=H*0.5; if(imgH>maxIH){ imgH=maxIH; imgW=imgH*(img.width/img.height); }
      bw=imgW;
      if(m.text&&m.text.trim()){ capRich=measureRich(m.text, bw-padX*2, fs); bh=imgH+capRich.h+padY*1.6; }
      else bh=imgH;
    } else {
      rich=measureRich(m.text, maxBubble-padX*2, fs);
      bw=Math.min(maxBubble, rich.w+padX*2); bh=rich.h+padY*2;
    }
    const showName=(S.mode==='group')&&!same&&(isMe?S.showMeName:true), showAva=!same&&(isMe?S.showMeAvatar:true), reserveAva=isMe?S.showMeAvatar:true;
    if(i>0) y+=same?gapRun:gapNew;
    if(showName) y+=nameFs*1.5;
    blocks.push({type:'msg',m,c,isMe,rich,bw,bh,y,showName,showAva,reserveAva,fs,nameFs,timeFs,avA,padX,padY,PAD,idx:i,last:i===S.msgs.length-1,isImg,img,imgW,imgH,capRich});
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
function drawImageCoverRect(img,x,y,w,h){
  const s=Math.max(w/img.width,h/img.height), iw=img.width*s, ih=img.height*s;
  ctx.drawImage(img,x+(w-iw)/2,y+(h-ih)/2,iw,ih);
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

// ---- 動畫排程：輪到「我」的純文字訊息時,先打字再送出 ----
const POP=0.45, ANIM=0.42, TYPE_MIN=0.5, TYPE_MAX=2.4, TYPE_PER=0.075;
function isMeMsg(m){ const c=charById(m.cid); return !!(c&&c.me); }
function typeDurOf(m){ const sp=S.typeSpeed||1; return Math.min(TYPE_MAX, Math.max(TYPE_MIN, (m.text||'').length*TYPE_PER))/sp; }
function buildSchedule(){
  const ev=[]; let t=0;
  S.msgs.forEach((m,i)=>{
    const typing=S.showInput && isMeMsg(m) && m.cid!=='__sys' && !m.img && m.text && m.text.trim();
    if(typing){ const d=typeDurOf(m); ev[i]={typeStart:t, typeEnd:t+d, appear:t+d}; t+=d+S.interval; }
    else { ev[i]={typeStart:null, typeEnd:null, appear:t}; t+=S.interval; }
  });
  const last=ev.length?ev[ev.length-1].appear:0;
  return {ev, total:Math.max(0.001, last+POP+S.tail)};
}
function inputBarH(H){ return S.showInput?Math.round(H*0.078):0; }
function drawInputBar(W,H,ih,text,typing,tNow){
  const st=S.style, y0=H-ih;
  ctx.fillStyle=st.headerBg; ctx.fillRect(0,y0,W,ih);
  ctx.strokeStyle='rgba(0,0,0,.08)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(0,y0); ctx.lineTo(W,y0); ctx.stroke();
  const pad=W*0.045, sendD=ih*0.5, sendX=W-pad-sendD, sendY=y0+(ih-sendD)/2;
  const fieldX=pad, fieldH=ih*0.56, fieldY=y0+(ih-fieldH)/2, fieldW=sendX-pad*0.6-fieldX;
  ctx.fillStyle='rgba(127,127,127,.16)'; rr(fieldX,fieldY,fieldW,fieldH,fieldH/2); ctx.fill();
  const fs=Math.round(W*0.03), tcy=fieldY+fieldH/2, tx=fieldX+fs*0.7;
  ctx.font=`400 ${fs}px ${st.font}`; ctx.textBaseline='middle'; ctx.textAlign='left';
  ctx.save(); rr(fieldX,fieldY,fieldW,fieldH,fieldH/2); ctx.clip();
  if(text){
    const tw=ctx.measureText(text).width, maxTW=fieldW-fs*1.6; let dx=tx; if(tw>maxTW) dx=tx-(tw-maxTW);
    ctx.fillStyle=st.headerInk; ctx.fillText(text,dx,tcy);
    if(typing && Math.floor(tNow*2)%2===0){ ctx.fillStyle=st.headerInk; const cx=Math.min(dx+tw+2,fieldX+fieldW-fs*0.5); ctx.fillRect(cx,tcy-fs*0.55,Math.max(1.5,W*0.003),fs*1.12); }
  } else {
    ctx.fillStyle=hexToRgba(st.headerInk,0.38); ctx.fillText('輸入訊息…',tx,tcy);
  }
  ctx.restore();
  const active=!!text, cx=sendX+sendD/2, cy=sendY+sendD/2, a=sendD*0.22;
  ctx.fillStyle=active?st.meBg:'rgba(127,127,127,.32)'; ctx.beginPath(); ctx.arc(cx,cy,sendD/2,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle=active?st.meInk:'rgba(255,255,255,.65)'; ctx.lineWidth=sendD*0.1; ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.beginPath(); ctx.moveTo(cx,cy+a); ctx.lineTo(cx,cy-a); ctx.moveTo(cx-a*0.7,cy-a*0.15); ctx.lineTo(cx,cy-a); ctx.lineTo(cx+a*0.7,cy-a*0.15); ctx.stroke();
}

function render(progress=1){
  if(!cv.width) setSize();
  const W=cv.width,H=cv.height,st=S.style;
  // bg
  if(S.room.bg==='img'&&S.room.img){ drawBgCover(ctx,W,H,S.room.img,S.room.zoom||1, S.room.fx==null?0.5:S.room.fx, S.room.fy==null?0.5:S.room.fy); }
  else if(S.room.bg==='grad'){ const a=S.room.angle*Math.PI/180,x=Math.cos(a),y=Math.sin(a); const g=ctx.createLinearGradient(W/2-x*W/2,H/2-y*H/2,W/2+x*W/2,H/2+y*H/2); g.addColorStop(0,S.room.c1); g.addColorStop(1,S.room.c2); ctx.fillStyle=g; ctx.fillRect(0,0,W,H); }
  else{ ctx.fillStyle=S.room.c1; ctx.fillRect(0,0,W,H); }

  const L=layout(W,H), n=S.msgs.length;
  const {ev,total}=buildSchedule(), tNow=progress*total;
  let visCount=0; for(let i=0;i<n;i++){ if(ev[i]&&tNow>=ev[i].appear-0.001) visCount=i+1; }
  if(progress>=1) visCount=n;
  const headerH=L.headerH, ih=inputBarH(H), viewBottom=H-ih; let scroll=0;
  if(L.contentBottom>viewBottom){ const ref=L.blocks.slice(0,visCount).pop(); const tb=ref?ref.y+(ref.h||ref.bh||0)+L.PAD:viewBottom; scroll=Math.max(0,tb-viewBottom); scroll=Math.min(scroll,L.contentBottom-viewBottom); }

  ctx.save(); ctx.beginPath(); ctx.rect(0,headerH,W,viewBottom-headerH); ctx.clip();
  for(let i=0;i<visCount;i++){
    const b=L.blocks[i]; if(!b) continue;
    let k=(tNow-(ev[i]?ev[i].appear:0))/ANIM; k=Math.max(0,Math.min(1,k)); const ease=1-Math.pow(1-k,3);
    const yy=b.y-scroll+(1-ease)*W*0.05;
    if(yy>viewBottom+60||(yy+(b.h||b.bh||0))<headerH-60) continue;
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
    const maxR=Math.min(bh*0.5,W*0.06);
    if(b.isImg){
      ctx.save(); rr(bx,yy,bw,bh,maxR*st.radius); ctx.clip();
      ctx.fillStyle=col.bg; ctx.fillRect(bx,yy,bw,bh);
      drawImageCoverRect(b.img,bx,yy,b.imgW,b.imgH);
      ctx.restore();
      if(b.capRich) drawRich(b.capRich, bx+padX, yy+b.imgH+padY*0.6, col.ink);
    } else {
      ctx.fillStyle=col.bg; rr(bx,yy,bw,bh,maxR*st.radius); ctx.fill();
      drawRich(rich, bx+padX, yy+padY, col.ink);
    }
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

  // 模擬輸入框（含打字機動畫）
  if(ih>0){
    let typeText='', typing=false;
    for(let i=0;i<n;i++){ const e=ev[i]; if(e&&e.typeStart!=null&&tNow>=e.typeStart&&tNow<e.appear){
      const m=S.msgs[i], p=(tNow-e.typeStart)/Math.max(0.001,e.typeEnd-e.typeStart);
      typeText=(m.text||'').slice(0,Math.max(0,Math.floor(p*(m.text||'').length))); typing=true; break; } }
    drawInputBar(W,H,ih,typeText,typing,tNow);
  }
}

let exporting=false;

// ---- animation/export ----
let playing=false;
function animDuration(){ return buildSchedule().total; }
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
  const btn=document.getElementById('mp4Btn'); const btnLabel=document.getElementById('mp4BtnLabel'); btnLabel.textContent='● 錄製中…';
  exporting=true;
  rec.start(); render(0); await new Promise(r=>setTimeout(r,120)); await runAnim(); await new Promise(r=>setTimeout(r,180));
  rec.stop(); await stopped; exporting=false; render(1); dl(new Blob(chunks,{type:isMp4?'video/mp4':'video/webm'}), isMp4?'mp4':'webm');
  btnLabel.textContent='輸出影片 MP4';
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
// 收合狀態下點整條側欄也能展開
document.querySelectorAll('.side').forEach(sec=>sec.addEventListener('click',e=>{
  if(!sec.classList.contains('collapsed'))return;
  if(e.target.closest('.collapse'))return;
  const btn=sec.querySelector('.collapse'); if(btn) btn.click();
}));

// 側欄拖曳調整寬度
(function(){
  const MIN=240, MAX=620;
  document.querySelectorAll('.side').forEach(side=>{
    const rz=side.querySelector('[data-resizer]'); if(!rz) return;
    const isLeft=side.classList.contains('left');
    const key='chatSideW:'+(side.id||'side');
    try{ const w=localStorage.getItem(key); if(w) side.style.width=parseInt(w,10)+'px'; }catch{}
    function begin(){
      const r=side.getBoundingClientRect();
      document.body.classList.add('resizing');
      function move(x){ let w=isLeft?(x-r.left):(r.right-x); w=Math.max(MIN,Math.min(MAX,w)); side.style.width=w+'px'; }
      function end(){ document.body.classList.remove('resizing'); try{ localStorage.setItem(key,parseInt(side.style.width,10)); }catch{} }
      return {move,end};
    }
    rz.addEventListener('mousedown',ev=>{ if(side.classList.contains('collapsed'))return; ev.preventDefault();
      const {move,end}=begin();
      function mm(e){ move(e.clientX); }
      function mu(){ end(); document.removeEventListener('mousemove',mm); document.removeEventListener('mouseup',mu); }
      document.addEventListener('mousemove',mm); document.addEventListener('mouseup',mu);
    });
    rz.addEventListener('touchstart',ev=>{ if(side.classList.contains('collapsed'))return; if(ev.touches.length!==1)return; ev.preventDefault();
      const {move,end}=begin();
      function tm(e){ if(e.touches.length!==1)return; move(e.touches[0].clientX); }
      function te(){ end(); document.removeEventListener('touchmove',tm); document.removeEventListener('touchend',te); }
      document.addEventListener('touchmove',tm,{passive:false}); document.addEventListener('touchend',te);
    },{passive:false});
    rz.addEventListener('dblclick',()=>{ side.style.width=''; try{ localStorage.removeItem(key); }catch{} });
  });
})();

// 行內語法 dialog
(function(){
  const m=$('#syntaxModal'); if(!m) return;
  $('#syntaxBtn').onclick=()=>m.classList.remove('hidden');
  $('#syntaxOk').onclick=()=>m.classList.add('hidden');
  m.onclick=e=>{ if(e.target===m) m.classList.add('hidden'); };
})();

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
  $('#listSection').classList.toggle('hidden',b.dataset.in==='text'); // 純文本只顯示輸入框
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
  $('#inputSpeedRow').classList.toggle('hidden',!S.showInput);
  $('#startTimeRow').classList.toggle('hidden',!S.showTime);
  $('#readCountRow').classList.toggle('hidden',!(S.mode==='group'&&S.showRead));
  // 1對1 模式不顯示暱稱,鎖定該勾選框
  const nameOff=S.mode!=='group', meName=$('#meName');
  meName.disabled=nameOff;
  meName.closest('.chk').classList.toggle('disabled',nameOff);
}
$('#inputToggle').onclick=e=>{ S.showInput=!S.showInput; e.target.classList.toggle('on',S.showInput); e.target.textContent=S.showInput?'開':'關'; syncToggleRows(); updateDur(); render(1); };
$('#typeSpeed').oninput=e=>{ S.typeSpeed=+e.target.value; $('#typeSpeedV').textContent=(+e.target.value).toFixed(1)+'x'; updateDur(); render(1); };
$('#timeToggle').onclick=e=>{ S.showTime=!S.showTime; e.target.classList.toggle('on',S.showTime); e.target.textContent=S.showTime?'開':'關'; syncToggleRows(); render(1); };
$('#readToggle').onclick=e=>{ S.showRead=!S.showRead; e.target.classList.toggle('on',S.showRead); e.target.textContent=S.showRead?'開':'關'; syncToggleRows(); render(1); };
$('#startTime').oninput=e=>{ S.startTime=e.target.value||'21:30'; render(1); };
$('#readCount').oninput=e=>{ S.readCount=Math.max(1,Math.min(99,+e.target.value||1)); render(1); };
$('#playBtn').onclick=()=>{ if(!playing) runAnim(); };
$('#pngBtn').onclick=exportPNG; $('#mp4Btn').onclick=exportMP4;
$('#addChar').onclick=()=>{ S.chars.push(makeChar('角色'+(S.chars.length+1))); renderChars(); renderQuick(); render(1); };
$('#attachImg').onclick=()=>{ if(composeCid==='__sys'){ alert('系統訊息不支援圖片。'); return; }
  openImgEditor(pendingImg,(im,meta)=>{ pendingImg=im; pendingMeta=meta; renderAttachPreview(); }, pendingMeta); };
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
// 把已載入的 Image 經 canvas 重畫成同源 data-uri,順便縮到 MAX：
// 確保跨域(網址)圖不會污染輸出 canvas,輸出 PNG / MP4 才不會失敗
function normalizeImg(im,cb,onFail){
  try{
    const MAX=2000, long=Math.max(im.width,im.height), k=long>MAX?MAX/long:1;
    const oc=document.createElement('canvas');
    oc.width=Math.round(im.width*k); oc.height=Math.round(im.height*k);
    oc.getContext('2d').drawImage(im,0,0,oc.width,oc.height);
    const data=oc.toDataURL('image/png'); // 跨域污染時這裡會丟例外
    const out=new Image(); out.onload=()=>cb(out); out.onerror=()=>onFail&&onFail(); out.src=data;
  }catch(err){ onFail&&onFail(err); }
}
function loadImgFromUrl(url,cb){
  url=(url||'').trim(); if(!url) return;
  const im=new Image(); im.crossOrigin='anonymous';
  im.onerror=()=>alert('無法載入這個網址的圖片(可能是連結失效或不允許跨網站讀取),請改用上傳。');
  im.onload=()=>normalizeImg(im,cb,()=>alert('這個網址的圖片不允許跨網站使用,無法用於輸出,請改用上傳。'));
  im.src=url;
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
function quickAdd(){
  const text=$('#quickInput').value.trim();
  if(!text&&!pendingImg) return;
  validComposeCid();
  if(composeCid==='__sys'){ if(!text) return; S.msgs.push({id:nid(),cid:'__sys',text,time:'',read:false}); }
  else{
    if(!composeCid){ alert('請先到「角色」分頁新增角色。'); return; }
    S.msgs.push({id:nid(),cid:composeCid,text,img:pendingImg||null,
      imgType:pendingImg?(pendingMeta&&pendingMeta.type||'local'):null,
      imgUrl:pendingImg?(pendingMeta&&pendingMeta.url||null):null,
      imgTok:pendingImg?nid():null, time:'',read:false});
  }
  pendingImg=null; pendingMeta=null; renderAttachPreview();
  refreshRead(); $('#quickInput').value=''; renderQuick(); renderMsgs(); render(1); scheduleSave();
  const ml=$('#msgList'); ml.scrollTop=ml.scrollHeight; $('#quickInput').focus();
}
function parseBulk(txt){
  // 套用前先用舊列表建立圖片索引,讓本機/網址圖能依 token 或網址復原
  const byTok={}, byUrl={};
  S.msgs.forEach(m=>{ if(m.img&&m.imgTok) byTok[m.imgTok]=m.img; if(m.img&&m.imgType==='url'&&m.imgUrl) byUrl[m.imgUrl]=m.img; });
  const out=[], reload=[];
  txt.split('\n').forEach(line=>{ if(line.trim()==='')return; const p=splitLine(line);
    if(p){ const cid=findOrCreateChar(p.name);
      const tm=cid!=='__sys'&&p.text.match(/^\s*\[([^\]]*)\]\s*([\s\S]*)$/);
      if(tm){ const inside=tm[1].trim(), cap=tm[2];
        const lm=inside.match(/^本機上傳(?:#(\S+))?$/);
        if(lm){ const tok=lm[1], img=tok?byTok[tok]:null;
          if(img) out.push({id:nid(),cid,text:cap,img,imgType:'local',imgUrl:null,imgTok:tok,time:'',read:false});
          else out.push({id:nid(),cid,text:cap,time:'',read:false}); } // 無對應 token,本機圖已無法復原
        else if(/^https?:\/\//i.test(inside)){ const img=byUrl[inside]||null;
          const msg={id:nid(),cid,text:cap,img,imgType:'url',imgUrl:inside,imgTok:nid(),time:'',read:false};
          out.push(msg); if(!img) reload.push(msg); }
        else out.push({id:nid(),cid,text:p.text,time:'',read:false}); // 非圖片標記,當一般文字
      } else out.push({id:nid(),cid,text:p.text,time:'',read:false});
    } else if(out.length){ out[out.length-1].text+='\n'+line; } });
  S.msgs=out; refreshRead();
  reload.forEach(m=>loadImgFromUrl(m.imgUrl,im=>{ m.img=im; renderMsgs(); render(1); }));
}
function serializeMsgs(){ return S.msgs.map(m=>{ const name=m.cid==='__sys'?'系統':(charById(m.cid)?.name||'?'); const cap=(m.text||'').replace(/\n/g,'\\n');
  if(m.img){ const tag=m.imgType==='url'?(m.imgUrl||'圖片網址'):'本機上傳'+(m.imgTok?'#'+m.imgTok:''); return name+': ['+tag+']'+(cap?' '+cap:''); }
  return name+': '+cap; }).join('\n'); }
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

// ---- composer：選說話者 → 台詞 / 附圖 → 送出 ----
let composeCid=null, pendingImg=null, pendingMeta=null;
function validComposeCid(){
  if(composeCid==='__sys') return;
  if(composeCid && charById(composeCid)) return;
  const me=meChar(); composeCid=me?me.id:(S.chars[0]?S.chars[0].id:null);
}
function renderQuick(){
  validComposeCid();
  const box=$('#quickChips'); box.innerHTML='';
  S.chars.forEach(c=>{
    const b=document.createElement('button'); b.className='pill'+(composeCid===c.id?' on':'');
    b.textContent=(c.me?'★ ':'')+c.name;
    b.onclick=()=>{ composeCid=c.id; renderQuick(); $('#quickInput').focus(); };
    box.appendChild(b);
  });
  const sys=document.createElement('button'); sys.className='pill'+(composeCid==='__sys'?' on':'');
  sys.textContent='系統';
  sys.onclick=()=>{ composeCid='__sys'; renderQuick(); $('#quickInput').focus(); };
  box.appendChild(sys);
  syncAttachState();
}
function syncAttachState(){
  const isSys=composeCid==='__sys', btn=$('#attachImg');
  btn.disabled=isSys; btn.style.opacity=isSys?0.4:1; btn.style.cursor=isSys?'not-allowed':'pointer';
  if(isSys&&pendingImg){ pendingImg=null; pendingMeta=null; renderAttachPreview(); }
}
function renderAttachPreview(){
  const box=$('#attachPreview');
  if(!pendingImg){ box.classList.add('hidden'); box.innerHTML=''; $('#attachImg').classList.remove('on'); return; }
  const srcLabel=pendingMeta&&pendingMeta.type==='url'?'網址圖片':'本機上傳';
  box.classList.remove('hidden');
  box.innerHTML=`<img id="apThumb" src="${pendingImg.src}" title="點擊重新裁切"><span class="ap-meta">${srcLabel}・台詞當作圖片說明(可留空)</span><button class="ap-rm" id="apRm" title="移除">✕</button>`;
  $('#apThumb').onclick=()=>openImgEditor(pendingImg,(im,meta)=>{ pendingImg=im; pendingMeta=meta; renderAttachPreview(); }, pendingMeta);
  $('#apRm').onclick=()=>{ pendingImg=null; pendingMeta=null; renderAttachPreview(); };
  $('#attachImg').classList.add('on');
}

function renderMsgs(){
  const box=$('#msgList'); box.innerHTML=''; $('#msgCount').textContent='共 '+S.msgs.length+' 句';
  S.msgs.forEach(m=>{
    const name=m.cid==='__sys'?'系統':(charById(m.cid)?.name||'?');
    const isSys=m.cid==='__sys';
    const imgCell=isSys?'':`<div class="imgcell">${m.img
      ?`<img class="thumb" src="${m.img.src}" data-imgedit="${m.id}" title="點擊重新裁切"><button class="mv" data-imgdel="${m.id}" style="font-size:10px;color:var(--ink3)">移除圖</button>`
      :`<button class="addimg" data-imgedit="${m.id}"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M5 16l4-3.5 3.5 3 3-2.5L19 16"/></svg>圖片</button>`}</div>`;
    const el=document.createElement('div'); el.className='msg'; el.draggable=true; el.dataset.id=m.id;
    el.innerHTML=`<span class="drag" title="拖曳排序">⠿</span>
      <div class="who">${escapeHtml(name)}</div>
      <textarea data-text="${m.id}" rows="1" placeholder="${m.img?'圖片說明(可留空)':''}">${escapeHtml(m.text)}</textarea>
      ${imgCell}
      <div class="side2"><button class="mv" data-rm="${m.id}" style="color:var(--danger)">✕</button></div>`;
    // 編輯欄位時暫時關閉拖曳,避免選字觸發拖曳
    el.querySelectorAll('textarea,input,button,.thumb,.addimg').forEach(x=>{
      x.addEventListener('pointerdown',()=>{ el.draggable=false; });
      x.addEventListener('pointerup',()=>{ el.draggable=true; });
    });
    el.addEventListener('dragstart',()=>{ el.classList.add('dragging'); });
    el.addEventListener('dragend',()=>{ el.classList.remove('dragging'); commitMsgOrder(); });
    box.appendChild(el);
  });
  box.ondragover=e=>{ e.preventDefault(); const dragging=box.querySelector('.dragging'); if(!dragging) return;
    const after=dragAfter(box,e.clientY); if(after==null) box.appendChild(dragging); else box.insertBefore(dragging,after); };
  box.ondrop=e=>e.preventDefault();
  box.querySelectorAll('[data-text]').forEach(t=>{ autoGrow(t); t.oninput=e=>{ S.msgs.find(m=>m.id===t.dataset.text).text=e.target.value; autoGrow(t); render(1); }; });
  box.querySelectorAll('[data-imgedit]').forEach(b=>b.onclick=()=>{ const m=S.msgs.find(x=>x.id===b.dataset.imgedit);
    openImgEditor(m.img,(im,meta)=>{ m.img=im; m.imgType=meta&&meta.type||'local'; m.imgUrl=meta&&meta.url||null; m.imgTok=m.imgTok||nid(); renderMsgs(); render(1); }, {type:m.imgType,url:m.imgUrl}); });
  box.querySelectorAll('[data-imgdel]').forEach(b=>b.onclick=()=>{ const m=S.msgs.find(x=>x.id===b.dataset.imgdel); m.img=null; m.imgType=null; m.imgUrl=null; renderMsgs(); render(1); });
  box.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{ S.msgs=S.msgs.filter(m=>m.id!==b.dataset.rm); refreshRead(); renderMsgs(); render(1); });
  updateDur();
}
// 拖曳排序：找出游標下方最近的列(插入點)
function dragAfter(box,y){
  const els=[...box.querySelectorAll('.msg:not(.dragging)')];
  let closest={offset:-Infinity,el:null};
  for(const el of els){ const r=el.getBoundingClientRect(), offset=y-r.top-r.height/2;
    if(offset<0&&offset>closest.offset) closest={offset,el}; }
  return closest.el;
}
// 依目前 DOM 順序重排 S.msgs
function commitMsgOrder(){
  const ids=[...$('#msgList').querySelectorAll('.msg')].map(el=>el.dataset.id);
  S.msgs.sort((a,b)=>ids.indexOf(a.id)-ids.indexOf(b.id));
  refreshRead(); renderMsgs(); render(1); scheduleSave();
}
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

// ---- 訊息圖片裁切 modal(上傳 / 貼網址 + 固定比例 / 自由裁切) ----
const imgCv=document.getElementById('imgCv'), imgMCtx=imgCv.getContext('2d');
const IMGM=560; let imgState=null, imgDrag=null;
const FREE_DEFAULT={x:0.08,y:0.08,w:0.84,h:0.84};
// 依比例算 frame 尺寸;'orig' 用圖片原始長寬比
function imgFrame(ratio,img){
  let rw,rh;
  if(ratio==='orig'||ratio==='free'){ if(!img) return [IMGM,IMGM]; rw=img.width; rh=img.height; }
  else{ [rw,rh]=ratio.split(':').map(Number); }
  let w,h; if(rw>=rh){ w=IMGM; h=IMGM*rh/rw; } else { h=IMGM; w=IMGM*rw/rh; }
  return [Math.round(w),Math.round(h)];
}
// 自由裁切：畫布貼合整張圖,長邊 600
function imgFreeSize(img){ const L=600, s=L/Math.max(img.width,img.height); return [Math.round(img.width*s),Math.round(img.height*s)]; }
function isFree(){ return imgState.ratio==='free'; }
function syncImgModalUI(){
  const free=isFree();
  $('#imgZoomField').classList.toggle('hidden',free);
  $('#imgCropHint').textContent= imgState.img
    ? (free?'拖曳四角調整裁切範圍,框內為輸出區域':'點預覽範圍可上傳 / 更換圖片,拖曳調整位置')
    : '點預覽範圍可上傳,或於上方貼網址';
}
function drawFreeCrop(){
  const img=imgState.img, [W,H]=imgFreeSize(img); imgCv.width=W; imgCv.height=H;
  const disp=300, sc=disp/Math.max(W,H); imgCv.style.width=(W*sc)+'px'; imgCv.style.height=(H*sc)+'px';
  imgMCtx.clearRect(0,0,W,H); imgMCtx.drawImage(img,0,0,W,H);
  const r=imgState.crop, rx=r.x*W, ry=r.y*H, rw=r.w*W, rh=r.h*H;
  imgMCtx.save(); imgMCtx.fillStyle='rgba(0,0,0,.5)'; imgMCtx.beginPath(); imgMCtx.rect(0,0,W,H); imgMCtx.rect(rx,ry,rw,rh); imgMCtx.fill('evenodd'); imgMCtx.restore();
  imgMCtx.strokeStyle='rgba(255,255,255,.95)'; imgMCtx.lineWidth=2; imgMCtx.strokeRect(rx,ry,rw,rh);
  const hs=10; imgMCtx.fillStyle='#fff';
  [[rx,ry],[rx+rw,ry],[rx,ry+rh],[rx+rw,ry+rh]].forEach(([hx,hy])=>imgMCtx.fillRect(hx-hs/2,hy-hs/2,hs,hs));
}
function drawImgModal(){
  syncImgModalUI();
  if(isFree()&&imgState.img){ drawFreeCrop(); return; }
  const fr=isFree()?'orig':imgState.ratio;
  const [W,H]=imgFrame(fr,imgState.img); imgCv.width=W; imgCv.height=H;
  const disp=300, sc=disp/Math.max(W,H); imgCv.style.width=(W*sc)+'px'; imgCv.style.height=(H*sc)+'px';
  if(imgState.img){
    drawBgCover(imgMCtx,W,H,imgState.img,imgState.zoom,imgState.fx,imgState.fy);
  } else {
    imgMCtx.fillStyle='#0a0c10'; imgMCtx.fillRect(0,0,W,H);
    imgMCtx.fillStyle='#5f6878'; imgMCtx.textAlign='center'; imgMCtx.textBaseline='middle';
    imgMCtx.font='600 16px "Noto Sans TC",sans-serif'; imgMCtx.fillText('點此上傳,或於上方貼網址', W/2, H/2);
  }
  imgMCtx.strokeStyle='rgba(255,255,255,.85)'; imgMCtx.lineWidth=2; imgMCtx.strokeRect(1,1,W-2,H-2);
}
function openImgEditor(srcImg,onApply,initMeta){
  imgState={img:srcImg||null, zoom:1, fx:0.5, fy:0.5, ratio:'orig', crop:{...FREE_DEFAULT}, onApply,
    srcType:initMeta&&initMeta.type||null, srcUrl:initMeta&&initMeta.url||null};
  segPick($('#imgRatioSeg'),'orig'); $('#imgUrl').value='';
  $('#imgZoom').value=1; $('#imgZoomV').textContent='100%';
  $('#imgModal').classList.remove('hidden'); drawImgModal();
}
function setImgEditorImage(im){
  imgState.img=im; imgState.zoom=1; imgState.fx=0.5; imgState.fy=0.5; imgState.crop={...FREE_DEFAULT};
  $('#imgZoom').value=1; $('#imgZoomV').textContent='100%'; drawImgModal();
}
$('#imgUpload').onclick=()=>$('#imgFile').click();
$('#imgFile').onchange=e=>{ if(!imgState)return; loadImg(e.target.files[0],im=>{ imgState.srcType='local'; imgState.srcUrl=null; setImgEditorImage(im); }); e.target.value=''; };
$('#imgUrlLoad').onclick=()=>{ if(!imgState)return; const u=$('#imgUrl').value.trim(); loadImgFromUrl(u,im=>{ imgState.srcType='url'; imgState.srcUrl=u; setImgEditorImage(im); }); };
$('#imgUrl').addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); $('#imgUrlLoad').click(); }});
$('#imgRatioSeg').onclick=e=>{ const b=e.target.closest('button'); if(!b||!imgState)return; segPick($('#imgRatioSeg'),b.dataset.v); imgState.ratio=b.dataset.v; if(b.dataset.v==='free') imgState.crop={...FREE_DEFAULT}; drawImgModal(); };
$('#imgZoom').oninput=e=>{ if(!imgState)return; imgState.zoom=+e.target.value; $('#imgZoomV').textContent=Math.round(e.target.value*100)+'%'; drawImgModal(); };
$('#imgCropReset').onclick=()=>{ if(!imgState)return; if(isFree()){ imgState.crop={...FREE_DEFAULT}; } else { imgState.zoom=1; imgState.fx=0.5; imgState.fy=0.5; $('#imgZoom').value=1; $('#imgZoomV').textContent='100%'; } drawImgModal(); };
// 自由裁切：抓四角或框內移動
function imgPt(e){ const r=imgCv.getBoundingClientRect(); return [(e.clientX-r.left)*(imgCv.width/r.width), (e.clientY-r.top)*(imgCv.height/r.height)]; }
function freeHit(px,py){
  const W=imgCv.width,H=imgCv.height,r=imgState.crop, rx=r.x*W,ry=r.y*H,rw=r.w*W,rh=r.h*H,hs=16;
  const cs={nw:[rx,ry],ne:[rx+rw,ry],sw:[rx,ry+rh],se:[rx+rw,ry+rh]};
  for(const k in cs){ if(Math.abs(px-cs[k][0])<hs&&Math.abs(py-cs[k][1])<hs) return k; }
  if(px>rx&&px<rx+rw&&py>ry&&py<ry+rh) return 'move';
  return null;
}
function freeUpdate(px,py){
  const W=imgCv.width,H=imgCv.height,nx=Math.min(1,Math.max(0,px/W)),ny=Math.min(1,Math.max(0,py/H)),r=imgState.crop,MIN=0.05,t=imgDrag.target;
  if(t==='move'){ r.x=Math.min(1-r.w,Math.max(0,nx-imgDrag.ox)); r.y=Math.min(1-r.h,Math.max(0,ny-imgDrag.oy)); }
  else{ let x1=r.x,y1=r.y,x2=r.x+r.w,y2=r.y+r.h;
    if(t.includes('w')) x1=Math.min(x2-MIN,nx); if(t.includes('e')) x2=Math.max(x1+MIN,nx);
    if(t.includes('n')) y1=Math.min(y2-MIN,ny); if(t.includes('s')) y2=Math.max(y1+MIN,ny);
    r.x=x1; r.y=y1; r.w=x2-x1; r.h=y2-y1; }
  drawFreeCrop();
}
imgCv.addEventListener('pointerdown',e=>{ if(!imgState)return; try{imgCv.setPointerCapture(e.pointerId);}catch(_){}
  if(isFree()&&imgState.img){ const [px,py]=imgPt(e); const t=freeHit(px,py); const r=imgState.crop;
    imgDrag={free:true,target:t,ox:px/imgCv.width-r.x,oy:py/imgCv.height-r.y}; return; }
  imgDrag={x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,moved:false}; });
imgCv.addEventListener('pointermove',e=>{ if(!imgDrag||!imgState)return;
  if(imgDrag.free){ if(imgDrag.target){ const [px,py]=imgPt(e); freeUpdate(px,py); } return; }
  if(Math.abs(e.clientX-imgDrag.sx)>4||Math.abs(e.clientY-imgDrag.sy)>4) imgDrag.moved=true;
  if(!imgState.img)return;
  const r=imgCv.getBoundingClientRect(); const [W,H]=imgFrame(imgState.ratio,imgState.img);
  const dx=(e.clientX-imgDrag.x)*(W/r.width), dy=(e.clientY-imgDrag.y)*(H/r.height); imgDrag.x=e.clientX; imgDrag.y=e.clientY;
  const im=imgState.img, s=Math.max(W/im.width,H/im.height)*imgState.zoom, dw=im.width*s, dh=im.height*s;
  imgState.fx=Math.min(1,Math.max(0,imgState.fx - dx/dw)); imgState.fy=Math.min(1,Math.max(0,imgState.fy - dy/dh)); drawImgModal(); });
imgCv.addEventListener('pointerup',e=>{ if(imgDrag&&!imgDrag.free&&!imgDrag.moved&&imgState&&!imgState.img) $('#imgFile').click(); });
window.addEventListener('pointerup',()=>{ imgDrag=null; });
$('#imgCropCancel').onclick=()=>{ $('#imgModal').classList.add('hidden'); imgState=null; };
$('#imgCropOk').onclick=()=>{ if(!imgState)return; if(!imgState.img){ alert('請先上傳或載入一張圖片。'); return; }
  const oc=document.createElement('canvas'); const im=imgState.img;
  if(isFree()){
    const r=imgState.crop, sx=r.x*im.width, sy=r.y*im.height, sw=r.w*im.width, sh=r.h*im.height;
    const k=Math.min(1,1000/Math.max(sw,sh)); oc.width=Math.round(sw*k); oc.height=Math.round(sh*k);
    oc.getContext('2d').drawImage(im, sx,sy,sw,sh, 0,0,oc.width,oc.height);
  } else {
    const [fw,fh]=imgFrame(imgState.ratio,im), k=1000/Math.max(fw,fh);
    oc.width=Math.round(fw*k); oc.height=Math.round(fh*k);
    drawBgCover(oc.getContext('2d'),oc.width,oc.height,im,imgState.zoom,imgState.fx,imgState.fy);
  }
  const apply=imgState.onApply, meta={type:imgState.srcType,url:imgState.srcUrl};
  const out=new Image(); out.onload=()=>apply(out,meta); out.src=oc.toDataURL('image/png');
  $('#imgModal').classList.add('hidden'); imgState=null; };

// ---- 自動儲存（localStorage）----
const LS_KEY='chat-studio-v1';
function imgSrc(im){ return im&&im.src?im.src:null; }
function srcToImg(src){ return new Promise(res=>{ if(!src){res(null);return;} const im=new Image(); im.onload=()=>res(im); im.onerror=()=>res(null); im.src=src; }); }
function buildSaveData(){
  const data={ v:1, uid,
    mode:S.mode, ratio:S.ratio, fontKey:S.fontKey,
    room:{...S.room, img:imgSrc(S.room.img)},
    style:{...S.style},
    chars:S.chars.map(c=>({...c, img:imgSrc(c.img)})),
    msgs:S.msgs.map(m=>({...m, img:imgSrc(m.img)})),
    interval:S.interval, tail:S.tail, showTime:S.showTime, startTime:S.startTime,
    showRead:S.showRead, readCount:S.readCount, showMeAvatar:S.showMeAvatar, showMeName:S.showMeName, showInput:S.showInput, typeSpeed:S.typeSpeed };
  return data;
}
function saveState(){
  try{
    localStorage.setItem(LS_KEY, JSON.stringify(buildSaveData()));
  }catch(e){ /* 容量超出等錯誤：自動儲存為盡力而為,忽略 */ }
}
// ---- 手動存檔 / 讀檔（下載 / 上傳 .json）----
function downloadSave(){
  const data=buildSaveData();
  data._type="chat-save";
  const now=new Date();
  const p=n=>String(n).padStart(2,"0");
  const name=`chat-${now.getFullYear()}${p(now.getMonth()+1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}.json`;
  const blob=new Blob([JSON.stringify(data)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function loadSaveFile(file){
  if(!file) return;
  let d;
  try{
    const text=await file.text();
    d=JSON.parse(text);
  }catch(e){ alert("讀檔失敗：檔案無法解析"); return; }
  if(!(d&&(d.v===1||d._type==="chat-save"))){ alert("讀檔失敗：不是有效的 Chat 存檔"); return; }
  await applyState(d);
  syncUIFromState();
  render(1);
  saveState();
}
let saveTimer=null;
function scheduleSave(){ clearTimeout(saveTimer); saveTimer=setTimeout(saveState,600); }
function loadJSON(){ try{ const d=JSON.parse(localStorage.getItem(LS_KEY)); return (d&&d.v===1)?d:null; }catch(e){ return null; } }
async function applyState(data){
  uid=data.uid||uid;
  S.mode=data.mode||S.mode; S.ratio=data.ratio||S.ratio;
  if(data.fontKey&&FONTS[data.fontKey]) S.fontKey=data.fontKey;
  Object.assign(S.style, data.style||{});
  Object.assign(S.room, data.room||{}); S.room.img=null;
  ['interval','tail','showTime','startTime','showRead','readCount','showMeAvatar','showMeName','showInput','typeSpeed'].forEach(k=>{ if(data[k]!==undefined) S[k]=data[k]; });
  S.chars=(data.chars||[]).map(c=>({...c, img:null}));
  S.msgs=(data.msgs||[]).map(m=>({...m, img:null}));
  const tasks=[];
  if(data.room&&data.room.img) tasks.push(srcToImg(data.room.img).then(im=>S.room.img=im));
  (data.chars||[]).forEach((c,i)=>{ if(c.img) tasks.push(srcToImg(c.img).then(im=>{ if(S.chars[i]) S.chars[i].img=im; })); });
  (data.msgs||[]).forEach((m,i)=>{ if(m.img) tasks.push(srcToImg(m.img).then(im=>{ if(S.msgs[i]) S.msgs[i].img=im; })); });
  await Promise.all(tasks);
  // 補齊舊資料缺少的圖片來源/識別碼,確保純文本來回不丟圖
  S.msgs.forEach(m=>{ if(m.img){ if(!m.imgType) m.imgType=m.imgUrl?'url':'local'; if(!m.imgTok) m.imgTok=nid(); } });
}
function syncUIFromState(){
  segPick($('#modeSeg'),S.mode); segPick($('#ratioSeg'),S.ratio);
  $('#fontSel').value=S.fontKey;
  $('#roomName').value=S.room.name;
  $('#meAvatar').checked=S.showMeAvatar; $('#meName').checked=S.showMeName;
  segPick($('#bgSeg'),S.room.bg);
  $('#bgC2').classList.toggle('hidden',S.room.bg!=='grad');
  $('#bgAngleWrap').classList.toggle('hidden',S.room.bg!=='grad');
  $('#bgC1').classList.toggle('hidden',S.room.bg==='img');
  $('#bgEditRow').classList.toggle('hidden',S.room.bg!=='img');
  $('#bgC1').value=S.room.c1; $('#bgC2').value=S.room.c2;
  $('#bgAngle').value=S.room.angle; $('#bgAngleV').textContent=S.room.angle+'°';
  $('#interval').value=S.interval; $('#intervalV').textContent=S.interval+'s';
  $('#tail').value=S.tail; $('#tailV').textContent=S.tail+'s';
  $('#inputToggle').classList.toggle('on',S.showInput); $('#inputToggle').textContent=S.showInput?'開':'關';
  $('#typeSpeed').value=S.typeSpeed; $('#typeSpeedV').textContent=(+S.typeSpeed).toFixed(1)+'x';
  $('#timeToggle').classList.toggle('on',S.showTime); $('#timeToggle').textContent=S.showTime?'開':'關';
  $('#readToggle').classList.toggle('on',S.showRead); $('#readToggle').textContent=S.showRead?'開':'關';
  $('#startTime').value=S.startTime; $('#readCount').value=S.readCount;
  if(S.room.bg!=='color'||S.room.img) bgTouched=true;
  syncStyleInputs(); syncToggleRows();
}

// init
(async function init(){
  setSize(); buildFontSel(); buildSwatches();
  const data=loadJSON();
  if(data) await applyState(data); else seed();
  setSize(); syncStyleInputs(); syncUIFromState(); refreshRead();
  renderChars(); renderQuick(); renderMsgs(); updateDur();
  $('#fmtBadge').textContent=(window.MediaRecorder&&['video/mp4;codecs=avc1.42E01E','video/mp4'].some(f=>MediaRecorder.isTypeSupported(f)))?'MP4':'WebM';
  document.body.dataset.ui='std';
  await selectFont(S.fontKey);
  render(1);
  // 全域監聽：任何輸入 / 變更 / 點擊後延遲存檔;離開前再存一次
  document.addEventListener('input',scheduleSave,true);
  document.addEventListener('change',scheduleSave,true);
  document.addEventListener('click',scheduleSave,true);
  window.addEventListener('beforeunload',saveState);
  // 手動存檔 / 讀檔
  $('#saveBtn').addEventListener('click',downloadSave);
  $('#loadBtn').addEventListener('click',()=>$('#loadFile').click());
  $('#loadFile').addEventListener('change',e=>{ const f=e.target.files[0]; loadSaveFile(f); e.target.value=''; });
  // 使用說明改為導覽 tour（見 index.html 末尾 inline script，沿用 #helpBtn 與 'chat-seen-guide'）
})();
