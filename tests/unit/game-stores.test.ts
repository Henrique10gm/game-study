import { describe, expect, it } from 'vitest';
import { AppsScriptGameStore, fetchTransport, scriptRunTransport } from '../../src/state/AppsScriptGameStore';
import { LocalGameStore } from '../../src/state/LocalGameStore';
import { wrongIdsOf } from '../../src/engine/progress';
import { computeStats, latestStatuses } from '../../src/state/records';
import type { GameRecord } from '../../src/state/records';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

function game(id: string, startedAt: string, answers: [string, boolean][], xp = 0): GameRecord {
  return {
    id,
    modeId: 'treino-sfn',
    requestedCount: 5,
    answeredCount: answers.length,
    correctCount: answers.filter(([, ok]) => ok).length,
    xp,
    result: 'completed',
    startedAt,
    endedAt: startedAt,
    answers: answers.map(([questionId, correct], i) => ({
      questionId,
      chosenChoiceId: 'a',
      correct,
      answeredAt: `${startedAt}#${i}`,
    })),
  };
}

describe('records helpers', () => {
  it('latest attempt wins: a question stays wrong until answered right', () => {
    const answers = [
      { questionId: 'q1', chosenChoiceId: 'a', correct: false, answeredAt: '1' },
      { questionId: 'q2', chosenChoiceId: 'a', correct: false, answeredAt: '2' },
      { questionId: 'q1', chosenChoiceId: 'b', correct: true, answeredAt: '3' },
    ];
    expect(latestStatuses(answers)).toEqual({ q1: true, q2: false });
    expect(wrongIdsOf(latestStatuses(answers))).toEqual(['q2']);
  });

  it('computes games played and accumulated xp', () => {
    expect(computeStats([{ xp: 10 }, { xp: 25 }] as never)).toEqual({ gamesPlayed: 2, totalXp: 35 });
  });
});

describe('LocalGameStore', () => {
  it('saves games, lists newest first, and tracks the questions still wrong', async () => {
    const store = new LocalGameStore(memoryStorage());
    await store.saveGame(game('g1', '2026-01-01T10:00:00Z', [['q1', false], ['q2', true]], 10));
    await store.saveGame(game('g2', '2026-01-02T10:00:00Z', [['q1', true], ['q3', false]], 10));

    const list = await store.listGames();
    expect(list.map((g) => g.id)).toEqual(['g2', 'g1']);
    expect('answers' in list[0]).toBe(false);
    expect(computeStats(list)).toEqual({ gamesPlayed: 2, totalXp: 20 });
    const progress = await store.getProgress();
    expect(wrongIdsOf(progress.statuses)).toEqual(['q3']);
    expect(progress.totalXp).toBe(20);
  });

  it('has no ranking (needs the server) and refuses nicknames', async () => {
    const store = new LocalGameStore(memoryStorage());
    expect((await store.getLeaderboard()).available).toBe(false);
    await expect(store.setNickname()).rejects.toThrow('unavailable');
  });

  it('survives corrupt storage', async () => {
    const storage = memoryStorage();
    storage.setItem('cq.games.v1', '{not json');
    const store = new LocalGameStore(storage);
    expect(await store.listGames()).toEqual([]);
  });
});

// Fake Apps Script endpoint: records requests and answers like Code.gs does.
function fakeScript(opts: { offline?: () => boolean } = {}) {
  const requests: Record<string, unknown>[] = [];
  const headers: Record<string, string>[] = [];
  const fetchImpl = async (_url: string, init?: RequestInit): Promise<Response> => {
    if (opts.offline?.()) throw new TypeError('Failed to fetch');
    headers.push(init?.headers as Record<string, string>);
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    requests.push(body);
    const reply =
      body.action === 'listGames'
        ? { ok: true, games: [{ id: 'g9', modeId: 'treino-sfn', xp: 5 }] }
        : body.action === 'progress'
          ? { ok: true, statuses: { q1: false, q2: false, q5: true }, totalXp: 40 }
          : body.action === 'leaderboard'
            ? { ok: true, available: true, entries: [{ rank: 1, nickname: 'Ana', mastered: 3, xp: 9, games: 1, me: true }], me: { nickname: 'Ana', rank: 1 } }
            : body.action === 'setNickname'
              ? body.nickname === 'Ocupado'
                ? { ok: false, error: 'nickname taken' }
                : { ok: true, nickname: String(body.nickname).trim() }
              : { ok: true };
    return new Response(JSON.stringify(reply), { status: 200 });
  };
  return { fetchImpl, requests, headers };
}

const URL = 'https://script.example/exec';

describe('AppsScriptGameStore', () => {
  it('creates one anonymous player key and reuses it', async () => {
    const storage = memoryStorage();
    const { fetchImpl, requests } = fakeScript();
    await new AppsScriptGameStore(fetchTransport(URL, fetchImpl), storage).saveGame(game('g1', '2026-01-01T10:00:00Z', [], 0));
    await new AppsScriptGameStore(fetchTransport(URL, fetchImpl), storage).listGames();

    const keys = new Set(requests.map((r) => r.playerKey));
    expect(keys.size).toBe(1);
    expect([...keys][0]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('posts as text/plain (no CORS preflight) and sends the game with its answers', async () => {
    const { fetchImpl, requests, headers } = fakeScript();
    const store = new AppsScriptGameStore(fetchTransport(URL, fetchImpl), memoryStorage());

    const status = await store.saveGame(game('g1', '2026-01-01T10:00:00Z', [['q1', false]], 0));

    expect(status).toBe('saved');
    expect(headers[0]['Content-Type']).toBe('text/plain;charset=utf-8');
    expect(requests[0]).toMatchObject({ action: 'saveGame', game: { id: 'g1' } });
    expect((requests[0].game as GameRecord).answers).toHaveLength(1);
  });

  it('reads games and wrong questions from the script', async () => {
    const { fetchImpl } = fakeScript();
    const store = new AppsScriptGameStore(fetchTransport(URL, fetchImpl), memoryStorage());
    expect((await store.listGames()).map((g) => g.id)).toEqual(['g9']);
    expect(wrongIdsOf((await store.getProgress()).statuses)).toEqual(['q1', 'q2']);
  });

  it('reads the leaderboard and sets the nickname, mapping server errors', async () => {
    const { fetchImpl } = fakeScript();
    const store = new AppsScriptGameStore(fetchTransport(URL, fetchImpl), memoryStorage());
    const board = await store.getLeaderboard();
    expect(board.entries[0]).toMatchObject({ nickname: 'Ana', me: true });
    expect(board.me).toEqual({ nickname: 'Ana', rank: 1 });
    expect(await store.setNickname(' Bia ')).toBe('Bia');
    await expect(store.setNickname('Ocupado')).rejects.toThrow('taken');
  });

  it('queues the game when offline, sends it on the next start, and counts it for "errei"', async () => {
    const storage = memoryStorage();
    let offline = true;
    const { fetchImpl, requests } = fakeScript({ offline: () => offline });
    const store = new AppsScriptGameStore(fetchTransport(URL, fetchImpl), storage);

    expect(await store.saveGame(game('g1', '2026-01-01T10:00:00Z', [['q7', false]], 0))).toBe('queued');
    expect(requests).toHaveLength(0);

    offline = false;
    const progress = await store.getProgress();
    expect(wrongIdsOf(progress.statuses)).toEqual(['q1', 'q2', 'q7']);
    expect(progress.totalXp).toBe(40); // server XP (the queued game had 0)

    await new AppsScriptGameStore(fetchTransport(URL, fetchImpl), storage).init();
    expect(requests.some((r) => r.action === 'saveGame')).toBe(true);
  });
});

describe('scriptRunTransport (game served by Apps Script)', () => {
  // Minimal fake of google.script.run: handle(json) answers with a JSON string.
  function fakeRun(reply: (request: Record<string, unknown>) => unknown, fail = false) {
    const requests: Record<string, unknown>[] = [];
    let onOk: (value: string) => void = () => {};
    let onFail: (error: Error) => void = () => {};
    const run = {
      withSuccessHandler(fn: (value: string) => void) {
        onOk = fn;
        return run;
      },
      withFailureHandler(fn: (error: Error) => void) {
        onFail = fn;
        return run;
      },
      handle(request: string) {
        const parsed = JSON.parse(request) as Record<string, unknown>;
        requests.push(parsed);
        if (fail) onFail(new Error('server down'));
        else onOk(JSON.stringify(reply(parsed)));
      },
    };
    return { run, requests };
  }

  it('saves, lists and reads wrong questions through the bridge', async () => {
    const { run, requests } = fakeRun((req) =>
      req.action === 'listGames'
        ? { ok: true, games: [{ id: 'g9' }] }
        : req.action === 'progress'
          ? { ok: true, statuses: { q1: false }, totalXp: 0 }
          : { ok: true },
    );
    const store = new AppsScriptGameStore(scriptRunTransport(run), memoryStorage());

    expect(await store.saveGame(game('g1', '2026-01-01T10:00:00Z', [['q1', false]], 0))).toBe('saved');
    expect((await store.listGames()).map((g) => g.id)).toEqual(['g9']);
    expect(wrongIdsOf((await store.getProgress()).statuses)).toEqual(['q1']);
    expect(requests.every((r) => typeof r.playerKey === 'string')).toBe(true);
  });

  it('queues the game when the server call fails', async () => {
    const { run } = fakeRun(() => ({ ok: true }), true);
    const store = new AppsScriptGameStore(scriptRunTransport(run), memoryStorage());
    expect(await store.saveGame(game('g1', '2026-01-01T10:00:00Z', [['q7', false]], 0))).toBe('queued');
  });
});
