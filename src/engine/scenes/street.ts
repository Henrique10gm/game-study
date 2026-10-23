// The street in front of the garage: sky, far city, a small garage with its door open on a lit
// study room, sidewalk, road and lamp.
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
  feetY: 538, // the hero's feet line in front of the garage
  doorX: 640, // the middle of the open garage door: where the hero goes in
  signCenter: { x: 640, y: 278 }, // the name plate above the door
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

// The garage walls and roof take the theme's mood; the lit room inside is the same warm
// amber by day and by night: it is where the game is.
const DOOR_LEFT = 480;
const DOOR_RIGHT = 800;
const DOOR_TOP = 312;
const FLOOR_TOP = 440;
const GARAGE_BOTTOM = 470;
const SHUTTER = 0xe6e0d2;
const SHUTTER_LINE = 0xb9b2a4;
const ROOM_TOP = 0xf6b84a;
const ROOM_BOTTOM = 0xe08a2e;
const ROOM_FLOOR = 0xb86a22;
const SILHOUETTE = 0x3b2418;
const WOOD = 0x5a3a24;
const PAPER_WARM = 0xfff3c4;

/** A small garage with its door open on a lit study room, then sidewalk, road and lamp post. */
export function drawBank(g: Brush, P: ScenePalette): void {
  const roof = P.isDay ? 0x3f5a54 : 0x2e4f48;
  const roofEdge = P.isDay ? 0x2a3f3a : 0x4d8276;
  const wall = P.isDay ? 0xefe6d0 : 0x34554d;
  const wallShade = P.isDay ? 0xdcd2b8 : 0x294640;
  const trim = P.isDay ? 0xa9bba2 : 0x1b332d;
  const bush = P.isDay ? 0x5f9150 : 0x1b3623;
  const grass = P.isDay ? 0x7fb06a : 0x24452e;

  // Roof: low gable with a light edge so it reads against the sky.
  g.fillStyle(roof).fillTriangle(392, 258, 888, 258, 640, 176);
  g.lineStyle(3, roofEdge).strokeRect(392, 256, 496, 4);
  g.fillStyle(roofEdge, 0.5).fillTriangle(392, 258, 640, 258, 640, 176);
  g.fillStyle(roof).fillRect(386, 254, 508, 10);

  // Walls, with a shaded band under the eave and a plinth.
  g.fillStyle(wall).fillRect(410, 264, 460, 206);
  g.fillStyle(wallShade).fillRect(410, 264, 460, 8);
  g.fillStyle(trim).fillRect(404, 466, 472, 8);
  g.fillStyle(trim).fillRect(466, DOOR_TOP - 8, DOOR_RIGHT - DOOR_LEFT + 28, 8);
  g.fillStyle(trim).fillRect(DOOR_LEFT - 14, DOOR_TOP, 14, GARAGE_BOTTOM - DOOR_TOP);
  g.fillStyle(trim).fillRect(DOOR_RIGHT, DOOR_TOP, 14, GARAGE_BOTTOM - DOOR_TOP);

  // The plate with the name (the text itself is drawn on top by the scene or the page).
  const plate = STREET.signSize;
  const px = STREET.signCenter.x - plate.width / 2;
  const py = STREET.signCenter.y - plate.height / 2;
  g.fillStyle(COLORS.black).fillRect(px, py, plate.width, plate.height);
  g.lineStyle(2, COLORS.grayMid).strokeRect(px, py, plate.width, plate.height);

  // The lit room: warm wall, floor, a hanging lamp, shelves, a board, the study table.
  const rows = 8;
  const rowHeight = Math.ceil((FLOOR_TOP - DOOR_TOP) / rows);
  for (let i = 0; i < rows; i++) {
    g.fillStyle(mix(ROOM_TOP, ROOM_BOTTOM, i / (rows - 1))).fillRect(DOOR_LEFT, DOOR_TOP + i * rowHeight, DOOR_RIGHT - DOOR_LEFT, rowHeight);
  }
  g.fillStyle(ROOM_FLOOR).fillRect(DOOR_LEFT, FLOOR_TOP, DOOR_RIGHT - DOOR_LEFT, GARAGE_BOTTOM - FLOOR_TOP);
  g.fillStyle(WOOD, 0.35).fillRect(DOOR_LEFT, FLOOR_TOP, DOOR_RIGHT - DOOR_LEFT, 3);

  g.fillStyle(SILHOUETTE).fillRect(639, DOOR_TOP + 18, 2, 22);
  g.fillStyle(PAPER_WARM, 0.22).fillCircle(640, DOOR_TOP + 50, 46);
  g.fillStyle(PAPER_WARM, 0.35).fillCircle(640, DOOR_TOP + 50, 28);
  g.fillStyle(PAPER_WARM).fillCircle(640, DOOR_TOP + 50, 9);

  g.fillStyle(WOOD).fillRect(492, 378, 70, 5);
  g.fillStyle(0x8a5a34).fillRect(496, 360, 18, 18).fillRect(518, 366, 14, 12).fillRect(536, 362, 20, 16);
  g.fillStyle(PAPER_WARM).fillRect(738, 346, 52, 38);
  g.fillStyle(0xd9c27a).fillRect(744, 354, 40, 3).fillRect(744, 362, 30, 3).fillRect(744, 370, 36, 3);

  // Three people around the table (silhouettes), the table with two laptops and the coin.
  for (const x of [566, 640, 714]) {
    g.fillStyle(SILHOUETTE).fillCircle(x, 392, 9);
    g.fillRect(x - 10, 400, 20, 30);
  }
  g.fillStyle(WOOD).fillRect(548, 418, 184, 9);
  g.fillStyle(0x3d2616).fillRect(556, 427, 7, 28).fillRect(717, 427, 7, 28);
  for (const x of [584, 676]) {
    g.fillStyle(0x2b2b2b).fillRect(x, 402, 30, 16);
    g.fillStyle(PAPER_WARM).fillRect(x + 3, 404, 24, 11);
  }
  g.fillStyle(COLORS.lime).fillCircle(640, 412, 5);

  // The rolled-up door: a band of slats at the top of the opening.
  g.fillStyle(SHUTTER).fillRect(DOOR_LEFT, DOOR_TOP, DOOR_RIGHT - DOOR_LEFT, 18);
  for (let i = 1; i <= 2; i++) g.fillStyle(SHUTTER_LINE).fillRect(DOOR_LEFT, DOOR_TOP + i * 6, DOOR_RIGHT - DOOR_LEFT, 2);

  // Concrete in front of the door, bushes, a mailbox and a tree.
  g.fillStyle(COLORS.grayNeutral).fillRect(DOOR_LEFT - 20, GARAGE_BOTTOM, DOOR_RIGHT - DOOR_LEFT + 40, 30);
  g.fillStyle(grass).fillRect(380, 484, 100, 16).fillRect(820, 484, 100, 16);
  g.fillStyle(bush).fillCircle(424, 478, 16).fillCircle(396, 484, 12).fillCircle(848, 478, 16).fillCircle(878, 484, 12);
  g.fillStyle(COLORS.grayDark).fillRect(358, 462, 4, 38);
  g.fillStyle(COLORS.grayMid).fillRect(348, 448, 24, 16);
  g.fillStyle(COLORS.lime).fillRect(366, 444, 4, 10);
  g.fillStyle(0x6b4a32).fillRect(924, 396, 12, 104);
  g.fillStyle(bush).fillCircle(930, 380, 32).fillCircle(908, 398, 22).fillCircle(952, 398, 22);

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
