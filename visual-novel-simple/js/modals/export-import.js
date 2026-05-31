// modals/export-import.js — 由 index.js 搬出(階段 3-F),內容未改動

function vnsCollectReferencedCgIds(data) {
  const ids = new Set();
  if (!data || typeof data !== "object") return ids;
  if (Array.isArray(data.slides)) {
    for (const s of data.slides) {
      if (s && typeof s.cgId === "string") ids.add(s.cgId);
    }
  }
  // 簡易版:幕的 CG 存在 s.cg.cgId
  if (Array.isArray(data.simpleCards)) {
    for (const s of data.simpleCards) {
      if (s && typeof s.cgId === "string") ids.add(s.cgId);
      if (s && s.cg && typeof s.cg.cgId === "string") ids.add(s.cg.cgId);
    }
  }
  return ids;
}

// 匯入時:把簡易版幕的 cg.cgRef(zip 路徑)轉成新 cgId;對應不到圖片就清空 CG 引用,
// 讓該幕仍能正確載入 / 點選(任務 1、2)。需在 applyProjectDataToState(會 migrate)之前呼叫。
function _vnsRemapSimpleCardsCg(newData, pathToNewId) {
  if (!newData || !Array.isArray(newData.simpleCards)) return;
  for (const s of newData.simpleCards) {
    if (!s) continue;
    if (s.cgRef && pathToNewId[s.cgRef]) s.cgId = pathToNewId[s.cgRef];
    delete s.cgRef;
    if (s.cg && typeof s.cg === "object") {
      if (s.cg.cgRef && pathToNewId[s.cg.cgRef]) {
        s.cg.cgId = pathToNewId[s.cg.cgRef];
        s.cg.type = "library";
      } else if (s.cg.type === "library" || s.cg.cgId) {
        s.cg = { type: "none" };   // 找不到對應圖片 → 清空(幕仍可載入)
      }
      if (s.cg) delete s.cg.cgRef;
    }
  }
}

function vnsCompareSemver(a, b) {
  // 比較 major.minor.patch;a=b 回 0;a<b 回 -1;a>b 回 1
  const pa = String(a || "0").split(".").map(n => parseInt(n, 10) || 0);
  const pb = String(b || "0").split(".").map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
  }
  return 0;
}

function buildExportPayload() {
  return {
    version: 3,
    app: "otome-studio",
    exportedAt: new Date().toISOString(),
    script: state.script,
    characters: state.characters,
    backgrounds: Object.fromEntries(
      Object.entries(state.backgrounds).filter(([k]) => k !== "default")
    ),
    bgOrder: state.bgOrder,
    cgs: state.cgs,
    cgOrder: state.cgOrder,
    ratio: state.ratio,
    dialogStyle: state.dialogStyle,
    gameUI: state.gameUI,
    lightMode: state.lightMode,
  };
}

async function applyImportedPayload(data) {
  try {
    // Determine format:
    // - otome-studio export: has app === "otome-studio"
    // - 劇本速寫: { version: 1, script, characters: [...] } without "app"
    const isOtome = data.app === "otome-studio";
    const isSpeedDraft = !isOtome && data.script !== undefined && Array.isArray(data.characters);

    if (!isOtome && !isSpeedDraft) {
      throw new Error("無法識別的 JSON 格式");
    }

    const ok = await inlineConfirm({
      title: isOtome ? "匯入 Visual Novel Studio 專案?" : "匯入「劇本速寫」檔案?",
      message: isOtome
        ? "會覆蓋目前所有資料：劇本、角色及立繪、背景。\n\n建議先按 📤 備份目前的專案。"
        : "會覆蓋目前的劇本和角色設定。\n背景和立繪圖片不受影響。\n\n建議先按 📤 備份目前的專案。",
      okText: "覆蓋匯入",
      danger: true,
    });
    if (!ok) return;

    if (isOtome) {
      // full import
      state.script = data.script || "";
      state.characters = (Array.isArray(data.characters) ? data.characters : []).map(migrateCharacter);
      // ensure each character has portraits object
      state.characters.forEach(c => { if (!c.portraits) c.portraits = {}; if (!c.emotions) c.emotions = []; });
      // merge presets + imported
      state.backgrounds = { ...SAMPLE_BACKGROUNDS };
      if (data.backgrounds) {
        for (const [k, v] of Object.entries(data.backgrounds)) {
          state.backgrounds[k] = v;
        }
      }
      state.bgOrder = Array.isArray(data.bgOrder) ? data.bgOrder : ["黃昏", "教室", "夜晚"];
      state.cgs = (data.cgs && typeof data.cgs === "object") ? data.cgs : {};
      state.cgOrder = Array.isArray(data.cgOrder) ? data.cgOrder : Object.keys(state.cgs);
      if (data.ratio) state.ratio = data.ratio;
      if (data.dialogStyle && typeof data.dialogStyle === "object") {
        state.dialogStyle = migrateDialogStyle(data.dialogStyle);
      }
      state.gameUI = migrateGameUI(data.gameUI);
      state.lightMode = LIGHT_MODES.includes(data.lightMode) ? data.lightMode : DEFAULT_LIGHT_MODE;
      if (data.fontSizes) state.fontSizes = migrateFontSizes(data.fontSizes);
      if (data.style) {
        state.style = migrateStyle(data.style);
      }
      state.customVariants = migrateCustomVariants(data.customVariants);
      if (data.loveInitial && typeof data.loveInitial === "object") {
        state.loveInitial = {};
        for (const [k, v] of Object.entries(data.loveInitial)) {
          const n = Number(v);
          if (Number.isFinite(n)) state.loveInitial[k] = Math.max(0, Math.min(100, Math.round(n)));
        }
      }
      // 防禦性：舊版 export 無 hideGameUI 欄位（state.stage.cg 通常由
      // computeStageStateAt 重算，這裡僅保險）
      if (state.stage.cg && state.stage.cg.hideGameUI === undefined) {
        state.stage.cg.hideGameUI = state.stage.cg.hideDialog || false;
      }
    } else {
      // speed-draft: just script + characters (preserve existing portraits if name matches)
      const existingByName = new Map(state.characters.map(c => [c.name, c]));
      state.script = data.script || "";
      state.characters = data.characters.map((c, idx) => {
        const existing = existingByName.get(c.name);
        return migrateCharacter({
          id: existing ? existing.id : ("ch_imp_" + Date.now() + "_" + idx),
          name: c.name,
          kind: c.kind,
          color: c.color || "#c4a265",
          emotions: Array.isArray(c.emotions) ? c.emotions : ["普通"],
          portraits: existing ? existing.portraits : {},
        });
      });
    }
    ensureProtagonistExists();

    // re-render everything
    els.scriptArea.value = state.script;
    setRatio(state.ratio);
    applyDialogStyle();
    applyGameUI();
    applyFontSizes();
    syncStyleDefaultsUI();
    applyStylePreset(state.style.preset, state.style.variant, { skipSave: true });
    applyAnimationsToggle(state.style.animationsEnabled);
    renderStylePresetGrid();
    state.currentIndex = 0;
    reparseAndRender(true);
    saveToStorage();
    showToast(isOtome ? "✨ 專案已匯入" : "✨ 劇本速寫已匯入", "success", 3000);
    if (typeof pushRecent === "function") pushRecent(data);
  } catch (err) {
    console.error(err);
    showToast("匯入失敗:" + err.message, "warn", 4000);
  }
}

async function exportCurrentProject() {
  if (typeof JSZip === "undefined") {
    showToast("JSZip 未載入,無法匯出", "warn");
    return;
  }
  if (vnsDbFailed || !state.currentProjectId) {
    showToast("沒有可匯出的專案", "warn");
    return;
  }
  const project = await vnsGetProject(state.currentProjectId);
  if (!project) { showToast("找不到當前專案", "warn"); return; }

  const cgIds = vnsCollectReferencedCgIds(project.data);
  // 預估大小(僅 CG 部分,JSON 量小忽略)
  let estBytes = 0;
  const cgInfos = [];
  for (const cgId of cgIds) {
    const cg = await vnsGetCg(cgId);
    if (cg && cg.blob) {
      estBytes += cg.fileSize || cg.blob.size || 0;
      cgInfos.push(cg);
    }
  }

  const confirmed = await inlineConfirm({
    title: "匯出專案",
    message: `專案:${project.name}\n模式:${project.mode === "simple" ? "簡易模式" : "細節模式"}\nCG 圖片:${cgInfos.length} 張\n預估大小:${vnsFmtBytes(estBytes + 4096)}\n\n會匯出 .vns 檔案到下載資料夾。`,
    okText: "匯出 .vns",
  });
  if (!confirmed) return;

  showToast("正在打包…", "info", 2000);

  try {
    const zip = new JSZip();

    // 1. cgs 資料夾:把 referenced CGs 寫進去,記錄路徑供 project.json 引用
    const cgFolder = zip.folder("cgs");
    const idToPath = {};
    for (const cg of cgInfos) {
      const ext = (cg.mimeType && cg.mimeType.split("/")[1]) || "bin";
      const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
      const filename = `${cg.id}.${safeExt}`;
      cgFolder.file(filename, cg.blob);
      idToPath[cg.id] = `cgs/${filename}`;
    }

    // 2. project.json:slides 的 cgId 同時保留並加上 cgRef 指向 zip 內路徑
    const exportData = JSON.parse(JSON.stringify(project.data || {}));
    if (Array.isArray(exportData.slides)) {
      for (const s of exportData.slides) {
        if (s && s.cgId && idToPath[s.cgId]) {
          s.cgRef = idToPath[s.cgId];
        }
      }
    }
    zip.file("project.json", JSON.stringify(exportData, null, 2));

    // 3. settings.json:樣式 + 字體 + custom variant(沿用 localStorage 的子集)
    const settings = {
      dialogStyle: state.dialogStyle,
      styleDefaults: state.styleDefaults,
      fontSizes: state.fontSizes,
      style: state.style,
      customVariants: state.customVariants,
    };
    zip.file("settings.json", JSON.stringify(settings, null, 2));

    // 4. manifest.json:版本、metadata
    const manifest = {
      formatVersion: VNS_EXPORT_FORMAT_VERSION,
      appName: "Visual Novel Studio",
      appVersion: VNS_APP_VERSION,
      exportedAt: vnsNow(),
      projectName: project.name,
      mode: project.mode,
      slideCount: Array.isArray(project.data && project.data.slides) ? project.data.slides.length : 0,
      cgCount: cgInfos.length,
    };
    zip.file("manifest.json", JSON.stringify(manifest, null, 2));

    // 5. 產 Blob + 觸發下載
    const blob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 4 },
    });
    const safeName = (project.name || "project").replace(/[\\/:*?"<>|]/g, "_");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeName}.vns.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    showToast(`已匯出 ${safeName}.vns.zip(${vnsFmtBytes(blob.size)})`, "success", 3000);
  } catch (e) {
    console.error("[exportCurrentProject]", e);
    showToast("匯出失敗:" + (e.message || e), "warn", 4000);
  }
}

async function parseVnsZip(file) {
  if (typeof JSZip === "undefined") throw new Error("JSZip 未載入");
  const zip = await JSZip.loadAsync(file);

  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) throw new Error("不是合法的 .vns 檔案(缺少 manifest.json)");
  const manifestText = await manifestFile.async("string");
  let manifest;
  try { manifest = JSON.parse(manifestText); } catch (e) { throw new Error("manifest.json 格式錯誤"); }
  if (manifest.appName !== "Visual Novel Studio") {
    throw new Error("此檔案不是 Visual Novel Studio 專案");
  }
  // 版本相容性:major 相同才可載入;更新的 major 直接拒絕
  const cur = VNS_EXPORT_FORMAT_VERSION;
  const cmp = vnsCompareSemver(manifest.formatVersion, cur);
  if (cmp > 0) {
    throw new Error(`此檔案由較新版本(${manifest.formatVersion})匯出,請更新工具後再試。`);
  }

  const projectFile = zip.file("project.json");
  if (!projectFile) throw new Error("缺少 project.json");
  const projectData = JSON.parse(await projectFile.async("string"));

  let settings = null;
  const settingsFile = zip.file("settings.json");
  if (settingsFile) {
    try { settings = JSON.parse(await settingsFile.async("string")); } catch (e) {}
  }

  // 收集 cgs/ 內的所有檔案
  const cgs = [];
  const cgFolder = zip.folder("cgs");
  if (cgFolder) {
    const entries = [];
    cgFolder.forEach((relPath, entry) => {
      if (!entry.dir) entries.push({ relPath, entry });
    });
    for (const { relPath, entry } of entries) {
      const blob = await entry.async("blob");
      const mime = blob.type || "image/jpeg";
      cgs.push({
        path: "cgs/" + relPath,
        filename: relPath,
        blob: new Blob([blob], { type: mime }),
      });
    }
  }

  return { manifest, projectData, settings, cgs };
}

async function confirmAndImport(file) {
  let pkg;
  try {
    pkg = await parseVnsZip(file);
  } catch (e) {
    showToast("匯入失敗:" + (e.message || e), "warn", 5000);
    return;
  }

  const m = pkg.manifest;
  const importedAt = m.exportedAt ? formatRelTime(m.exportedAt) : "未知";
  const ok = await inlineConfirm({
    title: "匯入專案",
    message: `專案:${m.projectName || "未命名"}\n模式:${m.mode === "simple" ? "簡易模式" : "細節模式"}\n張數:${m.slideCount || 0}\nCG:${pkg.cgs.length} 張\n匯出於:${importedAt}\n\n會在 IndexedDB 新增一筆專案(不覆蓋當前)。`,
    okText: "確認匯入",
  });
  if (!ok) return;

  // 配額預檢
  const totalSize = pkg.cgs.reduce((s, c) => s + (c.blob.size || 0), 0);
  if (!(await vnsCanStoreFile(totalSize))) {
    showToast("瀏覽器空間不足以匯入此專案", "warn", 5000);
    return;
  }

  showToast(`匯入中…(${pkg.cgs.length} 張 CG)`, "info", 3000);

  try {
    // 1. 路徑 → 新 cgId 對照表(每張 CG 一個新 id,避免和現有衝突)
    const pathToNewId = {};
    for (const cg of pkg.cgs) {
      let thumb = null;
      try { thumb = await vnsCreateThumbnail(cg.blob); } catch (e) {}
      const newId = await vnsAddCg(cg.blob, cg.filename, thumb);
      if (newId) pathToNewId[cg.path] = newId;
    }

    // 2. 重寫 projectData 中的 cgId / cgRef 指向新 id
    const newData = JSON.parse(JSON.stringify(pkg.projectData));
    if (Array.isArray(newData.slides)) {
      for (const s of newData.slides) {
        if (!s) continue;
        // 優先用 cgRef(zip 內路徑)轉新 id;若沒有則保留(舊資料相容)
        if (s.cgRef && pathToNewId[s.cgRef]) {
          s.cgId = pathToNewId[s.cgRef];
        }
        delete s.cgRef;  // 不要把這個欄位留在 IDB
      }
    }
    _vnsRemapSimpleCardsCg(newData, pathToNewId);   // 簡易版幕 CG 重新對應

    // 3. 寫入 projects store
    const projectId = await vnsAddProject(m.projectName || "匯入的專案", m.mode || "simple", newData);
    if (!projectId) { showToast("寫入專案失敗", "warn"); return; }

    showToast(`✓ 已匯入「${m.projectName}」(${pkg.cgs.length} 張 CG)`, "success", 3000);
    // 自動切到新匯入的專案
    await switchToProject(projectId);
    // 重整 projects modal 若開著
    renderProjectsList();
  } catch (e) {
    console.error("[confirmAndImport]", e);
    showToast("匯入過程出錯:" + (e.message || e), "warn", 4000);
  }
}

function _vnsLooksLikeVnsFile(file) {
  if (!file) return false;
  const name = (file.name || "").toLowerCase();
  return name.endsWith(".vns") || name.endsWith(".vns.zip");
}

function estimateExportSize() {
  try {
    const payload = {
      script: state.script,
      characters: state.characters,
      backgrounds: state.backgrounds,
      cgs: state.cgs,
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
    };
    return JSON.stringify(payload).length * 2;  // UTF-16 大概值
  } catch (e) {
    return 0;
  }
}

// ============================================================
//  任務 1:本地檔案儲存 / 載入(File System Access API,.vns)
//  - 本地檔案是正本;IndexedDB(projects + cg_library)是瀏覽器暫存層。
//  - 分層降級:Chrome / Edge 走 File System Access(可覆寫);其餘瀏覽器走下載 / 上傳。
// ============================================================

const VNS_SAVE_TYPE = {
  description: "Visual Novel Studio 專案",
  accept: { "application/octet-stream": [".vns"] },
};
const VNS_OPEN_TYPE = {
  description: "Visual Novel Studio 專案",
  accept: { "application/octet-stream": [".vns", ".vns.zip"] },
};

// 已綁定的本地檔名(同步快取,給狀態指示用;handle 本身存在 IDB app_state)
let _vnsBoundFileName = null;

function vnsFileSystemSupported() {
  return typeof window !== "undefined"
    && typeof window.showSaveFilePicker === "function"
    && typeof window.showOpenFilePicker === "function";
}

function vnsHasSavedFile() { return !!_vnsBoundFileName; }
function vnsSavedFileName() { return _vnsBoundFileName || ""; }
function _vnsSetBoundFile(name) { _vnsBoundFileName = name || null; }

// 啟動時把上次綁定的檔名讀回快取(handle 權限要等下次儲存時才確認)
async function vnsInitBoundFileFromAppState() {
  try {
    const appState = await vnsGetAppState();
    _vnsBoundFileName = (appState && appState.fileName) || null;
  } catch (e) { _vnsBoundFileName = null; }
}

async function vnsVerifyPermission(handle, write) {
  if (!handle || typeof handle.queryPermission !== "function") return false;
  try {
    const opts = { mode: write ? "readwrite" : "read" };
    if ((await handle.queryPermission(opts)) === "granted") return true;
    if ((await handle.requestPermission(opts)) === "granted") return true;
  } catch (e) {
    console.warn("[vnsVerifyPermission]", e);
  }
  return false;
}

// 收集 project data 引用的所有 cgId:細節版在 slides[].cgId,簡易版在 cgs[*].cgId
function _vnsCollectAllCgIds(data) {
  const ids = new Set();
  if (!data || typeof data !== "object") return ids;
  if (Array.isArray(data.slides)) {
    for (const s of data.slides) if (s && typeof s.cgId === "string") ids.add(s.cgId);
  }
  // 簡易版:幕的 CG 存在 s.cg.cgId(library 型)
  if (Array.isArray(data.simpleCards)) {
    for (const s of data.simpleCards) {
      if (s && typeof s.cgId === "string") ids.add(s.cgId);
      if (s && s.cg && typeof s.cg.cgId === "string") ids.add(s.cg.cgId);
    }
  }
  if (data.cgs && typeof data.cgs === "object") {
    for (const v of Object.values(data.cgs)) {
      if (v && typeof v === "object" && typeof v.cgId === "string") ids.add(v.cgId);
    }
  }
  return ids;
}

// 把當前 state 打包成 .vns(zip)Blob。CG 圖片從 cg_library 取 blob 寫進 cgs/。
async function buildVnsBlobFromState() {
  if (typeof JSZip === "undefined") throw new Error("JSZip 未載入");
  // 先確保剛上傳、還是 data: 的 CG 已鏡射進 cg_library 並補上 cgId,否則打包會漏圖
  if (typeof vnsRehydrateCgsFromLibrary === "function") {
    try { await vnsRehydrateCgsFromLibrary(); } catch (e) {}
  }
  const data = vnsCollectProjectData();
  const cgIds = _vnsCollectAllCgIds(data);
  const cgInfos = [];
  for (const cgId of cgIds) {
    const cg = await vnsGetCg(cgId);
    if (cg && cg.blob) cgInfos.push(cg);
  }

  const zip = new JSZip();
  const cgFolder = zip.folder("cgs");
  const idToPath = {};
  for (const cg of cgInfos) {
    const ext = (cg.mimeType && cg.mimeType.split("/")[1]) || "bin";
    const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
    const filename = `${cg.id}.${safeExt}`;
    cgFolder.file(filename, cg.blob);
    idToPath[cg.id] = `cgs/${filename}`;
  }

  // project.json:保留 cgId,並補 cgRef 指向 zip 內路徑(slides 與 cgs map 兩處)
  const exportData = JSON.parse(JSON.stringify(data || {}));
  if (Array.isArray(exportData.slides)) {
    for (const s of exportData.slides) {
      if (s && s.cgId && idToPath[s.cgId]) s.cgRef = idToPath[s.cgId];
    }
  }
  // 簡易版:把 cgRef 補到 s.cg(供匯入時依路徑重新對應)
  if (Array.isArray(exportData.simpleCards)) {
    for (const s of exportData.simpleCards) {
      if (s && s.cgId && idToPath[s.cgId]) s.cgRef = idToPath[s.cgId];
      if (s && s.cg && s.cg.cgId && idToPath[s.cg.cgId]) s.cg.cgRef = idToPath[s.cg.cgId];
    }
  }
  if (exportData.cgs && typeof exportData.cgs === "object") {
    for (const v of Object.values(exportData.cgs)) {
      if (v && typeof v === "object" && v.cgId && idToPath[v.cgId]) v.cgRef = idToPath[v.cgId];
    }
  }
  zip.file("project.json", JSON.stringify(exportData, null, 2));

  zip.file("settings.json", JSON.stringify({
    dialogStyle: state.dialogStyle,
    styleDefaults: state.styleDefaults,
    fontSizes: state.fontSizes,
    style: state.style,
    customVariants: state.customVariants,
  }, null, 2));

  const project = state.currentProjectId ? await vnsGetProject(state.currentProjectId) : null;
  const projectName = (project && project.name)
    || (_vnsBoundFileName ? _vnsBoundFileName.replace(/\.vns(\.zip)?$/i, "") : "未命名作品");
  zip.file("manifest.json", JSON.stringify({
    formatVersion: VNS_EXPORT_FORMAT_VERSION,
    appName: "Visual Novel Studio",
    appVersion: VNS_APP_VERSION,
    exportedAt: vnsNow(),
    projectName,
    mode: state.mode || "simple",
    slideCount: Array.isArray(exportData.simpleCards) ? exportData.simpleCards.length
      : (Array.isArray(exportData.slides) ? exportData.slides.length : 0),
    cgCount: cgInfos.length,
  }, null, 2));

  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 4 },
  });
  return { blob, projectName };
}

async function vnsWriteBlobToHandle(handle, blob) {
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}

async function vnsPickSaveHandle(suggestedName) {
  try {
    return await window.showSaveFilePicker({
      suggestedName: suggestedName || "未命名作品.vns",
      types: [VNS_SAVE_TYPE],
    });
  } catch (e) {
    if (e && e.name === "AbortError") return null;
    throw e;
  }
}

// 「💾 儲存」:第一次跳檔案選擇器,之後用上次 handle;權限失效則重新授權;路徑失效則重選。
async function saveToVnsFile() {
  if (!vnsFileSystemSupported()) return;
  if (typeof JSZip === "undefined") { showToast("JSZip 未載入,無法儲存", "warn"); return; }

  const appState = await vnsGetAppState();
  let handle = (appState && appState.fileHandle) || null;
  // 先在使用者手勢內確認權限(避免打包耗時後失去 user activation)
  if (handle) {
    const ok = await vnsVerifyPermission(handle, true);
    if (!ok) handle = null;
  }
  if (!handle) {
    handle = await vnsPickSaveHandle((appState && appState.fileName) || null);
    if (!handle) return; // 使用者取消
  }

  let blobInfo;
  try { blobInfo = await buildVnsBlobFromState(); }
  catch (e) { showToast("打包失敗:" + (e.message || e), "warn", 4000); return; }

  try {
    await vnsWriteBlobToHandle(handle, blobInfo.blob);
  } catch (e) {
    // 檔案被移動 / 刪除 / 權限撤銷 → 提示並重新選位置
    console.warn("[saveToVnsFile] write failed", e);
    showToast("找不到原本的儲存位置,請重新選擇", "warn", 4000);
    handle = await vnsPickSaveHandle((blobInfo.projectName || "未命名作品") + ".vns");
    if (!handle) return;
    try { await vnsWriteBlobToHandle(handle, blobInfo.blob); }
    catch (e2) { showToast("儲存失敗:" + (e2.message || e2), "warn", 4000); return; }
  }

  await vnsSetAppState({ fileHandle: handle, fileName: handle.name });
  _vnsSetBoundFile(handle.name);
  if (typeof setEditorStatus === "function") setEditorStatus("saved");
  showToast(`✓ 已儲存到 ${handle.name}`, "success", 3000);
}

// Firefox / Safari 降級路徑:每次都產生 .vns Blob 並觸發瀏覽器下載(無法覆寫舊檔)。
async function saveViaDownload() {
  if (typeof JSZip === "undefined") { showToast("JSZip 未載入,無法儲存", "warn"); return; }
  let blobInfo;
  try { blobInfo = await buildVnsBlobFromState(); }
  catch (e) { showToast("打包失敗:" + (e.message || e), "warn", 4000); return; }

  // 第一次用「未命名作品.vns」或專案名;之後沿用上次檔名,讓使用者覺得是同一份檔
  const filename = _vnsBoundFileName || ((blobInfo.projectName || "未命名作品") + ".vns");

  const url = URL.createObjectURL(blobInfo.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  _vnsSetBoundFile(filename);
  if (typeof setEditorStatus === "function") setEditorStatus("downloaded");
  showToast(`📥 已下載 ${filename}`, "success", 3000);
}

// 儲存統一入口:依瀏覽器能力分流。Chrome / Edge 寫本地檔,其餘觸發下載。
async function saveProject() {
  const supported = (state.browserCapabilities && typeof state.browserCapabilities.fileSystemAccess === "boolean")
    ? state.browserCapabilities.fileSystemAccess
    : vnsFileSystemSupported();
  if (supported) await saveToVnsFile();
  else await saveViaDownload();
}

function _vnsHasMeaningfulContent() {
  const cards = Array.isArray(state.simpleCards) ? state.simpleCards.length : 0;
  const scriptLen = (state.script || "").trim().length;
  return cards > 0 || scriptLen > 0;
}

// 載入前的暫存衝突處理:回傳 "cancel" | "save" | "load"
async function vnsConfirmLoadConflict() {
  if (!_vnsHasMeaningfulContent()) return "load";
  const st = (typeof getEditorStatus === "function") ? getEditorStatus() : "";
  if (st === "saved" || st === "downloaded") return "load"; // 已與本地檔 / 下載同步,沒有未存編輯
  const key = await inlineChoose({
    title: "載入新檔案",
    message: "目前有未儲存到本地檔案的編輯。\n載入新檔案將取代當前內容。",
    options: [
      { key: "save", label: "先儲存當前" },
      { key: "load", label: "直接載入", danger: true },
    ],
    cancelText: "取消",
  });
  return key || "cancel";
}

// 把 .vns 載入到「當前專案」(覆蓋當前內容);handle 非 null 時綁定為可寫回的本地檔。
async function loadVnsIntoCurrentProject(file, handle) {
  let pkg;
  try { pkg = await parseVnsZip(file); }
  catch (e) { showToast("載入失敗:" + (e.message || e), "warn", 5000); return false; }

  showToast(`載入中…(${pkg.cgs.length} 張 CG)`, "info", 2500);
  try {
    // 1. CG → cg_library(新 id),建立 zip 路徑 → 新 cgId 對照
    const pathToNewId = {};
    for (const cg of pkg.cgs) {
      let thumb = null;
      try { thumb = await vnsCreateThumbnail(cg.blob); } catch (e) {}
      const newId = await vnsAddCg(cg.blob, cg.filename, thumb);
      if (newId) pathToNewId[cg.path] = newId;
    }

    // 2. 重寫 cgId(slides 與 cgs map 兩處),移除 cgRef
    const newData = JSON.parse(JSON.stringify(pkg.projectData || {}));
    if (Array.isArray(newData.slides)) {
      for (const s of newData.slides) {
        if (!s) continue;
        if (s.cgRef && pathToNewId[s.cgRef]) s.cgId = pathToNewId[s.cgRef];
        delete s.cgRef;
      }
    }
    if (newData.cgs && typeof newData.cgs === "object") {
      for (const v of Object.values(newData.cgs)) {
        if (!v || typeof v !== "object") continue;
        if (v.cgRef && pathToNewId[v.cgRef]) v.cgId = pathToNewId[v.cgRef];
        delete v.cgRef;
      }
    }
    _vnsRemapSimpleCardsCg(newData, pathToNewId);   // 簡易版幕 CG 重新對應

    // 3. settings → state
    const settings = pkg.settings || {};
    if (settings.dialogStyle) state.dialogStyle = migrateDialogStyle(settings.dialogStyle);
    if (settings.styleDefaults && typeof settings.styleDefaults === "object") {
      for (const k of ["speaker", "narration", "inner", "dialog"]) {
        const d = settings.styleDefaults[k];
        if (d && typeof d === "object") state.styleDefaults[k] = { font: typeof d.font === "string" ? d.font : "" };
      }
    }
    if (settings.fontSizes) state.fontSizes = migrateFontSizes(settings.fontSizes);
    if (settings.style) state.style = migrateStyle(settings.style);
    if (settings.customVariants) state.customVariants = migrateCustomVariants(settings.customVariants);

    // 4. project data → state
    const mode = (pkg.manifest && pkg.manifest.mode) || newData.mode || "simple";
    applyProjectDataToState(newData, mode);
    ensureProtagonistExists();
    await vnsRehydrateCgsFromLibrary(); // 從 cg_library 取回 Object URL,讓預覽顯示圖片

    // 5. 覆寫當前 IDB 專案(暫存層 = 載入內容)
    if (state.currentProjectId) {
      const pname = (pkg.manifest && pkg.manifest.projectName)
        || (handle && handle.name ? handle.name.replace(/\.vns(\.zip)?$/i, "") : "未命名作品");
      await vnsUpdateProject(state.currentProjectId, { data: newData, mode, name: pname });
    }

    // 6. 套樣式 + 重繪
    if (els && els.scriptArea) els.scriptArea.value = state.script || "";
    if (typeof setRatio === "function") setRatio(state.ratio);
    if (typeof applyDialogStyle === "function") applyDialogStyle();
    if (typeof applyFontSizes === "function") applyFontSizes();
    if (typeof applyStylePreset === "function") applyStylePreset(state.style.preset, state.style.variant, { skipSave: true });
    if (typeof syncStyleDefaultsUI === "function") syncStyleDefaultsUI();
    if (typeof renderStylePresetGrid === "function") renderStylePresetGrid();
    if (state.mode === "simple") {
      if (typeof renderSimpleSlideList === "function") renderSimpleSlideList();
      if (typeof renderSimpleEditor === "function") renderSimpleEditor();
    } else if (typeof reparseAndRender === "function") {
      reparseAndRender(true);
    }
    saveToStorage();

    // 7. 綁定 handle
    if (handle) {
      await vnsSetAppState({ fileHandle: handle, fileName: handle.name });
      _vnsSetBoundFile(handle.name);
      if (typeof setEditorStatus === "function") setEditorStatus("saved");
    } else {
      // 拖曳載入沒有可寫回的 handle:存在瀏覽器,提示另存綁定
      await vnsSetAppState({ fileHandle: null, fileName: null });
      _vnsSetBoundFile(null);
      if (typeof setEditorStatus === "function") setEditorStatus("cached");
    }
    const shown = (handle && handle.name) || (pkg.manifest && pkg.manifest.projectName) || file.name;
    showToast(`✓ 已載入 ${shown}`, "success", 3000);
    return true;
  } catch (e) {
    console.error("[loadVnsIntoCurrentProject]", e);
    showToast("載入過程出錯:" + (e.message || e), "warn", 4000);
    return false;
  }
}

// 「📂 開啟」:檔案選擇器選 .vns → 載入到當前專案並綁定 handle。
async function openVnsFile() {
  if (!vnsFileSystemSupported()) return;
  const decision = await vnsConfirmLoadConflict();
  if (decision === "cancel") return;
  if (decision === "save") await saveToVnsFile();

  let handle;
  try {
    const arr = await window.showOpenFilePicker({ types: [VNS_OPEN_TYPE], multiple: false });
    handle = arr && arr[0];
  } catch (e) {
    if (e && e.name === "AbortError") return;
    showToast("開啟失敗:" + (e.message || e), "warn", 4000);
    return;
  }
  if (!handle) return;
  const ok = await vnsVerifyPermission(handle, false);
  if (!ok) { showToast("沒有讀取權限", "warn"); return; }
  let file;
  try { file = await handle.getFile(); }
  catch (e) { showToast("讀取檔案失敗:" + (e.message || e), "warn", 4000); return; }
  await loadVnsIntoCurrentProject(file, handle);
}

// Firefox / Safari 降級路徑:用傳統 <input type=file> 選 .vns,讀進當前專案(無可寫回 handle)。
async function openViaFileInput() {
  const decision = await vnsConfirmLoadConflict();
  if (decision === "cancel") return;
  if (decision === "save") await saveProject();
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".vns,.vns.zip";
    input.onchange = async (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) await loadVnsIntoCurrentProject(file, null);
      resolve();
    };
    input.click();
  });
}

// 載入統一入口:依瀏覽器能力分流。Chrome / Edge 走 File System Access,其餘走傳統 input。
async function openProject() {
  const supported = (state.browserCapabilities && typeof state.browserCapabilities.fileSystemAccess === "boolean")
    ? state.browserCapabilities.fileSystemAccess
    : vnsFileSystemSupported();
  if (supported) await openVnsFile();
  else await openViaFileInput();
}

// 拖曳載入(無可寫回 handle):同樣覆蓋當前內容,但不綁定本地檔。
async function openVnsFromDroppedFile(file) {
  const decision = await vnsConfirmLoadConflict();
  if (decision === "cancel") return;
  if (decision === "save") await saveToVnsFile();
  await loadVnsIntoCurrentProject(file, null);
}

export {
  vnsCollectReferencedCgIds,
  vnsCompareSemver,
  buildExportPayload,
  applyImportedPayload,
  exportCurrentProject,
  parseVnsZip,
  confirmAndImport,
  _vnsLooksLikeVnsFile,
  estimateExportSize,
  vnsFileSystemSupported,
  vnsHasSavedFile,
  vnsSavedFileName,
  vnsInitBoundFileFromAppState,
  buildVnsBlobFromState,
  saveToVnsFile,
  saveViaDownload,
  saveProject,
  openVnsFile,
  openViaFileInput,
  openProject,
  openVnsFromDroppedFile,
  loadVnsIntoCurrentProject,
};
