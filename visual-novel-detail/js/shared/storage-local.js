// shared/storage-local.js — 由 index.js 搬出(階段 3-C1),內容未改動
// 對外相依(state / migrate* / vns* / showToast / fmtBytes 等)沿用全域(window)取得,
// 由 main.js 掛載或 index.js(classic)提供。

const STORAGE_KEY = "otome_studio_v1";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const STORAGE_WARN_BYTES = 4 * 1024 * 1024;

function saveToStorage() {
  setSaveIndicator("saving");
  try {
    const payload = {
      v: 1,
      script: state.script,
      characters: state.characters,
      // backgrounds: only save image-type ones, presets are static
      backgrounds: Object.fromEntries(
        Object.entries(state.backgrounds).filter(([k, v]) => v.type === "image")
      ),
      bgOrder: state.bgOrder,
      cgs: _stripCgDataUrls(state.cgs),
      cgOrder: state.cgOrder,
      ratio: state.ratio,
      dialogStyle: state.dialogStyle,
      gameUI: state.gameUI,
      lightMode: state.lightMode,
      styleDefaults: state.styleDefaults,
      fontSizes: state.fontSizes,
      style: state.style,
      customVariants: state.customVariants,
      loveInitial: state.loveInitial,
      mode: state.mode,
      simpleCards: state.simpleCards,
      simpleCurrentSlideId: state.simpleCurrentSlideId,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    updateStorageMeter();
    setSaveIndicator("saved");
    if (typeof updateStatusBar === "function") updateStatusBar();
    if (typeof updateRecentSaveTime === "function") updateRecentSaveTime();
    // 同時排程寫入 IndexedDB(3 秒 debounce,不阻塞使用者操作)
    if (typeof vnsScheduleAutoSave === "function") vnsScheduleAutoSave();
    // 背景把新上傳的 CG 鏡到 cg_library(localStorage 已不含 dataUrl)
    if (typeof _scheduleMirrorCgsToLibrary === "function") _scheduleMirrorCgsToLibrary();
    return true;
  } catch (e) {
    setSaveIndicator("error");
    showToast("⚠ 儲存空間已滿,最近上傳的圖片無法保存(重整會丟失)", "warn", 4000);
    return false;
  }
}

function setSaveIndicator(state) {
  // 任務 5:舊的四態(saving / saved / dirty / error)轉接到新的五種狀態指示。
  //   - 「暫存瀏覽器 / 已儲存 / 有未儲存變更」由 IDB 自動存檔與本地檔案存檔的完成點決定;
  //   - 此處只負責「編輯中 / 儲存失敗」這類即時回饋。
  //   - "saved"(localStorage 寫入完成)不立即改狀態,等 IDB 自動存檔完成才落到「暫存瀏覽器」。
  if (typeof setEditorStatus !== "function") return;
  const hasFile = typeof vnsHasSavedFile === "function" && !!vnsHasSavedFile();
  if (state === "error") {
    setEditorStatus("error");
  } else if (state === "saving" || state === "dirty") {
    setEditorStatus(hasFile ? "unsaved" : "editing");
  }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const payload = JSON.parse(raw);
    if (payload.script !== undefined) state.script = payload.script;
    if (Array.isArray(payload.characters)) {
      state.characters = payload.characters.map(migrateCharacter);
      ensureProtagonistExists();
    }
    // merge backgrounds: keep presets, add saved image bgs
    state.backgrounds = { ...SAMPLE_BACKGROUNDS };
    if (payload.backgrounds) {
      for (const [k, v] of Object.entries(payload.backgrounds)) {
        state.backgrounds[k] = v;
      }
    }
    if (Array.isArray(payload.bgOrder)) state.bgOrder = payload.bgOrder;
    if (payload.cgs && typeof payload.cgs === "object") state.cgs = payload.cgs;
    if (Array.isArray(payload.cgOrder)) state.cgOrder = payload.cgOrder;
    if (payload.ratio) state.ratio = payload.ratio;
    if (payload.dialogStyle && typeof payload.dialogStyle === "object") {
      state.dialogStyle = migrateDialogStyle({
        shape: typeof payload.dialogStyle.shape === "string" ? payload.dialogStyle.shape : DEFAULT_DIALOG_STYLE.shape,
        color: typeof payload.dialogStyle.color === "string" ? payload.dialogStyle.color : DEFAULT_DIALOG_STYLE.color,
        opacity: typeof payload.dialogStyle.opacity === "number" ? payload.dialogStyle.opacity : DEFAULT_DIALOG_STYLE.opacity,
      });
    }
    state.gameUI = migrateGameUI(payload.gameUI);
    state.lightMode = LIGHT_MODES.includes(payload.lightMode) ? payload.lightMode : DEFAULT_LIGHT_MODE;
    if (payload.styleDefaults && typeof payload.styleDefaults === "object") {
      for (const k of ["narration", "inner", "dialog"]) {
        const d = payload.styleDefaults[k];
        if (d && typeof d === "object") {
          // 舊版有 size: "large"/"small",新版字級獨立到 fontSizes,size 丟棄
          state.styleDefaults[k] = {
            font: typeof d.font === "string" ? d.font : "",
          };
        }
      }
    }
    if (payload.fontSizes && typeof payload.fontSizes === "object") {
      state.fontSizes = migrateFontSizes(payload.fontSizes);
    }
    if (payload.style && typeof payload.style === "object") {
      state.style = migrateStyle(payload.style);
    }
    state.customVariants = migrateCustomVariants(payload.customVariants);
    if (payload.loveInitial && typeof payload.loveInitial === "object") {
      state.loveInitial = {};
      for (const [k, v] of Object.entries(payload.loveInitial)) {
        const n = Number(v);
        if (Number.isFinite(n)) state.loveInitial[k] = Math.max(0, Math.min(100, Math.round(n)));
      }
    }
    if (payload.mode === "simple" || payload.mode === "detail") state.mode = payload.mode;
    if (Array.isArray(payload.simpleCards)) state.simpleCards = migrateSimpleCards(payload.simpleCards);
    if (typeof payload.simpleCurrentSlideId === "string") state.simpleCurrentSlideId = payload.simpleCurrentSlideId;
    return true;
  } catch (e) {
    console.warn("Failed to load from storage:", e);
    return false;
  }
}

function getStorageUsage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || "";
    return raw.length * 2; // rough: 2 bytes per char (UTF-16)
  } catch { return 0; }
}

function updateStorageMeter() {
  const used = getStorageUsage();
  const charCount = state.characters.length;
  const portraitCount = state.characters.reduce((a, c) => a + Object.keys(c.portraits || {}).length, 0);
  const bgImgCount = Object.values(state.backgrounds).filter(b => b.type === "image").length;
  const cgCount = Object.values(state.cgs || {}).filter(c => c && c.dataUrl).length;
  const imgCount = portraitCount + bgImgCount + cgCount;

  const meter = document.getElementById("storageMeter");
  if (meter) {
    meter.innerHTML = `儲存:<strong>${fmtBytes(used)}</strong> · ${charCount} 角色 · ${imgCount} 張圖`;
    meter.style.color = used > STORAGE_WARN_BYTES ? "var(--danger)" : "";
  }

  // topbar dot — only surfaces once usage crosses 50% (otherwise hidden)
  const dot = document.getElementById("storageDot");
  if (dot) {
    dot.classList.remove("warn", "danger");
    const pct = used / (5 * 1024 * 1024);
    if (pct < 0.5) {
      dot.style.display = "none";
    } else {
      dot.style.display = "block";
      if (pct >= 0.8) dot.classList.add("danger");
      else dot.classList.add("warn");
    }
    dot.title = `本機儲存:${fmtBytes(used)} / 約 5 MB · ${charCount} 角色 · ${imgCount} 張圖`;
  }
}

function _stripCgDataUrls(cgs) {
  const out = {};
  if (!cgs || typeof cgs !== "object") return out;
  for (const [k, v] of Object.entries(cgs)) {
    if (!v || typeof v !== "object") continue;
    out[k] = {
      cgId: v.cgId || null,
      name: v.name || k,
    };
  }
  return out;
}

export {
  STORAGE_KEY,
  MAX_FILE_BYTES,
  STORAGE_WARN_BYTES,
  saveToStorage,
  setSaveIndicator,
  loadFromStorage,
  getStorageUsage,
  updateStorageMeter,
  _stripCgDataUrls,
};
