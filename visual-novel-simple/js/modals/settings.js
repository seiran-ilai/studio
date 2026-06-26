// modals/settings.js — 由 index.js 搬出,內容未改動

async function renderStorageSection() {
  const summary = document.getElementById("storageSummary");
  const fill = document.getElementById("storageBarFill");
  const breakdown = document.getElementById("storageBreakdown");
  const note = document.getElementById("storagePersistNote");
  if (!summary || !fill || !breakdown) return;

  if (vnsDbFailed) {
    summary.textContent = "IndexedDB 不可用";
    fill.style.width = "0%";
    breakdown.innerHTML = "";
    return;
  }

  const [q, br] = await Promise.all([vnsCheckStorageQuota(), vnsBreakdownUsage()]);

  if (q.supported) {
    const pct = Math.min(100, q.usagePercent || 0);
    fill.style.width = pct.toFixed(1) + "%";
    fill.classList.remove("warn", "danger");
    if (pct >= 90) fill.classList.add("danger");
    else if (pct >= 70) fill.classList.add("warn");
    summary.textContent = `${vnsFmtBytes(q.usage)} / ${vnsFmtBytes(q.quota)} (${pct.toFixed(1)}%)`;
  } else {
    fill.style.width = "0%";
    summary.textContent = "瀏覽器不支援用量偵測";
  }

  breakdown.innerHTML = "";
  const rows = [
    { label: `CG 圖片(${br.cgCount} 張)`, val: vnsFmtBytes(br.cgs) },
    { label: `幕資料(${br.projectCount} 個專案)`, val: vnsFmtBytes(br.projects) },
  ];
  for (const r of rows) {
    const row = document.createElement("div");
    row.className = "storage-breakdown-row";
    const a = document.createElement("span");
    a.textContent = r.label;
    const b = document.createElement("strong");
    b.textContent = r.val;
    row.appendChild(a); row.appendChild(b);
    breakdown.appendChild(row);
  }

  // Persistent storage 提示
  if (note) {
    if (_vnsPersistentGranted === false) {
      note.hidden = false;
      note.textContent = "⚠ 此瀏覽器未授予永久儲存權,清除瀏覽器資料時 CG 庫可能會被刪除。建議定期使用「匯出專案」備份到本機。";
    } else {
      note.hidden = true;
    }
  }
}

// 📹 影片輸出 — 片頭緩衝設定。binding 只綁一次,每次開啟 modal 都同步當前 state。
let _introBufferBound = false;
function setupIntroBufferSettings() {
  const checkbox = document.getElementById("introBufferEnabled");
  const sub = document.getElementById("introBufferSettings");
  const range = document.getElementById("introBufferDuration");
  const valEl = document.getElementById("introBufferDurationVal");
  if (!checkbox || !sub || !range || !valEl) return;
  if (!state.outputSettings || !state.outputSettings.intro) {
    state.outputSettings = (typeof migrateOutputSettings === "function")
      ? migrateOutputSettings(state.outputSettings)
      : { intro: { enabled: true, duration: 1.5 } };
  }
  const cur = state.outputSettings.intro;
  // 同步當前值
  checkbox.checked = !!cur.enabled;
  range.value = cur.duration;
  valEl.textContent = `${Number(cur.duration).toFixed(1)} 秒`;
  sub.classList.toggle("disabled", !cur.enabled);
  // 只綁一次事件
  if (_introBufferBound) return;
  _introBufferBound = true;
  checkbox.addEventListener("change", () => {
    state.outputSettings.intro.enabled = checkbox.checked;
    sub.classList.toggle("disabled", !checkbox.checked);
    if (typeof saveToStorage === "function") saveToStorage();
  });
  range.addEventListener("input", () => {
    const v = Math.max(0.5, Math.min(3.0, parseFloat(range.value) || 1.5));
    state.outputSettings.intro.duration = v;
    valEl.textContent = `${v.toFixed(1)} 秒`;
    if (typeof saveToStorage === "function") saveToStorage();
  });
}

function openSettingsModal() {
  if (!settingsModalEl) return;
  settingsModalEl.classList.add("show");
  // 開啟時更新儲存空間用量 + 同步影片輸出設定
  renderStorageSection();
  setupIntroBufferSettings();
}

function closeSettingsModal() {
  if (!settingsModalEl) return;
  settingsModalEl.classList.remove("show");
}

export {
  renderStorageSection,
  setupIntroBufferSettings,
  openSettingsModal,
  closeSettingsModal,
};
