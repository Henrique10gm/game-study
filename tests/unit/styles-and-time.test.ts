import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COINS_PER_QUESTION } from '../../src/engine/config';
import { GAME_STYLES, getStyle, isGameStyle } from '../../src/engine/styles';
import { MAX_SECONDS, MIN_SECONDS, questionWordCount, timeLimitSeconds } from '../../src/engine/timeLimit';
import { DecisionScene } from '../../src/engine/scenes/DecisionScene';
import { TIMEOUT_CHOICE_ID, timeoutDecision } from '../../src/engine/systems/ScoringSystem';
import { RunFlow } from '../../src/engine/run/RunFlow';
import { MemoryGameStore, makeFixtureBank, makeFixtureScene } from '../fixtures/fixtureContent';
import type { QuestionContent } from '../../src/engine/content/types';

function withText(words: number): QuestionContent {
  const base = makeFixtureScene(99);
  const filler = Array.from({ length: words }, () => 'palavra').join(' ');
  return { ...base, dialogue: [{ speaker: 'A — B', text: filler }], question: 'ok', choices: base.choices.map((c) => ({ ...c, text: 'x' })) };
}

describe('game styles', () => {
  it('has the four styles, each with its own scene', () => {
    expect(GAME_STYLES.map((s) => s.id)).toEqual(['obstaculos', 'tempo', 'corrida', 'pacman']);
    expect(GAME_STYLES.map((s) => s.sceneKey)).toEqual(['FlappyScene', 'TimeAttackScene', 'RunnerScene', 'PacmanScene']);
    expect(getStyle('pacman').title).toBe('Fuja dos ladrões');
    expect(getStyle('corrida').title).toBe('Corrida');
    expect(getStyle(undefined).id).toBe('obstaculos'); // old games
    expect(getStyle('nope').id).toBe('obstaculos');
    expect(isGameStyle('tempo')).toBe(true);
    expect(isGameStyle('x')).toBe(false);
  });
});

describe('time limit (Contra o tempo)', () => {
  it('grows with the amount of text, within a floor and a ceiling', () => {
    const short = timeLimitSeconds(withText(5));
    const medium = timeLimitSeconds(withText(100));
    const long = timeLimitSeconds(withText(300));
    expect(short).toBe(MIN_SECONDS);
    expect(medium).toBeGreaterThan(short);
    expect(long).toBeGreaterThan(medium);
    expect(timeLimitSeconds(withText(5000))).toBe(MAX_SECONDS);
  });

  it('counts the dialogue, the question and every choice', () => {
    const q = makeFixtureScene(1);
    const expected =
      q.dialogue.reduce((n, l) => n + l.text.trim().split(/\s+/).filter(Boolean).length, 0) +
      q.question.trim().split(/\s+/).length +
      q.choices.reduce((n, c) => n + c.text.trim().split(/\s+/).length, 0);
    expect(questionWordCount(q)).toBe(expected);
  });

  it('uses 8 s plus 0.3 s per word', () => {
    expect(timeLimitSeconds(withText(200))).toBe(Math.round(8 + 0.3 * questionWordCount(withText(200))));
  });

  it('is variable in the real question bank', () => {
    const real = Array.from({ length: 12 }, (_, i) => withText(20 + i * 25));
    expect(new Set(real.map(timeLimitSeconds)).size).toBeGreaterThan(5);
  });
});

describe('timeout is a wrong answer', () => {
  it('builds an outcome with no XP, the id that fits the backend, and the right answer\'s feedback', () => {
    const q = makeFixtureScene(1);
    const outcome = timeoutDecision(q);
    expect(outcome).toMatchObject({ correct: false, xpEarned: 0, timedOut: true, chosenChoiceId: TIMEOUT_CHOICE_ID });
    expect(outcome.correctChoiceId).toBe(q.choices.find((c) => c.correct)?.id);
    expect(TIMEOUT_CHOICE_ID).toMatch(/^[a-z0-9]{1,8}$/); // Code.gs CHOICE_ID_RE
  });
});

describe('DecisionScene with a timer', () => {
  let root: HTMLElement;
  beforeEach(() => {
    vi.useFakeTimers();
    root = document.createElement('div');
    document.body.appendChild(root);
  });
  afterEach(() => {
    vi.useRealTimers();
    root.remove();
  });

  it('shows a countdown that empties and settles as a wrong answer when time is up', async () => {
    const pending = new DecisionScene({ root }).run(makeFixtureScene(1), { index: 1, total: 3, streak: 0, timeLimitMs: 20000 });
    const fill = () => root.querySelector<HTMLElement>('.dialogue-timer-fill')!;
    const label = () => root.querySelector('.dialogue-timer-label')?.textContent;
    expect(label()).toBe('20 s');

    await vi.advanceTimersByTimeAsync(10000);
    expect(label()).toBe('10 s');
    expect(parseFloat(fill().style.width)).toBeCloseTo(50, 0);

    await vi.advanceTimersByTimeAsync(10200);
    expect(root.querySelector('[data-testid="feedback-banner"]')?.textContent).toBe('Tempo esgotado.');
    expect(root.querySelector('.choice-button--correct')).not.toBeNull(); // shows the right answer
    root.querySelector<HTMLButtonElement>('[data-testid="btn-continue"]')?.click();
    const outcome = await pending;
    expect(outcome).toMatchObject({ correct: false, timedOut: true, xpEarned: 0 });
  });

  it('answering before the time is up stops the clock', async () => {
    const pending = new DecisionScene({ root }).run(makeFixtureScene(1), { index: 1, total: 3, streak: 0, timeLimitMs: 5000 });
    root.querySelectorAll<HTMLButtonElement>('[data-testid="choice"]').forEach((b) => {
      if (b.textContent?.includes('correta')) b.click();
    });
    await vi.advanceTimersByTimeAsync(9000); // would have timed out
    expect(root.querySelector('[data-testid="feedback-banner"]')?.textContent).toBe('Correto!');
    root.querySelector<HTMLButtonElement>('[data-testid="btn-continue"]')?.click();
    expect((await pending).correct).toBe(true);
  });

  it('without a time limit there is no timer at all', async () => {
    const pending = new DecisionScene({ root }).run(makeFixtureScene(1));
    expect(root.querySelector('[data-testid="dialogue-timer"]')).toBeNull();
    await vi.advanceTimersByTimeAsync(600000);
    expect(root.querySelector('[data-testid="feedback-banner"]')).toBeNull();
    root.querySelector<HTMLButtonElement>('[data-testid="choice"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-testid="btn-continue"]')?.click();
    await pending;
  });
});

describe('RunFlow in Contra o tempo', () => {
  let uiRoot: HTMLElement;
  let store: MemoryGameStore;
  let flow: RunFlow;
  const pool = makeFixtureBank(6);

  beforeEach(() => {
    vi.useFakeTimers();
    uiRoot = document.createElement('div');
    document.body.appendChild(uiRoot);
    store = new MemoryGameStore();
    flow = new RunFlow({ uiRoot, store, random: () => 0.5, newId: () => 'game-t', confirmAbandon: () => true });
  });
  afterEach(() => {
    vi.useRealTimers();
    uiRoot.remove();
  });

  const setup = (count = 4) => ({ modeId: 'treino-sfn', modeTitle: 'Teste', pool, count, style: 'tempo' as const });

  async function answer(correct: boolean) {
    const pending = flow.askQuestion();
    await Promise.resolve();
    uiRoot.querySelectorAll<HTMLButtonElement>('[data-testid="choice"]').forEach((b) => {
      if (b.textContent?.includes(correct ? 'correta' : 'errada')) b.click();
    });
    await Promise.resolve();
    uiRoot.querySelector<HTMLButtonElement>('[data-testid="btn-continue"]')?.click();
    return pending;
  }

  it('shows the timer only in this style, with the limit of that question', async () => {
    flow.startRun(setup());
    const pending = flow.askQuestion();
    await Promise.resolve();
    const seconds = Number(uiRoot.querySelector('.dialogue-timer-label')?.textContent?.replace(' s', ''));
    expect(seconds).toBeGreaterThanOrEqual(20);
    expect(seconds).toBeLessThanOrEqual(90);
    uiRoot.querySelector<HTMLButtonElement>('[data-testid="choice"]')?.click();
    uiRoot.querySelector<HTMLButtonElement>('[data-testid="btn-continue"]')?.click();
    await pending;

    flow.startRun({ ...setup(), style: 'obstaculos' });
    const second = flow.askQuestion();
    await Promise.resolve();
    expect(uiRoot.querySelector('[data-testid="dialogue-timer"]')).toBeNull();
    uiRoot.querySelector<HTMLButtonElement>('[data-testid="choice"]')?.click();
    uiRoot.querySelector<HTMLButtonElement>('[data-testid="btn-continue"]')?.click();
    await second;
  });

  it('running out of time costs a life and is saved as a wrong answer with its review', async () => {
    flow.startRun(setup());
    const pending = flow.askQuestion();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(95000);
    uiRoot.querySelector<HTMLButtonElement>('[data-testid="btn-continue"]')?.click();
    const result = await pending;

    expect(result.correct).toBe(false);
    expect(flow.getLives()).toBe(2);

    const end = flow.finishRun('abandoned');
    await end;
    expect(store.games[0].style).toBe('tempo');
    expect(store.games[0].answers[0]).toMatchObject({ correct: false, chosenChoiceId: TIMEOUT_CHOICE_ID });
  });

  it('the bonus life comes with a right answer after the middle, once, only if a life was lost', async () => {
    flow.startRun(setup(4));
    expect((await answer(true)).heart).toBe(false); // nothing lost yet
    expect((await answer(false)).heart).toBe(false); // wrong answer: no heart, lives 2
    expect(flow.getLives()).toBe(2);
    const third = await answer(true); // 3 of 4 answered: past the middle
    expect(third.heart).toBe(true);
    expect(flow.getLives()).toBe(3);
  });

  it('saves the style in the record, and the HUD hides barriers and speed', async () => {
    flow.startRun(setup());
    expect(uiRoot.querySelector<HTMLElement>('[data-testid="hud-barriers"]')?.style.display).toBe('none');
    expect(uiRoot.querySelector<HTMLElement>('[data-testid="hud-pace"]')?.style.display).toBe('none');
    flow.startRun({ ...setup(), style: 'corrida' });
    expect(uiRoot.querySelector<HTMLElement>('[data-testid="hud-barriers"]')?.style.display).toBe('');
    await answer(true);
    await flow.finishRun('abandoned');
    expect(store.games[0].style).toBe('corrida');
  });

  it('Fuja dos ladrões asks a question every COINS_PER_QUESTION coins and counts them in the HUD', () => {
    flow.startRun({ ...setup(), style: 'pacman' });
    const hud = () => uiRoot.querySelector('[data-testid="hud-barriers"]')?.textContent;
    expect(hud()).toBe(`Pergunta em ${COINS_PER_QUESTION} moedas`);
    const due: boolean[] = [];
    for (let i = 1; i <= COINS_PER_QUESTION * 2; i++) due.push(flow.barrierPassed());
    expect(due.filter(Boolean)).toHaveLength(2);
    expect(due[COINS_PER_QUESTION - 1]).toBe(true);
    expect(due[COINS_PER_QUESTION * 2 - 1]).toBe(true);
    flow.barrierPassed();
    flow.barrierPassed();
    expect(hud()).toBe('Pergunta em 1 moeda');
    flow.startRun({ ...setup(), style: 'corrida' });
    expect(hud()).toBe('Pergunta em 5 barreiras');
  });
});
