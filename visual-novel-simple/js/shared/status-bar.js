// shared/status-bar.js — 由 index.js 搬出,內容未改動。底部狀態列。__lastSaveTime 為內部狀態(不匯出)。

function updateStatusBar() {
  const sizeEl = document.getElementById("statusExportSize");
  const assetEl = document.getElementById("statusAssetCount");
  if (sizeEl) sizeEl.textContent = fmtBytes(estimateExportSize());
  if (assetEl) {
    const charCount = state.characters.length;
    const portraitCount = state.characters.reduce((a, c) => a + Object.keys(c.portraits || {}).length, 0);
    const bgImgCount = Object.values(state.backgrounds).filter(b => b.type === "image").length;
    const cgCount = Object.values(state.cgs || {}).filter(c => c && c.dataUrl).length;
    assetEl.textContent = `${charCount} 角色 · ${portraitCount + bgImgCount + cgCount} 張`;
  }
}

// 任務 5:工具列左側六種狀態指示。狀態切換的決策(cached vs unsaved)由呼叫端
// 視「是否已存到本地檔案」決定(vnsHasSavedFile / vnsSavedFileName 由任務 1 提供)。
// 分層降級:Chrome / Edge 走「已儲存 💾」,Firefox / Safari 走「已下載 📥」;
// 「有未儲存變更」也依瀏覽器顯示 💾⭐ / 📥⭐。
const EDITOR_STATUS_MAP = {
  ready:      { hidden: true,  icon: "",     text: "",           cls: "" },
  editing:    { hidden: false, icon: "○",    text: "編輯中…",     cls: "is-editing" },
  cached:     { hidden: false, icon: "⭐",   text: "暫存瀏覽器",   cls: "is-cached",
               tip: "資料已暫存在瀏覽器,可隨時恢復。建議按『儲存』保存到本地檔案。" },
  saved:      { hidden: false, icon: "💾",   text: "已儲存",       cls: "is-saved" },
  downloaded: { hidden: false, icon: "📥",   text: "已下載",       cls: "is-saved" },
  unsaved:    { hidden: false, icon: "💾⭐", text: "有未儲存變更", cls: "is-unsaved" },
  error:      { hidden: false, icon: "⚠",    text: "儲存失敗",     cls: "is-error" },
};

let __editorStatus = "ready";

// 是否為支援 File System Access 的瀏覽器(Chrome / Edge)
function _editorStatusHasFsa() {
  if (typeof state !== "undefined" && state.browserCapabilities
      && typeof state.browserCapabilities.fileSystemAccess === "boolean") {
    return state.browserCapabilities.fileSystemAccess;
  }
  return typeof vnsFileSystemSupported === "function" && vnsFileSystemSupported();
}

function setEditorStatus(s) {
  const el = document.getElementById("editorStatus");
  if (!el) return;
  const m = EDITOR_STATUS_MAP[s] || EDITOR_STATUS_MAP.ready;
  __editorStatus = EDITOR_STATUS_MAP[s] ? s : "ready";
  const hasFsa = _editorStatusHasFsa();
  el.hidden = m.hidden;
  el.className = "editor-status" + (m.cls ? " " + m.cls : "");
  const iconEl = document.getElementById("editorStatusIcon");
  const textEl = document.getElementById("editorStatusText");
  // 「有未儲存變更」依瀏覽器顯示 💾⭐(Chrome / Edge)或 📥⭐(Firefox / Safari)
  const icon = (s === "unsaved" && !hasFsa) ? "📥⭐" : m.icon;
  if (iconEl) iconEl.textContent = icon;
  if (textEl) textEl.textContent = m.text;
  const fn = (typeof vnsSavedFileName === "function") ? vnsSavedFileName() : "";
  if (s === "saved") {
    el.title = fn ? `資料已儲存到本地檔案:${fn}` : "資料已儲存到本地檔案";
  } else if (s === "downloaded") {
    el.title = fn ? `最近一次下載:${fn}。下次按『儲存』會再下載新檔。`
                  : "下次按『儲存』會再下載新檔。";
  } else if (s === "unsaved") {
    el.title = hasFsa ? "有編輯尚未存到本地檔案,按『儲存』更新。"
                      : "有編輯尚未下載,按『儲存』下載最新版本。";
  } else {
    el.title = m.tip || "";
  }
}

function getEditorStatus() {
  return __editorStatus;
}

let __lastSaveTime = Date.now();

function updateRecentSaveTime() {
  __lastSaveTime = Date.now();
  refreshSaveTimeDisplay();
}

function refreshSaveTimeDisplay() {
  const el = document.getElementById("statusRecentSaveTime");
  if (!el) return;
  const diff = Date.now() - __lastSaveTime;
  if (diff < 5000) el.textContent = "剛剛";
  else if (diff < 60000) el.textContent = `${Math.floor(diff / 1000)} 秒前`;
  else if (diff < 3600000) el.textContent = `${Math.floor(diff / 60000)} 分鐘前`;
  else el.textContent = `${Math.floor(diff / 3600000)} 小時前`;
}

export {
  updateStatusBar,
  updateRecentSaveTime,
  refreshSaveTimeDisplay,
  setEditorStatus,
  getEditorStatus,
};
