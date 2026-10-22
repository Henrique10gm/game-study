// Corrida (the endless runner): the numbers and rules that make it fair. Pure
// functions, no Phaser, so they are tested without a browser.
//
//  - Low obstacles are jumped over, high ones are ducked under.
//  - A standing hero is tall enough to hit a high obstacle; a ducking hero is not.
//  - The jump clears the tallest low obstacle with room to spare.
//  - The space between obstacles always leaves time to land and react.

export type ObstacleType = 'low' | 'high';

export interface ObstacleKind {
  key: string; // texture key (drawn in BootScene)
  type: ObstacleType;
  width: number;
  height: number;
  lift: number; // distance from the ground to the bottom of the obstacle
}

export const OBSTACLES: readonly ObstacleKind[] = [
  { key: 'obs-docs', type: 'low', width: 40, height: 44, lift: 0 },
  { key: 'obs-box', type: 'low', width: 44, height: 36, lift: 0 },
  { key: 'obs-stamp', type: 'low', width: 36, height: 36, lift: 0 },
  { key: 'obs-siren', type: 'high', width: 44, height: 28, lift: 54 },
  { key: 'obs-banner', type: 'high', width: 80, height: 24, lift: 54 },
  { key: 'obs-drone', type: 'high', width: 48, height: 28, lift: 54 },
];

export const HERO_BOX = { width: 26, standHeight: 62, duckHeight: 34 } as const;

export const JUMP_VELOCITY = -760; // px/s (up)
export const GRAVITY = 2200; // px/s²
/** Hits are forgiving: the obstacle's box is this much smaller on every side. */
export const HIT_MARGIN = 6;
export const MIN_GAP = 360;

export interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/** The hero's box: x is the center, feetY the bottom (screen coordinates, y grows downwards). */
export function heroRect(x: number, feetY: number, ducking: boolean): Rect {
  const height = ducking ? HERO_BOX.duckHeight : HERO_BOX.standHeight;
  return { left: x - HERO_BOX.width / 2, right: x + HERO_BOX.width / 2, top: feetY - height, bottom: feetY };
}

/** The obstacle's hit box: x is the center, groundY the ground line. */
export function obstacleRect(x: number, groundY: number, kind: ObstacleKind): Rect {
  const bottom = groundY - kind.lift;
  return {
    left: x - kind.width / 2 + HIT_MARGIN,
    right: x + kind.width / 2 - HIT_MARGIN,
    top: bottom - kind.height + HIT_MARGIN,
    bottom: bottom - HIT_MARGIN,
  };
}

export function jumpApexHeight(): number {
  return (JUMP_VELOCITY * JUMP_VELOCITY) / (2 * GRAVITY);
}

export function jumpAirTimeSeconds(): number {
  return (2 * -JUMP_VELOCITY) / GRAVITY;
}

/** Distance between two obstacles (centers): grows with the speed, plus some randomness. */
export function nextGap(speed: number, random: () => number = Math.random): number {
  return Math.max(MIN_GAP, speed * 1.15) + Math.floor(random() * 140);
}

/** Never two high obstacles in a row (a duck followed by a duck is dull); otherwise random. */
export function pickObstacle(previous: ObstacleKind | null, random: () => number = Math.random): ObstacleKind {
  const pool = previous?.type === 'high' ? OBSTACLES.filter((o) => o.type === 'low') : OBSTACLES;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}
