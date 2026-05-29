// modals/portrait-framer.js — 由 index.js 搬出,內容未改動。立繪取景器(lazy init,IIFE 本體不碰 DOM)。

const PortraitCropper = (function () {
  let editingCharId = null;
  const comparing = new Set();
  let modal, stage, container, ySlider, scaleSlider, yVal, scaleVal, statusEl;
  let nameTitle, editingNameEl, compareListEl;
  let dragging = false, dragStartY = 0, dragStartYVal = 0;
  let inited = false;

  function init() {
    if (inited) return;
    modal = document.getElementById("portraitCropperModal");
    if (!modal) return;
    stage = document.getElementById("cropperStage");
    container = document.getElementById("cropperFigureContainer");
    ySlider = document.getElementById("cropperYSlider");
    scaleSlider = document.getElementById("cropperScaleSlider");
    yVal = document.getElementById("cropperYVal");
    scaleVal = document.getElementById("cropperScaleVal");
    statusEl = document.getElementById("cropperStatus");
    nameTitle = document.getElementById("cropperCharName");
    editingNameEl = document.getElementById("cropperEditingName");
    compareListEl = document.getElementById("cropperCompareList");

    document.getElementById("cropperClose").addEventListener("click", close);
    document.getElementById("cropperReset").addEventListener("click", reset);
    document.getElementById("cropperSave").addEventListener("click", save);
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });

    ySlider.addEventListener("input", onSliderChange);
    scaleSlider.addEventListener("input", onSliderChange);

    // 快速套用 preset 按鈕(重設 / 頭部 / 半身 / 全身)
    document.querySelectorAll(".cropper-preset-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const c = getCurrentChar();
        if (!c) return;
        c.portraitY = parseInt(btn.dataset.y, 10);
        c.portraitScale = parseInt(btn.dataset.s, 10);
        render();
      });
    });

    stage.addEventListener("mousedown", onDragStart);
    stage.addEventListener("touchstart", onDragStart, { passive: false });
    document.addEventListener("mousemove", onDragMove);
    document.addEventListener("touchmove", onDragMove, { passive: true });
    document.addEventListener("mouseup", onDragEnd);
    document.addEventListener("touchend", onDragEnd);
    inited = true;
  }

  function open(charId) {
    if (!inited) init();
    if (!modal) return;
    editingCharId = charId;
    comparing.clear();
    const c = getCurrentChar();
    if (!c) return;
    nameTitle.textContent = c.name;
    editingNameEl.textContent = c.name;
    state.characters.filter(x => x.id !== charId).slice(0, 2)
      .forEach(x => comparing.add(x.id));
    renderCompareList();
    render();
    modal.classList.add("show");
  }

  function close() {
    if (modal) modal.classList.remove("show");
    editingCharId = null;
  }

  function getCurrentChar() {
    return state.characters.find(c => c.id === editingCharId);
  }

  function onSliderChange() {
    const c = getCurrentChar();
    if (!c) return;
    c.portraitY = parseInt(ySlider.value, 10);
    c.portraitScale = parseInt(scaleSlider.value, 10);
    render();
  }

  function onDragStart(e) {
    if (!editingCharId) return;
    dragging = true;
    dragStartY = e.touches ? e.touches[0].clientY : e.clientY;
    dragStartYVal = getCurrentChar().portraitY;
    if (e.cancelable) e.preventDefault();
  }

  function onDragMove(e) {
    if (!dragging || !editingCharId) return;
    const rect = stage.getBoundingClientRect();
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    // ×200 敏感度,讓拖曳一次可覆蓋全 -200~+200 範圍
    const dyPct = ((clientY - dragStartY) / rect.height) * 200;
    const c = getCurrentChar();
    c.portraitY = Math.max(-200, Math.min(200, Math.round(dragStartYVal + dyPct)));
    render();
  }

  function onDragEnd() { dragging = false; }

  function getCharPortraitURL(char) {
    if (!char.portraits) return null;
    for (const k of Object.keys(char.portraits)) {
      if (char.portraits[k]) return char.portraits[k];
    }
    return null;
  }

  function buildFigure(char, isMain, leftPct) {
    const wrap = document.createElement("div");
    wrap.className = "cropper-fig " + (isMain ? "is-main" : "is-compare");
    const baseW = isMain ? 30 : 22;
    wrap.style.width = baseW + "%";
    wrap.style.left = `calc(${leftPct}% - ${baseW / 2}%)`;
    // 固定高度 100%,用 transform 縮放(避免 object-fit:contain 寬度受限時 height% 無效)
    wrap.style.height = "100%";
    wrap.style.bottom = (-char.portraitY) + "%";
    wrap.style.transform = `scale(${char.portraitScale / 100})`;
    wrap.style.transformOrigin = "bottom center";

    const tag = document.createElement("div");
    tag.className = "cropper-fig-tag";
    tag.style.color = char.color;
    tag.textContent = char.name + (isMain ? " · 編輯中" : "");
    wrap.appendChild(tag);

    const url = getCharPortraitURL(char);
    if (url) {
      const img = document.createElement("img");
      img.src = url;
      img.alt = char.name;
      wrap.appendChild(img);
    } else {
      const ph = document.createElement("div");
      ph.style.cssText =
        "width:100%;height:100%;border-radius:8px 8px 0 0;opacity:.6;background:" + char.color;
      wrap.appendChild(ph);
    }
    return wrap;
  }

  function render() {
    if (!editingCharId) return;
    container.innerHTML = "";
    const ed = getCurrentChar();
    if (!ed) return;
    container.appendChild(buildFigure(ed, true, 50));
    [...comparing]
      .map(id => state.characters.find(c => c.id === id))
      .filter(Boolean)
      .forEach((c, i) => {
        const isLeft = i % 2 === 0;
        const offset = Math.floor(i / 2) + 1;
        const leftPct = isLeft ? 50 - offset * 18 : 50 + offset * 18;
        container.appendChild(buildFigure(c, false, leftPct));
      });
    ySlider.value = ed.portraitY;
    scaleSlider.value = ed.portraitScale;
    yVal.textContent = ed.portraitY + "%";
    scaleVal.textContent = ed.portraitScale + "%";
    statusEl.innerHTML =
      `Y 位置 <code>${ed.portraitY}%</code> · 縮放 <code>${ed.portraitScale}%</code>`;
  }

  function renderCompareList() {
    compareListEl.innerHTML = "";
    state.characters.filter(c => c.id !== editingCharId).forEach(c => {
      const item = document.createElement("label");
      item.className = "cropper-compare-item";
      item.innerHTML =
        `<input type="checkbox" ${comparing.has(c.id) ? "checked" : ""}>` +
        `<span class="cropper-color-dot" style="background:${c.color}"></span>` +
        `<span>${escHtml(c.name)}</span>` +
        `<span class="cropper-compare-info">Y${c.portraitY} · ${c.portraitScale}%</span>`;
      item.querySelector("input").addEventListener("change", (e) => {
        if (e.target.checked) comparing.add(c.id);
        else comparing.delete(c.id);
        render();
      });
      compareListEl.appendChild(item);
    });
  }

  function reset() {
    const c = getCurrentChar();
    if (!c) return;
    c.portraitY = 0;
    c.portraitScale = 100;
    render();
  }

  function save() {
    const c = getCurrentChar();
    if (!c) return;
    saveToStorage();
    reparseAndRender(false);
    if (typeof renderCharList === "function") renderCharList();
    statusEl.innerHTML =
      `✓ 已儲存 · Y <code>${c.portraitY}%</code> 縮放 <code>${c.portraitScale}%</code>`;
    setTimeout(() => {
      if (getCurrentChar() === c) {
        statusEl.innerHTML =
          `Y 位置 <code>${c.portraitY}%</code> · 縮放 <code>${c.portraitScale}%</code>`;
      }
    }, 2000);
  }

  return { init, open, close };
})();

export { PortraitCropper };
