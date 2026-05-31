// simple/slide-list.js — 由 index.js 搬出(階段 3-G),內容未改動
// 左側幕列表 + 幕管理(新增/刪除/移動/選取)。相依皆經全域取得。

function renderSimpleSlideList() {
  const list = document.getElementById("simpleSlideList");
  const countEl = document.getElementById("simpleSidebarCount");
  if (!list) return;
  list.innerHTML = "";
  const cards = state.simpleCards || [];
  if (countEl) countEl.textContent = String(cards.length);
  const curIdx = getCurrentSlideIdx();

  cards.forEach((card, idx) => {
    const isCurrent = idx === curIdx;
    const isChoice = isChoiceSlide(card);
    const item = document.createElement("div");
    item.className = "simple-slide-item" + (isCurrent ? " current" : "") + (isChoice ? " choice" : "");
    item.dataset.slideId = card.id;
    item.draggable = true;

    const thumb = document.createElement("div");
    thumb.className = "simple-slide-thumb";
    const cgUrl = _resolveSlideCgUrl(card);
    if (cgUrl) {
      thumb.style.backgroundImage = `url(${cgUrl})`;
      // 選項幕功能:CG 縮圖角落疊 🔀 標記
      if (isChoice) {
        const tb = document.createElement("span");
        tb.className = "simple-slide-thumb-choice";
        tb.textContent = "🔀";
        thumb.appendChild(tb);
      }
    } else {
      thumb.classList.add("empty");
      thumb.textContent = isChoice ? "🔀" : "📷";
    }

    const meta = document.createElement("div");
    meta.className = "simple-slide-meta";
    const indexEl = document.createElement("span");
    indexEl.className = "simple-slide-index";
    indexEl.textContent = "幕 " + String(idx + 1).padStart(2, "0");
    const linesEl = document.createElement("span");
    linesEl.className = "simple-slide-lines";
    if (isChoice) {
      // 選項幕功能:顯示選項數,未標正解時加 ⚠
      const n = Array.isArray(card.choices) ? card.choices.length : 0;
      const noCorrect = !getCorrectChoice(card);
      linesEl.textContent = "· 🔀 選項 ×" + n + (noCorrect ? " ⚠" : "");
      if (noCorrect) linesEl.classList.add("warn");
    } else {
      // 任務 8-4:顯示字數而非行數(去掉空白後計字),空幕顯示「空」
      const charCount = typeof card.dialogText === "string"
        ? card.dialogText.replace(/\s/g, "").length
        : 0;
      linesEl.textContent = charCount > 0 ? "· " + charCount + " 字" : "· 空";
    }
    meta.appendChild(indexEl);
    meta.appendChild(linesEl);

    item.appendChild(thumb);
    item.appendChild(meta);

    if (isCurrent) {
      const badge = document.createElement("span");
      badge.className = "simple-slide-current-badge";
      badge.textContent = "✓";
      item.appendChild(badge);
    } else {
      const del = document.createElement("button");
      del.className = "simple-slide-delete";
      del.type = "button";
      del.title = "刪除幕";
      del.textContent = "×";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteSimpleSlide(card.id);
      });
      item.appendChild(del);
    }

    item.addEventListener("click", () => selectSimpleSlide(card.id));

    // 拖曳重排
    item.addEventListener("dragstart", (ev) => {
      ev.dataTransfer.effectAllowed = "move";
      ev.dataTransfer.setData("text/x-vns-slide-id", card.id);
      item.classList.add("dragging");
    });
    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
      list.querySelectorAll(".simple-slide-item.drop-target").forEach(n => n.classList.remove("drop-target"));
    });
    item.addEventListener("dragover", (ev) => {
      const types = ev.dataTransfer && ev.dataTransfer.types;
      if (!types || !types.includes("text/x-vns-slide-id")) return;
      ev.preventDefault();
      ev.dataTransfer.dropEffect = "move";
      item.classList.add("drop-target");
    });
    item.addEventListener("dragleave", () => item.classList.remove("drop-target"));
    item.addEventListener("drop", (ev) => {
      ev.preventDefault();
      item.classList.remove("drop-target");
      const draggedId = ev.dataTransfer.getData("text/x-vns-slide-id");
      if (!draggedId || draggedId === card.id) return;
      const cards2 = state.simpleCards;
      const from = cards2.findIndex(s => s.id === draggedId);
      const to = cards2.findIndex(s => s.id === card.id);
      if (from < 0 || to < 0) return;
      const [moved] = cards2.splice(from, 1);
      cards2.splice(to, 0, moved);
      saveToStorage();
      renderSimpleSlideList();
    });

    list.appendChild(item);
  });
}

function _doSelectSimpleSlide(slideId) {
  state.simpleCurrentSlideId = slideId;
  saveToStorage();
  renderSimpleSlideList();
  renderSimpleEditor();
}

function selectSimpleSlide(slideId) {
  if (slideId === state.simpleCurrentSlideId) return;
  // 任務 9-3:離開「無 CG 的選項幕」時警告(選項幕必須有 CG)
  const leaving = getCurrentSlide();
  if (isChoiceSlide(leaving) && !_resolveSlideCgUrl(leaving)) {
    inlineConfirm({
      title: "選項幕缺少 CG",
      message: _choiceSlideLabel(leaving) + " 是選項幕,需要 CG 背景。\n請上傳一張圖片。",
      okText: "立即上傳",
      cancelText: "之後再說",
    }).then((ok) => {
      if (ok) {
        const inp = document.getElementById("simpleCgFileInput");
        if (inp) inp.click();   // 停留在當前幕並開啟上傳
      } else {
        _doSelectSimpleSlide(slideId);  // 之後再說 → 照常切換
      }
    });
    return;
  }
  _doSelectSimpleSlide(slideId);
}

function addSimpleSlide() {
  if (!Array.isArray(state.simpleCards)) state.simpleCards = [];
  const slide = createEmptySlide();
  state.simpleCards.push(slide);
  state.simpleCurrentSlideId = slide.id;
  saveToStorage();
  renderSimpleSlideList();
  renderSimpleEditor();
}

function addChoiceSlide() {
  if (!Array.isArray(state.simpleCards)) state.simpleCards = [];
  const prev = state.simpleCards[state.simpleCards.length - 1];
  const prevCg = (prev && prev.cg) ? prev.cg : null;
  const slide = createChoiceSlide(prevCg);
  state.simpleCards.push(slide);
  state.simpleCurrentSlideId = slide.id;
  saveToStorage();
  renderSimpleSlideList();
  renderSimpleEditor();
}

function deleteSimpleSlide(slideId) {
  if (!Array.isArray(state.simpleCards)) return;
  const idx = state.simpleCards.findIndex(s => s.id === slideId);
  if (idx < 0) return;
  state.simpleCards.splice(idx, 1);
  if (state.simpleCurrentSlideId === slideId) {
    state.simpleCurrentSlideId = state.simpleCards.length
      ? state.simpleCards[Math.min(idx, state.simpleCards.length - 1)].id
      : null;
  }
  saveToStorage();
  renderSimpleSlideList();
  renderSimpleEditor();
}

function moveCurrentSlide(direction) {
  const cards = state.simpleCards || [];
  const idx = getCurrentSlideIdx();
  if (idx < 0) return;
  const target = idx + (direction === "up" ? -1 : 1);
  if (target < 0 || target >= cards.length) return;
  // swap
  [cards[idx], cards[target]] = [cards[target], cards[idx]];
  saveToStorage();
  renderSimpleSlideList();
}

function navigateSimpleSlide(direction) {
  const cards = state.simpleCards || [];
  const idx = getCurrentSlideIdx();
  if (idx < 0) return;
  const target = idx + (direction === "up" ? -1 : 1);
  if (target < 0 || target >= cards.length) return;
  selectSimpleSlide(cards[target].id);
}

async function deleteCurrentSlideWithConfirm() {
  const cards = state.simpleCards || [];
  const idx = getCurrentSlideIdx();
  if (idx < 0) return;
  const ok = await inlineConfirm({
    title: "刪除這一幕?",
    message: "此操作無法復原。\n所引用的 CG 仍會保留在 CG 庫中。",
    okText: "確認刪除",
    danger: true,
  });
  if (!ok) return;
  deleteSimpleSlide(cards[idx].id);
}

export {
  renderSimpleSlideList,
  _doSelectSimpleSlide,
  selectSimpleSlide,
  addSimpleSlide,
  addChoiceSlide,
  deleteSimpleSlide,
  moveCurrentSlide,
  navigateSimpleSlide,
  deleteCurrentSlideWithConfirm,
};
