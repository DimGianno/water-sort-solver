// 1) Where we store the user's preference (so it stays after refresh)
const STORAGE_KEY = "wss_theme";

// 2) Read saved theme from localStorage (returns "dark", "light", or null)
function getSavedTheme() {
  return localStorage.getItem(STORAGE_KEY);
}

// 3) Save theme to localStorage
function saveTheme(theme) {
  localStorage.setItem(STORAGE_KEY, theme);
}

// 4) Apply theme by setting an attribute on <html>
function applyTheme(theme) {
  // document.documentElement is the <html> element
  document.documentElement.setAttribute("data-theme", theme);
}

// 5) Decide initial theme:
//    - use saved theme if exists
//    - else use system preference
function getInitialTheme() {
  const saved = getSavedTheme();
  if (saved === "dark" || saved === "light") return saved;

  // matchMedia checks the OS/browser preference
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

// 6) Update the theme button UI (icon + accessibility)
function updateThemeButton(theme) {
  const btn = document.getElementById("themeBtn");
  if (!btn) return;

  // If theme is dark, show a sun (meaning: click to go light)
  const isDark = theme === "dark";
  btn.textContent = isDark ? "☀️" : "🌙";

  // aria-label helps screen readers
  btn.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");

  // aria-pressed communicates toggle state
  btn.setAttribute("aria-pressed", String(isDark));
}

// 7) Toggle theme (light <-> dark)
function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  const next = current === "dark" ? "light" : "dark";

  applyTheme(next);
  saveTheme(next);
  updateThemeButton(next);
}

// 8) Initialize once, when the page loads
export function initTheme() {
  const initial = getInitialTheme();
  applyTheme(initial);
  updateThemeButton(initial);

  const btn = document.getElementById("themeBtn");
  if (btn) btn.addEventListener("click", toggleTheme);

  // Optional: return useful functions if we want later.
  return { toggleTheme };
}