// Hidden things in the game. Pure logic here; the scenes decide what happens.
//
//  - Konami code (↑ ↑ ↓ ↓ ← → ← → B A): coin rain and a word from the boss.
//  - Typing "chefe": the boss shows up.
//  - Clicking the bank sign 5 times quickly, or the coin in the bank 5 times.
//  - 8 hits on the ceiling in one run.
//  - The console message (printed once at startup).

export const KONAMI = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'KeyB',
  'KeyA',
] as const;

export const BOSS_WORD = ['KeyC', 'KeyH', 'KeyE', 'KeyF', 'KeyE'] as const;

/** Fires `onMatch` when `sequence` is typed in order, with at most `gapMs` between keys. */
export class SequenceMatcher {
  private typed: string[] = [];
  private lastAt = 0;

  constructor(
    private readonly sequence: readonly string[],
    private readonly onMatch: () => void,
    private readonly gapMs = 2000,
  ) {}

  feed(code: string, now: number = Date.now()): void {
    if (this.typed.length > 0 && now - this.lastAt > this.gapMs) this.typed = [];
    this.lastAt = now;
    this.typed.push(code);
    if (this.typed.length > this.sequence.length) this.typed.shift();

    // Longest start of the sequence that the last keys still spell, so an extra
    // key before the real start (↑ ↑ ↑ ↓ ...) does not break it.
    let matched = 0;
    for (let length = this.typed.length; length > 0; length--) {
      const tail = this.typed.slice(this.typed.length - length);
      if (tail.every((key, i) => key === this.sequence[i])) {
        matched = length;
        break;
      }
    }
    this.typed = this.typed.slice(this.typed.length - matched);

    if (matched === this.sequence.length) {
      this.typed = [];
      this.onMatch();
    }
  }
}

/** Counts quick repeated clicks: true on the `target`-th click within `windowMs`. */
export class ClickCounter {
  private times: number[] = [];

  constructor(
    private readonly target = 5,
    private readonly windowMs = 3000,
  ) {}

  click(now: number = Date.now()): boolean {
    this.times = this.times.filter((t) => now - t <= this.windowMs);
    this.times.push(now);
    if (this.times.length >= this.target) {
      this.times = [];
      return true;
    }
    return false;
  }
}

export const CEILING_HITS_FOR_EGG = 8;

export function consoleGreeting(): string[] {
  return [
    'Você abriu o console. Boa: no time de segurança isso é elogio.',
    'Aqui não tem segredo escondido, só moeda. Mas tente o código Konami.',
  ];
}
