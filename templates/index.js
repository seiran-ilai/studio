/* ═══════════════════════════════════════════
   Template Studio — index.js
   模板引擎 + Music Player 模板
   ═══════════════════════════════════════════ */

"use strict";

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return Array.from(document.querySelectorAll(sel)); }

const FPS = 30;

/* ─────────────────────────────
   State
   ───────────────────────────── */
const state = {
  // 素材
  media: null,          // HTMLImageElement | HTMLVideoElement
  isVideo: false,
  mediaName: "",

  // 封面
  cover: null,          // HTMLImageElement(另外上傳時)
  coverMode: "none",    // "none" | "media" | "upload"

  // 歌曲
  title: "Midnight Drive",
  artist: "ilai",
  progress: 35,         // 0-100
  songLen: 225,         // 秒
  showControls: true,
  showTime: true,
  showVolume: true,
  animateBar: true,
  ink: "auto",          // "auto" | "light" | "dark"
  inkAuto: "light",     // auto 模式的判定結果

  // 開場動畫
  intro: "slideDown",   // "none" | "fade" | "slideDown" | "slideUp" | "zoom"
  introDur: 0.9,

  // 玻璃
  glass: "frost",       // "frost" | "mirror" | "liquid"
  fill: "auto",         // "auto" | "solid" | "gradient"
  fillC1: "#33394f",
  fillC2: "#8fb4ff",
  fillAngle: 135,
  blur: 24,
  opacity: 35,          // 0-80 (%)
  shine: 50,            // 0-100 (%)
  radius: 28,
  tint: 0,              // -100(暗) ~ 100(亮)
  bgBlur: 0,
  bgDim: 15,            // 0-70 (%)

  // 版面
  card: "vertical",     // "vertical" | "horizontal"
  cardX: 50,
  cardY: 42,
  cardScale: 100,
  mediaZoom: 100,
  mediaX: 50,
  mediaY: 50,

  // 輸出
  outW: 1080,
  outH: 1350,
  dur: 8,

  // runtime
  raf: 0,
  playing: true,
  t0: 0,                // 動畫時鐘起點 (performance.now)
  tPaused: 0,
  exporting: false
};

const cv = $("#cvs");
const ctx = cv.getContext("2d");

// 玻璃模糊用的低解析度離屏 canvas
const blurC = document.createElement("canvas");
const blurCtx = blurC.getContext("2d");
const BLUR_DOWNSCALE = 4;

/* ─────────────────────────────
   素材載入
   ───────────────────────────── */
const fi = $("#fi");
const coverFi = $("#coverFi");
const dz = $("#dz");

$("#btnUpload").addEventListener("click", e => { e.stopPropagation(); fi.click(); });
$("#btnReplace").addEventListener("click", () => fi.click());
dz.addEventListener("click", () => { if (!state.media) fi.click(); });

dz.addEventListener("dragover", e => { e.preventDefault(); dz.classList.add("dragover"); });
dz.addEventListener("dragleave", () => dz.classList.remove("dragover"));
dz.addEventListener("drop", e => {
  e.preventDefault();
  dz.classList.remove("dragover");
  const f = e.dataTransfer.files[0];
  if (f) loadMedia(f);
});
fi.addEventListener("change", () => { if (fi.files[0]) loadMedia(fi.files[0]); fi.value = ""; });
coverFi.addEventListener("change", () => {
  const f = coverFi.files[0];
  if (!f) return;
  const img = new Image();
  img.onload = () => {
    state.cover = img;
    state.coverMode = "upload";
    syncCoverButtons();
    requestInk();
  };
  img.src = URL.createObjectURL(f);
  coverFi.value = "";
});

function loadMedia(file) {
  if (state.media && state.isVideo) {
    state.media.pause();
    state.media.src = "";
  }
  const url = URL.createObjectURL(file);
  state.mediaName = file.name;

  if (file.type.startsWith("video")) {
    const v = document.createElement("video");
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.addEventListener("loadeddata", () => {
      state.media = v;
      state.isVideo = true;
      v.play();
      onMediaReady();
    }, { once: true });
    v.src = url;
  } else {
    const img = new Image();
    img.onload = () => {
      state.media = img;
      state.isVideo = false;
      onMediaReady();
    };
    img.src = url;
  }
}

function mediaSize() {
  const m = state.media;
  if (!m) return { mw: 0, mh: 0 };
  return state.isVideo
    ? { mw: m.videoWidth, mh: m.videoHeight }
    : { mw: m.naturalWidth, mh: m.naturalHeight };
}

function onMediaReady() {
  $("#uploadPrompt").style.display = "none";
  $("#btnReplace").style.display = "";
  $("#btnPlayPause").style.display = state.isVideo ? "" : "none";
  dz.classList.add("has-media");
  const { mw, mh } = mediaSize();
  const kind = state.isVideo ? "影片" : "圖片";
  const durTxt = state.isVideo ? `・${state.media.duration.toFixed(1)}s` : "";
  $("#metaMedia").textContent = `${kind} ${mw}×${mh}${durTxt}`;
  $("#durGroup").style.display = state.isVideo ? "none" : "";
  resetClock();
  requestInk();
}

/* ─────────────────────────────
   動畫時鐘
   ───────────────────────────── */
function resetClock() {
  state.t0 = performance.now();
  state.tPaused = 0;
}
function clock() {
  if (!state.playing) return state.tPaused;
  return (performance.now() - state.t0) / 1000;
}

$("#btnPlayPause").addEventListener("click", () => {
  state.playing = !state.playing;
  if (state.playing) {
    state.t0 = performance.now() - state.tPaused * 1000;
    if (state.isVideo) state.media.play();
  } else {
    state.tPaused = clock();
    if (state.isVideo) state.media.pause();
  }
  $("#btnPlayPause").textContent = state.playing ? "⏸ 暫停預覽" : "▶ 繼續預覽";
});

/* ─────────────────────────────
   繪製:背景
   ───────────────────────────── */
function drawBackground(c, w, h) {
  const m = state.media;
  c.fillStyle = "#101218";
  c.fillRect(0, 0, w, h);
  if (!m) return;

  const { mw, mh } = mediaSize();
  if (!mw || !mh) return;

  // cover-fit + 縮放平移
  const zoom = state.mediaZoom / 100;
  const baseScale = Math.max(w / mw, h / mh) * zoom;
  const dw = mw * baseScale;
  const dh = mh * baseScale;
  const dx = (w - dw) * (state.mediaX / 100);
  const dy = (h - dh) * (state.mediaY / 100);

  const scaleRef = Math.min(w, h) / 1080;
  const bgBlurPx = state.bgBlur * scaleRef;

  if (bgBlurPx > 0.5) {
    c.save();
    c.filter = `blur(${bgBlurPx}px)`;
    // 放大一點蓋住模糊造成的透明邊
    const pad = bgBlurPx * 2;
    c.drawImage(m, dx - pad, dy - pad, dw + pad * 2, dh + pad * 2);
    c.restore();
  } else {
    c.drawImage(m, dx, dy, dw, dh);
  }

  if (state.bgDim > 0) {
    c.fillStyle = `rgba(0,0,0,${state.bgDim / 100})`;
    c.fillRect(0, 0, w, h);
  }
}

/* ─────────────────────────────
   卡片幾何
   ───────────────────────────── */
function roundRectPath(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// 計算卡片矩形與內部版面(所有度量以卡片寬為基準,版面比照 MusicPlayerSample)
function cardLayout(w, h) {
  const s = state.cardScale / 100;
  const base = Math.min(w, h);
  const vertical = state.card === "vertical";
  const hasCover = state.coverMode !== "none";

  const cw = vertical ? base * 0.82 * s : base * 0.85 * s;
  const pad = cw * (vertical ? 0.07 : 0.05);

  let ch;
  const m = {};
  if (vertical) {
    m.cover = cw * 0.34;
    m.titleSize = cw * 0.058;
    m.subSize = cw * 0.036;
    m.barH = Math.max(3, cw * 0.0075);
    m.timeSize = cw * 0.028;
    m.playR = cw * 0.052;          // 圓形播放鍵半徑
    m.iconS = cw * 0.042;          // 其他控制圖示尺寸
    m.volSize = cw * 0.026;        // 音量列高度基準
    m.gapCover = cw * 0.05;
    m.gapSub = cw * 0.02;
    m.gapBar = cw * 0.06;
    m.gapTime = cw * 0.02;
    m.gapCtrl = cw * 0.052;
    m.gapVol = cw * 0.058;
    ch = pad
       + (hasCover ? m.cover + m.gapCover : 0)
       + m.titleSize + m.gapSub + m.subSize
       + m.gapBar + m.barH
       + (state.showTime ? m.gapTime + m.timeSize : 0)
       + (state.showControls ? m.gapCtrl + m.playR * 2 : 0)
       + (state.showVolume ? m.gapVol + m.volSize : 0)
       + pad * 1.1;
  } else {
    m.art = cw * 0.18;
    m.titleSize = cw * 0.044;
    m.subSize = cw * 0.030;
    m.barH = Math.max(3, cw * 0.007);
    m.timeSize = cw * 0.024;
    m.playR = cw * 0.036;
    m.iconS = cw * 0.030;
    m.gapBar = cw * 0.032;
    m.gapTime = cw * 0.016;
    m.gapCtrl = cw * 0.030;
    const headH = hasCover ? m.art : m.titleSize + m.subSize + cw * 0.014;
    ch = pad * 2 + headH
       + m.gapBar + m.barH + (state.showTime ? m.gapTime + m.timeSize : 0)
       + (state.showControls ? m.gapCtrl + m.playR * 2 : 0);
  }

  const cx = (w - cw) * (state.cardX / 100);
  const cy = (h - ch) * (state.cardY / 100);
  const r = state.radius * (cw / 880);   // 圓角隨卡片寬縮放

  return { cx, cy, cw, ch, pad, r, vertical, m };
}

/* ─────────────────────────────
   玻璃質感
   ───────────────────────────── */
function updateBlurCanvas(srcCanvas, w, h) {
  const bw = Math.max(2, Math.round(w / BLUR_DOWNSCALE));
  const bh = Math.max(2, Math.round(h / BLUR_DOWNSCALE));
  if (blurC.width !== bw || blurC.height !== bh) {
    blurC.width = bw;
    blurC.height = bh;
  }
  const scaleRef = Math.min(w, h) / 1080;
  const blurPx = (state.blur * scaleRef) / BLUR_DOWNSCALE;
  blurCtx.save();
  blurCtx.filter = blurPx > 0.3 ? `blur(${blurPx}px)` : "none";
  blurCtx.drawImage(srcCanvas, 0, 0, w, h, 0, 0, bw, bh);
  blurCtx.restore();
}

function hexLum(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function hexA(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function tintColor(alphaScale) {
  // tint < 0 → 暗玻璃,> 0 → 亮玻璃
  const a = (state.opacity / 100) * alphaScale;
  if (state.tint >= 0) {
    const lum = 235 + (state.tint / 100) * 20;
    return `rgba(${lum},${lum},${lum + 6},${a})`;
  }
  const k = -state.tint / 100;
  const lum = Math.round(40 - k * 28);
  return `rgba(${lum},${lum},${lum + 4},${a})`;
}

function drawGlass(c, w, h, L) {
  const { cx, cy, cw, ch, r } = L;
  const shine = state.shine / 100;

  // 投影
  c.save();
  c.shadowColor = "rgba(0,0,0,0.4)";
  c.shadowBlur = cw * 0.07;
  c.shadowOffsetY = cw * 0.018;
  roundRectPath(c, cx, cy, cw, ch, r);
  c.fillStyle = "rgba(0,0,0,0.25)";
  c.fill();
  c.restore();

  c.save();
  roundRectPath(c, cx, cy, cw, ch, r);
  c.clip();

  // ── 1. 模糊背景(玻璃折射的底) ──
  if (state.glass === "liquid") {
    // 液態玻璃:以卡片中心為原點微放大,模擬透鏡折射
    const k = 1.07;
    const px = cx + cw / 2;
    const py = cy + ch / 2;
    c.save();
    c.filter = "saturate(1.35)";
    c.drawImage(blurC, 0, 0, blurC.width, blurC.height, px * (1 - k), py * (1 - k), w * k, h * k);
    c.restore();
  } else {
    c.drawImage(blurC, 0, 0, blurC.width, blurC.height, 0, 0, w, h);
  }

  // ── 2. 卡片色系 ──
  const a = state.opacity / 100;
  if (state.fill === "solid") {
    c.fillStyle = hexA(state.fillC1, a);
    c.fillRect(cx, cy, cw, ch);
  } else if (state.fill === "gradient") {
    // 依角度算出穿過卡片的漸層端點
    const rad = ((state.fillAngle - 90) * Math.PI) / 180;
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);
    const mx = cx + cw / 2;
    const my = cy + ch / 2;
    const len = Math.abs(dx) * cw / 2 + Math.abs(dy) * ch / 2;
    const g = c.createLinearGradient(mx - dx * len, my - dy * len, mx + dx * len, my + dy * len);
    g.addColorStop(0, hexA(state.fillC1, a));
    g.addColorStop(1, hexA(state.fillC2, a));
    c.fillStyle = g;
    c.fillRect(cx, cy, cw, ch);
  } else if (state.glass === "mirror") {
    // 鏡面偏暗、對比強
    c.fillStyle = tintColor(0.55);
    c.fillRect(cx, cy, cw, ch);
    const dark = c.createLinearGradient(cx, cy, cx + cw, cy + ch);
    dark.addColorStop(0, "rgba(8,10,16,0.05)");
    dark.addColorStop(1, `rgba(8,10,16,${0.5 * (state.opacity / 100 + 0.4)})`);
    c.fillStyle = dark;
    c.fillRect(cx, cy, cw, ch);
  } else {
    c.fillStyle = tintColor(1);
    c.fillRect(cx, cy, cw, ch);
  }

  // ── 3. 高光 ──
  if (state.glass === "frost") {
    // 霧面:柔和的頂部光暈
    const g = c.createLinearGradient(cx, cy, cx, cy + ch * 0.6);
    g.addColorStop(0, `rgba(255,255,255,${0.16 * shine})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(cx, cy, cw, ch * 0.6);
  } else if (state.glass === "mirror") {
    // 鏡面:銳利的斜向反光帶
    const g = c.createLinearGradient(cx, cy, cx + cw, cy + ch);
    g.addColorStop(0.0, "rgba(255,255,255,0)");
    g.addColorStop(0.30, "rgba(255,255,255,0)");
    g.addColorStop(0.42, `rgba(255,255,255,${0.5 * shine})`);
    g.addColorStop(0.50, `rgba(255,255,255,${0.14 * shine})`);
    g.addColorStop(0.58, "rgba(255,255,255,0)");
    g.addColorStop(1.0, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(cx, cy, cw, ch);
    // 第二道細反光
    const g2 = c.createLinearGradient(cx, cy, cx + cw, cy + ch);
    g2.addColorStop(0.58, "rgba(255,255,255,0)");
    g2.addColorStop(0.62, `rgba(255,255,255,${0.14 * shine})`);
    g2.addColorStop(0.66, "rgba(255,255,255,0)");
    c.fillStyle = g2;
    c.fillRect(cx, cy, cw, ch);
  } else {
    // 液態玻璃:頂部鏡面光斑 + 邊緣折射亮環
    const g = c.createRadialGradient(
      cx + cw * 0.3, cy - ch * 0.15, 0,
      cx + cw * 0.3, cy - ch * 0.15, cw * 0.7
    );
    g.addColorStop(0, `rgba(255,255,255,${0.28 * shine})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(cx, cy, cw, ch);

    // 內側亮環(folded edge)
    const inset = Math.max(2, cw * 0.012);
    c.save();
    roundRectPath(c, cx + inset, cy + inset, cw - inset * 2, ch - inset * 2, Math.max(1, r - inset));
    const eg = c.createLinearGradient(cx, cy, cx + cw * 0.4, cy + ch);
    eg.addColorStop(0, `rgba(255,255,255,${0.5 * shine})`);
    eg.addColorStop(0.4, "rgba(255,255,255,0.04)");
    eg.addColorStop(0.85, "rgba(255,255,255,0.02)");
    eg.addColorStop(1, `rgba(255,255,255,${0.32 * shine})`);
    c.strokeStyle = eg;
    c.lineWidth = inset * 1.6;
    c.stroke();
    c.restore();
  }

  c.restore(); // un-clip

  // ── 4. 外框 ──
  roundRectPath(c, cx, cy, cw, ch, r);
  if (state.glass === "mirror") {
    const bg = c.createLinearGradient(cx, cy, cx + cw, cy + ch);
    bg.addColorStop(0, `rgba(255,255,255,${0.55 * shine + 0.1})`);
    bg.addColorStop(0.5, "rgba(255,255,255,0.08)");
    bg.addColorStop(1, `rgba(255,255,255,${0.3 * shine})`);
    c.strokeStyle = bg;
    c.lineWidth = Math.max(1, cw * 0.0035);
  } else {
    c.strokeStyle = `rgba(255,255,255,${0.14 + 0.2 * shine})`;
    c.lineWidth = Math.max(1, cw * 0.0022);
  }
  c.stroke();
}

/* ─────────────────────────────
   卡片內容
   ───────────────────────────── */
function inkColors() {
  const mode = state.ink === "auto" ? state.inkAuto : state.ink;
  if (mode === "dark") {
    return { main: "rgba(20,22,28,0.96)", sub: "rgba(20,22,28,0.6)", track: "rgba(20,22,28,0.18)" };
  }
  return { main: "rgba(255,255,255,0.97)", sub: "rgba(255,255,255,0.66)", track: "rgba(255,255,255,0.25)" };
}

function fmtTime(sec) {
  sec = Math.max(0, Math.round(sec));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

function currentProgress(t) {
  if (!state.animateBar) return state.progress / 100;
  const p0 = state.progress / 100;
  return (p0 + t / state.songLen) % 1;
}

function drawCover(c, x, y, size, r) {
  c.save();
  roundRectPath(c, x, y, size, size, r);
  c.clip();
  const src = (state.coverMode === "upload" && state.cover) ? state.cover : state.media;
  if (src) {
    const sw = state.isVideo && src === state.media ? src.videoWidth : src.naturalWidth || src.videoWidth;
    const sh = state.isVideo && src === state.media ? src.videoHeight : src.naturalHeight || src.videoHeight;
    const sc = Math.max(size / sw, size / sh);
    c.drawImage(src, x + (size - sw * sc) / 2, y + (size - sh * sc) / 2, sw * sc, sh * sc);
  } else {
    c.fillStyle = "#2a3148";
    c.fillRect(x, y, size, size);
  }
  // 封面內側光
  const g = c.createLinearGradient(x, y, x, y + size);
  g.addColorStop(0, "rgba(255,255,255,0.1)");
  g.addColorStop(0.25, "rgba(255,255,255,0)");
  c.fillStyle = g;
  c.fillRect(x, y, size, size);
  c.restore();
  roundRectPath(c, x, y, size, size, r);
  c.strokeStyle = "rgba(255,255,255,0.14)";
  c.lineWidth = Math.max(1, size * 0.004);
  c.stroke();
}

function truncateText(c, text, maxW) {
  if (c.measureText(text).width <= maxW) return text;
  while (text.length > 1 && c.measureText(text + "…").width > maxW) {
    text = text.slice(0, -1);
  }
  return text + "…";
}

function drawIconPrev(c, x, y, s, color) {
  c.fillStyle = color;
  c.fillRect(x - s * 0.5, y - s * 0.42, s * 0.12, s * 0.84);
  c.beginPath();
  c.moveTo(x + s * 0.5, y - s * 0.42);
  c.lineTo(x + s * 0.5, y + s * 0.42);
  c.lineTo(x - s * 0.28, y);
  c.closePath();
  c.fill();
}

function drawIconNext(c, x, y, s, color) {
  c.fillStyle = color;
  c.fillRect(x + s * 0.38, y - s * 0.42, s * 0.12, s * 0.84);
  c.beginPath();
  c.moveTo(x - s * 0.5, y - s * 0.42);
  c.lineTo(x - s * 0.5, y + s * 0.42);
  c.lineTo(x + s * 0.28, y);
  c.closePath();
  c.fill();
}

// 圓形播放/暫停鍵(實心圓 + 反色符號)
function drawIconPlayCircle(c, x, y, r, color, inverse, playing) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = color;
  c.fill();
  c.fillStyle = inverse;
  if (playing) {
    const bw = r * 0.24;
    const bh = r * 0.78;
    const gap = r * 0.16;
    roundRectPath(c, x - gap - bw, y - bh / 2, bw, bh, bw * 0.3);
    c.fill();
    roundRectPath(c, x + gap, y - bh / 2, bw, bh, bw * 0.3);
    c.fill();
  } else {
    const s = r * 0.85;
    c.beginPath();
    c.moveTo(x - s * 0.34, y - s * 0.5);
    c.lineTo(x - s * 0.34, y + s * 0.5);
    c.lineTo(x + s * 0.62, y);
    c.closePath();
    c.fill();
  }
}

function drawIconHeart(c, x, y, s, color) {
  c.save();
  c.translate(x, y);
  c.scale(s / 24, s / 24);
  c.beginPath();
  c.moveTo(0, 8);
  c.bezierCurveTo(-12, -1, -8.5, -13, 0, -6.5);
  c.bezierCurveTo(8.5, -13, 12, -1, 0, 8);
  c.closePath();
  c.strokeStyle = color;
  c.lineWidth = 2.2;
  c.lineJoin = "round";
  c.stroke();
  c.restore();
}

function drawIconPlus(c, x, y, s, color) {
  c.strokeStyle = color;
  c.lineWidth = Math.max(1, s * 0.09);
  c.lineCap = "round";
  c.beginPath();
  c.arc(x, y, s * 0.55, 0, Math.PI * 2);
  c.stroke();
  c.beginPath();
  c.moveTo(x - s * 0.26, y);
  c.lineTo(x + s * 0.26, y);
  c.moveTo(x, y - s * 0.26);
  c.lineTo(x, y + s * 0.26);
  c.stroke();
}

// 喇叭圖示;loud = true 時加上音波弧線
function drawIconSpeaker(c, x, y, s, color, loud) {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(x - s * 0.5, y - s * 0.22);
  c.lineTo(x - s * 0.2, y - s * 0.22);
  c.lineTo(x + s * 0.12, y - s * 0.5);
  c.lineTo(x + s * 0.12, y + s * 0.5);
  c.lineTo(x - s * 0.2, y + s * 0.22);
  c.lineTo(x - s * 0.5, y + s * 0.22);
  c.closePath();
  c.fill();
  if (loud) {
    c.strokeStyle = color;
    c.lineWidth = Math.max(1, s * 0.11);
    c.lineCap = "round";
    c.beginPath();
    c.arc(x + s * 0.18, y, s * 0.36, -Math.PI / 3, Math.PI / 3);
    c.stroke();
    c.beginPath();
    c.arc(x + s * 0.18, y, s * 0.62, -Math.PI / 3, Math.PI / 3);
    c.stroke();
  }
}

function drawContent(c, w, h, L, t) {
  const { cx, cy, cw, ch, pad, r, vertical, m } = L;
  const ink = inkColors();
  const p = currentProgress(t);
  const mode = state.ink === "auto" ? state.inkAuto : state.ink;
  const inverse = mode === "dark" ? "rgba(250,250,252,0.97)" : "rgba(22,24,30,0.95)";
  const hasCover = state.coverMode !== "none";
  const mid = cx + cw / 2;

  if (vertical) {
    let y = cy + pad;

    if (hasCover) {
      drawCover(c, mid - m.cover / 2, y, m.cover, r * 0.5);
      y += m.cover + m.gapCover;
    }

    c.textBaseline = "top";
    c.textAlign = "center";
    c.font = `700 ${m.titleSize}px "Noto Sans TC", sans-serif`;
    c.fillStyle = ink.main;
    c.fillText(truncateText(c, state.title, cw - pad * 2), mid, y);
    y += m.titleSize + m.gapSub;

    c.font = `500 ${m.subSize}px "Noto Sans TC", sans-serif`;
    c.fillStyle = ink.sub;
    c.fillText(truncateText(c, state.artist, cw - pad * 2), mid, y);
    y += m.subSize + m.gapBar;

    drawProgressBar(c, cx + pad, y, cw - pad * 2, m.barH, p, ink);
    y += m.barH;

    if (state.showTime) {
      y += m.gapTime;
      c.textBaseline = "top";
      c.font = `500 ${m.timeSize}px Inter, sans-serif`;
      c.fillStyle = ink.sub;
      c.textAlign = "left";
      c.fillText(fmtTime(p * state.songLen), cx + pad, y);
      c.textAlign = "right";
      c.fillText(fmtTime(state.songLen), cx + cw - pad, y);
      y += m.timeSize;
    }

    if (state.showControls) {
      y += m.gapCtrl;
      const cyy = y + m.playR;
      const sp = cw * 0.155;
      drawIconHeart(c, mid - sp * 2, cyy, m.iconS, ink.main);
      drawIconPrev(c, mid - sp, cyy, m.iconS, ink.main);
      drawIconPlayCircle(c, mid, cyy, m.playR, ink.main, inverse, state.animateBar);
      drawIconNext(c, mid + sp, cyy, m.iconS, ink.main);
      drawIconPlus(c, mid + sp * 2, cyy, m.iconS, ink.main);
      y += m.playR * 2;
    }

    if (state.showVolume) {
      y += m.gapVol;
      const vy = y + m.volSize / 2;
      const trackW = cw * 0.52;
      const vx = mid - trackW / 2;
      const vh = Math.max(2, m.volSize * 0.18);
      drawIconSpeaker(c, vx - m.volSize * 1.6, vy, m.volSize, ink.main, false);
      roundRectPath(c, vx, vy - vh / 2, trackW, vh, vh / 2);
      c.fillStyle = ink.track;
      c.fill();
      roundRectPath(c, vx, vy - vh / 2, trackW * 0.62, vh, vh / 2);
      c.fillStyle = ink.main;
      c.fill();
      c.beginPath();
      c.arc(vx + trackW * 0.62, vy, m.volSize * 0.26, 0, Math.PI * 2);
      c.fill();
      drawIconSpeaker(c, vx + trackW + m.volSize * 1.6, vy, m.volSize, ink.main, true);
    }
  } else {
    // 橫式:封面(可選)在左,文字在右,進度與控制鍵在下
    const headY = cy + pad;
    let tx = cx + pad;
    let textW = cw - pad * 2;

    if (hasCover) {
      drawCover(c, cx + pad, headY, m.art, r * 0.5);
      tx = cx + pad + m.art + pad * 0.9;
      textW = cx + cw - pad - tx;
    }

    c.textBaseline = "top";
    c.textAlign = "left";
    c.font = `700 ${m.titleSize}px "Noto Sans TC", sans-serif`;
    c.fillStyle = ink.main;
    c.fillText(truncateText(c, state.title, textW), tx, headY + (hasCover ? m.art * 0.06 : 0));
    c.font = `500 ${m.subSize}px "Noto Sans TC", sans-serif`;
    c.fillStyle = ink.sub;
    c.fillText(truncateText(c, state.artist, textW), tx, headY + m.titleSize + cw * 0.014 + (hasCover ? m.art * 0.06 : 0));

    let y = headY + (hasCover ? m.art : m.titleSize + m.subSize + cw * 0.014) + m.gapBar;
    drawProgressBar(c, cx + pad, y, cw - pad * 2, m.barH, p, ink);
    y += m.barH;

    if (state.showTime) {
      y += m.gapTime;
      c.textBaseline = "top";
      c.font = `500 ${m.timeSize}px Inter, sans-serif`;
      c.fillStyle = ink.sub;
      c.textAlign = "left";
      c.fillText(fmtTime(p * state.songLen), cx + pad, y);
      c.textAlign = "right";
      c.fillText(fmtTime(state.songLen), cx + cw - pad, y);
      y += m.timeSize;
    }

    if (state.showControls) {
      y += m.gapCtrl;
      const cyy = y + m.playR;
      const sp = cw * 0.085;
      drawIconHeart(c, mid - sp * 2, cyy, m.iconS, ink.main);
      drawIconPrev(c, mid - sp, cyy, m.iconS, ink.main);
      drawIconPlayCircle(c, mid, cyy, m.playR, ink.main, inverse, state.animateBar);
      drawIconNext(c, mid + sp, cyy, m.iconS, ink.main);
      drawIconPlus(c, mid + sp * 2, cyy, m.iconS, ink.main);
    }
  }
}

function drawProgressBar(c, x, y, w, h, p, ink) {
  // 軌道
  roundRectPath(c, x, y, w, h, h / 2);
  c.fillStyle = ink.track;
  c.fill();
  // 進度
  const fw = Math.max(h, w * p);
  roundRectPath(c, x, y, fw, h, h / 2);
  c.fillStyle = ink.main;
  c.fill();
  // 圓點
  c.beginPath();
  c.arc(x + fw, y + h / 2, h * 1.7, 0, Math.PI * 2);
  c.fillStyle = ink.main;
  c.fill();
}

/* ─────────────────────────────
   主繪製
   ───────────────────────────── */
// still = true 時跳過開場動畫(輸出靜態圖用)
function drawFrame(c, w, h, t, still) {
  drawBackground(c, w, h);
  if (!state.media) return;
  updateBlurCanvas(c.canvas, w, h);

  const L = cardLayout(w, h);
  let alpha = 1;
  let zoom = 1;
  if (!still && state.intro !== "none") {
    const e = Math.min(1, t / state.introDur);
    const ease = 1 - Math.pow(1 - e, 3);   // easeOutCubic
    alpha = ease;
    if (state.intro === "slideDown") L.cy -= (1 - ease) * L.ch * 0.5;
    if (state.intro === "slideUp") L.cy += (1 - ease) * L.ch * 0.5;
    if (state.intro === "zoom") zoom = 0.85 + 0.15 * ease;
  }

  c.save();
  c.globalAlpha = alpha;
  if (zoom !== 1) {
    const mx = L.cx + L.cw / 2;
    const my = L.cy + L.ch / 2;
    c.translate(mx, my);
    c.scale(zoom, zoom);
    c.translate(-mx, -my);
  }
  drawGlass(c, w, h, L);
  drawContent(c, w, h, L, t);
  c.restore();
}

function loop() {
  drawFrame(ctx, cv.width, cv.height, clock());
  state.raf = requestAnimationFrame(loop);
}

/* ─────────────────────────────
   自動文字顏色(取卡片區平均亮度)
   ───────────────────────────── */
let inkTimer = 0;
function requestInk() {
  clearTimeout(inkTimer);
  inkTimer = setTimeout(computeInk, 120);
}
function computeInk() {
  if (!state.media) return;
  const w = cv.width, h = cv.height;
  const L = cardLayout(w, h);
  const tiny = document.createElement("canvas");
  tiny.width = 1; tiny.height = 1;
  const tc = tiny.getContext("2d", { willReadFrequently: true });
  // 從模糊底圖取卡片區域平均色
  tc.drawImage(blurC,
    (L.cx / w) * blurC.width, (L.cy / h) * blurC.height,
    (L.cw / w) * blurC.width, (L.ch / h) * blurC.height,
    0, 0, 1, 1);
  const d = tc.getImageData(0, 0, 1, 1).data;
  let lum = (0.299 * d[0] + 0.587 * d[1] + 0.114 * d[2]) / 255;
  // 把卡片色系的影響算進去
  const a = state.opacity / 100;
  let glassLum;
  if (state.fill === "solid") {
    glassLum = hexLum(state.fillC1);
  } else if (state.fill === "gradient") {
    glassLum = (hexLum(state.fillC1) + hexLum(state.fillC2)) / 2;
  } else {
    glassLum = state.tint >= 0 ? 0.93 : 0.12;
  }
  lum = lum * (1 - a) + glassLum * a;
  state.inkAuto = lum > 0.62 ? "dark" : "light";
}

/* ─────────────────────────────
   預覽畫面拖曳卡片
   ───────────────────────────── */
let dragging = false;
let dragOff = { x: 0, y: 0 };

// object-fit: contain 的座標換算(畫布 bitmap 在元素內置中縮放)
function canvasPoint(e) {
  const rect = cv.getBoundingClientRect();
  const scale = Math.min(rect.width / cv.width, rect.height / cv.height);
  const ox = rect.left + (rect.width - cv.width * scale) / 2;
  const oy = rect.top + (rect.height - cv.height * scale) / 2;
  return { x: (e.clientX - ox) / scale, y: (e.clientY - oy) / scale };
}

cv.addEventListener("mousedown", e => {
  if (!state.media) return;
  const { x: px, y: py } = canvasPoint(e);
  const L = cardLayout(cv.width, cv.height);
  if (px >= L.cx && px <= L.cx + L.cw && py >= L.cy && py <= L.cy + L.ch) {
    dragging = true;
    dragOff.x = px - L.cx;
    dragOff.y = py - L.cy;
  }
});
window.addEventListener("mousemove", e => {
  if (!dragging) return;
  const { x: px, y: py } = canvasPoint(e);
  const L = cardLayout(cv.width, cv.height);
  const freeW = cv.width - L.cw;
  const freeH = cv.height - L.ch;
  state.cardX = freeW > 0 ? Math.min(100, Math.max(0, ((px - dragOff.x) / freeW) * 100)) : 50;
  state.cardY = freeH > 0 ? Math.min(100, Math.max(0, ((py - dragOff.y) / freeH) * 100)) : 50;
  $("#cardX").value = state.cardX;
  $("#cardY").value = state.cardY;
  $("#posXVal").textContent = Math.round(state.cardX) + "%";
  $("#posYVal").textContent = Math.round(state.cardY) + "%";
});
window.addEventListener("mouseup", () => {
  if (dragging) { dragging = false; requestInk(); }
});

/* ─────────────────────────────
   UI 綁定
   ───────────────────────────── */
// Tabs
$$(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    $$(".tab").forEach(x => x.classList.toggle("on", x === tab));
    $$(".panel").forEach(p => p.classList.toggle("on", p.dataset.panel === tab.dataset.tab));
  });
});

// 文字
$("#songTitle").addEventListener("input", e => { state.title = e.target.value || " "; });
$("#songArtist").addEventListener("input", e => { state.artist = e.target.value || " "; });

// 封面來源
function syncCoverButtons() {
  $$("[data-cover]").forEach(b => b.classList.toggle("on", b.dataset.cover === state.coverMode));
}
$$("[data-cover]").forEach(btn => {
  btn.addEventListener("click", () => {
    if (btn.dataset.cover === "upload") {
      // 已有上傳過的封面就直接切換,否則開檔案選擇
      if (state.cover) {
        state.coverMode = "upload";
        syncCoverButtons();
      } else {
        coverFi.click();
      }
      return;
    }
    state.coverMode = btn.dataset.cover;
    syncCoverButtons();
    requestInk();
  });
});

// 滑桿:統一綁定 helper
function bindRange(id, valId, fn, fmt) {
  const el = $(id);
  el.addEventListener("input", () => {
    const v = Number(el.value);
    fn(v);
    if (valId) $(valId).textContent = fmt ? fmt(v) : v;
    requestInk();
  });
}

bindRange("#playProgress", "#progressVal", v => { state.progress = v; resetClock(); }, v => v + "%");

// 歌曲長度:手動輸入 mm:ss 或純秒數
function parseTimeInput(s) {
  s = s.trim();
  const m = s.match(/^(\d{1,3}):([0-5]?\d)$/);
  if (m) return Math.min(5999, Number(m[1]) * 60 + Number(m[2]));
  if (/^\d+$/.test(s)) return Math.min(5999, Number(s));
  return null;
}
$("#songLenText").addEventListener("input", e => {
  const v = parseTimeInput(e.target.value);
  e.target.style.borderColor = v ? "" : "rgba(232,176,74,0.7)";
  if (v) {
    state.songLen = v;
    $("#songLenVal").textContent = fmtTime(v);
  }
});
$("#songLenText").addEventListener("blur", e => {
  // 失焦時正規化顯示
  if (parseTimeInput(e.target.value)) e.target.value = fmtTime(state.songLen);
  e.target.style.borderColor = "";
});

// 開場動畫
$$("[data-intro]").forEach(btn => {
  btn.addEventListener("click", () => {
    state.intro = btn.dataset.intro;
    $$("[data-intro]").forEach(x => x.classList.toggle("on", x === btn));
    resetClock();
  });
});
bindRange("#introDur", "#introDurVal", v => { state.introDur = v; resetClock(); }, v => v.toFixed(1) + "s");
$("#introReplay").addEventListener("click", resetClock);

// 卡片色系
function syncFillRows() {
  $("#fillRows").style.display = state.fill === "auto" ? "none" : "";
  $("#fillC2Row").style.display = state.fill === "gradient" ? "" : "none";
  $("#fillAngleRow").style.display = state.fill === "gradient" ? "" : "none";
}
$$("[data-fill]").forEach(btn => {
  btn.addEventListener("click", () => {
    state.fill = btn.dataset.fill;
    $$("[data-fill]").forEach(x => x.classList.toggle("on", x === btn));
    syncFillRows();
    requestInk();
  });
});
$("#fillC1").addEventListener("input", e => { state.fillC1 = e.target.value; requestInk(); });
$("#fillC2").addEventListener("input", e => { state.fillC2 = e.target.value; requestInk(); });
bindRange("#fillAngle", "#fillAngleVal", v => { state.fillAngle = v; }, v => v + "°");
bindRange("#glassBlur", "#blurVal", v => { state.blur = v; });
bindRange("#glassOpacity", "#opacityVal", v => { state.opacity = v; }, v => v + "%");
bindRange("#glassShine", "#shineVal", v => { state.shine = v; }, v => v + "%");
bindRange("#glassRadius", "#radiusVal", v => { state.radius = v; });
bindRange("#glassTint", "#tintVal", v => { state.tint = v; }, v => v === 0 ? "中性" : (v > 0 ? "亮 " + v : "暗 " + (-v)));
bindRange("#bgBlur", "#bgBlurVal", v => { state.bgBlur = v; });
bindRange("#bgDim", "#bgDimVal", v => { state.bgDim = v; }, v => v + "%");
bindRange("#cardX", "#posXVal", v => { state.cardX = v; }, v => v + "%");
bindRange("#cardY", "#posYVal", v => { state.cardY = v; }, v => v + "%");
bindRange("#cardScale", "#scaleVal", v => { state.cardScale = v; }, v => v + "%");
bindRange("#mediaZoom", "#mediaZoomVal", v => { state.mediaZoom = v; }, v => v + "%");
bindRange("#mediaX", "#mediaXVal", v => { state.mediaX = v; }, v => v + "%");
bindRange("#mediaY", "#mediaYVal", v => { state.mediaY = v; }, v => v + "%");
bindRange("#outDur", "#durVal", v => { state.dur = v; }, v => v + "s");

// Checkbox
$("#showControls").addEventListener("change", e => { state.showControls = e.target.checked; });
$("#showTime").addEventListener("change", e => { state.showTime = e.target.checked; });
$("#showVolume").addEventListener("change", e => { state.showVolume = e.target.checked; });
$("#animateBar").addEventListener("change", e => { state.animateBar = e.target.checked; resetClock(); });

// 文字顏色
$$("[data-ink]").forEach(btn => {
  btn.addEventListener("click", () => {
    state.ink = btn.dataset.ink;
    $$("[data-ink]").forEach(x => x.classList.toggle("on", x === btn));
  });
});

// 玻璃材質
$$(".glass-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    state.glass = btn.dataset.glass;
    $$(".glass-btn").forEach(x => x.classList.toggle("on", x === btn));
    // 各材質的建議預設
    if (state.glass === "frost") { setRange("#glassBlur", 24); setRange("#glassOpacity", 35); setRange("#glassShine", 50); }
    if (state.glass === "mirror") { setRange("#glassBlur", 10); setRange("#glassOpacity", 30); setRange("#glassShine", 65); }
    if (state.glass === "liquid") { setRange("#glassBlur", 16); setRange("#glassOpacity", 18); setRange("#glassShine", 70); }
    requestInk();
  });
});
function setRange(id, v) {
  const el = $(id);
  el.value = v;
  el.dispatchEvent(new Event("input"));
}

// 卡片樣式
$$("[data-card]").forEach(btn => {
  btn.addEventListener("click", () => {
    state.card = btn.dataset.card;
    $$("[data-card]").forEach(x => x.classList.toggle("on", x === btn));
    requestInk();
  });
});

// 輸出尺寸
$$(".size-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    state.outW = Number(btn.dataset.w);
    state.outH = Number(btn.dataset.h);
    $$(".size-btn").forEach(x => x.classList.toggle("on", x === btn));
    applyCanvasSize();
    requestInk();
  });
});

function applyCanvasSize() {
  cv.width = state.outW;
  cv.height = state.outH;
  $("#metaSize").textContent = `輸出 ${state.outW}×${state.outH}`;
}

/* ─────────────────────────────
   匯出共用
   ───────────────────────────── */
function showProgress(p, txt) {
  const bar = $("#prog");
  bar.style.display = "";
  $("#progFill").style.width = p + "%";
  $("#progText").textContent = txt;
  if (p >= 100) setTimeout(() => { bar.style.display = "none"; }, 2400);
}

function disableExport(v) {
  state.exporting = v;
  $("#btnPng").disabled = v;
  $("#btnVideo").disabled = v;
}

function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/* ─────────────────────────────
   匯出:PNG
   ───────────────────────────── */
$("#btnPng").addEventListener("click", () => {
  if (!state.media || state.exporting) return;
  const w = state.outW, h = state.outH;
  // 直接以目前畫面狀態輸出(t = 目前時鐘,進度條停在當下)
  const off = document.createElement("canvas");
  off.width = w; off.height = h;
  drawFrame(off.getContext("2d"), w, h, state.animateBar ? clock() : 0, true);
  off.toBlob(b => {
    download(b, `template_music_${w}x${h}.png`);
    showProgress(100, "PNG 輸出完成!");
  }, "image/png");
});

/* ─────────────────────────────
   匯出:影片
   ───────────────────────────── */
function pickMime() {
  if (typeof MediaRecorder === "undefined") return null;
  if (MediaRecorder.isTypeSupported("video/mp4")) return "video/mp4";
  if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) return "video/webm;codecs=vp9";
  return "video/webm";
}

function getBitrate(w, h) {
  return Math.min(20e6, Math.round(w * h * 6.5));
}

$("#btnVideo").addEventListener("click", async () => {
  if (!state.media || state.exporting) return;
  const mime = pickMime();
  if (!mime) { showProgress(100, "此瀏覽器不支援影片輸出"); return; }

  disableExport(true);
  cancelAnimationFrame(state.raf);

  const w = state.outW, h = state.outH;
  const ext = mime.startsWith("video/mp4") ? "mp4" : "webm";
  const off = document.createElement("canvas");
  off.width = w; off.height = h;
  const offCtx = off.getContext("2d");

  const stream = off.captureStream(FPS);
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: getBitrate(w, h) });
  const chunks = [];
  recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };

  let stopped = false;
  let drawRaf = 0;

  const finish = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(drawRaf);
    try { recorder.stop(); } catch (e) {}
  };

  recorder.onstop = () => {
    download(new Blob(chunks, { type: mime }), `template_music_${w}x${h}.${ext}`);
    showProgress(100, `影片輸出完成!(${ext.toUpperCase()})`);
    disableExport(false);
    if (state.isVideo) { state.media.loop = true; state.media.play(); }
    resetClock();
    state.playing = true;
    loop();
  };

  const dur = state.isVideo ? state.media.duration : state.dur;

  // 影片素材:從頭播放並跟著錄
  if (state.isVideo) {
    const v = state.media;
    v.pause();
    v.loop = false;
    v.currentTime = 0;
    await new Promise(r => v.addEventListener("seeked", r, { once: true }));

    const watchdog = setTimeout(finish, dur * 1000 + 6000);
    const start = performance.now();
    const drawLoop = () => {
      const t = (performance.now() - start) / 1000;
      drawFrame(offCtx, w, h, t);
      showProgress(Math.min(99, (v.currentTime / dur) * 100 | 0), `錄製中 ${v.currentTime.toFixed(1)} / ${dur.toFixed(1)}s`);
      if (v.ended || v.currentTime >= dur - 0.05) {
        clearTimeout(watchdog);
        setTimeout(finish, 120);
        return;
      }
      drawRaf = requestAnimationFrame(drawLoop);
    };
    recorder.start();
    drawLoop();
    await v.play();
    return;
  }

  // 圖片素材:實時錄 dur 秒
  const watchdog = setTimeout(finish, dur * 1000 + 6000);
  const start = performance.now();
  const drawLoop = () => {
    const t = (performance.now() - start) / 1000;
    drawFrame(offCtx, w, h, t);
    showProgress(Math.min(99, (t / dur) * 100 | 0), `錄製中 ${t.toFixed(1)} / ${dur}s`);
    if (t >= dur) {
      clearTimeout(watchdog);
      setTimeout(finish, 120);
      return;
    }
    drawRaf = requestAnimationFrame(drawLoop);
  };
  recorder.start();
  drawLoop();
});

// 依瀏覽器支援格式調整按鈕標示
(function reflectVideoFormat() {
  const mime = pickMime();
  if (!mime) {
    $("#videoNote").textContent = "此瀏覽器不支援影片輸出。";
  } else if (!mime.startsWith("video/mp4")) {
    $("#videoFmt").textContent = "WebM";
    $("#videoNote").textContent = "此瀏覽器將輸出 WebM 格式(非 MP4)。";
  }
})();

/* ─────────────────────────────
   啟動
   ───────────────────────────── */
applyCanvasSize();
resetClock();
loop();
// 預載 canvas 會用到的字重;載入完成後下一幀自動換上
document.fonts.load('700 40px "Noto Sans TC"');
document.fonts.load('500 40px "Noto Sans TC"');
document.fonts.load("500 40px Inter");
