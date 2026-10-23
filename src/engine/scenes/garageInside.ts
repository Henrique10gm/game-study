// The inside of the garage, where the missions are picked: a study corner with a pegboard of
// tools, a window, shelves, a whiteboard, hanging lamps, a rug and a workbench with a laptop.
// Painted through the same tiny Brush as the street (no Phaser needed), from the theme's
// palette: by night the lamps light the room, by day the window does.
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { ScenePalette } from '../palette';
import type { Brush } from './street';

/** Where the floor starts (the hero's feet are lower, at FLOOR_Y in MenuScene). */
export const GARAGE_FLOOR_TOP = 430;

const WOOD = 0x7a5236;
const WOOD_DARK = 0x5a3a24;
const PAPER = 0xfff3c4;
const LAMP = 0xe0a030;

export function drawGarageInside(g: Brush, P: ScenePalette): void {
  const day = P.isDay;
  const wall = day ? 0xf1e3c6 : 0x2c211a;
  const wallLow = day ? 0xdccdb0 : 0x3a2c22;
  const trim = day ? 0xb8a47e : 0x1d1510;
  const peg = day ? 0xcdbb97 : 0x4a392c;
  const hole = day ? 0xb8a47e : 0x2c211a;
  const floor = day ? 0xcfc6b4 : 0x4a443d;
  const joint = day ? 0xb9b0a0 : 0x38332d;

  // Walls: plaster, a lower band, a dark line where they meet.
  g.fillStyle(wall).fillRect(0, 0, GAME_WIDTH, GARAGE_FLOOR_TOP);
  g.fillStyle(wallLow).fillRect(0, 300, GAME_WIDTH, GARAGE_FLOOR_TOP - 300);
  g.fillStyle(trim).fillRect(0, 296, GAME_WIDTH, 6);

  // Pegboard with tools.
  g.fillStyle(peg).fillRect(50, 80, 260, 190);
  g.fillStyle(hole);
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 13; col++) g.fillRect(60 + col * 20, 90 + row * 20, 3, 3);
  }
  g.fillStyle(WOOD).fillRect(80, 112, 6, 50);
  g.fillStyle(COLORS.grayDark).fillRect(70, 106, 26, 12);
  g.fillStyle(COLORS.grayMid).fillRect(130, 116, 8, 56).fillCircle(134, 110, 10);
  g.fillStyle(peg).fillCircle(134, 110, 4);
  g.fillStyle(COLORS.grayNeutral).fillRect(176, 124, 84, 18);
  g.fillStyle(WOOD_DARK).fillRect(250, 120, 16, 26);
  g.fillStyle(0xb5654f).fillCircle(228, 190, 18);
  g.fillStyle(peg).fillCircle(228, 190, 8);

  // Window: the sky of the theme, so the garage looks onto the same street.
  g.fillStyle(trim).fillRect(356, 76, 158, 128);
  g.fillStyle(P.skyTop).fillRect(364, 84, 142, 56);
  g.fillStyle(P.skyBottom).fillRect(364, 140, 142, 56);
  if (day) {
    g.fillStyle(P.sun).fillCircle(470, 110, 14);
    g.fillStyle(P.cloud, 0.9).fillRect(380, 120, 40, 8).fillRect(388, 112, 24, 8);
  } else {
    g.fillStyle(P.star, 0.8);
    for (const [sx, sy] of [[380, 96], [412, 118], [448, 100], [486, 130], [396, 150], [470, 170]] as const) g.fillRect(sx, sy, 3, 3);
  }
  g.fillStyle(P.cityA).fillRect(364, 170, 18, 26).fillRect(388, 160, 22, 36).fillRect(416, 176, 16, 20).fillRect(438, 164, 24, 32).fillRect(468, 172, 20, 24);
  g.fillStyle(trim).fillRect(432, 84, 6, 112).fillRect(364, 136, 142, 6);

  // Shelves with boxes, books, a plant and a toolbox.
  g.fillStyle(WOOD).fillRect(560, 236, 170, 8).fillRect(560, 304, 170, 8);
  g.fillStyle(0x8a5a34).fillRect(572, 200, 28, 36);
  g.fillStyle(0xb5654f).fillRect(604, 212, 22, 24);
  g.fillStyle(0x6f8a5a).fillRect(632, 206, 26, 30);
  for (const [bx, bh, color] of [[668, 30, 0x2e4f48], [676, 36, 0xd2a23a], [684, 28, 0xb5654f], [692, 34, 0x6f8a5a], [700, 30, 0x2e4f48]] as const) {
    g.fillStyle(color).fillRect(bx, 236 - bh, 7, bh);
  }
  g.fillStyle(WOOD_DARK).fillRect(578, 276, 24, 28);
  g.fillStyle(COLORS.moss).fillCircle(590, 266, 16).fillCircle(578, 276, 10).fillCircle(602, 276, 10);
  g.fillStyle(0xb5654f).fillRect(630, 280, 56, 24);
  g.fillStyle(COLORS.grayDark).fillRect(648, 274, 20, 6);

  // Whiteboard with a plan: a list, a chart and a tick.
  g.fillStyle(COLORS.grayNeutral).fillRect(750, 70, 190, 142);
  g.fillStyle(PAPER).fillRect(758, 78, 174, 124);
  g.fillStyle(0x2e4f48).fillRect(768, 92, 110, 4).fillRect(768, 106, 84, 4).fillRect(768, 120, 96, 4);
  g.fillStyle(0xb5654f).fillRect(770, 160, 16, 32);
  g.fillStyle(0x2e4f48).fillRect(792, 148, 16, 44);
  g.fillStyle(0xd2a23a).fillRect(814, 136, 16, 56);
  g.fillStyle(0x2e4f48).fillRect(836, 124, 16, 68);
  g.fillStyle(COLORS.lime).fillRect(888, 92, 14, 14);
  g.fillStyle(0x2e4f48).fillRect(891, 99, 3, 3).fillRect(894, 102, 6, 3).fillRect(897, 94, 3, 8);
  g.fillStyle(COLORS.grayMid).fillRect(782, 208, 140, 6);

  // Hanging lamps. By night they glow over the room; by day they are just off.
  for (const lx of [230, 640]) {
    g.fillStyle(trim).fillRect(lx - 1, 0, 2, 66);
    g.fillStyle(LAMP).fillTriangle(lx - 34, 104, lx + 34, 104, lx, 66);
    g.fillStyle(day ? 0xe6dcc0 : PAPER).fillCircle(lx, 108, 8);
    if (!day) {
      g.fillStyle(PAPER, 0.07).fillTriangle(lx, 110, lx - 190, GARAGE_FLOOR_TOP, lx + 190, GARAGE_FLOOR_TOP);
      g.fillStyle(PAPER, 0.1).fillCircle(lx, 112, 92);
      g.fillStyle(PAPER, 0.14).fillCircle(lx, 112, 54);
    }
  }

  // Concrete floor with joints, a yellow safety line at the foot of the wall, a rug.
  g.fillStyle(floor).fillRect(0, GARAGE_FLOOR_TOP, GAME_WIDTH, GAME_HEIGHT - GARAGE_FLOOR_TOP);
  g.fillStyle(joint);
  for (let x = 0; x < GAME_WIDTH; x += 120) g.fillRect(x, GARAGE_FLOOR_TOP, 3, GAME_HEIGHT - GARAGE_FLOOR_TOP);
  g.fillRect(0, 520, GAME_WIDTH, 3).fillRect(0, 594, GAME_WIDTH, 3);
  g.fillStyle(0x000000, 0.14).fillRect(0, GARAGE_FLOOR_TOP, GAME_WIDTH, 10);
  g.fillStyle(0xf2c25b, 0.6).fillRect(0, GARAGE_FLOOR_TOP + 14, GAME_WIDTH, 5);
  g.fillStyle(0x8e4938).fillRect(300, 505, 300, 100);
  g.fillStyle(0xb5654f).fillRect(310, 513, 280, 84);
  g.fillStyle(0xf0e8d6, 0.6).fillRect(330, 545, 240, 6);

  // Workbench with a lit laptop, a mug and a stack of papers.
  g.fillStyle(WOOD).fillRect(690, 372, 250, 16);
  g.fillStyle(WOOD_DARK).fillRect(700, 388, 230, 52);
  g.fillStyle(WOOD).fillRect(712, 396, 96, 36).fillRect(820, 396, 96, 36);
  g.fillStyle(COLORS.grayMid).fillRect(756, 410, 8, 6).fillRect(864, 410, 8, 6);
  g.fillStyle(0x2b2b2b).fillRect(770, 360, 70, 12).fillRect(780, 322, 50, 38);
  g.fillStyle(PAPER).fillRect(785, 327, 40, 28);
  g.fillStyle(0xb5654f).fillRect(790, 332, 20, 3).fillStyle(0x2e4f48).fillRect(790, 340, 28, 3).fillRect(790, 347, 14, 3);
  g.fillStyle(0xb5654f).fillRect(884, 350, 16, 20);
  g.fillStyle(PAPER).fillRect(704, 358, 44, 14);
  g.fillStyle(COLORS.grayNeutral).fillRect(708, 354, 38, 6);
}
