// Answering with the keyboard: arrows move between the choices, Enter confirms,
// and the keys never reach the game behind the question.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DialogueOverlay } from '../../src/engine/ui/DialogueOverlay';
import { makeFixtureScene } from '../fixtures/fixtureContent';
import { evaluateDecision } from '../../src/engine/systems/ScoringSystem';

const scene = makeFixtureScene(1, { choiceCount: 3 });

describe('DialogueOverlay keyboard', () => {
  let root: HTMLElement;
  let overlay: DialogueOverlay;
  const onChoose = vi.fn();

  beforeEach(() => {
    onChoose.mockClear();
    root = document.createElement('div');
    document.body.appendChild(root);
    overlay = new DialogueOverlay(root);
    overlay.showDecision(scene, onChoose);
  });

  afterEach(() => {
    overlay.unmount();
    root.remove();
  });

  const press = (code: string, init: KeyboardEventInit = {}): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true, ...init });
    window.dispatchEvent(event);
    return event;
  };
  const focused = () => (document.activeElement as HTMLElement | null)?.dataset.choiceId;

  it('starts on the first answer and moves with the arrows, wrapping around', () => {
    expect(focused()).toBe('a');
    press('ArrowDown');
    expect(focused()).toBe('b');
    press('ArrowDown');
    press('ArrowDown');
    expect(focused()).toBe('a');
    press('ArrowUp');
    expect(focused()).toBe('c');
  });

  it('Enter confirms the highlighted answer, exactly once', () => {
    press('ArrowDown');
    press('Enter');
    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose).toHaveBeenCalledWith('b');
  });

  it('Space does not answer or move on, and is kept away from the game', () => {
    const onContinue = vi.fn();
    press('ArrowDown');
    const space = press('Space');
    expect(onChoose).not.toHaveBeenCalled();
    expect(space.defaultPrevented).toBe(true);
    overlay.showFeedback(scene, evaluateDecision(scene, 'a'), onContinue);
    press('Space');
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('a held Enter does not repeat, and the keys are kept away from the game', () => {
    const held = press('Enter', { repeat: true });
    expect(onChoose).not.toHaveBeenCalled();
    expect(held.defaultPrevented).toBe(true);
    const reached: string[] = [];
    const spy = (event: KeyboardEvent) => reached.push(event.code);
    window.addEventListener('keydown', spy);
    press('ArrowUp');
    press('Space');
    window.removeEventListener('keydown', spy);
    expect(reached).toEqual([]);
  });

  it('after the answer, Enter moves on, and the keys are free again once it closes', () => {
    const onContinue = vi.fn();
    overlay.showFeedback(scene, evaluateDecision(scene, 'a'), onContinue);
    press('ArrowDown'); // nothing to move through now
    expect(onContinue).not.toHaveBeenCalled();
    press('Enter');
    expect(onContinue).toHaveBeenCalledTimes(1);

    overlay.unmount();
    expect(press('ArrowUp').defaultPrevented).toBe(false);
  });

  it('shows the hint under the answers', () => {
    expect(root.querySelector('[data-testid="dialogue-hint"]')?.textContent).toContain('Enter para confirmar');
  });
});
