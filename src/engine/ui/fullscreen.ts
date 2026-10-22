// Full-screen mode for the whole game (canvas + the DOM overlays, which live in
// #app). Esc leaves it, as in any browser. On phones that allow it (Android
// Chrome) the screen is also locked to landscape. iPhone Safari has no
// fullscreen API for pages, so there the button is simply not offered.

function target(): HTMLElement | null {
  return document.getElementById('app');
}

export function canFullscreen(): boolean {
  const el = target();
  return Boolean(document.fullscreenEnabled && el && typeof el.requestFullscreen === 'function');
}

export function isFullscreen(): boolean {
  return document.fullscreenElement !== null;
}

export async function toggleFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await target()?.requestFullscreen({ navigationUI: 'hide' });
    const orientation = screen.orientation as ScreenOrientation & { lock?: (type: string) => Promise<void> };
    await orientation?.lock?.('landscape').catch(() => undefined);
  } catch {
    // blocked (for example by the embedding page): the game just stays as it is
  }
}

/** Calls `listener` whenever fullscreen is entered or left. Returns the unsubscribe function. */
export function onFullscreenChange(listener: () => void): () => void {
  document.addEventListener('fullscreenchange', listener);
  return () => document.removeEventListener('fullscreenchange', listener);
}

/** The F key toggles fullscreen, except while typing in a field. */
export function bindFullscreenKey(): void {
  window.addEventListener('keydown', (event) => {
    if (event.code !== 'KeyF' || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    const tag = (event.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (!canFullscreen()) return;
    void toggleFullscreen();
  });
}
