// Groups (team / company) on Supabase: create, invite link, join, leave, members and
// the "active group" the ranking is read from. All writes go through the SQL functions
// (create_group, create_invite, redeem_invite, ...) which check who is allowed to do
// what; this class only calls them and translates the answers for the player.
import type { SupabaseClient } from '@supabase/supabase-js';

export interface GroupInfo {
  id: string;
  name: string;
  role: 'owner' | 'member';
  active: boolean;
}

export interface MemberInfo {
  userId: string;
  nickname: string | null;
  role: 'owner' | 'member';
  me: boolean;
}

/** What the screens need; GroupService implements it (and tests fake it). */
export interface GroupsApi {
  list(): Promise<GroupInfo[]>;
  create(name: string): Promise<void>;
  join(codeOrLink: string): Promise<void>;
  use(groupId: string): void;
  invite(groupId: string): Promise<string>;
  members(groupId: string): Promise<MemberInfo[]>;
  removeMember(groupId: string, userId: string): Promise<void>;
  leave(groupId: string): Promise<void>;
}

/** The part of the cloud store that remembers the active group. */
export interface ActiveGroupHolder {
  setActiveGroup(groupId: string | null): void;
  getActiveGroup(): string | null;
}

/** An error whose message is already written for the player. */
export class GroupError extends Error {}

export const INVITE_PARAM = 'convite';
export const MIN_GROUP_NAME = 2;
export const MAX_GROUP_NAME = 40;

const TOKEN_RE = /^[A-Za-z0-9]{16,128}$/;

/** Accepts the bare code or a full invite link; returns null when it is neither. */
export function parseInviteToken(input: string): string | null {
  const text = input.trim();
  if (TOKEN_RE.test(text)) return text;
  const fromLink = new RegExp(`[?&#]${INVITE_PARAM}=([A-Za-z0-9]+)`).exec(text);
  return fromLink && TOKEN_RE.test(fromLink[1]) ? fromLink[1] : null;
}

export function friendlyGroupError(message: string | undefined): string {
  const text = (message ?? '').toLowerCase();
  if (text.includes('invite expired')) return 'Esse convite expirou. Peça um novo para quem administra o grupo.';
  if (text.includes('invite exhausted')) return 'Esse convite já foi usado o máximo de vezes. Peça um novo.';
  if (text.includes('invalid invite')) return 'Convite não encontrado. Confira o código ou o link.';
  if (text.includes('group limit')) return 'Você já tem o máximo de grupos que pode criar.';
  if (text.includes('not group owner')) return 'Só quem criou o grupo pode fazer isso.';
  if (text.includes('owner cannot leave')) return 'Quem criou o grupo não pode sair dele.';
  if (text.includes('not authenticated')) return 'Sua sessão expirou. Entre de novo.';
  return 'Não foi possível concluir agora. Tente de novo.';
}

interface MembershipRow {
  role: 'owner' | 'member';
  groups: { id: string; name: string } | { id: string; name: string }[] | null;
}

interface MemberRow {
  user_id: string;
  nickname: string | null;
  role: 'owner' | 'member';
  me: boolean;
}

export class GroupService implements GroupsApi {
  constructor(
    private readonly client: SupabaseClient,
    private readonly holder: ActiveGroupHolder,
    private readonly userId: string,
    private readonly baseUrl: string = `${window.location.origin}${window.location.pathname}`,
  ) {}

  private async rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    let result;
    try {
      result = await this.client.rpc(name, args);
    } catch {
      throw new GroupError('Sem conexão com o servidor. Tente de novo.');
    }
    if (result.error) throw new GroupError(friendlyGroupError(result.error.message));
    return result.data as T;
  }

  async list(): Promise<GroupInfo[]> {
    const { data, error } = await this.client
      .from('memberships')
      .select('role, groups(id, name)')
      .eq('user_id', this.userId);
    if (error) throw new GroupError('Não foi possível carregar seus grupos agora.');
    const active = this.holder.getActiveGroup();
    const groups: GroupInfo[] = [];
    for (const row of (data ?? []) as unknown as MembershipRow[]) {
      const group = Array.isArray(row.groups) ? row.groups[0] : row.groups;
      if (group) groups.push({ id: group.id, name: group.name, role: row.role, active: group.id === active });
    }
    return groups.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  async create(name: string): Promise<void> {
    const clean = name.trim().replace(/\s+/g, ' ');
    if (clean.length < MIN_GROUP_NAME || clean.length > MAX_GROUP_NAME) {
      throw new GroupError(`O nome do grupo precisa ter de ${MIN_GROUP_NAME} a ${MAX_GROUP_NAME} caracteres.`);
    }
    const id = await this.rpc<string>('create_group', { p_name: clean });
    this.holder.setActiveGroup(id);
  }

  async join(codeOrLink: string): Promise<void> {
    const token = parseInviteToken(codeOrLink);
    if (!token) throw new GroupError('Convite não encontrado. Confira o código ou o link.');
    const id = await this.rpc<string>('redeem_invite', { p_token: token });
    this.holder.setActiveGroup(id);
  }

  use(groupId: string): void {
    this.holder.setActiveGroup(groupId);
  }

  /** The invite link to share (valid 72 hours, up to 20 people: the server's defaults). */
  async invite(groupId: string): Promise<string> {
    const token = await this.rpc<string>('create_invite', { p_group_id: groupId });
    return `${this.baseUrl}?${INVITE_PARAM}=${token}`;
  }

  async members(groupId: string): Promise<MemberInfo[]> {
    const rows = await this.rpc<MemberRow[] | null>('group_members', { p_group_id: groupId });
    return (rows ?? []).map((row) => ({
      userId: row.user_id,
      nickname: row.nickname,
      role: row.role,
      me: row.me,
    }));
  }

  async removeMember(groupId: string, userId: string): Promise<void> {
    await this.rpc('remove_member', { p_group_id: groupId, p_user_id: userId });
  }

  async leave(groupId: string): Promise<void> {
    await this.rpc('leave_group', { p_group_id: groupId });
    if (this.holder.getActiveGroup() === groupId) this.holder.setActiveGroup(null);
  }

  /**
   * Makes sure the active group is one the player still belongs to (they may have been
   * removed, or it is a new device); falls back to the first group, or none.
   */
  async ensureActive(): Promise<GroupInfo | null> {
    let groups: GroupInfo[];
    try {
      groups = await this.list();
    } catch {
      return null;
    }
    const current = groups.find((group) => group.id === this.holder.getActiveGroup());
    const chosen = current ?? groups[0] ?? null;
    this.holder.setActiveGroup(chosen?.id ?? null);
    return chosen ? { ...chosen, active: true } : null;
  }
}
