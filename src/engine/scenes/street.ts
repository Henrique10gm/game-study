// The street in front of the house: sky, far city, a house with a garage, sidewalk, road and lamp.
// Drawn from a fixed seed (every visit shows the same city) and from the palette of the
// theme. It paints through a tiny Brush, so the game (Phaser Graphics) and the landing
// page (a plain canvas) draw the very same picture without the landing loading Phaser.
import { COLORS, GAME_WIDTH } from '../config';
import { seededRandom } from '../seed';
import type { ScenePalette } from '../palette';

export const STREET_SEED = 20261022;

export { seededRandom };

/** The few drawing calls the street needs. Phaser's Graphics already has all of them. */
export interface Brush {
  fillStyle(color: number, alpha?: number): Brush;
  fillRect(x: number, y: number, width: number, height: number): Brush;
  fillTriangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): Brush;
  fillCircle(x: number, y: number, radius: number): Brush;
  lineStyle(width: number, color: number, alpha?: number): Brush;
  strokeRect(x: number, y: number, width: number, height: number): Brush;
}

/** Where things are (shared with whoever walks a hero along this street). */
export const STREET = {
  skyBottom: 510, // the sky gradient ends here
  horizon: 500, // sidewalk starts, buildings stand on it
  feetY: 538, // the hero's feet line in front of the house
  doorX: 452, // the front door: where the hero goes in
  signCenter: { x: 755, y: 326 }, // the name plate above the garage door
  signSize: { width: 168, height: 40 },
  lamp: { x: 321, y: 326 },
} as const;

function mix(from: number, to: number, t: number): number {
  const channel = (shift: number): number => {
    const a = (from >> shift) & 0xff;
    const b = (to >> shift) & 0xff;
    return Math.round(a + (b - a) * t);
  };
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

/** The whole picture: sky and far city, then the bank, sidewalk and road. */
export function drawStreet(brush: Brush, P: ScenePalette, rng: () => number): void {
  drawSky(brush, P, rng);
  drawBank(brush, P);
}

/** Sky (gradient, then stars by night or sun and clouds by day) and the far city. */
export function drawSky(g: Brush, P: ScenePalette, rng: () => number): void {
  const between = (min: number, max: number): number => min + Math.floor(rng() * (max - min + 1));

  const bands = 16;
  const bandHeight = Math.ceil(STREET.skyBottom / bands);
  for (let i = 0; i < bands; i++) {
    g.fillStyle(mix(P.skyTop, P.skyBottom, i / (bands - 1))).fillRect(0, i * bandHeight, GAME_WIDTH, bandHeight);
  }
  if (P.isDay) {
    drawSun(g, P, 820, 104);
    for (const [cx, cy, size] of [[170, 150, 1], [430, 96, 0.8], [700, 190, 1.1], [560, 36, 0.7]] as const) {
      drawCloud(g, P, cx, cy, size);
    }
  } else {
    g.fillStyle(P.star, 0.6);
    for (let i = 0; i < 40; i++) g.fillRect(between(0, GAME_WIDTH), between(0, 230), 2, 2);
  }

  let sx = 0;
  let index = 0;
  while (sx < GAME_WIDTH) {
    const w = between(46, 90);
    const h = between(80, 200);
    g.fillStyle(index % 2 === 0 ? P.cityA : P.cityB).fillRect(sx, STREET.horizon - h, w - 4, h);
    g.fillStyle(P.cityShade, 0.25).fillRect(sx + w - 12, STREET.horizon - h, 8, h);
    g.fillStyle(P.windowLit, P.windowAlpha);
    for (let wy = STREET.horizon - h + 12; wy < STREET.horizon - 20; wy += 22) {
      for (let wx = sx + 8; wx < sx + w - 14; wx += 16) {
        if (rng() > 0.6) g.fillRect(wx, wy, 5, 7);
      }
    }
    sx += w;
    index++;
  }
}

// Colors of the house that do not change with the theme (the street around it does).
const ROOF = 0x7a3a2e;
const ROOF_LIGHT = 0x9b4a3a;
const BRICK = 0xb5654f;
const GARAGE_WALL = 0xf0e8d6;
const GARAGE_DOOR = 0xe6e0d2;
const GARAGE_SLAT = 0xb9b2a4;

/** A house with a garage (the name plate is on the garage), then sidewalk, road and lamp post. */
export function drawBank(g: Brush, P: ScenePalette): void {
  const glass = P.isDay ? P.pane : P.windowLit;
  const glassAlpha = P.isDay ? 1 : 0.9; // by night the windows are lit
  const grass = P.isDay ? 0x7fb06a : 0x24452e;
  const bush = P.isDay ? 0x5f9150 : 0x1b3623;

  // Garage (right): low gable roof, wall, door with slats, the name plate on top.
  g.fillStyle(ROOF).fillTriangle(606, 304, 914, 304, 760, 248);
  g.fillStyle(ROOF_LIGHT).fillTriangle(606, 304, 760, 304, 760, 248);
  g.fillStyle(ROOF).fillRect(600, 300, 320, 8);
  g.fillStyle(GARAGE_WALL).fillRect(620, 308, 280, 164);
  g.fillStyle(COLORS.grayNeutral).fillRect(649, 356, 222, 116);
  g.fillStyle(GARAGE_DOOR).fillRect(655, 362, 210, 110);
  for (let i = 1; i <= 3; i++) g.fillStyle(GARAGE_SLAT).fillRect(655, 362 + i * 27, 210, 3);
  g.fillStyle(glass, glassAlpha).fillRect(663, 368, 38, 14).fillRect(707, 368, 38, 14).fillRect(751, 368, 38, 14).fillRect(795, 368, 38, 14);
  g.fillStyle(COLORS.grayMid).fillRect(748, 458, 14, 6);
  g.fillStyle(COLORS.grayNeutral).fillRect(640, 472, 240, 28);

  // The plate with the name (the text itself is drawn on top by the scene or the page).
  const plate = STREET.signSize;
  const px = STREET.signCenter.x - plate.width / 2;
  const py = STREET.signCenter.y - plate.height / 2;
  g.fillStyle(COLORS.black).fillRect(px, py, plate.width, plate.height);
  g.lineStyle(2, COLORS.grayMid).strokeRect(px, py, plate.width, plate.height);

  // House (left): roof, chimney, attic window, wall, front door, window, porch.
  g.fillStyle(BRICK).fillRect(570, 170, 28, 56);
  g.fillStyle(COLORS.grayDark).fillRect(566, 164, 36, 8);
  g.fillStyle(ROOF).fillTriangle(372, 254, 638, 254, 505, 150);
  g.fillStyle(ROOF_LIGHT).fillTriangle(372, 254, 505, 254, 505, 150);
  g.fillStyle(ROOF).fillRect(366, 250, 278, 8);
  g.fillStyle(COLORS.paper).fillRect(390, 258, 230, 214);
  g.fillStyle(COLORS.grayNeutral).fillRect(485, 196, 40, 40);
  g.fillStyle(glass, glassAlpha).fillRect(490, 201, 30, 30);
  g.fillStyle(COLORS.grayNeutral).fillRect(503, 201, 4, 30).fillRect(490, 214, 30, 4);

  g.fillStyle(COLORS.grayNeutral).fillRect(512, 326, 88, 70);
  g.fillStyle(glass, glassAlpha).fillRect(518, 332, 36, 26).fillRect(558, 332, 36, 26).fillRect(518, 362, 36, 28).fillRect(558, 362, 36, 28);
  g.fillStyle(COLORS.grayMid).fillRect(506, 396, 100, 6);

  g.fillStyle(COLORS.grayNeutral).fillRect(426, 382, 52, 90);
  g.fillStyle(COLORS.forest).fillRect(432, 388, 40, 84);
  g.fillStyle(glass, glassAlpha).fillRect(438, 394, 28, 20);
  g.fillStyle(COLORS.paper, 0.35).fillRect(438, 420, 6, 46);
  g.fillStyle(COLORS.lime).fillCircle(464, 434, 3);
  g.fillStyle(COLORS.grayNeutral).fillRect(410, 472, 84, 12);
  g.fillStyle(COLORS.grayMid).fillRect(400, 484, 104, 16);

  // Garden: lawn, bushes, a mailbox and a tree.
  g.fillStyle(grass).fillRect(380, 484, 20, 16).fillRect(504, 484, 136, 16);
  g.fillStyle(bush).fillCircle(408, 480, 14).fillCircle(520, 482, 12).fillCircle(580, 482, 14);
  g.fillStyle(COLORS.grayDark).fillRect(358, 462, 4, 38);
  g.fillStyle(COLORS.grayMid).fillRect(348, 448, 24, 16);
  g.fillStyle(COLORS.lime).fillRect(366, 444, 4, 10);
  g.fillStyle(0x6b4a32).fillRect(920, 392, 12, 108);
  g.fillStyle(bush).fillCircle(926, 376, 34).fillCircle(902, 396, 22).fillCircle(950, 396, 22);

  g.fillStyle(P.sidewalk).fillRect(0, STREET.horizon, GAME_WIDTH, 46);
  g.fillStyle(P.curb).fillRect(0, 542, GAME_WIDTH, 5);
  g.fillStyle(P.road).fillRect(0, 547, GAME_WIDTH, 93);
  g.fillStyle(P.roadMark, 0.5);
  for (let dx = 20; dx < GAME_WIDTH; dx += 90) g.fillRect(dx, 580, 50, 5);
  g.fillStyle(P.lampPole).fillRect(318, 330, 6, 170);
  g.fillStyle(P.lampHead).fillCircle(STREET.lamp.x, STREET.lamp.y, 11);
  if (P.lampGlowAlpha > 0) g.fillStyle(P.lampHead, P.lampGlowAlpha).fillCircle(STREET.lamp.x, STREET.lamp.y, 42);
}

// The sun: a stepped disc (blocks of 8 px) with a pale halo, like the moon of the run scenes.
function drawSun(g: Brush, P: ScenePalette, cx: number, cy: number): void {
  g.fillStyle(P.sun, 0.25).fillCircle(cx, cy, 70);
  g.fillStyle(P.sun, 0.35).fillCircle(cx, cy, 54);
  const r = 4;
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r + 1) g.fillStyle(P.sun).fillRect(cx + x * 8 - 4, cy + y * 8 - 4, 8, 8);
    }
  }
}

// A pixel cloud: stacked rows of blocks, flat at the bottom.
function drawCloud(g: Brush, P: ScenePalette, x: number, y: number, size: number): void {
  const u = Math.round(8 * size);
  g.fillStyle(P.cloud, 0.92);
  g.fillRect(x, y + u * 2, u * 9, u);
  g.fillRect(x + u, y + u, u * 7, u);
  g.fillRect(x + u * 3, y, u * 3, u);
  g.fillRect(x + u * 6, y + u, u * 2, u);
}
