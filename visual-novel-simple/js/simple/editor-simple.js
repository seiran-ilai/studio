// simple/editor-simple.js — 由 index.js 搬出(階段 3-G),內容未改動
// 右側編輯區渲染、CG 操作、底部對話框樣式 popover。相依皆經全域取得;
// initSimpleEditorBindings(wire-up IIFE)保留於 index.js,經全域呼叫本檔函式。

async function _prefetchCgUrl(cgId) {
  if (_cgUrlCache.has(cgId) || _cgUrlPending.has(cgId)) return;
  _cgUrlPending.add(cgId);
  try {
    const url = await vnsCgUrlFromId(cgId);
    if (url) _cgUrlCache.set(cgId, url);
  } catch (e) {}
  _cgUrlPending.delete(cgId);
  // 載入完觸發重繪
  if (state.mode === "simple") {
    if (typeof renderSimpleSlideList === "function") renderSimpleSlideList();
    if (typeof renderSimpleEditor === "function") renderSimpleEditor();
  }
}

function _resolveSlideCgUrl(card) {
  if (!card || !card.cg) {
    if (card && typeof card.cgName === "string") {
      const d = state.cgs && state.cgs[card.cgName];
      if (d && d.dataUrl) return d.dataUrl;
    }
    return null;
  }
  const cg = card.cg;
  if (cg.type === "upload" && cg.dataUrl) return cg.dataUrl;
  if (cg.type === "library") {
    if (cg.cgId) {
      const cached = _cgUrlCache.get(cg.cgId);
      if (cached) return cached;
      _prefetchCgUrl(cg.cgId);
      return null;
    }
    if (cg.name) {
      const d = state.cgs && state.cgs[cg.name];
      if (d && d.dataUrl) return d.dataUrl;
    }
  }
  return null;
}

async function attachCgFileToCurrentSlide(file) {
  const cur = getCurrentSlide();
  if (!cur) { showToast("沒有可用的幕", "warn"); return; }
  const res = await vnsAddCgFromFile(file);
  if (!res.id) {
    showToast(res.error || "上傳失敗", "warn", 4000);
    return;
  }
  // 預存 URL 到 cache,讓 render 立即拿到
  const url = await vnsCgUrlFromId(res.id);
  if (url) _cgUrlCache.set(res.id, url);
  cur.cg = { type: "library", cgId: res.id, name: file.name };
  // 同時更新 lastUsedAt
  vnsTouchCg(res.id);
  saveToStorage();
  renderSimpleSlideList();
  renderSimpleEditor();
}

async function attachCgIdToCurrentSlide(cgId) {
  let cur = getCurrentSlide();
  // 任務 4:空狀態「選擇 CG」→ 沒有任何幕時自動建立第一幕
  if (!cur) {
    if (typeof addSimpleSlide === "function") {
      addSimpleSlide();
    } else {
      if (!Array.isArray(state.simpleCards)) state.simpleCards = [];
      const slide = createEmptySlide();
      state.simpleCards.push(slide);
      state.simpleCurrentSlideId = slide.id;
    }
    cur = getCurrentSlide();
    if (!cur) return;
    showToast("✓ 已建立第一幕", "success", 2500);
  }
  // 確保 URL 已 cache
  if (!_cgUrlCache.has(cgId)) {
    const url = await vnsCgUrlFromId(cgId);
    if (url) _cgUrlCache.set(cgId, url);
  }
  const cgRec = await vnsGetCg(cgId);
  cur.cg = { type: "library", cgId, name: (cgRec && cgRec.name) || null };
  vnsTouchCg(cgId);
  saveToStorage();
  renderSimpleSlideList();
  renderSimpleEditor();
}

// 任務 4:空狀態「選擇 CG」按鈕 — CG 庫為空時完全禁用(無法按)。
// 頁面載入、CG 庫變動、切回空狀態時都會呼叫,讓按鈕狀態跟著 CG 庫即時更新。
async function updateEmptyStateButtons() {
  const cgBtn = document.getElementById("simpleEmptyCgBtn");
  if (!cgBtn) return;
  let count = 0;
  try {
    const list = await vnsListCgs();
    count = Array.isArray(list) ? list.length : 0;
  } catch (e) {
    count = 0;
  }
  cgBtn.disabled = count === 0;
  if (count === 0) cgBtn.setAttribute("title", "CG 庫目前是空的");
  else cgBtn.removeAttribute("title");
}

// 任務 1:空狀態「上傳圖片 / 拖曳圖片」→ 自動建立第一幕並把圖片設為該幕 CG。
async function createFirstSlideWithCg(file) {
  if (typeof addSimpleSlide === "function") {
    addSimpleSlide();   // 建幕 + 設為當前 + render
  } else {
    if (!Array.isArray(state.simpleCards)) state.simpleCards = [];
    const slide = createEmptySlide();
    state.simpleCards.push(slide);
    state.simpleCurrentSlideId = slide.id;
  }
  await attachCgFileToCurrentSlide(file);   // 寫入 cg_library + 綁到當前幕 + render
  showToast("✓ 已建立第一幕", "success", 2500);
}

function clearCgFromCurrentSlide() {
  const cur = getCurrentSlide();
  if (!cur) return;
  cur.cg = { type: "none" };
  saveToStorage();
  renderSimpleSlideList();
  renderSimpleEditor();
}

// 任務 4:沒幕時禁用輸出按鈕(截圖 / GIF / MP4)
function updateExportButtonsAvailability() {
  const hasSlides = Array.isArray(state.simpleCards) && state.simpleCards.length > 0;
  ["barScreenshotBtn", "barMp4Btn"].forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.disabled = !hasSlides;
    if (hasSlides) btn.removeAttribute("title");
    else btn.setAttribute("title", "請先新增幕");
  });
}

function renderSimpleEditor() {
  updateExportButtonsAvailability();
  updateCgButtonsAvailability();
  const cur = getCurrentSlide();
  const emptyEl = document.getElementById("simplePreviewEmpty");
  const cgEl = document.getElementById("simplePreviewCg");
  const dialogEl = document.getElementById("simplePreviewDialog");
  const textArea = document.getElementById("simpleDialogText");

  // 任務 3:預覽框三/四種狀態
  //   沒有任何幕      → 空狀態提示「按 ＋ 新增第一幕」
  //   已選幕、無 CG    → 整個預覽框變成圖片上傳入口(可點/可拖曳)
  //   已選幕、有 CG    → 正常 CG + 對話框預覽
  const choicesBox = document.getElementById("simplePreviewChoices");
  if (!cur) {
    if (emptyEl) emptyEl.hidden = false;
    if (cgEl) { cgEl.hidden = true; cgEl.style.backgroundImage = ""; }
    if (dialogEl) { dialogEl.hidden = true; dialogEl.textContent = ""; }
    if (choicesBox) { choicesBox.hidden = true; choicesBox.innerHTML = ""; }
    if (textArea) textArea.value = "";
    const settings = document.getElementById("simpleSettings");
    if (settings) settings.hidden = true;
    if (typeof clearSlideEffects === "function") {
      clearSlideEffects(document.getElementById("simplePreviewStage"), dialogEl);
    }
    updateEmptyStateButtons();   // 同步「選擇 CG」按鈕禁用狀態
    return;
  }

  const cgUrl = _resolveSlideCgUrl(cur);
  // 已選幕但無 CG → 一樣顯示兩顆按鈕的空狀態(上傳/選擇 CG 直接對當前幕生效);有 CG → 隱藏
  if (emptyEl) emptyEl.hidden = !!cgUrl;
  if (!cgUrl) updateEmptyStateButtons();
  if (cgEl) {
    if (cgUrl) {
      cgEl.hidden = false;
      cgEl.style.backgroundImage = `url(${cgUrl})`;
    } else {
      cgEl.hidden = true;
      cgEl.style.backgroundImage = "";
    }
  }
  // 任務 1 + 3:特效列表 + 停留時間(對話幕與選項幕共用),並即時把特效套到預覽(含編輯模式,task 1-8)
  const settings = document.getElementById("simpleSettings");
  if (settings) settings.hidden = false;
  refreshFxUI();
  if (typeof applySlideEffects === "function") {
    applySlideEffects(document.getElementById("simplePreviewStage"), dialogEl, cur);
  }

  // 選項幕功能:依幕類型切換編輯區(對話 textarea ↔ 選項編輯)
  const isChoice = isChoiceSlide(cur);
  const dialogRow = document.getElementById("simpleDialogTextRow");
  const choiceEditor = document.getElementById("simpleChoiceEditor");
  if (dialogRow) dialogRow.hidden = isChoice;
  if (choiceEditor) choiceEditor.hidden = !isChoice;

  if (isChoice) {
    renderSimpleChoiceEditor(cur);
    // 選項幕的預覽靜態呈現
    if (!_vnsSimplePlayback.playing) renderChoicePreview(cur, cgUrl);
    return;
  }
  // 一般幕:確保選項容器隱藏
  if (choicesBox) { choicesBox.hidden = true; choicesBox.innerHTML = ""; }

  if (textArea && textArea.value !== (cur.dialogText || "")) {
    textArea.value = cur.dialogText || "";
    // 切到不同 slide 時:若 parsedLines 還沒算過(舊版資料),補算一次
    if (!Array.isArray(cur.parsedLines) || cur.parsedLines.length === 0) {
      const r = parseSimpleDialogText(cur.dialogText);
      cur.parsedLines = r.parsedLines;
      cur._unsupportedHint = r.unsupported.length > 0;
    }
  }
  const warnEl = document.getElementById("simpleSyntaxWarn");
  if (warnEl) warnEl.hidden = !cur._unsupportedHint;
  // 任務 4:靜態預覽顯示「第一段」parsed line(無文字機,即時跟著編輯走);
  // 播放時由 _vnsSimplePlayback 控制取代之。
  if (!_vnsSimplePlayback.playing) {
    const lines = (cur.parsedLines && cur.parsedLines.length) ? cur.parsedLines : [];
    // 無 CG(上傳入口狀態)時不顯示對話框預覽,讓上傳入口佔滿整個預覽框
    if (cgUrl && lines.length && dialogEl) {
      _renderPreviewLine(dialogEl, lines[0], null, false);
      // 任務 5:編輯模式也套用文字替換動畫(渲染文字之後才啟動)
      if (typeof runTextDecode === "function") runTextDecode(dialogEl, cur);
    } else if (dialogEl) {
      dialogEl.hidden = true;
      dialogEl.innerHTML = "";
    }
  }
}

// ============================================================
//  任務 2:特效 UI — 按鈕直選(啟用填色)+ 已啟用清單(調強度)
// ============================================================
const SIMPLE_DEFAULT_HOLD_SEC = 1.0;

function _fxApplyCurrent(slide) {
  if (typeof applySlideEffects === "function") {
    applySlideEffects(document.getElementById("simplePreviewStage"), document.getElementById("simplePreviewDialog"), slide);
  }
}

function _fxIsChoice(slide) {
  return (typeof isChoiceSlide === "function") ? isChoiceSlide(slide) : !!(slide && slide.type === "choice");
}

// 任務 4:有色票的特效 + 預設色
const FX_WITH_COLOR = ["blood_text", "text_decode"];
function _fxDefaultColor(id) {
  if (id === "blood_text") return "#a02828";
  if (id === "text_decode") {
    const a = getComputedStyle(document.documentElement).getPropertyValue("--gold-bright").trim();
    return a || "#e6c989";
  }
  return "#000000";
}

// 同步特效按鈕的啟用(填色)狀態;任務 5:選項幕隱藏「文字級」分類
function renderFxButtons() {
  const slide = getCurrentSlide();
  const isChoice = _fxIsChoice(slide);
  const textButtons = document.querySelector('.simple-fx-buttons[data-cat="text"]');
  if (textButtons) {
    const sec = textButtons.closest(".simple-fx-cat");
    if (sec) sec.hidden = isChoice;
  }
  const activeIds = (slide && Array.isArray(slide.effects)) ? slide.effects.map(e => e.id) : [];
  document.querySelectorAll(".fx-toggle-btn").forEach(btn => {
    btn.classList.toggle("active", activeIds.includes(btn.dataset.fxId));
  });
}

// 渲染已啟用清單(每個含強度 slider + 可選色票 + 移除)
function renderFxActiveList() {
  const slide = getCurrentSlide();
  const list = document.getElementById("simpleFxActiveList");
  if (!list) return;
  list.innerHTML = "";
  const all = (slide && Array.isArray(slide.effects)) ? slide.effects : [];
  // 任務 5:選項幕只顯示畫面級特效(文字級資料保留,只是不列)
  const isChoice = _fxIsChoice(slide);
  const effects = isChoice
    ? all.filter(e => (typeof EFFECT_BY_ID !== "undefined") && EFFECT_BY_ID[e.id] && EFFECT_BY_ID[e.id].cat !== "text")
    : all;
  if (!effects.length) {
    const empty = document.createElement("div");
    empty.className = "fx-active-empty";
    empty.textContent = "尚未啟用特效";
    list.appendChild(empty);
    return;
  }
  effects.forEach((eff) => {
    const def = (typeof EFFECT_BY_ID !== "undefined") ? EFFECT_BY_ID[eff.id] : null;
    if (!def) return;
    const item = document.createElement("div");
    item.className = "fx-active-item";

    const name = document.createElement("span");
    name.className = "fx-active-name";
    name.textContent = def.name;

    const range = document.createElement("input");
    range.type = "range";
    range.className = "fx-active-range";
    range.min = "0"; range.max = "100"; range.step = "1";
    range.value = String(eff.intensity != null ? eff.intensity : 50);

    const val = document.createElement("span");
    val.className = "fx-active-value";
    val.textContent = range.value;

    range.addEventListener("input", () => {
      val.textContent = range.value;
      _setFxIntensity(eff.id, parseInt(range.value, 10));
    });

    item.appendChild(name);
    item.appendChild(range);
    item.appendChild(val);

    // 任務 4:色票(僅 blood_text / text_decode)
    if (FX_WITH_COLOR.includes(eff.id)) {
      const color = document.createElement("input");
      color.type = "color";
      color.className = "fx-active-color";
      color.value = eff.color || _fxDefaultColor(eff.id);
      color.setAttribute("aria-label", "特效顏色");
      color.addEventListener("input", () => _setFxColor(eff.id, color.value));
      item.appendChild(color);
    }

    const del = document.createElement("button");
    del.type = "button";
    del.className = "fx-active-remove";
    del.title = "移除特效";
    del.setAttribute("aria-label", "移除");
    del.textContent = "✕";
    del.addEventListener("click", () => _removeFx(eff.id));
    item.appendChild(del);

    list.appendChild(item);
  });
}

function _setFxColor(id, color) {
  const slide = getCurrentSlide();
  if (!slide || !Array.isArray(slide.effects)) return;
  const e = slide.effects.find(x => x.id === id);
  if (!e) return;
  e.color = color;
  saveToStorage();
  _fxApplyCurrent(slide);
}

function _toggleFx(id) {
  const slide = getCurrentSlide();
  if (!slide) return;
  if (!Array.isArray(slide.effects)) slide.effects = [];
  const i = slide.effects.findIndex(e => e.id === id);
  if (i >= 0) slide.effects.splice(i, 1);       // 取消
  else slide.effects.push({ id, intensity: 50 }); // 啟用
  saveToStorage();
  renderFxButtons();
  renderFxActiveList();
  _fxApplyCurrent(slide);
}

function _setFxIntensity(id, intensity) {
  const slide = getCurrentSlide();
  if (!slide || !Array.isArray(slide.effects)) return;
  const e = slide.effects.find(x => x.id === id);
  if (!e) return;
  e.intensity = Math.max(0, Math.min(100, intensity || 0));
  saveToStorage();
  _fxApplyCurrent(slide);   // 即時套用,不整段 re-render(避免 slider 失焦)
}

function _removeFx(id) {
  const slide = getCurrentSlide();
  if (!slide || !Array.isArray(slide.effects)) return;
  slide.effects = slide.effects.filter(x => x.id !== id);
  saveToStorage();
  renderFxButtons();
  renderFxActiveList();
  _fxApplyCurrent(slide);
}

// ============================================================
//  任務 3:停留時間(數字輸入 + 預設)
// ============================================================
function syncHoldInput() {
  const input = document.getElementById("simpleHoldInput");
  const slide = getCurrentSlide();
  if (!input || !slide) return;
  const v = (typeof slide.holdDuration === "number") ? slide.holdDuration : SIMPLE_DEFAULT_HOLD_SEC;
  input.value = v.toFixed(1);
}

// ============================================================
//  任務 4:結束轉場(單選按鈕)
// ============================================================
function syncTransitionButtons() {
  const container = document.getElementById("simpleTransitionButtons");
  const slide = getCurrentSlide();
  if (!container || !slide) return;
  const t = slide.transition || "none";
  container.querySelectorAll(".transition-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.transition === t);
  });
}

// 切幕 / 載入時整批同步特效面板
function refreshFxUI() {
  renderFxButtons();
  renderFxActiveList();
  syncHoldInput();
  syncTransitionButtons();
}

// ============================================================
//  任務 4-3:CG 按鈕可用性(無 CG 時「移除 CG」disabled,「換 CG」永遠可用)
// ============================================================
function updateCgButtonsAvailability() {
  const cur = getCurrentSlide();
  const hasCg = !!(cur && cur.cg && cur.cg.type && cur.cg.type !== "none");
  const removeBtn = document.getElementById("simpleCgClearBtn");
  if (removeBtn) {
    removeBtn.disabled = !hasCg;
    if (hasCg) removeBtn.removeAttribute("title");
    else removeBtn.setAttribute("title", "目前沒有 CG");
  }
  const changeBtn = document.getElementById("simpleCgReplaceBtn");
  if (changeBtn) changeBtn.disabled = false;
}

// ============================================================
//  版面:四欄可拖曳分隔條 + 特效面板收起/展開 + 欄寬記憶(localStorage)
// ============================================================
const VNS_LAYOUT_KEYS = {
  slides: "vns_pane_slides_width",
  dialog: "vns_pane_dialog_width",
  effects: "vns_pane_effects_width",
  collapsed: "vns_effects_collapsed",
  slidesCollapsed: "vns_slides_collapsed",
};
function _layoutEl() { return document.getElementById("simpleLayout"); }

function saveLayoutWidths() {
  const layout = _layoutEl();
  if (!layout) return;
  const s = getComputedStyle(layout);
  const px = (v) => parseInt(s.getPropertyValue(v), 10) || 0;
  try {
    localStorage.setItem(VNS_LAYOUT_KEYS.slides, String(px("--pane-slides-width") || 200));
    localStorage.setItem(VNS_LAYOUT_KEYS.dialog, String(px("--pane-dialog-width") || 320));
    // 收起時不要把特效寬覆寫成 0,保留上次展開寬度
    if (layout.getAttribute("data-effects-collapsed") !== "true") {
      localStorage.setItem(VNS_LAYOUT_KEYS.effects, String(px("--pane-effects-width") || 270));
    }
    localStorage.setItem(VNS_LAYOUT_KEYS.collapsed, layout.getAttribute("data-effects-collapsed") === "true" ? "1" : "0");
    localStorage.setItem(VNS_LAYOUT_KEYS.slidesCollapsed, layout.getAttribute("data-slides-collapsed") === "true" ? "1" : "0");
  } catch (e) {}
}

function loadLayoutWidths() {
  const layout = _layoutEl();
  if (!layout) return;
  let slides, dialog, effects, collapsed;
  try {
    slides = localStorage.getItem(VNS_LAYOUT_KEYS.slides);
    dialog = localStorage.getItem(VNS_LAYOUT_KEYS.dialog);
    effects = localStorage.getItem(VNS_LAYOUT_KEYS.effects);
    collapsed = localStorage.getItem(VNS_LAYOUT_KEYS.collapsed) === "1";
  } catch (e) {}
  if (slides && +slides > 20) layout.style.setProperty("--pane-slides-width", slides + "px");
  if (dialog && +dialog > 20) layout.style.setProperty("--pane-dialog-width", dialog + "px");
  if (effects && +effects > 20) layout.style.setProperty("--pane-effects-width", effects + "px");
  if (collapsed) collapseEffectsPane(true);
  let slidesCollapsed;
  try { slidesCollapsed = localStorage.getItem(VNS_LAYOUT_KEYS.slidesCollapsed) === "1"; } catch (e) {}
  if (slidesCollapsed) collapseSlidesPane(true);
}

function collapseEffectsPane(skipSave) {
  const layout = _layoutEl();
  if (!layout) return;
  layout.setAttribute("data-effects-collapsed", "true");
  const bar = document.getElementById("effectsCollapsedBar");
  if (bar) bar.hidden = false;
  if (!skipSave) saveLayoutWidths();
}

function expandEffectsPane() {
  const layout = _layoutEl();
  if (!layout) return;
  layout.removeAttribute("data-effects-collapsed");
  const bar = document.getElementById("effectsCollapsedBar");
  if (bar) bar.hidden = true;
  let saved;
  try { saved = localStorage.getItem(VNS_LAYOUT_KEYS.effects); } catch (e) {}
  layout.style.setProperty("--pane-effects-width", (saved && +saved > 20) ? saved + "px" : "270px");
  saveLayoutWidths();
}

function collapseSlidesPane(skipSave) {
  const layout = _layoutEl();
  if (!layout) return;
  layout.setAttribute("data-slides-collapsed", "true");
  const bar = document.getElementById("slidesCollapsedBar");
  if (bar) bar.hidden = false;
  if (!skipSave) saveLayoutWidths();
}

function expandSlidesPane() {
  const layout = _layoutEl();
  if (!layout) return;
  layout.removeAttribute("data-slides-collapsed");
  const bar = document.getElementById("slidesCollapsedBar");
  if (bar) bar.hidden = true;
  let saved;
  try { saved = localStorage.getItem(VNS_LAYOUT_KEYS.slides); } catch (e) {}
  layout.style.setProperty("--pane-slides-width", (saved && +saved > 20) ? saved + "px" : "200px");
  saveLayoutWidths();
}

function initSplitters() {
  const layout = _layoutEl();
  if (!layout) return;
  layout.querySelectorAll(".simple-splitter").forEach(sp => {
    sp.addEventListener("mousedown", (e) => _startSplitterDrag(e, sp));
  });
}

function _startSplitterDrag(e, splitter) {
  const layout = _layoutEl();
  if (!layout) return;
  e.preventDefault();
  const idx = parseInt(splitter.dataset.splitter, 10);
  splitter.classList.add("dragging");
  document.body.classList.add("simple-resizing");
  const startX = e.clientX;
  const s = getComputedStyle(layout);
  const startSlides = parseInt(s.getPropertyValue("--pane-slides-width"), 10) || 200;
  const startDialog = parseInt(s.getPropertyValue("--pane-dialog-width"), 10) || 320;
  const startEffects = parseInt(s.getPropertyValue("--pane-effects-width"), 10) || 270;

  function endDrag() {
    splitter.classList.remove("dragging");
    document.body.classList.remove("simple-resizing");
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
  }
  function onMove(ev) {
    const dx = ev.clientX - startX;
    if (idx === 1) {
      const w = Math.max(0, startSlides + dx);
      layout.style.setProperty("--pane-slides-width", w + "px");
      if (w < 20) { endDrag(); collapseSlidesPane(); }   // 拖到很窄 → 自動收起
    } else if (idx === 2) {
      layout.style.setProperty("--pane-dialog-width", Math.max(0, startDialog + dx) + "px");
    } else if (idx === 3) {
      const w = Math.max(0, startEffects - dx);
      layout.style.setProperty("--pane-effects-width", w + "px");
      if (w < 20) { endDrag(); collapseEffectsPane(); }   // 拖到很窄 → 自動收起
    }
  }
  function onUp() { endDrag(); saveLayoutWidths(); }
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
}

function initLayoutControls() {
  initSplitters();
  loadLayoutWidths();
  const collapseBtn = document.getElementById("effectsCollapseBtn");
  if (collapseBtn) collapseBtn.addEventListener("click", () => collapseEffectsPane());
  const bar = document.getElementById("effectsCollapsedBar");
  if (bar) bar.addEventListener("click", expandEffectsPane);
  const slidesBtn = document.getElementById("slidesCollapseBtn");
  if (slidesBtn) slidesBtn.addEventListener("click", () => collapseSlidesPane());
  const slidesBar = document.getElementById("slidesCollapsedBar");
  if (slidesBar) slidesBar.addEventListener("click", expandSlidesPane);
}

// 簡易版編輯區事件綁定(由 index.js 的 IIFE 改為 init 函式,掛載後由 index.js 呼叫)
function initSimpleEditorBindings() {
  // 新增幕下拉(方案 B):一般幕 / 選項幕
  const addBtn = document.getElementById("simpleAddSlideBtn");
  const addMenu = document.getElementById("simpleAddSlideMenu");
  function closeAddMenu() {
    if (addMenu) addMenu.hidden = true;
    if (addBtn) addBtn.setAttribute("aria-expanded", "false");
  }
  function toggleAddMenu() {
    if (!addMenu) return;
    const willOpen = addMenu.hidden;
    addMenu.hidden = !willOpen;
    if (addBtn) addBtn.setAttribute("aria-expanded", willOpen ? "true" : "false");
  }
  if (addBtn) addBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleAddMenu(); });
  if (addMenu) {
    addMenu.addEventListener("click", (e) => {
      const item = e.target.closest("[data-add-type]");
      if (!item) return;
      e.stopPropagation();
      closeAddMenu();
      if (item.dataset.addType === "choice") addChoiceSlide();
      else addSimpleSlide();
    });
  }
  document.addEventListener("click", closeAddMenu);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAddMenu(); });

  // 選項幕:新增選項
  const choiceAddBtn = document.getElementById("simpleChoiceAddBtn");
  if (choiceAddBtn) choiceAddBtn.addEventListener("click", () => {
    const cur = getCurrentSlide();
    if (isChoiceSlide(cur)) addChoice(cur);
  });

  // 任務 10:選項輸入框快捷鍵(委派,輸入框會隨 re-render 重建)
  //   Tab / Shift+Tab → 跳到下一個 / 上一個選項輸入框
  //   Enter            → 新增下一個選項並 focus
  //   Ctrl/⌘ + Enter   → 將當前選項標為正解
  const choiceListEl = document.getElementById("simpleChoiceList");
  if (choiceListEl) choiceListEl.addEventListener("keydown", (e) => {
    const input = e.target.closest && e.target.closest(".simple-choice-input");
    if (!input) return;
    const cur = getCurrentSlide();
    if (!isChoiceSlide(cur)) return;
    const choiceId = input.dataset.choiceInput;

    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setChoiceCorrectExclusive(cur, choiceId);
      const again = choiceListEl.querySelector(`[data-choice-input="${choiceId}"]`);
      if (again) again.focus();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      addChoice(cur);   // 內部會 focus 新選項輸入框
      return;
    }
    if (e.key === "Tab") {
      const inputs = Array.from(choiceListEl.querySelectorAll(".simple-choice-input"));
      const idx = inputs.indexOf(input);
      const nextIdx = e.shiftKey ? idx - 1 : idx + 1;
      if (nextIdx >= 0 && nextIdx < inputs.length) {
        e.preventDefault();
        inputs[nextIdx].focus();
      }
      // 邊界:讓原生 Tab 移到下一個控制項
    }
  });

  const textArea = document.getElementById("simpleDialogText");
  if (textArea) textArea.addEventListener("input", () => {
    const cur = getCurrentSlide();
    if (!cur) return;
    cur.dialogText = textArea.value;
    // 即時解析 parsedLines + 偵測不支援指令
    const r = parseSimpleDialogText(cur.dialogText);
    cur.parsedLines = r.parsedLines;
    cur._unsupportedHint = r.unsupported.length > 0;
    saveToStorage();
    renderSimpleSlideList();
    renderSimpleEditor();
  });

  // 方向切換
  document.querySelectorAll(".simple-ratio-toggle button").forEach(b => {
    b.addEventListener("click", () => {
      const r = b.dataset.ratio;
      document.querySelectorAll(".simple-ratio-toggle button").forEach(bb => {
        bb.classList.toggle("active", bb === b);
      });
      const stage = document.getElementById("simplePreviewStage");
      if (stage) stage.setAttribute("data-ratio", r);
      state.ratio = r;
      saveToStorage();
    });
  });

  // 輸出畫質切換(倍率,只影響截圖 / 錄影輸出解析度,不動預覽)
  document.querySelectorAll("#simpleQualityToggle button").forEach(b => {
    b.addEventListener("click", () => {
      document.querySelectorAll("#simpleQualityToggle button").forEach(bb => {
        bb.classList.toggle("active", bb === b);
      });
      state.outQuality = Number(b.dataset.q);
      saveToStorage();
    });
  });

  // 任務 4:CG 操作(換 / 移除 / 檔案選擇)。上傳入口已合併進預覽框(見下方任務 3 區塊)
  const cgInput = document.getElementById("simpleCgFileInput");
  const cgReplaceBtn = document.getElementById("simpleCgReplaceBtn");
  const cgClearBtn = document.getElementById("simpleCgClearBtn");

  function triggerCgInput() { if (cgInput) cgInput.click(); }
  if (cgReplaceBtn) cgReplaceBtn.addEventListener("click", triggerCgInput);
  if (cgClearBtn) cgClearBtn.addEventListener("click", clearCgFromCurrentSlide);
  if (cgInput) cgInput.addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      // 沒有任何幕時 → 自動建立第一幕;否則綁到當前幕
      if (getCurrentSlide()) await attachCgFileToCurrentSlide(file);
      else await createFirstSlideWithCg(file);
    }
    e.target.value = "";
  });

  // 任務 4:空狀態歡迎卡兩顆按鈕(極簡,無教學文字)— 上傳圖片 / 選擇 CG
  const emptyUploadBtn = document.getElementById("simpleEmptyUploadBtn");
  if (emptyUploadBtn) emptyUploadBtn.addEventListener("click", () => {
    if (cgInput) cgInput.click();
  });
  const emptyCgBtn = document.getElementById("simpleEmptyCgBtn");
  if (emptyCgBtn) emptyCgBtn.addEventListener("click", () => {
    if (emptyCgBtn.disabled) return;   // CG 庫為空時禁用
    openCgLibraryModal();
  });
  updateEmptyStateButtons();

  // 任務 1:預覽框拖曳上傳(無提示文字,空狀態只有兩顆按鈕)。
  // 已選幕但無 CG 時,空狀態兩顆按鈕(上傳/選擇 CG)直接對當前幕生效;整個預覽框仍可拖曳。
  const previewStage = document.getElementById("simplePreviewStage");
  if (previewStage) {
    previewStage.addEventListener("dragover", (e) => {
      if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes("Files")) {
        e.preventDefault();
        previewStage.classList.add("dragover");
      }
    });
    previewStage.addEventListener("dragleave", () => previewStage.classList.remove("dragover"));
    previewStage.addEventListener("drop", async (e) => {
      previewStage.classList.remove("dragover");
      const files = e.dataTransfer && e.dataTransfer.files;
      if (!files || !files.length) return;
      const f = files[0];
      if (f.type && f.type.startsWith("image/")) {
        e.preventDefault();
        e.stopPropagation();
        // 沒有任何幕時 → 自動建立第一幕;否則綁到當前幕(.vns 已由頁面層 capture handler 先攔截)
        if (getCurrentSlide()) await attachCgFileToCurrentSlide(f);
        else await createFirstSlideWithCg(f);
      }
    });
  }

  // 任務 2:預覽框下方播放控制(單幕 / 從這幕開始 / 停止)
  const playOne = document.getElementById("simplePlayOneBtn");
  if (playOne) playOne.addEventListener("click", () => toggleSimplePlayback("single"));
  const playAll = document.getElementById("simplePlayAllBtn");
  if (playAll) playAll.addEventListener("click", () => toggleSimplePlayback("continuous"));
  const stopBtn = document.getElementById("simpleStopBtn");
  if (stopBtn) stopBtn.addEventListener("click", () => stopSimplePlayback());

  // 任務 2:特效按鈕直選(toggle 啟用/取消)
  document.querySelectorAll(".fx-toggle-btn").forEach(btn => {
    btn.addEventListener("click", () => _toggleFx(btn.dataset.fxId));
  });

  // 任務 3:停留時間數字輸入 + 預設按鈕
  const holdInput = document.getElementById("simpleHoldInput");
  if (holdInput) holdInput.addEventListener("change", () => {
    const cur = getCurrentSlide();
    let v = parseFloat(holdInput.value);
    if (isNaN(v) || v < 0) v = 0;
    if (v > 10) v = 10;
    v = Math.round(v * 10) / 10;
    holdInput.value = v.toFixed(1);
    if (cur) { cur.holdDuration = v; saveToStorage(); }
  });
  const holdResetBtn = document.getElementById("simpleHoldResetBtn");
  if (holdResetBtn) holdResetBtn.addEventListener("click", () => {
    if (holdInput) holdInput.value = SIMPLE_DEFAULT_HOLD_SEC.toFixed(1);
    const cur = getCurrentSlide();
    if (cur) { cur.holdDuration = SIMPLE_DEFAULT_HOLD_SEC; saveToStorage(); }
  });

  // 任務 4:結束轉場單選
  const transContainer = document.getElementById("simpleTransitionButtons");
  if (transContainer) transContainer.querySelectorAll(".transition-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const cur = getCurrentSlide();
      if (!cur) return;
      cur.transition = btn.dataset.transition || "none";
      transContainer.querySelectorAll(".transition-btn").forEach(b => b.classList.toggle("active", b === btn));
      saveToStorage();
    });
  });

  // 底部工具列輸出按鈕
  const barSs = document.getElementById("barScreenshotBtn");
  if (barSs) barSs.addEventListener("click", exportSimpleScreenshot);
  const barMp4 = document.getElementById("barMp4Btn");
  if (barMp4) barMp4.addEventListener("click", exportSimpleMp4);

  // 輸出設定浮層(片頭緩衝,由原系統設定搬至此)
  const outBtn = document.getElementById("barOutputSettingsBtn");
  const outPop = document.getElementById("outputSettingsPopover");
  if (outBtn && outPop) {
    outBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const willShow = outPop.hidden;
      outPop.hidden = !willShow;
      // 每次開啟時同步當前狀態到控制項(只綁一次事件)
      if (willShow && typeof setupIntroBufferSettings === "function") setupIntroBufferSettings();
    });
    outPop.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", () => { outPop.hidden = true; });
  }

  // 版面:四欄拖曳分隔條 + 特效面板收起/展開 + 載入記憶欄寬
  initLayoutControls();

  // 預覽框大小變化時,動態更新預覽字體縮放比例
  (function initPreviewFontScale() {
    const stage = document.getElementById("simplePreviewStage");
    if (!stage || typeof ResizeObserver === "undefined") return;

    function applyPreviewFontScale() {
      const h = stage.clientHeight;
      if (!h) return;
      // 字級隨預覽框高度縮放,並與 canvas 輸出保持一致比例。
      // canvas 輸出用固定設計基準 refH = outputH × 352/1080(landscape 352 / portrait 626),
      // 預覽端用同一個 refH:scale = clientHeight / refH(設計大小時 = 1,拖大面板字變大)。
      const outputH = (state.ratio === "9:16") ? 1920 : 1080;
      const refH = outputH * 352 / 1080;   // landscape ≈ 352,portrait ≈ 626
      const scale = h / refH;
      const fs = state.fontSizes || { dialog: 18, speaker: 16, narration: 16, inner: 15 };
      const root = document.documentElement;
      root.style.setProperty("--preview-dialog-font-size",    Math.max(6, Math.round(fs.dialog    * scale)) + "px");
      root.style.setProperty("--preview-speaker-font-size",   Math.max(6, Math.round(fs.speaker   * scale)) + "px");
      root.style.setProperty("--preview-narration-font-size", Math.max(6, Math.round(fs.narration * scale)) + "px");
      root.style.setProperty("--preview-inner-font-size",     Math.max(6, Math.round(fs.inner     * scale)) + "px");
    }

    const ro = new ResizeObserver(applyPreviewFontScale);
    ro.observe(stage);
    // applyFontSizes 調滑桿後會 dispatch 合成 "resize" 事件(ResizeObserver 不會接合成事件,需另掛)
    stage.addEventListener("resize", applyPreviewFontScale);
    applyPreviewFontScale(); // 初始執行一次
  })();
}

export {
  _prefetchCgUrl,
  _resolveSlideCgUrl,
  attachCgFileToCurrentSlide,
  attachCgIdToCurrentSlide,
  clearCgFromCurrentSlide,
  createFirstSlideWithCg,
  updateEmptyStateButtons,
  renderSimpleEditor,
  initSimpleEditorBindings,
};
