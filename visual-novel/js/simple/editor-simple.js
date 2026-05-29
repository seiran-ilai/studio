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
  const cur = getCurrentSlide();
  if (!cur) return;
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

function clearCgFromCurrentSlide() {
  const cur = getCurrentSlide();
  if (!cur) return;
  cur.cg = { type: "none" };
  saveToStorage();
  renderSimpleSlideList();
  renderSimpleEditor();
}

function renderSimpleEditor() {
  // 樣式快選同步 + 即時套用該 slide 的 dialogStyle
  if (typeof syncDialogStyleForCurrentSlide === "function") syncDialogStyleForCurrentSlide();
  const cur = getCurrentSlide();
  const emptyEl = document.getElementById("simplePreviewEmpty");
  const uploadEl = document.getElementById("simplePreviewUpload");
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
    if (uploadEl) uploadEl.hidden = true;
    if (cgEl) { cgEl.hidden = true; cgEl.style.backgroundImage = ""; }
    if (dialogEl) { dialogEl.hidden = true; dialogEl.textContent = ""; }
    if (choicesBox) { choicesBox.hidden = true; choicesBox.innerHTML = ""; }
    if (textArea) textArea.value = "";
    return;
  }

  if (emptyEl) emptyEl.hidden = true;
  const cgUrl = _resolveSlideCgUrl(cur);
  if (uploadEl) uploadEl.hidden = !!cgUrl;
  if (cgEl) {
    if (cgUrl) {
      cgEl.hidden = false;
      cgEl.style.backgroundImage = `url(${cgUrl})`;
    } else {
      cgEl.hidden = true;
      cgEl.style.backgroundImage = "";
    }
  }
  // 任務 4:CG 操作列(方向 + 換 / 移除)僅在有 CG 時顯示
  const cgOps = document.getElementById("simpleCgOps");
  if (cgOps) cgOps.hidden = !cgUrl;

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
    } else if (dialogEl) {
      dialogEl.hidden = true;
      dialogEl.innerHTML = "";
    }
  }
}

function syncDialogStyleForCurrentSlide() {
  updateSimpleStyleTriggerLabel();
}

function updateSimpleStyleTriggerLabel() {
  const label = document.getElementById("simpleStyleTriggerLabel");
  if (!label || !state.style || typeof STYLE_PRESETS === "undefined") return;
  const fam = STYLE_PRESETS[state.style.preset];
  if (!fam) { label.textContent = "—"; return; }
  if (state.style.variant === "custom") {
    label.textContent = fam.name + " · 自訂";
  } else {
    const v = fam.variants[state.style.variant];
    label.textContent = v ? (fam.name + " · " + v.name) : fam.name;
  }
}

function renderSimpleStylePopover() {
  const list = document.getElementById("simpleStylePopoverList");
  if (!list || typeof STYLE_PRESETS === "undefined") return;
  list.innerHTML = "";
  const activePreset = state.style && state.style.preset;
  const activeVariant = state.style && state.style.variant;
  for (const [familyId, family] of Object.entries(STYLE_PRESETS)) {
    const fam = document.createElement("div");
    fam.className = "simple-style-fam";
    const name = document.createElement("div");
    name.className = "simple-style-fam-name";
    name.textContent = "對話框配色";
    fam.appendChild(name);
    const chips = document.createElement("div");
    chips.className = "simple-style-chips";
    for (const [variantId, variant] of Object.entries(family.variants)) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "simple-style-chip" +
        (familyId === activePreset && variantId === activeVariant ? " active" : "");
      chip.textContent = variant.name;
      chip.addEventListener("click", () => applySimpleStyle(familyId, variantId));
      chips.appendChild(chip);
    }
    // 該風格的自訂變體
    const customChip = document.createElement("button");
    customChip.type = "button";
    customChip.className = "simple-style-chip simple-style-chip--custom" +
      (familyId === activePreset && activeVariant === "custom" ? " active" : "");
    customChip.textContent = "自訂";
    customChip.addEventListener("click", () => applySimpleStyle(familyId, "custom"));
    chips.appendChild(customChip);
    fam.appendChild(chips);
    list.appendChild(fam);
  }
}

function applySimpleStyle(familyId, variantId) {
  if (typeof applyStylePreset === "function") applyStylePreset(familyId, variantId);
  if (state.style) state.style.firstStyleSelected = true;
  saveToStorage();
  updateSimpleStyleTriggerLabel();
  closeSimpleStylePopover();
  renderSimpleEditor();
}

function openSimpleStylePopover() {
  const pop = document.getElementById("simpleStylePopover");
  const trigger = document.getElementById("simpleStyleTriggerBtn");
  if (!pop) return;
  renderSimpleStylePopover();
  pop.hidden = false;
  if (trigger) trigger.setAttribute("aria-expanded", "true");
}

function closeSimpleStylePopover() {
  const pop = document.getElementById("simpleStylePopover");
  const trigger = document.getElementById("simpleStyleTriggerBtn");
  if (pop) pop.hidden = true;
  if (trigger) trigger.setAttribute("aria-expanded", "false");
}

function toggleSimpleStylePopover() {
  const pop = document.getElementById("simpleStylePopover");
  if (!pop) return;
  if (pop.hidden) openSimpleStylePopover();
  else closeSimpleStylePopover();
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

  // 任務 4:CG 操作(換 / 移除 / 檔案選擇)。上傳入口已合併進預覽框(見下方任務 3 區塊)
  const cgInput = document.getElementById("simpleCgFileInput");
  const cgReplaceBtn = document.getElementById("simpleCgReplaceBtn");
  const cgClearBtn = document.getElementById("simpleCgClearBtn");

  function triggerCgInput() { if (cgInput) cgInput.click(); }
  if (cgReplaceBtn) cgReplaceBtn.addEventListener("click", triggerCgInput);
  if (cgClearBtn) cgClearBtn.addEventListener("click", clearCgFromCurrentSlide);
  if (cgInput) cgInput.addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) await attachCgFileToCurrentSlide(file);
    e.target.value = "";
  });

  // 任務 3:預覽框 = 上傳區。已選幕但無 CG 時整個預覽框可點/可拖曳上傳。
  const previewStage = document.getElementById("simplePreviewStage");
  const previewUpload = document.getElementById("simplePreviewUpload");
  const previewLibBtn = document.getElementById("simplePreviewLibraryBtn");
  if (previewUpload) previewUpload.addEventListener("click", (e) => {
    if (e.target.closest("#simplePreviewLibraryBtn")) return;  // 從 CG 庫按鈕自行處理
    triggerCgInput();
  });
  if (previewLibBtn) previewLibBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openCgLibraryModal();
  });
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
        await attachCgFileToCurrentSlide(f);
      }
    });
  }

  // 任務 5:底部工具列 — 對話框樣式 popover + 輸出按鈕
  const styleTrigger = document.getElementById("simpleStyleTriggerBtn");
  if (styleTrigger) styleTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleSimpleStylePopover();
  });
  const styleAdvancedBtn = document.getElementById("simpleStyleAdvancedBtn");
  if (styleAdvancedBtn) styleAdvancedBtn.addEventListener("click", () => {
    closeSimpleStylePopover();
    if (typeof openStyleModal === "function") openStyleModal();
  });
  // 點 popover 內部不關閉;點外面才關
  const stylePopover = document.getElementById("simpleStylePopover");
  if (stylePopover) stylePopover.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", () => closeSimpleStylePopover());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSimpleStylePopover();
  });
  updateSimpleStyleTriggerLabel();

  // 底部工具列輸出按鈕(與編輯區舊按鈕共用同一組函式)
  const barPlay = document.getElementById("barPreviewPlayBtn");
  if (barPlay) barPlay.addEventListener("click", () => {
    if (_vnsSimplePlayback.playing) stopSimplePlayback();
    else startSimplePlayback();
  });
  const barSs = document.getElementById("barScreenshotBtn");
  if (barSs) barSs.addEventListener("click", exportSimpleScreenshot);
  const barGif = document.getElementById("barGifBtn");
  if (barGif) barGif.addEventListener("click", exportSimpleGif);
  const barMp4 = document.getElementById("barMp4Btn");
  if (barMp4) barMp4.addEventListener("click", exportSimpleMp4);
}

export {
  _prefetchCgUrl,
  _resolveSlideCgUrl,
  attachCgFileToCurrentSlide,
  attachCgIdToCurrentSlide,
  clearCgFromCurrentSlide,
  renderSimpleEditor,
  syncDialogStyleForCurrentSlide,
  updateSimpleStyleTriggerLabel,
  renderSimpleStylePopover,
  applySimpleStyle,
  openSimpleStylePopover,
  closeSimpleStylePopover,
  toggleSimpleStylePopover,
  initSimpleEditorBindings,
};
