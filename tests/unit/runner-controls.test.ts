import { afterEach, describe, expect, it, vi } from 'vitest';
import { RunnerControls } from '../../src/engine/ui/RunnerControls';

describe('RunnerControls (touch buttons for Corrida)', () => {
  let root: HTMLElement;
  afterEach(() => root?.remove());

  it('only a finger-first device needs them', () => {
    window.matchMedia = ((q: string) => ({ matches: q.includes('coarse') })) as never;
    expect(RunnerControls.isNeeded()).toBe(true);
    window.matchMedia = (() => ({ matches: false })) as never;
    expect(RunnerControls.isNeeded()).toBe(false);
  });

  it('Pular jumps on press; Agachar is held while pressed and released on lift, cancel or leave', () => {
    root = document.createElement('div');
    document.body.appendChild(root);
    const onJump = vi.fn();
    const onDuck = vi.fn();
    const controls = new RunnerControls(root, { onJump, onDuck });

    const press = (testId: string, type: string) =>
      root.querySelector(`[data-testid="${testId}"]`)!.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));

    press('runner-jump', 'pointerdown');
    expect(onJump).toHaveBeenCalledTimes(1);

    press('runner-duck', 'pointerdown');
    expect(onDuck).toHaveBeenLastCalledWith(true);
    press('runner-duck', 'pointerup');
    expect(onDuck).toHaveBeenLastCalledWith(false);
    press('runner-duck', 'pointerdown');
    press('runner-duck', 'pointercancel');
    expect(onDuck).toHaveBeenLastCalledWith(false);
    press('runner-duck', 'pointerdown');
    press('runner-duck', 'pointerleave');
    expect(onDuck).toHaveBeenLastCalledWith(false);

    controls.destroy();
    expect(root.querySelector('[data-testid="runner-controls"]')).toBeNull();
  });
});
