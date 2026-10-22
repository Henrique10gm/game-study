// Colors of the two themes: night (the street at night, the original look) and day.
// Hex strings live here; tokens.css repeats the UI values because the page needs
// them before any script runs, and tests/unit/palette.test.ts fails when the two
// drift apart. Every text pair below is checked for contrast in that same test.
import { currentTheme } from './theme';

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

// ---------------------------------------------------------------------------
// The scenery drawn on the canvas (street, hall, bank inside, run backdrops). Fills
// are 0xRRGGBB numbers for Phaser; text colors are CSS strings. The hero, coin and the
// other sprites keep their own fixed palette (COLORS in config.ts): the character looks
// the same by day and by night, only the world around it changes.
export interface ScenePalette {
  isDay: boolean;

  // sky and far city
  skyTop: number;
  skyBottom: number;
  skyRun: string; // flat sky behind the run scenes (CSS, for the camera background)
  star: number; // night: stars
  sun: number; // day: the sun disc
  cloud: number; // day: clouds
  cityA: number;
  cityB: number;
  cityShade: number;
  windowLit: number;
  windowAlpha: number;

  // street
  sidewalk: number;
  curb: number;
  road: number;
  roadMark: number;
  lampPole: number;
  lampHead: number;
  lampGlowAlpha: number; // 0 by day: the lamp is off

  // run ground texture
  groundBase: number;
  groundTop: number;
  groundLine: number;
  groundSpeck: number;

  // inside (bank and hall)
  wall: number;
  wainscot: number;
  trim: number;
  frame: number;
  pane: number;
  floorLight: number;
  floorDark: number;
  ceilingLight: number;

  // canvas text drawn straight over the scenery
  ink: string;
  inkMuted: string;
  accentText: string;
  // outline for text over a busy board (the maze): the sky color of the theme
  stroke: string;
}

export const SCENE: Record<ThemeId, ScenePalette> = {
  night: {
    isDay: false,
    skyTop: 0x151211,
    skyBottom: 0x1f3b35,
    skyRun: '#151211',
    star: 0xfcf8ec,
    sun: 0xfcf8ec,
    cloud: 0xfcf8ec,
    cityA: 0x10302a,
    cityB: 0x1d3a34,
    cityShade: 0x151211,
    windowLit: 0xf2c25b,
    windowAlpha: 0.6,
    sidewalk: 0x666666,
    curb: 0x9e9e9e,
    road: 0x100d0c,
    roadMark: 0xefefef,
    lampPole: 0x666666,
    lampHead: 0xfcf8ec,
    lampGlowAlpha: 0.14,
    groundBase: 0x243833,
    groundTop: 0xd4cfc8,
    groundLine: 0x9e9e9e,
    groundSpeck: 0x0f352b,
    wall: 0x151211,
    wainscot: 0x243833,
    trim: 0x0f352b,
    frame: 0xfcf8ec,
    pane: 0x0f352b,
    floorLight: 0xfcf8ec,
    floorDark: 0xd4cfc8,
    ceilingLight: 0xfcf8ec,
    ink: '#F6F1E4',
    inkMuted: '#B3ABA0',
    accentText: '#D2F58C',
    stroke: '#151211',
  },
  day: {
    isDay: true,
    skyTop: 0x6db4e3,
    skyBottom: 0xbfe3f2,
    skyRun: '#9ED0EC',
    star: 0xffffff,
    sun: 0xffe9a8,
    cloud: 0xffffff,
    cityA: 0x8db1a6,
    cityB: 0x7ba195,
    cityShade: 0x2e4a44,
    windowLit: 0xffffff,
    windowAlpha: 0.45,
    sidewalk: 0x9c9486,
    curb: 0xc9c2b2,
    road: 0x47443f,
    roadMark: 0xf4eedf,
    lampPole: 0x6f695e,
    lampHead: 0xffffff,
    lampGlowAlpha: 0,
    groundBase: 0xa39b8b,
    groundTop: 0xe6dfcf,
    groundLine: 0x6f695e,
    groundSpeck: 0x8a8272,
    wall: 0xefe6d0,
    wainscot: 0xcbd8c3,
    trim: 0xa9bba2,
    frame: 0xffffff,
    pane: 0xbfe0ee,
    floorLight: 0xfffdf5,
    floorDark: 0xe2d8c0,
    ceilingLight: 0xffffff,
    ink: '#1B1714',
    inkMuted: '#2C3A44',
    accentText: '#1F5A12',
    stroke: '#9ED0EC',
  },
};

/** Light text for a dark board (the maze) or a dark chip, in either theme. */
export const INK_ON_DARK = '#F6F1E4';

/** The scenery colors for the theme on screen right now. */
export function scene(): ScenePalette {
  return SCENE[currentTheme()];
}
