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

function openSettingsModal() {
  if (!settingsModalEl) return;
  settingsModalEl.classList.add("show");
  // 同步當前主題到按鈕 active 狀態
  const cur = document.documentElement.getAttribute("data-theme") || "violet";
  settingsModalEl.querySelectorAll(".theme-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.theme === cur);
  });
  // 開啟時更新儲存空間用量
  renderStorageSection();
}

function closeSettingsModal() {
  if (!settingsModalEl) return;
  settingsModalEl.classList.remove("show");
}

export {
  renderStorageSection,
  openSettingsModal,
  closeSettingsModal,
};
