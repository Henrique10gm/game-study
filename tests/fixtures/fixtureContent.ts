// Fictional test-only content. No real exam material, no real personal data.
import type { Category, ContentSource, QuestionContent } from '../../src/engine/content/types';
import type { GameStore, SaveStatus } from '../../src/state/GameStore';
import type { QuestionReport } from '../../src/state/reports';
import { latestStatuses, toSummary } from '../../src/state/records';
import type { AnswerRecord, GameRecord, GameSummary, Leaderboard, ProgressSnapshot } from '../../src/state/records';

export function makeFixtureScene(
  num: number,
  opts: { categories?: Category[]; exam?: boolean; correctIndex?: number; choiceCount?: number } = {},
): QuestionContent {
  const choiceCount = opts.choiceCount ?? 2;
  const correctIndex = opts.correctIndex ?? 0;
  const idStr = String(num).padStart(2, '0');
  return {
    sceneId: `fixture-${idStr}`,
    categories: opts.categories ?? ['sfn'],
    ...(opts.exam ? { exam: true } : {}),
    topicTag: `topico-teste-${idStr}`,
    dialogue: [
      {
        speaker: `Pessoa Fictícia ${num} — Cargo de Teste`,
        text: `Este é um cenário de teste ${num}, sem relação com conteúdo real da prova.`,
      },
    ],
    question: `Qual é a resposta correta neste cenário fictício ${num}?`,
    choices: Array.from({ length: choiceCount }, (_, i) => ({
      id: String.fromCharCode(97 + i),
      text: `Alternativa ${i === correctIndex ? 'correta' : 'errada'} ${i} do cenário ${num}`,
      correct: i === correctIndex,
      feedback: `Feedback ${i === correctIndex ? 'de acerto' : 'de erro'} da alternativa ${i} do cenário ${num}.`,
    })),
    xpOnCorrect: 10,
  };
}

export function makeFixtureBank(count: number, categories: Category[] = ['sfn']): QuestionContent[] {
  return Array.from({ length: count }, (_, i) => makeFixtureScene(i + 1, { categories }));
}

export function makeFixtureContent(questions: QuestionContent[]): ContentSource {
  return {
    listQuestions: () => questions,
    getQuestion: (id) => questions.find((q) => q.sceneId === id),
  };
}

// In-memory GameStore for tests.
export class MemoryGameStore implements GameStore {
  readonly kind = 'local' as const;
  games: GameRecord[] = [];
  failNext = false;
  reports: QuestionReport[] = [];

  async init(): Promise<void> {}

  async saveGame(game: GameRecord): Promise<SaveStatus> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('boom');
    }
    this.games.push(game);
    return 'saved';
  }

  async reportQuestion(report: QuestionReport): Promise<SaveStatus> {
    this.reports.push(report);
    return 'saved';
  }

  async recordScreenTime(): Promise<void> {}

  async listGames(): Promise<GameSummary[]> {
    return this.games.map(toSummary).reverse();
  }

  async getProgress(): Promise<ProgressSnapshot> {
    const answers: AnswerRecord[] = this.games.flatMap((g) => g.answers);
    return { statuses: latestStatuses(answers), totalXp: this.games.reduce((sum, g) => sum + g.xp, 0) };
  }

  nickname: string | null = null;

  async getLeaderboard(): Promise<Leaderboard> {
    return { available: true, entries: [], me: { nickname: this.nickname, rank: null } };
  }

  async setNickname(nickname: string): Promise<string> {
    this.nickname = nickname;
    return nickname;
  }
}
