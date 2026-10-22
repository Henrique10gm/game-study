import { describe, expect, it } from 'vitest';
import { evaluateDecision } from '../../src/engine/systems/ScoringSystem';
import { makeFixtureScene } from '../fixtures/fixtureContent';

const scene = makeFixtureScene(1); // choice "a" correct, "b" wrong
const correctChoice = scene.choices.find((choice) => choice.correct)!;
const wrongChoice = scene.choices.find((choice) => !choice.correct)!;

describe('evaluateDecision', () => {
  it("scores a correct choice: full XP and that choice's own feedback", () => {
    const outcome = evaluateDecision(scene, correctChoice.id);

    expect(outcome.correct).toBe(true);
    expect(outcome.xpEarned).toBe(scene.xpOnCorrect);
    expect(outcome.feedbackText).toBe(correctChoice.feedback);
    expect(outcome.correctChoiceId).toBe(correctChoice.id);
    expect(outcome.chosenChoiceId).toBe(correctChoice.id);
  });

  it("scores a wrong choice: no XP, the wrong choice's own feedback, correct id still reported", () => {
    const outcome = evaluateDecision(scene, wrongChoice.id);

    expect(outcome.correct).toBe(false);
    expect(outcome.xpEarned).toBe(0);
    expect(outcome.feedbackText).toBe(wrongChoice.feedback);
    expect(outcome.chosenChoiceId).toBe(wrongChoice.id);
    expect(outcome.correctChoiceId).toBe(correctChoice.id);
  });

  it('carries question and topic ids into the outcome', () => {
    const outcome = evaluateDecision(scene, correctChoice.id);

    expect(outcome.sceneId).toBe(scene.sceneId);
    expect(outcome.topicTag).toBe(scene.topicTag);
  });

  it('throws on a choice id that is not in the question', () => {
    expect(() => evaluateDecision(scene, 'does-not-exist')).toThrow(/Unknown choice id/);
  });

  it('throws when a question has no correct choice', () => {
    const broken = { ...scene, choices: scene.choices.map((c) => ({ ...c, correct: false })) };
    expect(() => evaluateDecision(broken, 'a')).toThrow(/no choice marked correct/);
  });
});
