// modals/cg-library.js — 由 index.js 搬出(階段 3-F),內容未改動

async function openCgLibraryModal() {
  const modal = document.getElementById("cgLibraryModal");
  if (!modal) return;
  modal.classList.add("show");
  await renderCgLibraryGrid();
}

function closeCgLibraryModal() {
  const modal = document.getElementById("cgLibraryModal");
  if (modal) modal.classList.remove("show");
  // 釋放縮圖 Object URL(原圖 URL 在 _cgUrlCache 仍可能被使用,不在此 revoke)
  for (const url of _cgLibraryThumbUrls) vnsRevokeCgUrl(url);
  _cgLibraryThumbUrls = [];
}

async function renderCgLibraryGrid() {
  // 任務 4:CG 庫變動(新增 / 刪除)後同步空狀態「選擇 CG」按鈕禁用狀態
  if (typeof updateEmptyStateButtons === "function") updateEmptyStateButtons();
  const grid = document.getElementById("cgLibraryGrid");
  const empty = document.getElementById("cgLibraryEmpty");
  if (!grid) return;
  // 先釋放前一輪縮圖
  for (const url of _cgLibraryThumbUrls) vnsRevokeCgUrl(url);
  _cgLibraryThumbUrls = [];
  grid.innerHTML = "";

  const items = await vnsListCgsWithThumbUrls();
  if (!items.length) {
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  for (const it of items) {
    if (it.thumbUrl) _cgLibraryThumbUrls.push(it.thumbUrl);
    const tile = document.createElement("div");
    tile.className = "cg-library-tile";

    const img = document.createElement("img");
    img.alt = it.name || "";
    img.loading = "lazy";
    img.src = it.thumbUrl || "";
    tile.appendChild(img);

    const meta = document.createElement("div");
    meta.className = "cg-library-tile-meta";
    const name = document.createElement("span");
    name.className = "cg-library-tile-name";
    name.textContent = it.name || "(未命名)";
    name.title = it.name || "";
    const size = document.createElement("span");
    size.className = "cg-library-tile-size";
    size.textContent = vnsFmtBytes(it.fileSize);
    meta.appendChild(name);
    meta.appendChild(size);
    tile.appendChild(meta);

    const del = document.createElement("button");
    del.className = "cg-library-tile-delete";
    del.type = "button";
    del.title = "刪除這張 CG";
    del.setAttribute("aria-label", "刪除 CG");
    del.textContent = "×";
    del.addEventListener("click", async (e) => {
      e.stopPropagation();
      // 當前(記憶體中)專案有多少幕引用此 CG
      const affected = (state.simpleCards || []).filter(s =>
        s && s.cg && (s.cg.cgId === it.id || s.cg.name === it.id));
      const ok = await inlineConfirm({
        title: "⚠ 刪除這張 CG?",
        message: (affected.length > 0
          ? `這張 CG 被 ${affected.length} 張幕使用。\n刪除後這些幕會變成「無 CG」,可重新指定。\n\n`
          : "") + "此操作無法復原。",
        okText: "確認刪除",
        cancelText: "取消",
        danger: true,
      });
      if (!ok) return;
      const r = await vnsDeleteCgAndDereference(it.id);
      _cgUrlCache.delete(it.id);
      // 同步解除「當前記憶體專案」中幕的引用(IDB 內其他專案由上面的函式處理)
      affected.forEach(s => { s.cg = { type: "none" }; });
      if (affected.length) saveToStorage();
      showToast(r.affectedProjects > 0
        ? `已刪除(影響 ${r.affectedProjects} 個專案)`
        : "已刪除", "info");
      await renderCgLibraryGrid();
      renderSimpleSlideList();
      renderSimpleEditor();
    });
    tile.appendChild(del);

    tile.addEventListener("click", () => {
      attachCgIdToCurrentSlide(it.id);
      closeCgLibraryModal();
    });
    grid.appendChild(tile);
  }
}

export {
  openCgLibraryModal,
  closeCgLibraryModal,
  renderCgLibraryGrid,
};
