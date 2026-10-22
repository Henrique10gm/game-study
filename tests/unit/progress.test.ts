import { describe, expect, it } from 'vitest';
import {
  applyAnswers,
  levelFor,
  masteryOf,
  nextStage,
  questionsToReach,
  runProgress,
  stageFor,
  wrongIdsOf,
} from '../../src/engine/progress';

const bank = Array.from({ length: 10 }, (_, i) => ({ sceneId: `q${i + 1}` }));
const answer = (questionId: string, correct: boolean, n = 0) => ({
  questionId,
  chosenChoiceId: 'a',
  correct,
  answeredAt: `2026-01-01T10:00:0${n}.000Z`,
});

describe('mastery and stages', () => {
  it('counts only questions whose latest answer was correct', () => {
    const m = masteryOf(bank, { q1: true, q2: false, q3: true, gone: true });
    expect(m).toEqual({ mastered: 2, total: 10, pct: 20 });
  });

  it('rounds the percentage down and handles an empty bank', () => {
    expect(masteryOf(bank, Object.fromEntries(bank.slice(0, 9).map((q) => [q.sceneId, true]))).pct).toBe(90);
    expect(masteryOf([], {}).pct).toBe(0);
  });

  it('moves through stages and ends at "Pronto para a prova"', () => {
    expect(stageFor(0).name).toBe('Primeiro dia');
    expect(stageFor(19).index).toBe(0);
    expect(stageFor(20).name).toBe('Pegando o jeito');
    expect(stageFor(79).name).toBe('Reta final');
    expect(stageFor(80).name).toBe('Pronto para a prova');
    expect(nextStage(79)?.name).toBe('Pronto para a prova');
    expect(nextStage(100)).toBeNull();
  });

  it('says how many questions are missing for a target', () => {
    const m = masteryOf(bank, { q1: true, q2: true, q3: true });
    expect(questionsToReach(40, m)).toBe(1);
    expect(questionsToReach(20, m)).toBe(0);
  });
});

describe('levels', () => {
  it('level 1 starts at 0 XP and each level costs more than the last', () => {
    expect(levelFor(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForNext: 100 });
    expect(levelFor(99).level).toBe(1);
    expect(levelFor(100)).toEqual({ level: 2, xpIntoLevel: 0, xpForNext: 150 });
    expect(levelFor(250)).toEqual({ level: 3, xpIntoLevel: 0, xpForNext: 200 });
  });

  it('ignores negative XP', () => {
    expect(levelFor(-5).level).toBe(1);
  });
});

describe('answers and run progress', () => {
  it('applies answers oldest to newest and lists the wrong ones', () => {
    const next = applyAnswers({ q1: false, q2: true }, [answer('q1', true, 1), answer('q2', false, 2), answer('q3', false, 3)]);
    expect(next).toEqual({ q1: true, q2: false, q3: false });
    expect(wrongIdsOf(next).sort()).toEqual(['q2', 'q3']);
  });

  it('reports what a run changed, including a stage and a level up', () => {
    const progress = runProgress({
      bank,
      statusesBefore: { q1: true },
      answers: [answer('q2', true, 1), answer('q3', true, 2), answer('q4', false, 3)],
      xpBefore: 90,
      xpGained: 20,
    });
    expect(progress.before.mastered).toBe(1);
    expect(progress.after.mastered).toBe(3);
    expect(progress.masteredDelta).toBe(2);
    expect(progress.after.stage.name).toBe('Pegando o jeito');
    expect(progress.stageUp).toBe(true); // 10% -> 30%
    expect(progress.levelUp).toBe(true); // 90 -> 110 XP
    expect(progress.toNextStage).toEqual({ name: 'Já tem crachá', questions: 1 });
  });

  it('a question that turns wrong lowers the count', () => {
    const progress = runProgress({
      bank,
      statusesBefore: { q1: true },
      answers: [answer('q1', false)],
      xpBefore: 0,
      xpGained: 0,
    });
    expect(progress.masteredDelta).toBe(-1);
    expect(progress.stageUp).toBe(false);
  });
});
