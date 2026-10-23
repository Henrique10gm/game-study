// The street in front of the bank: sky, far city, the bank facade, sidewalk, road and lamp.
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
  feetY: 538, // the hero's feet line in front of the bank
  doorX: 640,
  signCenter: { x: 640, y: 234 },
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

/** The bank in off-white stone (pediment, columns, door, steps), then sidewalk, road and lamp post. */
export function drawBank(g: Brush, P: ScenePalette): void {
  g.fillStyle(COLORS.grayNeutral).fillTriangle(390, 172, 890, 172, 640, 92);
  g.fillStyle(COLORS.paper).fillTriangle(420, 168, 860, 168, 640, 112);
  g.fillStyle(COLORS.paper).fillRect(390, 172, 500, 30);
  g.fillStyle(COLORS.grayNeutral).fillRect(390, 196, 500, 6);
  g.fillStyle(COLORS.paper).fillRect(410, 202, 460, 270);
  for (let cx = 430; cx <= 830; cx += 80) {
    if (cx === 590 || cx === 670) continue; // leave room for the door
    g.fillStyle(COLORS.white).fillRect(cx, 202, 28, 268);
    g.fillStyle(COLORS.grayNeutral).fillRect(cx + 18, 202, 10, 268);
    g.fillStyle(COLORS.paper).fillRect(cx - 4, 202, 36, 8).fillRect(cx - 4, 462, 36, 8);
  }
  g.fillStyle(COLORS.grayNeutral).fillRect(594, 364, 92, 110);
  g.fillStyle(COLORS.black).fillRect(600, 370, 80, 104);
  g.fillStyle(COLORS.forest).fillRect(606, 376, 32, 60).fillRect(642, 376, 32, 60);
  g.fillStyle(COLORS.paper, 0.4).fillRect(610, 380, 6, 52).fillRect(646, 380, 6, 52);
  g.fillStyle(COLORS.lime).fillCircle(634, 450, 3).fillCircle(646, 450, 3);
  g.fillStyle(COLORS.grayNeutral).fillRect(390, 472, 500, 14);
  g.fillStyle(COLORS.grayMid).fillRect(378, 486, 524, 14);
  g.fillStyle(COLORS.black).fillRect(556, 214, 168, 40);
  g.lineStyle(2, COLORS.grayMid).strokeRect(556, 214, 168, 40);

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
