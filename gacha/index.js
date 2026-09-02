/* ═══════════ Gacha Studio · 抽卡演出模擬器 ═══════════
   畫面上看到的就是影片內容:預覽與錄製共用同一個 render(ctx, t)。
   render 是純函式 — 同樣的 S + 同樣的 t 一定畫出同一格。
   所有隨機(粒子、裂紋、碎片)由 seed 解析算出,render 路徑內不出現 Math.random()。
   演出順序:charge → omen → burst → [line, reveal] × N → summary
   ══════════════════════════════════════════════════════ */

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const PRESETS = { "9:16": [1080, 1920], "1:1": [1080, 1080], "16:9": [1920, 1080] };
const UI_KEY = "gacha-ui-scale";     // 只記介面縮放偏好,演出資料一律走 JSON 存讀檔
const MAX_SIDE = 2048;               // 超大圖上傳時等比縮到長邊這個值

const cv = $("#stage");
const ctx = cv.getContext("2d");

/* ═══════════ 狀態 ═══════════ */
const S = {
  canvas: { preset: "9:16", w: 1080, h: 1920 },
  seed: 20260902,
  bg: { type: "color", color: "#0A0812", img: null, imgSrc: null, imgName: "", vignette: 0.6 },

  // 卡片庫:{ id, name, fileName, rarityId, img, imgSrc, crop, isNew, line }
  cards: [],

  rarities: [
    { id: "R",   label: "R",   color: "#8FA3B8", glow: "#B9CBDC", burst: "beam",    dur: 1.2 },
    { id: "SR",  label: "SR",  color: "#B58CE0", glow: "#DCC4F5", burst: "beam",    dur: 2.2 },
    { id: "SSR", label: "SSR", color: "#F0C24B", glow: "#FFE9A8", burst: "shatter", dur: 4.0 },
    { id: "UR",  label: "UR",  color: "rainbow", glow: "#FFFFFF", burst: "shatter", dur: 5.5 }
  ],

  // 本次抽卡序列:{ cardId, omenLevel: 0|1|2|"auto" }
  sequence: [],

  flow: {
    mode: "batch",
    stages: {
      charge:  { on: true, dur: 1.6, shape: "cardback" },
      omen:    { on: true, dur: 1.4 },
      burst:   { on: true, dur: 0.9 },
      line:    { on: true, dur: 2.2 },
      reveal:  { on: true, dur: 2.4, blurBg: true, blur: 35, blurDim: 46 },
      summary: { on: true, dur: 3.0 }
    }
  },

  export: { fps: 30 }
};

let TL = { total: 0, segs: [], items: [] };
let playing = false, playT = 0, anchor = 0, dirty = true;
let recording = false, recorder = null, recChunks = [], recMime = "";

/* ═══════════ 確定性亂數 ═══════════ */
function mulberry32(a){
  return function(){
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
/* 解析式雜湊:給 (i, k) 直接得出 [0,1),不需要保存狀態 */
function hash01(i, k){
  let t = (S.seed * 374761393 + i * 668265263 + (k || 0) * 2246822519) >>> 0;
  t = Math.imul(t ^ t >>> 13, 1274126177) >>> 0;
  return ((t ^ t >>> 16) >>> 0) / 4294967296;
}
/* 裂紋 / 碎片這種要一整組的,依 seed 先算好並快取 */
let fxCache = { seed: null, cracks: [], shards: [] };
function fx(){
  if(fxCache.seed === S.seed) return fxCache;
  const rnd = mulberry32(S.seed >>> 0);
  const cracks = [];
  const n = 8 + Math.floor(rnd() * 7);
  for(let i = 0; i < n; i++){
    const a0 = rnd() * Math.PI * 2, pts = [];
    let a = a0, r = 0.02 + rnd() * .04;
    const steps = 4 + Math.floor(rnd() * 4);
    for(let s = 0; s < steps; s++){
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
      a += (rnd() - .5) * .5;
      r += .12 + rnd() * .18;
    }
    cracks.push(pts);
  }
  const shards = [];
  const m = 10 + Math.floor(rnd() * 5);
  for(let i = 0; i < m; i++){
    const a0 = (i / m) * Math.PI * 2 + rnd() * .12;
    shards.push({ a0, a1: a0 + (Math.PI * 2 / m) * (.7 + rnd() * .5), spd: .7 + rnd() * .8, spin: (rnd() - .5) * .9 });
  }
  fxCache = { seed: S.seed, cracks, shards };
  return fxCache;
}

/* ═══════════ 小工具 ═══════════ */
function uid(){ return Math.random().toString(36).slice(2, 9); }   // 只用在建立資料,不在 render 路徑
function clamp(v, a, b){ return v < a ? a : v > b ? b : v; }
function lerp(a, b, t){ return a + (b - a) * t; }
function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }
function easeOutBack(t){ const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }

function loadImage(src){
  return new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
}
function readFile(file){
  return new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(file); });
}
async function decodeImage(src){
  const im = await loadImage(src);
  if(!im) return null;
  const max = Math.max(im.width, im.height);
  if(!window.createImageBitmap) return im;
  if(max > 4096){
    const k = MAX_SIDE / max;
    return await createImageBitmap(im, { resizeWidth: Math.round(im.width * k), resizeHeight: Math.round(im.height * k), resizeQuality: "high" });
  }
  return await createImageBitmap(im);
}
function roundRectOn(c, x, y, w, h, r){
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function roundRect(x, y, w, h, r){ roundRectOn(ctx, x, y, w, h, r); }
function coverDraw(img, x, y, w, h){
  if(!img) return;
  const ir = img.width / img.height, r = w / h;
  let sw, sh, sx, sy;
  if(ir > r){ sh = img.height; sw = sh * r; sx = (img.width - sw) / 2; sy = 0; }
  else { sw = img.width; sh = sw / r; sx = 0; sy = (img.height - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}
/* 卡片滿版:cover 塞滿框,再套上這張卡自己的縮放 / 位移(crop)
   只讀 crop、不改寫它,render 才能保持純函式 */
function drawCropped(c, img, x, y, w, h, crop){
  if(!img) return;
  const z = crop && crop.zoom ? crop.zoom : 1;
  const k = Math.max(w / img.width, h / img.height) * z;
  const dw = img.width * k, dh = img.height * k;
  const mx = Math.max(0, (dw - w) / 2), my = Math.max(0, (dh - h) / 2);
  const ox = clamp((crop && crop.x || 0) * w, -mx, mx);
  const oy = clamp((crop && crop.y || 0) * h, -my, my);
  c.drawImage(img, x + (w - dw) / 2 + ox, y + (h - dh) / 2 + oy, dw, dh);
}
function defaultCrop(){ return { zoom: 1, x: 0, y: 0 }; }
/* 滿版模糊底:優先用 ctx.filter,不支援時退回縮圖再放大 */
let blurCv = null;
function drawBlurred(img, W, H, radius){
  const ov = 1 + (radius * 2) / Math.min(W, H) + .08;   // 放大一點,蓋掉模糊後的透明邊
  const ox = -W * (ov - 1) / 2, oy = -H * (ov - 1) / 2;
  if(ctx.filter !== undefined){
    ctx.save();
    ctx.filter = "blur(" + radius + "px)";
    coverDraw(img, ox, oy, W * ov, H * ov);
    ctx.restore();
    return;
  }
  if(!blurCv) blurCv = document.createElement("canvas");
  const k = Math.max(8, Math.round(radius / 2));
  blurCv.width = Math.max(2, Math.round(W / k));
  blurCv.height = Math.max(2, Math.round(H / k));
  const bx = blurCv.getContext("2d");
  const ir = img.width / img.height, r = blurCv.width / blurCv.height;
  let sw, sh, sx, sy;
  if(ir > r){ sh = img.height; sw = sh * r; sx = (img.width - sw) / 2; sy = 0; }
  else { sw = img.width; sh = sw / r; sx = 0; sy = (img.height - sh) / 2; }
  bx.drawImage(img, sx, sy, sw, sh, 0, 0, blurCv.width, blurCv.height);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(blurCv, ox, oy, W * ov, H * ov);
  ctx.restore();
}
function wrapText(text, maxW){
  const out = [];
  for(const para of String(text).split("\n")){
    let cur = "";
    for(const ch of para){
      if(ctx.measureText(cur + ch).width > maxW && cur){ out.push(cur); cur = ch; }
      else cur += ch;
    }
    out.push(cur);
  }
  return out;
}
function rainbowGrad(x0, y0, x1, y1, t){
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for(let i = 0; i <= 6; i++) g.addColorStop(i / 6, "hsl(" + ((i * 60 + t * 120) % 360) + ",85%,66%)");
  return g;
}
function paint(rar, x0, y0, x1, y1, t){
  return rar.color === "rainbow" ? rainbowGrad(x0, y0, x1, y1, t) : rar.color;
}
function hexA(hex, a){
  const h = String(hex || "#ffffff").replace("#", "");
  const n = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  const v = parseInt(n, 16) || 0xffffff;
  return "rgba(" + (v >> 16 & 255) + "," + (v >> 8 & 255) + "," + (v & 255) + "," + a + ")";
}
function solid(rar){ return rar.color === "rainbow" ? "#E9D9FF" : rar.color; }

/* ═══════════ 資料查詢 ═══════════ */
const FALLBACK_RARITY = { id: "-", label: "-", color: "#8FA3B8", glow: "#B9CBDC", burst: "beam", dur: 2.0 };
function cardOf(id){ return S.cards.find(c => c.id === id) || null; }
function rarityOf(id){ return S.rarities.find(r => r.id === id) || S.rarities[0] || FALLBACK_RARITY; }
function autoOmen(rarityId){
  const i = S.rarities.findIndex(r => r.id === rarityId);
  return i <= 0 ? 0 : (i === 1 ? 1 : 2);
}
function hasLine(card){ return !!String(card.line || "").trim(); }

/* ═══════════ 時間軸 ═══════════ */
function buildTimeline(){
  const st = S.flow.stages, segs = [];
  let t = 0;
  const items = S.sequence.map(e => {
    const c = cardOf(e.cardId);
    if(!c) return null;
    const r = rarityOf(c.rarityId);
    const lvl = e.omenLevel === "auto" || e.omenLevel === undefined ? autoOmen(c.rarityId) : clamp(+e.omenLevel, 0, 2);
    return { card: c, rar: r, lvl };
  }).filter(Boolean);
  if(!items.length) return { total: 0, segs: [], items: [] };

  function push(kind, dur, extra){
    const d = Math.max(.1, +dur || 0);
    segs.push(Object.assign({ kind: kind, t0: t, t1: t + d }, extra || {}));
    t += d;
  }
  function opening(it){
    const lvl = it ? it.lvl : items.reduce((m, x) => Math.max(m, x.lvl), 0);
    const rar = it ? it.rar : items.reduce((m, x) => x.lvl >= m.lvl ? x : m, items[0]).rar;
    if(st.charge.on) push("charge", st.charge.dur, { lvl, rar });
    if(st.omen.on) push("omen", st.omen.dur, { lvl, rar });
    if(st.burst.on) push("burst", st.burst.dur, { lvl, rar });
  }

  if(S.flow.mode === "batch") opening(null);
  items.forEach((it, i) => {
    if(S.flow.mode === "perCard") opening(it);
    if(st.line.on && hasLine(it.card)) push("line", st.line.dur, { i, rar: it.rar });
    if(st.reveal.on) push("reveal", it.rar.dur || st.reveal.dur, { i, rar: it.rar });
  });
  if(st.summary.on && items.length > 1) push("summary", st.summary.dur, {});

  return { total: t, segs, items };
}
function segAt(t){
  for(const s of TL.segs) if(t < s.t1) return s;
  return TL.segs[TL.segs.length - 1];
}
const STAGE_NAME = { charge: "蓄力", omen: "預兆", burst: "爆發", line: "台詞", reveal: "卡片", summary: "一覽" };

/* ═══════════ 背景 ═══════════ */
function drawBg(W, H, extraVig){
  if(S.bg.type === "image" && S.bg.img){ coverDraw(S.bg.img, 0, 0, W, H); }
  else { ctx.fillStyle = S.bg.color; ctx.fillRect(0, 0, W, H); }
  const v = clamp(S.bg.vignette + (extraVig || 0), 0, 1);
  if(v > 0){
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .18, W / 2, H / 2, Math.max(W, H) * .72);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0," + v + ")");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}

/* ═══════════ 段落:charge 蓄力 ═══════════ */
function drawShape(shape, cx, cy, base, t, tint){
  ctx.save();
  ctx.translate(cx, cy);
  if(shape === "orb"){
    const g = ctx.createRadialGradient(0, -base * .12, base * .06, 0, 0, base * .62);
    g.addColorStop(0, hexA(tint, .95));
    g.addColorStop(.55, hexA(tint, .32));
    g.addColorStop(1, hexA(tint, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, base * .62, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = hexA(tint, .55); ctx.lineWidth = base * .012;
    ctx.beginPath(); ctx.arc(0, 0, base * .40, 0, Math.PI * 2); ctx.stroke();
  } else if(shape === "circle"){
    ctx.rotate(t * .5);
    ctx.strokeStyle = hexA(tint, .5); ctx.lineWidth = base * .012;
    [.34, .48, .62].forEach((r, i) => {
      ctx.beginPath(); ctx.arc(0, 0, base * r, 0, Math.PI * 2); ctx.stroke();
      ctx.save(); ctx.rotate(i % 2 ? -t * .8 : t * .8);
      for(let k = 0; k < 12; k++){
        const a = k * Math.PI / 6;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * base * r, Math.sin(a) * base * r);
        ctx.lineTo(Math.cos(a) * base * (r + .05), Math.sin(a) * base * (r + .05));
        ctx.stroke();
      }
      ctx.restore();
    });
  } else {
    const w = base * .82, h = w * 1.4;
    const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    g.addColorStop(0, "#2A2740"); g.addColorStop(1, "#15131F");
    roundRect(-w / 2, -h / 2, w, h, w * .07);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = hexA(tint, .7); ctx.lineWidth = w * .018; ctx.stroke();
    ctx.strokeStyle = hexA(tint, .35); ctx.lineWidth = w * .008;
    ctx.beginPath();
    ctx.moveTo(0, -h * .30); ctx.lineTo(w * .22, 0); ctx.lineTo(0, h * .30); ctx.lineTo(-w * .22, 0);
    ctx.closePath(); ctx.stroke();
  }
  ctx.restore();
}
function drawParticles(cx, cy, base, t, count, color, alphaK){
  for(let i = 0; i < count; i++){
    const ang = i * 2.399963 + t * .8;
    const rad = base * (.9 + Math.sin(t * 2 + i) * .12) + hash01(i, 1) * base * .55;
    const r = base * (.012 + hash01(i, 2) * .022);
    ctx.globalAlpha = alphaK * (.22 + hash01(i, 3) * .6);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function stageCharge(W, H, p, t, seg, fade){
  const base = Math.min(W, H) * .28;
  const sc = lerp(.6, 1, easeOutBack(clamp(p / .55, 0, 1))) * (1 + Math.sin(t * 3) * .02);
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(W / 2, H / 2); ctx.scale(sc, sc); ctx.translate(-W / 2, -H / 2);
  drawShape(S.flow.stages.charge.shape, W / 2, H / 2, base, t, "#C8D4E4");
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = fade;
  drawParticles(W / 2, H / 2, base, t, 36, "#C8D4E4", fade * .8 * clamp(p / .3, 0, 1));
  ctx.restore();
}

/* ═══════════ 段落:omen 預兆 ═══════════ */
const OMEN = [
  { color: "#C8D4E4", count: 24 },
  { color: "#B58CE0", count: 48 },
  { color: null,      count: 80 }
];
function stageOmen(W, H, p, t, seg, fade){
  const lv = clamp(seg.lvl || 0, 0, 2);
  const cfg = OMEN[lv];
  const color = cfg.color || solid(seg.rar);
  const base = Math.min(W, H) * .28;

  if(lv >= 1){
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * .6);
    g.addColorStop(0, hexA(color, .26 * fade * easeOutCubic(p)));
    g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  ctx.save();
  ctx.globalAlpha = fade;
  drawShape(S.flow.stages.charge.shape, W / 2, H / 2, base * (1 + p * .06), t, color);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = fade;
  drawParticles(W / 2, H / 2, base, t, cfg.count, color, fade * .9);
  ctx.restore();

  if(lv >= 2){
    // 多圈同心展開
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.strokeStyle = hexA(color, .5);
    for(let k = 0; k < 3; k++){
      const q = (p * 1.6 + k / 3) % 1;
      ctx.globalAlpha = fade * (1 - q) * .7;
      ctx.lineWidth = Math.min(W, H) * .006;
      ctx.beginPath(); ctx.arc(W / 2, H / 2, base * (.5 + q * 1.5), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
    // 螢幕裂紋
    const cr = fx().cracks, R = Math.max(W, H);
    ctx.save();
    ctx.globalAlpha = fade * clamp((p - .25) / .3, 0, 1) * .8;
    ctx.strokeStyle = hexA(color, .9);
    ctx.lineWidth = Math.min(W, H) * .0035;
    cr.forEach(pts => {
      ctx.beginPath();
      ctx.moveTo(W / 2, H / 2);
      pts.forEach(pt => ctx.lineTo(W / 2 + pt[0] * R, H / 2 + pt[1] * R));
      ctx.stroke();
    });
    ctx.restore();
    // 0.08s 白閃 ×2
    const d = Math.max(.0001, seg.t1 - seg.t0), fw = .08 / d;
    if((p > .34 && p < .34 + fw) || (p > .62 && p < .62 + fw)){
      ctx.fillStyle = "rgba(255,255,255,.82)"; ctx.fillRect(0, 0, W, H);
    }
  }
}

/* ═══════════ 段落:burst 爆發 ═══════════ */
function stageBurst(W, H, p, t, seg, fade){
  const rar = seg.rar || FALLBACK_RARITY;
  const R = Math.max(W, H);
  if(p < .06){ ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.fillRect(0, 0, W, H); return; }

  if(rar.burst === "shatter"){
    const f = fx();
    const e = easeOutCubic(clamp((p - .06) / .5, 0, 1));
    // 裂紋
    ctx.save();
    ctx.globalAlpha = fade * (1 - e * .6);
    ctx.strokeStyle = paint(rar, 0, 0, W, H, t);
    ctx.lineWidth = Math.min(W, H) * .004;
    f.cracks.forEach(pts => {
      ctx.beginPath(); ctx.moveTo(W / 2, H / 2);
      pts.forEach(pt => ctx.lineTo(W / 2 + pt[0] * R, H / 2 + pt[1] * R));
      ctx.stroke();
    });
    ctx.restore();
    // 碎片向外飛散
    ctx.save();
    ctx.globalAlpha = fade * (1 - e);
    f.shards.forEach((sh, i) => {
      const mid = (sh.a0 + sh.a1) / 2, off = e * R * .55 * sh.spd;
      ctx.save();
      ctx.translate(W / 2 + Math.cos(mid) * off, H / 2 + Math.sin(mid) * off);
      ctx.rotate(e * sh.spin);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(sh.a0 - mid) * R * .5, Math.sin(sh.a0 - mid) * R * .5);
      ctx.lineTo(Math.cos(sh.a1 - mid) * R * .5, Math.sin(sh.a1 - mid) * R * .5);
      ctx.closePath();
      ctx.fillStyle = "rgba(14,12,22,.72)";
      ctx.fill();
      ctx.strokeStyle = paint(rar, -R * .3, -R * .3, R * .3, R * .3, t);
      ctx.lineWidth = Math.min(W, H) * .003;
      ctx.stroke();
      ctx.restore();
    });
    ctx.restore();
    // 底下透出的光
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, R * .62 * e);
    g.addColorStop(0, hexA(rar.glow, .85 * fade * (1 - p * .5)));
    g.addColorStop(1, hexA(rar.glow, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    return;
  }

  // beam:光柱擴散 + 放射線
  const e = easeOutCubic(clamp((p - .06) / .7, 0, 1));
  ctx.save();
  ctx.globalAlpha = fade;
  const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, R * .7 * e);
  g.addColorStop(0, hexA(rar.glow, .9 * (1 - p * .55)));
  g.addColorStop(.5, hexA(solid(rar), .38 * (1 - p * .5)));
  g.addColorStop(1, hexA(solid(rar), 0));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  const bw = lerp(W * .02, W * .34, e);
  ctx.fillStyle = paint(rar, W / 2 - bw, 0, W / 2 + bw, 0, t);
  ctx.globalAlpha = fade * (1 - e) * .8;
  ctx.fillRect(W / 2 - bw / 2, 0, bw, H);

  ctx.globalAlpha = fade * (1 - e * .8);
  ctx.strokeStyle = paint(rar, 0, 0, W, H, t);
  ctx.lineWidth = Math.min(W, H) * .004;
  for(let i = 0; i < 12; i++){
    const a = i * Math.PI / 6 + t * .9;
    ctx.beginPath();
    ctx.moveTo(W / 2 + Math.cos(a) * R * .06, H / 2 + Math.sin(a) * R * .06);
    ctx.lineTo(W / 2 + Math.cos(a) * R * .75 * e, H / 2 + Math.sin(a) * R * .75 * e);
    ctx.stroke();
  }
  ctx.restore();
}

/* ═══════════ 段落:line 台詞 ═══════════ */
/* 台詞:置中、可換行、逐字顯示。框的大小用完整台詞先算好,打字時不會跳動 */
const LINE_MAX_ROWS = 8;
function stageLine(W, H, p, t, seg, fade){
  const it = TL.items[seg.i];
  if(!it) return;
  const txt = String(it.card.line || "");
  if(!txt.trim()) return;
  const rar = seg.rar || FALLBACK_RARITY;
  const pad = W * .06, boxW = W - pad * 2, inner = boxW - W * .08;

  ctx.save();
  ctx.globalAlpha = fade;
  ctx.font = "400 " + (H * .034) + "px 'Noto Serif TC','Songti TC',serif";
  const rows = Math.min(wrapText(txt, inner).length, LINE_MAX_ROWS);
  const lh = H * .054, boxH = rows * lh + H * .056;
  const by = (H - boxH) / 2;

  roundRect(pad, by, boxW, boxH, W * .018);
  ctx.fillStyle = "rgba(9,8,15,.70)"; ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.14)"; ctx.lineWidth = Math.max(1, W * .0016); ctx.stroke();
  // 上緣一條稀有度細線
  ctx.fillStyle = paint(rar, pad, 0, pad + boxW, 0, t);
  ctx.fillRect(pad + W * .018, by, boxW - W * .036, Math.max(1.5, H * .0022));

  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,255,255,.95)";
  const shown = txt.slice(0, Math.floor(txt.length * clamp(p / .6, 0, 1)));
  wrapText(shown, inner).slice(0, LINE_MAX_ROWS)
    .forEach((s, i) => ctx.fillText(s, W / 2, by + H * .028 + lh / 2 + i * lh));
  ctx.restore();
}

/* ═══════════ 段落:reveal 卡片 ═══════════ */
function stageReveal(W, H, p, t, seg, fade){
  const it = TL.items[seg.i];
  if(!it) return;
  const rar = seg.rar || FALLBACK_RARITY, card = it.card;
  const st = S.flow.stages.reveal;

  // 底:同一張卡圖滿版模糊 + 壓暗,讓卡片浮起來
  if(st.blurBg && card.img){
    ctx.save();
    ctx.globalAlpha = fade;
    drawBlurred(card.img, W, H, H * (st.blur || 0) / 1000);
    ctx.fillStyle = "rgba(6,5,12," + clamp((st.blurDim === undefined ? 46 : st.blurDim) / 100, 0, 1) + ")";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  const ch = Math.min(H * .56, W * 1.05), cw = ch / 1.5;
  const e = easeOutBack(clamp(p / .38, 0, 1));
  const cy = H * .44 + (1 - clamp(p / .38, 0, 1)) * H * .12;
  const sc = lerp(.86, 1, e);

  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(W / 2, cy);
  ctx.scale(sc, sc);

  // 外光暈:呼吸
  ctx.shadowColor = hexA(rar.glow, .85);
  ctx.shadowBlur = (Math.min(W, H) * .03) * (1 + Math.sin(t * 2.5) * .28);
  roundRect(-cw / 2, -ch / 2, cw, ch, cw * .05);
  ctx.fillStyle = "#14121C"; ctx.fill();
  ctx.shadowBlur = 0;

  // 卡圖:滿版塞滿整張卡
  ctx.save();
  roundRect(-cw / 2, -ch / 2, cw, ch, cw * .05); ctx.clip();
  drawCropped(ctx, card.img, -cw / 2, -ch / 2, cw, ch, card.crop);
  ctx.restore();

  // 邊框
  roundRect(-cw / 2, -ch / 2, cw, ch, cw * .05);
  ctx.strokeStyle = paint(rar, -cw / 2, -ch / 2, cw / 2, ch / 2, t);
  ctx.lineWidth = cw * .014;
  ctx.stroke();

  // NEW 角標
  if(card.isNew){
    const bw = cw * .24, bh = cw * .085;
    ctx.save();
    ctx.translate(cw / 2 - bw * .58, -ch / 2 + bh * .5);
    ctx.rotate(.16);
    roundRect(-bw / 2, -bh / 2, bw, bh, bh * .3);
    ctx.fillStyle = "#C9A227"; ctx.fill();
    ctx.fillStyle = "#1A160B";
    ctx.font = "700 " + (bh * .62) + "px 'Noto Sans TC',sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("NEW", 0, bh * .04);
    ctx.restore();
  }
  ctx.restore();

  // 卡框下方:卡名 + 稀有度標籤
  const a = clamp((p - .25) / .25, 0, 1) * fade;
  if(a > 0){
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const ny = cy + ch / 2 + H * .055;
    ctx.fillStyle = "#F2EEF8";
    // 名稱太長就自動縮字級,再不夠才截斷,不讓它衝出畫面
    let nm = card.name || "未命名", fs = H * .038;
    const maxNameW = W * .86;
    const setFont = () => ctx.font = "500 " + fs + "px 'Noto Serif TC','Songti TC',serif";
    setFont();
    while(ctx.measureText(nm).width > maxNameW && fs > H * .020){ fs -= H * .0015; setFont(); }
    while(nm.length > 2 && ctx.measureText(nm + "…").width > maxNameW) nm = nm.slice(0, -1);
    if(nm !== (card.name || "未命名")) nm += "…";
    ctx.shadowColor = "rgba(0,0,0,.6)"; ctx.shadowBlur = H * .01;
    ctx.fillText(nm, W / 2, ny);
    ctx.shadowBlur = 0;

    const th = H * .032, tw = Math.max(W * .11, ctx.measureText(rar.label).width * .9 + W * .05);
    roundRect(W / 2 - tw / 2, ny + H * .034, tw, th, th * .32);
    ctx.fillStyle = paint(rar, W / 2 - tw / 2, 0, W / 2 + tw / 2, 0, t);
    ctx.fill();
    ctx.fillStyle = "#15131E";
    ctx.font = "700 " + (th * .55) + "px 'Noto Sans TC',sans-serif";
    ctx.fillText(rar.label, W / 2, ny + H * .034 + th / 2);
    ctx.restore();
  }
}

/* ═══════════ 段落:summary 一覽 ═══════════ */
function stageSummary(W, H, p, t, seg, fade){
  const n = TL.items.length;
  const cols = n === 10 ? 5 : Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const gap = W * .018;
  const availW = W * .86, availH = H * .60;
  let cw = (availW - gap * (cols - 1)) / cols;
  let chh = cw * 1.5;
  if(chh * rows + gap * (rows - 1) > availH){
    chh = (availH - gap * (rows - 1)) / rows;
    cw = chh / 1.5;
  }
  const totalW = cols * cw + (cols - 1) * gap, totalH = rows * chh + (rows - 1) * gap;
  const x0 = (W - totalW) / 2, y0 = H / 2 - totalH / 2 + H * .03;
  const dur = Math.max(.0001, seg.t1 - seg.t0), lt = p * dur;

  ctx.save();
  ctx.globalAlpha = fade;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,255,255,.86)";
  ctx.font = "500 " + (H * .034) + "px 'Noto Serif TC','Songti TC',serif";
  ctx.fillText("本次結果 · " + n + " 張", W / 2, y0 - H * .055);
  ctx.restore();

  TL.items.forEach((it, i) => {
    const a = clamp((lt - i * .06) / .35, 0, 1);
    if(a <= 0) return;
    const rar = it.rar;
    const x = x0 + (i % cols) * (cw + gap), y = y0 + Math.floor(i / cols) * (chh + gap);
    const hi = S.rarities.findIndex(r => r.id === rar.id) >= 2;
    ctx.save();
    ctx.globalAlpha = fade * a;
    ctx.translate(x + cw / 2, y + chh / 2);
    ctx.scale(lerp(.86, 1, easeOutCubic(a)), lerp(.86, 1, easeOutCubic(a)));
    if(hi){ ctx.shadowColor = hexA(rar.glow, .8); ctx.shadowBlur = Math.min(W, H) * .022; }
    roundRect(-cw / 2, -chh / 2, cw, chh, cw * .07);
    ctx.fillStyle = "#14121C"; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.save();
    roundRect(-cw / 2, -chh / 2, cw, chh, cw * .07); ctx.clip();
    drawCropped(ctx, it.card.img, -cw / 2, -chh / 2, cw, chh, it.card.crop);
    ctx.restore();
    roundRect(-cw / 2, -chh / 2, cw, chh, cw * .07);
    ctx.strokeStyle = paint(rar, -cw / 2, -chh / 2, cw / 2, chh / 2, t);
    ctx.lineWidth = cw * .022;
    ctx.stroke();
    ctx.restore();
  });
}

/* ═══════════ render:預覽與錄製唯一的畫圖路徑 ═══════════ */
function render(ctx, t){
  const W = S.canvas.w, H = S.canvas.h;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, W, H);

  if(!TL.segs.length){
    drawBg(W, H, 0);
    ctx.fillStyle = "rgba(255,255,255,.42)";
    ctx.font = "400 " + (H * .026) + "px 'Noto Sans TC',sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("把圖片拖進左邊的卡片庫,再加入抽卡序列", W / 2, H / 2);
    return;
  }
  const seg = segAt(clamp(t, 0, TL.total - .0001));
  const p = clamp((t - seg.t0) / Math.max(.0001, seg.t1 - seg.t0), 0, 1);
  const fade = clamp(Math.min(p / .12, (1 - p) / .12), 0, 1);

  // 預兆 / 爆發的畫面搖動
  let shake = 0;
  if(seg.kind === "omen" && (seg.lvl || 0) >= 1) shake = (seg.lvl >= 2 ? 9 : 4) * (H / 1920);
  if(seg.kind === "burst") shake = 7 * (H / 1920) * (1 - p);

  ctx.save();
  if(shake) ctx.translate(Math.sin(t * 41) * shake, Math.cos(t * 37) * shake);
  drawBg(W, H, seg.kind === "charge" ? p * .16 : 0);
  if(seg.kind === "charge") stageCharge(W, H, p, t, seg, fade);
  else if(seg.kind === "omen") stageOmen(W, H, p, t, seg, fade);
  else if(seg.kind === "burst") stageBurst(W, H, p, t, seg, fade);
  else if(seg.kind === "line") stageLine(W, H, p, t, seg, fade);
  else if(seg.kind === "reveal") stageReveal(W, H, p, t, seg, fade);
  else if(seg.kind === "summary") stageSummary(W, H, p, t, seg, fade);
  ctx.restore();
}

/* ═══════════ 播放 ═══════════ */
function rebuild(){
  TL = buildTimeline();
  if(playT > TL.total) playT = TL.total;
  const empty = TL.total <= 0;
  $("#btnPlay").disabled = empty;
  $("#btnRecord").disabled = empty;
  $("#scrub").disabled = empty;
  dirty = true;
  syncBar();
}
function syncBar(){
  const t = playT;
  $("#phaseTag").textContent = t.toFixed(2) + " / " + TL.total.toFixed(2) + "s";
  const seg = TL.segs.length ? segAt(clamp(t, 0, Math.max(0, TL.total - .0001))) : null;
  let label = "—";
  if(seg){
    label = STAGE_NAME[seg.kind] || seg.kind;
    if(seg.i !== undefined) label += " " + (seg.i + 1) + "/" + TL.items.length;
  }
  $("#stageTag").textContent = label;
  if(!draggingScrub) $("#scrub").value = TL.total ? Math.round(t / TL.total * 1000) : 0;
}
function tick(){
  if(!recording){
    if(playing){
      playT = (performance.now() - anchor) / 1000;
      if(playT >= TL.total){ playT = TL.total; playing = false; syncPlayBtn(); }
      dirty = true;
    }
    if(dirty){ render(ctx, Math.min(playT, Math.max(0, TL.total - .0001))); syncBar(); dirty = false; }
  }
  requestAnimationFrame(tick);
}
function syncPlayBtn(){ $("#btnPlay").textContent = playing ? "❚❚ 暫停" : "▶ 播放"; }
function togglePlay(){
  if(!TL.total) return;
  if(playing){ playing = false; }
  else {
    if(playT >= TL.total) playT = 0;
    anchor = performance.now() - playT * 1000;
    playing = true;
  }
  syncPlayBtn(); dirty = true;
}
function seekTo(t){
  playT = clamp(t, 0, TL.total);
  if(playing) anchor = performance.now() - playT * 1000;
  dirty = true;
}

/* ═══════════ 卡片庫 UI ═══════════ */
function esc(s){ return String(s === undefined || s === null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function escA(s){ return esc(s).replace(/"/g, "&quot;"); }

function renderCards(){
  const box = $("#cardList");
  if(!S.cards.length){
    box.innerHTML = '<div class="empty">卡片庫是空的<br>把圖片拖到這裡,或點上方按鈕上傳</div>';
    return;
  }
  box.innerHTML = S.cards.map((c, i) => {
    const opts = S.rarities.map(r => '<option value="' + escA(r.id) + '"' + (r.id === c.rarityId ? " selected" : "") + ">" + esc(r.label) + "</option>").join("");
    return `
    <div class="card-item" data-i="${i}" draggable="true">
      <div class="ci-top">
        <span class="ci-thumb" style="background-image:url('${c.imgSrc || ""}')"></span>
        <div class="ci-fields">
          <input type="text" class="f-name" placeholder="卡片名稱" value="${escA(c.name)}">
          <select class="f-rarity">${opts}</select>
          <label class="ck"><input type="checkbox" class="f-new"${c.isNew ? " checked" : ""}> 標記 NEW</label>
        </div>
        <div class="ci-tools">
          <button class="up" title="上移">▲</button>
          <button class="dn" title="下移">▼</button>
          <button class="rm" title="從卡片庫刪除">✕</button>
        </div>
      </div>
      <div class="ci-lines">
        <div class="ci-lines-h">台詞(可換行)</div>
        <textarea class="f-line" rows="2" placeholder="抽到這張時顯示的台詞">${esc(c.line)}</textarea>
      </div>
      <button class="btn sm pri ci-add">加入序列 →</button>
    </div>`;
  }).join("");
}

$("#cardList").addEventListener("input", e => {
  const item = e.target.closest(".card-item"); if(!item) return;
  const c = S.cards[+item.dataset.i]; if(!c) return;
  if(e.target.classList.contains("f-name")) c.name = e.target.value;
  else if(e.target.classList.contains("f-line")) c.line = e.target.value;
  rebuild();
});
$("#cardList").addEventListener("change", e => {
  const item = e.target.closest(".card-item"); if(!item) return;
  const c = S.cards[+item.dataset.i]; if(!c) return;
  if(e.target.classList.contains("f-rarity")) c.rarityId = e.target.value;
  else if(e.target.classList.contains("f-new")) c.isNew = e.target.checked;
  rebuild();
});
$("#cardList").addEventListener("click", e => {
  const item = e.target.closest(".card-item"); if(!item) return;
  const i = +item.dataset.i, c = S.cards[i]; if(!c) return;
  if(e.target.classList.contains("ci-thumb")){ openCrop(i); return; }
  if(e.target.classList.contains("ci-add")){ addToSeq(c.id); return; }
  if(e.target.classList.contains("rm")){ removeCard(i); return; }
  if(e.target.classList.contains("up") && i > 0){ S.cards.splice(i - 1, 0, S.cards.splice(i, 1)[0]); renderCards(); rebuild(); return; }
  if(e.target.classList.contains("dn") && i < S.cards.length - 1){ S.cards.splice(i + 1, 0, S.cards.splice(i, 1)[0]); renderCards(); rebuild(); return; }
});
$("#cardList").addEventListener("dragstart", e => {
  const item = e.target.closest(".card-item"); if(!item) return;
  const c = S.cards[+item.dataset.i]; if(!c) return;
  e.dataTransfer.setData("text/gacha-card", c.id);
  e.dataTransfer.effectAllowed = "copy";
  item.classList.add("dragging");
});
$("#cardList").addEventListener("dragend", e => {
  const item = e.target.closest(".card-item");
  if(item) item.classList.remove("dragging");
});

function removeCard(i){
  const c = S.cards[i]; if(!c) return;
  const used = S.sequence.filter(e => e.cardId === c.id).length;
  S.cards.splice(i, 1);
  S.sequence = S.sequence.filter(e => e.cardId !== c.id);
  renderCards(); renderSeq(); rebuild();
  if(used) status("已一併從序列移除 " + used + " 項");
}

/* ═══════════ 卡片範圍(滿版裁切)編輯器 ═══════════ */
const cropCv = $("#cropCv"), cropCx = cropCv.getContext("2d");
let cropIdx = -1, cropDrag = null;

function openCrop(i){
  const c = S.cards[i];
  if(!c){ return; }
  if(!c.img){ status("這張卡還沒有圖片,重新上傳同檔名即可接回"); return; }
  cropIdx = i;
  if(!c.crop) c.crop = defaultCrop();
  $("#cropName").textContent = c.name || "";
  $("#cropZoom").value = Math.round(c.crop.zoom * 100);
  $("#cropZoomV").textContent = c.crop.zoom.toFixed(2) + "×";
  $("#cropModal").classList.remove("hidden");
  drawCropPreview();
}
function clampCrop(){
  const c = S.cards[cropIdx];
  if(!c || !c.img) return;
  const W = cropCv.width, H = cropCv.height;
  const k = Math.max(W / c.img.width, H / c.img.height) * c.crop.zoom;
  const mx = Math.max(0, (c.img.width * k - W) / 2) / W;
  const my = Math.max(0, (c.img.height * k - H) / 2) / H;
  c.crop.x = clamp(c.crop.x, -mx, mx);
  c.crop.y = clamp(c.crop.y, -my, my);
}
function drawCropPreview(){
  const c = S.cards[cropIdx];
  if(!c) return;
  const W = cropCv.width, H = cropCv.height;
  cropCx.setTransform(1, 0, 0, 1, 0, 0);
  cropCx.clearRect(0, 0, W, H);
  cropCx.save();
  roundRectOn(cropCx, 0, 0, W, H, W * .05);
  cropCx.clip();
  cropCx.fillStyle = "#14121c";
  cropCx.fillRect(0, 0, W, H);
  drawCropped(cropCx, c.img, 0, 0, W, H, c.crop);
  // 三分格輔助線
  cropCx.strokeStyle = "rgba(255,255,255,.22)";
  cropCx.lineWidth = 1;
  [1, 2].forEach(k => {
    cropCx.beginPath(); cropCx.moveTo(W * k / 3, 0); cropCx.lineTo(W * k / 3, H); cropCx.stroke();
    cropCx.beginPath(); cropCx.moveTo(0, H * k / 3); cropCx.lineTo(W, H * k / 3); cropCx.stroke();
  });
  cropCx.restore();
  roundRectOn(cropCx, 1, 1, W - 2, H - 2, W * .05);
  cropCx.strokeStyle = "rgba(255,255,255,.55)";
  cropCx.lineWidth = 2;
  cropCx.stroke();
}
function cropChanged(){
  clampCrop();
  drawCropPreview();
  dirty = true;
}
cropCv.addEventListener("pointerdown", e => {
  const c = S.cards[cropIdx]; if(!c) return;
  cropCv.setPointerCapture(e.pointerId);
  const r = cropCv.getBoundingClientRect();
  cropDrag = { px: e.clientX, py: e.clientY, x0: c.crop.x, y0: c.crop.y, kx: cropCv.width / r.width / cropCv.width, ky: cropCv.height / r.height / cropCv.height };
});
cropCv.addEventListener("pointermove", e => {
  if(!cropDrag) return;
  const c = S.cards[cropIdx]; if(!c) return;
  c.crop.x = cropDrag.x0 + (e.clientX - cropDrag.px) * cropDrag.kx;
  c.crop.y = cropDrag.y0 + (e.clientY - cropDrag.py) * cropDrag.ky;
  cropChanged();
});
cropCv.addEventListener("pointerup", () => cropDrag = null);
cropCv.addEventListener("pointercancel", () => cropDrag = null);
cropCv.addEventListener("wheel", e => {
  const c = S.cards[cropIdx]; if(!c) return;
  e.preventDefault();
  c.crop.zoom = clamp(c.crop.zoom * (1 - e.deltaY * .0012), 1, 4);
  $("#cropZoom").value = Math.round(c.crop.zoom * 100);
  $("#cropZoomV").textContent = c.crop.zoom.toFixed(2) + "×";
  cropChanged();
}, { passive: false });
$("#cropZoom").addEventListener("input", e => {
  const c = S.cards[cropIdx]; if(!c) return;
  c.crop.zoom = clamp(+e.target.value / 100, 1, 4);
  $("#cropZoomV").textContent = c.crop.zoom.toFixed(2) + "×";
  cropChanged();
});
$("#cropReset").onclick = () => {
  const c = S.cards[cropIdx]; if(!c) return;
  c.crop = defaultCrop();
  $("#cropZoom").value = 100;
  $("#cropZoomV").textContent = "1.00×";
  cropChanged();
};
$("#cropDone").onclick = () => $("#cropModal").classList.add("hidden");
$("#cropModal").onclick = e => { if(e.target === $("#cropModal")) $("#cropModal").classList.add("hidden"); };

/* ═══════════ 抽卡序列 UI ═══════════ */
function addToSeq(cardId){
  S.sequence.push({ cardId, omenLevel: "auto" });
  renderSeq(); rebuild();
}
function renderSeq(){
  const box = $("#seqList");
  if(!S.sequence.length){
    box.innerHTML = '<div class="empty">序列是空的<br>把卡片拖到這裡<br>或按卡片上的「加入序列」</div>';
    return;
  }
  box.innerHTML = S.sequence.map((e, i) => {
    const c = cardOf(e.cardId);
    const lv = e.omenLevel === undefined ? "auto" : String(e.omenLevel);
    const opts = [["auto", "預兆:自動"], ["0", "預兆:平常"], ["1", "預兆:期待"], ["2", "預兆:確定"]]
      .map(o => '<option value="' + o[0] + '"' + (o[0] === lv ? " selected" : "") + ">" + o[1] + "</option>").join("");
    return `
      <div class="seq-item" data-i="${i}">
        <span class="sq-no">${i + 1}</span>
        <span class="sq-thumb" style="background-image:url('${c && c.imgSrc ? c.imgSrc : ""}')"></span>
        <div class="sq-body">
          <span class="sq-name">${esc(c ? (c.name || "未命名") : "(卡片已刪除)")}</span>
          <select class="sq-omen">${opts}</select>
        </div>
        <div class="sq-tools">
          <button class="up" title="上移">▲</button>
          <button class="dn" title="下移">▼</button>
          <button class="rm" title="移除">✕</button>
        </div>
      </div>`;
  }).join("");
}
$("#seqList").addEventListener("change", e => {
  const item = e.target.closest(".seq-item"); if(!item) return;
  const en = S.sequence[+item.dataset.i]; if(!en) return;
  if(e.target.classList.contains("sq-omen")) en.omenLevel = e.target.value === "auto" ? "auto" : +e.target.value;
  rebuild();
});
$("#seqList").addEventListener("click", e => {
  const item = e.target.closest(".seq-item"); if(!item) return;
  const i = +item.dataset.i;
  if(e.target.classList.contains("rm")){ S.sequence.splice(i, 1); renderSeq(); rebuild(); return; }
  if(e.target.classList.contains("up") && i > 0){ S.sequence.splice(i - 1, 0, S.sequence.splice(i, 1)[0]); renderSeq(); rebuild(); return; }
  if(e.target.classList.contains("dn") && i < S.sequence.length - 1){ S.sequence.splice(i + 1, 0, S.sequence.splice(i, 1)[0]); renderSeq(); rebuild(); return; }
});
$("#seqClear").onclick = () => { S.sequence = []; renderSeq(); rebuild(); };

const seqPane = $("#sideSeq");
seqPane.addEventListener("dragover", e => {
  if(!Array.from(e.dataTransfer.types).includes("text/gacha-card")) return;
  e.preventDefault(); e.dataTransfer.dropEffect = "copy";
  seqPane.classList.add("dragover");
});
seqPane.addEventListener("dragleave", () => seqPane.classList.remove("dragover"));
seqPane.addEventListener("drop", e => {
  const id = e.dataTransfer.getData("text/gacha-card");
  seqPane.classList.remove("dragover");
  if(!id) return;
  e.preventDefault();
  addToSeq(id);
});

/* ═══════════ 稀有度樣式 UI ═══════════ */
const BURSTS = [["beam", "光柱 beam"], ["shatter", "碎裂 shatter"]];
function renderRarities(){
  $("#rarityList").innerHTML = S.rarities.map((r, i) => {
    const isRb = r.color === "rainbow";
    const bopts = BURSTS.map(b => '<option value="' + b[0] + '"' + (b[0] === r.burst ? " selected" : "") + ">" + b[1] + "</option>").join("");
    return `
      <div class="rar-row" data-i="${i}">
        <div class="rar-r1">
          <input type="text" class="r-id" value="${escA(r.id)}" readonly title="內部代號,不可更改">
          <input type="text" class="r-lb" value="${escA(r.label)}" placeholder="顯示文字">
          <button class="r-x" title="刪除">✕</button>
        </div>
        <div class="rar-r2">
          <span class="cl">色<input type="color" class="r-c" value="${isRb ? "#B58CE0" : escA(r.color)}"${isRb ? " disabled" : ""}></span>
          <label class="ck"><input type="checkbox" class="r-rb"${isRb ? " checked" : ""}> 彩虹</label>
          <span class="cl">暈<input type="color" class="r-g" value="${escA(r.glow)}"></span>
          <select class="r-b">${bopts}</select>
          <input type="number" class="r-du" step="0.1" min="0.2" value="${r.dur}" title="卡片段秒數">
        </div>
      </div>`;
  }).join("");
}
$("#rarityList").addEventListener("input", e => {
  const row = e.target.closest(".rar-row"); if(!row) return;
  const r = S.rarities[+row.dataset.i]; if(!r) return;
  if(e.target.classList.contains("r-lb")) r.label = e.target.value;
  else if(e.target.classList.contains("r-c")) r.color = e.target.value;
  else if(e.target.classList.contains("r-g")) r.glow = e.target.value;
  else if(e.target.classList.contains("r-du")) r.dur = Math.max(.2, +e.target.value || .2);
  rebuild();
});
$("#rarityList").addEventListener("change", e => {
  const row = e.target.closest(".rar-row"); if(!row) return;
  const r = S.rarities[+row.dataset.i]; if(!r) return;
  if(e.target.classList.contains("r-b")){ r.burst = e.target.value; rebuild(); }
  else if(e.target.classList.contains("r-rb")){
    r.color = e.target.checked ? "rainbow" : (row.querySelector(".r-c").value || "#B58CE0");
    renderRarities(); rebuild();
  }
});
$("#rarityList").addEventListener("click", e => {
  if(!e.target.classList.contains("r-x")) return;
  const row = e.target.closest(".rar-row"), i = +row.dataset.i, r = S.rarities[i];
  if(S.rarities.length <= 1){ status("至少要保留一個稀有度"); return; }
  const moved = S.cards.filter(c => c.rarityId === r.id);
  S.rarities.splice(i, 1);
  moved.forEach(c => c.rarityId = S.rarities[0].id);
  renderRarities(); renderCards(); rebuild();
  if(moved.length) status("已把 " + moved.length + " 張卡改成「" + S.rarities[0].label + "」");
});
$("#addRarity").onclick = () => {
  let n = S.rarities.length + 1, id = "R" + n;
  while(S.rarities.some(r => r.id === id)){ n++; id = "R" + n; }
  S.rarities.push({ id, label: id, color: "#8FA3B8", glow: "#B9CBDC", burst: "beam", dur: 2.0 });
  renderRarities(); renderCards(); rebuild();
};

/* ═══════════ 上傳 ═══════════ */
async function addFiles(files){
  const list = Array.from(files || []);
  let skipped = 0, added = 0, matched = 0;
  for(const f of list){
    if(!f.type.startsWith("image/")){ skipped++; continue; }
    const src = await readFile(f);
    const img = await decodeImage(src);
    if(!img){ skipped++; continue; }
    // 匯入「不含圖片」的設定後,同檔名的空卡自動接回
    const hole = S.cards.find(c => !c.img && c.fileName === f.name);
    if(hole){ hole.img = img; hole.imgSrc = src; matched++; continue; }
    S.cards.push({
      id: uid(),
      name: f.name.replace(/\.[^.]+$/, ""),
      fileName: f.name,
      rarityId: (S.rarities[0] || FALLBACK_RARITY).id,
      isNew: true, crop: defaultCrop(),
      line: "",
      img, imgSrc: src
    });
    added++;
  }
  renderCards(); renderSeq(); rebuild();
  const msg = [];
  if(added) msg.push("新增 " + added + " 張");
  if(matched) msg.push("接回 " + matched + " 張");
  if(skipped) msg.push("已略過 " + skipped + " 個非圖片檔案");
  if(msg.length) status(msg.join(" · "));
}
$("#addCards").onclick = () => $("#filePick").click();
$("#filePick").onchange = e => { addFiles(e.target.files); e.target.value = ""; };

const libPane = $("#sideLib");
libPane.addEventListener("dragover", e => {
  if(!Array.from(e.dataTransfer.types).includes("Files")) return;
  e.preventDefault(); libPane.classList.add("dragover");
});
libPane.addEventListener("dragleave", () => libPane.classList.remove("dragover"));
libPane.addEventListener("drop", e => {
  if(!e.dataTransfer.files.length) return;
  e.preventDefault(); libPane.classList.remove("dragover");
  addFiles(e.dataTransfer.files);
});

/* ═══════════ 右欄設定 ═══════════ */
function segPick(seg, val, cb){
  seg.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.v === val));
  if(cb) cb(val);
}
function applyPreset(v){
  const p = PRESETS[v] || PRESETS["9:16"];
  S.canvas.preset = v; S.canvas.w = p[0]; S.canvas.h = p[1];
  cv.width = p[0]; cv.height = p[1];
  dirty = true;
}
$("#presetSeg").onclick = e => {
  const b = e.target.closest("button"); if(!b || recording) return;
  segPick($("#presetSeg"), b.dataset.v, applyPreset);
};
$("#seed").addEventListener("input", e => { S.seed = Math.floor(+e.target.value || 0); dirty = true; });
$("#fps").addEventListener("change", e => S.export.fps = +e.target.value);
$("#bgTypeSeg").onclick = e => {
  const b = e.target.closest("button"); if(!b) return;
  segPick($("#bgTypeSeg"), b.dataset.v, v => {
    S.bg.type = v;
    $("#bgColorField").hidden = v !== "color";
    $("#bgImgField").hidden = v !== "image";
    dirty = true;
  });
};
$("#bgColor").addEventListener("input", e => { S.bg.color = e.target.value; dirty = true; });
$("#vignette").addEventListener("input", e => {
  S.bg.vignette = +e.target.value / 100;
  $("#vignetteV").textContent = S.bg.vignette.toFixed(2);
  dirty = true;
});
$("#bgDrop").addEventListener("click", async e => {
  if(e.target.classList.contains("dx")){
    S.bg.img = null; S.bg.imgSrc = null; S.bg.imgName = ""; syncBgDrop(); dirty = true; return;
  }
  $("#bgPick").click();
});
$("#bgPick").onchange = async e => {
  const f = e.target.files[0]; e.target.value = "";
  if(!f) return;
  const src = await readFile(f);
  S.bg.img = await decodeImage(src);
  S.bg.imgSrc = src; S.bg.imgName = f.name;
  syncBgDrop(); dirty = true;
};
function syncBgDrop(){
  const d = $("#bgDrop");
  d.querySelector(".thumb").style.backgroundImage = S.bg.imgSrc ? "url('" + S.bg.imgSrc + "')" : "";
  d.querySelector(".dtx").textContent = S.bg.imgSrc ? (S.bg.imgName || "已設定") : "點擊上傳";
}
$("#modeSeg").onclick = e => {
  const b = e.target.closest("button"); if(!b) return;
  segPick($("#modeSeg"), b.dataset.v, v => {
    S.flow.mode = v;
    $("#modeHint").textContent = v === "batch"
      ? "共用開場:蓄力 / 預兆 / 爆發只跑一次,再依序播台詞與卡片。"
      : "每張各走:每一張卡都跑完整的蓄力 → 預兆 → 爆發 → 台詞 → 卡片。";
    rebuild();
  });
};
$$("[data-stage]").forEach(el => el.addEventListener("change", () => {
  S.flow.stages[el.dataset.stage].on = el.checked;
  rebuild();
}));
$$("[data-dur]").forEach(el => el.addEventListener("input", () => {
  S.flow.stages[el.dataset.dur].dur = Math.max(.1, +el.value || .1);
  rebuild();
}));
$("#revealBlurBg").addEventListener("change", e => {
  S.flow.stages.reveal.blurBg = e.target.checked;
  $("#revealBlurFields").hidden = !e.target.checked;
  dirty = true;
});
$("#revealBlur").addEventListener("input", e => {
  S.flow.stages.reveal.blur = +e.target.value;
  $("#revealBlurV").textContent = e.target.value;
  dirty = true;
});
$("#revealBlurDim").addEventListener("input", e => {
  S.flow.stages.reveal.blurDim = +e.target.value;
  $("#revealBlurDimV").textContent = e.target.value;
  dirty = true;
});
$("#chargeShape").addEventListener("change", e => { S.flow.stages.charge.shape = e.target.value; dirty = true; });

/* 可收合面板 / 側欄 */
$$(".panel-sec > .ph").forEach(h => h.onclick = () => {
  const p = h.parentElement;
  p.dataset.c = p.dataset.c === "1" ? "0" : "1";
});
$$(".collapse").forEach(b => b.onclick = () => {
  const sec = $("#" + b.dataset.side);
  sec.classList.toggle("collapsed");
  const cl = sec.classList.contains("collapsed"), right = sec.classList.contains("right");
  b.textContent = right ? (cl ? "◀" : "▶") : (cl ? "▶" : "◀");
});

/* ═══════════ 播放控制 ═══════════ */
let draggingScrub = false;
$("#btnPlay").onclick = togglePlay;
$("#btnHome").onclick = () => seekTo(0);
$("#scrub").addEventListener("pointerdown", () => draggingScrub = true);
$("#scrub").addEventListener("pointerup", () => draggingScrub = false);
$("#scrub").addEventListener("input", e => seekTo(+e.target.value / 1000 * TL.total));
document.addEventListener("keydown", e => {
  if(recording) return;
  const tag = (e.target.tagName || "").toLowerCase();
  if(tag === "input" || tag === "textarea" || tag === "select") return;
  if(e.code === "Space"){ e.preventDefault(); togglePlay(); }
  else if(e.key === "ArrowLeft"){ e.preventDefault(); playing = false; syncPlayBtn(); seekTo(playT - .1); }
  else if(e.key === "ArrowRight"){ e.preventDefault(); playing = false; syncPlayBtn(); seekTo(playT + .1); }
  else if(e.key === "Home"){ e.preventDefault(); playing = false; syncPlayBtn(); seekTo(0); }
});

/* ═══════════ 說明 / 狀態 ═══════════ */
let statusTimer = 0;
function status(msg){
  $("#statusMsg").textContent = msg || "";
  clearTimeout(statusTimer);
  if(msg) statusTimer = setTimeout(() => $("#statusMsg").textContent = "", 4200);
}
$("#helpBtn").onclick = () => $("#helpModal").classList.remove("hidden");
$("#helpClose").onclick = () => $("#helpModal").classList.add("hidden");
$("#helpModal").onclick = e => { if(e.target === $("#helpModal")) $("#helpModal").classList.add("hidden"); };

/* ═══════════ 輸出 ═══════════ */
function pickMime(){
  const list = ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  if(!window.MediaRecorder) return "";
  for(const m of list) if(MediaRecorder.isTypeSupported(m)) return m;
  return "";
}
function fmtOf(mime){ return /mp4/i.test(mime) ? "MP4" : /webm/i.test(mime) ? "WebM" : "未知"; }
function refreshRecHint(){
  const m = pickMime();
  if(!m){ $("#recHint").textContent = "這個瀏覽器不支援 MediaRecorder,無法輸出影片(可改用 PNG)。"; return; }
  const f = fmtOf(m);
  $("#recHint").textContent = f === "MP4"
    ? "輸出格式:MP4(此瀏覽器支援 MP4 錄製)。"
    : "輸出格式:WebM(此瀏覽器不支援 MP4 錄製)。";
}
$("#btnShot").onclick = () => {
  cv.toBlob(b => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = "gacha-" + Date.now() + ".png";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, "image/png");
};
$("#btnRecord").onclick = () => {
  if(recording || !TL.total) return;
  recMime = pickMime();
  if(!recMime){ status("這個瀏覽器不支援影片錄製"); return; }

  playing = false; syncPlayBtn();
  recording = true;
  document.body.classList.add("recording");
  $("#btnRecord").disabled = true;
  $("#btnRecord").textContent = "● 錄製中,請勿切換分頁";
  $("#recProgress").classList.remove("hidden");

  const stream = cv.captureStream(S.export.fps);
  recChunks = [];
  recorder = new MediaRecorder(stream, { mimeType: recMime });
  recorder.ondataavailable = e => { if(e.data && e.data.size) recChunks.push(e.data); };
  recorder.onstop = () => {
    const actual = recorder.mimeType || recMime;
    const isMp4 = /mp4/i.test(actual);
    const blob = new Blob(recChunks, { type: isMp4 ? "video/mp4" : "video/webm" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "gacha-" + Date.now() + (isMp4 ? ".mp4" : ".webm");
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    recording = false; recorder = null;
    document.body.classList.remove("recording");
    $("#btnRecord").disabled = false;
    $("#btnRecord").textContent = "● 輸出影片";
    $("#recProgress").classList.add("hidden");
    $("#recProgress").querySelector("i").style.width = "0%";
    status("已輸出 " + fmtOf(actual));
    dirty = true;
  };
  recorder.start();

  const start = performance.now();
  let tail = 0;
  (function recLoop(){
    if(!recording) return;
    const t = (performance.now() - start) / 1000;
    render(ctx, Math.min(t, Math.max(0, TL.total - .0001)));
    playT = Math.min(t, TL.total);
    syncBar();
    $("#recProgress").querySelector("i").style.width = (clamp(t / TL.total, 0, 1) * 100).toFixed(1) + "%";
    if(t >= TL.total){
      tail++;                       // 尾巴多跑兩格再停,避免最後一格被截掉
      if(tail > 2){ recorder.stop(); return; }
    }
    requestAnimationFrame(recLoop);
  })();
};

/* ═══════════ 存檔 / 讀檔(JSON,不用 localStorage)═══════════ */
function serialize(withImages){
  return {
    app: "gacha-studio", v: 2,
    canvas: { preset: S.canvas.preset, w: S.canvas.w, h: S.canvas.h },
    seed: S.seed,
    bg: { type: S.bg.type, color: S.bg.color, vignette: S.bg.vignette, imgName: S.bg.imgName, imgSrc: withImages ? S.bg.imgSrc : null },
    rarities: S.rarities.map(r => Object.assign({}, r)),
    cards: S.cards.map(c => ({
      id: c.id, name: c.name, fileName: c.fileName, rarityId: c.rarityId, isNew: c.isNew, crop: Object.assign(defaultCrop(), c.crop || {}),
      line: c.line || "",
      imgSrc: withImages ? c.imgSrc : null
    })),
    sequence: S.sequence.map(e => ({ cardId: e.cardId, omenLevel: e.omenLevel })),
    flow: JSON.parse(JSON.stringify(S.flow)),
    export: { fps: S.export.fps }
  };
}
async function deserialize(o){
  if(!o || o.app !== "gacha-studio") throw new Error("bad file");
  if(o.canvas && PRESETS[o.canvas.preset]) applyPreset(o.canvas.preset);
  if(typeof o.seed === "number") S.seed = o.seed;
  if(o.bg){
    S.bg.type = o.bg.type || "color";
    S.bg.color = o.bg.color || "#0A0812";
    S.bg.vignette = typeof o.bg.vignette === "number" ? o.bg.vignette : .6;
    S.bg.imgName = o.bg.imgName || "";
    S.bg.imgSrc = o.bg.imgSrc || null;
    S.bg.img = S.bg.imgSrc ? await decodeImage(S.bg.imgSrc) : null;
  }
  if(Array.isArray(o.rarities) && o.rarities.length) S.rarities = o.rarities.map(r => Object.assign({}, r));
  S.cards = [];
  let missing = 0;
  for(const c of (o.cards || [])){
    const img = c.imgSrc ? await decodeImage(c.imgSrc) : null;
    if(!img) missing++;
    S.cards.push({
      id: c.id || uid(), name: c.name || "", fileName: c.fileName || "",
      rarityId: c.rarityId || (S.rarities[0] || FALLBACK_RARITY).id,
      isNew: !!c.isNew, crop: Object.assign(defaultCrop(), c.crop || {}),
      // 舊格式(多句 lines)匯入時併成一段可換行的台詞
      line: c.line !== undefined ? String(c.line || "")
        : Array.isArray(c.lines) ? c.lines.map(l => String(l.text || "")).filter(Boolean).join("\n") : "",
      img, imgSrc: c.imgSrc || null
    });
  }
  S.sequence = (o.sequence || []).filter(e => S.cards.some(c => c.id === e.cardId))
    .map(e => ({ cardId: e.cardId, omenLevel: e.omenLevel === undefined ? "auto" : e.omenLevel }));
  if(o.flow){
    S.flow.mode = o.flow.mode === "perCard" ? "perCard" : "batch";
    Object.keys(S.flow.stages).forEach(k => { if(o.flow.stages && o.flow.stages[k]) Object.assign(S.flow.stages[k], o.flow.stages[k]); });
  }
  if(o.export && o.export.fps) S.export.fps = o.export.fps;
  syncInputs(); renderRarities(); renderCards(); renderSeq(); rebuild();
  status(missing ? "已匯入,有 " + missing + " 張缺圖片,重新上傳同檔名即可接回" : "已匯入設定");
}
function download(name, blob){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
$("#saveBtn").onclick = () => $("#saveModal").classList.remove("hidden");
$("#saveModal").onclick = e => { if(e.target === $("#saveModal")) $("#saveModal").classList.add("hidden"); };
$("#saveWithImg").onclick = () => {
  $("#saveModal").classList.add("hidden");
  download("gacha-full-" + Date.now() + ".json", new Blob([JSON.stringify(serialize(true))], { type: "application/json" }));
};
$("#saveNoImg").onclick = () => {
  $("#saveModal").classList.add("hidden");
  download("gacha-config-" + Date.now() + ".json", new Blob([JSON.stringify(serialize(false))], { type: "application/json" }));
};
$("#loadBtn").onclick = () => $("#jsonPick").click();
$("#jsonPick").onchange = e => {
  const f = e.target.files[0]; e.target.value = "";
  if(!f) return;
  const fr = new FileReader();
  fr.onload = async () => {
    try{ await deserialize(JSON.parse(fr.result)); }
    catch(err){ status("讀檔失敗:不是 Gacha Studio 的設定檔"); }
  };
  fr.readAsText(f);
};

/* ═══════════ 介面縮放 ═══════════ */
$("#uiSeg").onclick = e => {
  const b = e.target.closest("button"); if(!b) return;
  segPick($("#uiSeg"), b.dataset.v, v => {
    document.body.dataset.ui = v;
    try{ localStorage.setItem(UI_KEY, v); }catch(err){}
  });
};

/* ═══════════ 同步 UI ═══════════ */
function syncInputs(){
  segPick($("#presetSeg"), S.canvas.preset);
  $("#seed").value = S.seed;
  $("#fps").value = String(S.export.fps);
  segPick($("#bgTypeSeg"), S.bg.type);
  $("#bgColorField").hidden = S.bg.type !== "color";
  $("#bgImgField").hidden = S.bg.type !== "image";
  $("#bgColor").value = S.bg.color;
  $("#vignette").value = Math.round(S.bg.vignette * 100);
  $("#vignetteV").textContent = S.bg.vignette.toFixed(2);
  syncBgDrop();
  segPick($("#modeSeg"), S.flow.mode);
  const rv = S.flow.stages.reveal;
  $("#revealBlurBg").checked = rv.blurBg !== false;
  $("#revealBlurFields").hidden = rv.blurBg === false;
  $("#revealBlur").value = rv.blur === undefined ? 35 : rv.blur;
  $("#revealBlurV").textContent = $("#revealBlur").value;
  $("#revealBlurDim").value = rv.blurDim === undefined ? 46 : rv.blurDim;
  $("#revealBlurDimV").textContent = $("#revealBlurDim").value;
  $("#chargeShape").value = S.flow.stages.charge.shape;
  $$("[data-stage]").forEach(el => el.checked = !!S.flow.stages[el.dataset.stage].on);
  $$("[data-dur]").forEach(el => el.value = S.flow.stages[el.dataset.dur].dur);
}

/* ═══════════ 啟動 ═══════════ */
(function init(){
  let ui = "std";
  try{ ui = localStorage.getItem(UI_KEY) || "std"; }catch(err){}
  segPick($("#uiSeg"), ui, v => document.body.dataset.ui = v);
  applyPreset(S.canvas.preset);
  syncInputs();
  renderRarities();
  renderCards();
  renderSeq();
  refreshRecHint();
  rebuild();
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(() => { dirty = true; });
  tick();
})();
