// simple/output.js — 由 index.js 搬出(階段 3-G),內容未改動
// 截圖 PNG / GIF / MP4 輸出協調者。canvas 繪製在 shared/canvas-renderer,檢查在 choice-scene,皆經全域取得。

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

  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise(resolve => { recorder.onstop = resolve; });

  _vnsExportState.running = true;
  _vnsExportState.cancelled = false;
  recorder.start();

  const totalLines = _vnsCountTotalLines(cards);
  let doneLines = 0;

  try {
    const FADE_MS = 300;
    const TYPE_MS = 45;
    const HOLD_MS = 500;
    const FRAME_MS = 1000 / 30;

    for (let si = 0; si < cards.length; si++) {
      if (_vnsExportState.cancelled) break;
      const slide = cards[si];
      // 選項幕功能:錄完整選擇動畫(淡入 → 停留 → 正解高亮 + 其他淡化 → 切下一幕)
      if (isChoiceSlide(slide)) {
        _vnsExportSetProgress(`幕 ${si + 1} / ${cards.length} · 選項幕`, (doneLines / totalLines) * 100);
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
      for (let li = 0; li < lines.length; li++) {
        if (_vnsExportState.cancelled) break;
        const line = lines[li];
        const full = _stripStyleTags(line.content || "");
        _vnsExportSetProgress(
          `幕 ${si + 1} / ${cards.length} · 第 ${li + 1} 段 / ${lines.length}`,
          (doneLines / totalLines) * 100
        );
        // fade in
        const fadeFrames = Math.max(2, Math.round(FADE_MS / FRAME_MS));
        for (let f = 0; f < fadeFrames; f++) {
          if (_vnsExportState.cancelled) break;
          _vnsRenderSlideFrame(canvas, slide, { lineIdx: li, partialText: "", boxOpacity: f / (fadeFrames - 1) });
          await _vnsSleep(FRAME_MS);
        }
        // typewriter
        if (full.length === 0) {
          await _vnsSleep(HOLD_MS);
        } else {
          for (let i = 1; i <= full.length; i++) {
            if (_vnsExportState.cancelled) break;
            _vnsRenderSlideFrame(canvas, slide, { lineIdx: li, partialText: full.slice(0, i), boxOpacity: 1 });
            await _vnsSleep(TYPE_MS);
          }
          await _vnsSleep(HOLD_MS);
        }
        // fade out
        for (let f = fadeFrames - 1; f >= 0; f--) {
          if (_vnsExportState.cancelled) break;
          _vnsRenderSlideFrame(canvas, slide, { lineIdx: li, partialText: full, boxOpacity: f / (fadeFrames - 1) });
          await _vnsSleep(FRAME_MS);
        }
        doneLines++;
      }
    }
    if (!_vnsExportState.cancelled) await _vnsSleep(500);
  } finally {
    recorder.stop();
    await stopped;
    _vnsExportState.running = false;
  }

  const cancelled = _vnsExportState.cancelled;
  _vnsExportOverlayClose();

  if (cancelled) {
    showToast("已取消錄影", "info", 2000);
    return;
  }

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
  showToast(`已下載影片(${ext.toUpperCase()},${vnsFmtBytes(blob.size)})`, "info", 3500);
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

  _vnsExportState.running = true;
  _vnsExportState.cancelled = false;

  const gif = new GIF({
    workers: 2,
    quality: 10,
    width: w,
    height: h,
    workerScript: "https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js",
  });

  const FPS = 15;
  const FRAME_MS = 1000 / FPS;
  const FADE_FRAMES = 5;
  const TYPE_FRAMES_PER_CHAR = 1;
  const HOLD_FRAMES = 8;

  const totalLines = _vnsCountTotalLines(cards);
  let doneLines = 0;

  try {
    for (let si = 0; si < cards.length; si++) {
      if (_vnsExportState.cancelled) break;
      const slide = cards[si];
      // 選項幕功能:GIF 錄完整選擇動畫
      if (isChoiceSlide(slide)) {
        _vnsExportSetProgress(`渲染 ${si + 1} / ${cards.length} · 選項幕`, (doneLines / totalLines) * 50);
        const descs = _vnsChoiceFrameDescriptors(slide, FRAME_MS);
        for (const d of descs) {
          if (_vnsExportState.cancelled) break;
          _vnsRenderChoiceFrame(canvas, slide, d);
          gif.addFrame(canvas, { copy: true, delay: FRAME_MS });
        }
        doneLines++;
        await _vnsSleep(0);
        continue;
      }
      const lines = (slide.parsedLines && slide.parsedLines.length)
        ? slide.parsedLines
        : [{ type: "narration", speaker: null, content: "" }];
      for (let li = 0; li < lines.length; li++) {
        if (_vnsExportState.cancelled) break;
        const line = lines[li];
        const full = _stripStyleTags(line.content || "");
        _vnsExportSetProgress(
          `渲染 ${si + 1} / ${cards.length} · 第 ${li + 1} 段(共 ${lines.length})`,
          (doneLines / totalLines) * 50   // 前半段是渲染進度
        );
        for (let f = 0; f < FADE_FRAMES; f++) {
          _vnsRenderSlideFrame(canvas, slide, { lineIdx: li, partialText: "", boxOpacity: f / (FADE_FRAMES - 1) });
          gif.addFrame(canvas, { copy: true, delay: FRAME_MS });
        }
        if (full.length === 0) {
          for (let f = 0; f < HOLD_FRAMES; f++) {
            _vnsRenderSlideFrame(canvas, slide, { lineIdx: li, partialText: "", boxOpacity: 1 });
            gif.addFrame(canvas, { copy: true, delay: FRAME_MS });
          }
        } else {
          for (let i = 1; i <= full.length; i++) {
            _vnsRenderSlideFrame(canvas, slide, { lineIdx: li, partialText: full.slice(0, i), boxOpacity: 1 });
            for (let f = 0; f < TYPE_FRAMES_PER_CHAR; f++) {
              gif.addFrame(canvas, { copy: true, delay: FRAME_MS });
            }
          }
          for (let f = 0; f < HOLD_FRAMES; f++) {
            gif.addFrame(canvas, { copy: true, delay: FRAME_MS });
          }
        }
        for (let f = FADE_FRAMES - 1; f >= 0; f--) {
          _vnsRenderSlideFrame(canvas, slide, { lineIdx: li, partialText: full, boxOpacity: f / (FADE_FRAMES - 1) });
          gif.addFrame(canvas, { copy: true, delay: FRAME_MS });
        }
        doneLines++;
        // 讓出 thread,避免 UI 卡住(也讓 cancel 點擊有機會 propagate)
        await _vnsSleep(0);
      }
    }
  } catch (e) {
    _vnsExportState.running = false;
    _vnsExportOverlayClose();
    showToast("GIF 渲染失敗:" + (e.message || e), "warn", 4000);
    return;
  }

  if (_vnsExportState.cancelled) {
    gif.abort && gif.abort();
    _vnsExportState.running = false;
    _vnsExportOverlayClose();
    showToast("已取消 GIF 編碼", "info", 2000);
    return;
  }

  gif.on("progress", (p) => {
    // 後半段是 worker 編碼進度(0~1)
    _vnsExportSetProgress(`Worker 編碼中…(${Math.round(p * 100)}%)`, 50 + p * 50);
  });
  gif.on("finished", (blob) => {
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
    showToast(`已下載 GIF(${vnsFmtBytes(blob.size)})`, "info", 3500);
  });
  _vnsExportSetProgress("送入 Worker 編碼…", 50);
  gif.render();
}

export {
  exportSimpleScreenshot,
  exportSimpleMp4,
  exportSimpleGif,
};
