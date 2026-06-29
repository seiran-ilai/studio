/* ═══════════════════════════════════════════
   Template Studio — index.js
   共用引擎:媒體載入、玻璃質感、預覽拖曳、輸出、模板註冊器
   模板透過 window.Engine.register({...}) 註冊自己。
   ═══════════════════════════════════════════ */

"use strict";

window.Engine = (function () {

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return Array.from(document.querySelectorAll(sel)); }

  const FPS = 30;

  /* ─────────────────────────────
     共用 State(所有模板共享:素材、玻璃、版面、輸出)
     ───────────────────────────── */
  const state = {
    // 素材
    media: null,          // HTMLImageElement | HTMLVideoElement
    isVideo: false,
    mediaName: "",

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

    // 版面(卡片位置 / 素材填滿)
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

  // 模板註冊表
  const registry = [];
  let active = null;

  /* ─────────────────────────────
     繪圖小工具
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

  /* ─────────────────────────────
     素材載入
     ───────────────────────────── */
  const fi = $("#fi");
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
    const durGroup = $("#durGroup");
    if (durGroup) durGroup.style.display = state.isVideo ? "none" : "";
    resetClock();
    if (active && active.onMediaReady) active.onMediaReady();
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
     自動文字顏色:取卡片區平均亮度(含玻璃色系影響)
     ───────────────────────────── */
  function cardLuminance(L) {
    const w = cv.width, h = cv.height;
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
    return lum * (1 - a) + glassLum * a;
  }

  let inkTimer = 0;
  function requestInk() {
    clearTimeout(inkTimer);
    inkTimer = setTimeout(() => {
      if (!state.media || !active || !active.onInk) return;
      active.onInk();
    }, 120);
  }

  /* ─────────────────────────────
     主繪製
     ───────────────────────────── */
  // still = true 時跳過開場動畫(輸出靜態圖用)
  function drawFrame(c, w, h, t, still) {
    drawBackground(c, w, h);
    if (!state.media || !active) return;
    updateBlurCanvas(c.canvas, w, h);

    const L = active.layout(w, h);
    let alpha = 1;
    let zoom = 1;
    if (!still && active.applyIntro) {
      const r = active.applyIntro(L, t);
      if (r) { alpha = r.alpha; zoom = r.zoom; }
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
    active.drawContent(c, w, h, L, t);
    c.restore();
  }

  /* ─────────────────────────────
     卡片位置緩動(拖曳/對齊/滑桿共用,提供滑順手感)
     ───────────────────────────── */
  const cardTarget = { x: state.cardX, y: state.cardY };

  function easeCardPos() {
    const dx = cardTarget.x - state.cardX;
    const dy = cardTarget.y - state.cardY;
    if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) {
      if (dx || dy) { state.cardX = cardTarget.x; state.cardY = cardTarget.y; syncPosUI(); }
      return;
    }
    state.cardX += dx * 0.3;
    state.cardY += dy * 0.3;
    syncPosUI();
  }

  function syncPosUI() {
    const xEl = $("#cardX"), yEl = $("#cardY");
    if (!xEl || !yEl) return;
    xEl.value = state.cardX;
    yEl.value = state.cardY;
    $("#posXVal").textContent = Math.round(state.cardX) + "%";
    $("#posYVal").textContent = Math.round(state.cardY) + "%";
  }

  // 拖曳吸附輔助線(只畫在預覽,不會進輸出)
  function drawGuides() {
    if (!dragging) return;
    const w = cv.width, h = cv.height;
    ctx.save();
    ctx.strokeStyle = "rgba(143,180,255,0.85)";
    ctx.lineWidth = Math.max(1.5, w / 720);
    ctx.setLineDash([w * 0.014, w * 0.009]);
    if (dragGuide.v !== null) {
      ctx.beginPath();
      ctx.moveTo(dragGuide.v, 0);
      ctx.lineTo(dragGuide.v, h);
      ctx.stroke();
    }
    if (dragGuide.h !== null) {
      ctx.beginPath();
      ctx.moveTo(0, dragGuide.h);
      ctx.lineTo(w, dragGuide.h);
      ctx.stroke();
    }
    ctx.restore();
  }

  function loop() {
    easeCardPos();
    drawFrame(ctx, cv.width, cv.height, clock());
    drawGuides();
    state.raf = requestAnimationFrame(loop);
  }

  /* ─────────────────────────────
     預覽畫面拖曳卡片(卡片內容的命中交給模板 hitTest)
     ───────────────────────────── */
  let dragging = false;          // 拖曳卡片(引擎)
  let tplDragging = false;       // 模板自定義拖曳(如封面平移)
  let dragOff = { x: 0, y: 0 };
  const dragGuide = { v: null, h: null };
  const SNAP_STOPS = [5, 50, 95];   // 對齊九宮格使用相同的停靠點

  // object-fit: contain 的座標換算(畫布 bitmap 在元素內置中縮放)
  function canvasPoint(e) {
    const rect = cv.getBoundingClientRect();
    const scale = Math.min(rect.width / cv.width, rect.height / cv.height);
    const ox = rect.left + (rect.width - cv.width * scale) / 2;
    const oy = rect.top + (rect.height - cv.height * scale) / 2;
    return { x: (e.clientX - ox) / scale, y: (e.clientY - oy) / scale };
  }

  cv.addEventListener("mousedown", e => {
    if (!state.media || !active) return;
    const { x: px, y: py } = canvasPoint(e);
    const L = active.layout(cv.width, cv.height);
    // 先問模板要不要接手(例如點在封面上平移封面圖片)
    if (active.hitTest && active.hitTest(px, py, L)) {
      tplDragging = true;
      return;
    }
    if (px >= L.cx && px <= L.cx + L.cw && py >= L.cy && py <= L.cy + L.ch) {
      dragging = true;
      dragOff.x = px - L.cx;
      dragOff.y = py - L.cy;
      // 接手前先把殘留的緩動目標歸位,避免跳動
      cardTarget.x = state.cardX;
      cardTarget.y = state.cardY;
    }
  });

  window.addEventListener("mousemove", e => {
    if (tplDragging) {
      const { x: px, y: py } = canvasPoint(e);
      if (active && active.dragMove) active.dragMove(px, py);
      return;
    }
    if (!dragging) return;
    const { x: px, y: py } = canvasPoint(e);
    const L = active.layout(cv.width, cv.height);
    const freeW = cv.width - L.cw;
    const freeH = cv.height - L.ch;
    const SNAP = Math.min(cv.width, cv.height) * 0.016;

    let desX = px - dragOff.x;
    let desY = py - dragOff.y;
    dragGuide.v = null;
    dragGuide.h = null;

    if (freeW > 0) {
      for (const pct of SNAP_STOPS) {
        const pos = (freeW * pct) / 100;
        if (Math.abs(desX - pos) < SNAP) {
          desX = pos;
          dragGuide.v = pct === 50 ? cv.width / 2 : (pct < 50 ? pos : pos + L.cw);
          break;
        }
      }
      cardTarget.x = Math.min(100, Math.max(0, (desX / freeW) * 100));
    }
    if (freeH > 0) {
      for (const pct of SNAP_STOPS) {
        const pos = (freeH * pct) / 100;
        if (Math.abs(desY - pos) < SNAP) {
          desY = pos;
          dragGuide.h = pct === 50 ? cv.height / 2 : (pct < 50 ? pos : pos + L.ch);
          break;
        }
      }
      cardTarget.y = Math.min(100, Math.max(0, (desY / freeH) * 100));
    }
  });

  window.addEventListener("mouseup", () => {
    if (tplDragging) {
      tplDragging = false;
      if (active && active.dragEnd) active.dragEnd();
    }
    if (dragging) {
      dragging = false;
      dragGuide.v = null;
      dragGuide.h = null;
      requestInk();
    }
  });

  /* ─────────────────────────────
     控制面板:tabs / 共用控制元件
     ───────────────────────────── */
  // 新增一個分頁;buildFn(panelEl) 負責填內容。第一個加入的分頁預設選中。
  function addTab(label, buildFn) {
    const tabsEl = $("#tabs");
    const panelsEl = $("#panels");
    const idx = tabsEl.children.length;
    const id = "tab-" + idx;

    const btn = document.createElement("button");
    btn.className = "tab";
    btn.type = "button";
    btn.textContent = label;
    btn.dataset.tab = id;

    const panel = document.createElement("section");
    panel.className = "panel";
    panel.dataset.panel = id;

    tabsEl.appendChild(btn);
    panelsEl.appendChild(panel);
    if (buildFn) buildFn(panel);

    btn.addEventListener("click", () => {
      $$(".tab").forEach(x => x.classList.toggle("on", x === btn));
      $$(".panel").forEach(p => p.classList.toggle("on", p === panel));
    });

    if (idx === 0) {
      btn.classList.add("on");
      panel.classList.add("on");
    }
    return panel;
  }

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

  function setRange(id, v) {
    const el = $(id);
    el.value = v;
    el.dispatchEvent(new Event("input"));
  }

  /* ─────────────────────────────
     共用分頁:質感 / 版面 / 輸出
     ───────────────────────────── */
  function buildGlassTab(panel) {
    panel.innerHTML = `
      <div class="group">
        <div class="group-title">玻璃材質</div>
        <div class="glass-grid">
          <button class="glass-btn on" data-glass="frost" type="button">
            <span class="gb-name">霧面</span><span class="gb-en">Frosted</span>
          </button>
          <button class="glass-btn" data-glass="mirror" type="button">
            <span class="gb-name">鏡面</span><span class="gb-en">Mirror</span>
          </button>
          <button class="glass-btn" data-glass="liquid" type="button">
            <span class="gb-name">液態玻璃</span><span class="gb-en">Liquid</span>
          </button>
        </div>
      </div>
      <div class="group">
        <div class="group-title">卡片色系</div>
        <div class="row">
          <button class="seg-btn on" data-fill="auto" type="button">中性玻璃</button>
          <button class="seg-btn" data-fill="solid" type="button">純色</button>
          <button class="seg-btn" data-fill="gradient" type="button">漸層</button>
        </div>
        <div id="fillRows" style="display:none; margin-top:10px;">
          <label class="color-field"><span>顏色 1</span><input type="color" id="fillC1" value="#33394f"></label>
          <label class="color-field" id="fillC2Row" style="display:none;"><span>顏色 2</span><input type="color" id="fillC2" value="#8fb4ff"></label>
          <label class="slider-row" id="fillAngleRow" style="display:none; margin-top:8px;">
            <span class="field-label">漸層角度 <b id="fillAngleVal">135°</b></span>
            <input type="range" id="fillAngle" min="0" max="360" step="15" value="135">
          </label>
        </div>
        <p class="hint">色彩濃度由下方「不透明度」控制;調低可保留玻璃透視感。</p>
      </div>
      <div class="group">
        <div class="group-title">微調</div>
        <label class="slider-row">
          <span class="field-label">模糊強度 <b id="blurVal">24</b></span>
          <input type="range" id="glassBlur" min="0" max="60" value="24">
        </label>
        <label class="slider-row">
          <span class="field-label">不透明度 <b id="opacityVal">35%</b></span>
          <input type="range" id="glassOpacity" min="0" max="100" value="35">
        </label>
        <label class="slider-row">
          <span class="field-label">高光強度 <b id="shineVal">50%</b></span>
          <input type="range" id="glassShine" min="0" max="100" value="50">
        </label>
        <label class="slider-row">
          <span class="field-label">圓角 <b id="radiusVal">28</b></span>
          <input type="range" id="glassRadius" min="0" max="60" value="28">
        </label>
        <label class="slider-row">
          <span class="field-label">玻璃色調 <b id="tintVal">中性</b></span>
          <input type="range" id="glassTint" min="-100" max="100" value="0">
        </label>
      </div>
      <div class="group">
        <div class="group-title">背景</div>
        <label class="slider-row">
          <span class="field-label">背景模糊 <b id="bgBlurVal">0</b></span>
          <input type="range" id="bgBlur" min="0" max="40" value="0">
        </label>
        <label class="slider-row">
          <span class="field-label">背景壓暗 <b id="bgDimVal">15%</b></span>
          <input type="range" id="bgDim" min="0" max="70" value="15">
        </label>
      </div>`;

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
  }

  function buildLayoutTab(panel) {
    panel.innerHTML = `
      <div class="group">
        <div class="group-title">對齊</div>
        <div class="align-grid">
          <button class="align-btn" data-align="5,5" type="button" aria-label="左上對齊">&#8598;</button>
          <button class="align-btn" data-align="50,5" type="button" aria-label="上方對齊">&#8593;</button>
          <button class="align-btn" data-align="95,5" type="button" aria-label="右上對齊">&#8599;</button>
          <button class="align-btn" data-align="5,50" type="button" aria-label="置左對齊">&#8592;</button>
          <button class="align-btn" data-align="50,50" type="button" aria-label="置中">&#9678;</button>
          <button class="align-btn" data-align="95,50" type="button" aria-label="置右對齊">&#8594;</button>
          <button class="align-btn" data-align="5,95" type="button" aria-label="左下對齊">&#8601;</button>
          <button class="align-btn" data-align="50,95" type="button" aria-label="下方對齊">&#8595;</button>
          <button class="align-btn" data-align="95,95" type="button" aria-label="右下對齊">&#8600;</button>
        </div>
        <p class="hint">拖曳卡片時靠近中線或邊距會自動吸附。</p>
      </div>
      <div class="group">
        <div class="group-title">位置與大小</div>
        <label class="slider-row">
          <span class="field-label">水平位置 <b id="posXVal">50%</b></span>
          <input type="range" id="cardX" min="0" max="100" value="50">
        </label>
        <label class="slider-row">
          <span class="field-label">垂直位置 <b id="posYVal">42%</b></span>
          <input type="range" id="cardY" min="0" max="100" value="42">
        </label>
        <label class="slider-row">
          <span class="field-label">卡片大小 <b id="scaleVal">100%</b></span>
          <input type="range" id="cardScale" min="50" max="150" value="100">
        </label>
        <p class="hint">也可以直接在預覽畫面上拖曳卡片調整位置。</p>
      </div>
      <div class="group">
        <div class="group-title">素材填滿</div>
        <label class="slider-row">
          <span class="field-label">素材縮放 <b id="mediaZoomVal">100%</b></span>
          <input type="range" id="mediaZoom" min="100" max="200" value="100">
        </label>
        <label class="slider-row">
          <span class="field-label">素材水平 <b id="mediaXVal">50%</b></span>
          <input type="range" id="mediaX" min="0" max="100" value="50">
        </label>
        <label class="slider-row">
          <span class="field-label">素材垂直 <b id="mediaYVal">50%</b></span>
          <input type="range" id="mediaY" min="0" max="100" value="50">
        </label>
      </div>`;

    $$(".align-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const [ax, ay] = btn.dataset.align.split(",").map(Number);
        cardTarget.x = ax;
        cardTarget.y = ay;
        requestInk();
      });
    });
    bindRange("#cardX", "#posXVal", v => { state.cardX = v; cardTarget.x = v; }, v => v + "%");
    bindRange("#cardY", "#posYVal", v => { state.cardY = v; cardTarget.y = v; }, v => v + "%");
    bindRange("#cardScale", "#scaleVal", v => { state.cardScale = v; }, v => v + "%");
    bindRange("#mediaZoom", "#mediaZoomVal", v => { state.mediaZoom = v; }, v => v + "%");
    bindRange("#mediaX", "#mediaXVal", v => { state.mediaX = v; }, v => v + "%");
    bindRange("#mediaY", "#mediaYVal", v => { state.mediaY = v; }, v => v + "%");
  }

  function buildOutputTab(panel) {
    panel.innerHTML = `
      <div class="group">
        <div class="group-title">輸出尺寸</div>
        <div class="size-grid" id="sizeGrid">
          <button class="size-btn" data-w="1080" data-h="1080" type="button">
            <span class="sz-ratio r11" aria-hidden="true"></span>
            <span class="sz-name">1:1 方形</span><span class="sz-px">1080×1080・IG 貼文</span>
          </button>
          <button class="size-btn on" data-w="1080" data-h="1350" type="button">
            <span class="sz-ratio r45" aria-hidden="true"></span>
            <span class="sz-name">4:5 直式</span><span class="sz-px">1080×1350・IG / Threads</span>
          </button>
          <button class="size-btn" data-w="1080" data-h="1920" type="button">
            <span class="sz-ratio r916" aria-hidden="true"></span>
            <span class="sz-name">9:16 全直式</span><span class="sz-px">1080×1920・Reels / 限動</span>
          </button>
          <button class="size-btn" data-w="1920" data-h="1080" type="button">
            <span class="sz-ratio r169" aria-hidden="true"></span>
            <span class="sz-name">16:9 橫式</span><span class="sz-px">1920×1080・YouTube / X</span>
          </button>
          <button class="size-btn" data-w="1080" data-h="1440" type="button">
            <span class="sz-ratio r34" aria-hidden="true"></span>
            <span class="sz-name">3:4 直式</span><span class="sz-px">1080×1440・通用</span>
          </button>
        </div>
      </div>
      <div class="group" id="durGroup">
        <div class="group-title">影片長度</div>
        <label class="slider-row">
          <span class="field-label">輸出秒數 <b id="durVal">8s</b></span>
          <input type="range" id="outDur" min="3" max="20" value="8">
        </label>
        <p class="hint" id="durHint">上傳影片時,輸出長度會跟隨影片本身。</p>
      </div>
      <div class="group">
        <div class="group-title">匯出</div>
        <div class="export-row">
          <button class="export-btn" id="btnPng" type="button"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M5 16l4-3.5 3.5 3 3-2.5L19 16"/></svg>輸出圖片<span class="eb-sub">PNG</span></button>
          <button class="export-btn export-btn--video" id="btnVideo" type="button"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 5v14M16 5v14M3 10h5M3 14h5M16 10h5M16 14h5"/></svg>輸出影片<span class="eb-sub" id="videoFmt">MP4</span></button>
        </div>
        <p class="hint" id="videoNote"></p>
      </div>`;

    $$(".size-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        state.outW = Number(btn.dataset.w);
        state.outH = Number(btn.dataset.h);
        $$(".size-btn").forEach(x => x.classList.toggle("on", x === btn));
        applyCanvasSize();
        requestInk();
      });
    });
    bindRange("#outDur", "#durVal", v => { state.dur = v; }, v => v + "s");

    $("#btnPng").addEventListener("click", exportPng);
    $("#btnVideo").addEventListener("click", exportVideo);
    reflectVideoFormat();
  }

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

  function filePrefix() {
    return (active && active.filePrefix) || "template";
  }

  /* ─ 匯出:PNG ─ */
  function exportPng() {
    if (!state.media || state.exporting) return;
    const w = state.outW, h = state.outH;
    // 直接以目前畫面狀態輸出(t = 目前時鐘,進度條停在當下)
    const off = document.createElement("canvas");
    off.width = w; off.height = h;
    const stillT = (active && active.stillTime) ? active.stillTime() : clock();
    drawFrame(off.getContext("2d"), w, h, stillT, true);
    off.toBlob(b => {
      download(b, `${filePrefix()}_${w}x${h}.png`);
      showProgress(100, "PNG 輸出完成!");
    }, "image/png");
  }

  /* ─ 匯出:影片 ─ */
  function pickMime() {
    if (typeof MediaRecorder === "undefined") return null;
    if (MediaRecorder.isTypeSupported("video/mp4")) return "video/mp4";
    if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) return "video/webm;codecs=vp9";
    return "video/webm";
  }

  function getBitrate(w, h) {
    return Math.min(20e6, Math.round(w * h * 6.5));
  }

  async function exportVideo() {
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
      download(new Blob(chunks, { type: mime }), `${filePrefix()}_${w}x${h}.${ext}`);
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
  }

  // 依瀏覽器支援格式調整按鈕標示
  function reflectVideoFormat() {
    const mime = pickMime();
    if (!mime) {
      $("#videoNote").textContent = "此瀏覽器不支援影片輸出。";
    } else if (!mime.startsWith("video/mp4")) {
      $("#videoFmt").textContent = "WebM";
      $("#videoNote").textContent = "此瀏覽器將輸出 WebM 格式(非 MP4)。";
    }
  }

  /* ─────────────────────────────
     模板選單(rail)
     ───────────────────────────── */
  function buildRail() {
    const rail = $("#tplRail");
    registry.forEach(tpl => {
      const btn = document.createElement("button");
      btn.className = "tpl-item" + (tpl === active ? " on" : "");
      btn.type = "button";
      btn.innerHTML = `
        <span class="tpl-thumb" aria-hidden="true">${tpl.thumb || ""}</span>
        <span class="tpl-name">${tpl.name}</span>
        <span class="tpl-desc">${tpl.desc || ""}</span>`;
      // 目前單一模板,點擊即選中(未來多模板時切換)
      rail.appendChild(btn);
    });
    // Coming Soon 佔位
    const soon = document.createElement("div");
    soon.className = "tpl-item is-soon";
    soon.setAttribute("aria-disabled", "true");
    soon.innerHTML = `
      <span class="tpl-thumb tpl-thumb--soon" aria-hidden="true">?</span>
      <span class="tpl-name">Coming Soon</span>
      <span class="tpl-desc">更多模板製作中</span>`;
    rail.appendChild(soon);
  }

  /* ─────────────────────────────
     啟動 / 模板註冊
     ───────────────────────────── */
  function init() {
    if (!active) return;
    $("#tplBadge").textContent = active.badge || active.name;
    buildRail();
    // 分頁順序:模板自有分頁 → 質感 → 版面 → 輸出
    if (active.buildPanel) active.buildPanel({ addTab });
    addTab("質感", buildGlassTab);
    addTab("版面", buildLayoutTab);
    addTab("輸出", buildOutputTab);

    applyCanvasSize();
    resetClock();
    loop();
    // 預載 canvas 會用到的字重;載入完成後下一幀自動換上
    document.fonts.load('700 40px "Noto Sans TC"');
    document.fonts.load('500 40px "Noto Sans TC"');
    document.fonts.load("500 40px Inter");
  }

  function register(tpl) {
    registry.push(tpl);
    if (!active) active = tpl;     // 目前以第一個註冊的模板為預設
    // 確保 DOM 就緒後初始化(script 置於 body 末端,通常已就緒)
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
      init();
    }
  }

  /* ─────────────────────────────
     對外 API(模板使用)
     ───────────────────────────── */
  return {
    $, $$,
    cv, ctx, state,
    register,
    roundRectPath, hexA, hexLum,
    cardLuminance,
    clock, resetClock, requestInk,
    bindRange, setRange,
    mediaSize
  };

})();
