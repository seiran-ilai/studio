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
  // 明確指定多個字重觸發載入:@font-face 字體(如 GenYoGothic)沒被觸發就不進 fonts 佇列,
  // document.fonts.ready 也不會等它。逐字重 + 測試字串強制觸發。
  const weights = [400, 500, 700, 900];
  stacks.forEach(stack => {
    // document.fonts.load 只接受單一字體名稱,不接受整個 fallback stack(整串傳會靜默失敗)。
    // 拆出每個字體名稱(去引號/空白,過濾 generic family),逐一觸發載入。
    const genericFamilies = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui"]);
    const fontNames = stack
      .split(",")
      .map(s => s.trim().replace(/^["']|["']$/g, "").trim())
      .filter(s => s && !genericFamilies.has(s));
    for (const name of fontNames) {
      for (const w of weights) {
        try { jobs.push(document.fonts.load(`${w} 24px "${name}"`, "永字八法AaBb123")); } catch (e) {}
      }
    }
  });
  try { await Promise.all(jobs); } catch (e) {}
  // 確保字型真的可用(load 回傳 Promise 但不保證立即可畫)
  try { await document.fonts.ready; } catch (e) {}
  // 額外等待 100ms,讓字體渲染引擎完成準備
  await new Promise(r => setTimeout(r, 100));
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
  // 字級縮放基準:用輸出高度推算的固定設計基準(ref = outputH × 352/1080),
  // 不隨編輯面板大小變動,輸出結果才穩定。
  _vnsSetPreviewRefH(h * 352 / 1080);

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
  // 片頭緩衝佔進度條的前段(0~introBase%),幕內容映射到其後,確保進度條單調遞增。
  let introBase = 0;
  // 任務 4:進度文字 + 預估剩餘。frac 為 0~1 的整體進度(含行內細分,確保連續推進)。
  function mp4Prog(label, frac) {
    let eta = "";
    if (frac > 0.02) {
      const elapsed = (Date.now() - t0) / 1000;
      const remain = Math.max(0, Math.round(elapsed / frac * (1 - frac)));
      eta = `　預估剩餘:約 ${remain} 秒`;
    }
    _vnsExportSetProgress(label + eta, introBase + frac * (100 - introBase));
  }

  try {
    const FADE_MS = 300;
    // 任務 1-4A:一般打字機速度用全域文字速度;任務 2-2:MP4 固定 30fps
    const TYPE_MS = (typeof getTextSpeedPerChar === "function")
      ? getTextSpeedPerChar(state.dialogStyle && state.dialogStyle.textSpeed) : 45;
    const HOLD_MS = 500;
    const FRAME_MS = 1000 / 30;

    // 片頭緩衝:第一幕之前先錄一段乾淨 CG(無對話框/文字/特效),方便社群平台抓縮圖。
    const _intro = state.outputSettings && state.outputSettings.intro;
    if (_intro && _intro.enabled && _intro.duration > 0) {
      const introFrames = Math.max(1, Math.round((_intro.duration * 1000) / FRAME_MS));
      introBase = 5;   // 片頭佔進度條前 5%
      for (let f = 0; f < introFrames; f++) {
        if (_vnsExportState.cancelled) break;
        _vnsRenderIntroFrame(canvas, cards[0]);
        _vnsExportSetProgress(`錄製片頭緩衝… (${_intro.duration.toFixed(1)}s)`, ((f + 1) / introFrames) * introBase);
        await _vnsSleep(FRAME_MS);
      }
    }

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
        // 選項出現前先停幾幀(只有 CG、無選項),讓 MediaRecorder 緩衝,淡入動畫才不會被跳過
        for (let f = 0; f < 3; f++) {
          if (_vnsExportState.cancelled) break;
          _vnsRenderChoiceFrame(canvas, slide, { boxOpacity: 0 });
          await _vnsSleep(FRAME_MS);
        }
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
      // 每幕最後一行用 slide.holdDuration(使用者設定的停留秒數),中間行用 HOLD_MS
      const slideHoldMs = typeof slide.holdDuration === "number"
        ? slide.holdDuration * 1000
        : HOLD_MS;
      for (let li = 0; li < lines.length; li++) {
        if (_vnsExportState.cancelled) break;
        const line = lines[li];
        const full = _stripStyleTags(line.content || "");
        mp4Prog(`錄影 ${si + 1} / ${cards.length} · 第 ${li + 1} 段 / ${lines.length}`, doneLines / totalLines);
        // 只有「幕的第一句」淡入對話框;後續 beat 對話框維持實心,直接換內容(不閃爍)
        if (li === 0) {
          // 預熱幀:確保 MediaRecorder 緩衝清空,淡入從頭錄製(不被起始延遲吃掉)
          for (let f = 0; f < 5; f++) {
            if (_vnsExportState.cancelled) break;
            _vnsRenderSlideFrame(canvas, slide, { lineIdx: li, partialText: "", boxOpacity: 0 });
            await _vnsSleep(FRAME_MS);
          }
          const fadeFrames = Math.max(2, Math.round(FADE_MS / FRAME_MS));
          for (let f = 0; f < fadeFrames; f++) {
            if (_vnsExportState.cancelled) break;
            _vnsRenderSlideFrame(canvas, slide, { lineIdx: li, partialText: "", boxOpacity: f / (fadeFrames - 1) });
            await _vnsSleep(FRAME_MS);
          }
          // 淡入結束後,先停幾幀確保對話框完全顯示(避免 MediaRecorder 緩衝延遲跳過空白幀)
          for (let f = 0; f < 3; f++) {
            if (_vnsExportState.cancelled) break;
            _vnsRenderSlideFrame(canvas, slide, { lineIdx: li, partialText: "", boxOpacity: 1 });
            await _vnsSleep(FRAME_MS);
          }
        } else {
          _vnsRenderSlideFrame(canvas, slide, { lineIdx: li, partialText: "", boxOpacity: 1 });
        }
        // typewriter
        // 停留期間逐幀重畫(而非單次 sleep),時間相關特效(glitch/晃動/雜訊)才會在停留時持續動。
        // 最後一行用 slide.holdDuration,中間行用 HOLD_MS
        const isLastLine = (li === lines.length - 1);
        const thisHoldMs = isLastLine ? slideHoldMs : HOLD_MS;
        const holdFrames = Math.max(1, Math.round(thisHoldMs / FRAME_MS));
        if (full.length === 0) {
          for (let f = 0; f < holdFrames; f++) {
            if (_vnsExportState.cancelled) break;
            _vnsRenderSlideFrame(canvas, slide, { lineIdx: li, partialText: "", boxOpacity: 1 });
            await _vnsSleep(FRAME_MS);
          }
        } else {
          for (let i = 1; i <= full.length; i++) {
            if (_vnsExportState.cancelled) break;
            _vnsRenderSlideFrame(canvas, slide, { lineIdx: li, partialText: full.slice(0, i), boxOpacity: 1 });
            mp4Prog(`錄影 ${si + 1} / ${cards.length} · 第 ${li + 1} 段 / ${lines.length} · ${i} / ${full.length} 字`,
              (doneLines + i / full.length) / totalLines);
            await _vnsSleep(TYPE_MS);
          }
          // beat 間 / 收尾:維持整句顯示(對話框不淡出,box 保持實心),逐幀重畫讓特效持續動
          for (let f = 0; f < holdFrames; f++) {
            if (_vnsExportState.cancelled) break;
            _vnsRenderSlideFrame(canvas, slide, { lineIdx: li, partialText: full, boxOpacity: 1 });
            await _vnsSleep(FRAME_MS);
          }
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
  // 字級縮放基準:用輸出高度推算的固定設計基準(ref = outputH × 352/1080),
  // 不隨編輯面板大小變動,輸出結果才穩定。
  _vnsSetPreviewRefH(h * 352 / 1080);

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

  // 任務 2-2:GIF 固定 24fps(較 15fps 流暢,且編碼量仍可控)
  const FPS = 24;
  const FRAME_MS = 1000 / FPS;
  // 以毫秒時長換算幀數,讓淡入/停留時長與 MP4 一致(不再因 fps 改變而縮短)
  const FADE_FRAMES = Math.max(2, Math.round(300 / FRAME_MS));
  const HOLD_FRAMES = Math.max(2, Math.round(500 / FRAME_MS));
  // 任務 1-4A:每字幀數由全域文字速度換算(預設 80ms/字 → 24fps 約 2 幀/字)
  const _typeMsPerChar = (typeof getTextSpeedPerChar === "function")
    ? getTextSpeedPerChar(state.dialogStyle && state.dialogStyle.textSpeed) : 66;
  const TYPE_FRAMES_PER_CHAR = Math.max(1, Math.round(_typeMsPerChar / FRAME_MS));

  // 片頭緩衝幀數(第一幕乾淨 CG)。計入總幀數,讓進度條/預估包含緩衝(任務 5)。
  const _intro = state.outputSettings && state.outputSettings.intro;
  const introFrames = (_intro && _intro.enabled && _intro.duration > 0)
    ? Math.max(1, Math.round((_intro.duration * 1000) / FRAME_MS)) : 0;

  // 任務 4:精準逐幀進度 — 先把總幀數算出來,渲染時逐幀回報「第 X / Y 幀」+ 預估剩餘。
  let framesTotal = introFrames;
  for (const slide of cards) {
    if (isChoiceSlide(slide)) {
      framesTotal += 3 + _vnsChoiceFrameDescriptors(slide, FRAME_MS).length;   // +3 緩衝幀
      continue;
    }
    const lns = (slide.parsedLines && slide.parsedLines.length)
      ? slide.parsedLines : [{ content: "" }];
    framesTotal += 3;   // 第一行淡入後的 +3 緩衝幀
    // 最後一行的停留用 slide.holdDuration,其他行用 HOLD_FRAMES(與實際渲染一致,進度才準)
    const slideHoldMs = typeof slide.holdDuration === "number" ? slide.holdDuration * 1000 : 500;
    const slideHoldFrames = Math.max(2, Math.round(slideHoldMs / FRAME_MS));
    for (let li = 0; li < lns.length; li++) {
      const len = _stripStyleTags(lns[li].content || "").length;
      const holdF = (li === lns.length - 1) ? slideHoldFrames : HOLD_FRAMES;
      framesTotal += FADE_FRAMES * 2 + (len === 0 ? holdF : len * TYPE_FRAMES_PER_CHAR + holdF);
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
    // 片頭緩衝:第一幕之前先錄一段乾淨 CG(無對話框/文字/特效)。
    if (introFrames > 0 && cards.length) {
      for (let f = 0; f < introFrames; f++) {
        if (_vnsExportState.cancelled) break;
        _vnsRenderIntroFrame(canvas, cards[0]);
        addGifFrame();
      }
      await _vnsSleep(0);
    }
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
        // 與 MP4 對齊:選項出現前先停幾幀(只有 CG、無選項)
        for (let f = 0; f < 3; f++) {
          if (_vnsExportState.cancelled) break;
          _vnsRenderChoiceFrame(canvas, slide, { boxOpacity: 0 });
          addGifFrame();
        }
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
      // 每幕最後一行用 slide.holdDuration(使用者設定),中間行用 HOLD_FRAMES(500ms)
      const slideHoldMs = typeof slide.holdDuration === "number" ? slide.holdDuration * 1000 : 500;
      const SLIDE_HOLD_FRAMES = Math.max(2, Math.round(slideHoldMs / FRAME_MS));
      for (let li = 0; li < lines.length; li++) {
        if (_vnsExportState.cancelled) break;
        const line = lines[li];
        const full = _stripStyleTags(line.content || "");
        const isLastLine = (li === lines.length - 1);
        // 只有「幕的第一句」淡入;後續 beat 對話框維持實心,直接換內容(不閃爍)
        if (li === 0) {
          for (let f = 0; f < FADE_FRAMES; f++) {
            _vnsRenderSlideFrame(canvas, slide, { lineIdx: li, partialText: "", boxOpacity: f / (FADE_FRAMES - 1) });
            addGifFrame();
          }
          // 與 MP4 對齊:淡入後停幾幀確保對話框完全顯示
          for (let f = 0; f < 3; f++) {
            _vnsRenderSlideFrame(canvas, slide, { lineIdx: li, partialText: "", boxOpacity: 1 });
            addGifFrame();
          }
        } else {
          _vnsRenderSlideFrame(canvas, slide, { lineIdx: li, partialText: "", boxOpacity: 1 });
          addGifFrame();
        }
        if (full.length === 0) {
          const emptyHoldFrames = isLastLine ? SLIDE_HOLD_FRAMES : HOLD_FRAMES;
          for (let f = 0; f < emptyHoldFrames; f++) {
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
          // beat 間 / 收尾:維持整句顯示(對話框不淡出);最後一行用 slide.holdDuration
          const endHoldFrames = isLastLine ? SLIDE_HOLD_FRAMES : HOLD_FRAMES;
          for (let f = 0; f < endHoldFrames; f++) {
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
