// shared/storage-indexeddb.js — 由 index.js 搬出(階段 3-C2),內容未改動
// 相依:Dexie(CDN 全域)、state、index.js 工具函式(showToast/fmtBytes 等)皆經全域取得;
// 可變狀態 vnsDb/vnsDbReady/vnsDbFailed/_vnsPersistentGranted/_vnsAutoSaveTimer/_vnsAutoSaveStopped
// 仍宣告於 index.js,本模組透過全域 declarative 環境共用同一綁定。

const DB_NAME = "vns_database";

const DB_VERSION = 1;

function initVnsDb() {
  if (vnsDbReady) return vnsDbReady;
  if (typeof Dexie === "undefined") {
    vnsDbFailed = true;
    vnsDbReady = Promise.resolve(null);
    return vnsDbReady;
  }
  try {
    vnsDb = new Dexie(DB_NAME);
    vnsDb.version(DB_VERSION).stores({
      // primary key 寫在第一個欄位;其他欄位是次要索引
      cg_library:    "id, uploadedAt, lastUsedAt",
      cg_thumbnails: "id",
      projects:      "id, modifiedAt, mode",
      app_state:     "id",
    });
    vnsDbReady = vnsDb.open().then(() => vnsDb).catch((err) => {
      console.error("[vnsDb] open failed:", err);
      vnsDbFailed = true;
      return null;
    });
  } catch (e) {
    console.error("[vnsDb] init failed:", e);
    vnsDbFailed = true;
    vnsDbReady = Promise.resolve(null);
  }
  return vnsDbReady;
}

async function getVnsDb() {
  await initVnsDb();
  return vnsDbFailed ? null : vnsDb;
}

function vnsUuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  // fallback:時間 + 隨機;不需要嚴格 UUID,只要在這顆瀏覽器內唯一
  return "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
}

function vnsNow() { return new Date().toISOString(); }

async function vnsAddCg(blob, name, thumbBlob) {
  const db = await getVnsDb();
  if (!db) return null;
  const id = "cg_" + vnsUuid();
  const now = vnsNow();
  const ok = await vnsDbWrite("addCg", () =>
    db.transaction("rw", db.cg_library, db.cg_thumbnails, async () => {
      await db.cg_library.put({
        id,
        name: name || "未命名 CG",
        mimeType: blob.type || "application/octet-stream",
        blob,
        fileSize: blob.size,
        uploadedAt: now,
        lastUsedAt: now,
      });
      if (thumbBlob) await db.cg_thumbnails.put({ id, blob: thumbBlob });
      return id;
    }));
  return ok;
}

async function vnsGetCg(id) {
  const db = await getVnsDb();
  if (!db) return null;
  return db.cg_library.get(id);
}

async function vnsGetCgThumbnail(id) {
  const db = await getVnsDb();
  if (!db) return null;
  return db.cg_thumbnails.get(id);
}

async function vnsListCgs(opts) {
  const db = await getVnsDb();
  if (!db) return [];
  // 預設依 lastUsedAt 降序(最近用過的在前)
  const orderBy = (opts && opts.orderBy) || "lastUsedAt";
  return db.cg_library.orderBy(orderBy).reverse().toArray();
}

async function vnsTouchCg(id) {
  const db = await getVnsDb();
  if (!db) return;
  await vnsDbWrite("touchCg", () => db.cg_library.update(id, { lastUsedAt: vnsNow() }));
}

async function vnsDeleteCg(id) {
  const db = await getVnsDb();
  if (!db) return;
  await vnsDbWrite("deleteCg", () =>
    db.transaction("rw", db.cg_library, db.cg_thumbnails, async () => {
      await db.cg_library.delete(id);
      await db.cg_thumbnails.delete(id);
    }));
}

async function vnsAddProject(name, mode, data) {
  const db = await getVnsDb();
  if (!db) return null;
  const id = "proj_" + vnsUuid();
  const now = vnsNow();
  const ok = await vnsDbWrite("addProject", () =>
    db.projects.put({
      id,
      name: name || "未命名專案",
      mode: mode || "simple",
      data: data || {},
      createdAt: now,
      modifiedAt: now,
    }));
  return ok === null ? null : id;
}

async function vnsUpdateProject(id, patch) {
  const db = await getVnsDb();
  if (!db) return;
  const now = vnsNow();
  await vnsDbWrite("updateProject", () =>
    db.projects.update(id, Object.assign({}, patch, { modifiedAt: now })));
}

async function vnsGetProject(id) {
  const db = await getVnsDb();
  if (!db) return null;
  return db.projects.get(id);
}

async function vnsListProjects() {
  const db = await getVnsDb();
  if (!db) return [];
  return db.projects.orderBy("modifiedAt").reverse().toArray();
}

async function vnsDeleteProject(id) {
  const db = await getVnsDb();
  if (!db) return;
  await vnsDbWrite("deleteProject", () => db.projects.delete(id));
}

async function vnsGetAppState() {
  const db = await getVnsDb();
  if (!db) return null;
  return db.app_state.get("current");
}

async function vnsSetAppState(patch) {
  const db = await getVnsDb();
  if (!db) return;
  await vnsDbWrite("setAppState", async () => {
    const cur = (await db.app_state.get("current")) || { id: "current" };
    return db.app_state.put(Object.assign({}, cur, patch, { id: "current" }));
  });
}

async function vnsDbWrite(label, fn) {
  try {
    return await fn();
  } catch (err) {
    console.error("[vnsDb] " + label + " failed:", err);
    if (typeof showToast === "function") {
      showToast("儲存失敗,請檢查瀏覽器空間或重新整理頁面。", "warn", 4000);
    }
    return null;
  }
}

async function vnsCheckIdbAvailability() {
  if (typeof window === "undefined" || !window.indexedDB) return false;
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open("__vns_probe__");
      req.onsuccess = () => {
        try { req.result.close(); window.indexedDB.deleteDatabase("__vns_probe__"); } catch (e) {}
        resolve(true);
      };
      req.onerror = () => resolve(false);
      req.onblocked = () => resolve(false);
    } catch (e) { resolve(false); }
  });
}

const VNS_CG_MAX_BYTES = 10 * 1024 * 1024;

const VNS_CG_MIME_OK = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const VNS_THUMB_MAX = 200;

const VNS_THUMB_QUALITY = 0.7;

function vnsValidateCgFile(file) {
  if (!file || !(file instanceof File || file instanceof Blob)) {
    return { ok: false, reason: "無效的檔案。" };
  }
  if (file.size > VNS_CG_MAX_BYTES) {
    return { ok: false, reason: "檔案超過 10 MB 上限。" };
  }
  if (file.type && !VNS_CG_MIME_OK.has(file.type)) {
    return { ok: false, reason: "不支援的格式(僅接受 JPG / PNG / WebP / GIF)。" };
  }
  return { ok: true };
}

async function vnsCreateThumbnail(blob, maxSize) {
  const max = maxSize || VNS_THUMB_MAX;
  // createImageBitmap:現代瀏覽器都有
  let bmp;
  try {
    bmp = await createImageBitmap(blob);
  } catch (e) {
    // GIF 等格式 createImageBitmap 可能失敗,fallback 到 <img>
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = reject;
        im.src = url;
      });
      bmp = img;
    } finally { URL.revokeObjectURL(url); }
  }
  const ow = bmp.width || bmp.naturalWidth;
  const oh = bmp.height || bmp.naturalHeight;
  const ratio = Math.min(1, max / Math.max(ow, oh));
  const w = Math.max(1, Math.round(ow * ratio));
  const h = Math.max(1, Math.round(oh * ratio));

  // OffscreenCanvas 比 HTMLCanvasElement 快也不會閃白屏;不支援時 fallback
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bmp, 0, 0, w, h);
    return canvas.convertToBlob({ type: "image/jpeg", quality: VNS_THUMB_QUALITY });
  }
  // fallback
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bmp, 0, 0, w, h);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", VNS_THUMB_QUALITY));
}

async function vnsAddCgFromFile(file) {
  const v = vnsValidateCgFile(file);
  if (!v.ok) return { id: null, error: v.reason };
  // 配額預檢:不足直接擋下,避免寫到一半失敗造成 store 不一致
  const canStore = await vnsCanStoreFile(file.size);
  if (!canStore) {
    return { id: null, error: "瀏覽器儲存空間不足。請到「⚙ 設定 → 儲存空間」清理,或匯出備份後刪除部分專案。" };
  }
  let thumb = null;
  try {
    thumb = await vnsCreateThumbnail(file);
  } catch (e) {
    console.warn("[vnsAddCgFromFile] 縮圖產生失敗,只存原圖:", e);
    // 縮圖失敗不致命,原圖仍可寫入(列表會 fallback 顯示原圖)
  }
  const id = await vnsAddCg(file, file.name || "未命名 CG", thumb);
  if (!id) return { id: null, error: "寫入資料庫失敗。" };
  return { id };
}

async function vnsCgUrlFromId(id, opts) {
  const useThumb = !!(opts && opts.thumbnail);
  const rec = useThumb ? await vnsGetCgThumbnail(id) : await vnsGetCg(id);
  if (!rec || !rec.blob) return null;
  return URL.createObjectURL(rec.blob);
}

function vnsRevokeCgUrl(url) {
  if (url) { try { URL.revokeObjectURL(url); } catch (e) {} }
}

async function vnsListCgsWithThumbUrls() {
  const cgs = await vnsListCgs();
  const out = [];
  for (const cg of cgs) {
    let thumbUrl = null;
    const thumbRec = await vnsGetCgThumbnail(cg.id);
    if (thumbRec && thumbRec.blob) thumbUrl = URL.createObjectURL(thumbRec.blob);
    else if (cg.blob) thumbUrl = URL.createObjectURL(cg.blob);  // fallback:沒縮圖時用原圖
    out.push({
      id: cg.id,
      name: cg.name,
      fileSize: cg.fileSize,
      uploadedAt: cg.uploadedAt,
      lastUsedAt: cg.lastUsedAt,
      thumbUrl,
    });
  }
  return out;
}

const VNS_QUOTA_SAFETY_MARGIN = 50 * 1024 * 1024;

async function vnsCheckStorageQuota() {
  if (!navigator.storage || !navigator.storage.estimate) {
    return { supported: false };
  }
  try {
    const { quota = 0, usage = 0 } = await navigator.storage.estimate();
    return {
      supported: true,
      quota,
      usage,
      usagePercent: quota > 0 ? (usage / quota) * 100 : 0,
      available: Math.max(0, quota - usage),
    };
  } catch (e) {
    return { supported: false };
  }
}

async function vnsCanStoreFile(blobSize) {
  const q = await vnsCheckStorageQuota();
  if (!q.supported) return true;  // 偵測不到就放行,寫入失敗會走 vnsDbWrite 的 catch
  return blobSize < (q.available - VNS_QUOTA_SAFETY_MARGIN);
}

async function vnsRequestPersistentStorage() {
  if (!navigator.storage || !navigator.storage.persist) {
    _vnsPersistentGranted = false;
    return false;
  }
  try {
    const already = navigator.storage.persisted ? await navigator.storage.persisted() : false;
    if (already) { _vnsPersistentGranted = true; return true; }
    const granted = await navigator.storage.persist();
    _vnsPersistentGranted = granted;
    return granted;
  } catch (e) {
    _vnsPersistentGranted = false;
    return false;
  }
}

async function vnsBreakdownUsage() {
  const out = { cgs: 0, cgCount: 0, projects: 0, projectCount: 0 };
  const db = await getVnsDb();
  if (!db) return out;
  try {
    await db.cg_library.each((r) => { out.cgs += (r.fileSize || 0); out.cgCount++; });
    // 縮圖也算
    await db.cg_thumbnails.each((r) => { if (r.blob) out.cgs += r.blob.size || 0; });
    const projs = await db.projects.toArray();
    out.projectCount = projs.length;
    // 粗估 project.data JSON 字串長度(UTF-16 約 ×2 bytes)
    for (const p of projs) {
      try { out.projects += JSON.stringify(p.data || {}).length * 2; } catch (e) {}
    }
  } catch (e) {
    console.warn("[breakdownUsage]", e);
  }
  return out;
}

function vnsFmtBytes(n) {
  if (n == null) return "—";
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + " MB";
  return (n / 1024 / 1024 / 1024).toFixed(2) + " GB";
}

function vnsCollectProjectData() {
  return {
    v: 1,
    script: state.script,
    characters: state.characters,
    backgrounds: Object.fromEntries(
      Object.entries(state.backgrounds || {}).filter(([, v]) => v && v.type === "image")
    ),
    bgOrder: state.bgOrder,
    cgs: _stripCgDataUrls(state.cgs),
    cgOrder: state.cgOrder,
    ratio: state.ratio,
    dialogStyle: state.dialogStyle,
    gameUI: state.gameUI,
    lightMode: state.lightMode,
    loveInitial: state.loveInitial,
    mode: state.mode,
    simpleCards: state.simpleCards,
    simpleCurrentSlideId: state.simpleCurrentSlideId,
  };
}

function vnsScheduleAutoSave() {
  if (_vnsAutoSaveStopped) return;
  if (!state.currentProjectId || vnsDbFailed) return;
  if (_vnsAutoSaveTimer) clearTimeout(_vnsAutoSaveTimer);
  // 任務 5:編輯中(若已存到本地檔案,則顯示「有未儲存變更」)
  if (typeof setEditorStatus === "function") {
    const hasFile = typeof vnsHasSavedFile === "function" && !!vnsHasSavedFile();
    setEditorStatus(hasFile ? "unsaved" : "editing");
  }
  _vnsAutoSaveTimer = setTimeout(() => {
    _vnsAutoSaveTimer = null;
    vnsAutoSaveCurrentProject();
  }, 3000);
}

async function vnsAutoSaveCurrentProject() {
  if (vnsDbFailed || !state.currentProjectId) return;
  const data = vnsCollectProjectData();
  const db = await getVnsDb();
  if (!db) return;
  try {
    await db.projects.update(state.currentProjectId, {
      data,
      mode: state.mode || "simple",
      modifiedAt: vnsNow(),
    });
    // 任務 5:IDB 自動存檔完成 → 暫存瀏覽器(若已存到本地檔案,則為「有未儲存變更」)
    if (typeof setEditorStatus === "function") {
      const hasFile = typeof vnsHasSavedFile === "function" && !!vnsHasSavedFile();
      setEditorStatus(hasFile ? "unsaved" : "cached");
    }
  } catch (e) {
    console.error("[autoSave] failed:", e);
    _vnsAutoSaveStopped = true;
    if (typeof setEditorStatus === "function") setEditorStatus("error");
    if (typeof showToast === "function") {
      showToast("自動儲存失敗,已暫停。請到「⚙ 設定 → 儲存空間」處理。", "warn", 5000);
    }
  }
}

function vnsResumeAutoSave() {
  _vnsAutoSaveStopped = false;
  vnsScheduleAutoSave();
}

function _scheduleMirrorCgsToLibrary() {
  if (vnsDbFailed) return;
  setTimeout(async () => {
    const cgs = state.cgs;
    if (!cgs) return;
    for (const [name, entry] of Object.entries(cgs)) {
      if (!entry || typeof entry !== "object") continue;
      if (entry.cgId) continue;   // 已遷移
      const du = entry.dataUrl;
      if (typeof du !== "string" || !du.startsWith("data:")) continue;
      try {
        const blob = await (await fetch(du)).blob();
        let thumb = null;
        try { thumb = await vnsCreateThumbnail(blob); } catch (e) {}
        const cgId = await vnsAddCg(blob, name, thumb);
        if (cgId) {
          entry.cgId = cgId;
          // 換成 Object URL — 大幅縮短記憶體佔用(原本是 dataUrl 字串)
          entry.dataUrl = URL.createObjectURL(blob);
        }
      } catch (e) { console.warn("[mirror cg]", name, e); }
    }
  }, 0);
}

async function vnsRehydrateCgsFromLibrary() {
  if (vnsDbFailed) return;
  const cgs = state.cgs;
  if (!cgs || typeof cgs !== "object") return;
  for (const [name, entry] of Object.entries(cgs)) {
    if (!entry || typeof entry !== "object") continue;
    const du = entry.dataUrl;
    // 1. legacy: data:base64 → 寫進 cg_library + 換成 Object URL
    if (typeof du === "string" && du.startsWith("data:")) {
      try {
        const blob = await (await fetch(du)).blob();
        let thumb = null;
        try { thumb = await vnsCreateThumbnail(blob); } catch (e) {}
        const cgId = await vnsAddCg(blob, name, thumb);
        if (cgId) {
          entry.cgId = cgId;
          entry.dataUrl = URL.createObjectURL(blob);
        }
      } catch (e) { console.warn("[cgs migrate]", name, e); }
      continue;
    }
    // 2. 有 cgId 但沒 dataUrl(rehydrate 情境)→ 從 cg_library 取 Object URL
    if (entry.cgId && !entry.dataUrl) {
      try {
        const url = await vnsCgUrlFromId(entry.cgId);
        if (url) entry.dataUrl = url;
      } catch (e) {}
    }
  }
}

function vnsHasLegacyLocalData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    // 有 script 或 simpleCards 才視為「有實質內容」,空殼不算
    if (typeof parsed.script === "string" && parsed.script.trim().length > 0) return true;
    if (Array.isArray(parsed.simpleCards) && parsed.simpleCards.length > 0) return true;
    if (Array.isArray(parsed.characters) && parsed.characters.length > 0) return true;
    return false;
  } catch (e) { return false; }
}

const VNS_MIGRATE_FLAG_KEY = "vns_migration_done_v1";

async function vnsEnsureDefaultProject() {
  if (vnsDbFailed) return;
  const appState = await vnsGetAppState();
  if (appState && appState.currentProjectId) {
    const p = await vnsGetProject(appState.currentProjectId);
    if (p) {
      state.currentProjectId = appState.currentProjectId;
      return;
    }
  }
  // 沒有 app_state 或 project 已被刪除 → 建預設 project
  const isLegacy = !localStorage.getItem(VNS_MIGRATE_FLAG_KEY) && vnsHasLegacyLocalData();
  const name = isLegacy ? "舊的專案(自動遷移)" : "我的專案";
  const id = await vnsAddProject(name, state.mode || "simple", vnsCollectProjectData());
  if (id) {
    state.currentProjectId = id;
    await vnsSetAppState({ currentProjectId: id });
  }
  if (isLegacy) {
    try { localStorage.setItem(VNS_MIGRATE_FLAG_KEY, vnsNow()); } catch (e) {}
    // 等 UI 就緒一段時間再 toast,確保使用者看得到
    setTimeout(() => {
      if (typeof showToast === "function") {
        showToast("已將舊資料遷移到新儲存系統 · 可在「📁 我的專案」管理", "info", 5000);
      }
    }, 1200);
  }
}

async function vnsDeleteCgAndDereference(cgId) {
  const db = await getVnsDb();
  if (!db) return { affectedProjects: 0 };
  let affected = 0;
  await vnsDbWrite("deleteCgAndDereference", () =>
    db.transaction("rw", db.cg_library, db.cg_thumbnails, db.projects, async () => {
      await db.cg_library.delete(cgId);
      await db.cg_thumbnails.delete(cgId);
      // 逐筆掃描 projects,把引用此 cgId 的 slide.cgId 設為 null
      const all = await db.projects.toArray();
      for (const p of all) {
        if (!p.data || !Array.isArray(p.data.slides)) continue;
        let dirty = false;
        for (const s of p.data.slides) {
          if (s && s.cgId === cgId) { s.cgId = null; dirty = true; }
        }
        if (dirty) {
          await db.projects.update(p.id, { data: p.data, modifiedAt: vnsNow() });
          affected++;
        }
      }
    }));
  return { affectedProjects: affected };
}

export {
  DB_NAME,
  DB_VERSION,
  VNS_CG_MAX_BYTES,
  VNS_CG_MIME_OK,
  VNS_THUMB_MAX,
  VNS_THUMB_QUALITY,
  VNS_QUOTA_SAFETY_MARGIN,
  VNS_MIGRATE_FLAG_KEY,
  initVnsDb,
  getVnsDb,
  vnsUuid,
  vnsNow,
  vnsAddCg,
  vnsGetCg,
  vnsGetCgThumbnail,
  vnsListCgs,
  vnsTouchCg,
  vnsDeleteCg,
  vnsAddProject,
  vnsUpdateProject,
  vnsGetProject,
  vnsListProjects,
  vnsDeleteProject,
  vnsGetAppState,
  vnsSetAppState,
  vnsDbWrite,
  vnsCheckIdbAvailability,
  vnsValidateCgFile,
  vnsCreateThumbnail,
  vnsAddCgFromFile,
  vnsCgUrlFromId,
  vnsRevokeCgUrl,
  vnsListCgsWithThumbUrls,
  vnsCheckStorageQuota,
  vnsCanStoreFile,
  vnsRequestPersistentStorage,
  vnsBreakdownUsage,
  vnsFmtBytes,
  vnsCollectProjectData,
  vnsScheduleAutoSave,
  vnsAutoSaveCurrentProject,
  vnsResumeAutoSave,
  _scheduleMirrorCgsToLibrary,
  vnsRehydrateCgsFromLibrary,
  vnsHasLegacyLocalData,
  vnsEnsureDefaultProject,
  vnsDeleteCgAndDereference,
};
