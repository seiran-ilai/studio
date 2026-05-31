// detail/recording.js — 由 index.js 搬出,內容未改動。細節版逐拍 canvas 渲染 + MediaRecorder 錄影。
// 相依:state/els/getStylePreset/buildCanvasFont/computeStageStateAt/timestamp 等皆經全域取得;recState 為可變共用物件。

function drawPresetBg(ctx, w, h, className) {
  if (className === "stage-bg-sunset") {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#2a1640");
    g.addColorStop(0.4, "#d4869a");
    g.addColorStop(0.7, "#f4b878");
    g.addColorStop(1, "#4a1f3d");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // sun glow
    const sun = ctx.createRadialGradient(w * 0.5, h * 0.3, 0, w * 0.5, h * 0.3, w * 0.55);
    sun.addColorStop(0, "rgba(255,180,100,0.5)");
    sun.addColorStop(1, "rgba(255,180,100,0)");
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h);
  } else if (className === "stage-bg-classroom") {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#4a3a2a");
    g.addColorStop(0.6, "#6b4f3a");
    g.addColorStop(1, "#3a2820");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // top warm light
    const top = ctx.createLinearGradient(0, 0, 0, h * 0.4);
    top.addColorStop(0, "rgba(255,200,150,0.2)");
    top.addColorStop(1, "rgba(255,200,150,0)");
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, w, h * 0.4);
    // bottom shadow
    const bot = ctx.createLinearGradient(0, h * 0.5, 0, h);
    bot.addColorStop(0, "rgba(70,50,40,0)");
    bot.addColorStop(1, "rgba(70,50,40,0.6)");
    ctx.fillStyle = bot;
    ctx.fillRect(0, h * 0.5, w, h * 0.5);
  } else if (className === "stage-bg-night") {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#0a0518");
    g.addColorStop(0.5, "#1a0f30");
    g.addColorStop(1, "#2a1640");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // moon glow
    const moon = ctx.createRadialGradient(w * 0.7, h * 0.2, 0, w * 0.7, h * 0.2, w * 0.4);
    moon.addColorStop(0, "rgba(220,220,255,0.2)");
    moon.addColorStop(1, "rgba(220,220,255,0)");
    ctx.fillStyle = moon;
    ctx.fillRect(0, 0, w, h);
  } else {
    // default
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#2a1640");
    g.addColorStop(0.5, "#4a1f3d");
    g.addColorStop(1, "#1a0b2e");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const a = ctx.createRadialGradient(w * 0.3, h * 0.4, 0, w * 0.3, h * 0.4, w * 0.5);
    a.addColorStop(0, "rgba(212,134,154,0.4)");
    a.addColorStop(1, "rgba(212,134,154,0)");
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, w, h);
    const b = ctx.createRadialGradient(w * 0.7, h * 0.6, 0, w * 0.7, h * 0.6, w * 0.5);
    b.addColorStop(0, "rgba(139,95,184,0.4)");
    b.addColorStop(1, "rgba(139,95,184,0)");
    ctx.fillStyle = b;
    ctx.fillRect(0, 0, w, h);
  }
}

function getImage(src) {
  if (imageCache.has(src)) return imageCache.get(src);
  const img = new Image();
  img.src = src;
  // best-effort: store even before load
  imageCache.set(src, img);
  return img;
}

function preloadImage(src) {
  return new Promise((resolve) => {
    const img = getImage(src);
    if (img.complete && img.naturalWidth > 0) { resolve(img); return; }
    img.onload = () => resolve(img);
    img.onerror = () => resolve(img); // resolve anyway
  });
}

async function preloadAllAssets() {
  const tasks = [];
  for (const bg of Object.values(state.backgrounds)) {
    if (bg.type === "image" && bg.dataUrl) tasks.push(preloadImage(bg.dataUrl));
  }
  for (const ch of state.characters) {
    for (const url of Object.values(ch.portraits || {})) {
      if (url) tasks.push(preloadImage(url));
    }
  }
  for (const cg of Object.values(state.cgs || {})) {
    if (cg && cg.dataUrl) tasks.push(preloadImage(cg.dataUrl));
  }
  await Promise.all(tasks);
}

function drawPlaceholderPortrait(ctx, x, y, w, h, color, name) {
  ctx.save();
  const cx = x + w / 2;
  const bottom = y + h;
  // body silhouette path (normalized to 200x400)
  const sx = w / 200;
  const sy = h / 400;
  const tx = x;
  const ty = y;

  // gradient
  const grad = ctx.createLinearGradient(0, ty, 0, ty + h);
  grad.addColorStop(0, color);
  grad.addColorStop(1, hexWithAlpha(color, 0.45));

  ctx.fillStyle = grad;
  ctx.strokeStyle = hexWithAlpha(color, 0.6);
  ctx.lineWidth = 1.5;

  // body
  ctx.beginPath();
  ctx.moveTo(tx + 100 * sx, ty + 80 * sy);
  ctx.bezierCurveTo(tx + 70 * sx, ty + 80 * sy, tx + 55 * sx, ty + 110 * sy, tx + 60 * sx, ty + 140 * sy);
  ctx.lineTo(tx + 50 * sx, ty + 200 * sy);
  ctx.bezierCurveTo(tx + 30 * sx, ty + 230 * sy, tx + 25 * sx, ty + 290 * sy, tx + 35 * sx, ty + 380 * sy);
  ctx.lineTo(tx + 165 * sx, ty + 380 * sy);
  ctx.bezierCurveTo(tx + 175 * sx, ty + 290 * sy, tx + 170 * sx, ty + 230 * sy, tx + 150 * sx, ty + 200 * sy);
  ctx.lineTo(tx + 140 * sx, ty + 140 * sy);
  ctx.bezierCurveTo(tx + 145 * sx, ty + 110 * sy, tx + 130 * sx, ty + 80 * sy, tx + 100 * sx, ty + 80 * sy);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // head
  ctx.beginPath();
  ctx.arc(tx + 100 * sx, ty + 55 * sy, 38 * Math.min(sx, sy), 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // initial letter
  const letter = (name || "?").slice(0, 1);
  const isLight = color === "#c4a265";
  ctx.fillStyle = isLight ? "rgba(42,31,16,0.85)" : "rgba(255,255,255,0.85)";
  const fontSize = 36 * Math.min(sx, sy);
  ctx.font = `italic 600 ${fontSize}px "Cormorant Garamond", serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter, tx + 100 * sx, ty + 56 * sy);
  ctx.restore();
}

function hexWithAlpha(hex, alpha) {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function wrapText(ctx, text, maxWidth) {
  const lines = [];
  const paragraphs = text.split("\n");
  for (const para of paragraphs) {
    if (!para) { lines.push(""); continue; }
    let line = "";
    for (const ch of para) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = ch;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function buildSegFont(seg, baseSizePx, d, fallbackStack) {
  const preset = (d && d.styleFont) ? FONT_BY_ID[d.styleFont] : null;
  const stack = seg.fontStack || (preset && preset.stack) || (d && d.fontStack) || fallbackStack;
  let size = baseSizePx;
  if (d && d.styleSize === "large") size = baseSizePx * 1.3;
  else if (d && d.styleSize === "small") size = baseSizePx * 0.85;
  if (seg.large) size = baseSizePx * 1.3;
  if (seg.small) size = baseSizePx * 0.85;
  const italic = (seg.italic || (d && d.styleItalic)) ? "italic " : "";
  // weight:明確 [粗] tag > 句中字體固有 weight > 行級字體固有 weight > 400
  let weight = "400";
  if (seg.bold || (d && d.styleBold)) weight = "700";
  else if (seg.fontWeight) weight = String(seg.fontWeight);
  else if (preset && preset.weight) weight = String(preset.weight);
  return { font: `${italic}${weight} ${Math.round(size)}px ${stack}`, size };
}

function wrapSegments(ctx, text, maxWidth, baseSizePx, d, fallbackStack) {
  const segs = parseInlineToSegments(text);
  const visualLines = [];
  let cur = [];
  let curW = 0;
  function pushLine() { visualLines.push(cur); cur = []; curW = 0; }
  for (const seg of segs) {
    const { font } = buildSegFont(seg, baseSizePx, d, fallbackStack);
    const parts = String(seg.text).split("\n");
    for (let pi = 0; pi < parts.length; pi++) {
      if (pi > 0) pushLine();                 // 文字內硬換行
      ctx.font = font;
      let piece = "";
      for (const chr of parts[pi]) {
        const wch = ctx.measureText(chr).width;
        if (curW > 0 && curW + wch > maxWidth) {
          if (piece) { cur.push({ text: piece, font }); piece = ""; }
          pushLine();
        }
        piece += chr;
        curW += wch;
      }
      if (piece) cur.push({ text: piece, font });
    }
  }
  if (cur.length > 0 || visualLines.length === 0) pushLine();
  return visualLines;
}

function drawWrappedSegLines(ctx, lines, x, startY, lineH, color) {
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  for (let i = 0; i < lines.length; i++) {
    let cx = x;
    for (const pc of lines[i]) {
      ctx.font = pc.font;
      ctx.fillStyle = color;
      ctx.fillText(pc.text, cx, startY + i * lineH);
      cx += ctx.measureText(pc.text).width;
    }
  }
}

function drawPortraitTransformed(ctx, src, ch, dx, dy, dw, dh) {
  const portraitY = (ch && typeof ch.portraitY === "number") ? ch.portraitY : 0;
  const portraitScale = (ch && typeof ch.portraitScale === "number") ? ch.portraitScale : 100;
  const finalW = dw * (portraitScale / 100);
  const finalH = dh * (portraitScale / 100);
  const centerX = dx + dw / 2;
  const baseBottomY = dy + dh;
  const yOffsetPx = (portraitY / 100) * dh;          // 正值 = 往下沉
  const finalBottomY = baseBottomY + yOffsetPx;
  const finalLeftX = centerX - finalW / 2;
  const finalTopY = finalBottomY - finalH;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.clip();
  ctx.drawImage(src, finalLeftX, finalTopY, finalW, finalH);
  ctx.restore();
}

async function renderFrameToCanvas(canvas, frame) {
  const ratio = state.ratio;
  const base = RENDER_SIZES[ratio];
  // Optional super-sampling for crisp screenshots (set by #btnScreenshot).
  // Recording leaves it unset → scale 1 → unchanged behaviour. All drawing
  // below is expressed as fractions of w/h, so it auto-scales.
  const scale = Math.max(1, parseFloat(canvas.dataset.renderScale) || 1);
  const w = base.w * scale;
  const h = base.h * scale;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  // --- background ---
  const bgKey = frame.bg || "default";
  const bg = state.backgrounds[bgKey] || state.backgrounds.default;
  if (bg.type === "image" && bg.dataUrl) {
    const img = await preloadImage(bg.dataUrl);
    if (img.complete && img.naturalWidth > 0) {
      // cover fit
      const iw = img.naturalWidth, ih = img.naturalHeight;
      const scale = Math.max(w / iw, h / ih);
      const dw = iw * scale, dh = ih * scale;
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    } else {
      drawPresetBg(ctx, w, h, "stage-bg-default");
    }
  } else if (bg.type === "preset") {
    drawPresetBg(ctx, w, h, bg.className);
  } else {
    drawPresetBg(ctx, w, h, "stage-bg-default");
  }

  // --- characters ---
  // Slot layout: 3 columns with tight padding so portraits dominate the frame.
  const padX = w * 0.015;
  const slotW = (w - padX * 2) / 3;
  // Full stage height — portraits use object-fit:contain bottom-aligned, so
  // tall artwork extends up to the top of the stage like a proper VN tachie.
  const charH = h;
  const charY = 0;
  const positions = ["左", "中", "右"];

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    const slot = frame.slots && frame.slots[pos];
    if (!slot) continue;
    const ch = state.characters.find(c => c.id === slot.charId);
    if (!ch) continue;
    const isActive = frame.activeCharId === ch.id;

    // light mode → is this character dimmed?
    const lm = (frame.lightMode) || state.stage.lightMode || state.lightMode || "聚光";
    let isDimmed = false;
    if (lm === "聚光") isDimmed = !isActive;
    else if (lm === "全暗") isDimmed = true;

    const slotCx = padX + slotW * (i + 0.5);
    const charW = slotW * 0.98;
    const charX = slotCx - charW / 2;

    const portraitSrc = ch.portraits[slot.emotion] || ch.portraits["__default__"];
    if (portraitSrc) {
      const img = await preloadImage(portraitSrc);
      if (img.complete && img.naturalWidth > 0) {
        // fit contain, bottom-aligned
        const iw = img.naturalWidth, ih = img.naturalHeight;
        const sc = Math.min(charW / iw, charH / ih);
        const dw = iw * sc, dh = ih * sc;
        const dx = slotCx - dw / 2;
        const dy = charY + charH - dh;
        if (isDimmed) {
          // Offscreen so the dark overlay only follows the portrait's
          // own silhouette (source-atop) and never touches the background.
          const oc = document.createElement("canvas");
          oc.width = Math.max(1, Math.ceil(dw));
          oc.height = Math.max(1, Math.ceil(dh));
          const octx = oc.getContext("2d");
          octx.drawImage(img, 0, 0, oc.width, oc.height);
          octx.globalCompositeOperation = "source-atop";
          octx.fillStyle = "rgba(0, 0, 0, 0.6)";
          octx.fillRect(0, 0, oc.width, oc.height);
          drawPortraitTransformed(ctx, oc, ch, dx, dy, dw, dh);
        } else {
          drawPortraitTransformed(ctx, img, ch, dx, dy, dw, dh);
        }
      }
    } else {
      // placeholder — render to offscreen then optionally darken its shape
      const oc = document.createElement("canvas");
      oc.width = Math.max(1, Math.ceil(charW));
      oc.height = Math.max(1, Math.ceil(charH));
      const octx = oc.getContext("2d");
      drawPlaceholderPortrait(octx, 0, 0, oc.width, oc.height, ch.color, ch.name);
      if (isDimmed) {
        octx.globalCompositeOperation = "source-atop";
        octx.fillStyle = "rgba(0, 0, 0, 0.6)";
        octx.fillRect(0, 0, oc.width, oc.height);
      }
      drawPortraitTransformed(ctx, oc, ch, charX, charY, charW, charH);
    }

    // No floating badge — speaker name lives in the dialog box, matching VN convention.
  }

  // --- CG (full-screen art layer, drawn over characters) ---
  if (frame.cg) {
    const cgData = state.cgs[frame.cg.name];
    if (cgData && cgData.dataUrl) {
      const img = await preloadImage(cgData.dataUrl);
      if (img.complete && img.naturalWidth > 0) {
        // black bg first, then cover
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, w, h);
        const iw = img.naturalWidth, ih = img.naturalHeight;
        const scale = Math.max(w / iw, h / ih);
        const dw = iw * scale, dh = ih * scale;
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      }
    } else {
      // placeholder
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#2a1640");
      g.addColorStop(1, "#4a1f3d");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(243, 233, 216, 0.4)";
      ctx.font = `italic 500 ${Math.round(h * 0.05)}px "Cormorant Garamond", serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`CG: ${frame.cg.name}`, w / 2, h / 2);
    }
  }

  // --- dialog box ---
  // Hidden when CG in "full" mode
  const dialogHidden = frame.cg && frame.cg.hideDialog;
  if (frame.dialog && !dialogHidden) {
    const boxPad = w * 0.04;
    const boxX = boxPad;
    const boxW = w - boxPad * 2;
    const boxH = h * 0.24;
    const boxY = h - boxH - h * 0.04;

    // backdrop — shape-aware, mirrors the DOM [data-shape] styles
    drawDialogShape(ctx, boxX, boxY, boxW, boxH,
      (state.dialogStyle && state.dialogStyle.shape) || "classic", scale);

    const contentPad = w * 0.028;
    const contentX = boxX + contentPad;
    const contentW = boxW - contentPad * 2;

    const styleVariant = getCurrentStyleVariant();
    if (frame.dialog.isNarration) {
      ctx.save();
      const fontSize = Math.round(h * 0.035);
      const fallback = (styleVariant && styleVariant.dialogText.fontStack) || '"Noto Serif TC", "PingFang TC", serif';
      const lines = wrapSegments(ctx, frame.dialog.text, contentW, fontSize, frame.dialog, fallback);
      const lineH = fontSize * 1.7;
      const totalH = lines.length * lineH;
      const startY = boxY + (boxH - totalH) / 2;
      const narrationColor = styleVariant ? styleVariant.dialogText.color : "#9a8aa8";
      drawWrappedSegLines(ctx, lines, contentX, startY, lineH, narrationColor);
      ctx.restore();
    } else {
      // speaker
      ctx.save();
      const speakerColor = styleVariant ? styleVariant.speaker.color : (frame.dialog.color || "#f3e9d8");
      ctx.fillStyle = speakerColor;
      const nameSize = Math.round(h * 0.042);
      const speakerFont = styleVariant
        ? `${styleVariant.speaker.fontStyle || "normal"} ${styleVariant.speaker.weight || 500} ${nameSize}px ${styleVariant.speaker.fontStack}`
        : `italic 500 ${nameSize}px "Cormorant Garamond", "Noto Serif TC", serif`;
      ctx.font = speakerFont;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const nameY = boxY + contentPad * 0.8;
      ctx.fillText(frame.dialog.speaker, contentX, nameY);
      // short gold gradient line after name (matches DOM ::after)
      const nameWidth = ctx.measureText(frame.dialog.speaker).width;
      const lineStart = contentX + nameWidth + 8 * scale;
      const lineY = nameY + nameSize / 2;
      const lineW = 60 * scale;
      const lineGrad = ctx.createLinearGradient(lineStart, lineY, lineStart + lineW, lineY);
      lineGrad.addColorStop(0, "rgba(230, 201, 137, 1)");
      lineGrad.addColorStop(0.6, "rgba(196, 162, 101, 0.4)");
      lineGrad.addColorStop(1, "rgba(196, 162, 101, 0)");
      ctx.fillStyle = lineGrad;
      ctx.fillRect(lineStart, lineY, lineW, 1 * scale);
      ctx.restore();

      // text
      ctx.save();
      const textSize = Math.round(h * 0.036);
      const fallback = (styleVariant && styleVariant.dialogText.fontStack) || '"PingFang TC", "Noto Sans TC", sans-serif';
      const lines = wrapSegments(ctx, frame.dialog.text, contentW, textSize, frame.dialog, fallback);
      const lineH = textSize * 1.7;
      const startY = boxY + contentPad * 0.8 + nameSize + h * 0.012 + 16 * scale;
      const textColor = styleVariant ? styleVariant.dialogText.color : "#f3e9d8";
      drawWrappedSegLines(ctx, lines, contentX, startY, lineH, textColor);
      ctx.restore();
    }
  }

  // --- choices overlay ---
  if (frame.choices) {
    drawChoicesOverlay(ctx, w, h, frame.choices);
  }

  // Anti-dedup pixel: 在右下角畫一個近乎透明、每幀微變的色塊,
  // 確保任兩幀像素都不完全相同,防止 Threads / Instagram 重編碼合併相鄰幀。
  // fake game UI overlay (H4) — drawn on top of everything,
  // 但 cg solo / full（hideGameUI）時跳過（J5）
  if (!frame.cg || !frame.cg.hideGameUI) {
    drawGameUI(ctx, w, h, scale);
  }

  // Batch 3:極值特效文字 overlay(只繪文字 — 粒子忽略)
  if (frame.extremeEffect && frame.extremeEffect.styleId) {
    const set = LOVE_EXTREME_EFFECTS[frame.extremeEffect.styleId];
    if (set) {
      const e = set[frame.extremeEffect.kind];
      if (e && e.overlayText) {
        ctx.save();
        ctx.fillStyle = e.textColor || "#ffffff";
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 12 * scale;
        const fontSize = Math.round(h * 0.08);
        ctx.font = `700 ${fontSize}px "Cormorant Garamond","Noto Serif TC", serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(e.overlayText, w / 2, h / 2);
        ctx.restore();
      }
    }
  }

  // 截圖時 window.__recAntiDedup 設為 false 以略過(R6)。
  if (window.__recAntiDedup !== false) {
    window.__recFrameCounter = ((window.__recFrameCounter || 0) + 1) % 256;
    ctx.fillStyle = `rgba(${window.__recFrameCounter}, 0, 0, 0.015)`;
    ctx.fillRect(canvas.width - 2, canvas.height - 2, 2, 2);
  }

  return canvas;
}

function drawChoicesOverlay(ctx, w, h, choices) {
  // dimmed backdrop
  ctx.save();
  ctx.fillStyle = "rgba(13, 7, 22, 0.55)";
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  const items = choices.items.filter(it => it.shown !== false);
  if (items.length === 0) return;

  const boxW = w * 0.6;
  const boxH = h * 0.1;
  const gap = h * 0.024;
  const totalH = items.length * boxH + (items.length - 1) * gap;
  let y = (h - totalH) / 2;
  const x = (w - boxW) / 2;

  const fontSize = Math.round(h * 0.035);
  ctx.font = `400 ${fontSize}px "PingFang TC", "Noto Sans TC", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const item of items) {
    ctx.save();
    const cx = x + boxW / 2;
    const cy = y + boxH / 2;
    if (item.isFinal) {
      // highlighted box
      const gradF = ctx.createLinearGradient(0, y, 0, y + boxH);
      gradF.addColorStop(0, "rgba(196, 162, 101, 0.22)");
      gradF.addColorStop(1, "rgba(212, 134, 154, 0.22)");
      ctx.fillStyle = gradF;
      roundRect(ctx, x, y, boxW, boxH, 3);
      ctx.fill();
      ctx.strokeStyle = "#e6c989";
      ctx.lineWidth = 2;
      ctx.stroke();
      // shadow glow
      ctx.shadowColor = "rgba(196, 162, 101, 0.5)";
      ctx.shadowBlur = 20;
      ctx.strokeStyle = "rgba(230, 201, 137, 0.4)";
      ctx.lineWidth = 1;
      roundRect(ctx, x, y, boxW, boxH, 3);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // text
      ctx.fillStyle = "#e6c989";
      ctx.font = `600 ${fontSize}px "PingFang TC", sans-serif`;
      // corner brackets
      drawCornerBrackets(ctx, x, y, boxW, boxH, h * 0.015);
    } else {
      // regular dimmed box
      const grad = ctx.createLinearGradient(0, y, 0, y + boxH);
      grad.addColorStop(0, "rgba(13, 7, 22, 0.85)");
      grad.addColorStop(1, "rgba(23, 13, 36, 0.92)");
      ctx.fillStyle = grad;
      roundRect(ctx, x, y, boxW, boxH, 3);
      ctx.fill();
      ctx.strokeStyle = "rgba(196, 162, 101, 0.4)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "rgba(243, 233, 216, 0.7)";
      ctx.font = `400 ${fontSize}px "PingFang TC", sans-serif`;
      drawCornerBrackets(ctx, x, y, boxW, boxH, h * 0.012);
    }
    ctx.fillText(item.text, cx, cy + 2);
    ctx.restore();
    y += boxH + gap;
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function getCurrentStyleVariant() {
  if (!state.style || !state.style.preset) return null;
  const result = getStylePreset(state.style.preset, state.style.variant);
  return result ? result.variant : null;
}

function drawDialogShape(ctx, x, y, w, h, shape, scale) {
  const variant = getCurrentStyleVariant();
  let bg, GOLD, c, c2, a;
  if (variant) {
    c = hexToRgb(variant.dialog.bgColor);
    a = variant.dialog.opacity == null ? 1 : variant.dialog.opacity;
    bg = `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
    c2 = { r: Math.min(255, c.r + 10), g: Math.min(255, c.g + 6), b: Math.min(255, c.b + 14) };
    GOLD = variant.dialog.borderColor;
  } else {
    const ds = state.dialogStyle || DEFAULT_DIALOG_STYLE;
    c = hexToRgb(ds.color);
    a = (ds.opacity == null) ? 0.88 : ds.opacity;
    bg = `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
    c2 = { r: Math.min(255, c.r + 10), g: Math.min(255, c.g + 6), b: Math.min(255, c.b + 14) };
    GOLD = "#c4a265";
  }

  switch (shape) {
    case "soft":
      roundRect(ctx, x, y, w, h, 18 * scale);
      ctx.fillStyle = bg; ctx.fill();
      break;

    case "window":
      ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = GOLD; ctx.lineWidth = 1 * scale;
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x + w, y);
      ctx.moveTo(x, y + h); ctx.lineTo(x + w, y + h);
      ctx.stroke();
      ctx.strokeStyle = "rgba(196, 162, 101, 0.35)";
      ctx.beginPath();
      ctx.moveTo(x + 8 * scale, y + 4 * scale);
      ctx.lineTo(x + w - 8 * scale, y + 4 * scale);
      ctx.moveTo(x + 8 * scale, y + h - 4 * scale);
      ctx.lineTo(x + w - 8 * scale, y + h - 4 * scale);
      ctx.stroke();
      break;

    case "classic":
    default: {
      const grad = ctx.createLinearGradient(0, y, 0, y + h);
      grad.addColorStop(0, `rgba(${c.r}, ${c.g}, ${c.b}, ${Math.max(0, a - 0.03)})`);
      grad.addColorStop(1, `rgba(${c2.r}, ${c2.g}, ${c2.b}, ${Math.min(1, a + 0.04)})`);
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = GOLD; ctx.lineWidth = 1 * scale;
      ctx.strokeRect(x, y, w, h);
      drawCornerBrackets(ctx, x, y, w, h, h * 0.025);
      break;
    }
  }
}

function drawGameUI(ctx, w, h, scale) {
  const u = state.gameUI;
  if (!u) return;
  const displayFont = '"Cormorant Garamond", "Noto Serif TC", serif';
  const baseFont = '"PingFang TC", "Microsoft JhengHei", sans-serif';

  if (u.chapter.enabled && u.chapter.text) {
    ctx.save();
    ctx.font = `italic ${18 * scale}px ${displayFont}`;
    ctx.fillStyle = "#e6c989";
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 8 * scale;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText("❀ " + u.chapter.text, 22 * scale, 18 * scale);
    ctx.restore();
  }

  if (u.love.enabled) {
    const ch = state.characters.find(c => c.id === u.love.charId);
    if (ch) {
      ctx.save();
      const boxW = 180 * scale, boxH = 38 * scale;
      const boxX = w - 22 * scale - boxW;
      const boxY = 56 * scale;
      ctx.fillStyle = "rgba(13, 7, 22, 0.5)";
      roundRect(ctx, boxX, boxY, boxW, boxH, boxH / 2); ctx.fill();
      ctx.strokeStyle = "rgba(196, 162, 101, 0.18)";
      ctx.lineWidth = 1 * scale;
      roundRect(ctx, boxX, boxY, boxW, boxH, boxH / 2); ctx.stroke();
      ctx.fillStyle = "#d4869a";
      ctx.shadowColor = "#d4869a";
      ctx.shadowBlur = 6 * scale;
      ctx.font = `${20 * scale}px sans-serif`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillText("♥", boxX + 14 * scale, boxY + boxH / 2);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#9a8aa8";
      ctx.font = `italic ${10 * scale}px ${displayFont}`;
      ctx.textBaseline = "top";
      ctx.fillText(ch.name, boxX + 40 * scale, boxY + 12 * scale);
      const barX = boxX + 40 * scale;
      const barY = boxY + 22 * scale;
      const barW = 120 * scale, barH = 4 * scale;
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      roundRect(ctx, barX, barY, barW, barH, 2 * scale); ctx.fill();
      const fillW = barW * (Math.max(0, Math.min(100, u.love.value)) / 100);
      if (fillW > 0) {
        const grad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
        grad.addColorStop(0, "#d4869a");
        grad.addColorStop(1, "#e6c989");
        ctx.fillStyle = grad;
        roundRect(ctx, barX, barY, fillW, barH, 2 * scale); ctx.fill();
      }
      ctx.restore();
    }
  }

  if (u.autoSkip.enabled) {
    ctx.save();
    ctx.font = `italic ${12 * scale}px ${displayFont}`;
    ctx.textBaseline = "middle";
    const labels = [
      { text: "SKIP", active: false },
      { text: "AUTO", active: true },
    ];
    let cursorX = w - 22 * scale;
    const btnY = h - 14 * scale - 11 * scale;
    for (let i = labels.length - 1; i >= 0; i--) {
      const lab = labels[i];
      const tw = ctx.measureText(lab.text).width;
      const padX = 12 * scale;
      const btnW = tw + padX * 2;
      const btnH = 22 * scale;
      const btnX = cursorX - btnW;
      ctx.fillStyle = lab.active ? "rgba(196, 162, 101, 0.1)" : "rgba(13, 7, 22, 0.6)";
      roundRect(ctx, btnX, btnY - btnH / 2, btnW, btnH, btnH / 2); ctx.fill();
      ctx.strokeStyle = lab.active ? "#e6c989" : "rgba(196, 162, 101, 0.18)";
      ctx.lineWidth = 1 * scale;
      roundRect(ctx, btnX, btnY - btnH / 2, btnW, btnH, btnH / 2); ctx.stroke();
      ctx.fillStyle = lab.active ? "#e6c989" : "#9a8aa8";
      ctx.textAlign = "center";
      ctx.fillText(lab.text, btnX + btnW / 2, btnY);
      cursorX = btnX - 6 * scale;
    }
    ctx.restore();
  }
}

function drawCornerBrackets(ctx, x, y, w, h, size) {
  ctx.save();
  ctx.strokeStyle = "#c4a265";
  ctx.lineWidth = 1.5;
  // top-left
  ctx.beginPath();
  ctx.moveTo(x, y + size);
  ctx.lineTo(x, y);
  ctx.lineTo(x + size, y);
  ctx.stroke();
  // bottom-right
  ctx.beginPath();
  ctx.moveTo(x + w, y + h - size);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w - size, y + h);
  ctx.stroke();
  ctx.restore();
}

function buildFrameAt(idx) {
  const activeCharId = computeStageStateAt(state.parsed, idx);
  const cur = state.parsed[idx];
  let dialog = null;
  let choices = null;
  if (cur) {
    if (cur.type === "dialog") {
      const ch = findCharacter(cur.speaker);
      let displayName = cur.speaker;
      let displayColor = ch ? ch.color : "#f3e9d8";
      if (cur.nameHidden) {
        displayName = cur.nameOverride || "???";
        displayColor = "#9a8aa8";
      }
      dialog = {
        speaker: displayName,
        text: cur.text,
        color: displayColor,
        isNarration: false,
        ...styleFieldsFromLine(cur),
      };
    } else if (cur.type === "narration") {
      dialog = { speaker: "", text: cur.text, color: "#9a8aa8", isNarration: true, ...styleFieldsFromLine(cur) };
    } else if (cur.type === "choices") {
      // for static preview/screenshot, show full choices state
      choices = {
        items: cur.items.map(it => ({ text: it.text, isFinal: it.isFinal, shown: true })),
      };
    }
  }
  // Batch 3:極值特效偵測 — 當前 beat 若是 love 行且觸發 0/100,標記 frame
  let extremeEffect = null;
  if (cur && cur.type === "love") {
    let target = cur.targetName;
    if (!target) {
      const u = state.gameUI && state.gameUI.love;
      const targetCh = u && u.charId
        ? state.characters.find(c => c.id === u.charId)
        : state.characters.find(c => c.kind !== "protagonist");
      if (targetCh) target = targetCh.name;
    }
    if (target && state.loveValues[target] != null) {
      const v = state.loveValues[target];
      if (v === 100) extremeEffect = { kind: "full", styleId: state.style && state.style.preset };
      else if (v === 0) extremeEffect = { kind: "empty", styleId: state.style && state.style.preset };
    }
  }

  return {
    bg: state.stage.bg,
    slots: { ...state.stage.slots },
    cg: state.stage.cg,
    lightMode: state.stage.lightMode,
    activeCharId,
    dialog,
    choices,
    extremeEffect,
  };
}

const recState = {
  typeSpeed: 45,      // ms per char
  holdTime: 1.5,      // seconds to hold after typing done
  bgHold: 0.6,        // seconds to hold on bg/exit transitions
  preferredMime: null,
  mediaRecorder: null,
  chunks: [],
  startTime: 0,
  stopRequested: false,
  active: false,      // true while a recording is in progress
  startBeat: 0,       // first beat index to record (inclusive)
  endBeat: Infinity,  // last beat index to record (inclusive)
};

const REC_MIN_FRAMES_PER_CHAR = 4;

const REC_TAIL_PAD_MS = 1000;

function getRecordRange() {
  const last = Math.max(0, state.parsed.length - 1);
  const startSel = document.querySelector('input[name="recStart"]:checked');
  const endSel = document.querySelector('input[name="recEnd"]:checked');
  let startBeat = (startSel && startSel.value === "current")
    ? Math.min(state.currentIndex, last) : 0;
  let endBeat = last;
  if (endSel && endSel.value === "custom") {
    const n = parseInt(document.getElementById("recEndBeat").value, 10);
    endBeat = isNaN(n) ? last : Math.max(1, Math.min(n, state.parsed.length)) - 1;
  }
  if (endBeat < startBeat) endBeat = startBeat;
  return { startBeat, endBeat };
}

function detectMimeType() {
  const candidates = [
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=h264",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  if (!window.MediaRecorder) return null;
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return null;
}

function updateRecordFormatInfo() {
  const el = document.getElementById("recordFormatInfo");
  if (!recState.preferredMime) {
    el.innerHTML = "<span style='color:var(--danger)'>⚠ 瀏覽器不支援錄影</span>";
    return;
  }
  const isMp4 = recState.preferredMime.startsWith("video/mp4");
  if (isMp4) {
    el.innerHTML = "輸出格式:<strong>MP4</strong>(可直接上傳社群)";
  } else {
    el.innerHTML = "輸出:<strong>WebM</strong> · 可選轉成 MP4(載入 ~25MB)";
  }
}

function estimateRecordingDuration(range) {
  const r = range || { startBeat: 0, endBeat: state.parsed.length - 1 };
  let total = 0;
  let visibleCount = 0;
  for (let i = r.startBeat; i <= r.endBeat && i < state.parsed.length; i++) {
    const ln = state.parsed[i];
    let dt = 0;
    // scene ops merged into this beat each cost a transition hold
    if (ln.sceneOps && ln.sceneOps.length) {
      for (const op of ln.sceneOps) {
        if (op.type === "light") continue;  // instant, no hold
        dt += op.type === "cg" ? recState.bgHold * 1.5 : recState.bgHold;
      }
    }
    if (ln.type === "dialog" || ln.type === "narration") {
      const charCount = (ln.text || "").length;
      // 每字最少 REC_MIN_FRAMES_PER_CHAR / 60 秒,與 typeSpeed 取較大者（R2 後的真實節奏）
      const perCharTime = Math.max(
        recState.typeSpeed / 1000,
        REC_MIN_FRAMES_PER_CHAR / 60
      );
      dt += charCount * perCharTime + recState.holdTime;
    } else if (ln.type === "bg" || ln.type === "exit" || ln.type === "cg_off") {
      dt += recState.bgHold;
    } else if (ln.type === "cg") {
      dt += recState.bgHold * 1.5;
    } else if (ln.type === "scene_only") {
      dt += recState.bgHold;
    } else if (ln.type === "choices") {
      dt += (ln.items.length * 0.6) + 0.3 + 1.2;
    }
    total += dt;
    if (isVisibleType(ln)) {
      visibleCount++;
    }
  }
  // 加上結尾保險時間（R4 的 tail padding）
  total += REC_TAIL_PAD_MS / 1000;
  return { total, totalVisible: visibleCount };
}

function fmtDuration(secs) {
  const m = Math.floor(secs / 60);
  const s = secs - m * 60;
  if (m === 0) return `${s.toFixed(1)} 秒`;
  return `${m} 分 ${s.toFixed(0)} 秒`;
}

function updateEstimate() {
  const info = estimateRecordingDuration(getRecordRange());
  const dur = info.total;
  const el = document.getElementById("recordEstimate");
  // ~0.5 MB/sec at 4 Mbps + container overhead
  const sizeMB = (dur * 0.5).toFixed(1);
  const heavy = dur > 180;
  el.classList.toggle("over-limit", heavy);
  if (heavy) {
    el.innerHTML = `預計片長:<strong>${fmtDuration(dur)}</strong> · 約 ${sizeMB} MB<br>` +
      `⚠ 較長的片子建議分段錄影,避免瀏覽器記憶體吃緊`;
  } else {
    el.innerHTML = `預計片長:<strong>${fmtDuration(dur)}</strong> · 約 ${sizeMB} MB（共 ${info.totalVisible} 句）`;
  }
}

function speedLabel(ms) {
  if (ms <= 30) return `快速 · ${ms}ms`;
  if (ms <= 60) return `中速 · ${ms}ms`;
  return `慢速 · ${ms}ms`;
}

async function preloadFontsForRecording() {
  if (!document.fonts || !document.fonts.load) return;

  const usedFonts = new Set();
  for (const ln of state.parsed) {
    if (ln && ln.styleFont) {
      const font = FONT_BY_ID[ln.styleFont];
      if (font && font.stack) {
        const primaryFont = font.stack.split(",")[0].trim().replace(/^["']|["']$/g, "");
        usedFonts.add(primaryFont);
      }
    }
  }
  // 預設字體也要載
  usedFonts.add("Noto Sans TC");
  usedFonts.add("Noto Serif TC");

  const promises = [...usedFonts].map(f => {
    try {
      return document.fonts.load(`16px "${f}"`).catch(() => null);
    } catch (e) {
      return Promise.resolve();
    }
  });
  // 特定字重 / 字面:麥克黑用 Noto Sans TC 900,源樣 500,各開源 face
  const explicit = [
    '900 16px "Noto Sans TC"',
    '900 16px "Noto Sans JP"',
    '500 16px "GenYoGothic"',
    '400 16px "ChenYuluoyan"',
    '400 16px "Iansui"',
    '400 16px "DotGothic16"',
    '400 16px "jf-openhuninn-2.1"',
  ];
  for (const spec of explicit) {
    try { promises.push(document.fonts.load(spec).catch(() => null)); }
    catch (e) { /* 字體名特殊字元時忽略 */ }
  }
  await Promise.all(promises);
}

async function beginRecording() {
  // preload assets
  await preloadAllAssets();
  // M19:預載字體
  showToast("📦 載入字體中...", "", 1500);
  await preloadFontsForRecording();

  const canvas = document.getElementById("recordingCanvas");
  const ratio = state.ratio;
  const { w, h } = RENDER_SIZES[ratio];
  canvas.width = w;
  canvas.height = h;
  canvas.dataset.ratio = ratio;

  // show overlay
  document.getElementById("recordingOverlay").classList.add("show");
  document.getElementById("previewCounter").classList.add("hidden");
  recState.active = true;
  document.getElementById("recTimer").innerHTML = "<strong>00:00</strong>";

  // set up MediaRecorder on canvas stream
  const stream = canvas.captureStream(60); // 60fps 給 Threads 等平台壓 fps 後仍有足夠幀
  let mime = recState.preferredMime;
  let recorder;
  try {
    recorder = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: 4_000_000, // 4 Mbps — good quality for the resolution
    });
  } catch (e) {
    // fallback to default
    try {
      recorder = new MediaRecorder(stream);
      mime = recorder.mimeType;
    } catch (e2) {
      showToast("無法啟動錄影:" + e2.message, "warn", 4000);
      document.getElementById("recordingOverlay").classList.remove("show");
      document.getElementById("previewCounter").classList.remove("hidden");
      recState.active = false;
      return;
    }
  }

  recState.mediaRecorder = recorder;
  recState.chunks = [];
  recState.stopRequested = false;
  recState.startTime = performance.now();

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) recState.chunks.push(e.data);
  };

  const recordingPromise = new Promise((resolve) => {
    recorder.onstop = () => {
      const blob = new Blob(recState.chunks, { type: mime });
      resolve(blob);
    };
  });

  recorder.start(100); // gather chunks every 100ms

  // visibility-change watcher — warn if user switches tab mid-recording
  let _wasHidden = false;
  const visHandler = () => {
    if (document.hidden) {
      _wasHidden = true;
      // give a soft toast (some browsers will still throttle, but capture should continue)
      showToast("⚠ 偵測到切換分頁,動畫可能變慢或卡頓", "warn", 3500);
    }
  };
  document.addEventListener("visibilitychange", visHandler);

  // run animation
  let lastFrameState = { dialog: null, activeCharId: null };
  try {
    lastFrameState = await runRecordingAnimation(canvas);
  } catch (e) {
    console.error("Animation error:", e);
  }
  document.removeEventListener("visibilitychange", visHandler);
  if (_wasHidden) {
    showToast("⚠ 錄影過程中曾切換分頁,影片可能不順", "warn", 4000);
  }

  // 結尾保險時間：持續繪製最後一幀,確保 MediaRecorder 收到完整 tail
  // （修正最後一句被平台重編碼截斷的問題）
  const tailStart = performance.now();
  while (performance.now() - tailStart < REC_TAIL_PAD_MS) {
    if (recState.stopRequested) break;
    await drawCurrentFrameDuringRec(canvas, lastFrameState.dialog, lastFrameState.activeCharId);
    await new Promise(r => requestAnimationFrame(r));
  }
  // 強制觸發最後一個 chunk,再等一下讓它進 ondataavailable
  if (recorder.state === "recording") {
    try { recorder.requestData(); } catch (e) {}
  }
  await new Promise(r => setTimeout(r, 200));

  // stop recorder
  if (recorder.state !== "inactive") recorder.stop();
  const blob = await recordingPromise;

  // close overlay
  document.getElementById("recordingOverlay").classList.remove("show");
  document.getElementById("previewCounter").classList.remove("hidden");
  recState.active = false;

  // restore preview state to where it was before recording
  reparseAndRender(false);

  // show result
  showRecordingResult(blob, mime);
}

async function runRecordingAnimation(canvas) {
  const ctx = canvas.getContext("2d");
  let lastFrameState = { dialog: null, activeCharId: null };

  // reset stage at start (include cg + lightMode fields)
  state.stage = { bg: "default", slots: { 左: null, 中: null, 右: null }, cg: null, lightMode: state.lightMode || DEFAULT_LIGHT_MODE };

  const startBeat = Number.isFinite(recState.startBeat) ? recState.startBeat : 0;
  const endBeat = Number.isFinite(recState.endBeat)
    ? recState.endBeat : state.parsed.length - 1;
  // If starting mid-script, fast-forward the stage (bg / characters / cg)
  // to just before the start beat — without animating those earlier beats.
  if (startBeat > 0) {
    computeStageStateAt(state.parsed, startBeat - 1);
  }

  // No hard time limit — recording continues until script ends or user clicks Stop.
  // We keep the totalDurationMs param threaded through helpers (now Infinity) so the
  // existing signatures stay intact.
  const totalDurationMs = Infinity;
  const startMs = performance.now();

  // walk through parsed
  for (let i = startBeat; i <= endBeat && i < state.parsed.length; i++) {
    if (recState.stopRequested) break;
    const elapsed = performance.now() - startMs;
    if (elapsed >= totalDurationMs) break;

    const ln = state.parsed[i];

    // Apply scene ops merged into this beat first: each gets a transition
    // draw + bgHold so the background/CG/exit change is visible before the
    // beat's dialog types out.
    if (ln.sceneOps && ln.sceneOps.length) {
      for (const op of ln.sceneOps) {
        if (recState.stopRequested) break;
        if (op.type === "light") {
          // instant — no transition hold
          state.stage.lightMode = op.mode;
          continue;
        }
        if (op.type === "bg") state.stage.bg = op.bgName;
        else if (op.type === "exit") state.stage.slots = { 左: null, 中: null, 右: null };
        else if (op.type === "cg") state.stage.cg = { name: op.cgName, hideDialog: op.hideDialog, hideGameUI: op.hideGameUI };
        else if (op.type === "cg_off") state.stage.cg = null;
        await drawCurrentFrameDuringRec(canvas, null, null);
        await sleepWithTimer(recState.bgHold * 1000 * (op.type === "cg" ? 1.5 : 1), startMs, totalDurationMs);
      }
    }

    if (ln.type === "scene_only") {
      // trailing scene state already applied above; just hold the final frame
      await drawCurrentFrameDuringRec(canvas, null, null);
      await sleepWithTimer(recState.bgHold * 1000, startMs, totalDurationMs);
      lastFrameState = { dialog: null, activeCharId: null };
    } else if (ln.type === "bg") {
      state.stage.bg = ln.bgName;
      await drawCurrentFrameDuringRec(canvas, null, null);
      await sleepWithTimer(recState.bgHold * 1000, startMs, totalDurationMs);
      lastFrameState = { dialog: null, activeCharId: null };
    } else if (ln.type === "exit") {
      state.stage.slots = { 左: null, 中: null, 右: null };
      await drawCurrentFrameDuringRec(canvas, null, null);
      await sleepWithTimer(recState.bgHold * 1000, startMs, totalDurationMs);
      lastFrameState = { dialog: null, activeCharId: null };
    } else if (ln.type === "cg") {
      state.stage.cg = { name: ln.cgName, hideDialog: ln.hideDialog, hideGameUI: ln.hideGameUI };
      await drawCurrentFrameDuringRec(canvas, null, null);
      await sleepWithTimer(recState.bgHold * 1000 * 1.5, startMs, totalDurationMs);
      lastFrameState = { dialog: null, activeCharId: null };
    } else if (ln.type === "cg_off") {
      state.stage.cg = null;
      await drawCurrentFrameDuringRec(canvas, null, null);
      await sleepWithTimer(recState.bgHold * 1000, startMs, totalDurationMs);
      lastFrameState = { dialog: null, activeCharId: null };
    } else if (ln.type === "choices") {
      await animateChoices(canvas, ln, startMs, totalDurationMs);
      lastFrameState = { dialog: null, activeCharId: null };
    } else if (ln.type === "dialog") {
      const ch = findCharacter(ln.speaker);
      let activeCharId = null;
      if (ch && !ln.isProtagonist) {
        placeCharacter(ch.id, ln.emotion, ln.position);
        activeCharId = ch.id;
      }
      // determine display name with [?] / [?:某人] handling
      let displayName = ln.speaker;
      let dialogColor = ch ? ch.color : "#f3e9d8";
      if (ln.nameHidden) {
        displayName = ln.nameOverride || "???";
        dialogColor = "#9a8aa8";
      }
      const st = styleFieldsFromLine(ln);
      const text = ln.text || "";
      let charsShown = 0;
      let framesSinceLastChar = REC_MIN_FRAMES_PER_CHAR; // 允許立刻顯示第一字
      const typeStart = performance.now();
      while (charsShown < text.length) {
        if (recState.stopRequested) break;
        framesSinceLastChar++;
        const elapsedType = performance.now() - typeStart;
        const timeBasedTarget = Math.floor(elapsedType / recState.typeSpeed);
        // 時間到了 且 上個字已存在足夠幀數，才前進「一個」字（嚴格不跳字）
        if (timeBasedTarget > charsShown && framesSinceLastChar >= REC_MIN_FRAMES_PER_CHAR) {
          charsShown++;
          framesSinceLastChar = 0;
        }
        // 每幀都重繪（即使字數沒變），避免編碼器 dedup
        await drawCurrentFrameDuringRec(canvas, {
          speaker: displayName,
          text: text.slice(0, charsShown),
          color: dialogColor,
          isNarration: false,
          ...st,
        }, activeCharId);
        if (performance.now() - startMs >= totalDurationMs) break;
        await new Promise(r => requestAnimationFrame(r));
        updateRecTimer(startMs);
      }
      await drawCurrentFrameDuringRec(canvas, {
        speaker: displayName,
        text,
        color: dialogColor,
        isNarration: false,
        ...st,
      }, activeCharId);
      lastFrameState = {
        dialog: { speaker: displayName, text, color: dialogColor, isNarration: false, ...st },
        activeCharId,
      };
      await sleepWithTimer(recState.holdTime * 1000, startMs, totalDurationMs);
    } else if (ln.type === "narration") {
      const nst = styleFieldsFromLine(ln);
      const text = ln.text || "";
      const activeCharId = null;
      let charsShown = 0;
      let framesSinceLastChar = REC_MIN_FRAMES_PER_CHAR;
      const typeStart = performance.now();
      while (charsShown < text.length) {
        if (recState.stopRequested) break;
        framesSinceLastChar++;
        const elapsedType = performance.now() - typeStart;
        const timeBasedTarget = Math.floor(elapsedType / recState.typeSpeed);
        if (timeBasedTarget > charsShown && framesSinceLastChar >= REC_MIN_FRAMES_PER_CHAR) {
          charsShown++;
          framesSinceLastChar = 0;
        }
        await drawCurrentFrameDuringRec(canvas, {
          speaker: "",
          text: text.slice(0, charsShown),
          color: "#9a8aa8",
          isNarration: true,
          ...nst,
        }, activeCharId);
        if (performance.now() - startMs >= totalDurationMs) break;
        await new Promise(r => requestAnimationFrame(r));
        updateRecTimer(startMs);
      }
      await drawCurrentFrameDuringRec(canvas, {
        speaker: "",
        text,
        color: "#9a8aa8",
        isNarration: true,
        ...nst,
      }, activeCharId);
      lastFrameState = {
        dialog: { speaker: "", text, color: "#9a8aa8", isNarration: true, ...nst },
        activeCharId,
      };
      await sleepWithTimer(recState.holdTime * 1000, startMs, totalDurationMs);
    }
  }
  return lastFrameState;
}

async function animateChoices(canvas, choicesLine, startMs, totalDurationMs) {
  const items = choicesLine.items.map(it => ({ ...it, shown: false }));
  const PER_ITEM_MS = 600;
  const FINAL_HOLD_MS = 1200;
  const PRE_HIGHLIGHT_MS = 300;

  // reveal each item one-by-one
  for (let k = 0; k < items.length; k++) {
    if (recState.stopRequested) return;
    if (performance.now() - startMs >= totalDurationMs) return;
    items[k].shown = true;
    await drawChoicesFrame(canvas, items, false);
    await sleepWithTimer(PER_ITEM_MS, startMs, totalDurationMs);
  }
  // brief pause before highlighting final
  await sleepWithTimer(PRE_HIGHLIGHT_MS, startMs, totalDurationMs);
  // highlight phase — render with isFinal already on the marked item (it already was)
  // final hold
  await drawChoicesFrame(canvas, items, true);
  await sleepWithTimer(FINAL_HOLD_MS, startMs, totalDurationMs);
}

async function drawChoicesFrame(canvas, items, finalPhase) {
  // During the reveal phase, suppress the gold highlight even if isFinal=true,
  // so all visible items look equal. When finalPhase=true, the * one lights up.
  const renderItems = items.map(it => ({
    text: it.text,
    isFinal: finalPhase ? it.isFinal : false,
    shown: it.shown,
  }));
  const frame = {
    bg: state.stage.bg,
    slots: { ...state.stage.slots },
    cg: state.stage.cg,
    lightMode: state.stage.lightMode,
    activeCharId: null,
    dialog: null,
    choices: { items: renderItems },
  };
  await renderFrameToCanvas(canvas, frame);
}

async function drawCurrentFrameDuringRec(canvas, dialog, activeCharId) {
  const frame = {
    bg: state.stage.bg,
    slots: { ...state.stage.slots },
    cg: state.stage.cg,
    lightMode: state.stage.lightMode,
    activeCharId,
    dialog,
  };
  await renderFrameToCanvas(canvas, frame);
}

async function sleepWithTimer(ms, startMs, totalDurationMs) {
  const target = performance.now() + ms;
  while (performance.now() < target) {
    if (recState.stopRequested) return;
    if (performance.now() - startMs >= totalDurationMs) return;
    updateRecTimer(startMs);
    await new Promise(r => requestAnimationFrame(r));
  }
}

function updateRecTimer(startMs) {
  const elapsed = (performance.now() - startMs) / 1000;
  const m = Math.floor(elapsed / 60);
  const s = Math.floor(elapsed % 60);
  document.getElementById("recTimer").innerHTML =
    `<strong>${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}</strong>`;
}

function showRecordingResult(blob, mime) {
  const modal = document.getElementById("resultModal");
  const video = document.getElementById("resultVideo");
  const meta = document.getElementById("resultMeta");
  const actions = document.getElementById("resultActions");

  const url = URL.createObjectURL(blob);
  video.src = url;
  video.load();

  const isMp4 = mime.startsWith("video/mp4");
  const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
  const ext = isMp4 ? "mp4" : "webm";

  meta.textContent = `${ext.toUpperCase()} · ${sizeMB} MB · ${RENDER_SIZES[state.ratio].w}×${RENDER_SIZES[state.ratio].h}`;

  actions.innerHTML = "";

  // primary download button
  const dlBtn = document.createElement("button");
  dlBtn.className = "btn btn-primary";
  dlBtn.textContent = `⬇ 下載 ${ext.toUpperCase()}`;
  dlBtn.addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `visual-novel-studio-${timestamp()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });
  actions.appendChild(dlBtn);

  // if webm, offer guidance + a one-click cloudconvert link
  // (ffmpeg.wasm requires SharedArrayBuffer + cross-origin isolation which
  //  doesn't work reliably in a standalone html file opened from disk or
  //  served without specific COOP/COEP headers)
  if (!isMp4) {
    const convBtn = document.createElement("button");
    convBtn.className = "btn btn-ghost";
    convBtn.textContent = "🌐 線上轉 MP4";
    convBtn.title = "在新分頁打開 cloudconvert.com,把剛下載的 WebM 拖進去即可";
    convBtn.addEventListener("click", () => {
      window.open("https://cloudconvert.com/webm-to-mp4", "_blank", "noopener");
    });
    actions.appendChild(convBtn);

    const note = document.createElement("div");
    note.style.cssText = "font-size:11px;color:var(--text-muted);text-align:center;line-height:1.7;max-width:380px;margin:0 auto;";
    note.innerHTML = `💡 你的瀏覽器只支援 WebM。<br>` +
      `先按 <strong style="color:var(--gold-bright)">⬇ 下載 WEBM</strong>,然後 <strong>🌐 線上轉 MP4</strong> 把檔案拖進去。<br>` +
      `或改用 Chrome / Edge / Safari 桌面版重錄,可直接輸出 MP4。`;
    actions.appendChild(note);
  }

  // close
  const closeBtn = document.createElement("button");
  closeBtn.className = "btn btn-ghost";
  closeBtn.textContent = "關閉";
  closeBtn.addEventListener("click", () => {
    modal.classList.remove("show");
    URL.revokeObjectURL(url);
    video.src = "";
  });
  actions.appendChild(closeBtn);

  modal.classList.add("show");
}

export {
  drawPresetBg,
  getImage,
  preloadImage,
  preloadAllAssets,
  drawPlaceholderPortrait,
  hexWithAlpha,
  wrapText,
  buildSegFont,
  wrapSegments,
  drawWrappedSegLines,
  drawPortraitTransformed,
  renderFrameToCanvas,
  drawChoicesOverlay,
  roundRect,
  getCurrentStyleVariant,
  drawDialogShape,
  drawGameUI,
  drawCornerBrackets,
  buildFrameAt,
  getRecordRange,
  detectMimeType,
  updateRecordFormatInfo,
  estimateRecordingDuration,
  fmtDuration,
  updateEstimate,
  speedLabel,
  preloadFontsForRecording,
  beginRecording,
  runRecordingAnimation,
  animateChoices,
  drawChoicesFrame,
  drawCurrentFrameDuringRec,
  sleepWithTimer,
  updateRecTimer,
  showRecordingResult,
  recState,
  REC_MIN_FRAMES_PER_CHAR,
  REC_TAIL_PAD_MS,
};
