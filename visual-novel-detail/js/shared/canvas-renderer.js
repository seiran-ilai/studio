// shared/canvas-renderer.js — 由 index.js 搬出(階段 3-E),內容未改動

function _vnsLoadImage(url) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = url;
  });
}

function _vnsDrawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
  if (!text) return y;
  // 中文/英文混排 wrap:逐字測寬,直到該行超過 maxWidth 就換行
  let line = "";
  let curY = y;
  for (const ch of text) {
    if (ch === "\n") {
      ctx.fillText(line, x, curY);
      line = "";
      curY += lineHeight;
      continue;
    }
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line.length > 0) {
      ctx.fillText(line, x, curY);
      line = ch;
      curY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line.length) {
    ctx.fillText(line, x, curY);
    curY += lineHeight;
  }
  return curY;
}

const _vnsCgImageCache = new Map();

async function _vnsPreloadCgImage(slide) {
  const url = _resolveSlideCgUrl(slide);
  if (!url) return null;
  if (_vnsCgImageCache.has(url)) return _vnsCgImageCache.get(url);
  try {
    const img = await _vnsLoadImage(url);
    _vnsCgImageCache.set(url, img);
    return img;
  } catch (e) { return null; }
}

function _vnsRenderSlideFrame(canvas, slide, opts) {
  opts = opts || {};
  // 選項幕功能:選項幕走專用渲染(單格用途如截圖 → 全選項顯示,不高亮、不淡化)
  if (isChoiceSlide(slide)) {
    _vnsRenderChoiceFrame(canvas, slide, { boxOpacity: opts.boxOpacity != null ? opts.boxOpacity : 1 });
    return;
  }
  const lineIdx = opts.lineIdx != null ? opts.lineIdx : 0;
  const boxOpacity = opts.boxOpacity != null ? opts.boxOpacity : 1;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const styles = getComputedStyle(document.documentElement);

  // 底色
  const stageBg = styles.getPropertyValue("--style-stage-bg").trim() || "#000";
  ctx.fillStyle = stageBg;
  ctx.fillRect(0, 0, w, h);

  // CG(從 cache)
  const cgUrl = _resolveSlideCgUrl(slide);
  const img = cgUrl ? _vnsCgImageCache.get(cgUrl) : null;
  if (img) {
    const scale = Math.max(w / img.width, h / img.height);
    const sw = img.width * scale, sh = img.height * scale;
    ctx.drawImage(img, (w - sw) / 2, (h - sh) / 2, sw, sh);
  }

  const lines = slide.parsedLines || [];
  const line = lines[lineIdx];
  if (!line || boxOpacity <= 0) return;

  ctx.save();
  ctx.globalAlpha = boxOpacity;

  const dlgBg = styles.getPropertyValue("--style-dialog-bg").trim() || "rgba(13,7,22,0.88)";
  const dlgBorder = styles.getPropertyValue("--style-dialog-border").trim() || "#c4a265";
  const dlgBorderW = parseFloat(styles.getPropertyValue("--style-dialog-border-width")) || 1;
  const txtColor = styles.getPropertyValue("--style-dialog-text-color").trim() || "#f3e9d8";
  const spkColor = styles.getPropertyValue("--style-speaker-color").trim() || "#e6c989";

  const padLR = w * 0.04;
  const padBottom = h * 0.04;
  const boxW = w - padLR * 2;
  const boxH = h * 0.22;
  const boxX = padLR;
  const boxY = h - padBottom - boxH;

  ctx.fillStyle = dlgBg;
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeStyle = dlgBorder;
  ctx.lineWidth = Math.max(1, dlgBorderW * (w / 680));
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  const innerPadX = boxW * 0.04;
  const innerPadY = boxH * 0.16;
  let textY = boxY + innerPadY;

  if (line.speaker && line.type !== "narration") {
    const spkSize = Math.round(h * 0.025);
    ctx.font = `italic 500 ${spkSize}px 'Cormorant Garamond', 'Noto Serif TC', serif`;
    // 簡易版:人名一律用全域角色名色,不分人物
    ctx.fillStyle = spkColor;
    ctx.textBaseline = "top";
    ctx.fillText(line.speaker, boxX + innerPadX, textY);
    textY += spkSize * 1.5;
  }

  const fullContent = _stripStyleTags(line.content);
  const visible = opts.partialText != null ? opts.partialText : fullContent;
  const wrapped = (line.type === "inner") ? `(${visible})` : visible;
  const fontSize = Math.round(h * 0.028);
  ctx.font = `${fontSize}px 'Noto Serif TC', 'PingFang TC', sans-serif`;
  ctx.fillStyle = (line.type === "narration") ? "#bdb3a8" : txtColor;
  ctx.textBaseline = "top";
  _vnsDrawWrappedText(ctx, wrapped, boxX + innerPadX, textY, boxW - innerPadX * 2, fontSize * 1.7);

  ctx.restore();
}

function _vnsRenderChoiceFrame(canvas, slide, opts) {
  opts = opts || {};
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  const styles = getComputedStyle(document.documentElement);

  // 底色 + CG(與一般幕相同)
  const stageBg = styles.getPropertyValue("--style-stage-bg").trim() || "#000";
  ctx.fillStyle = stageBg;
  ctx.fillRect(0, 0, w, h);
  const cgUrl = _resolveSlideCgUrl(slide);
  const img = cgUrl ? _vnsCgImageCache.get(cgUrl) : null;
  if (img) {
    const scale = Math.max(w / img.width, h / img.height);
    const sw = img.width * scale, sh = img.height * scale;
    ctx.drawImage(img, (w - sw) / 2, (h - sh) / 2, sw, sh);
  }

  const choices = Array.isArray(slide.choices) ? slide.choices : [];
  const groupAlpha = opts.boxOpacity != null ? opts.boxOpacity : 1;
  if (!choices.length || groupAlpha <= 0) return;
  const slideOffset = (opts.slideOffset || 0) * h;

  const dlgBg = styles.getPropertyValue("--style-dialog-bg").trim() || "rgba(13,7,22,0.88)";
  const dlgBorder = styles.getPropertyValue("--style-dialog-border").trim() || "#c4a265";
  const dlgBorderW = parseFloat(styles.getPropertyValue("--style-dialog-border-width")) || 2;
  const txtColor = styles.getPropertyValue("--style-dialog-text-color").trim() || "#f3e9d8";
  const accent = styles.getPropertyValue("--style-speaker-color").trim() || "#e6c989";

  const portrait = h > w;
  const boxW = w * (portrait ? 0.78 : 0.5);
  const boxH = h * 0.085;
  const gap = h * 0.022;
  const n = choices.length;
  const totalH = n * boxH + (n - 1) * gap;
  const startY = h * 0.93 - totalH + slideOffset;
  const boxX = (w - boxW) / 2;
  const fontSize = Math.round(h * 0.026);
  const radius = Math.min(boxH * 0.4, h * 0.012);

  ctx.save();
  ctx.globalAlpha = groupAlpha;
  choices.forEach((ch, i) => {
    const y = startY + i * (boxH + gap);
    const isSel = opts.selectedId && ch.id === opts.selectedId;
    const isFaded = opts.selectedId && opts.fade && !isSel;
    ctx.save();
    if (isFaded) ctx.globalAlpha = groupAlpha * 0.3;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(boxX, y, boxW, boxH, radius);
    else ctx.rect(boxX, y, boxW, boxH);
    ctx.fillStyle = dlgBg;
    ctx.fill();
    ctx.lineWidth = Math.max(1, dlgBorderW * (w / 680)) * (isSel ? 1.6 : 1);
    ctx.strokeStyle = isSel ? accent : dlgBorder;
    if (isSel) { ctx.shadowColor = accent; ctx.shadowBlur = h * 0.02; }
    ctx.stroke();
    ctx.shadowBlur = 0;
    const text = (ch.text && ch.text.trim()) ? ch.text : "(空白)";
    ctx.fillStyle = txtColor;
    ctx.font = `${fontSize}px 'Noto Serif TC', 'PingFang TC', sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(text, w / 2, y + boxH / 2, boxW * 0.9);
    ctx.restore();
  });
  ctx.restore();
  ctx.textAlign = "left";
}

function _vnsChoiceFrameDescriptors(slide, frameMs) {
  const T = CHOICE_TIMING;
  const correct = getCorrectChoice(slide);
  const sid = correct ? correct.id : null;
  const out = [];
  const nf = (ms) => Math.max(1, Math.round(ms / frameMs));
  // 淡入(整組 opacity 0→1 + 從下方滑入)
  const fi = nf(T.fadeInDuration);
  for (let f = 0; f < fi; f++) {
    const t = fi === 1 ? 1 : f / (fi - 1);
    out.push({ boxOpacity: t, selectedId: null, fade: false, slideOffset: (1 - t) * 0.04 });
  }
  // 停留(全選項顯示)
  for (let f = 0; f < nf(T.displayDuration); f++) out.push({ boxOpacity: 1, selectedId: null, fade: false, slideOffset: 0 });
  // 正解高亮 + 其他淡化
  for (let f = 0; f < nf(T.selectAnimDuration); f++) out.push({ boxOpacity: 1, selectedId: sid, fade: true, slideOffset: 0 });
  // 選後停留
  for (let f = 0; f < nf(T.afterSelectStay); f++) out.push({ boxOpacity: 1, selectedId: sid, fade: true, slideOffset: 0 });
  // 整體淡出
  const fo = nf(T.fadeOutDuration);
  for (let f = 0; f < fo; f++) {
    const t = fo === 1 ? 0 : 1 - f / (fo - 1);
    out.push({ boxOpacity: t, selectedId: sid, fade: true, slideOffset: 0 });
  }
  return out;
}

async function _vnsRenderSlideToCanvas(canvas, slide, lineIdx) {
  await _vnsPreloadCgImage(slide);
  _vnsRenderSlideFrame(canvas, slide, { lineIdx: lineIdx, boxOpacity: 1 });
}

const _vnsExportState = {
  running: false,
  cancelled: false,
  gif: null,        // 當前 GIF 實例(供 abort / terminate worker)
  recorder: null,   // 當前 MediaRecorder(供 stop)
  progress: 0,      // 最近一次進度百分比(卡死偵測 watchdog 用)
  watchdog: null,   // setInterval id
};

function _vnsSleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// 任務 3:統一取消 / 強制脫離。立即終止編碼、關閉浮層、重置 state,使用者不需重整。
// showMsg=false 給 watchdog 用(它自己已提示卡住訊息,避免重複 toast)。
function _vnsExportCancel(showMsg) {
  _vnsExportState.cancelled = true;
  _vnsExportStopWatchdog();
  // 強制終止 GIF worker(gif.abort 會 terminate active workers;順手 terminate idle workers)
  if (_vnsExportState.gif) {
    const g = _vnsExportState.gif;
    try { g.abort && g.abort(); } catch (e) {}
    try { (g.freeWorkers || []).forEach(w => w && w.terminate()); } catch (e) {}
    try { (g.activeWorkers || []).forEach(w => w && w.terminate()); } catch (e) {}
    _vnsExportState.gif = null;
  }
  // 停止 MediaRecorder
  if (_vnsExportState.recorder) {
    try { if (_vnsExportState.recorder.state !== "inactive") _vnsExportState.recorder.stop(); } catch (e) {}
    _vnsExportState.recorder = null;
  }
  _vnsExportState.running = false;
  _vnsExportState.progress = 0;
  _vnsExportOverlayClose();
  if (showMsg !== false && typeof showToast === "function") showToast("已取消輸出", "info", 2000);
}

// 卡死偵測:每秒檢查進度;timeoutSec 秒內毫無推進就自動取消並提示。
function _vnsExportStartWatchdog(timeoutSec) {
  _vnsExportStopWatchdog();
  const limit = timeoutSec || 60;
  let last = -1;
  let stalled = 0;
  _vnsExportState.watchdog = setInterval(() => {
    if (!_vnsExportState.running) { _vnsExportStopWatchdog(); return; }
    if (_vnsExportState.progress === last) {
      stalled++;
      if (stalled >= limit) {
        _vnsExportStopWatchdog();
        if (typeof showToast === "function") {
          showToast("⚠ 輸出卡住,已自動取消。建議減少幕數或縮短內容後重試。", "warn", 5000);
        }
        _vnsExportCancel(false);
      }
    } else {
      stalled = 0;
      last = _vnsExportState.progress;
    }
  }, 1000);
}

function _vnsExportStopWatchdog() {
  if (_vnsExportState.watchdog) {
    clearInterval(_vnsExportState.watchdog);
    _vnsExportState.watchdog = null;
  }
}

function _vnsExportOverlayOpen(title, badgeText) {
  const ov = document.getElementById("vnsExportOverlay");
  const titleEl = document.getElementById("vnsExportTitle");
  const badgeEl = document.getElementById("vnsExportRecBadge");
  if (!ov) return null;
  if (titleEl) titleEl.textContent = title || "輸出中…";
  if (badgeEl) badgeEl.textContent = badgeText || "● REC";
  _vnsExportSetProgress("準備中…", 0);
  ov.classList.add("show");
  return document.getElementById("vnsExportCanvas");
}

function _vnsExportOverlayClose() {
  const ov = document.getElementById("vnsExportOverlay");
  if (ov) ov.classList.remove("show");
  _vnsExportStopWatchdog();
  // cancelled 旗標不在此重置(每次輸出開始時自會設回 false);
  // 提早重置會讓還在 await 的輸出迴圈漏判取消、繼續寫入已隱藏的畫布。
}

function _vnsExportSetProgress(text, pct) {
  const t = document.getElementById("vnsExportProgress");
  const b = document.getElementById("vnsExportBarFill");
  const v = Math.max(0, Math.min(100, pct || 0));
  if (t) t.textContent = text;
  if (b) b.style.width = v + "%";
  _vnsExportState.progress = v;   // watchdog 用:有推進就重置卡死計時
}

function _vnsCountTotalLines(cards) {
  let n = 0;
  for (const s of cards) {
    const lines = (s.parsedLines && s.parsedLines.length) ? s.parsedLines : [{ content: "" }];
    n += lines.length;
  }
  return n;
}

export {
  _vnsLoadImage,
  _vnsDrawWrappedText,
  _vnsPreloadCgImage,
  _vnsRenderSlideFrame,
  _vnsRenderChoiceFrame,
  _vnsChoiceFrameDescriptors,
  _vnsRenderSlideToCanvas,
  _vnsSleep,
  _vnsExportOverlayOpen,
  _vnsExportOverlayClose,
  _vnsExportSetProgress,
  _vnsExportCancel,
  _vnsExportStartWatchdog,
  _vnsExportStopWatchdog,
  _vnsCountTotalLines,
  _vnsCgImageCache,
  _vnsExportState,
};
