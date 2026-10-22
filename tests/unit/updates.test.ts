import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UpdateNotice } from '../../src/engine/ui/UpdateNotice';
import { UPDATES, markUpdateSeen, pendingUpdate } from '../../src/engine/updates';
import type { GameUpdate } from '../../src/engine/updates';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

const old: GameUpdate = { id: 'antiga', date: '01/01/2026', title: 'Antiga', highlights: ['a'] };
const fresh: GameUpdate = { id: 'nova', date: '02/01/2026', title: 'Nova', highlights: ['b', 'c'], also: ['d'] };

describe('what is new', () => {
  it('has at least one entry, every one with an id, a title and highlights', () => {
    expect(UPDATES.length).toBeGreaterThan(0);
    expect(new Set(UPDATES.map((u) => u.id)).size).toBe(UPDATES.length);
    for (const update of UPDATES) {
      expect(update.title.trim()).not.toBe('');
      expect(update.highlights.length).toBeGreaterThan(0);
    }
  });

  it('announces the newest update until the player has seen it, then stays quiet', () => {
    const storage = memoryStorage();
    expect(pendingUpdate(storage, [fresh, old])).toBe(fresh);
    markUpdateSeen(storage, fresh);
    expect(pendingUpdate(storage, [fresh, old])).toBeNull();
  });

  it('announces again when a newer update ships', () => {
    const storage = memoryStorage();
    markUpdateSeen(storage, old);
    expect(pendingUpdate(storage, [fresh, old])).toBe(fresh);
  });

  it('shows the notice when storage is blocked, and never throws', () => {
    expect(pendingUpdate(null, [fresh])).toBe(fresh);
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(pendingUpdate(broken, [fresh])).toBe(fresh);
    expect(() => markUpdateSeen(broken, fresh)).not.toThrow();
  });

  it('has nothing to announce without updates', () => {
    expect(pendingUpdate(memoryStorage(), [])).toBeNull();
  });
});

describe('UpdateNotice', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
  });
  afterEach(() => root.remove());

  const keydown = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));

  it('lists the news and the smaller things, as text only', () => {
    void new UpdateNotice(root).show(fresh);
    const card = root.querySelector('[data-testid="update-notice"]')!;
    expect(card.querySelector('.upd-title')?.textContent).toBe('Nova');
    expect([...card.querySelectorAll('.upd-list li')].map((li) => li.textContent)).toEqual(['b', 'c', 'd']);
    expect(card.textContent).toContain('Também chegou');
    (root.querySelector('[data-testid="update-notice-go"]') as HTMLButtonElement).click(); // frees the key handler
  });

  it('closes with the button and resolves', async () => {
    const done = new UpdateNotice(root).show(fresh);
    (root.querySelector('[data-testid="update-notice-go"]') as HTMLButtonElement).click();
    await done;
    expect(root.querySelector('[data-testid="update-notice"]')).toBeNull();
  });

  it('closes with Enter, and keeps the keys away from the game while it is open', async () => {
    const reached: string[] = [];
    const spy = (event: KeyboardEvent) => reached.push(event.code);
    window.addEventListener('keydown', spy);
    const done = new UpdateNotice(root).show(fresh);
    keydown('ArrowRight');
    keydown('Enter');
    await done;
    expect(reached).toEqual([]);
    keydown('ArrowRight');
    expect(reached).toEqual(['ArrowRight']);
    window.removeEventListener('keydown', spy);
  });
});
