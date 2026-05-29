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

// 任務 5:工具列左側五種狀態指示。狀態切換的決策(cached vs unsaved)由呼叫端
// 視「是否已存到本地檔案」決定(vnsHasSavedFile / vnsSavedFileName 由任務 1 提供)。
const EDITOR_STATUS_MAP = {
  ready:   { hidden: true,  icon: "",     text: "",           cls: "" },
  editing: { hidden: false, icon: "○",    text: "編輯中…",     cls: "is-editing" },
  cached:  { hidden: false, icon: "⭐",   text: "暫存瀏覽器",   cls: "is-cached",
             tip: "資料已暫存在瀏覽器,可隨時恢復。建議按『儲存』保存到本地檔案。" },
  saved:   { hidden: false, icon: "💾",   text: "已儲存",       cls: "is-saved" },
  unsaved: { hidden: false, icon: "💾⭐", text: "有未儲存變更", cls: "is-unsaved",
             tip: "有編輯尚未存到本地檔案,按『儲存』更新。" },
  error:   { hidden: false, icon: "⚠",    text: "儲存失敗",     cls: "is-error" },
};

let __editorStatus = "ready";

function setEditorStatus(s) {
  const el = document.getElementById("editorStatus");
  if (!el) return;
  const m = EDITOR_STATUS_MAP[s] || EDITOR_STATUS_MAP.ready;
  __editorStatus = EDITOR_STATUS_MAP[s] ? s : "ready";
  el.hidden = m.hidden;
  el.className = "editor-status" + (m.cls ? " " + m.cls : "");
  const iconEl = document.getElementById("editorStatusIcon");
  const textEl = document.getElementById("editorStatusText");
  if (iconEl) iconEl.textContent = m.icon;
  if (textEl) textEl.textContent = m.text;
  if (s === "saved") {
    const fn = (typeof vnsSavedFileName === "function") ? vnsSavedFileName() : "";
    el.title = fn ? `資料已儲存到本地檔案:${fn}` : "資料已儲存到本地檔案";
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
