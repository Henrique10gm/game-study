// The street in front of the bank: sky, far city, the bank facade, sidewalk, road and lamp.
// Drawn from a fixed seed (every visit shows the same city) and from the palette of the
// theme, so the game and the landing page can draw the very same picture.
import Phaser from 'phaser';
import { COLORS, GAME_WIDTH } from '../config';
import { seededRandom } from '../seed';
import type { ScenePalette } from '../palette';

export const STREET_SEED = 20261022;

export { seededRandom };

/** Where things are (shared with the scene that walks the hero along this street). */
export const STREET = {
  skyBottom: 510, // the sky gradient ends here
  horizon: 500, // sidewalk starts, buildings stand on it
  doorX: 640,
  signCenter: { x: 640, y: 234 },
  lamp: { x: 321, y: 326 },
} as const;

export function drawStreet(g: Phaser.GameObjects.Graphics, P: ScenePalette, rng: () => number): void {
  const between = (min: number, max: number): number => min + Math.floor(rng() * (max - min + 1));

  // Sky: a soft gradient, then stars (night) or the sun and clouds (day).
  const bands = 16;
  const bandHeight = Math.ceil(STREET.skyBottom / bands);
  const top = Phaser.Display.Color.ValueToColor(P.skyTop);
  const bottom = Phaser.Display.Color.ValueToColor(P.skyBottom);
  for (let i = 0; i < bands; i++) {
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, bands - 1, i);
    g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b)).fillRect(0, i * bandHeight, GAME_WIDTH, bandHeight);
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

  // Far city.
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

  // Bank facade in off-white stone: pediment, entablature, columns, door, steps.
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

  // Sidewalk, road, lamp post.
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
function drawSun(g: Phaser.GameObjects.Graphics, P: ScenePalette, cx: number, cy: number): void {
  g.fillStyle(P.sun, 0.25).fillCircle(cx, cy, 70);
  g.fillStyle(P.sun, 0.35).fillCircle(cx, cy, 54);
  const r = 4;
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r + 1) g.fillStyle(P.sun).fillRect(cx + x * 8 - 4, cy + y * 8 - 4, 8, 8);
    }
  }
}

// A pixel cloud: three stacked rows of blocks, flat at the bottom.
function drawCloud(g: Phaser.GameObjects.Graphics, P: ScenePalette, x: number, y: number, size: number): void {
  const u = Math.round(8 * size);
  g.fillStyle(P.cloud, 0.92);
  g.fillRect(x, y + u * 2, u * 9, u);
  g.fillRect(x + u, y + u, u * 7, u);
  g.fillRect(x + u * 3, y, u * 3, u);
  g.fillRect(x + u * 6, y + u, u * 2, u);
}
