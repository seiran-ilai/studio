// shared/game-ui.js — 由 index.js 搬出,內容未改動。好感度/章節等遊戲 UI 與動畫。
// __lastLoveDisplayed / __loveAnimRaf 為模組內部動畫狀態(不匯出)。

function triggerLoveExtremeEffect(type, charName) {
  const styleId = state.style && state.style.preset;
  const set = LOVE_EXTREME_EFFECTS[styleId];
  if (!set) return;
  const effect = set[type];
  if (!effect) return;
  const stage = document.getElementById("stage");
  if (!stage) return;
  // 同類特效若已存在,先清掉避免重疊
  stage.querySelectorAll(".love-extreme-effect").forEach(n => n.remove());

  const overlay = document.createElement("div");
  overlay.className = `love-extreme-effect effect-${effect.type}`;
  if (effect.overlayText) {
    const span = document.createElement("span");
    span.style.color = effect.textColor || "#ffffff";
    span.textContent = effect.overlayText;
    overlay.appendChild(span);
  }
  stage.appendChild(overlay);
  // petalsFall:動態產生花瓣
  if (effect.type === "petalsFall") {
    const cnt = effect.count || 30;
    for (let i = 0; i < cnt; i++) {
      const p = document.createElement("span");
      p.className = "petal";
      p.style.background = effect.color || "#f0a8c0";
      p.style.left = `${Math.random() * 100}%`;
      p.style.animationDelay = `${Math.random() * 1.5}s`;
      p.style.animationDuration = `${2 + Math.random() * 2}s`;
      overlay.appendChild(p);
    }
  }
  setTimeout(() => overlay.remove(), effect.duration || 2800);
}

function applyGameUI() {
  const u = state.gameUI || DEFAULT_GAME_UI;
  const chap = document.getElementById("uiChapter");
  if (chap) {
    chap.hidden = !u.chapter.enabled || !u.chapter.text;
    chap.textContent = u.chapter.text || "";
  }
  const love = document.getElementById("uiLove");
  const ch = state.characters.find(c => c.id === u.love.charId);
  if (love) {
    love.hidden = !u.love.enabled || !ch;
    if (ch) {
      const targetValue = state.loveValues[ch.name] != null
        ? state.loveValues[ch.name]
        : (state.loveInitial[ch.name] != null ? state.loveInitial[ch.name] : u.love.value);
      const nm = document.getElementById("uiLoveName");
      const fill = document.getElementById("uiLoveFill");
      const num = document.getElementById("uiLoveNum");
      if (nm) nm.textContent = ch.name;
      // 平滑動畫:從上次顯示值到 targetValue
      const fromValue = (typeof __lastLoveDisplayed === "number") ? __lastLoveDisplayed : targetValue;
      animateLoveValue(ch.name, fromValue, targetValue, 800, fill, num);
    }
  }
  const as = document.getElementById("uiAutoSkip");
  if (as) as.hidden = !u.autoSkip.enabled;
}

let __lastLoveDisplayed = null;

let __loveAnimRaf = null;

function animateLoveValue(charName, fromValue, toValue, durationMs, fillEl, numEl) {
  if (__loveAnimRaf) cancelAnimationFrame(__loveAnimRaf);
  if (fromValue === toValue) {
    if (fillEl) fillEl.style.width = toValue + "%";
    if (numEl) numEl.textContent = toValue;
    __lastLoveDisplayed = toValue;
    return;
  }
  const start = performance.now();
  function tick(now) {
    const t = Math.min(1, (now - start) / durationMs);
    const eased = 1 - Math.pow(1 - t, 3);
    const cur = Math.round(fromValue + (toValue - fromValue) * eased);
    if (fillEl) fillEl.style.width = cur + "%";
    if (numEl) numEl.textContent = cur;
    __lastLoveDisplayed = cur;
    if (t < 1) {
      __loveAnimRaf = requestAnimationFrame(tick);
    } else {
      __loveAnimRaf = null;
      // 達到極值 → 觸發特效
      if (toValue === 100) triggerLoveExtremeEffect("full", charName);
      else if (toValue === 0) triggerLoveExtremeEffect("empty", charName);
    }
  }
  __loveAnimRaf = requestAnimationFrame(tick);
}

function bindGameUISettings() {
  const u = state.gameUI;
  if (!u) return;

  const chapToggle = document.getElementById("uiChapterToggle");
  const chapText = document.getElementById("uiChapterText");
  if (chapToggle && chapText) {
    chapToggle.checked = u.chapter.enabled;
    chapText.value = u.chapter.text;
    chapToggle.onchange = () => { u.chapter.enabled = chapToggle.checked; applyGameUI(); saveToStorage(); };
    chapText.oninput = () => { u.chapter.text = chapText.value; applyGameUI(); saveToStorage(); };
  }

  const loveToggle = document.getElementById("uiLoveToggle");
  const loveSelect = document.getElementById("uiLoveCharSelect");
  const loveSlider = document.getElementById("uiLoveValue");
  const loveLabel = document.getElementById("uiLoveValueLabel");
  if (loveToggle && loveSelect && loveSlider && loveLabel) {
    loveSelect.innerHTML = state.characters.map(c =>
      `<option value="${c.id}" ${c.id === u.love.charId ? "selected" : ""}>${_shEsc(c.name)}</option>`
    ).join("");
    if (!u.love.charId && state.characters[0]) u.love.charId = state.characters[0].id;
    loveToggle.checked = u.love.enabled;
    loveSlider.value = u.love.value;
    loveLabel.textContent = u.love.value;
    loveToggle.onchange = () => { u.love.enabled = loveToggle.checked; applyGameUI(); saveToStorage(); };
    loveSelect.onchange = () => { u.love.charId = loveSelect.value; applyGameUI(); saveToStorage(); };
    loveSlider.oninput = () => {
      u.love.value = parseInt(loveSlider.value, 10);
      loveLabel.textContent = u.love.value;
      applyGameUI();
      saveToStorage();
    };
  }

  const asToggle = document.getElementById("uiAutoSkipToggle");
  if (asToggle) {
    asToggle.checked = u.autoSkip.enabled;
    asToggle.onchange = () => { u.autoSkip.enabled = asToggle.checked; applyGameUI(); saveToStorage(); };
  }
}

export {
  triggerLoveExtremeEffect,
  applyGameUI,
  animateLoveValue,
  bindGameUISettings,
};
