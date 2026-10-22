// localStorage-backed store: no network, progress lives in this browser only.
import type { GameStore, SaveStatus } from './GameStore';
import { latestStatuses, roomOf, toSummary } from './records';
import type { AnswerRecord, GameRecord, GameSummary, Leaderboard, ProgressSnapshot } from './records';
import type { QuestionReport } from './reports';

const KEY = 'cq.games.v1';
const MAX_GAMES = 500;
const REPORTS_KEY = 'cq.reports.v1';
const MAX_REPORTS = 100;

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export class LocalGameStore implements GameStore {
  readonly kind = 'local' as const;

  constructor(private readonly storage: StorageLike = window.localStorage) {}

  async init(): Promise<void> {}

  private read(): GameRecord[] {
    try {
      const raw = this.storage.getItem(KEY);
      return raw ? (JSON.parse(raw) as GameRecord[]) : [];
    } catch {
      return [];
    }
  }

  async saveGame(game: GameRecord): Promise<SaveStatus> {
    const games = this.read();
    games.push(game);
    try {
      this.storage.setItem(KEY, JSON.stringify(games.slice(-MAX_GAMES)));
    } catch {
      // storage full or blocked: the game itself must never break
    }
    return 'saved';
  }

  private readRoom(roomId?: string): GameRecord[] {
    const games = this.read();
    return roomId === undefined ? games : games.filter((game) => roomOf(game) === roomId);
  }

  async listGames(roomId?: string): Promise<GameSummary[]> {
    return this.readRoom(roomId)
      .map(toSummary)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async getProgress(roomId?: string): Promise<ProgressSnapshot> {
    const games = this.readRoom(roomId).sort((a, b) => a.endedAt.localeCompare(b.endedAt));
    const answers: AnswerRecord[] = games.flatMap((game) => game.answers);
    return {
      statuses: latestStatuses(answers),
      totalXp: games.reduce((sum, game) => sum + game.xp, 0),
    };
  }

  // Comparing with colleagues needs the server; this store keeps only this browser's data.
  async getLeaderboard(): Promise<Leaderboard> {
    return { available: false, entries: [], me: { nickname: null, rank: null } };
  }

  async setNickname(): Promise<string> {
    throw new Error('unavailable');
  }

  // No server to receive it: nothing to record.
  async recordScreenTime(): Promise<void> {}

  // No server to receive it: the report stays in this browser ('queued').
  async reportQuestion(report: QuestionReport): Promise<SaveStatus> {
    try {
      const raw = this.storage.getItem(REPORTS_KEY);
      const saved = raw ? (JSON.parse(raw) as QuestionReport[]) : [];
      this.storage.setItem(REPORTS_KEY, JSON.stringify([...saved, report].slice(-MAX_REPORTS)));
    } catch {
      // storage full or blocked: reporting must never break the game
    }
    return 'queued';
  }
}
