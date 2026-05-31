// shared/font-system.js — 由 index.js 搬出,內容未改動。

function renderFontPreviewList() {
  const list = document.getElementById("fontPreviewList");
  if (!list) return;
  list.innerHTML = "";

  FONT_PRESETS.forEach(f => {
    const item = document.createElement("div");
    item.className = "font-preview-item";
    item.dataset.font = f.id;

    const nameEl = document.createElement("span");
    nameEl.className = "font-preview-name";
    nameEl.textContent = f.name;
    if (f.stack) {
      nameEl.style.fontFamily = f.stack;
      if (f.weight) nameEl.style.fontWeight = f.weight;
    }

    const sample = document.createElement("div");
    sample.className = "font-preview-sample";
    sample.textContent = f.preview;
    if (f.stack) {
      sample.style.fontFamily = f.stack;
      if (f.weight) sample.style.fontWeight = f.weight;
    }

    // 檢測該字體是否已載入,未載入時加上 loading class
    if (f.stack && f.id !== "default") {
      const primaryFont = f.stack.split(",")[0].trim().replace(/^["']|["']$/g, "");
      if (document.fonts && document.fonts.check) {
        try {
          const isLoaded = document.fonts.check(`16px "${primaryFont}"`);
          if (!isLoaded) {
            sample.classList.add("font-loading");
            document.fonts.load(`16px "${primaryFont}"`).then(() => {
              sample.classList.remove("font-loading");
            }).catch(() => {
              sample.classList.remove("font-loading");
              sample.classList.add("font-failed");
            });
          }
        } catch (err) {
          // 字體名含特殊字元時可能拋錯,忽略
        }
      }
    }

    item.appendChild(nameEl);
    item.appendChild(sample);
    list.appendChild(item);
  });
}

export {
  renderFontPreviewList,
};
