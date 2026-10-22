// Study habit (daily goal + streak) and the menu secrets counter.
import { describe, expect, it } from 'vitest';
import { DAILY_GOAL, EMPTY_FOCUS, dayKey, focusView, loadFocus, recordAnswers, saveFocus } from '../../src/engine/focus';
import { SECRET_IDS, Secrets } from '../../src/engine/secrets';

const day = (offset: number, hour = 10): Date => new Date(2026, 9, 5 + offset, hour);

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

describe('daily goal and streak', () => {
  it('counts answers today and starts a streak when the goal is met', () => {
    let state = recordAnswers(EMPTY_FOCUS, 4, day(0));
    expect(focusView(state, day(0)).today).toBe(4);
    expect(focusView(state, day(0)).streak).toBe(0);
    state = recordAnswers(state, DAILY_GOAL - 4, day(0, 20));
    const view = focusView(state, day(0, 21));
    expect(view).toMatchObject({ done: true, streak: 1, today: DAILY_GOAL });
  });

  it('extends the streak on consecutive days and counts the goal once per day', () => {
    let state = recordAnswers(EMPTY_FOCUS, DAILY_GOAL, day(0));
    state = recordAnswers(state, DAILY_GOAL, day(0, 22)); // same day again
    expect(focusView(state, day(0)).streak).toBe(1);
    state = recordAnswers(state, DAILY_GOAL, day(1));
    state = recordAnswers(state, DAILY_GOAL, day(2));
    expect(focusView(state, day(2)).streak).toBe(3);
    expect(focusView(state, day(2)).best).toBe(3);
  });

  it('keeps the streak alive until the end of the next day, then loses it but remembers the record', () => {
    let state = recordAnswers(EMPTY_FOCUS, DAILY_GOAL, day(0));
    state = recordAnswers(state, DAILY_GOAL, day(1));
    const nextDay = focusView(state, day(2));
    expect(nextDay).toMatchObject({ streak: 2, today: 0, done: false, atRisk: true });
    expect(nextDay.line).toMatch(/Faltam 10/);
    const later = focusView(state, day(3));
    expect(later).toMatchObject({ streak: 0, best: 2, atRisk: false });
    state = recordAnswers(state, DAILY_GOAL, day(3));
    expect(focusView(state, day(3))).toMatchObject({ streak: 1, best: 2 });
  });

  it('suggests Revanche when there are wrong questions to review', () => {
    expect(focusView(EMPTY_FOCUS, day(0), DAILY_GOAL, 3).line).toMatch(/Revanche/);
    expect(focusView(EMPTY_FOCUS, day(0), DAILY_GOAL, 0).line).not.toMatch(/Revanche/);
  });

  it('survives a round trip through storage and ignores garbage', () => {
    const storage = memoryStorage();
    const state = recordAnswers(EMPTY_FOCUS, DAILY_GOAL, day(0));
    saveFocus(state, storage);
    expect(loadFocus(storage)).toEqual(state);
    expect(loadFocus(memoryStorage({ 'cq.focus.v1': '{"day":7,"streak":-3}' }))).toEqual(EMPTY_FOCUS);
    expect(loadFocus(memoryStorage({ 'cq.focus.v1': 'not json' }))).toEqual(EMPTY_FOCUS);
    expect(dayKey(day(0))).toBe('2026-10-05');
  });
});

describe('menu secrets', () => {
  it('counts each secret once and persists them', () => {
    const storage = memoryStorage();
    const secrets = new Secrets(storage);
    expect(secrets.view()).toEqual({ found: 0, total: SECRET_IDS.length });
    expect(secrets.discover('lamp')).toMatchObject({ isNew: true, found: 1, all: false });
    expect(secrets.discover('lamp')).toMatchObject({ isNew: false, found: 1 });
    expect(new Secrets(storage).has('lamp')).toBe(true);
  });

  it('reports when the last one is found and ignores unknown ids in storage', () => {
    const storage = memoryStorage({ 'cq.secrets.v1': JSON.stringify(['nope', ...SECRET_IDS.slice(1)]) });
    const secrets = new Secrets(storage);
    expect(secrets.view().found).toBe(SECRET_IDS.length - 1);
    expect(secrets.discover(SECRET_IDS[0])).toMatchObject({ isNew: true, all: true });
  });
});
