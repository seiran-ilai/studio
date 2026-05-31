// modals/projects.js — 由 index.js 搬出,內容未改動

async function renderProjectsList() {
  const list = document.getElementById("projectsList");
  const empty = document.getElementById("projectsEmpty");
  const count = document.getElementById("projectsCount");
  if (!list) return;
  list.innerHTML = "";
  if (vnsDbFailed) {
    if (empty) { empty.hidden = false; empty.querySelector("div:last-child").textContent = "IndexedDB 不可用,無法列出專案"; }
    return;
  }
  const projects = await vnsListProjects();
  if (count) count.textContent = projects.length + " 個專案";
  if (!projects.length) {
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  for (const p of projects) {
    const card = document.createElement("div");
    card.className = "project-card" + (p.id === state.currentProjectId ? " current" : "");

    const main = document.createElement("div");
    main.className = "project-card-main";

    const title = document.createElement("div");
    title.className = "project-card-title";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = p.name || "未命名專案";
    nameInput.maxLength = 40;
    nameInput.addEventListener("change", async () => {
      const v = nameInput.value.trim() || "未命名專案";
      await vnsUpdateProject(p.id, { name: v });
      renderProjectsList();
    });
    title.appendChild(nameInput);
    if (p.id === state.currentProjectId) {
      const badge = document.createElement("span");
      badge.className = "project-card-current-badge";
      badge.textContent = "使用中";
      title.appendChild(badge);
    }
    const modeTag = document.createElement("span");
    modeTag.className = "project-card-mode";
    modeTag.textContent = p.mode === "simple" ? "SIMPLE" : "DETAIL";
    title.appendChild(modeTag);
    main.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "project-card-meta";
    const metaParts = projectMetaText(p);
    metaParts.forEach((part, i) => {
      if (i > 0) {
        const sep = document.createElement("span");
        sep.className = "project-card-meta-sep";
        sep.textContent = "·";
        meta.appendChild(sep);
      }
      const span = document.createElement("span");
      span.textContent = part;
      meta.appendChild(span);
    });
    main.appendChild(meta);

    const openBtn = document.createElement("button");
    openBtn.className = "project-card-open";
    openBtn.textContent = p.id === state.currentProjectId ? "已開啟" : "開啟";
    openBtn.disabled = (p.id === state.currentProjectId);
    openBtn.addEventListener("click", () => switchToProject(p.id));

    const delBtn = document.createElement("button");
    delBtn.className = "project-card-delete";
    delBtn.title = "刪除專案";
    delBtn.setAttribute("aria-label", "刪除專案");
    delBtn.textContent = "×";
    delBtn.addEventListener("click", () => deleteProjectFlow(p));

    card.appendChild(main);
    card.appendChild(openBtn);
    card.appendChild(delBtn);
    list.appendChild(card);
  }
}

async function switchToProject(projectId) {
  if (projectId === state.currentProjectId) return;
  // 先把目前專案的當前 state 強制 flush 到 IDB(避免 3 秒 debounce 還沒寫入就被覆蓋)
  if (typeof _vnsAutoSaveTimer !== "undefined" && _vnsAutoSaveTimer) {
    clearTimeout(_vnsAutoSaveTimer);
    _vnsAutoSaveTimer = null;
    await vnsAutoSaveCurrentProject();
  }
  const target = await vnsGetProject(projectId);
  if (!target) {
    showToast("專案不存在", "warn");
    renderProjectsList();
    return;
  }
  state.currentProjectId = projectId;
  await vnsSetAppState({ currentProjectId: projectId });
  // 把 project.data 套回 state(用 localStorage 同一條 migrate 路徑,把 data 當 payload)
  applyProjectDataToState(target.data || {}, target.mode || "simple");
  // 重繪整個 UI
  if (typeof reparseAndRender === "function") reparseAndRender(true);
  if (typeof renderMainView === "function") renderMainView();
  if (typeof renderCharList === "function") renderCharList();
  if (typeof renderBgList === "function") renderBgList();
  if (typeof renderCgList === "function") renderCgList();
  if (typeof updateStorageMeter === "function") updateStorageMeter();
  if (typeof updateStatusBar === "function") updateStatusBar();
  renderProjectsList();
  showToast("已切換到「" + (target.name || "專案") + "」");
}

function applyProjectDataToState(data, mode) {
  if (!data || typeof data !== "object") return;
  if (typeof data.script === "string") state.script = data.script;
  if (Array.isArray(data.characters)) state.characters = data.characters;
  if (data.backgrounds && typeof data.backgrounds === "object") state.backgrounds = data.backgrounds;
  if (Array.isArray(data.bgOrder)) state.bgOrder = data.bgOrder;
  if (data.cgs && typeof data.cgs === "object") state.cgs = data.cgs;
  if (Array.isArray(data.cgOrder)) state.cgOrder = data.cgOrder;
  if (typeof data.ratio === "string") state.ratio = data.ratio;
  if (data.dialogStyle && typeof data.dialogStyle === "object") state.dialogStyle = data.dialogStyle;
  if (data.outputSettings) state.outputSettings = migrateOutputSettings(data.outputSettings);
  if (data.gameUI && typeof data.gameUI === "object") state.gameUI = data.gameUI;
  if (typeof data.lightMode === "string") state.lightMode = data.lightMode;
  if (data.loveInitial && typeof data.loveInitial === "object") state.loveInitial = data.loveInitial;
  if (Array.isArray(data.simpleCards)) state.simpleCards = migrateSimpleCards(data.simpleCards);
  if (typeof data.simpleCurrentSlideId === "string") state.simpleCurrentSlideId = data.simpleCurrentSlideId;
  state.mode = mode || "simple";
}

async function deleteProjectFlow(p) {
  if (p.id === state.currentProjectId) {
    showToast("無法刪除使用中的專案,請先切換到其他專案", "warn", 4000);
    return;
  }
  const ok = typeof inlineConfirm === "function"
    ? await inlineConfirm({
        title: "刪除「" + (p.name || "專案") + "」?",
        message: "此操作無法復原。建議先匯出備份。\n\nCG 庫不會受影響,可從其他專案繼續使用。",
        okText: "確認刪除",
        danger: true,
      })
    : confirm("刪除「" + (p.name || "專案") + "」?");
  if (!ok) return;
  await vnsDeleteProject(p.id);
  renderProjectsList();
  showToast("已刪除");
}

function pickProjectMode() {
  // 兩個按鈕的簡易選擇器 — 用既有的 _openInlineModal helper
  return new Promise((resolve) => {
    const handle = _openInlineModal((wrap) => {
      wrap.innerHTML = `
        <div class="inline-modal-title">新專案模式</div>
        <div class="inline-modal-body" style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;">
          <button class="btn" data-mode="simple" style="justify-content:flex-start;text-align:left;padding:12px 16px;">
            <span style="font-size:16px;font-weight:600;">💬 簡易模式</span>
            <span style="font-size:11px;color:var(--text-faint);margin-left:8px;">一張卡 = 一張 CG + 對白</span>
          </button>
          <button class="btn" data-mode="detail" style="justify-content:flex-start;text-align:left;padding:12px 16px;">
            <span style="font-size:16px;font-weight:600;">📝 細節模式</span>
            <span style="font-size:11px;color:var(--text-faint);margin-left:8px;">完整劇本語法</span>
          </button>
        </div>
        <div class="inline-modal-footer">
          <button class="btn btn-ghost" data-act="cancel">取消</button>
        </div>
      `;
      wrap.querySelectorAll("button[data-mode]").forEach(b => {
        b.addEventListener("click", () => { handle.close(); resolve(b.dataset.mode); });
      });
      wrap.querySelector("[data-act=cancel]").addEventListener("click", () => { handle.close(); resolve(null); });
    }, (e, close) => {
      if (e.key === "Escape") { e.preventDefault(); close(); resolve(null); }
    });
  });
}

async function newProjectFlow() {
  // 細節版暫時隱藏:新專案一律建立簡易版,不再彈出模式選擇(pickProjectMode 保留供未來使用)
  const modePick = "simple";
  const fallbackName = "未命名專案 " + ((await vnsListProjects()).length + 1);
  const name = (await inlinePrompt({
    title: "專案名稱",
    defaultValue: fallbackName,
    placeholder: fallbackName,
  })) || fallbackName;
  const initData = { v: 1, mode: modePick, script: "", simpleCards: [] };
  const id = await vnsAddProject(name, modePick, initData);
  if (!id) { showToast("建立失敗", "warn"); return; }
  await switchToProject(id);
}

function openProjectsModal() {
  if (!projectsModalEl) return;
  projectsModalEl.classList.add("show");
  renderProjectsList();
}

function closeProjectsModal() {
  if (!projectsModalEl) return;
  projectsModalEl.classList.remove("show");
}

function formatRelTime(iso) {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!t) return "—";
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 60) return "剛剛";
  if (sec < 3600) return Math.floor(sec / 60) + " 分鐘前";
  if (sec < 86400) return Math.floor(sec / 3600) + " 小時前";
  if (sec < 86400 * 7) return Math.floor(sec / 86400) + " 天前";
  const d = new Date(iso);
  return d.toISOString().slice(0, 10);
}

function projectMetaText(p) {
  const parts = [];
  if (p.mode === "simple") {
    const slides = (p.data && Array.isArray(p.data.simpleCards)) ? p.data.simpleCards.length : 0;
    parts.push(slides + " 張");
  } else {
    const chars = (p.data && typeof p.data.script === "string") ? p.data.script.length : 0;
    parts.push(chars + " 字");
  }
  parts.push("最近編輯:" + formatRelTime(p.modifiedAt));
  return parts;
}

function extractProjectName(payload) {
  const firstLine = ((payload && payload.script) || "").split("\n").find(l => l.trim());
  return firstLine ? firstLine.trim().slice(0, 30) : "未命名專案";
}

function pushRecent(payload) {
  let list;
  try { list = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); }
  catch (e) { list = []; }
  if (!Array.isArray(list)) list = [];
  list.unshift({ name: extractProjectName(payload), timestamp: Date.now(), data: payload });
  list = list.slice(0, 5);
  while (list.length > 0) {
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); break; }
    catch (e) { list.pop(); }   // quota — drop the oldest and retry
  }
}

function renderRecentList() {
  const container = document.getElementById("recentList");
  if (!container) return;
  let list;
  try { list = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); }
  catch (e) { list = []; }
  if (!Array.isArray(list)) list = [];
  container.innerHTML = "";
  if (list.length === 0) {
    const empty = document.createElement("div");
    empty.className = "topbar-menu-item";
    empty.style.color = "var(--text-faint)";
    empty.style.pointerEvents = "none";
    empty.textContent = "（尚無）";
    container.appendChild(empty);
    return;
  }
  list.forEach((entry) => {
    const btn = document.createElement("button");
    btn.className = "topbar-menu-item";
    btn.textContent = `📂 ${entry.name}`;
    btn.title = new Date(entry.timestamp).toLocaleString();
    btn.addEventListener("click", async () => {
      closeTopbarMenu();
      try {
        await applyImportedPayload(entry.data);
      } catch (err) {
        console.error(err);
        showToast("載入失敗:" + err.message, "warn", 4000);
      }
    });
    container.appendChild(btn);
  });
}

export {
  renderProjectsList,
  switchToProject,
  applyProjectDataToState,
  deleteProjectFlow,
  pickProjectMode,
  newProjectFlow,
  openProjectsModal,
  closeProjectsModal,
  formatRelTime,
  projectMetaText,
  extractProjectName,
  pushRecent,
  renderRecentList,
};
