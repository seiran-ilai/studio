"use strict";

// ============================================================
//  簡易版相容 stub
// ============================================================
// 詳細版已物理移除(參考保留在 ../visual-novel-detail/)。
// 共用模組(dialog-style / export-import / projects)仍會呼叫詳細版的
// reparseAndRender / setRatio / setScript;在簡易版把它們導向簡易渲染,
// 讓「改樣式 → 主預覽即時更新」等行為正確運作。
function reparseAndRender() {
  if (typeof renderSimpleSlideList === "function") renderSimpleSlideList();
  if (typeof renderSimpleEditor === "function") renderSimpleEditor();
}
function setRatio(ratio) {
  if (ratio) state.ratio = ratio;
}
function setScript() {}  // 簡易版不使用詳細版 script

// ============================================================
//  Data Model
// ============================================================







// ============================================================
//  State
// ============================================================

// =============================================================
// 樣式系統 - 字體清單
// =============================================================
// 排序:標準在最前,其他依視覺風格分組
// 每個字體都用 Google Fonts 或 Justfont 公開 CDN,自動 fallback 到系統字體


// 雙向查找



// 樣式 tag 別名(寫法 → 標準名)


// 樣式 tag 名單(用於 parser 快速判斷某 tag 是否為樣式 tag)












// ============================================================
// Batch 2:風格系統 - 6 風格 × 3 變體 = 18 個鎖定配色組合
// ============================================================





// UI 配色預設(隨風格綁定)




// 滿值/歸零特效定義(skeleton — Batch 3 完整實作)









// 每個風格的「自訂」變體配色 — 一個物件 per preset。
// 第一次點某風格的「自訂」時用當下的變體配色初始化,之後使用者調整的顏色都存在這裡。






// 簡易模式幕資料結構
// 一般幕:
// {
//   id: 'slide_xxx',
//   type: 'dialog',
//   cg: { type: 'none'|'upload'|'library', name?, dataUrl?, cgId? },
//   dialogText: '原始多行文字',
//   parsedLines: [{ type, speaker?, content }]
// }
// 選項幕(選項幕功能):
// {
//   id: 'slide_xxx',
//   type: 'choice',
//   cg: { ... },                       // 選項幕必須有 CG
//   choices: [{ id, text, isCorrect }] // 2~5 個,最多一個 isCorrect
// }
// 向後相容:沒有 type 欄位的舊資料一律視為 'dialog'。
// 任務 5:對話框樣式改為「專案 / 全域層級」(state.style),每幕不再有 dialogStyle 欄位。







// 選項幕:CG 預設沿用上一幕(deep copy),預設兩個空白選項


// 正規化選項陣列:每個 {id, text, isCorrect},夾在 2~5 個,最多一個正解







// 取選項幕的正解選項(沒有則回 null)


// 取當前選中的幕;若 simpleCurrentSlideId 不存在或對不上,自動 fallback 到第一張




// Older saves have no `kind` — default to supporting.





// 「對話框預設 / 自訂底色」UI 已移除(改由風格組合 + 自訂變體控制),
// 但 state.dialogStyle / applyDialogStyle 保留,因為背景色/透明度的 CSS 變數
// 還是要靠這條路徑寫進 :root,自訂顏色組合(任務 3)會用到。

// ============================================================
//  Parser
//  Format: 角色[emotion][position][替代名]：text  (替代名 = 純中括號別名,隱藏真名)
//          [bg: name]
//          [離場] / [無人] / [退場]
//          [cg: name]       — show CG, dialog box visible
//          [cg full: name]  — show CG, hide dialog box
//          [cg off]         — hide CG
//          [選項]           — start a choices block
//            - option text
//            - * final choice (marked with *)
//          <empty or text without :> = narration
// ============================================================

// 舊格式:角色名[tag][tag]:台詞(向下相容)
// 新格式:[角色名][tag][tag]:台詞(第一個 tag 必須是已知角色名)
// Bracket content > this many characters is treated as a name-override
// (descriptive alias) instead of an emotion label.

// 對話節點建構(新舊格式共用,沿用既有 tag 解析邏輯)




// Second pass: collapse `choices_start` + following `choice_item`s into a single `choices` node.


// Third pass: merge scene commands (bg / cg / cg_off / exit) into the
// `sceneOps` array of the FIRST following content node (dialog / narration /
// choices), so they no longer cost a separate "empty" click. If there is no
// following content node (trailing scene commands at end of script), keep them
// as one stand-alone "scene_only" terminal beat so the preview can still show
// the final stage state.





// ============================================================
//  Render
// ============================================================





// Place a character into the stage state for a dialog line.
// If position is unspecified, fall back to whichever slot the char is already in, else 中.


// Compute stage state up to and including line index `upToIdx`.




// SVG silhouette for placeholder portrait


// 立繪取景:套到 .char-portrait / placeholder(避免 .char-figure 的進場動畫覆蓋 transform)
// 與 Canvas 同公式:scale = portraitScale%,正 portraitY = 往下沉(translateY 正值),
// 以底部中心為錨點(腳對齊)。預設 y0/scale100 → 無變化(等同現況)。




// ============================================================
//  O5:句中 Markdown + 全域預設樣式
// ============================================================


// 行的「有效樣式」:行內 tag 優先,缺的用 state.styleDefaults 補字型
// size 不再由 defaults 提供(已改為各類獨立 pt 字級,見 state.fontSizes),
// 只接受行內 [大]/[小] 作為對基底字級的倍率修飾


// 依行類型挑出對應的基底字級(pt → px 等價,直接套上 element)


// 句中 Markdown → HTML(預覽用)


// 句中 Markdown → segment 陣列(Canvas 用)




// 從 parsed line 抽出樣式欄位(供 canvas frame 使用)


// 依 frame.dialog 的樣式欄位組出 canvas ctx.font 字串(只用於對話/旁白「文字」,speaker 名字不套)




// Render the CG layer based on current stage state.


// Render choices overlay in static (preview) mode — shows all 3 with final highlighted.








// Main render: show stage + current dialog at currentIndex.


// ----- Preview position counter + jump-to-beat -----




// ============================================================
//  Navigation
// ============================================================









// ============================================================
//  Wire-up
// ============================================================



/**
 * 將 textarea 滾動到指定位置,讓游標保持在視野中。(L1)
 * 用於 snippet 插入、Tab 展開、popup 接受候選等所有「程式自動修改 textarea」之後。
 * @param {HTMLTextAreaElement} ta - textarea 元素
 * @param {number} [caretPos] - 游標位置(預設用 ta.selectionStart)
 * @param {'center'|'nearest'} [behavior='nearest'] - center=游標置中,nearest=只在跑出視野才滾
 */

// ----- Reset actions: split into script-only / style-only / full -----
document.getElementById("btnResetScript").addEventListener("click", async () => {
  const ok = await inlineConfirm({
    title: "只重設劇本",
    message: "確定要清空劇本？角色、背景、CG、樣式都會保留。此動作不可復原。",
    okText: "清空劇本",
    danger: true,
  });
  if (!ok) return;
  state.simpleCards = [];
  state.simpleCurrentSlideId = null;
  saveToStorage();
  renderMainView();
  showToast("✨ 劇本已清空", "success");
});

document.getElementById("btnResetStyle").addEventListener("click", async () => {
  const ok = await inlineConfirm({
    title: "只重設樣式",
    message: "確定要把對話框樣式回到預設？此動作不可復原。",
    okText: "重設樣式",
    danger: true,
  });
  if (!ok) return;
  state.dialogStyle = { ...DEFAULT_DIALOG_STYLE };
  applyDialogStyle();
  if (typeof renderStyleTab === "function") renderStyleTab();
  saveToStorage();
  showToast("✨ 對話框樣式已重設", "success");
});

document.getElementById("btnReset").addEventListener("click", async () => {
  const ok = await inlineConfirm({
    title: "⚠ 全部重設",
    message: "劇本、角色、背景、CG、樣式都會回到預設。此動作不可復原。",
    okText: "全部重設",
    danger: true,
  });
  if (!ok) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
});

// 任務 1:舊「匯出分享字串 / 匯入 / 匯出專案」JSON 機制已移除,改用本地檔案 .vns(File System Access)。

// ============================================================
//  Storage (localStorage persistence)
// ============================================================


 // 5MB
 // warn at 4MB usage



// Save-state indicator in topbar.











// ============================================================
//  IndexedDB(Dexie wrapper)— 大量資料層
//  用途:
//    - cg_library      原始 CG Blob(讀寫慢但容量大,輸出用)
//    - cg_thumbnails   200×200 縮圖 Blob(列表用,快)
//    - projects        每個專案的幕資料(簡易模式 slides / 細節模式 script)
//    - app_state       單筆 'current' 紀錄 currentProjectId / mode,
//                      讓重新整理頁面後恢復上一次編輯的專案
//  localStorage 維持沿用:主題、樣式、字體、custom variant 等「小、頻繁、不能丟失」設定。
// ============================================================




// Dexie 透過 CDN <script> 載入時掛在 window.Dexie。
// 若 IndexedDB 不可用(隱私模式 / 舊瀏覽器)會在任務 8 用 vnsDbReady 暴露給 UI 層判斷。
let vnsDb = null;
let vnsDbReady = null;     // Promise:resolve 後表示 db.open() 完成
let vnsDbFailed = false;   // true 表示 IndexedDB 不可用(無法 fallback)



// 取得 Dexie 實例(供其他 helper 用),若失敗回傳 null。


// ---------- 通用工具 ----------





// ---------- cg_library / cg_thumbnails ----------













// ---------- projects ----------











// ---------- app_state(單筆 'current') ----------





// 寫入操作的統一 try-catch:寫入失敗時 toast 提示。讀取/列表失敗回傳 null/[],
// 不打擾使用者(空狀態自然會在 UI 顯示)。


// IndexedDB 相容性偵測 — 在 Dexie 之外再做一次最低限度檢測,
// 處理「Dexie 載入成功但底層 IndexedDB 因隱私模式被閹割」的情境。


// 啟動時非同步開啟 DB;後續任務的 UI 程式碼用 await getVnsDb() 或 vnsDbReady 等待。
// 若失敗,顯示全屏警告 overlay(隱私模式 / 舊瀏覽器)。
(async function bootstrapVnsDb() {
  // 分層降級:偵測一次瀏覽器能力,記在 state。不再擋下不支援 File System Access 的瀏覽器
  // (Firefox / Safari),改走下載 / 上傳的降級路徑(見 saveProject / openProject)。
  state.browserCapabilities = {
    fileSystemAccess: (typeof vnsFileSystemSupported === "function") && vnsFileSystemSupported(),
  };
  const idbOk = await vnsCheckIdbAvailability();
  if (!idbOk) {
    vnsDbFailed = true;
    const block = document.getElementById("vns-idb-block");
    if (block) block.classList.add("show");
    return;
  }
  await initVnsDb();
  if (vnsDbFailed) {
    const block = document.getElementById("vns-idb-block");
    if (block) block.classList.add("show");
    return;
  }
  // DB 就緒後:把舊版 localStorage 內的 base64 dataUrl 遷移到 cg_library,
  // 並為 state.cgs 補上 Object URL(rehydrate)。完成後再做後續初始化。
  await vnsRehydrateCgsFromLibrary();
  // 重繪 UI(rehydrate 後 state.cgs 才有 dataUrl,需要重新渲染才看得到 CG)
  if (typeof renderSimpleSlideList === "function") renderSimpleSlideList();
  if (typeof renderSimpleEditor === "function") renderSimpleEditor();
  if (typeof reparseAndRender === "function" && state.mode === "detail") reparseAndRender(false);
  // 遷移成功後 saveToStorage 寫入的就是 stripped 版本,localStorage 自然瘦身
  if (typeof saveToStorage === "function") saveToStorage();

  // 確保有 currentProjectId(沒有就建立預設專案)
  await vnsEnsureDefaultProject();
  // 任務 1:讀回上次綁定的本地檔名(供狀態指示;handle 權限留待下次儲存時確認)
  if (typeof vnsInitBoundFileFromAppState === "function") await vnsInitBoundFileFromAppState();
  // 嘗試取得 Persistent Storage 權限(Chrome 通常自動給,Firefox 跳本機提示,Safari 不支援)
  await vnsRequestPersistentStorage();
  // 不支援 File System Access 的瀏覽器,首次進入提示降級體驗(只跳一次)
  maybeShowDowngradeNotice();
})();

// 降級體驗提示:只在不支援 File System Access 的瀏覽器、且使用者沒看過時跳一次。
function maybeShowDowngradeNotice() {
  if (state.browserCapabilities && state.browserCapabilities.fileSystemAccess) return;
  try {
    if (localStorage.getItem("vns_seen_downgrade_notice") === "1") return;
  } catch (e) {}
  if (typeof inlineConfirm !== "function") return;
  inlineConfirm({
    title: "💡 關於儲存體驗",
    message: { __html: `
      <p style="margin:0 0 12px">你目前使用的瀏覽器不支援檔案系統存取。</p>
      <p style="margin:0 0 12px">你仍可正常使用本工具,但按下「儲存」時:</p>
      <p style="margin:0 0 6px">✅ 仍可儲存作品為 .vns 檔案</p>
      <p style="margin:0 0 12px">⚠ 每次儲存都會下載新檔案(無法直接覆寫舊檔)</p>
      <p style="margin:0 0 12px">若希望獲得更好的體驗(一鍵覆寫舊檔),建議改用 Chrome 或 Edge 瀏覽器開啟。</p>
      <p style="margin:0">你的編輯仍會自動暫存在瀏覽器中,不會因為沒儲存就遺失。</p>
    ` },
    okText: "我知道了,繼續使用",
    hideCancel: true,
  });
  try { localStorage.setItem("vns_seen_downgrade_notice", "1"); } catch (e) {}
}

// ---------- CG 上傳工作流(高層) ----------

   // 單檔 10MB 上限

                   // 縮圖長邊上限


// 檔案合法性檢查 — 回傳 { ok: true } 或 { ok: false, reason: "..." }


// Canvas resize 產生縮圖 — 用 OffscreenCanvas(若不支援 fallback 到 HTMLCanvasElement)


// 高層工作流:驗證 → 產縮圖 → 寫入兩個 store → 回傳 { id, error? }
// UI 層只需 try { const { id } = await vnsAddCgFromFile(file); } 就完成上傳


// 從 cg id 取得可用於 <img src> 的 Object URL(取原圖)。
// 呼叫端用完務必 vnsRevokeCgUrl(url) 釋放,避免 Blob 記憶體洩漏。



// 列出 CG 縮圖供 CG 庫 modal 用 — 預先把縮圖轉成 Object URL 一次回傳,
// caller 顯示完後呼叫 vnsRevokeCgUrl 釋放每一筆。


// ---------- 配額監控 ----------

  // 預留 50MB 安全空間
let _vnsPersistentGranted = null;   // null=尚未檢查, true=已 grant, false=被拒







// 從各 store 估算各類資料總量(回傳 bytes)。
// 注意:IndexedDB 沒有直接的「per-store size」API,只能 sum 個別 record 的 blob.size。




// ---------- 自動儲存到 IndexedDB projects ----------

// 3 秒 debounce:使用者編輯多次只觸發一次寫入。
let _vnsAutoSaveTimer = null;
// 寫入失敗(配額爆)後停掉自動儲存,直到使用者手動重試或處理空間。
let _vnsAutoSaveStopped = false;

// 收集目前 state 的 project 子集 — 任務 9 會把 localStorage 與 IDB 的職責切乾淨;
// 在此之前先把 saveToStorage 的 payload 整份塞進來當作快照。


// 標記為髒,3 秒後寫入。多次呼叫會 reset timer。




// 給使用者「重試 / 處理空間後恢復」呼叫


// 把 state.cgs 序列化前剝掉 dataUrl 欄位 — 避免每張 CG 的 base64/blob URL
// 把 localStorage payload 灌爆(5MB 限制)。dataUrl 只在 runtime 由
// vnsRehydrateCgsFromLibrary 從 IndexedDB cg_library 重新生成 Object URL。


// 背景任務:把 state.cgs 內含 data:base64 但尚未有 cgId 的 entry 鏡到 cg_library。
// saveToStorage 後呼叫;不 await,讓使用者操作流暢,1~2 秒內完成持久化。


// 開機時呼叫 — 從 IndexedDB cg_library 為 state.cgs 補回 dataUrl(Object URL),
// 並把 legacy(localStorage 中的 base64 data URL)一次性遷移到 cg_library。


// localStorage 內是否曾有舊版幕資料 — 用來判斷首次啟動時是不是「遷移」情境


// 啟動時:若 app_state 內有 currentProjectId 且 project 還在 → 沿用;
// 否則建立預設專案,把當前 state 塞進去做為起點。
// 如果偵測到舊版 localStorage 資料,把預設專案命名為「舊的專案(自動遷移)」並推遲一則提示 toast。



// 刪除 CG 並把所有 projects 內引用此 cgId 的位置設為 null。
// 回傳 { affectedProjects: N } 供 UI 顯示影響範圍。


// ============================================================
//  Image utilities
// ============================================================



// Downscale large images to save space. Returns { dataUrl, width, height, original: {width, height}, scaled: bool }




// Attach drag-drop image upload to an element. handler(file) is async.


// ============================================================
//  Toast
// ============================================================



// ============================================================
//  Asset Manager UI
// ============================================================

// ----- Style modal (extracted from assets modal) -----
const styleModalEl = document.getElementById("styleModal");


// 語法速查 popover:點按鈕開關,點別處關閉
const btnSyntaxQuick = document.getElementById("btnSyntaxQuick");
const syntaxQuickPopover = document.getElementById("syntaxQuickPopover");
if (btnSyntaxQuick && syntaxQuickPopover) {
  btnSyntaxQuick.addEventListener("click", (e) => {
    e.stopPropagation();
    syntaxQuickPopover.hidden = !syntaxQuickPopover.hidden;
  });
  document.addEventListener("click", () => {
    syntaxQuickPopover.hidden = true;
  });
}

document.getElementById("btnStyle").addEventListener("click", openStyleModal);
document.getElementById("styleModalClose").addEventListener("click", closeStyleModal);
document.getElementById("styleModalDone").addEventListener("click", closeStyleModal);
styleModalEl.addEventListener("click", (e) => {
  if (e.target === styleModalEl) closeStyleModal();
});

// M8:字體預覽清單
// 字體預覽 — 純展示,不提供插入。要套用請到「全域預設樣式」或在劇本寫 [字型名]。


// M8:style modal tab 切換
(function initStyleModalTabs() {
  const modal = document.getElementById("styleModal");
  if (!modal) return;
  const tabs = modal.querySelectorAll(".style-tab");
  const panels = modal.querySelectorAll(".style-panel");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      tabs.forEach(t => t.classList.toggle("active", t === tab));
      panels.forEach(p => p.classList.toggle("active", p.dataset.tab === target));
    });
  });
})();

// O5:全域預設樣式分頁
// 四列(角色名 / 旁白 / 內心話 / 對話),每列字型 + 獨立 pt 字級。
// 字型存 state.styleDefaults[key].font,字級存 state.fontSizes[key]。
const STYLE_DEFAULT_FIELDS = [
  { key: "speaker",   font: "defSpeakerFont",   size: "fontSizeSpeaker",   label: "fontSizeSpeakerLabel" },
  { key: "narration", font: "defNarrationFont", size: "fontSizeNarration", label: "fontSizeNarrationLabel" },
  { key: "inner",     font: "defInnerFont",     size: "fontSizeInner",     label: "fontSizeInnerLabel" },
  { key: "dialog",    font: "defDialogFont",    size: "fontSizeDialog",    label: "fontSizeDialogLabel" },
  { key: "choice",    font: "defChoiceFont",    size: "fontSizeChoice",    label: "fontSizeChoiceLabel" },
];





// 樣式 modal 右側即時預覽:同步字級、字型、對話框形狀。
// 對話框背景/邊框/角色名色/文字色透過 :root 上的 --style-* CSS 變數
// 自動繼承,不需要在這裡 set。


(function initStyleDefaultsPanel() {
  for (const f of STYLE_DEFAULT_FIELDS) {
    // 字型 select(角色名沒有)
    if (f.font) {
      const fe = document.getElementById(f.font);
      if (fe) fe.addEventListener("change", () => {
        if (!state.styleDefaults[f.key]) state.styleDefaults[f.key] = { font: "" };
        state.styleDefaults[f.key].font = fe.value;
        saveToStorage();
        updateDefaultsPreview();
        reparseAndRender(false);
      });
    }
    // 字級 slider — 使用 input 事件做即時更新
    const se = document.getElementById(f.size);
    const le = document.getElementById(f.label);
    if (se) se.addEventListener("input", () => {
      const v = Math.max(12, Math.min(32, parseInt(se.value, 10) || 16));
      if (!state.fontSizes) state.fontSizes = { dialog: 18, speaker: 16, narration: 16, inner: 15 };
      state.fontSizes[f.key] = v;
      if (le) le.textContent = v + " pt";
      applyFontSizes();
      updateDefaultsPreview();
      saveToStorage();
      reparseAndRender(false);
    });
  }
})();

// 全域文字速度滑桿:即時更新數值與 state,不立即重播(下次播放/輸出才套用)。
(function initTextSpeedSlider() {
  const spd = document.getElementById("textSpeedRange");
  const spdLabel = document.getElementById("textSpeedLabel");
  if (!spd) return;
  spd.addEventListener("input", () => {
    const v = Math.max(0, Math.min(100, parseInt(spd.value, 10) || 0));
    if (!state.dialogStyle) state.dialogStyle = {};
    state.dialogStyle.textSpeed = v;
    if (spdLabel) spdLabel.textContent = String(v);
    saveToStorage();
  });
})();

applyFontSizes();
syncStyleDefaultsUI();

// ============================================================
// Batch 2:Style preset 套用
// ============================================================
// 取得「自訂」變體 — 若 customVariants[presetId] 不存在,以當前選中的變體為起點建立。


// 把自訂配色套到 basedOn 變體之上,組出一個 synthetic variant 物件。








// 建立自訂變體的 inline 顏色編輯區


(function initAnimationsToggle() {
  const cb = document.getElementById("animationsToggle");
  if (cb) {
    cb.checked = !!state.style.animationsEnabled;
    cb.addEventListener("change", () => {
      state.style.animationsEnabled = cb.checked;
      applyAnimationsToggle(cb.checked);
      saveToStorage();
    });
  }
})();

// ----- Settings modal (系統設定) -----
const settingsModalEl = document.getElementById("settingsModal");




// ----- 任務 1:本地檔案 儲存 / 開啟(File System Access)-----
const btnSaveFile = document.getElementById("btnSaveFile");
if (btnSaveFile) {
  // 差異化 tooltip:Chrome / Edge 可覆寫本地檔;其餘瀏覽器走下載
  const _fsa = (state.browserCapabilities && typeof state.browserCapabilities.fileSystemAccess === "boolean")
    ? state.browserCapabilities.fileSystemAccess
    : (typeof vnsFileSystemSupported === "function" && vnsFileSystemSupported());
  btnSaveFile.title = _fsa ? "儲存到本地檔案(Ctrl+S)" : "下載 .vns 檔案到本機(Ctrl+S)";
  btnSaveFile.addEventListener("click", () => { saveProject(); });
}
const btnOpenFile = document.getElementById("btnOpenFile");
if (btnOpenFile) {
  btnOpenFile.title = "開啟 .vns 檔案";
  btnOpenFile.addEventListener("click", () => { openProject(); });
}
// Ctrl/⌘ + S 儲存
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
    e.preventDefault();
    if (typeof saveProject === "function") saveProject();
  }
});

const btnSettings = document.getElementById("btnSettings");
if (btnSettings) btnSettings.addEventListener("click", openSettingsModal);
const settingsModalCloseEl = document.getElementById("settingsModalClose");
if (settingsModalCloseEl) settingsModalCloseEl.addEventListener("click", closeSettingsModal);
const settingsModalDoneEl = document.getElementById("settingsModalDone");
if (settingsModalDoneEl) settingsModalDoneEl.addEventListener("click", closeSettingsModal);
if (settingsModalEl) settingsModalEl.addEventListener("click", (e) => {
  if (e.target === settingsModalEl) closeSettingsModal();
});

// ----- 💾 儲存空間按鈕(管理 CG 庫 / 重新計算) -----
// 任務 1:「管理專案」入口移除(專案管理改為本地檔案 .vns + IndexedDB 暫存層)。
const storageManageCgsBtn = document.getElementById("storageManageCgs");
if (storageManageCgsBtn) storageManageCgsBtn.addEventListener("click", () => {
  // CG 庫 modal 在簡易模式重設計任務中建立;這裡先給溫和提示
  showToast("CG 庫管理介面將在簡易模式中提供", "info", 3000);
});
const storageRefreshBtn = document.getElementById("storageRefresh");
if (storageRefreshBtn) storageRefreshBtn.addEventListener("click", renderStorageSection);

// 任務 1:.vns 檔案格式版本(buildVnsBlobFromState / parseVnsZip 共用)
const VNS_EXPORT_FORMAT_VERSION = "1.0";
const VNS_APP_VERSION = "1.0.0";
// 設定 modal 內的「📦 匯出專案 / 📥 匯入 .vns」入口已移除,改用工具列「💾 儲存 / 📂 開啟」。

// ----- 拖曳 .vns / .vns.zip 到頁面任何位置自動載入(任務 1)-----
// capture phase:在其他 drop handler(CG dropzone 等)之前先攔截,
// 只在偵測到副檔名為 .vns 或 .vns.zip 時才消費事件,其他類型 fall through。
// 拖曳沒有可寫回的 handle → 載入到當前專案但不綁定本地檔(走 openVnsFromDroppedFile)。

document.addEventListener("dragover", (e) => {
  if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes("Files")) {
    // 拖曳檔案進來時不知道副檔名,只能 preventDefault 才能觸發 drop
    e.preventDefault();
  }
}, true);
document.addEventListener("drop", (e) => {
  const files = e.dataTransfer && e.dataTransfer.files;
  if (!files || !files.length) return;
  for (const f of files) {
    if (_vnsLooksLikeVnsFile(f)) {
      e.preventDefault();
      e.stopPropagation();
      openVnsFromDroppedFile(f);
      return;
    }
  }
  // 不是 .vns 檔 → 不消費,讓其他 handler(CG dropzone 等)處理
}, true);

// ----- 📁 我的專案 modal -----
const projectsModalEl = document.getElementById("projectsModal");









// 把 project.data(localStorage payload 同形狀)套回 state










// 任務 1:topbar「📁 我的專案」入口已移除;專案 modal 仍保留(供未來/內部),只是沒有開啟入口。
const projectsModalCloseEl = document.getElementById("projectsModalClose");
if (projectsModalCloseEl) projectsModalCloseEl.addEventListener("click", closeProjectsModal);
const projectsNewBtnEl = document.getElementById("projectsNewBtn");
if (projectsNewBtnEl) projectsNewBtnEl.addEventListener("click", newProjectFlow);
if (projectsModalEl) projectsModalEl.addEventListener("click", (e) => {
  if (e.target === projectsModalEl) closeProjectsModal();
});

// ----- Topbar "more" menu (重設 / 最近開啟) -----
const topbarMenuEl = document.getElementById("topbarMenu");
const btnMoreEl = document.getElementById("btnMore");
function closeTopbarMenu() { topbarMenuEl.hidden = true; }
btnMoreEl.addEventListener("click", (e) => {
  e.stopPropagation();
  topbarMenuEl.hidden = !topbarMenuEl.hidden;
  if (!topbarMenuEl.hidden) renderRecentList();
});

// ----- Recent projects (G7) -----
const RECENT_KEY = "otome-recent";



document.addEventListener("click", (e) => {
  if (topbarMenuEl.hidden) return;
  if (!topbarMenuEl.contains(e.target) && e.target !== btnMoreEl) closeTopbarMenu();
});
// 點任一 menu item(重設等)後關閉選單;各自的 handler 照常觸發。
topbarMenuEl.querySelectorAll(".topbar-menu-item").forEach(item => {
  item.addEventListener("click", closeTopbarMenu);
});

// state field defaults
state.bgOrder = ["黃昏", "教室", "夜晚"]; // preset order
state.cgOrder = [];

// try restore from storage
const restored = loadFromStorage();
if (!restored) {
  // 全新用戶:空白簡易版專案(顯示空狀態,等使用者上傳第一張 CG)
  state.mode = "simple";
}

// 套用樣式 / 字級 / 主題(主視圖渲染在檔末 renderMainView())
state.ratio = state.ratio || "16:9";
applyDialogStyle();
applyFontSizes();
syncStyleDefaultsUI();
applyStylePreset(state.style.preset, state.style.variant, { skipSave: true });
applyAnimationsToggle(state.style.animationsEnabled);
renderStylePresetGrid();
{
  const _animCb = document.getElementById("animationsToggle");
  if (_animCb) _animCb.checked = !!state.style.animationsEnabled;
}
updateStorageMeter();

// ============================================================
//  Inline Modal helpers (replaces native confirm/prompt)
// ============================================================
// Drop-in async replacements that match the otome theme.
// Resolves to:
//   inlineConfirm() → boolean
//   inlinePrompt()  → trimmed string OR null on cancel
//   inlineChoose()  → key of chosen option OR null









// Multi-choice picker — returns chosen key, or null on cancel.
// options: [{ key, label, desc?, danger? }]



// ============================================================
//  Script Editor — Unified Autocomplete & Keyboard Shortcuts
// ============================================================
// Single source of truth for the script editor's keyboard UX.
// Public surface:
//   ScriptEditor.refresh()  — re-detect popup context (used after
//                             external textarea mutations e.g. snippets)
//   ScriptEditor.isOpen()   — whether the popup is currently visible

// 簡易版只有一個主視圖:左側幕列表 + 右側編輯/預覽區。
function renderMainView() {
  const paneSimple = document.getElementById("paneSimple");
  if (paneSimple) paneSimple.hidden = false;
  renderSimpleSlideList();
  renderSimpleEditor();
}

// === 簡易模式:左側幕列表 ===


// IndexedDB CG 的 Object URL session cache:鍵=cgId,值=URL。
// 首次 sync 讀到 cgId 時若 cache miss,非同步 prefetch 並在 ready 後觸發重繪。
const _cgUrlCache = new Map();
const _cgUrlPending = new Set();



// === 簡易模式對話文字解析(任務 3)===
// 規則:
//   1. 段落分隔 = 空行(\n\n);段落內單 \n 視為換行
//   2. 整段被全/半形 (...) 完整包住 → inner monologue
//   3. `角色:內容` 或 `角色:(內心話)` → dialog 或 inner(帶 speaker)
//   4. 其他 → narration(無 speaker)
//   5. [bg:] / [cg:] / [選項] / [好感度] / [離場] / [聚光] 等場景指令在簡易模式不支援,
//      會被記錄在 unsupportedTags 供 UI 提示,內容仍當文字渲染。
//
// 樣式 tag [辰宇落雁] / [大] / [粗] / [微笑] 等保留在 content 內,
// 由任務 4 的渲染層或既有 parseLine 機制處理。




// 從一段已 trim 的文字解析出 parsed line。
// 回傳 { type, speaker?, content }




// 取幕的 CG 預覽 URL — 從 cg 物件或舊版 cgName fallback。
// 注意:cg.cgId 走 IndexedDB,首次 sync 讀回 null 並 prefetch,完成後會再重繪。


// 從 file 寫入 CG 庫 + 套到當前幕


// 從 CG 庫挑選一張套到當前幕








// 選項幕功能:幕編號標籤(1-based,補零)


// 選項幕功能:播放 / 輸出前的單幕檢查。回傳 true 才可繼續。
// action: "play" | "output"(僅影響文案)


// 選項幕功能:多幕輸出前檢查所有選項幕(GIF / MP4 用)。回傳 true 才可繼續。




// 選項幕功能:新增選項幕。CG 沿用上一幕(陣列最後一張),預設 2 個空選項,自動切到新幕




// 任務 10:鍵盤快捷鍵




// === 任務 7:輸出功能(截圖 / GIF / MP4)===





// CG 圖片 cache(避免 MP4 錄影時每 frame 重新 _vnsLoadImage)



// 把當前 slide(或指定 line + 部分文字 + 對話框 opacity)渲染到 canvas
// opts: { lineIdx, partialText, boxOpacity }


// 選項幕功能:把選項幕渲染到 canvas
// opts: { boxOpacity 0~1 整組透明度, selectedId 高亮者, fade 其他淡化, slideOffset 滑入量(h 比例) }


// 選項幕功能:依 CHOICE_TIMING 產生整段播放的 frame 描述(GIF / MP4 共用)
// 每個描述 = { boxOpacity, selectedId, fade, slideOffset }


// 截圖用:單 frame 不需動畫,先預載 CG 再 render




// MP4 / WebM 透過 MediaRecorder + canvas.captureStream 即時錄製
// 動畫時序與預覽相同:fade-in 300ms → typewriter 45ms/char → hold 500ms → fade-out 300ms




// 輸出進度浮層 — MP4 / GIF 共用




// 取消 / 強制關閉 — 立即終止編碼(abort worker / stop recorder)、關閉浮層、重置 state。
// 「×」即使編碼邏輯出問題也能強制脫離,不必重整頁面。
{
  function forceExitExport() {
    if (typeof _vnsExportCancel === "function") _vnsExportCancel();
    else if (typeof _vnsExportOverlayClose === "function") _vnsExportOverlayClose();
  }
  const cancelBtn = document.getElementById("vnsExportCancelBtn");
  if (cancelBtn) cancelBtn.addEventListener("click", forceExitExport);
  const closeBtn = document.getElementById("vnsExportCloseBtn");
  if (closeBtn) closeBtn.addEventListener("click", forceExitExport);
}

// 計算總 frame / line 數,給進度條用




document.addEventListener("keydown", (e) => {
  if (state.mode !== "simple") return;
  // 是否在輸入元素內(textarea / input / contenteditable):大部分快捷鍵讓給原生編輯
  const t = e.target;
  const inEditor = t && (
    t.tagName === "TEXTAREA" ||
    (t.tagName === "INPUT" && t.type !== "checkbox" && t.type !== "range") ||
    t.isContentEditable
  );

  // Esc:停止播放(任何情境都生效)
  if (e.key === "Escape" && _vnsSimplePlayback.playing) {
    e.preventDefault();
    stopSimplePlayback();
    return;
  }

  // Space:播放/暫停 — 只在「不在輸入區」時生效,避免吃掉空白鍵
  if (e.key === " " && !inEditor && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    if (_vnsSimplePlayback.playing) stopSimplePlayback();
    else startSimplePlayback();
    return;
  }

  // 以下需要 Ctrl/Meta
  if (!e.ctrlKey && !e.metaKey) return;

  // Ctrl + Enter:新增幕(輸入區內也允許,但選項輸入框讓給「標正解」快捷鍵)
  if (e.key === "Enter") {
    if (t && t.classList && t.classList.contains("simple-choice-input")) return;
    e.preventDefault();
    addSimpleSlide();
    return;
  }

  // Ctrl + Delete / Backspace:刪當前幕
  if (e.key === "Delete") {
    e.preventDefault();
    deleteCurrentSlideWithConfirm();
    return;
  }

  // Ctrl + (Shift?) + 上下:切換 / 移動
  if (e.key === "ArrowUp") {
    e.preventDefault();
    if (e.shiftKey) moveCurrentSlide("up");
    else navigateSimpleSlide("up");
    return;
  }
  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (e.shiftKey) moveCurrentSlide("down");
    else navigateSimpleSlide("down");
    return;
  }
}, true);

// === 簡易模式:右側編輯區 ===


// 選項幕功能:選項編輯介面(取代一般幕的對話 textarea)


// 切換正解:點未勾的→設為唯一正解;點已勾的→取消(變成無正解)


// 標為正解(不 toggle off)— Ctrl+Enter 快捷鍵用






// 選項幕功能:建立選項視覺元素(預覽與播放共用)
// opts: { correctHint?:bool 編輯時微妙提示正解, selectedId?:string 選中者, fade?:bool 其他淡化 }


// 選項幕功能:選項在預覽框的靜態呈現(編輯時)。正解有微妙提示(左側金線),
// 讓使用者知道哪個是正解,但不破壞「實際播放才顯現」的驚喜感。


// 任務 4:預覽渲染 helper + 文字機播放引擎



// 簡易版:人名一律使用對話框樣式的「角色名色」(全域),不分人物、不分顏色。
// (純靠 textarea「人名:對話」現抓現用,不建立角色資料、不做 per-character 配色)






// 選項幕功能:播放動畫時間軸(寫死,簡易版不開放調整)。總時長約 3.6 秒。






// 選項幕功能:播放選項動畫(淡入 → 停留 → 正解高亮 + 其他淡化 → 停留 → 淡出 → 切下一幕)










// 編輯區事件綁定 — 只綁一次
initSimpleEditorBindings();

// 任務 5:對話框樣式為全域(state.style),與當前幕無關。
// 切換幕時只需把底部工具列快選同步到全域樣式,不重套 CSS vars
//(全域樣式在啟動與專案切換時已 apply 過,切幕不改變樣式)。


// === 任務 5:底部工具列 — 全域對話框樣式快選 popover ===










// === CG 庫 modal ===
let _cgLibraryThumbUrls = [];  // 用於關閉時 revoke






const cgLibraryModalCloseEl = document.getElementById("cgLibraryModalClose");
if (cgLibraryModalCloseEl) cgLibraryModalCloseEl.addEventListener("click", closeCgLibraryModal);
const cgLibraryUploadBtnEl = document.getElementById("cgLibraryUploadBtn");
const cgLibraryUploadInputEl = document.getElementById("cgLibraryUploadInput");
if (cgLibraryUploadBtnEl && cgLibraryUploadInputEl) {
  cgLibraryUploadBtnEl.addEventListener("click", () => cgLibraryUploadInputEl.click());
  cgLibraryUploadInputEl.addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      const res = await vnsAddCgFromFile(file);
      if (!res.id) showToast(res.error || "上傳失敗", "warn", 4000);
      else await renderCgLibraryGrid();
    }
    e.target.value = "";
  });
}
const cgLibraryModalEl = document.getElementById("cgLibraryModal");
if (cgLibraryModalEl) cgLibraryModalEl.addEventListener("click", (e) => {
  if (e.target === cgLibraryModalEl) closeCgLibraryModal();
});

// 設定 modal 內「🖼 管理 CG 庫」按鈕改成真的開 CG 庫 modal
{
  const _btn = document.getElementById("storageManageCgs");
  if (_btn) {
    // 移除前一個 toast handler 並接上正確的開 modal 行為
    const fresh = _btn.cloneNode(true);
    _btn.parentNode.replaceChild(fresh, _btn);
    fresh.addEventListener("click", () => {
      closeSettingsModal();
      openCgLibraryModal();
    });
  }
}






let __simpleSyncTimer = null;



// ----- Style picker overlay (Task 4.5) -----


// ----- CG picker overlay (Task 4.7) -----
let __cgPickerTargetCardIdx = -1;

(function initCgPicker() {
  const overlay = document.getElementById("cgPickerOverlay");
  const close = document.getElementById("cgPickerClose");
  const upload = document.getElementById("cgPickerUpload");
  if (close) close.addEventListener("click", () => overlay.hidden = true);
  if (overlay) overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.hidden = true; });
  if (upload) upload.addEventListener("click", () => {
    const f = document.createElement("input");
    f.type = "file";
    f.accept = "image/*";
    f.addEventListener("change", async () => {
      const file = f.files && f.files[0];
      if (!file) return;
      const dataUrl = await readFileAsDataURL(file);
      const scaled = await downscaleImage(dataUrl, 1600);
      const cgName = `CG-${Date.now()}`;
      state.cgs[cgName] = { dataUrl: scaled };
      if (!state.cgOrder.includes(cgName)) state.cgOrder.push(cgName);
      if (__cgPickerTargetCardIdx >= 0 && state.simpleCards[__cgPickerTargetCardIdx]) {
        state.simpleCards[__cgPickerTargetCardIdx].cgName = cgName;
      }
      syncSimpleToScript();
      renderSimpleCards();
      overlay.hidden = true;
      updateStorageMeter();
    });
    f.click();
  });
})();

// ----- First card flow / drop / upload (Task 4.6) -----




(function initSimplePaneInteractions() {
  // 上傳按鈕
  const upload = document.getElementById("simpleEmptyUpload");
  if (upload) upload.addEventListener("click", () => {
    const f = document.createElement("input");
    f.type = "file";
    f.accept = "image/*";
    f.addEventListener("change", async () => {
      const file = f.files && f.files[0];
      if (file) await startFirstCardFlow(file);
    });
    f.click();
  });

  // 新增一張
  const addBtn = document.getElementById("simpleAddCardBtn");
  if (addBtn) addBtn.addEventListener("click", () => {
    const last = state.simpleCards[state.simpleCards.length - 1];
    const lastDialog = last && last.dialogs[last.dialogs.length - 1];
    state.simpleCards.push({
      cgName: last ? last.cgName : null,
      dialogs: [{ speaker: lastDialog ? lastDialog.speaker : null, text: "" }],
    });
    syncSimpleToScript();
    renderSimpleCards();
    setTimeout(() => {
      const allTextareas = document.querySelectorAll(".simple-dialog-text");
      const target = allTextareas[allTextareas.length - 1];
      if (target) target.focus();
    }, 30);
  });

  // 拖曳上傳
  const simplePane = document.getElementById("paneSimple");
  if (simplePane) {
    simplePane.addEventListener("dragover", (e) => {
      e.preventDefault();
      simplePane.classList.add("dragover");
    });
    simplePane.addEventListener("dragleave", (e) => {
      if (e.target === simplePane) simplePane.classList.remove("dragover");
    });
    simplePane.addEventListener("drop", async (e) => {
      e.preventDefault();
      simplePane.classList.remove("dragover");
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file || !file.type.startsWith("image/")) return;
      if (!state.simpleCards.length) await startFirstCardFlow(file);
      else await addCardWithCg(file);
    });
  }

  // 錄影按鈕 — 重用既有錄影流程
  const rec = document.getElementById("simpleRecord");
  if (rec) rec.addEventListener("click", () => {
    syncSimpleToScript();
    document.getElementById("btnRecord")?.click();
  });

  // 預覽全部
  const prevAll = document.getElementById("simplePreviewAll");
  if (prevAll) prevAll.addEventListener("click", openPreviewAll);
})();

// ----- Preview-all overlay (Task 4.8) -----






(function initPreviewAll() {
  const close = document.getElementById("previewAllClose");
  const prev = document.getElementById("previewAllPrev");
  const next = document.getElementById("previewAllNext");
  const pp = document.getElementById("previewAllPlayPause");
  const overlay = document.getElementById("previewAllOverlay");
  if (close) close.addEventListener("click", () => {
    if (previewAllState.timer) clearTimeout(previewAllState.timer);
    previewAllState.playing = false;
    if (overlay) overlay.hidden = true;
  });
  if (prev) prev.addEventListener("click", () => playPreviewAllAt(Math.max(0, previewAllState.idx - 1)));
  if (next) next.addEventListener("click", () => playPreviewAllAt(Math.min(state.simpleCards.length - 1, previewAllState.idx + 1)));
  if (pp) pp.addEventListener("click", () => {
    previewAllState.playing = !previewAllState.playing;
    updatePreviewAllPlayBtn();
    if (previewAllState.playing) playPreviewAllAt(previewAllState.idx);
    else if (previewAllState.timer) clearTimeout(previewAllState.timer);
  });
})();

// ----- 啟動 -----
// 本站只有簡易版。強制 simple,並把舊版(或詳細版).vns 內的 script 還原成簡易版幕。
state.mode = "simple";
document.documentElement.setAttribute("data-mode", "simple");
// 載入時:有 script 但沒有 simpleCards → 嘗試把劇本還原成卡片(舊 .vns 相容)
if ((!state.simpleCards || !state.simpleCards.length) && state.script && state.script.trim()) {
  const cards = scriptToCards(state.script);
  if (cards !== null) state.simpleCards = cards;
}
// 首次開啟工具(無歷史標記)且沒有任何幕 → 自動建立一張空白幕,讓使用者直接進入編輯。
// 之後(已標記)沿用既有資料;使用者主動刪光則維持回到空狀態。
ensureInitialSlide();
renderMainView();

// 首次開啟偵測:只在從未初始化過、且當前無幕時自動建一張空幕(沿用 createEmptySlide 預設值)
function ensureInitialSlide() {
  const FIRST_OPEN_KEY = "vns_simple_has_initialized";
  let hasInit = false;
  try { hasInit = localStorage.getItem(FIRST_OPEN_KEY) === "1"; } catch (e) {}
  if (hasInit) return;                       // 已初始化過 → 不自動建
  try { localStorage.setItem(FIRST_OPEN_KEY, "1"); } catch (e) {}
  if (Array.isArray(state.simpleCards) && state.simpleCards.length > 0) return;  // 已有幕(載入專案)→ 不重複建
  if (!Array.isArray(state.simpleCards)) state.simpleCards = [];
  const slide = createEmptySlide();
  state.simpleCards.push(slide);
  state.simpleCurrentSlideId = slide.id;
  if (typeof saveToStorage === "function") saveToStorage();
}

// ============================================================
// Batch 6:Status bar + 手機橫滑
// ============================================================







setInterval(refreshSaveTimeDisplay, 10000);
updateStatusBar();
refreshSaveTimeDisplay();
