// The player's rights over their own data (LGPD): download a copy of everything stored about
// them, and delete the account. Both go through SQL functions that only ever touch the rows of
// the signed-in person (export_my_data, delete_my_account); this class just calls them and
// cleans the browser afterwards.
import type { SupabaseClient } from '@supabase/supabase-js';

/** An error whose message is already written for the player. */
export class AccountError extends Error {}

export interface AccountExport {
  exportedAt: string;
  account: { email: string | null; createdAt: string } | null;
  profile: Record<string, unknown> | null;
  groups: unknown[];
  games: unknown[];
  answers: unknown[];
  sessions: unknown[];
  reports: unknown[];
}

/** What the screens need; AccountService implements it (and tests fake it). */
export interface AccountApi {
  exportData(): Promise<AccountExport>;
  deleteAccount(): Promise<void>;
}

/** The phrase typed to confirm that the account is really to be deleted. */
export const DELETE_PHRASE = 'EXCLUIR';

/** Browser storage keys this game wrote (the theme choice stays: it is not personal data). */
export function localKeysToClear(keys: readonly string[]): string[] {
  return keys.filter((key) => (key.startsWith('qh.') || key.startsWith('cq.')) && key !== 'qh.theme');
}

export function exportFileName(now: Date = new Date()): string {
  return `studygarage-meus-dados-${now.toISOString().slice(0, 10)}.json`;
}

type StorageLike = Pick<Storage, 'removeItem' | 'key' | 'length'>;

export class AccountService implements AccountApi {
  constructor(
    private readonly client: SupabaseClient,
    private readonly storage: StorageLike | null = browserStorage(),
  ) {}

  async exportData(): Promise<AccountExport> {
    let result;
    try {
      result = await this.client.rpc('export_my_data');
    } catch {
      throw new AccountError('Sem conexão com o servidor. Tente de novo.');
    }
    if (result.error || !result.data) throw new AccountError('Não foi possível reunir os seus dados agora. Tente de novo.');
    return result.data as AccountExport;
  }

  async deleteAccount(): Promise<void> {
    let result;
    try {
      result = await this.client.rpc('delete_my_account');
    } catch {
      throw new AccountError('Sem conexão com o servidor. A conta não foi excluída.');
    }
    if (result.error) throw new AccountError('Não foi possível excluir a conta agora. Nada foi apagado. Tente de novo.');
    this.clearBrowser();
    try {
      await this.client.auth.signOut({ scope: 'local' });
    } catch {
      // the account is already gone; the saved sign-in is cleared below anyway
    }
    this.clearBrowser();
  }

  /** Removes what this game saved in the browser (progress queue, choices, the saved sign-in). */
  private clearBrowser(): void {
    const storage = this.storage;
    if (!storage) return;
    try {
      const keys: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key) keys.push(key);
      }
      for (const key of [...localKeysToClear(keys), ...keys.filter((key) => /^sb-.+-auth-token/.test(key))]) {
        storage.removeItem(key);
      }
    } catch {
      // storage blocked: nothing else to clean
    }
  }
}

function browserStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
