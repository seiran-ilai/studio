// simple/choice-scene.js — 由 index.js 搬出(階段 3-G),內容未改動
// 選項幕編輯/驗證/預覽建構。相依(state/_vnsSimplePlayback/render*/_resolveSlideCgUrl 等)皆經全域取得。

function _choiceSlideLabel(card) {
  const cards = state.simpleCards || [];
  const i = cards.findIndex(c => c && c.id === card.id);
  return "幕 " + String(i + 1).padStart(2, "0");
}

async function checkChoiceSlideBeforeRun(card, action) {
  if (!isChoiceSlide(card)) return true;
  const label = _choiceSlideLabel(card);
  const actText = action === "output" ? "輸出" : "播放";
  // 9-3:無 CG → 不可繼續
  if (!_resolveSlideCgUrl(card)) {
    const ok = await inlineConfirm({
      title: "選項幕缺少 CG",
      message: label + " 是選項幕,需要 CG 背景才能" + actText + "。\n請上傳一張圖片。",
      okText: "立即上傳",
      cancelText: "之後再說",
    });
    if (ok) {
      selectSimpleSlide(card.id);
      const inp = document.getElementById("simpleCgFileInput");
      if (inp) inp.click();
    }
    return false;
  }
  // 9-1:無正解 → 單鈕,不可繼續
  if (!getCorrectChoice(card)) {
    await inlineConfirm({
      title: "⚠ 選項幕缺少正解",
      message: label + " 沒有勾選正解選項。\n請先勾選一個選項作為正解,否則無法" + actText + "。",
      okText: "我知道了",
      hideCancel: true,
    });
    return false;
  }
  // 9-2:有空白選項 → 可選擇繼續
  const hasEmpty = Array.isArray(card.choices) && card.choices.some(c => !c.text || !c.text.trim());
  if (hasEmpty) {
    const ok = await inlineConfirm({
      title: "選項幕有空白選項",
      message: label + " 有空白選項,確定要" + actText + "嗎?",
      okText: "仍要繼續",
      cancelText: "取消",
    });
    if (!ok) return false;
  }
  return true;
}

async function checkAllChoiceSlidesBeforeOutput() {
  const cards = state.simpleCards || [];
  let anyEmpty = false;
  for (const card of cards) {
    if (!isChoiceSlide(card)) continue;
    const label = _choiceSlideLabel(card);
    if (!_resolveSlideCgUrl(card)) {
      await inlineConfirm({
        title: "選項幕缺少 CG",
        message: label + " 是選項幕但沒有 CG 背景,無法輸出。\n請先上傳圖片。",
        okText: "我知道了", hideCancel: true,
      });
      return false;
    }
    if (!getCorrectChoice(card)) {
      await inlineConfirm({
        title: "⚠ 選項幕缺少正解",
        message: label + " 沒有勾選正解選項,無法輸出。\n請先勾選一個選項作為正解。",
        okText: "我知道了", hideCancel: true,
      });
      return false;
    }
    if (Array.isArray(card.choices) && card.choices.some(c => !c.text || !c.text.trim())) anyEmpty = true;
  }
  if (anyEmpty) {
    const ok = await inlineConfirm({
      title: "選項幕有空白選項",
      message: "有選項幕含空白選項,確定要輸出嗎?",
      okText: "仍要繼續", cancelText: "取消",
    });
    if (!ok) return false;
  }
  return true;
}

function renderSimpleChoiceEditor(card) {
  const list = document.getElementById("simpleChoiceList");
  if (!list || !isChoiceSlide(card)) return;
  list.innerHTML = "";
  const choices = Array.isArray(card.choices) ? card.choices : [];

  choices.forEach((ch, idx) => {
    const row = document.createElement("div");
    row.className = "simple-choice-item";
    row.dataset.choiceId = ch.id;
    row.draggable = true;

    // 正解勾選(整列只能一個)
    const correct = document.createElement("button");
    correct.type = "button";
    correct.className = "simple-choice-correct" + (ch.isCorrect ? " on" : "");
    correct.title = ch.isCorrect ? "正解(再點取消)" : "標為正解";
    correct.textContent = ch.isCorrect ? "☑" : "☐";
    correct.addEventListener("click", () => toggleChoiceCorrect(card, ch.id));

    // 編號
    const num = document.createElement("span");
    num.className = "simple-choice-num";
    num.textContent = (idx + 1) + ".";

    // 文字輸入
    const input = document.createElement("input");
    input.type = "text";
    input.className = "simple-choice-input";
    input.value = ch.text || "";
    input.placeholder = "輸入選項文字";
    input.dataset.choiceInput = ch.id;
    input.addEventListener("input", () => {
      ch.text = input.value;
      saveToStorage();
      renderSimpleSlideList();           // 更新卡片選項數提示
      if (!_vnsSimplePlayback.playing) renderChoicePreview(card, _resolveSlideCgUrl(card));
    });
    // 編輯文字時暫時關閉拖曳,避免影響選字
    input.addEventListener("focus", () => { row.draggable = false; });
    input.addEventListener("blur", () => { row.draggable = true; });

    // 刪除(剩 2 個時禁用)
    const del = document.createElement("button");
    del.type = "button";
    del.className = "simple-choice-del";
    del.textContent = "✕";
    del.title = "刪除選項";
    del.disabled = choices.length <= 2;
    del.addEventListener("click", () => deleteChoice(card, ch.id));

    row.appendChild(correct);
    row.appendChild(num);
    row.appendChild(input);
    row.appendChild(del);

    // 拖曳排序(沿用幕列表邏輯)
    row.addEventListener("dragstart", (ev) => {
      ev.dataTransfer.effectAllowed = "move";
      ev.dataTransfer.setData("text/x-vns-choice-id", ch.id);
      row.classList.add("dragging");
    });
    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
      list.querySelectorAll(".simple-choice-item.drop-target").forEach(n => n.classList.remove("drop-target"));
    });
    row.addEventListener("dragover", (ev) => {
      const types = ev.dataTransfer && ev.dataTransfer.types;
      if (!types || !types.includes("text/x-vns-choice-id")) return;
      ev.preventDefault();
      ev.dataTransfer.dropEffect = "move";
      row.classList.add("drop-target");
    });
    row.addEventListener("dragleave", () => row.classList.remove("drop-target"));
    row.addEventListener("drop", (ev) => {
      ev.preventDefault();
      row.classList.remove("drop-target");
      const draggedId = ev.dataTransfer.getData("text/x-vns-choice-id");
      if (!draggedId || draggedId === ch.id) return;
      const from = card.choices.findIndex(c => c.id === draggedId);
      const to = card.choices.findIndex(c => c.id === ch.id);
      if (from < 0 || to < 0) return;
      const [moved] = card.choices.splice(from, 1);
      card.choices.splice(to, 0, moved);
      saveToStorage();
      renderSimpleChoiceEditor(card);
      renderSimpleSlideList();
      if (!_vnsSimplePlayback.playing) renderChoicePreview(card, _resolveSlideCgUrl(card));
    });

    list.appendChild(row);
  });

  // 警告:無正解時顯示
  const warn = document.getElementById("simpleChoiceWarn");
  if (warn) warn.hidden = !!getCorrectChoice(card);
  // 新增選項按鈕:達上限(5)禁用
  const addBtn = document.getElementById("simpleChoiceAddBtn");
  if (addBtn) addBtn.disabled = choices.length >= 5;
}

function toggleChoiceCorrect(card, choiceId) {
  if (!isChoiceSlide(card) || !Array.isArray(card.choices)) return;
  const target = card.choices.find(c => c.id === choiceId);
  if (!target) return;
  const wasCorrect = target.isCorrect;
  card.choices.forEach(ch => { ch.isCorrect = false; });
  if (!wasCorrect) target.isCorrect = true;
  saveToStorage();
  renderSimpleChoiceEditor(card);
  renderSimpleSlideList();
  if (!_vnsSimplePlayback.playing) renderChoicePreview(card, _resolveSlideCgUrl(card));
}

function setChoiceCorrectExclusive(card, choiceId) {
  if (!isChoiceSlide(card) || !Array.isArray(card.choices)) return;
  card.choices.forEach(ch => { ch.isCorrect = (ch.id === choiceId); });
  saveToStorage();
  renderSimpleChoiceEditor(card);
  renderSimpleSlideList();
  if (!_vnsSimplePlayback.playing) renderChoicePreview(card, _resolveSlideCgUrl(card));
}

function addChoice(card) {
  if (!isChoiceSlide(card)) return;
  if (!Array.isArray(card.choices)) card.choices = [];
  if (card.choices.length >= 5) return;
  const ch = createEmptyChoice();
  card.choices.push(ch);
  saveToStorage();
  renderSimpleChoiceEditor(card);
  renderSimpleSlideList();
  if (!_vnsSimplePlayback.playing) renderChoicePreview(card, _resolveSlideCgUrl(card));
  // 自動 focus 到新選項輸入框
  const list = document.getElementById("simpleChoiceList");
  const input = list && list.querySelector(`[data-choice-input="${ch.id}"]`);
  if (input) input.focus();
}

function deleteChoice(card, choiceId) {
  if (!isChoiceSlide(card) || !Array.isArray(card.choices)) return;
  if (card.choices.length <= 2) return;
  const idx = card.choices.findIndex(c => c.id === choiceId);
  if (idx < 0) return;
  card.choices.splice(idx, 1);
  saveToStorage();
  renderSimpleChoiceEditor(card);
  renderSimpleSlideList();
  if (!_vnsSimplePlayback.playing) renderChoicePreview(card, _resolveSlideCgUrl(card));
}

function _buildChoiceEls(choices, opts) {
  opts = opts || {};
  const out = [];
  (Array.isArray(choices) ? choices : []).forEach((ch) => {
    const el = document.createElement("div");
    el.className = "simple-choice-opt";
    el.dataset.choiceId = ch.id;
    const text = (ch.text && ch.text.trim()) ? ch.text : "";
    el.textContent = text;
    if (!text) el.classList.add("empty");
    if (opts.correctHint && ch.isCorrect) el.classList.add("correct-hint");
    if (opts.selectedId) {
      if (ch.id === opts.selectedId) el.classList.add("selected");
      else if (opts.fade) el.classList.add("faded");
    }
    out.push(el);
  });
  return out;
}

function renderChoicePreview(card, cgUrl) {
  const dialogEl = document.getElementById("simplePreviewDialog");
  if (dialogEl) { dialogEl.hidden = true; dialogEl.innerHTML = ""; }
  const box = document.getElementById("simplePreviewChoices");
  if (!box) return;
  if (!isChoiceSlide(card) || !cgUrl) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }
  box.hidden = false;
  box.innerHTML = "";
  _buildChoiceEls(card.choices, { correctHint: true }).forEach(el => box.appendChild(el));
}

export {
  _choiceSlideLabel,
  checkChoiceSlideBeforeRun,
  checkAllChoiceSlidesBeforeOutput,
  renderSimpleChoiceEditor,
  toggleChoiceCorrect,
  setChoiceCorrectExclusive,
  addChoice,
  deleteChoice,
  _buildChoiceEls,
  renderChoicePreview,
};
