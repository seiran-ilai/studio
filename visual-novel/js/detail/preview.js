// detail/preview.js — 由 index.js 搬出(階段 3-D),內容未改動
// 相依:detail parser/renderer/stage、state、els 皆經全域(window)取得。

function typewrite(text) {
  state.fullText = text;
  state.isTyping = true;
  els.dialogText.textContent = "";
  let i = 0;
  state.typingTimer = setInterval(() => {
    i++;
    els.dialogText.textContent = text.slice(0, i);
    if (i >= text.length) {
      clearInterval(state.typingTimer);
      state.typingTimer = null;
      state.isTyping = false;
      els.dialogText.innerHTML = renderInlineMarkdownToHTML(text);
      els.dialogIndicator.classList.add("show");
    }
  }, 45);
}

function updateProgress() {
  const total = state.parsed.filter(isVisibleType).length;
  const current = state.parsed.slice(0, state.currentIndex + 1).filter(isVisibleType).length;
  els.dialogProgress.textContent = total > 0 ? `${String(current).padStart(2, "0")} / ${String(total).padStart(2, "0")}` : "";
}

function renderLineCount() {
  const visible = state.parsed.filter(isVisibleType).length;
  els.lineCount.textContent = `${visible} 步 · ${state.parsed.length} 行`;
}

function renderAt(idx) {
  // clamp
  if (idx < 0) idx = 0;
  if (idx >= state.parsed.length) idx = state.parsed.length - 1;
  state.currentIndex = idx;

  const activeChar = computeStageStateAt(state.parsed, idx);
  renderBackground();
  renderCharacters(activeChar);
  renderCg();

  const cur = state.parsed[idx];
  if (cur && cur.type === "choices") {
    // show choices preview, hide dialog box
    renderChoicesStatic(cur);
    renderDialog(null);
  } else if (cur && (cur.type === "dialog" || cur.type === "narration")) {
    renderChoicesStatic(null);
    renderDialog(cur);
  } else if (cur) {
    renderChoicesStatic(null);
    renderDialog(null);
  }
  updateProgress();
  updatePreviewCounter();
}

function updatePreviewCounter() {
  const cur = document.getElementById("previewCounterCurrent");
  const tot = document.getElementById("previewCounterTotal");
  if (!cur || !tot) return;
  const total = state.parsed.length;
  cur.textContent = total > 0 ? Math.min(state.currentIndex + 1, total) : 0;
  tot.textContent = total;
}

function jumpToBeat(idx) {
  if (state.parsed.length === 0) return;
  renderAt(Math.max(0, Math.min(idx, state.parsed.length - 1)));
}

function isVisibleType(ln) {
  return ln.type === "dialog" || ln.type === "narration"
      || ln.type === "choices" || ln.type === "scene_only";
}

function nextLine() {
  if (state.isTyping) {
    // finish typing instantly
    if (state.typingTimer) { clearInterval(state.typingTimer); state.typingTimer = null; }
    els.dialogText.innerHTML = renderInlineMarkdownToHTML(state.fullText);
    state.isTyping = false;
    els.dialogIndicator.classList.add("show");
    return;
  }
  let next = state.currentIndex + 1;
  while (next < state.parsed.length) {
    if (isVisibleType(state.parsed[next])) break;
    next++;
  }
  if (next >= state.parsed.length) return;
  renderAt(next);
}

function prevLine() {
  // If still typing, just finish — don't go back yet (matches VN convention).
  if (state.isTyping) {
    if (state.typingTimer) { clearInterval(state.typingTimer); state.typingTimer = null; }
    els.dialogText.innerHTML = renderInlineMarkdownToHTML(state.fullText);
    state.isTyping = false;
    els.dialogIndicator.classList.add("show");
    return;
  }
  let prev = state.currentIndex - 1;
  while (prev >= 0) {
    if (isVisibleType(state.parsed[prev])) break;
    prev--;
  }
  if (prev < 0) return;
  renderAt(prev);
}

function jumpToStart() {
  let i = 0;
  while (i < state.parsed.length) {
    if (isVisibleType(state.parsed[i])) break;
    i++;
  }
  renderAt(Math.min(i, state.parsed.length - 1));
}

function reparseAndRender(resetIndex = false) {
  // 保存 textarea 捲動位置(L2) — 防止內部 render 意外重設視野
  const _ta = els.scriptArea;
  const _savedScrollTop = _ta ? _ta.scrollTop : 0;

  state.parsed = parseScript(state.script);
  renderLineCount();
  if (resetIndex || state.currentIndex >= state.parsed.length) {
    jumpToStart();
  } else {
    renderAt(state.currentIndex);
  }
  syncSyntaxHighlight();
  applyGameUI();

  // 還原 scrollTop(僅在被意外改動時)
  if (_ta && _ta.scrollTop !== _savedScrollTop) {
    _ta.scrollTop = _savedScrollTop;
  }
}

const previewAllState = { idx: 0, playing: true, timer: null };

function openPreviewAll() {
  if (!state.simpleCards.length) {
    showToast("沒有卡片可以預覽", "warn");
    return;
  }
  const overlay = document.getElementById("previewAllOverlay");
  if (!overlay) return;
  previewAllState.idx = 0;
  previewAllState.playing = true;
  buildPreviewAllStage();
  renderPreviewAllThumbs();
  playPreviewAllAt(0);
  overlay.hidden = false;
}

function buildPreviewAllStage() {
  const main = document.getElementById("previewAllMain");
  if (!main) return;
  main.innerHTML = "";
  const stage = document.createElement("div");
  stage.className = "stage";
  stage.dataset.ratio = "16:9";
  stage.id = "previewAllStage";
  stage.innerHTML = `
    <div class="stage-bg" id="paStageBg"></div>
    <div class="stage-cg" id="paStageCg"></div>
    <div class="dialog-box" id="paDialogBox">
      <div class="dialog-speaker" id="paDialogSpeaker"></div>
      <div class="dialog-text" id="paDialogText"></div>
    </div>
  `;
  main.appendChild(stage);
}

function playPreviewAllAt(idx) {
  if (previewAllState.timer) clearTimeout(previewAllState.timer);
  if (idx >= state.simpleCards.length) { previewAllState.playing = false; updatePreviewAllPlayBtn(); return; }
  previewAllState.idx = idx;
  const card = state.simpleCards[idx];
  const cg = card.cgName ? state.cgs[card.cgName] : null;
  const cgEl = document.getElementById("paStageCg");
  if (cgEl) {
    if (cg && cg.dataUrl) {
      cgEl.style.backgroundImage = `url(${cg.dataUrl})`;
      cgEl.style.backgroundSize = "cover";
      cgEl.style.backgroundPosition = "center";
    } else {
      cgEl.style.backgroundImage = "";
    }
  }
  // 簡化播放:依序顯示每段對白,每段 2.4 秒
  let dIdx = 0;
  const spkEl = document.getElementById("paDialogSpeaker");
  const txtEl = document.getElementById("paDialogText");
  const boxEl = document.getElementById("paDialogBox");
  function showNext() {
    if (dIdx >= card.dialogs.length) {
      if (previewAllState.playing) {
        previewAllState.timer = setTimeout(() => playPreviewAllAt(idx + 1), 600);
      }
      return;
    }
    const d = card.dialogs[dIdx];
    if (boxEl) boxEl.hidden = !d.text || !d.text.trim();
    if (spkEl) spkEl.textContent = d.speaker || "";
    if (txtEl) txtEl.textContent = d.text || "";
    dIdx++;
    if (previewAllState.playing) {
      previewAllState.timer = setTimeout(showNext, 2400);
    }
  }
  showNext();
  renderPreviewAllThumbs();
  const indexEl = document.getElementById("previewAllIndex");
  if (indexEl) indexEl.textContent = `${idx + 1} / ${state.simpleCards.length}`;
}

function renderPreviewAllThumbs() {
  const wrap = document.getElementById("previewAllThumbs");
  if (!wrap) return;
  wrap.innerHTML = "";
  state.simpleCards.forEach((card, i) => {
    const t = document.createElement("div");
    t.className = "preview-all-thumb" + (i === previewAllState.idx ? " active" : "");
    const cg = card.cgName ? state.cgs[card.cgName] : null;
    if (cg && cg.dataUrl) t.style.backgroundImage = `url(${cg.dataUrl})`;
    t.addEventListener("click", () => playPreviewAllAt(i));
    wrap.appendChild(t);
  });
}

function updatePreviewAllPlayBtn() {
  const btn = document.getElementById("previewAllPlayPause");
  if (btn) btn.textContent = previewAllState.playing ? "⏸" : "▶";
}

const playbackState = {
  playing: false,
  speed: 1,
  currentStep: 0,
  stepStartTime: 0,
  pausedAt: 0,
  animationId: null,
};

function getPlayableSteps() {
  return state.parsed.filter(ln => ln.type === "dialog" || ln.type === "narration" || ln.type === "choices");
}

function estimateStepDuration(step) {
  if (step.type === "dialog" || step.type === "narration") {
    const len = (step.text || "").length;
    return len * PLAYBACK_TYPE_SPEED + PLAYBACK_HOLD_MS;
  }
  if (step.type === "choices") {
    return (step.items?.length || 0) * PLAYBACK_CHOICE_PER + PLAYBACK_CHOICE_TAIL;
  }
  return 1000;
}

function getTotalDuration() {
  return getPlayableSteps().reduce((a, s) => a + estimateStepDuration(s), 0);
}

function setPlayPauseIcon() {
  const btn = document.getElementById("playbackPlayPause");
  if (btn) btn.textContent = playbackState.playing ? "⏸" : "▶";
}

function startPlayback() {
  if (playbackState.playing) return;
  const steps = getPlayableSteps();
  if (!steps.length) { showToast("沒有可播放的內容", "warn"); return; }
  if (playbackState.currentStep >= steps.length) playbackState.currentStep = 0;
  playbackState.playing = true;
  setPlayPauseIcon();
  playbackState.stepStartTime = performance.now() - (playbackState.pausedAt / playbackState.speed);

  function tick(now) {
    if (!playbackState.playing) return;
    const elapsed = (now - playbackState.stepStartTime) * playbackState.speed;
    const cur = steps[playbackState.currentStep];
    if (!cur) { stopPlayback(); return; }
    renderStepAtTime(cur, elapsed);
    const dur = estimateStepDuration(cur);
    if (elapsed >= dur) {
      if (playbackState.currentStep + 1 >= steps.length) {
        stopPlayback();
        return;
      }
      playbackState.currentStep++;
      playbackState.stepStartTime = performance.now();
      playbackState.pausedAt = 0;
    }
    updateProgressBar();
    playbackState.animationId = requestAnimationFrame(tick);
  }
  playbackState.animationId = requestAnimationFrame(tick);
}

function pausePlayback() {
  if (!playbackState.playing) return;
  playbackState.playing = false;
  playbackState.pausedAt = (performance.now() - playbackState.stepStartTime) * playbackState.speed;
  if (playbackState.animationId) { cancelAnimationFrame(playbackState.animationId); playbackState.animationId = null; }
  setPlayPauseIcon();
}

function stopPlayback() {
  playbackState.playing = false;
  playbackState.pausedAt = 0;
  if (playbackState.animationId) { cancelAnimationFrame(playbackState.animationId); playbackState.animationId = null; }
  setPlayPauseIcon();
}

function renderStepAtTime(step, elapsedMs) {
  // 跳到此 step 對應的 parsed index — 只在第一次或 step 切換時觸發
  const parsedIdx = state.parsed.indexOf(step);
  if (parsedIdx !== -1 && parsedIdx !== state.currentIndex) {
    // 重設舞台 + 對話框內容(會啟動 typing,但我們馬上覆寫)
    if (state.typingTimer) { clearInterval(state.typingTimer); state.typingTimer = null; }
    state.isTyping = false;
    state.currentIndex = parsedIdx;
    const activeChar = computeStageStateAt(state.parsed, parsedIdx);
    renderBackground();
    renderCharacters(activeChar);
    renderCg();
    if (step.type === "choices") {
      renderChoicesStatic(step);
      renderDialog(null);
    } else {
      renderChoicesStatic(null);
      // 不呼叫 renderDialog(會跑 typing 動畫),手動設靜態框架
      if (els.dialogBox) {
        els.dialogBox.hidden = false;
        els.dialogBox.classList.add("show");
      }
      if (els.dialogSpeaker) {
        if (step.type === "dialog") {
          els.dialogSpeaker.textContent = step.nameHidden ? (step.nameOverride || "???") : step.speaker;
          els.dialogSpeaker.style.color = "";
        } else {
          els.dialogSpeaker.textContent = "";
        }
      }
      if (els.dialogText) {
        els.dialogText.classList.toggle("narration", step.type === "narration");
        // 在打字機開始前就把樣式(字體/大小/粗/斜)套到容器,
        // 這樣每一個被打出來的字從第一刻就用對的字型
        if (step.type === "dialog" || step.type === "narration") {
          applyStyleToDialogText(step);
        }
        els.dialogText.textContent = "";
      }
    }
    updatePreviewCounter();
  }

  // 打字機進度 — 對話/旁白才打
  if (step.type === "dialog" || step.type === "narration") {
    const speed = PLAYBACK_TYPE_SPEED;
    const visible = Math.min(step.text.length, Math.floor(elapsedMs / speed));
    if (els.dialogText) {
      const partial = step.text.slice(0, visible);
      els.dialogText.textContent = partial;
    }
  }
}

function jumpToStep(stepIdx) {
  const steps = getPlayableSteps();
  if (stepIdx < 0 || stepIdx >= steps.length) return;
  playbackState.currentStep = stepIdx;
  playbackState.pausedAt = 0;
  const step = steps[stepIdx];
  const parsedIdx = state.parsed.indexOf(step);
  if (parsedIdx !== -1) renderAt(parsedIdx);
  updateProgressBar();
}

function updateProgressBar() {
  const steps = getPlayableSteps();
  const total = getTotalDuration();
  let cumElapsed = 0;
  for (let i = 0; i < playbackState.currentStep; i++) cumElapsed += estimateStepDuration(steps[i]);
  if (playbackState.playing) cumElapsed += (performance.now() - playbackState.stepStartTime) * playbackState.speed;
  else cumElapsed += playbackState.pausedAt;
  cumElapsed = Math.min(cumElapsed, total);

  const progress = document.getElementById("playbackProgress");
  const timeEl = document.getElementById("playbackTime");
  const stepEl = document.getElementById("playbackStep");
  if (progress) progress.value = total > 0 ? (cumElapsed / total) * 100 : 0;

  const fmt = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };
  if (timeEl) timeEl.textContent = `${fmt(cumElapsed)} / ${fmt(total)}`;
  if (stepEl) stepEl.textContent = `${Math.min(playbackState.currentStep + 1, steps.length)} / ${steps.length}`;
}

export {
  typewrite,
  updateProgress,
  renderLineCount,
  renderAt,
  updatePreviewCounter,
  jumpToBeat,
  isVisibleType,
  nextLine,
  prevLine,
  jumpToStart,
  reparseAndRender,
  openPreviewAll,
  buildPreviewAllStage,
  playPreviewAllAt,
  renderPreviewAllThumbs,
  updatePreviewAllPlayBtn,
  getPlayableSteps,
  estimateStepDuration,
  getTotalDuration,
  setPlayPauseIcon,
  startPlayback,
  pausePlayback,
  stopPlayback,
  renderStepAtTime,
  jumpToStep,
  updateProgressBar,
  previewAllState,
  playbackState,
};
