import { afterEach, describe, expect, it } from 'vitest';
import { isUprightPhone, watchOrientation } from '../../src/engine/ui/orientationHint';

describe('orientation hint', () => {
  it('only an upright phone gets the hint (a laptop or a turned phone does not)', () => {
    expect(isUprightPhone(390, 844)).toBe(true);
    expect(isUprightPhone(844, 390)).toBe(false);
    expect(isUprightPhone(1280, 800)).toBe(false);
    expect(isUprightPhone(768, 1024)).toBe(false); // tablets are wide enough
  });

  describe('in the page', () => {
    let root: HTMLElement;
    afterEach(() => root.remove());

    const setSize = (width: number, height: number) => {
      Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: height, configurable: true });
      window.dispatchEvent(new Event('resize'));
    };

    it('shows on an upright phone, leaves when turned, and can be closed', () => {
      root = document.createElement('div');
      document.body.appendChild(root);
      setSize(390, 844);
      watchOrientation(root);
      expect(root.querySelector('[data-testid="orientation-hint"]')).not.toBeNull();

      setSize(844, 390);
      expect(root.querySelector('[data-testid="orientation-hint"]')).toBeNull();

      setSize(390, 844);
      root.querySelector<HTMLButtonElement>('[data-testid="orientation-hint"] button')?.click();
      expect(root.querySelector('[data-testid="orientation-hint"]')).toBeNull();
      setSize(390, 850); // stays closed
      expect(root.querySelector('[data-testid="orientation-hint"]')).toBeNull();
    });
  });
});
