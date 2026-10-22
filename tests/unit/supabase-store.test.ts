import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseGameStore } from '../../src/state/SupabaseGameStore';
import type { GameRecord } from '../../src/state/records';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

type DbError = { code?: string; message: string } | null;
type RpcReply = { data?: unknown; error?: DbError };

function fakeClient(rpc: (name: string, args: unknown) => Promise<RpcReply> | RpcReply) {
  const insert = vi.fn(async (): Promise<{ error: DbError }> => ({ error: null }));
  const upsert = vi.fn(async (): Promise<{ error: DbError }> => ({ error: null }));
  const call = vi.fn(async (name: string, args: unknown) => ({ data: null, error: null, ...(await rpc(name, args)) }));
  const client = { rpc: call, from: vi.fn(() => ({ insert, upsert })) };
  return { client: client as unknown as SupabaseClient, rpc: call, insert, upsert };
}

const game = (id: string, answers: [string, boolean][] = [['q1', true]], xp = 10): GameRecord => ({
  id,
  modeId: 'treino',
  requestedCount: answers.length,
  answeredCount: answers.length,
  correctCount: answers.filter(([, ok]) => ok).length,
  xp,
  result: 'completed',
  startedAt: '2026-01-01T10:00:00Z',
  endedAt: '2026-01-01T10:05:00Z',
  answers: answers.map(([questionId, correct], i) => ({
    questionId,
    chosenChoiceId: 'a',
    correct,
    answeredAt: `2026-01-01T10:0${i}:00Z`,
  })),
});

const report = {
  id: 'r1',
  questionId: 'q1',
  reason: 'typo' as const,
  comment: '',
  chosenChoiceId: 'a',
  correctChoiceId: 'b',
  createdAt: '2026-01-01T10:00:00Z',
};

describe('SupabaseGameStore', () => {
  it('saves a game through the save_game function', async () => {
    const { client, rpc } = fakeClient(() => ({}));
    const store = new SupabaseGameStore(client, 'u1', memoryStorage());
    expect(await store.saveGame(game('g1'))).toBe('saved');
    expect(rpc).toHaveBeenCalledWith('save_game', { p_game: expect.objectContaining({ id: 'g1' }) });
  });

  it('queues when the network fails and sends on the next init', async () => {
    let online = false;
    const { client, rpc } = fakeClient(() => {
      if (!online) throw new Error('Failed to fetch');
      return {};
    });
    const storage = memoryStorage();
    expect(await new SupabaseGameStore(client, 'u1', storage).saveGame(game('g1'))).toBe('queued');

    online = true;
    await new SupabaseGameStore(client, 'u1', storage).init();
    expect(rpc.mock.calls.filter(([name]) => name === 'save_game')).toHaveLength(2);
    expect(storage.getItem('qh.outbox.v1.u1')).toBe('[]');
  });

  it('keeps each account queue apart', async () => {
    const { client } = fakeClient(() => {
      throw new Error('offline');
    });
    const storage = memoryStorage();
    await new SupabaseGameStore(client, 'u1', storage).saveGame(game('g1'));
    expect(storage.getItem('qh.outbox.v1.u1')).not.toBeNull();
    expect(storage.getItem('qh.outbox.v1.u2')).toBeNull();
  });

  it('drops a game the server refuses for good instead of retrying forever', async () => {
    const { client } = fakeClient(() => ({ error: { code: '22023', message: 'invalid game' } }));
    const storage = memoryStorage();
    expect(await new SupabaseGameStore(client, 'u1', storage).saveGame(game('g1'))).toBe('saved');
    expect(JSON.parse(storage.getItem('qh.outbox.v1.u1') ?? '[]')).toEqual([]);
  });

  it('keeps a game queued when the session is not valid yet', async () => {
    const { client } = fakeClient(() => ({ error: { code: '28000', message: 'not authenticated' } }));
    expect(await new SupabaseGameStore(client, 'u1', memoryStorage()).saveGame(game('g1'))).toBe('queued');
  });

  it('progress adds the games still waiting in the outbox on top of the server snapshot', async () => {
    const { client } = fakeClient((name) =>
      name === 'my_progress'
        ? { data: { statuses: { q1: false, q2: true }, totalXp: 50 } }
        : { error: { message: 'offline' } },
    );
    const store = new SupabaseGameStore(client, 'u1', memoryStorage());
    await store.saveGame(game('g1', [['q1', true]], 10));
    expect(await store.getProgress('compliance')).toEqual({ statuses: { q1: true, q2: true }, totalXp: 60 });
  });

  it('maps nickname errors to the codes the screen understands', async () => {
    const taken = fakeClient(() => ({ error: { code: '23505', message: 'nickname taken' } }));
    await expect(new SupabaseGameStore(taken.client, 'u1', memoryStorage()).setNickname('ana')).rejects.toThrow('taken');
    const bad = fakeClient(() => ({ error: { code: '22023', message: 'invalid nickname' } }));
    await expect(new SupabaseGameStore(bad.client, 'u1', memoryStorage()).setNickname('-')).rejects.toThrow('invalid');
    const ok = fakeClient(() => ({ data: 'ana' }));
    expect(await new SupabaseGameStore(ok.client, 'u1', memoryStorage()).setNickname(' ana')).toBe('ana');
  });

  it('has no ranking until a group is chosen, then reads it through leaderboard()', async () => {
    const rows = [
      { rank: 1, nickname: 'ana', mastered: 3, xp: 30, games: 2, me: true },
      { rank: 2, nickname: 'bia', mastered: '1', xp: 10, games: 1, me: false },
    ];
    const { client, rpc } = fakeClient(() => ({ data: rows }));
    const store = new SupabaseGameStore(client, 'u1', memoryStorage());
    expect((await store.getLeaderboard('compliance')).available).toBe(false);

    store.setActiveGroup('g-1');
    const board = await store.getLeaderboard('compliance');
    expect(rpc).toHaveBeenCalledWith('leaderboard', { p_group_id: 'g-1', p_room_id: 'compliance' });
    expect(board.available).toBe(true);
    expect(board.entries[1].mastered).toBe(1);
    expect(board.me).toEqual({ nickname: 'ana', rank: 1, total: 2 });
  });

  it('treats a repeated report id as already saved and queues real failures', async () => {
    const dup = fakeClient(() => ({}));
    dup.insert.mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate' } });
    expect(await new SupabaseGameStore(dup.client, 'u1', memoryStorage()).reportQuestion(report)).toBe('saved');

    const down = fakeClient(() => ({}));
    down.insert.mockRejectedValueOnce(new Error('offline'));
    expect(await new SupabaseGameStore(down.client, 'u1', memoryStorage()).reportQuestion(report)).toBe('queued');
  });

  it('records screen time per room and never throws', async () => {
    const { client, upsert } = fakeClient(() => ({}));
    const store = new SupabaseGameStore(client, 'u1', memoryStorage());
    await store.recordScreenTime({
      sessionId: 's1',
      startedAt: '2026-01-01T10:00:00Z',
      seconds: { hall: 30, compliance: 90 },
    });
    expect(upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({ session_id: 's1', room_id: 'hall', active_seconds: 30 }),
        expect.objectContaining({ session_id: 's1', room_id: 'compliance', active_seconds: 90 }),
      ],
      { onConflict: 'session_id,room_id' },
    );
    upsert.mockRejectedValueOnce(new Error('offline'));
    await expect(
      store.recordScreenTime({ sessionId: 's1', startedAt: 'x', seconds: { hall: 1 } }),
    ).resolves.toBeUndefined();
  });
});
