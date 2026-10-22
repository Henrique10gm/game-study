import { describe, expect, it } from 'vitest';
import {
  HERO_SPEED,
  HERO_START,
  MAZE,
  MAZE_COLS,
  MAZE_ROWS,
  THIEF_STARTS,
  advanceActor,
  canMove,
  chaseChance,
  chooseThiefDirection,
  COIN_SPAWN_MS,
  MAX_COINS_ON_BOARD,
  manhattan,
  pickCoinCell,
  isWall,
  openCells,
  openDirections,
  reverseActor,
  stepCell,
  thiefCount,
  thiefSpeed,
} from '../../src/engine/pacmanMaze';
import type { Actor, Cell } from '../../src/engine/pacmanMaze';

const TILE = 32;
const key = (c: Cell): string => `${c.col},${c.row}`;

describe('Fuja dos ladrões: the maze', () => {
  it('is a closed rectangle, mirrored left to right', () => {
    expect(MAZE).toHaveLength(MAZE_ROWS);
    for (const row of MAZE) {
      expect(row).toHaveLength(MAZE_COLS);
      expect([...row].reverse().join('')).toBe(row);
      expect(row[0]).toBe('#');
      expect(row[MAZE_COLS - 1]).toBe('#');
    }
    expect(MAZE[0]).toBe('#'.repeat(MAZE_COLS));
    expect(MAZE[MAZE_ROWS - 1]).toBe('#'.repeat(MAZE_COLS));
  });

  it('every path cell can be reached from the hero start, and none is a dead end', () => {
    const seen = new Set([key(HERO_START)]);
    const queue: Cell[] = [HERO_START];
    while (queue.length) {
      const cell = queue.pop()!;
      for (const direction of openDirections(cell)) {
        const next = stepCell(cell, direction);
        if (!seen.has(key(next))) {
          seen.add(key(next));
          queue.push(next);
        }
      }
    }
    const open = openCells();
    expect(seen.size).toBe(open.length);
    for (const cell of open) expect(openDirections(cell).length).toBeGreaterThanOrEqual(2);
  });

  it('starts everyone on a path', () => {
    for (const cell of [HERO_START, ...THIEF_STARTS]) expect(isWall(cell.col, cell.row)).toBe(false);
  });

  it('coins are few and spread over time, never on the hero, a thief or another coin', () => {
    expect(MAX_COINS_ON_BOARD).toBeLessThanOrEqual(3);
    expect(COIN_SPAWN_MS).toBeGreaterThan(1000);
    const taken: Cell[] = [{ col: 1, row: 7 }];
    for (let i = 0; i < 200; i++) {
      const cell = pickCoinCell(taken, HERO_START, THIEF_STARTS)!;
      expect(isWall(cell.col, cell.row)).toBe(false);
      expect(key(cell)).not.toBe(key(taken[0]));
      expect(manhattan(cell, HERO_START)).toBeGreaterThanOrEqual(6);
      for (const thief of THIEF_STARTS) expect(manhattan(cell, thief)).toBeGreaterThanOrEqual(3);
    }
  });

  it('has no coin to place when every spot is taken', () => {
    expect(pickCoinCell(openCells(), HERO_START, THIEF_STARTS)).toBeNull();
  });

  it('treats everything outside the grid as wall', () => {
    expect(isWall(-1, 3)).toBe(true);
    expect(isWall(3, MAZE_ROWS)).toBe(true);
    expect(canMove({ col: 1, row: 1 }, 'up')).toBe(false);
    expect(canMove({ col: 1, row: 1 }, 'right')).toBe(true);
  });
});

describe('Fuja dos ladrões: walking', () => {
  it('walks cell to cell, asking for a direction at every centre', () => {
    const actor: Actor = { cell: { col: 1, row: 1 }, dir: null, t: 0 };
    const asked: string[] = [];
    advanceActor(actor, TILE * 2 + 10, TILE, (cell) => {
      asked.push(key(cell));
      return 'right';
    });
    expect(actor.cell).toEqual({ col: 3, row: 1 });
    expect(actor.dir).toBe('right');
    expect(actor.t).toBe(10);
    expect(asked).toEqual(['1,1', '2,1', '3,1']);
  });

  it('stops at a wall, and never walks through one even on a very long step', () => {
    const actor: Actor = { cell: { col: 1, row: 1 }, dir: 'left', t: 0 };
    advanceActor(actor, 5000, TILE, (cell, current) => (current && canMove(cell, current) ? current : null));
    expect(actor.dir).toBeNull();
    expect(isWall(actor.cell.col, actor.cell.row)).toBe(false);
  });

  it('refuses a direction that points into a wall', () => {
    const actor: Actor = { cell: { col: 1, row: 1 }, dir: null, t: 0 };
    advanceActor(actor, 40, TILE, () => 'up');
    expect(actor.dir).toBeNull();
    expect(actor.t).toBe(0);
  });

  it('turning back mid-corridor lands on the cell it came from', () => {
    const actor: Actor = { cell: { col: 1, row: 1 }, dir: 'right', t: 10 };
    reverseActor(actor, TILE);
    expect(actor).toEqual({ cell: { col: 2, row: 1 }, dir: 'left', t: TILE - 10 });
    advanceActor(actor, TILE - 10, TILE, () => null);
    expect(actor.cell).toEqual({ col: 1, row: 1 });
    expect(actor.dir).toBeNull();
  });
});

describe('Fuja dos ladrões: the thieves', () => {
  const crossing: Cell = { col: 12, row: 7 };

  it('never turns back when it can go on', () => {
    for (let i = 0; i < 40; i++) {
      expect(chooseThiefDirection(crossing, 'right', { col: 1, row: 1 }, 0, Math.random)).not.toBe('left');
    }
  });

  it('keeps its heading when there is nothing to choose from', () => {
    expect(chooseThiefDirection({ col: 0, row: 0 }, 'up', { col: 5, row: 5 }, 1)).toBe('up'); // inside a wall: no way out
  });

  it('a full chase takes the step that gets closest to the hero', () => {
    const next = chooseThiefDirection({ col: 11, row: 7 }, 'left', { col: 11, row: 1 }, 1, () => 0);
    expect(next).toBe('up');
  });

  it('gets more thieves, more cunning and more speed as the run goes on, but never outruns the hero', () => {
    expect(thiefCount(0)).toBe(2);
    expect(thiefCount(5)).toBe(3);
    expect(thiefCount(1000)).toBe(THIEF_STARTS.length);
    expect(chaseChance(0)).toBeLessThan(chaseChance(10));
    expect(chaseChance(1000)).toBeLessThanOrEqual(0.85);
    expect(thiefSpeed(100)).toBeLessThan(thiefSpeed(200));
    expect(thiefSpeed(10000)).toBeLessThan(HERO_SPEED);
  });
});
