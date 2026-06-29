"use strict";
let uid=1; const nid=()=>'i'+(uid++);

const FONTS={
  dot:{name:'點陣（熱感紙感）',fam:'"DotGothic16"'},
  mono:{name:'等寬 Mono',fam:"'Roboto Mono','Noto Sans TC'"},
  sans:{name:'黑體 Noto Sans',fam:'"Noto Sans TC"'},
  serif:{name:'宋體 Noto Serif',fam:'"Noto Serif TC"'},
};

const S={
  blocks:[],   // populated by applyDesign('tailor') on init
  items:[
    {id:nid(),name:'訂製兩件式西裝',qty:1,price:28000,desc:'Super 120s 羊毛 · 海軍藍 · 雙排釦',children:[
      {id:nid(),name:'含布料挑選與量身',price:''},
      {id:nid(),name:'含兩次修改',price:''},
      {id:nid(),name:'升級真絲內襯',price:1200},
    ]},
    {id:nid(),name:'訂製襯衫',qty:2,price:2200,desc:'埃及棉 · 白 · 標準領',children:[]},
    {id:nid(),name:'西裝褲改褲長',qty:1,price:300,desc:'',children:[]},
  ],
  fin:{ sym:'NT$', dec:0, taxPct:5, incl:true, svcPct:0, dtype:'amount', dval:0, method:'信用卡 VISA ****1234', paid:'' },
  type:{ scale:1, line:1, accent:'#111111' },
  sty:{ font:'dot', paperW:720, paper:'#ffffff', ink:'#111111', zig:true, divider:'dash', radius:0, texture:'', texHue:0, texBright:100, texContrast:140, texStrength:100 },
  bg:{ img:null, imgOrig:null, crop:null, mode:'none', pos:'center', opacity:15, size:40, effect:'none', paperAlpha:100, margin:80 },
  design:'tailor', fps:30, quality:1,
};
const SZmap={lg:37,md:26,sm:18,xs:16};

const cv=document.getElementById('cv'), ctx=cv.getContext('2d');

let fontReady=false;
async function loadFonts(){
  try{ await Promise.all(['"DotGothic16"','"Noto Sans TC"','"Noto Serif TC"',"'Roboto Mono'"].map(f=>document.fonts.load(`400 40px ${f}`,'字Aa1'))); await document.fonts.ready; }catch(e){}
  fontReady=true; render(1);
}

const $=s=>document.querySelector(s);
function fam(){ return FONTS[S.sty.font].fam; }
// 紙張紋理(textures/*.png),以效果融合
const TEX_LIST=['p0324','p0335','p0498','p0504','p0508','p0521','p0523','p0526','p0527'];
const texCache={};
function getTex(name){ if(!name)return null; if(texCache[name])return texCache[name]; const im=new Image(); im.onload=()=>render(1); im.src='textures/'+name+'.png'; texCache[name]=im; return im; }
function buildTexSel(){ const s=$('#s_texture'); if(!s)return; s.innerHTML='<option value="">無</option>'+TEX_LIST.map(t=>`<option value="${t}">${t}</option>`).join(''); s.value=S.sty.texture||''; }
function money(n){
  const d=S.fin.dec, neg=n<0; n=Math.abs(n);
  let s=(Math.round(n*Math.pow(10,d))/Math.pow(10,d)).toFixed(d);
  const [i,dec]=s.split('.'); const ii=i.replace(/\B(?=(\d{3})+(?!\d))/g,',');
  return (neg?'-':'')+S.fin.sym+' '+ii+(dec?'.'+dec:'');
}
function itemLine(it){ const ch=(it.children||[]).reduce((s,c)=>s+(+c.price||0),0); return (+it.qty||0)*((+it.price||0)+ch); }
function calc(){
  const sub=S.items.reduce((a,it)=>a+itemLine(it),0);
  const disc=S.fin.dtype==='pct'? sub*(+S.fin.dval||0)/100 : (+S.fin.dval||0);
  const svcChg=sub*(+S.fin.svcPct||0)/100;
  const base=sub-disc+svcChg;
  const taxPct=+S.fin.taxPct||0;
  const tax=S.fin.incl? base - base/(1+taxPct/100) : base*taxPct/100;
  const total=S.fin.incl? base : base+tax;
  const paid=S.fin.paid===''||S.fin.paid==null? null : +S.fin.paid;
  return {sub,disc,svcChg,tax,total,paid,change:paid==null?null:paid-total};
}

// ---- text helpers ----
function wrap(text,maxW,font){
  ctx.font=font; const lines=[];
  String(text).split('\n').forEach(p=>{
    if(p===''){lines.push('');return;}
    let line='';
    for(const ch of p){ if(ctx.measureText(line+ch).width<=maxW) line+=ch; else { if(line)lines.push(line); line=ch; } }
    if(line)lines.push(line);
  });
  return lines;
}

// ---- inline rich text: **bold** *italic* __underline__ ~~strike~~ ++big++ --small-- ----
function parseInline(str, st){
  st=st||{b:0,i:0,u:0,s:0,sz:1};
  const marks=[['**','b'],['__','u'],['~~','s'],['++','bz'],['--','sz'],['*','i']];
  let best=null;
  for(const [m,fx] of marks){ const o=str.indexOf(m); if(o<0)continue; const c=str.indexOf(m,o+m.length); if(c<0)continue; if(!best||o<best.o)best={m,fx,o,c}; }
  const out=[];
  if(!best){ if(str)out.push({text:str,st}); return out; }
  const before=str.slice(0,best.o), inner=str.slice(best.o+best.m.length,best.c), after=str.slice(best.c+best.m.length);
  const ist=Object.assign({},st);
  if(best.fx==='b')ist.b=1; else if(best.fx==='i')ist.i=1; else if(best.fx==='u')ist.u=1; else if(best.fx==='s')ist.s=1;
  else if(best.fx==='bz')ist.sz=(st.sz||1)*1.35; else if(best.fx==='sz')ist.sz=(st.sz||1)*0.78;
  if(before)out.push(...parseInline(before,st));
  out.push(...parseInline(inner,ist));
  if(after)out.push(...parseInline(after,st));
  return out;
}
function styledFont(st,baseFs,baseW){ const fs=Math.round(baseFs*(st.sz||1)); const w=st.b?900:(baseW||400); const it=st.i?'italic ':''; return {fs,font:`${it}${w} ${fs}px ${fam()}`}; }
function measureRich(text,maxW,baseFs,baseW){
  const segs=parseInline(String(text)); const atoms=[];
  segs.forEach(s=>{ const re=/\n|[^\S\n]+|\S+/g; let m; while((m=re.exec(s.text))) atoms.push({text:m[0],st:s.st}); });
  atoms.forEach(a=>{ const f=styledFont(a.st,baseFs,baseW); ctx.font=f.font; a.fs=f.fs; a.font=f.font; a.w=a.text==='\n'?0:ctx.measureText(a.text).width; });
  const lines=[]; let cur=[],curW=0;
  const push=()=>{ const w=cur.reduce((s,a)=>s+a.w,0); const fsMax=cur.reduce((m,a)=>Math.max(m,a.fs),baseFs); lines.push({atoms:cur.slice(),w,h:fsMax}); cur=[]; curW=0; };
  for(const a of atoms){
    if(a.text==='\n'){ push(); continue; }   // 明確換行:第二行、第三行…
    if(a.w>maxW){ for(const ch of a.text){ const f=styledFont(a.st,baseFs,baseW); ctx.font=f.font; const w=ctx.measureText(ch).width; if(curW+w>maxW&&cur.length)push(); cur.push({text:ch,st:a.st,fs:f.fs,font:f.font,w}); curW+=w; } continue; }
    if(curW+a.w>maxW&&cur.length){ push(); if(/^\s+$/.test(a.text))continue; }
    cur.push(a); curW+=a.w;
  }
  if(cur.length||!lines.length)push();
  const w=lines.reduce((m,l)=>Math.max(m,l.w),0);
  return {lines,w};
}
function richHeight(m,lineMul){ return m.lines.reduce((s,l)=>s+l.h*1.34*(lineMul||1),0); }
function drawRich(m,x,y,align,color,W,P,lineMul){
  ctx.fillStyle=color; let cy=y;
  m.lines.forEach(ln=>{
    let sx = align==='center'?(W-ln.w)/2 : align==='right'?(W-P-ln.w) : x;
    let ax=sx;
    ln.atoms.forEach(a=>{ ctx.font=a.font; ctx.textAlign='left'; ctx.textBaseline='top';
      ctx.fillText(a.text,ax,cy+(ln.h-a.fs));
      if(a.st.u) ctx.fillRect(ax,cy+ln.h*0.96,a.w,Math.max(1,a.fs*0.06));
      if(a.st.s) ctx.fillRect(ax,cy+ln.h*0.52,a.w,Math.max(1,a.fs*0.06));
      ax+=a.w; });
    cy+=ln.h*1.34*(lineMul||1);
  });
}
function build(W){
  const ink=S.sty.ink, P=Math.round(W*0.07), T=S.type, SC=T.scale, LN=T.line;
  const cw=W-P*2, F=fam();
  const blocks=[]; let H=P + (S.sty.zig?16:0);
  const push=(h,fn)=>{ blocks.push({y:H,h,fn}); H+=h; };
  const fsOf=v=>Math.round((SZmap[v]||23)*SC);
  const fs=Math.round(23*SC), big=fsOf('lg'), small=fsOf('sm'), tiny=fsOf('xs');

  const divider=(ds)=>{ const g=fs*1.4; const st=ds||S.sty.divider; push(g,(y)=>{ ctx.strokeStyle=ink; ctx.lineWidth=Math.max(1,W*0.003);
    if(st==='solid'){ ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(P,y+g/2); ctx.lineTo(W-P,y+g/2); ctx.stroke(); }
    else if(st==='double'){ ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(P,y+g/2-2); ctx.lineTo(W-P,y+g/2-2); ctx.moveTo(P,y+g/2+2); ctx.lineTo(W-P,y+g/2+2); ctx.stroke(); }
    else { ctx.setLineDash([W*0.018,W*0.012]); ctx.beginPath(); ctx.moveTo(P,y+g/2); ctx.lineTo(W-P,y+g/2); ctx.stroke(); ctx.setLineDash([]); } }); };
  const richBlk=(text,baseFs,baseW,align,color,gapAfter,alpha)=>{ const m=measureRich(text,cw,baseFs,baseW); const h=richHeight(m,LN)+(gapAfter||0);
    push(h,(y)=>{ if(alpha!=null)ctx.globalAlpha=alpha; drawRich(m,P,y,align,color,W,P,LN); if(alpha!=null)ctx.globalAlpha=1; }); };

  const drawImageB=(b)=>{ if(!b.img)return; const im=b.img, lw=Math.min(cw, W*(b.scale||0.42)), lh=lw*im.height/im.width;
    push(lh+fs*0.4,(y)=>{ const hue=+b.hue||0; if(hue){ ctx.save(); ctx.filter=`hue-rotate(${hue}deg)`; ctx.drawImage(im,(W-lw)/2,y,lw,lh); ctx.restore(); } else ctx.drawImage(im,(W-lw)/2,y,lw,lh); }); };
  const drawFieldsB=(b)=>{ (b.rows||[]).forEach(r=>{ const v=r.value||''; if(!(r.label&&r.label.trim())&&!(v&&v.trim()))return;
    const g=small*1.7*LN; push(g,(y)=>{ ctx.fillStyle=ink; ctx.font=`400 ${small}px ${F}`; ctx.textBaseline='middle'; ctx.textAlign='left'; ctx.fillText(r.label||'',P,y+g/2); ctx.textAlign='right'; ctx.fillText(v,W-P,y+g/2); }); }); };
  const drawItemsB=()=>{ S.items.forEach(it=>{
    const qty=+it.qty||0, price=+it.price||0, amtStr=money(itemLine(it));
    ctx.font=`500 ${fs}px ${F}`; const amtW=ctx.measureText(amtStr).width;
    const m=measureRich(it.name||'（未命名）', cw-amtW-W*0.03, fs, 700); const rowH=richHeight(m,LN)+fs*0.45;
    push(rowH,(y)=>{ drawRich(m,P,y,'left',ink,W,P,LN); ctx.fillStyle=ink; ctx.font=`500 ${fs}px ${F}`; ctx.textAlign='right'; ctx.textBaseline='top'; ctx.fillText(amtStr,W-P,y); });
    push(small*1.5*LN,(y)=>{ ctx.fillStyle=ink; ctx.globalAlpha=.72; ctx.font=`400 ${small}px ${F}`; ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillText('   '+qty+' × '+money(price),P,y+small*0.75); ctx.globalAlpha=1; });
    (it.children||[]).forEach(c=>{ if(!(c.name&&c.name.trim())&&!(+c.price))return; const cp=+c.price||0, g=tiny*1.6*LN;
      push(g,(y)=>{ ctx.fillStyle=ink; ctx.globalAlpha=.78; ctx.font=`400 ${tiny}px ${F}`; ctx.textBaseline='middle'; ctx.textAlign='left'; ctx.fillText('   └ '+(c.name||''),P,y+g/2); if(cp){ ctx.textAlign='right'; ctx.fillText('+'+money(cp),W-P,y+g/2); } ctx.globalAlpha=1; }); });
    if(it.desc){ const dm=measureRich('   '+it.desc, cw-W*0.04, tiny, 400); push(richHeight(dm,LN)+tiny*0.4,(y)=>{ ctx.globalAlpha=.62; drawRich(dm,P,y,'left',ink,W,P,LN); ctx.globalAlpha=1; }); }
    push(fs*0.3,()=>{});
  }); };
  const drawTotalsB=()=>{ const c=calc();
    const row=(k,v,opt={})=>{ const sz=opt.big?Math.round(fs*1.25):fs; const w=opt.big?'700':'400'; const g=sz*1.7*LN; const col=ink;
      push(g,(y)=>{ ctx.fillStyle=col; ctx.font=`${w} ${sz}px ${F}`; ctx.textBaseline='middle'; ctx.textAlign='left'; ctx.fillText(k,P,y+g/2); ctx.textAlign='right'; ctx.fillText(v,W-P,y+g/2); }); };
    row('小計', money(c.sub));
    if(c.disc>0) row('折扣', '-'+money(c.disc).replace('-',''));
    if(c.svcChg>0) row('服務費 '+S.fin.svcPct+'%', money(c.svcChg));
    if((+S.fin.taxPct||0)>0) row(S.fin.incl?('內含稅 '+S.fin.taxPct+'%'):('稅金 '+S.fin.taxPct+'%'), money(c.tax));
    push(fs*0.3,()=>{}); row('合計 TOTAL', money(c.total), {big:true});
    if(S.fin.method){ push(fs*0.2,()=>{}); row('付款', S.fin.method); }
    if(c.paid!=null){ row('實收', money(c.paid)); row('找零', money(c.change)); } };
  const drawBarcodeB=(b)=>{ const bh=W*0.085; push(bh+tiny*2+fs*0.4,(y)=>{ y+=fs*0.4; drawBarcode(P+cw*0.1,y,cw*0.8,bh,b); ctx.fillStyle=ink; ctx.font=`400 ${tiny}px ${F}`; ctx.textAlign='center'; ctx.textBaseline='top'; ctx.fillText(barNum(b),W/2,y+bh+tiny*0.4); }); };
  const drawQRB=(b)=>{ if(!b.url)return; const qs=Math.round(W*0.34), pad=qs*0.08;
    push(qs+pad*2+fs*0.4+(b.label?tiny*1.8:0),(y)=>{ y+=fs*0.4; const qx=(W-qs)/2; drawQR(b.url,qx,y,qs,pad,b.color||'#111111',b.bg||'#ffffff');
      if(b.label){ ctx.fillStyle=ink; ctx.globalAlpha=.8; ctx.font=`400 ${tiny}px ${F}`; ctx.textAlign='center'; ctx.textBaseline='top'; ctx.fillText(b.label,W/2,y+qs+pad*2+tiny*0.2); ctx.globalAlpha=1; } }); };

  const drawNoteB=(b)=>{ const t=(b.text||'').trim(); if(!t)return;
    push(small*1.5,(y)=>{ ctx.fillStyle=ink; ctx.globalAlpha=.8; ctx.font=`700 ${small}px ${F}`; ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillText('備註',P,y+small*0.75); ctx.globalAlpha=1; });
    const m=measureRich(t,cw,small,400); push(richHeight(m,LN)+small*0.4,(y)=>{ ctx.globalAlpha=.78; drawRich(m,P,y,'left',ink,W,P,LN); ctx.globalAlpha=1; });
  };
  const spaceMap={sm:fs*0.5, md:fs*1.1, lg:fs*2.1};
  S.blocks.forEach(b=>{
    switch(b.type){
      case 'image': drawImageB(b); break;
      case 'text': {
        if(b.mode==='fields'){ drawFieldsB(b); }
        else { const sz=fsOf(b.size||'md'); richBlk(b.text||'', sz, b.weight||400, b.align||'center', ink, sz*0.45, b.alpha!=null?b.alpha:1); }
      } break;
      case 'divider': divider(b.dstyle); break;
      case 'space': push(spaceMap[b.size||'md'],()=>{}); break;
      case 'items': drawItemsB(); break;
      case 'totals': drawTotalsB(); break;
      case 'note': drawNoteB(b); break;
      case 'barcode': drawBarcodeB(b); break;
      case 'qr': drawQRB(b); break;
    }
  });
  return {blocks, H:H+P+(S.sty.zig?16:0)};
}

function allFieldRows(){ const out=[]; S.blocks.forEach(b=>{ if(b.type==='fields'||(b.type==='text'&&b.mode==='fields')) (b.rows||[]).forEach(r=>out.push(r)); }); return out; }
function barSrc(b){ if(b&&b.src==='custom') return ((b.num||'').trim())||'0000'; const rows=allFieldRows(); const f=rows.find(r=>/單|no\.?/i.test(r.label||'')); return (f?f.value:(rows[0]&&rows[0].value))||'0000'; }
function barNum(b){ return barSrc(b).replace(/\D/g,'').padEnd(12,'0').slice(0,12).replace(/(\d{4})(\d{4})(\d{4})/,'$1 $2 $3'); }
function drawBarcode(x,y,w,h,b){
  let r=0; for(const ch of (barSrc(b)||'x')) r=(r*31+ch.charCodeAt(0))%99991; r=r||12345;
  const rnd=()=>{ r=(r*9301+49297)%233280; return r/233280; };
  ctx.fillStyle=S.sty.ink; let cx=x;
  while(cx<x+w){ const bw=1+Math.floor(rnd()*4); if(rnd()>0.42) ctx.fillRect(Math.round(cx),y,bw,h); cx+=bw+Math.max(1,Math.floor(rnd()*2)); }
}
function fmtNow(){ const d=new Date(); const p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}/${p(d.getMonth()+1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; }

function drawQR(url,x,y,size,pad,fg,bg){
  let qr; try{ qr=qrcode(0,'M'); qr.addData(String(url)); qr.make(); }catch(e){ return; }
  const n=qr.getModuleCount();
  ctx.fillStyle=bg||'#ffffff'; ctx.fillRect(x-pad,y,size+pad*2,size+pad*2);
  const cell=size/n; ctx.fillStyle=fg||'#111111';
  for(let r=0;r<n;r++) for(let cc=0;cc<n;cc++) if(qr.isDark(r,cc)) ctx.fillRect(Math.floor(x+cc*cell),Math.floor(y+pad+r*cell),Math.ceil(cell),Math.ceil(cell));
}

function loadImg(file,cb){
  if(!file) return;
  const r=new FileReader();
  r.onerror=()=>alert('圖片讀取失敗，請換一張試試。');
  r.onload=()=>{ const im=new Image();
    im.onerror=()=>alert('這張圖片無法載入（HEIC 等格式不支援），請改用 JPG / PNG。');
    im.onload=()=>{ const MAX=1400, long=Math.max(im.width,im.height);
      if(long<=MAX){ cb(im); return; }
      try{ const k=MAX/long, oc=document.createElement('canvas'); oc.width=Math.round(im.width*k); oc.height=Math.round(im.height*k);
        oc.getContext('2d').drawImage(im,0,0,oc.width,oc.height); const out=new Image(); out.onload=()=>cb(out); out.src=oc.toDataURL('image/png'); }
      catch(err){ cb(im); } };
    im.src=r.result; };
  r.readAsDataURL(file);
}

// ---- render ----
function paperPath(W,H,zz,r){
  const a=zz?14:0, t=Math.max(12,W*0.02);
  r=zz?0:Math.min(r||0, W/2, H/2);
  ctx.beginPath();
  if(zz){
    ctx.moveTo(0,a); for(let x=0;x<W;x+=t){ ctx.lineTo(x+t/2,0); ctx.lineTo(x+t,a); } ctx.lineTo(W,a);
    ctx.lineTo(W,H-a);
    for(let x=W;x>0;x-=t){ ctx.lineTo(x-t/2,H); ctx.lineTo(x-t,H-a); } ctx.lineTo(0,H-a);
    ctx.closePath(); return;
  }
  // 圓角矩形(r=0 即直角)
  ctx.moveTo(r,0);
  ctx.arcTo(W,0,W,H,r);
  ctx.arcTo(W,H,0,H,r);
  ctx.arcTo(0,H,0,0,r);
  ctx.arcTo(0,0,W,0,r);
  ctx.closePath();
}
let lastH=0;
// 背景圖以 cover 方式填滿 (x,y,w,h),垂直依 S.bg.pos 對齊
function drawBgImage(x,y,w,h){
  const im=S.bg.img; if(!im) return;
  const s=Math.max(w/im.width,h/im.height), dw=im.width*s, dh=im.height*s;
  const dx=x+(w-dw)/2;
  const dy = S.bg.pos==='top'? y : S.bg.pos==='bottom'? y+(h-dh) : y+(h-dh)/2;
  ctx.drawImage(im,dx,dy,dw,dh);
}
// 紙張底:無效果=純色;霧面/液態玻璃=模糊背景 + 染色 + 高光(近似 liquid glass)
function drawPaperBase(W,paperH,margin,useBack){
  const eff=S.bg.effect||'none', pa=(S.bg.paperAlpha==null?100:S.bg.paperAlpha)/100;
  // 玻璃折射底(只有在「紙張不透明度」< 100% 時才透出)
  if(eff!=='none' && useBack && S.bg.img){
    ctx.save();
    if(eff==='liquid'){
      // 真實波動折射:canvas ctx.filter 引用 SVG feDisplacementMap
      ctx.filter='url(#rcLiquid)';
      const k=1.12; drawBgImage(-margin-W*(k-1)/2, -margin-paperH*(k-1)/2, cv.width*k, cv.height*k);
    } else {
      ctx.filter='blur('+(W*0.02)+'px)';
      drawBgImage(-margin,-margin,cv.width,cv.height);
    }
    ctx.restore();
  }
  // 紙張色:不透明度 = pa(100% 完全蓋住背景、看不到底圖)
  ctx.globalAlpha=pa; ctx.fillStyle=S.sty.paper; ctx.fillRect(0,0,W,paperH); ctx.globalAlpha=1;
  // 紙張紋理:以相乘融合(預設黑白,可調色相/明度/對比)
  if(S.sty.texture){ const im=getTex(S.sty.texture);
    if(im && im.complete && im.naturalWidth){
      const hue=+S.sty.texHue||0, b=(+S.sty.texBright||100)/100, c=(+S.sty.texContrast||100)/100;
      ctx.save(); ctx.globalCompositeOperation='multiply'; ctx.globalAlpha=(S.sty.texStrength==null?100:S.sty.texStrength)/100;
      ctx.filter=(hue>0? 'sepia(1) saturate(2) hue-rotate('+hue+'deg)' : 'grayscale(1)')+' brightness('+b+') contrast('+c+')';
      const s=Math.max(W/im.naturalWidth, paperH/im.naturalHeight), dw=im.naturalWidth*s, dh=im.naturalHeight*s;
      ctx.drawImage(im,(W-dw)/2,(paperH-dh)/2,dw,dh); ctx.restore();
    }
  }
  if(eff==='none') return;
  // 柔和高光
  if(eff==='frost'){
    const g=ctx.createLinearGradient(0,0,0,paperH*0.45);
    g.addColorStop(0,'rgba(255,255,255,0.16)'); g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,paperH*0.45);
  } else {
    // 液態:左上柔和反光斑(克制,折射感交給位移)
    const r=ctx.createRadialGradient(W*0.26,paperH*0.04,0,W*0.26,paperH*0.04,W*0.62);
    r.addColorStop(0,'rgba(255,255,255,0.20)'); r.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=r; ctx.fillRect(0,0,W,paperH*0.55);
  }
}
// 匯出畫質倍率:只在匯出時把 W / margin 整體放大(render 全程以 W 為基準等比縮放,故直接生效)
let exportScale=1;
function render(progress=1){
  const W=Math.round(S.sty.paperW*exportScale);
  const {blocks,H}=build(W);
  const paperH=Math.ceil(H); lastH=H;
  const useBack = S.bg.img && S.bg.mode==='back';
  const margin = Math.round((useBack? (S.bg.margin==null?80:S.bg.margin) : 0) * exportScale);
  const eff=S.bg.effect||'none';
  const cw=W+margin*2, chh=paperH+margin*2;
  if(cv.width!==cw||cv.height!==chh){ cv.width=cw; cv.height=chh; }
  ctx.clearRect(0,0,cv.width,cv.height);
  // 底圖:鋪滿整張畫布,收據紙張疊在上面
  if(useBack) drawBgImage(0,0,cv.width,cv.height);
  ctx.save(); ctx.translate(margin,margin);
  // paper
  ctx.save(); paperPath(W,paperH,S.sty.zig,S.sty.radius); ctx.clip();
  drawPaperBase(W,paperH,margin,useBack);
  // 浮水印:可調大小、自動重複鋪滿整張收據、文字下方
  if(S.bg.img && S.bg.mode==='water'){
    ctx.save(); ctx.globalAlpha=(S.bg.opacity||15)/100;
    const im=S.bg.img, tw=Math.max(24, W*(S.bg.size||40)/100), th=tw*im.height/im.width;
    for(let yy=0; yy<paperH; yy+=th) for(let xx=0; xx<W; xx+=tw) ctx.drawImage(im,xx,yy,tw,th);
    ctx.restore();
  }
  // print reveal
  const revealH=paperH*progress;
  ctx.save(); ctx.beginPath(); ctx.rect(0,0,W,revealH); ctx.clip();
  blocks.forEach(b=>{ b.fn(b.y); });
  ctx.restore();
  ctx.restore();
  // 液態玻璃:邊緣反光
  if(eff==='liquid'){
    paperPath(W,paperH,S.sty.zig,S.sty.radius);
    const eg=ctx.createLinearGradient(0,0,W,paperH);
    eg.addColorStop(0,'rgba(255,255,255,0.55)'); eg.addColorStop(0.5,'rgba(255,255,255,0.06)'); eg.addColorStop(1,'rgba(255,255,255,0.4)');
    ctx.strokeStyle=eg; ctx.lineWidth=Math.max(1.5,W*0.004); ctx.stroke();
  }
  ctx.restore();
  const tb=$('#totalBadge'); if(tb){ const c=calc(); tb.textContent='合計 '+money(c.total); }
  // 目前輸出版面尺寸(含畫質倍率;預覽時 exportScale=1,顯示套用倍率後的實際輸出像素)
  const _oW=Math.round(cv.width/exportScale*S.quality), _oH=Math.round(cv.height/exportScale*S.quality);
  $('#sizeNote').textContent='輸出尺寸 '+_oW+' × '+_oH+' px';
  const _qn=$('#qualNote'); if(_qn) _qn.textContent='實際輸出 '+_oW+' × '+_oH+' px';
  applyZoom();
  if(!_noSave && !previewing) scheduleSave();
}

// ---- animation / export ----
let playing=false;
function runAnim(){ return new Promise(res=>{ playing=true; const dur=1.6,t0=performance.now();
  (function step(now){ const p=Math.min(1,(now-t0)/(dur*1000)); render(p); if(p<1&&playing)requestAnimationFrame(step); else{playing=false;res();} })(performance.now()); }); }
function dl(blob,e){ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='receipt_'+Date.now()+'.'+e; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),2000); }
function exportPNG(){ exportScale=S.quality; render(1); cv.toBlob(b=>{ dl(b,'png'); exportScale=1; render(1); },'image/png'); }
async function exportMP4(){
  if(playing) return;
  const fmts=['video/mp4;codecs=avc1.42E01E','video/mp4','video/webm;codecs=vp9','video/webm'];
  const mt=fmts.find(f=>window.MediaRecorder&&MediaRecorder.isTypeSupported(f))||''; const isMp4=mt.startsWith('video/mp4');
  exportScale=S.quality; render(1);
  const stream=cv.captureStream(S.fps); const rec=new MediaRecorder(stream,mt?{mimeType:mt,videoBitsPerSecond:8000000}:{});
  const chunks=[]; rec.ondataavailable=e=>{ if(e.data&&e.data.size)chunks.push(e.data); }; const stopped=new Promise(r=>rec.onstop=r);
  const lbl=$('#mp4Label'); lbl.textContent='錄製中…';
  rec.start(); render(0); await new Promise(r=>setTimeout(r,120)); await runAnim(); await new Promise(r=>setTimeout(r,400));
  rec.stop(); await stopped; exportScale=1; render(1); dl(new Blob(chunks,{type:isMp4?'video/mp4':'video/webm'}), isMp4?'mp4':'webm');
  lbl.textContent='輸出 MP4';
  $('#exportHint').textContent= isMp4?'已輸出 MP4。':'此瀏覽器不支援 MP4，已輸出 WebM（建議 Chrome / Edge）。';
}

// ============ UI ============
document.addEventListener('click',e=>{ const ph=e.target.closest('.panel > .ph'); if(!ph)return; const p=ph.parentElement; p.dataset.c=p.dataset.c==='1'?'0':'1'; });
document.querySelectorAll('.collapse').forEach(b=>b.onclick=()=>{ const sec=b.closest('.side'); sec.classList.toggle('collapsed'); const cl=sec.classList.contains('collapsed'),left=sec.classList.contains('left'); b.textContent=left?(cl?'▶':'◀'):(cl?'◀':'▶'); });
function segPick(seg,val,cb){ seg.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.v===val)); cb&&cb(val); }
const UI_KEY='receipt-ui-scale';
$('#uiSeg').onclick=e=>{ const b=e.target.closest('button'); if(!b)return; segPick($('#uiSeg'),b.dataset.v,v=>{ document.body.dataset.ui=v; localStorage.setItem(UI_KEY,v); }); };
$('#qualSeg').onclick=e=>{ const b=e.target.closest('button'); if(!b)return; S.quality=+b.dataset.v; segPick($('#qualSeg'),b.dataset.v); render(1); };

const bind=(id,fn)=>{ const el=$(id); if(el) el.addEventListener('input',()=>{ fn(el); render(1); }); };
// finance / payment
bind('#f_sym',el=>S.fin.sym=el.value); bind('#f_dec',el=>S.fin.dec=+el.value); bind('#f_tax',el=>S.fin.taxPct=+el.value); bind('#f_svc',el=>S.fin.svcPct=+el.value);
$('#f_incl').addEventListener('change',e=>{ S.fin.incl=e.target.checked; render(1); });
bind('#f_dtype',el=>S.fin.dtype=el.value); bind('#f_dval',el=>S.fin.dval=+el.value);
bind('#p_method',el=>S.fin.method=el.value); bind('#p_paid',el=>S.fin.paid=el.value);
// appearance
bind('#s_pw',el=>{ S.sty.paperW=+el.value; $('#s_pwV').textContent=el.value; });
bind('#s_paper',el=>S.sty.paper=el.value); bind('#s_ink',el=>S.sty.ink=el.value);
$('#s_font').onchange=e=>{ S.sty.font=e.target.value; render(1); };
bind('#s_radius',el=>{ S.sty.radius=+el.value; $('#s_radiusV').textContent=el.value; });
$('#s_texture').onchange=e=>{ S.sty.texture=e.target.value; $('#texAdjust').classList.toggle('hidden', !S.sty.texture); render(1); };
// 紋理欄位:左右鍵 / 滾輪切換,點中間開下拉
(function(){ const wrap=$('#texPick'); if(!wrap)return;
  function step(d){ const s=$('#s_texture'); const n=s.options.length; if(!n)return; s.selectedIndex=(s.selectedIndex+d+n)%n; s.dispatchEvent(new Event('change')); }
  wrap.querySelectorAll('[data-tex]').forEach(b=>b.onclick=()=>step(+b.dataset.tex));
  wrap.addEventListener('wheel',e=>{ e.preventDefault(); step(e.deltaY>0?1:-1); },{passive:false});
})();
bind('#s_texStrength',el=>{ S.sty.texStrength=+el.value; $('#s_texStrengthV').textContent=el.value+'%'; });
bind('#s_texHue',el=>{ S.sty.texHue=+el.value; $('#s_texHueV').textContent=el.value==='0'?'黑白':el.value+'°'; });
bind('#s_texBright',el=>{ S.sty.texBright=+el.value; $('#s_texBrightV').textContent=el.value+'%'; });
bind('#s_texContrast',el=>{ S.sty.texContrast=+el.value; $('#s_texContrastV').textContent=el.value+'%'; });
$('#s_zig').addEventListener('change',e=>{ S.sty.zig=e.target.checked; render(1); });
// background image
function bgSyncRows(){ const w=S.bg.mode==='water'; $('#bgSizeRow').classList.toggle('hidden',!w); $('#bgOpacityRow').classList.toggle('hidden',!w); $('#bgMarginRow').classList.toggle('hidden', S.bg.mode!=='back'); }
$('#bgUpload').onclick=()=>pickImage(im=>{ S.bg.imgOrig=im; S.bg.crop=null; S.bg.img=im; if(S.bg.mode==='none'){ S.bg.mode='water'; segPick($('#bgModeSeg'),'water'); } bgSyncRows(); bgEditState(); render(1); openBgCropper(); });
$('#bgEdit').onclick=()=>openBgCropper();
$('#bgRemove').onclick=()=>{ S.bg.img=null; S.bg.imgOrig=null; S.bg.crop=null; bgEditState(); render(1); };
function bgEditState(){ const b=$('#bgEdit'); if(b) b.disabled=!S.bg.imgOrig; }
$('#bgModeSeg').onclick=e=>{ const b=e.target.closest('button'); if(!b)return; S.bg.mode=b.dataset.v; segPick($('#bgModeSeg'),b.dataset.v); bgSyncRows(); render(1); };
bind('#bgOpacity',el=>{ S.bg.opacity=+el.value; $('#bgOpacityV').textContent=el.value+'%'; });
bind('#bgSize',el=>{ S.bg.size=+el.value; $('#bgSizeV').textContent=el.value+'%'; });
bind('#bgMargin',el=>{ S.bg.margin=+el.value; $('#bgMarginV').textContent=el.value; });
$('#bgEffectSeg').onclick=e=>{ const b=e.target.closest('button'); if(!b)return; S.bg.effect=b.dataset.v; segPick($('#bgEffectSeg'),b.dataset.v);
  if(b.dataset.v!=='none' && (S.bg.paperAlpha==null||S.bg.paperAlpha>=100)){ S.bg.paperAlpha=b.dataset.v==='liquid'?58:72; $('#bgPaperAlpha').value=S.bg.paperAlpha; $('#bgPaperAlphaV').textContent=S.bg.paperAlpha+'%'; }
  render(1); };
bind('#bgPaperAlpha',el=>{ S.bg.paperAlpha=+el.value; $('#bgPaperAlphaV').textContent=el.value+'%'; });
// typography
bind('#t_scale',el=>{ S.type.scale=+el.value; $('#t_scaleV').textContent=Math.round(el.value*100)+'%'; });
bind('#t_line',el=>{ S.type.line=+el.value; $('#t_lineV').textContent=(+el.value).toFixed(2); });
let selectedPreset='tailor', previewing=false, workBackup=null;
// 點預設模板=即時預覽(不覆蓋);按「套用」才真正覆蓋;切回「設計編輯」回到自己的設計
$('#designSeg').onclick=e=>{ const b=e.target.closest('button'); if(!b)return; previewPreset(b.dataset.v); };
$('#applyTpl').onclick=()=>commitPreset();
function previewPreset(key){
  selectedPreset=key; segPick($('#designSeg'),key);
  if(!previewing){ workBackup=serializeDesign(); previewing=true; }
  applyDesign(key);
  const el=$('#saveStatus'); if(el){ el.textContent='👁 預覽中(未套用)'; el.classList.add('dirty'); }
}
function commitPreset(){
  if(previewing){ previewing=false; workBackup=null; }
  else applyDesign(selectedPreset);
  scheduleSave();
}
function exitPreview(){
  if(!previewing) return;
  previewing=false; const b=workBackup; workBackup=null;
  if(b) applyDesignData(b); else render(1);
}
$('#playBtn').onclick=()=>{ if(!playing)runAnim(); };
// 預覽縮放:直接以「符合視窗 × 縮放」設定 canvas 顯示尺寸(可捲動)
let pvZoom=1;
function applyZoom(){
  const stage=cv.parentElement; if(!stage||!stage.clientWidth||!stage.clientHeight) return;
  const availW=Math.max(40,stage.clientWidth-28), availH=Math.max(40,stage.clientHeight-28);
  const fit=Math.min(availW/cv.width, availH/cv.height)||1, sc=fit*pvZoom;
  cv.style.maxWidth='none'; cv.style.maxHeight='none';
  cv.style.width=(cv.width*sc)+'px'; cv.style.height=(cv.height*sc)+'px';
  const zv=$('#zoomVal'); if(zv) zv.textContent=Math.round(pvZoom*100)+'%';
}
function setZoom(z){ pvZoom=Math.min(4,Math.max(0.3,Math.round(z*100)/100)); applyZoom(); }
$('#zoomSeg').onclick=e=>{ const b=e.target.closest('button'); if(!b)return;
  if(b.dataset.z==='fit')setZoom(1); else if(b.dataset.z==='in')setZoom(pvZoom+0.2); else setZoom(pvZoom-0.2); };
cv.parentElement.addEventListener('wheel',e=>{ e.preventDefault(); setZoom(pvZoom+(e.deltaY<0?0.12:-0.12)); },{passive:false});
window.addEventListener('resize',applyZoom);
$('#pngBtn').onclick=exportPNG; $('#mp4Btn').onclick=exportMP4;
$('#addItem').onclick=()=>{ S.items.push({id:nid(),name:'新品項',qty:1,price:0,desc:'',children:[]}); renderItems(); render(1); };
// add-block menu
$('#addBlockBtn').onclick=()=>$('#addMenu').classList.toggle('hidden');
document.addEventListener('click',e=>{ if(!e.target.closest('.addwrap')) $('#addMenu').classList.add('hidden'); });

// ---- 純文字 ⇄ 區塊 雙向轉換 ----
function serializeBlocks(){
  const lines=[];
  S.blocks.forEach(b=>{
    if(b.type==='text'){
      if(b.mode==='fields'){
        lines.push('[欄位]');
        (b.rows||[]).forEach(r=>lines.push((r.label||'')+': '+(r.value||'')));
        lines.push('[/欄位]');
      } else {
        const sz=b.size||'md', al=b.align==='left'?'<':b.align==='right'?'>':'';
        if(sz==='md'){ lines.push((al?al+' ':'')+(b.text||'')); }
        else { const mk=sz==='lg'?'#':sz==='sm'?'##':'###'; lines.push(mk+al+' '+(b.text||'')); }
      }
    }
    else if(b.type==='divider') lines.push(b.dstyle==='solid'?'-':b.dstyle==='double'?'--':'---');
    else if(b.type==='space') lines.push(b.size==='sm'?'[間距:小]':b.size==='lg'?'[間距:大]':'[間距]');
    else if(b.type==='image') lines.push('[圖片]');
    else if(b.type==='items') lines.push('[品項]');
    else if(b.type==='totals') lines.push('[金額]');
    else if(b.type==='note') lines.push('[備註] '+((b.text||'').replace(/\n/g,' ')));
    else if(b.type==='barcode') lines.push(b.src==='custom'&&b.num?('[條碼:'+b.num+']'):'[條碼]');
    else if(b.type==='qr') lines.push('[QR:'+(b.url||'')+(b.label?('|'+b.label):'')+']');
  });
  return lines.join('\n');
}
function parseSource(text){
  const prevImgs=S.blocks.filter(b=>b.type==='image'), prevQrs=S.blocks.filter(b=>b.type==='qr');
  let iImg=0,iQr=0; const out=[], lines=String(text).split('\n'); let i=0,m;
  while(i<lines.length){
    const raw=lines[i], t=raw.trim(); i++;
    if(t===''){ out.push({id:nid(),type:'space',size:'md'}); continue; }
    if(t==='[品項]'){ out.push({id:nid(),type:'items'}); continue; }
    if(t==='[金額]'||t==='[金額小計]'){ out.push({id:nid(),type:'totals'}); continue; }
    if((m=t.match(/^\[備註\]\s?(.*)$/))){ out.push({id:nid(),type:'note',text:m[1]||''}); continue; }
    if(t==='[圖片]'){ const p=prevImgs[iImg++]; out.push(p?Object.assign({},p,{id:nid()}):{id:nid(),type:'image',img:null,scale:0.42,hue:0}); continue; }
    if(t==='[間距]'){ out.push({id:nid(),type:'space',size:'md'}); continue; }
    if((m=t.match(/^\[間距:(小|中|大)\]$/))){ out.push({id:nid(),type:'space',size:m[1]==='小'?'sm':m[1]==='大'?'lg':'md'}); continue; }
    if(t==='[條碼]'){ out.push({id:nid(),type:'barcode',src:'auto',num:''}); continue; }
    if((m=t.match(/^\[條碼:(.+)\]$/))){ out.push({id:nid(),type:'barcode',src:'custom',num:m[1].trim()}); continue; }
    if((m=t.match(/^\[QR:([^\]]*)\]$/))){ const p=prevQrs[iQr++], parts=m[1].split('|'); out.push({id:nid(),type:'qr',url:(parts[0]||'').trim(),label:(parts[1]||'').trim(),color:p?p.color:'#111111',bg:p?p.bg:'#ffffff'}); continue; }
    if(t==='[欄位]'){ const rows=[]; while(i<lines.length && lines[i].trim()!=='[/欄位]'){ const ln=lines[i]; i++; const idx=ln.search(/[:：]/); rows.push(idx>=0?{id:nid(),label:ln.slice(0,idx).trim(),value:ln.slice(idx+1).trim()}:{id:nid(),label:ln.trim(),value:''}); } if(i<lines.length)i++; out.push({id:nid(),type:'text',mode:'fields',rows:rows.length?rows:[{id:nid(),label:'',value:''}]}); continue; }
    if(t==='-'){ out.push({id:nid(),type:'divider',dstyle:'solid'}); continue; }
    if(t==='--'){ out.push({id:nid(),type:'divider',dstyle:'double'}); continue; }
    if(t==='---'){ out.push({id:nid(),type:'divider',dstyle:'dash'}); continue; }
    if((m=t.match(/^(#{1,3})([<>]?)\s*(.*)$/))){
      const lvl=m[1].length, size=lvl===1?'lg':lvl===2?'sm':'xs', weight=lvl===3?400:700,
        align=m[2]==='<'?'left':m[2]==='>'?'right':'center';
      out.push({id:nid(),type:'text',mode:'para',text:m[3],size,align,weight,alpha:lvl===3?0.8:1}); continue;
    }
    if((m=raw.match(/^([<>])\s+(.*)$/))){ out.push({id:nid(),type:'text',mode:'para',text:m[2],size:'md',align:m[1]==='<'?'left':'right',weight:400,alpha:1}); continue; }
    out.push({id:nid(),type:'text',mode:'para',text:raw,size:'md',align:'center',weight:400,alpha:1});
  }
  return out;
}
let blkMode='blocks';
function setBlkMode(mode){
  if(mode===blkMode) return;
  if(mode==='text'){ $('#blockSource').value=serializeBlocks(); }
  else { S.blocks=parseSource($('#blockSource').value); renderBlocks(); render(1); }
  blkMode=mode; segPick($('#blkModeSeg'),mode);
  $('#blockEditWrap').classList.toggle('hidden', mode!=='blocks');
  $('#blockSourceWrap').classList.toggle('hidden', mode!=='text');
}
$('#blkModeSeg').onclick=e=>{ const b=e.target.closest('button'); if(b) setBlkMode(b.dataset.v); };
$('#blockSource').addEventListener('input',()=>{ S.blocks=parseSource($('#blockSource').value); render(1); });
// resizable blocks column
(function(){ const col=$('#colBlocks'), rz=$('#blkResizer'); if(!col||!rz)return; let sx,sw,drag=false;
  rz.addEventListener('pointerdown',e=>{ drag=true; sx=e.clientX; sw=col.getBoundingClientRect().width; rz.classList.add('active'); document.body.style.userSelect='none'; try{rz.setPointerCapture(e.pointerId);}catch(_){}; e.preventDefault(); });
  window.addEventListener('pointermove',e=>{ if(!drag)return; let w=sw+(sx-e.clientX); w=Math.max(280,Math.min(640,Math.round(w))); col.style.width=w+'px'; });
  window.addEventListener('pointerup',()=>{ if(drag){ drag=false; rz.classList.remove('active'); document.body.style.userSelect=''; } });
})();
(function(){ const col=$('#colOutput'), rz=$('#outResizer'); if(!col||!rz)return; let sx,sw,drag=false;
  rz.addEventListener('pointerdown',e=>{ drag=true; sx=e.clientX; sw=col.getBoundingClientRect().width; rz.classList.add('active'); document.body.style.userSelect='none'; try{rz.setPointerCapture(e.pointerId);}catch(_){}; e.preventDefault(); });
  window.addEventListener('pointermove',e=>{ if(!drag)return; let w=sw+(sx-e.clientX); w=Math.max(210,Math.min(420,Math.round(w))); col.style.width=w+'px'; });
  window.addEventListener('pointerup',()=>{ if(drag){ drag=false; rz.classList.remove('active'); document.body.style.userSelect=''; } });
})();
function newBlock(type){
  switch(type){
    case 'text': return {id:nid(),type:'text',mode:'para',text:'文字',size:'md',align:'center',weight:400,alpha:1,rows:[{id:nid(),label:'欄位',value:''}]};
    case 'divider': return {id:nid(),type:'divider',dstyle:''};
    case 'space': return {id:nid(),type:'space',size:'md'};
    case 'image': return {id:nid(),type:'image',img:null,scale:0.42,hue:0};
    case 'note': return {id:nid(),type:'note',text:''};
    case 'barcode': return {id:nid(),type:'barcode',src:'auto',num:''};
    case 'qr': return {id:nid(),type:'qr',url:'https://',label:'',color:'#111111',bg:'#ffffff'};
    default: return {id:nid(),type};   // items/totals
  }
}
function addBlock(type){ S.blocks.push(newBlock(type)); renderBlocks(); render(1); }
function syncFin(){ const set=(id,v)=>{const e=$(id); if(e)e.value=v;};
  set('#f_sym',S.fin.sym); set('#f_dec',S.fin.dec); set('#f_tax',S.fin.taxPct); set('#f_svc',S.fin.svcPct);
  $('#f_incl').checked=S.fin.incl; set('#f_dtype',S.fin.dtype); set('#f_dval',S.fin.dval); set('#p_method',S.fin.method); set('#p_paid',S.fin.paid); }
function syncType(){ const set=(id,v)=>{const e=$(id); if(e)e.value=v;};
  set('#t_scale',S.type.scale); $('#t_scaleV').textContent=Math.round(S.type.scale*100)+'%';
  set('#t_line',S.type.line); $('#t_lineV').textContent=S.type.line.toFixed(2); }

function buildFontSel(){ const s=$('#s_font'); s.innerHTML=''; Object.entries(FONTS).forEach(([k,f])=>{ const o=document.createElement('option'); o.value=k; o.textContent=f.name; s.appendChild(o); }); s.value=S.sty.font; }
function syncStyleInputs(){ $('#s_font').value=S.sty.font; $('#s_paper').value=S.sty.paper; $('#s_ink').value=S.sty.ink; $('#s_zig').checked=S.sty.zig; $('#s_pw').value=S.sty.paperW; $('#s_pwV').textContent=S.sty.paperW; $('#s_radius').value=S.sty.radius||0; $('#s_radiusV').textContent=S.sty.radius||0;
  $('#s_texture').value=S.sty.texture||''; $('#texAdjust').classList.toggle('hidden', !S.sty.texture);
  $('#s_texStrength').value=S.sty.texStrength==null?100:S.sty.texStrength; $('#s_texStrengthV').textContent=(S.sty.texStrength==null?100:S.sty.texStrength)+'%';
  $('#s_texHue').value=S.sty.texHue||0; $('#s_texHueV').textContent=(S.sty.texHue||0)===0?'黑白':((S.sty.texHue||0)+'°');
  $('#s_texBright').value=S.sty.texBright||100; $('#s_texBrightV').textContent=(S.sty.texBright||100)+'%';
  $('#s_texContrast').value=S.sty.texContrast||100; $('#s_texContrastV').textContent=(S.sty.texContrast||100)+'%'; }

function escapeAttr(s){ return String(s).replace(/"/g,'&quot;'); }
function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function renderItems(){
  const box=$('#itemList'); box.innerHTML=''; $('#itemCount').textContent=S.items.length+' 項';
  S.items.forEach(it=>{
    if(!it.children) it.children=[];
    const el=document.createElement('div'); el.className='item';
    const kids=it.children.map(c=>`
      <div class="kid">
        <span class="kdot">└</span>
        <input class="rich" type="text" data-knm="${it.id}|${c.id}" value="${escapeAttr(c.name)}" placeholder="內容物 / 子項目">
        <input type="number" data-kpr="${it.id}|${c.id}" value="${c.price||''}" step="1" placeholder="加價" title="留空＝內含不計價">
        <div class="mv"><button data-kup="${it.id}|${c.id}">▲</button><button data-kdn="${it.id}|${c.id}">▼</button><button data-krm="${it.id}|${c.id}" style="color:var(--danger)">✕</button></div>
      </div>`).join('');
    el.innerHTML=`<div class="r1">
        <input class="nm rich" type="text" data-inm="${it.id}" value="${escapeAttr(it.name)}" placeholder="品名">
        <div class="mv"><button data-iup="${it.id}">▲</button><button data-idn="${it.id}">▼</button><button data-irm="${it.id}" style="color:var(--danger)">✕</button></div>
      </div>
      <div class="r2">
        <input type="number" data-iqty="${it.id}" value="${it.qty}" min="0" step="1" placeholder="數量">
        <input type="number" data-ipr="${it.id}" value="${it.price}" min="0" step="1" placeholder="單價">
      </div>
      <textarea class="rich" data-idesc="${it.id}" rows="1" placeholder="商品說明（可留空）">${escapeHtml(it.desc||'')}</textarea>
      <div class="kids">${kids}</div>
      <button class="btn sm ghost addkid" data-addkid="${it.id}">＋ 內容物 / 子項目</button>`;
    box.appendChild(el);
  });
  const byId=(ds)=>{ const [iid,cid]=ds.split('|'); const it=item(iid); return [it, it&&it.children.find(c=>c.id===cid)]; };
  box.querySelectorAll('[data-inm]').forEach(i=>i.oninput=()=>{ item(i.dataset.inm).name=i.value; render(1); });
  box.querySelectorAll('[data-iqty]').forEach(i=>i.oninput=()=>{ item(i.dataset.iqty).qty=i.value; render(1); });
  box.querySelectorAll('[data-ipr]').forEach(i=>i.oninput=()=>{ item(i.dataset.ipr).price=i.value; render(1); });
  box.querySelectorAll('[data-idesc]').forEach(i=>{ grow(i); i.oninput=()=>{ item(i.dataset.idesc).desc=i.value; grow(i); render(1); }; });
  box.querySelectorAll('[data-iup]').forEach(b=>b.onclick=()=>mv(S.items,b.dataset.iup,-1,renderItems));
  box.querySelectorAll('[data-idn]').forEach(b=>b.onclick=()=>mv(S.items,b.dataset.idn,1,renderItems));
  box.querySelectorAll('[data-irm]').forEach(b=>b.onclick=()=>{ S.items=S.items.filter(x=>x.id!==b.dataset.irm); renderItems(); render(1); });
  // sub-items
  box.querySelectorAll('[data-knm]').forEach(i=>i.oninput=()=>{ const [,c]=byId(i.dataset.knm); if(c){c.name=i.value; render(1);} });
  box.querySelectorAll('[data-kpr]').forEach(i=>i.oninput=()=>{ const [,c]=byId(i.dataset.kpr); if(c){c.price=i.value; render(1);} });
  box.querySelectorAll('[data-kup]').forEach(b=>b.onclick=()=>{ const [it]=byId(b.dataset.kup); mv(it.children,b.dataset.kup.split('|')[1],-1,renderItems); });
  box.querySelectorAll('[data-kdn]').forEach(b=>b.onclick=()=>{ const [it]=byId(b.dataset.kdn); mv(it.children,b.dataset.kdn.split('|')[1],1,renderItems); });
  box.querySelectorAll('[data-krm]').forEach(b=>b.onclick=()=>{ const [it]=byId(b.dataset.krm); const cid=b.dataset.krm.split('|')[1]; it.children=it.children.filter(c=>c.id!==cid); renderItems(); render(1); });
  box.querySelectorAll('[data-addkid]').forEach(b=>b.onclick=()=>{ const it=item(b.dataset.addkid); it.children.push({id:nid(),name:'內容物',price:''}); renderItems(); render(1); });
}
function item(id){ return S.items.find(x=>x.id===id); }
function mv(arr,id,d,re){ const i=arr.findIndex(x=>x.id===id),j=i+d; if(j<0||j>=arr.length)return; [arr[i],arr[j]]=[arr[j],arr[i]]; re(); render(1); }
function grow(t){ t.style.height='auto'; t.style.height=Math.min(t.scrollHeight,90)+'px'; }

// ---- logo cropper ----
function coverDraw(c,W,H,img,zoom,fx,fy){
  const cover=Math.max(W/img.width,H/img.height), s=cover*zoom, dw=img.width*s, dh=img.height*s;
  let x=W/2-fx*dw, y=H/2-fy*dh; x=Math.min(0,Math.max(W-dw,x)); y=Math.min(0,Math.max(H-dh,y));
  c.clearRect(0,0,W,H); c.drawImage(img,x,y,dw,dh);
}
const logoCv=document.getElementById('logoCv'), logoCtx=logoCv.getContext('2d');
let logoCrop=null, logoDrag=null, logoDone=null;
function logoFrame(ar){ const [a,b]=ar.split(':').map(Number); const Wd=620; return [Wd, Math.round(Wd*b/a)]; }
function drawLogoModal(){
  const [W,H]=logoFrame(logoCrop.aspect); logoCv.width=W; logoCv.height=H;
  const disp=320, sc=disp/Math.max(W,H); logoCv.style.width=(W*sc)+'px'; logoCv.style.height=(H*sc)+'px';
  coverDraw(logoCtx,W,H,logoCrop.img,logoCrop.zoom,logoCrop.fx,logoCrop.fy);
  logoCtx.strokeStyle='rgba(255,255,255,.85)'; logoCtx.lineWidth=2; logoCtx.strokeRect(1,1,W-2,H-2);
}
function openLogoCropper(img,done){
  logoCrop={img,zoom:1,fx:0.5,fy:0.5,aspect:'2:1'}; logoDone=done;
  segPick($('#logoAspect'),'2:1'); $('#logoZoom').value=1; $('#logoZoomV').textContent='100%';
  $('#logoModal').classList.remove('hidden'); drawLogoModal();
}
$('#logoAspect').onclick=e=>{ const b=e.target.closest('button'); if(!b||!logoCrop)return; segPick($('#logoAspect'),b.dataset.v); logoCrop.aspect=b.dataset.v; drawLogoModal(); };
$('#logoZoom').oninput=e=>{ if(!logoCrop)return; logoCrop.zoom=+e.target.value; $('#logoZoomV').textContent=Math.round(e.target.value*100)+'%'; drawLogoModal(); };
$('#logoCropReset').onclick=()=>{ if(!logoCrop)return; logoCrop.zoom=1; logoCrop.fx=0.5; logoCrop.fy=0.5; $('#logoZoom').value=1; $('#logoZoomV').textContent='100%'; drawLogoModal(); };
logoCv.addEventListener('pointerdown',e=>{ if(!logoCrop)return; logoDrag={x:e.clientX,y:e.clientY}; try{logoCv.setPointerCapture(e.pointerId);}catch(_){} });
logoCv.addEventListener('pointermove',e=>{ if(!logoDrag||!logoCrop)return; const r=logoCv.getBoundingClientRect(); const [W,H]=logoFrame(logoCrop.aspect);
  const dx=(e.clientX-logoDrag.x)*(W/r.width), dy=(e.clientY-logoDrag.y)*(H/r.height); logoDrag.x=e.clientX; logoDrag.y=e.clientY;
  const im=logoCrop.img, s=Math.max(W/im.width,H/im.height)*logoCrop.zoom, dw=im.width*s, dh=im.height*s;
  logoCrop.fx=Math.min(1,Math.max(0,logoCrop.fx - dx/dw)); logoCrop.fy=Math.min(1,Math.max(0,logoCrop.fy - dy/dh)); drawLogoModal(); });
window.addEventListener('pointerup',()=>{ logoDrag=null; });
$('#logoCancel').onclick=()=>{ $('#logoModal').classList.add('hidden'); logoCrop=null; };
$('#logoOk').onclick=()=>{ if(!logoCrop)return; const [W,H]=logoFrame(logoCrop.aspect); const oc=document.createElement('canvas'); oc.width=W; oc.height=H;
  coverDraw(oc.getContext('2d'),W,H,logoCrop.img,logoCrop.zoom,logoCrop.fx,logoCrop.fy);
  const out=new Image(); out.onload=()=>logoDone(out); out.src=oc.toDataURL('image/png');
  $('#logoModal').classList.add('hidden'); logoCrop=null; };

// ---- background image cropper ----
const bgCropCv=document.getElementById('bgCropCv'), bgCropCtx=bgCropCv.getContext('2d');
let bgCrop=null, bgCropDrag=null;
// 裁切框比例 = 收據目前比例(WYSIWYG;clamp 避免極端瘦長)
function bgFrame(){
  const pw=S.sty.paperW||720, ph=lastH||pw*1.4;
  const Wd=560; let H=Math.round(Wd*ph/pw);
  H=Math.min(760,Math.max(220,H));
  return [Wd,H];
}
function drawBgCropModal(){
  const [W,H]=bgFrame(); bgCropCv.width=W; bgCropCv.height=H;
  const sc=Math.min(360/W,420/H); bgCropCv.style.width=(W*sc)+'px'; bgCropCv.style.height=(H*sc)+'px';
  coverDraw(bgCropCtx,W,H,bgCrop.img,bgCrop.zoom,bgCrop.fx,bgCrop.fy);
  bgCropCtx.strokeStyle='rgba(255,255,255,.85)'; bgCropCtx.lineWidth=2; bgCropCtx.strokeRect(1,1,W-2,H-2);
}
function openBgCropper(){
  const src=S.bg.imgOrig; if(!src)return;
  const c=S.bg.crop||{zoom:1,fx:0.5,fy:0.5};
  bgCrop={img:src,zoom:c.zoom,fx:c.fx,fy:c.fy};
  $('#bgZoom').value=bgCrop.zoom; $('#bgZoomV').textContent=Math.round(bgCrop.zoom*100)+'%';
  $('#bgModal').classList.remove('hidden'); drawBgCropModal();
}
$('#bgZoom').oninput=e=>{ if(!bgCrop)return; bgCrop.zoom=+e.target.value; $('#bgZoomV').textContent=Math.round(e.target.value*100)+'%'; drawBgCropModal(); };
$('#bgCropReset').onclick=()=>{ if(!bgCrop)return; bgCrop.zoom=1; bgCrop.fx=0.5; bgCrop.fy=0.5; $('#bgZoom').value=1; $('#bgZoomV').textContent='100%'; drawBgCropModal(); };
bgCropCv.addEventListener('pointerdown',e=>{ if(!bgCrop)return; bgCropDrag={x:e.clientX,y:e.clientY}; try{bgCropCv.setPointerCapture(e.pointerId);}catch(_){} });
bgCropCv.addEventListener('pointermove',e=>{ if(!bgCropDrag||!bgCrop)return; const r=bgCropCv.getBoundingClientRect(); const [W,H]=bgFrame();
  const dx=(e.clientX-bgCropDrag.x)*(W/r.width), dy=(e.clientY-bgCropDrag.y)*(H/r.height); bgCropDrag.x=e.clientX; bgCropDrag.y=e.clientY;
  const im=bgCrop.img, s=Math.max(W/im.width,H/im.height)*bgCrop.zoom, dw=im.width*s, dh=im.height*s;
  bgCrop.fx=Math.min(1,Math.max(0,bgCrop.fx - dx/dw)); bgCrop.fy=Math.min(1,Math.max(0,bgCrop.fy - dy/dh)); drawBgCropModal(); });
window.addEventListener('pointerup',()=>{ bgCropDrag=null; });
$('#bgCropCancel').onclick=()=>{ $('#bgModal').classList.add('hidden'); bgCrop=null; };
$('#bgCropOk').onclick=()=>{ if(!bgCrop)return; const [W,H]=bgFrame(); const oc=document.createElement('canvas'); oc.width=W; oc.height=H;
  coverDraw(oc.getContext('2d'),W,H,bgCrop.img,bgCrop.zoom,bgCrop.fx,bgCrop.fy);
  S.bg.crop={zoom:bgCrop.zoom,fx:bgCrop.fx,fy:bgCrop.fy};
  const out=new Image(); out.onload=()=>render(1); out.src=oc.toDataURL('image/png'); S.bg.img=out;
  $('#bgModal').classList.add('hidden'); bgCrop=null; };

// ---- block list editor (Notion-style) ----
const QR_OFFLINE_NOTE='在離線狀態下無法使用此選項（QR Code 產生器需連線載入）';
const BLABEL={ image:'圖片 / LOGO', text:'文字', fields:'資訊欄位', divider:'分隔線', space:'間距', items:'品項清單', services:'特別服務', totals:'金額小計', note:'備註', barcode:'條碼', qr:'QR Code' };
// 統一線性 SVG 圖示(stroke = currentColor,尺寸由 CSS 控制)
const SVG=p=>`<svg class="blk-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const ICONS={
  text:    SVG('<path d="M5 7h14"/><path d="M5 12h14"/><path d="M5 17h9"/>'),
  fields:  SVG('<path d="M5 8h4"/><path d="M14 8h5"/><path d="M5 16h4"/><path d="M14 16h5"/>'),
  image:   SVG('<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M5 16l4-3.5 3.5 3 3-2.5L19 16"/>'),
  divider: SVG('<path d="M4 12h16" stroke-dasharray="3 3"/>'),
  space:   SVG('<path d="M4 6h16"/><path d="M4 18h16"/><path d="M12 9.5v5"/><path d="M10 11l2-2 2 2"/><path d="M10 13l2 2 2-2"/>'),
  items:   SVG('<path d="M6.5 8h11l-1 10.5a1 1 0 0 1-1 .9H8.5a1 1 0 0 1-1-.9L6.5 8z"/><path d="M9.5 8V6.5a2.5 2.5 0 0 1 5 0V8"/>'),
  services:SVG('<path d="M12 4l1.7 4.6L18 10.3l-4.3 1.7L12 16.6l-1.7-4.6L6 10.3l4.3-1.7z"/><path d="M18 15l.6 1.6L20 17l-1.4.6L18 19l-.6-1.4L16 17l1.4-.4z"/>'),
  totals:  SVG('<circle cx="12" cy="12" r="8"/><path d="M12 7v10"/><path d="M14.5 9.3c-.6-.8-1.6-1.1-2.7-1.1-1.4 0-2.5.8-2.5 2 0 1.3 1.1 1.7 2.7 2 1.6.3 2.7.7 2.7 2 0 1.2-1.1 2-2.6 2-1.2 0-2.2-.4-2.8-1.2"/>'),
  note:    SVG('<path d="M6 4h9l3 3v13H6z"/><path d="M9 11h7M9 15h5"/>'),
  barcode: SVG('<path d="M5 6v12"/><path d="M8 6v12" stroke-width="2.6"/><path d="M11 6v12"/><path d="M14 6v12" stroke-width="2.6"/><path d="M17 6v12"/><path d="M19.5 6v12"/>'),
  qr:      SVG('<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2.5v2.5"/><path d="M20 14v.01"/><path d="M14 20h.01"/><path d="M17.5 17.5H20V20"/>'),
};
// 新增區塊選單的順序與文案
const ADD=[['text','文字'],['image','圖片'],['divider','分隔線'],['space','間距'],['items','品項'],['totals','金額小計'],['note','備註'],['barcode','條碼'],['qr','QR Code']];
function buildAddMenu(){
  const menu=$('#addMenu');
  menu.innerHTML=ADD.map(([t,label])=>`<button data-add="${t}">${ICONS[t]||''}<span>${label}</span></button>`).join('');
  menu.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{ addBlock(b.dataset.add); menu.classList.add('hidden'); });
}
function block(id){ return S.blocks.find(b=>b.id===id); }
let dragId=null;
function renderBlocks(){
  const box=$('#blockList'); box.innerHTML=''; $('#blockCount').textContent=S.blocks.length+' 塊';
  S.blocks.forEach(b=>{
    const el=document.createElement('div'); el.className='blk'; el.dataset.id=b.id; el.draggable=false;
    const body=blockEditor(b);
    el.innerHTML=`<div class="blk-head" data-bhead="${b.id}">
        <span class="blk-grip" data-grip="${b.id}" title="拖曳排序">⋮⋮</span>
        <span class="blk-ic">${(b.type==='text'&&b.mode==='fields')?ICONS.fields:(ICONS[b.type]||'')}</span>
        <span class="blk-type">${(b.type==='text'&&b.mode==='fields')?'資訊欄位':(BLABEL[b.type]||b.type)}</span>
        ${body?`<button class="blk-fold" data-fold="${b.id}" title="收合/展開">▾</button>`:''}
        <button class="blk-x" data-brm="${b.id}" title="刪除">✕</button>
      </div>${body?`<div class="blk-body">${body}</div>`:''}`;
    box.appendChild(el);
  });
  box.querySelectorAll('[data-brm]').forEach(x=>x.onclick=()=>{ S.blocks=S.blocks.filter(z=>z.id!==x.dataset.brm); renderBlocks(); render(1); });
  box.querySelectorAll('[data-fold]').forEach(x=>x.onclick=()=>{ const c=x.closest('.blk'); c.classList.toggle('folded'); x.textContent=c.classList.contains('folded')?'▸':'▾'; });
  // drag-reorder via grip
  box.querySelectorAll('[data-grip]').forEach(g=>{ const card=g.closest('.blk');
    g.onpointerdown=e=>{ e.preventDefault(); dragId=card.dataset.id; card.classList.add('dragging'); document.body.style.userSelect='none'; };
  });
  box.onpointermove=e=>{ if(!dragId)return; const after=[...box.querySelectorAll('.blk:not(.dragging)')].find(c=>{ const r=c.getBoundingClientRect(); return e.clientY < r.top + r.height/2; });
    const drag=box.querySelector('.blk.dragging'); if(!drag)return; if(after) box.insertBefore(drag,after); else box.appendChild(drag); };
  wireBlockEditors(box);
}
function endDrag(){ if(!dragId)return; const box=$('#blockList'); const order=[...box.querySelectorAll('.blk')].map(c=>c.dataset.id);
  S.blocks.sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id)); dragId=null; document.body.style.userSelect='';
  box.querySelectorAll('.blk').forEach(c=>c.classList.remove('dragging')); render(1); }
window.addEventListener('pointerup',endDrag);
function blockEditor(b){
  if(b.type==='text'){
    const modeSeg=`<div class="seg mini" data-bmode="${b.id}" style="margin-bottom:8px">${[['para','段落'],['fields','欄位列']].map(([v,t])=>`<button data-v="${v}" class="${(b.mode||'para')===v?'on':''}">${t}</button>`).join('')}</div>`;
    if(b.mode==='fields'){ const rows=(b.rows||[]).map(r=>`
      <div class="kid">
        <input type="text" data-frl="${b.id}|${r.id}" value="${escapeAttr(r.label||'')}" placeholder="標題" style="flex:0 0 34%">
        <input type="text" data-frv="${b.id}|${r.id}" value="${escapeAttr(r.value||'')}" placeholder="內容（例如 2026/06/26 14:30）" style="flex:1">
        <div class="mv"><button data-fru="${b.id}|${r.id}">▲</button><button data-frd="${b.id}|${r.id}">▼</button><button data-frx="${b.id}|${r.id}" style="color:var(--danger)">✕</button></div>
      </div>`).join('');
      return `${modeSeg}<div class="bk-fields">${rows}</div><button class="btn sm ghost" data-fadd="${b.id}">＋ 欄位</button>`; }
    return `${modeSeg}
    <textarea class="rich bk" data-btext="${b.id}" rows="1" placeholder="輸入文字…">${escapeHtml(b.text||'')}</textarea>
    <div class="bk-row">
      <select data-bsize="${b.id}" title="大小">${['lg','md','sm','xs'].map(s=>`<option value="${s}" ${b.size===s?'selected':''}>${({lg:'大標',md:'內文',sm:'小字',xs:'註解'})[s]}</option>`).join('')}</select>
      <div class="seg mini" data-balign="${b.id}">${['left','center','right'].map(a=>`<button data-v="${a}" class="${(b.align||'center')===a?'on':''}">${({left:'左',center:'中',right:'右'})[a]}</button>`).join('')}</div>
      <div class="seg mini" data-bweight="${b.id}">${[['400','標'],['700','粗'],['900','特']].map(([v,t])=>`<button data-v="${v}" class="${String(b.weight||400)===v?'on':''}">${t}</button>`).join('')}</div>
    </div>`;
  }
  if(b.type==='divider') return `<select data-bdiv="${b.id}">${[['','（依預設）'],['dash','虛線'],['solid','實線'],['double','雙線']].map(([v,t])=>`<option value="${v}" ${(b.dstyle||'')===v?'selected':''}>${t}</option>`).join('')}</select>`;
  if(b.type==='space') return `<select data-bspace="${b.id}">${[['sm','小'],['md','中'],['lg','大']].map(([v,t])=>`<option value="${v}" ${(b.size||'md')===v?'selected':''}>${t}間距</option>`).join('')}</select>`;
  if(b.type==='image') return `
    <div class="row"><button class="btn sm" data-bimg="${b.id}" style="flex:1">${b.img?'更換圖片':'上傳圖片'}</button>${b.img?`<button class="btn sm" data-bimgrm="${b.id}">移除</button>`:''}</div>
    ${b.img?`<div class="rng" style="margin-top:7px"><span class="lbl" style="min-width:30px">大小</span><input type="range" data-bscale="${b.id}" min="0.2" max="0.8" step="0.01" value="${b.scale||0.42}"></div>
    <div class="rng"><span class="lbl" style="min-width:30px">色相</span><input type="range" data-bhue="${b.id}" min="0" max="360" step="1" value="${b.hue||0}"></div>`:''}`;
  if(b.type==='qr') return `
    <input type="text" data-burl="${b.id}" value="${escapeAttr(b.url||'')}" placeholder="https://..." title="${QR_OFFLINE_NOTE}">
    <input type="text" data-blabel="${b.id}" value="${escapeAttr(b.label||'')}" placeholder="說明文字（可留空）" style="margin-top:6px" title="${QR_OFFLINE_NOTE}">
    <div class="bk-row" title="${QR_OFFLINE_NOTE}"><span class="clbl">顏色</span><input type="color" data-bqcolor="${b.id}" value="${b.color||'#111111'}">
      <span class="clbl">底色</span><input type="color" data-bqbg="${b.id}" value="${b.bg||'#ffffff'}"></div>
    <p class="hint" style="margin:5px 0 0">為了能掃描，建議深色 QR ＋ 淺色底、保持對比。</p>
    <p class="hint" style="margin:3px 0 0">⚠ 在離線狀態下無法使用此選項（QR Code 產生器需連線載入）。</p>`;
  if(b.type==='barcode') return `
    <div class="seg mini" data-bbarsrc="${b.id}" style="margin-bottom:7px">${[['auto','取單號'],['custom','自訂']].map(([v,t])=>`<button data-v="${v}" class="${(b.src||'auto')===v?'on':''}">${t}</button>`).join('')}</div>
    ${(b.src==='custom')?`<input type="text" data-bbarnum="${b.id}" value="${escapeAttr(b.num||'')}" placeholder="輸入號碼數字（例如 471000123456）">`:`<p class="hint" style="margin:2px 0">取「資訊欄位」中含『單號／No.』的內容為號碼來源。</p>`}`;
  if(b.type==='items') return `<p class="hint" style="margin:2px 0">品項在右欄「品項」編輯，這裡決定顯示位置。</p>`;
  if(b.type==='totals') return `<p class="hint" style="margin:2px 0">數字由「金額與付款」設定計算。</p>`;
  if(b.type==='note') return `<textarea class="rich bk" data-bnote="${b.id}" rows="2" placeholder="備註內容…(也可在收銀填寫)">${escapeHtml(b.text||'')}</textarea>`;
  return '';
}
function wireBlockEditors(box){
  const fr=(ds)=>{ const [bid,rid]=ds.split('|'); const b=block(bid); return [b, b&&(b.rows||[]).find(r=>r.id===rid)]; };
  box.querySelectorAll('[data-btext]').forEach(i=>{ grow(i); i.oninput=()=>{ block(i.dataset.btext).text=i.value; grow(i); render(1); }; });
  box.querySelectorAll('[data-bnote]').forEach(i=>{ grow(i); i.oninput=()=>{ block(i.dataset.bnote).text=i.value; grow(i); render(1); }; });
  box.querySelectorAll('[data-bsize]').forEach(s=>s.onchange=()=>{ block(s.dataset.bsize).size=s.value; render(1); });
  box.querySelectorAll('[data-balign]').forEach(seg=>seg.querySelectorAll('button').forEach(btn=>btn.onclick=()=>{ segPick(seg,btn.dataset.v,v=>block(seg.dataset.balign).align=v); render(1); }));
  box.querySelectorAll('[data-bweight]').forEach(seg=>seg.querySelectorAll('button').forEach(btn=>btn.onclick=()=>{ segPick(seg,btn.dataset.v,v=>block(seg.dataset.bweight).weight=+v); render(1); }));
  box.querySelectorAll('[data-bmode]').forEach(seg=>seg.querySelectorAll('button').forEach(btn=>btn.onclick=()=>{ const b=block(seg.dataset.bmode); b.mode=btn.dataset.v; if(b.mode==='fields'&&!(b.rows&&b.rows.length)) b.rows=[{id:nid(),label:'欄位',value:''}]; renderBlocks(); render(1); }));
  box.querySelectorAll('[data-bbarsrc]').forEach(seg=>seg.querySelectorAll('button').forEach(btn=>btn.onclick=()=>{ block(seg.dataset.bbarsrc).src=btn.dataset.v; renderBlocks(); render(1); }));
  box.querySelectorAll('[data-bbarnum]').forEach(i=>i.oninput=()=>{ block(i.dataset.bbarnum).num=i.value; render(1); });
  box.querySelectorAll('[data-bdiv]').forEach(s=>s.onchange=()=>{ block(s.dataset.bdiv).dstyle=s.value; render(1); });
  box.querySelectorAll('[data-bspace]').forEach(s=>s.onchange=()=>{ block(s.dataset.bspace).size=s.value; render(1); });
  box.querySelectorAll('[data-burl]').forEach(i=>i.oninput=()=>{ block(i.dataset.burl).url=i.value; render(1); });
  box.querySelectorAll('[data-blabel]').forEach(i=>i.oninput=()=>{ block(i.dataset.blabel).label=i.value; render(1); });
  box.querySelectorAll('[data-bqcolor]').forEach(i=>i.oninput=()=>{ block(i.dataset.bqcolor).color=i.value; render(1); });
  box.querySelectorAll('[data-bqbg]').forEach(i=>i.oninput=()=>{ block(i.dataset.bqbg).bg=i.value; render(1); });
  // fields rows
  box.querySelectorAll('[data-frl]').forEach(i=>i.oninput=()=>{ const [,r]=fr(i.dataset.frl); if(r){r.label=i.value; render(1);} });
  box.querySelectorAll('[data-frv]').forEach(i=>i.oninput=()=>{ const [,r]=fr(i.dataset.frv); if(r){r.value=i.value; render(1);} });
  box.querySelectorAll('[data-fru]').forEach(btn=>btn.onclick=()=>{ const [b]=fr(btn.dataset.fru); mv(b.rows,btn.dataset.fru.split('|')[1],-1,renderBlocks); });
  box.querySelectorAll('[data-frd]').forEach(btn=>btn.onclick=()=>{ const [b]=fr(btn.dataset.frd); mv(b.rows,btn.dataset.frd.split('|')[1],1,renderBlocks); });
  box.querySelectorAll('[data-frx]').forEach(btn=>btn.onclick=()=>{ const [b]=fr(btn.dataset.frx); const rid=btn.dataset.frx.split('|')[1]; b.rows=b.rows.filter(r=>r.id!==rid); renderBlocks(); render(1); });
  box.querySelectorAll('[data-fadd]').forEach(btn=>btn.onclick=()=>{ block(btn.dataset.fadd).rows.push({id:nid(),label:'欄位',value:''}); renderBlocks(); render(1); });
  // image
  box.querySelectorAll('[data-bimg]').forEach(btn=>btn.onclick=()=>{ const bid=btn.dataset.bimg; pickImage(im=>openLogoCropper(im,cropped=>{ const b=block(bid); b.img=cropped; renderBlocks(); render(1); })); });
  box.querySelectorAll('[data-bimgrm]').forEach(btn=>btn.onclick=()=>{ block(btn.dataset.bimgrm).img=null; renderBlocks(); render(1); });
  box.querySelectorAll('[data-bscale]').forEach(i=>i.oninput=()=>{ block(i.dataset.bscale).scale=+i.value; render(1); });
  box.querySelectorAll('[data-bhue]').forEach(i=>i.oninput=()=>{ block(i.dataset.bhue).hue=+i.value; render(1); });
}
let _picker=null;
function pickImage(cb){ if(!_picker){ _picker=document.createElement('input'); _picker.type='file'; _picker.accept='image/*'; document.body.appendChild(_picker); }
  _picker.value=''; _picker.onchange=e=>loadImg(e.target.files[0],cb); _picker.click(); }

// ---- designs (templates) ----
function designData(key){
  const id=()=>nid();
  const mkItems=arr=>arr.map(a=>{ const o=Object.assign({id:id()},a); o.children=(o.children||[]).map(c=>Object.assign({id:id()},c)); return o; });
  const txt=(text,size,opt)=>Object.assign({id:id(),type:'text',mode:'para',text,size},opt||{});
  const fld=rows=>({id:id(),type:'text',mode:'fields',rows:rows.map(r=>Object.assign({id:id()},r))});
  const div=ds=>({id:id(),type:'divider',dstyle:ds});
  const sp=size=>({id:id(),type:'space',size});
  const img=()=>({id:id(),type:'image',img:null,scale:0.42,hue:0});
  const items=()=>({id:id(),type:'items'}), totals=()=>({id:id(),type:'totals'});
  const bar=()=>({id:id(),type:'barcode',src:'auto',num:''}), qr=(url,label)=>({id:id(),type:'qr',url,label,color:'#111111',bg:'#ffffff'});
  const note=(text)=>({id:id(),type:'note',text:text||''});
  const addr='艾奧傑亞 - 巴哈姆特 - 雪人區 - 雪人街 - 雪屋', tel='123-456-789';

  if(key==='cafe') return {
    blocks:[ img(),
      txt('雪人咖啡廳','lg',{align:'center',weight:700}),
      txt('SNOWMAN COFFEE ROASTERY','sm',{align:'center',alpha:0.85}),
      txt(addr,'xs',{align:'center',alpha:0.8}), txt('TEL  '+tel,'xs',{align:'center',alpha:0.8}),
      sp('sm'), div('dash'),
      fld([{label:'日期',value:'2026/06/26 14:30'},{label:'單號',value:'No. C-0815'},{label:'內用 / 外帶',value:'內用'},{label:'桌號',value:'5'},{label:'店員',value:'Yuki'}]),
      div('dash'), items(), div('dash'), totals(), div('dash'),
      txt('謝謝光臨 · 願與你在雪中相遇','md',{align:'center',weight:500}),
      txt('出示本收據，下次飲品折 10 元','xs',{align:'center',alpha:0.7}),
      note('現點現做,內用請出示本單'), bar(), qr('https://example.com/snowman-cafe','追蹤 IG 看每日限定') ],
    items:mkItems([
      {name:'雪人早午餐 SET',qty:1,price:380,desc:'平日限定',children:[
        {name:'松露野菇歐姆蛋',price:''},{name:'季節溫沙拉',price:''},{name:'今日濃湯',price:''},{name:'飲料（可換拿鐵）',price:20} ]},
      {name:'招牌雪人拿鐵',qty:2,price:130,desc:'可換燕麥奶 +10'},
      {name:'手沖・耶加雪菲',qty:1,price:180,desc:'淺焙 · 柑橘與花香'},
      {name:'紐約起司蛋糕',qty:1,price:140,desc:''} ]),
    fin:{ sym:'NT$', dec:0, taxPct:5, incl:true, svcPct:0, dtype:'amount', dval:0, method:'現金', paid:'' },
    sty:{ font:'mono', paper:'#ece1ca', ink:'#574733', zig:true, divider:'dash' },
    type:{ scale:1, line:1, accent:'#7a5230' },
  };
  if(key==='bar') return {
    blocks:[ img(),
      txt('雪人酒吧','lg',{align:'center',weight:900}),
      txt('SNOWMAN LOUNGE & BAR','sm',{align:'center',alpha:0.85}),
      txt(addr,'xs',{align:'center',alpha:0.8}), txt('TEL  '+tel,'xs',{align:'center',alpha:0.8}),
      sp('sm'), div('solid'),
      fld([{label:'日期',value:'2026/06/26 23:10'},{label:'單號',value:'No. B-0029'},{label:'桌號',value:'VIP-3'},{label:'指名',value:'Yuki'},{label:'幹部',value:'Leon'}]),
      div('solid'), items(), div('solid'), totals(), div('solid'),
      txt('感謝蒞臨 · 期待與您再會','md',{align:'center',weight:700}),
      txt('本單為消費明細，非統一發票','xs',{align:'center',alpha:0.7}),
      note('本單為消費明細,如需統編請告知'), bar(), qr('https://example.com/snowman-bar','加入會員享專屬服務') ],
    items:mkItems([
      {name:'尊爵包廂套裝',qty:1,price:18000,desc:'90 分鐘',children:[
        {name:'響 21年 Whisky 一瓶',price:''},{name:'綜合水果盤',price:''},{name:'冰桶 & 調酒組',price:''},{name:'升級香檳塔',price:8000} ]},
      {name:'Moët 香檳',qty:1,price:6800,desc:''},
      {name:'起司拼盤',qty:1,price:800,desc:''},
      {name:'指名費',qty:1,price:2000,desc:''},
      {name:'桌費 SET',qty:1,price:3000,desc:'90 分鐘'} ]),
    fin:{ sym:'NT$', dec:0, taxPct:5, incl:false, svcPct:15, dtype:'amount', dval:0, method:'信用卡 VISA ****1234', paid:'' },
    sty:{ font:'serif', paper:'#2a1d3d', ink:'#ecdfb0', zig:false, divider:'solid' },
    type:{ scale:1, line:1.05, accent:'#d9b44a' },
  };
  return { // tailor (default)
    blocks:[ img(),
      txt('雪人紳士','lg',{align:'center',weight:700}),
      txt('量身定製西裝店 · BESPOKE TAILOR','sm',{align:'center',alpha:0.85}),
      txt(addr,'xs',{align:'center',alpha:0.8}), txt('TEL  '+tel,'xs',{align:'center',alpha:0.8}),
      sp('sm'), div('dash'),
      fld([{label:'日期',value:'2026/06/26 14:30'},{label:'單號',value:'No. 2026-0457'},{label:'取件日',value:'2026/07/10'},{label:'量身師',value:'Yuki'}]),
      div('dash'), items(), div('dash'), totals(), div('dash'),
      txt('感謝您的訂製 · 期待再次為您服務','md',{align:'center',weight:500}),
      txt('完成品恕不退換，修改服務 30 日內免費','xs',{align:'center',alpha:0.7}),
      note('完成後將以簡訊通知取件'), bar(), qr('https://example.com/snowman-tailor','掃碼預約下次量身') ],
    items:mkItems([
      {name:'訂製兩件式西裝',qty:1,price:28000,desc:'Super 120s 羊毛 · 海軍藍 · 雙排釦',children:[
        {name:'含布料挑選與量身',price:''},{name:'含兩次修改',price:''},{name:'升級真絲內襯',price:1200} ]},
      {name:'訂製襯衫',qty:2,price:2200,desc:'埃及棉 · 白 · 標準領'},
      {name:'西裝褲改褲長',qty:1,price:300,desc:''},
      {name:'加急製作（7 日交件）',qty:1,price:3000,desc:''},
      {name:'內襯刺繡英文名',qty:1,price:500,desc:'JS.'} ]),
    fin:{ sym:'NT$', dec:0, taxPct:5, incl:true, svcPct:0, dtype:'amount', dval:0, method:'信用卡 VISA ****1234', paid:'' },
    sty:{ font:'dot', paper:'#ffffff', ink:'#111111', zig:true, divider:'dash' },
    type:{ scale:1, line:1, accent:'#111111' },
  };
}
function applyDesign(key){
  const d=designData(key);
  S.blocks=d.blocks; S.items=d.items; S.fin=d.fin;
  S.sty=Object.assign({}, S.sty, d.sty); S.type=Object.assign({}, d.type); S.design=key;
  S.sty.texture='';   // 預設模板不帶紙張紋理
  S.bg={ img:null, imgOrig:null, crop:null, mode:'none', pos:'center', opacity:15, size:40, effect:'none', paperAlpha:100, margin:80 };   // 不帶底圖
  segPick($('#bgModeSeg'),S.bg.mode); segPick($('#bgEffectSeg'),S.bg.effect); bgSyncRows(); bgEditState();
  $('#bgPaperAlpha').value=S.bg.paperAlpha; $('#bgPaperAlphaV').textContent=S.bg.paperAlpha+'%';
  syncStyleInputs(); syncFin(); syncType(); renderBlocks(); renderItems();
  if(blkMode==='text') $('#blockSource').value=serializeBlocks();
  render(1);
  renderPosFields(); posPreview();
}

// ============ 收銀(POS) ============
const POS_KEY='receipt-pos-catalog', POS_SUBS_KEY='receipt-pos-catsubs', POS_CATS_KEY='receipt-pos-cats', POS_CUT_KEY='receipt-pos-catcut', POS_TX_KEY='receipt-pos-tx';
const POS_DEFAULT=[
  {name:'美式咖啡',price:80,cat:'飲品'},{name:'拿鐵',price:120,cat:'飲品'},{name:'卡布奇諾',price:120,cat:'飲品'},{name:'手沖單品',price:180,cat:'飲品'},
  {name:'起司蛋糕',price:140,cat:'甜點'},{name:'可頌',price:60,cat:'甜點'},{name:'司康',price:70,cat:'甜點'},
  {name:'總匯三明治',price:120,cat:'餐點'},
];
const POS={ catalog:[], cart:[], catSubs:{}, cats:[], catCut:{}, tx:[] };
let posCat='', posExpand=null;
function posLoad(){
  try{ POS.catalog=JSON.parse(localStorage.getItem(POS_KEY))||[]; }catch(e){ POS.catalog=[]; }
  if(!Array.isArray(POS.catalog)||!POS.catalog.length) POS.catalog=POS_DEFAULT.map(p=>({id:nid(),name:p.name,price:p.price,cat:p.cat||'',children:[]}));
  POS.catalog.forEach(p=>{ if(!p.id)p.id=nid(); if(!Array.isArray(p.children))p.children=[]; });
  try{ POS.catSubs=JSON.parse(localStorage.getItem(POS_SUBS_KEY))||{}; }catch(e){ POS.catSubs={}; }
  try{ POS.cats=JSON.parse(localStorage.getItem(POS_CATS_KEY))||[]; }catch(e){ POS.cats=[]; }
  if(!Array.isArray(POS.cats)||!POS.cats.length){ POS.cats=[]; POS.catalog.forEach(p=>{ const c=(p.cat||'').trim(); if(c&&!POS.cats.includes(c))POS.cats.push(c); }); }
  try{ POS.catCut=JSON.parse(localStorage.getItem(POS_CUT_KEY))||{}; }catch(e){ POS.catCut={}; }
  try{ POS.tx=JSON.parse(localStorage.getItem(POS_TX_KEY))||[]; }catch(e){ POS.tx=[]; }
}
function posFlashSave(){ const el=$('#posSaveStatus'); if(!el)return; el.textContent='● 儲存中…'; el.classList.add('dirty'); clearTimeout(posFlashSave._t); posFlashSave._t=setTimeout(()=>{ el.textContent='✓ 已儲存'; el.classList.remove('dirty'); },300); }
function posSave(){ try{
  localStorage.setItem(POS_KEY, JSON.stringify(POS.catalog.map(p=>({id:p.id,name:p.name,price:p.price,cat:p.cat||'',children:(p.children||[]).map(c=>({name:c.name,price:c.price}))}))));
  localStorage.setItem(POS_SUBS_KEY, JSON.stringify(POS.catSubs));
  localStorage.setItem(POS_CATS_KEY, JSON.stringify(POS.cats));
  localStorage.setItem(POS_CUT_KEY, JSON.stringify(POS.catCut));
}catch(e){} posFlashSave(); }
// 商品有效子項目 = 分類共用子項目 + 商品自己的子項目
function prodChildren(p){ return (POS.catSubs[(p.cat||'').trim()]||[]).concat(p.children||[]); }
function posLineTotal(c){ return c.qty*(c.price + (c.child?(+c.child.price||0):0)); }
function renderPosGrid(){
  const cats=POS.cats.slice(); if(posCat && !cats.includes(posCat)) posCat='';
  const bar=$('#posCats');
  if(bar){ bar.innerHTML='';
    if(cats.length){
      const mk=(v,label)=>{ const b=document.createElement('button'); b.className='pos-cat'+(posCat===v?' on':''); b.textContent=label; b.onclick=()=>{ posCat=v; renderPosGrid(); }; return b; };
      bar.appendChild(mk('','全部')); cats.forEach(c=>bar.appendChild(mk(c,c)));
    }
  }
  const g=$('#posGrid'); if(!g)return; g.innerHTML='';
  if(!POS.catalog.length){ g.innerHTML='<p class="hint">尚無商品,點右上「管理」新增。</p>'; return; }
  const mkBtn=p=>{ const b=document.createElement('button'); b.className='pos-prod'; b.innerHTML=`<span class="pp-name">${escapeHtml(p.name)}</span><span class="pp-price">${money(p.price)}</span>`; b.onclick=()=>addToCart(p.id); return b; };
  const hdr=t=>{ const h=document.createElement('div'); h.className='pos-group-h'; h.textContent=t; return h; };
  if(posCat){
    const list=POS.catalog.filter(p=>(p.cat||'')===posCat);
    if(!list.length){ g.innerHTML='<p class="hint">此分類沒有商品。</p>'; return; }
    list.forEach(p=>g.appendChild(mkBtn(p)));
  } else {
    cats.forEach(c=>{ const ps=POS.catalog.filter(p=>(p.cat||'')===c); if(!ps.length)return; g.appendChild(hdr(c)); ps.forEach(p=>g.appendChild(mkBtn(p))); });
    const un=POS.catalog.filter(p=>!cats.includes((p.cat||'').trim())); if(un.length){ if(cats.length)g.appendChild(hdr('未分類')); un.forEach(p=>g.appendChild(mkBtn(p))); }
  }
}
function addToCart(id){ const p=POS.catalog.find(x=>x.id===id); if(!p)return; const opts=prodChildren(p); if(!opts.length) pushCart(p,null); else openOptChooser(p,opts); }
function pushCart(p,child){ const key=p.id+'|'+(child?child.name:''); const c=POS.cart.find(x=>x.key===key); if(c)c.qty++; else POS.cart.push({key,id:p.id,name:p.name,price:p.price,qty:1,child:child?{name:child.name,price:child.price}:null}); renderCart(); }
function cartQty(key,d){ const c=POS.cart.find(x=>x.key===key); if(!c)return; c.qty+=d; if(c.qty<=0) POS.cart=POS.cart.filter(x=>x.key!==key); renderCart(); }
function openOptChooser(p,opts){
  $('#posOptTitle').textContent=p.name+' — 選擇子項目';
  const box=$('#posOptList'); box.innerHTML='';
  const mk=(label,child)=>{ const b=document.createElement('button'); b.type='button'; b.className='pos-opt'; b.innerHTML=label; b.onclick=()=>{ pushCart(p,child); $('#posOpt').classList.add('hidden'); }; return b; };
  box.appendChild(mk('無',null));
  opts.forEach(o=>{ const pr=(+o.price)?' <span class="po-pr">+'+money(+o.price)+'</span>':''; box.appendChild(mk('<span>'+escapeHtml(o.name||'子項目')+'</span>'+pr,o)); });
  $('#posOpt').classList.remove('hidden');
}
function renderCart(){
  const box=$('#posCartList'); if(!box)return;
  const tot=POS.cart.reduce((a,c)=>a+posLineTotal(c),0);
  $('#posTotal').textContent=money(tot);
  if(!POS.cart.length){ box.innerHTML='<p class="hint">點左側商品加入購物車。</p>'; posPreview(); return; }
  box.innerHTML='';
  POS.cart.forEach(c=>{ const el=document.createElement('div'); el.className='pos-citem';
    el.innerHTML=`<span class="ci-name">${escapeHtml(c.name)}${c.child?'<small> · '+escapeHtml(c.child.name)+'</small>':''}</span>
      <span class="ci-stem"><button data-d="-1">−</button><b>${c.qty}</b><button data-d="1">＋</button></span>
      <span class="ci-amt">${money(posLineTotal(c))}</span>
      <button class="ci-rm" title="移除">✕</button>`;
    el.querySelectorAll('[data-d]').forEach(btn=>btn.onclick=()=>cartQty(c.key,+btn.dataset.d));
    el.querySelector('.ci-rm').onclick=()=>{ POS.cart=POS.cart.filter(x=>x.key!==c.key); renderCart(); };
    box.appendChild(el); });
  posPreview();
}
// 可重用的子項目編輯器:操作給定陣列(以 index 定位)
function renderChildEditor(container, arr, onChange){
  container.innerHTML = arr.map((c,i)=>`<div class="kid">
      <span class="kdot">└</span>
      <input type="text" value="${escapeAttr(c.name||'')}" data-kn="${i}" placeholder="子項目" style="flex:1">
      <input type="number" value="${c.price||''}" data-kp="${i}" placeholder="加價" title="留空＝內含不計價" style="width:66px">
      <button class="ci-rm" data-kx="${i}" title="刪除">✕</button>
    </div>`).join('') + `<button class="btn sm ghost" data-ka="1">＋ 子項目</button>`;
  const re=()=>renderChildEditor(container,arr,onChange);
  container.querySelectorAll('[data-kn]').forEach(inp=>inp.oninput=()=>{ arr[+inp.dataset.kn].name=inp.value; onChange(); });
  container.querySelectorAll('[data-kp]').forEach(inp=>inp.oninput=()=>{ arr[+inp.dataset.kp].price=inp.value; onChange(); });
  container.querySelectorAll('[data-kx]').forEach(b=>b.onclick=()=>{ arr.splice(+b.dataset.kx,1); onChange(); re(); });
  container.querySelectorAll('[data-ka]').forEach(b=>b.onclick=()=>{ arr.push({name:'',price:''}); onChange(); re(); });
}
function catOptions(sel){ return `<option value="">未分類</option>`+POS.cats.map(c=>`<option value="${escapeAttr(c)}" ${c===(sel||'')?'selected':''}>${escapeHtml(c)}</option>`).join(''); }
function fillNewCatSelect(){ const s=$('#posNewCat'); if(s){ const v=s.value; s.innerHTML=catOptions(v); } }
function renderCatalog(){
  const box=$('#posCatList'); box.innerHTML='';
  POS.catalog.forEach(p=>{ if(!p.children)p.children=[];
    const el=document.createElement('div'); el.className='pos-citem';
    el.innerHTML=`<input type="text" value="${escapeAttr(p.name)}" data-cn="${p.id}" placeholder="名稱" style="flex:1">
      <select data-cc="${p.id}" style="width:88px">${catOptions(p.cat)}</select>
      <input type="number" value="${p.price}" data-cp="${p.id}" placeholder="價格" style="width:64px">
      <button class="btn sm ghost" data-ce="${p.id}" title="商品子項目">子${p.children.length?'·'+p.children.length:''}</button>
      <button class="ci-rm" data-cr="${p.id}" title="刪除">✕</button>`;
    box.appendChild(el);
    if(posExpand===p.id){ const sub=document.createElement('div'); sub.className='pos-subedit';
      renderChildEditor(sub, p.children, ()=>{ posSave(); renderPosGrid(); }); box.appendChild(sub); }
  });
  box.querySelectorAll('[data-cn]').forEach(i=>i.oninput=()=>{ const p=POS.catalog.find(x=>x.id===i.dataset.cn); if(p){p.name=i.value; posSave(); renderPosGrid();} });
  box.querySelectorAll('[data-cc]').forEach(s=>s.onchange=()=>{ const p=POS.catalog.find(x=>x.id===s.dataset.cc); if(p){p.cat=s.value; posSave(); renderPosGrid();} });
  box.querySelectorAll('[data-cp]').forEach(i=>i.oninput=()=>{ const p=POS.catalog.find(x=>x.id===i.dataset.cp); if(p){p.price=+i.value||0; posSave(); renderPosGrid();} });
  box.querySelectorAll('[data-ce]').forEach(b=>b.onclick=()=>{ posExpand=(posExpand===b.dataset.ce?null:b.dataset.ce); renderCatalog(); });
  box.querySelectorAll('[data-cr]').forEach(b=>b.onclick=()=>{ POS.catalog=POS.catalog.filter(x=>x.id!==b.dataset.cr); posSave(); renderCatalog(); renderPosGrid(); });
  fillNewCatSelect();
}
function renderCats(){
  const box=$('#posSubList'); if(!box)return; box.innerHTML='';
  if(!POS.cats.length){ box.innerHTML='<p class="hint">尚無分類,上方新增分類。</p>'; fillNewCatSelect(); return; }
  POS.cats.forEach(cat=>{ if(!Array.isArray(POS.catSubs[cat]))POS.catSubs[cat]=[];
    const wrap=document.createElement('div'); wrap.className='pos-subgroup';
    const h=document.createElement('div'); h.className='pos-subgroup-h';
    h.innerHTML=`<span>【${escapeHtml(cat)}】共用子項目</span><span class="lg-cut">店家抽成 <input type="number" data-cut="${escapeAttr(cat)}" value="${POS.catCut[cat]||0}" min="0" max="100" step="1">%</span><button class="ci-rm" data-catdel="${escapeAttr(cat)}" title="刪除分類">✕</button>`;
    wrap.appendChild(h);
    const ed=document.createElement('div'); renderChildEditor(ed, POS.catSubs[cat], ()=>{ posSave(); renderPosGrid(); }); wrap.appendChild(ed);
    box.appendChild(wrap);
  });
  box.querySelectorAll('[data-cut]').forEach(i=>i.oninput=()=>{ POS.catCut[i.dataset.cut]=+i.value||0; posSave(); });
  box.querySelectorAll('[data-catdel]').forEach(b=>b.onclick=()=>{ const c=b.dataset.catdel; if(!confirm('刪除分類「'+c+'」?該分類的商品會變成未分類。'))return;
    POS.cats=POS.cats.filter(x=>x!==c); delete POS.catSubs[c]; POS.catalog.forEach(p=>{ if((p.cat||'')===c)p.cat=''; });
    posSave(); renderCats(); renderCatalog(); renderPosGrid(); });
  fillNewCatSelect();
}
// 以目前公版 + 購物車品項渲染,回傳暫存的編輯區品項供還原
// 收銀可手動填寫公版「資訊欄位」內容(日期 / 單號…),直接寫入公版的欄位列
function posFieldRows(){ const out=[]; S.blocks.forEach(b=>{ if(b.type==='text'&&b.mode==='fields') (b.rows||[]).forEach(r=>out.push(r)); }); return out; }
function renderPosFields(){
  const box=$('#posFields'); if(!box)return;
  const rows=posFieldRows(), notes=S.blocks.filter(b=>b.type==='note');
  if(!rows.length && !notes.length){ box.innerHTML=''; return; }
  let html='<div class="pos-fields-h">收據資訊</div>';
  html+=rows.map((r,i)=>`<div class="pos-frow"><span class="pf-lbl">${escapeHtml(r.label||'欄位')}</span><input type="text" data-pf="${i}" value="${escapeAttr(r.value||'')}"></div>`).join('');
  html+=notes.map((b,i)=>`<div class="pos-frow"><span class="pf-lbl">訂單備註</span><input type="text" data-pn="${i}" value="${escapeAttr(b.text||'')}"></div>`).join('');
  box.innerHTML=html;
  box.querySelectorAll('[data-pf]').forEach(inp=>inp.oninput=()=>{ rows[+inp.dataset.pf].value=inp.value; posPreview(); scheduleSave(); });
  box.querySelectorAll('[data-pn]').forEach(inp=>inp.oninput=()=>{ notes[+inp.dataset.pn].text=inp.value; posPreview(); scheduleSave(); });
}
function posItems(){ return POS.cart.filter(c=>c.qty>0).map(c=>({id:nid(),name:c.name,qty:c.qty,price:c.price,desc:'',children:c.child?[{id:nid(),name:c.child.name,price:c.child.price}]:[]})); }
function posFlash(msg){ const h=$('#posCopyHint'); if(!h)return; if(posFlash._o==null)posFlash._o=h.textContent; h.textContent=msg; clearTimeout(posFlash._t); posFlash._t=setTimeout(()=>{ h.textContent=posFlash._o; },1800); }
function posPreview(){
  const img=$('#posPreviewImg'); if(!img || $('#posView').classList.contains('hidden')) return;
  const saved=S.items; _noSave=true; S.items=posItems(); render(1); _noSave=false;
  img.src=cv.toDataURL('image/png');
  S.items=saved;   // 還原編輯區資料(畫布在收銀畫面隱藏,切回時會重繪)
}
function posCopyImage(){
  const saved=S.items; _noSave=true; S.items=posItems(); render(1); _noSave=false;
  cv.toBlob(b=>{
    if(b && navigator.clipboard && window.ClipboardItem){
      navigator.clipboard.write([new ClipboardItem({'image/png':b})]).then(()=>posFlash('已複製到剪貼簿 ✓'),()=>posFlash('複製失敗,請改用「輸出 PNG」'));
    } else posFlash('此瀏覽器不支援複製圖片,請用「輸出 PNG」');
    S.items=saved;
  },'image/png');
}
function posExport(){
  const saved=S.items; _noSave=true; S.items=posItems(); render(1); _noSave=false;
  cv.toBlob(b=>{ dl(b,'png'); S.items=saved; },'image/png');
}

// ── 交易紀錄 / 今日收銀 ──
function pad4(n){ return String(n).padStart(4,'0'); }
function posToast(msg){ const el=$('#posToast'); if(!el)return; el.textContent=msg; el.classList.add('show'); clearTimeout(posToast._t); posToast._t=setTimeout(()=>el.classList.remove('show'),1800); }
function saveTx(){ try{ localStorage.setItem(POS_TX_KEY, JSON.stringify(POS.tx)); }catch(e){ alert('交易紀錄儲存空間不足。'); } }
function todayKey(){ return new Date().toLocaleDateString(); }
function todayTx(){ const d=todayKey(); return POS.tx.filter(t=>t.date===d); }
function recordTx(){
  const cart=POS.cart.filter(c=>c.qty>0);
  if(!cart.length){ alert('購物車是空的,請先選擇商品。'); return; }
  const now=new Date(), date=todayKey();
  const items=cart.map(c=>{ const p=POS.catalog.find(x=>x.id===c.id); const cat=p?(p.cat||''):''; const lt=posLineTotal(c); const cut=+POS.catCut[cat]||0; return {name:c.name,cat,qty:c.qty,child:c.child?c.child.name:'',lineTotal:lt,commission:lt*cut/100}; });
  const total=items.reduce((a,i)=>a+i.lineTotal,0), commission=items.reduce((a,i)=>a+i.commission,0);
  const fields=posFieldRows().map(r=>({label:r.label||'',value:r.value||''}));
  const note=S.blocks.filter(b=>b.type==='note').map(b=>(b.text||'').trim()).filter(Boolean).join(' / ');
  const tip=+($('#posTip')&&$('#posTip').value)||0;   // 小費不列入店家抽成
  const seq=todayTx().length+1;
  POS.tx.push({id:'tx'+now.getTime(),seq,date,time:now.toTimeString().slice(0,5),ts:now.getTime(),items,fields,note,total,commission,net:total-commission,tip});
  saveTx(); POS.cart=[]; renderCart(); if($('#posTip'))$('#posTip').value='';
  posToast('紀錄成功 · 流水號 '+pad4(seq));
}
let ledgerGroup='', ledgerSort='_time', ledgerDir='desc';
function ledgerLabels(){ const out=[]; todayTx().forEach(t=>t.fields.forEach(f=>{ if(f.label&&!out.includes(f.label))out.push(f.label); })); return out; }
function txField(t,l){ const f=t.fields.find(x=>x.label===l); return f?f.value:''; }
function txSum(arr){ return arr.reduce((s,t)=>({n:s.n+1,tot:s.tot+t.total,com:s.com+t.commission,net:s.net+t.net,tip:s.tip+(+t.tip||0)}),{n:0,tot:0,com:0,net:0,tip:0}); }
function txDetail(t){
  let h=t.items.map(i=>`<div class="lg-li"><span>${escapeHtml(i.name)}${i.child?' · '+escapeHtml(i.child):''} ×${i.qty}</span><span>${money(i.lineTotal)}</span></div>`).join('');
  h+=t.fields.filter(f=>f.value).map(f=>`<div class="lg-f">${escapeHtml(f.label)}:${escapeHtml(f.value)}</div>`).join('');
  if(t.note) h+=`<div class="lg-f">備註:${escapeHtml(t.note)}</div>`;
  if(+t.tip) h+=`<div class="lg-li"><span>小費</span><span>${money(t.tip)}</span></div>`;
  h+=`<div class="lg-li lg-sum"><span>店家抽成 ${money(t.commission)}</span><span>淨額 ${money(t.net)}</span></div>`;
  return h;
}
function txRow(t){ return `<div class="lg-txh" data-tx="${t.id}"><b>#${pad4(t.seq)}</b><span class="lg-t">${t.time}</span><span class="lg-amt">${money(t.total)}</span><span class="lg-chev">▾</span></div><div class="lg-txd">${txDetail(t)}</div>`; }
function buildLedgerControls(){
  const labels=ledgerLabels();
  $('#ledgerGroup').innerHTML='<option value="">不分組</option>'+labels.map(l=>`<option value="${escapeAttr(l)}">依「${escapeHtml(l)}」</option>`).join('');
  $('#ledgerSort').innerHTML='<option value="_time">時間 / 流水號</option>'+labels.map(l=>`<option value="${escapeAttr(l)}">「${escapeHtml(l)}」內容</option>`).join('');
  if(ledgerGroup && !labels.includes(ledgerGroup)) ledgerGroup='';
  if(ledgerSort!=='_time' && !labels.includes(ledgerSort)) ledgerSort='_time';
  $('#ledgerGroup').value=ledgerGroup; $('#ledgerSort').value=ledgerSort;
  $('#ledgerDir').textContent=ledgerDir==='desc'?'倒序(新→舊)':'正序(舊→新)';
}
function renderLedger(){
  const list=todayTx().slice(), dir=ledgerDir==='asc'?1:-1;
  list.sort((a,b)=>{ let av,bv; if(ledgerSort==='_time'){av=a.ts;bv=b.ts;}else{av=txField(a,ledgerSort);bv=txField(b,ledgerSort);} if(av<bv)return -dir; if(av>bv)return dir; return (a.ts-b.ts)*dir; });
  const all=txSum(list);
  $('#ledgerStats').innerHTML=`<span>筆數 ${all.n}</span><span>總額 ${money(all.tot)}</span><span>店家抽成 ${money(all.com)}</span><span>扣抽成淨額 ${money(all.net)}</span><span>小費 ${money(all.tip)}</span>`;
  const box=$('#ledgerList');
  if(!list.length){ box.innerHTML='<p class="hint">今日尚無交易。</p>'; return; }
  let out='';
  if(ledgerGroup){
    const groups={}, order=[];
    list.forEach(t=>{ const k=txField(t,ledgerGroup)||'(空白)'; if(!groups[k]){groups[k]=[];order.push(k);} groups[k].push(t); });
    order.forEach(k=>{ const g=groups[k], s=txSum(g);
      out+=`<div class="lg-group">【${escapeHtml(k)}】 ${s.n}筆 · 總額 ${money(s.tot)} · 抽成 ${money(s.com)} · 淨額 ${money(s.net)} · 小費 ${money(s.tip)}</div>`+g.map(txRow).join(''); });
  } else out=list.map(txRow).join('');
  box.innerHTML=out;
  box.querySelectorAll('[data-tx]').forEach(h=>h.onclick=()=>{ const d=h.nextElementSibling; if(d&&d.classList.contains('lg-txd'))d.classList.toggle('open'); });
}
function openLedger(){ buildLedgerControls(); renderLedger(); $('#posLedger').classList.remove('hidden'); }
// 依目前「分組依據」彙總;未分組時依商品分類
function ledgerGroups(){
  const list=todayTx();
  if(ledgerGroup){
    const map={}, order=[];
    list.forEach(t=>{ const k=txField(t,ledgerGroup)||'(空白)'; if(!map[k]){map[k]=[];order.push(k);} map[k].push(t); });
    return order.map(k=>{ const s=txSum(map[k]); return {label:k,n:s.n,tot:s.tot,com:s.com,net:s.net,tip:s.tip}; });
  }
  const map={}, order=[];
  list.forEach(t=>t.items.forEach(i=>{ const c=i.cat||'未分類'; if(!map[c]){map[c]={tot:0,com:0};order.push(c);} map[c].tot+=i.lineTotal; map[c].com+=i.commission; }));
  return order.map(c=>({label:c,n:null,tot:map[c].tot,com:map[c].com,net:map[c].tot-map[c].com,tip:null}));
}
function ledgerTxt(){
  const list=todayTx(); if(!list.length){ alert('今日尚無交易。'); return; }
  const all=txSum(list), LINE='--------------------------', groups=ledgerGroups();
  const out=['今日收銀 · '+todayKey()+'  ('+all.n+' 筆)', LINE]
    .concat(groups.map(g=>g.label+'    小計 '+money(g.tot)))
    .concat([LINE, '合計 '+money(all.tot)+'   店家抽成 '+money(all.com)+'   淨額 '+money(all.net)]);
  if(all.tip) out.push('小費 '+money(all.tip));
  $('#ledgerTxtPre').textContent=out.join('\n');
  $('#ledgerTxtModal').classList.remove('hidden');
}
function ledgerTable(){
  const list=todayTx(); if(!list.length){ alert('今日尚無交易。'); return; }
  const all=txSum(list), groups=ledgerGroups(), col0=ledgerGroup?('依「'+ledgerGroup+'」'):'商品分類';
  let h='<div class="stat-head">今日收銀 · '+todayKey()+'</div>';
  h+='<table class="stat-tbl"><thead><tr><th>'+escapeHtml(col0)+'</th><th>筆數</th><th>總額</th><th>店家抽成</th><th>淨額</th><th>小費</th></tr></thead><tbody>';
  groups.forEach(g=>{ h+='<tr><td>'+escapeHtml(g.label)+'</td><td>'+(g.n==null?'—':g.n)+'</td><td>'+money(g.tot)+'</td><td>'+money(g.com)+'</td><td>'+money(g.net)+'</td><td>'+(g.tip==null?'—':money(g.tip))+'</td></tr>'; });
  h+='</tbody><tfoot><tr><th>合計</th><td>'+all.n+'</td><td>'+money(all.tot)+'</td><td>'+money(all.com)+'</td><td>'+money(all.net)+'</td><td>'+money(all.tip)+'</td></tr></tfoot></table>';
  $('#ledgerTableBox').innerHTML=h;
  $('#ledgerTableModal').classList.remove('hidden');
}
function setView(v){
  segPick($('#viewSeg'),v);
  document.querySelector('main').classList.toggle('hidden', v!=='edit');
  $('#posView').classList.toggle('hidden', v!=='pos');
  if(v==='pos'){ renderPosGrid(); renderPosFields(); renderCart(); }
  else if(previewing) exitPreview();   // 切回設計編輯:放棄預覽,回到自己的設計
  else render(1);
}
$('#viewSeg').onclick=e=>{ const b=e.target.closest('button'); if(!b)return; setView(b.dataset.v);
  if(b.dataset.v==='pos'){ try{ if(!localStorage.getItem(POS_GUIDE_KEY)) setTimeout(()=>startTour(TOUR_POS,null,POS_GUIDE_KEY),350); }catch(e){} } };
$('#posManageBtn').onclick=()=>{ renderCatalog(); renderCats(); $('#posMng').classList.remove('hidden'); };
$('#posMngClose').onclick=()=>$('#posMng').classList.add('hidden');
$('#posOptCancel').onclick=()=>$('#posOpt').classList.add('hidden');
$('#posMngTabs').onclick=e=>{ const b=e.target.closest('button'); if(!b)return; segPick($('#posMngTabs'),b.dataset.v); $('#posTabProd').classList.toggle('hidden',b.dataset.v!=='prod'); $('#posTabCat').classList.toggle('hidden',b.dataset.v!=='cat'); };
$('#posAdd').onclick=()=>{ const n=$('#posNewName').value.trim(); if(!n)return; POS.catalog.push({id:nid(),name:n,cat:$('#posNewCat').value,price:+$('#posNewPrice').value||0,children:[]}); $('#posNewName').value=''; $('#posNewPrice').value=''; posSave(); renderCatalog(); renderPosGrid(); };
$('#posAddCat').onclick=()=>{ const n=$('#posNewCatName').value.trim(); if(!n)return; if(!POS.cats.includes(n)){ POS.cats.push(n); if(!POS.catSubs[n])POS.catSubs[n]=[]; } $('#posNewCatName').value=''; posSave(); renderCats(); renderCatalog(); renderPosGrid(); };
$('#posClear').onclick=()=>{ POS.cart=[]; renderCart(); };
$('#posExportPng').onclick=posExport;
$('#posPreviewImg').onclick=posCopyImage;
$('#posRecord').onclick=recordTx;
$('#posLedgerBtn').onclick=openLedger;
$('#ledgerClose').onclick=()=>$('#posLedger').classList.add('hidden');
$('#ledgerGroup').onchange=e=>{ ledgerGroup=e.target.value; renderLedger(); };
$('#ledgerSort').onchange=e=>{ ledgerSort=e.target.value; renderLedger(); };
$('#ledgerDir').onclick=()=>{ ledgerDir=ledgerDir==='asc'?'desc':'asc'; buildLedgerControls(); renderLedger(); };
$('#ledgerClear').onclick=()=>{ if(confirm('清空今日所有交易紀錄?')){ const d=todayKey(); POS.tx=POS.tx.filter(t=>t.date!==d); saveTx(); buildLedgerControls(); renderLedger(); } };
$('#ledgerTableBtn').onclick=ledgerTable;
$('#ledgerTxt').onclick=ledgerTxt;
$('#ledgerTableClose').onclick=()=>$('#ledgerTableModal').classList.add('hidden');
$('#ledgerTxtClose').onclick=()=>$('#ledgerTxtModal').classList.add('hidden');
$('#ledgerTxtCopy').onclick=()=>{ if(navigator.clipboard) navigator.clipboard.writeText($('#ledgerTxtPre').textContent).then(()=>posToast('已複製'),()=>{}); };

// ============ 設計序列化 / 自動儲存 / 我的模板 ============
const CUR_KEY='receipt-current';
let _noSave=false, _saveT=0;
function setSaved(s){ const el=$('#saveStatus'); if(!el)return; el.textContent=s?'✓ 已儲存':'● 尚未儲存'; el.classList.toggle('dirty',!s); }
function scheduleSave(){ setSaved(false); clearTimeout(_saveT); _saveT=setTimeout(()=>{ try{ localStorage.setItem(CUR_KEY, JSON.stringify(serializeDesign())); }catch(e){} setSaved(true); },800); }
function downloadJSON(obj,name){ const blob=new Blob([JSON.stringify(obj)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),2000); }
function serializeDesign(){
  return {
    blocks:S.blocks.map(b=> b.type==='image'? Object.assign({},b,{img:b.img?b.img.src:null}) : b),
    items:S.items, fin:S.fin, type:S.type, sty:S.sty,
    bg:Object.assign({},S.bg,{img:S.bg.img?S.bg.img.src:null, imgOrig:S.bg.imgOrig?S.bg.imgOrig.src:null}),
    design:S.design, quality:S.quality
  };
}
function applyDesignData(d,onReady){
  previewing=false; workBackup=null;
  const imgs=[];
  S.blocks=(d.blocks||[]).map(b=>{
    if(b.type==='image'){ const o=Object.assign({},b,{img:null}); if(b.img){ const im=new Image(); im.src=b.img; o.img=im; imgs.push(im); } return o; }
    return JSON.parse(JSON.stringify(b));
  });
  S.items=(d.items||[]).map(it=>JSON.parse(JSON.stringify(it)));
  S.fin=Object.assign({},d.fin); S.type=Object.assign({},d.type); S.sty=Object.assign({},d.sty);
  S.bg=Object.assign({img:null,imgOrig:null,crop:null,mode:'none',pos:'center',opacity:15,size:40,effect:'none',paperAlpha:100,margin:80}, d.bg||{}, {img:null,imgOrig:null});
  if(d.bg&&d.bg.img){ const im=new Image(); im.src=d.bg.img; S.bg.img=im; imgs.push(im); }
  if(d.bg&&d.bg.imgOrig){ const im=new Image(); im.src=d.bg.imgOrig; S.bg.imgOrig=im; imgs.push(im); }
  else if(S.bg.img){ S.bg.imgOrig=S.bg.img; S.bg.crop=null; }   // 舊資料無原圖時退而用裁切後當原圖
  S.design=d.design||'custom';
  S.quality=d.quality||1;
  buildFontSel(); syncStyleInputs(); syncFin(); syncType();
  segPick($('#qualSeg'),String(S.quality));
  segPick($('#bgModeSeg'),S.bg.mode); segPick($('#bgEffectSeg'),S.bg.effect); bgSyncRows(); bgEditState();
  $('#bgOpacity').value=S.bg.opacity; $('#bgOpacityV').textContent=S.bg.opacity+'%';
  $('#bgSize').value=S.bg.size; $('#bgSizeV').textContent=S.bg.size+'%';
  $('#bgPaperAlpha').value=S.bg.paperAlpha; $('#bgPaperAlphaV').textContent=S.bg.paperAlpha+'%';
  $('#bgMargin').value=S.bg.margin==null?80:S.bg.margin; $('#bgMarginV').textContent=S.bg.margin==null?80:S.bg.margin;
  renderBlocks(); renderItems(); renderPosFields();
  if(blkMode==='text') $('#blockSource').value=serializeBlocks();
  let pending=imgs.filter(im=>!im.complete).length;
  if(!pending){ render(1); if(onReady)onReady(); return; }
  imgs.forEach(im=>{ if(im.complete)return; im.onload=im.onerror=()=>{ render(1); if(--pending<=0 && onReady)onReady(); }; });
  render(1);
}
// ── 統一資料匯出 / 載入(模板 / 商品表 / 今日收銀)──
function importCatalog(c){
  POS.catalog=(c.products||[]).map(p=>({id:nid(),name:p.name||'',price:+p.price||0,cat:p.cat||'',children:(p.children||[]).map(x=>({name:x.name||'',price:x.price}))}));
  POS.cats=Array.isArray(c.cats)?c.cats.slice():[];
  if(!POS.cats.length) POS.catalog.forEach(p=>{ const cc=(p.cat||'').trim(); if(cc&&!POS.cats.includes(cc))POS.cats.push(cc); });
  POS.catSubs=c.catSubs||{}; POS.catCut=c.catCut||{};
  posSave(); renderCatalog(); renderCats(); renderPosGrid();
}
function dataExport(){
  const out={_receipt:1};
  if($('#exTpl').checked) out.template=serializeDesign();
  if($('#exProd').checked) out.catalog={ products:POS.catalog.map(p=>({name:p.name,price:p.price,cat:p.cat||'',children:(p.children||[]).map(c=>({name:c.name,price:c.price}))})), cats:POS.cats, catSubs:POS.catSubs, catCut:POS.catCut };
  if($('#exTx').checked) out.tx=POS.tx;
  if(!out.template && !out.catalog && !out.tx){ alert('請至少勾選一項要匯出的資料。'); return; }
  downloadJSON(out,'receipt-data-'+Date.now()+'.json');
  $('#dataModal').classList.add('hidden');
}
function dataImportFile(file){ if(!file)return; const r=new FileReader();
  r.onload=()=>{ try{ const d=JSON.parse(r.result); const done=[];
    if(d.template&&d.template.blocks){ applyDesignData(d.template); done.push('模板'); }
    else if(d.blocks){ applyDesignData(d); done.push('模板'); }
    if(d.catalog&&Array.isArray(d.catalog.products)){ importCatalog(d.catalog); done.push('商品表'); }
    else if(Array.isArray(d.products)){ importCatalog(d); done.push('商品表'); }
    if(Array.isArray(d.tx)){ POS.tx=d.tx; saveTx(); done.push('收銀紀錄'); }
    if(!done.length){ alert('檔案沒有可載入的資料。'); return; }
    $('#dataModal').classList.add('hidden'); alert('已載入:'+done.join('、'));
  }catch(e){ alert('無法讀取此檔案。'); } };
  r.readAsText(file); }
// 引導式導覽:聚光燈 + 對話框拉出解說
const GUIDE_KEY='receipt-seen-guide', POS_GUIDE_KEY='receipt-seen-pos-guide';
const TOUR_EDIT=[
  {sel:'#viewSeg', text:'這裡切換 <b>設計編輯</b> 與 <b>收銀</b> 兩種模式。', pos:'bottom'},
  {sel:'#designSeg', text:'點預設模板會<b>即時預覽</b>；按右側「<b>套用</b>」才真正覆蓋目前設計，切回「設計編輯」可放棄預覽。', pos:'bottom'},
  {sel:'#colLeft', text:'左欄：金額與付款、<b>外觀</b>（紙張效果 / 紋理 / 圓角 / 不透明度）、<b>背景圖片</b>、文字樣式。', pos:'right'},
  {sel:'.center', text:'中間是即時預覽，<b>滑鼠滾輪可縮放</b>，所見即所得；下方控制列可<b>輸出 PNG / 列印 MP4</b>。', pos:'left'},
  {sel:'#colBlocks', text:'版面區塊：拖曳 <b>⋮⋮</b> 排序、點標題收合；可切「<b>區塊 / 純文字</b>」用語法快速排版（# 大標、- 分隔線、[品項] [金額] [備註]…）。', pos:'left'},
  {sel:'#colRight', text:'品項區：品名 / 數量 / 單價，可加子項目；收銀模式會用到這些商品。', pos:'left'},
  {sel:'#dataBtn', text:'<b>資料</b>：勾選模板 / 商品表 / 今日收銀，一鍵匯出或載入備份。完成後可隨時點右上的 <b>i</b> 重看導覽。', pos:'bottom'},
];
const TOUR_POS=[
  {sel:'#posManageBtn', text:'先按「<b>管理</b>」建立商品與分類；在「<b>類別編輯</b>」可設每個分類的<b>共用子項目</b>與<b>店家抽成 %</b>。', pos:'bottom'},
  {sel:'#posGrid', text:'點商品即可<b>加入購物車</b>；商品若有子項目會跳出選擇（可選「無」）。上方可依<b>分類</b>篩選。', pos:'right'},
  {sel:'.pos-cart', text:'購物車顯示明細與<b>合計</b>；可手動填「<b>收據資訊</b>」（日期 / 單號）、<b>訂單備註</b>，以及本筆<b>小費</b>。', pos:'left'},
  {sel:'#posRecord', text:'按「<b>紀錄本筆交易</b>」把這筆存入今日收銀（也可另外輸出 PNG）。', pos:'top'},
  {sel:'.pos-preview', text:'右側即時預覽收據；<b>點圖可複製</b>，或按「<b>輸出 PNG</b>」下載。', pos:'left'},
  {sel:'#posLedgerBtn', text:'「<b>今日收銀</b>」看統計（總額 / 店家抽成 / 淨額 / 小費），可依<b>資訊欄位分組、排序</b>，並用<b>表格</b>或<b>純文字</b>彈窗截圖 / 複製。', pos:'top'},
];
let tourIdx=0, tourSteps=TOUR_EDIT, tourKey=GUIDE_KEY;
function tourShow(){
  const step=tourSteps[tourIdx], el=document.querySelector(step.sel);
  if(!el || (!el.offsetWidth && !el.offsetHeight)){ if(tourIdx<tourSteps.length-1){ tourIdx++; return tourShow(); } return tourEnd(); }
  const r=el.getBoundingClientRect(), pad=8, spot=$('#tourSpot');
  spot.style.left=(r.left-pad)+'px'; spot.style.top=(r.top-pad)+'px'; spot.style.width=(r.width+pad*2)+'px'; spot.style.height=(r.height+pad*2)+'px';
  const bub=$('#tourBubble'); bub.querySelector('.tour-text').innerHTML=step.text;
  $('#tourStepNo').textContent=(tourIdx+1)+' / '+tourSteps.length;
  $('#tourPrev').style.visibility=tourIdx?'visible':'hidden';
  $('#tourNext').textContent=tourIdx===tourSteps.length-1?'完成':'下一步';
  $('#tour').classList.remove('hidden');
  tourPos(bub,r,step.pos);
}
function tourPos(bub,r,pos){
  bub.style.left='-9999px'; bub.style.top='0px';
  const bw=bub.offsetWidth, bh=bub.offsetHeight, gap=14, vw=innerWidth, vh=innerHeight; let left,top,arrow;
  if(pos==='right'){ left=r.right+gap; top=r.top; arrow='left'; }
  else if(pos==='left'){ left=r.left-gap-bw; top=r.top; arrow='right'; }
  else if(pos==='top'){ left=r.left; top=r.top-gap-bh; arrow='bottom'; }
  else { left=r.left; top=r.bottom+gap; arrow='top'; }
  left=Math.max(12,Math.min(left,vw-bw-12)); top=Math.max(12,Math.min(top,vh-bh-12));
  bub.style.left=left+'px'; bub.style.top=top+'px'; bub.dataset.arrow=arrow;
}
function startTour(steps,view,key){ tourSteps=steps; tourKey=key; tourIdx=0; if(view) setView(view); requestAnimationFrame(()=>requestAnimationFrame(tourShow)); }
function tourEnd(){ $('#tour').classList.add('hidden'); try{ localStorage.setItem(tourKey,'1'); }catch(e){} }
function tourNext(){ if(tourIdx<tourSteps.length-1){ tourIdx++; tourShow(); } else tourEnd(); }
function tourPrev(){ if(tourIdx>0){ tourIdx--; tourShow(); } }
$('#helpBtn').onclick=()=>{ (!$('#posView').classList.contains('hidden')) ? startTour(TOUR_POS,'pos',POS_GUIDE_KEY) : startTour(TOUR_EDIT,'edit',GUIDE_KEY); };
$('#tourSkip').onclick=tourEnd;
$('#tourPrev').onclick=tourPrev;
$('#tourNext').onclick=tourNext;
$('#tour').onclick=e=>{ if(e.target.id==='tour') tourNext(); };   // 點暗區=下一步
document.addEventListener('keydown',e=>{ if($('#tour').classList.contains('hidden'))return; if(e.key==='Escape')tourEnd(); else if(e.key==='ArrowRight'||e.key==='Enter')tourNext(); else if(e.key==='ArrowLeft')tourPrev(); });
window.addEventListener('resize',()=>{ if(!$('#tour').classList.contains('hidden')) tourShow(); });
try{ if(!localStorage.getItem(GUIDE_KEY)) setTimeout(()=>startTour(TOUR_EDIT,'edit',GUIDE_KEY),400); }catch(e){}
$('#dataBtn').onclick=()=>$('#dataModal').classList.remove('hidden');
$('#loadBtn').onclick=()=>$('#dataFile').click();
$('#dataClose').onclick=()=>$('#dataModal').classList.add('hidden');
$('#dataExportBtn').onclick=dataExport;
$('#dataImport').onclick=()=>$('#dataFile').click();
$('#dataFile').onchange=e=>{ if(e.target.files[0]) dataImportFile(e.target.files[0]); e.target.value=''; };

// init
posLoad();
buildAddMenu();
buildFontSel();
buildTexSel();
try{ const cur=JSON.parse(localStorage.getItem(CUR_KEY)); if(cur&&cur.blocks){ applyDesignData(cur); } else { applyDesign('tailor'); } }catch(e){ applyDesign('tailor'); }
segPick($('#uiSeg'), localStorage.getItem(UI_KEY)||'std', v=>document.body.dataset.ui=v);
loadFonts(); render(1);
