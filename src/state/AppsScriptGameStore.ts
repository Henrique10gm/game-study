// Server store on a Google Apps Script web app (backend/Code.gs) that writes to
// a Google Sheet. If the network fails, finished games go to a local outbox and
// are sent on the next start — saving never blocks or breaks the game.
//
// Two ways to reach the script (a "transport"):
//  - scriptRunTransport: the game is served by the Apps Script web app itself and
//    calls the script with google.script.run (no CORS, uses the viewer's Google
//    session; the script then knows who is playing).
//  - fetchTransport: the game is hosted elsewhere and posts to the /exec URL.
//    The body is sent as text/plain so the browser does not make a preflight
//    request, which Apps Script cannot answer.
//
// The player key is a random id from this browser; the script only returns the
// rows of the key it ends up using (a pseudonym derived from the Google account
// when it can see one, otherwise this key). No name or e-mail is sent or stored.
import type { GameStore, SaveStatus } from './GameStore';
import { roomOf } from './records';
import type { GameRecord, GameSummary, Leaderboard, ProgressSnapshot } from './records';
import type { QuestionReport } from './reports';
import type { ScreenTimeReport } from '../engine/screenTime';

const PLAYER_KEY = 'cq.player.v1';
const OUTBOX_KEY = 'cq.outbox.v1';
const REPORT_OUTBOX_KEY = 'cq.reports.outbox.v1';
const TIMEOUT_MS = 15000;

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ScriptReply {
  ok: boolean;
  error?: string;
  games?: GameSummary[];
  statuses?: Record<string, boolean>;
  totalXp?: number;
  nickname?: string;
  available?: boolean;
  entries?: Leaderboard['entries'];
  me?: Leaderboard['me'];
  version?: number;
  unchanged?: boolean;
  empty?: boolean;
  questions?: unknown;
}

/** Sends one request body to the script and resolves with its parsed reply. */
export type Transport = (body: Record<string, unknown>) => Promise<ScriptReply>;

export function fetchTransport(
  url: string,
  fetchImpl: FetchLike = (input, init) => fetch(input, init),
): Transport {
  return async (body) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()) as ScriptReply;
    } finally {
      clearTimeout(timer);
    }
  };
}

interface GoogleScriptRun {
  withSuccessHandler(fn: (reply: string) => void): GoogleScriptRun;
  withFailureHandler(fn: (error: Error) => void): GoogleScriptRun;
  handle(request: string): void;
}

/** The google.script.run bridge, present only when served by Apps Script. */
export function googleScriptRun(): GoogleScriptRun | null {
  const run = (globalThis as { google?: { script?: { run?: GoogleScriptRun } } }).google?.script?.run;
  return run ?? null;
}

export function scriptRunTransport(run: GoogleScriptRun): Transport {
  return (body) =>
    new Promise<ScriptReply>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS);
      run
        .withSuccessHandler((reply) => {
          clearTimeout(timer);
          try {
            resolve(JSON.parse(reply) as ScriptReply);
          } catch (error) {
            reject(error);
          }
        })
        .withFailureHandler((error) => {
          clearTimeout(timer);
          reject(error);
        })
        .handle(JSON.stringify(body));
    });
}

export class AppsScriptGameStore implements GameStore {
  readonly kind = 'cloud' as const;
  private memoryKey: string | null = null;

  constructor(
    private readonly transport: Transport,
    private readonly storage: StorageLike = window.localStorage,
  ) {}

  async init(): Promise<void> {
    this.playerKey(); // create the anonymous key right away
    await this.flushOutbox();
    await this.flushReportOutbox();
  }

  private playerKey(): string {
    try {
      const saved = this.storage.getItem(PLAYER_KEY);
      if (saved) return saved;
      const created = crypto.randomUUID();
      this.storage.setItem(PLAYER_KEY, created);
      return created;
    } catch {
      this.memoryKey ??= crypto.randomUUID();
      return this.memoryKey;
    }
  }

  private async call(body: Record<string, unknown>): Promise<ScriptReply> {
    const reply = await this.transport({ ...body, playerKey: this.playerKey() });
    if (!reply.ok) throw new Error(reply.error ?? 'script error');
    return reply;
  }

  async saveGame(game: GameRecord): Promise<SaveStatus> {
    try {
      await this.call({ action: 'saveGame', game });
    } catch {
      this.enqueue(game);
      return 'queued';
    }
    await this.flushOutbox();
    return 'saved';
  }

  private readOutbox(): GameRecord[] {
    try {
      const raw = this.storage.getItem(OUTBOX_KEY);
      return raw ? (JSON.parse(raw) as GameRecord[]) : [];
    } catch {
      return [];
    }
  }

  private writeOutbox(games: GameRecord[]): void {
    try {
      this.storage.setItem(OUTBOX_KEY, JSON.stringify(games));
    } catch {
      // storage unavailable: nothing else to do
    }
  }

  private enqueue(game: GameRecord): void {
    this.writeOutbox([...this.readOutbox().filter((g) => g.id !== game.id), game]);
  }

  // The script ignores a game id it already has, so retrying is always safe.
  private async flushOutbox(): Promise<void> {
    const remaining: GameRecord[] = [];
    for (const game of this.readOutbox()) {
      try {
        await this.call({ action: 'saveGame', game });
      } catch {
        remaining.push(game);
      }
    }
    this.writeOutbox(remaining);
  }

  async listGames(roomId?: string): Promise<GameSummary[]> {
    const reply = await this.call({ action: 'listGames', roomId });
    return reply.games ?? [];
  }

  async getProgress(roomId?: string): Promise<ProgressSnapshot> {
    const reply = await this.call({ action: 'progress', roomId });
    const statuses = { ...(reply.statuses ?? {}) };
    let totalXp = reply.totalXp ?? 0;
    // Games still waiting in the outbox are newer than anything on the server.
    for (const game of this.readOutbox().filter((g) => roomId === undefined || roomOf(g) === roomId)) {
      totalXp += game.xp;
      for (const answer of game.answers) statuses[answer.questionId] = answer.correct;
    }
    return { statuses, totalXp };
  }

  async getLeaderboard(roomId?: string): Promise<Leaderboard> {
    const reply = await this.call({ action: 'leaderboard', roomId });
    return {
      available: reply.available ?? true,
      entries: reply.entries ?? [],
      me: reply.me ?? { nickname: null, rank: null },
    };
  }

  private readReportOutbox(): QuestionReport[] {
    try {
      const raw = this.storage.getItem(REPORT_OUTBOX_KEY);
      return raw ? (JSON.parse(raw) as QuestionReport[]) : [];
    } catch {
      return [];
    }
  }

  private writeReportOutbox(reports: QuestionReport[]): void {
    try {
      this.storage.setItem(REPORT_OUTBOX_KEY, JSON.stringify(reports));
    } catch {
      // storage unavailable: nothing else to do
    }
  }

  // The script ignores a report id it already has, so retrying is always safe.
  private async flushReportOutbox(): Promise<void> {
    const remaining: QuestionReport[] = [];
    for (const report of this.readReportOutbox()) {
      try {
        await this.call({ action: 'reportQuestion', report });
      } catch {
        remaining.push(report);
      }
    }
    this.writeReportOutbox(remaining);
  }

  async reportQuestion(report: QuestionReport): Promise<SaveStatus> {
    try {
      await this.call({ action: 'reportQuestion', report });
    } catch {
      this.writeReportOutbox([...this.readReportOutbox().filter((r) => r.id !== report.id), report].slice(-100));
      return 'queued';
    }
    await this.flushReportOutbox();
    return 'saved';
  }

  // Totals are cumulative and the script keeps the largest, so no outbox is needed.
  async recordScreenTime(report: ScreenTimeReport): Promise<void> {
    try {
      await this.call({ action: 'saveSession', session: report });
    } catch {
      // measuring time must never break the game
    }
  }

  async setNickname(nickname: string): Promise<string> {
    let reply: ScriptReply;
    try {
      reply = await this.call({ action: 'setNickname', nickname });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'nickname taken') throw new Error('taken');
      if (message === 'invalid nickname') throw new Error('invalid');
      throw new Error('failed');
    }
    return reply.nickname ?? nickname;
  }
}
