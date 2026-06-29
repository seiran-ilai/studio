// simple/cards.js — 由 index.js 搬出,內容未改動。卡片式編輯 UI。相依皆經全域取得。

function renderSimpleCards() {
  const container = document.getElementById("simpleCardsContainer");
  const empty = document.getElementById("simpleEmptyState");
  const addZone = document.getElementById("simpleAddCardZone");
  const actions = document.getElementById("simpleBottomActions");
  if (!container) return;
  if (!state.simpleCards || !state.simpleCards.length) {
    if (empty) empty.hidden = false;
    if (addZone) addZone.hidden = true;
    if (actions) actions.hidden = true;
    container.innerHTML = "";
    return;
  }
  if (empty) empty.hidden = true;
  if (addZone) addZone.hidden = false;
  if (actions) actions.hidden = false;
  container.innerHTML = "";
  state.simpleCards.forEach((card, idx) => {
    container.appendChild(renderSimpleCard(card, idx));
  });
}

function renderSimpleCard(card, idx) {
  const el = document.createElement("div");
  el.className = "simple-card";
  el.dataset.index = idx;

  const thumb = document.createElement("div");
  thumb.className = "simple-card-thumb";
  const cgData = card.cgName ? state.cgs[card.cgName] : null;
  if (cgData && cgData.dataUrl) {
    thumb.style.backgroundImage = `url(${cgData.dataUrl})`;
  } else if (card.cgName) {
    thumb.innerHTML = `<span class="simple-card-thumb-empty">${_shEsc(card.cgName)}<br>(未上傳)</span>`;
  } else {
    thumb.innerHTML = '<span class="simple-card-thumb-empty">點此選 CG</span>';
  }
  thumb.addEventListener("click", () => openCgPicker(idx));
  el.appendChild(thumb);

  const body = document.createElement("div");
  body.className = "simple-card-body";

  const dialogList = document.createElement("div");
  dialogList.className = "simple-card-dialogs";
  if (!card.dialogs.length) card.dialogs.push({ speaker: null, text: "" });
  card.dialogs.forEach((d, dIdx) => {
    dialogList.appendChild(renderDialogRow(card, idx, d, dIdx));
  });
  body.appendChild(dialogList);

  const addDialog = document.createElement("button");
  addDialog.className = "simple-add-dialog-btn";
  addDialog.textContent = "＋ 對白";
  addDialog.addEventListener("click", () => {
    const last = card.dialogs[card.dialogs.length - 1];
    card.dialogs.push({ speaker: last ? last.speaker : null, text: "" });
    syncSimpleToScript();
    renderSimpleCards();
    setTimeout(() => {
      const allTextareas = document.querySelectorAll(".simple-dialog-text");
      const target = allTextareas[allTextareas.length - 1];
      if (target) target.focus();
    }, 30);
  });
  body.appendChild(addDialog);

  el.appendChild(body);

  const actions = document.createElement("div");
  actions.className = "simple-card-actions";
  const upBtn = document.createElement("button");
  upBtn.className = "icon-btn";
  upBtn.title = "上移";
  upBtn.textContent = "↑";
  if (idx === 0) upBtn.disabled = true;
  upBtn.addEventListener("click", () => moveCard(idx, -1));
  actions.appendChild(upBtn);

  const dnBtn = document.createElement("button");
  dnBtn.className = "icon-btn";
  dnBtn.title = "下移";
  dnBtn.textContent = "↓";
  if (idx === state.simpleCards.length - 1) dnBtn.disabled = true;
  dnBtn.addEventListener("click", () => moveCard(idx, +1));
  actions.appendChild(dnBtn);

  const delBtn = document.createElement("button");
  delBtn.className = "icon-btn icon-btn-danger";
  delBtn.title = "刪除";
  delBtn.innerHTML = "<svg class=\"ic\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 7h14M10 7V5h4v2M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M10 11v6M14 11v6\"/></svg>";
  delBtn.addEventListener("click", async () => {
    const ok = await inlineConfirm({
      title: "刪除這張卡?",
      message: "卡片上的 CG + 所有對白會一起刪除。",
      okText: "刪除", danger: true,
    });
    if (!ok) return;
    state.simpleCards.splice(idx, 1);
    syncSimpleToScript();
    renderSimpleCards();
  });
  actions.appendChild(delBtn);

  el.appendChild(actions);
  return el;
}

function renderDialogRow(card, cardIdx, dialog, dialogIdx) {
  const row = document.createElement("div");
  row.className = "simple-dialog-row";

  const speakerSel = document.createElement("select");
  speakerSel.className = "simple-dialog-speaker";
  speakerSel.innerHTML =
    '<option value="">（旁白）</option>' +
    state.characters.map(c => `<option value="${_shEsc(c.name)}" ${dialog.speaker === c.name ? "selected" : ""}>${_shEsc(c.name)}</option>`).join("");
  speakerSel.addEventListener("change", () => {
    dialog.speaker = speakerSel.value || null;
    syncSimpleToScript();
  });
  row.appendChild(speakerSel);

  const textInput = document.createElement("textarea");
  textInput.className = "simple-dialog-text";
  textInput.placeholder = "輸入對白...";
  textInput.value = dialog.text;
  textInput.rows = 2;
  textInput.addEventListener("input", () => {
    dialog.text = textInput.value;
    if (__simpleSyncTimer) clearTimeout(__simpleSyncTimer);
    __simpleSyncTimer = setTimeout(syncSimpleToScript, 250);
  });
  row.appendChild(textInput);

  const delBtn = document.createElement("button");
  delBtn.className = "simple-dialog-del";
  delBtn.innerHTML = "×";
  delBtn.title = "刪除這段對白";
  delBtn.addEventListener("click", () => {
    card.dialogs.splice(dialogIdx, 1);
    if (card.dialogs.length === 0) card.dialogs.push({ speaker: null, text: "" });
    syncSimpleToScript();
    renderSimpleCards();
  });
  row.appendChild(delBtn);

  return row;
}

function moveCard(idx, dir) {
  const target = idx + dir;
  if (target < 0 || target >= state.simpleCards.length) return;
  const tmp = state.simpleCards[idx];
  state.simpleCards[idx] = state.simpleCards[target];
  state.simpleCards[target] = tmp;
  syncSimpleToScript();
  renderSimpleCards();
}

function showStylePickerOverlay() {
  return new Promise((resolve) => {
    const overlay = document.getElementById("stylePickerOverlay");
    const grid = document.getElementById("stylePickerGrid");
    if (!overlay || !grid) { resolve(); return; }
    grid.innerHTML = "";
    for (const [styleId, style] of Object.entries(STYLE_PRESETS)) {
      const variantId = getDefaultVariantId(styleId);
      const variant = style.variants[variantId];
      const card = document.createElement("div");
      card.className = "style-picker-card";

      const preview = document.createElement("div");
      preview.className = "style-picker-card-preview";
      preview.style.background = variant.stageBg.base;
      const dlg = document.createElement("div");
      dlg.style.background = variant.dialog.bgColor;
      dlg.style.border = `${variant.dialog.borderWidth || 1}px solid ${variant.dialog.borderColor}`;
      dlg.style.padding = "8px 12px";
      dlg.style.borderRadius = (variant.dialog.shape === "soft" ? "12px" : "2px");
      dlg.style.fontFamily = variant.dialogText.fontStack;
      dlg.style.color = variant.dialogText.color;
      dlg.style.fontSize = "11px";
      dlg.style.width = "100%";
      const spk = document.createElement("div");
      spk.style.color = variant.speaker.color;
      spk.style.fontFamily = variant.speaker.fontStack;
      spk.style.fontSize = "11px";
      spk.style.fontWeight = variant.speaker.weight || 500;
      spk.style.fontStyle = variant.speaker.fontStyle || "normal";
      spk.textContent = (variant.speaker.prefix || "") + "薇拉諾斯" + (variant.speaker.suffix || "");
      dlg.appendChild(spk);
      const txt = document.createElement("div");
      txt.style.marginTop = "3px";
      txt.textContent = "「等你很久了…」";
      dlg.appendChild(txt);
      preview.appendChild(dlg);
      card.appendChild(preview);

      const name = document.createElement("div");
      name.className = "style-picker-card-name";
      name.textContent = style.name;
      card.appendChild(name);

      card.addEventListener("click", () => {
        applyStylePreset(styleId, variantId);
        state.style.firstStyleSelected = true;
        saveToStorage();
        renderStylePresetGrid();
        overlay.hidden = true;
        resolve();
      });
      grid.appendChild(card);
    }
    const skipBtn = document.getElementById("stylePickerSkip");
    if (skipBtn) skipBtn.onclick = () => {
      state.style.firstStyleSelected = true;
      saveToStorage();
      overlay.hidden = true;
      resolve();
    };
    overlay.hidden = false;
  });
}

function openCgPicker(cardIdx) {
  __cgPickerTargetCardIdx = cardIdx;
  const overlay = document.getElementById("cgPickerOverlay");
  const grid = document.getElementById("cgPickerGrid");
  if (!overlay || !grid) return;
  grid.innerHTML = "";
  const cgNames = state.cgOrder.length ? state.cgOrder : Object.keys(state.cgs);
  if (!cgNames.length) {
    grid.innerHTML = '<div class="cg-picker-grid-empty">還沒有 CG。點下方按鈕上傳第一張。</div>';
  } else {
    const currentCgName = state.simpleCards[cardIdx]?.cgName;
    for (const name of cgNames) {
      const cg = state.cgs[name];
      if (!cg || !cg.dataUrl) continue;
      const thumb = document.createElement("div");
      thumb.className = "cg-picker-thumb" + (name === currentCgName ? " active" : "");
      thumb.style.backgroundImage = `url(${cg.dataUrl})`;
      thumb.title = name;
      thumb.addEventListener("click", () => {
        state.simpleCards[cardIdx].cgName = name;
        syncSimpleToScript();
        renderSimpleCards();
        overlay.hidden = true;
      });
      grid.appendChild(thumb);
    }
  }
  overlay.hidden = false;
}

async function startFirstCardFlow(file) {
  // 1. 處理圖片
  const dataUrl = await readFileAsDataURL(file);
  const scaled = await downscaleImage(dataUrl, 1600);
  const cgName = `CG-${Date.now()}`;
  state.cgs[cgName] = { dataUrl: scaled };
  if (!state.cgOrder.includes(cgName)) state.cgOrder.push(cgName);

  // 2. 若沒選過風格 → 跳出選風格
  if (!state.style.firstStyleSelected) {
    await showStylePickerOverlay();
  }

  // 3. 建立第一張卡
  state.simpleCards.push({
    cgName,
    dialogs: [{ speaker: null, text: "" }],
  });
  syncSimpleToScript();
  renderSimpleCards();
  setTimeout(() => {
    const allTextareas = document.querySelectorAll(".simple-dialog-text");
    const target = allTextareas[allTextareas.length - 1];
    if (target) target.focus();
  }, 50);
}

async function addCardWithCg(file) {
  const dataUrl = await readFileAsDataURL(file);
  const scaled = await downscaleImage(dataUrl, 1600);
  const cgName = `CG-${Date.now()}`;
  state.cgs[cgName] = { dataUrl: scaled };
  if (!state.cgOrder.includes(cgName)) state.cgOrder.push(cgName);
  const last = state.simpleCards[state.simpleCards.length - 1];
  const lastDialog = last && last.dialogs[last.dialogs.length - 1];
  state.simpleCards.push({
    cgName,
    dialogs: [{ speaker: lastDialog ? lastDialog.speaker : null, text: "" }],
  });
  syncSimpleToScript();
  renderSimpleCards();
}

export {
  renderSimpleCards,
  renderSimpleCard,
  renderDialogRow,
  moveCard,
  showStylePickerOverlay,
  openCgPicker,
  startFirstCardFlow,
  addCardWithCg,
};
