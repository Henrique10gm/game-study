// The hidden things of the menu, and which ones this player already found.
// Pure bookkeeping; the scene decides what each one looks like.

export const SECRET_IDS = [
  'konami', // ↑ ↑ ↓ ↓ ← → ← → B A
  'chefe', // typing "chefe"
  'sign', // five clicks on the bank sign
  'coin', // five pokes on the coin
  'lamp', // the street lamp
  'star', // the shooting star
  'car', // the passing car
  'cat', // the cat that wanders the bank floor
  'jump', // ten jumps in a row
] as const;

export type SecretId = (typeof SECRET_IDS)[number];

export interface SecretsView {
  found: number;
  total: number;
}

const STORAGE_KEY = 'cq.secrets.v1';

export class Secrets {
  private readonly found = new Set<SecretId>();

  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeStorage()) {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      const list: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(list)) {
        for (const id of list) if ((SECRET_IDS as readonly unknown[]).includes(id)) this.found.add(id as SecretId);
      }
    } catch {
      // unreadable storage: start with nothing found
    }
  }

  view(): SecretsView {
    return { found: this.found.size, total: SECRET_IDS.length };
  }

  has(id: SecretId): boolean {
    return this.found.has(id);
  }

  /** Marks a secret as found. `isNew` is true only the first time. */
  discover(id: SecretId): SecretsView & { isNew: boolean; all: boolean } {
    const isNew = !this.found.has(id);
    if (isNew) {
      this.found.add(id);
      try {
        this.storage?.setItem(STORAGE_KEY, JSON.stringify([...this.found]));
      } catch {
        // the counter just resets next time
      }
    }
    const view = this.view();
    return { ...view, isNew, all: isNew && view.found === view.total };
  }
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
