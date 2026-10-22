// Contra o tempo: how long a question gives you. The time grows with how much
// there is to read (the setup dialogue, the question and every choice), so a long
// regulatory text is not a reading race. Pure functions, no DOM.
import type { QuestionContent } from './content/types';

export const MIN_SECONDS = 20;
export const MAX_SECONDS = 90;
const BASE_SECONDS = 8;
const SECONDS_PER_WORD = 0.3;

function words(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

export function questionWordCount(question: QuestionContent): number {
  return (
    question.dialogue.reduce((sum, line) => sum + words(line.text), 0) +
    words(question.question) +
    question.choices.reduce((sum, choice) => sum + words(choice.text), 0)
  );
}

/** Seconds for this question: 8 s plus 0.3 s per word, between 20 s and 90 s. */
export function timeLimitSeconds(question: QuestionContent): number {
  const seconds = Math.round(BASE_SECONDS + SECONDS_PER_WORD * questionWordCount(question));
  return Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, seconds));
}
