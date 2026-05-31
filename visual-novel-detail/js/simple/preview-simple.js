// simple/preview-simple.js — 由 index.js 搬出(階段 3-G),內容未改動
// 簡易版預覽渲染與播放引擎。_vnsSimplePlayback/CHOICE_TIMING 匯出供其他模組經 window 共用(同一物件)。

function _stripStyleTags(s) {
  // 暫時:把所有 [xxx] tag 從顯示內容剝掉(實際樣式 apply 在 task 4 之後做)
  return String(s || "").replace(/\[[^\]]+\]/g, "");
}

function _renderSpeakerHtml(speaker) {
  if (!speaker) return "";
  return `<div class="simple-preview-speaker">${_shEsc(speaker)}</div>`;
}

// 任務 2:把全域字型 / 字級套到主預覽(讀最新 state,不快取),
// 與樣式 modal 右側即時預覽(updateDefaultsPreview)用同一份設定來源。
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
    if (px != null) el.style.fontSize = px + "px";
    if (fontId !== undefined) {
      el.style.fontFamily = stackOf(fontId);
      el.style.fontWeight = weightOf(fontId);
    }
  };
  apply(".simple-preview-speaker", fs.speaker, undefined);
  apply(".simple-preview-content", fs.dialog, sd.dialog && sd.dialog.font);
  apply(".simple-preview-narration", fs.narration, sd.narration && sd.narration.font);
  apply(".simple-preview-inner", fs.inner, sd.inner && sd.inner.font);
}

function _renderPreviewLine(dialogEl, line, partial, faded) {
  if (!dialogEl || !line) return;
  dialogEl.hidden = false;
  dialogEl.classList.toggle("faded", !!faded);
  const showText = partial != null ? partial : line.content;
  const clean = _stripStyleTags(showText);
  if (line.type === "narration") {
    dialogEl.innerHTML = `<div class="simple-preview-narration">${_shEsc(clean)}</div>`;
  } else if (line.type === "inner") {
    dialogEl.innerHTML = `${_renderSpeakerHtml(line.speaker)}<div class="simple-preview-inner">(${_shEsc(clean)})</div>`;
  } else {
    dialogEl.innerHTML = `${_renderSpeakerHtml(line.speaker)}<div class="simple-preview-content">${_shEsc(clean)}</div>`;
  }
  _applySimplePreviewFonts(dialogEl);
}

const _vnsSimplePlayback = {
  playing: false,
  lineIdx: 0,
  typeTimer: null,
  holdTimer: null,
  fadeTimer: null,
  choiceTimers: [],
  typeSpeed: 45,    // ms / char
  holdMs: 500,
  fadeMs: 300,
};

const CHOICE_TIMING = {
  fadeInDuration: 500,     // 選項淡入(ms)
  displayDuration: 1500,   // 停留讓觀眾讀
  selectAnimDuration: 500, // 選擇動畫(高亮 + 淡化)
  afterSelectStay: 800,    // 選完後停留
  fadeOutDuration: 300,    // 整體淡出
};

function _vnsSPClearTimers() {
  if (_vnsSimplePlayback.typeTimer) { clearInterval(_vnsSimplePlayback.typeTimer); _vnsSimplePlayback.typeTimer = null; }
  if (_vnsSimplePlayback.holdTimer) { clearTimeout(_vnsSimplePlayback.holdTimer); _vnsSimplePlayback.holdTimer = null; }
  if (_vnsSimplePlayback.fadeTimer) { clearTimeout(_vnsSimplePlayback.fadeTimer); _vnsSimplePlayback.fadeTimer = null; }
  if (Array.isArray(_vnsSimplePlayback.choiceTimers)) {
    _vnsSimplePlayback.choiceTimers.forEach(t => clearTimeout(t));
  }
  _vnsSimplePlayback.choiceTimers = [];
  const box = document.getElementById("simplePreviewChoices");
  if (box) box.classList.remove("anim-enter", "anim-exit");
}

async function startSimplePlayback() {
  const cur = getCurrentSlide();
  // 選項幕功能:播放前檢查(無 CG / 無正解 → 攔截;空白選項 → 確認)
  if (isChoiceSlide(cur)) {
    const ok = await checkChoiceSlideBeforeRun(cur, "play");
    if (!ok) return;
    _vnsSPClearTimers();
    _vnsSimplePlayback.playing = true;
    _vnsUpdatePlaybackBtn();
    _playChoiceAnimation();
    return;
  }
  if (!cur || !Array.isArray(cur.parsedLines) || !cur.parsedLines.length) {
    showToast("沒有可播放的對話", "info");
    return;
  }
  _vnsSPClearTimers();
  _vnsSimplePlayback.playing = true;
  _vnsSimplePlayback.lineIdx = 0;
  _vnsUpdatePlaybackBtn();
  _playSimpleLine();
}

function _playChoiceAnimation() {
  const cur = getCurrentSlide();
  const box = document.getElementById("simplePreviewChoices");
  if (!cur || !box) return stopSimplePlayback();
  const dialogEl = document.getElementById("simplePreviewDialog");
  if (dialogEl) { dialogEl.hidden = true; dialogEl.innerHTML = ""; }

  const T = CHOICE_TIMING;
  const correct = getCorrectChoice(cur);
  const push = (fn, delay) => { _vnsSimplePlayback.choiceTimers.push(setTimeout(fn, delay)); };

  // 建立選項(播放時不顯示正解提示),先以 anim-enter 隱藏
  box.hidden = false;
  box.innerHTML = "";
  _buildChoiceEls(cur.choices, {}).forEach(el => box.appendChild(el));
  box.classList.remove("anim-exit");
  box.classList.add("anim-enter");

  // 1. 淡入(從下方滑入 + opacity 0→1)
  requestAnimationFrame(() => requestAnimationFrame(() => {
    box.classList.remove("anim-enter");
  }));

  // 2. 淡入 + 停留 → 正解高亮 + 其他淡化
  push(() => {
    box.querySelectorAll(".simple-choice-opt").forEach(el => {
      if (correct && el.dataset.choiceId === correct.id) el.classList.add("selected");
      else el.classList.add("faded");
    });
  }, T.fadeInDuration + T.displayDuration);

  // 3. 選擇動畫 + 停留 → 整體淡出
  push(() => {
    box.classList.add("anim-exit");
  }, T.fadeInDuration + T.displayDuration + T.selectAnimDuration + T.afterSelectStay);

  // 4. 淡出後 → 切到下一幕(若有);最後一幕則停止
  push(() => {
    _advanceAfterChoice();
  }, T.fadeInDuration + T.displayDuration + T.selectAnimDuration + T.afterSelectStay + T.fadeOutDuration);
}

function _advanceAfterChoice() {
  const cards = state.simpleCards || [];
  const idx = getCurrentSlideIdx();
  if (idx >= 0 && idx < cards.length - 1) {
    state.simpleCurrentSlideId = cards[idx + 1].id;
  }
  stopSimplePlayback();  // 內部會 renderSimpleEditor 重繪(切到的下一幕或停在當前幕)
}

function stopSimplePlayback() {
  _vnsSPClearTimers();
  _vnsSimplePlayback.playing = false;
  _vnsUpdatePlaybackBtn();
  renderSimpleEditor();
}

function _vnsUpdatePlaybackBtn() {
  // 任務 5:預覽播放按鈕已移到底部工具列
  const barBtn = document.getElementById("barPreviewPlayBtn");
  if (barBtn) barBtn.textContent = _vnsSimplePlayback.playing ? "⏸ 暫停" : "▶ 預覽";
}

function _playSimpleLine() {
  if (!_vnsSimplePlayback.playing) return;
  const cur = getCurrentSlide();
  const dialogEl = document.getElementById("simplePreviewDialog");
  if (!cur || !dialogEl) return stopSimplePlayback();
  const lines = cur.parsedLines || [];
  const idx = _vnsSimplePlayback.lineIdx;
  if (idx >= lines.length) return stopSimplePlayback();
  const line = lines[idx];

  // 1. fade in 新段落(先用 faded 渲染、下一個 frame 移除 faded)
  _renderPreviewLine(dialogEl, line, "", true);
  // 強制 reflow 後移除 faded → 觸發 fade-in
  // requestAnimationFrame 兩次確保 transition 啟動
  requestAnimationFrame(() => requestAnimationFrame(() => {
    dialogEl.classList.remove("faded");
    // 2. 文字機 — 逐字填入
    const full = _stripStyleTags(line.content);
    let i = 0;
    _vnsSimplePlayback.typeTimer = setInterval(() => {
      i++;
      _renderPreviewLine(dialogEl, line, full.slice(0, i), false);
      if (i >= full.length) {
        clearInterval(_vnsSimplePlayback.typeTimer);
        _vnsSimplePlayback.typeTimer = null;
        // 3. 停留 holdMs
        _vnsSimplePlayback.holdTimer = setTimeout(() => {
          _vnsSimplePlayback.holdTimer = null;
          // 4. fade out
          dialogEl.classList.add("faded");
          _vnsSimplePlayback.fadeTimer = setTimeout(() => {
            _vnsSimplePlayback.fadeTimer = null;
            _vnsSimplePlayback.lineIdx++;
            _playSimpleLine();
          }, _vnsSimplePlayback.fadeMs);
        }, _vnsSimplePlayback.holdMs);
      }
    }, _vnsSimplePlayback.typeSpeed);
  }));
}

export {
  _stripStyleTags,
  _renderSpeakerHtml,
  _renderPreviewLine,
  _vnsSPClearTimers,
  startSimplePlayback,
  _playChoiceAnimation,
  _advanceAfterChoice,
  stopSimplePlayback,
  _vnsUpdatePlaybackBtn,
  _playSimpleLine,
  _vnsSimplePlayback,
  CHOICE_TIMING,
};
