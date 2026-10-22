import { describe, expect, it, vi } from 'vitest';
import { CAST, allCameoLines, avatarFrameFor, pickCameo } from '../../src/engine/cast';
import type { CameoTrigger } from '../../src/engine/cast';
import { ClickCounter, KONAMI, SequenceMatcher, BOSS_WORD, consoleGreeting } from '../../src/engine/easterEggs';

const TRIGGERS: CameoTrigger[] = [
  'menu',
  'correct',
  'streak',
  'wrong',
  'phase',
  'ceiling',
  'complete',
  'perfect',
  'gameover',
  'coin',
  'chefe',
  'konami',
];

describe('cast and cameos', () => {
  it('every trigger yields a cast member with a line, whatever the random draw', () => {
    for (const trigger of TRIGGERS) {
      for (const roll of [0, 0.37, 0.99999]) {
        const cameo = pickCameo(trigger, { stage: 2 }, () => roll);
        expect(cameo.line.length).toBeGreaterThan(5);
        expect(Object.values(CAST)).toContain(cameo.who);
      }
    }
  });

  it('the boss is the executive director, with her own face, and the menu line follows the readiness stage', () => {
    expect(CAST.chefe).toMatchObject({ name: 'Dona Vera', role: 'Dir. Executiva' });
    const faces = Object.values(CAST).map((member) => member.frame);
    expect(new Set(faces).size).toBe(faces.length); // nobody shares a face
    const last = pickCameo('menu', { stage: 4 }, () => 0);
    expect(last.line).toBe('Pronto pra prova. Vai lá.');
    expect(pickCameo('menu', { stage: 99 }, () => 0).line).toBe(last.line); // clamped
    expect(pickCameo('menu', { stage: -3 }, () => 0).who.id).toBe('chefe');
  });

  it('on Fridays the menu sometimes brings the Friday lines', () => {
    expect(pickCameo('menu', { stage: 0, friday: true }, () => 0.1).line).toContain('Sextou');
    expect(pickCameo('menu', { stage: 0, friday: false }, () => 0.1).line).not.toContain('Sextou');
  });

  it('the Konami cameo is the boss', () => {
    expect(pickCameo('konami').who.id).toBe('chefe');
  });

  it("speakers in the questions get a stable face that is never the boss's", () => {
    const names = ['Patrícia Menezes — Coordenadora de Regulatório', 'Aline Cardoso — Analista de Câmbio', 'x', ''];
    for (const name of names) {
      expect(avatarFrameFor(name)).toBe(avatarFrameFor(name));
      expect(avatarFrameFor(name)).not.toBe(CAST.chefe.frame);
      expect(avatarFrameFor(name)).toBeGreaterThanOrEqual(0);
      expect(avatarFrameFor(name)).toBeLessThan(8);
    }
  });

  it('no line makes a promise or states exam facts (keeps the jokes harmless)', () => {
    const lines = allCameoLines();
    expect(lines.length).toBeGreaterThan(30);
    for (const line of lines) {
      expect(line).not.toMatch(/\b(prometo|vou pagar|bônus|aumento|promoção|COAF|BACEN|R\$)\b/i);
      expect(line.length).toBeLessThan(90); // fits a speech bubble
    }
  });
});

describe('easter eggs', () => {
  it('Konami fires once on the full sequence and not on a partial one', () => {
    const onMatch = vi.fn();
    const matcher = new SequenceMatcher(KONAMI, onMatch);
    KONAMI.slice(0, 9).forEach((code, i) => matcher.feed(code, i * 100));
    expect(onMatch).not.toHaveBeenCalled();
    matcher.feed('KeyA', 1000);
    expect(onMatch).toHaveBeenCalledTimes(1);
  });

  it('a wrong key resets, but a repeated first key keeps the sequence alive', () => {
    const onMatch = vi.fn();
    const matcher = new SequenceMatcher(KONAMI, onMatch);
    // extra ↑ before the real start, then a stray key, then the full code
    ['ArrowUp', 'KeyZ'].forEach((code, i) => matcher.feed(code, i * 10));
    KONAMI.forEach((code, i) => matcher.feed(code, 100 + i * 10));
    expect(onMatch).toHaveBeenCalledTimes(1);

    const second = vi.fn();
    const m2 = new SequenceMatcher(KONAMI, second);
    ['ArrowUp', 'ArrowUp', 'ArrowUp'].forEach((code, i) => m2.feed(code, i * 10)); // ↑↑↑ then the rest
    KONAMI.slice(2).forEach((code, i) => m2.feed(code, 100 + i * 10));
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('too long a pause between keys starts over', () => {
    const onMatch = vi.fn();
    const matcher = new SequenceMatcher(BOSS_WORD, onMatch, 1000);
    matcher.feed('KeyC', 0);
    matcher.feed('KeyH', 5000); // too late
    matcher.feed('KeyE', 5100);
    expect(onMatch).not.toHaveBeenCalled();
    BOSS_WORD.forEach((code, i) => matcher.feed(code, 10000 + i * 100));
    expect(onMatch).toHaveBeenCalledTimes(1);
  });

  it('five quick clicks trigger, slow ones do not, and the counter resets after a trigger', () => {
    const counter = new ClickCounter(5, 3000);
    expect([0, 100, 200, 300].map((t) => counter.click(t))).toEqual([false, false, false, false]);
    expect(counter.click(400)).toBe(true);
    expect(counter.click(500)).toBe(false); // starts over

    const slow = new ClickCounter(5, 3000);
    expect([0, 1500, 3000, 4500, 6000].map((t) => slow.click(t))).toEqual([false, false, false, false, false]);
  });

  it('has a console greeting', () => {
    expect(consoleGreeting().join(' ')).toMatch(/Konami/);
  });
});
