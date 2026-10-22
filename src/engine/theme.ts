// Day / night. The choice is the player's (kept in this browser); until they choose,
// the system setting decides. The DOM reads it from <html data-theme="...">, set before
// the first paint by public/theme-init.js (same rule as initialTheme below).
import type { ThemeId } from './palette';

export const THEME_KEY = 'qh.theme';
export const THEME_EVENT = 'qh:themechange';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function isTheme(value: unknown): value is ThemeId {
  return value === 'night' || value === 'day';
}

function browserStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function systemTheme(): ThemeId {
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'day' : 'night';
  } catch {
    return 'night';
  }
}

/** The saved choice, or null when the player never chose. */
export function savedTheme(storage: StorageLike | null = browserStorage()): ThemeId | null {
  try {
    const value = storage?.getItem(THEME_KEY);
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
}

export function initialTheme(storage: StorageLike | null = browserStorage()): ThemeId {
  return savedTheme(storage) ?? systemTheme();
}

/** The theme on screen right now. */
export function currentTheme(root: HTMLElement = document.documentElement): ThemeId {
  const value = root.dataset.theme;
  return isTheme(value) ? value : 'night';
}

/** Puts a theme on the page without saving it (used at start-up). */
export function applyTheme(theme: ThemeId, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = theme;
  root.style.colorScheme = theme === 'day' ? 'light' : 'dark';
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'day' ? '#F6F1E4' : '#151211';
}

/** Switches theme, remembers the choice and tells whoever draws with canvas colors. */
export function setTheme(theme: ThemeId, storage: StorageLike | null = browserStorage()): void {
  const changed = currentTheme() !== theme;
  applyTheme(theme);
  try {
    storage?.setItem(THEME_KEY, theme);
  } catch {
    // storage unavailable: the choice lasts until the page closes
  }
  if (changed) window.dispatchEvent(new CustomEvent<ThemeId>(THEME_EVENT, { detail: theme }));
}

export function toggleTheme(storage: StorageLike | null = browserStorage()): ThemeId {
  const next: ThemeId = currentTheme() === 'day' ? 'night' : 'day';
  setTheme(next, storage);
  return next;
}
