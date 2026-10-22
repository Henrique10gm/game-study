import { describe, expect, it } from 'vitest';
import { getRoomBundle } from '../../src/engine/content/rooms';
import { getMode, pickQuestions, questionsForMode, sizeOptions } from '../../src/engine/modes';
import { MAX_SPEED, SPEED_PER_CORRECT, levelTuning } from '../../src/engine/run/levelTuning';
import { makeFixtureScene } from '../fixtures/fixtureContent';

const bank = [
  makeFixtureScene(1, { categories: ['sfn'], exam: true }),
  makeFixtureScene(2, { categories: ['cambio-pld'], exam: true }),
  makeFixtureScene(3, { categories: ['limites'] }),
  makeFixtureScene(4, { categories: ['punicoes'] }),
  makeFixtureScene(5, { categories: ['sfn', 'cambio-pld'] }),
];

const ids = (list: { sceneId: string }[]): string[] => list.map((q) => q.sceneId);

const modes = getRoomBundle('compliance')!.def.modes;
const pool = (modeId: string, wrong: string[] = [], all = bank) => questionsForMode(getMode(modes, modeId)!, all, wrong);

describe('game modes (Compliance room)', () => {
  it('lists the modes with the exact menu titles', () => {
    expect(modes.map((m) => m.title)).toEqual([
      'Dia da Prova',
      'Quem é quem no SFN',
      'Na Régua: limites e reportes',
      'Mesa de Câmbio e PLD',
      'O Tribunal: quem pune quem',
      'Qual é a Lei?',
      'Ache o erro: transações atípicas',
      'Revanche',
    ]);
  });

  it('prova = exam questions only', () => {
    expect(ids(pool('prova-abt1'))).toEqual(['fixture-01', 'fixture-02']);
  });

  it('trainings filter by category (a question can be in several)', () => {
    expect(ids(pool('treino-sfn'))).toEqual(['fixture-01', 'fixture-05']);
    expect(ids(pool('treino-cambio'))).toEqual(['fixture-02', 'fixture-05']);
    expect(ids(pool('treino-limites'))).toEqual(['fixture-03']);
    expect(ids(pool('treino-punicoes'))).toEqual(['fixture-04']);
  });

  it('"questões que errei" = the ids from the history, nothing else', () => {
    expect(ids(pool('treino-erros', ['fixture-03', 'fixture-99']))).toEqual(['fixture-03']);
    expect(pool('treino-erros', [])).toEqual([]);
  });
});

describe('game modes (other kinds)', () => {
  it('"all" plays every question of the room', () => {
    expect(ids(questionsForMode({ id: 'x', kind: 'all', title: 't', description: 'd' }, bank))).toHaveLength(bank.length);
  });

  it('a category mode with no category plays nothing', () => {
    expect(questionsForMode({ id: 'x', kind: 'category', title: 't', description: 'd' }, bank)).toEqual([]);
  });
});

describe('size options and picking', () => {
  it('offers the full phase plus 5/10/20 only when smaller than the pool', () => {
    expect(sizeOptions(45).map((o) => o.count)).toEqual([45, 5, 10, 20]);
    expect(sizeOptions(12).map((o) => o.count)).toEqual([12, 5, 10]);
    expect(sizeOptions(5).map((o) => o.count)).toEqual([5]);
    expect(sizeOptions(0)).toEqual([]);
    expect(sizeOptions(45)[0]).toMatchObject({ complete: true, label: 'Fase completa (45 questões)' });
  });

  it('picks the requested number without repeats', () => {
    const picked = pickQuestions(bank, 3, () => 0.3);
    expect(picked).toHaveLength(3);
    expect(new Set(ids(picked)).size).toBe(3);
    expect(pickQuestions(bank, 99)).toHaveLength(bank.length);
  });

  it('puts questions not yet mastered before the mastered ones', () => {
    const statuses = Object.fromEntries(bank.slice(0, 2).map((q) => [q.sceneId, true]));
    const mastered = new Set(Object.keys(statuses));
    const open = bank.length - mastered.size;
    for (const r of [0, 0.3, 0.9]) {
      const picked = pickQuestions(bank, bank.length, () => r, statuses);
      expect(picked.slice(0, open).some((q) => mastered.has(q.sceneId))).toBe(false);
    }
    expect(pickQuestions(bank, 1, () => 0.5, statuses).every((q) => !mastered.has(q.sceneId))).toBe(true);
  });
});

describe('levelTuning', () => {
  it('the barriers get faster with every correct answer, up to a cap', () => {
    const start = levelTuning(0, 0);
    expect(start.speedPct).toBe(100);
    for (let correct = 1; correct <= 15; correct++) {
      expect(levelTuning(correct, correct).speed).toBeGreaterThan(levelTuning(correct - 1, correct - 1).speed);
    }
    expect(levelTuning(17, 17).speed).toBeLessThan(MAX_SPEED);
    expect(levelTuning(18, 18).speed).toBe(MAX_SPEED);
    expect(levelTuning(40, 40).speed).toBe(MAX_SPEED);
    expect(levelTuning(1, 1).speed).toBe(start.speed + SPEED_PER_CORRECT);
  });

  it('a wrong answer does not slow the barriers down, nor speed them up', () => {
    expect(levelTuning(3, 3).speed).toBe(levelTuning(10, 3).speed);
    expect(levelTuning(5, 0).speed).toBe(levelTuning(0, 0).speed);
  });

  it('the opening narrows every 5 questions answered, within a floor', () => {
    const start = levelTuning(0, 0);
    expect(levelTuning(4, 0).gap).toBe(start.gap);
    expect(levelTuning(5, 0).gap).toBeLessThan(start.gap);
    expect(levelTuning(500, 0).gap).toBe(levelTuning(30, 0).gap);
    expect(levelTuning(500, 0).gap).toBeGreaterThanOrEqual(150);
  });
});
