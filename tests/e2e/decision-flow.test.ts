// Question overlay flow (no timer): choose -> feedback with the per-choice
// text -> only "Continuar" closes it. DecisionScene is exercised directly.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DecisionScene } from '../../src/engine/scenes/DecisionScene';
import { makeFixtureScene } from '../fixtures/fixtureContent';

describe('decision flow without a timer', () => {
  let uiRoot: HTMLElement;

  beforeEach(() => {
    uiRoot = document.createElement('div');
    document.body.appendChild(uiRoot);
  });

  afterEach(() => {
    uiRoot.remove();
  });

  function choiceButton(id: string): HTMLButtonElement | undefined {
    return Array.from(uiRoot.querySelectorAll<HTMLButtonElement>('[data-testid="choice"]')).find(
      (b) => b.dataset.choiceId === id,
    );
  }

  it('shows no countdown anywhere in the overlay', async () => {
    void new DecisionScene({ root: uiRoot }).run(makeFixtureScene(1));
    await Promise.resolve();

    expect(uiRoot.querySelector('[data-testid="dialogue-overlay"]')).not.toBeNull();
    expect(uiRoot.querySelector('[data-testid="timer-bar"]')).toBeNull();
    expect(uiRoot.querySelector('[data-testid="timer-seconds"]')).toBeNull();
  });

  it('a correct answer shows "Correto!", its feedback and the plain XP copy', async () => {
    const pending = new DecisionScene({ root: uiRoot }).run(makeFixtureScene(1));
    await Promise.resolve();

    choiceButton('a')?.click();

    expect(uiRoot.querySelector('[data-testid="feedback-banner"]')?.textContent).toBe('Correto!');
    expect(uiRoot.querySelector('[data-testid="feedback-text"]')?.textContent).toBe(
      'Feedback de acerto da alternativa 0 do cenário 1.',
    );
    expect(uiRoot.querySelector('[data-testid="xp-gain"]')?.textContent).toBe('+10 XP');

    uiRoot.querySelector<HTMLButtonElement>('[data-testid="btn-continue"]')?.click();
    const outcome = await pending;
    expect(outcome.correct).toBe(true);
    expect(outcome.xpEarned).toBe(10);
    expect(uiRoot.querySelector('[data-testid="dialogue-overlay"]')).toBeNull();
  });

  it('a wrong answer shows "Não foi dessa vez." and gives no XP', async () => {
    const pending = new DecisionScene({ root: uiRoot }).run(makeFixtureScene(1));
    await Promise.resolve();

    choiceButton('b')?.click();

    expect(uiRoot.querySelector('[data-testid="feedback-banner"]')?.textContent).toBe('Não foi dessa vez.');
    expect(uiRoot.querySelector('[data-testid="feedback-text"]')?.textContent).toBe(
      'Feedback de erro da alternativa 1 do cenário 1.',
    );
    expect(uiRoot.querySelector('[data-testid="xp-gain"]')).toBeNull();

    uiRoot.querySelector<HTMLButtonElement>('[data-testid="btn-continue"]')?.click();
    const outcome = await pending;
    expect(outcome.correct).toBe(false);
    expect(outcome.xpEarned).toBe(0);
    expect(outcome.chosenChoiceId).toBe('b');
  });

  it('choices lock after answering, and nothing advances until "Continuar" is clicked', async () => {
    const pending = new DecisionScene({ root: uiRoot }).run(makeFixtureScene(1));
    await Promise.resolve();

    choiceButton('a')?.click();
    for (const button of Array.from(uiRoot.querySelectorAll<HTMLButtonElement>('[data-testid="choice"]'))) {
      expect(button.disabled).toBe(true);
    }
    expect(uiRoot.querySelector('[data-testid="dialogue-overlay"]')).not.toBeNull();

    uiRoot.querySelector<HTMLButtonElement>('[data-testid="btn-continue"]')?.click();
    await pending;
    expect(uiRoot.querySelector('[data-testid="dialogue-overlay"]')).toBeNull();
  });
});
