// Every bundled question of every room, flattened (ENG-03 — the engine never
// hardcodes question text; the rooms loader is the only content-shaped literal
// allowed). Used by the content gates; the game itself reads one room at a time
// (see rooms.ts). Bundled via import.meta.glob eager — no runtime fetch, works
// offline/under preview.
import { ROOMS } from './rooms';
import type { ContentSource, QuestionContent } from './types';

const questions: QuestionContent[] = ROOMS.flatMap((room) => room.questions);
const questionById = new Map(questions.map((q) => [q.sceneId, q]));

export const contentRegistry: ContentSource = {
  listQuestions(): QuestionContent[] {
    return questions;
  },
  getQuestion(id: string): QuestionContent | undefined {
    return questionById.get(id);
  },
};
