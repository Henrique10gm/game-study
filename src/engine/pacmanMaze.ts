// Pac-Man style mode: the maze and the rules of movement on it. Pure functions
// and data, no Phaser, so they are tested without a browser. '#' is wall and
// anything else is a path. Only the left half is written down: the maze is
// mirrored around a centre column, so it is always symmetric and fair.

const LEFT_HALF: readonly string[] = [
  '############',
  '#...........',
  '#.###.#####.',
  '#.#.........',
  '#.#.#.###.##',
  '#...#...#...',
  '###.###.#.#.',
  '#...........',
  '#.###.##.##.',
  '#.....#.....',
  '#.#.#.#.###.',
  '#.#.#.......',
  '#.#.#####.#.',
  '#...........',
  '#.###.###.#.',
  '#...........',
  '############',
];

const CENTER = '#.#...#.....#...#';

export const MAZE_COLS = LEFT_HALF[0].length * 2 + 1;
export const MAZE_ROWS = LEFT_HALF.length;

function mirror(left: string, center: string): string {
  return left + center + [...left].reverse().join('');
}

export const MAZE: readonly string[] = LEFT_HALF.map((row, y) => mirror(row, CENTER[y]));

export interface Cell {
  col: number;
  row: number;
}

export type Direction = 'left' | 'right' | 'up' | 'down';

export const DIRECTIONS: readonly Direction[] = ['left', 'right', 'up', 'down'];

export const DELTA: Record<Direction, Cell> = {
  left: { col: -1, row: 0 },
  right: { col: 1, row: 0 },
  up: { col: 0, row: -1 },
  down: { col: 0, row: 1 },
};

export const OPPOSITE: Record<Direction, Direction> = { left: 'right', right: 'left', up: 'down', down: 'up' };

export function isWall(col: number, row: number): boolean {
  if (row < 0 || row >= MAZE_ROWS || col < 0 || col >= MAZE_COLS) return true;
  return MAZE[row][col] === '#';
}

export function canMove(from: Cell, direction: Direction): boolean {
  const d = DELTA[direction];
  return !isWall(from.col + d.col, from.row + d.row);
}

/** Directions a character standing in `from` can take. */
export function openDirections(from: Cell): Direction[] {
  return DIRECTIONS.filter((direction) => canMove(from, direction));
}

/** Every open cell, in reading order. */
export function openCells(): Cell[] {
  const cells: Cell[] = [];
  MAZE.forEach((line, row) => {
    [...line].forEach((char, col) => {
      if (char !== '#') cells.push({ col, row });
    });
  });
  return cells;
}

/** Where the hero starts, and where the thieves start (spread on purpose). */
export const HERO_START: Cell = { col: 12, row: 13 };
export const THIEF_STARTS: readonly Cell[] = [
  { col: 1, row: 1 },
  { col: 23, row: 1 },
  { col: 12, row: 7 },
  { col: 1, row: 15 },
];

export function manhattan(a: Cell, b: Cell): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

// Coins are few and show up along the way: at most MAX_COINS_ON_BOARD at a time,
// one new every COIN_SPAWN_MS, never on top of the hero or right beside a thief.
export const MAX_COINS_ON_BOARD = 3;
export const COIN_SPAWN_MS = 2200;
const COIN_MIN_FROM_HERO = 6;
const COIN_MIN_FROM_THIEF = 3;

/** Where the next coin appears (null if the maze has no good spot right now). */
export function pickCoinCell(
  taken: readonly Cell[],
  hero: Cell,
  thieves: readonly Cell[],
  random: () => number = Math.random,
): Cell | null {
  const used = new Set(taken.map((c) => `${c.col},${c.row}`));
  const spots = openCells().filter(
    (c) =>
      !used.has(`${c.col},${c.row}`) &&
      manhattan(c, hero) >= COIN_MIN_FROM_HERO &&
      thieves.every((t) => manhattan(c, t) >= COIN_MIN_FROM_THIEF),
  );
  if (spots.length === 0) return null;
  return spots[Math.min(spots.length - 1, Math.floor(random() * spots.length))];
}

/**
 * The way a thief goes at a crossing. It never turns back unless it has to, and
 * `chase` (0-1) is the chance of taking the step that gets closest to `target`
 * instead of a random one.
 */
export function chooseThiefDirection(
  from: Cell,
  heading: Direction,
  target: Cell,
  chase: number,
  random: () => number = Math.random,
): Direction {
  const open = openDirections(from);
  if (open.length === 0) return heading;
  const ahead = open.filter((d) => d !== OPPOSITE[heading]);
  const options = ahead.length > 0 ? ahead : open;
  if (options.length === 1) return options[0];
  if (random() < chase) {
    let best = options[0];
    let bestDistance = Infinity;
    for (const d of options) {
      const distance = manhattan({ col: from.col + DELTA[d].col, row: from.row + DELTA[d].row }, target);
      if (distance < bestDistance) {
        best = d;
        bestDistance = distance;
      }
    }
    return best;
  }
  return options[Math.min(options.length - 1, Math.floor(random() * options.length))];
}

/** How many thieves roam the maze: one more every 5 questions answered. */
export function thiefCount(questionsAnswered: number): number {
  return Math.min(THIEF_STARTS.length, 2 + Math.floor(Math.max(0, questionsAnswered) / 5));
}

/** How hard the thieves chase (0-1), growing with the questions answered. */
export function chaseChance(questionsAnswered: number): number {
  return Math.min(0.85, 0.45 + 0.05 * Math.max(0, questionsAnswered));
}

export const HERO_SPEED = 150; // px/s
export const THIEF_SPEED_RATIO = 0.82; // thieves start a bit slower than the hero

/** Thief speed in px/s: follows the run's speed (which grows with right answers) but never passes the hero. */
export function thiefSpeed(speedPct: number): number {
  return Math.min(HERO_SPEED * 0.97, HERO_SPEED * THIEF_SPEED_RATIO * Math.sqrt(speedPct / 100));
}

// ---- movement ---------------------------------------------------------------
// Everyone walks from the centre of a cell to the centre of the next one. An
// actor is "in" `cell` and heading `dir`, `t` pixels of the way to the next cell.

export interface Actor {
  cell: Cell;
  dir: Direction | null; // null = standing still at the centre of `cell`
  t: number; // pixels already walked from the centre of `cell` towards `dir`
}

export function stepCell(cell: Cell, direction: Direction): Cell {
  return { col: cell.col + DELTA[direction].col, row: cell.row + DELTA[direction].row };
}

/** Called at the centre of a cell: where to go next (null = stop). */
export type Chooser = (cell: Cell, current: Direction | null) => Direction | null;

/** Walks `distance` pixels (tile = cell size), asking `choose` for a direction at every cell centre. */
export function advanceActor(actor: Actor, distance: number, tile: number, choose: Chooser): void {
  let remaining = distance;
  for (let guard = 0; guard < 16 && remaining > 0; guard++) {
    if (actor.dir && actor.t === 0 && !canMove(actor.cell, actor.dir)) actor.dir = null; // never start into a wall
    if (!actor.dir) {
      const first = choose(actor.cell, null);
      if (!first || !canMove(actor.cell, first)) return;
      actor.dir = first;
      actor.t = 0;
    }
    const left = tile - actor.t;
    if (remaining < left) {
      actor.t += remaining;
      return;
    }
    remaining -= left;
    actor.cell = stepCell(actor.cell, actor.dir);
    actor.t = 0;
    const next = choose(actor.cell, actor.dir);
    actor.dir = next && canMove(actor.cell, next) ? next : null;
  }
}

/** Turning back in the middle of a corridor is allowed at any moment. */
export function reverseActor(actor: Actor, tile: number): void {
  if (!actor.dir) return;
  actor.cell = stepCell(actor.cell, actor.dir);
  actor.dir = OPPOSITE[actor.dir];
  actor.t = tile - actor.t;
}
