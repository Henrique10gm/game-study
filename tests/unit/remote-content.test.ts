// The published question bank: the game always has a bank (cached or bundled),
// a newer one is stored for the next start, and anything doubtful is ignored.
import { describe, expect, it } from 'vitest';
import { contentRegistry } from '../../src/engine/content/contentRegistry';
import {
  bankToDraftCsv,
  parseCsv,
  publishedCsvToQuestions,
  toCsv,
} from '../../src/engine/content/draftSheet';
import {
  bundleStamp,
  createLiveContent,
  readCachedBank,
  refreshQuestionBank,
  type QuestionsReply,
} from '../../src/engine/content/remoteContent';
import type { QuestionContent } from '../../src/engine/content/types';

const bundled = contentRegistry.listQuestions();
const KEY = 'cq.questions.v1';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
}

function published(extra: Partial<QuestionContent> = {}): QuestionContent[] {
  return [{ ...bundled[0], sceneId: 'novo-01', question: 'Pergunta nova?', ...extra }];
}

const reply = (over: Partial<QuestionsReply>) => async () => ({ ok: true, ...over }) as QuestionsReply;

describe('live content', () => {
  it('starts from the bundle when nothing was downloaded', () => {
    const content = createLiveContent(bundled, memoryStorage());
    expect(content.listQuestions()).toBe(bundled);
    expect(content.getQuestion(bundled[0].sceneId)).toBe(bundled[0]);
  });

  it('starts from the downloaded bank when it is valid', () => {
    const storage = memoryStorage({ [KEY]: JSON.stringify({ version: 3, questions: published(), stamp: bundleStamp(bundled) }) });
    const content = createLiveContent(bundled, storage);
    expect(content.listQuestions().map((q) => q.sceneId)).toEqual(['novo-01']);
    expect(content.getQuestion('novo-01')?.question).toBe('Pergunta nova?');
  });

  it('ignores a downloaded bank saved by another build, so a new deploy shows its own questions at once', () => {
    const old = JSON.stringify({ version: 3, questions: published() }); // no stamp: saved by an older build
    expect(createLiveContent(bundled, memoryStorage({ [KEY]: old })).listQuestions()).toBe(bundled);
    const other = JSON.stringify({ version: 3, questions: published(), stamp: 'outra-versao' });
    expect(createLiveContent(bundled, memoryStorage({ [KEY]: other })).listQuestions()).toBe(bundled);
  });

  it('falls back to the bundle when the stored bank is broken or unreadable', () => {
    const broken = [
      'not json',
      JSON.stringify({ version: 1, questions: [] }),
      JSON.stringify({ version: 1, questions: [null] }),
      JSON.stringify({ version: 1, questions: published({ choices: [] }) }),
      JSON.stringify({ questions: published() }),
    ];
    for (const raw of broken) {
      expect(createLiveContent(bundled, memoryStorage({ [KEY]: raw })).listQuestions(), raw).toBe(bundled);
    }
    expect(createLiveContent(bundled, null).listQuestions()).toBe(bundled);
  });
});

describe('refreshQuestionBank', () => {
  it('stores a newer valid bank for the next start, without touching the one in use', async () => {
    const storage = memoryStorage();
    const content = createLiveContent(bundled, storage);
    expect(await refreshQuestionBank(reply({ version: 2, questions: published() }), storage, undefined, bundled)).toBe('updated');
    expect(readCachedBank(storage)).toMatchObject({ version: 2 });
    expect(content.listQuestions()).toBe(bundled); // this session keeps its bank
    expect(createLiveContent(bundled, storage).listQuestions().map((q) => q.sceneId)).toEqual(['novo-01']);
  });

  it('tells the backend which version it already holds', async () => {
    const storage = memoryStorage({ [KEY]: JSON.stringify({ version: 7, questions: published(), stamp: bundleStamp(bundled) }) });
    const asked: number[] = [];
    const ask = async (known: number) => {
      asked.push(known);
      return { ok: true, version: 7, unchanged: true } as QuestionsReply;
    };
    await refreshQuestionBank(ask, storage, undefined, bundled);
    // a bank saved by another build counts as not held, so the full bank is asked for again
    await refreshQuestionBank(ask, memoryStorage({ [KEY]: JSON.stringify({ version: 7, questions: published() }) }), undefined, bundled);
    expect(asked).toEqual([7, 0]);
  });

  it('keeps everything when the backend says unchanged or has nothing published', async () => {
    const storage = memoryStorage();
    expect(await refreshQuestionBank(reply({ version: 1, unchanged: true }), storage)).toBe('unchanged');
    expect(await refreshQuestionBank(reply({ version: 0, empty: true }), storage)).toBe('unchanged');
    expect(storage.data.size).toBe(0);
  });

  it('rejects a bank that breaks the authoring rules', async () => {
    const storage = memoryStorage();
    const noCorrect = published({ choices: bundled[0].choices.map((c) => ({ ...c, correct: false })) });
    expect(await refreshQuestionBank(reply({ version: 2, questions: noCorrect }), storage)).toBe('rejected');
    expect(await refreshQuestionBank(reply({ version: 2, questions: [] }), storage)).toBe('rejected');
    expect(await refreshQuestionBank(reply({ version: 2, questions: 'oops' }), storage)).toBe('rejected');
    expect(await refreshQuestionBank(reply({ questions: published() }), storage)).toBe('rejected'); // no version
    expect(storage.data.size).toBe(0);
  });

  it('never throws when the backend fails, answers an error, or storage is missing', async () => {
    const storage = memoryStorage();
    expect(await refreshQuestionBank(async () => { throw new Error('timeout'); }, storage)).toBe('unavailable');
    expect(await refreshQuestionBank(reply({ ok: false, error: 'boom' }), storage)).toBe('unavailable');
    expect(await refreshQuestionBank(reply({ version: 1, questions: published() }), null)).toBe('unavailable');
  });
});

describe('sheet CSV bridge', () => {
  it('round-trips awkward cells (commas, quotes, line breaks, accents)', () => {
    const rows = [['a,b', 'diz "oi"', 'linha1\nlinha2', 'ção — ok'], ['', 'x', '', '']];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });

  it('turns the whole bank into one Rascunho row per question, in header order', () => {
    const rows = parseCsv(bankToDraftCsv(bundled));
    expect(rows).toHaveLength(bundled.length + 1);
    expect(rows[0][0]).toBe('sceneId');
    expect(rows[1].slice(0, 2)).toEqual([bundled[0].sceneId, 'ativa']);
    expect(new Set(rows.slice(1).map((r) => r.length))).toEqual(new Set([rows[0].length]));
  });

  it('reads only the active questions from a downloaded Publicado tab', () => {
    const [one] = published();
    const csv = toCsv([
      ['sceneId', 'status', 'json', 'version', 'publishedAt'],
      [one.sceneId, 'ativa', JSON.stringify(one), '1', '2026-01-01'],
      ['velha-01', 'arquivada', JSON.stringify(bundled[1]), '1', '2026-01-01'],
      ['sem-json', 'ativa', '', '1', '2026-01-01'],
    ]);
    expect(publishedCsvToQuestions(csv)).toEqual([one]);
    expect(() => publishedCsvToQuestions('a,b\n1,2\n')).toThrow(/Publicado/);
  });
});
