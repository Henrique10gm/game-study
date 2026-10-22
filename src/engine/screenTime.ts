// Screen time: seconds of real play per room, counted only while the tab is
// visible, focused and the player did something in the last minute. It goes to
// the Sheet (aba Sessions) under the anonymous player key; the game never shows it.

export const HALL_ROOM = 'hall'; // time spent outside any room (entrance and hall)
export const IDLE_LIMIT_MS = 60_000;
export const FLUSH_EVERY_MS = 60_000;

export interface ScreenTimeReport {
  sessionId: string;
  startedAt: string;
  /** Cumulative active seconds of this session, per room id. */
  seconds: Record<string, number>;
}

export interface ScreenTimerOptions {
  send: (report: ScreenTimeReport) => Promise<unknown> | void;
  getRoom: () => string | null;
  isActive: () => boolean;
  sessionId?: string;
  now?: () => Date;
}

export class ScreenTimer {
  private readonly sessionId: string;
  private readonly startedAt: string;
  private readonly seconds: Record<string, number> = {};
  private dirty = false;

  constructor(private readonly opts: ScreenTimerOptions) {
    this.sessionId = opts.sessionId ?? crypto.randomUUID();
    this.startedAt = (opts.now ?? (() => new Date()))().toISOString();
  }

  /** Called once a second: adds a second to the current room when the player is really there. */
  tick(): void {
    if (!this.opts.isActive()) return;
    const room = this.opts.getRoom() ?? HALL_ROOM;
    this.seconds[room] = (this.seconds[room] ?? 0) + 1;
    this.dirty = true;
  }

  /** Sends the cumulative totals when something changed. The Sheet keeps the largest value, so a lost send is harmless. */
  flush(): void {
    if (!this.dirty) return;
    this.dirty = false;
    try {
      const sent = this.opts.send({ sessionId: this.sessionId, startedAt: this.startedAt, seconds: { ...this.seconds } });
      void Promise.resolve(sent).catch(() => {
        this.dirty = true;
      });
    } catch {
      this.dirty = true;
    }
  }
}

/** Wires a timer to the browser: 1 s tick, idle detection, flush every minute and when the tab is hidden. */
export function startScreenTimer(
  send: ScreenTimerOptions['send'],
  getRoom: () => string | null,
  win: Window = window,
): ScreenTimer {
  let lastInput = Date.now();
  const touch = (): void => {
    lastInput = Date.now();
  };
  const doc = win.document;
  const timer = new ScreenTimer({
    send,
    getRoom,
    isActive: () => doc.visibilityState === 'visible' && doc.hasFocus() && Date.now() - lastInput < IDLE_LIMIT_MS,
  });
  for (const type of ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel']) {
    win.addEventListener(type, touch, { passive: true });
  }
  win.setInterval(() => timer.tick(), 1000);
  win.setInterval(() => timer.flush(), FLUSH_EVERY_MS);
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'hidden') timer.flush();
  });
  win.addEventListener('pagehide', () => timer.flush());
  return timer;
}
