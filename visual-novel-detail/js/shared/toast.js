// shared/toast.js — 由 index.js 搬出(階段 3-H),內容未改動

function showToast(msg, variant = "", duration = 2500) {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  // keep at most 3 — drop the oldest still-visible one
  const live = container.querySelectorAll(".toast-item:not(.out)");
  if (live.length >= 3) live[0].remove();
  const item = document.createElement("div");
  item.className = "toast-item" + (variant ? " " + variant : "");
  item.textContent = msg;
  container.appendChild(item);
  setTimeout(() => {
    item.classList.add("out");
    setTimeout(() => item.remove(), 250);
  }, duration);
}

export {
  showToast,
};
