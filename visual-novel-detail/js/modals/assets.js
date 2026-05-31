// modals/assets.js — 由 index.js 搬出(階段 3-F),內容未改動

function openModal(tab = "chars") {
  modalEl.classList.add("show");
  switchTab(tab);
  renderCharList();
  renderBgList();
  renderCgList();
  renderStyleTab();
  updateStorageMeter();
}

function closeModal() {
  modalEl.classList.remove("show");
  // re-render preview in case data changed
  reparseAndRender(false);
}

function switchTab(name) {
  document.querySelectorAll(".tab").forEach(t => {
    t.classList.toggle("active", t.dataset.tab === name);
  });
  document.querySelectorAll(".tab-panel").forEach(p => {
    p.classList.toggle("active", p.dataset.tab === name);
  });
  const titles = { chars: "立繪", bgs: "背景", cgs: "CG" };
  document.getElementById("modalTitle").textContent = titles[name] || "資產管理";
}

function buildCardMenu(items) {
  const wrap = document.createElement("div");
  wrap.className = "card-menu-wrap";
  const btn = document.createElement("button");
  btn.className = "card-menu-btn";
  btn.textContent = "⋯";
  btn.title = "更多";
  const menu = document.createElement("div");
  menu.className = "card-menu";
  menu.hidden = true;
  for (const it of items) {
    if (it.sep) {
      const s = document.createElement("div");
      s.className = "card-menu-sep";
      menu.appendChild(s);
      continue;
    }
    const b = document.createElement("button");
    b.className = "card-menu-item" + (it.danger ? " danger" : "");
    b.textContent = it.label;
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.hidden = true;
      it.onClick();
    });
    menu.appendChild(b);
  }
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const wasHidden = menu.hidden;
    document.querySelectorAll(".card-menu").forEach(m => { m.hidden = true; });
    menu.hidden = !wasHidden;
  });
  wrap.appendChild(btn);
  wrap.appendChild(menu);
  return wrap;
}

function countScriptSpeakerUses(name) {
  if (!name) return 0;
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^\\s*${esc}(?=[\\[：:])`, "gm");
  return (state.script.match(re) || []).length;
}

function batchUploadPortraits(ch) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/jpeg,image/png,image/webp";
  input.multiple = true;
  input.style.display = "none";
  document.body.appendChild(input);
  input.addEventListener("change", async () => {
    const files = Array.from(input.files || []);
    input.remove();
    if (!files.length) return;
    let added = 0, replaced = 0, failed = 0;
    for (const file of files) {
      const emo = file.name.replace(/\.[^.]+$/, "").trim();
      if (!emo || file.size > MAX_FILE_BYTES) { failed++; continue; }
      try {
        const raw = await readFileAsDataURL(file);
        const result = await downscaleImage(raw, 1200);
        const hadImg = !!ch.portraits[emo];
        if (!ch.emotions.includes(emo)) ch.emotions.push(emo);
        ch.portraits[emo] = result.dataUrl;
        if (hadImg) replaced++; else added++;
      } catch (e) { failed++; }
    }
    saveToStorage();
    renderCharList();
    updateStorageMeter();
    showToast(`✨ 批次上傳：新增 ${added}、覆蓋 ${replaced}${failed ? `、失敗 ${failed}` : ""}`, "success", 3500);
  });
  input.click();
}

function makeRenamePattern(name, kind) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (kind === "char") return new RegExp(`^(\\s*)${esc}(?=[\\[：:])`, "gm");
  if (kind === "bg")   return new RegExp(`(\\[bg\\s*:\\s*)${esc}(\\s*\\])`, "gi");
  if (kind === "cg")   return new RegExp(`(\\[cg(?:\\s+full)?\\s*:\\s*)${esc}(\\s*\\])`, "gi");
  return null;
}

function applyScriptRename(oldName, newName, kind) {
  const re = makeRenamePattern(oldName, kind);
  if (!re) return;
  state.script = (kind === "char")
    ? state.script.replace(re, (m, sp) => sp + newName)
    : state.script.replace(re, (m, a, b) => a + newName + b);
  els.scriptArea.value = state.script;
  reparseAndRender(false);
}

async function handleRename({ oldName, newName, kind, applyData, revert }) {
  if (!newName || oldName === newName) { revert(); return; }
  const re = makeRenamePattern(oldName, kind);
  const matches = re ? (state.script.match(re) || []).length : 0;
  if (matches === 0) { applyData(); saveToStorage(); return; }
  const choice = await inlineChoose({
    title: "同步劇本?",
    message: `劇本中有 ${matches} 處提到「${oldName}」,要一起改名為「${newName}」嗎?`,
    options: [
      { key: "syncAll",  label: "全部同步",  desc: `資料與劇本中 ${matches} 處一起改` },
      { key: "dataOnly", label: "只改資料",  desc: "劇本維持舊名稱不動" },
    ],
  });
  if (!choice) { revert(); return; }
  applyData();
  if (choice === "syncAll") applyScriptRename(oldName, newName, kind);
  saveToStorage();
}

function duplicateCharacter(ch, idx) {
  let newId = ch.id + "_copy";
  while (state.characters.some(c => c.id === newId)) newId += "_";
  const copy = {
    id: newId,
    name: ch.name + " 副本",
    color: ch.color,
    emotions: [...(ch.emotions || [])],
    portraits: { ...(ch.portraits || {}) },
  };
  state.characters.splice(idx + 1, 0, copy);
  saveToStorage();
  renderCharList();
  updateStorageMeter();
  showToast(`✨ 已複製為「${copy.name}」`, "success");
}

function renderCharList() {
  const list = document.getElementById("charList");
  list.innerHTML = "";
  state.characters.forEach((ch, idx) => {
    list.appendChild(renderCharCard(ch, idx));
  });
}

function renderCharCard(ch, idx) {
  const card = document.createElement("div");
  card.className = "char-card";
  card.dataset.kind = ch.kind || "supporting";

  // head: color dot + name + delete
  const head = document.createElement("div");
  head.className = "char-card-head";

  const dot = document.createElement("label");
  dot.className = "char-color-dot";
  dot.style.background = ch.color;
  const colorIn = document.createElement("input");
  colorIn.type = "color";
  colorIn.value = ch.color;
  colorIn.addEventListener("input", (e) => {
    ch.color = e.target.value;
    dot.style.background = ch.color;
    saveToStorage();
  });
  dot.appendChild(colorIn);
  head.appendChild(dot);

  const nameIn = document.createElement("input");
  nameIn.className = "char-name-input";
  nameIn.value = ch.name;
  nameIn.placeholder = "角色名";
  nameIn.addEventListener("focus", (e) => { e.target._oldName = ch.name; });
  nameIn.addEventListener("input", (e) => {
    ch.name = e.target.value;
    saveToStorage();
  });
  nameIn.addEventListener("change", (e) => {
    const oldName = e.target._oldName != null ? e.target._oldName : ch.name;
    const newName = e.target.value.trim();
    e.target._oldName = newName;
    handleRename({
      oldName, newName, kind: "char",
      applyData: () => { ch.name = newName; e.target.value = newName; },
      revert: () => {
        ch.name = oldName;
        e.target.value = oldName;
        saveToStorage();
        renderCharList();
      },
    });
  });
  head.appendChild(nameIn);

  const menu = buildCardMenu([
    { label: "📁 整批上傳立繪", onClick: () => batchUploadPortraits(ch) },
    { label: "🗑 清空所有立繪", onClick: async () => {
        const ok = await inlineConfirm({
          title: `清空「${ch.name}」所有立繪?`,
          message: "角色設定與表情清單會保留,只刪除已上傳的圖片。此動作無法復原。",
          okText: "清空立繪", danger: true,
        });
        if (!ok) return;
        ch.portraits = {};
        saveToStorage();
        renderCharList();
        updateStorageMeter();
        showToast(`✨ 已清空「${ch.name}」的立繪`, "success");
      } },
    { label: "📋 複製此角色", onClick: () => duplicateCharacter(ch, idx) },
    { sep: true },
    { label: "✕ 刪除角色", danger: true, onClick: async () => {
        const uses = countScriptSpeakerUses(ch.name);
        const ok = await inlineConfirm({
          title: `刪除角色「${ch.name}」?`,
          message: (uses > 0
            ? `劇本中有 ${uses} 處使用此角色,刪除後相關對話將失效。\n`
            : "") + "所有上傳的立繪會一起刪除,此動作無法復原。",
          okText: "刪除", danger: true,
        });
        if (!ok) return;
        state.characters.splice(idx, 1);
        saveToStorage();
        renderCharList();
        updateStorageMeter();
      } },
  ]);
  head.appendChild(menu);

  card.appendChild(head);

  // quick colour swatches
  const PRESET_COLORS = [
    { c: "#d4869a", t: "玫瑰" }, { c: "#c4a265", t: "金" },
    { c: "#8b9fd4", t: "藍" },   { c: "#8fb88f", t: "綠" },
    { c: "#8b5fb8", t: "紫" },   { c: "#d4a08f", t: "珊瑚" },
    { c: "#a0a0a0", t: "灰" },
  ];
  const colorRow = document.createElement("div");
  colorRow.className = "char-color-row";
  const swatches = document.createElement("div");
  swatches.className = "char-color-swatches";
  PRESET_COLORS.forEach(({ c, t }) => {
    const sw = document.createElement("button");
    sw.type = "button";
    sw.className = "color-swatch" + (c.toLowerCase() === (ch.color || "").toLowerCase() ? " active" : "");
    sw.style.background = c;
    sw.dataset.color = c;
    sw.title = t;
    sw.addEventListener("click", () => {
      ch.color = c;
      dot.style.background = c;
      colorIn.value = c;
      swatches.querySelectorAll(".color-swatch").forEach(s =>
        s.classList.toggle("active", s.dataset.color.toLowerCase() === c.toLowerCase()));
      saveToStorage();
    });
    swatches.appendChild(sw);
  });
  colorRow.appendChild(swatches);
  card.appendChild(colorRow);

  // kind switch: 配角 / 主角
  const kindRow = document.createElement("div");
  kindRow.className = "char-kind-row";
  const isProtag = ch.kind === "protagonist";
  kindRow.innerHTML =
    `<label><input type="radio" name="kind-${ch.id}" value="supporting" ${!isProtag ? "checked" : ""}> 配角</label>` +
    `<label><input type="radio" name="kind-${ch.id}" value="protagonist" ${isProtag ? "checked" : ""}> 主角</label>` +
    `<span class="char-kind-hint">${isProtag ? "不出立繪、無表情" : "有立繪、有表情"}</span>`;
  kindRow.querySelectorAll('input[name^="kind-"]').forEach(radio => {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      ch.kind = radio.value;
      saveToStorage();
      reparseAndRender(false);
      renderCharList();
    });
  });
  card.appendChild(kindRow);

  // Batch 3:初始好感度
  if (!isProtag) {
    const loveRow = document.createElement("div");
    loveRow.className = "char-love-initial";
    const initVal = state.loveInitial[ch.name] != null ? state.loveInitial[ch.name] : 50;
    loveRow.innerHTML =
      `<label>初始好感度</label>` +
      `<input type="number" min="0" max="100" value="${initVal}" class="char-love-num">` +
      `<span class="char-love-hint">(0-100)</span>`;
    const numIn = loveRow.querySelector(".char-love-num");
    numIn.addEventListener("change", () => {
      const v = Math.max(0, Math.min(100, parseInt(numIn.value, 10) || 0));
      numIn.value = v;
      state.loveInitial[ch.name] = v;
      saveToStorage();
      reparseAndRender(false);
    });
    card.appendChild(loveRow);
  }

  if (isProtag) {
    // protagonist: no emotion / portrait area
    const notice = document.createElement("div");
    notice.className = "protagonist-notice";
    notice.innerHTML =
      `💡 主角不出立繪、沒有表情。<br>` +
      `劇本中寫 <code>${_shEsc(ch.name)}：你好</code> = 開口說話<br>` +
      `寫 <code>（這該怎麼辦？）</code> = 內心獨白`;
    card.appendChild(notice);
    return card;
  }

  // 立繪取景按鈕(僅配角,全表情共用)
  const cropRow = document.createElement("div");
  cropRow.className = "char-cropper-row";
  const cropBtn = document.createElement("button");
  cropBtn.type = "button";
  cropBtn.className = "char-cropper-btn";
  function cropInfoText() {
    return `Y${ch.portraitY != null ? ch.portraitY : 0} · ${ch.portraitScale != null ? ch.portraitScale : 100}%`;
  }
  cropBtn.innerHTML = `📐 <span>取景</span> <span class="crop-info">${cropInfoText()}</span>`;
  cropBtn.addEventListener("click", () => {
    if (window.PortraitCropper) window.PortraitCropper.open(ch.id);
  });
  cropRow.appendChild(cropBtn);
  card.appendChild(cropRow);

  // emotions grid (supporting only)
  const grid = document.createElement("div");
  grid.className = "emotions-grid";

  ch.emotions.forEach((emo, emoIdx) => {
    grid.appendChild(renderEmotionSlot(ch, emo, emoIdx));
  });

  // add emotion button
  const addBtn = document.createElement("button");
  addBtn.className = "add-emotion-btn";
  addBtn.textContent = "+ 表情";
  addBtn.addEventListener("click", async () => {
    const name = await inlinePrompt({
      title: `新增「${ch.name}」的表情`,
      message: "例如:微笑、害羞、生氣",
      placeholder: "表情名稱",
      validate: (v) => {
        if (!v) return "請輸入名稱";
        if (ch.emotions.includes(v)) return "已有同名表情";
        return null;
      },
    });
    if (!name) return;
    if (!checkEmotionNameConflict(name)) return;
    ch.emotions.push(name);
    saveToStorage();
    renderCharList();
  });
  grid.appendChild(addBtn);

  card.appendChild(grid);
  return card;
}

function renderCgList() {
  const list = document.getElementById("cgList");
  list.innerHTML = "";
  if (!state.cgOrder) state.cgOrder = [];
  // ensure all keys in cgOrder
  for (const k of Object.keys(state.cgs)) {
    if (!state.cgOrder.includes(k)) state.cgOrder.push(k);
  }
  state.cgOrder = state.cgOrder.filter(k => state.cgs[k]);

  for (const key of state.cgOrder) {
    list.appendChild(renderCgCard(key));
  }
}

function renderCgCard(key) {
  const cg = state.cgs[key];
  const card = document.createElement("div");
  card.className = "cg-card";

  const thumb = document.createElement("div");
  thumb.className = "cg-thumb";
  if (cg && cg.dataUrl) {
    thumb.style.backgroundImage = `url(${cg.dataUrl})`;
  } else {
    thumb.textContent = "尚未上傳";
  }
  thumb.title = "點擊或拖放圖片更換";
  thumb.addEventListener("click", () => triggerCgImageUpload(key));
  attachDropTarget(thumb, (file) => applyCgImageUpload(file, key));
  card.appendChild(thumb);

  const nameIn = document.createElement("input");
  nameIn.className = "cg-name-input";
  nameIn.value = key;
  nameIn.placeholder = "CG 名稱";
  nameIn.addEventListener("change", (e) => {
    const newKey = e.target.value.trim();
    if (!newKey || newKey === key) { e.target.value = key; return; }
    if (state.cgs[newKey]) { showToast("已有同名 CG", "warn"); e.target.value = key; return; }
    handleRename({
      oldName: key, newName: newKey, kind: "cg",
      applyData: () => {
        state.cgs[newKey] = state.cgs[key];
        delete state.cgs[key];
        state.cgOrder = state.cgOrder.map(k => k === key ? newKey : k);
      },
      revert: () => { e.target.value = key; },
    }).then(() => renderCgList());
  });
  card.appendChild(nameIn);

  const actions = document.createElement("div");
  actions.className = "cg-card-actions";
  const tag = document.createElement("div");
  tag.className = "bg-tag";
  tag.textContent = cg && cg.dataUrl ? "已上傳" : "未上傳";
  actions.appendChild(tag);

  card.appendChild(actions);

  card.appendChild(buildCardMenu([
    { label: "📁 換圖", onClick: () => triggerCgImageUpload(key) },
    { sep: true },
    { label: "✕ 刪除 CG", danger: true, onClick: async () => {
        const ok = await inlineConfirm({
          title: `刪除 CG「${key}」?`,
          message: "上傳的圖卡也會一起刪除。此動作無法復原。",
          okText: "刪除", danger: true,
        });
        if (!ok) return;
        delete state.cgs[key];
        state.cgOrder = state.cgOrder.filter(k => k !== key);
        saveToStorage();
        renderCgList();
        updateStorageMeter();
      } },
  ]));
  return card;
}

function checkEmotionNameConflict(name) {
  if (STYLE_TAG_NAMES.has(name)) {
    return confirm(
      `「${name}」是系統樣式 tag 的名稱,可能會被誤判為樣式而非表情。\n\n` +
      `按確定 = 仍然使用這個名稱(劇本中此 tag 會被當成樣式)\n` +
      `按取消 = 重新輸入`
    );
  }
  return true; // 沒衝突
}

function renderEmotionSlot(ch, emoName, emoIdx) {
  const slot = document.createElement("div");
  const hasImg = !!ch.portraits[emoName];
  slot.className = "emotion-slot" + (hasImg ? " has-image" : "");

  // thumbnail
  const thumb = document.createElement("div");
  thumb.className = "emotion-thumb";
  if (hasImg) {
    const img = document.createElement("img");
    img.src = ch.portraits[emoName];
    thumb.appendChild(img);
  } else {
    // svg placeholder
    thumb.innerHTML = svgPortrait(ch.color, ch.name);
  }
  const overlay = document.createElement("div");
  overlay.className = "emotion-thumb-overlay";
  overlay.textContent = hasImg ? "🔄 換圖" : "📁 上傳立繪";
  thumb.appendChild(overlay);
  thumb.addEventListener("click", () => {
    triggerCharImageUpload(ch, emoName);
  });
  thumb.title = "點擊或拖放圖片更換";
  attachDropTarget(thumb, (file) => applyCharImageUpload(file, ch, emoName));
  slot.appendChild(thumb);

  // name + del
  const row = document.createElement("div");
  row.className = "emotion-row";
  const nameIn = document.createElement("input");
  nameIn.className = "emotion-label-input";
  nameIn.value = emoName;
  nameIn.addEventListener("change", (e) => {
    const newName = e.target.value.trim();
    if (!newName) { e.target.value = emoName; return; }
    if (newName === emoName) return;
    if (ch.emotions.includes(newName)) {
      showToast("已有同名表情", "warn");
      e.target.value = emoName;
      return;
    }
    if (!checkEmotionNameConflict(newName)) {
      e.target.value = emoName;
      e.target.focus();
      return;
    }
    // rename: update emotions array + portraits map
    ch.emotions[emoIdx] = newName;
    if (ch.portraits[emoName]) {
      ch.portraits[newName] = ch.portraits[emoName];
      delete ch.portraits[emoName];
    }
    saveToStorage();
    renderCharList();
  });
  row.appendChild(nameIn);

  const delBtn = document.createElement("button");
  delBtn.className = "emotion-del";
  delBtn.innerHTML = "×";
  delBtn.title = "刪除此表情";
  delBtn.addEventListener("click", async () => {
    const ok = await inlineConfirm({
      title: `刪除表情「${emoName}」?`,
      message: "對應的立繪也會一起刪除。",
      okText: "刪除",
      danger: true,
    });
    if (!ok) return;
    ch.emotions.splice(emoIdx, 1);
    delete ch.portraits[emoName];
    saveToStorage();
    renderCharList();
  });
  row.appendChild(delBtn);
  slot.appendChild(row);

  // small "clear image" if has image
  if (hasImg) {
    const clearBtn = document.createElement("button");
    clearBtn.className = "emotion-del";
    clearBtn.textContent = "移除圖";
    clearBtn.style.fontSize = "10px";
    clearBtn.style.padding = "0";
    clearBtn.title = "移除這張立繪(保留表情)";
    clearBtn.addEventListener("click", () => {
      delete ch.portraits[emoName];
      saveToStorage();
      renderCharList();
    });
    row.appendChild(clearBtn);
  }

  return slot;
}

function triggerCharImageUpload(ch, emoName) {
  pendingUpload = { kind: "char", ch, emoName };
  const input = document.getElementById("charImgInput");
  input.value = "";
  input.click();
}

async function applyCharImageUpload(file, ch, emoName) {
  if (file.size > MAX_FILE_BYTES) {
    showToast(`圖片過大(${fmtBytes(file.size)}),最多 5MB`, "warn", 3500);
    return false;
  }
  try {
    const raw = await readFileAsDataURL(file);
    const result = await downscaleImage(raw, 1200);
    ch.portraits[emoName] = result.dataUrl;
    const ok = saveToStorage();
    if (ok) {
      const note = result.scaled ? `（${describeScale(result)}）` : "";
      showToast(`✨ 已上傳「${ch.name} · ${emoName}」${note}`, "success", result.scaled ? 3500 : 2500);
      renderCharList();
    }
    return ok;
  } catch (err) {
    console.error(err);
    showToast("讀取失敗", "warn");
    return false;
  }
}

function renderBgList() {
  const list = document.getElementById("bgList");
  list.innerHTML = "";

  // ensure bgOrder includes all current bgs (presets first, then user)
  const allKeys = Object.keys(state.backgrounds).filter(k => k !== "default");
  state.bgOrder = state.bgOrder || [];
  // add any missing
  for (const k of allKeys) {
    if (!state.bgOrder.includes(k)) state.bgOrder.push(k);
  }
  // remove any orphans
  state.bgOrder = state.bgOrder.filter(k => state.backgrounds[k]);

  state.bgOrder.forEach((key) => {
    list.appendChild(renderBgCard(key));
  });
}

function renderBgCard(key) {
  const bg = state.backgrounds[key];
  const card = document.createElement("div");
  card.className = "bg-card";

  // thumb
  const thumb = document.createElement("div");
  thumb.className = "bg-thumb";
  if (bg.type === "image") {
    thumb.style.backgroundImage = `url(${bg.dataUrl})`;
  } else if (bg.type === "preset") {
    // apply preset class to a temp inner div
    const inner = document.createElement("div");
    inner.className = "stage-bg " + bg.className;
    inner.style.position = "absolute";
    inner.style.inset = "0";
    thumb.style.position = "relative";
    thumb.style.overflow = "hidden";
    thumb.appendChild(inner);
  }
  thumb.title = "點擊或拖放圖片更換";
  thumb.addEventListener("click", () => triggerBgImageUpload(key));
  attachDropTarget(thumb, (file) => applyBgImageUpload(file, key));
  card.appendChild(thumb);

  // name
  const nameIn = document.createElement("input");
  nameIn.className = "bg-name-input";
  nameIn.value = key;
  nameIn.placeholder = "背景名";
  nameIn.addEventListener("change", (e) => {
    const newKey = e.target.value.trim();
    if (!newKey || newKey === key) { e.target.value = key; return; }
    if (state.backgrounds[newKey]) {
      showToast("已有同名背景", "warn");
      e.target.value = key;
      return;
    }
    handleRename({
      oldName: key, newName: newKey, kind: "bg",
      applyData: () => {
        state.backgrounds[newKey] = state.backgrounds[key];
        delete state.backgrounds[key];
        state.bgOrder = state.bgOrder.map(k => k === key ? newKey : k);
      },
      revert: () => { e.target.value = key; },
    }).then(() => renderBgList());
  });
  card.appendChild(nameIn);

  // tag
  const tag = document.createElement("div");
  tag.className = "bg-tag";
  tag.textContent = bg.type === "preset" ? "預設" : "自訂";
  card.appendChild(tag);

  const bgMenuItems = [
    { label: "📁 換圖", onClick: () => triggerBgImageUpload(key) },
    { label: "🗑 清空圖（回到預設色塊）", onClick: async () => {
        const ok = await inlineConfirm({
          title: `清空背景「${key}」的圖?`,
          message: "會回到預設色塊,名稱保留。此動作無法復原。",
          okText: "清空", danger: true,
        });
        if (!ok) return;
        state.backgrounds[key] = { type: "preset", className: "stage-bg-default" };
        saveToStorage();
        renderBgList();
        updateStorageMeter();
        showToast(`✨ 已清空背景「${key}」的圖`, "success");
      } },
  ];
  // preset backgrounds cannot be deleted (per spec)
  if (bg.type !== "preset") {
    bgMenuItems.push({ sep: true });
    bgMenuItems.push({ label: "✕ 刪除背景", danger: true, onClick: async () => {
      const ok = await inlineConfirm({
        title: `刪除背景「${key}」?`,
        message: "上傳的圖片也會一起刪除。此動作無法復原。",
        okText: "刪除", danger: true,
      });
      if (!ok) return;
      delete state.backgrounds[key];
      state.bgOrder = state.bgOrder.filter(k => k !== key);
      saveToStorage();
      renderBgList();
      updateStorageMeter();
    } });
  }
  card.appendChild(buildCardMenu(bgMenuItems));

  return card;
}

function triggerBgImageUpload(key) {
  pendingUpload = { kind: "bg", key };
  const input = document.getElementById("bgImgInput");
  input.value = "";
  input.click();
}

async function applyBgImageUpload(file, key) {
  if (file.size > MAX_FILE_BYTES) {
    showToast(`圖片過大(${fmtBytes(file.size)}),最多 5MB`, "warn", 3500);
    return false;
  }
  try {
    const raw = await readFileAsDataURL(file);
    const result = await downscaleImage(raw, 1600);
    state.backgrounds[key] = { type: "image", dataUrl: result.dataUrl };
    const ok = saveToStorage();
    if (ok) {
      const note = result.scaled ? `（${describeScale(result)}）` : "";
      showToast(`✨ 已上傳背景「${key}」${note}`, "success", result.scaled ? 3500 : 2500);
      renderBgList();
    }
    return ok;
  } catch (err) {
    console.error(err);
    showToast("讀取失敗", "warn");
    return false;
  }
}

function triggerCgImageUpload(key) {
  pendingUpload = { kind: "cg", key };
  const input = document.getElementById("cgImgInput");
  input.value = "";
  input.click();
}

async function applyCgImageUpload(file, key) {
  if (file.size > MAX_FILE_BYTES) {
    showToast(`圖片過大(${fmtBytes(file.size)}),最多 5MB`, "warn", 3500);
    return false;
  }
  try {
    const raw = await readFileAsDataURL(file);
    const result = await downscaleImage(raw, 1600);
    state.cgs[key] = { dataUrl: result.dataUrl };
    const ok = saveToStorage();
    if (ok) {
      const note = result.scaled ? `（${describeScale(result)}）` : "";
      showToast(`✨ 已上傳 CG「${key}」${note}`, "success", result.scaled ? 3500 : 2500);
      renderCgList();
    }
    return ok;
  } catch (err) {
    console.error(err);
    showToast("讀取失敗", "warn");
    return false;
  }
}

export {
  openModal,
  closeModal,
  switchTab,
  buildCardMenu,
  countScriptSpeakerUses,
  batchUploadPortraits,
  makeRenamePattern,
  applyScriptRename,
  handleRename,
  duplicateCharacter,
  renderCharList,
  renderCharCard,
  renderCgList,
  renderCgCard,
  checkEmotionNameConflict,
  renderEmotionSlot,
  triggerCharImageUpload,
  applyCharImageUpload,
  renderBgList,
  renderBgCard,
  triggerBgImageUpload,
  applyBgImageUpload,
  triggerCgImageUpload,
  applyCgImageUpload,
};
