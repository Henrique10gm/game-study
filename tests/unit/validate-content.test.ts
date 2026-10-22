// Unit tests for the question-bank validator. All content here is fictional.
import { describe, expect, it } from 'vitest';
import { findPersonalDataPatterns, validateQuestionBank } from '../../src/engine/content/validateContent';
import type { QuestionContent } from '../../src/engine/content/types';
import { makeFixtureScene } from '../fixtures/fixtureContent';

function mutate(num: number, change: (q: QuestionContent) => void): QuestionContent {
  const q = structuredClone(makeFixtureScene(num));
  change(q);
  return q;
}

describe('validateQuestionBank', () => {
  it('accepts a clean bank', () => {
    expect(validateQuestionBank([makeFixtureScene(1), makeFixtureScene(2)])).toEqual([]);
  });

  it('rejects duplicate ids', () => {
    const errors = validateQuestionBank([makeFixtureScene(1), makeFixtureScene(1)]);
    expect(errors.some((e) => e.includes('duplicate sceneId'))).toBe(true);
  });

  it('rejects an unknown or missing category', () => {
    const unknown = mutate(1, (q) => {
      q.categories = ['nada' as never];
    });
    const empty = mutate(2, (q) => {
      q.categories = [];
    });
    expect(validateQuestionBank([unknown], ['sfn']).some((e) => e.includes('unknown category'))).toBe(true);
    expect(validateQuestionBank([unknown])).toEqual([]); // without the room's list any category passes
    expect(validateQuestionBank([empty]).some((e) => e.includes('at least one category'))).toBe(true);
  });

  it('accepts every category used by the training modes', () => {
    const q = mutate(1, (x) => {
      x.categories = ['sfn', 'cambio-pld', 'limites', 'punicoes'];
    });
    expect(validateQuestionBank([q], ['sfn', 'cambio-pld', 'limites', 'punicoes'])).toEqual([]);
  });

  it('requires exactly one correct choice', () => {
    const none = mutate(1, (q) => q.choices.forEach((c) => (c.correct = false)));
    const two = mutate(2, (q) => q.choices.forEach((c) => (c.correct = true)));
    expect(validateQuestionBank([none]).some((e) => e.includes('exactly one choice'))).toBe(true);
    expect(validateQuestionBank([two]).some((e) => e.includes('exactly one choice'))).toBe(true);
  });

  it('requires 2 to 4 choices and distinct feedback', () => {
    const one = mutate(1, (q) => {
      q.choices = q.choices.slice(0, 1);
    });
    const same = mutate(2, (q) => q.choices.forEach((c) => (c.feedback = 'igual')));
    expect(validateQuestionBank([one]).some((e) => e.includes('between 2 and 4'))).toBe(true);
    expect(validateQuestionBank([same]).some((e) => e.includes('pairwise distinct'))).toBe(true);
  });

  it('checks topicTag, speaker format and xp', () => {
    expect(validateQuestionBank([mutate(1, (q) => (q.topicTag = 'Not Kebab'))]).length).toBeGreaterThan(0);
    expect(
      validateQuestionBank([mutate(1, (q) => (q.dialogue[0].speaker = 'Sem cargo'))]).length,
    ).toBeGreaterThan(0);
    expect(validateQuestionBank([mutate(1, (q) => (q.xpOnCorrect = 0))]).length).toBeGreaterThan(0);
  });
});

describe('findPersonalDataPatterns', () => {
  it('flags CPF, CNPJ, e-mail and phone patterns', () => {
    expect(findPersonalDataPatterns('123.456.789-09')).toContain('cpf');
    expect(findPersonalDataPatterns('12.345.678/0001-90')).toContain('cnpj');
    expect(findPersonalDataPatterns('alguem@exemplo.com')).toContain('email');
    expect(findPersonalDataPatterns('(11) 91234-5678')).toContain('telefone');
  });

  it('leaves normal text alone', () => {
    expect(findPersonalDataPatterns('Limite de US$ 3.000,00 por operação')).toEqual([]);
  });
});
