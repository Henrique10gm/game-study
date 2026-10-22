import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cssVarName, SCENE, THEME_IDS, UI } from '../../src/engine/palette';
import { seededRandom } from '../../src/engine/seed';
import type { ThemeId, UiPalette } from '../../src/engine/palette';
import {
  applyTheme,
  currentTheme,
  initialTheme,
  savedTheme,
  setTheme,
  THEME_EVENT,
  THEME_KEY,
  toggleTheme,
} from '../../src/engine/theme';

const tokens = readFileSync('src/engine/ui/tokens.css', 'utf8');

// The block of tokens.css that defines a theme: the selector line(s) up to the closing brace.
function themeBlock(theme: ThemeId): string {
  const selector = theme === 'night' ? ":root[data-theme='night'] {" : `:root[data-theme='${theme}'] {`;
  const start = tokens.indexOf(selector);
  if (start < 0) throw new Error(`tokens.css has no block for ${theme}`);
  return tokens.slice(start, tokens.indexOf('}', start));
}

function cssValue(block: string, name: string): string | null {
  const match = new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})\\s*;`).exec(block);
  return match ? match[1].toUpperCase() : null;
}

function luminance(hex: string): number {
  const channel = (offset: number): number => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

describe('palette and tokens.css', () => {
  it.each(THEME_IDS)('%s: every color in palette.ts is the same in tokens.css', (theme) => {
    const block = themeBlock(theme);
    for (const [key, hex] of Object.entries(UI[theme])) {
      expect(cssValue(block, cssVarName(key)), `${theme} ${cssVarName(key)}`).toBe(hex.toUpperCase());
    }
  });

  it('tokens.css has no color that palette.ts does not know about', () => {
    for (const theme of THEME_IDS) {
      const names = [...themeBlock(theme).matchAll(/(--color-[a-z-]+):/g)].map((m) => m[1]);
      expect(names.sort()).toEqual(Object.keys(UI[theme]).map(cssVarName).sort());
    }
  });

  it('the first-paint script follows the same rule and the same page colors', () => {
    const script = readFileSync('public/theme-init.js', 'utf8');
    expect(script).toContain(`'${THEME_KEY}'`);
    expect(script).toContain(UI.day.bg);
    expect(script).toContain(UI.night.bg);
    expect(readFileSync('index.html', 'utf8')).toContain('theme-init.js');
  });
});

describe.each(THEME_IDS)('%s theme contrast (WCAG)', (theme) => {
  const c: UiPalette = UI[theme];
  const textPairs: [string, string, string][] = [
    ['text on bg', c.text, c.bg],
    ['text on surface', c.text, c.surface],
    ['muted on bg', c.muted, c.bg],
    ['muted on surface', c.muted, c.surface],
    ['muted on raised', c.muted, c.surfaceRaised],
    ['accent as text on bg', c.accent, c.bg],
    ['accent as text on surface', c.accent, c.surface],
    ['ink on accent', c.accentInk, c.accent],
    ['ink on accent hover', c.accentInk, c.accentHover],
    ['danger on surface', c.danger, c.surface],
    ['success on surface', c.success, c.surface],
    ['warning on surface', c.warning, c.surface],
    ['wrong answer on surface', c.wrong, c.surface],
  ];
  it.each(textPairs)('%s reads at 4.5:1 or better', (_label, front, back) => {
    expect(contrast(front, back)).toBeGreaterThanOrEqual(4.5);
  });

  it('field borders and the accent stand out at 3:1 or better', () => {
    expect(contrast(c.lineStrong, c.bg)).toBeGreaterThanOrEqual(3);
    expect(contrast(c.lineStrong, c.surface)).toBeGreaterThanOrEqual(3);
    expect(contrast(c.accent, c.bg)).toBeGreaterThanOrEqual(3);
  });

  it('error, success and the accent are three different colors', () => {
    expect(new Set([c.danger, c.success, c.accent]).size).toBe(3);
  });
});

describe('theme', () => {
  const memory = (initial: Record<string, string> = {}) => {
    const data = new Map(Object.entries(initial));
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    };
  };

  afterEach(() => {
    delete document.documentElement.dataset.theme;
    vi.unstubAllGlobals();
  });

  it('uses the saved choice, then the system setting, and ignores garbage', () => {
    expect(savedTheme(memory({ [THEME_KEY]: 'day' }))).toBe('day');
    expect(savedTheme(memory({ [THEME_KEY]: 'neon' }))).toBeNull();
    expect(savedTheme(memory())).toBeNull();

    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    expect(initialTheme(memory())).toBe('day');
    expect(initialTheme(memory({ [THEME_KEY]: 'night' }))).toBe('night');
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    expect(initialTheme(memory())).toBe('night');
  });

  it('setTheme puts it on the page, saves it and announces the change once', () => {
    applyTheme('night');
    const storage = memory();
    const heard = vi.fn();
    window.addEventListener(THEME_EVENT, heard);

    setTheme('day', storage);
    expect(currentTheme()).toBe('day');
    expect(document.documentElement.dataset.theme).toBe('day');
    expect(storage.getItem(THEME_KEY)).toBe('day');
    expect(heard).toHaveBeenCalledOnce();

    setTheme('day', storage); // nothing changed: no event
    expect(heard).toHaveBeenCalledOnce();
    window.removeEventListener(THEME_EVENT, heard);
  });

  it('toggleTheme flips between night and day', () => {
    applyTheme('night');
    const storage = memory();
    expect(toggleTheme(storage)).toBe('day');
    expect(toggleTheme(storage)).toBe('night');
    expect(storage.getItem(THEME_KEY)).toBe('night');
  });
});

describe.each(THEME_IDS)('%s scenery', (theme) => {
  const S = SCENE[theme];
  const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

  it('title text stays readable over the sky, the wall and the floor it is drawn on', () => {
    for (const back of [S.skyTop, S.skyBottom, S.wall]) {
      expect(contrast(S.ink, hex(back)), `ink on ${hex(back)}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(S.inkMuted, hex(back)), `muted on ${hex(back)}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('floating labels (the accent text) read over the run sky', () => {
    expect(contrast(S.accentText, S.skyRun)).toBeGreaterThanOrEqual(4.5);
  });

  it('only the day has a sun and a lamp that is off', () => {
    expect(S.isDay).toBe(theme === 'day');
    expect(S.lampGlowAlpha > 0).toBe(theme === 'night');
  });
});

describe('seededRandom', () => {
  it('gives the same street numbers every time, for the same seed', () => {
    const a = seededRandom(20261022);
    const b = seededRandom(20261022);
    const first = Array.from({ length: 8 }, () => a());
    expect(Array.from({ length: 8 }, () => b())).toEqual(first);
    expect(first.every((n) => n >= 0 && n < 1)).toBe(true);
    expect(Array.from({ length: 8 }, () => seededRandom(1)())).not.toEqual(first);
  });
});
