// Persistence contract. Two implementations: LocalGameStore (localStorage,
// works offline and with no backend) and AppsScriptGameStore (Google Apps
// Script + Sheet, per-player rows keyed by an anonymous browser key).
import type { GameRecord, GameSummary, Leaderboard, ProgressSnapshot } from './records';
import type { QuestionReport } from './reports';
import type { ScreenTimeReport } from '../engine/screenTime';

export type SaveStatus = 'saved' | 'queued';

export interface GameStore {
  readonly kind: 'local' | 'cloud';
  init(): Promise<void>;
  saveGame(game: GameRecord): Promise<SaveStatus>;
  // `roomId` narrows the answer to one room of the hall (omitted = every room).
  listGames(roomId?: string): Promise<GameSummary[]>; // newest first
  getProgress(roomId?: string): Promise<ProgressSnapshot>; // latest result per question + total XP
  getLeaderboard(roomId?: string): Promise<Leaderboard>; // the Hall da Fama of that room
  /** Sets the name shown in the ranking. Rejects with a NicknameProblem message. */
  setNickname(nickname: string): Promise<string>;
  /** Sends a report about a question. Cloud: aba Reports (queued offline). Local: kept in this browser. */
  reportQuestion(report: QuestionReport): Promise<SaveStatus>;
  /** Cumulative screen time of this session (aba Sessions, cloud only; local ignores it). Best effort, never throws. */
  recordScreenTime(report: ScreenTimeReport): Promise<void>;
}
