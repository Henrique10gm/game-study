// Colors of the two themes: night (the street at night, the original look) and day.
// Hex strings live here; tokens.css repeats the UI values because the page needs
// them before any script runs, and tests/unit/palette.test.ts fails when the two
// drift apart. Every text pair below is checked for contrast in that same test.
export type ThemeId = 'night' | 'day';

export const THEME_IDS: readonly ThemeId[] = ['night', 'day'];

/** Colors of the DOM screens. Each key is the CSS variable --color-<kebab-case key>. */
export interface UiPalette {
  bg: string; // page and card background
  surface: string; // cards
  surfaceRaised: string; // hover, active field, raised card
  line: string; // decorative divider
  lineStrong: string; // border of a field or control (needs 3:1)
  text: string;
  muted: string; // secondary text
  accent: string; // primary action, active item, progress
  accentHover: string;
  accentInk: string; // text on top of the accent
  danger: string; // error (never the accent)
  success: string; // saved, copied
  warning: string;
  paper: string; // the brightest neutral fill (gain segment of a bar)
  forest: string; // hard offset shadow of the pixel boxes
  wrong: string; // a wrong answer: neutral plus a mark, never red
}

export const UI: Record<ThemeId, UiPalette> = {
  night: {
    bg: '#151211',
    surface: '#201B19',
    surfaceRaised: '#2B2522',
    line: '#3A332F',
    lineStrong: '#8B8178',
    text: '#F6F1E4',
    muted: '#B3ABA0',
    accent: '#D2F58C',
    accentHover: '#E6FFB4',
    accentInk: '#151211',
    danger: '#FF8F80',
    success: '#7FD8A6',
    warning: '#F2C25B',
    paper: '#FCF8EC',
    forest: '#0F352B',
    wrong: '#D4CFC8',
  },
  day: {
    bg: '#F6F1E4',
    surface: '#FFFCF4',
    surfaceRaised: '#EDE5D2',
    line: '#D9D0BC',
    lineStrong: '#7B7064',
    text: '#1B1714',
    muted: '#5C5348',
    accent: '#2E6B1E',
    accentHover: '#245A17',
    accentInk: '#FFFFFF',
    danger: '#B3261E',
    success: '#1D7447',
    warning: '#8A5A00',
    paper: '#2A241E',
    forest: '#C9D3B8',
    wrong: '#6B6258',
  },
};

/** surfaceRaised -> surface-raised */
export function cssVarName(key: string): string {
  return `--color-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}
