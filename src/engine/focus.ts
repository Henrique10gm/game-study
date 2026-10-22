// Study habit: a daily goal (questions answered today) and a streak of days in
// a row on which the goal was met. Pure functions plus a tiny storage wrapper;
// the numbers live only in this browser (localStorage), never in the Sheet.

export const DAILY_GOAL = 10;

export interface FocusState {
  day: string | null; // local day (YYYY-MM-DD) that `today` refers to
  today: number; // questions answered on `day`
  streak: number; // consecutive days with the goal met, up to `lastGoalDay`
  best: number;
  lastGoalDay: string | null;
}

export const EMPTY_FOCUS: FocusState = { day: null, today: 0, streak: 0, best: 0, lastGoalDay: null };

export interface FocusView {
  streak: number; // 0 once a day was missed
  best: number;
  today: number;
  goal: number;
  done: boolean; // today's goal is met
  atRisk: boolean; // there is a streak and today's goal is still open
  line: string; // one sentence about what to do now
}

export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function previousDay(date: Date): string {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
  return dayKey(copy);
}

/** Adds `answered` questions to today's count and updates the streak when the goal is reached. */
export function recordAnswers(state: FocusState, answered: number, now: Date, goal = DAILY_GOAL): FocusState {
  const today = dayKey(now);
  const add = Math.max(0, Math.floor(answered));
  const next: FocusState = { ...state, today: state.day === today ? state.today + add : add, day: today };
  if (next.today >= goal && next.lastGoalDay !== today) {
    next.streak = next.lastGoalDay === previousDay(now) ? next.streak + 1 : 1;
    next.best = Math.max(next.best, next.streak);
    next.lastGoalDay = today;
  }
  return next;
}

export function focusView(state: FocusState, now: Date, goal = DAILY_GOAL, wrongCount = 0): FocusView {
  const today = dayKey(now);
  const count = state.day === today ? state.today : 0;
  const done = count >= goal;
  const alive = state.lastGoalDay === today || state.lastGoalDay === previousDay(now);
  const streak = alive ? state.streak : 0;
  const missing = Math.max(0, goal - count);

  let line: string;
  if (done) {
    line = streak > 1 ? `Meta batida. ${streak} dias seguidos.` : 'Meta batida. Volte amanhã.';
  } else if (streak > 0) {
    line = `Faltam ${missing} para manter a ofensiva.`;
  } else {
    line = `Responda ${missing} hoje para começar uma ofensiva.`;
  }
  if (!done && wrongCount > 0) line += ` Revanche tem ${wrongCount} para rever.`;

  return { streak, best: Math.max(state.best, streak), today: count, goal, done, atRisk: streak > 0 && !done, line };
}

const STORAGE_KEY = 'cq.focus.v1';

function isDay(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

export function loadFocus(storage: Pick<Storage, 'getItem'> | null = safeStorage()): FocusState {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_FOCUS };
    const data = JSON.parse(raw) as Record<string, unknown>;
    return {
      day: isDay(data.day) ? data.day : null,
      today: count(data.today),
      streak: count(data.streak),
      best: count(data.best),
      lastGoalDay: isDay(data.lastGoalDay) ? data.lastGoalDay : null,
    };
  } catch {
    return { ...EMPTY_FOCUS };
  }
}

export function saveFocus(state: FocusState, storage: Pick<Storage, 'setItem'> | null = safeStorage()): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // private mode / full storage: the habit card just starts over next time
  }
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
