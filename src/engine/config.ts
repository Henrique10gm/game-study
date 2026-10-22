// Engine-level numeric constants (never content — no scenario text or ids here).
export const TILE_SIZE = 32;
export const PLAYER_SPEED = 160;
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 640;

// Flappy-Quiz run rules (Phase 01.1 PRD). Numbers only — no content.
export const LIVES_PER_RUN = 3;
export const BARRIERS_PER_QUESTION = 5;
export const COINS_PER_QUESTION = 3; // Pac-Man mode: coins between questions
export const BIRD_X = 220;
export const FLAP_VELOCITY = -360;
export const BIRD_GRAVITY = 1000;
export const GROUND_HEIGHT = 64;
export const BARRIER_WIDTH = 64;
export const INVULNERABLE_MS = 1500;

// Brand fonts (self-hosted, see tokens.css). Phaser text needs the family names.
export const FONT_SERIF = "'Merriweather Variable', Georgia, serif";
export const FONT_SANS = "'Merriweather Sans Variable', sans-serif";
// neutral palette (hex numbers for Phaser, strings for text).
export const COLORS = {
  black: 0x151211,
  forest: 0x0f352b,
  petrol: 0x243833,
  moss: 0x274e13,
  lime: 0xd2f58c,
  paper: 0xfcf8ec,
  white: 0xffffff,
  grayMid: 0x9e9e9e,
  grayLight: 0xefefef,
  grayNeutral: 0xd4cfc8,
  grayDark: 0x666666,
} as const;
