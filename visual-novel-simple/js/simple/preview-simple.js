// simple/preview-simple.js — 簡易版預覽渲染與播放引擎
// 任務 2/3:播放支援「單幕預覽 / 從這幕開始」兩模式、暫停/恢復/停止、每幕停留時間(holdDuration)。
// 任務 1:每幕開始播放時套用特效(applySlideEffects),暫停時凍結特效動畫(setEffectsPaused)。

function _stripStyleTags(s) {
  // 把所有 [xxx] tag 從顯示內容剝掉
  return String(s || "").replace(/\[[^\]]+\]/g, "");
}

function _renderSpeakerHtml(speaker) {
  if (!speaker) return "";
  return `<div class="simple-preview-speaker">${_shEsc(speaker)}</div>`;
}

// 把全域字型 / 字級套到主預覽(讀最新 state,不快取)
function _applySimplePreviewFonts(dialogEl) {
  if (!dialogEl) return;
  const fs = state.fontSizes || { dialog: 18, speaker: 16, narration: 16, inner: 15 };
  const sd = state.styleDefaults || {};
  const FB = (typeof FONT_BY_ID !== "undefined") ? FONT_BY_ID : {};
  const stackOf = (id) => { const f = id && FB[id]; return (f && f.stack) || ""; };
  const weightOf = (id) => { const f = id && FB[id]; return (f && f.weight) ? String(f.weight) : ""; };
  const apply = (sel, px, fontId) => {
    const el = dialogEl.querySelector(sel);
    if (!el) return;
    // font-size 由 ResizeObserver 透過 --preview-*-font-size CSS variable 管理,這裡不設
    if (fontId !== undefined) {
      el.style.fontFamily = stackOf(fontId);
      el.style.fontWeight = weightOf(fontId);
    }
  };
  apply(".simple-preview-speaker", fs.speaker, sd.speaker && sd.speaker.font);
  apply(".simple-preview-content", fs.dialog, sd.dialog && sd.dialog.font);
  apply(".simple-preview-narration", fs.narration, sd.narration && sd.narration.font);
  apply(".simple-preview-inner", fs.inner, sd.inner && sd.inner.font);
}

// escape HTML 後把 \n 轉成 <br>(合併多行 content 在 DOM 預覽才會換行)
function _escWithBr(s) {
  return _shEsc(s).replace(/\n/g, "<br>");
}

function _renderPreviewLine(dialogEl, line, partial, faded) {
  if (!dialogEl || !line) return;
  dialogEl.hidden = false;
  dialogEl.classList.toggle("faded", !!faded);
  const showText = partial != null ? partial : line.content;
  const clean = _stripStyleTags(showText);
  if (line.type === "narration") {
    dialogEl.innerHTML = `<div class="simple-preview-narration">${_escWithBr(clean)}</div>`;
  } else if (line.type === "inner") {
    dialogEl.innerHTML = `${_renderSpeakerHtml(line.speaker)}<div class="simple-preview-inner">${_escWithBr(clean)}</div>`;
  } else {
    dialogEl.innerHTML = `${_renderSpeakerHtml(line.speaker)}<div class="simple-preview-content">${_escWithBr(clean)}</div>`;
  }
  _applySimplePreviewFonts(dialogEl);
}

// ============================================================
//  播放引擎(任務 2 / 3)
// ============================================================

const _vnsSimplePlayback = {
  playing: false,
  paused: false,
  mode: "single",       // "single"(單幕,播完停) | "continuous"(從這幕開始,播到最後)
  slideId: null,        // 當前正在播的幕 id
  phase: null,          // "typing" | "interhold" | "hold" | "choice"
  lineIdx: 0,
  charIdx: 0,
  curLine: null,
  curFull: "",
  typeTimer: null,
  holdTimer: null,
  fadeTimer: null,
  choiceTimers: [],
  holdEndAt: 0,
  holdRemain: 0,
  typeSpeed: 45,        // ms / char
  fadeMs: 300,
  interLineHold: 500,   // 同一幕內 beat 間短停留(任務 1)
};

const CHOICE_TIMING = {
  fadeInDuration: 500,
  displayDuration: 1500,
  selectAnimDuration: 500,
  afterSelectStay: 800,
  fadeOutDuration: 300,
};

function _fxStage() { return document.getElementById("simplePreviewStage"); }
function _fxDialog() { return document.getElementById("simplePreviewDialog"); }

function _vnsSPClearTimers() {
  const pb = _vnsSimplePlayback;
  if (pb.typeTimer) { clearInterval(pb.typeTimer); pb.typeTimer = null; }
  if (pb.holdTimer) { clearTimeout(pb.holdTimer); pb.holdTimer = null; }
  if (pb.fadeTimer) { clearTimeout(pb.fadeTimer); pb.fadeTimer = null; }
  if (Array.isArray(pb.choiceTimers)) pb.choiceTimers.forEach(t => clearTimeout(t));
  pb.choiceTimers = [];
  const box = document.getElementById("simplePreviewChoices");
  if (box) box.classList.remove("anim-enter", "anim-exit");
}

function _vnsCurPlaybackSlide() {
  const cards = state.simpleCards || [];
  return cards.find(s => s.id === _vnsSimplePlayback.slideId) || getCurrentSlide();
}

// 入口:由兩個預覽按鈕呼叫(mode = "single" | "continuous")
async function startSimplePlayback(mode) {
  const pb = _vnsSimplePlayback;
  if (pb.playing) return;
  const cur = getCurrentSlide();
  if (!cur) { showToast("沒有可播放的幕", "info"); return; }
  if (isChoiceSlide(cur)) {
    const ok = await checkChoiceSlideBeforeRun(cur, "play");
    if (!ok) return;
  } else {
    if (typeof _vnsEnsureSlideParsed === "function") _vnsEnsureSlideParsed(cur);
    if (!Array.isArray(cur.parsedLines) || !cur.parsedLines.length) {
      showToast("沒有可播放的對話", "info");
      return;
    }
  }
  _vnsSPClearTimers();
  pb.playing = true;
  pb.paused = false;
  // 任務 1-4A / 1-5:一般打字機速度用全域文字速度,於「開始播放」時套用(拖滑桿不立即重播)
  if (typeof getTextSpeedPerChar === "function") {
    pb.typeSpeed = getTextSpeedPerChar(state.dialogStyle && state.dialogStyle.textSpeed);
  }
  pb.mode = (mode === "continuous") ? "continuous" : "single";
  _vnsUpdatePlaybackBtn();
  _beginSlidePlayback(cur);
}

// 切換鈕行為:未播 → 開始;播放中(同模式)→ 暫停;暫停中 → 恢復
function toggleSimplePlayback(mode) {
  const pb = _vnsSimplePlayback;
  if (!pb.playing) { startSimplePlayback(mode); return; }
  if (pb.mode !== mode) return;   // 另一個模式正在播 → 該鈕已 disabled,忽略
  if (pb.paused) resumeSimplePlayback();
  else pauseSimplePlayback();
}

function _beginSlidePlayback(slide) {
  const pb = _vnsSimplePlayback;
  pb.slideId = slide.id;
  pb.lineIdx = 0;
  pb.charIdx = 0;
  pb.phase = null;
  state.simpleCurrentSlideId = slide.id;
  if (typeof renderSimpleSlideList === "function") renderSimpleSlideList();
  // renderSimpleEditor 會渲染 CG + 套用特效;播放中不會覆寫對話(它檢查 playing)
  if (typeof renderSimpleEditor === "function") renderSimpleEditor();
  if (typeof _vnsEnsureSlideParsed === "function") _vnsEnsureSlideParsed(slide);
  if (isChoiceSlide(slide)) {
    pb.phase = "choice";
    _playChoiceAnimation();
  } else {
    _playSimpleLine();
  }
}

function _playSimpleLine() {
  const pb = _vnsSimplePlayback;
  if (!pb.playing || pb.paused) return;
  const cur = _vnsCurPlaybackSlide();
  const dialogEl = _fxDialog();
  if (!cur || !dialogEl) return stopSimplePlayback();
  const lines = cur.parsedLines || [];
  if (pb.lineIdx >= lines.length) return _enterFinalHold();
  const line = lines[pb.lineIdx];
  pb.curLine = line;
  pb.curFull = _stripStyleTags(line.content);
  pb.phase = "typing";

  // 任務 5:文字替換取代打字機 — 整行立即顯示 + 逐字解碼
  if (pb.charIdx === 0 && typeof hasTextDecode === "function" && hasTextDecode(cur)) {
    _renderPreviewLine(dialogEl, line, null, false);
    if (typeof runTextDecode === "function") runTextDecode(dialogEl, cur);
    const params = getTextDecodeParams(textDecodeIntensity(cur));
    const reRe = /[一-鿿㐀-䶿぀-ヿa-zA-Z0-9]/g;
    // 角色名不解碼,只算內文可解碼字數;打字機式總時長 = 字數×step + 單字解碼時長
    const reCount = (pb.curFull.match(reRe) || []).length;
    const decodeMs = reCount * params.typewriterStep + params.perCharGlitchDuration;
    pb.phase = "decode";
    pb.holdRemain = decodeMs;
    pb.holdEndAt = performance.now() + decodeMs;
    pb.holdTimer = setTimeout(_afterLineTyped, decodeMs);
    return;
  }

  if (pb.charIdx === 0) {
    if (pb.lineIdx === 0) {
      // 幕的第一句:淡入(entering)
      _renderPreviewLine(dialogEl, line, "", true);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!pb.playing || pb.paused) return;
        dialogEl.classList.remove("faded");
        _typeStep();
      }));
    } else {
      // 後續 beat:對話框維持顯示,直接換成新內容開始打字(不淡出/淡入,避免閃爍)
      dialogEl.classList.remove("faded");
      _renderPreviewLine(dialogEl, line, "", false);
      _typeStep();
    }
  } else {
    _typeStep();   // 從暫停點繼續
  }
}

function _typeStep() {
  const pb = _vnsSimplePlayback;
  const dialogEl = _fxDialog();
  if (!pb.playing || pb.paused || !dialogEl || !pb.curLine) return;
  if (pb.curFull.length === 0) { _afterLineTyped(); return; }
  pb.typeTimer = setInterval(() => {
    if (!pb.playing || pb.paused) { clearInterval(pb.typeTimer); pb.typeTimer = null; return; }
    pb.charIdx++;
    _renderPreviewLine(dialogEl, pb.curLine, pb.curFull.slice(0, pb.charIdx), false);
    if (pb.charIdx >= pb.curFull.length) {
      clearInterval(pb.typeTimer); pb.typeTimer = null;
      _afterLineTyped();
    }
  }, pb.typeSpeed);
}

function _afterLineTyped() {
  const pb = _vnsSimplePlayback;
  const cur = _vnsCurPlaybackSlide();
  const lines = (cur && cur.parsedLines) || [];
  pb.lineIdx++;
  pb.charIdx = 0;
  if (pb.lineIdx < lines.length) {
    pb.phase = "interhold";
    pb.holdEndAt = performance.now() + pb.interLineHold;
    pb.holdTimer = setTimeout(_doInterLineFadeNext, pb.interLineHold);
  } else {
    _enterFinalHold();
  }
}

function _doInterLineFadeNext() {
  const pb = _vnsSimplePlayback;
  if (!pb.playing || pb.paused) return;
  // beat 之間對話框「不淡出、不重建」,只在 _playSimpleLine 內換內容(維持可見,避免閃爍)
  _playSimpleLine();
}

// 打字機跑完 → 特效繼續演到「停留時間」結束(任務 1-7 / 3-5)
function _enterFinalHold() {
  const pb = _vnsSimplePlayback;
  const cur = _vnsCurPlaybackSlide();
  pb.phase = "hold";
  const sec = (cur && typeof cur.holdDuration === "number") ? cur.holdDuration : 1;
  const ms = Math.max(0, sec * 1000);
  pb.holdRemain = ms;
  pb.holdEndAt = performance.now() + ms;
  pb.holdTimer = setTimeout(_afterSlideHold, ms);
}

function _afterSlideHold() {
  const pb = _vnsSimplePlayback;
  if (!pb.playing) return;
  const cards = state.simpleCards || [];
  const idx = cards.findIndex(s => s.id === pb.slideId);
  const cur = idx >= 0 ? cards[idx] : null;
  const tr = (cur && cur.transition) || "none";
  if (pb.mode === "continuous" && idx >= 0 && idx < cards.length - 1) {
    // 切下一幕前演出結束轉場
    _runPreviewTransition(tr, () => { if (pb.playing) _beginSlidePlayback(cards[idx + 1]); });
    return;
  }
  // 任務 6:單幕預覽 / 連續播放的最後一幕 — 仍套用結束轉場(淡出)後停止
  _endTransitionThenStop(tr);
}

// 任務 6:結束轉場(淡出),完成後停止播放。none → 直接停止。
function _endTransitionThenStop(type) {
  const pb = _vnsSimplePlayback;
  const stage = _fxStage();
  if (!stage || type === "none") { stopSimplePlayback(); return; }
  const DUR = 500;
  if (type === "fade_black" || type === "fade_white") {
    const color = (type === "fade_white") ? "#fff" : "#000";
    let ov = stage.querySelector(".transition-overlay");
    if (!ov) { ov = document.createElement("div"); ov.className = "transition-overlay"; stage.appendChild(ov); }
    ov.style.cssText = `position:absolute;inset:0;z-index:60;pointer-events:none;background:${color};opacity:0;transition:opacity ${DUR}ms;`;
    void ov.offsetWidth;
    ov.style.opacity = "1";
    pb.fadeTimer = setTimeout(() => stopSimplePlayback(), DUR);
  } else {   // crossfade → 淡出舞台
    stage.style.transition = `opacity ${DUR}ms`;
    stage.style.opacity = "0";
    pb.fadeTimer = setTimeout(() => stopSimplePlayback(), DUR);
  }
}

// 任務 4:預覽用 DOM 轉場(0.5 秒固定)。switchFn 在「中點」換到下一幕。
function _clearTransitionArtifacts() {
  const stage = _fxStage();
  if (!stage) return;
  const ov = stage.querySelector(".transition-overlay");
  if (ov) ov.remove();
  stage.style.opacity = "";
  stage.style.transition = "";
}

function _runPreviewTransition(type, switchFn) {
  const pb = _vnsSimplePlayback;
  const stage = _fxStage();
  if (!stage || type === "none") { switchFn(); return; }
  const HALF = 250;
  if (type === "fade_black" || type === "fade_white") {
    const color = (type === "fade_white") ? "#fff" : "#000";
    let ov = stage.querySelector(".transition-overlay");
    if (!ov) { ov = document.createElement("div"); ov.className = "transition-overlay"; stage.appendChild(ov); }
    ov.style.cssText = `position:absolute;inset:0;z-index:60;pointer-events:none;background:${color};opacity:0;transition:opacity ${HALF}ms;`;
    void ov.offsetWidth;
    ov.style.opacity = "1";
    pb.fadeTimer = setTimeout(() => {
      if (!pb.playing) { _clearTransitionArtifacts(); return; }
      switchFn();   // 換到下一幕(此時畫面被遮罩蓋住)
      const ov2 = stage.querySelector(".transition-overlay");
      if (ov2) {
        void ov2.offsetWidth;
        ov2.style.opacity = "0";
        pb.fadeTimer = setTimeout(() => { if (ov2.parentNode) ov2.remove(); }, HALF);
      }
    }, HALF);
  } else if (type === "crossfade") {
    stage.style.transition = `opacity ${HALF}ms`;
    stage.style.opacity = "0";
    pb.fadeTimer = setTimeout(() => {
      if (!pb.playing) { _clearTransitionArtifacts(); return; }
      switchFn();
      requestAnimationFrame(() => {
        stage.style.opacity = "1";
        pb.fadeTimer = setTimeout(() => { stage.style.transition = ""; }, HALF);
      });
    }, HALF);
  }
}

function _playChoiceAnimation() {
  const pb = _vnsSimplePlayback;
  const cur = _vnsCurPlaybackSlide();
  const box = document.getElementById("simplePreviewChoices");
  if (!cur || !box) return stopSimplePlayback();
  const dialogEl = _fxDialog();
  if (dialogEl) { dialogEl.hidden = true; dialogEl.innerHTML = ""; }

  const T = CHOICE_TIMING;
  const correct = getCorrectChoice(cur);
  const push = (fn, delay) => { pb.choiceTimers.push(setTimeout(fn, delay)); };

  box.hidden = false;
  box.innerHTML = "";
  _buildChoiceEls(cur.choices, {}).forEach(el => box.appendChild(el));
  box.classList.remove("anim-exit");
  box.classList.add("anim-enter");
  requestAnimationFrame(() => requestAnimationFrame(() => { box.classList.remove("anim-enter"); }));

  push(() => {
    box.querySelectorAll(".simple-choice-opt").forEach(el => {
      if (correct && el.dataset.choiceId === correct.id) el.classList.add("selected");
      else el.classList.add("faded");
    });
  }, T.fadeInDuration + T.displayDuration);

  push(() => { box.classList.add("anim-exit"); },
    T.fadeInDuration + T.displayDuration + T.selectAnimDuration + T.afterSelectStay);

  // 選擇動畫結束 → 進入該幕停留時間 → (連續模式)切下一幕 / (單幕)停止
  push(() => { _enterFinalHold(); },
    T.fadeInDuration + T.displayDuration + T.selectAnimDuration + T.afterSelectStay + T.fadeOutDuration);
}

function pauseSimplePlayback() {
  const pb = _vnsSimplePlayback;
  if (!pb.playing || pb.paused) return;
  pb.paused = true;
  if (pb.phase === "hold" || pb.phase === "interhold" || pb.phase === "decode") {
    pb.holdRemain = Math.max(0, pb.holdEndAt - performance.now());
  }
  _vnsSPClearTimers();
  setEffectsPaused(_fxStage(), _fxDialog(), true);
  _vnsUpdatePlaybackBtn();
}

function resumeSimplePlayback() {
  const pb = _vnsSimplePlayback;
  if (!pb.playing || !pb.paused) return;
  pb.paused = false;
  setEffectsPaused(_fxStage(), _fxDialog(), false);
  _vnsUpdatePlaybackBtn();
  if (pb.phase === "typing") {
    _typeStep();
  } else if (pb.phase === "decode") {
    pb.holdTimer = setTimeout(_afterLineTyped, pb.holdRemain);
  } else if (pb.phase === "interhold") {
    pb.holdTimer = setTimeout(_doInterLineFadeNext, pb.holdRemain);
  } else if (pb.phase === "hold") {
    pb.holdEndAt = performance.now() + pb.holdRemain;
    pb.holdTimer = setTimeout(_afterSlideHold, pb.holdRemain);
  } else if (pb.phase === "choice") {
    _playChoiceAnimation();   // best-effort:重播整段選擇動畫
  }
}

function stopSimplePlayback() {
  const pb = _vnsSimplePlayback;
  _vnsSPClearTimers();
  _clearTransitionArtifacts();
  pb.playing = false;
  pb.paused = false;
  pb.phase = null;
  pb.lineIdx = 0;
  pb.charIdx = 0;
  pb.slideId = null;
  _vnsUpdatePlaybackBtn();
  // 回到編輯模式靜態畫面(renderSimpleEditor 會重新套用當前幕特效)
  if (typeof renderSimpleEditor === "function") renderSimpleEditor();
}

// 兩個預覽按鈕 + 停止鈕的狀態同步
function _vnsUpdatePlaybackBtn() {
  const pb = _vnsSimplePlayback;
  const one = document.getElementById("simplePlayOneBtn");
  const all = document.getElementById("simplePlayAllBtn");
  const stop = document.getElementById("simpleStopBtn");
  const active = pb.playing;
  const isOne = pb.mode === "single";
  if (one) {
    if (active && isOne) one.textContent = pb.paused ? "▶ 繼續" : "⏸ 暫停";
    else one.textContent = "▶ 單幕預覽";
    one.disabled = active && !isOne;
  }
  if (all) {
    if (active && !isOne) all.textContent = pb.paused ? "▶ 繼續" : "⏸ 暫停";
    else all.textContent = "▶▶ 從這幕開始";
    all.disabled = active && isOne;
  }
  if (stop) stop.hidden = !active;
}

export {
  _stripStyleTags,
  _renderSpeakerHtml,
  _renderPreviewLine,
  _applySimplePreviewFonts,
  _vnsSPClearTimers,
  _vnsCurPlaybackSlide,
  startSimplePlayback,
  toggleSimplePlayback,
  _beginSlidePlayback,
  _playSimpleLine,
  _typeStep,
  _afterLineTyped,
  _doInterLineFadeNext,
  _enterFinalHold,
  _afterSlideHold,
  _playChoiceAnimation,
  pauseSimplePlayback,
  resumeSimplePlayback,
  stopSimplePlayback,
  _vnsUpdatePlaybackBtn,
  _vnsSimplePlayback,
  CHOICE_TIMING,
};
