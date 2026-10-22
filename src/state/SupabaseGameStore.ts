// Cloud store on Supabase (Postgres + RLS). Every write goes through a SECURITY
// DEFINER function that checks the input and uses the signed-in user (auth.uid());
// reads only return the player's own rows. If the network fails, finished games
// and reports go to a local outbox and are sent on the next start: saving never
// blocks or breaks the game. Retrying is always safe (games.id and reports.id
// are client UUIDs and the server ignores one it already has).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GameStore, SaveStatus } from './GameStore';
import { roomOf } from './records';
import type { GameRecord, GameSummary, Leaderboard, ProgressSnapshot, RunResult } from './records';
import type { QuestionReport } from './reports';
import type { ScreenTimeReport } from '../engine/screenTime';

// Keys are per user (suffix) so two accounts sharing a browser never mix their queues.
const OUTBOX_KEY = 'qh.outbox.v1';
const REPORT_OUTBOX_KEY = 'qh.reports.outbox.v1';
const ACTIVE_GROUP_KEY = 'qh.activeGroup.v1';
const MAX_LISTED_GAMES = 200;
const MAX_QUEUED_REPORTS = 100;

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

interface DbError {
  code?: string;
  message?: string;
}

/**
 * The server looked at the request and said no (bad data, limit reached): retrying
 * the same payload can never work, so it is dropped instead of queued forever.
 * Network failures and auth problems have no such code and are retried.
 */
function isPermanent(error: DbError): boolean {
  return /^(22|23|54)/.test(error.code ?? '') && error.code !== '23505';
}

interface GameRow {
  id: string;
  room_id: string;
  mode_id: string;
  style: GameSummary['style'];
  requested_count: number;
  answered_count: number;
  correct_count: number;
  xp: number;
  result: RunResult;
  started_at: string;
  ended_at: string;
}

interface LeaderboardRow {
  rank: number;
  nickname: string;
  mastered: number;
  xp: number;
  games: number;
  me: boolean;
}

export class SupabaseGameStore implements GameStore {
  readonly kind = 'cloud' as const;
  private activeGroupId: string | null = null;

  constructor(
    private readonly client: SupabaseClient,
    private readonly userId: string,
    private readonly storage: StorageLike = window.localStorage,
  ) {
    try {
      this.activeGroupId = storage.getItem(this.key(ACTIVE_GROUP_KEY));
    } catch {
      this.activeGroupId = null;
    }
  }

  async init(): Promise<void> {
    await this.flushOutbox();
    await this.flushReportOutbox();
  }

  /** The group the ranking is read from (null = no ranking yet). Kept across visits. */
  setActiveGroup(groupId: string | null): void {
    this.activeGroupId = groupId;
    try {
      this.storage.setItem(this.key(ACTIVE_GROUP_KEY), groupId ?? '');
    } catch {
      // storage unavailable: the choice lasts until the page closes
    }
  }

  getActiveGroup(): string | null {
    return this.activeGroupId || null;
  }

  // ----------------------------------------------------------------- games
  async saveGame(game: GameRecord): Promise<SaveStatus> {
    if (!(await this.send(game))) {
      this.writeOutbox([...this.readOutbox().filter((g) => g.id !== game.id), game]);
      return 'queued';
    }
    await this.flushOutbox();
    return 'saved';
  }

  /** true = the server has it (saved, already there, or refused for good); false = try again later. */
  private async send(game: GameRecord): Promise<boolean> {
    try {
      const { error } = await this.client.rpc('save_game', { p_game: game });
      return !error || isPermanent(error);
    } catch {
      return false;
    }
  }

  private readOutbox(): GameRecord[] {
    return this.readJson<GameRecord[]>(OUTBOX_KEY, []);
  }

  private writeOutbox(games: GameRecord[]): void {
    this.writeJson(OUTBOX_KEY, games);
  }

  private async flushOutbox(): Promise<void> {
    const remaining: GameRecord[] = [];
    for (const game of this.readOutbox()) {
      if (!(await this.send(game))) remaining.push(game);
    }
    this.writeOutbox(remaining);
  }

  async listGames(roomId?: string): Promise<GameSummary[]> {
    let query = this.client
      .from('games')
      .select('id, room_id, mode_id, style, requested_count, answered_count, correct_count, xp, result, started_at, ended_at')
      .order('ended_at', { ascending: false })
      .limit(MAX_LISTED_GAMES);
    if (roomId !== undefined) query = query.eq('room_id', roomId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return ((data ?? []) as GameRow[]).map((row) => ({
      id: row.id,
      roomId: row.room_id,
      modeId: row.mode_id,
      style: row.style,
      requestedCount: row.requested_count,
      answeredCount: row.answered_count,
      correctCount: row.correct_count,
      xp: row.xp,
      result: row.result,
      startedAt: row.started_at,
      endedAt: row.ended_at,
    }));
  }

  async getProgress(roomId?: string): Promise<ProgressSnapshot> {
    const { data, error } = await this.client.rpc('my_progress', { p_room_id: roomId ?? null });
    if (error) throw new Error(error.message);
    const reply = data as { statuses?: Record<string, boolean>; totalXp?: number } | null;
    const statuses = { ...(reply?.statuses ?? {}) };
    let totalXp = reply?.totalXp ?? 0;
    // Games still waiting in the outbox are newer than anything on the server.
    for (const game of this.readOutbox().filter((g) => roomId === undefined || roomOf(g) === roomId)) {
      totalXp += game.xp;
      for (const answer of game.answers) statuses[answer.questionId] = answer.correct;
    }
    return { statuses, totalXp };
  }

  // --------------------------------------------------------------- ranking
  async getLeaderboard(roomId?: string): Promise<Leaderboard> {
    const groupId = this.getActiveGroup();
    if (!groupId) return { available: false, entries: [], me: { nickname: null, rank: null } };

    const { data, error } = await this.client.rpc('leaderboard', {
      p_group_id: groupId,
      p_room_id: roomId ?? 'compliance',
    });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as LeaderboardRow[];
    const entries = rows.map((row) => ({
      rank: Number(row.rank),
      nickname: row.nickname,
      mastered: Number(row.mastered),
      xp: Number(row.xp),
      games: Number(row.games),
      me: row.me,
    }));
    const mine = entries.find((entry) => entry.me);
    return {
      available: true,
      entries,
      me: { nickname: mine?.nickname ?? (await this.ownNickname()), rank: mine?.rank ?? null, total: entries.length },
    };
  }

  private async ownNickname(): Promise<string | null> {
    const { data } = await this.client.from('profiles').select('nickname').maybeSingle();
    return (data as { nickname: string | null } | null)?.nickname ?? null;
  }

  async setNickname(nickname: string): Promise<string> {
    const { data, error } = await this.client.rpc('set_nickname', { p_nickname: nickname });
    if (error) {
      if (/taken/.test(error.message)) throw new Error('taken');
      if (/invalid/.test(error.message)) throw new Error('invalid');
      throw new Error('failed');
    }
    return (data as string | null) ?? nickname;
  }

  // --------------------------------------------------------------- reports
  async reportQuestion(report: QuestionReport): Promise<SaveStatus> {
    if (!(await this.sendReport(report))) {
      this.writeJson(
        REPORT_OUTBOX_KEY,
        [...this.readJson<QuestionReport[]>(REPORT_OUTBOX_KEY, []).filter((r) => r.id !== report.id), report].slice(
          -MAX_QUEUED_REPORTS,
        ),
      );
      return 'queued';
    }
    await this.flushReportOutbox();
    return 'saved';
  }

  private async sendReport(report: QuestionReport): Promise<boolean> {
    try {
      const { error } = await this.client.from('reports').insert({
        id: report.id,
        question_id: report.questionId,
        room_id: report.roomId ?? 'compliance',
        reason: report.reason,
        comment: report.comment,
        chosen_choice_id: report.chosenChoiceId,
        correct_choice_id: report.correctChoiceId,
        created_at: report.createdAt,
      });
      // 23505: the server already has this report id (a retry): nothing left to do.
      return !error || error.code === '23505' || isPermanent(error);
    } catch {
      return false;
    }
  }

  private async flushReportOutbox(): Promise<void> {
    const remaining: QuestionReport[] = [];
    for (const report of this.readJson<QuestionReport[]>(REPORT_OUTBOX_KEY, [])) {
      if (!(await this.sendReport(report))) remaining.push(report);
    }
    this.writeJson(REPORT_OUTBOX_KEY, remaining);
  }

  // ----------------------------------------------------------- screen time
  // Totals are cumulative and the server keeps the largest, so no outbox is needed.
  async recordScreenTime(report: ScreenTimeReport): Promise<void> {
    try {
      const rows = Object.entries(report.seconds).map(([room, seconds]) => ({
        session_id: report.sessionId,
        room_id: room,
        started_at: report.startedAt,
        active_seconds: Math.min(Math.round(seconds), 86400),
      }));
      if (rows.length === 0) return;
      await this.client.from('sessions').upsert(rows, { onConflict: 'session_id,room_id' });
    } catch {
      // measuring time must never break the game
    }
  }

  // --------------------------------------------------------------- storage
  private key(base: string): string {
    return `${base}.${this.userId}`;
  }

  private readJson<T>(key: string, fallback: T): T {
    try {
      const raw = this.storage.getItem(this.key(key));
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  private writeJson(key: string, value: unknown): void {
    try {
      this.storage.setItem(this.key(key), JSON.stringify(value));
    } catch {
      // storage unavailable: nothing else to do
    }
  }
}
