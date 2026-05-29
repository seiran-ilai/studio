"use strict";

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

window.__ensureCaretVisible = ensureCaretVisible;

// ----- Editor syntax highlight overlay (G1) -----


// M11:把 [tag] 區塊轉成 highlight HTML,樣式 tag 用紫色 .sh-style-tag




const _shEl = document.getElementById("scriptHighlight");

els.scriptArea.addEventListener("scroll", () => {
  if (!_shEl) return;
  _shEl.scrollTop = els.scriptArea.scrollTop;
  _shEl.scrollLeft = els.scriptArea.scrollLeft;
});



const RATIO_KEY = "otome-ratio";


// events
els.scriptArea.addEventListener("input", (e) => {
  state.script = e.target.value;
  reparseAndRender(false);
});

// 輸入法組字狀態(L4)— ensureCaretVisible 在組字中不捲動
els.scriptArea.addEventListener("compositionstart", () => {
  els.scriptArea.dataset.composing = "true";
});
els.scriptArea.addEventListener("compositionend", () => {
  els.scriptArea.dataset.composing = "false";
});

// ----- Bidirectional binding: script cursor <-> preview line -----

// Find the latest parsed step whose source line is at or before `rawLineNo`.




let cursorSyncTimer = null;
let suppressCursorSync = false;


els.scriptArea.addEventListener("click", scheduleCursorSync);
els.scriptArea.addEventListener("keyup", (e) => {
  if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(e.key)) {
    scheduleCursorSync();
  }
});

// Highlight the source line of the currently-previewed step in the textarea.
const scriptHighlightEl = document.getElementById("scriptCurrentLine");

els.scriptArea.addEventListener("scroll", updateScriptLineHighlight);
window.addEventListener("resize", updateScriptLineHighlight);

// Auto-scroll script to current line when preview advances (but not while editing)
let lastScrolledStep = -1;


// Hook into renderAt — every preview update refreshes the highlight + auto-scrolls.
const _origRenderAt = renderAt;
renderAt = function(idx) {
  _origRenderAt(idx);
  updateScriptLineHighlight();
  autoScrollScriptToCurrentLine();
};

// Run highlight once after install (init already happened above).
requestAnimationFrame(updateScriptLineHighlight);
window.addEventListener("load", updateScriptLineHighlight);

// snippet insertion buttons
const SNIPPETS = {
  bg: `\n[bg: ]\n`,
  exit: `\n[離場]\n`,
  cg: `\n[cg: ]\n旁白文字…\n[cg off]\n`,
  cgoff: `\n[cg off]\n`,
  cgsolo: `\n[cg solo: ]\n旁白文字…\n[cg off]\n`,
  cgfull: `\n[cg full: ]\n[cg off]\n`,
  choices: `\n[選項]\n- 選項一\n- 選項二\n- * 最終選擇（加 * 標記）\n`,
  light: `\n[聚光]\n`,
  unknown: `角色名[?]：他的聲音很陌生。\n`,
};

// Where (relative to inserted text end) the cursor should land for each snippet.
// negative = chars from end of insertion. null = stay at end.
const SNIPPET_CURSOR_OFFSET = {
  bg: -2,       // place inside `[bg: |]\n`
  cg: -("\n旁白文字…\n[cg off]\n".length + 1),  // inside `[cg: |]`
  cgsolo: -("\n旁白文字…\n[cg off]\n".length + 1),  // inside `[cg solo: |]`
  cgfull: -("\n[cg off]\n".length + 1),  // inside `[cg full: |]`
};



document.querySelectorAll(".snippet-btn").forEach(b => {
  b.addEventListener("click", () => insertSnippet(b.dataset.snippet));
});

// CG variant dropdown
const cgMoreBtn = document.getElementById("cgMoreBtn");
const cgMenu = document.getElementById("cgMenu");
if (cgMoreBtn && cgMenu) {
  cgMoreBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    cgMenu.toggleAttribute("hidden");
  });
  cgMenu.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      insertSnippet(btn.dataset.snippet);
      cgMenu.setAttribute("hidden", "");
    });
  });
  document.addEventListener("click", (e) => {
    if (!cgMenu.contains(e.target) && e.target !== cgMoreBtn) {
      cgMenu.setAttribute("hidden", "");
    }
  });
}

// Split stage into 3 zones: left ~25% = prev, middle = next (default), right ~25% = next
// We also have explicit hover chevrons at left/right edges.
els.stage.addEventListener("click", (e) => {
  const rect = els.stage.getBoundingClientRect();
  const xRatio = (e.clientX - rect.left) / rect.width;
  if (xRatio < 0.22) prevLine();
  else nextLine();
});
document.getElementById("stageNavLeft").addEventListener("click", (e) => { e.stopPropagation(); prevLine(); });
document.getElementById("stageNavRight").addEventListener("click", (e) => { e.stopPropagation(); nextLine(); });

// First-time "click to continue" hint (shown once, then remembered)
const HINT_SHOWN_KEY = "otome-stage-hint-shown";
if (!localStorage.getItem(HINT_SHOWN_KEY)) {
  const hint = document.getElementById("stageHint");
  if (hint) {
    hint.removeAttribute("hidden");
    setTimeout(() => hint.remove(), 3500);
    els.stage.addEventListener("click", () => {
      localStorage.setItem(HINT_SHOWN_KEY, "1");
    }, { once: true });
  }
}

// Counter → slider popup to jump to any beat
let _jumpPopupCloser = null;
function closeJumpPopup() {
  const p = document.getElementById("previewJumpPopup");
  if (p) p.remove();
  if (_jumpPopupCloser) {
    els.stage.removeEventListener("click", _jumpPopupCloser);
    _jumpPopupCloser = null;
  }
}
document.getElementById("previewCounter").addEventListener("click", (e) => {
  e.stopPropagation();
  if (document.getElementById("previewJumpPopup")) { closeJumpPopup(); return; }
  if (state.parsed.length === 0) return;
  const stage = els.stage;
  const popup = document.createElement("div");
  popup.id = "previewJumpPopup";
  popup.className = "preview-jump-popup";
  popup.innerHTML =
    `<div class="jump-label">跳到第 <strong id="jumpVal">1</strong> 拍 / <span id="jumpMax">1</span></div>` +
    `<input type="range" id="jumpRange" min="1" value="1">`;
  popup.addEventListener("click", (ev) => ev.stopPropagation());
  stage.appendChild(popup);
  const range = popup.querySelector("#jumpRange");
  range.max = state.parsed.length;
  range.value = state.currentIndex + 1;
  popup.querySelector("#jumpMax").textContent = state.parsed.length;
  popup.querySelector("#jumpVal").textContent = state.currentIndex + 1;
  range.addEventListener("input", (ev) => {
    popup.querySelector("#jumpVal").textContent = ev.target.value;
    jumpToBeat(parseInt(ev.target.value, 10) - 1);
  });
  // click anywhere else on the stage closes the popup
  setTimeout(() => {
    _jumpPopupCloser = (ev) => {
      if (!popup.contains(ev.target) && ev.target.id !== "previewCounter") closeJumpPopup();
    };
    stage.addEventListener("click", _jumpPopupCloser);
  }, 0);
});

// Keyboard navigation — only when textarea is NOT focused
document.addEventListener("keydown", (e) => {
  // skip if any text input or modal is active
  const ae = document.activeElement;
  const inText = ae && (ae.tagName === "TEXTAREA" || ae.tagName === "INPUT" || ae.isContentEditable);
  if (inText) return;
  // skip if a modal is open
  if (document.querySelector(".modal-backdrop.show, .inline-modal-backdrop.show")) return;
  if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " " || e.key === "Enter") {
    e.preventDefault();
    nextLine();
  } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
    e.preventDefault();
    prevLine();
  } else if (e.key === "Home") {
    e.preventDefault();
    jumpToStart();
  } else if (e.key === "Escape") {
    // if the choices overlay is showing, dismiss it
    const overlay = document.getElementById("choicesOverlay");
    if (overlay && overlay.classList.contains("show")) {
      e.preventDefault();
      overlay.classList.remove("show");
    }
  }
});

document.querySelectorAll(".ratio-toggle button").forEach(b => {
  b.addEventListener("click", () => setRatio(b.dataset.ratio));
});

// ----- Reset actions: split into script-only / style-only / full -----
document.getElementById("btnResetScript").addEventListener("click", async () => {
  const ok = await inlineConfirm({
    title: "只重設劇本",
    message: "確定要清空劇本？角色、背景、CG、樣式都會保留。此動作不可復原。",
    okText: "清空劇本",
    danger: true,
  });
  if (!ok) return;
  setScript("");
  saveToStorage();
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
  // 任務 1:File System Access API 只支援 Chrome / Edge。不支援就全屏擋下,不做退化下載。
  if (typeof vnsFileSystemSupported === "function" && !vnsFileSystemSupported()) {
    const fsBlock = document.getElementById("vns-fs-block");
    if (fsBlock) fsBlock.classList.add("show");
    return;
  }
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
})();

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

const modalEl = document.getElementById("assetsModal");







// ----- Dialog box style customization -----





// Batch 3:好感度數值平滑動畫(三次方緩出 ease-out)














// (對話框預設 / 自訂底色的 live input wiring 已隨 UI 一併移除)

// ----- Character list -----

// Close any open card menu when clicking outside one (registered once).
document.addEventListener("click", () => {
  document.querySelectorAll(".card-menu").forEach(m => { m.hidden = true; });
});

// Build a "⋯" dropdown menu. items: [{label, danger?, sep?, onClick}]


// Count how many times `name` is used as a speaker (line head + [ or :).


// Batch-upload portraits: each picked file's base name = emotion.


// ----- Rename → optionally sync the script -----




// applyData(): commit the rename to data. revert(): undo UI on cancel.








// M7:撞名保護 — 表情名稱與系統樣式 tag 同名時警告




// Trigger file upload for a specific character's emotion
let pendingUpload = null;


document.getElementById("charImgInput").addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file || !pendingUpload) return;
  await applyCharImageUpload(file, pendingUpload.ch, pendingUpload.emoName);
  pendingUpload = null;
});



// ----- Background list -----







document.getElementById("bgImgInput").addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file || !pendingUpload) return;
  await applyBgImageUpload(file, pendingUpload.key);
  pendingUpload = null;
});



// ----- Add buttons -----

document.getElementById("addCharBtn").addEventListener("click", async () => {
  const kind = await inlineChoose({
    title: "新增角色類型",
    message: "要新增什麼類型的角色?",
    options: [
      { key: "supporting", label: "配角", desc: "有立繪、有表情" },
      { key: "protagonist", label: "主角", desc: "無立繪、可寫內心話" },
    ],
  });
  if (!kind) return;
  const isProtag = kind === "protagonist";
  const name = await inlinePrompt({
    title: isProtag ? "新增主角" : "新增配角",
    message: "輸入角色名稱（可在劇本中作為說話者）",
    placeholder: isProtag ? "例如:我、菖莉亞" : "例如:學長、同學、神秘人",
    validate: (v) => {
      if (!v) return "請輸入角色名";
      if (state.characters.find(c => c.name === v)) return "已有同名角色";
      return null;
    },
  });
  if (!name) return;
  const colors = ["#c4a265", "#d4869a", "#8b9fd4", "#a8d486", "#b888d4", "#d4b886"];
  const used = state.characters.map(c => c.color);
  const color = isProtag
    ? "#d4869a"
    : (colors.find(c => !used.includes(c)) || colors[Math.floor(Math.random() * colors.length)]);
  state.characters.push({
    id: (isProtag ? "protagonist_" : "char_") + Date.now(),
    name,
    kind,
    color,
    emotions: isProtag ? [] : ["普通"],
    portraits: {},
    portraitY: 0,
    portraitScale: 100,
  });
  saveToStorage();
  renderCharList();
});

document.getElementById("addBgBtn").addEventListener("click", async () => {
  const name = await inlinePrompt({
    title: "新增背景",
    message: "輸入背景名稱（劇本中用 [bg: 名稱] 切換），按確認後選圖片",
    placeholder: "例如:海邊、咖啡廳",
    validate: (v) => {
      if (!v) return "請輸入背景名";
      if (state.backgrounds[v]) return "已有同名背景";
      return null;
    },
  });
  if (!name) return;
  // placeholder preset to occupy slot — will be overwritten by upload
  state.backgrounds[name] = { type: "preset", className: "stage-bg-default" };
  state.bgOrder.push(name);
  saveToStorage();
  renderBgList();
  // auto-trigger upload
  triggerBgImageUpload(name);
});

// ----- CG list -----







document.getElementById("cgImgInput").addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file || !pendingUpload) return;
  await applyCgImageUpload(file, pendingUpload.key);
  pendingUpload = null;
});



document.getElementById("addCgBtn").addEventListener("click", async () => {
  const name = await inlinePrompt({
    title: "新增 CG 圖卡",
    message: "輸入 CG 名稱（劇本中用 [cg: 名稱] 顯示），按確認後選圖片",
    placeholder: "例如:告白、初吻、回憶",
    validate: (v) => {
      if (!v) return "請輸入 CG 名";
      if (state.cgs[v]) return "已有同名 CG";
      return null;
    },
  });
  if (!name) return;
  state.cgs[name] = { dataUrl: null };
  if (!state.cgOrder.includes(name)) state.cgOrder.push(name);
  saveToStorage();
  renderCgList();
  triggerCgImageUpload(name);
});

// ----- Modal open/close -----

document.getElementById("btnChars").addEventListener("click", () => openModal("chars"));
document.getElementById("modalClose").addEventListener("click", closeModal);
document.getElementById("modalDoneBtn").addEventListener("click", closeModal);
modalEl.addEventListener("click", (e) => {
  if (e.target === modalEl) closeModal();
});
document.querySelectorAll(".tab").forEach(t => {
  t.addEventListener("click", () => switchTab(t.dataset.tab));
});

// ----- Style modal (extracted from assets modal) -----
const styleModalEl = document.getElementById("styleModal");


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
// 字型存 state.styleDefaults[key].font(角色名無字型),字級存 state.fontSizes[key]。
const STYLE_DEFAULT_FIELDS = [
  { key: "speaker",   font: null,               size: "fontSizeSpeaker",   label: "fontSizeSpeakerLabel" },
  { key: "narration", font: "defNarrationFont", size: "fontSizeNarration", label: "fontSizeNarrationLabel" },
  { key: "inner",     font: "defInnerFont",     size: "fontSizeInner",     label: "fontSizeInnerLabel" },
  { key: "dialog",    font: "defDialogFont",    size: "fontSizeDialog",    label: "fontSizeDialogLabel" },
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

// ----- Interface theme (G2) -----
const THEME_KEY = "otome-theme";

// 任務 4:全新使用者預設白晝;已用過的(有既有存檔或曾設定過主題)維持紫月。
let _initialTheme = localStorage.getItem(THEME_KEY);
if (!_initialTheme) {
  _initialTheme = localStorage.getItem(STORAGE_KEY) ? "violet" : "daylight";
}
applyTheme(_initialTheme);
document.querySelectorAll(".theme-btn").forEach(b => {
  b.addEventListener("click", () => applyTheme(b.dataset.theme));
});

// ----- Settings modal (系統設定:介面主題等) -----
const settingsModalEl = document.getElementById("settingsModal");




// ----- 任務 1:本地檔案 儲存 / 開啟(File System Access)-----
const btnSaveFile = document.getElementById("btnSaveFile");
if (btnSaveFile) {
  btnSaveFile.title = "儲存到本地檔案(Ctrl+S)";
  btnSaveFile.addEventListener("click", () => { saveToVnsFile(); });
}
const btnOpenFile = document.getElementById("btnOpenFile");
if (btnOpenFile) {
  btnOpenFile.title = "從本地檔案開啟 .vns";
  btnOpenFile.addEventListener("click", () => { openVnsFile(); });
}
// Ctrl/⌘ + S 儲存
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
    e.preventDefault();
    if (typeof saveToVnsFile === "function") saveToVnsFile();
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

// ----- Syntax help modal -----
const syntaxModalEl = document.getElementById("syntaxModal");

// N5：開啟時預設選第一個 tab、折疊所有 details
document.getElementById("btnSyntaxHelp").addEventListener("click", () => {
  const tabs = syntaxModalEl.querySelectorAll(".syntax-tab");
  const panels = syntaxModalEl.querySelectorAll(".syntax-panel");
  tabs.forEach((t, i) => t.classList.toggle("active", i === 0));
  panels.forEach((p, i) => p.classList.toggle("active", i === 0));
  syntaxModalEl.querySelectorAll("details").forEach(d => d.removeAttribute("open"));
  syntaxModalEl.classList.add("show");
});
document.getElementById("syntaxModalClose").addEventListener("click", () => {
  syntaxModalEl.classList.remove("show");
});
syntaxModalEl.addEventListener("click", (e) => {
  if (e.target === syntaxModalEl) syntaxModalEl.classList.remove("show");
});

// N3：syntax modal tab 切換
(function initSyntaxModalTabs() {
  const modal = document.getElementById("syntaxModal");
  if (!modal) return;
  const tabs = modal.querySelectorAll(".syntax-tab");
  const panels = modal.querySelectorAll(".syntax-panel");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      tabs.forEach(t => t.classList.toggle("active", t === tab));
      panels.forEach(p => p.classList.toggle("active", p.dataset.tab === target));
    });
  });
})();

// N4：「試試看」按鈕 — 插入語法到劇本游標處、關閉 modal、游標跟到插入點
(function initSyntaxTryButtons() {
  const modal = document.getElementById("syntaxModal");
  if (!modal) return;
  modal.querySelectorAll(".syntax-try").forEach(btn => {
    btn.addEventListener("click", () => {
      const insertText = btn.dataset.insert || "";
      if (!insertText) return;

      const ta = els.scriptArea;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;

      const before = ta.value.substring(0, start);
      const after = ta.value.substring(end);
      ta.value = before + insertText + after;

      const newPos = start + insertText.length;
      ta.selectionStart = newPos;
      ta.selectionEnd = newPos;

      // 觸發 input,讓 reparse / 自動儲存等邏輯啟動
      ta.dispatchEvent(new Event("input", { bubbles: true }));

      modal.classList.remove("show");

      ta.focus();
      if (typeof ensureCaretVisible === "function") {
        ensureCaretVisible(ta, newPos, "nearest");
      }
    });
  });
})();

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

// ----- Mobile pane switch tabs -----
document.querySelectorAll(".mobile-pane-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.pane;
    document.querySelectorAll(".mobile-pane-tab").forEach(t =>
      t.classList.toggle("active", t === tab));
    document.querySelector(".pane-script")
      .classList.toggle("mobile-active", target === "script");
    document.querySelector(".pane-preview")
      .classList.toggle("mobile-active", target === "preview");
  });
});

// ============================================================
//  Canvas Renderer (used by screenshot AND recording)
// ============================================================
//  Replicates the visual stage onto a canvas, so we can:
//   - download as PNG (screenshot)
//   - captureStream() it to MediaRecorder (recording)
//
//  Output dimensions:
//    16:9 → 1280x720
//    9:16 →  720x1280

const RENDER_SIZES = {
  "16:9": { w: 1280, h: 720 },
  "9:16": { w: 720, h: 1280 },
};

// Preset background drawing functions (matching CSS gradients).


// Image cache so we don't recreate on every frame
const imageCache = new Map();



// Preload everything currently in state — call before screenshot/recording


// Draw a placeholder portrait silhouette (matches the SVG version visually).




// Wrap text into lines that fit within maxWidth.


// O5:依 segment 組 canvas font 字串(套用行級 large/small/bold/italic + 句中覆寫)


// O5:句中 Markdown 的 segment 感知換行 → 視覺行陣列 [[{text,font}]]




// Render the stage to a canvas given a "frame" object:
//   { bg, slots: {左,中,右}, dialog: {speaker, text, color, isNarration} | null, activeCharId }
// Returns the canvas (caller can toDataURL it or stream it).
// 立繪取景(Canvas)— 與 DOM 同公式:scale 等比、正 portraitY 往下沉,
// 以底部中心為錨點;超出舞台會被裁切。預設 y0/scale100 → 與原本完全相同。




// Draws the choices overlay onto the canvas. Items are objects of:
//   { text, isFinal, shown: bool|undefined }
// If shown===false, the item is skipped (not yet revealed in animation).




// 取得當前風格 variant(找不到回 null)


// Canvas counterpart of the DOM .dialog-box[data-shape] styles (H3.5).


// Canvas counterpart of the DOM fake game UI (H4.7).




// Build a "frame" from current state at given line index


// ============================================================
//  Screenshot
// ============================================================

document.getElementById("btnScreenshot").addEventListener("click", async () => {
  if (!state.parsed.length) {
    showToast("劇本是空的", "warn");
    return;
  }
  const beatNo = state.currentIndex + 1;
  const total = state.parsed.length;
  showToast(`📸 正在繪製第 ${beatNo} / ${total} 拍...`, "", 1500);
  // 截圖不要 anti-dedup pixel（R3）
  window.__recAntiDedup = false;
  try {
    await preloadAllAssets();
    await preloadFontsForRecording();
    const canvas = document.createElement("canvas");
    canvas.dataset.renderScale = "2"; // 2x 解析度提升截圖品質（影片維持原解析度）
    const frame = buildFrameAt(state.currentIndex);
    await renderFrameToCanvas(canvas, frame);
    const dim = `${canvas.width}×${canvas.height}`;
    canvas.toBlob((blob) => {
      if (!blob) { showToast("截圖失敗", "warn"); window.__recAntiDedup = true; return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `visual-novel-studio-${timestamp()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast(`✨ 已截取第 ${beatNo} 拍 (${dim})`, "success");
      window.__recAntiDedup = true;
    }, "image/png");
  } catch (e) {
    console.error(e);
    showToast("截圖失敗:" + e.message, "warn", 4000);
    window.__recAntiDedup = true;
  }
});



// ============================================================
//  任務 1:舊的 JSON「匯出專案 / 匯入專案」入口已移除。
//  專案的儲存與載入改由工具列「💾 儲存 / 📂 開啟」走本地 .vns 檔案
//  (見 saveToVnsFile / openVnsFile / openVnsFromDroppedFile)。
//  「最近開啟」清單仍透過 applyImportedPayload 還原(projects.js)。
// ============================================================

// ============================================================
//  Recording: MediaRecorder + Canvas Animation
// ============================================================



// 60fps 下，每字至少佔 4 幀 ≈ 66ms，遠大於平台 frame-dedup 閾值（防跳字）

// 結尾保險時間：持續繪製最後一幀，確保 MediaRecorder 收到完整 tail


// Read the start/end radio + number selections → beat index range.


// detect best supported mime type for output




// Estimate total duration of the script when animated.






// ----- Open record settings modal -----

document.getElementById("btnRecord").addEventListener("click", () => {
  if (!state.parsed.length) {
    showToast("劇本是空的", "warn");
    return;
  }
  recState.preferredMime = detectMimeType();
  if (!recState.preferredMime) {
    showToast("此瀏覽器不支援錄影,請用 Chrome/Edge/Safari 桌面版", "warn", 4000);
    return;
  }
  updateRecordFormatInfo();
  // seed range controls
  const total = state.parsed.length;
  document.getElementById("recCurrentBeat").textContent = String(state.currentIndex + 1);
  const endBeatInput = document.getElementById("recEndBeat");
  endBeatInput.max = String(total);
  endBeatInput.value = String(total);
  const headRadio = document.querySelector('input[name="recStart"][value="head"]');
  const lastRadio = document.querySelector('input[name="recEnd"][value="last"]');
  if (headRadio) headRadio.checked = true;
  if (lastRadio) lastRadio.checked = true;
  updateEstimate();
  document.getElementById("recordModal").classList.add("show");
});

document.getElementById("recordModalClose").addEventListener("click", () => {
  document.getElementById("recordModal").classList.remove("show");
});
document.getElementById("recordModal").addEventListener("click", (e) => {
  if (e.target.id === "recordModal") {
    document.getElementById("recordModal").classList.remove("show");
  }
});

// sliders

document.getElementById("typeSpeed").addEventListener("input", (e) => {
  recState.typeSpeed = parseInt(e.target.value, 10);
  document.getElementById("typeSpeedLabel").textContent = speedLabel(recState.typeSpeed);
  updateEstimate();
});
document.getElementById("holdTime").addEventListener("input", (e) => {
  recState.holdTime = parseFloat(e.target.value);
  document.getElementById("holdTimeLabel").textContent = `${recState.holdTime.toFixed(1)} 秒`;
  updateEstimate();
});
document.getElementById("bgHold").addEventListener("input", (e) => {
  recState.bgHold = parseFloat(e.target.value);
  document.getElementById("bgHoldLabel").textContent = `${recState.bgHold.toFixed(1)} 秒`;
  updateEstimate();
});
// start/end range controls → live re-estimate
document.querySelectorAll('input[name="recStart"], input[name="recEnd"]').forEach(r => {
  r.addEventListener("change", updateEstimate);
});
document.getElementById("recEndBeat").addEventListener("input", () => {
  const custom = document.querySelector('input[name="recEnd"][value="custom"]');
  if (custom) custom.checked = true;
  updateEstimate();
});

// ----- Start recording -----

document.getElementById("recordStartBtn").addEventListener("click", async () => {
  const range = getRecordRange();
  recState.startBeat = range.startBeat;
  recState.endBeat = range.endBeat;
  document.getElementById("recordModal").classList.remove("show");
  await beginRecording();
});

document.getElementById("recStopBtn").addEventListener("click", () => {
  recState.stopRequested = true;
});

// M19:錄影前等劇本用到的所有字體完成載入,避免影片出現 fallback 字體




// ----- Animation driver -----
// Walks through state.parsed, drawing each frame to the canvas.
// For each dialog line: typewriter effect, then hold, then advance.
// For bg/exit: brief hold, then continue.



// Animate the choices sequence:
//  - each item appears with 0.6s gap
//  - after all shown, hold ~0.6s, then highlight final and hold 1.2s










// ----- Result modal -----



document.getElementById("resultModalClose").addEventListener("click", () => {
  const modal = document.getElementById("resultModal");
  const video = document.getElementById("resultVideo");
  modal.classList.remove("show");
  if (video.src) {
    URL.revokeObjectURL(video.src);
    video.src = "";
  }
});

// also save script on input (debounced)
let scriptSaveTimer = null;
els.scriptArea.addEventListener("input", () => {
  setSaveIndicator("dirty");
  if (scriptSaveTimer) clearTimeout(scriptSaveTimer);
  scriptSaveTimer = setTimeout(saveToStorage, 500);
});

// ============================================================
//  Init
// ============================================================

// state field defaults
state.bgOrder = ["黃昏", "教室", "夜晚"]; // preset order
state.cgOrder = [];

// try restore from storage
const restored = loadFromStorage();
if (!restored) {
  state.script = SAMPLE_SCRIPT;
  // Batch 6:全新用戶 → 直接進簡易模式
  state.mode = "simple";
}

// apply ratio — prefer the explicitly remembered toggle, else restored/default
setRatio(localStorage.getItem(RATIO_KEY) || state.ratio || "16:9");
els.scriptArea.value = state.script;
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
reparseAndRender(true);
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

initScriptEditor();

// ============================================================
//  O4:分類候選 popup(角色 / 指令 / 可選欄位,Tab 循環)
//  由 O3 handleTab 透過 window.show* 觸發。自成系統,
//  開啟期間 ScriptEditor 模組會讓位(window.__catPopupOpen)。
// ============================================================
(() => {
  const ta = els.scriptArea;

  const POS_TAGS_ORDERED = ["中", "左", "右"];   // 中為預設
  const MYSTERY_OPTS = ["替代名"];   // 純中括號別名:插入 [替代名] 後直接改字
  const OPTIONAL_FIELDS = ["position", "mystery", "font", "size", "emphasis"];
  const FIELD_LABELS = {
    position: "📍 位置",
    mystery: "🎭 替代名",
    font: "🎨 字體",
    size: "📏 大小",
    emphasis: "💪 粗斜",
  };

  let popupState = { open: false };
  let tabFieldIndex = -1;

  const popup = document.createElement("div");
  popup.className = "se-cat-popup";
  popup.style.display = "none";
  document.body.appendChild(popup);

  // ---- 行 / 角色工具 ----
  function getCurrentLineInfo(t) {
    const pos = t.selectionStart;
    const lineStart = t.value.lastIndexOf("\n", pos - 1) + 1;
    const le = t.value.indexOf("\n", pos);
    const lineEnd = le === -1 ? t.value.length : le;
    return { pos, lineStart, lineEnd, lineText: t.value.substring(lineStart, lineEnd) };
  }

  function knownCharNames() {
    return state.characters.map(c => c.name);
  }
  function emotionsOf(name) {
    const c = state.characters.find(x => x.name === name);
    return (c && c.emotions) || [];
  }
  function isCharacterProtagonist(name) {
    const c = state.characters.find(x => x.name === name);
    return !!(c && c.kind === "protagonist");
  }

  function parseAllTagsOnLine(lineText, knownCharacters, getEmos) {
    const tags = [];
    const re = /\[([^\]]+)\]/g;
    let m, idx = 0, charNameSoFar = null;
    while ((m = re.exec(lineText)) !== null) {
      const tag = m[1];
      let kind = "unknown";
      if (idx === 0 && knownCharacters.includes(tag)) {
        kind = "character"; charNameSoFar = tag;
      } else if (POS_TAGS_ORDERED.includes(tag)) kind = "position";
      else if (tag === "?" || tag.startsWith("?:") || tag === "？" || /^[?？]/.test(tag)) kind = "mystery";
      else if (FONT_TAG_NAMES.includes(tag)) kind = "font";
      else if (SIZE_TAG_NAMES.includes(tag)) kind = "size";
      else if (EMPHASIS_TAG_NAMES.includes(tag)) kind = "emphasis";
      else if (charNameSoFar && getEmos(charNameSoFar).includes(tag)) kind = "emotion";
      tags.push({ start: m.index, end: m.index + m[0].length, text: m[0], inner: tag, kind, idx });
      idx++;
    }
    return { tags, charName: charNameSoFar };
  }

  function getUsedFields(lineText) {
    const { tags, charName } = parseAllTagsOnLine(lineText, knownCharNames(), emotionsOf);
    const used = new Set();
    for (const t of tags) {
      if (["character", "emotion", "position", "mystery", "font", "size"].includes(t.kind)) {
        used.add(t.kind);
      }
      // emphasis 不加入 used(可重複,但同名不可)
    }
    return { used, charName, tags };
  }

  function getRemainingOptionalFields(used, charName, isProtagonist) {
    return OPTIONAL_FIELDS.filter(f => {
      if (f === "emphasis") return true;            // 粗斜永遠出現
      if (used.has(f)) return false;
      if (isProtagonist && (f === "position" || f === "mystery")) return false;
      return true;
    });
  }

  function getCurrentEmphasisTags(lineText) {
    return [...lineText.matchAll(/\[([^\]]+)\]/g)]
      .map(x => x[1]).filter(t => EMPHASIS_TAG_NAMES.includes(t));
  }

  // 往上找最近的對話前綴(用於「接續說話」)
  function findLastDialogPrefix() {
    const { lineStart } = getCurrentLineInfo(ta);
    const above = ta.value.slice(0, lineStart).split("\n");
    for (let i = above.length - 1; i >= 0; i--) {
      const m = above[i].match(/^(\s*(?:[^\[\]:：\n]+)?(?:\[[^\]\n]*\])+)\s*[:：]/);
      if (m) return m[1].trim();
    }
    return null;
  }

  // ---- 定位 ----
  function positionPopupAtCaret() {
    let r = null;
    try { r = window.ScriptEditor && window.ScriptEditor.caretRect(); } catch (e) {}
    if (!r) return;
    popup.style.visibility = "hidden";
    popup.style.display = "block";
    const pr = popup.getBoundingClientRect();
    let top = r.top + r.lineHeight + 4;
    let left = r.left;
    if (top + pr.height > window.innerHeight - 8) top = r.top - pr.height - 4;
    if (left + pr.width > window.innerWidth - 8) left = window.innerWidth - pr.width - 8;
    popup.style.top = Math.max(8, top) + "px";
    popup.style.left = Math.max(8, left) + "px";
    popup.style.visibility = "visible";
  }

  // ---- 渲染 ----
  function showCategorizedPopup(sections, selectedIdx = 0, insertContext = null, cycleCtx = null) {
    popup.innerHTML = "";
    let totalIdx = 0;
    const allItems = [];
    for (const sec of sections) {
      const secDiv = document.createElement("div");
      secDiv.className = "popup-section";
      if (sec.title) {
        const t = document.createElement("div");
        t.className = "popup-section-title";
        t.textContent = sec.title;
        secDiv.appendChild(t);
      }
      for (const item of sec.items) {
        const div = document.createElement("div");
        let cls = "popup-item";
        if (item.skip) cls += " skip";
        if (item.disabled) cls += " disabled";
        div.className = cls;
        const text = document.createElement("span");
        text.textContent = item.text;
        div.appendChild(text);
        if (item.badge) {
          const b = document.createElement("span");
          b.className = "popup-item-badge";
          b.textContent = item.badge;
          div.appendChild(b);
        }
        const myIdx = totalIdx++;
        div.dataset.idx = myIdx;
        if (myIdx === selectedIdx) div.classList.add("selected");
        div.addEventListener("mouseenter", () => {
          if (item.disabled) return;
          popupState.selectedIdx = myIdx;
          refreshSelected();
        });
        div.addEventListener("mousedown", (e) => {
          e.preventDefault();
          if (!item.disabled) acceptItem(item, insertContext);
        });
        secDiv.appendChild(div);
        allItems.push(item);
      }
      popup.appendChild(secDiv);
    }
    const hintBar = document.createElement("div");
    hintBar.className = "popup-hint-bar";
    hintBar.innerHTML = cycleCtx
      ? '<kbd>↑↓</kbd> 移動 · <kbd>Tab</kbd> 下一類 · <kbd>↵</kbd> 接受 · <kbd>Esc</kbd> 關閉'
      : '<kbd>↑↓</kbd> 移動 · <kbd>↵</kbd>/<kbd>Tab</kbd> 接受 · <kbd>Esc</kbd> 關閉';
    popup.appendChild(hintBar);

    popupState = { open: true, items: allItems, selectedIdx, insertContext, cycle: cycleCtx };
    window.__catPopupOpen = true;
    positionPopupAtCaret();
  }

  function refreshSelected() {
    popup.querySelectorAll(".popup-item").forEach((el, i) => {
      el.classList.toggle("selected", i === popupState.selectedIdx);
    });
  }

  // ---- 三種場景 ----
  function showCharacterAndCommandPopup() {
    const sections = [
      {
        title: "👤 角色",
        items: knownCharNames().map(c => ({ text: `[${c}]`, val: `[${c}]` })),
      },
      {
        title: "🎬 指令",
        items: [
          { text: "[bg: ]", val: "[bg: " },
          { text: "[cg: ]", val: "[cg: " },
          { text: "[cg off]", val: "[cg off]\n" },
          { text: "[離場]", val: "[離場]\n" },
          { text: "[聚光]", val: "[聚光]\n" },
          { text: "[同亮]", val: "[同亮]\n" },
          { text: "[全暗]", val: "[全暗]\n" },
        ],
      },
    ];
    const lastPrefix = findLastDialogPrefix();
    if (lastPrefix) {
      sections.unshift({
        title: "⏎ 接續說話",
        items: [{ text: lastPrefix + "：", val: lastPrefix + "：" }],
      });
    }
    tabFieldIndex = -1;
    showCategorizedPopup(sections, 0);
  }

  function showOptionalFieldPopup() {
    const { lineText } = getCurrentLineInfo(ta);
    const { used, charName } = getUsedFields(lineText);
    const isProt = isCharacterProtagonist(charName);

    // 還沒選表情且不是主角 → 強制選表情
    if (used.has("character") && !used.has("emotion") && !isProt) {
      const emos = emotionsOf(charName);
      if (emos.length > 0) {
        tabFieldIndex = -1;
        showCategorizedPopup([{
          title: "😊 " + charName + " 的表情(必選)",
          items: emos.map(e => ({ text: `[${e}]`, val: `[${e}]` })),
        }], 0);
        return;
      }
    }

    const remaining = getRemainingOptionalFields(used, charName, isProt);
    cycleOptionalField(remaining, lineText, null);
  }

  function showOptionalFieldPopupBeforeColon(colonIdx) {
    const { lineText, lineStart } = getCurrentLineInfo(ta);
    const insertAbsPos = lineStart + colonIdx;
    const { used, charName } = getUsedFields(lineText);
    const isProt = isCharacterProtagonist(charName);
    const remaining = getRemainingOptionalFields(used, charName, isProt);
    cycleOptionalField(remaining, lineText, insertAbsPos);
  }

  function cycleOptionalField(remaining, lineText, insertAbsPos) {
    if (remaining.length === 0) {
      hidePopup();
      if (insertAbsPos === null) { insertAtCursor("："); commit(); }
      return;
    }
    tabFieldIndex = (tabFieldIndex + 1) % remaining.length;
    const field = remaining[tabFieldIndex];
    const currentEmphasis = getCurrentEmphasisTags(lineText);
    const fieldOptions = {
      position: POS_TAGS_ORDERED.map(p => ({ text: `[${p}]`, val: `[${p}]` })),
      mystery: MYSTERY_OPTS.map(x => ({ text: `[${x}]`, val: `[${x}]` })),
      font: FONT_TAG_NAMES.map(f => ({ text: `[${f}]`, val: `[${f}]` })),
      size: SIZE_TAG_NAMES.map(s => ({ text: `[${s}]`, val: `[${s}]` })),
      emphasis: EMPHASIS_TAG_NAMES.map(e => ({
        text: `[${e}]`, val: `[${e}]`,
        disabled: currentEmphasis.includes(e),
        badge: currentEmphasis.includes(e) ? "已選" : null,
      })),
    };
    const sections = [
      {
        title: "",
        items: [{
          text: insertAbsPos === null ? "⏭ 跳過,開始打台詞" : "⏭ 跳過,不加 tag",
          val: insertAbsPos === null ? "：" : "",
          skip: true,
        }],
      },
      {
        title: FIELD_LABELS[field] + "  (Tab 跳下一類,循環)",
        items: fieldOptions[field],
      },
    ];
    showCategorizedPopup(sections, 0, { insertAbsPos }, { remaining, lineText, insertAbsPos });
  }

  // ---- 接受 / 插入 ----
  function insertAtCursor(text) {
    const pos = ta.selectionStart;
    ta.value = ta.value.substring(0, pos) + text + ta.value.substring(ta.selectionEnd);
    ta.selectionStart = ta.selectionEnd = pos + text.length;
  }

  function commit() {
    state.script = ta.value;
    reparseAndRender(false);
    saveToStorage();
    if (typeof ensureCaretVisible === "function") ensureCaretVisible(ta, ta.selectionStart, "nearest");
  }

  function acceptItem(item, insertContext) {
    if (item.skip) {
      hidePopup();
      if (item.val === "：") { insertAtCursor("："); commit(); }
      return;
    }
    if (insertContext && insertContext.insertAbsPos !== null && insertContext.insertAbsPos !== undefined) {
      const p = insertContext.insertAbsPos;
      ta.value = ta.value.substring(0, p) + item.val + ta.value.substring(p);
      ta.selectionStart = ta.selectionEnd = p + item.val.length;
    } else {
      insertAtCursor(item.val);
    }
    hidePopup();
    commit();
    ta.focus();
    setTimeout(maybeShowNextStep, 0);
  }

  function hidePopup() {
    popup.style.display = "none";
    popupState = { open: false };
    tabFieldIndex = -1;
    window.__catPopupOpen = false;
  }

  // 接受角色 tag 後,若該行只有角色名(非主角、有表情)→ 自動帶出表情
  function maybeShowNextStep() {
    if (popupState.open) return;
    const { lineText, pos, lineEnd } = getCurrentLineInfo(ta);
    if (pos !== lineEnd) return;
    const trimmed = lineText.trim();
    if (!/^\[[^\]\n]+\]$/.test(trimmed)) return;          // 只有單一 tag
    const { used, charName } = getUsedFields(lineText);
    if (!used.has("character") || used.has("emotion")) return;
    if (isCharacterProtagonist(charName)) return;
    if (emotionsOf(charName).length === 0) return;
    showOptionalFieldPopup();
  }

  // ---- popup 開啟時的鍵盤行為 ----
  ta.addEventListener("keydown", (e) => {
    if (!popupState.open) return;

    if (e.key === "Escape") {
      e.preventDefault(); e.stopPropagation();
      hidePopup();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault(); e.stopPropagation();
      const n = popupState.items.length;
      if (n === 0) return;
      let next = popupState.selectedIdx;
      let guard = 0;
      do {
        next = e.key === "ArrowDown" ? (next + 1) % n : (next - 1 + n) % n;
        guard++;
      } while (popupState.items[next] && popupState.items[next].disabled && guard <= n);
      popupState.selectedIdx = next;
      refreshSelected();
      return;
    }
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault(); e.stopPropagation();
      // 可選欄位 popup:Tab = 跳下一類(循環);其餘:Tab = 接受
      if (popupState.cycle) {
        const c = popupState.cycle;
        cycleOptionalField(c.remaining, c.lineText, c.insertAbsPos);
      } else {
        const item = popupState.items[popupState.selectedIdx];
        if (item && !item.disabled) acceptItem(item, popupState.insertContext);
      }
      return;
    }
    if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault(); e.stopPropagation();
      if (popupState.cycle) {
        const c = popupState.cycle;
        // 往前一類:抵銷 cycleOptionalField 內的 +1
        tabFieldIndex = (tabFieldIndex - 2 + c.remaining.length * 2) % c.remaining.length;
        cycleOptionalField(c.remaining, c.lineText, c.insertAbsPos);
      }
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault(); e.stopPropagation();
      const item = popupState.items[popupState.selectedIdx];
      if (item && !item.disabled) acceptItem(item, popupState.insertContext);
      return;
    }
    // 其他可輸入的鍵 → 關閉 popup,讓使用者繼續打字
    if (e.key === "Backspace" || e.key === "Delete" || e.key.length === 1) {
      hidePopup();
    }
  });

  ta.addEventListener("blur", () => {
    setTimeout(() => { if (popupState.open) hidePopup(); }, 150);
  });

  // 暴露給 O3 handleTab 的觸發點
  window.showCharacterAndCommandPopup = showCharacterAndCommandPopup;
  window.showOptionalFieldPopup = showOptionalFieldPopup;
  window.showOptionalFieldPopupBeforeColon = showOptionalFieldPopupBeforeColon;
})();

// ============================================================
//  O5:反白整行 → 浮動樣式 popup(行級套樣式,取代不堆積)
// ============================================================
(() => {
  const ta = els.scriptArea;
  const popup = document.getElementById("floatStylePopup");
  if (!ta || !popup) return;

  let lastSelection = null;
  let popupCooldown = false;
  const CMD_LINE_RE = /^\[(bg|cg|cg\s+off|cg\s+full|離場|聚光|同亮|全暗)/i;

  function knownChars() { return state.characters.map(c => c.name); }

  // ---- 反白偵測:只接受整行 / 多行 ----
  function getRowSelectionInfo() {
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start === end) return null;
    const text = ta.value.substring(start, end);
    if (!text.trim()) return null;
    const beforeStart = ta.value.lastIndexOf("\n", start - 1) + 1;
    const afterEnd = ta.value.indexOf("\n", end);
    const lineEndPos = afterEnd === -1 ? ta.value.length : afterEnd;
    const startsAtLineHead = start === beforeStart;
    const endsAtLineTail = end === lineEndPos || end === ta.value.length || ta.value[end] === "\n";
    const hasNewline = text.includes("\n");
    const isLineLevel = (startsAtLineHead && endsAtLineTail) || hasNewline;
    if (!isLineLevel) return null;
    return { start, end, text };
  }

  function checkSelectionForFloatPopup() {
    if (popupCooldown) return;
    if (window.__catPopupOpen) return;          // 候選 popup 開著時不跳
    const sel = getRowSelectionInfo();
    if (sel) showFloatStylePopup(sel);
    else hideFloatStylePopup();
  }

  ta.addEventListener("mouseup", () => setTimeout(checkSelectionForFloatPopup, 10));
  ta.addEventListener("keyup", (e) => {
    if (e.shiftKey || ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
      setTimeout(checkSelectionForFloatPopup, 10);
    } else {
      hideFloatStylePopup();
    }
  });
  ta.addEventListener("input", () => hideFloatStylePopup());

  // ---- 範圍工具 ----
  function selectionRowRange() {
    const { start, end } = lastSelection;
    const beforeStart = ta.value.lastIndexOf("\n", start - 1) + 1;
    const afterEnd = ta.value.indexOf("\n", end);
    const realEnd = afterEnd === -1 ? ta.value.length : afterEnd;
    return { beforeStart, realEnd };
  }

  function extractStyleTagsFromLine(line) {
    const tags = [];
    const kc = knownChars();
    const firstTag = line.match(/^\[([^\]]+)\]/);
    const isDialog = firstTag && kc.includes(firstTag[1]);
    let pos = isDialog ? firstTag[0].length : 0;
    while (pos < line.length) {
      const m = line.substring(pos).match(/^\[([^\]]+)\]/);
      if (!m) break;
      const inner = m[1];
      if (STYLE_TAG_NAMES.has(inner)) {
        tags.push({ name: inner, start: pos, end: pos + m[0].length });
        pos += m[0].length;
      } else if (isDialog) {
        pos += m[0].length;             // 對話的表情/位置等非樣式 tag,跳過續找
      } else {
        break;                          // 旁白:遇非樣式 tag 停止
      }
    }
    return tags;
  }

  function getCurrentStylesInSelection() {
    const empty = { fonts: new Set(), sizes: new Set(), emphasis: new Set() };
    if (!lastSelection) return empty;
    const { beforeStart, realEnd } = selectionRowRange();
    const middle = ta.value.substring(beforeStart, realEnd);
    const fonts = new Set(), sizes = new Set(), emphasis = new Set();
    middle.split("\n").forEach(line => {
      extractStyleTagsFromLine(line).forEach(t => {
        if (FONT_TAG_NAMES.includes(t.name)) fonts.add(t.name);
        if (SIZE_TAG_NAMES.includes(t.name)) sizes.add(t.name);
        if (EMPHASIS_TAG_NAMES.includes(t.name)) emphasis.add(t.name);
      });
    });
    return { fonts, sizes, emphasis };
  }

  function removeTagsByKind(line, kind) {
    const tags = extractStyleTagsFromLine(line);
    let result = line;
    for (let i = tags.length - 1; i >= 0; i--) {
      const t = tags[i];
      let match = false;
      if (kind === "font" && FONT_TAG_NAMES.includes(t.name)) match = true;
      else if (kind === "size" && SIZE_TAG_NAMES.includes(t.name)) match = true;
      else if (kind === "emphasis" && EMPHASIS_TAG_NAMES.includes(t.name)) match = true;
      else if (kind === "all") match = STYLE_TAG_NAMES.has(t.name);
      if (match) result = result.substring(0, t.start) + result.substring(t.end);
    }
    return result;
  }

  function removeSpecificTag(line, tagName) {
    const tags = extractStyleTagsFromLine(line);
    let result = line;
    for (let i = tags.length - 1; i >= 0; i--) {
      if (tags[i].name === tagName) {
        result = result.substring(0, tags[i].start) + result.substring(tags[i].end);
      }
    }
    return result;
  }

  function insertStyleTagIntoLine(line, tagText, kc) {
    const firstTag = line.match(/^\[([^\]]+)\]/);
    const isDialog = firstTag && kc.includes(firstTag[1]);
    if (isDialog) {
      let pos = 0;
      while (pos < line.length) {
        const m = line.substring(pos).match(/^\[[^\]]+\]/);
        if (!m) break;
        pos += m[0].length;
      }
      return line.substring(0, pos) + tagText + line.substring(pos);
    }
    return tagText + line;
  }

  function commitRange(newText, beforeStart, realEnd) {
    ta.value = ta.value.substring(0, beforeStart) + newText + ta.value.substring(realEnd);
    ta.selectionStart = ta.selectionEnd = beforeStart + newText.length;
    popupCooldown = true;
    setTimeout(() => { popupCooldown = false; }, 200);
    hideFloatStylePopup();
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    ta.focus();
  }

  function mapRows(transform) {
    if (!lastSelection) return;
    const { beforeStart, realEnd } = selectionRowRange();
    const middle = ta.value.substring(beforeStart, realEnd);
    const newText = middle.split("\n").map(line => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (CMD_LINE_RE.test(trimmed)) return line;
      return transform(line);
    }).join("\n");
    commitRange(newText, beforeStart, realEnd);
  }

  function applyLineLevelTag(tagName, kind) {
    const kc = knownChars();
    mapRows(line => insertStyleTagIntoLine(removeTagsByKind(line, kind), `[${tagName}]`, kc));
  }

  function toggleLineLevelTag(tagName) {
    const kc = knownChars();
    mapRows(line => {
      const tags = extractStyleTagsFromLine(line);
      return tags.some(t => t.name === tagName)
        ? removeSpecificTag(line, tagName)
        : insertStyleTagIntoLine(line, `[${tagName}]`, kc);
    });
  }

  function clearAllLineLevelStyles() {
    mapRows(line => removeTagsByKind(line, "all"));
  }

  // ---- 渲染 ----
  function appendSection(label, options, activeSet, onClick) {
    const lab = document.createElement("div");
    lab.className = "fsp-section-label";
    lab.textContent = label;
    popup.appendChild(lab);
    const grid = document.createElement("div");
    grid.className = "fsp-buttons";
    for (const name of options) {
      const btn = document.createElement("button");
      btn.className = "fsp-btn" + (activeSet.has(name) ? " active" : "");
      btn.textContent = name;
      btn.addEventListener("mousedown", e => { e.preventDefault(); onClick(name); });
      grid.appendChild(btn);
    }
    popup.appendChild(grid);
  }

  function showFloatStylePopup(selInfo) {
    lastSelection = selInfo;
    popup.innerHTML = "";
    popup.style.display = "block";

    const info = document.createElement("div");
    info.className = "fsp-mode-info";
    info.innerHTML = "📋 行級樣式 · 套用會<strong>取代</strong>同類舊樣式";
    popup.appendChild(info);

    const status = getCurrentStylesInSelection();
    appendSection("🎨 字體", FONT_TAG_NAMES, status.fonts, (n) => applyLineLevelTag(n, "font"));
    appendSection("📏 大小", SIZE_TAG_NAMES, status.sizes, (n) => applyLineLevelTag(n, "size"));
    appendSection("💪 粗斜(切換)", EMPHASIS_TAG_NAMES, status.emphasis, (n) => toggleLineLevelTag(n));

    const clearBtn = document.createElement("button");
    clearBtn.className = "fsp-btn clear-btn";
    clearBtn.textContent = "✕ 清除所有樣式";
    clearBtn.addEventListener("mousedown", e => { e.preventDefault(); clearAllLineLevelStyles(); });
    popup.appendChild(clearBtn);

    positionFloatPopupAtSelection();
  }

  function positionFloatPopupAtSelection() {
    let r = null;
    try { r = window.ScriptEditor && window.ScriptEditor.caretRect(); } catch (e) {}
    popup.style.position = "fixed";
    if (!r) {
      const tr = ta.getBoundingClientRect();
      r = { top: tr.top + 20, left: tr.left + 20, lineHeight: 18 };
    }
    popup.style.visibility = "hidden";
    const pr = popup.getBoundingClientRect();
    let top = r.top + r.lineHeight + 6;
    let left = r.left;
    if (top + pr.height > window.innerHeight - 8) top = Math.max(8, r.top - pr.height - 6);
    if (left + pr.width > window.innerWidth - 8) left = window.innerWidth - pr.width - 8;
    popup.style.top = Math.max(8, top) + "px";
    popup.style.left = Math.max(8, left) + "px";
    popup.style.visibility = "visible";
  }

  function hideFloatStylePopup() {
    popup.style.display = "none";
    lastSelection = null;
  }

  // 點 popup 以外處 → 關閉
  document.addEventListener("mousedown", (e) => {
    if (popup.style.display === "none") return;
    if (popup.contains(e.target) || e.target === ta) return;
    hideFloatStylePopup();
  });
})();

// ============================================================
//  立繪取景器(Y 軸 + 縮放,全表情共用)
// ============================================================

window.PortraitCropper = PortraitCropper;
PortraitCropper.init();

// ============================================================
// Batch 4:簡易模式(Simple Mode)
// ============================================================








// 簡易模式 ↔ 細節模式 = 兩個獨立工具流程。切換時不轉換、不互通,
// 若當前模式有內容,先警告並由使用者確認清空。
// (這與舊版的 cardsToScript / scriptToCards 雙向轉換不同)


async function switchMode(newMode) {
  if (newMode === state.mode) return;
  if (vnsCurrentModeHasContent()) {
    const fromLabel = state.mode === "simple" ? "簡易模式的幕" : "細節模式劇本";
    const toLabel = newMode === "simple" ? "簡易模式" : "細節模式";
    const ok = await inlineConfirm({
      title: "切換模式?",
      message: `切換到「${toLabel}」會清空當前的${fromLabel}。\n\n此操作無法復原。建議先用「📦 匯出專案」備份,或到「📁 我的專案」開另一個專案使用其他模式。\n\n是否繼續?`,
      okText: "確認切換",
      danger: true,
    });
    if (!ok) return;
  }
  // 確認後清空當前模式的資料(另一個模式的欄位不動,讓未來切回時還能保留先前狀態)
  if (state.mode === "simple") {
    state.simpleCards = [];
  } else {
    state.script = "";
    if (els.scriptArea) els.scriptArea.value = "";
  }
  state.mode = newMode;
  document.documentElement.setAttribute("data-mode", newMode);
  document.querySelectorAll(".mode-btn").forEach(b => b.classList.toggle("active", b.dataset.mode === newMode));
  saveToStorage();
  renderMainView();
}

function renderMainView() {
  const simple = state.mode === "simple";
  const paneSimple = document.getElementById("paneSimple");
  if (paneSimple) paneSimple.hidden = !simple;
  document.querySelectorAll(".pane-script").forEach(p => p.style.display = simple ? "none" : "");
  document.querySelectorAll(".pane-preview").forEach(p => p.style.display = simple ? "none" : "");
  // mobile pane tabs 在簡易模式也藏
  const mobTabs = document.querySelector(".mobile-pane-tabs");
  if (mobTabs) mobTabs.style.display = simple ? "none" : "";
  // 任務 5:簡易版 topbar = [Logo] 狀態 [🎨樣式][⚙設定] │ [📂開啟][💾儲存]。
  //   - 樣式 / 設定 / 開啟 / 儲存:兩個模式都顯示(樣式為高頻入口,常駐)。
  //   - 素材(管理立繪/背景)、截圖 / 錄影(讀 state.parsed 的細節版輸出):
  //     僅細節版顯示,簡易版用底部工具列輸出(預覽/截圖/GIF/MP4)。
  const topbarDetailOnly = [
    document.getElementById("btnChars"),
    document.getElementById("btnScreenshot"),
    document.getElementById("btnRecord"),
    document.querySelector(".topbar-divider-detail"),
  ];
  topbarDetailOnly.forEach(el => { if (el) el.style.display = simple ? "none" : ""; });
  if (simple) {
    renderSimpleSlideList();
    renderSimpleEditor();
  } else {
    reparseAndRender(false);
  }
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




// 取消按鈕 — 設旗標,輸出迴圈下次檢查時中斷
{
  const cancelBtn = document.getElementById("vnsExportCancelBtn");
  if (cancelBtn) cancelBtn.addEventListener("click", () => {
    if (_vnsExportState.running) {
      _vnsExportState.cancelled = true;
      _vnsExportSetProgress("取消中…請稍候", 0);
    } else {
      _vnsExportOverlayClose();
    }
  });
}

// 計算總 frame / line 數,給進度條用




// GIF:用 gif.js(CDN)逐 frame 編碼


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

// ----- Mode buttons (Task 4.1) -----
document.querySelectorAll(".mode-btn").forEach(btn => {
  btn.addEventListener("click", () => switchMode(btn.dataset.mode));
});

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

// ----- 啟動時套用 mode -----
// 細節版暫時隱藏:強制以簡易版顯示。原本的 state.script(細節版劇本)保留不清,
// 未來細節版上線、切換鈕加回後,使用者切到 detail 即可還原。
if (state.mode !== "simple") state.mode = "simple";
document.documentElement.setAttribute("data-mode", state.mode);
document.querySelectorAll(".mode-btn").forEach(b => b.classList.toggle("active", b.dataset.mode === state.mode));
// 載入時:若是 simple 模式 + 有 script 但沒有 simpleCards,嘗試還原卡片
if (state.mode === "simple" && (!state.simpleCards || !state.simpleCards.length) && state.script && state.script.trim()) {
  const cards = scriptToCards(state.script);
  if (cards !== null) state.simpleCards = cards;
}
renderMainView();

// ============================================================
// Batch 5:預覽播放控制
// ============================================================


const PLAYBACK_TYPE_SPEED = 45;   // ms / char
const PLAYBACK_HOLD_MS = 1500;
const PLAYBACK_CHOICE_PER = 600;
const PLAYBACK_CHOICE_TAIL = 1200;



















// ----- 按鈕事件 (Task 5.4) -----
(function initPlaybackBindings() {
  const pp = document.getElementById("playbackPlayPause");
  const prev = document.getElementById("playbackPrev");
  const next = document.getElementById("playbackNext");
  const speed = document.getElementById("playbackSpeed");
  const progress = document.getElementById("playbackProgress");
  if (pp) pp.addEventListener("click", () => {
    if (playbackState.playing) pausePlayback();
    else startPlayback();
  });
  if (prev) prev.addEventListener("click", () => {
    pausePlayback();
    jumpToStep(Math.max(0, playbackState.currentStep - 1));
  });
  if (next) next.addEventListener("click", () => {
    pausePlayback();
    const steps = getPlayableSteps();
    jumpToStep(Math.min(steps.length - 1, playbackState.currentStep + 1));
  });
  if (speed) speed.addEventListener("change", (e) => {
    const newSpeed = parseFloat(e.target.value) || 1;
    if (playbackState.playing) {
      // 維持當前進度感受 — 重設 stepStartTime 把現有 elapsed 換算成新速度的起點
      const elapsed = (performance.now() - playbackState.stepStartTime) * playbackState.speed;
      playbackState.speed = newSpeed;
      playbackState.stepStartTime = performance.now() - (elapsed / newSpeed);
    } else {
      playbackState.speed = newSpeed;
    }
  });
  if (progress) progress.addEventListener("input", (e) => {
    const pct = parseFloat(e.target.value) / 100;
    const total = getTotalDuration();
    const targetMs = pct * total;
    const steps = getPlayableSteps();
    let acc = 0;
    for (let i = 0; i < steps.length; i++) {
      const dur = estimateStepDuration(steps[i]);
      if (acc + dur >= targetMs) {
        const wasPlaying = playbackState.playing;
        pausePlayback();
        jumpToStep(i);
        playbackState.pausedAt = targetMs - acc;
        if (wasPlaying) startPlayback();
        break;
      }
      acc += dur;
    }
  });
})();

// ----- Task 5.5:點台子 = playback 控制(覆寫既有 nextLine 行為) -----
// 既有 stage.addEventListener("click", ...) 已綁定;這裡加 capture-phase 攔截。
els.stage.addEventListener("click", (e) => {
  // 只在 detail 模式 + 播放有狀態時介入
  if (state.mode !== "detail") return;
  if (playbackState.playing) {
    e.stopImmediatePropagation();
    pausePlayback();
  } else if (playbackState.pausedAt > 0) {
    e.stopImmediatePropagation();
    startPlayback();
  }
  // 否則 fall through → 既有 prev/next 邏輯
}, { capture: true });

// ----- Task 5.6:簡易模式隱藏播放控制 -----
function syncPlaybackVisibility() {
  const pb = document.getElementById("previewPlayback");
  if (pb) pb.style.display = state.mode === "simple" ? "none" : "";
}
syncPlaybackVisibility();
// switchMode 結束後也要 sync
const __origSwitchMode = switchMode;
switchMode = async function(newMode) {
  await __origSwitchMode(newMode);
  syncPlaybackVisibility();
};

// ----- Task 5.7:改劇本 reset 播放 -----
els.scriptArea.addEventListener("input", () => {
  if (playbackState.playing || playbackState.pausedAt > 0) {
    stopPlayback();
    playbackState.currentStep = 0;
    updateProgressBar();
  }
});

// 初始顯示
updateProgressBar();

// ============================================================
// Batch 6:Status bar + 手機橫滑
// ============================================================







setInterval(refreshSaveTimeDisplay, 10000);
updateStatusBar();
refreshSaveTimeDisplay();

// ----- 手機左右滑動切 pane (Task 6.2) -----
(function setupMobileSwipe() {
  const main = document.querySelector(".main");
  if (!main) return;
  let startX = 0, startY = 0;
  const THRESH = 60;        // 至少橫移 60px
  const VERTICAL_TOL = 80;  // 垂直差超過此值算捲動,不切換

  main.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  main.addEventListener("touchend", (e) => {
    if (e.changedTouches.length !== 1) return;
    if (state.mode === "simple") return;  // 簡易模式沒有雙 pane
    const dx = e.changedTouches[0].clientX - startX;
    const dy = Math.abs(e.changedTouches[0].clientY - startY);
    if (Math.abs(dx) < THRESH) return;
    if (dy > VERTICAL_TOL) return;
    const currentActive = document.querySelector(".mobile-pane-tab.active");
    if (!currentActive) return;
    const cur = currentActive.dataset.pane;
    let target = null;
    if (dx < 0 && cur === "script") target = "preview";
    else if (dx > 0 && cur === "preview") target = "script";
    if (!target) return;
    document.querySelectorAll(".mobile-pane-tab").forEach(t =>
      t.classList.toggle("active", t.dataset.pane === target));
    const scriptPane = document.querySelector(".pane-script");
    const previewPane = document.querySelector(".pane-preview");
    if (scriptPane) scriptPane.classList.toggle("mobile-active", target === "script");
    if (previewPane) previewPane.classList.toggle("mobile-active", target === "preview");
  }, { passive: true });
})();
