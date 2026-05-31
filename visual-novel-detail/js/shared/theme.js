// shared/theme.js — 由 index.js 搬出,內容未改動

function applyTheme(t) {
  const theme = (t === "daylight") ? t : "violet";
  document.documentElement.setAttribute("data-theme", theme);
  try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
  document.querySelectorAll(".theme-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.theme === theme);
  });
}

export {
  applyTheme,
};
