// shared/utils.js — 由 index.js 搬出(階段 3-H),內容未改動

function escHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function ensureCaretVisible(ta, caretPos, behavior = "nearest") {
  if (!ta) return;
  if (ta.dataset.composing === "true") return; // 輸入法組字中,不要捲動(L4)
  if (caretPos == null) caretPos = ta.selectionStart;

  const cs = getComputedStyle(ta);
  const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
  const paddingTop = parseFloat(cs.paddingTop) || 0;

  const textBeforeCaret = ta.value.substring(0, caretPos);
  const lineNumber = textBeforeCaret.split("\n").length - 1; // 0-based
  const caretY = paddingTop + lineNumber * lineHeight;

  const viewportTop = ta.scrollTop;
  const viewportBottom = viewportTop + ta.clientHeight;
  const margin = lineHeight * 2;

  if (behavior === "center") {
    ta.scrollTop = caretY - ta.clientHeight / 2;
  } else {
    if (caretY < viewportTop + margin) {
      ta.scrollTop = caretY - margin;
    } else if (caretY > viewportBottom - margin) {
      ta.scrollTop = caretY - ta.clientHeight + margin;
    }
  }

  ta.scrollTop = Math.max(0, Math.min(ta.scrollTop, ta.scrollHeight - ta.clientHeight));
}

function _shEsc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fmtBytes(n) {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / (1024 * 1024)).toFixed(2) + " MB";
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function downscaleImage(dataUrl, maxDim = 1024) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ow = img.naturalWidth, oh = img.naturalHeight;
      const scale = Math.min(1, maxDim / Math.max(ow, oh));
      if (scale === 1) {
        resolve({ dataUrl, width: ow, height: oh, original: { width: ow, height: oh }, scaled: false });
        return;
      }
      const width = Math.round(ow * scale);
      const height = Math.round(oh * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      const isPng = dataUrl.startsWith("data:image/png");
      const out = canvas.toDataURL(isPng ? "image/png" : "image/jpeg", 0.88);
      resolve({ dataUrl: out, width, height, original: { width: ow, height: oh }, scaled: true });
    };
    img.onerror = () => resolve({ dataUrl, width: 0, height: 0, original: { width: 0, height: 0 }, scaled: false });
    img.src = dataUrl;
  });
}

function describeScale(result) {
  if (!result || !result.scaled) {
    return result && result.width ? `${result.width}×${result.height}` : "";
  }
  return `已壓縮 ${result.original.width}×${result.original.height} → ${result.width}×${result.height}`;
}

function attachDropTarget(el, handler) {
  let depth = 0;
  el.addEventListener("dragenter", (e) => {
    if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes("Files")) return;
    e.preventDefault();
    depth++;
    el.classList.add("drag-over");
  });
  el.addEventListener("dragover", (e) => {
    if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  });
  el.addEventListener("dragleave", (e) => {
    depth = Math.max(0, depth - 1);
    if (depth === 0) el.classList.remove("drag-over");
  });
  el.addEventListener("drop", async (e) => {
    e.preventDefault();
    depth = 0;
    el.classList.remove("drag-over");
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      showToast("請拖放圖片檔（JPG / PNG / WebP）", "warn");
      return;
    }
    await handler(file);
  });
}

function hexToRgb(hex) {
  const m = String(hex || "").match(/^#([0-9a-f]{6})$/i);
  if (!m) return { r: 13, g: 7, b: 22 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function timestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export {
  escHtml,
  ensureCaretVisible,
  _shEsc,
  fmtBytes,
  readFileAsDataURL,
  downscaleImage,
  describeScale,
  attachDropTarget,
  hexToRgb,
  timestamp,
};
