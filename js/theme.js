/* ============================================================
   theme.js - Tema claro / escuro / automático
   ============================================================ */

const THEME_KEY = 'dmc_theme_v1';
const Theme = {
  get: () => localStorage.getItem(THEME_KEY) || 'auto',
  set: (mode) => {
    localStorage.setItem(THEME_KEY, mode);
    Theme.apply();
  },
  isDark: () => {
    const mode = Theme.get();
    if (mode === 'dark') return true;
    if (mode === 'light') return false;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  },
  apply: () => {
    const dark = Theme.isDark();
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.setAttribute('data-theme', Theme.get());
    // update toggle buttons
    document.querySelectorAll('#themeToggle button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.themeMode === Theme.get());
    });
  },
  init: () => {
    Theme.apply();
    // respond to system changes when in auto mode
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => { if (Theme.get() === 'auto') Theme.apply(); };
      if (mq.addEventListener) mq.addEventListener('change', handler);
      else if (mq.addListener) mq.addListener(handler);
    }
    // wire buttons
    document.querySelectorAll('#themeToggle button').forEach(btn => {
      btn.addEventListener('click', () => Theme.set(btn.dataset.themeMode));
    });
  }
};

window.Theme = Theme;

document.addEventListener('DOMContentLoaded', () => {
  Theme.init();
});
