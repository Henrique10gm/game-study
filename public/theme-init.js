// Runs before the first paint so the page opens in the right theme (no flash), and drops the
// landing page when the address is the return of a sign-in step (same rule as
// shouldSkipLanding() in src/landing/entry.ts; a test keeps both in line).
// Theme rule = initialTheme() in src/engine/theme.ts: the saved choice, else the system setting.
(function () {
  try {
    var hash = location.hash.replace(/^#/, '');
    var search = location.search.replace(/^[?]/, '');
    if (
      /(^|&)(access_token|refresh_token|error|error_code|error_description)=/.test(hash) ||
      /(^|&)type=(recovery|signup|invite|magiclink|email_change)(&|$)/.test(hash) ||
      /(^|&)(code|error|error_code|error_description)=/.test(search) ||
      /(^|&)jogar(=|&|$)/.test(search)
    ) {
      document.documentElement.classList.remove('is-landing');
    }
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
