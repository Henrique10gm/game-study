// Rules of one Flappy-Quiz run: lives, question cadence, completion, the
// end-of-run summary/review and saving the finished game.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RunFlow } from '../../src/engine/run/RunFlow';
import { BARRIERS_PER_QUESTION, LIVES_PER_RUN } from '../../src/engine/config';
import { wrongIdsOf } from '../../src/engine/progress';
import { MemoryGameStore, makeFixtureBank } from '../fixtures/fixtureContent';

const pool = makeFixtureBank(6);

describe('RunFlow', () => {
  let uiRoot: HTMLElement;
  let store: MemoryGameStore;
  let flow: RunFlow;
  let idCounter = 0;

  beforeEach(() => {
    uiRoot = document.createElement('div');
    document.body.appendChild(uiRoot);
    store = new MemoryGameStore();
    idCounter = 0;
    flow = new RunFlow({
      uiRoot,
      store,
      random: () => 0.5,
      newId: () => `game-${++idCounter}`,
      confirmAbandon: () => true,
    });
  });

  afterEach(() => {
    uiRoot.remove();
    vi.useRealTimers();
  });

  const setup = (count = 6) => ({ modeId: 'treino-sfn', modeTitle: 'Treino de teste', pool, count });

  // Opens the question, answers it right/wrong, closes the feedback.
  async function answer(correct: boolean) {
    const pending = flow.askQuestion();
    await Promise.resolve();
    const buttons = Array.from(uiRoot.querySelectorAll<HTMLButtonElement>('[data-testid="choice"]'));
    buttons.find((b) => b.textContent?.includes(correct ? 'correta' : 'errada'))?.click();
    await Promise.resolve();
    uiRoot.querySelector<HTMLButtonElement>('[data-testid="btn-continue"]')?.click();
    return pending;
  }

  it('starts with full lives and the requested number of questions', () => {
    flow.startRun(setup(5));
    expect(flow.getLives()).toBe(LIVES_PER_RUN);
    expect(flow.getBarriersPassed()).toBe(0);
    expect(flow.getQuestionTotal()).toBe(5);
  });

  it('saves the game with the room it was played in (and none when no room is given)', async () => {
    flow.startRun({ ...setup(2), roomId: 'banking', modeId: 'banking-geral' });
    await answer(true);
    await flow.finishRun('abandoned');
    flow.startRun(setup(2));
    await answer(true);
    await flow.finishRun('abandoned');
    expect(store.games[0]).toMatchObject({ roomId: 'banking', modeId: 'banking-geral' });
    expect(store.games[1].roomId).toBeUndefined();
  });

  it('asks a question exactly every BARRIERS_PER_QUESTION barriers', () => {
    flow.startRun(setup());
    const due: boolean[] = [];
    for (let i = 1; i <= BARRIERS_PER_QUESTION * 2; i++) due.push(flow.barrierPassed());
    expect(due.filter(Boolean)).toHaveLength(2);
    expect(due[BARRIERS_PER_QUESTION - 1]).toBe(true);
    expect(due[BARRIERS_PER_QUESTION * 2 - 1]).toBe(true);
  });

  it('never asks the same question twice in a run', async () => {
    flow.startRun(setup());
    for (let i = 0; i < 6; i++) await answer(true);
    await flow.finishRun('abandoned');
    const ids = store.games[0].answers.map((a) => a.questionId);
    expect(new Set(ids).size).toBe(6);
  });

  it('a correct answer gives XP; a wrong one costs a life', async () => {
    flow.startRun(setup());

    const right = await answer(true);
    expect(right.correct).toBe(true);
    expect(flow.getXp()).toBe(10);
    expect(flow.getLives()).toBe(LIVES_PER_RUN);

    const wrong = await answer(false);
    expect(wrong.correct).toBe(false);
    expect(flow.getLives()).toBe(LIVES_PER_RUN - 1);
    expect(flow.getXp()).toBe(10);
  });

  // Same as answer(), for the last-chance question.
  async function answerLastChance(correct: boolean) {
    const pending = flow.askLastChance();
    await Promise.resolve();
    const buttons = Array.from(uiRoot.querySelectorAll<HTMLButtonElement>('[data-testid="choice"]'));
    buttons.find((b) => b.textContent?.includes(correct ? 'correta' : 'errada'))?.click();
    await Promise.resolve();
    uiRoot.querySelector<HTMLButtonElement>('[data-testid="btn-continue"]')?.click();
    return pending;
  }

  it('a collision costs a life, except on the last one, where a last-chance question decides', () => {
    flow.startRun(setup());
    expect(flow.collide()).toBe('life-lost');
    expect(flow.getLives()).toBe(2);
    expect(flow.collide()).toBe('life-lost');
    expect(flow.getLives()).toBe(1);
    expect(flow.collide()).toBe('last-chance');
    expect(flow.getLives()).toBe(1); // nothing is lost until the question is answered
  });

  it('last chance answered right: the run goes on with the last life', async () => {
    flow.startRun(setup(4));
    flow.collide();
    flow.collide();
    const pending = flow.askLastChance();
    await Promise.resolve();
    expect(uiRoot.querySelector('[data-testid="dialogue-meta"]')?.textContent).toContain('Última chance');
    uiRoot.querySelectorAll<HTMLButtonElement>('[data-testid="choice"]').forEach((b) => {
      if (b.textContent?.includes('correta')) b.click();
    });
    await Promise.resolve();
    uiRoot.querySelector<HTMLButtonElement>('[data-testid="btn-continue"]')?.click();
    const result = await pending;

    expect(result).toEqual({ correct: true, gameOver: false });
    expect(flow.getLives()).toBe(1);
    expect(flow.getQuestionsAnswered()).toBe(0); // it is not one of the planned questions
    expect(flow.getXp()).toBe(10);
    const next = await answer(true); // the planned questions continue as usual
    expect(next.gameOver).toBe(false);
    expect(flow.getQuestionsAnswered()).toBe(1);
  });

  it('last chance answered wrong ends the run and is saved with its review', async () => {
    flow.startRun(setup(4));
    flow.collide();
    flow.collide();
    const result = await answerLastChance(false);
    expect(result).toEqual({ correct: false, gameOver: true });
    expect(flow.getLives()).toBe(0);

    const end = flow.finishRun('gameover');
    await Promise.resolve();
    expect(uiRoot.querySelectorAll('[data-testid="review-item"]')).toHaveLength(1);
    uiRoot.querySelector<HTMLButtonElement>('[data-testid="review-action-menu"]')?.click();
    await end;
    expect(store.games[0].answers).toHaveLength(1);
    expect(store.games[0].answeredCount).toBe(1);
  });

  it('the last-chance question prefers questions that are not in the run list', async () => {
    flow.startRun(setup(2)); // 2 planned, 4 spare in the pool of 6
    flow.collide();
    flow.collide();
    await answerLastChance(true);
    await flow.finishRun('abandoned');
    const planned = new Set(store.games[0].answers.map((a) => a.questionId));
    expect(planned.size).toBe(1);
  });

  it('the heart: one per run, mid-run, only after a life was lost, never above the maximum', async () => {
    flow.startRun(setup(4));
    expect(flow.wantsHeart()).toBe(false); // full lives
    flow.collide();
    expect(flow.wantsHeart()).toBe(false); // too early: nothing answered yet
    await answer(true);
    await answer(true); // half of 4
    expect(flow.wantsHeart()).toBe(true);
    flow.markHeartSpawned();
    expect(flow.wantsHeart()).toBe(false);

    expect(flow.gainLife()).toBe(true);
    expect(flow.getLives()).toBe(LIVES_PER_RUN);
    expect(flow.gainLife()).toBe(false); // already full
  });

  it('a new run allows a new heart', () => {
    flow.startRun(setup(4));
    flow.markHeartSpawned();
    flow.startRun(setup(4));
    flow.collide();
    expect(flow.getLives()).toBe(LIVES_PER_RUN - 1);
  });

  it('shows a short rules card before the run that can be skipped with a button or a key', async () => {
    const first = flow.showIntro();
    expect(uiRoot.querySelector('[data-testid="how-it-works"]')?.textContent).toContain(`${LIVES_PER_RUN} vidas`);
    expect(uiRoot.querySelector('[data-testid="how-it-works"]')?.textContent).toContain('última chance');
    uiRoot.querySelector<HTMLButtonElement>('[data-testid="hiw-skip"]')?.click();
    await first;
    expect(uiRoot.querySelector('[data-testid="how-it-works"]')).toBeNull();

    const second = flow.showIntro();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', bubbles: true }));
    await second;
    expect(uiRoot.querySelector('[data-testid="how-it-works"]')).toBeNull();
  });

  it('running out of lives on a wrong answer is game over', async () => {
    flow.startRun(setup());
    flow.collide();
    flow.collide();
    const result = await answer(false);
    expect(result.gameOver).toBe(true);
    expect(result.completed).toBe(false);
  });

  it('answering every requested question completes the run', async () => {
    flow.startRun(setup(5));
    let last = { correct: false, gameOver: false, completed: false };
    for (let i = 0; i < 5; i++) last = await answer(true);
    expect(last.completed).toBe(true);
    expect(last.gameOver).toBe(false);
    expect(flow.barrierPassed()).toBe(false); // nothing left to ask
  });

  it('the barriers speed up after each correct answer, and a wrong one keeps the speed', async () => {
    flow.startRun(setup());
    const speeds = [flow.getTuning().speed];
    await answer(true);
    speeds.push(flow.getTuning().speed);
    await answer(true);
    speeds.push(flow.getTuning().speed);
    expect(speeds[1]).toBeGreaterThan(speeds[0]);
    expect(speeds[2]).toBeGreaterThan(speeds[1]);

    await answer(false);
    expect(flow.getTuning().speed).toBe(speeds[2]);
    expect(uiRoot.querySelector('[data-testid="hud-pace"]')?.textContent).toBe(
      `Velocidade ${flow.getTuning().speedPct}%`,
    );
  });

  it('game over: shows the review of wrong answers, saves the game, and offers to play again', async () => {
    flow.startRun(setup());
    await answer(true);
    await answer(false);

    const end = flow.finishRun('gameover');
    await Promise.resolve();
    expect(uiRoot.querySelector('[data-testid="review-title"]')?.textContent).toBe('O que escapou');
    expect(uiRoot.querySelectorAll('[data-testid="review-item"]')).toHaveLength(1);
    uiRoot.querySelector<HTMLButtonElement>('[data-testid="review-action-again"]')?.click();
    expect(await end).toBe('again');

    expect(store.games).toHaveLength(1);
    expect(store.games[0]).toMatchObject({
      id: 'game-1',
      modeId: 'treino-sfn',
      result: 'gameover',
      answeredCount: 2,
      correctCount: 1,
      xp: 10,
    });
    expect(store.games[0].answers.map((a) => a.correct)).toEqual([true, false]);
    expect(wrongIdsOf((await store.getProgress()).statuses)).toHaveLength(1);
  });

  it('completed run records the result and can go back to the menu', async () => {
    flow.startRun(setup(5));
    for (let i = 0; i < 5; i++) await answer(true);

    const end = flow.finishRun('complete');
    await Promise.resolve();
    expect(uiRoot.querySelector('[data-testid="review-empty"]')).not.toBeNull();
    uiRoot.querySelector<HTMLButtonElement>('[data-testid="review-action-menu"]')?.click();
    expect(await end).toBe('menu');
    expect(store.games[0]).toMatchObject({ result: 'completed', requestedCount: 5, correctCount: 5, xp: 50 });
  });

  it('a completed run can go on: same lives and speed, new questions, each segment saved on its own', async () => {
    flow.startRun(setup(5));
    for (let i = 0; i < 5; i++) await answer(true);
    const speedAfterWin = flow.getTuning().speed;

    const end = flow.finishRun('complete');
    await Promise.resolve();
    expect(uiRoot.querySelector('[data-testid="review-action-continue"]')).not.toBeNull();
    uiRoot.querySelector<HTMLButtonElement>('[data-testid="review-action-continue"]')?.click();
    expect(await end).toBe('continue');

    flow.continueRun();
    expect(flow.getTuning().speed).toBe(speedAfterWin);
    expect(flow.getQuestionsAnswered()).toBe(0);
    expect(flow.getQuestionTotal()).toBe(5);
    expect(flow.getLives()).toBe(LIVES_PER_RUN);
    await flow.showIntro(); // the rules card is not shown again

    await answer(false);
    expect(flow.getLives()).toBe(LIVES_PER_RUN - 1);
    const over = flow.finishRun('gameover');
    await Promise.resolve();
    expect(uiRoot.querySelector('[data-testid="review-action-continue"]')).toBeNull();
    uiRoot.querySelector<HTMLButtonElement>('[data-testid="review-action-menu"]')?.click();
    await over;

    expect(store.games).toHaveLength(2);
    expect(store.games[0]).toMatchObject({ result: 'completed', answeredCount: 5 });
    expect(store.games[1]).toMatchObject({ result: 'gameover', answeredCount: 1, correctCount: 0 });
    expect(store.games[1].id).not.toBe(store.games[0].id);
  });

  it('tells the study habit how many questions each run answered and shows its line', async () => {
    const seen: number[] = [];
    const habitFlow = new RunFlow({
      uiRoot,
      store,
      random: () => 0.5,
      confirmAbandon: () => true,
      onRunEnd: (answered) => {
        seen.push(answered);
        return 'Hoje: 1 de 10 questões.';
      },
    });
    habitFlow.startRun(setup());
    const pending = habitFlow.askQuestion();
    await Promise.resolve();
    Array.from(uiRoot.querySelectorAll<HTMLButtonElement>('[data-testid="choice"]'))
      .find((b) => b.textContent?.includes('correta'))
      ?.click();
    await Promise.resolve();
    uiRoot.querySelector<HTMLButtonElement>('[data-testid="btn-continue"]')?.click();
    await pending;

    const end = habitFlow.finishRun('gameover');
    await Promise.resolve();
    expect(uiRoot.querySelector('[data-testid="review-focus"]')?.textContent).toBe('Hoje: 1 de 10 questões.');
    uiRoot.querySelector<HTMLButtonElement>('[data-testid="review-action-menu"]')?.click();
    await end;
    expect(seen).toEqual([1]);
  });

  it('abandoning saves what was answered without showing a review; an empty run is not saved', async () => {
    flow.startRun(setup());
    await answer(false);
    expect(await flow.finishRun('abandoned')).toBe('menu');
    expect(uiRoot.querySelector('[data-testid="review-screen"]')).toBeNull();
    expect(store.games).toHaveLength(1);
    expect(store.games[0].result).toBe('abandoned');

    flow.startRun(setup());
    await flow.finishRun('abandoned');
    expect(store.games).toHaveLength(1);
  });

  it('a failing store never breaks the end of the run', async () => {
    flow.startRun(setup());
    await answer(false);
    store.failNext = true;

    const end = flow.finishRun('gameover');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(uiRoot.querySelector('[data-testid="review-status"]')?.textContent).toBe(
      'Não foi possível salvar esta partida.',
    );
    uiRoot.querySelector<HTMLButtonElement>('[data-testid="review-action-menu"]')?.click();
    expect(await end).toBe('menu');
  });

  it('the HUD Menu button asks for confirmation and is disabled while a question is open', async () => {
    const onAbandon = vi.fn();
    flow.onAbandon = onAbandon;
    flow.startRun(setup());
    const menuButton = uiRoot.querySelector<HTMLButtonElement>('[data-testid="hud-menu"]')!;

    menuButton.click();
    expect(onAbandon).toHaveBeenCalledTimes(1);

    const pending = flow.askQuestion();
    await Promise.resolve();
    expect(menuButton.disabled).toBe(true);
    uiRoot.querySelector<HTMLButtonElement>('[data-testid="choice"]')?.click();
    await Promise.resolve();
    uiRoot.querySelector<HTMLButtonElement>('[data-testid="btn-continue"]')?.click();
    await pending;
    expect(menuButton.disabled).toBe(false);
  });

  it('shows the question position and the streak while answering', async () => {
    flow.startRun(setup(4));
    await answer(true);
    await answer(true);
    expect(flow.getQuestionsAnswered()).toBe(2);

    const pending = flow.askQuestion();
    await Promise.resolve();
    expect(uiRoot.querySelector('[data-testid="dialogue-meta"]')?.textContent).toContain('Questão 3 de 4');
    expect(uiRoot.querySelector('.dialogue-streak')?.textContent).toBe('Combo ×2');
    uiRoot.querySelector<HTMLButtonElement>('[data-testid="choice"]')?.click();
    await Promise.resolve();
    uiRoot.querySelector<HTMLButtonElement>('[data-testid="btn-continue"]')?.click();
    await pending;
  });

  it('a wrong answer breaks the streak, reported in the result', async () => {
    flow.startRun(setup());
    expect((await answer(true)).streak).toBe(1);
    expect((await answer(false)).streak).toBe(0);
  });

  it('the end screen shows how much the run moved the player forward', async () => {
    const bank = makeFixtureBank(10);
    flow.startRun({
      ...setup(4),
      pool: bank,
      bank,
      before: { statuses: { [bank[0].sceneId]: true }, totalXp: 95 },
    });
    // answer everything right: the run ends as completed
    for (let i = 0; i < 4; i++) await answer(true);
    const end = flow.finishRun('complete');
    await Promise.resolve();

    const text = (id: string) => uiRoot.querySelector(`[data-testid="${id}"]`)?.textContent;
    expect(uiRoot.querySelector('[data-testid="review-evolution"]')).not.toBeNull();
    expect(text('evolution-delta')).toMatch(/^\+[1-4] (questão dominada|questões dominadas)$/);
    expect(text('evolution-goal')).toMatch(/para /);
    uiRoot.querySelector<HTMLButtonElement>('[data-testid="review-action-menu"]')?.click();
    await end;
  });

  it('puts the ranking position on the end screen once the game is saved', async () => {
    const rankFlow = new RunFlow({
      uiRoot,
      store,
      random: () => 0.5,
      newId: () => 'game-rank',
      confirmAbandon: () => true,
      getRankLine: async () => 'Você está em 2º no ranking.',
    });
    rankFlow.startRun({ ...setup(2), bank: pool, before: { statuses: {}, totalXp: 0 } });
    const end = rankFlow.finishRun('gameover');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(uiRoot.querySelector('[data-testid="review-rank"]')?.textContent).toBe('Você está em 2º no ranking.');
    uiRoot.querySelector<HTMLButtonElement>('[data-testid="review-action-menu"]')?.click();
    await end;
  });

  it('a character comments on the end screen: perfect, completed and game over differ', async () => {
    flow.startRun(setup(5));
    for (let i = 0; i < 5; i++) await answer(true);
    const perfect = flow.finishRun('complete');
    await Promise.resolve();
    const cameo = uiRoot.querySelector('[data-testid="review-cameo"]');
    expect(cameo?.querySelector('.review-cameo-who')?.textContent).toMatch(/·/);
    expect(cameo?.querySelector('.review-cameo-line')?.textContent?.length).toBeGreaterThan(5);
    expect(cameo?.querySelector('.avatar')).not.toBeNull();
    uiRoot.querySelector<HTMLButtonElement>('[data-testid="review-action-menu"]')?.click();
    await perfect;

    flow.startRun(setup(5));
    const over = flow.finishRun('gameover');
    await Promise.resolve();
    expect(uiRoot.querySelector('[data-testid="review-cameo"]')).not.toBeNull();
    uiRoot.querySelector<HTMLButtonElement>('[data-testid="review-action-menu"]')?.click();
    await over;
  });
});
