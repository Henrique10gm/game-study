// Runs before the first paint so the page opens in the right theme (no flash).
// Same rule as initialTheme() in src/engine/theme.ts: the saved choice, else the system setting.
(function () {
  try {
    var theme = localStorage.getItem('qh.theme');
    if (theme !== 'day' && theme !== 'night') {
      theme = matchMedia('(prefers-color-scheme: light)').matches ? 'day' : 'night';
    }
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === 'day' ? 'light' : 'dark';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'day' ? '#F6F1E4' : '#151211');
  } catch (e) {
    /* storage or matchMedia blocked: the default (night) stays */
  }
})();
