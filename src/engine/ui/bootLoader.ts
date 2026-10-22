// The loading screen (markup in index.html, look in boot-loader.css): shown from the
// first paint, hidden when the game is ready, and shown again while the game waits
// for the server between screens. It never throws: without the element it is a no-op.
const FADE_MS = 300;

let hideTimer: ReturnType<typeof setTimeout> | null = null;

function loader(): HTMLElement | null {
  return document.getElementById('boot-loader');
}

export function showLoader(): void {
  const el = loader();
  if (!el) return;
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = null;
  el.hidden = false;
  el.classList.remove('is-done');
}

export function hideLoader(): void {
  const el = loader();
  if (!el || el.hidden) return;
  el.classList.add('is-done');
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    el.hidden = true;
    hideTimer = null;
  }, FADE_MS);
}
