import { describe, expect, it } from 'vitest';
import {
  GRAVITY,
  HERO_BOX,
  HIT_MARGIN,
  JUMP_VELOCITY,
  MIN_GAP,
  OBSTACLES,
  heroRect,
  jumpAirTimeSeconds,
  jumpApexHeight,
  nextGap,
  obstacleRect,
  overlaps,
  pickObstacle,
} from '../../src/engine/runnerRules';
import { MAX_SPEED } from '../../src/engine/run/levelTuning';

const GROUND = 576;
const low = OBSTACLES.filter((o) => o.type === 'low');
const high = OBSTACLES.filter((o) => o.type === 'high');

describe('runner rules: fairness', () => {
  it('has both kinds of obstacle, at least two variants of each', () => {
    expect(low.length).toBeGreaterThanOrEqual(2);
    expect(high.length).toBeGreaterThanOrEqual(2);
    expect(new Set(OBSTACLES.map((o) => o.key)).size).toBe(OBSTACLES.length);
  });

  it('jumping clears every low obstacle with room to spare, and the arc is physically consistent', () => {
    const tallest = Math.max(...low.map((o) => o.height));
    expect(jumpApexHeight()).toBeGreaterThan(tallest + 30);
    expect(jumpApexHeight()).toBeCloseTo((JUMP_VELOCITY ** 2) / (2 * GRAVITY));
    expect(jumpAirTimeSeconds()).toBeGreaterThan(0.4);
    expect(jumpAirTimeSeconds()).toBeLessThan(1);
  });

  it('standing hits every high obstacle and ducking passes under it', () => {
    for (const kind of high) {
      const hit = obstacleRect(300, GROUND, kind);
      expect(overlaps(heroRect(300, GROUND, false), hit)).toBe(true);
      expect(overlaps(heroRect(300, GROUND, true), hit)).toBe(false);
    }
  });

  it('a hero on the ground hits every low obstacle, a hero at the top of the jump does not', () => {
    for (const kind of low) {
      const hit = obstacleRect(300, GROUND, kind);
      expect(overlaps(heroRect(300, GROUND, false), hit)).toBe(true);
      expect(overlaps(heroRect(300, GROUND - jumpApexHeight(), false), hit)).toBe(false);
    }
  });

  it('a high obstacle leaves room to duck (the gap under it is taller than the ducking hero)', () => {
    for (const kind of high) {
      expect(kind.lift - HIT_MARGIN).toBeGreaterThan(HERO_BOX.duckHeight);
      expect(kind.lift).toBeLessThan(HERO_BOX.standHeight);
    }
  });

  it('the gap between obstacles gives time to land and react, even at the top speed', () => {
    const tightest = Math.min(...Array.from({ length: 50 }, (_, i) => nextGap(MAX_SPEED, () => i / 50)));
    const widest = Math.max(...OBSTACLES.map((o) => o.width));
    expect(tightest).toBeGreaterThanOrEqual(MIN_GAP);
    expect(tightest).toBeGreaterThan(MAX_SPEED * jumpAirTimeSeconds() + widest + HERO_BOX.width);
  });

  it('the gap grows with the speed', () => {
    expect(nextGap(320, () => 0)).toBeGreaterThanOrEqual(nextGap(170, () => 0));
  });

  it('never two high obstacles in a row', () => {
    const lastHigh = high[0];
    for (let i = 0; i < 40; i++) expect(pickObstacle(lastHigh, () => i / 40).type).toBe('low');
    const seen = new Set(Array.from({ length: 60 }, (_, i) => pickObstacle(null, () => i / 60).type));
    expect(seen).toEqual(new Set(['low', 'high']));
  });

  it('overlap is strict: touching edges do not count', () => {
    const a = { left: 0, right: 10, top: 0, bottom: 10 };
    expect(overlaps(a, { left: 10, right: 20, top: 0, bottom: 10 })).toBe(false);
    expect(overlaps(a, { left: 9, right: 20, top: 0, bottom: 10 })).toBe(true);
  });
});
