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

// 輸出時,非「當前編輯中」的幕可能還沒從 dialogText 解析出 parsedLines
//(parsedLines 只在 renderSimpleEditor 開啟該幕時才懶算)。
// 若不補算,canvas 會因 parsedLines 為空而提前 return,只畫到 CG、漏掉對話框與文字。
// 截圖 / GIF / MP4 渲染與計數前都先確保解析。
function _vnsEnsureSlideParsed(slide) {
  if (!slide) return;
  if (typeof isChoiceSlide === "function" && isChoiceSlide(slide)) return;
  const hasLines = Array.isArray(slide.parsedLines) && slide.parsedLines.length > 0;
  if (!hasLines && typeof slide.dialogText === "string" && slide.dialogText.trim()
      && typeof parseSimpleDialogText === "function") {
    slide.parsedLines = parseSimpleDialogText(slide.dialogText).parsedLines;
  }
}

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
  // 任務 6:willReadFrequently — GIF 輸出每幀會讀 pixel,避免 Canvas2D 警告 + 加速
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const w = canvas.width;
  const h = canvas.height;
  const styles = getComputedStyle(document.documentElement);
  // 任務 1:畫面級特效 — 晃動位移 + filter(失焦/動態模糊),overlay 於最後疊上
  // fxTime 預設用 wall-clock,讓連續輸出的每幀動畫(雜訊/閃黑/晃動)自然推進
  const fxTime = opts.fxTime != null ? opts.fxTime : (performance.now() / 1000);
  const shake = (typeof fxCanvasShake === "function") ? fxCanvasShake(slide, fxTime) : { x: 0, y: 0 };
  const filterCss = (typeof fxCanvasFilter === "function") ? fxCanvasFilter(slide) : "";

  // 底色(填滿整個 canvas,不隨晃動)
  const stageBg = styles.getPropertyValue("--style-stage-bg").trim() || "#000";
  ctx.fillStyle = stageBg;
  ctx.fillRect(0, 0, w, h);

  // 內容(CG + 對話框)套用晃動 + 模糊 filter
  ctx.save();
  if (shake.x || shake.y) ctx.translate(shake.x, shake.y);
  if (filterCss) ctx.filter = filterCss;

  // CG(從 cache)
  const cgUrl = _resolveSlideCgUrl(slide);
  const img = cgUrl ? _vnsCgImageCache.get(cgUrl) : null;
  if (img) {
    const scale = Math.max(w / img.width, h / img.height);
    const sw = img.width * scale, sh = img.height * scale;
    ctx.drawImage(img, (w - sw) / 2, (h - sh) / 2, sw, sh);
  }

  _vnsEnsureSlideParsed(slide);
  const lines = slide.parsedLines || [];
  const line = lines[lineIdx];
  if (line && boxOpacity > 0) {
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

    // 任務 4:字級與預覽一致 — 預覽以 px 套 state.fontSizes 於高度 stageH 的舞台;
    // 輸出 canvas 高 h,等比例縮放 = fontSizes × (h / stageH),確保視覺大小一致。
    const _stageEl = (typeof document !== "undefined") && document.getElementById("simplePreviewStage");
    const _stageH = (_stageEl && _stageEl.clientHeight) || 0;
    const _fscale = _stageH > 0 ? (h / _stageH) : (h / 540);
    const _fs = state.fontSizes || { dialog: 18, speaker: 16, narration: 16, inner: 15 };

    // 任務:文字替換(text_decode)— 逐字解碼;decodeIdx 跨「角色名→內文」連續
    const decodeOn = (typeof hasTextDecode === "function") && hasTextDecode(slide);
    const decodeTime = opts.fxDecodeTime != null ? opts.fxDecodeTime : fxTime;
    const decodeParams = (decodeOn && typeof getTextDecodeParams === "function")
      ? getTextDecodeParams(textDecodeIntensity(slide)) : null;
    const decodeIdx = { n: 0 };
    const _decE = decodeOn && Array.isArray(slide.effects) && slide.effects.find(x => x.id === "text_decode");
    // 未選色票時用主題 --gold-bright(與 DOM 預設一致,避免兩主題下預覽/輸出不同色)
    const DECODE_ACCENT = (_decE && _decE.color) || (styles.getPropertyValue("--gold-bright").trim() || "#e6c989");

    if (line.speaker && line.type !== "narration") {
      const spkSize = Math.max(8, Math.round((_fs.speaker || 16) * _fscale));
      const sfId = state.styleDefaults && state.styleDefaults.speaker && state.styleDefaults.speaker.font;
      const sf = (sfId && typeof FONT_BY_ID !== "undefined") ? FONT_BY_ID[sfId] : null;
      if (sf && sf.stack) {
        ctx.font = `${sf.weight ? sf.weight : 500} ${spkSize}px ${sf.stack}`;
      } else {
        ctx.font = `italic 500 ${spkSize}px 'Cormorant Garamond', 'Noto Serif TC', serif`;
      }
      ctx.textBaseline = "top";
      // 角色名永遠正常顯示(不套用文字替換)
      ctx.fillStyle = spkColor;
      ctx.fillText(line.speaker, boxX + innerPadX, textY);
      textY += spkSize * 1.5;
    }

    const fullContent = _stripStyleTags(line.content);
    const visible = opts.partialText != null ? opts.partialText : fullContent;
    const wrapped = (line.type === "inner") ? `(${visible})` : visible;
    const prog = fullContent.length ? Math.min(1, visible.length / fullContent.length) : 1;
    // 任務 2:套用使用者選的全域字型(state.styleDefaults[type].font → FONT_BY_ID.stack)
    const _sd = state.styleDefaults || {};
    const _typeKey = (line.type === "narration") ? "narration" : (line.type === "inner") ? "inner" : "dialog";
    // 任務 4:字級用 state.fontSizes[type] 等比例縮放到 canvas
    const fontSize = Math.max(8, Math.round((_fs[_typeKey] || 16) * _fscale));
    const _fid = _sd[_typeKey] && _sd[_typeKey].font;
    const _f = (_fid && typeof FONT_BY_ID !== "undefined") ? FONT_BY_ID[_fid] : null;
    const _stack = (_f && _f.stack) || "'Noto Serif TC', 'PingFang TC', sans-serif";
    const _wt = (_f && _f.weight) ? _f.weight + " " : "";
    ctx.font = `${_wt}${fontSize}px ${_stack}`;
    let baseTextColor = (line.type === "narration") ? "#bdb3a8" : txtColor;
    const _bloodActive = Array.isArray(slide.effects) && slide.effects.some(e => e.id === "blood_text");
    if (typeof fxCanvasBloodColor === "function") baseTextColor = fxCanvasBloodColor(slide, baseTextColor, prog);
    ctx.textBaseline = "top";
    if (decodeOn && typeof fxDrawDecodeWrapped === "function") {
      // 整段都用 decode 色(含定型字);血字滲透並用時改用 blood 漸變色 override
      const _decodeColor = _bloodActive ? baseTextColor : DECODE_ACCENT;
      fxDrawDecodeWrapped(ctx, wrapped, boxX + innerPadX, textY, boxW - innerPadX * 2, fontSize * 1.7, decodeTime, decodeParams, decodeIdx, _decodeColor, _decodeColor);
    } else {
      ctx.fillStyle = baseTextColor;
      _vnsDrawWrappedText(ctx, wrapped, boxX + innerPadX, textY, boxW - innerPadX * 2, fontSize * 1.7);
    }

    ctx.restore();
  }

  ctx.filter = "none";
  ctx.restore();

  // 畫面級 overlay(暗角 / 掃描線 / 雜訊 / 閃黑)— 不隨晃動、不被模糊
  if (typeof fxCanvasOverlay === "function") fxCanvasOverlay(ctx, w, h, slide, fxTime);
}

// 片頭緩衝幀:只畫第一幕的 CG(cover 滿版),無對話框、無文字、無特效。
// 第一幕沒有 CG 時填主題舞台底色(乾淨空畫面),維持「片頭緩衝有作用」的一致性。
function _vnsRenderIntroFrame(canvas, slide) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const w = canvas.width, h = canvas.height;
  const styles = getComputedStyle(document.documentElement);
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
}

function _vnsRenderChoiceFrame(canvas, slide, opts) {
  opts = opts || {};
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
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
  // 任務 1:畫面級特效 overlay(選項幕也套用)
  const fxTime = opts.fxTime != null ? opts.fxTime : (performance.now() / 1000);
  if (typeof fxCanvasOverlay === "function") fxCanvasOverlay(ctx, w, h, slide, fxTime);
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

// 任務 4:結束轉場 — canvas 輸出
function _vnsLastLineIdx(slide) {
  const n = (slide && slide.parsedLines && slide.parsedLines.length) || 0;
  return n > 0 ? n - 1 : 0;
}

// 建立某 slide 的離屏快照(crossfade 用)
function _vnsRenderSlideSnapshot(slide, w, h) {
  const off = document.createElement("canvas");
  off.width = w; off.height = h;
  _vnsRenderSlideFrame(off, slide, { lineIdx: 0, boxOpacity: 1 });
  return off;
}

// 轉場單幀:type ∈ none/fade_black/fade_white/crossfade,p 為 0~1 進度
function _vnsRenderTransitionFrame(canvas, fromSlide, toSlide, type, p, toSnapshot) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const w = canvas.width, h = canvas.height;
  if (type === "crossfade") {
    _vnsRenderSlideFrame(canvas, fromSlide, { lineIdx: _vnsLastLineIdx(fromSlide), boxOpacity: 1 });
    if (toSnapshot) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p));
      ctx.drawImage(toSnapshot, 0, 0, w, h);
      ctx.restore();
    }
    return;
  }
  const color = (type === "fade_white") ? "#fff" : "#000";
  if (p < 0.5) {
    _vnsRenderSlideFrame(canvas, fromSlide, { lineIdx: _vnsLastLineIdx(fromSlide), boxOpacity: 1 });
    ctx.save(); ctx.globalAlpha = Math.min(1, p * 2); ctx.fillStyle = color; ctx.fillRect(0, 0, w, h); ctx.restore();
  } else {
    _vnsRenderSlideFrame(canvas, toSlide, { lineIdx: 0, boxOpacity: 1 });
    ctx.save(); ctx.globalAlpha = Math.min(1, (1 - p) * 2); ctx.fillStyle = color; ctx.fillRect(0, 0, w, h); ctx.restore();
  }
}

// 任務 6:最後一幕的結束轉場(淡出)。p 0~1。crossfade 視為淡到黑。
function _vnsRenderEndTransitionFrame(canvas, slide, type, p) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const w = canvas.width, h = canvas.height;
  _vnsRenderSlideFrame(canvas, slide, { lineIdx: _vnsLastLineIdx(slide), boxOpacity: 1 });
  const rgb = (type === "fade_white") ? "255,255,255" : "0,0,0";
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, p));
  ctx.fillStyle = `rgb(${rgb})`;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function _vnsCountTotalLines(cards) {
  let n = 0;
  for (const s of cards) {
    _vnsEnsureSlideParsed(s);
    const lines = (s.parsedLines && s.parsedLines.length) ? s.parsedLines : [{ content: "" }];
    n += lines.length;
  }
  return n;
}

export {
  _vnsLoadImage,
  _vnsDrawWrappedText,
  _vnsEnsureSlideParsed,
  _vnsPreloadCgImage,
  _vnsRenderSlideFrame,
  _vnsRenderIntroFrame,
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
  _vnsRenderTransitionFrame,
  _vnsRenderSlideSnapshot,
  _vnsRenderEndTransitionFrame,
  _vnsCgImageCache,
  _vnsExportState,
};
