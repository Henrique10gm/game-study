// Records saved for every game (a "game" = one run from start to finish,
// game over or abandon). Local and cloud stores share these shapes.
export type RunResult = 'completed' | 'gameover' | 'abandoned';

export interface AnswerRecord {
  questionId: string;
  chosenChoiceId: string;
  correct: boolean;
  answeredAt: string; // ISO timestamp
}

/** Games saved before the hall existed have no roomId: they belong to the Compliance room. */
export const DEFAULT_ROOM_ID = 'compliance';

export function roomOf(game: { roomId?: string }): string {
  return game.roomId ?? DEFAULT_ROOM_ID;
}

export interface GameRecord {
  id: string;
  roomId?: string; // the room the game was played in (missing = Compliance)
  modeId: string;
  style?: 'obstaculos' | 'tempo' | 'corrida' | 'pacman'; // missing on old games = obstaculos
  requestedCount: number;
  answeredCount: number;
  correctCount: number;
  xp: number;
  result: RunResult;
  startedAt: string; // ISO timestamp
  endedAt: string; // ISO timestamp
  answers: AnswerRecord[];
}

export type GameSummary = Omit<GameRecord, 'answers'>;

export interface PlayerStats {
  gamesPlayed: number;
  totalXp: number;
}

export function computeStats(games: readonly GameSummary[]): PlayerStats {
  return {
    gamesPlayed: games.length,
    totalXp: games.reduce((sum, game) => sum + game.xp, 0),
  };
}

export function toSummary(game: GameRecord): GameSummary {
  const { answers: _answers, ...summary } = game;
  void _answers;
  return summary;
}

// Latest attempt per question wins: a question stays "wrong" until it is
// answered correctly later. `answers` must be ordered oldest -> newest.
export function latestStatuses(answers: readonly AnswerRecord[]): Record<string, boolean> {
  const latest: Record<string, boolean> = {};
  for (const answer of answers) latest[answer.questionId] = answer.correct;
  return latest;
}

/** The player's standing: latest result per question and XP over all games. */
export interface ProgressSnapshot {
  statuses: Record<string, boolean>;
  totalXp: number;
}

export interface LeaderboardEntry {
  rank: number;
  nickname: string;
  mastered: number; // questions whose latest answer is correct
  xp: number;
  games: number;
  me: boolean;
}

export interface Leaderboard {
  /** false when the game has no server (nothing to compare with). */
  available: boolean;
  entries: LeaderboardEntry[];
  /** rank/total: your place among the listed players (where you would be, if you have no nickname). */
  me: { nickname: string | null; rank: number | null; total?: number };
}

export type NicknameProblem = 'invalid' | 'taken' | 'unavailable' | 'failed';
