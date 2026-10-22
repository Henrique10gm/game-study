// The local store keeps one history per room; games from before the hall belong to Compliance.
import { describe, expect, it } from 'vitest';
import { LocalGameStore } from '../../src/state/LocalGameStore';
import type { GameRecord } from '../../src/state/records';

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

function game(id: string, questionId: string, correct: boolean, roomId?: string, xp = 10): GameRecord {
  const at = `2026-01-01T10:00:0${id.length}.000Z`;
  return {
    id,
    ...(roomId ? { roomId } : {}),
    modeId: 'm',
    requestedCount: 1,
    answeredCount: 1,
    correctCount: correct ? 1 : 0,
    xp,
    result: 'completed',
    startedAt: at,
    endedAt: at,
    answers: [{ questionId, chosenChoiceId: 'a', correct, answeredAt: at }],
  };
}

describe('LocalGameStore rooms', () => {
  it('lists and counts progress per room; no room asked = everything', async () => {
    const store = new LocalGameStore(memoryStorage());
    await store.saveGame(game('1', 'c1', true)); // before the hall: Compliance
    await store.saveGame(game('22', 'c2', false, 'compliance'));
    await store.saveGame(game('333', 'b1', true, 'banking', 30));

    expect((await store.listGames('compliance')).map((g) => g.id).sort()).toEqual(['1', '22']);
    expect((await store.listGames('banking')).map((g) => g.id)).toEqual(['333']);
    expect(await store.listGames()).toHaveLength(3);

    expect(await store.getProgress('compliance')).toEqual({ statuses: { c1: true, c2: false }, totalXp: 20 });
    expect(await store.getProgress('banking')).toEqual({ statuses: { b1: true }, totalXp: 30 });
    expect((await store.getProgress()).totalXp).toBe(50);
  });
});
