// Pure evaluation of a player's choice against question content. No content
// strings live here — every piece of text returned comes from the question
// passed in by the caller.
import type { QuestionContent } from '../content/types';

export interface DecisionOutcome {
  sceneId: string;
  topicTag: string;
  chosenChoiceId: string;
  correctChoiceId: string;
  correct: boolean;
  xpEarned: number;
  feedbackText: string; // the chosen choice's feedback
  timedOut?: boolean; // Contra o tempo: the time ran out
}

/** The id recorded when time runs out (it fits the 1-8 character choice ids of the backend). */
export const TIMEOUT_CHOICE_ID = 'tempo';

export function evaluateDecision(scene: QuestionContent, chosenChoiceId: string): DecisionOutcome {
  const correctChoice = scene.choices.find((choice) => choice.correct);
  if (!correctChoice) {
    throw new Error(`Scene "${scene.sceneId}" has no choice marked correct`);
  }

  const chosenChoice = scene.choices.find((choice) => choice.id === chosenChoiceId);
  if (!chosenChoice) {
    throw new Error(`Unknown choice id "${chosenChoiceId}" for scene "${scene.sceneId}"`);
  }

  const correct = chosenChoice === correctChoice;

  return {
    sceneId: scene.sceneId,
    topicTag: scene.topicTag,
    chosenChoiceId,
    correctChoiceId: correctChoice.id,
    correct,
    xpEarned: correct ? scene.xpOnCorrect : 0,
    feedbackText: chosenChoice.feedback,
  };
}

/** Time ran out: counts as a wrong answer, no XP; the feedback explains the right one. */
export function timeoutDecision(scene: QuestionContent): DecisionOutcome {
  const correctChoice = scene.choices.find((choice) => choice.correct);
  if (!correctChoice) {
    throw new Error(`Scene "${scene.sceneId}" has no choice marked correct`);
  }
  return {
    sceneId: scene.sceneId,
    topicTag: scene.topicTag,
    chosenChoiceId: TIMEOUT_CHOICE_ID,
    correctChoiceId: correctChoice.id,
    correct: false,
    xpEarned: 0,
    feedbackText: correctChoice.feedback,
    timedOut: true,
  };
}
