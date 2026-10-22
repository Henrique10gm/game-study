// How each mission of a room selects its questions. The modes themselves (titles,
// descriptions, filters) come from the room's room.json; only the rules live here.
import type { QuestionContent, RoomMode } from './content/types';
import type { QuestionStatuses } from './progress';
import { shuffle } from './random';

export type GameMode = RoomMode;

export function getMode(modes: readonly GameMode[], id: string): GameMode | undefined {
  return modes.find((mode) => mode.id === id);
}

export function questionsForMode(
  mode: GameMode,
  all: readonly QuestionContent[],
  wrongQuestionIds: readonly string[] = [],
): QuestionContent[] {
  switch (mode.kind) {
    case 'exam':
      return all.filter((q) => q.exam === true);
    case 'wrong': {
      const wrong = new Set(wrongQuestionIds);
      return all.filter((q) => wrong.has(q.sceneId));
    }
    case 'all':
      return [...all];
    case 'category': {
      const category = mode.category;
      return category ? all.filter((q) => q.categories.includes(category)) : [];
    }
  }
}

export const SIZE_PRESETS = [5, 10, 20] as const;

export interface SizeOption {
  label: string;
  count: number; // number of questions in the run
  complete: boolean;
}

// "Fase completa" plays the whole pool; fixed sizes are offered only when
// they are smaller than the pool (otherwise they would equal the full phase).
export function sizeOptions(total: number): SizeOption[] {
  if (total <= 0) return [];
  const options: SizeOption[] = [
    { label: `Fase completa (${total} questões)`, count: total, complete: true },
  ];
  for (const preset of SIZE_PRESETS) {
    if (preset < total) {
      options.push({ label: `${preset} questões`, count: preset, complete: false });
    }
  }
  return options;
}

export function pickQuestions(
  pool: readonly QuestionContent[],
  count: number,
  random: () => number = Math.random,
  statuses: QuestionStatuses = {},
): QuestionContent[] {
  // Not-yet-mastered questions (never answered, or latest answer wrong) come
  // first so a short run can still move the player's progress; each group is shuffled.
  const open = pool.filter((q) => statuses[q.sceneId] !== true);
  const mastered = pool.filter((q) => statuses[q.sceneId] === true);
  return [...shuffle(open, random), ...shuffle(mastered, random)].slice(0, Math.max(0, count));
}
