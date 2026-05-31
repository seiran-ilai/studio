// simple/output.js — 由 index.js 搬出(階段 3-G),內容未改動
// 截圖 PNG / GIF / MP4 輸出協調者。canvas 繪製在 shared/canvas-renderer,檢查在 choice-scene,皆經全域取得。

// 文字替換:計算字串中可替換字符數(中/日/英數)
function _vnsCountReplaceable(str) {
  if (!str) return 0;
  const m = String(str).match(/[一-鿿㐀-䶿぀-ヿa-zA-Z0-9]/g);
  return m ? m.length : 0;
}

// 任務 2:輸出前強制等使用者選的字型載入完成(否則 canvas 會 fallback 預設字型)
async function _vnsPreloadStyleFonts() {
  if (typeof document === "undefined" || !document.fonts || !document.fonts.load) return;
  const sd = state.styleDefaults || {};
  const FB = (typeof FONT_BY_ID !== "undefined") ? FONT_BY_ID : {};
  const stacks = new Set();
  ["speaker", "narration", "inner", "dialog"].forEach(k => {
    const id = sd[k] && sd[k].font;
    const f = id && FB[id];
    if (f && f.stack) stacks.add(f.stack);
  });
  const jobs = [];
  stacks.forEach(stack => {
    try { jobs.push(document.fonts.load(`24px ${stack}`, "中文字ABC123")); } catch (e) {}
  });
  try { await Promise.all(jobs); } catch (e) {}
}

async function exportSimpleScreenshot() {
  const cur = getCurrentSlide();
  if (!cur) { showToast("沒有可截圖的幕", "warn"); return; }
  // 選項幕功能:截圖前檢查(無 CG / 無正解 → 攔截);截圖輸出「全選項顯示」瞬間,不含選中後狀態
  if (isChoiceSlide(cur)) {
    const ok = await checkChoiceSlideBeforeRun(cur, "output");
    if (!ok) return;
  }
  const ratio = state.ratio || "16:9";
  const w = ratio === "9:16" ? 1080 : 1920;
  const h = ratio === "9:16" ? 1920 : 1080;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  showToast("產生截圖中…", "info", 1500);
  await _vnsPreloadStyleFonts();   // 任務 2:確保字型載入後再繪
  await _vnsRenderSlideToCanvas(canvas, cur, 0);
  canvas.toBlob((blob) => {
    if (!blob) { showToast("截圖失敗", "warn"); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `visual-novel-studio-${timestamp()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("已下載截圖", "info", 2500);
  }, "image/png");
}

async function exportSimpleMp4() {
  if (_vnsExportState.running) { showToast("已有錄影進行中", "warn"); return; }
  const cards = state.simpleCards || [];
  if (!cards.length) { showToast("沒有可錄影的幕", "warn"); return; }
  if (typeof MediaRecorder === "undefined") {
    showToast("此瀏覽器不支援 MediaRecorder", "warn", 4000);
    return;
  }
  // 選項幕功能:輸出前檢查所有選項幕(無 CG / 無正解 → 攔截;空白 → 確認)
  if (!(await checkAllChoiceSlidesBeforeOutput())) return;

  const ratio = state.ratio || "16:9";
  const w = ratio === "9:16" ? 1080 : 1920;
  const h = ratio === "9:16" ? 1920 : 1080;

  // 用 overlay 內的 canvas 當作 render 目標,使用者可即時看到錄影內容
  const canvas = _vnsExportOverlayOpen("MP4 錄影中", "● REC");
  if (!canvas) return;
  canvas.width = w; canvas.height = h;

  const mimeOptions = [
    "video/mp4;codecs=avc1.42E01F",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  let mime = "";
  for (const m of mimeOptions) {
    if (MediaRecorder.isTypeSupported(m)) { mime = m; break; }
  }
  if (!mime) {
    _vnsExportOverlayClose();
    showToast("瀏覽器不支援任何錄影格式", "warn", 4000);
    return;
  }

  _vnsExportSetProgress("預載 CG 圖片…", 1);
  for (const slide of cards) await _vnsPreloadCgImage(slide);
  // 確保每一幕都已從 dialogText 解析出 parsedLines(非當前幕可能尚未懶算),否則對話框/文字會漏畫
  for (const slide of cards) _vnsEnsureSlideParsed(slide);
  await _vnsPreloadStyleFonts();   // 任務 2:確保字型載入後再錄製

  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise(resolve => { recorder.onstop = resolve; });

  _vnsExportState.running = true;
  _vnsExportState.cancelled = false;
  _vnsExportState.recorder = recorder;
  recorder.start();
  // 任務 3:卡死偵測 — 60 秒無進度自動取消
  _vnsExportStartWatchdog(60);

  const totalLines = _vnsCountTotalLines(cards);
  let doneLines = 0;
  const t0 = Date.now();
  // 任務 4:進度文字 + 預估剩餘。frac 為 0~1 的整體進度(含行內細分,確保連續推進)。
  function mp4Prog(label, frac) {
    let eta = "";
    if (frac > 0.02) {
      const elapsed = (Date.now() - t0) / 1000;
      const remain = Math.max(0, Math.round(elapsed / frac * (1 - frac)));
      eta = `　預估剩餘:約 ${remain} 秒`;
    }
    _vnsExportSetProgress(label + eta, frac * 100);
  }

  try {
    const FADE_MS = 300;
    const TYPE_MS = 45;
    const HOLD_MS = 500;
    const FRAME_MS = 1000 / 30;

    for (let si = 0; si < cards.length; si++) {
      if (_vnsExportState.cancelled) break;
      const slide = cards[si];
      // 任務 4:上一幕的「結束轉場」(在進入本幕前演出)
      if (si > 0) {
        const prev = cards[si - 1];
        const tr = prev.transition || "none";
        if (tr !== "none") {
          const snap = (tr === "crossfade") ? _vnsRenderSlideSnapshot(slide, w, h) : null;
          const tFrames = Math.max(2, Math.round(500 / FRAME_MS));
          for (let f = 0; f <= tFrames; f++) {
            if (_vnsExportState.cancelled) break;
            _vnsRenderTransitionFrame(canvas, prev, slide, tr, f / tFrames, snap);
            await _vnsSleep(FRAME_MS);
          }
        }
      }
      // 選項幕功能:錄完整選擇動畫(淡入 → 停留 → 正解高亮 + 其他淡化 → 切下一幕)
      if (isChoiceSlide(slide)) {
        mp4Prog(`錄影 ${si + 1} / ${cards.length} · 選項幕`, doneLines / totalLines);
        const descs = _vnsChoiceFrameDescriptors(slide, FRAME_MS);
        for (const d of descs) {
          if (_vnsExportState.cancelled) break;
          _vnsRenderChoiceFrame(canvas, slide, d);
          await _vnsSleep(FRAME_MS);
        }
        doneLines++;
        continue;
      }
      const lines = (slide.parsedLines && slide.parsedLines.length)
        ? slide.parsedLines
        : [{ type: "narration", speaker: null, content: "" }];
      // 任務:文字替換取代打字機 — 逐字解碼 + 停留期間閃回
      if (typeof hasTextDecode === "function" && hasTextDecode(slide)) {
        const dParams = getTextDecodeParams(textDecodeIntensity(slide));
        for (let li = 0; li < lines.length; li++) {
          if (_vnsExportState.cancelled) break;
          const line = lines[li];
          const reCount = _vnsCountReplaceable(_stripStyleTags(line.content || ""));   // 角色名不解碼
          const decodeMs = reCount * dParams.typewriterStep + dParams.perCharGlitchDuration;
          const lineHold = (li === lines.length - 1) ? (slide.holdDuration || 1) * 1000 : 400;
          const totalMs = decodeMs + lineHold;
          const dFrames = Math.max(2, Math.round(totalMs / FRAME_MS));
          for (let f = 0; f <= dFrames; f++) {
            if (_vnsExportState.cancelled) break;
            _vnsRenderSlideFrame(canvas, slide, { lineIdx: li, boxOpacity: 1, fxDecodeTime: (f / dFrames) * totalMs / 1000 });
            mp4Prog(`錄影 ${si + 1} / ${cards.length} · 解碼 ${li + 1}/${lines.length}`, doneLines / totalLines);
            await _vnsSleep(FRAME_MS);
          }
          doneLines++;
        }
        continue;
      }
      for (let li = 0; li < lines.length; li++) {
        if (_vnsExportState.cancelled) break;
        const line = lines[li];
        const full = _stripStyleTags(line.content || "");
        mp4Prog(`錄影 ${si + 1} / ${cards.length} · 第 ${li + 1} 段 / ${lines.length}`, doneLines / totalLines);
        // 只有「幕的第一句」淡入對話框;後續 beat 對話框維持實心,直接換內容(不閃爍)
        if (li === 0) {
          const fadeFrames = Math.max(2, Math.round(FADE_MS / FRAME_MS));
          for (let f = 0; f < fadeFrames; f++) {
            if (_vnsExportState.cancelled) break;
            _vnsRenderSlideFrame(canvas, slide, { lineIdx: li, partialText: "", boxOpacity: f / (fadeFrames - 1) });
            await _vnsSleep(FRAME_MS);
          }
        } else {
          _vnsRenderSlideFrame(canvas, slide, { lineIdx: li, partialText: "", boxOpacity: 1 });
        }
        // typewriter
        if (full.length === 0) {
          await _vnsSleep(HOLD_MS);
        } else {
          for (let i = 1; i <= full.length; i++) {
            if (_vnsExportState.cancelled) break;
            _vnsRenderSlideFrame(canvas, slide, { lineIdx: li, partialText: full.slice(0, i), boxOpacity: 1 });
            mp4Prog(`錄影 ${si + 1} / ${cards.length} · 第 ${li + 1} 段 / ${lines.length} · ${i} / ${full.length} 字`,
              (doneLines + i / full.length) / totalLines);
            await _vnsSleep(TYPE_MS);
          }
          // beat 間 / 收尾:維持整句顯示(對話框不淡出,box 保持實心)
          await _vnsSleep(HOLD_MS);
        }
        doneLines++;
      }
    }
    // 任務 6:最後一幕的結束轉場(淡出)也錄進影片
    if (!_vnsExportState.cancelled && cards.length) {
      const lastTr = (cards[cards.length - 1].transition) || "none";
      if (lastTr !== "none") {
        const eFrames = Math.max(2, Math.round(500 / FRAME_MS));
        for (let f = 0; f <= eFrames; f++) {
          if (_vnsExportState.cancelled) break;
          _vnsRenderEndTransitionFrame(canvas, cards[cards.length - 1], lastTr, f / eFrames);
          await _vnsSleep(FRAME_MS);
        }
      }
    }
    if (!_vnsExportState.cancelled) await _vnsSleep(300);
  } finally {
    try { if (recorder.state !== "inactive") recorder.stop(); } catch (e) {}
    await stopped;
    _vnsExportStopWatchdog();
    _vnsExportState.recorder = null;
    _vnsExportState.running = false;
  }

  // 取消(按鈕 / watchdog)已經 stop recorder、關閉浮層、提示 → 靜默返回
  if (_vnsExportState.cancelled) return;
  _vnsExportOverlayClose();

  const blob = new Blob(chunks, { type: mime });
  const ext = mime.startsWith("video/mp4") ? "mp4" : "webm";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `visual-novel-studio-${timestamp()}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  showToast(`✓ 已輸出 ${a.download}(${vnsFmtBytes(blob.size)})`, "info", 3500);
}

async function exportSimpleGif() {
  if (_vnsExportState.running) { showToast("已有錄影進行中", "warn"); return; }
  const cards = state.simpleCards || [];
  if (!cards.length) { showToast("沒有可錄製的幕", "warn"); return; }
  if (typeof GIF === "undefined") {
    showToast("GIF 編碼器未載入(請檢查網路)", "warn", 4000);
    return;
  }
  // 選項幕功能:輸出前檢查所有選項幕(無 CG / 無正解 → 攔截;空白 → 確認)
  if (!(await checkAllChoiceSlidesBeforeOutput())) return;

  const ratio = state.ratio || "16:9";
  const w = ratio === "9:16" ? 720 : 1280;
  const h = ratio === "9:16" ? 1280 : 720;
  const canvas = _vnsExportOverlayOpen("GIF 編碼中", "● ENC");
  if (!canvas) return;
  canvas.width = w; canvas.height = h;

  _vnsExportSetProgress("預載 CG 圖片…", 1);
  for (const slide of cards) await _vnsPreloadCgImage(slide);
  // 確保每一幕都已從 dialogText 解析出 parsedLines(非當前幕可能尚未懶算),否則對話框/文字會漏畫
  for (const slide of cards) _vnsEnsureSlideParsed(slide);
  await _vnsPreloadStyleFonts();   // 任務 2:確保字型載入後再錄製

  _vnsExportState.running = true;
  _vnsExportState.cancelled = false;

  const gif = new GIF({
    workers: 2,
    quality: 10,
    width: w,
    height: h,
    workerScript: "js/vendor/gif.worker.js",
  });
  _vnsExportState.gif = gif;
  // 任務 3:卡死偵測 — 60 秒無進度自動取消(涵蓋渲染與 worker 編碼兩階段)
  _vnsExportStartWatchdog(60);

  const FPS = 15;
  const FRAME_MS = 1000 / FPS;
  const FADE_FRAMES = 5;
  const TYPE_FRAMES_PER_CHAR = 1;
  const HOLD_FRAMES = 8;

  // 任務 4:精準逐幀進度 — 先把總幀數算出來,渲染時逐幀回報「第 X / Y 幀」+ 預估剩餘。
  let framesTotal = 0;
  for (const slide of cards) {
    if (isChoiceSlide(slide)) {
      framesTotal += _vnsChoiceFrameDescriptors(slide, FRAME_MS).length;
      continue;
    }
    const lns = (slide.parsedLines && slide.parsedLines.length)
      ? slide.parsedLines : [{ content: "" }];
    for (const line of lns) {
      const len = _stripStyleTags(line.content || "").length;
      framesTotal += FADE_FRAMES * 2 + (len === 0 ? HOLD_FRAMES : len * TYPE_FRAMES_PER_CHAR + HOLD_FRAMES);
    }
  }
  framesTotal = Math.max(1, framesTotal);

  let framesDone = 0;
  const t0 = Date.now();
  // 任務 6:傳 ImageData(取自 willReadFrequently 的 context)給 gif,
  // 避免 gif.js 內部用未設 willReadFrequently 的 canvas 反覆 getImageData 觸發警告。
  const gifCtx = canvas.getContext("2d", { willReadFrequently: true });
  function addGifFrame() {
    gif.addFrame(gifCtx.getImageData(0, 0, canvas.width, canvas.height), { delay: FRAME_MS });
    framesDone++;
    // 渲染佔總進度前半(0~50%);後半是 worker 編碼
    const ratio = framesDone / framesTotal;
    let eta = "";
    if (framesDone >= 5) {
      const elapsed = (Date.now() - t0) / 1000;
      const remain = Math.max(0, Math.round(elapsed / framesDone * (framesTotal - framesDone)));
      eta = `　預估剩餘:約 ${remain} 秒`;
    }
    _vnsExportSetProgress(`編碼 GIF… 第 ${framesDone} / ${framesTotal} 幀(${Math.round(ratio * 100)}%)${eta}`, ratio * 50);
  }

  try {
    for (let si = 0; si < cards.length; si++) {
      if (_vnsExportState.cancelled) break;
      const slide = cards[si];
      // 任務 4:上一幕的「結束轉場」(在進入本幕前演出)
      if (si > 0) {
        const prev = cards[si - 1];
        const tr = prev.transition || "none";
        if (tr !== "none") {
          const snap = (tr === "crossfade") ? _vnsRenderSlideSnapshot(slide, w, h) : null;
          const tFrames = Math.max(2, Math.round(500 / FRAME_MS));
          for (let f = 0; f <= tFrames; f++) {
            if (_vnsExportState.cancelled) break;
            _vnsRenderTransitionFrame(canvas, prev, slide, tr, f / tFrames, snap);
            addGifFrame();
          }
        }
      }
      // 選項幕功能:GIF 錄完整選擇動畫
      if (isChoiceSlide(slide)) {
        const descs = _vnsChoiceFrameDescriptors(slide, FRAME_MS);
        for (const d of descs) {
          if (_vnsExportState.cancelled) break;
          _vnsRenderChoiceFrame(canvas, slide, d);
          addGifFrame();
        }
        await _vnsSleep(0);
        continue;
      }
      const lines = (slide.parsedLines && slide.parsedLines.length)
        ? slide.parsedLines
        : [{ type: "narration", speaker: null, content: "" }];
      // 任務:文字替換取代打字機 — 逐字解碼 + 停留期間閃回
      if (typeof hasTextDecode === "function" && hasTextDecode(slide)) {
        const dParams = getTextDecodeParams(textDecodeIntensity(slide));
        for (let li = 0; li < lines.length; li++) {
          if (_vnsExportState.cancelled) break;
          const line = lines[li];
          const reCount = _vnsCountReplaceable(_stripStyleTags(line.content || ""));   // 角色名不解碼
          const decodeMs = reCount * dParams.typewriterStep + dParams.perCharGlitchDuration;
          const lineHold = (li === lines.length - 1) ? (slide.holdDuration || 1) * 1000 : 400;
          const totalMs = decodeMs + lineHold;
          const dFrames = Math.max(2, Math.round(totalMs / FRAME_MS));
          for (let f = 0; f <= dFrames; f++) {
            if (_vnsExportState.cancelled) break;
            _vnsRenderSlideFrame(canvas, slide, { lineIdx: li, boxOpacity: 1, fxDecodeTime: (f / dFrames) * totalMs / 1000 });
            addGifFrame();
          }
        }
        await _vnsSleep(0);
        continue;
      }
      for (let li = 0; li < lines.length; li++) {
        if (_vnsExportState.cancelled) break;
        const line = lines[li];
        const full = _stripStyleTags(line.content || "");
        // 只有「幕的第一句」淡入;後續 beat 對話框維持實心,直接換內容(不閃爍)
        if (li === 0) {
          for (let f = 0; f < FADE_FRAMES; f++) {
            _vnsRenderSlideFrame(canvas, slide, { lineIdx: li, partialText: "", boxOpacity: f / (FADE_FRAMES - 1) });
            addGifFrame();
          }
        } else {
          _vnsRenderSlideFrame(canvas, slide, { lineIdx: li, partialText: "", boxOpacity: 1 });
          addGifFrame();
        }
        if (full.length === 0) {
          for (let f = 0; f < HOLD_FRAMES; f++) {
            _vnsRenderSlideFrame(canvas, slide, { lineIdx: li, partialText: "", boxOpacity: 1 });
            addGifFrame();
          }
        } else {
          for (let i = 1; i <= full.length; i++) {
            _vnsRenderSlideFrame(canvas, slide, { lineIdx: li, partialText: full.slice(0, i), boxOpacity: 1 });
            for (let f = 0; f < TYPE_FRAMES_PER_CHAR; f++) {
              addGifFrame();
            }
          }
          // beat 間 / 收尾:維持整句顯示(對話框不淡出)
          for (let f = 0; f < HOLD_FRAMES; f++) {
            _vnsRenderSlideFrame(canvas, slide, { lineIdx: li, partialText: full, boxOpacity: 1 });
            addGifFrame();
          }
        }
        // 讓出 thread,避免 UI 卡住(也讓 cancel 點擊有機會 propagate)
        await _vnsSleep(0);
      }
    }
    // 任務 6:最後一幕的結束轉場(淡出)也錄進 GIF
    if (!_vnsExportState.cancelled && cards.length) {
      const lastTr = (cards[cards.length - 1].transition) || "none";
      if (lastTr !== "none") {
        const eFrames = Math.max(2, Math.round(500 / FRAME_MS));
        for (let f = 0; f <= eFrames; f++) {
          if (_vnsExportState.cancelled) break;
          _vnsRenderEndTransitionFrame(canvas, cards[cards.length - 1], lastTr, f / eFrames);
          addGifFrame();
        }
      }
    }
  } catch (e) {
    _vnsExportStopWatchdog();
    _vnsExportState.gif = null;
    _vnsExportState.running = false;
    _vnsExportOverlayClose();
    showToast("GIF 渲染失敗:" + (e.message || e), "warn", 4000);
    return;
  }

  // 取消(按鈕 / watchdog)已經 abort worker、關閉浮層、提示 → 這裡靜默返回即可
  if (_vnsExportState.cancelled) return;

  const tEnc = Date.now();
  gif.on("progress", (p) => {
    // 後半段是 worker 編碼進度(0~1)
    let eta = "";
    if (p > 0.05) {
      const elapsed = (Date.now() - tEnc) / 1000;
      const remain = Math.max(0, Math.round(elapsed / p * (1 - p)));
      eta = `　預估剩餘:約 ${remain} 秒`;
    }
    _vnsExportSetProgress(`Worker 編碼中… ${Math.round(p * 100)}%${eta}`, 50 + p * 50);
  });
  gif.on("finished", (blob) => {
    if (_vnsExportState.cancelled) return;   // 編碼途中被取消 → 不下載
    _vnsExportStopWatchdog();
    _vnsExportState.gif = null;
    _vnsExportState.running = false;
    _vnsExportOverlayClose();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `visual-novel-studio-${timestamp()}.gif`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    showToast(`✓ 已輸出 ${a.download}`, "info", 3500);
  });
  _vnsExportSetProgress("送入 Worker 編碼…", 50);
  gif.render();
}

export {
  exportSimpleScreenshot,
  exportSimpleMp4,
  exportSimpleGif,
};
