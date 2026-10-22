import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GroupError, GroupService, friendlyGroupError, parseInviteToken } from '../../src/state/GroupService';
import type { GroupInfo, GroupsApi, MemberInfo } from '../../src/state/GroupService';
import { captureInviteFromUrl, takePendingInvite } from '../../src/state/inviteLink';
import { GroupsScreen } from '../../src/engine/ui/GroupsScreen';

const TOKEN = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

function holder(initial: string | null = null) {
  let active = initial;
  return {
    setActiveGroup: vi.fn((id: string | null) => void (active = id)),
    getActiveGroup: () => active,
  };
}

type DbError = { message: string } | null;

function fakeClient(opts: { rpc?: (name: string, args: unknown) => { data?: unknown; error?: DbError }; rows?: unknown[] } = {}) {
  const eq = vi.fn(async () => ({ data: opts.rows ?? [], error: null as DbError }));
  const select = vi.fn(() => ({ eq }));
  const rpc = vi.fn(async (name: string, args: unknown) => ({ data: null, error: null, ...(opts.rpc?.(name, args) ?? {}) }));
  const client = { rpc, from: vi.fn(() => ({ select })) } as unknown as SupabaseClient;
  return { client, rpc, eq };
}

describe('parseInviteToken', () => {
  it('accepts the bare code or a full link and nothing else', () => {
    expect(parseInviteToken(` ${TOKEN} `)).toBe(TOKEN);
    expect(parseInviteToken(`https://exemplo.app/jogo/?convite=${TOKEN}`)).toBe(TOKEN);
    expect(parseInviteToken(`https://exemplo.app/?x=1&convite=${TOKEN}#abc`)).toBe(TOKEN);
    expect(parseInviteToken('curto')).toBeNull();
    expect(parseInviteToken('https://exemplo.app/?convite=curto')).toBeNull();
    expect(parseInviteToken('')).toBeNull();
  });
});

describe('friendlyGroupError', () => {
  it('says what happened in plain Portuguese and never shows raw server text', () => {
    expect(friendlyGroupError('invite expired')).toContain('expirou');
    expect(friendlyGroupError('invite exhausted')).toContain('máximo');
    expect(friendlyGroupError('invalid invite')).toContain('não encontrado');
    expect(friendlyGroupError('permission denied for table x')).toBe('Não foi possível concluir agora. Tente de novo.');
  });
});

describe('GroupService', () => {
  it('lists only my groups, marks the active one and sorts by name', async () => {
    const { client, eq } = fakeClient({
      rows: [
        { role: 'member', groups: { id: 'g2', name: 'Zeta' } },
        { role: 'owner', groups: [{ id: 'g1', name: 'Alfa' }] },
        { role: 'member', groups: null },
      ],
    });
    const service = new GroupService(client, holder('g2'), 'u1', 'https://x.app/');
    const groups = await service.list();
    expect(eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(groups).toEqual([
      { id: 'g1', name: 'Alfa', role: 'owner', active: false },
      { id: 'g2', name: 'Zeta', role: 'member', active: true },
    ]);
  });

  it('creates a group (trimmed) and makes it the active one', async () => {
    const h = holder();
    const { client, rpc } = fakeClient({ rpc: () => ({ data: 'g9' }) });
    await new GroupService(client, h, 'u1').create('  Equipe   Azul ');
    expect(rpc).toHaveBeenCalledWith('create_group', { p_name: 'Equipe Azul' });
    expect(h.getActiveGroup()).toBe('g9');
  });

  it('rejects a bad group name before calling the server', async () => {
    const { client, rpc } = fakeClient();
    const service = new GroupService(client, holder(), 'u1');
    await expect(service.create('a')).rejects.toBeInstanceOf(GroupError);
    await expect(service.create('x'.repeat(41))).rejects.toThrow('2 a 40');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('joins with a link, activates the group, and turns server errors into friendly ones', async () => {
    const h = holder();
    const ok = fakeClient({ rpc: () => ({ data: 'g3' }) });
    await new GroupService(ok.client, h, 'u1').join(`https://x.app/?convite=${TOKEN}`);
    expect(ok.rpc).toHaveBeenCalledWith('redeem_invite', { p_token: TOKEN });
    expect(h.getActiveGroup()).toBe('g3');

    const expired = fakeClient({ rpc: () => ({ error: { message: 'invite expired' } }) });
    await expect(new GroupService(expired.client, holder(), 'u1').join(TOKEN)).rejects.toThrow('expirou');
    await expect(new GroupService(expired.client, holder(), 'u1').join('lixo')).rejects.toThrow('não encontrado');
    expect(expired.rpc).toHaveBeenCalledTimes(1);
  });

  it('builds a shareable invite link', async () => {
    const { client } = fakeClient({ rpc: () => ({ data: TOKEN }) });
    const link = await new GroupService(client, holder(), 'u1', 'https://x.app/jogo/').invite('g1');
    expect(link).toBe(`https://x.app/jogo/?convite=${TOKEN}`);
    expect(parseInviteToken(link)).toBe(TOKEN);
  });

  it('leaving the active group clears it', async () => {
    const h = holder('g1');
    const { client } = fakeClient();
    await new GroupService(client, h, 'u1').leave('g1');
    expect(h.getActiveGroup()).toBeNull();
  });

  it('ensureActive keeps a valid choice, otherwise falls back to the first group or none', async () => {
    const rows = [
      { role: 'owner', groups: { id: 'g1', name: 'Alfa' } },
      { role: 'member', groups: { id: 'g2', name: 'Beta' } },
    ];
    const keep = holder('g2');
    expect((await new GroupService(fakeClient({ rows }).client, keep, 'u1').ensureActive())?.id).toBe('g2');

    const removed = holder('g-antigo');
    expect((await new GroupService(fakeClient({ rows }).client, removed, 'u1').ensureActive())?.id).toBe('g1');
    expect(removed.getActiveGroup()).toBe('g1');

    const none = holder('g1');
    expect(await new GroupService(fakeClient({ rows: [] }).client, none, 'u1').ensureActive()).toBeNull();
    expect(none.getActiveGroup()).toBeNull();
  });
});

describe('invite link capture', () => {
  it('remembers the code, cleans the address and hands it over only once', () => {
    const storage = memoryStorage();
    const replaceState = vi.fn();
    const token = captureInviteFromUrl(
      storage,
      { search: `?a=1&convite=${TOKEN}`, pathname: '/jogo/', hash: '#x' },
      { replaceState },
    );
    expect(token).toBe(TOKEN);
    expect(replaceState).toHaveBeenCalledWith(null, '', '/jogo/?a=1#x');
    expect(takePendingInvite(storage)).toBe(TOKEN);
    expect(takePendingInvite(storage)).toBeNull();
  });

  it('ignores addresses without an invite and never stores a malformed code', () => {
    const storage = memoryStorage();
    const replaceState = vi.fn();
    expect(captureInviteFromUrl(storage, { search: '', pathname: '/', hash: '' }, { replaceState })).toBeNull();
    expect(replaceState).not.toHaveBeenCalled();
    expect(captureInviteFromUrl(storage, { search: '?convite=%3Cscript%3E', pathname: '/', hash: '' }, { replaceState })).toBeNull();
    expect(takePendingInvite(storage)).toBeNull();
  });
});

describe('GroupsScreen', () => {
  let root: HTMLElement;
  let screen: GroupsScreen;
  const onBack = vi.fn();

  const members: MemberInfo[] = [
    { userId: 'u1', nickname: 'ana', role: 'owner', me: true },
    { userId: 'u2', nickname: null, role: 'member', me: false },
  ];

  function fakeApi(groups: GroupInfo[]): GroupsApi & { calls: string[] } {
    const calls: string[] = [];
    return {
      calls,
      list: vi.fn(async () => groups),
      create: vi.fn(async (name: string) => void calls.push(`create:${name}`)),
      join: vi.fn(async (code: string) => {
        calls.push(`join:${code}`);
        if (code === 'ruim') throw new GroupError('Convite não encontrado.');
      }),
      use: vi.fn((id: string) => void calls.push(`use:${id}`)),
      invite: vi.fn(async () => `https://x.app/?convite=${TOKEN}`),
      members: vi.fn(async () => members),
      removeMember: vi.fn(async (_g: string, u: string) => void calls.push(`remove:${u}`)),
      leave: vi.fn(async (id: string) => void calls.push(`leave:${id}`)),
    };
  }

  const q = (testId: string) => root.querySelector<HTMLElement>(`[data-testid="${testId}"]`)!;
  const qa = (testId: string) => [...root.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`)];
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    onBack.mockClear();
    root = document.createElement('div');
    document.body.appendChild(root);
    screen = new GroupsScreen(root);
  });
  afterEach(() => {
    screen.hide();
    root.remove();
  });

  it('shows an empty state when there are no groups', async () => {
    await screen.show(fakeApi([]), { onBack });
    expect(q('groups-empty')).not.toBeNull();
  });

  it('lists groups with the right actions for owner and member, and marks the active one', async () => {
    await screen.show(
      fakeApi([
        { id: 'g1', name: 'Alfa', role: 'owner', active: true },
        { id: 'g2', name: 'Beta', role: 'member', active: false },
      ]),
      { onBack },
    );
    const cards = qa('group-card');
    expect(cards).toHaveLength(2);
    expect(cards[0].querySelector('[data-testid="group-active"]')).not.toBeNull();
    expect(cards[0].querySelector('[data-testid="group-invite"]')).not.toBeNull();
    expect(cards[0].querySelector('[data-testid="group-leave"]')).toBeNull();
    expect(cards[0].querySelector('[data-testid="group-use"]')).toBeNull();
    expect(cards[1].querySelector('[data-testid="group-use"]')).not.toBeNull();
    expect(cards[1].querySelector('[data-testid="group-leave"]')).not.toBeNull();
    expect(cards[1].querySelector('[data-testid="group-invite"]')).toBeNull();
  });

  it('switching the active group calls the api and tells the caller', async () => {
    const api = fakeApi([{ id: 'g2', name: 'Beta', role: 'member', active: false }]);
    const onActiveChanged = vi.fn();
    await screen.show(api, { onBack, onActiveChanged });
    q('group-use').click();
    expect(api.calls).toContain('use:g2');
    expect(onActiveChanged).toHaveBeenCalled();
  });

  it('shows an invite link to copy, and members with a remove button only for the owner', async () => {
    const api = fakeApi([{ id: 'g1', name: 'Alfa', role: 'owner', active: true }]);
    await screen.show(api, { onBack });

    q('group-invite').click();
    await flush();
    expect((q('group-invite-link') as HTMLInputElement).value).toBe(`https://x.app/?convite=${TOKEN}`);

    q('group-members').click();
    await flush();
    expect(qa('group-member')).toHaveLength(2);
    expect(q('group-member-list').textContent).toContain('ana (você)');
    expect(q('group-member-list').textContent).toContain('Sem apelido ainda');
    const remove = qa('group-remove');
    expect(remove).toHaveLength(1); // not for yourself
    remove[0].click();
    await flush();
    expect(api.calls).toContain('remove:u2');
  });

  it('a member needs two clicks to leave a group', async () => {
    const api = fakeApi([{ id: 'g2', name: 'Beta', role: 'member', active: false }]);
    await screen.show(api, { onBack });
    q('group-leave').click();
    expect(api.calls).not.toContain('leave:g2');
    q('group-leave').click();
    await flush();
    expect(api.calls).toContain('leave:g2');
  });

  it('create and join forms send what was typed and show friendly errors', async () => {
    const api = fakeApi([]);
    await screen.show(api, { onBack });

    (q('group-create-input') as HTMLInputElement).value = 'Equipe Azul';
    q('group-create-form').dispatchEvent(new Event('submit', { cancelable: true }));
    await flush();
    expect(api.calls).toContain('create:Equipe Azul');

    (q('group-join-input') as HTMLInputElement).value = 'ruim';
    q('group-join-form').dispatchEvent(new Event('submit', { cancelable: true }));
    await flush();
    expect(q('groups-message').textContent).toBe('Convite não encontrado.');
  });

  it('Esc goes back', async () => {
    await screen.show(fakeApi([]), { onBack });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onBack).toHaveBeenCalled();
  });
});
