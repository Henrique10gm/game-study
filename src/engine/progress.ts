// How the player's progress is measured. Pure functions, no Phaser, no DOM.
//
//  - A question is "dominada" when the player's LATEST answer to it was correct
//    (the same rule behind the "questões que errei" mode).
//  - Prontidão = share of the whole question bank that is dominada. It moves
//    through stages; the last one means the player is at exam level.
//  - Nível comes from the XP accumulated over all games.
import type { AnswerRecord, ProgressSnapshot } from '../state/records';

export type { ProgressSnapshot };

/** questionId -> was the latest answer correct? */
export type QuestionStatuses = Record<string, boolean>;

export interface Mastery {
  mastered: number;
  total: number;
  pct: number; // 0..100, rounded down so "100%" only appears when truly complete
}

export function masteryOf(
  questions: readonly { sceneId: string }[],
  statuses: QuestionStatuses,
): Mastery {
  const total = questions.length;
  const mastered = questions.filter((q) => statuses[q.sceneId] === true).length;
  return { mastered, total, pct: total === 0 ? 0 : Math.floor((mastered / total) * 100) };
}

export interface Stage {
  index: number;
  name: string;
  min: number; // readiness % where the stage begins
}

/** Readiness at which the player is considered ready for the exam. */
export const READY_PCT = 80;

export const STAGES: readonly Stage[] = [
  { index: 0, name: 'Primeiro dia', min: 0 },
  { index: 1, name: 'Pegando o jeito', min: 20 },
  { index: 2, name: 'Já tem crachá', min: 40 },
  { index: 3, name: 'Reta final', min: 60 },
  { index: 4, name: 'Pronto para a prova', min: READY_PCT },
];

export function stageFor(pct: number): Stage {
  let current = STAGES[0];
  for (const stage of STAGES) if (pct >= stage.min) current = stage;
  return current;
}

export function nextStage(pct: number): Stage | null {
  return STAGES.find((stage) => stage.min > pct) ?? null;
}

/** Questions still to master to reach `targetPct` of the bank (0 when already there). */
export function questionsToReach(targetPct: number, mastery: Mastery): number {
  const needed = Math.ceil((targetPct / 100) * mastery.total);
  return Math.max(0, needed - mastery.mastered);
}

export interface LevelInfo {
  level: number;
  xpIntoLevel: number;
  xpForNext: number; // size of the current level
}

const BASE_LEVEL_XP = 100;
const EXTRA_PER_LEVEL = 50;

/** Level n -> n+1 costs 100 + 50 * (n - 1) XP, so early levels come quickly. */
export function levelFor(totalXp: number): LevelInfo {
  let level = 1;
  let left = Math.max(0, Math.floor(totalXp));
  let size = BASE_LEVEL_XP;
  while (left >= size) {
    left -= size;
    level += 1;
    size = BASE_LEVEL_XP + EXTRA_PER_LEVEL * (level - 1);
  }
  return { level, xpIntoLevel: left, xpForNext: size };
}

/** Statuses after applying `answers` (oldest -> newest) on top of `base`. */
export function applyAnswers(base: QuestionStatuses, answers: readonly AnswerRecord[]): QuestionStatuses {
  const next: QuestionStatuses = { ...base };
  for (const answer of answers) next[answer.questionId] = answer.correct;
  return next;
}

export function wrongIdsOf(statuses: QuestionStatuses): string[] {
  return Object.entries(statuses)
    .filter(([, correct]) => !correct)
    .map(([id]) => id);
}

/** What changed because of one run: shown on the end-of-run screen. */
export interface RunProgress {
  before: { pct: number; mastered: number; stage: Stage; level: number };
  after: { pct: number; mastered: number; stage: Stage; level: number };
  total: number;
  masteredDelta: number;
  stageUp: boolean;
  levelUp: boolean;
  xpIntoLevel: number;
  xpForNext: number;
  toNextStage: { name: string; questions: number } | null;
}

export function runProgress(args: {
  bank: readonly { sceneId: string }[];
  statusesBefore: QuestionStatuses;
  answers: readonly AnswerRecord[];
  xpBefore: number;
  xpGained: number;
}): RunProgress {
  const { bank, statusesBefore, answers, xpBefore, xpGained } = args;
  const statusesAfter = applyAnswers(statusesBefore, answers);
  const m0 = masteryOf(bank, statusesBefore);
  const m1 = masteryOf(bank, statusesAfter);
  const l0 = levelFor(xpBefore);
  const l1 = levelFor(xpBefore + xpGained);
  const s0 = stageFor(m0.pct);
  const s1 = stageFor(m1.pct);
  const upcoming = nextStage(m1.pct);
  return {
    before: { pct: m0.pct, mastered: m0.mastered, stage: s0, level: l0.level },
    after: { pct: m1.pct, mastered: m1.mastered, stage: s1, level: l1.level },
    total: m1.total,
    masteredDelta: m1.mastered - m0.mastered,
    stageUp: s1.index > s0.index,
    levelUp: l1.level > l0.level,
    xpIntoLevel: l1.xpIntoLevel,
    xpForNext: l1.xpForNext,
    toNextStage: upcoming ? { name: upcoming.name, questions: questionsToReach(upcoming.min, m1) } : null,
  };
}

/** One line about what is missing for the next stage (or the exam level). */
export function goalText(toNextStage: { name: string; questions: number } | null): string {
  if (!toNextStage) return 'Você está no nível de prova. Continue revisando as questões que errou.';
  const n = toNextStage.questions;
  const missing = n === 1 ? 'Falta 1 questão' : `Faltam ${n} questões`;
  return `${missing} para ${toNextStage.name}.`;
}

/** Same, from the bank mastery (used by the menu before any run). */
export function goalFor(mastery: Mastery): string {
  const upcoming = nextStage(mastery.pct);
  return goalText(upcoming ? { name: upcoming.name, questions: questionsToReach(upcoming.min, mastery) } : null);
}
