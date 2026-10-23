import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  AccountError,
  AccountService,
  DELETE_PHRASE,
  exportFileName,
  localKeysToClear,
} from '../../src/state/AccountService';
import type { AccountApi, AccountExport } from '../../src/state/AccountService';
import { AccountScreen } from '../../src/engine/ui/AccountScreen';

const SAMPLE: AccountExport = {
  exportedAt: '2026-10-23T12:00:00Z',
  account: { email: 'ana@exemplo.test', createdAt: '2026-10-01T10:00:00Z' },
  profile: { id: 'u1', nickname: 'ana' },
  groups: [],
  games: [{ id: 'g1' }],
  answers: [],
  sessions: [],
  reports: [],
};

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => void data.delete(key),
    keys: () => [...data.keys()],
  };
}

function fakeClient(rpc: (name: string) => Promise<{ data?: unknown; error?: { message: string } | null }>) {
  const signOut = vi.fn(async () => ({ error: null }));
  const client = {
    rpc: vi.fn(async (name: string) => ({ data: null, error: null, ...(await rpc(name)) })),
    auth: { signOut },
  };
  return { client: client as unknown as SupabaseClient, rpc: client.rpc, signOut };
}

describe('account helpers', () => {
  it('clears what the game saved in the browser, but keeps the theme choice', () => {
    expect(localKeysToClear(['qh.outbox.v1.u1', 'qh.focusRoom.v1', 'cq.secrets.v1', 'qh.theme', 'outra.coisa', 'sb-x-auth-token'])).toEqual([
      'qh.outbox.v1.u1',
      'qh.focusRoom.v1',
      'cq.secrets.v1',
    ]);
  });

  it('names the file with the date', () => {
    expect(exportFileName(new Date('2026-10-23T15:30:00Z'))).toBe('studygarage-meus-dados-2026-10-23.json');
  });
});

describe('AccountService', () => {
  it('exports through export_my_data and hands the data back', async () => {
    const { client, rpc } = fakeClient(async () => ({ data: SAMPLE }));
    expect(await new AccountService(client, null).exportData()).toEqual(SAMPLE);
    expect(rpc).toHaveBeenCalledWith('export_my_data');
  });

  it('says so in plain words when the export fails, never the raw server text', async () => {
    const failed = fakeClient(async () => ({ error: { message: 'permission denied for table x' } }));
    await expect(new AccountService(failed.client, null).exportData()).rejects.toThrow('Não foi possível reunir');
    const offline = fakeClient(async () => {
      throw new Error('Failed to fetch');
    });
    await expect(new AccountService(offline.client, null).exportData()).rejects.toBeInstanceOf(AccountError);
  });

  it('deleting the account calls delete_my_account, then wipes the browser and signs out', async () => {
    const storage = memoryStorage({
      'qh.outbox.v1.u1': '[]',
      'qh.theme': 'day',
      'sb-abc-auth-token': '{"x":1}',
      'cq.secrets.v1': '[]',
      'nao-e-nosso': '1',
    });
    const { client, rpc, signOut } = fakeClient(async () => ({}));
    await new AccountService(client, storage).deleteAccount();
    expect(rpc).toHaveBeenCalledWith('delete_my_account');
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(storage.keys().sort()).toEqual(['nao-e-nosso', 'qh.theme']);
  });

  it('keeps everything when the server refuses to delete', async () => {
    const storage = memoryStorage({ 'qh.outbox.v1.u1': '[]' });
    const { client, signOut } = fakeClient(async () => ({ error: { message: 'boom' } }));
    await expect(new AccountService(client, storage).deleteAccount()).rejects.toThrow('Nada foi apagado');
    expect(storage.keys()).toEqual(['qh.outbox.v1.u1']);
    expect(signOut).not.toHaveBeenCalled();
  });
});

describe('AccountScreen', () => {
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

  const q = (testId: string) => root.querySelector<HTMLElement>(`[data-testid="${testId}"]`)!;
  const flush = async () => {
    await vi.advanceTimersByTimeAsync(0);
  };

  function setup(api: Partial<AccountApi> = {}) {
    const full: AccountApi = {
      exportData: vi.fn(async () => SAMPLE),
      deleteAccount: vi.fn(async () => undefined),
      ...api,
    };
    const download = vi.fn();
    const onDeleted = vi.fn();
    const screen = new AccountScreen(root, { api: full, email: 'ana@exemplo.test', download, onDeleted });
    const button = screen.mountButton();
    return { screen, button, api: full, download, onDeleted };
  }

  it('adds a "Conta" button to the corner that opens the card, showing the e-mail', () => {
    const { button } = setup();
    expect(button.textContent).toBe('Conta');
    expect(q('account-screen')).toBeNull();
    button.click();
    expect(q('account-screen').getAttribute('role')).toBe('dialog');
    expect(q('account-email').textContent).toBe('ana@exemplo.test');
    expect((q('account-policy') as HTMLAnchorElement).getAttribute('href')).toContain('privacidade');
  });

  it('downloads the data as a JSON file named with the date', async () => {
    const { button, download, api } = setup();
    button.click();
    q('account-export').click();
    await flush();
    expect(api.exportData).toHaveBeenCalledOnce();
    expect(download).toHaveBeenCalledOnce();
    const [name, content] = download.mock.calls[0] as [string, string];
    expect(name).toMatch(/^studygarage-meus-dados-\d{4}-\d{2}-\d{2}\.json$/);
    expect(JSON.parse(content)).toEqual(SAMPLE);
    expect(q('account-status').textContent).toContain('arquivo foi baixado');
  });

  it('shows a friendly message when the export fails and lets the player try again', async () => {
    const { button, download } = setup({ exportData: vi.fn(async () => Promise.reject(new AccountError('Sem conexão com o servidor. Tente de novo.'))) });
    button.click();
    q('account-export').click();
    await flush();
    expect(download).not.toHaveBeenCalled();
    expect(q('account-status').textContent).toBe('Sem conexão com o servidor. Tente de novo.');
    expect((q('account-export') as HTMLButtonElement).disabled).toBe(false);
  });

  it('warns about what is deleted, including the groups the player created', () => {
    const { button } = setup();
    button.click();
    const text = q('account-screen').textContent ?? '';
    expect(text).toContain('Não dá para desfazer');
    expect(text).toContain('Se você criou algum grupo, ele também é apagado');
  });

  it('only unlocks the delete button when the exact word is typed', () => {
    const { button } = setup();
    button.click();
    const input = q('account-confirm') as HTMLInputElement;
    const del = q('account-delete') as HTMLButtonElement;
    expect(del.disabled).toBe(true);
    for (const wrong of ['', 'exclu', 'EXCLUIR!', 'APAGAR']) {
      input.value = wrong;
      input.dispatchEvent(new Event('input'));
      expect(del.disabled, wrong).toBe(true);
    }
    input.value = ` ${DELETE_PHRASE} `;
    input.dispatchEvent(new Event('input'));
    expect(del.disabled).toBe(false);
  });

  it('deletes the account, says so, and goes back to the start', async () => {
    const { button, api, onDeleted } = setup();
    button.click();
    const input = q('account-confirm') as HTMLInputElement;
    input.value = DELETE_PHRASE;
    input.dispatchEvent(new Event('input'));
    q('account-delete').click();
    await flush();
    expect(api.deleteAccount).toHaveBeenCalledOnce();
    expect(q('account-status').textContent).toContain('Conta excluída');
    expect(onDeleted).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1300);
    expect(onDeleted).toHaveBeenCalledOnce();
  });

  it('when deleting fails, nothing is lost and the player can try again', async () => {
    const { button, onDeleted } = setup({ deleteAccount: vi.fn(async () => Promise.reject(new AccountError('Nada foi apagado.'))) });
    button.click();
    const input = q('account-confirm') as HTMLInputElement;
    input.value = DELETE_PHRASE;
    input.dispatchEvent(new Event('input'));
    q('account-delete').click();
    await flush();
    expect(q('account-status').textContent).toBe('Nada foi apagado.');
    expect(input.disabled).toBe(false);
    expect((q('account-delete') as HTMLButtonElement).disabled).toBe(false);
    await vi.advanceTimersByTimeAsync(2000);
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('Esc and the close button close the card and give the focus back', () => {
    const { button } = setup();
    button.click();
    q('account-screen').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(q('account-screen')).toBeNull();
    expect(document.activeElement).toBe(button);
    button.click();
    q('account-close').click();
    expect(q('account-screen')).toBeNull();
  });
});
